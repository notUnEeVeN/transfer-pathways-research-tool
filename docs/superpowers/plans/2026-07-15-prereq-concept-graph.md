# Prerequisite Concept Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A normative prerequisite concept graph — concept vocabulary + rules in `curated_requirements`, course→concept tags on `assist_courses`, read-time projection to per-college edges — with endpoints, References editors, a graph view, and an in-session LLM generation pipeline.

**Architecture:** Concepts (kind `prereq_concept`) hold the rule set as a `requires` adjacency list; each in-scope sending course carries a `concept` tag; per-college edges are projected at read time by `server/services/prereqGraph.js` (with transitive fallback when a college lacks a required concept). `complexityData` swaps its `curated_prerequisites` read for the projection. Frontend adds a Data → Prerequisites sub-tab (graph | concepts | mapping).

**Tech Stack:** Express + Mongo (CJS server, vitest + mongodb-memory-server tests), React 19 + Tailwind v4 + TanStack Query (vitest + testing-library, `vi.mock` of useData), Python importer (pymongo + dotenv, `--dry-run` convention).

**Spec:** `docs/superpowers/specs/2026-07-15-prerequisite-concept-graph-design.md` — read it before starting any task.

## Global Constraints

- Work on branch `prereq-concept-graph`; commit per task; **never push** without Tybalt's explicit ask (house rule).
- Machines never write `concept_curated_by` / `curated_by` / `verification_notes` — human-only fields.
- No LLM SDK or API key enters the repo; generation is an in-session artifact pipeline.
- Server code is CommonJS; server tests are ESM vitest files loading CJS via `createRequire` and the shared `server/test/mongoHarness.js` (real in-memory mongod).
- Response envelopes: lists `{ rows }`, computed views bare object, writes `{ ok: true, id }`, errors `{ error: '<human sentence>' }`.
- Write routes: `router.<verb>(path, ...guarded, jsonBody, handler)`; GET/DELETE omit `jsonBody`.
- Frontend: query keys include `user?.uid` AFTER any invalidation-prefix elements; `enabled: !!user?.uid`; curated-data staleTime 60s.
- Charts: token classes / CSS `var(--color-…)` carry color, inline styles carry geometry only; every mark gets `title`/`aria-label`; nothing hover-only (keep a table view).
- Concept slugs: `^[a-z0-9_]+$`. Disciplines: `math|physics|chem|cs|bio|engr|stats|other`. Concept graph must stay acyclic.
- Course keys are `cc:<course_id>` (numeric ids in live data; tests use string ids like `cs1a` — code must not assume numeric).
- Run server tests from `server/` with `npm test` (scoped: `npx vitest run <file>`); frontend from `frontend/` with `npm run test`.

---

### Task 1: `prereq_concept` requirement kind with validation

**Files:**
- Modify: `server/controllers/CanonicalData.js` (REQUIREMENT_PREFIX at ~line 14; putRequirement ~line 129; deleteRequirement ~line 156)
- Test: `server/controllers/CanonicalData.test.js` (append a describe block)

**Interfaces:**
- Consumes: existing `putRequirement`/`deleteRequirement`/`listRequirements` generic machinery.
- Produces: kind `prereq_concept` accepted by `GET/PUT/DELETE /curated/requirements`; concept doc shape `{ _id: 'prereq_concept:<slug>', kind, legacy_id, slug, name, discipline, requires: [slug], note, curated_by, curated_at, updated_at }`. Later tasks (3, 7, 9) rely on exactly this shape and on the validation invariants (acyclic, known slugs).

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/tybaltmallet/Desktop/transfer_pathways/internal_tool
git checkout -b prereq-concept-graph
```

- [ ] **Step 2: Write the failing tests**

Append to `server/controllers/CanonicalData.test.js` (the file already imports `putRequirement`; extend the `cjs('./CanonicalData')` destructure with `deleteRequirement` if absent):

```js
describe('prereq_concept kind', () => {
  const put = (body) => run(putRequirement, request({ params: { kind: 'prereq_concept' }, body }));
  const del = (id) => run(deleteRequirement, request({ params: { kind: 'prereq_concept', id } }));
  const concept = (slug, requires = [], extra = {}) => ({
    _id: `prereq_concept:${slug}`, slug, name: slug, discipline: 'math', requires, note: '', ...extra,
  });

  it('upserts a valid concept with stamps', async () => {
    const res = await put(concept('calc_1'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, id: 'prereq_concept:calc_1' });
    const stored = await db.collection('curated_requirements').findOne({ _id: 'prereq_concept:calc_1' });
    expect(stored).toMatchObject({ kind: 'prereq_concept', legacy_id: 'calc_1', slug: 'calc_1', curated_by: 'curator-1' });
  });

  it('rejects a malformed slug', async () => {
    const res = await put(concept('Calc 1!'));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/slug/);
  });

  it('rejects an unknown discipline', async () => {
    const res = await put(concept('calc_1', [], { discipline: 'underwater_basketweaving' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/discipline must be one of/);
  });

  it('rejects requires referencing an unknown concept', async () => {
    const res = await put(concept('calc_2', ['calc_1']));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unknown concept: calc_1/);
  });

  it('rejects a cycle', async () => {
    await put(concept('calc_1'));
    await put(concept('calc_2', ['calc_1']));
    const res = await put(concept('calc_1', ['calc_2']));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/cycle/);
  });

  it('rejects deleting a concept other concepts require', async () => {
    await put(concept('calc_1'));
    await put(concept('calc_2', ['calc_1']));
    const res = await del('prereq_concept:calc_1');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/referenced/);
  });

  it('rejects deleting a concept a course maps to', async () => {
    await put(concept('calc_1'));
    await db.collection('assist_courses').insertOne({
      _id: 'cc:1', side: 'sending', course_id: 1, institution_id: 'cc:10',
      concept: 'calc_1', concept_source: 'llm_session_v1',
    });
    const res = await del('prereq_concept:calc_1');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/1 course/);
  });

  it('deletes an unreferenced concept', async () => {
    await put(concept('calc_1'));
    const res = await del('prereq_concept:calc_1');
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd server && npx vitest run controllers/CanonicalData.test.js`
Expected: FAIL — `kind must be one of …` (prereq_concept not in allowlist) / 404 `unknown requirement kind`.

- [ ] **Step 4: Implement**

In `server/controllers/CanonicalData.js`:

1. Extend the allowlist:

```js
const REQUIREMENT_PREFIX = Object.freeze({
  transfer_minimum: 'transfer_minimum',
  degree: 'degree',
  ge_pattern: 'ge_pattern',
  igetc: 'igetc',
  associate_degree: 'associate_degree',
  prereq_concept: 'prereq_concept',
});
```

2. Add below `parseInstitutionId`:

```js
// ── prereq_concept validation ──
// The concept vocabulary is the normative prerequisite model (see
// docs/superpowers/specs/2026-07-15-prerequisite-concept-graph-design.md);
// writes must keep the rule graph acyclic and self-consistent.
const CONCEPT_SLUG_RE = /^[a-z0-9_]+$/;
const CONCEPT_DISCIPLINES = ['math', 'physics', 'chem', 'cs', 'bio', 'engr', 'stats', 'other'];

async function validatePrereqConcept(db, canonical) {
  const slug = String(canonical.slug || '');
  if (!CONCEPT_SLUG_RE.test(slug)) return 'slug must match ^[a-z0-9_]+$';
  if (slug !== String(canonical.legacy_id)) return 'slug must equal the row id';
  if (!CONCEPT_DISCIPLINES.includes(canonical.discipline)) {
    return `discipline must be one of ${CONCEPT_DISCIPLINES.join(', ')}`;
  }
  const requires = canonical.requires;
  if (!Array.isArray(requires) || requires.some((r) => typeof r !== 'string')) {
    return 'requires must be an array of concept slugs';
  }
  const rows = await db.collection(COLLECTIONS.requirements)
    .find({ kind: 'prereq_concept' }, { projection: { slug: 1, requires: 1 } })
    .toArray();
  const graph = new Map(rows.map((r) => [String(r.slug), (r.requires || []).map(String)]));
  graph.set(slug, requires.map(String));
  for (const r of requires) {
    if (!graph.has(String(r))) return `requires references unknown concept: ${r}`;
  }
  const state = new Map(); // 'visiting' | 'done'
  const visit = (node, path) => {
    if (state.get(node) === 'done') return null;
    if (state.get(node) === 'visiting') return [...path, node];
    state.set(node, 'visiting');
    for (const next of graph.get(node) || []) {
      const cycle = visit(next, [...path, node]);
      if (cycle) return cycle;
    }
    state.set(node, 'done');
    return null;
  };
  const cycle = visit(slug, []);
  if (cycle) return `requires would create a cycle: ${cycle.join(' → ')}`;
  return null;
}
```

3. In `putRequirement`, after `const canonical = { … };` and before `replaceOne`:

```js
  if (kind === 'prereq_concept') {
    const invalid = await validatePrereqConcept(db, canonical);
    if (invalid) return res.status(400).json({ error: invalid });
  }
```

4. In `deleteRequirement`, after `canonicalId` is computed and before `deleteOne`:

```js
  if (kind === 'prereq_concept') {
    const slug = canonicalId.slice(prefix.length);
    const [dependents, mapped] = await Promise.all([
      req.app.locals.db.collection(COLLECTIONS.requirements)
        .countDocuments({ kind: 'prereq_concept', requires: slug }),
      req.app.locals.db.collection(COLLECTIONS.courses)
        .countDocuments({ concept: slug }),
    ]);
    if (dependents || mapped) {
      return res.status(400).json({
        error: `concept is referenced by ${dependents} concept(s) and ${mapped} course(s); reassign them first`,
      });
    }
  }
```

- [ ] **Step 5: Run to verify pass**

Run: `cd server && npx vitest run controllers/CanonicalData.test.js`
Expected: PASS (all pre-existing tests too).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/CanonicalData.js server/controllers/CanonicalData.test.js
git commit -m "feat: add prereq_concept requirement kind with acyclicity validation"
```

---

### Task 2: `PUT /assist/courses/:id/concept`

**Files:**
- Modify: `server/controllers/CanonicalData.js` (new handler near `putInstitutionProfile`, ~line 199)
- Modify: `server/routes/api.js` (canonical-data section, after the `/assist/courses` GET at line 27)
- Test: `server/controllers/CanonicalData.test.js`

**Interfaces:**
- Consumes: concept docs from Task 1 (slug existence check).
- Produces: `PUT /api/assist/courses/:id/concept`, body `{ concept: <slug|null>, note?: string }` → `{ ok: true, id: 'cc:<id>' }`. Stamps `concept, concept_source: 'console_edit', concept_confidence: 1, concept_title_seen, concept_note, concept_curated_by, concept_curated_at` on the course doc. Tasks 8/10 call this.

- [ ] **Step 1: Write the failing tests**

Append to `CanonicalData.test.js` (add `putCourseConcept` to the destructure):

```js
describe('putCourseConcept', () => {
  beforeEach(async () => {
    await db.collection('curated_requirements').insertOne({
      _id: 'prereq_concept:calc_1', kind: 'prereq_concept', legacy_id: 'calc_1',
      slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [],
    });
    await db.collection('assist_courses').insertMany([
      { _id: 'cc:42', side: 'sending', course_id: 42, institution_id: 'cc:10', title: 'Calculus I' },
      { _id: 'university:9', side: 'receiving', parent_id: 9, institution_id: 'uc:1', title: 'Math 1A' },
    ]);
  });

  const putConcept = (id, body) =>
    run(putCourseConcept, request({ params: { id }, body }));

  it('stamps the mapping fields on a sending course', async () => {
    const res = await putConcept('cc:42', { concept: 'calc_1', note: 'obvious' });
    expect(res.body).toEqual({ ok: true, id: 'cc:42' });
    const stored = await db.collection('assist_courses').findOne({ _id: 'cc:42' });
    expect(stored).toMatchObject({
      concept: 'calc_1', concept_source: 'console_edit', concept_confidence: 1,
      concept_title_seen: 'Calculus I', concept_note: 'obvious', concept_curated_by: 'curator-1',
    });
    expect(stored.concept_curated_at).toBeInstanceOf(Date);
  });

  it('clears to examined-not-relevant with concept null', async () => {
    await putConcept('cc:42', { concept: 'calc_1' });
    const res = await putConcept('cc:42', { concept: null });
    expect(res.statusCode).toBe(200);
    const stored = await db.collection('assist_courses').findOne({ _id: 'cc:42' });
    expect(stored.concept).toBeNull();
    expect(stored.concept_source).toBe('console_edit');
  });

  it('400s an unknown concept slug', async () => {
    const res = await putConcept('cc:42', { concept: 'underwater_calc' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unknown concept slug/);
  });

  it('404s a missing course and 400s a non-cc id', async () => {
    expect((await putConcept('cc:999', { concept: 'calc_1' })).statusCode).toBe(404);
    expect((await putConcept('university:9', { concept: 'calc_1' })).statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && npx vitest run controllers/CanonicalData.test.js`
Expected: FAIL — `putCourseConcept` is not a function.

- [ ] **Step 3: Implement**

In `CanonicalData.js`, after `deleteInstitutionProfile` (mirrors the enrichment-write pattern; live course `_id`s are `cc:<numeric>` but tests may use other strings after `cc:` — accept `cc:` + anything non-empty):

```js
// Course→concept mapping: enrichment fields on the sending-course doc (the
// spec's §1B). Human console edits only — imports use scripts/import_course_concepts.py.
exports.putCourseConcept = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const id = decodeURIComponent(String(req.params.id || ''));
  if (!/^cc:.+$/.test(id)) return res.status(400).json({ error: 'course id must be cc:<course_id>' });
  const { concept = null, note = '' } = req.body || {};
  if (concept != null) {
    const known = await db.collection(COLLECTIONS.requirements)
      .findOne({ _id: `prereq_concept:${concept}` }, { projection: { _id: 1 } });
    if (!known) return res.status(400).json({ error: `unknown concept slug: ${concept}` });
  }
  const course = await db.collection(COLLECTIONS.courses)
    .findOne({ _id: id, side: 'sending' }, { projection: { title: 1 } });
  if (!course) return res.status(404).json({ error: 'no such sending course' });
  await db.collection(COLLECTIONS.courses).updateOne(
    { _id: id },
    { $set: {
      concept: concept ?? null,
      concept_source: 'console_edit',
      concept_confidence: 1,
      concept_title_seen: course.title ?? null,
      concept_note: String(note || ''),
      concept_curated_by: req.user?.uid ?? null,
      concept_curated_at: new Date(),
    } }
  );
  res.json({ ok: true, id });
});
```

In `server/routes/api.js`, directly after the `/assist/courses` GET line:

```js
router.put('/assist/courses/:id/concept', ...guarded, jsonBody, canonicalDataController.putCourseConcept);
```

- [ ] **Step 4: Run to verify pass**

Run: `cd server && npx vitest run controllers/CanonicalData.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/CanonicalData.js server/routes/api.js server/controllers/CanonicalData.test.js
git commit -m "feat: course concept mapping endpoint (PUT /assist/courses/:id/concept)"
```

---

### Task 3: `prereqGraph` projection service

**Files:**
- Create: `server/services/prereqGraph.js`
- Test: `server/services/prereqGraph.test.js`

**Interfaces:**
- Consumes: `curated_requirements` kind `prereq_concept`; `assist_courses` concept fields; `assist_agreements` option course_ids; legacy `curated_prerequisites`.
- Produces (exact exports):
  - `projectEdges(conceptRows, courseRows)` → `Map<'cc:<course_id>', string[]>` — pure; entry for every examined course (`concept_source` present), `[]` when no prereqs; per-college edges with transitive fallback.
  - `projectPrereqEdges(db)` → same Map, loaded from the db. **Task 5 consumes this.**
  - `prerequisiteGraphData(db, { collegeKey })` → `{ concepts, rules, stats, courses?, edges?, legacy? }`. **Task 4 consumes this.**

- [ ] **Step 1: Write the failing tests**

Create `server/services/prereqGraph.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { projectEdges, projectPrereqEdges, prerequisiteGraphData } = cjs('./prereqGraph');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('prereq_graph_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

const CONCEPTS = [
  { slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [] },
  { slug: 'calc_2', name: 'Calculus II', discipline: 'math', requires: ['calc_1'] },
  { slug: 'calc_3', name: 'Calculus III', discipline: 'math', requires: ['calc_2'] },
  { slug: 'linear_alg', name: 'Linear Algebra', discipline: 'math', requires: ['calc_3'] },
  { slug: 'diff_eq', name: 'Differential Equations', discipline: 'math', requires: ['linear_alg'] },
];
const course = (id, college, concept, extra = {}) => ({
  _id: `cc:${id}`, side: 'sending', course_id: id, institution_id: `cc:${college}`,
  community_college_id: college, prefix: 'MATH', number: String(id), title: `Course ${id}`,
  ...(concept === undefined ? {} : { concept, concept_source: 'llm_session_v1', concept_confidence: 1 }),
  ...extra,
});

describe('projectEdges', () => {
  it('projects direct edges within one college', () => {
    const edges = projectEdges(CONCEPTS, [
      course(1, 10, 'calc_1'), course(2, 10, 'calc_2'), course(3, 10, 'calc_3'),
    ]);
    expect(edges.get('cc:2')).toEqual(['cc:1']);
    expect(edges.get('cc:3')).toEqual(['cc:2']);
    expect(edges.get('cc:1')).toEqual([]);
  });

  it('falls through a concept the college lacks (transitive fallback)', () => {
    // College 20 has no linear_alg course → diff_eq requires its calc_3 course.
    const edges = projectEdges(CONCEPTS, [
      course(21, 20, 'calc_3'), course(22, 20, 'diff_eq'),
    ]);
    expect(edges.get('cc:22')).toEqual(['cc:21']);
  });

  it('never crosses colleges', () => {
    const edges = projectEdges(CONCEPTS, [
      course(1, 10, 'calc_1'), course(21, 20, 'calc_2'),
    ]);
    expect(edges.get('cc:21')).toEqual([]);
  });

  it('gives examined-not-relevant courses an empty entry and skips unexamined ones', () => {
    const edges = projectEdges(CONCEPTS, [
      course(5, 10, null),          // examined, no concept
      course(6, 10, undefined),     // never examined
    ]);
    expect(edges.get('cc:5')).toEqual([]);
    expect(edges.has('cc:6')).toBe(false);
  });

  it('links every local course mapped to a required concept', () => {
    const edges = projectEdges(CONCEPTS, [
      course(1, 10, 'calc_1'), course(7, 10, 'calc_1'), course(2, 10, 'calc_2'),
    ]);
    expect(new Set(edges.get('cc:2'))).toEqual(new Set(['cc:1', 'cc:7']));
  });
});

describe('prerequisiteGraphData', () => {
  beforeEach(async () => {
    await db.collection('curated_requirements').insertMany(CONCEPTS.map((c) => ({
      _id: `prereq_concept:${c.slug}`, kind: 'prereq_concept', legacy_id: c.slug, ...c,
    })));
    await db.collection('assist_courses').insertMany([
      course(1, 10, 'calc_1'), course(2, 10, 'calc_2'), course(6, 10, undefined),
    ]);
    await db.collection('assist_agreements').insertOne({
      college_id: 'cc:10', university_id: 'uc:1', major: 'CS',
      requirement_groups: [{ sections: [{ receivers: [
        { options: [{ course_ids: [1, 2] }] },
        { options: [{ course_ids: [6, 999] }] },   // 999 = phantom
      ] }] }],
    });
    await db.collection('curated_prerequisites').insertOne({
      _id: 'cc:2', course_id: 'cc:2', institution_id: 'cc:10', prerequisite_ids: ['cc:1', 'cc:6'],
    });
  });

  it('returns the concept DAG without a college', async () => {
    const data = await prerequisiteGraphData(db, {});
    expect(data.concepts).toHaveLength(5);
    expect(data.rules).toContainEqual({ from: 'calc_1', to: 'calc_2' });
    expect(data.courses).toBeUndefined();
    expect(data.stats.examined).toBe(2);
  });

  it('returns courses, edges, phantom ids, and legacy overlap for a college', async () => {
    const data = await prerequisiteGraphData(db, { collegeKey: 'cc:10' });
    const keys = data.courses.map((c) => c.key).sort();
    expect(keys).toEqual(['cc:1', 'cc:2', 'cc:6']);       // in-scope ∪ examined
    expect(data.courses.find((c) => c.key === 'cc:6').in_scope).toBe(true);
    expect(data.edges).toContainEqual({ from: 'cc:1', to: 'cc:2' });
    expect(data.stats.phantom_course_ids).toEqual([999]);
    expect(data.stats.in_scope).toBe(3);
    expect(data.stats.examined).toBe(2);
    // legacy row for cc:2 claims [cc:1, cc:6]; we project [cc:1] → 1 shared of 2 legacy, 1 projected
    expect(data.legacy).toEqual({
      courses_compared: 1, legacy_edges: 2, projected_edges: 1, shared_edges: 1,
    });
  });
});

describe('projectPrereqEdges', () => {
  it('loads and projects from the db', async () => {
    await db.collection('curated_requirements').insertMany(CONCEPTS.map((c) => ({
      _id: `prereq_concept:${c.slug}`, kind: 'prereq_concept', legacy_id: c.slug, ...c,
    })));
    await db.collection('assist_courses').insertMany([course(1, 10, 'calc_1'), course(2, 10, 'calc_2')]);
    const edges = await projectPrereqEdges(db);
    expect(edges.get('cc:2')).toEqual(['cc:1']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && npx vitest run services/prereqGraph.test.js`
Expected: FAIL — cannot find module `./prereqGraph`.

- [ ] **Step 3: Implement**

Create `server/services/prereqGraph.js`:

```js
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
      if (!localBySlug.has(row.concept)) localBySlug.set(row.concept, []);
      localBySlug.get(row.concept).push(courseKeyOf(row));
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
      title: 1, units: 1, concept: 1, concept_source: 1, concept_confidence: 1,
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
    requires: (c.requires || []).map(String), note: c.note || '',
  }));
  const rules = concepts.flatMap((c) => c.requires.map((from) => ({ from, to: c.slug })));
  const inScope = await inScopeCourseIds(db, collegeKey);

  if (!collegeKey) {
    const examined = await db.collection('assist_courses')
      .countDocuments({ side: 'sending', concept_source: { $exists: true } });
    return { concepts, rules, stats: { in_scope: inScope.size, examined } };
  }

  // College view: every course that is in scope OR already examined.
  const catalog = await db.collection('assist_courses').find(
    { side: 'sending', institution_id: collegeKey },
    { projection: {
      course_id: 1, institution_id: 1, community_college_id: 1, prefix: 1, number: 1,
      title: 1, units: 1, concept: 1, concept_source: 1, concept_confidence: 1,
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
    in_scope: inScope.has(Number(row.course_id)),
  })).sort((a, b) => String(a.prefix).localeCompare(String(b.prefix))
    || String(a.number).localeCompare(String(b.number)));

  const examined = rows.filter((r) => r.concept_source !== undefined).length;
  const mapped = rows.filter((r) => r.concept).length;
  const stats = {
    in_scope: inScope.size, examined, mapped,
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
```

- [ ] **Step 4: Run to verify pass**

Run: `cd server && npx vitest run services/prereqGraph.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/prereqGraph.js server/services/prereqGraph.test.js
git commit -m "feat: prerequisite concept projection service"
```

---

### Task 4: `GET /curated/prerequisite-graph`

**Files:**
- Modify: `server/controllers/CanonicalData.js` (new thin handler)
- Modify: `server/routes/api.js` (after the `/curated/prerequisites` routes)
- Test: `server/controllers/CanonicalData.test.js`

**Interfaces:**
- Consumes: `prerequisiteGraphData` from Task 3.
- Produces: `GET /api/curated/prerequisite-graph[?college_id=cc:<id>]` → bare object (computed-view convention). Tasks 8/10/11 fetch this.

- [ ] **Step 1: Write the failing tests**

Append to `CanonicalData.test.js` (add `prerequisiteGraph` to the destructure):

```js
describe('prerequisiteGraph endpoint', () => {
  it('400s a malformed college_id', async () => {
    const res = await run(prerequisiteGraph, request({ query: { college_id: 'nope' } }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/college_id must be cc:<id>/);
  });

  it('returns the concept DAG without a college and the full payload with one', async () => {
    await db.collection('curated_requirements').insertOne({
      _id: 'prereq_concept:calc_1', kind: 'prereq_concept', legacy_id: 'calc_1',
      slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [],
    });
    await db.collection('assist_courses').insertOne({
      _id: 'cc:1', side: 'sending', course_id: 1, institution_id: 'cc:10',
      title: 'Calc I', concept: 'calc_1', concept_source: 'llm_session_v1',
    });
    const bare = await run(prerequisiteGraph, request({ query: {} }));
    expect(bare.body.concepts).toHaveLength(1);
    expect(bare.body.courses).toBeUndefined();

    const scoped = await run(prerequisiteGraph, request({ query: { college_id: 'cc:10' } }));
    expect(scoped.body.courses).toHaveLength(1);
    expect(scoped.body.courses[0].key).toBe('cc:1');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && npx vitest run controllers/CanonicalData.test.js`
Expected: FAIL — `prerequisiteGraph` is not a function.

- [ ] **Step 3: Implement**

In `CanonicalData.js` (top: `const { prerequisiteGraphData } = require('../services/prereqGraph');`):

```js
// Computed view over the concept vocabulary + course mapping (like
// /curated/degree-evaluation: a view over curated tables, so it lives here).
exports.prerequisiteGraph = asyncHandler(async (req, res) => {
  const requested = String(req.query.college_id || '').trim();
  const parsed = requested ? parseInstitutionId(requested, 'community_college') : null;
  if (requested && !parsed) return res.status(400).json({ error: 'college_id must be cc:<id>' });
  const data = await prerequisiteGraphData(req.app.locals.db, { collegeKey: parsed?.key ?? null });
  res.json(data);
});
```

In `api.js`, after the `/curated/prerequisites` DELETE:

```js
router.get('/curated/prerequisite-graph', ...guarded, canonicalDataController.prerequisiteGraph);
```

- [ ] **Step 4: Run to verify pass, then run the whole server suite**

Run: `cd server && npm test`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/CanonicalData.js server/routes/api.js server/controllers/CanonicalData.test.js
git commit -m "feat: prerequisite-graph computed view endpoint"
```

---

### Task 5: switch `complexityData` to the projection

**Files:**
- Modify: `server/services/analysis/pathways.js:1224-1240` (doc comment + prereq load)
- Modify: `server/services/analysis/pathways.test.js` (seeds ~lines 81-92 and 171-174)

**Interfaces:**
- Consumes: `projectPrereqEdges(db)` from Task 3 (drop-in for the old `prereqsByKey` Map).
- Produces: `complexityData` output shape unchanged; `prereq_data_coverage_pct` now means "% of pathway courses examined".

- [ ] **Step 1: Update the test seeds (failing first)**

In `pathways.test.js`:

1. Replace the two prereq-relevant course seed lines (inside the `assist_courses` insertMany at ~lines 83-84):

```js
    { course_id: 'cs1a', units: 3, community_college_id: 10, side: 'sending',
      concept: 'prog_1', concept_source: 'llm_session_v1', concept_confidence: 1 },
    { course_id: 'cs1b', units: 3, community_college_id: 10, side: 'sending',
      concept: 'prog_2', concept_source: 'llm_session_v1', concept_confidence: 1 },
```

2. Delete the `curated_prerequisites` insertMany block (lines 171-174) and add concept rows to the FIRST `curated_requirements` insertMany (after the `degree:1` doc):

```js
    { _id: 'prereq_concept:prog_1', kind: 'prereq_concept', legacy_id: 'prog_1',
      slug: 'prog_1', name: 'Programming I', discipline: 'cs', requires: [] },
    { _id: 'prereq_concept:prog_2', kind: 'prereq_concept', legacy_id: 'prog_2',
      slug: 'prog_2', name: 'Programming II', discipline: 'cs', requires: ['prog_1'] },
```

- [ ] **Step 2: Run to verify the complexity test now fails**

Run: `cd server && npx vitest run services/analysis/pathways.test.js`
Expected: `complexityData` test FAILS (`n_prereq_edges` 0 ≠ 1) — the old code still reads the now-empty `curated_prerequisites`.

- [ ] **Step 3: Implement the switch**

In `pathways.js`: add near the other requires at the top of the file:

```js
const { projectPrereqEdges } = require('../prereqGraph');
```

Replace the doc comment and the first lines of `complexityData` (the comment at 1224-1232 and the `prereqDocs`/`prereqsByKey` lines at 1236-1239):

```js
/**
 * Curricular complexity (Curricular Analytics-style) over the projected
 * prerequisite concept graph, for the min-set pathway of each agreement.
 *   delay factor    — longest prereq chain through the course
 *   blocking factor — number of courses this course unlocks (descendants)
 *   complexity      — per-course delay + blocking, summed per pathway
 * Edges come from services/prereqGraph (concept rules × course concept tags);
 * coverage counts pathway courses that have been examined (concept_source set).
 */
async function complexityData(db, auditDb, { majorContains = '', visiblePairs = null } = {}) {
  const curation = await loadCuration(auditDb);
  const isExcluded = makeIsExcluded(curation);
  const prereqsByKey = await projectPrereqEdges(db);
  const coursesById = await loadCoursesById(db);
```

Everything below (`parents`, `delay`, `blocking`, row assembly) is untouched — the Map contract is identical.

- [ ] **Step 4: Run to verify pass**

Run: `cd server && npx vitest run services/analysis/pathways.test.js`
Expected: PASS — including the unchanged assertions `n_prereq_edges: 1`, `max_delay: 2`, `cs1b.delay: 2`, `cs1a.blocking: 1`.

- [ ] **Step 5: Commit**

```bash
git add server/services/analysis/pathways.js server/services/analysis/pathways.test.js
git commit -m "feat: complexityData consumes the projected concept graph"
```

---

### Task 6: migration carry-forward of concept fields

**Files:**
- Modify: `server/scripts/migrateCanonicalSchema.js` (importedCourses block, ~lines 236-257)
- Test: `server/scripts/migrateCanonicalSchema.test.js`

**Interfaces:**
- Consumes: existing `buildModel` flow (`existingCourses` already read at line ~155).
- Produces: concept fields survive a port-triggered rebuild — required for console edits to be durable (spec §1B mechanism 2).

- [ ] **Step 1: Write the failing test**

Append to `migrateCanonicalSchema.test.js` (inside the existing describe; the `beforeEach` already seeds legacy `courses` — check its exact shape and reuse the same `course_id`):

```js
  it('carries concept fields forward when rebuilding courses from legacy', async () => {
    // The beforeEach seeds a legacy CC course; stamp concept fields on its
    // current canonical row and rebuild.
    const legacy = await db.collection('courses').findOne({});
    const canonicalId = `cc:${legacy.course_id}`;
    await db.collection('assist_courses').updateOne(
      { _id: canonicalId },
      { $set: {
        _id: canonicalId, side: 'sending', source_id: legacy.course_id,
        institution_id: `cc:${legacy.community_college_id}`,
        concept: 'calc_1', concept_source: 'console_edit', concept_confidence: 1,
        concept_title_seen: 'Calculus I', concept_note: '', 
        concept_curated_by: 'user-1', concept_curated_at: new Date(),
      } },
      { upsert: true }
    );
    const model = await buildModel(db);
    const rebuilt = model.collections.assist_courses.find((row) => row._id === canonicalId);
    expect(rebuilt).toMatchObject({
      concept: 'calc_1', concept_source: 'console_edit', concept_curated_by: 'user-1',
    });
    const untouched = model.collections.assist_courses.find((row) => row._id !== canonicalId);
    expect(untouched.concept).toBeUndefined();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && npx vitest run scripts/migrateCanonicalSchema.test.js`
Expected: new test FAILS (`rebuilt.concept` undefined — line 257 discards existing canonical rows).

- [ ] **Step 3: Implement**

In `migrateCanonicalSchema.js`, insert immediately BEFORE the `const importedCourses = [` block:

```js
  // Concept-mapping enrichment (spec 2026-07-15-prerequisite-concept-graph):
  // these fields exist only on canonical rows (stamped by the importer or the
  // console), so a rebuild from legacy sources must carry them forward or
  // console edits die with every port.
  const CONCEPT_FIELDS = [
    'concept', 'concept_source', 'concept_confidence', 'concept_title_seen',
    'concept_note', 'concept_curated_by', 'concept_curated_at',
  ];
  const conceptCarry = new Map();
  for (const row of existingCourses) {
    const carried = {};
    for (const field of CONCEPT_FIELDS) {
      if (row[field] !== undefined) carried[field] = row[field];
    }
    if (Object.keys(carried).length) conceptCarry.set(String(row._id), carried);
  }
```

Then add one spread line to each side's mapper — sending, after `same_as_keys: …`:

```js
      ...(conceptCarry.get(`cc:${row.course_id}`) || {}),
```

receiving, after `side: 'receiving',`:

```js
      ...(conceptCarry.get(`university:${row.parent_id}`) || {}),
```

- [ ] **Step 4: Run to verify pass**

Run: `cd server && npx vitest run scripts/migrateCanonicalSchema.test.js`
Expected: PASS (both new and pre-existing tests, including the count validations).

- [ ] **Step 5: Commit**

```bash
git add server/scripts/migrateCanonicalSchema.js server/scripts/migrateCanonicalSchema.test.js
git commit -m "feat: carry concept fields forward through canonical course rebuilds"
```

---

### Task 7: `import_course_concepts.py`

**Files:**
- Create: `scripts/import_course_concepts.py`
- Create: `scripts/data/prereq_concepts.sample.json`, `scripts/data/course_concepts.sample.json` (tiny fixtures for dry-run verification; the real artifacts land in Phase G)

**Interfaces:**
- Consumes: `scripts/data/prereq_concepts.json` `{ "_meta": {...}, "concepts": [{slug, name, discipline, requires, note}] }` and `scripts/data/course_concepts.json` `{ "meta": {...}, "rows": [{course_id: <number>, institution_id: "cc:<n>", concept: <slug|null>, confidence: <0-1>, title_seen: <str>, note?: <str>, flags?: [<str>]}] }`.
- Produces: concept rows upserted into `curated_requirements`; mapping `$set` onto `assist_courses` with `concept_source: "llm_session_v1"`, skipping rows whose live doc has `concept_curated_by`, warning on title drift. `--dry-run` is parse+validate only (no DB).

- [ ] **Step 1: Write the script**

Create `scripts/import_course_concepts.py`:

```python
"""
Import the prerequisite concept vocabulary and the course->concept mapping.

Two inputs, applied in order (concepts first so mapping slugs can validate):

  scripts/data/prereq_concepts.json   -> curated_requirements (kind prereq_concept)
  scripts/data/course_concepts.json   -> concept* fields on assist_courses

Rules (spec docs/superpowers/specs/2026-07-15-prerequisite-concept-graph-design.md):
  - never overwrite a course whose concept_curated_by is set (human wins);
  - warn when the live course title differs from the row's title_seen;
  - the concept graph must be acyclic and reference only known slugs.

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required, unless --dry-run)
  TARGET_DB_NAME   (default pmt_research)
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

DEFAULT_CONCEPTS = HERE / "data" / "prereq_concepts.json"
DEFAULT_MAPPING = HERE / "data" / "course_concepts.json"

SLUG_RE = re.compile(r"^[a-z0-9_]+$")
DISCIPLINES = {"math", "physics", "chem", "cs", "bio", "engr", "stats", "other"}
MACHINE_SOURCE = "llm_session_v1"


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        sys.exit(f"Missing required env var {name} (set it in scripts/.env or the shell).")
    return val


def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"Bad JSON in {Path(path).name}: {e}")


def validate_concepts(concepts):
    slugs = [c.get("slug") for c in concepts]
    if len(slugs) != len(set(slugs)):
        sys.exit("duplicate concept slugs in prereq_concepts.json")
    graph = {}
    for c in concepts:
        slug = str(c.get("slug") or "")
        if not SLUG_RE.match(slug):
            sys.exit(f"bad slug: {slug!r}")
        if c.get("discipline") not in DISCIPLINES:
            sys.exit(f"{slug}: discipline must be one of {sorted(DISCIPLINES)}")
        graph[slug] = [str(r) for r in (c.get("requires") or [])]
    for slug, reqs in graph.items():
        for r in reqs:
            if r not in graph:
                sys.exit(f"{slug}: requires unknown concept {r!r}")
    state = {}
    def visit(node, path):
        if state.get(node) == "done":
            return None
        if state.get(node) == "visiting":
            return path + [node]
        state[node] = "visiting"
        for nxt in graph.get(node, []):
            cycle = visit(nxt, path + [node])
            if cycle:
                return cycle
        state[node] = "done"
        return None
    for slug in graph:
        cycle = visit(slug, [])
        if cycle:
            sys.exit(f"concept cycle: {' -> '.join(cycle)}")
    return graph


def validate_mapping(rows, graph):
    for row in rows:
        cid = row.get("course_id")
        if not isinstance(cid, (int, float)) or int(cid) != cid:
            sys.exit(f"mapping row has non-numeric course_id: {row!r}")
        concept = row.get("concept")
        if concept is not None and concept not in graph:
            sys.exit(f"course {cid}: unknown concept {concept!r}")
        conf = row.get("confidence")
        if not isinstance(conf, (int, float)) or not (0 <= conf <= 1):
            sys.exit(f"course {cid}: confidence must be in [0, 1]")


def build_concept_rows(concepts, now, source):
    return [{
        "_id": f"prereq_concept:{c['slug']}",
        "legacy_id": c["slug"],
        "kind": "prereq_concept",
        "slug": c["slug"],
        "name": c.get("name") or c["slug"],
        "discipline": c["discipline"],
        "requires": [str(r) for r in (c.get("requires") or [])],
        "note": c.get("note") or "",
        "source": source,
        "updated_at": now,
    } for c in concepts]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--concepts-json", default=str(DEFAULT_CONCEPTS))
    ap.add_argument("--mapping-json", default=str(DEFAULT_MAPPING))
    ap.add_argument("--dry-run", action="store_true", help="parse and report without writing")
    args = ap.parse_args()

    for p in (args.concepts_json, args.mapping_json):
        if not Path(p).exists():
            sys.exit(f"source not found: {p}")

    concepts_doc = load_json(args.concepts_json)
    mapping_doc = load_json(args.mapping_json)
    concepts = concepts_doc.get("concepts") or []
    rows = mapping_doc.get("rows") or []

    graph = validate_concepts(concepts)
    validate_mapping(rows, graph)

    now = dt.datetime.now(dt.timezone.utc)
    source = f"scripts/data/{Path(args.concepts_json).name}"
    concept_rows = build_concept_rows(concepts, now, source)
    mapped = sum(1 for r in rows if r.get("concept"))
    print(f"Concepts: {len(concept_rows)} ({sum(1 for c in concepts if c.get('requires'))} with rules)")
    print(f"Mapping rows: {len(rows)} ({mapped} mapped, {len(rows) - mapped} examined-not-relevant)")
    if concept_rows:
        sample = {k: v for k, v in concept_rows[0].items() if k != "updated_at"}
        print("Concept sample:", json.dumps(sample, ensure_ascii=False))
    if rows:
        print("Mapping sample:", json.dumps(rows[0], ensure_ascii=False))

    if args.dry_run:
        print("Dry run only; no DB writes.")
        return

    from pymongo import MongoClient, UpdateOne
    uri = _env("TARGET_MONGO_URI", required=True)
    db = MongoClient(uri)[_env("TARGET_DB_NAME", "pmt_research")]

    db["curated_requirements"].bulk_write([
        UpdateOne({"_id": row["_id"]}, {"$set": row}, upsert=True) for row in concept_rows
    ], ordered=False)
    print(f"curated_requirements updated ({len(concept_rows)} concept rows).")

    ids = [f"cc:{int(r['course_id'])}" for r in rows]
    existing = {
        doc["_id"]: doc
        for doc in db["assist_courses"].find(
            {"_id": {"$in": ids}}, {"concept_curated_by": 1, "title": 1}
        )
    }
    ops, skipped_curated, missing, drifted = [], 0, 0, 0
    for row in rows:
        cid = f"cc:{int(row['course_id'])}"
        live = existing.get(cid)
        if live is None:
            missing += 1
            continue
        if live.get("concept_curated_by"):
            skipped_curated += 1
            continue
        if row.get("title_seen") and live.get("title") and row["title_seen"] != live["title"]:
            drifted += 1
            print(f"  title drift {cid}: classified {row['title_seen']!r}, live {live['title']!r}")
        ops.append(UpdateOne({"_id": cid}, {"$set": {
            "concept": row.get("concept"),
            "concept_source": MACHINE_SOURCE,
            "concept_confidence": float(row["confidence"]),
            "concept_title_seen": row.get("title_seen"),
            "concept_note": row.get("note") or "",
        }}, upsert=False))
    if ops:
        db["assist_courses"].bulk_write(ops, ordered=False)
    print(
        f"assist_courses updated ({len(ops)} rows; {skipped_curated} human-curated preserved; "
        f"{missing} not in catalog; {drifted} title drifts)."
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create sample fixtures and verify by dry run**

`scripts/data/prereq_concepts.sample.json`:

```json
{
  "_meta": { "purpose": "Sample for import_course_concepts.py --dry-run; the real vocabulary is prereq_concepts.json (generated in the classification session)." },
  "concepts": [
    { "slug": "calc_1", "name": "Calculus I", "discipline": "math", "requires": [], "note": "" },
    { "slug": "calc_2", "name": "Calculus II", "discipline": "math", "requires": ["calc_1"], "note": "" }
  ]
}
```

`scripts/data/course_concepts.sample.json`:

```json
{
  "meta": { "purpose": "Sample rows for --dry-run validation only." },
  "rows": [
    { "course_id": 303691, "institution_id": "cc:4", "concept": "calc_1", "confidence": 1.0, "title_seen": "Calculus I" },
    { "course_id": 303705, "institution_id": "cc:4", "concept": null, "confidence": 1.0, "title_seen": "College Study Skills" }
  ]
}
```

Run:
```bash
cd /Users/tybaltmallet/Desktop/transfer_pathways/internal_tool/scripts
python3 import_course_concepts.py --concepts-json data/prereq_concepts.sample.json --mapping-json data/course_concepts.sample.json --dry-run
```
Expected output includes `Concepts: 2 (1 with rules)`, `Mapping rows: 2 (1 mapped, 1 examined-not-relevant)`, `Dry run only; no DB writes.`
Also verify failure modes: temporarily add `"requires": ["calc_9"]` → exits `requires unknown concept 'calc_9'`; restore.

- [ ] **Step 3: Commit**

```bash
git add scripts/import_course_concepts.py scripts/data/prereq_concepts.sample.json scripts/data/course_concepts.sample.json
git commit -m "feat: course-concept importer with curated-row protection"
```

---

### Task 8: frontend data hooks

**Files:**
- Modify: `frontend/src/shared/query/hooks/useData.js` (REQUIREMENT_KIND ~line 190; invalidateCuratedData ~line 295; new hooks after useDeleteRefRow)

**Interfaces:**
- Consumes: endpoints from Tasks 1, 2, 4.
- Produces (later tasks import these exact names):
  - `usePrereqGraph(collegeId)` — `collegeId` is the numeric CC source id or null → payload of `/curated/prerequisite-graph`.
  - `useSaveCourseConcept()` — mutation taking `{ id: 'cc:<n>', concept: <slug|null>, note?: string }`.
  - `useRefTable('prereq_concepts')` / `useSaveRefRow('prereq_concepts')` / `useDeleteRefRow('prereq_concepts')` via the generic kind path.

- [ ] **Step 1: Implement**

1. Extend REQUIREMENT_KIND:

```js
const REQUIREMENT_KIND = {
  transfer_minimums: 'transfer_minimum',
  ge_patterns: 'ge_pattern',
  igetc_areas: 'igetc',
  prereq_concepts: 'prereq_concept',
}
```

2. Extend invalidateCuratedData (concept-rule edits must refresh the graph):

```js
const invalidateCuratedData = (qc, safeTable) => Promise.all([
  qc.invalidateQueries({ queryKey: ['ref-table', safeTable] }),
  qc.invalidateQueries({ queryKey: ['prereq-graph'] }),
  qc.invalidateQueries({
    predicate: (query) => String(query.queryKey[0] || '').startsWith('analysis-'),
  }),
  qc.invalidateQueries({ queryKey: ['degree-evaluation'] }),
])
```

3. Add after `useDeleteRefRow`:

```js
export function usePrereqGraph(collegeId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['prereq-graph', user?.uid, collegeId ?? 'all'],
    queryFn: () => apiClient
      .get('/curated/prerequisite-graph', {
        params: collegeId != null ? { college_id: `cc:${collegeId}` } : {},
      })
      .then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useSaveCourseConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, concept, note }) => apiClient
      .put(`/assist/courses/${encodeURIComponent(id)}/concept`, { concept, note })
      .then((r) => r.data),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['prereq-graph'] }),
      qc.invalidateQueries({ queryKey: ['cc-courses'] }),
      qc.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] || '').startsWith('analysis-'),
      }),
    ]),
  })
}
```

- [ ] **Step 2: Verify frontend still builds/tests green**

Run: `cd frontend && npm run test`
Expected: PASS (no test exercises the new hooks yet; this catches syntax/import errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/query/hooks/useData.js
git commit -m "feat: prereq-graph and course-concept data hooks"
```

---

### Task 9: Course-concepts References table

**Files:**
- Modify: `frontend/src/references/refTablesRegistry.js` (append entry to REFERENCE_TABLES)
- Modify: `frontend/src/DataReferences.jsx` (export `DataTable` and `useRowEditing`)
- Create: `frontend/src/prereqs/ConceptsTable.jsx`
- Test: `frontend/src/prereqs/ConceptsTable.test.jsx`

**Interfaces:**
- Consumes: generic ref-table machinery (`useRefTable('prereq_concepts')`, `RefRowModal`, exported `DataTable`/`useRowEditing`).
- Produces: `<ConceptsTable />` — mounted by Task 11's PrerequisitesTab.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/prereqs/ConceptsTable.test.jsx`:

```jsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConceptsTable from './ConceptsTable'
import { refTableByKey } from '../references/refTablesRegistry'

vi.mock('../shared/query/hooks/useData', () => ({
  useRefTable: () => ({
    data: { rows: [
      { _id: 'prereq_concept:calc_2', slug: 'calc_2', name: 'Calculus II', discipline: 'math', requires: ['calc_1'], note: '' },
    ] },
    isLoading: false, isError: false,
  }),
  useDeleteRefRow: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveRefRow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUniversityCourses: () => ({ data: [], isLoading: false }),
}))

describe('ConceptsTable', () => {
  it('renders concept rows with their rules', () => {
    render(<ConceptsTable />)
    expect(screen.getByText('Calculus II')).toBeInTheDocument()
    expect(screen.getByText('calc_1')).toBeInTheDocument()
  })
})

describe('prereq_concepts registry entry', () => {
  it('derives the id from the slug', () => {
    const config = refTableByKey('prereq_concepts')
    expect(config.makeId({ slug: 'calc_2' })).toBe('calc_2')
    expect(config.newRow().requires).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/prereqs/ConceptsTable.test.jsx`
Expected: FAIL — module not found / no registry entry.

- [ ] **Step 3: Implement**

1. In `DataReferences.jsx`, change `function useRowEditing(` → `export function useRowEditing(` and `function DataTable(` → `export function DataTable(`.

2. Append to REFERENCE_TABLES in `refTablesRegistry.js`:

```js
  {
    key: 'prereq_concepts',
    label: 'Course concepts',
    description:
      'Canonical pathway concepts and their prerequisite rules — the normative statewide model courses map onto.',
    columns: ['slug', 'name', 'discipline', 'requires'],
    fields: [
      { key: 'slug', label: 'Slug', type: 'text', idOnCreate: true, placeholder: 'calc_2' },
      { key: 'name', label: 'Name', type: 'text', placeholder: 'Calculus II' },
      {
        key: 'discipline', label: 'Discipline', type: 'select',
        options: ['math', 'physics', 'chem', 'cs', 'bio', 'engr', 'stats', 'other']
          .map((value) => ({ value, label: value })),
      },
      { key: 'requires', label: 'Requires (concept slugs)', type: 'tags' },
      { key: 'note', label: 'Note', type: 'text', placeholder: 'e.g. conservative: calc_3 required statewide' },
    ],
    makeId: (row) => row.slug,
    newRow: () => ({ slug: '', name: '', discipline: 'math', requires: [], note: '' }),
    searchText: (r) => `${r.slug} ${r.name} ${r.discipline} ${(r.requires || []).join(' ')}`,
  },
```

3. Create `frontend/src/prereqs/ConceptsTable.jsx`:

```jsx
import React, { useMemo, useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack } from '../components/ui'
import { useRefTable } from '../shared/query/hooks/useData'
import { DataTable, useRowEditing } from '../DataReferences'
import RefRowModal from '../references/RefRowModal'

// Data → Prerequisites → Concepts: the editable canonical vocabulary + rules.
export default function ConceptsTable() {
  const q = useRefTable('prereq_concepts')
  const ed = useRowEditing('prereq_concepts')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const all = (q.data?.rows || []).slice()
      .sort((a, b) => String(a.discipline).localeCompare(String(b.discipline))
        || String(a.slug).localeCompare(String(b.slug)))
    const needle = query.trim().toLowerCase()
    if (!needle) return all
    return all.filter((r) => ed.config.searchText(r).toLowerCase().includes(needle))
  }, [q.data, query, ed.config])

  if (q.isLoading) return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  if (q.isError) return <Alert type='error'>Failed to load the concept table.</Alert>

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Find concept…'
          className='bg-canvas border border-border rounded-pill px-3 py-[7px] text-[13px] text-ink placeholder:text-ink-subtle outline-none' />
        <Button className='ml-auto' leadingIcon={PlusIcon} onClick={() => ed.openAdd()}>Add concept</Button>
      </div>
      {!rows.length ? (
        <EmptyState title='No concepts yet'
          description='Add concepts here or run scripts/import_course_concepts.py after the classification session.' />
      ) : (
        <DataTable
          rows={rows}
          onEdit={ed.openEdit} onDelete={ed.remove} deleting={ed.deleting}
          columns={[
            { key: 'slug', label: 'Slug', render: (r) => <span className='font-mono'>{r.slug}</span> },
            { key: 'name', label: 'Name', cellClassName: 'text-ink' },
            { key: 'discipline', label: 'Discipline' },
            {
              key: 'requires', label: 'Requires',
              render: (r) => (r.requires || []).length
                ? <span className='inline-flex flex-wrap gap-1.5'>
                    {(r.requires || []).map((s) => <span key={s} className='chip font-mono'>{s}</span>)}
                  </span>
                : '-',
            },
            { key: 'note', label: 'Note' },
          ]} />
      )}
      <RefRowModal config={ed.config} editing={ed.editing} onClose={ed.close} />
    </Stack>
  )
}
```

- [ ] **Step 4: Run to verify pass (full frontend suite — the DataReferences exports must not break its tests)**

Run: `cd frontend && npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/references/refTablesRegistry.js frontend/src/DataReferences.jsx frontend/src/prereqs/ConceptsTable.jsx frontend/src/prereqs/ConceptsTable.test.jsx
git commit -m "feat: course-concepts References table"
```

---

### Task 10: concept-mapping editor

**Files:**
- Create: `frontend/src/prereqs/ConceptMappingTable.jsx`
- Test: `frontend/src/prereqs/ConceptMappingTable.test.jsx`

**Interfaces:**
- Consumes: `usePrereqGraph(collegeId)`, `useSaveCourseConcept()`, `useColleges()` (existing), `DataTable` (Task 9 export), UI primitives (`Combobox`, `Modal`, `Select`, `Input`, `Switch`, `Badge`).
- Produces: `<ConceptMappingTable />` — mounted by Task 11.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/prereqs/ConceptMappingTable.test.jsx`:

```jsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConceptMappingTable from './ConceptMappingTable'

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [{ id: 4, source_id: 4, name: 'College of Marin' }], isLoading: false }),
  usePrereqGraph: () => ({
    data: {
      concepts: [{ slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [] }],
      rules: [],
      stats: { in_scope: 2, examined: 1, mapped: 1, edges: 0, phantom_course_ids: [] },
      courses: [
        { key: 'cc:1', prefix: 'MATH', number: '3A', title: 'Calculus I', units: 5, concept: 'calc_1', concept_source: 'llm_session_v1', concept_confidence: 1, in_scope: true },
        { key: 'cc:2', prefix: 'CS', number: '10', title: 'Intro CS', units: 4, concept: null, concept_source: null, concept_confidence: null, in_scope: true },
      ],
      edges: [],
      legacy: null,
    },
    isLoading: false, isError: false,
  }),
  useSaveCourseConcept: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('ConceptMappingTable', () => {
  it('lists in-scope courses with their concepts and flags unexamined rows', () => {
    render(<ConceptMappingTable initialCollegeId={4} />)
    expect(screen.getByText(/MATH 3A/)).toBeInTheDocument()
    expect(screen.getByText('calc_1')).toBeInTheDocument()
    expect(screen.getByText('Not examined')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/prereqs/ConceptMappingTable.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/prereqs/ConceptMappingTable.jsx`:

```jsx
import React, { useMemo, useState } from 'react'
import { Alert, Badge, Button, Combobox, Input, Modal, Select, Spinner, Stack, Switch } from '../components/ui'
import { useColleges, usePrereqGraph, useSaveCourseConcept } from '../shared/query/hooks/useData'
import { DataTable } from '../DataReferences'

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

// Data → Prerequisites → Mapping: which concept each in-scope course carries.
// Rows come from the graph endpoint (it knows the in-scope set); edits go
// through PUT /assist/courses/:id/concept.
export default function ConceptMappingTable({ initialCollegeId = null }) {
  const colleges = useColleges()
  const [collegeId, setCollegeId] = useState(initialCollegeId)
  const graph = usePrereqGraph(collegeId)
  const save = useSaveCourseConcept()
  const [query, setQuery] = useState('')
  const [unmappedOnly, setUnmappedOnly] = useState(false)
  const [editing, setEditing] = useState(null) // { key, label, concept, note }

  const collegeOptions = useMemo(
    () => (colleges.data || []).map((c) => ({ value: c.source_id, label: c.name })),
    [colleges.data]
  )
  const conceptOptions = useMemo(() => [
    { value: '', label: 'None (not a pathway concept)' },
    ...(graph.data?.concepts || []).map((c) => ({ value: c.slug, label: `${c.name} (${c.slug})` })),
  ], [graph.data])

  const rows = useMemo(() => {
    const all = graph.data?.courses || []
    const needle = query.trim().toLowerCase()
    return all.filter((r) => {
      if (unmappedOnly && r.concept) return false
      if (!needle) return true
      return `${r.prefix} ${r.number} ${r.title} ${r.concept || ''}`.toLowerCase().includes(needle)
    })
  }, [graph.data, query, unmappedOnly])

  const commit = async () => {
    await save.mutateAsync({ id: editing.key, concept: editing.concept || null, note: editing.note })
    setEditing(null)
  }

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='w-72'>
          <Combobox value={collegeId} onChange={setCollegeId} options={collegeOptions}
            placeholder='Pick a community college…' />
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Find course…'
          className='bg-canvas border border-border rounded-pill px-3 py-[7px] text-[13px] text-ink placeholder:text-ink-subtle outline-none' />
        <label className='ml-auto inline-flex items-center gap-2 text-caption text-ink-muted'>
          <Switch checked={unmappedOnly} onChange={setUnmappedOnly} /> unmapped only
        </label>
      </div>

      {collegeId == null && <Alert type='info'>Pick a college to review its in-scope courses.</Alert>}
      {collegeId != null && graph.isLoading && (
        <div className='surface-card p-10 flex justify-center'><Spinner /></div>
      )}
      {collegeId != null && graph.isError && <Alert type='error'>Failed to load the mapping.</Alert>}
      {collegeId != null && graph.data && (
        <DataTable
          rows={rows}
          onEdit={(r) => setEditing({
            key: r.key, label: `${r.prefix} ${r.number} — ${r.title}`,
            concept: r.concept || '', note: '',
          })}
          columns={[
            {
              key: 'code', label: 'Course', cellClassName: 'text-ink',
              render: (r) => <span>{r.prefix} {r.number}</span>,
            },
            { key: 'title', label: 'Title' },
            { key: 'units', label: 'Units', render: (r) => r.units ?? '-' },
            {
              key: 'concept', label: 'Concept',
              render: (r) => r.concept
                ? <span className='chip font-mono'>{r.concept}</span>
                : r.concept_source
                  ? <span className='text-ink-subtle'>none (examined)</span>
                  : <Badge tone='warning'>Not examined</Badge>,
            },
            { key: 'concept_confidence', label: 'Confidence', render: (r) => pct(r.concept_confidence) },
            { key: 'concept_source', label: 'Source', render: (r) => r.concept_source ?? '-' },
            {
              key: 'in_scope', label: 'In scope',
              render: (r) => (r.in_scope ? 'yes' : <span className='text-ink-subtle'>manual</span>),
            },
          ]} />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.label || ''}>
        {editing && (
          <Stack gap='cozy'>
            <div>
              <p className='field-label'>Concept</p>
              <Select value={editing.concept} options={conceptOptions}
                onChange={(v) => setEditing({ ...editing, concept: v })} />
            </div>
            <div>
              <p className='field-label'>Note</p>
              <Input value={editing.note} placeholder='optional'
                onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </div>
            <div className='flex justify-end gap-2'>
              <Button variant='ghost' onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={commit} disabled={save.isPending}>Save</Button>
            </div>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
```

**Note:** the `initialCollegeId` prop exists so the test can render the table without driving the Combobox in jsdom; the app always mounts it with no props (picker starts empty).

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npx vitest run src/prereqs/ConceptMappingTable.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/prereqs/ConceptMappingTable.jsx frontend/src/prereqs/ConceptMappingTable.test.jsx
git commit -m "feat: concept-mapping editor table"
```

---

### Task 11: graph view + Prerequisites sub-tab + DataPage wiring

**Files:**
- Create: `frontend/src/prereqs/dagLayout.js`
- Create: `frontend/src/prereqs/ConceptGraphView.jsx`
- Create: `frontend/src/prereqs/PrerequisitesTab.jsx`
- Modify: `frontend/src/DataPage.jsx` (DATA_TAB_ROUTES ~line 50; SubNav options + render branch ~lines 92-105)
- Test: `frontend/src/prereqs/dagLayout.test.js`, `frontend/src/prereqs/PrerequisitesTab.test.jsx`

**Interfaces:**
- Consumes: `usePrereqGraph`, `useColleges`, `StatStrip`, `Combobox`, Tabs; `ConceptsTable` (Task 9), `ConceptMappingTable` (Task 10).
- Produces: `dagLayout.js` exports `layoutDag(nodes, edges)` → `{ columns: [[nodeId,…],…], depthOf: Map }`; `<PrerequisitesTab />` mounted as the Data → Prerequisites tab.

- [ ] **Step 1: Write the failing layout test**

Create `frontend/src/prereqs/dagLayout.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { layoutDag } from './dagLayout'

describe('layoutDag', () => {
  it('assigns longest-path depths as columns', () => {
    const nodes = [{ id: 'calc_1' }, { id: 'calc_2' }, { id: 'calc_3' }, { id: 'stats_1' }]
    const edges = [
      { from: 'calc_1', to: 'calc_2' },
      { from: 'calc_2', to: 'calc_3' },
      { from: 'calc_1', to: 'stats_1' },
    ]
    const { columns, depthOf } = layoutDag(nodes, edges)
    expect(depthOf.get('calc_1')).toBe(0)
    expect(depthOf.get('calc_2')).toBe(1)
    expect(depthOf.get('stats_1')).toBe(1)
    expect(depthOf.get('calc_3')).toBe(2)
    expect(columns[0]).toEqual(['calc_1'])
    expect(columns[2]).toEqual(['calc_3'])
  })

  it('survives edges referencing unknown nodes and cycles', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }]
    const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'ghost', to: 'a' }]
    const { depthOf } = layoutDag(nodes, edges)
    expect(depthOf.size).toBe(2)
  })
})
```

- [ ] **Step 2: Implement the layout**

Create `frontend/src/prereqs/dagLayout.js`:

```js
// Longest-path layering for a small DAG (≤ ~100 nodes). Pure: no DOM, no
// randomness — geometry only; callers turn columns into SVG coordinates.
export function layoutDag(nodes, edges) {
  const ids = new Set(nodes.map((n) => n.id))
  const preds = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    if (ids.has(e.from) && ids.has(e.to)) preds.get(e.to).push(e.from)
  }
  const memo = new Map()
  const depth = (id, seen) => {
    if (memo.has(id)) return memo.get(id)
    if (seen.has(id)) return 0 // cycle guard; validation keeps real data acyclic
    seen.add(id)
    const d = (preds.get(id) || []).reduce((best, p) => Math.max(best, depth(p, seen) + 1), 0)
    memo.set(id, d)
    return d
  }
  const depthOf = new Map(nodes.map((n) => [n.id, depth(n.id, new Set())]))
  const maxDepth = Math.max(0, ...depthOf.values())
  const columns = Array.from({ length: maxDepth + 1 }, () => [])
  for (const n of nodes) columns[depthOf.get(n.id)].push(n.id)
  for (const col of columns) col.sort()
  return { columns, depthOf }
}
```

Run: `cd frontend && npx vitest run src/prereqs/dagLayout.test.js` — expected PASS.

- [ ] **Step 3: Implement the graph view**

Create `frontend/src/prereqs/ConceptGraphView.jsx`:

```jsx
import React, { useMemo, useState } from 'react'
import { Alert, Combobox, Spinner, Stack, StatStrip } from '../components/ui'
import { useColleges, usePrereqGraph } from '../shared/query/hooks/useData'
import { layoutDag } from './dagLayout'

const NODE_W = 168
const NODE_H = 44
const COL_GAP = 72
const ROW_GAP = 18
const PAD = 16

// Hand-built layered DAG per house chart rules: CSS vars carry color, inline
// attributes carry geometry, every mark has a title, and a rules table below
// keeps everything reachable without hover.
function DagSvg({ nodes, edges, hollowIds = new Set() }) {
  const { columns, depthOf } = layoutDag(nodes, edges)
  const pos = new Map()
  columns.forEach((col, ci) => {
    col.forEach((id, ri) => {
      pos.set(id, { x: PAD + ci * (NODE_W + COL_GAP), y: PAD + ri * (NODE_H + ROW_GAP) })
    })
  })
  const width = PAD * 2 + columns.length * NODE_W + (columns.length - 1) * COL_GAP
  const height = PAD * 2 + Math.max(...columns.map((c) => c.length), 1) * (NODE_H + ROW_GAP) - ROW_GAP
  const byId = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div className='surface-card p-3 overflow-x-auto'>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, maxWidth: 'none' }} role='img'
        aria-label='Prerequisite graph: arrows point from a prerequisite to the course that requires it'>
        {edges.map((e, i) => {
          const a = pos.get(e.from); const b = pos.get(e.to)
          if (!a || !b) return null
          const x1 = a.x + NODE_W; const y1 = a.y + NODE_H / 2
          const x2 = b.x; const y2 = b.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          return (
            <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill='none' stroke='var(--color-border-strong, #8a8a8a)' strokeWidth='1.5'>
              <title>{`${byId.get(e.from)?.label ?? e.from} → ${byId.get(e.to)?.label ?? e.to}`}</title>
            </path>
          )
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)
          const hollow = hollowIds.has(n.id)
          return (
            <g key={n.id} transform={`translate(${p.x}, ${p.y})`}>
              <title>{n.title || n.label}</title>
              <rect width={NODE_W} height={NODE_H} rx='10'
                fill={hollow ? 'transparent' : 'var(--color-surface, #fff)'}
                stroke='var(--color-border, #d4d4d4)'
                strokeDasharray={hollow ? '5 4' : 'none'} strokeWidth='1.25' />
              <text x='12' y='19' fontSize='12.5' fontWeight='600'
                fill='var(--color-ink, #1a1a1a)'>{n.label}</text>
              <text x='12' y='34' fontSize='10.5'
                fill='var(--color-ink-subtle, #7a7a7a)'>{n.sub || ''}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function ConceptGraphView() {
  const colleges = useColleges()
  const [collegeId, setCollegeId] = useState(null)
  const graph = usePrereqGraph(collegeId)

  const collegeOptions = useMemo(() => [
    { value: null, label: 'Canonical concepts (no college)' },
    ...(colleges.data || []).map((c) => ({ value: c.source_id, label: c.name })),
  ], [colleges.data])

  if (graph.isLoading) return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  if (graph.isError) return <Alert type='error'>Failed to load the prerequisite graph.</Alert>
  const d = graph.data

  let nodes; let edges; let hollow = new Set()
  if (collegeId == null) {
    nodes = d.concepts.map((c) => ({
      id: c.slug, label: c.name, sub: c.discipline,
      title: `${c.name} (${c.slug})${c.requires.length ? ` — requires ${c.requires.join(', ')}` : ''}${c.note ? ` · ${c.note}` : ''}`,
    }))
    edges = d.rules
  } else {
    const mapped = (d.courses || []).filter((c) => c.concept)
    nodes = mapped.map((c) => ({
      id: c.key, label: `${c.prefix} ${c.number}`, sub: c.concept,
      title: `${c.prefix} ${c.number} — ${c.title} (${c.concept})`,
    }))
    // Concepts with no course here render hollow so the gap is visible.
    const present = new Set(mapped.map((c) => c.concept))
    const missing = d.concepts.filter((c) => !present.has(c.slug))
    nodes = nodes.concat(missing.map((c) => ({
      id: `concept:${c.slug}`, label: c.name, sub: 'no course here',
      title: `${c.name}: no ${c.slug} course at this college`,
    })))
    hollow = new Set(missing.map((c) => `concept:${c.slug}`))
    edges = d.edges
  }

  const s = d.stats
  const tiles = collegeId == null
    ? [
      { label: 'Concepts', value: d.concepts.length },
      { label: 'Rules', value: d.rules.length },
      { label: 'In-scope courses (statewide)', value: s.in_scope },
      { label: 'Examined', value: s.examined, accent: s.examined >= s.in_scope && s.in_scope > 0 },
    ]
    : [
      { label: 'In-scope courses', value: s.in_scope },
      {
        label: 'Examined', value: s.in_scope ? `${Math.round((s.examined / s.in_scope) * 100)}%` : '—',
        sub: `${s.examined} of ${s.in_scope}`, accent: s.examined === s.in_scope && s.in_scope > 0,
      },
      { label: 'Edges', value: s.edges },
      d.legacy
        ? {
          label: 'Legacy agreement', value: d.legacy.legacy_edges
            ? `${Math.round((d.legacy.shared_edges / d.legacy.legacy_edges) * 100)}%`
            : '—',
          sub: `${d.legacy.shared_edges} of ${d.legacy.legacy_edges} legacy edges reproduced`,
        }
        : { label: 'Legacy rows', value: 'none', sub: 'previous group had no data here' },
    ]

  return (
    <Stack gap='cozy'>
      <div className='flex items-center gap-3'>
        <div className='w-80'>
          <Combobox value={collegeId} onChange={setCollegeId} options={collegeOptions}
            placeholder='Canonical concepts (no college)' />
        </div>
      </div>
      <StatStrip tiles={tiles} />
      {nodes.length
        ? <DagSvg nodes={nodes} edges={edges} hollowIds={hollow} />
        : <Alert type='info'>Nothing to draw yet — add concepts or run the importer.</Alert>}
      <div className='surface-card px-[22px] py-[18px]'>
        <p className='text-label mb-2.5'>Rules</p>
        <table className='min-w-full text-left'>
          <thead><tr>
            <th className='text-label pb-2 pr-6'>Concept</th>
            <th className='text-label pb-2'>Requires</th>
          </tr></thead>
          <tbody>
            {d.concepts.map((c) => (
              <tr key={c.slug} className='border-t border-border/40'>
                <td className='py-2 pr-6 text-caption text-ink'>{c.name} <span className='font-mono text-ink-subtle'>({c.slug})</span></td>
                <td className='py-2 text-caption text-ink-muted font-mono'>{c.requires.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  )
}
```

- [ ] **Step 4: Implement the tab + DataPage wiring**

Create `frontend/src/prereqs/PrerequisitesTab.jsx`:

```jsx
import React, { useState } from 'react'
import { Stack, Tabs } from '../components/ui'
import ConceptGraphView from './ConceptGraphView'
import ConceptsTable from './ConceptsTable'
import ConceptMappingTable from './ConceptMappingTable'

// Data → Prerequisites: the concept graph plus its two editors.
export default function PrerequisitesTab() {
  const [view, setView] = useState('graph')
  return (
    <Stack gap='cozy'>
      <Tabs value={view} onChange={setView} options={[
        { value: 'graph', label: 'Graph' },
        { value: 'concepts', label: 'Concepts' },
        { value: 'mapping', label: 'Mapping' },
      ]} />
      {view === 'graph' && <ConceptGraphView />}
      {view === 'concepts' && <ConceptsTable />}
      {view === 'mapping' && <ConceptMappingTable />}
    </Stack>
  )
}
```

In `DataPage.jsx`:

1. `import PrerequisitesTab from './prereqs/PrerequisitesTab'` (with the other imports).
2. Add to DATA_TAB_ROUTES: `prerequisites: { path: '/api/curated/prerequisite-graph' },`
3. Add to the SubNav options array: `{ value: 'prerequisites', label: 'Prerequisites' },` (after `courses`).
4. Add the render branch: `{tab === 'prerequisites' && <PrerequisitesTab />}`.

- [ ] **Step 5: Write and run the smoke test**

Create `frontend/src/prereqs/PrerequisitesTab.test.jsx`:

```jsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrerequisitesTab from './PrerequisitesTab'

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [], isLoading: false }),
  usePrereqGraph: () => ({
    data: {
      concepts: [
        { slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [], note: '' },
        { slug: 'calc_2', name: 'Calculus II', discipline: 'math', requires: ['calc_1'], note: '' },
      ],
      rules: [{ from: 'calc_1', to: 'calc_2' }],
      stats: { in_scope: 0, examined: 0 },
    },
    isLoading: false, isError: false,
  }),
  useSaveCourseConcept: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRefTable: () => ({ data: { rows: [] }, isLoading: false, isError: false }),
  useDeleteRefRow: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveRefRow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUniversityCourses: () => ({ data: [], isLoading: false }),
}))

describe('PrerequisitesTab', () => {
  it('renders the concept DAG with nodes and the rules table', () => {
    render(<PrerequisitesTab />)
    expect(screen.getAllByText('Calculus II').length).toBeGreaterThan(0)
    expect(screen.getByText('Rules')).toBeInTheDocument()
  })
})
```

Run: `cd frontend && npm run test`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/prereqs/ frontend/src/DataPage.jsx
git commit -m "feat: Prerequisites sub-tab with concept DAG, editors, and stats"
```

---

### Task 12: end-to-end verification of the plumbing

**Files:** none created — verification gate before the data-generation phase.

- [ ] **Step 1: Full test suites**

```bash
cd /Users/tybaltmallet/Desktop/transfer_pathways/internal_tool/server && npm test
cd /Users/tybaltmallet/Desktop/transfer_pathways/internal_tool/frontend && npm run test
```
Expected: all green.

- [ ] **Step 2: Drive the running app (verify skill)**

Start dev (`npm run dev` in server/ and frontend/ per the repo's local workflow — online dev uses Atlas; if offline use `dev:local` against the local mongod). Then, in the console:
1. Data → Prerequisites → Concepts: add `calc_1` (Calculus I, math, no requires), then `calc_2` requiring `calc_1`. Try a cycle (`calc_1` requiring `calc_2`) — expect the inline 400 error surfaced in the modal.
2. Mapping: pick a college, set a real course to `calc_1`, another to `calc_2`.
3. Graph: college view shows the projected edge; canonical view shows the two-node DAG; StatStrip numbers move.
4. Visuals → Complexity: still renders (edges now come from the projection).
5. Delete the test concepts/mappings afterward (clear concept via the mapping editor; delete concepts in reverse order).

- [ ] **Step 3: Commit any fixes surfaced, then checkpoint with Tybalt before Phase G**

---

## Phase G — generation session (in-session LLM pipeline, spec §5)

These tasks run in a Claude Code session, not as repo code. Artifacts land in `scripts/data/` and go through Tybalt's review gates. **No step here writes `concept_curated_by` or any verification note.**

### Task G1: enumerate the in-scope inventory

- [ ] Dump the classification inventory from the local `pmt_research` copy (refresh it first if stale: `server/scripts/dev-db.sh pull`):

```bash
mongosh pmt_research --quiet --eval '
const ids = new Set();
db.assist_agreements.find({}, {requirement_groups:1}).forEach((doc) => {
  for (const g of doc.requirement_groups || [])
    for (const s of g.sections || [])
      for (const r of s.receivers || [])
        for (const o of r.options || [])
          for (const cid of o.course_ids || []) ids.add(Number(cid));
});
const rows = db.assist_courses.find(
  { side: "sending", course_id: { $in: [...ids] } },
  { course_id: 1, institution_id: 1, community_college_name: 1, prefix: 1, number: 1, title: 1, units: 1 }
).toArray();
print(JSON.stringify(rows));
' > /tmp/in_scope_courses.json
```

Also dump the 230 UC receiving courses (`side: "receiving"`, `parent_id` in agreement receivers) the same way — they anchor the vocabulary to what UCs actually ask for.

### Task G2: vocabulary draft → full human review

- [ ] Run a workflow that clusters the inventory (agents propose concepts + rules from the UC asks and CC course titles; synthesize; dedupe).
- [ ] Write `scripts/data/prereq_concepts.json` with a `_meta` block (purpose, authoring date, session/model, and the normative-call notes, e.g. "linear_alg requires calc_3 statewide — conservative").
- [ ] **Gate: Tybalt reviews the entire vocabulary + rules** and edits until approved. Nothing proceeds before this.

### Task G3: classification

- [ ] Batch the in-scope CC courses by subject-prefix family across colleges; each batch classified independently by 2 agents (input per course: `PREFIX NUMBER — Title (units) @ College`); disagreement → third vote; 2-of-3 → confidence 0.67, unanimous → 1.0, unresolved → flag.
- [ ] Write `scripts/data/course_concepts.json`: `meta` (session date, model, vote protocol, vocabulary version — error rate added in G4) + `rows` per the Task 7 schema, `flags` on ambiguous rows.

### Task G4: QA gates

- [ ] **Legacy conflicts:** run `python3 - <<'EOF'` script (or a session workflow) that projects edges for the 16 legacy colleges from the draft artifacts (reuse `projectEdges` semantics) and diffs against `curated_prerequisites.prerequisite_ids` — one report row per differing course. Tybalt verdicts each: ours-right / theirs-right (theirs-right → fix the mapping or a rule).
- [ ] **Flagged rows:** Tybalt resolves every flagged classification.
- [ ] **Random sample:** draw 100 rows (seeded shuffle), Tybalt judges each; record the measured error rate in `course_concepts.json` → `meta.sample_error_rate` with `meta.sample_n = 100`.

### Task G5: import, verify, document, commit

- [ ] `python3 scripts/import_course_concepts.py --dry-run` then real run against the local DB; spot-check the console (graph view for 2–3 colleges incl. one legacy college; complexity coverage now near-100% for mapped pathways).
- [ ] **Ask Tybalt** before running the importer against Atlas.
- [ ] Write `docs/prereq-concepts.md`: the re-run procedure (new majors → enumerate `concept_source`-absent in-scope courses → classify only those → append to artifact → re-import) and where every gate lives.
- [ ] Final commit of artifacts + docs on the branch; ask Tybalt about merging/pushing.

---

## Self-review notes (spec coverage)

- Spec §1A concepts/validation → Task 1. §1B fields/importer/carry-forward → Tasks 2, 6, 7. §1C legacy demotion → Tasks 3 (legacy overlap), 5 (consumer switch), G4 (conflict verdicts).
- §2 projection/transitive fallback/same_as → Task 3 (same_as: classification treats cross-listed peers independently; flag comparison happens in G3/G4 prompts — no code path needed).
- §3 endpoints → Tasks 1, 2, 4. §4 frontend → Tasks 8–11. §5 pipeline → G1–G5. §6 testing → every task + Task 12.
- Deliberately not done: index on concept fields (complexity already full-scans courses; YAGNI), UC-side prereqs (out of scope), sequencing analysis (follow-up).
