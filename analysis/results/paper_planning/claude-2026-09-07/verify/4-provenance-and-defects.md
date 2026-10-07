# verify-4-provenance-and-defects — claim F5 (Fig 1, MA dispersion "institutional, not geographic")

Claim under review: "Massachusetts's dispersion is institutional, not geographic: per-university SD 17.1
(Framingham 11.7 → Fitchburg 70.1) against per-college SD 5.3 (27.7–47.2), whereas CA cs is 7.9/5.7 and
VA catalog 0.9–3.2/0.4."

Reviewer stance: adversarial, PROVENANCE only (vintage, live defects, cohort, VA `estimated` rows, uncommitted
working tree, survival under the concurrent Codex audit). Repository untouched. Scratch: this directory
(`sd.py`, `sd_out.txt`). Builds on `verify/0-provenance-and-defects.md` (same figure, same dossier pull) — I
re-used its three VA module vintages and its sha-match finding rather than re-deriving them.

## Verdict in one line

Every number reproduces (VERIFIED). The MA half of the claim is vintage-proof. The VA half is materially
misleading as stated: "0.9" is a different lens (GE-included units) from the MA/CA numbers (GE-excluded course
counts); the like-for-like VA per-university SD is 3.2 on the UNCOMMITTED working-tree module and 3.7 at HEAD;
and the VA per-college SD 0.4 holds only for the catalog-supply × 16-CS-college view where 222 of 240 cells
sit at their structural ceiling — under the same module's scheduled supply VA's per-college SD is 5.1–5.9,
i.e. equal to or above MA's 5.3 and CA's 5.7, and VA's dispersion becomes college-side, the opposite of the
contrast the sentence draws.

## 1. Where the evidence is

- The task's path `dossier-coverage-heatmap (...)/report.md` does not exist. Evidence is
  `scratchpad/dossier-fig1/{ma.py, ma_out.txt, dist.py, dist_out.txt, va.py, va_out.txt}`; no report.md there.
- `ma.py` reads `server/data/ma/raw/heatmap.json` (working tree; last changed d679f0f = final-repo
  `Four Year Heatmap.xlsx` vintage). `dist.py` reads the 08:36 live-DB `coverageData` pull (working-tree server
  code). `va.py` reads `frontend/src/analyses/vaCoverageRows.js` from the WORKING TREE (uncommitted regenerate,
  `built_at` 2026-09-06T23:20Z = local 2026-09-07 08:20; HEAD's file is `built_at` 2026-09-04T00:39Z, commit 131cf2b).
- All SDs are population SDs (`statistics.pstdev`). Sample SDs would read 17.9 / 5.5 (MA), 8.4 / 5.7 (CA),
  0.9–3.3 / 0.4 (VA WT). The claim never says which; n=11/9/15 makes the difference visible (17.1 vs 17.9).

## 2. Number-by-number: vintage, corpus, status

| number | artefact vintage | corpus | status |
|---|---|---|---|
| MA per-university pSD 17.1, min 11.7 (Framingham) max 70.1 (Fitchburg) | final REPO (`raw/heatmap.json`) | ma-cs, 165 cells, all levels, GE-excluded course counts, templates NOT verified (0/165) | VERIFIED 17.12; same 17.12 on the served DB rows (older "archive" vintage: Cape Cod→Dartmouth 11/31, Dartmouth mean 36.4 vs 37.0 final-repo); 17.14 on the final-PDF printed integer cells (max 70.3). Vintage-proof. |
| MA per-college pSD 5.3, range 27.7–47.2 | same three vintages | same | VERIFIED 5.34 (final repo) / 5.32 (DB, archive) / 5.34 (PDF cells); min Mount Wachusett 27.7, max Quinsigamond 47.2 at all three. |
| CA cs 7.9 / 5.7 | our computation, live DB, working-tree code (08:36) | cs, 1035 cells, 9 UCs × 115 CCs, GE-excluded course counts, all templates `hand_verified` | VERIFIED 7.92 / 5.70. Fig 1 cell projection sha256 of the dossier pull == pinned `cs\|figure1` in `server/data/figure-baseline.json` (verify-0 `hash.js`), and the Codex audit doc states "Course-count numerators are unchanged" for the degreeSlots edits. So WT ≡ HEAD for these. |
| VA per-university "0.9–3.2" | frozen module, WORKING TREE (uncommitted 08:20 regenerate, every row `method_status: estimated`) | va-cs, catalog supply, 15 univ × 16 CS colleges = 240 cells | VERIFIED on WT: 0.87 (`pct_named_requirement_courses_with_ge`, GE-INCLUDED units), 2.44 (`va_units_no_ge_pct`), 3.22 (`pct_named_requirement_courses`, estimated course counts). At HEAD (131cf2b): 0.95 / 2.75 / 3.73. At 7d7d11a: 0.94 / 2.75 / 3.48. The "3.2" is a working-tree number; HEAD says 3.7. |
| VA per-college "0.4" | same | same | VERIFIED 0.36 / 0.40 / 0.43 (WT); 0.35 / 0.39 / 0.41 (HEAD). Stable across vintages — but see §4. |

## 3. Like-for-like check (lens)

MA 17.1/5.3 and CA 7.9/5.7 are GE-EXCLUDED COURSE-COUNT lenses. The VA lower bound "0.9" is the
GE-INCLUDED UNIT lens (`pct_named_requirement_courses_with_ge`), which is compressed by construction (the
`assumed` GE block is 100% covered everywhere; brief). The only VA field on the paper's lens is
`pct_named_requirement_courses` — 3.2 (WT) / 3.7 (HEAD) per university, 0.4 per college — and that field is an
`estimated` credit→course conversion (credits ÷ per-guide `va_course_size` 2.89–3.31). The 3.73→3.22 shift
between HEAD and WT came from re-conversion alone (no new guides), so roughly half a point of VA's
per-university SD is conversion artefact rather than articulation. Quoting "0.9" alongside 17.1 and 7.9 is
not like-for-like; the caveat "depends on measure" understates that only one of the three measures is comparable.

## 4. Supply basis and college subset (the real fragility)

Same working-tree module, `pct_named_requirement_courses` unless noted (VERIFIED, `sd_out.txt`):

| VA view | per-university pSD | per-college pSD |
|---|---|---|
| catalog, 16 CS colleges (the claim) | 3.2 | 0.4 |
| catalog, all 23 colleges | 3.4 | 3.3 |
| scheduled, 16 CS colleges | 3.4 (GE-incl units 1.9) | 5.1 (GE-incl units 5.3; no-GE units 5.9) |
| scheduled, all 23 colleges | 3.5 | 6.2 (GE-incl units 6.3; no-GE units 7.0) |

The per-college 0.4 exists because catalog supply puts 222 of 240 cells exactly at the guide-structure ceiling
(only 18 cells miss anything; brief, verify-0). It is a property of the guide construction, not a measured
absence of college-level variation. On scheduled supply VA's per-college SD (5.1–5.9) matches or exceeds MA's 5.3
and CA's 5.7 while its per-university SD stays ~3.4 — VA's dispersion is then college-side ("geographic" in the
claim's own vocabulary), which inverts the contrast the sentence draws. The claim scopes "catalog" but not the
16-college subset; with all 23 colleges even catalog gives per-college 3.3.

## 5. Cohort

- CA cs: 1035/1035 rows `hand_verified` — the cs figures mount `verifiedOnly:true` and lose nothing. Clean.
- MA: 0/165 templates verified; ma-cs is the one corpus that renders unverified (brief). The claim's MA numbers
  are the paper's own matrix, so template verification is moot for them — but they are not from a verified cohort.
- VA: all 240 WT rows `method_status: estimated` (HEAD rows carry no status at all). `docs/virginia-final-audit.md`
  (UNTRACKED, written by the concurrent audit) says Figure 1 "should be described as modeled guide preparation
  availability", not the MA named-course measure. A per-university SD of an estimated conversion inherits that.

## 6. Known live defects (`docs/figure-defect-catalogue.md`)

- The catalogue is NOT on main; it lives at `refactor:docs/figure-defect-catalogue.md` (verify-0). Read from there.
- #1 Compare unfiltered knobs (wrong MA value on screen): the dossier did not read Compare; the MA GE-excluded
  matrix used here is the pane's published measure. Not a threat.
- #2 `buildDegreeGroups` tier bypass (11 va-cs groups) and #10 VA Fig 6 kill switches: touch the DB va-cs path
  and Fig 6, not the frozen `vaCoverageRows.js`. Not a threat.
- #3 Or-collapse reach (2 bio groups): bio not in this claim; course counts unaffected anyway.
- #5 `namedGeTitled` (Irvine/Merced denominators): NOT live on main (`degreeSlots.js` scopes to title head;
  Irvine 21.0 / Merced 45.9 are the "after fix" values). CA per-university SD 7.9 already includes the fixed
  Irvine/Merced. If #5 were live, Irvine would read ~46.5 and Merced ~70.1 and CA's per-university SD would
  jump — so the CA contrast depends on this fix being present, which it is on HEAD and WT.
- #6 degreeCoverage vs pathways rounding: unit lenses only.
No catalogued defect moves any number in the claim.

## 7. Would it survive the concurrent Codex audit?

Numerically yes: MA 165/165 final-workbook reproduction (audit doc, PROVENANCE.md "Final audit corrections
2026-09-07"), CA course-count numerators unchanged, VA regenerated with means moving 42.32→42.26. The audit's
framing would NOT let the VA clause stand as written: every VA cell is `estimated`, the VA contracts now
"distinguish guide supply, estimated courses, unused associate credits", and the VA audit says Fig 1 is modelled
availability. A reviewer applying that standard rejects "VA catalog 0.9–3.2/0.4" as a dispersion measurement
comparable to MA/CA, and notes that the 3.2 is a number HEAD does not carry (3.7).

## 8. Surviving form of the claim

"MA Fig 1 (final-repo workbook; identical on the archive/served vintage and on the PDF's printed cells; 165 cells,
GE-excluded course counts, templates unverified) disperses by university, not by college: per-university
population SD 17.1 over 11 universities (Framingham 11.7 → Fitchburg 70.1) vs per-college SD 5.3 over 15 colleges
(27.7–47.2). CA cs (1035 cells, hand-verified templates, same lens; WT ≡ pinned baseline) is 7.9 / 5.7 — a
similar college spread, half the university spread. VA on the same lens is an `estimated` credit→course
conversion: catalog supply, 16 CS colleges: 3.2 (working tree; 3.7 at HEAD) / 0.4, with the 0.4 a construction
artefact (222/240 cells at ceiling); on scheduled supply VA's per-college SD rises to 5.1–5.9 while per-university
stays ~3.4, so VA's dispersion is college-side once course offering is counted."

## 9. Bottom line

refuted = true as stated (materially misleading VA clause; one VA number is working-tree-only; lens mismatch).
MA and CA clauses stand and are vintage-proof. Confidence 0.6 that "refuted" is the right label — the headline
MA finding is correct; the refutation is about the comparison it is wrapped in.
