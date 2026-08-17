# Modelling a UC four-year degree

What a `kind: degree` document must satisfy, and why. These rules were settled
one campus at a time — Berkeley (MCB, Economics), Davis (Biological Sciences,
Economics), Irvine (Biological Sciences) — and each one exists because breaking
it produced a wrong number we had to chase down. Treat them as the standard for
a pass over all 27 documents, and revise them here rather than in one document's
head.

**The question every document answers:** how much of this degree can a student
complete at a community college, and how much must they do after transferring.
Every rule below protects that answer.

---

## The three-rule check

Run all three together. They interact, and checking them separately has twice
reported a degree as sound when it was not.

| # | rule | why it can fail quietly |
|---|---|---|
| 1 | stated requirements sum to the degree's `total_units` | derived slack goes stale whenever any other group moves |
| 2 | community-college units ≤ the campus transfer cap | the padding added to reach the unit total is the usual culprit |
| 3 | upper-division units ≥ the campus minimum, **where one exists** | not every campus states one |

### Campus constants

| campus | calendar | total | CC transfer cap | upper-division minimum |
|---|---|---|---|---|
| Berkeley | semester | 120 | **70** | 36, of which ≥6 outside the major |
| Merced | semester | 120 | 70 | *to confirm* |
| Davis | quarter | 180 | **105** | **64** |
| Irvine | quarter | 180 | **105** | **none stated** — a residence rule instead: 36 of the final 45 units at UCI |
| Los Angeles, Riverside, San Diego, Santa Barbara, Santa Cruz | quarter | 180 | 105 | *to confirm per campus* |

The cap is UC-wide policy — 70 semester / 105 quarter units of lower-division
community-college credit — but the upper-division minimum is a **college**
rule and differs. Do not assume Davis's 64 applies elsewhere. Irvine states no
minimum at all; its equivalent protection is a residence requirement, which any
transfer student doing 75 units on campus satisfies automatically.

---

## Where units are allowed to come from

**Lower-division general education is CC-completable by default.** IGETC or
Cal-GETC certification clears it. Assume a college can supply it and let the
per-college articulation data decide the rest.

**Upper-division work never transfers.** Community-college coursework cannot
satisfy an upper-division unit requirement even when it satisfies an
upper-division *subject* requirement. Six of 364 articulated UC courses are
upper-division, and all six are organic chemistry or biochemistry.

**Upper division is units, not structure — do not model its internals.** None
of it transfers, so which courses fill the requirement cannot change the answer
the document computes. UCLA Biology states that five of its ten upper-division
courses must sit in the Ecology and Evolutionary Biology department, that two
must be laboratories, and that a course counted toward one principle cannot be
counted toward another. All true, all irrelevant here: the figure is ten courses
at four units. Record the count and the unit total, and stop. The exception that
proves it — six of 364 articulated UC courses are upper division, all organic
chemistry or biochemistry, and even those cannot count toward an upper-division
*unit* minimum.

**A school may go further and require its major courses be taken on campus.**
UCI's School of Social Sciences states a residence requirement — "Upper-division
courses required for each major must be completed successfully at UCI" — which
is stronger than the transfer rule and independent of it. Look for one; it
confirms the upper-division block belongs on the university side for a reason
beyond articulation.

**Once the cap binds, what remains is simply "earned at the university".**
Whether those units are general education, electives or upper-division
coursework makes no difference to the answer — they cannot be brought. Model
them as one non-transferable block, named so a reader knows why it exists.

**American History & Institutions and language proficiency are assumed
satisfied before transfer** — high school for most California students. Check
the *degree type* before applying this: an A.B. in Davis's College of Letters
and Science needs three sequenced quarters of a language, which two years of
high school does **not** satisfy, though an AP score of 3+ does. A B.S. in the
same college has no such requirement.

---

## Slack, padding, and the cap

**Slack is derived, never hand-set.** `total_units − sum(stated requirements)`.
Re-derive it whenever any stated requirement moves; it has gone stale in every
document that has been edited more than once.

**Padding exists only to reach the unit total.** It is not a requirement, and
the moment the community-college side reaches the cap it becomes work that must
happen at the university. Never leave padding marked CC-satisfiable past the cap.

**Split at the cap, do not overstate.** If the transferable side exceeds the
cap, move the excess into a block named for what it is — *"Further units earned
at <campus> — transfer cap reached"* — marked `cc_articulable: false`. The
student still earns those units; they simply cannot bring them.

**State the full requirement, then say how much of it fits.** When the cap
forces a group down, do not just write the smaller number — it reads as though
that were the whole requirement. UCI biology needs 36u of GE; major preparation
uses 80u of the 105u cap, so 25u of GE transfers and 11u is earned on campus.
Write all three figures. The reduced number is *derived from the cap*, never an
estimate, and saying so is what stops the next reader from re-deriving it.

**When genuine requirements exceed the cap**, that is a real finding about the
major rather than an error. UC Irvine biology's lower-division preparation plus
general education comes to more than 105 quarter units, so some of it is
satisfied at a community college and re-earned at UCI for unit credit. Record it;
do not quietly shrink a named requirement to make the arithmetic work. Where a
residual must come from somewhere, take it from the general-education estimate —
"what remains after the major overlaps it" is already an estimate — and never
from a named course requirement.

---

## Articulation-aware modelling

**Do not hard-code a course as impossible because it is rare.** Coverage is
computed per college. UC Irvine's BIO SCI 97, 98 and 99 reach 45, 27 and 5 of
115 colleges; marking them non-transferable would rob the colleges that do teach
them of credit they have earned.

**Do move a course that reaches zero colleges.** BIO SCI 90L is absent from
ASSIST entirely and BIO SCI 100 carries no agreement, so six units were being
counted as transferable that no student can bring.

**`cc_articulable: false` is not the same as upper division.** Units earned at
the university because the cap is reached are *lower* division. Conflating the
two reports an upper-division floor as met when it is not.

---

## Sources and units

**The department page beats the campus catalogue for major requirements.**
Berkeley's Coursedog encodes MCB mathematics as `completedAllOf` over 13
calculus and statistics courses; the department states one sequence of two.
`completedAllOf` over an alternatives list is an encoding artefact.

**Never infer a unit value that a catalogue publishes.** UC Irvine prints its
requirement table with no unit column, and the 21 units recorded for its
seven-course biology Core were a reconstruction — the published figure is 24. We
now hold every campus's catalogue in `curated_prerequisites`; read the units from
there.

**ASSIST units can be stale.** Berkeley publishes Chem 3A/3B at 4 units and
ASSIST records 3. Correct these with `course_unit_overrides` on the degree
document, never by editing the ASSIST mirror, which would diverge from upstream
and revert on the next import.

**Pin the document to the year the articulation data describes** — 2025-26 —
and check `catalog_year` before trusting anything in it. A document written
against a newer catalogue names courses no agreement references. UC Davis
discontinued BIS 2ABCD in favour of BIO 1/2/3, and ASSIST carries no BIO course
for Davis at all. UCI Economics was stamped 2026-27 and so required ECON 15,
4 units; the 2025-26 requirement is the ECON 15A + 15B sequence, 8 units.

**When a catalogue contradicts itself, the requirement table is ahead and the
sample program is behind.** UCI's 2026-27 table requires ECON 15 while its
Sample Program still schedules 15A and 15B. Both are true of different years;
neither is a typo. Read the disagreement as a transition and date it.

**Distinguish a rename from a new course by its prerequisites.** ECON 15 looks
like a rename of ECON 15A until you notice that 15B requires 15A while 15 requires
MATH 2A/2B, and that ECON 122A accepts "ECON 15A or ECON 15B or ECON 15" — any
one of them. That is a consolidation into a new standalone course, not a
relabelling, and the unit count differs by four.

**A course present in `assist_courses` with `parent_id: null` is not in ASSIST.**
It arrived through the campus-catalogue import, which deliberately assigns no id.
That is a fast check on whether a requirement can articulate at all.

---

## General education

**Colleges do not write their own breadth — they defer to the campus
requirement** and add their own requirements alongside it. Both of Davis's
colleges say so explicitly. What differs between two majors at the same campus
is never the breadth; it is the composition, language and unit rules layered on
top.

**A school requirement may cost nothing once the major is counted.** Check
before giving it a group. UCI's School of Social Sciences asks for nine
upper-division social science courses plus four more at any level; Economics
requires eleven upper-division ECON courses and ECON 20A/20B, which is thirteen
against thirteen. Its three-course mathematics sequence is likewise satisfied by
ECON 15, 122A and 122B — all already required. Keep the group at zero units
rather than deleting it: the requirement is real, it just binds on other majors.

**Read the exemption's scope precisely.** Certification exempts a student from
"all General Education requirements *that may be met with lower division
courses*" — so an upper-division component survives it. UC Irvine states this
outright: IGETC satisfies "the total UCI general education requirement **except
the upper-division writing requirement**". That surviving requirement lands on
the non-transferable side and counts against the student.

**GE netting is major-specific; the college block is not.** Berkeley L&S lets a
major's own courses count toward breadth, so what remains depends on the major:
MCB covers two of seven areas, Economics one. Port the college block between
same-college majors, then recompute the netting.

**Net Cal-GETC against the major — do not walk the campus's own GE categories.**
Our student is a CCC transfer with certification, and every campus treats that as
satisfying its whole lower-division GE. Walking the campus categories instead
forces judgment calls the certification already settles — whether UCI's
International/Global Issues double-counts against Social and Behavioral
Sciences, for instance. Net the six areas against what the major covers and
count what remains.

**Take the pattern from `ge_pattern`, never from memory.** The collection holds
Cal-GETC as twelve courses across six areas, sourced from PlanMyTransfer. Recalled
IGETC put UCI Economics 4 units out.

| Cal-GETC | courses | semester units |
|---|---|---|
| 1 English Communication (1A, 1B) | 2 | 6 |
| 2 Mathematical Concepts | 1 | 3 |
| 3 Arts and Humanities (3A, 3B, +1) | 3 | 9 |
| 4 Social and Behavioral Sciences, two disciplines | 2 | 6 |
| 5 Physical and Biological Sciences, one with lab | 2 | 7 |
| 6 Ethnic Studies | 1 | 3 |
| | **12** | **34** |

**Cal-GETC and IGETC are received identically but are not the same pattern.**
Every campus clears the same requirements on either certification — UCI clears
all lower-division GE and keeps upper-division writing. But Cal-GETC, effective
Fall 2025, cut area 4 from three courses to two and replaced the Language Other
Than English area with Ethnic Studies. The 34-unit total is unchanged, so the
difference only shows when a major covers *part* of an area: UCI Biology is 36
quarter units under both, while Economics is 38 under IGETC and **42** under
Cal-GETC, because ECON 20A/20B cover one of two area-4 courses rather than two
of three. Documents pinned to 2025-26 use Cal-GETC.

**Convert once, at the boundary.** The pattern is quoted in semester units even
at a quarter campus. 24 semester units is 36 quarter units, not 24.

**Declare IGETC areas rather than asserting satisfiability.** A group with
`ge_areas: ['3A','3B','4']` is measured against each college's certified
courses. A group with `assume_satisfiable: true` is merely asserted, and cannot
detect a college that falls short.

---

## One vocabulary, one reader

Two conventions mark university-only work and both are legitimate: the CS
documents say `tier: 'nontransferable'`, the bio/econ documents say
`course_level: 'upper_division'` with `cc_articulable: false`. The rules that
keep them interchangeable (settled 2026-08-13, after the transfer figures
divided Berkeley biology by 392 units and reported its whole upper division as
lower division):

**The group's word is final.** A group marked university-only — in either
vocabulary — is university-only in its entirety. A section-level
`tier: 'transferable'` beneath it is editor residue, not a fact, and every
reader resolves it through `degreeSlots.resolveSectionTier`. Do not write
section tiers that disagree with the group; `scripts/repairDegreeSectionTiers.js`
aligns them (16 sections repaired across the two Berkeley documents).

**Every reader prices a choice as one path.** `computeUnitBudget` (figure
denominators, Degree-reqs `units_summary`), `computeTransferBudget` (heatmap
budget) and the transfer figures' template walk all collapse an `Or` group:
the *denominators* at the cheapest alternative a college can reach
(`articulation_reach` 0 excludes a path; unrecorded reach is assumed live),
the *numerators* along the path the college actually satisfies best. A student
whose college articulates only the longer sequence genuinely brings more units
than the cheapest path asks; aggregate clamps keep fulfilled within required.

**The readers must agree.** `scripts/auditDegreeStandard.js` fails
`reader_drift` when `computeUnitBudget` and `computeTransferBudget` price one
document differently, and `section_tier_contradiction` when a stored section
tier disagrees with its group. Run it after any document edit.

**Zero units is an authored figure, never a missing one.** Berkeley's American
Cultures requirement double-counts with breadth and is stated at 0 units;
re-pricing it at the four-unit assumption invented GE demand on both Berkeley
documents.

**Figure denominators are the stated minimum.** The full-degree share in every
figure divides by the campus's `total_units` (120/180) — never by the modeled
sum, which moves with modelling completeness and let a thinly modelled degree
read as more complete. The lower-division share divides by the transferable +
breadth stated requirements. `modeled_share` remains the gate for thin
documents.

## Mechanics that have bitten us

**An `Or` group costs one path, not one per alternative.** Summing Berkeley
MCB's twelve emphasis tracks pushed its denominator from 120 units to 392 and
collapsed its coverage to 8.3% — and the transfer-credit figure to an 11%
column average. The by-course-type rollup must collapse the same way, or it
reports 94 typed slots against a 26-slot degree.

**`course_level` vocabulary is `upper_division` / `lower_division`.** Writing
`upper` silently disabled the ledger's condense rule across the whole California
corpus.

**The nine computer-science degrees are off-limits.** They are human-verified
and finished, and must not be edited.

**A `verified` flag elsewhere is Tybalt's own bookkeeping, not a lock.** It
marks what he has personally looked over; a correction under it is fine and does
not need to be asked about first. Mention the change so he knows the record moved
under his verdict — don't stop for permission.

**Two people cannot edit one document at once.** Editing a record while it is
open in the console loses the change: the browser holds a pre-edit copy and
writes it back on save. This has silently reverted a cap fix twice. Reload before
editing, and prefer editing documents nobody has open.

**Bump the query buster after rewriting a dataset.** `frontend/src/main.jsx`
persists successful queries for 24 hours; rewritten data looks like it never
landed until the buster changes.

---

## Status

**Any checker must collapse `Or` groups before it sums, and must skip the
computer-science documents.** A naive sum reports Berkeley biology at 392/120
because it adds all twelve MCB emphasis tracks; collapsed to one path it is
120/120. The nine CS documents are course-list shaped rather than unit-budget
shaped — UCI's carries units on one group of ten — so the unit rules do not
apply to them at all.

### Passing

| document | total | CC / cap | upper | |
|---|---|---|---|---|
| `degree:79:bio` | 120/120 | 70/70 | 36/36 | verified |
| `degree:79:econ` | 120/120 | 70/70 | 40/36 | verified |
| `degree:89:bio` | 180/180 | 105/105 | 64/64 | verified |
| `degree:89:econ` | 180/180 | 105/105 | 64/64 | verified |
| `degree:120:bio` | 180/180 | 105/105 | 39, none stated | in review |
| `degree:120:econ` | 180/180 | 105/105 | 44, none stated | in review |

### Over the cap — twelve documents, one defect

Elective padding derived to reach the unit total without reference to the
transfer cap. The same fix applies to all of them: recompute capacity as
`cap − named CC requirements`, and put the balance in a cap-reached group.

| campus | bio | econ | upper (bio/econ) |
|---|---|---|---|
| UCLA | 120/105 | 120/105 | 60 / 60 |
| UC Santa Barbara | 120/105 | 120/105 | 60 / 60 |
| UC San Diego | 120/105 | 120/105 | 60 / 60 |
| UC Merced | 76/70 | 76/70 | 44 / 44 |
| UC Riverside | 124/105 | 126/105 | 56 / 54 |
| UC Santa Cruz | 136/105 | 135/105 | 44 / 45 |

**Treat the first four campuses as unresearched, not merely miscounted.** UCLA,
Santa Barbara and San Diego report identical figures for both majors — 120 CC
units, 60 upper-division — and Merced's pair is identical too. Three campuses
and two majors do not independently arrive at one set of numbers. Fixing the cap
arithmetic there would make a template pass the check without making it true;
these need catalogue work first. Riverside and Santa Cruz at least differ
between majors.

Open questions worth settling on the next pass: the upper-division minimum for
the six campuses not yet confirmed; whether depth blocks should model the leanest
legal path or a typical one (Davis biology's 42u is the sum of stated minimums,
against a catalogue range topping out near 50); and whether the general-education
groups should declare IGETC areas everywhere rather than only at Berkeley.

### Standing failures (2026-08-13, after the reader/vocabulary pass)

`auditDegreeStandard.js` reports four documents failing, all in the
human-verified CS set, which is off-limits to editing — these need Tybalt's
catalogue judgment, not arithmetic:

| document | failure |
|---|---|
| `degree:144:cs` | over_total — 125u stated against a 120u degree |
| `degree:46:cs` | over_total — 182u stated against a 180u degree |
| `degree:117:cs` | over_total — 181u stated against a 180u degree |
| `degree:132:cs` | ge_above_pattern — 57u of GE against the 51u quarter Cal-GETC ceiling |

The figures already read all four against their stated totals, so the excess
only means their stated requirements slightly overfill the degree, not that a
chart divides by the wrong number.
