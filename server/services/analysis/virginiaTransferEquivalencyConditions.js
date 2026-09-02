/**
 * Fail-closed review of conditions attached to concrete Transfer Virginia
 * equivalencies.
 *
 * `buildVaAgreements` retains the complete concrete source-edge channel beside
 * the ordinary requirement options.  The ordinary options cannot express a
 * condition such as "A + B is required" or "either X or Y".  This reader
 * therefore joins each articulated option back to its hash-bound source edge
 * before a Virginia pair is allowed to produce a numeric paper cell.
 *
 * No free-text note is globally non-blocking.  A condition is discharged only
 * by an institution-specific, source-bound resolver that validates the exact
 * source and selected-edge receipts.  Every other nonempty note stays
 * unresolved; silence is not interpreted as evidence for a condition or
 * award.
 */

const { createHash } = require('node:crypto');
const { parseCourseCode, satisfies } = require('../vaCourseCodes');
const {
  canonicalCourseCode,
  courseIdFor,
  institutionCourseIdFor,
  parentIdForLanding,
} = require('../virginia/courseIdentity');
const { exactVcuTree } = require('./vcuConstraintProofs');
const {
  exactVirginiaTechFigure34Tree,
} = require('./virginiaTechConstraintProofs');
const {
  resolveVirginiaTechTransferableAsPassportNote,
} = require('./virginiaTechTransferableAssociatePolicy');
const virginiaTechEquivalencyQuantityEvidence = require(
  '../../.va-catalogs/research/virginia-tech-equivalency-quantity-evidence.json'
);
const {
  EQUIVALENCY_RESPONSE_SHA256,
  QUANTITY_FACTS_SHA256,
  virginiaTechEquivalencyQuantityEvidenceIssue,
} = require('./virginiaTechEquivalencyQuantityEvidence');
const {
  RULE: VIRGINIA_TECH_CSC222_JAVA_RULE,
  VT_CSC222_SELECTED_NOTE,
  VT_CSC222_SOURCE_URL,
  resolveVirginiaTechCsc222JavaEvidence,
} = require('./virginiaTechCsc222JavaEvidence');
const {
  VIRGINIA_TECH_CSC_PAIR_CODES,
  VIRGINIA_TECH_CSC_PAIR_CONTRACT,
  VIRGINIA_TECH_CSC_PAIR_COURSES,
  VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX,
  VIRGINIA_TECH_CSC_PAIR_IDS,
  VIRGINIA_TECH_CSC_PAIR_NAMED_APPLICATION_UNITS,
  VIRGINIA_TECH_CSC_PAIR_NOTE,
  VIRGINIA_TECH_CSC_PAIR_OPTION_FIELD,
  VIRGINIA_TECH_CSC_PAIR_RECEIVER_INDEX,
  VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER,
  VIRGINIA_TECH_CSC_PAIR_RECEIVING_NAME,
  VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID,
  VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX,
  claimsVirginiaTechBachelor,
  validateVirginiaTechAgreementIdentity,
  validateVirginiaTechAtomicOption,
} = require('./virginiaTechAtomicArticulation');

const SOURCE_EQUIVALENCIES_CONTRACT = 'va-concrete-supply-edge-v2';
const SELECTED_EQUIVALENCIES_CONTRACT = 'va-selected-supply-edge-v1';
const EXPECTED_ROW_KEYS = Object.freeze([
  'receiving_identifier',
  'receiving_name',
  'receiving_notes',
  'receiving_parent_id',
  'sending_code',
  'sending_course_id',
  'sending_course_key',
  'sending_source_url',
]);
const EXPECTED_SELECTED_ROW_KEYS = Object.freeze([
  'demand_index',
  'option_index',
  'receiver_index',
  'requirement_group_index',
  'section_index',
  'sending_code',
  'sending_course_id',
  'sending_course_key',
  'sending_source_url',
  'source_receiving_identifier',
  'source_receiving_name',
  'source_receiving_notes',
  'source_receiving_notes_supplied',
  'source_receiving_parent_id',
  'source_receiving_parent_id_supplied',
]);

const VCU_STATISTICS_NOTE =
  'Students will receive transfer credit for either STAT 210 or STAT 212, depending on their degree requirements.';
const VCU_SAME_CREDIT_NOTE =
  'Students will earn the same number of transfer credits (semester hours) as the course taken.';
const VCU_STATISTICS_EDGE = Object.freeze({
  sending_code: 'MTH245',
  receiving_identifier: 'STAT210',
  receiving_name: 'BASIC PRACTICE OF STATISTICS',
  source_url: 'https://www.transfervirginia.org/course/D37BC31B1F9411F082AC0242AC15010A',
});
const VCU_SDV100_EDGE = Object.freeze({
  sending_code: 'SDV100',
  receiving_identifier: 'UNIV101',
  receiving_name: 'INTRODUCTION TO THE UNIVERSITY',
  source_url: 'https://www.transfervirginia.org/course/D3A1BC681F9411F082AC0242AC15010A',
});
const VIRGINIA_TECH_VARIABLE_CREDIT_NOTE =
  'Elective equivalent credit hours varies based on transfer course.';
const VIRGINIA_TECH_SPLIT_CREDIT_RULE =
  'exact-vt-vccs-split-receiving-credit-v1';
const VIRGINIA_TECH_SPLIT_CREDIT_ROUTES = Object.freeze({
  CSC222: Object.freeze({
    sending_code: 'CSC222',
    sending_units: 4,
    source_receiving_identifier: 'CS1114',
    source_receiving_name: 'Intro to Software Design',
    source_receiving_notes: VT_CSC222_SELECTED_NOTE,
    source_url: VT_CSC222_SOURCE_URL,
    receiver_codes: Object.freeze(['CS1114']),
    section_units: 3,
    language_evidence_required: true,
    selected_edges: Object.freeze([
      Object.freeze({
        demand_index: 0,
        sending_code: 'CSC222',
        receiving_identifier: 'CS1114',
        receiving_name: 'Intro to Software Design',
        receiving_notes: VT_CSC222_SELECTED_NOTE,
        source_url: VT_CSC222_SOURCE_URL,
        sending_units: 4,
      }),
    ]),
  }),
  CSC223: Object.freeze({
    sending_code: 'CSC223',
    sending_units: 4,
    source_receiving_identifier: 'CS2114',
    source_receiving_name: 'Softw Des & Data Structures',
    source_receiving_notes: VIRGINIA_TECH_VARIABLE_CREDIT_NOTE,
    source_url:
      'https://www.transfervirginia.org/course/D37A6B421F9411F082AC0242AC15010A',
    receiver_codes: Object.freeze(['CS2114']),
    section_units: 3,
    selected_edges: Object.freeze([
      Object.freeze({
        demand_index: 0,
        sending_code: 'CSC223',
        receiving_identifier: 'CS2114',
        receiving_name: 'Softw Des & Data Structures',
        receiving_notes: VIRGINIA_TECH_VARIABLE_CREDIT_NOTE,
        source_url:
          'https://www.transfervirginia.org/course/D37A6B421F9411F082AC0242AC15010A',
        sending_units: 4,
      }),
    ]),
  }),
  EGR122: Object.freeze({
    sending_code: 'EGR122',
    sending_units: 3,
    source_receiving_identifier: 'ENGE1216',
    source_receiving_name: 'Foundations of Engineering',
    source_receiving_notes: VIRGINIA_TECH_VARIABLE_CREDIT_NOTE,
    source_url:
      'https://www.transfervirginia.org/course/D37A87231F9411F082AC0242AC15010A',
    receiver_codes: Object.freeze(['ENGE1215', 'ENGE1216']),
    section_units: 4,
    selected_edges: Object.freeze([
      Object.freeze({
        demand_index: 0,
        sending_code: 'EGR121',
        receiving_identifier: 'ENGE1215',
        receiving_name: 'Foundations of Engineering',
        receiving_notes: null,
        source_url:
          'https://www.transfervirginia.org/course/D37A86ED1F9411F082AC0242AC15010A',
        sending_units: 2,
      }),
      Object.freeze({
        demand_index: 1,
        sending_code: 'EGR122',
        receiving_identifier: 'ENGE1216',
        receiving_name: 'Foundations of Engineering',
        receiving_notes: VIRGINIA_TECH_VARIABLE_CREDIT_NOTE,
        source_url:
          'https://www.transfervirginia.org/course/D37A87231F9411F082AC0242AC15010A',
        sending_units: 3,
      }),
    ]),
  }),
});
// No free-text note is globally safe. Even apparently advisory Passport/UCGS
// language depends on the exact associate credential and receiver path.
const EXACT_NONBLOCKING_NOTES = new Map();

const array = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (value == null ? null : String(value).trim());
const number = (value) => (
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value) : null
);

function normalizedSourceEquivalencyRow(row) {
  return {
    sending_course_id: number(row?.sending_course_id),
    sending_course_key: text(row?.sending_course_key),
    sending_code: text(row?.sending_code),
    receiving_identifier: text(row?.receiving_identifier),
    receiving_name: text(row?.receiving_name),
    receiving_notes: row?.receiving_notes == null ? null : text(row.receiving_notes),
    receiving_parent_id: number(row?.receiving_parent_id),
    sending_source_url: text(row?.sending_source_url),
  };
}

function sourceEquivalenciesSha256(rows) {
  return createHash('sha256').update(JSON.stringify(
    array(rows).map(normalizedSourceEquivalencyRow),
  )).digest('hex');
}

function sourceEquivalencySort(left, right) {
  return number(left?.sending_course_id) - number(right?.sending_course_id)
    || number(left?.receiving_parent_id) - number(right?.receiving_parent_id)
    || text(left?.sending_course_key).localeCompare(text(right?.sending_course_key))
    || text(left?.sending_code).localeCompare(text(right?.sending_code))
    || text(left?.receiving_identifier).localeCompare(text(right?.receiving_identifier))
    || text(left?.receiving_name).localeCompare(text(right?.receiving_name))
    || String(text(left?.receiving_notes) ?? '')
      .localeCompare(String(text(right?.receiving_notes) ?? ''))
    || String(text(left?.sending_source_url) ?? '')
      .localeCompare(String(text(right?.sending_source_url) ?? ''));
}

function normalizedSelectedEquivalencyRow(row) {
  return {
    requirement_group_index: number(row?.requirement_group_index),
    section_index: number(row?.section_index),
    receiver_index: number(row?.receiver_index),
    option_index: number(row?.option_index),
    demand_index: number(row?.demand_index),
    sending_course_id: number(row?.sending_course_id),
    sending_course_key: text(row?.sending_course_key),
    sending_code: text(row?.sending_code),
    source_receiving_identifier: text(row?.source_receiving_identifier),
    source_receiving_name: text(row?.source_receiving_name),
    source_receiving_notes_supplied: row?.source_receiving_notes_supplied === true,
    source_receiving_notes: row?.source_receiving_notes == null
      ? null : text(row.source_receiving_notes),
    source_receiving_parent_id_supplied: row?.source_receiving_parent_id_supplied === true,
    source_receiving_parent_id: number(row?.source_receiving_parent_id),
    sending_source_url: text(row?.sending_source_url),
  };
}

function selectedEquivalenciesSha256(rows) {
  return createHash('sha256').update(JSON.stringify(
    array(rows).map(normalizedSelectedEquivalencyRow),
  )).digest('hex');
}

function selectedEquivalencySort(left, right) {
  return number(left?.requirement_group_index) - number(right?.requirement_group_index)
    || number(left?.section_index) - number(right?.section_index)
    || number(left?.receiver_index) - number(right?.receiver_index)
    || number(left?.option_index) - number(right?.option_index)
    || number(left?.demand_index) - number(right?.demand_index)
    || number(left?.sending_course_id) - number(right?.sending_course_id)
    || text(left?.sending_course_key).localeCompare(text(right?.sending_course_key))
    || text(left?.source_receiving_identifier)
      .localeCompare(text(right?.source_receiving_identifier))
    || String(text(left?.source_receiving_name) ?? '')
      .localeCompare(String(text(right?.source_receiving_name) ?? ''))
    || String(text(left?.source_receiving_notes) ?? '')
      .localeCompare(String(text(right?.source_receiving_notes) ?? ''))
    || String(text(left?.sending_source_url) ?? '')
      .localeCompare(String(text(right?.sending_source_url) ?? ''));
}

function claimsVirginiaSourceEquivalencyChannel(agreement) {
  return /^va:agreement:/.test(String(agreement?._id || ''))
    || String(agreement?.state || '').toLowerCase() === 'va'
    || agreement?.pairing === 'course-equivalency-join'
    || agreement?.source_equivalencies_contract != null
    || agreement?.source_equivalencies_count != null
    || agreement?.source_equivalencies_sha256 != null
    || agreement?.source_equivalencies != null;
}

function validateSourceEquivalencyChannel(agreement) {
  if (!claimsVirginiaSourceEquivalencyChannel(agreement)) {
    return { claimed: false, valid: true, rows: [] };
  }
  const rows = array(agreement?.source_equivalencies);
  if (agreement?.source_equivalencies_contract !== SOURCE_EQUIVALENCIES_CONTRACT) {
    return { claimed: true, valid: false, reason: 'the concrete source-equivalency contract is missing or changed' };
  }
  if (!Array.isArray(agreement?.source_equivalencies)) {
    return { claimed: true, valid: false, reason: 'the concrete source-equivalency rows are missing' };
  }
  if (number(agreement?.source_equivalencies_count) !== rows.length
      || text(agreement?.source_equivalencies_sha256) !== sourceEquivalenciesSha256(rows)) {
    return { claimed: true, valid: false, reason: 'the concrete source-equivalency count or hash changed' };
  }
  const supplyEdges = number(agreement?.derived_from?.supply_edges);
  if (!Number.isInteger(supplyEdges) || supplyEdges < rows.length) {
    return { claimed: true, valid: false, reason: 'the concrete source-equivalency supply-edge receipt changed' };
  }
  for (const row of rows) {
    if (JSON.stringify(Object.keys(row || {}).sort()) !== JSON.stringify(EXPECTED_ROW_KEYS)) {
      return { claimed: true, valid: false, reason: 'the concrete source-equivalency row schema changed' };
    }
    const normalized = normalizedSourceEquivalencyRow(row);
    const sendingCode = canonicalCourseCode(normalized.sending_code);
    const receivingIdentifier = canonicalCourseCode(normalized.receiving_identifier);
    if (!Number.isInteger(normalized.sending_course_id)
        || parseCourseCode(sendingCode).kind !== 'concrete'
        || parseCourseCode(receivingIdentifier).kind !== 'concrete'
        || normalized.sending_course_id !== courseIdFor(sendingCode)
        || normalized.sending_course_key !== `va:${sendingCode}`
        || normalized.sending_code !== sendingCode
        || normalized.receiving_identifier !== receivingIdentifier
        || !normalized.receiving_name
        || !/^https:\/\/www\.transfervirginia\.org\/course\/[A-F0-9]+$/i
          .test(normalized.sending_source_url || '')
        || (row.receiving_notes != null
          && (!normalized.receiving_notes
            || normalized.receiving_notes !== row.receiving_notes))
        || normalized.receiving_parent_id !== parentIdForLanding({
          identifier: receivingIdentifier,
          name: normalized.receiving_name,
        })) {
      return { claimed: true, valid: false, reason: 'a concrete source-equivalency identity or provenance field changed' };
    }
  }
  const sorted = [...rows].sort(sourceEquivalencySort);
  if (rows.some((row, index) => row !== sorted[index])) {
    return { claimed: true, valid: false, reason: 'the concrete source-equivalency rows are not canonically sorted' };
  }
  const identities = rows.map((row) => JSON.stringify([
    row.sending_course_id,
    row.sending_course_key,
    row.sending_code,
    row.receiving_identifier,
    row.receiving_parent_id,
  ]));
  if (new Set(identities).size !== identities.length) {
    return { claimed: true, valid: false, reason: 'the concrete source-equivalency channel contains duplicate edges' };
  }
  return { claimed: true, valid: true, rows };
}

function selectedOptionAtPath(agreement, row) {
  const group = array(agreement?.requirement_groups)[number(row?.requirement_group_index)];
  const section = array(group?.sections)[number(row?.section_index)];
  const receiver = array(section?.receivers)[number(row?.receiver_index)];
  const option = array(receiver?.options)[number(row?.option_index)];
  return receiver?.articulation_status === 'articulated' && option
    ? { receiver, option } : null;
}

function expectedSelectedOptionKeys(agreement) {
  const keys = [];
  for (const [groupIndex, group] of array(agreement?.requirement_groups).entries()) {
    for (const [sectionIndex, section] of array(group?.sections).entries()) {
      for (const [receiverIndex, receiver] of array(section?.receivers).entries()) {
        if (receiver?.articulation_status !== 'articulated') continue;
        for (const [optionIndex, option] of array(receiver?.options).entries()) {
          for (const [demandIndex, sendingId] of array(option?.course_ids).map(number).entries()) {
            keys.push(JSON.stringify([
              groupIndex, sectionIndex, receiverIndex, optionIndex, demandIndex, sendingId,
            ]));
          }
        }
      }
    }
  }
  return keys.sort();
}

function validateSelectedEquivalencyChannel(agreement, concreteRows) {
  const rows = array(agreement?.selected_equivalencies);
  if (agreement?.selected_equivalencies_contract !== SELECTED_EQUIVALENCIES_CONTRACT) {
    return { valid: false, reason: 'the selected source-equivalency contract is missing or changed' };
  }
  if (!Array.isArray(agreement?.selected_equivalencies)) {
    return { valid: false, reason: 'the selected source-equivalency rows are missing' };
  }
  if (number(agreement?.selected_equivalencies_count) !== rows.length
      || text(agreement?.selected_equivalencies_sha256) !== selectedEquivalenciesSha256(rows)) {
    return { valid: false, reason: 'the selected source-equivalency count or hash changed' };
  }
  const supplyEdges = number(agreement?.derived_from?.supply_edges);
  if (!Number.isInteger(supplyEdges) || supplyEdges < rows.length) {
    return { valid: false, reason: 'the selected source-equivalency supply receipt changed' };
  }
  for (const row of rows) {
    if (JSON.stringify(Object.keys(row || {}).sort()) !== JSON.stringify(EXPECTED_SELECTED_ROW_KEYS)) {
      return { valid: false, reason: 'the selected source-equivalency row schema changed' };
    }
    const normalized = normalizedSelectedEquivalencyRow(row);
    const sendingCode = canonicalCourseCode(normalized.sending_code);
    if (![normalized.requirement_group_index, normalized.section_index,
      normalized.receiver_index, normalized.option_index, normalized.demand_index].every((value) => (
      Number.isInteger(value) && value >= 0
    ))
        || !Number.isInteger(normalized.sending_course_id)
        || parseCourseCode(sendingCode).kind !== 'concrete'
        || normalized.sending_course_id !== courseIdFor(sendingCode)
        || normalized.sending_course_key !== `va:${sendingCode}`
        || normalized.sending_code !== sendingCode
        || !normalized.source_receiving_identifier
        || !normalized.source_receiving_name
        || normalized.source_receiving_notes_supplied !== true
        || (row.source_receiving_notes != null
          && (!normalized.source_receiving_notes
            || normalized.source_receiving_notes !== row.source_receiving_notes))
        || typeof row.source_receiving_parent_id_supplied !== 'boolean'
        || (normalized.source_receiving_parent_id_supplied !== true
          && normalized.source_receiving_parent_id != null)
        || !/^https:\/\/www\.transfervirginia\.org\/course\/[A-F0-9]+$/i
          .test(normalized.sending_source_url || '')) {
      return { valid: false, reason: 'a selected source-equivalency identity or provenance field changed' };
    }
    const atPath = selectedOptionAtPath(agreement, row);
    const optionIds = array(atPath?.option?.course_ids).map(number);
    const atomicOption = validateVirginiaTechAtomicOption(atPath?.option);
    if (atomicOption.claimed && !atomicOption.valid) {
      return { valid: false, reason: atomicOption.reason };
    }
    const demands = atomicOption.claimed
      ? atomicOption.demands : demandedCodes(atPath?.receiver);
    if (!atPath
        || optionIds.length !== demands.length
        || optionIds[normalized.demand_index] !== normalized.sending_course_id
        || !satisfies(
          demands[normalized.demand_index],
          normalized.source_receiving_identifier,
        )) {
      return { valid: false, reason: 'a selected source-equivalency no longer binds to its articulated option' };
    }

    const concreteParentId = parentIdForLanding({
      identifier: normalized.source_receiving_identifier,
      name: normalized.source_receiving_name,
    });
    if (normalized.source_receiving_parent_id_supplied === true
        && normalized.source_receiving_parent_id !== concreteParentId) {
      return { valid: false, reason: 'a supplied receiving parent disagrees with the derived selected-edge identity' };
    }
    if (concreteParentId != null) {
      const concreteMatches = concreteRows.filter((candidate) => (
        number(candidate?.sending_course_id) === normalized.sending_course_id
        && number(candidate?.receiving_parent_id) === concreteParentId
        && text(candidate?.receiving_identifier)
          === canonicalCourseCode(normalized.source_receiving_identifier)
        && text(candidate?.receiving_name) === normalized.source_receiving_name
        && (candidate?.receiving_notes == null ? null : text(candidate.receiving_notes))
          === normalized.source_receiving_notes
        && text(candidate?.sending_source_url) === normalized.sending_source_url
      ));
      if (concreteMatches.length !== 1) {
        return { valid: false, reason: 'a concrete selected edge is absent from the complete concrete source channel' };
      }
    }
  }
  const sorted = [...rows].sort(selectedEquivalencySort);
  if (rows.some((row, index) => row !== sorted[index])) {
    return { valid: false, reason: 'the selected source-equivalency rows are not canonically sorted' };
  }
  const actualKeys = rows.map((row) => JSON.stringify([
    row.requirement_group_index,
    row.section_index,
    row.receiver_index,
    row.option_index,
    row.demand_index,
    row.sending_course_id,
  ])).sort();
  const expectedKeys = expectedSelectedOptionKeys(agreement);
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
      || new Set(actualKeys).size !== actualKeys.length) {
    return { valid: false, reason: 'the selected source-equivalency rows are not a lossless one-to-one option receipt' };
  }
  return { valid: true, rows };
}

function classifySourceEquivalencyNote(value) {
  if (value == null) return { kind: 'none', blocking: false };
  if (String(value).trim() === '') return { kind: 'invalid_empty_note', blocking: true };
  const note = String(value).trim();
  const exactSafeKind = EXACT_NONBLOCKING_NOTES.get(note);
  if (exactSafeKind) return { kind: exactSafeKind, blocking: false };

  if (/\b(?:must\s+take|both\s+courses?|take\s+.+\s+and\s+)\b|\+/.test(note.toLowerCase())) {
    return { kind: 'compound_sending_requirement', blocking: true };
  }
  if (/\b(?:minimum\s+grade|grade\s+of|[a-d][+-]?\s+or\s+better)\b/i.test(note)) {
    return { kind: 'minimum_grade_condition', blocking: true };
  }
  if (/\b(?:either|depending|alternatively)\b|\bor\b/i.test(note)) {
    return { kind: 'alternative_receiving_award', blocking: true };
  }
  if (/\b(?:advisor|adviser|department|permission|consent|approval)\b/i.test(note)) {
    return { kind: 'advisor_or_approval_condition', blocking: true };
  }
  if (/\b(?:varies|variable|credit\s+hours?\s+(?:may|will)\s+vary)\b/i.test(note)) {
    return { kind: 'variable_receiving_credit', blocking: true };
  }
  if (/\b(?:prerequisite|required|restriction|cannot|only)\b/i.test(note)) {
    return { kind: 'other_eligibility_condition', blocking: true };
  }
  return { kind: 'unreviewed_nonempty_note', blocking: true };
}

function receivingParentIds(receiving) {
  if (receiving?.kind === 'series') {
    return array(receiving.parent_ids).map(number).filter(Number.isInteger);
  }
  const parentId = number(receiving?.parent_id);
  return Number.isInteger(parentId) ? [parentId] : [];
}

function exactProjectedReceivingOwner(agreement, bachelorDocument) {
  const agreementOwner = Number.isInteger(number(agreement?.uc_school_id))
    ? `va:uni:${number(agreement.uc_school_id)}` : null;
  const bachelorOwner = /^va:uni:\d+$/.test(text(bachelorDocument?.institution_id) || '')
    ? text(bachelorDocument.institution_id) : null;
  return agreementOwner && bachelorOwner && agreementOwner === bachelorOwner
    ? agreementOwner : null;
}

function demandedCodes(receiver) {
  const seen = String(receiver?.code_seen ?? '').trim();
  if (seen) {
    return seen.split(/\s*\+\s*|\s+and\s+/i)
      .map((part) => part.trim()).filter(Boolean);
  }
  const name = receiver?.receiving?.name;
  return name ? [String(name).trim()] : [];
}

function articulatedSourceEdgeKeys(agreement) {
  const keys = new Set();
  for (const group of array(agreement?.requirement_groups)) {
    for (const section of array(group?.sections)) {
      for (const receiver of array(section?.receivers)) {
        if (receiver?.articulation_status !== 'articulated') continue;
        const parentIds = receivingParentIds(receiver.receiving);
        for (const option of array(receiver?.options)) {
          const sendingIds = array(option?.course_ids).map(number).filter(Number.isInteger);
          for (const sendingId of sendingIds) {
            for (const parentId of parentIds) keys.add(`${sendingId}|${parentId}`);
          }
        }
      }
    }
  }
  return keys;
}

function conditionReceipt(agreement, row, classification) {
  return {
    agreement_id: agreement?._id == null ? null : String(agreement._id),
    sending_course_id: Number(row.sending_course_id),
    sending_code: row.sending_code,
    receiving_identifier: row.source_receiving_identifier,
    receiving_parent_id: parentIdForLanding({
      identifier: row.source_receiving_identifier,
      name: row.source_receiving_name,
    }),
    condition_kind: classification.kind,
    receiving_notes: row.source_receiving_notes,
    sending_source_url: row.sending_source_url,
    ...(classification.resolution ? { resolution: classification.resolution } : {}),
  };
}

function receiverCodes(receiver) {
  const body = receiver?.receiving || receiver || {};
  const raw = receiver?.code_seen ?? body.code ?? body.codes ?? [];
  return (Array.isArray(raw) ? raw : [raw])
    .map((value) => canonicalCourseCode(value))
    .filter(Boolean);
}

function exactEqualUnitSection(document, codes, units) {
  const expected = [...codes].sort();
  const matches = [];
  for (const [groupIndex, group] of array(document?.requirement_groups).entries()) {
    for (const [sectionIndex, section] of array(group?.sections).entries()) {
      const actual = array(section?.receivers).flatMap(receiverCodes).sort();
      if (number(section?.section_advisement) === 1
          && number(section?.unit_advisement) === units
          && JSON.stringify(actual) === JSON.stringify(expected)
          && array(section?.receivers).every((receiver) => (
            number(receiver?.receiving?.units) === units
              || receiver?.receiving?.units == null
          ))) matches.push({ groupIndex, sectionIndex });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

function exactVcuSelectedPath(agreement, row, bachelorDocument, unitsById, {
  sectionCodes,
  receiverCode,
  sectionUnits,
  sendingCode,
  sendingUnits,
}) {
  const exact = exactVcuTree(bachelorDocument);
  if (!exact.supported || !(unitsById instanceof Map)) return null;
  const selectedPath = selectedOptionAtPath(agreement, row);
  const groupIndex = number(row?.requirement_group_index);
  const sectionIndex = number(row?.section_index);
  const receiverIndex = number(row?.receiver_index);
  const group = array(bachelorDocument?.requirement_groups)[groupIndex];
  const section = array(group?.sections)[sectionIndex];
  const receiver = array(section?.receivers)[receiverIndex];
  if (!selectedPath || !section || !receiver
      || canonicalCourseCode(row?.sending_code) !== sendingCode
      || number(unitsById.get(number(row?.sending_course_id))) !== sendingUnits
      || number(section.section_advisement) !== 1
      || number(section.unit_advisement) !== sectionUnits
      || JSON.stringify(receiverCodes(receiver)) !== JSON.stringify([receiverCode])) return null;
  const exactSection = exactEqualUnitSection(bachelorDocument, sectionCodes, sectionUnits);
  if (!exactSection || exactSection.groupIndex !== groupIndex
      || exactSection.sectionIndex !== sectionIndex) return null;
  const agreementParentIds = receivingParentIds(selectedPath.receiver.receiving);
  const bachelorParentIds = receivingParentIds(receiver.receiving);
  const sourceParentId = parentIdForLanding({
    identifier: row.source_receiving_identifier,
    name: row.source_receiving_name,
  });
  const receivingOwner = exactProjectedReceivingOwner(agreement, bachelorDocument);
  const projectedParentId = receivingOwner
    ? institutionCourseIdFor(receivingOwner, row.source_receiving_identifier) : null;
  if (!Number.isInteger(sourceParentId) || !Number.isInteger(projectedParentId)
      || !agreementParentIds.includes(projectedParentId)
      || !bachelorParentIds.includes(projectedParentId)) return null;
  const optionIds = array(selectedPath.option.course_ids).map(number);
  if (JSON.stringify(optionIds) !== JSON.stringify([courseIdFor(sendingCode)])) return null;
  return {
    exact,
    sourceParentId,
    projectedParentId,
    groupIndex,
    sectionIndex,
    receiverIndex,
  };
}

function sameSelectedOptionPath(left, right) {
  return number(left?.requirement_group_index) === number(right?.requirement_group_index)
    && number(left?.section_index) === number(right?.section_index)
    && number(left?.receiver_index) === number(right?.receiver_index)
    && number(left?.option_index) === number(right?.option_index);
}

function exactVirginiaTechSplitCreditPath(agreement, row, bachelorDocument, unitsById,
  figureModel, { languageEvidence = null } = {}) {
  const normalized = normalizedSelectedEquivalencyRow(row);
  const route = VIRGINIA_TECH_SPLIT_CREDIT_ROUTES[normalized.sending_code];
  if (!route
      || figureModel !== 'complete_degree_path'
      || normalized.source_receiving_notes !== route.source_receiving_notes
      || normalized.source_receiving_identifier !== route.source_receiving_identifier
      || normalized.source_receiving_name !== route.source_receiving_name
      || normalized.sending_source_url !== route.source_url
      || virginiaTechEquivalencyQuantityEvidenceIssue(
        virginiaTechEquivalencyQuantityEvidence,
      ) !== null) return null;

  const agreementIdentity = validateVirginiaTechAgreementIdentity(agreement);
  const exact = exactVirginiaTechFigure34Tree(bachelorDocument);
  if (!agreementIdentity.valid || !exact.supported || !(unitsById instanceof Map)) {
    return null;
  }

  const selectedPath = selectedOptionAtPath(agreement, row);
  const groupIndex = number(row?.requirement_group_index);
  const sectionIndex = number(row?.section_index);
  const receiverIndex = number(row?.receiver_index);
  const optionIndex = number(row?.option_index);
  const demandIndex = number(row?.demand_index);
  const bachelorSection = array(
    array(bachelorDocument?.requirement_groups)[groupIndex]?.sections,
  )[sectionIndex];
  const bachelorReceiver = array(bachelorSection?.receivers)[receiverIndex];
  if (!selectedPath
      || !bachelorSection
      || !bachelorReceiver
      || optionIndex !== 0
      || number(bachelorSection.section_advisement) !== 1
      || number(bachelorSection.unit_advisement) !== route.section_units
      || JSON.stringify(demandedCodes(selectedPath.receiver).map(canonicalCourseCode))
        !== JSON.stringify(route.receiver_codes)
      || JSON.stringify(demandedCodes(bachelorReceiver).map(canonicalCourseCode))
        !== JSON.stringify(route.receiver_codes)) return null;

  const optionIds = array(selectedPath.option?.course_ids).map(number);
  const expectedIds = route.selected_edges.map((edge) => courseIdFor(edge.sending_code));
  if (JSON.stringify(optionIds) !== JSON.stringify(expectedIds)
      || text(selectedPath.option?.course_conjunction)?.toLowerCase() !== 'and'
      || demandIndex !== route.selected_edges.findIndex((edge) => (
        edge.sending_code === route.sending_code
      ))) return null;

  const siblingRows = array(agreement?.selected_equivalencies)
    .filter((candidate) => sameSelectedOptionPath(candidate, row))
    .map(normalizedSelectedEquivalencyRow)
    .sort((left, right) => left.demand_index - right.demand_index);
  if (siblingRows.length !== route.selected_edges.length) return null;
  const receivingOwner = exactProjectedReceivingOwner(agreement, bachelorDocument);
  if (!receivingOwner) return null;
  for (const [index, expected] of route.selected_edges.entries()) {
    const candidate = siblingRows[index];
    const sourceParentId = parentIdForLanding({
      identifier: candidate?.source_receiving_identifier,
      name: candidate?.source_receiving_name,
    });
    const projectedParentId = institutionCourseIdFor(
      receivingOwner,
      candidate?.source_receiving_identifier,
    );
    if (candidate?.demand_index !== expected.demand_index
        || candidate?.sending_course_id !== courseIdFor(expected.sending_code)
        || candidate?.sending_course_key !== `va:${expected.sending_code}`
        || candidate?.sending_code !== expected.sending_code
        || candidate?.source_receiving_identifier !== expected.receiving_identifier
        || candidate?.source_receiving_name !== expected.receiving_name
        || candidate?.source_receiving_notes !== expected.receiving_notes
        || candidate?.sending_source_url !== expected.source_url
        || number(unitsById.get(candidate?.sending_course_id)) !== expected.sending_units
        || !Number.isInteger(sourceParentId)
        || !Number.isInteger(projectedParentId)
        || !receivingParentIds(selectedPath.receiver?.receiving).includes(projectedParentId)
        || !receivingParentIds(bachelorReceiver?.receiving).includes(projectedParentId)) {
      return null;
    }
  }

  const facts = virginiaTechEquivalencyQuantityEvidence.quantity_facts
    .rows[route.sending_code];
  if (number(facts?.sending_units) !== route.sending_units
      || facts?.named_receiving_code !== route.source_receiving_identifier
      || number(facts?.named_receiving_units) + number(facts?.elective_receiving_units)
        !== number(facts?.total_receiving_units)
      || number(facts?.total_receiving_units) !== route.sending_units
      || number(facts?.elective_receiving_units) <= 0
      || (facts?.language_condition != null
        && !(route.language_evidence_required === true
          && languageEvidence?.ready === true))) return null;

  return {
    exact,
    route,
    facts,
    groupIndex,
    sectionIndex,
    receiverIndex,
    languageEvidence,
  };
}

function virginiaTechSplitCreditResolution(path) {
  const languageResolution = path.languageEvidence?.ready === true;
  return {
    rule: languageResolution
      ? VIRGINIA_TECH_CSC222_JAVA_RULE : VIRGINIA_TECH_SPLIT_CREDIT_RULE,
    ...(languageResolution
      ? { split_credit_rule: VIRGINIA_TECH_SPLIT_CREDIT_RULE } : {}),
    proof_tree_sha256: path.exact.proof.proof_tree_sha256,
    official_equivalency_response_sha256: EQUIVALENCY_RESPONSE_SHA256,
    quantity_facts_sha256: QUANTITY_FACTS_SHA256,
    sending_units: path.facts.sending_units,
    named_receiving_code: path.facts.named_receiving_code,
    named_receiving_units: path.facts.named_receiving_units,
    elective_receiving_code: path.facts.elective_receiving_code,
    elective_receiving_units: path.facts.elective_receiving_units,
    total_receiving_units: path.facts.total_receiving_units,
    residual_elective_credit_supported: true,
    ...(languageResolution ? {
      language_condition: path.facts.language_condition,
      java_delivery_proof: path.languageEvidence.proof,
    } : {}),
    requirement_group_index: path.groupIndex,
    section_index: path.sectionIndex,
    receiver_index: path.receiverIndex,
  };
}

function resolveBoundedCondition(agreement, row, classification, {
  bachelorDocument, associateDocument, unitsById, figureModel,
} = {}) {
  const normalized = normalizedSelectedEquivalencyRow(row);
  const javaEvidence = resolveVirginiaTechCsc222JavaEvidence({
    agreement,
    row: normalized,
    associateDocument,
    figureModel,
  });
  if (javaEvidence.ready) {
    const path = exactVirginiaTechSplitCreditPath(
      agreement,
      row,
      bachelorDocument,
      unitsById,
      figureModel,
      { languageEvidence: javaEvidence },
    );
    if (path) return {
      kind: 'exact_vt_csc222_java_split_credit_resolved',
      blocking: false,
      resolution: virginiaTechSplitCreditResolution(path),
    };
  }
  if (classification.kind === 'variable_receiving_credit') {
    const path = exactVirginiaTechSplitCreditPath(
      agreement,
      row,
      bachelorDocument,
      unitsById,
      figureModel,
    );
    if (path) return {
      kind: 'exact_vt_split_receiving_credit_resolved',
      blocking: false,
      resolution: virginiaTechSplitCreditResolution(path),
    };
  }
  if (normalized.source_receiving_notes === VCU_STATISTICS_NOTE
      && normalized.sending_code === VCU_STATISTICS_EDGE.sending_code
      && normalized.source_receiving_identifier === VCU_STATISTICS_EDGE.receiving_identifier
      && normalized.source_receiving_name === VCU_STATISTICS_EDGE.receiving_name
      && normalized.sending_source_url === VCU_STATISTICS_EDGE.source_url
      && number(unitsById?.get(normalized.sending_course_id)) === 3) {
    const path = exactVcuSelectedPath(agreement, row, bachelorDocument, unitsById, {
      sectionCodes: ['STAT210', 'STAT212'],
      receiverCode: 'STAT210',
      sectionUnits: 3,
      sendingCode: 'MTH245',
      sendingUnits: 3,
    });
    if (path) return {
      kind: 'equal_unit_receiving_alternative_resolved',
      blocking: false,
      resolution: {
        rule: 'exact_vcu_statistics_equal_unit_choice',
        proof_tree_sha256: path.exact.proof.proof_tree_sha256,
        accepted_receiving_codes: ['STAT210', 'STAT212'],
        sending_units: 3,
        receiving_units: 3,
        requirement_group_index: path.groupIndex,
        section_index: path.sectionIndex,
        receiver_index: path.receiverIndex,
      },
    };
  }
  if (normalized.source_receiving_notes === VCU_SAME_CREDIT_NOTE
      && normalized.sending_code === VCU_SDV100_EDGE.sending_code
      && normalized.source_receiving_identifier === VCU_SDV100_EDGE.receiving_identifier
      && normalized.source_receiving_name === VCU_SDV100_EDGE.receiving_name
      && normalized.sending_source_url === VCU_SDV100_EDGE.source_url) {
    const path = exactVcuSelectedPath(agreement, row, bachelorDocument, unitsById, {
      sectionCodes: ['UNIV101', 'UNIV103', 'UNIV191'],
      receiverCode: 'UNIV101',
      sectionUnits: 1,
      sendingCode: 'SDV100',
      sendingUnits: 1,
    });
    if (path) return {
      kind: 'same_credit_hours_confirmation_resolved',
      blocking: false,
      resolution: {
        rule: 'exact_vcu_sdv100_univ101_one_to_one_award',
        proof_tree_sha256: path.exact.proof.proof_tree_sha256,
        sending_units: 1,
        receiving_units: 1,
        requirement_group_index: path.groupIndex,
        section_index: path.sectionIndex,
        receiver_index: path.receiverIndex,
      },
    };
  }
  const virginiaTechTransferableAs = resolveVirginiaTechTransferableAsPassportNote({
    agreement,
    row,
    bachelorDocument,
    associateDocument,
    figureModel,
  });
  if (virginiaTechTransferableAs.ready) {
    return virginiaTechTransferableAs.classification;
  }
  return classification;
}

function virginiaTechAtomicApplicationReceipt(agreement, exact) {
  return {
    contract: VIRGINIA_TECH_CSC_PAIR_CONTRACT,
    agreement_id: text(agreement?._id),
    sending_course_ids: [...VIRGINIA_TECH_CSC_PAIR_IDS],
    sending_codes: [...VIRGINIA_TECH_CSC_PAIR_CODES],
    sending_source_urls: VIRGINIA_TECH_CSC_PAIR_COURSES.map((row) => row.source_url),
    source_receiving_note: VIRGINIA_TECH_CSC_PAIR_NOTE,
    receiving_identifier: VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER,
    receiving_parent_id: VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID,
    named_application_cap_units: VIRGINIA_TECH_CSC_PAIR_NAMED_APPLICATION_UNITS,
    residual_elective_credit_supported: false,
    requirement_group_index: VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX,
    section_index: VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX,
    receiver_index: VIRGINIA_TECH_CSC_PAIR_RECEIVER_INDEX,
    proof_tree_sha256: exact.proof.proof_tree_sha256,
  };
}

const EXPECTED_VT_APPLICATION_KEYS = Object.freeze([
  'agreement_id',
  'contract',
  'named_application_cap_units',
  'proof_tree_sha256',
  'receiver_index',
  'receiving_identifier',
  'receiving_parent_id',
  'requirement_group_index',
  'residual_elective_credit_supported',
  'section_index',
  'sending_codes',
  'sending_course_ids',
  'sending_source_urls',
  'source_receiving_note',
]);

function validateVirginiaTechAtomicApplicationReceipt(receipt, {
  bachelorDocument = null,
  planSet = null,
  unitsById = null,
  agreements = null,
} = {}) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
      || JSON.stringify(Object.keys(receipt).sort())
        !== JSON.stringify(EXPECTED_VT_APPLICATION_KEYS)) {
    return { valid: false, reason: 'the Virginia Tech atomic application receipt schema changed' };
  }
  const exact = exactVirginiaTechFigure34Tree(bachelorDocument);
  const agreementMatches = array(agreements).filter((agreement) => (
    text(agreement?._id) === text(receipt?.agreement_id)
  ));
  const agreementIdentity = agreementMatches.length === 1
    ? validateVirginiaTechAgreementIdentity(agreementMatches[0])
    : { valid: false, reason: 'the atomic application does not bind to exactly one current agreement' };
  const expected = exact.supported
      && agreementIdentity.valid
    ? virginiaTechAtomicApplicationReceipt(agreementMatches[0], exact)
    : null;
  if (!expected || JSON.stringify(receipt) !== JSON.stringify(expected)) {
    return {
      valid: false,
      reason: !exact.supported
        ? exact.reason
        : (!agreementIdentity.valid
          ? agreementIdentity.reason
          : 'the Virginia Tech atomic application identity or accounting receipt changed'),
    };
  }
  if (!(planSet instanceof Set)
      || !VIRGINIA_TECH_CSC_PAIR_IDS.every((id) => planSet.has(id))) {
    return { valid: false, reason: 'the selected associate plan does not contain both atomic Virginia Tech source courses' };
  }
  if (!(unitsById instanceof Map)
      || VIRGINIA_TECH_CSC_PAIR_COURSES.some((row) => (
        number(unitsById.get(row.course_id)) !== row.units
      ))) {
    return { valid: false, reason: 'the atomic Virginia Tech source-course unit receipt changed' };
  }
  return { valid: true, receipt, exact };
}

function virginiaTechPairBlocker(agreement, reason) {
  return {
    agreement_id: agreement?._id == null ? null : String(agreement._id),
    sending_course_ids: [...VIRGINIA_TECH_CSC_PAIR_IDS],
    sending_codes: [...VIRGINIA_TECH_CSC_PAIR_CODES],
    receiving_identifier: VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER,
    receiving_parent_id: VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID,
    condition_kind: 'compound_sending_requirement',
    receiving_notes: VIRGINIA_TECH_CSC_PAIR_NOTE,
    reason,
  };
}

function exactVirginiaTechPairSourceRows(rows) {
  const candidates = array(rows).filter((row) => (
    VIRGINIA_TECH_CSC_PAIR_IDS.includes(number(row?.sending_course_id))
  ));
  if (candidates.length !== VIRGINIA_TECH_CSC_PAIR_COURSES.length) {
    return { valid: false, reason: 'the agreement does not retain exactly one concrete source edge for each Virginia Tech pair course' };
  }
  for (const expected of VIRGINIA_TECH_CSC_PAIR_COURSES) {
    const matches = candidates.filter((row) => (
      number(row?.sending_course_id) === expected.course_id
      && text(row?.sending_course_key) === expected.course_key
      && text(row?.sending_code) === expected.code
      && text(row?.receiving_identifier)
        === VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER
      && text(row?.receiving_name) === VIRGINIA_TECH_CSC_PAIR_RECEIVING_NAME
      && text(row?.receiving_notes) === VIRGINIA_TECH_CSC_PAIR_NOTE
      && number(row?.receiving_parent_id)
        === VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID
      && text(row?.sending_source_url) === expected.source_url
    ));
    if (matches.length !== 1) {
      return { valid: false, reason: `the exact ${expected.code}→CS2505 source-edge receipt changed` };
    }
  }
  return { valid: true, rows: candidates };
}

function exactVirginiaTechPairSelectedRows(agreement, selectedRows) {
  const candidates = array(selectedRows).filter((row) => (
    VIRGINIA_TECH_CSC_PAIR_IDS.includes(number(row?.sending_course_id))
  ));
  if (candidates.length !== VIRGINIA_TECH_CSC_PAIR_COURSES.length) {
    return { valid: false, reason: 'the atomic Virginia Tech option does not retain two selected source-edge receipts' };
  }
  const firstPath = selectedOptionAtPath(agreement, candidates[0]);
  const atomic = validateVirginiaTechAtomicOption(firstPath?.option);
  if (!firstPath || !atomic.claimed || !atomic.valid) {
    return { valid: false, reason: atomic.reason || 'the exact atomic Virginia Tech option is missing' };
  }
  if (number(candidates[0]?.requirement_group_index)
        !== VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX
      || number(candidates[0]?.section_index)
        !== VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX
      || number(candidates[0]?.receiver_index)
        !== VIRGINIA_TECH_CSC_PAIR_RECEIVER_INDEX
      || candidates.some((row) => (
        number(row?.requirement_group_index)
          !== VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX
        || number(row?.section_index)
          !== VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX
        || number(row?.receiver_index)
          !== VIRGINIA_TECH_CSC_PAIR_RECEIVER_INDEX
        || number(row?.option_index) !== 0
      ))) {
    return { valid: false, reason: 'the atomic Virginia Tech selected-edge path moved' };
  }
  for (const [demandIndex, expected] of VIRGINIA_TECH_CSC_PAIR_COURSES.entries()) {
    const matches = candidates.filter((row) => (
      number(row?.demand_index) === demandIndex
      && number(row?.sending_course_id) === expected.course_id
      && text(row?.sending_course_key) === expected.course_key
      && text(row?.sending_code) === expected.code
      && text(row?.source_receiving_identifier)
        === VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER
      && text(row?.source_receiving_name) === VIRGINIA_TECH_CSC_PAIR_RECEIVING_NAME
      && row?.source_receiving_notes_supplied === true
      && text(row?.source_receiving_notes) === VIRGINIA_TECH_CSC_PAIR_NOTE
      && text(row?.sending_source_url) === expected.source_url
      && (row?.source_receiving_parent_id_supplied !== true
        || number(row?.source_receiving_parent_id)
          === VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID)
    ));
    if (matches.length !== 1) {
      return { valid: false, reason: `the selected ${expected.code} atomic demand receipt changed` };
    }
  }
  return { valid: true, rows: candidates, option: firstPath.option };
}

function resolveVirginiaTechAtomicPair(agreement, sourceRows, selectedRows, {
  degreeCourseSet,
  bachelorDocument,
  unitsById,
} = {}) {
  if (!claimsVirginiaTechBachelor(bachelorDocument)) {
    return { applicable: false, ready: false, consumed_rows: [] };
  }
  const presentCandidateIds = VIRGINIA_TECH_CSC_PAIR_IDS.filter((id) => (
    degreeCourseSet instanceof Set && degreeCourseSet.has(id)
  ));
  if (!presentCandidateIds.length) {
    return { applicable: false, ready: false, consumed_rows: [] };
  }
  // A source-pool observation is not an applied articulation.  Some colleges
  // publish one half of the conditional CSC 205 + CSC 215 edge, but the exact
  // Virginia Tech CS 2505 receiver remains `not_articulated` because the
  // college does not supply the whole pair.  The ordinary selected-row audit
  // already ignores every unselected source observation; this special-case
  // resolver must preserve that boundary too.
  const selectedPairRows = array(selectedRows).filter((row) => (
    VIRGINIA_TECH_CSC_PAIR_IDS.includes(number(row?.sending_course_id))
  ));
  if (!selectedPairRows.length) {
    return { applicable: false, ready: false, consumed_rows: [] };
  }
  const fail = (reason) => ({
    applicable: true,
    ready: false,
    consumed_rows: [],
    blocker: virginiaTechPairBlocker(agreement, reason),
  });
  const agreementIdentity = validateVirginiaTechAgreementIdentity(agreement);
  if (!agreementIdentity.valid) return fail(agreementIdentity.reason);
  const exact = exactVirginiaTechFigure34Tree(bachelorDocument);
  if (!exact.supported) return fail(exact.reason);
  if (!(unitsById instanceof Map)
      || VIRGINIA_TECH_CSC_PAIR_COURSES.some((row) => (
        number(unitsById.get(row.course_id)) !== row.units
      ))) {
    return fail('the exact three-credit CSC 205/CSC 215 source-unit receipt changed');
  }
  const source = exactVirginiaTechPairSourceRows(sourceRows);
  if (!source.valid) return fail(source.reason);
  const selected = exactVirginiaTechPairSelectedRows(agreement, selectedRows);
  if (!selected.valid) return fail(selected.reason);

  // The selected bachelor edge is an indivisible two-course award.  When the
  // associate source tree exposes only one half, that exact edge is unusable;
  // it is not evidence that every other complete associate plan is unknown.
  // Return a source-bound forbidden identity and let the exact Boolean planner
  // prove that a complete plan exists without it.  If the course is mandatory,
  // the planner still fails closed and the cell remains excluded.
  if (presentCandidateIds.length !== VIRGINIA_TECH_CSC_PAIR_IDS.length) {
    return {
      applicable: true,
      ready: true,
      consumed_rows: selected.rows,
      forbidden_ids: [...presentCandidateIds],
      advisory: {
        agreement_id: String(agreement._id),
        sending_course_ids: [...VIRGINIA_TECH_CSC_PAIR_IDS],
        sending_codes: [...VIRGINIA_TECH_CSC_PAIR_CODES],
        receiving_identifier: VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER,
        receiving_parent_id: VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID,
        condition_kind: 'compound_sending_requirement_edge_unusable',
        receiving_notes: VIRGINIA_TECH_CSC_PAIR_NOTE,
        sending_source_urls: VIRGINIA_TECH_CSC_PAIR_COURSES.map((row) => row.source_url),
        resolution: {
          rule: VIRGINIA_TECH_CSC_PAIR_CONTRACT,
          disposition: 'exclude_exact_lone_half_from_associate_plan',
          proof_tree_sha256: exact.proof.proof_tree_sha256,
          forbidden_sending_course_ids: [...presentCandidateIds],
          required_companion_course_ids: VIRGINIA_TECH_CSC_PAIR_IDS.filter((id) => (
            !presentCandidateIds.includes(id)
          )),
          named_application_cap_units: 0,
          residual_elective_credit_supported: false,
          requirement_group_index: VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX,
          section_index: VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX,
          receiver_index: VIRGINIA_TECH_CSC_PAIR_RECEIVER_INDEX,
        },
      },
    };
  }

  const application = virginiaTechAtomicApplicationReceipt(agreement, exact);
  return {
    applicable: true,
    ready: true,
    consumed_rows: selected.rows,
    required_ids: [...VIRGINIA_TECH_CSC_PAIR_IDS],
    application,
    advisory: {
      agreement_id: String(agreement._id),
      sending_course_ids: [...VIRGINIA_TECH_CSC_PAIR_IDS],
      sending_codes: [...VIRGINIA_TECH_CSC_PAIR_CODES],
      receiving_identifier: VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER,
      receiving_parent_id: VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID,
      condition_kind: 'compound_sending_requirement_resolved',
      receiving_notes: VIRGINIA_TECH_CSC_PAIR_NOTE,
      sending_source_urls: VIRGINIA_TECH_CSC_PAIR_COURSES.map((row) => row.source_url),
      resolution: {
        rule: VIRGINIA_TECH_CSC_PAIR_CONTRACT,
        proof_tree_sha256: exact.proof.proof_tree_sha256,
        required_sending_course_ids: [...VIRGINIA_TECH_CSC_PAIR_IDS],
        named_application_cap_units: VIRGINIA_TECH_CSC_PAIR_NAMED_APPLICATION_UNITS,
        residual_elective_credit_supported: false,
        requirement_group_index: VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX,
        section_index: VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX,
        receiver_index: VIRGINIA_TECH_CSC_PAIR_RECEIVER_INDEX,
      },
    },
  };
}

function auditVirginiaSourceEquivalencyConditions(agreements, {
  degreeCourseSet = null,
  bachelorDocument = null,
  associateDocument = null,
  unitsById = null,
  figureModel = null,
  requireVirginiaChannels = false,
} = {}) {
  const invalidChannels = [];
  const blocking = [];
  const advisory = [];
  const sourceBoundRequiredAnyIdSets = [];
  const sourceBoundApplications = [];
  const sourceBoundForbiddenCourseIds = [];
  let virginiaTechPairClaimCount = 0;
  let claimedAgreementCount = 0;
  for (const agreement of array(agreements)) {
    const channel = validateSourceEquivalencyChannel(agreement);
    if (!channel.claimed) {
      if (requireVirginiaChannels) {
        invalidChannels.push({
          agreement_id: agreement?._id == null ? null : String(agreement._id),
          reason: 'a matched Virginia agreement does not claim the required source-equivalency channels',
        });
      }
      continue;
    }
    claimedAgreementCount += 1;
    if (!channel.valid) {
      invalidChannels.push({
        agreement_id: agreement?._id == null ? null : String(agreement._id),
        reason: channel.reason,
      });
      continue;
    }
    const selected = validateSelectedEquivalencyChannel(agreement, channel.rows);
    if (!selected.valid) {
      invalidChannels.push({
        agreement_id: agreement?._id == null ? null : String(agreement._id),
        reason: selected.reason,
      });
      continue;
    }
    const virginiaTechPair = resolveVirginiaTechAtomicPair(
      agreement,
      channel.rows,
      selected.rows,
      { degreeCourseSet, bachelorDocument, unitsById },
    );
    const consumedRows = new Set();
    if (virginiaTechPair.applicable) {
      virginiaTechPairClaimCount += 1;
      if (!virginiaTechPair.ready) {
        blocking.push(virginiaTechPair.blocker);
      } else {
        virginiaTechPair.consumed_rows.forEach((row) => consumedRows.add(row));
        advisory.push(virginiaTechPair.advisory);
        if (virginiaTechPair.required_ids) {
          sourceBoundRequiredAnyIdSets.push(virginiaTechPair.required_ids);
        }
        if (virginiaTechPair.application) {
          sourceBoundApplications.push(virginiaTechPair.application);
        }
        for (const id of virginiaTechPair.forbidden_ids || []) {
          if (!sourceBoundForbiddenCourseIds.includes(id)) {
            sourceBoundForbiddenCourseIds.push(id);
          }
        }
      }
    }
    for (const row of selected.rows) {
      if (consumedRows.has(row)) continue;
      if (virginiaTechPair.applicable
          && VIRGINIA_TECH_CSC_PAIR_IDS.includes(number(row?.sending_course_id))) continue;
      if (degreeCourseSet instanceof Set
          && !degreeCourseSet.has(Number(row.sending_course_id))) continue;
      let classification = classifySourceEquivalencyNote(row.source_receiving_notes);
      classification = resolveBoundedCondition(agreement, row, classification, {
        bachelorDocument,
        associateDocument,
        unitsById,
        figureModel,
      });
      if (classification.kind === 'none') continue;
      const receipt = conditionReceipt(agreement, row, classification);
      (classification.blocking ? blocking : advisory).push(receipt);
    }
  }
  if (requireVirginiaChannels && array(agreements).length === 0) {
    invalidChannels.push({
      agreement_id: null,
      reason: 'the Virginia pair has no matched agreement to audit',
    });
  }
  if (virginiaTechPairClaimCount > 1) {
    invalidChannels.push({
      agreement_id: null,
      reason: 'more than one agreement claims the same atomic Virginia Tech associate pair',
    });
  }
  const ready = invalidChannels.length === 0 && blocking.length === 0;
  const kinds = [...new Set(blocking.map((row) => row.condition_kind))].sort();
  const warning = invalidChannels.length
    ? `The Virginia agreement source-equivalency receipt is invalid (${invalidChannels.map((issue) => issue.reason).join('; ')})`
    : (blocking.length
      ? `The Virginia pair uses ${blocking.length} selected equivalency edge${blocking.length === 1 ? '' : 's'} with unresolved source condition${blocking.length === 1 ? '' : 's'} (${kinds.join(', ')})`
      : null);
  return {
    applicable: claimedAgreementCount > 0,
    ready,
    claimed_agreement_count: claimedAgreementCount,
    invalid_channels: invalidChannels,
    blocking_conditions: blocking,
    advisory_conditions: advisory,
    source_bound_required_any_id_sets: sourceBoundRequiredAnyIdSets,
    source_bound_applications: sourceBoundApplications,
    source_bound_forbidden_course_ids: sourceBoundForbiddenCourseIds,
    warning,
  };
}

function virginiaTechAtomicRuntimeContext({
  bachelorDocument,
  associateDocument,
  agreements,
  planSet,
  unitsById,
} = {}) {
  if (!claimsVirginiaTechBachelor(bachelorDocument)
      || !(planSet instanceof Set)
      || !VIRGINIA_TECH_CSC_PAIR_IDS.some((id) => planSet.has(id))) {
    return { applicable: false, ready: false };
  }
  const audit = auditVirginiaSourceEquivalencyConditions(agreements, {
    degreeCourseSet: planSet,
    bachelorDocument,
    associateDocument,
    unitsById,
    figureModel: 'complete_degree_path',
    requireVirginiaChannels: true,
  });
  if (!audit.ready) {
    return {
      applicable: true,
      ready: false,
      reason: audit.warning
        || 'the selected associate plan does not satisfy the atomic Virginia Tech articulation',
    };
  }
  if (audit.source_bound_applications.length !== 1
      || audit.source_bound_required_any_id_sets.length !== 1) {
    return {
      applicable: true,
      ready: false,
      reason: 'the selected pair does not have exactly one atomic Virginia Tech application receipt',
    };
  }
  const validated = validateVirginiaTechAtomicApplicationReceipt(
    audit.source_bound_applications[0],
    { bachelorDocument, planSet, unitsById, agreements },
  );
  return validated.valid
    ? {
      applicable: true,
      ready: true,
      receipt: validated.receipt,
      required_ids: [...VIRGINIA_TECH_CSC_PAIR_IDS],
      audit,
    }
    : { applicable: true, ready: false, reason: validated.reason };
}

module.exports = {
  EXACT_NONBLOCKING_NOTES,
  SOURCE_EQUIVALENCIES_CONTRACT,
  SELECTED_EQUIVALENCIES_CONTRACT,
  articulatedSourceEdgeKeys,
  auditVirginiaSourceEquivalencyConditions,
  classifySourceEquivalencyNote,
  resolveVirginiaTechAtomicPair,
  selectedEquivalenciesSha256,
  sourceEquivalenciesSha256,
  validateSourceEquivalencyChannel,
  validateSelectedEquivalencyChannel,
  validateVirginiaTechAtomicApplicationReceipt,
  virginiaTechAtomicRuntimeContext,
};
