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
const { getMajor, programPairClause } = require('../config/majors');

// Sending (community college) and receiving (university) courses live in one
// collection and are keyed apart, so a projected graph can hold both without
// collision: a transfer pathway is addressed by `cc:` ids and a university's own
// curriculum by `university:` ids. Sending rows keep the key they always had.
const courseKeyOf = (row) => (row.side === 'receiving'
  ? `university:${row.parent_id}`
  : `cc:${row.course_id}`);
const collegeKeyOf = (row) => String(row.institution_id ?? `cc:${row.community_college_id}`);

async function loadConceptRows(db) {
  return db.collection('curated_requirements')
    .find({ kind: CONCEPT_KIND })
    .sort({ discipline: 1, slug: 1 })
    .toArray();
}

// A major names the concepts its prerequisite view starts from. Keep every
// transitive prerequisite, and keep combined-course concepts that can satisfy
// any included concept (plus all of that compound's constituents/rules). When
// an older major config has no explicit template, preserve the historical
// all-concepts response.
function conceptRowsForMajor(conceptRows, major) {
  if (!major || !Array.isArray(major.prerequisiteConcepts)) return conceptRows;

  const bySlug = new Map(conceptRows.map((row) => [String(row.slug), row]));
  const included = new Set(major.prerequisiteConcepts.map(String));
  let changed = true;
  while (changed) {
    changed = false;
    for (const slug of [...included]) {
      const row = bySlug.get(slug);
      if (!row) continue;
      const related = [
        ...(row.requires || []).flatMap((entry) => (Array.isArray(entry) ? entry : [entry])),
        ...(row.satisfies || []),
      ].map(String);
      for (const next of related) {
        if (!included.has(next)) { included.add(next); changed = true; }
      }
    }
    for (const row of conceptRows) {
      const slug = String(row.slug);
      if (included.has(slug)) continue;
      if ((row.satisfies || []).map(String).some((satisfied) => included.has(satisfied))) {
        included.add(slug);
        changed = true;
      }
    }
  }
  return conceptRows.filter((row) => included.has(String(row.slug)));
}

// Pure projection. courseRows must all carry course_id + a college key; only
// rows with concept_source present count as examined. Returns
// Map<'cc:<course_id>', ['cc:<course_id>', …]> with an entry per examined
// course — the same Map contract complexityData used for curated_prerequisites.
function projectEdges(conceptRows, courseRows) {
  // A `requires` entry is either a slug string (an AND requirement) or an array
  // of slugs (an OR-group — any one alternative satisfies it).
  const requires = new Map(conceptRows.map((c) => [String(c.slug), c.requires || []]));
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
    const langOf = new Map();
    for (const row of rows) {
      if (!row.concept) continue;
      if (row.language) langOf.set(courseKeyOf(row), String(row.language));
      for (const slug of [row.concept, ...(satisfies.get(row.concept) || [])]) {
        if (!localBySlug.has(slug)) localBySlug.set(slug, []);
        localBySlug.get(slug).push(courseKeyOf(row));
      }
    }
    // Language-aware pick: a language-tagged course (e.g. Advanced Java) takes
    // only same-language or untagged prerequisites, so Intro Java feeds it but
    // Intro Python doesn't. Falls back to all candidates if none match, so a
    // tagged course is never left without a prerequisite it clearly needs.
    const pickLocal = (req, lang) => {
      const all = localBySlug.get(req) || [];
      if (!lang) return all;
      const same = all.filter((k) => !langOf.get(k) || langOf.get(k) === lang);
      return same.length ? same : all;
    };
    // A single required concept resolves to the college's courses for it, or
    // falls through to that concept's own prerequisites when the college offers
    // none (validated acyclic, so this terminates).
    const resolveReq = (req, seen, lang) => {
      if (seen.has(req)) return [];
      const local = pickLocal(req, lang);
      if (local.length) return local;
      return resolveList(requires.get(req) || [], new Set([...seen, req]), lang);
    };
    // An OR-group is satisfied by the first listed alternative the college can
    // resolve; a plain entry is an AND requirement.
    const resolveList = (reqList, seen, lang) => {
      const out = [];
      for (const entry of reqList) {
        if (Array.isArray(entry)) {
          for (const alt of entry) {
            const got = resolveReq(String(alt), seen, lang);
            if (got.length) { out.push(...got); break; }
          }
        } else {
          out.push(...resolveReq(String(entry), seen, lang));
        }
      }
      return out;
    };
    for (const row of rows) {
      const key = courseKeyOf(row);
      if (!row.concept) { edges.set(key, []); continue; }
      const prereqs = [...new Set(
        resolveList(requires.get(row.concept) || [], new Set([row.concept]), row.language || null),
      )].filter((k) => k !== key);
      edges.set(key, prereqs);
    }
  }
  return edges;
}

// Structured sibling of projectEdges for schedulers. Each course maps to an
// ALL-of list whose entries are ANY-of local course ids. projectEdges flattens
// these alternatives for graph display; doing that in a scheduler would make
// interchangeable honors/language variants look simultaneously required.
//
// Example: circuits requiring physics AND (differential equations OR a
// combined linear-algebra/differential-equations course) becomes:
//   [{ concept: 'physics', anyOf: ['cc:1'] },
//    { concept: 'diff_eq', anyOf: ['cc:2', 'cc:3'] }]
function projectGroups(conceptRows, courseRows) {
  const requires = new Map(conceptRows.map((c) => [String(c.slug), c.requires || []]));
  const satisfies = new Map(conceptRows.map((c) => [
    String(c.slug), (c.satisfies || []).map(String),
  ]));
  const byCollege = new Map();
  for (const row of courseRows) {
    if (row.concept_source === undefined) continue;
    const college = collegeKeyOf(row);
    if (!byCollege.has(college)) byCollege.set(college, []);
    byCollege.get(college).push(row);
  }

  const groupsByCourse = new Map();
  for (const rows of byCollege.values()) {
    const localBySlug = new Map();
    const langOf = new Map();
    for (const row of rows) {
      if (!row.concept) continue;
      const key = courseKeyOf(row);
      if (row.language) langOf.set(key, String(row.language));
      for (const slug of [row.concept, ...(satisfies.get(row.concept) || [])]) {
        if (!localBySlug.has(slug)) localBySlug.set(slug, []);
        localBySlug.get(slug).push(key);
      }
    }

    const pickLocal = (slug, lang) => {
      const all = localBySlug.get(slug) || [];
      if (!lang) return all;
      const matching = all.filter((key) => !langOf.get(key) || langOf.get(key) === lang);
      return matching.length ? matching : all;
    };

    const uniqueGroup = (concept, ids) => ({
      concept,
      anyOf: [...new Set(ids)].sort(),
    });

    // Distribute OR across prerequisite formulas already expressed as CNF.
    // For example, (A AND B) OR C becomes (A OR C) AND (B OR C).
    const orFormulas = (formulas, concept) => {
      let clauses = formulas[0] || [];
      for (const formula of formulas.slice(1)) {
        clauses = clauses.flatMap((left) => formula.map((right) =>
          uniqueGroup(concept, [...left.anyOf, ...right.anyOf])));
      }
      const seenClauses = new Set();
      return clauses.filter((clause) => {
        const key = clause.anyOf.join(',');
        if (seenClauses.has(key)) return false;
        seenClauses.add(key);
        return true;
      });
    };

    function resolveRequirement(slug, seen, lang) {
      if (seen.has(slug)) return [];
      const local = pickLocal(slug, lang);
      if (local.length) {
        return [uniqueGroup(slug, local)];
      }
      const entries = requires.get(slug) || [];
      // A leaf concept not offered locally cannot be silently erased. Null is
      // propagated to the course-level projection as an unresolved group.
      if (!entries.length) return null;
      return resolveList(entries, new Set([...seen, slug]), lang);
    }

    function resolveEntry(entry, seen, lang) {
      if (!Array.isArray(entry)) return resolveRequirement(String(entry), seen, lang);

      const alternatives = entry.map(String);
      // If any named alternative is offered directly, preserve every direct
      // option. Only fall through concept prerequisites when none is offered;
      // otherwise a transitive fallback could incorrectly beat a later direct
      // catalog option.
      const direct = alternatives.flatMap((slug) => pickLocal(slug, lang));
      if (direct.length) return [uniqueGroup(alternatives.join(' or '), direct)];

      const fallbackFormulas = alternatives
        .map((slug) => resolveRequirement(slug, seen, lang))
        .filter((formula) => Array.isArray(formula));
      if (!fallbackFormulas.length) return null;
      if (fallbackFormulas.some((formula) => formula.length === 0)) return [];
      return orFormulas(fallbackFormulas, alternatives.join(' or '));
    }

    function resolveList(entries, seen, lang) {
      const out = [];
      for (const entry of entries || []) {
        const formula = resolveEntry(entry, seen, lang);
        if (formula == null) return null;
        out.push(...formula);
      }
      return out;
    }

    for (const row of rows) {
      const key = courseKeyOf(row);
      if (!row.concept) {
        groupsByCourse.set(key, []);
        continue;
      }
      const groups = [];
      for (const entry of requires.get(row.concept) || []) {
        const formula = resolveEntry(entry, new Set([row.concept]), row.language || null);
        if (formula == null) {
          const concepts = (Array.isArray(entry) ? entry : [entry]).map(String);
          groups.push({ concept: concepts.join(' or '), anyOf: [] });
        } else {
          groups.push(...formula);
        }
      }
      const cleaned = groups
        .map((group) => ({
          ...group,
          anyOf: group.anyOf.filter((candidate) => candidate !== key),
        }));
      groupsByCourse.set(key, cleaned);
    }
  }
  return groupsByCourse;
}

async function loadExaminedCourses(db, collegeKey = null, side = 'sending') {
  const filter = { side, concept_source: { $exists: true } };
  if (collegeKey) filter.institution_id = collegeKey;
  return db.collection('assist_courses').find(filter, {
    projection: {
      course_id: 1, parent_id: 1, side: 1, institution_id: 1, community_college_id: 1,
      university_id: 1, prefix: 1, number: 1,
      title: 1, units: 1, concept: 1, concept_source: 1, concept_confidence: 1, concept_note: 1, language: 1,
    },
  }).toArray();
}

async function projectPrereqEdges(db) {
  const [concepts, courses] = await Promise.all([loadConceptRows(db), loadExaminedCourses(db)]);
  return projectEdges(concepts, courses);
}

/**
 * The same concept-rule projection over UNIVERSITY courses, giving each campus
 * its own prerequisite graph. This is what a resident degree pathway needs: the
 * transfer-side figure compares a community college pathway against the
 * university's own curriculum, and the latter has no community college in it.
 */
async function projectUniversityPrereqEdges(db) {
  const [concepts, courses] = await Promise.all([
    loadConceptRows(db), loadExaminedCourses(db, null, 'receiving'),
  ]);
  return projectEdges(concepts, courses);
}

async function projectPrereqGroups(db) {
  const [concepts, courses] = await Promise.all([loadConceptRows(db), loadExaminedCourses(db)]);
  return projectGroups(concepts, courses);
}

// Distinct numeric CC course ids in agreement options, optionally one college
// and one configured major. Major scoping uses byte-exact campus/program pins;
// a sibling program with a similar name must never enter the review queue.
async function inScopeCourseIds(db, collegeKey = null, majorSlug = null) {
  const filter = {};
  if (collegeKey) filter.college_id = collegeKey;
  if (majorSlug) {
    const major = getMajor(majorSlug);
    if (!major) throw new Error(`unknown major: ${majorSlug}`);
    Object.assign(filter, programPairClause(major));
  }
  const ids = new Set();
  const cursor = db.collection('assist_agreements')
    .find(filter, { projection: { requirement_groups: 1 } });
  for await (const doc of cursor) {
    for (const g of doc.requirement_groups || [])
      for (const s of g.sections || [])
        for (const r of s.receivers || [])
          for (const o of r.options || [])
            for (const cid of o.course_ids || []) ids.add(Number(cid));
  }
  return ids;
}

async function prerequisiteGraphData(db, { collegeKey = null, majorSlug = null } = {}) {
  const major = majorSlug ? getMajor(majorSlug) : null;
  if (majorSlug && !major) throw new Error(`unknown major: ${majorSlug}`);
  const allConceptRows = await loadConceptRows(db);
  const displayConceptRows = conceptRowsForMajor(allConceptRows, major);
  const concepts = displayConceptRows.map((c) => ({
    slug: String(c.slug), name: c.name || c.slug, discipline: c.discipline || 'other',
    requires: c.requires || [],
    satisfies: (c.satisfies || []).map(String),
    note: c.note || '',
  }));
  // Expand OR-groups into per-alternative edges tagged with a shared group id
  // and option:true, so the graph can draw them as alternatives (dashed).
  let orSeq = 0;
  const rules = [];
  for (const c of concepts) {
    for (const entry of c.requires) {
      if (Array.isArray(entry)) {
        const group = `or:${c.slug}:${orSeq++}`;
        for (const alt of entry) rules.push({ from: String(alt), to: c.slug, option: true, group });
      } else {
        rules.push({ from: String(entry), to: c.slug });
      }
    }
  }
  const inScope = await inScopeCourseIds(db, collegeKey, majorSlug);

  if (!collegeKey) {
    // Coverage is over the current agreement scope. Historical examined rows
    // remain durable in the catalog, but must not inflate this numerator.
    const scopedCatalog = inScope.size
      ? await db.collection('assist_courses').find(
        { side: 'sending', course_id: { $in: [...inScope] } },
        { projection: { concept: 1, concept_source: 1 } }
      ).toArray()
      : [];
    const examined = scopedCatalog.filter((row) => row.concept_source !== undefined).length;
    const mapped = scopedCatalog.filter((row) => row.concept).length;
    return { concepts, rules, stats: { in_scope: scopedCatalog.length, examined, mapped } };
  }

  // Project against every reviewed local course so a mapped course outside the
  // agreement can still be a real prerequisite. In major mode the response is
  // then reduced to direct agreement courses plus only their prerequisite
  // closure; unrelated reviewed courses from other majors stay out of view.
  const catalog = await db.collection('assist_courses').find(
    { side: 'sending', institution_id: collegeKey },
    { projection: {
      course_id: 1, institution_id: 1, community_college_id: 1, prefix: 1, number: 1,
      title: 1, units: 1, concept: 1, concept_source: 1, concept_confidence: 1, concept_note: 1, language: 1,
    } }
  ).toArray();
  const byNumericId = new Map(catalog.map((row) => [Number(row.course_id), row]));
  const phantom = [...inScope].filter((id) => !byNumericId.has(id)).sort((a, b) => a - b);
  const directRows = catalog.filter((row) => inScope.has(Number(row.course_id)));
  const examinedRows = catalog.filter((row) => row.concept_source !== undefined);
  const projectedEdgeMap = projectEdges(allConceptRows, examinedRows);

  let rows;
  if (majorSlug) {
    const prerequisiteClosure = new Set();
    const pending = directRows
      .filter((row) => row.concept && projectedEdgeMap.has(courseKeyOf(row)))
      .map(courseKeyOf);
    while (pending.length) {
      const dependent = pending.pop();
      for (const prerequisite of projectedEdgeMap.get(dependent) || []) {
        if (prerequisiteClosure.has(prerequisite)) continue;
        prerequisiteClosure.add(prerequisite);
        pending.push(prerequisite);
      }
    }
    rows = catalog.filter((row) => (
      inScope.has(Number(row.course_id)) || prerequisiteClosure.has(courseKeyOf(row))
    ));
  } else {
    // Backward-compatible union view: current direct courses plus every row the
    // historical all-major classification examined.
    rows = catalog.filter((row) => (
      inScope.has(Number(row.course_id)) || row.concept_source !== undefined
    ));
  }

  const visibleKeys = new Set(rows.map(courseKeyOf));
  const edgeMap = new Map();
  for (const [to, froms] of projectedEdgeMap) {
    if (!visibleKeys.has(to)) continue;
    edgeMap.set(to, froms.filter((from) => visibleKeys.has(from)));
  }
  const edges = [];
  for (const [to, froms] of edgeMap) for (const from of froms) edges.push({ from, to });

  // Several courses mapped to the same concept are interchangeable — a course
  // requiring that concept needs only ONE of them. Mark such fan-ins (same
  // target, same source-concept) as options so the graph draws them as
  // alternatives, not parallel requirements. (The complexity metric is already
  // correct: it scores the min-set pathway, which picks a single course.)
  const conceptOfKey = new Map(rows.map((r) => [courseKeyOf(r), r.concept ?? null]));
  const groupSize = new Map();
  const groupKey = (e) => `${e.to}\u0000${conceptOfKey.get(e.from) ?? ''}`;
  for (const e of edges) groupSize.set(groupKey(e), (groupSize.get(groupKey(e)) || 0) + 1);
  for (const e of edges) {
    if (groupSize.get(groupKey(e)) > 1) { e.option = true; e.group = groupKey(e); }
  }

  const courses = rows.map((row) => ({
    key: courseKeyOf(row),
    prefix: row.prefix ?? null, number: row.number ?? null, title: row.title ?? null,
    units: row.units ?? null,
    concept: row.concept ?? null,
    concept_source: row.concept_source ?? null,
    concept_confidence: row.concept_confidence ?? null,
    concept_note: row.concept_note ?? null,
    language: row.language ?? null,
    in_scope: inScope.has(Number(row.course_id)),
    role: inScope.has(Number(row.course_id))
      ? 'major_preparation'
      : majorSlug ? 'prerequisite_only' : 'reviewed_out_of_scope',
  })).sort((a, b) => String(a.prefix).localeCompare(String(b.prefix))
    || String(a.number).localeCompare(String(b.number)));

  const examined = directRows.filter((r) => r.concept_source !== undefined).length;
  const mapped = directRows.filter((r) => r.concept).length;
  const stats = {
    // in_scope counts agreement-referenced courses present in the catalog (phantoms excluded)
    in_scope: directRows.length, examined, mapped,
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

module.exports = {
  projectEdges,
  projectGroups,
  projectPrereqEdges,
  projectUniversityPrereqEdges,
  projectPrereqGroups,
  prerequisiteGraphData,
};
