"""Pooled ASSIST requirement models: articulations unioned per receiver across
sibling colleges, programs concatenated, optimizer shares courses, loop-closer holds.
"""
import paper_credit_loss as pcl
import pmt_min_courses as pmt_min
import pmt_eligibility as pmt_elig
import pytest


def rcv(h, ids, status="articulated"):
    return {"hash_id": h, "articulation_status": status,
            "receiving": {"kind": "course", "parent_id": h},
            "options_conjunction": "or" if len(ids) > 1 else "and",
            "options": [{"course_ids": [i], "course_conjunction": "and"} for i in ids]}


def grp(sections, **f):
    return {"is_required": True, **f, "sections": sections}


def sec(receivers, **f):
    return {**f, "receivers": receivers}


def agreement(sid, college_id, major, groups):
    return {"school_id": sid, "campus_code": pcl.CODE_BY_SCHOOL.get(sid, str(sid)),
            "college_id": college_id, "college": f"College {college_id}",
            "district": "D", "major": major, "requirement_groups": groups}


# Numeric course ids (real course_ids are numeric; receiver_alternatives int()s them).
C1, C1B, C2, M1 = "1", "11", "2", "5"
CBID = {c: {"course_id": c, "units": 3, "same_as": [], "name": c} for c in [C1, C1B, C2, M1]}


def _alts(receiver):
    return set(pcl.id_alternatives(receiver))


def _find(groups, h):
    for g in groups:
        for s in g["sections"]:
            for r in s["receivers"]:
                if r["hash_id"] == h:
                    return r
    return None


def test_keeps_best_college_alternatives_per_receiver():
    # Two colleges articulate h1 differently (C1 at College 1, C1B at College 2), both
    # single-course. The paper's per-row pooling keeps the BEST college's alternatives
    # (fewest-course, ties by college name) — College 1 (name) wins → {C1}, not the union.
    a = agreement(7, 1, "CS", [grp([sec([rcv("h1", [C1]), rcv("h2", [C2])])])])
    b = agreement(7, 2, "CS", [grp([sec([rcv("h1", [C1B]), rcv("h2", [C2])])])])
    pooled = pcl.pool_campus_model([a, b])
    assert _alts(_find(pooled, "h1")) == {frozenset({C1})}
    assert _alts(_find(pooled, "h2")) == {frozenset({C2})}


def test_unarticulated_when_no_college_articulates():
    a = agreement(7, 1, "CS", [grp([sec([rcv("h9", [], status="not_articulated")])])])
    pooled = pcl.pool_campus_model([a])
    assert _find(pooled, "h9")["articulation_status"] == "not_articulated"


def test_concatenates_across_programs():
    a = agreement(7, 1, "CS A", [grp([sec([rcv("h1", [C1])])])])
    b = agreement(7, 1, "CS B", [grp([sec([rcv("h2", [C2])])])])
    pooled = pcl.pool_campus_model([a, b])
    assert _find(pooled, "h1") is not None and _find(pooled, "h2") is not None


def test_optimizer_over_pooled_shares_courses():
    # Campus 7 needs M1; campus 46 also needs M1 (shared) → counted once.
    m7 = pcl.pool_campus_model([agreement(7, 1, "CS", [grp([sec([rcv("h1", [M1])])])])])
    m46 = pcl.pool_campus_model([agreement(46, 1, "CS", [grp([sec([rcv("h2", [M1])])])])])
    ids = pmt_min.select_missing_across_majors_optimal(
        [{"requirement_groups": m7}, {"requirement_groups": m46}],
        {"user_courses": [], "courses_by_id": CBID, "include_recommended": False, "cross_cc": []})
    assert set(ids) == {M1}


def test_loop_closer_pooled_model_satisfies_engine():
    # h1 and h2 in SEPARATE sections → both mandatory (each section = "any one" of its
    # single receiver). h1 pooled across colleges (C1 or C1B); h2 always C2.
    m = pcl.pool_campus_model([
        agreement(7, 1, "CS", [grp([sec([rcv("h1", [C1])]), sec([rcv("h2", [C2])])])]),
        agreement(7, 2, "CS", [grp([sec([rcv("h1", [C1B])]), sec([rcv("h2", [C2])])])]),
    ])
    major = {"requirement_groups": m}
    ids = pmt_min.select_missing_across_majors_optimal(
        [major], {"user_courses": [], "courses_by_id": CBID, "include_recommended": False, "cross_cc": []})
    transcript = [pmt_min.synthetic_course_for(i, CBID) for i in ids]
    assert pmt_elig.is_major_completed(major, transcript, [], strict=False)
    assert len(ids) == 2  # one of {C1, C1B} for h1 + C2 for h2


def test_gold_demand_honors_any_one_group_advisement_and_or_sections():
    any_one = agreement(7, 1, "Bio", [
        grp([sec([rcv("h1", [C1]), rcv("h2", [C2]), rcv("h3", [M1])])]),
        grp([sec([rcv("recommended", [C1B])])], is_required=False),
        grp([sec([rcv("legacy-null", [C1B])])], is_required=None),
    ])
    assert pcl.agreement_demand_count(any_one, lambda _r: False) == 1
    normalized = pcl.normalized_requirement_structure(any_one["requirement_groups"])
    assert len(normalized) == 1
    assert {receiver["hash_id"] for receiver in normalized[0]["sections"][0]["receivers"]} \
        == {"h1", "h2", "h3"}

    group_capped = agreement(7, 1, "Bio", [
        grp(
            [sec([rcv("h1", [C1]), rcv("h2", [C2]), rcv("h3", [M1])])],
            group_advisement=2,
        ),
    ])
    assert pcl.agreement_demand_count(group_capped, lambda _r: False) == 2

    structured_or = agreement(7, 1, "Bio", [
        grp(
            [
                sec([rcv("h1", [C1]), rcv("h2", [C2])], section_advisement=2),
                sec([rcv("h3", [M1])], section_advisement=1),
            ],
            group_conjunction="Or",
            group_advisement=1,
        ),
    ])
    assert pcl.agreement_demand_count(structured_or, lambda _r: False) == 1


def test_gold_demand_rejects_unit_shapes_instead_of_counting_units_as_courses():
    unsupported = agreement(7, 1, "Bio", [
        grp([sec([rcv("h1", [C1])], unit_advisement=3)]),
    ])
    with pytest.raises(ValueError, match="unit_advisement"):
        pcl.agreement_demand_count(unsupported, lambda _r: False)


def test_canonical_template_is_modal_and_district_pooling_cannot_change_demand():
    canonical_a = agreement(7, 1, "Bio", [grp([sec([rcv("h1", [C1])])])])
    canonical_b = agreement(7, 2, "Bio", [grp([sec([rcv("h1", [C1B])])])])
    larger_outlier = agreement(7, 3, "Bio", [
        grp([sec([rcv("h2", [C2]), rcv("h3", [M1])], section_advisement=2)]),
    ])

    template, audit = pcl.select_canonical_template([
        canonical_a, canonical_b, larger_outlier,
    ])
    assert audit[0]["native_count"] == 1
    assert audit[0]["structure_agreements"] == 2

    # Even a district containing only the noncanonical template retains the
    # systemwide canonical h1 requirement. Unknown h2/h3 paths are ignored and
    # the absent canonical hash remains explicitly unarticulated.
    pooled = pcl.pool_campus_model([larger_outlier], template)
    assert pcl.agreement_demand_count(
        {"requirement_groups": pooled}, lambda _r: False
    ) == 1
    assert _find(pooled, "h1")["articulation_status"] == "not_articulated"
    assert _find(pooled, "h2") is None
    assert pcl.normalized_requirement_structure(pooled) == template
