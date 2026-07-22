# Major-Dimension Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "major" a selectable, config-driven dimension across the console while keeping the app pixel- and byte-identical for CS (the only onboarded major).

**Architecture:** A single per-major config module (`server/config/majors.js`) becomes the source of truth for everything that is a hardcoded CS constant today (program pins, match string, course categories, course-type patterns, capabilities). A read-only `GET /api/majors` endpoint serves it to the frontend, which gains a `MajorProvider` context + `MajorPicker` component that render as no-ops while only one major exists. Server analysis endpoints accept a `major=<slug>` param that resolves to the existing `majorContains` machinery.

**Tech Stack:** Node 20 / Express / MongoDB (server, vitest), React 19 / Vite / TanStack Query (frontend, vitest).

**Spec:** `docs/superpowers/specs/2026-07-22-major-dimension-foundation-design.md`
**Roadmap:** `docs/superpowers/specs/2026-07-22-expansion-roadmap.md`

## Global Constraints

- Work on branch `major-foundation` (branch from `design-makeover` or `main` per Tybalt's direction at execution time). Never push without asking.
- Commit at the end of each task. **Never add a `Co-Authored-By: Claude` (or any Claude) trailer** — this repo forbids it.
- Golden invariant: with only `cs` onboarded, all existing tests pass. The ONE deliberate exception is `server/controllers/AdminVisibleMajors.test.js` (Task 3 relaxes the one-major-per-campus rule it asserts).
- Frozen CS artifacts are never renamed, regenerated, or edited: committed snapshot JSONs (`server/data/analysis/*.v1.json`, `frontend/src/analyses/data/*.json`), paper baselines (`frontend/src/analyses/paper*Baseline.js`), transfer-minimum data and views.
- All `cs` config values must be copied **verbatim** from the constants they replace (including the trailing space in `'COMPUTER SCIENCE AND ENGINEERING, B.S. '`).
- Server tests: `cd server && npm test -- <file>`. Frontend tests: `cd frontend && npm test -- <file>`. Full suites: `npm test` in each. Build check: `cd frontend && npm run build`.
- New UI must use the existing component vocabulary (`frontend/src/components/ui` — `Select`, `Stack`, `Alert`, etc.) and design tokens; no new styling systems.
- Before editing any file, read the surrounding section first. Line numbers in this plan were correct on 2026-07-22 and may have drifted.

---

### Task 1: Major config module (server)

**Files:**
- Create: `server/config/majors.js`
- Create: `server/config/majors.test.js`
- Modify: `server/services/courseTypes.js` (export its constant sets; behavior unchanged)

**Interfaces:**
- Produces: `getMajor(slug) -> entry|null`, `listMajors() -> entry[]`, `defaultMajor() -> entry`, `serializeMajors() -> plain-JSON array` (regexes as `{source, flags}`), `majorScopeFromQuery(query) -> { slug, majorContains } | { error }`.
- Later tasks rely on entry fields: `slug`, `label`, `match`, `programs` (`{ [numericSchoolId]: [programString] }`), `categories`, `broadAxes`, `conceptDisciplines`, `capabilities`, `coursePatterns`.

- [ ] **Step 1: Export the course-pattern constants from `courseTypes.js`**

At the bottom of `server/services/courseTypes.js`, extend `module.exports` to also export the constant sets (keep every existing export):

```js
module.exports = {
  ...module.exports_previously_listed, // keep existing exports exactly as-is
  COURSE_TYPES,
  COMPUTING_PREFIXES,
  MATH_PREFIXES,
  SCIENCE_PREFIXES,
  DISCRETE_MATH,
  TEXT_RULES,
};
```

(Concretely: open the file, find its `module.exports = {...}` and add the six names to it. Do not change any function.)

- [ ] **Step 2: Write the failing test**

`server/config/majors.test.js`:

```js
const { describe, it, expect } = require('vitest');
const { getMajor, listMajors, defaultMajor, serializeMajors, majorScopeFromQuery } = require('./majors');
const { PAPER_MAJORS } = require('../services/analysis/pathways');

describe('majors config', () => {
  it('cs is the default and only onboarded major', () => {
    expect(defaultMajor().slug).toBe('cs');
    expect(listMajors().map((m) => m.slug)).toEqual(['cs']);
  });

  it('cs program pins are byte-identical to PAPER_MAJORS', () => {
    expect(getMajor('cs').programs).toEqual(PAPER_MAJORS);
  });

  it('cs match string and capabilities', () => {
    const cs = getMajor('cs');
    expect(cs.match).toBe('computer science');
    expect(cs.capabilities.asDegrees).toBe(true);
    expect(cs.capabilities.paperBaselines).toBe(true);
    expect(cs.capabilities.transferMinimums).toBe(true);
  });

  it('unknown slug returns null', () => {
    expect(getMajor('bio')).toBeNull();
  });

  it('serializeMajors is JSON-safe (regexes become {source, flags})', () => {
    const json = JSON.parse(JSON.stringify(serializeMajors()));
    const cs = json.find((m) => m.slug === 'cs');
    expect(cs.coursePatterns.discreteMath.source).toContain('discrete');
    expect(typeof cs.coursePatterns.discreteMath.flags).toBe('string');
  });

  it('majorScopeFromQuery: slug wins, contains kept for back-compat', () => {
    expect(majorScopeFromQuery({ major: 'cs' })).toEqual({ slug: 'cs', majorContains: 'computer science' });
    expect(majorScopeFromQuery({ majorContains: 'econom' })).toEqual({ slug: null, majorContains: 'econom' });
    expect(majorScopeFromQuery({})).toEqual({ slug: null, majorContains: '' });
    expect(majorScopeFromQuery({ major: 'nope' })).toEqual({ error: 'unknown major: nope', known: ['cs'] });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npm test -- config/majors.test.js`
Expected: FAIL — `Cannot find module './majors'` (and note: `PAPER_MAJORS` is not exported from pathways.js yet — Task 5 exports it; for now stub the second test with the literal object below and leave a `// Task 5 swaps this to the pathways export` comment, OR export `PAPER_MAJORS` from pathways.js now by adding it to that file's `module.exports`. Prefer exporting now; it is a pure addition).

- [ ] **Step 4: Write the implementation**

`server/config/majors.js`:

```js
// Per-major metadata that is NOT in the database: program pins per campus,
// match string, category vocabulary, course-code patterns, capability flags.
// One entry per onboarded major. v1 ships `cs` only, with every value copied
// verbatim from the constants it replaces, so behavior is provably unchanged.
// Onboarding a major (roadmap W1) = add an entry here + port its data.
const {
  COMPUTING_PREFIXES, MATH_PREFIXES, SCIENCE_PREFIXES, DISCRETE_MATH, TEXT_RULES,
} = require('../services/courseTypes');

const MAJORS = [
  {
    slug: 'cs',
    label: 'Computer Science',
    // Case-insensitive substring used by majorContains-style filters.
    match: 'computer science',
    // Exact ASSIST program strings per numeric UC school id. MUST stay
    // byte-identical to the pins the paper figures were validated against
    // (source of truth mirrored from services/analysis/pathways.js
    // PAPER_MAJORS — Task 5 makes pathways.js read from here).
    programs: {
      89: ['Computer Science & Engineering B.S.', 'Computer Science B.S.'],
      144: ['APPLIED MATHEMATICAL SCIENCES, Computer Science Emphasis, B.S.',
        'COMPUTER SCIENCE AND ENGINEERING, B.S. '], // trailing space is stored
      7: ['CSE: Computer Science B.S.',
        'CSE: Computer Science with a Specialization in Bioinformatics B.S.',
        'Mathematics/Computer Science B.S.'],
      128: ['Computer Science, B.S.'],
      117: ['Computer Science and Engineering/B.S.', 'Computer Science/B.S.',
        'Linguistics and Computer Science/B.A.'],
      79: ['Computer Science, B.A.', 'Electrical Engineering & Computer Sciences, B.S.'],
      132: ['Computer Science B.A.', 'Computer Science B.S.', 'Computer Science Minor',
        'Computer Science: Computer Game Design B.S.'],
      120: ['Computer Science and Engineering, B.S.', 'Computer Science, B.S.'],
      46: ['Computer Science with Business Applications B.S.', 'Computer Science, B.S.'],
    },
    // Mirrors controllers/Curation.js CANONICAL_CATEGORIES / BROAD_AXES
    // (Task 6 makes Curation.js read from here).
    categories: [
      { key: 'calculus', axis: 'math' },
      { key: 'advanced_math', axis: 'math' },
      { key: 'discrete_math', axis: 'math' },
      { key: 'other_math', axis: 'math' },
      { key: 'intro_programming', axis: 'computing' },
      { key: 'data_structures', axis: 'computing' },
      { key: 'computer_org', axis: 'computing' },
      { key: 'other_computing', axis: 'computing' },
      { key: 'science', axis: 'science' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    broadAxes: ['computing', 'math', 'science', 'non_stem'],
    conceptDisciplines: ['math', 'cs', 'physics', 'engr', 'stats'],
    coursePatterns: {
      computingPrefixes: [...COMPUTING_PREFIXES],
      mathPrefixes: [...MATH_PREFIXES],
      sciencePrefixes: [...SCIENCE_PREFIXES],
      discreteMath: DISCRETE_MATH,
      textRules: TEXT_RULES,
    },
    capabilities: {
      asDegrees: true,
      paperBaselines: true,
      transferMinimums: true,
      snapshots: ['district-multi-campus-pathways', 'multi-campus-pathways',
        'district-portfolio-subsets'],
    },
  },
];

const bySlug = new Map(MAJORS.map((m) => [m.slug, m]));

function getMajor(slug) { return bySlug.get(String(slug || '')) || null; }
function listMajors() { return [...MAJORS]; }
function defaultMajor() { return MAJORS[0]; }

// JSON-safe projection for GET /api/majors: RegExp -> {source, flags};
// textRules [[re, type]] -> [{pattern: {source, flags}, type}].
function serializeRegex(re) { return { source: re.source, flags: re.flags }; }
function serializeMajors() {
  return MAJORS.map((m) => ({
    ...m,
    coursePatterns: {
      ...m.coursePatterns,
      discreteMath: serializeRegex(m.coursePatterns.discreteMath),
      textRules: m.coursePatterns.textRules.map(([pattern, type]) => ({
        pattern: serializeRegex(pattern), type,
      })),
    },
  }));
}

// Resolve ?major=<slug> / ?majorContains=<text> into the scope the analysis
// layer already speaks. Slug wins; unknown slug is an error the endpoint
// turns into a 400.
function majorScopeFromQuery(query = {}) {
  const slug = String(query.major || '').trim();
  if (slug) {
    const entry = getMajor(slug);
    if (!entry) return { error: `unknown major: ${slug}`, known: MAJORS.map((m) => m.slug) };
    return { slug: entry.slug, majorContains: entry.match };
  }
  return { slug: null, majorContains: String(query.majorContains || '').trim() };
}

module.exports = { getMajor, listMajors, defaultMajor, serializeMajors, majorScopeFromQuery };
```

Also add `PAPER_MAJORS` to `server/services/analysis/pathways.js` exports (find its `module.exports` and add the key — pure addition).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npm test -- config/majors.test.js`
Expected: PASS (6 tests)

- [ ] **Step 6: Run the whole server suite (invariant check)**

Run: `cd server && npm test`
Expected: PASS, same counts as before this task.

- [ ] **Step 7: Commit**

```bash
git add server/config/majors.js server/config/majors.test.js server/services/courseTypes.js server/services/analysis/pathways.js
git commit -m "feat(majors): per-major config module with verbatim cs entry"
```

---

### Task 2: `GET /api/majors` endpoint

**Files:**
- Create: `server/controllers/Majors.js`
- Create: `server/controllers/Majors.test.js`
- Modify: `server/routes/api.js` (add one route near the `/data/summary` route)

**Interfaces:**
- Consumes: `serializeMajors()` from Task 1.
- Produces: `GET /api/majors` → `{ majors: [...serialized entries], default: 'cs' }`. Frontend Task 9 consumes this exact shape.

- [ ] **Step 1: Write the failing test**

`server/controllers/Majors.test.js` (follow the pattern of an existing thin controller test, e.g. `AnalysisReleases.test.js` — call the handler with mocked `req`/`res`):

```js
const { describe, it, expect, vi } = require('vitest');
const { listMajorsEndpoint } = require('./Majors');

describe('GET /majors', () => {
  it('returns serialized majors and the default slug', async () => {
    const json = vi.fn();
    await listMajorsEndpoint({}, { json });
    const payload = json.mock.calls[0][0];
    expect(payload.default).toBe('cs');
    expect(payload.majors[0].slug).toBe('cs');
    // JSON-safe: survives a stringify round-trip with regex sources intact
    const round = JSON.parse(JSON.stringify(payload));
    expect(round.majors[0].coursePatterns.discreteMath.source).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- controllers/Majors.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`server/controllers/Majors.js`:

```js
/** Read-only projection of the per-major config for the frontend. */
const { asyncHandler } = require('../middleware/asyncHandler');
const { serializeMajors, defaultMajor } = require('../config/majors');

exports.listMajorsEndpoint = asyncHandler(async (req, res) => {
  res.json({ majors: serializeMajors(), default: defaultMajor().slug });
});
```

In `server/routes/api.js`, next to the other guarded data routes (e.g. right before the `/analysis/releases` line), add:

```js
const majorsController = require('../controllers/Majors');
router.get('/majors', ...guarded, majorsController.listMajorsEndpoint);
```

(Put the `require` at the top with the other controller requires.)

- [ ] **Step 4: Run tests**

Run: `cd server && npm test -- controllers/Majors.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/Majors.js server/controllers/Majors.test.js server/routes/api.js
git commit -m "feat(majors): GET /api/majors endpoint"
```

---

### Task 3: Multi-major visibility (drop one-pair-per-campus)

**Files:**
- Modify: `server/services/majorVisibility.js` (replace `onePairPerSchool` with duplicate-dedupe)
- Modify: `server/controllers/Admin.js` (`putVisibleMajors` validation — read the handler first; it may also enforce one-per-campus)
- Modify: `server/controllers/AdminVisibleMajors.test.js` (the sanctioned test change)
- Modify: `frontend/src/AdminPage.jsx` `majorsBySchool` note (client relaxation is Task 12; here only ensure nothing server-side truncates)

**Interfaces:**
- Produces: `visible_pairs` may contain several `{school_id, major}` pairs per campus. `getVisiblePairs`/`visibilityScope`/`pairClause` signatures unchanged.

- [ ] **Step 1: Write the failing test**

Add to `server/controllers/AdminVisibleMajors.test.js` (keep existing tests, updating any that assert truncation to one pair per campus — they now assert preservation):

```js
it('keeps multiple majors at the same campus', async () => {
  // follow the file's existing mocking pattern for db/auditDb + admin user;
  // save pairs for school 79 with two majors, read them back:
  const pairs = [
    { school_id: 79, major: 'Computer Science, B.A.' },
    { school_id: 79, major: 'Molecular and Cell Biology, B.A.' },
  ];
  // ...save via putVisibleMajors handler, then getVisibleMajors...
  expect(saved).toHaveLength(2);
});

it('drops exact duplicate pairs, preserving order', async () => {
  const pairs = [
    { school_id: 79, major: 'Computer Science, B.A.' },
    { school_id: 79, major: 'Computer Science, B.A.' },
  ];
  expect(saved).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd server && npm test -- controllers/AdminVisibleMajors.test.js`
Expected: new tests FAIL (second pair dropped by `onePairPerSchool`).

- [ ] **Step 3: Implement**

In `server/services/majorVisibility.js`, replace `onePairPerSchool` with:

```js
// Dedupe exact (school, major) duplicates, preserving order. A campus may
// carry several majors — the working dataset is multi-major since 2026-07.
function normalizePairs(pairs = []) {
  const seen = new Set();
  const clean = [];
  for (const raw of pairs || []) {
    const pair = normalizePair(raw);
    const key = `${pair.school_id}|${pair.major}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(pair);
  }
  return clean;
}
```

Replace every call site of `onePairPerSchool` in the file with `normalizePairs` (there are three: `loadConfig`, `readVisiblePairsUncached`, `setVisiblePairs`). Update the file's header comment ("one (school, major) PAIR per configured campus" → "one or more (school, major) pairs per campus"). Then read `putVisibleMajors` in `server/controllers/Admin.js` and remove any one-per-campus validation there (keep shape/type validation).

- [ ] **Step 4: Run tests**

Run: `cd server && npm test -- controllers/AdminVisibleMajors.test.js services/majorVisibility` then the full suite `npm test`.
Expected: PASS everywhere; only this test file changed meaning.

- [ ] **Step 5: Commit**

```bash
git add server/services/majorVisibility.js server/controllers/Admin.js server/controllers/AdminVisibleMajors.test.js
git commit -m "feat(majors): allow multiple visible majors per campus"
```

---

### Task 4: Analysis endpoints accept `major=<slug>`

**Files:**
- Modify: `server/controllers/Analysis.js`
- Test: `server/controllers/Analysis.test.js` (add cases; follow existing patterns)

**Interfaces:**
- Consumes: `majorScopeFromQuery`, `getMajor` (Task 1).
- Produces: every analysis endpoint that reads `req.query.majorContains` now first runs `majorScopeFromQuery(req.query)`; on `{error}` responds `400 { error, known }`. `transferCreditRate` responds `400 { error: 'capability_required', capability: 'asDegrees' }` for majors without `capabilities.asDegrees`. Frontend Task 10 sends `major=<slug>`.

- [ ] **Step 1: Read `Analysis.js` and find where `majorContains` is parsed** (there is a shared `makeEndpoint` factory plus the bespoke `coverage` handler — apply the same resolution in both).

- [ ] **Step 2: Write failing tests** in `Analysis.test.js` (use the file's existing req/res mocking style):

```js
it('resolves major=cs to the cs match string', async () => {
  // call the coverage handler with req.query = { major: 'cs' } and assert the
  // data function received majorContains 'computer science'
});
it('400s on unknown major slug', async () => {
  // req.query = { major: 'underwater-basket-weaving' } -> status 400,
  // body { error: 'unknown major: …', known: ['cs'] }
});
it('transfer-credit-rate rejects majors without asDegrees capability', async () => {
  // Until a second major exists this is exercised by monkey-patching
  // getMajor in the test via vi.mock('../config/majors', …) to return a
  // bio entry with capabilities.asDegrees false.
});
```

Write these as real tests against the handlers, mirroring how `Analysis.test.js` already invokes them.

- [ ] **Step 3: Run to verify failure** — `cd server && npm test -- controllers/Analysis.test.js`

- [ ] **Step 4: Implement**

At the top of `Analysis.js`:

```js
const { majorScopeFromQuery, getMajor, defaultMajor } = require('../config/majors');
```

Add one helper and use it wherever `req.query.majorContains` is currently read:

```js
// Shared major-scope resolution: ?major=<slug> (preferred) or legacy
// ?majorContains=<text>. Returns null after replying 400 on unknown slug.
function resolveMajorScope(req, res) {
  const scope = majorScopeFromQuery(req.query);
  if (scope.error) { res.status(400).json({ error: scope.error, known: scope.known }); return null; }
  return scope;
}
```

In `makeEndpoint` (and the bespoke `coverage`/`requirementComparison` handlers), replace direct `majorContains` reads with `const scope = resolveMajorScope(req, res); if (!scope) return;` and pass `scope.majorContains` down. Include `scope.slug` in the cache key string wherever a key is built from `majorContains` today (append `|${scope.slug ?? ''}`).

In `transferCreditRate`, before computing:

```js
const majorEntry = getMajor(String(req.query.major || '').trim() || defaultMajor().slug);
if (!majorEntry) return res.status(400).json({ error: `unknown major: ${req.query.major}` });
if (!majorEntry.capabilities.asDegrees) {
  return res.status(400).json({ error: 'capability_required', capability: 'asDegrees', major: majorEntry.slug });
}
```

Do NOT change the `degree_type` whitelist or any computation.

- [ ] **Step 5: Run tests** — target file then full suite. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/Analysis.js server/controllers/Analysis.test.js
git commit -m "feat(majors): analysis endpoints accept major=<slug> with capability gating"
```

---

### Task 5: `pathways.js` reads pins from the config

**Files:**
- Modify: `server/services/analysis/pathways.js:283-314` (PAPER_MAJORS block)
- Test: `server/services/analysis/pathways.test.js` (add identity test)

**Interfaces:**
- Produces: `PAPER_MAJORS` and `CAMPUS_SCHOOL_IDS` keep their exact names and shapes (other code and Task 1's test import them) but are now derived from `getMajor('cs').programs`.

- [ ] **Step 1: Add the failing-then-passing identity test** to `pathways.test.js`:

```js
const { PAPER_MAJORS, CAMPUS_SCHOOL_IDS } = require('./pathways');
const { getMajor } = require('../../config/majors');

it('paper pins are the cs config programs', () => {
  expect(PAPER_MAJORS).toEqual(getMajor('cs').programs);
  expect(CAMPUS_SCHOOL_IDS).toEqual(Object.keys(getMajor('cs').programs).map(Number));
});
```

- [ ] **Step 2: Implement** — in `pathways.js`, replace the `PAPER_MAJORS = { …literal… }` object with:

```js
const { getMajor } = require('../../config/majors');
// The exact ASSIST programs the paper scraped per campus now live in the
// majors config (single source of truth). The paper-port figures still pin
// to the cs entry and IGNORE partner visibility scoping.
const PAPER_MAJORS = getMajor('cs').programs;
```

Keep `paperMajorsQuery`, `CAMPUS_SCHOOL_IDS`, and all comments about pin semantics. **Then delete the duplicated literal from `server/config/majors.js`? NO — the config is now the single literal; pathways holds no literal.** (The Task 1 comment saying "mirrored from pathways.js" must be updated to say the config is the source of truth.)

- [ ] **Step 3: Run** — `cd server && npm test -- services/analysis/pathways.test.js` then the full suite (this is the highest-risk identity swap; the whole suite must stay green).

- [ ] **Step 4: Commit**

```bash
git add server/services/analysis/pathways.js server/services/analysis/pathways.test.js server/config/majors.js
git commit -m "refactor(majors): pathways paper pins read from majors config"
```

---

### Task 6: Curation categories from the config

**Files:**
- Modify: `server/controllers/Curation.js:7-12` and `listCategories`/`putCategory`
- Test: `server/controllers/Curation.test.js` (create if absent; check `ls server/controllers/*.test.js` first)

**Interfaces:**
- Produces: `GET /curated/course-categories?major=<slug>` (default `cs`) returns that major's `canonical` (category keys) and `broad` axes from config; rows unchanged. `putCategory` stamps `major_slug` (default `'cs'`) on writes. Reads do not filter by `major_slug` (existing docs lack it; W1 revisits).

- [ ] **Step 1: Failing test** — categories endpoint returns config vocab; unknown slug 400s:

```js
it('lists cs canonical categories from the majors config', async () => {
  // invoke listCategories with mocked db returning [], assert
  // body.canonical deep-equals getMajor('cs').categories.map(c => c.key)
  // and body.broad equals getMajor('cs').broadAxes
});
```

- [ ] **Step 2: Implement** — in `Curation.js` delete the `CANONICAL_CATEGORIES` / `BROAD_AXES` literals; at top `const { getMajor, defaultMajor } = require('../config/majors');`; inside `listCategories`:

```js
const entry = getMajor(String(req.query.major || '').trim() || defaultMajor().slug);
if (!entry) return res.status(400).json({ error: `unknown major: ${req.query.major}` });
// …existing rows query…
res.json({ categories, canonical: entry.categories.map((c) => c.key), broad: entry.broadAxes });
```

In `putCategory`, validate `category` against the entry's keys and add `major_slug: entry.slug` to the `$set`.

- [ ] **Step 3: Run** target test + full suite. **Step 4: Commit** `git commit -m "refactor(majors): course-category vocab served from majors config"`.

---

### Task 7: `courseTypes.js` per-major factory

**Files:**
- Modify: `server/services/courseTypes.js`
- Test: `server/services/courseTypes.test.js` (exists — check; extend)

**Interfaces:**
- Produces: `forMajor(majorEntry) -> { typeOfCourseCode, typeOfText, … same function names the module exports today }`. Existing top-level exports keep working and delegate to `forMajor(getMajor('cs'))` so no caller changes.

- [ ] **Step 1: Failing test:**

```js
const { forMajor } = require('./courseTypes');
const { getMajor } = require('../../config/majors');
it('forMajor(cs) matches the module-level cs behavior', () => {
  const cs = forMajor(getMajor('cs'));
  expect(cs.typeOfCourseCode('CSE', '12')).toBe(module_level_typeOfCourseCode('CSE', '12'));
  expect(cs.typeOfCourseCode('MATH', '20A')).toBe('math');
});
```

- [ ] **Step 2: Implement** — wrap the existing pure functions in a factory that takes the prefix sets / regex / text rules as arguments (from `majorEntry.coursePatterns`); module-level exports become `forMajor(getMajor('cs'))` spread. Keep the constants exported (Task 1 depends on them).

- [ ] **Step 3: Run** file + full suite. **Step 4: Commit** `git commit -m "refactor(majors): courseTypes per-major factory (cs delegation)"`.

---

### Task 8: Slug-aware snapshots

**Files:**
- Modify: `server/services/analysis/pathwaySnapshot.js`, `server/services/analysis/districtPathwayPlanner.js` (its `district-pathway-programs.v1.json` loader), `server/scripts/generateDistrictPathwaySnapshot.js`, `server/scripts/generateMultiCampusPathwaysSnapshot.js`, `server/scripts/generateDistrictPortfolioSubsets.js`
- Tests: `server/services/analysis/pathwaySnapshot.test.js`, `server/services/analysis/districtPathwayPlanner.test.js` (extend)

**Interfaces:**
- Produces: every snapshot loader takes an optional `majorSlug = 'cs'`. **Filename policy (decision recorded): `cs` resolves to the existing legacy filenames unchanged (frozen artifacts are never renamed); any other slug resolves to `<basename>.<slug>.v1.json`.** Generators accept `--major <slug>` (default `cs`), refuse to overwrite the frozen cs artifacts (`--major cs` errors with "cs snapshots are frozen"), resolve pins via `getMajor(slug).programs`, and derive expected program counts from the config instead of asserting `9`.

- [ ] **Step 1: Failing tests** — loader resolution:

```js
it('cs resolves to the legacy filename', () => {
  expect(snapshotPathFor('multi-campus-pathways', 'cs')).toMatch(/multi-campus-pathways\.v1\.json$/);
});
it('other slugs resolve to slugged filenames', () => {
  expect(snapshotPathFor('multi-campus-pathways', 'bio')).toMatch(/multi-campus-pathways\.bio\.v1\.json$/);
});
```

Add `snapshotPathFor(basename, slug)` as a small exported helper in `pathwaySnapshot.js` and use it in both loaders.

- [ ] **Step 2: Implement** loaders + generator `--major` flag (argv parse next to existing flags; each generator already parses argv — follow its pattern). Validators: replace literal `9` with `Object.keys(getMajor(slug).programs).length` (in `generateDistrictPathwaySnapshot.js:52-67` and equivalents). Add `major_slug` to generated snapshot metadata.

- [ ] **Step 3: Run** both test files + full suite. Do NOT run the generators.
- [ ] **Step 4: Commit** `git commit -m "feat(majors): slug-aware snapshot loaders and generators (cs frozen)"`.

---

### Task 9: Frontend majors hook + provider + picker

**Files:**
- Create: `frontend/src/shared/majors/useMajors.js`
- Create: `frontend/src/shared/majors/MajorContext.jsx`
- Create: `frontend/src/shared/majors/MajorPicker.jsx`
- Create: `frontend/src/shared/majors/MajorContext.test.jsx`
- Modify: `frontend/src/App.jsx` (wrap `Console` content in `MajorProvider` — find where other providers/`Shell` mount)

**Interfaces:**
- Produces: `useMajors() -> { majors, defaultSlug, bySlug, isLoading }` (fetches `/majors`; on error falls back to a built-in `[{ slug:'cs', label:'Computer Science', capabilities:{asDegrees:true, paperBaselines:true, transferMinimums:true} }]` stub); `useMajorSelection() -> { slug, setSlug, major }` (context, sessionStorage-persisted via `usePersistedState('major-selection', defaultSlug)` from `frontend/src/shared/hooks/usePersistedState.js`); `<MajorPicker value onChange lockedTo caption />` renders `null` when `majors.length < 2` and a locked single-value pill with `caption` when `lockedTo` excludes the current majors.

- [ ] **Step 1: Failing tests** (`MajorContext.test.jsx`, follow an existing frontend test for QueryClient + provider wrapping):

```jsx
it('picker renders nothing with a single onboarded major', …)
it('picker renders a Select with two majors and calls onChange with the slug', …)
it('useMajorSelection defaults to the server default slug', …)
```

Mock `/majors` through the file's existing apiClient mocking pattern (grep `vi.mock` in `frontend/src` tests for the convention) with one- and two-major payloads.

- [ ] **Step 2: Implement.** `useMajors` is a TanStack `useQuery({ queryKey: ['majors'], staleTime: Infinity })` on `apiClient.get('/majors')` with the fallback stub in `select`/`onError`. `MajorPicker` uses the shared `Select` from `components/ui` with `options = majors.map(m => ({ value: m.slug, label: m.label }))`, plus the locked state:

```jsx
export function MajorPicker({ value, onChange, lockedTo = null, caption = null, className }) {
  const { majors } = useMajors()
  const options = (lockedTo ? majors.filter((m) => lockedTo.includes(m.slug)) : majors)
  if (options.length < 2) {
    if (!lockedTo || majors.length < 2) return null
    return (
      <div className={className}>
        <span className='field-label'>Major</span>
        <p className='text-body-strong'>{options[0]?.label ?? 'Computer Science'}</p>
        {caption && <p className='text-caption text-ink-subtle'>{caption}</p>}
      </div>
    )
  }
  return <Select label='Major' value={value} options={options.map((m) => ({ value: m.slug, label: m.label }))} onChange={onChange} className={className} />
}
```

- [ ] **Step 3: Run** — `cd frontend && npm test -- shared/majors` then full `npm test` and `npm run build`.
- [ ] **Step 4: Commit** `git commit -m "feat(majors): frontend majors context and picker (no-op with one major)"`.

---

### Task 10: Analyses use the picker (five free-text + hooks)

**Files:**
- Modify: `frontend/src/shared/query/hooks/useData.js` (`useCoverage`, `useAnalysisEndpoint`, and the exported wrappers): accept `major` slug param, send `major` instead of `majorContains` when given, include it in `queryKey`.
- Modify: `frontend/src/analyses/CreditLoss.jsx`, `ChoiceCost.jsx`, `CategoryGaps.jsx`, `Complexity.jsx`, `TimeToDegree.jsx` — delete `DEFAULT_MAJOR_FILTER` and the `Input` filter; use `useMajorSelection()` + `<MajorPicker>` in the controls row.
- Test: extend one analysis test (e.g. existing `MultiCampusPathways.test.jsx` pattern) with a two-major mocked `/majors` asserting the picker appears; and a `useData` test asserting the `major` param is sent.

**Interfaces:**
- Consumes: Task 9's `useMajorSelection`/`MajorPicker`; Task 4's `major=<slug>` server param.
- Produces: analysis hooks signature `useCreditLoss({ major, majorContains, … })` — `major` preferred.

Steps follow the standard cycle: failing test → implement (per file: replace the `const [majorFilter, setMajorFilter] = useState(DEFAULT_MAJOR_FILTER)` state with `const { slug, setSlug } = useMajorSelection()`, replace the `<Input label='Major filter' …>` block with `<MajorPicker value={slug} onChange={setSlug} className='w-60 max-w-full' />`, pass `{ major: slug }` to the data hook) → run file tests → full suite + build → commit `feat(majors): analyses select majors via picker`.

---

### Task 11: Hardcoded analyses + capability gating

**Files:**
- Modify: `frontend/src/analyses/CoverageHeatmap.jsx`, `PaperDistrictHeatmap.jsx`, `IncomeAccess.jsx`, `CourseTypeCoverage.jsx`, `PaperArticulationHistogram.jsx`, `ArticulationCoverageMap.jsx`, `PaperCourseBarriers.jsx` (remove `MAJOR_FILTER`/`majorContains` constants), `TransferCreditRate.jsx`, `TransferExtraUnits.jsx`, `MultiCampusPathways.jsx` (gated)
- Test: extend `frontend/src/analyses/MultiCampusPathways.test.jsx` or nearest existing analysis test with the locked-picker case.

**Interfaces:**
- Consumes: `MajorPicker` `lockedTo`/`caption` (Task 9); each major's `capabilities` from `useMajors()`.
- Produces: capability policy — paper-baseline figures (`Paper*`, `ArticulationCoverageMap`, `IncomeAccess`, `CourseTypeCoverage`) pass `lockedTo={majors.filter(m => m.capabilities.paperBaselines).map(m => m.slug)}` and `caption='Paper-comparison figure — available for majors with validated baselines.'`; AS-degree figures (`TransferCreditRate`, `TransferExtraUnits`) use `capabilities.asDegrees` with `caption='Requires the AS-degree data layer.'`; snapshot-backed views (`MultiCampusPathways`) use `capabilities.snapshots.includes(<basename>)`. `CoverageHeatmap` is NOT gated — it becomes a normal picker consumer passing `{ major: slug }` to `useCoverage`.

Standard cycle per file; with only CS onboarded every picker renders null/locked-null so the UI is unchanged (assert this in the test with the one-major payload). Commit: `feat(majors): capability-gated major selection across visuals`.

---

### Task 12: Admin majors × campuses grid

**Files:**
- Modify: `frontend/src/AdminPage.jsx` (`MajorAccessPanel`, `majorsBySchool` → `majorsListBySchool`)
- Test: `frontend/src/AdminPage.test.jsx` if present, else create a focused `MajorAccessPanel.test.jsx` beside it following an existing page-test pattern.

**Interfaces:**
- Consumes: relaxed `PUT /admin/visible-majors` (Task 3); `useVisibleMajors()` payload `{ schools: [{school_id, school, majors: []}], visible: [{school_id, major}] }` (unchanged).
- Produces: per campus, a multi-select (checkbox list per campus row using the existing `Select`-adjacent primitives — check `components/ui` for a `Checkbox`; if absent use native `<input type='checkbox'>` with `field-label` styling). Selected state is `Map<schoolIdString, Set<major>>`. Save flattens to `[{school_id, major}]` preserving campus order then selection order. The "choose one for every campus" gating becomes "at least one pair overall"; copy updates to "Choose the majors visible at each UC campus."

Standard cycle: failing test (two majors selectable at one campus round-trip through save payload) → implement → run + build → commit `feat(majors): admin visible-majors grid supports multiple majors per campus`.

---

### Task 13: Data pages + audit scope

**Files:**
- Modify: `frontend/src/DataPage.jsx` (Community Colleges pane: `MajorPicker` above the agreements browser wired into the agreements query params; UC Campuses pane: program selector where the degree template renders — degree docs are keyed school+program via `useCuratedDegrees`-style hooks, read the pane first)
- Modify: `frontend/src/prereqs/` concept views (discipline filter from `major.conceptDisciplines`, with an "All disciplines" default option preserving today's view)
- Modify: `frontend/src/App.jsx` audit `ScopeLine` (`App.jsx:389` area): display the selected major label alongside `n_majors`
- Test: extend the nearest existing tests for DataPage/prereq components; with one major onboarded all these surfaces must render identically (picker null).

**Interfaces:**
- Consumes: `useMajorSelection`, `MajorPicker` (Task 9).
- Produces: agreements queries pass the selected major's campus program names as the existing `major` free-text param they already accept per agreement row (`useAgreementsBatch` filters client-side today — verify in `useData.js:78` region and filter rows by `programs[school_id]` membership when a slug is active with 2+ majors).

Standard cycle; the transfer-minimum panels and AS-degree panes are explicitly untouched (capability-gated CS surfaces). Commit: `feat(majors): contextual major selection on data pages and audit scope`.

---

### Task 14: Copy sweep + degreeSources keying

**Files:**
- Modify: `frontend/src/analyses/registry.js` (descriptions at :85,96,106,117,127,157,166 — rewrite "computer science" phrasing to major-neutral where the figure is picker-driven; keep CS wording where the figure is CS-locked), `frontend/src/analyses/measures.js:69`, `frontend/src/apiDocs/content.js` (document `major=<slug>`), `frontend/src/degrees/degreeSources.js` (wrap the existing map as `{ cs: {…existing…} }` with `sourcesFor(schoolId, majorSlug='cs')`; update its consumers — grep `degreeSources` imports).
- Test: run full frontend suite + build; no dedicated new tests beyond compile-level (registry/measures are copy).

Commit: `chore(majors): major-neutral copy and per-major degree sources`.

---

### Task 15: Golden-invariant verification (final gate)

- [ ] **Step 1:** `cd server && npm test` — full pass.
- [ ] **Step 2:** `cd frontend && npm test` — full pass.
- [ ] **Step 3:** `cd frontend && npm run build` — clean build.
- [ ] **Step 4:** Manual smoke with `npm run dev` (per `server/scripts/dev-db.sh` conventions / memory: online dev = plain `npm run dev`): Data tab (CC + UC panes render, no visible picker), Visuals tab (all figures render, no picker), Admin (visible-majors panel lists majors, save round-trips), Audit (scope line unchanged).
- [ ] **Step 5:** Confirm frozen artifacts untouched: `git status server/data/analysis frontend/src/analyses/data` shows no modifications.
- [ ] **Step 6:** Report results to Tybalt; he decides merge/PR (use superpowers:finishing-a-development-branch). No push without his say-so.

---

## Self-review notes (already applied)

- Spec §3 table rows all map to Tasks 4–8; §4 → Task 12; §5 → Tasks 9–11, 13; §6 → Task 8; §7 → Task 14; error handling → Tasks 4/6; testing → every task + Task 15.
- Filename policy decision (spec left it open): cs keeps legacy filenames (frozen), other slugs get `.<slug>.v1.json` — recorded in Task 8.
- `AdminVisibleMajors.test.js` is the single sanctioned existing-test change (Task 3), consistent with the spec's golden invariant framed on behavior, since one-per-campus is the rule being deliberately removed.
- Tasks 10–13 name exact files but tell the implementer to read each target section before editing — line anchors are from the 2026-07-22 scan.
