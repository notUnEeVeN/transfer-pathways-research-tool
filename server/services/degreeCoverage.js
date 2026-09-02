/**
 * Evaluate a hand-gathered four-year degree from `curated_requirements` against
 * one community college: how much of the whole degree transfers, and which
 * requirements that college can satisfy.
 *
 * The college's articulations come from its real agreements with this UC; the
 * readable grouped view + the counting live in services/degreeSlots.js.
 */
const {
  buildDegreeGroups,
  buildLedgerGroups,
  loadUniversityCourses,
  loadCollegeGeAreas,
  degreeUnitSystem,
  normalizeRequirementName,
} = require('./degreeSlots');
const { computeTransferBudget } = require('./degreeTransferBudget');
const { defaultMajor, getMajor, programPairClause } = require('../config/majors');

const COLLECTION = 'curated_requirements';

async function evaluateDegreeAtCollege(db, { schoolId, communityCollegeId, majorSlug }) {
  const school_id = Number(schoolId);
  const community_college_id = Number(communityCollegeId);
  const selectedMajor = getMajor(majorSlug || defaultMajor().slug);
  if (!selectedMajor) return null;

  // Prefer explicitly dimensional templates. Unstamped templates are the
  // historical CS set and may only be used by CS; Biology/Economics must fail
  // closed until their own templates exist.
  const configuredPrograms = selectedMajor.programs?.[school_id] || [];
  let degree = await db.collection(COLLECTION).findOne({
    kind: 'degree',
    school_id,
    major_slug: selectedMajor.slug,
    program: { $in: configuredPrograms },
  });
  if (!degree && selectedMajor.slug === defaultMajor().slug) {
    degree = await db.collection(COLLECTION).findOne({
      kind: 'degree', school_id, major_slug: { $exists: false },
    });
  }
  if (!degree) return null;

  // What this CC articulates for this UC: the set of parent_ids, and the CC
  // course options that satisfy each — unioned across the CC's agreements.
  const agreements = await db.collection('assist_agreements')
    .find({
      uc_school_id: school_id,
      community_college_id,
      ...programPairClause(selectedMajor),
    })
    .project({ requirement_groups: 1 })
    .toArray();
  const optionsByParent = new Map();
  const articulated = new Set();
  // ASSIST also publishes requirements as NAMED blocks carrying no course id
  // (UC Irvine's biology "Mathematics Requirement"). A parent_id-keyed scan
  // drops them, so collect their names too — the heatmap's pipeline does, and
  // this per-college evaluation must agree with it about the same college.
  const articulatedRequirements = new Set();
  for (const agr of agreements) {
    for (const g of agr.requirement_groups || []) {
      for (const s of g.sections || []) {
        for (const r of s.receivers || []) {
          if (r.articulation_status !== 'articulated') continue;
          if (r.receiving?.kind === 'requirement' && typeof r.receiving.name === 'string') {
            const name = normalizeRequirementName(r.receiving.name);
            if (name) articulatedRequirements.add(name);
          }
          const pids = r.receiving?.kind === 'series' ? (r.receiving.parent_ids || []) : [r.receiving?.parent_id];
          for (const pid of pids) {
            if (pid == null) continue;
            articulated.add(Number(pid));
            if (!optionsByParent.has(Number(pid)) && (r.options || []).length) optionsByParent.set(Number(pid), r.options);
          }
        }
      }
    }
  }

  // CC course codes for the ones that satisfy a degree requirement.
  const usedCourseIds = new Set();
  for (const opts of optionsByParent.values()) for (const o of opts) for (const cid of o.course_ids || []) usedCourseIds.add(Number(cid));
  const coursesById = new Map();
  if (usedCourseIds.size) {
    const rows = await db.collection('assist_courses')
      .find({ side: 'sending', course_id: { $in: [...usedCourseIds] } }, { projection: { course_id: 1, prefix: 1, number: 1, title: 1, units: 1, _id: 0 } })
      .toArray();
    for (const c of rows) coursesById.set(Number(c.course_id), c);
  }
  const universityCoursesById = await loadUniversityCourses(db, degree.requirement_groups);
  // The college's own course GE-area tags satisfy the R&C / H/SS breadth slots
  // that ASSIST's major-prep agreements never carry.
  const ccGeAreas = await loadCollegeGeAreas(db, community_college_id);
  const university = await db.collection('assist_institutions').findOne(
    { kind: 'university', source_id: school_id },
    { projection: { academic_calendar: 1, _id: 0 } }
  );

  const { total, covered, by_tier, units } = buildDegreeGroups(degree.requirement_groups, {
    articulated, articulatedRequirements, optionsByParent, universityCoursesById, coursesById,
    ccGeAreas, sourceDocument: degree,
  });
  // Merged agreement-shaped groups so the frontend renders this tab through the
  // shared RequirementsLedger, matching the Rendered tab.
  const ledger = buildLedgerGroups(degree.requirement_groups, { articulated, optionsByParent, coursesById, ccGeAreas });
  const unitSystem = degreeUnitSystem(degree, university?.academic_calendar);

  // What the college satisfies is not what the student carries. The transfer
  // cap limits unit credit, and requirements that can only be met on campus
  // limit it further, so the honest figure runs the satisfied units through the
  // budget rather than reporting them raw.
  //
  // Two things were wrong with dividing covered by modeled units:
  //
  //   - The denominator moved per college. An Or group collapses to whichever
  //     path that college covers best, so UC Davis Biology was measured against
  //     180 units at American River and 190 at Barstow. Rows of one heatmap
  //     were not comparable to each other.
  //   - The numerator could exceed what transfers. Allan Hancock read 109
  //     covered units against a 105-unit cap.
  //
  // The degree's own stated minimum is fixed for every college, which is what a
  // column of percentages needs to mean the same thing all the way down.
  const budget = computeTransferBudget(degree, { satisfiedUnits: units.covered });
  const unitTotal = Number(degree.total_units) || units.total;
  const unitCovered = Math.min(budget.transferred, unitTotal);
  const unitPct = unitTotal ? Math.round((100 * unitCovered) / unitTotal) : null;

  return {
    school_id,
    school: degree.school,
    major_slug: selectedMajor.slug,
    program: degree.program,
    total_units: degree.total_units ?? null,
    unit_system: unitSystem,
    modeled_total_units: units.total,
    community_college_id,
    n_agreements: agreements.length,
    completion: {
      total, covered, pct: total ? Math.round((100 * covered) / total) : null, by_tier,
      // Unit-weighted coverage is primary. The denominator is the sum of the
      // hand-authored requirement groups, which can legitimately exceed the
      // university-wide minimum for a particular program.
      units: {
        total: unitTotal,
        covered: unitCovered,
        pct: unitPct,
        unit_system: unitSystem,
        stated_minimum: degree.total_units ?? null,
        // Requirements this college can discharge, before the cap is applied.
        // A student may satisfy every general education requirement and still
        // carry fewer units than that work was worth, and the gap between these
        // two numbers is the thing a four-year-versus-college comparison wants.
        satisfied: budget.satisfied,
        transfer_cap: budget.cap,
        binding: budget.binding,
        university_units: budget.university.total,
        university_required: budget.university.required,
        // The old measure, kept so a change in the headline can be traced.
        modeled_total: units.total,
        modeled_covered: units.covered,
      },
    },
    requirement_groups: ledger.requirement_groups,
    courses: ledger.courses,
    university_courses_by_id: universityCoursesById,
  };
}

module.exports = { evaluateDegreeAtCollege };
