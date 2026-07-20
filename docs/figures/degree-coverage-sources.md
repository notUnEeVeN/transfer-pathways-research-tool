# Degree-coverage figure (MA Fig. 1) — source of truth

*Percent of a UC campus's **full four-year BSCS degree** requirements that have an
articulated equivalent at each California community college.*

This is the authoritative provenance record for the hand-gathered degree
requirements behind the degree-coverage figure. Every course, count, and rule
below cites the exact URL it came from. When a campus's requirements change, or a
number is questioned, this doc is what we check against.

Data lives in `curated_requirements` with `kind: "degree"`, authored in
[`scripts/data/uc_degree_requirements.json`](../../scripts/data/uc_degree_requirements.json)
and loaded by [`scripts/import_uc_degree_requirements.py`](../../scripts/import_uc_degree_requirements.py).

---

## The short version

- The coverage heatmap now defaults to `requirements=degree`, which reads these
  editable templates live. Its **ASSIST minimums** and **Hand-curated minimums**
  modes preserve the earlier transfer-minimum measures for comparison.
- This figure measures the **whole degree** — all four years, including
  upper-division courses a CC can never provide — so a community college that
  perfectly articulates every lower-division course still lands well below 100%.
  That gap *is* the point of the figure.
- We reuse the existing choose-N eligibility engine
  (`server/services/analysis/pathways.chooseNMinimum`). A degree requirement is a
  set of "select N from {courses}" groups. For a given CC, a course counts as one
  completion when that CC articulates the course's `parent_id`. Percentage =
  satisfiable slots ÷ total required slots.
- **UC Berkeley uses the EECS B.S.** (its only CS *B.S.*; the CS **B.A.** is a
  separate L&S program kept available but not the default). The 8 other campuses
  use their own CS/CSE B.S. programs (to be gathered).

---

## What the figure measures (methodology)

Each degree is modeled in the ASSIST agreement `requirement_groups` shape so the
existing engine evaluates it unchanged. Requirements fall in three tiers:

| Tier | Meaning | Satisfiable by a CC? |
|---|---|---|
| `transferable` | Lower-division major prep with an ASSIST `parent_id` | Yes, when the CC articulates that `parent_id` |
| `breadth` | H/SS + natural science, transfers near-universally via breadth articulation | Yes (modeled as select-N from a proxy list — see below) |
| `nontransferable` | Upper-division / residency / free electives | No — ASSIST never articulates UC upper-division courses, so these are `kind: "requirement"` receivers with no `parent_id` and always count against the denominator |

The denominator is **course-slots** (a "select 3 of 5" contributes 3), which is
what `section_advisement` and `chooseNMinimum` already count. Unit totals are
recorded as secondary context.

---

## UC Berkeley — EECS B.S. — per-datum provenance

**Program & unit total.** B.S. in Electrical Engineering & Computer Sciences,
120-unit minimum.
Source: [Berkeley Academic Guide — EECS](https://guide.berkeley.edu/undergraduate/degree-programs/electrical-engineering-computer-sciences/)
· [College of Engineering EECS major page](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/major-programs/electrical-engineering-computer-sciences/)

> **Verifying today (2026-07):** Berkeley's new catalog consolidates all EECS
> major coursework (lower-div, upper-div 20-unit + design rule, ethics, natural
> science) on one page:
> [undergraduate.catalog.berkeley.edu — EECS B.S. requirements](https://undergraduate.catalog.berkeley.edu/programs/16306U/requirements-krhha)
> (successor to guide.berkeley.edu, where this data was originally gathered).
> Full hand-verification = that page + the
> [CoE degree requirements](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/)
> (H/SS breadth, 120 units) + the
> [CoE H/SS details](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/humanities-and-social-sciences/)
> (2 R&C + ≥2 upper-division of the 6) + the
> [IGETC campus guidance](https://admission.universityofcalifornia.edu/admission-requirements/transfer-requirements/preparing-to-transfer/general-education-igetc/campus-guidance.html),
> plus the "Modeling decisions" section below for the derived items (free
> electives, AH&I). The in-app "Verify these requirements" card
> (`frontend/src/degrees/degreeSources.js`) mirrors this path per campus.

### Transferable — lower-division major prep (13 slots)

| Requirement | Course(s) | `parent_id` | Source |
|---|---|---|---|
| Calculus I / II | MATH 51, MATH 52 | 351686, 245397 | [EECS lower-div reqs](https://eecs.berkeley.edu/resources/undergrads/eecs-2/degree-reqs-lowerdiv-2/) |
| Multivariable Calc | MATH 53 | 352027 | same |
| Linear Algebra & Diff Eq | MATH 54 | 246154 | same |
| Intro CS | CS 61A | 292039 | same |
| Data Structures | CS 61B *(or 61BL)* | 256849 | same |
| Machine Structures | CS 61C | 208145 | same |
| Discrete Math & Prob | CS 70 | 356766 | same |
| Signals/Info; Circuits | ELENG 66, ELENG 64 | 304910, 304911 | same |
| Physics (7-series) | PHYSICS 7A, 7B | 245412, 275225 | same |
| Natural science elective (select 1) | ASTRON 7A/7B, BIO 1A/1B, CHEM 1A/1B/3A/3B, MCB 32, PHYS 7C | 10 options | [EECS lower-div reqs, note 1](https://eecs.berkeley.edu/resources/undergrads/eecs-2/degree-reqs-lowerdiv-2/) |

### Breadth — Humanities/Social Sciences (6 slots: R&C + lower-div + upper-div)

The College of Engineering requires **"at least six courses that satisfy the
Humanities and Social Sciences (H/SS) breadth requirement,"** of which **2 must
be Reading & Composition (English, parts A + B)** and — per the College's H/SS
rules — **at least 2 of the 6 must be upper-division (courses numbered
100–196)**. Since both R&C courses are lower-division, the four additional
courses split into at most 2 lower-division (CC-satisfiable, with ESS-adviser
sign-off) + at least 2 upper-division (never CC-satisfiable).
Source: [College of Engineering general degree requirements](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/)
· [CoE Humanities & Social Sciences requirement](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/humanities-and-social-sciences/)
("At least 2 of the 6 H/SS courses must be upper-division (courses numbered 100-196)")
· [EECS major page](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/major-programs/electrical-engineering-computer-sciences/)
· [Berkeley Engineering transfer FAQ](https://engineering.berkeley.edu/admissions/undergraduate-admissions/prospective-junior-transfer-faqs/)

> **Corrected 2026-07-14.** The template originally scored all 4 non-R&C H/SS
> courses as CC-satisfiable, missing the upper-division rule. The 2
> upper-division slots now sit in the non-transferable tier. Together with the
> same-day free-electives recount (3 → 4, see the non-transferable table),
> Evergreen Valley verification moved 16/29 (55%) → 14/30 (47%).

**Evaluated from each college's own course GE-area tags, not major-prep
articulation.** ASSIST's CS/EECS agreements never carry English or H/SS, but
every CC course in our `courses` collection records its `igetc_area`, so the
lower-division portion is satisfiable directly:
- **Reading & Composition (English)** — R1A ↔ **IGETC 1A** (English Composition),
  R1B ↔ **IGETC 1B** (Critical Thinking-Composition). Covered when the college
  has a course tagged that area (e.g. Evergreen's `ENGL C1000` / `C1001`).
- **Lower-division H/SS breadth** — *select 2* from the college's **IGETC Area 3
  (Arts & Humanities) + Area 4 (Social & Behavioral Sciences)** courses.
- **Upper-division H/SS** — *2 slots, non-transferable* (CoE: ≥2 of the 6 must
  be numbered 100–196; CCs teach no upper-division courses).
- **American History & Institutions** — no clean IGETC area, so **assumed
  satisfiable** at every college (UC-required; a qualifying U.S. history/gov
  course exists everywhere). Flagged as an assumption in the data.
- **Entry-Level Writing** excluded — a proficiency gate, essentially always
  pre-met by junior transfers, not a course slot.

The IGETC-area mapping above is the part most worth a human accuracy check.

**Denominator = 30 slots**: 14 transferable (13 major-prep + AH&I) + 4 breadth
(2 R&C + 2 lower-div H/SS) + 12 non-transferable (incl. 2 upper-div H/SS and
4 derived free electives).

### Non-transferable — completed at Berkeley (11 slots)

| Requirement | Slots | Basis | Source |
|---|---|---|---|
| Upper-division EECS technical electives (incl. 1 design course) | 5 | 20 units ÷ 4 (authored `units: 20` in the data) | [EECS upper-div reqs](https://eecs.berkeley.edu/resources/undergrads/eecs-2/degree-reqs-upperdiv-2/) |
| Upper-division H/SS breadth | 2 | ≥2 of the 6 H/SS must be numbered 100–196 | [CoE H/SS requirement](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/humanities-and-social-sciences/) |
| Ethics / social implications of technology | 1 | 1 course | same / [College page](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/major-programs/electrical-engineering-computer-sciences/) |
| Free electives | 4 | 120u ÷ 4u = 30 slots − 26 modeled slots (team decision 2026-07-14: flat ~4u/course average; was 3, an unsupported "~12 units" guess) | [College page](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/major-programs/electrical-engineering-computer-sciences/) |

**Denominator = 30 slots** (14 transferable + 4 breadth + 12 non-transferable). A
CC that articulates every lower-division course tops out near **18/30 = 60%**.
The unit budget shown on the template page is computed from the stored data:
flat ~4u per slot unless a section carries an authored `unit_advisement`
(Berkeley's 20-unit UD block) — 56u + 16u + 48u = 120u ✓. Real per-course units
vary (CHEM 1A / BIO 1A are 3u; H/SS minimum is 3u), so the flat average is a
deliberate simplification, not gathered data.

---

## Two data gotchas (documented, not bugs)

1. **Fall 2025 course renumbering.** Berkeley renamed MATH 1A→**51**, 1B→**52**
   ([Math dept](https://math.berkeley.edu/courses/overview/lowerdivcourses)) and
   EECS 16A→**ELENG 66**, 16B→**ELENG 64**. Our scraped `university_courses` has
   the new MATH numbers but still the **old** EECS numbers. The importer aliases
   `ELENG 66/64 → EECS 16A/16B`, so requirements may be authored in either
   numbering.
2. **IGETC does not apply to Berkeley Engineering.** Per
   [UC campus guidance](https://admission.universityofcalifornia.edu/admission-requirements/transfer-requirements/preparing-to-transfer/general-education-igetc/campus-guidance.html),
   Berkeley Engineering "does not accept IGETC/Cal-GETC as completion of breadth."
   So breadth is modeled via per-course GE/Breadth articulation, not an IGETC flag.
   (Other campuses vary — relevant if/when we expand.)

---

## Modeling decisions (v1 — revisit if numbers warrant)

- **Slots, not units.** The engine counts course-slots. Unit→slot conversions
  assume a flat **~4 units/course average** (team decision 2026-07-14) —
  authored `units` on a requirement (e.g. Berkeley's 20-unit UD block) override
  it in the page's unit-budget check. Berkeley's free electives are derived
  from this budget: 120u/4 = 30 slots − 26 modeled = 4.
- **Free electives = non-transferable.** Conservative; a transfer student may in
  practice fill these with transferable units.
- **Breadth split (Berkeley): R&C (2) + lower-div H/SS (2) + upper-div H/SS
  (2, non-transferable).** The upper-division pair reflects CoE's ≥2-upper-div
  rule (corrected 2026-07-14; previously modeled as a CC-satisfiable select-4).

---

## Reproduce it yourself

```bash
# Dry-run: resolve every code to a parent_id and print a match report, no write.
python scripts/import_uc_degree_requirements.py --dry-run

# Write/refresh curated degree requirements (needs scripts/.env
# with TARGET_MONGO_URI / TARGET_DB_NAME=pmt_research).
python scripts/import_uc_degree_requirements.py
```

To add a campus: append its block to
[`scripts/data/uc_degree_requirements.json`](../../scripts/data/uc_degree_requirements.json)
(course codes + choose-N + tiers), add its provenance section here, then re-run
the importer.

---

# The other 8 UC campuses (batch add — 2026-07-11)

Researched (one background agent per campus, each pulling the official
catalog/department pages), modeled the same way as Berkeley, imported, and
verified against a real community college. Every decision below is deliberate —
edit any of them and re-run `scripts/import_uc_degree_requirements.py`.

*Worked: started 13:07 PDT, finished 13:23 PDT (2026-07-11) — ~16 minutes.*

## Uniform decisions applied to all 8 (change here to change globally)

1. **Program** = each campus's flagship general **Computer Science B.S.** (Merced's
   flagship is *Computer Science and Engineering* B.S.; Davis's CS B.S. moved
   L&S → College of Engineering in Fall 2024, same courses). CSE tracks / B.A.
   versions were noted by the agents but not modeled.
2. **Breadth = uniform**: 2 Reading & Composition (IGETC 1A + 1B) + 4 H/SS (IGETC
   Area 3 + 4) + American History & Institutions (assumed). Modeled identically at
   every campus for comparability. *(Campus-by-campus verification is replacing
   this: Davis now carries its own Cal-GETC GE model — see its section.)* Non-Berkeley R&C uses **IGETC-area tags (1A/1B)**,
   not specific English course codes, because those aren't reliably in our scraped
   data — same evaluation result (a CC's 1A/1B course satisfies it).
3. **Transferable major-prep** = each campus's lower-division required math + CS +
   (physics/science where the major requires it), from the catalog, resolved to our
   `university_courses`. Choose-one alternatives preserved (calc sequences, etc.).
4. **Non-transferable = upper-division major coursework**, counted as courses from
   each catalog (core + the elective requirement expressed as courses). Shown as one
   collapsed "N courses — at the university" line.
5. **Omitted**: freshman seminars (COM SCI 1, CSE 001, ENGR 001), flexible
   science-elective blocks with no fixed course (UCI/UCSB science). UCSC dropped
   CSE 40 (ML — not in our data) + ECE 30.

## ⚠️ The one caveat most worth your review: semester vs quarter

**Berkeley and Merced are semester** (~120 units, ~30 courses total); **the other
seven UCs are quarter** (~180 units, ~45 courses total). Because we count course
*slots*, quarter campuses have more total slots, which **mechanically lowers their
%** even at equal real transfer-preparedness. So the raw % is **not directly
comparable across the semester/quarter line** — compare within a system, or compare
the **transferable major-prep coverage** (the reliable cross-campus signal). Any
normalization (by units, or excluding free electives) is left to you.

## Verification (all vs. Evergreen Valley College, a well-articulated CC)

| Campus | % | covered/total | major-prep | breadth | non-transf |
|---|---|---|---|---|---|
| UC Berkeley *(sem)* | 47% | 14/30 | 10/14 | 4/4 | 12 |
| UC Merced *(sem)* | 65% | 20/31 | 14/16 | 6/6 | 9 |
| UC San Diego | 42% | 15/36 | 9/12 | 6/6 | 18 |
| UC Riverside | 46% | 18/39 | 12/14 | 6/6 | 19 |
| UC Davis | **54% by units** (97/180u; slots 12/31 = 39%) | 12/31 | 8/9 | 4/4 | 18 |
| UCLA | 49% | 21/43 | 15/17 | 6/6 | 20 |
| UC Irvine | 45% | 17/38 | 11/15 | 6/6 | 17 |
| UC Santa Barbara | 46% | 16/35 | 10/12 | 6/6 | 17 |
| UC Santa Cruz | 54% | 15/28 | 9/10 | 6/6 | 12 |

*Berkeley re-verified 2026-07-14 after the upper-division H/SS correction
(2 breadth slots moved to non-transferable). Per the
[UC IGETC campus guidance](https://admission.universityofcalifornia.edu/admission-requirements/transfer-requirements/preparing-to-transfer/general-education-igetc/campus-guidance.html),
Berkeley Engineering is the only outright "not accepted"; the other eight
accept IGETC/Cal-GETC (several discourage it in favor of major prep), so their
uniform 6-slot breadth model stands. UCLA Samueli's wording ("not
required/encouraged") is the one most worth a follow-up check.*

## Per-campus specifics + sources

### UC San Diego — Computer Science, B.S. (CS26 / CSE-BS-002), Fall 2026 checklist — reworked 2026-07-20
Sources: CSE major checklist PDF (source of truth, Tybalt-supplied) https://drive.google.com/file/d/1hLg7rehInSV9pra_1RYuPq8Rsi4IEwXc/view · Warren College GE https://warren.ucsd.edu/academics/general-education/index.html (Warren = Tybalt's college, used as the engineering-college GE pattern)
- Major-prep (52u LD block): MATH 20A/20B/20C + MATH 18 (honors variants 31AH/31BH/31CH skipped — unresolved in ASSIST); CSE 11 (sole intro path on this checklist; 8A appears only as an LD-elective option), CSE 12, CSE 20-or-MATH-15A (discrete; MATH 109 UD skipped), CSE 21 (MATH 154/158/184/188 UD alternates skipped), CSE 29 (replaces the old 15L-or-29 row — checklist lists 29 only), CSE 30; LD elective ×1 (CSE 3/8A, MAE 8, COGS 9/10/18, ECE 15, NANO 15 resolved; the list also allows any CSE UD course); General Science ×1 (PHYS 2A/4A/2B/4B, CHEM 6A/6B, BILD 1/2/3 + 5A fallback; UD options like BICD 100 skipped).
- **Statistics options are all upper-division** (MATH 181A/183, ECON 120A, ECE 109, CSE 103) → named non-transferable slot, not CC-satisfiable.
- Warren GE, IGETC-transfer lens (per Tybalt): IGETC certification satisfies everything except **WCWP 100** (UD writing) + **one 4-unit UD course non-contiguous to the major** → 2 named non-transferable slots. For the CC-side percentages, the completed-via-IGETC demand is modeled as 8 breadth slots: Warren Writing ×2 (1A/1B; WCWP 10A/10B equivalents) + 6 breadth courses (the engineering path's two Area Studies × 3 courses, spanning IGETC Areas 3/4/5). Formal Skills (2 courses) overlaps the major (MATH 20A/20B, CSE 11 are on its list) — no separate demand. Ethics & Society (PHIL/POLI 27+28) is asked of first-years, not transfers (absent from both transfer paths on the Warren page) — no demand.
- Non-transferable: 21 = Statistics + WCWP 100 + UD non-contiguous GE + 18 UD major (CSE 100/100R, 101, 110 + Systems 12u + Theory/Abstraction 12u + Applications 12u + CSE electives 24u = 72u, itemized as named slots).
- Unrestricted electives ×3 / 12u (Davis-convention assume block): specified work models to 168u vs the 180 graduation minimum — free-elective slack is CC-transferable, closing the budget to exactly 180.

### UC Riverside — Computer Science, B.S., catalog year 2025 (BCOE) — reworked 2026-07-20
Single source of truth: the BCOE suggested course plan https://student.engr.ucr.edu/course-plans/2025/09/25/computer-science (links a Google Sheet with the full plan, the breadth checklist, and the technical/depth/breadth elective lists — it incorporates the GE requirements, so the majors page and breadth page are corroborating context only)
- Major-prep: MATH 9A/9B/9C (5-series alternates dropped — the plan lists 9-series only) + MATH/CS 11 (discrete, stored as CS 11) + MATH 31-or-EE-20B (applied linear algebra) + MATH 10A (multivar); CS 10A/10B/10C + CS 61 (the majors page's CS 9-series change-of-major numbers are NOT in the plan and are excluded); PHYS 40A/40B/40C (15u authored).
- Also lower-division & CC-articulable: Engineering **depth** elective ×1 (MATH 10B, MATH 46, EE 5/16/20A, ENSC 1/2, ME 2/9/10/18A) and Engineering **breadth** elective ×1 (CHEM 1A/1B/1C, LING 20, STAT 10; ECON 5/60, LING 21, BIEN 10 on the list but unresolved in ASSIST — omitted).
- English composition is **three quarters**: ENGL 1A (IGETC 1A) + ENGL 1B (IGETC 1B) at CC, third quarter = ENGR 180W Technical Communications at UCR (non-transferable slot).
- BCOE breadth (no IGETC pattern; per-course): Humanities 12u (World History; Fine Arts/Lit/Phil/Religious Studies; Human Perspective on Science & Technology) + Social Sciences 12u (Econ-or-PoliSci; Anthro/Psych/Soc; one more) = 6 courses, of which **at least 2 must be upper-division** (and 2 must share a subject area with ≥1 UD — majors-page rule) → modeled 4 LD CC-satisfiable (IGETC Areas 3+4 union) + 2 UD non-transferable. Ethnicity 4u course double/triple-counts inside these (no extra slot). Natural Sciences & Math 20u block: covered by major math/physics/CS except **Biological Sciences ×1** → modeled as BIOL 3 / BIOL 5A with IGETC 5B fallback.
- ENGR 001I (1u, first-year) — **not required for transfer students** (course-plan note; omitted). ENGR 101I (1u, junior/senior) required → non-transferable 1u slot.
- Non-transferable: 22 = 2 UD-breadth + ENGR 180W + ENGR 101I (1u) + 18 UD major (CS 100 [5u], 111, EE/CS 120A [5u], STAT 155, 141, 150, 152, 153, 161, project CS 178A-or-179E–Z + 8 technical electives ≥32u; authored 74u).
- Notes: min 180 units / max 216; plan total 183.

### UC Davis — Computer Science, B.S., catalog 2026-27 (College of Engineering)
Source: https://catalog.ucdavis.edu/departments-programs-degrees/computer-science-engineering/computer-science-bs/ · checklist https://cs.ucdavis.edu/sites/g/files/dgvnsk8441/files/media/documents/CS%20Major%20Checklist_0.pdf
- Major-prep (zero-padded codes): MAT 021A/021B/021C, MAT 022A-or-027A-or-067 (lin alg); ECS 020 (discrete); programming = the **ECS 036A/B/C series in its entirety** (checklist: "mixing of courses between series is not allowed"; the ECS 032/034 alternative is for non-majors switching in, deliberately not modeled — team decision 2026-07-14); ECS 050 (org); science = **one complete three-course series** (team decision 2026-07-14, reading the checklist's series structure with chained prerequisites): BIS 002A/B/C, CHE 002A/B/C, CHE 004A/B/C, or PHY 009A/B/C (BIO variants omitted — not in ASSIST yet). Series receivers articulate only when every course in the series does; authored units 12 (programming) / 15 (science).
- **GE modeled per Davis, not the uniform proxy** (team decision 2026-07-14): the
  catalog exempts Cal-GETC/IGETC completers from **all GE that may be met with
  lower-division courses**
  (https://catalog.ucdavis.edu/undergraduate-education/university-degree-requirements/general-education-ge-requirements/),
  and every California community college offers the full Cal-GETC pattern — so GE is
  **one assumed-satisfiable row**: "Cal-GETC certification" (11 courses / 34 semester
  units ≈ 51 quarter; authored 40 quarter units after the major's math + one-science
  overlap). **Upper-division GE remainder audit (2026-07-14):** every GE component
  (topical breadth, writing experience, oral, visual, civic/cultural, quantitative,
  scientific) has lower-division-certified courses → exempt; the ONE component that
  demands upper division — the College of Engineering's English Composition rule
  (UWP 101/102/104 or the UD Composition Exam) — is already counted inside the
  14-slot upper-division core (the checklist lists it there). AH&I stays its own
  assumed slot — the UC-wide graduation rule, separate from GE, satisfiable with
  high-school U.S. history
  (https://catalog.ucdavis.edu/undergraduate-education/university-degree-requirements/american-history-institutions-requirement/).
- Non-transferable: 14 checklist-verified upper-division core+electives (7 + 7; was
  16, an overcount) **plus the unit-gap allocation** (2026-07-14): Davis requires
  180 total / 64 upper-division units
  (https://registrar.ucdavis.edu/registration/plan/bach-reqs); the modeled blocks
  sum to 151u, and the 29u remainder decomposes exactly — **8u more upper-division**
  (64 − 56 modeled), **14u CC-transferable electives** (91u of modeled CC work +
  14u = UC's 105-quarter-unit transfer-credit cap, to the unit), and **7u any-level
  at Davis** (beyond the cap). Template = 180u exactly.
- **Unit-weighted coverage is Davis's headline** (team decision 2026-07-14):
  "units completed / units required" is the real graduation measure, so the
  evaluation now reports units coverable ÷ 180 alongside slot counts (sections use
  authored units where stated, flat ~4u otherwise). Evergreen: 97/180u = 54%
  (slots 12/31 = 39%). Campuses without verified unit data still headline slots.
- Notes: CS moved L&S → CoE effective Fall 2024 (courses identical, GE wrapper differs). Current catalog uses "choose 3 sciences" (older years hard-required PHY 9A + CHE 2A).
- **Catalog-vs-ASSIST vintage (verified 2026-07-14):** the source is the
  2026-27 catalog while ASSIST's agreements lag it. The original gathering
  under-listed the choose-N pools — MAT 027A, CHE 002C, CHE 004A/B/C, and
  BIS 002B/C all exist in ASSIST and are now included. The catalog's new
  **BIO 001/001L, 002/002L, 003 series is NOT in ASSIST yet and is omitted**
  (a CC course can never articulate to it in our data) — re-add when ASSIST
  publishes 2026-27 agreements. This lag applies to every campus sourced
  from a newer catalog than ASSIST's year: options absent from ASSIST are
  omitted rather than modeled as unsatisfiable.

### UCLA — Computer Science, B.S., catalog 2026 (Samueli/Engineering)
Source: https://catalog.registrar.ucla.edu/major/2026/ComputerScienceBS (curriculum version 2026.02R; the catalog is a Next.js app — the full structured curriculum tree is embedded in the page's `__NEXT_DATA__` JSON)
GE/writing/school sources: https://catalog.registrar.ucla.edu/browse/College%20and%20Schools/HenrySamueliSchoolofEngineeringandAppliedScience/School-Requirements (+ /General-Education-Requirements and /Writing-Requirement children)
- Major-prep, "Complete 17 courses" (subject code **COM SCI**): MATH 31A/31B/32A/32B/33A/33B, MATH 61 (discrete); COM SCI 31/32/33/35L, (COM SCI M51A or EC ENGR M16 — cross-listed logic design); PHYSICS 1A/1B/1C + (4AL or 4BL); plus COM SCI 1 (1-unit freshman seminar — modeled non-transferable: no ASSIST articulation exists, completed at UCLA).
- Samueli GE (reworked 2026-07-20), 5 courses / 24 units min, per-course model (school does **not** accept partial IGETC/Cal-GETC and discourages engineering transfers from completing them, so the no-IGETC student model applies): Arts & Humanities ×2 (two different subgroups → Areas 3A/3B); Society & Culture = Historical Analysis ×1 (→ 4F, with 3B fallback — 4 CCs certify history under humanities) + Social Analysis ×1 (→ 4 + subcodes except 4F); Scientific Inquiry ×1 Life Sciences (→ 5B). Writing I ×1 → Area 1A (catalog explicitly accepts an English Comp 3 equivalent from another institution).
- Engineering Writing + Ethics: one approved W/EW course (ENGR 181W–188EW family) satisfies both school requirements (CS majors don't get the ENGR 2 ethics alternative); full IGETC/Cal-GETC would waive Engineering Writing but not ethics — modeled as 1 non-transferable slot.
- Non-transferable: 22 = COM SCI 1 + EW/ethics + 20 UD (CS 111/131/180/181 + M151B-or-M116C + probability [MATH 170A/170E, STATS 100A, C&EE 110, EC ENGR 131A] + capstone [CS 130 or 152B] + 7 CS electives (28u) + 3 science&tech (12u) + 3 technical breadth (12u)).
- Notes: requires Differential Equations (MATH 33B) — atypical for CS. No chemistry. School unit rule: 180–185 min / 213 max; total_units kept at 180.

### UC Irvine — Computer Science, B.S., catalog 2026-27 (ICS)
Source: https://catalogue.uci.edu/donaldbrenschoolofinformationandcomputersciences/departmentofcomputerscience/computerscience_bs/
GE source: https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#generaleducationrequirementtext
- Major-prep: MATH 2A/2B, (I&C SCI 6N or MATH 3A) linear, STATS 67; I&C SCI 31/32/33 (prog series), 45C/46, 51/53, IN4MATX 43 (=SWE 43 in current catalog; our data stores IN4MATX 43), 6B/6D (discrete). **No physics** (science satisfied by GE Category II).
- GE (categories I–VIII, reworked 2026-07-20): Ia writing ×2 → IGETC 1A + 1B; II Science & Technology ×3 → Areas 5A/5B (the major's 2-course non-ENGR/ICS/Econ/Math science rule sits inside these); III Social & Behavioral ×3 → Area 4; IV Arts & Humanities ×3 → Areas 3A/3B; VI Language Other Than English ×1 → Area 6A (all 115 CCs have 6A-tagged courses; also satisfiable by HS work/exam). 12 CC-satisfiable GE slots total.
- GE categories carrying **no separate demand**: V Quantitative/Symbolic/Computational — completed by required major courses (STATS 67 = Va; MATH 2A/2B = Vb; catalogue: V courses "may also satisfy another GE category", and the CS sample program schedules no standalone V course); VII Multicultural and VIII International/Global — each 1 course that "may also satisfy another GE category" (sample program shows "GE III/VII" and "GE IV/VIII"), so they double-count inside III/IV; Ib upper-division writing — satisfied by ICS 139W inside the 17 upper-division courses (modeled there, not as an extra slot).
- Non-transferable: 17 (COMPSCI 161 + ICS 139W (also = GE Ib writing) + 4 flexible-core FA + 9 electives + 2 projects).

### UC Santa Barbara — Computer Science, B.S., major catalog year 2024-25 (CoE) — reworked 2026-07-20
Sources: https://cs.ucsb.edu/education/undergraduate/current-students (major + science-elective lists) · https://engineering.ucsb.edu/undergraduate/academic-advising/undergraduate-requirements · 2024-25 GEAR PDF https://engineering.ucsb.edu/sites/default/files/24-25_GEAR_DIGITAL.pdf (definitive requirement sheet)
- Major-prep (45u): MATH 3A/3B/4A/4B/6A (20u), PSTAT 120A; CMPSC 16/24/32/40/64 (21u authored — CMPSC 40 is 5u).
- **Science electives now modeled** (previously omitted): catalog year 2023-24+ moved physics out of prep into a 20-unit two-list block — List A 8u (broad science incl. ASTRO/CHEM/EARTH/ECON 1/2/EEMB/GEOG/MCDB/PHYS 4-5 → Areas 5A/5B, select 2) + List B 12u with ≥1 lab (PHYS 1–7 series, CHEM 1A–C + labs, MCDB 1A/1B/1LL → 5A/5B/5C, select 3); a course counts toward only one list. Modeled as GE-area proxies (the approved lists are huge and course-level ASSIST articulation for them isn't in the CS agreement).
- Engineering GE (GEAR): 8 courses — Area A ×2 (Writing 2/2E → 1A; Writing 50/105/107/109 tier → 1B) + Area D Social Sciences ×2 (Area 4) + Area E Culture & Thought ×2 (3B/4F) + Area F Arts ×1 (3A) + Area G Literature ×1 (3B). Special subjects (4 writing-designated GE courses, ethnicity, European/world traditions) ride inside D–G. **GEAR states full IGETC "may be used to substitute for the entire UCSB College of Engineering General Education pattern"** — except AH&I, which stays as the assumed slot. All 8 GE slots CC-satisfiable.
- Non-transferable: 17 itemized = CMPSC 130A, CMPSC 130B, ENGR 101 Ethics (3u) + Major Field Electives 14 courses / 56u (≥7 CMPSC; list includes CMPSC 110-190 range, ECE, MATH 108+, PSTAT 120B+). UD total 67u authored.
- Unrestricted electives ×3 / 12u (Davis-convention assume block): specified work models to 168u vs the 180 graduation minimum — the 12u of free-elective slack is CC-transferable ("just about units", within the 105-quarter-unit cap), closing the budget to exactly 180.

### UC Santa Cruz — Computer Science, B.S., 2025-26 curriculum chart (Baskin) — reworked 2026-07-20
Sources: official CS B.S. 2025-26 curriculum chart (found via williamsantosa/ucsc-cs GitHub guide, which pointed to Baskin's chart page) https://undergrad.engineering.ucsc.edu/files/2025/09/CS_BS_25-26.pdf · Registrar GE codes https://registrar.ucsc.edu/enrollment/general-education-requirements.html · IGETC policy https://catalog.ucsc.edu/.../intersegmental-general-education-transfer-curriculum-igetc/ (IGETC satisfies ALL UCSC GE except the upper-division DC requirement)
- Major-prep (5u courses; CSE 30/12/13S are 7u): MATH 19A-or-20A, 19B-or-20B (20-series honors kept as named unarticulated alternates), AM 10-or-MATH 21 (linear), AM 30-or-MATH 23A (multivar); chart's "Math Courses" block also holds CSE 16, **CSE 40 (ML Basics), and ECE 30 (Engineering Principles of Electronics)** — the latter two are new 2025-26 requirements with no ASSIST articulation yet, kept as named never-satisfiable transferable-tier slots (importer keeps unresolved codes visible as of 2026-07-20). CSE 20/30/12/13S programming chain (26u authored). No physics in the major; stats (CSE 107/STAT 131) is upper-division.
- GE (IGETC-transfer lens): 10 Registrar codes; MF rides major math and SR rides the in-major stats — no separate demand. Modeled CC-satisfiable: Composition ×1 (1A/1B), TA ×1 (3B), IM ×1 (3A), CC ×1 (3B/Area 4), ER ×1 (Area 7/4C), PE ×1 (Area 4/5), SI ×1 (5A/5B — the only science demand; tier transferable per science-above-AH&I ordering), PR ×1 (2u; no per-course IGETC analog but full IGETC certification satisfies it → assume). College core course is a first-year requirement, not asked of junior transfers.
- Unrestricted electives ×4 / 18u (assume block): specified work models to 162u vs 180 — CC-transferable slack, closing the budget to exactly 180.
- Non-transferable: 14 = CSE 40 + ECE 30 + 12 UD (itemized: CSE 101, 101M, 102-or-103, 107-or-STAT-131, 114A, 120, 130 + 4 UD electives [capstone/Comprehensive requirement counts as one; CSE 115A/185E/S excluded from electives] + DC slot [CSE 115A / 185E/185S / CSE 195 — the one GE piece IGETC does not waive]). UD 60u authored.
- Non-transferable: 12.
- Notes: dropped **CSE 40** (Machine Learning Basics — recent add, not in our data) and **ECE 30** (not in our data). AM 10/AM 30 alternatives (not in our data) replaced by their MATH equivalents (MATH 21/23A). CMPS/CMPE → CSE renumbering (~2019) noted.

### UC Merced — Computer Science and Engineering, B.S., catalog 2026-27 *(semester, 120 units)*
Source: https://catalog.ucmerced.edu/preview_program.php?catoid=26&poid=4233 (behind an AWS-WAF bot challenge — fetch with a real/headless browser, plain curl gets a challenge page)
GE source: https://ge.ucmerced.edu/students/ge-requirements/current-ge-requirements (AY23-24+ rules; includes an explicit CC-transfer articulation table per GE component; also 403s bots — Wayback snapshot 2026-05-19 used)
- Major-prep (zero-padded): MATH 021/022/023, MATH 024-or-041 (lin alg/diff eq), MATH 032-or-ENGR-080 (prob/stats); CSE 015 (discrete), CSE 022/024/030 (prog), CSE 031 (org), ENGR 065-or-EE-060 (circuits/digital); PHYS 008/008L/009/009L (10u, authored); ENGR 091 Professional Development (2u, in ASSIST as a receiving course — counted transferable, coverage data-driven); CSE 001 (1u intro seminar — **no ASSIST articulation**, modeled non-transferable at 1u).
- GE (reworked 2026-07-20, per the GE office's transfer table): Written Communication (WRI 010) ×1 → IGETC **1B** (not 1A — per the table); AtK Area A = Life Science ×1 → 5B (Physical Science half completed by the major's physics); AtK Area B = Social Science ×1 → Area 4 + all subcodes, plus 2 of {Literary & Textual → 3B, Media & Visual → 3A, Societies & Cultures of the Past → 4A/4F}. 5 CC-satisfiable GE slots.
- GE carrying **no separate demand**: Spark Seminar — waived for transfers (2+ semesters of college post-HS); Quantitative Reasoning — MATH 021 (and CSE 015) are on the QR course list; Language — CSE 022 is on the language coursework list (IGETC 6A / HS routes also exist); Intellectual Experience badges — per the CSE program-map badge table, Scientific Method / Quantitative & Numerical / Ethics are "completed with major requirements", Global Awareness + Sustainability double on the Life-Science pick, Diversity & Identity doubles on an ethnic-studies Social-Science pick, and the remaining analysis badges ride the AtK-B picks (max 2 badges/course respected).
- Upper-division GE (non-transferable): Crossroads ×1; Writing in the Discipline ×1 (CSE 155 / WRI 100 / ENGR 156 recommended); Culminating Experience — satisfied by CSE 120 inside the major core (no extra slot).
- Non-transferable: 12 = CSE 001 + Crossroads + WID + 9 (CSE 100/120 core [8u] + 28 units ≈ 7 elective courses).
- Notes: Merced's flagship CS degree is *Computer Science and Engineering*; semester system. 2021-22 program map's Bio/ESS requirement no longer exists in the 2026-27 catalog (life science now arrives via GE AtK-A only).

## Data note
The importer writes a temporary legacy-shaped row only as migration input, then
automatically rebuilds `curated_requirements`. Course resolution reads the
combined `assist_courses` catalog, and degree evaluation reads
`assist_agreements`.
