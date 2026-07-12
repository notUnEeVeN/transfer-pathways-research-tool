# Local analysis and visuals

Research calculations and rendering run on the researcher's machine. The
server stores only finished SVG, PNG, and PDF assets. The former browser-side
visuals now have one readable Python entry point each under `visuals/`.

| File | Visual | Published controls |
| --- | --- | --- |
| `visuals/paper_credit_loss.py` | Paper Figure 1 credit loss | version, differences, detail matrix, campus labels |
| `visuals/paper_district_heatmap.py` | District x UC complete-transfer matrix | version, differences, campus labels |
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

.venv/bin/python -m visuals.choice_cost \
  --order 79,89 --order 120,117,7 --output-dir results/previews
```

Republishing a slug replaces all of its stored states together. A variant
switch in the gallery only swaps finished files; it never runs research code.
