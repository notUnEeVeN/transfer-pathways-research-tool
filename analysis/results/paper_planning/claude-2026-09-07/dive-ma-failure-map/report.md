# Where and why does Massachusetts fail? (dive-ma-failure-map, 2026-09-07)

Scope: MA `ma-cs` corpus only. Matrix = `server/data/ma/raw/heatmap.json`, which is the
deterministic conversion of the FINAL repo workbook `final/Four Year Heatmap.xlsx`
(the vintage that reproduces the final PDF 165/165). 11 universities x 15 CCs = 165 pairs,
270 requirement columns; course counts; GE excluded by the authors; upper division kept in
the denominator. The Fig 3 pairs come from `raw/baselines.json` (final workbook fractions)
and `pdf-figures.json` (final PDF integers) — 61 pathways, 49 for Figs 4-6. The older
`recovered/Community College Heatmap.xlsx` is the same matrix transposed at the OLDER
vintage: only 2 of 165 cells differ from the final (Bunker Hill->Fitchburg 66.7->65.2 because
the older sheet carried an extra Precalculus column; Cape Cod->Dartmouth 35.5->45.2, the known
revision). Everything below is therefore reported on the final vintage. Scripts and JSON:
`scratchpad/dive-ma-failure-map/analyze.py`, `results.json`.

Statewide Fig 1 mean recomputed from the matrix: **38.27 %** (VERIFIED, exact 0.382671; the
PDF prose says 38.2 %, the printed matrix averages 38.3 %).

Tag legend: VERIFIED = reproduced from the artefact; INFERRED = derived/regex-based or
interpretive; CONTEXT = the paper's own words.

---

## 0. The paper's own account (final PDF, CONTEXT, quoted)

- Three data sources: "The first was MassTransfer's A2B Transfer Database ... participation in
  the database is voluntary and, as of this writing, only four of the 11 four-years have any CS
  A2B pathways included. Indeed, only 38 out of the 165 pairs studied (23%) were in the A2B
  Database ... To analyze the remaining pairs, we found articulation agreements located on the
  websites of the Four Years and located in the MassTransfer Course Equivalency Database."
- "Our analysis included degree and college requirements but excluded general education
  requirements. The results of this analysis gave us the upper bound on the number of required
  courses that could transfer."
- "Perhaps not surprisingly, the Four Years with the highest equivalency rates are the pathways
  found in the A2B Database" — only half true, see §2 (Lowell is 2nd-highest with no A2B;
  Dartmouth is 7th with A2B).
- "there were four Community Colleges for which no pathway was included" — VERIFIED from the MT
  flags: Bunker Hill, Holyoke, Mount Wachusett, Roxbury never carry an MT flag.
- Recommendation: "there are more courses that could articulate but are just not included in the
  state's A2B Database. Filling in these gaps is the lowest hanging fruit."
- Workbook annotation on the UMass Boston sheet (final repo, row 22): "All of this is unofficial
  through transferology, but UMB doesnt have any official transfer stuff." — i.e. Boston's 22 %
  rests on Transferology look-ups, not on any published agreement.
- The `OG Work` sheet (final repo) records, per pair, the free-text list of what articulates. For
  the four A2B universities the MT rows are near-verbatim copies of one template ("Calc I, Calc
  II, Phys I, Phys II, CS I, CS II, Structures, Organization, CS Elective, CS Elective, Linear,
  Discrete"); for the non-A2B universities the entries are course-equivalency look-ups dominated
  by "N CS Electives" (Lowell: "Computing I, Computing II, ... 20 CS Electives"), i.e. CC courses
  that transfer as unnamed electives rather than as named requirements.

---

## 1. Per requirement column: which requirements fail (Q1)

Method: for each of the 270 columns, share of the 15 CCs whose cell is True. Columns typed by
university prefix (COMP/CSC/CSCI/CICS/COMPSCI/CS/CIS/CAIS/EECE/EGR -> computing; MATH/MAT/MTH/
STAT/MA -> math; PHYS/PHYSIC + "Natural Science" slots -> science; ENGL/CM/EN/UR -> non-STEM;
Discrete always math, as the paper states). Lower-division named columns also bucketed into
concepts by header regex (INFERRED bucketing; the numbers inside each bucket are VERIFIED
cell counts).

### 1a. By type (pooled cells, final vintage, VERIFIED)

| type | all levels | lower division only | upper division only |
|---|---|---|---|
| computing | 21.9 % (598/2730) | 38.7 % (441/1140) | 9.9 % (157/1590) |
| math | 62.1 % (438/705) | 69.7 % (408/585) | 25.0 % (30/120) |
| science | 96.3 % (390/405) | 96.3 % | — |
| non-STEM | 67.5 % (81/120) | 72.4 % (76/105) | 33 % (5/15) |
| free/general elective slots | 100 % (75/75) | 100 % | — |

Paper-style (mean of per-university shares) with this typing: computing 22.2, math 59.2,
science 95.2, non-STEM 61.7 (n=4) versus the PDF's 22/60/93/76 (n=5), which come from the
hand-typed `Tallys` sheet. 27 of the 88 Tallys (section x university x type) cells do not
reproduce under prefix typing; every mismatch is a slot/elective column assigned to a different
type by hand (e.g. Lowell's science potential 90 = 6 columns counts the two Technical Electives
as science; Westfield's non-STEM 15/15 is the known Tallys error). The headline ordering
(science >> math >> computing) is robust to typing.

### 1b. By concept, lower-division named requirements, pooled over universities (VERIFIED counts)

| concept | articulated / potential | columns | universities |
|---|---|---|---|
| applied computing (networks/db/web/OS/ethics) | **14.8 %** (20/135) | 9 | 5 |
| CS3+/programming methodology (Computing III/IV, Java III/IV, Prog. Methodology, Software Spec) | **15.2 %** (16/105) | 7 | 6 |
| CS0 / intro-survey / seminar (Intro to IT, CS Principles, Survey, Basics, EGR 111) | **20.0 %** (24/120) | 8 | 7 |
| data structures (CS3) | 36.3 % (49/135) | 9 | 8 |
| discrete math | 38.5 % (75/195) | 13 | 11 |
| statistics / probability | 40.0 % (30/75) | 5 | 5 |
| computer organisation / systems / C / digital logic | 40.7 % (110/270) | 18 | 10 |
| CS2 | 50.7 % (76/150) | 10 | 9 |
| linear algebra | 61.7 % (37/60) | 4 | 4 |
| CS1 | 64.0 % (96/150) | 10 | 10 |
| CSC / technical elective slots | 68.0 % (51/75) | 5 | 2 |
| writing / communication | 83.3 % (75/90) | 6 | 3 |
| calculus II | 91.7 % (110/120) | 8 | 8 |
| calculus I | 94.7 % (142/150) | 10 | 9 |
| natural science / physics slots | 96.3 % (390/405) | 27 | 11 |
| free / general elective slots | 100 % (75/75) | 5 | 2 |

Reading: math-and-science preparation is essentially solved (calculus 92-95 %, science 96 %).
The failure is inside the computing core, and it deepens with each course in the sequence:
CS1 64 % -> CS2 51 % -> data structures 36 % -> CS3+/methodology 15 %. Discrete math (38.5 %)
is the one math course that fails like a computing course. Universities that put university-
specific "flavour" courses in the lower division (Framingham's Professional Exploration Seminar
and Intro to IT, MCLA's Java III/IV and Network Theory, Amherst's Programming Methodology / C /
Systems Principles / Reasoning About Uncertainty, Westfield's Digital Electronics and Security,
Worcester's Discrete Structures I+II and Algorithm Analysis) get 0-3 of 15.

### 1c. Most-failing named lower-division columns by university (VERIFIED, count of 15)

- Framingham (11.7 %): CS II using Java 0, Professional Exploration Seminar 0, Intro to OS using
  UNIX 0, Probability & Statistics 0, Data Structures 1, CS I using Java 2, Discrete 5, Intro to
  IT 8. Only the Natural Science slot is 15.
- MCLA (17.6 %): Data Structures 0, Digital Circuit Design 0, Network Theory 0, Java III 0,
  Java IV 0, Intro to CS 3, Database 4, Web Dev 4, Discrete 6, Java II 8, Java I 9.
- UMass Boston (22.2 %): Introduction to Computing 0, Linear Algebra 0, Social Issues 2,
  Applied Discrete 5, Programming in C 7, Physics I+Lab 8, Physics II+Lab 8, Data Structures 10;
  Calc I/II 15. Boston has NO slot columns at all, so nothing is free.
- Westfield (26.7 %): Digital Electronics 0, Comp Org 1, Program Design II 1, Software Eng 1,
  Security 2, CS Principles 3, Data Structures 4, Program Design I 7, Discrete 9.
- Worcester (40.3 %): Algorithm Analysis 0, Discrete I 0, Public Policy 1, Database 2, Unix 2,
  Discrete II 3, Comp Org 4, Basics 5, Networking 5, Data Structures 6.
- By contrast Fitchburg's weakest lower column is Computer Organization at 11/15 and Lowell's is
  Computing IV at 3/15 (Computing III 7, Assembly 9, Discrete 9, Computing I 10, Computing II 11).

Upper-division columns almost never articulate (9.9 % of computing cells). The exceptions are
themselves informative: Fitchburg's five "Upper Level Elective (3000)" slots (15/13/8/8/6) and
CSC 3700 Algorithms & Data Structures (15/15) — this is why Fitchburg alone exceeds its lower-
division ceiling; Bridgewater COMP 340/350 (10 each, MT CCs only); Amherst two 300-level
electives (11 each, MT CCs); Salem's Math Elective post-Calc II (13); Worcester Statistics (14).

---

## 2. The MT / A2B split (Q2)

All numbers final vintage, VERIFIED from the MT column of the final heatmap.

Overall: **38 A2B-mapped pairs = 56.9 %; 127 non-mapped pairs = 32.7 %** (lower-division only:
83.4 % vs 49.7 %). Reproduces the orchestrator figure.

Within the four universities that have any A2B pairs (all-level / lower-only):

| university | MT pairs | MT mean | non-MT mean | MT lower | non-MT lower | non-MT CCs |
|---|---|---|---|---|---|---|
| Bridgewater | 10 | 53.6 | 21.8 | 89.1 | 43.6 | Berkshire, Bunker Hill, Holyoke, Mt Wachusett, Roxbury |
| Fitchburg | 11 | 74.3 | 58.7 | 99.2 | 75.0 | Bunker Hill, Holyoke, Mt Wachusett, Roxbury |
| UMass Amherst | 11 | 49.2 | 30.7 | 63.0 | 48.2 | same four |
| UMass Dartmouth | 6 | 44.6 | 31.9 | 82.3 | 58.3 | the four + Berkshire, MassBay, Middlesex, North Shore, Northern Essex |

Separating "A2B universities are better" from "A2B pairs are better":
- The 22 non-mapped pairs AT the four A2B universities average **34.3 %** (lower 56.2 %); the
  105 pairs at the seven non-A2B universities average **32.4 %** (lower 48.3 %). The A2B
  universities are therefore NOT better institutions on their unmapped pairs; the whole
  university-level premium (48.6 % vs 32.4 %) is carried by the mapped pairs (56.9 %).
- Two-way fixed-effects OLS, coverage ~ CC + university + MT: **MT coefficient +16.8 pp**
  (all-level; +23.0 pp lower-only), R2 0.837 -> 0.878 (0.789 -> 0.836 lower). The A2B effect
  survives controlling for both the sending and the receiving institution.
- Lowell (61.7 %, second-highest) has no A2B pathway at all; its coverage comes from the
  MassTransfer equivalency database plus a degree sheet with 10 lower-division slot columns
  (see §4). Dartmouth (37.0 %) has A2B pathways but ranks 7th because 15 of its 31 columns are
  upper division and 9 of its 15 CCs are unmapped.
- The A2B map is a template, not a pairwise negotiation: Bridgewater's 10 MT rows collapse to 3
  distinct patterns (8 identical), Amherst's 11 to 2 (9 identical); Fitchburg's 11 to 8 and
  Dartmouth's 6 to 5 (VERIFIED). Columns TRUE in every MT row at Bridgewater: CS I, CS II, Comp
  Org, Data Structures, Calc I, Calc II, two Natural Science, COMP 340, COMP 350; FALSE in every
  MT row: Statistics, and every other upper-division column. At Amherst the template never
  covers COMPSCI 220/198C/230/240/250 or CS 311 (0/15 each).
- Counterfactuals (VERIFIED arithmetic, INFERRED policy reading): lifting the 22 unmapped pairs
  at the four A2B universities to their own university's MT mean moves the state mean only
  38.3 -> 40.8 %. Applying the +16.8 pp FE effect to every unmapped cell in the state (i.e. every
  university joins A2B) gives ~51 %. If every lower-division column articulated everywhere
  (upper division unchanged) the state mean would be 61.8 % — the structural ceiling of the
  measure as the authors built it.

---

## 3. Sending side vs receiving side (Q3)

Two-way additive decomposition of the 15 x 11 matrix (balanced, so the row/column sums of
squares are orthogonal; VERIFIED):

| matrix | CC (sending) share | university (receiving) share | interaction/residual |
|---|---|---|---|
| all-level ratios | **7.4 %** | **76.3 %** | 16.3 % |
| lower-division ratios | 9.2 % | 69.8 % | 21.1 % |
| logit(all-level) | 7.4 % | 75.2 % | 17.5 % |
| 7 non-A2B universities only | 6.0 % | 79.1 % | 14.9 % |
| 4 A2B universities only (all / lower) | 29.1 % / 39.7 % | 56.5 % / 38.2 % | 14.4 % / 22.1 % |

- University means run 11.7 % (Framingham) to 70.1 % (Fitchburg), SD 18.0 pp. CC means run
  27.7 % (Mount Wachusett) to 47.2 % (Quinsigamond), SD 5.5 pp. **The failure is overwhelmingly
  receiving-side**: which university a student aims at explains ten times more variance than
  which CC they attend.
- The CC effect that does exist is almost entirely an A2B-membership effect: inside the four A2B
  universities the CC share rises to 29-40 % because the MT/non-MT split is a property of the CC
  row; inside the seven non-A2B universities it drops to 6 %.
- CC ranking (all-level mean, VERIFIED): Mount Wachusett 27.7, Roxbury 28.1, Holyoke 33.5,
  Berkshire 35.2, Greenfield 35.8, Bunker Hill 36.7, Bristol 39.3, Springfield Tech 39.3,
  Northern Essex 39.9, Cape Cod 40.5, Massasoit 40.7, Middlesex 43.0, North Shore 43.2, MassBay
  43.9, Quinsigamond 47.2. The four never-A2B CCs occupy the bottom three slots plus sixth; the
  paper's "four Community Colleges for which no pathway was included" are the same four.
- Is the low CC row a curriculum gap or an information gap? Keyword scan of each CC's AS degree
  (`raw/as_degrees.json`, older vintage; INFERRED detection) against the heatmap:
  - **Mount Wachusett** lists every concept (Calc I/II, Discrete, Linear Algebra, Data Structures,
    CS I/II, Systems Programming, Statistics, Lab Science) yet articulates Data Structures 0/9,
    CS1 3/10, CS2 2/10, Comp-Org 3/18, Discrete 2/13. This is the clearest pure information/
    agreement failure: the courses exist, no equivalency has been recorded.
  - **Roxbury** is a genuine curriculum gap: no Calc II, no physics, no discrete, no data
    structures; its CS courses are COBOL, Visual Basic, Web Design, Internship (OG Work sheet:
    "Cobol I, Cobol II, Programming in Basic, 25 CS Electives").
  - **Berkshire** and **Bunker Hill** lack Discrete and Linear Algebra (Discrete 1/13 each) but
    have calculus, physics, data structures — mixed.
  - Statewide, Discrete articulates 50 % (65/130) where the AS contains a discrete course and 15 %
    (10/65) where it does not; Data Structures 39 % vs 26 %; Calculus II 92 % where present. So
    curriculum content matters at the margin, but the A2B/equivalency-record layer is the larger
    lever.

---

## 4. Ceiling vs genuine lower-division non-articulation (Q4)

all_ratio = lower_ratio x (L/N) + upper_ratio x (U/N). Gap to 100 % split into the upper-division
part and the lower-division part (VERIFIED):

| university | N | L/N ceiling | all | lower | upper | gap from upper | gap from lower | lower named cols @rate | lower slot cols @rate | slot contribution to all |
|---|---|---|---|---|---|---|---|---|---|---|
| Framingham | 20 | 0.45 | 11.7 | 23.0 | 2.4 | 53.7 pp | 34.7 pp | 8 @ 0.13 | 1 @ 1.00 | 5.0 pp |
| MCLA | 25 | 0.52 | 17.6 | 29.7 | 4.4 | 45.9 | 36.5 | 12 @ 0.32 | 1 @ 0.00 | 0 |
| UMass Boston | 21 | 0.48 | 22.2 | 46.7 | 0.0 | 52.4 | 25.4 | 10 @ 0.47 | 0 | 0 |
| Westfield | 26 | 0.50 | 26.7 | 44.6 | 8.7 | 45.6 | 27.7 | 11 @ 0.35 | 2 @ 1.00 | 7.7 |
| UMass Dartmouth | 31 | 0.52 | 37.0 | 67.9 | 4.0 | 46.5 | 16.6 | 11 @ 0.54 | 5 @ 0.99 | 15.9 |
| Worcester | 25 | 0.72 | 40.3 | 49.3 | 17.1 | 23.2 | 36.5 | 14 @ 0.35 | 4 @ 1.00 | 16.0 |
| Bridgewater | 22 | 0.50 | 43.0 | 73.9 | 12.1 | 43.9 | 13.0 | 9 @ 0.68 | 2 @ 1.00 | 9.1 |
| UMass Amherst | 22 | 0.64 | 44.2 | 59.0 | 18.3 | 29.7 | 26.1 | 12 @ 0.52 | 2 @ 1.00 | 9.1 |
| Salem | 24 | 0.71 | 46.4 | 58.4 | 17.1 | 24.2 | 29.4 | 10 @ 0.45 | 7 @ 0.77 | 22.5 |
| UMass Lowell | 31 | 0.71 | 61.7 | 86.7 | 0.7 | 28.8 | 9.5 | 12 @ 0.76 | 10 @ 1.00 | 32.3 |
| Fitchburg | 23 | 0.52 | 70.1 | 92.8 | 45.5 | 26.1 | 3.8 | 10 @ 0.91 | 2 @ 1.00 | 8.7 |

Answer: both, and they are separable.
- The ceiling (L/N) is 0.45-0.52 at the four lowest universities, so they could not exceed about
  half even with perfect lower-division articulation. But they sit 23-34 pp BELOW that ceiling
  because their named lower-division computing courses genuinely do not articulate: Framingham
  loses 5.3 of 6 lower computing columns on average, MCLA 8.1 of 10, Westfield 6.7 of 8, Boston
  2.7 of 4 (plus 1.7 of 4 math and 0.9 of 2 physics-with-lab). Lower-division computing is the
  dominant lower-division loss at every university except Boston (math and science also) and
  Dartmouth (math 2.4 of 5: its two Discrete courses and applied calculus).
- The top of the table is partly a degree-sheet artefact. Lowell's 61.7 % is 32.3 pp of slot
  columns (4 general electives, 4 natural science, 2 technical electives at 100 %) plus 29.2 pp of
  named courses; Salem gets 22.5 pp from slots, Worcester and Dartmouth 16 pp. Boston and MCLA
  get 0. On named lower-division courses alone the spread is 13 % (Framingham) to 91 %
  (Fitchburg), with Lowell 76 %, Bridgewater 68 %, Dartmouth 54 %, Amherst 52 %. A university
  that writes "Natural Science Elective" four times inflates its column count and its coverage;
  this denominator composition is a cross-state comparability hazard (INFERRED).
- Fitchburg is the only campus that breaks through its ceiling, because its upper-division
  elective slots and CSC 3700 accept CC courses (upper rate 45.5 %; everyone else 0-18 %).

---

## 5. Fig 3 vs Fig 1 on the 61 studied pathways (Q5)

Fig 3 = final workbook `pct_as` fractions (identical to the final PDF integers after rounding);
Fig 1 = final matrix ratios for the same pair. VERIFIED.

- Pearson r(Fig 3, Fig 1 all-level) = **0.82**; r(Fig 3, Fig 1 lower-only) = **0.85**.
  OLS: Fig 3 ~ 0.18 + 0.79 x Fig1_lower. Means on the same 61 pairs: Fig 3 67.8 %, Fig 1 all
  42.4 %, Fig 1 lower 62.7 %. So Fig 3 tracks lower-division articulation closely with an
  ~18 pp floor (the AS's GE/English/science credits apply almost anywhere).
- The 13 MT pairs among the 61 average Fig 3 = 94.8 % vs 60.4 % for the 48 non-MT pairs.
- Fig 4 (extra hours) is the mirror image of Fig 3: r = -0.86 (49 pairs); Fig 4 vs Fig 1
  r = -0.77; Fig 6 (complexity delta) vs Fig 1 r = -0.50, vs Fig 3 r = -0.67.

Mechanism cases (residual of Fig 3 on Fig 1 lower; VERIFIED values, INFERRED mechanisms):

High articulation but low credit use (AS carries credits the BS cannot absorb):
- Roxbury -> Fitchburg: Fig 1 lower 67 %, Fig 3 41 % (resid -30 pp); Roxbury -> Lowell 73 % vs
  52 %; Roxbury -> Salem 53 % vs 38 %. Roxbury's AS is 60+ credits of College Experience, COBOL/
  VB, Web Design, Internship, Networks: the university's named requirements may be articulable,
  but most of the AS is not in the BS.
- Northern Essex -> Lowell: 95 % vs 73 % (-20); -> Boston 60 % vs 48 %. Northern Essex's AS
  carries Data Management, Information Security, Linux (1 cr), Microcomputers, C Programming.
- Bunker Hill -> Framingham 33 % vs 28 %; Middlesex -> Salem 65 % vs 53 %; Holyoke -> Amherst
  57 % vs 48 %; Bunker Hill/MassBay -> Boston 60 % vs 51 %.
  Pattern: "applied-IT" AS degrees and universities with no elective slots (Boston, Framingham).

Low articulation but high credit use (the BS absorbs AS credit outside named requirements):
- Greenfield -> Amherst: Fig 1 lower 64 %, Fig 3 97 % (+28); Springfield Tech -> Amherst 64 % vs
  95 % (+26). Amherst's two 300-level elective columns and its GE/elective residue absorb the
  A2B-template courses even though COMPSCI 220/230/240/250 never articulate.
- Middlesex -> Worcester 50 % vs 82 % (+24); Mount Wachusett -> Worcester 39 % vs 70 % (+21);
  Quinsigamond -> Worcester 83 % vs 100 %; Massasoit -> Salem 41 % vs 71 %; Massasoit ->
  Framingham 22 % vs 55 %; Mount Wachusett -> Framingham 11 % vs 41 %.
  Pattern: Fig 3 counts AS credits applied to ANY BS requirement including GE and free electives
  (gray rows), so a CC with a GE-heavy AS scores well on Fig 3 at a university whose named CS
  core it cannot touch. Fig 1 and Fig 3 measure different sides: Fig 1 is the university's
  demand met, Fig 3 is the CC's supply used.

---

## 6. Ranked MA failure mechanisms (with numbers)

1. **Receiving-side degree design dominates (76 % of Fig 1 variance).** University means 11.7-70.1 %
   vs CC means 27.7-47.2 %. A student's destination matters ten times more than their origin.
   [VERIFIED, final vintage, 165 cells]
2. **The computing core does not articulate, and it fails progressively along the sequence:**
   CS1 64 % -> CS2 51 % -> Data Structures 36 % -> CS3+/methodology 15 % -> applied computing 15 %
   -> upper-division computing 9.9 %. Discrete math (38.5 %) behaves like a computing course.
   Calculus (92-95 %) and science (96 %) are solved. [VERIFIED counts; INFERRED bucketing]
3. **A2B participation is worth +16.8 pp per pair net of both institutions** (+23 pp lower-only);
   mapped pairs 56.9 % vs 32.7 %. The premium is pair-level, not university-level: the A2B
   universities' own unmapped pairs score 34.3 %, the same as non-A2B universities (32.4 %). The
   A2B map is a statewide template (8 of Bridgewater's 10 MT rows identical). Only 4/11
   universities and 11/15 CCs participate; four CCs (Bunker Hill, Holyoke, Mount Wachusett,
   Roxbury) are in no map and hold 3 of the bottom 4 CC slots. [VERIFIED]
4. **Unrecorded equivalencies, not missing courses, explain the worst CC rows** except Roxbury.
   Mount Wachusett offers every concept and still articulates Data Structures 0/9, CS1 3/10.
   Discrete articulates 50 % where the AS has it vs 15 % where it does not — content matters, but
   the record matters more. [INFERRED from keyword detection on the older AS sheets]
5. **University-specific lower-division "flavour" courses are dead columns:** Framingham's
   Professional Exploration Seminar/Intro to OS/CS II in Java (0/15), MCLA's Java III/IV and
   Network Theory (0/15), Amherst's COMPSCI 220/198C/230/240/250 (0-2/15), Westfield's Digital
   Electronics (0/15), Worcester's Discrete I and Algorithm Analysis (0/15). [VERIFIED]
6. **Denominator structure: the ceiling and the slots.** L/N is 0.45-0.52 at the four lowest
   universities (upper division keeps them under ~50 % by construction) but they sit 23-34 pp
   below that ceiling on genuine lower-division computing loss. At the top, slot columns supply
   32 pp of Lowell's 62 % and 22 pp of Salem's 46 %; Boston and MCLA have none. On named lower-
   division courses only, the spread is 13 % to 91 %. [VERIFIED]
7. **No official agreement at all at UMass Boston** (workbook note: "unofficial through
   transferology"); Boston has zero slot columns, zero upper-division articulation, and its
   Physics-with-lab pairs fail at 7 of 15 CCs. [CONTEXT + VERIFIED]
8. **Credit-use failure is a second, partly independent layer (Fig 3 vs Fig 1 r = 0.85, 18 pp
   floor):** applied-IT AS degrees (Roxbury, Northern Essex) waste credits even at articulating
   universities (Roxbury -> Fitchburg 67 % articulated, 41 % used), while GE-heavy AS degrees are
   absorbed at universities whose CS core they never touch (Greenfield -> Amherst 64 % vs 97 %).
   Extra hours (Fig 4) are then the mirror of Fig 3 (r = -0.86). [VERIFIED]

---

## 7. Visual ideas

1. **MT-split heatmap**: the 165-cell Fig 1 with MT cells outlined (or the matrix re-sorted so the
   38 A2B cells form a block); side panel with the four within-university MT vs non-MT bars
   (53.6/21.8, 74.3/58.7, 49.2/30.7, 44.6/31.9) and the FE coefficient (+16.8 pp).
2. **Sending-vs-receiving decomposition bars**: stacked bar of Fig 1 variance shares (CC 7 %,
   university 76 %, interaction 16 %) for MA, and the same decomposition for CA cs/bio/econ and VA
   — the cross-state version of "where is the failure located". Pair with two dot-strips: 11
   university means and 15 CC means on the same axis (SD 18 vs 5.5 pp).
3. **Sequence-decay chart**: articulation share by concept ordered along the CS sequence
   (CS1 64 -> CS2 51 -> DS 36 -> CS3+ 15 -> upper 10) with calculus/science as flat reference
   lines; repeat per state (VA's scheduled-supply misses are the same courses).
4. **Ceiling waterfall per university**: 100 % -> minus upper-division share -> minus lower named
   computing loss -> minus lower math/science loss -> actual; a second variant that strips slot
   columns to show named-course coverage only (13-91 %).
5. **Curriculum-gap vs record-gap grid**: 15 CCs x concepts, cell shaded by "AS has it" and
   marked by articulation rate; Mount Wachusett (has everything, articulates nothing) vs Roxbury
   (lacks everything) as the two corners.
6. **Fig 1 vs Fig 3 scatter for the 61 pathways**, MT pairs coloured, with the residual outliers
   labelled (Roxbury -> Fitchburg, Northern Essex -> Lowell below; Greenfield/STCC -> Amherst,
   Middlesex -> Worcester above) and the 0.18 + 0.79x fit.

## 8. Further investigations

- Build the same two-way decomposition on CA (1035 cells per major) and VA (240) to test the
  cross-state claim "MA fails on the receiving side; VA moved the failure to the offering side".
- Recompute Fig 1 on named lower-division columns only (drop slots and upper division) for all
  three states; this removes the denominator-composition artefact that inflates Lowell/Salem.
- Replace the keyword AS-content scan with the per-course pathway workbooks (older vintage) to
  count, per CC, courses present-but-unrecorded vs absent, and price them with Fig 4/5.
- Check the MassTransfer Course Equivalency Database directly for Mount Wachusett -> Bridgewater
  Data Structures / Calc II to confirm the "unrecorded" reading.
- Test whether the A2B template's fixed course list (Calc I/II, Phys I/II, CS I/II, DS, Comp
  Org, Discrete, Linear) is exactly the set that articulates at the non-A2B universities too —
  i.e. whether A2B codified an existing de-facto core rather than creating one.
- The Tallys typing disagreements (27/88) should be documented before Fig 2 is re-used
  cross-state; the science/computing split of "technical elective" slots changes Fig 2 by
  campus.
