# The Income Gate — methods notes for the paper

Working notes behind the visual collection (`frontend/src/analyses/PriceOfPlace.jsx`,
snapshot `frontend/src/analyses/priceOfPlaceSnapshot.json`, generator
`server/scripts/generatePriceOfPlaceSnapshot.js`). Detail deliberately kept off
the figures. Companion file: `docs/notes_computing_bottleneck.md`.

## Measure and scope

- **Access** = a complete transfer path formally exists (strict PMT eligibility
  engine over the stored ASSIST requirement groups) at one or more colleges in
  the district. Formal opportunity only — never student behavior or admission
  odds. 72 income-matched districts in quartiles of 18; income = mean adjusted
  gross income per tax return over the district's catchment (contextual SES,
  not student household income; district-level conclusions only — student-level
  readings are ecological inference).
- Nine registry Computer Science programs against ~900 other campus–major
  programs (programs, not majors). Computing-adjacent programs excluded from
  subject and field alike.

## Requirement bases

- Two bases computed side by side: the hand-curated **eligibility floor**
  (curated_requirements `transfer_minimum`; single-coder curation by Tybalt —
  protocol documentation and a second coder are the group-stage upgrade) and
  full **stated preparation** (ASSIST as listed). Seven campuses identical
  under both; UCLA and San Diego are closed only under stated preparation
  (listings fold competitiveness into requirements).
- **"Never articulated" placeholders are not blockers** (engine rule, both
  ports): receivers ASSIST itself marks "This course has not been
  articulated" (`not_articulated_reason: never_articulated`) have no CC
  equivalent anywhere and are taken at the university after transfer. Strict
  mode ignores them when computing achievable demand. Before this rule the
  strict basis wrongly closed eight field programs everywhere (UCLA
  Economics, UCLA Business Economics, Berkeley French, …); no Computer
  Science result changed. Floor staircase steeper:
  49-point Q4–Q1 gap vs 37 stated — the strict basis diluted the income
  pattern, it did not inflate it.
- **Basis asymmetry, a direction not a theorem**: stated listings can only
  overstate requirements, which lowers measured access and — once a program
  closes everywhere — flattens its measured gradient toward zero (UCLA CS:
  0→0 stated, 22→94 floor). This plausibly biases the field gradient
  downward, but is not guaranteed (relaxing requirements can move Q1 and Q4
  differently); the like-for-like stated comparison (CS +37 vs field +11)
  needs no basis assumption and is the paper's primary result, with the
  floor as robustness. The field has no curated floors; field series are
  always stated preparation, labeled.
- A graded stated measure (share of required groups satisfied, not the binary
  complete-path check) would relieve closure censoring without curation —
  designed, not built.

## Committed checks

- **Permutation test** (in the snapshot, seeded, 100k relabelings of districts
  into quartiles, both bases): observed Q4–Q1 gap exceeds every null gap;
  p ≤ 1e-5. Contract-tested.
- **Spearman** between district income and programs reachable, printed on the
  twin maps: ρ = 0.67 floor / 0.66 stated across the 72 districts.

## Explanations ruled out / robustness (also on-page in the notes panel)

- Program size (CS ~11 required courses vs typical 8 — ordinary for the corpus).
- Multi-college districts (college-level scoring leaves the gap essentially
  unchanged).
- Distance alone (income gradient persists within both distance strata and
  vice versa; the 2×2 is a within-strata comparison, not "held fixed" —
  for the paper the estimate should come from a continuous specification with
  program fixed effects and clustered/spatially robust uncertainty; the grid
  stays as the display).
- Demographics (person-weighted reach spread too small to report: 5.3 vs 6.0
  of nine).
- Survives enrollment weighting; survives re-ranking districts by census
  median household income (26 of 72 change quartile, pattern does not).
  Caveat: the ACS re-ranking shares the same ZIP-to-nearest-centroid
  crosswalk as the tax measure, so it validates the income measure, not the
  geographic assignment. The crosswalk is a Voronoi approximation of
  district service areas — official district boundaries with tract/ZCTA
  intersection weighting are the paper-stage upgrade.
- Distance is straight-line centroid-to-campus — a proxy; population-weighted
  centroids / travel time are the designed sensitivity (ZCTA population
  artifact already exists). MAUP applies to both income and distance via the
  catchment construction.

## Market figure (demand × swing)

- Field measured on stated preparation (its only basis); CS follows the page
  basis — on the floor all nine programs are measurable (UCLA and San Diego's
  applicant counts recovered from the exclusion list). 221 field programs
  closed everywhere on stated preparation are not drawn: a closed program has
  no measurable swing (conditioning on measurability, not outcome selection —
  but the title must stay scoped to measurable programs).
- Demand joins admissions major names to ASSIST names by normalization — an
  audit of the fuzzy join is still owed before this figure carries paper
  weight.

## Retired analyses (kept in snapshot data / git history, not rendered)

Person-weighted strip (3.5 vs 6.5 of nine mean reach; 8.5M behind
majority-shut doors; 53k in deep shutouts), demographics beat, detour tax,
graduates wall, Lorenz/concentration, fitted trend lines (never — bounded
shares), raw missing-course counts (substitutes), transferable-unit totals
(noisy), matched-size cohort (unneeded once size ruled out). The dropped
instruments and why they failed are inventoried in the on-page notes panel.

## Income data provenance

- FTB Personal Income Tax Statistics by ZIP Code, **taxable year 2022**,
  published in the FTB's **2024 release** (the source filename
  `2024_personal_income_tax_statistics_by_zip_code.csv` names the release
  year; FTB publishes on a roughly two-year lag). The artifact's
  `taxable_year: 2022` and the filename are consistent, not contradictory.

## Regeneration

`node server/scripts/generatePriceOfPlaceSnapshot.js` (local pmt_data mongo +
Atlas). The application database never carries the ~120k-agreement corpus.

## Open items

- Earlier years of the agreement database (stability across vintages).
- City–suburb–rural classification (held, unused).
- Curated floors for top-demand stated-closed field programs (UCLA BizEcon et
  al.) — the single best robustness purchase against the mixed-basis critique.
