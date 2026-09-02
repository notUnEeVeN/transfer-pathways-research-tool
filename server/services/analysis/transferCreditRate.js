/**
 * Associate-degree contribution to bachelor's requirements.
 *
 * For each associate degree × UC graduation template, the service builds a
 * feasible, transfer-oriented associate-degree plan and applies each unit at
 * most once, in this order:
 *
 *   1. an articulated named course/series in the UC template;
 *   2. a GE or breadth requirement in the UC template;
 *   3. an explicitly authored UC-transferable elective block.
 *
 * The primary figure reports the result from the bachelor's side:
 *
 *   full degree = fulfilled bachelor's units / all modeled bachelor's units
 *   lower div   = fulfilled lower-division units / modeled lower-division units
 *
 * The lower-division denominator excludes `nontransferable` template groups,
 * which represent upper-division, residency, and other university-only work.
 * Associate-degree utilization fields (`as_unit_utilization_pct`,
 * `extra_units`, etc.) remain in the payload for the separate
 * replacement-coursework figure.
 *
 * Associate-degree application accounting stays in the community college's
 * native unit system. The fulfilled/required bachelor fields are returned in
 * the receiving campus's unit system. `extra_units_semester` remains available
 * for comparable cross-college replacement-unit averages.
 *
 * The model is intentionally optimistic where the source only supplies an
 * aggregate GE/elective block: it assumes a transfer-bound student chooses
 * dual-qualifying, UC-transferable courses. Those units remain separately
 * labeled in the payload. Impossible/unsupported degree structures return a
 * null cell instead of breaking the whole-degree bounds.
 */

const GE_UC_VERIFIED = new Set(['calgetc', 'igetc']);
const GE_DEFAULT_SEMESTER_UNITS = { calgetc: 34, igetc: 37, csu_ge: 39 };
const GE_STATUTORY_MINIMUM_SEMESTER_UNITS = 18;
const ASSUMED_UNITS_PER_COURSE = 4;
const EPSILON = 1e-7;
const { defaultMajor, getMajor, programPairClause, programPairs } = require('../../config/majors');
const { AS_DEGREE_SLOTS: DEGREE_TYPES } = require('../../config/asDegreeSlots');
const { computeUnitBudget, resolveSectionTier } = require('../degreeSlots');
const { majorDocumentClause } = require('../../config/majorDocumentScope');
const { stateClause } = require('../../config/stateScope');
const {
  DISTINCT_CATEGORY_KINDS,
  SUPPORTED_ASSOCIATE_CONSTRAINT_KINDS,
  categoryForCourse,
  courseSubject,
  distinctCategoryMinimum,
  associateConstraintContextIssues,
  hasAssociateConstraintEvaluator,
  resolveAssociateConstraint,
  supportsAssociateConstraintKind,
} = require('./transferCreditConstraints');
const {
  canonicalContractIssues,
  usesCanonicalSourceContract,
} = require('./canonicalSourceContract');
const {
  virginiaEnumeratedGeUnits,
} = require('./virginiaGeAreaClassification');
const {
  CANONICAL_REQUIREMENT_ROLES,
  canonicalRequirementRole,
  canonicalRequirementRoleIssues,
} = require('./canonicalRequirementRole');
const {
  readinessForProjectedFigures,
} = require('../virginia/publicationReadiness');
const {
  auditAssociateDocument,
} = require('./associateFigureConstraints');
const {
  evaluateVirginiaResidencyTransferPolicy,
} = require('./virginiaResidencyTransferCaps');
const {
  oduTechnicalSciencePairs,
} = require('./georgeMasonOldDominionConstraintProofs');
const {
  bridgewaterTrackSelection,
} = require('./bridgewaterConstraintProofs');
const {
  BLUE_RIDGE_SOURCE_BOUND_RULE,
  COLLEGES: ASSOCIATE_COLLEGES,
  blueRidgeDistinctAreaRuntimeCarrier,
  newRiverFigure6LaboratorySelection,
  northernVirginiaFigure34Aggregates,
} = require('./associateCollegeConstraintProofs');
const {
  SOURCE_RULE: NEW_RIVER_VIRGINIA_TECH_SOURCE_RULE,
  exactCarrier: newRiverVirginiaTechFigure34Carrier,
  newRiverVirginiaTechFigure34PairProof,
  newRiverVirginiaTechFigure34Readiness,
  newRiverVirginiaTechRuntimeSectionMatches,
} = require('./newRiverConstraintProofs');
const {
  norfolkStateSciencePairs,
} = require('./norfolkStateConstraintProofs');
const {
  longwoodFigureSelection,
} = require('./longwoodConstraintProofs');
const {
  exactVirginiaTechTree,
  standardMathAndPathwaysSelection,
} = require('./virginiaTechConstraintProofs');
const {
  vcuTransferOrientedAsWaiver,
} = require('./vcuConstraintProofs');
const {
  uvaWiseVccsGaaWaiver,
} = require('./uvaWiseConstraintProofs');
const {
  radfordCompletedAsRealWaiver,
} = require('./radfordConstraintProofs');
const {
  SHENANDOAH_CAPACITY_GROUP_INDEX,
  SHENANDOAH_ELECTIVE_CAPACITY_UNITS,
  SHENANDOAH_GENERAL_EDUCATION_DOMAIN_UNITS,
  shenandoahFigure34PairProof,
  shenandoahFigure34Readiness,
} = require('./shenandoahConstraintProofs');
const {
  RADFORD_FREE_ELECTIVE_GROUP_INDEX,
  RADFORD_SCIENCE_GROUP_INDEX,
  applyRadfordSciencePair,
  radfordAssociateSciencePairCarrier,
  radfordSciencePairRuntimeContext,
} = require('./radfordSciencePairConstraint');
const {
  auditVirginiaSourceEquivalencyConditions,
  virginiaTechAtomicRuntimeContext,
} = require('./virginiaTransferEquivalencyConditions');
const {
  VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX,
  VIRGINIA_TECH_CSC_PAIR_NAMED_APPLICATION_UNITS,
  VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX,
} = require('./virginiaTechAtomicArticulation');
const { parentIdForLanding } = require('../virginia/courseIdentity');
const maFigureLedgers = require('../../data/ma/figure-ledgers.json');
const maFigure3GrayDetail = require('../../data/ma/figure3-gray-detail.json');

const round1 = (value) => +(Number(value) || 0).toFixed(1);

// Figure 4's deposited pathway-sheet totals are a source artifact in their
// own right. Keep them separate from `modeled_hours_above_120`, which is this
// service's general course-allocation model and can legitimately produce a
// different total. The ledger is committed and regenerated from the archived
// workbook; no database row is treated as a substitute for it.
const maFigure4ArchiveDetailByPair = new Map(
  (maFigureLedgers.fig4?.cells || []).map((cell) => [cell.pair, cell]),
);

// Figure 3's audit source is intentionally not the generic allocation model
// below and not the authors' hand-typed CurrComp summary tab. It is a frozen,
// reproducible rerun over the gray rows in the deposited pathway XLSX files.
const maFigure3GrayDetailByPair = new Map(
  (maFigure3GrayDetail.cells || []).map((cell) => [cell.pair, cell]),
);

function maFigure3ArchiveGrayDetail(school, collegeName) {
  const college = String(collegeName || '').replace(/ Community College$/, '');
  return maFigure3GrayDetailByPair.get(`${school} × ${college}`) || null;
}

function maFigure4ArchiveDetail(school, collegeName) {
  const college = String(collegeName || '').replace(/ Community College$/, '');
  return maFigure4ArchiveDetailByPair.get(`${school} × ${college}`) || null;
}

function catalogCohorts(value) {
  const matches = String(value || '').matchAll(/\b(20\d{2})\s*[-–/]\s*(?:20)?(\d{2})\b/g);
  return new Set([...matches].map((match) => `${match[1]}-${match[2]}`));
}

function catalogCohortsDiffer(associateYear, bachelorYear) {
  const associate = catalogCohorts(associateYear);
  const bachelor = catalogCohorts(bachelorYear);
  if (associate.size !== 1 || bachelor.size !== 1) {
    return associate.size > 0 && bachelor.size > 0;
  }
  return [...associate][0] !== [...bachelor][0];
}

function unitSystemOfTemplate(template) {
  if (template.unit_system === 'quarter' || template.unit_system === 'semester') {
    return template.unit_system;
  }
  // The current UC templates use the campus graduation minimum: 180 quarter
  // units or 120 semester units. Keep the inference as a documented fallback
  // until unit_system is stored directly on every hand-authored template.
  return Number(template.total_units) >= 150 ? 'quarter' : 'semester';
}

function toSemesterUnits(units, system) {
  return Number(units) * (system === 'quarter' ? 2 / 3 : 1);
}

function fromSemesterUnits(units, system) {
  return Number(units) * (system === 'quarter' ? 1.5 : 1);
}

function campusUnitsToCollege(units, campusSystem, collegeSystem) {
  return fromSemesterUnits(toSemesterUnits(units, campusSystem), collegeSystem);
}

function collegeUnitsToCampus(units, collegeSystem, campusSystem) {
  return fromSemesterUnits(toSemesterUnits(units, collegeSystem), campusSystem);
}

function receivingPids(receiving) {
  if (!receiving) return [];
  if (receiving.kind === 'series') {
    return (receiving.parent_ids || []).map(Number).filter(Number.isFinite);
  }
  if (receiving.kind === 'course' && receiving.parent_id != null) {
    const pid = Number(receiving.parent_id);
    return Number.isFinite(pid) ? [pid] : [];
  }
  return [];
}

function normalizeMajor(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^\s*cse\s*:\s*/i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/bachelor\s+of\s+science/g, 'bs')
    .replace(/bachelor\s+of\s+arts/g, 'ba')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function agreementsForTemplate(pairAgreements, template) {
  if (!pairAgreements.length) {
    return { agreements: [], warning: 'No ASSIST agreement is available for this college and campus pair.' };
  }
  const target = normalizeMajor(template.program);
  if (!target) {
    return {
      agreements: pairAgreements,
      warning: 'The graduation template has no program label, so every agreement for the pair was used.',
    };
  }
  const withMajor = pairAgreements.filter((agreement) => normalizeMajor(agreement.major));
  if (!withMajor.length) {
    return {
      agreements: pairAgreements,
      warning: 'The pair agreements have no major labels, so the program match could not be verified.',
    };
  }
  const exact = withMajor.filter((agreement) => normalizeMajor(agreement.major) === target);
  if (!exact.length) {
    return {
      agreements: [],
      warning: `No ASSIST agreement matches the graduation template program (${template.program}).`,
    };
  }
  return { agreements: exact, warning: null };
}

function optionIds(option) {
  return [...new Set((option?.course_ids || []).map(Number).filter(Number.isFinite))];
}

function unitsForIds(ids, unitsById) {
  return ids.reduce((total, id) => total + (unitsById.get(id) || 0), 0);
}

/**
 * Resolve current-catalog course credits for one Virginia associate degree.
 *
 * VCCS codes are shared identities, but a college's current catalog can state
 * a different credit value than the older Transfer Virginia equivalency row
 * (Brightpoint CSC 195 is 3 credits while the shared row says 1). The
 * projection retains those exact witnesses by source requirement. A malformed
 * duplicate override is assigned zero so the strict planner excludes the cell
 * instead of silently falling back to a convenient statewide value.
 */
function sourceSpecificUnitsById(defaultUnits, courseRowsById, degree) {
  const resolved = new Map(defaultUnits);
  const sourceId = degree?.va_requirement_id ?? degree?._id ?? null;
  if (!sourceId) return resolved;
  for (const [courseId, row] of courseRowsById) {
    const matches = (row?.units_by_source_requirement || []).filter((entry) => (
      entry?.source_requirement_id === sourceId
    ));
    if (!matches.length) continue;
    if (matches.length !== 1) {
      resolved.set(courseId, 0);
      continue;
    }
    const values = [matches[0].units, matches[0].min_units, matches[0].max_units]
      .map(Number);
    const exact = values.every((value) => Number.isFinite(value) && value > 0)
      && values.every((value) => Math.abs(value - values[0]) <= EPSILON);
    resolved.set(courseId, exact ? values[0] : 0);
  }
  return resolved;
}

function scoredOption(option, directlyEligible, generallyTransferable, unitsById) {
  const ids = optionIds(option);
  const total = unitsForIds(ids, unitsById);
  const transferred = unitsForIds(ids.filter((id) => directlyEligible.has(id)), unitsById);
  const applicable = unitsForIds(ids.filter((id) => (
    directlyEligible.has(id) || generallyTransferable.has(id)
  )), unitsById);
  return { ids, total, transferred, applicable };
}

function compareTransferChoice(a, b) {
  const ratioA = a.total > 0 ? a.transferred / a.total : 0;
  const ratioB = b.total > 0 ? b.transferred / b.total : 0;
  const applicableRatioA = a.total > 0 ? a.applicable / a.total : 0;
  const applicableRatioB = b.total > 0 ? b.applicable / b.total : 0;
  return ratioB - ratioA
    || b.transferred - a.transferred
    || applicableRatioB - applicableRatioA
    || b.applicable - a.applicable
    || a.total - b.total
    || a.ids.join(',').localeCompare(b.ids.join(','));
}

function receiverChoices(
  receiver,
  directlyEligible,
  generallyTransferable,
  unitsById,
  excludedIds = null,
) {
  return (receiver.options || [])
    .map((option) => scoredOption(option, directlyEligible, generallyTransferable, unitsById))
    .filter((option) => option.ids.length
      && option.total > 0
      && !option.ids.some((id) => excludedIds?.has(id)))
    .sort(compareTransferChoice);
}

function stateForIds(ids, directlyEligible, generallyTransferable, unitsById) {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  return {
    ids: unique,
    total: unitsForIds(unique, unitsById),
    transferred: unitsForIds(unique.filter((id) => directlyEligible.has(id)), unitsById),
    applicable: unitsForIds(unique.filter((id) => (
      directlyEligible.has(id) || generallyTransferable.has(id)
    )), unitsById),
  };
}

function betterUnitState(candidate, incumbent) {
  if (!incumbent) return true;
  return candidate.transferred > incumbent.transferred + EPSILON
    || (Math.abs(candidate.transferred - incumbent.transferred) <= EPSILON
      && (candidate.applicable > incumbent.applicable + EPSILON
        || (Math.abs(candidate.applicable - incumbent.applicable) <= EPSILON
          && candidate.ids.join(',').localeCompare(incumbent.ids.join(',')) < 0)));
}

// Exact subset search for a choose-by-units section. A completion plan first
// avoids coursework known not to transfer, then uses the smallest attainable
// unit total at/above the catalog floor; direct articulation breaks remaining
// ties. One option per receiver.
function chooseUnitPlan(
  section,
  directlyEligible,
  generallyTransferable,
  unitsById,
  excludedIds,
) {
  const target = Number(section.unit_advisement) || 0;
  const choices = (section.receivers || []).map((receiver) =>
    receiverChoices(
      receiver,
      directlyEligible,
      generallyTransferable,
      unitsById,
      excludedIds,
    ));
  const maxOption = Math.max(0, ...choices.flat().map((option) => option.total));
  const cap = target + maxOption + EPSILON;
  let states = new Map([[0, {
    ids: [], total: 0, transferred: 0, applicable: 0,
  }]]);

  for (const receiverOptions of choices) {
    const next = new Map(states);
    for (const state of states.values()) {
      for (const option of receiverOptions) {
        const candidate = stateForIds(
          [...state.ids, ...option.ids],
          directlyEligible,
          generallyTransferable,
          unitsById,
        );
        if (candidate.total > cap) continue;
        const key = Math.round(candidate.total * 100);
        if (betterUnitState(candidate, next.get(key))) next.set(key, candidate);
      }
    }
    states = next;
  }

  const feasible = [...states.values()]
    .filter((state) => state.total + EPSILON >= target)
    .sort((a, b) => (a.total - a.applicable) - (b.total - b.applicable)
      || a.total - b.total
      || b.transferred - a.transferred
      || b.applicable - a.applicable
      || a.ids.join(',').localeCompare(b.ids.join(',')));
  if (feasible.length) return { ...feasible[0], complete: true };

  const partial = [...states.values()].sort((a, b) => b.total - a.total
    || b.transferred - a.transferred
    || b.applicable - a.applicable
    || a.ids.join(',').localeCompare(b.ids.join(',')))[0] || {
    ids: [], total: 0, transferred: 0, applicable: 0,
  };
  return { ...partial, complete: false };
}

// Choose a distinct option for each required course slot. Associate-degree
// lists frequently repeat List A courses under List B with explicit "unused"
// language; a single course cannot silently satisfy both named requirements.
// Mandatory receiver sets are handled most-constrained-first, while choose-N
// pools retain the transfer-oriented ranking used by the historical model.
function chooseCoursePlan(
  section,
  directlyEligible,
  generallyTransferable,
  unitsById,
  excludedIds,
) {
  const receivers = section.receivers || [];
  const statedAsk = section.section_advisement == null
    ? receivers.length
    : Math.max(0, Number(section.section_advisement) || 0);
  const requiredCount = statedAsk;
  const usedIds = new Set(excludedIds || []);
  const usedReceivers = new Set();
  const selectedIds = [];

  while (usedReceivers.size < requiredCount) {
    const candidates = receivers
      .map((receiver, receiverIndex) => ({
        receiverIndex,
        options: usedReceivers.has(receiverIndex)
          ? []
          : receiverChoices(
            receiver,
            directlyEligible,
            generallyTransferable,
            unitsById,
            usedIds,
          ),
      }))
      .filter((candidate) => candidate.options.length);
    if (!candidates.length) break;

    const mandatoryAll = requiredCount >= receivers.length;
    candidates.sort((a, b) => {
      if (mandatoryAll && a.options.length !== b.options.length) {
        return a.options.length - b.options.length;
      }
      return compareTransferChoice(a.options[0], b.options[0])
        || a.receiverIndex - b.receiverIndex;
    });
    const selected = candidates[0];
    const option = selected.options[0];
    usedReceivers.add(selected.receiverIndex);
    for (const id of option.ids) {
      usedIds.add(id);
      selectedIds.push(id);
    }
  }

  return {
    ...stateForIds(selectedIds, directlyEligible, generallyTransferable, unitsById),
    complete: usedReceivers.size >= requiredCount,
    selectedCount: usedReceivers.size,
    requiredCount,
  };
}

// A choose-by-units pool means the same thing whether its alternatives are
// stored as one receiver carrying many options or as one receiver per
// alternative, but `chooseUnitPlan` spends one option per receiver, so the
// first encoding can only ever contribute a single course and a pool asking
// for more units than its largest alternative can never close. Both encodings
// exist in the source corpus, so normalize the shape at this boundary. The
// legacy California/Massachusetts results are regression-protected and remain
// unchanged; Virginia additionally uses the strict constraint-aware planner.
//
// Only unit pools are split. A choose-N section spends one option per receiver
// by design — splitting it would let one stated slot draw several courses.
function splitUnitPoolReceivers(section) {
  if (section.unit_advisement == null) return section;
  const receivers = section.receivers || [];
  if (!receivers.some((receiver) => (receiver.options || []).length > 1
    && (receiver.options_conjunction || 'or').toLowerCase() !== 'and')) {
    return section;
  }
  const split = [];
  for (const receiver of receivers) {
    const options = receiver.options || [];
    // An 'and' conjunction means every option is required together, so the
    // receiver is one indivisible ask and must not be split.
    if (options.length > 1 && (receiver.options_conjunction || 'or').toLowerCase() !== 'and') {
      for (const option of options) split.push({ ...receiver, options: [option] });
    } else {
      split.push(receiver);
    }
  }
  return { ...section, receivers: split };
}

function constraintKinds(...values) {
  return new Set(values.flatMap((value) => (
    Array.isArray(value?.analysis_constraints)
      ? value.analysis_constraints.map((constraint) => String(constraint?.kind || '').trim())
      : []
  )).filter(Boolean));
}

function associateConstraintsForDocument(doc, ...owners) {
  return owners.flatMap((owner) => (
    Array.isArray(owner?.analysis_constraints)
      ? owner.analysis_constraints.map((constraint) => (
        resolveAssociateConstraint(constraint, { owner, doc }).constraint || constraint
      ))
      : []
  ));
}

function groupHasNamedReceivers(group) {
  return (group.sections || []).some((section) => (section.receivers || []).some((receiver) => (
    (receiver.options || []).some((option) => optionIds(option).length)
  )));
}

function associateNamedSections(doc, { paperFigure = null } = {}) {
  const sections = [];
  const exactSource = usesCanonicalSourceContract(doc);
  const blueRidgeCarrier = blueRidgeDistinctAreaRuntimeCarrier(doc);
  const novaFigure34 = paperFigure === '3_4'
    ? northernVirginiaFigure34Aggregates(doc) : null;
  const novaAggregateGroups = new Set(
    novaFigure34?.ready ? novaFigure34.groups.map((row) => row.group) : [],
  );
  for (const [groupIndex, group] of (doc.requirement_groups || []).entries()) {
    if (novaAggregateGroups.has(group)) continue;
    const hasNamedReceivers = groupHasNamedReceivers(group);
    if (group.units_fill || (group.ge_area && !(exactSource && hasNamedReceivers))) continue;
    const runtimeSections = blueRidgeCarrier.ready && blueRidgeCarrier.group === group
      ? blueRidgeCarrier.sections : (group.sections || []);
    for (const [sectionIndex, section] of runtimeSections.entries()) {
      if (!(section.receivers || []).length) continue;
      sections.push({
        ...splitUnitPoolReceivers(section),
        groupLabel: group.label_seen || group.title || 'Named requirements',
        groupIndex,
        sectionIndex,
        groupConjunction: group.group_conjunction || 'And',
        groupStatedCredits: group.stated_credits ?? null,
        analysisConstraints: associateConstraintsForDocument(doc, doc, group, section),
        constraintKinds: [...constraintKinds(doc, group, section)],
      });
    }
  }
  return sections;
}

function candidateCourseSet(sections) {
  const ids = new Set();
  for (const section of sections) {
    for (const receiver of section.receivers || []) {
      for (const option of receiver.options || []) {
        for (const id of optionIds(option)) ids.add(id);
      }
    }
  }
  return ids;
}

function planAssociateDegree(
  sections,
  directlyEligible,
  generallyTransferable,
  unitsById,
  options = {},
) {
  if (options.strictConstraints) {
    return planAssociateDegreeStrict(
      sections,
      directlyEligible,
      generallyTransferable,
      unitsById,
      options,
    );
  }
  const chosen = new Set();
  const warnings = [];
  let complete = true;

  for (const section of sections) {
    let pick;
    if (section.unit_advisement != null) {
      pick = chooseUnitPlan(
        section,
        directlyEligible,
        generallyTransferable,
        unitsById,
        chosen,
      );
      if (!pick.complete) {
        complete = false;
        warnings.push(`${section.groupLabel} cannot reach its ${section.unit_advisement}-unit minimum with resolved courses.`);
      }
      if (/\bsequences?\b|\balternatives?\b|\bpathways?\b|\btracks?\b|\bcomplete\s+one\s+option\b|\bone\s+option\b|\bgroupings?\b|\bcourse\s+pairs?\b/i.test(section.groupLabel)) {
        warnings.push(`${section.groupLabel} is stored as a unit pool; sequence or pathway combinations remain an estimate.`);
      }
    } else {
      pick = chooseCoursePlan(
        section,
        directlyEligible,
        generallyTransferable,
        unitsById,
        chosen,
      );
      if (!pick.complete) {
        complete = false;
        warnings.push(`${section.groupLabel} cannot satisfy its ${pick.requiredCount}-course requirement with distinct resolved choices.`);
      }
    }
    for (const id of pick.ids || []) chosen.add(id);
  }

  const state = stateForIds(
    [...chosen],
    directlyEligible,
    generallyTransferable,
    unitsById,
  );
  return { ...state, complete, warnings: [...new Set(warnings)] };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function creditRange(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { min: value, max: value };
  }
  const numbers = String(value || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (!numbers.length) return null;
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
}

/**
 * Read a receiver's explicit Boolean shape for the strict Virginia planner.
 * `options_conjunction: or` means each option is a route.  The course ids
 * inside one option remain an indivisible AND bundle, so
 * `(CHM 111 + CHM 112) OR (PHY 241 + PHY 242)` produces two candidates, never
 * the invalid mixed pairs that a label-based section collapse admitted.
 */
function optionKeys(option) {
  // Canonical Virginia projections remint runtime `course_keys` as `cc:<id>`
  // and retain the source-readable identity in `source_course_keys`. Category
  // dictionaries are authored against those source codes, so classification
  // must use the retained source key when present. Numeric runtime ids remain
  // the selection/accounting identity through `optionIds`.
  const keys = Array.isArray(option?.source_course_keys)
    && option.source_course_keys.length
    ? option.source_course_keys : (option?.course_keys || []);
  return [...new Set(keys.map((key) => String(key || '').trim()).filter(Boolean))];
}

function exactSectionConstraints(section) {
  // Do not filter malformed category/filter constraints out here. The source
  // acceptance gate rejects them, and a direct planner call must fail closed
  // too instead of silently reverting to an unconstrained choice set.
  return (section.analysisConstraints || []).filter((constraint) => (
    DISTINCT_CATEGORY_KINDS.has(constraint?.kind)
    || constraint?.kind === 'excluded_ge_subject'
  ));
}

function constraintCategoryKey(constraint) {
  return `${constraint.kind}:${distinctCategoryMinimum(constraint)}`;
}

function strictOptionConstraintState(option, constraints) {
  const keys = optionKeys(option);
  const excludedSubjects = new Set(constraints
    .filter((constraint) => constraint.kind === 'excluded_ge_subject')
    .flatMap((constraint) => constraint.excluded_subjects || [])
    .map((subject) => String(subject).toUpperCase()));
  if (excludedSubjects.size && keys.some((key) => excludedSubjects.has(courseSubject(key)))) {
    return null;
  }

  const constraintCategories = {};
  for (const constraint of constraints.filter((entry) => DISTINCT_CATEGORY_KINDS.has(entry.kind))) {
    const categories = [...new Set(keys.map((key) => categoryForCourse(constraint, key)).filter(Boolean))];
    // Acceptance guarantees complete metadata, but the planner itself remains
    // fail-closed when invoked directly with a malformed source document.
    if (!keys.length || categories.length !== 1
        || keys.some((key) => !categoryForCourse(constraint, key))) return null;
    constraintCategories[constraintCategoryKey(constraint)] = categories;
  }
  return { constraintCategories };
}

function strictReceiverChoices(
  receiver,
  directlyEligible,
  generallyTransferable,
  unitsById,
  constraints = [],
) {
  const raw = (receiver.options || []).flatMap((option) => {
    const ids = optionIds(option);
    if (String(option?.course_conjunction || 'and').toLowerCase() === 'or') {
      const keys = optionKeys(option);
      return ids.map((id, index) => ({
        ...option,
        course_ids: [id],
        course_keys: keys[index] ? [keys[index]] : [],
        course_conjunction: 'and',
      }));
    }
    return ids.length ? [option] : [];
  });
  const options = String(receiver.options_conjunction || 'or').toLowerCase() === 'and'
    ? [{
      course_ids: [...new Set(raw.flatMap(optionIds))],
      course_keys: [...new Set(raw.flatMap(optionKeys))],
      course_conjunction: 'and',
    }]
    : raw;
  return options
    .map((option) => {
      const constraintState = strictOptionConstraintState(option, constraints);
      if (!constraintState) return null;
      return {
        ...scoredOption(option, directlyEligible, generallyTransferable, unitsById),
        ...constraintState,
      };
    })
    .filter(Boolean)
    .filter((option) => option.ids.length && option.total > 0)
    .sort(compareTransferChoice);
}

function mergeConstraintCategories(left = {}, right = {}) {
  const merged = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const before = left[key] || [];
    const after = right[key] || [];
    if (after.some((category) => before.includes(category))) return null;
    merged[key] = [...before, ...after];
  }
  return merged;
}

function strictSectionBounds(section) {
  const kinds = new Set(section.constraintKinds || []);
  const dynamic = kinds.has('dynamic_elective_credits_to_degree_minimum')
    || kinds.has('variable_transfer_elective_credit_fill');
  const variableCount = kinds.has('variable_choice_count_with_minimum_units');
  const optionSpecific = kinds.has('option_specific_credit_value')
    || kinds.has('option_specific_credit_values');
  const range = creditRange(section.groupStatedCredits);
  let requiredCount = section.section_advisement == null
    ? null
    : Math.max(0, finiteNumber(section.section_advisement) || 0);
  let minimumUnits = section.unit_advisement == null
    ? 0
    : Math.max(0, finiteNumber(section.unit_advisement) || 0);
  let maximumUnits = section.unit_advisement_max == null
    ? Infinity
    : Math.max(0, finiteNumber(section.unit_advisement_max) || 0);

  // Some catalogs publish a variable credit range with no universal course
  // count.  The canonical section retains one reviewed count as an audit
  // witness, but the exact analysis rule is the published credit range.
  if ((dynamic || variableCount) && range) {
    minimumUnits = range.min;
    maximumUnits = range.max;
    requiredCount = null;
  }

  // A printed four-credit capacity may explicitly permit a three-credit
  // option.  Where the source marks that fact, use the option's actual catalog
  // units and let the explicit degree floor/fill rule reconcile the residual.
  // The canonical compiler always materializes unit_advisement_max, including
  // when the printed slot has only one nominal value, so the explicit source
  // constraint (not field absence) is what authorizes the lower actual option.
  if (optionSpecific && requiredCount != null) {
    minimumUnits = 0;
  }

  return {
    requiredCount,
    minimumUnits,
    maximumUnits,
  };
}

function compareStrictPlan(a, b) {
  const ineligibleA = a.total - a.applicable;
  const ineligibleB = b.total - b.applicable;
  return ineligibleA - ineligibleB
    || a.total - b.total
    || b.transferred - a.transferred
    || b.applicable - a.applicable
    || a.ids.join(',').localeCompare(b.ids.join(','));
}

function buildStrictSectionCandidates(
  section,
  directlyEligible,
  generallyTransferable,
  unitsById,
) {
  const constraints = exactSectionConstraints(section);
  const { requiredCount, minimumUnits, maximumUnits } = strictSectionBounds(section);
  const receivers = section.receivers || [];
  let states = new Map([['', {
    ids: [], total: 0, transferred: 0, applicable: 0, selectedCount: 0,
    constraintCategories: {},
  }]]);

  for (const receiver of receivers) {
    const choices = strictReceiverChoices(
      receiver,
      directlyEligible,
      generallyTransferable,
      unitsById,
      constraints,
    );
    const next = new Map(states);
    for (const state of states.values()) {
      const used = new Set(state.ids);
      for (const option of choices) {
        if (option.ids.some((id) => used.has(id))) continue;
        const constraintCategories = mergeConstraintCategories(
          state.constraintCategories,
          option.constraintCategories,
        );
        if (!constraintCategories) continue;
        const selectedCount = state.selectedCount + 1;
        if (requiredCount != null && selectedCount > requiredCount) continue;
        const candidate = {
          ...stateForIds(
            [...state.ids, ...option.ids],
            directlyEligible,
            generallyTransferable,
            unitsById,
          ),
          selectedCount,
          constraintCategories,
        };
        if (candidate.total > maximumUnits + EPSILON) continue;
        const key = `${selectedCount}|${candidate.ids.join(',')}`;
        const incumbent = next.get(key);
        if (!incumbent || compareStrictPlan(candidate, incumbent) < 0) next.set(key, candidate);
      }
    }
    states = next;
  }

  return [...states.values()].filter((state) => (
    (requiredCount == null || state.selectedCount === requiredCount)
    && state.total + EPSILON >= minimumUnits
    && state.total <= maximumUnits + EPSILON
  )).sort(compareStrictPlan);
}

function distinctCategoryConstraintForSections(sections) {
  return sections.flatMap((section) => exactSectionConstraints(section))
    .find((constraint) => DISTINCT_CATEGORY_KINDS.has(constraint.kind)) || null;
}

function combineDistinctCategorySections(candidateSets, constraint) {
  const categoryKey = constraintCategoryKey(constraint);
  let states = [{
    ids: [], total: 0, transferred: 0, applicable: 0,
    constraintCategories: {},
  }];
  for (const candidates of candidateSets) {
    const next = [];
    for (const state of states) {
      const used = new Set(state.ids);
      for (const candidate of candidates) {
        if (candidate.ids.some((id) => used.has(id))) continue;
        const constraintCategories = mergeConstraintCategories(
          state.constraintCategories,
          candidate.constraintCategories,
        );
        if (!constraintCategories) continue;
        next.push({
          ids: [...state.ids, ...candidate.ids].sort((a, b) => a - b),
          total: state.total + candidate.total,
          transferred: state.transferred + candidate.transferred,
          applicable: state.applicable + candidate.applicable,
          constraintCategories,
        });
      }
    }
    states = next;
  }
  const minimum = distinctCategoryMinimum(constraint);
  return states.filter((state) => (
    (state.constraintCategories[categoryKey] || []).length >= minimum
  )).sort(compareStrictPlan);
}

function combineStrictSectionCandidates(candidateSets) {
  let states = [{
    ids: [], total: 0, transferred: 0, applicable: 0,
    constraintCategories: {},
  }];
  for (const candidates of candidateSets) {
    const next = [];
    for (const state of states) {
      const used = new Set(state.ids);
      for (const candidate of candidates) {
        if (candidate.ids.some((id) => used.has(id))) continue;
        const constraintCategories = mergeConstraintCategories(
          state.constraintCategories,
          candidate.constraintCategories,
        );
        if (!constraintCategories) continue;
        next.push({
          ids: [...state.ids, ...candidate.ids].sort((a, b) => a - b),
          total: state.total + candidate.total,
          transferred: state.transferred + candidate.transferred,
          applicable: state.applicable + candidate.applicable,
          constraintCategories,
        });
      }
    }
    states = next;
  }
  return states.sort(compareStrictPlan);
}

function strictPlanTasks(
  sections,
  directlyEligible,
  generallyTransferable,
  unitsById,
  options = {},
) {
  const groups = new Map();
  for (const [index, section] of sections.entries()) {
    const key = section.groupIndex ?? `legacy:${index}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(section);
  }

  const tasks = [];
  const warnings = [];
  let taskIndex = 0;
  for (const groupSections of groups.values()) {
    const isOr = String(groupSections[0]?.groupConjunction || 'And').toLowerCase() === 'or'
      && groupSections.length > 1;
    const distinctCategoryConstraint = distinctCategoryConstraintForSections(groupSections);
    const prerequisiteCompatibility = groupSections.flatMap((section) => (
      section.analysisConstraints || []
    )).find((constraint) => (
      constraint?.kind === 'prerequisite_and_sequence_compatibility'
    ));
    if (prerequisiteCompatibility && options.paperFigure === '6') {
      const selection = newRiverFigure6LaboratorySelection(options.sourceDocument);
      const groupIndex = groupSections[0]?.groupIndex;
      if (!selection.ready || selection.group_index !== groupIndex) {
        warnings.push(selection.reason
          || `${groupSections[0].groupLabel} moved from its exact Figure 6 source carrier.`);
        tasks.push({ index: taskIndex, label: groupSections[0].groupLabel, candidates: [] });
        taskIndex += 1;
        continue;
      }
      const candidateSets = groupSections.map((section) => buildStrictSectionCandidates(
        section,
        directlyEligible,
        generallyTransferable,
        unitsById,
      ));
      const selectedIds = [...selection.course_ids].sort((a, b) => a - b);
      const candidates = candidateSets.some((set) => !set.length)
        ? []
        : combineStrictSectionCandidates(candidateSets).filter((candidate) => (
          candidate.ids.length === selectedIds.length
          && candidate.ids.every((id, index) => id === selectedIds[index])
        ));
      if (!candidates.length) {
        warnings.push(`${groupSections[0].groupLabel} cannot realize its exact prerequisite-safe Figure 6 selection.`);
      }
      tasks.push({ index: taskIndex, label: groupSections[0].groupLabel, candidates });
      taskIndex += 1;
      continue;
    }
    if (distinctCategoryConstraint) {
      if (isOr) {
        warnings.push(`${groupSections[0].groupLabel} combines a category-distinct rule with mutually exclusive group routes.`);
        tasks.push({ index: taskIndex, label: groupSections[0].groupLabel, candidates: [] });
        taskIndex += 1;
        continue;
      }
      const candidateSets = groupSections.map((section) => buildStrictSectionCandidates(
        section,
        directlyEligible,
        generallyTransferable,
        unitsById,
      ));
      const candidates = candidateSets.some((set) => !set.length)
        ? []
        : combineDistinctCategorySections(candidateSets, distinctCategoryConstraint);
      if (!candidates.length) {
        warnings.push(`${groupSections[0].groupLabel} has no complete plan using ${distinctCategoryMinimum(distinctCategoryConstraint)} distinct source-defined categories.`);
      }
      tasks.push({ index: taskIndex, label: groupSections[0].groupLabel, candidates });
      taskIndex += 1;
      continue;
    }
    if (isOr) {
      const candidates = groupSections.flatMap((section) => buildStrictSectionCandidates(
        section,
        directlyEligible,
        generallyTransferable,
        unitsById,
      )).sort(compareStrictPlan);
      if (!candidates.length) {
        warnings.push(`${groupSections[0].groupLabel} has no complete explicitly modeled route.`);
      }
      tasks.push({ index: taskIndex, label: groupSections[0].groupLabel, candidates });
      taskIndex += 1;
      continue;
    }
    for (const section of groupSections) {
      const candidates = buildStrictSectionCandidates(
        section,
        directlyEligible,
        generallyTransferable,
        unitsById,
      );
      if (!candidates.length) {
        const count = section.section_advisement == null
          ? ''
          : `${section.section_advisement}-choice and `;
        warnings.push(`${section.groupLabel} cannot satisfy its ${count}${section.unit_advisement}-unit requirement with resolved courses.`);
      }
      tasks.push({ index: taskIndex, label: section.groupLabel, candidates });
      taskIndex += 1;
    }
  }
  return { tasks, warnings };
}

function betterStrictPrefix(candidate, incumbent) {
  if (!incumbent) return true;
  const ineligibleCandidate = candidate.total - candidate.applicable;
  const ineligibleIncumbent = incumbent.total - incumbent.applicable;
  return ineligibleCandidate < ineligibleIncumbent - EPSILON
    || (Math.abs(ineligibleCandidate - ineligibleIncumbent) <= EPSILON
      && (candidate.transferred > incumbent.transferred + EPSILON
        || (Math.abs(candidate.transferred - incumbent.transferred) <= EPSILON
          && candidate.idsKey < incumbent.idsKey)));
}

function solveStrictTasks(tasks, {
  totalUnits,
  totalUnitsMax,
  aggregateUnits = 0,
  hasUnitsFill = false,
  sourceBoundRequiredAnyIdSets = [],
  sourceBoundForbiddenCourseIds = [],
} = {}) {
  if (!Array.isArray(sourceBoundForbiddenCourseIds)
      || sourceBoundForbiddenCourseIds.some((id) => (
        !Number.isSafeInteger(Number(id)) || Number(id) <= 0
      ))) return null;
  const sourceBoundForbiddenIds = new Set(sourceBoundForbiddenCourseIds.map(Number));
  if (!tasks.length) {
    if (sourceBoundRequiredAnyIdSets.length) return null;
    const minimum = Math.max(0, finiteNumber(totalUnits) || 0);
    const maximum = finiteNumber(totalUnitsMax) ?? minimum;
    const fillerUnits = hasUnitsFill ? Math.max(0, minimum - aggregateUnits) : 0;
    const closedTotal = aggregateUnits + fillerUnits;
    return closedTotal + EPSILON >= minimum && closedTotal <= maximum + EPSILON
      ? { ids: [], total: 0, transferred: 0, applicable: 0, fillerUnits }
      : null;
  }
  if (tasks.some((task) => !task.candidates.length)) return null;

  // Most-constrained-first makes no-double-count backtracking cheap while the
  // authored task index remains the deterministic tie breaker.
  const ordered = [...tasks].sort((a, b) => a.candidates.length - b.candidates.length
    || a.index - b.index);
  const minimum = Math.max(0, finiteNumber(totalUnits) || 0);
  const maximum = finiteNumber(totalUnitsMax) ?? minimum;
  const namedMinimum = hasUnitsFill ? 0 : Math.max(0, minimum - aggregateUnits);
  const namedMaximum = Math.max(0, maximum - aggregateUnits);
  const remainingMin = Array(ordered.length + 1).fill(0);
  const remainingMax = Array(ordered.length + 1).fill(0);
  const futureIds = Array.from({ length: ordered.length + 1 }, () => new Set());
  // A source-bound route can be tested only at the terminal state, after one
  // of its ids has disappeared from `futureIds`. Preserve that progress in
  // the memo identity; otherwise an ordinary prefix can incorrectly prune a
  // feasible exact-route prefix with the same units.
  const sourceBoundRequiredIds = new Set(sourceBoundRequiredAnyIdSets
    .flatMap((required) => (Array.isArray(required) ? required.map(Number) : [])));
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const totals = ordered[index].candidates.map((candidate) => candidate.total);
    remainingMin[index] = remainingMin[index + 1] + Math.min(...totals);
    remainingMax[index] = remainingMax[index + 1] + Math.max(...totals);
    futureIds[index] = new Set(futureIds[index + 1]);
    for (const candidate of ordered[index].candidates) {
      for (const id of candidate.ids) futureIds[index].add(id);
    }
  }

  const memo = new Map();
  let best = null;
  const visit = (index, state) => {
    if (state.total > namedMaximum + EPSILON) return;
    if (state.total + remainingMax[index] + EPSILON < namedMinimum) return;
    if (state.total + remainingMin[index] > namedMaximum + EPSILON) return;

    if (index >= ordered.length) {
      if (sourceBoundRequiredAnyIdSets.length
          && !sourceBoundRequiredAnyIdSets.some((required) => (
            Array.isArray(required) && required.length > 0
              && required.every((id) => state.ids.includes(Number(id)))
          ))) return;
      const withAggregate = state.total + aggregateUnits;
      const fillerUnits = hasUnitsFill ? Math.max(0, minimum - withAggregate) : 0;
      const closedTotal = withAggregate + fillerUnits;
      if (closedTotal + EPSILON < minimum || closedTotal > maximum + EPSILON) return;
      const candidate = { ...state, fillerUnits };
      if (!best || compareStrictPlan(candidate, best) < 0) best = candidate;
      return;
    }

    const relevantUsed = state.ids.filter((id) => (
      futureIds[index].has(id) || sourceBoundRequiredIds.has(id)
    ));
    const memoKey = `${index}|${Math.round(state.total * 100)}|${relevantUsed.join(',')}`;
    const prefix = {
      total: state.total,
      transferred: state.transferred,
      applicable: state.applicable,
      idsKey: state.ids.join(','),
    };
    if (!betterStrictPrefix(prefix, memo.get(memoKey))) return;
    memo.set(memoKey, prefix);

    const used = new Set(state.ids);
    for (const choice of ordered[index].candidates) {
      if (choice.ids.some((id) => used.has(id))) continue;
      // Some source-bound agreement receipts prove that a selected edge is
      // unusable unless its companion course is also present.  When the
      // associate document offers only the lone half, remove that exact
      // course identity from the Boolean search instead of excluding the
      // entire college/university cell.  The search must still close every
      // authored section and the exact degree total without it.
      if (choice.ids.some((id) => sourceBoundForbiddenIds.has(Number(id)))) continue;
      const ids = [...state.ids, ...choice.ids].sort((a, b) => a - b);
      visit(index + 1, {
        ids,
        total: state.total + choice.total,
        transferred: state.transferred + choice.transferred,
        applicable: state.applicable + choice.applicable,
      });
    }
  };

  visit(0, {
    ids: [], total: 0, transferred: 0, applicable: 0,
  });
  return best;
}

function planAssociateDegreeStrict(
  sections,
  directlyEligible,
  generallyTransferable,
  unitsById,
  options,
) {
  const newRiverVirginiaTechSections = sections.filter((section) => (
    section?.sourceBoundRule === NEW_RIVER_VIRGINIA_TECH_SOURCE_RULE
  ));
  const newRiverVirginiaTechPairProof = options.newRiverVirginiaTechPairProof;
  if (newRiverVirginiaTechSections.length || newRiverVirginiaTechPairProof?.ready) {
    if (newRiverVirginiaTechSections.length !== 1
        || !newRiverVirginiaTechRuntimeSectionMatches(
          newRiverVirginiaTechSections[0],
          newRiverVirginiaTechPairProof,
        )) {
      return {
        ids: [], total: 0, transferred: 0, applicable: 0,
        complete: false,
        warnings: [
          'The exact receiver-bound New River/Virginia Tech six-credit carrier moved, changed, or lacks its current pair proof.',
        ],
      };
    }
  }
  const blueRidgeRulePresent = sections.some((section) => (
    (section.analysisConstraints || []).some((constraint) => (
      constraint?.source_bound_rule === BLUE_RIDGE_SOURCE_BOUND_RULE
    ))
  ));
  const blueRidgeCarrier = blueRidgeDistinctAreaRuntimeCarrier(options.sourceDocument);
  if ((blueRidgeRulePresent || blueRidgeCarrier.handled) && !blueRidgeCarrier.ready) {
    return {
      ids: [], total: 0, transferred: 0, applicable: 0,
      complete: false,
      warnings: [blueRidgeCarrier.reason
        || 'The exact Blue Ridge distinct-category source proof did not pass.'],
    };
  }
  if (blueRidgeCarrier.ready) {
    const runtimeSections = sections.filter((section) => (
      section.groupIndex === blueRidgeCarrier.group_index
    ));
    if (runtimeSections.length !== blueRidgeCarrier.sections.length
        || runtimeSections.some((section) => !(
          section.analysisConstraints || []
        ).some((constraint) => (
          constraint?.source_bound_rule === BLUE_RIDGE_SOURCE_BOUND_RULE
        )))) {
      return {
        ids: [], total: 0, transferred: 0, applicable: 0,
        complete: false,
        warnings: ['The exact Blue Ridge runtime carrier moved or was omitted from the planner input.'],
      };
    }
  }
  if (options.paperFigure === '3_4') {
    const novaFigure34 = northernVirginiaFigure34Aggregates(options.sourceDocument);
    if (novaFigure34.handled && !novaFigure34.ready) {
      return {
        ids: [], total: 0, transferred: 0, applicable: 0,
        complete: false,
        warnings: [novaFigure34.reason
          || 'The exact NOVA Figure 3/4 aggregate proof did not pass.'],
      };
    }
  }
  const { tasks, warnings } = strictPlanTasks(
    sections,
    directlyEligible,
    generallyTransferable,
    unitsById,
    options,
  );
  if (warnings.length) {
    return {
      ids: [], total: 0, transferred: 0, applicable: 0,
      complete: false, warnings: [...new Set(warnings)],
    };
  }
  const result = solveStrictTasks(tasks, options);
  if (!result) {
    return {
      ids: [], total: 0, transferred: 0, applicable: 0,
      complete: false,
      warnings: ['No source-valid associate-degree plan satisfies every count, unit, distinct-course, and degree-total constraint.'],
    };
  }
  return { ...result, complete: true, warnings: [] };
}

function geBlocks(doc) {
  const blocks = [];
  const exactSource = usesCanonicalSourceContract(doc);
  const novaFigure34 = exactSource
    ? northernVirginiaFigure34Aggregates(doc) : null;
  const novaAggregateUnits = new Map(
    novaFigure34?.ready ? novaFigure34.groups.map((row) => [row.group, row.units]) : [],
  );
  const collegeSystem = doc.unit_system === 'quarter' ? 'quarter' : 'semester';
  const geLabel = /general\s*education|\bgen(?:eral)?[\s.]*ed\b/i;
  for (const group of doc.requirement_groups || []) {
    if (group.units_fill) continue;
    const hasReceivers = groupHasNamedReceivers(group);
    // Virginia's canonical source can retain `ge_area` as classification
    // metadata on an exact named-course menu.  Such a group is a named
    // requirement, not an additional aggregate block.  Treating it as both
    // silently double counted the same credits; treating every ge_area as an
    // aggregate silently discarded the enumerated courses.
    if (exactSource && group.ge_area && hasReceivers && !novaAggregateUnits.has(group)) continue;
    const labelled = !group.ge_area && !hasReceivers && geLabel.test(group.label_seen || '');
    if (!group.ge_area && !labelled) continue;
    const stated = Number((group.sections || [])[0]?.unit_advisement);
    const semesterDefault = GE_DEFAULT_SEMESTER_UNITS[group.ge_area]
      || GE_STATUTORY_MINIMUM_SEMESTER_UNITS;
    const units = novaAggregateUnits.get(group) ?? (Number.isFinite(stated) && stated > 0
      ? stated
      : fromSemesterUnits(semesterDefault, collegeSystem));
    blocks.push({
      pattern: group.ge_area || 'unlabelled',
      units,
      verified: GE_UC_VERIFIED.has(group.ge_area),
    });
  }
  return blocks;
}

function unresolvedCount(doc) {
  return (doc.requirement_groups || [])
    .reduce((count, group) => count + (group.unresolved_courses_seen || []).length, 0);
}

function unresolvedConflictEntries(value) {
  if (value == null || value === false) return 0;
  if (Array.isArray(value)) {
    return value.reduce((count, entry) => count + unresolvedConflictEntries(entry), 0);
  }
  if (typeof value !== 'object') return value ? 1 : 0;
  const status = String(value.status || value.verdict || '').toLowerCase();
  if (value.resolved === true || ['resolved', 'accepted', 'closed', 'pass'].includes(status)) return 0;
  return 1;
}

/**
 * Count explicit blockers that would make an `analysis_ready: true` stamp
 * internally inconsistent.  This is a defensive service-side gate: the
 * acceptance pipeline remains the primary validator, but a stale/manual stamp
 * cannot turn unresolved source evidence into a computed paper cell.
 */
function unresolvedSourceConflictCount(doc, {
  associate = doc?.kind === 'as_degree',
  figures = null,
} = {}) {
  let count = unresolvedCount(doc);
  const requestedFigures = Array.isArray(figures)
    ? new Set(figures.map(String)) : null;
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'unresolved_courses_seen') continue;
      if (key === 'analysis_constraints' && Array.isArray(child)) {
        // Associate rules are executed by this service's exact planner and
        // therefore remain part of its defensive conflict audit. Four-year
        // rules use the figure-scoped capability audit instead: counting every
        // bachelor constraint here would relabel a proven GPA/administrative
        // non-impact as an unresolved Figure 3/4 source conflict.
        if (associate && !requestedFigures) {
          count += child.filter((constraint) => (
            !hasAssociateConstraintEvaluator(constraint, { owner: value, doc })
            || associateConstraintContextIssues(constraint, value, doc).length > 0
          )).length;
        }
        continue;
      }
      if (/conflicts?$/i.test(key) || /^unresolved(?:_|$)/i.test(key)) {
        count += unresolvedConflictEntries(child);
        continue;
      }
      visit(child);
    }
  };
  visit(doc);

  // Figure services use the current capability audit, not a stale aggregate
  // acceptance receipt. This preserves real raw conflicts/unresolved courses
  // above while preventing a Figure 6-only rule from disabling Figures 3/4.
  if (associate && requestedFigures) {
    count += auditAssociateDocument(doc).active_blockers.filter((rule) => (
      (rule.affected_figures || []).some((figure) => requestedFigures.has(String(figure)))
    )).length;
  }

  if (Array.isArray(doc.extraction?.modeling_warnings)) {
    count += doc.extraction.modeling_warnings.length;
  }
  if (Array.isArray(doc.acceptance_failures?.catalog)) {
    count += doc.acceptance_failures.catalog.length;
  }
  if (!requestedFigures && Array.isArray(doc.acceptance_failures?.analysis)) {
    count += doc.acceptance_failures.analysis.length;
  }
  if (Array.isArray(doc.acceptance?.catalog?.failed)) {
    count += doc.acceptance.catalog.failed.length;
  }
  if (!requestedFigures && Array.isArray(doc.acceptance?.analysis_ready?.failed)) {
    count += doc.acceptance.analysis_ready.failed.length;
  }
  return count;
}

// The current AS schema describes choices inside a section, but a few source
// records describe mutually exclusive pathways as separate requirement
// groups. Summing those groups would invent a degree no student completes.
// Keep these records visible but uncomputed until the source is normalized to
// an explicit group-level OR. A phrase such as “complete one option” inside an
// ordinary required block is *not* enough evidence: Economics degrees repeat
// that wording across independently required calculus/List A/List B blocks.
function groupChoiceAmbiguity(doc) {
  const labels = (doc.requirement_groups || [])
    .filter((group) => !group.units_fill && !group.ge_area)
    .map((group) => String(group.label_seen || group.title || ''));
  const optionGroups = labels.filter((label) => (
    /\boption\b\s*(?:\(|:|[-—])/i.test(label)
    || /^\s*option\s+[a-z0-9]/i.test(label)
  ));
  const emphasisGroups = labels.filter((label) => /\bemphasis\b/i.test(label));
  const explicitAlternative = labels.find((label) =>
    /\balternative\b.*\b(pathway|track)\b|\b(pathway|track)\b.*\balternative\b/i.test(label));
  if (optionGroups.length > 1) {
    return 'The catalog stores mutually exclusive degree options as separate groups; group-level choose-one structure must be curated before this degree can be modeled.';
  }
  if (emphasisGroups.length > 1) {
    return 'The catalog stores mutually exclusive emphasis areas as separate groups; group-level choose-one structure must be curated before this degree can be modeled.';
  }
  if (explicitAlternative) {
    return 'The catalog stores an alternative pathway beside the primary pathway; group-level choose-one structure must be curated before this degree can be modeled.';
  }
  return null;
}

function agreementOptionsByPid(agreements) {
  const out = new Map();
  for (const agreement of agreements) {
    for (const group of agreement.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          if (receiver.articulation_status !== 'articulated') continue;
          const options = (receiver.options || []).map(optionIds).filter((ids) => ids.length);
          for (const pid of receivingPids(receiver.receiving)) {
            if (!out.has(pid)) out.set(pid, []);
            out.get(pid).push(...options);
          }
        }
      }
    }
  }
  return out;
}

function templateCourseReceivers(template) {
  return (template.requirement_groups || []).flatMap((group) =>
    (group.sections || []).flatMap((section) =>
      (section.receivers || []).filter((receiver) => receivingPids(receiver.receiving).length)));
}

// Broad eligibility is used only to choose a transfer-oriented AS plan. The
// later template allocation enforces the UC section's choose-N and series
// capacity before any units are actually credited.
function broadlyEligibleCourseIds(template, agreements, degreeCourseSet) {
  const optionsByPid = agreementOptionsByPid(agreements);
  const eligible = new Set();
  for (const receiver of templateCourseReceivers(template)) {
    const pids = receivingPids(receiver.receiving);
    const usableByPid = pids.map((pid) => (optionsByPid.get(pid) || [])
      .filter((ids) => ids.every((id) => degreeCourseSet.has(id))));
    if (usableByPid.some((options) => !options.length)) continue;
    for (const options of usableByPid) {
      for (const ids of options) for (const id of ids) eligible.add(id);
    }
  }
  return eligible;
}

function assumedRole(section, receivers) {
  const assumed = section.assume_satisfiable
    || receivers.some((receiver) => receiver.assume_satisfiable);
  if (!assumed) return null;
  const roles = receivers.map((receiver) => receiver.credit_role).filter(Boolean);
  if (roles.includes('elective_capacity')) return 'elective';
  if (roles.includes('zero_unit_requirement')) return 'zero';
  if (roles.includes('ge_certification') || roles.includes('certification_piece')) return 'ge';
  const codes = receivers.map((receiver) => String(receiver.receiving?.code || '').toUpperCase());
  if (codes.some((code) => code === 'ELECTIVE')) return 'elective';
  if (codes.some((code) => ['AH&I', 'AHI', 'AH& I'].includes(code))) return 'zero';
  return 'ge';
}

function sectionCampusUnits(section, ask) {
  const stated = Number(section.unit_advisement);
  // Zero is an authored figure, not a missing one: Berkeley's American
  // Cultures requirement double-counts with breadth and is stated at 0 units.
  // Re-pricing it at the per-course assumption invented four units of GE
  // demand on both Berkeley documents.
  return section.unit_advisement != null && Number.isFinite(stated) && stated >= 0
    ? stated
    : ask * ASSUMED_UNITS_PER_COURSE;
}

function bestUsableOption(options, planSet, unitsById) {
  return options
    .filter((ids) => ids.length && ids.every((id) => planSet.has(id)))
    .map((ids) => ({ ids, units: unitsForIds(ids, unitsById) }))
    .sort((a, b) => b.units - a.units || a.ids.join(',').localeCompare(b.ids.join(',')))[0] || null;
}

function directCandidate(receiver, optionsByPid, planSet, unitsById) {
  const pids = receivingPids(receiver.receiving);
  if (!pids.length) return null;
  const ids = new Set();
  for (const pid of pids) {
    const option = bestUsableOption(optionsByPid.get(pid) || [], planSet, unitsById);
    if (!option) return null;
    for (const id of option.ids) ids.add(id);
  }
  return { ids: [...ids].sort((a, b) => a - b) };
}

function hasGeFallback(section, receivers) {
  return (section.ge_areas || []).length > 0
    || receivers.some((receiver) => (receiver.ge_areas || []).length > 0);
}

// One requirement section applied against the AS plan, mutating `state`.
// Kept separate from the group walk so an `Or` group can try each alternative
// on a cloned state and commit only the winner.
function evaluateSection(
  section,
  group,
  ctx,
  state,
  { forceNamed = false, forceUniversityOnly = false } = {},
) {
  const {
    optionsByPid, planSet, unitsById, campusSystem, collegeSystem, exactSource,
    sourceDocument,
  } = ctx;
  // A group marked university-only is university-only in its entirety, in
  // either vocabulary; a section's own tier only counts under ordinary groups
  // (shared rule with the unit budget, via degreeSlots).
  const isLowerDivision = resolveSectionTier(group, section, sourceDocument) !== 'nontransferable';
  const receivers = section.receivers || [];
  if (!receivers.length) return;
  const ask = Math.max(0, Number(section.section_advisement) || receivers.length);
  if (!ask) return;
  const campusUnits = sectionCampusUnits(section, ask);

  const canonicalRole = exactSource && !forceNamed
    ? canonicalRequirementRole(sourceDocument, group, section) : null;
  if (canonicalRole?.applies && !canonicalRole.exact) {
    state.requirementRoleIssues.push({
      issues: canonicalRole.issues,
      evidence: canonicalRole.evidence,
    });
    return;
  }
  if (forceUniversityOnly) return;
  // In the canonical Virginia contract, university-only means exactly that:
  // an associate-degree course cannot discharge the section.  Legacy CA/MA
  // behavior is preserved byte-for-byte because their older templates may
  // use the same tier vocabulary less strictly.
  if (exactSource && !isLowerDivision) return;
  // Legacy CA/MA retains its historical assumption/carrier rules. Canonical
  // Virginia reads the authored semantic role, so an all-ge_area upper-level
  // major menu remains named demand and an assumed major menu cannot turn into
  // GE merely because the storage carrier is open.
  const role = canonicalRole?.exact
    ? canonicalRole.role
    : assumedRole(section, receivers);
  if (role === 'elective'
      || role === CANONICAL_REQUIREMENT_ROLES.ELECTIVE_CAPACITY) {
    state.electiveCampusUnits += campusUnits;
    if (isLowerDivision) state.lowerElectiveCampusUnits += campusUnits;
    return;
  }
  if (role === 'zero' || role === CANONICAL_REQUIREMENT_ROLES.ZERO_UNIT) return;
  if (role === 'ge' || role === CANONICAL_REQUIREMENT_ROLES.GENERAL_EDUCATION) {
    state.geCampusUnits += campusUnits;
    if (isLowerDivision) state.lowerGeCampusUnits += campusUnits;
    return;
  }

  const geReceivers = receivers.filter((receiver) => receiver.receiving?.kind === 'ge_area');
  // Virginia uses `ge_area` receivers for open course categories as well as
  // actual GE requirements (for example, "any CPSC 500-level course").  A
  // mixed menu must retain its named-course alternatives: classifying the
  // whole section as GE merely because one open category is present silently
  // discards every articulation to those courses.  Only an all-GE Virginia
  // section is GE-only. Keep the historical any-GE rule for CA/MA so their
  // serialized figure payloads cannot move under this Virginia correction.
  const isGeOnlySection = geReceivers.length > 0
    && (!exactSource || geReceivers.length === receivers.length);
  if (isGeOnlySection) {
    state.geCampusUnits += campusUnits;
    if (isLowerDivision) state.lowerGeCampusUnits += campusUnits;
    return;
  }

  // A zero-credit mixed section is a designation/overlap requirement, not
  // another place to spend the sending course. It contributes no units and
  // must not reserve a course id that can earn credit in a later real slot.
  if (exactSource && geReceivers.length && campusUnits <= EPSILON) return;

  const candidates = receivers
    .map((receiver) => directCandidate(receiver, optionsByPid, planSet, unitsById))
    .filter(Boolean);
  const available = [...candidates];
  const selected = [];
  const sectionCapacity = campusUnitsToCollege(
    campusUnits,
    campusSystem,
    collegeSystem
  );
  let sectionAppliedUnits = 0;
  while (available.length && selected.length < ask) {
    available.sort((a, b) => {
      const newA = unitsForIds(a.ids.filter((id) => !state.directIds.has(id)), unitsById);
      const newB = unitsForIds(b.ids.filter((id) => !state.directIds.has(id)), unitsById);
      return newB - newA || a.ids.join(',').localeCompare(b.ids.join(','));
    });
    const candidate = available.shift();
    selected.push(candidate);
    const newlyAppliedIds = candidate.ids.filter((id) => !state.directIds.has(id));
    const rawNewUnits = unitsForIds(newlyAppliedIds, unitsById);
    // Articulation can require a larger CC bundle for a smaller UC course.
    // Only the authored UC requirement capacity counts in the named bucket;
    // any excess may still land in explicit elective room later.
    const capacityRemaining = Math.max(0, sectionCapacity - sectionAppliedUnits);
    const appliedHere = Math.min(rawNewUnits, capacityRemaining);
    sectionAppliedUnits += appliedHere;
    state.directAppliedUnits += appliedHere;
    if (isLowerDivision) state.lowerDirectAppliedUnits += appliedHere;
    for (const id of candidate.ids) {
      state.directIds.add(id);
      if (isLowerDivision) state.lowerDirectIds.add(id);
    }
  }

  if (hasGeFallback(section, receivers) && selected.length < ask) {
    const fallbackUnits = campusUnits * ((ask - selected.length) / ask);
    state.geCampusUnits += fallbackUnits;
    if (isLowerDivision) state.lowerGeCampusUnits += fallbackUnits;
  }
}

function cloneEvaluationState(state) {
  return {
    ...state,
    directIds: new Set(state.directIds),
    lowerDirectIds: new Set(state.lowerDirectIds),
    requirementRoleIssues: [...state.requirementRoleIssues],
    sourceBoundApplicationIssues: [...(state.sourceBoundApplicationIssues || [])],
  };
}

// How much a candidate state advanced past a base state, in campus units, so
// alternative paths priced in different unit systems compare on one scale.
function campusGain(candidate, base, collegeSystem, campusSystem) {
  return collegeUnitsToCampus(
    candidate.directAppliedUnits - base.directAppliedUnits,
    collegeSystem,
    campusSystem
  )
    + (candidate.geCampusUnits - base.geCampusUnits)
    + (candidate.electiveCampusUnits - base.electiveCampusUnits);
}

function exactOduApplicationSelection(template, ctx, state) {
  const report = oduTechnicalSciencePairs(template);
  if (!report.ready) return null;
  const technicalGroup = template.requirement_groups[3];
  const scienceGroup = template.requirement_groups[10];
  const candidates = report.pairs.map((pair) => {
    const candidate = cloneEvaluationState(state);
    evaluateSection({
      ...technicalGroup.sections[0], receivers: [pair.technical_receiver],
    }, technicalGroup, ctx, candidate);
    evaluateSection({
      ...scienceGroup.sections[0], receivers: [pair.science_receiver],
    }, scienceGroup, ctx, candidate, { forceNamed: true });
    return {
      ...pair,
      state: candidate,
      gain: campusGain(candidate, state, ctx.collegeSystem, ctx.campusSystem),
      direct_gain: candidate.directAppliedUnits - state.directAppliedUnits,
    };
  }).sort((a, b) => b.gain - a.gain
    || b.direct_gain - a.direct_gain
    || a.technical_index - b.technical_index
    || a.science_index - b.science_index)[0] || null;
  return candidates;
}

function exactBridgewaterApplicationSelection(template, ctx, state) {
  const report = bridgewaterTrackSelection(template, { transferEntry: true });
  if (!report.ready) return null;
  const candidates = report.tracks.map((track) => {
    const candidate = cloneEvaluationState(state);
    const sectionIndices = {
      2: track.index,
      3: track.index,
      4: 1,
      8: track.index,
      9: track.index,
    };
    for (const [groupIndex, group] of (template.requirement_groups || []).entries()) {
      const sections = group.sections || [];
      const isOr = String(group.group_conjunction || '').toLowerCase() === 'or'
        && sections.length > 1;
      if (!isOr) {
        for (const section of sections) evaluateSection(section, group, ctx, candidate);
        continue;
      }
      const selected = sectionIndices[groupIndex];
      if (!Number.isInteger(selected) || !sections[selected]) return null;
      evaluateSection(sections[selected], group, ctx, candidate);
    }
    return {
      ...track,
      state: candidate,
      direct_gain: candidate.directAppliedUnits - state.directAppliedUnits,
      total_gain: campusGain(candidate, state, ctx.collegeSystem, ctx.campusSystem),
    };
  }).filter(Boolean).sort((a, b) => b.direct_gain - a.direct_gain
    || b.total_gain - a.total_gain
    || a.index - b.index);
  return candidates[0] || null;
}

function exactNorfolkStateApplicationSelection(template, ctx, state) {
  const report = norfolkStateSciencePairs(template);
  if (!report.ready) return null;
  const scienceGroup = template.requirement_groups?.[1];
  if (!scienceGroup?.sections?.[0] || !scienceGroup?.sections?.[1]) return null;
  return report.pairs.map((pair) => {
    const candidate = cloneEvaluationState(state);
    evaluateSection({
      ...scienceGroup.sections[0], receivers: [pair.first_receiver],
    }, scienceGroup, ctx, candidate, { forceNamed: true });
    evaluateSection({
      ...scienceGroup.sections[1], receivers: [pair.second_receiver],
    }, scienceGroup, ctx, candidate, { forceNamed: true });
    return {
      ...pair,
      state: candidate,
      gain: campusGain(candidate, state, ctx.collegeSystem, ctx.campusSystem),
      direct_gain: candidate.directAppliedUnits - state.directAppliedUnits,
    };
  }).sort((left, right) => (
    right.gain - left.gain
    || right.direct_gain - left.direct_gain
    || left.first_index - right.first_index
    || left.second_index - right.second_index
  ))[0] || null;
}

const VIRGINIA_TECH_SLUG = 'virginia-polytechnic-institute-and-state-university';

function isVirginiaTechApplicationCandidate(template) {
  return template?.slug === VIRGINIA_TECH_SLUG
    || template?.institution_id === `va:uni:${VIRGINIA_TECH_SLUG}`
    || template?._id === `va:degree:${VIRGINIA_TECH_SLUG}:cs`
    || Number(template?.school_id) === 9230;
}

function usableReceiverOptions(receiver, ctx, state) {
  const pids = receivingPids(receiver?.receiving);
  if (pids.length !== 1) return [];
  const seen = new Set();
  return (ctx.optionsByPid.get(pids[0]) || []).flatMap((rawIds) => {
    const ids = [...new Set(rawIds)].sort((a, b) => a - b);
    const key = ids.join(',');
    if (!ids.length || seen.has(key)
        || ids.some((id) => !ctx.planSet.has(id) || state.directIds.has(id))) return [];
    seen.add(key);
    const units = unitsForIds(ids, ctx.unitsById);
    return units > EPSILON ? [{ ids, units }] : [];
  });
}

function virginiaTechFreeElectiveCapacity(template) {
  const group = template?.requirement_groups?.[10];
  const sections = group?.sections || [];
  const freeUnits = sections.map((section) => {
    const capacities = (section.receivers || []).filter((receiver) => (
      receiver?.receiving?.kind === 'requirement'
    )).map((receiver) => Number(receiver.receiving.units));
    return capacities.length === 1 ? capacities[0] : null;
  });
  const exact = String(group?.group_conjunction || '').toLowerCase() === 'or'
    && sections.length === 6
    && sections.every((section) => Number(section.unit_advisement) === 10)
    && JSON.stringify(freeUnits) === JSON.stringify([7, 7, 7, 7, 8, 4]);
  return exact ? { ready: true, maximum: 8, honorsRemaining: 4 } : {
    ready: false,
    reason: 'the exact Virginia Tech statistics/free-elective Or-path capacity changed',
  };
}

function compareVirginiaTechMathApplications(left, right) {
  return right.covered - left.covered
    || right.namedApplied - left.namedApplied
    // When the computable result ties, retain an ordinary three-credit course
    // instead of inventing where MATH 2405H's standalone two-credit surplus
    // lands. A uniquely better standalone route is detected below and blocks
    // the cell rather than being silently replaced with a worse pathway.
    || Number(left.standaloneHonors) - Number(right.standaloneHonors)
    || right.pairElectiveApplied - left.pairElectiveApplied
    || left.unapplied - right.unapplied
    || right.rawUnits - left.rawUnits
    || left.key.localeCompare(right.key);
}

function exactVirginiaTechMathApplication(template, ctx, state) {
  const articulated = new Set();
  for (const sectionIndex of [5, 6]) {
    const section = template?.requirement_groups?.[0]?.sections?.[sectionIndex];
    for (const receiver of section?.receivers || []) {
      if (!usableReceiverOptions(receiver, ctx, state).length) continue;
      for (const pid of receivingPids(receiver.receiving)) articulated.add(pid);
    }
  }
  const selection = standardMathAndPathwaysSelection(template, { articulated });
  if (!selection.ready) return { ready: false, reason: selection.reason };

  const routeRows = [5, 6].map((sectionIndex) => ({
    sectionIndex,
    receiverIndices: selection.section_receiver_indices[`0:${sectionIndex}`],
  }));
  if (routeRows.some((row) => !Array.isArray(row.receiverIndices))) {
    return { ready: false, reason: 'the exact Virginia Tech mathematics route is incomplete' };
  }

  const choicesBySlot = routeRows.map(({ sectionIndex, receiverIndices }) => {
    const section = template.requirement_groups[0].sections[sectionIndex];
    return [null, ...receiverIndices.flatMap((receiverIndex) => {
      const receiver = section.receivers?.[receiverIndex];
      const code = String(receiver?.code_seen || receiver?.receiving?.code || '');
      return usableReceiverOptions(receiver, ctx, state).map((option) => ({
        ...option, code, receiverIndex, sectionIndex,
      }));
    })];
  });

  const applications = [];
  for (const first of choicesBySlot[0]) {
    for (const second of choicesBySlot[1]) {
      const selected = [first, second].filter(Boolean);
      const ids = selected.flatMap((choice) => choice.ids);
      if (new Set(ids).size !== ids.length) continue;
      const honorsPair = selection.math_route === 'honors_pair';
      const namedApplied = selected.reduce((sum, choice) => (
        sum + Math.min(choice.units, 3)
      ), 0);
      const pairElectiveApplied = honorsPair ? selected.reduce((sum, choice) => (
        sum + Math.max(0, Math.min(choice.units, 5) - 3)
      ), 0) : 0;
      const receivingBonus = honorsPair ? selected.reduce((sum, choice) => (
        sum + Math.max(0, 5 - Math.min(choice.units, 5))
      ), 0) : 0;
      const unapplied = honorsPair ? selected.reduce((sum, choice) => (
        sum + Math.max(0, choice.units - 5)
      ), 0) : 0;
      const standaloneHonors = !honorsPair
        && selected.some((choice) => choice.code === 'MATH2405H');
      applications.push({
        selected,
        covered: selected.length,
        namedApplied,
        pairElectiveApplied,
        receivingBonus,
        unapplied,
        rawUnits: selected.reduce((sum, choice) => sum + choice.units, 0),
        standaloneHonors,
        key: selected.map((choice) => (
          `${choice.sectionIndex}:${choice.receiverIndex}:${choice.ids.join(',')}`
        )).join('|'),
      });
    }
  }
  applications.sort(compareVirginiaTechMathApplications);
  const application = applications[0];
  if (!application) {
    return { ready: false, reason: 'the exact Virginia Tech mathematics route has no legal state' };
  }
  return { ready: true, selection, ...application };
}

function commitVirginiaTechMathApplication(state, application) {
  state.directAppliedUnits += application.namedApplied;
  state.lowerDirectAppliedUnits += application.namedApplied;
  state.sourceBoundElectiveAppliedUnits += application.pairElectiveApplied;
  state.sourceBoundUnappliedUnits += application.unapplied;
  state.sourceBoundReceivingCreditBonusCampusUnits += application.receivingBonus;
  state.sourceBoundVirginiaTechMathRoute = application.selection.math_route;
  for (const choice of application.selected) {
    for (const id of choice.ids) {
      state.directIds.add(id);
      state.lowerDirectIds.add(id);
    }
  }
  if (application.standaloneHonors) {
    state.sourceBoundUnappliedUnits += application.selected
      .filter((choice) => choice.code === 'MATH2405H')
      .reduce((sum, choice) => sum + Math.max(0, choice.units - 3), 0);
    state.sourceBoundApplicationIssues.push({
      kind: 'virginia_tech_standalone_math_2405h_surplus',
      reason: 'MATH 2405H is a legal standalone substitution, but the retained source does not say where its two credits above the three-credit MATH 2114 slot apply.',
    });
  }
}

// Apply the feasible AS plan to the full UC template. The return capacities
// remain in campus-native units; the caller converts them to the CC system.
function evaluateTemplate(
  template,
  agreements,
  planSet,
  unitsById,
  campusSystem,
  collegeSystem,
  exactSource = false,
  { associateDocument = null, uvaWiseGaaScenario = null } = {},
) {
  const ctx = {
    optionsByPid: agreementOptionsByPid(agreements),
    planSet,
    unitsById,
    campusSystem,
    collegeSystem,
    exactSource,
    sourceDocument: template,
  };
  let state = {
    directIds: new Set(),
    lowerDirectIds: new Set(),
    directAppliedUnits: 0,
    lowerDirectAppliedUnits: 0,
    geCampusUnits: 0,
    lowerGeCampusUnits: 0,
    electiveCampusUnits: 0,
    lowerElectiveCampusUnits: 0,
    requirementRoleIssues: [],
    sourceBoundApplicationIssues: [],
    sourceBoundElectiveAppliedUnits: 0,
    sourceBoundUnappliedUnits: 0,
    sourceBoundReceivingCreditBonusCampusUnits: 0,
  };

  let exactVirginiaTechApplication = null;
  if (exactSource && isVirginiaTechApplicationCandidate(template)) {
    const exactTree = exactVirginiaTechTree(template);
    const freeCapacity = exactTree.supported
      ? virginiaTechFreeElectiveCapacity(template) : null;
    if (!exactTree.supported || !freeCapacity?.ready) {
      state.sourceBoundApplicationIssues.push({
        kind: 'virginia_tech_source_bound_application',
        reason: exactTree.supported ? freeCapacity.reason : exactTree.reason,
      });
      return state;
    }
    exactVirginiaTechApplication = { freeCapacity, math: null };
  }

  let exactVirginiaTechCscPair = null;
  if (exactSource) {
    exactVirginiaTechCscPair = virginiaTechAtomicRuntimeContext({
      bachelorDocument: template,
      associateDocument,
      agreements,
      planSet,
      unitsById,
    });
    if (exactVirginiaTechCscPair.applicable && !exactVirginiaTechCscPair.ready) {
      state.sourceBoundApplicationIssues.push({
        kind: 'virginia_tech_csc205_csc215_atomic_articulation',
        reason: exactVirginiaTechCscPair.reason,
      });
      return state;
    }
    if (exactVirginiaTechCscPair.ready
        && (campusSystem !== 'semester' || collegeSystem !== 'semester')) {
      state.sourceBoundApplicationIssues.push({
        kind: 'virginia_tech_csc205_csc215_atomic_articulation',
        reason: 'the exact CSC 205 + CSC 215 application is bound to semester-credit sources',
      });
      return state;
    }
  }

  if (exactSource) {
    const vcuWaiver = vcuTransferOrientedAsWaiver(
      template,
      associateDocument,
    );
    if (vcuWaiver.applicable && !vcuWaiver.ready) {
      state.sourceBoundApplicationIssues.push({
        kind: 'vcu_transfer_oriented_as_policy',
        reason: vcuWaiver.reason,
      });
      return state;
    }
    if (vcuWaiver.ready) state.sourceBoundVcuTransferWaiver = vcuWaiver;
  }

  if (exactSource) {
    const uvaWiseWaiver = uvaWiseVccsGaaWaiver(
      template,
      associateDocument,
      { scenario: uvaWiseGaaScenario },
    );
    if (uvaWiseWaiver.ready) state.sourceBoundUvaWiseVccsGaa = uvaWiseWaiver;
  }

  if (exactSource) {
    const shenandoahPair = shenandoahFigure34PairProof(
      template,
      associateDocument,
    );
    if (shenandoahPair.applicable && !shenandoahPair.ready) {
      state.sourceBoundApplicationIssues.push({
        kind: 'shenandoah_as_general_education_domain_policy',
        reason: shenandoahPair.reason,
      });
      return state;
    }
    if (shenandoahPair.ready) state.sourceBoundShenandoahAs = shenandoahPair;
  }

  if (exactSource) {
    const radfordWaiver = radfordCompletedAsRealWaiver(
      template,
      associateDocument,
    );
    if (radfordWaiver.applicable && !radfordWaiver.ready) {
      state.sourceBoundApplicationIssues.push({
        kind: 'radford_completed_as_real_policy',
        reason: radfordWaiver.reason,
      });
      return state;
    }
    if (radfordWaiver.ready) state.sourceBoundRadfordRealWaiver = radfordWaiver;
  }

  let exactRadfordScience = null;
  if (exactSource) {
    exactRadfordScience = radfordSciencePairRuntimeContext(
      template,
      associateDocument,
      { degreeCourseSet: planSet, unitsById, agreements },
    );
    if (exactRadfordScience.applicable && !exactRadfordScience.ready) {
      state.sourceBoundApplicationIssues.push({
        kind: 'radford_two_sciences_one_laboratory',
        reason: exactRadfordScience.reason,
      });
      return state;
    }
    if (exactRadfordScience.ready
        && (campusSystem !== 'semester' || collegeSystem !== 'semester')) {
      state.sourceBoundApplicationIssues.push({
        kind: 'radford_two_sciences_one_laboratory',
        reason: 'the exact Radford science-pair accounting is bound to semester-credit sources',
      });
      return state;
    }
  }

  if (exactSource) {
    const exactBridgewaterSelection = exactBridgewaterApplicationSelection(template, ctx, state);
    if (exactBridgewaterSelection) return exactBridgewaterSelection.state;
  }

  const exactOduPairSet = exactSource ? oduTechnicalSciencePairs(template) : null;
  const exactNsuPairSet = exactSource ? norfolkStateSciencePairs(template) : null;
  const exactLongwoodSelection = longwoodFigureSelection(template);
  for (const [groupIndex, group] of (template.requirement_groups || []).entries()) {
    // A completed member of the exact nineteen-document A.S. cohort fulfills
    // Shenandoah's university GE domains.  The reviewed CS tree publishes no
    // separate academic-unit core, so split the exact 65-credit remainder as
    // 30 GE-domain credits plus 35 unrestricted credits.  Treating all 65 as
    // generic GE would inflate Figure 3; treating all 65 as electives would
    // erase the source-authored credential waiver.
    if (state.sourceBoundShenandoahAs?.ready
        && groupIndex === SHENANDOAH_CAPACITY_GROUP_INDEX) {
      state.geCampusUnits += SHENANDOAH_GENERAL_EDUCATION_DOMAIN_UNITS;
      state.lowerGeCampusUnits += SHENANDOAH_GENERAL_EDUCATION_DOMAIN_UNITS;
      state.electiveCampusUnits += SHENANDOAH_ELECTIVE_CAPACITY_UNITS;
      state.lowerElectiveCampusUnits += SHENANDOAH_ELECTIVE_CAPACITY_UNITS;
      continue;
    }
    // Radford's open B.S. science carrier is a 6-8 credit range, not generic
    // GE. Commit the exact two-course sending/receiving pair as eight named
    // credits; no broad science label or four-credit heuristic participates.
    if (exactRadfordScience?.ready && groupIndex === RADFORD_SCIENCE_GROUP_INDEX) {
      const application = applyRadfordSciencePair(state, exactRadfordScience, planSet);
      if (!application.applied) {
        state.sourceBoundApplicationIssues.push({
          kind: 'radford_two_sciences_one_laboratory', reason: application.reason,
        });
        return state;
      }
      continue;
    }
    // Selecting the exact eight-credit science route rather than the six-
    // credit floor consumes two credits of the source-authored 35-credit open
    // capacity. Preserve the 120-credit degree equation as 8 + 33, not 8 + 35.
    if (exactRadfordScience?.ready
        && groupIndex === RADFORD_FREE_ELECTIVE_GROUP_INDEX) {
      state.electiveCampusUnits += exactRadfordScience.remaining_free_elective_units;
      state.lowerElectiveCampusUnits += exactRadfordScience.remaining_free_elective_units;
      continue;
    }
    // The Virginia Tech honors footnote changes two sections and four credits
    // of the separate free-elective Or block as one atomic degree route. Walk
    // the surrounding Degree Core sections normally, then commit those two
    // slots jointly so MATH 2406H can never be mixed with an ordinary route.
    if (exactVirginiaTechApplication && groupIndex === 0) {
      for (const [sectionIndex, section] of (group.sections || []).entries()) {
        if (exactVirginiaTechCscPair?.ready
            && groupIndex === VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX
            && sectionIndex === VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX) {
          state.directAppliedUnits += VIRGINIA_TECH_CSC_PAIR_NAMED_APPLICATION_UNITS;
          state.lowerDirectAppliedUnits += VIRGINIA_TECH_CSC_PAIR_NAMED_APPLICATION_UNITS;
          for (const id of exactVirginiaTechCscPair.required_ids) {
            state.directIds.add(id);
            state.lowerDirectIds.add(id);
          }
          const rawSendingUnits = exactVirginiaTechCscPair.required_ids.reduce(
            (sum, id) => sum + (Number(unitsById.get(id)) || 0), 0,
          );
          state.sourceBoundUnappliedUnits += Math.max(
            0, rawSendingUnits - VIRGINIA_TECH_CSC_PAIR_NAMED_APPLICATION_UNITS,
          );
          state.sourceBoundVirginiaTechCscPair = exactVirginiaTechCscPair.receipt;
          continue;
        }
        if (sectionIndex === 5) {
          const math = exactVirginiaTechMathApplication(template, ctx, state);
          if (!math.ready) {
            state.sourceBoundApplicationIssues.push({
              kind: 'virginia_tech_math_route', reason: math.reason,
            });
            return state;
          }
          exactVirginiaTechApplication.math = math;
          commitVirginiaTechMathApplication(state, math);
          continue;
        }
        if (sectionIndex === 6) continue;
        evaluateSection(section, group, ctx, state);
      }
      continue;
    }
    // Every ordinary statistics path totals ten credits; the exact
    // transfer-optimizing path leaves eight credits of free capacity. The
    // honors pair consumes four of those credits, leaving four. Statistics
    // itself remains resident work and is never relabeled as transferable.
    if (exactVirginiaTechApplication && groupIndex === 10) {
      const honors = exactVirginiaTechApplication.math?.selection?.math_route
        === 'honors_pair';
      state.electiveCampusUnits += honors
        ? exactVirginiaTechApplication.freeCapacity.honorsRemaining
        : exactVirginiaTechApplication.freeCapacity.maximum;
      continue;
    }
    // CMSC 210 satisfies this zero-increment proficiency overlay inside the
    // exact 12-credit elective selection.  It is not a second place to spend
    // an associate course or add bachelor units.
    if (exactLongwoodSelection?.ready
        && `${groupIndex}:0` === exactLongwoodSelection.proficiency_overlay_section_key) {
      continue;
    }
    // NSU repeats the same three science series in two authored slots, but the
    // same series cannot earn credit twice. Commit the best disjoint pair as
    // one transaction after earlier requirements have spent their courses.
    if (exactNsuPairSet?.ready && groupIndex === 1) {
      const exactNsuSelection = exactNorfolkStateApplicationSelection(
        template, ctx, state,
      );
      if (exactNsuSelection) state = exactNsuSelection.state;
      continue;
    }
    // ODU's technical elective and science sequence are one joint choice:
    // neither course set may be spent before every intervening requirement is
    // known. Defer the technical slot, then atomically commit the best exact
    // disjoint pair at the science group's authored position. This also makes
    // sending-course reuse against earlier requirements part of the score.
    if (exactOduPairSet?.ready && groupIndex === 3) continue;
    if (exactOduPairSet?.ready && groupIndex === 10) {
      const exactOduSelection = exactOduApplicationSelection(template, ctx, state);
      if (exactOduSelection) state = exactOduSelection.state;
      continue;
    }
    const sections = (group.sections || []).map((section, sectionIndex) => (
      exactLongwoodSelection?.ready
        ? (exactLongwoodSelection.virtual_sections?.[`${groupIndex}:${sectionIndex}`]
          || section)
        : section
    ));
    const isOr = String(group.group_conjunction || '').toLowerCase() === 'or' && sections.length > 1;
    if (!isOr) {
      for (const section of sections) evaluateSection(
        section,
        group,
        ctx,
        state,
        { forceUniversityOnly: exactLongwoodSelection?.ready && [11, 12].includes(groupIndex) },
      );
      continue;
    }
    const longwoodSectionIndex = exactLongwoodSelection?.ready
      ? exactLongwoodSelection.group_section_indices[groupIndex] : null;
    const canonicalSectionIndex = Number.isInteger(longwoodSectionIndex)
      ? longwoodSectionIndex
      : (exactSource && Number.isInteger(group.canonical_section_index)
        ? group.canonical_section_index : null);
    if (Number.isInteger(canonicalSectionIndex)
        && sections[canonicalSectionIndex]) {
      evaluateSection(sections[canonicalSectionIndex], group, ctx, state);
      continue;
    }
    // A choice is one requirement. A student completes exactly one path, so
    // only one alternative may earn capacity or demand — crediting each
    // articulated alternative would satisfy the same requirement several
    // times over. Follow the path this college does best by, the same rule
    // the coverage ledger uses; ties keep the authored order. Note the
    // denominator prices the cheapest reachable path instead: a student whose
    // college articulates only the longer sequence genuinely brings more
    // units than the cheapest path asks, and the aggregate clamps keep
    // fulfilled within required.
    let best = null;
    for (const section of sections) {
      const candidate = cloneEvaluationState(state);
      evaluateSection(section, group, ctx, candidate);
      const gain = campusGain(candidate, state, collegeSystem, campusSystem);
      if (!best || gain > best.gain + EPSILON) best = { state: candidate, gain };
    }
    if (best) state = best.state;
  }

  return state;
}

function applyAssociateUnits({
  asTotal, directApplied, geUnits, geDemand, electiveDemand,
  sourceBoundElectiveApplied = 0,
  knownIneligibleUnits = 0,
  transferCapUnits = null,
}) {
  const allocate = (ceiling) => {
    const direct = Math.min(ceiling, directApplied);
    let remaining = Math.max(0, ceiling - direct);
    // A Virginia Tech honors articulation may carry up to two sending credits
    // per half into the four-credit free-elective displacement. Those credits
    // are bound to the selected atomic route, so reserve them before generic
    // GE/elective allocation and never let the same AS units be spent twice.
    const sourceBoundElectiveCounted = Math.min(
      sourceBoundElectiveApplied, remaining,
    );
    remaining -= sourceBoundElectiveCounted;
    const geCounted = Math.min(geUnits, geDemand, remaining);
    remaining -= geCounted;
    const generalElectiveCounted = Math.min(electiveDemand, remaining);
    const electiveCounted = sourceBoundElectiveCounted + generalElectiveCounted;
    return {
      direct,
      geCounted,
      electiveCounted,
      sourceBoundElectiveCounted,
      generalElectiveCounted,
      applied: Math.min(ceiling, direct + geCounted + electiveCounted),
    };
  };
  const uncappedCeiling = Math.max(0, asTotal - knownIneligibleUnits);
  const uncapped = allocate(uncappedCeiling);
  const numericCap = transferCapUnits == null ? null : Number(transferCapUnits);
  const ceiling = Number.isFinite(numericCap) && numericCap >= 0
    ? Math.min(uncappedCeiling, numericCap) : uncappedCeiling;
  const applied = allocate(ceiling);
  return {
    ...applied,
    transferCapUnits: numericCap,
    transferCapBinding: applied.applied + EPSILON < uncapped.applied,
    uncappedApplied: uncapped.applied,
  };
}

function applyUvaWiseGaaDegreeMinimum(application, waiver, asTotal) {
  if (!waiver?.ready) return application;
  const target = Math.min(
    Math.max(0, Number(asTotal) || 0),
    Number(waiver.minimum_units_applied_to_degree) || 0,
  );
  const increment = Math.max(0, target - application.applied);
  return {
    ...application,
    electiveCounted: application.electiveCounted + increment,
    generalElectiveCounted: application.generalElectiveCounted + increment,
    applied: application.applied + increment,
    uncappedApplied: Math.max(application.uncappedApplied, application.applied + increment),
    uvaWiseGaaMinimumAppliedUnits: target,
    uvaWiseGaaPolicyIncrementUnits: increment,
  };
}

function sourceBoundTransferCapUnits({
  transferCapUnits,
  receivingCreditBonusCampusUnits,
  campusSystem,
  collegeSystem,
}) {
  if (transferCapUnits == null) return null;
  const numericCap = Number(transferCapUnits);
  if (!Number.isFinite(numericCap) || numericCap < 0) return null;
  return Math.max(
    0,
    numericCap - campusUnitsToCollege(
      Math.max(0, Number(receivingCreditBonusCampusUnits) || 0),
      campusSystem,
      collegeSystem,
    ),
  );
}

function knownIneligibleUnits(planIds, directlyAppliedIds, transferabilityById, unitsById) {
  return unitsForIds(
    planIds.filter((id) => (
      transferabilityById.get(id) === false && !directlyAppliedIds.has(id)
    )),
    unitsById,
  );
}

function completionMetric(
  appliedCollegeUnits,
  requiredCampusUnits,
  collegeSystem,
  campusSystem,
  sourceBoundReceivingCreditBonusCampusUnits = 0,
) {
  const required = Number(requiredCampusUnits) || 0;
  if (required <= 0) return { fulfilled: null, pct: null };
  const fulfilled = Math.min(
    required,
    collegeUnitsToCampus(appliedCollegeUnits, collegeSystem, campusSystem)
      + sourceBoundReceivingCreditBonusCampusUnits,
  );
  return { fulfilled: round1(fulfilled), pct: round1((100 * fulfilled) / required) };
}

function nullMetrics(row, status, warning, namedUnits = null) {
  return {
    ...row,
    rate: null,
    as_unit_utilization_pct: null,
    paper_equivalent_as_unit_utilization_pct: null,
    full_degree_completion_pct: null,
    full_degree_fulfilled_units: null,
    lower_division_completion_pct: null,
    lower_division_fulfilled_units: null,
    prescribed_units: null,
    transferred_units: null,
    paper_equivalent_transferred_units: null,
    named_units: namedUnits,
    named_transferred_units: null,
    elective_counted_units: null,
    ...(String(row?.record_id || '').startsWith('as_degree:') ? {
      source_bound_uva_wise_gaa_minimum_applied_units: null,
      source_bound_uva_wise_gaa_policy_increment_units: null,
      source_bound_uva_wise_gaa_evidence_sha256: null,
      source_bound_uva_wise_gaa_scenario: null,
      source_bound_uva_wise_gaa_success_conditions_required: null,
    } : {}),
    known_nontransferable_units: null,
    extra_units: null,
    extra_units_semester: null,
    modeled_pathway_units_semester: null,
    modeled_hours_above_120: null,
    modeled_hours_above_120_unrounded: null,
    extra_cost_usd: null,
    extra_cost_standard_load_usd: null,
    modeled_cost_above_120_usd: null,
    modeled_cost_above_120_standard_load_usd: null,
    tuition_annual_resident_usd: null,
    tuition_source: null,
    tuition_source_url: null,
    tuition_price_year: null,
    method_status: status,
    method_warning: warning,
  };
}

/**
 * Pure, pre-publication review of the fixed Virginia Figure 3/4 matrix.
 *
 * The helper consumes an in-memory `buildProjection()` result, never Mongo.
 * It uses the same exact A.S. candidate set, source-specific course units, and
 * per-program agreement selection as runtime, so build/release gates can stop
 * unresolved selected-edge semantics before any projection write.
 */
// Total order over the Figure 3/4 matrix: one cell is exactly one
// (college, campus) pair, so this never ties.
function conditionCellOrder(left, right) {
  return (Number(left.community_college_id) - Number(right.community_college_id))
    || (Number(left.school_id) - Number(right.school_id));
}

function auditVirginiaProjectionEquivalencyConditions(projection, {
  expectedAssociateDegrees = 19,
  expectedBachelorDegrees = 16,
  expectedCells = 304,
} = {}) {
  const asDegrees = (projection?.asDegrees || []).filter((row) => (
    row?.kind === 'as_degree' && row?.state === 'va'
  ));
  const bachelorDegrees = (projection?.degrees || []).filter((row) => (
    row?.kind === 'degree' && row?.state === 'va'
  ));
  const agreements = projection?.agreements || [];
  const agreementsByPair = new Map();
  for (const agreement of agreements) {
    const key = `${Number(agreement?.uc_school_id)}:${Number(agreement?.community_college_id)}`;
    if (!agreementsByPair.has(key)) agreementsByPair.set(key, []);
    agreementsByPair.get(key).push(agreement);
  }
  const sendingRows = (projection?.courses || []).filter((row) => row?.side === 'sending');
  const defaultUnits = new Map(sendingRows.map((row) => [
    Number(row.course_id), Number(row.units) || 0,
  ]));
  const sendingById = new Map(sendingRows.map((row) => [Number(row.course_id), row]));
  const cells = [];
  for (const associate of asDegrees) {
    const sections = associateNamedSections(associate, { paperFigure: '3_4' });
    const degreeCourseSet = candidateCourseSet(sections);
    const radfordCarrier = radfordAssociateSciencePairCarrier(associate);
    const radfordDegreeCourseSet = new Set(degreeCourseSet);
    if (radfordCarrier.ready) {
      for (const id of radfordCarrier.route_ids) radfordDegreeCourseSet.add(id);
    }
    const unitsById = sourceSpecificUnitsById(defaultUnits, sendingById, associate);
    for (const bachelor of bachelorDegrees) {
      const pair = agreementsByPair.get(
        `${Number(bachelor.school_id)}:${Number(associate.community_college_id)}`,
      ) || [];
      const matched = agreementsForTemplate(pair, bachelor);
      const audit = auditVirginiaSourceEquivalencyConditions(matched.agreements, {
        degreeCourseSet,
        bachelorDocument: bachelor,
        associateDocument: associate,
        unitsById,
        figureModel: 'complete_degree_path',
        requireVirginiaChannels: true,
      });
      const radfordScience = radfordSciencePairRuntimeContext(
        bachelor,
        associate,
        {
          degreeCourseSet: radfordDegreeCourseSet,
          unitsById,
          agreements: matched.agreements,
        },
      );
      const radfordPairReady = !radfordScience.applicable || radfordScience.ready;
      const uvaWiseGaa = uvaWiseVccsGaaWaiver(bachelor, associate, {
        scenario: 'successful_gaa_participant',
      });
      const uvaWiseGaaReady = !uvaWiseGaa.applicable || uvaWiseGaa.ready;
      const shenandoahPair = shenandoahFigure34PairProof(bachelor, associate);
      const shenandoahPairReady = !shenandoahPair.applicable || shenandoahPair.ready;
      let atomicRouteReady = true;
      const blockingConditions = [...audit.blocking_conditions];
      if (radfordScience.applicable && !radfordScience.ready) {
        blockingConditions.push({
          agreement_id: matched.agreements.length === 1
            ? String(matched.agreements[0]._id) : null,
          condition_kind: 'radford_two_sciences_one_laboratory',
          reason: radfordScience.reason,
        });
      }
      if (shenandoahPair.applicable && !shenandoahPair.ready) {
        blockingConditions.push({
          agreement_id: matched.agreements.length === 1
            ? String(matched.agreements[0]._id) : null,
          condition_kind: 'shenandoah_as_general_education_domain_policy',
          reason: shenandoahPair.reason,
        });
      }
      const sourceBoundRequiredAnyIdSets = [
        ...audit.source_bound_required_any_id_sets,
        ...(radfordScience.ready
          ? radfordScience.source_bound_required_any_id_sets : []),
      ];
      const sourceBoundForbiddenCourseIds = [
        ...(audit.source_bound_forbidden_course_ids || []),
      ];
      if (sourceBoundRequiredAnyIdSets.length || sourceBoundForbiddenCourseIds.length) {
        const sourceBoundDegreeCourseSet = radfordScience.ready
          ? radfordDegreeCourseSet : degreeCourseSet;
        const directlyEligible = broadlyEligibleCourseIds(
          bachelor,
          matched.agreements,
          sourceBoundDegreeCourseSet,
        );
        const generallyTransferable = new Set([...sourceBoundDegreeCourseSet].filter((id) => (
          sendingById.get(Number(id))?.uc_transferable !== false
        )));
        const aggregateUnits = geBlocks(associate)
          .reduce((sum, block) => sum + block.units, 0)
          - (radfordScience.ready ? radfordCarrier.aggregate_units_replaced : 0);
        const sourceBoundSections = radfordScience.ready
          ? [...sections, ...radfordCarrier.runtime_sections] : sections;
        const totalUnits = Number(associate.total_units) || 60;
        const plan = planAssociateDegree(
          sourceBoundSections,
          directlyEligible,
          generallyTransferable,
          unitsById,
          {
            strictConstraints: true,
            paperFigure: '3_4',
            sourceDocument: associate,
            totalUnits,
            totalUnitsMax: finiteNumber(associate.total_units_max) ?? totalUnits,
            aggregateUnits,
            hasUnitsFill: (associate.requirement_groups || [])
              .some((group) => group.units_fill === true),
            sourceBoundRequiredAnyIdSets,
            sourceBoundForbiddenCourseIds,
          },
        );
        const forbiddenSelected = plan.ids.some((id) => (
          sourceBoundForbiddenCourseIds.includes(Number(id))
        ));
        atomicRouteReady = plan.complete && !forbiddenSelected;
        if (!atomicRouteReady) {
          blockingConditions.push({
            agreement_id: matched.agreements.length === 1
              ? String(matched.agreements[0]._id) : null,
            condition_kind: sourceBoundForbiddenCourseIds.length
              ? 'compound_sending_requirement_edge_unavoidable'
              : 'compound_sending_requirement_unselectable',
            sending_course_ids: sourceBoundForbiddenCourseIds.length
              ? sourceBoundForbiddenCourseIds : sourceBoundRequiredAnyIdSets[0],
            reason: sourceBoundForbiddenCourseIds.length
              ? 'the associate Figure 3/4 Boolean tree cannot complete while excluding the exact lone-half source edge'
              : 'the associate Figure 3/4 Boolean tree cannot select both source courses in one complete degree plan',
          });
        }
      }
      cells.push({
        community_college_id: Number(associate.community_college_id),
        college_name: associate.college_name,
        school_id: Number(bachelor.school_id),
        school: bachelor.school,
        associate_source_id: associate.va_requirement_id || associate._id,
        bachelor_source_id: bachelor.va_requirement_id || bachelor._id,
        agreement_ids: matched.agreements.map((agreement) => String(agreement._id)),
        ready: audit.ready && atomicRouteReady && radfordPairReady
          && uvaWiseGaaReady && shenandoahPairReady,
        invalid_channels: audit.invalid_channels,
        blocking_conditions: blockingConditions,
        advisory_conditions: audit.advisory_conditions,
      });
    }
  }
  const activeAgreementIds = new Set(cells.flatMap((cell) => cell.agreement_ids));
  const selectedRows = agreements
    .filter((agreement) => activeAgreementIds.has(String(agreement._id)))
    .flatMap((agreement) => agreement.selected_equivalencies || []);
  const genericRows = selectedRows.filter((row) => parentIdForLanding({
    identifier: row.source_receiving_identifier,
    name: row.source_receiving_name,
  }) == null);
  const blocked = cells.filter((cell) => !cell.ready);
  const cohortReady = asDegrees.length === expectedAssociateDegrees
    && bachelorDegrees.length === expectedBachelorDegrees
    && cells.length === expectedCells;
  return {
    ready: cohortReady && blocked.length === 0,
    blocker: !cohortReady
      ? 'virginia_equivalency_condition_cohort_mismatch'
      : (blocked.length ? 'unresolved_selected_equivalency_conditions' : null),
    expected: {
      associate_degrees: expectedAssociateDegrees,
      bachelor_degrees: expectedBachelorDegrees,
      cells: expectedCells,
    },
    counts: {
      associate_degrees: asDegrees.length,
      bachelor_degrees: bachelorDegrees.length,
      cells: cells.length,
      ready_cells: cells.length - blocked.length,
      blocked_cells: blocked.length,
      invalid_channel_cells: blocked.filter((cell) => cell.invalid_channels.length).length,
      blocking_condition_observations: cells.reduce(
        (sum, cell) => sum + cell.blocking_conditions.length,
        0,
      ),
      advisory_condition_observations: cells.reduce(
        (sum, cell) => sum + cell.advisory_conditions.length,
        0,
      ),
      selected_edges: selectedRows.length,
      selected_concrete_edges: selectedRows.length - genericRows.length,
      selected_generic_edges: genericRows.length,
      selected_noted_edges: selectedRows.filter((row) => row.source_receiving_notes != null).length,
      selected_noted_generic_edges: genericRows
        .filter((row) => row.source_receiving_notes != null).length,
    },
    // Sorted, not input-ordered. This report is hashed into the publication
    // receipt and re-derived at read time from a differently-ordered document
    // read; leaving cell order to the caller made the two disagree whenever any
    // cell was blocked. With every cell ready the arrays are empty and the
    // ordering never showed.
    blocked_cells: [...blocked].sort(conditionCellOrder),
    resolved_condition_cells: cells
      .filter((cell) => cell.advisory_conditions.length)
      .sort(conditionCellOrder),
  };
}

async function transferCreditRateData(db, _auditDb, {
  degreeType = 'local_as', majorSlug = null, majorPrograms = null,
  verifiedOnly = false, assumeDegreeTemplatesValid = false,
} = {}) {
  const type = DEGREE_TYPES.includes(degreeType) ? degreeType : 'local_as';
  const slug = String(majorSlug || '').trim();
  const configuredMajor = slug ? getMajor(slug) : null;
  const exactPrograms = majorPrograms || configuredMajor?.programs || null;
  const legacySlug = defaultMajor().slug;
  // The shared scoping rule: rows stamped with the slug always match, and
  // unstamped legacy rows belong to the default major alone. A bare top-level
  // equality here silently dropped the legacy branch — an equality on
  // `major_slug` can never match a document missing the field.
  const scope = majorDocumentClause(slug || legacySlug);
  const degreeQuery = {
    kind: 'as_degree', degree_type: type, status: 'found',
    ...scope,
    ...(verifiedOnly ? { 'verification.verified': true } : {}),
  };
  const templateQuery = { kind: 'degree', ...scope };
  const [degrees, templates, institutions, universities] = await Promise.all([
    db.collection('curated_requirements')
      .find(degreeQuery).toArray(),
    db.collection('curated_requirements').find(templateQuery).toArray(),
    db.collection('assist_institutions')
      .find({ kind: 'community_college', ...stateClause(configuredMajor?.state) },
        { projection: { name: 1, source_id: 1 } }).toArray(),
    db.collection('assist_institutions').find({ kind: 'university', ...stateClause(configuredMajor?.state) }, {
      projection: {
        source_id: 1, academic_calendar: 1, tuition_annual_resident_usd: 1,
        tuition_per_credit_usd: 1, tuition_per_credit_standard_load_usd: 1,
        tuition_source: 1, tuition_source_url: 1, tuition_price_year: 1,
        tuition_basis: 1,
      },
    }).toArray(),
  ]);

  // Cost of the pathway hours, following the MA paper's Figure 5 arithmetic: a
  // flat campus charge needs an explicit load denominator before it can be
  // expressed per unit. The importer re-expresses the paper workbook's own
  // campus-constant rates on this annual/24 convention; California campus rows
  // carry their annual resident charge directly.
  //
  // Extra units are carried here in SEMESTER-equivalent terms, and the calendar
  // cancels out: for a quarter campus, (extra x 1.5) x (annual / 36) is exactly
  // extra x (annual / 24). So one semester-equivalent rate is correct for both
  // calendars and is identical to native-units x native-rate.
  const tuitionBySchool = new Map(universities
    .filter((row) => row.tuition_annual_resident_usd != null)
    .map((row) => [Number(row.source_id), {
      annual: Number(row.tuition_annual_resident_usd),
      perSemesterUnit: Number(row.tuition_annual_resident_usd) / 24,
      perSemesterUnitStandardLoad: Number(row.tuition_annual_resident_usd) / 30,
      // Canonical CA rows keep the complete citation in `tuition_basis`, while
      // imported paper rows use the older flat fields. Read both shapes so a
      // sourced rate is never mislabeled as unprovenanced by Figure 5.
      source: row.tuition_source || row.tuition_basis?.source || null,
      sourceUrl: row.tuition_source_url || row.tuition_basis?.source_url || null,
      priceYear: row.tuition_price_year || row.tuition_basis?.year || null,
    }]));

  const scopedTemplates = exactPrograms
    ? templates.filter((template) => {
      const pins = programPairs(exactPrograms)
        .filter((pair) => pair.school_id === Number(template.school_id));
      if (template.major_slug) {
        return template.major_slug === slug
          && pins.some((pair) => pair.major === String(template.program));
      }
      if (slug !== legacySlug) return false;
      return pins.some((pair) => normalizeMajor(pair.major) === normalizeMajor(template.program));
    })
    : templates;

  const campuses = scopedTemplates
    .map((template) => {
      const budget = computeUnitBudget(template.requirement_groups, { sourceDocument: template });
      return {
        template,
        school_id: Number(template.school_id),
        school: template.school,
        unitSystem: unitSystemOfTemplate(template),
        // The full-degree denominator is the campus's stated graduation
        // minimum, the same fixed measure the coverage heatmap divides by. The
        // modeled sum is only a fallback: it moves with modelling completeness,
        // so a thinly modelled degree read as more complete, and before the
        // Or-collapse Berkeley MCB's summed alternatives (392 modeled against
        // 120 stated) held the whole column near 11%.
        fullRequiredUnits: Number(template.total_units) || budget.modeled_units,
        lowerRequiredUnits: budget.per_tier.transferable + budget.per_tier.breadth,
      };
    })
    .sort((a, b) => String(a.school).localeCompare(String(b.school)));

  const collegeIds = [...new Set(degrees.map((degree) => Number(degree.community_college_id)))];
  const agreements = collegeIds.length && campuses.length
    ? await db.collection('assist_agreements').find(
      {
        uc_school_id: { $in: campuses.map((campus) => campus.school_id) },
        community_college_id: { $in: collegeIds },
        ...(exactPrograms ? programPairClause(exactPrograms) : {}),
      },
      { projection: {
        university_id: 1,
        college_id: 1,
        uc_school_id: 1,
        community_college_id: 1,
        university_name: 1,
        college_name: 1,
        major: 1,
        state: 1,
        source: 1,
        pairing: 1,
        derived_from: 1,
        articulated_receivers: 1,
        considered_receivers: 1,
        source_equivalencies_contract: 1,
        source_equivalencies_count: 1,
        source_equivalencies_sha256: 1,
        source_equivalencies: 1,
        selected_equivalencies_contract: 1,
        selected_equivalencies_count: 1,
        selected_equivalencies_sha256: 1,
        selected_equivalencies: 1,
        requirement_groups: 1,
      } }
    ).toArray()
    : [];
  const agreementsByPair = new Map();
  for (const agreement of agreements) {
    // A booleans-only agreement records requirement-level verdicts with no
    // course mappings (Massachusetts pairs outside the paper's 50-mile
    // study). Credit accounting cannot run on it; the cell stays blank the
    // way the paper left the pair unstudied.
    if (agreement.pairing === 'booleans-only') continue;
    const key = `${agreement.uc_school_id}:${agreement.community_college_id}`;
    if (!agreementsByPair.has(key)) agreementsByPair.set(key, []);
    agreementsByPair.get(key).push(agreement);
  }

  const parsedDegrees = degrees.map((doc) => {
    const sections = associateNamedSections(doc, { paperFigure: '3_4' });
    const sourceId = doc?.va_requirement_id ?? doc?._id ?? null;
    const newRiverVirginiaTechCarrier = sourceId === ASSOCIATE_COLLEGES.newRiver.sourceId
      ? newRiverVirginiaTechFigure34Carrier(doc) : null;
    const radfordCarrier = radfordAssociateSciencePairCarrier(doc);
    const courseSet = candidateCourseSet(sections);
    if (newRiverVirginiaTechCarrier?.ready) {
      for (const id of newRiverVirginiaTechCarrier.route_ids) courseSet.add(id);
    }
    return {
      doc,
      sections,
      courseSet,
      newRiverVirginiaTechCarrier,
      radfordCarrier,
      ge: geBlocks(doc),
      enumeratedGeUnits: virginiaEnumeratedGeUnits(doc, {
        exactSource: usesCanonicalSourceContract(doc),
      }),
      unresolved: unresolvedCount(doc),
      modelingWarningCount: Array.isArray(doc.extraction?.modeling_warnings)
        ? doc.extraction.modeling_warnings.length
        : 0,
    };
  });
  const allCourseIds = [...new Set(parsedDegrees.flatMap(({ courseSet, radfordCarrier }) => [
    ...courseSet,
    ...(radfordCarrier?.ready ? radfordCarrier.route_ids : []),
  ]))];
  const unitsById = new Map();
  const sendingCourseById = new Map();
  const transferabilityById = new Map();
  if (allCourseIds.length) {
    const courses = await db.collection('assist_courses').find(
      { side: 'sending', course_id: { $in: allCourseIds } },
      { projection: {
        course_id: 1,
        units: 1,
        units_by_source_requirement: 1,
        uc_transferable: 1,
        _id: 0,
      } }
    ).toArray();
    for (const course of courses) {
      const courseId = Number(course.course_id);
      unitsById.set(courseId, Number(course.units) || 0);
      sendingCourseById.set(courseId, course);
      if (typeof course.uc_transferable === 'boolean') {
        transferabilityById.set(courseId, course.uc_transferable);
      }
    }
  }
  // Unknown transferability remains part of the documented optimistic
  // assumption, but an explicitly false course must lose to a known/assumed
  // transferable alternative when neither option articulates directly.
  const generallyTransferable = new Set(
    allCourseIds.filter((courseId) => transferabilityById.get(courseId) !== false),
  );

  const nameById = new Map(institutions.map((institution) => [Number(institution.source_id), institution.name]));
  const rows = [];
  for (const {
    doc, sections, courseSet, newRiverVirginiaTechCarrier, radfordCarrier,
    ge, enumeratedGeUnits, unresolved, modelingWarningCount,
  } of parsedDegrees) {
    const collegeId = Number(doc.community_college_id);
    const collegeSystem = doc.unit_system === 'quarter' ? 'quarter' : 'semester';
    const asTotal = Number(doc.total_units)
      || fromSemesterUnits(60, collegeSystem);
    const geUnits = ge.reduce((total, block) => total + block.units, 0);
    const geVerifiedUnits = ge.reduce((total, block) => total + (block.verified ? block.units : 0), 0);

    for (const campus of campuses) {
      const canonicalSourceRequired = configuredMajor?.capabilities
        ?.canonicalSourceRequirements === true;
      const exactSource = usesCanonicalSourceContract(doc)
        && usesCanonicalSourceContract(campus.template);
      const bachelorRequirementRoleIssues = usesCanonicalSourceContract(campus.template)
        ? canonicalRequirementRoleIssues(campus.template) : [];
      const associateFigureReadiness = canonicalSourceRequired
        ? readinessForProjectedFigures(doc, {
          label: 'The associate-degree source',
          figures: ['3', '4'],
        })
        : null;
      const baseBachelorFigureReadiness = canonicalSourceRequired
        ? readinessForProjectedFigures(campus.template, {
          label: 'The bachelor-degree source',
          figures: ['3', '4'],
        })
        : null;
      const shenandoahPair = exactSource
        ? shenandoahFigure34PairProof(campus.template, doc)
        : { applicable: false, ready: false };
      const bachelorFigureReadiness = canonicalSourceRequired
        ? shenandoahFigure34Readiness(
          campus.template,
          baseBachelorFigureReadiness,
          shenandoahPair,
        ) : baseBachelorFigureReadiness;
      const residencyTransferPolicy = exactSource
        ? evaluateVirginiaResidencyTransferPolicy(campus.template) : null;
      const effectiveTwoYearCapCollegeUnits = residencyTransferPolicy?.supported === true
          && residencyTransferPolicy.effective_two_year_transfer_cap_units != null
        ? campusUnitsToCollege(
          residencyTransferPolicy.effective_two_year_transfer_cap_units,
          campus.unitSystem,
          collegeSystem,
        )
        : null;
      const associateSourceConflictCount = canonicalSourceRequired
        ? unresolvedSourceConflictCount(doc, {
          associate: true,
          figures: ['3', '4'],
        }) : 0;
      const bachelorSourceConflictCount = canonicalSourceRequired
        ? unresolvedSourceConflictCount(campus.template, {
          associate: false,
          figures: ['3', '4'],
        }) : 0;
      const cellUnitsById = exactSource
        ? sourceSpecificUnitsById(unitsById, sendingCourseById, doc)
        : unitsById;
      const pair = agreementsByPair.get(`${campus.school_id}:${collegeId}`) || [];
      const matched = agreementsForTemplate(pair, campus.template);
      const equivalencyConditions = exactSource
        ? auditVirginiaSourceEquivalencyConditions(matched.agreements, {
          degreeCourseSet: courseSet,
          bachelorDocument: campus.template,
          associateDocument: doc,
          unitsById: cellUnitsById,
          figureModel: 'complete_degree_path',
          requireVirginiaChannels: true,
        })
        : {
          applicable: false,
          ready: true,
          invalid_channels: [],
          blocking_conditions: [],
          advisory_conditions: [],
          source_bound_required_any_id_sets: [],
          source_bound_applications: [],
          source_bound_forbidden_course_ids: [],
          warning: null,
        };
      const eligible = broadlyEligibleCourseIds(
        campus.template,
        matched.agreements,
        courseSet,
      );
      const radfordCourseSet = new Set(courseSet);
      if (campus.school_id === 9219 && radfordCarrier?.ready) {
        for (const id of radfordCarrier.route_ids) radfordCourseSet.add(id);
      }
      const radfordScience = exactSource ? radfordSciencePairRuntimeContext(
        campus.template,
        doc,
        {
          degreeCourseSet: radfordCourseSet,
          unitsById: cellUnitsById,
          agreements: matched.agreements,
        },
      ) : { applicable: false, ready: false };
      if (radfordScience.ready) {
        for (const id of radfordScience.pair_ids) eligible.add(id);
      }
      const newRiverVirginiaTechPair = exactSource
          && newRiverVirginiaTechCarrier?.ready === true
          && campus.school_id === 9230
        ? newRiverVirginiaTechFigure34PairProof({
          associateDocument: doc,
          bachelorDocument: campus.template,
          agreements: matched.agreements,
          directlyEligible: eligible,
          unitsById: cellUnitsById,
        })
        : { handled: false, ready: false, supported: false };
      const newRiverVirginiaTechCapability = newRiverVirginiaTechPair.ready === true;
      const pairAssociateFigureReadiness = canonicalSourceRequired
        ? newRiverVirginiaTechFigure34Readiness(
          doc,
          associateFigureReadiness,
          newRiverVirginiaTechPair,
        ) : associateFigureReadiness;
      const pairResolvedConflictCount = canonicalSourceRequired
        ? Number(pairAssociateFigureReadiness?.source_pair_resolved_constraint_count || 0)
        : 0;
      const pairUnresolvedConflictCount = Math.max(
        0,
        associateSourceConflictCount - pairResolvedConflictCount,
      );
      const newRiverVirginiaTechReady =
        pairAssociateFigureReadiness?.source_pair_figure_ready === true;
      const receiverBoundSections = newRiverVirginiaTechCapability
        ? [...sections, newRiverVirginiaTechCarrier.runtime_section] : sections;
      const pairSections = radfordScience.ready
        ? [...receiverBoundSections, ...radfordCarrier.runtime_sections]
        : receiverBoundSections;
      const receiverBoundGeUnits = newRiverVirginiaTechCapability
        ? geUnits - newRiverVirginiaTechCarrier.aggregate_units_replaced : geUnits;
      const pairGeUnits = radfordScience.ready
        ? receiverBoundGeUnits - radfordCarrier.aggregate_units_replaced
        : receiverBoundGeUnits;
      const templateVerified = campus.template.verification?.verified === true;
      const staleTemplateStatus = templateVerified
        && /needs[_\s-]+human[_\s-]+verification/i.test(
          String(campus.template.research_status || '')
        );
      const base = {
        community_college_id: collegeId,
        college_name: nameById.get(collegeId) || doc.college_name || `College ${collegeId}`,
        school_id: campus.school_id,
        school: campus.school,
        degree_type: type,
        ...(slug ? { major_slug: slug } : {}),
        record_id: doc._id,
        as_total_units: round1(asTotal),
        as_unit_system: collegeSystem,
        as_catalog_year: doc.catalog_year || null,
        degree_unit_system: campus.unitSystem,
        degree_catalog_year: campus.template.catalog_year || null,
        degree_research_status: campus.template.research_status || null,
        degree_template_verified: templateVerified,
        degree_template_verified_at: campus.template.verification?.verified_at || null,
        degree_template_verified_by_label:
          campus.template.verification?.verified_by_label || null,
        degree_template_source: campus.template.source || null,
        degree_template_source_url: campus.template.source_url || null,
        degree_template_status_conflict: staleTemplateStatus,
        full_degree_required_units: round1(campus.fullRequiredUnits),
        lower_division_required_units: round1(campus.lowerRequiredUnits),
        ge_units: round1(pairGeUnits),
        unresolved_count: unresolved,
        source_analysis_ready: doc.analysis_ready === true
          ? true
          : (doc.analysis_ready === false ? false : null),
        source_verified: doc.verification?.verified === true,
        degree_template_assumed_valid: !templateVerified && assumeDegreeTemplatesValid,
        source_modeling_warning_count: modelingWarningCount,
        ...(canonicalSourceRequired ? {
          degree_source_analysis_ready: campus.template.analysis_ready === true,
          // Retain the raw audit count. The pair evaluator resolves exactly
          // one path/kind-specific rule; it never erases unrelated conflicts.
          source_conflict_count: associateSourceConflictCount,
          source_pair_resolved_conflict_count: pairResolvedConflictCount,
          source_pair_unresolved_conflict_count: pairUnresolvedConflictCount,
          degree_source_conflict_count: bachelorSourceConflictCount,
          source_figures_ready: pairAssociateFigureReadiness.ready,
          source_requested_figures: pairAssociateFigureReadiness.figures,
          source_complete_degree_ready:
            pairAssociateFigureReadiness.complete_degree_ready,
          source_figure_constraint_blockers:
            pairAssociateFigureReadiness.figure_constraint_blockers,
          source_pair_figure_capability: newRiverVirginiaTechCapability,
          source_pair_figure_ready: newRiverVirginiaTechReady,
          source_pair_figure_capability_rule: newRiverVirginiaTechCapability
            ? NEW_RIVER_VIRGINIA_TECH_SOURCE_RULE : null,
          source_pair_figure_capability_proof: newRiverVirginiaTechCapability ? {
            agreement_id: newRiverVirginiaTechPair.proof.agreement_id,
            agreement_receipt_sha256:
              newRiverVirginiaTechPair.proof.agreement_receipt_sha256,
            source_proof_tree_sha256:
              newRiverVirginiaTechPair.proof.proof_tree_sha256,
            bachelor_proof_tree_sha256:
              newRiverVirginiaTechPair.proof.bachelor_proof_tree_sha256,
            route_codes: [...newRiverVirginiaTechPair.proof.route_codes],
            route_units: newRiverVirginiaTechPair.proof.route_units,
          } : null,
          degree_source_figures_ready: bachelorFigureReadiness.ready,
          degree_source_requested_figures: bachelorFigureReadiness.figures,
          degree_source_complete_degree_ready: bachelorFigureReadiness.complete_degree_ready,
          degree_source_figure_constraint_blockers:
            bachelorFigureReadiness.figure_constraint_blockers,
          degree_source_shenandoah_pair_applicable: shenandoahPair.applicable === true,
          degree_source_shenandoah_pair_capability:
            bachelorFigureReadiness.shenandoah_source_pair_figure_capability === true,
          degree_source_shenandoah_pair_ready: shenandoahPair.applicable === true
            ? bachelorFigureReadiness.shenandoah_source_pair_figure_ready === true : null,
          degree_source_shenandoah_pair_proof: shenandoahPair.ready === true
            ? shenandoahPair.proof : null,
          degree_source_requirement_role_issues: bachelorRequirementRoleIssues,
          source_equivalency_condition_status: equivalencyConditions.applicable
            ? (equivalencyConditions.ready ? 'resolved' : 'blocked') : 'not_applicable',
          source_equivalency_condition_blocker_count:
            equivalencyConditions.blocking_conditions.length,
          source_equivalency_condition_advisory_count:
            equivalencyConditions.advisory_conditions.length,
          source_equivalency_condition_invalid_channel_count:
            equivalencyConditions.invalid_channels.length,
          source_equivalency_condition_blockers:
            equivalencyConditions.blocking_conditions,
          source_equivalency_condition_advisories:
            equivalencyConditions.advisory_conditions,
          source_equivalency_condition_invalid_channels:
            equivalencyConditions.invalid_channels,
          degree_residency_transfer_policy_supported:
            residencyTransferPolicy?.supported === true,
          degree_overall_transfer_cap_units:
            residencyTransferPolicy?.overall_transfer_cap_units ?? null,
          degree_two_year_transfer_cap_units:
            residencyTransferPolicy?.two_year_transfer_cap_units ?? null,
          degree_effective_two_year_transfer_cap_units:
            residencyTransferPolicy?.effective_two_year_transfer_cap_units ?? null,
        } : {}),
      };

      const sourceWarnings = [];
      if (doc.analysis_ready === false && pairAssociateFigureReadiness?.ready !== true) {
        sourceWarnings.push(doc.verification?.verified === true
          ? 'The associate-degree source is human-verified but is not marked analysis-ready for this model.'
          : 'The associate-degree source is not marked analysis-ready and still requires human verification.');
      }
      if (!templateVerified && !assumeDegreeTemplatesValid
          && /needs[_\s-]+human[_\s-]+verification/i.test(String(campus.template.research_status || ''))) {
        sourceWarnings.push('The four-year graduation template still requires human verification.');
      }
      if (catalogCohortsDiffer(doc.catalog_year, campus.template.catalog_year)) {
        sourceWarnings.push(`Source cohorts differ: the associate degree is ${doc.catalog_year}, while the bachelor template is ${campus.template.catalog_year}.`);
      }
      if (unresolved > 0) {
        sourceWarnings.push(`${unresolved} catalog course citation${unresolved === 1 ? '' : 's'} remain unresolved in the associate-degree source.`);
      }
      if (modelingWarningCount > 0) {
        sourceWarnings.push(`${modelingWarningCount} catalog choice or alternative warning${modelingWarningCount === 1 ? '' : 's'} remain in the associate-degree source.`);
      }

      if (canonicalSourceRequired) {
        const publicationBlockers = [
          ...canonicalContractIssues(doc).map((issue) => `The associate-degree source ${issue}`),
          ...canonicalContractIssues(campus.template)
            .map((issue) => `The bachelor-degree source ${issue}`),
          ...bachelorRequirementRoleIssues.map((issue) => (
            `The bachelor-degree source has an ambiguous canonical requirement role at ${issue.path} (${issue.issues.join(', ')})`
          )),
          ...(pairAssociateFigureReadiness.ready
            ? [] : [pairAssociateFigureReadiness.warning]),
          ...(bachelorFigureReadiness.ready ? [] : [bachelorFigureReadiness.warning]),
          ...(pairUnresolvedConflictCount ? [
            `The associate-degree source retains ${pairUnresolvedConflictCount} unresolved source or modeling conflict${pairUnresolvedConflictCount === 1 ? '' : 's'}`,
          ] : []),
          ...(bachelorSourceConflictCount ? [
            `The bachelor-degree source retains ${bachelorSourceConflictCount} unresolved source or modeling conflict${bachelorSourceConflictCount === 1 ? '' : 's'}`,
          ] : []),
          ...(equivalencyConditions.ready ? [] : [equivalencyConditions.warning]),
        ];
        if (publicationBlockers.length) {
          rows.push(nullMetrics(
            base,
            'excluded',
            [...publicationBlockers, ...sourceWarnings].join('. ') + '.',
          ));
          continue;
        }
      }

      if (!matched.agreements.length) {
        rows.push(nullMetrics(
          base,
          'unavailable',
          [matched.warning, ...sourceWarnings].filter(Boolean).join(' '),
        ));
        continue;
      }

      if (radfordScience.applicable && !radfordScience.ready) {
        rows.push(nullMetrics(
          base,
          'excluded',
          [...sourceWarnings, radfordScience.reason].filter(Boolean).join(' '),
        ));
        continue;
      }
      const plan = planAssociateDegree(
        pairSections,
        eligible,
        generallyTransferable,
        cellUnitsById,
        exactSource ? {
          strictConstraints: true,
          paperFigure: '3_4',
          sourceDocument: doc,
          totalUnits: asTotal,
          totalUnitsMax: finiteNumber(doc.total_units_max) ?? asTotal,
          aggregateUnits: pairGeUnits,
          hasUnitsFill: (doc.requirement_groups || []).some((group) => group.units_fill === true),
          newRiverVirginiaTechPairProof: newRiverVirginiaTechPair,
          sourceBoundRequiredAnyIdSets: [
            ...(equivalencyConditions.source_bound_required_any_id_sets || []),
            ...(radfordScience.ready
              ? radfordScience.source_bound_required_any_id_sets : []),
          ],
          sourceBoundForbiddenCourseIds:
            equivalencyConditions.source_bound_forbidden_course_ids || [],
        } : {},
      );
      const warnings = [...sourceWarnings, ...plan.warnings];
      // Virginia's accepted schema carries explicit group/section/receiver
      // conjunctions.  Never infer a choice there from prose labels.  The
      // legacy warning remains untouched for CA/MA to preserve their published
      // payloads until those sources receive the same explicit gate.
      const groupAmbiguity = exactSource ? null : groupChoiceAmbiguity(doc);
      if (groupAmbiguity) warnings.push(groupAmbiguity);
      if (matched.warning) warnings.push(matched.warning);
      if (!plan.complete) {
        rows.push(nullMetrics(base, 'excluded', warnings.join(' '), round1(plan.total)));
        continue;
      }
      // Preserve the historical CA/MA tolerance exactly: their current corpus
      // never exercises it, and changing the shared payload would invalidate
      // the paper regression.  Virginia does not use this convenience rule.
      // Its strict planner closes against the source-authored total_units and
      // total_units_max (plus an explicit units_fill block where present), so
      // no largest-course heuristic can convert an unexplained overshoot into
      // an apparently valid cell.
      if (!exactSource) {
        const largestSelectedCourse = Math.max(0, ...plan.ids.map((id) => cellUnitsById.get(id) || 0));
        const overshoot = plan.total - asTotal;
        if (overshoot > largestSelectedCourse - EPSILON && overshoot > EPSILON) {
          warnings.push(`The selected named plan is ${round1(plan.total)} ${collegeSystem} units, above the ${round1(asTotal)}-unit degree total by more than its largest single course (${round1(largestSelectedCourse)}).`);
          rows.push(nullMetrics(base, 'excluded', warnings.join(' '), round1(plan.total)));
          continue;
        }
        if (overshoot > EPSILON) {
          warnings.push(`The selected named plan is ${round1(plan.total)} ${collegeSystem} units against a ${round1(asTotal)}-unit stated minimum; course sizes do not divide evenly into the floor.`);
        }
      }
      if (groupAmbiguity) {
        rows.push(nullMetrics(base, 'excluded', warnings.join(' '), round1(plan.total)));
        continue;
      }

      const evaluated = evaluateTemplate(
        campus.template,
        matched.agreements,
        new Set(plan.ids),
        cellUnitsById,
        campus.unitSystem,
        collegeSystem,
        exactSource,
        {
          associateDocument: doc,
          // This is a named hypothetical paper cohort, not an assertion that
          // an ordinary transfer student completed the GAP conditions.
          uvaWiseGaaScenario: 'successful_gaa_participant',
        },
      );
      if (evaluated.requirementRoleIssues.length) {
        rows.push(nullMetrics(
          base,
          'excluded',
          `The bachelor-degree allocation encountered ${evaluated.requirementRoleIssues.length} ambiguous canonical requirement role${evaluated.requirementRoleIssues.length === 1 ? '' : 's'} despite preflight.`,
          round1(plan.total),
        ));
        continue;
      }
      if (evaluated.sourceBoundApplicationIssues.length) {
        rows.push(nullMetrics(
          base,
          'excluded',
          evaluated.sourceBoundApplicationIssues
            .map((issue) => issue.reason)
            .join(' '),
          round1(plan.total),
        ));
        continue;
      }
      const fullKnownIneligibleUnits = knownIneligibleUnits(
        plan.ids,
        evaluated.directIds,
        transferabilityById,
        cellUnitsById,
      );
      const lowerKnownIneligibleUnits = knownIneligibleUnits(
        plan.ids,
        evaluated.lowerDirectIds,
        transferabilityById,
        cellUnitsById,
      );
      const sourceBoundUnappliedUnits = Math.max(
        0, Number(evaluated.sourceBoundUnappliedUnits) || 0,
      );
      const sourceBoundElectiveAppliedUnits = Math.max(
        0, Number(evaluated.sourceBoundElectiveAppliedUnits) || 0,
      );
      const sourceBoundReceivingCreditBonusCampusUnits = Math.max(
        0, Number(evaluated.sourceBoundReceivingCreditBonusCampusUnits) || 0,
      );
      // VT's receiving-credit award is itself transfer credit. Reserve its
      // place under the exact two-year ceiling before allocating any AS units;
      // otherwise a 60-credit AS plus a four-credit receiving bonus could
      // silently bypass the 61.5-credit cap.
      if (sourceBoundReceivingCreditBonusCampusUnits > EPSILON
          && effectiveTwoYearCapCollegeUnits == null) {
        rows.push(nullMetrics(
          base,
          'excluded',
          'The source-bound receiving-credit bonus cannot be applied without an exact two-year transfer ceiling.',
          round1(plan.total),
        ));
        continue;
      }
      const sourceBoundTransferCap = sourceBoundTransferCapUnits({
        transferCapUnits: effectiveTwoYearCapCollegeUnits,
        receivingCreditBonusCampusUnits:
          sourceBoundReceivingCreditBonusCampusUnits,
        campusSystem: campus.unitSystem,
        collegeSystem,
      });
      if (fullKnownIneligibleUnits > EPSILON) {
        warnings.push(`${round1(fullKnownIneligibleUnits)} selected ${collegeSystem} units are explicitly not UC-transferable and are counted as replacement coursework unless directly articulated.`);
      }
      if (sourceBoundUnappliedUnits > EPSILON) {
        warnings.push(`${round1(sourceBoundUnappliedUnits)} selected ${collegeSystem} units exceed the exact receiving-course award and are not reassigned to an unproved elective destination.`);
      }
      const geDemand = campusUnitsToCollege(
        evaluated.geCampusUnits,
        campus.unitSystem,
        collegeSystem
      );
      const electiveDemand = campusUnitsToCollege(
        evaluated.electiveCampusUnits,
        campus.unitSystem,
        collegeSystem
      );
      const uvaWiseGaa = evaluated.sourceBoundUvaWiseVccsGaa;
      const shenandoahAs = evaluated.sourceBoundShenandoahAs;
      // Supply only. `pairGeUnits` continues to drive the associate planner's
      // aggregate demand untouched; the enumerated Virginia GE credits are
      // added here so they can meet a bachelor breadth receiver that holds no
      // named course to articulate against.
      const credentialGeUnits = uvaWiseGaa?.ready || shenandoahAs?.ready
        ? asTotal : pairGeUnits + (enumeratedGeUnits || 0);
      const fullApplication = applyUvaWiseGaaDegreeMinimum(applyAssociateUnits({
        asTotal,
        directApplied: evaluated.directAppliedUnits,
        geUnits: credentialGeUnits,
        geDemand,
        electiveDemand,
        sourceBoundElectiveApplied: sourceBoundElectiveAppliedUnits,
        knownIneligibleUnits: fullKnownIneligibleUnits + sourceBoundUnappliedUnits,
        transferCapUnits: sourceBoundTransferCap,
      }), uvaWiseGaa, asTotal);
      const lowerGeDemand = campusUnitsToCollege(
        evaluated.lowerGeCampusUnits,
        campus.unitSystem,
        collegeSystem
      );
      const lowerElectiveDemand = campusUnitsToCollege(
        evaluated.lowerElectiveCampusUnits,
        campus.unitSystem,
        collegeSystem
      );
      const lowerApplication = applyAssociateUnits({
        asTotal,
        directApplied: evaluated.lowerDirectAppliedUnits,
        geUnits: credentialGeUnits,
        geDemand: lowerGeDemand,
        electiveDemand: lowerElectiveDemand,
        // Reserve the same pair-bound sending credits and transfer-cap room in
        // the lower ledger, then exclude their nonlower fulfillment below.
        sourceBoundElectiveApplied: sourceBoundElectiveAppliedUnits,
        knownIneligibleUnits: lowerKnownIneligibleUnits + sourceBoundUnappliedUnits,
        transferCapUnits: sourceBoundTransferCap,
      });
      const { direct: directApplied, geCounted, electiveCounted, applied } = fullApplication;
      if (fullApplication.transferCapBinding) {
        warnings.push(sourceBoundReceivingCreditBonusCampusUnits > EPSILON
          ? `The exact Virginia two-year transfer ceiling limits applied associate units plus the source-bound receiving-credit bonus to ${round1(effectiveTwoYearCapCollegeUnits)} ${collegeSystem} units.`
          : `The exact Virginia two-year transfer ceiling limits applied associate credit to ${round1(effectiveTwoYearCapCollegeUnits)} ${collegeSystem} units.`);
      }
      // MA Figure 3 asks which AS credits replace an actual bachelor
      // requirement. Named articulations and real GE/breadth capacity count;
      // unrestricted elective padding does not. Keep the broader application
      // total alongside it because Figures 4 and 5 still need every credit
      // that can land toward the 120-hour graduation floor.
      const paperEquivalentApplied = Math.min(asTotal, directApplied + geCounted);
      const extra = Math.max(0, asTotal - applied);
      const semesterExtra = toSemesterUnits(extra, collegeSystem);
      // The paper's Figure 4 is not the unused-AS-unit count by itself. It is
      // the whole modeled pathway minus the 120-semester-hour bachelor's
      // benchmark. Algebraically, pathway length is the resident bachelor's
      // requirement plus AS units that find no home in it:
      //
      //   AS + (resident degree - applied AS) = resident degree + unused AS.
      //
      // These coincide with `extra_units_semester` at every current CA campus
      // because its graduation minimum is 120 semester-equivalent units, but
      // the recovered MA resident plans range from 120 to 123. Keep both
      // constructs explicit so neither visual can silently relabel the other.
      const pathwaySemester = toSemesterUnits(campus.fullRequiredUnits, campus.unitSystem)
        + semesterExtra
        - toSemesterUnits(
          sourceBoundReceivingCreditBonusCampusUnits,
          campus.unitSystem,
        );
      const hoursAbove120 = Math.max(0, pathwaySemester - 120);
      const geCountedVerified = uvaWiseGaa?.ready || shenandoahAs?.ready
        ? geCounted : Math.min(geVerifiedUnits, geCounted);
      const geCountedAssumed = geCounted - geCountedVerified;
      if (geCountedAssumed > EPSILON) {
        warnings.push('GE credit uses an optimal-student assumption for dual-qualifying UC-transferable courses.');
      }
      if (fullApplication.generalElectiveCounted > EPSILON) {
        warnings.push('Elective credit assumes the remaining associate-degree units are UC-transferable.');
      }
      const fullCompletion = completionMetric(
        fullApplication.applied,
        campus.fullRequiredUnits,
        collegeSystem,
        campus.unitSystem,
        sourceBoundReceivingCreditBonusCampusUnits,
      );
      const lowerCompletion = completionMetric(
        lowerApplication.applied - lowerApplication.sourceBoundElectiveCounted,
        campus.lowerRequiredUnits,
        collegeSystem,
        campus.unitSystem
      );

      rows.push({
        ...base,
        // `rate` follows the visual's default full-degree scope. The explicit
        // fields should be preferred by new clients because they name the
        // denominator and keep the lower-division state alongside it.
        rate: fullCompletion.pct,
        full_degree_completion_pct: fullCompletion.pct,
        full_degree_fulfilled_units: fullCompletion.fulfilled,
        lower_division_completion_pct: lowerCompletion.pct,
        lower_division_fulfilled_units: lowerCompletion.fulfilled,
        as_unit_utilization_pct: asTotal > 0 ? round1((100 * applied) / asTotal) : null,
        paper_equivalent_as_unit_utilization_pct: asTotal > 0
          ? round1((100 * paperEquivalentApplied) / asTotal) : null,
        // Backward-compatible name for downloads; v2 defines it as the whole
        // associate degree rather than named+GE prescribed units.
        prescribed_units: round1(asTotal),
        transferred_units: round1(applied),
        paper_equivalent_transferred_units: round1(paperEquivalentApplied),
        named_units: round1(plan.total),
        named_transferred_units: round1(directApplied),
        ge_demand_units: round1(geDemand),
        ge_counted_units: round1(geCounted),
        ge_verified_units: round1(geCountedVerified),
        ge_assumed_units: round1(geCountedAssumed),
        elective_demand_units: round1(
          electiveDemand + sourceBoundElectiveAppliedUnits,
        ),
        elective_counted_units: round1(electiveCounted),
        ...(canonicalSourceRequired ? {
          source_bound_uva_wise_gaa_minimum_applied_units:
            fullApplication.uvaWiseGaaMinimumAppliedUnits ?? null,
          source_bound_uva_wise_gaa_policy_increment_units:
            fullApplication.uvaWiseGaaPolicyIncrementUnits ?? null,
          source_bound_uva_wise_gaa_evidence_sha256:
            uvaWiseGaa?.evidence_sha256 ?? null,
          source_bound_uva_wise_gaa_scenario:
            uvaWiseGaa?.scenario ?? null,
          source_bound_uva_wise_gaa_success_conditions_required:
            uvaWiseGaa?.successful_gaa_conditions_required ?? null,
        } : {}),
        known_nontransferable_units: round1(fullKnownIneligibleUnits),
        extra_units: round1(extra),
        extra_units_semester: round1(semesterExtra),
        modeled_pathway_units_semester: round1(pathwaySemester),
        modeled_hours_above_120: round1(hoursAbove120),
        // Figure 4 displays tenths, but Figure 5 prices the model's underlying
        // value before display rounding. Export both so the arithmetic receipt
        // is exact and nobody has to reverse-engineer a rounded heatmap label.
        modeled_hours_above_120_unrounded: hoursAbove120,
        ...(() => {
          const rate = tuitionBySchool.get(Number(campus.school_id));
          if (!rate) {
            return {
              extra_cost_usd: null,
              extra_cost_standard_load_usd: null,
              modeled_cost_above_120_usd: null,
              modeled_cost_above_120_standard_load_usd: null,
              tuition_annual_resident_usd: null,
              tuition_source: null,
              tuition_source_url: null,
              tuition_price_year: null,
            };
          }
          return {
            // Legacy replacement-coursework costs stay available for exports
            // that intentionally price unused AS units.
            extra_cost_usd: Math.round(semesterExtra * rate.perSemesterUnit),
            extra_cost_standard_load_usd:
              Math.round(semesterExtra * rate.perSemesterUnitStandardLoad),
            // Figures 4 and 5 share one numerator: modeled Figure 5 is exactly
            // modeled Figure 4 multiplied by the selected rate.
            modeled_cost_above_120_usd:
              Math.round(hoursAbove120 * rate.perSemesterUnit),
            modeled_cost_above_120_standard_load_usd:
              Math.round(hoursAbove120 * rate.perSemesterUnitStandardLoad),
            tuition_annual_resident_usd: rate.annual,
            tuition_source: rate.source,
            tuition_source_url: rate.sourceUrl,
            tuition_price_year: rate.priceYear,
          };
        })(),
        method_status: warnings.length ? 'estimated' : 'ok',
        method_warning: warnings.length ? [...new Set(warnings)].join(' ') : null,
      });
    }
  }

  rows.sort((a, b) => String(a.college_name).localeCompare(String(b.college_name))
    || String(a.school).localeCompare(String(b.school)));

  // A paper corpus carries the study's published per-pair values alongside our
  // recomputation. Figure 3 has both the repo tally and final-PDF revision;
  // Figures 4 and 5 use the final PDF's printed matrices. Which one a visual
  // displays is an explicit source choice, never an accident of pipeline.
  if (configuredMajor?.capabilities?.paperBaselines && configuredMajor?.state) {
    const published = await db.collection('ma_paper_baselines')
      .find({
        measure: { $in: ['pct_as', 'pct_as_pdf', 'extra_hours_pdf', 'extra_cost_pdf'] },
        community_college_id: { $ne: null },
      },
        { projection: { measure: 1, school_id: 1, community_college_id: 1, value: 1 } })
      .toArray();
    const byPair = new Map();
    for (const row of published) {
      byPair.set(`${row.measure}|${row.school_id}|${row.community_college_id}`, row.value);
    }

    // Preserve two archived-sheet reconstructions as diagnostic lenses: the
    // numerator restricted to receivers in the university's analyzed course
    // list ("CS-only") and the full GE-inclusive rate. The final PDF is a
    // later source and is served independently above; disagreement with these
    // older inputs is version/reconstruction evidence, not proof of a paper
    // error. GE here is the university-side complement of the archived
    // Figure-1 course list — that artifact's partition, not a label of ours;
    // AS courses are never classified.
    const [maDegrees, maAgreements, maSending] = await Promise.all([
      db.collection('curated_requirements')
        .find({ kind: 'degree', state: configuredMajor.state },
          { projection: { school_id: 1, requirement_groups: 1 } }).toArray(),
      db.collection('assist_agreements')
        .find({ state: configuredMajor.state, pairing: 'order-approximate' },
          { projection: { uc_school_id: 1, community_college_id: 1, requirement_groups: 1 } }).toArray(),
      db.collection('assist_courses')
        .find({ state: configuredMajor.state, side: 'sending' },
          { projection: { course_id: 1, units: 1 } }).toArray(),
    ]);
    const geParentIdsBySchool = new Map(maDegrees.map((degree) => [Number(degree.school_id), new Set(
      (degree.requirement_groups || [])
        .filter((group) => /^\s*GE\b/i.test(group.title || ''))
        .flatMap((group) => group.sections.flatMap((section) => section.receivers.map((r) => r.receiving.parent_id)))
    )]));
    const maUnitsById = new Map(maSending.map((course) => [course.course_id, course.units || 0]));
    const csOnlyByPair = new Map();
    for (const agreement of maAgreements) {
      const ge = geParentIdsBySchool.get(Number(agreement.uc_school_id)) || new Set();
      let csUnits = 0;
      for (const receiver of agreement.requirement_groups?.[0]?.sections?.[0]?.receivers || []) {
        if (receiver.articulation_status !== 'articulated' || !(receiver.options || []).length) continue;
        if (ge.has(receiver.receiving.parent_id)) continue;
        csUnits += receiver.options.flatMap((option) => option.course_ids || [])
          .reduce((sum, id) => sum + (maUnitsById.get(id) || 0), 0);
      }
      csOnlyByPair.set(`${agreement.uc_school_id}|${agreement.community_college_id}`, csUnits);
    }

    for (const row of rows) {
      const repo = byPair.get(`pct_as|${row.school_id}|${row.community_college_id}`);
      const pdf = byPair.get(`pct_as_pdf|${row.school_id}|${row.community_college_id}`);
      const pdfExtraHours = byPair.get(`extra_hours_pdf|${row.school_id}|${row.community_college_id}`);
      const pdfExtraCost = byPair.get(`extra_cost_pdf|${row.school_id}|${row.community_college_id}`);
      row.published_as_transfer_pct = repo != null ? +(repo * 100).toFixed(1) : null;
      row.published_pdf_as_transfer_pct = pdf != null ? +(pdf * 100).toFixed(1) : null;
      row.published_pdf_extra_hours = pdfExtraHours != null ? Number(pdfExtraHours) : null;
      row.published_pdf_extra_cost_usd = pdfExtraCost != null ? Number(pdfExtraCost) : null;
      const archiveGrayDetail = maFigure3ArchiveGrayDetail(row.school, row.college_name);
      row.archive_gray_detail_as_transfer_pct = archiveGrayDetail
        ? Number(archiveGrayDetail.archive_gray_detail_pct) : null;
      row.archive_gray_detail_numerator_units = archiveGrayDetail
        ? Number(archiveGrayDetail.archive_gray_units) : null;
      row.archive_gray_detail_denominator_units = archiveGrayDetail
        ? Number(archiveGrayDetail.archive_as_total_units) : null;
      row.archive_gray_detail_blue_units_excluded = archiveGrayDetail
        ? Number(archiveGrayDetail.archive_blue_only_units_excluded) : null;
      row.archive_gray_detail_matches_final_pdf = archiveGrayDetail
        ? Boolean(archiveGrayDetail.matches_final_pdf_at_printed_precision) : null;
      row.archive_gray_detail_delta_vs_final_pdf_pp = archiveGrayDetail
        ? Number(archiveGrayDetail.delta_archive_minus_pdf_pp) : null;
      row.archive_gray_detail_source = archiveGrayDetail
        ? `Deposited 2024 ${archiveGrayDetail.source_workbook}, ${archiveGrayDetail.source_sheet} sheet; gray replacement-row Column H credits / cleaned AS Column H total; blue unrestricted-elective-only rows excluded; no 100% cap`
        : null;
      const archiveDetail = maFigure4ArchiveDetail(row.school, row.college_name);
      const archivePathwayTotal = archiveDetail
        && Number.isFinite(Number(archiveDetail.archive_pathway_sheet_sum))
        ? Number(archiveDetail.archive_pathway_sheet_sum) : null;
      row.archived_pathway_sheet_total_hours = Number.isFinite(archivePathwayTotal)
        ? archivePathwayTotal : null;
      row.archived_pathway_sheet_extra_hours = Number.isFinite(archivePathwayTotal)
        ? Math.max(0, archivePathwayTotal - 120) : null;
      row.archived_pathway_sheet_source = archiveDetail
        ? 'Deposited 2024 pathway sheet; Figure 4 value = max(0, total semester hours - 120)'
        : null;
      const csUnits = csOnlyByPair.get(`${row.school_id}|${row.community_college_id}`);
      row.as_cs_only_utilization_pct = csUnits != null && row.as_total_units
        ? +((csUnits / row.as_total_units) * 100).toFixed(1)
        : null;
    }
  }
  return rows;
}

module.exports = {
  transferCreditRateData,
  GE_DEFAULT_UNITS: GE_DEFAULT_SEMESTER_UNITS,
  normalizeMajor,
  // Figure 6 must read the same associate-degree choice semantics as the
  // credit-accounting figures.  Export the deterministic selector instead of
  // maintaining a second, looser "take every receiver" implementation.
  associateNamedSections,
  planAssociateDegree,
  SUPPORTED_ASSOCIATE_CONSTRAINT_KINDS,
  supportsAssociateConstraintKind,
  unresolvedSourceConflictCount,
  sourceSpecificUnitsById,
  auditVirginiaProjectionEquivalencyConditions,
  // Testable boundary for the exact bachelor-side allocation rules. Runtime
  // callers continue through transferCreditRateData.
  _evaluateTemplate: evaluateTemplate,
  _applyAssociateUnits: applyAssociateUnits,
  _sourceBoundTransferCapUnits: sourceBoundTransferCapUnits,
};
