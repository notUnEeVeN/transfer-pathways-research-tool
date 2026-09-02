/**
 * Stable course identities shared by every Virginia importer and API response.
 *
 * Virginia does not publish ASSIST-style numeric course ids, so the Virginia
 * corpus mints them deterministically. VCCS common courses use the statewide
 * code. Institution-local courses (including every four-year receiving
 * course) use owner + code: the same printed code is not a shared course when
 * two universities publish different titles or credits for it.
 */
const { createHash } = require('node:crypto');

const VA_ID_BASE = 900000000;
// Keep owner-scoped identities in a disjoint numeric range.  The shared
// analysis schema still expects numeric `course_id` values, so a prefixed
// string is not available here; reserving a range makes it impossible for a
// local catalog course to equal the legacy code-only VCCS id by construction.
const VA_LOCAL_ID_BASE = 1200000000;
const VA_ID_SPAN = 0x0fffffff;
const VCCS_SHARED_OWNER = 'va:vccs';
const VA_INSTITUTION_OWNER = /^va:(?:cc|uni):[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Most Virginia catalogs use an optional single lab/writing suffix, but VMI's
// current catalog has the concrete course CIS 231WX. Keep the grammar narrow
// while allowing that legitimate two-letter attribute suffix.
const CANONICAL_COURSE_CODE = /^[A-Z]{2,5}\d{2,4}[A-Z]{0,2}$/;
const PLACEHOLDER_COURSE_CODE = /^(?:X{2,5}0{2,4}|[A-Z]{2,5}0{3,4})$/;
const NON_COURSE_LANDING_NAME = /\b(?:elective|transfer|placeholder)\b|\b(?:general\s+(?:course\s+)?|no\s+|collegiate\s+|major\s+)credit\b|^general education$/i;

// Identity normalization is intentionally smaller than the catalog parser's
// `normCode`: that parser also repairs Acalog cell-gluing artifacts, which
// would misread a legitimate code such as ITE119 as TE119. Importers hand this
// helper an already-extracted code; only printed separators belong here.
const canonicalCourseCode = (code) => String(code ?? '')
  .replace(/\s*[-–—]\s*/g, '')
  .replace(/\s+/g, '')
  .toUpperCase();

function courseIdFor(code) {
  const canonical = canonicalCourseCode(code);
  // Transfer Virginia also publishes buckets such as TRNS1XX and CS----.
  // Those describe elective credit, not a university catalog course, and
  // must not receive a made-up parent_id that could be used in a degree.
  if (!CANONICAL_COURSE_CODE.test(canonical) || PLACEHOLDER_COURSE_CODE.test(canonical)) return null;
  return VA_ID_BASE
    + (createHash('sha1').update(`va:${canonical}`).digest().readUInt32BE(0) % VA_ID_SPAN);
}

function courseKeyFor(code) {
  const canonical = canonicalCourseCode(code);
  return courseIdFor(canonical) != null ? `va:${canonical}` : null;
}

function canonicalCourseOwner(owner) {
  const canonical = String(owner || '').trim().toLowerCase();
  if (!VA_INSTITUTION_OWNER.test(canonical)) {
    throw new Error(`invalid Virginia institution course owner: ${owner || '<missing>'}`);
  }
  return canonical;
}

/**
 * Numeric identity for a course whose code belongs to one institution rather
 * than the VCCS common-course namespace.
 *
 * Richard Bland is the first concrete caller: its MATH251 is Calculus I while
 * JMU's same printed code is Database Queries.  Hashing only `MATH251` makes a
 * database join silently select whichever row happened to win.  Owner + code
 * is therefore the minimum safe identity.
 */
function institutionCourseIdFor(owner, code) {
  const canonical = canonicalCourseCode(code);
  if (!CANONICAL_COURSE_CODE.test(canonical) || PLACEHOLDER_COURSE_CODE.test(canonical)) return null;
  const institution = canonicalCourseOwner(owner);
  return VA_LOCAL_ID_BASE
    + (createHash('sha1').update(`va-local:${institution}:${canonical}`).digest().readUInt32BE(0) % VA_ID_SPAN);
}

function institutionCourseKeyFor(owner, code) {
  const canonical = canonicalCourseCode(code);
  return institutionCourseIdFor(owner, canonical) != null
    ? `${canonicalCourseOwner(owner)}:${canonical}`
    : null;
}

/**
 * Expected receiving id for either a source tree or its canonical projection.
 * Only the numeric canonical university owner marks a projected document;
 * slug-owned source/composition trees retain their legacy code-only ids.
 */
function receivingCourseIdForDocument(document, code) {
  const owner = String(document?.institution_id || '').trim().toLowerCase();
  return /^va:uni:\d+$/.test(owner)
    ? institutionCourseIdFor(owner, code)
    : courseIdFor(code);
}

const receivingCodeParts = (value) => String(value ?? '')
  .split(/\s*\+\s*|\s+and\s+/i)
  .map((part) => canonicalCourseCode(part))
  .filter(Boolean);

/**
 * Resolve a concrete receiving wrapper to exact source and projected ids.
 *
 * Source Virginia requirement trees predate the shared-schema projection and
 * carry code-only ids. Projection is the only boundary allowed to replace
 * those ids. Fail closed when a wrapper's id does not match its printed code;
 * position alone is not enough evidence for reminting a series.
 */
function institutionReceivingCourseRefs(receiver, owner) {
  const receiving = receiver?.receiving;
  if (!receiving || !['course', 'series'].includes(receiving.kind)) return [];
  const sourceIds = receiving.kind === 'series'
    ? (Array.isArray(receiving.parent_ids) ? receiving.parent_ids : [])
    : [receiving.parent_id].filter((value) => value != null);
  if (!sourceIds.length) return [];
  const codes = receivingCodeParts(receiver?.code_seen);
  if (codes.length !== sourceIds.length) {
    throw new Error(
      `Virginia receiving identity arity mismatch for ${receiver?.code_seen || '<missing code>'}: `
        + `${codes.length} code(s), ${sourceIds.length} id(s)`,
    );
  }
  return codes.map((code, index) => {
    const sourceParentId = Number(sourceIds[index]);
    const legacyParentId = courseIdFor(code);
    const parentId = institutionCourseIdFor(owner, code);
    if (!Number.isInteger(sourceParentId) || legacyParentId == null || parentId == null
        || ![legacyParentId, parentId].includes(sourceParentId)) {
      throw new Error(
        `Virginia receiving identity mismatch for ${canonicalCourseOwner(owner)} ${code}: `
          + `source ${sourceIds[index]}, expected ${legacyParentId}`,
      );
    }
    return {
      code,
      source_parent_id: sourceParentId,
      parent_id: parentId,
      course_key: institutionCourseKeyFor(owner, code),
    };
  });
}

/** Clone a requirement tree and owner-scope only its concrete receiver ids. */
function projectInstitutionReceivingGroups(groups, owner) {
  const projected = structuredClone(Array.isArray(groups) ? groups : []);
  for (const group of projected) {
    for (const section of group?.sections || []) {
      for (const receiver of section?.receivers || []) {
        const refs = institutionReceivingCourseRefs(receiver, owner);
        if (!refs.length) continue;
        if (receiver.receiving.kind === 'series') {
          receiver.receiving.parent_ids = refs.map((ref) => ref.parent_id);
        } else {
          receiver.receiving.parent_id = refs[0].parent_id;
        }
      }
    }
  }
  return projected;
}

function sharedCourseIdentity(code) {
  const canonical = canonicalCourseCode(code);
  const courseId = courseIdFor(canonical);
  if (courseId == null) return null;
  return {
    code: canonical,
    course_id: courseId,
    course_key: courseKeyFor(canonical),
    institution_id: VCCS_SHARED_OWNER,
    identity_scope: 'vccs_shared',
    identity_contract: 'vccs_master_course_code',
    vccs_master_applicable: true,
  };
}

function institutionCourseIdentity(owner, code) {
  const canonical = canonicalCourseCode(code);
  const courseId = institutionCourseIdFor(owner, canonical);
  if (courseId == null) return null;
  const institution = canonicalCourseOwner(owner);
  return {
    code: canonical,
    course_id: courseId,
    course_key: institutionCourseKeyFor(institution, canonical),
    institution_id: institution,
    identity_scope: 'institution_local',
    identity_contract: 'owner_plus_course_id',
    vccs_master_applicable: false,
  };
}

function isInstitutionLocalNamespace(namespace) {
  return Boolean(namespace
    && namespace.kind === 'institution_local'
    && namespace.vccs_master_applicable === false
    && namespace.identity_contract === 'owner_plus_course_id'
    && VA_INSTITUTION_OWNER.test(String(namespace.institution_id || '').toLowerCase())
    && namespace.scoped_key_format === `${String(namespace.institution_id).toLowerCase()}:<code>`);
}

/** Resolve a composition namespace to the only identity it is allowed to use. */
function courseIdentityForNamespace(code, namespace = null) {
  if (namespace == null) return sharedCourseIdentity(code);
  if (!isInstitutionLocalNamespace(namespace)) {
    throw new Error('invalid Virginia institution-local course namespace');
  }
  return institutionCourseIdentity(namespace.institution_id, code);
}

/** Parse either `va:CODE` or `va:<side>:<owner>:CODE` without guessing. */
function parseCourseKey(value) {
  const key = String(value || '').trim();
  const shared = /^va:([A-Z]{2,5}\d{2,4}[A-Z]{0,2})$/.exec(key);
  if (shared) {
    const identity = sharedCourseIdentity(shared[1]);
    return identity && identity.course_key === key ? identity : null;
  }
  const local = /^(va:(?:cc|uni):[a-z0-9]+(?:-[a-z0-9]+)*):([A-Z]{2,5}\d{2,4}[A-Z]{0,2})$/.exec(key);
  if (!local) return null;
  const identity = institutionCourseIdentity(local[1], local[2]);
  return identity && identity.course_key === key ? identity : null;
}

/**
 * Strict row/reference match used by import preflights and read-only audits.
 * Local references require an owner-labelled local row; a same-code shared row
 * is intentionally not a fallback.
 */
function courseRowMatchesIdentity(row, identity) {
  if (!row || !identity) return false;
  return Number(row.course_id) === Number(identity.course_id)
    && row.course_key === identity.course_key
    && row.institution_id === identity.institution_id
    && row.identity_scope === identity.identity_scope
    && row.identity_contract === identity.identity_contract
    && row.vccs_master_applicable === identity.vccs_master_applicable;
}

/** A receiving id only for a concrete university catalog course landing. */
function parentIdForLanding(landing) {
  const parentId = courseIdFor(landing?.identifier);
  if (parentId == null || NON_COURSE_LANDING_NAME.test(String(landing?.name || '').trim())) return null;
  return parentId;
}

module.exports = {
  VA_ID_BASE,
  VA_LOCAL_ID_BASE,
  VCCS_SHARED_OWNER,
  canonicalCourseCode,
  canonicalCourseOwner,
  courseIdFor,
  courseKeyFor,
  institutionCourseIdFor,
  institutionCourseKeyFor,
  receivingCourseIdForDocument,
  institutionReceivingCourseRefs,
  projectInstitutionReceivingGroups,
  sharedCourseIdentity,
  institutionCourseIdentity,
  isInstitutionLocalNamespace,
  courseIdentityForNamespace,
  parseCourseKey,
  courseRowMatchesIdentity,
  parentIdForLanding,
};
