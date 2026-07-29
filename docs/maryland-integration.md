# Maryland (ARTSYS) — local integration

A second state, wired in as an isolated view so it can be explored without
touching the California console, and removed in one commit if it isn't worth
keeping. Feasibility background is in
[`state-expansion-feasibility.md`](state-expansion-feasibility.md); the scraper
is documented in [`server/services/artsys/README.md`](../server/services/artsys/README.md).

## Running it

```bash
cd server && npm run artsys:import:local   # writes artsys_* into local pmt_research
cd server && npm run dev:local             # API against local mongo
cd frontend && npm run dev                 # console at :5173 -> "Maryland" tab
```

The import reads only the on-disk page cache (`server/.artsys-cache/`, 10,417
pages), so it makes no network requests and can be re-run freely. It writes to
whatever `MONGO_URI`/`DB_NAME` point at — the `:local` script pins them to
`mongodb://127.0.0.1:27017` / `pmt_research` so a stray run cannot reach Atlas.

## What was added

**Nothing existing was modified except four insertions in two files.**

| New | Purpose |
| --- | --- |
| `server/services/artsys/` | scraper: fetch · parse · transform · tests |
| `server/scripts/importArtsys.js` (+ test) | corpus → `artsys_*` collections |
| `server/scripts/enrichArtsys.js` | second pass: sending-course units, catalog text |
| `server/controllers/Maryland.js` | read-only API over `artsys_*` |
| `server/routes/maryland.js` | router, mounted at `/api/md` |
| `frontend/src/maryland/` | `MarylandPage.jsx` + `useMaryland.js` |
| `server/test/fixtures/artsys/` | committed real-HTML fixtures |
| `docs/state-expansion-feasibility.md` | the nine-state review |

| Modified | Change |
| --- | --- |
| `server/routes/api.js` | 1 line: `router.use('/md', require('./maryland')(guarded))` |
| `frontend/src/App.jsx` | 4 insertions: import, `'maryland'` in the view set, a tab entry, a render branch |
| `server/package.json` | `artsys:*` scripts, `cheerio` dependency |
| `.gitignore` | ignores `server/.artsys-cache/` |

## Isolation

- **Separate collections** — `artsys_institutions`, `artsys_courses`,
  `artsys_agreements`, `artsys_import_meta`. Nothing writes to `assist_*`; an
  integration test asserts an import cannot even create an `assist_` collection.
- **Separate id namespace** — `md:cc:`, `md:uni:`, `md:crs:`, `md:agr:`. A
  careless `$unionWith` or a combined export cannot collide a Maryland college
  with a California one on a shared small integer.
- **Separate routes** — everything under `/api/md`, using the same auth guard
  as every other route.
- **Separate frontend view** — its own top-level tab, not a mode inside Data.
  The two corpora have different id grammars, institution vocabularies and
  major lists; a merged browser would have to disambiguate state on every row.
- **Separate query keys** — all prefixed `md`, so no cache entry is shared.
- **Read-only** — the corpus is script-imported, not curated. There is no write
  path to get wrong.

## Reverting

```bash
rm -rf server/services/artsys server/test/fixtures/artsys frontend/src/maryland
rm server/scripts/importArtsys.js server/scripts/importArtsys.test.js server/scripts/enrichArtsys.js
rm server/controllers/Maryland.js server/routes/maryland.js
rm docs/state-expansion-feasibility.md docs/maryland-integration.md
rm -rf server/.artsys-cache
```

Then remove the `/md` mount from `server/routes/api.js`, the four `maryland`
insertions from `frontend/src/App.jsx`, the `artsys:*` scripts and `cheerio`
from `server/package.json`, and the cache line from `.gitignore`.

Drop the collections:

```bash
mongosh "mongodb://127.0.0.1:27017/pmt_research" --eval \
  'db.artsys_institutions.drop(); db.artsys_courses.drop(); db.artsys_agreements.drop(); db.artsys_import_meta.drop(); db.artsys_prerequisites.drop()'
```

Nothing else references any of it.

## Reading the numbers

Two figures on the Colleges tab mean different things and only one is a gap
measure:

- **Complete rate** — the vendored eligibility engine's verdict, the same code
  the California analyses use. Honours choose-N logic. **This is the one to read.**
- **Missing-entry rate** — every receiver ARTSYS marks not-articulated. This
  **includes unchosen alternatives** in satisfied choose-one lists: a language
  requirement listing fifteen options marks fourteen "not articulated" for a
  college that needs one, and none is a gap. Shown because it is what the
  documents literally say, not as a measure of unmet requirements.

## Known limits of the corpus

- ARTSYS lists 20 receiving institutions; **13 have a populated guide**. Hood's
  are all empty stubs; Bowie State, Coppin State, Goucher, Notre Dame of
  Maryland and Mount St. Mary's have none. UMB's absence is correct — it is the
  health-professions graduate campus.
- Heavily skewed: Salisbury 2,312 agreements, UMBC 1,530 … **UM College Park 68**.
  A "statewide Maryland" claim built on this is really a claim about five
  institutions.
- Sending-course units are `null` until `artsys:enrich` runs; receiving units
  are reliable from the guide page.
- Guides mix general education and electives with major preparation, so
  Maryland completion levels are **not** comparable to California ASSIST
  completion levels without restricting to major-specific groups.
