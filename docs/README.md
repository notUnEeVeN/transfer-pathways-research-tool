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
| [`plans/`](plans/) | Implementation plans and research notes for in-progress or proposed analysis work |

## Figure documents

| Doc | Figure | Use it for |
| --- | --- | --- |
| [figures/paper-district-heatmap.md](figures/paper-district-heatmap.md) | District x UC complete-transfer matrix | Full proof of the 99.5% replication result and receipts for the 3 gained cells |
| [figures/paper-credit-loss.md](figures/paper-credit-loss.md) | Figure 1: credit loss, 1st-4th choice | Full paper-method replication, current-data deltas, ASSIST-stated-minimums extension, blockers, and validation |

## Conventions

Every ported figure keeps three artifacts in sync:

1. **The website component** (`frontend/src/analyses/Paper*.jsx`) with views
   for *Paper baseline*, *Our data*, and *Difference* — the baseline view must
   reproduce the paper render exactly (verified, not assumed).
2. **Auditable Python** (`analysis/`) that reimplements the computation
   from scratch — no code shared with the website — so results can be
   independently reproduced and explained (`--diff`, `--explain` flags).
3. **A figure doc** (`docs/figures/*.md`) recording provenance, the
   verification performed, known rendering substitutions, and the difference
   analysis with course-level receipts.
