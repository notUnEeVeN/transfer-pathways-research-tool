# The Computing Bottleneck — methods notes for the paper

Working notes behind the visual collection (`frontend/src/analyses/PaperGate.jsx`,
artifact `analysis/data/course_repairs.v2.json`, generator
`server/scripts/simulateCourseRepairs.js`). Everything here is detail deliberately
kept off the figures; nothing here is on-page. Companion file:
`docs/notes_income_gate.md`.

## Definitions

- **Instance**: one not-articulated receiving course inside a required group the
  strict eligibility engine reports unsatisfied, in one subject agreement
  (college × campus × program). Stated basis: 1,761 instances; eligibility
  floor: 809.
- **Contested course** (figure 1): articulated at ≥10% and <90% of the colleges
  where it appears. The band edges are censoring, not findings: a course
  articulated nowhere or everywhere cannot show an income swing as a matter of
  arithmetic. That is why the like-for-like swing comparison (panel B) is made
  only inside the band, and why the figure-1 scatter is expected to be flat at
  both edges.
- **Arch filter**: figure 1 draws receiving courses observed at ≥80 colleges,
  so level and swing are estimated on stable denominators. It is not literally
  every course in the corpus.
- **Same-class evidence (fate A)**: the college holds an articulated entry for a
  receiving course of the same course class (v2 taxonomy) accepted by some UC
  campus. Evidence of a like course accepted — never proof of equivalence.
  Tiers: A1 the demanding campus itself accepts a same-class course from this
  college; A2 a campus with a stricter revealed acceptance rate does; A3 only
  laxer campuses do. Exact-pair cross-agreement evidence is structurally
  impossible (articulation is campus-wide per course pair).
- **Fate B**: no articulation evidence, but the college catalog holds a
  UC-transferable same-class title. **Fate C**: neither — no same-class course
  observed in the catalog; agreements cannot fix these. **Unclassified**: the
  receiving title matches no class.
- **Alternatives inflate the instance count**: an instance is every
  not-articulated receiver inside an unsatisfied required group, so a
  choose-one-of-N group contributes up to N instances even though repairing
  any one suffices. Missing-entry counts are therefore receiver options, not
  a per-student to-do list; the repair simulations are unaffected (they
  re-run the engine).
- **Display selections**: the ledger's bars show the six course types with the
  largest independent gains (counted in college–program cells); the arch
  draws courses observed at ≥80 colleges; the route figures draw the shared
  greedy prefix. All full sets live in the artifact.

## The v2 course taxonomy (classifier rebuild)

`server/scripts/lib/courseBuckets.js`. Course-class granularity for computing
(intro programming, intro programming II, data structures, algorithms, software
engineering, computer organization, assembly/systems, further programming,
discrete), with three deliberate ordering rules: statistics/probability checked
before every computing pattern; differential equations requires the word
"equation" (so "Differential and Integral Calculus" is calculus); the generic
programming/"computer science" pattern is the last computing rule. The v1
broad-bucket classifier inflated evidence: the fate-A share fell from ~81% to
69% stated (79% → 66% floor) under same-class evidence, and "not taught"
tripled (264 → 457 stated instances). CS1/CS2 are separate evidence classes
but one policy unit (the intro sequence).

## Validation (single-coder, pending)

`analysis/data/course_match_codes.v1.json`: 95 stratified fate-A cases
(tier × class, both bases, deduplicated; keystone and intro cases oversampled),
seeded draw, codes preserved across simulator reruns. Coding scheme:
equivalent / same_field_insufficient / mismatched / indeterminate. When coded,
the simulator reports positive predictive value of the repair set overall and
by tier; until then figures say "has same-class evidence", never "signable".
Double-coding is the group-stage upgrade; Tybalt's codes become the seed set.

## Scenarios and routes

- All repairs are **mechanical simulations** of formal access: matching
  receivers get a synthetic articulation option and the engine re-runs.
  No behavior, no admissions, no enrollment.
- **Greedy route order**: at each step, every remaining class is simulated on
  top of the classes already repaired; the class with the largest marginal
  lowest-income-quartile gain is taken (ties: evidence share, size, id). The
  order is computed in the full-repair world and shared by both route
  variants. Greedy is a heuristic, not a proven optimum; endpoint totals are
  order-invariant, per-step attribution is not. Greedy confirmed intro I →
  intro II first on both bases.
- **Route cut**: the drawn routes stop at the first milestone led by a
  non-computing class (calculus, physics, …). Folded non-computing riders
  inside a computing milestone stay and are disclosed on the row.
- **Two route variants**: `route` (each milestone fully repaired — signed and
  taught) and `routeSignatures` (the spine accumulates only fate-A entries;
  each band shows what teaching that milestone's remainder adds).
- **Milestone folding**: classes whose marginal gain is below the row threshold
  fold into the next milestone and are named on its row.
- **Why single courses open little alone** (cut from the ledger figure):
  complete paths are conjunctions over whole sequences, so repairing one
  course type mostly completes cells only where everything else already
  articulates — the reason the type bars understate what the same repairs
  contribute inside the cumulative routes.
- Legacy scenarios kept in the artifact but not drawn: universal intro sequence
  (`lowestBar`), evidence-scoped intro (`introEvidence`), evidence ∪ universal
  intro (`cumulative`), the full class ladder with the "everything" ceiling
  (gap 0, both quartiles 100%).

## Key numbers (floor basis unless noted)

- Fates: A 560/809 = 69% (stated 1,243/1,761 = 71%; A1 391 · A2 331 · A3 521).
  Unclassified is zero on both bases after three targeted rules (UCI
  "Principles in System Design" → computer organization; UCLA "Integration
  and Infinite Series" = Math 31B → calculus; UCSD "CSE 8B", title lost
  upstream → intro programming II).
- Routes (post-reclassification): today 40/90 gap 49 → intro agreements 53/91
  gap 38 → all candidate agreements 69/98 gap 29 → computing types repaired
  86/99 gap 13. Everything (math + untaught) → 100/100, gap 0.
- Candidate agreements close 20 of 49 floor gap points — check the stated
  figure after each regeneration; on stated preparation agreements close only a
  small share of the gap (a substantive sensitivity: stated closure censors
  what agreements alone can reveal — see the basis-asymmetry note in the
  Income Gate file).
- The two evidence standards (A1+A2 vs all A) are **not ordered bounds on gap
  reduction** — higher-income-quartile access rises too; on stated, the
  conservative standard can show a smaller gap than the full one. Label by
  evidence rule, never as an interval.
- Participation bound (observational, in the ledger figure): 1.70 vs 2.79 CS
  completers per 1,000 students (narrow vs open colleges) ≈ 749 more per year
  if rates matched. Access and income travel together; a bound, not an effect.

## Editorial rules this collection settled

- Two interventions = two named endpoints ("candidate agreements · 61%" /
  "with course provision · 67%"), never a dash range; dash ranges are reserved
  for evidence-standard sensitivity.
- Estimand denominator defined once per figure: shares are of missing
  college–campus requirement entries.
- Staged scenario figures must guarantee nesting by construction (each stage a
  superset of the previous), never assume it.
- The verdict figure (beat 5) introduces no scenario of its own — its stages
  are figure-4 route points only.

## Regeneration

- `node server/scripts/simulateCourseRepairs.js` (needs local pmt_data mongo +
  Atlas). Greedy adds ~130 extra engine runs. Hand codes in the codes file
  survive reruns.
- Snapshot first if the classifier changed:
  `node server/scripts/generatePriceOfPlaceSnapshot.js`.

## Open items

- Code the 95 validation cases → PPV → revisit "candidate" language strength.
- Route-scoped A1+A2 endpoint (if tier sensitivity is wanted inside the route
  figures rather than the notes).
- The stowed one-jump signing figure (M4Signing in the component, not
  rendered) is the likely main inferential exhibit for the paper.
