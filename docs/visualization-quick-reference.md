# Visualization quick reference

Use this when you need the answer without rereading the full methodology notes.
The detailed receipts live in the figure docs linked at the bottom.

## The three things to remember

1. **The paper figure ports replicate the paper's methods.** The remaining
   differences are data differences from a newer ASSIST snapshot, not a
   different algorithm.
2. **The district heatmap is almost unchanged.** We match the paper on
   645 of 648 district-campus cells; the only differences are three new
   complete cells, all caused by added articulations.
3. **The credit-loss figure is algorithm-equivalent to the paper.** Run on
   the paper's own inputs, our rebuild matches 100% of course-count averages;
   on current data, six of nine first-choice campus bars are identical and no
   first-choice campus moves by more than 0.08 of a course.

## One-screen summary

| Visualization | What it answers | Main result | Important caveat |
| --- | --- | --- | --- |
| District transfer heatmap | Can a district complete each UC campus's hard CS transfer requirements? | 99.5% agreement with the paper: 645/648 cells match; 3 gains; 0 losses | Uses the heatmap completeness rule, which counts series articulations |
| Credit loss, paper replication | How many CCC courses are needed for UC requirements as a campus becomes 1st-4th choice? | Same algorithm as the paper; current-data deltas are tiny and named at course level | The paper's credit-loss pipeline drops some cross-group series receivers that the heatmap counts |
| Credit loss, ASSIST-stated minimums | What if demand comes from ASSIST required groups instead of website-minimum curation? | Seven campuses have fully transferable districts; UCSD and UCLA have none | This is our diagnostic extension, not a claim about the paper's demand model or admissions minimums |

## Heatmap: the whole story

The heatmap compares a binary district-campus matrix: complete or not complete.
Our matrix is a strict superset of the paper's.

| Gained complete cell | Decisive current articulation |
| --- | --- |
| UC Davis x Santa Barbara CCD | Santa Barbara City now covers the ECS 036 series via `CS 105 / CS 106 / CS 137 / CS 140` |
| UC Davis x West Valley-Mission CCD | Mission added `CIS 043 -> ECS 036B` and `CIS 039 -> ECS 050` |
| UC Santa Barbara x Allan Hancock JCCD | Allan Hancock added `CS 111 -> CMPSC 16` and `CS 112 -> CMPSC 24` |

Memory hook: **same requirements, same heatmap rule, newer ASSIST data.**

## Credit loss: paper replication

Gold bars are the paper's curated UC website minimums. Blue bars are the
average CCC courses needed when that UC campus is a student's 1st, 2nd, 3rd,
or 4th choice.

What changed on current data:

| Campus | First-choice movement | Why |
| --- | ---: | --- |
| UC Davis | +0.08 | `ECS 036A` newly articulates at San Francisco and San Luis Obispo; Antelope Valley now explicitly lists it as not articulated |
| UC Santa Barbara | -0.02 | Allan Hancock now completes UCSB with a low-course pathway |
| UC San Diego | -0.02 | `CSE 8B` disappeared from current agreements; `CSE 11` carries the intro group |
| The other six campuses | 0.00 | First-choice bars match the paper exactly |

Validation headline: our independent Python implementation, run on the
paper's own district CSVs, reproduces **2,592 of 2,592 course-count averages**.

## ASSIST-stated minimums variant

This extension swaps the demand side from website-minimum curation to the
required groups that ASSIST agreements state for the one partner-facing CS
major per campus. It uses the ported Plan My Transfer eligibility and
minimum-course algorithms.

| Campus | ASSIST gold | Fully transferable districts | First-choice avg | Main reminder |
| --- | ---: | ---: | ---: | --- |
| UCD | 6.00 | 28 | 8.75 | `ECS 036C` is the biggest named blocker |
| UCM | 10.00 | 64 | 11.03 | Broadly transferable, but higher demand than website curation |
| UCSD | 7.33 | 0 | 0.00 | `CSE 29` blocks essentially every district |
| UCSB | 4.67 | 49 | 7.00 | Website and ASSIST gold bars agree |
| UCLA | 10.67 | 0 | 0.00 | `COM SCI 35L` blocks every district |
| UCB | 3.00 | 69 | 3.81 | Lowest ASSIST demand among the nine |
| UCSC | 3.33 | 46 | 5.13 | Moderate demand, many complete districts |
| UCI | 2.67 | 39 | 5.08 | Low gold bar, but more CCC courses needed |
| UCR | 4.67 | 57 | 7.54 | Strong district coverage |

Zeros in this view mean **no district has a fully articulated single-college
path under ASSIST-stated demand**, not missing data.

## Common confusions

- **Why does the heatmap count Davis gains that credit loss does not?** The
  heatmap counts series articulations. The paper's credit-loss CSV pipeline
  keeps only receivers matching curated keys, so cross-group series receivers
  can be invisible there.
- **Why is ASSIST-stated minimums separate?** The paper used website-minimum
  curation. The ASSIST view is our extension for comparing surfaces.
- **Did anything actually get worse?** In the heatmap, no. In credit loss, the
  one first-choice transferability drop is Antelope Valley x Davis, caused by
  ASSIST now explicitly marking `ECS 036A` not articulated where it used to be
  silent.
- **Are UCLA and UCSD zeros a rendering issue?** No. Their ASSIST-stated
  required groups have genuine blockers in every district.

## Deep links

| Need | Go to |
| --- | --- |
| Full heatmap receipts | [`figures/paper-district-heatmap.md`](figures/paper-district-heatmap.md) |
| Full credit-loss methodology, deltas, ASSIST variant, and validation | [`figures/paper-credit-loss.md`](figures/paper-credit-loss.md) |
| How to rerun the Python checks | [`../analysis/README.md`](../analysis/README.md) |
