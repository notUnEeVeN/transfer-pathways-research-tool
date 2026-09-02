/**
 * Figure-scoped capability audit for Virginia associate-degree rules.
 *
 * The catalog acceptance receipt remains the complete-degree authority. This
 * module answers a narrower question: can a source-authored rule change one
 * of the paper's associate-side computations (Figures 3, 4, or 6), and, when
 * it can, does the strict transfer planner enforce it exactly?
 *
 * Unknown rules and source-uncertainty statuses affect every associate-side
 * figure by default.  A rule is marked supported only through the same
 * constraint resolver used by `planAssociateDegreeStrict`; carrying a label
 * in the source tree is never enough.  Two Wytheville graduation policies are
 * retained as complete-degree blockers but have a source-bound proof of zero
 * paper impact because they describe student performance/non-course
 * competency rather than another curriculum course or credit.
 */

const {
  associateConstraintContextIssues,
  distinctCategoryMinimum,
  hasAssociateConstraintEvaluator,
  resolveAssociateConstraint,
  supportsAssociateConstraintKind,
} = require('./transferCreditConstraints');
const {
  evaluateAssociateCollegeConstraint,
} = require('./associateCollegeConstraintProofs');
const {
  proveReynoldsCampFixedDistinctAreaAggregate,
} = require('./reynoldsCampDistinctAreaProofs');

const FIGURES = Object.freeze(['3', '4', '6']);
const CAPABILITY_STATUSES = new Set(['supported', 'evaluator_not_implemented']);
const WYTHEVILLE_SOURCE_ID = 'va:as:wytheville-community-college:cs';

const SOURCE_RESEARCH_KINDS = new Set([
  'advisor_approved_substitution',
  'advisor_approved_transfer_course_open_option',
  'advisor_approved_ucgs_substitution',
  'alternative_course_credit_mismatch',
  'choose_two_variable_credit_open_roster',
  'destination_selected_open_stem_roster',
  'destination_selected_transfer_core',
  'direct_placement_with_category_replacement',
  'distinct_humanities_clusters',
  'footnote_8_source_language_ambiguity',
  'paired_math_slots_with_cross_row_routes',
  'published_maximum_source_conflict',
  'published_ucgs_component_cap',
  'published_variable_component_closure',
  'receiving_program_alignment_required',
  'variable_credit_advisor_approved_substitution',
  'variable_credit_category_with_course_combinations',
  'variable_credit_category_with_sequences',
  'world_language_category_open',
]);

// These historical flags describe evaluator work that is now implemented by
// the strict planner. They may be superseded only when the exact number of
// mapped active rules is present and every rule passes its current source-tree
// proof. Other flags, including arithmetic/source conflicts, stay closed.
const ANALYSIS_QUALITY_FLAG_RULES = Object.freeze({
  distinct_humanities_categories_require_evaluation: Object.freeze([
    Object.freeze({ kind: 'distinct_ge_areas', count: 1 }),
  ]),
  overlapping_options_are_distinct_slots: Object.freeze([
    Object.freeze({ kind: 'distinct_course_ids_across_sections', count: 2 }),
    Object.freeze({ kind: 'no_double_count_between_technical_slots', count: 1 }),
    Object.freeze({ kind: 'no_double_count_across_requirement_slots', count: 1 }),
  ]),
});

const kindOf = (value) => String(
  typeof value === 'string' ? value : value?.kind || '',
).trim();

const sourceStatus = (value) => String(value?.status || '').trim().toLowerCase();

function documentSourceId(document) {
  return String(document?.va_requirement_id || document?._id || '').trim();
}

function optionCourseKeys(document) {
  const keys = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const key of value.source_course_keys || value.course_keys || []) {
      keys.push(String(key || '').trim().toUpperCase());
    }
    Object.values(value).forEach(visit);
  };
  visit(document?.requirement_groups || []);
  return keys.filter(Boolean);
}

/**
 * Prove the two known associate administrative policies do not add a paper
 * course/credit. The proof is deliberately tied to Wytheville's current
 * source identity, exact 62-credit closure, and unit-audit fields. Any move,
 * deletion, altered total, or flattened ITE 115 receiver fails closed.
 */
function proveWythevilleNonFigurePolicy(value, {
  document = null,
  path = '',
} = {}) {
  const kind = kindOf(value);
  if (!['minimum_course_grade', 'computer_competency_multiple_routes'].includes(kind)) {
    return null;
  }
  if (documentSourceId(document) !== WYTHEVILLE_SOURCE_ID) {
    return { proven: false, reason: 'the non-figure proof is bound to the reviewed Wytheville source' };
  }
  if (!String(path).startsWith('unit_audit.analysis_constraints[')) {
    return { proven: false, reason: 'the policy must remain a degree-wide unit-audit constraint' };
  }
  const audit = document?.unit_audit || {};
  if (Number(document?.total_units) !== 62
      || Number(document?.total_units_max) !== 62
      || Number(audit.modeled_units_minimum) !== 62
      || Number(audit.modeled_units_maximum) !== 62) {
    return { proven: false, reason: 'the reviewed 62-credit curriculum closure changed' };
  }
  if (kind === 'minimum_course_grade') {
    if (String(audit.minimum_course_grade || '').trim().toUpperCase() !== 'C') {
      return { proven: false, reason: 'the reviewed degree-wide minimum course grade changed' };
    }
    return {
      proven: true,
      reason: 'the degree-wide C-grade policy governs student performance, not the authored course/credit tree',
      proof: { source_id: WYTHEVILLE_SOURCE_ID, minimum_course_grade: 'C' },
    };
  }
  if (audit.computer_competency_required !== true
      || typeof audit.computer_competency_rule !== 'string'
      || !audit.computer_competency_rule.trim()) {
    return { proven: false, reason: 'the reviewed non-course competency declaration is missing' };
  }
  if (optionCourseKeys(document).some((key) => /(?:^|:)ITE115$/.test(key))) {
    return { proven: false, reason: 'ITE 115 was added to the curriculum tree and requires renewed paper-impact review' };
  }
  return {
    proven: true,
    reason: 'computer competency remains a separately declared multi-route completion policy with no added curriculum receiver',
    proof: {
      source_id: WYTHEVILLE_SOURCE_ID,
      computer_competency_required: true,
      ite_115_curriculum_receivers: 0,
    },
  };
}

function affectedFiguresForAssociateConstraint(value, context = {}) {
  const status = sourceStatus(value);
  if (!CAPABILITY_STATUSES.has(status)) return [...FIGURES];
  const sourceSpecific = evaluateAssociateCollegeConstraint(value, {
    owner: context.container || null,
    doc: context.document || null,
  });
  if (sourceSpecific.handled) return [...sourceSpecific.affected_figures];
  const nonFigure = proveWythevilleNonFigurePolicy(value, context);
  if (nonFigure?.proven === true) return [];
  return [...FIGURES];
}

function classifyAssociateBlocker(value) {
  if (value?.supported === true) return null;
  if (value?.paper_impact_proven === true && value?.affected_figures?.length === 0) {
    return {
      category: 'out_of_scope_administrative_rule',
      reason: 'the complete-degree policy is preserved but has a source-bound proof of zero paper-figure impact',
    };
  }
  if ((value?.source_status && !CAPABILITY_STATUSES.has(value.source_status))
      || SOURCE_RESEARCH_KINDS.has(value?.kind)) {
    return {
      category: 'targeted_source_research',
      reason: value?.source_status && !CAPABILITY_STATUSES.has(value.source_status)
        ? `source status ${value.source_status} is not evaluator-ready`
        : 'the stored tree lacks a closed, reconciled rule needed by the paper computation',
    };
  }
  return {
    category: 'evaluator_engineering',
    reason: 'the source rule is explicit, but no exact associate-side evaluator proves it',
  };
}

function withRemediation(row) {
  const remediation = classifyAssociateBlocker(row);
  return remediation ? { ...row, remediation } : row;
}

function evaluateAssociateConstraint(value, {
  container = null,
  document = null,
  path = '',
} = {}) {
  const kind = kindOf(value);
  const status = sourceStatus(value) || null;
  const context = { owner: container, doc: document };
  const affectedFigures = affectedFiguresForAssociateConstraint(value, {
    container, document, path,
  });
  const sourceSpecific = evaluateAssociateCollegeConstraint(value, context);
  if (sourceSpecific.handled) {
    return withRemediation({
      kind,
      source_status: status,
      supported: sourceSpecific.supported === true,
      paper_impact_proven: false,
      evaluator: 'evaluateAssociateCollegeConstraint',
      affected_figures: [...sourceSpecific.affected_figures],
      reason: sourceSpecific.reason,
      ...(sourceSpecific.proof ? { proof: sourceSpecific.proof } : {}),
    });
  }
  const nonFigure = proveWythevilleNonFigurePolicy(value, { document, path });
  if (nonFigure?.proven === true) {
    return withRemediation({
      kind,
      source_status: status,
      supported: false,
      paper_impact_proven: true,
      evaluator: 'proveWythevilleNonFigurePolicy',
      affected_figures: affectedFigures,
      reason: nonFigure.reason,
      proof: nonFigure.proof,
    });
  }

  const contextIssues = associateConstraintContextIssues(value, container, document);
  const supported = hasAssociateConstraintEvaluator(value, context)
    && contextIssues.length === 0;
  return withRemediation({
    kind: kind || null,
    source_status: status,
    supported,
    paper_impact_proven: false,
    evaluator: supported ? 'planAssociateDegreeStrict' : null,
    affected_figures: affectedFigures,
    reason: supported
      ? 'the strict associate planner enforces this source-bound constraint'
      : (nonFigure?.reason || contextIssues[0]
        || (kind ? 'no exact associate evaluator is registered' : 'constraint kind is missing')),
  });
}

function evaluateDistinctCourseFlag() {
  const supported = supportsAssociateConstraintKind('distinct_course_ids_across_sections');
  return withRemediation({
    kind: 'distinct_course_ids_across_sections',
    source_status: 'structural_boolean',
    supported,
    paper_impact_proven: false,
    evaluator: supported ? 'planAssociateDegreeStrict.global_selected_ids' : null,
    affected_figures: [...FIGURES],
    reason: supported
      ? 'the strict planner owns one global selected-course set across every required section'
      : 'cross-section distinct-course assignment is not implemented',
  });
}

function evaluateDistinctAreasFlag(container, document) {
  const fixedAggregate = proveReynoldsCampFixedDistinctAreaAggregate(container, document);
  if (fixedAggregate.handled) {
    return withRemediation({
      kind: 'distinct_areas',
      source_status: 'structural_number',
      supported: fixedAggregate.supported === true,
      paper_impact_proven: fixedAggregate.ready === true,
      evaluator: fixedAggregate.ready
        ? 'proveReynoldsCampFixedDistinctAreaAggregate' : null,
      affected_figures: [...fixedAggregate.affected_figures],
      reason: fixedAggregate.reason,
      ...(fixedAggregate.proof ? { proof: fixedAggregate.proof } : {}),
    });
  }
  const constraints = (container?.analysis_constraints || []).filter((constraint) => (
    ['distinct_ge_areas', 'distinct_categories_across_sections'].includes(kindOf(constraint))
  ));
  const receipts = constraints.map((constraint) => evaluateAssociateConstraint(constraint, {
    container,
    document,
    path: 'structural_distinct_areas_companion',
  }));
  const resolvedMinimum = constraints.length === 1
    ? (distinctCategoryMinimum(resolveAssociateConstraint(constraints[0], {
      owner: container,
      doc: document,
    }).constraint) ?? Number(receipts[0]?.proof?.minimum_distinct_categories || 0))
    : null;
  const exactCompanion = constraints.length === 1
    && Number(container?.distinct_areas) > 0
    && Number(container.distinct_areas) === Number(resolvedMinimum);
  const supported = exactCompanion && receipts[0].supported === true;
  const affectedFigures = exactCompanion
    ? [...receipts[0].affected_figures] : [...FIGURES];
  return withRemediation({
    kind: 'distinct_areas',
    source_status: 'structural_number',
    supported,
    paper_impact_proven: false,
    evaluator: supported ? 'planAssociateDegreeStrict.distinct_categories' : null,
    affected_figures: affectedFigures,
    reason: supported
      ? 'the structural distinct-area count equals one exact companion category constraint'
      : (exactCompanion
        ? receipts[0].reason
        : 'distinct_areas lacks one exact companion category constraint with the same minimum'),
    ...(exactCompanion && receipts[0]?.proof ? { proof: receipts[0].proof } : {}),
  });
}

function auditConstraintTree(value, {
  rootPath = 'requirement_groups',
  document = null,
} = {}) {
  const rows = [];
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (node.distinct_course_ids_across_sections === true) {
      rows.push({ path: `${path}.distinct_course_ids_across_sections`, ...evaluateDistinctCourseFlag() });
    }
    if (Number.isFinite(Number(node.distinct_areas)) && Number(node.distinct_areas) > 0) {
      rows.push({
        path: `${path}.distinct_areas`,
        ...evaluateDistinctAreasFlag(node, document),
      });
    }
    if (typeof node.overlap_key === 'string' && node.overlap_key.trim()) {
      rows.push(withRemediation({
        path: `${path}.overlap_key`,
        kind: 'overlap_key',
        source_status: 'structural_string',
        supported: false,
        paper_impact_proven: false,
        evaluator: null,
        affected_figures: [...FIGURES],
        reason: 'cross-requirement overlap allocation is not implemented',
      }));
    }
    (node.analysis_constraints || []).forEach((constraint, index) => {
      rows.push({
        path: `${path}.analysis_constraints[${index}]`,
        ...evaluateAssociateConstraint(constraint, {
          container: node,
          document,
          path: `${path}.analysis_constraints[${index}]`,
        }),
      });
    });
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'analysis_constraints') visit(child, `${path}.${key}`);
    }
  };
  visit(value, rootPath);
  return rows;
}

function remediationCounts(rows) {
  return Object.fromEntries([
    'targeted_source_research',
    'evaluator_engineering',
    'out_of_scope_administrative_rule',
  ].map((category) => [
    category,
    rows.filter((row) => row.remediation?.category === category).length,
  ]));
}

function auditAssociateDocument(doc) {
  const rules = [
    ...auditConstraintTree(
      Array.isArray(doc?.analysis_constraints)
        ? { analysis_constraints: doc.analysis_constraints } : {},
      { rootPath: 'doc', document: doc },
    ),
    ...auditConstraintTree(doc?.unit_audit || {}, {
      rootPath: 'unit_audit', document: doc,
    }),
    ...auditConstraintTree(doc?.requirement_groups || [], {
      rootPath: 'requirement_groups', document: doc,
    }),
  ];
  const blockers = rules.filter((row) => !row.supported);
  const blockedByFigure = Object.fromEntries(FIGURES.map((figure) => [
    figure,
    blockers.filter((row) => row.affected_figures.includes(figure)).length,
  ]));
  return {
    document_id: documentSourceId(doc) || null,
    rules,
    active_rules: rules,
    active_blockers: blockers,
    summary: {
      explicit_rules: rules.length,
      supported_active_rules: rules.filter((row) => row.supported).length,
      blocked_active_rules: blockers.length,
      active_rule_remediation: remediationCounts(blockers),
      blocked_rules_by_figure: blockedByFigure,
      ready_by_figure: Object.fromEntries(FIGURES.map((figure) => [
        figure, blockedByFigure[figure] === 0,
      ])),
    },
  };
}

function auditAssociateAnalysisQualityFlags(doc) {
  const constraintAudit = auditAssociateDocument(doc);
  return (Array.isArray(doc?.data_quality_flags) ? doc.data_quality_flags : [])
    .map((flag, index) => {
      const code = String(flag?.code || '').trim() || null;
      const severity = String(flag?.severity || '').trim().toLowerCase();
      const mappings = code ? ANALYSIS_QUALITY_FLAG_RULES[code] || [] : [];
      const receipts = mappings.map(({ kind, count }) => {
        const matches = constraintAudit.active_rules.filter((row) => row.kind === kind);
        return {
          kind,
          expected_active_rule_count: count,
          exact_active_rule_count: matches.length,
          supported: matches.length === count && matches.every((row) => row.supported),
          evaluators: [...new Set(matches.map((row) => row.evaluator).filter(Boolean))],
          reasons: matches.map((row) => row.reason),
        };
      });
      const implementationOnly = severity === 'block_analysis' && mappings.length > 0;
      const resolved = implementationOnly
        && receipts.length === mappings.length
        && receipts.every((row) => row.supported);
      return {
        path: `data_quality_flags[${index}]`,
        code,
        severity,
        message: flag?.message || null,
        blocking_analysis: ['block', 'block_catalog_acceptance', 'block_analysis']
          .includes(severity),
        mapped_constraint_rules: mappings.map((mapping) => ({ ...mapping })),
        resolved_by_exact_evaluator: resolved,
        rule_receipts: receipts,
        reason: resolved
          ? 'every explicitly mapped active rule passes its exact source-bound evaluator'
          : (!mappings.length
            ? 'quality flag has no exact evaluator mapping'
            : (severity !== 'block_analysis'
              ? `severity ${severity || '<missing>'} cannot be superseded by evaluator capability`
              : 'one or more mapped rules are absent, duplicated, unsupported, or source-drifted')),
      };
    });
}

module.exports = {
  ANALYSIS_QUALITY_FLAG_RULES,
  FIGURES,
  affectedFiguresForAssociateConstraint,
  auditAssociateAnalysisQualityFlags,
  auditAssociateDocument,
  classifyAssociateBlocker,
  evaluateAssociateConstraint,
  proveWythevilleNonFigurePolicy,
};
