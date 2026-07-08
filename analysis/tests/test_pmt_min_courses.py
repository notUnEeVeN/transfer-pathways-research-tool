"""Fidelity lock: the Python optimizer port reproduces the vendored JS oracle.

For every committed case (synthetic advisement branches + real ASSIST agreements),
assert select_missing_across_majors[_optimal] returns exactly the course-id set the
JS oracle produced (fixtures/min_courses_goldens.json). Regenerate the goldens with
  node server/services/analysis/genMinCoursesGoldens.js
"""
import json
import pathlib

import pytest

import pmt_min_courses as mc

FX = pathlib.Path(__file__).parent / "fixtures"
CASES = {c["case_id"]: c for c in json.loads((FX / "min_courses_cases.json").read_text())}
GOLDENS = {g["case_id"]: g for g in json.loads((FX / "min_courses_goldens.json").read_text())}


def _ctx(case):
    return {
        "user_courses": [],
        "courses_by_id": {str(k): v for k, v in case["coursesById"].items()},
        "include_recommended": case.get("includeRecommended", False),
        "cross_cc": [],
    }


@pytest.mark.parametrize("cid", list(GOLDENS))
def test_greedy_matches_oracle(cid):
    got = sorted(mc.select_missing_across_majors(CASES[cid]["majors"], _ctx(CASES[cid])))
    assert got == sorted(GOLDENS[cid]["greedy"]), f"{cid}: greedy mismatch"


@pytest.mark.parametrize("cid", list(GOLDENS))
def test_optimal_matches_oracle(cid):
    got = sorted(mc.select_missing_across_majors_optimal(CASES[cid]["majors"], _ctx(CASES[cid])))
    assert got == sorted(GOLDENS[cid]["optimal"]), f"{cid}: optimal mismatch"
