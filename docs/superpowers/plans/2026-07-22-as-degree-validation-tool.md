# AS-Degree Validation Tool (W3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A validation workspace where the research partner selects a cohort of community colleges, edits their AS-degree docs through a structured editor or AI-assisted English instructions, and marks them verified — all through the existing validated `PUT /api/curated/requirements/as_degree` endpoint.

**Architecture:** New isolated frontend directory `frontend/src/asdegrees/validation/` + two new server services (cohort settings doc, AI assist via `@anthropic-ai/sdk`). No schema changes; provenance uses the existing per-group `source`/`confidence`/`curated_*` and doc-level `verification` fields.

**Tech Stack:** Node 20 / Express / MongoDB / vitest (server), React 19 / TanStack Query / vitest (frontend), `@anthropic-ai/sdk` (new server dependency).

**Spec:** `docs/superpowers/specs/2026-07-22-as-degree-validation-tool-design.md`

## Global Constraints

- Branch: `w3-validation-tool` (from `main` unless Tybalt says otherwise). Never push without asking. Commit per task; **never add any Claude co-author trailer**.
- **Conflict surface (parallel with F):** do NOT edit `frontend/src/DataPage.jsx` beyond the single mount line in Task 3, and do not touch `frontend/src/analyses/*`, `AdminPage.jsx`, or `useData.js` except the additive hooks in Task 3. New routes go at the END of the curated block in `server/routes/api.js` to minimize merge conflicts.
- Read the server validator FIRST (`server/controllers/CanonicalData.js`, `validateAsDegree`, ~lines 180–330) before writing any editor code — its rules are the editor's rules. Key hard rules: `_id` = `as_degree:<ccId>:<degree_type>`; group `source ∈ {extracted, template_default, curated}`; `confidence` must be null unless source is `extracted`; non-`found` docs must not carry `requirement_groups`; `catalog_url` must be http(s).
- Human/AI edits to a group MUST set `source: 'curated'` and `confidence: null`.
- Never generate verification-notes prose — notes are user-authored (repo convention).
- The AI assist endpoint uses the official `@anthropic-ai/sdk` with model `claude-opus-4-8` and `output_config.format` structured outputs. No other HTTP client, no other model unless Tybalt says so.
- Tests: `cd server && npm test -- <file>` / `cd frontend && npm test -- <file>`; full suites + `npm run build` before finishing. All existing tests must pass unmodified.
- New UI uses the existing `components/ui` vocabulary and tokens; match `AsDegreeSchoolView.jsx` idioms.
- Line numbers cited were correct on 2026-07-22; read each target section before editing.

---

### Task 1: Validation cohort service + endpoints

**Files:**
- Create: `server/services/asDegreeValidation.js`
- Create: `server/services/asDegreeValidation.test.js`
- Modify: `server/controllers/Curation.js` (two thin handlers)
- Modify: `server/routes/api.js` (two routes, end of curated block)

**Interfaces:**
- Produces: `getValidationCohort(auditDb, db) -> { college_ids: [Number], colleges: [{college_id, name, degrees: [{record_id, degree_type, status, verified, groups_total, groups_curated}]}], updated_by, updated_at }`; `setValidationCohort(auditDb, collegeIds, uid) -> { college_ids }`.
- Routes: `GET /api/curated/as-degree-validation-cohort`, `PUT /api/curated/as-degree-validation-cohort` (body `{ college_ids: [Number] }`). Frontend Task 3 consumes these shapes exactly.

- [ ] **Step 1: Write the failing test** (`server/services/asDegreeValidation.test.js`; follow the in-memory db mocking pattern used by `server/services/majorVisibility`-adjacent tests — grep an existing service test for the `collection(...).findOne` stub style):

```js
const { describe, it, expect, vi } = require('vitest');
const { getValidationCohort, setValidationCohort } = require('./asDegreeValidation');

function fakeCollections(docs) {
  // minimal stub: settings doc + curated_requirements + assist_institutions
  // (copy the stub helper style from an existing service test in this repo)
}

describe('as-degree validation cohort', () => {
  it('set stores deduped numeric ids with stamps', async () => {
    // setValidationCohort(auditDb, [110, 110, '42'], 'uid-1')
    // expect updateOne on settings _id 'as_degree_validation' with
    // college_ids [110, 42], updated_by 'uid-1', upsert true
  });
  it('get joins cohort with per-college degree progress', async () => {
    // cohort [110]; curated_requirements has as_degree:110:ast with
    // 3 groups (2 source:'curated'), verification.verified false
    // expect colleges[0].degrees[0] = { degree_type:'ast', groups_total:3,
    //   groups_curated:2, verified:false, ... }
  });
  it('get returns empty cohort when doc missing', async () => { /* [] */ });
});
```

Write these as real assertions, not comments — the comments above define the expected behavior.

- [ ] **Step 2: Run to verify failure** — `cd server && npm test -- services/asDegreeValidation.test.js` → module not found.

- [ ] **Step 3: Implement** `server/services/asDegreeValidation.js`:

```js
/**
 * Deep-validation cohort: which community colleges the team is hand-
 * validating AS degrees for, plus per-college progress derived from the
 * existing provenance fields (group source, verification.verified).
 * Stored as one settings doc on the audit handle — team state, like tasks.
 */
const DOC_ID = 'as_degree_validation';

function cleanIds(ids = []) {
  const seen = new Set();
  const out = [];
  for (const raw of ids || []) {
    const n = Number(raw);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

async function setValidationCohort(auditDb, collegeIds, uid) {
  const college_ids = cleanIds(collegeIds);
  await auditDb.collection('settings').updateOne(
    { _id: DOC_ID },
    { $set: { college_ids, updated_by: uid ?? null, updated_at: new Date() } },
    { upsert: true },
  );
  return { college_ids };
}

async function getValidationCohort(auditDb, db) {
  const doc = await auditDb.collection('settings').findOne({ _id: DOC_ID });
  const college_ids = cleanIds(doc?.college_ids);
  if (!college_ids.length) {
    return { college_ids: [], colleges: [], updated_by: doc?.updated_by ?? null, updated_at: doc?.updated_at ?? null };
  }
  const collegeKeys = college_ids.map((id) => `cc:${id}`);
  const [institutions, degrees] = await Promise.all([
    db.collection('assist_institutions')
      .find({ _id: { $in: collegeKeys } }, { projection: { name: 1 } }).toArray(),
    db.collection('curated_requirements')
      .find({ kind: 'as_degree', college_id: { $in: collegeKeys } }).toArray(),
  ]);
  const nameById = new Map(institutions.map((i) => [i._id, i.name]));
  const byCollege = new Map(college_ids.map((id) => [id, []]));
  for (const d of degrees) {
    const groups = Array.isArray(d.requirement_groups) ? d.requirement_groups : [];
    byCollege.get(d.community_college_id)?.push({
      record_id: d._id,
      degree_type: d.degree_type,
      status: d.status,
      verified: !!(d.verification && d.verification.verified),
      groups_total: groups.length,
      groups_curated: groups.filter((g) => g.source === 'curated').length,
    });
  }
  const colleges = college_ids.map((id) => ({
    college_id: id,
    name: nameById.get(`cc:${id}`) ?? null,
    degrees: (byCollege.get(id) || []).sort((a, b) => String(a.degree_type).localeCompare(b.degree_type)),
  }));
  return { college_ids, colleges, updated_by: doc?.updated_by ?? null, updated_at: doc?.updated_at ?? null };
}

module.exports = { getValidationCohort, setValidationCohort };
```

Controller handlers in `Curation.js` (follow its `asyncHandler` + `stamp`/db-handle idioms; the main db is `req.app.locals.db`, audit handle via the existing `curationDb(req)` helper):

```js
const { getValidationCohort, setValidationCohort } = require('../services/asDegreeValidation');

exports.getAsDegreeValidationCohort = asyncHandler(async (req, res) => {
  res.json(await getValidationCohort(curationDb(req), req.app.locals.db));
});

exports.putAsDegreeValidationCohort = asyncHandler(async (req, res) => {
  const ids = req.body?.college_ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'college_ids array required' });
  res.json(await setValidationCohort(curationDb(req), ids, req.user?.uid));
});
```

Routes (end of the curated block in `server/routes/api.js`):

```js
router.get('/curated/as-degree-validation-cohort', ...guarded, curationController.getAsDegreeValidationCohort);
router.put('/curated/as-degree-validation-cohort', ...guarded, jsonBody, curationController.putAsDegreeValidationCohort);
```

- [ ] **Step 4: Run tests** — target file, then full server suite. Expected: PASS.
- [ ] **Step 5: Commit** — `git add server/... && git commit -m "feat(validation): as-degree validation cohort service and endpoints"`

---

### Task 2: Frontend cohort hooks

**Files:**
- Create: `frontend/src/asdegrees/validation/useValidation.js`
- Test: `frontend/src/asdegrees/validation/useValidation.test.jsx`

**Interfaces:**
- Produces: `useValidationCohort() -> query of the GET payload`; `useSetValidationCohort() -> mutation({college_ids})` invalidating the cohort query. Mirrors the query/mutation idioms in `frontend/src/shared/query/hooks/useData.js` (useAuth gate, staleTime 60s) but lives in the validation directory to keep the F-conflict surface at zero.

- [ ] **Step 1: Failing test** — mock apiClient (copy the repo's existing `vi.mock` convention for apiClient) and assert `useValidationCohort` fetches `/curated/as-degree-validation-cohort` and `useSetValidationCohort` PUTs `{college_ids:[110]}` then invalidates.
- [ ] **Step 2: Verify failure**, **Step 3: Implement** (thin `useQuery`/`useMutation` wrappers; import `apiClient` and `useAuth` exactly as `useData.js` does), **Step 4: Run + full frontend suite + build**, **Step 5: Commit** `feat(validation): cohort hooks`.

---

### Task 3: Validation dashboard + mount

**Files:**
- Create: `frontend/src/asdegrees/validation/ValidationDashboard.jsx`
- Test: `frontend/src/asdegrees/validation/ValidationDashboard.test.jsx`
- Modify: `frontend/src/DataPage.jsx` — ONE line region only: where `AsDegreeSchoolView` is mounted (`DataPage.jsx:362` area), add a sibling toggle to open the dashboard (e.g. a small "Deep validation" pill that swaps the pane between the existing school view and `<ValidationDashboard />`).

**Interfaces:**
- Consumes: Task 2 hooks; `useColleges()` from `useData.js` for the add-college picker.
- Produces: `<ValidationDashboard onOpenEditor={(collegeId) => …} />` — Task 4 wires `onOpenEditor` to the editor. Renders: cohort table (college name, per-degree chips `groups_curated/groups_total`, verified badge), add/remove college controls, empty state explaining the cohort concept.

Standard cycle: failing render test with a mocked cohort payload (two colleges, one verified degree) asserting progress text; implement with `components/ui` primitives (`Stack`, `Select`/combobox for adding, `Button`); run; commit `feat(validation): cohort dashboard`.

---

### Task 4: Structured editor — load, edit groups, save

**Files:**
- Create: `frontend/src/asdegrees/validation/AsDegreeEditor.jsx`
- Create: `frontend/src/asdegrees/validation/editorState.js` (pure doc-editing helpers — keep the component thin)
- Create: `frontend/src/asdegrees/validation/editorState.test.js`
- Test: `frontend/src/asdegrees/validation/AsDegreeEditor.test.jsx`

**Interfaces:**
- Consumes: `useAsDegreeDetail(collegeId)` + `useSaveAsDegree()` (existing, `useData.js:488-510`); `useCcCourses` for course pickers. **Before coding, read `AsDegreeDetailModal.jsx` and the detail branch of `server/services/asDegreeView.js` to learn exactly what the detail payload contains and what shape `useSaveAsDegree` PUTs** — mirror that save contract precisely (the PUT body is the canonical row with `legacy_id`-style id fields, not the derived view fields).
- Produces (from `editorState.js`, all pure and unit-tested):
  - `toEditableDoc(detailPayloadDoc) -> doc` (strip derived/view-only fields; keep every canonical field)
  - `updateGroup(doc, groupId, patch) -> doc` — applies the patch AND sets `source: 'curated'`, `confidence: null`, on the touched group
  - `addGroup(doc, groupId) -> doc`, `removeGroup(doc, groupId) -> doc`, `moveGroup(doc, groupId, dir) -> doc`
  - `setGroupCourses(doc, groupId, sectionIndex, receiverIndex, courseIds) -> doc` (agreement-skeleton shape: options/course_ids/course_keys per the validator)
  - `setDocField(doc, field, value) -> doc` (status/title/url/year/unit_system/total_units; clearing groups when status leaves `found`, per the validator rule)
  - `validateLocal(doc) -> [errors]` — client-side pre-check mirroring the cheap validator rules (slug group_ids, url shape, positive units) so most errors surface before the round-trip

- [ ] **Step 1: Failing unit tests for `editorState.js`** — at minimum: `updateGroup` stamps `source:'curated'` + `confidence:null`; `setDocField(doc,'status','none_found')` drops `requirement_groups`; `validateLocal` flags a bad `group_id` and a non-http catalog_url; round-trip `toEditableDoc` preserves canonical fields present in a fixture (reuse a fixture from `frontend/src/shared/components/requirements/_degree_*.fixture.json` or build a minimal as_degree fixture inline from the validator's field list).
- [ ] **Step 2: Verify failure. Step 3: Implement `editorState.js`** (pure functions, no React). **Step 4: unit tests pass.**
- [ ] **Step 5: Failing component test** — render editor with mocked detail payload; edit a group title; assert the save mutation receives a doc where that group has `source:'curated'` and `confidence:null`; assert the stale-write warning renders when the mocked detail `updated_at` changes between load and save.
- [ ] **Step 6: Implement `AsDegreeEditor.jsx`** — left rail: degree selector (the college's docs by degree_type) + doc-level fields; main: group cards (title, ge_area select from the validator's GE_AREAS, unresolved-courses list, course pickers per receiver via `useCcCourses(collegeId)` filtered combobox); footer: local-validation errors, Save (disabled while invalid), server-error display verbatim. Mark-group-reviewed and doc-level Verified toggle write through the same doc shape (`verification: { verified, verified_by, verified_at }` — preserve any existing keys in the object).
- [ ] **Step 7: Run frontend suite + build. Step 8: Commit** `feat(validation): structured as-degree editor`.

---

### Task 5: AI assist — server endpoint

**Files:**
- Create: `server/services/asDegreeAssist.js`
- Create: `server/services/asDegreeAssist.test.js`
- Modify: `server/controllers/Curation.js` (one handler), `server/routes/api.js` (one route), `server/package.json` (add `@anthropic-ai/sdk`)

**Interfaces:**
- Produces: `proposeAsDegreeEdit(db, { recordId, instruction }, { anthropic }) -> { proposed_doc, changes: [{group_id, kind, summary}] }` — throws `ValidationError`-style errors with readable messages; the `anthropic` client is injected (constructed in the controller from env) so tests mock it.
- Route: `POST /api/curated/as-degrees/:id/assist` body `{ instruction }` → the object above, or `503 { error: 'ai_assist_unavailable' }` when `ANTHROPIC_API_KEY` is unset, or `400` with the failure reason.

- [ ] **Step 1: Install SDK** — `cd server && npm install @anthropic-ai/sdk`.
- [ ] **Step 2: Failing tests** (mock the anthropic client — no network):

```js
const { describe, it, expect, vi } = require('vitest');
const { proposeAsDegreeEdit } = require('./asDegreeAssist');

const VALID_PROPOSAL = { proposed_doc: {/* minimal valid as_degree canonical doc */}, changes: [{ group_id: 'core', kind: 'edit', summary: 'moved MATH 1A into core' }] };

function anthropicReturning(payloads) {
  // payloads: array of message objects returned per call, shape:
  // { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(p) }] }
  const create = vi.fn();
  payloads.forEach((p) => create.mockResolvedValueOnce({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(p) }],
  }));
  return { messages: { create } };
}

it('returns a validated proposal without saving', async () => { /* db stub returns the doc + courses; expect proposed_doc echoed, no db writes */ });
it('retries once with the validation error, then rejects', async () => { /* first payload invalid (bad group source), second valid — expect success and TWO create calls; then a case where both invalid — expect throw with readable message */ });
it('refusal stop_reason is surfaced as an error', async () => { /* stop_reason: 'refusal' → throws 'assistant declined' style message */ });
```

- [ ] **Step 3: Verify failure. Step 4: Implement** `asDegreeAssist.js`:

```js
/**
 * AI-assisted structural edit of one as_degree doc. The model proposes a
 * complete corrected doc; we validate it with the SAME server validator the
 * manual PUT uses, retrying once with the error message. Nothing is saved
 * here — the frontend shows a diff and submits through the normal PUT.
 */
const MODEL = 'claude-opus-4-8';

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['proposed_doc', 'changes'],
  properties: {
    proposed_doc: { type: 'object' },
    changes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['group_id', 'kind', 'summary'],
        properties: {
          group_id: { type: 'string' },
          kind: { type: 'string', enum: ['edit', 'add', 'remove', 'doc_field'] },
          summary: { type: 'string' },
        },
      },
    },
  },
};

function systemPrompt(courseLines, templateJson) {
  return [
    'You correct AS-degree requirement documents for a transfer-pathways research database.',
    'Return the COMPLETE corrected document. Preserve every field you are not changing byte-for-byte.',
    'Hard rules (server-validated):',
    "- every requirement group you touch must have source 'curated' and confidence null;",
    '- group_id values match ^[a-z0-9_]+$ and are unique;',
    "- a doc whose status is not 'found' must not carry requirement_groups;",
    '- course references may only use the course ids from the catalog list below;',
    '- do not invent or modify verification notes or any prose note fields.',
    'College course catalog (id | code | title | units):',
    courseLines,
    templateJson ? `Statewide template for this degree type:\n${templateJson}` : '',
  ].join('\n');
}

async function callModel(anthropic, system, userText) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    messages: [{ role: 'user', content: userText }],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('The assistant declined this instruction; rephrase and try again.');
  }
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  return JSON.parse(text);
}

async function proposeAsDegreeEdit(db, { recordId, instruction }, { anthropic, validate }) {
  // 1. load doc, its college's sending courses, and its template (read the
  //    projections CanonicalData.js uses; keep them minimal)
  // 2. first attempt
  // 3. validate via the injected `validate(db, canonical)` — this MUST be the
  //    exported validateAsDegree from CanonicalData.js (export it if it isn't)
  // 4. on error: one retry with the validation message appended to the user
  //    text; validate again; throw the message if still invalid
  // (implement per the test expectations from Step 2)
}

module.exports = { proposeAsDegreeEdit, _RESPONSE_SCHEMA: RESPONSE_SCHEMA };
```

Export `validateAsDegree` from `CanonicalData.js` (pure addition to its `module.exports`). Controller handler constructs the client once per process:

```js
let anthropicClient = null;
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  }
  return anthropicClient;
}

exports.postAsDegreeAssist = asyncHandler(async (req, res) => {
  const anthropic = getAnthropic();
  if (!anthropic) return res.status(503).json({ error: 'ai_assist_unavailable', detail: 'ANTHROPIC_API_KEY is not configured on the server.' });
  const instruction = String(req.body?.instruction || '').trim();
  if (!instruction) return res.status(400).json({ error: 'instruction required' });
  try {
    const { validateAsDegree } = require('./CanonicalData');
    const result = await proposeAsDegreeEdit(req.app.locals.db,
      { recordId: req.params.id, instruction },
      { anthropic, validate: validateAsDegree });
    console.log(`[ai-assist] uid=${req.user?.uid} doc=${req.params.id} instruction=${JSON.stringify(instruction.slice(0, 200))}`);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

Route: `router.post('/curated/as-degrees/:id/assist', ...guarded, jsonBody, curationController.postAsDegreeAssist);`

- [ ] **Step 5: Run tests + full server suite. Step 6: Commit** `feat(validation): AI-assist proposal endpoint (claude-opus-4-8, validated server-side)`.

---

### Task 6: AI assist — frontend panel with diff + approve

**Files:**
- Create: `frontend/src/asdegrees/validation/AiAssistPanel.jsx`
- Create: `frontend/src/asdegrees/validation/docDiff.js` + `docDiff.test.js`
- Modify: `frontend/src/asdegrees/validation/AsDegreeEditor.jsx` (mount the panel)

**Interfaces:**
- Consumes: `POST /curated/as-degrees/:id/assist` (Task 5); the editor's current doc + `useSaveAsDegree`.
- Produces: `diffDocs(current, proposed) -> [{group_id, kind: 'added'|'removed'|'changed'|'doc_field', before, after}]` (pure, tested); panel flow instruction → "Propose" (loading state) → diff cards → Approve (stamps `curated_via: 'ai_assist'` on changed groups, then saves through the SAME save path as manual edits) / Discard. 503 from the server renders the "not configured" explanation.

Standard cycle: failing `docDiff` unit tests (added/removed/changed group, doc-field change) → implement → failing panel test (mocked assist response renders diff; approve calls save with the proposed doc + `curated_via` markers) → implement → full suite + build → commit `feat(validation): AI assist panel with reviewable diff`.

---

### Task 7: Final verification

- [ ] `cd server && npm test` — full pass, unmodified existing tests.
- [ ] `cd frontend && npm test && npm run build` — full pass, clean build.
- [ ] Manual smoke (`npm run dev`): add a college to the cohort, open the editor, hand-edit a group and save (check `source: 'curated'` in Mongo or via reload), toggle Verified, run one AI-assist round trip if `ANTHROPIC_API_KEY` is set locally (otherwise confirm the 503 message renders).
- [ ] Confirm zero diff outside the allowed surface: `git diff --stat main -- frontend/src server | grep -v "asdegrees/validation\|services/asDegreeValidation\|services/asDegreeAssist\|Curation.js\|CanonicalData.js\|routes/api.js\|package"` should show only `DataPage.jsx` (one mount region).
- [ ] Report to Tybalt; no merge/push without his say-so (use superpowers:finishing-a-development-branch).

## Self-review notes (applied)

- Spec §1→Task 1–2, §2→Task 3, §3→Task 4, §4→Tasks 5–6, error handling and stale-write warning→Tasks 4–5, testing→each task + Task 7.
- The save contract is deliberately anchored to `AsDegreeDetailModal`/`asDegreeView.js` reads rather than guessed — the detail payload's exact field set was not verified during planning, so Task 4 makes reading those files a hard prerequisite.
- `validateAsDegree` export is a pure addition; both manual PUT and AI path use one validator (no drift).
