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
const { agreementMinSet, manyToOneCount } = require('./optionSolver');

const SYSTEMS = [
  { key: 'uc', coll: 'uc_agreements', idField: 'uc_school_id', nameField: 'uc_school' },
  { key: 'csu', coll: 'csu_agreements', idField: 'csu_school_id', nameField: 'csu_school' },
];

const systemsFor = (scope) => SYSTEMS.filter((s) => !scope || scope === 'all' || s.key === scope);

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
    districtByCc: new Map(districts.map((r) => [Number(r._id), r.district])),
  };
}

async function loadCcCourseUnits(db) {
  const rows = await db.collection('courses')
    .find({}, { projection: { course_id: 1, units: 1 } }).toArray();
  return new Map(rows.map((r) => [String(r.course_id), Number(r.units) || 0]));
}

const majorFilter = (majorContains) =>
  majorContains ? { major: { $regex: escapeRegex(majorContains), $options: 'i' } } : {};

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── analyses ──

/**
 * Coverage — the CA/MA papers' core figure. One row per agreement:
 * how many required receivers exist, how many are articulated, and whether
 * the CC fully articulates the school's requirements ("full articulation").
 */
async function coverageData(db, auditDb, { scope = 'all', majorContains = '' } = {}) {
  const curation = await loadCuration(auditDb);
  const isExcluded = makeIsExcluded(curation);
  const rows = [];
  for (const sys of systemsFor(scope)) {
    const docs = await db.collection(sys.coll).find(majorFilter(majorContains)).toArray();
    for (const doc of docs) {
      let total = 0;
      let articulated = 0;
      for (const r of requiredReceivers(doc, isExcluded)) {
        total += 1;
        if (r.articulation_status === 'articulated') articulated += 1;
      }
      rows.push({
        system: sys.key,
        school_id: doc[sys.idField],
        school: doc[sys.nameField],
        community_college_id: doc.community_college_id,
        community_college: doc.community_college,
        major: doc.major,
        receivers_required: total,
        receivers_articulated: articulated,
        pct_articulated: total ? +((articulated / total) * 100).toFixed(1) : null,
        fully_articulated: total > 0 && articulated === total,
      });
    }
  }
  return rows;
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
async function creditLossData(db, auditDb, { scope = 'all', majorContains = '' } = {}) {
  const curation = await loadCuration(auditDb);
  const refs = await loadRefs(auditDb);
  const units = await loadCcCourseUnits(db);
  const isExcluded = makeIsExcluded(curation);
  const rows = [];
  for (const sys of systemsFor(scope)) {
    const docs = await db.collection(sys.coll).find(majorFilter(majorContains)).toArray();
    for (const doc of docs) {
      const solved = agreementMinSet(doc, { isExcluded });
      const calendar = refs.calendarByUniversity.get(Number(doc[sys.idField])) || null;
      const required = solved.receiversConsidered;
      rows.push({
        system: sys.key,
        school_id: doc[sys.idField],
        school: doc[sys.nameField],
        community_college_id: doc.community_college_id,
        community_college: doc.community_college,
        district: refs.districtByCc.get(Number(doc.community_college_id)) ?? null,
        major: doc.major,
        receivers_required: required,
        receivers_satisfiable: solved.receiversSatisfied,
        receivers_blocked: solved.blockedReceivers.length,
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
async function choiceCostData(db, auditDb, { scope = 'all', majorContains = '', schoolIds = [] } = {}) {
  const curation = await loadCuration(auditDb);
  const isExcluded = makeIsExcluded(curation);
  // agreements grouped per CC, in the requested school order
  const byCc = new Map();
  for (const sys of systemsFor(scope)) {
    const filter = { ...majorFilter(majorContains) };
    if (schoolIds.length) filter[sys.idField] = { $in: schoolIds.map(Number) };
    const docs = await db.collection(sys.coll).find(filter).toArray();
    for (const doc of docs) {
      const cc = Number(doc.community_college_id);
      if (!byCc.has(cc)) byCc.set(cc, { community_college: doc.community_college, agreements: [] });
      byCc.get(cc).agreements.push({ sys, doc });
    }
  }

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
      const solved = agreementMinSet(entry.doc, { isExcluded });
      const additional = solved.courses.filter((id) => !taken.has(id));
      additional.forEach((id) => taken.add(id));
      steps.push({
        school_id: schoolId,
        school: entry.doc[entry.sys.nameField],
        has_agreement: true,
        additional_courses: additional.length,
        blocked_receivers: solved.blockedReceivers.length,
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
async function categoryGapsData(db, auditDb, { scope = 'all', majorContains = '' } = {}) {
  const curation = await loadCuration(auditDb);
  const isExcluded = makeIsExcluded(curation);
  // key: system|school|category → { ccsWith: Set, ccsMissing: Set }
  const agg = new Map();
  for (const sys of systemsFor(scope)) {
    const docs = await db.collection(sys.coll).find(majorFilter(majorContains)).toArray();
    for (const doc of docs) {
      const cc = Number(doc.community_college_id);
      for (const r of requiredReceivers(doc, isExcluded)) {
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
        if (r.articulation_status !== 'articulated') cell.ccsMissing.add(cc);
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
async function complexityData(db, auditDb, { scope = 'all', majorContains = '' } = {}) {
  const curation = await loadCuration(auditDb);
  const isExcluded = makeIsExcluded(curation);
  const prereqDocs = await auditDb.collection('curation_prereqs').find().toArray();
  const prereqsByKey = new Map(prereqDocs.map((d) => [String(d._id), (d.prereqs || []).map(String)]));

  const rows = [];
  for (const sys of systemsFor(scope)) {
    const docs = await db.collection(sys.coll).find(majorFilter(majorContains)).toArray();
    for (const doc of docs) {
      const solved = agreementMinSet(doc, { isExcluded });
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
async function timeToDegreeData(db, auditDb, { scope = 'all', majorContains = '' } = {}) {
  const curation = await loadCuration(auditDb);
  const refs = await loadRefs(auditDb);
  const units = await loadCcCourseUnits(db);
  const isExcluded = makeIsExcluded(curation);
  const degrees = await auditDb.collection('curation_assoc_degrees').find().toArray();
  const byCc = new Map();
  for (const d of degrees) {
    const cc = Number(d.community_college_id);
    if (!byCc.has(cc)) byCc.set(cc, []);
    byCc.get(cc).push(d);
  }

  const rows = [];
  for (const sys of systemsFor(scope)) {
    const docs = await db.collection(sys.coll).find(majorFilter(majorContains)).toArray();
    for (const doc of docs) {
      const ccDegrees = byCc.get(Number(doc.community_college_id)) || [];
      if (!ccDegrees.length) continue;
      const solved = agreementMinSet(doc, { isExcluded });
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

module.exports = {
  coverageData,
  creditLossData,
  choiceCostData,
  categoryGapsData,
  complexityData,
  timeToDegreeData,
  _categoryOfReceiver: categoryOfReceiver,
};
