# District UC-portfolio subset dataset

This offline analysis preserves the underlying plans needed to compare several
possible paper estimands without rerunning the planner. For every California
community college district, it independently optimizes every nonempty subset of
the pinned UC computer-science programs that the district can strictly reach.

The current reachability census implies 3,266 district–portfolio plans:

| UC programs retained | Eligible districts | Portfolio plans |
| ---: | ---: | ---: |
| 1 | 68 | 335 |
| 2 | 67 | 741 |
| 3 | 62 | 949 |
| 4 | 54 | 754 |
| 5 | 45 | 370 |
| 6 | 26 | 104 |
| 7 | 13 | 13 |

The generator keeps every plan rather than freezing only an average. This
allows later calculation of path-weighted and district-equal summaries, paired
marginal additions, campus-specific Shapley contributions, overlap savings,
and the balanced 13-district seven-campus cohort from the same source rows.

## Run it

From `server/`, inspect the planned workload without installing an artifact:

```bash
npm run snapshot:district-portfolios -- --dry-run
```

Generate the canonical dataset:

```bash
npm run snapshot:district-portfolios
```

The default joint-optimizer limits are 5,000 milliseconds and 1,000,000 search
states per portfolio. Both limits are explicit and recorded in the artifact;
override them for a sensitivity run with, for example:

```bash
npm run snapshot:district-portfolios -- \
  --optimizer-budget-ms 10000 \
  --optimizer-max-states 2000000
```

The progress line reports the completed fraction, current district and UC
portfolio, last-plan duration, observed plans per second, elapsed time, a
portfolio-size-aware ETA, and result-status counts. The ETA learns from actual
durations separately for each portfolio size, so it becomes more useful after
the first few examples of each size.

The checkpoint is append-only and source-specific. Interrupting with Ctrl-C
finishes and checkpoints the current plan, then exits. Running the same command
again resumes compatible work. A changed corpus fingerprint, pinned-program
set, planner method, load, solver time/state limit, filter, or analysis source
file receives a different or incompatible checkpoint rather than mixing
results. The checkpoint header and final JSON record a combined SHA-256
manifest covering the generator and its planner, optimizer, prerequisite, and
scheduler source files. Thus a code edit cannot silently resume rows produced
by an older implementation even if a developer forgets to change a method ID.

For a short end-to-end smoke run, use a noncanonical output:

```bash
npm run snapshot:district-portfolios -- \
  --district "West Hills" \
  --limit 3 \
  --output /tmp/west-hills-portfolios.json
```

Validate an installed JSON artifact without reconnecting to MongoDB:

```bash
npm run snapshot:district-portfolios -- --check
```

Add `--strict` to reject any bounded optimizer, estimated prerequisite result,
unresolved prerequisite group, bounded schedule, or exact monotonicity defect.

## Outputs

The canonical command writes four inspectable files under
`server/data/analysis/`:

- `district-portfolio-subsets.v1.json`: normalized district metadata, all
  detailed course and term plans, solver telemetry, derived summaries, and
  audit findings;
- `district-portfolio-subsets.v1.summary.csv`: one flat row per plan;
- `district-portfolio-subsets.v1.marginals.csv`: one flat row per immediate
  nested transition, including the empty-to-singleton baselines; and
- a source-specific `*.checkpoint.ndjson` recovery log.

The detailed JSON retains course IDs, college, code, units, explanatory role,
UC attribution, modeled prerequisite IDs, modeled term, term loads, all lower
and upper bounds, evidence coverage, and optimizer telemetry. The CSVs are
convenience views; the JSON remains the auditable source of truth.

Every derived result is reported in two explicitly named strata:

- `exact_only` is the paper-facing result. Course and unit summaries require a
  proven-optimal, prerequisite-complete course solution. Time summaries also
  require a proven-optimal schedule.
- `bounded_inclusive_sensitivity` additionally admits feasible bounded
  incumbents and reports its own denominator. It is a solver-limit sensitivity,
  not a substitute for the exact estimate.

An unavailable or fallback result is excluded from metrics produced by that
stage: for example, a fallback scheduler excludes time metrics but does not
erase a proven course/unit optimum. Estimated or unresolved prerequisites and
nonfinite values are excluded from both strata. Marginal and Shapley summaries
apply the same rule to every endpoint or coalition they use, so an unavailable
value cannot be silently converted into a numeric observation.

This separation is substantive rather than cosmetic. In a benchmark of the
Chabot district's UCR+UCB portfolio, the search was still bounded after 15
seconds and 853,898 explored states, but its feasible incumbent improved from
15 courses/61 units at the five-second limit to 14 courses/58 units. The
bounded result is therefore an upper-bound sensitivity observation, not an
exact estimate suitable for the primary figure.

## Corrected course objective

The district planner now searches ASSIST requirements and activated modeled
prerequisites jointly. Its lexicographic objective is:

1. minimum total distinct courses in the prerequisite-closed plan;
2. minimum native units among equal-course plans; and
3. stable course IDs as a deterministic tie-break.

The previous implementation minimized direct ASSIST courses first and added
prerequisites afterward. That could select a small direct plan with a needlessly
large closure. In the West Hills–Berkeley regression, the old two-stage plan
contained 14 courses and 58 units; the joint solver proves a 10-course,
40-unit closed plan.

Term scheduling remains a separate objective. It minimizes regular terms for
the returned model-minimum course set, not across every equal-course course set.
Consequently, course counts and native units are the primary optimization
outcomes; terms are fixed-plan scheduling outcomes.

## Interpretation and weighting

One artifact row is a modeled district–portfolio path, not a student. The data
are a finite-population census of modeled articulation feasibility and should
not be described as observed student behavior.

- A path-weighted mean gives every portfolio row equal weight. High-reach
  districts contribute more combinations.
- A district-equal mean first averages same-size portfolios within each
  eligible district, then gives districts equal weight.
- A paired marginal compares independently optimized nested portfolios within
  the same district. This is the appropriate basis for “the added preparation
  required to retain one more UC option.”
- A campus Shapley value averages that campus's marginal contribution equally
  over every possible insertion position. It does not uniformly average all
  coalitions, which would overweight middle-sized bases.
- The 13 districts reaching the common seven-campus universe form a balanced
  sensitivity cohort. It cleanly varies portfolio size but represents the
  highest-access districts, not every district.

The JSON stores both path- and district-weighted results and preserves the raw
rows so other defensible summaries can be recomputed later.

## Gallery figure

The live figure uses the bounded-inclusive, district-equal summary. At each
portfolio size, it first averages all usable UC subsets within a district and
then gives every represented district one vote. The main mark is the mean; the
box and whisker show the IQR and range across district means. A hollow marker
shows the same calculation in the fixed cohort of 13 districts that can reach
the common seven-campus set.

The figure deliberately prints solver quality beside every row. Its main values
include feasible upper-bound incumbents so nearly the complete real portfolio
universe remains represented; they are therefore labeled best-found results,
not proven population minima. The proven share falls from 86% at one program to
31% at seven. An exact-only curve is not substituted because its denominator
becomes increasingly selected toward easier-to-solve plans.

The browser imports a compact, fingerprinted projection rather than the 23 MB
plan artifact. Regenerate or validate it after the canonical analysis changes:

```bash
cd server
npm run snapshot:district-portfolios:figure
npm run snapshot:district-portfolios:figure -- --check
```

The generated file is
`frontend/src/analyses/data/district-portfolio-subsets.v1.json`; the canonical
plan-level JSON and both CSVs remain the auditable source of truth.

## Model limitations

The course plans use actual district-pooled ASSIST articulation paths, but the
prerequisite layer is a reviewed statewide normative concept model rather than
a transcription of every college catalog. Some modeled edges deliberately
serialize a local corequisite or use a conservative statewide sequence. For
example, the corrected West Hills course set still schedules to five modeled
semesters because of those normative sequencing rules. That is a prerequisite-
model sensitivity question, not an optimizer defect.

The analysis also excludes general education, admission selection, associate-
degree rules, prior student coursework, seats, historical offerings, timetable
conflicts, travel, and cross-enrollment administration. Academic years provide
a common descriptive time scale across semester and quarter districts; raw
semester and quarter term counts must not be pooled as if they were identical.
