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
| `server/` | Trimmed Express API: read routes, audit stack, admin, curation, analysis, export |
| `frontend/` | Web console: browse, audit workbench, curation workbench, canned analysis views |
| `scripts/` | `port.py` (incremental major porting), verdict merge-back export |
| `notebooks/` | Starter notebooks reproducing the papers' figures from the export API |

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
