# California Figure 3 — district coverage distribution

> ASSIST is the interactive default · 9 UC campuses × 72 community college districts · August 18, 2026

The interactive default uses the same ASSIST requirement source and the same
nine exact canonical campus/program pairs as the district heatmap and map. A
separate **Hand-curated minimums** state preserves the historical website-rule
reconstruction, and **Paper baseline** preserves the transcribed paper matrix.
These are source choices, not interchangeable labels for one dataset.

## Result

Figure 3 counts how many districts have complete articulation with exactly
zero through nine UC campuses. The previously reported replication counts
below belong specifically to the hand-curated-minimums reconstruction; they
must not be presented as the ASSIST-default distribution:

| Complete campuses | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Hand-curated reconstruction | 3 | 2 | 1 | 7 | 6 | 11 | 8 | 4 | 10 | 20 |
| Paper districts | 3 | 2 | 1 | 7 | 7 | 10 | 8 | 4 | 12 | 18 |

The three newer complete district-campus cells explain the entire historical
hand-curated-to-paper change:

- Allan Hancock moves from 4 to 5 complete campuses.
- Santa Barbara moves from 8 to 9.
- West Valley-Mission moves from 8 to 9.

All other districts remain in the same exact bin.

The interactive visual opens on **ASSIST minimums**, matching the heatmap and
map defaults. Computer Science also exposes **Hand-curated minimums** and
**Paper baseline**. **Show differences** compares either computed source with
the frozen paper distribution. Green bar segments are districts added to a bin;
magenta segments are the paper-only portion vacated when districts move. The
controls stay outside PNG/PDF exports, while the active source label and any
difference legend remain inside the export.

## Method

The legacy implementation is `question_2-3/district-level/district_least_options.py`,
function `create_simple_bar_plot`. It sums the nine binary campus results for
each district, counts the frequency of each integer from zero through nine,
and prints the frequency above every bar.

The port applies that same operation directly to the district heatmap's
canonical row-total helper. It is therefore definitionally a distribution of
the active heatmap totals, not a second articulation model. The default query
is `majorSlug=cs&groupBy=district&requirements=assist&pin=settings`; the
historical reconstruction instead uses
`majorSlug=cs&groupBy=district&requirements=paper&pin=paper`.

## Reproduce locally

From `analysis/`:

```bash
.venv/bin/python -m visuals.paper_articulation_histogram \
  --output-dir results/previews
```

The standalone script writes the historical paper-matched previews. The web
visual additionally exposes the ASSIST-default state and labels the selected
requirement source inside every computed export.
