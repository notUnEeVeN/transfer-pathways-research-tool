/**
 * DB-coupled analysis layer — computes the transfer-pathway statistics the
 * research project replicates from the CA/MA SIGCSE papers, over the research
 * dataset + the curation layer.
 *
 * Everything here works on REQUIRED requirement groups by default, honors
 * curation receiver-overrides (exclude), and reports course categories via
 * `curated_mappings` course categories (university parent_id → canonical
 * category), with receiver overrides as the fallback for non-course
 * receivers. Methodological choices mirror the papers' best-case-scenario
 * framing; see optionSolver.js for the min-set semantics.
 */
const { manyToOneCount } = require('./optionSolver');
const { selectMissingAcrossMajorsOptimal } = require('./minCourses');
const { isMajorArticulable, calculateMajorCompletionPercentage, allArticulatingCourses } = require('./eligibility');
const { buildDegreeGroups, degreeUnitSystem } = require('../degreeSlots');
const { COURSE_TYPES, degreeCategoryOf } = require('../courseTypes');
const { projectPrereqEdges } = require('../prereqGraph');

// UC-only: the research project studies UC transfer pathways exclusively.
const SYSTEMS = [
  { key: 'uc', coll: 'assist_agreements', idField: 'uc_school_id', nameField: 'uc_school' },
];

const systemsFor = () => SYSTEMS;

// ── curation joins ──

function majorDocumentFilter(majorSlug) {
  const slug = String(majorSlug || '').trim();
  if (!slug) return {};
  // Existing CS curation predates major_slug. Treat only those legacy rows as
  // CS; every newly onboarded major must be explicitly stamped.
  if (slug === 'cs') {
    return { $or: [{ major_slug: slug }, { major_slug: { $exists: false } }, { major_slug: null }] };
  }
  return { major_slug: slug };
}

async function loadCuration(auditDb, majorSlug = null) {
  const majorClause = majorDocumentFilter(majorSlug);
  const [cats, overrides] = await Promise.all([
    auditDb.collection('curated_mappings').find({ kind: 'course_category', ...majorClause }).toArray(),
    auditDb.collection('curated_mappings').find({ kind: 'receiver_override', ...majorClause }).toArray(),
  ]);
  return {
    categoryByParent: new Map(cats.map((c) => [
      Number(String(c.course_id || c.legacy_id || '').replace(/^university:/, '')), c,
    ])),
    overrideByHash: new Map(overrides.map((o) => [
      String(o.receiver_hash ?? o.legacy_id ?? '').replace(/^receiver_override:/, ''), o,
    ])),
  };
}

const makeIsExcluded = (curation) => (receiver) =>
  curation.overrideByHash.get(String(receiver.hash_id))?.exclude === true;

// Canonical category of a receiver: course/series kinds resolve through the
// university-course tags (first tagged parent wins); anything else falls back
// to the receiver override's category.
function categoryOfReceiver(receiver, curation) {
  const receiving = receiver.receiving || {};
  const parentIds = receiving.kind === 'course' ? [receiving.parent_id]
    : receiving.kind === 'series' ? (receiving.parent_ids || [])
    : [];
  for (const pid of parentIds) {
    const tag = curation.categoryByParent.get(Number(pid));
    if (tag?.category) return tag.category;
  }
  return curation.overrideByHash.get(String(receiver.hash_id))?.category ?? null;
}

// Iterate required receivers (minus excluded) of one agreement.
function* requiredReceivers(agreement, isExcluded) {
  for (const group of agreement.requirement_groups || []) {
    if (group.is_required === false) continue;
    for (const section of group.sections || []) {
      for (const r of section.receivers || []) {
        if (!isExcluded(r)) yield r;
      }
    }
  }
}

const receiverHashKey = (r) =>
  String(r.hash_id ?? `${r.receiving?.kind || 'receiver'}:${r.receiving?.parent_id || ''}`);

// Build a poolable "major" for isMajorArticulable: the campus's requirement
// structure (group/section advisements preserved) with each receiver's
// articulation set to the OR across the bucket's colleges (articulatedByHash).
// An articulated receiver gets a synthetic satisfiable option so the ported
// eligibility adapter can evaluate it; unarticulated receivers stay optionless.
// This makes fully_articulated honor choose-N (section/group advisement) instead
// of demanding every receiver, while preserving the heatmap's cross-college
// pooling (articulatedByHash already ORs sibling colleges).
function assistCombinedMajor(requirementGroups, articulatedByHash, isExcluded) {
  let synthId = 0;
  return {
    requirement_groups: (requirementGroups || []).map((g) => ({
      ...g,
      sections: (g.sections || []).map((s) => ({
        ...s,
        receivers: (s.receivers || []).filter((r) => !isExcluded(r)).map((r) => {
          const articulated = articulatedByHash.get(receiverHashKey(r)) === true;
          synthId += 1;
          return {
            receiving: r.receiving,
            hash_id: r.hash_id,
            articulation_status: articulated ? 'articulated' : 'not_articulated',
            options: articulated ? [{ course_ids: [`elig-${synthId}`], course_conjunction: 'and' }] : [],
            options_conjunction: 'and',
          };
        }),
      })),
    })),
  };
}

// Iterate every receiver in an agreement. Paper-style hard-requirement
// coverage uses university-site minimums to decide what is required, so ASSIST
// is used only as an equivalency source and its required/recommended grouping
// is intentionally ignored.
function* allReceivers(agreement) {
  for (const group of agreement.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const r of section.receivers || []) yield r;
    }
  }
}

function receiverParentIds(receiver) {
  const receiving = receiver.receiving || {};
  if (receiving.kind === 'course' && receiving.parent_id != null) return [Number(receiving.parent_id)];
  if (receiving.kind === 'series') return (receiving.parent_ids || []).map(Number).filter(Number.isFinite);
  return [];
}

// ── reference-table joins ──

async function loadRefs(db) {
  const institutions = await db.collection('assist_institutions').find().toArray();
  const universities = institutions.filter((row) => row.kind === 'university');
  const colleges = institutions.filter((row) => row.kind === 'community_college');
  return {
    communityColleges: colleges,
    calendarByUniversity: new Map(universities.map((r) => [Number(r.source_id), r.academic_calendar])),
    tuitionByUniversity: new Map(universities
      .filter((r) => r.tuition_per_credit_usd != null)
      .map((r) => [Number(r.source_id), Number(r.tuition_per_credit_usd)])),
    districtByCc: new Map(colleges.map((r) => [Number(r.source_id), {
      district: r.district ?? null,
      region: r.region ?? null,
      counties_served: Array.isArray(r.counties_served) ? r.counties_served : [],
    }])),
  };
}

async function loadCcCourseUnits(db) {
  const rows = await db.collection('assist_courses')
    .find({ side: 'sending' }, { projection: { course_id: 1, units: 1 } }).toArray();
  return new Map(rows.map((r) => [String(r.course_id), Number(r.units) || 0]));
}

// CC-course catalog (units + same_as) keyed by stringified course_id — the
// optimizer's coursesById. String keys match the stringified option ids below.
async function loadCoursesById(db) {
  const rows = await db.collection('assist_courses')
    .find({ side: 'sending' }, { projection: { course_id: 1, units: 1, same_as: 1, same_as_keys: 1 } }).toArray();
  const m = new Map();
  for (const r of rows) {
    m.set(String(r.course_id), {
      course_id: String(r.course_id),
      units: r.units,
      same_as: (r.same_as_keys || r.same_as || []).map((p) => ({
        course_id: String(p?.course_id ?? p).replace(/^cc:/, ''),
      })),
    });
  }
  return m;
}

// Exclusion-filtered requirement_groups with option course_ids stringified (raw
// DB ids are numbers; the optimizer's synthetic transcript uses strings, so both
// it and the eligibility engine must compare string-to-string).
function prepRequirementGroups(doc, isExcluded) {
  return (doc.requirement_groups || []).map((g) => ({
    ...g,
    sections: (g.sections || []).map((s) => ({
      ...s,
      receivers: (s.receivers || []).filter((r) => !isExcluded(r)).map((r) => ({
        ...r,
        options: (r.options || []).map((o) => ({ ...o, course_ids: (o.course_ids || []).map(String) })),
      })),
    })),
  }));
}

// Choose-N true minimum for one prepped agreement: per required section, the ask
// (min(section_advisement, receivers), or 1 for a no-advisement "any one" section)
// and how much of it articulates. So "Complete 1 of 3" counts as one required
// course, satisfied when any one articulates — not the naive 3-required/2-articulated.
function chooseNMinimum(groups) {
  let required = 0;
  let satisfiable = 0;
  for (const g of groups) {
    if (!g.is_required) continue;
    for (const s of g.sections || []) {
      const recvs = s.receivers || [];
      if (!recvs.length) continue;
      const ask = s.section_advisement != null
        ? Math.min(s.section_advisement, recvs.length)
        : Math.min(1, recvs.length);
      const articulated = recvs.filter((r) => r.articulation_status === 'articulated').length;
      required += ask;
      satisfiable += Math.min(articulated, ask);
    }
  }
  return { required, satisfiable, blocked: required - satisfiable };
}

// Exact minimum-course pathway + choose-N-correct requirement counts for one
// agreement — the engine-based replacement for the greedy agreementMinSet.
// `coursesById` is the CC catalog; ids ASSIST references but that are absent
// from `courses` get a placeholder so the optimizer can still pick them (they
// still count, exactly as the older figures counted them by name).
function agreementMinSetExact(doc, isExcluded, coursesById) {
  const groups = prepRequirementGroups(doc, isExcluded);
  for (const g of groups) {
    for (const s of g.sections || []) {
      for (const r of s.receivers || []) {
        for (const o of r.options || []) {
          for (const id of o.course_ids || []) {
            if (!coursesById.has(id)) coursesById.set(id, { course_id: id, units: null, same_as: [] });
          }
        }
      }
    }
  }
  const major = { requirement_groups: groups };
  const courses = selectMissingAcrossMajorsOptimal([major], {
    userCourses: [], coursesById, includeRecommended: false, crossCc: [],
  });
  const counts = chooseNMinimum(groups);
  return {
    courses,
    receiversRequired: counts.required,
    receiversSatisfiable: counts.satisfiable,
    receiversBlocked: counts.blocked,
    fullyArticulated: isMajorArticulable(major, true),
  };
}

async function loadTransferRequirements(db, majorSlug = null) {
  const majorClause = majorDocumentFilter(majorSlug);
  const rows = await db.collection('curated_requirements')
    .find({ kind: 'transfer_minimum', ...majorClause }, { projection: {
      school_id: 1, school: 1, uc_code: 1, group_id: 1, set_id: 1,
      receiving_code: 1, parent_ids: 1, matched: 1,
    } })
    .sort({ school_id: 1, group_id: 1, set_id: 1, source_order: 1 })
    .toArray();

  const bySchool = new Map();
  for (const row of rows) {
    const schoolId = Number(row.school_id);
    if (!bySchool.has(schoolId)) {
      bySchool.set(schoolId, {
        school_id: schoolId,
        school: row.school,
        uc_code: row.uc_code,
        groups: new Map(),
        parentIds: new Set(),
      });
    }
    const school = bySchool.get(schoolId);
    const groupId = String(row.group_id);
    const setId = String(row.set_id);
    if (!school.groups.has(groupId)) school.groups.set(groupId, { group_id: groupId, sets: new Map() });
    const group = school.groups.get(groupId);
    if (!group.sets.has(setId)) group.sets.set(setId, { set_id: setId, requirements: [] });
    const parentIds = (row.parent_ids || []).map(Number).filter(Number.isFinite);
    for (const parentId of parentIds) school.parentIds.add(parentId);
    group.sets.get(setId).requirements.push({
      receiving_code: row.receiving_code,
      parent_ids: parentIds,
      matched: row.matched !== false && parentIds.length > 0,
    });
  }
  return bySchool;
}

// Combined major scope: the configured exact pairs (or an explicit legacy
// contains-search) intersected with the caller's configured/authorized pair
// allowlist. Visibility is per (school, major) pair.
const { pairClause } = require('../majorVisibility');
const {
  getMajor, listMajors, programPairs, programPairClause,
} = require('../../config/majors');

// The configured CS entry is the sole compatibility target for old
// pin=paper/settings URLs. Both aliases now mean the same canonical nine
// campus/program pairs; neither can restore a historical program union or a
// mutable settings selection.
const CANONICAL_CS_PROGRAMS = getMajor('cs').programs;

function resolveProgramScope(majorSlug, majorPrograms) {
  const slug = String(majorSlug || '').trim();
  if (slug) {
    const configured = getMajor(slug);
    if (!configured) throw new Error(`unknown major: ${slug}`);
    return majorPrograms || configured.programs;
  }
  return majorPrograms || null;
}

async function settingsMajors() {
  return new Map(Object.entries(CANONICAL_CS_PROGRAMS)
    .map(([schoolId, majors]) => [Number(schoolId), [...majors]]));
}

function coverageMajorQuery({
  pin, majorSlug, majorPrograms, majorContains, visiblePairs,
}, idField) {
  const exactPrograms = resolveProgramScope(majorSlug, majorPrograms)
    || (pin ? CANONICAL_CS_PROGRAMS : null);
  return majorFilter({
    majorSlug,
    majorPrograms: exactPrograms,
    majorContains: exactPrograms ? '' : majorContains,
    // Pinned aggregate figures remain visibility-independent, but are still
    // constrained to the canonical configured major.
    visiblePairs: pin ? null : visiblePairs,
  }, idField);
}

function majorFilter({
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
} = {}, idField = 'uc_school_id') {
  const clauses = [];
  const exactPrograms = resolveProgramScope(majorSlug, majorPrograms);
  if (exactPrograms) clauses.push(programPairClause(exactPrograms, { schoolField: idField }));
  // Free-text matching exists only for an explicit legacy caller. A resolved
  // major slug always supplies majorPrograms and therefore never reaches this.
  else if (majorContains) clauses.push({ major: { $regex: escapeRegex(majorContains), $options: 'i' } });
  if (visiblePairs != null) clauses.push(pairClause(visiblePairs, idField));
  if (!clauses.length) return {};
  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

function normalizeProgramName(value) {
  return String(value || '')
    .trim()
    // UCSD's degree template carries its catalog code while the ASSIST pin
    // carries the CSE department prefix.
    .replace(/^\s*[a-z]{2,}\s*:\s*/i, '')
    .replace(/\(\s*[a-z]{2,}\s*\d+[a-z0-9-]*\s*\)/ig, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function degreeMatchesPrograms(degree, majorSlug, majorPrograms) {
  const stampedSlug = String(degree.major_slug || '').trim();
  const configured = programPairs(majorPrograms)
    .filter((pair) => pair.school_id === Number(degree.school_id));
  if (stampedSlug) {
    return Boolean(majorSlug)
      && stampedSlug === majorSlug
      && configured.some((pair) => pair.major === String(degree.program));
  }
  const normalized = normalizeProgramName(degree.program);
  return configured.some((pair) => normalizeProgramName(pair.major) === normalized);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── analyses ──

/**
 * Coverage — the CA/MA papers' core figure. By default, one row per
 * agreement. With groupBy=district|county, rows are best-of aggregates:
 * a receiver is counted articulated when any underlying college in the
 * district/county articulates it.
 */
function membershipsFor(doc, refs, mode) {
  const ccId = Number(doc.community_college_id);
  const ref = refs.districtByCc.get(ccId) || null;
  const college = {
    kind: 'college',
    key: String(ccId),
    label: doc.community_college,
    community_college_id: ccId,
    community_college: doc.community_college,
    district: ref?.district ?? null,
    region: ref?.region ?? null,
    counties_served: ref?.counties_served ?? [],
  };
  if (mode === 'college') return [college];
  if (mode === 'district') {
    return [{
      ...college,
      kind: 'district',
      key: ref?.district ? `district:${ref.district}` : `college:${ccId}`,
      label: ref?.district || `${doc.community_college} (unmapped district)`,
    }];
  }
  const counties = ref?.counties_served?.length ? ref.counties_served : [`${doc.community_college} (unmapped county)`];
  return counties.map((county) => ({
    ...college,
    kind: 'county',
    key: `county:${county}`,
    label: county,
    county,
  }));
}

function evaluateTransferRequirementModel(model, articulatedParentIds) {
  let receiversRequired = 0;
  let receiversArticulated = 0;
  let groupsSatisfied = 0;
  const groupCount = model.groups.size;
  // Per-group verdicts travel with the row so course-level figures (the CA
  // paper's Figure 5) can ask which single demand a district misses, without
  // re-running the evaluation.
  const groupResults = [];

  for (const group of model.groups.values()) {
    const setResults = [...group.sets.values()].map((set) => {
      const requirements = set.requirements || [];
      const articulated = requirements.filter((req) =>
        (req.parent_ids || []).some((parentId) => articulatedParentIds.has(Number(parentId)))
      ).length;
      return {
        total: requirements.length,
        articulated,
        missing: requirements.length - articulated,
        satisfied: requirements.length > 0 && articulated === requirements.length,
      };
    });
    const satisfied = setResults.find((result) => result.satisfied);
    const best = satisfied || setResults.sort((a, b) =>
      a.missing - b.missing || b.articulated - a.articulated || a.total - b.total
    )[0] || { total: 0, articulated: 0, satisfied: false };
    receiversRequired += best.total;
    receiversArticulated += best.articulated;
    if (best.satisfied) groupsSatisfied += 1;
    groupResults.push({
      group_id: group.group_id,
      satisfied: Boolean(best.satisfied),
      receivers_required: best.total,
      receivers_articulated: best.articulated,
    });
  }

  return {
    requirement_groups: groupResults,
    receivers_required: receiversRequired,
    receivers_articulated: receiversArticulated,
    requirement_groups_required: groupCount,
    requirement_groups_satisfied: groupsSatisfied,
    pct_articulated: receiversRequired ? +((receiversArticulated / receiversRequired) * 100).toFixed(1) : null,
    fully_articulated: groupCount > 0 && groupsSatisfied === groupCount,
  };
}

async function hardRequirementCoverageData(db, auditDb, {
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
  groupBy = 'college', pin = null,
} = {}, refs) {
  const mode = ['college', 'district', 'county'].includes(groupBy) ? groupBy : 'college';
  const effectiveMajorSlug = majorSlug || (pin ? 'cs' : null);
  const requirementsBySchool = await loadTransferRequirements(db, effectiveMajorSlug);
  const buckets = new Map();

  for (const sys of systemsFor()) {
    const query = coverageMajorQuery({
      pin, majorSlug, majorPrograms, majorContains, visiblePairs,
    }, sys.idField);
    const docs = await db.collection(sys.coll).find(query).toArray();
    for (const doc of docs) {
      const schoolRequirements = requirementsBySchool.get(Number(doc[sys.idField]));
      if (!schoolRequirements) continue;
      const memberships = membershipsFor(doc, refs, mode);
      const programKey = `${sys.key}|${doc[sys.idField]}|hard-requirements`;
      for (const m of memberships) {
        const key = `${m.key}|${programKey}`;
        if (!buckets.has(key)) {
          buckets.set(key, {
            system: sys.key,
            school_id: doc[sys.idField],
            school: doc[sys.nameField],
            major: 'Curated hard transfer requirements',
            requirementsModel: schoolRequirements,
            row_group_kind: m.kind,
            row_group_key: m.key,
            row_group_label: m.label,
            articulatedParentIds: new Set(),
            sourceMajors: new Set(),
            communityCollegeIds: new Set(),
            communityColleges: new Set(),
            districts: new Set(),
            regions: new Set(),
            counties: new Set(),
          });
        }
        const bucket = buckets.get(key);
        bucket.communityCollegeIds.add(Number(doc.community_college_id));
        bucket.communityColleges.add(doc.community_college);
        bucket.sourceMajors.add(doc.major);
        if (m.district) bucket.districts.add(m.district);
        if (m.region) bucket.regions.add(m.region);
        for (const county of m.counties_served || []) bucket.counties.add(county);
      }

      for (const r of allReceivers(doc)) {
        if (r.articulation_status !== 'articulated') continue;
        const parentIds = receiverParentIds(r)
          .filter((parentId) => schoolRequirements.parentIds.has(Number(parentId)));
        if (!parentIds.length) continue;
        for (const m of memberships) {
          const bucket = buckets.get(`${m.key}|${programKey}`);
          for (const parentId of parentIds) bucket.articulatedParentIds.add(Number(parentId));
        }
      }
    }
  }

  return [...buckets.values()].map((b) => {
    const evaluated = evaluateTransferRequirementModel(b.requirementsModel, b.articulatedParentIds);
    const community_college_ids = [...b.communityCollegeIds].sort((a, b) => a - b);
    const community_colleges = [...b.communityColleges].sort();
    const districts = [...b.districts].sort();
    const regions = [...b.regions].sort();
    const counties = [...b.counties].sort();
    return {
      system: b.system,
      school_id: b.school_id,
      school: b.school,
      community_college_id: b.row_group_kind === 'college' ? community_college_ids[0] : null,
      community_college: b.row_group_kind === 'college' ? community_colleges[0] : null,
      community_college_ids,
      community_colleges,
      community_college_district: districts[0] ?? null,
      community_college_region: regions.length === 1 ? regions[0] : null,
      community_college_counties: counties,
      county: b.row_group_kind === 'county' ? b.row_group_label : null,
      major: b.major,
      source_majors: [...b.sourceMajors].sort(),
      requirements: 'paper',
      requirements_source: 'curated_requirements',
      uc_code: b.requirementsModel.uc_code,
      row_group_kind: b.row_group_kind,
      row_group_key: b.row_group_key,
      row_group_label: b.row_group_label,
      ...evaluated,
    };
  });
}

function degreeParentIds(degrees) {
  const ids = new Set();
  for (const degree of degrees) {
    for (const group of degree.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          for (const parentId of receiverParentIds(receiver)) ids.add(parentId);
        }
      }
    }
  }
  return [...ids];
}

function degreeRowGroups(colleges, refs, mode) {
  const groups = new Map();
  for (const college of colleges) {
    const doc = {
      community_college_id: Number(college.source_id),
      community_college: college.name,
    };
    for (const membership of membershipsFor(doc, refs, mode)) {
      if (!groups.has(membership.key)) {
        groups.set(membership.key, {
          kind: membership.kind,
          key: membership.key,
          label: membership.label,
          communityCollegeIds: new Set(),
          communityColleges: new Set(),
          districts: new Set(),
          regions: new Set(),
          counties: new Set(),
        });
      }
      const group = groups.get(membership.key);
      group.communityCollegeIds.add(Number(college.source_id));
      group.communityColleges.add(college.name);
      if (membership.district) group.districts.add(membership.district);
      if (membership.region) group.regions.add(membership.region);
      for (const county of membership.counties_served || []) group.counties.add(county);
    }
  }
  return [...groups.values()];
}

function mergeGeAreas(communityCollegeIds, geAreasByCollege) {
  const merged = new Map();
  for (const collegeId of communityCollegeIds) {
    for (const [area, courses] of geAreasByCollege.get(Number(collegeId)) || []) {
      if (!merged.has(area)) merged.set(area, []);
      merged.get(area).push(...courses);
    }
  }
  return merged;
}

/**
 * Full-degree coverage, matching Figure 1 of the Massachusetts paper: each
 * cell's primary percentage is the share of the modeled graduation units for
 * which the row's college(s) have an equivalent. The editable `kind: degree`
 * templates are the denominator; ASSIST agreements and CC GE tags supply the
 * equivalencies. University-only units remain in the denominator at zero.
 * Requirement-slot coverage is retained as a secondary structural measure.
 */
async function degreeRequirementCoverageData(db, {
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
  groupBy = 'college', pin = null,
} = {}, refs) {
  const mode = ['college', 'district', 'county'].includes(groupBy) ? groupBy : 'college';
  const degreeFilter = { kind: 'degree' };
  const exactPrograms = resolveProgramScope(majorSlug, majorPrograms)
    || (pin ? CANONICAL_CS_PROGRAMS : null);

  // Degree-template labels are not always byte-identical to ASSIST program
  // names (for example UCSD includes "(CS26)"). Scope stamped templates by
  // major_slug; for the nine legacy unstamped CS templates, load only the
  // configured campuses and apply normalized campus/program equivalence below.
  if (exactPrograms) {
    degreeFilter.school_id = { $in: programPairs(exactPrograms).map((pair) => pair.school_id) };
  } else if (!pin && visiblePairs != null) {
    const schoolIds = [...new Set(visiblePairs.map((pair) => Number(pair.school_id)).filter(Number.isFinite))];
    if (!schoolIds.length) return [];
    degreeFilter.school_id = { $in: schoolIds };
  }
  if (!exactPrograms && !pin && majorContains) {
    degreeFilter.program = { $regex: escapeRegex(majorContains), $options: 'i' };
  }

  const candidateDegrees = await db.collection('curated_requirements')
    .find(degreeFilter)
    .sort({ school_id: 1 })
    .toArray();
  const degrees = exactPrograms
    ? candidateDegrees.filter((degree) => degreeMatchesPrograms(
      degree, majorSlug || (pin ? 'cs' : null), exactPrograms,
    ))
    : candidateDegrees;
  if (!degrees.length) return [];

  const schoolIds = [...new Set(degrees.map((degree) => Number(degree.school_id)).filter(Number.isFinite))];
  const parentIds = degreeParentIds(degrees);

  // Return one compact row per campus-college pair. Doing this reduction in
  // Mongo avoids shipping every full agreement tree for a live heatmap refresh.
  const exactArticulationScope = majorFilter({
    majorSlug,
    majorPrograms: exactPrograms,
    majorContains: exactPrograms ? '' : majorContains,
    visiblePairs: pin ? null : visiblePairs,
  });
  const articulationMatch = Object.keys(exactArticulationScope).length
    ? { $and: [{ uc_school_id: { $in: schoolIds } }, exactArticulationScope] }
    : { uc_school_id: { $in: schoolIds } };
  const articulationPipeline = [
    { $match: articulationMatch },
    { $unwind: '$requirement_groups' },
    { $unwind: '$requirement_groups.sections' },
    { $unwind: '$requirement_groups.sections.receivers' },
    { $replaceWith: {
      uc_school_id: '$uc_school_id',
      community_college_id: '$community_college_id',
      receiver: '$requirement_groups.sections.receivers',
    } },
    { $match: { 'receiver.articulation_status': 'articulated' } },
    { $project: {
      uc_school_id: 1,
      community_college_id: 1,
      parent_ids: {
        $cond: [
          { $eq: ['$receiver.receiving.kind', 'series'] },
          { $ifNull: ['$receiver.receiving.parent_ids', []] },
          ['$receiver.receiving.parent_id'],
        ],
      },
    } },
    { $unwind: '$parent_ids' },
    { $match: { parent_ids: { $in: parentIds } } },
    { $group: {
      _id: { school_id: '$uc_school_id', community_college_id: '$community_college_id' },
      parent_ids: { $addToSet: '$parent_ids' },
    } },
  ];

  // GE/breadth requirements use the college catalog rather than major-prep
  // agreements. Only IDs are needed because slot coverage depends on the count.
  const gePipeline = [
    { $match: { side: 'sending', uc_transferable: true } },
    { $unwind: '$igetc_area' },
    { $group: {
      _id: { community_college_id: '$community_college_id', area: '$igetc_area' },
      course_ids: { $addToSet: '$course_id' },
    } },
  ];

  // Receiving-course codes for the course-type rollup (MA Figure 2): the
  // paper types each requirement by the four-year's own course code.
  const universityCoursePipeline = [
    { $match: { side: 'receiving', parent_id: { $in: parentIds } } },
    { $project: { _id: 0, parent_id: 1, prefix: 1, number: 1, title: 1 } },
  ];

  const [articulationRows, geRows, universityCourseRows] = await Promise.all([
    db.collection('assist_agreements').aggregate(articulationPipeline).toArray(),
    db.collection('assist_courses').aggregate(gePipeline).toArray(),
    db.collection('assist_courses').aggregate(universityCoursePipeline).toArray(),
  ]);
  const universityCoursesById = Object.fromEntries(
    universityCourseRows.map((course) => [Number(course.parent_id), course])
  );
  const categoryOf = degreeCategoryOf(universityCoursesById);

  const articulatedByPair = new Map();
  for (const row of articulationRows) {
    articulatedByPair.set(
      `${Number(row._id.school_id)}|${Number(row._id.community_college_id)}`,
      new Set((row.parent_ids || []).map(Number))
    );
  }
  const geAreasByCollege = new Map();
  for (const row of geRows) {
    const collegeId = Number(row._id.community_college_id);
    if (!geAreasByCollege.has(collegeId)) geAreasByCollege.set(collegeId, new Map());
    geAreasByCollege.get(collegeId).set(
      row._id.area,
      (row.course_ids || []).map((courseId) => ({ course_id: courseId }))
    );
  }

  const rowGroups = degreeRowGroups(refs.communityColleges, refs, mode);
  const rows = [];
  for (const degree of degrees) {
    const schoolId = Number(degree.school_id);
    for (const rowGroup of rowGroups) {
      const collegeIds = [...rowGroup.communityCollegeIds].sort((a, b) => a - b);
      const articulated = new Set();
      for (const collegeId of collegeIds) {
        for (const parentId of articulatedByPair.get(`${schoolId}|${collegeId}`) || []) {
          articulated.add(parentId);
        }
      }
      const ccGeAreas = mergeGeAreas(collegeIds, geAreasByCollege);
      const evaluated = buildDegreeGroups(degree.requirement_groups,
        { articulated, ccGeAreas, universityCoursesById, categoryOf });
      const pctSlots = evaluated.total
        ? +((evaluated.covered / evaluated.total) * 100).toFixed(1)
        : null;
      const pctUnits = evaluated.units.total
        ? +((evaluated.units.covered / evaluated.units.total) * 100).toFixed(1)
        : null;
      const unitSystem = degreeUnitSystem(degree, refs.calendarByUniversity.get(schoolId));
      const collegeNames = [...rowGroup.communityColleges].sort();
      const districts = [...rowGroup.districts].sort();
      const regions = [...rowGroup.regions].sort();
      const counties = [...rowGroup.counties].sort();

      rows.push({
        system: 'uc',
        school_id: schoolId,
        school: degree.school,
        community_college_id: rowGroup.kind === 'college' ? collegeIds[0] : null,
        community_college: rowGroup.kind === 'college' ? collegeNames[0] : null,
        community_college_ids: collegeIds,
        community_colleges: collegeNames,
        community_college_district: districts[0] ?? null,
        community_college_region: regions.length === 1 ? regions[0] : null,
        community_college_counties: counties,
        county: rowGroup.kind === 'county' ? rowGroup.label : null,
        major: degree.program,
        row_group_kind: rowGroup.kind,
        row_group_key: rowGroup.key,
        row_group_label: rowGroup.label,
        requirements: 'degree',
        requirements_source: 'curated_requirements.degree',
        degree_template_id: String(degree._id),
        degree_template_updated_at: degree.updated_at ?? null,
        degree_unit_system: unitSystem,
        degree_units_stated_minimum: degree.total_units ?? null,
        degree_units_modeled_total: evaluated.units.total,
        degree_units_with_equivalent: evaluated.units.covered,
        pct_degree_units: pctUnits,
        // Slot coverage remains available as a secondary description of the
        // requirement structure. The legacy names are kept for compatibility.
        degree_total_units: degree.total_units ?? null,
        degree_requirements_total: evaluated.total,
        degree_requirements_with_equivalent: evaluated.covered,
        degree_requirements_by_tier: evaluated.by_tier,
        // Slots by course type, for the MA paper's Figure 2 breakdown. Every
        // type is present even when a campus requires nothing in it.
        degree_requirements_by_course_type: Object.fromEntries(COURSE_TYPES.map((type) => [
          type,
          evaluated.by_category?.[type]
            || { total: 0, covered: 0, lower_division_total: 0, lower_division_covered: 0 },
        ])),
        pct_degree_requirements: pctSlots,
        degree_requirement_slots_total: evaluated.total,
        degree_requirement_slots_with_equivalent: evaluated.covered,
        pct_degree_requirement_slots: pctSlots,
        // Generic aliases keep the shared heatmap model compatible with all
        // three requirement bases. Counts remain slots, but the generic percent
        // now follows the primary unit-weighted degree measure.
        receivers_required: evaluated.total,
        receivers_articulated: evaluated.covered,
        pct_articulated: pctUnits,
        fully_articulated: evaluated.units.total > 0
          && evaluated.units.covered >= evaluated.units.total,
      });
    }
  }
  return rows;
}

async function coverageData(db, auditDb, {
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
  groupBy = 'college', requirements = 'assist', pin = null,
} = {}) {
  const refs = await loadRefs(db);
  if (requirements === 'degree') {
    return degreeRequirementCoverageData(db, {
      majorSlug, majorPrograms, majorContains, visiblePairs, groupBy, pin,
    }, refs);
  }
  if (requirements === 'paper') {
    return hardRequirementCoverageData(db, auditDb, {
      majorSlug, majorPrograms, majorContains, visiblePairs, groupBy, pin,
    }, refs);
  }

  const curation = await loadCuration(auditDb, majorSlug || (pin ? 'cs' : null));
  const isExcluded = makeIsExcluded(curation);
  const buckets = new Map();
  const mode = ['college', 'district', 'county'].includes(groupBy) ? groupBy : 'college';

  for (const sys of systemsFor()) {
    const query = coverageMajorQuery({
      pin, majorSlug, majorPrograms, majorContains, visiblePairs,
    }, sys.idField);
    const docs = await db.collection(sys.coll).find(query).toArray();
    for (const doc of docs) {
      const memberships = membershipsFor(doc, refs, mode);
      const programKey = `${sys.key}|${doc[sys.idField]}|${doc.major}`;
      for (const m of memberships) {
        const key = `${m.key}|${programKey}`;
        if (!buckets.has(key)) {
          buckets.set(key, {
            system: sys.key,
            school_id: doc[sys.idField],
            school: doc[sys.nameField],
            major: doc.major,
            row_group_kind: m.kind,
            row_group_key: m.key,
            row_group_label: m.label,
            // Structure template for choose-N articulability (advisements live
            // here). Same campus×major structure across pooled sibling colleges;
            // per-receiver articulation is OR'd into receiverByHash below.
            requirementGroups: doc.requirement_groups,
            receiverByHash: new Map(),
            communityCollegeIds: new Set(),
            communityColleges: new Set(),
            districts: new Set(),
            regions: new Set(),
            counties: new Set(),
          });
        }
        const bucket = buckets.get(key);
        bucket.communityCollegeIds.add(Number(doc.community_college_id));
        bucket.communityColleges.add(doc.community_college);
        if (m.district) bucket.districts.add(m.district);
        if (m.region) bucket.regions.add(m.region);
        for (const county of m.counties_served || []) bucket.counties.add(county);
      }
      for (const r of requiredReceivers(doc, isExcluded)) {
        const hash = receiverHashKey(r);
        for (const m of memberships) {
          const bucket = buckets.get(`${m.key}|${programKey}`);
          const cur = bucket.receiverByHash.get(hash) || false;
          bucket.receiverByHash.set(hash, cur || r.articulation_status === 'articulated');
        }
      }
    }
  }
  return [...buckets.values()].map((b) => {
    const receiverValues = [...b.receiverByHash.values()];
    const total = receiverValues.length;
    const articulated = receiverValues.filter(Boolean).length;
    // Choose-N-correct coverage via the eligibility engine (pooling sibling
    // colleges through receiverByHash). `fully_articulated` = can you meet the
    // stated minimum at all; `pct_articulated` = what FRACTION of the true
    // choose-N minimum articulates (strict asks = the stated need, not the
    // advisement-blind "every listed receiver must articulate" count). So a
    // "Complete 1 of {A,B,C}" section counts as one requirement, satisfied when
    // any one articulates — e.g. Allan Hancock → UCB CS B.A. reads 100%, not 4/5.
    const combined = assistCombinedMajor(b.requirementGroups, b.receiverByHash, isExcluded);
    const fully_articulated = isMajorArticulable(combined, true);
    const hasRequired = (combined.requirement_groups || []).some((g) => g.is_required);
    const pctArticulated = hasRequired
      ? +calculateMajorCompletionPercentage(combined, allArticulatingCourses(combined), [], true).toFixed(1)
      : null;
    const community_college_ids = [...b.communityCollegeIds].sort((a, b) => a - b);
    const community_colleges = [...b.communityColleges].sort();
    const districts = [...b.districts].sort();
    const regions = [...b.regions].sort();
    const counties = [...b.counties].sort();
    return {
      system: b.system,
      school_id: b.school_id,
      school: b.school,
      community_college_id: b.row_group_kind === 'college' ? community_college_ids[0] : null,
      community_college: b.row_group_kind === 'college' ? community_colleges[0] : null,
      community_college_ids,
      community_colleges,
      community_college_district: districts[0] ?? null,
      community_college_region: regions.length === 1 ? regions[0] : null,
      community_college_counties: counties,
      county: b.row_group_kind === 'county' ? b.row_group_label : null,
      major: b.major,
      row_group_kind: b.row_group_kind,
      row_group_key: b.row_group_key,
      row_group_label: b.row_group_label,
      receivers_required: total,
      receivers_articulated: articulated,
      // Engine-based coverage: fraction of the true choose-N minimum that
      // articulates (100 ⟺ fully_articulated). receivers_* above are the raw
      // per-receiver counts kept for context, not the displayed percentage.
      pct_articulated: pctArticulated,
      fully_articulated,
    };
  });
}

/**
 * Per-college ASSIST-vs-website minimums comparison for one (campus, major,
 * college). Unifies the curated website hard-minimum and the ASSIST-stated
 * required groups by UC course, tagging each in_website / in_assist / articulated
 * against ONE articulation reality (the college's articulated parent_ids), plus a
 * coverage summary per side. Powers the Data tab's college comparison view.
 *
 * The two summaries reuse the same logic the coverage heatmap uses so the numbers
 * agree: website via evaluateTransferRequirementModel (best-set-per-group), ASSIST
 * via the eligibility engine on the agreement's exclusion-filtered groups (choose-N
 * honored). articulated is the college-level truth — does the CC articulate this UC
 * course anywhere in its CS agreements for this campus — so both columns compare.
 */
async function requirementComparisonData(db, auditDb, { schoolId, major, communityCollegeId } = {}) {
  schoolId = Number(schoolId);
  communityCollegeId = Number(communityCollegeId);
  const wantedMajor = String(major || '').trim();
  const configuredMajor = listMajors().find((entry) =>
    (entry.programs[schoolId] || []).some((program) => String(program).trim() === wantedMajor));
  const [requirementsBySchool, curation] = await Promise.all([
    loadTransferRequirements(db, configuredMajor?.slug || null),
    loadCuration(auditDb, configuredMajor?.slug || null),
  ]);
  const model = requirementsBySchool.get(schoolId);
  const isExcluded = makeIsExcluded(curation);

  // All of the college's agreements at this campus, then pick the chosen major
  // tolerant of stored whitespace — some ASSIST program names carry a trailing
  // space (e.g. UC Merced's "...B.S. "), so an exact/trimmed query would miss.
  const collegeAll = await db.collection('assist_agreements').find(
    { uc_school_id: schoolId, community_college_id: communityCollegeId },
    { projection: { requirement_groups: 1, community_college: 1, uc_school: 1, major: 1 } }).toArray();
  const agreement = collegeAll.find((a) => String(a.major || '').trim() === wantedMajor) || null;
  // Articulation reality belongs to this exact program. Pooling sibling CS,
  // CSE, joint, or minor agreements can make a missing canonical articulation
  // appear present, which is the same cross-major leakage the aggregate
  // figures guard against.
  const collegeDocs = agreement ? [agreement] : [];

  // College-level articulation: every UC parent_id this CC articulates in the
  // selected exact agreement, plus a parent_id -> UC code label and the
  // articulating CC course_ids (options as OR-of-AND).
  const articulatedParents = new Set();
  const codeOfParent = new Map();
  const ccByParent = new Map(); // parent_id -> string[][] (options -> CC course_id strings)
  const orderedDocs = collegeDocs;
  for (const doc of orderedDocs) {
    for (const r of allReceivers(doc)) {
      const label = r.receiving && r.receiving.name;
      const articulated = r.articulation_status === 'articulated';
      const opts = articulated
        ? (r.options || []).map((o) => (o.course_ids || []).map(String)).filter((o) => o.length)
        : [];
      for (const pid of receiverParentIds(r)) {
        if (label && !codeOfParent.has(pid)) codeOfParent.set(pid, label);
        if (articulated) {
          articulatedParents.add(pid);
          if (opts.length && !ccByParent.has(pid)) ccByParent.set(pid, opts);
        }
      }
    }
  }
  const isArticulated = (pid) => pid != null && articulatedParents.has(Number(pid));

  const reqRow = (pid, labelHint) => {
    const label = labelHint || (pid != null ? codeOfParent.get(pid) : null) || null;
    if (pid != null && label && !codeOfParent.has(pid)) codeOfParent.set(pid, label);
    return { parent_id: pid ?? null, uc_code: label, articulated: isArticulated(pid) };
  };

  // WEBSITE side: curated best-set-per-group requirements + the parent_id set the
  // website minimum actually asks for (used to decide what ASSIST adds on top).
  const websiteReqs = []; // { parent_id, uc_code, articulated }
  const websiteParentSet = new Set();
  let wReq = 0; let wArt = 0; let wGroups = 0; let wSat = 0;
  if (model) {
    wGroups = model.groups.size;
    for (const group of model.groups.values()) {
      const sets = [...group.sets.values()].map((set) => {
        const reqs = set.requirements || [];
        const artic = reqs.filter((req) => (req.parent_ids || []).some(isArticulated)).length;
        return { set, total: reqs.length, artic, missing: reqs.length - artic, satisfied: reqs.length > 0 && artic === reqs.length };
      });
      const best = sets.find((s) => s.satisfied)
        || sets.sort((a, b) => a.missing - b.missing || b.artic - a.artic || a.total - b.total)[0];
      if (!best) continue;
      wReq += best.total; wArt += best.artic; if (best.satisfied) wSat += 1;
      for (const req of best.set.requirements || []) {
        const pid = (req.parent_ids || [])[0] ?? null;
        if (pid != null && req.receiving_code && !codeOfParent.has(pid)) codeOfParent.set(pid, req.receiving_code);
        websiteReqs.push({ parent_id: pid, uc_code: req.receiving_code, articulated: (req.parent_ids || []).some(isArticulated) });
        for (const p of req.parent_ids || []) websiteParentSet.add(Number(p));
      }
    }
  }

  // ASSIST side: the choose-N-honored summary + only the courses ASSIST asks for
  // BEYOND the website minimum. A required section is "already covered" when the
  // website minimum provides enough of its alternatives — so a choose-1 section
  // whose one taken alternative is a website course adds nothing (its other
  // alternatives are NOT extra requirements, they are just unchosen options).
  const assistReceiverParents = new Set();
  const extraGroups = []; // { choose, gap, options: [{ parent_id, uc_code, articulated }] }
  let assistPct = null; let assistFully = false; let aReq = 0; let aArt = 0;
  let extraCount = 0; let extraArticulated = 0;
  if (agreement) {
    const groups = prepRequirementGroups(agreement, isExcluded);
    const eligMajor = { requirement_groups: groups };
    assistPct = +calculateMajorCompletionPercentage(eligMajor, allArticulatingCourses(eligMajor), [], true).toFixed(1);
    assistFully = isMajorArticulable(eligMajor, true);
    const counts = chooseNMinimum(groups);
    aReq = counts.required; aArt = counts.satisfiable;
    const inWebsite = (r) => receiverParentIds(r).some((pid) => websiteParentSet.has(pid));
    for (const g of groups) {
      if (!g.is_required) continue;
      for (const s of g.sections || []) {
        const recvs = s.receivers || [];
        if (!recvs.length) continue;
        for (const r of recvs) for (const pid of receiverParentIds(r)) assistReceiverParents.add(pid);
        const ask = s.section_advisement != null
          ? Math.min(s.section_advisement, recvs.length)
          : Math.min(1, recvs.length);
        // How much of this section the website minimum already satisfies.
        const covered = recvs.filter(inWebsite).length;
        const needed = ask - Math.min(covered, ask);
        if (needed <= 0) continue; // website minimum already covers this section
        // The remaining need is met from the alternatives the website doesn't have.
        const options = recvs.filter((r) => !inWebsite(r)).map((r) => {
          const label = (r.receiving && r.receiving.name);
          return reqRow(receiverParentIds(r)[0] ?? null, label);
        });
        const articulatedOpts = options.filter((o) => o.articulated).length;
        extraGroups.push({ choose: needed, gap: articulatedOpts < needed, options });
        extraCount += needed;
        extraArticulated += Math.min(needed, articulatedOpts);
      }
    }
  }
  // Website courses ASSIST doesn't ask for (surfaces "ASSIST requires N fewer").
  for (const r of websiteReqs) r.in_assist = r.parent_id != null && assistReceiverParents.has(Number(r.parent_id));
  const websiteOnly = websiteReqs.filter((r) => r.parent_id != null && !r.in_assist).length;

  // Enrich every emitted row with authoritative UC codes + CC articulating
  // courses. Full catalog rows (title + units) ride along in university_courses
  // / cc_courses so the ledger renders both sides exactly like the ASSIST tab.
  const enrichRows = [...websiteReqs, ...extraGroups.flatMap((g) => g.options)];
  const universityCourses = {}; // parent_id -> { prefix, number, title, min_units, max_units }
  const pids = enrichRows.map((r) => r.parent_id).filter((p) => p != null);
  if (pids.length) {
    const ucRows = await db.collection('assist_courses')
      .find({ side: 'receiving', parent_id: { $in: pids } },
        { projection: { parent_id: 1, prefix: 1, number: 1, title: 1, min_units: 1, max_units: 1, _id: 0 } }).toArray();
    const uniCode = new Map();
    for (const u of ucRows) {
      const pid = Number(u.parent_id);
      if (uniCode.has(pid)) continue;
      const code = [u.prefix, u.number].filter(Boolean).join(' ').trim();
      if (code) uniCode.set(pid, code);
      universityCourses[pid] = u;
    }
    for (const r of enrichRows) {
      const code = r.parent_id != null && uniCode.get(Number(r.parent_id));
      if (code) r.uc_code = code;
    }
  }
  const ccIds = [...new Set([...ccByParent.values()].flat(2))];
  const ccCode = new Map();
  const ccCourses = {}; // code -> { prefix, number, title, units }
  if (ccIds.length) {
    const ccRows = await db.collection('assist_courses')
      .find({ side: 'sending', course_id: { $in: ccIds.map(Number) } },
        { projection: { course_id: 1, prefix: 1, number: 1, title: 1, units: 1, _id: 0 } }).toArray();
    for (const c of ccRows) {
      const code = [c.prefix, c.number].filter(Boolean).join(' ').trim();
      if (code) {
        ccCode.set(String(c.course_id), code);
        if (!ccCourses[code]) ccCourses[code] = { prefix: c.prefix, number: c.number, title: c.title, units: c.units };
      }
    }
  }
  for (const r of enrichRows) {
    const opts = r.parent_id != null ? ccByParent.get(Number(r.parent_id)) : null;
    r.cc_options = (opts || []).map((opt) => opt.map((cid) => ccCode.get(cid) || `#${cid}`));
  }

  const byCode = (a, b) => String(a.uc_code || '~').localeCompare(String(b.uc_code || '~'), undefined, { numeric: true });
  websiteReqs.sort(byCode);
  for (const g of extraGroups) g.options.sort(byCode);
  extraGroups.sort((a, b) => byCode(a.options[0] || {}, b.options[0] || {}));

  return {
    school_id: schoolId,
    school: (agreement && agreement.uc_school) || (model && model.school) || null,
    major,
    community_college_id: communityCollegeId,
    community_college: (agreement && agreement.community_college) || null,
    website: { required: wReq, articulated: wArt, pct: wReq ? +((wArt / wReq) * 100).toFixed(1) : null, fully: wGroups > 0 && wSat === wGroups },
    assist: { required: aReq, articulated: aArt, pct: assistPct, fully: assistFully },
    // Extra = courses ASSIST requires beyond the website minimum (choose-N honored).
    // net_courses = ASSIST minimum size − website minimum size (negative = fewer).
    assist_extra: extraCount,
    assist_extra_articulated: extraArticulated,
    website_only: websiteOnly,
    net_courses: aReq - wReq,
    website_requirements: websiteReqs,
    assist_extra_groups: extraGroups,
    university_courses: universityCourses,
    cc_courses: ccCourses,
  };
}

/**
 * Credit loss — per agreement, the papers' decomposition:
 *   min_cc_courses      — overlap-aware minimal CC course count (optionSolver)
 *   min_cc_units        — those courses' units (CC catalog join)
 *   receivers_required / blocked — how much of the ask is even satisfiable
 *   many_to_one         — receivers whose cheapest path still takes >1 course
 *   semester_equiv_required — required receiver count normalized by the
 *       campus calendar (quarter course = 2/3 semester course), the CA
 *       paper's semester-to-quarter loss axis. Uses institution calendar data.
 */
async function creditLossData(db, auditDb, {
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
} = {}) {
  const curation = await loadCuration(auditDb, majorSlug);
  const refs = await loadRefs(db);
  const units = await loadCcCourseUnits(db);
  const coursesById = await loadCoursesById(db);
  const isExcluded = makeIsExcluded(curation);
  const rows = [];
  for (const sys of systemsFor()) {
    const docs = await db.collection(sys.coll).find(majorFilter({
      majorSlug, majorPrograms, majorContains, visiblePairs,
    }, sys.idField)).toArray();
    for (const doc of docs) {
      const solved = agreementMinSetExact(doc, isExcluded, coursesById);
      const calendar = refs.calendarByUniversity.get(Number(doc[sys.idField])) || null;
      const required = solved.receiversRequired;
      rows.push({
        system: sys.key,
        school_id: doc[sys.idField],
        school: doc[sys.nameField],
        community_college_id: doc.community_college_id,
        community_college: doc.community_college,
        district: refs.districtByCc.get(Number(doc.community_college_id))?.district ?? null,
        district_region: refs.districtByCc.get(Number(doc.community_college_id))?.region ?? null,
        district_counties: refs.districtByCc.get(Number(doc.community_college_id))?.counties_served ?? [],
        major: doc.major,
        receivers_required: required,
        receivers_satisfiable: solved.receiversSatisfiable,
        receivers_blocked: solved.receiversBlocked,
        min_cc_courses: solved.courses.length,
        min_cc_units: +solved.courses
          .reduce((sum, id) => sum + (units.get(id) || 0), 0)
          .toFixed(1),
        many_to_one: manyToOneCount(doc, { isExcluded }),
        campus_calendar: calendar,
        semester_equiv_required: calendar === 'quarter'
          ? +(required * (2 / 3)).toFixed(2)
          : required,
        courses: solved.courses,
      });
    }
  }
  return rows;
}

/**
 * Choice cost — inter-institution misalignment (CA paper Fig. 1's lighter
 * bars). For each CC and the given ORDERED list of schools, the incremental
 * CC courses each additional school demands beyond the union already taken.
 */
async function choiceCostData(db, auditDb, {
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
  schoolIds = [],
} = {}) {
  const curation = await loadCuration(auditDb, majorSlug);
  const isExcluded = makeIsExcluded(curation);
  // agreements grouped per CC, in the requested school order
  const byCc = new Map();
  for (const sys of systemsFor()) {
    const filter = { ...majorFilter({
      majorSlug, majorPrograms, majorContains, visiblePairs,
    }, sys.idField) };
    if (schoolIds.length) filter[sys.idField] = { $in: schoolIds.map(Number) };
    const docs = await db.collection(sys.coll).find(filter).toArray();
    for (const doc of docs) {
      const cc = Number(doc.community_college_id);
      if (!byCc.has(cc)) byCc.set(cc, { community_college: doc.community_college, agreements: [] });
      byCc.get(cc).agreements.push({ sys, doc });
    }
  }

  const coursesById = await loadCoursesById(db);
  const order = schoolIds.map(Number);
  const programOrder = new Map(programPairs(majorPrograms)
    .map((pair, index) => [`${pair.school_id}|${pair.major}`, index]));
  const rows = [];
  for (const [ccId, { community_college, agreements }] of byCc) {
    const taken = new Set();
    const steps = [];
    for (const schoolId of order) {
      // Exact configured scopes normally yield one program per campus. If a
      // future major intentionally configures alternatives, choose by config
      // order (then stable document identity) instead of Mongo return order.
      const entry = agreements
        .filter((a) => Number(a.doc[a.sys.idField]) === schoolId)
        .sort((a, b) => {
          const aRank = programOrder.get(`${schoolId}|${a.doc.major}`) ?? Number.MAX_SAFE_INTEGER;
          const bRank = programOrder.get(`${schoolId}|${b.doc.major}`) ?? Number.MAX_SAFE_INTEGER;
          return aRank - bRank
            || String(a.doc.major).localeCompare(String(b.doc.major))
            || String(a.doc._id || '').localeCompare(String(b.doc._id || ''));
        })[0];
      if (!entry) {
        steps.push({ school_id: schoolId, school: null, has_agreement: false, additional_courses: null });
        continue;
      }
      const solved = agreementMinSetExact(entry.doc, isExcluded, coursesById);
      const additional = solved.courses.filter((id) => !taken.has(id));
      additional.forEach((id) => taken.add(id));
      steps.push({
        school_id: schoolId,
        school: entry.doc[entry.sys.nameField],
        has_agreement: true,
        additional_courses: additional.length,
        blocked_receivers: solved.receiversBlocked,
      });
    }
    rows.push({
      community_college_id: ccId,
      community_college,
      total_courses: taken.size,
      steps,
    });
  }
  return rows;
}

/**
 * Category gaps — the CA paper's course-barrier analysis. Per (school ×
 * canonical category): how many CCs have at least one required receiver in
 * that category, and what share of them are MISSING an articulated
 * equivalent. Requires curation tags; untagged receivers land in category
 * null so the untagged share is visible rather than silently dropped.
 */
async function categoryGapsData(db, auditDb, {
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
} = {}) {
  const curation = await loadCuration(auditDb, majorSlug);
  const isExcluded = makeIsExcluded(curation);
  // key: system|school|category → { ccsWith: Set, ccsMissing: Set }
  const agg = new Map();
  for (const sys of systemsFor()) {
    const docs = await db.collection(sys.coll).find(majorFilter({
      majorSlug, majorPrograms, majorContains, visiblePairs,
    }, sys.idField)).toArray();
    for (const doc of docs) {
      const cc = Number(doc.community_college_id);
      // Walk sections (not a flat receiver list) so choose-N context survives: a
      // category is only a GAP when its section genuinely can't meet its stated
      // minimum via articulations. An unarticulated *optional* alternative in a
      // satisfiable "Complete 1 of …" section is NOT a gap (the heatmap premise fix).
      for (const group of doc.requirement_groups || []) {
        if (!group.is_required) continue;
        for (const section of group.sections || []) {
          const recvs = (section.receivers || []).filter((r) => !isExcluded(r));
          if (!recvs.length) continue;
          const articulated = recvs.filter((r) => r.articulation_status === 'articulated').length;
          const ask = section.section_advisement != null
            ? Math.min(section.section_advisement, recvs.length)
            : Math.min(1, recvs.length); // no advisement → any one satisfies
          const sectionMet = articulated >= ask;
          for (const r of recvs) {
            const category = categoryOfReceiver(r, curation);
            const key = `${sys.key}|${doc[sys.idField]}|${category}`;
            if (!agg.has(key)) {
              agg.set(key, {
                system: sys.key,
                school_id: doc[sys.idField],
                school: doc[sys.nameField],
                category,
                ccsWith: new Set(),
                ccsMissing: new Set(),
              });
            }
            const cell = agg.get(key);
            cell.ccsWith.add(cc);
            if (r.articulation_status !== 'articulated' && !sectionMet) cell.ccsMissing.add(cc);
          }
        }
      }
    }
  }
  return [...agg.values()].map((c) => ({
    system: c.system,
    school_id: c.school_id,
    school: c.school,
    category: c.category,
    ccs_with_requirement: c.ccsWith.size,
    ccs_missing_articulation: c.ccsMissing.size,
    pct_missing: c.ccsWith.size
      ? +((c.ccsMissing.size / c.ccsWith.size) * 100).toFixed(1)
      : null,
  }));
}

/**
 * Curricular complexity (Curricular Analytics-style) over the projected
 * prerequisite concept graph, for the min-set pathway of each agreement.
 *   delay factor    — longest prereq chain through the course
 *   blocking factor — number of courses this course unlocks (descendants)
 *   complexity      — per-course delay + blocking, summed per pathway
 * Edges come from services/prereqGraph (concept rules × course concept tags);
 * coverage counts pathway courses that have been examined (concept_source set).
 */
async function complexityData(db, auditDb, {
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
} = {}) {
  const curation = await loadCuration(auditDb, majorSlug);
  const isExcluded = makeIsExcluded(curation);
  const prereqsByKey = await projectPrereqEdges(db);
  const coursesById = await loadCoursesById(db);

  const rows = [];
  for (const sys of systemsFor()) {
    const docs = await db.collection(sys.coll).find(majorFilter({
      majorSlug, majorPrograms, majorContains, visiblePairs,
    }, sys.idField)).toArray();
    for (const doc of docs) {
      const solved = agreementMinSetExact(doc, isExcluded, coursesById);
      const keys = solved.courses.map((id) => `cc:${id}`);
      const inSet = new Set(keys);
      const parents = (k) => (prereqsByKey.get(k) || []).filter((p) => inSet.has(p));

      // delay: longest chain ending at k (memoized DFS; cycles guard).
      const delayMemo = new Map();
      const delay = (k, seen = new Set()) => {
        if (delayMemo.has(k)) return delayMemo.get(k);
        if (seen.has(k)) return 1;
        seen.add(k);
        const d = 1 + Math.max(0, ...parents(k).map((p) => delay(p, seen)));
        delayMemo.set(k, d);
        return d;
      };
      // blocking: descendants count via reverse edges.
      const children = new Map(keys.map((k) => [k, []]));
      for (const k of keys) for (const p of parents(k)) children.get(p)?.push(k);
      const blocking = (k) => {
        const seen = new Set();
        const stack = [...(children.get(k) || [])];
        while (stack.length) {
          const c = stack.pop();
          if (seen.has(c)) continue;
          seen.add(c);
          stack.push(...(children.get(c) || []));
        }
        return seen.size;
      };

      const perCourse = keys.map((k) => ({ key: k, delay: delay(k), blocking: blocking(k) }));
      const complexity = perCourse.reduce((s, c) => s + c.delay + c.blocking, 0);
      const edges = keys.reduce((s, k) => s + parents(k).length, 0);
      rows.push({
        system: sys.key,
        school_id: doc[sys.idField],
        school: doc[sys.nameField],
        community_college_id: doc.community_college_id,
        community_college: doc.community_college,
        major: doc.major,
        n_courses: keys.length,
        n_prereq_edges: edges,
        prereq_data_coverage_pct: keys.length
          ? +((keys.filter((k) => prereqsByKey.has(k)).length / keys.length) * 100).toFixed(1)
          : null,
        complexity,
        max_delay: perCourse.length ? Math.max(...perCourse.map((c) => c.delay)) : 0,
        per_course: perCourse,
      });
    }
  }
  return rows;
}

/**
 * Time-to-degree / transfer credit rate (MA-paper §4 semantics, applied to
 * curated associate-degree docs). For each curated ADT × matching agreement:
 *   transferable units — units of ADT courses that appear in the agreement's
 *       min-set (i.e. actually count toward the university requirements)
 *   transfer_credit_rate — transferable / total ADT units
 *   lost_units + est. cost — the non-mapping remainder, costed with
 *       institution tuition (per-credit, university side) as the papers do.
 */
async function timeToDegreeData(db, auditDb, {
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
} = {}) {
  const curation = await loadCuration(auditDb, majorSlug);
  const refs = await loadRefs(db);
  const units = await loadCcCourseUnits(db);
  const coursesById = await loadCoursesById(db);
  const isExcluded = makeIsExcluded(curation);
  const degrees = await auditDb.collection('curated_requirements')
    .find({ kind: 'associate_degree', ...majorDocumentFilter(majorSlug) }).toArray();
  const byCc = new Map();
  for (const d of degrees) {
    const cc = Number(d.community_college_id);
    if (!byCc.has(cc)) byCc.set(cc, []);
    byCc.get(cc).push(d);
  }

  const rows = [];
  for (const sys of systemsFor()) {
    const docs = await db.collection(sys.coll).find(majorFilter({
      majorSlug, majorPrograms, majorContains, visiblePairs,
    }, sys.idField)).toArray();
    for (const doc of docs) {
      const ccDegrees = byCc.get(Number(doc.community_college_id)) || [];
      if (!ccDegrees.length) continue;
      const solved = agreementMinSetExact(doc, isExcluded, coursesById);
      const needed = new Set(solved.courses);
      for (const deg of ccDegrees) {
        const degCourses = (deg.course_ids || []).map((id) => String(id).replace(/^cc:/, ''));
        const degUnits = deg.units ?? +degCourses
          .reduce((s, id) => s + (units.get(id) || 0), 0).toFixed(1);
        const transferable = +degCourses
          .filter((id) => needed.has(id))
          .reduce((s, id) => s + (units.get(id) || 0), 0)
          .toFixed(1);
        const lost = Math.max(0, +(degUnits - transferable).toFixed(1));
        const perCredit = refs.tuitionByUniversity.get(Number(doc[sys.idField])) ?? null;
        rows.push({
          system: sys.key,
          school_id: doc[sys.idField],
          school: doc[sys.nameField],
          community_college_id: doc.community_college_id,
          community_college: doc.community_college,
          major: doc.major,
          assoc_degree: deg.name,
          assoc_degree_units: degUnits,
          transferable_units: transferable,
          transfer_credit_rate_pct: degUnits ? +((transferable / degUnits) * 100).toFixed(1) : null,
          lost_units: lost,
          est_lost_cost_usd: perCredit != null ? +(lost * perCredit).toFixed(0) : null,
        });
      }
    }
  }
  return rows;
}

// ── bulk exports (the raw material for custom statistics) ──

/**
 * Every agreement in scope, as stored (full requirement_groups). One call
 * replaces 115 per-college fetches when a script wants the whole corpus.
 */
async function agreementsExportData(db, auditDb, {
  majorSlug = null, majorPrograms = null, majorContains = '', visiblePairs = null,
} = {}) {
  const sys = SYSTEMS[0];
  const docs = await db.collection(sys.coll)
    .find(majorFilter({ majorSlug, majorPrograms, majorContains, visiblePairs }, sys.idField))
    .toArray();
  return docs.map((d) => ({ ...d, _id: String(d._id) }));
}

/**
 * The corpus flattened to ONE ROW PER RECEIVER — the unit of analysis in the
 * transfer-pathway papers. Keeps full option structure (JSON-encoded in CSV)
 * plus the group/section context needed to reconstruct requirement logic
 * (is_required, conjunctions, advisements), so most statistics become a
 * groupby away instead of a tree walk.
 */
async function receiversExportData(db, auditDb, params = {}) {
  const docs = await agreementsExportData(db, auditDb, params);
  const rows = [];
  for (const doc of docs) {
    (doc.requirement_groups || []).forEach((group, gi) => {
      (group.sections || []).forEach((section, si) => {
        (section.receivers || []).forEach((recv, ri) => {
          const receiving = recv.receiving || {};
          rows.push({
            agreement_id: doc._id,
            school_id: doc.uc_school_id,
            school: doc.uc_school,
            community_college_id: doc.community_college_id,
            community_college: doc.community_college,
            major: doc.major,
            group_index: gi,
            is_required: group.is_required !== false,
            group_conjunction: group.group_conjunction ?? null,
            group_advisement: group.group_advisement ?? null,
            group_unit_advisement: group.group_unit_advisement ?? null,
            section_index: si,
            section_advisement: section.section_advisement ?? null,
            section_unit_advisement: section.unit_advisement ?? null,
            receiver_index: ri,
            hash_id: recv.hash_id ?? null,
            kind: receiving.kind ?? null,
            receiving_name: receiving.name ?? null,
            parent_ids: receiving.kind === 'course' ? [receiving.parent_id]
              : receiving.kind === 'series' ? (receiving.parent_ids || [])
              : [],
            ge_code: receiving.code ?? null,
            articulation_status: recv.articulation_status ?? null,
            not_articulated_reason: recv.not_articulated_reason ?? null,
            options_conjunction: recv.options_conjunction ?? null,
            n_options: (recv.options || []).length,
            options: recv.options || [],
          });
        });
      });
    });
  }
  return rows;
}

// Complete CC and UC catalogs in one call each.
async function coursesExportData(db) {
  const rows = await db.collection('assist_courses').find({ side: 'sending' }).toArray();
  return rows.map((r) => ({ ...r, _id: String(r._id) }));
}

async function universityCoursesExportData(db) {
  const rows = await db.collection('assist_courses').find({ side: 'receiving' }).toArray();
  return rows.map((r) => ({ ...r, _id: String(r._id) }));
}

module.exports = {
  coverageData,
  requirementComparisonData,
  creditLossData,
  choiceCostData,
  categoryGapsData,
  complexityData,
  timeToDegreeData,
  agreementsExportData,
  receiversExportData,
  coursesExportData,
  universityCoursesExportData,
  _categoryOfReceiver: categoryOfReceiver,
  _chooseNMinimum: chooseNMinimum,
  _agreementMinSetExact: agreementMinSetExact,
  _settingsMajors: settingsMajors,
  _canonicalCsPrograms: CANONICAL_CS_PROGRAMS,
  // Temporary private alias for downstream tests/tools that imported the old
  // name. Its value is canonical now; there is no historical union remaining.
  _paperMajors: CANONICAL_CS_PROGRAMS,
};
