# Local analysis and visuals

Research calculations run on the researcher's machine. A publication can
either upload finished SVG, PNG, and PDF assets or reference an interactive
renderer already shipped with the website. The Python implementations under
`visuals/` remain readable, locally runnable alternatives.

| File | Visual | Published controls |
| --- | --- | --- |
| `visuals/paper_credit_loss.py` | Paper Figure 1 credit loss | version, differences, detail matrix, campus labels |
| `visuals/paper_district_heatmap.py` | District x UC complete-transfer matrix | version, differences, campus labels |
| `visuals/paper_articulation_histogram.py` | California paper Figure 3 district coverage distribution | paper/current version, differences |
| `visuals/paper_articulation_map.py` | California paper Figure 4 district coverage map | none; current data has the same 72 display classes |
| `visuals/coverage_heatmap.py` | Articulation coverage | college/district/county, ASSIST/hand-curated minimums |
| `visuals/credit_loss.py` | Cheapest complete pathway distribution | courses/units |
| `visuals/choice_cost.py` | Incremental cost of additional campus choices | intentional application orders supplied locally |
| `visuals/category_gaps.py` | Missing articulation by course category | none; waits for category mappings |
| `visuals/complexity.py` | Prerequisite delay and blocking complexity | complexity/max delay |
| `visuals/transfer_credit_rate.py` | Associate-degree transfer credit rate | none; waits for associate-degree inputs |

`paper_credit_loss.py`, `paper_district_heatmap.py`, `pmt_eligibility.py`, and
`pmt_min_courses.py` remain the audited calculation layer. The local-only Node
bridge at `server/scripts/computeVisualData.js` reuses the canonical calculation
functions directly; it is not an API route.

All data-backed visual requests use a configured `majorSlug`, which resolves
to exact campus/program pairs. Generic visual entry points default to `cs` and
accept another configured slug through `--major`; the California/MA paper
ports are intentionally fixed to the nine canonical CS pins. Neither path
uses title-substring discovery or settings as an analysis scope.

## Setup

```bash
cd analysis
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

DB-backed calculations load `../scripts/.env` (`MONGO_URI` or
`TARGET_MONGO_URI`, plus `DB_NAME`). To publish, download the current Python
client from the website's API tab and set `PMT_TOKEN`.

## Run

Every visual requires `--output-dir`, `--publish`, or both. Run modules from the
`analysis` directory so imports are unambiguous.

```bash
PMT_CLIENT=../starter.py .venv/bin/python -m visuals.paper_district_heatmap \
  --output-dir results/previews --publish

PMT_CLIENT=../starter.py .venv/bin/python -m visuals.paper_credit_loss \
  --recompute --workers 8 --output-dir results/previews --publish

.venv/bin/python -m visuals.paper_articulation_map \
  --output-dir results/previews

.venv/bin/python -m visuals.paper_articulation_histogram \
  --output-dir results/previews

.venv/bin/python -m visuals.choice_cost \
  --order 79,89 --order 120,117,7 --output-dir results/previews
```

Republishing a slug replaces all of its stored states together. A variant
switch in the gallery only swaps finished files; it never runs research code.

For a website-native publication, use a supported renderer name instead of a
Matplotlib figure:

```python
pmt.publish(
    visual="paper-credit-loss",
    slug="paper-credit-loss-copy",
    title="Paper-style credit loss (published copy)",
)
```

This stores a validated manifest, not source code. The gallery resolves that
manifest to the same React component used by the built-in visual, so its
controls and rendering stay identical as the application evolves. The
allowlist is intentionally narrow; `paper-credit-loss` is the first parity
pilot, and additional renderers can be exposed after their data contracts are
reviewed.
