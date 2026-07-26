# Feedback round — "The Paper Gate" (both registers)

The set is close. The honesty constraints all survived into figure ink, figure 2
is the best figure in either collection, and figure 5's dashed line ("the
poorest quartile reaches today's richest") is the quotable geometry we hoped
for. Three changes are design decisions and are yours; everything else we will
apply at implementation without troubling you (rounding consistency, trimming
repeated methods prose, axis end-points). As before: the *what* below is fixed,
the *how* stays yours.

## 1 · Figure 1 repeats figure 3 — re-unit the census (the big one)

Figure 1 panel A and figure 3 panel A are the same bars: programming +20,
discrete +2, on the same points-gained axis, two beats apart. This is the exact
repetition disease the sibling collection had to cure (its old figure 4
re-drew its figure 1). It also creates a story-order bug: beat 1 asks the
reader to understand "points of poorest-quartile access" before beat 3 has
introduced the idea of repair at all.

**Fix: figure 1 becomes a census in census units — how much blocking exists —
and figure 3 keeps sole ownership of "what fixing buys."** Panel A should rank
subject families by **blocking instances**, and the real values exist now (no
amber needed):

| Family | Blocking instances (of 1,761) |
| --- | --- |
| Programming & data structures | 957 |
| Computer organization | 327 |
| Discrete mathematics | 321 |
| Linear algebra | 38 |
| Calculus-based physics | 35 |
| Calculus | 33 |
| Differential equations | 8 |
| Biology sequence | 5 |
| General chemistry | 3 |
| (unclassified) | 34 |

The census story this tells is slightly different from the repair story — and
that difference is worth a sentence of ink: computer organization blocks
almost as often as discrete mathematics (327 vs 321) but repairing it buys far
less (+1 point vs +2), because its instances cluster where other courses also
block. Census and price are different rankings; that is *why* they are two
figures.

**Panel B needs a second number on every row — this is a misreading we caught
in review, not a style note.** A bar reading "115 colleges" invites the
conclusion "fix this one course and 115 colleges open," and it is wildly
false: paths at fortress campuses are missing several courses each, so the
biggest blockers are nearly worthless to fix *alone*. The real pairs:

| Course | Stands in the way at | Opens alone |
| --- | --- | --- |
| Software Construction Laboratory (UCLA) | 115 | 5 |
| Systems Programming and Software Tools (San Diego) | 114 | 2 |
| Mathematics for Algorithms and Systems (San Diego) | 113 | 1 |
| Logic Design of Digital Systems (UCLA) | 106 | 0 |
| Data Structures, Algorithms, & Programming (Davis) | 65 | 15 |
| Intro to CS for Science, Mathematics & Engineering II (Riverside) | 26 | 15 |

The relationship is close to inverse, and the inversion is the panel's true
finding: the loudest blockers guard fortresses with many walls, while the
best single fixes are mid-size blockers that are the *last* wall at
nearly-open campuses (Riverside's intro course blocks only 26 colleges and
opens 15 of them). How to encode the pair is yours — but both numbers must sit
on every row, the inversion must be readable, and "opens alone" is the natural
bridge to figure 3's keystones. (Display note: UCLA's Logic Design appears as
two same-titled receiving courses — merge, keep the higher count.)

## 2 · The amber debt is already payable — real values enclosed

The grouped "seven further families" ceiling row and figure 4's amber campus
values were flagged as cuts-still-needed. They aren't — the artifact has them
all. Figure 1's grouped row can become a real ranked tail (table above), and
figure 4's full campus profile set is:

| Campus | Median required receivers | Articulated share | CS-core share |
| --- | --- | --- | --- |
| San Diego | 19 | 69% | 32% |
| Berkeley | 18 | 83% | 0% |
| Los Angeles | 17 | 72% | 41% |
| Davis | 11 | 65% | 46% |
| Irvine | 11 | 40% | 63% |
| Riverside | 10 | 85% | 50% |
| Merced | 10 | 96% | 20% |
| Santa Barbara | 7 | 91% | 43% |
| Santa Cruz | 5 | 83% | 60% |

Note two placed-illustratively values were materially off (San Diego's
articulated share is 69%, not 31%; UCLA's is 72%, not 24%) — the amber
convention did its job. The San Diego correction actually *sharpens* the
figure-4 insight: San Diego articulates most of its ask and is still closed
everywhere, because the unarticulated remainder is its own CS core. Closure is
about the hardest course in the ask, not the average — worth carrying into
the annotation.

Also: the full ranked blocking-course list continues past the three named
bars — panel B has room for five or six rows, and the near-total bars deserve
to be seen (values in the panel-B table above, which also carries the
opens-alone pairing).

## 3 · Figure 4 — collapse three encodings into one glyph system

Three separate columns (ask squares, articulated-share bar, printed CS-core
percentage) ask the reader to integrate three comparisons. The square can do
all the work itself:

- one square = one required receiving course (as now);
- **colour** = CS-core vs math/science breadth (as now);
- **hollow** = has no articulated local equivalent at the typical college —
  reusing figure 2's absence convention (hollow = missing), so the vocabulary
  is already taught by the time the reader arrives.

Then a campus row *is* its profile: scope = how many squares, content = how
blue, articulation = how filled. The printed CS-core column disappears (it is
literally counting blue squares) and the share bar disappears (it is counting
hollow ones). Berkeley vs San Diego — the beat's whole point — becomes "same
number of squares, opposite colours and fills," visible with no axis at all.
The red outline for UCLA's zero-articulation course keeps working unchanged.

Data note so the encoding stays honest: the current share bar is a median over
each campus's ~115 agreements, so the squares must be built from a stated
"typical agreement" construction (e.g. the median college's agreement, named
in the footnote) rather than implying every college sees exactly this ask. We
will supply that cut; design for it.

## 4 · Figure 2 — protect the heart, trim its accessories

Keep the 81/2/15 bar exactly as designed, including the three treatments and
the in-figure caveat sentence. Two trims to the detailed register's tier row:

- Drop the **A1/A2/A3 codes** — analysis jargon. The plain-word labels you
  already wrote ("the same campus already accepts this college," "a stricter
  campus does," "only a laxer campus does") stand alone.
- Halve the bracket text. "1,229 survive the conservative standard — figure
  5's lower bound" is enough; the second sentence (197 as the difference
  between the published numbers) restates what figure 5's range already says.

## Applied at implementation (no design action needed)

- One rounding policy on-figure: integers everywhere (68–72%, 27–30 pts);
  decimals live in footnotes.
- Figure 5: the complete-cells row is dropped (system plumbing, and its story
  is the staircase's); if it ever returns its axis ends at the true total
  (1,035), not 1,000.
- Each methods sentence appears exactly once in the set: fungibility in
  figure 2, non-additivity in figure 3, the two standards in figure 5.
- Figure 3's 503-square block gets an "ordering is arbitrary" note.
- Figure 1's in-bar phrase and its caption no longer say "order of magnitude"
  twice.
