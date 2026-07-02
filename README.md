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
| `server/` | Trimmed Express API: read routes, audit stack, curation, analysis, export |
| `frontend/` | Web console: browse, audit workbench, curation workbench, canned analysis views |
| `scripts/` | Seed script (prod → research subset, versioned), verdict merge-back export |
| `notebooks/` | Starter notebooks reproducing the papers' figures from the export API |

## Key design points

- **Versioned snapshots.** The seed script stamps every copied document set with a
  `dataset_version`. Analyses and exports always carry the version; re-seeding creates a
  new version rather than mutating.
- **Join-compatible audits.** Seeding preserves original agreement `_id`s and receiver
  `hash_id`s, and audit verdicts carry `dataset_version` + `source: 'research'`, so
  verdicts recorded here can be merged back into the production audit store at the end
  of the project via a manual script.
- **Export-first analytics.** The frontend offers canned exploratory views; publication
  figures come from notebooks against the CSV/JSON export endpoints.

## Setup

_To be filled in as the pieces land._
