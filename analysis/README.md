# Analysis

Auditable local Python behind the paper-figure ports. Scripts read canonical
source/curation data, compute and render on the researcher's machine, and can
publish only their finished output through `pmt.publish()`.

| File | Figure | Notes |
| --- | --- | --- |
| `paper_district_heatmap.py` | District × UC complete-transfer matrix | DB-direct; `--diff` lists cells gained/lost vs the paper baseline, `--explain CAMPUS DISTRICT` prints course-level receipts, `--figure out.png` renders the paper-style matrix |
| `paper_figures.ipynb` | API-based local workspace | Pulls canonical bulk exports, builds a matplotlib figure, and publishes the finished files |
| `paper_credit_loss.py` | Figure 1 — credit loss | Decision-for-decision port of the paper pipeline; writes JSON/CSV receipts under `results/` |

## Running

```bash
cd analysis
python3 -m venv .venv && .venv/bin/pip install -r ../scripts/requirements.txt pulp matplotlib
# DB-direct scripts load ../scripts/.env themselves: MONGO_URI (or
# TARGET_MONGO_URI) + DB_NAME (default pmt_research). pulp (CBC) is for
# paper_credit_loss.py; matplotlib only for --figure renders.
.venv/bin/python paper_district_heatmap.py --diff
.venv/bin/python paper_credit_loss.py --diff     # ~2–4 min on a laptop
.venv/bin/python paper_credit_loss.py --requirements assist --workers 8 --diff
```

The notebook uses the downloaded `starter.py` and a personal `PMT_TOKEN`.
