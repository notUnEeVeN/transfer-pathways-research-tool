# California Figure 3 — district coverage distribution

> Current paper-matched data · 9 UC campuses × 72 community college districts · July 21, 2026

Current-data rows use the same nine exact canonical CS campus/program pairs as
the district heatmap. The canonical-scope rerun preserves the distribution;
adding other majors or CS sibling programs to Atlas cannot change it.

## Result

Figure 3 counts how many districts have complete articulation with exactly
zero through nine UC campuses. Recomputed on current data, the ten bar heights
are:

| Complete campuses | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current districts | 3 | 2 | 1 | 7 | 6 | 11 | 8 | 4 | 10 | 20 |
| Paper districts | 3 | 2 | 1 | 7 | 7 | 10 | 8 | 4 | 12 | 18 |

The three newer complete district-campus cells explain the entire change:

- Allan Hancock moves from 4 to 5 complete campuses.
- Santa Barbara moves from 8 to 9.
- West Valley-Mission moves from 8 to 9.

All other districts remain in the same exact bin.

The interactive visual opens on current data and now mirrors the Figure 2
comparison controls: switch to **Paper baseline** for the original distribution,
or turn on **Show differences** in the current view. Green bar segments are
districts added to a bin since the paper; magenta segments are the paper-only
portion vacated when those districts moved to a higher bin. The controls stay
outside PNG/PDF exports, while the active legend remains part of a difference
export.

## Method

The legacy implementation is `question_2-3/district-level/district_least_options.py`,
function `create_simple_bar_plot`. It sums the nine binary campus results for
each district, counts the frequency of each integer from zero through nine,
and prints the frequency above every bar.

The port applies that same operation to the internal tool's current
paper-matched coverage rows. It is therefore a distribution of the district
heatmap totals, not a separate articulation model.

## Reproduce locally

From `analysis/`:

```bash
.venv/bin/python -m visuals.paper_articulation_histogram \
  --output-dir results/previews
```

This writes paper, current, and current-difference previews. Publishing the
same entry point exposes the version selector and difference toggle in the
Visual Library.
