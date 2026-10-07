# California paper workspace migration

The Income Gate and The Computing Bottleneck now have a dedicated private
application and repository at `../ca_transfer_paper`.

- [Open the new project's README](../../ca_transfer_paper/README.md)
- Local website: http://127.0.0.1:4310 (private password in the new project's `server/.env`)
- [Data migration details](../../ca_transfer_paper/docs/migration.md)
- [Scientific baseline comparison](../../ca_transfer_paper/analysis/reports/baseline-comparison-baseline.json)
- [Source extraction manifest](../../ca_transfer_paper/docs/extraction-manifest.json)

The complete stored CA-to-UC corpus is copied into the independent local
`ca_transfer_paper` database: 120,293 agreements, 138,606 courses, 124
institutions, 529 admissions records, CA curation and all 50 historical
reviews. The original databases were not modified. A 600-agreement saved
audit round and the 95-case course-evidence worklist are ready in the new
workspace; human verification remains to be done.

Both paper generators ran against the new database and reproduced every
scientific value in the existing figure artifacts. One retained empty test
fixture is now explicitly excluded, changing only the scanned-row count by
one. Source accuracy and ASSIST completeness are separate audit work.

The two gallery entries, renderers, paper-only snapshots/worklist, generators,
taxonomy and exploratory probes have been removed here after preservation
in the new project. Methods-note redirects preserve existing documentation
links. The original code is also saved in the new project's private extraction
archive with checksums.

Shared eligibility code, major configuration and covariates remain here for
the other papers. `analysis/data/course_repairs.v2.json` remains a **frozen
July reference** because existing MA/VA paper-planning scripts consume it;
the new project owns the active generated artifact. Unrelated working-tree
changes were preserved.
