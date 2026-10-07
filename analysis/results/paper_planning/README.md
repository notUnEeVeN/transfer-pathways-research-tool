# Paper planning artifacts — September 7, 2026

Read [the integrated report](../../../docs/paper-analysis-plan.md) first. These are exploratory analyses of the MA-family figures; cross-state cohorts and accounting definitions still require harmonization.

| Prefix | Contents | Source and replay |
| --- | --- | --- |
| `figure1_2_`, `figure1_ca_`, `figure2_ca_` | Frozen compressed CA input; provenance; coverage/discipline tables; PNG/PDF scope and GE sensitivities | Corrected September 7 audit exports; `analysis/paper_planning_figures1_2.py` |
| `ma_feasibility_` | Archive inventory, 270 credit joins, all 61 final credit fractions, recovered Figure 2 values and population reconciliation | Both sibling MA git repositories and vendored source artifacts; `ma_feasibility_audit.py` |
| `va_` | Four guide/supply variants, course-credit conflicts, schedule-term evidence, institution summaries and loss reasons | Current frozen VA cells plus locally captured guides/catalogs; `va_analyze.py` |
| `figure3_6_` | Frozen CA source projection, final MA cells, cohort sensitivities, draft joint plot and source hashes | Corrected audit exports plus final MA workbook-derived baselines; `figure3_6_analysis.py` |

Run the four commands in the integrated report from the repository root. Replay writes only planning artifacts. The first and last plot scripts require matplotlib; the archive investigation requires openpyxl and the two sibling source repositories. The frozen CA inputs require no database access. CSV means are descriptive; rounding in source fields is documented in each report.

Key distinction: Figure 1 availability, Figure 3 degree-credit application, Figure 4 excess coursework and Figure 6 prerequisite complexity have different denominators and meanings. VA guide application includes accepted elective slots and is not an exact counterpart to strict MA/CA named-and-GE application.
