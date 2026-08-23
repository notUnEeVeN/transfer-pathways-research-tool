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
// for more units than its largest alternative can never close. California
// documents already store each alternative as its own receiver; the Virginia
// catalog importer stores them as options on a single receiver
// (scripts/importVirginiaCatalogDegrees.js, the community-college branch),
// which silently excluded 96 Virginia cells. Normalize here rather than in one
// importer so the planner reads both encodings identically.
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

function associateNamedSections(doc) {
  const sections = [];
  for (const group of doc.requirement_groups || []) {
    if (group.units_fill || group.ge_area) continue;
    for (const section of group.sections || []) {
      if (!(section.receivers || []).length) continue;
      sections.push({
        ...splitUnitPoolReceivers(section),
        groupLabel: group.label_seen || group.title || 'Named requirements',
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

function planAssociateDegree(sections, directlyEligible, generallyTransferable, unitsById) {
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

function geBlocks(doc) {
  const blocks = [];
  const collegeSystem = doc.unit_system === 'quarter' ? 'quarter' : 'semester';
  const geLabel = /general\s*education|\bgen(?:eral)?[\s.]*ed\b/i;
  for (const group of doc.requirement_groups || []) {
    if (group.units_fill) continue;
    const hasReceivers = (group.sections || []).some((section) => (section.receivers || []).length);
    const labelled = !group.ge_area && !hasReceivers && geLabel.test(group.label_seen || '');
    if (!group.ge_area && !labelled) continue;
    const stated = Number((group.sections || [])[0]?.unit_advisement);
    const semesterDefault = GE_DEFAULT_SEMESTER_UNITS[group.ge_area]
      || GE_STATUTORY_MINIMUM_SEMESTER_UNITS;
    const units = Number.isFinite(stated) && stated > 0
      ? stated
      : fromSemesterUnits(semesterDefault, collegeSystem);
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
function evaluateSection(section, group, ctx, state) {
  const {
    optionsByPid, planSet, unitsById, campusSystem, collegeSystem,
  } = ctx;
  // A group marked university-only is university-only in its entirety, in
  // either vocabulary; a section's own tier only counts under ordinary groups
  // (shared rule with the unit budget, via degreeSlots).
  const isLowerDivision = resolveSectionTier(group, section) !== 'nontransferable';
  const receivers = section.receivers || [];
  if (!receivers.length) return;
  const ask = Math.max(0, Number(section.section_advisement) || receivers.length);
  if (!ask) return;
  const campusUnits = sectionCampusUnits(section, ask);

  const role = assumedRole(section, receivers);
  if (role === 'elective') {
    state.electiveCampusUnits += campusUnits;
    if (isLowerDivision) state.lowerElectiveCampusUnits += campusUnits;
    return;
  }
  if (role === 'zero') return;
  if (role === 'ge') {
    state.geCampusUnits += campusUnits;
    if (isLowerDivision) state.lowerGeCampusUnits += campusUnits;
    return;
  }

  const geReceivers = receivers.filter((receiver) => receiver.receiving?.kind === 'ge_area');
  if (geReceivers.length) {
    state.geCampusUnits += campusUnits;
    if (isLowerDivision) state.lowerGeCampusUnits += campusUnits;
    return;
  }

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

// Apply the feasible AS plan to the full UC template. The return capacities
// remain in campus-native units; the caller converts them to the CC system.
function evaluateTemplate(template, agreements, planSet, unitsById, campusSystem, collegeSystem) {
  const ctx = {
    optionsByPid: agreementOptionsByPid(agreements),
    planSet,
    unitsById,
    campusSystem,
    collegeSystem,
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
  };

  for (const group of template.requirement_groups || []) {
    const sections = group.sections || [];
    const isOr = String(group.group_conjunction || '').toLowerCase() === 'or' && sections.length > 1;
    if (!isOr) {
      for (const section of sections) evaluateSection(section, group, ctx, state);
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
  knownIneligibleUnits = 0,
}) {
  const direct = Math.min(asTotal, directApplied);
  let remaining = Math.max(0, asTotal - direct - knownIneligibleUnits);
  const geCounted = Math.min(geUnits, geDemand, remaining);
  remaining -= geCounted;
  const electiveCounted = Math.min(electiveDemand, remaining);
  return {
    direct,
    geCounted,
    electiveCounted,
    applied: Math.min(asTotal, direct + geCounted + electiveCounted),
  };
}

function knownIneligibleUnits(planIds, directlyAppliedIds, transferabilityById, unitsById) {
  return unitsForIds(
    planIds.filter((id) => (
      transferabilityById.get(id) === false && !directlyAppliedIds.has(id)
    )),
    unitsById,
  );
}

function completionMetric(appliedCollegeUnits, requiredCampusUnits, collegeSystem, campusSystem) {
  const required = Number(requiredCampusUnits) || 0;
  if (required <= 0) return { fulfilled: null, pct: null };
  const fulfilled = Math.min(
    required,
    collegeUnitsToCampus(appliedCollegeUnits, collegeSystem, campusSystem)
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
      const budget = computeUnitBudget(template.requirement_groups);
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
      { projection: { uc_school_id: 1, community_college_id: 1, major: 1, pairing: 1, requirement_groups: 1 } }
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
    const sections = associateNamedSections(doc);
    return {
      doc,
      sections,
      courseSet: candidateCourseSet(sections),
      ge: geBlocks(doc),
      unresolved: unresolvedCount(doc),
      modelingWarningCount: Array.isArray(doc.extraction?.modeling_warnings)
        ? doc.extraction.modeling_warnings.length
        : 0,
    };
  });
  const allCourseIds = [...new Set(parsedDegrees.flatMap(({ courseSet }) => [...courseSet]))];
  const unitsById = new Map();
  const transferabilityById = new Map();
  if (allCourseIds.length) {
    const courses = await db.collection('assist_courses').find(
      { side: 'sending', course_id: { $in: allCourseIds } },
      { projection: { course_id: 1, units: 1, uc_transferable: 1, _id: 0 } }
    ).toArray();
    for (const course of courses) {
      const courseId = Number(course.course_id);
      unitsById.set(courseId, Number(course.units) || 0);
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
    doc, sections, courseSet, ge, unresolved, modelingWarningCount,
  } of parsedDegrees) {
    const collegeId = Number(doc.community_college_id);
    const collegeSystem = doc.unit_system === 'quarter' ? 'quarter' : 'semester';
    const asTotal = Number(doc.total_units)
      || fromSemesterUnits(60, collegeSystem);
    const geUnits = ge.reduce((total, block) => total + block.units, 0);
    const geVerifiedUnits = ge.reduce((total, block) => total + (block.verified ? block.units : 0), 0);

    for (const campus of campuses) {
      const pair = agreementsByPair.get(`${campus.school_id}:${collegeId}`) || [];
      const matched = agreementsForTemplate(pair, campus.template);
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
        ge_units: round1(geUnits),
        unresolved_count: unresolved,
        source_analysis_ready: doc.analysis_ready === true
          ? true
          : (doc.analysis_ready === false ? false : null),
        source_verified: doc.verification?.verified === true,
        degree_template_assumed_valid: !templateVerified && assumeDegreeTemplatesValid,
        source_modeling_warning_count: modelingWarningCount,
      };

      const sourceWarnings = [];
      if (doc.analysis_ready === false) {
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

      if (!matched.agreements.length) {
        rows.push(nullMetrics(
          base,
          'unavailable',
          [matched.warning, ...sourceWarnings].filter(Boolean).join(' '),
        ));
        continue;
      }

      const eligible = broadlyEligibleCourseIds(campus.template, matched.agreements, courseSet);
      const plan = planAssociateDegree(sections, eligible, generallyTransferable, unitsById);
      const warnings = [...sourceWarnings, ...plan.warnings];
      const groupAmbiguity = groupChoiceAmbiguity(doc);
      if (groupAmbiguity) warnings.push(groupAmbiguity);
      if (matched.warning) warnings.push(matched.warning);
      if (!plan.complete) {
        rows.push(nullMetrics(base, 'excluded', warnings.join(' '), round1(plan.total)));
        continue;
      }
      // `total_units` is the degree's stated MINIMUM, not a cap, and courses
      // are indivisible. A plan assembled from 3-, 4- and 5-unit courses often
      // cannot land exactly on a 60-unit floor, so a small overshoot is
      // ordinary — a real student finishes with 61 units in a 60-unit degree.
      // What this guard is for is a plan that is wildly wrong: summing
      // mutually exclusive tracks once modelled Berkeley MCB at 392 units
      // against a stated 120.
      //
      // The honest threshold is therefore the largest single course the plan
      // selected. Below that, the overshoot is arithmetic the student cannot
      // avoid; at or above it, a whole course too many was chosen and the plan
      // really is describing someone else's degree.
      //
      // Measured: this fires on 0 California and 0 Massachusetts cells at any
      // tolerance — every current exclusion by this rule is Virginia, where
      // the named sections cover the whole degree because Virginia enumerates
      // its general education as named courses.
      const largestSelectedCourse = Math.max(0, ...plan.ids.map((id) => unitsById.get(id) || 0));
      const overshoot = plan.total - asTotal;
      if (overshoot > largestSelectedCourse - EPSILON && overshoot > EPSILON) {
        warnings.push(`The selected named plan is ${round1(plan.total)} ${collegeSystem} units, above the ${round1(asTotal)}-unit degree total by more than its largest single course (${round1(largestSelectedCourse)}).`);
        rows.push(nullMetrics(base, 'excluded', warnings.join(' '), round1(plan.total)));
        continue;
      }
      if (overshoot > EPSILON) {
        warnings.push(`The selected named plan is ${round1(plan.total)} ${collegeSystem} units against a ${round1(asTotal)}-unit stated minimum; course sizes do not divide evenly into the floor.`);
      }
      if (groupAmbiguity) {
        rows.push(nullMetrics(base, 'excluded', warnings.join(' '), round1(plan.total)));
        continue;
      }

      const evaluated = evaluateTemplate(
        campus.template,
        matched.agreements,
        new Set(plan.ids),
        unitsById,
        campus.unitSystem,
        collegeSystem
      );
      const fullKnownIneligibleUnits = knownIneligibleUnits(
        plan.ids,
        evaluated.directIds,
        transferabilityById,
        unitsById,
      );
      const lowerKnownIneligibleUnits = knownIneligibleUnits(
        plan.ids,
        evaluated.lowerDirectIds,
        transferabilityById,
        unitsById,
      );
      if (fullKnownIneligibleUnits > EPSILON) {
        warnings.push(`${round1(fullKnownIneligibleUnits)} selected ${collegeSystem} units are explicitly not UC-transferable and are counted as replacement coursework unless directly articulated.`);
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
      const fullApplication = applyAssociateUnits({
        asTotal,
        directApplied: evaluated.directAppliedUnits,
        geUnits,
        geDemand,
        electiveDemand,
        knownIneligibleUnits: fullKnownIneligibleUnits,
      });
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
        geUnits,
        geDemand: lowerGeDemand,
        electiveDemand: lowerElectiveDemand,
        knownIneligibleUnits: lowerKnownIneligibleUnits,
      });
      const { direct: directApplied, geCounted, electiveCounted, applied } = fullApplication;
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
        + semesterExtra;
      const hoursAbove120 = Math.max(0, pathwaySemester - 120);
      const geCountedVerified = Math.min(geVerifiedUnits, geCounted);
      const geCountedAssumed = geCounted - geCountedVerified;
      if (geCountedAssumed > EPSILON) {
        warnings.push('GE credit uses an optimal-student assumption for dual-qualifying UC-transferable courses.');
      }
      if (electiveCounted > EPSILON) {
        warnings.push('Elective credit assumes the remaining associate-degree units are UC-transferable.');
      }
      const fullCompletion = completionMetric(
        fullApplication.applied,
        campus.fullRequiredUnits,
        collegeSystem,
        campus.unitSystem
      );
      const lowerCompletion = completionMetric(
        lowerApplication.applied,
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
        elective_demand_units: round1(electiveDemand),
        elective_counted_units: round1(electiveCounted),
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
};
