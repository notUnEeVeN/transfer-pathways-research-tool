/**
 * Full-pathway curricular complexity — the Massachusetts paper's Figure 6,
 * computed for our corpora.
 *
 * The paper scores each transfer PATHWAY: the associate degree's courses plus
 * every four-year requirement the transfer does not satisfy, joined by
 * prerequisite/corequisite edges, with structural complexity
 * h(G) = Σ(delay + blocking) per Heileman et al. (2018). Our implementation of
 * those equations reproduces 59 of the 60 scores in the archived Massachusetts
 * workbook; the remaining four-point difference is retained as an artifact
 * divergence rather than assigned a cause. This module supplies a separately
 * sourced, explicitly modelled pathway assembly for California.
 *
 * Assembly per (campus × college) pair, mirroring the paper's sheets:
 *   - the college's enumerated named associate-degree requirements, resolved
 *     through the shared exact stored-tree selector (each selected named
 *     course a vertex, edges from the CC prerequisite projection);
 *   - lower-division requirements: satisfied and CONSUMED from the AS when the
 *     pair's agreement articulates them (multiset — a course satisfies one
 *     requirement); unsatisfied ones stay as university vertices, exactly the
 *     paper's offerings-vs-AS gap;
 *   - IGETC-satisfiable general education: satisfied administratively by the
 *     AS side. The gathered AS records preserve the GE block and its units,
 *     not the student's actual GE course list, so those courses are not graph
 *     vertices; campus-only GE stays;
 *   - upper-division requirements: university vertices (named courses via the
 *     campus catalogue; eligibility pools as placeholder slots, as the paper's
 *     SLOT rows);
 *   - elective capacity: placeholder slots for whatever the AS's leftover
 *     courses do not absorb (the paper's blue rows);
 *   - unit-accounting sections: not courses, skipped.
 *
 * When a lower-division requirement is consumed, university-side prerequisite
 * edges that pointed at it are REWIRED to the community-college courses that
 * covered it — the paper's sheets do the same by construction, because their
 * transfer tab is one sheet with one id space.
 *
 * Every row reports `edge_info_pct`: the share of its vertices whose
 * prerequisite status is known either way. Placeholder slots are structurally
 * unknowable. Missing edges understate an individual graph's absolute score,
 * but can move transfer-minus-resident in either direction because the two
 * graphs do not necessarily have the same missing-edge pattern.
 */
const { getMajor } = require('../../config/majors');
const { stateClause } = require('../../config/stateScope');
const { resolveSectionTier } = require('../degreeSlots');
const {
  gmuOduFigure6Selection,
} = require('./georgeMasonOldDominionConstraintProofs');
const {
  bridgewaterTrackSelection,
} = require('./bridgewaterConstraintProofs');
const {
  cnuFigureSelection,
} = require('./christopherNewportConstraintProofs');
const {
  norfolkStateFigureSelection,
} = require('./norfolkStateConstraintProofs');
const {
  longwoodFigureSelection,
} = require('./longwoodConstraintProofs');
const {
  vcuFigure6NonCourseSelection,
} = require('./vcuConstraintProofs');
const {
  vmiFigure6Selection,
} = require('./virginiaMilitaryInstituteConstraintProofs');
const {
  standardMathAndPathwaysSelection,
} = require('./virginiaTechConstraintProofs');
const { exactVirginiaStateTree } = require('./virginiaStateConstraintProofs');
const { projectPrereqEdges, projectPrereqGroups } = require('../prereqGraph');
const { curricularComplexity } = require('./curricularComplexity');
const { associateNamedSections, planAssociateDegree } = require('./transferCreditRate');
const {
  canonicalContractIssues,
  usesCanonicalSourceContract,
} = require('./canonicalSourceContract');
const { readinessForProjectedFigures } = require('../virginia/publicationReadiness');
const {
  BLOCKER: VA_PREREQUISITE_MODEL_BLOCKER,
  FORMULA: VA_PREREQUISITE_FORMULA,
  VA_FIGURE6_PREREQUISITE_CONTRACT,
  canonicalJson: canonicalVirginiaPrerequisiteJson,
  officialHostsForPrerequisiteScope,
  requiredUniversityCourseKeys,
  requiredVccsCourseKeys,
  sha256: sha256VirginiaPrerequisiteValue,
  validateVirginiaFigure6PrerequisiteCorpus,
  validateVirginiaFigure6PrerequisiteSources,
  verificationReceiptHash,
} = require('../virginia/pathwayComplexityPrerequisites');
const {
  runtimeDegreeScopeIssues: vsuEnglishRuntimeDegreeScopeIssues,
} = require('../virginia/virginiaStateEnglishPrerequisiteEvidence');

const normalizeCode = (prefix, number) => `${String(prefix || '').toUpperCase().replace(/\s+/g, ' ').trim()} ${String(number || '').toUpperCase()}`.trim();

const AMBIGUOUS_UNIT_POOL = 'ambiguous_named_unit_pool';

/**
 * Exact Virginia requisite adapter available to this analysis module.
 *
 * This is deliberately a capability marker for the formula adapter, not a
 * publication flag.  Virginia remains disabled below until both owner-scoped
 * corpora and the pathway-key identity bridge pass their independent gates.
 */
const VA_EXACT_FORMULA_ADAPTER = Object.freeze({
  integrated: true,
  version: 'va-figure6-exact-formula-v1',
  formula: VA_PREREQUISITE_FORMULA,
  semantics: 'groups_and__paths_or__conditions_and',
  corequisites: 'edges',
  ambiguous_path_policy: 'fail_closed',
});
const VALIDATED_VA_FORMULA_CORPUS = Symbol('validated-va-figure6-formula-corpus');
const VALIDATED_VA_FIGURE6_RUNTIME = Symbol('validated-va-figure6-runtime');
const VALIDATED_VA_FIGURE6_RUNTIME_STATE = new WeakMap();
const VA_FIGURE6_PUBLICATION_COLLECTION = 'va_figure6_prerequisite_publications';

const normalizeVirginiaCourseCode = (value) => {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
};

function resolveVirginiaReceivingCourseCode(row, publishedOwnerCodes = new Set()) {
  const titleCode = normalizeVirginiaCourseCode(row?.title);
  const baseCode = normalizeVirginiaCourseCode(`${row?.prefix || ''}${row?.number || ''}`);
  return titleCode && publishedOwnerCodes.has(titleCode) ? titleCode : baseCode;
}

function defaultVirginiaFigure6Scopes() {
  // Keep these requires lazy. California and Massachusetts never need the
  // Virginia research manifests, and their Figure 6 path remains byte-for-byte
  // independent of this publication boundary.
  return {
    // eslint-disable-next-line global-require
    vccsScopeRows: require('../../.va-degrees/cs_course_scope.json'),
    // eslint-disable-next-line global-require
    universityScope: require('../../.va-catalogs/research/va-university-prerequisite-scope.json'),
  };
}

const uniqueVirginiaIssues = (issues) => [...new Map(issues.map((issue) => [
  `${issue.path}\u0000${issue.code}\u0000${issue.detail || ''}`,
  issue,
])).values()];

/**
 * Deterministic named-course plan for one associate degree.
 *
 * The transfer-credit model already contains the exact subset search needed
 * for a choose-by-units section. Passing empty eligibility sets gives Figure 6
 * a campus-independent minimum-unit reading of the stored requirement tree.
 *
 * Some collected A.S.-T documents flatten a catalogue sequence/grouping into
 * one unit pool. An optimizer can satisfy the numeric floor but cannot recover
 * the missing grouping. Presentation scoring therefore fails closed on every
 * named unit pool by default. Callers may disable that guard only for a
 * diagnostic of the stored flat model; they must retain the returned warning.
 */
function asDegreeCourseIds(asDoc, ccUnits, { strictUnitPools = true } = {}) {
  const sections = associateNamedSections(asDoc);
  const unitPools = sections.filter((section) => section.unit_advisement != null);
  const exactSource = usesCanonicalSourceContract(asDoc);
  if (strictUnitPools && unitPools.length && !exactSource) {
    return {
      ids: [], slots: 0, slotUnits: 0,
      method_status: 'excluded',
      exclusion_reason: AMBIGUOUS_UNIT_POOL,
      method_warning: `${unitPools.length} named choose-by-unit section${unitPools.length === 1 ? '' : 's'} cannot be scored without assuming a course grouping.`,
    };
  }

  const unitsById = new Map([...ccUnits.entries()]
    .map(([id, units]) => [Number(id), Number(units) || 0]));
  const groupHasNamedCourses = (group) => (group?.sections || [])
    .some((section) => (section?.receivers || []).some((receiver) => (
      (receiver?.options || []).some((option) => (option?.course_ids || []).length)
    )));
  // `ge_area` is classification metadata when its group enumerates courses.
  // Only receiver-less GE blocks are aggregate capacity. This is the same
  // distinction used by Figures 3/4, and prevents a named Virginia menu from
  // being silently discarded or counted twice.
  const aggregateGroups = exactSource
    ? (asDoc.requirement_groups || [])
      .filter((group) => group?.ge_area && !group?.units_fill && !groupHasNamedCourses(group))
    : [];
  const malformedAggregate = aggregateGroups.find((group) => {
    const sectionsInGroup = group.sections || [];
    if (sectionsInGroup.length !== 1) return true;
    const minimum = Number(sectionsInGroup[0]?.unit_advisement);
    const maximum = Number(sectionsInGroup[0]?.unit_advisement_max ?? minimum);
    return !Number.isFinite(minimum) || minimum <= 0
      || !Number.isFinite(maximum) || maximum !== minimum;
  });
  if (malformedAggregate) {
    return {
      ids: [], slots: 0, slotUnits: 0,
      method_status: 'excluded',
      exclusion_reason: 'associate_aggregate_requirement_ambiguous',
      method_warning: 'A receiver-less Virginia aggregate requirement has multiple routes or a credit range; Figure 6 will not choose a value the source did not fix.',
    };
  }
  if (exactSource && !(Number(asDoc.total_units) > 0)) {
    return {
      ids: [], slots: 0, slotUnits: 0,
      method_status: 'excluded',
      exclusion_reason: 'associate_degree_total_missing',
      method_warning: 'The Virginia source does not state a positive degree total.',
    };
  }
  const aggregateUnits = aggregateGroups.reduce((sum, group) => (
    sum + Number(group.sections[0].unit_advisement)
  ), 0);
  const plan = planAssociateDegree(
    sections,
    new Set(),
    new Set(),
    unitsById,
    exactSource ? {
      strictConstraints: true,
      paperFigure: '6',
      sourceDocument: asDoc,
      totalUnits: Number(asDoc.total_units),
      totalUnitsMax: Number.isFinite(Number(asDoc.total_units_max))
        ? Number(asDoc.total_units_max) : Number(asDoc.total_units),
      aggregateUnits,
      hasUnitsFill: (asDoc.requirement_groups || []).some((group) => group?.units_fill === true),
    } : {},
  );
  if (!plan.complete || !plan.ids.length) {
    return {
      ids: [], slots: 0, slotUnits: 0,
      method_status: 'excluded',
      exclusion_reason: 'associate_plan_incomplete',
      method_warning: plan.warnings.join(' ') || 'No complete named-course associate-degree plan could be resolved.',
    };
  }
  return {
    ids: plan.ids,
    slots: 0,
    slotUnits: 0,
    selected_units: plan.total,
    method_status: plan.warnings.length ? 'estimated' : 'ok',
    method_warning: plan.warnings.join(' ') || null,
  };
}

const PATHWAY_METRICS = Object.freeze([
  'as_courses', 'as_selected_units', 'requirements_consumed', 'n_courses',
  'n_placeholder', 'n_edges', 'complexity', 'max_delay', 'edge_info_pct',
  'resident_complexity', 'delta_vs_resident',
]);

function excludedPathwayRow(row, warning, reason = 'virginia_source_not_publication_ready') {
  const excluded = {
    ...row,
    method_status: 'excluded',
    exclusion_reason: reason,
    method_warning: warning || 'A Virginia source did not pass the publication gate.',
  };
  for (const field of PATHWAY_METRICS) excluded[field] = null;
  return excluded;
}

function sourceHash(doc) {
  return doc?.provenance?.source_bundle_hash || null;
}

function virginiaFigure6RuntimeDigest(runtime) {
  return sha256VirginiaPrerequisiteValue(canonicalVirginiaPrerequisiteJson({
    publication_generation: runtime?.publication_generation || null,
    verification_receipt_id: runtime?.verification_receipt_id || null,
    verification_receipt_sha256: runtime?.verification_receipt_sha256 || null,
    required_community_college_keys: runtime?.required_community_college_keys || [],
    required_university_keys: runtime?.required_university_keys || [],
    community_college_rows: runtime?.community_college_rows || [],
    university_rows: runtime?.university_rows || [],
  }));
}

function virginiaFigure6RuntimeReady(runtime) {
  const state = runtime && typeof runtime === 'object'
    ? VALIDATED_VA_FIGURE6_RUNTIME_STATE.get(runtime) : null;
  return runtime?.ready === true
    && state != null
    && state.integrity_sha256 === runtime.integrity_sha256
    && state.publication_generation === runtime.publication_generation
    && state.verification_receipt_id === runtime.verification_receipt_id
    && state.verification_receipt_sha256 === runtime.verification_receipt_sha256
    && runtime[VALIDATED_VA_FIGURE6_RUNTIME] === runtime.integrity_sha256
    && typeof runtime.publication_generation === 'string'
    && /^[a-f0-9]{64}$/.test(runtime.publication_generation)
    && Array.isArray(state.corpora)
    && state.corpora.length >= 2;
}

function validatedVirginiaFigure6RuntimeState(runtime) {
  return virginiaFigure6RuntimeReady(runtime)
    ? VALIDATED_VA_FIGURE6_RUNTIME_STATE.get(runtime) : null;
}

function virginiaRuntimeReceiptIssues(receipt, {
  communityCollegeRows = [],
  universityRows = [],
  requiredCommunityCollegeKeys = [],
  requiredUniversityKeys = [],
} = {}) {
  const issues = [];
  if (!receipt) return issues;
  if (receipt.active !== true) {
    issues.push({ path: 'verification_receipt.active', code: 'active_verification_receipt_required' });
  }
  const publishedAt = new Date(receipt.published_at);
  if (!receipt.published_at || Number.isNaN(publishedAt.getTime())) {
    issues.push({ path: 'verification_receipt.published_at', code: 'publication_timestamp_required' });
  }
  const expectedReceiptSha256 = verificationReceiptHash(receipt);
  if (!/^[a-f0-9]{64}$/.test(String(receipt.receipt_sha256 || ''))) {
    issues.push({
      path: 'verification_receipt.receipt_sha256',
      code: 'active_verification_receipt_hash_required',
    });
  } else if (receipt.receipt_sha256 !== expectedReceiptSha256) {
    issues.push({
      path: 'verification_receipt.receipt_sha256',
      code: 'verification_receipt_hash_mismatch',
    });
  }
  const expectedCounts = {
    community_college: communityCollegeRows.length,
    university: universityRows.length,
    required_community_college: requiredCommunityCollegeKeys.length,
    required_university: requiredUniversityKeys.length,
    owners: new Set(universityRows.map((row) => row?.owner_namespace).filter(Boolean)).size,
  };
  for (const [name, expected] of Object.entries(expectedCounts)) {
    if (receipt?.corpus_counts?.[name] !== expected) {
      issues.push({
        path: `verification_receipt.corpus_counts.${name}`,
        code: 'publication_corpus_count_mismatch',
        expected,
        actual: receipt?.corpus_counts?.[name] ?? null,
      });
    }
  }
  return issues;
}

/**
 * Load the only prerequisite model the Virginia scorer is allowed to use.
 *
 * The two corpora and the active human receipt are read independently on
 * purpose: Mongo publication is atomic, while a concurrent or corrupt mixed
 * read cannot reproduce one content-derived generation and therefore fails
 * this boundary. No legacy research row, inactive receipt, partial direct set,
 * unsigned explicit-none claim, or cross-owner formula is compiled.
 */
async function loadVirginiaFigure6PrerequisiteRuntime(db, options = {}) {
  const defaults = options.vccsScopeRows === undefined || options.universityScope === undefined
    ? defaultVirginiaFigure6Scopes() : {};
  const vccsScopeRows = options.vccsScopeRows ?? defaults.vccsScopeRows;
  const universityScope = options.universityScope ?? defaults.universityScope;
  const [communityCollegeRows, universityRows, activeReceipts] = await Promise.all([
    db.collection(VA_FIGURE6_PREREQUISITE_CONTRACT.community_college.collection)
      .find({}).sort({ course_key: 1 }).toArray(),
    db.collection(VA_FIGURE6_PREREQUISITE_CONTRACT.university.collection)
      .find({}).sort({ course_key: 1 }).toArray(),
    db.collection(VA_FIGURE6_PUBLICATION_COLLECTION)
      .find({ active: true }).sort({ _id: 1 }).limit(2).toArray(),
  ]);
  const requiredCommunityCollegeKeys = requiredVccsCourseKeys(vccsScopeRows);
  const requiredUniversityKeys = requiredUniversityCourseKeys(universityScope);
  const receipt = activeReceipts.length === 1 ? activeReceipts[0] : null;
  const boundaryIssues = [];
  if (activeReceipts.length !== 1) {
    boundaryIssues.push({
      path: 'verification_receipt',
      code: activeReceipts.length
        ? 'multiple_active_verification_receipts' : 'active_verification_receipt_missing',
      actual: activeReceipts.length,
    });
  }
  boundaryIssues.push(...virginiaRuntimeReceiptIssues(receipt, {
    communityCollegeRows,
    universityRows,
    requiredCommunityCollegeKeys,
    requiredUniversityKeys,
  }));
  const sourceReport = validateVirginiaFigure6PrerequisiteSources({
    communityCollegeRows,
    universityRows,
    vccsScopeRows,
    universityScope,
    adapterIntegrated: VA_EXACT_FORMULA_ADAPTER.integrated,
    verificationReceipt: receipt,
    requirePublicationContract: true,
  });
  const issues = uniqueVirginiaIssues([...boundaryIssues, ...sourceReport.issues]);
  const compilation = issues.length ? null : compileValidatedVirginiaFormulaCorpora({
    communityCollegeRows,
    universityRows,
    requiredCommunityCollegeKeys,
    requiredUniversityKeys,
  });
  if (compilation && !compilation.ready) issues.push(...compilation.issues);
  const finalIssues = uniqueVirginiaIssues(issues);
  const runtime = {
    ready: finalIssues.length === 0 && compilation?.ready === true,
    blocker: finalIssues.length ? VA_PREREQUISITE_MODEL_BLOCKER : null,
    publication_generation: receipt?.publication_generation || null,
    verification_receipt_id: receipt?._id || null,
    verification_receipt_sha256: receipt?.receipt_sha256 || null,
    receipt,
    contract: VA_FIGURE6_PREREQUISITE_CONTRACT,
    source_report: sourceReport,
    compilation: compilation ? {
      ready: compilation.ready,
      blocker: compilation.blocker,
      adapter: compilation.adapter,
      validation: compilation.validation,
      issues: compilation.issues,
    } : null,
    corpora: compilation?.ready ? compilation.corpora.map((corpus) => Object.freeze({
      owner_namespace: corpus.owner_namespace,
      rows: corpus.rows_by_course_key.size,
    })) : [],
    community_college_rows: communityCollegeRows,
    university_rows: universityRows,
    required_community_college_keys: requiredCommunityCollegeKeys,
    required_university_keys: requiredUniversityKeys,
    official_hosts_by_owner: officialHostsForPrerequisiteScope(universityScope),
    issues: finalIssues,
  };
  if (runtime.ready) {
    runtime.integrity_sha256 = virginiaFigure6RuntimeDigest(runtime);
    Object.defineProperty(runtime, VALIDATED_VA_FIGURE6_RUNTIME, {
      value: runtime.integrity_sha256,
      configurable: false,
    });
    VALIDATED_VA_FIGURE6_RUNTIME_STATE.set(runtime, Object.freeze({
      integrity_sha256: runtime.integrity_sha256,
      publication_generation: runtime.publication_generation,
      verification_receipt_id: runtime.verification_receipt_id,
      verification_receipt_sha256: runtime.verification_receipt_sha256,
      corpora: compilation.corpora,
    }));
  }
  return runtime;
}

function virginiaPathwaySourceGate(asDoc, degree, prerequisiteRuntime = null) {
  const associate = readinessForProjectedFigures(asDoc, {
    label: 'The Virginia associate-degree source',
    figures: ['6'],
  });
  const bachelor = readinessForProjectedFigures(degree, {
    label: 'The Virginia bachelor-degree source',
    figures: ['6'],
  });
  const prerequisiteModelReady = virginiaFigure6RuntimeReady(prerequisiteRuntime);
  const contractIssues = [
    ...canonicalContractIssues(asDoc).map((issue) => `associate:${issue}`),
    ...canonicalContractIssues(degree).map((issue) => `bachelor:${issue}`),
  ];
  const warnings = [
    associate.warning,
    bachelor.warning,
    contractIssues.length
      ? `The canonical analysis contract is incomplete (${contractIssues.join(', ')}).`
      : null,
    !prerequisiteModelReady
      ? 'Virginia Figure 6 is unavailable until complete exact VCCS requisite formulas and university-local prerequisites match one active human publication receipt.'
      : null,
    !prerequisiteModelReady && prerequisiteRuntime?.issues?.length
      ? `Prerequisite boundary blockers: ${prerequisiteRuntime.issues
        .slice(0, 5).map((issue) => issue.code).join(', ')}${prerequisiteRuntime.issues.length > 5 ? ', ...' : ''}.`
      : null,
  ].filter(Boolean);
  return {
    ready: associate.ready && bachelor.ready && contractIssues.length === 0
      && prerequisiteModelReady,
    reason: associate.ready && bachelor.ready
      ? VA_PREREQUISITE_MODEL_BLOCKER : 'virginia_source_not_publication_ready',
    warning: warnings.join(' '),
    associate,
    bachelor,
    prerequisite_model: {
      ready: prerequisiteModelReady,
      publication_generation: prerequisiteModelReady
        ? prerequisiteRuntime.publication_generation : null,
      verification_receipt_id: prerequisiteModelReady
        ? prerequisiteRuntime.verification_receipt_id : null,
    },
  };
}

/** Choose-N cheapest receivers of a degree section, matching the shared reader. */
function pickReceivers(section) {
  const receivers = section.receivers || [];
  const expansion = (r) => (r.receiving?.kind === 'series'
    ? (r.receiving.parent_ids || []).length || 1 : 1);
  const ask = section.section_advisement != null && Number(section.section_advisement) < receivers.length
    ? Math.max(0, Number(section.section_advisement))
    : receivers.length;
  return [...receivers].sort((a, b) => expansion(a) - expansion(b)).slice(0, ask);
}

/**
 * Build one pathway's vertex set. `asIds` empty ⇒ the resident pathway (the
 * degree taken with no transfer), which anchors the per-campus delta exactly
 * as the paper's resident tabs do.
 */
function assemblePathway({
  degree,
  asIds,
  asSlots = 0,
  asSlotUnits = 0,
  agreementByParent,
  ucCatalog,
  ucCodeByParent,
  ccUnits,
  normalizeCatalogCode = (value) => value,
}) {
  // The document-aware tier and course-code fallbacks below interpret the
  // canonical Virginia projection.  California and Massachusetts predate
  // that contract and must retain the legacy two-argument tier reader and
  // parent-id-only lower-division identity lookup; otherwise a display code
  // can silently turn one of their historical placeholder vertices into a
  // catalogue course and move Figure 6.
  const canonicalSource = usesCanonicalSourceContract(degree);
  const tierSourceDocument = canonicalSource ? degree : null;
  const vertices = new Map(); // key -> { units, kind: 'cc'|'uc'|'slot', catalogId }
  const substitution = new Map(); // uc catalogue id -> [cc keys]
  const usedAs = new Set();
  const asAvailable = new Set(asIds);
  const completedArticulations = new Set();
  let electiveUnits = 0;
  let geSkippedCourses = 0;
  let consumed = 0;
  // George Mason and Old Dominion have source-authored cross-section/course
  // reuse rules that an independent choose-N walk cannot enforce.  This plan
  // exists only when the complete institution-specific source shape passes
  // its exact proof; any drift falls back to the generic walk while the
  // publication gate remains closed.
  const exactSelection = gmuOduFigure6Selection(degree);
  const exactCnuSelection = cnuFigureSelection(degree);
  const exactNsuSelection = norfolkStateFigureSelection(degree);
  const exactVmiSelection = vmiFigure6Selection(degree);
  const exactVirginiaTechSelection = standardMathAndPathwaysSelection(
    degree, { figure6: true },
  );
  const exactLongwoodSelection = longwoodFigureSelection(degree);
  const exactVcuNonCourseSelection = vcuFigure6NonCourseSelection(degree);
  const exactNsuNonCourseSections = new Set(
    exactNsuSelection.ready ? exactNsuSelection.non_course_section_keys : [],
  );
  const exactVcuNonCourseSections = new Set(
    exactVcuNonCourseSelection.ready
      ? exactVcuNonCourseSelection.non_course_section_keys : [],
  );
  let exactBridgewaterSelection = bridgewaterTrackSelection(degree, {
    transferEntry: asIds.length > 0,
  });
  let exactBridgewaterLowerPlan = null;

  for (const id of asIds) {
    vertices.set(`cc:${id}`, { units: ccUnits.get(id) ?? null, kind: 'cc' });
  }
  for (let i = 0; i < asSlots; i += 1) {
    vertices.set(`slot:as:${i}`, { units: asSlots ? asSlotUnits / asSlots : null, kind: 'slot' });
  }

  const addUcByCode = (code, fallbackUnits) => {
    const lookupCode = code ? normalizeCatalogCode(code) : null;
    const row = lookupCode ? ucCatalog.get(lookupCode) : null;
    const compactCode = String(lookupCode || code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const exactShared = exactBridgewaterSelection.ready
      && exactBridgewaterSelection.shared_course_codes.includes(compactCode);
    const key = row ? row.id : exactShared
      ? `uc:bridgewater-shared:${compactCode}`
      : `uc:req:${vertices.size}:${code || 'unnamed'}`;
    if (!vertices.has(key)) {
      vertices.set(key, {
        units: row?.units ?? fallbackUnits ?? null,
        kind: row ? 'uc' : 'slot',
        catalogId: row?.id || null,
        // A named course that misses the owner catalogue is not equivalent to
        // a genuinely unnamed degree slot. The exact Virginia bridge rejects
        // this marker instead of silently lowering course and edge counts.
        unresolvedCourseCode: code && !row ? lookupCode || String(code) : null,
      });
    }
    return key;
  };

  // A Bridgewater track series is an indivisible requirement. Build one
  // disjoint sending-course plan for every distinct articulation object; a
  // partial articulation of one receiving course cannot erase the series.
  const exactReceiverPlan = (receiver) => {
    if (!asIds.length) return null;
    const receiving = receiver?.receiving || {};
    const parentIds = receiving.kind === 'series'
      ? (receiving.parent_ids || []) : [receiving.parent_id];
    if (!parentIds.length || parentIds.some((pid) => !agreementByParent.get(pid))) return null;
    const articulations = [...new Set(parentIds.map((pid) => agreementByParent.get(pid)))];
    if (articulations.some((articulation) => !articulation?.options?.length)) return null;
    const chosen = [];
    const locallyUsed = new Set();
    const visit = (index) => {
      if (index >= articulations.length) return true;
      const articulation = articulations[index];
      for (const option of articulation.options) {
        if (!option.length || option.some((id) => (
          !asAvailable.has(id) || usedAs.has(id) || locallyUsed.has(id)
        ))) continue;
        option.forEach((id) => locallyUsed.add(id));
        chosen.push({ articulation, option });
        if (visit(index + 1)) return true;
        chosen.pop();
        option.forEach((id) => locallyUsed.delete(id));
      }
      return false;
    };
    return visit(0) ? { parentIds, chosen } : null;
  };

  const applyExactReceiver = (receiver, fallbackUnits, planned = null) => {
    const receiving = receiver?.receiving || {};
    const parentIds = receiving.kind === 'series'
      ? (receiving.parent_ids || []) : [receiving.parent_id];
    const plan = planned || exactReceiverPlan(receiver);
    if (plan) {
      for (const { articulation, option } of plan.chosen) {
        option.forEach((id) => usedAs.add(id));
        completedArticulations.add(articulation);
        for (const coveredPid of articulation.parentIds || plan.parentIds) {
          const catalogCode = normalizeCatalogCode(ucCodeByParent.get(coveredPid) || '');
          const catalogId = ucCatalog.get(catalogCode)?.id;
          if (catalogId) substitution.set(catalogId, option.map((id) => `cc:${id}`));
        }
      }
      consumed += plan.parentIds.length;
      return true;
    }
    for (const pid of parentIds.length ? parentIds : [null]) {
      addUcByCode(ucCodeByParent.get(pid)
        || receiving.alternatives?.[0]?.code || receiving.code || null, fallbackUnits);
    }
    return false;
  };

  for (const [groupIndex, group] of (degree.requirement_groups || []).entries()) {
    if (exactLongwoodSelection.ready
        && `${groupIndex}:0` === exactLongwoodSelection.proficiency_overlay_section_key) {
      continue;
    }
    if (groupIndex === 2 && exactBridgewaterSelection.ready) {
      const feasible = new Set();
      const plans = (group.sections || []).map((section) => {
        const receiver = section.receivers?.[0];
        const plan = receiver ? exactReceiverPlan(receiver) : null;
        if (plan) plan.parentIds.forEach((pid) => feasible.add(Number(pid)));
        return plan;
      });
      exactBridgewaterSelection = bridgewaterTrackSelection(degree, {
        articulated: feasible,
        transferEntry: asIds.length > 0,
      });
      exactBridgewaterLowerPlan = plans[exactBridgewaterSelection.selected_track_index] || null;
    }
    // An Or-group is ONE choice: the shared reader collapses it to a single
    // path, and walking every alternative counted all twelve of Berkeley
    // biology's tracks into one pathway (the audit's n_courses 96-115 rows).
    // Take the cheapest section by receiver expansion, as the reader prices it.
    const allSections = (group.sections || []).map((section, sectionIndex) => (
      (exactSelection.ready
        ? exactSelection.virtual_sections?.[`${groupIndex}:${sectionIndex}`] : null)
        || (exactLongwoodSelection.ready
          ? exactLongwoodSelection.virtual_sections?.[`${groupIndex}:${sectionIndex}`] : null)
        || section
    ));
    const isOr = String(group.group_conjunction || '').toLowerCase() === 'or'
      && allSections.length > 1;
    const sectionCost = (section) => pickReceivers(section)
      .reduce((sum, r) => sum + (r.receiving?.kind === 'series'
        ? (r.receiving.parent_ids || []).length || 1 : 1), 0);
    const bridgewaterSectionIndex = exactBridgewaterSelection.ready
      ? exactBridgewaterSelection.group_section_indices[groupIndex] : null;
    const longwoodSectionIndex = exactLongwoodSelection.ready
      ? exactLongwoodSelection.group_section_indices[groupIndex] : null;
    const exactSectionIndex = Number.isInteger(bridgewaterSectionIndex)
      ? bridgewaterSectionIndex
      : (exactSelection.ready ? exactSelection.group_section_indices[groupIndex]
        : (Number.isInteger(longwoodSectionIndex) ? longwoodSectionIndex : null));
    const sections = isOr
      ? (Number.isInteger(exactSectionIndex)
        ? [{ section: allSections[exactSectionIndex], sectionIndex: exactSectionIndex }]
        : [[...allSections].sort((a, b) => sectionCost(a) - sectionCost(b))[0]]
          .map((section) => ({ section, sectionIndex: allSections.indexOf(section) })))
      : allSections.map((section, sectionIndex) => ({ section, sectionIndex }));
    for (const { section, sectionIndex } of sections) {
      if (exactNsuNonCourseSections.has(`${groupIndex}:${sectionIndex}`)) continue;
      if (exactVcuNonCourseSections.has(`${groupIndex}:${sectionIndex}`)) continue;
      const longwoodSectionKey = `${groupIndex}:${sectionIndex}`;
      if (exactLongwoodSelection.ready
          && exactLongwoodSelection.perspective_section_keys.includes(longwoodSectionKey)) {
        const slotIndex = exactLongwoodSelection.perspective_section_keys
          .indexOf(longwoodSectionKey);
        addUcByCode(
          exactLongwoodSelection.selected_perspective_course_codes[slotIndex],
          Number(section.unit_advisement) || 3,
        );
        continue;
      }
      const category = section.category
        || (resolveSectionTier(group, section, tierSourceDocument) === 'nontransferable'
          ? 'upper-division' : 'lower-division');
      if (category === 'unit-accounting') continue;
      if (category === 'electives') { electiveUnits += Number(section.unit_advisement) || 0; continue; }
      const gmuOduReceiverIndices = exactSelection.ready
        ? exactSelection.section_receiver_indices[`${groupIndex}:${sectionIndex}`] : null;
      const cnuReceiverIndices = exactCnuSelection.ready
        ? exactCnuSelection.section_receiver_indices[`${groupIndex}:${sectionIndex}`] : null;
      const nsuReceiverIndices = exactNsuSelection.ready
        ? exactNsuSelection.section_receiver_indices[`${groupIndex}:${sectionIndex}`] : null;
      const vmiReceiverIndices = exactVmiSelection.ready
        ? exactVmiSelection.section_receiver_indices[`${groupIndex}:${sectionIndex}`] : null;
      const virginiaTechReceiverIndices = exactVirginiaTechSelection.ready
        ? exactVirginiaTechSelection.section_receiver_indices[`${groupIndex}:${sectionIndex}`] : null;
      const longwoodReceiverIndices = exactLongwoodSelection.ready
        ? exactLongwoodSelection.section_receiver_indices[`${groupIndex}:${sectionIndex}`] : null;
      const exactReceiverIndices = Array.isArray(gmuOduReceiverIndices)
        ? gmuOduReceiverIndices
        : (Array.isArray(cnuReceiverIndices)
          ? cnuReceiverIndices
          : (Array.isArray(nsuReceiverIndices)
            ? nsuReceiverIndices
            : (Array.isArray(vmiReceiverIndices)
              ? vmiReceiverIndices
              : (Array.isArray(virginiaTechReceiverIndices)
                ? virginiaTechReceiverIndices : longwoodReceiverIndices))));
      const receivers = Array.isArray(exactReceiverIndices)
        ? exactReceiverIndices.map((index) => section.receivers?.[index]).filter(Boolean)
        : pickReceivers(section);
      const perReceiverUnits = receivers.length && Number(section.unit_advisement)
        ? Number(section.unit_advisement) / receivers.length : null;

      if (exactLongwoodSelection.ready && [11, 12].includes(groupIndex)) {
        for (const receiver of receivers) {
          const code = receiver.code_seen || receiver.receiving?.code || null;
          addUcByCode(code, receiver.receiving?.units ?? perReceiverUnits);
        }
        continue;
      }

      if (category === 'general-education') {
        const exactCodes = receivers.map((receiver) => String(
          receiver?.code_seen || receiver?.receiving?.code || '',
        ).toUpperCase().replace(/[^A-Z0-9]/g, ''));
        const exactBridgewaterNamedGate = exactBridgewaterSelection.ready
          && (groupIndex === 4
            || (groupIndex === 5 && exactCodes.length
              && exactCodes.every((code) => code === 'CSCI400')));
        const exactGmuOduNamedGate = exactSelection.ready
          && exactSelection.named_general_education_section_keys
            ?.includes(`${groupIndex}:${sectionIndex}`);
        if (exactBridgewaterNamedGate || exactGmuOduNamedGate) {
          for (const receiver of receivers) {
            applyExactReceiver(receiver, receiver?.receiving?.units ?? perReceiverUnits);
          }
          continue;
        }
        if (resolveSectionTier(group, section, tierSourceDocument) !== 'nontransferable') {
          // IGETC-satisfiable: covered on the AS side. Gathered associate
          // records preserve the GE block but not a student's selected GE
          // courses, so the transfer graph has no invented GE vertices;
          // resident pathways retain the campus requirement as slots.
          if (asIds.length) { geSkippedCourses += receivers.length; continue; }
          receivers.forEach((_, index) => {
            vertices.set(`slot:ge:${group.title || ''}:${section.category}:${vertices.size}:${index}`,
              { units: perReceiverUnits, kind: 'slot' });
          });
        } else {
          // Campus-only GE (a DC slot, upper-division writing): stays for
          // transfer and resident alike.
          for (const receiver of receivers) {
            const code = receiver.receiving?.alternatives?.[0]?.code || receiver.receiving?.code || null;
            addUcByCode(code && !/^(GE|AH&I|ELECTIVE)/i.test(code) ? code : null, perReceiverUnits);
          }
        }
        continue;
      }

      if (category === 'upper-division') {
        if (section.eligibility) {
          const slots = Number(section.eligibility.courses_required) || receivers.length || 1;
          const each = Number(section.unit_advisement) ? Number(section.unit_advisement) / slots : null;
          for (let i = 0; i < slots; i += 1) {
            vertices.set(`slot:pool:${degree._id}:${vertices.size}:${i}`, { units: each, kind: 'slot' });
          }
          continue;
        }
        for (const receiver of receivers) {
          const receiving = receiver.receiving || {};
          if (receiving.kind === 'series') {
            for (const pid of receiving.parent_ids || []) addUcByCode(ucCodeByParent.get(pid) || null, perReceiverUnits);
            continue;
          }
          const code = receiving.alternatives?.[0]?.code || receiving.code
            || ucCodeByParent.get(receiving.parent_id) || null;
          addUcByCode(code && !/^(GE|AH&I|ELECTIVE)/i.test(code) ? code : null, perReceiverUnits);
        }
        continue;
      }

      // lower-division: satisfiable by transfer when this pair's agreement
      // articulates it AND the associate degree still has the sending courses
      // to spend — the multiset rule.
      for (const receiver of receivers) {
        if (exactBridgewaterSelection.ready && groupIndex === 2) {
          applyExactReceiver(receiver, perReceiverUnits, exactBridgewaterLowerPlan);
          continue;
        }
        const receiving = receiver.receiving || {};
        const parentIds = receiving.kind === 'series' ? (receiving.parent_ids || []) : [receiving.parent_id];
        let covered = false;
        if (asIds.length) {
          for (const pid of parentIds) {
            const articulation = agreementByParent.get(pid);
            if (!articulation?.options?.length) continue;
            // ASSIST may express one sending option against a receiving
            // series.  Completing that option satisfies the whole series; it
            // is not spent again independently for each receiving course.
            // Preserve one shared articulation object in agreementByParent so
            // later degree receivers in the same series recognize the prior
            // completion.  Every covered UC course rewires to the same sending
            // sequence for downstream prerequisite edges.
            if (completedArticulations.has(articulation)) {
              consumed += 1;
              covered = true;
              continue;
            }
            const option = articulation.options.find((ids) => ids.length
              && ids.every((id) => asAvailable.has(id) && !usedAs.has(id)));
            if (option) {
              option.forEach((id) => usedAs.add(id));
              completedArticulations.add(articulation);
              consumed += 1;
              for (const coveredPid of articulation.parentIds || [pid]) {
                const catalogCode = normalizeCatalogCode(ucCodeByParent.get(coveredPid) || '');
                const catalogId = ucCatalog.get(catalogCode)?.id;
                if (catalogId) substitution.set(catalogId, option.map((id) => `cc:${id}`));
              }
              covered = true;
            }
          }
        }
        if (covered) continue;
        for (const pid of parentIds.length ? parentIds : [null]) {
          addUcByCode(
            ucCodeByParent.get(pid)
              || (canonicalSource ? receiving.code || receiver.code_seen : null)
              || null,
            perReceiverUnits,
          );
        }
      }
    }
  }

  // Elective capacity: the paper's blue rows. AS courses that satisfied
  // nothing already sit in the pathway and absorb capacity first.
  const standardUnit = degree.unit_system === 'semester' ? 4 : 4.5;
  const leftover = (asIds.length + asSlots) - usedAs.size - geSkippedCourses;
  const electiveSlots = Math.max(0, Math.round(electiveUnits / standardUnit) - Math.max(0, leftover));
  for (let i = 0; i < electiveSlots; i += 1) {
    vertices.set(`slot:elective:${i}`, { units: standardUnit, kind: 'slot' });
  }

  return {
    vertices,
    substitution,
    consumed,
    exact_non_course_condition_bindings: exactLongwoodSelection.ready
      ? exactLongwoodSelection.prerequisite_condition_bindings : {},
  };
}

const vaFormulaArray = (value) => Array.isArray(value) ? value : [];

function virginiaOwnerOwnsCourseKey(ownerNamespace, courseKey) {
  const owner = String(ownerNamespace || '').trim();
  const key = String(courseKey || '').trim();
  if (!owner || !key) return false;
  if (owner === 'va:vccs') return /^va:[^:]+$/.test(key);
  return /^va:uni:\d+$/.test(owner) && key.startsWith(`${owner}:`)
    && key.length > owner.length + 1;
}

function exactFormulaGroupId(courseKey, group, groupIndex) {
  return String(group?.id || `${courseKey}:formula:${groupIndex}`);
}

/**
 * Compile one owner-scoped Virginia requisite corpus without changing its
 * boolean shape. Sibling groups remain simultaneous requirements, `paths`
 * remain alternatives, and every `all_of` member remains conjunctive.
 *
 * This intentionally repeats the safety-critical checks at the analysis
 * boundary. Import validation alone is insufficient protection for cached or
 * directly supplied rows, and a `missing`/`unparsed` row must never look like
 * an explicit no-prerequisite row to Figure 6.
 */
function compileExactVirginiaFormulaCorpus({
  rows = [], requiredCourseKeys = [], ownerNamespace = null, validated = false,
} = {}) {
  const issues = [];
  const rowsByCourseKey = new Map();
  const owner = String(ownerNamespace || '').trim();
  if (!validated) {
    issues.push({ path: 'validation', code: 'validated_prerequisite_corpus_required' });
  }
  if (!owner) {
    issues.push({ path: 'owner_namespace', code: 'owner_namespace_required' });
  }

  for (const [rowIndex, sourceRow] of vaFormulaArray(rows).entries()) {
    const path = `rows[${rowIndex}]`;
    const row = {
      ...sourceRow,
      groups: vaFormulaArray(sourceRow?.groups).map((group) => ({
        ...group,
        paths: vaFormulaArray(group?.paths).map((formulaPath) => ({
          ...formulaPath,
          all_of: vaFormulaArray(formulaPath?.all_of)
            .map((condition) => ({ ...condition })),
        })),
      })),
    };
    const courseKey = String(row.course_key || '').trim();
    if (!courseKey) {
      issues.push({ path: `${path}.course_key`, code: 'course_key_required' });
      continue;
    }
    if (rowsByCourseKey.has(courseKey)) {
      issues.push({ path: `${path}.course_key`, code: 'duplicate_course_requisite' });
      continue;
    }
    rowsByCourseKey.set(courseKey, row);

    if (row.owner_namespace !== owner) {
      issues.push({ path: `${path}.owner_namespace`, code: 'owner_namespace_mismatch' });
    }
    if (!virginiaOwnerOwnsCourseKey(owner, courseKey)) {
      issues.push({ path: `${path}.course_key`, code: 'course_key_outside_owner_namespace' });
    }
    if (!['parsed', 'none'].includes(row.status)) {
      issues.push({ path: `${path}.status`, code: 'requisite_status_not_publishable' });
      continue;
    }
    if (row.status === 'none') {
      if (row.groups.length) {
        issues.push({ path: `${path}.groups`, code: 'explicit_none_has_formula' });
      }
      continue;
    }
    if (!row.groups.length) {
      issues.push({ path: `${path}.groups`, code: 'parsed_requisite_missing_formula' });
      continue;
    }

    for (const [groupIndex, group] of row.groups.entries()) {
      const groupPath = `${path}.groups[${groupIndex}]`;
      if (group.formula !== VA_PREREQUISITE_FORMULA) {
        issues.push({ path: `${groupPath}.formula`, code: 'lossless_formula_contract_required' });
      }
      if (!['prerequisite', 'corequisite'].includes(group.kind)) {
        issues.push({ path: `${groupPath}.kind`, code: 'requisite_kind_not_supported' });
      }
      if (!group.paths.length) {
        issues.push({ path: `${groupPath}.paths`, code: 'formula_paths_required' });
      }
      for (const [pathIndex, formulaPath] of group.paths.entries()) {
        const formulaPathName = `${groupPath}.paths[${pathIndex}]`;
        if (!formulaPath.all_of.length) {
          issues.push({
            path: `${formulaPathName}.all_of`, code: 'formula_conjunction_required',
          });
        }
        for (const [conditionIndex, condition] of formulaPath.all_of.entries()) {
          const conditionPath = `${formulaPathName}.all_of[${conditionIndex}]`;
          if (condition.type === 'course') {
            const prerequisiteKey = String(condition.course_key || '').trim();
            if (!prerequisiteKey) {
              issues.push({ path: `${conditionPath}.course_key`, code: 'course_key_required' });
            } else if (!virginiaOwnerOwnsCourseKey(owner, prerequisiteKey)) {
              issues.push({
                path: `${conditionPath}.course_key`,
                code: 'prerequisite_key_outside_owner_namespace',
              });
            }
          } else if (condition.type !== 'non_course') {
            issues.push({ path: `${conditionPath}.type`, code: 'requisite_condition_not_supported' });
          }
        }
      }
    }
  }

  for (const requiredKey of [...new Set(vaFormulaArray(requiredCourseKeys).map(String))]) {
    if (!rowsByCourseKey.has(requiredKey)) {
      issues.push({
        path: `required_course_keys.${requiredKey}`,
        code: 'required_course_requisite_missing',
      });
    } else if (!virginiaOwnerOwnsCourseKey(owner, requiredKey)) {
      issues.push({
        path: `required_course_keys.${requiredKey}`,
        code: 'required_course_key_outside_owner_namespace',
      });
    }
  }

  // Formula closure is checked after the complete owner map is known. A
  // missing closure row is different from an out-of-path course: the former is
  // a corpus defect and blocks every use of the compiled owner.
  for (const [courseKey, row] of rowsByCourseKey.entries()) {
    for (const [groupIndex, group] of row.groups.entries()) {
      for (const [pathIndex, formulaPath] of group.paths.entries()) {
        for (const [conditionIndex, condition] of formulaPath.all_of.entries()) {
          if (condition.type !== 'course') continue;
          const prerequisiteKey = String(condition.course_key || '').trim();
          if (prerequisiteKey && !rowsByCourseKey.has(prerequisiteKey)) {
            issues.push({
              path: `${courseKey}.groups[${groupIndex}].paths[${pathIndex}].all_of[${conditionIndex}]`,
              code: 'prerequisite_formula_closure_missing',
            });
          }
        }
      }
    }
  }

  const compiled = {
    ready: issues.length === 0,
    blocker: issues.length ? VA_PREREQUISITE_MODEL_BLOCKER : null,
    adapter: VA_EXACT_FORMULA_ADAPTER,
    owner_namespace: owner || null,
    rows_by_course_key: rowsByCourseKey,
    issues,
  };
  if (compiled.ready) compiled[VALIDATED_VA_FORMULA_CORPUS] = true;
  return compiled;
}

/**
 * Validate both required authority domains, then compile each owner in
 * isolation. Keeping validation and compilation in one public entry point
 * prevents analysis callers from bypassing source URL/hash, status, closure,
 * condition-type, or ownership checks enforced by the shared contract.
 */
function compileValidatedVirginiaFormulaCorpora({
  communityCollegeRows = [],
  universityRows = [],
  requiredCommunityCollegeKeys = [],
  requiredUniversityKeys = [],
} = {}) {
  const validation = validateVirginiaFigure6PrerequisiteCorpus({
    communityCollegeRows,
    universityRows,
    requiredCommunityCollegeKeys,
    requiredUniversityKeys,
    adapterIntegrated: VA_EXACT_FORMULA_ADAPTER.integrated,
  });
  if (!validation.ready) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      adapter: VA_EXACT_FORMULA_ADAPTER,
      validation,
      corpora: [],
      issues: validation.issues,
    };
  }

  const corpora = [compileExactVirginiaFormulaCorpus({
    rows: communityCollegeRows,
    requiredCourseKeys: requiredCommunityCollegeKeys,
    ownerNamespace: 'va:vccs',
    validated: true,
  })];
  const universityOwners = [...new Set([
    ...universityRows.map((row) => String(row?.owner_namespace || '').trim()),
    ...requiredUniversityKeys.map((key) => {
      const match = /^(va:uni:\d+):/.exec(String(key));
      return match?.[1] || '';
    }),
  ].filter(Boolean))].sort();
  for (const ownerNamespace of universityOwners) {
    corpora.push(compileExactVirginiaFormulaCorpus({
      rows: universityRows.filter((row) => row?.owner_namespace === ownerNamespace),
      requiredCourseKeys: requiredUniversityKeys.filter((key) => (
        String(key).startsWith(`${ownerNamespace}:`)
      )),
      ownerNamespace,
      validated: true,
    }));
  }
  const issues = corpora.flatMap((corpus) => corpus.issues);
  return {
    ready: issues.length === 0,
    blocker: issues.length ? VA_PREREQUISITE_MODEL_BLOCKER : null,
    adapter: VA_EXACT_FORMULA_ADAPTER,
    validation,
    corpora: issues.length ? [] : corpora,
    issues,
  };
}

function exactVirginiaConditionResolution(
  condition,
  inSet,
  substitutions,
  { courseKey = null, nonCourseConditionBindings = {} } = {},
) {
  if (condition.type === 'non_course') {
    const conditionHash = sha256VirginiaPrerequisiteValue(
      canonicalVirginiaPrerequisiteJson(condition),
    );
    const binding = nonCourseConditionBindings?.[courseKey]?.[conditionHash];
    const parentKeys = Array.isArray(binding) ? [...new Set(binding)] : [];
    if (!parentKeys.length) {
      return { ready: false, external: true, parents: [], issue: 'non_course_condition_unresolved' };
    }
    const ownerNamespace = String(courseKey || '').match(/^(va:uni:\d+):/)?.[1] || null;
    if (parentKeys.length !== binding.length
        || parentKeys.some((key) => (
          typeof key !== 'string'
          || (!key.startsWith('slot:')
            && !(ownerNamespace && key.startsWith(`${ownerNamespace}:`)))
        ))) {
      return { ready: false, external: false, parents: [], issue: 'non_course_condition_binding_shape_invalid' };
    }
    if (parentKeys.some((key) => !inSet.has(key))) {
      return { ready: false, external: false, parents: [], issue: 'non_course_condition_binding_vertex_missing' };
    }
    return {
      ready: true,
      external: false,
      parents: parentKeys,
      issue: null,
      condition_hash: conditionHash,
    };
  }
  if (condition.type !== 'course') {
    return { ready: false, external: true, parents: [], issue: 'non_course_condition_unresolved' };
  }
  const target = String(condition.course_key || '').trim();
  const direct = inSet.has(target);
  const replacement = substitutions.get(target);
  const replacementKeys = Array.isArray(replacement) && replacement.every((key) => (
    typeof key === 'string' && !Array.isArray(key)
  )) ? [...new Set(replacement)] : [];
  const replacementReady = replacementKeys.length > 0
    && replacementKeys.every((key) => inSet.has(key));
  if (replacement != null && !replacementKeys.length) {
    return { ready: false, external: false, parents: [], issue: 'substitution_shape_not_supported' };
  }
  if (direct && replacementReady) {
    return { ready: false, external: false, parents: [], issue: 'direct_and_substitution_both_present' };
  }
  if (direct) return { ready: true, external: false, parents: [target], issue: null };
  if (replacementReady) {
    return { ready: true, external: false, parents: replacementKeys, issue: null };
  }
  return { ready: false, external: false, parents: [], issue: 'formula_course_not_in_pathway' };
}

/**
 * Resolve one exact row against a fixed pathway course set.
 *
 * A multi-path formula resolves only when exactly one complete, course-only
 * path is represented. Choosing the first path, unioning paths, or treating an
 * unresolved placement/consent alternative as an empty edge would each change
 * the source formula, so all three cases fail closed.
 */
function resolveExactVirginiaFormulaRow({
  compiledCorpus,
  courseKey,
  pathwayCourseKeys = [],
  substitutions = new Map(),
  pathwayVertexKeys = null,
  nonCourseConditionBindings = {},
} = {}) {
  const issues = [];
  if (!compiledCorpus?.ready || compiledCorpus[VALIDATED_VA_FORMULA_CORPUS] !== true) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      course_key: courseKey || null,
      parents: null,
      selected_paths: [],
      issues: [{ path: 'compiled_corpus', code: 'formula_corpus_not_ready' }],
    };
  }
  const row = compiledCorpus.rows_by_course_key.get(String(courseKey || ''));
  if (!row) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      course_key: courseKey || null,
      parents: null,
      selected_paths: [],
      issues: [{ path: String(courseKey || 'course_key'), code: 'required_course_requisite_missing' }],
    };
  }
  if (row.status !== 'parsed' && row.status !== 'none') {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      course_key: row.course_key,
      parents: null,
      selected_paths: [],
      issues: [{ path: `${row.course_key}.status`, code: 'requisite_status_not_publishable' }],
    };
  }
  if (row.status === 'none') {
    return {
      ready: true, blocker: null, course_key: row.course_key,
      parents: [], selected_paths: [], issues: [],
    };
  }

  const courseSet = pathwayCourseKeys instanceof Set
    ? pathwayCourseKeys : new Set(vaFormulaArray(pathwayCourseKeys).map(String));
  const inSet = new Set([
    ...courseSet,
    ...(pathwayVertexKeys instanceof Set
      ? pathwayVertexKeys
      : vaFormulaArray(pathwayVertexKeys).map(String)),
  ]);
  const selectedPaths = [];
  const parents = [];
  for (const [groupIndex, group] of row.groups.entries()) {
    const groupId = exactFormulaGroupId(row.course_key, group, groupIndex);
    const pathResolutions = group.paths.map((formulaPath, pathIndex) => {
      const conditionResolutions = formulaPath.all_of
        .map((condition) => exactVirginiaConditionResolution(
          condition,
          inSet,
          substitutions,
          { courseKey: row.course_key, nonCourseConditionBindings },
        ));
      const groupLevelExternal = vaFormulaArray(group.non_course_alternatives).length > 0;
      const pathLevelExternal = vaFormulaArray(formulaPath.non_course_alternatives).length > 0;
      return {
        path: formulaPath,
        path_id: String(formulaPath.id || `${groupId}:path:${pathIndex}`),
        path_index: pathIndex,
        parents: [...new Set(conditionResolutions.flatMap((result) => result.parents))],
        ready: !groupLevelExternal && !pathLevelExternal
          && conditionResolutions.length > 0
          && conditionResolutions.every((result) => result.ready),
        external: groupLevelExternal || pathLevelExternal
          || conditionResolutions.some((result) => result.external),
        condition_resolutions: conditionResolutions,
      };
    });
    const externallyUnresolved = pathResolutions.filter((path) => path.external
      && path.condition_resolutions.every((result) => result.ready || result.external));
    const represented = pathResolutions.filter((path) => path.ready);

    if (externallyUnresolved.length) {
      issues.push({
        path: groupId,
        code: 'non_course_formula_path_unresolved',
        path_ids: externallyUnresolved.map((path) => path.path_id),
      });
      continue;
    }
    if (!represented.length) {
      issues.push({
        path: groupId,
        code: 'no_complete_formula_path_in_pathway',
        path_issues: pathResolutions.map((path) => ({
          path_id: path.path_id,
          condition_issues: path.condition_resolutions
            .map((result) => result.issue).filter(Boolean),
        })),
      });
      continue;
    }
    if (represented.length > 1) {
      issues.push({
        path: groupId,
        code: 'multiple_formula_paths_represented',
        path_ids: represented.map((path) => path.path_id),
      });
      continue;
    }
    const selected = represented[0];
    selectedPaths.push({
      formula_id: groupId,
      kind: group.kind,
      path_id: selected.path_id,
      path_index: selected.path_index,
      // Keep the full source path available to audits. `parents` is merely its
      // graph projection after an exact path has been established.
      path: selected.path,
      parents: selected.parents,
    });
    parents.push(...selected.parents);
  }

  return {
    ready: issues.length === 0,
    blocker: issues.length ? VA_PREREQUISITE_MODEL_BLOCKER : null,
    course_key: row.course_key,
    parents: issues.length ? null : [...new Set(parents)].filter((key) => key !== row.course_key),
    selected_paths: issues.length ? [] : selectedPaths,
    issues,
  };
}

function virginiaParentMapCycle(parentsByCourseKey) {
  const active = new Set();
  const complete = new Set();
  const walk = (key, stack) => {
    if (active.has(key)) return [...stack.slice(stack.indexOf(key)), key];
    if (complete.has(key)) return null;
    active.add(key);
    stack.push(key);
    for (const parent of parentsByCourseKey.get(key) || []) {
      if (!parentsByCourseKey.has(parent)) continue;
      const cycle = walk(parent, stack);
      if (cycle) return cycle;
    }
    stack.pop();
    active.delete(key);
    complete.add(key);
    return null;
  };
  for (const key of parentsByCourseKey.keys()) {
    const cycle = walk(key, []);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Build the fixed parent map consumed by `curricularComplexity`, but never a
 * partial one. The caller must supply only real course vertices (not slots)
 * and must already bridge numeric pathway ids into the owner-scoped keys.
 */
function buildExactVirginiaParentMap({
  compiledCorpora = [],
  pathwayCourseKeys = [],
  substitutions = new Map(),
  pathwayVertexKeys = null,
  nonCourseConditionBindings = {},
} = {}) {
  const issues = [];
  const rowsByCourseKey = new Map();
  for (const [corpusIndex, corpus] of vaFormulaArray(compiledCorpora).entries()) {
    if (!corpus?.ready || corpus[VALIDATED_VA_FORMULA_CORPUS] !== true) {
      issues.push({ path: `compiled_corpora[${corpusIndex}]`, code: 'formula_corpus_not_ready' });
      continue;
    }
    for (const [key, row] of corpus.rows_by_course_key.entries()) {
      if (rowsByCourseKey.has(key)) {
        issues.push({ path: key, code: 'course_key_cross_owner_collision' });
      } else {
        rowsByCourseKey.set(key, { row, corpus });
      }
    }
  }
  const inSet = pathwayCourseKeys instanceof Set
    ? new Set(pathwayCourseKeys) : new Set(vaFormulaArray(pathwayCourseKeys).map(String));
  const vertexSet = new Set([
    ...inSet,
    ...(pathwayVertexKeys instanceof Set
      ? pathwayVertexKeys
      : vaFormulaArray(pathwayVertexKeys).map(String)),
  ]);
  const parentsByCourseKey = new Map();
  const selectedPaths = [];
  if (!issues.length) {
    for (const courseKey of inSet) {
      const owned = rowsByCourseKey.get(courseKey);
      if (!owned) {
        issues.push({ path: courseKey, code: 'required_course_requisite_missing' });
        continue;
      }
      const resolved = resolveExactVirginiaFormulaRow({
        compiledCorpus: owned.corpus,
        courseKey,
        pathwayCourseKeys: inSet,
        substitutions,
        pathwayVertexKeys: vertexSet,
        nonCourseConditionBindings,
      });
      if (!resolved.ready) {
        issues.push(...resolved.issues.map((issue) => ({ ...issue, course_key: courseKey })));
        continue;
      }
      parentsByCourseKey.set(courseKey, resolved.parents);
      selectedPaths.push(...resolved.selected_paths.map((selection) => ({
        ...selection, course_key: courseKey,
      })));
    }
  }
  if (!issues.length) {
    const cycle = virginiaParentMapCycle(parentsByCourseKey);
    if (cycle) issues.push({ path: 'parent_map', code: 'requisite_graph_cycle', cycle });
  }
  return {
    ready: issues.length === 0,
    blocker: issues.length ? VA_PREREQUISITE_MODEL_BLOCKER : null,
    adapter: VA_EXACT_FORMULA_ADAPTER,
    parents_by_course_key: issues.length ? null : parentsByCourseKey,
    selected_paths: issues.length ? [] : selectedPaths,
    issues,
  };
}

function runtimeVirginiaCourseKeys(runtime) {
  const state = validatedVirginiaFigure6RuntimeState(runtime);
  return new Set((state?.corpora || []).flatMap((corpus) => (
    [...corpus.rows_by_course_key.keys()]
  )));
}

/**
 * Translate the shared projection's numeric sending vertices and local
 * receiving catalogue vertices into the owner-scoped identities signed by the
 * prerequisite publication. This is a bijection: aliases, duplicate numeric
 * ids, missing canonical keys, and named-course placeholders all block the
 * pathway rather than being guessed from display text.
 */
function bridgeVirginiaPathwayIdentities({
  pathway,
  sendingCourses = [],
  prerequisiteRuntime = null,
  universityOwner = null,
} = {}) {
  const issues = [];
  if (!virginiaFigure6RuntimeReady(prerequisiteRuntime)) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      course_keys: null,
      course_key_by_vertex: null,
      substitutions: null,
      issues: [{ path: 'prerequisite_runtime', code: 'validated_publication_runtime_required' }],
    };
  }
  const availableKeys = runtimeVirginiaCourseKeys(prerequisiteRuntime);
  const sendingById = new Map();
  for (const [index, row] of vaFormulaArray(sendingCourses).entries()) {
    const id = row?.course_id == null ? '' : String(row.course_id);
    if (!id) continue;
    if (sendingById.has(id)) {
      issues.push({ path: `sending_courses[${index}].course_id`, code: 'sending_course_id_collision' });
    } else {
      sendingById.set(id, row);
    }
  }

  const courseKeyByVertex = new Map();
  const vertexByCourseKey = new Map();
  const vertices = pathway?.vertices instanceof Map ? pathway.vertices : new Map();
  for (const [vertexKey, meta] of vertices) {
    if (meta?.kind === 'slot') {
      if (meta.unresolvedCourseCode) {
        issues.push({
          path: vertexKey,
          code: 'named_university_course_identity_unresolved',
          course_code: meta.unresolvedCourseCode,
        });
      }
      continue;
    }
    let courseKey = null;
    if (meta?.kind === 'cc' || String(vertexKey).startsWith('cc:')) {
      const numericId = String(vertexKey).replace(/^cc:/, '');
      const row = sendingById.get(numericId);
      courseKey = String(row?.course_key || '').trim() || null;
      if (!row) {
        issues.push({ path: vertexKey, code: 'sending_course_identity_missing' });
      } else if (!courseKey) {
        issues.push({ path: vertexKey, code: 'sending_canonical_course_key_missing' });
      }
    } else {
      courseKey = String(meta?.catalogId || vertexKey || '').trim() || null;
      if (!courseKey || !/^va:uni:\d+:[^:]+$/.test(courseKey)) {
        issues.push({ path: vertexKey, code: 'university_canonical_course_key_missing' });
      } else if (universityOwner && !courseKey.startsWith(`${universityOwner}:`)) {
        issues.push({ path: vertexKey, code: 'university_course_outside_pathway_owner' });
      }
    }
    if (!courseKey) continue;
    if (!availableKeys.has(courseKey)) {
      issues.push({ path: vertexKey, code: 'course_identity_outside_published_corpus', course_key: courseKey });
      continue;
    }
    if (vertexByCourseKey.has(courseKey)) {
      issues.push({ path: vertexKey, code: 'pathway_course_identity_collision', course_key: courseKey });
      continue;
    }
    courseKeyByVertex.set(vertexKey, courseKey);
    vertexByCourseKey.set(courseKey, vertexKey);
  }

  const substitutions = new Map();
  const sourceSubstitutions = pathway?.substitution instanceof Map
    ? pathway.substitution : new Map();
  for (const [targetValue, replacementVertices] of sourceSubstitutions) {
    const target = String(targetValue || '').trim();
    if (!availableKeys.has(target) || (universityOwner && !target.startsWith(`${universityOwner}:`))) {
      issues.push({ path: `substitution.${target}`, code: 'substitution_target_outside_published_owner' });
      continue;
    }
    if (!Array.isArray(replacementVertices) || !replacementVertices.length) {
      issues.push({ path: `substitution.${target}`, code: 'substitution_shape_not_supported' });
      continue;
    }
    const replacements = replacementVertices.map((vertex) => courseKeyByVertex.get(vertex));
    if (replacements.some((key) => !key)) {
      issues.push({ path: `substitution.${target}`, code: 'substitution_replacement_identity_missing' });
      continue;
    }
    substitutions.set(target, [...new Set(replacements)]);
  }

  return {
    ready: issues.length === 0,
    blocker: issues.length ? VA_PREREQUISITE_MODEL_BLOCKER : null,
    course_keys: issues.length ? null : new Set(vertexByCourseKey.keys()),
    course_key_by_vertex: issues.length ? null : courseKeyByVertex,
    vertex_by_course_key: issues.length ? null : vertexByCourseKey,
    substitutions: issues.length ? null : substitutions,
    issues,
  };
}

function exactVirginiaRowsByCourseKey(runtime) {
  const state = validatedVirginiaFigure6RuntimeState(runtime);
  return new Map((state?.corpora || []).flatMap((corpus) => (
    [...corpus.rows_by_course_key.entries()]
  )));
}

function exactVirginiaConditionRepresented(
  condition,
  courseKey,
  vertexKeys,
  substitutions,
  nonCourseConditionBindings,
) {
  return exactVirginiaConditionResolution(
    condition,
    vertexKeys,
    substitutions,
    { courseKey, nonCourseConditionBindings },
  ).ready;
}

/**
 * Add only logically forced prerequisite closure. A sole course-only path has
 * no choice to invent, so its members become pathway vertices recursively. If
 * an unrepresented formula has multiple OR paths or a non-course alternative,
 * leave it unresolved; the exact resolver below reports the publication
 * blocker instead of choosing a convenient branch.
 */
function expandExactVirginiaPathwayClosure({
  prerequisiteRuntime,
  pathwayCourseKeys = [],
  substitutions = new Map(),
  additionalGraphKeys = [],
  nonCourseConditionBindings = {},
} = {}) {
  if (!virginiaFigure6RuntimeReady(prerequisiteRuntime)) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      course_keys: null,
      graph: null,
      issues: [{ path: 'prerequisite_runtime', code: 'validated_publication_runtime_required' }],
    };
  }
  const rowsByCourseKey = exactVirginiaRowsByCourseKey(prerequisiteRuntime);
  const courseKeys = pathwayCourseKeys instanceof Set
    ? new Set(pathwayCourseKeys) : new Set(vaFormulaArray(pathwayCourseKeys).map(String));
  const vertexKeys = new Set([
    ...courseKeys,
    ...vaFormulaArray(additionalGraphKeys).map(String),
  ]);
  const issues = [];
  let changed = true;
  let passes = 0;
  while (changed && passes <= rowsByCourseKey.size) {
    changed = false;
    passes += 1;
    for (const courseKey of [...courseKeys]) {
      const row = rowsByCourseKey.get(courseKey);
      if (!row) {
        issues.push({ path: courseKey, code: 'required_course_requisite_missing' });
        continue;
      }
      if (row.status !== 'parsed') continue;
      for (const group of vaFormulaArray(row.groups)) {
        const paths = vaFormulaArray(group.paths);
        const represented = paths.filter((formulaPath) => (
          !vaFormulaArray(group.non_course_alternatives).length
          && !vaFormulaArray(formulaPath.non_course_alternatives).length
          && vaFormulaArray(formulaPath.all_of).length > 0
          && formulaPath.all_of.every((condition) => (
            exactVirginiaConditionRepresented(
              condition,
              courseKey,
              vertexKeys,
              substitutions,
              nonCourseConditionBindings,
            )
          ))
        ));
        if (represented.length || paths.length !== 1
            || vaFormulaArray(group.non_course_alternatives).length) continue;
        const solePath = paths[0];
        const conditions = vaFormulaArray(solePath.all_of);
        if (vaFormulaArray(solePath.non_course_alternatives).length
            || !conditions.length
            || conditions.some((condition) => condition?.type !== 'course')) continue;
        for (const condition of conditions) {
          const target = String(condition.course_key || '');
          if (exactVirginiaConditionRepresented(
            condition,
            courseKey,
            vertexKeys,
            substitutions,
            nonCourseConditionBindings,
          )) continue;
          const replacements = substitutions.get(target);
          if (replacements != null) {
            issues.push({ path: target, code: 'substitution_replacement_not_in_pathway' });
            continue;
          }
          if (!rowsByCourseKey.has(target)) {
            issues.push({ path: target, code: 'prerequisite_formula_closure_missing' });
            continue;
          }
          courseKeys.add(target);
          vertexKeys.add(target);
          changed = true;
        }
      }
    }
  }
  if (changed) issues.push({ path: 'pathway_closure', code: 'prerequisite_closure_did_not_converge' });
  if (issues.length) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      course_keys: null,
      graph: null,
      issues: uniqueVirginiaIssues(issues),
    };
  }
  const graph = buildExactVirginiaParentMap({
    compiledCorpora: validatedVirginiaFigure6RuntimeState(prerequisiteRuntime).corpora,
    pathwayCourseKeys: courseKeys,
    substitutions,
    pathwayVertexKeys: vertexKeys,
    nonCourseConditionBindings,
  });
  return {
    ready: graph.ready,
    blocker: graph.blocker,
    course_keys: graph.ready ? courseKeys : null,
    graph: graph.ready ? graph : null,
    issues: graph.issues,
  };
}

function scoreExactVirginiaPathway(pathway, {
  prerequisiteRuntime = null,
  sendingCourses = [],
  universityOwner = null,
  identityIssues = [],
  degree = null,
} = {}) {
  if (identityIssues.length) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      score: null,
      bridge: null,
      closure: null,
      issues: uniqueVirginiaIssues(identityIssues),
    };
  }
  const runtimeState = validatedVirginiaFigure6RuntimeState(prerequisiteRuntime);
  const ownerCorpus = runtimeState?.corpora?.find((corpus) => (
    corpus.owner_namespace === universityOwner
  ));
  const scopeIssues = vsuEnglishRuntimeDegreeScopeIssues(
    ownerCorpus ? [...ownerCorpus.rows_by_course_key.values()] : [],
    universityOwner === 'va:uni:9231' ? exactVirginiaStateTree(degree) : null,
  ).map((code) => ({ path: 'vsu_english_cs_scope_projection', code }));
  if (scopeIssues.length) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      score: null,
      bridge: null,
      closure: null,
      issues: uniqueVirginiaIssues(scopeIssues),
    };
  }
  const bridge = bridgeVirginiaPathwayIdentities({
    pathway,
    sendingCourses,
    prerequisiteRuntime,
    universityOwner,
  });
  if (!bridge.ready) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      score: null,
      bridge,
      closure: null,
      issues: bridge.issues,
    };
  }
  const placeholderKeys = [...(pathway?.vertices || new Map())]
    .filter(([, meta]) => meta?.kind === 'slot')
    .map(([key]) => String(key));
  const closure = expandExactVirginiaPathwayClosure({
    prerequisiteRuntime,
    pathwayCourseKeys: bridge.course_keys,
    substitutions: bridge.substitutions,
    additionalGraphKeys: placeholderKeys,
    nonCourseConditionBindings:
      pathway?.exact_non_course_condition_bindings || {},
  });
  if (!closure.ready) {
    return {
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      score: null,
      bridge,
      closure,
      issues: closure.issues,
    };
  }
  const graphKeys = [...closure.course_keys, ...placeholderKeys];
  const parentsOf = (key) => closure.graph.parents_by_course_key.get(key) || [];
  const { complexity, maxDelay } = curricularComplexity(graphKeys, parentsOf);
  const nEdges = [...closure.course_keys]
    .reduce((sum, key) => sum + parentsOf(key).length, 0);
  const score = {
    n_courses: graphKeys.length,
    n_placeholder: placeholderKeys.length,
    n_edges: nEdges,
    complexity,
    max_delay: maxDelay,
    edge_info_pct: graphKeys.length
      ? +((100 * closure.course_keys.size) / graphKeys.length).toFixed(1) : null,
  };
  return {
    ready: true,
    blocker: null,
    score,
    bridge,
    closure,
    selected_paths: closure.graph.selected_paths,
    issues: [],
  };
}

function exactVirginiaGraphWarning(label, result) {
  const rendered = vaFormulaArray(result?.issues).slice(0, 8)
    .map((issue) => `${issue.code}${issue.path ? ` at ${issue.path}` : ''}`);
  return `${label} did not resolve against the exact prerequisite publication`
    + `${rendered.length ? ` (${rendered.join('; ')}${result.issues.length > 8 ? '; ...' : ''})` : ''}.`;
}

/**
 * Resolve an AND-of-OR prerequisite expression against one pathway.
 *
 * `prerequisiteGroups` is the catalogue schema: every outer group is required,
 * while the ids inside one group are alternatives.  A curriculum containing
 * two alternatives must therefore contribute one edge, not two.  If several
 * alternatives are already vertices, retain the first available id in the
 * stored group order (source order for UC captures); this is deterministic,
 * but explicitly not a global minimum-complexity optimization.  An articulated
 * substitution counts as an in-path occurrence.  Older rows that predate the
 * grouped schema retain their historical flat-list behaviour through
 * `legacyIds`.
 */
function resolveUcParents({ prerequisiteGroups, legacyIds, inSet, substitution }) {
  const available = (target) => inSet.has(target)
    || (substitution.get(target) || []).some((key) => inSet.has(key));
  const targets = Array.isArray(prerequisiteGroups) && prerequisiteGroups.length
    ? prerequisiteGroups
      .map((alternatives) => (alternatives || []).find(available))
      .filter(Boolean)
    : (legacyIds || []).filter(available);
  const out = [];
  for (const target of targets) {
    if (inSet.has(target)) out.push(target);
    else out.push(...(substitution.get(target) || []).filter((key) => inSet.has(key)));
  }
  return [...new Set(out)];
}

/**
 * Resolve the concept projection's AND-of-ANY prerequisite groups. When more
 * than one local course is in the pathway, the projection's sorted id order is
 * the deterministic tie-breaker; all courses remain vertices and only this
 * prerequisite edge is selected.
 */
function resolveCcParents({ prerequisiteGroups, legacyIds, inSet }) {
  if (!Array.isArray(prerequisiteGroups)) {
    return [...new Set((legacyIds || []).filter((key) => inSet.has(key)))];
  }
  return [...new Set(prerequisiteGroups
    .map((group) => (group?.anyOf || []).find((key) => inSet.has(key)))
    .filter(Boolean))];
}

function scorePathway(
  { vertices, substitution },
  {
    ccPrereqs,
    ccPrerequisiteGroups = new Map(),
    ucPrereqsById,
    ucPrerequisiteGroupsById = new Map(),
  },
) {
  const keys = [...vertices.keys()];
  const inSet = new Set(keys);
  const parentsOf = (key) => {
    if (key.startsWith('cc:')) {
      return resolveCcParents({
        prerequisiteGroups: ccPrerequisiteGroups.has(key)
          ? ccPrerequisiteGroups.get(key) : undefined,
        legacyIds: ccPrereqs.get(key),
        inSet,
      });
    }
    const meta = vertices.get(key);
    if (!meta?.catalogId) return [];
    return resolveUcParents({
      prerequisiteGroups: ucPrerequisiteGroupsById.get(meta.catalogId),
      legacyIds: ucPrereqsById.get(meta.catalogId),
      inSet,
      substitution,
    }).filter((parent) => parent !== key);
  };
  const { complexity, maxDelay } = curricularComplexity(keys, parentsOf);
  const edges = keys.reduce((sum, k) => sum + parentsOf(k).length, 0);
  // A vertex is "informed" when its prerequisite status is KNOWN either way:
  // CC courses that the concept projection has examined (empty list = no
  // enforced prerequisites), and UC courses present in the campus catalogue
  // (every catalogue row has been through the requisite parse, so absence of
  // edges there also means none are stated). Placeholder slots can never be
  // informed — they are the structural remainder.
  const informed = keys.filter((k) => (k.startsWith('cc:') && ccPrereqs.has(k))
    || Boolean(vertices.get(k)?.catalogId)).length;
  const placeholders = keys.filter((k) => vertices.get(k)?.kind === 'slot').length;
  return {
    n_courses: keys.length,
    n_placeholder: placeholders,
    n_edges: edges,
    complexity,
    max_delay: maxDelay,
    edge_info_pct: keys.length ? +((100 * informed) / keys.length).toFixed(1) : null,
  };
}

async function pathwayComplexityData(
  db,
  visiblePairs,
  {
    majorSlug = 'cs',
    degreeType = 'ast',
    verifiedOnly = false,
    virginiaPrerequisiteRuntime = null,
  } = {},
) {
  const major = getMajor(majorSlug);
  if (!major) throw new Error(`unknown major: ${majorSlug}`);
  // Every enumerating query below was pinned to the unstamped California
  // corpus, so a ported major passed the capability gate and then matched no
  // documents at all — the figure returned HTTP 200 with zero rows rather than
  // failing. Scope to the major's own state through the shared clause.
  const scope = stateClause(major.state);
  const isVirginiaMajor = major.state === 'va';

  const [
    degrees,
    asDocs,
    ccPrereqs,
    ccPrerequisiteGroups,
    ccCourses,
    prerequisiteRuntime,
  ] = await Promise.all([
    db.collection('curated_requirements')
      .find({ ...scope, kind: 'degree', major_slug: majorSlug }).sort({ _id: 1 }).toArray(),
    db.collection('curated_requirements')
      .find({
        ...scope,
        kind: 'as_degree',
        status: 'found',
        major_slug: majorSlug,
        degree_type: degreeType,
        ...(verifiedOnly ? { 'verification.verified': true } : {}),
      }).toArray(),
    isVirginiaMajor ? Promise.resolve(new Map()) : projectPrereqEdges(db),
    isVirginiaMajor ? Promise.resolve(new Map()) : projectPrereqGroups(db),
    db.collection('assist_courses')
      .find({ ...scope, side: 'sending' }, {
        projection: {
          course_id: 1, course_key: 1, institution_id: 1, units: 1, min_units: 1,
        },
      }).toArray(),
    isVirginiaMajor
      ? (virginiaPrerequisiteRuntime
        || loadVirginiaFigure6PrerequisiteRuntime(db))
      : Promise.resolve(null),
  ]);
  const ccUnits = new Map(ccCourses.map((c) => [c.course_id, Number(c.min_units ?? c.units) || null]));
  const collegeRows = await db.collection('assist_institutions')
    .find({ ...scope, kind: 'community_college' }).project({ source_id: 1, name: 1 }).toArray();
  const collegeName = new Map(collegeRows.map((r) => [Number(r.source_id), r.name]));

  const rows = [];
  for (const degree of degrees) {
    const isVirginia = major.state === 'va' || degree.state === 'va';
    const universityOwner = isVirginia ? `va:uni:${degree.school_id}` : null;
    const programs = major.programs?.[degree.school_id] || [];
    if (visiblePairs && !programs.some((program) => visiblePairs.some(
      (pair) => pair.school_id === Number(degree.school_id) && pair.major === program,
    ))) continue;

    const [catalogRows, receivingRows, agreements] = await Promise.all([
      isVirginia
        ? Promise.resolve([...exactVirginiaRowsByCourseKey(prerequisiteRuntime).values()]
          .filter((row) => row?.owner_namespace === universityOwner))
        : db.collection('curated_prerequisites')
          .find({ institution_id: `uc:${degree.school_id}` })
          .project({
            course_id: 1,
            course_code: 1,
            units: 1,
            prerequisite_groups: 1,
            prerequisite_ids: 1,
          }).toArray(),
      db.collection('assist_courses')
        .find({
          institution_id: isVirginia ? universityOwner : `uc:${degree.school_id}`,
          parent_id: { $exists: true, $ne: null },
        })
        .project({
          parent_id: 1, prefix: 1, number: 1, title: 1, units: 1, min_units: 1,
        }).toArray(),
      db.collection('assist_agreements')
        .find({ ...scope, uc_school_id: degree.school_id, major: { $in: programs } }).toArray(),
    ]);
    const ucCatalog = new Map();
    const ucPrereqsById = new Map();
    const ucPrerequisiteGroupsById = new Map();
    const vaCatalogIssues = [];
    let ucCodeByParent;
    if (isVirginia) {
      const receivingByCode = new Map();
      const publishedOwnerCodes = new Set(catalogRows.map((row) => (
        normalizeVirginiaCourseCode(String(row?.course_key || '').split(':').at(-1))
      )).filter(Boolean));
      ucCodeByParent = new Map();
      for (const [index, row] of receivingRows.entries()) {
        // Projection rows retain the exact source code in `title`; this is
        // essential for distinct lecture/lab identities such as CPSC150 and
        // CPSC150L whose legacy prefix/number columns otherwise collide.
        const code = resolveVirginiaReceivingCourseCode(row, publishedOwnerCodes);
        if (!code) {
          vaCatalogIssues.push({
            path: `receiving_courses[${index}]`, code: 'receiving_course_code_invalid',
          });
          continue;
        }
        if (receivingByCode.has(code)) {
          vaCatalogIssues.push({
            path: `receiving_courses[${index}]`, code: 'receiving_course_code_collision',
            course_code: code,
          });
          continue;
        }
        receivingByCode.set(code, row);
        ucCodeByParent.set(row.parent_id, code);
      }
      for (const [index, row] of catalogRows.entries()) {
        const courseKey = String(row?.course_key || '');
        const code = normalizeVirginiaCourseCode(courseKey.split(':').at(-1));
        if (!code || courseKey !== `${universityOwner}:${code}`) {
          vaCatalogIssues.push({
            path: `university_prerequisites[${index}].course_key`,
            code: 'university_canonical_course_key_invalid',
          });
          continue;
        }
        const receiving = receivingByCode.get(code);
        ucCatalog.set(code, {
          id: courseKey,
          units: Number(receiving?.min_units ?? receiving?.units) || null,
        });
      }
    } else {
      for (const row of catalogRows) {
        const code = String(row.course_code || '').toUpperCase().replace(/\s+/g, ' ').trim();
        if (!code) continue;
        if (!ucCatalog.has(code)) {
          ucCatalog.set(code, { id: row.course_id, units: Number(row.units) || null });
        }
        if ((row.prerequisite_groups || []).length) {
          ucPrerequisiteGroupsById.set(row.course_id, row.prerequisite_groups);
        }
        if ((row.prerequisite_ids || []).length) ucPrereqsById.set(row.course_id, row.prerequisite_ids);
      }
      ucCodeByParent = new Map(receivingRows
        .map((r) => [r.parent_id, normalizeCode(r.prefix, r.number)]));
    }

    const shared = {
      ccPrereqs,
      ccPrerequisiteGroups,
      ucPrereqsById,
      ucPrerequisiteGroupsById,
    };
    const assemblyOptions = {
      degree,
      asSlots: 0,
      ucCatalog,
      ucCodeByParent,
      ccUnits,
      normalizeCatalogCode: isVirginia ? normalizeVirginiaCourseCode : (value) => value,
    };
    const residentPathway = assemblePathway({
      ...assemblyOptions, asIds: [], agreementByParent: new Map(),
    });
    const residentResult = isVirginia
      ? scoreExactVirginiaPathway(residentPathway, {
        prerequisiteRuntime,
        sendingCourses: ccCourses,
        universityOwner,
        identityIssues: vaCatalogIssues,
        degree,
      })
      : { ready: true, score: scorePathway(residentPathway, shared), issues: [] };

    const agreementsByCc = new Map();
    for (const agreement of agreements) {
      const byParent = agreementsByCc.get(agreement.community_college_id) || new Map();
      for (const group of agreement.requirement_groups || []) {
        for (const section of group.sections || []) {
          for (const receiver of section.receivers || []) {
            const receiving = receiver.receiving || {};
            const parentIds = receiving.kind === 'series' ? (receiving.parent_ids || []) : [receiving.parent_id];
            if (receiver.articulation_status !== 'articulated') continue;
            const options = (receiver.options || [])
              .map((option) => (option.course_ids || []).filter((id) => id != null))
              .filter((ids) => ids.length);
            if (!options.length) continue;
            const articulation = {
              options,
              parentIds: parentIds.filter((pid) => pid != null),
            };
            for (const pid of articulation.parentIds) {
              if (!byParent.has(pid)) byParent.set(pid, articulation);
            }
          }
        }
      }
      agreementsByCc.set(agreement.community_college_id, byParent);
    }

    for (const asDoc of asDocs) {
      const collegeId = asDoc.community_college_id;
      const agreementByParent = agreementsByCc.get(collegeId);
      if (!agreementByParent && !isVirginia) continue;
      const sourceGate = isVirginia
        ? virginiaPathwaySourceGate(asDoc, degree, prerequisiteRuntime) : null;
      const identity = {
        school_id: degree.school_id,
        school: degree.school,
        community_college_id: collegeId,
        college_name: collegeName.get(Number(collegeId)) || asDoc.college_name || String(collegeId),
        degree_type: degreeType,
        record_id: asDoc._id,
        source_catalog_year: asDoc.catalog_year || null,
        source_verified: asDoc.verification?.verified === true,
        source_analysis_ready: asDoc.analysis_ready === true
          ? true : (asDoc.analysis_ready === false ? false : null),
        ...(isVirginia ? {
          degree_record_id: degree._id,
          source_requirement_id: asDoc.va_requirement_id || null,
          degree_source_requirement_id: degree.va_requirement_id || null,
          source_bundle_hash: sourceHash(asDoc),
          degree_source_bundle_hash: sourceHash(degree),
          degree_source_verified: degree.verification?.verified === true,
          degree_source_analysis_ready: degree.analysis_ready === true,
          source_complete_degree_ready: sourceGate.associate.complete_degree_ready,
          source_figures: sourceGate.associate.figures,
          source_figure_constraint_blockers:
            sourceGate.associate.figure_constraint_blockers,
          degree_source_complete_degree_ready: sourceGate.bachelor.complete_degree_ready,
          degree_source_figures: sourceGate.bachelor.figures,
          degree_source_figure_constraint_blockers:
            sourceGate.bachelor.figure_constraint_blockers,
          prerequisite_publication_generation: virginiaFigure6RuntimeReady(prerequisiteRuntime)
            ? prerequisiteRuntime.publication_generation : null,
          prerequisite_verification_receipt_id: virginiaFigure6RuntimeReady(prerequisiteRuntime)
            ? prerequisiteRuntime.verification_receipt_id : null,
          prerequisite_verification_receipt_sha256: virginiaFigure6RuntimeReady(prerequisiteRuntime)
            ? prerequisiteRuntime.verification_receipt_sha256 : null,
        } : {}),
      };
      if (isVirginia) {
        if (!sourceGate.ready) {
          rows.push(excludedPathwayRow(identity, sourceGate.warning, sourceGate.reason));
          continue;
        }
        if (!agreementByParent) {
          rows.push(excludedPathwayRow(
            identity,
            'No source-derived Virginia agreement exists for this bachelor/associate pair.',
            'virginia_agreement_missing',
          ));
          continue;
        }
        if (!residentResult.ready) {
          rows.push(excludedPathwayRow(
            identity,
            exactVirginiaGraphWarning('The resident pathway', residentResult),
            VA_PREREQUISITE_MODEL_BLOCKER,
          ));
          continue;
        }
      }
      const selection = asDegreeCourseIds(asDoc, ccUnits);
      const {
        ids: asIds, slots: asSlots, slotUnits: asSlotUnits,
      } = selection;
      if (!asIds.length) {
        rows.push({
          ...identity,
          method_status: 'excluded',
          exclusion_reason: selection.exclusion_reason || 'associate_plan_incomplete',
          method_warning: selection.method_warning || null,
          as_courses: null,
          as_selected_units: null,
          requirements_consumed: null,
          n_courses: null,
          n_placeholder: null,
          n_edges: null,
          complexity: null,
          max_delay: null,
          edge_info_pct: null,
          resident_complexity: residentResult.score?.complexity ?? null,
          delta_vs_resident: null,
        });
        continue;
      }
      const pathway = assemblePathway({
        ...assemblyOptions, asIds, asSlots, asSlotUnits, agreementByParent,
      });
      const pathwayResult = isVirginia
        ? scoreExactVirginiaPathway(pathway, {
          prerequisiteRuntime,
          sendingCourses: ccCourses,
          universityOwner,
          identityIssues: vaCatalogIssues,
          degree,
        })
        : { ready: true, score: scorePathway(pathway, shared), issues: [] };
      if (!pathwayResult.ready) {
        rows.push(excludedPathwayRow(
          identity,
          exactVirginiaGraphWarning('The transfer pathway', pathwayResult),
          VA_PREREQUISITE_MODEL_BLOCKER,
        ));
        continue;
      }
      const score = pathwayResult.score;
      const resident = residentResult.score;
      rows.push({
        ...identity,
        method_status: selection.method_status,
        exclusion_reason: null,
        method_warning: selection.method_warning,
        as_courses: asIds.length + asSlots,
        as_selected_units: selection.selected_units ?? null,
        requirements_consumed: pathway.consumed,
        ...score,
        resident_complexity: resident.complexity,
        delta_vs_resident: +(score.complexity - resident.complexity).toFixed(1),
      });
    }
  }
  return rows;
}

/**
 * Cached full-corpus computation. The assembly takes ~10s per major, so the
 * endpoint serves from `analysis_cache` (one doc per major × degree type) and
 * lets the caller apply visibility filtering to the cached rows — scoping is
 * cheap, scoring is not. Empty results are never cached, so a data problem
 * cannot freeze an empty matrix in place. Refresh with
 * `scripts/buildPathwayComplexityCache.js` (or `?refresh=1`) after any change
 * to degrees, associate degrees, agreements, or prerequisite data.
 */
const CACHE_COLLECTION = 'analysis_cache';
// v3 corrects three pathway-shape semantics: exact associate-degree choices,
// AND-of-OR prerequisite groups, and atomic ASSIST receiving-series coverage.
// Keep this in the cache id so no v2 matrix can survive the model change.
const CACHE_VERSION = 'v3';
// Virginia v5 binds every cached score to the exact prerequisite generation
// and human receipt used by the owner-scoped formula scorer. Keeping California
// on v3 preserves its response/cache identity byte-for-byte.
const VA_CACHE_VERSION = 'v5-va-exact-prerequisites';

async function revalidateVirginiaCachedRows(db, rows, prerequisiteRuntime = null) {
  const runtime = prerequisiteRuntime || await loadVirginiaFigure6PrerequisiteRuntime(db);
  const ids = [...new Set(rows.flatMap((row) => [row?.record_id, row?.degree_record_id])
    .filter(Boolean))];
  const docs = ids.length
    ? await db.collection('curated_requirements').find({
      ...stateClause('va'),
      _id: { $in: ids },
      kind: { $in: ['as_degree', 'degree'] },
    }).toArray()
    : [];
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

  return rows.map((row) => {
    const associate = byId.get(String(row?.record_id));
    const bachelor = byId.get(String(row?.degree_record_id));
    if (!associate || !bachelor) {
      return excludedPathwayRow(
        row,
        'The cached Virginia pathway no longer resolves to both current source projections.',
        'virginia_cached_source_missing',
      );
    }
    const gate = virginiaPathwaySourceGate(associate, bachelor, runtime);
    const sameSources = row.source_requirement_id === associate.va_requirement_id
      && row.degree_source_requirement_id === bachelor.va_requirement_id
      && row.source_bundle_hash === sourceHash(associate)
      && row.degree_source_bundle_hash === sourceHash(bachelor);
    const runtimeReady = virginiaFigure6RuntimeReady(runtime);
    const prerequisiteStale = runtimeReady
      && (row.prerequisite_publication_generation !== runtime.publication_generation
      || row.prerequisite_verification_receipt_id !== runtime.verification_receipt_id
      || row.prerequisite_verification_receipt_sha256
        !== runtime.verification_receipt_sha256);
    if (!gate.ready || !sameSources || prerequisiteStale) {
      return excludedPathwayRow(
        row,
        [gate.warning,
          !sameSources ? 'The cached pathway was computed from a different source bundle.' : null,
          prerequisiteStale
            ? 'The cached pathway was computed from a different prerequisite publication.' : null]
          .filter(Boolean).join(' '),
        !sameSources || prerequisiteStale ? 'virginia_cached_source_stale' : gate.reason,
      );
    }
    return row;
  });
}

async function pathwayComplexityCached(
  db,
  {
    majorSlug = 'cs', degreeType = 'ast', verifiedOnly = true, refresh = false,
    publicationConditionDigest = null,
  } = {},
) {
  const cohort = verifiedOnly ? 'verified' : 'all';
  const major = getMajor(majorSlug);
  const cacheVersion = major?.state === 'va' ? VA_CACHE_VERSION : CACHE_VERSION;
  const prerequisiteRuntime = major?.state === 'va'
    ? await loadVirginiaFigure6PrerequisiteRuntime(db) : null;
  const prerequisiteCacheToken = virginiaFigure6RuntimeReady(prerequisiteRuntime)
    ? `${prerequisiteRuntime.publication_generation}:${prerequisiteRuntime.verification_receipt_sha256}`
    : 'unavailable';
  const cacheId = `pathway-complexity:${cacheVersion}:${majorSlug}:${degreeType}:${cohort}`
    + `${major?.state === 'va' ? `:${prerequisiteCacheToken}` : ''}`
    // HTTP publication supplies this exact receipt digest. Internal audit
    // callers may omit it, but an unbound cache can never satisfy the bound
    // endpoint key and therefore cannot leak into a released Virginia figure.
    + `${major?.state === 'va' && publicationConditionDigest
      ? `:condition:${publicationConditionDigest}` : ''}`;
  if (!refresh) {
    const hit = await db.collection(CACHE_COLLECTION).findOne({ _id: cacheId });
    if (hit?.rows?.length) {
      const rows = major?.state === 'va'
        ? await revalidateVirginiaCachedRows(db, hit.rows, prerequisiteRuntime) : hit.rows;
      return {
        rows,
        computed_at: hit.computed_at,
        cached: true,
        model_version: cacheVersion,
      };
    }
  }
  const rows = await pathwayComplexityData(db, null, {
    majorSlug,
    degreeType,
    verifiedOnly,
    virginiaPrerequisiteRuntime: prerequisiteRuntime,
  });
  const computed_at = new Date().toISOString();
  if (rows.length) {
    await db.collection(CACHE_COLLECTION).replaceOne(
      { _id: cacheId },
      {
        _id: cacheId,
        kind: 'pathway-complexity',
        model_version: cacheVersion,
        major_slug: majorSlug,
        degree_type: degreeType,
        verified_only: verifiedOnly,
        ...(major?.state === 'va' && publicationConditionDigest
          ? { publication_condition_digest: publicationConditionDigest } : {}),
        rows,
        computed_at,
      },
      { upsert: true },
    );
  }
  return {
    rows,
    computed_at,
    cached: false,
    model_version: cacheVersion,
  };
}

module.exports = {
  pathwayComplexityData,
  pathwayComplexityCached,
  assemblePathway,
  asDegreeCourseIds,
  scorePathway,
  resolveUcParents,
  resolveCcParents,
  AMBIGUOUS_UNIT_POOL,
  VA_EXACT_FORMULA_ADAPTER,
  VA_FIGURE6_PUBLICATION_COLLECTION,
  VA_PREREQUISITE_MODEL_BLOCKER,
  bridgeVirginiaPathwayIdentities,
  buildExactVirginiaParentMap,
  compileValidatedVirginiaFormulaCorpora,
  expandExactVirginiaPathwayClosure,
  excludedPathwayRow,
  loadVirginiaFigure6PrerequisiteRuntime,
  revalidateVirginiaCachedRows,
  resolveVirginiaReceivingCourseCode,
  resolveExactVirginiaFormulaRow,
  scoreExactVirginiaPathway,
  virginiaFigure6RuntimeReady,
  virginiaPathwaySourceGate,
};
