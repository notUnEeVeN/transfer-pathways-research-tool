# verify-3-reproduction — F4 ("the same four courses fail in all three states")

Reviewer stance: adversarial, arithmetic reproduction. All numbers below are OUR COMPUTATION unless
stated; artefact vintage and corpus named on every line. Scripts and raw outputs live beside this
file (`repro_ca_ma.py`, `repro_va.py`, `ma_percol.py`, `ma_percol2.py`, `ca_percourse.js`,
`ca_classify.py`, `ca_final.py`, `*_out.txt`, `ca_percourse.json`).

Note: the originating report path named in the task (`dossier-coverage-heatmap (...)/report.md`)
does not exist; the evidence files are in `scratchpad/dossier-fig1/` (`ca_mech_out.txt`,
`ma_out.txt`, `va_out.txt`), which is what I audited.

## Verdict: REFUTED as stated (the numbers reproduce; what they measure does not match the sentence)

The three headline numbers reproduce to the digit, but none of them is a measure of "the same
four courses". 69.1% and 70.6% are the share of the lower-division shortfall owed to the ENTIRE
"computing" course type (server classifier `services/courseTypes.js`: any CS/CSE/EECS/ICS-prefixed
course, plus anything matching software/algorithm/operating system/comput). A per-course census —
which the dossier itself lists as "an open question" — puts the four named families at roughly
46% (CA, strict) to 58% (CA, generous) and 45–50% (MA). The VA list mixes cell counts with
requirement-entry counts and partial spelling sums; two of its five figures are wrong as cell
counts, and the correct ordering puts CSC 205, not CSC 223, at the top.

## 1. CA cs — 69.1% (VERIFIED as a type share; REFUTED as a four-course share)

Corpus: CA cs, 9 UC templates (all `degree_template_verified: true`), degree lens, GE excluded
(`excludeGeGroups`), 1035 cells (9 × 115), course-count observations. Source: coverage rows pulled
by the dossier's `pull.js` (`coverage_cs.json`), re-summed independently in `repro_ca_ma.py`.

- Lower-division shortfall observations pooled over 1035 cells: 13,455 lower-division named
  observations, 9,231 covered → shortfall 4,224.
- By type: computing 2,917 (69.06%), math 992 (23.48%), science 315 (7.46%), non_stem 0.
  → **69.1% reproduces exactly** (cells 1035, by-type totals equal `named_requirement_courses_total`
  in all 1035 rows).
- Per-university computing share of shortfall ranges 30.9% (Merced) to 91.1% (San Diego): Berkeley
  78.2, Davis 88.4, Irvine 71.8, Merced 30.9, Riverside 67.4, San Diego 91.1, Santa Barbara 54.8,
  Santa Cruz 53.5, UCLA 83.0.

Per-course census (`ca_percourse.js`): I re-ran the live engine (`coverageData`, DB, 1035 evaluator
calls) with a second, label-returning `categoryOf` so each observation is keyed by university
course; pooled by-type totals from the labelled run equal the real rows exactly (computing
5175/2258, math 5980/4988, science 2300/1985), so the census partitions the same 4,224.

Hand-classified into the claim's four families (`ca_final.py`, mapping listed in the script):

| family | STRICT obs | GENEROUS obs |
|---|---|---|
| discrete structures (CS 70, ICS 6B/6D, MATH 61, CSE 20 UCSD, CSE 015, CS 11, CSE 16, CMPSC 40, CSE 21) | 538 | 653 |
| computer organisation (M51A, 61C, ICS 51, CSE 30, CSE 031, CS 33, CSE 12 UCSC, CS 61, ECS 050, CMPSC 64) | 595 | 938 |
| data structures (ICS 46, ECS 036C, CSE 12 UCSD, CS 10C, 61B, CSE 030) | 332 | 332 |
| CS2/OOP (CMPSC 32, ICS 45C, ECS 036B, CSE 024, CS 32, ICS 33, CMPSC 24, CSE 30 UCSC, CS 10B) | 479 | 523 |
| **four families** | **1,944 = 46.0%** | **2,446 = 57.9%** |

GENEROUS additionally counts CSE 13S (Computer Systems & C), CSE 29 (Systems Programming), ICS 53
(System Design), ICS 32, and the UCSC "CSE 16/40/ECE 30" section observation. Note that nine of the
discrete courses (425 obs) sit in the MATH type, so even the "computing type" is not a superset of
the four families.

The 1,398 computing-type observations that are NOT any of the four families (33% of the total
shortfall): CS 35L Software Construction (115), CSE 3 Fluency in IT (115), IN4MATX 43 Software
Engineering (112), CS 61A (110), EECS 16A + 16B (212), ECS 036A (76), ICS 31/32 (88), CSE 11 (39),
CS 31 (25), CMPSC 16 (21), CS 10A (12), CSE 022 (11), ICS 6N (4). That is: CS1 / intro programming
(~350), Berkeley's EECS 16A/B circuits pair (212), software tools/engineering (227), plus the
UCSC/USCD systems courses (343) in the strict reading.

## 2. MA cs — 70.6% (VERIFIED as a type share; REFUTED as a four-course share)

Corpus: MA ma-cs, 11 universities × 15 CCs = 165 cells, site corpus (`coverage_ma-cs.json`, our
import of the final-repo `Four Year Heatmap.xlsx` via `raw/heatmap.json`), GE excluded, course counts.

- Lower-division observations 2,325, covered 1,387 → shortfall 938. By type: computing 662
  (70.58%), math 177 (18.87%), non_stem 68 (7.25%), science 31 (3.30%). → **70.6% reproduces.**
- Cross-check against `raw/heatmap.json` directly (`ma_percol.py`): 155 lower-division columns × 15
  = 2,325; shortfall 935 (3 fewer than the site corpus — a 3-observation discrepancy I did not chase;
  it does not move any share by more than 0.1 pp).
- Per-university computing share of shortfall: Bridgewater 39.5, Fitchburg 84.6, Framingham 76.0,
  MCLA 78.1, Salem 67.0, Amherst 96.5, Boston 51.2, Dartmouth 38.8, Lowell 79.5, Westfield 93.5,
  Worcester 62.8.

Per-column census (final-repo vintage, 935 obs, title-regex families, two passes):
- pass 1: discrete 121, CS2/OOP 114, computer org 103, data structures 86 → **424 = 45.3%**
- pass 2 (tighter regex, physics/calculus excluded from CS2): discrete 135, CS2/OOP 125, computer
  org 118, data structures 86 → **464 = 49.6%**
- The other half is CS1 (Framingham CSCI 130 13/15, MCLA CSCI 101 12/15, Salem CSC 105 12/15,
  Westfield CAIS 0102 12/15, Boston CS 110 15/15), statistics (Framingham STAT 157 15/15,
  Bridgewater MATH 200 15/15), linear algebra (Boston MATH 260 15/15), operating systems
  (Framingham CSCI 258 15/15), networking (MCLA CSCI 210 15/15), programming languages (Salem
  CSC 299 15/15), databases, security, software engineering, ethics, technical writing.
- The dossier's "dead lower-division columns" list (20 columns with 0/15) is reproduced exactly,
  but 9 of the 20 are NOT one of the four families (Statistical Methods, Professional Exploration
  Seminar, OS/UNIX, Probability & Statistics, Network Theory, Concepts of Programming Languages,
  Introduction to Computing, Linear Algebra I, and Java III — the last being a third-course, not
  CS2). The evidence list quoted in the claim (Framingham CSCI 215, MCLA 221/222/361, Amherst
  220/230/240/250, Worcester 225/248) is a hand-picked subset.

## 3. VA scheduled view — counts (PARTLY VERIFIED)

Corpus: VA va-cs frozen module `vaCoverageRows.js`, variant `scheduled`, 15 universities × 16
CS colleges = 240 cells; 133 cells miss something, 1,417 missing units, 39 distinct requirement
strings (all VERIFIED against `va_out.txt`).

| claim | exact-string sum used by the dossier | cells, those strings only | cells, ANY spelling of the code | verdict |
|---|---|---|---|---|
| CSC 223 in 75 cells | 'CSC 223' 55 + 'CSC 223 Data Structures' 20 = 75 | 75 | 75 | VERIFIED |
| CSC 205 ≈ 60 | 'CSC 205' 32 + '…Computer Organization' 16 + 'CSC 205 or CSC 215' 14 = 62 | 62 | **82** (7 spellings; 89 entries) | depends on spelling subset; as "any CSC 205 requirement" it is 82 and it is the #1 missing course, ahead of CSC 223 |
| CSC 222 45 | 33 + 12 = 45 | 45 | 45 | VERIFIED |
| CSC 208/MTH 288 41 | 'CSC 208 or MTH 288' 21 + 'CSC 208' 12 + 'MTH 288' 8 = 41 | 41 | **59** (omits 'CSC 208 Discrete Structures' 6, 'MTH 288 or CSC 208' 6, two long spellings 3+3) | 41 is a partial sum; 59 by code |
| MTH 264/265 39 | 'MTH 264' 24 + 'MTH 265' 15 = 39 | **24** (all 15 MTH 265 cells also miss MTH 264) | 33 (incl. 'MTH 245 or MTH 264' etc.) | REFUTED as a cell count — it is an entry count |

Cell ranking by course code, any spelling: CSC 205 82, CSC 223 75, CSC 208 51, CSC 222 45,
CSC 215 41, MTH 288 41, MTH 264 28, MTH 265 24. The dive-va-mechanism report gives CSC 205 = 86 and
discrete = 59 for the same file; my count is 82 for CSC 205 (89 entries), so the three reports
already disagree on CSC 205 (≈60 / 82 / 86).

## 4. What survives

- CA cs (1035 cells, verified templates, GE excluded, lower-division observations): computing-type
  courses are 69.1% of the shortfall; the four named families are 46.0% (strict) – 57.9% (generous).
- MA cs (165 cells, final-repo heatmap): computing type 70.6%; four families ≈ 45–50%.
- VA scheduled (240 cells): CSC 205 82 cells, CSC 223 75, CSC 208/MTH 288 59, CSC 222 45, MTH 264/265
  24–33 — data structures / computer organisation / discrete / CS2 are indeed the top missing
  courses, but VA's measure is scheduling supply, not articulation, so "fail" means different things.
- Roughly a third of the CA computing shortfall and half of the MA computing shortfall is CS1,
  software engineering/tools, EECS 16A/B, OS, networking, databases, statistics — courses outside
  the four named ones. The "same four courses" narrative is defensible as a qualitative top-of-list
  statement, not with the 69.1% / 70.6% figures attached to it.
