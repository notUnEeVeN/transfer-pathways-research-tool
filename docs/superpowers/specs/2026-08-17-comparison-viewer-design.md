# THE COMPARISON VIEWER — final design

## 0. The two questions, answered first

### Q1 — What is the single unit of comparison?

**The View.** Not a figure, not a state, not a "version".

```js
View = {
  figure: string,          // an ANALYSES id (frontend/src/analyses/registry.js:96 / ANALYSIS_BY_ID)
  major:  string,          // an exact slug from server/config/majors.js: cs | bio | econ | ma-cs | va-cs
  knobs:  { [key]: string | boolean },   // declared, serializable subset of the figure's internal toggles
  label:  string | null,   // user-editable pane caption; null = auto-derived from figure + knob labels
}
```

Everything the brief asks for is *two Views differing in one field*:

| Brief | Difference |
|---|---|
| R1 versions (MA published vs our recomputation) | `knobs` only — verified: `MA_SOURCES` at `TransferCreditRate.jsx:108-118`, `PAPER_VIEWS` at `PathwayComplexity.jsx:194-198` |
| R1 versions (verified-only vs all-records; curated-minimums vs ASSIST) | `knobs` only |
| R2 majors (cs / bio / econ) | `major` only |
| R3 states (CA / MA / VA) | `major` only — **state is not a field.** It rides on `major.state`, exactly as it does today (`useMajors({state})` at `useMajors.js:53`, `serializeMajors` at `majors.js:572`, `stateTitles` keyed by `major.state` at `VisualsPage.jsx:149-155`) |

That is the whole reason there is **one** code path instead of three. A "version" is not a type; it is a knob set. A "state" is not a dimension; it is a property of a major. Any design that makes state or version a first-class field ends up with three special cases and three ways for them to rot.

A **Comparison** is the container: an ordered list of 2–6 Views, a baseline pointer, an optional breakdown id, and Tybalt's notes. It is the durable object. The View is the unit.

### Q2 — What killed the previous comparison visuals, and what stops it here?

**Three failures stacked** (from the 2026-07-24 transcript):

1. **Wrong altitude.** `compare-district-coverage`, `compare-credit-rate`, `compare-campus-coverage-spread` compared the *ported subset* — 3 majors, 9 campuses, ported paper figures — minutes after Tybalt reframed the program around the full UC+CSU × CCC × every-major census. They answered a question that had just stopped being the question.
2. **Wrong author.** Claude invented three new *chart types* and, implicitly, the claims they encoded. There was nowhere for Tybalt's argument to live, so each chart had to be self-evidently interesting on its own. None was. His prior instruction — *"i was hoping for something a little bit more informative and creative than just a side by side"* — was answered with cleverness when it needed to be answered with **an explanation**.
3. **No escape hatch.** They were registry figures: permanent, publishable, `MEASURES`-bearing artifacts with provenance lanes and colour tokens. Disliking one meant deleting six files and reverting edits across `registry.js`, `provenance.js`, `measures.js`, `tokens.css`, and two hooks.

**What this design does structurally to prevent each:**

1. **It renders no new figure type.** Increments 1–4 introduce zero registry entries and zero `MEASURES` entries. Every pane is the registry's own `Component` mounted through the existing `BuiltInAnalysisCard` (`VisualsPage.jsx:539-604`) — renderer parity exact by construction, the same argument `getAnalysisById` makes for published interactives (`registry.js:367-369`). The only new rendering is a **delta overlay**, which is `data-export-exclude` chrome, never exportable as a figure, never publishable, never MEASURES-bearing. And for the flagship pair it is *provably* not a new claim: the overlay's per-cell delta is arithmetically identical to `PathwayComplexity`'s own `diff` view (§6).
2. **The claim is Tybalt's, in writing, attached to the pair.** The notes rail is the deliverable. The tool's job is to put the number physically next to the sentence he wrote about it. Nothing is ever seeded, pre-filled, summarized, templated, or auto-written.
3. **Content is data, not code.** A comparison is a Mongo document. Rejecting one is `DELETE /api/comparisons/:id`, not a six-file revert. The tool can be wrong about a specific comparison without being wrong.
4. **Honesty over ambition.** `assessComparability` **refuses** rather than fuses. Cross-state is classified `same-measure / disjoint` and says so permanently on screen; it never invents a correspondence (no count-fusion grid, no rank-matched colleges, no spread heatmap). *"Only distributions and methodology contrasts exist across states"* is a fact the tool states, not a limitation it papers over.
5. **Explicit non-goal, written into the module header:** this is a meeting-and-audit tool. It is not the census research program and will never scale to "every major as the comparison distribution." That work needs its own fused figures; this tool will host and annotate them.

**Standing constraint carried forward verbatim:** the three removed figures are not rebuilt, and none of their computations (count fusion, spread = max−min, distribution overlay) appears in any increment. If a fused form is ever wanted, it is commissioned as a normal `ANALYSES` entry with its own `MEASURES` entry — not as a Compare feature.

---

## 1. Spine and judge resolution

Three judges, three winners. They are not actually in conflict once you separate **what stores** from **what renders** from **what argues**.

| Judge | Winner | The real finding |
|---|---|---|
| Codebase fit | P2 Light Table | `componentProps` is the *existing* knob channel; `BuiltInAnalysisCard` spreads it last (`VisualsPage.jsx:599`); `CoverageHeatmap.jsx:374` already consumes `defaultMaEquivalent` this way. Adoption cost = one line per knob. |
| User need | P4 The Brief | The argument is already written and the evidence is already computed — and **unused**. `pdf-reconciliation.json` (40KB, 61 cells), `figure-ledgers.json`, `reproduction-report.json`, `methods-audit.json`, `their-math.json` are written by `server/scripts/ma/*` and read by **nothing** in `server/` or `frontend/src/` (verified by grep). The scarce thing is a place where claim + figure + receipt sit together. |
| Year evolution | P1 Saved Comparison Documents | Durable identity must not be content-derived, or a knob rename orphans every note. |

**The resolution — one architectural move settles it:**

> **A content-derived fingerprint is an INDEX, never an IDENTITY.**

- `_id` is an opaque, immutable id (a slug), minted once. Notes can never be orphaned by a knob rename. *(P1 / Judge 3)*
- Each pane additionally stores a derived `fingerprint`, indexed in Mongo. It powers "3 other comparisons use this view" and note-as-navigation. If the fingerprint scheme ever changes, **discovery degrades for old docs; nothing is lost.** *(P2 / Judge 1's best structural idea, made safe)*
- The evidence artifacts get surfaced in increment 1, and every displayed verdict number names an artifact path. *(P4 / Judge 2)*

**Spine:** P1's storage · P2's rendering + adoption channel · P4's evidence and number discipline.

**Fatal flaws eliminated, explicitly:**

| Flaw | Source | Eliminated by |
|---|---|---|
| `useFigureView` controlled-component refactor across verified figures; migrating `defaultMaEquivalent` *off* `componentProps` | P4 | Not built. Knobs ride `componentProps` via a declared `prop` name; adoption is one line per knob. |
| `series/catalog.js` parallel data layer with hand-mirrored `queryKey`/`queryFn`/`queryOptions` | P3 | Not built. The overlay calls **the figure's own existing hook** (`usePathwayComplexity`, `useTransferCreditRate`, `useCoverage`) with the same arguments. react-query dedupes: one cache entry, one request. Adapters may only call functions the figure module **exports** — never re-derive. |
| Content-derived `_id`; two id schemes (readable + sha1 above 400 chars) | P3 / P4 | `_id` is a slug. Fingerprint is an indexed field. |
| `comparison_revisions` mirroring `curated_revisions` | P1 | Not built. `REVISIONED_KINDS = new Set(['as_degree','degree'])` (`CanonicalData.js:26`) is deliberately scoped to verified research artefacts. A meeting exhibit is team working state, like a task or a published figure — neither carries revisions. |
| `SpreadMatrix` (cell = max − min) | P3 slice 3 | Not built, ever. It is `CompareCreditRate`'s deleted spread heatmap under a new name. |
| Two-view arity cap | P4 | Panes are 2–6. R2 (cs/bio/econ) is three panes. |
| `?state=all` "one branch in majors.js" | P1 | **Two** edits. `server/controllers/Majors.js:14` validates against `configuredStates()` *before* calling `serializeMajors`, so the branch alone 400s. Both are specified in §4. |
| Notes deferred to step 2 | P2 | Notes ship in increment 1. They are the point. |
| "Save before you can write" ceremony | P1 | Auto-mint on first write (§3.3). `?panes=` drafts ship in increment 1, not increment 2. |

---

## 2. The unit made concrete — knob declaration

### 2.1 New optional registry field: `viewKnobs`

The vocabulary is **exactly** the shape the server already validates for published static figures (`validateControls`, `server/services/figures.js:73-123`) — `{key, label, type:'toggle'|'select', options:[{value,label}], default}` — plus two fields:

- `prop` — the `default*` prop the figure actually reads. This is the whole non-invasiveness story.
- `appliesWhen(major)` — optional pure predicate; a knob that does not apply is elided from the fingerprint and hidden in the UI.

`CONTROL_KEY_RE = /^[a-z][a-z0-9_-]{0,31}$/` is reused verbatim for `key`.

### 2.2 New optional registry field: `comparable`

```js
comparable: {
  grain: 'college×campus',        // human string, printed in the join receipt
  unit: 'score-delta',            // 'pct' | 'score-delta' | 'count'
  tolerance: 0,                   // |delta| <= tolerance counts as "agreeing"
  // The figure's OWN hook, called with the arguments the figure calls it with.
  // react-query dedupes: the pane and the overlay share one cache entry.
  useData: (view) => usePathwayComplexity({ majorSlug: view.major }),
  // Cells from that data. MAY ONLY call functions exported by the figure's
  // own module — never re-derive a reading. This is what makes the overlay's
  // number and the figure's number the same number by construction.
  cells: (data, view) => [{ rowKey, rowLabel, colKey, colLabel, value }],
}
```

Both fields are **optional with graceful degradation**:

- No `viewKnobs` → the pane renders at the figure's own defaults and shows a `not pinned — showing figure defaults` chip. Its fingerprint carries no knobs. It still takes notes.
- No `comparable` → the pane renders, the comparison saves, notes work, and the overlay says *"No delta lens for `paper-articulation-map` yet."* Honest, not broken. This is the anti-exclusion-cliff property.

### 2.3 The three adopted figures (exact edits)

**`frontend/src/analyses/PathwayComplexity.jsx`** — 3 edits:
```js
// 1. export the existing module-private function (line ~136), unchanged body
export function paperEntries(data, view = 'published') { … }

// 2. seed from a prop (line ~207)
export default function PathwayComplexity({ majorSlug = 'cs', defaultPaperView = 'published' }) {
  …
  const [paperView, setPaperView] = useState(defaultPaperView)

// 3. declare the contract (module scope, after the component)
PathwayComplexity.viewProps = ['defaultPaperView']
```

**`frontend/src/analyses/TransferCreditRate.jsx`** — 5 edits (four one-line `useState` seedings at :397-422, plus the static):
```js
export default function TransferCreditRate({
  majorSlug = 'cs', majorLabel, major, majorCapabilities,
  degreeAnalysisSlots, degreeSlotLabels, onMeasureChange,
  defaultDegreeType = null, defaultScope = 'lower-division',
  defaultMaSource = 'pdf', defaultMaGeOn = true, defaultVerifiedOnly = false,
}) {
  const [degreeType, setDegreeType] = useState(() => defaultDegreeType || defaultDegreeMode(degreeModes))
  const [scope, setScope] = useState(defaultScope)
  const [maSource, setMaSource] = useState(defaultMaSource)
  const [maGeOn, setMaGeOn] = useState(defaultMaGeOn)
  const [verifiedOnly, setVerifiedOnly] = useState(defaultVerifiedOnly)
  …
}
TransferCreditRate.viewProps = ['defaultDegreeType','defaultScope','defaultMaSource','defaultMaGeOn','defaultVerifiedOnly']
```
`maSourceValue`, `rateForScope`, `MA_AS_SIDE_SCOPE` are **already exported** (`:100-138`) — the adapter imports them.

**`frontend/src/analyses/CoverageHeatmap.jsx`** — 3 edits + 1 new export:
```js
export default function CoverageHeatmap({ …, defaultMaEquivalent = false,
  defaultRowMode = 'college', defaultReqMode = 'degree' }) {
  const [rowModeValue, setRowModeValue] = useState(defaultRowMode)
  const [reqMode, setReqMode] = useState(defaultReqMode)
  …
}
// The single derivation of this figure's query arguments, so the comparable
// adapter imports it instead of re-deriving (and therefore drifting).
export function coverageQueryArgs({ majorSlug, rowMode, reqMode }) { … }
CoverageHeatmap.viewProps = ['defaultMaEquivalent','defaultRowMode','defaultReqMode']
```
`defaultMaEquivalent` **stays** on `componentProps`; `MA_COMPONENT_PROPS` in `MassachusettsPage.jsx:305` is untouched. We are extending the working convention, not retiring it.

### 2.4 The contract test — `frontend/src/compare/viewKnobs.test.js`

The `measures.js` hazard ("a stale formula is worse than none") applied to controls. Three assertions:

1. Every `viewKnobs`-bearing entry's `id` exists in `ANALYSIS_BY_ID`.
2. For every declared knob, `knob.prop ∈ analysis.Component.viewProps`. A knob whose prop the figure does not read fails the build.
3. For every `comparable`-bearing entry, `cells(fixture, view)` over a committed fixture equals the figure's own rendering path over the same fixture. For `pathway-complexity` that is literally `paperEntries` — the parity is an identity, not a hope.

---

## 3. Storage

### 3.1 Collection: `comparisons` — AUDIT handle

`auditHandle(req)` (`server/controllers/helpers.js:3`) — `req.app.locals.auditDb || req.app.locals.db`. This is team working state, alongside `tasks` and `published_figures`; it is never joined against the reference handle.

```js
{
  _id: 'ma-fig6-printed-vs-workbook',   // slug, SLUG_RE, IMMUTABLE. durable identity.
  schema_version: 1,
  title: 'MA Figure 6 — printed vs their own workbook',   // freely renameable
  kind: 'versions' | 'majors' | 'states' | 'mixed',       // derived at write, for gallery lanes

  panes: [
    { id: 'p1',                                   // stable within the doc; React key + baseline pointer
      figure: 'pathway-complexity',               // an ANALYSES id
      major: 'ma-cs',                             // an exact configured slug
      knobs: { source: 'published' },             // scalars only
      label: 'Paper (published)',                 // user-editable, or null
      fingerprint: 'pathway-complexity@ma-cs' },  // DERIVED — index only, never identity
    { id: 'p2', figure: 'pathway-complexity', major: 'ma-cs',
      knobs: { source: 'ours' }, label: 'Ours (recomputed from their workbooks)',
      fingerprint: 'pathway-complexity@ma-cs?source=ours' },
  ],                                              // 2..6

  baseline_pane: 'p1',
  breakdown_id: 'ma-complexity-figure-6' | null,  // R5 override; null = first matching

  verdict_at_pin: {                               // the anti-drift snapshot
    computed_at: ISODate, matched: 60, agreeing: 58, dropped: 0,
    mean_delta: 0.133, max_abs_delta: 62,
    max_cell: 'Springfield Technical × UMass Amherst',
  } | null,

  notes: [ { id: '<client uuid>', text: '<byte-exact>',
             anchor: null | { rowKey, colKey, label },
             author_uid: string|null, author_label: string|null,
             created_at: ISODate, updated_at: ISODate|null } ],

  author_uid, author_label, created_at,
  updated_at, updated_by_uid, updated_by_label,
}
```

Indexes (created on first service call, `createIndex` is idempotent):
```js
{ 'panes.fingerprint': 1 }   // discovery
{ updated_at: -1 }           // gallery ordering
```

`notes[]` element shape is byte-identical to `verification_notes` on degree docs (`DataPage.jsx:1315-1321`) so one note primitive reads identically across the console — plus `anchor` and `updated_at`.

**Deliberately NOT stored:** cell values, row snapshots, rendered images. A comparison re-runs live queries. Published figures freeze bytes (`server/services/figures.js:10-28`); a comparison must not, because its whole job is to be *currently* true. `verdict_at_pin` is the reconciliation of those two facts.

### 3.2 Why `verdict_at_pin` is load-bearing

Coverage with `requirements=degree` **deliberately bypasses** the 60s server cache (`Analysis.js:152-158`) so a degree-template edit lands on the next request. A note Tybalt writes in August can therefore be silently contradicted in November by an edit nobody connected to it. Storing the numbers observed when the comparison was pinned lets the workspace render:

> ⚠ **This comparison has moved.** Pinned 2026-08-17: 58 of 60 agreeing, max Δ 62. This render: 57 of 60, max Δ 62. — *Re-pin* / *Show what changed*

That banner is the difference between a research tool and a source of confidently wrong claims. It ships in increment 1.

### 3.3 No ceremony — lazy identity

There is no "you must save before you can write."

- Clicking **Add note** on an unsaved draft `POST`s the comparison first, then the note. The server mints `_id` = `cmp-<8 hex>` when no slug is given, and `title` = machine-derived from the pane labels (`"Pathway complexity · MA · Paper (published) vs Ours"`). That is a generated **label**, not prose — same category as `exportName` in `AnalysisCard`. Tybalt renames it freely; `_id` never changes.
- The URL is the draft; the collection is the keepsake. `?panes=…` → save → `?cmp=…`.

---

## 4. Server — exact files, routes, guards

### 4.1 New: `server/services/comparisons.js`

Pure-ish service, `ValidationError`-style failures returned as `{error}` (the `services/tasks.js` idiom). Exports:

```js
listComparisons(auditDb, { fingerprint = null, limit = 100 })
getComparison(auditDb, id)
createComparison(auditDb, body, { uid, label })
updateComparison(auditDb, id, body, { uid, label })   // NEVER touches notes
deleteComparison(auditDb, id)
addNote(auditDb, id, { text, anchor }, { uid, label })
editNote(auditDb, id, noteId, { text }, { uid })      // author-only
deleteNote(auditDb, id, noteId, { uid })              // author-only
fingerprintOf(pane)                                   // canonicalization, mirrored client-side
```

**Validation — shape only, never a mirror of the frontend registry** (a server-side copy of `ANALYSES` would rot):
- `slug` against the existing `SLUG_RE` from `figures.js`; `figure` against `SLUG_RE`.
- `major` against `getMajor(slug)` from `server/config/majors.js` — the server genuinely owns this.
- 2–6 panes; unique `pane.id`; `baseline_pane` must name one.
- `knobs`: keys match `CONTROL_KEY_RE`, values are `string | boolean | number`, ≤ 2KB serialized per pane.
- `breakdown_id` against `SLUG_RE` only. An unknown breakdown id resolves to `null` client-side — there is **no execution surface** here, unlike `INTERACTIVE_RENDERERS`, which allowlists precisely because a renderer id gates execution.
- An unknown `figure` id fails closed in the frontend via `getAnalysisById() → null`, reusing the existing string *"This visual renderer is not available in the current application."*

**Note handling — the house rule, enforced in code:**
- `text` is validated (`typeof === 'string'`, `text.trim().length > 0`, `text.length <= 20000`) and **stored exactly as submitted**. No trim-into-storage, no normalization, no templating. Precedent: `server/controllers/Virginia.js:919`.
- Authorship stamped **server-side only**: `author_uid = req.user?.uid ?? null`, `author_label = await getDisplayName(auditDb, uid) || req.user?.name || req.user?.email || null`. A `pmtr_` API-token caller has a uid and no name (`middleware/auth.js:10-35`), so the label tolerates `null`.
- `updateComparison` **strips any `notes` key from the body before `$set`**. A metadata save is structurally incapable of clobbering prose. This is the one place worth spending paranoia.
- Author-only edit and delete (`deleteTaskLogNote` precedent, `services/tasks.js:668-680`). Everything else is everyone-equal, the house default; `DELETE /:id` is `canModify` (author-or-admin, `helpers.js:8`).
- **The store ships empty.** Zero seeded rows. Example wording lives only in a `<Textarea placeholder>`.

### 4.2 New: `server/controllers/Comparisons.js`, `server/services/comparisons.test.js`

### 4.3 Edit: `server/controllers/Massachusetts.js` — add `evidence`

```js
// Committed reproduction artifacts, required at module load like
// PAPER_COMPLEXITY_SNAPSHOTS (Analysis.js:31). Read-only; regenerated by
// server/scripts/ma/{pdfReconciliation,figureLedgers}.js and committed.
const MA_EVIDENCE = Object.freeze({
  reconciliation: require('../data/ma/pdf-reconciliation.json'),
  ledgers: require('../data/ma/figure-ledgers.json'),
});
exports.evidence = asyncHandler(async (req, res) => res.json(MA_EVIDENCE));
```
61KB combined, immutable per deploy, `staleTime: Infinity`.

### 4.4 Edit: `server/config/majors.js` — `serializeMajors`

```js
function serializeMajors({ state } = {}) {
  // 'all' is the cross-corpus registry, used ONLY by the Compare pane picker.
  // Every other caller keeps its scoped payload, so the California picker can
  // never list a state major.
  if (state === 'all') return MAJORS;
  if (state) return MAJORS.filter((major) => major.state === state);
  return MAJORS.filter((major) => !major.state);
}
```

### 4.5 Edit: `server/controllers/Majors.js` — accept `all`

**Required, and the flaw that would 400 on first run if skipped.** `configuredStates()` (`:14`) validates before `serializeMajors` is ever reached.

```js
const configuredStates = () => new Set([
  'ca', 'all',
  ...listMajors({ includeStates: true }).map((m) => m.state).filter(Boolean),
]);
…
const majors = serializeMajors(state && state !== 'ca' ? { state } : {});
const fallback = majors[0]?.slug || defaultMajor().slug;
res.json({ majors, default: state && state !== 'ca' ? fallback : defaultMajor().slug });
```
`state === 'all'` flows through the existing `state !== 'ca'` branch unchanged.

**Client side: zero changes.** `useMajors({ state: 'all' })` already works — `const fallback = state ? [] : CS_FALLBACK` (`useMajors.js:74`) means a failed cross-state fetch surfaces as `majors: []` + `isError`, never as California CS. Key is `['majors','v6','all',uid]`, a separate cache slot.

### 4.6 Edit: `server/config/majors.test.js`

Regression: `serializeMajors()` and `serializeMajors({state:'ma'})` payloads are byte-identical to today; `serializeMajors({state:'all'})` returns all five; the default payload contains no `state`-stamped major.

### 4.7 Edit: `server/routes/api.js`

All on the existing `guarded = [authenticateToken, requireAuditAccess, userLimiter]` stack (`:20`). No new guard, no admin gate — a comparison is not a verified artefact, and gating it behind `requireAdmin` would defeat the point.

```js
const comparisonsController = require('../controllers/Comparisons');

router.get('/ma/evidence',   ...guarded, massachusettsController.evidence);

router.get   ('/comparisons',                    ...guarded, comparisonsController.list);
router.post  ('/comparisons',                    ...guarded, jsonBody, comparisonsController.create);
router.get   ('/comparisons/:id',                ...guarded, comparisonsController.get);
router.patch ('/comparisons/:id',                ...guarded, jsonBody, comparisonsController.update);
router.delete('/comparisons/:id',                ...guarded, comparisonsController.remove);
router.post  ('/comparisons/:id/notes',          ...guarded, jsonBody, comparisonsController.addNote);
router.patch ('/comparisons/:id/notes/:noteId',  ...guarded, jsonBody, comparisonsController.editNote);
router.delete('/comparisons/:id/notes/:noteId',  ...guarded, comparisonsController.deleteNote);
```

### 4.8 Endpoint contracts

| Method / Path | Params | Body | Response | Auth |
|---|---|---|---|---|
| `GET /api/comparisons` | `?fingerprint=<f>` `?limit=` | — | `{ comparisons: [{_id,title,kind,panes,note_count,author_label,updated_at}] }`, `updated_at` desc | guarded |
| `POST /api/comparisons` | — | `{slug?,title?,panes[],baseline_pane?,breakdown_id?,verdict_at_pin?}` | `201 {comparison}` · `400 {error}` · `409` slug taken | guarded |
| `GET /api/comparisons/:id` | — | — | `{comparison}` · `404` | guarded |
| `PATCH /api/comparisons/:id` | — | `{title?,panes?,baseline_pane?,breakdown_id?,verdict_at_pin?}` — **`notes` ignored** | `{comparison}` · `400` · `404` | guarded |
| `DELETE /api/comparisons/:id` | — | — | `204` · `403` non-owner · `404` | guarded + `canModify` |
| `POST /api/comparisons/:id/notes` | — | `{text, anchor?}` | `{comparison}` · `400` | guarded |
| `PATCH /api/comparisons/:id/notes/:noteId` | — | `{text}` | `{comparison}` · `403` non-author | guarded |
| `DELETE /api/comparisons/:id/notes/:noteId` | — | — | `{comparison}` · `403` non-author | guarded |
| `GET /api/ma/evidence` | — | — | `{reconciliation, ledgers}` | guarded |
| `GET /api/majors?state=all` | `state=all` | — | `{majors:[5], default:'cs'}` | guarded |

---

## 5. Frontend — exact files

### 5.1 New top-level tab — `frontend/src/App.jsx`

One import + three registrations. The comment at `:154-158` states the rule; an unregistered value silently bounces to California via `safeConsoleView`.

```js
import ComparePage from './compare/ComparePage'                     // 1

function availableConsoleViews(role) {
  return new Set(['data','virginia','massachusetts','compare','audit','tasks','api',   // 2
    ...(role === 'admin' ? ['admin'] : [])])
}

{view === 'compare' && <ComparePage />}                              // 3  (in Console)

{ value: 'compare', label: 'Compare' },                              // 4  (TopBar tabs, after Massachusetts)
```
`data` keeps serializing to **no** `?view` param. `?view=visuals` keeps redirecting to `data`.

It cannot live inside a state page: it spans states. It is a first-class surface (R7).

### 5.2 New files

```
frontend/src/compare/
  ComparePage.jsx              route shell: SubNav + PageContainer, ?cmp= / ?panes= URL state
  ComparisonWorkspace.jsx      the tool: pane grid, overlay, breakdown, notes rail
  ComparisonGallery.jsx        the "Saved" sub-tab
  PaneBuilder.jsx              figure × major × knobs picker (add / duplicate / edit a pane)
  ViewPane.jsx                 one pane: chrome + BuiltInAnalysisCard
  CellSource.jsx               headless: calls the figure's OWN hook, reports cells upward
  viewKnobs.js                 canonicalize / fingerprint / knobsToProps / encode+decode ?panes=
  comparability.js             pure, fail-closed: level + join + actionable warnings
  delta.js                     pure: join two cell sets -> matched, dropped, summary
  DeltaOverlay.jsx             the difference readout (data-export-exclude)
  JoinReceipt.jsx              matched / only-in-A / only-in-B / dropped keys
  VerdictDrift.jsx             the verdict_at_pin banner
  ComparisonNotes.jsx          the notes rail
  breakdowns/registry.js       BREAKDOWNS + breakdownsFor + resolveBreakdown
  breakdowns/MaComplexityFigure6.jsx      ← the worked example (increment 1)
  breakdowns/MaFig3Reconciliation.jsx     ← increment 2
  viewKnobs.test.js  comparability.test.js  delta.test.js  ComparePage.test.jsx

frontend/src/shared/query/hooks/useComparisons.js
frontend/src/shared/hooks/useDeferredMount.js     extracted from VisualsPage.jsx:54-70
```

### 5.3 Edits to existing frontend files

| File | Edit |
|---|---|
| `analyses/registry.js` | `viewKnobs` + `comparable` on `pathway-complexity` (inc 1), `transfer-credit-rate` (inc 2), `coverage-heatmap` (inc 3). Additive optional fields; the docblock's entry shape gains two lines. |
| `analyses/PathwayComplexity.jsx` | export `paperEntries`; `defaultPaperView` prop; `viewProps` static |
| `analyses/TransferCreditRate.jsx` | five `default*` props; `viewProps` static |
| `analyses/CoverageHeatmap.jsx` | `defaultRowMode` / `defaultReqMode` props; export `coverageQueryArgs`; `viewProps` static |
| `visuals/VisualsPage.jsx` | replace the local `useDeferredPreview` (`:54-70`) with an import of `shared/hooks/useDeferredMount`; keep the existing 280px `rootMargin` and the `IntersectionObserver === undefined → ready` test path |
| `shared/query/client.js` | add `'comparisons'` to the `shouldPersistQuery` exclusion list beside `'access-me'` / `'majors'` — a note just written must never be shadowed by a 24h-old IndexedDB copy |
| `massachusetts/MaComparisonPanel.jsx` | the hardcoded `38.2%` at `:71` becomes `ledgers.fig1.mean_ours` from `/api/ma/evidence`; the table body becomes the shared reconciliation ledger (increment 2, §7) |

**No `buster` bump in `main.jsx`.** All keys are new; no existing dataset is rewritten underneath the cache.

### 5.4 `useComparisons.js`

```js
useComparisonList({ fingerprint = null })  // ['comparisons','v1',uid,fingerprint ?? '']
useComparison(id)                          // ['comparisons','v1',uid,'doc',id], staleTime 0
useSaveComparison() / useDeleteComparison()
useAddNote() / useEditNote() / useDeleteNote()   // all invalidate ['comparisons','v1',uid]
useMaEvidence()                            // ['ma-evidence','v1',uid], staleTime Infinity
```
Root key `'comparisons'` — deliberately **not** `analysis-` prefixed (these are documents, not computed analyses, so they are not flushed by the curated-save invalidation predicate) **and** excluded from IndexedDB persistence via the `client.js` edit above.

### 5.5 `ComparePage.jsx`

Follows the shared state-tab shell verbatim: `SubNav` (Tabs + RouteHint) over `PageContainer`.

```js
const TABS = [{ value: 'workspace', label: 'Workspace' }, { value: 'saved', label: 'Saved' }]
const TAB_ROUTES = {
  workspace: { path: '/api/comparisons/:id' },
  saved:     { path: '/api/comparisons' },
}
```
URL state via the existing `readUrlParam` / `writeUrlParam` + a `popstate` listener (the `MajorContext.jsx:83-117` pattern): `?view=compare`, `?cmp=<id>` (saved), `?panes=<encoded>` (draft). Encoding is plain readable text — `pathway-complexity@ma-cs?source=published|pathway-complexity@ma-cs?source=ours` — not base64. Internal tool; debuggability wins.

### 5.6 `ComparisonWorkspace.jsx` — layout and props

`lg:grid-cols-[minmax(0,1fr)_340px]` (the console shell is desktop-only, `min-w-[1180px]`, and every state page already assumes rail+detail geometry).

**Left column, top to bottom:**

1. **Header strip** — title (inline-editable), comparability line (non-dismissible), `Save` / `Rename` / `Delete`, and the `VerdictDrift` banner when `verdict_at_pin` disagrees with the live render.
2. **Pane strip** — one chip per pane: figure title (via the exported `analysisCopy` path, so per-state copy is honoured), major label, knob pills, `Duplicate`, `Edit`, `Close`, and a `Baseline` radio. **Duplicate-then-change-one-field is the assembly gesture**: R1 = duplicate, flip a knob. R2 = duplicate, change major. R3 = duplicate, change major to another state's. Two clicks each.
3. **`DeltaOverlay`** — the hero. Ranked signed deltas against the baseline pane: one row per matched cell sorted by |Δ| descending, a dumbbell (baseline dot, other dot, connector) on a shared axis, coloured with the existing `CA_DIFFERENCE_COLORS` (`gained #0D7964` / `lost #CB1D51`) — **no new diff palette**. Cells are clickable → `selectedCell`. `data-export-exclude`.
4. **`JoinReceipt`** — permanent: `grain: college×campus · aligned · matched 60 · only in Paper 0 · only in Ours 0 · dropped 0`, with a disclosure naming dropped keys. This repairs a live defect: `MaComparisonPanel.jsx:29-35` inner-joins on `${school_id}|${community_college_id}` and silently drops unstudied pairs. In a meeting, the rows you dropped are the first thing someone asks about.
5. **Breakdown** — the resolved per-pair panel, collapsed by default, `data-export-exclude`.
6. **Source panes** — collapsed by default. The real figures, each `<ViewPane>`, in columns. **Collapsed-by-default is the direct answer to "side by side is boring": the tool opens on the difference; the sources are the receipt you pull out.** Editing a pane's knobs here rewrites the pane spec and the URL, so poking at a figure *is* editing the comparison.

**Right rail:** `ComparisonNotes`, always visible.

### 5.7 `ViewPane.jsx` — exact props

```jsx
<ViewPane
  pane={pane}                       // { id, figure, major, knobs, label, fingerprint }
  major={majorObject}               // the whole server config entry from useMajors({state:'all'})
  isBaseline={bool}
  onChange={(nextPane) => …}
  onDuplicate={() => …} onClose={() => …}
  collapsed={bool} onToggle={() => …} />
```
Body:
```jsx
<BuiltInAnalysisCard
  analysis={getAnalysisById(pane.figure)}
  selectedMajor={major}
  availability={resolveAnalysisAvailability(analysis, major)}
  componentProps={knobsToProps(analysis, pane.knobs, major)} />
```
Reused **whole**, which is the entire fit argument: the fail-closed `data_pending` / `not_applicable` / `configuration_error` Alerts, `AnalysisScopeNotice`, the `MeasurePanel` (vital — two panes that look alike each state what they measure), and per-pane PNG/PDF export all arrive free, and renderer parity is exact by construction.

**Figure picker source:** `filterBuiltInAnalyses(ANALYSES, { isAdmin, releasedIds, disabledIds })` (`analysisVisibility.js`, exported from `VisualsPage.jsx:25`). **Disabled beats released and a disabled figure must not mount at all** — that rule survives into the new surface. A figure that is available-but-unavailable-for-this-major is still *listed*, dimmed, with `availability.reason` as its suffix: "why can't I compare this" is itself meeting content.

**Deferred mounting:** each pane mounts through `useDeferredMount` so an off-screen or collapsed pane fires no query. This matters because `useCoverage` runs `gcTime: 0` (deliberate — never repaint from memory after unmount) and `useTransferCreditRate` runs `staleTime: 0` + `refetchOnMount: 'always'`. Neither may be "optimized."

### 5.8 `CellSource.jsx` — how the overlay gets data without a second data layer

```jsx
// Renders nothing. Calls the figure's OWN hook (comparable.useData) so the pane
// and the overlay share one react-query cache entry — one request, one result,
// and no second place where a request shape can drift.
export default function CellSource({ pane, analysis, onCells }) {
  const comparable = analysis?.comparable || null
  const query = comparable ? comparable.useData(pane) : { data: null, isLoading: false, isError: false }
  useEffect(() => {
    if (!comparable) return onCells(pane.id, { status: 'no_adapter', cells: [] })
    if (query.isLoading) return onCells(pane.id, { status: 'loading', cells: [] })
    if (query.isError)   return onCells(pane.id, { status: 'error', cells: [] })
    onCells(pane.id, { status: 'ready', cells: comparable.cells(query.data, pane) })
  }, [comparable, query.data, query.isLoading, query.isError, pane.id])
  return null
}
```
One instance per pane ⇒ hooks are stable within each instance ⇒ no rules-of-hooks violation with 2–6 dynamic panes. This is the same report-upward idiom the codebase already uses for `onMeasureChange`.

### 5.9 `comparability.js` — pure, fail-closed

Merges P3's computable classification with P4's displayable vocabulary and P2's actionable fix text.

```js
assessComparability(panes, majorsBySlug) -> {
  level: 'same-cells' | 'same-measure' | 'same-figure' | 'incomparable',
  join:  'aligned'    | 'disjoint'     | 'refused',
  line:  '<the non-dismissible header sentence>',
  warnings: [{ code, text, fix }],   // fix names the action, not just the problem
}
```

The **one rule that computes it**, and why it unifies R1/R2/R3:

> **Do the panes' row/col key spaces intersect?**

| Condition | level / join |
|---|---|
| panes name different `figure` ids | `incomparable` / `refused` — render nothing, state why |
| same figure, same major, knobs differ | `same-cells` / `aligned` |
| same figure, different majors, **same** `major.state` | `same-cells` / `aligned` (CA cs/bio/econ share the district × campus key space) |
| same figure, different `major.state` | `same-measure` / `disjoint` — Bristol CC is not Ohlone. Cell diff refused; the honest output is the distribution comparison (increment 4) |
| same figure, incompatible lenses | `same-figure` / `refused` + fix text |

Concrete lens rule shipped day one (`coverage-heatmap`, when adopted): one major has `capabilities.unitCoverage !== false` and another `=== false` (verified: `ma-cs` at `majors.js:405`, `va-cs` at `:496`, CA majors unset). Warning text names the fix: *"These panes read different measures — California's graduation-unit lens vs the paper's course lens. Turn the California pane's MA-paper-equivalent knob on."*

Grounded facts it encodes: `unitCoverage:false` makes the server emit **NULL** for every unit-lens field (`pathways.js:935-944`); `paperBaselines` is true only for `ma-cs`, which is why Virginia is state-scoped but keeps the California control set; `transferMinimums` is CS-only.

### 5.10 `ComparisonNotes.jsx` — the reason it all exists

- Chronological list — `text` with `whitespace-pre-wrap`, `author_label · fmtDate(created_at)`. Styled after `DegreeVerificationNotes` (`DataPage.jsx:1302-1345`).
- Compose box at the bottom. Empty state: **"No notes yet."** Placeholder attribute only.
- Author-only edit and delete.
- **Anchored notes:** clicking a delta cell in the overlay pre-anchors a new note to it (chip: *"Springfield Technical × UMass Amherst"*); clicking an existing note's chip highlights that cell and scrolls the breakdown to it. `anchor = null` is the default (a note about the whole comparison).
- **"Notes on related views"** — a disclosure listing comparisons sharing at least one exact `fingerprint`, each a button that loads that comparison. This is what stops a note from silently disappearing after a knob tweak, and it is why the fingerprint index exists.
- **Claude never writes one.** Ships empty. Not one seeded row, not one example string in stored data.

---

## 6. Extensibility seam — per-pair breakdowns, worked end to end

### 6.1 The registry — `frontend/src/compare/breakdowns/registry.js`

Deliberately the same two-step contract `registry.js:8-11` states for figures: *create the component, add one metadata entry.*

```js
import MaComplexityFigure6 from './MaComplexityFigure6'

export const BREAKDOWNS = [
  {
    id: 'ma-complexity-figure-6',
    label: 'Where Figure 6 disagrees with their own workbook',
    description: 'Every printed cell against their own Curricular Complexity tab, plus the typed scores that drifted and the headline the drift produced.',
    // Pure predicate over the canonical pane array. Never over pane ORDER,
    // layout, or which comparison it was assembled in — so a breakdown fires
    // identically whether the pair was built by hand, restored from a URL, or
    // opened from a note.
    matches: ({ panes }) =>
      panes.length === 2
      && panes.every((p) => p.figure === 'pathway-complexity' && p.major === 'ma-cs')
      && new Set(panes.map((p) => p.knobs?.source ?? 'published')).size === 2
      && panes.every((p) => ['published', 'ours'].includes(p.knobs?.source ?? 'published')),
    Component: MaComplexityFigure6,
  },
]

export const breakdownsFor = (comparison) =>
  BREAKDOWNS.filter((b) => { try { return b.matches(comparison) } catch { return false } })

// An explicit breakdown_id on the stored doc wins; otherwise the first match;
// otherwise none. An unknown id resolves to null — no execution surface.
export const resolveBreakdown = (comparison) =>
  BREAKDOWNS.find((b) => b.id === comparison.breakdown_id)
  || breakdownsFor(comparison)[0]
  || null
```

Adding one is **one component file + one array entry.** Nothing in `ViewPane`, `ComparisonWorkspace`, `ComparisonNotes`, the store, or the server changes. That is exactly *"I'll decide what visual accompaniments some visuals should have"* — and once a panel exists, pinning it to a specific pairing is a data edit (`breakdown_id`), not code.

### 6.2 The worked example — MA published-vs-ours **pathway complexity**

> **Historical design example — do not use its evidentiary claims in the
> presentation.** The final audit established that this section conflates the
> 2026 final PDF, a 2024 archived tally, and our reconstruction of archived
> pathway sheets. It also depended on our former duplicate-course-ID scorer
> bug. The implemented comparison now separates those three sources; the
> presentation-safe interpretation is in
> [`../../ma-meeting-notes.md`](../../ma-meeting-notes.md#figure-6--final-15-is-right).

**The comparison:**
```js
{ _id: 'ma-fig6-printed-vs-workbook',
  title: 'MA Figure 6 — printed vs their own workbook',
  kind: 'versions',
  panes: [
    { id:'p1', figure:'pathway-complexity', major:'ma-cs', knobs:{ source:'published' },
      label:'Paper (published)',  fingerprint:'pathway-complexity@ma-cs' },
    { id:'p2', figure:'pathway-complexity', major:'ma-cs', knobs:{ source:'ours' },
      label:'Ours (recomputed)',  fingerprint:'pathway-complexity@ma-cs?source=ours' },
  ],
  baseline_pane:'p1', breakdown_id:'ma-complexity-figure-6' }
```

**Registry additions** — `frontend/src/analyses/registry.js`, on the existing `pathway-complexity` entry (`:254`):
```js
viewKnobs: [
  { key: 'source', label: 'Source', type: 'select', prop: 'defaultPaperView',
    options: [
      { value: 'published', label: 'Paper (published)' },
      { value: 'ours',      label: 'Ours (recomputed)' },
      { value: 'diff',      label: 'Difference' },
    ],
    default: 'published',
    // The control only exists on a paper corpus (the response's mode:'paper').
    appliesWhen: (major) => Boolean(major?.state && major?.capabilities?.paperBaselines) },
],
comparable: {
  grain: 'college × university',
  unit: 'score-delta',
  tolerance: 0,
  useData: (view) => usePathwayComplexity({ majorSlug: view.major }),
  cells: (data, view) => paperEntries(data, view.knobs?.source ?? 'published')
    .map((e) => ({ rowKey: e.row, rowLabel: e.row, colKey: e.column, colLabel: e.column, value: e.delta })),
},
```

**Why this pair is the cheapest possible proof of the whole architecture:**

- **No new endpoint.** `/analysis/pathway-complexity?majorSlug=ma-cs` already returns `{mode:'paper', ...complexity-validation.json}` — `Analysis.js:228-236` — carrying `pathways` (72), `misses` (2), `figure_cell_misses` (1), `coreq_treatment`, `headline_plus_15`, `method`.
- **No new data layer.** Both panes and the breakdown call `usePathwayComplexity({majorSlug:'ma-cs'})`. One cache entry. One request.
- **No new claim.** `cells` is `paperEntries`, the figure's own function. Therefore `delta(p2, p1) = deltaOurs − deltaPrinted`, which is *exactly* `paperEntries(data,'diff').delta` — the figure's own third view. **The overlay reproduces a number the figure already computes.** It cannot say something the figure does not.
- **Figure change:** one prop + one export + one static.

**`breakdowns/MaComplexityFigure6.jsx` — props and content**

```jsx
export default function MaComplexityFigure6({ comparison, panes, delta, selectedCell, onSelectCell })
```
Calls `usePathwayComplexity({majorSlug:'ma-cs'})` — same hook, same cache entry — and renders, each number read from an artifact path, never a literal:

| Block | Source path in `server/data/ma/complexity-validation.json` |
|---|---|
| Reproduction verdict: *N of M pathways reproduce their published score exactly; mean Δ …* | `coreq_treatment.with_coreqs.{exact, compared, mean_delta}` |
| Method note: coreqs-as-edges is their treatment, and dropping them collapses agreement | `coreq_treatment.without_coreqs.*`, `coreq_treatment.chosen`, `method` |
| **Cells the printed figure contradicts in their own file** — *Springfield Technical × UMass Amherst prints −28 while their own Curricular Complexity tab computes +34; our recomputation reproduces their 219 exactly* | `figure_cell_misses[]` — `{uni, cc, printed_delta, tab_delta, note}` |
| **Typed scores that drifted** — *Bridgewater (resident) published 160, their own sheet computes 164; because it is a **resident** score it shifts Bridgewater's entire column of deltas* | `misses[]` — `{pathway, ours, theirs, delta, tab_credits, their_published_hours, tab_drifted}` |
| **What the drift does to their headline** — *"+15" is 15.94 over scored pathways but 10.34 over all pathways* | `headline_plus_15.{over_scored_pathways, over_all_pathways}` |
| **Per-cell receipt** (driven by `selectedCell`) — published score, published resident, our score, our resident, and the resulting two deltas | `pathways[]` — `{pathway, uni, cc, ours, theirs, their_hours}` |

Rendering: a verdict-chipped ledger sorted by |Δ| descending, each row expandable to the receipt, coloured with `CA_DIFFERENCE_COLORS`. Whole panel `data-export-exclude` — on-screen only, exactly like `PaperCreditLoss`'s `DifferenceHeatmap` (`:743-816`). Clicking a row calls `onSelectCell`; clicking a cell in the overlay scrolls this panel to the matching row.

**The meeting sentence this produces**, with Tybalt's own note under it: *their printed Figure 6 contains a cell their own workbook contradicts by 62 points, a drifted resident score that shifts an entire university column, and a headline "+15" that is 10.34 when computed over the population they claim.* Every number on screen traces to a committed artifact path; the argument is his.

### 6.3 The other seams

| Adding a… | Cost |
|---|---|
| **breakdown** | one component + one `BREAKDOWNS` entry. Nothing else. |
| **knob** | one `viewKnobs` entry + one `useState` seeding + the prop name in `Component.viewProps`. Old fingerprints keep resolving because defaults are **elided** (§7.1). |
| **comparable figure** | `comparable: {grain, unit, tolerance, useData, cells}` — where `useData` is the figure's existing hook and `cells` may only call the figure's exported functions. |
| **figure** | **zero compare-code changes.** The picker is `ANALYSES`. Availability, editorial exclusions and per-state copy keep working through `resolveAnalysisAvailability` and `stateTitles`/`stateDescriptions`. It panes and takes notes with no `comparable` at all. |
| **state** (Maryland) | **zero frontend changes.** Add `md-cs` to `server/config/majors.js` with its `state` stamp and capabilities. `configuredStates()` derives it, `?state=all` returns it, the Major selector is built from that response, and whether it cell-aligns or falls to the distribution lens is decided by whether its keys intersect — a data fact. `registry.js` already carries `stateTitles.md`/`stateDescriptions.md` on `paper-district-heatmap`. |
| **major** (CA) | one config entry. It lands in the picker and cell-aligns against its CA siblings. |
| **comparability rule** | one object appended in `comparability.js`, pure over `(panes, majors)`. |

**The invariant that must never be extended:** no figure implementation is ever copied, wrapped, or forked for the workspace, and nothing the workspace renders is ever a registry figure. If a comparison needs a fused form, that is a new `ANALYSES` entry with its own `MEASURES` entry.

---

## 7. Canonicalization details that make it durable

### 7.1 `fingerprintOf(pane)` — mirrored byte-for-byte in `viewKnobs.js` and `server/services/comparisons.js`

1. Drop knobs whose `appliesWhen(major)` is false.
2. Drop knobs the figure does not declare (surface them as a stale-knob chip, §7.2).
3. **Elide any knob equal to its declared default.** ← the migration-safety trick. Adding a new knob does not re-address any existing pane.
4. Booleans serialize `1` / `0`.
5. Sort keys; join `k=v` with `&`.
6. `` `${figure}@${major}${entries.length ? '?' + entries.join('&') : ''}` ``

`pathway-complexity@ma-cs` (source=published is the default) · `pathway-complexity@ma-cs?source=ours`

### 7.2 Stale-knob banner — shipped in increment 1, not as polish

A stored pane naming a knob the figure no longer declares renders an **amber chip** — *`Pinned control "ma_ge" no longer exists — showing the figure's default`* — and the figure falls back to its own default. Silently ignoring an unknown key would let a meeting exhibit quietly render the wrong thing. A pane with no `viewKnobs` at all renders a neutral *`not pinned — showing figure defaults`* chip, so the document never claims a state it did not set.

### 7.3 `rekey(comparison, { figure, renames })`

A one-shot migration helper exported from `viewKnobs.js`, written **before the second figure declares knobs**, not after the first notes are stranded. Rewrites `panes[].knobs` keys and recomputes fingerprints for a named figure. Because identity is the slug, this only refreshes the discovery index — it can never lose a note.

---

## 8. Build order

### Increment 1 — the MA Figure 6 exhibit, end to end *(one sitting; usable at the meeting)*

**Server:** `services/comparisons.js` · `controllers/Comparisons.js` · 8 routes in `routes/api.js` · `services/comparisons.test.js`.
**Frontend:** `App.jsx` (import + 3 registrations) · `compare/{ComparePage, ComparisonWorkspace, ViewPane, PaneBuilder, CellSource, viewKnobs, comparability, delta, DeltaOverlay, JoinReceipt, VerdictDrift, ComparisonNotes}` · `breakdowns/{registry, MaComplexityFigure6}` · `useComparisons.js` · `shared/hooks/useDeferredMount.js` · `client.js` persist exclusion.
**Figure:** `PathwayComplexity.jsx` — export `paperEntries`, add `defaultPaperView`, add `viewProps`.
**Registry:** `viewKnobs` + `comparable` on `pathway-complexity` only.
**Tests:** `viewKnobs.test.js`, `comparability.test.js`, `delta.test.js`, `ComparePage.test.jsx`.

Scoped to one figure and one major, so the pane builder is a short list, not a cross-state picker. Ships with: `?panes=` drafts (no ceremony), notes writable, `verdict_at_pin` + drift banner, stale-knob chip, join receipt, save + `?cmp=` reopen, the Figure-6 breakdown.

**What Tybalt walks in with:** `?view=compare&cmp=ma-fig6-printed-vs-workbook` — the printed figure and our recomputation, the ranked per-cell disagreement, the ledger showing the cell their own tab contradicts by 62 points and the resident score that drifted a whole column, and his own written note under it.

**Deliberately NOT in increment 1:** `?state=all`, the Saved gallery lanes, cross-state, cross-major, distribution lens, print mode.

### Increment 2 — Figure 3 and the evidence endpoint *(small, deliberately lands before the meeting too)*

`GET /api/ma/evidence` in `controllers/Massachusetts.js` (serving the already-committed `pdf-reconciliation.json` + `figure-ledgers.json`, required at module load) · `useMaEvidence` · `breakdowns/MaFig3Reconciliation.jsx` — the 61-pair ledger sorted by |Δ|, each row carrying `their_typed_fraction`, `their_typed_as_total` vs `as_sheet_total`, `workbook.{removed_units, credited_units, ceiling}`, the `verdict` chip (`agrees` / `tally-drift` / `above-ceiling`) and the written `explanation`, plus `denominator_audit` as a header note. Five `default*` props + `viewProps` on `TransferCreditRate.jsx`; `viewKnobs` + `comparable` on the registry entry (adapter imports the already-exported `maSourceValue` / `rateForScope` / `MA_AS_SIDE_SCOPE`).

Also here: **`MaComparisonPanel.jsx` is refactored to render the shared ledger**, and its hardcoded `38.2%` at `:71` becomes `ledgers.fig1.mean_ours`. The displayed value is **unchanged** — `figure-ledgers.json` carries `fig1.mean_ours: 38.2` — only its provenance moves from a JSX literal to the committed artifact. This is the artifact-path rule made concrete and the operational form of the "no stat tiles from constants" house rule. One implementation, two hosts; the Massachusetts tab does not become a lesser second front door.

### Increment 3 — the full picker: majors and states *(R2, and the mechanism for R3)*

`?state=all` in `serializeMajors` **and** `configuredStates()` + the `majors.test.js` regression · `useMajors({state:'all'})` in `PaneBuilder`, grouped by state (this is where *"only CA has multiple majors"* is **derived**, never hardcoded) · `viewKnobs` + `comparable` + `coverageQueryArgs` on `coverage-heatmap` · the `unitCoverage` lens rule with its fix text · `ComparisonGallery` (Saved sub-tab, lanes by `kind` with **complete Tailwind literals** in a META map, never interpolated — the v4 source-scan constraint) · "Notes on related views" discovery via `?fingerprint=` · anchored notes wired to clickable overlay cells · `rekey` helper.

Cross-major CA (cs/bio/econ) cell-aligns here because those majors share the district × campus key space. Cross-state panes are *assemblable* and correctly classified `same-measure / disjoint`, with the overlay honestly reporting "cell diff refused" until increment 4.

### Increment 4 — cross-state, honestly *(R3 — check in before building)*

The only measure that survives `unitCoverage:false` on both `ma-cs` and `va-cs` is `pct_named_requirement_courses` (verified: the field `MaComparisonPanel` already uses; the unit-lens fields are NULLed server-side at `pathways.js:935-944`). For `disjoint` panes the overlay becomes a **distribution comparison**: ECDF per pane on one shared axis, a quantile ladder (p10/25/50/75/90), a mean/median/IQR delta strip, and a **permanent caveat band naming both key spaces and their n**.

**This is the nearest neighbour to the deleted `CompareCampusCoverageSpread`, and it needs an explicit check-in with Tybalt before it is built, not after.** The difference that makes it defensible: it is overlay chrome inside a comparison document with his note attached, `data-export-exclude`, never a registry figure, never publishable — not a new fused chart in the gallery. Say that out loud when asking.

### Increment 5 — polish, on direction

More breakdowns as Tybalt names the pairings (`reproduction-report.json`'s 26 named course-level drifts for the Fig-1 pairing; `figure-ledgers.json`'s fig2/fig4/fig5; the CA `paperDistrictBaseline.js` agreement stats). Per-overlay PNG/PDF via the existing `exportAnalysisCard` (`[data-export-root]` on the overlay; verdict strip, controls, join receipt, breakdown and notes rail all `data-export-exclude`, so a downloaded file is the figure alone with LaTeX supplying the caption). A `@media print` block in `styles/console.css` so ⌘P emits the whole comparison with figures inline. Fix `usePathwayComplexity`'s query key (`useData.js:148`) to carry the `analysis-` prefix — a six-pane workspace is exactly where its missing IndexedDB exclusion and missing curated-save invalidation bite, and its own comment already claims the behaviour the prefix would give it.

---

## 9. Explicitly DEFERRED, and why

| Deferred | Why |
|---|---|
| **Any new registry figure or `MEASURES` entry** | This is the failure mode that got the last work deleted. The tool renders panes and overlay chrome. A fused form is commissioned separately, on precise direction. |
| **The three removed cross-major figures** (count-fusion district grid, credit-rate spread heatmap + scatter, Fig-3 distribution overlay as a figure) | Standing instruction from 2026-07-24. Not rebuilt, and no increment contains their computations. `SpreadMatrix` (max − min) is specifically not built at any point. |
| **A `compare` provenance lane in the Visuals gallery** | The removed work added one. Compare is its own tab; the gallery's three lanes and their `archived` flags are untouched. |
| **`comparison_revisions` / edit history** | `REVISIONED_KINDS` is deliberately `['as_degree','degree']` — verified research artefacts. A comparison is team working state like a task or a published figure; neither carries revisions, and both revision-history routes are `requireAdmin`, which would defeat a tool whose point is that Tybalt writes freely in it. |
| **Publishing a comparison as a figure** | Publishing freezes bytes and is an allowlisted renderer path. A comparison is deliberately live. |
| **Whole-workspace image export** | `exportAnalysisCard` clones one `[data-export-root]`; exports are the figure alone. Print mode (increment 5) covers the handout case. |
| **Shared colour scales across panes** | Two heatmaps at half width compute their scales independently, so identical colours can mean different numbers. Faking a shared scale needs a new prop on every heatmap. The comparability line names the measure mismatch; the scale mismatch is deferred rather than faked, and the collapsed-source-panes default keeps it out of the way. |
| **Per-user preferences / saved layouts** | There is no per-user server store in this codebase and this does not introduce one. |
| **Server-side validation against the figure registry** | Would mirror `ANALYSES` on the server and rot. Shape validation only; unknown figure ids fail closed client-side through `getAnalysisById() → null`. |
| **Cross-figure comparison** (two different `figure` ids in one comparison) | `incomparable / refused`. Different figures compute different things; a delta between them is meaningless. |
| **The census program** | Out of scope by construction. Nine majors at once, or the full UC+CSU × CCC × every-major distribution, is a chart problem, not a document problem. This tool will host and annotate those figures; it will not have helped build them. |

## 10. House rules held, explicitly

- **Notes are user-authored, absolutely.** Claude builds the store, the endpoints, the rail, and the placeholder. The store ships with **zero rows**. No seeded content, no example prose in Mongo, no AI-written, -rewritten, or -removed note, ever. Text is stored byte-exact; authorship is stamped server-side; the metadata `PATCH` structurally cannot touch `notes`.
- **No stat tiles derived from constants.** Every displayed verdict number is either computed live from the join or read from a named artifact path. `MaComparisonPanel`'s `38.2%` literal is retired to `figure-ledgers.json → fig1.mean_ours` — same value, real provenance.
- **No verified figure is silently changed.** The only value touched anywhere is that `38.2%`, and it is provably identical.
- **No commits until the increment is fully implemented; branch or ask before pushing to main; no `Co-Authored-By: Claude` trailer.**
- **New patterns named, not slid in.** `comparisons` is the first server-side saved-view store in this codebase — team-visible, per-author ownership, on the audit handle, everyone-equal to create and edit, author-only for note edit/delete, author-or-admin to delete a comparison. Right for a three-person team; worth confirming rather than assuming. `?cmp=` / `?panes=` are the first URL-routed non-major view state; today only `?view=` and the gallery's `?major=` are routed.

**Files read for verification:** `frontend/src/visuals/VisualsPage.jsx`, `analysisAvailability.js`, `analysisVisibility.js`, `frontend/src/analyses/{registry,PathwayComplexity,TransferCreditRate,CoverageHeatmap,californiaFigureStyle,maHeatmapColors}.jsx|js`, `frontend/src/massachusetts/{MassachusettsPage,MaComparisonPanel}.jsx`, `frontend/src/shared/{urlState.js, majors/useMajors.js, query/{client,keys}.js, query/hooks/useData.js}`, `frontend/src/{App,DataPage}.jsx`, `frontend/src/components/{SubNav.jsx, ui/index.js}`, `server/{routes/api.js, config/majors.js, controllers/{Majors,Massachusetts,Analysis,helpers}.js, services/{figures,tasks,displayNames}.js}`, `server/data/ma/{complexity-validation,pdf-reconciliation,figure-ledgers}.json`.
