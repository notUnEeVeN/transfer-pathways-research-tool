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
const DEGREE_TYPES = ['local_as', 'ast'];
const EPSILON = 1e-7;
const { defaultMajor, getMajor, programPairClause, programPairs } = require('../../config/majors');
const { computeUnitBudget } = require('../degreeSlots');

const round1 = (value) => +(Number(value) || 0).toFixed(1);

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

function scoredOption(option, transferable, unitsById) {
  const ids = optionIds(option);
  const total = unitsForIds(ids, unitsById);
  const transferred = unitsForIds(ids.filter((id) => transferable.has(id)), unitsById);
  return { ids, total, transferred };
}

function compareTransferChoice(a, b) {
  const ratioA = a.total > 0 ? a.transferred / a.total : 0;
  const ratioB = b.total > 0 ? b.transferred / b.total : 0;
  return ratioB - ratioA
    || b.transferred - a.transferred
    || a.total - b.total
    || a.ids.join(',').localeCompare(b.ids.join(','));
}

function receiverChoices(receiver, transferable, unitsById) {
  return (receiver.options || [])
    .map((option) => scoredOption(option, transferable, unitsById))
    .filter((option) => option.ids.length && option.total > 0)
    .sort(compareTransferChoice);
}

function stateForIds(ids, transferable, unitsById) {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  return {
    ids: unique,
    total: unitsForIds(unique, unitsById),
    transferred: unitsForIds(unique.filter((id) => transferable.has(id)), unitsById),
  };
}

function betterUnitState(candidate, incumbent) {
  if (!incumbent) return true;
  return candidate.transferred > incumbent.transferred + EPSILON
    || (Math.abs(candidate.transferred - incumbent.transferred) <= EPSILON
      && candidate.ids.join(',').localeCompare(incumbent.ids.join(',')) < 0);
}

// Exact subset search for a choose-by-units section. A completion plan uses
// the smallest attainable unit total at/above the catalog floor; among plans
// at that total, the transfer-oriented option wins. One option per receiver.
function chooseUnitPlan(section, transferable, unitsById) {
  const target = Number(section.unit_advisement) || 0;
  const choices = (section.receivers || []).map((receiver) =>
    receiverChoices(receiver, transferable, unitsById));
  const maxOption = Math.max(0, ...choices.flat().map((option) => option.total));
  const cap = target + maxOption + EPSILON;
  let states = new Map([[0, { ids: [], total: 0, transferred: 0 }]]);

  for (const receiverOptions of choices) {
    const next = new Map(states);
    for (const state of states.values()) {
      for (const option of receiverOptions) {
        const candidate = stateForIds([...state.ids, ...option.ids], transferable, unitsById);
        if (candidate.total > cap) continue;
        const key = Math.round(candidate.total * 100);
        if (betterUnitState(candidate, next.get(key))) next.set(key, candidate);
      }
    }
    states = next;
  }

  const feasible = [...states.values()]
    .filter((state) => state.total + EPSILON >= target)
    .sort((a, b) => a.total - b.total
      || b.transferred - a.transferred
      || a.ids.join(',').localeCompare(b.ids.join(',')));
  if (feasible.length) return { ...feasible[0], complete: true };

  const partial = [...states.values()].sort((a, b) => b.total - a.total
    || b.transferred - a.transferred
    || a.ids.join(',').localeCompare(b.ids.join(',')))[0] || { ids: [], total: 0, transferred: 0 };
  return { ...partial, complete: false };
}

function associateNamedSections(doc) {
  const sections = [];
  for (const group of doc.requirement_groups || []) {
    if (group.units_fill || group.ge_area) continue;
    for (const section of group.sections || []) {
      if (!(section.receivers || []).length) continue;
      sections.push({ ...section, groupLabel: group.label_seen || group.title || 'Named requirements' });
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

function planAssociateDegree(sections, transferable, unitsById) {
  const chosen = new Set();
  const warnings = [];
  let complete = true;

  for (const section of sections) {
    let pick;
    if (section.unit_advisement != null) {
      pick = chooseUnitPlan(section, transferable, unitsById);
      if (!pick.complete) {
        complete = false;
        warnings.push(`${section.groupLabel} cannot reach its ${section.unit_advisement}-unit minimum with resolved courses.`);
      }
      if (/\bsequences?\b|\balternatives?\b|\bpathways?\b|\btracks?\b|\bcomplete\s+one\s+option\b|\bone\s+option\b|\bgroupings?\b|\bcourse\s+pairs?\b/i.test(section.groupLabel)) {
        warnings.push(`${section.groupLabel} is stored as a unit pool; sequence or pathway combinations remain an estimate.`);
      }
    } else {
      const candidates = (section.receivers || [])
        .map((receiver) => receiverChoices(receiver, transferable, unitsById)[0])
        .filter(Boolean)
        .sort(compareTransferChoice);
      const ask = section.section_advisement != null
        ? Math.min(Number(section.section_advisement), candidates.length)
        : candidates.length;
      const selected = candidates.slice(0, Math.max(0, ask));
      pick = stateForIds(selected.flatMap((option) => option.ids), transferable, unitsById);
      if (section.section_advisement != null && candidates.length < Number(section.section_advisement)) {
        complete = false;
        warnings.push(`${section.groupLabel} has fewer resolved choices than its course requirement.`);
      }
    }
    for (const id of pick.ids || []) chosen.add(id);
  }

  const state = stateForIds([...chosen], transferable, unitsById);
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
// an explicit group-level OR. Sequence-shaped unit pools are less severe: the
// unit solver can estimate them and labels that estimate separately.
function groupChoiceAmbiguity(doc) {
  const labels = (doc.requirement_groups || [])
    .filter((group) => !group.units_fill && !group.ge_area)
    .map((group) => String(group.label_seen || group.title || ''));
  const optionGroups = labels.filter((label) => /\boption(?:al)?\b/i.test(label));
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
  return Number.isFinite(stated) && stated > 0 ? stated : ask * ASSUMED_UNITS_PER_COURSE;
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

// Apply the feasible AS plan to the full UC template. The return capacities
// remain in campus-native units; the caller converts them to the CC system.
function evaluateTemplate(template, agreements, planSet, unitsById, campusSystem, collegeSystem) {
  const optionsByPid = agreementOptionsByPid(agreements);
  const directIds = new Set();
  let directAppliedUnits = 0;
  let lowerDirectAppliedUnits = 0;
  let geCampusUnits = 0;
  let lowerGeCampusUnits = 0;
  let electiveCampusUnits = 0;
  let lowerElectiveCampusUnits = 0;

  for (const group of template.requirement_groups || []) {
    for (const section of group.sections || []) {
      const tier = section.tier || group.tier || 'transferable';
      const isLowerDivision = tier !== 'nontransferable';
      const receivers = section.receivers || [];
      if (!receivers.length) continue;
      const ask = Math.max(0, Number(section.section_advisement) || receivers.length);
      if (!ask) continue;
      const campusUnits = sectionCampusUnits(section, ask);

      const role = assumedRole(section, receivers);
      if (role === 'elective') {
        electiveCampusUnits += campusUnits;
        if (isLowerDivision) lowerElectiveCampusUnits += campusUnits;
        continue;
      }
      if (role === 'zero') continue;
      if (role === 'ge') {
        geCampusUnits += campusUnits;
        if (isLowerDivision) lowerGeCampusUnits += campusUnits;
        continue;
      }

      const geReceivers = receivers.filter((receiver) => receiver.receiving?.kind === 'ge_area');
      if (geReceivers.length) {
        geCampusUnits += campusUnits;
        if (isLowerDivision) lowerGeCampusUnits += campusUnits;
        continue;
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
          const newA = unitsForIds(a.ids.filter((id) => !directIds.has(id)), unitsById);
          const newB = unitsForIds(b.ids.filter((id) => !directIds.has(id)), unitsById);
          return newB - newA || a.ids.join(',').localeCompare(b.ids.join(','));
        });
        const candidate = available.shift();
        selected.push(candidate);
        const newlyAppliedIds = candidate.ids.filter((id) => !directIds.has(id));
        const rawNewUnits = unitsForIds(newlyAppliedIds, unitsById);
        // Articulation can require a larger CC bundle for a smaller UC course.
        // Only the authored UC requirement capacity counts in the named bucket;
        // any excess may still land in explicit elective room later.
        const capacityRemaining = Math.max(0, sectionCapacity - sectionAppliedUnits);
        const appliedHere = Math.min(rawNewUnits, capacityRemaining);
        sectionAppliedUnits += appliedHere;
        directAppliedUnits += appliedHere;
        if (isLowerDivision) lowerDirectAppliedUnits += appliedHere;
        for (const id of candidate.ids) directIds.add(id);
      }

      if (hasGeFallback(section, receivers) && selected.length < ask) {
        const fallbackUnits = campusUnits * ((ask - selected.length) / ask);
        geCampusUnits += fallbackUnits;
        if (isLowerDivision) lowerGeCampusUnits += fallbackUnits;
      }
    }
  }

  return {
    directIds,
    directAppliedUnits,
    lowerDirectAppliedUnits,
    geCampusUnits,
    lowerGeCampusUnits,
    electiveCampusUnits,
    lowerElectiveCampusUnits,
  };
}

function applyAssociateUnits({
  asTotal, directApplied, geUnits, geDemand, electiveDemand,
}) {
  const direct = Math.min(asTotal, directApplied);
  let remaining = Math.max(0, asTotal - direct);
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
    full_degree_completion_pct: null,
    full_degree_fulfilled_units: null,
    lower_division_completion_pct: null,
    lower_division_fulfilled_units: null,
    prescribed_units: null,
    transferred_units: null,
    named_units: namedUnits,
    named_transferred_units: null,
    elective_counted_units: null,
    extra_units: null,
    extra_units_semester: null,
    method_status: status,
    method_warning: warning,
  };
}

async function transferCreditRateData(db, _auditDb, {
  degreeType = 'local_as', majorSlug = null, majorPrograms = null,
} = {}) {
  const type = DEGREE_TYPES.includes(degreeType) ? degreeType : 'local_as';
  const slug = String(majorSlug || '').trim();
  const configuredMajor = slug ? getMajor(slug) : null;
  const exactPrograms = majorPrograms || configuredMajor?.programs || null;
  const legacySlug = defaultMajor().slug;
  const degreeQuery = {
    kind: 'as_degree', degree_type: type, status: 'found',
    major_slug: majorSlug || 'cs',
  };
  const templateQuery = { kind: 'degree' };
  if (slug) {
    const dimensional = [{ major_slug: slug }];
    // Existing CS documents predate major_slug; no other major may claim an
    // unstamped row. Editing one stamps it permanently.
    if (slug === legacySlug) dimensional.push({ major_slug: { $exists: false } });
    degreeQuery.$or = dimensional;
    templateQuery.$or = dimensional;
  }
  const [degrees, templates, institutions] = await Promise.all([
    db.collection('curated_requirements')
      .find(degreeQuery).toArray(),
    db.collection('curated_requirements').find(templateQuery).toArray(),
    db.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { name: 1, source_id: 1 } }).toArray(),
  ]);

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
        fullRequiredUnits: budget.modeled_units,
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
      { projection: { uc_school_id: 1, community_college_id: 1, major: 1, requirement_groups: 1 } }
    ).toArray()
    : [];
  const agreementsByPair = new Map();
  for (const agreement of agreements) {
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
    };
  });
  const allCourseIds = [...new Set(parsedDegrees.flatMap(({ courseSet }) => [...courseSet]))];
  const unitsById = new Map();
  if (allCourseIds.length) {
    const courses = await db.collection('assist_courses').find(
      { side: 'sending', course_id: { $in: allCourseIds } },
      { projection: { course_id: 1, units: 1, uc_transferable: 1, _id: 0 } }
    ).toArray();
    for (const course of courses) unitsById.set(Number(course.course_id), Number(course.units) || 0);
  }

  const nameById = new Map(institutions.map((institution) => [Number(institution.source_id), institution.name]));
  const rows = [];
  for (const { doc, sections, courseSet, ge, unresolved } of parsedDegrees) {
    const collegeId = Number(doc.community_college_id);
    const collegeSystem = doc.unit_system === 'quarter' ? 'quarter' : 'semester';
    const asTotal = Number(doc.total_units)
      || fromSemesterUnits(60, collegeSystem);
    const geUnits = ge.reduce((total, block) => total + block.units, 0);
    const geVerifiedUnits = ge.reduce((total, block) => total + (block.verified ? block.units : 0), 0);

    for (const campus of campuses) {
      const pair = agreementsByPair.get(`${campus.school_id}:${collegeId}`) || [];
      const matched = agreementsForTemplate(pair, campus.template);
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
        degree_unit_system: campus.unitSystem,
        full_degree_required_units: round1(campus.fullRequiredUnits),
        lower_division_required_units: round1(campus.lowerRequiredUnits),
        ge_units: round1(geUnits),
        unresolved_count: unresolved,
      };

      if (!matched.agreements.length) {
        rows.push(nullMetrics(base, 'unavailable', matched.warning));
        continue;
      }

      const eligible = broadlyEligibleCourseIds(campus.template, matched.agreements, courseSet);
      const plan = planAssociateDegree(sections, eligible, unitsById);
      const warnings = [...plan.warnings];
      const groupAmbiguity = groupChoiceAmbiguity(doc);
      if (groupAmbiguity) warnings.push(groupAmbiguity);
      if (matched.warning) warnings.push(matched.warning);
      if (!plan.complete) {
        rows.push(nullMetrics(base, 'excluded', warnings.join(' '), round1(plan.total)));
        continue;
      }
      if (plan.total > asTotal + EPSILON) {
        warnings.push(`The selected named plan is ${round1(plan.total)} ${collegeSystem} units, above the ${round1(asTotal)}-unit degree total.`);
        rows.push(nullMetrics(base, 'excluded', warnings.join(' '), round1(plan.total)));
        continue;
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
      });
      const { direct: directApplied, geCounted, electiveCounted, applied } = fullApplication;
      const extra = Math.max(0, asTotal - applied);
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
        // Backward-compatible name for downloads; v2 defines it as the whole
        // associate degree rather than named+GE prescribed units.
        prescribed_units: round1(asTotal),
        transferred_units: round1(applied),
        named_units: round1(plan.total),
        named_transferred_units: round1(directApplied),
        ge_demand_units: round1(geDemand),
        ge_counted_units: round1(geCounted),
        ge_verified_units: round1(geCountedVerified),
        ge_assumed_units: round1(geCountedAssumed),
        elective_demand_units: round1(electiveDemand),
        elective_counted_units: round1(electiveCounted),
        extra_units: round1(extra),
        extra_units_semester: round1(toSemesterUnits(extra, collegeSystem)),
        method_status: warnings.length ? 'estimated' : 'ok',
        method_warning: warnings.length ? [...new Set(warnings)].join(' ') : null,
      });
    }
  }

  rows.sort((a, b) => String(a.college_name).localeCompare(String(b.college_name))
    || String(a.school).localeCompare(String(b.school)));
  return rows;
}

module.exports = {
  transferCreditRateData,
  GE_DEFAULT_UNITS: GE_DEFAULT_SEMESTER_UNITS,
  normalizeMajor,
};
