# AS-Degree Slots and Empty-Slot Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every major three major-neutral associate-degree slots (`ast`, `local_as`, `local_other`) at every college, and let a researcher create a record in an empty slot from the college page without a scrape.

**Architecture:** The `degree_type` field stops naming a major and becomes a pure slot. The major moves into `major_slug`, which must be a configured major from `server/config/majors.js`, and into the row id, which grows from `<ccId>:<slot>` to `<ccId>:<major>:<slot>`. A one-shot migration rewrites the existing CS rows and the two statewide templates. The frontend then renders all three slots unconditionally per major, and an empty slot renders a creator: a header form for the five scalars the validator demands, plus the existing JSON panel and AI briefing for the requirement groups.

**Tech Stack:** Node 20 (CommonJS) + Express + MongoDB driver 6 on the server; React 18 + TanStack Query + Tailwind on the frontend; Vitest on both sides.

## Global Constraints

- Server code is CommonJS (`require`/`module.exports`). Frontend code is ESM.
- Server tests: `cd server && npx vitest run <path>`. Frontend tests: `cd frontend && npx vitest run <path>`.
- **Never add a `Co-Authored-By: Claude` trailer to any commit in this repo.**
- Commit style matches the log: `feat(scope): lowercase imperative summary` / `refactor(scope): …` / `test(scope): …`.
- **Never write, generate, or edit a verification note** (`doc.verification.note`) or any other user-authored prose. Those are written by hand by the researcher.
- The slot vocabulary has exactly one server-side source of truth (`server/config/asDegreeSlots.js`) and one frontend source (`frontend/src/asdegrees/asDegreeSlots.js`). No file may hardcode the strings `'local_cs_as'` or `'local_computing'` after Task 6, except the migration script's legacy map.
- `capabilities.asDegrees` in `server/config/majors.js` keeps gating the **analysis** layer (`server/controllers/Analysis.js:182`). Do not remove or weaken that guard. Only the frontend display gate is dropped.
- `major_slug` defaults to `'cs'` everywhere a caller omits it, so untouched callers keep working through Phase A.

---

# Phase A — Slot vocabulary, major-scoped identity, migration

## Task 1: Slot vocabulary module

**Files:**
- Create: `server/config/asDegreeSlots.js`
- Test: `server/config/asDegreeSlots.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `AS_DEGREE_SLOTS: string[]`, `SLOT_LABELS: Record<string,string>`, `LEGACY_TYPE_TO_SLOT: Record<string,string>`, `asDegreeRowId(collegeId: number|string, majorSlug: string, slot: string): string`, `parseAsDegreeRowId(rawId: string): {communityCollegeId: number, majorSlug: string, slot: string} | null`.

- [ ] **Step 1: Write the failing test**

Create `server/config/asDegreeSlots.test.js`:

```js
const { describe, it, expect } = require('vitest');
const {
  AS_DEGREE_SLOTS, LEGACY_TYPE_TO_SLOT, asDegreeRowId, parseAsDegreeRowId,
} = require('./asDegreeSlots');

describe('as-degree slots', () => {
  it('is exactly the three major-neutral slots', () => {
    expect(AS_DEGREE_SLOTS).toEqual(['ast', 'local_as', 'local_other']);
  });

  it('maps every pre-migration CS type onto a slot', () => {
    expect(LEGACY_TYPE_TO_SLOT).toEqual({
      ast: 'ast', local_cs_as: 'local_as', local_computing: 'local_other',
    });
  });

  it('round-trips a row id through build and parse', () => {
    expect(asDegreeRowId(110, 'cs', 'ast')).toBe('110:cs:ast');
    expect(parseAsDegreeRowId('110:cs:ast'))
      .toEqual({ communityCollegeId: 110, majorSlug: 'cs', slot: 'ast' });
  });

  it('rejects a pre-migration two-segment id', () => {
    expect(parseAsDegreeRowId('110:ast')).toBeNull();
    expect(parseAsDegreeRowId('')).toBeNull();
    expect(parseAsDegreeRowId('cc110:cs:ast')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run config/asDegreeSlots.test.js`
Expected: FAIL — `Cannot find module './asDegreeSlots'`

- [ ] **Step 3: Write the implementation**

Create `server/config/asDegreeSlots.js`:

```js
/**
 * The three associate-degree slots every major carries at every college.
 *
 * Major-neutral on purpose: before this, 'local_cs_as' baked Computer Science
 * into the type name while 'ast' was shared, so a second major could neither
 * reuse the vocabulary nor avoid colliding with CS. The major now lives in the
 * document's major_slug and in the row id, never in the slot name.
 */
const AS_DEGREE_SLOTS = Object.freeze(['ast', 'local_as', 'local_other']);

/** Tab and chip copy. The major supplies the subject; the slot the award. */
const SLOT_LABELS = Object.freeze({
  ast: 'A.S.-T',
  local_as: 'Local A.S.',
  local_other: 'Other',
});

/**
 * Pre-migration CS type names to slots. The ONLY place these strings may
 * appear after the migration lands — scripts/migrateAsDegreeSlots.js reads it
 * to rewrite historical rows, and nothing else should.
 */
const LEGACY_TYPE_TO_SLOT = Object.freeze({
  ast: 'ast',
  local_cs_as: 'local_as',
  local_computing: 'local_other',
});

const AS_DEGREE_ID_RE = /^(\d+):([a-z0-9_]+):([a-z0-9_]+)$/;

/** `<communityCollegeId>:<majorSlug>:<slot>` — the as_degree legacy_id. */
function asDegreeRowId(collegeId, majorSlug, slot) {
  return `${Number(collegeId)}:${majorSlug}:${slot}`;
}

/** Null for anything that is not a three-segment id, including the old form. */
function parseAsDegreeRowId(rawId) {
  const match = AS_DEGREE_ID_RE.exec(String(rawId ?? ''));
  if (!match) return null;
  return {
    communityCollegeId: Number(match[1]),
    majorSlug: match[2],
    slot: match[3],
  };
}

module.exports = {
  AS_DEGREE_SLOTS,
  SLOT_LABELS,
  LEGACY_TYPE_TO_SLOT,
  asDegreeRowId,
  parseAsDegreeRowId,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run config/asDegreeSlots.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add server/config/asDegreeSlots.js server/config/asDegreeSlots.test.js
git commit -m "feat(as-degrees): a major-neutral slot vocabulary"
```

---

## Task 2: Validator accepts the major-scoped identity

**Files:**
- Modify: `server/controllers/CanonicalData.js:99` (delete `AS_DEGREE_TYPES`), `:221-234` (id and major checks), `:680` (query validation)
- Test: `server/services/asDegreeValidation.test.js`

**Interfaces:**
- Consumes: `AS_DEGREE_SLOTS`, `parseAsDegreeRowId` from Task 1; `getMajor`, `listMajors` from `server/config/majors.js`.
- Produces: `validateAsDegree(db, canonical): Promise<string|null>` — unchanged signature, new rules.

- [ ] **Step 1: Write the failing test**

Append to `server/services/asDegreeValidation.test.js`:

```js
describe('major-scoped as_degree identity', () => {
  // A minimal non-'found' row: status short-circuits before the catalog fields.
  const row = (over = {}) => ({
    legacy_id: '110:cs:ast',
    community_college_id: 110,
    college_id: 'cc:110',
    degree_type: 'ast',
    major_slug: 'cs',
    status: 'none_found',
    ...over,
  });
  const db = fakeDb({ 'cc:110': { kind: 'community_college' } });

  it('accepts a three-segment id whose segments all agree', async () => {
    expect(await validateAsDegree(db, row())).toBeNull();
  });

  it('rejects the pre-migration two-segment id', async () => {
    expect(await validateAsDegree(db, row({ legacy_id: '110:ast' })))
      .toMatch(/<community_college_id>:<major>:<slot>/);
  });

  it('rejects a retired CS type name', async () => {
    expect(await validateAsDegree(db, row({
      legacy_id: '110:cs:local_cs_as', degree_type: 'local_cs_as',
    }))).toMatch(/degree_type must be one of ast, local_as, local_other/);
  });

  it('rejects a major that is not configured', async () => {
    expect(await validateAsDegree(db, row({
      legacy_id: '110:astronomy:ast', major_slug: 'astronomy',
    }))).toMatch(/major_slug must be a configured major/);
  });

  it('rejects a major_slug that disagrees with the id', async () => {
    expect(await validateAsDegree(db, row({ major_slug: 'bio' })))
      .toMatch(/major_slug must match the major segment/);
  });
});
```

If `fakeDb` does not already exist in this file, read the top of `server/services/asDegreeValidation.test.js` and reuse whatever stub the existing `validateAsDegree` tests use for `db.collection('assist_institutions').findOne` — the validator only calls that one method plus `curated_requirements.findOne` when `template_ref` is set.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run services/asDegreeValidation.test.js -t 'major-scoped'`
Expected: FAIL — the two-segment id still passes, and `major_slug: 'astronomy'` is accepted by the old `CONCEPT_SLUG_RE` check.

- [ ] **Step 3: Rewrite the identity block**

In `server/controllers/CanonicalData.js`, add near the other requires at the top:

```js
const { AS_DEGREE_SLOTS, parseAsDegreeRowId } = require('../config/asDegreeSlots');
const { getMajor, listMajors } = require('../config/majors');
```

Delete line 99 (`const AS_DEGREE_TYPES = [...]`).

Replace lines 221-234 (from `const idMatch =` through the `major_slug` check) with:

```js
  const parsed = parseAsDegreeRowId(canonical.legacy_id);
  if (!parsed) {
    return 'row id must look like <community_college_id>:<major>:<slot>, e.g. 110:cs:ast';
  }
  const { communityCollegeId: ccId, majorSlug, slot } = parsed;
  if (canonical.community_college_id !== ccId) {
    return 'community_college_id must match the numeric part of the row id';
  }
  if (canonical.college_id !== `cc:${ccId}`) return `college_id must be 'cc:${ccId}'`;
  if (!AS_DEGREE_SLOTS.includes(canonical.degree_type)) {
    return `degree_type must be one of ${AS_DEGREE_SLOTS.join(', ')}`;
  }
  if (canonical.degree_type !== slot) {
    return 'degree_type must match the slot segment of the row id';
  }
  if (!getMajor(canonical.major_slug)) {
    return `major_slug must be a configured major (${listMajors().map((m) => m.slug).join(', ')})`;
  }
  if (canonical.major_slug !== majorSlug) {
    return 'major_slug must match the major segment of the row id';
  }
```

Then at line ~680 in the `asDegrees` endpoint, replace the `AS_DEGREE_TYPES` reference:

```js
  const degreeType = String(req.query.degree_type || '').trim() || null;
  if (degreeType && !AS_DEGREE_SLOTS.includes(degreeType)) {
    return res.status(400).json({ error: `degree_type must be one of ${AS_DEGREE_SLOTS.join(', ')}` });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run services/asDegreeValidation.test.js controllers/CanonicalData.test.js`
Expected: the five new tests PASS. Existing tests that build `'110:ast'`-style ids will FAIL — that is correct. Update every such fixture in `CanonicalData.test.js` and `asDegreeValidation.test.js` to the three-segment form with `major_slug: 'cs'`, then rerun until green.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/CanonicalData.js server/services/asDegreeValidation.test.js server/controllers/CanonicalData.test.js
git commit -m "feat(as-degrees): scope the record identity to a configured major"
```

---

## Task 3: Read layer keyed by major

**Files:**
- Modify: `server/services/asDegreeView.js:10` (`DEGREE_TYPES`), `:130-147` (`duplicateLocalComputingIds`), `:301-326` (`asDegreeOverview`), `:328-356` (`inventoryOffers` / `availabilityFor`), `:361-403` (`asDegreeAvailability`), `:420-439` (`asDegreesExportData`), `:442-485` (`asDegreeDetail`)
- Test: `server/services/asDegreeView.test.js`

**Interfaces:**
- Consumes: `AS_DEGREE_SLOTS`, `LEGACY_TYPE_TO_SLOT` from Task 1.
- Produces:
  - `asDegreeDetail(db, collegeId, { major = 'cs' } = {}): Promise<{college_name, degrees}|null>`
  - `asDegreeOverview(db, { degreeType = null, major = 'cs' } = {})`
  - `asDegreesExportData(db, { degreeType = 'ast', major = 'cs' } = {})`
  - `asDegreeAvailability(db, inventory)` — unchanged signature, CS-only, keys by slot.

- [ ] **Step 1: Write the failing test**

Append to `server/services/asDegreeView.test.js`:

```js
describe('major scoping', () => {
  const docs = [
    { _id: 'as_degree:110:cs:ast', kind: 'as_degree', college_id: 'cc:110',
      community_college_id: 110, major_slug: 'cs', degree_type: 'ast',
      status: 'found', requirement_groups: [] },
    { _id: 'as_degree:110:bio:ast', kind: 'as_degree', college_id: 'cc:110',
      community_college_id: 110, major_slug: 'bio', degree_type: 'ast',
      status: 'found', requirement_groups: [] },
  ];

  it('returns only the requested major from asDegreeDetail', async () => {
    const db = fakeDb(docs);
    const cs = await asDegreeDetail(db, 'cc:110', { major: 'cs' });
    expect(cs.degrees.map((d) => d.doc.major_slug)).toEqual(['cs']);
    const bio = await asDegreeDetail(db, 'cc:110', { major: 'bio' });
    expect(bio.degrees.map((d) => d.doc.major_slug)).toEqual(['bio']);
  });

  it('defaults to cs when no major is given', async () => {
    const detail = await asDegreeDetail(fakeDb(docs), 'cc:110');
    expect(detail.degrees.map((d) => d.doc.major_slug)).toEqual(['cs']);
  });

  it('returns null when the college has no record for that major', async () => {
    expect(await asDegreeDetail(fakeDb(docs), 'cc:110', { major: 'econ' })).toBeNull();
  });
});
```

Reuse whatever `fakeDb` helper `asDegreeView.test.js` already defines; if it takes a different shape, adapt the three calls above to it rather than introducing a second stub.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run services/asDegreeView.test.js -t 'major scoping'`
Expected: FAIL — `asDegreeDetail` ignores its third argument and returns both majors.

- [ ] **Step 3: Apply the read-layer changes**

In `server/services/asDegreeView.js`:

Replace line 10 with:

```js
const { AS_DEGREE_SLOTS } = require('../config/asDegreeSlots');
```

and replace every later use of `DEGREE_TYPES` with `AS_DEGREE_SLOTS`.

Rename `duplicateLocalComputingIds` to `duplicateLocalOtherIds` and key it by major so two majors at one college never collide:

```js
function duplicateLocalOtherIds(docs) {
  const byKey = new Map(docs.map((doc) => [
    `${doc.community_college_id}:${doc.major_slug}:${doc.degree_type}`,
    doc,
  ]));
  const ids = new Set();
  for (const other of docs.filter((doc) => doc.degree_type === 'local_other')) {
    const localAs = byKey.get(`${other.community_college_id}:${other.major_slug}:local_as`);
    // (keep the existing body from here down, substituting localAs for localCs)
```

Read lines 130-147 before editing and preserve the comparison logic verbatim — only the key shape and the two variable names change.

`inventoryOffers` keeps reading the CS survey's field names but switches to slots:

```js
// The statewide survey is a Computer Science inventory; these field names are
// its own and do not generalise. asDegreeAvailability is CS-only for that
// reason, and says so at its call site.
function inventoryOffers(survey, slot) {
  if (slot === 'ast') return !!survey.ast_cs_exists;
  if (slot === 'local_as') return !!survey.local_cs_as_exists;
  return (survey.local_computing_degrees || []).length > 0;
}
```

In `availabilityFor`, change the `inventory_titles` condition from `type === 'local_computing'` to `slot === 'local_other'` and rename the parameter `type` to `slot` throughout.

In `asDegreeAvailability`, restrict the doc set to CS and key by slot:

```js
  const docBySchoolAndSlot = new Map(docs
    .filter((doc) => doc.major_slug === 'cs')
    .map((doc) => [`${doc.community_college_id}:${doc.degree_type}`, doc]));
```

and update the two lookups plus the `AS_DEGREE_SLOTS.map` that builds `types`.

In `asDegreeOverview`, add the major filter:

```js
async function asDegreeOverview(db, { degreeType = null, major = 'cs' } = {}) {
```

and change the `docs` line to:

```js
  const docs = allDocs.filter((doc) => doc.major_slug === major
    && (!degreeType || doc.degree_type === degreeType));
```

then change `return { params: { degree_type: degreeType }, ... }` to `return { params: { degree_type: degreeType, major }, ... }`.

In `asDegreesExportData`:

```js
async function asDegreesExportData(db, { degreeType = 'ast', major = 'cs' } = {}) {
  const docs = await db.collection('curated_requirements')
    .find({ kind: 'as_degree', degree_type: degreeType, major_slug: major, status: 'found' })
```

In `asDegreeDetail`:

```js
async function asDegreeDetail(db, collegeId, { major = 'cs' } = {}) {
  const docs = await db.collection('curated_requirements')
    .find({ kind: 'as_degree', college_id: String(collegeId), major_slug: major }).toArray();
  if (!docs.length) return null;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run services/asDegreeView.test.js`
Expected: the three new tests PASS. Existing fixtures using `local_cs_as` / `local_computing` will FAIL — update them to `local_as` / `local_other` and add `major_slug: 'cs'`, then rerun until green.

- [ ] **Step 5: Commit**

```bash
git add server/services/asDegreeView.js server/services/asDegreeView.test.js
git commit -m "refactor(as-degrees): key the read layer by major and slot"
```

---

## Task 4: API surface and remaining server call sites

**Files:**
- Modify: `server/controllers/CanonicalData.js:676-691` (`asDegrees` endpoint), `server/controllers/Analysis.js:364,372` (export routes), `server/services/analysis/transferCreditRate.js:39,551-558,659`
- Test: `server/controllers/CanonicalData.test.js`, `server/services/analysis/transferCreditRate.test.js`

**Interfaces:**
- Consumes: Task 3's `asDegreeDetail(db, collegeId, {major})` and `asDegreeOverview(db, {degreeType, major})`.
- Produces: `GET /api/curated/as-degrees?major=<slug>&degree_type=<slot>&college_id=<id>` — `major` defaults to `cs`, 400s on an unconfigured slug.

- [ ] **Step 1: Write the failing test**

Append to `server/controllers/CanonicalData.test.js` inside the existing `describe('asDegrees endpoint', …)`:

```js
  it('400s on a major that is not configured', async () => {
    const res = await run(asDegrees, request({ query: { major: 'astronomy' } }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown major/);
  });

  it('passes the major through to the detail lookup', async () => {
    const res = await run(asDegrees, request({
      query: { college_id: 'cc:110', major: 'cs' },
    }));
    expect(res.status).toBe(200);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run controllers/CanonicalData.test.js -t 'asDegrees endpoint'`
Expected: FAIL — `major: 'astronomy'` returns 200 because the endpoint ignores the parameter.

- [ ] **Step 3: Thread the major through**

In `server/controllers/CanonicalData.js`, replace the body of `exports.asDegrees`:

```js
exports.asDegrees = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const collegeId = String(req.query.college_id || '').trim();
  const degreeType = String(req.query.degree_type || '').trim() || null;
  const major = String(req.query.major || '').trim() || 'cs';
  if (!getMajor(major)) {
    return res.status(400).json({
      error: `unknown major: ${major}`,
      known: listMajors().map((m) => m.slug),
    });
  }
  if (degreeType && !AS_DEGREE_SLOTS.includes(degreeType)) {
    return res.status(400).json({ error: `degree_type must be one of ${AS_DEGREE_SLOTS.join(', ')}` });
  }
  if (collegeId) {
    const detail = await asDegreeView.asDegreeDetail(db, collegeId, { major });
    if (!detail) return res.status(404).json({ error: 'no as_degree row for that college' });
    return res.json(detail);
  }
  res.json(await asDegreeView.asDegreeOverview(db, { degreeType, major }));
});
```

In `server/controllers/Analysis.js`, update the two export data sources:

```js
  (db) => asDegreesExportData(db, { degreeType: 'ast', major: 'cs' }),
```
```js
  (db) => asDegreesExportData(db, { degreeType: 'local_as', major: 'cs' }),
```

In `server/services/analysis/transferCreditRate.js`, replace line 39:

```js
const DEGREE_TYPES = ['local_as', 'ast'];
```

replace the default and fallback at lines 551-553:

```js
  degreeType = 'local_as', majorSlug = null, majorPrograms = null,
```
```js
  const type = DEGREE_TYPES.includes(degreeType) ? degreeType : 'local_as';
```

and scope the query at line 558 to the major so a second major's rows can never enter a CS rate:

```js
  const degreeQuery = {
    kind: 'as_degree', degree_type: type, status: 'found',
    major_slug: majorSlug || 'cs',
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run`
Expected: PASS across the server suite. Update any remaining fixture that names `local_cs_as` or `local_computing` until green.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/CanonicalData.js server/controllers/Analysis.js server/services/analysis/transferCreditRate.js server/controllers/CanonicalData.test.js server/services/analysis/transferCreditRate.test.js
git commit -m "feat(api): accept a major on the as-degree read routes"
```

---

## Task 5: One-shot migration

**Files:**
- Create: `server/scripts/migrateAsDegreeSlots.js`
- Test: `server/scripts/migrateAsDegreeSlots.test.js`
- Modify: `server/package.json` (two script entries)

**Interfaces:**
- Consumes: `LEGACY_TYPE_TO_SLOT`, `asDegreeRowId` from Task 1.
- Produces: `planMigration(docs, templates): {degrees: Array<{from, to, doc}>, templates: Array<{_id, degree_type, major_slug}>, alreadyMigrated: number}` — a pure function the test drives directly, with the Mongo I/O kept in a thin `main()`.

- [ ] **Step 1: Write the failing test**

Create `server/scripts/migrateAsDegreeSlots.test.js`:

```js
const { describe, it, expect } = require('vitest');
const { planMigration } = require('./migrateAsDegreeSlots');

const degree = (legacyId, degreeType) => ({
  _id: `as_degree:${legacyId}`, legacy_id: legacyId, kind: 'as_degree',
  community_college_id: 110, college_id: 'cc:110', degree_type: degreeType,
});

describe('planMigration', () => {
  it('rewrites each legacy type onto its slot under the cs major', () => {
    const plan = planMigration([
      degree('110:ast', 'ast'),
      degree('110:local_cs_as', 'local_cs_as'),
      degree('110:local_computing', 'local_computing'),
    ], []);
    expect(plan.degrees.map((d) => [d.from, d.to])).toEqual([
      ['as_degree:110:ast', 'as_degree:110:cs:ast'],
      ['as_degree:110:local_cs_as', 'as_degree:110:cs:local_as'],
      ['as_degree:110:local_computing', 'as_degree:110:cs:local_other'],
    ]);
    expect(plan.degrees[1].doc.degree_type).toBe('local_as');
    expect(plan.degrees[1].doc.major_slug).toBe('cs');
    expect(plan.degrees[1].doc.legacy_id).toBe('110:cs:local_as');
  });

  it('is idempotent — an already-migrated row is left alone', () => {
    const plan = planMigration([
      { _id: 'as_degree:110:cs:ast', legacy_id: '110:cs:ast', kind: 'as_degree',
        community_college_id: 110, college_id: 'cc:110',
        degree_type: 'ast', major_slug: 'cs' },
    ], []);
    expect(plan.degrees).toEqual([]);
    expect(plan.alreadyMigrated).toBe(1);
  });

  it('rewrites template degree_type in place without changing template ids', () => {
    const plan = planMigration([], [
      { _id: 'as_degree_template:cs_local', slug: 'cs_local', degree_type: 'local_cs_as' },
      { _id: 'as_degree_template:cs_ast', slug: 'cs_ast', degree_type: 'ast' },
    ]);
    expect(plan.templates).toEqual([
      { _id: 'as_degree_template:cs_local', degree_type: 'local_as', major_slug: 'cs' },
      { _id: 'as_degree_template:cs_ast', degree_type: 'ast', major_slug: 'cs' },
    ]);
  });

  it('throws on an unrecognised legacy type rather than guessing', () => {
    expect(() => planMigration([degree('110:mystery', 'mystery')], []))
      .toThrow(/unrecognised degree_type: mystery/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run scripts/migrateAsDegreeSlots.test.js`
Expected: FAIL — `Cannot find module './migrateAsDegreeSlots'`

- [ ] **Step 3: Write the script**

Create `server/scripts/migrateAsDegreeSlots.js`:

```js
#!/usr/bin/env node
/**
 * Move as_degree rows onto major-scoped ids and major-neutral slots.
 *
 *   110:ast              -> 110:cs:ast
 *   110:local_cs_as      -> 110:cs:local_as
 *   110:local_computing  -> 110:cs:local_other
 *
 * Every existing row is Computer Science, so the major is a constant here.
 * Because _id encodes the row id, a rewrite is an insert of the new document
 * followed by a delete of the old one — not an update.
 *
 * Default is a read-only plan. `--apply` writes, and always dumps the two
 * affected collections to ./as-degree-backup-<n>.json first. Re-running after
 * a successful apply is a no-op.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const { LEGACY_TYPE_TO_SLOT, asDegreeRowId } = require('../config/asDegreeSlots');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MAJOR = 'cs';
const PREFIX = 'as_degree:';

/**
 * Pure: what the apply pass would do. `degrees` carries the full rewritten
 * document so the caller inserts exactly what was reviewed in the dry run.
 */
function planMigration(docs, templates) {
  const degrees = [];
  let alreadyMigrated = 0;
  for (const doc of docs) {
    if (doc.major_slug) { alreadyMigrated += 1; continue; }
    const slot = LEGACY_TYPE_TO_SLOT[doc.degree_type];
    if (!slot) throw new Error(`unrecognised degree_type: ${doc.degree_type} (${doc._id})`);
    const legacyId = asDegreeRowId(doc.community_college_id, MAJOR, slot);
    degrees.push({
      from: doc._id,
      to: `${PREFIX}${legacyId}`,
      doc: { ...doc, _id: `${PREFIX}${legacyId}`, legacy_id: legacyId,
        degree_type: slot, major_slug: MAJOR },
    });
  }
  const templateUpdates = templates
    .filter((t) => !t.major_slug || LEGACY_TYPE_TO_SLOT[t.degree_type] !== t.degree_type)
    .map((t) => {
      const slot = LEGACY_TYPE_TO_SLOT[t.degree_type];
      if (!slot) throw new Error(`unrecognised template degree_type: ${t.degree_type} (${t._id})`);
      return { _id: t._id, degree_type: slot, major_slug: MAJOR };
    });
  return { degrees, templates: templateUpdates, alreadyMigrated };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || 'pmt_research';
  if (!uri) throw new Error('MONGO_URI is required');
  const client = await MongoClient.connect(uri);
  try {
    const col = client.db(dbName).collection('curated_requirements');
    const docs = await col.find({ kind: 'as_degree' }).toArray();
    const templates = await col.find({ kind: 'as_degree_template' }).toArray();
    const plan = planMigration(docs, templates);

    console.log(`as_degree rows: ${docs.length} (${plan.alreadyMigrated} already migrated)`);
    console.log(`to rewrite: ${plan.degrees.length}, templates to touch: ${plan.templates.length}`);
    for (const d of plan.degrees) console.log(`  ${d.from}  ->  ${d.to}`);
    if (!apply) return console.log('\nDry run. Re-run with --apply to write.');

    const backup = path.resolve(process.cwd(), `as-degree-backup-${docs.length}.json`);
    fs.writeFileSync(backup, JSON.stringify({ docs, templates }, null, 2));
    console.log(`\nBacked up ${docs.length + templates.length} rows to ${backup}`);

    for (const d of plan.degrees) {
      await col.insertOne(d.doc);
      await col.deleteOne({ _id: d.from });
    }
    for (const t of plan.templates) {
      await col.updateOne({ _id: t._id },
        { $set: { degree_type: t.degree_type, major_slug: t.major_slug } });
    }
    console.log('Applied.');
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { planMigration };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run scripts/migrateAsDegreeSlots.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Register the script and commit**

Add to `server/package.json` scripts, after `"schema:cleanup"`:

```json
    "slots:audit": "node scripts/migrateAsDegreeSlots.js",
    "slots:apply": "node scripts/migrateAsDegreeSlots.js --apply",
```

```bash
git add server/scripts/migrateAsDegreeSlots.js server/scripts/migrateAsDegreeSlots.test.js server/package.json
git commit -m "feat(as-degrees): migrate rows onto major-scoped slot ids"
```

- [ ] **Step 6: STOP — hand the dry run to the user**

Run: `cd server && npm run slots:audit`

Do **not** run `slots:apply`. Paste the dry-run output and wait for explicit approval — this rewrites real curated data across the colleges already verified.

---

## Task 6: Frontend slot vocabulary

**Files:**
- Create: `frontend/src/asdegrees/asDegreeSlots.js`
- Test: `frontend/src/asdegrees/asDegreeSlots.test.js`
- Modify: `frontend/src/asdegrees/validation/ValidationDashboard.jsx:22-26`, `frontend/src/asdegrees/AsDegreeQaTable.jsx:53`, `frontend/src/asdegrees/AsDegreesTab.jsx:126,135`, `frontend/src/asdegrees/AsDegreeSchoolView.jsx`, `frontend/src/analyses/TransferCreditRate.jsx:215`, `frontend/src/analyses/TransferExtraUnits.jsx:112`, `frontend/src/components/DatasetSummaryPanel.jsx`, `frontend/src/apiDocs/content.js`, `frontend/src/shared/query/hooks/useData.js:121-123,479-511`

**Interfaces:**
- Consumes: nothing.
- Produces: `AS_DEGREE_SLOTS: string[]`, `SLOT_LABELS: Record<string,string>`, `slotLabel(slot: string): string`. Hooks gain a major: `useAsDegreeDetail(collegeId, major = 'cs')`, `useAsDegrees(degreeType = null, major = 'cs')`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/asdegrees/asDegreeSlots.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { AS_DEGREE_SLOTS, slotLabel } from './asDegreeSlots'

describe('as-degree slots', () => {
  it('mirrors the server vocabulary in tab order', () => {
    expect(AS_DEGREE_SLOTS).toEqual(['ast', 'local_as', 'local_other'])
  })

  it('labels every slot', () => {
    expect(AS_DEGREE_SLOTS.map(slotLabel))
      .toEqual(['A.S.-T', 'Local A.S.', 'Other'])
  })

  it('falls back to the raw slot for an unknown value', () => {
    expect(slotLabel('mystery')).toBe('mystery')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/asdegrees/asDegreeSlots.test.js`
Expected: FAIL — `Failed to resolve import "./asDegreeSlots"`

- [ ] **Step 3: Write the module and adopt it**

Create `frontend/src/asdegrees/asDegreeSlots.js`:

```js
/**
 * The three associate-degree slots, mirroring server/config/asDegreeSlots.js.
 *
 * Every major carries all three at every college, so this list is also the tab
 * order. Kept as a separate copy because the frontend cannot import server
 * config; the drift test in asDegreeContext.test.js is what keeps them honest.
 */
export const AS_DEGREE_SLOTS = ['ast', 'local_as', 'local_other']

export const SLOT_LABELS = {
  ast: 'A.S.-T',
  local_as: 'Local A.S.',
  local_other: 'Other',
}

export function slotLabel(slot) {
  return SLOT_LABELS[slot] || slot
}
```

Then replace the local copies:

- `ValidationDashboard.jsx`: delete the `DEGREE_LABEL` object at lines 22-26 and import `slotLabel`; in `DegreeChip`, `const label = slotLabel(degree.degree_type) || 'Degree record'` becomes `const label = degree.degree_type ? slotLabel(degree.degree_type) : 'Degree record'`.
- `AsDegreeQaTable.jsx`, `AsDegreesTab.jsx`, `AsDegreeSchoolView.jsx`, `DatasetSummaryPanel.jsx`: replace every `'local_cs_as'` with `'local_as'` and `'local_computing'` with `'local_other'`, and every hardcoded label with `slotLabel(...)`.
- `TransferCreditRate.jsx:215` and `TransferExtraUnits.jsx:112`: `useState('local_cs_as')` becomes `useState('local_as')`; update the `mode.value` option lists in both.
- `apiDocs/content.js`: update the documented `degree_type` values to `ast | local_as | local_other` and document the new `major` query parameter.
- `useData.js:123`: `['ast', 'local_cs_as'].includes(degreeType) ? degreeType : 'local_cs_as'` becomes `['ast', 'local_as'].includes(degreeType) ? degreeType : 'local_as'`.
- `useData.js`: add the major to both as-degree hooks, including the query key so two majors cannot share a cache entry:

```js
export function useAsDegrees(degreeType = null, major = 'cs') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['as-degrees', user?.uid, degreeType || 'all', major],
    queryFn: () => apiClient
      .get('/curated/as-degrees', {
        params: { major, ...(degreeType ? { degree_type: degreeType } : {}) },
      })
      .then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useAsDegreeDetail(collegeId, major = 'cs') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['as-degree-detail', user?.uid, collegeId, major],
    queryFn: () => apiClient
      .get('/curated/as-degrees', { params: { college_id: collegeId, major } })
      .then((r) => r.data),
    enabled: !!user?.uid && !!collegeId,
    staleTime: 60 * 1000,
  })
}
```

- [ ] **Step 4: Run the frontend suite**

Run: `cd frontend && npx vitest run`
Expected: the three new tests PASS. Update every fixture naming a retired type until green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "refactor(as-degrees): adopt the slot vocabulary across the frontend"
```

---

# Phase B — Always-visible slots and the empty-slot creator

## Task 7: Three slots per major, gate removed

**Files:**
- Modify: `frontend/src/DataPage.jsx:325-391`
- Test: `frontend/src/DataPage.agreements.test.jsx`

**Interfaces:**
- Consumes: `AS_DEGREE_SLOTS`, `slotLabel` from Task 6.
- Produces: `<AsDegreeReview collegeId major slot />` — note the prop rename from `degreeType` to `slot`, consumed by Task 10.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/DataPage.agreements.test.jsx`:

```jsx
it('shows all three slots even when the college has no records', async () => {
  renderCollegePane({ degrees: [] })
  expect(await screen.findByRole('tab', { name: 'A.S.-T' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Local A.S.' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Other' })).toBeInTheDocument()
})

it('shows slots for a major whose asDegrees capability is false', async () => {
  renderCollegePane({ degrees: [], major: { slug: 'bio', label: 'Biology',
    capabilities: { asDegrees: false } } })
  expect(await screen.findByRole('tab', { name: 'A.S.-T' })).toBeInTheDocument()
  expect(screen.queryByText(/No Biology associate degrees yet/)).toBeNull()
})
```

Read the existing helpers at the top of that file and reuse its render helper rather than adding a new one; `renderCollegePane` above stands for whatever it already calls.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/DataPage.agreements.test.jsx`
Expected: FAIL — no tabs render with zero available programs, and the Biology case renders the gated EmptyState.

- [ ] **Step 3: Rewrite the section**

In `frontend/src/DataPage.jsx`, delete `CS_DEGREE_PROGRAMS` (lines 325-329) and import the slot module:

```jsx
import { AS_DEGREE_SLOTS, slotLabel } from './asdegrees/asDegreeSlots'
```

Replace `AssociateDegreeSection` with:

```jsx
function AssociateDegreeSection({ collegeId, availability, major = null }) {
  // Every major carries all three slots at every college. An empty slot is not
  // an absence to hide — it is where a record gets created, so the tabs are a
  // constant and the capability flag no longer gates this section. The
  // analysis layer keeps its own guard (server/controllers/Analysis.js).
  const majorSlug = major?.slug || 'cs'
  const [selection, setSelection] = useState(null)
  const selectedSlot = selection?.collegeId === collegeId
    && AS_DEGREE_SLOTS.includes(selection.slot)
    ? selection.slot
    : AS_DEGREE_SLOTS[0]
  const record = availability?.types?.[selectedSlot] || null
  const subject = major?.label || 'Computer Science'
  const programLine = [subject, record?.degree_title_seen || slotLabel(selectedSlot),
    record?.catalog_year].filter(Boolean).join(' · ')

  return (
    <section aria-label='Associate degrees'>
      <div className='surface-card px-6 py-5'>
        <p className='text-label'>Associate degrees</p>
        <h2 className='mt-1.5 heading-card'>
          {availability?.college_name || 'Community college'}
        </h2>
        <p className='mt-1 text-body text-ink-muted'>{programLine}</p>
      </div>
      <div className='mt-4 flex justify-end'>
        <Tabs value={selectedSlot}
          onChange={(slot) => setSelection({ collegeId, slot })}
          options={AS_DEGREE_SLOTS.map((slot) => ({ value: slot, label: slotLabel(slot) }))} />
      </div>
      {/* The record, read against the catalog and corrected in place — or, for
          an empty slot, created there. */}
      <div className='mt-4'>
        <AsDegreeReview collegeId={collegeId} major={majorSlug} slot={selectedSlot} />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/DataPage.agreements.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/DataPage.jsx frontend/src/DataPage.agreements.test.jsx
git commit -m "feat(as-degrees): give every major three slots at every college"
```

---

## Task 8: Scaffold and save-blockers

**Files:**
- Create: `frontend/src/asdegrees/validation/asDegreeScaffold.js`
- Test: `frontend/src/asdegrees/validation/asDegreeScaffold.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildScaffold({ collegeId, major, slot }): object` — a document with correct identity and empty catalog fields.
  - `saveBlockers(doc): string[]` — human-readable reasons the server would reject this row, empty when saveable. This is the client mirror of `validateAsDegree`'s found-row rules.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/asdegrees/validation/asDegreeScaffold.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildScaffold, saveBlockers } from './asDegreeScaffold'

describe('buildScaffold', () => {
  it('wires the identity the validator cross-checks', () => {
    expect(buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' }))
      .toMatchObject({
        _id: 'as_degree:110:cs:ast',
        legacy_id: '110:cs:ast',
        college_id: 'cc:110',
        community_college_id: 110,
        major_slug: 'cs',
        degree_type: 'ast',
        status: 'found',
        requirement_groups: [],
      })
  })
})

describe('saveBlockers', () => {
  const complete = {
    ...buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' }),
    degree_title_seen: 'Computer Science A.S.-T',
    catalog_url: 'https://catalog.example.edu/cs',
    catalog_year: '2025-26',
    unit_system: 'semester',
    total_units: 60,
    requirement_groups: [{ group_id: 'core', source: 'curated', confidence: null }],
  }

  it('is empty for a complete found row', () => {
    expect(saveBlockers(complete)).toEqual([])
  })

  it('names every missing field on a bare scaffold', () => {
    const blockers = saveBlockers(buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' }))
    expect(blockers).toEqual([
      'a degree title as printed in the catalog',
      'a catalog URL starting with http',
      'a catalog year',
      'a positive total unit count',
      'at least one requirement group',
    ])
  })

  it('rejects a non-http catalog URL', () => {
    expect(saveBlockers({ ...complete, catalog_url: 'catalog.example.edu' }))
      .toEqual(['a catalog URL starting with http'])
  })

  it('drops the found-row fields when the status is not found', () => {
    expect(saveBlockers({ ...buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' }),
      status: 'none_found', requirement_groups: [] })).toEqual([])
  })

  it('rejects requirement groups on a non-found row', () => {
    expect(saveBlockers({ ...complete, status: 'none_found' }))
      .toEqual(['no requirement groups (a none_found row must not carry any)'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/asdegrees/validation/asDegreeScaffold.test.js`
Expected: FAIL — `Failed to resolve import "./asDegreeScaffold"`

- [ ] **Step 3: Write the module**

Create `frontend/src/asdegrees/validation/asDegreeScaffold.js`:

```js
/**
 * A new, unsaved AS-degree document, and the client-side answer to "would the
 * server take this yet?".
 *
 * saveBlockers mirrors the found-row rules in validateAsDegree
 * (server/controllers/CanonicalData.js). It exists so the Save button can be
 * honest before the round trip, not to replace the server check — the server
 * validates every save regardless. If a rule changes there, change it here.
 */

/** An empty document with the identity the validator cross-checks. */
export function buildScaffold({ collegeId, major, slot }) {
  const id = Number(collegeId)
  const legacyId = `${id}:${major}:${slot}`
  return {
    _id: `as_degree:${legacyId}`,
    legacy_id: legacyId,
    kind: 'as_degree',
    college_id: `cc:${id}`,
    community_college_id: id,
    major_slug: major,
    degree_type: slot,
    template_ref: null,
    status: 'found',
    degree_title_seen: '',
    catalog_url: '',
    catalog_year: '',
    unit_system: 'semester',
    total_units: null,
    requirement_groups: [],
  }
}

const filled = (value) => typeof value === 'string' && value.trim().length > 0

/** Plain-language reasons the server would reject this row; [] when saveable. */
export function saveBlockers(doc) {
  if (!doc || typeof doc !== 'object') return ['a document']
  const groups = Array.isArray(doc.requirement_groups) ? doc.requirement_groups : []
  if (doc.status !== 'found') {
    return groups.length
      ? [`no requirement groups (a ${doc.status} row must not carry any)`]
      : []
  }
  const blockers = []
  if (!filled(doc.degree_title_seen)) blockers.push('a degree title as printed in the catalog')
  if (!/^https?:\/\//.test(String(doc.catalog_url || ''))) blockers.push('a catalog URL starting with http')
  if (!filled(doc.catalog_year)) blockers.push('a catalog year')
  if (!Number.isFinite(doc.total_units) || doc.total_units <= 0) blockers.push('a positive total unit count')
  if (!groups.length) blockers.push('at least one requirement group')
  return blockers
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/asdegrees/validation/asDegreeScaffold.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add frontend/src/asdegrees/validation/asDegreeScaffold.js frontend/src/asdegrees/validation/asDegreeScaffold.test.js
git commit -m "feat(validation): scaffold a new as-degree record and name its blockers"
```

---

## Task 9: Creation variant of the AI briefing

**Files:**
- Modify: `frontend/src/asdegrees/validation/asDegreeContext.js`
- Test: `frontend/src/asdegrees/validation/asDegreeContext.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildAsDegreeContext({ doc, courses, mode = 'edit', collegeName = null }): string` — `mode: 'create'` swaps the framing and the closing instruction. `courseCatalogLines` is unchanged.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/asdegrees/validation/asDegreeContext.test.js`:

```js
describe('creation mode', () => {
  const doc = buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' })

  it('frames an empty scaffold as a record to create', () => {
    const text = buildAsDegreeContext({ doc, courses: [], mode: 'create',
      collegeName: 'Foothill College' })
    expect(text).toContain('# Creating an AS-degree requirement document')
    expect(text).toContain('Foothill College')
    expect(text).toContain('no record exists yet')
  })

  it('still carries the hard rules and the catalog in creation mode', () => {
    const text = buildAsDegreeContext({
      doc, mode: 'create',
      courses: [{ course_id: 7, prefix: 'MATH', number: '1A', title: 'Calculus', units: 5 }],
    })
    expect(text).toContain('## Hard rules the server enforces on save')
    expect(text).toContain('7 | MATH 1A | Calculus | 5u')
  })

  it('keeps the editing framing by default', () => {
    expect(buildAsDegreeContext({ doc, courses: [] }))
      .toContain('# Correcting an AS-degree requirement document')
  })
})
```

Add `import { buildScaffold } from './asDegreeScaffold'` to that file's imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/asdegrees/validation/asDegreeContext.test.js -t 'creation mode'`
Expected: FAIL — the heading is always "Correcting …" and `mode` is ignored.

- [ ] **Step 3: Add the creation framing**

In `frontend/src/asdegrees/validation/asDegreeContext.js`, add above `buildAsDegreeContext`:

```js
const CREATE_INTRO = `This college has no record for this degree slot yet — no record exists yet
to correct. Build one from the printed catalog: the scaffold below already
carries the correct identity fields, and you fill in the rest.`;
```

and replace `buildAsDegreeContext` with:

```js
export function buildAsDegreeContext({ doc, courses = [], mode = 'edit', collegeName = null }) {
  const creating = mode === 'create';
  const catalog = courseCatalogLines(courses);
  const heading = creating
    ? '# Creating an AS-degree requirement document'
    : '# Correcting an AS-degree requirement document';
  const closing = creating
    ? 'Paste the college\'s catalog text for this degree, then return the complete document.'
    : 'Tell me what you want changed, then return the complete corrected document.';
  return [
    heading,
    '',
    ...(collegeName ? [`College: ${collegeName}`, ''] : []),
    ...(creating ? [CREATE_INTRO, ''] : []),
    RULES,
    '',
    '## The college\'s course catalog (id | code | title | units)',
    '',
    catalog || '(no courses on file for this college)',
    '',
    creating ? '## The scaffold to fill in' : '## The document as it stands',
    '',
    '```json',
    JSON.stringify(doc, null, 2),
    '```',
    '',
    closing,
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/asdegrees/validation/asDegreeContext.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/asdegrees/validation/asDegreeContext.js frontend/src/asdegrees/validation/asDegreeContext.test.js
git commit -m "feat(validation): brief the assistant for creating a record, not only fixing one"
```

---

## Task 10: The creator UI

**Files:**
- Create: `frontend/src/asdegrees/validation/AsDegreeHeaderFields.jsx`
- Modify: `frontend/src/asdegrees/validation/AsDegreeReview.jsx`, `frontend/src/asdegrees/validation/AsDegreeJsonPanel.jsx`
- Test: `frontend/src/asdegrees/validation/AsDegreeCreator.test.jsx`

**Interfaces:**
- Consumes: `buildScaffold`, `saveBlockers` (Task 8); `buildAsDegreeContext` with `mode` (Task 9); `slot` and `major` props (Task 7).
- Produces: `<AsDegreeHeaderFields doc onChange />` — five controlled inputs writing back a whole document.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/asdegrees/validation/AsDegreeCreator.test.jsx`:

```jsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AsDegreeHeaderFields from './AsDegreeHeaderFields'
import { buildScaffold } from './asDegreeScaffold'

const doc = buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' })

describe('AsDegreeHeaderFields', () => {
  it('writes the catalog year back onto the whole document', () => {
    const onChange = vi.fn()
    render(<AsDegreeHeaderFields doc={doc} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Catalog year'), { target: { value: '2025-26' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      catalog_year: '2025-26', legacy_id: '110:cs:ast',
    }))
  })

  it('parses total units as a number, not a string', () => {
    const onChange = vi.fn()
    render(<AsDegreeHeaderFields doc={doc} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Total units'), { target: { value: '60' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ total_units: 60 }))
  })

  it('leaves total units null when the field is cleared', () => {
    const onChange = vi.fn()
    render(<AsDegreeHeaderFields doc={{ ...doc, total_units: 60 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Total units'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ total_units: null }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/asdegrees/validation/AsDegreeCreator.test.jsx`
Expected: FAIL — `Failed to resolve import "./AsDegreeHeaderFields"`

- [ ] **Step 3: Write the header form**

Create `frontend/src/asdegrees/validation/AsDegreeHeaderFields.jsx`:

```jsx
import React from 'react'
import { Input, Select } from '../../components/ui'

/**
 * The five scalars the server demands on a `found` row.
 *
 * They live in a form rather than in the JSON box because a typo in one of
 * them is the most common reason a save bounces, and because they are the part
 * a person reads straight off the catalog page. The requirement groups stay in
 * the document below — a form cannot state a four-level choice rule honestly.
 */
export default function AsDegreeHeaderFields({ doc, onChange }) {
  const set = (patch) => onChange({ ...doc, ...patch })

  return (
    <div className='surface-card grid gap-4 p-4 sm:grid-cols-2'>
      <div className='sm:col-span-2'>
        <label className='field-label' htmlFor='as-title'>Degree title as printed</label>
        <Input id='as-title' value={doc.degree_title_seen || ''}
          placeholder='Computer Science A.S.-T'
          onChange={(e) => set({ degree_title_seen: e.target.value })} />
      </div>
      <div className='sm:col-span-2'>
        <label className='field-label' htmlFor='as-url'>Catalog URL</label>
        <Input id='as-url' value={doc.catalog_url || ''}
          placeholder='https://catalog.example.edu/…'
          onChange={(e) => set({ catalog_url: e.target.value })} />
      </div>
      <div>
        <label className='field-label' htmlFor='as-year'>Catalog year</label>
        <Input id='as-year' value={doc.catalog_year || ''} placeholder='2025-26'
          onChange={(e) => set({ catalog_year: e.target.value })} />
      </div>
      <div>
        <label className='field-label' htmlFor='as-units'>Total units</label>
        <Input id='as-units' type='number' value={doc.total_units ?? ''} placeholder='60'
          onChange={(e) => set({
            total_units: e.target.value === '' ? null : Number(e.target.value),
          })} />
      </div>
      <div>
        <span className='field-label'>Unit system</span>
        <Select value={doc.unit_system || 'semester'}
          onChange={(unit_system) => set({ unit_system })}
          aria-label='Unit system'
          options={[
            { value: 'semester', label: 'Semester' },
            { value: 'quarter', label: 'Quarter' },
          ]} />
      </div>
    </div>
  )
}
```

Confirm the `Input` component forwards `id` and takes an `onChange(event)`; read `frontend/src/components/ui/forms/Input.jsx` first. If it takes `onChange(value)` like `Select` does, drop the `e.target.value` accessors accordingly and adjust the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/asdegrees/validation/AsDegreeCreator.test.jsx`
Expected: PASS, 3 tests

- [ ] **Step 5: Wire the creator into the review**

In `AsDegreeJsonPanel.jsx`, accept the mode and college name and pass them through:

```jsx
export default function AsDegreeJsonPanel({ doc, courses = [], onChange, mode = 'edit', collegeName = null }) {
```
```jsx
    await navigator.clipboard.writeText(buildAsDegreeContext({ doc, courses, mode, collegeName }))
```

In `AsDegreeReview.jsx`, first fix the imports — `useMemo` is new, `EmptyState` becomes unused once the no-record branch is deleted, and three modules are added:

```jsx
import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Spinner, Stack, Textarea } from '../../components/ui'
import AsDegreeHeaderFields from './AsDegreeHeaderFields'
import { buildScaffold, saveBlockers } from './asDegreeScaffold'
```

Confirm `Alert` accepts `type='info'` by reading `frontend/src/components/ui/feedback/Alert.jsx`; if it only supports `error`/`success`, use the plain `text-caption text-ink-subtle` paragraph style used elsewhere in this file instead.

Then change the signature and add the creator branch:

```jsx
export default function AsDegreeReview({ collegeId, major = 'cs', slot }) {
  const detail = useAsDegreeDetail(collegeId != null ? `cc:${collegeId}` : null, major)
  const courses = useCcCourses(collegeId)
  const save = useSaveAsDegree()

  const records = detail.data?.degrees || []
  const stored = records.find((r) => r.degree_type === slot)?.doc || null
  const creating = !stored
  const [draft, setDraft] = useState(null)
  // …existing note/error/saved state…

  const scaffold = useMemo(
    () => buildScaffold({ collegeId, major, slot }),
    [collegeId, major, slot],
  )
  const doc = draft && draft.legacy_id === (stored?.legacy_id ?? scaffold.legacy_id)
    ? draft
    : (stored || scaffold)
  const blockers = saveBlockers(doc)
```

Reset the draft when the slot changes by adding `slot` and `major` to the existing `useEffect` dependency array alongside `stored?._id`.

Above the `DegreePanel`, render the creator affordances when `creating`:

```jsx
      {creating && (
        <>
          <Alert type='info'>
            This slot is empty. Fill in the catalog details, then paste a requirement
            structure below — nothing is saved until you press Create record.
          </Alert>
          <AsDegreeHeaderFields doc={doc} onChange={setDraft} />
        </>
      )}
```

Pass the mode down to the JSON panel:

```jsx
      <AsDegreeJsonPanel doc={doc} courses={courses.data?.rows || []}
        mode={creating ? 'create' : 'edit'}
        collegeName={detail.data?.college_name || null}
        onChange={(next) => setDraft(next)} />
```

Replace the button row's save control so it states what is missing rather than failing on the round trip:

```jsx
        {(draft || creating) && (
          <Button onClick={() => persist(null)}
            disabled={save.isPending || blockers.length > 0}>
            {creating ? 'Create record' : 'Save changes'}
          </Button>
        )}
        {blockers.length > 0 && (
          <span className='text-caption text-ink-subtle'>
            Still needs {blockers.join(', ')}.
          </span>
        )}
```

Guard the verify buttons the same way — `disabled={save.isPending || blockers.length > 0}` — and delete the early `if (!doc) return <EmptyState … />` branch, since `doc` now always exists. Keep the `detail.isLoading` and `detail.isError` branches, but treat a 404 as "no record yet" rather than an error (the existing check already excludes 404).

- [ ] **Step 6: Run the validation suite**

Run: `cd frontend && npx vitest run src/asdegrees src/DataPage.agreements.test.jsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/asdegrees/validation
git commit -m "feat(validation): create a record in an empty slot"
```

---

## Task 11: Briefing / validator drift test

**Files:**
- Modify: `frontend/src/asdegrees/validation/asDegreeContext.test.js`

**Interfaces:**
- Consumes: `AS_DEGREE_SLOTS` from Task 6, `RULES` text from Task 9.
- Produces: nothing — a guard test only.

- [ ] **Step 1: Write the test**

Append to `frontend/src/asdegrees/validation/asDegreeContext.test.js`:

```js
import { AS_DEGREE_SLOTS } from '../asDegreeSlots'

describe('briefing stays in step with the server', () => {
  const text = buildAsDegreeContext({
    doc: buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' }), courses: [],
  })

  it('promises only fields the validator actually lets a save change', () => {
    for (const field of ['status', 'degree_title_seen', 'catalog_url',
      'catalog_year', 'unit_system', 'total_units', 'requirement_groups']) {
      expect(text).toContain(field)
    }
  })

  it('never names a retired degree type', () => {
    expect(text).not.toContain('local_cs_as')
    expect(text).not.toContain('local_computing')
  })

  it('states the group_id rule the validator enforces', () => {
    expect(text).toContain('^[a-z0-9_]+$')
  })

  it('covers every live slot in the vocabulary', () => {
    expect(AS_DEGREE_SLOTS).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/asdegrees/validation/asDegreeContext.test.js`
Expected: PASS

- [ ] **Step 3: Run both full suites**

Run: `cd server && npx vitest run && cd ../frontend && npx vitest run`
Expected: PASS on both

- [ ] **Step 4: Commit**

```bash
git add frontend/src/asdegrees/validation/asDegreeContext.test.js
git commit -m "test(validation): guard the briefing against validator drift"
```

---

## Deferred, deliberately

- **Provenance enforcement.** `putRequirement` spreads the posted body, so an assistant that drops `extraction` or `source` silently loses it. The briefing asks for preservation; the server does not enforce it. Worth a follow-up guard, out of scope here.
- **Per-major availability inventory.** `asDegreeAvailability` joins a static Computer Science survey (`scripts/data/as_degrees_cs_extraction.json`) and stays CS-only. Biology and Economics slots render without a `confirmed_none` / `data_gap` distinction until an equivalent survey exists for them.
- **Empty-slot noise.** Biology and Economics now show three empty slots at every college. If that reads as noise in use, add a one-line "nothing gathered for this major yet" note above the tabs.
