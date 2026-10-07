# Virginia evidence for the paper-planning discussion

September 7, 2026. Scope: the Massachusetts Figure 1–6 family, with special attention to Virginia's guide-based Figures 1, 3 and 4. This is an analysis of the current frozen artifacts, not a production change or a student-outcome study.

Virginia provides a strong example of an intentionally coordinated transfer architecture. Its guide-based results are consistent with a substantial advantage in preserving planned credit. The strongest defensible question is **how much of the intended pathway is available, and what explains the remaining gap?** The present data do not support a causal state ranking or an assertion that every actual Virginia associate degree transfers this well.

## What the policy evidence supports

The collaboration premise is real. VCCS describes faculty and staff from its colleges and senior institutions iterating on common curricula; it dates the Transfer VA initiative to 2018. This establishes a documented mechanism to investigate, rather than proof that the mechanism caused the numerical state difference. [VCCS account, February 26, 2024](https://www.vccs.edu/blog/common-curriculum-pathways-improve-transfer-experience-for-virginia-community-college-students/).

The official administrative site says colleges offering a discipline as a degree or major must adopt its common curriculum. It lists CS implementation in Fall 2023 and a Fall 2026 version following review. Colleges without the credential are encouraged to offer an advising pathway, so our seven-college no-CS group is an exposure sensitivity rather than proof that students there cannot transfer. [Approved common curricula](https://sites.google.com/email.vccs.edu/tvacollab/cc-and-course-development/tr-cc-disciplines-approved).

Standardization covers course content as well as numbering: the official computing outlines identify the statewide standardization process and common programming sequence. It does not imply identical delivery: the CSC 221 description permits institutions to choose a programming language suited to their receiving partner. [VCCS computing course outlines](https://courses.vccs.edu/courses/CSC/contents). The official common-curriculum workbook also contains choices, credit ranges and GE categories; it is not one fixed transcript shared by every student. [Fall 2023 CS common curriculum](https://docs.google.com/spreadsheets/d/1lM0t9vPGyyusbzpQM1PZpLAa0iRjgx1tt7NJJHfHaL0/edit?gid=0).

Passport and UCGS provide structured GE transfer protection. UCGS requires ten courses across seven blocks, and official guidance still advises choosing courses suited to the intended four-year program. [Transfer VA Passport/UCGS guidance](https://sites.google.com/email.vccs.edu/tvacollab/passport-and-ucgs). Guaranteed admission separately depends on associate-degree and eligibility requirements, with programs and institutions varying. [VCCS transfer guidance](https://www.vccs.edu/transfer-programs/), [SCHEV Transfer Virginia overview](https://www.schev.edu/home/showpublisheddocument/3217/638307185678330000).

All policy links were checked during this work. Several direct Transfer Virginia guide pages and VCCS course-page URLs returned 403; numerical claims below use the locally captured official pages and derived artifacts. Search returned the official current VCCS computing-outline text, including the CSC 221 effective date and credits, while a subsequent direct open returned 403.

## Three issues to resolve before precise state comparisons

**Credit-source vintages disagree.** Fourteen of the 15 selected guides list CSC 221 as three credits, while all 22 local college catalogs carrying it list four. The official outline reports four credits effective August 1, 2026. ODU additionally lists CSC 205 as four credits versus three in all 19 captured catalogs carrying it. A narrow check of fixed-credit, single-code rows yields 15 disagreeing guide rows across 14 guides, repeated across 327 college-row observations in the full college set. The builder uses guide credit quantities and catalog membership, not actual catalog credit quantities. This does not establish an extra lost credit per student: sending credits earned, credits accepted, receiving requirement credits, and the chosen degree year's totals must be reconciled separately. It establishes why **switching to units increases precision only after reconciling what the units mean**. See [credit-conflict inventory](../analysis/results/paper_planning/va_single_code_credit_conflicts.csv).

**The scheduled supply window differs between colleges.** Inspection of the 16 CS colleges' cached CSC pages found five with only Fall 2026 enabled, six with Fall plus Spring 2027, four with all three terms, and one with Fall plus Summer 2027. Southwest Virginia, Central Virginia and Paul D. Camp expose only Fall; their large calculated gaps cannot be read as proof of two-year unavailability. The current toggle is a useful data-quality and temporal sensitivity, but its institutional ranking is confounded by the window the source exposes. See [term-control evidence, with cache hashes](../analysis/results/paper_planning/va_schedule_term_evidence.json).

**Not every parsed named row is a mandatory course.** Bridgewater's pre-transfer row says “Consider CSC 205 or CSC 215,” carries 5–12 credits, and lands as electives. The current join treats the row as 12 mandatory credits and marks all 12 missing at seven CS colleges in the scheduled version. This contributes 84 of 1,417 missing credit observations (5.9%) in that variant. It has no default-catalog effect. Before featuring Bridgewater's scheduled case, establish which credits are genuinely required and whether ordinary elective choices remain available. This is an unresolved row interpretation, not a recalculated correction.

These findings refine how to use the audited figures; they do not negate the earlier correction of arithmetic and parsing defects. All default guide cells retain `method_status: estimated`, and the [prior Virginia audit](virginia-final-audit.md) records additional unresolved choice/cardinality, credit-range and language assumptions.

## What the current frozen numbers show

The 32 captured computing guides yield 23 CS guides and then one selected guide per 15 universities. Default sending cohort: 16 colleges with a recorded CS associate degree. The current selection uses title-based deduplication, which picks VCU BA, William & Mary BA and Radford's Network concentration. Those program identities should be pinned deliberately for the paper.

All means below weight college × selected-guide pairs equally. They are neither enrollment-weighted state estimates nor observed transcript loss. “Full supply” means no missing requirement row under the current join, including assumed category supply; it does not certify a feasible degree plan.

Guide credit utilization includes accepted elective landings specified in the guides. It is not the strict named-major/GE application measure used for the MA and CA comparison in the companion memo. A strict VA counterpart has not yet been calculated; this numerator difference must accompany any side-by-side state values.

| Supply/cohort | Pairs | Guide preparation / whole degree | Guide credit utilization | Mean unused guide credits | Full supply | Zero unused credit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Catalog, 16 CS colleges | 240 | 50.159% | 98.471% | 0.958 | 222 / 240 | 148 / 240 |
| Scheduled snapshot, same 16 | 240 | 45.641% | 89.487% | 6.571 | 107 / 240 | 70 / 240 |
| Catalog, all 23 | 345 | 48.879% | 95.929% | 2.545 | 266 / 345 | 178 / 345 |
| Scheduled snapshot, all 23 | 345 | 43.305% | 84.844% | 9.470 | 107 / 345 | 70 / 345 |

The near-50% Figure 1 result largely reflects the degree's structure. The average guide ceiling is **50.390%**, leaving a default catalog shortfall of only **0.230 percentage points**. Expressed against the intended pre-transfer half, modeled supply is **99.541%**, rather than 50.159%. This is a compelling explanatory companion to Figure 1: the remaining university work should not be presented as failed transfer opportunity.

GE/assumed-category accounting also matters. Default credit coverage falls from 50.159% to **44.404%** when the assumed-category bucket is removed; the rounded credit-derived course sensitivity is **42.255%**. The bucket averages **12.533 credits**, or **20.201% of the pre-transfer half**. It includes open-category assumptions and is not an exhaustive GE taxonomy, so none of these alternative lenses is a literal reproduction of the MA named-course observation measure.

Default unused credit decomposes into **0.667 explicitly denied credits** plus **0.292 modeled substitution credits** per pair. Explicit denials therefore contribute **69.6%** of modeled catalog loss. The denials are SDV rows at Longwood, Randolph-Macon, Lynchburg, Mary Washington and UVA, evaluated at the two-credit upper range. The scheduled model's larger total is almost entirely its missing-supply assumption, with the same 0.667-credit denied component.

The public-university-only sensitivity is **98.636%** catalog utilization across 192 pairs, versus 98.471% in the full 15-guide cohort. Inclusion of three private receivers therefore does not account for the favorable catalog result. This is still not a matched CA/MA/VA public-sector comparison: institution mix, program pins, calendar years and methodological paths differ.

## Case studies worth pursuing

| Candidate | Current result | What to investigate |
| --- | --- | --- |
| Paul D. Camp → UVA | 59 / 66 guide credits apply; seven unused | Five unavailable EGR 121/122 credits plus two denied SDV credits. Verify the associate choices, engineering requirements, alternative coverage and source year. |
| Brightpoint, Southwest Virginia and Virginia Peninsula → Virginia Tech | Six-credit `CSC 205 + CSC 215` group missing in the catalog model | A conjunctive receiving requirement can block application even if one course exists. Determine the precise equivalency and partial-credit outcome. |
| Eleven CS colleges tied in the catalog view | No modeled missing supply across any of the 15 guides; 98.931% mean utilization | Show what good alignment looks like while explaining that target-specific SDV refusals remain. |
| Southwest Virginia → George Mason, catalog versus schedule | Preparation 49.219% → 28.125%; utilization 100% → 57.143% | Twenty-seven additional unavailable modeled credits. First reconcile the Fall-only window; then examine course rotation, staffing, online sharing and actual two-year pathways. |
| Colleges without a recorded CS credential | Catalog utilization 90.118%; scheduled sensitivity 74.231% | Separate program access from credit alignment. Some may offer advising routes or use another college's courses, as the common-curriculum policy allows. |

Across default catalog college means, the lowest is Southwest Virginia at **97.03%** utilization and the eleven supply-complete colleges tie at **98.93%**. Among receiver means, UVA is lowest at **95.64%**, then Mary Washington **96.17%**; Bridgewater, NSU, ODU, Radford and William & Mary reach 100%. These are guide-model case-selection statistics, not performance judgments about schools.

The scheduled result spreads college means from Southwest Virginia **66.27%** to four tied colleges at **98.93%**. The large contrast is interesting precisely because the schedule-window evidence must be understood before attributing it to institutions.

## Which MA-family visuals contribute most

**Figure 3 is the best provisional state-comparison anchor**, provided the paper consistently defines the denominator as the sending degree/plan and clearly distinguishes Virginia's target-specific guide plan from the independently modeled associate curricula elsewhere. Its natural complement is an unused-credit decomposition using the same units and population.

**Figure 1 can explain opportunity versus structural ceilings.** Retain GE and credit quantities for the Virginia guide case, but display the pre-transfer ceiling beside observed supply or the shortfall below that ceiling. A common label on three current state panels would otherwise conceal different estimands. The no-GE/course-count mode does not solve this: Virginia's course numbers remain derived estimates.

**Figure 2 is potentially valuable for mechanisms, but Virginia currently uses another corpus.** `CourseTypeCoverage.jsx` calls the canonical coverage API and the `va-cs` configuration pins 16 BS receiver programs. That set includes JMU, Shenandoah and Virginia State, while the 15-guide Figure 1/3/4 set includes UVA and Lynchburg instead, and selects some BA programs. Course-type differences from Figure 2 cannot currently be explained as a partition of the guide heatmap. Either derive types from the same validated guides or use a harmonized canonical pathway corpus across the selected figures.

**Figure 4 needs a common meaning before a state comparison.** Virginia currently shows unused credit only. CA/MA's hours-above-120 measure additionally includes resident curriculum length above 120. The guide totals average 123.6 and range 120–134; mechanically adding the average 3.6-credit baseline would yield 4.558 rather than 0.958, but that is not a validated resident-degree reconstruction. Show unused credits separately from curriculum length instead of pooling the current panels.

**Figures 5 and 6 should not carry the Virginia argument now.** Cost requires a matched year and pricing basis after a common hours definition. Virginia's Figure 6 prerequisite-pathway capability remains false; published standardization is not evidence that complexity differences have been measured.

## Narrow additions and follow-up work

1. **Add a ceiling-and-shortfall panel to Figure 1.** Distinguish work reserved for the university, explicit available preparation, assumed category capacity, and actual missing preparation. Use the same definitions in each state before direct magnitude comparisons.
2. **Add a loss-reason panel beside Figures 3/4.** Separate explicit denied credit, missing-course substitutes, unmatched major credit, accepted electives, GE credit and degree length above the benchmark. This directly tests where systems fail without inflating all unused credit into repeated courses.
3. **Normalize schedule observation windows before a catalog/schedule companion.** Capture four regular semesters or documented rotations, keep the academic year fixed, and then assess feasible sequence completion. Investigate cross-college/online access and seat constraints for the few extreme cases; a current-schedule boolean alone cannot provide that conclusion.
4. **Pin the program and policy year, then reconcile units.** Recover the relevant 2023/2026 common-curriculum versions, receiving guides, catalog credits and actual associate requirements. Resolve CSC 221/205 discrepancies, Bridgewater's recommendation row, NSU distinct-science choices and other recorded conditions.
5. **Test the collaboration hypothesis with a bounded design.** After harmonization, compare intended credit application and subject-specific bottlenecks. For causal claims, add a before/after CS-common-curriculum cohort or a credible policy-timing comparison; three state snapshots alone do not identify the policy effect.

## Reproducibility

Run `python3 analysis/results/paper_planning/va_analyze.py` from the repository root. The script reads the committed cells and cached sources, records the cell artifact's SHA-256, writes only `va_*` planning artifacts, and checks coverage ratios, ceilings and credit conservation for all 1,170 cells. No database or production data was changed.

[Summary JSON](../analysis/results/paper_planning/va_summary.json), [college summaries](../analysis/results/paper_planning/va_college_summary.csv), [university summaries](../analysis/results/paper_planning/va_university_summary.csv), [all cells](../analysis/results/paper_planning/va_cells.csv), [paired catalog/scheduled changes](../analysis/results/paper_planning/va_catalog_scheduled_pairs.csv), [missing rows](../analysis/results/paper_planning/va_missing_rows.csv), [denied rows](../analysis/results/paper_planning/va_denied_rows.csv).
