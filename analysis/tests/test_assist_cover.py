"""Pooled ASSIST requirement models: articulations unioned per receiver across
sibling colleges, programs concatenated, optimizer shares courses, loop-closer holds.
"""
import paper_credit_loss as pcl
import pmt_min_courses as pmt_min
import pmt_eligibility as pmt_elig


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
