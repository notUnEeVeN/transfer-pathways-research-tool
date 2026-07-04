"""Reproduce the console's "Paper-style district transfer heatmap" from the DB.

This is a faithful, readable port of the exact computation behind the figure,
so the math can be audited end-to-end. The website pipeline it mirrors:

  frontend  PaperDistrictHeatmap.jsx
     └─ GET /analysis/coverage?majorContains=computer science
                              &groupBy=district&requirements=paper
        └─ server/services/analysis/pathways.js :: hardRequirementCoverageData()

The model, in words
-------------------
1. WHAT COUNTS AS "REQUIRED" comes from `ref_uc_transfer_requirements` — the
   hand-curated per-campus hard transfer minimums scraped from university
   websites (imported by scripts/import_uc_transfer_requirements.py), NOT from
   ASSIST's required/recommended grouping. Each campus's requirements form:

       group  →  alternative sets  →  requirements (university course codes)

   A GROUP is one demand ("intro programming", "data structures", ...). Each
   group offers one or more SETS — alternative ways to satisfy it (e.g. the
   two-quarter intro sequence OR the single accelerated course). A set lists
   the university courses it needs; each course is identified by the
   university-catalog `parent_ids` it was matched to.

2. WHAT COUNTS AS "ARTICULATED" comes from the ASSIST-derived `uc_agreements`.
   ASSIST is used ONLY as an equivalency source here: we walk every receiver
   in every CS agreement (required or not) and collect the university-course
   parent_ids whose `articulation_status == 'articulated'` — i.e. the campus
   courses a CC student can actually earn credit for at that college.

3. EVALUATION (per campus × district):
   - Pool the articulated parent_ids of every college in the district (the
     paper's district framing: a student can attend any college in their
     district, so the district gets the best of its colleges).
   - A requirement is articulated when ANY of its parent_ids is in the pool.
   - A set is satisfied when ALL of its requirements are articulated.
   - A group is satisfied when ANY of its sets is satisfied.
   - The cell is COMPLETE (dark square) when EVERY group is satisfied.

4. The paper baseline is the published matrix, transcribed as one bit-string
   per campus (1 = complete). Campuses were anonymized UC1–UC9 in the paper;
   the id → campus mapping used throughout this repo is embedded below.

Usage
-----
  python paper_district_heatmap.py                 # matrix + comparison stats
  python paper_district_heatmap.py --diff          # list gained/lost cells
  python paper_district_heatmap.py --explain davis "west valley"
                                                   # receipts for one cell
  python paper_district_heatmap.py --figure out.png  # paper-style PNG

Env (scripts/.env or shell): MONGO_URI / TARGET_MONGO_URI, DB_NAME
(default pmt_research). Requires: pymongo, python-dotenv; matplotlib only
for --figure.
"""

import argparse
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

# The figure is the CS story: every major whose name contains this (UCB's
# "Electrical Engineering & Computer Sciences" etc. included), matching the
# console's fixed filter.
MAJOR_FILTER = re.compile("computer science", re.IGNORECASE)

# ── the paper's frame: 72 districts (column order) and 9 campuses (row order) ─
# District names as printed in the paper's matrix, left to right. Our data
# joins on `ref_cc_districts.district`, normalized (see normalize_name).
DISTRICTS = [
    "Allan Hancock Joint Community College District",
    "Antelope Valley Community College District",
    "Barstow Community College District",
    "Butte-Glenn Community College District",
    "Cabrillo Community College District",
    "Cerritos Community College District",
    "Chabot-Las Positas Community College District",
    "Chaffey Community College District",
    "Citrus Community College District",
    "Coast Community College District",
    "Compton Community College District",
    "Contra Costa Community College District",
    "Copper Mountain Community College District",
    "Desert Community College District",
    "El Camino Community College District",
    "Feather River Community College District",
    "Foothill-De Anza Community College District",
    "Gavilan Community College District",
    "Glendale Community College District",
    "Grossmont-Cuyamaca Community College District",
    "Hartnell Community College District",
    "Imperial Community College District",
    "Kern Community College District",
    "Lake Tahoe Community College District",
    "Lassen Community College District",
    "Long Beach Community College District",
    "Los Angeles Community College District",
    "Los Rios Community College District",
    "Marin Community College District",
    "Mendocino-Lake Community College District",
    "Merced Community College District",
    "MiraCosta Community College District",
    "Monterey Peninsula Community College District",
    "Mt. San Antonio Community College District",
    "Mt. San Jacinto Community College District",
    "Napa Valley Community College District",
    "North Orange County Community College District",
    "Ohlone Community College District",
    "Palo Verde Community College District",
    "Palomar Community College District",
    "Pasadena Area Community College District",
    "Peralta Community College District",
    "Rancho Santiago Community College District",
    "Redwoods Community College District",
    "Rio Hondo Community College District",
    "Riverside Community College District",
    "San Bernardino Community College District",
    "San Diego Community College District",
    "San Francisco Community College District",
    "San Joaquin Delta Community College District",
    "San Jose-Evergreen Community College District",
    "San Luis Obispo County Community College District",
    "San Mateo County Community College District",
    "Santa Barbara Community College District",
    "Santa Clarita Community College District",
    "Santa Monica Community College District",
    "Sequoias Community College District",
    "Shasta-Tehama-Trinity Joint Community College District",
    "Sierra Joint Community College District",
    "Siskiyou Joint Community College District",
    "Solano Community College District",
    "Sonoma County Junior College District",
    "South Orange County Community College District",
    "Southwestern Community College District",
    "State Center Community College District",
    "Ventura County Community College District",
    "Victor Valley Community College District",
    "West Hills Community College District",
    "West Kern Community College District",
    "West Valley-Mission Community College District",
    "Yosemite Community College District",
    "Yuba Community College District",
]

# Paper rows, top to bottom: (paper id, campus, our school_id, baseline bits).
# The '*' ids are as printed in the paper. bits[i] == '1' means the paper
# showed campus × DISTRICTS[i] as a complete transfer path.
UC_ROWS = [
    ("UC1*", "UC Davis",         89,  "010011100101000010100000001110010010110111000110100110000010101011000000"),
    ("UC2",  "UC Merced",        144, "111111111111111011111111011111111111110111101111111111110111111111000111"),
    ("UC3*", "UC San Diego",     7,   "011011100111001010110100001100010110110111100001100111110010001111000100"),
    ("UC4*", "UC Santa Barbara", 128, "000111110101111011111000011110010110110111100111111011111110011011101101"),
    ("UC5*", "UC Los Angeles",   117, "000011111101001010111010011110011111110111101111111011110010101111000101"),
    ("UC6",  "UC Berkeley",      79,  "111111111111111011111111011111111111110111111111111111111111111111111111"),
    ("UC7*", "UC Santa Cruz",    132, "110111100101011011011010001110111010110111000110111111110010111111000111"),
    ("UC8*", "UC Irvine",        120, "011011100111101010110000011110111010100111100111101011010000001111000100"),
    ("UC9*", "UC Riverside",     46,  "101111101101111011110011011111111110110111101111111111111111011010100111"),
]


def normalize_name(value):
    """Match the frontend's district-name normalization (accents, '&', punct)."""
    import unicodedata
    s = unicodedata.normalize("NFKD", str(value or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", s).strip().lower()


def connect():
    load_dotenv(Path(__file__).resolve().parent.parent / "scripts" / ".env")
    uri = os.environ.get("MONGO_URI") or os.environ.get("TARGET_MONGO_URI")
    if not uri:
        sys.exit("Set MONGO_URI (or TARGET_MONGO_URI) — see scripts/.env")
    name = os.environ.get("DB_NAME") or os.environ.get("TARGET_DB_NAME") or "pmt_research"
    return MongoClient(uri, compressors="zlib")[name]


# ── step 1: each campus's hard-requirement model ─────────────────────────────

def load_requirement_models(db):
    """school_id → {'groups': {group_id: {set_id: [requirement]}}, 'parent_ids': set}

    A requirement is {'code': receiving_code, 'parent_ids': [int]} — the
    university course and the catalog ids it was matched to. `parent_ids`
    doubles as the campus's "courses that matter" universe: articulated
    courses outside it can't satisfy anything, so we ignore them.
    """
    models = {}
    rows = db.ref_uc_transfer_requirements.find().sort(
        [("school_id", 1), ("group_id", 1), ("set_id", 1), ("source_order", 1)]
    )
    for row in rows:
        m = models.setdefault(int(row["school_id"]), {"groups": {}, "parent_ids": set()})
        pids = [int(p) for p in (row.get("parent_ids") or [])]
        m["parent_ids"].update(pids)
        group = m["groups"].setdefault(str(row["group_id"]), {})
        group.setdefault(str(row["set_id"]), []).append(
            {"code": row.get("receiving_code"), "parent_ids": pids}
        )
    return models


# ── step 2: articulated university courses per (campus, district, college) ──

def receiver_parent_ids(receiver):
    """University-catalog ids a receiver points at (course or series)."""
    receiving = receiver.get("receiving") or {}
    if receiving.get("kind") == "course" and receiving.get("parent_id") is not None:
        return [int(receiving["parent_id"])]
    if receiving.get("kind") == "series":
        return [int(p) for p in (receiving.get("parent_ids") or [])]
    return []


def load_articulations(db, models):
    """(school_id, district) → {college name → set(articulated parent_ids)}

    Walks EVERY receiver of every CS agreement (ASSIST as an equivalency
    source — its required/recommended grouping is deliberately ignored; the
    requirement model above decides what is required).
    """
    district_of = {
        int(d["_id"]): d.get("district")
        for d in db.ref_cc_districts.find({}, {"district": 1})
    }
    per_cell = defaultdict(lambda: defaultdict(set))
    fields = {"uc_school_id": 1, "community_college_id": 1, "community_college": 1,
              "major": 1, "requirement_groups": 1}
    for doc in db.uc_agreements.find({"major": MAJOR_FILTER}, fields):
        school_id = int(doc["uc_school_id"])
        model = models.get(school_id)
        if not model:
            continue  # campus without a curated requirement model
        district = district_of.get(int(doc["community_college_id"]))
        if not district:
            continue  # college not mapped to a district
        key = (school_id, normalize_name(district))
        college = doc.get("community_college")
        for group in doc.get("requirement_groups") or []:
            for section in group.get("sections") or []:
                for receiver in section.get("receivers") or []:
                    if receiver.get("articulation_status") != "articulated":
                        continue
                    for pid in receiver_parent_ids(receiver):
                        if pid in model["parent_ids"]:
                            per_cell[key][college].add(pid)
    return per_cell


# ── step 3: evaluate a cell ──────────────────────────────────────────────────

def evaluate(model, articulated):
    """Complete ⇔ every group has ≥1 set whose requirements are all articulated.

    Returns (complete, unsatisfied) where unsatisfied lists, per failed group,
    the closest set and the university courses it is still missing.
    """
    unsatisfied = []
    for group_id, sets in model["groups"].items():
        best = None
        satisfied = False
        for set_id, requirements in sets.items():
            missing = [r["code"] for r in requirements
                       if not any(p in articulated for p in r["parent_ids"])]
            if requirements and not missing:
                satisfied = True
                break
            if best is None or len(missing) < len(best[1]):
                best = (set_id, missing)
        if not satisfied:
            unsatisfied.append((group_id, best[0], best[1]))
    return (not unsatisfied, unsatisfied)


def build_matrix(models, per_cell):
    """{(paper id, district index) → bool} over the paper's 9 × 72 frame."""
    matrix = {}
    for uc_id, _campus, school_id, _bits in UC_ROWS:
        for idx, district in enumerate(DISTRICTS):
            colleges = per_cell.get((school_id, normalize_name(district)), {})
            pooled = set().union(*colleges.values()) if colleges else set()
            complete, _ = evaluate(models[school_id], pooled)
            matrix[(uc_id, idx)] = complete
    return matrix


# ── reporting ────────────────────────────────────────────────────────────────

def print_matrix(matrix):
    print(f"{'':>5}" + " district index →")
    for uc_id, campus, _sid, _bits in UC_ROWS:
        cells = "".join("█" if matrix[(uc_id, i)] else "·" for i in range(len(DISTRICTS)))
        print(f"{uc_id:>5} {cells}  {campus}")


def print_comparison(matrix, diff=False):
    ours = sum(matrix.values())
    paper = sum(bits.count("1") for _, _, _, bits in UC_ROWS)
    gained, lost = [], []
    for uc_id, campus, _sid, bits in UC_ROWS:
        for idx, district in enumerate(DISTRICTS):
            live, base = matrix[(uc_id, idx)], bits[idx] == "1"
            if live and not base:
                gained.append((uc_id, campus, district))
            if base and not live:
                lost.append((uc_id, campus, district))
    agree = len(DISTRICTS) * len(UC_ROWS) - len(gained) - len(lost)
    print(f"\nour complete cells:   {ours}")
    print(f"paper complete cells: {paper}")
    print(f"agreement: {agree}/{len(DISTRICTS) * len(UC_ROWS)} cells"
          f" · gained {len(gained)} · lost {len(lost)}")
    if diff:
        for label, cells in (("GAINED (ours only)", gained), ("LOST (paper only)", lost)):
            print(f"\n{label}: {len(cells)}")
            for uc_id, campus, district in cells:
                print(f"  {uc_id} {campus}  ×  {district}")


def explain(db, models, per_cell, campus_query, district_query):
    """Receipts for one cell: per college, which CC courses articulate which
    required university courses, and what (if anything) is still missing."""
    row = next((r for r in UC_ROWS if campus_query.lower() in r[1].lower()), None)
    district = next((d for d in DISTRICTS if district_query.lower() in d.lower()), None)
    if not row or not district:
        sys.exit(f"no match for campus {campus_query!r} / district {district_query!r}")
    uc_id, campus, school_id, bits = row
    model = models[school_id]
    colleges = per_cell.get((school_id, normalize_name(district)), {})

    # CC course names for the receipts: parent_id → the CC courses whose
    # articulated receivers point at it, per college.
    cc_courses = defaultdict(lambda: defaultdict(set))
    docs = db.uc_agreements.find(
        {"uc_school_id": school_id, "major": MAJOR_FILTER},
        {"community_college": 1, "requirement_groups": 1},
    )
    for doc in docs:
        college = doc.get("community_college")
        if college not in colleges:
            continue
        for group in doc.get("requirement_groups") or []:
            for section in group.get("sections") or []:
                for receiver in section.get("receivers") or []:
                    if receiver.get("articulation_status") != "articulated":
                        continue
                    pids = [p for p in receiver_parent_ids(receiver) if p in model["parent_ids"]]
                    if not pids:
                        continue
                    names = {
                        f"{c.get('prefix', '')}{c.get('number', '')}".strip() or str(cid)
                        for option in receiver.get("options") or []
                        for cid in option.get("course_ids") or []
                        for c in [db.courses.find_one({"course_id": int(cid)},
                                                      {"prefix": 1, "number": 1}) or {}]
                    }
                    for pid in pids:
                        cc_courses[college][pid].update(names)

    print(f"\n{uc_id} {campus}  ×  {district}")
    print(f"paper baseline: {'complete' if bits[DISTRICTS.index(district)] == '1' else 'missing'}")
    for college, articulated in sorted(colleges.items()):
        complete, unsatisfied = evaluate(model, articulated)
        print(f"\n  {college}: {'COMPLETE' if complete else 'incomplete'}")
        for group_id, sets in model["groups"].items():
            for set_id, requirements in sets.items():
                marks = []
                for r in requirements:
                    hit = next((p for p in r["parent_ids"] if p in articulated), None)
                    via = ", ".join(sorted(cc_courses[college].get(hit, []))) if hit else "—"
                    marks.append(f"{r['code']} {'✓ via ' + via if hit else '✗ not articulated'}")
                print(f"    group {group_id} / set {set_id}: " + " | ".join(marks))


def save_figure(matrix, path):
    import matplotlib.pyplot as plt
    import numpy as np
    grid = np.array([[matrix[(uc_id, i)] for i in range(len(DISTRICTS))]
                     for uc_id, _, _, _ in UC_ROWS], dtype=int)
    fig, ax = plt.subplots(figsize=(14, 2.6))
    ax.imshow(grid, cmap="Blues", vmin=0, vmax=1.4, aspect="equal")
    ax.set_yticks(range(len(UC_ROWS)), [r[0] for r in UC_ROWS], fontsize=8)
    ax.set_xticks(range(len(DISTRICTS)), [str(i) for i in range(len(DISTRICTS))],
                  fontsize=5, rotation=90)
    ax.set_xlabel("Community College District")
    ax.set_ylabel("UC Campus")
    ax.set_xticks(np.arange(-0.5, len(DISTRICTS)), minor=True)
    ax.set_yticks(np.arange(-0.5, len(UC_ROWS)), minor=True)
    ax.grid(which="minor", color="black", linewidth=0.4)
    ax.tick_params(which="both", length=0)
    fig.tight_layout()
    fig.savefig(path, dpi=200)
    print(f"figure written to {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--diff", action="store_true", help="list gained/lost cells vs the paper")
    ap.add_argument("--explain", nargs=2, metavar=("CAMPUS", "DISTRICT"),
                    help="receipts for one cell, e.g. --explain davis 'west valley'")
    ap.add_argument("--figure", metavar="PATH", help="save a paper-style PNG")
    args = ap.parse_args()

    db = connect()
    models = load_requirement_models(db)
    per_cell = load_articulations(db, models)
    matrix = build_matrix(models, per_cell)

    print_matrix(matrix)
    print_comparison(matrix, diff=args.diff)
    if args.explain:
        explain(db, models, per_cell, *args.explain)
    if args.figure:
        save_figure(matrix, args.figure)


if __name__ == "__main__":
    main()
