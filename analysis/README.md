# Analysis

Auditable Python behind the paper-figure ports. Each module is a from-scratch
reimplementation of a computation the website performs (or a computation the
website consumes as committed JSON) — deliberately sharing no code with the
server, so the two implementations verify each other. Methodology and results
live in [`docs/figures/`](../docs/README.md).

| File | Figure | Notes |
| --- | --- | --- |
| `paper_district_heatmap.py` | District × UC complete-transfer matrix | DB-direct; `--diff` lists cells gained/lost vs the paper baseline, `--explain CAMPUS DISTRICT` prints course-level receipts, `--figure out.png` renders the paper-style matrix |
| `paper_figures.ipynb` | All `/analysis/*` endpoints | Read-only reproduction harness against the live API (token auth) |
| `paper_credit_loss.py` | Figure 1 — credit loss | Decision-for-decision port of the paper pipeline (exact receiver key filter, single-best-college pooling, optimal set-cover over all P(9,4) permutations; subset-memoized, multiprocessed); writes `frontend/src/analyses/data/paper-credit-loss.ours.json` + `results/paper_credit_loss_districts.csv`; `--requirements assist` writes the ASSIST-stated-minimums variant + assist receipts; `--diff` per-bar deltas; `--validate-paper` runs OUR algorithm on the PAPER's district CSVs; `--articulation-diff` writes the course-level change list (`results/articulation_changes.csv`) |

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

The notebook instead talks to the running API — paste a Firebase ID token
where its first cell says so.
