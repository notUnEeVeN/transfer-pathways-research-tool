/**
 * Read-time projection of the prerequisite concept graph onto per-college
 * course edges (spec: docs/superpowers/specs/2026-07-15-prerequisite-concept-graph-design.md §2).
 *
 * Nothing is materialized: concepts (curated_requirements, kind prereq_concept)
 * carry the normative rules as a `requires` adjacency list; sending courses
 * carry a `concept` tag. At college C, course X requires course Y iff X's
 * concept requires Y's concept and C offers a course for it — with transitive
 * fallback when C lacks a required concept entirely.
 */

const CONCEPT_KIND = 'prereq_concept';

const courseKeyOf = (row) => `cc:${row.course_id}`;
const collegeKeyOf = (row) => String(row.institution_id ?? `cc:${row.community_college_id}`);

async function loadConceptRows(db) {
  return db.collection('curated_requirements')
    .find({ kind: CONCEPT_KIND })
    .sort({ discipline: 1, slug: 1 })
    .toArray();
}

// Pure projection. courseRows must all carry course_id + a college key; only
// rows with concept_source present count as examined. Returns
// Map<'cc:<course_id>', ['cc:<course_id>', …]> with an entry per examined
// course — the same Map contract complexityData used for curated_prerequisites.
function projectEdges(conceptRows, courseRows) {
  const requires = new Map(conceptRows.map((c) => [String(c.slug), (c.requires || []).map(String)]));
  // Combined-course concepts (e.g. linear_alg_diff_eq) list the concepts they
  // stand in for via `satisfies`; their courses register locally under those
  // slugs too, so downstream requirements find them.
  const satisfies = new Map(conceptRows.map((c) => [String(c.slug), (c.satisfies || []).map(String)]));
  const byCollege = new Map();
  for (const row of courseRows) {
    if (row.concept_source === undefined) continue;
    const college = collegeKeyOf(row);
    if (!byCollege.has(college)) byCollege.set(college, []);
    byCollege.get(college).push(row);
  }

  const edges = new Map();
  for (const rows of byCollege.values()) {
    const localBySlug = new Map();
    for (const row of rows) {
      if (!row.concept) continue;
      for (const slug of [row.concept, ...(satisfies.get(row.concept) || [])]) {
        if (!localBySlug.has(slug)) localBySlug.set(slug, []);
        localBySlug.get(slug).push(courseKeyOf(row));
      }
    }
    // Required concepts with no local course fall through to their own
    // requirements (validated acyclic, so this terminates).
    const resolve = (slug, seen) => {
      const out = [];
      for (const req of requires.get(slug) || []) {
        if (seen.has(req)) continue;
        seen.add(req);
        const local = localBySlug.get(req);
        if (local && local.length) out.push(...local);
        else out.push(...resolve(req, seen));
      }
      return out;
    };
    for (const row of rows) {
      const key = courseKeyOf(row);
      if (!row.concept) { edges.set(key, []); continue; }
      const prereqs = [...new Set(resolve(row.concept, new Set([row.concept])))]
        .filter((k) => k !== key);
      edges.set(key, prereqs);
    }
  }
  return edges;
}

async function loadExaminedCourses(db, collegeKey = null) {
  const filter = { side: 'sending', concept_source: { $exists: true } };
  if (collegeKey) filter.institution_id = collegeKey;
  return db.collection('assist_courses').find(filter, {
    projection: {
      course_id: 1, institution_id: 1, community_college_id: 1, prefix: 1, number: 1,
      title: 1, units: 1, concept: 1, concept_source: 1, concept_confidence: 1, concept_note: 1,
    },
  }).toArray();
}

async function projectPrereqEdges(db) {
  const [concepts, courses] = await Promise.all([loadConceptRows(db), loadExaminedCourses(db)]);
  return projectEdges(concepts, courses);
}

// Distinct numeric CC course ids in agreement options, optionally one college.
async function inScopeCourseIds(db, collegeKey = null) {
  const ids = new Set();
  const cursor = db.collection('assist_agreements')
    .find(collegeKey ? { college_id: collegeKey } : {}, { projection: { requirement_groups: 1 } });
  for await (const doc of cursor) {
    for (const g of doc.requirement_groups || [])
      for (const s of g.sections || [])
        for (const r of s.receivers || [])
          for (const o of r.options || [])
            for (const cid of o.course_ids || []) ids.add(Number(cid));
  }
  return ids;
}

async function prerequisiteGraphData(db, { collegeKey = null } = {}) {
  const conceptRows = await loadConceptRows(db);
  const concepts = conceptRows.map((c) => ({
    slug: String(c.slug), name: c.name || c.slug, discipline: c.discipline || 'other',
    requires: (c.requires || []).map(String),
    satisfies: (c.satisfies || []).map(String),
    note: c.note || '',
  }));
  const rules = concepts.flatMap((c) => c.requires.map((from) => ({ from, to: c.slug })));
  const inScope = await inScopeCourseIds(db, collegeKey);

  if (!collegeKey) {
    // in_scope counts agreement-referenced courses present in the catalog (phantoms excluded)
    const [examined, inCatalog] = await Promise.all([
      db.collection('assist_courses')
        .countDocuments({ side: 'sending', concept_source: { $exists: true } }),
      inScope.size
        ? db.collection('assist_courses')
          .countDocuments({ side: 'sending', course_id: { $in: [...inScope] } })
        : Promise.resolve(0),
    ]);
    return { concepts, rules, stats: { in_scope: inCatalog, examined } };
  }

  // College view: every course that is in scope OR already examined.
  const catalog = await db.collection('assist_courses').find(
    { side: 'sending', institution_id: collegeKey },
    { projection: {
      course_id: 1, institution_id: 1, community_college_id: 1, prefix: 1, number: 1,
      title: 1, units: 1, concept: 1, concept_source: 1, concept_confidence: 1, concept_note: 1,
    } }
  ).toArray();
  const byNumericId = new Map(catalog.map((row) => [Number(row.course_id), row]));
  const phantom = [...inScope].filter((id) => !byNumericId.has(id)).sort((a, b) => a - b);
  const rows = catalog.filter((row) =>
    inScope.has(Number(row.course_id)) || row.concept_source !== undefined);

  const edgeMap = projectEdges(conceptRows, rows);
  const edges = [];
  for (const [to, froms] of edgeMap) for (const from of froms) edges.push({ from, to });

  const courses = rows.map((row) => ({
    key: courseKeyOf(row),
    prefix: row.prefix ?? null, number: row.number ?? null, title: row.title ?? null,
    units: row.units ?? null,
    concept: row.concept ?? null,
    concept_source: row.concept_source ?? null,
    concept_confidence: row.concept_confidence ?? null,
    concept_note: row.concept_note ?? null,
    in_scope: inScope.has(Number(row.course_id)),
  })).sort((a, b) => String(a.prefix).localeCompare(String(b.prefix))
    || String(a.number).localeCompare(String(b.number)));

  const examined = rows.filter((r) => r.concept_source !== undefined).length;
  const mapped = rows.filter((r) => r.concept).length;
  const stats = {
    // in_scope counts agreement-referenced courses present in the catalog (phantoms excluded)
    in_scope: inScope.size - phantom.length, examined, mapped,
    edges: edges.length, phantom_course_ids: phantom,
  };

  // Legacy overlap: previous group's rows for this college vs our projection,
  // over courses present in both (reference signal, not golden — spec §1C).
  const legacyRows = await db.collection('curated_prerequisites')
    .find({ institution_id: collegeKey }).toArray();
  let legacy = null;
  if (legacyRows.length) {
    let compared = 0; let legacyEdges = 0; let projectedEdges = 0; let shared = 0;
    for (const row of legacyRows) {
      const key = String(row.course_id || row._id);
      if (!edgeMap.has(key)) continue;
      compared += 1;
      const ours = new Set(edgeMap.get(key));
      const theirs = new Set((row.prerequisite_ids || []).map(String));
      legacyEdges += theirs.size;
      projectedEdges += ours.size;
      for (const e of theirs) if (ours.has(e)) shared += 1;
    }
    legacy = {
      courses_compared: compared, legacy_edges: legacyEdges,
      projected_edges: projectedEdges, shared_edges: shared,
    };
  }

  return { concepts, rules, stats, courses, edges, legacy };
}

module.exports = { projectEdges, projectPrereqEdges, prerequisiteGraphData };
