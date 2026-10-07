# verify-4-measurement-comparability — claim F5 (Fig 1 dispersion: "MA institutional, not geographic")

Reviewer stance: adversarial, MEASUREMENT grounds only. Read-only on the repo. Working script and output:
`disp.py` / `disp_out.txt` beside this file. The named originating directory
"dossier-coverage-heatmap (…)" does not exist; the claim's evidence is `scratchpad/dossier-fig1/`
(`ma_out.txt`, `dist_out.txt`, `va_out.txt` and `ma.py`, `dist.py`, `va.py`; no `report.md` there).
I re-derived every number from the underlying artefacts rather than from those outputs.

## The claim

"Massachusetts's dispersion is institutional, not geographic: per-university SD 17.1 (Framingham 11.7 →
Fitchburg 70.1) against per-college SD 5.3 (27.7–47.2), whereas CA cs is 7.9/5.7 and VA catalog 0.9–3.2/0.4."

## Verdict: REFUTED AS STATED (materially misleading), core direction survives

The six numbers reproduce to the decimal. The MA-internal statement (university axis dominates the college
axis) is correct and robust. But the sentence presents six standard deviations as one comparable quantity
across three states, and on measurement grounds they are not: the VA per-university figure is the SD of the
guides' pre-transfer *size*, not of articulation; the MA per-university figure is inflated by a convention
(upper-division electives counted as articulated) that the CA engine forbids by construction; the MA > CA
contrast is statistically marginal at n = 11 vs 9 once that is corrected; the VA per-college "0.4" is a
catalog-supply artefact that becomes MA-equal (5.1–5.3) under scheduled supply; and "geographic" is an
interpretive label for what is actually a sending-college axis. A methods reviewer would ask for the
sentence to be rewritten, not deleted.

## 1. Reproduction (VERIFIED, our computation, population SD as in the dossier's `pstdev`)

| corpus | vintage / artefact | lens | per-university pSD (n) | per-college pSD (n) | claimed |
|---|---|---|---|---|---|
| MA cs, 11 univ × 15 CC = 165 cells | `server/data/ma/raw/heatmap.json` (workbook conversion; 164/165 cells = final PDF; DB-served copy differs only at Dartmouth×Cape Cod: 37.0 vs 36.4 university mean) | GE excluded, course counts, upper-division kept in denominator AND counted when marked | **17.1** (11), range 11.7 Framingham → 70.1 Fitchburg | **5.3** (15), range 27.7 Mt Wachusett → 47.2 Quinsigamond | 17.1 / 5.3 ✔ |
| CA cs, 9 UC × 115 CCC = 1035 cells | live DB pull 2026-09-07 (`dossier-fig1/coverage_cs.json`), degree lens, all templates `hand_verified` (Fig 1 has no AS layer, so the verified-cohort toggle is moot) | `pct_named_requirement_courses`: GE excluded, Or-collapsed slot counts, upper-division never articulable | **7.9** (9), 21.0 UCI/UCSD → 45.9 Merced | **5.7** (115), 1.6 Palo Verde → 40.2 | 7.9 / 5.7 ✔ |
| VA cs catalog, 15 guides × 16 CS colleges = 240 cells | frozen `frontend/src/analyses/vaCoverageRows.js` (built 2026-09-06 from guides captured 2026-08-31), all cells `method_status: estimated` | `pct_named_requirement_courses` = GE-excluded course ESTIMATE (units ÷ mean course size, rounded) | **3.2** (15) | **0.4** (16) | 3.2 / 0.4 ✔ |
| VA cs catalog, same | same | `pct_named_requirement_courses_with_ge` = units, GE included (assumed bucket credited 100%) | **0.9** (15) | **0.4** (16) | 0.9 / 0.4 ✔ |

Sample SDs (n−1) would read 18.0/5.5, 8.4/5.7, 3.3/0.4, 0.9/0.4 — same story; the claim should say which it uses.

## 2. Measurement attacks

### 2.1 VA's per-university SD is the SD of the guide ceiling, not of articulation (VERIFIED)
In the catalog paper lens, per-university coverage and per-university ceiling (`va_ceiling_courses_pct`,
= stated pre-transfer half ÷ stated degree total) are numerically the same list: Bridgewater 43.2 = 43.2, RMC
37.5 = 37.5, Longwood 39.5 = 39.5. SD of the per-university ceiling = 3.19; SD of the per-university
(ceiling − coverage) gap = 0.37; correlation between the two = 0.994. Units-no-GE: ceiling SD 2.41, gap SD 0.35,
r = 0.990. Units-GE-incl: ceiling SD 0.74, gap SD 0.32, r = 0.935.

So "VA 0.9–3.2" is the dispersion of *how much of the BS each university's guide assigns to the community
college* (57–68 of 120–134 credits), which is a policy/design quantity. The dispersion of what the claim is
actually about — how much of the assigned block a college fails to supply — is ≈ 0.35 on both axes. In MA and
CA the per-university SD mixes ceiling dispersion (MA ceiling pSD 9.8, CA 10.1) with articulation dispersion.
The three "per-university SDs" are therefore not the same construct. This does not rescue the claim's
direction (VA is even flatter than stated), but the VA number as printed measures something else.

### 2.2 MA's per-university SD counts upper-division articulations that CA forbids by construction (VERIFIED)
The paper matrix marks upper-division columns as articulated (Fitchburg "Upper Level Elective (3000)" ×5 at
15/13/8/8/6 colleges, "Algorithms and Data Structures CSC 3700" 15/15, Worcester "MA 150 OR MA 302" 14/15,
Salem "Math Elective (post calc II)" 13/15); 21 cells exceed their own lower-division ceiling and Fitchburg's
university mean is 134% of its ceiling. The CA engine (`degreeSlots.resolveSectionTier`) never evaluates
upper-division sections, so 0 of 1035 CA cells have any upper-division coverage. Like-for-like requires
zeroing MA's upper-division articulations:

| MA variant | per-university pSD | per-college pSD | univ / college variance share |
|---|---|---|---|
| claimed (paper convention) | 17.1 | 5.3 | 76.3% / 7.4% |
| hard ceiling (upper-division → 0, CA convention) | **14.2** | 4.2 | 77.4% / 6.8% |
| capped at ceiling | 14.5 | 4.7 | 73.4% / 7.5% |
| elective columns dropped from denominator | 15.1 | 6.6 | 63.0% / 12.0% |
| lower-division-only | 20.9 | 7.6 | 69.8% / 9.2% |
| ceiling-normalised | 28.4 | 9.6 | 73.1% / 8.4% |

MA's dominance of the university axis survives every variant (so the MA-internal claim is robust), but the
headline 17.1 is ~3 points of convention. Fitchburg (70.1) is the top of the claimed range precisely because
of the elective-column convention; under the hard ceiling Fitchburg drops to 48.4 and the top is Lowell 61.5.

Denominators also differ in construction: MA columns include prerequisites and duplicates (MCLA "Programming
in Java II" twice; template unit sums exceed the resident 120 — Dartmouth 172, Bridgewater 151), while CA
counts Or-collapsed template slots. Same nominal lens, different counting rules.

### 2.3 The MA > CA per-university contrast is statistically marginal at n = 11 vs 9 (VERIFIED)
F-test on sample variances: F = 4.56, df (10, 8), p ≈ 0.02. Bootstrap (resampling universities) of the
per-university SD ratio MA/CA: median 2.18, 95% CI [1.21, 4.11] under the claimed convention; under the
like-for-like hard-ceiling convention median 1.82, 95% CI **[1.01, 3.45]**. Dropping Fitchburg alone takes MA
to 14.5; dropping Fitchburg and Framingham to 12.9. Eleven universities are too few to state "17.1 vs 7.9"
as a settled difference; the honest statement is "roughly 1.5–2× as dispersed, with a CI touching 1".

### 2.4 The per-college SDs are computed over 15 vs 115 vs 16 institutions (VERIFIED)
CA's 5.7 is inflated by two colleges with no real CS articulation (Palo Verde 1.6%, Lassen 9.5%); without them
4.5. Random 15-college subsets of CA give a per-college pSD median 4.6, 5–95% [2.9, 8.9], which brackets MA's
5.3. So the sending-college axis is *equally* dispersed in MA and CA — a fact the claim's framing ("whereas")
obscures: on the college axis there is no MA-vs-CA difference to report.

### 2.5 VA's per-college 0.4 is a supply-basis artefact (VERIFIED)
Catalog supply is the correct like-for-like basis for MA (MassTransfer equivalency database + websites) and CA
(ASSIST), neither of which checks scheduling, so the choice is defensible. But the claim's contrast "VA … 0.4"
is entirely undone when supply is read from schedules: per-college pSD 5.1 (paper lens), 5.9 (units no GE),
5.3 (units GE incl) — identical to MA's 5.3 — and the variance decomposition flips to college-dominated
(paper lens: university 27.5% / college 62.2%). VA's per-university SD, meanwhile, barely moves (3.2 → 3.4)
because it is the ceiling SD (2.1 above). Any use of this sentence must carry the supply basis as a
first-class qualifier, not a footnote.

### 2.6 "Geographic" is an interpretive label, not a measured quantity (INFERRED)
The per-college axis is the sending institution. No spatial variable was tested. MA's two low colleges are
Mount Wachusett (27.7, central MA) and Roxbury (28.1, urban Boston); the two ≥ 43 colleges include Middlesex
(suburban Boston) and Quinsigamond (Worcester). Nothing in the data distinguishes "college effect" from
"location effect". The defensible wording is "receiving-university effect, not sending-college effect".

### 2.7 Corpus asymmetry on the university axis (INFERRED from corpus definitions)
CA's 9 universities are one system (UC) sharing ASSIST, IGETC/Cal-GETC, C-ID and the 70-unit cap; CSU is
absent. MA's 11 span UMass (4) and the state universities (7), with A2B pathways at only 4 of 11 (38 of 165
pairs, mean 56.9 vs 32.7 non-A2B, orchestrator scouting). VA's 15 span every public four-year. A per-university
SD is a between-system statistic in MA and VA and a within-system statistic in CA. "CA is less institutional"
may partly be "CA's sample is one institution-system".

### 2.8 Vintage / lens hygiene (VERIFIED)
- MA: the 11.7 → 70.1 range is the raw workbook vintage; the DB-served ma-cs figure gives Dartmouth 36.4 not 37.0. Immaterial here but should be named.
- The VA "0.9–3.2" range spans two lenses (units GE-included vs course-estimate GE-excluded). Only 3.2/0.4 is nominally comparable to MA/CA (GE excluded, counts); and the VA counts are estimates (`Math.round(units/rate)`) with `method_status: estimated` on all 240 cells.
- GE-included comparators, for completeness: CA cs 5.2/4.3; MA 10.7/3.0; VA catalog 0.9/0.4.

## 3. What survives (VERIFIED)

Two-way additive variance decomposition of cell coverage (independent of the 15-vs-115 axis asymmetry):

| corpus / lens | university share | college share | residual |
|---|---|---|---|
| MA cs, claimed lens | 76.3% | 7.4% | 16.3% |
| MA cs, hard ceiling | 77.4% | 6.8% | 15.8% |
| CA cs, claimed lens | 57.1% | 29.6% | 13.4% |
| CA cs, lower-division-only | 42.7% | 39.4% | 17.9% |
| VA catalog, paper lens | 92.4% (= ceiling) | 1.6% | 6.0% |
| VA scheduled, paper lens | 27.5% | 62.2% | 10.3% |

MA is university-dominated under every convention; CA is university-leaning but with a real college
component; VA's university share is guide size, and its college share depends on the supply basis.

## 4. Corrected claim

"In Massachusetts (older-repo/final-PDF heatmap, 165 cells, GE-excluded course counts) the receiving university
explains ~76% of cell-to-cell variance in named-course coverage and the sending college ~7% (per-university pSD
17.1, or 14.2 once upper-division electives are treated as non-articulable as the CA engine does; per-college pSD
5.3). California cs (9 UC campuses, 1035 cells, same lens) is less university-dominated (57% / 30%; pSD 7.9 /
5.7, 4.5 after Palo Verde and Lassen), though with 11 vs 9 universities the MA > CA per-university contrast is
only marginal (like-for-like bootstrap SD-ratio 95% CI 1.0–3.5). Virginia's catalog-supply per-university
spread (3.2, course-estimate lens) is the spread of guide pre-transfer size (ceiling SD 3.19, r = 0.994), not of
articulation; its per-college spread of 0.4 rises to 5.1–5.3, equal to Massachusetts, on scheduled supply."

## 5. Confidence

Refuted-as-stated with confidence 0.7: every number is right and the MA-internal finding is solid, but the
cross-state sentence compares three differently constructed dispersions, mislabels an axis, and overstates
the precision of an 11-vs-9 contrast.
