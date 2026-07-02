# PMT Research Console

Research-facing variant of the Plan My Transfer tooling, built for a CS transfer-pathways
research project (replicating and extending the analyses in the SIGCSE CA/MA transfer
papers on our ASSIST-derived dataset).

**This repo never touches the production Atlas cluster.** It runs against a dedicated
research cluster seeded with a versioned, curated subset of the data (selected majors
only), so research partners can browse, audit, curate, and export without access to
production data or infrastructure.

## What lives here

| Path | Purpose |
| --- | --- |
| `server/` | Trimmed Express API: read routes, audit stack, admin, curation, analysis/export |
| `frontend/` | Web console: audit workbench (Judge · Review · Stats) + admin (dataset, access) |
| `scripts/` | `port.py` (incremental major porting), `merge_verdicts.py` (end-of-project) |
| `notebooks/` | `paper_figures.ipynb` — reproduces the papers' figures from the analysis API |

## API surface (all allowlist-gated)

- Reference reads: `/community-colleges`, `/schools`, `/uc|csu-agreements-batch/:cc`,
  `/courses/:cc`, `/university-courses/:uni`
- Audit: `/audit/*` (same stack as the internal tool: verify, tiers, templates,
  stats, matrix, groupings)
- Curation: `/curation/categories`, `/curation/receiver-overrides`,
  `/curation/prereqs`, `/curation/assoc-degrees`, `/curation/ref/:table`
- Analysis (JSON or `?format=csv`, stamped with `dataset_version`):
  `/analysis/coverage`, `/analysis/credit-loss`, `/analysis/choice-cost`
  (`?schoolIds=` ordered), `/analysis/category-gaps`, `/analysis/complexity`,
  `/analysis/time-to-degree`, `/analysis/raw/:collection`
- Admin (ADMIN_UIDS only): `/admin/dataset`, `/admin/access` (+ `/access/me` for all)

## Key design points

- **The cluster stores only what the project needs.** `scripts/port.py` incrementally
  `add`s/`remove`s majors (agreements + only the catalog docs they reference). It runs
  on the admin's machine — the hosted server never holds source-cluster credentials.
- **Versioned changelog.** Every port operation bumps `dataset_version`
  (`YYYY-MM-DD-vN`) and appends to `dataset_changelog`, so analyses, exports, and audit
  verdicts are attributable to an exact dataset state.
- **Join-compatible audits.** Porting preserves original agreement `_id`s and receiver
  `hash_id`s, and audit verdicts carry `dataset_version` + `verdict_origin: 'research'`,
  so verdicts recorded here can be merged back into the production audit store at the
  end of the project via a manual script.
- **Two roles.** Admins (`ADMIN_UIDS` env) manage the dataset view and partner access
  from the app (`access_grants` collection — no redeploy to add a partner). Partners
  get the audit/curation/analysis surfaces only.
- **Export-first analytics.** The frontend offers canned exploratory views; publication
  figures come from notebooks against the CSV/JSON export endpoints.

## Setup

### Server

```bash
cd server && npm install
cp .env.example .env   # fill in Mongo URIs, Firebase admin creds, ADMIN_UIDS
npm run dev
```

### Frontend

```bash
cd frontend && npm install
cp .env.example .env   # VITE_API_URL, VITE_FIREBASE_*, VITE_GOOGLE_OAUTH_CLIENT_ID
npm run dev            # http://localhost:5173
```

### Porting data (admin, local machine)

```bash
cd scripts
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # SOURCE_* (your full dataset), TARGET_* (research cluster)
python port.py init
python port.py list "computer science"
python port.py add "computer science"
python port.py status
```

### End of project

```bash
python scripts/merge_verdicts.py --dry-run   # fold partner verdicts into the main audit store
```
