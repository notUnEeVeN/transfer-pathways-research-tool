"""The one deliberate modification: strict_unarticulated.

PMT default-ACCEPTS a mandatory requirement with no articulation (it caps every
"ask" at what's locally articulated). For credit-loss analysis we instead treat
unmet ASSIST-stated demand as NOT satisfied. Mechanically this is a single
change — under strict mode ``is_receiver_available`` counts an unarticulated
receiver as achievable *demand*, so every cap ``min(advisement, available)``
becomes ``min(advisement, total) == advisement`` — while completion
(``is_receiver_completed``) stays articulation-real.

``is_major_articulable(major, strict=True)`` is the adapter used by the fix: it
asks "could a student who takes every articulating course here satisfy the
campus's stated minimums?" by evaluating the faithful predicates against a
synthetic "took everything that articulates" transcript.
"""
import json
from pathlib import Path

import pmt_eligibility as elig

REAL = Path(__file__).parent / "fixtures" / "real_agreements"


# --- tiny agreement builders -------------------------------------------------

def art(pid, cid):
    """An articulated receiver: one option satisfied by CC course `cid`."""
    return {
        "receiving": {"kind": "course", "parent_id": pid},
        "articulation_status": "articulated",
        "options": [{"course_ids": [cid], "course_conjunction": "and"}],
        "options_conjunction": "and",
        "hash_id": f"h{pid}",
    }


def unart(pid):
    """An unarticulated receiver: real ASSIST demand with no CC path."""
    return {
        "receiving": {"kind": "course", "parent_id": pid},
        "articulation_status": "not_articulated",
        "not_articulated_reason": "no_course_articulated",
        "options": [],
        "options_conjunction": "and",
        "hash_id": f"h{pid}",
    }


def sec(receivers, **kw):
    s = {"section_advisement": None, "unit_advisement": None, "receivers": receivers}
    s.update(kw)
    return s


def grp(sections, is_required=True, **kw):
    g = {
        "is_required": is_required,
        "group_conjunction": "And",
        "group_advisement": None,
        "group_unit_advisement": None,
        "group_min_distinct_sections": None,
        "group_max_distinct_sections": None,
        "group_section_min_courses": None,
        "sections": sections,
    }
    g.update(kw)
    return g


def major(*groups):
    return {"requirement_groups": list(groups)}


# --- the crux: choose-N semantics -------------------------------------------

def test_choose1_of3_two_articulated_is_articulable():
    """UCB × Marin pattern: 'choose 1 of {MATH54, EECS16A, MATH56}', 2 articulate."""
    m = major(grp([sec([art(54, 116), unart(160), art(56, 116)], section_advisement=1)]))
    assert elig.is_major_articulable(m, strict=True) is True


def test_choose2_of3_one_articulated_strict_blocks_but_faithful_accepts():
    """Need 2, only 1 articulates → a real gap under strict; PMT caps the ask to 1."""
    m = major(grp([sec([art(1, 101), unart(2), unart(3)], section_advisement=2)]))
    assert elig.is_major_articulable(m, strict=True) is False
    assert elig.is_major_articulable(m, strict=False) is True


def test_fully_unarticulated_required_section():
    """Nothing articulates: PMT default-accepts (vacuous), strict blocks."""
    m = major(grp([sec([unart(1), unart(2)], section_advisement=2)]))
    assert elig.is_major_articulable(m, strict=False) is True
    assert elig.is_major_articulable(m, strict=True) is False


def test_musttake_pair_one_unarticulated_strict_blocks():
    """'Complete both' (choose 2 of 2) with one unarticulated → blocked under strict."""
    m = major(grp([sec([art(1, 101), unart(2)], section_advisement=2)]))
    assert elig.is_major_articulable(m, strict=True) is False
    assert elig.is_major_articulable(m, strict=False) is True


def test_all_articulated_is_articulable_both_modes():
    m = major(grp([sec([art(1, 101), art(2, 102)], section_advisement=2)]))
    assert elig.is_major_articulable(m, strict=True) is True
    assert elig.is_major_articulable(m, strict=False) is True


def test_recommended_unarticulated_group_does_not_block():
    """is_required=False groups are excluded (Marin's Highly-Recommended CS group)."""
    m = major(
        grp([sec([art(1, 101)], section_advisement=1)], is_required=True),
        grp([sec([unart(2), unart(3)], section_advisement=2)], is_required=False),
    )
    assert elig.is_major_articulable(m, strict=True) is True


def test_strict_does_not_change_faithful_goldens_path():
    """strict=False must be byte-identical to the faithful predicate on synth courses."""
    m = major(grp([sec([art(54, 116), unart(160), art(56, 116)], section_advisement=1)]))
    synth = elig.all_articulating_courses(m)
    assert elig.is_major_articulable(m, strict=False) == elig.is_major_completed(m, synth, [], strict=False)


# --- acceptance: the real stored documents ----------------------------------

def _load_real(slug):
    fx = json.loads((REAL / f"{slug}.json").read_text())
    return {"requirement_groups": fx["requirement_groups"]}


def test_real_ucb_marin_cs_ba_is_fully_articulable():
    """ACCEPTANCE (plan §3): UCB × College of Marin, Computer Science B.A."""
    assert elig.is_major_articulable(_load_real("ucb_marin_cs_ba"), strict=True) is True


def test_real_ucb_marin_eecs_bs_is_fully_articulable():
    assert elig.is_major_articulable(_load_real("ucb_marin_eecs_bs"), strict=True) is True
