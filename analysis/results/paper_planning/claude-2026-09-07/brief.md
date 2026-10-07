# Shared brief for the cross-state analysis workflow (2026-09-07)

READ THIS FIRST. It records what the orchestrator already established. Do not re-derive
these facts; build on them. Everything you produce is READ-ONLY with respect to the
repository: never edit, write, or commit files under `internal_tool/` (another Codex
instance is mid-audit; the working tree has uncommitted changes). Write scratch files only
under `/private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/`.

## The task in one paragraph

Tybalt (the researcher) is starting the analysis section of a new paper. The paper reuses
the SIX "MA-lane" figures (the Massachusetts paper "Lost in Transfer", Jiang-style
methods) and applies them across THREE states: California (CA, ASSIST + UC degree
templates, majors cs / bio / econ), Massachusetts (MA, the paper's own recovered
workbooks, major `ma-cs`), and Virginia (VA, Transfer Virginia guides, major `va-cs`).
Question 1: which of the six figures gives the most meaningful, interesting
contribution, analysed as DIFFERENCES BETWEEN STATES (primary) and reinforced by
DIFFERENCES BETWEEN MAJORS within CA (secondary)? Question 2: is the "GE included, unit
weighted" form of the data (chosen for precision) even feasible — MA Figure 1 today is
GE-excluded and course-count based; the two old repos `ma_paper` and `final_ma_paper`
must be inspected. Question 3: interesting findings, with the working intuition that VA
is "best" because the state standardised its courses and AS requirements together with
every school in the system; where are the other states failing and why? Question 4:
further investigations and NEW visuals that would illustrate state differences.

The OLD CA-paper ports (paper-credit-loss, paper-district-heatmap,
paper-articulation-histogram, paper-articulation-map, paper-course-barriers) and the
figures Tybalt made himself (income-access, price-of-place, paper-gate, credit-loss,
multi-campus-pathways) are OUT OF SCOPE. Only the six MA-lane figures count:

| id | MA paper figure | title |
|---|---|---|
| coverage-heatmap | Fig 1 | Articulation coverage of named BS requirements (CC × university) |
| course-type-coverage | Fig 2 | Transferable requirements by course type |
| transfer-credit-rate | Fig 3 | Share of AS credits that apply on transfer |
| transfer-extra-units | Fig 4 | Pathway hours above 120 |
| transfer-extra-cost | Fig 5 | Cost of hours above 120 |
| pathway-complexity | Fig 6 | Curricular complexity delta vs resident |

## Where things are

Root: `/Users/tybaltmallet/Desktop/transfer_pathways/`
- `internal_tool/` — the codebase (Node/Express server in `server/`, React in `frontend/`).
- `internal_tool/frontend/src/analyses/registry.js` — the figure registry (metadata, knobs).
- `internal_tool/frontend/src/analyses/{CoverageHeatmap,CourseTypeCoverage,TransferCreditRate,TransferExtraUnits,TransferExtraCost,PathwayComplexity}.jsx` — figure components.
- `internal_tool/server/services/analysis/pathways.js` (coverageData = Fig 1/2), `degreeSlots.js` (slot/GE/tier rules), `degreeCoverage.js`, `analysis/transferCreditRate.js` (Fig 3/4/5), `analysis/pathwayComplexity.js` (Fig 6), `config/majors.js` (major capabilities incl. `unitCoverage`, `paperBaselines`).
- `internal_tool/docs/visualizations.md` (plain-English figure explanations), `docs/ma-paper-audit.md` (MA final-PDF audit), `docs/ma-meeting-notes.md`, `docs/figures/ma-course-type-spread.md` (Fig 2 CA vs MA per campus), `docs/figures/degree-coverage-sources*.md` (CA template provenance), `docs/virginia-final-audit.md` (VA figure data path, 2026-09-07), `docs/figure-defect-catalogue.md` (11 known live defects, deliberately unfixed), `docs/state-expansion-feasibility.md`, `docs/uc-degree-modelling-rules.md`, `docs/notes_computing_bottleneck.md`.
- `internal_tool/server/data/figure-baseline.json` — pinned figure measures (numbers below come from here).
- `internal_tool/server/data/ma/` — MA data: `PROVENANCE.md`, `raw/{heatmap,pathways,as_degrees,baselines}.json` (deterministic conversion of the workbooks), `recovered/` (older repo vintage incl. `All CC AS.xlsx`, `All Pathways/*.xlsx` = per-course resident + transfer tabs with credit hours), `final/` (final repo `Four Year Heatmap.xlsx`, `Pathways Master.xlsx`), `pdf-figures.json` (final-PDF transcriptions), `figure-ledgers.json`, `their-math.json`.
- The two old repos: `/Users/tybaltmallet/Desktop/transfer_pathways/ma_paper/transferpaper/` (older, has `LaTeX/main.tex`, `Code + Sheets/`, README explaining workbook semantics; git history commit `59c1b77` holds the per-course workbooks) and `/Users/tybaltmallet/Desktop/transfer_pathways/final_ma_paper/CIC-CC-Paper/` (final submission repo: `Four Year Heatmap.xlsx`, `Pathways Master.xlsx`, four notebooks, images). The final PDF: `/Users/tybaltmallet/Desktop/transfer_pathways/2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf` (7 pages; Figs 1–7).
- VA figure data is FROZEN in committed modules (not served): `internal_tool/frontend/src/analyses/vaCoverageRows.js` (Fig 1, four variants: catalog / scheduled × 16 CS colleges / all 23), `vaCreditRateRows.js` (Fig 3/4), `vaTransferGuides.js`; generated by `server/scripts/va/buildVaCoverageCells.js` from `server/.va-guides/guides.json` + `server/.va-courses/`. Parse them with Python: `s=open(path).read(); i=s.find('= {'); obj=json.loads(s[i+2:s.rfind('}')+1])`.

## Tooling

- Python with openpyxl: `/Users/tybaltmallet/Desktop/transfer_pathways/internal_tool/pmt-env/bin/python`.
- Live database (MongoDB Atlas, works from node scripts; the HTTP API at :3100 is auth-guarded, do NOT curl it). Recipe (run from `internal_tool/server`):
  ```js
  require('dotenv').config({ path: '/Users/tybaltmallet/Desktop/transfer_pathways/internal_tool/server/.env' });
  const { MongoClient } = require('mongodb');
  const { coverageData } = require('/Users/tybaltmallet/Desktop/transfer_pathways/internal_tool/server/services/analysis/pathways');
  const { transferCreditRateData } = require('/Users/tybaltmallet/Desktop/transfer_pathways/internal_tool/server/services/analysis/transferCreditRate');
  const { pathwayComplexityData } = require('/Users/tybaltmallet/Desktop/transfer_pathways/internal_tool/server/services/analysis/pathwayComplexity');
  (async () => {
    const c = new MongoClient(process.env.MONGO_URI); await c.connect();
    const db = c.db(process.env.DB_NAME || 'pmt_research');
    const rows = await coverageData(db, db, { majorSlug: 'cs', requirements: 'degree' }); // 'cs'|'bio'|'econ'|'ma-cs'|'va-cs'
    // transferCreditRateData(db, db, { majorSlug, degreeType: 'ast'|'local_as'|'local_other', verifiedOnly: true|false })
    await c.close();
  })();
  ```
  See `server/scripts/figureBaseline.js` lines 240–330 for exactly how each figure's measure is pulled. ~3 s per coverage call. Coverage rows carry course-count fields (`pct_named_requirement_courses`, `..._with_ge`) AND unit fields (`degree_units_named_total`, `degree_units_named_covered`, `degree_units_ge_total`, `degree_units_ge_with_equivalent`, `pct_degree_units`, `degree_transfer_cap`); unit fields are server-nulled for corpora with `unitCoverage:false` (ma-cs, va-cs).
- CA figure controls: verified cohort matters (cs, bio, econ, va-cs figures mount with `verifiedOnly:true`; only ma-cs renders unverified). cs|local_as is 57.3% unverified vs 60.2% verified.

## Facts already established (cite as "orchestrator scouting")

### The MA paper's own definitions (final PDF)
- Fig 1 = per CC×university pair: named BS degree/college requirements with an equivalent CC course ÷ all named required courses; **GE excluded by the authors' design; course COUNTS (COUNTIF/COUNTA), upper division kept in the denominator**. 165 pairs, mean 38.2%. Data sources: MassTransfer A2B database (only 4 of 11 universities have CS A2B pathways; 38 of 165 pairs), university websites, MassTransfer course equivalency database.
- Fig 2 = same population split by type (computing 22%, math 60%, science 93%, non-STEM 76% n=5).
- Fig 3 = AS credits that satisfy a BS requirement ÷ AS total credits, 61 proximity-selected pathways (≤50 mi), mean 68%; only 6 of 15 CCs have a 100% partner.
- Fig 4 = max(0, pathway hours − 120); 49 pathways; mean 13. Fig 5 = Fig 4 × per-credit tuition, mean $7,129. Fig 6 = curricular complexity delta, mean +15.
- Three artefact vintages exist for every MA number: final PDF, final repo workbooks (`final/`, reproduce PDF 165/165, 61/61, 49/49), older repo (`recovered/`, only source of per-course sheets). ALWAYS name which vintage a claim is about.

### Pinned cross-state / cross-major numbers (figure-baseline.json, 2026-08 / 09)
Figure 1 (named-course coverage, degree lens, course counts):
| corpus | cells | GE excluded | GE included |
|---|---|---|---|
| CA cs | 1035 | 31.9% | 46.0% |
| CA bio | 1035 | 51.2% | 60.7% |
| CA econ | 1035 | 23.7% | 48.1% |
| MA cs | 165 | 38.2% | 63.7% |
| VA cs (frozen guide join, 16 CS colleges, catalog supply) | 240 | 42.3% (course estimate) / 44.4% (units, no GE) | 50.2% (units, GE incl.) |
| VA cs (scheduled supply) | 240 | — | 45.6% (units, GE incl.) |

How GE is "included": the engine's GE-on lens counts every lower-division GE section as articulable at every college (policy assumption: IGETC/Cal-GETC in CA; for MA the resident plans' GE residue rows; VA the `assumed` bucket). So GE-inclusive numbers add a block that is 100% covered by assumption, compressing between-state differences.

Figure 3 (AS credit utilisation, paper-equivalent lens):
| corpus | value |
|---|---|
| CA cs AS-T | 65.4% (621 cells) ; local AS 57.3% unverified / 60.2% verified |
| CA bio AS-T | 73.6% ; local AS 62.4% |
| CA econ AS-T | 60.7% ; local other 49.1% |
| MA final PDF | 67.7% (61 pathways); our gray-row recalculation 64.7%; our modelled 68.6% |
| VA (guide utilisation, 16 CS colleges) | 98.5% catalog / 89.5% scheduled — NOTE: near 100% by construction, the guide IS the pathway; loss arises only where a college lacks course supply |

Figure 4 (hours above 120): CA cs AS-T 16.2, local AS 21.1; CA bio AS-T 10.2; CA econ AS-T 0.02; MA final PDF 12.9 (49 pathways), ours 15.3; VA 0.96 catalog / 6.6 scheduled ("unused transfer-guide credit", a different construction).
Figure 5: MA tuition-only; CA tuition + fees; VA no tuition data → cross-state dollars blocked.
Figure 6: CA cs local_as computed 198/405, AS-T 558/621; MA 49 cells +15 mean (47/49 reproduce); VA renders BLANK (two kill switches: AMBIGUOUS_UNIT_POOL and an `institution_id` prefix mismatch, catalogued defect).
Figure 2 (whole degree, GE excluded, campus means): CA cs computing 11.5% / math 78.7 / science 63.3 (n=7) / non-STEM 0 (n=4); CA lower-division computing 45.7%; MA computing 22 / math 60 / science 93 / non-STEM 76 (n=5); CA bio own-discipline 42.7, econ 15.1.

### MA structure facts (orchestrator computed from raw/heatmap.json and raw/pathways.json)
- 270 heatmap requirement columns over 11 universities; per-university means (all-level, = paper Fig 1 bottom row): Bridgewater 43.0, Fitchburg 70.1, Framingham 11.7, MCLA 17.6, Salem 46.4, Amherst 44.2, Boston 22.2, Dartmouth 37.0, Lowell 61.7, Westfield 26.7, Worcester 40.3. Lower-division-only means: 73.9, 92.8, 23.0, 29.7, 58.4, 59.0, 46.7, 67.9, 86.7, 44.6, 49.3.
- Per-university structural ceiling (lower-division columns ÷ all columns): e.g. Bridgewater 11/22, Fitchburg 12/23, Lowell 22/31, Framingham 9/20, MCLA 13/25.
- **MassTransfer A2B flag ("MT" column) split: the 38 A2B-mapped pairs average 56.9% coverage vs 32.7% for the 127 non-mapped pairs.** Only Bridgewater (10 CCs), Fitchburg (11), Amherst (11), Dartmouth (6) have any A2B pairs. Lowell (61.7%) is the high-coverage university WITHOUT A2B. The MT column was never imported into the site.
- Credit join for a unit-weighted Fig 1: 214 of 270 heatmap columns (79.3%) match a resident 4y-tab row (older `recovered/` vintage) by code or name; the other 56 get a 4-credit fallback. Weakest joins: Amherst 12/22, Bridgewater 15/22, Dartmouth 18/31, Salem 17/24. Heatmap columns include prerequisites and duplicates (MCLA lists "Programming in Java II" twice), so the template's unit sum exceeds the resident total (Dartmouth 172 vs 120; Bridgewater 151 vs 123).
- GE was never assessed per CC in the heatmap. GE exists only as resident-plan residue rows (8–25 rows, 24–76 credits per university, mostly "ELEC xxx Arts/Humanities/Social Science" placeholders) and, for the 61 studied pairs only, as gray rows in the transfer tabs (older vintage). The final repo has NO per-course sheets.
- Policy context to verify: MassTransfer General Education Foundation = 34-credit statewide GE block; A2B maps; MassEducate free CC (2024). CA: SB 1440 ADT/AS-T guarantee, IGETC/Cal-GETC, C-ID, 70-unit transfer cap. VA: Transfer Virginia portal (2020 legislation), VCCS common course numbering, Passport (16 cr) and UCGS (31 cr) GE blocks, university-authored transfer guides, guaranteed admission agreements.

### VA structure facts
- 15 universities × 16 CS colleges = 240 cells (catalog); per-university Fig 1 (course estimate) spread is NARROW: 37.5 (RMC) to 49.7 (George Mason). Per-college GE-inclusive unit coverage in catalog mode is nearly constant (50.4 at 11 of 16 colleges; min 49.4) — only 11 distinct missing requirements exist in the whole catalog view (CSC 208 Discrete Structures, CSC 215, CSC 205+215, MTH 288, EGR/ENGR 121/122/125, MTH 167). VA's full-degree completion is capped near 50% by construction (60 pre-transfer credits of a 120–124 degree).
- Fig 3 per-university utilisation 95.7 (UVA) – 100 (Bridgewater, NSU, ODU, Radford, W&M).
- The VA figures carry `method_status: estimated` and source warnings (credit ranges at upper bounds, unresolved cardinalities). The VA Figure 1 should be described as modelled guide-preparation availability, not a literal reproduction of the MA named-course measure (docs/virginia-final-audit.md).

### Known live defects (do not "fix"; cite `docs/figure-defect-catalogue.md`)
Compare tab passes unfiltered knobs (wrong MA value shown), `degreeSlots.buildDegreeGroups` bypasses tier resolver (11 va-cs groups), Or-collapse ignores articulation_reach (2 bio groups), VA Fig 6 two kill switches.

## Standards for every claim you return
- Name the vintage/artefact (final PDF / final repo / older repo / our computation) and the corpus (state, major, degree type, verified cohort, supply basis).
- Distinguish VERIFIED (you reproduced the number) from INFERRED (reasoning) from CONTEXT (policy facts from the web, with URL).
- Report cell counts alongside means. Prefer per-institution distributions over single means.
- When two states' measures are not like-for-like, say exactly what differs (denominator, GE, units vs counts, cohort, ceiling).

### VA scheduled-supply view (orchestrator computed from vaCoverageRows.js, 16 CS colleges)
- Catalog supply: only 18 of 240 cells miss anything (11 distinct requirements).
- **Scheduled supply: 133 of 240 cells miss something; 39 distinct requirements.** Most-missing: CSC 223 Data Structures (55 + 20 cells), CSC 222 Object-Oriented Programming (33 + 12), CSC 205 Computer Organization (32 + 16 + alternatives), MTH 264/265 Calculus (24 + 15), CSC 208 Discrete / MTH 288 (21 + 12 + 8), CSC 215 (10). Per-college GE-inclusive unit coverage in scheduled mode ranges 34.0 (Southwest Virginia) → 50.4 (J Sargeant Reynolds, New River, Northern Virginia, Tidewater).
- Interpretation to test: VA solved ARTICULATION by common course numbering + university-authored guides (catalog view ≈ ceiling everywhere), but the SAME computing courses that fail to articulate in CA and MA (CS2 / data structures / discrete / computer organisation) reappear in VA as courses a small college lists but does not schedule. The bottleneck moves from the articulation layer to the course-offering layer.
- VA GE units per guide average 12.5 of the ~60 pre-transfer credits (`va_ge_units`); the ceiling (`va_ceiling_pct`) averages 50.4%.
