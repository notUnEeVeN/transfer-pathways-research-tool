const {
  usesCanonicalSourceContract,
} = require('./canonicalSourceContract');
const {
  uvaWiseRequirementRole,
} = require('./uvaWiseConstraintProofs');
const {
  virginiaTechRequirementRole,
} = require('./virginiaTechConstraintProofs');
const {
  radfordRequirementRole,
} = require('./radfordConstraintProofs');

/**
 * Canonical requirement roles are deliberately narrower than receiver kinds.
 *
 * Virginia's source-faithful tree uses `receiving.kind: ge_area` as an open
 * category carrier.  That carrier can mean actual general education, free
 * elective capacity, or a required named major slot.  Treating the carrier as
 * the role therefore changes the source.  These roles are derived only from
 * the canonical contract and authored structured fields; labels, titles,
 * receiver names, and course-code spelling are never consulted.
 */
const CANONICAL_REQUIREMENT_ROLES = Object.freeze({
  NAMED: 'named_requirement',
  GENERAL_EDUCATION: 'general_education',
  ELECTIVE_CAPACITY: 'elective_capacity',
  ZERO_UNIT: 'zero_unit_requirement',
  AMBIGUOUS: 'ambiguous',
});

const CREDIT_ROLE_MAP = Object.freeze({
  named_requirement: CANONICAL_REQUIREMENT_ROLES.NAMED,
  direct_requirement: CANONICAL_REQUIREMENT_ROLES.NAMED,
  major_requirement: CANONICAL_REQUIREMENT_ROLES.NAMED,
  general_education: CANONICAL_REQUIREMENT_ROLES.GENERAL_EDUCATION,
  ge_certification: CANONICAL_REQUIREMENT_ROLES.GENERAL_EDUCATION,
  certification_piece: CANONICAL_REQUIREMENT_ROLES.GENERAL_EDUCATION,
  elective_capacity: CANONICAL_REQUIREMENT_ROLES.ELECTIVE_CAPACITY,
  zero_unit_requirement: CANONICAL_REQUIREMENT_ROLES.ZERO_UNIT,
});

const LAYER_ROLE_MAP = Object.freeze({
  major: CANONICAL_REQUIREMENT_ROLES.NAMED,
  general_education: CANONICAL_REQUIREMENT_ROLES.GENERAL_EDUCATION,
  ge_college: CANONICAL_REQUIREMENT_ROLES.GENERAL_EDUCATION,
  electives: CANONICAL_REQUIREMENT_ROLES.ELECTIVE_CAPACITY,
});

const NONCREDIT_COURSE_LEVELS = new Set([
  'administrative',
  'noncredit_cocurricular',
  'nonunit_policy',
  'policy',
  'university_requirement',
]);
const NAMED_UNIVERSITY_COURSE_LEVELS = new Set(['mixed', 'upper_division']);

const token = (value) => String(value ?? '').trim().toLowerCase() || null;
const unique = (values) => [...new Set(values.filter(Boolean))];

function receiversOf(section) {
  return Array.isArray(section?.receivers) ? section.receivers : [];
}

function authoredValues(group, section, field, { includeReceivers = false } = {}) {
  const values = [group?.[field], section?.[field]];
  if (includeReceivers) values.push(...receiversOf(section).map((receiver) => receiver?.[field]));
  return unique(values.map(token));
}

/**
 * Only sections that a generic reader could accidentally turn into capacity
 * need an exact role at allocation time.  Ordinary course/series receivers
 * retain their direct-articulation behavior.  This keeps the classifier from
 * inventing a role for an unrelated administrative rule while still catching
 * every open carrier and every assumed-credit overlay.
 */
function requiresCanonicalRoleClassification(group, section) {
  const receivers = receiversOf(section);
  return group?.units_fill === true
    || section?.units_fill === true
    || group?.assume_satisfiable === true
    || section?.assume_satisfiable === true
    || receivers.some((receiver) => (
      receiver?.assume_satisfiable === true
      || receiver?.receiving?.kind === 'ge_area'
    ))
    || authoredValues(group, section, 'credit_role', { includeReceivers: true }).length > 0
    || authoredValues(group, section, 'course_level').includes('elective_capacity');
}

function canonicalRequirementRole(document, group, section) {
  if (!usesCanonicalSourceContract(document)) {
    return {
      applies: false,
      exact: false,
      role: null,
      issues: [],
      evidence: null,
    };
  }

  const exactInstitutionRole = uvaWiseRequirementRole(document, group, section)
    || virginiaTechRequirementRole(document, group, section)
    || radfordRequirementRole(document, group, section);
  if (exactInstitutionRole) return exactInstitutionRole;

  const layers = authoredValues(group, section, 'requirement_layer');
  const courseLevels = authoredValues(group, section, 'course_level');
  const tiers = authoredValues(group, section, 'tier');
  const articulability = unique([
    group?.cc_articulable,
    section?.cc_articulable,
    ...receiversOf(section).map((receiver) => receiver?.cc_articulable),
  ].filter((value) => typeof value === 'boolean').map(String));
  const creditRoles = authoredValues(
    group,
    section,
    'credit_role',
    { includeReceivers: true },
  );
  const unitsFill = group?.units_fill === true || section?.units_fill === true;
  const issues = [];

  if (layers.length > 1) issues.push(`conflicting_requirement_layers:${layers.join('|')}`);

  const unknownCreditRoles = creditRoles.filter((value) => !CREDIT_ROLE_MAP[value]);
  issues.push(...unknownCreditRoles.map((value) => `unknown_credit_role:${value}`));
  const mappedCreditRoles = unique(creditRoles.map((value) => CREDIT_ROLE_MAP[value]));
  if (mappedCreditRoles.length > 1) {
    issues.push(`conflicting_credit_roles:${mappedCreditRoles.join('|')}`);
  }

  // `course_level: elective_capacity` and `units_fill` are explicit capacity
  // refinements.  They outrank the broader ownership layer: a university- or
  // GE-owned remainder can still be free elective room.  Conflicting explicit
  // credit_role values fail closed rather than being silently overridden.
  const capacity = unitsFill || courseLevels.includes('elective_capacity');
  let role = mappedCreditRoles.length === 1 ? mappedCreditRoles[0] : null;
  if (capacity) {
    if (role && role !== CANONICAL_REQUIREMENT_ROLES.ELECTIVE_CAPACITY) {
      issues.push(`capacity_conflicts_with_credit_role:${role}`);
    }
    role = CANONICAL_REQUIREMENT_ROLES.ELECTIVE_CAPACITY;
  }

  if (!role && layers.length === 1) {
    role = LAYER_ROLE_MAP[layers[0]] || null;
    if (!role) {
      if (layers[0] === 'university_graduation') {
        const units = Number(section?.unit_advisement);
        const exactZero = section?.unit_advisement != null
          && Number.isFinite(units) && units === 0;
        const positiveUnits = Number.isFinite(units) && units > 0;
        const nontransferable = tiers.length === 1 && tiers[0] === 'nontransferable';
        const explicitlyNotArticulable = articulability.length === 1
          && articulability[0] === 'false';
        if (exactZero && courseLevels.length === 1
            && NONCREDIT_COURSE_LEVELS.has(courseLevels[0])
            && nontransferable && explicitlyNotArticulable) {
          role = CANONICAL_REQUIREMENT_ROLES.ZERO_UNIT;
        } else if (positiveUnits && courseLevels.length === 1
            && NAMED_UNIVERSITY_COURSE_LEVELS.has(courseLevels[0])
            && nontransferable && explicitlyNotArticulable) {
          role = CANONICAL_REQUIREMENT_ROLES.NAMED;
        } else {
          issues.push('unrefined_university_graduation_role');
        }
      } else {
        issues.push(`unknown_requirement_layer:${layers[0]}`);
      }
    }
  }
  if (!role && layers.length === 0) issues.push('requirement_layer_required');

  // A zero-unit role is a designation/overlap, never hidden positive credit.
  // Zero itself is not used to infer the role; it merely validates an authored
  // role so an omitted unit figure cannot make a real requirement disappear.
  if (role === CANONICAL_REQUIREMENT_ROLES.ZERO_UNIT) {
    const units = Number(section?.unit_advisement);
    if (section?.unit_advisement != null && (!Number.isFinite(units) || units !== 0)) {
      issues.push('zero_unit_role_requires_exact_zero_units');
    }
  }

  return {
    applies: true,
    exact: issues.length === 0 && Boolean(role),
    role: issues.length === 0 && role ? role : CANONICAL_REQUIREMENT_ROLES.AMBIGUOUS,
    issues: [...new Set(issues)],
    evidence: {
      requirement_layers: layers,
      course_levels: courseLevels,
      tiers,
      cc_articulable: articulability,
      credit_roles: creditRoles,
      units_fill: unitsFill,
      ge_area_receivers: receiversOf(section)
        .filter((receiver) => receiver?.receiving?.kind === 'ge_area').length,
      assume_satisfiable: Boolean(
        group?.assume_satisfiable
        || section?.assume_satisfiable
        || receiversOf(section).some((receiver) => receiver?.assume_satisfiable),
      ),
    },
  };
}

function canonicalRequirementRoleIssues(document) {
  if (!usesCanonicalSourceContract(document)) return [];
  const issues = [];
  for (const [groupIndex, group] of (document?.requirement_groups || []).entries()) {
    for (const [sectionIndex, section] of (group?.sections || []).entries()) {
      if (!requiresCanonicalRoleClassification(group, section)) continue;
      const classification = canonicalRequirementRole(document, group, section);
      if (classification.exact) continue;
      issues.push({
        path: `requirement_groups[${groupIndex}].sections[${sectionIndex}]`,
        issues: classification.issues,
        evidence: classification.evidence,
      });
    }
  }
  return issues;
}

module.exports = {
  CANONICAL_REQUIREMENT_ROLES,
  canonicalRequirementRole,
  canonicalRequirementRoleIssues,
  requiresCanonicalRoleClassification,
};
