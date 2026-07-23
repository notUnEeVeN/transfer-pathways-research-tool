# Docs

Methodology and verification notes for the research console.

## Start here

For a fast reminder of what the visualizations prove, open
[`visualization-quick-reference.md`](visualization-quick-reference.md). It is
the condensed map: headline results, caveats, and links into the receipts.

Use the individual figure docs when you need to defend a number, rerun a check,
or answer a reviewer-style question.

## Layout

| Path | Purpose |
| --- | --- |
| [`visualization-quick-reference.md`](visualization-quick-reference.md) | One compact read of the important takeaways from all current visualization work |
| [`figures/`](figures/) | Deep notes, one per ported paper figure: provenance, methodology, verification, difference analysis, and receipts |
| [`superpowers/specs/`](superpowers/specs/) | Approved design documents (dated), including the expansion roadmap |
| [`superpowers/plans/`](superpowers/plans/) | Step-by-step implementation plans executed from the specs |

One-off design handoffs, design-session prompts, and gate-review docs are
removed once implemented — recover any of them from git history.

## Figure documents

| Doc | Figure | Use it for |
| --- | --- | --- |
| [figures/paper-district-heatmap.md](figures/paper-district-heatmap.md) | District x UC complete-transfer matrix | Full proof of the 99.5% replication result and receipts for the 3 gained cells |
| [figures/paper-articulation-histogram.md](figures/paper-articulation-histogram.md) | California Figure 3: district coverage distribution | Current and paper bin counts and why four bars move |
| [figures/paper-articulation-map.md](figures/paper-articulation-map.md) | California Figure 4: district articulation coverage map | Why the current and paper maps have identical marker classes despite 3 exact-count gains |
| [figures/paper-course-barriers.md](figures/paper-course-barriers.md) | California Figure 5: per-course articulation gaps | Which courses block which campuses, the 28-of-32 exact cell match, and receipts for the 4 resolved cells |
| [figures/paper-credit-loss.md](figures/paper-credit-loss.md) | Figure 1: credit loss, 1st-4th choice | Full paper-method replication, current-data deltas, ASSIST-stated-minimums extension, blockers, and validation |
| [figures/ma-course-type-spread.md](figures/ma-course-type-spread.md) | Massachusetts Figure 2 recreated on California data: course-type coverage | Course-type rules, per-campus values, and how our denominator differs from the MA paper's |
| [figures/income-access.md](figures/income-access.md) | Transfer access against local income (original) | The income gradient, the rurality controls that do not explain it, the FTB catchment measure, and what the association is not |
| [figures/district-portfolio-subsets.md](figures/district-portfolio-subsets.md) | Preparation as campus options expand | Reproducible 3,266-plan analysis, the live 1–7 portfolio figure, weighting definitions, solver-quality strata, and audit rules |
| [figures/multi-campus-pathways.md](figures/multi-campus-pathways.md) | Archived exact-reach predecessor | The superseded one-plan-per-district result and why it is no longer the live gallery statistic |

## Conventions

Every ported figure keeps three artifacts in sync:

1. **Auditable local Python** (`analysis/`) that computes and renders the
   figure from canonical data (`--diff`, `--explain` flags where applicable).
2. **A published gallery artifact** created with `pmt.publish(fig, ...)` after
   the local values and rendering have been checked.
3. **A figure doc** (`docs/figures/*.md`) recording provenance, the
   verification performed, known rendering substitutions, and the difference
   analysis with course-level receipts.
