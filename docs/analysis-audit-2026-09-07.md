# Data-to-figure audit — 7 September 2026

This audit traced stored requirements, course identities and credits through
the calculation services, generated figure artifacts, gallery controls,
comparison contracts, and displayed receipts. It found substantive errors and
corrected the implementation locally. It does **not** give every existing
research measure an unconditional publication clearance.

The configured research database was inspected read-only. Source records were
not rewritten in that database, and figures were not remotely published.
Virginia's local guide and figure artifacts were rebuilt from retained source
pages. Massachusetts's literal raw archive was preserved.

## Corrected findings

| Severity | Finding | Correction and evidence |
| --- | --- | --- |
| High | California unit coverage spread section credits equally over unequal-credit courses, even when individual credits were stored. | `degreeSlots.js` now sums covered receiver credits when they reconcile to a take-all section's authored budget. UCSB CS's four 4-unit courses count as **16**, not **16.8**, credits. Across 3,105 live degree-coverage cells, 81 CS and 239 Biology unit numerators change; the maximum change is 0.8 and 2.2 units respectively. Course-count numerators are unchanged. Genuine fractional catalog credits remain fractional. |
| High | Virginia's comparison adapters queried a different calculation from the guide snapshots shown in the gallery. Some controls were omitted when saving a comparison, and contracts equated different constructs. | Gallery and comparisons now select the same snapshot rows and retain supply, cohort, and measure settings. Contracts distinguish guide supply, estimated courses, unused associate credits, and hours above 120. |
| High | Virginia parsing removed restricted/major electives as if they were unrestricted padding. | The parser distinguishes actual free/general electives from major, senior, upper-level, and restricted electives. Retained guide pages and derived local artifacts were regenerated. |
| High | Explicit Virginia “does not transfer”/“no transfer credit” rows counted as applied credit. | Those credits remain in the sending-degree workload but are removed from applied credit. The lost-credit receipt is separate from unavailable-course credit, preventing double subtraction. |
| High | Massachusetts modeled bachelor completion presented inferred course pairings and synthetic four-credit requirements as ordinary valid results. | API rows carry `ma_model_evidence`, explanatory warnings, and `method_status: estimated`; the corresponding visual and comparison copy describes an approximation. All 61 nonblank modeled pairs are estimates. The archived/printed measurements remain separate. |
| High | Missing catalog credits became zero in the legacy credit-loss calculation and again in its chart. | 21 affected agreement solutions selected 23 distinct missing-unit IDs; three previously reported **one course / zero units**. Unknown totals now remain null and leave means/histograms. Course-count/proof uncertainty accompanies the result. The legacy rate/cost reader also preserves unknown units. |
| Medium | Davis Economics' two statistics alternatives were merged into one take-both section in the degree ledger. | `buildLedgerGroups` preserves `Or` sections. Named ASSIST-block satisfaction also reaches the ledger instead of contradicting the headline, and per-college catalog reads now honor the same degree course-unit overrides as the template view. |
| Medium | Virginia dropped the UCGS alternative in “Any UCGS course or PED 101 and HLT 110.” | The no-code UCGS option survives parsing. The old rule falsely denied 3 credits at 7 of 16 catalog colleges and 15 of 16 scheduled-course colleges. |
| Medium | Virginia counted a post-transfer credit-total row and zero-credit rows as courses; every coverage cell's `itemised_units` serialized as null after an earlier field rename. | Summary rows are excluded, zero credits do not invent a course, and the itemized total reads the current tally fields. Course conversions are explicitly described as estimates. |
| Medium | Bristol's Massachusetts AS degree contained a documented duplicate Human Expression row. | The modeled degree is **20 courses / 69 credits**, rather than **21 / 72**. The importer removes only the identified duplicate and its obsolete imported record; the literal raw workbook extraction remains unchanged. The stored database still needs this importer correction applied. |
| Medium | Massachusetts baseline/source text named older workbooks after adoption of the final workbooks. Complexity regeneration could replace archived results with final results under the archived label. | Source metadata now identifies the final workbooks. Complexity regeneration has separate explicit vintages and a check mode: archived aggregate **777**, final aggregate **715**, across 49 pathways each. |
| Low | The UC degree checker applied California-specific caps, GE ceilings, and catalog years to Massachusetts and Virginia, and returned success despite failing checks. | Its query now selects the nine UC campuses and CA corpus only, rejects non-CA major slugs, and exits unsuccessfully on actual failed checks. Empty optional policy fields no longer turn into numeric zero caps/floors. The documented district-portfolio npm command has also been restored. |
| Medium | Legacy course loading preferred malformed derived aliases over valid source aliases, and inserted missing-course placeholders into a catalog shared by subsequent solves. | 3,475 CA records had valid `same_as` objects alongside malformed `same_as_keys`. The actual aliases now remain usable, and placeholder catalogs are local to each solve. The modern pathway planner already had missing-catalog safeguards. |

The browser's persisted degree-cache version was bumped so old rendered
evaluations do not outlive these changes. Series-choice instructions now
respect choose-N asks, and named-block receipts preserve concrete sending
course options whenever they are available.

## What remains material for analysis

### Four California CS template inconsistencies

These are stored model issues, reproduced against the current research
database, rather than new calculation defects:

| Document | Current issue |
| --- | --- |
| `degree:144:cs` — Merced | 125 modeled units against a 120-unit minimum |
| `degree:46:cs` — Riverside | 182 modeled units against a 180-unit minimum |
| `degree:117:cs` — UCLA | 181 modeled units against a 180-unit minimum |
| `degree:132:cs` — Santa Cruz | 57 modeled GE units against the documented 51-quarter-unit certification model |

The model's stated degree denominator remains 120/180; a denominator was not
replaced with the excess modeled sum. The CS templates were not reauthored:
choosing the correct requirement/overlap needs source-level curricular
judgment. The current UC audit reports **27 documents, 4 failed checks, and
81 warnings**. Warnings include inferred policy values and missing structured
GE or upper-division metadata; they are not 81 confirmed numeric errors.

Several older warnings in `uc-degree-modelling-rules.md` are stale: the current
Biology/Economics templates largely close at 120/180, with Merced Biology at
118/120 and a derived one-unit upper-division shortfall. Catalog-year skew
remains on Davis Economics and San Diego Biology/Economics (2026–27 vs. the
2025–26 articulation cohort). Confirm the source-year compatibility before
claiming those are a single-year snapshot.

### Missing catalog references

A direct join of current agreement references to `assist_courses` found:

- California: **43 missing sending course IDs**, in **53 options across 36
  agreements**.
- Virginia: **6 missing sending course IDs**, plus **77 distinct missing
  string course keys** (many string-key misses still resolve through numeric
  IDs). These are canonical API projection issues; the current guide-snapshot
  Figures 1/3/4 use a different supply join.
- Massachusetts: no missing sending-course references in that scan.

The six absent Virginia courses are EGR 125, ITP 120, ITP 150, ITN 170,
ITN 260, and ITN 262. These findings need catalog/source reconciliation;
inventing unit values or rewriting aliases without identity evidence would
hide the issue. The canonical migration's dry run independently reports 366
missing normalized course keys, so its successful collection-count checks
must not be interpreted as full referential integrity.

### Estimates and different denominators

- **Virginia:** guide-based supply is not a solved, constraint-complete
  bachelor's pathway. Range credits, prerequisites, sequence cardinality,
  choice conditions, and differences between sending and receiving awards
  remain source-interpretation limits. For example, Norfolk State's science
  rule requires two different science choices; Eastern Shore's scheduled
  supply cannot establish that simply because one listed science is present.
  These limits now accompany the results as source warnings. Rounded
  credit-to-course conversions are estimates, not enumerated class counts.
- **California:** unit-only or unreconciled blocks still use the documented
  proportional estimate; exact per-course pricing is used where the authored
  credit evidence supports it. The four-unit assumption for unenumerated
  course blocks is also still a model. A fractional average across students,
  districts, or options, a semester/quarter conversion, and an actual
  1.5-unit lab are legitimate fractional values.
- **Massachusetts:** all 11 modeled bachelor templates have requirement-unit
  sums exceeding their resident totals; Dartmouth is 172 against 120. The
  archive lacks exact crosswalks needed to turn these into exact resident
  course removals. Use the verified final-workbook/PDF measures for paper
  replication and the modeled measure only as an explicitly labeled
  sensitivity analysis.
- **Multi-campus preparation:** the committed 3,266-plan artifact contains
  1,970 proven optima, 1,286 feasible bounds, and 10 unavailable plans. Its
  primary display is labeled preliminary solver sensitivity and includes
  bounds. Use its separate exact-only statistics when making claims about
  minimum preparation. Artifact validation finds zero monotonicity
  violations, but strict validation appropriately identifies unresolved or
  non-optimal results.
- **Economics associate-degree figures:** the current configured transfer
  calculation returns no rows. This is absent input coverage, not zero
  replacement work or zero transferability.
- **Legacy credit-loss unit histograms:** their native-unit mode pools
  semester and quarter college credits without conversion. This basis is now
  stated on the visual, along with the unit-bin intervals and missing totals.
  Use the course-count view for calendar-independent comparisons; do not
  interpret the pooled native-unit average as a common credit workload.

## Validation receipts

- Baseline: 2,724 server tests passed (6 skipped), 836 frontend tests passed,
  and 180 Python tests passed.
- Live CA coverage: **3,105 cells** (115 colleges × 9 universities × 3
  majors). Numerators are finite and bounded, required-course counts are
  integers, and typed-course totals reconcile to the named-course population.
- Live CA associate calculations: **405 CS + 513 Biology rows**. For
  nonblank results, applied plus unused credits reconcile to the AS total,
  sending/receiving semester–quarter conversions reconcile, fulfilled units
  remain within their denominators, and pathway units reconcile to resident
  degree units plus unused credits, within published rounding precision.
- Massachusetts: four converter outputs reproduce their committed raw data;
  Figure 1 reproduces **165/165** final-workbook ratios. Its statewide mean
  is **38.2671312%**, and Cape Cod → Dartmouth is **14/31**, not the obsolete
  11/31. Final workbook/PDF checks reproduce Figures 3–6 at **61/61,
  49/49, 49/49, and 49/49**. Gray-detail and complexity artifact checks pass.
- Virginia: the retained guides regenerate without fetching new pages;
  coverage/credit artifacts have **1,170 cells** with finite reconciled
  credit totals. Frontend contract tests exercise the 12 Figure-1 combinations
  of supply, cohort, and measure and their comparison adapters.
- District portfolio: both the detailed artifact check and the compact
  frontend export check pass against the same artifact fingerprints.

Final integration results: **267 server test files / 2,753 passing tests
(6 skipped)**; **111 frontend test files / 850 passing tests**; **180 Python
tests passed**. The final ledger/source-receipt review and credit-loss notice
also passed their targeted reruns. The production build succeeds, with the
existing large-bundle warning; `git diff --check` passes.

The legacy minimum-course calculation was checked against the 36 agreements
with missing catalog references and the existing solver/alias regression
corpus. A supplementary full live minimum-course sweep hit repeated five-second
solver bounds and was stopped; a proof of every global minimum is therefore
not claimed. Missing-catalog and unproved-minimum states now survive into the
API and visual rather than being presented as exact results.

The rollout still requires the usual application deployment. For the
Massachusetts stored correction, `node scripts/ma/importMassachusetts.js`
builds a reviewable local snapshot without connecting to the database;
`--apply` performs the import. That database mutation was not part of this
read-only audit. Source-code fixes do not retroactively rewrite already
published static SVG/PNG/PDF exports.

## Repeating the checks

```bash
cd server
npm test
npm run schema:audit
node scripts/auditDegreeStandard.js
npm run snapshot:district-portfolios -- --check
node scripts/exportDistrictPortfolioFigure.js --check
node scripts/ma/complexityCheck.js --check

cd ../frontend
npm test -- --run
npm run build

cd ..
analysis/.venv/bin/python -m pytest analysis/tests -q
```

The UC degree audit is expected to exit nonzero until the four stored model
issues are resolved. This is an intentional distinction between passing
implementation regression tests and passing source/model acceptance.
