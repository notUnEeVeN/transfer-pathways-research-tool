"""Hybrid blocker extraction.

When a college can't meet a campus's stated minimums, report the gap at the
right grain (your Q3 choice):
  * a genuinely must-take receiver that isn't articulated  -> course grain
    (named by its university course), and
  * a choose-N section/group short of its ask               -> section/group
    grain ("need k more of {...}").

The adapter returns structured records; the caller resolves parent_ids to
course codes.
"""
import json
from pathlib import Path

import pmt_eligibility as elig
from test_pmt_modification import art, unart, sec, grp, major

REAL = Path(__file__).parent / "fixtures" / "real_agreements"


def _load_real(slug):
    fx = json.loads((REAL / f"{slug}.json").read_text())
    return {"requirement_groups": fx["requirement_groups"]}


def test_articulable_group_has_no_blockers():
    m = major(grp([sec([art(54, 116), unart(160), art(56, 116)], section_advisement=1)]))
    assert elig.articulation_blockers(m, strict=True) == []


def test_single_required_unarticulated_course_is_course_grain():
    m = major(grp([sec([unart(56)], section_advisement=1)]))
    b = elig.articulation_blockers(m, strict=True)
    assert len(b) == 1
    assert b[0]["grain"] == "course"
    assert b[0]["receiving"]["parent_id"] == 56


def test_musttake_pair_names_the_unarticulated_course():
    # choose 2 of 2 = both mandatory; one unarticulated.
    m = major(grp([sec([art(1, 101), unart(56)], section_advisement=2)]))
    b = elig.articulation_blockers(m, strict=True)
    assert [x["grain"] for x in b] == ["course"]
    assert b[0]["receiving"]["parent_id"] == 56


def test_choose2_of3_one_articulated_is_section_grain():
    m = major(grp([sec([art(1, 101), unart(2), unart(3)], section_advisement=2)]))
    b = elig.articulation_blockers(m, strict=True)
    assert len(b) == 1
    assert b[0]["grain"] == "section"
    assert b[0]["shortfall"] == 1
    assert b[0]["need"] == 2
    assert {c["parent_id"] for c in b[0]["candidates"]} == {2, 3}


def test_recommended_group_never_blocks():
    m = major(
        grp([sec([art(1, 101)], section_advisement=1)], is_required=True),
        grp([sec([unart(9)], section_advisement=1)], is_required=False),
    )
    assert elig.articulation_blockers(m, strict=True) == []


def test_group_advisement_shortfall_is_group_grain():
    m = major(grp([sec([art(1, 101), unart(2), unart(3)])], group_advisement=3))
    b = elig.articulation_blockers(m, strict=True)
    assert len(b) == 1
    assert b[0]["grain"] == "group"
    assert b[0]["shortfall"] == 2
    assert b[0]["need"] == 3


def test_blocker_count_matches_articulability():
    """No blockers  <=>  fully articulable, for every case above."""
    cases = [
        major(grp([sec([art(54, 116), unart(160), art(56, 116)], section_advisement=1)])),  # articulable
        major(grp([sec([unart(56)], section_advisement=1)])),                                # blocked
        major(grp([sec([art(1, 101), unart(2), unart(3)], section_advisement=2)])),          # blocked
    ]
    for m in cases:
        has_blockers = len(elig.articulation_blockers(m, strict=True)) > 0
        assert has_blockers == (not elig.is_major_articulable(m, strict=True))


def test_real_ucb_marin_cs_ba_has_no_blockers():
    assert elig.articulation_blockers(_load_real("ucb_marin_cs_ba"), strict=True) == []


def test_real_ucb_marin_eecs_bs_has_no_blockers():
    assert elig.articulation_blockers(_load_real("ucb_marin_eecs_bs"), strict=True) == []
