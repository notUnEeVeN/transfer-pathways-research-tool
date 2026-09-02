/**
 * Exact topology for Transfer Virginia's compound CSC 205 + CSC 215 award at
 * Virginia Tech.
 *
 * Both source-course pages publish the same conditional edge: the pair earns
 * CS 2505 plus a variable 2XXX elective amount.  The paper model can prove
 * only the three-credit named CS 2505 application.  The variable residue is
 * deliberately unsupported and must never become generic elective credit.
 */

const { courseIdFor } = require('../virginia/courseIdentity');
const {
  institutionIdentityById,
} = require('../virginia/institutionIds');

const VIRGINIA_TECH_SLUG =
  'virginia-polytechnic-institute-and-state-university';
const VIRGINIA_TECH_SCHOOL_ID = 9230;
const VIRGINIA_TECH_SOURCE_DEGREE_ID =
  `va:degree:${VIRGINIA_TECH_SLUG}:cs`;
const VIRGINIA_TECH_SOURCE_INSTITUTION_ID =
  `va:uni:${VIRGINIA_TECH_SLUG}`;
const VIRGINIA_TECH_MAJOR = 'Computer Science, B.S.';
const VIRGINIA_TECH_AGREEMENT_SOURCE =
  'derived from Transfer Virginia course equivalencies × published degree requirements';
const VIRGINIA_TECH_AGREEMENT_PAIRING = 'course-equivalency-join';

const VIRGINIA_TECH_CSC_PAIR_CONTRACT =
  'va-vt-csc205-csc215-cs2505-v1';
const VIRGINIA_TECH_CSC_PAIR_OPTION_FIELD =
  'source_bound_atomic_articulation';
const VIRGINIA_TECH_CSC_PAIR_NOTE =
  'Must take CSC 205 + 215 to receive CS 2505 + 2XXX. Elective equivalent credit hours varies based on transfer course.';
const VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER = 'CS2505';
const VIRGINIA_TECH_CSC_PAIR_RECEIVING_NAME = 'Intro Computer Organization';
const VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID = courseIdFor('CS2505');
const VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX = 0;
const VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX = 1;
const VIRGINIA_TECH_CSC_PAIR_RECEIVER_INDEX = 0;
const VIRGINIA_TECH_CSC_PAIR_NAMED_APPLICATION_UNITS = 3;

const VIRGINIA_TECH_CSC_PAIR_COURSES = Object.freeze([
  Object.freeze({
    code: 'CSC205',
    course_id: courseIdFor('CSC205'),
    course_key: 'va:CSC205',
    units: 3,
    source_url:
      'https://www.transfervirginia.org/course/D37A690E1F9411F082AC0242AC15010A',
  }),
  Object.freeze({
    code: 'CSC215',
    course_id: courseIdFor('CSC215'),
    course_key: 'va:CSC215',
    units: 3,
    source_url:
      'https://www.transfervirginia.org/course/D37A6A2A1F9411F082AC0242AC15010A',
  }),
]);
const VIRGINIA_TECH_CSC_PAIR_IDS = Object.freeze(
  VIRGINIA_TECH_CSC_PAIR_COURSES.map((row) => row.course_id),
);
const VIRGINIA_TECH_CSC_PAIR_CODES = Object.freeze(
  VIRGINIA_TECH_CSC_PAIR_COURSES.map((row) => row.code),
);

const ATOMIC_OPTION_KEYS = Object.freeze([
  'contract',
  'demand_identifiers',
  'named_application_cap_units',
  'receiving_identifier',
  'receiving_parent_id',
  'residual_elective_credit_supported',
  'sending_codes',
  'sending_course_ids',
  'sending_course_keys',
]);

const text = (value) => (value == null ? null : String(value).trim());
const number = (value) => (
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value) : null
);

function atomicOptionReceipt() {
  return {
    contract: VIRGINIA_TECH_CSC_PAIR_CONTRACT,
    sending_course_ids: [...VIRGINIA_TECH_CSC_PAIR_IDS],
    sending_course_keys: VIRGINIA_TECH_CSC_PAIR_COURSES.map((row) => row.course_key),
    sending_codes: [...VIRGINIA_TECH_CSC_PAIR_CODES],
    demand_identifiers: [
      VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER,
      VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER,
    ],
    receiving_identifier: VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER,
    receiving_parent_id: VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID,
    named_application_cap_units: VIRGINIA_TECH_CSC_PAIR_NAMED_APPLICATION_UNITS,
    residual_elective_credit_supported: false,
  };
}

function validateVirginiaTechAtomicOption(option) {
  const receipt = option?.[VIRGINIA_TECH_CSC_PAIR_OPTION_FIELD];
  if (receipt == null) return { claimed: false, valid: true, demands: null };
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
      || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(ATOMIC_OPTION_KEYS)) {
    return { claimed: true, valid: false, reason: 'the atomic Virginia Tech option schema changed' };
  }
  const expected = atomicOptionReceipt();
  if (JSON.stringify(receipt) !== JSON.stringify(expected)
      || JSON.stringify((option?.course_ids || []).map(Number))
        !== JSON.stringify(VIRGINIA_TECH_CSC_PAIR_IDS)
      || JSON.stringify((option?.course_keys || []).map(String))
        !== JSON.stringify(VIRGINIA_TECH_CSC_PAIR_COURSES.map((row) => row.course_key))
      || text(option?.course_conjunction)?.toLowerCase() !== 'and') {
    return { claimed: true, valid: false, reason: 'the atomic Virginia Tech option identity or accounting receipt changed' };
  }
  return {
    claimed: true,
    valid: true,
    demands: [...expected.demand_identifiers],
    receipt,
  };
}

function claimsVirginiaTechBachelor(document) {
  if (!document || typeof document !== 'object') return false;
  if (text(document._id) === VIRGINIA_TECH_SOURCE_DEGREE_ID) {
    return text(document.institution_id) === VIRGINIA_TECH_SOURCE_INSTITUTION_ID;
  }
  return number(document.school_id) === VIRGINIA_TECH_SCHOOL_ID
    && text(document.va_requirement_id) === VIRGINIA_TECH_SOURCE_DEGREE_ID
    && text(document.institution_id) === `va:uni:${VIRGINIA_TECH_SCHOOL_ID}`;
}

function validateVirginiaTechAgreementIdentity(agreement) {
  const collegeId = number(agreement?.community_college_id);
  const college = institutionIdentityById(collegeId, 'community_college');
  if (!college
      || text(agreement?._id)
        !== `va:agreement:${VIRGINIA_TECH_SCHOOL_ID}:${college.id}`
      || text(agreement?.university_id) !== VIRGINIA_TECH_SOURCE_INSTITUTION_ID
      || text(agreement?.college_id) !== `va:cc:${college.slug}`
      || number(agreement?.uc_school_id) !== VIRGINIA_TECH_SCHOOL_ID
      || text(agreement?.major) !== VIRGINIA_TECH_MAJOR
      || text(agreement?.state)?.toLowerCase() !== 'va'
      || text(agreement?.source) !== VIRGINIA_TECH_AGREEMENT_SOURCE
      || text(agreement?.pairing) !== VIRGINIA_TECH_AGREEMENT_PAIRING
      || text(agreement?.derived_from?.degree_id)
        !== VIRGINIA_TECH_SOURCE_DEGREE_ID) {
    return { valid: false, reason: 'the Virginia Tech agreement identity or source provenance changed' };
  }
  return { valid: true, college };
}

function exactVirginiaTechPairEntry(entry, expected) {
  const suppliedParentId = entry?.receiving_parent_id;
  return number(entry?.course_id) === expected.course_id
    && text(entry?.course_key) === expected.course_key
    && text(entry?.code) === expected.code
    && number(entry?.units) === expected.units
    && text(entry?.identifier) === VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER
    && text(entry?.receiving_name) === VIRGINIA_TECH_CSC_PAIR_RECEIVING_NAME
    && entry?.receiving_notes_supplied === true
    && text(entry?.receiving_notes) === VIRGINIA_TECH_CSC_PAIR_NOTE
    && text(entry?.source_url) === expected.source_url
    && (entry?.receiving_parent_id_supplied !== true
      || number(suppliedParentId) === VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID);
}

/**
 * Return the two exact pool rows only when each sending-course observation is
 * unique.  A second observation, even to a different receiving endpoint or
 * with drifted display/provenance, is ambiguity rather than another permitted
 * way to establish the conditional award.
 */
function exactVirginiaTechPairEntries(entries) {
  const selected = [];
  for (const expected of VIRGINIA_TECH_CSC_PAIR_COURSES) {
    const observations = (entries || []).filter((entry) => (
      number(entry?.course_id) === expected.course_id
      && text(entry?.course_key) === expected.course_key
      && text(entry?.code) === expected.code
    ));
    if (observations.length !== 1
        || !exactVirginiaTechPairEntry(observations[0], expected)) {
      return { ready: false, reason: `the exact ${expected.code}→CS2505 source edge is missing, duplicated, or changed` };
    }
    selected.push(observations[0]);
  }
  return { ready: true, entries: selected };
}

module.exports = {
  VIRGINIA_TECH_AGREEMENT_PAIRING,
  VIRGINIA_TECH_AGREEMENT_SOURCE,
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
  VIRGINIA_TECH_MAJOR,
  VIRGINIA_TECH_SCHOOL_ID,
  VIRGINIA_TECH_SOURCE_DEGREE_ID,
  VIRGINIA_TECH_SOURCE_INSTITUTION_ID,
  atomicOptionReceipt,
  claimsVirginiaTechBachelor,
  exactVirginiaTechPairEntries,
  validateVirginiaTechAgreementIdentity,
  validateVirginiaTechAtomicOption,
};
