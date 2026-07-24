# Economics associate-degree research

This directory is the resumable source corpus for the statewide Economics
associate-degree pass. The cohort is pinned to **academic year 2025-2026** so
it matches the latest complete ASSIST year. Do not substitute or relabel a
2026-2027 catalog, even when it is the easier page to find.

## Scope

Collect only the general Economics **A.A.-T., A.S.-T., A.A., or A.S.** printed
by the college. Ignore business, business economics, accounting, and other
adjacent or specialized programs. Preserve the printed award in
`award_seen`; the neutral runtime slots are only storage categories:

| Slot | First-pass use |
| --- | --- |
| `ast` | Statewide Economics transfer degree (normally A.A.-T.) |
| `local_as` | General college-defined Economics A.S. |
| `local_other` | General college-defined Economics A.A. |

One official 2025-2026 college catalog source is sufficient for the fast
pass. Keep catalog choices and unresolved course identifiers verbatim for
human review instead of guessing.

## Resume workflow

Each college has an independent checkpoint in `colleges/`, so interrupted or
parallel work does not invalidate completed research.

```bash
python scripts/econ_as_research.py validate
python scripts/econ_as_research.py status
python scripts/econ_as_research.py next --limit 12
python scripts/econ_as_research.py scaffold --college-id 27

# Preview and publish only a completed batch to the local website.
TARGET_MONGO_URI=mongodb://127.0.0.1:27017 \
  python scripts/import_econ_as_degrees.py --dry-run --college-id 27
TARGET_MONGO_URI=mongodb://127.0.0.1:27017 \
  python scripts/import_econ_as_degrees.py --college-id 27
```

The importer is upsert-only and skips rows saved by a human. It writes the
cumulative snapshot to `scripts/data/as_degrees_econ_compiled.json`. Published
records remain `analysis_ready: false` until their choices and future
Economics four-year comparisons are hand-verified.

The inventory uses the official California Community Colleges “I Can Go to
College” Economics category as a discovery index. Degree truth always comes
from the college's own 2025-2026 catalog, with every verification URL embedded
in the corresponding college JSON file.
