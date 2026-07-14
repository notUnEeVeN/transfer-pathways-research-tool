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
   every campus for comparability. Non-Berkeley R&C uses **IGETC-area tags (1A/1B)**,
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
| UC Davis | 49% | 17/35 | 11/13 | 6/6 | 16 |
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

### UC San Diego — Computer Science, B.S. (CS26), catalog Fall 2026
Source: https://cse.ucsd.edu/undergraduate/bs-computer-science · catalog https://catalog.ucsd.edu/curric/CSE-ug.html
- Major-prep: MATH 20A/20B/20C, MATH 18 (lin alg, formerly 20F); CSE 11 (intro), CSE 12, CSE 15L-or-29, CSE 20-or-MATH-15A (discrete), CSE 21, CSE 30; 1 natural science (PHYS 2A or 4A).
- Non-transferable: 18 (CSE 100/101/110 core + ~15 elective courses / 60 u).
- Notes: college GE is college-specific (Warren/Revelle/etc.) — modeled via IGETC instead. Stats requirement is upper-division → folded into UD.

### UC Riverside — Computer Science, B.S., catalog 2025-26 (BCOE)
Source: https://documents.ucr.edu/registrar/UCR%20Catalog%202025-2026.pdf
- Major-prep: calc (MATH 5A/5B/5C **or** 9A/9B/9C) + MATH 10A (multivar) + MATH 31 (lin alg); CS 10A/10B/10C, CS 61, CS 11 (discrete); PHYS 40A/40B/40C.
- Non-transferable: 19 (CS 100/111/120A/141/150/152/153/161/179 + STAT 155 + ENGR 180W + ~8 electives).

### UC Davis — Computer Science, B.S., catalog 2026-27 (College of Engineering)
Source: https://catalog.ucdavis.edu/departments-programs-degrees/computer-science-engineering/computer-science-bs/ · checklist https://cs.ucdavis.edu/sites/g/files/dgvnsk8441/files/media/documents/CS%20Major%20Checklist_0.pdf
- Major-prep (zero-padded codes): MAT 021A/021B/021C, MAT 022A-or-027A-or-067 (lin alg); ECS 020 (discrete), ECS 036A/036B/036C (prog series; renumbered from ECS 030/040/060 in F2020), ECS 050 (org); 3 sciences chosen from PHY 009A/B/C, CHE 002A/B/C, CHE 004A/B/C, BIS 002A/B/C.
- Non-transferable: 16.
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

### UCLA — Computer Science, B.S., catalog 2024-25 (Samueli/Engineering)
Source: https://www.seasoasa.ucla.edu/curric-24-25/44-compsci-ugstd-24.html
- Major-prep (subject code **COM SCI**): MATH 31A/31B/32A/32B/33A/33B, MATH 61 (discrete); COM SCI 31/32/33/35L, COM SCI M51A (logic; cross-listed EC ENGR M16); PHYSICS 1A/1B/1C + lab (4AL or 4BL).
- Non-transferable: 20 (UD-heavy: 111/118/131/180/181 + arch + digital-lab + prob + capstone + 5 electives + science&tech 3 + technical breadth 3).
- Notes: requires Differential Equations (MATH 33B) — atypical for CS. No chemistry.

### UC Irvine — Computer Science, B.S., catalog 2026-27 (ICS)
Source: https://catalogue.uci.edu/donaldbrenschoolofinformationandcomputersciences/departmentofcomputerscience/computerscience_bs/
- Major-prep: MATH 2A/2B, (I&C SCI 6N or MATH 3A) linear, STATS 67; I&C SCI 31/32/33 (prog series), 45C/46, 51/53, IN4MATX 43 (=SWE 43 in current catalog; our data stores IN4MATX 43), 6B/6D (discrete). **No physics** (science satisfied by GE Category II).
- Non-transferable: 17 (COMPSCI 161 + ICS 139W + 4 flexible-core FA + 9 electives + 2 projects).

### UC Santa Barbara — Computer Science, B.S., catalog 2025-26 (CoE)
Source: https://catalog.ucsb.edu/programs/BSCMPSC
- Major-prep: MATH 3A/3B/4A/4B/6A, PSTAT 120A; CMPSC 16/24/32/40/64. **No physics** (a flexible 20-unit science-elective block with no fixed course — omitted).
- Non-transferable: 17 (CMPSC 130A/130B + ENGR 101 ethics + 14 elective courses).

### UC Santa Cruz — Computer Science, B.S., current catalog (Baskin)
Source: https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computer-science-and-engineering/computer-science-bs
- Major-prep: MATH 19A/19B (calc), MATH 21 (lin alg), MATH 23A (multivar); CSE 12/13S/16/20/30. **No physics; stats is upper-division.**
- Non-transferable: 12.
- Notes: dropped **CSE 40** (Machine Learning Basics — recent add, not in our data) and **ECE 30** (not in our data). AM 10/AM 30 alternatives (not in our data) replaced by their MATH equivalents (MATH 21/23A). CMPS/CMPE → CSE renumbering (~2019) noted.

### UC Merced — Computer Science and Engineering, B.S., catalog 2026-27 *(semester, 120 units)*
Source: https://catalog.ucmerced.edu/preview_program.php?catoid=26&poid=4233
- Major-prep (zero-padded): MATH 021/022/023, MATH 024-or-041 (lin alg/diff eq), MATH 032-or-ENGR-080 (prob/stats); CSE 015 (discrete), CSE 022/024/030 (prog), CSE 031 (org), ENGR 065 (circuit theory); PHYS 008/008L/009/009L.
- Non-transferable: 9 (CSE 100/120 core + 28 units ≈ 7 elective courses).
- Notes: Merced's flagship CS degree is *Computer Science and Engineering*; semester system.

## Data note
The importer writes a temporary legacy-shaped row only as migration input, then
automatically rebuilds `curated_requirements`. Course resolution reads the
combined `assist_courses` catalog, and degree evaluation reads
`assist_agreements`.
