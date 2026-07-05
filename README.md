# Transfer Pathways Research Console

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

## API surface (all allowlist-gated; UC-only)

Every data read is scoped server-side by **partner major visibility**: admins see
all ported majors; partners see only the majors checked in Admin → Partner major
access (deny-by-default).

- Reference reads: `/community-colleges`, `/schools`, `/uc-agreements-batch/:cc`,
  `/courses/:cc`, `/university-courses/:uni`
- Audit: `/audit/*` (verify, tiers, templates, stats, matrix — no stale queue or
  groupings on this console; the visible-major subset is the scoping mechanism)
- Curation: `/curation/categories`, `/curation/receiver-overrides`,
  `/curation/prereqs`, `/curation/assoc-degrees`, `/curation/ref/:table`
- Analysis (JSON or `?format=csv`, stamped with `dataset_version`):
  `/analysis/coverage`, `/analysis/credit-loss`, `/analysis/choice-cost`
  (`?schoolIds=` ordered), `/analysis/category-gaps`, `/analysis/complexity`,
  `/analysis/time-to-degree`, `/analysis/raw/:collection`
- Figures: `/figures` (static publish/list/download) and `/figure-scripts`
  (live figures — publish/view/refresh/enable/detach; see below)
- Admin (ADMIN_UIDS only): `/admin/dataset`, `/admin/access`,
  `/admin/visible-majors`, `/admin/figure-runner` (+ `/access/me` for all)

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
  figures come from partner scripts against the CSV/JSON export endpoints.
- **Live figures.** A published figure can carry its script:
  `pmt.publish_script("fig.py")` dry-runs the file server-side and, on success,
  re-runs it automatically after dataset ports and curation changes, so the
  gallery tracks the data instead of going stale. See below.

## Live figures (partner scripts the server re-runs)

Static publishing (`pmt.publish(fig, slug, title)`) is unchanged and remains
the right choice for frozen, submitted-paper figures. Live mode is opt-in per
figure:

1. Write an ordinary script locally — `import pmt`, `fetch(...)`, pandas,
   matplotlib, ending in one `pmt.publish(...)` call. Iterate until it looks
   right.
2. `pmt.publish_script("fig.py")` — the server runs the file in a sandbox
   immediately and replies in your terminal with the run log (pass) or the
   traceback (fail; nothing is published). Slug/title come from the
   `publish()` call inside the script — the same file works on your laptop.
3. From then on the script re-runs automatically: after `port.py` bumps
   `dataset_version` (server polls every 5 min), after curation/audit writes
   (debounced 15-min sweep), on the card's Refresh button, and at boot for
   stale figures. Failures keep the last good render, badge the card amber,
   and 5 consecutive failures auto-disable the script (re-enable after fixing).

Rules for live scripts: self-contained top-to-bottom file, token from the
`PMT_TOKEN` env var (never hardcoded — uploads containing a `pmtr_` literal are
rejected), exactly one `publish()` call, no local file dependencies, imports
limited to `server/runner-requirements.txt` (pandas, numpy, matplotlib,
requests) plus the stdlib. Run credentials are **read-only**: scripts can
fetch anything in the author's scope but cannot write audit/curation state or
publish over HTTP (the runner captures `publish()` itself). Iterating locally
on the same file keeps working — the author (or an admin) may `pmt.publish()`
statically onto their own live slug; anyone else gets a 403.

Execution model: subprocess with a from-scratch environment (no server
secrets), data access only through this same API with a short-lived token
minted as the figure's author (so major-visibility scoping applies unchanged),
60–120 s wall-clock kill, capped output, one run at a time. Every console user
can read any live figure's code ("View code" on the card); logs and controls
are owner/admin. Admins can pause all scheduled refreshes in Admin → Live
figure runner. This is isolation for trusted collaborators, not a hard
sandbox — the deploy needs `python3` (see `nixpacks.toml`,
`railway.json` buildCommand, and `PYTHON_BIN`; local dev uses `python3` on
PATH or `PYTHON_BIN` in `server/.env`).

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
python import_cc_districts.py        # optional geography ref table for district/county analyses
python import_uc_transfer_requirements.py  # paper hard-requirement ref table
python port.py status
```

### End of project

```bash
python scripts/merge_verdicts.py --dry-run   # fold partner verdicts into the main audit store
```
