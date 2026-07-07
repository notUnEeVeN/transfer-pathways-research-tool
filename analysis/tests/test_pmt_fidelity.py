"""Fidelity oracle: the ported PMT eligibility formula must reproduce PMT's own
locked golden outcomes.

For every committed golden pair in ``fixtures/pmt_goldens/`` we derive the same
six deterministic scenarios PMT uses (``pmt_scenarios.derive_scenarios``) and
assert the ported predicates produce the identical *eligibility* fields PMT
locked into ``<name>.outcomes.json``. Display-only fields (displayStat, rule,
status, interSectionConj, pooled) are intentionally not ported and not compared.

This is the independent oracle required by the fix plan: it validates the port
against PMT's own evaluation, not a same-file replica. The modification
(strict_unarticulated) is OFF here — this locks *faithful* fidelity.
"""
import json
import math
from pathlib import Path

import pytest

import pmt_eligibility as elig
from pmt_scenarios import derive_scenarios

GOLDENS_DIR = Path(__file__).parent / "fixtures" / "pmt_goldens"

GOLDEN_FILES = sorted(
    p for p in GOLDENS_DIR.glob("*.json") if not p.name.endswith(".outcomes.json")
)


def round2(n):
    # Match JS Math.round(n*100)/100 (round-half-up for non-negative n).
    return math.floor(n * 100 + 0.5) / 100


def mine(parsed, scenario):
    """Eligibility-only projection computed by the port (mirrors computeOutcomes)."""
    uc = scenario["userCourses"]
    cc = scenario["crossCc"]
    major = {"requirement_groups": parsed.get("requirement_groups")}
    groups = []
    for group in parsed.get("requirement_groups") or []:
        sections = group.get("sections") or []
        groups.append({
            "completed": elig.is_group_completed(group, uc, cc),
            "effectiveAsk": elig.get_effective_group_ask(group, cc),
            "sections": [{
                "completed": elig.is_section_completed(s, uc, cc),
                "contribution": elig.section_contribution(s, uc, cc),
                "maxContribution": elig.section_max_contribution(s, cc),
                "receivers": [{
                    "completed": elig.is_receiver_completed(r, uc, cc),
                    "available": elig.is_receiver_available(r, cc),
                } for r in (s.get("receivers") or [])],
            } for s in sections],
        })
    return {
        "major": {
            "completed": elig.is_major_completed(major, uc, cc),
            "percentage": round2(elig.calculate_major_completion_percentage(major, uc, cc)),
        },
        "groups": groups,
    }


def golden_projection(outcome):
    """Keep only the eligibility fields from a locked golden outcome."""
    return {
        "major": {
            "completed": outcome["major"]["completed"],
            "percentage": round2(outcome["major"]["percentage"]),
        },
        "groups": [{
            "completed": g["completed"],
            "effectiveAsk": g["effectiveAsk"],
            "sections": [{
                "completed": s["completed"],
                "contribution": s["contribution"],
                "maxContribution": s["maxContribution"],
                "receivers": [{
                    "completed": r["completed"],
                    "available": r["available"],
                } for r in s["receivers"]],
            } for s in g["sections"]],
        } for g in outcome["groups"]],
    }


# (golden_file, scenario_id) pairs so a failure pinpoints the exact case.
CASES = [
    (p, sid)
    for p in GOLDEN_FILES
    for sid in ("empty", "half", "exact_ask", "all", "all_d_grades", "crosscc")
]


def _id(case):
    return f"{case[0].stem}::{case[1]}"


def test_corpus_present():
    assert len(GOLDEN_FILES) > 0, "no PMT goldens found — fixtures missing"


@pytest.mark.parametrize("golden_file,scenario_id", CASES, ids=[_id(c) for c in CASES])
def test_fidelity(golden_file, scenario_id):
    golden = json.loads(golden_file.read_text())
    parsed = golden["parsed"]
    expected = json.loads(
        golden_file.with_name(golden_file.stem + ".outcomes.json").read_text()
    )["outcomes"][scenario_id]

    scenario = derive_scenarios(parsed)[scenario_id]
    assert mine(parsed, scenario) == golden_projection(expected)
