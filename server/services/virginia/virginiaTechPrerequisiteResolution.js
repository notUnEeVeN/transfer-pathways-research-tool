const { createHash } = require('node:crypto');

const VIRGINIA_TECH_SLUG = 'virginia-polytechnic-institute-and-state-university';
const VIRGINIA_TECH_SCHOOL_ID = 9230;
const VIRGINIA_TECH_OWNER_NAMESPACE = 'va:uni:9230';
const VIRGINIA_TECH_CATALOG_YEAR = '2026-2027';
const FORMULA = 'paths_or__conditions_and';

const COURSELEAF_BOUNDARY_CONTRACT =
  'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT_CONTRACT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';
const COURSELEAF_FIELD_RECEIPT_CONTRACT =
  'courseleaf_exact_structured_requisite_field_offsets_and_html_hash_v1';

const RESOLVED_CODES = Object.freeze([
  'BIOL1115',
  'BIOL1116',
  'CS3604',
  'MATH1225',
  'MATH2534',
]);

const CONDITIONAL_APPLICABILITY_BLOCKED_CODES = Object.freeze([
  'ENGE4735',
  'ENGE4736',
]);

const AMBIGUOUS_CODES = Object.freeze([
  'CS4664',
  'MATH3414',
  'MATH4445',
]);

const BLOCKED_CODES = Object.freeze([
  ...CONDITIONAL_APPLICABILITY_BLOCKED_CODES,
  ...AMBIGUOUS_CODES,
]);

const TARGET_CODES = Object.freeze([...RESOLVED_CODES, ...BLOCKED_CODES]);
const TARGET_CODE_SET = new Set(TARGET_CODES);

// These are canonical fingerprints of the complete current candidate rows,
// not merely of their displayed prerequisite strings.  Browser/robots/sitemap
// receipts, response bytes and hashes, entry boundaries, units, structured
// fields, complete-entry controls, and the entire raw entry therefore all fail
// closed together.
const EXACT_CANDIDATE_SHA256 = Object.freeze({
  BIOL1115: '42d2408fbb82945133afb608a7284d13f59f830053a0a9a5d7c524bfa4908e38',
  BIOL1116: 'd0d43f70bd2e8073fb4d58953d62c02c48f8f9269256cd290b7b63015faedce7',
  CS3604: '753ce1357bf3ed43b4a76f8ff7512377874435687e0111dc8e331335adce82a0',
  CS4664: '5fc9d7332ff8483624d89b8acfced84e7970adfe1f6b7995434e9fee692c219f',
  ENGE4735: '44d5499c8173b70b03eec0e591282615e6f0d0c85f1b1f0f4394c3da38f4089a',
  ENGE4736: 'f105e15796ffd32d0172ac201a1fe2173796d77b30db15c242414342c786bc09',
  MATH1225: '2af58bd3cdbb6da5c45a27beee88831322f3605721bc37cc7f370de5eee0ca71',
  MATH2534: '46e9baa8bfbedb152afeebb8720755bea7bd2ef83727a7d3b82e72f2fac4087c',
  MATH3414: '5eb9edf6fd280641b98671cbadd532069b4f261714c6d9d0bc0f7a6b7c754191',
  MATH4445: 'd0e167a1775902f942e4f4242a3cdf825bf0c25bf607f0528e4f4efab7f38c59',
});

const EXACT_SOURCE_SHA256 = Object.freeze({
  BIOL1115: '953cdd1336e04f1d2175a3f5ada28476ddacd61d407fe723ae6f2f38dc6097ca',
  BIOL1116: 'f7ab1cfdcb92f8ec9c5120abde7626d885feb8bc6c7b04ef19b71b1f9880f423',
  CS3604: '4aa96f998516ef8c0f36c8b7272c9e7e2f7a67e47c7d0f8ea7d9d5e5e200dcf6',
  CS4664: '0c1051fd2b46a8476dba1c7ea945893e400ce1b9654a30fe814c5de9c4ee6280',
  ENGE4735: '1aa7be61751dd28bb021c3df7627734ede6c672199aa1b14aa5e1fce43eda04a',
  ENGE4736: 'd935e7da417ce380e1e0511caf58569caed2dd8e41a5f0bce6a6a41ce7dcc6f5',
  MATH1225: 'f009e7c5a7253c26b636f0d38f0699d1c80053e5c7511d0fec35583e13dc34e0',
  MATH2534: '9b08bf4d9fc5fc110f5dee3af6445fc1376f9b6b2410682d7f56f76853e50d2b',
  MATH3414: '80cdf59afcc09d0cab4b0d4660e0784ef1b1f551fbc438ef5f83a06dae049b68',
  MATH4445: 'df9ffbff86a50b52a0ee6f4cfd41dfc07708d4b19ce590e32350eac793b18699',
});

const OUTSIDE_STATEMENTS = Object.freeze({
  CS3604_GRADE:
    'A grade of C or better required in CS prerequisite 3114.',
  ENGE_MAJOR_SCOPE:
    'Students majoring in Material Science and Engineering, Mechanical Engineering, Electrical and Computer Engineering, Industrial and Systems Engineering, and Biomedical Engineering must meet prerequisite and corequisite requirements for their respective in-major capstone courses.',
  MATH1225_BACKGROUND:
    'Assumes 2 units of high school algebra, 1 unit of geometry, 1/2 unit each of trigonometry and precalculus, and placement by Math Dept.',
  MATH1225_SIBLING_GRADE:
    'Pre: Grade of at least C- in 1225 for 1226.',
  MATH2534_BACKGROUND:
    'Two units of high school algebra, one unit of geometry, one-half unit each of trigonometry and precalculus mathematics required.',
  MATH2534_MAJOR_RESTRICTION:
    '2534 may not be taken by math majors for credit without special permission.',
});

const EXPECTED_RAW_FIELDS = Object.freeze({
  BIOL1115: Object.freeze({
    corequisite: 'BIOL 1105',
  }),
  BIOL1116: Object.freeze({
    corequisite: 'BIOL 1106',
  }),
  CS3604: Object.freeze({
    prerequisite: 'CS 1944 and (CS 2114 or ECE 3514) and (COMM 2004 or COMM 2014)',
  }),
  CS4664: Object.freeze({
    prerequisite: 'CS 3114 and CS 3654 or CMDA 3654 or STAT 3654',
  }),
  ENGE4736: Object.freeze({
    prerequisite: 'ENGE 4735',
    corequisite: '(MSE 4055 for MSE majors) or (ISE 4404 for ISE majors).',
  }),
  MATH1225: Object.freeze({
    prerequisite: 'MATH 1214',
  }),
  MATH2534: Object.freeze({
    prerequisite: 'CS 1114 or ECE 1574 or ECE 1004 or CS 2064',
  }),
  MATH3414: Object.freeze({
    prerequisite:
      '(CS 1044 or CS 1705 or CS 1114 or CS 1124) and MATH 2406H or (CMDA 2005 and CMDA 2006) or (MATH 2214 or MATH 2214H) and (MATH 2204 or MATH 2204H)',
  }),
  MATH4445: Object.freeze({
    prerequisite:
      'MATH 2406H or (CMDA 2005 and CMDA 2006) or (MATH 2214 or MATH 2214H) and (MATH 2204 or MATH 2204H)',
  }),
});

const ENGE_COREQUISITE =
  '(MSE 4055 for MSE majors) or (ISE 4404 for ISE majors).';

const AMBIGUITY = Object.freeze({
  CS4664:
    'the unparenthesized CS 3114 and CS 3654 or CMDA 3654 or STAT 3654 field does not publish the outer AND/OR scope',
  MATH3414:
    'the field mixes parenthesized alternatives with unparenthesized outer AND/OR operators, so the route boundaries are not published',
  MATH4445:
    'the field mixes parenthesized alternatives with an unparenthesized final AND, so the route boundary is not published',
});

const CONDITIONAL_APPLICABILITY_BLOCKING_REASON = Object.freeze({
  ENGE4735:
    'the catalog publishes MSE- and ISE-qualified corequisite branches but no default branch for the other named capstone majors, and it does not bind the 81 prerequisite routes to those majors; the shared formula adapter cannot preserve that conditional applicability without inventing either a universal corequisite or an unpublished route-to-major mapping',
  ENGE4736:
    'the catalog publishes MSE- and ISE-qualified corequisite branches but no default branch for the other named capstone majors; the shared formula adapter cannot preserve that conditional applicability without inventing a universal corequisite or an unpublished complement branch',
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalSha256(value) {
  return sha256(canonicalJson(value));
}

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function courseCondition(raw, extra = {}) {
  const code = normalizeCode(raw);
  if (!code) throw new Error(`invalid exact Virginia Tech course atom: ${raw}`);
  return {
    type: 'course',
    code,
    course_key: `${VIRGINIA_TECH_OWNER_NAMESPACE}:${code}`,
    raw,
    ...extra,
  };
}

function nonCourseCondition(condition, raw, extra = {}) {
  return { type: 'non_course', condition, raw, ...extra };
}

function exactUniqueStatement(rawEntryText, raw, kind) {
  const source = String(rawEntryText || '');
  const start = source.indexOf(raw);
  if (start < 0 || source.indexOf(raw, start + raw.length) >= 0) {
    throw new Error(`Virginia Tech ${kind} statement is absent or non-unique`);
  }
  return {
    kind,
    raw,
    raw_sha256: sha256(raw),
    relative_start: start,
    relative_end: start + raw.length,
  };
}

function expectedField(candidate, kind) {
  const fields = candidate?.source?.structured_requisite_fields;
  if (!Array.isArray(fields)) throw new Error('Virginia Tech structured fields are missing');
  const matching = fields.filter((field) => field?.kind === kind);
  if (matching.length !== 1) {
    throw new Error(`Virginia Tech ${kind} field is not unique`);
  }
  const field = matching[0];
  if (field.receipt_contract !== COURSELEAF_FIELD_RECEIPT_CONTRACT
      || field.structural_class !== (kind === 'corequisite' ? 'detail-coreq' : 'detail-prereq')
      || sha256(field.raw) !== field.raw_sha256
      || sha256(field.raw_field_text) !== field.raw_field_text_sha256
      || candidate.source.raw_entry_text.slice(field.relative_start, field.relative_end)
        !== field.raw
      || candidate.source.raw_entry_text.slice(
        field.field_relative_start, field.field_relative_end,
      ) !== field.raw_field_text
      || field.statement_relative_start !== field.field_relative_start
      || field.statement_relative_end !== field.field_relative_end) {
    throw new Error(`Virginia Tech ${kind} structured-field receipt changed`);
  }
  return field;
}

function sourceReceiptIssues(candidate, code) {
  const issues = [];
  const source = candidate?.source;
  if (candidate?.school_id !== VIRGINIA_TECH_SCHOOL_ID
      || candidate?.slug !== VIRGINIA_TECH_SLUG
      || candidate?.owner_namespace !== VIRGINIA_TECH_OWNER_NAMESPACE
      || candidate?.course_key !== `${VIRGINIA_TECH_OWNER_NAMESPACE}:${code}`
      || candidate?.course_code !== code) issues.push('candidate_identity');
  if (source?.catalog_year_verified !== VIRGINIA_TECH_CATALOG_YEAR
      || source?.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT) {
    issues.push('catalog_boundary');
  }
  if (source?.complete_entry_receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
      || source?.complete_entry_receipt?.same_source_positive_control !== true
      || !Number.isInteger(source?.complete_entry_receipt?.source_courseblock_count)
      || !Number.isInteger(source?.complete_entry_receipt?.source_complete_entry_count)
      || source.complete_entry_receipt.source_courseblock_count
        < source.complete_entry_receipt.source_complete_entry_count) {
    issues.push('complete_entry_receipt');
  }
  if (sha256(source?.raw_entry_text || '') !== source?.raw_entry_sha256) {
    issues.push('raw_entry_sha256');
  }
  if (canonicalSha256(source) !== EXACT_SOURCE_SHA256[code]) issues.push('source_fingerprint');
  if (canonicalSha256(candidate) !== EXACT_CANDIDATE_SHA256[code]) {
    issues.push('candidate_fingerprint');
  }
  return issues;
}

function targetCodeForCandidate(candidate) {
  const candidates = [
    normalizeCode(candidate?.course_code),
    normalizeCode(String(candidate?.course_key || '').split(':').at(-1)),
  ];
  for (const code of candidates) if (TARGET_CODE_SET.has(code)) return code;
  const sourceFingerprint = canonicalSha256(candidate?.source || null);
  return TARGET_CODES.find((code) => EXACT_SOURCE_SHA256[code] === sourceFingerprint) || null;
}

function group(candidate, kind, raw, paths, flags = []) {
  const id = `${candidate.course_key}:${kind}:0`;
  return {
    id,
    kind,
    raw,
    flags: [
      'strict_full_text_accounting',
      `source:${VIRGINIA_TECH_SLUG}`,
      'virginia_tech_exact_candidate_and_source_fingerprint_v1',
      ...flags,
    ],
    formula: FORMULA,
    paths: paths.map((allOf, index) => ({
      id: `${id}:path:${index}`,
      raw,
      all_of: allOf,
    })),
  };
}

function exactOrCoursePaths(raw) {
  const atoms = raw.split(' or ');
  if (atoms.join(' or ') !== raw || atoms.length < 2) {
    throw new Error('Virginia Tech flat OR field changed');
  }
  return atoms.map((atom) => [courseCondition(atom)]);
}

function auditExactEngeCorequisite(raw) {
  if (raw !== ENGE_COREQUISITE) {
    throw new Error('Virginia Tech conditional ENGE corequisite field changed');
  }
  const match = /^\(MSE 4055 for MSE majors\) or \(ISE 4404 for ISE majors\)\.$/.exec(raw);
  if (!match) throw new Error('Virginia Tech conditional ENGE corequisite grouping changed');
  return {
    exact_conditional_branch_count: 2,
    exact_course_codes: ['MSE4055', 'ISE4404'],
    exact_program_qualifiers: ['MSE majors', 'ISE majors'],
    conditional_corequisite_default_branch_published: false,
    universal_corequisite_projection_authorized: false,
  };
}

function biolResolution(candidate, code) {
  const field = expectedField(candidate, 'corequisite');
  const expected = EXPECTED_RAW_FIELDS[code].corequisite;
  const receipt = candidate.source.complete_entry_receipt;
  if (field.raw !== expected
      || candidate.source.structured_requisite_fields.length !== 1
      || receipt.entry_required_requisite_marker_count !== 0
      || receipt.entry_corequisite_marker_count !== 1
      || receipt.entry_requisite_marker_like_count !== 1
      || receipt.entry_constraint_like_signal_count !== 0
      || receipt.source_courseblock_count !== 96
      || receipt.source_complete_entry_count !== 95
      || receipt.source_complete_entries_with_required_requisite_marker_count !== 63
      || receipt.same_source_positive_control !== true) {
    throw new Error('Virginia Tech BIOL corequisite-only boundary changed');
  }
  return {
    status: 'parsed',
    raw_requisites: field.raw_field_text,
    groups: [group(candidate, 'corequisite', field.raw, [[
      courseCondition(field.raw, {
        concurrent_allowed: true,
        source_field_kind: 'corequisite',
      }),
    ]], [
      'virginia_tech_exact_corequisite_only_courseleaf_field',
      'zero_required_prerequisite_markers_proven_by_complete_entry_receipt',
      'same_source_required_prerequisite_positive_control',
      'status_is_parsed_never_none',
    ])],
    proof: {
      prerequisite_absence_boundary:
        'zero formal required-prerequisite markers in one exact complete entry; this is not a status=none claim',
      complete_entry_receipt: receipt,
      corequisite_field_receipt: field,
      corequisite_edge_preserved: true,
      status_none_authorized: false,
    },
  };
}

function cs3604Resolution(candidate) {
  const field = expectedField(candidate, 'prerequisite');
  if (field.raw !== EXPECTED_RAW_FIELDS.CS3604.prerequisite
      || candidate.source.structured_requisite_fields.length !== 1) {
    throw new Error('Virginia Tech CS3604 prerequisite field changed');
  }
  const gradeEvidence = exactUniqueStatement(
    candidate.source.raw_entry_text,
    OUTSIDE_STATEMENTS.CS3604_GRADE,
    'exact_full_entry_grade_statement',
  );
  const match = /^CS 1944 and \(CS 2114 or ECE 3514\) and \(COMM 2004 or COMM 2014\)$/.exec(field.raw);
  if (!match) throw new Error('Virginia Tech CS3604 grouping changed');
  const paths = [];
  for (const computing of ['CS 2114', 'ECE 3514']) {
    for (const communication of ['COMM 2004', 'COMM 2014']) {
      paths.push([
        courseCondition('CS 3114', {
          minimum_grade: 'C',
          raw: 'CS prerequisite 3114',
          minimum_grade_evidence: gradeEvidence,
          condition_origin: 'exact_full_entry_requirement_outside_structured_field',
        }),
        courseCondition('CS 1944'),
        courseCondition(computing),
        courseCondition(communication),
      ]);
    }
  }
  return {
    status: 'parsed',
    raw_requisites:
      `${OUTSIDE_STATEMENTS.CS3604_GRADE}${field.raw_field_text}`,
    groups: [group(candidate, 'prerequisite', field.raw, paths, [
      'virginia_tech_exact_parenthesized_or_groups_joined_by_and',
      'exact_outside_cs3114_minimum_grade_c_preserved',
    ])],
    proof: {
      structured_field_receipt: field,
      modeled_outside_statements: [gradeEvidence],
      minimum_grade: 'C',
      minimum_grade_course_code: 'CS3114',
    },
  };
}

function auditExactEnge4735Prerequisite(raw) {
  if (!raw.startsWith('(') || !raw.endsWith(')')) {
    throw new Error('Virginia Tech ENGE prerequisite does not have exact outer path parentheses');
  }
  const bodies = raw.slice(1, -1).split(') or (');
  if (`(${bodies.join(') or (')})` !== raw || bodies.length !== 81) {
    throw new Error('Virginia Tech ENGE prerequisite path boundary changed');
  }
  const courseCodesByPath = bodies.map((body) => {
    const atoms = body.split(' and ');
    if (atoms.join(' and ') !== body || atoms.length < 2) {
      throw new Error('Virginia Tech ENGE prerequisite conjunction changed');
    }
    return atoms.map((atom) => {
      const code = normalizeCode(atom);
      if (!code) throw new Error(`Virginia Tech ENGE prerequisite atom changed: ${atom}`);
      return code;
    });
  });
  return {
    prerequisite_path_count: courseCodesByPath.length,
    prerequisite_path_course_codes_sha256: canonicalSha256(courseCodesByPath),
    prerequisite_course_atom_count: courseCodesByPath.flat().length,
    route_to_major_mapping_published: false,
    route_to_major_mapping_inferred: false,
  };
}

function auditExactEngeBlockedSemantics(candidate, code) {
  const prerequisite = expectedField(candidate, 'prerequisite');
  const corequisite = expectedField(candidate, 'corequisite');
  if (candidate.source.structured_requisite_fields.length !== 2
      || corequisite.raw !== ENGE_COREQUISITE) {
    throw new Error(`Virginia Tech ${code} field roster changed`);
  }
  if (code === 'ENGE4736'
      && prerequisite.raw !== EXPECTED_RAW_FIELDS.ENGE4736.prerequisite) {
    throw new Error('Virginia Tech ENGE4736 prerequisite field changed');
  }
  const majorScope = exactUniqueStatement(
    candidate.source.raw_entry_text,
    OUTSIDE_STATEMENTS.ENGE_MAJOR_SCOPE,
    'major_scope',
  );
  const prerequisiteAudit = code === 'ENGE4735'
    ? auditExactEnge4735Prerequisite(prerequisite.raw)
    : {
      exact_prerequisite_course_code: normalizeCode(prerequisite.raw),
      prerequisite_path_count: 1,
      route_to_major_mapping_published: false,
      route_to_major_mapping_inferred: false,
    };
  if (code === 'ENGE4736' && prerequisiteAudit.exact_prerequisite_course_code !== 'ENGE4735') {
    throw new Error('Virginia Tech ENGE4736 prerequisite atom changed');
  }
  return {
    structured_field_receipts: [prerequisite, corequisite],
    exact_major_scope_statement: majorScope,
    ...prerequisiteAudit,
    ...auditExactEngeCorequisite(corequisite.raw),
    shared_formula_projection_emitted: false,
    conditional_applicability_losslessly_representable: false,
    no_corequisite_complement_branch_invented: true,
  };
}

function math1225Resolution(candidate) {
  const field = expectedField(candidate, 'prerequisite');
  if (candidate.source.structured_requisite_fields.length !== 1
      || field.raw !== EXPECTED_RAW_FIELDS.MATH1225.prerequisite) {
    throw new Error('Virginia Tech MATH1225 prerequisite field changed');
  }
  const background = exactUniqueStatement(
    candidate.source.raw_entry_text,
    OUTSIDE_STATEMENTS.MATH1225_BACKGROUND,
    'assumed_background_and_placement',
  );
  const sibling = exactUniqueStatement(
    candidate.source.raw_entry_text,
    OUTSIDE_STATEMENTS.MATH1225_SIBLING_GRADE,
    'exact_sibling_course_prerequisite_context_not_applicable_to_current_course',
  );
  const backgroundCondition = nonCourseCondition(
    'catalog_assumed_high_school_mathematics_and_math_department_placement',
    OUTSIDE_STATEMENTS.MATH1225_BACKGROUND,
    {
      catalog_semantic_force: 'assumes',
      high_school_mathematics: {
        algebra_units: 2,
        geometry_units: 1,
        trigonometry_units: 0.5,
        precalculus_units: 0.5,
      },
      placement_authority: 'Math Dept.',
      source_evidence: background,
    },
  );
  return {
    status: 'parsed',
    raw_requisites: field.raw_field_text,
    groups: [group(candidate, 'prerequisite', field.raw, [[
      courseCondition(field.raw),
      backgroundCondition,
    ]], [
      'virginia_tech_exact_single_prerequisite',
      'catalog_assumed_background_and_placement_preserved',
    ])],
    proof: {
      structured_field_receipt: field,
      modeled_outside_statements: [background],
      preserved_noncurrent_sibling_statements: [sibling],
    },
  };
}

function math2534Resolution(candidate) {
  const field = expectedField(candidate, 'prerequisite');
  if (candidate.source.structured_requisite_fields.length !== 1
      || field.raw !== EXPECTED_RAW_FIELDS.MATH2534.prerequisite) {
    throw new Error('Virginia Tech MATH2534 prerequisite field changed');
  }
  const background = exactUniqueStatement(
    candidate.source.raw_entry_text,
    OUTSIDE_STATEMENTS.MATH2534_BACKGROUND,
    'required_high_school_background',
  );
  const restriction = exactUniqueStatement(
    candidate.source.raw_entry_text,
    OUTSIDE_STATEMENTS.MATH2534_MAJOR_RESTRICTION,
    'major_permission_restriction',
  );
  const backgroundCondition = nonCourseCondition(
    'required_high_school_algebra_geometry_trigonometry_and_precalculus',
    OUTSIDE_STATEMENTS.MATH2534_BACKGROUND,
    {
      high_school_mathematics: {
        algebra_units: 2,
        geometry_units: 1,
        trigonometry_units: 0.5,
        precalculus_units: 0.5,
      },
      required: true,
      source_evidence: background,
    },
  );
  const majorRestriction = nonCourseCondition(
    'mathematics_major_credit_requires_special_permission',
    OUTSIDE_STATEMENTS.MATH2534_MAJOR_RESTRICTION,
    {
      condition_applies_when: {
        academic_program: 'Mathematics',
        eligible_academic_program_roles: ['major'],
      },
      authorization_kind: 'special_permission',
      restriction_scope: 'permission_required_for_credit_when_mathematics_major',
      source_evidence: restriction,
    },
  );
  const paths = exactOrCoursePaths(field.raw).map((path) => [
    ...path,
    backgroundCondition,
    majorRestriction,
  ]);
  return {
    status: 'parsed',
    raw_requisites: field.raw_field_text,
    groups: [group(candidate, 'prerequisite', field.raw, paths, [
      'virginia_tech_exact_flat_or_course_choices',
      'required_high_school_background_preserved',
      'conditional_mathematics_major_permission_restriction_preserved',
    ])],
    proof: {
      structured_field_receipt: field,
      modeled_outside_statements: [background, restriction],
      prerequisite_course_alternative_count: 4,
      conditional_major_restriction_preserved: true,
    },
  };
}

function buildResolution(candidate, code) {
  switch (code) {
    case 'BIOL1115':
    case 'BIOL1116': return biolResolution(candidate, code);
    case 'CS3604': return cs3604Resolution(candidate);
    case 'MATH1225': return math1225Resolution(candidate);
    case 'MATH2534': return math2534Resolution(candidate);
    default: throw new Error(`no exact Virginia Tech resolution for ${code}`);
  }
}

function resolveVirginiaTechPrerequisiteCandidate(candidate) {
  const code = targetCodeForCandidate(candidate);
  if (!code) return { applicable: false, ready: false, issues: [] };
  const issues = sourceReceiptIssues(candidate, code);
  if (issues.length) {
    return {
      applicable: true,
      ready: false,
      code,
      issues,
      review_reason: 'virginia_tech_exact_candidate_or_source_receipt_changed',
    };
  }
  if (CONDITIONAL_APPLICABILITY_BLOCKED_CODES.includes(code)) {
    try {
      const proof = auditExactEngeBlockedSemantics(candidate, code);
      return {
        applicable: true,
        ready: false,
        code,
        issues: ['conditional_applicability_not_losslessly_representable'],
        review_reason:
          'virginia_tech_courseleaf_conditional_applicability_not_losslessly_representable',
        ambiguity: CONDITIONAL_APPLICABILITY_BLOCKING_REASON[code],
        candidate_sha256: EXACT_CANDIDATE_SHA256[code],
        source_sha256: EXACT_SOURCE_SHA256[code],
        source_or_core_content_changed: false,
        proof,
      };
    } catch (error) {
      return {
        applicable: true,
        ready: false,
        code,
        issues: ['conditional_applicability_audit', error.message],
        review_reason: 'virginia_tech_exact_semantic_projection_failed',
      };
    }
  }
  if (AMBIGUOUS_CODES.includes(code)) {
    let field = null;
    try {
      field = expectedField(candidate, 'prerequisite');
    } catch (error) {
      return {
        applicable: true,
        ready: false,
        code,
        issues: ['structured_field_receipt'],
        review_reason: 'virginia_tech_exact_candidate_or_source_receipt_changed',
      };
    }
    if (field.raw !== EXPECTED_RAW_FIELDS[code].prerequisite
        || candidate.source.structured_requisite_fields.length !== 1) {
      return {
        applicable: true,
        ready: false,
        code,
        issues: ['structured_field_roster'],
        review_reason: 'virginia_tech_exact_candidate_or_source_receipt_changed',
      };
    }
    return {
      applicable: true,
      ready: false,
      code,
      issues: ['ambiguous_boolean_grouping'],
      review_reason: 'virginia_tech_courseleaf_boolean_grouping_not_explicit',
      ambiguity: AMBIGUITY[code],
      proof: { structured_field_receipt: field },
    };
  }
  try {
    const resolution = buildResolution(candidate, code);
    return {
      applicable: true,
      ready: true,
      code,
      issues: [],
      review_reason: 'virginia_tech_exact_courseleaf_semantics_resolved',
      candidate_sha256: EXACT_CANDIDATE_SHA256[code],
      source_sha256: EXACT_SOURCE_SHA256[code],
      publication_scope: 'university_prerequisite_formula_review_only',
      source_or_core_content_changed: false,
      ...resolution,
    };
  } catch (error) {
    return {
      applicable: true,
      ready: false,
      code,
      issues: ['semantic_projection', error.message],
      review_reason: 'virginia_tech_exact_semantic_projection_failed',
    };
  }
}

module.exports = {
  AMBIGUITY,
  AMBIGUOUS_CODES,
  BLOCKED_CODES,
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_FIELD_RECEIPT_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  CONDITIONAL_APPLICABILITY_BLOCKED_CODES,
  CONDITIONAL_APPLICABILITY_BLOCKING_REASON,
  ENGE_COREQUISITE,
  EXACT_CANDIDATE_SHA256,
  EXACT_SOURCE_SHA256,
  EXPECTED_RAW_FIELDS,
  FORMULA,
  OUTSIDE_STATEMENTS,
  RESOLVED_CODES,
  TARGET_CODES,
  VIRGINIA_TECH_CATALOG_YEAR,
  VIRGINIA_TECH_OWNER_NAMESPACE,
  VIRGINIA_TECH_SCHOOL_ID,
  VIRGINIA_TECH_SLUG,
  canonicalJson,
  canonicalSha256,
  exactUniqueStatement,
  normalizeCode,
  resolveVirginiaTechPrerequisiteCandidate,
  sha256,
  sourceReceiptIssues,
  targetCodeForCandidate,
};
