# Major program pins

Which ASSIST programs count as each major, per UC campus. This is the
handoff artifact between W1 Phase 0 (discovery + porting) and Phase 2 (the
`server/config/majors.js` entries). Program strings are recorded **verbatim**
— copy them character-for-character into the config, including any trailing
whitespace, which ASSIST does store.

Plan: `docs/superpowers/plans/2026-07-22-bio-econ-onboarding.md`
Campus set: the nine figure campuses (the `PAPER_MAJORS` keys in
`server/services/analysis/pathways.js`).

## Status

| Major | Slug | Pins confirmed | Ported | Config entry | Launched |
| --- | --- | --- | --- | --- | --- |
| Computer Science | `cs` | ✅ (historical) | ✅ 18 programs, 2,415 agreements | pending F | ✅ |
| Biology | `bio` | ⏸ awaiting Tybalt | — | — | — |
| Economics | `econ` | ⏸ awaiting Tybalt | — | — | — |

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

## Biology (slug: `bio`)

**The problem:** unlike CS, no UC offers one obvious "Biology" degree
everywhere. Every campus splits the field — usually into an umbrella
"Biological Sciences"-style degree plus a set of specializations (molecular,
ecology, marine, neuro, micro). Berkeley has no umbrella degree at all.

**Recommended doctrine — the umbrella degree per campus** (the closest analog
to "Computer Science B.S."): pin the campus's general/undifferentiated
biology degree, and where the campus offers the same degree as both B.A. and
B.S., pin both. Berkeley is the documented exception: its field is split
between Integrative Biology and Molecular & Cell Biology with no umbrella, so
it needs both — exactly the situation that forced two pins at Berkeley for CS
(CS B.A. + EECS B.S.).

Specializations (Marine Biology, Neuroscience, Microbiology, Human Biology,
Bioinformatics, etc.) are deliberately **excluded** — they have distinct
lower-division prerequisites and would blur the measure. They remain
available to port later as their own majors if a specialization becomes an
interesting comparison.

| UC campus | school_id | **Recommended pin(s)** | Rationale | Notable alternates left out |
| --- | --- | --- | --- | --- |
| UC Berkeley | 79 | `Integrative Biology, B.A.` **and** `Molecular and Cell Biology, B.A.` | No umbrella biology degree exists; these two are the field's halves. Mirrors the CS/EECS two-pin precedent at this campus. | Molecular Environmental Biology B.S.; Genetics and Plant Biology B.S.; Microbial Biology B.S.; Chemical Biology B.S.; Neuroscience B.A.; Nutrition & Metabolic Biology B.S. |
| UC Davis | 89 | `Biological Sciences B.S.` **and** `Biological Sciences A.B.` | Clean umbrella, offered as both B.S. and A.B. | Cell Biology; Genetics & Genomics; Evolution, Ecology & Biodiversity (B.S. + A.B.); Human Biology; Animal Biology; Plant Biology; Global Disease Biology; Neurobiology Physiology & Behavior; Biochemistry & Molecular Biology; Marine & Coastal Science; Wildlife Fish & Conservation Biology; Systems & Synthetic Biology; Molecular & Medical Microbiology (B.S. + A.B.); Biological Systems Engineering |
| UC Irvine | 120 | `Biological Sciences, B.S.` | Clean umbrella. | Developmental and Cell Biology; Ecology and Evolutionary Biology; Genetics; Human Biology; Microbiology and Immunology; Neurobiology; Biochemistry and Molecular Biology; Physiology and Exercise Sciences; Biology/Education |
| UC Los Angeles | 117 | `Biology/B.S.` | Clean umbrella. | Molecular Cell and Developmental Biology; Ecology Behavior and Evolution; Marine Biology; Microbiology Immunology and Molecular Genetics; Computational Biology; Neuroscience; Physiological Science; Psychobiology; Human Biology and Society (B.A. + B.S.) |
| UC Merced | 144 | `BIOLOGICAL SCIENCES, General Biology Emphasis, B.S.` | Merced models emphases under one degree; "General Biology" is the umbrella emphasis. | BIOLOGICAL SCIENCES B.A.; the Molecular and Cell / Developmental / Human Biology / Microbiology and Immunology emphases; ECOLOGY EVOLUTION AND CONSERVATION BIOLOGY (2 rows); the NEUROSCIENCE family (transfer starts Fall 2027) |
| UC Riverside | 46 | `Biology, B.A. or B.S.` | Clean umbrella (single row covers both awards). | Cell Molecular and Developmental Biology; Microbiology; Neuroscience; Plant Biology |
| UC San Diego | 7 | `Biology: General Biology B.S.` | UCSD prefixes every biology degree `Biology:`; "General Biology" is the umbrella. | Biology: Molecular and Cell Biology; Ecology Behavior and Evolution; Human Biology; Microbiology; Neurobiology; Bioinformatics specialization; Marine Biology |
| UC Santa Barbara | 128 | `Biological Sciences, B.A. & B.S.` | Clean umbrella (single row covers both awards). | Molecular and Cellular Biology B.S. + its 4 emphases; Aquatic Biology; Ecology and Evolution; Physiology; Creative Studies – Biology |
| UC Santa Cruz | 132 | `Biology B.S.` **and** `Biology B.A.` | Umbrella offered as both awards; matches the CS precedent here (B.A. + B.S. both pinned). | Molecular Cell and Developmental Biology; Ecology and Evolution; Marine Biology; Microbiology; Neuroscience; Biochemistry and Molecular Biology; Biomolecular Engineering and Bioinformatics; Agroecology; Biology Minor |

**Recommended pin count: 13 programs across 9 campuses.**
Config `match` string: `biolog` (verified — every recommended pin contains it
case-insensitively, including Berkeley's "Molecular and Cell Biology" and
Davis's "Biological Sciences").

### Judgment calls for Tybalt

1. **Berkeley two-pin** — Integrative Biology + MCB, or just one? Choosing one
   biases the campus toward either the organismal or molecular prerequisite
   chain (MCB is chem-heavy; IB less so).
2. **B.A./B.S. pairs** (Davis, Santa Cruz) — pin both, or B.S. only? The CS
   precedent pins both where they exist.
3. **Merced emphasis model** — is "General Biology Emphasis" the right stand-in
   for an umbrella, or should the B.A. also come along?

---

## Economics (slug: `econ`)

Clean by comparison: every campus offers one flagship Economics degree, and
the specializations are obvious business/quantitative variants that are easy
to exclude.

**Recommended doctrine — the flagship Economics degree per campus**, excluding
business-economics, management-economics, joint math-economics, and
policy/area-studies variants (all carry different lower-division math and
business prerequisites).

| UC campus | school_id | **Recommended pin(s)** | Notable alternates left out |
| --- | --- | --- | --- |
| UC Berkeley | 79 | `Economics, B.A.` | Political Economy B.A.; Environmental Economics and Policy B.S. |
| UC Davis | 89 | `Economics A.B.` | Managerial Economics B.S. |
| UC Irvine | 120 | `Economics, B.A.` | Quantitative Economics B.A.; Business Economics B.A. |
| UC Los Angeles | 117 | `Economics/B.A.` | Business Economics/B.A.; Mathematics/Economics/B.S. |
| UC Merced | 144 | `ECONOMICS, B.A.` | ECONOMICS Quantitative Economics Emphasis B.S.; ECONOMICS Economic Analysis and Policy Emphasis B.S.; MANAGEMENT AND BUSINESS ECONOMICS B.S.; APPLIED MATHEMATICAL SCIENCES Economics Emphasis B.S.; the two BUSINESS ADMINISTRATION Financial Economics rows |
| UC Riverside | 46 | `Economics, B.A.` | Business Economics B.A.; Economics/Administrative Studies B.A. |
| UC San Diego | 7 | `Economics B.A.` **and** `Economics B.S.` | Economics: Business Economics B.S.; Economics/Mathematics joint majors (2 rows); International Studies – Economics; Sociology/Economy and Society; Business Economics B.S. (Rady) |
| UC Santa Barbara | 128 | `Economics, B.A.` | Economics and Accounting B.A. |
| UC Santa Cruz | 132 | `Economics B.A.` | Business Management Economics B.A. (+ Accounting concentration); Global Economics B.A.; Economics/Mathematics Combined B.A.; Environmental Studies/Economics Combined B.A.; Economics Minor |

**Recommended pin count: 10 programs across 9 campuses.**
Config `match` string: `econom` (verified against every recommended pin).

### Judgment calls for Tybalt

1. **UCSD B.A. + B.S.** — pin both, or B.A. only? They differ in required
   math (the B.S. is calculus-heavier), which is exactly the kind of variation
   the complexity measure would surface.
2. **Merced** — `ECONOMICS, B.A.` is the flagship, but Merced's B.S. emphases
   may be the more common transfer target. Worth a look at Merced's advising
   pages before locking.

---

## Match-string safety note (for the F implementer)

Both `match` strings work **because the research cluster only ever holds
pinned programs** — `port.py` copies nothing else, so a contains-match on
`biolog` / `econom` can only hit pinned rows. This is the same property that
makes CS's `computer science` match safe today.

If a future port ever brings in a non-pinned program containing those
substrings (say Marine Biology for a separate comparison), the contains
filter would leak. The durable fix, if that day comes, is to filter by the
config's `programs` pins with an `$in` clause — the machinery already exists
as `paperMajorsQuery` in `server/services/analysis/pathways.js`.

## Port log

Filled in during Phase 0 Task 0.3, after pins are confirmed.

| Date | Major | Command | Result |
| --- | --- | --- | --- |
| | | | |
