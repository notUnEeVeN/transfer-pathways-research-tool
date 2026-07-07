"""Faithful Python port of Plan My Transfer's eligibility engine.

Ported line-for-line from the production single-source-of-truth at
``~/Desktop/pmt/plan_my_transfer/server/shared/eligibility/{constants,predicates,rollups}.js``
(frontend and backend both re-export it). This module is the auditable Python
oracle for "does a community college satisfy a UC campus's ASSIST-stated
requirements".

Agreement shape (identical for PMT goldens' ``parsed`` and our ``uc_agreements``
docs)::

    major.requirement_groups[].sections[].receivers[].options[]

Fidelity is locked by ``tests/test_pmt_fidelity.py`` against PMT's own golden
outcome snapshots. Display-only helpers (getGroupDisplayStat, ledger text,
interSectionConjOf, allReceiversAreSeries, computeCrossCcEquivalents) are
intentionally NOT ported — only the eligibility math.

The one deliberate modification for credit-loss analysis — treating a mandatory
requirement with no articulation as NOT satisfied instead of PMT's
default-ACCEPT — is layered in ``articulability``/``strict_unarticulated`` (added
separately, test-driven); this file stays a faithful mirror of PMT.
"""

# ---------------------------------------------------------------------------
# constants.js
# ---------------------------------------------------------------------------

GRADE_TO_GPA = {
    "A+": 4.0, "A": 4.0, "A-": 3.7,
    "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7,
    "D+": 1.3, "D": 1.0, "D-": 0.7,
    "F": 0.0,
}


def meets_c_or_better(gpa):
    return gpa >= 2.0


# ---------------------------------------------------------------------------
# predicates.js — course level
# ---------------------------------------------------------------------------

def course_earns_credit(c):
    grade = (c or {}).get("course_grade")
    if not grade or grade == "PL" or grade == "IP":
        return True
    gpa = GRADE_TO_GPA.get(grade)
    if gpa is None:  # unknown grade label → lenient (JS: gpa === undefined)
        return True
    return meets_c_or_better(gpa)


def is_course_completed(course_id, user_courses):
    # Direct hit (only counts if the grade earns credit)
    if any(c.get("course_id") == course_id and course_earns_credit(c) for c in user_courses):
        return True
    # Same-as: a credit-earning course lists course_id as a peer
    return any(
        course_earns_credit(u) and any(p.get("course_id") == course_id for p in (u.get("same_as") or []))
        for u in user_courses
    )


# ---------------------------------------------------------------------------
# predicates.js — option level (one alternative CC path)
# ---------------------------------------------------------------------------

def is_option_completed(option, user_courses):
    if not option or not isinstance(option.get("course_ids"), list) or len(option["course_ids"]) == 0:
        return False
    conj = (option.get("course_conjunction") or "and").lower()
    if conj == "or":
        return any(is_course_completed(i, user_courses) for i in option["course_ids"])
    return all(is_course_completed(i, user_courses) for i in option["course_ids"])


# ---------------------------------------------------------------------------
# predicates.js — receiver level
# ---------------------------------------------------------------------------

def is_receiver_completed(receiver, user_courses, cross_cc=None):
    cross_cc = cross_cc or []
    if not receiver:
        return False
    options = receiver.get("options") or []
    if len(options) > 0:
        conj = (receiver.get("options_conjunction") or "and").lower()
        results = [is_option_completed(opt, user_courses) for opt in options]
        direct = any(results) if conj == "or" else all(results)
        if direct:
            return True
    if receiver.get("hash_id"):
        return any(s.get("hash_id") == receiver["hash_id"] for s in cross_cc)
    return False


def is_receiver_available(receiver, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    if not receiver:
        return False
    if receiver.get("articulation_status") != "not_articulated":
        return True
    # THE ONE DELIBERATE MODIFICATION. PMT treats an unarticulated receiver as
    # unavailable, which shrinks every downstream cap min(advisement, available)
    # and lets unmet ASSIST demand default-ACCEPT. Under strict we count it as
    # achievable demand (available == total), so the cap becomes the full stated
    # ask and genuine gaps surface. Completion (is_receiver_completed) is
    # unchanged, so the unarticulated receiver still can't be *satisfied* — it
    # is demand that goes unmet. This is the sole behavioral divergence from PMT.
    if strict:
        return True
    if not receiver.get("hash_id"):
        return False
    return any(s.get("hash_id") == receiver["hash_id"] for s in cross_cc)


# ---------------------------------------------------------------------------
# predicates.js — unit counting
# ---------------------------------------------------------------------------

def calculate_units_from_completed_receivers(receivers, user_courses, cross_cc=None):
    cross_cc = cross_cc or []
    total = 0
    for receiver in (receivers or []):
        if not is_receiver_completed(receiver, user_courses, cross_cc):
            continue
        uc_units = (receiver.get("receiving") or {}).get("units")
        if uc_units is not None:
            total += uc_units
            continue
        opt = next((o for o in (receiver.get("options") or []) if is_option_completed(o, user_courses)), None)
        if not opt:
            continue
        for course_id in (opt.get("course_ids") or []):
            user_course = next((c for c in user_courses if c.get("course_id") == course_id), None)
            if user_course:
                total += user_course.get("course_units") or 0
    return total


# ---------------------------------------------------------------------------
# predicates.js — section / group / major
# ---------------------------------------------------------------------------

def available_count(receivers, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    return sum(1 for r in (receivers or []) if is_receiver_available(r, cross_cc, strict))


def available_units(receivers, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    return sum(
        ((r.get("receiving") or {}).get("units") or 0)
        for r in (receivers or []) if is_receiver_available(r, cross_cc, strict)
    )


def section_max_contribution(section, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    reachable = available_count((section or {}).get("receivers"), cross_cc, strict)
    if (section or {}).get("section_advisement") is not None:
        return min(section["section_advisement"], reachable)
    return reachable


def section_contribution(section, user_courses, cross_cc=None):
    cross_cc = cross_cc or []
    done = sum(1 for r in ((section or {}).get("receivers") or [])
               if is_receiver_completed(r, user_courses, cross_cc))
    if (section or {}).get("section_advisement") is not None:
        return min(done, section["section_advisement"])
    return done


def section_is_reachable(section, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    return available_count((section or {}).get("receivers"), cross_cc, strict) > 0


def sum_top_k(arr, k):
    return sum(sorted(arr, reverse=True)[:k])


def group_capped_contribution(group, user_courses, cross_cc=None):
    cross_cc = cross_cc or []
    contributions = [section_contribution(s, user_courses, cross_cc)
                     for s in ((group or {}).get("sections") or [])]
    if (group or {}).get("group_max_distinct_sections") is not None:
        return sum_top_k(contributions, group["group_max_distinct_sections"])
    return sum(contributions)


def or_sections_are_bare_buckets(group):
    return (
        (group or {}).get("group_advisement") is not None
        and (group.get("group_conjunction") or "And").lower() == "or"
        and all(
            s.get("section_advisement") is None and s.get("unit_advisement") is None
            for s in (group.get("sections") or [])
        )
    )


def get_effective_group_ask(group, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    if (group or {}).get("group_advisement") is None:
        return 0
    conj = (group.get("group_conjunction") or "And").lower()
    if conj == "or" and not or_sections_are_bare_buckets(group):
        return group["group_advisement"]
    maxima = [section_max_contribution(s, cross_cc, strict) for s in (group.get("sections") or [])]
    if group.get("group_max_distinct_sections") is not None:
        total_max_possible = sum_top_k(maxima, group["group_max_distinct_sections"])
    else:
        total_max_possible = sum(maxima)
    return min(group["group_advisement"], total_max_possible)


def d_bucket_qualifying_count(group, user_courses, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    min_per_section = (group or {}).get("group_section_min_courses") or 1
    required = group.get("group_min_distinct_sections") or 0
    reachable = 0
    completed_reachable = 0
    for s in (group.get("sections") or []):
        if available_count(s.get("receivers"), cross_cc, strict) < min_per_section:
            continue
        reachable += 1
        if sum(1 for r in (s.get("receivers") or [])
               if is_receiver_completed(r, user_courses, cross_cc)) >= min_per_section:
            completed_reachable += 1
    auto_credit = max(0, required - reachable)
    return min(completed_reachable + auto_credit, required)


def is_section_completed(section, user_courses, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    if not section or not isinstance(section.get("receivers"), list):
        return False

    # Nothing here articulates → vacuously satisfied (PMT default-ACCEPT). Under
    # strict, available_count == total, so this fires only for a truly empty
    # section; a fully-unarticulated section falls through and fails its ask.
    if available_count(section["receivers"], cross_cc, strict) == 0:
        return True

    if section.get("unit_advisement") is not None:
        effective = min(section["unit_advisement"], available_units(section["receivers"], cross_cc, strict))
        total = calculate_units_from_completed_receivers(section["receivers"], user_courses, cross_cc)
        return total >= effective

    if section.get("section_advisement") is not None:
        effective = min(section["section_advisement"], available_count(section["receivers"], cross_cc, strict))
        done = sum(1 for r in section["receivers"] if is_receiver_completed(r, user_courses, cross_cc))
        return done >= effective

    # No advisement → any one articulated receiver satisfies the section.
    return any(is_receiver_completed(r, user_courses, cross_cc) for r in section["receivers"])


def is_group_completed(group, user_courses, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    if not group or not isinstance(group.get("sections"), list):
        return False

    if group.get("group_unit_advisement") is not None:
        total = sum(calculate_units_from_completed_receivers(s.get("receivers"), user_courses, cross_cc)
                    for s in group["sections"])
        achievable = sum(available_units(s.get("receivers"), cross_cc, strict) for s in group["sections"])
        return total >= min(group["group_unit_advisement"], achievable)

    conj = (group.get("group_conjunction") or "And").lower()

    if group.get("group_advisement") is not None:
        if conj == "or" and not or_sections_are_bare_buckets(group):
            reachable = [s for s in group["sections"] if section_is_reachable(s, cross_cc, strict)]
            if len(reachable) == 0:
                return True
            return any(is_section_completed(s, user_courses, cross_cc, strict) for s in reachable)
        if group.get("group_min_distinct_sections") is not None:
            return d_bucket_qualifying_count(group, user_courses, cross_cc, strict) >= group["group_min_distinct_sections"]
        effective = get_effective_group_ask(group, cross_cc, strict)
        total_contribution = group_capped_contribution(group, user_courses, cross_cc)
        return total_contribution >= effective

    if conj == "or":
        reachable = [s for s in group["sections"] if section_is_reachable(s, cross_cc, strict)]
        if len(reachable) == 0:
            return True
        return any(is_section_completed(s, user_courses, cross_cc, strict) for s in reachable)

    return all(is_section_completed(s, user_courses, cross_cc, strict) for s in group["sections"])


def is_major_completed(major, user_courses, cross_cc=None, strict=False):
    cross_cc = cross_cc or []
    required = [g for g in ((major or {}).get("requirement_groups") or []) if g.get("is_required")]
    if len(required) == 0:
        return False
    return all(is_group_completed(g, user_courses, cross_cc, strict) for g in required)


def calculate_completed_units(group, user_courses, cross_cc=None):
    cross_cc = cross_cc or []
    return sum(
        calculate_units_from_completed_receivers(s.get("receivers"), user_courses, cross_cc)
        for s in (group.get("sections") or [])
    )


# ---------------------------------------------------------------------------
# rollups.js — major completion percentage
# ---------------------------------------------------------------------------

_INF = float("inf")


def section_effective_ask(section, cross_cc=None):
    cross_cc = cross_cc or []
    articulated = available_count(section.get("receivers"), cross_cc)
    if section.get("section_advisement") is not None:
        return min(section["section_advisement"], articulated)
    if section.get("unit_advisement") is not None:
        return min(section["unit_advisement"], available_units(section.get("receivers"), cross_cc))
    return min(1, articulated)


def section_done_count(section, user_courses, ask, cross_cc=None):
    cross_cc = cross_cc or []
    if section.get("unit_advisement") is not None:
        return min(calculate_units_from_completed_receivers(section.get("receivers"), user_courses, cross_cc), ask)
    done = sum(1 for r in (section.get("receivers") or []) if is_receiver_completed(r, user_courses, cross_cc))
    return min(done, ask)


def calculate_major_completion_percentage(major, user_courses, cross_cc=None):
    cross_cc = cross_cc or []
    required = [g for g in ((major or {}).get("requirement_groups") or []) if g.get("is_required")]
    if len(required) == 0:
        return 0

    total_ask = 0
    total_done = 0

    for group in required:
        group_ask = 0
        group_done = 0

        if group.get("group_advisement") is not None:
            group_conj = (group.get("group_conjunction") or "And").lower()
            if group_conj == "or" and not or_sections_are_bare_buckets(group):
                reachable = [s for s in (group.get("sections") or []) if section_is_reachable(s, cross_cc)]
                best_ask = _INF
                best_done = 0
                for s in reachable:
                    ask = section_effective_ask(s, cross_cc)
                    done = section_done_count(s, user_courses, ask, cross_cc)
                    if done >= ask:
                        best_ask = ask
                        best_done = ask
                        break
                    if ask < best_ask:
                        best_ask = ask
                        best_done = done
                group_ask = 0 if best_ask == _INF else best_ask
                group_done = best_done
            else:
                if group.get("group_min_distinct_sections") is not None:
                    group_ask = group["group_min_distinct_sections"]
                    group_done = min(d_bucket_qualifying_count(group, user_courses, cross_cc), group_ask)
                else:
                    group_ask = get_effective_group_ask(group, cross_cc)
                    total_contribution = group_capped_contribution(group, user_courses, cross_cc)
                    group_done = min(total_contribution, group_ask)
        elif group.get("group_unit_advisement") is not None:
            achievable = sum(available_units(s.get("receivers"), cross_cc) for s in (group.get("sections") or []))
            group_ask = min(group["group_unit_advisement"], achievable)
            group_done = min(calculate_completed_units(group, user_courses, cross_cc), group_ask)
        elif (group.get("group_conjunction") or "And").lower() == "or":
            reachable = [s for s in (group.get("sections") or []) if section_is_reachable(s, cross_cc)]
            best_ask = _INF
            best_done = 0
            for s in reachable:
                ask = section_effective_ask(s, cross_cc)
                done = section_done_count(s, user_courses, ask, cross_cc)
                if done >= ask:
                    best_ask = ask
                    best_done = ask
                    break
                if ask < best_ask:
                    best_ask = ask
                    best_done = done
            group_ask = 0 if best_ask == _INF else best_ask
            group_done = best_done
        else:
            for s in (group.get("sections") or []):
                ask = section_effective_ask(s, cross_cc)
                group_ask += ask
                group_done += section_done_count(s, user_courses, ask, cross_cc)

        total_ask += group_ask
        total_done += group_done

    if total_ask == 0:
        return 0
    return min((total_done / total_ask) * 100, 100)


# ---------------------------------------------------------------------------
# Articulability adapter (the credit-loss entry point)
# ---------------------------------------------------------------------------

def all_articulating_courses(major):
    """Synthetic transcript: every CC course id appearing in any articulation
    option, graded A. Feeding this to the predicates makes every *articulated*
    receiver 'completed' while unarticulated receivers (no options) stay unmet,
    turning is_major_completed into "is this major fully articulable here?"."""
    seen = set()
    courses = []
    for group in (major or {}).get("requirement_groups") or []:
        for section in group.get("sections") or []:
            for receiver in section.get("receivers") or []:
                if receiver.get("articulation_status") != "articulated":
                    continue
                for opt in receiver.get("options") or []:
                    for cid in opt.get("course_ids") or []:
                        if cid in seen:
                            continue
                        seen.add(cid)
                        courses.append({"course_id": cid, "course_grade": "A",
                                        "course_units": 3, "same_as": []})
    return courses


def is_major_articulable(major, strict=True):
    """Does this college fully satisfy the campus's ASSIST-stated minimums?

    Evaluates the faithful predicates against a "took everything that
    articulates" transcript. strict=True (default; our shipped credit-loss
    behavior) counts unmet stated demand as a gap; strict=False reproduces PMT's
    default-ACCEPT.
    """
    return is_major_completed(major, all_articulating_courses(major), [], strict=strict)


# ---------------------------------------------------------------------------
# Hybrid blocker extraction — course grain for must-take gaps, section/group
# grain for choose-N shortfalls. Callers resolve receiving.parent_id -> code.
# ---------------------------------------------------------------------------

def _articulated(receiver):
    return receiver.get("articulation_status") == "articulated"


def _is_plain_and_group(group):
    """A group whose sections are an independent 'complete all of' list — the
    common case where a shortfall localizes to a single section/course."""
    return (
        group.get("group_advisement") is None
        and group.get("group_unit_advisement") is None
        and (group.get("group_conjunction") or "And").lower() != "or"
    )


def _section_blockers(gi, si, section):
    receivers = section.get("receivers") or []
    unart = [r for r in receivers if not _articulated(r)]

    if section.get("unit_advisement") is not None:
        need = section["unit_advisement"]
        have = available_units(receivers, [], strict=False)  # articulated units only
        return [{
            "grain": "section", "group_index": gi, "section_index": si,
            "kind": "units", "need": need, "shortfall": need - have,
            "candidates": [r["receiving"] for r in unart],
        }]

    stated_need = section["section_advisement"] if section.get("section_advisement") is not None else 1
    articulated_count = sum(1 for r in receivers if _articulated(r))
    shortfall = stated_need - articulated_count
    if shortfall <= 0:
        return []

    if stated_need >= len(receivers):
        # Must-take: every unarticulated receiver is individually mandatory, so
        # name each by its own university course.
        return [{
            "grain": "course", "group_index": gi, "section_index": si,
            "receiving": r["receiving"], "hash_id": r.get("hash_id"),
        } for r in unart]

    # Choose-N with slack: no single receiver is mandatory — report the section.
    return [{
        "grain": "section", "group_index": gi, "section_index": si,
        "need": stated_need, "shortfall": shortfall,
        "candidates": [r["receiving"] for r in unart],
    }]


def _group_blocker(gi, group, synth, strict):
    sections = group.get("sections") or []
    unart = [r for s in sections for r in (s.get("receivers") or []) if not _articulated(r)]
    if group.get("group_advisement") is not None:
        if group.get("group_min_distinct_sections") is not None:
            need = group["group_min_distinct_sections"]
            shortfall = need - d_bucket_qualifying_count(group, synth, [], strict)
        else:
            need = get_effective_group_ask(group, [], strict)
            shortfall = need - group_capped_contribution(group, synth, [])
    elif group.get("group_unit_advisement") is not None:
        need = min(group["group_unit_advisement"],
                   sum(available_units(s.get("receivers"), [], strict) for s in sections))
        shortfall = need - calculate_completed_units(group, synth, [])
    else:  # OR group with no advisement — need one full alternative path
        need = 1
        shortfall = 1
    return {
        "grain": "group", "group_index": gi,
        "need": need, "shortfall": shortfall,
        "candidates": [r["receiving"] for r in unart],
    }


def articulation_blockers(major, strict=True):
    """Structured gaps for a not-fully-articulable major, at hybrid grain.

    Empty iff ``is_major_articulable(major, strict)`` is True.
    """
    synth = all_articulating_courses(major)
    blockers = []
    required = [g for g in ((major or {}).get("requirement_groups") or []) if g.get("is_required")]
    for gi, group in enumerate(required):
        if is_group_completed(group, synth, [], strict=strict):
            continue
        if _is_plain_and_group(group):
            for si, section in enumerate(group.get("sections") or []):
                if is_section_completed(section, synth, [], strict=strict):
                    continue
                blockers.extend(_section_blockers(gi, si, section))
        else:
            blockers.append(_group_blocker(gi, group, synth, strict))
    return blockers
