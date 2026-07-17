# Local AS Degree Data (CS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish per-college CS AS degree requirement data (statewide template + 115 per-school docs in the ASSIST agreement skeleton) in the database and a bulk QA surface in the console, ending at the design-handoff pause before the per-college view.

**Architecture:** Two new `curated_requirements` kinds (`as_degree_template`, `as_degree`) validated in `CanonicalData.js`; a read-time computed view service joining college names, provenance rollups, and template deviations; a bespoke QA table on a new Data → AS Degrees sub-tab; a Python importer applying an extraction artifact with group-level curated protection; extraction itself is in-session agent work (pilot of 14 → G2 template gate → statewide sweep of 115).

**Tech Stack:** Node/Express + Mongo (native driver, no ODM), Vitest + mongodb-memory-server, React 19 + TanStack Query + axios, Python 3 + pymongo for the importer.

**Spec:** `docs/superpowers/specs/2026-07-17-as-degree-data-design.md` (approved 2026-07-17). Read it before starting any task.

## Global Constraints

- All work happens on branch `as-degree-data` off `main`. Commit per task. **Never push without Tybalt's explicit go-ahead.**
- Field names in `as_degree.requirement_groups` must match `assist_agreements` exactly: `requirement_groups`, `is_required`, `group_conjunction`, `group_advisement`, `group_unit_advisement`, `group_min_distinct_sections`, `group_max_distinct_sections`, `group_section_min_courses`, `sections[].section_advisement`, `sections[].unit_advisement`, `receivers[].receiving/articulation_status/not_articulated_reason/options/options_conjunction/hash_id`, `options[].course_ids` (Numbers) + `options[].course_conjunction` + `options[].course_keys` (`'cc:<n>'` mirrors).
- Units are stored in the college's native system (`unit_system: 'semester' | 'quarter'`); no quarter↔semester conversion anywhere in this feature.
- `verification.notes` is strictly user-authored: no code path, importer, or agent ever writes it.
- The legacy `associate_degree` kind, `Curation.js` assoc-degree CRUD, and `timeToDegreeData` in `server/services/analysis/pathways.js` are **untouched**.
- `server/services/analysis/eligibility.js` and `minCourses.js` are golden-locked — never modified; Task 2 only *imports* from eligibility.js in a test.
- No LLM SDK or API key enters the repo; extraction is in-session Claude Code agent work producing git-committed JSON artifacts (concept-mapping discipline).
- Title 5 GE areas constant (used by both validators and the importer): `['natural_sciences', 'social_behavioral', 'humanities', 'language_rationality', 'math_competency']`.
- `same_as_keys` on `assist_courses` is corrupted (`'cc:[object Object]'`) — never read it; resolve cross-listings via the `same_as` objects' numeric `course_id` if ever needed.
- Server tests: colocated `<module>.test.js`, run with `cd server && npm test -- <path>`. Frontend tests: colocated `.test.jsx`, run with `cd frontend && npm test -- <path>`. Python importers have **no test convention** — verification is `--dry-run` against committed `*.sample.json` fixtures.

---

### Task 1: Register the kinds + `as_degree_template` validation

**Files:**
- Modify: `server/controllers/CanonicalData.js` (kind registry ~line 15; validator after `validatePrereqConcept` ~line 102; dispatch inside `putRequirement` ~line 237)
- Test: `server/controllers/CanonicalData.test.js` (extend)

**Interfaces:**
- Consumes: existing `REQUIREMENT_PREFIX`, `CONCEPT_SLUG_RE`, `COLLECTIONS`, `putRequirement` dispatch pattern.
- Produces: kinds `as_degree_template` and `as_degree` accepted by the generic `/api/curated/requirements` routes (no route changes needed); `GE_AREAS` module constant; `async function validateAsDegreeTemplate(db, canonical) -> string | null`. Task 2 adds `validateAsDegree`; Task 3 adds delete guards; Task 8's importer writes docs that must satisfy these validators.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/tybaltmallet/Desktop/transfer_pathways/internal_tool
git checkout -b as-degree-data main
```

- [ ] **Step 2: Write the failing tests**

Append to `server/controllers/CanonicalData.test.js` (it already imports `putRequirement` and has the `request`/`run` helpers and in-memory mongo — reuse them):

```js
describe('as_degree_template kind', () => {
  const seedConcepts = () => db.collection('curated_requirements').insertMany([
    { _id: 'prereq_concept:cs_1', kind: 'prereq_concept', slug: 'cs_1', requires: [] },
    { _id: 'prereq_concept:cs_2_oop', kind: 'prereq_concept', slug: 'cs_2_oop', requires: ['cs_1'] },
    { _id: 'prereq_concept:calc_1', kind: 'prereq_concept', slug: 'calc_1', requires: [] },
  ]);

  const template = () => ({
    _id: 'as_degree_template:cs',
    slug: 'cs',
    name: 'AS in Computer Science (statewide template)',
    total_units_min: 60,
    groups: [
      {
        group_id: 'core_programming', label: 'Programming core', is_required: true,
        sections: [{ section_advisement: null, unit_advisement: null,
          slots: [{ concepts: ['cs_1'] }, { concepts: ['cs_2_oop'] }] }],
      },
      {
        group_id: 'ge_natural_sciences', label: 'GE: Natural Sciences', is_required: true,
        ge_area: 'natural_sciences',
        sections: [{ section_advisement: null, unit_advisement: 3, slots: [] }],
      },
      { group_id: 'electives', label: 'Electives to total', units_fill: true },
    ],
  });

  it('accepts a well-formed template and stamps curated_by', async () => {
    await seedConcepts();
    const res = await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: template() }));
    expect(res.statusCode).toBe(200);
    const stored = await db.collection('curated_requirements').findOne({ _id: 'as_degree_template:cs' });
    expect(stored).toMatchObject({ kind: 'as_degree_template', legacy_id: 'cs', curated_by: 'curator-1' });
  });

  it('rejects a slot referencing an unknown concept', async () => {
    await seedConcepts();
    const body = template();
    body.groups[0].sections[0].slots.push({ concepts: ['quantum_basket_weaving'] });
    const res = await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unknown concept: quantum_basket_weaving/);
  });

  it('rejects a bad ge_area, a duplicate group_id, and sections on a units_fill group', async () => {
    await seedConcepts();
    const badArea = template();
    badArea.groups[1].ge_area = 'underwater_arts';
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: badArea }))).statusCode).toBe(400);

    const dup = template();
    dup.groups[1].group_id = 'core_programming';
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: dup }))).statusCode).toBe(400);

    const filled = template();
    filled.groups[2].sections = [{ slots: [] }];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: filled }))).statusCode).toBe(400);
  });

  it('rejects a non-ge_area section with no slots and a non-positive advisement', async () => {
    await seedConcepts();
    const empty = template();
    empty.groups[0].sections[0].slots = [];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: empty }))).statusCode).toBe(400);

    const negative = template();
    negative.groups[0].sections[0].section_advisement = 0;
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: negative }))).statusCode).toBe(400);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd server && npm test -- controllers/CanonicalData.test.js`
Expected: the new describe block FAILS — `putRequirement` returns 404 `unknown requirement kind` for `as_degree_template` (kind not registered yet).

- [ ] **Step 4: Implement**

In `server/controllers/CanonicalData.js`:

(a) Extend the registry (~line 15):

```js
const REQUIREMENT_PREFIX = Object.freeze({
  transfer_minimum: 'transfer_minimum',
  degree: 'degree',
  ge_pattern: 'ge_pattern',
  igetc: 'igetc',
  associate_degree: 'associate_degree',
  prereq_concept: 'prereq_concept',
  as_degree_template: 'as_degree_template',
  as_degree: 'as_degree',
});
```

(b) Add the constant next to `CONCEPT_DISCIPLINES` (~line 46):

```js
// Title 5 §55063 local-GE areas for associate degrees (spec §1A).
const GE_AREAS = ['natural_sciences', 'social_behavioral', 'humanities', 'language_rationality', 'math_competency'];
```

(c) Add the validator after `validatePrereqConcept` (~line 102). Return-string-or-null convention, same as the precedent:

```js
// as_degree_template: statewide concept-slotted degree template (spec §1A).
// Groups mirror the agreement skeleton but hold concept slots, not receivers.
async function validateAsDegreeTemplate(db, canonical) {
  const slug = String(canonical.slug || '');
  if (!CONCEPT_SLUG_RE.test(slug)) return 'slug must match ^[a-z0-9_]+$';
  if (slug !== String(canonical.legacy_id)) return 'slug must equal the row id';
  if (typeof canonical.name !== 'string' || !canonical.name.trim()) return 'name is required';
  if (!Number.isFinite(canonical.total_units_min) || canonical.total_units_min <= 0) {
    return 'total_units_min must be a positive number';
  }
  if (!Array.isArray(canonical.groups) || canonical.groups.length === 0) {
    return 'groups must be a non-empty array';
  }
  const conceptRows = await db.collection(COLLECTIONS.requirements)
    .find({ kind: 'prereq_concept' }, { projection: { slug: 1 } })
    .toArray();
  const known = new Set(conceptRows.map((r) => String(r.slug)));
  const seenIds = new Set();
  for (const g of canonical.groups) {
    const gid = String(g.group_id || '');
    if (!CONCEPT_SLUG_RE.test(gid)) return 'each group needs a group_id matching ^[a-z0-9_]+$';
    if (seenIds.has(gid)) return `duplicate group_id: ${gid}`;
    seenIds.add(gid);
    if (typeof g.label !== 'string' || !g.label.trim()) return `group ${gid}: label is required`;
    if (g.ge_area != null && !GE_AREAS.includes(g.ge_area)) {
      return `group ${gid}: ge_area must be one of ${GE_AREAS.join(', ')}`;
    }
    if (g.units_fill === true) {
      if (g.sections != null) return `group ${gid}: a units_fill group must not have sections`;
      continue;
    }
    if (!Array.isArray(g.sections) || g.sections.length === 0) {
      return `group ${gid}: sections must be a non-empty array`;
    }
    for (const s of g.sections) {
      for (const key of ['section_advisement', 'unit_advisement']) {
        if (s[key] != null && (!Number.isFinite(s[key]) || s[key] <= 0)) {
          return `group ${gid}: ${key} must be null or a positive number`;
        }
      }
      if (!Array.isArray(s.slots)) return `group ${gid}: each section needs a slots array`;
      if (g.ge_area == null && s.slots.length === 0) {
        return `group ${gid}: a non-ge_area section must list at least one slot`;
      }
      for (const slot of s.slots) {
        const alts = slot && slot.concepts;
        if (!Array.isArray(alts) || alts.length === 0 || alts.some((c) => typeof c !== 'string')) {
          return `group ${gid}: each slot needs a non-empty concepts array of slugs`;
        }
        for (const c of alts) {
          if (!known.has(c)) return `group ${gid}: slot references unknown concept: ${c}`;
        }
      }
    }
  }
  return null;
}
```

(d) Dispatch inside `putRequirement`, as a sibling of the `prereq_concept` block (~line 237, before the `replaceOne`):

```js
  if (kind === 'as_degree_template') {
    const invalid = await validateAsDegreeTemplate(db, canonical);
    if (invalid) return res.status(400).json({ error: invalid });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npm test -- controllers/CanonicalData.test.js`
Expected: PASS (all pre-existing tests too — the registry change must not break the `degree`/`prereq_concept` suites).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/CanonicalData.js server/controllers/CanonicalData.test.js
git commit -m "feat: as_degree_template kind with concept-slot validation"
```

---

### Task 2: `as_degree` validation + group-level curated stamping + engine-acceptance test

**Files:**
- Modify: `server/controllers/CanonicalData.js` (validator after `validateAsDegreeTemplate`; dispatch in `putRequirement`)
- Test: `server/controllers/CanonicalData.test.js` (extend)

**Interfaces:**
- Consumes: Task 1's `GE_AREAS`, kind registration, `validateAsDegreeTemplate` (for seeding a template in tests).
- Produces: `async function validateAsDegree(db, canonical) -> string | null`; constants `AS_DEGREE_STATUSES = ['found', 'none_found', 'ambiguous']`, `AS_DEGREE_SOURCES = ['extracted', 'template_default', 'curated']`, `UNIT_SYSTEMS = ['semester', 'quarter']`; the putRequirement `as_degree` block that stamps group-level `curated_by`/`curated_at` on `source: 'curated'` groups lacking them. Tasks 4, 5, 8 all rely on docs having exactly this shape.

- [ ] **Step 1: Write the failing tests**

Append to `server/controllers/CanonicalData.test.js`:

```js
describe('as_degree kind', () => {
  const seedForDegree = async () => {
    await db.collection('assist_institutions').insertOne({
      _id: 'cc:110', kind: 'community_college', source_id: 110, name: 'Allan Hancock College',
    });
    await db.collection('curated_requirements').insertOne({
      _id: 'as_degree_template:cs', kind: 'as_degree_template', slug: 'cs', groups: [],
    });
  };

  const degreeDoc = () => ({
    _id: 'as_degree:110:cs',
    community_college_id: 110,
    college_id: 'cc:110',
    major_slug: 'cs',
    template_ref: 'as_degree_template:cs',
    status: 'found',
    degree_title_seen: 'Computer Science, A.S.',
    catalog_url: 'https://catalog.hancockcollege.edu/cs-as',
    catalog_year: '2025-2026',
    unit_system: 'semester',
    total_units: 60,
    verification: { verified: false, verified_by: null, verified_at: null, notes: null },
    requirement_groups: [
      {
        is_required: true, group_conjunction: 'And',
        group_advisement: null, group_unit_advisement: null,
        group_min_distinct_sections: null, group_max_distinct_sections: null,
        group_section_min_courses: null,
        sections: [{
          section_advisement: null, unit_advisement: null,
          receivers: [
            { receiving: null, articulation_status: 'articulated', not_articulated_reason: null,
              options: [{ course_ids: [101], course_conjunction: 'and', course_keys: ['cc:101'] }],
              options_conjunction: 'and', hash_id: null },
            { receiving: null, articulation_status: 'articulated', not_articulated_reason: null,
              options: [{ course_ids: [102], course_conjunction: 'and', course_keys: ['cc:102'] }],
              options_conjunction: 'and', hash_id: null },
          ],
        }],
        group_id: 'core_programming', template_group: 'core_programming',
        label_seen: 'Required Core', source: 'extracted', confidence: 0.93,
        curated_by: null, ge_area: null, units_fill: false, unresolved_courses_seen: [],
      },
      { group_id: 'ge_humanities', template_group: 'ge_humanities',
        source: 'template_default', confidence: null, curated_by: null },
    ],
  });

  it('accepts a well-formed found doc', async () => {
    await seedForDegree();
    const res = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: degreeDoc() }));
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe('as_degree:110:cs');
  });

  it('stamps group-level curated_by on curated groups only', async () => {
    await seedForDegree();
    const body = degreeDoc();
    body.requirement_groups[0].source = 'curated';
    body.requirement_groups[0].confidence = null;
    await run(putRequirement, request({ params: { kind: 'as_degree' }, body }));
    const stored = await db.collection('curated_requirements').findOne({ _id: 'as_degree:110:cs' });
    expect(stored.requirement_groups[0].curated_by).toBe('curator-1');
    expect(stored.requirement_groups[0].curated_at).toBeInstanceOf(Date);
    expect(stored.requirement_groups[1].curated_by).toBe(null);
  });

  it('rejects mismatched ids, unknown college, string course_ids, and bad mirrors', async () => {
    await seedForDegree();
    const wrongCc = degreeDoc();
    wrongCc.community_college_id = 111;
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: wrongCc }))).statusCode).toBe(400);

    const noCollege = degreeDoc();
    noCollege._id = 'as_degree:999:cs';
    noCollege.community_college_id = 999;
    noCollege.college_id = 'cc:999';
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: noCollege }))).statusCode).toBe(400);

    const stringIds = degreeDoc();
    stringIds.requirement_groups[0].sections[0].receivers[0].options[0].course_ids = ['cc:101'];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: stringIds }))).statusCode).toBe(400);

    const badMirror = degreeDoc();
    badMirror.requirement_groups[0].sections[0].receivers[0].options[0].course_keys = ['cc:999'];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: badMirror }))).statusCode).toBe(400);
  });

  it('rejects confidence on non-extracted groups and sections on template_default stubs', async () => {
    await seedForDegree();
    const conf = degreeDoc();
    conf.requirement_groups[1].confidence = 0.5;
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: conf }))).statusCode).toBe(400);

    const stub = degreeDoc();
    stub.requirement_groups[1].sections = [{ receivers: [] }];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: stub }))).statusCode).toBe(400);
  });

  it('accepts none_found rows without a body and rejects them with one', async () => {
    await seedForDegree();
    const none = {
      _id: 'as_degree:110:cs', community_college_id: 110, college_id: 'cc:110',
      major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'none_found',
      catalog_url: 'https://catalog.hancockcollege.edu/programs',
      catalog_year: '2025-2026',
    };
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: none }))).statusCode).toBe(200);
    const withBody = { ...none, requirement_groups: [{ group_id: 'x' }] };
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: withBody }))).statusCode).toBe(400);
  });

  it('produces a body the golden eligibility engine evaluates unchanged', async () => {
    // The point of the shared skeleton (spec §7): no translation layer.
    const { isMajorArticulable } = cjs('../services/analysis/eligibility');
    const m = { requirement_groups: degreeDoc().requirement_groups.filter((g) => g.sections) };
    expect(isMajorArticulable(m, true)).toBe(true);
    expect(isMajorArticulable(m, false)).toBe(true);
  });
});
```

Note: `cjs` is the `createRequire` helper already defined at the top of this test file. If `isMajorArticulable` is not among `eligibility.js`'s exports, check `module.exports` at the bottom of `server/services/analysis/eligibility.js` and use the exported articulability entry point named there — do not modify eligibility.js.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- controllers/CanonicalData.test.js`
Expected: FAIL — `as_degree` docs are accepted with no validation (kind registered in Task 1 but no validator), so the rejection tests fail; the stamping test fails (no stamping code).

- [ ] **Step 3: Implement**

In `server/controllers/CanonicalData.js`, after `validateAsDegreeTemplate`:

```js
const AS_DEGREE_STATUSES = ['found', 'none_found', 'ambiguous'];
const AS_DEGREE_SOURCES = ['extracted', 'template_default', 'curated'];
const UNIT_SYSTEMS = ['semester', 'quarter'];

// as_degree: one college's local AS degree in the agreement skeleton
// (spec §1B). Body fields mirror assist_agreements exactly so the golden
// engines can evaluate the doc with no translation layer.
async function validateAsDegree(db, canonical) {
  const idMatch = /^(\d+):([a-z0-9_]+)$/.exec(String(canonical.legacy_id || ''));
  if (!idMatch) return 'row id must look like <community_college_id>:<major_slug>, e.g. 110:cs';
  const ccId = Number(idMatch[1]);
  if (canonical.community_college_id !== ccId) {
    return 'community_college_id must match the numeric part of the row id';
  }
  if (canonical.college_id !== `cc:${ccId}`) return `college_id must be 'cc:${ccId}'`;
  if (canonical.major_slug !== idMatch[2]) return 'major_slug must match the slug part of the row id';
  const inst = await db.collection(COLLECTIONS.institutions)
    .findOne({ _id: `cc:${ccId}` }, { projection: { kind: 1 } });
  if (!inst || inst.kind !== 'community_college') return `no community college with id cc:${ccId}`;
  if (canonical.template_ref != null) {
    const tpl = await db.collection(COLLECTIONS.requirements)
      .findOne({ _id: canonical.template_ref, kind: 'as_degree_template' }, { projection: { _id: 1 } });
    if (!tpl) return `template_ref not found: ${canonical.template_ref}`;
  }
  if (!AS_DEGREE_STATUSES.includes(canonical.status)) {
    return `status must be one of ${AS_DEGREE_STATUSES.join(', ')}`;
  }
  if (canonical.verification != null && typeof canonical.verification !== 'object') {
    return 'verification must be an object';
  }
  if (canonical.status !== 'found') {
    if (Array.isArray(canonical.requirement_groups) && canonical.requirement_groups.length) {
      return `a ${canonical.status} row must not carry requirement_groups`;
    }
    return null;
  }
  if (typeof canonical.degree_title_seen !== 'string' || !canonical.degree_title_seen.trim()) {
    return 'degree_title_seen is required on a found row';
  }
  if (typeof canonical.catalog_url !== 'string' || !/^https?:\/\//.test(canonical.catalog_url)) {
    return 'catalog_url must be an http(s) URL';
  }
  if (typeof canonical.catalog_year !== 'string' || !canonical.catalog_year.trim()) {
    return 'catalog_year is required on a found row';
  }
  if (!UNIT_SYSTEMS.includes(canonical.unit_system)) {
    return `unit_system must be one of ${UNIT_SYSTEMS.join(', ')}`;
  }
  if (!Number.isFinite(canonical.total_units) || canonical.total_units <= 0) {
    return 'total_units must be a positive number';
  }
  if (!Array.isArray(canonical.requirement_groups) || !canonical.requirement_groups.length) {
    return 'requirement_groups must be a non-empty array on a found row';
  }
  const seenIds = new Set();
  for (const g of canonical.requirement_groups) {
    const gid = String(g.group_id || '');
    if (!CONCEPT_SLUG_RE.test(gid)) return 'each group needs a group_id matching ^[a-z0-9_]+$';
    if (seenIds.has(gid)) return `duplicate group_id: ${gid}`;
    seenIds.add(gid);
    if (g.template_group != null && g.template_group !== gid) {
      return `group ${gid}: template_group must equal group_id or be null`;
    }
    if (!AS_DEGREE_SOURCES.includes(g.source)) {
      return `group ${gid}: source must be one of ${AS_DEGREE_SOURCES.join(', ')}`;
    }
    if (g.source === 'extracted') {
      if (!Number.isFinite(g.confidence) || g.confidence < 0 || g.confidence > 1) {
        return `group ${gid}: an extracted group needs confidence in [0,1]`;
      }
    } else if (g.confidence != null) {
      return `group ${gid}: confidence must be null unless source is extracted`;
    }
    if (g.ge_area != null && !GE_AREAS.includes(g.ge_area)) {
      return `group ${gid}: ge_area must be one of ${GE_AREAS.join(', ')}`;
    }
    if (g.source === 'template_default') {
      // A stub: the template's group renders in its place at read time.
      if (g.template_group == null) return `group ${gid}: a template_default group needs template_group`;
      if (Array.isArray(g.sections) && g.sections.length) {
        return `group ${gid}: a template_default stub must not carry sections`;
      }
      continue;
    }
    if (g.units_fill === true) {
      if (Array.isArray(g.sections) && g.sections.length) {
        return `group ${gid}: a units_fill group must not have sections`;
      }
      continue;
    }
    if (!Array.isArray(g.sections) || !g.sections.length) {
      return `group ${gid}: sections must be a non-empty array`;
    }
    for (const s of g.sections) {
      for (const key of ['section_advisement', 'unit_advisement']) {
        if (s[key] != null && (!Number.isFinite(s[key]) || s[key] <= 0)) {
          return `group ${gid}: ${key} must be null or a positive number`;
        }
      }
      if (!Array.isArray(s.receivers)) return `group ${gid}: each section needs a receivers array`;
      if (g.ge_area == null && !s.receivers.length) {
        return `group ${gid}: a non-ge_area section must list at least one receiver`;
      }
      for (const r of s.receivers) {
        if (r.receiving != null) return `group ${gid}: receiving must be null on as_degree receivers`;
        if (r.articulation_status !== 'articulated') {
          return `group ${gid}: articulation_status must be 'articulated'`;
        }
        if (!Array.isArray(r.options) || !r.options.length) {
          return `group ${gid}: each receiver needs at least one option`;
        }
        for (const o of r.options) {
          if (!Array.isArray(o.course_ids) || !o.course_ids.length
              || o.course_ids.some((id) => !Number.isInteger(id))) {
            return `group ${gid}: option course_ids must be a non-empty array of Numbers`;
          }
          const keys = o.course_keys;
          if (!Array.isArray(keys) || keys.length !== o.course_ids.length
              || keys.some((k, i) => k !== `cc:${o.course_ids[i]}`)) {
            return `group ${gid}: course_keys must mirror course_ids as 'cc:<n>'`;
          }
        }
      }
    }
    const unresolved = g.unresolved_courses_seen;
    if (unresolved != null && (!Array.isArray(unresolved)
        || unresolved.some((u) => typeof (u && u.course_code_seen) !== 'string'))) {
      return `group ${gid}: unresolved_courses_seen must be an array of {course_code_seen, ...}`;
    }
  }
  return null;
}
```

Dispatch in `putRequirement`, after the `as_degree_template` block:

```js
  if (kind === 'as_degree') {
    const invalid = await validateAsDegree(db, canonical);
    if (invalid) return res.status(400).json({ error: invalid });
    // Group-level curation stamp: the doc-level curated_by above records who
    // last saved; group-level curated_by records who confirmed THIS group.
    for (const g of canonical.requirement_groups || []) {
      if (g.source === 'curated' && !g.curated_by) {
        g.curated_by = req.user?.uid ?? null;
        g.curated_at = new Date();
      }
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- controllers/CanonicalData.test.js`
Expected: PASS.

Also run the untouched golden suite to prove no engine drift:
Run: `cd server && npm test -- services/analysis/eligibility.test.js`
Expected: PASS with zero modifications to eligibility.js.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/CanonicalData.js server/controllers/CanonicalData.test.js
git commit -m "feat: as_degree kind — agreement-skeleton validation + group curation stamps"
```

---

### Task 3: Delete guards

**Files:**
- Modify: `server/controllers/CanonicalData.js` (`deleteRequirement`, ~line 252)
- Test: `server/controllers/CanonicalData.test.js` (extend)

**Interfaces:**
- Consumes: Tasks 1–2 kinds; existing `prereq_concept` guard block in `deleteRequirement`.
- Produces: deleting an `as_degree_template` referenced by `as_degree.template_ref` → 400; deleting a `prereq_concept` referenced by template slots → 400 (extends the existing guard's `Promise.all`).

- [ ] **Step 1: Write the failing tests**

Append to `server/controllers/CanonicalData.test.js` (imports `deleteRequirement` already):

```js
describe('as_degree delete guards', () => {
  it('blocks deleting a template that as_degree rows reference', async () => {
    await db.collection('curated_requirements').insertMany([
      { _id: 'as_degree_template:cs', kind: 'as_degree_template', slug: 'cs' },
      { _id: 'as_degree:110:cs', kind: 'as_degree', template_ref: 'as_degree_template:cs' },
    ]);
    const res = await run(deleteRequirement, request({ params: { kind: 'as_degree_template', id: 'cs' } }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/referenced by 1 as_degree/);
  });

  it('blocks deleting a concept referenced by a template slot', async () => {
    await db.collection('curated_requirements').insertMany([
      { _id: 'prereq_concept:cs_1', kind: 'prereq_concept', slug: 'cs_1', requires: [] },
      { _id: 'as_degree_template:cs', kind: 'as_degree_template', slug: 'cs',
        groups: [{ group_id: 'core', sections: [{ slots: [{ concepts: ['cs_1'] }] }] }] },
    ]);
    const res = await run(deleteRequirement, request({ params: { kind: 'prereq_concept', id: 'cs_1' } }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/template/);
  });

  it('allows deleting an unreferenced template', async () => {
    await db.collection('curated_requirements').insertOne(
      { _id: 'as_degree_template:old', kind: 'as_degree_template', slug: 'old' });
    const res = await run(deleteRequirement, request({ params: { kind: 'as_degree_template', id: 'old' } }));
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- controllers/CanonicalData.test.js`
Expected: FAIL — deletes succeed (200) where 400 is expected.

- [ ] **Step 3: Implement**

In `deleteRequirement`, extend the existing `prereq_concept` guard's `Promise.all` to three counts and add a sibling `as_degree_template` guard:

```js
  if (kind === 'prereq_concept') {
    const slug = canonicalId.slice(prefix.length);
    const [dependents, mapped, templated] = await Promise.all([
      req.app.locals.db.collection(COLLECTIONS.requirements)
        .countDocuments({ kind: 'prereq_concept', requires: slug }),
      req.app.locals.db.collection(COLLECTIONS.courses)
        .countDocuments({ concept: slug }),
      req.app.locals.db.collection(COLLECTIONS.requirements)
        .countDocuments({ kind: 'as_degree_template', 'groups.sections.slots.concepts': slug }),
    ]);
    if (dependents || mapped || templated) {
      return res.status(400).json({
        error: `concept is referenced by ${dependents} concept(s), ${mapped} course(s), and ${templated} degree template(s); reassign them first`,
      });
    }
  }
  if (kind === 'as_degree_template') {
    const referencing = await req.app.locals.db.collection(COLLECTIONS.requirements)
      .countDocuments({ kind: 'as_degree', template_ref: canonicalId });
    if (referencing) {
      return res.status(400).json({
        error: `template is referenced by ${referencing} as_degree row(s); delete or repoint them first`,
      });
    }
  }
```

Note the existing prereq_concept error-message assertion in older tests may match on the previous wording — if `npm test` shows an old test asserting the exact string `and ${mapped} course(s); reassign`, update that assertion to the new message (this is the one permitted test edit).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- controllers/CanonicalData.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/CanonicalData.js server/controllers/CanonicalData.test.js
git commit -m "feat: delete guards for as_degree_template and template-referenced concepts"
```

---

### Task 4: Computed view service + `/api/curated/as-degrees` endpoint

**Files:**
- Create: `server/services/asDegreeView.js`
- Test: `server/services/asDegreeView.test.js`
- Modify: `server/controllers/CanonicalData.js` (new handler `asDegrees` at the bottom, before exports), `server/routes/api.js` (~line 34, one new GET)

**Interfaces:**
- Consumes: `as_degree`/`as_degree_template` docs (Tasks 1–2 shapes), `assist_institutions`, `assist_courses`.
- Produces:
  - `asDegreeOverview(db) -> Promise<{ template, rows }>` where each row is `{ _id, community_college_id, college_id, college_name, status, degree_title_seen, catalog_url, catalog_year, unit_system, total_units, group_count, source_counts: {extracted, template_default, curated}, confidence_min, confidence_mean, unresolved_count, units_accounted, deviations: {missing_groups, extra_groups}, flags: string[], verified, updated_at }`.
  - `asDegreeDetail(db, collegeId /* 'cc:<n>' */) -> Promise<null | { doc, college_name, courses_by_id, deviations }>` where `courses_by_id['cc:<n>'] = { code, title, units, concept }`.
  - Endpoint: `GET /api/curated/as-degrees` → overview; `GET /api/curated/as-degrees?college_id=cc:<n>` → detail (404 when absent). Task 5's hooks call exactly these.
  - Flags vocabulary (Task 5 renders these): `ambiguous`, `template_default_groups`, `low_confidence` (any extracted group < 0.7), `unresolved_courses`, `units_mismatch` (no units_fill group and |units_accounted − total_units| > 1).

- [ ] **Step 1: Write the failing tests**

Create `server/services/asDegreeView.test.js`:

```js
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { asDegreeOverview, asDegreeDetail } = cjs('./asDegreeView');

let mongo; let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('as_degree_view_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

const receiver = (courseId) => ({
  receiving: null, articulation_status: 'articulated', not_articulated_reason: null,
  options: [{ course_ids: [courseId], course_conjunction: 'and', course_keys: [`cc:${courseId}`] }],
  options_conjunction: 'and', hash_id: null,
});

async function seed() {
  await db.collection('assist_institutions').insertMany([
    { _id: 'cc:110', kind: 'community_college', source_id: 110, name: 'Allan Hancock College' },
    { _id: 'cc:2', kind: 'community_college', source_id: 2, name: 'Evergreen Valley College' },
  ]);
  await db.collection('assist_courses').insertMany([
    { _id: 'cc:101', course_id: 101, prefix: 'CS', number: '111', title: 'Programming I', units: 4, concept: 'cs_1' },
    { _id: 'cc:102', course_id: 102, prefix: 'CS', number: '112', title: 'Programming II', units: 4, concept: 'cs_2_oop' },
  ]);
  await db.collection('curated_requirements').insertMany([
    { _id: 'as_degree_template:cs', kind: 'as_degree_template', slug: 'cs',
      groups: [
        { group_id: 'core_programming', label: 'Programming core', sections: [] },
        { group_id: 'ge_humanities', label: 'GE: Humanities', ge_area: 'humanities', sections: [] },
        { group_id: 'electives', label: 'Electives', units_fill: true },
      ] },
    { _id: 'as_degree:110:cs', kind: 'as_degree', community_college_id: 110, college_id: 'cc:110',
      major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'found',
      degree_title_seen: 'Computer Science, A.S.', catalog_url: 'https://x', catalog_year: '2025-2026',
      unit_system: 'semester', total_units: 60,
      verification: { verified: false },
      requirement_groups: [
        { group_id: 'core_programming', template_group: 'core_programming', source: 'extracted',
          confidence: 0.6, label_seen: 'Core', is_required: true,
          sections: [{ section_advisement: null, unit_advisement: null,
            receivers: [receiver(101), receiver(102)] }],
          unresolved_courses_seen: [{ course_code_seen: 'CS 199' }] },
        { group_id: 'ge_humanities', template_group: 'ge_humanities', source: 'template_default', confidence: null },
        { group_id: 'ethics', template_group: null, source: 'extracted', confidence: 1,
          label_seen: 'Computer Ethics', is_required: true,
          sections: [{ section_advisement: null, unit_advisement: 3, receivers: [receiver(101)] }] },
      ] },
    { _id: 'as_degree:2:cs', kind: 'as_degree', community_college_id: 2, college_id: 'cc:2',
      major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'none_found',
      catalog_url: 'https://y', catalog_year: '2025-2026' },
  ]);
}

describe('asDegreeOverview', () => {
  it('rolls up provenance, confidence, deviations, and flags per college', async () => {
    await seed();
    const { template, rows } = await asDegreeOverview(db);
    expect(template._id).toBe('as_degree_template:cs');
    expect(rows).toHaveLength(2);
    const hancock = rows.find((r) => r.college_id === 'cc:110');
    expect(hancock.college_name).toBe('Allan Hancock College');
    expect(hancock.source_counts).toEqual({ extracted: 2, template_default: 1, curated: 0 });
    expect(hancock.confidence_min).toBe(0.6);
    expect(hancock.unresolved_count).toBe(1);
    // 4 + 4 units from the all-required section, + 3 from the unit_advisement section
    expect(hancock.units_accounted).toBe(11);
    expect(hancock.deviations).toEqual({ missing_groups: ['electives'], extra_groups: ['ethics'] });
    expect(hancock.flags).toEqual(
      expect.arrayContaining(['template_default_groups', 'low_confidence', 'unresolved_courses', 'units_mismatch']));
    const evergreen = rows.find((r) => r.college_id === 'cc:2');
    expect(evergreen.status).toBe('none_found');
    expect(evergreen.flags).toEqual([]);
  });
});

describe('asDegreeDetail', () => {
  it('returns the doc with joined course details and deviations', async () => {
    await seed();
    const detail = await asDegreeDetail(db, 'cc:110');
    expect(detail.college_name).toBe('Allan Hancock College');
    expect(detail.courses_by_id['cc:101']).toEqual(
      { code: 'CS 111', title: 'Programming I', units: 4, concept: 'cs_1' });
    expect(detail.deviations.extra_groups).toEqual(['ethics']);
    expect(await asDegreeDetail(db, 'cc:999')).toBe(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- services/asDegreeView.test.js`
Expected: FAIL — `Cannot find module './asDegreeView'`.

- [ ] **Step 3: Implement the service**

Create `server/services/asDegreeView.js`:

```js
// Read-time computed view over as_degree docs: college-name joins, per-group
// provenance/confidence rollups, and a diff against the statewide template.
// Display-level only — no analysis math lives here (spec §6). The stored doc
// is never mutated; template_default stubs are resolved by the CONSUMER
// joining `template`, not by copying template content into docs.

const TEMPLATE_FALLBACK_ID = 'as_degree_template:cs';
const LOW_CONFIDENCE = 0.7;

function collectCourseIds(docs) {
  const ids = new Set();
  for (const doc of docs) {
    for (const g of doc.requirement_groups || []) {
      for (const s of g.sections || []) {
        for (const r of s.receivers || []) {
          for (const o of r.options || []) {
            for (const id of o.course_ids || []) ids.add(id);
          }
        }
      }
    }
  }
  return [...ids];
}

async function loadCourses(db, docs) {
  const ids = collectCourseIds(docs);
  if (!ids.length) return [];
  return db.collection('assist_courses')
    .find({ _id: { $in: ids.map((id) => `cc:${id}`) } },
      { projection: { course_id: 1, prefix: 1, number: 1, title: 1, units: 1, concept: 1 } })
    .toArray();
}

// Best-effort display sum (spec §5 unit accounting): unit-advisement sections
// contribute their stated units; all-required sections sum each receiver's
// first option; choose-N sections contribute N × the mean receiver units.
function groupUnits(group, unitsByCourseId) {
  if (group.units_fill || group.source === 'template_default') return 0;
  let total = 0;
  for (const s of group.sections || []) {
    if (s.unit_advisement != null) { total += s.unit_advisement; continue; }
    const perReceiver = (s.receivers || []).map((r) => {
      const opt = (r.options || [])[0];
      if (!opt) return 0;
      return (opt.course_ids || []).reduce((sum, id) => sum + (unitsByCourseId.get(id) || 0), 0);
    });
    const sum = perReceiver.reduce((a, b) => a + b, 0);
    if (s.section_advisement != null && perReceiver.length) {
      total += s.section_advisement * (sum / perReceiver.length);
    } else {
      total += sum;
    }
  }
  return total;
}

function computeDeviations(doc, template) {
  const docIds = new Set((doc.requirement_groups || []).map((g) => g.group_id));
  return {
    missing_groups: (template && template.groups ? template.groups : [])
      .map((g) => g.group_id)
      .filter((id) => !docIds.has(id)),
    extra_groups: (doc.requirement_groups || [])
      .filter((g) => g.template_group == null)
      .map((g) => g.group_id),
  };
}

function summarizeDoc(doc, template, collegeName, unitsByCourseId) {
  const groups = doc.requirement_groups || [];
  const sourceCounts = { extracted: 0, template_default: 0, curated: 0 };
  const confidences = [];
  let unresolved = 0;
  for (const g of groups) {
    if (sourceCounts[g.source] != null) sourceCounts[g.source] += 1;
    if (g.source === 'extracted' && Number.isFinite(g.confidence)) confidences.push(g.confidence);
    unresolved += (g.unresolved_courses_seen || []).length;
  }
  const unitsAccounted = Math.round(
    groups.reduce((sum, g) => sum + groupUnits(g, unitsByCourseId), 0) * 10) / 10;
  const deviations = computeDeviations(doc, template);
  const flags = [];
  if (doc.status === 'ambiguous') flags.push('ambiguous');
  if (sourceCounts.template_default > 0) flags.push('template_default_groups');
  if (confidences.some((c) => c < LOW_CONFIDENCE)) flags.push('low_confidence');
  if (unresolved > 0) flags.push('unresolved_courses');
  const hasFill = groups.some((g) => g.units_fill);
  if (doc.status === 'found' && !hasFill && Number.isFinite(doc.total_units)
      && Math.abs(unitsAccounted - doc.total_units) > 1) {
    flags.push('units_mismatch');
  }
  return {
    _id: doc._id,
    community_college_id: doc.community_college_id,
    college_id: doc.college_id,
    college_name: collegeName || null,
    status: doc.status,
    degree_title_seen: doc.degree_title_seen || null,
    catalog_url: doc.catalog_url || null,
    catalog_year: doc.catalog_year || null,
    unit_system: doc.unit_system || null,
    total_units: doc.total_units ?? null,
    group_count: groups.length,
    source_counts: sourceCounts,
    confidence_min: confidences.length ? Math.min(...confidences) : null,
    confidence_mean: confidences.length
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
      : null,
    unresolved_count: unresolved,
    units_accounted: unitsAccounted,
    deviations,
    flags,
    verified: !!(doc.verification && doc.verification.verified),
    updated_at: doc.updated_at ?? null,
  };
}

async function asDegreeOverview(db) {
  const [template, docs, institutions] = await Promise.all([
    db.collection('curated_requirements').findOne({ kind: 'as_degree_template' }),
    db.collection('curated_requirements').find({ kind: 'as_degree' }).toArray(),
    db.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { name: 1 } }).toArray(),
  ]);
  const nameById = new Map(institutions.map((i) => [i._id, i.name]));
  const courses = await loadCourses(db, docs);
  const unitsByCourseId = new Map(courses.map((c) => [c.course_id, c.units || 0]));
  const rows = docs
    .map((d) => summarizeDoc(d, template, nameById.get(d.college_id), unitsByCourseId))
    .sort((a, b) => String(a.college_name).localeCompare(String(b.college_name)));
  return { template, rows };
}

async function asDegreeDetail(db, collegeId) {
  const doc = await db.collection('curated_requirements')
    .findOne({ kind: 'as_degree', college_id: String(collegeId) });
  if (!doc) return null;
  const [template, inst, courses] = await Promise.all([
    db.collection('curated_requirements')
      .findOne({ _id: doc.template_ref || TEMPLATE_FALLBACK_ID }),
    db.collection('assist_institutions')
      .findOne({ _id: doc.college_id }, { projection: { name: 1 } }),
    loadCourses(db, [doc]),
  ]);
  const coursesById = Object.fromEntries(courses.map((c) => [`cc:${c.course_id}`, {
    code: `${c.prefix} ${c.number}`,
    title: c.title ?? null,
    units: c.units ?? null,
    concept: c.concept ?? null,
  }]));
  return {
    doc,
    college_name: inst ? inst.name : null,
    courses_by_id: coursesById,
    deviations: computeDeviations(doc, template),
  };
}

module.exports = { asDegreeOverview, asDegreeDetail };
```

- [ ] **Step 4: Run service tests to verify they pass**

Run: `cd server && npm test -- services/asDegreeView.test.js`
Expected: PASS.

- [ ] **Step 5: Wire the endpoint**

In `server/controllers/CanonicalData.js`, near the top with the other requires: `const asDegreeView = require('../services/asDegreeView');` and before the exports at the bottom:

```js
exports.asDegrees = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const collegeId = String(req.query.college_id || '').trim();
  if (collegeId) {
    const detail = await asDegreeView.asDegreeDetail(db, collegeId);
    if (!detail) return res.status(404).json({ error: 'no as_degree row for that college' });
    return res.json(detail);
  }
  res.json(await asDegreeView.asDegreeOverview(db));
});
```

In `server/routes/api.js`, next to the other curated routes (~line 34):

```js
router.get('/curated/as-degrees', ...guarded, canonicalDataController.asDegrees);
```

Add an endpoint test to `server/controllers/CanonicalData.test.js`:

```js
describe('asDegrees endpoint', () => {
  it('returns the overview and a 404 for an unknown college detail', async () => {
    const overview = await run(asDegrees, request({ query: {} }));
    expect(overview.statusCode).toBe(200);
    expect(overview.body).toHaveProperty('rows');
    const missing = await run(asDegrees, request({ query: { college_id: 'cc:424242' } }));
    expect(missing.statusCode).toBe(404);
  });
});
```

(`asDegrees` joins the destructured `cjs('./CanonicalData')` import at the top of the test file.)

- [ ] **Step 6: Run the full server suite**

Run: `cd server && npm test`
Expected: PASS across the board.

- [ ] **Step 7: Commit**

```bash
git add server/services/asDegreeView.js server/services/asDegreeView.test.js server/controllers/CanonicalData.js server/controllers/CanonicalData.test.js server/routes/api.js
git commit -m "feat: as-degree computed view service + /curated/as-degrees endpoint"
```

---

### Task 5: Frontend — Data → AS Degrees sub-tab with the QA table

> **⚠️ REDIRECTED (user directive 2026-07-17): do NOT hand-build this task.**
> The entire AS Degrees frontend — both the bulk QA table AND the per-college
> view — goes through **Claude design** first, not the JSX below. The
> comprehensive design prompt is `docs/as-degree-view-design-prompt.md` (now
> covers both surfaces, grounded in Task 4's real endpoint contract).
> Frontend implementation is deferred to a post-design phase that will be
> planned from the returned design. This supersedes spec §5's "no design
> pass" note for the QA table. The hooks/components below are retained only
> as a reference for what data the designed components will consume — the
> three `useData.js` hooks (`useAsDegrees`, `useAsDegreeDetail`,
> `useSaveAsDegree`) and the tab registration in `DataPage.jsx` are still the
> plumbing the eventual implementation uses, but write them against the
> RETURNED design, not this scaffold.

**Files (reference only — build from the returned design instead):**
- Create: `frontend/src/asdegrees/AsDegreesTab.jsx`, `frontend/src/asdegrees/AsDegreeQaTable.jsx`, `frontend/src/asdegrees/AsDegreeDetailModal.jsx`
- Test: `frontend/src/asdegrees/AsDegreeQaTable.test.jsx`
- Modify: `frontend/src/shared/query/hooks/useData.js` (three new hooks), `frontend/src/DataPage.jsx` (three registration spots + import)

**Interfaces:**
- Consumes: Task 4's endpoint shapes (overview rows incl. `flags`, `source_counts`; detail `{doc, college_name, courses_by_id, deviations}`); existing `DataTable` (from `../DataReferences`), UI kit (`Alert, Badge, Button, Input, Modal, Select, Spinner, Stack` from `../components/ui`), `apiClient`.
- Produces: hooks `useAsDegrees()`, `useAsDegreeDetail(collegeId)`, `useSaveAsDegree()`; the `asdegrees` Data sub-tab. Phase 3 will replace/extend the detail modal with the designed per-college view — keep the modal deliberately plain.

Editing scope in this task (deliberate, per spec §4/§5): the bulk surface supports **triage-grade** edits only — per-group "Mark reviewed" (flips `source` to `'curated'`, clears `confidence`), doc `status`, and `total_units`. Course-level corrections and verification notes belong to the Phase 3 designed view where side-by-side catalog verification happens. The modal must NOT render an input for `verification.notes`.

- [ ] **Step 1: Add the hooks**

In `frontend/src/shared/query/hooks/useData.js`, next to `usePrereqGraph` (~line 340):

```js
export function useAsDegrees() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['as-degrees', user?.uid],
    queryFn: () => apiClient.get('/curated/as-degrees').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useAsDegreeDetail(collegeId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['as-degree-detail', user?.uid, collegeId],
    queryFn: () => apiClient
      .get('/curated/as-degrees', { params: { college_id: collegeId } })
      .then((r) => r.data),
    enabled: !!user?.uid && !!collegeId,
    staleTime: 60 * 1000,
  })
}

export function useSaveAsDegree() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (doc) => apiClient.put('/curated/requirements/as_degree', doc).then((r) => r.data),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['as-degrees'] }),
      qc.invalidateQueries({ queryKey: ['as-degree-detail'] }),
    ]),
  })
}
```

- [ ] **Step 2: Write the failing component test**

Create `frontend/src/asdegrees/AsDegreeQaTable.test.jsx`:

```jsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AsDegreeQaTable from './AsDegreeQaTable'

vi.mock('../shared/query/hooks/useData', () => ({
  useAsDegrees: () => ({
    data: {
      template: { _id: 'as_degree_template:cs' },
      rows: [
        { _id: 'as_degree:110:cs', college_id: 'cc:110', college_name: 'Allan Hancock College',
          status: 'found', degree_title_seen: 'Computer Science, A.S.', unit_system: 'semester',
          total_units: 60, units_accounted: 58, group_count: 7,
          source_counts: { extracted: 6, template_default: 1, curated: 0 },
          confidence_min: 0.62, confidence_mean: 0.88, unresolved_count: 1,
          deviations: { missing_groups: [], extra_groups: ['ethics'] },
          flags: ['template_default_groups', 'low_confidence', 'unresolved_courses'],
          verified: false, catalog_url: 'https://catalog.example/cs' },
        { _id: 'as_degree:2:cs', college_id: 'cc:2', college_name: 'Evergreen Valley College',
          status: 'none_found', degree_title_seen: null, total_units: null, units_accounted: 0,
          group_count: 0, source_counts: { extracted: 0, template_default: 0, curated: 0 },
          confidence_min: null, confidence_mean: null, unresolved_count: 0,
          deviations: { missing_groups: [], extra_groups: [] }, flags: [], verified: false,
          catalog_url: 'https://catalog.example/programs' },
      ],
    },
    isLoading: false, isError: false,
  }),
  useAsDegreeDetail: () => ({ data: null, isLoading: false, isError: false }),
  useSaveAsDegree: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('AsDegreeQaTable', () => {
  it('lists colleges with status and confidence', () => {
    render(<AsDegreeQaTable />)
    expect(screen.getByText('Allan Hancock College')).toBeInTheDocument()
    expect(screen.getByText('Computer Science, A.S.')).toBeInTheDocument()
    expect(screen.getByText('none_found')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('hides clean rows under the Flagged-only filter', () => {
    render(<AsDegreeQaTable />)
    fireEvent.click(screen.getByText('All colleges'))
    fireEvent.click(screen.getByText('Flagged only'))
    expect(screen.getByText('Allan Hancock College')).toBeInTheDocument()
    expect(screen.queryByText('Evergreen Valley College')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npm test -- src/asdegrees/AsDegreeQaTable.test.jsx`
Expected: FAIL — module `./AsDegreeQaTable` not found.

- [ ] **Step 4: Implement the table, modal, and tab**

Create `frontend/src/asdegrees/AsDegreeQaTable.jsx` (modeled on `ConceptMappingTable.jsx` — same hooks/UI-kit idioms):

```jsx
import React, { useMemo, useState } from 'react'
import { Alert, Badge, Select, Input, Spinner, Stack } from '../components/ui'
import { useAsDegrees } from '../shared/query/hooks/useData'
import { DataTable } from '../DataReferences'
import AsDegreeDetailModal from './AsDegreeDetailModal'

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

const FILTER_OPTIONS = [
  { value: 'all', label: 'All colleges' },
  { value: 'flagged', label: 'Flagged only' },
  { value: 'template_default', label: 'Has template-default groups' },
  { value: 'not_found', label: 'none_found / ambiguous' },
  { value: 'unverified', label: 'Unverified only' },
]

const matchesFilter = (row, filter) => {
  if (filter === 'flagged') return row.flags.length > 0
  if (filter === 'template_default') return row.flags.includes('template_default_groups')
  if (filter === 'not_found') return row.status !== 'found'
  if (filter === 'unverified') return !row.verified
  return true
}

const STATUS_VARIANT = { found: 'success', none_found: 'neutral', ambiguous: 'warning' }

export default function AsDegreeQaTable() {
  const asDegrees = useAsDegrees()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [openCollegeId, setOpenCollegeId] = useState(null)

  const rows = useMemo(() => {
    const all = asDegrees.data?.rows || []
    const needle = query.trim().toLowerCase()
    return all.filter((r) => {
      if (!matchesFilter(r, filter)) return false
      if (!needle) return true
      return `${r.college_name} ${r.degree_title_seen || ''} ${r.flags.join(' ')}`
        .toLowerCase().includes(needle)
    })
  }, [asDegrees.data, query, filter])

  if (asDegrees.isLoading) return <Spinner />
  if (asDegrees.isError) return <Alert variant='danger'>Could not load AS degrees.</Alert>

  return (
    <Stack gap='cozy'>
      <div className='flex items-center gap-3'>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Search colleges…' />
        <Select value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
        <span className='text-caption text-ink-subtle'>{rows.length} of {asDegrees.data?.rows?.length || 0}</span>
      </div>
      <DataTable
        rows={rows}
        onEdit={(r) => setOpenCollegeId(r.college_id)}
        columns={[
          { key: 'college_name', label: 'College' },
          { key: 'status', label: 'Status',
            render: (r) => <Badge variant={STATUS_VARIANT[r.status] || 'neutral'}>{r.status}</Badge> },
          { key: 'degree_title_seen', label: 'Degree as printed' },
          { key: 'units', label: 'Units',
            render: (r) => r.status === 'found'
              ? `${r.units_accounted} / ${r.total_units} ${r.unit_system === 'quarter' ? 'qtr' : 'sem'}`
              : '—' },
          { key: 'confidence_min', label: 'Min conf.', render: (r) => pct(r.confidence_min) },
          { key: 'sources', label: 'Groups e/t/c',
            render: (r) => `${r.source_counts.extracted}/${r.source_counts.template_default}/${r.source_counts.curated}` },
          { key: 'flags', label: 'Flags',
            render: (r) => r.flags.length
              ? r.flags.map((f) => <Badge key={f} variant='warning'>{f}</Badge>)
              : <span className='text-ink-subtle'>clean</span> },
          { key: 'catalog', label: 'Catalog',
            render: (r) => r.catalog_url
              ? <a className='underline' href={r.catalog_url} target='_blank' rel='noreferrer'>source</a>
              : '—' },
        ]}
      />
      <AsDegreeDetailModal collegeId={openCollegeId} onClose={() => setOpenCollegeId(null)} />
    </Stack>
  )
}
```

Create `frontend/src/asdegrees/AsDegreeDetailModal.jsx` (plain, triage-grade — Phase 3 replaces this with the designed view):

```jsx
import React, { useEffect, useState } from 'react'
import { Alert, Badge, Button, Input, Modal, Select, Spinner, Stack } from '../components/ui'
import { useAsDegreeDetail, useSaveAsDegree } from '../shared/query/hooks/useData'

const SOURCE_VARIANT = { extracted: 'neutral', template_default: 'warning', curated: 'success' }

const describeSection = (s) => {
  if (s.unit_advisement != null) return `${s.unit_advisement} units from:`
  if (s.section_advisement != null) return `choose ${s.section_advisement} of:`
  return 'all of:'
}

export default function AsDegreeDetailModal({ collegeId, onClose }) {
  const detail = useAsDegreeDetail(collegeId)
  const save = useSaveAsDegree()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Deep-copy the stored doc so edits never leak into the query cache.
    setDraft(detail.data?.doc ? JSON.parse(JSON.stringify(detail.data.doc)) : null)
    setError(null)
  }, [detail.data])

  if (!collegeId) return null
  const courses = detail.data?.courses_by_id || {}

  const markCurated = (i) => setDraft((d) => {
    const next = JSON.parse(JSON.stringify(d))
    next.requirement_groups[i].source = 'curated'
    next.requirement_groups[i].confidence = null
    return next
  })

  const commit = async () => {
    setError(null)
    try {
      await save.mutateAsync(draft)
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save.')
    }
  }

  return (
    <Modal open={!!collegeId} onClose={onClose} title={detail.data?.college_name || 'AS degree'}>
      {detail.isLoading && <Spinner />}
      {detail.isError && <Alert variant='danger'>Could not load this college.</Alert>}
      {draft && (
        <Stack gap='cozy'>
          <div className='flex items-center gap-3'>
            <Select value={draft.status} onChange={(status) => setDraft({ ...draft, status })}
              options={['found', 'none_found', 'ambiguous'].map((value) => ({ value, label: value }))} />
            {draft.status === 'found' && (
              <Input type='number' value={draft.total_units ?? ''} aria-label='Total units'
                onChange={(e) => setDraft({ ...draft, total_units: Number(e.target.value) })} />
            )}
            {draft.catalog_url && (
              <a className='underline' href={draft.catalog_url} target='_blank' rel='noreferrer'>
                open catalog ({draft.catalog_year})
              </a>
            )}
          </div>
          {(draft.requirement_groups || []).map((g, i) => (
            <div key={g.group_id} className='surface-card p-4'>
              <div className='flex items-center gap-2'>
                <strong>{g.label_seen || g.group_id}</strong>
                <Badge variant={SOURCE_VARIANT[g.source]}>{g.source}</Badge>
                {g.confidence != null && <span className='text-caption'>{Math.round(g.confidence * 100)}%</span>}
                {g.template_group == null && <Badge variant='warning'>school-specific</Badge>}
                {g.source !== 'curated' && (
                  <Button variant='ghost' onClick={() => markCurated(i)}>Mark reviewed</Button>
                )}
              </div>
              {g.source === 'template_default' && (
                <p className='text-caption text-ink-subtle'>Placeholder — template group stands in; not catalog data.</p>
              )}
              {(g.sections || []).map((s, j) => (
                <div key={j} className='pl-3'>
                  <em className='text-caption'>{describeSection(s)}</em>
                  <ul>
                    {(s.receivers || []).map((r, k) => (
                      <li key={k} className='text-caption'>
                        {(r.options || []).map((o) =>
                          o.course_keys.map((key) => {
                            const c = courses[key]
                            return c ? `${c.code} — ${c.title} (${c.units ?? '?'}u)` : key
                          }).join(' + ')
                        ).join('  ·  or  ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {(g.unresolved_courses_seen || []).length > 0 && (
                <p className='text-caption text-danger'>
                  Unmatched catalog citations: {g.unresolved_courses_seen.map((u) => u.course_code_seen).join(', ')}
                </p>
              )}
            </div>
          ))}
          {error && <Alert variant='danger'>{error}</Alert>}
          <div className='flex justify-end gap-2'>
            <Button variant='ghost' onClick={onClose}>Cancel</Button>
            <Button onClick={commit} disabled={save.isPending}>Save</Button>
          </div>
        </Stack>
      )}
    </Modal>
  )
}
```

Create `frontend/src/asdegrees/AsDegreesTab.jsx`:

```jsx
import React from 'react'
import { Stack } from '../components/ui'
import AsDegreeQaTable from './AsDegreeQaTable'

// Data → AS Degrees: bulk QA over the per-college local CS AS degree docs.
// The per-college deep view arrives in Phase 3 via the design handoff
// (docs/as-degree-view-design-prompt.md) and will mount alongside this table.
export default function AsDegreesTab() {
  return (
    <Stack gap='cozy'>
      <AsDegreeQaTable />
    </Stack>
  )
}
```

Register in `frontend/src/DataPage.jsx` — three spots plus the import:
1. Import beside the other tab imports (~line 12): `import AsDegreesTab from './asdegrees/AsDegreesTab'`
2. `DATA_TAB_ROUTES` (~line 52): `asdegrees: { path: '/api/curated/as-degrees' },`
3. SubNav options (~line 96, after `prerequisites`): `{ value: 'asdegrees', label: 'AS Degrees' },`
4. Conditional mount (~line 109): `{tab === 'asdegrees' && <AsDegreesTab />}`

- [ ] **Step 5: Run the tests**

Run: `cd frontend && npm test -- src/asdegrees/AsDegreeQaTable.test.jsx`
Expected: PASS. If a UI-kit prop contract differs (e.g. `Select` uses `onChange={(e) => ...}` vs value-callback), check how `ConceptMappingTable.jsx` calls it and match that exactly — the kit's contracts are the source of truth.

Then the full frontend suite: `cd frontend && npm test`
Expected: PASS.

- [ ] **Step 6: Visual smoke check**

Run the dev stack per the repo's normal workflow (`npm run dev` from the repo root — online dev, all-Atlas) and confirm: Data → AS Degrees renders the empty state (no rows yet) without console errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/asdegrees frontend/src/shared/query/hooks/useData.js frontend/src/DataPage.jsx
git commit -m "feat: Data → AS Degrees sub-tab with bulk QA table and triage modal"
```

---

### Task 6: Pilot extraction — 14 colleges (process task, in-session agents)

**Files:**
- Create: `scripts/data/as_degrees_cs_pilot.json`

**Interfaces:**
- Produces: the pilot artifact in the **extraction artifact schema** below — the same schema Task 8's importer consumes and Task 9's sweep reuses. Task 7 fits the template from it.

No production code. This is in-session agent work (no LLM SDK/API keys in the repo). Browser/web access is required to read live catalogs.

**Pilot college set (stratified, spec §2):** De Anza (quarter system, large, Foothill–De Anza CCD), Santa Monica (large feeder, LA), American River + Sacramento City (both Los Rios — tests district catalog sharing), LA Pierce (LACCD), San Diego Mesa (San Diego CCD), Diablo Valley (Contra Costa CCD, Bay), Fresno City (State Center CCD), Bakersfield (Kern CCD), College of the Redwoods (small rural north), Southwestern (border, South), Butte (rural north), Cabrillo (Central Coast mid-size), Merced (small Central Valley). If a school turns out to offer no local CS AS, keep it in the pilot as a real `none_found` — that outcome is data, not a substitution trigger.

**Extraction artifact schema** (top of file; Task 8 validates this exactly):

```json
{
 "meta": {
  "purpose": "Per-college local CS AS degree extraction (spec docs/superpowers/specs/2026-07-17-as-degree-data-design.md §1B). Applied by scripts/import_as_degrees.py.",
  "authored": "<date>",
  "session": "in-session multi-agent extraction (Claude Code)",
  "vote_protocol": "<see Step 2>",
  "template": "scripts/data/as_degree_template.json",
  "agreement": { "unanimous": 0, "majority": 0, "disputed": 0 }
 },
 "colleges": [
  {
   "community_college_id": 110,
   "college_name": "Allan Hancock College",
   "status": "found",
   "degree_title_seen": "Computer Science, Associate in Science",
   "catalog_url": "https://…",
   "catalog_year": "2025-2026",
   "unit_system": "semester",
   "total_units": 60,
   "groups": [
    {
     "group_id": "core_programming",
     "template_group": "core_programming",
     "label_seen": "Required Core",
     "source": "extracted",
     "confidence": 1.0,
     "ge_area": null,
     "units_fill": false,
     "section_advisement": null,
     "unit_advisement": null,
     "requirements": [
      { "options": [ { "courses": [ { "prefix": "CS", "number": "111", "title_seen": "Programming Fundamentals", "units_seen": 4 } ] } ] }
     ]
    }
   ]
  }
 ]
}
```

Notes on the schema: one implicit section per group (`section_advisement`/`unit_advisement` sit at group level in the artifact; the importer wraps them into a single `sections[0]`); each `requirements` entry becomes one receiver; multiple `options` on an entry mean interchangeable ways to fill that slot; multiple `courses` in one option mean take-together. Courses are cited by catalog code, NOT resolved to ids — resolution is the importer's job (Task 8). A `template_default` group is `{"group_id", "template_group", "source": "template_default"}` only. `none_found`/`ambiguous` colleges carry `status`, `catalog_url`, `catalog_year`, and (for ambiguous) a `candidates_seen` string array of the degree titles found; no `groups`.

- [ ] **Step 1: Get the college ids**

The 14 names above need `community_college_id` values (= `assist_institutions.source_id`). Query the local dev DB:

```bash
mongosh mongodb://127.0.0.1:27017/pmt_research --quiet --eval '
db.assist_institutions.find(
  { kind: "community_college", name: { $in: [
    "De Anza College", "Santa Monica College", "American River College",
    "Sacramento City College", "Los Angeles Pierce College", "San Diego Mesa College",
    "Diablo Valley College", "Fresno City College", "Bakersfield College",
    "College of the Redwoods", "Southwestern College", "Butte College",
    "Cabrillo College", "Merced College" ] } },
  { name: 1, source_id: 1 }).toArray()'
```

If any name misses (ASSIST naming differs), find it with a regex (`name: /pierce/i`) before proceeding. All 14 must resolve.

- [ ] **Step 2: Run the pilot extraction**

Dispatch one extraction agent per college (parallel batches are fine), each instructed to:
1. Find the college's current (2025–26 or newest published) catalog page for its **local AS in Computer Science** — not an AS-T/ADT, not a certificate. Record the exact URL and catalog year.
2. Transcribe the degree's requirement groups faithfully: the catalog's own headings (`label_seen`), which courses are required vs choose-N vs N-units-from, course codes/titles/units exactly as printed, the degree's stated total units, and whether the school is quarter or semester.
3. Classify each group against the template's `group_id` vocabulary when it clearly corresponds (`template_group`), else mark it school-specific (`template_group: null`, invented `group_id` slug). **Note: in the pilot, the template doesn't exist yet — pilot agents instead tag groups with a free-text `role_guess` (e.g. "programming core", "GE humanities") that Task 7 uses to fit the template; Task 7 then rewrites these into `template_group` refs.**
4. Return the college's JSON object in the artifact schema.

Then a **second independent agent per college** repeats the extraction blind. A reconciler agent compares the two: agreement → `confidence: 1.0`; reconcilable differences (formatting, one missed course) → reconciled group with `confidence: 0.67`; unreconcilable → group-level dispute recorded and `confidence: 0.5` with the more-conservative reading. Record counts in `meta.agreement` and the protocol sentence in `meta.vote_protocol`.

- [ ] **Step 3: Assemble and commit the artifact**

Assemble `scripts/data/as_degrees_cs_pilot.json` (14 college objects + meta). Sanity checks before committing: every college has a real catalog_url; every `found` college's groups have ≥1 course or a units figure; quarter schools (De Anza) carry `unit_system: "quarter"` and quarter totals (~90).

```bash
python3 -c "import json; d=json.load(open('scripts/data/as_degrees_cs_pilot.json')); print(len(d['colleges']), 'colleges,', sum(1 for c in d['colleges'] if c['status']=='found'), 'found')"
git add scripts/data/as_degrees_cs_pilot.json
git commit -m "feat: pilot extraction — 14-college CS AS degree artifact"
```

---

### Task 7: Template fitting + coverage report → **G2 GATE (STOP)**

**Files:**
- Create: `scripts/data/as_degree_template.json`, `docs/as-degree-template-review.md`
- Modify: `scripts/data/as_degrees_cs_pilot.json` (rewrite `role_guess` → `template_group`)

**Interfaces:**
- Consumes: Task 6's pilot artifact.
- Produces: the locked template artifact (Task 8 imports it; Task 9 extracts against it) and the review doc for the gate. Template JSON payload key is `template` (single object in the §1A shape: `slug: "cs"`, `name`, `total_units_min`, `groups` with `slots`), plus a `_meta` block (`purpose`, `status: "draft"` until approved, `authored`, `method`, `pilot_coverage` summary).

- [ ] **Step 1: Fit the template from the pilot**

From the 14 extractions, derive the statewide template: groups that appear (under whatever local heading) at ≥ ~10 of the found schools become template groups; concept slots come from mapping the recurring courses through their existing `concept` tags (query the local dev DB `assist_courses` by prefix/number per college to see what concepts the recurring core courses carry); GE groups come from the Title 5 areas with the median unit ask. Every normative judgment (e.g. "systems requirement is choose-1 statewide even though 3 pilot schools require two") is recorded in the template's group-level or doc-level `note`, prereq_concepts style.

- [ ] **Step 2: Rewrite the pilot artifact against the template**

Replace each pilot group's `role_guess` with `template_group: '<group_id>'` (or `null` for genuine extras), so the pilot artifact is importable by Task 8 exactly like the sweep artifact.

- [ ] **Step 3: Write the coverage report**

`docs/as-degree-template-review.md` must contain, per pilot school: groups explained by the template / total groups, units explained / total units, extra local groups, missing template groups; plus the aggregate coverage table, the proposed **degree-matching rules** (which catalog program counts as "the CS AS"; what was treated as ambiguous, spec §1C), every normative call made in Step 1, and an explicit list of **open questions for Tybalt**. Do not write any verification notes — this is a methodology review doc, not a verification record.

- [ ] **Step 4: Commit**

```bash
git add scripts/data/as_degree_template.json scripts/data/as_degrees_cs_pilot.json docs/as-degree-template-review.md
git commit -m "feat: statewide CS AS template fitted from pilot + coverage report (pending G2)"
```

- [ ] **Step 5: STOP — G2 gate**

**Do not proceed to Task 8.** Present `docs/as-degree-template-review.md` to Tybalt and wait for his review. If coverage is poor (template explains < ~75% of pilot groups/units at most schools), the cheap exit is here: revisit the approach with him before any statewide work. On approval: set the template `_meta.status` to `"locked"`, record his decisions in `_meta.review`, commit, and continue.

---

### Task 8: Importer — `scripts/import_as_degrees.py`

**Files:**
- Create: `scripts/import_as_degrees.py`, `scripts/data/as_degrees_cs.sample.json`
- Modify: none

**Interfaces:**
- Consumes: the template artifact (Task 7) and extraction artifacts (Tasks 6/9) in the schemas above; env `TARGET_MONGO_URI` / `TARGET_DB_NAME` from `scripts/.env` (import_course_concepts.py conventions: module docstring, `_env` helper, deferred pymongo import, `--dry-run`).
- Produces: `curated_requirements` docs of kinds `as_degree_template` and `as_degree` satisfying Tasks 1–2 validators exactly. Merge semantics per spec §3.2.

- [ ] **Step 1: Write the sample fixture**

`scripts/data/as_degrees_cs.sample.json`: a 3-college artifact exercising every path — one clean `found` school, one school with a `template_default` stub group + one unresolvable course, one `none_found`. Invented plausible course codes are fine — the sample exists for `--dry-run` parsing/reporting, and dry-run does not resolve against the DB.

- [ ] **Step 2: Write the importer**

`scripts/import_as_degrees.py`, following `import_course_concepts.py` structure exactly (docstring; `load_dotenv(HERE / ".env")`; `_env` helper; validate fully before connecting; deferred `from pymongo import MongoClient, ReplaceOne`; stdout `print` reporting). Core content:

```python
"""
Import the statewide CS AS-degree template and the per-college AS degree docs.

Two inputs, applied in order (template first so as_degree.template_ref resolves):

  scripts/data/as_degree_template.json  -> curated_requirements (kind as_degree_template)
  scripts/data/as_degrees_cs.json       -> curated_requirements (kind as_degree)

Rules (spec docs/superpowers/specs/2026-07-17-as-degree-data-design.md §3.2):
  - a doc with verification.verified true is skipped entirely (verified means verified);
  - within an unverified doc, groups with source 'curated' are preserved verbatim
    (matched by group_id); other groups are replaced by the artifact's;
  - the verification object is never written by the importer;
  - catalog course citations are resolved against assist_courses per college
    (prefix + number, leading-zero tolerant); failures land in
    unresolved_courses_seen and are reported.

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required, unless --dry-run)
  TARGET_DB_NAME   (default pmt_research)
"""
```

Core functions, complete (argparse/env/reporting boilerplate follows
`import_course_concepts.py` verbatim; defaults `DEFAULT_TEMPLATE = HERE / "data" / "as_degree_template.json"`, `DEFAULT_DEGREES = HERE / "data" / "as_degrees_cs.json"`, flags `--template-json`, `--degrees-json`, `--dry-run`):

```python
GE_AREAS = {"natural_sciences", "social_behavioral", "humanities", "language_rationality", "math_competency"}
SLUG_RE = re.compile(r"^[a-z0-9_]+$")
STATUSES = {"found", "none_found", "ambiguous"}

def norm_number(s):
    stripped = str(s).strip().upper().lstrip("0")
    return stripped or "0"

def validate_artifact(data):
    if "meta" not in data or "colleges" not in data:
        sys.exit("artifact must have meta and colleges keys")
    seen_cc = set()
    for c in data["colleges"]:
        cc = c.get("community_college_id")
        label = f"college {cc} ({c.get('college_name')})"
        if not isinstance(cc, int):
            sys.exit(f"{label}: community_college_id must be an int")
        if cc in seen_cc:
            sys.exit(f"{label}: duplicate community_college_id")
        seen_cc.add(cc)
        if c.get("status") not in STATUSES:
            sys.exit(f"{label}: status must be one of {sorted(STATUSES)}")
        if not c.get("catalog_url") or not c.get("catalog_year"):
            sys.exit(f"{label}: catalog_url and catalog_year are required")
        if c["status"] == "ambiguous" and not c.get("candidates_seen"):
            sys.exit(f"{label}: ambiguous needs candidates_seen")
        if c["status"] != "found":
            if c.get("groups"):
                sys.exit(f"{label}: a {c['status']} college must not carry groups")
            continue
        if c.get("unit_system") not in ("semester", "quarter"):
            sys.exit(f"{label}: unit_system must be semester or quarter")
        if not isinstance(c.get("total_units"), (int, float)) or c["total_units"] <= 0:
            sys.exit(f"{label}: total_units must be a positive number")
        seen_groups = set()
        for g in c.get("groups") or []:
            gid = g.get("group_id", "")
            if not SLUG_RE.match(str(gid)):
                sys.exit(f"{label}: bad group_id {gid!r}")
            if gid in seen_groups:
                sys.exit(f"{label}: duplicate group_id {gid}")
            seen_groups.add(gid)
            if g.get("ge_area") is not None and g["ge_area"] not in GE_AREAS:
                sys.exit(f"{label} group {gid}: unknown ge_area {g['ge_area']!r}")
            if g.get("source") == "template_default":
                if g.get("requirements"):
                    sys.exit(f"{label} group {gid}: template_default stub must not carry requirements")
                if not g.get("template_group"):
                    sys.exit(f"{label} group {gid}: template_default stub needs template_group")
        if not (c.get("groups") or []):
            sys.exit(f"{label}: a found college needs groups")

def build_course_index(db, cc_ids):
    index = {}
    cursor = db["assist_courses"].find(
        {"side": "sending", "community_college_id": {"$in": list(cc_ids)}},
        {"community_college_id": 1, "course_id": 1, "prefix": 1, "number": 1, "units": 1},
    )
    for doc in cursor:
        key = (doc["community_college_id"], str(doc.get("prefix", "")).upper(), norm_number(doc.get("number", "")))
        index.setdefault(key, (doc["course_id"], doc.get("units")))
    return index

def resolve_group(college, group, course_index):
    base = {
        "group_id": group["group_id"],
        "template_group": group.get("template_group"),
        "label_seen": group.get("label_seen"),
        "source": group.get("source", "extracted"),
        "confidence": group.get("confidence") if group.get("source", "extracted") == "extracted" else None,
        "curated_by": None,
        "ge_area": group.get("ge_area"),
        "units_fill": bool(group.get("units_fill")),
        "unresolved_courses_seen": [],
    }
    if base["source"] == "template_default":
        return {k: base[k] for k in ("group_id", "template_group", "label_seen", "source", "confidence", "curated_by")}, 0
    if base["units_fill"]:
        return base, 0
    receivers, unresolved = [], []
    for entry in group.get("requirements") or []:
        options = []
        for opt in entry.get("options") or []:
            ids, keys = [], []
            for course in opt.get("courses") or []:
                key = (college["community_college_id"], str(course.get("prefix", "")).upper(), norm_number(course.get("number", "")))
                hit = course_index.get(key)
                if hit is None:
                    unresolved.append({
                        "course_code_seen": f"{course.get('prefix', '?')} {course.get('number', '?')}",
                        "title_seen": course.get("title_seen"),
                        "units_seen": course.get("units_seen"),
                    })
                else:
                    ids.append(hit[0])
                    keys.append(f"cc:{hit[0]}")
            if ids:
                options.append({"course_ids": ids, "course_conjunction": "and", "course_keys": keys})
        if options:
            receivers.append({
                "receiving": None, "articulation_status": "articulated",
                "not_articulated_reason": None, "options": options,
                "options_conjunction": "or" if len(options) > 1 else "and", "hash_id": None,
            })
    base["unresolved_courses_seen"] = unresolved
    if not receivers and base["ge_area"] is None:
        if base["template_group"]:
            stub = {k: base[k] for k in ("group_id", "template_group", "label_seen", "curated_by")}
            stub.update({"source": "template_default", "confidence": None})
            print(f"  {college['college_name']} group {base['group_id']}: no course resolved; demoted to template_default")
            return stub, len(unresolved)
        print(f"  {college['college_name']} group {base['group_id']}: no course resolved and no template_group; SKIPPED")
        return None, len(unresolved)
    base["is_required"] = True
    base["group_conjunction"] = "And"
    base["group_advisement"] = None
    base["group_unit_advisement"] = None
    base["group_min_distinct_sections"] = None
    base["group_max_distinct_sections"] = None
    base["group_section_min_courses"] = None
    base["sections"] = [{
        "section_advisement": group.get("section_advisement"),
        "unit_advisement": group.get("unit_advisement"),
        "receivers": receivers,
    }]
    return base, len(unresolved)

def build_degree_doc(college, template_id, now, source):
    cc = college["community_college_id"]
    doc = {
        "_id": f"as_degree:{cc}:cs",
        "legacy_id": f"{cc}:cs",
        "kind": "as_degree",
        "community_college_id": cc,
        "college_id": f"cc:{cc}",
        "major_slug": "cs",
        "template_ref": template_id,
        "status": college["status"],
        "catalog_url": college["catalog_url"],
        "catalog_year": college["catalog_year"],
        "source": source,
        "updated_at": now,
    }
    if college["status"] == "ambiguous":
        doc["candidates_seen"] = college.get("candidates_seen")
    if college["status"] == "found":
        doc.update({
            "degree_title_seen": college["degree_title_seen"],
            "unit_system": college["unit_system"],
            "total_units": college["total_units"],
        })
    return doc  # requirement_groups and verification are attached by the caller

DEFAULT_VERIFICATION = {"verified": False, "verified_by": None, "verified_at": None, "notes": None}

def merge_with_existing(new_doc, existing):
    """Spec §3.2. Returns the doc to write, or None to skip this college."""
    if existing is None:
        new_doc["verification"] = dict(DEFAULT_VERIFICATION)
        return new_doc
    if (existing.get("verification") or {}).get("verified"):
        return None
    preserved = [g for g in existing.get("requirement_groups") or []
                 if g.get("source") == "curated" or g.get("curated_by")]
    preserved_ids = {g["group_id"] for g in preserved}
    merged_groups = []
    for g in new_doc.get("requirement_groups") or []:
        if g["group_id"] in preserved_ids:
            continue  # the curated version wins and is kept (prepended below)
        merged_groups.append(g)
    new_doc["requirement_groups"] = preserved + merged_groups
    new_doc["verification"] = existing.get("verification") or dict(DEFAULT_VERIFICATION)
    return new_doc
```

Main flow: validate both artifacts → refuse a template whose `_meta.status != "locked"` → dry-run exits before connecting → connect → import template (`ReplaceOne` upsert on `_id: 'as_degree_template:cs'`) → `build_course_index` over the artifact's college ids → per college: resolve groups, `build_degree_doc`, attach `requirement_groups` (dropping `None` skips) and preserved-curated counts via `merge_with_existing` against the existing doc (`find_one({"_id": ...})`), `ReplaceOne` upsert unless merge returned `None` → print the counts block (imported / skipped-verified / curated-preserved / resolved / unresolved with indented per-course lines).

Reporting: per-run counts — colleges imported / skipped-verified / groups preserved-curated / courses resolved / unresolved (with a two-space-indented line per unresolved course) — matching the concept importer's stdout style. `--dry-run` validates, builds the course index only if a URI is available (skip resolution reporting otherwise with a printed note), and writes nothing.

Template import: read `as_degree_template.json`, refuse to import while `_meta.status != "locked"` (the G2 gate is enforced in code), build the canonical row (`_id: 'as_degree_template:cs'`, `legacy_id/slug: 'cs'`, `kind`, payload fields, `source: 'scripts/data/as_degree_template.json'`, `updated_at`), `ReplaceOne` upsert.

- [ ] **Step 3: Dry-run against the sample**

```bash
cd scripts && python3 import_as_degrees.py --degrees-json data/as_degrees_cs.sample.json --dry-run
```
Expected: validation passes, counts printed (3 colleges: 1 clean, 1 with stub+unresolved, 1 none_found), "Dry run only; no DB writes."

Break the sample deliberately once (e.g. set a `ge_area` to `"underwater_arts"`), confirm `sys.exit` with a pointed message, restore.

- [ ] **Step 4: Live smoke test against the local dev DB**

With `scripts/.env` pointing `TARGET_MONGO_URI` at the **local** dev mirror (`mongodb://127.0.0.1:27017`, per the local-dev-DB workflow — do NOT smoke-test against Atlas):

```bash
cd scripts && python3 import_as_degrees.py --degrees-json data/as_degrees_cs_pilot.json
```
Expected: template refused if still draft (or imported if locked at the gate), 14 colleges imported, resolution stats printed. Then verify the docs pass the server validator by loading Data → AS Degrees in the console (`npm run dev:local` variant if working offline) — every imported row renders, flags look sane.

Then prove the spec §3.2 merge semantics live (this substitutes for Python unit tests, which this repo's scripts deliberately don't have):

```bash
mongosh mongodb://127.0.0.1:27017/pmt_research --quiet --eval '
const id = "as_degree:" + db.curated_requirements.findOne({kind:"as_degree", status:"found"}).legacy_id.replace(":cs", "") + ":cs";
db.curated_requirements.updateOne({_id: id}, {$set: {"requirement_groups.0.source": "curated", "requirement_groups.0.curated_by": "tybalt-manual", "requirement_groups.0.label_seen": "CURATED SENTINEL"}});
const other = db.curated_requirements.find({kind:"as_degree", status:"found", _id: {$ne: id}}).next();
db.curated_requirements.updateOne({_id: other._id}, {$set: {"verification.verified": true, "verification.notes": "sentinel note"}});
print("curated sentinel on", id, "; verified sentinel on", other._id);'
cd scripts && python3 import_as_degrees.py --degrees-json data/as_degrees_cs_pilot.json
mongosh mongodb://127.0.0.1:27017/pmt_research --quiet --eval '
const curated = db.curated_requirements.findOne({"requirement_groups.label_seen": "CURATED SENTINEL"});
const verified = db.curated_requirements.findOne({"verification.notes": "sentinel note"});
print("curated group survived re-import:", !!curated);
print("verified doc untouched (notes intact):", !!verified && verified.verification.verified === true);'
```

Expected: both prints end `true`, and the importer's output shows one `skipped-verified` and one `curated-preserved`. Afterwards clear the sentinels by re-running the two `updateOne`s in reverse (unset `verification.verified`/`notes`, restore the group's original `label_seen`/`source`) or simply `server/scripts/dev-db.sh pull` to reset the local mirror.

- [ ] **Step 5: Commit**

```bash
git add scripts/import_as_degrees.py scripts/data/as_degrees_cs.sample.json
git commit -m "feat: as-degree importer with curated-group protection and course resolution"
```

---

### Task 9: Statewide sweep (115 colleges) + import + QA report

**Files:**
- Create: `scripts/data/as_degrees_cs.json`, `docs/as-degree-sweep-qa.md`

**Interfaces:**
- Consumes: locked template (Task 7), importer (Task 8), extraction artifact schema (Task 6).
- Produces: the full 115-college artifact imported into the research DB; the QA report for Tybalt.

- [ ] **Step 1: Sweep extraction**

Same per-college protocol as the pilot (two blind extractions + reconciler), now classifying `template_group` directly against the locked template. Run in batches of ~10 colleges. The 14 pilot colleges are **carried into the final artifact from the pilot file verbatim** (they were extracted more carefully, not less) — mark their meta contribution in `meta.vote_protocol`. Every college must end in the artifact with one of the three statuses; a college whose catalog cannot be found after a genuine attempt is `ambiguous` with a note in `candidates_seen`, never silently dropped. Log a running count per batch.

- [ ] **Step 2: Assemble, validate, commit the artifact**

```bash
python3 -c "
import json; d=json.load(open('scripts/data/as_degrees_cs.json'))
cs=d['colleges']; print(len(cs),'colleges')
from collections import Counter; print(Counter(c['status'] for c in cs))"
cd scripts && python3 import_as_degrees.py --dry-run
git add scripts/data/as_degrees_cs.json
git commit -m "feat: statewide CS AS degree extraction artifact (115 colleges)"
```

Expected: exactly 115 colleges, dry-run clean.

- [ ] **Step 3: Import to the research DB**

With `scripts/.env` pointing at the real Atlas research cluster (`TARGET_MONGO_URI`), run:

```bash
cd scripts && python3 import_as_degrees.py
```

Then pull the refreshed data into the local mirror per the workflow: `server/scripts/dev-db.sh pull`.

- [ ] **Step 4: Write the QA report**

`docs/as-degree-sweep-qa.md`, built from the importer's output plus the overview endpoint (`GET /api/curated/as-degrees` or the QA table): status counts (found / none_found / ambiguous), confidence distribution (buckets), colleges with `template_default` stubs (list), unresolved-course totals and worst offenders, deviation stats (most-common extra groups — candidate template amendments), units_mismatch list, and the per-flag college lists Tybalt will triage from. State explicitly what was NOT covered (e.g. colleges read from a prior-year catalog because the current one wasn't published).

```bash
git add docs/as-degree-sweep-qa.md
git commit -m "docs: statewide AS-degree sweep QA report"
```

- [ ] **Step 5: Full verification pass**

```bash
cd server && npm test
cd ../frontend && npm test
```
Expected: all green. Load the console (normal `npm run dev`), open Data → AS Degrees: 115 rows, filters work, a detail modal opens with real groups and course joins, `template_default` groups render as placeholders.

---

### Task 10: ⏸ PAUSE — design handoff (STOP)

No files. **Feature work stops here** (spec §5). Do not start the per-college view.

- [ ] **Step 1: Confirm the pause conditions**

Phase 2 is complete when: sweep imported, QA report written, Tybalt has accepted the QA report (his call in chat — do not proceed on silence), and the branch is green.

- [ ] **Step 2: Hand Tybalt the design-session kit**

Remind him of the flow and do the mechanical prep for him:
1. Pull 3 real docs from the artifact for the prompt's "REPLACE AT HANDOFF TIME" section — one clean high-confidence school, one deviation-heavy school, one low-confidence school with `template_default` stubs — plus their `college_name`, a hand-built `courses_by_id` (query `assist_courses` for the referenced ids), and `deviations` (from the detail endpoint). Splice them into a **copy** of `docs/as-degree-view-design-prompt.md` (do not overwrite the committed original; e.g. produce `docs/handoff/as-degree-view-design-prompt.filled.md`).
2. He runs that filled prompt in a fresh Claude design session and brings the result back as a handoff doc (`docs/handoff*` pattern, like the prereq graph's design handoff 2).
3. Phase 3 (implementing the returned design) gets its own plan once the handoff exists.

- [ ] **Step 3: Merge decision**

Ask Tybalt whether to merge `as-degree-data` into `main` now (data + QA surface are complete and tested) or hold the branch until Phase 3. Follow the finishing-a-development-branch skill. Never push without his explicit go-ahead.

---

## Self-review checklist (run after writing, before execution)

- Spec §1A/§1B shapes match Tasks 1–2 validators field-for-field (incl. `requirement_groups` naming, Number `course_ids`, `course_keys` mirrors, template_default stubs).
- Spec §3.2 merge semantics all appear in Task 8's `merge_with_existing`.
- Spec §5 pause point is Task 10 and nothing after Task 5 builds per-college view UI.
- No task modifies eligibility.js, minCourses.js, Curation.js, or pathways.js.
- Verification notes are never written by any task.
