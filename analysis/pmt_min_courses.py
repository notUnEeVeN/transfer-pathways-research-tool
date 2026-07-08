"""Faithful Python port of PMT's minimum-course optimizer.

Line-for-line port of the production picker at
``~/Desktop/pmt/plan_my_transfer/frontend/src/lib/missingCourses.js`` (vendored
in this repo as ``server/services/analysis/minCourses.js``, which is the golden
oracle). Given a set of target majors it finds the minimum set of CC course_ids
that makes a student eligible for ALL of them at once, sharing courses — the
``cover(subset)`` the ASSIST credit-loss figure needs.

Every completion decision is delegated to ``pmt_eligibility`` (the faithful
engine port), run NON-strict — exactly as the product does — so the optimizer is
definitionally consistent with the eligibility function and honors every
advisement type (choose-N, unit advisements, OR sections, series, same_as
cross-listing) without re-encoding any of it.

Two deliberate divergences from the JS, both for an offline reproducible
pipeline rather than a live UI:
  * No wall-clock budget. The B&B runs to completion; a hard node cap RAISES
    (never returns a silent partial).
  * The ``moves_for_receiver`` cartesian blow-up guard RAISES instead of the
    JS greedy fallback, so a pathological receiver is loud, not approximated.

Fidelity is locked by ``tests/test_pmt_min_courses.py`` against the vendored JS
oracle's outputs (``fixtures/min_courses_goldens.json``).

course_id note: everything is stringified at the boundary (``str(id)``) so the
synthetic transcript rows and the receivers' option ids compare equal in
``pmt_eligibility`` regardless of how the caller stored them.
"""

import pmt_eligibility as elig


# ── receiver / section / group shape helpers ────────────────────────────────

def articulated_receivers(section):
    return [r for r in (section or {}).get("receivers") or []
            if r.get("articulation_status") != "not_articulated"]


def section_closes_its_receivers(section, group, virtual, cross_cc):
    group_has_ask = (group.get("group_advisement") is not None
                     or group.get("group_unit_advisement") is not None)
    section_has_own_ask = (section.get("section_advisement") is not None
                           or section.get("unit_advisement") is not None)
    if group_has_ask and not section_has_own_ask:
        return False
    return elig.is_section_completed(section, virtual, cross_cc)


def is_section_all_receivers_mandatory(section):
    receivers = articulated_receivers(section)
    if not receivers:
        return False
    if section.get("section_advisement") is not None:
        return section["section_advisement"] >= len(receivers)
    if section.get("unit_advisement") is not None:
        return False
    return len(receivers) == 1


def is_group_all_receivers_mandatory(group):
    target = group.get("group_advisement")
    if target is None:
        return False
    total = sum(len(articulated_receivers(s)) for s in group.get("sections") or [])
    return total > 0 and target >= total


# ── catalog helpers ─────────────────────────────────────────────────────────

def _units_of(cid, courses_by_id):
    c = courses_by_id.get(str(cid))
    if not c:
        return 0.0
    try:
        return float(c["units"]) if c.get("units") is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def total_units(ids, courses_by_id):
    return sum(_units_of(i, courses_by_id) for i in ids)


def pick_cheapest_id(ids, courses_by_id):
    return sorted(ids, key=lambda a: (_units_of(a, courses_by_id), str(a)))[0]


def synthetic_course_for(cid, courses_by_id):
    c = courses_by_id.get(str(cid))
    if not c:
        return None
    return {
        "course_id": str(cid),
        "course_grade": "PL",  # earns credit; matches courseModel.toSyntheticUserCourse
        "course_units": c.get("units"),
        "same_as": [{"course_id": str(p.get("course_id"))} for p in (c.get("same_as") or [])],
    }


# ── mandatory pins (every "and" course inside all-receivers-mandatory blocks) ─

def collect_mandatory_course_ids_for_majors(majors, user_courses, include_recommended=False,
                                            cross_cc=None, courses_by_id=None):
    cross_cc = cross_cc or []
    out = set()
    working = list(user_courses or [])
    for major in majors or []:
        if not major:
            continue
        for g in major.get("requirement_groups") or []:
            if not g.get("is_required") and not include_recommended:
                continue
            group_forced = is_group_all_receivers_mandatory(g)
            for s in g.get("sections") or []:
                section_forced = is_section_all_receivers_mandatory(s)
                if not section_forced and not group_forced:
                    continue
                for r in s.get("receivers") or []:
                    if r.get("articulation_status") == "not_articulated":
                        continue
                    if elig.is_receiver_completed(r, working, cross_cc):
                        continue
                    if (r.get("options_conjunction") or "and").lower() != "and":
                        continue
                    for opt in r.get("options") or []:
                        if (opt.get("course_conjunction") or "and").lower() != "and":
                            continue
                        for cid in opt.get("course_ids") or []:
                            key = str(cid)
                            if key in out:
                                continue
                            out.add(key)
                            syn = synthetic_course_for(key, courses_by_id) if courses_by_id else None
                            if syn:
                                working.append(syn)
    return out


# ── open-receiver accounting + candidate enumeration ─────────────────────────

def count_open_receivers_across_majors(majors, virtual, include_recommended=False, cross_cc=None):
    cross_cc = cross_cc or []
    n = 0
    for major in majors or []:
        for group in (major or {}).get("requirement_groups") or []:
            if not group.get("is_required") and not include_recommended:
                continue
            if elig.is_group_completed(group, virtual, cross_cc):
                continue
            for section in group.get("sections") or []:
                if section_closes_its_receivers(section, group, virtual, cross_cc):
                    continue
                for r in section.get("receivers") or []:
                    if r.get("articulation_status") == "not_articulated":
                        continue
                    if elig.is_receiver_completed(r, virtual, cross_cc):
                        continue
                    n += 1
    return n


def enumerate_candidate_options(majors, virtual, ctx):
    include_recommended = ctx.get("include_recommended", False)
    cross_cc = ctx.get("cross_cc") or []
    courses_by_id = ctx["courses_by_id"]
    seen_key = set()
    out = []

    def resolve_opt(opt):
        ids = [str(i) for i in (opt.get("course_ids") or [])]
        if not ids:
            return []
        if (opt.get("course_conjunction") or "and").lower() == "or":
            pick = pick_cheapest_id(ids, courses_by_id)
            return [pick] if pick else []
        return ids

    def emit(ids):
        if not ids:
            return
        key = ",".join(sorted(ids))
        if key in seen_key:
            return
        seen_key.add(key)
        out.append({"ids": ids, "units": total_units(ids, courses_by_id)})

    for major in majors or []:
        for group in (major or {}).get("requirement_groups") or []:
            if not group.get("is_required") and not include_recommended:
                continue
            if elig.is_group_completed(group, virtual, cross_cc):
                continue
            for section in group.get("sections") or []:
                if section_closes_its_receivers(section, group, virtual, cross_cc):
                    continue
                for r in section.get("receivers") or []:
                    if r.get("articulation_status") == "not_articulated":
                        continue
                    if elig.is_receiver_completed(r, virtual, cross_cc):
                        continue
                    options = r.get("options") or []
                    if not options:
                        continue
                    if (r.get("options_conjunction") or "and").lower() == "or":
                        for opt in options:
                            emit(resolve_opt(opt))
                    else:
                        emit([i for opt in options for i in resolve_opt(opt)])
    return out


# ── greedy seed (overlap-aware, cheapest-closes-most) ────────────────────────

def select_missing_across_majors(majors, ctx):
    include_recommended = ctx.get("include_recommended", False)
    cross_cc = ctx.get("cross_cc") or []
    courses_by_id = ctx["courses_by_id"]
    out = []
    seen = set()
    virtual = list(ctx["user_courses"])

    def push(ids):
        for cid in ids:
            s = str(cid)
            if s in seen:
                continue
            if any(str(u.get("course_id")) == s for u in virtual):
                continue
            syn = synthetic_course_for(s, courses_by_id)
            if not syn:
                # Catalog cache is missing this id — mirror the JS skip. Genuine
                # gaps are surfaced by the caller's loop-closer assertion.
                continue
            seen.add(s)
            out.append(s)
            virtual.append(syn)

    push(sorted(collect_mandatory_course_ids_for_majors(
        majors, virtual, include_recommended, cross_cc, courses_by_id)))

    safety_cap = 256
    i = 0
    while i < safety_cap:
        open_count = count_open_receivers_across_majors(majors, virtual, include_recommended, cross_cc)
        if open_count == 0:
            break
        candidates = enumerate_candidate_options(majors, virtual, ctx)
        if not candidates:
            break
        scored = []
        for c in candidates:
            trial = list(virtual)
            new_ids = []
            for cid in c["ids"]:
                if any(str(u.get("course_id")) == str(cid) for u in trial):
                    continue
                new_ids.append(str(cid))
                syn = synthetic_course_for(cid, courses_by_id)
                if syn:
                    trial.append(syn)
            closed = open_count - count_open_receivers_across_majors(
                majors, trial, include_recommended, cross_cc)
            if closed > 0:
                scored.append({**c, "closed": closed, "new_ids": new_ids,
                               "new_units": total_units(new_ids, courses_by_id)})
        if not scored:
            break
        scored.sort(key=lambda c: (-c["closed"], len(c["new_ids"]), c["new_units"],
                                   ",".join(str(x) for x in c["ids"])))
        push(scored[0]["ids"])
        i += 1

    if i == safety_cap:
        raise RuntimeError(
            f"select_missing_across_majors hit safety cap {safety_cap} — a required block may "
            f"be unsatisfiable in the catalog. majors={[ (m or {}).get('major') for m in (majors or []) ]}"
        )
    return out


# ── branch-and-bound optimal ─────────────────────────────────────────────────

def cartesian(arrays):
    acc = [[]]
    for arr in arrays:
        acc = [prefix + [v] for prefix in acc for v in arr]
    return acc


def moves_for_receiver(receiver, courses_by_id):
    """Every atomic id-set that satisfies this receiver under
    options_conjunction + course_conjunction. Cartesian blow-up (>4096) RAISES
    (the JS falls back to a greedy pick; offline we want it loud)."""
    options = receiver.get("options") or []
    if not options:
        return []
    opts_conj = (receiver.get("options_conjunction") or "and").lower()

    def expand_opt(opt):
        ids = [str(i) for i in (opt.get("course_ids") or []) if str(i) in courses_by_id]
        if not ids:
            return []
        if (opt.get("course_conjunction") or "and").lower() == "or":
            return [[i] for i in sorted(ids)]
        return [ids]

    if opts_conj == "or":
        return [m for opt in options for m in expand_opt(opt)]

    per_opt = [expand_opt(opt) for opt in options]
    if any(len(w) == 0 for w in per_opt):
        return []
    cart_count = 1
    for w in per_opt:
        cart_count *= len(w)
    if cart_count > 4096:
        raise RuntimeError(
            f"moves_for_receiver cartesian blow-up ({cart_count}) for receiver "
            f"{receiver.get('hash_id')!r} — inspect the receiver"
        )
    return [[i for sub in combo for i in sub] for combo in cartesian(per_opt)]


def find_open_receivers_with_moves(majors, virtual, courses_by_id, include_recommended, cross_cc):
    out = []
    for major in majors or []:
        for group in (major or {}).get("requirement_groups") or []:
            if not group.get("is_required") and not include_recommended:
                continue
            if elig.is_group_completed(group, virtual, cross_cc):
                continue
            for section in group.get("sections") or []:
                if section_closes_its_receivers(section, group, virtual, cross_cc):
                    continue
                for r in section.get("receivers") or []:
                    if r.get("articulation_status") == "not_articulated":
                        continue
                    if elig.is_receiver_completed(r, virtual, cross_cc):
                        continue
                    moves = moves_for_receiver(r, courses_by_id)
                    if not moves:
                        continue
                    out.append({"receiver": r, "moves": moves})
    return out


def _receiver_footprint_key(r):
    return r.get("hash_id") or ("r:" + "|".join(
        ",".join(str(x) for x in (o.get("course_ids") or [])) for o in (r.get("options") or [])))


def select_missing_across_majors_optimal(majors, ctx, hard_cap=2_000_000):
    """Globally minimum (course-count → units → lexical) id set closing every
    required receiver across all majors. Greedy seed → MRV DFS → dominance
    reduction → count/units bound. Exact and deterministic (no wall-clock
    budget); a hard node cap RAISES rather than returning a silent partial."""
    include_recommended = ctx.get("include_recommended", False)
    cross_cc = ctx.get("cross_cc") or []
    courses_by_id = ctx["courses_by_id"]

    greedy_ids = select_missing_across_majors(majors, ctx)
    best = {"ids": greedy_ids, "units": total_units(greedy_ids, courses_by_id)}
    nodes = [0]

    def apply_move(virtual, move):
        out = list(virtual)
        for cid in move:
            key = str(cid)
            if any(str(u.get("course_id")) == key for u in out):
                continue
            syn = synthetic_course_for(cid, courses_by_id)
            if syn:
                out.append(syn)
        return out

    def _new_len_units(ids, virtual):
        new_len = 0
        new_units = 0.0
        for cid in ids:
            key = str(cid)
            if any(str(u.get("course_id")) == key for u in virtual):
                continue
            new_len += 1
            new_units += _units_of(cid, courses_by_id)
        return new_len, new_units

    def reduce_by_dominance(moves, current_receiver, virtual):
        if len(moves) <= 1:
            return moves
        buckets = {}
        for move in moves:
            trial = apply_move(virtual, move)
            closed = []
            for major in majors or []:
                for group in (major or {}).get("requirement_groups") or []:
                    if not group.get("is_required") and not include_recommended:
                        continue
                    if elig.is_group_completed(group, virtual, cross_cc):
                        continue
                    for section in group.get("sections") or []:
                        if section_closes_its_receivers(section, group, virtual, cross_cc):
                            continue
                        for r in section.get("receivers") or []:
                            if r is current_receiver:
                                continue
                            if r.get("articulation_status") == "not_articulated":
                                continue
                            if elig.is_receiver_completed(r, virtual, cross_cc):
                                continue
                            if elig.is_receiver_completed(r, trial, cross_cc):
                                closed.append(_receiver_footprint_key(r))
            fp_key = ";".join(sorted(closed))
            new_len, new_units = _new_len_units(move, virtual)
            sort_key = f"{new_len}|{new_units:.3f}|{','.join(sorted(str(x) for x in move))}"
            existing = buckets.get(fp_key)
            if existing is None or sort_key < existing["sort_key"]:
                buckets[fp_key] = {"move": move, "sort_key": sort_key}
        return [b["move"] for b in buckets.values()]

    def dfs(virtual, picks, running_units):
        nodes[0] += 1
        if nodes[0] > hard_cap:
            raise RuntimeError(f"select_missing_across_majors_optimal exceeded hard cap {hard_cap} nodes")
        if len(picks) > len(best["ids"]):
            return
        if len(picks) == len(best["ids"]) and running_units >= best["units"]:
            return
        open_ = find_open_receivers_with_moves(majors, virtual, courses_by_id, include_recommended, cross_cc)
        if not open_:
            if (len(picks) < len(best["ids"])
                    or (len(picks) == len(best["ids"]) and running_units < best["units"])):
                best["ids"] = list(picks)
                best["units"] = running_units
            return
        open_.sort(key=lambda o: len(o["moves"]))
        target = open_[0]
        reduced = reduce_by_dominance(target["moves"], target["receiver"], virtual)
        sorted_moves = sorted(reduced, key=lambda ids: (*_new_len_units(ids, virtual),
                                                        ",".join(str(x) for x in ids)))
        for move in sorted_moves:
            new_ids = []
            added_units = 0.0
            for cid in move:
                key = str(cid)
                if key in picks:
                    continue
                if any(str(u.get("course_id")) == key for u in virtual):
                    continue
                if key not in courses_by_id:
                    continue
                new_ids.append(key)
                added_units += _units_of(cid, courses_by_id)
            if not new_ids:
                continue
            dfs(apply_move(virtual, move), picks + new_ids, running_units + added_units)

    dfs(list(ctx.get("user_courses") or []), [], 0.0)
    return best["ids"]
