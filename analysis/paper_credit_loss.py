"""Recompute paper Figure 1 ("credit loss in transfer pathways") on our data.

This is a faithful, readable port of the paper pipeline behind
`question_1/csvs/2026/order_4/optimal_order_{1..4}_averages.csv` in
transfer-agreements-analysis — the numbers drawn as the BLUE bars of Figure 1 —
plus the derivation of the GOLD requirement bars. Outputs stay in
`analysis/results`; finished figures are published locally with pmt.publish().

The paper's method, in words
----------------------------
(paper repo: creating_districts/creating_district_csvs.py +
question_1/scripts/scripts_for_data/optimal_total_combinations.py)

1. REQUIREMENT ROWS. Each campus's hand-curated hard minimums
   (course_reqs.json → `curated_requirements`, kind `transfer_minimum`) form
   group → alternative sets → rows (university courses). The paper filtered
   its ASSIST-scraped college CSVs down to exactly these rows.

2. SENDING OPTIONS PER ROW, PER COLLEGE. From the college's ASSIST CS
   agreement: the CC-course alternatives that articulate the row's university
   course. An alternative is an AND-bundle of CC courses; a row offers OR
   alternatives. (Our source: `assist_agreements` receivers;
   `options[].course_conjunction` / `options_conjunction` encode the same
   AND/OR structure as the paper's semicolon bundles / "Courses Group N"
   columns. The source rows live in `assist_agreements`.)

   RECEIVER → ROW MAPPING, exactly as the paper's key filter behaves
   (creating_district_csvs.py kept a scraped row only when its Receiving
   string EXACTLY matched a curated key — a single required course, or one
   whole set's combined course list). A receiver therefore maps:
     - to ONE per-course row, when its receiving covers exactly that row's
       university course and nothing else;
     - to a COMBINED whole-set row, when its receiving covers exactly every
       course of one multi-course set (the paper's own CSVs carry exactly two
       such combined rows in all 72 districts: UCR Calc "MATH 9A; 9B; 9C" and
       UCI Intro "I&C SCI 31; 32; 33" — series receivers, kept whole);
     - NOWHERE otherwise: partial-series or cross-group receivers are
       DROPPED, exactly as a receiving string matching no curated key was.
       (Observed both ways: Irvine Valley's partial "31+32" series and
       Antelope Valley's cross-group "ECS 036A+B+C" series have no curated
       key; the paper-era Antelope Valley CSV indeed contains no 036 rows.)

   VISIBILITY, exactly as the paper's scrape behaves: a row identity (per-
   course or combined) that no exact-matching receiver MENTIONS — articulated
   or not — is INVISIBLE for that district: it costs nothing and does not
   count as unarticulated, because such rows never appeared in the paper's
   college CSVs. Rows mentioned WITHOUT an articulated path count as
   unarticulated (the scrape's synthetic "Not Articulated" rows).

3. DISTRICT POOLING — SINGLE BEST COLLEGE PER ROW. For each requirement row,
   the district keeps ONE college's alternatives: the college whose smallest
   alternative has the fewest courses. Ties are broken by college name
   ascending — the deterministic analogue of the paper's tie-break, which was
   file-system order (its stable sort kept the first CSV read; that order is
   not reproducible even by the paper's authors). With the exact receiver
   mapping above, no observed figure number depends on this tie-break.
   Rows articulated nowhere in the district stay unarticulated.

4. OPTIMAL SET COVER PER UC-SUBSET. For a set of campuses, one joint MILP
   (CBC, same solver family as the paper's PuLP model) picks EXACTLY ONE set
   per group per campus and, for each row of the chosen sets that has
   options, exactly one alternative — minimizing the number of DISTINCT CC
   course names selected. Quirks replicated deliberately:
     - Rows without options are free: the solver may choose a set with
       unarticulated rows if that costs fewer courses, even when a fully
       articulated sibling set exists. Those rows count as unarticulated.
     - Groups whose chosen set produced no bundles count the receiving codes
       of their smallest set as unarticulated (the paper's fallback branch).
     - Course identity is the display NAME (prefix number (units)) — the
       paper's district merge deduplicates same-named courses across sibling
       colleges, and across campuses within a permutation.

5. CHOICE POSITIONS. For each of the P(9,4) = 3,024 ordered 4-campus
   permutations, the position-k value for the campus at slot k is
   max(0, |cover(first k campuses)| − |cover(first k−1 campuses)|): the
   marginal courses the k-th choice adds to the running pooled cover.
   Because the joint cover is solved on the SET of campuses (the MILP does
   not care about their order), we memoize per subset — C(9,1..4) = 255
   solves per district instead of 12,096 — a pure speedup with identical
   results, modulo ties between equally-sized optima that the paper's rerun-
   per-permutation could resolve differently (the course COUNT, which is all
   the figure uses, is identical either way).

6. AVERAGES. Per district, campus and position: total ÷ 336 (permutations
   placing that campus at that position), rounded to 2 dp. The figure's
   TRANSFERABLE AVERAGE then averages, per position, the district values of
   the campuses whose rounded unarticulated average is exactly 0 in that
   district at that position — the paper's "fully transferable" filter —
   rounded to 2 dp again (round-then-average, as the paper does).

7. GOLD BARS. Per campus: sum over groups of the smallest set's row count =
   the campus's stated requirement in its own courses. Quarter campuses
   (all but UCB and UCM — the paper hardcoded the same split) convert to
   semester equivalents as round(count / 1.5, 2). The script ASSERTS these
   reproduce the paper's constants — both derive from the same curation, so
   drift means an import problem, and the run fails loudly.

Known deviations from the paper run (documented, deliberate)
-----------------------------------------------------------
- Equivalency sources: we union matching receivers across every CS-titled
  program of a college (e.g. "Computer Science and Engineering"), same as the
  console's other analyses; the paper scraped one CS agreement per college.
- options_conjunction == 'and' receivers expand to the cartesian product of
  their options' alternatives, capped at 64 combos (mirrors the console's
  optionSolver); the paper's scrape flattened these during CSV generation.
- Deterministic tie-breaks (college name; CBC's own determinism per subset).

Usage
-----
  .venv/bin/python paper_credit_loss.py                # compute + write outputs
  .venv/bin/python paper_credit_loss.py --diff         # per-bar deltas vs paper
  .venv/bin/python paper_credit_loss.py --workers 4    # limit parallelism

Env (scripts/.env or shell): MONGO_URI / TARGET_MONGO_URI, DB_NAME
(default pmt_research). Requires: pymongo, python-dotenv, pulp.

Outputs
-------
  results/paper-credit-loss.ours.json       (figure data)
  results/paper_credit_loss_districts.csv   (per-district receipts)
"""

import argparse
import csv
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from itertools import permutations, product
from multiprocessing import Pool, cpu_count
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pmt_eligibility as pmt_elig  # noqa: E402  faithful PMT eligibility port + our one modification
import pmt_min_courses as pmt_min  # noqa: E402  faithful PMT minimum-course optimizer port

MAJOR_FILTER_TEXT = "computer science"  # legacy label; loaders pin PAPER_MAJORS

# HARDCODED equivalency-source programs per campus — the frozen set every
# validated run used (7/9 exact 1st-choice replication; heatmap 99.5%).
# Frozen by exact stored name so admin visibility toggles can never change
# the figures. Single-program pinning was tested and REJECTED: ASSIST moved
# content between pages since the paper's scrape (e.g. Berkeley's paper-era
# CS math articulations now live on the EECS B.S. page), so only the union
# reproduces the paper's articulation surface.
PAPER_MAJORS = {
    89: ["Computer Science & Engineering B.S.", "Computer Science B.S."],
    144: ["APPLIED MATHEMATICAL SCIENCES, Computer Science Emphasis, B.S.",
          "COMPUTER SCIENCE AND ENGINEERING, B.S. "],  # trailing space is stored
    7: ["CSE: Computer Science B.S.",
        "CSE: Computer Science with a Specialization in Bioinformatics B.S.",
        "Mathematics/Computer Science B.S."],
    128: ["Computer Science, B.S."],
    117: ["Computer Science and Engineering/B.S.", "Computer Science/B.S.",
          "Linguistics and Computer Science/B.A."],
    79: ["Computer Science, B.A.", "Electrical Engineering & Computer Sciences, B.S."],
    132: ["Computer Science B.A.", "Computer Science B.S.", "Computer Science Minor",
          "Computer Science: Computer Game Design B.S."],
    120: ["Computer Science and Engineering, B.S.", "Computer Science, B.S."],
    46: ["Computer Science with Business Applications B.S.", "Computer Science, B.S."],
}


def paper_major_query():
    return {"$or": [{"uc_school_id": sid, "major": {"$in": majors}}
                    for sid, majors in PAPER_MAJORS.items()]}

# Paper x-axis order; ids/school_ids as everywhere else in this repo.
# `quarter` replicates grouped_bar_graph.py L64–84 (UCB and UCM are semester).
CAMPUSES = [
    {"code": "UCD", "id": "UC1*", "school_id": 89, "quarter": True},
    {"code": "UCM", "id": "UC2", "school_id": 144, "quarter": False},
    {"code": "UCSD", "id": "UC3*", "school_id": 7, "quarter": True},
    {"code": "UCSB", "id": "UC4*", "school_id": 128, "quarter": True},
    {"code": "UCLA", "id": "UC5*", "school_id": 117, "quarter": True},
    {"code": "UCB", "id": "UC6", "school_id": 79, "quarter": False},
    {"code": "UCSC", "id": "UC7*", "school_id": 132, "quarter": True},
    {"code": "UCI", "id": "UC8*", "school_id": 120, "quarter": True},
    {"code": "UCR", "id": "UC9*", "school_id": 46, "quarter": True},
]
CODE_BY_SCHOOL = {c["school_id"]: c["code"] for c in CAMPUSES}
CAMPUS_SCHOOL_IDS = {c["school_id"] for c in CAMPUSES}


def load_canonical_majors(db):
    """school_id -> [major] from the console's one-major-per-campus selection.

    Reads settings.app.visible_pairs (the admin-selected working
    dataset; lives in the research DB), scoped to the 9 figure campuses. The
    ASSIST variant uses this instead of the frozen PAPER_MAJORS union, so the
    figure tracks exactly what is selected in Settings. It falls back to
    PAPER_MAJORS only when no selection has ever been saved.
    """
    doc = db.settings.find_one({"_id": "app"})
    pairs = (doc or {}).get("visible_pairs")
    if not pairs:
        print("canonical majors: no settings.app selection — "
              "falling back to PAPER_MAJORS")
        return {sid: list(majors) for sid, majors in PAPER_MAJORS.items()}
    out = {}
    for p in pairs:
        sid = int(p["school_id"])
        if sid in CAMPUS_SCHOOL_IDS and sid not in out:
            out[sid] = [str(p["major"])]
    return out


def canonical_major_query(canonical):
    return {"$or": [{"uc_school_id": sid, "major": {"$in": majors}}
                    for sid, majors in canonical.items()]}

# The paper figure's constants (grouped_bar_graph.py L64–84 + the order CSVs'
# TRANSFERABLE AVERAGE rows) — the gold assertion + --diff baseline.
PAPER_GOLD = {  # code → (semester_equiv, quarter_count or None)
    "UCD": (5.33, 8), "UCM": (6, None), "UCSD": (4.67, 7), "UCSB": (4.67, 7),
    "UCLA": (4.67, 7), "UCB": (4, None), "UCSC": (3.33, 5), "UCI": (4, 6),
    "UCR": (3.33, 5),
}
PAPER_CHOICES = {  # code → [1st..4th choice transferable averages]
    "UCD": [7.07, 3.57, 2.55, 1.92], "UCM": [6.8, 2.78, 1.51, 0.81],
    "UCSD": [7.16, 3.16, 1.92, 1.27], "UCSB": [7.04, 3.05, 1.81, 1.11],
    "UCLA": [5.89, 2.25, 1.21, 0.65], "UCB": [4.83, 1.64, 0.83, 0.37],
    "UCSC": [5.15, 2.22, 1.56, 1.14], "UCI": [4.4, 2.31, 2.16, 1.61],
    "UCR": [4.0, 1.25, 0.76, 0.51],
}

K = 4  # choices per student, as in the paper
ORDINALS = ["1st", "2nd", "3rd", "4th"]


def connect():
    load_dotenv(Path(__file__).resolve().parent.parent / "scripts" / ".env")
    uri = os.environ.get("MONGO_URI") or os.environ.get("TARGET_MONGO_URI")
    if not uri:
        sys.exit("Set MONGO_URI (or TARGET_MONGO_URI) — see scripts/.env")
    name = os.environ.get("DB_NAME") or os.environ.get("TARGET_DB_NAME") or "pmt_research"
    return MongoClient(uri, compressors="zlib")[name]


# ── requirement model (same loader as paper_district_heatmap.py) ─────────────

def load_requirement_models(db):
    """school_id → {'groups': {group_id: {set_id: [row]}}, 'by_parent': {pid: [rowkey]}}

    A row is one required university course: {'key', 'code', 'parent_ids'}.
    `key` = (school_id, group_id, set_id, index) — the identity the MILP and
    the pooling work with (the paper's (UC, Group ID, Set ID, Receiving) key).
    """
    models = {}
    rows = db.curated_requirements.find({"kind": "transfer_minimum"}).sort(
        [("school_id", 1), ("group_id", 1), ("set_id", 1), ("source_order", 1)]
    )
    for row in rows:
        sid = int(row["school_id"])
        m = models.setdefault(sid, {"groups": {}, "by_parent": defaultdict(list)})
        group = m["groups"].setdefault(str(row["group_id"]), {})
        rows_in_set = group.setdefault(str(row["set_id"]), [])
        key = (sid, str(row["group_id"]), str(row["set_id"]), len(rows_in_set))
        pids = [int(p) for p in (row.get("parent_ids") or [])]
        rows_in_set.append({"key": key, "codes": {str(row.get("receiving_code"))}, "parent_ids": pids})
        for pid in pids:
            m["by_parent"][pid].append(key)
    return models


def required_course_count(model):
    """The campus's stated requirement: cheapest set per group, summed."""
    return sum(min(len(rows) for rows in sets.values()) for sets in model["groups"].values())


# ── sending options (receiver → alternatives, as the console's optionSolver) ─

def option_alternatives(option, name_of):
    ids = option.get("course_ids") or []
    if not ids:
        return []
    names = [name_of(int(i)) for i in ids]
    if option.get("course_conjunction") == "or":
        return [frozenset([n]) for n in names]
    return [frozenset(names)]  # 'and' (default): the whole list together


def receiver_alternatives(receiver, name_of):
    """OR-list of AND-bundles (frozensets of course names) satisfying a receiver.

    Mirrors optionSolver.receiverAlternatives, including the 64-combo cap on
    options_conjunction == 'and' cartesian products.
    """
    if receiver.get("articulation_status") != "articulated":
        return []
    per_option = [option_alternatives(o, name_of) for o in (receiver.get("options") or [])]
    per_option = [alts for alts in per_option if alts]
    if not per_option:
        return []

    if receiver.get("options_conjunction") == "and" and len(per_option) > 1:
        CAP = 64
        combos = [frozenset()]
        for alts in per_option:
            nxt = []
            for combo in combos:
                for alt in alts:
                    nxt.append(combo | alt)
                    if len(nxt) > CAP:
                        break
                if len(nxt) > CAP:
                    break
            if len(nxt) > CAP:
                combos = [frozenset().union(*(min(a, key=len) for a in per_option))]
                break
            combos = nxt
        return combos

    return [alt for alts in per_option for alt in alts]  # 'or' (default)


def receiver_parent_ids(receiver):
    receiving = receiver.get("receiving") or {}
    if receiving.get("kind") == "course" and receiving.get("parent_id") is not None:
        return [int(receiving["parent_id"])]
    if receiving.get("kind") == "series":
        return [int(p) for p in (receiving.get("parent_ids") or [])]
    return []


def load_district_rows(db, models):
    """district → ({row identity → [alternatives]}, {visible identities}),
    after the paper's exact-key mapping, pooling and visibility rules.

    A row identity is a per-course row key from the requirement model, or a
    COMBINED whole-set key (sid, group_id, set_id, -1) for series receivers
    covering one entire multi-course set (see the module docstring). A
    receiver whose receiving matches neither exactly is dropped, as its
    Receiving string matched no curated key in the paper's pipeline.

    Pooling: per (district, identity) keep the single best college's
    alternatives — smallest best-alternative, ties by college name (the
    paper's stable sort took the first college in file-system order; that
    order is not reproducible, so we fix name order).

    An identity is VISIBLE in a district when any exact-matching receiver
    mentions it, articulated or not; invisible identities are omitted from
    that district's model entirely.
    """
    import re
    district_of = {
        int(d["source_id"]): d.get("district")
        for d in db.assist_institutions.find(
            {"kind": "community_college"}, {"source_id": 1, "district": 1}
        )
    }
    # course_id → display name; the paper deduplicates by the printed
    # "PREFIX NUMBER (units)" string, so same-named courses at sibling
    # colleges (or the same course reached from two campuses) merge.
    name_of_cache = {}
    for c in db.assist_courses.find(
        {"side": "sending"}, {"course_id": 1, "prefix": 1, "number": 1, "units": 1}
    ):
        units = c.get("units")
        name_of_cache[int(c["course_id"])] = (
            f"{c.get('prefix', '?')} {c.get('number', c['course_id'])} ({units:.2f})"
            if isinstance(units, (int, float)) else
            f"{c.get('prefix', '?')} {c.get('number', c['course_id'])}"
        )

    def name_of(course_id):
        return name_of_cache.get(course_id, f"course:{course_id}")

    # Per campus: row key → its parent_ids, and set key → (all row keys,
    # union of parent_ids) for the exact-signature tests.
    row_pids = {}
    set_rows = {}
    for sid, m in models.items():
        for gid, sets in m["groups"].items():
            for set_id, rows in sets.items():
                for r in rows:
                    row_pids[r["key"]] = set(r["parent_ids"])
                set_rows[(sid, gid, set_id)] = (
                    {r["key"] for r in rows},
                    set().union(*(r["parent_ids"] for r in rows)) if rows else set(),
                )

    def identity_for(model, receiver):
        """The row identity a receiver maps to under the paper's exact-key
        filter, or None (dropped)."""
        pids = set(receiver_parent_ids(receiver))
        if not pids:
            return None
        covered = {rk for pid in pids for rk in model["by_parent"].get(pid, [])}
        if not covered:
            return None
        if len(covered) == 1:
            (rk,) = covered
            return rk if pids <= row_pids[rk] else None
        set_keys = {rk[:3] for rk in covered}
        if len(set_keys) == 1:
            (sk,) = set_keys
            all_rows, all_pids = set_rows[sk]
            if covered == all_rows and pids <= all_pids:
                return (*sk, -1)  # combined whole-set row
        return None  # partial series / cross-set / cross-group → dropped

    # (district, identity) → {college → [alternatives]}
    per_row = defaultdict(lambda: defaultdict(list))
    visible = defaultdict(set)  # district → {identity mentioned by any receiver}
    fields = {"uc_school_id": 1, "community_college_id": 1, "community_college": 1,
              "requirement_groups": 1}
    for doc in db.assist_agreements.find(paper_major_query(), fields):
        model = models.get(int(doc["uc_school_id"]))
        if not model:
            continue
        district = district_of.get(int(doc["community_college_id"]))
        if not district:
            continue
        college = doc.get("community_college")
        for group in doc.get("requirement_groups") or []:
            for section in group.get("sections") or []:
                for receiver in section.get("receivers") or []:
                    identity = identity_for(model, receiver)
                    if identity is None:
                        continue
                    visible[district].add(identity)
                    alts = receiver_alternatives(receiver, name_of)
                    if not alts:
                        continue
                    per_row[(district, identity)][college].extend(alts)

    options = defaultdict(dict)
    for (district, rowkey), colleges in per_row.items():
        best_college = min(
            colleges,
            key=lambda c: (min(len(a) for a in colleges[c]), c),
        )
        # dedupe that college's alternatives, deterministic order
        seen, alts = set(), []
        for alt in colleges[best_college]:
            if alt not in seen:
                seen.add(alt)
                alts.append(alt)
        options[district][rowkey] = alts
    return {d: (options.get(d, {}), visible[d]) for d in visible}


# ── the paper's optimal set cover (optimal_total_combinations.py L63–189) ────

def optimal_set_cover(rows, options_of):
    """rows: list of row dicts; options_of: rowkey → [frozenset names].

    Returns (selected_names, rowkey → chosen bundle or None-for-unarticulated,
    by exactly the paper's MILP: minimize distinct courses; exactly one set
    per (campus, group); rows of the chosen set with options must pick one.
    """
    import pulp

    req_options = {r["key"]: options_of.get(r["key"], []) for r in rows}
    all_names = sorted({n for opts in req_options.values() for opt in opts for n in opt})

    model = pulp.LpProblem("OptimalSetCover", pulp.LpMinimize)
    x = pulp.LpVariable.dicts("x", range(len(all_names)), cat="Binary")
    name_idx = {n: i for i, n in enumerate(all_names)}
    y = {r["key"]: pulp.LpVariable.dicts(f"y_{i}", range(len(req_options[r["key"]])), cat="Binary")
         for i, r in enumerate(rows)}

    model += pulp.lpSum(x.values())

    # exactly one set per (campus, group)
    sets_by_group = defaultdict(set)
    for r in rows:
        sid, group_id, set_id, _ = r["key"]
        sets_by_group[(sid, group_id)].add(set_id)
    z = {}
    for (sid, group_id), set_ids in sets_by_group.items():
        for set_id in set_ids:
            z[(sid, group_id, set_id)] = pulp.LpVariable(f"z_{sid}_{group_id}_{set_id}", cat="Binary")
        model += pulp.lpSum(z[(sid, group_id, s)] for s in set_ids) == 1

    for r in rows:
        opts = req_options[r["key"]]
        if not opts:
            continue  # unarticulated row: free, like the paper
        sid, group_id, set_id, _ = r["key"]
        z_req = z[(sid, group_id, set_id)]
        sum_y = pulp.lpSum(y[r["key"]][i] for i in range(len(opts)))
        model += sum_y >= z_req            # chosen set's row must be satisfied
        model += sum_y <= len(opts) * z_req  # unchosen set's row must be 0
        model += sum_y <= 1
        for i, opt in enumerate(opts):
            for n in opt:
                model += x[name_idx[n]] >= y[r["key"]][i]

    status = model.solve(pulp.PULP_CBC_CMD(msg=False))
    if pulp.LpStatus[status] != "Optimal":
        return set(), {}
    chosen_bundles = {}
    for r in rows:
        for i, opt in enumerate(req_options[r["key"]]):
            if pulp.value(y[r["key"]][i]) > 0.5:
                chosen_bundles[r["key"]] = opt
                break
    selected = {n for i, n in enumerate(all_names) if pulp.value(x[i]) > 0.5}
    return selected, chosen_bundles


def district_groups(models, visible):
    """{sid: {group_id: {set_id: [row]}}} restricted to a district's visible
    row identities, with a synthetic combined row appended to a set when a
    whole-set series receiver mentions it — the paper's district CSVs carry
    those as ordinary extra rows of the set. A set/group with nothing visible
    simply doesn't exist for this district, exactly as such rows were absent
    from the paper's CSVs."""
    out = {}
    for sid, m in models.items():
        groups = {}
        for group_id, sets in m["groups"].items():
            vis = {}
            for set_id, rows in sets.items():
                kept = [r for r in rows if r["key"] in visible]
                combined_key = (sid, group_id, set_id, -1)
                if combined_key in visible:
                    kept.append({
                        "key": combined_key,
                        "codes": set().union(*(r["codes"] for r in rows)),
                        "parent_ids": [],
                    })
                if kept:
                    vis[set_id] = kept
            if vis:
                groups[group_id] = vis
        out[sid] = groups
    return out


def cover_counts(groups_by_sid, options_of, school_ids):
    """(articulated names, unarticulated names) for a campus subset — the
    paper's count_required_courses_optimal, on district-pooled rows."""
    rows = []
    for sid in school_ids:
        for sets in groups_by_sid[sid].values():
            for set_rows in sets.values():
                rows.extend(set_rows)
    _, chosen_bundles = optimal_set_cover(rows, options_of)

    articulated, unarticulated = set(), set()
    for sid in school_ids:
        for sets in groups_by_sid[sid].values():
            chosen_set_ids = {r["key"][2] for set_rows in sets.values()
                              for r in set_rows if r["key"] in chosen_bundles}
            if chosen_set_ids:
                for set_id in chosen_set_ids:
                    for r in sets[set_id]:
                        bundle = chosen_bundles.get(r["key"])
                        if bundle:
                            articulated.update(bundle)
                        else:
                            unarticulated.update(r["codes"])
            else:
                # the paper's fallback: the set with the fewest receiving
                # codes, counted entirely as unarticulated
                smallest = min(sets.values(),
                               key=lambda rs: len(set().union(*(r["codes"] for r in rs))))
                for r in smallest:
                    unarticulated.update(r["codes"])
    return frozenset(articulated), frozenset(unarticulated)


# ── per-district permutation sweep (order-invariant subset memoization) ──────

def district_totals(args):
    """One district: totals[(code, position)] = (art_sum, unart_sum) over all
    3,024 permutations, via the 255 distinct campus subsets."""
    district, groups_by_sid, options_of = args
    school_ids = [c["school_id"] for c in CAMPUSES]

    cache = {}

    def cover(subset):  # subset: frozenset of school_ids
        if subset not in cache:
            cache[subset] = cover_counts(groups_by_sid, options_of, sorted(subset))
        return cache[subset]

    totals = defaultdict(lambda: [0, 0])
    for combo in permutations(school_ids, K):
        prev_art, prev_unart = frozenset(), frozenset()
        for idx in range(K):
            art, unart = cover(frozenset(combo[: idx + 1]))
            code = CODE_BY_SCHOOL[combo[idx]]
            totals[(code, idx)][0] += max(0, len(art) - len(prev_art))
            totals[(code, idx)][1] += max(0, len(unart) - len(prev_unart))
            prev_art, prev_unart = art, unart
    return district, dict(totals)


# ── ASSIST-stated-minimums variant ───────────────────────────────────────────

def load_curation(db):
    return {
        "override_by_hash": {
            str(o["receiver_hash"]): o
            for o in db.curated_mappings.find({"kind": "receiver_override"})
        }
    }


def make_is_excluded(curation):
    overrides = curation["override_by_hash"]

    def is_excluded(receiver):
        return overrides.get(str(receiver.get("hash_id")), {}).get("exclude") is True

    return is_excluded


def cc_course_names(db):
    names = {}
    for c in db.assist_courses.find(
        {"side": "sending"}, {"course_id": 1, "prefix": 1, "number": 1, "units": 1}
    ):
        units = c.get("units")
        names[int(c["course_id"])] = (
            f"{c.get('prefix', '?')} {c.get('number', c['course_id'])} ({units:.2f})"
            if isinstance(units, (int, float)) else
            f"{c.get('prefix', '?')} {c.get('number', c['course_id'])}"
        )
    return names


def university_course_codes(db):
    """parent_id -> display course code, e.g. 'COMPSCI 61A'."""
    codes = {}
    fields = {"parent_id": 1, "course_code": 1, "prefix": 1, "number": 1}
    for c in db.assist_courses.find({"side": "receiving"}, fields).sort([("parent_id", 1)]):
        pid = c.get("parent_id")
        if pid is None or int(pid) in codes:
            continue
        code = c.get("course_code")
        if not code:
            code = f"{c.get('prefix', '')} {c.get('number', '')}".strip()
        if code:
            codes[int(pid)] = " ".join(str(code).split())
    return codes


def receiver_hash(receiver):
    receiving = receiver.get("receiving") or {}
    return str(receiver.get("hash_id") or
               f"{receiving.get('kind', 'receiver')}:{receiving.get('parent_id', '')}")


def receiver_unarticulated_identities(receiver, code_of_parent, fallback_counter):
    """University-course-code identities counted when this receiver blocks.

    Series receivers contribute one identity per resolved university course.
    Non-course or unresolved receivers fall back to their stable hash so they
    still block transferability instead of silently disappearing.
    """
    identities = []
    unresolved = False
    for pid in receiver_parent_ids(receiver):
        code = code_of_parent.get(int(pid))
        if code:
            identities.append(code)
        else:
            unresolved = True
    if unresolved or not identities:
        fallback_counter[0] += 1
        identities.append(f"hash:{receiver_hash(receiver)}")
    return tuple(sorted(set(identities)))


def advisement_value(value, default):
    if value is None:
        return default
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def section_need(section, receiver_ids):
    return min(advisement_value(section.get("section_advisement"), len(receiver_ids)),
               len(receiver_ids))


def dedup_alternatives(alts):
    seen, out = set(), []
    for alt in alts:
        if alt not in seen:
            seen.add(alt)
            out.append(alt)
    return sorted(out, key=lambda a: (len(a), tuple(sorted(a))))


def receiving_label(receiving, code_of_parent):
    """One human-readable label per receiver (the campus-side requirement)."""
    receiving = receiving or {}
    kind = receiving.get("kind")
    if kind == "course":
        pid = receiving.get("parent_id")
        code = code_of_parent.get(int(pid)) if pid is not None else None
        return code or f"course#{pid}"
    if kind == "series":
        parts = [code_of_parent.get(int(p)) or f"course#{p}" for p in receiving.get("parent_ids") or []]
        return " + ".join(parts) if parts else "series"
    if kind == "requirement":
        return receiving.get("name") or "requirement"
    if kind == "ge_area":
        return receiving.get("code") or receiving.get("name") or "ge_area"
    return kind or "receiver"


def blocker_identities(blockers, code_of_parent):
    """Flatten structured PMT blockers into one identity string per unmet slot.

    Course-grain (a genuinely must-take receiver) → its university course code.
    Choose-N section/group shortfalls → a "N of [A / B / C]" descriptor, one per
    unmet slot so the credit-loss magnitude counts every missing course.
    """
    out = []
    for b in blockers:
        if b["grain"] == "course":
            out.append(receiving_label(b["receiving"], code_of_parent))
            continue
        cands = " / ".join(sorted(receiving_label(c, code_of_parent) for c in b.get("candidates") or []))
        need = b.get("need")
        base = f"{need} of [{cands}]" if need is not None else f"[{cands}]"
        k = max(1, int(b.get("shortfall") or 1))
        out.extend([base] if k == 1 else [f"{base} #{i + 1}" for i in range(k)])
    return out


def prep_requirement_groups(doc, is_excluded):
    """Exclusion-filtered requirement_groups with option course_ids stringified.

    The optimizer's synthetic transcript rows carry str course_ids, so every
    option course_id it (and the eligibility engine) compares against must be a
    str too — raw DB ids are ints. Stringifying is output-invariant for the
    strict blocker walk (it compares synth-vs-option within one type) and
    required for the optimizer. All group/section/receiver fields are preserved.
    """
    out = []
    for g in doc.get("requirement_groups") or []:
        sections = []
        for s in g.get("sections") or []:
            recs = []
            for r in s.get("receivers") or []:
                if is_excluded(r):
                    continue
                opts = [{**o, "course_ids": [str(i) for i in (o.get("course_ids") or [])]}
                        for o in (r.get("options") or [])]
                recs.append({**r, "options": opts})
            sections.append({**s, "receivers": recs})
        out.append({**g, "sections": sections})
    return out


def referenced_option_ids(groups):
    """Every CC course_id (str) any option in these requirement_groups references."""
    return {str(i)
            for g in groups
            for s in g.get("sections") or []
            for r in s.get("receivers") or []
            for o in r.get("options") or []
            for i in o.get("course_ids") or []}


def agreement_demand_count(doc, is_excluded):
    """Number of required receivers the ASSIST agreement asks for, honoring
    choose-N (section/group advisements, OR sections) — the campus's ASSIST-
    stated minimum, feeding the gold bar. Excluded receivers don't count."""
    demand = 0
    for group in doc.get("requirement_groups") or []:
        if group.get("is_required") is False:
            continue
        section_needs = []
        for section in group.get("sections") or []:
            n_recv = sum(1 for r in (section.get("receivers") or []) if not is_excluded(r))
            section_needs.append(min(advisement_value(section.get("section_advisement"), n_recv), n_recv))
        if group.get("group_advisement") is not None:
            flat = sum(1 for section in group.get("sections") or []
                       for r in (section.get("receivers") or []) if not is_excluded(r))
            demand += min(advisement_value(group.get("group_advisement"), flat), flat)
        elif group.get("group_conjunction") == "Or" and len(group.get("sections") or []) > 1:
            demand += min(section_needs, default=0)
        else:
            demand += sum(section_needs)
    return demand


def build_assist_agreement_model(doc, is_excluded):
    """Normalize one ASSIST agreement (metadata + exclusion-filtered, id-stringified
    requirement_groups). These per-agreement models are pooled per (campus, district)
    by pool_campus_model before any cover is computed."""
    return {
        "school_id": int(doc["uc_school_id"]),
        "campus_code": CODE_BY_SCHOOL.get(int(doc["uc_school_id"]), str(doc["uc_school_id"])),
        "college_id": int(doc["community_college_id"]),
        "college": doc.get("community_college") or str(doc["community_college_id"]),
        "district": doc.get("_district"),
        "major": doc.get("major") or "",
        "requirement_groups": prep_requirement_groups(doc, is_excluded),
    }


def id_alternatives(receiver):
    """OR-list of AND-bundles (frozensets of str course_ids) that satisfy a receiver,
    reusing the website path's receiver_alternatives with an id-valued name map."""
    return receiver_alternatives(receiver, str)


def pool_campus_model(agreements):
    """Pool one campus's canonical-major agreements across sibling colleges into one
    requirement_groups — the paper's district pooling, done per UC receiver.

    The UC-side structure is uniform across colleges for a (campus, major) (verified:
    same required-receiver hash set), so we take it from the most complete agreement
    and, for each receiver (keyed by hash_id), keep the SINGLE BEST COLLEGE's CC-course
    alternatives — the college whose smallest alternative has the fewest courses, ties
    by college name. This is exactly the paper's per-row pooling (creating_district_csvs
    kept one college per requirement); unioning every college's alternatives is both
    wrong (the paper doesn't) and pathologically slow for the optimizer.
    """
    by_major = defaultdict(list)
    for a in agreements:
        by_major[a["major"]].append(a)

    def receiver_count(a):
        return sum(len(s.get("receivers") or [])
                   for g in a["requirement_groups"] for s in g.get("sections") or [])

    out_groups = []
    for major in sorted(by_major):
        ags = by_major[major]
        # per receiver hash: {college name -> set of that college's alternatives}
        by_hash = defaultdict(lambda: defaultdict(set))
        for a in ags:
            for g in a["requirement_groups"]:
                for s in g.get("sections") or []:
                    for r in s.get("receivers") or []:
                        alts = set(id_alternatives(r))
                        if alts:
                            by_hash[r.get("hash_id")][a["college"]] |= alts
        # keep the best college's alternatives per receiver (paper's per-row rule)
        pooled = {}
        for h, colmap in by_hash.items():
            best_col = min(colmap, key=lambda c: (min(len(b) for b in colmap[c]), c))
            pooled[h] = colmap[best_col]
        rep = max(ags, key=receiver_count)
        for g in rep["requirement_groups"]:
            sections = []
            for s in g.get("sections") or []:
                receivers = []
                for r in s.get("receivers") or []:
                    alts = pooled.get(r.get("hash_id")) or set()
                    if alts:
                        options = [{"course_ids": sorted(b), "course_conjunction": "and"}
                                   for b in sorted(alts, key=lambda x: (len(x), sorted(x)))]
                        receivers.append({**r, "articulation_status": "articulated",
                                          "options_conjunction": "or", "options": options})
                    else:
                        receivers.append({**r, "articulation_status": "not_articulated", "options": []})
                sections.append({**s, "receivers": receivers})
            out_groups.append({**g, "sections": sections})
    return out_groups


def pooled_gold_count(groups):
    """Distinct required UC courses the pooled model asks for — choose-N aware and
    dedup'd by UC receiving, so requirements shared across the campus's CS programs
    count once. The figure's gold bar (before quarter→semester conversion)."""
    required = set()
    for g in groups:
        if not g.get("is_required"):
            continue
        for s in g.get("sections") or []:
            pids, seen = [], []
            for r in s.get("receivers") or []:
                p = (r.get("receiving") or {}).get("parent_id")
                pids.append(p if p is not None else r.get("hash_id"))
            adv = s.get("section_advisement")
            need = min(adv, len(pids)) if adv is not None else len(pids)
            for p in pids:
                if p not in seen:
                    seen.append(p)
                if len(seen) >= need:
                    break
            required.update(seen)
    return len(required)


def modal_count(values):
    counts = Counter(values)
    if not counts:
        return 0
    top = max(counts.values())
    return min(v for v, n in counts.items() if n == top)


def load_assist_inputs(db):
    """Build the pooled per-(campus, district) requirement models the ASSIST figure
    needs — the paper's method with ASSIST demand.

    Demand = the ONE canonical CS major per campus from Settings
    (settings.app; falls back to PAPER_MAJORS); its ASSIST required
    groups define the minimum, and its articulations are pooled per UC receiver
    across sibling colleges within a district — exactly the paper's college pooling.
    Returns district_models[district] = {campus_sid: pooled_requirement_groups}, the
    per-campus gold (required UC course count), and the CC-course catalog.
    """
    is_excluded = make_is_excluded(load_curation(db))
    code_of_parent = university_course_codes(db)
    canonical = load_canonical_majors(db)

    # course_id -> {course_id, units, same_as, name} for the optimizer (str ids, to
    # match the stringified option ids in prep_requirement_groups).
    courses_by_id = {}
    for c in db.assist_courses.find(
        {"side": "sending"},
        {"course_id": 1, "prefix": 1, "number": 1, "units": 1, "same_as": 1, "same_as_keys": 1},
    ):
        cid = str(c["course_id"])
        units = c.get("units")
        label = f"{c.get('prefix', '?')} {c.get('number', cid)}"
        if isinstance(units, (int, float)):
            label = f"{label} ({units:.2f})"
        courses_by_id[cid] = {
            "course_id": cid,
            "units": units,
            "same_as": [{"course_id": str(p.get("course_id") if isinstance(p, dict) else p).replace("cc:", "")}
                        for p in (c.get("same_as_keys") or c.get("same_as") or [])],
            "name": label,
        }

    ref_by_cc = {int(r["source_id"]): r
                 for r in db.assist_institutions.find(
                     {"kind": "community_college"}, {"source_id": 1, "name": 1, "district": 1}
                 )}
    all_districts = sorted({r["district"] for r in ref_by_cc.values() if r.get("district")})

    fields = {"uc_school_id": 1, "community_college_id": 1, "community_college": 1,
              "major": 1, "requirement_groups": 1}
    by_district_campus = defaultdict(lambda: defaultdict(list))
    by_campus = defaultdict(list)
    n_agreements = 0
    for doc in db.assist_agreements.find(canonical_major_query(canonical), fields):
        ref = ref_by_cc.get(int(doc["community_college_id"]))
        if not ref or not ref.get("district"):
            continue
        doc["_district"] = ref["district"]
        m = build_assist_agreement_model(doc, is_excluded)
        # An articulated course ASSIST references but that is absent from the
        # `courses` collection still counts (the old figure counted it by name).
        for cid in referenced_option_ids(m["requirement_groups"]):
            if cid not in courses_by_id:
                courses_by_id[cid] = {"course_id": cid, "units": None,
                                      "same_as": [], "name": f"course:{cid}"}
        by_district_campus[m["district"]][m["school_id"]].append(m)
        by_campus[m["school_id"]].append(m)
        n_agreements += 1

    # Pool per (campus, district). A district with no agreement for a campus just
    # omits it (that campus counts as all-unarticulated in the cover).
    district_models = {
        district: {sid: pool_campus_model(ags)
                   for sid, ags in by_district_campus.get(district, {}).items()}
        for district in all_districts
    }

    # Gold bar: the campus's required UC course count. The UC-side structure is
    # uniform across districts, so compute once from the campus's union structure.
    gold = {}
    for c in CAMPUSES:
        native = pooled_gold_count(pool_campus_model(by_campus.get(c["school_id"], [])))
        gold[c["school_id"]] = {
            "native_count": native,
            "semester_equiv": round(native / 1.5, 2) if c["quarter"] else native,
            "quarter_count": native if c["quarter"] else None,
        }

    return {
        "district_models": district_models,
        "all_districts": all_districts,
        "gold": gold,
        "courses_by_id": courses_by_id,
        "code_of_parent": code_of_parent,
        "agreement_count": n_agreements,
    }


def no_agreement_unarticulated(sid, gold):
    """A campus with no agreement in a district counts as all-unarticulated, using
    its required UC course count (the gold native count)."""
    code = CODE_BY_SCHOOL[sid]
    return {f"{code} no agreement #{i + 1}" for i in range(gold[sid]["native_count"])}


def assist_district_totals(args):
    """One district: the paper's P(9,4) sweep, with the pooled ASSIST requirement
    models. cover(subset) = the PMT optimizer over the subset's present campuses
    (sharing CC courses), plus each campus's strict-eligibility blockers as
    unarticulated; campuses with no agreement in the district count as
    all-unarticulated."""
    district, models, courses_by_id, code_of_parent, gold = args
    school_ids = [c["school_id"] for c in CAMPUSES]

    # Per-campus strict blockers are independent of the subset — compute once.
    blockers_by_sid = {
        sid: frozenset(blocker_identities(
            pmt_elig.articulation_blockers({"requirement_groups": groups}, strict=True),
            code_of_parent))
        for sid, groups in models.items()
    }

    cache = {}

    def cover(subset):
        subset = frozenset(subset)
        if subset not in cache:
            majors, unart = [], set()
            for sid in sorted(subset):
                groups = models.get(sid)
                if groups is not None:
                    majors.append({"requirement_groups": groups})
                    unart |= blockers_by_sid.get(sid, frozenset())
                else:
                    unart |= no_agreement_unarticulated(sid, gold)
            course_ids = pmt_min.select_missing_across_majors_optimal(
                majors, {"user_courses": [], "courses_by_id": courses_by_id,
                         "include_recommended": False, "cross_cc": []}) if majors else []
            cache[subset] = (frozenset(course_ids), frozenset(unart))
        return cache[subset]

    totals = defaultdict(lambda: [0, 0])
    for combo in permutations(school_ids, K):
        prev_art, prev_unart = frozenset(), frozenset()
        for idx in range(K):
            art, unart = cover(frozenset(combo[: idx + 1]))
            code = CODE_BY_SCHOOL[combo[idx]]
            totals[(code, idx)][0] += max(0, len(art) - len(prev_art))
            totals[(code, idx)][1] += max(0, len(unart) - len(prev_unart))
            prev_art, prev_unart = art, unart

    singles = {}
    for sid in school_ids:
        art, unart = cover(frozenset([sid]))
        singles[CODE_BY_SCHOOL[sid]] = {
            "articulated_count": len(art),
            "unarticulated_count": len(unart),
            "unarticulated": tuple(sorted(unart)),
        }
    return district, dict(totals), singles


def coverage_complete_cells(district_models):
    """(campus, district) cells whose pooled model is fully articulable — the
    INDEPENDENT oracle (is_major_completed predicate path), distinct from the
    articulation_blockers walk that drives the figure's unarticulated counts."""
    return {
        (CODE_BY_SCHOOL[sid], district)
        for district, models in district_models.items()
        for sid, groups in models.items()
        if pmt_elig.is_major_articulable({"requirement_groups": groups}, strict=True)
    }


def validate_assist_coverage(district_models, singles_by_district):
    """Cross-check the figure's complete cells (blocker walk, unarticulated == 0)
    against the independent is_major_articulable oracle on the same pooled models.
    Both paths are locked to PMT's goldens by tests/test_pmt_fidelity.py."""
    walk_complete = {
        (code, district)
        for district, singles in singles_by_district.items()
        for code, row in singles.items()
        if row["unarticulated_count"] == 0
    }
    oracle_complete = coverage_complete_cells(district_models)
    missing = sorted(oracle_complete - walk_complete)
    extra = sorted(walk_complete - oracle_complete)
    print("\nASSIST coverage cross-check (blocker walk vs independent is_major_articulable):")
    print(f"  blocker-walk complete cells:     {len(walk_complete)}")
    print(f"  PMT-articulable complete cells:   {len(oracle_complete)}")
    if missing or extra:
        for code, district in missing[:20]:
            print(f"  MISSING in walk:  {code} × {district}")
        for code, district in extra[:20]:
            print(f"  EXTRA in walk:    {code} × {district}")
        raise RuntimeError(
            f"ASSIST coverage validation failed: {len(missing)} missing, {len(extra)} extra"
        )
    print("  OK")


def validate_assist_optimizer(district_models, courses_by_id):
    """Loop-closer: every pooled (campus × district) model's optimizer course set
    actually satisfies the eligibility engine (non-strict). Runs over every model,
    so any shape/type surprise the golden sample missed fails loudly here."""
    checked = 0
    for district, models in district_models.items():
        for sid, groups in models.items():
            major = {"requirement_groups": groups}
            ids = pmt_min.select_missing_across_majors_optimal(
                [major], {"user_courses": [], "courses_by_id": courses_by_id,
                          "include_recommended": False, "cross_cc": []})
            transcript = [pmt_min.synthetic_course_for(i, courses_by_id) for i in ids]
            if not pmt_elig.is_major_completed(major, transcript, [], strict=False):
                raise RuntimeError(
                    f"optimizer loop-closer failed: {CODE_BY_SCHOOL[sid]} × {district} — "
                    f"chosen set {sorted(ids)} does not satisfy the engine")
            checked += 1
    print(f"ASSIST optimizer loop-closer: {checked} pooled (campus×district) models — "
          f"every chosen course set satisfies the eligibility engine. OK")


def preserve_generated_at_if_unchanged(path, out):
    if not path.exists():
        return out
    try:
        old = json.loads(path.read_text())
    except Exception:
        return out
    old_cmp = dict(old)
    new_cmp = dict(out)
    old_cmp.pop("generated_at", None)
    new_cmp.pop("generated_at", None)
    if old_cmp == new_cmp and old.get("generated_at"):
        out = dict(out)
        out["generated_at"] = old["generated_at"]
    return out


def write_assist_blockers(root, singles_by_district):
    detailed = []
    counts = defaultdict(lambda: {"count": 0, "districts": []})
    complete = []
    for district, singles in sorted(singles_by_district.items()):
        for code, row in sorted(singles.items()):
            if row["unarticulated_count"] == 0:
                complete.append({
                    "campus": code,
                    "district": district,
                    "articulated_count": row["articulated_count"],
                })
            for identity in row["unarticulated"]:
                detailed.append({
                    "district": district,
                    "campus": code,
                    "unarticulated_receiver": identity,
                })
                key = (code, identity)
                counts[key]["count"] += 1
                counts[key]["districts"].append(district)

    summary = [
        {
            "campus": code,
            "unarticulated_receiver": identity,
            "districts_blocked": row["count"],
            "districts": " | ".join(sorted(row["districts"])),
        }
        for (code, identity), row in sorted(
            counts.items(),
            key=lambda kv: (-kv[1]["count"], kv[0][0], kv[0][1]),
        )
    ]

    paths = {}
    for name, rows in {
        "paper_credit_loss_assist_blockers.csv": detailed,
        "paper_credit_loss_assist_blocker_summary.csv": summary,
        "paper_credit_loss_assist_complete_districts.csv": complete,
    }.items():
        path = root / "results" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = list(rows[0].keys()) if rows else ["campus"]
        with open(path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
        paths[name] = path
    return paths


# ── course-level articulation change list (ours vs the paper's CSVs) ─────────

def normalize_district(name):
    import re as _re
    s = _re.sub(r"\.csv$", "", str(name)).replace("_", " ")
    s = " ".join(s.split()).lower()
    return _re.sub(r"\b(joint community college district|community college district|"
                   r"junior college district|ccd)\b", "", s).strip()


def articulation_diff(db, paper_repo):
    """Row-by-row articulation comparison against the paper's district CSVs.

    For every (district, campus, requirement row) — per-course or combined —
    classify: newly-articulated / no-longer-articulated / newly-mentioned /
    no-longer-mentioned / courses-changed / unchanged. Writes
    results/articulation_changes.csv (every non-unchanged row, with the exact
    paper-era and current CC courses) and prints a per-campus summary. This
    is the by-hand verification surface: each line names the courses to look
    up on ASSIST or in either dataset.
    """
    import csv as _csv
    models = load_requirement_models(db)
    districts = load_district_rows(db, models)
    code_of = {c["school_id"]: c["code"] for c in CAMPUSES}

    # our rows → (uc, group, set, receiving) with courses
    ours = defaultdict(dict)  # normalized district → key → set(course names)|None
    for district, (options_of, visible) in districts.items():
        nd = normalize_district(district)
        for identity in visible:
            sid, gid, set_id = identity[0], identity[1], identity[2]
            if identity[3] == -1:
                codes = set().union(*(r["codes"] for r in models[sid]["groups"][gid][set_id]))
            else:
                row = models[sid]["groups"][gid][set_id][identity[3]]
                codes = row["codes"]
            key = (code_of[sid], gid, set_id, "; ".join(sorted(codes)))
            alts = options_of.get(identity)
            courses = set().union(*alts) if alts else None  # None = mentioned, not articulated
            ours[nd][key] = courses

    theirs = defaultdict(dict)
    csv_dir = Path(paper_repo) / "district_csvs"
    for p in sorted(csv_dir.iterdir()):
        if p.suffix != ".csv":
            continue
        nd = normalize_district(p.name)
        with open(p, newline="") as f:
            for row in _csv.DictReader(f):
                uc = str(row.get("UC Name", "")).strip().upper()
                receiving = "; ".join(sorted(v.strip() for v in str(row.get("Receiving", "")).split(";") if v.strip()))
                key = (uc, " ".join(str(row.get("Group ID", "")).split()),
                       " ".join(str(row.get("Set ID", "")).split()), receiving)
                courses = set()
                articulated = str(row.get("College Name", "")).strip() != "Not Articulated"
                for col, val in row.items():
                    if not col or not col.lower().strip().startswith("courses group"):
                        continue
                    val = str(val or "").strip()
                    if not val or val.lower() in ("not articulated", "nan"):
                        continue
                    courses.update(v.strip() for v in val.split(";") if v.strip())
                theirs[nd][key] = courses if (articulated and courses) else None

    changes = []
    counts = defaultdict(lambda: defaultdict(int))
    for nd in sorted(set(ours) | set(theirs)):
        keys = set(ours.get(nd, {})) | set(theirs.get(nd, {}))
        for key in sorted(keys):
            o = ours.get(nd, {}).get(key, "ABSENT")
            t = theirs.get(nd, {}).get(key, "ABSENT")
            if o == t:
                continue
            if t == "ABSENT":
                change = "newly-articulated" if o is not None else "newly-mentioned"
            elif o == "ABSENT":
                change = "dropped-from-agreements"
            elif t is None and o is not None:
                change = "newly-articulated"
            elif o is None and t is not None:
                change = "no-longer-articulated"
            else:
                change = "courses-changed"
            counts[key[0]][change] += 1
            changes.append({
                "district": nd, "campus": key[0], "group": key[1], "set": key[2],
                "receiving": key[3],
                "paper_courses": "" if t in ("ABSENT", None) else " | ".join(sorted(t)),
                "our_courses": "" if o in ("ABSENT", None) else " | ".join(sorted(o)),
                "change": change,
            })

    out_csv = Path(__file__).resolve().parent / "results" / "articulation_changes.csv"
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv, "w", newline="") as f:
        w = _csv.DictWriter(f, fieldnames=list(changes[0].keys()) if changes else ["district"])
        w.writeheader()
        w.writerows(changes)
    print(f"wrote {out_csv.name}: {len(changes)} changed rows "
          f"(of {sum(len(v) for v in theirs.values())} paper rows)")
    print("\nper-campus change counts:")
    for uc in [c["code"] for c in CAMPUSES]:
        if counts[uc]:
            print(f"  {uc:>4}: " + ", ".join(f"{k}={v}" for k, v in sorted(counts[uc].items())))


# ── algorithm-equivalence validation on the paper's own inputs ───────────────

def load_paper_district_csv(path):
    """Parse one paper district CSV into (groups_by_sid, options) shaped for
    district_totals — so OUR machinery runs on THEIR exact inputs.

    Mirrors the paper's get_requirement_options: each CSV row is one
    requirement; "Courses Group N" cells are OR options, semicolons AND
    bundles; 'Not Articulated'/empty cells contribute no option; Receiving
    splits on ';' into the row's receiving codes. Groups/sets are ordered as
    the paper's pandas groupby produced them (sorted), rows in CSV order.
    """
    import csv as _csv
    code_by_uc = {c["code"]: c["school_id"] for c in CAMPUSES}
    raw = defaultdict(list)  # (sid, group_id, set_id) → [row dict]
    with open(path, newline="") as f:
        for row in _csv.DictReader(f):
            uc = str(row.get("UC Name", "")).strip().upper()
            sid = code_by_uc.get(uc)
            if sid is None:
                continue
            group_id = " ".join(str(row.get("Group ID", "")).split())
            set_id = " ".join(str(row.get("Set ID", "")).split())
            opts = []
            for col, val in row.items():
                if not col or not col.lower().strip().startswith("courses group"):
                    continue
                val = str(val or "").strip()
                if not val or val.lower() in ("not articulated", "nan"):
                    continue
                bundle = frozenset(v.strip() for v in val.split(";") if v.strip())
                if bundle:
                    opts.append(bundle)
            codes = {v.strip() for v in str(row.get("Receiving", "")).split(";") if v.strip()}
            raw[(sid, group_id, set_id)].append({"codes": codes, "opts": opts})

    groups_by_sid = {c["school_id"]: {} for c in CAMPUSES}
    options = {}
    for (sid, group_id, set_id) in sorted(raw):
        rows_out = groups_by_sid[sid].setdefault(group_id, {}).setdefault(set_id, [])
        for r in raw[(sid, group_id, set_id)]:
            key = (sid, group_id, set_id, len(rows_out))
            rows_out.append({"key": key, "codes": r["codes"], "parent_ids": []})
            if r["opts"]:
                options[key] = r["opts"]
    return groups_by_sid, options


def validate_on_paper_data(paper_repo, workers):
    """Run our implementation on the paper's district CSVs and compare every
    per-district average — and the TRANSFERABLE AVERAGE rows — against the
    paper's published optimal_order_{1..4}_averages.csv. Exact agreement
    proves the two implementations are algorithm-equivalent, isolating any
    figure difference to the DATA snapshots alone."""
    import csv as _csv
    csv_dir = Path(paper_repo) / "district_csvs"
    pub_dir = Path(paper_repo) / "question_1" / "csvs" / "2026" / "order_4"
    files = sorted(p for p in csv_dir.iterdir() if p.suffix == ".csv")
    print(f"validating against {len(files)} paper district CSVs …")

    work = []
    for p in files:
        groups_by_sid, options = load_paper_district_csv(p)
        work.append((p.name, groups_by_sid, options))
    results = {}
    with Pool(workers) as pool:
        for i, (name, totals) in enumerate(pool.imap_unordered(district_totals, work), 1):
            results[name] = totals
            print(f"  [{i}/{len(work)}] {name}")

    published = {}  # (file, uc, order) → (art, unart)
    for order in range(1, K + 1):
        with open(pub_dir / f"optimal_order_{order}_averages.csv", newline="") as f:
            for row in _csv.DictReader(f):
                name = row["Community College"]
                if name in ("AVERAGE", "TRANSFERABLE AVERAGE"):
                    continue
                for c in CAMPUSES:
                    published[(name, c["code"], order)] = (
                        float(row[f"{c['code']} Articulated"]),
                        float(row[f"{c['code']} Unarticulated"]),
                    )

    total = same = 0
    mismatches = []
    included = defaultdict(list)
    for name, totals in sorted(results.items()):
        for c in CAMPUSES:
            for pos in range(K):
                art_sum, unart_sum = totals.get((c["code"], pos), (0, 0))
                ours = (round(art_sum / 336, 2), round(unart_sum / 336, 2))
                if ours[1] == 0:
                    included[(c["code"], pos)].append(ours[0])
                pub = published.get((name, c["code"], pos + 1))
                if pub is None:
                    continue
                total += 1
                if ours == pub:
                    same += 1
                else:
                    mismatches.append((name, c["code"], pos + 1, ours, pub))

    print(f"\nper-district averages: {same}/{total} identical "
          f"({100 * same / max(total, 1):.2f}%)")
    for m in mismatches[:20]:
        print(f"  MISMATCH {m[0]} {m[1]} order {m[2]}: ours {m[3]} vs published {m[4]}")
    if len(mismatches) > 20:
        print(f"  … and {len(mismatches) - 20} more")

    print("\nTRANSFERABLE AVERAGE (ours on their data vs published):")
    for order in range(1, K + 1):
        with open(pub_dir / f"optimal_order_{order}_averages.csv", newline="") as f:
            pub_row = next(r for r in _csv.DictReader(f)
                           if r["Community College"] == "TRANSFERABLE AVERAGE")
        line = []
        for c in CAMPUSES:
            vals = included[(c["code"], order - 1)]
            ours = round(sum(vals) / len(vals), 2) if vals else 0.0
            pub = float(pub_row[f"{c['code']} Articulated"])
            mark = "" if ours == pub else " <<<"
            line.append(f"{c['code']}:{ours:.2f}/{pub:.2f}{mark}")
        print(f"  order {order}: " + "  ".join(line))


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--requirements", choices=("website", "assist"), default="website",
                    help="demand model: curated website minimums (default) "
                         "or ASSIST-stated required groups")
    ap.add_argument("--diff", action="store_true", help="print per-bar deltas vs the paper baseline")
    ap.add_argument("--workers", type=int, default=max(1, cpu_count() - 2))
    ap.add_argument("--allow-requirement-drift", action="store_true",
                    help="continue even if derived gold bars differ from the paper constants")
    ap.add_argument("--skip-assist-validations", action="store_true",
                    help="development only: skip ASSIST coverage and greedy/exact checks")
    ap.add_argument("--validate-paper", nargs="?", metavar="PAPER_REPO",
                    const=str(Path(__file__).resolve().parent.parent.parent / "transfer-agreements-analysis"),
                    help="run OUR implementation on the PAPER's district CSVs and compare "
                         "against its published averages (algorithm-equivalence check)")
    ap.add_argument("--articulation-diff", nargs="?", metavar="PAPER_REPO",
                    const=str(Path(__file__).resolve().parent.parent.parent / "transfer-agreements-analysis"),
                    help="write results/articulation_changes.csv: every requirement row whose "
                         "articulation differs between the paper's district CSVs and our data")
    args = ap.parse_args()

    if args.validate_paper:
        validate_on_paper_data(args.validate_paper, args.workers)
        return
    if args.articulation_diff:
        articulation_diff(connect(), args.articulation_diff)
        return

    db = connect()
    data_refreshed_at = (db.settings.find_one({"_id": "app"}) or {}).get(
        "last_data_refresh_at")
    data_refreshed_at = data_refreshed_at.isoformat() if data_refreshed_at else None
    models = load_requirement_models(db)

    if args.requirements == "assist":
        root = Path(__file__).resolve().parent
        print(f"data refreshed {data_refreshed_at or 'unknown'} · loading ASSIST-stated requirements …")
        assist = load_assist_inputs(db)
        gold = assist["gold"]
        district_models = assist["district_models"]
        courses_by_id = assist["courses_by_id"]
        code_of_parent = assist["code_of_parent"]
        print(f"{len(assist['all_districts'])} districts · {assist['agreement_count']} "
              f"campus×college agreements (one canonical CS major per campus)")

        work = [(district, models, courses_by_id, code_of_parent, gold)
                for district, models in sorted(district_models.items())]
        results = {}
        singles_by_district = {}
        with Pool(args.workers) as pool:
            for i, (district, totals, singles) in enumerate(
                pool.imap_unordered(assist_district_totals, work), 1
            ):
                results[district] = totals
                singles_by_district[district] = singles
                print(f"  [{i}/{len(work)}] {district}")

        if not args.skip_assist_validations:
            validate_assist_coverage(district_models, singles_by_district)
            validate_assist_optimizer(district_models, courses_by_id)

        per_uc_per_position = 336
        district_rows_out = []
        included = defaultdict(list)
        for district in sorted(results):
            for c in CAMPUSES:
                for pos in range(K):
                    art_sum, unart_sum = results[district].get((c["code"], pos), (0, 0))
                    art = round(art_sum / per_uc_per_position, 2)
                    unart = round(unart_sum / per_uc_per_position, 2)
                    district_rows_out.append({
                        "district": district, "campus": c["code"], "order": pos + 1,
                        "articulated_avg": art, "unarticulated_avg": unart,
                    })
                    if unart == 0:
                        included[(c["code"], pos)].append(art)

        campuses_out = []
        for c in CAMPUSES:
            choices = []
            for pos in range(K):
                vals = included[(c["code"], pos)]
                choices.append({
                    "order": pos + 1,
                    "transferable_average": round(sum(vals) / len(vals), 2) if vals else 0.0,
                    "districts_included": len(vals),
                })
            campuses_out.append({
                "code": c["code"], "id": c["id"], "school_id": c["school_id"],
                "quarter": c["quarter"],
                "requirement": gold[c["school_id"]],
                "choices": choices,
            })

        out = {
            "generated_by": "analysis/paper_credit_loss.py",
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "data_refreshed_at": data_refreshed_at,
            "requirements": "assist",
            "major_filter": MAJOR_FILTER_TEXT,
            "districts_total": len(assist["all_districts"]),
            "method": "the paper's credit-loss method with ASSIST demand: the one canonical CS "
                      "major per campus (from Settings) states the required groups; its articulations "
                      "are pooled per receiver across sibling colleges (best college per requirement, "
                      "the paper's rule); minimum CC courses from the ported PMT branch-and-bound "
                      "optimizer, strict-mode eligibility blockers, the paper's P(9,4) permutations "
                      "+ transferable-average; see docs/figures/paper-credit-loss.md",
            "campuses": campuses_out,
        }

        json_path = root / "results" / "paper-credit-loss.assist.json"
        json_path.parent.mkdir(parents=True, exist_ok=True)

        # Re-baseline diff: what moved vs the committed assist.json. The optimizer +
        # settings-major switch changes numbers exactly where the old MILP diverged
        # from the eligibility engine — every moved bar is printed here.
        if json_path.exists():
            try:
                old = json.loads(json_path.read_text())
            except Exception:
                old = None
            if old:
                old_by = {oc["code"]: oc for oc in old.get("campuses", [])}
                print("\nRe-baseline vs previous assist.json (new − old):")
                for c in campuses_out:
                    oc = old_by.get(c["code"])
                    if not oc:
                        continue
                    old_choices = oc.get("choices", [])
                    deltas = [round(ch["transferable_average"]
                                    - (old_choices[i]["transferable_average"] if i < len(old_choices) else 0.0), 2)
                              for i, ch in enumerate(c["choices"])]
                    req_old = oc.get("requirement", {}).get("semester_equiv")
                    req_new = c["requirement"]["semester_equiv"]
                    moved = any(abs(d) >= 0.005 for d in deltas) or req_old != req_new
                    print(f"  {c['code']:>4} req {req_old}→{req_new}  "
                          + "  ".join(f"{ORDINALS[i]}:{d:+.2f}" for i, d in enumerate(deltas))
                          + ("  <<< moved" if moved else ""))

        out = preserve_generated_at_if_unchanged(json_path, out)
        json_path.write_text(json.dumps(out, indent=2) + "\n")

        csv_path = root / "results" / "paper_credit_loss_assist_districts.csv"
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        with open(csv_path, "w", newline="") as f:
            w = csv.DictWriter(
                f, fieldnames=list(district_rows_out[0].keys()), lineterminator="\n"
            )
            w.writeheader()
            w.writerows(district_rows_out)

        blocker_paths = write_assist_blockers(root, singles_by_district)
        print(f"wrote {json_path.relative_to(root.parent)} and {csv_path.relative_to(root.parent)}")
        print("wrote " + ", ".join(str(p.relative_to(root.parent)) for p in blocker_paths.values()))

        if args.diff:
            website_path = root / "results" / "paper-credit-loss.ours.json"
            website = json.loads(website_path.read_text())
            website_by_code = {c["code"]: c for c in website["campuses"]}
            print("\nASSIST minimums vs website minimums (assist − website):")
            for c in campuses_out:
                website_uc = website_by_code[c["code"]]
                req_delta = round(
                    c["requirement"]["semester_equiv"] -
                    website_uc["requirement"]["semester_equiv"], 2
                )
                choice_deltas = [
                    round(ch["transferable_average"] -
                          website_uc["choices"][i]["transferable_average"], 2)
                    for i, ch in enumerate(c["choices"])
                ]
                print(f"  {c['code']:>4} req:{req_delta:+.2f}  " + "  ".join(
                    f"{ORDINALS[i]}:{d:+.2f}({ch['transferable_average']:.2f})"
                    for i, (d, ch) in enumerate(zip(choice_deltas, c["choices"]))
                ))
        return

    # gold bars, asserted against the paper's constants
    gold = {}
    drift = []
    for c in CAMPUSES:
        count = required_course_count(models[c["school_id"]])
        semester = round(count / 1.5, 2) if c["quarter"] else count
        quarter = count if c["quarter"] else None
        gold[c["code"]] = {"native_count": count, "semester_equiv": semester, "quarter_count": quarter}
        expect_sem, expect_q = PAPER_GOLD[c["code"]]
        if semester != expect_sem or quarter != expect_q:
            drift.append(f"{c['code']}: derived {semester}/{quarter}, paper {expect_sem}/{expect_q}")
    if drift:
        print("REQUIREMENT DRIFT vs paper constants:\n  " + "\n  ".join(drift))
        if not args.allow_requirement_drift:
            sys.exit("Refusing to continue (both sides come from the same curation; "
                     "drift means an import problem). Re-run with --allow-requirement-drift to override.")

    print(f"data refreshed {data_refreshed_at or 'unknown'} · loading district rows …")
    districts = load_district_rows(db, models)
    print(f"{len(districts)} districts · "
          f"{sum(len(opts) for opts, _ in districts.values())} pooled rows · "
          f"{sum(len(vis) for _, vis in districts.values())} visible rows")

    work = [(d, district_groups(models, districts[d][1]), districts[d][0])
            for d in sorted(districts)]
    results = {}
    with Pool(args.workers) as pool:
        for i, (district, totals) in enumerate(pool.imap_unordered(district_totals, work), 1):
            results[district] = totals
            print(f"  [{i}/{len(work)}] {district}")

    # per-district averages (round 2dp, like the paper), then the
    # TRANSFERABLE AVERAGE filter per campus × position
    per_uc_per_position = 336  # (9-1)!/(9-4)! permutations per (campus, slot)
    district_rows_out = []
    included = defaultdict(list)  # (code, position) → [district avg art]
    for district in sorted(results):
        for c in CAMPUSES:
            for pos in range(K):
                art_sum, unart_sum = results[district].get((c["code"], pos), (0, 0))
                art = round(art_sum / per_uc_per_position, 2)
                unart = round(unart_sum / per_uc_per_position, 2)
                district_rows_out.append({
                    "district": district, "campus": c["code"], "order": pos + 1,
                    "articulated_avg": art, "unarticulated_avg": unart,
                })
                if unart == 0:
                    included[(c["code"], pos)].append(art)

    campuses_out = []
    for c in CAMPUSES:
        choices = []
        for pos in range(K):
            vals = included[(c["code"], pos)]
            choices.append({
                "order": pos + 1,
                "transferable_average": round(sum(vals) / len(vals), 2) if vals else 0.0,
                "districts_included": len(vals),
            })
        campuses_out.append({
            "code": c["code"], "id": c["id"], "school_id": c["school_id"],
            "quarter": c["quarter"], "requirement": gold[c["code"]], "choices": choices,
        })

    out = {
        "generated_by": "analysis/paper_credit_loss.py",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data_refreshed_at": data_refreshed_at,
        "major_filter": MAJOR_FILTER_TEXT,
        "districts_total": len(districts),
        "method": "paper Figure 1 replication: district-pooled optimal set cover over "
                  "all P(9,4) choice permutations; see docs/figures/paper-credit-loss.md",
        "campuses": campuses_out,
    }

    root = Path(__file__).resolve().parent
    json_path = root / "results" / "paper-credit-loss.ours.json"
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(out, indent=2) + "\n")
    csv_path = root / "results" / "paper_credit_loss_districts.csv"
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(
            f, fieldnames=list(district_rows_out[0].keys()), lineterminator="\n"
        )
        w.writeheader()
        w.writerows(district_rows_out)
    print(f"wrote {json_path.relative_to(root.parent)} and {csv_path.relative_to(root.parent)}")

    if args.diff:
        print("\nΔ vs paper baseline (ours − paper):")
        for c in campuses_out:
            deltas = [round(ch["transferable_average"] - PAPER_CHOICES[c["code"]][i], 2)
                      for i, ch in enumerate(c["choices"])]
            print(f"  {c['code']:>4}  " + "  ".join(
                f"{ORDINALS[i]}:{d:+.2f}({ch['transferable_average']:.2f}/{PAPER_CHOICES[c['code']][i]:.2f})"
                for i, (d, ch) in enumerate(zip(deltas, c["choices"]))))


if __name__ == "__main__":
    main()
