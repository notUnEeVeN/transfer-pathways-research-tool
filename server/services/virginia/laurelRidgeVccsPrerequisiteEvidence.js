const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  parseRequisiteClause,
  parseVccsCoursePage,
} = require('./vccsCourse');

const SERVER = path.resolve(__dirname, '..', '..');
const DEFAULT_EVIDENCE = path.join(
  SERVER,
  '.va-catalogs',
  'research',
  'laurel-ridge-vccs-prerequisite-closure-evidence.json',
);
const DEFAULT_SCOPE = path.join(SERVER, '.va-degrees', 'cs_course_scope.json');
const DEFAULT_CACHE = path.join(SERVER, '.va-prerequisites-cache');
const OWNER = 'Laurel Ridge Community College';
const ACCEPTED = 'accepted_exact_owner_complete_formula';
const UNRESOLVED = 'unresolved_no_explicit_none_statement';
const SOURCE_URL = 'https://laurelridge.edu/files/documents/current-students/college-catalog/2019-20/2019-20%20CATALOG.pdf';
const SOURCE_BYTES = 2239158;
const SOURCE_SHA256 = 'eaf380a923383e2c59c41df590ca6d6e6c3306f1d4d8249dc4446e4aaaac9273';
const DEPENDENCY_URL = 'https://courses.vccs.edu/courses/CSC210';
const DEPENDENCY_SHA256 = 'a47fb47fd5fac307358c09f3e1abfe2861c21bded6802c235ef5d41006e32cf0';
const EXPECTED_CODES = Object.freeze(['CSC200', 'CSC201', 'CSC202', 'EGR126']);
const EXPECTED_ROWS = Object.freeze({
  CSC200: Object.freeze({ required_by: ['CSC201'], catalog_page: 158, pdf_page: 168 }),
  CSC201: Object.freeze({ required_by: ['CSC210'], catalog_page: 158, pdf_page: 168 }),
  CSC202: Object.freeze({ required_by: ['CSC210'], catalog_page: 159, pdf_page: 169 }),
  EGR126: Object.freeze({ required_by: ['CSC201'], catalog_page: 165, pdf_page: 175 }),
});
const EXPECTED_FORMULAS = Object.freeze({
  CSC200: [[{ type: 'non_course', condition: 'course_eligibility', code: 'ENG111' }]],
  CSC201: [[{ type: 'course', code: 'CSC200' }], [{ type: 'course', code: 'EGR126' }]],
  CSC202: [[{ type: 'course', code: 'CSC201' }]],
});
const UNSAFE_FLAGS = new Set([
  'unparsed_clause',
  'unparsed_residue',
  'and_or_language',
  'unsupported_boolean_grammar',
  'unsupported_semicolon_grammar',
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sha1 = (value) => createHash('sha1').update(value).digest('hex');
const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizedText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const canonical = (value) => JSON.stringify(value);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function codePattern(code) {
  const match = /^([A-Z]+)(\d+[A-Z]?)$/.exec(code);
  return new RegExp(`\\b${match[1]}\\s*${match[2]}\\b`, 'i');
}

function conditionSignature(condition) {
  return {
    type: condition.type,
    ...(condition.condition ? { condition: condition.condition } : {}),
    ...(condition.code ? { code: condition.code } : {}),
  };
}

function groupSignature(group) {
  return group.paths.map((formulaPath) => formulaPath.all_of.map(conditionSignature));
}

function exactDependencyProof(scope, cacheDir, dependencySourceBody = null) {
  const ownerRows = scope.filter((row) => normalizeCode(row?.code) === 'CSC210');
  if (ownerRows.length !== 1
      || canonical([...(ownerRows[0].colleges || [])].sort()) !== canonical([OWNER])) {
    throw new Error('CSC210 canonical owner scope must be exactly Laurel Ridge Community College');
  }
  const cacheFile = path.join(cacheDir, `${sha1(DEPENDENCY_URL)}.html`);
  const body = dependencySourceBody == null
    ? fs.readFileSync(cacheFile)
    : Buffer.from(dependencySourceBody);
  if (sha256(body) !== DEPENDENCY_SHA256) {
    throw new Error('CSC210 retained official master page hash mismatch');
  }
  const parsed = parseVccsCoursePage(body.toString('utf8'), {
    requestedCode: 'CSC210',
    url: DEPENDENCY_URL,
  });
  const signature = parsed.groups?.map(groupSignature);
  const expected = [[
    [{ type: 'course', code: 'CSC201' }, { type: 'course', code: 'CSC202' }],
    [{ type: 'course', code: 'EGR125' }],
    [{ type: 'non_course', condition: 'consent' }],
  ]];
  if (parsed.status !== 'parsed'
      || parsed.raw_requisites !== 'Prerequisites: CSC 201 and 202, or EGR 125 or permission of instructor.'
      || canonical(signature) !== canonical(expected)) {
    throw new Error('CSC210 retained master formula no longer proves the closure roots');
  }
  return {
    code: 'CSC210',
    source_url: DEPENDENCY_URL,
    source_content_sha256: DEPENDENCY_SHA256,
    owner_coverage: [OWNER],
    prerequisite_codes: ['CSC201', 'CSC202', 'EGR125'],
  };
}

function parsedEvidenceRow(row, document) {
  const label = /^(Prerequisite\(s\)|Prerequisites?)\s*:\s*/i.exec(row.raw_requisites || '');
  if (!label) throw new Error(`${row.code} accepted formula lacks an exact prerequisite label`);
  const group = parseRequisiteClause(
    'prerequisite',
    row.raw_requisites.slice(label[0].length),
    { sourceLabel: label[1] },
  );
  if (group.flags.some((flag) => UNSAFE_FLAGS.has(flag))) {
    throw new Error(`${row.code} owner formula is not losslessly parseable: ${group.flags.join(', ')}`);
  }
  if (canonical(groupSignature(group)) !== canonical(EXPECTED_FORMULAS[row.code])) {
    throw new Error(`${row.code} owner formula drifted from its exact historical expression`);
  }
  return {
    found: true,
    code: row.code,
    title: row.title,
    description: null,
    status: 'parsed',
    source: 'official_owner_catalog_course_entry',
    source_url: document.source_url,
    source_content_sha256: row.raw_entry_sha256,
    source_evidence: {
      kind: 'official_course_entry',
      raw_text: row.raw_entry_text,
      content_sha256: row.raw_entry_sha256,
      document_content_sha256: document.content_sha256,
      catalog_page: row.catalog_page,
      pdf_page: row.pdf_page,
    },
    authority_scope: 'owner_complete_for_canonical_dependency_scope',
    owner_coverage: [...row.owning_colleges],
    required_by: [...row.required_by],
    required_by_owner_coverage: [...row.owning_colleges],
    catalog_year: document.catalog_year,
    effective: null,
    credits: row.credits,
    raw_requisites: row.raw_requisites,
    raw_course_endtext: row.raw_requisites,
    groups: [group],
    supply: [{
      slug: 'laurelridge',
      name: OWNER,
      scheduled: null,
      url: document.source_url,
    }],
    flags: [],
  };
}

function loadLaurelRidgeVccsPrerequisiteEvidence({
  evidenceFile = DEFAULT_EVIDENCE,
  scopeFile = DEFAULT_SCOPE,
  cacheDir = DEFAULT_CACHE,
  evidenceArtifact = null,
  scopeRows = null,
  dependencySourceBody = null,
} = {}) {
  const artifact = evidenceArtifact || readJson(evidenceFile);
  const scope = scopeRows || readJson(scopeFile);
  if (artifact.schema_version !== 1 || artifact.institution !== OWNER) {
    throw new Error('Laurel Ridge prerequisite evidence schema/owner mismatch');
  }
  const document = artifact.source_document || {};
  if (document.catalog_year !== '2019-2020'
      || document.source_url !== SOURCE_URL
      || document.content_bytes !== SOURCE_BYTES
      || document.content_sha256 !== SOURCE_SHA256) {
    throw new Error('Laurel Ridge official archived catalog receipt mismatch');
  }
  if (!Array.isArray(artifact.rows)) throw new Error('Laurel Ridge prerequisite evidence rows required');
  const codes = artifact.rows.map((row) => normalizeCode(row.code)).sort();
  if (canonical(codes) !== canonical(EXPECTED_CODES)) {
    throw new Error(`Laurel Ridge evidence must cover exactly ${EXPECTED_CODES.join(', ')}`);
  }
  const dependencyProof = exactDependencyProof(scope, cacheDir, dependencySourceBody);

  const accepted = new Map();
  const unresolved = [];
  for (const row of artifact.rows) {
    const code = normalizeCode(row.code);
    const expected = EXPECTED_ROWS[code];
    if (row.code !== code || sha256(row.raw_entry_text || '') !== row.raw_entry_sha256) {
      throw new Error(`${code} retained official entry hash mismatch`);
    }
    if (!codePattern(code).test(row.raw_entry_text)
        || !normalizedText(row.raw_entry_text).includes(normalizedText(row.title))) {
      throw new Error(`${code} retained entry does not prove its exact code/title`);
    }
    if (canonical(row.required_by) !== canonical(expected.required_by)
        || row.catalog_page !== expected.catalog_page
        || row.pdf_page !== expected.pdf_page) {
      throw new Error(`${code} canonical dependency/page receipt mismatch`);
    }
    if (canonical([...(row.owning_colleges || [])].sort()) !== canonical([OWNER])) {
      throw new Error(`${code} evidence is not complete for its canonical dependency owner`);
    }
    if (row.accepted_explicit_none !== false) {
      throw new Error(`${code} may not infer no prerequisites from an omitted marker`);
    }
    if (row.disposition === ACCEPTED) {
      if (!row.raw_requisites
          || !normalizedText(row.raw_entry_text).includes(normalizedText(row.raw_requisites))) {
        throw new Error(`${code} accepted formula is not verbatim in its retained entry`);
      }
      accepted.set(code, parsedEvidenceRow(row, document));
    } else if (row.disposition === UNRESOLVED && row.raw_requisites == null) {
      unresolved.push({
        ...row,
        source_url: document.source_url,
        catalog_year: document.catalog_year,
        source_document_sha256: document.content_sha256,
      });
    } else {
      throw new Error(`${code} has an unsupported evidence disposition`);
    }
  }

  // The accepted CSC 201 formula is itself what makes CSC 200 and EGR 126
  // reachable. Keep that second closure step explicit instead of trusting the
  // row metadata alone.
  const csc201Dependencies = accepted.get('CSC201').groups[0].paths
    .flatMap((formulaPath) => formulaPath.all_of)
    .filter((condition) => condition.type === 'course')
    .map((condition) => condition.code)
    .sort();
  if (canonical(csc201Dependencies) !== canonical(['CSC200', 'EGR126'])) {
    throw new Error('CSC201 formula no longer proves the second closure step');
  }

  return {
    artifact,
    accepted,
    unresolved,
    dependencyProof,
    report: {
      ready: true,
      exact_owner_entries: artifact.rows.length,
      accepted_exact_formulas: accepted.size,
      explicit_none_findings: 0,
      unresolved_no_explicit_none: unresolved.length,
      accepted_codes: [...accepted.keys()].sort(),
      unresolved_codes: unresolved.map((row) => row.code).sort(),
      direct_dependency_roots: ['CSC201', 'CSC202'],
      recursive_dependency_courses: ['CSC200', 'EGR126'],
    },
  };
}

module.exports = {
  ACCEPTED,
  DEFAULT_CACHE,
  DEFAULT_EVIDENCE,
  DEFAULT_SCOPE,
  DEPENDENCY_SHA256,
  DEPENDENCY_URL,
  EXPECTED_CODES,
  OWNER,
  SOURCE_BYTES,
  SOURCE_SHA256,
  SOURCE_URL,
  UNRESOLVED,
  loadLaurelRidgeVccsPrerequisiteEvidence,
};

if (require.main === module) {
  console.log(JSON.stringify(loadLaurelRidgeVccsPrerequisiteEvidence().report, null, 2));
}
