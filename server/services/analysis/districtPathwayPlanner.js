/**
 * District-pooled preparation plans for the nine pinned UC CS programs.
 *
 * Each campus uses one committed ASSIST requirement tree. A district may use
 * complete articulation paths from any of its member colleges, but a path is
 * never split across colleges and an unarticulated requirement is never
 * dropped. The joint optimizer then builds one actual course set for every
 * campus that the district can satisfy strictly.
 */

const programPins = require('../../data/analysis/district-pathway-programs.v1.json');
const {
  DEFAULT_CLOSED_SEARCH_MAX_STATES,
  movesForReceiver,
  selectMissingAcrossMajorsOptimal,
} = require('./minCourses');
const {
  allArticulatingCourses,
  calculateMajorCompletionPercentage,
  isMajorArticulable,
} = require('./eligibility');
const {
  loadMultiCampusPathwayContext,
  _chosenPrerequisites: chosenPrerequisites,
  _scheduleClosedPlan: scheduleClosedPlan,
  _solvePrerequisiteClosed: solvePrerequisiteClosed,
  _totalUnits: totalUnits,
} = require('./pathwayPlanner');

const METHOD_ID = 'district_pooled_pinned_assist_v4_configurable_state_limit';
const DEFAULT_NATIVE_LOAD = 15;
const DEFAULT_OPTIMIZER_MAX_STATES = DEFAULT_CLOSED_SEARCH_MAX_STATES;
const round1 = (value) => (Number.isFinite(Number(value)) ? +Number(value).toFixed(1) : null);
const uniq = (values) => [...new Set(values)];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function receiverKey(receiver) {
  return String(receiver?.hash_id || '');
}

function groupDistricts(context) {
  const groups = new Map();
  for (const college of context.colleges || []) {
    const district = String(college.district || '').trim();
    if (!district) throw new Error(`College ${college.source_id} has no district.`);
    if (!groups.has(district)) {
      groups.set(district, {
        district,
        region: college.region || null,
        counties_served: new Set(),
        colleges: [],
      });
    }
    const group = groups.get(district);
    group.colleges.push(college);
    for (const county of college.counties_served || []) group.counties_served.add(String(county));
  }
  return [...groups.values()].map((group) => ({
    ...group,
    counties_served: [...group.counties_served].sort(),
    colleges: group.colleges.slice().sort((left, right) =>
      String(left.name).localeCompare(String(right.name))),
  })).sort((left, right) => left.district.localeCompare(right.district));
}

function agreementsForTarget(context, schoolId) {
  const suffix = `|${Number(schoolId)}`;
  return [...context.agreementsByCell.entries()]
    .filter(([key]) => key.endsWith(suffix))
    .flatMap(([, agreements]) => agreements || []);
}

function resolvePinnedPrograms(context, pins = programPins.programs) {
  return pins.map((pin) => {
    const target = context.targets.find((item) => Number(item.school_id) === Number(pin.school_id));
    if (!target || String(target.major) !== String(pin.major)) {
      throw new Error(`Configured program does not match the pin for school ${pin.school_id}.`);
    }
    const agreements = agreementsForTarget(context, pin.school_id);
    const representative = agreements.find((agreement) =>
      String(agreement._id) === String(pin.representative_agreement_id));
    if (!representative
      || representative.raw_template_hash !== pin.raw_template_hash
      || representative.template_fp !== pin.template_fp
      || Number(representative.community_college_id)
        !== Number(pin.representative_community_college_id)) {
      throw new Error(`Pinned ASSIST template no longer matches school ${pin.school_id}.`);
    }
    return {
      ...pin,
      target,
      template: representative,
    };
  });
}

function districtCatalog(context, colleges) {
  const catalog = new Map();
  const collegeById = new Map(colleges.map((college) => [Number(college.source_id), college]));
  for (const college of colleges) {
    const collegeId = Number(college.source_id);
    const entry = context.catalogs.get(collegeId);
    for (const [courseId, rawCourse] of entry?.courses || []) {
      if (catalog.has(String(courseId))) {
        throw new Error(`Course ${courseId} appears at more than one college in ${college.district}.`);
      }
      catalog.set(String(courseId), {
        ...rawCourse,
        course_id: String(courseId),
        community_college_id: collegeId,
        community_college: college.name,
        institution_id: `cc:${collegeId}`,
      });
    }
  }
  return { catalog, collegeById };
}

function completePaths(receiver, catalog, telemetry) {
  if (receiver?.articulation_status !== 'articulated') return [];
  return movesForReceiver(
    receiver,
    catalog,
    () => { telemetry.cartesian_fallbacks += 1; },
    true,
  );
}

function poolReceiver(canonical, sourceReceivers, catalog, telemetry) {
  const paths = new Map();
  for (const source of sourceReceivers) {
    for (const rawPath of completePaths(source, catalog, telemetry)) {
      const path = uniq(rawPath.map(String)).sort();
      if (path.length) paths.set(path.join(','), path);
    }
  }
  const options = [...paths.values()]
    .sort((left, right) => left.length - right.length || left.join(',').localeCompare(right.join(',')))
    .map((courseIds) => ({ course_ids: courseIds, course_conjunction: 'and' }));
  return {
    ...clone(canonical),
    articulation_status: options.length ? 'articulated' : 'not_articulated',
    not_articulated_reason: options.length ? null : 'No complete articulation path in district',
    options,
    options_conjunction: 'or',
  };
}

function pooledMajorForDistrict({ context, pinnedProgram, collegeIds, catalog }) {
  const idSet = new Set(collegeIds.map(Number));
  const agreements = agreementsForTarget(context, pinnedProgram.school_id)
    .filter((agreement) => idSet.has(Number(agreement.community_college_id)));
  const byHash = new Map();
  for (const agreement of agreements) {
    for (const group of agreement.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          const key = receiverKey(receiver);
          if (!key) continue;
          if (!byHash.has(key)) byHash.set(key, []);
          byHash.get(key).push(receiver);
        }
      }
    }
  }
  const telemetry = { cartesian_fallbacks: 0 };
  const requirementGroups = (pinnedProgram.template.requirement_groups || []).map((group) => ({
    ...clone(group),
    sections: (group.sections || []).map((section) => ({
      ...clone(section),
      receivers: (section.receivers || []).map((receiver) => poolReceiver(
        receiver,
        byHash.get(receiverKey(receiver)) || [],
        catalog,
        telemetry,
      )),
    })),
  }));
  return {
    school_id: Number(pinnedProgram.school_id),
    school: pinnedProgram.school,
    uc_code: pinnedProgram.uc_code,
    major: pinnedProgram.major,
    template_fp: pinnedProgram.template_fp,
    raw_template_hash: pinnedProgram.raw_template_hash,
    requirement_groups: requirementGroups,
    pooling_telemetry: telemetry,
  };
}

function receiverMetadata(receiver, receivingCoursesById) {
  const receiving = receiver.receiving || {};
  const parentIds = receiving.kind === 'series'
    ? (receiving.parent_ids || []).map(Number).filter(Number.isFinite)
    : [Number(receiving.parent_id)].filter(Number.isFinite);
  const courses = parentIds.map((id) => receivingCoursesById.get(id)).filter(Boolean);
  return {
    receiver_hash: receiverKey(receiver),
    receiving_kind: receiving.kind || 'receiver',
    receiving_parent_ids: parentIds,
    receiving_courses: courses.map((course) => ({
      parent_id: Number(course.parent_id ?? course.source_id),
      code: [course.prefix, course.number].filter(Boolean).join(' ') || `UC course ${course.parent_id}`,
      title: course.title || null,
    })),
  };
}

function blockerWitness(major, catalog, receivingCoursesById, timeBudgetMs = 1500) {
  const augmentedCatalog = new Map(catalog);
  const blockerById = new Map();
  const syntheticMajor = {
    requirement_groups: (major.requirement_groups || []).map((group, groupIndex) => ({
      ...clone(group),
      sections: (group.sections || []).map((section, sectionIndex) => ({
        ...clone(section),
        receivers: (section.receivers || []).map((receiver, receiverIndex) => {
          if (receiver.articulation_status === 'articulated' && receiver.options?.length) {
            return clone(receiver);
          }
          const hash = receiverKey(receiver) || `${groupIndex}-${sectionIndex}-${receiverIndex}`;
          const id = `missing:${major.school_id}:${hash}`;
          if (!augmentedCatalog.has(id)) {
            augmentedCatalog.set(id, {
              course_id: id,
              units: Number(receiver.receiving?.units) || 1,
              same_as: [],
              code: 'Missing district articulation',
            });
            blockerById.set(id, {
              ...receiverMetadata(receiver, receivingCoursesById),
              group_index: groupIndex,
              section_index: sectionIndex,
            });
          }
          return {
            ...clone(receiver),
            articulation_status: 'articulated',
            options: [{ course_ids: [id], course_conjunction: 'and' }],
            options_conjunction: 'or',
          };
        }),
      })),
    })),
  };
  // Every real district path is placed in the starting transcript. The exact
  // search therefore branches only over unavailable-requirement placeholders
  // and minimizes missing demand rather than re-optimizing the real course
  // plan merely to identify a blocker witness.
  const telemetry = {};
  const ids = selectMissingAcrossMajorsOptimal([syntheticMajor], {
    userCourses: allArticulatingCourses(major),
    coursesById: augmentedCatalog,
    includeRecommended: false,
    crossCc: [],
    timeBudgetMs,
    telemetry,
    suppressWarnings: true,
  }).map(String).filter((id) => blockerById.has(id));
  return {
    blockers: ids.map((id) => blockerById.get(id)),
    blocker_count: ids.length,
    optimality_proven: Boolean(telemetry.optimalityProven),
  };
}

function selectedCourseTargets(courseId, majors, catalog) {
  const targets = [];
  for (const major of majors) {
    let found = false;
    for (const group of major.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          if ((receiver.options || []).some((option) =>
            (option.course_ids || []).some((candidateId) =>
              equivalentCourseIds(courseId, candidateId, catalog)))) found = true;
        }
      }
    }
    if (found) targets.push(Number(major.school_id));
  }
  return targets;
}

function equivalentCourseIds(leftId, rightId, catalog) {
  const left = String(leftId);
  const right = String(rightId);
  if (left === right) return true;
  return (catalog.get(left)?.same_as || [])
    .some((peer) => String(peer.course_id) === right);
}

function detailedDistrictCourses({ closure, directIds, catalog, majors, terms }) {
  const direct = new Set(directIds.map(String));
  const termById = new Map((terms || []).flatMap((term) =>
    (term.course_ids || []).map((id) => [String(id), term.index])));
  const chosenByCourse = new Map(closure.ids.map((id) => [
    String(id),
    chosenPrerequisites(id, closure.requirements_by_course, termById),
  ]));
  const targetByCourse = new Map(closure.ids.map((id) => [
    String(id),
    new Set(direct.has(String(id)) ? selectedCourseTargets(id, majors, catalog) : []),
  ]));
  for (let pass = 0; pass <= closure.ids.length; pass += 1) {
    let changed = false;
    for (const dependent of closure.ids) {
      for (const prerequisite of chosenByCourse.get(String(dependent)) || []) {
        for (const schoolId of targetByCourse.get(String(dependent)) || []) {
          const target = targetByCourse.get(String(prerequisite));
          if (target && !target.has(schoolId)) { target.add(schoolId); changed = true; }
        }
      }
    }
    if (!changed) break;
  }
  return closure.ids.map((id) => {
    const course = catalog.get(String(id));
    return {
      course_id: String(id),
      community_college_id: Number(course.community_college_id),
      community_college: course.community_college,
      code: course.code,
      title: course.title,
      native_units: course.units,
      role: direct.has(String(id)) ? 'major_preparation' : 'prerequisite_only',
      school_ids: [...(targetByCourse.get(String(id)) || [])].sort((a, b) => a - b),
      prerequisite_ids: chosenByCourse.get(String(id)) || [],
      modeled_term: termById.get(String(id)) ?? null,
      prerequisite_evidence: course.concept_source === undefined
        ? 'not_reviewed'
        : (course.concept ? 'concept_match' : 'reviewed_no_match'),
    };
  }).sort((left, right) => (left.modeled_term ?? Infinity) - (right.modeled_term ?? Infinity)
    || left.community_college.localeCompare(right.community_college)
    || left.code.localeCompare(right.code));
}

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * p;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
}

function stats(values) {
  const usable = values.filter(Number.isFinite);
  if (!usable.length) return { n: 0, mean: null, median: null, q1: null, q3: null, min: null, max: null };
  return {
    n: usable.length,
    mean: round1(usable.reduce((sum, value) => sum + value, 0) / usable.length),
    median: round1(percentile(usable, 0.5)),
    q1: round1(percentile(usable, 0.25)),
    q3: round1(percentile(usable, 0.75)),
    min: round1(Math.min(...usable)),
    max: round1(Math.max(...usable)),
  };
}

function summarizeGroups(rows) {
  const metric = (value) => (value == null ? NaN : Number(value));
  return Array.from({ length: 10 }, (_, supportedCount) => {
    const districts = rows.filter((row) => row.supported_count === supportedCount);
    return {
      supported_count: supportedCount,
      district_count: districts.length,
      course_stats: stats(districts.map((row) => metric(row.plan?.distinct_courses))),
      academic_year_stats: stats(districts.map((row) => metric(row.plan?.academic_years))),
      lower_bound_year_stats: stats(districts.map((row) => metric(row.plan?.lower_bound_years))),
      exact_schedule_count: districts.filter((row) => row.plan?.schedule_status === 'optimal').length,
      bounded_schedule_count: districts.filter((row) => row.plan?.schedule_status === 'bounded').length,
      estimated_plan_count: districts.filter((row) => row.plan?.prerequisite_status === 'estimated').length,
    };
  });
}

function buildPlan({ context, district, supportedMajors, catalog, unitSystem, params = {} }) {
  if (!supportedMajors.length) return null;
  const optimizerBudget = Number(params.optimizerBudgetMs) || 5000;
  const parsedMaxStates = Number(params.optimizerMaxStates);
  const optimizerMaxStates = Number.isFinite(parsedMaxStates) && parsedMaxStates >= 1
    ? Math.floor(parsedMaxStates)
    : DEFAULT_OPTIMIZER_MAX_STATES;
  const scheduleBudget = Number(params.scheduleBudgetMs) || 5000;
  const solved = solvePrerequisiteClosed(
    supportedMajors,
    catalog,
    context.projectedGroups,
    optimizerBudget,
    optimizerMaxStates,
  );
  const closure = solved.closure;
  const directIds = solved.direct_ids;
  const scheduled = scheduleClosedPlan(
    closure,
    catalog,
    unitSystem,
    Number(params.nativeLoad) || DEFAULT_NATIVE_LOAD,
    scheduleBudget,
  );
  const nativeUnits = totalUnits(closure.ids, catalog);
  const directUnits = totalUnits(directIds, catalog);
  const semesterEquivalent = nativeUnits == null ? null
    : round1(unitSystem === 'quarter' ? nativeUnits * 2 / 3 : nativeUnits);
  const minTerms = scheduled.raw.optimal ? scheduled.raw.min_terms : null;
  const lowerTerms = scheduled.raw.lower_bound_terms ?? null;
  const upperTerms = scheduled.raw.upper_bound_terms ?? null;
  const termsPerYear = unitSystem === 'quarter' ? 3 : 2;
  const selectedCollegeIds = uniq(closure.ids.map((id) =>
    Number(catalog.get(String(id))?.community_college_id)).filter(Number.isFinite));
  const prerequisitesComplete = closure.unresolved_groups.length === 0
    && closure.evidence.examined_courses === closure.evidence.total_courses;
  const courseStatus = solved.optimizer.feasible !== false
    && solved.product_complete && solved.strict_complete
    ? (solved.optimizer.optimality_proven ? 'optimal' : 'bounded')
    : 'unavailable';
  const prerequisiteStatus = prerequisitesComplete ? 'complete' : 'estimated';
  const fatalScheduleStatuses = new Set([
    'invalid_cap',
    'incomplete_units',
    'inconsistent_courses',
    'cap_too_low',
    'incomplete_prerequisites',
    'prerequisite_cycle',
    'calendar_unavailable',
  ]);
  let status = 'optimal';
  if (courseStatus === 'unavailable'
    || nativeUnits == null
    || fatalScheduleStatuses.has(scheduled.raw.status)) status = 'unavailable';
  else if (prerequisiteStatus === 'estimated') status = 'estimated';
  else if (courseStatus === 'bounded' || scheduled.raw.status === 'bounded') status = 'bounded';
  const courses = detailedDistrictCourses({
    closure,
    directIds,
    catalog,
    majors: supportedMajors,
    terms: scheduled.terms,
  });
  return {
    status,
    course_status: courseStatus,
    prerequisite_status: prerequisiteStatus,
    schedule_status: scheduled.raw.status,
    distinct_courses: closure.ids.length,
    major_course_count: directIds.length,
    prerequisite_course_count: closure.prerequisite_ids.length,
    colleges_used: selectedCollegeIds.length,
    selected_college_ids: selectedCollegeIds.sort((a, b) => a - b),
    major_native_units: directUnits,
    native_units: nativeUnits,
    semester_equiv_units: semesterEquivalent,
    min_terms: minTerms,
    lower_bound_terms: lowerTerms,
    upper_bound_terms: upperTerms,
    academic_years: minTerms == null ? null : round1(minTerms / termsPerYear),
    lower_bound_years: lowerTerms == null ? null : round1(lowerTerms / termsPerYear),
    upper_bound_years: upperTerms == null ? null : round1(upperTerms / termsPerYear),
    optimizer: solved.optimizer,
    role_attribution_status: solved.attribution_optimizer.optimality_proven
      ? 'optimal'
      : 'bounded',
    role_attribution_optimizer: solved.attribution_optimizer,
    prerequisite_evidence: closure.evidence,
    unresolved_prerequisite_groups: closure.unresolved_groups,
    courses,
    terms: scheduled.terms,
    assumptions: {
      native_unit_cap: Number(params.nativeLoad) || DEFAULT_NATIVE_LOAD,
      optimizer_max_states: optimizerMaxStates,
      courses_offered_every_regular_term: true,
      schedule_for_fixed_model_minimum_course_plan: true,
    },
  };
}

function prepareDistricts(context, params = {}) {
  const pins = params.programPins || programPins.programs;
  const pinnedPrograms = resolvePinnedPrograms(context, pins);
  const districts = groupDistricts(context).map((district) => {
    const collegeIds = district.colleges.map((college) => Number(college.source_id));
    const { catalog } = districtCatalog(context, district.colleges);
    const calendars = uniq(collegeIds.map((id) => context.calendarForCollege(id)));
    const unitSystem = calendars.length === 1 ? calendars[0] : 'unknown';
    if (!['semester', 'quarter'].includes(unitSystem)) {
      throw new Error(`${district.district} does not have one known calendar.`);
    }
    const majors = pinnedPrograms.map((pin) => pooledMajorForDistrict({
      context,
      pinnedProgram: pin,
      collegeIds,
      catalog,
    }));
    const supportedMajors = majors.filter((major) => isMajorArticulable(major, true));
    return {
      district: district.district,
      region: district.region,
      counties_served: district.counties_served,
      colleges: district.colleges,
      member_colleges: district.colleges.map((college) => ({
        id: Number(college.source_id),
        name: college.name,
      })),
      unitSystem,
      unit_system: unitSystem,
      catalog,
      majors,
      supportedMajors,
      supported_count: supportedMajors.length,
      supported_school_ids: supportedMajors.map((major) => major.school_id),
      supported_codes: supportedMajors.map((major) => major.uc_code),
    };
  });
  return { pinnedPrograms, districts };
}

function districtPathwaysDataFromContext(context, params = {}) {
  const { pinnedPrograms, districts } = prepareDistricts(context, params);
  const receivingCoursesById = new Map((context.receivingCourseRows || []).map((course) => [
    Number(course.parent_id ?? course.source_id), course,
  ]));
  const rows = [];
  for (const [districtIndex, prepared] of districts.entries()) {
    const campusStatus = prepared.majors.map((major) => {
      const supported = prepared.supportedMajors.includes(major);
      const transcript = allArticulatingCourses(major);
      const witness = supported
        ? { blockers: [], blocker_count: 0, optimality_proven: true }
        : blockerWitness(
          major,
          prepared.catalog,
          receivingCoursesById,
          Number(params.blockerBudgetMs) || 1500,
        );
      return {
        school_id: major.school_id,
        school: major.school,
        uc_code: major.uc_code,
        supported,
        completion_pct: round1(calculateMajorCompletionPercentage(major, transcript, [], true)),
        blockers: witness.blockers,
        blocker_count: witness.blocker_count,
        blocker_optimality_proven: witness.optimality_proven,
        pooling_cartesian_fallbacks: major.pooling_telemetry.cartesian_fallbacks,
      };
    });
    const plan = buildPlan({
      context,
      district: prepared,
      supportedMajors: prepared.supportedMajors,
      catalog: prepared.catalog,
      unitSystem: prepared.unitSystem,
      params,
    });
    rows.push({
      district: prepared.district,
      region: prepared.region,
      counties_served: prepared.counties_served,
      unit_system: prepared.unitSystem,
      member_colleges: prepared.member_colleges,
      supported_count: prepared.supported_count,
      supported_school_ids: prepared.supported_school_ids,
      supported_codes: prepared.supported_codes,
      campus_status: campusStatus,
      plan,
    });
    params.onProgress?.({
      completed: districtIndex + 1,
      total: districts.length,
      district: prepared.district,
      supported_count: prepared.supported_count,
    });
  }
  const groups = summarizeGroups(rows);
  const totalReachable = rows.reduce((sum, row) => sum + row.supported_count, 0);
  return {
    schema_version: 1,
    method_id: METHOD_ID,
    generated_at: params.generatedAt || new Date().toISOString(),
    method: {
      id: METHOD_ID,
      target: 'required major preparation in one pinned ASSIST template per UC program',
      template_selection: programPins.selection_method,
      district_pooling: 'A complete articulation path may come from any member college; path components are never split across colleges.',
      course_objective: 'Minimum distinct actual courses, then minimum native units, jointly across selected pinned programs and every activated known modeled prerequisite.',
      optimizer_max_states: (() => {
        const value = Number(params.optimizerMaxStates);
        return Number.isFinite(value) && value >= 1
          ? Math.floor(value)
          : DEFAULT_OPTIMIZER_MAX_STATES;
      })(),
      prerequisite_model: 'Known concept-matched prerequisites remain local to the college offering the selected course and participate in the joint course objective.',
      term_objective: 'Minimum regular terms for the fixed model-minimum course plan under a 15-native-unit cap.',
      calendar_comparison: 'Academic years use two terms for semester districts and three terms for quarter districts.',
    },
    programs: pinnedPrograms.map(({ target, template, ...pin }) => pin),
    summary: {
      districts_total: rows.length,
      colleges_total: rows.reduce((sum, row) => sum + row.member_colleges.length, 0),
      district_campus_cells: rows.length * pinnedPrograms.length,
      reachable_cells: totalReachable,
      mean_supported_count: round1(totalReachable / rows.length),
      max_supported_count: Math.max(...rows.map((row) => row.supported_count)),
      exact_course_plans: rows.filter((row) => row.plan?.course_status === 'optimal').length,
      exact_schedules: rows.filter((row) => row.plan?.schedule_status === 'optimal').length,
    },
    groups,
    districts: rows,
    warnings: [
      'Major preparation only; general education, admission, associate-degree, seat, conflict, and post-transfer requirements are outside this model.',
      'A district plan assumes students can cross-enroll at any member college.',
      'Term estimates assume every selected course is offered every regular term without timetable conflicts.',
      'Prerequisites use a reviewed statewide normative concept model, not a transcription of every local catalog; modeled edges may be stricter than a college rule or corequisite.',
      'Terms are minimized for the returned model-minimum course set, not jointly across every equal-course alternative.',
    ],
  };
}

async function loadDistrictPathwayContext(db, auditDb, params = {}) {
  const schoolIds = programPins.programs.map((program) => Number(program.school_id));
  const [context, receivingCourseRows] = await Promise.all([
    loadMultiCampusPathwayContext(db, auditDb, {
      schoolIds,
      visiblePairs: programPins.programs.map((program) => ({
        school_id: program.school_id,
        major: program.major,
      })),
      includeSourceFingerprint: true,
    }),
    db.collection('assist_courses').find({
      side: 'receiving',
      university_id: { $in: schoolIds },
    }, { projection: {
      parent_id: 1, source_id: 1, university_id: 1, prefix: 1, number: 1, title: 1,
    } }).toArray(),
  ]);
  return { ...context, receivingCourseRows };
}

async function districtPathwaysData(db, auditDb, params = {}) {
  const context = await loadDistrictPathwayContext(db, auditDb, params);
  return districtPathwaysDataFromContext(context, params);
}

module.exports = {
  METHOD_ID,
  districtPathwaysData,
  districtPathwaysDataFromContext,
  loadDistrictPathwayContext,
  _blockerWitness: blockerWitness,
  _districtCatalog: districtCatalog,
  _groupDistricts: groupDistricts,
  _poolReceiver: poolReceiver,
  _pooledMajorForDistrict: pooledMajorForDistrict,
  _prepareDistricts: prepareDistricts,
  _resolvePinnedPrograms: resolvePinnedPrograms,
  _buildPlan: buildPlan,
  _summarizeGroups: summarizeGroups,
};
