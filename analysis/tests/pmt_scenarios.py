"""Deterministic scenario derivation for the fidelity golden harness.

A line-for-line Python port of PMT's
``frontend/src/test/fidelity/scenarios.js`` (SCENARIO_VERSION 1). Pure function
of the parsed agreement structure — no randomness, no eligibility code — so the
same golden always yields the same synthetic coursework inputs. Used only by the
tests, to feed the ported predicates the exact inputs PMT used when it locked
``*.outcomes.json``.
"""

SCENARIO_VERSION = 1


def minimal_course_ids(receiver):
    """Minimal satisfying CC course ids for one receiver (mirrors scenarios.js)."""
    if not receiver or receiver.get("articulation_status") != "articulated":
        return []
    options = receiver.get("options") or []
    if len(options) == 0:
        return []
    conj = (receiver.get("options_conjunction") or "and").lower()
    chosen = options if conj == "and" else options[:1]
    ids = []
    for opt in chosen:
        course_ids = (opt or {}).get("course_ids") or []
        if len(course_ids) == 0:
            continue
        course_conj = (opt.get("course_conjunction") or "and").lower()
        if course_conj == "or":
            ids.append(course_ids[0])
        else:
            ids.extend(course_ids)
    return ids


def synthetic_course(course_id, grade):
    """Exactly the seven fields lib/eligibility reads off a user course."""
    return {
        "course_id": course_id,
        "course_grade": grade,
        "course_units": 3,
        "prefix": "GLD",
        "number": str(course_id),
        "same_as": [],
        "community_college_name": "Golden CC",
    }


def courses_for(receivers, grade):
    seen = set()
    courses = []
    for receiver in receivers:
        for cid in minimal_course_ids(receiver):
            if cid in seen:
                continue
            seen.add(cid)
            courses.append(synthetic_course(cid, grade))
    return courses


def each_receiver(parsed):
    out = []
    for group in (parsed or {}).get("requirement_groups") or []:
        for section in group.get("sections") or []:
            receivers = section.get("receivers") or []
            for index_in_section, receiver in enumerate(receivers):
                out.append({"receiver": receiver, "indexInSection": index_in_section})
    return out


def exact_ask_receivers(parsed):
    out = []
    for group in (parsed or {}).get("requirement_groups") or []:
        remaining = group.get("group_advisement") if group.get("group_advisement") is not None else None
        for section in group.get("sections") or []:
            articulated = [r for r in (section.get("receivers") or [])
                           if r.get("articulation_status") == "articulated"]
            if remaining is not None:
                cap = section["section_advisement"] if section.get("section_advisement") is not None else len(articulated)
                take = min(cap, len(articulated), max(0, remaining))
                remaining -= take
            else:
                take = (min(section["section_advisement"], len(articulated))
                        if section.get("section_advisement") is not None else len(articulated))
            out.extend(articulated[:int(take)])  # advisement counts are integral floats; JS slice coerces
    return out


def derive_scenarios(parsed):
    """The six locked scenarios (mirrors scenarios.js deriveScenarios)."""
    flat = each_receiver(parsed)
    all_receivers = [f["receiver"] for f in flat]
    even_receivers = [f["receiver"] for f in flat if f["indexInSection"] % 2 == 0]
    cross_cc = [
        {"hash_id": r["hash_id"]}
        for r in all_receivers
        if r.get("articulation_status") == "not_articulated" and r.get("hash_id")
    ]
    return {
        "empty": {"userCourses": [], "crossCc": []},
        "half": {"userCourses": courses_for(even_receivers, "A"), "crossCc": []},
        "exact_ask": {"userCourses": courses_for(exact_ask_receivers(parsed), "A"), "crossCc": []},
        "all": {"userCourses": courses_for(all_receivers, "A"), "crossCc": []},
        "all_d_grades": {"userCourses": courses_for(all_receivers, "D"), "crossCc": []},
        "crosscc": {"userCourses": [], "crossCc": cross_cc},
    }
