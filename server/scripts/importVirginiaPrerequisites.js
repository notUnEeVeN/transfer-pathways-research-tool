#!/usr/bin/env node
/**
 * Validate and optionally import the Virginia prerequisite source artifacts.
 *
 * This importer is intentionally separate from importVirginiaCourses.js:
 * that script replaces `va_courses`, so enriching those documents would be
 * erased on the next course refresh.  The two collections written here are:
 *
 *   - va_course_concepts
 *   - va_course_requisites
 *
 * Validation/dry-run is the default.  Mongo writes require `--write`.
 *
 * Usage (from server/):
 *   node scripts/importVirginiaPrerequisites.js
 *   node scripts/importVirginiaPrerequisites.js --write --uri mongodb://localhost:27017
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MongoClient } = require('mongodb');
const { courseIdFor } = require('./buildVirginiaPrerequisites');

const REPO = path.resolve(__dirname, '..', '..');
const DEFAULT_SCOPE = path.join(__dirname, '..', '.va-degrees', 'cs_course_scope.json');
const DEFAULT_CONCEPTS = path.join(REPO, 'scripts', 'data', 'prereq_concepts.json');
const DEFAULT_COURSE_ARTIFACT = path.join(REPO, 'scripts', 'data', 'va_course_concepts.json');
const DEFAULT_REQUISITE_ARTIFACT = path.join(REPO, 'scripts', 'data', 'va_course_requisites.json');
const STATUSES = new Set(['parsed', 'none', 'missing', 'unparsed']);
const KINDS = new Set(['prerequisite', 'corequisite']);

function valueAfter(argv, flag, fallback = null) {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')
    ? argv[index + 1]
    : fallback;
}

function optionsFrom(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    uri: valueAfter(argv, '--uri', process.env.MONGO_URI || 'mongodb://localhost:27017'),
    dbName: valueAfter(argv, '--db', process.env.DB_NAME || 'pmt_research'),
    scopeFile: valueAfter(argv, '--scope', DEFAULT_SCOPE),
    conceptsFile: valueAfter(argv, '--concepts', DEFAULT_CONCEPTS),
    courseArtifact: valueAfter(argv, '--course-artifact', DEFAULT_COURSE_ARTIFACT),
    requisiteArtifact: valueAfter(argv, '--requisite-artifact', DEFAULT_REQUISITE_ARTIFACT),
  };
}

function invariant(ok, message) {
  if (!ok) throw new Error(message);
}

function validateUnique(rows, field, label) {
  const seen = new Set();
  for (const row of rows) {
    invariant(row[field] !== undefined && row[field] !== null, `${label}: missing ${field}`);
    invariant(!seen.has(row[field]), `${label}: duplicate ${field} ${row[field]}`);
    seen.add(row[field]);
  }
}

function validateIdentity(row, label) {
  invariant(/^[A-Z]{2,5}\d{2,4}[A-Z]?$/.test(row.code), `${label}: invalid code ${row.code}`);
  invariant(row._id === `${label === 'concept' ? 'va:concept' : 'va:req'}:${row.code}`, `${label} ${row.code}: bad _id`);
  invariant(row.course_id === courseIdFor(row.code), `${label} ${row.code}: bad course_id`);
  invariant(row.course_key === `va:${row.code}`, `${label} ${row.code}: bad course_key`);
  invariant(row.course_ref === `va:crs:${row.code}`, `${label} ${row.code}: bad course_ref`);
}

function validateConceptArtifact(artifact, allowedConcepts) {
  invariant(artifact && typeof artifact === 'object', 'concept artifact must be an object');
  invariant(Array.isArray(artifact.rows), 'concept artifact rows must be an array');
  validateUnique(artifact.rows, '_id', 'concept artifact');
  validateUnique(artifact.rows, 'code', 'concept artifact');
  validateUnique(artifact.rows, 'course_id', 'concept artifact');

  for (const row of artifact.rows) {
    validateIdentity(row, 'concept');
    invariant(row.concept_source && typeof row.concept_source === 'string', `concept ${row.code}: concept_source is required even for examined-null`);
    invariant(typeof row.concept_note === 'string' && row.concept_note, `concept ${row.code}: concept_note required`);
    invariant(Number.isFinite(row.concept_confidence), `concept ${row.code}: concept_confidence must be numeric`);
    invariant(row.concept_confidence >= 0 && row.concept_confidence <= 1, `concept ${row.code}: concept_confidence outside 0..1`);
    invariant(row.concept === null || allowedConcepts.has(row.concept), `concept ${row.code}: unknown concept ${row.concept}`);
    invariant(['reviewed', 'needs_review'].includes(row.review_status), `concept ${row.code}: invalid review_status`);
    invariant(Array.isArray(row.flags), `concept ${row.code}: flags must be an array`);
    invariant(['major_preparation', 'prerequisite_only'].includes(row.scope_role), `concept ${row.code}: invalid scope_role`);
    invariant(Array.isArray(row.scope_colleges), `concept ${row.code}: scope_colleges must be an array`);
    if (row.scope_role === 'major_preparation') {
      invariant(row.scope_source === 'cs_course_scope', `concept ${row.code}: direct row lacks cs_course_scope provenance`);
      invariant(row.scope_colleges.length > 0, `concept ${row.code}: direct row lacks requirement-derived colleges`);
    }
    if (row.supply_kind === 'richard_bland_scope') {
      invariant(row.flags.includes('non_vccs'), `concept ${row.code}: RBC-only row lacks non_vccs flag`);
      invariant(row.flags.includes('institution_local'), `concept ${row.code}: RBC-only row lacks institution_local flag`);
      invariant(row.source !== 'vccs_master_course_file', `concept ${row.code}: RBC-only row used VCCS identity`);
    }
    if (row.flags.includes('mixed_scope_identity_collision')) {
      invariant(Array.isArray(row.institution_overrides) && row.institution_overrides.length, `concept ${row.code}: mixed identity lacks institution override`);
      invariant(row.review_status === 'needs_review', `concept ${row.code}: mixed identity must need review`);
    }
    if (row.transfer_evidence?.status === 'no_scope_college_overlap' && row.source === 'requirement_scope_only') {
      invariant(row.transfer_evidence.used_as_title_evidence === false, `concept ${row.code}: collision used as title evidence`);
      invariant(row.title_seen === null, `concept ${row.code}: untrusted collision supplied title`);
    }
  }

  const totals = artifact.meta?.totals || {};
  invariant(totals.rows === artifact.rows.length, 'concept totals.rows mismatch');
  invariant(totals.direct_rows === artifact.rows.filter((row) => row.scope_role === 'major_preparation').length, 'concept totals.direct_rows mismatch');
  invariant(totals.direct_rows === artifact.meta?.counts?.scope_codes, 'concept direct rows must cover every scope code');
  invariant(totals.mapped === artifact.rows.filter((row) => row.concept).length, 'concept totals.mapped mismatch');
  invariant(totals.examined_null === artifact.rows.filter((row) => !row.concept).length, 'concept totals.examined_null mismatch');
  invariant(totals.needs_review === artifact.rows.filter((row) => row.review_status === 'needs_review').length, 'concept totals.needs_review mismatch');
  if (artifact.meta?.legacy_scope_review) {
    const legacy = artifact.meta.legacy_scope_review;
    invariant(legacy.population === legacy.mapped + legacy.examined_null, 'legacy review totals mismatch');
    invariant(totals.legacy_mapped === legacy.mapped, 'concept totals.legacy_mapped mismatch');
    invariant(totals.legacy_examined_null === legacy.examined_null, 'concept totals.legacy_examined_null mismatch');
  }
}

function validateCondition(condition, rowCode) {
  invariant(condition && typeof condition === 'object', `requisite ${rowCode}: condition must be an object`);
  if (condition.type === 'course') {
    invariant(/^[A-Z]{2,5}\d{2,4}[A-Z]?$/.test(condition.code), `requisite ${rowCode}: bad condition course code`);
    invariant(condition.course_key === `va:${condition.code}`, `requisite ${rowCode}: incompatible condition course_key`);
    invariant(condition.course_ref === `va:crs:${condition.code}`, `requisite ${rowCode}: incompatible condition course_ref`);
    if (condition.minimum_grade !== undefined) {
      invariant(/^[ABCDF][+-]?$/.test(condition.minimum_grade), `requisite ${rowCode}: invalid minimum grade`);
    }
    return;
  }
  invariant(condition.type === 'non_course', `requisite ${rowCode}: unknown condition type ${condition.type}`);
  invariant(typeof condition.condition === 'string' && condition.condition, `requisite ${rowCode}: non-course condition type required`);
  invariant(typeof condition.raw === 'string' && condition.raw, `requisite ${rowCode}: non-course raw required`);
  if (condition.code !== undefined) {
    invariant(condition.course_key === `va:${condition.code}`, `requisite ${rowCode}: eligibility condition course_key mismatch`);
    invariant(condition.course_ref === `va:crs:${condition.code}`, `requisite ${rowCode}: eligibility condition course_ref mismatch`);
  }
}

function validateRequisiteArtifact(artifact) {
  invariant(artifact && typeof artifact === 'object', 'requisite artifact must be an object');
  invariant(Array.isArray(artifact.rows), 'requisite artifact rows must be an array');
  validateUnique(artifact.rows, '_id', 'requisite artifact');
  validateUnique(artifact.rows, 'code', 'requisite artifact');
  validateUnique(artifact.rows, 'course_id', 'requisite artifact');
  const codes = new Set(artifact.rows.map((row) => row.code));

  for (const row of artifact.rows) {
    validateIdentity(row, 'requisite');
    invariant(STATUSES.has(row.status), `requisite ${row.code}: invalid status ${row.status}`);
    invariant(Array.isArray(row.groups), `requisite ${row.code}: groups must be an array`);
    invariant(Array.isArray(row.flags), `requisite ${row.code}: flags must be an array`);
    invariant(['major_preparation', 'prerequisite_only'].includes(row.scope_role), `requisite ${row.code}: invalid scope_role`);
    invariant(Array.isArray(row.scope_colleges), `requisite ${row.code}: scope_colleges must be an array`);
    if (row.scope_role === 'major_preparation') {
      invariant(row.scope_source === 'cs_course_scope', `requisite ${row.code}: direct row lacks cs_course_scope provenance`);
      invariant(row.scope_colleges.length > 0, `requisite ${row.code}: direct row lacks requirement-derived colleges`);
    }
    if (row.supply_kind === 'richard_bland_scope') {
      invariant(row.status === 'missing', `requisite ${row.code}: RBC-only row must not publish a VCCS rule`);
      invariant(row.groups.length === 0, `requisite ${row.code}: RBC-only row has VCCS groups`);
      invariant(row.flags.includes('non_vccs'), `requisite ${row.code}: RBC-only row lacks non_vccs flag`);
      invariant(row.flags.includes('institution_local'), `requisite ${row.code}: RBC-only row lacks institution_local flag`);
      invariant(row.flags.includes('local_requisite_source_missing'), `requisite ${row.code}: RBC-only row lacks local source flag`);
      invariant(row.source !== 'vccs_master_course_file', `requisite ${row.code}: RBC-only row used VCCS authority`);
    }
    if (row.flags.includes('mixed_scope_identity_collision')) {
      invariant(Array.isArray(row.institution_overrides) && row.institution_overrides.length, `requisite ${row.code}: mixed identity lacks institution override`);
    }
    if (row.status === 'none' || row.status === 'missing') {
      invariant(row.groups.length === 0, `requisite ${row.code}: ${row.status} row has groups`);
    } else {
      invariant(row.groups.length > 0, `requisite ${row.code}: ${row.status} row lacks groups`);
      invariant(typeof row.raw_requisites === 'string' && row.raw_requisites, `requisite ${row.code}: raw_requisites required`);
    }
    if (row.status === 'unparsed') invariant(row.flags.includes('needs_review'), `requisite ${row.code}: unparsed row must need review`);

    for (const group of row.groups) {
      invariant(KINDS.has(group.kind), `requisite ${row.code}: invalid group kind`);
      invariant(group.formula === 'paths_or__conditions_and', `requisite ${row.code}: invalid formula marker`);
      invariant(typeof group.raw === 'string' && group.raw, `requisite ${row.code}: group raw required`);
      invariant(Array.isArray(group.paths) && group.paths.length, `requisite ${row.code}: group paths required`);
      for (const formulaPath of group.paths) {
        invariant(Array.isArray(formulaPath.all_of) && formulaPath.all_of.length, `requisite ${row.code}: empty all_of path`);
        for (const condition of formulaPath.all_of) {
          validateCondition(condition, row.code);
          if (condition.type === 'course') {
            invariant(codes.has(condition.code), `requisite ${row.code}: closure missing ${condition.code}`);
          }
        }
      }
    }
  }

  const totals = artifact.meta?.totals || {};
  invariant(totals.rows === artifact.rows.length, 'requisite totals.rows mismatch');
  for (const status of STATUSES) {
    invariant(totals[status] === artifact.rows.filter((row) => row.status === status).length, `requisite totals.${status} mismatch`);
  }
  invariant(totals.flagged === artifact.rows.filter((row) => row.flags.length).length, 'requisite totals.flagged mismatch');
  invariant(artifact.rows.filter((row) => row.scope_role === 'major_preparation').length === artifact.meta?.counts?.scope_codes, 'requisite direct rows must cover every scope code');
  const queue = artifact.meta?.formula_review_queue || [];
  invariant(queue.length === totals.unparsed, 'formula review queue must contain every unparsed row');
}

function normalizedScopeCodes(scope) {
  invariant(Array.isArray(scope), 'scope artifact must be an array');
  const codes = scope.map((row) => String(row?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  invariant(codes.every((code) => /^[A-Z]{2,5}\d{2,4}[A-Z]?$/.test(code)), 'scope artifact contains an invalid course code');
  invariant(new Set(codes).size === codes.length, 'scope artifact contains duplicate course codes');
  return new Set(codes);
}

function validateDirectSet(label, rows, expected) {
  const actual = new Set(
    rows.filter((row) => row.scope_role === 'major_preparation').map((row) => row.code)
  );
  const missing = [...expected].filter((code) => !actual.has(code)).sort();
  const unexpected = [...actual].filter((code) => !expected.has(code)).sort();
  invariant(
    missing.length === 0 && unexpected.length === 0,
    `${label} direct scope mismatch: missing [${missing.join(', ')}]; unexpected [${unexpected.join(', ')}]`
  );
}

function validateScopeCoverage(scope, concepts, requisites) {
  const expected = normalizedScopeCodes(scope);
  validateDirectSet('concept artifact', concepts.rows, expected);
  validateDirectSet('requisite artifact', requisites.rows, expected);
  invariant(concepts.meta?.counts?.scope_codes === expected.size, 'concept metadata scope count mismatch');
  invariant(requisites.meta?.counts?.scope_codes === expected.size, 'requisite metadata scope count mismatch');
  return expected;
}

function validateArtifactAlignment(concepts, requisites) {
  const conceptByCode = new Map(concepts.rows.map((row) => [row.code, row]));
  const requisiteByCode = new Map(requisites.rows.map((row) => [row.code, row]));
  const conceptCodes = new Set(conceptByCode.keys());
  const requisiteCodes = new Set(requisiteByCode.keys());
  const conceptOnly = [...conceptCodes].filter((code) => !requisiteCodes.has(code)).sort();
  const requisiteOnly = [...requisiteCodes].filter((code) => !conceptCodes.has(code)).sort();
  invariant(
    conceptOnly.length === 0 && requisiteOnly.length === 0,
    `artifact code-set mismatch: concept-only [${conceptOnly.join(', ')}]; requisite-only [${requisiteOnly.join(', ')}]`
  );

  const normalizedColleges = (row) => [...new Set(row.scope_colleges || [])].sort();
  const normalizedOverrides = (row) => (row.institution_overrides || [])
    .map((override) => ({
      institution: override.institution,
      title: override.title ?? null,
      source: override.source,
      source_url: override.source_url ?? null,
      concept: override.concept ?? null,
    }))
    .sort((a, b) => String(a.institution).localeCompare(String(b.institution)));
  for (const [code, concept] of conceptByCode) {
    const requisite = requisiteByCode.get(code);
    for (const field of ['course_id', 'course_key', 'course_ref', 'scope_role', 'scope_source']) {
      invariant(concept[field] === requisite[field], `${code}: concept/requisite ${field} mismatch`);
    }
    invariant(
      JSON.stringify(normalizedColleges(concept)) === JSON.stringify(normalizedColleges(requisite)),
      `${code}: concept/requisite scope_colleges mismatch`
    );
    invariant(
      JSON.stringify(normalizedOverrides(concept)) === JSON.stringify(normalizedOverrides(requisite)),
      `${code}: concept/requisite institution_overrides mismatch`
    );
  }
}

function generationFor(concepts, requisites) {
  return createHash('sha256')
    .update(JSON.stringify({ concepts, requisites }))
    .digest('hex');
}

function rowsForImport(rows, importGeneration, importedAt) {
  return rows.map((row) => ({
    ...row,
    import_generation: importGeneration,
    imported_at: importedAt,
  }));
}

function loadAndValidate(opts = {}) {
  const resolved = { ...optionsFrom([]), ...opts };
  for (const file of [resolved.scopeFile, resolved.conceptsFile, resolved.courseArtifact, resolved.requisiteArtifact]) {
    invariant(fs.existsSync(file), `missing artifact ${file}`);
  }
  const scope = JSON.parse(fs.readFileSync(resolved.scopeFile, 'utf8'));
  const vocabulary = JSON.parse(fs.readFileSync(resolved.conceptsFile, 'utf8'));
  const concepts = JSON.parse(fs.readFileSync(resolved.courseArtifact, 'utf8'));
  const requisites = JSON.parse(fs.readFileSync(resolved.requisiteArtifact, 'utf8'));
  const allowedConcepts = new Set(vocabulary.concepts.map((concept) => concept.slug));
  validateConceptArtifact(concepts, allowedConcepts);
  validateRequisiteArtifact(requisites);
  const scopeCodes = validateScopeCoverage(scope, concepts, requisites);
  validateArtifactAlignment(concepts, requisites);
  const importGeneration = generationFor(concepts, requisites);
  return { scope, scopeCodes, concepts, requisites, allowedConcepts, importGeneration };
}

async function writeCollections(opts, artifacts) {
  const client = new MongoClient(opts.uri);
  await client.connect();
  try {
    const db = client.db(opts.dbName);
    const importedAt = new Date();
    for (const [name, rows] of [
      ['va_course_concepts', artifacts.concepts.rows],
      ['va_course_requisites', artifacts.requisites.rows],
    ]) {
      const staging = `${name}__staging`;
      await db.collection(staging).drop().catch(() => {});
      if (rows.length) {
        await db.collection(staging).insertMany(
          rowsForImport(rows, artifacts.importGeneration, importedAt),
          { ordered: false }
        );
      }
      await db.collection(staging).rename(name, { dropTarget: true });
    }
    await db.collection('va_course_concepts').createIndex({ course_id: 1 }, { unique: true });
    await db.collection('va_course_concepts').createIndex({ course_key: 1 }, { unique: true });
    await db.collection('va_course_concepts').createIndex({ concept: 1, review_status: 1 });
    await db.collection('va_course_requisites').createIndex({ course_id: 1 }, { unique: true });
    await db.collection('va_course_requisites').createIndex({ course_key: 1 }, { unique: true });
    await db.collection('va_course_requisites').createIndex({ status: 1, scope_role: 1 });
  } finally {
    await client.close();
  }
}

async function run(opts = optionsFrom()) {
  const log = (...args) => console.log('[va:prereq-import]', ...args);
  const artifacts = loadAndValidate(opts);
  const conceptTotals = artifacts.concepts.meta.totals;
  const requisiteTotals = artifacts.requisites.meta.totals;
  log(`validated ${conceptTotals.rows} concept rows (${conceptTotals.mapped} mapped, ${conceptTotals.examined_null} examined-null)`);
  log(`validated ${requisiteTotals.rows} requisite rows (${requisiteTotals.parsed} parsed, ${requisiteTotals.none} none, ${requisiteTotals.missing} missing, ${requisiteTotals.unparsed} unparsed)`);
  log(`import generation ${artifacts.importGeneration}`);
  if (!opts.write) {
    log('dry run — nothing written; pass --write to replace the two Virginia prerequisite collections');
    return artifacts;
  }
  log(`writing to ${opts.uri.replace(/\/\/[^@]*@/, '//<redacted>@')} · db ${opts.dbName}`);
  await writeCollections(opts, artifacts);
  log(`wrote va_course_concepts (${conceptTotals.rows}) and va_course_requisites (${requisiteTotals.rows})`);
  return artifacts;
}

module.exports = {
  optionsFrom,
  validateConceptArtifact,
  validateRequisiteArtifact,
  validateScopeCoverage,
  validateArtifactAlignment,
  generationFor,
  rowsForImport,
  loadAndValidate,
  writeCollections,
  run,
};

if (require.main === module) {
  run().catch((error) => {
    console.error('[va:prereq-import] FATAL', error.stack || error.message);
    process.exit(1);
  });
}
