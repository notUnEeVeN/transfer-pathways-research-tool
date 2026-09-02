/**
 * Associate-degree source constraints that the transfer-credit planner
 * evaluates exactly.
 *
 * This list is deliberately narrow.  It is consumed by Virginia's source
 * acceptance gate as well as the planner, so adding a label here is a claim
 * that the analysis code below preserves the rule rather than merely carrying
 * its prose. Open rosters, adviser decisions, grades, placement,
 * prerequisites, and unresolved source conflicts therefore remain
 * unsupported and fail closed; category rules pass only with the explicit
 * source-backed dictionaries validated below.
 */
const {
  evaluateAssociateCollegeConstraint,
} = require('./associateCollegeConstraintProofs');

const SUPPORTED_ASSOCIATE_CONSTRAINT_KINDS = new Set([
  // These rules are represented directly by the canonical Boolean tree. A
  // receiver option is an indivisible AND route; alternatives remain OR.
  'complete_one_route',

  // The planner owns one global set of selected course ids and backtracks when
  // two independently required slots would otherwise reuse the same course.
  'distinct_course_ids_across_sections',
  'no_double_count_across_breadth_slots',
  'no_double_count_across_components',
  'no_double_count_across_duplicate_option_slots',
  'no_double_count_across_laboratory_science_slots',
  'no_double_count_across_requirement_slots',
  'no_double_count_between_technical_slots',
  'no_double_count_with_fixed_courses',
  'no_double_count_with_other_degree_slots',

  // These are represented by section_advisement + unit_advisement/max and by
  // actual option course units.  A section route is one choice even when that
  // route contains an AND bundle of two or more courses.
  'variable_choice_count_with_minimum_units',
  'variable_credit_exactly_two_course_choice',
  'option_specific_credit_value',
  'option_specific_credit_values',

  // The selected named/aggregate requirements are reconciled to the explicit
  // degree minimum and ceiling.  A units_fill block supplies only the residual
  // capacity; it never invents a named course or articulation.
  'dynamic_elective_credits_to_degree_minimum',
  'variable_transfer_elective_credit_fill',

  // Category-qualified choices are supported only when the constraint also
  // carries a machine-readable category dictionary, or when it describes an
  // aggregate GE block whose credit value is invariant to the allowed
  // category choice. `hasAssociateConstraintEvaluator` and the acceptance
  // context audit below enforce that extra contract; the kind alone is not
  // enough to make a source record analysis-ready.
  'distinct_ge_areas',
  'distinct_categories_across_sections',
  'excluded_ge_subject',
]);

const DISTINCT_CATEGORY_KINDS = new Set([
  'distinct_ge_areas',
  'distinct_categories_across_sections',
]);

const AGGREGATE_GE_SCOPE = 'aggregate_ge_units';

const normalizedToken = (value) => String(value || '').trim().toLowerCase();
const positiveInteger = (value) => Number.isInteger(value) && value > 0;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function canonicalCourseCode(value) {
  const raw = String(value || '').trim();
  const final = (raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw)
    .toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]{2,8}[0-9][0-9A-Z]{1,7}$/.test(final) ? final : null;
}

function courseSubject(value) {
  const raw = String(value || '').trim();
  // Canonical keys are either shared (`va:ART100`) or institution-local
  // (`va:cc:richard-bland-college:MATH251`). The final token is always the
  // readable course code. Accept a readable code too so the source
  // composition can stay human-reviewable.
  const code = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw;
  return (/^[A-Za-z]{2,8}/.exec(code)?.[0] || '').toUpperCase() || null;
}

function categorySubjectMap(value) {
  const raw = value?.category_subjects;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = new Map();
  for (const [category, subjects] of Object.entries(raw)) {
    const name = normalizedToken(category);
    if (!name || !Array.isArray(subjects) || !subjects.length) return null;
    for (const subject of subjects) {
      const token = String(subject || '').trim().toUpperCase();
      if (!/^[A-Z]{2,8}$/.test(token) || out.has(token)) return null;
      out.set(token, name);
    }
  }
  return out.size ? out : null;
}

function categoryCourseMap(value) {
  const raw = value?.category_courses;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = new Map();
  for (const [category, codes] of Object.entries(raw)) {
    const name = normalizedToken(category);
    if (!name || !Array.isArray(codes) || !codes.length) return null;
    for (const codeSeen of codes) {
      const code = canonicalCourseCode(codeSeen);
      if (!code || out.has(code)) return null;
      out.set(code, name);
    }
  }
  return out.size ? out : null;
}

function distinctCategoryMinimum(value) {
  return positiveInteger(value?.minimum_distinct_categories)
    ? value.minimum_distinct_categories
    : null;
}

function refsOf(value) {
  return Array.isArray(value?.source_refs)
    ? [...new Set(value.source_refs.map((ref) => String(ref || '').trim()).filter(Boolean))]
    : [];
}

function sortedCategoryObject(categories) {
  return Object.fromEntries(Object.entries(categories).sort(([left], [right]) => (
    left.localeCompare(right)
  )).map(([category, codes]) => [
    normalizedToken(category),
    [...codes].map(canonicalCourseCode).sort(),
  ]));
}

function sourceRuleDeclaresTwoDistinctSelections(value) {
  const rule = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return /^(?:select|choose) two(?: three-credit)? courses? from (?:two )?different .*categor(?:y|ies)\.$/.test(rule)
    || /^choose one course from each of two different categories\.$/.test(rule);
}

function optionSetCategoryEvidence(value, owner, doc) {
  if (!owner || !doc || !doc.option_sets || typeof doc.option_sets !== 'object') {
    return { issues: ['named-course category constraint needs category_subjects or exact source option-set evidence'] };
  }
  const sourceIds = new Set((doc.sources || []).map((source) => String(source?.id || '').trim())
    .filter(Boolean));
  const ownerNodes = [owner, ...(owner.sections || [])];
  const ownerRefs = new Set(ownerNodes.flatMap(refsOf));
  if (!ownerRefs.size || [...ownerRefs].some((ref) => !sourceIds.has(ref))) {
    return { issues: ['category-constrained owner has missing or unresolved source_refs'] };
  }

  const routes = optionRoutes(owner);
  if (!routes.length) return { issues: ['named-course constraint has no canonical option routes'] };
  const canonicalRoutes = [];
  for (const [index, route] of routes.entries()) {
    const keys = Array.isArray(route?.source_course_keys) && route.source_course_keys.length
      ? route.source_course_keys : route?.course_keys;
    const codes = Array.isArray(keys) ? keys.map(canonicalCourseCode) : [];
    if (!codes.length || codes.some((code) => !code)) {
      return { issues: [`canonical option route ${index} has missing or invalid course keys`] };
    }
    canonicalRoutes.push({
      codes,
      conjunction: String(route?.course_conjunction || 'and').trim().toLowerCase(),
    });
  }
  const canonicalCodes = [...new Set(canonicalRoutes.flatMap((route) => route.codes))].sort();
  const exact = [];
  for (const [name, optionSet] of Object.entries(doc.option_sets)) {
    const categories = optionSet?.categories;
    if (!categories || typeof categories !== 'object' || Array.isArray(categories)) continue;
    const memberships = [];
    const categoryNames = new Set();
    let invalid = false;
    for (const [categorySeen, codesSeen] of Object.entries(categories)) {
      const category = normalizedToken(categorySeen);
      if (!category || categoryNames.has(category)
          || !Array.isArray(codesSeen) || !codesSeen.length) {
        invalid = true;
        break;
      }
      categoryNames.add(category);
      for (const codeSeen of codesSeen) {
        const code = canonicalCourseCode(codeSeen);
        if (!code) invalid = true;
        memberships.push({ code, category });
      }
    }
    const union = [...new Set(memberships.map((row) => row.code).filter(Boolean))].sort();
    if (JSON.stringify(union) !== JSON.stringify(canonicalCodes)) continue;
    const duplicateCodes = [...new Set(memberships
      .map((row) => row.code)
      .filter((code, index, all) => code && all.indexOf(code) !== index))];
    const optionRefs = refsOf(optionSet);
    const sourceIssues = !optionRefs.length
      || optionRefs.some((ref) => !sourceIds.has(ref))
      || !optionRefs.some((ref) => ownerRefs.has(ref));
    exact.push({
      name,
      optionSet,
      categories,
      memberships,
      invalid,
      duplicateCodes,
      sourceIssues,
      // Multiple witnesses are accepted only when their authored mapping is
      // byte-identical. A reordered or merely equivalent second dictionary is
      // still competing evidence and therefore remains ambiguous.
      fingerprint: JSON.stringify(categories),
    });
  }
  if (!exact.length) {
    return { issues: ['no source-backed option-set category union exactly equals the canonical option-route course set'] };
  }
  if (exact.some((row) => row.invalid || row.duplicateCodes.length)) {
    return { issues: ['an exact option-set category mapping has invalid or duplicate course membership'] };
  }
  if (exact.some((row) => row.sourceIssues)) {
    return { issues: ['an exact option-set category mapping has unresolved or non-overlapping source_refs'] };
  }
  if (new Set(exact.map((row) => row.fingerprint)).size !== 1) {
    return { issues: ['multiple exact option-set category mappings disagree'] };
  }
  const selected = exact[0];
  const categoryByCode = new Map(selected.memberships.map((row) => [row.code, row.category]));
  for (const route of canonicalRoutes) {
    if (route.conjunction !== 'or'
        && new Set(route.codes.map((code) => categoryByCode.get(code))).size !== 1) {
      return { issues: ['an AND option bundle spans more than one source-backed category'] };
    }
  }

  let minimum = distinctCategoryMinimum(value);
  if (!minimum && positiveInteger(owner?.distinct_areas)) minimum = owner.distinct_areas;
  if (!minimum) {
    const sections = owner.sections || [];
    const asks = sections.map((section) => section?.section_advisement);
    const selectionCount = asks.every(positiveInteger)
      ? asks.reduce((sum, ask) => sum + ask, 0) : null;
    // This fallback is intentionally narrower than prose parsing. The source
    // option set must itself retain a rule, while the canonical tree supplies
    // the exact two-selection cardinality as two explicit one-course slots.
    if (selectionCount === 2
        && sections.length === 2
        && asks.every((ask) => ask === 1)
        && exact.every((row) => sourceRuleDeclaresTwoDistinctSelections(
          row.optionSet?.rule,
        ))) {
      minimum = 2;
    }
  }
  if (!minimum || minimum < 2) {
    return { issues: ['exact option-set evidence does not establish a machine-readable distinct-category minimum'] };
  }
  if (new Set(categoryByCode.values()).size < minimum) {
    return { issues: ['exact option-set evidence exposes fewer categories than the distinct-category minimum'] };
  }

  const categoryCourses = sortedCategoryObject(selected.categories);
  const explicitSubjects = categorySubjectMap(value);
  if (explicitSubjects) {
    for (const code of canonicalCodes) {
      if (explicitSubjects.get(courseSubject(code)) !== categoryByCode.get(code)) {
        return { issues: ['category_subjects disagrees with exact source option-set course membership'] };
      }
    }
  }
  return {
    issues: [],
    minimum,
    category_courses: categoryCourses,
    evidence: {
      kind: 'source_option_set_categories',
      option_set_names: exact.map((row) => row.name).sort(),
      source_refs: [...new Set(exact.flatMap((row) => refsOf(row.optionSet)))].sort(),
      course_count: canonicalCodes.length,
      category_count: new Set(categoryByCode.values()).size,
    },
  };
}

function resolveAssociateConstraint(value, { owner = null, doc = null } = {}) {
  const sourceSpecific = evaluateAssociateCollegeConstraint(value, { owner, doc });
  if (sourceSpecific.handled) {
    return sourceSpecific.supported
      ? {
        constraint: sourceSpecific.resolved_constraint || value,
        issues: [],
        evidence: {
          kind: 'source_bound_associate_constraint',
          ...sourceSpecific.proof,
        },
      }
      : { constraint: null, issues: [sourceSpecific.reason], evidence: null };
  }
  const kind = String(value?.kind || '').trim();
  if (!DISTINCT_CATEGORY_KINDS.has(kind)
      || value?.evaluation_scope === AGGREGATE_GE_SCOPE) {
    return { constraint: value, issues: [], evidence: null };
  }
  if (own(value, 'minimum_distinct_categories')
      && (!distinctCategoryMinimum(value) || value.minimum_distinct_categories < 2)) {
    return {
      constraint: null,
      issues: ['minimum_distinct_categories must be an integer of at least two'],
      evidence: null,
    };
  }
  if (own(value, 'category_subjects') && !categorySubjectMap(value)) {
    return {
      constraint: null,
      issues: ['named-course category constraint has an ambiguous category_subjects dictionary'],
      evidence: null,
    };
  }
  const needsMinimum = !distinctCategoryMinimum(value);
  const needsCategories = !categorySubjectMap(value);
  if (!needsMinimum && !needsCategories) {
    return { constraint: value, issues: [], evidence: null };
  }
  const evidence = optionSetCategoryEvidence(value, owner, doc);
  if (evidence.issues.length) {
    return { constraint: null, issues: evidence.issues, evidence: null };
  }
  return {
    constraint: {
      ...value,
      minimum_distinct_categories: distinctCategoryMinimum(value) || evidence.minimum,
      ...(needsCategories ? { category_courses: evidence.category_courses } : {}),
      category_evidence: evidence.evidence,
    },
    issues: [],
    evidence: evidence.evidence,
  };
}

function associateConstraintShapeIssues(value, context = {}) {
  const sourceSpecific = evaluateAssociateCollegeConstraint(value, {
    owner: context?.owner || null,
    doc: context?.doc || null,
  });
  if (sourceSpecific.handled) {
    return sourceSpecific.supported ? [] : [sourceSpecific.reason];
  }
  const kind = String(value?.kind || '').trim();
  if (!SUPPORTED_ASSOCIATE_CONSTRAINT_KINDS.has(kind)) {
    return [`unsupported associate constraint kind: ${kind || '<missing>'}`];
  }
  if (DISTINCT_CATEGORY_KINDS.has(kind)) {
    const resolution = resolveAssociateConstraint(value, context);
    if (resolution.issues.length) return resolution.issues;
    const resolved = resolution.constraint;
    const minimum = distinctCategoryMinimum(resolved);
    if (!minimum || minimum < 2) {
      return ['minimum_distinct_categories must be an integer of at least two'];
    }
    if (resolved?.evaluation_scope === AGGREGATE_GE_SCOPE) {
      const names = Array.isArray(resolved?.category_names)
        ? [...new Set(resolved.category_names.map(normalizedToken).filter(Boolean))]
        : [];
      return names.length >= minimum
        ? []
        : ['aggregate GE constraint needs at least minimum_distinct_categories named categories'];
    }
    const mapping = categoryCourseMap(resolved) || categorySubjectMap(resolved);
    if (!mapping) return ['named-course category constraint needs an unambiguous category dictionary'];
    if (new Set(mapping.values()).size < minimum) {
      return ['category_subjects exposes fewer categories than minimum_distinct_categories'];
    }
  }
  if (kind === 'excluded_ge_subject') {
    const subjects = Array.isArray(value?.excluded_subjects)
      ? [...new Set(value.excluded_subjects.map((subject) => String(subject || '').trim().toUpperCase()).filter(Boolean))]
      : [];
    if (!subjects.length || subjects.some((subject) => !/^[A-Z]{2,8}$/.test(subject))) {
      return ['excluded_ge_subject needs explicit canonical excluded_subjects'];
    }
  }
  return [];
}

function categoryForCourse(value, courseKeyOrCode) {
  const code = canonicalCourseCode(courseKeyOrCode);
  const exact = code ? categoryCourseMap(value)?.get(code) || null : null;
  if (exact) return exact;
  const subject = courseSubject(courseKeyOrCode);
  return subject ? categorySubjectMap(value)?.get(subject) || null : null;
}

function optionRoutes(value) {
  return (value?.sections || []).flatMap((section) => (
    (section?.receivers || []).flatMap((receiver) => receiver?.options || [])
  ));
}

/**
 * Validate that a supported category/filter constraint actually matches the
 * canonical node that owns it. This prevents a bare `kind: distinct_ge_areas`
 * stamp from bypassing the gate without enough data for the planner.
 */
function associateConstraintContextIssues(value, owner, doc = null) {
  const sourceSpecific = evaluateAssociateCollegeConstraint(value, { owner, doc });
  if (sourceSpecific.handled) {
    return sourceSpecific.supported ? [] : [sourceSpecific.reason];
  }
  const resolution = resolveAssociateConstraint(value, { owner, doc });
  if (resolution.issues.length) return resolution.issues;
  const resolved = resolution.constraint;
  const shape = associateConstraintShapeIssues(resolved, { owner, doc });
  if (shape.length) return shape;
  const kind = String(resolved?.kind || '').trim();
  if (!DISTINCT_CATEGORY_KINDS.has(kind) && kind !== 'excluded_ge_subject') return [];

  const routes = optionRoutes(owner);
  const aggregate = resolved?.evaluation_scope === AGGREGATE_GE_SCOPE;
  if (aggregate) {
    if (!owner?.ge_area || routes.length) {
      return ['aggregate_ge_units is valid only on a receiver-free ge_area group'];
    }
    if (DISTINCT_CATEGORY_KINDS.has(kind)
        && Number(owner?.distinct_areas) !== distinctCategoryMinimum(resolved)) {
      return ['aggregate GE distinct_areas must equal minimum_distinct_categories'];
    }
    return [];
  }

  if (!routes.length) return ['named-course constraint has no canonical option routes'];
  if (DISTINCT_CATEGORY_KINDS.has(kind)) {
    if (String(owner?.group_conjunction || 'and').trim().toLowerCase() === 'or'
        && (owner?.sections || []).length > 1) {
      return ['category-distinct evaluation does not support mutually exclusive group sections'];
    }
    const selections = (owner?.sections || []).reduce((total, section) => (
      total + (positiveInteger(section?.section_advisement) ? section.section_advisement : 0)
    ), 0);
    if (selections < distinctCategoryMinimum(resolved)) {
      return ['canonical sections select fewer courses than minimum_distinct_categories'];
    }
    const categories = new Set();
    for (const route of routes) {
      const keys = Array.isArray(route?.source_course_keys) && route.source_course_keys.length
        ? route.source_course_keys
        : (Array.isArray(route?.course_keys) ? route.course_keys : []);
      if (!keys.length) return ['category-constrained option route has no canonical course_keys'];
      const routeCategories = new Set(keys.map((key) => categoryForCourse(resolved, key)).filter(Boolean));
      const routeIsOr = String(route?.course_conjunction || 'and').trim().toLowerCase() === 'or';
      if ((!routeIsOr && routeCategories.size !== 1)
          || keys.some((key) => !categoryForCourse(resolved, key))) {
        return ['every category-constrained option route must resolve to exactly one declared category'];
      }
      routeCategories.forEach((category) => categories.add(category));
    }
    if (categories.size < distinctCategoryMinimum(resolved)) {
      return ['canonical option routes expose too few distinct categories'];
    }
  }
  if (kind === 'excluded_ge_subject') {
    const keys = routes.flatMap((route) => route?.course_keys || []);
    if (!keys.length || keys.some((key) => !courseSubject(key))) {
      return ['subject-exclusion constraint has an unclassifiable canonical course key'];
    }
    const excluded = new Set(resolved.excluded_subjects.map((subject) => String(subject).toUpperCase()));
    if (routes.every((route) => (
      (route?.course_keys || []).some((key) => excluded.has(courseSubject(key)))
    ))) {
      return ['subject-exclusion constraint removes every canonical option route'];
    }
  }
  return [];
}

function supportsAssociateConstraintKind(value) {
  const kind = typeof value === 'string' ? value : value?.kind;
  return SUPPORTED_ASSOCIATE_CONSTRAINT_KINDS.has(String(kind || '').trim());
}

const EVALUATOR_CAPABILITY_STATUSES = new Set([
  'supported',
  'evaluator_not_implemented',
]);

/**
 * A newly implemented evaluator may supersede the historical
 * `evaluator_not_implemented` marker. It may not supersede source uncertainty:
 * unknown, open, conflicting, or unresolved statuses stay fail-closed.
 */
function hasAssociateConstraintEvaluator(value, context = {}) {
  const sourceSpecific = evaluateAssociateCollegeConstraint(value, {
    owner: context?.owner || null,
    doc: context?.doc || null,
  });
  if (sourceSpecific.handled) return sourceSpecific.supported === true;
  return supportsAssociateConstraintKind(value)
    && EVALUATOR_CAPABILITY_STATUSES.has(String(value?.status || '').trim().toLowerCase())
    && associateConstraintShapeIssues(value, context).length === 0;
}

module.exports = {
  AGGREGATE_GE_SCOPE,
  DISTINCT_CATEGORY_KINDS,
  SUPPORTED_ASSOCIATE_CONSTRAINT_KINDS,
  associateConstraintContextIssues,
  associateConstraintShapeIssues,
  categoryForCourse,
  canonicalCourseCode,
  courseSubject,
  distinctCategoryMinimum,
  hasAssociateConstraintEvaluator,
  resolveAssociateConstraint,
  supportsAssociateConstraintKind,
};
