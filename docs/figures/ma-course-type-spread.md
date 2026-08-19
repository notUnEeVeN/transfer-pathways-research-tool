# Massachusetts Figure 2 — course-type coverage, on California data

> Current data · 9 UC computer science degree templates × 115 community
> colleges · final-PDF baseline transcribed August 18, 2026

## The short version

The MA paper's Figure 2 asks: of the degree and college courses a computer
science bachelor's requires, **what share has a community-college equivalent,
and does the answer depend on course type?** General education is excluded.
The paper reports 22% computing, 60% math, 93% science and 76% non-STEM.

The website now opens the Massachusetts pane on a frozen transcription of the
final PDF itself: 11 computing dots, 11 math dots, 11 science dots and only 5
non-STEM dots. The corrected raster transcription implies 21.6%, 60.3%, 92.8%
and 76.2%;
the black-diamond/prose results are 22%, 60%, 93% and 76%. The plot does not
label dots by university, so the site preserves them as anonymous observations
and never invents campus identities.

One Computing point (22) and one Science point (93) are fully/effectively
hidden by their black mean diamonds and are inferred from the archived
observation plus the published mean; the Math point near 63 is partly
occluded. The final Computing and Math dot sets differ from the archived
whole-degree arrays. The source selector therefore describes the default as a
nearest-whole-point final-raster transcription with those explicit limits, not
as final course-level data that the authors deposited.

California uses the same whole-degree, GE-excluded denominator by default:

| Course type | CA whole degree (default) | CA lower division | MA final PDF |
| --- | ---: | ---: | ---: |
| Own discipline / Computing | 11.5% (n=9) | 45.7% (n=9) | 22% (n=11) |
| Math | 78.7% (n=9) | 83.0% (n=9) | 60% (n=11) |
| Supporting science | 63.3% (n=7) | 77.9% (n=6) | 93% (n=11) |
| Non-STEM | 0% (n=4) | no observations | 76% (n=5) |

The strongest comparable result is the discipline contrast: California's
whole-degree computing share is about half Massachusetts's, while math is
higher and supporting science is lower. The science mean has only seven
campuses and includes genuine 0% observations at Santa Barbara and Santa Cruz,
so it should not be summarized as universally high. The lower-division
sensitivity shows that some of the computing gap is structural upper-division
work, but not all of it. The Non-STEM result needs its visible sample size:
after GE is correctly
excluded, only four UC CS templates have a non-GE Non-STEM course requirement,
and those requirements are university-only in the current model. It must not
be pooled with the other three categories into one state-wide mean.

The archived Massachusetts requirement reconstruction remains an explicit
source option for reproducibility. It is older than the final PDF and is not
labeled a correction when its values differ.

## All three California majors

Whole-degree, GE-excluded campus-equal means for tomorrow's comparison:

| Major | Own discipline | Quantitative | Supporting discipline | Non-STEM |
| --- | ---: | ---: | ---: | ---: |
| Computer Science | Computing 11.5% (n=9) | Math 78.7% (n=9) | Science 63.3% (n=7) | 0% (n=4) |
| Biology | Biology 42.7% (n=9) | Math 75.3% (n=9) | Chemistry & Physics 88.4% (n=9) | 0% (n=9) |
| Economics | Economics 15.1% (n=9) | Math 64.5% (n=9) | Other Social Science 100% (n=2) | 0% (n=5) |

These are comparable semantic roles, not one shared literal taxonomy. The
supporting-discipline contrast is especially sample-sensitive: Economics has
only two campus observations in that role, while CS has seven and Biology nine.
The second Economics observation is intentional: UCI's two additional Social
Sciences courses are listed under the [School Requirements](https://catalogue.uci.edu/schoolofsocialsciences/#schoolrequirementstext),
separately from General Education, so the paper's degree-and-college-course
population includes them even though the unit model uses a generic GE-area
carrier for the open course choice.

## What one point is

One point per university campus per course type: the share of that campus's
non-GE degree and college requirements of that type that have a community-
college equivalent, averaged over community colleges. The whole-degree scope
is the paper comparison. The lower-division sensitivity drops upper-division
and residency work. The black diamond is the mean of campus points, not of all
campus–college pairs.

A campus that requires nothing of a type contributes no point — the mechanism
that leaves the final paper's Non-STEM column at n=5 and California's at n=4.
Comparison receipts therefore report each semantic course-type role separately;
pooling the unequal category populations would silently change their weights.

## California per-campus values

Whole-degree, GE-excluded percentages in the current computed corpus:

| Campus | Computing | Math | Science | Non-STEM |
| --- | ---: | ---: | ---: | ---: |
| UC Berkeley | 9.2 | 78.6 | 97.7 | 0.0 |
| UC Davis | 9.4 | 93.9 | 100.0 | 0.0 |
| UC Irvine | 13.9 | 57.7 | — | — |
| UC Merced | 19.6 | 77.8 | 75.2 | — |
| UC Riverside | 14.5 | 69.7 | 72.4 | — |
| UC San Diego | 7.1 | 76.4 | — | — |
| UC Santa Barbara | 12.9 | 83.2 | 0.0 | — |
| UC Santa Cruz | 9.2 | 78.7 | 0.0 | 0.0 |
| UCLA | 8.1 | 92.7 | 98.0 | 0.0 |

An em dash means the campus has no requirement in that category and therefore
contributes no point; it is not a zero. In the lower-division sensitivity,
computing ranges from 18.4% at Berkeley to 72.6% at Riverside. There are no
lower-division, non-GE Non-STEM observations in these nine templates.

## Where the data comes from

The California denominator is the curated `kind: degree` requirement template
for each campus — the same nine templates behind the MA Figure 1 port
(`coverage-heatmap`) — with GE and free-elective padding groups excluded from
the course-type tally. Whole-degree mode retains upper-division non-GE work,
which no community college can offer. Equivalency comes from the same ASSIST
evaluation used by Figure 1.

The server returns the per-type split alongside the existing totals as
`degree_requirements_by_course_type`. Series are expanded course by course;
choose-N blocks contribute the number of courses actually requested. The typed
totals re-sum exactly to the Figure 1 named, GE-excluded population; they
intentionally do not re-sum to the broader graduation-plan requirement count.
Nothing is recomputed in the figure.

## How a requirement gets its type

The MA rule is "allocate the courses into the categories based on the course
codes at the Four Years — with the exception of Discrete Math, which we
categorized always as math, despite some variation". Applied to the UC side
(`server/services/courseTypes.js`):

1. **A requirement that names a university course** is typed by that course's
   catalog prefix. Computing: CS, CSE, ECS, CMPSC, COM SCI, COMPSCI, I&C SCI,
   IN4MATX, EECS, COGS, ICS. Math: MATH, MAT, STAT, STATS, PSTAT, AM. Science
   (engineering included, as in MA): PHYS/PHYSICS/PHY, CHEM/CHE, BILD, BIOL,
   BIOLOGY, MCELLBI, ASTRON, BIS, ENGR, EE, ECE, EC ENGR, MAE, ME, NANO, ENSC,
   BIEN, ESM. Anything else is Non-STEM, which is the right default for the
   writing and humanities codes in these templates (WCWP, ENGLISH, LING).
2. **Discrete math overrides the prefix**: UC San Diego's CSE 20 and UC Santa
   Barbara's CMPSC 40 are math, not computing.
3. **A cross-listed code resolves to its computing side** — UC Riverside's
   EE/CS 120A is computing.
4. **A requirement's own title decides it, not its commentary.** Only the text
   before an em dash or parenthesis is matched first, so UC Irvine's "Science &
   Technology — 3 courses ... outside Engineering/ICS/Economics/Mathematics"
   is science rather than computing.
5. **Requirements stored as free text** — upper-division blocks, elective
   pools, GE areas — have no code to read, so an ordered rule list types them.
   First match wins:

   | Order | Matches | Type |
   | --- | --- | --- |
   | 1 | discrete math / discrete structures | Math |
   | 2 | upper-division major or elective coursework, major field / technical / systems / theory-abstraction electives, applications of computing, project in computer science | Computing |
   | 3 | writing, composition, disciplinary communication, ethics | Non-STEM |
   | 4 | humanities, social science/analysis, arts, literature, history, culture, breadth, perspectives, ethnicity | Non-STEM |
   | 5 | unrestricted electives, additional upper-division units, Cal-GETC, "GE:" | Non-STEM |
   | 6 | a computing course code, software, algorithm, compiler, operating system, comput* | Computing |
   | 7 | probability, statistics, math | Math |
   | 8 | a science code, physics, chemistry, biology, life science, scientific, engineering, lab | Science |

Rule 2 sits above rule 3 deliberately. UC Irvine stores its whole
upper-division major as one 17-course block whose title mentions that one of the
courses (I&C SCI 139W) also satisfies upper-division writing; without that
ordering the entire CS major would land in Non-STEM. The reverse case is
preserved: UC Santa Cruz's "Disciplinary Communication (DC) — CSE 115A, CSE
185E" is a communication requirement satisfied by a CS course, and stays
Non-STEM.

These free-text rules are the only judgment in the reconstructed figure. The
archived observation-by-observation assignment remains available as a diagnostic, but it is
not the source for the default final-paper view.

## Where this differs from theirs

- **The default denominator now matches.** Both states use degree and college
  course requirements, retain upper-division work, and exclude general
  education. The lower-division control is a labeled sensitivity, not the
  source-paper result.
- **Their 22% computing is the whole-degree measure**, so it compares to our
  11.5%, not to the 45.7% lower-division sensitivity.
- **Their unit of aggregation was 11 four-years × 15 community colleges; ours
  is 9 campuses × 115 colleges.** More colleges per point makes our points
  smoother, so the vertical spread within a column is narrower than theirs by
  construction.
- **Their equivalency came from three hand-assembled sources** (the A2B
  database, four-year websites, and the MassTransfer equivalency database);
  ours is the curated UC requirement templates evaluated against ASSIST.
- **UC computer science majors are large and heavily upper-division**, which is
  what the whole-degree scope mostly measures. UC Irvine is the clearest case:
  26 computing-course observations, 17 of them one upper-division block that nothing at a
  community college can satisfy.
- **The final paper's university dots are anonymous.** The website can compare
  category distributions, but cannot honestly pair an MA dot with a named UC
  campus or with an archived MA campus row.

## Reproduce locally

The live figure reads
`/api/analysis/coverage?majorSlug=cs&requirements=degree&groupBy=college&pin=settings`.
The server applies the same `courseTypes.excludeGeGroups` configuration as
Figure 1's named-course denominator and returns the four typed buckets in
`degree_requirements_by_course_type` on every row.
