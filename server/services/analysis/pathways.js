/**
 * DB-coupled analysis layer — computes the transfer-pathway statistics the
 * research project replicates from the CA/MA SIGCSE papers, over the research
 * dataset + the curation layer.
 *
 * Everything here works on REQUIRED requirement groups by default, honors
 * curation receiver-overrides (exclude), and reports course categories via
 * `curation_course_categories` (university parent_id → canonical category)
 * with `curation_receiver_overrides` as the fallback for non-course
 * receivers. Methodological choices mirror the papers' best-case-scenario
 * framing; see optionSolver.js for the min-set semantics.
 */
const { manyToOneCount } = require('./optionSolver');
const { selectMissingAcrossMajorsOptimal } = require('./minCourses');
const { isMajorArticulable, calculateMajorCompletionPercentage, allArticulatingCourses } = require('./eligibility');

// UC-only: the research project studies UC transfer pathways exclusively.
const SYSTEMS = [
  { key: 'uc', coll: 'uc_agreements', idField: 'uc_school_id', nameField: 'uc_school' },
];

const systemsFor = () => SYSTEMS;

// ── curation joins ──

async function loadCuration(auditDb) {
  const [cats, overrides] = await Promise.all([
    auditDb.collection('curation_course_categories').find().toArray(),
    auditDb.collection('curation_receiver_overrides').find().toArray(),
  ]);
  return {
    categoryByParent: new Map(cats.map((c) => [Number(c._id), c])),
    overrideByHash: new Map(overrides.map((o) => [String(o._id), o])),
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

async function loadRefs(auditDb) {
  const [cal, tuition, districts] = await Promise.all([
    auditDb.collection('ref_campus_calendars').find().toArray(),
    auditDb.collection('ref_tuition').find().toArray(),
    auditDb.collection('ref_cc_districts').find().toArray(),
  ]);
  return {
    calendarByUniversity: new Map(cal.map((r) => [Number(r._id), r.system])),
    tuitionByUniversity: new Map(tuition.map((r) => [Number(r._id), Number(r.per_credit_usd)])),
    districtByCc: new Map(districts.map((r) => [Number(r._id), {
      district: r.district ?? null,
      region: r.region ?? null,
      counties_served: Array.isArray(r.counties_served) ? r.counties_served : [],
    }])),
  };
}

async function loadCcCourseUnits(db) {
  const rows = await db.collection('courses')
    .find({}, { projection: { course_id: 1, units: 1 } }).toArray();
  return new Map(rows.map((r) => [String(r.course_id), Number(r.units) || 0]));
}

// CC-course catalog (units + same_as) keyed by stringified course_id — the
// optimizer's coursesById. String keys match the stringified option ids below.
async function loadCoursesById(db) {
  const rows = await db.collection('courses')
    .find({}, { projection: { course_id: 1, units: 1, same_as: 1 } }).toArray();
  const m = new Map();
  for (const r of rows) {
    m.set(String(r.course_id), {
      course_id: String(r.course_id),
      units: r.units,
      same_as: (r.same_as || []).map((p) => ({ course_id: String(p.course_id) })),
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

async function loadTransferRequirements(auditDb) {
  const rows = await auditDb.collection('ref_uc_transfer_requirements')
    .find({}, { projection: {
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

// Combined major scope: the optional contains-search AND the partner
// visibility pair-allowlist (null = admin, unrestricted). Visibility is per
// (school, major) pair — see services/majorVisibility.js.
const { pairClause } = require('../majorVisibility');
// The exact ASSIST program the paper scraped per campus (paper repo
// cs_urls/). The paper-port figures pin to these stored names and IGNORE
// partner visibility scoping — they are fixed aggregate research figures, and
// an admin toggling visible majors (e.g. to UCB's EECS B.S.) must never
// change them. Keep in sync with analysis/paper_credit_loss.PAPER_MAJORS.
const PAPER_MAJORS = {
  89: ['Computer Science & Engineering B.S.', 'Computer Science B.S.'],
  144: ['APPLIED MATHEMATICAL SCIENCES, Computer Science Emphasis, B.S.',
    'COMPUTER SCIENCE AND ENGINEERING, B.S. '], // trailing space is stored
  7: ['CSE: Computer Science B.S.',
    'CSE: Computer Science with a Specialization in Bioinformatics B.S.',
    'Mathematics/Computer Science B.S.'],
  128: ['Computer Science, B.S.'],
  117: ['Computer Science and Engineering/B.S.', 'Computer Science/B.S.',
    'Linguistics and Computer Science/B.A.'],
  // UCB needs BOTH: ASSIST moved its paper-era CS math articulations onto
  // the EECS page — single-program pinning breaks paper replication.
  79: ['Computer Science, B.A.', 'Electrical Engineering & Computer Sciences, B.S.'],
  132: ['Computer Science B.A.', 'Computer Science B.S.', 'Computer Science Minor',
    'Computer Science: Computer Game Design B.S.'],
  120: ['Computer Science and Engineering, B.S.', 'Computer Science, B.S.'],
  46: ['Computer Science with Business Applications B.S.', 'Computer Science, B.S.'],
};

function paperMajorsQuery(idField = 'uc_school_id') {
  return { $or: Object.entries(PAPER_MAJORS).map(([sid, majors]) => ({ [idField]: Number(sid), major: { $in: majors } })) };
}

function majorFilter(majorContains, visiblePairs = null, idField = 'uc_school_id') {
  const clauses = [];
  if (majorContains) clauses.push({ major: { $regex: escapeRegex(majorContains), $options: 'i' } });
  if (visiblePairs != null) clauses.push(pairClause(visiblePairs, idField));
  if (!clauses.length) return {};
  return clauses.length === 1 ? clauses[0] : { $and: clauses };
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
  }

  return {
    receivers_required: receiversRequired,
    receivers_articulated: receiversArticulated,
    requirement_groups_required: groupCount,
    requirement_groups_satisfied: groupsSatisfied,
    pct_articulated: receiversRequired ? +((receiversArticulated / receiversRequired) * 100).toFixed(1) : null,
    fully_articulated: groupCount > 0 && groupsSatisfied === groupCount,
  };
}

async function hardRequirementCoverageData(db, auditDb, { majorContains = '', visiblePairs = null, groupBy = 'college', pin = null } = {}, refs) {
  const mode = ['college', 'district', 'county'].includes(groupBy) ? groupBy : 'college';
  const requirementsBySchool = await loadTransferRequirements(auditDb);
  const buckets = new Map();

  for (const sys of systemsFor()) {
    // pin==='paper' (the paper-style figures): exact scraped programs, no
    // visibility scoping. Otherwise the normal major/visibility filter.
    const query = pin === 'paper' ? paperMajorsQuery(sys.idField) : majorFilter(majorContains, visiblePairs, sys.idField);
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
      requirements_source: 'ref_uc_transfer_requirements',
      uc_code: b.requirementsModel.uc_code,
      row_group_kind: b.row_group_kind,
      row_group_key: b.row_group_key,
      row_group_label: b.row_group_label,
      ...evaluated,
    };
  });
}

async function coverageData(db, auditDb, { majorContains = '', visiblePairs = null, groupBy = 'college', requirements = 'assist', pin = null } = {}) {
  const refs = await loadRefs(auditDb);
  if (requirements === 'paper') {
    return hardRequirementCoverageData(db, auditDb, { majorContains, visiblePairs, groupBy, pin }, refs);
  }

  const curation = await loadCuration(auditDb);
  const isExcluded = makeIsExcluded(curation);
  const buckets = new Map();
  const mode = ['college', 'district', 'county'].includes(groupBy) ? groupBy : 'college';

  for (const sys of systemsFor()) {
    // pin==='paper' (the paper-style figures): exact scraped programs,
    // visibility scoping deliberately not applied — see PAPER_MAJORS.
    const query = pin === 'paper' ? paperMajorsQuery(sys.idField) : majorFilter(majorContains, visiblePairs, sys.idField);
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
  const [requirementsBySchool, curation] = await Promise.all([
    loadTransferRequirements(auditDb),
    loadCuration(auditDb),
  ]);
  const model = requirementsBySchool.get(schoolId);
  const isExcluded = makeIsExcluded(curation);

  // All of the college's agreements at this campus, then pick the chosen major
  // tolerant of stored whitespace — some ASSIST program names carry a trailing
  // space (e.g. UC Merced's "...B.S. "), so an exact/trimmed query would miss.
  const collegeAll = await db.collection('uc_agreements').find(
    { uc_school_id: schoolId, community_college_id: communityCollegeId },
    { projection: { requirement_groups: 1, community_college: 1, uc_school: 1, major: 1 } }).toArray();
  const wantedMajor = String(major || '').trim();
  const agreement = collegeAll.find((a) => String(a.major || '').trim() === wantedMajor) || null;
  // Articulation reality: the college's CS agreements for this campus.
  const collegeDocs = collegeAll.filter((a) => /computer science/i.test(a.major || ''));

  // College-level articulation: every UC parent_id this CC articulates for this
  // campus (union across its CS agreements), plus a parent_id -> UC code label
  // and the articulating CC course_ids (options as OR-of-AND, the specific
  // agreement preferred so the CC courses match the ledger shown next door).
  const articulatedParents = new Set();
  const codeOfParent = new Map();
  const ccByParent = new Map(); // parent_id -> string[][] (options -> CC course_id strings)
  const orderedDocs = agreement ? [agreement, ...collegeDocs] : collegeDocs;
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

  // Enrich every emitted row with authoritative UC codes + CC articulating courses.
  const enrichRows = [...websiteReqs, ...extraGroups.flatMap((g) => g.options)];
  const pids = enrichRows.map((r) => r.parent_id).filter((p) => p != null);
  if (pids.length) {
    const ucRows = await db.collection('university_courses')
      .find({ parent_id: { $in: pids } }, { projection: { parent_id: 1, prefix: 1, number: 1 } }).toArray();
    const uniCode = new Map();
    for (const u of ucRows) {
      const pid = Number(u.parent_id);
      if (uniCode.has(pid)) continue;
      const code = [u.prefix, u.number].filter(Boolean).join(' ').trim();
      if (code) uniCode.set(pid, code);
    }
    for (const r of enrichRows) {
      const code = r.parent_id != null && uniCode.get(Number(r.parent_id));
      if (code) r.uc_code = code;
    }
  }
  const ccIds = [...new Set([...ccByParent.values()].flat(2))];
  const ccCode = new Map();
  if (ccIds.length) {
    const ccRows = await db.collection('courses')
      .find({ course_id: { $in: ccIds.map(Number) } }, { projection: { course_id: 1, prefix: 1, number: 1 } }).toArray();
    for (const c of ccRows) {
      const code = [c.prefix, c.number].filter(Boolean).join(' ').trim();
      if (code) ccCode.set(String(c.course_id), code);
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
 *       paper's semester-to-quarter loss axis. Needs ref_campus_calendars.
 */
async function creditLossData(db, auditDb, { majorContains = '', visiblePairs = null } = {}) {
  const curation = await loadCuration(auditDb);
  const refs = await loadRefs(auditDb);
  const units = await loadCcCourseUnits(db);
  const coursesById = await loadCoursesById(db);
  const isExcluded = makeIsExcluded(curation);
  const rows = [];
  for (const sys of systemsFor()) {
    const docs = await db.collection(sys.coll).find(majorFilter(majorContains, visiblePairs, sys.idField)).toArray();
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
async function choiceCostData(db, auditDb, { majorContains = '', visiblePairs = null, schoolIds = [] } = {}) {
  const curation = await loadCuration(auditDb);
  const isExcluded = makeIsExcluded(curation);
  // agreements grouped per CC, in the requested school order
  const byCc = new Map();
  for (const sys of systemsFor()) {
    const filter = { ...majorFilter(majorContains, visiblePairs, sys.idField) };
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
  const rows = [];
  for (const [ccId, { community_college, agreements }] of byCc) {
    const taken = new Set();
    const steps = [];
    for (const schoolId of order) {
      const entry = agreements.find((a) => Number(a.doc[a.sys.idField]) === schoolId);
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
async function categoryGapsData(db, auditDb, { majorContains = '', visiblePairs = null } = {}) {
  const curation = await loadCuration(auditDb);
  const isExcluded = makeIsExcluded(curation);
  // key: system|school|category → { ccsWith: Set, ccsMissing: Set }
  const agg = new Map();
  for (const sys of systemsFor()) {
    const docs = await db.collection(sys.coll).find(majorFilter(majorContains, visiblePairs, sys.idField)).toArray();
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
 * Curricular complexity (Curricular Analytics-style) over the curated
 * prerequisite graph, for the min-set pathway of each agreement.
 *   delay factor    — longest prereq chain through the course
 *   blocking factor — number of courses this course unlocks (descendants)
 *   complexity      — per-course delay + blocking, summed per pathway
 * Only CC-side courses (`cc:<course_id>` keys in curation_prereqs) are in
 * scope for v1 — that's the pathway the transfer student actually schedules.
 */
async function complexityData(db, auditDb, { majorContains = '', visiblePairs = null } = {}) {
  const curation = await loadCuration(auditDb);
  const isExcluded = makeIsExcluded(curation);
  const prereqDocs = await auditDb.collection('curation_prereqs').find().toArray();
  const prereqsByKey = new Map(prereqDocs.map((d) => [String(d._id), (d.prereqs || []).map(String)]));
  const coursesById = await loadCoursesById(db);

  const rows = [];
  for (const sys of systemsFor()) {
    const docs = await db.collection(sys.coll).find(majorFilter(majorContains, visiblePairs, sys.idField)).toArray();
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
 *       ref_tuition (per-credit, university side) as the papers do.
 */
async function timeToDegreeData(db, auditDb, { majorContains = '', visiblePairs = null } = {}) {
  const curation = await loadCuration(auditDb);
  const refs = await loadRefs(auditDb);
  const units = await loadCcCourseUnits(db);
  const coursesById = await loadCoursesById(db);
  const isExcluded = makeIsExcluded(curation);
  const degrees = await auditDb.collection('curation_assoc_degrees').find().toArray();
  const byCc = new Map();
  for (const d of degrees) {
    const cc = Number(d.community_college_id);
    if (!byCc.has(cc)) byCc.set(cc, []);
    byCc.get(cc).push(d);
  }

  const rows = [];
  for (const sys of systemsFor()) {
    const docs = await db.collection(sys.coll).find(majorFilter(majorContains, visiblePairs, sys.idField)).toArray();
    for (const doc of docs) {
      const ccDegrees = byCc.get(Number(doc.community_college_id)) || [];
      if (!ccDegrees.length) continue;
      const solved = agreementMinSetExact(doc, isExcluded, coursesById);
      const needed = new Set(solved.courses);
      for (const deg of ccDegrees) {
        const degCourses = (deg.course_ids || []).map(String);
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
async function agreementsExportData(db, auditDb, { majorContains = '', visiblePairs = null } = {}) {
  const sys = SYSTEMS[0];
  const docs = await db.collection(sys.coll)
    .find(majorFilter(majorContains, visiblePairs, sys.idField))
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

// Whole (referenced-only) catalogs in one call each.
async function coursesExportData(db) {
  const rows = await db.collection('courses').find().toArray();
  return rows.map((r) => ({ ...r, _id: String(r._id) }));
}

async function universityCoursesExportData(db) {
  const rows = await db.collection('university_courses').find().toArray();
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
};
