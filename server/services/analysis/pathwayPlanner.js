/**
 * Joint major-preparation planner.
 *
 * The direct course set uses the same overlap-aware optimizer as Plan My
 * Transfer. Known local prerequisites are then added and the resulting fixed
 * set is scheduled under a native semester/quarter unit cap. These are two
 * explicit stages: an exact term result is exact for the returned course set,
 * not a claim that every possible ASSIST alternative was jointly optimized for
 * elapsed time.
 */

const {
  selectMissingAcrossMajorsOptimal,
  toSyntheticUserCourse,
} = require('./minCourses');
const { createHash } = require('node:crypto');
const {
  isMajorCompleted,
  calculateMajorCompletionPercentage,
} = require('./eligibility');
const { minimumTermSchedule } = require('./termScheduler');
const { projectGroups } = require('../prereqGraph');

const METHOD_ID = 'joint_major_preparation_v2';
const SINGLETON_CACHE_TTL_MS = 60 * 1000;
const singletonBaselineCache = new Map();
const singletonBaselineCacheCounters = { hits: 0, misses: 0 };
const QUARTER_COLLEGE_IDS = new Set([40, 51, 113]);
// PMT data_parse_script/data/cc_key_dates/colleges.json, reviewed 2026-06-08.
// Keeping the verified universe explicit means a newly imported college is not
// silently assumed to use semesters.
const KNOWN_CALENDAR_COLLEGE_IDS = new Set(
  '2,3,4,5,6,8,9,10,13,14,16,17,18,19,20,25,27,28,30,31,32,33,35,36,38,40,41,43,44,45,47,48,49,51,52,53,54,55,56,57,58,61,62,63,64,65,66,67,68,69,70,71,72,73,74,77,78,80,82,83,84,86,87,90,91,92,93,94,95,96,97,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,118,119,121,122,123,124,125,126,127,130,131,133,134,135,136,137,138,139,140,142,145,146,147,148,149,150,153,200'
    .split(',').map(Number),
);

const round1 = (value) => (Number.isFinite(Number(value)) ? +Number(value).toFixed(1) : null);
const uniq = (values) => [...new Set(values)];
const stripCourseKey = (value) => String(value ?? '').replace(/^cc:/, '');

function stableSerialize(value) {
  if (value === undefined) return '"__undefined__"';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

function fingerprint(value) {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function singletonDataScope(catalog, projectedGroups, excludedHashes) {
  const courseIds = [...catalog.keys()].map(String).sort();
  return fingerprint({
    excluded_receiver_hashes: [...excludedHashes].map(String).sort(),
    courses: courseIds.map((id) => {
      const course = catalog.get(id);
      return {
        course_id: id,
        units: course?.units,
        same_as: (course?.same_as || []).map((peer) => String(peer.course_id)).sort(),
        concept: course?.concept,
        concept_source: course?.concept_source,
      };
    }),
    prerequisite_groups: courseIds.map((id) => ({
      course_id: id,
      groups: projectedGroups.get(`cc:${id}`) || [],
    })),
  });
}

function singletonBaselineKey({
  collegeId, target, major, optimizerBudget, dataScope,
}) {
  const agreementScope = fingerprint({
    school_id: Number(target.school_id),
    configured_major: String(target.major),
    requirement_groups: major.requirement_groups || [],
  });
  return [
    'singleton-v1', collegeId, target.school_id, optimizerBudget, dataScope, agreementScope,
  ].join('|');
}

function pruneSingletonBaselineCache(now = Date.now()) {
  for (const [key, entry] of singletonBaselineCache) {
    if (now - entry.at >= SINGLETON_CACHE_TTL_MS) singletonBaselineCache.delete(key);
  }
}

function cachedSingletonBaseline(key, build) {
  const now = Date.now();
  const hit = singletonBaselineCache.get(key);
  if (hit && now - hit.at < SINGLETON_CACHE_TTL_MS) {
    singletonBaselineCacheCounters.hits += 1;
    return hit.value;
  }
  if (hit) singletonBaselineCache.delete(key);
  singletonBaselineCacheCounters.misses += 1;
  const value = build();
  singletonBaselineCache.set(key, { at: Date.now(), value });
  return value;
}

function clearSingletonBaselineCache() {
  singletonBaselineCache.clear();
  singletonBaselineCacheCounters.hits = 0;
  singletonBaselineCacheCounters.misses = 0;
}

function singletonBaselineCacheStats() {
  pruneSingletonBaselineCache();
  return {
    size: singletonBaselineCache.size,
    hits: singletonBaselineCacheCounters.hits,
    misses: singletonBaselineCacheCounters.misses,
  };
}

function normalizeMajor(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^\s*cse\s*:\s*/i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/bachelor\s+of\s+science/g, 'bs')
    .replace(/bachelor\s+of\s+arts/g, 'ba')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function calendarForCollege(collegeId) {
  const id = Number(collegeId);
  if (!KNOWN_CALENDAR_COLLEGE_IDS.has(id)) return 'unknown';
  return QUARTER_COLLEGE_IDS.has(id) ? 'quarter' : 'semester';
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((total, value) => total + value, 0) / usable.length : null;
}

function median(values) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
}

function metricStats(rows, read) {
  const values = rows.map(read).filter(Number.isFinite);
  return { value: round1(mean(values)), n: values.length };
}

function cleanTelemetry(telemetry) {
  return {
    algorithm: telemetry.algorithm,
    elapsed_ms: telemetry.elapsedMs,
    time_budget_ms: telemetry.timeBudgetMs,
    greedy_course_count: telemetry.greedyCourseCount,
    best_course_count: telemetry.bestCourseCount,
    best_units: round1(telemetry.bestUnits),
    states_explored: Number(telemetry.statesExplored) || 0,
    timed_out: Boolean(telemetry.timedOut),
    cartesian_fallbacks: Number(telemetry.cartesianFallbacks) || 0,
    unsupported_unit_fallbacks: Number(telemetry.unsupportedUnitFallbacks) || 0,
    missing_catalog_ids: telemetry.missingCatalogIds || [],
    optimality_proven: Boolean(telemetry.optimalityProven),
  };
}

function prepAgreement(doc, excludedHashes = new Set()) {
  return {
    ...doc,
    requirement_groups: (doc.requirement_groups || []).map((group) => ({
      ...group,
      sections: (group.sections || []).map((section) => ({
        ...section,
        receivers: (section.receivers || [])
          .filter((receiver) => !excludedHashes.has(String(receiver.hash_id)))
          .map((receiver) => ({
            ...receiver,
            options: (receiver.options || []).map((option) => ({
              ...option,
              course_ids: (option.course_ids || []).map(String),
            })),
          })),
      })),
    })),
  };
}

function referencedCourseIds(major) {
  const ids = new Set();
  for (const group of major.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        for (const option of receiver.options || []) {
          for (const id of option.course_ids || []) ids.add(String(id));
        }
      }
    }
  }
  return ids;
}

function buildCatalogs(courseRows) {
  const rowsByCollege = new Map();
  for (const row of courseRows) {
    const collegeId = Number(row.community_college_id ?? String(row.institution_id || '').replace(/^cc:/, ''));
    if (!Number.isFinite(collegeId)) continue;
    if (!rowsByCollege.has(collegeId)) rowsByCollege.set(collegeId, []);
    rowsByCollege.get(collegeId).push(row);
  }

  const catalogs = new Map();
  for (const [collegeId, rows] of rowsByCollege) {
    const catalog = new Map();
    const conflicts = new Set();
    for (const row of rows) {
      const id = String(row.course_id);
      const units = row.units == null ? null : Number(row.units);
      const existing = catalog.get(id);
      if (existing && existing.units !== units) conflicts.add(id);
      if (existing) continue;
      catalog.set(id, {
        course_id: id,
        units: Number.isFinite(units) ? units : null,
        prefix: row.prefix ?? null,
        number: row.number ?? null,
        code: [row.prefix, row.number].filter(Boolean).join(' ') || `Course ${id}`,
        title: row.title ?? null,
        concept: row.concept ?? null,
        concept_source: row.concept_source,
        concept_confidence: row.concept_confidence ?? null,
        same_as: [],
        raw_same_as: (row.same_as || []).map((peer) => stripCourseKey(peer?.course_id ?? peer)),
      });
    }

    // Real same_as objects are intact; same_as_keys in this corpus contain
    // malformed "cc:[object Object]" strings. Build reciprocal transitive
    // components from the real objects so one physical course is counted once.
    const adjacency = new Map([...catalog.keys()].map((id) => [id, new Set()]));
    for (const course of catalog.values()) {
      for (const peerId of course.raw_same_as) {
        if (!catalog.has(peerId) || peerId === course.course_id) continue;
        adjacency.get(course.course_id).add(peerId);
        adjacency.get(peerId).add(course.course_id);
      }
    }
    const visited = new Set();
    for (const id of catalog.keys()) {
      if (visited.has(id)) continue;
      const component = [];
      const queue = [id];
      visited.add(id);
      while (queue.length) {
        const next = queue.shift();
        component.push(next);
        for (const peer of adjacency.get(next) || []) {
          if (visited.has(peer)) continue;
          visited.add(peer);
          queue.push(peer);
        }
      }
      for (const member of component) {
        catalog.get(member).same_as = component
          .filter((peer) => peer !== member)
          .map((peer) => ({ course_id: peer }));
        delete catalog.get(member).raw_same_as;
      }
    }
    catalogs.set(collegeId, { courses: catalog, conflicts });
  }
  return catalogs;
}

function equivalentIds(id, catalog) {
  const key = String(id);
  return new Set([key, ...(catalog.get(key)?.same_as || []).map((peer) => String(peer.course_id))]);
}

function equivalent(a, b, catalog) {
  return equivalentIds(a, catalog).has(String(b));
}

function selectedSatisfiers(candidateIds, selected, catalog) {
  const candidates = candidateIds.map(stripCourseKey);
  return [...selected].filter((selectedId) =>
    candidates.some((candidateId) => equivalent(selectedId, candidateId, catalog)));
}

function compareFootprints(a, b, selected, catalog) {
  const newA = [...a.ids].filter((id) => !selected.has(id));
  const newB = [...b.ids].filter((id) => !selected.has(id));
  if (newA.length !== newB.length) return newA.length - newB.length;
  const units = (ids) => ids.reduce((total, id) => total + (Number(catalog.get(id)?.units) || 0), 0);
  const unitDiff = units(newA) - units(newB);
  return unitDiff || newA.sort().join(',').localeCompare(newB.sort().join(','));
}

function closePrerequisites(directIds, catalog, projectedGroups) {
  const selected = new Set(directIds.map(String));
  const direct = new Set(selected);
  const unresolved = [];
  let prerequisiteChoices = 0;

  const groupsFor = (id) => projectedGroups.get(`cc:${id}`);
  const footprint = (candidateId, baseSelected, path = new Set()) => {
    const id = String(candidateId);
    if ([...baseSelected].some((selectedId) => equivalent(selectedId, id, catalog))) {
      return { valid: true, ids: new Set() };
    }
    const course = catalog.get(id);
    if (!course || !Number.isFinite(course.units) || course.units <= 0 || path.has(id)) {
      return { valid: false, ids: new Set() };
    }
    const ids = new Set([id]);
    const working = new Set([...baseSelected, id]);
    const nextPath = new Set([...path, id]);
    for (const group of groupsFor(id) || []) {
      const candidates = (group.anyOf || []).map(stripCourseKey);
      if (selectedSatisfiers(candidates, working, catalog).length) continue;
      const options = candidates
        .map((candidate) => footprint(candidate, working, nextPath))
        .filter((option) => option.valid)
        .sort((a, b) => compareFootprints(a, b, working, catalog));
      if (!options.length) return { valid: false, ids: new Set() };
      for (const added of options[0].ids) {
        ids.add(added);
        working.add(added);
      }
    }
    return { valid: true, ids };
  };

  const queue = [...selected];
  for (let at = 0; at < queue.length; at += 1) {
    const courseId = queue[at];
    for (const group of groupsFor(courseId) || []) {
      const candidates = (group.anyOf || []).map(stripCourseKey);
      if (selectedSatisfiers(candidates, selected, catalog).length) continue;
      const options = candidates
        .map((candidate) => footprint(candidate, selected, new Set([courseId])))
        .filter((option) => option.valid)
        .sort((a, b) => compareFootprints(a, b, selected, catalog));
      if (options.length > 1) prerequisiteChoices += 1;
      if (!options.length) {
        unresolved.push({ course_id: courseId, concept: group.concept || null });
        continue;
      }
      for (const id of options[0].ids) {
        if (selected.has(id)) continue;
        selected.add(id);
        queue.push(id);
      }
    }
  }

  const requirementsByCourse = new Map();
  for (const courseId of selected) {
    const resolvedGroups = [];
    for (const group of groupsFor(courseId) || []) {
      const satisfiers = selectedSatisfiers(group.anyOf || [], selected, catalog);
      if (!satisfiers.length) {
        unresolved.push({ course_id: courseId, concept: group.concept || null });
        continue;
      }
      resolvedGroups.push({ concept: group.concept || null, anyOf: satisfiers.sort() });
    }
    requirementsByCourse.set(courseId, resolvedGroups);
  }

  const unresolvedUnique = [];
  const unresolvedKeys = new Set();
  for (const item of unresolved) {
    const key = `${item.course_id}|${item.concept || ''}`;
    if (unresolvedKeys.has(key)) continue;
    unresolvedKeys.add(key);
    unresolvedUnique.push(item);
  }
  const examined = [...selected].filter((id) => catalog.get(id)?.concept_source !== undefined).length;
  const mapped = [...selected].filter((id) => Boolean(catalog.get(id)?.concept)).length;
  return {
    ids: [...selected].sort(),
    prerequisite_ids: [...selected].filter((id) => !direct.has(id)).sort(),
    requirements_by_course: requirementsByCourse,
    unresolved_groups: unresolvedUnique,
    prerequisite_choices: prerequisiteChoices,
    evidence: {
      examined_courses: examined,
      mapped_courses: mapped,
      total_courses: selected.size,
      examined_pct: selected.size ? round1((100 * examined) / selected.size) : null,
      mapped_pct: selected.size ? round1((100 * mapped) / selected.size) : null,
    },
  };
}

function solveDirect(majors, catalog, timeBudgetMs) {
  const telemetry = {};
  const ids = selectMissingAcrossMajorsOptimal(majors, {
    userCourses: [],
    coursesById: catalog,
    includeRecommended: false,
    crossCc: [],
    timeBudgetMs,
    telemetry,
    suppressWarnings: true,
  }).map(String).sort();
  const transcript = ids.map((id) => catalog.get(id)).filter(Boolean).map(toSyntheticUserCourse);
  const productComplete = majors.every((major) => isMajorCompleted(major, transcript, [], false));
  const strictComplete = majors.every((major) => isMajorCompleted(major, transcript, [], true));
  const missingReferences = uniq(majors.flatMap((major) =>
    [...referencedCourseIds(major)].filter((id) => !catalog.has(id)))).sort();
  const missingUnitIds = ids.filter((id) => {
    const units = catalog.get(id)?.units;
    return !Number.isFinite(units) || units <= 0;
  });
  // The branch-and-bound search can only prove an optimum over courses that
  // exist in the local catalog. Even an unused missing alternative could have
  // produced a smaller shared plan, so catalog incompleteness must revoke the
  // global proof rather than merely produce a warning.
  const cleanedOptimizer = cleanTelemetry(telemetry);
  cleanedOptimizer.missing_agreement_reference_ids = missingReferences;
  cleanedOptimizer.catalog_complete = missingReferences.length === 0;
  cleanedOptimizer.optimality_proven = cleanedOptimizer.optimality_proven
    && cleanedOptimizer.catalog_complete;
  return {
    ids,
    transcript,
    product_complete: productComplete,
    strict_complete: strictComplete,
    missing_reference_ids: missingReferences,
    missing_unit_ids: missingUnitIds,
    optimizer: cleanedOptimizer,
  };
}

function totalUnits(ids, catalog) {
  const values = ids.map((id) => catalog.get(String(id))?.units);
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  return round1(values.reduce((total, value) => total + value, 0));
}

function compactSchedule(schedule) {
  return {
    status: schedule.status,
    optimal: Boolean(schedule.optimal),
    min_terms: schedule.min_terms ?? null,
    lower_bound_terms: schedule.lower_bound_terms ?? null,
    upper_bound_terms: schedule.upper_bound_terms ?? null,
    unit_lower_bound_terms: schedule.unit_lower_bound_terms ?? null,
    sequence_lower_bound_terms: schedule.sequence_lower_bound_terms ?? null,
    minimum_unit_cap: schedule.minimum_unit_cap ?? null,
    states_explored: schedule.states_explored ?? null,
    elapsed_ms: schedule.elapsed_ms ?? null,
  };
}

function scheduleClosedPlan(closure, catalog, unitSystem, unitCap, timeBudgetMs) {
  if (unitSystem === 'unknown') {
    return {
      raw: { status: 'calendar_unavailable', optimal: false, min_terms: null, schedule: [] },
      terms: [],
    };
  }
  const courses = closure.ids.map((id) => catalog.get(id)).filter(Boolean);
  const raw = minimumTermSchedule({
    courses,
    requirementsByCourse: closure.requirements_by_course,
    unitCap,
    timeBudgetMs,
  });
  const termWord = unitSystem === 'quarter' ? 'Quarter' : 'Semester';
  const terms = (raw.schedule || []).map((term, index) => {
    const termCourses = term.course_ids.map((id) => catalog.get(String(id))).filter(Boolean);
    return {
      index: term.index || index + 1,
      label: `${termWord} ${term.index || index + 1}`,
      course_ids: term.course_ids.map(String),
      course_count: term.course_ids.length,
      units: round1(termCourses.reduce((total, course) => total + (Number(course.units) || 0), 0)),
    };
  });
  return { raw, terms };
}

function courseTargetIds(courseId, targets, majorsBySchool, catalog) {
  const out = [];
  for (const target of targets) {
    const refs = referencedCourseIds(majorsBySchool.get(target.school_id));
    if ([...refs].some((id) => equivalent(courseId, id, catalog))) out.push(target.school_id);
  }
  return out;
}

function chosenPrerequisites(courseId, requirementsByCourse, termById) {
  const dependentTerm = termById.get(String(courseId));
  return uniq((requirementsByCourse.get(String(courseId)) || []).map((group) => {
    const candidates = uniq((group.anyOf || []).map(String));
    const earlier = candidates.filter((candidate) => {
      const candidateTerm = termById.get(candidate);
      return Number.isFinite(candidateTerm)
        && Number.isFinite(dependentTerm)
        && candidateTerm < dependentTerm;
    });
    const usable = earlier.length ? earlier : candidates;
    return usable.sort((left, right) => {
      const leftTerm = termById.get(left) ?? Infinity;
      const rightTerm = termById.get(right) ?? Infinity;
      return leftTerm - rightTerm || left.localeCompare(right);
    })[0];
  }).filter(Boolean)).sort();
}

function detailedCourses({ closure, directIds, catalog, targets, majorsBySchool, terms }) {
  const direct = new Set(directIds);
  const termById = new Map(terms.flatMap((term) =>
    term.course_ids.map((id) => [String(id), term.index])));
  // The structured graph stores any-of alternatives. A valid schedule needs
  // only one earlier course from each group, so expose and attribute one
  // deterministic satisfier rather than making every selected alternative look
  // simultaneously required.
  const chosenByCourse = new Map(closure.ids.map((id) => [
    id,
    chosenPrerequisites(id, closure.requirements_by_course, termById),
  ]));
  const attribution = new Map(closure.ids.map((id) => [id, new Set(
    direct.has(id) ? courseTargetIds(id, targets, majorsBySchool, catalog) : [],
  )]));
  // A prerequisite supports every campus supported by the course that depends
  // on it. Iterate to a fixed point for chains.
  for (let pass = 0; pass < closure.ids.length + 1; pass += 1) {
    let changed = false;
    for (const dependent of closure.ids) {
      const targetIds = attribution.get(dependent);
      for (const prerequisite of chosenByCourse.get(dependent) || []) {
        const target = attribution.get(prerequisite);
        if (!target) continue;
        for (const schoolId of targetIds) {
          if (!target.has(schoolId)) { target.add(schoolId); changed = true; }
        }
      }
    }
    if (!changed) break;
  }
  return closure.ids.map((id) => {
    const course = catalog.get(id);
    const prereqs = chosenByCourse.get(id) || [];
    let evidence = 'Not yet reviewed';
    if (course.concept_source !== undefined && course.concept) evidence = 'Reviewed concept match';
    else if (course.concept_source !== undefined) evidence = 'Reviewed; no concept match';
    return {
      course_id: id,
      code: course.code,
      prefix: course.prefix,
      number: course.number,
      title: course.title,
      units: course.units,
      role: direct.has(id) ? 'major_preparation' : 'prerequisite_only',
      school_ids: [...attribution.get(id)].sort((a, b) => a - b),
      prerequisite_ids: prereqs,
      modeled_term: termById.get(id) ?? null,
      evidence,
    };
  }).sort((a, b) => (a.modeled_term ?? Infinity) - (b.modeled_term ?? Infinity)
    || a.code.localeCompare(b.code));
}

async function resolveTargets(db, auditDb, schoolIds, visiblePairs) {
  let pairs = [];
  if (Array.isArray(visiblePairs)) {
    pairs = visiblePairs.filter((pair) => schoolIds.includes(Number(pair.school_id)));
  } else {
    const saved = await auditDb.collection('settings').findOne(
      { _id: 'app' }, { projection: { visible_pairs: 1 } },
    );
    pairs = (saved?.visible_pairs || []).filter((pair) => schoolIds.includes(Number(pair.school_id)));
    if (pairs.length !== schoolIds.length) {
      const degrees = await db.collection('curated_requirements')
        .find({ kind: 'degree', school_id: { $in: schoolIds } }, { projection: { school_id: 1, program: 1 } })
        .toArray();
      for (const schoolId of schoolIds) {
        if (pairs.some((pair) => Number(pair.school_id) === schoolId)) continue;
        const degree = degrees.find((row) => Number(row.school_id) === schoolId);
        if (!degree?.program) continue;
        const names = await db.collection('assist_agreements').distinct('major', { uc_school_id: schoolId });
        const matches = names.filter((name) => normalizeMajor(name) === normalizeMajor(degree.program));
        if (matches.length === 1) pairs.push({ school_id: schoolId, major: matches[0] });
      }
    }
  }

  const bySchool = new Map();
  for (const pair of pairs) {
    const schoolId = Number(pair.school_id);
    if (!schoolIds.includes(schoolId) || bySchool.has(schoolId)) continue;
    bySchool.set(schoolId, { school_id: schoolId, major: String(pair.major) });
  }
  const missing = schoolIds.filter((schoolId) => !bySchool.has(schoolId));
  if (missing.length) {
    const error = new Error(`No configured program for campus ids: ${missing.join(', ')}`);
    error.code = 'MISSING_TARGET_PROGRAM';
    throw error;
  }
  const institutions = await db.collection('assist_institutions')
    .find({ kind: 'university', source_id: { $in: schoolIds } }, { projection: { source_id: 1, name: 1 } })
    .toArray();
  const nameById = new Map(institutions.map((row) => [Number(row.source_id), row.name]));
  return schoolIds.map((schoolId) => ({
    ...bySchool.get(schoolId),
    school: nameById.get(schoolId) || `Campus ${schoolId}`,
    program: bySchool.get(schoolId).major,
  }));
}

function makeCalendarGroups(rows) {
  return ['semester', 'quarter'].map((unitSystem) => {
    const cohort = rows.filter((row) => row.unit_system === unitSystem);
    const exact = cohort.filter((row) => row.status === 'optimal'
      && Number.isFinite(row.combined.estimated_terms));
    const bounded = cohort.filter((row) => row.status === 'bounded');
    const estimated = cohort.filter((row) => row.status === 'estimated');
    const unavailable = cohort.filter((row) => row.status === 'unavailable');
    const values = exact.map((row) => row.combined.estimated_terms);
    const premium = metricStats(exact, (row) => row.combined.optionality_premium_terms);
    const bins = new Map();
    for (const value of values) bins.set(value, (bins.get(value) || 0) + 1);
    return {
      unit_system: unitSystem,
      n: cohort.length,
      exact_n: exact.length,
      bounded_n: bounded.length,
      estimated_n: estimated.length,
      unavailable_n: unavailable.length,
      excluded_n: cohort.length - exact.length,
      mean_terms: round1(mean(values)),
      median_terms: round1(median(values)),
      mean_optionality_premium_terms: premium.value,
      mean_optionality_premium_terms_n: premium.n,
      distribution: [...bins.entries()]
        .map(([terms, count]) => ({ terms, count }))
        .sort((a, b) => a.terms - b.terms),
    };
  });
}

async function loadMultiCampusPathwayContext(db, auditDb, params = {}) {
  const schoolIds = uniq((params.schoolIds || []).map(Number).filter(Number.isFinite))
    .sort((a, b) => a - b);
  if (!schoolIds.length) throw new Error('At least one campus id is required to load planner data.');
  const communityCollegeId = Number(params.communityCollegeId);
  const collegeScoped = Number.isFinite(communityCollegeId) && communityCollegeId > 0;
  const targets = await resolveTargets(db, auditDb, schoolIds, params.visiblePairs);
  const collegeFilter = { kind: 'community_college' };
  if (collegeScoped) collegeFilter.source_id = communityCollegeId;
  const agreementTarget = {
    $or: targets.map((target) => ({ uc_school_id: target.school_id, major: target.major })),
  };
  if (collegeScoped) agreementTarget.community_college_id = communityCollegeId;
  const courseFilter = { side: 'sending' };
  if (collegeScoped) courseFilter.institution_id = `cc:${communityCollegeId}`;
  const [colleges, agreementRows, courseRows, conceptRows, overrideRows] = await Promise.all([
    db.collection('assist_institutions').find(collegeFilter).sort({ name: 1 }).toArray(),
    db.collection('assist_agreements').find(agreementTarget).toArray(),
    db.collection('assist_courses').find(courseFilter, { projection: {
      course_id: 1, community_college_id: 1, institution_id: 1,
      prefix: 1, number: 1, title: 1, units: 1, same_as: 1,
      concept: 1, concept_source: 1, concept_confidence: 1, language: 1,
    } }).toArray(),
    db.collection('curated_requirements').find({ kind: 'prereq_concept' }).toArray(),
    auditDb.collection('curated_mappings').find({ kind: 'receiver_override', exclude: true }).toArray(),
  ]);
  const excludedHashes = new Set(overrideRows.map((row) =>
    String(row.receiver_hash ?? row.legacy_id ?? '').replace(/^receiver_override:/, '')));
  const catalogs = buildCatalogs(courseRows);
  const projectedGroups = projectGroups(conceptRows, courseRows);
  const agreementsByCell = new Map();
  for (const agreement of agreementRows) {
    const key = `${Number(agreement.community_college_id)}|${Number(agreement.uc_school_id)}`;
    if (!agreementsByCell.has(key)) agreementsByCell.set(key, []);
    agreementsByCell.get(key).push(prepAgreement(agreement, excludedHashes));
  }
  const dataScopes = new Map();
  for (const college of colleges) {
    const collegeId = Number(college.source_id);
    const catalog = catalogs.get(collegeId)?.courses || new Map();
    dataScopes.set(collegeId, singletonDataScope(catalog, projectedGroups, excludedHashes));
  }
  // Serialize each document once before sorting. The sending catalog is large;
  // invoking the recursive serializer from a sort comparator would multiply
  // that work by O(log n) during a manual snapshot build.
  const canonical = (rows) => rows.map(stableSerialize).sort();
  const sourceFingerprint = params.includeSourceFingerprint ? fingerprint({
    method_id: METHOD_ID,
    target_programs: targets,
    colleges: canonical(colleges),
    agreements: canonical(agreementRows),
    courses: canonical(courseRows),
    prerequisite_concepts: canonical(conceptRows),
    receiver_overrides: canonical(overrideRows),
    quarter_college_ids: [...QUARTER_COLLEGE_IDS].sort((a, b) => a - b),
    known_calendar_college_ids: [...KNOWN_CALENDAR_COLLEGE_IDS].sort((a, b) => a - b),
  }) : null;
  return {
    schoolIds,
    targets,
    colleges,
    catalogs,
    projectedGroups,
    excludedHashes,
    agreementsByCell,
    dataScopes,
    sourceFingerprint,
    singletonBaselines: params.retainSingletonBaselines ? new Map() : null,
    singletonSchedules: params.retainSingletonBaselines ? new Map() : null,
    calendarForCollege,
  };
}

function contextCachedSingletonBaseline(context, key, build) {
  if (!context.singletonBaselines) return cachedSingletonBaseline(key, build);
  if (context.singletonBaselines.has(key)) return context.singletonBaselines.get(key);
  const value = build();
  context.singletonBaselines.set(key, value);
  return value;
}

function contextCachedSingletonSchedule(context, key, build) {
  if (!context.singletonSchedules) return build();
  if (context.singletonSchedules.has(key)) return context.singletonSchedules.get(key);
  const value = build();
  context.singletonSchedules.set(key, value);
  return value;
}

function multiCampusPathwaysDataFromContext(context, params = {}) {
  pruneSingletonBaselineCache();
  const schoolIds = uniq((params.schoolIds || []).map(Number).filter(Number.isFinite))
    .sort((a, b) => a - b);
  const mode = params.mode === 'college' ? 'college' : 'average';
  const semesterLoad = Number(params.semesterLoad) || 15;
  const quarterLoad = Number(params.quarterLoad) || 15;
  const communityCollegeId = mode === 'college' ? Number(params.communityCollegeId) : null;
  const targetById = new Map(context.targets.map((target) => [Number(target.school_id), target]));
  const targets = schoolIds.map((schoolId) => targetById.get(schoolId)).filter(Boolean);
  if (targets.length !== schoolIds.length) {
    const missing = schoolIds.filter((schoolId) => !targetById.has(schoolId));
    throw new Error(`Planner context does not contain campus ids: ${missing.join(', ')}`);
  }
  const colleges = mode === 'college'
    ? context.colleges.filter((college) => Number(college.source_id) === communityCollegeId)
    : context.colleges;
  const {
    catalogs, projectedGroups, excludedHashes, agreementsByCell, dataScopes,
  } = context;

  const optimizerBudget = mode === 'college' ? 5000 : 180;
  const scheduleBudget = mode === 'college' ? 3000 : 100;
  const rows = [];
  for (const college of colleges) {
    const collegeId = Number(college.source_id);
    const unitSystem = calendarForCollege(collegeId);
    const unitCap = unitSystem === 'quarter' ? quarterLoad : semesterLoad;
    const warnings = [];
    const catalogEntry = catalogs.get(collegeId) || { courses: new Map(), conflicts: new Set() };
    const catalog = catalogEntry.courses;
    const majorsBySchool = new Map();
    let agreementError = false;
    for (const target of targets) {
      const matches = agreementsByCell.get(`${collegeId}|${target.school_id}`) || [];
      if (matches.length !== 1) {
        agreementError = true;
        warnings.push(matches.length
          ? `${target.school} has more than one matching agreement for this college.`
          : `${target.school} has no matching agreement for this college.`);
        continue;
      }
      majorsBySchool.set(target.school_id, matches[0]);
    }

    const base = {
      community_college_id: collegeId,
      community_college: college.name,
      unit_system: unitSystem,
      calendar_source: 'PMT reviewed college calendar file, 2026-06-08',
      targets_modeled: majorsBySchool.size,
      status: 'unavailable',
      warnings,
      combined: {},
      campuses: [],
    };
    if (agreementError || majorsBySchool.size !== targets.length || !catalog.size) {
      if (!catalog.size) warnings.push('The sending-course catalog is unavailable for this college.');
      rows.push(base);
      continue;
    }

    const majors = targets.map((target) => majorsBySchool.get(target.school_id));
    const dataScope = dataScopes.get(collegeId)
      || singletonDataScope(catalog, projectedGroups, excludedHashes);
    let singleTargetBaseline = null;
    if (targets.length === 1) {
      const target = targets[0];
      const major = majors[0];
      const cacheKey = singletonBaselineKey({
        collegeId, target, major, optimizerBudget, dataScope,
      });
      singleTargetBaseline = contextCachedSingletonBaseline(context, cacheKey, () => {
        const direct = solveDirect([major], catalog, optimizerBudget);
        const closed = closePrerequisites(direct.ids, catalog, projectedGroups);
        return { direct, closure: closed, units: totalUnits(closed.ids, catalog) };
      });
    }
    const joint = singleTargetBaseline?.direct
      || solveDirect(majors, catalog, optimizerBudget);
    const closure = singleTargetBaseline?.closure
      || closePrerequisites(joint.ids, catalog, projectedGroups);
    const scheduled = scheduleClosedPlan(closure, catalog, unitSystem, unitCap, scheduleBudget);
    const majorNativeUnits = totalUnits(joint.ids, catalog);
    const nativeUnits = singleTargetBaseline?.units ?? totalUnits(closure.ids, catalog);
    const semesterEquivalent = nativeUnits == null ? null
      : round1(unitSystem === 'quarter' ? nativeUnits * 2 / 3 : nativeUnits);

    if (!joint.product_complete) warnings.push('The returned courses do not complete all locally available agreement work.');
    if (!joint.strict_complete) warnings.push('At least one selected agreement includes required preparation this college cannot articulate.');
    if (joint.missing_reference_ids.length) {
      warnings.push(`${joint.missing_reference_ids.length} agreement course ${joint.missing_reference_ids.length === 1 ? 'reference is' : 'references are'} absent from the catalog; unused alternatives do not count as zero-unit courses.`);
    }
    if (joint.missing_unit_ids.length) warnings.push('At least one selected course has no usable unit value.');
    if (catalogEntry.conflicts.size) warnings.push('The catalog has conflicting duplicate course-unit records.');
    if (closure.unresolved_groups.length) {
      warnings.push(`${closure.unresolved_groups.length} prerequisite ${closure.unresolved_groups.length === 1 ? 'group is' : 'groups are'} not available in the reviewed local concept graph; the term estimate assumes that work is already satisfied or not locally required.`);
    }
    if (closure.evidence.examined_courses < closure.evidence.total_courses) {
      warnings.push(`${closure.evidence.total_courses - closure.evidence.examined_courses} selected ${closure.evidence.total_courses - closure.evidence.examined_courses === 1 ? 'course has' : 'courses have'} not yet been reviewed for prerequisites.`);
    }
    if (!joint.optimizer.optimality_proven) warnings.push('The course search returned its best found plan without proving the global minimum.');
    if (scheduled.raw.status === 'bounded') warnings.push('The term scheduler returned a certified range rather than one proven minimum.');

    const singletons = [];
    for (const target of targets) {
      const major = majorsBySchool.get(target.school_id);
      const cacheKey = singletonBaselineKey({
        collegeId, target, major, optimizerBudget, dataScope,
      });
      const baseline = singleTargetBaseline
        || contextCachedSingletonBaseline(context, cacheKey, () => {
          const direct = solveDirect([major], catalog, optimizerBudget);
          const closed = closePrerequisites(direct.ids, catalog, projectedGroups);
          return { direct, closure: closed, units: totalUnits(closed.ids, catalog) };
        });
      const { direct: single, closure: singleClosure, units: singleUnits } = baseline;
      // Scheduling is deliberately outside the cache: the user's native unit
      // load and the per-mode scheduler budget can change independently of the
      // direct-course and prerequisite-closure inputs above.
      const singleSchedule = singleTargetBaseline
        ? scheduled
        : contextCachedSingletonSchedule(
          context,
          `${cacheKey}|${unitSystem}|${unitCap}|${scheduleBudget}`,
          () => scheduleClosedPlan(singleClosure, catalog, unitSystem, unitCap, scheduleBudget),
        );
      singletons.push({
        target, direct: single, closure: singleClosure, units: singleUnits,
        schedule: singleSchedule.raw,
      });
    }
    const multi = targets.length > 1;
    const directBaselinesComplete = singletons.every((item) =>
      item.direct.product_complete && item.direct.optimizer.optimality_proven && item.units != null);
    const closedBaselinesComplete = directBaselinesComplete
      && closure.unresolved_groups.length === 0
      && singletons.every((item) => item.closure.unresolved_groups.length === 0);
    const maxSingleCourses = closedBaselinesComplete && singletons.length
      ? Math.max(...singletons.map((item) => item.closure.ids.length)) : null;
    const maxSingleDirect = directBaselinesComplete && singletons.length
      ? Math.max(...singletons.map((item) => item.direct.ids.length)) : null;
    const maxSingleUnits = closedBaselinesComplete && singletons.length
      ? Math.max(...singletons.map((item) => item.units)) : null;
    const maxSingleTerms = closedBaselinesComplete && singletons.length
      && singletons.every((item) => item.schedule.optimal && Number.isFinite(item.schedule.min_terms))
      ? Math.max(...singletons.map((item) => item.schedule.min_terms)) : null;

    const fatal = !joint.product_complete
      || joint.missing_unit_ids.length
      || catalogEntry.conflicts.size
      || nativeUnits == null
      || ['invalid_cap', 'incomplete_units', 'inconsistent_courses', 'cap_too_low', 'incomplete_prerequisites', 'prerequisite_cycle', 'calendar_unavailable'].includes(scheduled.raw.status);
    let status = 'optimal';
    if (fatal) status = 'unavailable';
    else if (closure.unresolved_groups.length) status = 'estimated';
    else if (!joint.optimizer.optimality_proven || scheduled.raw.status === 'bounded') status = 'bounded';

    const scheduleMeta = compactSchedule(scheduled.raw);
    base.status = status;
    base.plan_status = joint.product_complete
      ? (joint.optimizer.optimality_proven ? 'optimal' : 'bounded')
      : 'unavailable';
    base.prerequisite_status = closure.unresolved_groups.length ? 'estimated' : 'complete';
    base.schedule_status = scheduled.raw.status;
    base.combined = {
      distinct_courses: closure.ids.length,
      course_count: closure.ids.length,
      major_course_count: joint.ids.length,
      prerequisite_course_count: closure.prerequisite_ids.length,
      major_native_units: majorNativeUnits,
      native_units: nativeUnits,
      semester_equiv_units: semesterEquivalent,
      estimated_terms: status === 'optimal' && scheduled.raw.optimal ? scheduled.raw.min_terms : null,
      min_terms: scheduled.raw.optimal ? scheduled.raw.min_terms : null,
      lower_bound_terms: scheduled.raw.lower_bound_terms ?? null,
      upper_bound_terms: scheduled.raw.upper_bound_terms ?? null,
      unit_lower_bound_terms: scheduled.raw.unit_lower_bound_terms ?? null,
      sequence_lower_bound_terms: scheduled.raw.sequence_lower_bound_terms ?? null,
      academic_years: scheduled.raw.optimal
        ? round1(scheduled.raw.min_terms / (unitSystem === 'quarter' ? 3 : 2)) : null,
      optionality_premium_courses: multi && maxSingleCourses != null
        ? closure.ids.length - maxSingleCourses : null,
      optionality_premium_direct_courses: multi && maxSingleDirect != null
        ? joint.ids.length - maxSingleDirect : null,
      optionality_premium_units: multi && maxSingleUnits != null && nativeUnits != null
        ? round1(nativeUnits - maxSingleUnits) : null,
      optionality_premium_terms: multi && maxSingleTerms != null && scheduled.raw.optimal
        ? scheduled.raw.min_terms - maxSingleTerms : null,
      product_complete: joint.product_complete,
      strict_complete: joint.strict_complete,
      prerequisite_complete: closure.unresolved_groups.length === 0,
      prerequisite_evidence: closure.evidence,
      prerequisite_choice_count: closure.prerequisite_choices,
      optimizer: joint.optimizer,
      schedule: scheduleMeta,
    };
    base.campuses = singletons.map(({ target, direct, closure: singleClosure, units, schedule }) => ({
      school_id: target.school_id,
      school: target.school,
      major: target.major,
      product_complete: direct.product_complete,
      strict_complete: direct.strict_complete,
      fully_satisfiable: direct.strict_complete,
      completion_pct: round1(calculateMajorCompletionPercentage(
        majorsBySchool.get(target.school_id), joint.transcript, [], true,
      )),
      direct_course_count: direct.ids.length,
      distinct_courses: singleClosure.ids.length,
      native_units: units,
      estimated_terms: schedule.optimal ? schedule.min_terms : null,
      lower_bound_terms: schedule.lower_bound_terms ?? null,
      upper_bound_terms: schedule.upper_bound_terms ?? null,
      schedule_status: schedule.status,
      optimizer_proven: direct.optimizer.optimality_proven,
    }));
    base._detail = {
      closure,
      directIds: joint.ids,
      catalog,
      majorsBySchool,
      terms: scheduled.terms,
    };
    rows.push(base);
  }

  const publicRows = rows.map(({ _detail, ...row }) => row);
  const analyzable = publicRows.filter((row) => row.status !== 'unavailable'
    && Number.isFinite(row.combined?.distinct_courses));
  const exact = publicRows.filter((row) => row.status === 'optimal');
  const calendarGroups = makeCalendarGroups(publicRows);
  const distinctCourses = metricStats(analyzable, (row) => row.combined.distinct_courses);
  const majorCourses = metricStats(analyzable, (row) => row.combined.major_course_count);
  const prerequisiteCourses = metricStats(
    analyzable, (row) => row.combined.prerequisite_course_count,
  );
  const semesterEquivalentUnits = metricStats(
    analyzable, (row) => row.combined.semester_equiv_units,
  );
  const coursePremium = metricStats(
    analyzable, (row) => row.combined.optionality_premium_courses,
  );
  const strictAssessable = publicRows.filter((row) =>
    typeof row.combined?.strict_complete === 'boolean');
  const statusCounts = Object.fromEntries(['optimal', 'bounded', 'estimated', 'unavailable']
    .map((status) => [status, publicRows.filter((row) => row.status === status).length]));
  const response = {
    params: {
      method: METHOD_ID,
      mode,
      school_ids: schoolIds,
      community_college_id: communityCollegeId,
      semester_load: semesterLoad,
      quarter_load: quarterLoad,
      target: 'required_major_preparation',
    },
    method: {
      id: METHOD_ID,
      direct_course_objective: 'Minimum distinct courses, then minimum native units, jointly across the locally articulable preparation in the selected agreements.',
      term_objective: 'Minimum regular terms for the returned fixed course set under the native unit cap and modeled prerequisites.',
      optimizer_source: 'Plan My Transfer multi-goal selector with exhaustive choose-N group-frontier correction',
      calendar_source: 'PMT reviewed college calendar file, 2026-06-08',
    },
    programs: targets,
    summary: {
      colleges_total: publicRows.length,
      colleges_analyzed: analyzable.length,
      colleges_exact: exact.length,
      colleges_excluded: publicRows.length - analyzable.length,
      mean_distinct_courses: distinctCourses.value,
      mean_distinct_courses_n: distinctCourses.n,
      mean_major_courses: majorCourses.value,
      mean_major_courses_n: majorCourses.n,
      mean_prerequisite_courses: prerequisiteCourses.value,
      mean_prerequisite_courses_n: prerequisiteCourses.n,
      mean_semester_equiv_units: semesterEquivalentUnits.value,
      mean_semester_equiv_units_n: semesterEquivalentUnits.n,
      mean_optionality_premium_courses: coursePremium.value,
      mean_optionality_premium_courses_n: coursePremium.n,
      strict_complete_colleges: strictAssessable
        .filter((row) => row.combined.strict_complete).length,
      strict_complete_colleges_n: strictAssessable.length,
      median_semester_terms: calendarGroups.find((group) => group.unit_system === 'semester')?.median_terms ?? null,
      median_quarter_terms: calendarGroups.find((group) => group.unit_system === 'quarter')?.median_terms ?? null,
      mean_semester_optionality_premium_terms: calendarGroups
        .find((group) => group.unit_system === 'semester')?.mean_optionality_premium_terms ?? null,
      mean_semester_optionality_premium_terms_n: calendarGroups
        .find((group) => group.unit_system === 'semester')?.mean_optionality_premium_terms_n ?? 0,
      mean_quarter_optionality_premium_terms: calendarGroups
        .find((group) => group.unit_system === 'quarter')?.mean_optionality_premium_terms ?? null,
      mean_quarter_optionality_premium_terms_n: calendarGroups
        .find((group) => group.unit_system === 'quarter')?.mean_optionality_premium_terms_n ?? 0,
      status_counts: statusCounts,
    },
    calendar_groups: calendarGroups,
    rows: publicRows,
    warnings: [
      'Major preparation only: this does not include general education, admission, associate-degree completion, or university coursework after transfer.',
      'Term estimates assume selected courses are offered every regular term without conflicts or seat limits.',
    ],
  };

  if (mode === 'college' && rows[0]?._detail) {
    const source = rows[0];
    const detail = source._detail;
    const publicRow = publicRows[0];
    const courses = detailedCourses({
      closure: detail.closure,
      directIds: detail.directIds,
      catalog: detail.catalog,
      targets,
      majorsBySchool: detail.majorsBySchool,
      terms: detail.terms,
    });
    response.row = { ...publicRow, courses, terms: detail.terms };
    response.courses = courses;
    response.terms = detail.terms;
  }
  return response;
}

async function multiCampusPathwaysData(db, auditDb, params = {}) {
  const mode = params.mode === 'college' ? 'college' : 'average';
  const context = await loadMultiCampusPathwayContext(db, auditDb, {
    schoolIds: params.schoolIds,
    visiblePairs: params.visiblePairs,
    communityCollegeId: mode === 'college' ? params.communityCollegeId : null,
  });
  return multiCampusPathwaysDataFromContext(context, params);
}

module.exports = {
  multiCampusPathwaysData,
  loadMultiCampusPathwayContext,
  multiCampusPathwaysDataFromContext,
  _buildCatalogs: buildCatalogs,
  _calendarForCollege: calendarForCollege,
  _chosenPrerequisites: chosenPrerequisites,
  _closePrerequisites: closePrerequisites,
  _normalizeMajor: normalizeMajor,
  _prepAgreement: prepAgreement,
  _solveDirect: solveDirect,
  _clearSingletonBaselineCache: clearSingletonBaselineCache,
  _singletonBaselineCacheStats: singletonBaselineCacheStats,
};
