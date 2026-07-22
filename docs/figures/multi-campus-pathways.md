# Multi-campus major-preparation pathways — methodology

This analysis estimates the community-college coursework needed to keep one or
more UC computer-science pathways open at the same time. It finds shared courses
once, adds known prerequisite obligations, and then asks how many terms the
resulting course set needs under a user-selected unit limit.

The requirement universe is **major preparation in the selected ASSIST
agreements**. It is not the four-year graduation-requirement model used by the
degree-coverage figure.

## The short version

- Campus choices are an **unordered set**. Selecting Berkeley and Davis is the
  same request as selecting Davis and Berkeley.
- For each community college, the analysis chooses one coherent set of direct
  ASSIST courses that satisfies the selected campuses together, then closes
  that set under modeled prerequisites. A course shared by several campuses is
  counted once.
- The course-set objective is lexicographic: first minimize the number of
  distinct courses, then minimize their native community-college units, then
  use stable course IDs to break an exact tie.
- The term scheduler uses the college's native unit system and treats the
  selected load as a hard cap. It minimizes terms subject to that cap and to
  known prerequisite ordering.
- The direct-course minimum and fixed-set term minimum are called exact only
  when their respective searches prove them. Prerequisite-choice evidence is
  reported separately. Timeouts and data gaps are surfaced instead of being
  converted to zero.
- The primary planning view is **locally articulable preparation**: everything
  in the selected ASSIST major-preparation agreements for which that college has
  a usable course path. A separate strict-completeness diagnostic asks whether
  the college can satisfy the full stated ASSIST demand.

## Scope: what is and is not being planned

The source requirements are the exact CS, CSE, or EECS major agreements that
match the nine programs used by this project. The curated four-year degree
records may identify which program name to match, but their general education,
upper-division, residency, and graduation-unit blocks are not inputs to this
analysis.

Included:

- required major-preparation groups and sections from `assist_agreements`;
- ASSIST alternatives, course bundles, series, and choose-N rules;
- the sending college's course units and cross-listed-course identities;
- prerequisite evidence projected for that college; and
- one user-selected native-unit cap per regular term.

Not included:

- Cal-GETC, UC 7-course breadth, or campus general education unless a course is
  itself part of the selected major-preparation agreement;
- the community college's associate-degree requirements;
- upper-division UC coursework or total bachelor-degree completion;
- GPA, admission selection, residency, transfer-unit caps, or application
  deadlines;
- historical or planned course offerings by term; or
- a student's already-completed transcript.

Consequently, “four terms” means four terms for the modeled major-preparation
course set. It does not mean that the student can finish every transfer,
associate-degree, or bachelor's requirement in four terms.

## Mathematical objects

For one community college, let:

- `S` be the unordered set of selected UC campuses;
- `A_s` be the matched ASSIST major agreement for campus `s`;
- `V` be the college's usable sending courses;
- `u(v)` be course `v`'s units in that college's native system;
- `D_c(S)` be the direct courses selected from ASSIST for college `c`; and
- `C_c(S)` be the closed plan: `D_c(S)` plus prerequisite-only additions.

An ASSIST receiver may have several course options. An option may itself require
all courses in a bundle, while a section or group may ask for only a stated
number of its receivers. The pathway engine evaluates those nested rules rather
than flattening every course shown on the agreement into a requirement.

Cross-listed or `same_as` courses represent one physical completion. They must
not become two courses merely because different campuses refer to different
catalog identities. Each listed course choice branches over catalog identities
that explicitly identify it as an equivalent. The listed identity remains one
of those branches, which is necessary when a unit-advisement fallback credits
units by exact option ID rather than by alias.

### Joint course-set objective

Among direct ASSIST course sets that meet the chosen completeness rule for every
campus in `S`, the optimizer minimizes:

1. `|D_c(S)|`, the number of distinct community-college courses;
2. `sum(u(v) for v in D_c(S))`, the native units, among equal-course solutions;
   and
3. the sorted course-ID list, as a deterministic final tie-break.

This is a joint optimization. It is not the union of independently optimized
campus plans. A course option that is slightly less attractive for one campus
alone may be the best joint choice if it also satisfies another campus.

The course selector begins with PMT's multi-goal greedy plan as a feasible
upper bound. The research-side proof search corrects an important limitation
in PMT's original receiver-level branch-and-bound: inside a choose-N section,
no particular receiver is mandatory. It instead branches over all ways to make
progress in one incomplete required group. Every valid completion must satisfy
at least one of that group's currently open receivers, so this group-frontier
branch is exhaustive without forcing an optional receiver.

Selected-course sets are memoized, and duplicate or cross-listed identities in
one move are counted once. The optimizer reports whether that search proved the
minimum. A timeout, a large Cartesian-option fallback, any agreement course
reference absent from the local catalog, or a greedy safety-cap fallback
prevents an exactness claim even when the returned plan is usable. A missing
unused alternative matters to proof: it might have produced a smaller shared
plan. The proof is also withheld for legacy unit-advisement rows that lack
receiving-side units and therefore fall back to summing sending option IDs; the
current selected corpus contains no such required unit-sensitive row.

This is deliberately a two-stage model. The ASSIST objective chooses `D_c(S)`;
prerequisite handling then constructs `C_c(S)`. The displayed distinct-course
and native-unit totals, and the term scheduler, use `C_c(S)`. The response also
reports the direct and prerequisite-only portions separately.

Because the direct-course optimizer does not use prerequisite closure or term
count in its objective, `C_c(S)` is the closure of the proven minimum direct
plan, not necessarily the smallest or fastest closed plan among every tied or
larger direct ASSIST alternative. An “optimal” result proves each stated stage;
it does not claim that one search jointly minimized direct courses,
prerequisites, and elapsed terms.

## Two meanings of completeness

The analysis keeps two related questions separate.

### Strict ASSIST completeness

Strict completeness asks:

> Can this college form a coherent course plan that meets the entire required
> demand stated in every selected ASSIST agreement?

Choose-N is honored. For example, a section that says “choose two of five” is
strictly complete when at least two usable receivers have local paths; it does
not require all five alternatives. An indivisible series is complete only when
its full sending-side bundle is usable.

If any required demand lacks enough local paths, the college is not strictly
complete for that target set. This is a useful articulation diagnostic, but it
is not itself an admissions ruling.

### Locally articulable preparation

Locally articulable preparation asks:

> Of the stated major preparation that this college can supply, what is the
> smallest coherent set of courses that captures all of it across the selected
> campuses?

For a choose-N section with stated demand `k` and `a` locally usable receivers,
the local effective demand is `min(k, a)`. Unarticulated demand is not turned
into a zero-unit course and is not described as completed. It is counted and
reported as omitted UC demand.

This is the primary workload estimate because a student cannot schedule a
community-college equivalent that does not exist. It is also why a low course
count is not automatically a strong pathway: it may reflect extensive overlap,
or it may reflect missing articulation. The strict-completeness fields and
omitted-demand counts must remain visible beside the workload.

Neither definition means “transfer ready.” ASSIST major preparation is only one
part of transfer eligibility and preparation.

## Prerequisite evidence and closure

Prerequisites come from the project's concept graph, not from the UC agreement
itself. Sending courses are tagged with concepts such as Calculus II or Data
Structures. Curated concept rules state which concepts precede others, and the
rules are projected at read time onto courses actually offered by the same
college.

The structured projection is an **all-of list of any-of groups**. If Circuits
needs Physics and either standalone Differential Equations or a combined Linear
Algebra/Differential Equations course, its requirement is represented as:

```text
all of:
  any of: [Physics]
  any of: [Differential Equations, Combined Linear Algebra/Differential Equations]
```

Interchangeable honors, language, and cross-listed variants therefore remain
alternatives. Treating every incoming graph edge as simultaneously required
would overstate both units and sequence length.

Before scheduling, the selected course set must be closed under the known
prerequisite groups:

1. A group is already met when one of its alternatives is already in the joint
   course set.
2. Otherwise, a local prerequisite course may be added and labeled as a
   prerequisite-closure addition.
3. The process repeats for the added course until it reaches courses with no
   modeled prerequisite.
4. If a reviewed prerequisite group has no usable local candidate, the group
   remains explicit in the result and the row is labeled `estimated`. The
   displayed term sequence then carries the stated assumption that this work is
   already satisfied or is not locally required; it is not called an exact
   result. The lower-level scheduler itself rejects any unresolved group it is
   asked to enforce as `incomplete_prerequisites`.

For every resolved prerequisite group `G` of every `v` in `C_c(S)`, at least
one member of `G` is also in `C_c(S)`. An unresolved group is the explicit
exception that changes the row from `optimal` to `estimated`. When several
local members could close a group, that is a prerequisite-choice decision. A
deterministic choice is reproducible, but it is not a proof of the smallest
possible closure unless all relevant alternatives were searched.

Course-selection and closure evidence must be distinguished in the output so a
reader can see how many courses came directly from ASSIST and how many were
added only to make the sequence feasible. Exact scheduling means exact for the
fixed, closed course set. It is an end-to-end exact pathway only when the joint
course choice and any prerequisite-alternative choices are also proven.

The graph records whether each course was examined and mapped. Prerequisite
coverage is the number of scheduled real courses with examined concept evidence
divided by all scheduled real courses. An unexamined course does not prove that
it has no prerequisite. Results with incomplete evidence may omit prerequisite
work and carry a warning; because other graph rules can be conservative, the
whole modeled schedule is not necessarily a formal lower bound on a local
catalog schedule.

The concept rules deliberately make several conservative statewide sequencing
choices. Some colleges permit a modeled prerequisite as a co-requisite or use a
shorter local chain. Conversely, the model has no term-by-term offering data.
The resulting schedule is exact under the modeled graph, not a promise about an
individual catalog or registration cycle.

## Exact minimum-term scheduling

Let `C` be the fixed course set after prerequisite handling, and let `L` be the
user's native-unit limit per term. The scheduler assigns every course `v` a
positive integer term `t(v)` subject to:

```text
sum of u(v) for courses in term q <= L

for every prerequisite group G of v:
  at least one p in G has t(p) < t(v)
```

For an any-of prerequisite group, at least one member of the group must occur in
an earlier term. Prerequisites cannot be taken in the same term under this
model.

The primary objective is the smallest number of terms. Fuller-term ordering and
stable IDs are deterministic search tie-breaks; they do not change the minimum.

### Certified lower bounds

Two facts give lower bounds before exact search begins:

```text
unit bound     = ceiling(total native units / native unit cap)
sequence bound = shortest possible depth of the all-of/any-of prerequisite graph
lower bound    = max(unit bound, sequence bound)
```

The sequence bound counts courses along the longest unavoidable chain while
choosing the shortest valid alternative inside each any-of group.

More precisely, let `d(v)=1` when `v` has no prerequisite groups. Otherwise:

```text
d(v) = 1 + max over groups G of (min over p in G of d(p))
sequence bound = max over scheduled courses v of d(v)
```

An unresolved strict-earlier cycle has no finite depth. The depth calculation
relaxes alternatives to a fixed point so that a shorter path discovered later
can replace an earlier, longer path.

The scheduler tests term counts beginning at that lower bound. For a proposed
term count it explores sets of courses that are ready at the start of a term and
fit under the cap. It is safe to consider only inclusion-maximal ready sets: if
another already-ready course fits, moving it earlier cannot invalidate a
prerequisite or consume capacity in a later term. The first feasible term count
is therefore the exact minimum.

The exact subset representation is limited to 24 courses in the pathway
analysis. Larger fixed sets use a separate polynomial greedy scheduler before
any bit mask is constructed. That scheduler returns a feasible sequence and a
certified lower-to-upper-bound interval; it never labels the greedy upper bound
as an exact minimum.

This is precedence-constrained bin packing, which is NP-hard even without
prerequisites. The exact subset search has worst-case exponential cost. A
deterministic greedy schedule supplies a feasible upper bound. If the exact
state or time budget is reached, the response reports the certified interval
`[lower_bound_terms, upper_bound_terms]` rather than presenting the upper bound
as exact.

## Semester and quarter colleges

Scheduling stays in the community college's native units:

- a semester course retains its semester units and uses `semesterLoad`;
- a quarter course retains its quarter units and uses `quarterLoad`.

This avoids rounding a five-quarter-unit course into a repeating decimal during
capacity checks. Unit values are rounded to one-hundredth of a native unit and
converted to integer ticks before exact search, so subsequent capacity checks
use integer arithmetic.

Semester and quarter **term counts are never averaged together**. Average mode
reports them as separate calendar cohorts with separate sample sizes. For a
descriptive cross-system unit total only:

```text
semester-equivalent units = quarter units * 2 / 3
```

Term counts do not use that conversion. When an academic-year approximation is
shown, it uses the number of regular terms in the calendar: ordinarily two for a
semester college and three for a quarter college. Summer enrollment and actual
course availability are outside this model.

If a college's calendar is unknown, it is excluded from term averages and
reported as a calendar exclusion. It is not assigned to the semester cohort by
default.

## Overlap and the optionality premium

For college `c`, let:

- `J_c(S) = |C_c(S)|`, the distinct courses in the closed joint plan for campus
  set `S`; and
- `I_c(s) = |C_c({s})|`, the distinct courses in the corresponding closed plan
  for campus `s` alone.

The course optionality premium is:

```text
J_c(S) - max(I_c(s) for s in S)
```

It answers: how many additional distinct courses does the student take beyond
the most demanding single-campus plan in the selected set? It is not computed
relative to the easiest campus, and it does not depend on which campus was
clicked first.

A different quantity describes sharing:

```text
shared-course savings = sum(I_c(s) for s in S) - J_c(S)
overlap share          = shared-course savings / sum(I_c(s) for s in S)
```

The first compares the joint plan with naively completing every independently
optimized plan. The optionality premium compares the joint plan with one
already-demanding plan. They answer different questions and should not share a
label.

Course count is the primary premium because it matches the course selector's
primary objective and is readily understood as actual scheduled coursework.
However, the premium uses the **closed** plans while the optimizer minimizes
their direct ASSIST portions. Tied direct plans can have different prerequisite
closures, so even the course premium is a modeled comparison rather than a
globally minimized additional-work guarantee. Unit or term differences are also
potentially non-monotone. None of these quantities should be clamped to zero.

For diagnosis, the same formula may be applied to `|D_c(S)|` and labeled the
direct-course optionality premium. That quantity must not be substituted for
the user-facing closed-plan premium without changing its label.

## Statewide averages and denominators

Average mode treats one community college as one observation. It does not
weight colleges by enrollment, district size, or the number of ASSIST records.

For any reported metric `x`, its mean is:

```text
mean(x) = sum(x_c for included colleges c) / number of included colleges
```

Unavailable or null results are excluded from the numerical denominator, never
replaced with zero. Every mean must carry its `n`, and the response must also
report exclusions by reason. Paired metrics such as optionality premium require
the joint result and every relevant single-campus baseline for the same college.
Their course sets must be proven, their prerequisite closures must be resolved,
and a term premium also requires exact fixed-set schedules. Otherwise that
college is excluded from that paired denominator.

Term means are calculated separately for semester and quarter colleges. Course
count means may use all colleges because a course is still one course in either
calendar, but their denominator must still be shown. Strict-completeness rates
use all colleges with the required agreements and data as their denominator;
they do not silently drop strict failures.

Changing the selected campuses changes the analytical cohort. Comparisons
between two campus sets should therefore compare their `n` and exclusion mix as
well as their means.

## Result and solver statuses

The top-level pathway result uses these meanings:

| Status | Meaning |
| --- | --- |
| `optimal` | The minimum direct ASSIST set was proven, prerequisite closure completed under its stated choice rule, and the minimum-term result was proven for that fixed closed set. This is not a joint duration optimization over every ASSIST alternative. |
| `bounded` | A feasible local plan exists, but the direct-course proof or term proof stopped early. `plan_status` and `schedule_status` identify which stage; an exact fixed-set term count may still exist when only course selection is unproven. |
| `estimated` | Course selection and fixed-set scheduling completed, but one or more prerequisite groups lack a reviewed local candidate. The term sequence is conditional on the visible assumption. |
| `unavailable` | A required agreement, coherent locally articulable plan, unit value, or calendar input needed for this result is unavailable, or the scheduling constraints are infeasible. |

`estimated` takes precedence over `bounded`: a conditional schedule is never
counted as bounded feasibility merely because a different solver stage also
timed out. Aggregate output reports `optimal`, `bounded`, `estimated`, and
`unavailable` counts separately. Every mean has a companion `_n`; semester and
quarter term premiums are separate fields and are never pooled.

The term scheduler may provide a more specific reason:

| Scheduler status | Meaning |
| --- | --- |
| `optimal` | `min_terms` is exact for the fixed course set and modeled prerequisites. |
| `bounded` | `lower_bound_terms` and a feasible `upper_bound_terms` schedule are available; no single exact term count should be shown. |
| `invalid_cap` | The requested unit limit is missing, nonnumeric, or nonpositive. |
| `incomplete_units` | At least one scheduled course lacks a positive unit value. |
| `inconsistent_courses` | Duplicate catalog records assign different unit values to the same course ID. |
| `cap_too_low` | At least one individual course exceeds the cap; `minimum_unit_cap` identifies the smallest possible cap for those courses. |
| `incomplete_prerequisites` | A prerequisite any-of group has no course available in the scheduled set. |
| `prerequisite_cycle` | The strict-earlier prerequisite model contains a cycle, so no finite schedule exists. |

A bounded schedule is evidence of feasibility, not proof of minimality. An
unavailable result is missing information, not zero coursework.

## Required limitations in any presentation

Any page, export, or presentation using this analysis should state all of the
following in nearby copy:

1. This is **major preparation only**, not graduation progress or a complete
   transfer plan.
2. The local view plans articulated demand. Missing articulation is reported
   separately and can make a low workload misleading.
3. Term estimates assume every selected course is offered whenever its modeled
   prerequisites permit it.
4. Prerequisite rules are a reviewed statewide concept model, not a complete
   transcription of every college catalog; some modeled strict prerequisites
   may be local co-requisites.
5. The unit cap is not a measure of course difficulty, laboratory time, work
   obligations, or the probability of passing.
6. Statewide averages are unweighted college averages and always require their
   sample sizes and exclusion counts.
7. A bounded term schedule is a range, not an exact duration. If only the
   course-set proof is bounded, any displayed single term count is exact solely
   for that returned fixed set.
8. ASSIST and catalog data are a dated snapshot and can change.

## Saved statewide combination snapshot

The website's average-across-colleges view does not run the optimizer when a
visitor clicks a campus. A manually generated artifact contains every nonempty
subset of the nine configured programs: `2^9 - 1 = 511` unordered campus sets.
The page downloads that guarded artifact once and then resolves campus changes
locally by a nine-bit mask.

Each artifact records its generation time, source fingerprint, method version,
and one or more named load profiles. The first profile uses 15 semester units
and 15 quarter units per regular term. Those loads are read-only in average
mode because changing them would change the saved schedules. Specific-college
mode remains live and accepts custom native-unit limits.

The file is normalized rather than storing 511 ordinary API responses. Program
and college identities and warning text appear once; each combination stores
only the aligned values needed by the average table and summaries. The file is
served through the authenticated API, not as a public frontend asset.

Regeneration is an explicit research operation and never runs during a build,
deployment, or page request:

```text
cd server
npm run snapshot:multi-campus -- --semester-load 15 --quarter-load 15
npm run snapshot:multi-campus -- --check
```

Generation loads and fingerprints the corpus once, checkpoints every completed
mask, and atomically replaces the installed artifact only after all 511
combinations validate. A changed source fingerprint or load profile receives a
separate checkpoint, so interrupted work can resume without mixing datasets.

## API and implementation references

The endpoint accepts one to nine campus IDs as an unordered set:

```text
GET /api/analysis/multi-campus-pathways
  ?schoolIds=79,89,117
  &mode=average
  &semesterLoad=15
  &quarterLoad=15
```

For one college:

```text
GET /api/analysis/multi-campus-pathways
  ?schoolIds=79,89,117
  &mode=college
  &communityCollegeId=51
  &semesterLoad=15
  &quarterLoad=15
```

The saved all-combinations average is available from:

```text
GET /api/analysis/multi-campus-pathways/snapshot
```

Equivalent campus-ID orders are sorted and de-duplicated before calculation and
caching.

Relevant implementation sources:

- `server/services/analysis/pathwayPlanner.js` — joint pathway construction,
  completeness, optionality, and aggregation;
- `server/services/analysis/minCourses.js` — overlap-aware course-set optimizer;
- `server/services/analysis/termScheduler.js` — exact/bounded term scheduling;
- `server/services/prereqGraph.js` — concept rules and per-college structured
  prerequisite projection; and
- `server/controllers/Analysis.js` — request validation and endpoint response.
