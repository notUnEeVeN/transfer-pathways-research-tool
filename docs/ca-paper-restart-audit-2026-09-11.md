# California paper restart: database reconciliation and audit plan

Checked September 11, 2026 (Japan time), against the configured local
`pmt_data` source and remote `pmt_research` application database. Database
operations were read-only. No imports, verdict updates, figure regeneration,
or code extraction were performed. The working tree already contained
unrelated changes, which were preserved.

**Recommendation:** give The Income Gate and The Computing Bottleneck their
own paper repository, while retaining this website as the shared data-review
platform. First establish a reconciled, versioned CA input and a reproducible
audit campaign. Rebuilding authentication, source inspection, and review
workflows in a second website would duplicate existing work.

## What is actually migrated

This investigation treats CA as the community-college-to-UC corpus used by
these visuals. The source also holds 245,422 CSU agreements; those are a
separate population and are not covered by these figures or this audit.

| Item | Source | Application | Finding |
| --- | ---: | ---: | --- |
| UC agreements | 120,293 | 3,105 | Full corpus has **not** been imported |
| Distinct UC campus/program-title pairs | 1,050 | 27 | App has nine campus pins each for CS, Biology, Economics |
| Agreements in those 27 selected pairs | 3,105 | 3,105 | 115 colleges per pair; no missing or extra business keys |
| Source CC course records | 100,461 | All 100,461 present | Original fields preserved |
| Source course records at the nine UC campuses | 3,903 | All 3,903 present | Original fields preserved |
| CA institutions | 115 CCs + 9 UCs | All 124 present | Institution identities present |

The app additionally holds 34,242 UC catalog records beyond the original
source catalog, plus other-state records. Its unfiltered totals (3,494
agreements, 140,701 courses, 195 institutions) must not be presented as CA
coverage. The 389 non-UC agreement records lack the `system: 'uc'` tag used for
the CA inventory.

Agreement comparison joined on `(community_college_id, uc_school_id, major)`
and applied the migration's canonical normalization. Across all 3,105 pairs,
there were **zero non-ID content differences** and all **45,905 receiver-hash
occurrences matched**. However, **all 1,035 CS agreement `_id` values differ**
between local source and app. Biology and Economics preserve their IDs.
This establishes current content equivalence for the selected subset, not
which historical operation changed the CS IDs. Preserve app review links
and construct a source/app ID crosswalk before expanding or merging data.

The app reports `canonical_dirty: false`, its canonical collections exist,
and its refresh marker is July 23. These are consistent with a completed
schema conversion of selected data. They do not establish a full-corpus
import, source completeness, or the date of every later curation change.
The local `pmt_research` development copy is older: 2,415 agreements and 28
reviews, with a July 11 refresh marker. It is not interchangeable with the
configured remote application database.

Machine-readable comparison results and file hashes accompany this note in
[`ca-paper-restart-audit-2026-09-11.json`](ca-paper-restart-audit-2026-09-11.json).

## What the template progress means

The meter measures audited receiving-template clusters in the selected audit
scope. It does not measure migration or independently reviewed college
articulation options. The current CA inventory is:

| Major | Agreements | Templates | Live document reviews | Templates with live reviews |
| --- | ---: | ---: | ---: | ---: |
| CS | 1,035 | 47 | 48 | 47 |
| Biology | 1,035 | 71 | 0 | 0 |
| Economics | 1,035 | 13 | 1 | 1 |
| Total | 3,105 | 131 | 49 | 48 |

There are 50 stored UC reviews: 49 live and one stale review of the removed
Berkeley `Computer Science, B.A.` pin. The 49 live reviews comprise 48
`correct` and one `conservative` verdict. The CS review count exceeds its
template count because two documents share a reviewed cluster.

Thus **48 / 131 = 36.6%** is the current whole-configured-CA template
coverage; CS alone has a review for every one of its 47 templates. The
reported “49 templates / 55%” could not be reproduced from this database
and current CA scope. It may reflect an earlier dataset, deployment, or
filter; the precise historical denominator is not established here.

Audit scope is restricted by configured program pairs, even if additional
agreements are present in MongoDB. Merely importing the remaining corpus
would not make the current audit view cover every UC major. See
[`majorVisibility.js`](../server/services/majorVisibility.js),
[`filters.js`](../server/services/audit/filters.js), and
[`CoverageMeter.jsx`](../frontend/src/pages/Audit/components/stats/CoverageMeter.jsx).

## Source completeness still needs its own audit

The local UC corpus has 113,871 agreements with nonempty requirement groups,
6,422 with empty groups, and 3,830 nonempty campus/program/raw-template
clusters. It has no duplicate college/campus/program business keys and no
missing raw-template, parser-output, or template fingerprints.

These checks establish internal structure, not completeness against ASSIST.
The next release must reconcile an authoritative program/college roster and
source capture manifest, including legitimate absences and renamed programs.
Specific findings to account for:

- One agreement is literally named `test comp sci` (Irvine, Santiago Canyon)
  and has no requirement groups. The snapshot generator skips it during
  analysis, and the name does not occur in the saved output. It still belongs
  in a documented exclusion ledger rather than a paper sampling frame.
- Twelve source course rows have synthetic-looking titles such as
  `Course 100`, belong to institution 77 outside the nine-UC roster, and use
  lowercase `uc`. They are correctly outside the catalog comparison above.
- Several sparse title pairs reflect Merced business-program name changes;
  a San Diego public-health title appears at only two colleges. These require
  source reconciliation, not an assumption that every title must have 115 rows.
- Agreement records do not carry a per-row academic year. The saved figure
  identifies the source as 2025–26; provenance should bind captures to that
  vintage rather than relying only on a figure label or a hard-coded ASSIST URL.
- Empty groups require explicit classification: genuine source emptiness,
  unavailable agreement, excluded program, or parser/capture failure. They
  should not silently disappear from the accuracy audit denominator.

## Repair the audit design before using its confidence claims

The existing review interface is reusable. Its current statistical bounds
should not support a paper accuracy claim without revision:

1. Random-template mode selects unaudited clusters in proportion to their
   document count, removing a whole cluster after review. Statistics then
   collapse random-document and weighted-template draws into unique
   templates, apply an unweighted interval, and translate it to document
   counts. Those sampling units and inclusion probabilities differ.
2. `wilsonUpperFinite()` shrinks only the Wilson margin. A concrete
   counterexample is 98 errors among 99 inspected units in a population of
   100: it returns a 97.4274% upper bound, although the known population
   error rate is already at least 98%.
3. Random draws/skips are not a durable, frozen campaign record. Verdicts
   are upserted per document; original findings and later corrections need
   separate records for a defensible before/after audit.
4. One receiving-template review does not independently verify every
   college's sending options. Likewise, receiver cells within the same
   agreement are not thousands of independent sampled agreements.

Evidence: [`App.jsx`](../frontend/src/App.jsx),
[`stats.js`](../server/services/audit/stats.js),
[`bootstrap.js`](../server/services/audit/bootstrap.js), and
[`Audit.js`](../server/controllers/Audit.js).
Probability-sample estimation must account for inclusion probabilities;
see [Statistics Canada's weighting guidance](https://www150.statcan.gc.ca/n1/edu/power-pouvoir/ch6/5214809-eng.htm).

A practical audit campaign should:

1. Freeze a named data release with source vintage, IDs/crosswalk, parser
   revision, counts, checksums, exclusions, and curated-input versions.
2. Run automated inventory, duplicate, foreign-key, hash, and structural
   checks over the entire declared population.
3. Draw and save a seeded probability sample of complete college agreements.
   Use explicit strata for campus, CS/comparison field, and district income
   where useful; record stratum population sizes and inclusion probabilities.
   Analyze estimates and uncertainty according to that design.
4. Maintain a separate diagnostic queue for rare/complex templates, empty
   records, and cases whose correction can change complete-path status.
   These purposeful checks improve data but are not an unweighted random sample.
5. Preserve all draws, unavailable/skipped evidence and reasons, original
   findings, source captures, corrections, reviewer identities, and
   adjudication. Independently double-code a prespecified subset. Validate
   the corrected release in a fresh round.
6. Report template coverage, agreement mismatch, false-open/false-closed
   eligibility classifications, and cell diagnostics separately. Diagnose
   differential error across income groups and CS versus comparison programs,
   because those differences can affect the paper even with low overall error.

For planning only, a simple binomial benchmark with zero observed errors has
one-sided 95% upper bound `1 - 0.05^(1/n)`: 300 checks give about 0.99%, 600
about 0.50%, and 3,000 about 0.10%. These are **agreement-level** benchmarks,
not guarantees, subgroup bounds, or formulas for the weighted-template
workflow. Final sample size and interval must follow the chosen design,
observed errors, and desired precision. See
[NIST's proportion-interval methods](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm).

## How to separate the paper without rebuilding the audit website

The two collections are static React/SVG renderers with a small UI dependency
and two JSON inputs. They can run in a small standalone paper application
without authentication or a backend. Their analysis generators are the more
important dependency boundary: both currently combine hard-coded local
`pmt_data` reads with app-side curated data.

| Move into the paper repository | Keep shared or consume as versioned inputs |
| --- | --- |
| `PriceOfPlace.jsx`, `PaperGate.jsx`, their tests and required styles | Database browsing, audit UI, authentication, team reviews |
| `priceOfPlaceSnapshot.json`, `course_repairs.v2.json` | The canonical full CA corpus and its audit releases |
| `course_match_codes.v1.json` and paper methods notes | Shared eligibility logic and program pins, pinned to a revision |
| Snapshot/repair generators and paper-specific course taxonomy | Income/geographic covariates also used by existing figures |
| Paper renders, captions, analysis runs and release manifests | Shared course, institution and curated-requirement maintenance |

Recommended order:

1. Preserve the July baseline artifacts and record their checksums/revision.
2. Create the standalone renderer from those artifacts; verify identical
   baseline numbers, controls and appearance. Add SVG/vector-PDF export if
   needed for publication (the current browser PDF exporter embeds a PNG).
3. Establish a full-CA reference release and separate audit-campaign scope
   in the existing platform. Keep ordinary figure scopes pinned to their
   configured majors; adding hundreds of majors to that registry is unnecessary.
4. Change paper generators to consume the frozen release or an explicitly
   configured read-only source. Scope institutions/minimums by CA and major;
   current queries are too broad for an expanding multi-state database.
5. After rendering and regeneration parity, remove the paper-only code and
   gallery entries here. Retain common covariates/engine code used elsewhere.

Do **not** use the old `port.py refresh-catalogs` / canonical rebuild blindly
on the current database. `sync_full_catalogs()` replaces source-shaped
staging collections, and `buildModel()` chooses imported catalogs instead
of preserving existing-only records when imports are nonempty. That would
discard the 34,242 additional UC records and other-state catalog rows.
Institution replacement and unconditional UC agreement normalization also
require review. A scoped staging/import plan must preserve enrichments,
other-state data, curation, and review identities before any cutover.

## Where to resume the research itself

The Income Gate snapshot was generated July 29, 2026. It summarizes nine CS
programs, 897 comparison programs and 72 districts in income quartiles of
18. The figures measure formal complete-transfer availability, not actual
admission or student outcomes. Income is contextual district-catchment AGI,
not student household income. Stated preparation is the like-for-like field
comparison; curated CS eligibility floors are a sensitivity.

Start with [`notes_income_gate.md`](notes_income_gate.md) and
[`notes_computing_bottleneck.md`](notes_computing_bottleneck.md). The most
concrete unfinished work is the **95-case course-equivalence evidence list:
all 95 cases remain uncoded**. Complete and independently check that work,
but account for its oversampled strata before interpreting pooled PPV as a
population estimate. Also audit the nine curated CS floors, admissions-name
joins, and ZIP-to-district income/geography assignment. Database parser
sampling alone cannot validate those paper-specific transformations.

Current audit edits do not update the committed figures automatically.
Regeneration should follow the reconciled release and recorded curation
changes so every changed headline can be traced to its inputs.
