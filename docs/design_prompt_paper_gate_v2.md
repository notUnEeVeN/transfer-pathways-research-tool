# Design brief — "The Paper Gate," rebuilt from a clean slate

You designed The Price of Place and a first version of The Paper Gate for us.
This brief replaces the Paper Gate designs entirely. **No existing figure form
is presumed** — the first version's census bars, fates bar, glyph rows, repair
ladder, and range dumbbells are all retired as far as this brief is concerned.
You are invited to invent. The only inheritances are the design-system tokens
(the sibling handoff's palette, type, canvas, and conventions: hollow =
absence, hatch = resists classification, amber = value pending), the register
pair (detailed / at-a-glance), static-SVG-with-titles behaviour, and the
honesty constraints at the end.

The collection is now **four moments**, each defined by the experience it must
produce and the verified numbers that carry it — not by a chart type. It
should read as one continuous argument; a reader who takes only the four
closing lines of ink should still have the whole story.

## The spine

The Price of Place proved that where a student starts — the wealth of their
district and its distance from a campus — decides which Computer Science
programs they can formally reach. This collection answers *why CS*, and what
would fix it:

> Calculus works everywhere; data structures works where the money is. That
> difference, multiplied across a few dozen courses, is the entire staircase.
> Four-fifths of it is pre-approved paperwork. Sign it, and the poorest
> districts nearly catch up.

**Framing constraint (unchanged):** everything measures *formal opportunity*
— whether a complete transfer path formally exists — never student behaviour
or admission odds.

**Two requirement bases**, precomputed and toggled in production: the
**eligibility floor** (hand-verified curated minimums — the default) and
**stated preparation** (everything the ASSIST agreement lists). Design one
form per moment that works for both; only the numbers swap. Values below are
given floor-first with stated in parentheses.

---

## Moment 1 — Split the checklist

**Required experience:** the reader must come to *perceive* — not be told —
that a transfer path is a checklist with two kinds of item, and that one kind
never fails. Generic requirements (calculus, physics, chemistry, composition)
are solved infrastructure: articulated at 97–100% of colleges, everywhere,
rich and poor alike. The campus's own Computer Science courses are the only
live variable. The moment must end with the reader supplying the inference
themselves: *if anything is creating the inequality, it has to be them.*

**Verified numbers:** distinct required receiving courses across the nine
asks: 31 generic and 29 CS-proper on the floor (54 and 38 stated). Median
share of colleges articulating a generic requirement: **99%** (97%), with
calculus and composition at literally 100%. Median for a CS requirement:
**66%** (65%). Berkeley's ask contains zero CS courses; Irvine's is 63%
CS-core — available as colour if the form wants it.

**Form is open.** Ideas we would find exciting rather than prescriptive: one
real checklist dissected item by item; the ninety-odd requirements as a single
field sorted so the two populations separate before the reader's eyes; an
"X-ray" of one ask. Whatever makes "two kinds of item" a physical perception.

## Moment 2 — Take the staircase apart *(the centerpiece)*

**Required experience:** recognition, then revelation. The reader has seen
the Price of Place staircase (district access by income quartile: 40 → 62 →
77 → 90 on the floor; 35 → 52 → 59 → 72 stated). This moment opens that
familiar object up and shows what the rise is made of: the generic layer is
nearly flat — it could never have produced a staircase — and **the income
gradient lives almost entirely in the CS-course layer.**

**Verified numbers** (share of requirement-college cells articulated, by
district income quartile):

| | Q1 | Q2 | Q3 | Q4 | swing |
| --- | --- | --- | --- | --- | --- |
| Generic requirements (floor) | 93 | 99 | 100 | 100 | +7 |
| CS requirements (floor) | **40** | 57 | 66 | **72** | **+32** |
| Generic (stated) | 80 | 86 | 88 | 88 | +8 |
| CS (stated) | **33** | 50 | 58 | **64** | **+31** |

**A non-negotiable arithmetic honesty note:** access is a conjunction (every
requirement met), not a sum — so these layers are **not additive components**
of the staircase and must never be drawn as a stacked decomposition that
implies generic + CS = access. What is true, and is the claim: the generic
layer is flat, the CS layer carries virtually all the income variation, and
the staircase's *shape* tracks the CS curve. "Taking the staircase apart" is
a narrative device; find a form that delivers the recognition without faking
additivity — ghosting, morphing between the two shapes, side-by-side reveal,
annotation — your call.

## Moment 3 — The ledger of unwritten agreements

**Required experience:** the wall stops being a vague systemic failure and
becomes a **specific, short stack of documents sitting unsigned — most of
them pre-approved.** Each named entry carries three facts: how many colleges
it stands in front of; what repairing it *alone* would open (these are nearly
inverse — a bar reading "blocks 65" must never imply "fix it, open 65"); and
its evidence stamp: *this college's equivalent course is already formally
accepted by another UC campus.* That stamp is true for **79%** (81%) of every
missing instance. The remainder is shown honestly: **15%** of instances are
genuine supply gaps — the college teaches nothing in the subject — and no
signature fixes those.

**Verified numbers (floor):** 809 blocking instances: 638 accepted-elsewhere
(424 backed by the demanding campus itself, 157 by a stricter campus, 57 by
laxer only), 8 taught-but-never-accepted, 123 not taught, 40 unclassified.
Named ledger entries (blocks → opens-alone): Davis "Data Structures,
Algorithms, & Programming" 65 → 15 · San Diego "Basic Data Structures and
Object-Oriented Design" 49 → 12 · Irvine "Intermediate Programming" 46 → 2 ·
Irvine "Introduction to Programming" 44 → 0 · Santa Cruz "Computer Systems
and Assembly Language and Lab" 41 → 13. (Stated-basis ledger available too:
UCLA's Software Construction Laboratory blocks all 115 and opens 5; two
same-titled UCLA Logic Design courses merge at 106 → 0.)

**Evidence caveat, figure ink in both registers:** the stamp is
*subject-level evidence, not course-level proof* — the college teaches the
subject at a level some campus formally accepted, not that this campus would
accept this course. The conservative standard (demanding-campus or stricter
evidence only) exists for exactly this reason and feeds moment 4's range.

## Moment 4 — Sign the papers

**Required experience:** the payoff, minimal and unhedged except where
honesty requires the hedge. Write **only the agreements the evidence
supports** — teach nothing new, hire no one — and re-measure:

| Floor basis | Today | After (conservative → full) |
| --- | --- | --- |
| Poorest-quartile access | 40% | **75 – 79%** |
| Richest-poorest gap | 49 pts | **23 – 19** |
| Worst distance stratum (far & poor) | 41% | **74 – 79%** |

(Stated basis: 35% → 68–72; gap 37 → 30–27. On the stated basis the repaired
poorest quartile lands exactly on today's richest quartile — a quotable
geometry if that basis is showing; on the floor the honest line is "the gap
shrinks by more than half.")

Present each destination as a **range across the two evidence standards,
led by the conservative bound.** The not-taught remainder from moment 3 stays
visibly unfixed — the claim is that the *largest share* of the inequality is
administrative, never that it vanishes.

---

## Honesty constraints (all inherited, plus the new one)

1. No additive decomposition of access (moment 2's note) — layers are flat
   vs steep, never parts summing to a whole.
2. Evidence stamps are subject-level, not course-level proof; say so in ink.
3. Every repaired number is a two-standard range; lead conservative.
4. Blocks and opens-alone are near-inverse; wherever a blocking count
   appears, its opens-alone companion appears.
5. Quartile means, never fitted curves; no smoothing on bounded shares.
6. Every mark carries a real value; no hover-only data; one-glance test in
   the at-a-glance register; anything needing a paragraph of defence is
   caption, not ink.
7. Attribute closures to campus scope choices, never to college failure.
8. Formal opportunity only.
9. Subject classification is a transparent, hand-corrected title classifier;
   acknowledged in a note, precision not overstated.

## Data inventory

All computed, in `course_repairs.v1.json`, both bases: per-requirement
articulation rates with titles, campuses, subject buckets, and CS flags; the
quartile gradient lines; the fates counts with evidence tiers; the ledger
rows (blocks, opens-alone, per course); repaired-map metrics at both
standards; the Place staircase values for reference (from the sibling
snapshot). Nothing in this brief is illustrative — every number above is
real, so the amber convention should be needed nowhere.

## Deliverables

Same package as before: a detailed and an at-a-glance `.dc.html`, README with
per-moment geometry and the verified-vs-derived ledger. Four moments only —
no methods coda section, no appendix figures; the retired analyses live in
the data file, not on the page.
