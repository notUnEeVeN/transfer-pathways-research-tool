# Biology course types — the taxonomy behind MA Figure 2 and CA Figure 5

> Design record, July 23 2026. Written before implementation; the results
> sections in `ma-course-type-spread.md` and `paper-course-barriers.md` are
> updated once the figures run.

## Why Biology needs its own rules

`services/courseTypes.js` types a requirement by the four-year's own course
code, which is the MA paper's rule. Its prefix sets and text rules were written
against the nine computer science templates, and its fallthrough is Non-STEM.
Pointed at Biology it would put chemistry, biology and physics into one
`science` bucket and drop `LIFESCI`, `MCELLBI`, `BILD`, `EEMB` and `MCDB` into
Non-STEM, because those prefixes were never needed for computer science.

Biology's graduation templates are also shaped differently. Across all nine
pinned programs they contain biology core, chemistry, calculus and supporting
science, and the largest block is **not** the major's own discipline:

| Discipline | Course references across the nine templates |
| --- | ---: |
| Chemistry (`CHEM`, `CHE`, `CHEM H`) | 87 |
| Physics (`PHYS`, `PHYSICS`, `PHY`) | 55 |
| Biology (`BIO`, `BIOL`, `BILD`, `BIS`, `LIFESCI`, `MCDB`, `EEMB`, `BIO SCI`) | ~45 |
| Math (`MATH`, `MAT`) | 45 |
| Statistics (`STAT`, `STATS`, `PSTAT`) | 8 |
| Computing (`CSE`, `DSC`) | 4 |

A biology major's heaviest lower-division dependency is a discipline they do
not major in. That is the finding the taxonomy has to be able to express.

## One taxonomy, three resolutions

Fine categories are the unit of typing. Both figures roll them up; nothing is
typed twice.

```
Fine category     bio_series │ gen_chem · organic_chem │ physics │ calculus · statistics │ computing │ non_stem
Extended axis     Biology    │ Chemistry               │ Physics │ Math                  │ Computing │ Non-STEM
Faithful axis     Biology    │ Chemistry & Physics ─────────────┤ Math ─────────────────────────────┤ Non-STEM
```

- **CA Figure 5** keeps the source figure's six-panel vocabulary: intro
  biology, general chemistry, organic chemistry, calculus, statistics, and
  physics. Its requirement denominator is not the graduation template above.
  It reads unavoidable transfer-admission groups from ASSIST; a category that
  appears only as an optional alternative or recommended preparation is gray.
- **MA Figure 2, faithful** plots the four faithful axes. Four columns, mapping
  one-to-one onto the computer science figure's Computing / Math / Science /
  Non-STEM: own discipline, quantitative, supporting science, everything else.
- **MA Figure 2, extended** plots the six extended axes.

### Where the judgment lives

The extended axes contain **no judgment calls** — every column is a literal
prefix family. Both merges live in the faithful rollup, and only there:

1. **`computing` → Math.** Merced (`CSE`) and UCSD (`DSC`) are the only
   programs requiring any computing, four course references total. They are
   quantitative-methods requirements, and the MA paper has precedent for
   exactly this kind of documented override — discrete math is always math
   despite carrying computer science codes. Folding them to Non-STEM would be
   wrong; a fifth faithful column for four references would not be worth it.
2. **`gen_chem`, `organic_chem`, `physics` → Chemistry & Physics.** This is the
   slot computer science fills with Science. The label is concrete rather than
   "Science" because those two disciplines are all that is in it.

The faithful view is the default, and it is left otherwise untouched: no added
annotation, no extra marks, same geometry as the port. The four-column rollup
necessarily hides that Chemistry & Physics is most of the degree — the extended
view is where that becomes visible, as a column that exists rather than as a
footnote on a ported figure.

### Organic chemistry is not a group-level split

At Berkeley, UCLA and UCSD organic chemistry sits inside a combined chemistry
requirement group (`CHEM 3A`, `CHEM 14C`, `CHEM 40A`), so a category cannot be
assigned by reading a group title. Typing happens at the **receiver** level,
against the university course code — which is what `buildDegreeGroups`'
`categoryOf` callback already does.

## Prefix families

Every prefix appearing in the nine templates is assigned. The Non-STEM
fallthrough is retained for GE and writing codes, and a test asserts that no
course in any of the nine templates reaches it by accident — otherwise a
missing prefix silently becomes a Non-STEM requirement.

| Fine category | Prefixes / rules |
| --- | --- |
| `bio_series` | `BIO`, `BIOL`, `BIOLOGY`, `BILD`, `BIS`, `BIO SCI`, `LIFESCI`, `MCELLBI`, `MCDB`, `EEMB`, `BIOE` |
| `gen_chem` | Chemistry prefixes, course number outside the organic series |
| `organic_chem` | Chemistry prefixes matching the campus organic series |
| `physics` | `PHYS`, `PHYSICS`, `PHY` |
| `calculus` | `MATH`, `MAT`, `AM` |
| `statistics` | `STAT`, `STATS`, `PSTAT`, and statistics-named math courses |
| `computing` | `CSE`, `DSC`, `CS` |
| `non_stem` | fallthrough: GE, writing, breadth, electives |

Berkeley's pin is Molecular and Cell Biology, so `MCELLBI` is an own-discipline
prefix, not a general science one.

## What this does not unlock

`category-gaps` reads **curated** per-course category tags from the audit
database (`categoryOfReceiver` returns `null` for an untagged receiver, and the
figure pins those into an `Untagged` row). That is a different mechanism from
the rule-based receiver typing above. Biology's `courseCategories` capability
stays false until a tagging pass is done; this taxonomy does not substitute for
it.

## ASSIST does not state requirements only as courses

UC Irvine publishes its entire biology math requirement as ONE named ASSIST
block — `"Mathematics Requirement"`, `kind: 'requirement'`, no course id —
articulated at 114 of the 115 colleges. The curated template lists the same
requirement as course ids (MATH 5A/5B, 2A/2B, 2D, 3A, STATS 7, STATS 8).
Coverage matches ids to ids, so the two never met and the whole discipline read
as 0% at every college.

Two mechanisms now handle this, and they are deliberately separate:

1. **A declared link.** A template group may carry `assist_requirement: '<block
   name>'`. Where that block is articulated, the group's sections count as
   covered. The link is declared, never inferred by fuzzy title matching — if
   ASSIST renames a block the group returns to uncovered and check 2 catches it,
   rather than a matcher quietly pairing the wrong two things.

2. **A not-modelable flag.** Every coverage row carries
   `degree_groups_not_modelable`: the requirement groups that cleared zero slots
   at *every* college. That pattern is almost never a finding — it is the
   signature of a representation the model cannot see. `nontransferable` groups
   are excluded, because upper-division and residency work is 0% by
   construction and that is a structural truth, not a modelling failure.

The distinction that matters, and the reason neither mechanism touches the
denominator: **a genuinely required course with no articulation is a finding** —
ASSIST says it is required, so the student takes it at the university, and that
is worth measuring. Only an unarticulated *alternative* inside a satisfiable
choice must not count, and `buildDegreeGroups` already handles that by using the
section's `ask` as its denominator rather than the number of options.

A declared link may name one block or several. Several means a COMBINATION:
all must be articulated. Berkeley accepts a community college's introductory
physics sequence as the alternative to its own PHYSICS 7A/7B/7C only in its
entirety, and ASSIST publishes that as three separate Level blocks — a college
carrying two of the three has not completed the alternative. A link may also be
declared on a single RECEIVER rather than a group, for the case where a campus
states one course of a section as a block and the rest by id.

`scripts/import_uc_degree_requirements.py` carries these fields through to the
stored document, so the links live in versioned source rather than only in the
database.

## Figure 5 and the district heatmap use the raw ASSIST tree

The Biology/Economics port initially reused
`degree_requirements_by_course_category`. That field is appropriate for MA
Figure 2, which asks about progress toward graduation, but it is the wrong
input for CA Figure 5 and the ASSIST district heatmap.

All three majors now use the same path. For each college, the analysis passes
that agreement's complete `requirement_groups` array to the strict PMT
eligibility predicates. PMT's own truthy `is_required` filter decides which
groups count. The analysis does not substitute a modal campus template, remove
receivers through curation, apply a campus course allowlist, trim a series, or
credit an articulation found in another major. In a multi-college district,
the only pooling is PMT's native cross-college match on the exact receiving-side
`hash_id`.

Figure 5 categorizes the same raw required tree. Non-category requirements are
held satisfied while one category is tested, so the panel isolates that
category without changing the program's requirement logic. A business-calculus
**or** engineering-calculus choice therefore allows either complete route; a
biology **or** physics choice does not make both categories independently
required.

This deliberately exposes source-data problems instead of silently correcting
them. If an ASSIST document marks recommended preparation as `is_required`, the
strict result will treat it as required. The repair belongs in the ingestion or
source classification, with provenance, rather than in a Biology/Economics-only
visual rule. Computed analysis responses are not persisted in browser storage,
inactive coverage snapshots are discarded on navigation, and the query key is
versioned whenever this method changes.

### Named-block audit results

Every named block in the corpus, swept across all 131 template clusters:

| Campus / major | Block(s) | Link | Effect |
| --- | --- | --- | ---: |
| UC Irvine, biology | `Mathematics Requirement` | group | 0.0% -> 99.1% |
| UCLA, computer science | `Computer programming courses: C++ preferred` | receiver (`COM SCI 31`) | 40.0% -> 42.1% |
| UC Berkeley, computer science | Level I + II + III Physics | group, combination | 92.6% -> 97.0% |
| Berkeley R&C A/B, UCLA English composition, UC Irvine social science | — | none needed | already 100% via the IGETC fallback |

Running the zero-everywhere check across Computer Science found one group with
the same signature — UC San Diego's `Lower-division elective — one course
(checklist also allows any CSE upper-division course)`. Untriaged.
