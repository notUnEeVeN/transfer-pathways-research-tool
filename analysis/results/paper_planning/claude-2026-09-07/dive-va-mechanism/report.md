# dive-va-mechanism — Is Virginia really "best", and by what mechanism?

Date: 2026-09-07. Read-only investigation. Scratch scripts and raw outputs live beside this file
(`va_rows.py` / `va_rows.out`, `rebuild.js`, `run_variant.js` + `build_variant.js`, `va_class.py`,
`supply.py`, `ma_cols.py`, `ca_cls.py`, `db_va.js`, `db_va2.js`).

Vintage vocabulary used below:
- **VA frozen** = `frontend/src/analyses/vaCoverageRows.js`, `vaCreditRateRows.js`, `vaTransferGuides.js`
  (built 2026-09-06T23:20Z by `server/scripts/va/buildVaCoverageCells.js` from `server/.va-guides/guides.json`
  (32 guides) + `server/.va-courses/catalog/*.json` (23 colleges, captured 2026-08-31 from courses.vccs.edu)).
- **VA rebuild** = my own call of the repo's exported `build()` (no `--write`), which reproduces the frozen
  numbers to three decimals — so every frozen number below is VERIFIED unless stated otherwise.
- **VA canonical** = the older derived-agreement path (`va_courses` equivalency edges × catalog-composed
  degrees → `assist_agreements` state:'va'), read live from Atlas today via `coverageData` /
  `transferCreditRateData` (VERIFIED as of today) plus the August memory numbers (INFERRED; not reproducible
  today because the path is gated).
- **CA** = `analysis/data/course_repairs.v2.json` (our computation, July 2026; 9 UC CS programs, strict
  eligibility engine, stated-preparation basis, 1,761 blocking instances).
- **MA** = `server/data/ma/raw/heatmap.json` (deterministic conversion of the older repo's
  `Mass Heatmap.xlsx`; matches the final-PDF Fig 1 matrix in 164/165 cells per PROVENANCE.md).

Corpus for every VA number unless stated: major `va-cs`, 15 university guides (one per university,
concentrations collapsed) × 16 VCCS colleges that publish a CS associate degree = 240 cells; the "all 23"
variants add the 7 colleges with no CS associate (345 cells). Degree type `local_as`. No verified-cohort
toggle applies to the frozen rows.

---

## 0. Headline numbers (VA frozen, VERIFIED by rebuild)

| variant | cells | Fig 1 units, GE incl. (`pct_named_requirement_courses_with_ge`) | ceiling | Fig 1 units, GE excl. (`va_units_no_ge_pct`) | Fig 1 course estimate (`pct_named_requirement_courses`) | ceiling | Fig 3 utilisation (mean / pooled) | missing units | cells with a gap |
|---|---|---|---|---|---|---|---|---|---|
| catalog, 16 CS colleges | 240 | **50.16** | 50.39 | 44.40 | **42.26** | 42.53 | **98.47 / 98.46** | 70 | 18 |
| scheduled, 16 CS colleges | 240 | **45.64** | 50.39 | 39.38 | **37.81** | 42.53 | **89.49 / 89.45** | 1,417 | 133 |
| catalog, all 23 | 345 | 48.88 | — | 42.97 | 40.96 | — | 95.93 / 95.91 | 648 | — |
| scheduled, all 23 | 345 | 43.31 | — | 36.79 | 35.43 | — | 84.84 / 84.79 | 3,037 | — |

Fig 4 ("unused transfer-guide credit", hours above 120): 0.96 catalog / 6.57 scheduled (mean of 240 cells).

---

## 1. Why catalog-mode coverage is nearly constant and Figure 3 ≈ 100% — what the measure can and cannot vary on

### 1.1 The algebra (from `buildVaCoverageCells.js`, VERIFIED against every cell)

For one guide *g* and one college *c*:

- `covered = max(0, statedPre_g − missing_gc)`; `coverage = covered / statedTotal_g`
- `utilization = (statedPre_g − denied_g − missing_nondenied_gc) / statedPre_g`

Every term with subscript *g* is a property of the **guide**, identical for all 16 colleges (stated
pre-transfer credit at the top of its range, stated total, the GE "assumed" rows, the university-only
half, the SDV rows a university refuses). The **only** term that carries a *c* subscript is `missing_gc` —
the credits of itemised pre-transfer rows for which no alternative group is entirely present in the
college's course-code set. So:

- Fig 1 and Fig 3 are two affine functions of the same per-cell scalar (`missing_gc`). I checked the
  identity `as_wasted_units = as_denied_units + as_unavailable_applied_units` in all 240 + 240 + 345 + 345
  cells: 0 violations. Pooled: catalog wasted 230 = 160 denied (16 colleges × 10 units: Longwood, UL, RMC,
  UMW, UVA each refuse a 2-credit SDV row) + 70 missing; scheduled 1,577 = 160 + 1,417.
- The **unit-lens ceiling** is purely structural: `ceiling = statedPre/statedTotal`; Pearson r = 1.000
  across the 15 guides (range 49.2 GMU – 52.1 ODU, mean 50.39). "VA is capped near 50%" is the arithmetic
  of a 60-credit half of a 120–134 credit degree, not a finding.
- The **Fig 3 ceiling** per college is `1 − denied/pre`, i.e. 98.94% for every college with no supply
  gap; that is exactly what 11 of 16 colleges read in catalog mode.

### 1.2 What varies, and by how much (catalog mode)

Per-college GE-inclusive unit coverage: 50.39 at **11 of 16** colleges (Blue Ridge, Central Virginia,
Germanna, Reynolds, Laurel Ridge, New River, Northern Virginia, Piedmont, Tidewater, Virginia Highlands,
Wytheville); Brightpoint 49.92; Virginia Western 49.90; Virginia Peninsula 49.50; Paul D. Camp 49.49;
Southwest Virginia 49.43 (min). Range = 0.96 points.

Only **18 of 240 cells** miss anything, totalling 70 units, over **11 distinct requirement strings**:
CSC 208 (4 cells), CSC 215 (3), CSC 205 + CSC 215 (3), "CSC 208 Discrete Structures" (2), MTH 288 (2),
EGR 125, MTH 167, EGR 121, EGR 122, ENGR 121, ENGR 122 (1 each). Per college: Camp 6 cells (all
EGR/ENGR/MTH 288 — Camp's catalog carries no EGR at all), Southwest 5 (CSC 208 / 215), Peninsula 4,
Western 3, Brightpoint 2.

Per-course-class supplied rate over (guide row × college) tests, catalog: engineering 93.8% (48 tests),
discrete 96.7% (240), computer org/systems 97.7% (256), other math 97.9%, composition 99.6%; everything
else (calculus 608 tests, physics 368, intro programming, OOP, data structures 240 each) **100.0%**.

### 1.3 What the measure cannot see (all INFERRED from the code and the audit doc)

1. **University-side conditions.** Sequence rules, "must take two of", distinct-subject and
   language conditions, NSU's 8-credit two-choice science row, W&M's "Up to 12" language row are not
   evaluated; every cell carries `method_status: estimated` and `va_source_warnings`. The catalog number is
   an **upper bound** of guide-preparation availability.
2. **GE by assumption.** `va_ge_units` averages 12.53 of ~62 pre-transfer units (20%) and is credited
   at every college by construction ("any UCGS X"). GMU names every GE course (ge 0); RMC/UMW leave 20–21
   units open.
3. **Elective landings count as covered.** The frozen-rows header says so explicitly ("HSS Elective
   (2 of 5)" is a slot the degree defines). This is the opposite convention from the canonical path's
   wildcard rule (section 5) and is the single largest reason the two VA numbers disagree.
4. **Course estimates are credits ÷ average single-course size** (3.02–3.31 per guide), rounded and
   held to the stated halves. They are not MA-style binary named-course counts; the audit doc says not to
   call them a literal reproduction.
5. **Catalog ≠ offered.** A course "in the catalogue but not currently offered" is supplied in
   catalog mode. That is the whole content of section 2.

**Verdict for (1):** In catalog mode the VA Figure 1 is the ceiling minus a 0.47% supply residual
(70 / 14,945 stated pre-transfer units), and Figure 3 is 100% minus a 1.1% refusal constant minus the
same residual. The between-college axis carries essentially no information because Virginia's
articulation is keyed on the VCCS common course number, not on the sending college — the identical
property the canonical path shows (section 5: 24.16 at 13 of 16 colleges).

---

## 2. The scheduled-supply failure mode

### 2.1 What "scheduled" means (VERIFIED from `captureVccsCourseCatalogs.js`)

courses.vccs.edu marks a `<dt class="notScheduled">` ("Not currently scheduled") per college; the capture
stores it as `scheduled:false` and **records no term**. Captured 2026-08-31, so this is a one-term
snapshot (fall 2026 schedule in all likelihood). A course run only in spring or in alternate years reads as
unscheduled. Consequently **catalog = upper bound, scheduled = lower bound** on annual availability
(INFERRED). The direction of the college gradient below is robust to this; the magnitudes are not.

### 2.2 Which courses, at which colleges (VERIFIED from `.va-courses/catalog/*.json`, `supply.py`)

Nine core codes named by the guides (CSC 221/222/223/205/208/215, MTH 263/264/288). S = listed and
scheduled, L = listed, not scheduled, · = not in catalog.

| code | named by | brcc | bright | camp | cvcc | gcc | laurel | nova | nrcc | pvcc | reyn | swcc | tcc | vhcc | vpcc | vwcc | wcc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CSC 221 intro programming | 15/15 | S | S | S | S | S | S | S | S | S | S | S | S | S | S | S | S |
| CSC 222 OOP (CS2) | 15/15 | S | S | L | L | S | S | S | S | S | S | L | S | S | S | S | S |
| CSC 223 data structures | 15/15 | **L** | S | S | **L** | S | S | S | S | S | S | **L** | S | **L** | S | S | **L** |
| CSC 205 computer organization | 12/15 | S | S | L | L | S | L | S | S | L | S | L | S | L | S | L | L |
| CSC 208 discrete structures | 14/15 | S | S | S | L | S | S | S | S | L | S | · | S | L | S | · | L |
| CSC 215 computer systems | 8/15 | S | · | L | L | L | L | S | S | L | S | · | S | L | · | S | L |
| MTH 263 calculus I | 15/15 | S | S | S | S | S | S | S | S | S | S | S | S | S | S | S | S |
| MTH 264 calculus II | 14/15 | S | S | L | S | S | S | S | S | S | S | L | S | L | S | S | S |
| MTH 288 discrete math | 12/15 | S | L | · | L | L | L | S | S | S | S | L | S | S | · | S | L |

Scheduled core count of 9: **NOVA, New River, Reynolds, Tidewater 9/9**; Blue Ridge 8; Brightpoint,
Germanna, Peninsula, Western 7; Laurel Ridge, Piedmont 6; **Camp, Highlands, Wytheville 4; Central
Virginia 3; Southwest 2**. Among the 7 non-CS colleges: Eastern Shore lists only 2 of 9 (no CSC at all),
Mountain Gateway lists 8 / schedules 2, Southside 5/2, Rappahannock 5/3, Danville 9/4, Mountain Empire
6/5, Patrick & Henry 9/6.

Scheduled-mode missing cells by requirement string (VA frozen, 240 cells): CSC 223 55 + "CSC 223 Data
Structures" 20 = **75 cells / 300 units**; CSC 222 33 + 12 = 45 / 180; CSC 205 in its seven spellings
("CSC 205", "CSC 205 Computer Organization", "CSC 205 or CSC 215", "CSC 205 + CSC 215", "Consider CSC 205
or CSC 215", "CSC 205, 215, or MTH 265" ×2) = 86 cells; MTH 264 24 + MTH 265 15 = 39; discrete (CSC 208 /
MTH 288 in seven spellings) = 59; CSC 215 10; EGR/ENGR 121/122/125 22; MTH 167 6; MTH 266 6; PHY 242 9.

Per-course-class supplied rate, scheduled, 16 CS colleges: **computer org/systems 61.3%** (256 tests),
**data structures 68.8%** (240), engineering 70.8% (48), **discrete 75.4%** (240), **OOP/CS2 81.2%**
(240), other math 83.3%, calculus 91.8% (608), statistics 93.8%, physics 97.6%, composition 98.5%,
SDV 99.2%, intro programming 100%, non-STEM 100%. All 23 colleges: computer org 50.5, data structures
52.2, discrete 56.5, engineering 60.9, OOP 73.9, intro programming 82.6, calculus 90.7.

### 2.3 Per-college drop, catalog → scheduled (VA frozen, VERIFIED)

| college | Fig 1 units GE-incl. cat → sched | Δ | Fig 3 util cat → sched | Δ | cells with gap (sched) | missing units (sched) | scheduled share of whole catalog |
|---|---|---|---|---|---|---|---|
| Northern Virginia | 50.39 → 50.39 | 0 | 98.94 → 98.94 | 0 | 0/15 | 0 | 64.8% (722/1114) |
| Tidewater | 50.39 → 50.39 | 0 | 98.94 → 98.94 | 0 | 0/15 | 0 | 79.3% |
| J Sargeant Reynolds | 50.39 → 50.39 | 0 | 98.94 → 98.94 | 0 | 0/15 | 0 | 80.4% |
| New River | 50.39 → 50.39 | 0 | 98.94 → 98.94 | 0 | 0/15 | 0 | 24.4% |
| Germanna | 50.39 → 49.76 | −0.6 | 98.94 → 97.70 | −1.2 | 3/15 | 12 | 52.3% |
| Brightpoint | 49.92 → 49.50 | −0.4 | 98.02 → 97.17 | −0.9 | 4/15 | 17 | 43.6% |
| Virginia Peninsula | 49.50 → 49.50 | 0 | 97.17 → 97.17 | 0 | 4/15 | 17 | 46.8% |
| Virginia Western | 49.90 → 48.49 | −1.4 | 97.96 → 95.20 | −2.8 | 9/15 | 35 | 19.8% |
| Laurel Ridge | 50.39 → 47.24 | −3.2 | 98.94 → 92.66 | −6.3 | 11/15 | 59 | 31.9% |
| Blue Ridge | 50.39 → 46.85 | −3.5 | 98.94 → 91.88 | −7.1 | 15/15 (CSC 223 only) | 66 | 44.3% |
| Piedmont Virginia | 50.39 → 46.37 | −4.0 | 98.94 → 90.93 | −8.0 | 12/15 | 75 | 31.7% |
| Wytheville | 50.39 → 41.15 | −9.2 | 98.94 → 80.55 | −18.4 | 15/15 | 172 | 28.2% |
| Virginia Highlands | 50.39 → 39.32 | −11.1 | 98.94 → 76.89 | −22.1 | 15/15 | 207 | 17.3% |
| Central Virginia | 50.39 → 38.28 | −12.1 | 98.94 → 74.89 | −24.1 | 15/15 | 225 | 19.8% |
| Paul D. Camp | 49.49 → 38.26 | −11.2 | 97.15 → 74.82 | −22.3 | 15/15 | 226 | 14.3% |
| Southwest Virginia | 49.43 → 33.95 | −15.5 | 97.04 → 66.26 | −30.8 | 15/15 | 306 | 14.1% |

Course-estimate lens (GE excluded) scheduled: Southwest 26.8, Central Virginia 30.6, Camp 31.0,
Highlands 31.8, Wytheville 33.1 versus 42.5 at the four clean colleges.

Count of colleges affected in scheduled mode: **12 of 16** lose something; **5** (Southwest, Central
Virginia, Camp, Highlands, Wytheville) lose in every cell and account for 1,136 of the 1,417 missing
units (80%); the four clean colleges are Reynolds, NOVA, Tidewater, New River.

### 2.4 Are the affected colleges small / rural?

The repo holds **no** IPEDS or headcount data for Virginia (`analysis/data/ipeds_ccc.v1.json` is
CA-only; `va_institutions` carries only course/receives counts). Two repo-internal proxies and one
CONTEXT statement:

- Proxy 1, scheduled share of the whole catalog (`.va-courses/index.json`, VERIFIED): the three clean
  large colleges schedule 65–80% of their catalog; the five collapsing colleges schedule 14–28%. New River
  (24.4%) is the exception — small catalog share, yet all 9 core codes run.
- Proxy 2, geography (CONTEXT, from the college names): Southwest Virginia (Richlands), Virginia
  Highlands (Abingdon) and Wytheville are the three far-south-west Appalachian colleges; Paul D. Camp
  (Franklin/Suffolk) and Central Virginia (Lynchburg) are small rural-serving colleges. The clean four
  are the Northern Virginia, Hampton Roads and Richmond metro colleges plus New River (Dublin, near
  Virginia Tech).
- CONTEXT (general knowledge, NOT verified in the repo; needs IPEDS confirmation): NOVA (~50k
  headcount), Tidewater (~20k) and Reynolds (~10k) are the three largest VCCS colleges; Southwest,
  Highlands, Wytheville and Camp are each in the ~1.5–3k range. The correlation with the drop is
  visually obvious but I have not computed it on real enrolment numbers.

**Verdict for (2):** Virginia's supply failure is concentrated in exactly the course classes that fail
to articulate in CA and MA — computer organisation/systems, data structures, discrete, CS2 — and in the
smallest, most rural colleges. Calculus I, CS1, composition and science essentially never fail.

---

## 3. Three-state table: most-failing named course class and the failure mechanism

Rates below are the share of (requirement × college) tests that succeed, restricted to lower-division
named computing/maths requirements. They are like-for-like in spirit (a named receiving requirement
tested at every sending college) but not in construction: CA rate = strict-engine articulation rate across
~115 CCCs per receiving requirement (`ingredients.requirements`, n = number of receiving requirements in
the class); MA rate = per heatmap column across the 15 CCs (binary named-course equivalence, older-repo
workbook); VA rate = guide row supplied at the college in the stated supply basis (this analysis,
`va_class.py`).

| class | CA (9 UC CS programs, stated basis) median per requirement | CA blocking instances (fate C = not taught) | MA lower-division columns, mean rate | MA A2B-mapped pairs vs not | VA catalog | VA scheduled (16 CS) | VA scheduled (all 23) |
|---|---|---|---|---|---|---|---|
| computer organisation / systems | **27.8%** (n=7) | 421 (23% C) | **40.0%** (n=10) | 77.6 vs 21.8 | 97.7% | **61.3%** | 50.5% |
| data structures | 57.4% (5) | 183 (33% C) | 40.8% (8) | **100 vs 28.3** | 100% | **68.8%** | 52.2% |
| discrete maths | 65.7% (8) | 321 (24% C) | 41.7% (12) | 78.8 vs 33.3 | 96.7% | 75.4% | 56.5% |
| intro programming II / OOP (CS2) | 73.0% (3) | 103 (32% C) | 52.0% (10) | **100 vs 32.1** | 100% | 81.2% | 73.9% |
| intro programming (CS1) | 73.9% (7) | 183 (4% C) | 40.5% (13) | 59.3 vs 33.3 | 100% | 100% | 82.6% |
| software engineering / construction | **1.7%** (4; UCLA/UCSD/UCI lab courses) | 296 (40% C) | 25.3% "other computing" (24) | 21.7 vs 25.5 | (not named by VA guides) | — | — |
| calculus (reference) | 99.1% (23) | 35 (0% C) | 93.3% (18) | 97.7 vs 91.3 | 100% | 91.8% | 90.7% |
| science (reference) | 97–99% | 8 | 100% (24) | 100 vs 100 | 100% | 100% | 95.7% |

Most-failing named class and the mechanism per state:

| state | most-failing class | failure mechanism | evidence |
|---|---|---|---|
| CA | computer organisation (median 27.8%; 421 instances), with the campus-specific software-construction labs at ~0–3% | **Not articulated**: 1,243 of 1,761 blocking instances (71%, fate A) have a same-class course articulated elsewhere; 468 (27%, fate C) are not taught at the college; 50 (3%, fate B) taught but unarticulated | `course_repairs.v2.json` fates.counts; blockers: UCLA "Software Construction Laboratory" blocks 115 cells, UCSD "Systems Programming and Software Tools" 114, UCSD "Mathematics for Algorithms and Systems" 113 |
| MA | computer organisation / data structures / discrete (40–42% of LD columns), CS2 52% | **Not in an A2B map**: where a MassTransfer A2B pathway exists (38 pairs) data structures and CS2 articulate 100% and computer org 78%; where none exists (127 pairs) 22–33%. Lower-division overall: 82.3% (A2B) vs 53.7% (non-A2B); computing-prefix LD cells 74.8% vs 26.2% | `raw/heatmap.json` MT column (never imported into the site) |
| VA | computer organisation / systems (61% scheduled), data structures (69%), discrete (75%) | **Listed but not scheduled**: articulated by every guide at every college (catalog ≥ 96.7% per class); the gap is that 5 small colleges run ≤ 4 of the 9 core VCCS codes in the captured term | section 2 |

Reading across: the **ranking of failing classes is invariant** across the three states (computer org ≥
data structures ≥ discrete ≥ CS2 ≫ CS1 ≈ calculus ≈ science). What moves is the **layer** at which the
same courses fail — the agreement layer in CA, the pathway-map layer in MA, the course-offering layer in
VA. Virginia is the MA "A2B world" universalised: every one of its 15 universities publishes a guide that
applies to every college, and MA's A2B-mapped pairs already show what that does to computing articulation
(100% for data structures and CS2).

---

## 4. The university-side spread in VA (course estimate 37.5 – 49.7) and what drives it

VA frozen, catalog, per-guide course-estimate ceiling (`va_ceiling_courses_pct`) and the realised mean:

| guide | course est. (mean of 16) | ceiling | units ceiling | GE "assumed" units | stated pre | stated total | university-only units |
|---|---|---|---|---|---|---|---|
| RMC BS | 37.5 | 37.5 | 50.0 | **20** | 60 | 120 | 62 |
| Longwood BA or BS | 39.5 | 39.5 | 50.8 | 12 | 62 | 122 | 43 |
| W&M BA | 39.5 | 39.5 | 51.2 | 12 | 63 | 123 | 40 |
| UMW BS | 40.2 | 40.6 | 50.8 | **21** | 62 | 122 | 37 |
| VT BS | 39.7 | 41.0 | 50.4 | 12 | 65 | 129 | 64 |
| Radford BS (Network) | 41.2 | 41.2 | 50.0 | 14 | 60 | 120 | 60 |
| VCU BA | 40.8 | 41.2 | 50.8 | 16 | 62 | 122 | 67 |
| NSU BS | 42.1 | 42.1 | 49.6 | 15 | 62 | 125 | 93 |
| UVA BS | 41.3 | 42.1 | 49.3 | 12 | 66 | 134 | 68 |
| UVA Wise BS | 42.5 | 42.9 | 50.8 | 12 | 62 | 122 | 60 |
| Bridgewater BS | 43.2 | 43.2 | 50.0 | 12 | 62 | 124 | 49 |
| CNU BS | 43.6 | 44.1 | 50.0 | 12 | 60 | 120 | 46 |
| ODU BS | 44.4 | 44.4 | 52.1 | 12 | 63 | 121 | 61 |
| UL BS | 48.6 | 48.6 | 50.8 | **6** | 62 | 122 | 49 |
| George Mason BS | 49.7 | 50.0 | 49.2 | **0** | 63 | 128 | 64 |

Drivers (VERIFIED, `rebuild.js`, 15 guides):
- r(course ceiling, GE-assumed units) = **−0.833**; r with GE share of pre-transfer = −0.825. The course
  lens removes the `assumed` bucket from both halves, so a guide that writes "Any UCGS Literature" instead
  of naming ENG 24x loses that slot from the numerator while the university half is unchanged. GMU names
  every GE course (20 named rows of 20) and reads 50; RMC/UMW leave 20–21 units open and read 37.5–40.6.
  That is ~70% of the variance and it is a **documentation-style artefact**, not a curricular difference.
- r with university-only units = 0.075; with stated total = 0.187; with average course size = 0.053 —
  the post-transfer half and the credit-to-course conversion barely matter, because every post half is
  held to its stated credit.
- Units-lens ceiling: r = 1.000 with statedPre/statedTotal (49.2–52.1). No degrees of freedom at all.
- **BA vs BS**: no effect. W&M BA and BS have byte-identical CC halves (12 named rows each, both 39.5).
  VCU BA (11 named rows, ge 16) reads 40.8; the four VCU BS guides (13 named rows: add CSC 208, CSC 205,
  MTH 264; ge 9) all read 44.1. Longwood publishes one "BA or BS" guide.
- **Concentration**: Radford's Database/Network/Software Engineering guides are identical (41.2, ge 14);
  Advanced Computer Science names two more courses (ge 9) and reads 44.4. VCU's four BS guides are
  identical.
- **Selection rule matters at the margin**: `oneProgramPerUniversity` keeps the shortest title, ties to
  the first in file order — which is why VCU and W&M are represented by their **BA** guides and Radford by
  the Network concentration. A prefer-BS rule moves the state mean 42.26 → 42.69 (VCU 40.8 → 44.1, Radford
  41.2 → 44.4); scoring all 23 computing guides gives 42.46 over 368 cells. The 37.5–49.7 spread is
  therefore mostly *how much of the 60 credits is written as named courses versus open UCGS categories*,
  and secondarily which of a university's guides was picked.

Fig 3 per-university spread (catalog): 100.0 at Bridgewater, NSU, ODU, Radford, W&M (no refused rows, no
supply gaps in their named rows); 95.7 at UVA = 2 refused SDV units of 66 plus EGR gaps at Camp; UMW 96.2,
RMC 96.7, Longwood/UL 96.8 (each refuses a 2-unit SDV row). Scheduled: UVA 83.9, Bridgewater 84.9, VT 85.2
(the guides naming CSC 215 / MTH 265 / EGR — the least-scheduled codes) up to Radford 94.4.

---

## 5. What the canonical (derived-agreement) VA path measured differently, and which the paper should use

### 5.1 State of the canonical path today (VERIFIED live, 2026-09-07)

- `coverageData(majorSlug:'va-cs', requirements:'degree')`: 256 rows (16 universities × 16 sending
  colleges); **128 computed** at 8 universities, **128 excluded** `virginia_source_not_publication_ready`
  (Bridgewater, Radford, RMC, Shenandoah, UVA Wise, VT, VSU, W&M). Computed mean
  `pct_named_requirement_courses` **23.92%** (GE-excluded, course counts), `_with_ge` **46.58%**.
  Per university: JMU 31.3, ODU 29.6, CNU 25.9, GMU 24.1, NSU 24.1, VCU 21.9, Longwood 20.0, UMW 14.4.
  Per college over the 128 computed cells: **24.16 at 13 of 16 colleges**, Camp 23.20, Southwest and
  Western 22.72 — the same "college axis carries nothing" property as the guide-first figure.
- `transferCreditRateData(va-cs, local_as)`: **0 of 304** computed (verified or not). Exclusion reasons:
  invalid source-equivalency receipt (90), associate source not publication-ready (64 + 32 + 32 + 16),
  bachelor source not publication-ready (30 + 20 + 10 + 10).
- `figure-baseline.json` pins `va-cs|figure1` at 384 rows / null and `va-cs|local_as` at 304 rows /
  computed 0. `docs/virginia-degree-collection.md`: only 8 of 37 selected documents pass every executable
  rule; figures are fail-closed until a publication receipt matches.

### 5.2 The August vintages (INFERRED from memory files; not reproducible today)

2026-08-15: Fig 1 **35.5%** over **384 cells** (16 universities × 24 colleges, including 8 with no CS
associate), Fig 3 **24.1%** over 124 cells, Fig 4 45.7 excess units. 2026-08-21: unit-pool normalisation
took Fig 3 from 124 to 252 computed cells of 304. A denominator fix on 08-15 (dropping the 460 of 679
named requirements flagged `cc_articulable:false`) had earlier moved Fig 1 from 14.6% to 35.5%; the
null-prefix-as-wildcard fix moved it 40.1% → 24.9% before that. Restricting the sending cohort to the 16
CS colleges moved the pooled mean 30.7% → 46.3% at one point (majors.js comment).

### 5.3 What is measured differently

| dimension | canonical derived path | guide-first frozen figures |
|---|---|---|
| requirement object | catalog-composed university degree (major + GE/college + graduation layers, UD included, `cc_articulable:false` sections dropped) | the university's own published Transfer Guide (pre-transfer half in VCCS numbering + post-transfer half) |
| articulation object | Transfer Virginia course-equivalency edges (4,668; keyed by VCCS course) joined by us into 384 "derived agreements" | the guide itself — the university has already done the join |
| elective landings | **never satisfy a named requirement** (wildcard rule: `SOCY2XX`, `ENGH----`, `TRNFREE`… = 26.5% of edges) | **count as covered** ("HSS Elective (2 of 5)" is a defined slot) |
| GE | `ge_area` receivers on breadth sections excluded from the named population; GE-on lens assumes the block | `assumed` bucket (12.5 u/guide) credited everywhere; excluded symmetrically in the "paper"/course lens |
| unit of count | course counts (MA lens); units nulled (`unitCoverage:false`) | units (stated halves) and a credit-derived course estimate |
| sending cohort | 24 → 16 colleges via `sendingCollegeIds` | 16 CS colleges (or all 23) |
| supply | catalog presence only; no scheduled variant | catalog **and** scheduled variants |
| status | fail-closed; 8/16 universities, 0/304 Fig 3 cells | committed, method_status `estimated` on all cells |

The two paths agree on one thing that matters — the college axis is flat — and disagree on the level
(24–36% vs 42–50%) for reasons that are conventions, not facts: (i) the wildcard rule refuses elective
landings that the guide counts; (ii) catalog-composed degrees carry requirements the guide never asks a
transfer student to bring; (iii) course counts vs units. Neither is "the" MA measure: MA's Fig 1 joins a
course-equivalency database and A2B maps to named BS requirements — closer in form to the canonical path,
but MA's A2B pairs (56.9% all-level, 82.3% lower-division) are the analogue of VA's guides.

### 5.4 Recommendation

Use the **guide-first** figures. They are Virginia's own published pathway object (the counterpart of an
ASSIST agreement or an A2B map), they are reproducible from committed sources, and the canonical path is
not publishable today and — even when it produced numbers — measured whether course-level edges satisfy a
catalog-composed degree under a wildcard convention that structurally penalises Virginia's data format.
Three conditions on using them:

1. Report the **GE-excluded course-estimate lens** (42.3% catalog / 37.8% scheduled) as the MA-comparable
   number, **always beside its ceiling** (42.5%), and the unit lens (50.2 / 45.6, ceiling 50.4) as the
   Virginia-native statement.
2. Lead with the **scheduled** variant as the finding and the catalog variant as the ceiling; say in the
   text that "scheduled" is a single-term snapshot (lower bound) and catalog an upper bound.
3. Keep the canonical number, if it ever un-gates, as an appendix robustness line with the wildcard
   caveat — never as the headline, because its level is a data-format artefact.

---

## 6. Verdict on "VA is best"

**True in this sense (VERIFIED):** at the articulation layer Virginia has solved the problem the other two
states have not. Every one of the 15 universities publishes one guide, in VCCS common numbering, that is
valid at every college; catalog supply of what those guides name is 96.7–100% per course class; only 18 of
240 cells miss anything and only 11 requirement strings ever go missing. Lower-division supply is 99.5% of
stated pre-transfer credit (catalog) against MA lower-division articulation of 59.8% overall (82.3% in
A2B pairs, 53.7% outside them) and CA lower-division computing articulation of 45.7% (brief). The
computing courses that articulate at 22–42% in MA and 28–57% in CA are simply named and accepted in VA.

**An artefact of measurement in this sense (VERIFIED + INFERRED):** the VA Figure 1 in catalog mode is
its own ceiling minus 0.47%, and Figure 3 is 100% minus a 1.1% SDV-refusal constant, **by construction**
— the guide is both the requirement and the pathway, so the only quantity the two figures can vary on is
whether a college's catalog contains a course code. That measure cannot see unevaluated university
conditions, credits GE by assumption, counts elective landings as covered, and treats a course that is
listed but never run as supplied. The 37.5–49.7 university spread in the course lens is 70% explained by
how many GE credits a guide leaves as open categories, and a tie-break in the selection rule picks BA
guides at VCU and W&M.

**The substantive finding is the scheduled view:** Virginia moved the bottleneck from the agreement layer
to the course-offering layer without removing it. In the captured term, computer organisation/systems is
available in 61% of guide-row × college tests, data structures 69%, discrete 75%, CS2 81% — the same
classes, in the same order, that fail to articulate in CA and MA — and the failure sits at five small
rural colleges (Southwest, Central Virginia, Camp, Highlands, Wytheville: 2–4 of 9 core codes scheduled,
Fig 1 34–41, Fig 3 66–81) while the three metro colleges plus New River run all nine. Statewide the
scheduled course-lens figure (37.8%) sits **below** the MA final-PDF Fig 1 (38.2%, 165 pairs), and the
honest lower-division comparison is that VA's CS-college mean supply drops from 99.5% to 90.5% of stated
credit and to 66–75% of credit at its five weakest colleges.

---

## 7. Comparability caveats to state in the paper

- VA course estimate = credits ÷ per-guide average single-course size (3.02–3.31), rounded, held to the
  stated halves; MA = binary named-course counts; CA = named-course counts from articulated templates.
  All three keep upper division in the denominator; VA includes the university half via `post_items`.
- VA GE: `assumed` bucket, not a course-level taxonomy; enumerated GE courses (GMU) stay in the named
  population.
- VA "scheduled" = `notScheduled` flag on courses.vccs.edu at 2026-08-31, no term recorded.
- VA `method_status: estimated` on all 240 cells (credit ranges at upper bound; unresolved cardinalities).
- MA A2B split uses the MT column of the older-repo heatmap workbook (final-PDF Fig 1 matches 164/165).
- CA rates are from the strict eligibility engine on the stated-preparation basis; instance counts inflate
  with choose-one-of-N alternatives.
- No VA tuition → no Fig 5; VA Fig 6 blank (two catalogued kill switches).
