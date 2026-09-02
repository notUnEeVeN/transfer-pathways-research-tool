/**
 * Exact paper-figure support for Bridgewater College's two-track B.S. tree.
 *
 * Capability is bound to the complete reviewed 2026-2027 source tree and one
 * of the sanctioned composition/source/final-projection identity tuples. Any
 * source-shape, reference, roster, or accounting drift fails closed.
 */

const { createHash } = require('node:crypto');
const { receivingCourseIdForDocument } = require('../virginia/courseIdentity');

const SLUG = 'bridgewater-college';
const SOURCE_DEGREE_ID = 'va:degree:bridgewater-college:cs';
const SOURCE_INSTITUTION_ID = 'va:uni:bridgewater-college';
const FINAL_DEGREE_ID = 'degree:9205:va-cs';
const FINAL_INSTITUTION_ID = 'va:uni:9205';
const FINAL_SCHOOL_ID = 9205;
const CATALOG_YEAR = '2026-2027';
const PROGRAM = 'Computer Science, B.S.';

// SHA-256 of normalizedBridgewaterProofTree() for the checked-in composition,
// accepted source document, and final numeric buildProjection document. The
// view excludes derived wrapper/category ids and articulation options while
// retaining every authored field that can change these proofs.
const PROOF_TREE_SHA256 = '40ba88ea06907bae096a69777f79ed9fcba9c70b9631b3b5c094584f58a64b57';

const ALL_FIGURES = Object.freeze(['1', '3', '4', '6']);
const CORRELATED_GROUPS = Object.freeze([2, 3, 8, 9]);
const SUPPORTED_RULE_PATHS = Object.freeze({
  correlated_required_track_choice: Object.freeze(CORRELATED_GROUPS.map((index) => (
    `requirement_groups[${index}]`
  ))),
  transfer_status_course_selection: Object.freeze(['requirement_groups[4]']),
  cross_layer_course_overlap: Object.freeze(['requirement_groups[5]']),
  capacity_contains_nonadditive_ge_gates: Object.freeze(['requirement_groups[9]']),
});
const FIGURE_6_ONLY_OPEN_RULE_PATHS = Object.freeze({
  approved_transfer_associate_conditional_exemption: Object.freeze(['requirement_groups[5]']),
  quantitative_placement_or_course_choice: Object.freeze(['requirement_groups[6]']),
  prerequisite_and_ge_overlap: Object.freeze(['requirement_groups[6]']),
  closed_current_ge_course_menus: Object.freeze(['requirement_groups[7]']),
  full_stack_art321_overlap: Object.freeze(['requirement_groups[7]']),
});

const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => value == null ? null : String(value).trim();
const number = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function receiverBody(receiver) {
  return receiver?.receiving && typeof receiver.receiving === 'object'
    ? receiver.receiving : receiver || {};
}

function receiverCodes(receiver) {
  const body = receiverBody(receiver);
  const raw = receiver?.code_seen ?? body.code ?? body.codes ?? [];
  return (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => String(value || '').split(/\s*\+\s*|\s+and\s+/i))
    .map((value) => value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
    .filter(Boolean);
}

function normalizedConstraint(constraint) {
  return {
    kind: text(constraint?.kind),
    status: text(constraint?.status),
    description: text(constraint?.description),
  };
}

function effective(section, group, field) {
  return section?.[field] == null ? group?.[field] ?? null : section[field];
}

function normalizedReceiver(receiver) {
  const body = receiverBody(receiver);
  return {
    kind: text(body.kind)?.toLowerCase() || null,
    codes: receiverCodes(receiver),
    units: number(body.units),
    name: text(body.name),
    conjunction: text(body.conjunction)?.toLowerCase()
      || (body.kind === 'series' ? 'and' : null),
    tier: text(receiver?.tier),
    level: text(receiver?.course_level),
    cc: receiver?.cc_articulable ?? null,
    overlap: text(receiver?.overlap_key),
    note: text(receiver?.note),
    assume: receiver?.assume_satisfiable === true,
  };
}

function normalizedSection(section, group) {
  const units = number(section?.unit_advisement ?? section?.units);
  return {
    ask: number(section?.section_advisement ?? section?.select),
    units,
    max: number(section?.unit_advisement_max ?? section?.units_max ?? units),
    label: text(section?.label_seen ?? section?.label),
    tier: text(effective(section, group, 'tier')),
    level: text(effective(section, group, 'course_level')),
    cc: effective(section, group, 'cc_articulable'),
    refs: array(section?.source_refs).length
      ? [...section.source_refs] : [...array(group?.source_refs)],
    constraints: array(section?.analysis_constraints).map(normalizedConstraint),
    receivers: array(section?.receivers).map(normalizedReceiver),
  };
}

function normalizedGroup(group) {
  return {
    title: text(group?.title),
    is_required: group?.is_required !== false,
    conjunction: text(group?.group_conjunction ?? group?.conjunction)?.toLowerCase() || 'and',
    canonical: Number.isInteger(group?.canonical_section_index)
      ? group.canonical_section_index : null,
    layer: text(group?.requirement_layer),
    tier: text(group?.tier),
    level: text(group?.course_level),
    cc: group?.cc_articulable ?? null,
    refs: [...array(group?.source_refs)],
    stated: text(group?.stated_credits),
    constraints: array(group?.analysis_constraints).map(normalizedConstraint),
    sections: array(group?.sections).map((section) => normalizedSection(section, group)),
  };
}

function normalizedBridgewaterProofTree(document) {
  return {
    catalog_year: text(document?.catalog_year),
    program: text(document?.program),
    total_units: number(document?.total_units),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    data_quality_flags: array(document?.data_quality_flags),
    groups: array(document?.requirement_groups).map(normalizedGroup),
  };
}

function bridgewaterProofTreeFingerprint(document) {
  return hash(normalizedBridgewaterProofTree(document));
}

function documentStyle(document) {
  const composed = document?.slug === SLUG
    && document?._id == null
    && document?.institution_id == null
    && document?.school_id == null
    && document?.va_requirement_id == null;
  const source = document?._id === SOURCE_DEGREE_ID
    && document?.institution_id === SOURCE_INSTITUTION_ID
    && document?.school_id === SOURCE_INSTITUTION_ID
    && document?.slug == null
    && document?.va_requirement_id == null
    && document?.kind === 'degree';
  const projection = document?._id === FINAL_DEGREE_ID
    && document?.institution_id === FINAL_INSTITUTION_ID
    && document?.school_id === FINAL_SCHOOL_ID
    && document?.va_requirement_id === SOURCE_DEGREE_ID
    && document?.slug == null
    && document?.kind === 'degree'
    && document?.state === 'va'
    && document?.major_slug === 'va-cs';
  return [composed, source, projection].filter(Boolean).length === 1
    ? (composed ? 'composition' : source ? 'accepted_source' : 'final_projection')
    : null;
}

function fail(reason, affectedFigures = ALL_FIGURES) {
  return { supported: false, affected_figures: [...affectedFigures], reason };
}

function exactBridgewaterTree(document) {
  const style = documentStyle(document);
  if (!style) {
    return fail('document identity is not an exact Bridgewater composition/source/projection tuple');
  }
  if (text(document?.catalog_year) !== CATALOG_YEAR
      || text(document?.program) !== PROGRAM
      || number(document?.total_units) !== 120) {
    return fail('the Bridgewater catalog year, program, or degree total changed');
  }
  const fingerprint = bridgewaterProofTreeFingerprint(document);
  if (fingerprint !== PROOF_TREE_SHA256) {
    return fail('the reviewed Bridgewater source tree, source refs, or accounting declarations changed');
  }
  if (style !== 'composition') {
    for (const group of array(document.requirement_groups)) {
      for (const section of array(group.sections)) {
        for (const receiver of array(section.receivers)) {
          const body = receiverBody(receiver);
          if (!['course', 'series'].includes(String(body.kind || '').toLowerCase())) continue;
          const expected = receiverCodes(receiver)
            .map((code) => receivingCourseIdForDocument(document, code));
          const actual = body.kind === 'series' ? array(body.parent_ids) : [body.parent_id];
          if (!expected.length || actual.length !== expected.length
              || actual.some((id, index) => Number(id) !== expected[index])) {
            return fail('one or more projected Bridgewater course identities changed');
          }
        }
      }
    }
  }
  const paths = document.unit_audit.track_paths;
  const cyber = paths.cybersecurity;
  const full = paths.full_stack_software_development;
  if ([cyber, full].some((path) => (
    number(path?.major_units) !== 46
    || number(path?.track_units) !== 15
    || number(path?.total_units) !== 120
    || number(path?.major_upper_division_units)
      + number(path?.additional_upper_division_capacity_units) !== 45
  ))) return fail('one or more Bridgewater track accounting identities no longer close');
  return {
    supported: true,
    affected_figures: [...ALL_FIGURES],
    reason: 'the complete reviewed Bridgewater source tree and both correlated 120-credit tracks match',
    proof: {
      document_style: style,
      proof_tree_sha256: fingerprint,
      track_major_units: [46, 46],
      track_total_units: [120, 120],
      track_upper_division_units: [45, 45],
    },
  };
}

function ruleContainerIssue(kind, container, { document, path, constraint } = {}) {
  const allowed = SUPPORTED_RULE_PATHS[kind] || FIGURE_6_ONLY_OPEN_RULE_PATHS[kind] || [];
  if (!allowed.includes(path)) return `the ${kind} declaration moved from its reviewed source path`;
  const index = Number(path.match(/^requirement_groups\[(\d+)]$/)?.[1]);
  const group = document?.requirement_groups?.[index];
  if (!Number.isInteger(index) || group !== container) {
    return `the ${kind} evaluator did not receive its exact source container`;
  }
  const declarations = array(group.analysis_constraints).filter((entry) => entry.kind === kind);
  if (declarations.length !== 1 || declarations[0] !== constraint) {
    return `the ${kind} source declaration is absent, duplicated, or detached from its container`;
  }
  return null;
}

function evaluateBridgewaterConstraint(container, context = {}) {
  const kind = text(context?.constraint?.kind);
  if (!SUPPORTED_RULE_PATHS[kind]) return fail('no exact Bridgewater evaluator handles this rule');
  const exact = exactBridgewaterTree(context.document);
  if (!exact.supported) return exact;
  const issue = ruleContainerIssue(kind, container, context);
  if (issue) return fail(issue);
  const reasons = {
    correlated_required_track_choice:
      'all figure readers select one track index jointly across the four exact track carriers',
    transfer_status_course_selection:
      'Figure 6 selects CL-100 for the resident path and CL-150 for transfer paths; zero-unit GE accounting makes Figures 1/3/4 invariant',
    cross_layer_course_overlap:
      'CSCI-400 is one exact identity across the major and two zero-unit gates and is deduplicated in the Figure 6 graph',
    capacity_contains_nonadditive_ge_gates:
      'the exact 50/53-credit flexible carrier contains every zero-unit Connected Learning gate without gross addition',
  };
  return {
    ...exact,
    reason: reasons[kind],
    proof: {
      ...exact.proof,
      rule_path: context.path,
      correlated_group_indices: [...CORRELATED_GROUPS],
      transfer_section_indices: { resident: 0, transfer: 1 },
      shared_course_codes: ['CSCI400'],
      zero_unit_gate_group_indices: [4, 5, 6, 7],
      flexible_capacity_units_by_track: [50, 53],
    },
  };
}

function bridgewaterSourceSpecificAffectedFigures(value, context = {}) {
  const kind = text(value?.kind);
  if (!FIGURE_6_ONLY_OPEN_RULE_PATHS[kind]) return null;
  const exact = exactBridgewaterTree(context.document);
  if (!exact.supported || ruleContainerIssue(kind, context.container, {
    ...context, constraint: value,
  })) return null;
  return ['6'];
}

function bridgewaterQualityFlagAffectedFigures(flag, document) {
  const code = text(flag?.code);
  if (![
    'connected_learning_overlap_and_choice_rules',
    'approved_associate_transfer_exception',
    'full_stack_cl200_corequisite_policy_gap',
  ].includes(code)) return null;
  const exact = exactBridgewaterTree(document);
  if (!exact.supported) return null;
  // All affected carriers are GE/college zero-unit gates inside the exact
  // 50/53-credit flexible capacity. They cannot add a Figure 1 observation or
  // move Figure 3/4 units. Their open identity/placement/corequisite semantics
  // remain required for the Figure 6 graph.
  return ['6'];
}

function receiverParentIds(receiver) {
  const body = receiverBody(receiver);
  const raw = body.kind === 'series' ? body.parent_ids : [body.parent_id];
  return array(raw).map(Number).filter(Number.isInteger);
}

/** Select one intact track using the full five-course track denominator. */
function bridgewaterTrackSelection(document, {
  articulated = null,
  transferEntry = true,
} = {}) {
  const exact = exactBridgewaterTree(document);
  if (!exact.supported) return { ready: false, reason: exact.reason };
  const groups = document.requirement_groups;
  const tracks = [0, 1].map((index) => {
    const lower = groups[2].sections[index].receivers[0];
    const upper = groups[3].sections[index].receivers[0];
    const lowerIds = receiverParentIds(lower);
    const upperIds = receiverParentIds(upper);
    const covered = articulated instanceof Set && lowerIds.length
      && lowerIds.every((id) => articulated.has(id)) ? lowerIds.length : 0;
    return {
      index,
      key: index === 0 ? 'cybersecurity' : 'full_stack_software_development',
      total_courses: lowerIds.length + upperIds.length,
      covered_courses: covered,
    };
  });
  let selected = tracks[0];
  if (articulated instanceof Set) {
    for (const candidate of tracks.slice(1)) {
      const candidateRatio = candidate.total_courses
        ? candidate.covered_courses / candidate.total_courses : 0;
      const selectedRatio = selected.total_courses
        ? selected.covered_courses / selected.total_courses : 0;
      if (candidateRatio > selectedRatio
          || (candidateRatio === selectedRatio
            && candidate.total_courses < selected.total_courses)) selected = candidate;
    }
  }
  return {
    ready: true,
    institution: SLUG,
    selected_track_index: selected.index,
    selected_track_key: selected.key,
    tracks,
    group_section_indices: {
      2: selected.index,
      3: selected.index,
      4: transferEntry ? 1 : 0,
      8: selected.index,
      9: selected.index,
    },
    shared_course_codes: ['CSCI400'],
    proof: exact.proof,
  };
}

function evaluateBridgewaterMajorFieldPolicy(document, kind, value) {
  if (!['major_field_units_minimum', 'major_field_units_maximum'].includes(kind)) return null;
  const exact = exactBridgewaterTree(document);
  if (!exact.supported) return {
    supported: false,
    evaluator: 'evaluateBridgewaterMajorFieldPolicy',
    reason: exact.reason,
  };
  const expected = kind === 'major_field_units_minimum' ? 30 : 79;
  if (number(value) !== expected) return {
    supported: false,
    evaluator: 'evaluateBridgewaterMajorFieldPolicy',
    reason: `the Bridgewater ${kind} declaration changed from ${expected} credits`,
  };
  return {
    supported: true,
    evaluator: 'evaluateBridgewaterMajorFieldPolicy',
    reason: `both exact selected tracks contain 46 major-field credits inside the published ${kind === 'major_field_units_minimum' ? '30-credit minimum' : '79-credit maximum'}`,
    proof: {
      ...exact.proof,
      declared_bound: expected,
      selected_track_major_units: [46, 46],
    },
  };
}

/**
 * Prove Bridgewater's three overlapping residence clauses on the exact
 * reviewed tree.  All associate credit precedes the university segment, so
 * the 33-credit overall residence minimum makes the final 33 credits resident
 * (stronger than the published 30-of-final-33 rule).  The fixed 12-credit
 * upper-major core is explicitly university-only, independently satisfying
 * the nine-major-credit residence minimum on either selected track.
 */
function evaluateBridgewaterResidencyPolicy(document) {
  const exact = exactBridgewaterTree(document);
  if (!exact.supported) return null;
  const audit = document?.unit_audit || {};
  const residency = audit.residency || {};
  if (text(residency.status)?.toLowerCase() !== 'required'
      || number(residency.minimum_units) !== 33
      || number(audit.final_credit_window_units) !== 33
      || number(audit.final_credit_window_residency_units_minimum) !== 30
      || number(audit.major_residency_units_minimum) !== 9) return null;
  const fixedUpperMajor = document.requirement_groups?.[1];
  const fixedUpperMajorUnits = array(fixedUpperMajor?.sections)
    .reduce((sum, section) => sum + (number(section?.unit_advisement ?? section?.units) || 0), 0);
  if (text(fixedUpperMajor?.requirement_layer) !== 'major'
      || text(fixedUpperMajor?.tier) !== 'nontransferable'
      || text(fixedUpperMajor?.course_level) !== 'upper_division'
      || fixedUpperMajor?.cc_articulable !== false
      || fixedUpperMajorUnits !== 12) return null;
  return {
    status: 'required',
    degree_total_units: 120,
    residency_minimum_units: 33,
    residency_percentage_exact_units: null,
    overall_transfer_cap_units: 87,
    two_year_transfer_cap_units: null,
    final_window_transfer_cap_units: 90,
    effective_two_year_transfer_cap_units: 87,
    evidence: [
      { source: 'total_units - exact residency minimum', units: 87 },
      { source: 'total_units - final-window resident minimum', units: 90 },
    ],
    inventory: {
      fields: {
        final_credit_window_units: 33,
        final_credit_window_residency_units_minimum: 30,
        major_residency_units_minimum: 9,
      },
      unclassified_fields: [],
    },
    source_policy_id: SLUG,
    declared_subrules: [
      'overall_residency', 'final_window_residency', 'major_residency_units',
    ],
    evaluator: 'evaluateBridgewaterResidencyPolicy',
    evaluator_version: 1,
    supported: true,
    reason: 'the two-year pathway is capped at 87 credits; sequencing satisfies the final-window rule and 12 fixed nontransferable upper-major credits exceed the nine-credit major-residence minimum',
    issues: [],
    proof: {
      ...exact.proof,
      fixed_nontransferable_upper_major_units: fixedUpperMajorUnits,
      major_residency_minimum_units: 9,
      final_credit_window_units: 33,
      final_credit_window_residency_units_minimum: 30,
    },
  };
}

module.exports = {
  bridgewaterProofTreeFingerprint,
  bridgewaterQualityFlagAffectedFigures,
  bridgewaterSourceSpecificAffectedFigures,
  bridgewaterTrackSelection,
  evaluateBridgewaterConstraint,
  evaluateBridgewaterMajorFieldPolicy,
  evaluateBridgewaterResidencyPolicy,
  exactBridgewaterTree,
};
