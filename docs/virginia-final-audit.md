# Virginia data-to-figure audit — September 7, 2026

The current Virginia figures use a different data path from the canonical
MongoDB degree evaluator. Figures 1, 3 and 4 consume committed guide/catalog
joins. Passing the canonical Virginia publication, residency, or prerequisite
tests therefore does not establish the accuracy of these figures.

## Data path examined

1. Cached Transfer Virginia HTML → `captureVirginiaTransferGuides.js` →
   `.va-guides/guides.json` (32 computing guides).
2. `.va-courses/catalog/*.json` → college course-code and scheduled-course sets
   (23 colleges, no duplicate course codes found in any college file).
3. `buildVaCoverageCells.js` selects 15 CS guides and joins them to 16 colleges
   offering CS, or all 23 colleges. Four variants contain 1,170 cells in total.
4. `emitVaFigureRows.js` emits `vaCoverageRows.js`, `vaCreditRateRows.js`, and
   `vaTransferGuides.js`, which supply the figures and university guide tables.

This audit used local captured sources and generated artifacts. It did not
change a database or fetch replacement source content.

## Errors corrected

- **Named major electives were omitted.** A parser expression treated every
  label ending in “Elective(s)” as unrestricted padding. Reclassification
  restores 29 restricted elective rows across the 32 captured guides,
  including 18 rows at ten universities in the selected CS cohort. Examples
  include Longwood's 12 credits of upper-level CMSC electives and William &
  Mary's 15 credits of major electives. These now reach both named-requirement
  accounting and the displayed graduation plans. Actual general, free, and
  unrestricted electives retain their existing classification.
- **An allowed UCGS alternative vanished.** NSU's “Any UCGS course or PED 101
  and HLT 110” was evaluated only as the PE/health pair. That created a false
  three-credit shortage at seven of 16 colleges in the catalog view and 15 of
  16 in the scheduled view. Open UCGS alternatives now use the same explicit
  assumed-supply treatment as other UCGS categories. The same repair preserves
  Lynchburg's open category alternatives next to its named literature options.
- **Explicitly refused credits were counted as utilized.** SDV rows labeled
  “Does not transfer,” “No Transfer Credit,” or “Not applicable” at Longwood,
  Randolph-Macon, Lynchburg, Mary Washington, and UVA now remain in earned
  pre-transfer totals but leave applied credit. Supply gaps and denied credit
  are accounted for without charging the same row twice. For example,
  Northern Virginia → UVA changes from 66/66 applied to 64/66, with two credits
  explicitly denied. Figure 1's course-supply calculation remains separate
  from this post-transfer credit calculation.
- **An inline total counted as a class.** Radford's “Credits Post-Transfer: 60”
  was stored as a named requirement with no credit quantity. The source parser
  now excludes the total row, and the calculator also guards against older
  captures containing it.
- **Conjunction shorthand lost its meaning.** “MTH 161 and 162 or MTH 167”
  could be satisfied by MTH 161 alone. Prefix expansion now occurs before
  Boolean alternatives are evaluated, preserving the required pair.
- **Every itemized total was invalid.** The calculator referenced three
  deleted tally keys, producing `NaN` and serializing `itemised_units` as
  `null` in all 1,170 cells. It now sums the actual supplied, missing, assumed,
  and university-side unit buckets.
- **The exports discarded distinctions and evidence.** BA guides are no longer
  universally labeled BS, explicit nontransferable credits are distinguished
  from modeled substitution loss, and requirement notes now survive into the
  university guide data.

The captured guides were reparsed from the cached HTML, then all four coverage
variants and all three frontend modules were regenerated.

## Numerical effect

These are unweighted means across college × selected-guide cells, matching the
committed frontend pooled statistics. They are not the ratio of pooled credit
totals, which the command-line builder also reports for utilization.

| Cohort and supply basis | Credit coverage, before → after | Estimated course coverage, before → after | Credit utilization, before → after |
| --- | --- | --- | --- |
| 16 CS colleges, catalog | 50.0893% → 50.1593% | 42.3199% → 42.2551% | 99.3996% → 98.4713% |
| 16 CS colleges, scheduled | 45.4907% → 45.6407% | 37.8256% → 37.8136% | 90.2542% → 89.4872% |
| All 23 colleges, catalog | 48.8093% → 48.8788% | 41.0321% → 40.9576% | 96.8582% → 95.9290% |
| All 23 colleges, scheduled | 43.1586% → 43.3047% | 35.4705% → 35.4344% | 85.6190% → 84.8441% |

## Remaining interpretation limits

These prevent an unconditional claim of exact bachelor-degree completion or
actual credit loss. Affected cells now carry `method_status: estimated` and
source warnings that the frontend can display.

- **Whole numbers are still estimates.** The course view converts credits
  using each guide's average small-row credit quantity, rounds row counts,
  converts unitemized credit remainders, and rescales overstated post-transfer
  halves. Integer output does not make these actual enrollment counts.
- **The join does not solve every source condition.** Degree-wide sequencing,
  choice cardinalities, distinct subject requirements, languages, and other
  conditions in notes are not evaluated as a complete plan. A concrete case is
  NSU's eight-credit science row: it requires two choices, while Eastern Shore's
  scheduled corpus provides only BIO 101. The existing numerical estimate is
  retained with an explicit warning that full coverage has not been proved.
  Resolving it requires a policy for partial row coverage and sending versus
  receiving credit: the source describes eight sending credits satisfying a
  seven-credit NSU requirement. ODU's science sequence likewise requires a
  complete pair; the current corpus happens to have an available complete pair
  wherever its row is marked supplied, but the generic grammar does not prove
  this relationship.
- **Credit ranges are optimistic bounds.** The calculator takes the upper end
  of each range and the stated halves, without proving that all those choices
  coexist in one valid pathway. William & Mary's “Up to 12” language quantities
  and blank COLL quantities remain unallocated; the stated total preserves the
  overall credits while their distribution is uncertain. These are now exposed
  in source warnings, rather than silently represented as a fully resolved
  requirement allocation.
- **Guide supply is distinct from degree application.** Figure 1 subtracts
  missing supply from the stated pre-transfer half. It does not apply the
  canonical residency/transfer-cap proofs, and a supplied no-credit SDV course
  is still supplied even though it is now excluded from credit utilization.
  Figure 1 should be described as modeled guide preparation availability,
  with a separate credit-application interpretation for Figures 3 and 4.
- **Substitution loss is a model.** A missing guide row is assumed to be
  replaced with associate credit that does no bachelor requirement work. The
  join does not construct an actual alternative associate transcript or test
  unused elective capacity. Its loss figure is not observed student credit
  loss and cannot establish replacement classes individually.
- **GE exclusion uses assumed-category supply.** The current course lens
  excludes the `assumed` bucket, not a complete course-level GE taxonomy.
  Enumerated GE courses and named major courses are not separated perfectly.
  It should not be called a literal reproduction of the Massachusetts paper's
  named-course measure.

## Verification

`npx vitest run scripts/va/buildVaCoverageCells.test.js scripts/captureVirginiaTransferGuides.test.js`

The regressions cover source alternatives, shorthand conjunctions, restricted
electives, inline totals, denied credit, BA labels, visible unresolved
cardinality, finite numeric output, integer course estimates, credit
conservation, coverage ceilings, and reproduction of every committed cell from
its captured sources. Frontend integration and full-suite results are recorded
in the overall website audit.
