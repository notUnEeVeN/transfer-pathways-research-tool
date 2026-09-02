#!/usr/bin/env node
/**
 * Build the Virginia CS prerequisite source artifacts.
 *
 * Inputs:
 *   - `va_courses` (the already-imported live Transfer Virginia course corpus)
 *   - `.va-degrees/cs_course_scope.json` (the degree-map scope/provenance)
 *   - official VCCS Master Course File pages at courses.vccs.edu
 *
 * The command is report-only unless `--write` is present.  It never writes to
 * Mongo.  Network responses are cached so parser/classifier refinements are
 * deterministic and polite to the public source.
 *
 * Usage (from server/):
 *   node scripts/buildVirginiaPrerequisites.js
 *   node scripts/buildVirginiaPrerequisites.js --check
 *   node scripts/buildVirginiaPrerequisites.js --write
 *   node scripts/buildVirginiaPrerequisites.js --write --refresh
 */
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const {
  VccsCourseClient,
  normalizeCode,
} = require('../services/virginia/vccsCourse');
const { courseIdFor } = require('../services/virginia/courseIdentity');
const {
  DEFAULT_EVIDENCE: DEFAULT_SOUTHWEST_PREREQUISITE_EVIDENCE,
  loadSouthwestVccsPrerequisiteEvidence,
} = require('../services/virginia/southwestVccsPrerequisiteEvidence');
const {
  DEFAULT_EVIDENCE: DEFAULT_LAUREL_RIDGE_PREREQUISITE_EVIDENCE,
  loadLaurelRidgeVccsPrerequisiteEvidence,
} = require('../services/virginia/laurelRidgeVccsPrerequisiteEvidence');

const REPO = path.resolve(__dirname, '..', '..');
const DEFAULT_SCOPE = path.join(__dirname, '..', '.va-degrees', 'cs_course_scope.json');
const DEFAULT_RICHARD_BLAND_REQUIREMENTS = path.join(
  __dirname,
  '..',
  '.va-catalogs',
  'requirements',
  'richard-bland-college.json'
);
const DEFAULT_CACHE = path.join(__dirname, '..', '.va-prerequisites-cache');
const DEFAULT_CONCEPTS = path.join(REPO, 'scripts', 'data', 'prereq_concepts.json');
const DEFAULT_COURSE_OUTPUT = path.join(REPO, 'scripts', 'data', 'va_course_concepts.json');
const DEFAULT_REQUISITE_OUTPUT = path.join(REPO, 'scripts', 'data', 'va_course_requisites.json');
function valueAfter(argv, flag, fallback = null) {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')
    ? argv[index + 1]
    : fallback;
}

function optionsFrom(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    check: argv.includes('--check'),
    refresh: argv.includes('--refresh'),
    localAudit: !argv.includes('--skip-local-audit'),
    uri: valueAfter(argv, '--uri', 'mongodb://localhost:27017'),
    dbName: valueAfter(argv, '--db', 'pmt_research'),
    scopeFile: valueAfter(argv, '--scope', DEFAULT_SCOPE),
    richardBlandRequirementsFile: valueAfter(
      argv,
      '--richard-bland-requirements',
      DEFAULT_RICHARD_BLAND_REQUIREMENTS
    ),
    southwestPrerequisiteEvidenceFile: valueAfter(
      argv,
      '--southwest-prerequisite-evidence',
      DEFAULT_SOUTHWEST_PREREQUISITE_EVIDENCE,
    ),
    laurelRidgePrerequisiteEvidenceFile: valueAfter(
      argv,
      '--laurel-ridge-prerequisite-evidence',
      DEFAULT_LAUREL_RIDGE_PREREQUISITE_EVIDENCE,
    ),
    cacheDir: valueAfter(argv, '--cache', DEFAULT_CACHE),
    conceptsFile: valueAfter(argv, '--concepts', DEFAULT_CONCEPTS),
    courseOutput: valueAfter(argv, '--course-output', DEFAULT_COURSE_OUTPUT),
    requisiteOutput: valueAfter(argv, '--requisite-output', DEFAULT_REQUISITE_OUTPUT),
    delayMs: Number(valueAfter(argv, '--delay', '100')),
    concurrency: Number(valueAfter(argv, '--concurrency', '4')),
  };
}

const isVccsCollege = (name) => /community college$/i.test(String(name || ''));
const isRichardBland = (name) => /^Richard Bland College$/i.test(String(name || ''));
const sortedUnique = (values) => [...new Set(values)].sort();
const institutionKey = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const EXACT_CONCEPTS = new Map(Object.entries({
  ENG111: ['engl_comp_1', 1, 'statewide_exact'],
  ENG112: ['engl_comp_2', 1, 'statewide_exact'],
  ENGL101: ['engl_comp_1', 0.8, 'institution_local_title'],
  ENGL102: ['engl_comp_2', 0.8, 'institution_local_title'],
  ENG125: ['intro_lit', 1, 'statewide_exact'],
  ENG225: ['intro_lit', 0.8, 'catalog_content_match'],
  ENG251: ['world_lit_1', 0.8, 'historical_vccs_exact'],
  ENG252: ['world_lit_2', 0.8, 'historical_vccs_exact'],
  CST100: ['public_speaking', 1, 'statewide_exact'],
  COMM101: ['public_speaking', 0.8, 'institution_local_title'],
  PLS135: ['intro_american_government', 1, 'statewide_exact'],
  PLS211: ['intro_american_government', 0.8, 'legacy_exact'],
  GOVT201: ['intro_american_government', 0.8, 'institution_local_title'],
  ACC211: ['acct_financial', 1, 'statewide_exact'],
  ACC212: ['acct_managerial', 1, 'statewide_exact'],
  PSY200: ['intro_psychology', 1, 'statewide_exact'],
  SOC200: ['intro_sociology', 1, 'statewide_exact'],
  ECO120: ['econ_intro_combined', 0.8, 'survey_combined'],
  ECO150: ['econ_intro_combined', 1, 'statewide_exact'],
  ECO201: ['econ_macro', 1, 'statewide_exact'],
  ECO202: ['econ_micro', 1, 'statewide_exact'],
  ECON201: ['econ_macro', 0.8, 'institution_local_title'],
  ECON202: ['econ_micro', 0.8, 'institution_local_title'],
  MTH155: ['intro_stats', 1, 'statewide_exact'],
  MTH245: ['intro_stats', 1, 'statewide_exact'],
  BUS216: ['intro_stats', 0.8, 'discipline_variant'],
  BUS221: ['intro_stats', 0.8, 'discipline_variant'],
  BUS224: ['intro_stats', 0.8, 'discipline_variant'],
  BUS225: ['intro_stats', 0.8, 'discipline_variant'],
  MTH161: ['precalc_1', 1, 'statewide_exact'],
  MTH162: ['precalc_2', 1, 'statewide_exact'],
  MTH167: ['precalc_combined', 1, 'statewide_exact'],
  MTH263: ['calc_1', 1, 'statewide_exact'],
  MTH264: ['calc_2', 1, 'statewide_exact'],
  MTH265: ['calc_3', 1, 'statewide_exact'],
  MTH266: ['linear_alg', 1, 'statewide_exact'],
  MTH288: ['discrete_math', 1, 'statewide_exact'],
  MATH252: ['calc_2', 0.8, 'institution_local_title'],
  MATH254: ['linear_alg', 0.8, 'richard_bland_title'],
  MATH271: ['diff_eq', 0.8, 'richard_bland_title'],
  PHY201: ['phys_gen_1', 1, 'statewide_exact'],
  PHY202: ['phys_gen_2', 1, 'statewide_exact'],
  PHY241: ['phys_mech', 1, 'statewide_exact'],
  PHY242: ['phys_em', 1, 'statewide_exact'],
  PHYS201: ['phys_mech', 0.8, 'institution_local_title'],
  PHYS202: ['phys_em', 0.8, 'institution_local_title'],
  CHM111: ['gen_chem_1', 1, 'statewide_exact'],
  CHM112: ['gen_chem_2', 1, 'statewide_exact'],
  BIO101: ['bio_cell_molec', 0.8, 'sequence_content'],
  BIO102: ['bio_organismal', 0.8, 'sequence_content'],
  BIO206: ['bio_cell_molec', 1, 'statewide_exact'],
  BIO256: ['bio_genetics', 1, 'statewide_exact'],
  BIO270: ['bio_organismal', 1, 'statewide_exact'],
  CSC205: ['comp_arch_assembly', 1, 'statewide_exact'],
  CSC208: ['discrete_math', 1, 'statewide_exact'],
  CSC210: ['cs_1', 0.7, 'intro_language_course'],
  CSC215: ['comp_arch_assembly', 0.7, 'partial_concept_match'],
  CSC221: ['cs_1', 1, 'statewide_exact'],
  CSC222: ['cs_2_oop', 1, 'statewide_exact'],
  CSC223: ['cs_3_data_structures', 1, 'statewide_exact'],
  CSCI221: ['cs_1', 0.8, 'institution_local_title'],
  CSCI222: ['cs_2_oop', 0.8, 'richard_bland_title'],
  ITP220: ['cs_2_oop', 0.7, 'advanced_oop_discipline_variant'],
  EGR125: ['cs_1', 0.9, 'engineering_programming_variant'],
  EGR270: ['digital_logic', 1, 'statewide_exact'],
}));

// Deliberately empty today.  The builder retains this explicit outcome so a
// future recurring course can be reported without being forced into a broad
// concept; the three Virginia precalculus candidates were accepted into the
// shared vocabulary before this artifact was finalized.
const CONCEPT_CANDIDATES = new Map();

// Reviewed historical/institution-local identities for the 61 codes the first
// supply-gated build omitted.  These assignments come from the explicit legacy
// scope audit, never from a same-code Transfer Virginia record whose offering
// colleges do not overlap the requirement source.
const LEGACY_CONCEPTS = new Map(Object.entries({
  CSC200: ['cs_1', 0.8, 'historical VCCS introductory computer-science course'],
  CSC201: ['cs_1', 0.8, 'historical VCCS first programming course'],
  CSC202: ['cs_3_data_structures', 0.7, 'historical VCCS sequence; partial numbering evidence'],
  ENG252: ['world_lit_2', 0.8, 'historical VCCS World Literature II identity'],
  ECON201: ['econ_macro', 0.8, 'Richard Bland/institution-local macroeconomics identity'],
  ECON202: ['econ_micro', 0.8, 'Richard Bland/institution-local microeconomics identity'],
  MTH163: ['precalc_1', 0.8, 'retired VCCS Precalculus I number'],
  MTH164: ['precalc_2', 0.8, 'retired VCCS Precalculus II number'],
  MTH166: ['precalc_combined', 0.8, 'retired VCCS combined precalculus number'],
  MTH173: ['calc_1', 0.8, 'retired VCCS Calculus I number'],
  MATH251: ['calc_1', 0.8, 'Richard Bland/institution-local Calculus I identity'],
  MTH174: ['calc_2', 0.8, 'retired VCCS Calculus II number'],
  MTH277: ['calc_3', 0.8, 'retired VCCS Calculus III number'],
  MATH261: ['calc_3', 0.8, 'Richard Bland/institution-local Calculus III identity'],
  MTH240: ['intro_stats', 0.8, 'retired VCCS statistics number'],
  MTH241: ['intro_stats', 0.8, 'retired VCCS statistics number'],
  MTH285: ['linear_alg', 0.8, 'retired VCCS linear algebra number'],
  MTH287: ['discrete_math', 0.8, 'retired VCCS discrete mathematics number'],
  PLS130: ['intro_american_government', 0.8, 'retired VCCS American-government number'],
  PLS212: ['intro_american_government', 0.8, 'historical government sequence; partial concept match'],
  SOC201: ['intro_sociology', 0.8, 'Richard Bland/institution-local introductory sociology identity'],
  SPD100: ['public_speaking', 0.8, 'retired VCCS speech/public-speaking number'],
}));

const LEGACY_AMBIGUOUS = new Map(Object.entries({
  SOC202: 'Historical/institution-local sociology course is only a partial match; retain null pending verification.',
  SPD110: 'Retired speech/communication course may not be specifically public speaking; retain null pending verification.',
}));

// Institution-scoped concepts are deliberately separate from the primary
// VCCS identity.  Only add an override when the Richard Bland catalog evidence
// itself establishes the shared concept.
const RICHARD_BLAND_CONCEPT_OVERRIDES = new Map(Object.entries({
  SOC201: 'intro_sociology',
}));

function classifyCourse(course, master = null) {
  const code = normalizeCode(course.code);
  const exact = EXACT_CONCEPTS.get(code);
  const sourceIsMaster = !!master?.found;
  const baseFlags = [];
  if (course.supply_kind === 'richard_bland_scope') {
    baseFlags.push('richard_bland_scope', 'institution_local', 'non_vccs');
    if (course.vccs_master_not_applicable) baseFlags.push('vccs_master_not_applicable');
  }
  if (course.mixed_scope_identity_collision) {
    baseFlags.push('mixed_scope_identity_collision', 'needs_review');
  }
  if (!sourceIsMaster) {
    if (course.supply_kind !== 'richard_bland_scope') baseFlags.push('no_master_course');
    baseFlags.push('legacy_or_unresolved', 'needs_review');
  }
  if (course.transfer_record_status === 'no_scope_college_overlap') {
    baseFlags.push('transfer_record_scope_collision');
    if (!sourceIsMaster) baseFlags.push('untrusted_transfer_record_ignored');
    if (!sourceIsMaster && !course.title) baseFlags.push('unresolved_title');
  } else if (course.transfer_record_status === 'missing' && !sourceIsMaster) {
    baseFlags.push('missing_transfer_record');
    if (!course.title) baseFlags.push('unresolved_title');
  }
  const forceReview = !sourceIsMaster || !!course.mixed_scope_identity_collision;
  const legacyIdentityFlag = course.supply_kind === 'richard_bland_scope'
    ? 'institution_local'
    : 'legacy_vccs';

  const legacy = !sourceIsMaster ? LEGACY_CONCEPTS.get(code) : null;
  if (legacy) {
    const [concept, confidence, evidence] = legacy;
    return {
      concept,
      confidence,
      classification_method: 'reviewed_legacy_scope',
      review_status: 'needs_review',
      flags: sortedUnique([...baseFlags, legacyIdentityFlag, 'reviewed_legacy_classification', 'needs_review']),
      rationale: `Reviewed legacy classification: ${evidence}. Collided Transfer Virginia titles were not used as evidence.`,
    };
  }

  const ambiguousLegacy = !sourceIsMaster ? LEGACY_AMBIGUOUS.get(code) : null;
  if (ambiguousLegacy) {
    return {
      concept: null,
      confidence: 0,
      classification_method: 'legacy_examined_null',
      review_status: 'needs_review',
      flags: sortedUnique([
        ...baseFlags,
        legacyIdentityFlag,
        'legacy_examined_null',
        'ambiguous_partial_legacy',
        'needs_review',
      ]),
      rationale: ambiguousLegacy,
    };
  }

  // These are the explicitly reviewed null outcomes from the original
  // 61-course legacy/institution-local audit.  Keep concept identity separate
  // from course identity: an unresolved title stays flagged, but the row is no
  // longer an accidental fall-through from the scope expansion.
  if (!sourceIsMaster && course.legacy_review_population) {
    return {
      concept: null,
      confidence: 0,
      classification_method: 'legacy_examined_null',
      review_status: 'needs_review',
      flags: sortedUnique([...baseFlags, legacyIdentityFlag, 'legacy_examined_null', 'needs_review']),
      rationale: 'Explicitly examined in the legacy/institution-local scope audit; no shared prerequisite concept was assigned. Course identity remains separately flagged when no trustworthy title source exists.',
    };
  }

  // Curated exact-code mappings may be supported by the requirement catalogs
  // even when the only same-code Transfer Virginia record is for a different
  // institution.  The mapping is retained, while the collided title remains
  // deliberately unused and the row stays in review.
  if (exact) {
    const [concept, confidence, method] = exact;
    return {
      concept,
      confidence,
      classification_method: method,
      review_status: forceReview || confidence < 1 ? 'needs_review' : 'reviewed',
      flags: sortedUnique([
        ...baseFlags,
        ...(!course.supply_kind?.startsWith('richard_bland') && /(?:historical|legacy)_vccs|legacy_exact/.test(method)
          ? ['legacy_vccs'] : []),
        ...(forceReview || confidence < 1 ? ['needs_review'] : []),
      ]),
      rationale: sourceIsMaster
        ? `Exact code/title classification (${method.replace(/_/g, ' ')}).`
        : `Reviewed exact-code classification (${method.replace(/_/g, ' ')}); any non-overlapping Transfer Virginia title was not used as evidence.`,
    };
  }

  if (!sourceIsMaster && !course.title) {
    return {
      concept: null,
      confidence: 0,
      classification_method: 'unresolved_scope_course',
      review_status: 'needs_review',
      flags: sortedUnique(baseFlags),
      rationale: 'Requirement-scoped course retained, but no trustworthy VCCS master or scope-overlapping Transfer Virginia title was available; manual identification is required.',
    };
  }

  const candidate = CONCEPT_CANDIDATES.get(code);
  if (candidate) {
    return {
      concept: null,
      candidate_concept: candidate[0],
      confidence: 0,
      classification_method: 'candidate_new_concept',
      review_status: 'needs_review',
      flags: [...baseFlags, 'candidate_new_concept', 'needs_review'],
      rationale: candidate[1],
    };
  }

  const ambiguous = /\b(?:Topics In|Seminar|Directed Study|Practicum)\b/i.test(course.title || '');
  return {
    concept: null,
    confidence: 1,
    classification_method: ambiguous ? 'variable_content_examined_null' : 'examined_null',
    review_status: forceReview || ambiguous ? 'needs_review' : 'reviewed',
    flags: [
      ...baseFlags,
      ...(ambiguous ? ['ambiguous_variable_content'] : []),
      ...(forceReview || ambiguous ? ['needs_review'] : []),
    ],
    rationale: ambiguous
      ? 'Variable-content course cannot be assigned from the catalog title/description alone.'
      : 'Examined; content does not match a canonical prerequisite concept in the current shared vocabulary.',
  };
}

function structureSignature(groups) {
  return JSON.stringify((groups || []).map((group) => ({
    kind: group.kind,
    paths: group.paths.map((path) => ({
      all_of: path.all_of.map((condition) => ({
        type: condition.type,
        code: condition.code || null,
        condition: condition.condition || null,
        minimum_grade: condition.minimum_grade || null,
        equivalent_allowed: !!condition.equivalent_allowed,
        raw: condition.type === 'non_course' ? condition.raw : null,
      })),
      residual_text: path.residual_text || null,
    })),
  })));
}

function plausibleRequirementTitle(title) {
  const value = String(title || '').replace(/\s+/g, ' ').trim();
  if (value.length < 3 || value.length > 100 || !/[A-Za-z]/.test(value)) return false;
  if (/^(?:and|or|at least|recommended|take)\b/i.test(value)) return false;
  if (/^[)/,.;:-]/.test(value)) return false;
  return true;
}

function loadRichardBlandEvidence(file = DEFAULT_RICHARD_BLAND_REQUIREMENTS) {
  if (!file || !fs.existsSync(file)) return new Map();
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
  const candidates = new Map();
  const walk = (value) => {
    if (Array.isArray(value)) {
      for (const row of value) walk(row);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value.codes)) {
      for (const identity of value.codes) {
        const code = normalizeCode(identity?.code);
        const title = String(identity?.title || '').replace(/\s+/g, ' ').trim();
        if (!code || !plausibleRequirementTitle(title)) continue;
        if (!candidates.has(code)) candidates.set(code, new Set());
        candidates.get(code).add(title);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'codes') walk(child);
    }
  };
  walk(artifact.groups || artifact);

  const evidence = new Map();
  for (const [code, titles] of candidates) {
    const ranked = [...titles].sort((a, b) => a.length - b.length || a.localeCompare(b));
    evidence.set(code, {
      code,
      title: ranked[0],
      title_candidates: ranked,
      source: 'richard_bland_requirement_catalog',
      source_url: artifact.source_url || null,
      captured_at: artifact.captured_at || artifact.extracted_at || null,
    });
  }
  return evidence;
}

async function auditLocalOverrides(client, requisiteRows, masterByCode, log = () => {}) {
  const jobs = [];
  for (const requisite of requisiteRows) {
    const master = masterByCode.get(requisite.code);
    if (
      requisite.source !== 'vccs_master_course_file'
      || !master?.found
      || (!(master.groups || []).length && !master.raw_requisites)
    ) continue;
    for (const supply of master.supply || []) {
      jobs.push({ code: requisite.code, supply, master });
    }
  }
  jobs.sort((a, b) => a.code.localeCompare(b.code) || a.supply.slug.localeCompare(b.supply.slug));
  log(`local override audit: ${jobs.length} college pages across ${new Set(jobs.map((job) => job.code)).size} requisite-bearing courses`);

  const results = await client.mapLimit(jobs, async (job, index) => {
    if ((index + 1) % 100 === 0) log(`  local pages ${index + 1}/${jobs.length}`);
    const parsed = await client.getUrl(job.supply.url, { requestedCode: job.code });
    const sameStructure = parsed.found
      && structureSignature(parsed.groups) === structureSignature(job.master.groups);
    const sameRaw = parsed.found
      && (parsed.raw_requisites || null) === (job.master.raw_requisites || null);
    return { ...job, parsed, sameStructure, sameRaw };
  });

  const byCode = new Map();
  for (const result of results) {
    if (!byCode.has(result.code)) byCode.set(result.code, []);
    byCode.get(result.code).push(result);
  }

  const output = new Map();
  for (const [code, rows] of byCode) {
    const differences = rows.filter((row) => row.parsed.found && (!row.sameStructure || !row.sameRaw));
    const failures = rows.filter((row) => !row.parsed.found);
    output.set(code, {
      checked_pages: rows.length,
      matching_pages: rows.length - differences.length - failures.length,
      differing_pages: differences.length,
      failed_pages: failures.length,
      differences: differences.map((row) => ({
        college_slug: row.supply.slug,
        college_name: row.supply.name,
        source_url: row.supply.url,
        same_structure: row.sameStructure,
        master_raw: row.master.raw_requisites,
        local_raw: row.parsed.raw_requisites,
        local_status: row.parsed.status,
        local_groups: row.parsed.groups,
      })),
      failures: failures.map((row) => ({
        college_slug: row.supply.slug,
        source_url: row.supply.url,
        flags: row.parsed.flags,
      })),
    });
  }
  return output;
}

async function readVirginiaCourses({ uri, dbName }) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  try {
    return await client.db(dbName).collection('va_courses').find({}, {
      projection: {
        _id: 1,
        code: 1,
        title: 1,
        description: 1,
        credits: 1,
        department: 1,
        source_url: 1,
        offered_by: 1,
        course_id: 1,
        course_key: 1,
      },
    }).sort({ code: 1 }).toArray();
  } finally {
    await client.close();
  }
}

async function fetchMasterClosure(
  client,
  initialCodes,
  log = () => {},
  ownerCompleteSupplements = new Map(),
) {
  const masterByCode = new Map();
  const usedSupplements = new Set();
  let pending = sortedUnique(initialCodes.map(normalizeCode));
  let round = 0;
  while (pending.length) {
    round += 1;
    log(`master crawl round ${round}: ${pending.length} courses`);
    const parsed = await client.mapLimit(pending, async (code, index) => {
      if ((index + 1) % 75 === 0) log(`  master pages ${index + 1}/${pending.length}`);
      return client.getCourse(code);
    });
    const resolved = parsed.map((row) => {
      const supplemental = ownerCompleteSupplements.get(row.code);
      if (!supplemental) {
        masterByCode.set(row.code, row);
        return row;
      }
      if (row.found || row.status !== 'missing') {
        throw new Error(
          `${row.code} owner-complete supplement requires a currently missing exact VCCS master record`,
        );
      }
      const overlaid = {
        ...supplemental,
        current_vccs_master_evidence: {
          source_url: row.source_url,
          status: row.status,
          flags: row.flags || [],
        },
      };
      masterByCode.set(row.code, overlaid);
      usedSupplements.add(row.code);
      return overlaid;
    });

    const next = new Set();
    for (const row of resolved) {
      for (const group of row.groups || []) {
        for (const pathRow of group.paths || []) {
          for (const condition of pathRow.all_of || []) {
            if (condition.type !== 'course') continue;
            if (!masterByCode.has(condition.code)) next.add(condition.code);
          }
        }
      }
    }
    pending = [...next].sort();
    if (masterByCode.size > 1000) throw new Error('prerequisite closure exceeded 1,000 courses');
  }
  const unusedSupplements = [...ownerCompleteSupplements.keys()]
    .filter((code) => !usedSupplements.has(code))
    .sort();
  if (unusedSupplements.length) {
    throw new Error(
      `owner-complete evidence is outside the canonical fixed-point closure: ${unusedSupplements.join(', ')}`,
    );
  }
  return masterByCode;
}

function prepareCorpus(vaCourses, scope = [], richardBlandEvidence = new Map()) {
  const rows = vaCourses.map((course) => ({
    ...course,
    code: normalizeCode(course.code),
  }));
  const transferByCode = new Map(rows.map((course) => [course.code, course]));
  const scoped = scope.map((scopeRow) => {
    const code = normalizeCode(scopeRow.code);
    const scopeColleges = sortedUnique(scopeRow.colleges || []);
    const scopeKeys = new Set(scopeColleges.map(institutionKey));
    const transfer = transferByCode.get(code) || null;
    const transferOverlap = transfer
      ? sortedUnique((transfer.offered_by || []).filter((name) => scopeKeys.has(institutionKey(name))))
      : [];
    const transferRecordStatus = !transfer
      ? 'missing'
      : transferOverlap.length ? 'scope_college_overlap' : 'no_scope_college_overlap';
    const transferHasAnyCommunityCollege = !!transfer
      && (transfer.offered_by || []).some((name) => isVccsCollege(name) || isRichardBland(name));
    const richardBlandScope = scopeColleges.length > 0 && scopeColleges.every(isRichardBland);
    const includesRichardBland = scopeColleges.some(isRichardBland);
    const localRequirementEvidence = includesRichardBland
      ? richardBlandEvidence.get(code) || null
      : null;
    // A Transfer Virginia row can corroborate VCCS identity.  Richard Bland is
    // a separate namespace, so even an overlapping record is not the primary
    // identity source for an RBC-only requirement.
    const titleTrusted = transferRecordStatus === 'scope_college_overlap' && !richardBlandScope;
    const scopedTitle = richardBlandScope
      ? localRequirementEvidence?.title || null
      : titleTrusted ? transfer.title || null : null;
    return {
      code,
      scope_colleges: scopeColleges,
      scope_source: 'cs_course_scope',
      vccs_colleges: scopeColleges.filter(isVccsCollege),
      richard_bland: includesRichardBland,
      supply_kind: richardBlandScope ? 'richard_bland_scope' : 'vccs_requirement_scope',
      transfer_record_status: transferRecordStatus,
      legacy_review_population: !transfer || !transferHasAnyCommunityCollege,
      transfer_scope_overlap: transferOverlap,
      local_requirement_evidence: localRequirementEvidence,
      transfer_record: transfer ? {
        _id: transfer._id,
        source_url: transfer.source_url || null,
        title: transfer.title || null,
        description: transfer.description || null,
        offered_by: transfer.offered_by || [],
        used_as_title_evidence: titleTrusted,
      } : null,
      title: scopedTitle,
      description: richardBlandScope ? null : titleTrusted ? transfer.description || null : null,
      credits: richardBlandScope ? null : titleTrusted ? transfer.credits ?? null : null,
      source_url: richardBlandScope
        ? localRequirementEvidence?.source_url || null
        : titleTrusted ? transfer.source_url || null : null,
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
  return {
    rows,
    transferByCode,
    scoped,
    scopeWithTransferRecord: scoped.filter((course) => course.transfer_record),
    scopeWithoutTransferRecord: scoped.filter((course) => !course.transfer_record),
    scopeWithTrustedTransferOverlap: scoped.filter((course) => course.transfer_record?.used_as_title_evidence),
    scopeWithUntrustedTransferCollision: scoped.filter((course) => course.transfer_record_status === 'no_scope_college_overlap'),
    richardBlandScope: scoped.filter((course) => course.supply_kind === 'richard_bland_scope'),
    legacyReviewPopulation: scoped.filter((course) => course.legacy_review_population),
  };
}

function buildArtifacts({ scope, corpus, masterByCode, allowedConcepts, overrideAudits = new Map() }) {
  const byCode = corpus.transferByCode || new Map(corpus.rows.map((course) => [course.code, course]));
  const directlyIncluded = corpus.scoped.map((course) => {
    const rawMaster = masterByCode.get(course.code);
    const localTitle = course.local_requirement_evidence?.title || null;
    const masterTitle = rawMaster?.found ? rawMaster.title || null : null;
    const mixedScope = !!course.richard_bland && course.supply_kind !== 'richard_bland_scope';
    const sameIdentity = localTitle && masterTitle
      ? localTitle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        === masterTitle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      : true;
    return {
      ...course,
      vccs_master_not_applicable: course.supply_kind === 'richard_bland_scope' && !!rawMaster?.found,
      mixed_scope_identity_collision: mixedScope && !!localTitle && !!masterTitle && !sameIdentity,
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
  const directByCode = new Map(directlyIncluded.map((course) => [course.code, course]));
  const directCodes = new Set(directlyIncluded.map((course) => course.code));
  if (directCodes.size !== scope.length) throw new Error(`scope contains duplicate/invalid codes: ${scope.length} rows, ${directCodes.size} codes`);

  // Keep closure only when it is reachable through an applicable VCCS rule.
  // Same-code master pages for RBC-only identities are audit evidence, not
  // prerequisite authority, and therefore cannot seed recursive VCCS edges.
  const relevantMasterCodes = new Set(directCodes);
  const visitedClosure = new Set();
  const closurePending = directlyIncluded
    .filter((course) => course.supply_kind !== 'richard_bland_scope')
    .map((course) => course.code);
  while (closurePending.length) {
    const code = closurePending.shift();
    if (visitedClosure.has(code)) continue;
    visitedClosure.add(code);
    const master = masterByCode.get(code);
    if (!master?.found) continue;
    for (const group of master.groups || []) {
      for (const formulaPath of group.paths || []) {
        for (const condition of formulaPath.all_of || []) {
          if (condition.type !== 'course') continue;
          relevantMasterCodes.add(condition.code);
          if (directByCode.get(condition.code)?.supply_kind !== 'richard_bland_scope') {
            closurePending.push(condition.code);
          }
        }
      }
    }
  }

  const classificationByCode = new Map();
  for (const course of directlyIncluded) {
    const master = course.supply_kind === 'richard_bland_scope'
      ? null
      : masterByCode.get(course.code);
    classificationByCode.set(course.code, classifyCourse(course, master));
  }
  for (const [code, master] of masterByCode) {
    if (!relevantMasterCodes.has(code) || !master.found || classificationByCode.has(code)) continue;
    classificationByCode.set(code, classifyCourse({
      code,
      title: master.title,
      description: master.description,
      supply_kind: 'prerequisite_only',
    }, master));
  }

  for (const [code, classification] of classificationByCode) {
    if (classification.concept && !allowedConcepts.has(classification.concept)) {
      throw new Error(`${code} maps to unknown concept ${classification.concept}`);
    }
  }

  const conceptCourses = [
    ...directlyIncluded,
    ...[...relevantMasterCodes]
      .filter((code) => !directCodes.has(code))
      .map((code) => {
        const master = masterByCode.get(code);
        return ({
        ...(byCode.get(code) || {}),
        code,
        title: master?.found ? master.title : null,
        description: master?.found ? master.description : null,
        credits: master?.found ? master.credits : null,
        source_url: master?.source_url || `https://courses.vccs.edu/courses/${code}`,
        supply_kind: 'prerequisite_only',
        scope_colleges: [],
        scope_source: 'recursive_prerequisite_closure',
        transfer_record_status: byCode.has(code) ? 'closure_record_not_used' : 'missing',
        vccs_colleges: master?.found ? master.supply.map((row) => row.name) : [],
      });
      }),
  ].sort((a, b) => a.code.localeCompare(b.code));

  const conceptRows = conceptCourses.map((course) => {
    const rawMaster = masterByCode.get(course.code);
    const master = course.supply_kind === 'richard_bland_scope' ? null : rawMaster;
    const classification = classificationByCode.get(course.code)
      || classifyCourse(course, master);
    const title = master?.found ? master.title : course.title;
    const source = course.supply_kind === 'richard_bland_scope'
      ? course.local_requirement_evidence ? 'richard_bland_requirement_catalog' : 'requirement_scope_only'
      : master?.found
      ? master.source || 'vccs_master_course_file'
      : course.transfer_record_status === 'scope_college_overlap'
        ? 'transferva_scope_overlap'
        : 'requirement_scope_only';
    const institutionOverrides = course.richard_bland
      && course.supply_kind !== 'richard_bland_scope'
      && course.local_requirement_evidence?.title
      ? [{
        institution: 'Richard Bland College',
        title: course.local_requirement_evidence.title,
        source: 'richard_bland_requirement_catalog',
        source_url: course.local_requirement_evidence.source_url,
        concept: RICHARD_BLAND_CONCEPT_OVERRIDES.get(course.code) || null,
      }]
      : [];
    return {
      _id: `va:concept:${course.code}`,
      course_id: courseIdFor(course.code),
      course_key: `va:${course.code}`,
      course_ref: `va:crs:${course.code}`,
      code: course.code,
      title_seen: title || null,
      concept: classification.concept,
      concept_confidence: classification.confidence,
      concept_source: course.supply_kind === 'richard_bland_scope'
        ? `richard_bland_catalog:${classification.classification_method}`
        : master?.found
        ? `${master.source === 'official_owner_catalog_course_entry'
          ? 'official_owner_catalog' : 'vccs_master'}:${classification.classification_method}`
        : course.transfer_record_status === 'scope_college_overlap'
          ? `transferva_scope_overlap:${classification.classification_method}`
          : `scope_only:${classification.classification_method}`,
      concept_note: classification.rationale,
      classification_method: classification.classification_method,
      review_status: classification.review_status,
      scope_role: course.supply_kind === 'prerequisite_only' ? 'prerequisite_only' : 'major_preparation',
      scope_colleges: course.scope_colleges || [],
      scope_source: course.scope_source || 'recursive_prerequisite_closure',
      supply_kind: course.supply_kind,
      source,
      source_url: course.supply_kind === 'richard_bland_scope'
        ? course.local_requirement_evidence?.source_url || null
        : master?.found
        ? master.source_url
        : course.source_url || `https://courses.vccs.edu/courses/${course.code}`,
      transfer_evidence: course.transfer_record ? {
        status: course.transfer_record_status,
        scope_college_overlap: course.transfer_scope_overlap || [],
        source_url: course.transfer_record.source_url,
        title_seen: course.transfer_record.title,
        used_as_title_evidence: course.transfer_record.used_as_title_evidence,
      } : {
        status: course.transfer_record_status || 'missing',
        scope_college_overlap: [],
        source_url: null,
        title_seen: null,
        used_as_title_evidence: false,
      },
      description_seen: master?.found ? master.description : course.description || null,
      ...(institutionOverrides.length ? { institution_overrides: institutionOverrides } : {}),
      ...(course.vccs_master_not_applicable ? {
        vccs_master_evidence: {
          applicable: false,
          source_url: rawMaster.source_url,
          title_seen: rawMaster.title || null,
          reason: 'Richard Bland College uses an institution-local course namespace.',
        },
      } : {}),
      ...(classification.candidate_concept ? { candidate_concept: classification.candidate_concept } : {}),
      flags: sortedUnique(classification.flags),
    };
  });

  const requisiteCodes = sortedUnique([
    ...directCodes,
    ...relevantMasterCodes,
  ]);
  const requisiteRows = requisiteCodes.map((code) => {
    const directCourse = directByCode.get(code) || null;
    const transferCourse = byCode.get(code) || null;
    const rawMaster = masterByCode.get(code);
    const richardBlandScope = directCourse?.supply_kind === 'richard_bland_scope';
    const master = richardBlandScope ? null : rawMaster;
    const found = !!master?.found;
    const unsafeParserFlags = new Set([
      'unparsed_clause',
      'unparsed_residue',
      'and_or_language',
      'unsupported_boolean_grammar',
      'unsupported_semicolon_grammar',
      'incomplete_master_record_boundary',
      'requisite_label_outside_endtext_boundary',
    ]);
    const flags = (master?.flags || []).filter((flag) => unsafeParserFlags.has(flag));
    if (!found && !richardBlandScope) flags.push('no_master_course', 'needs_review');
    if (directCourse && !found) flags.push('legacy_or_unresolved');
    if (richardBlandScope) {
      flags.push(
        'richard_bland_scope',
        'institution_local',
        'non_vccs',
        'local_requisite_source_missing',
        'needs_review'
      );
      if (rawMaster?.found) flags.push('vccs_master_not_applicable');
    }
    if (directCourse?.mixed_scope_identity_collision) {
      flags.push('mixed_scope_identity_collision', 'needs_review');
    }
    if (directCourse?.transfer_record_status === 'no_scope_college_overlap') {
      flags.push('transfer_record_scope_collision');
      if (!found) flags.push('untrusted_transfer_record_ignored');
      if (!found && !directCourse.title) flags.push('unresolved_title');
    }
    if (directCourse?.transfer_record_status === 'missing' && !found) {
      flags.push('missing_transfer_record');
      if (!directCourse.title) flags.push('unresolved_title');
    }
    if (master?.status === 'unparsed') flags.push('needs_review');
    const audit = overrideAudits.get(code);
    if (audit?.differing_pages) flags.push('local_override_detected', 'needs_review');
    if (audit?.failed_pages) flags.push('local_override_audit_incomplete');
    const institutionOverrides = directCourse?.richard_bland
      && !richardBlandScope
      && directCourse.local_requirement_evidence?.title
      ? [{
        institution: 'Richard Bland College',
        title: directCourse.local_requirement_evidence.title,
        source: 'richard_bland_requirement_catalog',
        source_url: directCourse.local_requirement_evidence.source_url,
        concept: RICHARD_BLAND_CONCEPT_OVERRIDES.get(code) || null,
      }]
      : [];

    return {
      _id: `va:req:${code}`,
      course_id: courseIdFor(code),
      course_key: `va:${code}`,
      course_ref: `va:crs:${code}`,
      code,
      title: master?.title || directCourse?.title || null,
      status: found ? master.status : 'missing',
      scope_role: directCodes.has(code) ? 'major_preparation' : 'prerequisite_only',
      scope_colleges: directCourse?.scope_colleges || [],
      scope_source: directCourse?.scope_source || 'recursive_prerequisite_closure',
      supply_kind: directCourse?.supply_kind || 'prerequisite_only',
      source: richardBlandScope
        ? directCourse.local_requirement_evidence ? 'richard_bland_requirement_catalog' : 'requirement_scope_only'
        : found
        ? master.source || 'vccs_master_course_file'
        : directCourse?.transfer_record_status === 'scope_college_overlap'
          ? 'transferva_scope_overlap'
          : 'requirement_scope_only',
      source_url: richardBlandScope
        ? directCourse.local_requirement_evidence?.source_url || null
        : master?.source_url || `https://courses.vccs.edu/courses/${code}`,
      transfer_evidence: directCourse?.transfer_record ? {
        status: directCourse.transfer_record_status,
        scope_college_overlap: directCourse.transfer_scope_overlap,
        source_url: directCourse.transfer_record.source_url,
        title_seen: directCourse.transfer_record.title,
        used_as_title_evidence: directCourse.transfer_record.used_as_title_evidence,
      } : {
        status: directCourse?.transfer_record_status || (transferCourse ? 'closure_record_not_used' : 'missing'),
        scope_college_overlap: [],
        source_url: transferCourse?.source_url || null,
        title_seen: transferCourse?.title || null,
        used_as_title_evidence: false,
      },
      effective: master?.effective || null,
      credits: master?.credits ?? directCourse?.credits ?? null,
      raw_requisites: master?.raw_requisites || null,
      raw_course_endtext: master?.raw_course_endtext || null,
      groups: master?.groups || [],
      vccs_colleges: directCourse?.vccs_colleges || master?.supply?.map((row) => row.name) || [],
      ...(master?.source_evidence ? {
        source_evidence: master.source_evidence,
        source_content_sha256: master.source_content_sha256,
        explicit_none_evidence: master.explicit_none_evidence,
        authority_scope: master.authority_scope,
        owner_coverage: master.owner_coverage,
        required_by: master.required_by,
        required_by_owner_coverage: master.required_by_owner_coverage,
        catalog_year: master.catalog_year,
        current_vccs_master_evidence: master.current_vccs_master_evidence,
      } : {}),
      ...(institutionOverrides.length ? { institution_overrides: institutionOverrides } : {}),
      ...(richardBlandScope && rawMaster?.found ? {
        vccs_master_evidence: {
          applicable: false,
          source_url: rawMaster.source_url,
          title_seen: rawMaster.title || null,
          status_seen: rawMaster.status,
          raw_requisites_seen: rawMaster.raw_requisites || null,
          reason: 'Richard Bland College uses an institution-local course namespace.',
        },
      } : {}),
      ...(audit ? { local_override_audit: audit } : {}),
      flags: sortedUnique(flags),
    };
  });

  const scopeCodes = new Set(scope.map((row) => normalizeCode(row.code)));
  const applicableDirectRows = directlyIncluded.filter((course) => course.supply_kind !== 'richard_bland_scope');
  const masterMissingApplicable = applicableDirectRows
    .filter((course) => {
      const evidence = masterByCode.get(course.code);
      return !evidence?.found || evidence.source === 'official_owner_catalog_course_entry';
    })
    .map((course) => course.code)
    .sort();
  const ownerCatalogResolved = applicableDirectRows
    .filter((course) => (
      masterByCode.get(course.code)?.source === 'official_owner_catalog_course_entry'
    ))
    .map((course) => course.code)
    .sort();
  const ownerCatalogResolvedClosure = requisiteRows
    .filter((row) => (
      row.scope_role === 'prerequisite_only'
      && row.source === 'official_owner_catalog_course_entry'
    ))
    .map((row) => row.code)
    .sort();
  const unresolvedApplicable = applicableDirectRows
    .filter((course) => !masterByCode.get(course.code)?.found)
    .map((course) => course.code)
    .sort();
  const masterFoundApplicable = applicableDirectRows.length - masterMissingApplicable.length;
  const masterNotApplicable = directlyIncluded
    .filter((course) => course.vccs_master_not_applicable)
    .map((course) => course.code)
    .sort();
  const mixedIdentityCollisions = directlyIncluded
    .filter((course) => course.mixed_scope_identity_collision)
    .map((course) => course.code)
    .sort();
  const mapped = conceptRows.filter((row) => row.concept).length;
  const candidates = conceptRows.filter((row) => row.candidate_concept);
  const legacyReviewCodes = new Set(corpus.legacyReviewPopulation.map((course) => course.code));
  const legacyReviewRows = conceptRows.filter((row) => (
    row.scope_role === 'major_preparation' && legacyReviewCodes.has(row.code)
  ));
  const legacyMappedRows = legacyReviewRows.filter((row) => row.concept);
  const legacyExaminedNullRows = legacyReviewRows.filter((row) => !row.concept);
  if (legacyReviewRows.length !== legacyReviewCodes.size) {
    throw new Error(`legacy review coverage mismatch: ${legacyReviewCodes.size} codes, ${legacyReviewRows.length} rows`);
  }
  if (legacyExaminedNullRows.some((row) => (
    row.classification_method !== 'legacy_examined_null'
    && !['vccs_master_course_file', 'official_owner_catalog_course_entry'].includes(row.source)
  ))) {
    throw new Error('legacy review contains an implicit/unexamined null classification');
  }
  const localPages = [...overrideAudits.values()].reduce((sum, audit) => sum + audit.checked_pages, 0);
  const localDifferences = [...overrideAudits.values()].reduce((sum, audit) => sum + audit.differing_pages, 0);
  const localFailures = [...overrideAudits.values()].reduce((sum, audit) => sum + audit.failed_pages, 0);
  const formulaReviewQueue = requisiteRows
    .filter((row) => row.status === 'unparsed')
    .map((row) => ({
      code: row.code,
      source_url: row.source_url,
      raw_requisites: row.raw_requisites,
      flags: row.flags,
    }));

  const commonMeta = {
    state: 'VA',
    major: 'cs',
    authored: '2026-08-02',
    generator: 'server/scripts/buildVirginiaPrerequisites.js',
    vocabulary: 'scripts/data/prereq_concepts.json',
    source_scope: 'server/.va-degrees/cs_course_scope.json; every listed course is retained as direct major preparation',
    transfer_corpus_role: 'va_courses supplies corroborating VCCS title/description evidence only when offered_by overlaps a college that named the code in cs_course_scope. Richard Bland identities come from its requirement catalog; same-code records without applicable overlap are retained for audit but never used as identity evidence.',
    source_authority: 'VCCS Master Course File, plus exact official owner-complete college entries where the current master record is absent',
    source_warning: 'The Master Course File is the statewide minimum. An owner catalog formula is used only when every canonical requirement-scope owner is covered; omission never establishes no prerequisites.',
    counts: {
      scope_codes: scope.length,
      live_va_courses: corpus.rows.length,
      scope_with_transfer_record: corpus.scopeWithTransferRecord.length,
      scope_with_trusted_transfer_overlap: corpus.scopeWithTrustedTransferOverlap.length,
      scope_with_untrusted_transfer_collision: corpus.scopeWithUntrustedTransferCollision.length,
      scope_without_transfer_record: corpus.scopeWithoutTransferRecord.length,
      richard_bland_scope: corpus.richardBlandScope.length,
      legacy_review_population: legacyReviewRows.length,
      master_applicable_direct: applicableDirectRows.length,
      master_found_applicable_direct: masterFoundApplicable,
      master_missing_applicable_direct: masterMissingApplicable.length,
      owner_catalog_resolved_applicable_direct: ownerCatalogResolved.length,
      owner_catalog_resolved_prerequisite_closure: ownerCatalogResolvedClosure.length,
      unresolved_prerequisite_source_direct: unresolvedApplicable.length,
      vccs_master_not_applicable_direct: masterNotApplicable.length,
      local_requisite_source_missing_direct: corpus.richardBlandScope.length,
      mixed_scope_identity_collision: mixedIdentityCollisions.length,
      closure_codes: requisiteRows.filter((row) => row.scope_role === 'prerequisite_only').length,
    },
    coverage_issues: {
      master_missing_applicable_direct: masterMissingApplicable,
      owner_catalog_resolved_applicable_direct: ownerCatalogResolved,
      owner_catalog_resolved_prerequisite_closure: ownerCatalogResolvedClosure,
      unresolved_prerequisite_source_direct: unresolvedApplicable,
      vccs_master_not_applicable_direct: masterNotApplicable,
      local_requisite_source_missing_direct: corpus.richardBlandScope.map((course) => course.code),
      mixed_scope_identity_collision: mixedIdentityCollisions,
      transfer_record_no_scope_college_overlap: corpus.scopeWithUntrustedTransferCollision.map((course) => course.code),
      transfer_record_missing: corpus.scopeWithoutTransferRecord.map((course) => course.code),
      richard_bland_scope: corpus.richardBlandScope.map((course) => course.code),
    },
    legacy_scope_review: {
      population: legacyReviewRows.length,
      mapped: legacyMappedRows.length,
      examined_null: legacyExaminedNullRows.length,
      mapped_codes: legacyMappedRows.map((row) => row.code),
      examined_null_codes: legacyExaminedNullRows.map((row) => row.code),
      ambiguous_partial_codes: legacyExaminedNullRows
        .filter((row) => row.flags.includes('ambiguous_partial_legacy'))
        .map((row) => row.code),
    },
  };

  return {
    concepts: {
      meta: {
        ...commonMeta,
        purpose: 'One concept-review row for every course named by a Virginia CS requirement, plus prerequisite-only closure courses. Missing/legacy courses remain visible rather than being filtered by Transfer Virginia supply.',
        totals: {
          rows: conceptRows.length,
          direct_rows: conceptRows.filter((row) => row.scope_role === 'major_preparation').length,
          mapped,
          examined_null: conceptRows.length - mapped,
          candidate_new_concept: candidates.length,
          needs_review: conceptRows.filter((row) => row.review_status === 'needs_review').length,
          unresolved_title: conceptRows.filter((row) => row.flags.includes('unresolved_title')).length,
          legacy_mapped: legacyMappedRows.length,
          legacy_examined_null: legacyExaminedNullRows.length,
        },
        candidate_concepts: candidates.map((row) => ({
          code: row.code,
          title: row.title_seen,
          candidate: row.candidate_concept,
          rationale: row.concept_note,
        })),
      },
      rows: conceptRows,
    },
    requisites: {
      meta: {
        ...commonMeta,
        purpose: 'Lossless statewide prerequisite/corequisite clauses for Virginia CS-scope courses and their recursive prerequisite closure.',
        formula: 'Within each group, paths are OR; within each path, all_of conditions are AND. Multiple groups are simultaneously required.',
        totals: {
          rows: requisiteRows.length,
          parsed: requisiteRows.filter((row) => row.status === 'parsed').length,
          none: requisiteRows.filter((row) => row.status === 'none').length,
          missing: requisiteRows.filter((row) => row.status === 'missing').length,
          unparsed: requisiteRows.filter((row) => row.status === 'unparsed').length,
          flagged: requisiteRows.filter((row) => row.flags.length).length,
        },
        local_override_audit: {
          requisite_bearing_courses: overrideAudits.size,
          checked_pages: localPages,
          differing_pages: localDifferences,
          failed_pages: localFailures,
        },
        formula_review_queue: formulaReviewQueue,
      },
      rows: requisiteRows,
    },
    classificationByCode,
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
}

function artifactDriftIssues(artifacts, {
  courseOutput = DEFAULT_COURSE_OUTPUT,
  requisiteOutput = DEFAULT_REQUISITE_OUTPUT,
} = {}) {
  return [
    [courseOutput, artifacts?.concepts],
    [requisiteOutput, artifacts?.requisites],
  ].flatMap(([file, artifact]) => {
    if (!fs.existsSync(file)) return [`missing checked-in artifact ${file}`];
    const expected = `${JSON.stringify(artifact, null, 1)}\n`;
    return fs.readFileSync(file, 'utf8') === expected
      ? [] : [`checked-in artifact drift ${file}`];
  });
}

async function run(opts = optionsFrom()) {
  const log = (...args) => console.log('[va:prereqs]', ...args);
  if (!fs.existsSync(opts.scopeFile)) throw new Error(`missing scope file ${opts.scopeFile}`);
  if (!fs.existsSync(opts.richardBlandRequirementsFile)) {
    throw new Error(`missing Richard Bland requirement evidence ${opts.richardBlandRequirementsFile}`);
  }
  const scope = JSON.parse(fs.readFileSync(opts.scopeFile, 'utf8'));
  const richardBlandEvidence = loadRichardBlandEvidence(opts.richardBlandRequirementsFile);
  const southwestPrerequisiteEvidence = loadSouthwestVccsPrerequisiteEvidence({
    evidenceFile: opts.southwestPrerequisiteEvidenceFile,
    scopeRows: scope,
  });
  const laurelRidgePrerequisiteEvidence = loadLaurelRidgeVccsPrerequisiteEvidence({
    evidenceFile: opts.laurelRidgePrerequisiteEvidenceFile,
    scopeRows: scope,
    cacheDir: opts.cacheDir,
  });
  const ownerCompleteSupplements = new Map([
    ...southwestPrerequisiteEvidence.accepted,
    ...laurelRidgePrerequisiteEvidence.accepted,
  ]);
  if (ownerCompleteSupplements.size !== southwestPrerequisiteEvidence.accepted.size
      + laurelRidgePrerequisiteEvidence.accepted.size) {
    throw new Error('duplicate owner-complete prerequisite evidence code');
  }
  const allowedConcepts = new Set(
    JSON.parse(fs.readFileSync(opts.conceptsFile, 'utf8')).concepts.map((concept) => concept.slug)
  );
  log(`reading va_courses from ${opts.uri.replace(/\/\/[^@]*@/, '//<redacted>@')} · db ${opts.dbName}`);
  const vaCourses = await readVirginiaCourses(opts);
  const corpus = prepareCorpus(vaCourses, scope, richardBlandEvidence);
  log(`${scope.length} direct scope codes · ${corpus.rows.length} Transfer Virginia records · ${corpus.scopeWithTrustedTransferOverlap.length} scope-overlapping · ${corpus.scopeWithUntrustedTransferCollision.length} same-code collisions · ${corpus.scopeWithoutTransferRecord.length} missing records`);

  const client = new VccsCourseClient({
    cacheDir: opts.cacheDir,
    delayMs: opts.delayMs,
    concurrency: opts.concurrency,
    refresh: opts.refresh,
  });
  const fetchedMasterByCode = await fetchMasterClosure(
    client,
    corpus.scoped.map((course) => course.code),
    log,
    ownerCompleteSupplements,
  );
  const masterByCode = fetchedMasterByCode;
  const archivedSilentRecords = southwestPrerequisiteEvidence.report.unresolved_no_explicit_none
    + laurelRidgePrerequisiteEvidence.report.unresolved_no_explicit_none;
  log(`owner-complete evidence: ${ownerCompleteSupplements.size} accepted exact records · ${archivedSilentRecords} archived silent ${archivedSilentRecords === 1 ? 'record' : 'records'} retained as nonauthoritative`);

  // First pass identifies the exact set whose prerequisite graph is material.
  const preliminary = buildArtifacts({ scope, corpus, masterByCode, allowedConcepts });
  let overrideAudits = new Map();
  if (opts.localAudit) {
    overrideAudits = await auditLocalOverrides(
      client,
      preliminary.requisites.rows,
      masterByCode,
      log
    );
  }
  const artifacts = buildArtifacts({ scope, corpus, masterByCode, allowedConcepts, overrideAudits });
  const c = artifacts.concepts.meta.totals;
  const r = artifacts.requisites.meta.totals;
  log(`concepts: ${c.rows} rows · ${c.mapped} mapped · ${c.examined_null} examined-null · ${c.candidate_new_concept} candidate concepts · ${c.needs_review} review`);
  log(`requisites: ${r.rows} rows · ${r.parsed} parsed · ${r.none} none · ${r.missing} missing · ${r.unparsed} unparsed`);
  log(`local audit: ${artifacts.requisites.meta.local_override_audit.checked_pages} pages · ${artifacts.requisites.meta.local_override_audit.differing_pages} differences · ${artifacts.requisites.meta.local_override_audit.failed_pages} failures`);
  log(`HTTP: ${client.stats.hits} cached · ${client.stats.misses} fetched · ${client.stats.errors} errors`);

  if (opts.check) {
    if (opts.write) throw new Error('--check and --write are mutually exclusive');
    const drift = artifactDriftIssues(artifacts, opts);
    if (drift.length) throw new Error(drift.join('; '));
    log('checked-in concept and prerequisite artifacts match byte-for-byte');
    return artifacts;
  }
  if (!opts.write) {
    log('report only — pass --write to replace the two local JSON artifacts');
    return artifacts;
  }
  writeJson(opts.courseOutput, artifacts.concepts);
  writeJson(opts.requisiteOutput, artifacts.requisites);
  log(`wrote ${opts.courseOutput}`);
  log(`wrote ${opts.requisiteOutput}`);
  return artifacts;
}

module.exports = {
  EXACT_CONCEPTS,
  CONCEPT_CANDIDATES,
  LEGACY_CONCEPTS,
  LEGACY_AMBIGUOUS,
  RICHARD_BLAND_CONCEPT_OVERRIDES,
  courseIdFor,
  classifyCourse,
  structureSignature,
  loadRichardBlandEvidence,
  prepareCorpus,
  buildArtifacts,
  artifactDriftIssues,
  fetchMasterClosure,
  auditLocalOverrides,
  optionsFrom,
  run,
};

if (require.main === module) {
  run().catch((error) => {
    console.error('[va:prereqs] FATAL', error.stack || error.message);
    process.exit(1);
  });
}
