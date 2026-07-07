# Docs

Methodology and verification notes for the research console — everything a
teammate (or reviewer) needs to trust a figure without re-deriving it.

## Layout

| Path | Purpose |
| --- | --- |
| `figures/` | One document per ported paper figure: provenance, methodology (paper vs ours), how the port was verified, and the difference analysis with receipts |

## Figure documents

| Doc | Figure | Status |
| --- | --- | --- |
| [figures/paper-district-heatmap.md](figures/paper-district-heatmap.md) | District × UC complete-transfer matrix | Replicated; 99.5% agreement, 3 one-directional gains, receipts verified |
| [figures/paper-credit-loss.md](figures/paper-credit-loss.md) | Figure 1 — credit loss (requirements vs CCC equivalents, 1st–4th choice) | Replicated + recomputed on our data; algorithm-equivalence proven on the paper's own inputs (100% course-count agreement); includes ASSIST-stated-minimums extension with demand distributions, blockers, and validation receipts |

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
