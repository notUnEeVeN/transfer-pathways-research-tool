# Major-dimension foundation (F) — design

**Date:** 2026-07-22 · **Status:** approved
**Roadmap:** `2026-07-22-expansion-roadmap.md` — this is sub-project F.

## Goal

After F ships, the app behaves **exactly as today for CS** (only CS
onboarded → pixel-identical), but every major-touching surface reads from a
per-major config instead of a hardcoded CS constant. Onboarding Biology or
Economics (W1) then requires: run `port.py`, add a config entry, gather
degree templates — **no code hunt**.

## Non-goals

- No Bio/Econ data porting (W1).
- No cross-major comparison visuals, no state dimension (W2).
- No AS-degree validation tool (W3), no tasks changes (W4).
- No changes to frozen CS artifacts: paper baselines, transfer-minimum
  views/data, committed snapshot JSONs stay bit-identical.
- No AS-degree generalization beyond carrying `major_slug` through — the
  AS-degree subsystem stays CS-only (capability-gated).

## Architecture

### 1. Major config module — `server/config/majors.js`

Single source of truth for per-major metadata that currently lives as
scattered constants. One entry per onboarded major:

```js
{
  slug: 'cs',                     // stable key used in URLs, files, storage
  label: 'Computer Science',
  // Generalizes PAPER_MAJORS (pathways.js:289-306): per-campus program pins.
  // `program` is the EXACT ASSIST major string; alternates allowed for
  // campuses with several candidate programs (pick order = array order).
  programs: [
    { school_id: 'UCB', program: 'Computer Science, B.A.', alternates: [] },
    // … 9 campuses
  ],
  // Free-text matcher used by majorContains-style filters (case-insensitive
  // substring, same semantics as today's 'computer science').
  match: 'computer science',
  // Generalizes CANONICAL_CATEGORIES (Curation.js:7-12).
  categories: [
    { key: 'intro_programming', label: 'Intro programming', axis: 'computing' },
    // …
  ],
  broadAxes: ['computing', 'math', 'science', 'non_stem'],
  // Generalizes courseTypes.js CS prefix/regex sets for course-type figures.
  coursePatterns: { computing: /^(CS|CSE|…)\b/i /* … */ },
  // Which prereq-concept disciplines apply (concept graph already has
  // math/physics/chem/cs/bio/engr/stats/other).
  conceptDisciplines: ['math', 'cs', 'physics'],
  // Capability flags — what this major's data supports. Everything defaults
  // false; CS sets all true.
  capabilities: {
    asDegrees: true,        // AS-degree layer (views + figures)
    paperBaselines: true,   // CA/MA paper-comparison figures
    transferMinimums: true, // hand-gathered website minimums (CS legacy)
    snapshots: ['district-multi-campus-pathways', 'multi-campus-pathways',
                'district-portfolio-subsets'],
  },
}
```

Rules:
- v1 ships with the `cs` entry only, values copied verbatim from today's
  constants so behavior is provably unchanged.
- Regexes live in code (this is why it's a JS module, not JSON).
- Server helper `getMajor(slug)`, `listMajors()`, `defaultMajor()` (= first
  entry, `cs`).

### 2. `GET /api/majors`

Read-only endpoint (same guard stack as other data routes) returning the
serializable projection of the config: slugs, labels, programs, categories,
capabilities, match strings. **Regexes are serialized as source strings**
and rebuilt client-side by one shared util. The frontend fetches this once
(TanStack Query, long stale time) — no mirrored client constants file.

### 3. Server generalization (each keeps CS behavior via the config)

| Today (hardcoded) | Becomes |
| --- | --- |
| `PAPER_MAJORS` + `CAMPUS_SCHOOL_IDS` (`services/analysis/pathways.js:289-314`) | `getMajor(slug).programs`; `pin:'paper'` mode resolves pins from config |
| `/computer science/i` in `requirementComparisonData` (`pathways.js:940-941`) | major's `match` string passed in / derived from the requested major |
| `CANONICAL_CATEGORIES`, `BROAD_AXES` (`controllers/Curation.js:7-12`) | from config; `curated_mappings` `course_category` docs gain a `major_slug` field (existing docs backfilled `'cs'`) |
| CS prefix sets/regexes (`services/courseTypes.js`) | `getMajor(slug).coursePatterns` |
| `degree_type` fixed `{ast, local_cs_as}` (`controllers/Analysis.js:142-146,297-311`, `transferCreditRate.js:31`) | unchanged mechanics, but endpoint rejects majors without `capabilities.asDegrees` |
| `district-pathway-programs.v1.json` pins (`districtPathwayPlanner.js`) | file gains a `major_slug: 'cs'` field; loader selects by slug (per-major files arrive in W1) |
| Analysis endpoints accepting free-text `majorContains` | ALSO accept `major=<slug>` (preferred); slug resolves to `match`/programs server-side. `majorContains` kept for back-compat |
| `majorVisibility` one-pair-per-campus assumption | multi-pair: `visible_pairs` may hold several majors per campus; helpers return pair sets filtered by requested major slug when given |

### 4. Admin

- `MajorAccessPanel` (`frontend/src/AdminPage.jsx:238-323`) becomes a
  **majors × campuses grid**: rows = onboarded majors (from `/api/majors`),
  columns = campuses; each cell a checkbox (program name shown from config;
  select among alternates where they exist). Saves the same
  `[{school_id, major}]` shape via the existing `PUT /admin/visible-majors`
  — just without the one-per-campus rule.
- Server-side validation drops the one-major-per-campus enforcement.

### 5. Frontend — contextual major selection

- New shared `MajorPicker` component + `MajorProvider` context. The context
  holds the last-picked slug (sessionStorage-persisted) so pages default
  sensibly; every surface can still override locally. With exactly one
  onboarded major the picker renders nothing (today's UI unchanged).
- Surfaces gaining the picker:
  - **Data → Community Colleges:** above the agreements browser; agreements
    queries filter by the selected major's campus program names.
  - **Data → UC Campuses:** program selector where the single CS degree
    template renders today (degree docs are already keyed school+program).
    Transfer-minimum panels stay as-is, visible only for majors with
    `capabilities.transferMinimums`.
  - **Data → Prerequisites:** filter concept graph/tables to the major's
    `conceptDisciplines` (an "all disciplines" option remains).
  - **Audit tab:** scope line + verify flow carry the major slug (audit keys
    already include major; this is UI plumbing, not schema change).
  - **Visuals tab:** every analysis. The five free-text "Major filter"
    inputs (`CreditLoss`, `ChoiceCost`, `CategoryGaps`, `Complexity`,
    `TimeToDegree`) are replaced by the picker. The seven hardcoded
    `MAJOR_FILTER`/`majorContains` constants (`CoverageHeatmap`,
    `PaperDistrictHeatmap`, `IncomeAccess`, `CourseTypeCoverage`,
    `PaperArticulationHistogram`, `ArticulationCoverageMap`,
    `PaperCourseBarriers`) route through the picker instead.
- **Capability gating:** an analysis whose requirement a major lacks shows
  the picker locked to majors that support it (CS-only today for AS-degree
  figures — `TransferCreditRate`, `TransferExtraUnits` — and all
  paper-baseline figures). Locked state shows a short explanation line.
- `useData.js` hooks accept `major` (slug) and pass it through; default is
  the context's slug.

### 6. Snapshots — per-major artifacts

- Generator scripts (`generateDistrictPathwaySnapshot.js`,
  `generateMultiCampusPathwaysSnapshot.js`,
  `generateDistrictPortfolioSubsets.js`) take `--major <slug>` (default
  `cs`), resolve pins from the config, and emit `<name>.<slug>.v1.json`.
- Loaders resolve by slug; the existing CS files are **renamed to the
  slugged name in the same change as the loader** (or the loader tries the
  slugged name then falls back to the legacy name — pick one in the plan,
  do not leave both permanently).
- Snapshot validators derive expected program count from the config instead
  of asserting `9`.

### 7. Copy sweep

- `analyses/registry.js` descriptions and `measures.js` text parameterized
  ("the selected major") or made major-conditional where the sentence states
  a CS fact.
- `degrees/degreeSources.js` keyed `(school_id, major_slug)`; existing
  entries become the `cs` map.
- API docs (`apiDocs/content.js`): document `major=<slug>` params; CS-named
  export endpoints noted as CS-scoped.
- Showcase copy stays CS (it describes published CS work).

## Error handling

- Unknown major slug → 400 with the list of onboarded slugs.
- Major lacking a capability hitting a gated endpoint → 400 with
  `capability_required`.
- Frontend: missing/failed `/api/majors` falls back to a built-in `cs`-only
  stub so the console still renders.

## Testing

- Golden invariant: with only `cs` onboarded, every existing server test and
  frontend test passes **unmodified**, and key analysis endpoints return
  byte-identical payloads before/after (spot-check coverage, credit-loss,
  multi-campus snapshot routes).
- New unit tests: config resolution (slug→programs/match/categories),
  slug→`majorContains` equivalence, multi-pair visibility filtering,
  capability gating (403/400 paths), snapshot loader slug resolution.
- Frontend: MajorPicker hidden with one major; picker + gating rendering
  with a mocked two-major `/api/majors` response.

## Open items deferred to W1

- Choosing the canonical Bio/Econ program per campus (curation decision;
  config supports alternates).
- Authoring bio/econ category vocab + course patterns.
- Per-major snapshot generation.
