# Biology + Economics four-year degree templates — research dossier

Research date: **2026-07-23**  
Status: **AI-researched and imported; human verification required before production use**

This is the human-verification index for the 18 new full-degree templates:

- [`scripts/data/uc_degree_requirements_bio.json`](../../scripts/data/uc_degree_requirements_bio.json)
- [`scripts/data/uc_degree_requirements_econ.json`](../../scripts/data/uc_degree_requirements_econ.json)

Every campus object in those files has an ordered `sources` list, per-group
`source_refs`, a unit audit, modeling notes, and explicit data-quality flags.
The templates are imported into Atlas and the API serves their source lists to
the in-app **Verify these requirements** card. Biology and Economics therefore
advertise the `degreeTemplates` capability, but the records retain their
AI-researched status until a human verifies them against the linked sources.

## Method used

Each degree is the combination of three separately researched layers:

1. the exact configured major/award and its lower- and upper-division rules;
2. the college, school, campus, or residential college that actually owns GE;
3. university graduation rules such as total units, upper-division minimums,
   and residence.

The authored budget selects one documented minimum-unit path when alternatives
have different totals. Higher-unit alternatives remain visible. GE is recorded
as the **distinct remainder after known major overlap**, so math/science does
not count twice. A derived UC-transferable elective-capacity row closes the
canonical model to the published 120/180-unit degree minimum. Those balancing
rows are modeling arithmetic, not catalog claims.

Course level is determined by the course number, not by the heading under which
a catalog happens to list it. This matters for UCSB CHEM 109A/B, UC Merced BIO
110, and UCR BCH 100/110A. Conversely, UCI ECON 15 remains in the
lower-division denominator even though the catalog says it must be taken at
UCI, so an associate degree cannot receive credit for that requirement.

## GE ownership and reuse

| Campus | Can Biology and Economics share one GE search? | Governing rule |
|---|---|---|
| Berkeley | Yes | Both are B.A. programs in L&S. |
| Davis | Partly | Campus GE is shared, but Biology is in the College of Biological Sciences and Economics is in L&S, which add different college rules. |
| Irvine | Partly | Campuswide GE is shared; Dunlop Biological Sciences and Social Sciences add different school requirements. |
| UCLA | Yes | Both are in the College of Letters and Science. |
| Merced | Yes | GE is campuswide even though Biology is in Natural Sciences and Economics is in SSHA. |
| Riverside | No | Biology uses CNAS breadth; Economics uses CHASS breadth. |
| San Diego | No single answer | GE belongs to the student's residential college, not the major's academic school. There are eight variants. |
| Santa Barbara | Same college, different award pattern | Biology is modeled as the L&S B.S.; Economics uses the L&S B.A. GE pattern. |
| Santa Cruz | Yes | GE is campuswide; transfer students are exempt from residential-college core and certification clears GE except embedded DC. |

## Official verification paths

| Campus | Biology major | Economics major | GE / college authority | Graduation / transfer |
|---|---|---|---|---|
| Berkeley | [MCB current requirements](https://mcb.berkeley.edu/undergrad/major/major-requirements/requirements) | [Economics B.A. requirements](https://econ.berkeley.edu/undergraduate/program/major-requirements) | [L&S seven-course breadth](https://lsadvising.berkeley.edu/seven-course-breadth) | [L&S degree requirements](https://lsadvising.berkeley.edu/node/69) · [current transfer policy](https://ls.berkeley.edu/prospective-students/new-policies-transfer-student-applicants) |
| Davis | [Biological Sciences B.S.](https://catalog.ucdavis.edu/departments-programs-degrees/biological-sciences/biological-sciences-bs/) · [BIO/BIS transition](https://biology.ucdavis.edu/about/bio-1-2-3/students) | [Economics A.B.](https://catalog.ucdavis.edu/departments-programs-degrees/economics/economics-ab/) | [Campus GE](https://catalog.ucdavis.edu/undergraduate-education/university-degree-requirements/general-education-ge-requirements/) · [Biological Sciences college](https://catalog.ucdavis.edu/undergraduate-education/college-degree-requirements/biological-sciences/) · [L&S](https://catalog.ucdavis.edu/undergraduate-education/college-degree-requirements/letters-science/) | [Unit rules](https://catalog.ucdavis.edu/undergraduate-education/university-degree-requirements/unit-requirements-limitations/) · [Residence](https://catalog.ucdavis.edu/undergraduate-education/university-degree-requirements/senior-residence-requirements/) |
| Irvine | [Biological Sciences B.S.](https://catalogue.uci.edu/charliedunlopschoolofbiologicalsciences/biologicalsciences_bs/) · [Dunlop School rules](https://catalogue.uci.edu/charliedunlopschoolofbiologicalsciences/) | [Economics B.A.](https://catalogue.uci.edu/schoolofsocialsciences/departmentofeconomics/economics_ba/) · [Social Sciences rules](https://catalogue.uci.edu/schoolofsocialsciences/) | [Campuswide degree and GE rules](https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/) | Same campuswide source includes 180 units, transfer certification/cap, writing, and residence. |
| UCLA | [Biology B.S.](https://catalog.registrar.ucla.edu/major/2026/BiologyBS) | [Economics B.A.](https://catalog.registrar.ucla.edu/major/2026/EconomicsBA) | [L&S GE](https://catalog.registrar.ucla.edu/browse/College%20and%20Schools/CollegeofLettersandScience/College-Requirements/General-Education-Requirements) · [Writing](https://catalog.registrar.ucla.edu/browse/College%20and%20Schools/CollegeofLettersandScience/College-Requirements/Writing-Requirement) | [L&S degree and university requirements](https://catalog.registrar.ucla.edu/browse/College%20and%20Schools/CollegeofLettersandScience/Undergraduate-Degree-and-University-Requirements) |
| Merced | [General Biology B.S., current catoid 26](https://catalog.ucmerced.edu/preview_program.php?catoid=26&poid=4450&returnto=3780) | [Economics B.A., current catoid 26](https://catalog.ucmerced.edu/preview_program.php?catoid=26&poid=4259&returnto=3780) · [readable department page](https://economics.ucmerced.edu/undergraduate-programs/majors/economics-ba) | [Catalog GE](https://catalog.ucmerced.edu/content.php?catoid=26&navoid=3664) · [GE Office](https://ge.ucmerced.edu/node/451) | [Graduation](https://catalog.ucmerced.edu/content.php?catoid=26&navoid=3603) · [44 upper-division units](https://registrar.ucmerced.edu/node/1376) |
| Riverside | [CNAS Biology advising and current sheet](https://cnasstudent.ucr.edu/biology) | [Economics major page](https://economics.ucr.edu/undergraduate-program/economics-major/) | CNAS and CHASS chapters in the catalog PDF | [UCR General Catalog 2025–26](https://documents.ucr.edu/registrar/UCR%20Catalog%202025-2026.pdf), controlling source for university, college, and major rules |
| San Diego | [General Biology B.S. catalog](https://catalog.ucsd.edu/curric/BIOL-ug.html) · [current department requirements](https://biology.ucsd.edu/education/undergrad/major-minor-programs/majors/requirements/general/index.html) | [Economics B.A.](https://catalog.ucsd.edu/curric/ECON-ug.html) | [Eight-college comparison](https://catalog.ucsd.edu/undergraduate/graduation-requirements/index.html) · [college authority](https://catalog.ucsd.edu/undergraduate/colleges/index.html) | [Degree requirements](https://catalog.ucsd.edu/undergraduate/degree-requirements/index.html) · canonical comparison lens: [Warren transfer GE](https://warren.ucsd.edu/academics/general-education/index.html) |
| Santa Barbara | [Biological Sciences B.S. 2026–27](https://undergrad.biology.ucsb.edu/sites/default/files/2026-07/Biological%20Sciences%20BS%20Major%20%282026-2027%29.pdf) · [Pre-Biology](https://undergrad.biology.ucsb.edu/sites/default/files/2026-07/Pre-Biology%20Major%20%282026-2027%29.pdf) | [Economics B.A. 2025–26 sheet](https://econ.ucsb.edu/sites/default/files/2025-10/Economics%20Major%20%282025%29.pdf) | [L&S B.S. GE](https://catalog.ucsb.edu/pages/9zg5uiQGhSAEWh9bwu5o) · [L&S B.A. GE](https://catalog.ucsb.edu/pages/03lVOj4Ey447GOnP4RhY) | [Degree rules](https://www.duels.ucsb.edu/degree-planning/degree-requirements) · [transfer/IGETC](https://www.duels.ucsb.edu/advising/transfer-student-advising) |
| Santa Cruz | [Biology B.S.](https://catalog.ucsc.edu/en/current/general-catalog/academic-units/physical-and-biological-sciences-division/molecular-cell-and-developmental-biology/biology-bs) | [Economics B.A.](https://catalog.ucsc.edu/en/current/general-catalog/academic-units/social-sciences-division/economics/economics-ba) | [Campuswide GE](https://catalog.ucsc.edu/en/current/general-catalog/undergraduate-information/undergraduate-academic-program/general-education-requirements) · [transfer GE](https://catalog.ucsc.edu/en/current/general-catalog/undergraduate-information/undergraduate-academic-program/credit-for-transfer-students/general-education-for-transfers) | [Graduation](https://catalog.ucsc.edu/en/current/general-catalog/undergraduate-information/undergraduate-academic-program/graduation-requirements) · [University requirements](https://catalog.ucsc.edu/en/current/general-catalog/undergraduate-information/undergraduate-academic-program/university-requirements) |

## Canonical unit audits

These are implementation models, not new catalog claims. “GE” means distinct
GE after the documented major overlap, and “elective” is the derived
UC-transferable capacity that closes the canonical path.

| Campus | Biology: lower major / GE / elective / university-only | Economics: lower major / GE / elective / university-only |
|---|---:|---:|
| Berkeley | 38 / 27 / 19 / 36 = 120 | 14 / 30 / 38 / 38 = 120 |
| Davis | 55 / 40 / 21 / 64 = 180 | 20 / 40 / 56 / 64 = 180 |
| Irvine | 83 / 32 / 26 / 39 = 180 | 20 + 12 School / 32 / 72 / 44 = 180 |
| UCLA | 67 / 35 / 18 / 60 = 180 | 24 / 47 / 49 / 60 = 180 |
| Merced | 51 / 16 / 9 / 44 = 120 | 16 / 20 / 40 / 44 = 120 |
| Riverside | 64 / 36 / 24 / 56 = 180 | 18 / 76 / 32 / 54 = 180 |
| San Diego | 71 / 36 / 13 / 60 = 180 | 20 / 38 / 62 / 60 = 180 |
| Santa Barbara | 59 / 32 / 29 / 60 = 180 | 28 / 38 / 54 / 60 = 180 |
| Santa Cruz | 76 / 32 / 28 / 44 = 180 | 27 / 32 / 76 / 45 = 180 |

## Human-review queue

1. **UCSD residential college:** build a real `ge_variant` selector. Warren is
   an explicit comparison lens, not a campuswide truth. The JSON retains all
   eight official transfer variants.
2. **UCSB combined Biology pin:** confirm the B.S. award is intended. The B.A.
   has different preparation, upper-division, and GE rules and cannot share the
   same template.
3. **Merced Biology practicum:** the catalog says 3–7 units but lists some
   lecture/lab paths that appear to total 8.
4. **UCI Economics:** adjudicate the controlling `ECON 15` table versus the
   sample plan's `ECON 15A + 15B`, and confirm the Social Sciences four-course
   overlap interpretation.
5. **UCR transfer GE:** reconcile current general Cal-GETC language with the
   college pages' older/partial IGETC wording.
6. **Davis BIO transition:** confirm the approved whole-series substitution
   between BIS 2A/B/C and BIO 1/1L/2/2L/3 on a 2026–27 student audit.
7. **Unit/GE overlap:** walk one real audit per campus and adjust only the
   derived GE/elective rows; do not rewrite sourced major blocks to force a
   preferred percentage.

## Reproduce safely

Dry runs resolve course codes and print unresolved current/legacy variants, but
do not write:

```bash
python scripts/import_uc_degree_requirements.py \
  --source scripts/data/uc_degree_requirements_bio.json --dry-run

python scripts/import_uc_degree_requirements.py \
  --source scripts/data/uc_degree_requirements_econ.json --dry-run
```

Production import should happen only after the review queue is signed off and
the corresponding major capability is intentionally enabled.
