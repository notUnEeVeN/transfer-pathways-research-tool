# Paper analysis — combined plan (Codex + Claude, 7 September 2026)

Two independent investigations ran on the same day with the same brief: pick the
MA-family figures that carry the paper, decide whether the "GE included, unit
weighted" form is feasible, and find where each state fails and why. Codex's
result is [`paper-analysis-plan.md`](paper-analysis-plan.md) with three companions
([`ma-ge-unit-feasibility.md`](ma-ge-unit-feasibility.md),
[`paper-planning-virginia.md`](paper-planning-virginia.md),
[`paper-planning-ma-figures.md`](paper-planning-ma-figures.md)) and artifacts under
[`analysis/results/paper_planning/`](../analysis/results/paper_planning/). This
session ran six per-figure dossiers and five deep dives (MA GE+units feasibility,
VA mechanism, MA failure map, CA cross-major, policy context), then an adversarial
pass; its receipts are under
[`analysis/results/paper_planning/claude-2026-09-07/`](../analysis/results/paper_planning/claude-2026-09-07/).
This document merges the two and names where they disagree.

**Evidence rule.** Every number names its vintage (final PDF / final repo / older
repo / our computation) and corpus. "Verified" below means reproduced
independently by at least two agents, or by Codex and this session. The
adversarial pass (three reviewers per claim) completed for eight Figure 1 claims
before the session hit its limit; those verdicts are folded in. Nothing in the
repository was changed by either investigation except these planning documents.

## 1. The figure set

Both analyses arrive at the same shape: the paper is about **how community
college coursework becomes useful degree credit**, and the credit figures carry
it. The six figures do not deserve six full heatmaps.

| Figure | Codex priority | Claude score /10 | Consensus role | Treatment required before it is shown cross-state |
|---|---:|---:|---|---|
| 3 Transfer credit rate | 1 | 6 | **Hero** | Credit-allocation decomposition (named / GE / elective-only / unused / denied). Harmonise the denominator (sending plan) and the numerator rule (strict vs elective-inclusive). Show the within-state guarantee contrast in each state. |
| 2 Course-type coverage | 2 | 6 | **Mechanism** | Lower-division scope with the structural ceiling drawn; CA bio/econ as controls; a VA column built from the guides (never the live `va-cs` API); non-STEM greyed with n. Reconcile MA's Tallys typing (27 of 88 cells; 7 of 11 universities do not partition Figure 1). |
| 1 Coverage heatmap | 4 | 7 | **Opening / context** | Keep the published GE-excluded course-count measure as the baseline; draw the ceiling (lower-division share) or the lower-division panel beside it; a denominator-anatomy strip per university. Never headline the raw three-state ordering. |
| 4 Hours above 120 | 3 | 4 | **Companion to 3** | Distribution, not a mean (MA is 29% zeros). Decompose into degree length above 120 / articulation loss / supply loss / denied credit. VA needs the same construction (unused credit + degree length) before it joins. |
| 5 Cost | 6 | 3 | **Annotation / appendix** | Fig 4 × a campus constant everywhere. A secondary dollar axis on Fig 4, or a rate-free threshold count (share of pathways ≥ 12 hours above 120). |
| 6 Complexity | 5 | 2.5 | **Drop as cross-state; one note** | MA/CA differ in graph provenance, GE direction, placeholder share (52% of CA cs vertices), cohort and degree type; VA is blank. Keep the MA A2B sign finding and one audited discordant case as a paragraph. |

The one ranking disagreement is Figure 1. Codex places it fourth ("compact
overview or appendix"); this session's dossier scored it highest because it is
the only figure populated for all three states in identically shaped rows, and it
carries the MA A2B split. Both agree the raw reading is unsafe. Resolution: it
opens the analysis as the map of the terrain, drawn ceiling-anchored, and the
analytic weight sits on Figures 3 and 2.

## 2. The "GE included, unit weighted" decision

Both investigations say the same thing: **it is the right form for Figures 3 and 4
and the wrong form for Figures 1 and 2.** Figure 3 already is GE-inclusive and
credit-based in all three states (the MA paper's own footnote 5 says so; CA's lens
is named + GE units; VA's is guide credits). The feasibility question only arises
for Figure 1, and there the two halves of the decision behave differently.

**Unit weighting is feasible and nearly consequence-free for MA.** Credit hours
per BS requirement exist only in the older repository's resident "4y" tabs
(`All Pathways/*.xlsx`, commit `59c1b77`); the final repository has no per-course
sheets at all. They join 214 of the 270 final-heatmap columns (79.3%: 187 by code,
27 by name). The 56 unmatched columns are elective-slot placeholders (52), OR
headers (2) and renumbered codes (2), not prerequisites or duplicates (a
correction to the working assumption). Weighting the named population by those
credits moves the 165-cell mean from 38.27% to 39.57% with Spearman 0.996
against the course count and 1.000 on the eleven university means; the fallback
credit for unmatched columns moves it by at most 0.5 points. Codex adds the
crosswalk hazards a reviewed version must handle: lecture/lab bundles (UMass
Boston physics = 4 + 2), OR alternatives (Amherst MATH 233 or STAT 515), renumbered
codes (Framingham CSCI 217 vs 271), and the fact that 308 of the 1,582 true
observations (19.5%) sit in unmatched columns.

**GE inclusion is not a measurement in MA; it is an assumption, and the
assumption is the whole figure.** No artefact in either repository assesses GE
articulation per college pair for the 165 pairs. GE exists only as the residue of
the older resident plans and as gray rows in the 61 transfer tabs. The site's
63.7% "GE included" value credits every residue row at 100% at every college, and
that residue is not GE: of its 610 credits, 303 are true GE, 111 are free
electives and 196 are STEM fillings (upper-division CS electives, physics,
Calculus III). The paper's own 61 pathway sheets remove only 40.9% of residue
units. Depending on what is called GE, the MA GE-inclusive value is 53.5%
(policy-bounded true GE), 63.7% (site residue) or 74.4% (residue over the
resident total). None of that spread is data about articulation. Adding GE also
double-counts the 56 unmatched slots (template unit sums exceed resident totals
by exactly 224 = 56 × 4; Dartmouth 172 vs 120).

Cross-state, the GE-inclusive lens compresses the states toward each other (CA
48.9 / VA 50.2 / MA 53.5–63.6) because it adds a block that is 100% by
construction everywhere, and MA's block is the largest and least GE-like. The
policy blocks that would justify the assumption are of similar size (MassTransfer
GenEd Foundation 34 credits, 28 inside STEM maps, receiver may add ≤ 6; Cal-GETC 34
units, not accepted by Berkeley Engineering or UCLA Samueli; VA UCGS 30–32), so a
"named coverage + policy block" construction is at least the same in all three.

**Recommendation.** Figure 1 headline = the published GE-excluded, course-count,
all-levels measure (CA cs 31.9 / MA 38.3 final repo, 38.2 PDF prose / VA 42.3
catalog, 37.8 scheduled), always beside its lower-division or ceiling panel. If a
unit reading is wanted, the GE-excluded named-unit companion (CA 35.3 / MA 39.6 /
VA 44.4) is the only unit lens with no assumed block and no cap. GE-inclusive
values appear only as a labelled sensitivity. Figure 2 stays GE-excluded,
course-count, lower-division scope. Figures 3 and 4 use credits. Disclosure for
the MA unit form: *"Massachusetts credit weights are taken from the paper's
December 2024 resident degree plans, the only vintage that lists credits per
requirement, and join 214 of the 270 heatmap requirement columns; the remaining
56, all elective-slot or alternative-course columns, are weighted at 4 credits,
and general education is excluded exactly as in the published figure."*

## 3. Findings on state differences

### 3a. The state ordering is not a finding

The adversarial pass killed the headline "VA 42.3 > MA 38.3 > CA 31.9" as stated.
Every number reproduces; the ordering does not survive the choice of lens:

| Lens (GE excluded unless stated) | CA cs | MA | VA |
|---|---:|---:|---:|
| Paper's measure, course counts, all levels | 31.9 | 38.3 (final repo) | 42.3 catalog / **37.8 scheduled** |
| Lower-division named courses only | **68.2** | 57.5 | 99.4 catalog (≈ ceiling by construction) |
| GE included, course counts | 46.0 | **63.7** | 50.2 |
| Units, GE excluded | 35.3 | 39.6 | 44.4 |
| Cross-major (CA): econ 23.7 → bio 51.2 | | | |

The lower-division share of the denominator is econ 31 / cs 47 / bio 59 / MA 57 /
VA 42.5 percent; the 27.5-point CA cross-major gap equals the 28-point ceiling
gap. On the one like-for-like lower-division measure, California CS articulates
more of what a college could teach than Massachusetts (68.2 vs 57.5), the reverse
of the whole-degree reading. MA's ceiling is also soft: 34 of its 115 upper
columns articulate somewhere and 21 of 165 cells exceed their lower-division share
(Fitchburg 134%), while CA's 0% upper-division coverage is by construction. VA's
catalog value is its own ceiling minus 0.47%.

### 3b. Where each state fails, and at which layer

**Massachusetts fails on the receiving side, inside the computing core, where no
A2B map exists.** A two-way decomposition of the 165 cells puts 76% of the
variance on the university and 7% on the college (university means 11.7–70.1,
college means 27.7–47.2). Articulation decays along the CS sequence: CS1 64% →
CS2 51% → data structures 36% → CS3+/methodology 15% → upper-division computing
10%; discrete math (38.5%) behaves like a computing course; calculus (92–95%) and
science (96%) are solved. The 38 pairs the authors transcribed from a MassTransfer
A2B map average 56.9% against 32.7% for the 127 filled from equivalency databases
and websites (lower-division 83.4 vs 49.7; within Bridgewater 53.6 vs 21.8); the
premium is +16.8 points net of both institutions, and the A2B universities' own
unmapped pairs (34.3%) score like non-A2B universities (32.4%). The reviewers'
caveat stands: the MT flag marks the authors' *data source* as well as the
policy, so part of the premium may be source completeness. In Figure 3 the A2B
split is 94.8 vs 60.4 (final PDF) or 82 vs 65 (our gray-row recalculation); in
Figure 6 the A2B pairs average −24 and the rest +26. Mount Wachusett lists every
concept and articulates almost nothing (data structures 0/9, CS1 3/10), a record
gap; Roxbury lacks the courses, a curriculum gap; UMass Boston has no official
agreement at all (workbook note: "unofficial through transferology"). Only 4 of 11
universities map CS; the live MassTransfer site now lists 34 pairs, not 38
(Greenfield's four maps have vanished since the paper's snapshot).

**California fails at the receiving template and in a low tail of colleges.** For
CS the campus explains 57% of Figure 1 variance and the college 30%; the campus
ordering flips across majors (Spearman cs–bio −0.15, cs–econ −0.32; Irvine is
last in CS and first in bio and econ) while the college ordering replicates
(0.43–0.57; Palo Verde, Lassen, Feather River, Coalinga at the bottom of all
three). The cleanest policy contrast in any state is CA's: on identical college ×
campus cells the AS-T beats the local AS by +10.8 (cs), +10.1 (bio) and +11.3
(econ) points of AS credit applied, positive at 27 of 27 campus × major cells,
through 6–7 more units of the same 60 applying. But the AS-T guarantee is a CSU
instrument (Ed. Code §66746–47 never mentions UC; TAG covers six campuses; the AB
1291 UCLA pilot starts fall 2026 with majors unconfirmed for CS), so what this
measures is the effect of a transfer-designed curriculum on UC pathways, not of a
guarantee. GE is the larger half of every CA credit rate (cs: named 27 / GE 40 /
elective 8 / unused 26), no AS-T cell reaches 100% in any major, and the two
flagship CS templates (UCLA 51, Berkeley 54 vs UCSB 87) are the CA analogue of
Framingham and MCLA.

**Virginia solved the articulation layer and moved the bottleneck to the
offering layer.** Every one of 15 universities publishes one statutory guide
(Code §23.1-907, enacted 2018 by HB 919/SB 631, not 2020) valid at every college
in VCCS common numbering, so catalog-mode Figure 1 is the ceiling minus a 0.47%
supply residual and Figure 3 is 100% minus a 1.1% SDV-refusal constant (five
universities refuse the 2-credit orientation course). Only 18 of 240 cells miss
anything in catalog mode. On scheduled supply 133 of 240 cells miss something, the
mean drops to 89.5% (Figure 3) and 37.8% (Figure 1 course lens), and the loss sits
at five small colleges (Southwest Virginia, Central Virginia, Paul D. Camp,
Virginia Highlands, Wytheville: 2–4 of the 9 core codes scheduled; Figure 3
66–81%) while the metro colleges plus New River run all nine. **Codex's check
tempers this:** the cached course pages expose different term windows (five
colleges Fall-only, including Southwest, Central Virginia and Camp), so the
scheduled view is a lower bound and its college ranking is confounded until a
multi-term window is captured. Two more VA source issues before any precise
claim: 14 of 15 guides give CSC 221 three credits while all 22 catalogs give four,
and Bridgewater's "Consider CSC 205 or CSC 215" row (5–12 credits) is treated as
12 mandatory credits (84 of the 1,417 scheduled missing credits). The 37.5–49.7
university spread in the course lens is ~70% explained by how much GE a guide
writes as open categories (r = −0.83), a documentation style, and the selection
rule picks BA guides at VCU and W&M.

### 3c. The computing bottleneck is invariant; the layer is not

Lower-division own-discipline coverage is CS 45.7% (CA, 9 campuses) and 41% (MA,
11) against biology 85.0% and economics 91.6% at the same 115 colleges under the
same ASSIST layer; VA reads 99% on catalog and 77% on scheduled supply. At
lower-division scope the own discipline is the lowest column for CS at 8/9 UC
campuses, 9/11 MA universities and 13/15 VA guides (scheduled), but for biology at
3/9 and economics at 1/9, where math is the bottleneck. The whole-degree contrast
the site currently prints (CA computing 11.5 vs MA 22) is about three-quarters
ceiling: the lower-division share of computing requirements is 27% in CA and 41%
in MA. The same four courses fail everywhere: CS2/OOP, data structures, discrete
structures, computer organisation (69–71% of the lower-division shortfall in CA
and MA; the top missing VCCS codes CSC 223, 222, 205, 208/MTH 288). What differs
is the layer: not articulated (CA), not in a map (MA), listed but not scheduled
(VA). The VCCS Master Course File fixes course identity, not supply.

### 3d. The forms of guarantee are different objects

| | Massachusetts A2B | California AS-T | Virginia guides |
|---|---|---|---|
| Reach for CS | 4 of 11 universities; 34–38 of 165 pairs | CSU only; 0 of 9 UC campuses in the corpus | all 15 universities by statute |
| What is guaranteed | admission at 2.5 GPA; ≥ 60 credits *applied* within 120–128 | CSU admission with junior standing, ≤ 60 to finish; no campus or major | admission only via separate GAAs (UVA ≤ 60 credits applied, 3.4 GPA); guides are maps, not agreements |
| GE block | 34 (28 STEM) + ≤ 6 | Cal-GETC 34 (not at UC engineering units) | Passport 15/16 + UCGS 30–32 |
| Where it shows in our figures | Fig 1/3 A2B split; Fig 4 zeros at mapped pairs | Fig 3 +10–11 paired; never 100% | Fig 1/3 ≈ ceiling by construction |

MA's Figure 3 on mapped pairs therefore measures named-requirement mismatch, not
credit rejection (credits must apply). VA's ≈100% is not evidence of superior
credit application. CA's +10.8 is not evidence of a guarantee.

### 3e. Is Virginia best?

True at the articulation layer: the computing courses that articulate at 22–42%
in MA and 28–57% in CA are simply named and accepted in VA. An artefact of
measurement in that the catalog figures cannot vary on anything but whether a
course code appears in a college's catalog, credit GE by assumption, count
elective landings as covered, and carry `method_status: estimated` on every cell.
The substantive VA finding is the scheduled view, and it is unproven until the
term windows are normalised. On the one shared-ceiling lens (AS credit applied ÷
whole bachelor degree, ceiling ≈ 50), VA's lead is +8 to +13 points of a degree
(50.2 catalog / 45.6 scheduled vs CA cs 37.3 and MA 36.1), not +31.

### 3f. Figure-specific facts that change how they are drawn

- **Figure 4 is Figure 3 in hours** wherever the receiving degree has no elective
  slack: r = −0.996 (MA ours), −1 by construction (VA), −0.86 (MA PDF); in CA it is
  exactly 60 × (1 − broad utilisation). Putting VA on the MA construction (unused
  credit + degree minimum above 120; 12 of 15 guides exceed 120, UVA 134) raises it
  from 0.96/6.6 to 4.6/10.2, equal to CA bio. The MA headline moves by cohort alone:
  12.9 on the 49 printed pathways, 15.0 on all 61 (the omitted Massasoit/Roxbury
  pathways average 23.6). Ten PDF cells were revised to zero relative to the archive.
- **Figure 5's "MA is tuition-only" boundary is disputed.** This session's dossier
  found the MA workbook's Cost/Year row equals the campuses' published 2024–25
  tuition *plus mandatory fees* (Bridgewater $11,734 against ~$910 tuition; the
  notebook titles the tab "Tuition & Fees"; the PDF footnote says fees were
  excluded). Codex's memo repeats the tuition-only label. If the dossier is right,
  MA and CA are on the same basis and only the price year differs; the registry
  description, the comparison contract and the audit doc would need correcting.
  VA can be priced from SCHEV 2025–26 for 12 of 15 universities in about two hours.
- **Figure 6's sign is articulation density.** CA cs: r(Δ, requirements consumed)
  = −0.79; MA: A2B pairs −24 vs +26. A working VA Figure 6 would print negative
  almost everywhere, inverting the paper's hypothesis in the state that
  standardised its courses. CA econ is a null instrument (40% exact zeros, 4 edges
  per graph); CA bio excludes 75% of its rows. Codex's discordant case
  (Holyoke → Amherst: 48% strict use, 0 excess hours, +25 complexity) is the one
  case worth recovering.
- **Figure 2's MA dots can be named** by a course-code rollup of the final-repo
  heatmap (7 of 11 computing dots exact, the rest within 4 points; Fitchburg is the
  58% outlier, Framingham 5.8 and UMass Boston 9.0 the floor); Codex recovered the
  exact plotted arrays from the final notebook, so the raster disclaimer can go.
  The CA non-STEM column (0%, n = 4) is upper-division ethics/writing; MA's (76%,
  n = 5) is lower-division writing/speech. Not comparable; grey it.

## 4. Visuals worth building (merged, deduplicated)

1. **Ceiling-anchored Figure 1.** Each cell as coverage ÷ ceiling, or the
   lower-division panel beside the published all-levels panel; the ceiling drawn
   as a small bar per university (CA 37–68, MA 45–72, VA 49–52). A
   denominator-anatomy strip per university: lower-division articulated /
   lower-division dead at every college / upper division / GE / padding. This
   retires the raw three-state ordering and shows why econ 23.7 vs bio 51.2.
2. **Credit-allocation ledger beside Figure 3.** Stacked units per corpus: named /
   actual GE / elective-only / unused / explicitly denied, with assumed portions
   hatched; strict and broad rates on the same cohort; VA drawn twice (catalog,
   scheduled); MA on the gray-row recalculation.
3. **"Form of the guarantee" paired-dot triptych.** CA: local AS → AS-T per
   campus, three majors (+6 to +18); MA: non-A2B → A2B per university (4
   universities); VA: scheduled → catalog per college (0 to −32). One 0–100 axis;
   the arrow length is the state's instrument. CA's "never 100" and MA's "100 or
   nothing" are visible without annotation.
4. **Sequence-decay ladder across states.** CS1 → CS2 → data structures →
   discrete → computer organisation → upper division, share of cells covered,
   three state columns, coloured by failure layer (not articulated / not mapped /
   not scheduled), calculus and science as flat reference lines. Needs a CA
   per-receiver census (open item).
5. **Axis-of-variation strips.** Per state, university means and college means as
   two strips on one axis for Figures 1, 3 and 4: CA spreads on the university
   strip, VA (scheduled) on the college strip, MA on both. The cross-state answer
   to "where does the failure live".
6. **Figure 2, lower-division, three panels.** VA catalog dots hollow (ceiling) and
   scheduled filled; non-STEM greyed with n; a CA cross-major strip (own discipline
   45.7 / 85.0 / 91.6 vs quantitative 83.0 / 79.0 / 67.7) with computing split out
   of bio/econ's math role.
7. **Figure 4 as ECDF or decomposed bars** with the zero mass drawn, a dollar
   secondary axis at the state's median rate and the rate band as a ribbon (CA
   thin, MA medium, VA wide). Retires Figure 5 as a matrix.
8. **MA A2B overlay** on the heatmap (needs the MT column imported).
9. Optional methods note: Figure 6 Δ vs articulation scatter; Holyoke → Amherst
   prerequisite diagrams if the final graph is recovered.

Side-by-side state panels as the hero were rejected earlier in this project;
these proposals keep the difference or the decomposition as the hero.

## 5. Investigations, ordered by value over effort

1. **Fix the measurement contract** (Codex 1). Pin academic year, program, sector;
   sending plan as the denominator; strict and elective-inclusive application
   separately; calendar normalised once; MA cohorts 165 / 61 / 49 named; CA
   cohort verified AS-T vs local; VA program pins deliberate (BA vs BS,
   concentration). Adopt lower-division-only or ceiling-normalised as Figure 1's
   disclosed control.
2. **Import the MassTransfer MT/A2B flag** onto the `ma-cs` documents (small) so
   visuals 3 and 8 render live; record that the flag also marks data source.
3. **Virginia sources.** Capture a multi-term schedule window (Codex 5); resolve the
   CSC 221/205 credit conflicts, the Bridgewater "Consider" row, NSU's two-choice
   science row and the SDV refusals; compute a strict named/GE VA Figure 3
   counterpart; solve the VCCS CS associate against each guide so VA gets a
   sending-side denominator (the live endpoint excludes 304/304 today).
4. **California census.** Per-receiver dead-column census (which lower-division
   named courses articulate at zero colleges) so the ladder has a CA column; decide
   whether Palo Verde / Lassen / Feather River lack agreements or curriculum; settle
   the bio/econ template status (verified flag true, research status
   `ai_researched`); test whether the AS-T gap scales with lower-division own
   discipline demand per campus (Riverside +18 vs UCLA +6).
5. **Massachusetts sources.** Derive an *observed* GE-transfer rate from the 61
   transfer tabs (gray rows by category) instead of assuming one; rebuild templates
   so elective slots consume their concrete fillings (GE-on becomes 53.5, not
   63.7); reconcile the Tallys typing (27/88) and the Figure 2 population before
   reuse; check the MassTransfer equivalency database for Mount Wachusett →
   Bridgewater data structures / Calc II to confirm the "unrecorded" reading; test
   whether the A2B template codified a pre-existing de facto core.
6. **Figures 4 and 5.** Switch the cross-state measure to unused associate credit
   (pathway minus resident) with a common elective rule; enter SCHEV rates for VA
   if a dollar figure is wanted; confirm the MA price basis and correct the labels.
7. **Figure 6.** Drop from the cross-state set; recover Holyoke → Amherst if a case
   is wanted.
8. **Housekeeping the guard will catch:** the served `va-cs` coverage corpus is 256
   rows against a pinned 384; `ma-cs` rows still carry meaningless named-unit
   fields (`degree_units_named_*`, a clamp artefact); the Compare tab's
   unfiltered-knob defect; `docs/visualizations.md` §11 quotes stale Figure 6
   counts.

## 6. Decisions for Tybalt

1. Figure 1's role: opening map (this document) or appendix (Codex).
2. The MA Figure 5 price basis: tuition-only (paper footnote, Codex) or tuition +
   fees (workbook, this session). Check Bridgewater's $11,734 against its fee
   schedule.
3. Which VA number is the headline: catalog (a ceiling) or scheduled (a lower
   bound until windows are normalised).
4. Which MA Figure 3 cohort and vintage: 61 pathways at 67.7 (PDF) / 64.7 (our
   gray-row) or the 49 at 70.5.
5. Whether GE + units remains the group's default at all. Both analyses: yes for
   Figures 3 and 4, no for Figures 1 and 2.
6. Whether to publish the A2B split given the source-completeness caveat.

## 7. Where the receipts are

- Codex: [`analysis/results/paper_planning/`](../analysis/results/paper_planning/)
  (scripts, CSVs, plots, `README.md`).
- Claude: [`analysis/results/paper_planning/claude-2026-09-07/`](../analysis/results/paper_planning/claude-2026-09-07/)
  — `brief.md`, six `dossier-fig*/`, five `dive-*/`, `verify/` (19 adversarial
  verdicts on the first eight Figure 1 claims), each with its scripts and text
  outputs; large row dumps were not copied and regenerate from the scripts.
- Policy sources with URLs and fetch dates: `dive-policy-context/report.md`
  (MassTransfer policy guidelines 2020; DHE deck 2025; Ed. Code §66746–47; Cal-GETC
  1.4; Code of Virginia §23.1-907/908; VCCS GAA pages; CCRC/Aspen 2024–25).
