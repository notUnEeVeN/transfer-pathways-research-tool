# District preparation for multiple UC campuses

> **Archived predecessor.** This one-plan-per-district, exact-reach analysis is
> retained as a methodology record, but it no longer drives the gallery visual.
> Exact-reach groups change both district and campus composition from row to
> row, so their workload means cannot answer how preparation grows as a student
> keeps more options open. The current figure and its corrected joint
> prerequisite-closed optimizer are documented in
> [district-portfolio-subsets.md](district-portfolio-subsets.md).

This figure asks a student-centered question:

> If a student can cross-enroll at the community colleges in their district,
> which selected UC computer-science programs can they fully prepare for, and
> what one combined course plan would keep all of those options open?

It replaces the earlier college-average visual. That visual optimized only the
portion of each ASSIST agreement that happened to articulate at one home
college. Missing requirements were diagnosed, but omitted from the headline
workload. The result could look artificially flat precisely where a pathway had
the largest gaps.

The district analysis never converts missing preparation to zero work. A UC
program is included in a district's combined plan only when the district has a
complete, usable path through every required part of one pinned ASSIST
template. Requirements without a path remain visible as blockers for later
eight- and nine-campus analysis.

## Frozen result

The committed artifact was generated from the current research database on
2026-07-21 (Pacific time). It contains 115 colleges grouped into 72 districts.

| Strictly reachable pinned UC programs | Districts | Mean modeled courses, including known prerequisites | Mean exact modeled academic years |
| ---: | ---: | ---: | ---: |
| 0 | 4 | — | — |
| 1 | 1 | 14.0 | 2.5 |
| 2 | 5 | 12.2 | 2.4 |
| 3 | 8 | 14.5 | 2.4 |
| 4 | 9 | 16.7 | 2.6 |
| 5 | 19 | 16.5 | 2.5 |
| 6 | 13 | 19.6 | 2.8 |
| 7 | 13 | 20.2 | 2.9 |
| 8 | 0 | — | — |
| 9 | 0 | — | — |

There are 335 complete district-by-program cells out of 648, or 4.65 programs
per district before display rounding. The course signal is substantially more
informative than the old locally-articulable workload: districts reaching six
or seven programs average roughly 20 modeled courses, compared with 14 for the
single district reaching one.

Academic years are secondary. Schedules remain concentrated around five or six
regular semester terms, and the model does not contain historical offerings,
seat availability, or timetable conflicts.

## One pinned requirement template per UC

The selected major name alone does not identify one stable requirement tree.
For the same program, the corpus contains 41 parsed UC Davis variants and 21 UC
Berkeley variants across sending colleges. The earlier district coverage code
used whichever agreement MongoDB returned first as the structural template,
which made its denominator order-dependent.

The replacement commits one raw ASSIST template and one deterministic parsed
representative per program in
`server/data/analysis/district-pathway-programs.v1.json`. The raw-template
selection is the modal version observed across the 115 agreements for that
program. Every generated snapshot verifies the program name, raw template
hash, parsed fingerprint, representative agreement ID, and representative
college before computing a result.

The pinned programs are UCSD Computer Science, UCR Computer Science, UCB EECS,
UCD Computer Science, UCLA Computer Science, UCI Computer Science, UCSB
Computer Science, UCSC Computer Science, and UCM Computer Science and
Engineering. The exact ASSIST names and hashes live in the pin file rather than
in display code.

### Why this result differs from the other district coverage figures

The existing current-data heatmap reports 356 complete cells and a mean of
4.94 programs per district. Those numbers use its first-returned-agreement
template rule. Applying fixed modal templates reduces the count to 336. This
planner then requires an actual complete sending-course path, not only an
`articulated` flag; one College of the Redwoods → Berkeley requirement has no
usable catalog path, reducing the final count to 335.

The difference is methodological, not a two-state data refresh. Workload and
reachability in this figure share one pinned denominator; old heatmap totals
must not be combined with the new workload values as if they were the same
measure.

## District pooling

Let `D` be a district and `C(D)` its member colleges. For each receiver in the
pinned UC template:

1. Find receivers with the same exact ASSIST receiver hash in the selected
   program agreements for colleges in `C(D)`.
2. Expand each source receiver into every complete satisfying course path.
3. Retain those paths as alternatives for the pinned receiver.
4. Mark the receiver unavailable when no complete path remains.

The expansion in step 2 is essential. ASSIST can encode a receiver as option A
**and** option B, while either option can itself allow several courses. Rawly
concatenating options from colleges would turn some required sequences into
false choices. The district planner reuses the exact optimizer's receiver-path
expansion, then represents each complete path as one indivisible alternative.

A path may come from any one member college. Its components are never split
across colleges. Sending course IDs are globally unique in this corpus, so the
same physical catalog course can satisfy several UC receivers and is counted
once, while similar-looking courses at two colleges remain two completions.

## Strict reachability and blockers

The strict eligibility engine evaluates the pinned tree with every district
path available. It preserves required groups, section and group advisements,
choose-N rules, series, AND/OR course bundles, and curation exclusions.

A program is reachable only if taking all available district paths can satisfy
the complete required tree. For an unreachable program, the snapshot retains a
minimum blocker witness. The planner temporarily adds one synthetic placeholder
to each unavailable receiver and runs the same choose-N-aware optimizer. Only
selected placeholders become blockers. Thus a “choose one of three” section
with three unavailable alternatives produces one blocker witness, not three.

The blockers are diagnostic requirement identities, not claims that one new
community-college course would always close a series or institutional policy
requirement. Receiving UC course codes are stored when the receiver maps to UC
course records.

## The combined course plan

For every district with at least one reachable program, the planner jointly
solves all of that district's reachable programs. It does not independently
optimize each UC and union the results.

The direct-course objective is lexicographic:

1. minimize distinct actual community-college courses;
2. among equal-course plans, minimize native units; and
3. use stable course IDs as the deterministic final tie-break.

This makes overlap real rather than theoretical. A course is shared only when
the selected ASSIST paths refer to the same physical catalog completion or an
explicit `same_as` identity.

The search begins with a feasible greedy plan and uses an exhaustive
group-frontier branch-and-bound correction for choose-N structures. It reports
`optimal` only when the minimum is proven. Of 68 nonempty district plans, 49
course searches prove the optimum under the generation budget; 19 retain a
feasible best-found plan labeled `bounded`.

The displayed `distinct_courses` includes direct major preparation plus known
prerequisite-only additions. The two portions remain separate in every row.

## Prerequisites and terms

Prerequisites come from the reviewed concept graph. The projection remains
local to the college offering the selected course: district membership does not
by itself assert that another college's similar course will be accepted as its
prerequisite. This is conservative and avoids inventing cross-college
equivalencies.

The selected direct set is closed under known prerequisite groups. A course can
have an all-of list of any-of groups, so interchangeable prerequisite courses
remain alternatives. Two districts—Kern and West Kern—have incomplete reviewed
prerequisite evidence and are labeled `estimated` rather than exact.

All 72 districts have a consistent internal calendar: 70 are semester and two
are quarter. The scheduler therefore uses native units and a 15-unit cap per
regular term. It minimizes terms for the fixed, closed course set while placing
modeled prerequisites earlier than dependent courses.

For comparison in one figure, native terms are converted to academic years:

```text
semester district: academic years = terms / 2
quarter district:  academic years = terms / 3
```

This does not equate semester and quarter units; it only gives the time panel a
common calendar scale. Sixty-six of 68 schedules are exact for their fixed
course set. Peralta has a certified eight-semester result whose search status
remains bounded, and San Diego has a certified seven-to-eight-semester range.
The artifact retains native terms and every lower and upper bound.

An exact schedule is not a globally fastest pathway across all possible course
sets. Course selection first minimizes major-preparation courses, prerequisite
closure runs second, and the scheduler optimizes that fixed closed set third.

## Scope and interpretation

Included:

- required major preparation in the nine pinned ASSIST templates;
- actual articulation paths at every member college in a district;
- cross-campus course overlap;
- known local prerequisites; and
- native-calendar regular-term scheduling under a 15-unit cap.

Not included:

- general education, the UC seven-course pattern, or associate-degree rules;
- admission GPA, selective-major review, or transfer guarantees;
- a student's completed transcript;
- course availability by term, seats, timetable conflicts, travel, or
  cross-enrollment administration;
- summer terms; or
- upper-division and other post-transfer degree requirements.

The result is an optimistic structural preparation model. “Three academic
years” means three modeled regular years for this major-preparation course set,
not a promise that an individual student can register for, pass, or use every
course on that timeline.

## Reproduction

Generate the frozen frontend artifact:

```bash
cd server
npm run snapshot:district-pathways -- \
  --optimizer-budget-ms 2000 \
  --schedule-budget-ms 2000 \
  --blocker-budget-ms 400
```

Validate the installed artifact without connecting to MongoDB:

```bash
cd server
npm run snapshot:district-pathways -- --check
```

The generator writes
`frontend/src/analyses/data/district-multi-campus-pathways.v1.json` atomically.
The artifact records its generation time, source fingerprint, artifact
fingerprint, pinned programs, assumptions, district-level course details,
blockers, solver telemetry, group summaries, and all 72 district rows.
