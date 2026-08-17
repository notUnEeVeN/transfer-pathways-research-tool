# Docs

Methodology and verification notes for the research console.

## Start here

- **[`visualizations.md`](visualizations.md)** — every figure explained in plain
  English: what it asks, how it's computed, what it shows, what it must not be
  read as. Start here for meetings or for anyone new to the project.
- **[`ma-meeting-notes.md`](ma-meeting-notes.md)** — plain-English summary of
  the Massachusetts paper audit: what we found wrong, and why we think it's
  theirs.

Use the individual figure docs when you need to defend a number, rerun a check,
or answer a reviewer-style question.

## Layout

| Path | Purpose |
| --- | --- |
| [`visualizations.md`](visualizations.md) | Every visual, explained plainly, with links to the receipts |
| [`figures/`](figures/) | Deep notes, one per ported figure: provenance, methodology, verification, difference analysis, receipts |
| [`superpowers/`](superpowers/) | Design specs and implementation plans from the brainstorm→plan workflow |

Design briefs, one-off handoffs, and gate-review docs are removed once
implemented — recover any of them from git history.

## Figure documents

| Doc | Figure | Use it for |
| --- | --- | --- |
| [figures/paper-district-heatmap.md](figures/paper-district-heatmap.md) | District × UC complete-transfer matrix | Full proof of the 99.5% replication result and receipts for the 3 gained cells |
| [figures/paper-articulation-histogram.md](figures/paper-articulation-histogram.md) | California Figure 3: district coverage distribution | Current and paper bin counts and why four bars move |
| [figures/paper-articulation-map.md](figures/paper-articulation-map.md) | California Figure 4: district articulation coverage map | Why current and paper maps have identical marker classes despite 3 exact-count gains |
| [figures/paper-course-barriers.md](figures/paper-course-barriers.md) | California Figure 5: per-course articulation gaps | Which courses block which campuses, the 28-of-32 exact cell match, receipts for the 4 resolved cells |
| [figures/paper-credit-loss.md](figures/paper-credit-loss.md) | Figure 1: credit loss, 1st–4th choice | Full paper-method replication, current-data deltas, ASSIST-stated-minimums extension, blockers, validation |
| [figures/degree-coverage-sources.md](figures/degree-coverage-sources.md) | Degree coverage (their Fig 1) | Authoritative provenance for the hand-gathered UC degree requirements, every course cited to its URL |
| [figures/degree-coverage-sources-bio-econ.md](figures/degree-coverage-sources-bio-econ.md) | Biology + Economics degree templates | The human-verification index for the 18 bio/econ templates |
| [figures/ma-course-type-spread.md](figures/ma-course-type-spread.md) | Course-type coverage (their Fig 2) | Course-type rules, per-campus values, how our denominator differs |
| [figures/bio-course-types.md](figures/bio-course-types.md) | Course-type taxonomy | Why Biology needs its own typing rules |
| [figures/income-access.md](figures/income-access.md) | Transfer access against local income | The income gradient, rurality controls, FTB catchment measure, and what the association is not |
| [figures/district-portfolio-subsets.md](figures/district-portfolio-subsets.md) | Preparation as campus options expand | The 3,266-plan analysis, the live 1–7 figure, weighting, solver strata, audit rules |
| [figures/multi-campus-pathways.md](figures/multi-campus-pathways.md) | Archived exact-reach predecessor | The superseded one-plan-per-district result and why it no longer drives the gallery |
| [figures/assist-authority-gap-ideas.md](figures/assist-authority-gap-ideas.md) | Backlog | Unbuilt figure ideas probing how reachable ASSIST's stated minimums are |

## Massachusetts

| Doc | Use it for |
| --- | --- |
| [ma-meeting-notes.md](ma-meeting-notes.md) | The plain-English version: 324 numbers checked, 66 wrong, one cause |
| [ma-paper-audit.md](ma-paper-audit.md) | The technical record: their pipeline recovered, per-figure ledgers, the 61-pair Figure-3 reconciliation, cross-state reads |

## Virginia

| Doc | Use it for |
| --- | --- |
| [virginia-courses.md](virginia-courses.md) | The course-equivalency corpus: what `va_courses` / `va_institutions` hold and its scope limits |
| [virginia-degree-collection.md](virginia-degree-collection.md) | The degree-requirement collection pipeline and its research cohort |
| [virginia-prerequisite-qa.md](virginia-prerequisite-qa.md) | Prerequisite verification handoff (app code shipped; corpus import pending) |
| [virginia-feasibility.md](virginia-feasibility.md) | The original measured feasibility review of Transfer Virginia |

## Modelling and configuration

| Doc | Use it for |
| --- | --- |
| [uc-degree-modelling-rules.md](uc-degree-modelling-rules.md) | The authority on degree modelling: one vocabulary, one reader, unit budgets, the standing audit |
| [major-pins.md](major-pins.md) | Which ASSIST programs count as each major per campus — the rationale behind `server/config/majors.js` |
| [prereq-mapping-qa.md](prereq-mapping-qa.md) | California prerequisite mapping verification handoff |
| [state-expansion-feasibility.md](state-expansion-feasibility.md) | The nine-state survey, what each publishes, and the (since-reversed) Maryland recommendation |

## Paper methods notes

| Doc | Use it for |
| --- | --- |
| [notes_income_gate.md](notes_income_gate.md) | "The Income Gate" collection — measures, scope, detail kept off the figures |
| [notes_computing_bottleneck.md](notes_computing_bottleneck.md) | "The Computing Bottleneck" collection — instance definitions, repair simulation |

## Conventions

Every ported figure keeps three artifacts in sync:

1. **Auditable local Python** (`analysis/`) that computes and renders the figure
   from canonical data (`--diff`, `--explain` flags where applicable).
2. **A published gallery artifact** created with `pmt.publish(fig, ...)` after
   local values and rendering have been checked.
3. **A figure doc** (`docs/figures/*.md`) recording provenance, the verification
   performed, known rendering substitutions, and the difference analysis with
   course-level receipts.
