# MA/CA meeting notes

Private briefing. The final paper is the published Massachusetts result.
**Our recalculation** means applying the paper's formula directly to the
authors' source files. Old summaries, implementations, and draft methods are
not additional comparison versions.

## Conclusion

- The material Massachusetts disagreements are in **Figures 3 and 4**.
- Figure 5 only prices Figure 4, so its differences are inherited.
- Figure 2's small anonymous difference is inconsequential.
- Figure 6 is almost fully validated: one difference fits the same later
  pathway revision seen in Figures 3 and 4, and one final graph is unavailable.
- Figure 7 needs a cohort disclosure, not another error comparison.
- Figure 1 has one minor isolated difference.

The source files predate the final paper. A disagreement could be an
unpublished final-input revision or a paper error. Call it a
**non-reproducing value** unless the evidence independently proves an error.

## Figure 3 — substantive disagreement

**Formula:** associate-degree credits satisfying bachelor requirements divided
by total associate-degree credits. These are credits, not courses, and the
denominator is the associate degree—not the four-year degree.

Gray credit satisfies a bachelor requirement. Blue credit transfers only as an
unrestricted elective and is normally excluded. GE credit can be gray when it
satisfies a real bachelor requirement, so this is not simply “GE in or out.”

**Result:** our direct gray-row calculation reproduces **42 of 61** cells. Our
mean is **64.682%**; the paper's cells average **67.738%**.

The 19 differences contain four important patterns. These clues overlap:

1. **Nine likely coordinated revisions.** The same nine pathways also change
   in Figure 4, always coherently: more AS credit applies and excess hours fall
   to zero. They are Bridgewater with Bristol, Cape Cod, MassBay, and North
   Shore; Dartmouth with Bristol and Cape Cod; Amherst with Greenfield and
   STCC; and Fitchburg with Quinsigamond. This looks more like re-articulation
   than nine independent typos, but only the authors' final sheets can confirm
   it.
2. **Selective blue-credit treatment.** Most cells follow the gray-only rule.
   Fitchburg–Middlesex matches only with all blue credit; Bridgewater–Massasoit,
   Worcester–Roxbury, and Amherst–STCC require selected blue credit;
   Fitchburg–MassBay and Fitchburg–Quinsigamond also require a 100% cap. The
   paper gives no rule for these exceptions.
3. **Two possible stale denominators.** Westfield–STCC's **67%** is exactly
   `42/63`; Worcester–STCC's **60%** is exactly `38/63`; but the source AS
   degree totals **61 credits**. This explanation is conditional on the final
   numerators still being 42 and 38.
4. **Four unresolved cells.** Dartmouth–Massasoit is **54% vs 95%**,
   Bridgewater–Roxbury **42% vs 39%**, Framingham–Massasoit **51% vs 55%**, and
   Framingham–Middlesex **28% vs 33%**. No consistent treatment of available
   blue credit produces the paper values.

**Meeting position:** Figure 3 has a real reproducibility problem. A later
revision may explain much of it; the selective credit rule, possible old
denominators, and four unresolved cells still require answers.

## Figure 4 — substantive disagreement

**Formula:** `max(0, total transfer-pathway hours - 120)`.

**Result:** our direct calculation reproduces **36 of 49** cells. Our mean is
**15.327 hours**; the paper's cells average **12.918 hours**.

1. **Eleven positive source results become zero in the paper.** Nine are the
   coordinated pathways above. Amherst–Holyoke (**5 → 0**) and
   Fitchburg–Mount Wachusett (**5 → 0**) show the same pattern but have no
   Figure 3 cell to cross-check. A later pathway revision is the likely cause.
2. **The two strongest carry-forward candidates are UMass Boston.** For
   Boston–Bunker Hill, total **119** gives **0**, but the paper prints **6**.
   For Boston–MassBay, total **151** gives **31**, but the paper prints **7**.
   Those paper values follow a hand-entered summary rather than the detailed
   source calculation, and neither pathway belongs to the Figure 3 pattern.
3. **The prose range is definitely wrong.** “Six to 35” combines two cohorts.
   The 49-pathway positive range is **1.2–34.83**; the 61-pathway range is
   **6.0–33.88**. Neither produces “six to 35.”

**Meeting position:** most Figure 4 differences likely reflect an unpublished
coordinated revision. The two Boston values are credible manual carry-forward
errors, and the prose range is a confirmed error.

## Other figures — brief disposition

- **Figure 1:** **164/165** cells reproduce. Cape Cod–UMass Dartmouth is
  **35%** in our calculation and **45%** in the paper. The 45% duplicates the
  neighboring Massasoit value, but a later revision is also possible. Minor
  isolated note only.
- **Figure 2:** the anonymous non-STEM dots average **69.4%** in our calculation
  versus **76.2%** in the paper; one value changes from 33 to 67. The campus
  cannot be identified, the STEM conclusions reproduce, and the difference is
  inconsequential.
- **Figure 5:** the paper correctly prices its Figure 4 values. All 13 different
  results come directly from Figure 4; there is no independent Figure 5 issue.
- **Figure 6:** formula and headline validated—**47/49** cells and **59/60**
  available component scores reproduce. STCC–UMass Amherst is **+34 vs −28**,
  consistent with the same pathway's Figure 3/4 revision. Bristol–UMass
  Dartmouth is **−28 vs −32**, but the final graph needed to resolve it is
  unavailable. This is not a separate large bug.
- **Figure 7:** arithmetic is internally correct, but the complexity row uses
  **49 pathways** while transfer rate, hours, and cost use **61**. This is an
  undisclosed cohort difference, not a new formula error.

## CA changes learned from the MA formulas

| Figure | California alignment |
|---|---|
| 1 | Use articulated named required courses / all named required courses. Exclude GE; keep uncovered upper-division requirements in the denominator. |
| 2 | Categorize the same observations as Figure 1. The four types partition that course universe; GE and degree padding are excluded. |
| 3 | Use **applicable AS credits / total AS credits**. Count each credit once; include named-course and actual GE/breadth requirement credit; exclude unrestricted-elective-only credit. This fixes our former four-year-course denominator. |
| 4 | Use the full pathway total in `max(0, pathway hours - 120)`, including elective capacity toward the degree floor. Convert quarter units first. |
| 5 | Price Figure 4's unrounded result and round dollars once. Clearly label the state-specific price bases. |
| 6 | Preserve OR prerequisites, distinct courses, and series consistently; exclude ambiguous routes rather than guessing. CA is a constructed graph estimate, while MA uses the authors' graphs. |

## Website and comparison shelf

Every Massachusetts figure should expose only:

- **Final paper** — the published value.
- **Our recalculation** — the paper formula applied to the authors' source
  files.

Do not expose intermediate summaries, older formulas, classifiers, or drafts as
alternate Massachusetts versions.

Keep **eight meeting exhibits**:

- Six CA–MA comparisons, one for each Figure 1–6 visual.
- Two MA audits: Figure 3 and Figure 4, each Final paper versus Our
  recalculation.

Figures 1, 2, 5, and 6 do not need separate audit exhibits. Their minor,
inherited, or unresolved-input notes above are enough.

## Questions for the meeting

1. Were the nine overlapping Figure 3/4 pathways re-articulated after the
   available source files were created? Can we see the final input sheets?
2. In Figure 3, when does unrestricted-elective credit count, and when is the
   result capped at 100%?
3. Why do the STCC cells behave as though the denominator were 63 rather than
   61 credits, and what produces the four unresolved values?
4. Why do the Figure 4 Boston detail calculations give 0 and 31 while the paper
   prints 6 and 7?
5. Which cohort was intended by the Figure 4 prose range and Figure 7 summary?

## One-sentence conclusion

We now treat the final paper as the Massachusetts result, compare it only with
our direct recalculation, and apply the recovered formulas to California,
leaving two material audit questions: Figure 3's credit treatment and Figure
4's revised hours.
