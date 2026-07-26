# Design brief — "The Paper Gate" (working title): the course-anatomy collection

You designed "The Price of Place" for us — the five-beat sequence showing that a
California community college student's Computer Science transfer options are
decided by the wealth and location of their district. This is its sequel, in the
same design system, for the same internal research site. Images of the Price of
Place figures as finally implemented are attached; reuse the visual language you
established there (the register convention too: a **detailed** research-facing
version and an **at-a-glance** version with conclusions as headlines). As
before: how to visually express each beat is yours to decide — the data, the
claims, and the honesty constraints below are fixed.

## The thesis

Price of Place ended on "where you start decides what you can reach." This
collection answers the question that leaves open: **what is the gate actually
made of — and what would it cost to open?** The answer our data gives:
**mostly paper.** Four in five of the courses that block transfer paths are
subjects the college already teaches at a level some UC campus formally
accepts — the agreement just never got written. And if only those
evidence-backed entries were written, poorest-district access would roughly
double.

## Background mechanics (context, not a figure)

A transfer path from college to campus-program is "complete" when every course
the campus requires has an articulated local equivalent. A path breaks on
specific named courses. Everything below comes from re-running the eligibility
engine over all ~1,000 college × program agreements for the nine UC Computer
Science programs, against the full 120k-agreement corpus as evidence.

## The five beats

**1. The census — what actually stands in the way.**
Every blocking course, ranked. The dominant fact: programming itself is the
gate's main hinge. Fixing the "programming and data structures" family
statewide would be worth +20 points of poorest-quartile access and +150
complete college-program cells — an order of magnitude beyond the next subject
(discrete mathematics, +2). Top single courses: UC Santa Barbara's "Problem
Solving with Computers II" (blocks 31 colleges), UC Davis's "Data Structures,
Algorithms, & Programming" (blocks 65), UCLA's "Software Construction
Laboratory" (blocks all 115 — no college anywhere articulates it). The reader
should leave knowing *which subjects* and *which specific courses* carry the
gap, and that they are ordinary lower-division CS courses, not exotica.

**2. The three fates — why each missing course is missing.**
Every one of the 1,761 blocking-course instances was classified by evidence:
- **Fate A — accepted elsewhere (1,426 instances, 81%):** the college holds an
  articulated entry for a same-subject course at another UC campus. The
  sector's own paperwork proves the college teaches the subject at an accepted
  level; this agreement just lacks the entry.
- **Fate B — taught but never accepted (37, 2%):** the college catalog holds a
  matching course, but no campus anywhere articulates it.
- **Fate C — not taught (264, 15%):** nothing in the catalog covers the
  subject. The genuine supply gaps.
(34 instances, 2%, resist classification and are reported as such.)
This is the heart of the collection: the gate is overwhelmingly fate A. The
reader must be able to grasp the 81/2/15 split in one glance, and the detailed
register should convey that A is itself tiered by *who* accepted (see beat 5).

**3. The price list — what each repair buys.**
Each candidate repair was simulated: give the missing course an articulation,
re-run the engine, measure the change. Three shapes of repair, all real data:
- statewide single-course repairs (best: +3 points of poorest-quartile access);
- statewide subject-family repairs — the "sequence" unit (programming: +20
  points, +150 cells; everything else far behind);
- **keystones**: 163 of the 503 incomplete college-program cells are exactly
  ONE course away from a complete path.
The reader should come away with "repairs are rankable, and a specific short
list buys a lot" — the bridge from diagnosis to prescription.

**4. What each campus asks the paperwork to carry.**
The nine campuses run very different demands through articulation, and this
mechanically explains the three regimes in Price of Place beat 1:
- UC Berkeley: 18 required receivers, but **zero CS courses** — only math,
  physics, and science breadth that nearly every college articulates (83% of
  its asks articulate). Open nearly everywhere *by scope choice*.
- UC San Diego (19 receivers) and UCLA (17): demand their own campus-specific
  CS courses — UCLA's lab course is articulated by zero colleges. Closed
  everywhere.
- UC Santa Cruz asks for only 5 receivers; UC Irvine asks 11 but only 40%
  articulate (its asks are unusually specific).
Per-campus data available: median required receivers, share articulated, and
share of the ask that is CS-core (programming/organization/discrete: Berkeley
0%, Irvine 63%). The insight to land: "openness" is not generosity — campuses
choose how much of their major to route through articulation at all, and that
choice, not prestige, decides who is reachable. (Prestige intuition is
backwards here: Berkeley is the most reachable, UCLA/UCSD the least.)

**5. The repaired map — the payoff.**
Apply only the fate-A repairs (write the agreements the evidence supports;
teach nothing new anywhere) and re-render Price of Place's staircase:
- Poorest-quartile access: **34.6% → 71.6%** (full standard) or **→ 67.9%**
  (conservative standard: only repairs backed by the demanding campus itself
  or a stricter one — 1,229 of the 1,426).
- Richest-poorest gap: 37 points → 26.5 (full) / 29.6 (conservative).
- The worst distance-stratum cell (far, poor): 36% → 70% / 65%.
- Complete college-program cells: 532 → 882 / 859.
Present the two standards as an honest range, not a single number — the
conservative bound is strong enough to lead with ("even under the harshest
reading of the evidence, access in the poorest districts nearly doubles").
This beat closes both collections' arc: the inequality documented in Price of
Place is, in large part, a stack of unwritten paperwork with a ranked to-do
list.

## Honesty constraints (hard requirements, learned the hard way)

- Formal opportunity only — nothing may imply admission odds or student
  behaviour.
- Fate A is *subject-level evidence, not course-level proof* — the detailed
  register must say so plainly; the conservative tier exists because campuses
  set different bars.
- Subject classification is a transparent title-bucket classifier; it was
  hand-corrected during validation and a 25-case validation sample exists.
  Don't overstate precision; counts are honest but the boundary cases are
  acknowledged in a note, not hidden.
- No fungibility assumptions anywhere: every repair in beat 5 is a specific
  college-course pair with named evidence behind it.
- Quartile means, never fitted curves. Tails stated as tails.
- Anything that needs a paragraph of defense is methods and belongs in
  captions/notes, not figure ink. Each beat must pass a one-glance test in the
  at-a-glance register.
- Every mark carries a real value on the figure (no hover-only data), and the
  UCLA/UCSD "closed everywhere" fact must not be visually blamed on colleges —
  beat 4 exists to attribute it correctly.

## What not to do

- Don't re-draw Price of Place's figures; reference them (the staircase
  reappears only inside beat 5's before/after).
- Don't rank campuses on a single "strictness" scale — beat 4's whole point is
  that scope, content, and alternatives are different choices.
- Don't propose interactions as load-bearing; these figures are also exported
  as static images for the paper.

## Data inventory (all computed, in hand)

Per blocking course: title, campus, colleges blocked, fate split, repair
deltas (poorest-quartile points, gap points, far-poor points, cells).
Per subject family: same deltas. Per campus: median required receivers,
articulated share, CS-core share of ask. Keystone list: 163 (college, program,
course) triples. Repaired-map metrics at both evidence standards. Fates:
1,426 A (910 same-campus-evidence A1 / 319 stricter-campus A2 / 197
laxer-only A3) · 37 B · 264 C · 34 unclassified. Baseline staircase:
34.6 / 51.9 / 59.3 / 71.6.
