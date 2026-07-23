# Major program pins

Which ASSIST programs count as each major, per UC campus. This is the
handoff artifact between W1 Phase 0 (discovery + porting) and Phase 2 (the
`server/config/majors.js` entries). Program strings are recorded **verbatim**
— copy them character-for-character into the config, including any trailing
whitespace, which ASSIST does store.

Plan: `docs/superpowers/plans/2026-07-22-bio-econ-onboarding.md`
Campus set: the nine UC figure campuses configured in
`server/config/majors.js`.

## Status

| Major | Slug | Pins confirmed | Ported | Config entry | Launched |
| --- | --- | --- | --- | --- | --- |
| Computer Science | `cs` | ✅ 9 canonical campus-pins | ✅ 9 pins, 1,035 agreements | ✅ | ✅ |
| Biology | `bio` | ✅ 2026-07-22 | ✅ 9 pins, 1,035 agreements | ✅ | — |
| Economics | `econ` | ✅ 2026-07-22 | ✅ 9 campus-pins (5 strings), 1,035 agreements | ✅ | — |

Research cluster after the canonical-CS cleanup: **27 campus/program pairs,
3,105 agreements** (verified 2026-07-23 06:51 UTC): nine campus-pins and 1,035
agreements each for CS, Biology, and Economics. The twelve retired CS sibling
pairs (1,380 agreements and 9 admissions rows) were removed from active Atlas
data after a durable recovery snapshot was verified.

## Isolation invariant

**Every analysis selects a configured major slug, and the slug resolves to
exact campus/program pairs.** Major title substrings are discovery aids only;
they are never an analysis boundary. Admin visibility and task selections also
cannot change a figure's corpus.

Curation rows follow the same boundary. Newly authored requirements, course
categories, and receiver overrides carry `major_slug`; the CS loaders also
accept missing/null stamps solely for the legacy CS curation that predates that
field. A row stamped `bio`, `econ`, or any future slug cannot enter a CS figure.

This is what makes onboarding safe: adding Biology, Economics, a CS
specialization, or any future major cannot alter an existing CS result unless
the exact `cs.programs` pins themselves are deliberately edited.

## How to read the counts (important)

Every candidate program below carries **exactly 115 agreements** — one per
California community college. ASSIST publishes a page for every CC × program
pair whether or not any course actually articulates, so **agreement count
does not indicate a good or bad pin**. It only catches a typo: a wrong string
returns 0. Pin quality is a curation judgment, and articulation quality only
becomes visible after porting (coverage/credit-loss views).

The two Merced business-economics rows are the sole exception (109 + 6),
because that program is mid-transition between catalog years.

---

## Computer Science (slug: `cs`)

**Doctrine (corrected 2026-07-22): exactly one program per campus.** Earlier
paper ports treated every CS-titled sibling program as one equivalency union.
That made the figures depend on degrees they were not intended to analyze and
made future database additions unsafe. The union doctrine is retired; both
paper-style and current figures use these nine exact pairs.

| UC campus | school_id | **Canonical pin (verbatim)** | Legacy sibling pairs excluded |
| --- | --- | --- | --- |
| UC Berkeley | 79 | `Electrical Engineering & Computer Sciences, B.S.` | Computer Science, B.A. |
| UC Davis | 89 | `Computer Science B.S.` | Computer Science & Engineering B.S. |
| UC Irvine | 120 | `Computer Science, B.S.` | Computer Science and Engineering, B.S. |
| UC Los Angeles | 117 | `Computer Science/B.S.` | Computer Science and Engineering/B.S.; Linguistics and Computer Science/B.A. |
| UC Merced | 144 | `COMPUTER SCIENCE AND ENGINEERING, B.S. ` | Applied Mathematical Sciences, Computer Science Emphasis, B.S. |
| UC Riverside | 46 | `Computer Science, B.S.` | Computer Science with Business Applications B.S. |
| UC San Diego | 7 | `CSE: Computer Science B.S.` | CSE: Computer Science with a Specialization in Bioinformatics B.S.; Mathematics/Computer Science B.S. |
| UC Santa Barbara | 128 | `Computer Science, B.S.` | — |
| UC Santa Cruz | 132 | `Computer Science B.S.` | Computer Science B.A.; Computer Science Minor; Computer Science: Computer Game Design B.S. |

**Pin count: 9 programs, one per campus, 1,035 agreements.** Merced's trailing
space is part of the stored ASSIST name. The twelve excluded campus/program
pairs were removed from active Atlas data and are not alternate inputs to paper
figures.

---

## Biology (slug: `bio`)

**The problem:** unlike CS, no UC offers one obvious "Biology" degree
everywhere. Every campus splits the field — usually into an umbrella
"Biological Sciences"-style degree plus a set of specializations (molecular,
ecology, marine, neuro, micro). Berkeley has no umbrella degree at all.

**Doctrine (decided 2026-07-22): exactly one program per campus** — the
campus's umbrella / general biology degree, taking the **B.S.** where a campus
offers the same degree as both B.A. and B.S. One pin per campus keeps
cross-campus comparison interpretable; the cost is that a campus whose field
is genuinely split (Berkeley) is represented by one half of it.

Specializations (Marine Biology, Neuroscience, Microbiology, Human Biology,
Bioinformatics, etc.) are deliberately **excluded** — they have distinct
lower-division prerequisites and would blur the measure. They remain
available to port later as their own majors if a specialization becomes an
interesting comparison.

| UC campus | school_id | **Pin (verbatim)** | Rationale | Notable alternates left out |
| --- | --- | --- | --- | --- |
| UC Berkeley | 79 | `Molecular and Cell Biology, B.A.` | ⚠ **The one arbitrary call.** Berkeley has no umbrella biology degree — the field is split between MCB and Integrative Biology, both B.A.-only. MCB is the larger department and the standard target for pre-health/bio transfers, and its prerequisite profile (full chem series + bio + physics + calc) is the closest match to the other campuses' general-biology degrees. Flip to `Integrative Biology, B.A.` if the organismal side is the better fit. | Integrative Biology B.A.; Molecular Environmental Biology B.S.; Genetics and Plant Biology B.S.; Microbial Biology B.S.; Chemical Biology B.S.; Neuroscience B.A.; Nutrition & Metabolic Biology B.S. |
| UC Davis | 89 | `Biological Sciences B.S.` | Clean umbrella; B.S. taken over the A.B. | Biological Sciences A.B.; Cell Biology; Genetics & Genomics; Evolution, Ecology & Biodiversity (B.S. + A.B.); Human Biology; Animal Biology; Plant Biology; Global Disease Biology; Neurobiology Physiology & Behavior; Biochemistry & Molecular Biology; Marine & Coastal Science; Wildlife Fish & Conservation Biology; Systems & Synthetic Biology; Molecular & Medical Microbiology (B.S. + A.B.); Biological Systems Engineering |
| UC Irvine | 120 | `Biological Sciences, B.S.` | Clean umbrella. | Developmental and Cell Biology; Ecology and Evolutionary Biology; Genetics; Human Biology; Microbiology and Immunology; Neurobiology; Biochemistry and Molecular Biology; Physiology and Exercise Sciences; Biology/Education |
| UC Los Angeles | 117 | `Biology/B.S.` | Clean umbrella. | Molecular Cell and Developmental Biology; Ecology Behavior and Evolution; Marine Biology; Microbiology Immunology and Molecular Genetics; Computational Biology; Neuroscience; Physiological Science; Psychobiology; Human Biology and Society (B.A. + B.S.) |
| UC Merced | 144 | `BIOLOGICAL SCIENCES, General Biology Emphasis, B.S.` | Merced models emphases under one degree; "General Biology" is the umbrella emphasis. | BIOLOGICAL SCIENCES B.A.; the Molecular and Cell / Developmental / Human Biology / Microbiology and Immunology emphases; ECOLOGY EVOLUTION AND CONSERVATION BIOLOGY (2 rows); the NEUROSCIENCE family (transfer starts Fall 2027) |
| UC Riverside | 46 | `Biology, B.A. or B.S.` | Clean umbrella. **One ASSIST row that names both awards** — a single pin, not two. | Cell Molecular and Developmental Biology; Microbiology; Neuroscience; Plant Biology |
| UC San Diego | 7 | `Biology: General Biology B.S.` | UCSD prefixes every biology degree `Biology:`; "General Biology" is the umbrella. | Biology: Molecular and Cell Biology; Ecology Behavior and Evolution; Human Biology; Microbiology; Neurobiology; Bioinformatics specialization; Marine Biology |
| UC Santa Barbara | 128 | `Biological Sciences, B.A. & B.S.` | Clean umbrella. **One ASSIST row that names both awards** — a single pin, not two. | Molecular and Cellular Biology B.S. + its 4 emphases; Aquatic Biology; Ecology and Evolution; Physiology; Creative Studies – Biology |
| UC Santa Cruz | 132 | `Biology B.S.` | Umbrella; B.S. taken over the B.A. | Biology B.A.; Molecular Cell and Developmental Biology; Ecology and Evolution; Marine Biology; Microbiology; Neuroscience; Biochemistry and Molecular Biology; Biomolecular Engineering and Bioinformatics; Agroecology; Biology Minor |

**Pin count: 9 programs, one per campus.**
Config `match` string: `biolog` (verified — every pin contains it
case-insensitively, including Berkeley's "Molecular and Cell Biology" and
Davis's "Biological Sciences").

---

## Economics (slug: `econ`)

Clean by comparison: every campus offers one flagship Economics degree, and
the specializations are obvious business/quantitative variants that are easy
to exclude.

**Doctrine (decided 2026-07-22): exactly one program per campus** — the
flagship Economics degree, excluding business-economics,
management-economics, joint math-economics, and policy/area-studies variants
(all carry different lower-division math and business prerequisites). At every
UC the flagship is the B.A. (economics is a letters-and-science degree
system-wide), so "flagship only" resolves to the B.A. everywhere.

| UC campus | school_id | **Pin (verbatim)** | Notable alternates left out |
| --- | --- | --- | --- |
| UC Berkeley | 79 | `Economics, B.A.` | Political Economy B.A.; Environmental Economics and Policy B.S. |
| UC Davis | 89 | `Economics A.B.` | Managerial Economics B.S. |
| UC Irvine | 120 | `Economics, B.A.` | Quantitative Economics B.A.; Business Economics B.A. |
| UC Los Angeles | 117 | `Economics/B.A.` | Business Economics/B.A.; Mathematics/Economics/B.S. |
| UC Merced | 144 | `ECONOMICS, B.A.` | ECONOMICS Quantitative Economics Emphasis B.S.; ECONOMICS Economic Analysis and Policy Emphasis B.S.; MANAGEMENT AND BUSINESS ECONOMICS B.S.; APPLIED MATHEMATICAL SCIENCES Economics Emphasis B.S.; the two BUSINESS ADMINISTRATION Financial Economics rows |
| UC Riverside | 46 | `Economics, B.A.` | Business Economics B.A.; Economics/Administrative Studies B.A. |
| UC San Diego | 7 | `Economics B.A.` | Economics B.S. (calculus-heavier); Economics: Business Economics B.S.; Economics/Mathematics joint majors (2 rows); International Studies – Economics; Sociology/Economy and Society; Business Economics B.S. (Rady) |
| UC Santa Barbara | 128 | `Economics, B.A.` | Economics and Accounting B.A. |
| UC Santa Cruz | 132 | `Economics B.A.` | Business Management Economics B.A. (+ Accounting concentration); Global Economics B.A.; Economics/Mathematics Combined B.A.; Environmental Studies/Economics Combined B.A.; Economics Minor |

**Pin count: 9 programs, one per campus.**
Config `match` string: `econom` (verified against every pin).

### Open note

**Merced** — `ECONOMICS, B.A.` is the flagship, but Merced's quantitative /
policy B.S. emphases may be the more common transfer target there. Worth a
look at Merced advising pages at some point; not a blocker for porting, since
`port.py remove --exact` cleanly undoes a pin.

---

## Exact-pair query rule

The `match` strings (`computer science`, `biolog`, and `econom`) remain useful
for search and import discovery. They are deliberately insufficient for
analysis. All website and local-visual requests pass a `majorSlug`; the server
resolves it through `server/config/majors.js` to an `$or` of exact
`(uc_school_id, major)` pairs. The standalone Python paper calculations carry
the same nine exact CS pairs in `analysis/major_pins.py` and test the full
query shape.

Do not restore title-substring filtering as a fallback. A missing or unknown
major slug should fail clearly instead of broadening the dataset.

## Port log

Executed 2026-07-22 via `python port.py add --exact "<program>" --yes`, run
from `scripts/`. 14 commands cover 18 campus-pins because four campuses share
the verbatim string `Economics, B.A.` and two share `Economics B.A.`
(`--exact` is a case-sensitive equality match, so Merced's
`ECONOMICS, B.A.` stayed a separate command).

| # | Major | Program string (verbatim) | Campuses | Result |
| --- | --- | --- | --- | --- |
| 1 | bio | `Molecular and Cell Biology, B.A.` | UCB | ✅ 115 |
| 2 | bio | `Biological Sciences B.S.` | UCD | ✅ 115 |
| 3 | bio | `Biological Sciences, B.S.` | UCI | ✅ 115 |
| 4 | bio | `Biology/B.S.` | UCLA | ✅ 115 |
| 5 | bio | `BIOLOGICAL SCIENCES, General Biology Emphasis, B.S.` | UCM | ✅ 115 |
| 6 | bio | `Biology, B.A. or B.S.` | UCR | ✅ 115 |
| 7 | bio | `Biology: General Biology B.S.` | UCSD | ✅ 115 |
| 8 | bio | `Biological Sciences, B.A. & B.S.` | UCSB | ✅ 115 |
| 9 | bio | `Biology B.S.` | UCSC | ✅ 115 |
| 10 | econ | `Economics, B.A.` | UCB, UCI, UCR, UCSB | ✅ 460 (115 each) |
| 11 | econ | `Economics A.B.` | UCD | ✅ 115 |
| 12 | econ | `Economics/B.A.` | UCLA | ✅ 115 |
| 13 | econ | `ECONOMICS, B.A.` | UCM | ✅ 115 |
| 14 | econ | `Economics B.A.` | UCSD, UCSC | ✅ 230 (115 each) |

**0 failures.** All 18 campus-pins verified present in the canonical
`assist_agreements` collection at 115 agreements each (one per community
college — see the counts note above). Catalogs re-synced: 100,461 sending
courses, 3,903 receiving courses. `admissions` grew 18 → 34.

## ⚠ Hazard: port.py wipes curated college profiles

`port.py add` copies `community_colleges` and `uc_schools` wholesale from the
source PMT cluster, then rebuilds `assist_institutions` from them. The curated
**district / region / counties_served** fields live only in the research
cluster (they were entered through the console and the districts importer), so
the source has none and **every port erases them**.

Nothing warns you. The collections still have the right document counts; the
fields are simply empty. Everything that groups by district then silently
collapses — the district heatmap, the coverage histogram, the California map,
and the income-access figures all render blank or all-zero, on local *and*
deployed, because they share this cluster.

**After every `port.py add` / `refresh-catalogs`, re-run:**

```bash
cd scripts && python import_cc_districts.py
```

Then confirm before trusting any district figure:

```
115 of 115 community colleges with a district · 72 distinct districts
```

This happened on 2026-07-22 during the bio/econ port and was diagnosed only
after the figures broke. A post-port integrity check that counts agreements and
courses is **not** sufficient — it must also check institution profile fields.

## What happens next

Discovery, porting, and the code-configured major dimension are complete.
Remaining W1 phases are in
`docs/superpowers/plans/2026-07-22-bio-econ-onboarding.md`:

- **Canonical cleanup (complete 2026-07-23 UTC):** removed the twelve excluded
  CS pairs with `port.py remove-pairs`. Recovery manifest
  `major-pair-removal-20260723T065112846564Z-e9fa871f` is complete and holds
  1,380 agreements, 9 admissions rows, and the pre-removal settings document.
- **Phase 3:** category + concept curation, so the gap figures render.
- **Phase 4:** 18 degree templates (9 campuses × 2 majors).
- **Phase 5:** QA sweep and per-major sign-off.

**Deferred:** Task 0.4 (seeding the W4 preset tracking tasks) waits for the
W4 branch to merge — the `general` task type and preset library don't exist
yet. Do it as soon as W4 lands.

**Removal safety:** always run
`python port.py remove-pairs --pair "<school_id>=<program>" --dry-run` first,
then repeat without `--dry-run` and with `--yes` only after the exact counts
match the intended scope. The command creates a recovery backup before
rebuilding. Curated data and audit verdicts remain outside the deletion set.
