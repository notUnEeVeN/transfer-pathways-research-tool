# verify-7-reproduction — arithmetic check of claim F8 (Fig 1, GE-inclusive ordering MA > CA bio > VA > CA econ > CA cs)

Reviewer: verify-7-reproduction (adversarial, arithmetic grounds). Repository untouched.
Working files: `/private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/verify-7-reproduction/` (`pull.js`, `cov_*.json` = my own DB pull; `repro.py` + `repro_out.txt`; `va.py` + `va_out.txt`).

Note on provenance: the originating dossier directory (`scratchpad/dossier-fig1/`) contains scripts and outputs (`ca_mech.py`/`ca_mech_out.txt`, `va.py`/`va_out.txt`, `coverage_*.json`, ...) but NO `report.md`; the claim text as handed to me is the only statement of it. I worked from the evidence files it names plus an independent re-pull.

## The claim, decomposed

"Including GE reverses CA-vs-MA (MA 63.7 > CA bio 60.7 > VA 50.2 > CA econ 48.1 > CA cs 46.0) because MA's GE block (17.2 courses per cell, 100% covered by assumption, 37% of the GE-on denominator) is nearly twice CA's (9.0–9.7 courses, 89–94% covered) and VA's assumed bucket is only 10% of its denominator; the GE-inclusive headline measures GE block size."

## Method

1. Independent DB pull (our computation, live Atlas `pmt_research`, 2026-09-07 09:26): `coverageData(db, db, {majorSlug, requirements:'degree'})` for cs / bio / econ / ma-cs / va-cs, keeping the six named-course fields (`named_requirement_courses_{total,articulated}`, `..._with_ge_{total,articulated}`, `pct_named_requirement_courses[_with_ge]`). `coverageData` has NO `verifiedOnly` option (pathways.js:1320-1324), so the verified-cohort question does not arise for Fig 1.
2. Field-by-field comparison of my pull against the dossier's `coverage_*.json` (same 1035/1035/1035/165 keys, 0 mismatches on all six fields in every corpus) — so the dossier's inputs were what the server serves today.
3. Recomputed every number in the claim from those fields; also computed the pooled variants and per-cell distributions.
4. VA from the frozen module `frontend/src/analyses/vaCoverageRows.js` (`catalog` variant, 16 CS colleges × 15 guides = 240 rows), with the bucket semantics read from `server/scripts/va/buildVaCoverageCells.js` (`classify()` lines 200-219; `ge_units: tally.assumed` line 443).
5. Counterfactual GE-block swaps to test the mechanism ("because ... GE block size").

Corpus for every CA number: CA, majors cs/bio/econ, UC degree templates ("degree" lens), 115 CCs × 9 UCs = 1035 cells, no cohort filter (Fig 1 has none). MA: ma-cs, 15 CCs × 11 universities = 165 cells, served degree documents built from the paper's final-repo heatmap + resident-plan GE residue. VA: va-cs frozen guide join, catalog supply, 240 cells, UNIT-weighted (not course counts).

## Results — item by item

| Claim element | Claimed | Reproduced (our computation) | Verdict |
|---|---|---|---|
| MA cs GE-on mean | 63.7 | 63.690 (165 cells; pinned baseline 63.69) | VERIFIED |
| CA bio GE-on mean | 60.7 | 60.682 (1035 cells; baseline 60.682) | VERIFIED |
| VA cs GE-on (units) | 50.2 | 50.156 (240 cells, frozen catalog variant; = mean of `with_ge_articulated/with_ge_total`, 0 cells off) | VERIFIED |
| CA econ GE-on mean | 48.1 | 48.084 (1035; baseline 48.084) | VERIFIED |
| CA cs GE-on mean | 46.0 | 46.041 (1035; baseline 46.041) | VERIFIED |
| Ordering MA > bio > VA > econ > cs | — | holds; also holds pooled (64.1 > 60.8 > 50.2 > 48.1 > 46.0) | VERIFIED |
| MA GE block per cell | 17.2 courses | 17.18 mean (sd 4.57, min 8, max 25; = `with_ge_total − named_total`) | VERIFIED |
| MA GE block covered | 100% | 100.0% pooled and per cell (GE covered = GE added in all 165 cells) | VERIFIED |
| **MA GE share of GE-on denominator** | **37%** | **40.8% mean-of-cell (sd 8.5, range 20.5–53.2), 41.2% pooled** (17.18 / 41.73). Per university: Lowell 20.5 … Bridgewater 53.2. | **NOT REPRODUCED** (≈4 points off, outside rounding) |
| CA GE block per cell | 9.0–9.7 courses | bio 9.00, cs 9.44, econ 9.67 | VERIFIED |
| CA GE block covered | 89–94% | cs 89.4%, bio 93.8%, econ 94.3% (pooled; mean-of-cell 89.6/93.2/93.4) | VERIFIED |
| "nearly twice" | — | MA/CA ratios 1.82 (cs), 1.91 (bio), 1.78 (econ) | VERIFIED (fair wording) |
| VA assumed bucket share of denominator | 10% | 10.19% mean-of-cell, 10.14% pooled (`va_ge_units` ≡ `va_assumed_units` in all 240 rows; per guide 0–21 units of 120–134) | VERIFIED as stated; see caveat B |
| CA GE share of GE-on denominator (not in claim, for context) | — | cs 24.6%, bio 22.4%, econ 35.3% (mean-of-cell) | — |

### Where 37% could have come from
No formula on the served ma-cs fields yields 37%. The only near miss is dividing MA's GE block by **CA cs's** named total: 17.18 / (17.18 + 28.33) = 37.8% — i.e. a cross-corpus denominator slip. `(GE-on − GE-off)/GE-on` gives 40.0%; medians give 40.5%; means give 41.2%. The number is not in any dossier output file (`ca_mech_out.txt` prints the block size and covered share but never a denominator share for MA). Treat 37% as an error; the correct figure is ~41%.

### Mechanism test (counterfactual GE-block swaps, our computation)
Apply a donor corpus's mean GE block (size, covered share) to every cell of a recipient, keeping the recipient's own named-course coverage:

| recipient \ donor block | cs (9.44 @ 89%) | bio (9.00 @ 94%) | econ (9.67 @ 94%) | MA (17.18 @ 100%) |
|---|---|---|---|---|
| CA cs   | 46.5 | 47.0 | 48.0 | 57.8 |
| CA bio  | 60.2 | 60.8 | 61.5 | 68.6 |
| CA econ | 46.6 | 47.4 | 48.7 | 61.3 |
| MA cs   | 52.7 | 53.4 | 54.4 | 64.0 |

- MA with any CA-sized block: 52.7–54.4, i.e. BELOW CA bio (60.7). CA bio with MA's block: 68.6, ABOVE MA (63.7). So the MA-over-bio reversal is entirely attributable to GE block size + the 100% assumption. VERIFIED.
- Coverage-share effect alone is small: setting each corpus's own block to 100% covered moves cs 46.0→48.8, bio 60.7→62.2, econ 48.1→50.6 — none overtakes MA. So it is the SIZE, not the CA 89–94% vs MA 100% difference, that drives the reversal. VERIFIED.
- VA with an MA-sized block (51.6 units @100%, replacing its 12.5-unit assumed bucket): 61.9; with a CA-cs-sized block: 53.3. VA's ceiling is ~50% by construction (60 pre-transfer credits of 120–134), so its low GE-on number is dominated by the ceiling, not only by the small GE bucket.

## Caveats the claim omits (material to how it should be worded)

A. **"Reverses CA-vs-MA" is true for CA bio only.** GE-off (course counts): bio 51.2 > MA 38.2 > cs 31.9 > econ 23.7. MA already led cs and econ without GE; GE only WIDENS those gaps (by ~12 and ~15 points) while it FLIPS bio. GE-on also flips the within-CA econ/cs order (econ 48.1 > cs 46.0 vs 23.7 < 31.9 GE-off), because econ's GE share (35%) is the largest in CA — the claim does not mention this, though its listed ordering is right. INFERRED from the verified numbers.

B. **VA's "assumed bucket" is not VA's GE block, so "10%" undercounts VA's GE in the MA/CA sense.** `classify()` puts a row in `assumed` only when it names no course or is a `gened_category`; enumerated GE courses (ENG 111, ENG 112/113, HIS, PHI, CST, HLT/PED, SDV …) are `supplied` when the college teaches them. Over the 15 CS guides: assumed = 191 credits, named non-STEM GE-like (by course-prefix, INFERRED classification) = 163 credits, named science = 100, other named = 487. Assumed+GE-like ≈ 354 credits ≈ 19% of the pooled denominator (1854 units), roughly double the 10% the claim quotes — still well below MA's 41% and CA's 22–35%, so the direction of the argument survives, but the VA number is not like-for-like with the MA/CA GE blocks.

C. **Units vs courses.** MA and CA figures are course COUNTS; VA is UNIT-weighted. The 17.2-course MA block vs 12.5-unit VA bucket comparison in the claim mixes units. Converting the VA assumed bucket at VA's own ~3.1 units/course gives ~4 courses of ~40 — the 10% share is the same either way, so the comparison of SHARES is fine; the comparison of block SIZES in the same sentence is not.

D. **Unstated but relevant**: the MA GE block is the resident-plan residue (8–25 rows per university, mostly "ELEC xxx" placeholders — brief), assumed 100% articulable, never assessed per CC by the paper's authors; the final PDF's Fig 1 is GE-excluded. So "MA 63.7" is OUR construction (served ma-cs, our computation), not a paper vintage.

## Verdict

The five headline means, the cell counts (1035/1035/1035/165/240), the MA and CA GE block sizes and coverage shares, the VA assumed-bucket share, and the mechanism (counterfactual swaps) all reproduce exactly from the served data. Two elements do not survive: the MA GE share is ~41% of the GE-on denominator, not 37% (no formula on the named files gives 37%; 37.8% only appears if MA's block is divided by CA cs's named total), and "reverses CA-vs-MA" is true only against CA bio (MA already led cs and econ GE-off). VA's 10% is the assumed bucket, not VA's GE; counting enumerated GE-like courses VA's GE-like share is ~19%.

Per the reviewing standard (refute if not reproducible within rounding), the claim AS STATED is refuted on the 37% figure and the over-general "reverses CA-vs-MA"; the corrected version below is supported.

**Corrected claim:** "With the GE-on lens (our computation, served degree lens, course counts for CA/MA, units for VA), MA cs 63.7 (165 cells) > CA bio 60.7 (1035) > VA cs 50.2 (240, catalog supply) > CA econ 48.1 (1035) > CA cs 46.0 (1035). GE flips MA above CA bio (GE-off: bio 51.2 > MA 38.2) and econ above cs, and widens MA's existing lead over cs/econ, because MA's GE block is 17.2 courses per cell, 100% covered by assumption and ~41% of the GE-on denominator (20–53% by university), versus CA's 9.0–9.7 courses at 89–94% covered (22–35% of the denominator); giving MA a CA-sized block drops it to 52.7–54.4, giving CA bio MA's block lifts it to 68.6. VA's assumed bucket is 10.2% of its unit denominator, but VA's GE-like content is nearer 19% once enumerated GE courses (ENG 111/112 etc., filed as 'supplied') are counted, and VA's GE-on figure is bounded near 50% by its 60-credit pre-transfer ceiling. The GE-inclusive headline is therefore dominated by GE block size and the 100%-articulable assumption, and should not be read as a cross-state articulation measure."
