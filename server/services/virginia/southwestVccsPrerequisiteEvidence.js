const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  parseRequisiteClause,
} = require('./vccsCourse');
const {
  loadAndValidateCapture,
} = require('./southwestCourseLeafCapture');

const SERVER = path.resolve(__dirname, '..', '..');
const DEFAULT_EVIDENCE = path.join(
  SERVER,
  '.va-catalogs',
  'research',
  'southwest-vccs-prerequisite-evidence.json',
);
const DEFAULT_SCOPE = path.join(SERVER, '.va-degrees', 'cs_course_scope.json');
const OWNER = 'Southwest Virginia Community College';
const ACCEPTED = 'accepted_exact_owner_complete_formula';
const ACCEPTED_STRUCTURED_NONE = 'accepted_owner_complete_record_no_stated_requisite';
const UNRESOLVED = 'unresolved_no_explicit_none_statement';
const EXPECTED_CODES = Object.freeze(['ENG249', 'ENG268', 'PHI102']);
const UNSAFE_FLAGS = new Set([
  'unparsed_clause',
  'unparsed_residue',
  'and_or_language',
  'unsupported_boolean_grammar',
  'unsupported_semicolon_grammar',
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizedText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function codePattern(code) {
  const match = /^([A-Z]+)(\d+[A-Z]?)$/.exec(code);
  return new RegExp(`\\b${match[1]}\\s*${match[2]}\\b`, 'i');
}

function expectedOwners(scope, code) {
  const row = scope.find((candidate) => normalizeCode(candidate?.code) === code);
  return (row?.colleges || []).filter((college) => /community college$/i.test(college)).sort();
}

function parsedEvidenceRow(row) {
  const label = /^(Prerequisite\(s\)|Prerequisites?|Corequisites?)\s*:\s*/i.exec(
    row.raw_requisites || '',
  );
  if (!label) throw new Error(`${row.code} accepted formula lacks an exact requisite label`);
  const kind = /^core/i.test(label[1]) ? 'corequisite' : 'prerequisite';
  const group = parseRequisiteClause(
    kind,
    row.raw_requisites.slice(label[0].length),
    { sourceLabel: label[1] },
  );
  if (group.flags.some((flag) => UNSAFE_FLAGS.has(flag))) {
    throw new Error(`${row.code} owner formula is not losslessly parseable: ${group.flags.join(', ')}`);
  }
  const signature = group.paths.map((formulaPath) => formulaPath.all_of.map((condition) => (
    condition.code || condition.condition
  )));
  if (JSON.stringify(signature) !== JSON.stringify([['ENG112'], ['consent']])) {
    throw new Error(`${row.code} owner formula drifted from ENG112 OR divisional approval`);
  }
  return {
    found: true,
    code: row.code,
    title: row.title,
    description: null,
    status: 'parsed',
    source: 'official_owner_catalog_course_entry',
    source_url: row.source_url,
    source_content_sha256: row.raw_entry_sha256,
    source_evidence: {
      kind: 'official_course_entry',
      raw_text: row.raw_entry_text,
      content_sha256: row.raw_entry_sha256,
      source_capture: { ...row.source_capture },
    },
    authority_scope: 'owner_complete_for_requirement_scope',
    owner_coverage: [...row.owning_colleges],
    catalog_year: row.catalog_year,
    effective: null,
    credits: row.credits,
    raw_requisites: row.raw_requisites,
    raw_course_endtext: row.raw_requisites,
    groups: [group],
    supply: [{
      slug: 'swcc',
      name: OWNER,
      scheduled: null,
      url: row.source_url,
    }],
    flags: [],
  };
}

function structuredNoneEvidenceRow(row, artifactRows) {
  if (row.raw_requisites != null
      || /\b(?:pre|co)requisites?\s*(?:\(s\))?\s*:/i.test(row.raw_entry_text)) {
    throw new Error(`${row.code} structured-none record contains a requisite marker`);
  }
  const headings = row.raw_entry_text.split(/\r?\n/).filter((line) => (
    /^[A-Z]{2,8}\s+\d+[A-Z]?:\s+/.test(line.trim())
  ));
  const expectedHeading = row.code.replace(/^([A-Z]+)(\d)/, '$1 $2');
  if (headings.length !== 1 || !headings[0].startsWith(`${expectedHeading}: ${row.title}`)
      || !/\b3 credits?\b/i.test(row.raw_entry_text)
      || !/\bLecture\s+3\s+hours?\s+per\s+week\b/i.test(row.raw_entry_text)) {
    throw new Error(`${row.code} is not one complete, exact CourseLeaf course record`);
  }
  const rowUrl = new URL(row.source_url);
  const control = artifactRows.find((candidate) => {
    if (candidate.disposition !== ACCEPTED || !candidate.raw_requisites) return false;
    const candidateUrl = new URL(candidate.source_url);
    return candidate.catalog_year === row.catalog_year
      && candidateUrl.searchParams.get('catoid') === rowUrl.searchParams.get('catoid');
  });
  if (!control
      || !/^(?:Prerequisite\(s\)|Prerequisites?|Corequisites?)\s*:/i.test(control.raw_requisites)
      || !normalizedText(control.raw_entry_text).includes(normalizedText(control.raw_requisites))) {
    throw new Error(`${row.code} lacks a same-catalog CourseLeaf requisite-marker control`);
  }
  return {
    found: true,
    code: row.code,
    title: row.title,
    description: null,
    status: 'none',
    source: 'official_owner_catalog_course_entry',
    source_url: row.source_url,
    source_content_sha256: row.raw_entry_sha256,
    source_evidence: {
      kind: 'official_course_entry',
      raw_text: row.raw_entry_text,
      content_sha256: row.raw_entry_sha256,
      record_boundary: 'single CourseLeaf preview_course_nopop course record',
      parser_contract: 'southwest-courseleaf-single-course-record-v1',
      source_capture: { ...row.source_capture },
    },
    explicit_none_evidence: {
      kind: 'structured_owner_catalog_record_boundary',
      course_entry_status: 'published_exact_owner_course_record',
      finding: 'no_prerequisite_or_corequisite_published_in_complete_owner_record',
      literal_none_statement: false,
      source_content_sha256: row.raw_entry_sha256,
      parser_contract: 'southwest-courseleaf-single-course-record-v1',
      record_boundary: 'single CourseLeaf preview_course_nopop course record',
      requisite_clause_count: 0,
      source_response_sha256: row.source_capture.source_response_sha256,
      course_fragment_html_sha256: row.source_capture.course_fragment_html_sha256,
      response_parser_contract: row.source_capture.parser_contract,
      same_catalog_marker_control: {
        code: control.code,
        source_url: control.source_url,
        catalog_year: control.catalog_year,
        raw_entry_sha256: control.raw_entry_sha256,
        raw_requisites: control.raw_requisites,
        source_capture: { ...control.source_capture },
      },
    },
    authority_scope: 'owner_complete_for_requirement_scope',
    owner_coverage: [...row.owning_colleges],
    catalog_year: row.catalog_year,
    effective: null,
    credits: row.credits,
    raw_requisites: null,
    raw_course_endtext: null,
    groups: [],
    supply: [{
      slug: 'swcc',
      name: OWNER,
      scheduled: null,
      url: row.source_url,
    }],
    flags: [],
  };
}

function loadSouthwestVccsPrerequisiteEvidence({
  evidenceFile = DEFAULT_EVIDENCE,
  scopeFile = DEFAULT_SCOPE,
  evidenceArtifact = null,
  scopeRows = null,
} = {}) {
  const artifact = evidenceArtifact || readJson(evidenceFile);
  const scope = scopeRows || readJson(scopeFile);
  if (artifact.schema_version !== 3 || artifact.institution !== OWNER) {
    throw new Error('Southwest prerequisite evidence schema/owner mismatch');
  }
  if (!Array.isArray(artifact.rows)) throw new Error('Southwest prerequisite evidence rows required');
  const codes = artifact.rows.map((row) => normalizeCode(row.code)).sort();
  if (JSON.stringify(codes) !== JSON.stringify(EXPECTED_CODES)) {
    throw new Error(`Southwest prerequisite evidence must cover exactly ${EXPECTED_CODES.join(', ')}`);
  }

  const accepted = new Map();
  const unresolved = [];
  for (const row of artifact.rows) {
    const code = normalizeCode(row.code);
    if (row.code !== code || sha256(row.raw_entry_text || '') !== row.raw_entry_sha256) {
      throw new Error(`${code} retained official entry hash mismatch`);
    }
    loadAndValidateCapture(row);
    let source;
    try {
      source = new URL(row.source_url);
    } catch {
      throw new Error(`${code} official source URL invalid`);
    }
    if (source.protocol !== 'https:' || source.hostname !== 'catalog.sw.edu'
        || source.pathname !== '/preview_course_nopop.php'
        || !source.searchParams.get('catoid') || !source.searchParams.get('coid')) {
      throw new Error(`${code} is not pinned to an exact official Southwest course entry`);
    }
    if (!codePattern(code).test(row.raw_entry_text)
        || !normalizedText(row.raw_entry_text).includes(normalizedText(row.title))) {
      throw new Error(`${code} retained entry does not prove its exact code/title`);
    }
    const owners = expectedOwners(scope, code);
    if (JSON.stringify(owners) !== JSON.stringify([OWNER])
        || JSON.stringify([...row.owning_colleges].sort()) !== JSON.stringify(owners)) {
      throw new Error(`${code} evidence is not complete for its canonical requirement-scope owners`);
    }
    if (row.accepted_explicit_none !== false) {
      throw new Error(`${code} may not infer no prerequisites from an omitted marker`);
    }
    if (row.disposition === ACCEPTED) {
      if (!row.raw_requisites
          || !normalizedText(row.raw_entry_text).includes(normalizedText(row.raw_requisites))) {
        throw new Error(`${code} accepted formula is not verbatim in its retained entry`);
      }
      accepted.set(code, parsedEvidenceRow(row));
    } else if (row.disposition === ACCEPTED_STRUCTURED_NONE) {
      accepted.set(code, structuredNoneEvidenceRow(row, artifact.rows));
    } else if (row.disposition === UNRESOLVED && row.raw_requisites == null) {
      unresolved.push({ ...row });
    } else {
      throw new Error(`${code} has an unsupported evidence disposition`);
    }
  }

  return {
    artifact,
    accepted,
    unresolved,
    report: {
      ready: true,
      exact_owner_entries: artifact.rows.length,
      accepted_exact_formulas: [...accepted.values()].filter((row) => row.status === 'parsed').length,
      structured_none_findings: [...accepted.values()].filter((row) => row.status === 'none').length,
      explicit_none_findings: [...accepted.values()].filter((row) => (
        row.explicit_none_evidence?.literal_none_statement === true
      )).length,
      unresolved_no_explicit_none: unresolved.length,
      accepted_codes: [...accepted.keys()].sort(),
      structured_none_codes: [...accepted.values()].filter((row) => row.status === 'none')
        .map((row) => row.code).sort(),
      unresolved_codes: unresolved.map((row) => row.code).sort(),
    },
  };
}

module.exports = {
  ACCEPTED,
  ACCEPTED_STRUCTURED_NONE,
  DEFAULT_EVIDENCE,
  DEFAULT_SCOPE,
  EXPECTED_CODES,
  OWNER,
  UNRESOLVED,
  loadSouthwestVccsPrerequisiteEvidence,
};

if (require.main === module) {
  console.log(JSON.stringify(loadSouthwestVccsPrerequisiteEvidence().report, null, 2));
}
