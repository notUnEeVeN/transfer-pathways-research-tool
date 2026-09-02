/**
 * Exact Virginia residency and transfer-credit policy evaluation for Figures 3/4.
 *
 * This module never parses a catalog sentence. Numeric limits come only from
 * `total_units` and the structured `unit_audit` fields. The source-profile
 * inventory records which additional policy dimensions the verified catalog
 * composition contains. A numeric overall cap is useful evidence, but it does
 * not make a policy executable while a potentially binding major, final-window,
 * upper-level, semester, waiver, or exception rule remains unmodelled.
 *
 * The Figure 3/4 pathway has one important, explicit sequencing invariant: all
 * community-college credit is earned before the modeled university segment.
 * That makes a structured final-window residence minimum enforceable as a
 * transfer ceiling. It does not make a major-residence rule enforceable because
 * the shared allocation state does not identify which applied units belong to
 * the major.
 */

const EPSILON = 1e-7;
const EVALUATOR = 'evaluateVirginiaResidencyTransferPolicy';
const EVALUATOR_VERSION = 1;
const {
  evaluateBridgewaterResidencyPolicy,
} = require('./bridgewaterConstraintProofs');
const {
  evaluateCnuResidencyPolicy,
} = require('./christopherNewportConstraintProofs');
const {
  evaluateGmuResidencyPolicy,
  evaluateOduResidencyPolicy,
} = require('./georgeMasonOldDominionConstraintProofs');
const {
  evaluateUmwResidencyPolicy,
  evaluateWmResidencyPolicy,
} = require('./maryWashingtonWilliamMaryConstraintProofs');
const {
  evaluateLongwoodResidencyPolicy,
} = require('./longwoodConstraintProofs');
const {
  evaluateNorfolkStateResidencyPolicy,
} = require('./norfolkStateConstraintProofs');
const {
  evaluateUvaWiseResidencyPolicy,
} = require('./uvaWiseConstraintProofs');
const {
  evaluateVcuResidencyPolicy,
} = require('./vcuConstraintProofs');
const {
  evaluateVirginiaTechResidencyPolicy,
} = require('./virginiaTechConstraintProofs');

const POLICY_DETAIL_FIELDS = Object.freeze([
  'final_credit_window_units',
  'final_credit_window_residency_units_minimum',
  'final_thirty_resident_units_minimum',
  'four_year_institution_units_minimum',
  'major_residency_fraction_minimum',
  'major_residency_units_minimum',
  'major_upper_division_residency_minimum',
  'major_upper_level_residency_minimum',
  'residency_exact_units_at_25_percent',
  'residency_minimum_percent',
  'resident_semesters_minimum',
  'senior_residency_transfer_units_maximum',
  'senior_residency_derived_institution_units_minimum',
  'senior_residency_window_units',
  'transfer_and_external_credit_units_maximum',
  'transfer_credit_units_maximum',
  'two_year_transfer_maximum_percent',
  'two_year_transfer_units_maximum',
]);

/**
 * Exhaustive policy inventory for the 16 configured Virginia bachelor columns.
 *
 * `runtime_ready` means every residency/transfer dimension in the verified
 * composition is represented by numeric fields this evaluator enforces. It is
 * deliberately independent of the many other requirement-tree blockers.
 */
const ACTIVE_POLICY_PROFILES = Object.freeze({
  'bridgewater-college': Object.freeze({
    declared_subrules: ['overall_residency', 'final_window_residency', 'major_residency_units'],
    required_fields: ['final_credit_window_units', 'final_credit_window_residency_units_minimum', 'major_residency_units_minimum'],
    blocker: 'the shared allocation state does not identify resident units inside the major',
  }),
  'christopher-newport-university': Object.freeze({
    declared_subrules: ['overall_residency', 'final_window_residency', 'final_window_major_residency'],
    required_fields: [],
    blocker: 'the final-window and final-major residence limits are not stored as structured numeric fields',
  }),
  'george-mason-university': Object.freeze({
    declared_subrules: ['overall_residency', 'major_upper_level_residency'],
    required_fields: [],
    blocker: 'the upper-level major residence minimum is not stored as a structured numeric field',
  }),
  'james-madison-university': Object.freeze({
    declared_subrules: ['overall_residency', 'four_year_institution_minimum'],
    required_fields: ['four_year_institution_units_minimum'],
    runtime_ready: true,
  }),
  'longwood-university': Object.freeze({
    declared_subrules: ['overall_residency', 'all_upper_division_in_residence'],
    required_fields: [],
    blocker: 'the all-upper-division residence rule is not stored as an enforceable scoped numeric field',
  }),
  'norfolk-state-university': Object.freeze({
    declared_subrules: ['overall_residency', 'resident_semesters', 'senior_curriculum_residency'],
    required_fields: ['resident_semesters_minimum'],
    blocker: 'semester duration and the senior-year curriculum are not represented in the credit-allocation state',
  }),
  'old-dominion-university': Object.freeze({
    declared_subrules: ['overall_residency', 'major_upper_division_residency', 'writing_intensive_residency'],
    required_fields: ['major_upper_division_residency_minimum'],
    blocker: 'major-scoped and writing-intensive resident credit are not represented in the allocation state',
  }),
  'radford-university': Object.freeze({
    declared_subrules: ['overall_residency'],
    required_fields: [],
    runtime_ready: true,
  }),
  'randolph-macon-college': Object.freeze({
    declared_subrules: ['overall_residency', 'overall_transfer_cap', 'major_residency_fraction'],
    required_fields: ['transfer_and_external_credit_units_maximum', 'major_residency_fraction_minimum'],
    blocker: 'the shared allocation state does not identify the resident fraction of major coursework',
  }),
  'shenandoah-university': Object.freeze({
    declared_subrules: ['overall_residency', 'overall_transfer_cap', 'final_window_residency'],
    required_fields: ['transfer_credit_units_maximum', 'final_thirty_resident_units_minimum'],
    runtime_ready: true,
  }),
  'the-university-of-virginia-s-college-at-wise': Object.freeze({
    declared_subrules: ['overall_residency', 'four_year_institution_minimum', 'two_year_transfer_cap', 'major_upper_level_residency'],
    required_fields: ['four_year_institution_units_minimum', 'two_year_transfer_units_maximum', 'major_upper_level_residency_minimum'],
    blocker: 'major-scoped upper-level resident credit is not represented in the allocation state',
  }),
  'university-of-mary-washington': Object.freeze({
    declared_subrules: ['overall_residency', 'major_residency_fraction', 'final_window_residency', 'military_waiver'],
    required_fields: [],
    blocker: 'the major fraction, final-window limit, and waiver are not stored as executable structured fields',
  }),
  'virginia-commonwealth-university': Object.freeze({
    declared_subrules: ['overall_residency', 'final_window_residency', 'published_exceptions'],
    required_fields: [],
    blocker: 'the final-window limit and published exceptions are not stored as executable structured fields',
  }),
  'virginia-polytechnic-institute-and-state-university': Object.freeze({
    declared_subrules: ['overall_residency', 'final_window_transfer_cap', 'two_year_transfer_percentage_cap'],
    required_fields: [
      'residency_minimum_percent',
      'residency_exact_units_at_25_percent',
      'senior_residency_window_units',
      'senior_residency_transfer_units_maximum',
      'senior_residency_derived_institution_units_minimum',
      'two_year_transfer_maximum_percent',
    ],
    runtime_ready: true,
  }),
  'virginia-state-university': Object.freeze({
    declared_subrules: ['none_stated'],
    required_fields: [],
    runtime_ready: true,
  }),
  'william-mary': Object.freeze({
    declared_subrules: [
      'overall_residency', 'major_residency_units',
      'major_course_count_fraction', 'external_upper_major_course_maximum',
    ],
    required_fields: [],
    blocker: 'the major-unit, major-course-count, and external-upper-course limits require the exact William & Mary source/tree proof',
  }),
});

const ACTIVE_VA_RESIDENCY_POLICY_IDS = Object.freeze(Object.keys(ACTIVE_POLICY_PROFILES));

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const nonnegative = (value) => {
  const number = finite(value);
  return number != null && number >= 0 ? number : null;
};
const positive = (value) => {
  const number = finite(value);
  return number != null && number > 0 ? number : null;
};
const close = (left, right) => Math.abs(Number(left) - Number(right)) <= EPSILON;
const unique = (values) => [...new Set(values.filter((value) => value != null))];

function sourcePolicyId(doc) {
  const raw = String(
    doc?.va_requirement_id
      || doc?.institution_id
      || doc?.slug
      || doc?._id
      || '',
  ).trim();
  if (/^va:degree:[^:]+:cs$/.test(raw)) return raw.split(':')[2];
  if (/^va:uni:[^:]+$/.test(raw)) return raw.slice('va:uni:'.length);
  if (ACTIVE_POLICY_PROFILES[raw]) return raw;
  return null;
}

function declarationStatus(value) {
  return String(value?.status || '').trim().toLowerCase();
}

function policyFieldInventory(doc) {
  const audit = doc?.unit_audit && typeof doc.unit_audit === 'object'
    ? doc.unit_audit : {};
  const fields = Object.fromEntries(POLICY_DETAIL_FIELDS
    .filter((field) => Object.prototype.hasOwnProperty.call(audit, field))
    .map((field) => [field, audit[field]]));
  const unclassified = Object.keys(audit).filter((field) => (
    !POLICY_DETAIL_FIELDS.includes(field)
      && field !== 'residency'
      && /(?:residency|resident|four_year_institution|two_year_transfer|final_(?:credit|thirty)|senior_residency|transfer_(?:and_external_)?credit_units_maximum)/i.test(field)
  ));
  return { fields, unclassified_fields: unclassified.sort() };
}

function percentage(value, path, issues) {
  const number = finite(value);
  if (number == null || number <= 0 || number > 100) {
    issues.push(`${path} must be a numeric percentage greater than 0 and no more than 100`);
    return null;
  }
  return number;
}

function reconcileEquivalentCaps(candidates, label, issues) {
  const usable = candidates.filter((candidate) => candidate.units != null);
  if (!usable.length) return null;
  const first = usable[0].units;
  if (usable.some((candidate) => !close(candidate.units, first))) {
    issues.push(`${label} declarations disagree (${usable.map((candidate) => (
      `${candidate.source}=${candidate.units}`
    )).join(', ')})`);
  }
  return Math.min(...usable.map((candidate) => candidate.units));
}

/**
 * Derive every numeric cap without deciding whether the entire source policy is
 * executable. Callers can inspect a partial cap even when `issues` is nonempty;
 * publication/runtime capability is decided by the stricter evaluator below.
 */
function deriveVirginiaTransferCaps(doc) {
  const audit = doc?.unit_audit && typeof doc.unit_audit === 'object'
    ? doc.unit_audit : {};
  const residency = audit.residency && typeof audit.residency === 'object'
    ? audit.residency : {};
  const status = declarationStatus(residency);
  const total = positive(doc?.total_units);
  const issues = [];
  const evidence = [];

  if (total == null) issues.push('total_units must be a positive numeric source field');
  if (!['required', 'none_stated', 'not_applicable'].includes(status)) {
    issues.push('unit_audit.residency must declare required, none_stated, or not_applicable');
  }

  const inventory = policyFieldInventory(doc);
  for (const field of inventory.unclassified_fields) {
    issues.push(`unit_audit.${field} is an unclassified residency/transfer policy field`);
  }

  if (status === 'none_stated' || status === 'not_applicable') {
    if (Object.keys(inventory.fields).length) {
      issues.push('a no-rule residency declaration conflicts with active numeric residency/transfer fields');
    }
    return {
      status,
      degree_total_units: total,
      overall_transfer_cap_units: null,
      two_year_transfer_cap_units: null,
      final_window_transfer_cap_units: null,
      effective_two_year_transfer_cap_units: null,
      evidence,
      inventory,
      issues,
    };
  }

  const explicitMinimum = positive(residency.minimum_units);
  const fraction = finite(residency.minimum_fraction);
  if (fraction != null && (fraction <= 0 || fraction > 1)) {
    issues.push('unit_audit.residency.minimum_fraction must be greater than 0 and no more than 1');
  }
  const percent = Object.prototype.hasOwnProperty.call(audit, 'residency_minimum_percent')
    ? percentage(audit.residency_minimum_percent, 'unit_audit.residency_minimum_percent', issues)
    : null;
  if (fraction != null && percent != null && !close(fraction * 100, percent)) {
    issues.push('residency minimum fraction and percentage declarations disagree');
  }
  const proportionalMinimum = total == null ? null
    : (fraction != null && fraction > 0 && fraction <= 1 ? total * fraction
      : (percent != null ? total * percent / 100 : null));
  if (explicitMinimum == null && proportionalMinimum == null) {
    issues.push('required residency lacks a numeric minimum_units, minimum_fraction, or residency_minimum_percent');
  }
  if (explicitMinimum != null && proportionalMinimum != null) {
    const wholeCreditMinimum = Math.ceil(proportionalMinimum - EPSILON);
    if (!close(explicitMinimum, wholeCreditMinimum)) {
      issues.push(`residency minimum ${explicitMinimum} disagrees with the whole-credit percentage minimum ${wholeCreditMinimum}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(audit, 'residency_exact_units_at_25_percent')) {
    const exact = positive(audit.residency_exact_units_at_25_percent);
    const declaredPercent = percent ?? (fraction != null ? fraction * 100 : null);
    if (exact == null || total == null || declaredPercent == null
        || !close(exact, total * declaredPercent / 100)) {
      issues.push('residency_exact_units_at_25_percent does not match the declared degree percentage');
    }
  }
  const residencyMinimum = explicitMinimum ?? proportionalMinimum;
  const derivedOverallCap = total != null && residencyMinimum != null
    ? total - residencyMinimum : null;
  if (derivedOverallCap != null && derivedOverallCap < -EPSILON) {
    issues.push('residency minimum exceeds the degree total');
  }
  if (derivedOverallCap != null) {
    evidence.push({ source: 'total_units - exact residency minimum', units: derivedOverallCap });
  }

  const overallCandidates = [{
    source: 'total_units - residency minimum',
    units: derivedOverallCap,
  }];
  for (const field of [
    'transfer_credit_units_maximum',
    'transfer_and_external_credit_units_maximum',
  ]) {
    if (!Object.prototype.hasOwnProperty.call(audit, field)) continue;
    const value = nonnegative(audit[field]);
    if (value == null) issues.push(`unit_audit.${field} must be a nonnegative numeric cap`);
    else {
      overallCandidates.push({ source: `unit_audit.${field}`, units: value });
      evidence.push({ source: `unit_audit.${field}`, units: value });
    }
  }
  const overallCap = reconcileEquivalentCaps(
    overallCandidates,
    'overall residency/transfer cap',
    issues,
  );

  const twoYearCandidates = [];
  if (Object.prototype.hasOwnProperty.call(audit, 'two_year_transfer_units_maximum')) {
    const value = nonnegative(audit.two_year_transfer_units_maximum);
    if (value == null) issues.push('unit_audit.two_year_transfer_units_maximum must be a nonnegative numeric cap');
    else twoYearCandidates.push({ source: 'unit_audit.two_year_transfer_units_maximum', units: value });
  }
  if (Object.prototype.hasOwnProperty.call(audit, 'four_year_institution_units_minimum')) {
    const minimum = nonnegative(audit.four_year_institution_units_minimum);
    if (minimum == null || total == null || minimum > total + EPSILON) {
      issues.push('unit_audit.four_year_institution_units_minimum must fit inside total_units');
    } else {
      twoYearCandidates.push({
        source: 'total_units - unit_audit.four_year_institution_units_minimum',
        units: total - minimum,
      });
    }
  }
  if (Object.prototype.hasOwnProperty.call(audit, 'two_year_transfer_maximum_percent')) {
    const capPercent = percentage(
      audit.two_year_transfer_maximum_percent,
      'unit_audit.two_year_transfer_maximum_percent',
      issues,
    );
    if (capPercent != null && total != null) {
      twoYearCandidates.push({
        source: 'total_units * unit_audit.two_year_transfer_maximum_percent',
        units: total * capPercent / 100,
      });
    }
  }
  const explicitTwoYear = twoYearCandidates.find((candidate) => (
    candidate.source === 'unit_audit.two_year_transfer_units_maximum'
  ));
  const fourYearDerived = twoYearCandidates.find((candidate) => (
    candidate.source.startsWith('total_units - unit_audit.four_year')
  ));
  if (explicitTwoYear && fourYearDerived && !close(explicitTwoYear.units, fourYearDerived.units)) {
    issues.push(`two-year transfer declarations disagree (${explicitTwoYear.units} versus ${fourYearDerived.units})`);
  }
  const twoYearCap = twoYearCandidates.length
    ? Math.min(...twoYearCandidates.map((candidate) => candidate.units)) : null;
  evidence.push(...twoYearCandidates);

  const finalCandidates = [];
  const hasFinalWindow = Object.prototype.hasOwnProperty.call(audit, 'final_credit_window_units');
  const hasFinalMinimum = Object.prototype.hasOwnProperty.call(
    audit, 'final_credit_window_residency_units_minimum',
  );
  if (hasFinalWindow !== hasFinalMinimum) {
    issues.push('final-credit-window residency requires both window and resident-minimum fields');
  } else if (hasFinalWindow) {
    const window = positive(audit.final_credit_window_units);
    const minimum = nonnegative(audit.final_credit_window_residency_units_minimum);
    if (window == null || minimum == null || minimum > window + EPSILON) {
      issues.push('final-credit-window resident minimum must fit inside its positive window');
    } else if (total != null) {
      finalCandidates.push({
        source: 'final_credit_window_residency_units_minimum',
        units: total - minimum,
      });
    }
  }
  if (Object.prototype.hasOwnProperty.call(audit, 'final_thirty_resident_units_minimum')) {
    const minimum = nonnegative(audit.final_thirty_resident_units_minimum);
    if (minimum == null || minimum > 30 + EPSILON) {
      issues.push('final_thirty_resident_units_minimum must be between 0 and 30');
    } else if (total != null) {
      finalCandidates.push({
        source: 'final_thirty_resident_units_minimum',
        units: total - minimum,
      });
    }
  }

  const seniorFields = [
    'senior_residency_window_units',
    'senior_residency_transfer_units_maximum',
    'senior_residency_derived_institution_units_minimum',
  ];
  const presentSenior = seniorFields.filter((field) => Object.prototype.hasOwnProperty.call(audit, field));
  if (presentSenior.length && presentSenior.length !== seniorFields.length) {
    issues.push(`senior-window residency requires all of ${seniorFields.join(', ')}`);
  } else if (presentSenior.length === seniorFields.length) {
    const window = positive(audit.senior_residency_window_units);
    const transfer = nonnegative(audit.senior_residency_transfer_units_maximum);
    const resident = nonnegative(audit.senior_residency_derived_institution_units_minimum);
    if (window == null || transfer == null || resident == null
        || transfer > window + EPSILON || !close(window - transfer, resident)) {
      issues.push('senior-window transfer and resident declarations do not reconcile');
    } else if (total != null) {
      finalCandidates.push({
        source: 'senior_residency_derived_institution_units_minimum',
        units: total - resident,
      });
    }
  }
  const finalCap = finalCandidates.length
    ? Math.min(...finalCandidates.map((candidate) => candidate.units)) : null;
  evidence.push(...finalCandidates);

  const effectiveCandidates = [overallCap, twoYearCap, finalCap]
    .filter((value) => value != null);
  return {
    status,
    degree_total_units: total,
    residency_minimum_units: residencyMinimum,
    residency_percentage_exact_units: proportionalMinimum,
    overall_transfer_cap_units: overallCap,
    two_year_transfer_cap_units: twoYearCap,
    final_window_transfer_cap_units: finalCap,
    effective_two_year_transfer_cap_units: effectiveCandidates.length
      ? Math.min(...effectiveCandidates) : null,
    evidence,
    inventory,
    issues: unique(issues),
  };
}

function evaluateVirginiaResidencyTransferPolicy(doc, context = {}) {
  for (const exactPolicy of [
    evaluateBridgewaterResidencyPolicy,
    evaluateCnuResidencyPolicy,
    evaluateGmuResidencyPolicy,
    evaluateOduResidencyPolicy,
    evaluateLongwoodResidencyPolicy,
    evaluateNorfolkStateResidencyPolicy,
    evaluateUmwResidencyPolicy,
    evaluateWmResidencyPolicy,
    evaluateUvaWiseResidencyPolicy,
    evaluateVcuResidencyPolicy,
    evaluateVirginiaTechResidencyPolicy,
  ]) {
    const exact = exactPolicy(doc, context);
    if (exact) return exact;
  }
  const id = sourcePolicyId(doc);
  const profile = id ? ACTIVE_POLICY_PROFILES[id] : null;
  const derived = deriveVirginiaTransferCaps(doc);
  const issues = [...derived.issues];
  const status = derived.status;

  // An explicit no-rule declaration is universally executable; it cannot be
  // made less safe by a wrapper id and still fails if numeric policy facts are
  // present beside it.
  if (status === 'none_stated' || status === 'not_applicable') {
    return {
      ...derived,
      source_policy_id: id,
      declared_subrules: profile?.declared_subrules || ['none_stated'],
      evaluator: EVALUATOR,
      evaluator_version: EVALUATOR_VERSION,
      supported: issues.length === 0,
      reason: issues.length
        ? issues.join('; ')
        : 'the official source declares no numeric degree-completion residency rule',
    };
  }

  if (!profile) {
    issues.push('the required residency declaration has no reviewed Virginia policy profile');
  } else {
    for (const field of profile.required_fields || []) {
      if (!Object.prototype.hasOwnProperty.call(derived.inventory.fields, field)) {
        issues.push(`the reviewed policy profile requires unit_audit.${field}`);
      }
    }
    if (profile.runtime_ready !== true) issues.push(profile.blocker);
  }
  if (derived.effective_two_year_transfer_cap_units == null) {
    issues.push('no exact transfer ceiling was derived for the two-year pathway');
  }

  const supported = issues.length === 0;
  return {
    ...derived,
    source_policy_id: id,
    declared_subrules: profile?.declared_subrules || [],
    evaluator: EVALUATOR,
    evaluator_version: EVALUATOR_VERSION,
    supported,
    reason: supported
      ? `the two-year pathway is capped at ${derived.effective_two_year_transfer_cap_units} credits and every inventoried residency/transfer subrule is enforced`
      : unique(issues).join('; '),
    issues: unique(issues),
  };
}

module.exports = {
  ACTIVE_POLICY_PROFILES,
  ACTIVE_VA_RESIDENCY_POLICY_IDS,
  EVALUATOR_VERSION,
  POLICY_DETAIL_FIELDS,
  deriveVirginiaTransferCaps,
  evaluateVirginiaResidencyTransferPolicy,
  policyFieldInventory,
  sourcePolicyId,
};
