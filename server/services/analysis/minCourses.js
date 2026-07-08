/**
 * Deterministic "what courses do I still need" picker for the Plan tool.
 * Given a major's requirement_groups + the user's virtual completion set
 * (real courses + plan + tray), returns a flat list of course_ids to add.
 *
 * Source of truth for completion semantics: frontend/src/lib/eligibility.js.
 *
 * Receiver-centric: walks section.receivers[] and reads options/options_conjunction.
 * Non-articulated receivers contribute zero course_ids.
 */

// Vendored copy of PMT frontend/src/lib/missingCourses.js — the golden oracle
// for analysis/pmt_min_courses.py. Adapted only at the module boundary:
// ESM imports → CommonJS require of the vendored eligibility engine, and a
// local toSyntheticUserCourse (PMT's courseModel shape, trimmed to the fields
// the eligibility predicates read). Behavior is otherwise byte-faithful, and
// the predicates run non-strict (product default-accept) exactly as the app.
const { isReceiverCompleted, isSectionCompleted, isGroupCompleted } = require('./eligibility')

// Mirror of courseModel.toSyntheticUserCourse (grade 'PL' earns credit; same_as
// peers preserved so cross-listed receivers read as satisfied).
function toSyntheticUserCourse(c) {
  return {
    course_id: c.course_id,
    course_units: c.units,
    course_grade: 'PL',
    same_as: (c.same_as || []).map((p) => ({ course_id: p.course_id })),
  }
}

const articulatedReceivers = (section) =>
  (section?.receivers || []).filter((r) => r.articulation_status !== 'not_articulated')

/**
 * Whether a section's own completion is allowed to close (skip) its receivers
 * in the open-receiver walks below.
 *
 * A section only gates itself when EITHER the group has no group-level ask (each
 * section is its own requirement, so isSectionCompleted is authoritative) OR the
 * section carries its own advisement (a capped bucket — once its cap is met it's
 * full). A bare bucket under a group-level ask (group_advisement /
 * group_unit_advisement) must NOT close on isSectionCompleted's "any one
 * receiver satisfies it" fallback: its receivers keep feeding the group total
 * until the GROUP ask is met, which the group-level isGroupCompleted guard
 * already enforces. Without this, a single-section "Complete N units/courses
 * from the following" group stops the picker after one course (the bucket reads
 * "done" off that course) while the group is still short.
 */
function sectionClosesItsReceivers(section, group, virtual, crossCc) {
  const groupHasAsk = group.group_advisement != null || group.group_unit_advisement != null
  const sectionHasOwnAsk = section.section_advisement != null || section.unit_advisement != null
  if (groupHasAsk && !sectionHasOwnAsk) return false
  return isSectionCompleted(section, virtual, crossCc)
}

function isSectionAllReceiversMandatory(section) {
  const receivers = articulatedReceivers(section)
  if (receivers.length === 0) return false
  if (section.section_advisement != null) return section.section_advisement >= receivers.length
  if (section.unit_advisement != null) return false
  return receivers.length === 1
}

function isGroupAllReceiversMandatory(group) {
  const target = group.group_advisement
  if (target == null) return false
  let total = 0
  for (const s of group.sections || []) total += articulatedReceivers(s).length
  return total > 0 && target >= total
}

/**
 * Course ids that any major-picker call would inevitably pick — the
 * "and" courses inside sections/groups where every receiver is mandatory.
 * Receivers already satisfied by `userCourses` (incl. hash_id cross-CC fallback)
 * are skipped, so we never re-pin a course already covered from another CC.
 *
 * Pins ACCUMULATE: each pinned course is folded into a working transcript so a
 * later mandatory receiver that's already satisfied by an earlier pin isn't
 * pinned a second time. This matters for cross-listed ("same as") courses — e.g.
 * College of Marin's COMP 117 ≡ MATH 117 (Discrete Mathematics): one major may
 * mandate COMP 117 and another MATH 117, but they're a single physical class, so
 * pinning one satisfies the other's receiver via its same_as peer. Without
 * accumulation both sides get pinned and the student's plan double-counts the
 * same course. `coursesById` lets us synthesize the pinned course so its same_as
 * peers are visible to isReceiverCompleted; when omitted, accumulation is a no-op
 * and behavior falls back to checking only the original `userCourses`.
 *
 * `includeRecommended` flips the gate on non-required groups: when true, their
 * Take-ALL pins are included; when false (default) they're skipped entirely.
 */
function collectMandatoryCourseIdsForMajors(majors, userCourses, includeRecommended = false, crossCc = [], coursesById = null) {
  const out = new Set()
  // Working transcript = the student's courses plus every course pinned so far.
  const working = [...(userCourses || [])]
  for (const major of majors || []) {
    if (!major) continue
    for (const g of major.requirement_groups || []) {
      if (!g.is_required && !includeRecommended) continue
      const groupForced = isGroupAllReceiversMandatory(g)
      for (const s of g.sections || []) {
        const sectionForced = isSectionAllReceiversMandatory(s)
        if (!sectionForced && !groupForced) continue
        for (const r of s.receivers || []) {
          if (r.articulation_status === 'not_articulated') continue
          if (isReceiverCompleted(r, working, crossCc)) continue

          // Only "and" paths are guaranteed picks. OR options/sequences are
          // not pinned — any alternative wins.
          const optsConj = (r.options_conjunction || 'and').toLowerCase()
          if (optsConj !== 'and') continue
          for (const opt of r.options || []) {
            const cc = (opt.course_conjunction || 'and').toLowerCase()
            if (cc !== 'and') continue
            for (const id of opt.course_ids || []) {
              const key = String(id)
              if (out.has(key)) continue
              out.add(key)
              // Fold the pin into the working transcript so a cross-listed /
              // cross-CC peer receiver later in the walk reads as satisfied.
              const syn = coursesById ? syntheticCourseFor(key, coursesById) : null
              if (syn) working.push(syn)
            }
          }
        }
      }
    }
  }
  return out
}

function unitsOf(id, coursesById) {
  const c = coursesById.get(String(id))
  return c ? Number(c.units) || 0 : 0
}

function totalUnits(ids, coursesById) {
  return ids.reduce((s, id) => s + unitsOf(id, coursesById), 0)
}

function pickCheapestId(ids, coursesById) {
  return [...ids].sort((a, b) => {
    const ua = unitsOf(a, coursesById)
    const ub = unitsOf(b, coursesById)
    if (ua !== ub) return ua - ub
    return String(a).localeCompare(String(b))
  })[0]
}

function syntheticCourseFor(id, coursesById) {
  const c = coursesById.get(String(id))
  return c ? toSyntheticUserCourse(c) : null
}

/**
 * Cross-major picker. Greedy: pin mandatory first, then iterate picking the
 * candidate option that closes the most still-open receivers across every
 * selected major. Tie-break by shortest path, then cheapest units, then
 * lexical id.
 *
 * Replaces a per-major sequential loop so that a course like MATH 116 —
 * required strictly by one major but accepted via a combined MATH 216 by
 * another — gets chosen over MATH 216 when 116 also satisfies the other
 * major's block but 216 does not satisfy 116's strict block.
 *
 * "Open" receivers are counted against the section/group completion guards:
 * a receiver inside a complete group or section doesn't add to the open
 * count, so the loop won't over-pick past section_advisement / group_advisement.
 */
function selectMissingAcrossMajors(majors, ctx) {
  const includeRecommended = ctx?.includeRecommended ?? false
  const crossCc = ctx?.crossCc ?? []
  const out = []
  const seen = new Set()
  const virtual = [...ctx.userCourses]

  const push = (ids) => {
    for (const id of ids) {
      const s = String(id)
      if (seen.has(s)) continue
      if (virtual.some((u) => String(u.course_id) === s)) continue
      const syn = syntheticCourseFor(s, ctx.coursesById)
      if (!syn) {
        // Catalog cache is missing this id — usually a stale catalog or a
        // race during refetch. Skipping silently would drop a required
        // course with no surface signal; surface it so the gap is visible.
        console.warn(
          'selectMissingAcrossMajors: course_id', s,
          'is not in the local catalog (coursesById); the required course will be skipped.',
          'Likely a stale catalog cache — refetch and retry.'
        )
        continue
      }
      seen.add(s)
      out.push(s)
      virtual.push(syn)
    }
  }

  // Pin mandatory across all majors first.
  push([...collectMandatoryCourseIdsForMajors(majors, virtual, includeRecommended, crossCc, ctx.coursesById)])

  const safetyCap = 256
  let i = 0
  for (; i < safetyCap; i++) {
    const openCount = countOpenReceiversAcrossMajors(majors, virtual, includeRecommended, crossCc)
    if (openCount === 0) break

    const candidates = enumerateCandidateOptions(majors, virtual, ctx)
    if (candidates.length === 0) break

    const scored = candidates
      .map((c) => {
        // Walk the candidate's full sequence; only the ids the user doesn't
        // already have count as "new". Tie-breakers below score by new ids /
        // units so a sequence that reuses an existing course beats an
        // equivalent one that doesn't.
        const trial = [...virtual]
        const newIds = []
        for (const id of c.ids) {
          if (trial.some((u) => String(u.course_id) === String(id))) continue
          newIds.push(String(id))
          const syn = syntheticCourseFor(id, ctx.coursesById)
          if (syn) trial.push(syn)
        }
        return {
          ...c,
          closed: openCount - countOpenReceiversAcrossMajors(majors, trial, includeRecommended, crossCc),
          newIds,
          newUnits: totalUnits(newIds, ctx.coursesById),
        }
      })
      .filter((c) => c.closed > 0)

    if (scored.length === 0) break

    scored.sort((a, b) => {
      if (a.closed !== b.closed) return b.closed - a.closed
      // Prefer adding fewer new courses / units (rest of the sequence is
      // already covered by the user's existing plan).
      if (a.newIds.length !== b.newIds.length) return a.newIds.length - b.newIds.length
      if (a.newUnits !== b.newUnits) return a.newUnits - b.newUnits
      return a.ids.join(',').localeCompare(b.ids.join(','))
    })

    push(scored[0].ids)
  }

  if (i === safetyCap) {
    // Loop exhausted without natural convergence — usually means a receiver
    // has no satisfiable option in the local catalog. Surface so a future
    // bug is visible instead of silently producing a partial pick.
    console.warn(
      'selectMissingAcrossMajors hit safety cap of', safetyCap,
      '— some required block may not be satisfiable in the user catalog.',
      'Majors:', (majors || []).map((m) => m?.major).filter(Boolean)
    )
  }

  return out
}

/**
 * Count of open (unsatisfied) receivers across all selected majors. Receivers
 * inside an already-complete group or section don't count — that respects
 * group_advisement / section_advisement caps so the greedy loop doesn't
 * over-pick past what the receiver advisement asks for.
 */
function countOpenReceiversAcrossMajors(majors, virtual, includeRecommended = false, crossCc = []) {
  let n = 0
  for (const major of majors || []) {
    for (const group of major?.requirement_groups || []) {
      if (!group.is_required && !includeRecommended) continue
      if (isGroupCompleted(group, virtual, crossCc)) continue
      for (const section of group.sections || []) {
        if (sectionClosesItsReceivers(section, group, virtual, crossCc)) continue
        for (const r of section.receivers || []) {
          if (r.articulation_status === 'not_articulated') continue
          if (isReceiverCompleted(r, virtual, crossCc)) continue
          n++
        }
      }
    }
  }
  return n
}

/**
 * Enumerate every plausible course set we could add this iteration. Yields
 * one candidate per open receiver:
 *   - options_conjunction='or' receiver: emit each option separately (any one
 *     option satisfies the receiver, scorer will pick the best).
 *   - options_conjunction='and' receiver: emit the union of all resolved
 *     options as one atomic candidate — picking just one option of an AND
 *     sequence wouldn't close the receiver, so the scorer would drop it.
 *
 * Within an option, course_conjunction='or' collapses to the cheapest single
 * id; course_conjunction='and' takes every id. Mirrors selectCoursesForReceiver.
 *
 * Deduplicated by the resolved id set so a same-as pair appearing across
 * majors only enumerates once.
 */
function enumerateCandidateOptions(majors, virtual, ctx) {
  const includeRecommended = ctx?.includeRecommended ?? false
  const crossCc = ctx?.crossCc ?? []
  const seenKey = new Set()
  const out = []

  const resolveOpt = (opt) => {
    const ids = (opt?.course_ids || []).map(String)
    if (ids.length === 0) return []
    if ((opt.course_conjunction || 'and').toLowerCase() === 'or') {
      const pick = pickCheapestId(ids, ctx.coursesById)
      return pick ? [pick] : []
    }
    return ids
  }

  const emit = (ids) => {
    if (!ids || ids.length === 0) return
    const key = [...ids].sort().join(',')
    if (seenKey.has(key)) return
    seenKey.add(key)
    out.push({ ids, units: totalUnits(ids, ctx.coursesById) })
  }

  for (const major of majors || []) {
    for (const group of major?.requirement_groups || []) {
      if (!group.is_required && !includeRecommended) continue
      if (isGroupCompleted(group, virtual, crossCc)) continue
      for (const section of group.sections || []) {
        if (sectionClosesItsReceivers(section, group, virtual, crossCc)) continue
        for (const r of section.receivers || []) {
          if (r.articulation_status === 'not_articulated') continue
          if (isReceiverCompleted(r, virtual, crossCc)) continue

          const options = r.options || []
          if (options.length === 0) continue
          const optsConj = (r.options_conjunction || 'and').toLowerCase()

          if (optsConj === 'or') {
            for (const opt of options) emit(resolveOpt(opt))
          } else {
            // AND-sequence: receiver isn't satisfied until every option is.
            // Emit as one atomic candidate.
            const all = options.flatMap(resolveOpt)
            emit(all)
          }
        }
      }
    }
  }
  return out
}

/* ─────────────────────── optimal (branch-and-bound) ─────────────────────── */

/**
 * Atomic "moves" that would satisfy this single receiver. Each move is an
 * array of course_ids that together resolve the receiver under its
 * options_conjunction + course_conjunction semantics. Same resolution rules
 * as enumerateCandidateOptions but emitted per-receiver so B&B can choose
 * which receiver to branch on.
 */
/**
 * Cartesian product of arrays. cartesian([[1,2],[3,4]]) → [[1,3],[1,4],[2,3],[2,4]].
 * Used to enumerate every combination across AND-option choices.
 */
function cartesian(arrays) {
  if (arrays.length === 0) return [[]]
  let acc = [[]]
  for (const arr of arrays) {
    const next = []
    for (const prefix of acc) for (const v of arr) next.push([...prefix, v])
    acc = next
  }
  return acc
}

/**
 * All atomic "moves" that satisfy this receiver — every combination of
 * course_id picks that resolves it under options_conjunction +
 * course_conjunction semantics. Used by B&B to enumerate branches.
 *
 * No greedy shortcut: a course_conjunction='or' option emits ONE branch per
 * member id (not just the cheapest), so the search considers e.g. taking
 * MATH 117 vs COMP 117 separately rather than collapsing to one. This is
 * what makes the picker truly exhaustive — at the cost of branch-factor
 * explosion on receivers with many OR alternatives across many AND options.
 *
 * Move count caveats:
 *   - OR receiver, M options each with k OR members → up to M·k moves
 *   - AND receiver, M options each with k OR members → up to k^M moves
 * Pathological inputs (k^M > 4096) skip the cartesian expansion for that
 * receiver and fall back to the cheapest-per-OR-option pick, which behaves
 * like the old greedy shortcut. The warn surfaces when this happens so we
 * can revisit if real users have a receiver that hits it.
 */
function movesForReceiver(receiver, coursesById) {
  const options = receiver.options || []
  if (options.length === 0) return []
  const optsConj = (receiver.options_conjunction || 'and').toLowerCase()

  // For a single option, list every minimal id-set that satisfies it.
  //   course_conjunction='and' → one set: every id (take all).
  //   course_conjunction='or'  → one set per id (take any one).
  const expandOpt = (opt) => {
    const ids = (opt.course_ids || []).map(String).filter((id) => coursesById.has(id))
    if (ids.length === 0) return []
    if ((opt.course_conjunction || 'and').toLowerCase() === 'or') {
      // Sort lex so deterministic across renders / hashing.
      return [...ids].sort().map((id) => [id])
    }
    return [ids]
  }

  if (optsConj === 'or') {
    // Each option independently satisfies — flatten per-option expansions
    // into one moves list.
    return options.flatMap(expandOpt)
  }

  // AND: every option must be satisfied; a move is the union of one chosen
  // expansion per option. Cartesian product gives every combination.
  const perOpt = options.map(expandOpt)
  if (perOpt.some((w) => w.length === 0)) return []  // an option has no satisfying ids in catalog
  const cartCount = perOpt.reduce((n, w) => n * w.length, 1)
  if (cartCount > 4096) {
    // Pathological branching — fall back to a single greedy combination
    // (cheapest id per OR option) to keep the search tractable.
    console.warn(
      'movesForReceiver: cartesian product would emit', cartCount,
      'moves for one receiver; falling back to greedy pick for this receiver.',
      'Inspect the receiver if this fires often:', receiver?.hash_id || '(no hash_id)'
    )
    const greedyCombo = options.flatMap((opt) => {
      const ids = (opt.course_ids || []).map(String).filter((id) => coursesById.has(id))
      if (ids.length === 0) return []
      if ((opt.course_conjunction || 'and').toLowerCase() === 'or') {
        return [pickCheapestId(ids, coursesById)].filter(Boolean)
      }
      return ids
    })
    return greedyCombo.length > 0 ? [greedyCombo] : []
  }
  return cartesian(perOpt).map((combo) => combo.flat())
}

/**
 * Walk every required (and optionally recommended) receiver across all
 * majors that's still open against `virtual`. Returns array of
 * { receiver, moves } pairs. Used by the B&B search to pick which
 * receiver to branch on.
 */
function findOpenReceiversWithMoves(majors, virtual, coursesById, includeRecommended, crossCc = []) {
  const out = []
  for (const major of majors || []) {
    for (const group of major?.requirement_groups || []) {
      if (!group.is_required && !includeRecommended) continue
      if (isGroupCompleted(group, virtual, crossCc)) continue
      for (const section of group.sections || []) {
        if (sectionClosesItsReceivers(section, group, virtual, crossCc)) continue
        for (const r of section.receivers || []) {
          if (r.articulation_status === 'not_articulated') continue
          if (isReceiverCompleted(r, virtual, crossCc)) continue
          const moves = movesForReceiver(r, coursesById)
          if (moves.length === 0) continue
          out.push({ receiver: r, moves })
        }
      }
    }
  }
  return out
}

/**
 * Branch-and-bound exhaustive picker — finds the globally minimum
 * (course-count → total-units → lexical) set of course_ids that closes
 * every required receiver across all majors. Truly exhaustive: branches
 * over every alternative inside course_conjunction='or' options too, so
 * the search considers e.g. MATH 117 vs COMP 117 separately rather than
 * collapsing to the cheaper one.
 *
 * Why exhaustive: a single "extra" required course typically represents a
 * full semester of work for a student, so suboptimal picks have real human
 * cost. The product wants the actual minimum.
 *
 * Strategy:
 *   1. Run greedy first to get a tight upper bound (best-so-far).
 *   2. DFS, branching on the most-constrained open receiver (fewest moves,
 *      classic MRV heuristic).
 *   3. Prune any partial whose course count already meets/exceeds best.
 *   4. Within a node, try smaller moves first so the bound tightens quickly.
 *   5. DOMINANCE: before branching at a node, collapse moves that have
 *      identical extra-coverage footprint to their cheapest representative.
 *      This is what keeps wide OR receivers (e.g. "Pick ONE of 20 humanities
 *      electives") tractable — 20 alternatives with no cross-major impact
 *      collapse to 1 branch instead of 20.
 *
 * Termination guarantees:
 *   - Wall-clock budget (default 5000ms) — on timeout returns the best result
 *     found so far (always at least the greedy seed). Logs a warning so
 *     production cases hitting the cap become visible. The first run for a
 *     given target set may freeze the UI thread during the search; useMemo
 *     keeps subsequent renders instant.
 *
 * Falls through `selectMissingAcrossMajors`'s output if the search produces
 * nothing strictly better, so the optimal call is never worse than greedy.
 */
function selectMissingAcrossMajorsOptimal(majors, ctx) {
  const includeRecommended = ctx?.includeRecommended ?? false
  const crossCc = ctx?.crossCc ?? []
  const coursesById = ctx.coursesById
  const timeBudgetMs = ctx?.timeBudgetMs ?? 5000

  const greedyIds = selectMissingAcrossMajors(majors, ctx)
  let bestIds = greedyIds
  let bestUnits = totalUnits(greedyIds, coursesById)

  const deadline = Date.now() + timeBudgetMs
  let timedOut = false

  const applyMove = (virtual, move) => {
    const out = [...virtual]
    for (const id of move) {
      const key = String(id)
      if (out.some((u) => String(u.course_id) === key)) continue
      const syn = syntheticCourseFor(id, coursesById)
      if (syn) out.push(syn)
    }
    return out
  }

  // Dominance pre-pass for a single receiver: collapse moves that have
  // identical "extra-coverage footprint" (set of OTHER currently-open
  // receivers they close) to their cheapest representative. This is what
  // makes large OR receivers tractable — a "Pick ONE of 20" humanities
  // receiver whose alternatives don't satisfy any other major's blocks
  // shrinks from 20 branches to 1, since all 20 alternatives have the
  // same (empty) extra footprint and only differ in cost.
  //
  // Soundness: two moves with the same extra footprint produce the same
  // remaining problem after either is picked. Picking the cheaper one
  // dominates picking the more expensive one for the global cost objective.
  function reduceByDominance(moves, currentReceiver, virtual) {
    if (moves.length <= 1) return moves
    // Build footprint key per move: sorted list of other-receiver hash_ids closed.
    const buckets = new Map()
    for (const move of moves) {
      const trial = applyMove(virtual, move)
      const closed = []
      for (const major of majors || []) {
        for (const group of major?.requirement_groups || []) {
          if (!group.is_required && !includeRecommended) continue
          if (isGroupCompleted(group, virtual, crossCc)) continue
          for (const section of group.sections || []) {
            if (sectionClosesItsReceivers(section, group, virtual, crossCc)) continue
            for (const r of section.receivers || []) {
              if (r === currentReceiver) continue
              if (r.articulation_status === 'not_articulated') continue
              if (isReceiverCompleted(r, virtual, crossCc)) continue
              if (isReceiverCompleted(r, trial, crossCc)) {
                // hash_id is the receiving-side fingerprint; same hash_id =
                // same UC ask, even across majors. Falls back to identity
                // when hash_id is missing.
                closed.push(r.hash_id || 'r:' + (r.options || [])
                  .map((o) => (o.course_ids || []).join(',')).join('|'))
              }
            }
          }
        }
      }
      const fpKey = closed.sort().join(';')
      // Score by NEW courses (those not already in virtual) so a sequence
      // that reuses an existing course beats an equivalent one that doesn't.
      let newLen = 0
      let newUnitsSum = 0
      for (const id of move) {
        const key = String(id)
        if (virtual.some((u) => String(u.course_id) === key)) continue
        newLen++
        newUnitsSum += unitsOf(id, coursesById)
      }
      const sortKey = `${newLen}|${newUnitsSum.toFixed(3)}|${[...move].sort().join(',')}`
      const existing = buckets.get(fpKey)
      if (!existing || sortKey < existing.sortKey) {
        buckets.set(fpKey, { move, sortKey })
      }
    }
    return [...buckets.values()].map((b) => b.move)
  }

  function dfs(virtual, picks, runningUnits) {
    if (Date.now() > deadline) { timedOut = true; return }

    // Bound: any extension of `picks` will have ≥ picks.length courses.
    if (picks.length > bestIds.length) return
    if (picks.length === bestIds.length && runningUnits >= bestUnits) return

    const open = findOpenReceiversWithMoves(majors, virtual, coursesById, includeRecommended, crossCc)
    if (open.length === 0) {
      // Goal reached.
      if (picks.length < bestIds.length ||
          (picks.length === bestIds.length && runningUnits < bestUnits)) {
        bestIds = [...picks]
        bestUnits = runningUnits
      }
      return
    }

    // Branch on the most-constrained receiver (fewest satisfying moves).
    // Most-constrained-first prunes the search space the fastest — same idea
    // as MRV in SAT/CSP solvers.
    open.sort((a, b) => a.moves.length - b.moves.length)
    const target = open[0]

    // Dominance-reduce the chosen receiver's moves so a wide OR with no
    // cross-major sharing only branches once (the cheapest representative).
    const reducedMoves = reduceByDominance(target.moves, target.receiver, virtual)

    // Within a node, try smaller / cheaper moves first so the upper bound
    // drops early and prunes more later branches. Score by NEW courses
    // (relative to current virtual) so sequences that reuse existing
    // courses get explored before equivalent ones that don't.
    const sortedMoves = reducedMoves
      .map((ids) => {
        let newLen = 0
        let newUnitsSum = 0
        for (const id of ids) {
          const key = String(id)
          if (virtual.some((u) => String(u.course_id) === key)) continue
          newLen++
          newUnitsSum += unitsOf(id, coursesById)
        }
        return { ids, newLen, newUnits: newUnitsSum }
      })
      .sort((a, b) => {
        if (a.newLen !== b.newLen) return a.newLen - b.newLen
        if (a.newUnits !== b.newUnits) return a.newUnits - b.newUnits
        return a.ids.join(',').localeCompare(b.ids.join(','))
      })

    for (const move of sortedMoves) {
      // Filter to ids actually new (not already in picks or virtual).
      const newIds = []
      let addedUnits = 0
      for (const id of move.ids) {
        const key = String(id)
        if (picks.includes(key)) continue
        if (virtual.some((u) => String(u.course_id) === key)) continue
        if (!coursesById.has(key)) continue
        newIds.push(key)
        addedUnits += unitsOf(id, coursesById)
      }

      // A move that adds no NEW course can't change the virtual state, so the
      // open-receiver set is identical and recursing would loop forever with
      // the same picks (the count bound never fires because picks never grow) —
      // overflowing the stack before the time budget is even checked. This
      // happens when an open receiver's only course is already on the transcript
      // but earns no credit (a D/F/W grade). Such a move is useless: skip it,
      // mirroring the greedy pass, which already requires every pick to make
      // progress (`closed > 0`).
      if (newIds.length === 0) continue

      const newPicks = picks.concat(newIds)
      const newVirtual = applyMove(virtual, move.ids)
      dfs(newVirtual, newPicks, runningUnits + addedUnits)
      if (timedOut) return
    }
  }

  dfs([...(ctx.userCourses || [])], [], 0)

  if (timedOut) {
    console.warn(
      'selectMissingAcrossMajorsOptimal: hit',
      timeBudgetMs + 'ms time budget — returning best result found.',
      'Greedy seed had', greedyIds.length, 'courses; best after search:', bestIds.length
    )
  }
  return bestIds
}

module.exports = { selectMissingAcrossMajors, selectMissingAcrossMajorsOptimal, toSyntheticUserCourse }
