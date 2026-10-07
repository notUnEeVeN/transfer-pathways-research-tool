# verify-7-measurement-comparability — claim F8 (Fig 1, GE-inclusive lens "reverses CA-vs-MA")

Reviewer: verify-7-measurement-comparability (adversarial, read-only). Date: 2026-09-07.
Scratch: /private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/verify-7-measurement-comparability/
(`ge_docs.js` → `ge_docs.json` = DB dump of every GE-flavoured section in the 38 cs/bio/econ/ma-cs degree documents;
`analyse.py` → `analyse_out.txt` = GE-lens decomposition + counterfactuals; `ma_residue.py` → `ma_residue_out.txt` =
content of the MA "GE" bucket.)

Note: `scratchpad/dossier-fig1/` holds no `report.md`; the claim's evidence files (`ca_mech_out.txt`, `va_out.txt`,
`coverage_*.json`) are there and were re-read. All CA/MA numbers below are OUR COMPUTATION over the dossier's
2026-09-07 `coverageData` pull (degree lens, all 1035 / 165 cells) unless stated; VA numbers are from the frozen
`frontend/src/analyses/vaCoverageRows.js` (catalog supply, 16 CS colleges, 240 cells).

## Claim under review

"Including GE reverses CA-vs-MA (MA 63.7 > CA bio 60.7 > VA 50.2 > CA econ 48.1 > CA cs 46.0) because MA's GE block
(17.2 courses per cell, 100% covered by assumption, 37% of the GE-on denominator) is nearly twice CA's (9.0–9.7 courses,
89–94% covered) and VA's assumed bucket is only 10% of its denominator; the GE-inclusive headline measures GE block size."

## Verdict

**REFUTED as stated (materially misleading), confidence 0.85.** Nearly every number reproduces (the one exception is
"37%": the MA bucket is 41% of the GE-on denominator, §1), and the closing sentence has the right instinct. But the
comparison is apples-to-oranges on four measurement axes (§2), and the claim's causal story — "MA's GE block is nearly
twice CA's" — mislabels the mechanism: MA's "GE" bucket is not general education. It is the resident-plan residue after
the heatmap columns are consumed, and about half of it (99 of 189 rows; 331 of 610 credits) is free/upper-level
electives, minors, physics/chemistry/calculus, upper-division CS electives, internships and TA slots — all counted as
100% articulable because the group carries the `transferable` tier (§3). The genuinely GE-like part of MA's bucket is
~8.2 rows per cell, FEWER than CA's 9.0–9.7. Recounting with only GE-like rows moves MA from 63.7 to 53.7 (below CA
bio); moving the discipline rows to the named-uncovered side gives 47.5 (≈ CA cs/econ). And for the like-for-like
major (CS) there is no reversal at all: MA leads CA cs on both lenses and the GE lens widens the lead (§4).

## 1. Numbers in the claim — reproduced? (VERIFIED unless marked)

| quantity in claim | reproduced value | artefact / corpus | status |
|---|---:|---|---|
| MA 63.7 | 63.7 (cell-equal; 165 cells) | served ma-cs, `pct_named_requirement_courses_with_ge`, final-repo heatmap + older-repo resident rows | VERIFIED |
| CA bio 60.7 / econ 48.1 / cs 46.0 | 60.7 / 48.1 / 46.0 | served, degree lens, 1035 cells each, course counts | VERIFIED |
| VA 50.2 | 50.2 | frozen vaCoverageRows catalog/16, `pct_named_requirement_courses_with_ge` — **this field is CREDIT-based for VA** ((supplied+assumed)/stated whole-degree credits) | VERIFIED value; wrong unit for the list |
| MA GE block 17.2 courses/cell, 100% covered | 17.2 (min 8, max 25), 100.0% | ma-cs with_ge_total − named_total | VERIFIED |
| "37% of the GE-on denominator" | **40.8% per-cell mean, 41.2% pooled** | same rows | **NOT reproduced** (17.2 / (24.5 + 17.2) = 41%; 37% would need a 46.5-course denominator — 46.5 happens to be VA's university-only share in va_out.txt, probably a slip) |
| CA GE 9.0–9.7 courses, 89–94% covered | cs 9.4 (89.4%), bio 9.0 (93.8%), econ 9.7 (94.3%) | ca_mech_out.txt re-run | VERIFIED |
| VA assumed bucket ≈10% of denominator | 10.1% pooled / 10.2% per-cell (12.5 credits of ~124) | va_out.txt line 44 | VERIFIED |
| "reverses CA-vs-MA" | GE-excl: bio 51.2 > MA 38.2 > cs 31.9 > econ 23.7. GE-incl: MA 63.7 > bio 60.7 > econ 48.1 > cs 46.0 | | TRUE only for MA-vs-CA-bio; MA-vs-CA-cs does not reverse (§4) |

Decomposition check (pooled w = bucket share): GE-incl = w·GEcov + (1−w)·named gives cs 46.3 / bio 60.7 / econ 48.4 /
MA 63.7 against observed 46.0 / 60.7 / 48.1 / 63.7 — so the claim's arithmetic framing is sound. The problem is what
"GE" means in each corpus.

## 2. Are the compared quantities defined the same way? No — four axes differ.

| axis | CA (engine, legacy CA documents) | MA (engine over `buildMaDocuments` residue) | VA (frozen `buildVaCoverageCells`) |
|---|---|---|---|
| **Unit of count** | courses (section ask, series expanded) | courses (one per resident-plan row) | **credits**; the `with_ge` field is (supplied + assumed) / stated whole-degree credits |
| **What the "GE" bucket contains** | sections whose title says GE / whose receivers are `ge_area`-shaped (`namedGeFlavored`); **free-elective padding is skipped from BOTH lenses** (`NAMED_PADDING_TITLE`, degreeSlots.js:255-270, 604). Upper-division GE sections stay in the bucket. | **every resident-plan row no heatmap column consumed** (buildMaDocuments.js:405-420; group title literally "GE: general education and electives"). Includes free/upper-level electives, "Minor", physics/chem/calculus, upper-division CS courses, internships, TA/PAL rows (§3). | the guide's `assumed` rows only (rows naming no course: open GE category / UCGS slot). Enumerated GE courses in the guide sit in the named/supplied bucket; the university's own post-transfer GE sits in `university_only` (uncoverable). |
| **Coverage rule for the bucket** | covered iff section tier ≠ `nontransferable` (degreeSlots.js:476-490) — i.e. **also 100% by assumption** for lower-division GE; the 6–11% shortfall is the 5–9 upper-division GE courses per corpus (Merced Crossroads/WID, UCSD Warren post-transfer, UCR ENGR 180W, Berkeley upper H/SS…) kept in the bucket as uncoverable | group tier `transferable` → 100% | assumed = covered by construction |
| **Denominator** | named degree/college courses (incl. upper-division, 41–69% of the named count) + GE bucket; padding excluded | heatmap columns (incl. upper-division and 70 placeholder columns) + the whole residue | stated whole-degree credits: pre-transfer half (supplied+missing+assumed) + post-transfer half (46.5% university-only); ceiling 50.4% |
| **Bucket share of denominator (w)** | cs 25%, bio 22%, econ 35% | 41% | 10% (credits) |
| Vintage | live DB 2026-09-07 | final-repo heatmap + older-repo resident rows (per-course sheets exist only in `recovered/`) | frozen 2026-09-07 from 2026-08-30/31 captures; `method_status: estimated` on all 240 cells |

Consequences:
- **VA does not belong in a course-count ranking.** Its 50.2 is a credit ratio over the whole degree with the
  post-transfer half in the denominator; there is no course-basis GE-inclusive VA figure in the frozen rows. The closest
  like-for-like is CA's own cap-aware credit figure `pct_degree_units` (GE incl.): cs 48.5, bio 55.4, econ 56.3 vs VA
  50.2 — on that basis VA ≈ CA cs, not "VA > CA econ > CA cs". MA has no credit figure at all (server-nulled).
- **"100% by assumption" vs "89–94% covered" is not a difference in measured articulation.** Both engines assume
  lower-division GE articulates everywhere. The gap is that CA's bucket carries upper-division GE as uncoverable while
  MA's bucket carries upper-division residue as COVERED.
- **Free electives are treated three ways:** CA strips them (padding), MA counts them as covered GE, VA counts open
  rows as covered (assumed) but leaves university-side electives uncoverable.

## 3. What is actually inside MA's 17.2-course "GE" block (VERIFIED from the DB degree documents; classification INFERRED by title regex, `ma_residue.py`)

| university | residue rows (credits) | GE-like | free / upper-level elective / minor | discipline & other |
|---|---:|---:|---:|---|
| Bridgewater | 25 (76) | 18 (54) | 0 | 7 (22): Peer Assisted Learning, OO Software Engineering, General Physics I/II + labs, Internship, Directed Study |
| Fitchburg | 16 (50) | 10 (30) | 6 (20): Minor ×3, Free Elective ×2, Upper Level Elective | 0 |
| Framingham | 12 (48) | 8 (32) | 2 (8) | 2 (8): Data Structures, Principles of Physics I |
| MCLA | 17 (55) | 9 (27) | 3 (12) | 5 (16): TA in CS ×2, Intermediate Topics in Computing, Calculus I, General Physics II |
| Salem | 18 (61) | 8 (24) | 2 (6) | 8 (31): Database Systems, Software Engineering II, Digital Circuit Design, Calculus III, three physics courses (+ one mis-spelt writing row) |
| UMass Amherst | 24 (76) | 6 (18) | 8 (24): free elective ×8 | 10 (34): Multivariate Calculus, Physics I, Intro Biology, Software Engineering, Data Science, Computer Networks, Search Engines, Mobile Health Sensing, Software Entrepreneurship, Independent Study |
| UMass Boston | 19 (60) | 8 (24) | 8 (29): Free Elective ×6, Upper Level Elective ×2 | 3 (7): Physics Lab I/II, Computer Architecture |
| UMass Dartmouth | 18 (56) | 3 (9) | 2 (6) | 13 (41): Calc III, Biology I, Classical Physics I/II, Computer Graphics, Image Analysis, Secure Software Dev, Database Systems, Software Architecture, Web Dev, Software Process, Special Topics, Social & Ethical Aspects |
| UMass Lowell | 8 (24) | 4 (12) | 2 (6) | 2 (6): Software Project I/II |
| Westfield | 15 (50) | 7 (22) | 6 (20) | 2 (8): General Chemistry I/II |
| Worcester | 17 (54) | 9 (27) | 7 (24): Upper Level Elective ×3, Free Elective ×3, Art Elective | 1 (3): Directed Study |
| **all 11** | **189 (610)** | **90 (279)** | **46 (155)** | **53 (176)** |

- Only 48% of the rows (46% of the credits) in MA's "GE" bucket are GE-like. GE-like credits average 25 per
  university, below the 34-credit MassTransfer General Education Foundation (orchestrator context), so the bucket is
  not "MA's GE requirement" in either direction.
- Every one of these 189 rows is counted as articulable at every CC under the GE-on lens — including UMass
  Dartmouth's upper-division CS electives and UMass Amherst's Computer Networks / Search Engines, the very course
  family whose non-articulation is the MA paper's headline result (computing 22% in Fig 2).
- Why the residue is so large: heatmap columns are matched to resident rows by code/name and the join is imperfect
  (214–222 of 270 columns match; the rest take a 4-credit fallback and leave their real resident row in the residue),
  and the heatmap enumerates prerequisites/duplicates that consume rows (brief: Dartmouth template 172 vs 120 resident
  credits). This is a construction artefact, not a policy fact about Massachusetts GE.

**Counterfactuals (our computation, cell-equal, 165 cells):**

| MA GE-inclusive variant | value |
|---|---:|
| as served (all 189 residue rows covered) | 63.7 |
| only GE-like rows count as GE (100% covered); discipline & elective rows dropped | 53.7 |
| GE-like + free/open electives (what MA would be if CA's padding were counted as covered) | 58.9 |
| GE-like rows as GE; discipline rows moved to the named denominator as uncovered | 47.5 |
| bucket capped at 11 courses (≈34-credit GenEd block) | 57.5 |
| common 10-course GE block @100% for every corpus: MA / CA cs / bio / econ | 56.4 / 49.9 / 63.2 / 51.3 |

CA counterfactual: applying MA's 100%-covered rule to CA's GE bucket raises cs 46.0→48.8, bio 60.7→62.2, econ
48.1→50.6; the MA–CA cs gap is 17.6 as served, 14.9 with CA at 100%, 11.4 with MA capped at 11 GE courses. The
"reversal" versus CA bio disappears under every variant that restricts MA's bucket to GE-like rows.

## 4. "Reverses CA-vs-MA" is a cross-major statement, not a cross-state one

| lens | CA cs | MA cs | gap | CA bio | CA econ |
|---|---:|---:|---:|---:|---:|
| GE excluded (course counts) | 31.9 | 38.2 | MA +6.3 | 51.2 | 23.7 |
| GE included (course counts) | 46.0 | 63.7 | MA +17.6 | 60.7 | 48.1 |

For the same major, the state ordering is unchanged (MA > CA) and the GE lens WIDENS MA's lead by 11 points — the
opposite of "compresses between-state differences". The only thing that reverses is MA-cs vs CA-bio, two different
degree structures (bio's named denominator is 59% lower-division vs MA's 57% and cs's 47%; verify-0 showed the
GE-excluded cross-major gap is itself a ceiling artefact). The GE-on gain is w·(GEcov − named): econ gains 24.4 points
with a 9.7-course bucket because its named coverage is 23.7 and w = 35%; MA gains 25.5 with w = 41%. So "the
GE-inclusive headline measures GE block size" should read "measures the share AND CONTENT of whatever each corpus put
in its assumed bucket".

## 5. What is right in the claim

- All headline values reproduce from the named artefacts; the w·GEcov decomposition is exact.
- The instinct that the GE-on lens is dominated by an assumed-covered bucket is correct, and it is the right reason
  to prefer the GE-excluded (or lower-division-only) lens for cross-state work.
- VA's assumed bucket is indeed small (10% of credits) and its GE-on gain is only +5.8 (44.4 → 50.2 credits, catalog).

## 6. Corrected claim

"Under the engine's GE-inclusive COURSE lens the values are MA cs 63.7 > CA bio 60.7 > CA econ 48.1 > CA cs 46.0
(cell-equal; 165 / 1035 cells). VA's 50.2 is a CREDIT ratio over the stated whole degree (post-transfer half in the
denominator) and does not belong in that list; on CA's own cap-aware credit lens VA 50.2 ≈ CA cs 48.5 < bio 55.4 ≈
econ 56.3, and MA has no credit figure. For the like-for-like CS comparison nothing reverses: MA leads CA cs on both
lenses and the GE lens widens its lead from 6.3 to 17.6 points; only MA-cs vs CA-bio flips. The GE-on gain equals
w·(bucket coverage − named coverage), with w the bucket's share of the denominator (MA 41%, econ 35%, cs 25%, bio 22%;
VA 10% of credits). MA's 17.2-row bucket (100% covered by tier) is not general education: it is the resident-plan
residue, 99 of whose 189 rows are free/upper-level electives, minors, physics/calculus and upper-division CS courses
that CA either strips as padding or counts as uncoverable. Restricted to GE-like rows MA's bucket is 8.2 rows per cell
(fewer than CA's 9.0–9.7) and MA's GE-inclusive value is 53.7 (47.5 if the discipline rows are charged as uncovered
named courses). CA's lower-division GE is likewise covered by assumption; its 89–94% reflects upper-division GE kept
in the bucket as uncoverable. The GE-inclusive ordering therefore reflects three different bucket definitions and is
not robust; it should not be used for cross-state or cross-major ranking."

## 7. Sources

- server/services/degreeSlots.js 255-300 (GE/padding regexes, `namedGeFlavored`), 476-540 (`geSectionCourses`:
  covered iff tier ≠ nontransferable; `addGe`), 575-612 (legacy role assignment; padding skipped).
- server/scripts/ma/buildMaDocuments.js 13-18, 384-478 (residue = multiset complement → GE group, tier `transferable`).
- server/scripts/va/buildVaCoverageCells.js 200-216 (`assumed` verdict), 395-455 (denominator = stated total,
  `ge_units = tally.assumed`, `covered_units_no_ge`); docs/virginia-final-audit.md 113-120.
- DB `curated_requirements` (kind degree; 27 CA + 11 MA documents) and `assist_courses` (MA credits) dumped to
  ge_docs.json 2026-09-07.
- Dossier outputs re-run: dossier-fig1/{ca_mech_out,dist_out,va_out,ma_units_out}.txt; sibling verify-0
  measurement-comparability report (GE-excluded lens) consulted, its ceiling findings not re-derived here.
