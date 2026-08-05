# California prerequisite mapping — verification handoff

**Artifacts:** `scripts/data/prereq_concepts.json` and `scripts/data/course_concepts.json`
**Current scope:** exact configured California ASSIST programs for Computer Science, Biology, and Economics
**Virginia:** stored in separate Virginia mapping/requisite artifacts; only the semantic vocabulary is shared

## Current artifact

- 57 shared prerequisite concepts; 38 carry prerequisite requirements and four carry
  combined-course `satisfies` links. The California
  mapping counts below are unchanged; Virginia added three precalculus concepts and Managerial
  Accounting because its published course chains extend below/alongside the California scope.
- 6,696 unique catalog course rows: 5,732 mapped to a concept and 964 examined-null.
- The Biology/Economics expansion adds exactly 1,966 catalog-present rows: 1,223 mapped and 743 examined-null.
- 34 stale/phantom ASSIST option IDs have no sending-course catalog record and are intentionally omitted.
- Every catalog-present course referenced by the three configured majors now has one artifact row. The only unexamined IDs are those 34 phantoms.

The expansion can be reproduced read-only from the exact configured program pins:

```bash
cd server
node scripts/buildPrereqMajorExpansion.js
```

Pass `--write` only when intentionally rebuilding the generated 1,966-row slice. Existing CS-era rows are preserved; generated expansion rows are replaced idempotently.

## What partners should verify first

In **Data → Prerequisites → Mapping**, choose Biology or Economics, select a college, and use **Flagged only**. There are 76 expansion rows in this queue. The flags and confidence are intentionally visible; this is a verification-ready first pass, not a claim of catalog-level certainty.

The six rows below are deliberately unassigned (`confidence: 0`) because the available title/receiver evidence does not select one concept:

| course ID | college | title |
|---:|---|---|
| 150435 | cc:124 | Biochemistry and Molecular Biology |
| 279688 | cc:65 | Biochemistry and Molecular Biology |
| 292700 | cc:104 | Molecular Biology/Genetics |
| 304010 | cc:139 | Genetics and Molecular Biology |
| 353121 | cc:56 | General Physics |
| 353536 | cc:56 | General Physics |

The rest of the flagged queue is dominated by partial lecture/lab or calculus-supplement courses, short organic/biochemistry surveys, and titles whose number/receiver context was needed to infer sequence position.

## Deliberate examined-null decisions

- 700 courses appear only through UC Irvine's broad “Introductory Social Science courses in disciplines other than Economics” menu and do not form a recurring prerequisite chain. They are stamped examined-null rather than creating dozens of disconnected concepts.
- 14 explicit non-structural rows cover finite/business mathematics and laboratory-methodology one-offs.
- Other examined-null rows retain unanimous prior null classifications or have no stable recurring family. They remain searchable in Mapping.

Direct UC Merced receivers for Introduction to Psychology, American Government, and Sociology do receive their own leaf concepts. Those explicit receivers take precedence over the broad UCI menu.

## New normative concept decisions

- `bio_genetics` requires `bio_cell_molec`.
- `biochemistry` requires `gen_chem_2`; Organic Chemistry is common but not shared by every articulated variant.
- `molecular_biology` requires `bio_genetics`.
- `organic_chem_survey_1` starts after `gen_chem_1`; its second course is distinct from the full science-majors organic sequence.
- `organic_biochem_survey` models one-course allied-health combinations and satisfies the first survey-organic step, not science-majors Organic Chemistry/Biochemistry.
- `intro_data_science`, `intro_psychology`, `intro_american_government`, and `intro_sociology` are roots.
- `econ_intro_combined` satisfies both introductory microeconomics and macroeconomics.

These are statewide normative approximations derived from ASSIST receiver targets and sending titles. The source catalog does not include local prerequisite prose, so partner edits in Mapping remain the authoritative correction mechanism.

## Validation gates

Before import/deployment:

1. Run `python3 scripts/import_course_concepts.py --dry-run` (DAG, references, unique course IDs, confidence, and institution IDs).
2. Review the 76 flagged expansion rows and record decisions through the Mapping editor or in the artifact.
3. Spot-check at least one Biology and one Economics graph at 2–3 colleges, including a college with prerequisite-only closure nodes.
4. Record a seeded random sample size/error rate in `course_concepts.json.meta` after partner review.
5. Import to the target database only with explicit deployment authorization; the builder itself is read-only unless `--write` is passed.

The previous CS-era `sample_error_rate` was never filled in. The metadata remains `null` rather than inventing a verification result.
