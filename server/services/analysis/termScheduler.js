/**
 * Exact minimum-term scheduler for a fixed community-college course set.
 *
 * This is precedence-constrained bin packing. Every course appears once,
 * native units may not exceed the caller's per-term cap, and every ALL-of
 * prerequisite group must have at least one ANY-of course in an earlier term.
 * The objective is minimum terms; deterministic fuller-first ordering is only
 * a tie-break among schedules with the same term count.
 *
 * The problem is NP-hard. For the research corpus (normally 10-22 courses), a
 * subset-state decision search is exact and fast. Larger/slow cases return a
 * certified lower bound plus a feasible greedy upper-bound schedule, never a
 * heuristic mislabeled as optimal.
 */

const UNIT_SCALE = 100;
const EPSILON = 1e-7;

const ticks = (value) => Math.round(Number(value) * UNIT_SCALE);

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function prerequisiteMasks(courses, requirementsByCourse) {
  const indexById = new Map(courses.map((course, index) => [String(course.course_id), index]));
  return courses.map((course) => {
    const groups = requirementsByCourse.get(String(course.course_id)) || [];
    return groups.map((group) => {
      let mask = 0;
      for (const rawId of group.anyOf || []) {
        const index = indexById.get(String(rawId));
        if (index != null) mask |= (1 << index);
      }
      return mask >>> 0;
    });
  });
}

function sequenceLowerBound(groupMasks, n) {
  // Least fixed point of the AND-of-OR prerequisite graph. Start at infinity
  // and relax downward: a shorter alternative can become reachable after a
  // longer one, so freezing the first finite depth would overstate the bound.
  const depths = new Array(n).fill(Infinity);
  for (let pass = 0; pass < n * n + 1; pass += 1) {
    let changed = false;
    for (let index = 0; index < n; index += 1) {
      const groups = groupMasks[index];
      let candidateDepth = 1;
      if (groups.length) {
        const groupDepths = [];
        let resolvable = true;
        for (const mask of groups) {
          const alternatives = [];
          for (let candidate = 0; candidate < n; candidate += 1) {
            if ((mask & (1 << candidate)) && Number.isFinite(depths[candidate])) {
              alternatives.push(depths[candidate]);
            }
          }
          if (!alternatives.length) {
            resolvable = false;
            break;
          }
          groupDepths.push(Math.min(...alternatives));
        }
        if (!resolvable) continue;
        candidateDepth = 1 + Math.max(...groupDepths);
      }
      if (candidateDepth < depths[index]) {
        depths[index] = candidateDepth;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return {
    terms: Math.max(1, ...depths.filter(Number.isFinite)),
    unresolved: depths.map((depth, index) => (!Number.isFinite(depth) ? index : null)).filter((x) => x != null),
  };
}

function readyIndices(doneMask, fullMask, groupMasks) {
  const ready = [];
  for (let index = 0; index < groupMasks.length; index += 1) {
    const bit = 1 << index;
    if (doneMask & bit) continue;
    if (groupMasks[index].every((groupMask) => (groupMask & doneMask) !== 0)) ready.push(index);
  }
  return ready;
}

// Enumerate only inclusion-maximal ready subsets that fit. This pruning is
// exact: adding another already-ready course to otherwise unused capacity can
// never make a later term or a prerequisite less feasible.
function maximalReadySubsets(ready, unitTicks, capTicks, shouldStop = () => false) {
  const candidates = [];
  let stopped = false;
  const walk = (at, mask, load) => {
    if (shouldStop()) { stopped = true; return; }
    if (at === ready.length) {
      if (!mask) return;
      const maximal = ready.every((index) => {
        const bit = 1 << index;
        return (mask & bit) || load + unitTicks[index] > capTicks;
      });
      if (maximal) candidates.push({ mask: mask >>> 0, load });
      return;
    }
    const index = ready[at];
    const courseUnits = unitTicks[index];
    if (load + courseUnits <= capTicks) {
      walk(at + 1, mask | (1 << index), load + courseUnits);
    }
    if (stopped) return;
    walk(at + 1, mask, load);
  };
  walk(0, 0, 0);
  if (stopped) return null;
  candidates.sort((a, b) => b.load - a.load || a.mask - b.mask);
  return candidates;
}

function greedySchedule(groupMasks, unitTicks, capTicks) {
  const n = unitTicks.length;
  const fullMask = ((1 << n) - 1) >>> 0;
  let done = 0;
  const schedule = [];
  while (done !== fullMask) {
    const ready = readyIndices(done, fullMask, groupMasks)
      .sort((a, b) => unitTicks[b] - unitTicks[a] || a - b);
    if (!ready.length) return null;
    let chosen = 0;
    let load = 0;
    for (const index of ready) {
      if (load + unitTicks[index] > capTicks) continue;
      chosen = (chosen | (1 << index)) >>> 0;
      load += unitTicks[index];
    }
    if (!chosen) return null;
    schedule.push(chosen);
    done = (done | chosen) >>> 0;
  }
  return schedule;
}

function maskCourseIds(mask, courses) {
  const ids = [];
  for (let index = 0; index < courses.length; index += 1) {
    if (mask & (1 << index)) ids.push(String(courses[index].course_id));
  }
  return ids;
}

// Polynomial fallback used before any 32-bit masks are constructed. It gives
// a feasible upper bound for large sets (or when exact search is deliberately
// disabled) while keeping prerequisite alternatives and native-unit caps.
function boundedGreedySchedule(courses, requirementsByCourse, unitTicks, capTicks) {
  const ids = new Set(courses.map((course) => course.course_id));
  const groupsById = new Map();
  const emptyGroups = [];
  for (const course of courses) {
    const groups = (requirementsByCourse.get(course.course_id) || []).map((group, groupIndex) => {
      const anyOf = [...new Set((group.anyOf || []).map(String).filter((id) => ids.has(id)))];
      if (!anyOf.length) emptyGroups.push({ course_id: course.course_id, group_index: groupIndex });
      return anyOf;
    });
    groupsById.set(course.course_id, groups);
  }
  if (emptyGroups.length) return { status: 'incomplete_prerequisites', emptyGroups };

  const depths = new Map(courses.map((course) => [course.course_id, Infinity]));
  for (let pass = 0; pass < courses.length * courses.length + 1; pass += 1) {
    let changed = false;
    for (const course of courses) {
      const groups = groupsById.get(course.course_id);
      let candidate = 1;
      if (groups.length) {
        const groupDepths = groups.map((group) => Math.min(...group.map((id) => depths.get(id))));
        if (groupDepths.some((depth) => !Number.isFinite(depth))) continue;
        candidate = 1 + Math.max(...groupDepths);
      }
      if (candidate < depths.get(course.course_id)) {
        depths.set(course.course_id, candidate);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const done = new Set();
  const schedule = [];
  const unitsById = new Map(courses.map((course, index) => [course.course_id, unitTicks[index]]));
  while (done.size < courses.length) {
    const ready = courses
      .filter((course) => !done.has(course.course_id))
      .filter((course) => groupsById.get(course.course_id)
        .every((group) => group.some((id) => done.has(id))))
      .sort((a, b) => unitsById.get(b.course_id) - unitsById.get(a.course_id)
        || a.course_id.localeCompare(b.course_id));
    if (!ready.length) {
      return {
        status: 'prerequisite_cycle',
        unresolved: courses.filter((course) => !done.has(course.course_id)).map((course) => course.course_id),
      };
    }
    let load = 0;
    const term = [];
    for (const course of ready) {
      const units = unitsById.get(course.course_id);
      if (load + units > capTicks) continue;
      term.push(course.course_id);
      load += units;
    }
    if (!term.length) return { status: 'cap_too_low' };
    for (const id of term) done.add(id);
    schedule.push({ index: schedule.length + 1, course_ids: term.sort() });
  }

  return {
    status: 'bounded',
    schedule,
    sequenceTerms: Math.max(1, ...[...depths.values()].filter(Number.isFinite)),
    unresolved: [...depths.entries()].filter(([, depth]) => !Number.isFinite(depth)).map(([id]) => id),
  };
}

function minimumTermSchedule({
  courses = [],
  requirementsByCourse = new Map(),
  unitCap,
  timeBudgetMs = 1200,
  maxExactCourses = 24,
  maxStates = 250000,
} = {}) {
  const startedAt = Date.now();
  const uniqueCourses = new Map();
  const conflictingCourseIds = new Set();
  for (const course of courses) {
    const normalizedCourse = {
      ...course,
      course_id: String(course.course_id),
      units: Number(course.units),
    };
    const existing = uniqueCourses.get(normalizedCourse.course_id);
    const sameUnits = existing && (existing.units === normalizedCourse.units
      || (Number.isNaN(existing.units) && Number.isNaN(normalizedCourse.units)));
    if (existing && !sameUnits) {
      conflictingCourseIds.add(normalizedCourse.course_id);
    } else if (!existing) {
      uniqueCourses.set(normalizedCourse.course_id, normalizedCourse);
    }
  }
  if (conflictingCourseIds.size) {
    return {
      status: 'inconsistent_courses', optimal: false, min_terms: null, schedule: [],
      conflicting_course_ids: [...conflictingCourseIds].sort(),
    };
  }
  const normalized = [...uniqueCourses.values()]
    .sort((a, b) => a.course_id.localeCompare(b.course_id));
  const cap = Number(unitCap);

  if (!Number.isFinite(cap) || cap <= 0) {
    return { status: 'invalid_cap', optimal: false, min_terms: null, schedule: [] };
  }
  const missingUnits = normalized.filter((course) => !Number.isFinite(course.units) || course.units <= 0);
  if (missingUnits.length) {
    return {
      status: 'incomplete_units', optimal: false, min_terms: null, schedule: [],
      missing_unit_course_ids: missingUnits.map((course) => course.course_id),
    };
  }
  if (!normalized.length) {
    return {
      status: 'optimal', optimal: true, min_terms: 0, lower_bound_terms: 0,
      unit_lower_bound_terms: 0, sequence_lower_bound_terms: 0,
      schedule: [], states_explored: 0, elapsed_ms: Date.now() - startedAt,
    };
  }

  const capTicks = ticks(cap);
  const unitTicks = normalized.map((course) => ticks(course.units));
  const tooLarge = normalized.filter((_, index) => unitTicks[index] > capTicks);
  if (tooLarge.length) {
    return {
      status: 'cap_too_low', optimal: false, min_terms: null, schedule: [],
      minimum_unit_cap: Math.max(...tooLarge.map((course) => course.units)),
      oversized_course_ids: tooLarge.map((course) => course.course_id),
    };
  }

  const totalTicks = sum(unitTicks);
  const unitLower = Math.ceil(totalTicks / capTicks - EPSILON);
  // Exact masks intentionally stay below the signed 32-bit boundary. For a
  // larger set—or a caller-selected lower exact limit—return certified bounds
  // and a feasible list-based schedule instead of allowing mask wraparound.
  if (normalized.length > Math.min(maxExactCourses, 30)) {
    const fallback = boundedGreedySchedule(
      normalized, requirementsByCourse, unitTicks, capTicks,
    );
    if (fallback.status === 'incomplete_prerequisites') {
      return {
        status: fallback.status, optimal: false, min_terms: null, schedule: [],
        empty_prerequisite_groups: fallback.emptyGroups,
      };
    }
    if (fallback.status === 'prerequisite_cycle') {
      return {
        status: fallback.status, optimal: false, min_terms: null, schedule: [],
        unit_lower_bound_terms: unitLower,
        unresolved_course_ids: fallback.unresolved,
      };
    }
    const sequenceLower = Math.min(fallback.sequenceTerms, fallback.schedule.length);
    return {
      status: 'bounded', optimal: false, min_terms: null,
      lower_bound_terms: Math.min(fallback.schedule.length, Math.max(unitLower, sequenceLower)),
      upper_bound_terms: fallback.schedule.length,
      unit_lower_bound_terms: unitLower,
      sequence_lower_bound_terms: sequenceLower,
      schedule: fallback.schedule,
      states_explored: 0,
      elapsed_ms: Date.now() - startedAt,
    };
  }

  const groups = prerequisiteMasks(normalized, requirementsByCourse);
  const emptyGroups = [];
  groups.forEach((courseGroups, courseIndex) => courseGroups.forEach((mask, groupIndex) => {
    if (!mask) emptyGroups.push({ course_id: normalized[courseIndex].course_id, group_index: groupIndex });
  }));
  if (emptyGroups.length) {
    return {
      status: 'incomplete_prerequisites', optimal: false, min_terms: null,
      schedule: [], empty_prerequisite_groups: emptyGroups,
    };
  }

  const sequence = sequenceLowerBound(groups, normalized.length);
  const greedy = greedySchedule(groups, unitTicks, capTicks);
  if (!greedy) {
    const lowerBound = Math.max(unitLower, sequence.terms);
    return {
      status: 'prerequisite_cycle', optimal: false, min_terms: null,
      lower_bound_terms: lowerBound, unit_lower_bound_terms: unitLower,
      sequence_lower_bound_terms: sequence.terms, schedule: [],
      unresolved_course_ids: sequence.unresolved.map((index) => normalized[index].course_id),
    };
  }

  // A certified lower bound cannot exceed a schedule already known to be
  // feasible. Keep that invariant explicit as a final guard around future
  // changes to prerequisite projection.
  const sequenceLower = Math.min(sequence.terms, greedy.length);
  const lowerBound = Math.min(greedy.length, Math.max(unitLower, sequenceLower));

  const greedyScheduleRows = greedy.map((mask, index) => ({
    index: index + 1,
    course_ids: maskCourseIds(mask, normalized),
  }));
  const n = normalized.length;
  const fullMask = ((1 << n) - 1) >>> 0;
  let statesExplored = 0;
  let timedOut = false;
  const deadline = startedAt + Math.max(1, Number(timeBudgetMs) || 1);

  const remainingTicks = (mask) => {
    let total = 0;
    for (let index = 0; index < n; index += 1) {
      if (!(mask & (1 << index))) total += unitTicks[index];
    }
    return total;
  };

  const decide = (termLimit) => {
    const dead = new Set();
    const search = (doneMask, termsLeft) => {
      statesExplored += 1;
      if (statesExplored > maxStates || Date.now() > deadline) {
        timedOut = true;
        return null;
      }
      if (doneMask === fullMask) return [];
      if (termsLeft <= 0) return null;
      if (Math.ceil(remainingTicks(doneMask) / capTicks - EPSILON) > termsLeft) return null;
      const memoKey = `${doneMask}|${termsLeft}`;
      if (dead.has(memoKey)) return null;
      const ready = readyIndices(doneMask, fullMask, groups);
      if (!ready.length) {
        dead.add(memoKey);
        return null;
      }
      const choices = maximalReadySubsets(
        ready, unitTicks, capTicks, () => Date.now() > deadline,
      );
      if (choices == null) {
        timedOut = true;
        return null;
      }
      for (const choice of choices) {
        const nextMask = (doneMask | choice.mask) >>> 0;
        const rest = search(nextMask, termsLeft - 1);
        if (rest) return [choice.mask, ...rest];
        if (timedOut) return null;
      }
      dead.add(memoKey);
      return null;
    };
    return search(0, termLimit);
  };

  for (let termLimit = lowerBound; termLimit <= greedy.length; termLimit += 1) {
    const masks = decide(termLimit);
    if (masks) {
      return {
        status: 'optimal', optimal: true, min_terms: masks.length,
        lower_bound_terms: masks.length, upper_bound_terms: masks.length,
        unit_lower_bound_terms: unitLower,
        sequence_lower_bound_terms: sequenceLower,
        schedule: masks.map((mask, index) => ({
          index: index + 1,
          course_ids: maskCourseIds(mask, normalized),
        })),
        states_explored: statesExplored,
        elapsed_ms: Date.now() - startedAt,
      };
    }
    if (timedOut) break;
  }

  return {
    status: timedOut ? 'bounded' : 'prerequisite_cycle',
    optimal: false,
    min_terms: null,
    lower_bound_terms: lowerBound,
    upper_bound_terms: greedy.length,
    unit_lower_bound_terms: unitLower,
    sequence_lower_bound_terms: sequenceLower,
    schedule: greedyScheduleRows,
    states_explored: statesExplored,
    elapsed_ms: Date.now() - startedAt,
  };
}

module.exports = { minimumTermSchedule };
