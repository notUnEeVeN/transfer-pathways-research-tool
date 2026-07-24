# Biology associate-degree research

This directory is the restart point for the statewide Biology associate-degree
deep dive. The research cohort is pinned to **academic year 2025-2026** so it
matches the latest complete ASSIST year. A newer catalog may be useful for
finding an archive, but its requirements must never be relabeled as 2025-2026.

Do **not** feed these files to `scripts/import_as_degrees.py`, which owns the CS
dataset. Completed Biology batches are compiled and published with
`scripts/import_bio_as_degrees.py`.

See [CHECKPOINT.md](CHECKPOINT.md) for the latest counts, completed college IDs,
known follow-ups, and exact next commands.

## Pinned cohort and scope

Biology is not limited to a regular A.S. plus an A.S.-T. The fast statewide
pass keeps all catalog-facing candidates and proposes one of three neutral
slots without erasing the original award:

| Slot hint | First-pass rule |
| --- | --- |
| `ast` | The Biology A.S.-T. actually published in the college's 2025-2026 catalog. |
| `local_as` | The closest general Biology/Biological Science(s) local A.S. |
| `local_other` | A general Biology/Biological Science(s) A.A.; specialized awards are ignored. |

Beginning with the second catalog batch, collect only general Biology or
Biological Sciences A.S.-T., A.S., and A.A. awards. Ignore pre-nursing,
allied-health, biotechnology, public-health, environmental-science,
natural/general-science, anatomy/physiology-only programs, certificates, and
other adjacent specialties. These are intentionally not retained as sourced
candidates; `out_of_scope_candidates` stays empty.

Every extracted A.S.-T. retains `tmc_version_seen`, but the active research
artifact contains only the prior Biology TMC used by the 2025-2026 catalog
cohort: biology sequence, chemistry sequence, calculus, physics sequence, and
optional additional major preparation. Biology 2.0 and other 2026-2027 inputs
are deliberately excluded until ASSIST advances to that cohort.

## Authoritative source hierarchy

Use one strong source per fact unless it is genuinely ambiguous:

1. **Statewide discovery:** the public COCI Programs Report, filtered to active
   Biology programs. It is currently in a posted maintenance window and also
   returned 403 during this pass, so the checked-in inventory uses the official
   California Community Colleges "I Can Go to College" Biology directory as a
   discovery fallback.
2. **Degree truth:** one official **2025-2026** college catalog page or catalog
   PDF for the exact title, award, active version, unit system, total, and
   requirements.
3. **Statewide A.S.-T. structure:** the applicable Chancellor's Office TMC form.
4. **Normalization only:** C-ID descriptors and ASSIST. Neither proves that a
   local degree exists.

Statewide sources:

- [Prior Biology Rev. 2 TMC](https://www.cccco.edu/-/media/CCCCO-Website/Files/Educational-Services-and-Support/TMC-Templates/tmc-biology-template-rev-2-ada.pdf)
- [COCI Public Programs Report](https://coci2.ccctechcenter.org/programs)
- [Official Biology discovery page](https://icangotocollege.com/college-courses/35547-as-t-in-biology)
- [C-ID descriptors](https://c-idsystem.org/descriptors/)
- [ASSIST](https://assist.org/)

## Resume workflow

The 115-college statewide inventory is one deterministic snapshot. Completed
catalog work is stored one college per file in `colleges/`, so an interrupted
session never invalidates another college and parallel batches do not collide.

```bash
# Refresh/resume official discovery. It checkpoints after each response.
python scripts/bio_as_research.py discover

# See exact progress and the next unresearched schools.
python scripts/bio_as_research.py status
python scripts/bio_as_research.py next --limit 10

# Create one source-preserving college record, then fill it from the catalog.
python scripts/bio_as_research.py scaffold --college-id 2

# Validate the inventory plus every completed/partial college checkpoint.
python scripts/bio_as_research.py validate

# Preview all completed 2025-2026 checkpoints against the local course data.
python scripts/import_bio_as_degrees.py --dry-run

# Publish only the just-completed batch to MongoDB and the local website.
python scripts/import_bio_as_degrees.py --college-id 2 --college-id 3
```

The live import is upsert-only: it does not delete other rows, and it skips any
row a person has saved—including an unverified draft—so incremental refreshes
cannot erase review work. It also writes
`scripts/data/as_degrees_bio_compiled.json` as a cumulative snapshot of all
Biology degree rows currently in the local database. Once the local server and
frontend are running, the rows appear under **Community colleges → Associate
degrees** after selecting Biology; no frontend rebuild is needed.

Research statuses:

- `inventory_only`: official statewide candidates captured; catalog not opened.
- `catalog_found`: exact college source found; requirements not yet extracted.
- `requirements_extracted`: at least one degree has complete raw structure.
- `needs_browser`: official page is blocked or requires manual interaction.
- `needs_scope_decision`: source is clear but the award does not fit the
  provisional comparison rule.
- `none_found`: the complete official college program index was checked and no
  in-scope Biology associate degree exists.

Do not infer `none_found` from a web-search miss or from the statewide discovery
directory. Record the full official program-index URL used for a negative.

## College record conventions

Each degree keeps:

- exact printed title and award;
- `degree_type_hint`, never treated as a final imported enum;
- `tmc_version_seen` and active/teach-out language when applicable;
- official 2025-2026 `catalog_url`, `catalog_year`, native unit system and total;
- one or more source objects with a checked date and useful locator;
- raw `major_groups` in the same `all`, `choose_courses`, `choose_units`,
  `ge_area`, and `electives` vocabulary used by the CS extraction;
- unresolved course citations verbatim rather than guessed ASSIST IDs.

Requirement extraction should favor speed: one clean official 2025-2026
catalog page is enough. Set a lower confidence or a follow-up note instead of
repeatedly searching for corroboration.

## Import boundary

Terminal records are compiled: `requirements_extracted` emits the catalog
degrees, while a sourced `none_found` result emits an explicit confirmed-none
row for each of the three slots. They use IDs of the form
`as_degree:<college_id>:bio:<slot>` and never collide with CS rows.
`template_ref` remains null until Biology comparison templates are ready, so
publishing source records exposes them to the review UI without prematurely
enabling transfer-credit analyses. Entirely unresolved course groups are
retained in extraction metadata and reported as warnings for human repair;
course IDs are never guessed.
