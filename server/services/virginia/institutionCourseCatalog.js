/**
 * Build source-backed course rows from a canonical degree document.
 *
 * A title from the owning catalog establishes identity. Units are stricter:
 * they are emitted only when a section selects one receiver, every alternative
 * is exactly one course, and every observation of that course agrees. Bundled
 * routes (for example CSCI222 + MATH254 for 7 credits) deliberately remain
 * unresolved because dividing their total would be an invented fact.
 */
const {
  courseIdentityForNamespace,
  isInstitutionLocalNamespace,
  parseCourseKey,
} = require('./courseIdentity');

const finite = (value) => value != null && value !== '' && Number.isFinite(Number(value));

/**
 * Emit identities named by one degree even when the Transfer Virginia course
 * registry has no row for them. With no namespace, identities remain the VCCS
 * shared-master `va:CODE`; an explicit local namespace emits owner+code rows.
 *
 * `requirement_owner_id` records which degree owner supplied the evidence. It
 * intentionally differs from `institution_id` for shared courses: the former
 * is a college, while the latter remains the common `va:vccs` namespace.
 */
function documentCourseCatalog({
  codes = [],
  courseTitles = {},
  requirementGroups = [],
  unitEvidence = [],
  namespace = null,
  requirementOwnerId = namespace?.institution_id ?? null,
  sourceDocumentId = null,
  sourceRefs = [],
} = {}) {
  const evidence = new Map();
  const explicitUnitCodes = new Set();
  const entryFor = (code) => {
    if (!evidence.has(code)) evidence.set(code, { units: [], unitsMax: [], sourceRefs: new Set() });
    return evidence.get(code);
  };

  // Preserve exact course rows captured from an official page even when the
  // compiled degree represents them inside a multi-course bundle. The bundle
  // total alone cannot safely be divided; an explicit "Credits: N" row can.
  for (const observation of unitEvidence || []) {
    let expected;
    try {
      const parsed = parseCourseKey(observation?.course_key);
      expected = parsed
        ? courseIdentityForNamespace(parsed.code, namespace)
        : courseIdentityForNamespace(observation?.code, namespace);
    } catch (_) {
      expected = null;
    }
    if (!expected
        || (observation?.course_id != null
          && Number(observation.course_id) !== expected.course_id)
        || (observation?.course_key != null
          && observation.course_key !== expected.course_key)) continue;
    const min = finite(observation?.min_units) ? Number(observation.min_units)
      : finite(observation?.units) ? Number(observation.units) : null;
    const max = finite(observation?.max_units) ? Number(observation.max_units) : min;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) continue;
    const row = entryFor(expected.code);
    row.units.push(min);
    row.unitsMax.push(max);
    explicitUnitCodes.add(expected.code);
    for (const ref of observation?.source_refs || []) row.sourceRefs.add(ref);
  }

  for (const group of requirementGroups || []) {
    for (const section of group?.sections || []) {
      const receivers = section?.receivers || [];
      for (const receiver of receivers) {
        const options = receiver?.options || [];
        const parsedOptions = options.map((option) => (option?.course_keys || [])
          .map(parseCourseKey)
          .filter((identity) => {
            if (!identity) return false;
            const expected = courseIdentityForNamespace(identity.code, namespace);
            return expected?.course_id === identity.course_id
              && expected?.course_key === identity.course_key;
          }));
        // A requirement slot such as "MTH 264 or MTH 245 — 4 credits" does
        // not prove that each alternative is a four-credit course.  Treat the
        // compiled section total as course-level evidence only when the slot
        // has one option containing one course.  Multi-option menus need a
        // direct extracted/reviewed course row in `unitEvidence`.
        const exactSingleCourseMenu = section.section_advisement === 1
          && receivers.length === 1
          && parsedOptions.length === 1
          && parsedOptions.every((identities) => identities.length === 1);
        for (const identities of parsedOptions) {
          for (const identity of identities) {
            const evidenceForCode = entryFor(identity.code);
            for (const ref of [
              ...(group.source_refs || []),
              ...(section.source_refs || []),
            ]) {
              evidenceForCode.sourceRefs.add(ref);
            }
            // A source row that states this course's own credits is stronger
            // than a compiled requirement range.  The latter often combines
            // alternatives with different credits (for example, a 3-4 credit
            // approved-elective menu); counting both would turn exact source
            // evidence into a manufactured conflict.
            if (exactSingleCourseMenu
                && !explicitUnitCodes.has(identity.code)
                && finite(section.unit_advisement)) {
              evidenceForCode.units.push(Number(section.unit_advisement));
              evidenceForCode.unitsMax.push(finite(section.unit_advisement_max)
                ? Number(section.unit_advisement_max)
                : Number(section.unit_advisement));
            }
          }
        }
      }
    }
  }

  const allCodes = [...new Set([
    ...(codes || []),
    ...evidence.keys(),
  ])].sort();
  return allCodes.map((code) => {
    const identity = courseIdentityForNamespace(code, namespace);
    if (!identity) return null;
    const observations = evidence.get(identity.code) || {
      units: [], unitsMax: [], sourceRefs: new Set(),
    };
    const uniqueMin = [...new Set(observations.units)];
    const uniqueMax = [...new Set(observations.unitsMax)];
    const exact = uniqueMin.length === 1 && uniqueMax.length === 1;
    const conflicting = uniqueMin.length > 1 || uniqueMax.length > 1;
    return {
      ...identity,
      requirement_owner_id: requirementOwnerId,
      source_document_id: sourceDocumentId,
      identity_source: 'degree_document',
      title: courseTitles?.[identity.code] ?? null,
      units: exact ? uniqueMin[0] : null,
      min_units: exact ? uniqueMin[0] : null,
      max_units: exact ? uniqueMax[0] : null,
      unit_evidence: exact
        ? 'single_course_source_section'
        : conflicting ? 'conflicting_source_sections' : 'not_individually_stated',
      unit_observations: uniqueMin,
      unit_max_observations: uniqueMax,
      source_refs: [...new Set([
        ...(sourceRefs || []),
        ...observations.sourceRefs,
      ])].sort(),
    };
  }).filter(Boolean);
}

/** Backward-compatible local-only wrapper used by the catalog importer. */
function institutionCourseCatalog(options = {}) {
  if (!isInstitutionLocalNamespace(options.namespace)) return [];
  return documentCourseCatalog(options);
}

module.exports = {
  documentCourseCatalog,
  institutionCourseCatalog,
};
