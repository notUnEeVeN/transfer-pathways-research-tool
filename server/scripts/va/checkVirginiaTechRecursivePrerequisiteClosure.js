#!/usr/bin/env node
/**
 * Read-only replay of the finite Virginia Tech recursive Figure 6 evidence.
 *
 * This command reads retained artifacts and source bytes only. It performs no
 * network, database, or filesystem writes. It proves the three promoted
 * corequisite formula projections, preserves all five blockers, and executes
 * the real compiler/parent-map behavior for each relevant formula shape.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  buildExactVirginiaParentMap,
  compileValidatedVirginiaFormulaCorpora,
} = require('../../services/analysis/pathwayComplexity');
const {
  extractCourseLeafEntries,
} = require('../../services/virginia/universityPrerequisiteAcquisition');
const {
  OWNER,
  RECIPROCAL_COREQUISITE_CODES,
  SAFE_COREQUISITE_CODES,
  TARGET_CODES,
  buildVirginiaTechRecursivePrerequisiteControl,
  canonicalJson,
  resolutionRowIssues,
  sha256,
  summarizeVirginiaTechRecursivePrerequisites,
} = require('../../services/virginia/virginiaTechRecursivePrerequisiteClosureEvidence');

const SERVER = path.resolve(__dirname, '../..');
const CANDIDATES = path.join(
  SERVER, '.va-catalogs/research/va-university-prerequisite-candidates.json',
);
const REVIEW = path.join(
  SERVER, '.va-catalogs/research/va-university-prerequisite-review.json',
);
const VCCS_NONE = Object.freeze({
  course_key: 'va:CSC100',
  owner_namespace: 'va:vccs',
  status: 'none',
  source: 'vccs_master_course_file',
  source_url: 'https://courses.vccs.edu/courses/CSC100',
  raw_requisites: null,
  groups: [],
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const clone = (value) => JSON.parse(JSON.stringify(value));

function sourceBytesReplay(candidates, readFile = fs.readFileSync) {
  const byCachePath = new Map();
  for (const candidate of candidates) {
    const cachePath = candidate?.source?.cache_path;
    if (!cachePath) throw new Error(`${candidate.course_key}: source cache path missing`);
    const rows = byCachePath.get(cachePath) || [];
    rows.push(candidate);
    byCachePath.set(cachePath, rows);
  }
  let replayedEntries = 0;
  for (const [cachePath, rows] of byCachePath) {
    const bytes = readFile(path.join(SERVER, '.va-catalogs', cachePath));
    const expected = rows[0].source;
    if (!Buffer.isBuffer(bytes)
        || bytes.length !== expected.source_response_bytes
        || sha256(bytes) !== expected.source_response_sha256) {
      throw new Error(`${cachePath}: retained source response bytes changed`);
    }
    const extracted = extractCourseLeafEntries(
      bytes.toString('utf8'), rows.map((row) => row.course_code),
    );
    if (extracted.missing.length || extracted.ambiguous.length
        || extracted.courseblock_count
          !== expected.complete_entry_receipt.source_courseblock_count
        || extracted.complete_entry_count
          !== expected.complete_entry_receipt.source_complete_entry_count
        || extracted.complete_entries_with_required_requisite_marker_count
          !== expected.complete_entry_receipt
            .source_complete_entries_with_required_requisite_marker_count) {
      throw new Error(`${cachePath}: retained complete-entry boundary changed`);
    }
    for (const candidate of rows) {
      const entry = extracted.entries.find((row) => row.course_code === candidate.course_code);
      const source = candidate.source;
      if (!entry
          || entry.courseblock_index !== source.courseblock_index
          || entry.raw_entry_text !== source.raw_entry_text
          || entry.raw_entry_sha256 !== source.raw_entry_sha256
          || entry.raw_entry_html_sha256 !== source.raw_entry_html_sha256
          || canonicalJson(entry.published_units) !== canonicalJson(source.published_units)
          || canonicalJson(entry.structured_requisite_fields)
            !== canonicalJson(source.structured_requisite_fields)
          || canonicalJson(entry.complete_entry_receipt)
            !== canonicalJson(source.complete_entry_receipt)) {
        throw new Error(`${candidate.course_key}: retained complete entry changed`);
      }
      replayedEntries += 1;
    }
  }
  return { source_responses: byCachePath.size, complete_entries: replayedEntries };
}

function universityNone(courseKey, sourceRow) {
  return {
    course_key: courseKey,
    owner_namespace: OWNER,
    status: 'none',
    source: 'institution_catalog',
    source_url: sourceRow.source_url,
    source_bundle_hash: sourceRow.source_bundle_hash,
    raw_requisites: null,
    groups: [],
  };
}

function compileRows(universityRows, requiredUniversityKeys) {
  return compileValidatedVirginiaFormulaCorpora({
    communityCollegeRows: [VCCS_NONE],
    universityRows,
    requiredCommunityCollegeKeys: [VCCS_NONE.course_key],
    requiredUniversityKeys,
  });
}

function exactSourceProjection(row) {
  const resolution = row.virginia_tech_recursive_prerequisite_resolution;
  const exact = resolution?.proof?.exact_source_formula || resolution;
  return {
    ...clone(row),
    status: 'parsed',
    source_bundle_hash: row.source_bundle_hash
      || row.review_evidence?.source_response_sha256,
    raw_requisites: exact.raw_requisites,
    groups: clone(exact.groups),
  };
}

function productionCompilerProbe(rowsByCode) {
  const safeRoutes = [];
  for (const code of SAFE_COREQUISITE_CODES) {
    const row = rowsByCode.get(code);
    const references = [...new Set(row.groups.flatMap((group) => (
      group.paths.flatMap((formulaPath) => formulaPath.all_of
        .filter((condition) => condition.type === 'course')
        .map((condition) => condition.course_key))
    )))];
    const compiled = compileRows(
      [row, ...references.map((key) => universityNone(key, row))], [row.course_key],
    );
    if (!compiled.ready) throw new Error(`${code}: production compiler rejected exact formula`);
    for (const formulaPath of row.groups[0].paths) {
      const represented = formulaPath.all_of.map((condition) => condition.course_key);
      const graph = buildExactVirginiaParentMap({
        compiledCorpora: compiled.corpora,
        pathwayCourseKeys: [row.course_key, ...represented],
      });
      if (!graph.ready
          || canonicalJson(graph.parents_by_course_key.get(row.course_key))
            !== canonicalJson(represented)) {
        throw new Error(`${code}: production parent map changed for an exact route`);
      }
      safeRoutes.push({ course_code: code, parent_course_keys: represented });
    }
  }

  const reciprocalRows = RECIPROCAL_COREQUISITE_CODES.map((code) => (
    exactSourceProjection(rowsByCode.get(code))
  ));
  const reciprocalCompiled = compileRows(
    reciprocalRows, reciprocalRows.map((row) => row.course_key),
  );
  if (!reciprocalCompiled.ready) {
    throw new Error('ISC reciprocal source formulas no longer compile');
  }
  const reciprocalGraph = buildExactVirginiaParentMap({
    compiledCorpora: reciprocalCompiled.corpora,
    pathwayCourseKeys: reciprocalRows.map((row) => row.course_key),
  });
  const cycle = reciprocalGraph.issues?.find((issue) => issue.code === 'requisite_graph_cycle');
  if (reciprocalGraph.ready || canonicalJson(cycle?.cycle) !== canonicalJson([
    `${OWNER}:ISC1105`, `${OWNER}:ISC1115`, `${OWNER}:ISC1105`,
  ])) throw new Error('ISC reciprocal production-cycle behavior changed');

  const math = exactSourceProjection(rowsByCode.get('MATH1014'));
  const mathCompiled = compileRows([math], [math.course_key]);
  if (!mathCompiled.ready) throw new Error('MATH1014 exact source formula no longer compiles');
  const mathGraph = buildExactVirginiaParentMap({
    compiledCorpora: mathCompiled.corpora,
    pathwayCourseKeys: [math.course_key],
  });
  if (mathGraph.ready || !mathGraph.issues?.some((issue) => (
    issue.code === 'non_course_formula_path_unresolved'
  ))) throw new Error('MATH1014 unbound non-course runtime behavior changed');

  return {
    safe_formula_routes: safeRoutes,
    reciprocal_cycle: cycle.cycle,
    math1014_runtime_blocker: 'non_course_formula_path_unresolved',
  };
}

function checkFromArtifacts({
  candidatesArtifact,
  reviewArtifact,
  readFile = fs.readFileSync,
} = {}) {
  if (!candidatesArtifact || !reviewArtifact) throw new Error('candidate and review artifacts required');
  const candidates = asArray(candidatesArtifact.candidates).filter((row) => (
    row.owner_namespace === OWNER && TARGET_CODES.includes(row.course_code)
  ));
  if (candidates.length !== TARGET_CODES.length
      || new Set(candidates.map((row) => row.course_code)).size !== TARGET_CODES.length) {
    throw new Error('Virginia Tech exact target candidate population changed');
  }
  const control = buildVirginiaTechRecursivePrerequisiteControl(candidates);
  if (!control.verified) {
    throw new Error(`Virginia Tech exact source control failed: ${control.issues.join(', ')}`);
  }
  const sourceReplay = sourceBytesReplay(candidates, readFile);
  const summary = summarizeVirginiaTechRecursivePrerequisites(candidates);
  if (canonicalJson(reviewArtifact.virginia_tech_recursive_prerequisite_audit)
      !== canonicalJson(summary)) {
    throw new Error('Virginia Tech shared review audit changed');
  }
  const rows = asArray(reviewArtifact.review_rows).filter((row) => (
    row.owner_namespace === OWNER && TARGET_CODES.includes(row.code)
  ));
  if (rows.length !== TARGET_CODES.length
      || new Set(rows.map((row) => row.code)).size !== TARGET_CODES.length) {
    throw new Error('Virginia Tech shared review target population changed');
  }
  const rowsByCode = new Map(rows.map((row) => [row.code, row]));
  for (const code of TARGET_CODES) {
    const issues = resolutionRowIssues(rowsByCode.get(code));
    if (issues.length) throw new Error(`${code}: shared review projection changed: ${issues.join(', ')}`);
  }
  const promotedCodes = rows.filter((row) => row.status === 'parsed').map((row) => row.code).sort();
  const blockedCodes = rows.filter((row) => row.status === 'unparsed').map((row) => row.code).sort();
  if (canonicalJson(promotedCodes) !== canonicalJson([...SAFE_COREQUISITE_CODES].sort())
      || canonicalJson(blockedCodes) !== canonicalJson([
        'CHEM1014', 'CS3704', 'ISC1105', 'ISC1115', 'MATH1014',
      ])) throw new Error('Virginia Tech promotion/blocker disposition changed');
  const promotedByKey = new Map(asArray(reviewArtifact.promoted_rows)
    .map((row) => [row.course_key, row]));
  const directReferences = [...new Set(SAFE_COREQUISITE_CODES.flatMap((code) => (
    rowsByCode.get(code).groups.flatMap((group) => group.paths.flatMap((formulaPath) => (
      formulaPath.all_of.filter((condition) => condition.type === 'course')
        .map((condition) => condition.course_key)
    )))
  )))].sort();
  const missingReferences = directReferences.filter((key) => !promotedByKey.has(key));
  if (missingReferences.length) {
    throw new Error(`promoted Virginia Tech formula references missing: ${missingReferences.join(', ')}`);
  }
  const compilerProbe = productionCompilerProbe(rowsByCode);
  return {
    verified: true,
    contract: control.contract,
    control_receipt_sha256: control.receipt_sha256,
    target_rows: rows.length,
    promoted_codes: promotedCodes,
    blocked_codes: blockedCodes,
    direct_formula_references: directReferences,
    retained_source_replay: sourceReplay,
    production_compiler_probe: compilerProbe,
  };
}

function buildFromArtifacts({ readFile = fs.readFileSync } = {}) {
  return checkFromArtifacts({
    candidatesArtifact: JSON.parse(readFile(CANDIDATES, 'utf8')),
    reviewArtifact: JSON.parse(readFile(REVIEW, 'utf8')),
    readFile,
  });
}

function main(args = process.argv.slice(2)) {
  const unknown = args.filter((arg) => arg !== '--json');
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const summary = buildFromArtifacts();
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  }
  console.log('Virginia Tech recursive prerequisite closure: VERIFIED');
  console.log(`  exact target rows ${summary.target_rows}`);
  console.log(`  promoted exact corequisites ${summary.promoted_codes.join(', ')}`);
  console.log(`  preserved blockers ${summary.blocked_codes.join(', ')}`);
  console.log(`  retained source replay ${summary.retained_source_replay.complete_entries} entries / ${summary.retained_source_replay.source_responses} responses`);
  console.log(`  production formula routes ${summary.production_compiler_probe.safe_formula_routes.length}`);
  console.log(`  control receipt ${summary.control_receipt_sha256}`);
  return summary;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  CANDIDATES,
  REVIEW,
  buildFromArtifacts,
  checkFromArtifacts,
  main,
  productionCompilerProbe,
  sourceBytesReplay,
};
