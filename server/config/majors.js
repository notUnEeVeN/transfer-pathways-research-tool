/**
 * Per-major metadata that is NOT in the database: which ASSIST program counts
 * as the major at each campus, the free-text match string, the course-category
 * vocabulary, the course-code typing rules, and capability flags.
 *
 * This module is the single source of truth. `services/analysis/pathways.js`,
 * `controllers/Curation.js` and `services/courseTypes.js` read from here rather
 * than holding their own copies.
 *
 * Onboarding a major = port its agreements with scripts/port.py, then add one
 * entry here. The API and Settings coverage inventory discover every entry,
 * campus pin, capability, and category from this registry. Program-pin
 * decisions and exclusions are documented in docs/major-pins.md.
 *
 * It is a JS module rather than a Mongo collection because the values are
 * regexes and because adding a major already requires an admin at a terminal
 * (port.py). Moving it to a collection later is a contained change.
 */
const MAJORS = [
  {
    slug: 'cs',
    label: 'Computer Science',
    // Human-friendly fallback used only by legacy callers that explicitly ask
    // for a contains search. Analysis requests with majorSlug=cs use the exact
    // campus/program pairs below.
    match: 'computer science',
    // The single canonical CS program analyzed at each campus. These values
    // are byte-identical to Atlas (including Merced's stored trailing space).
    // Alternative CS, CSE, joint, minor, and specialisation programs are not
    // part of this major and must never enter a majorSlug=cs analysis.
    programs: {
      89: ['Computer Science B.S.'],
      144: ['COMPUTER SCIENCE AND ENGINEERING, B.S. '], // trailing space is stored
      7: ['CSE: Computer Science B.S.'],
      128: ['Computer Science, B.S.'],
      117: ['Computer Science/B.S.'],
      79: ['Electrical Engineering & Computer Sciences, B.S.'],
      132: ['Computer Science B.S.'],
      120: ['Computer Science, B.S.'],
      46: ['Computer Science, B.S.'],
    },
    // Ordered cohorts shown by the two associate-degree analysis figures.
    // The local A.S. remains the historical CS headline; A.S.-T is its
    // statewide comparison.
    degreeAnalysisSlots: ['local_as', 'ast'],
    // Canonical course categories for the gap figures, and the broad axes they
    // roll up into. Consumed by controllers/Curation.js.
    categories: [
      { key: 'calculus', axis: 'math' },
      { key: 'advanced_math', axis: 'math' },
      { key: 'discrete_math', axis: 'math' },
      { key: 'other_math', axis: 'math' },
      { key: 'intro_programming', axis: 'computing' },
      { key: 'data_structures', axis: 'computing' },
      { key: 'computer_org', axis: 'computing' },
      { key: 'other_computing', axis: 'computing' },
      { key: 'science', axis: 'science' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    broadAxes: ['computing', 'math', 'science', 'non_stem'],
    // Course-type figure taxonomy (MA Figure 2 columns, CA Figure 5 panels).
    // Computer Science types through services/courseTypes.js, whose four
    // categories are already the paper's four columns, so the rollup is the
    // identity and there is no extended variant to toggle into.
    courseTypes: {
      module: 'cs',
      axes: {
        faithful: [
          { key: 'computing', label: 'Computing', categories: ['computing'] },
          { key: 'math', label: 'Math', categories: ['math'] },
          { key: 'science', label: 'Science', categories: ['science'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
      },
    },
    // Which prereq-concept disciplines this major's chains draw on.
    conceptDisciplines: ['math', 'cs', 'physics', 'engr', 'stats'],
    // The typing RULES stay in code — they are regexes and prefix sets, and a
    // major's rules are a module (services/courseTypes.js here,
    // services/courseTypesBio.js for Biology) named by `courseTypes.module`
    // above. This config carries only the rollups the figures render.
    //
    // What this major's data supports. Everything defaults false for a new
    // major; cs has the full historical dataset.
    capabilities: {
      assistAgreements: true,
      caCreditLossArtifact: true,
      agreementPathways: true,
      asDegrees: true,
      paperBaselines: true,
      transferMinimums: true,
      degreeTemplates: true,
      courseCategories: true,
      // Rule-based receiver typing for MA Figure 2 / CA Figure 5. Distinct
      // from courseCategories, which needs hand-curated per-course tags.
      courseTypeFigures: true,
      prerequisites: true,
      snapshots: ['district-multi-campus-pathways', 'multi-campus-pathways',
        'district-portfolio-subsets'],
    },
  },
  {
    slug: 'bio',
    label: 'Biology',
    match: 'biolog',
    // One program per campus: each campus's umbrella / general biology degree,
    // B.S. where a campus offers both awards. Berkeley has no umbrella degree,
    // so it takes MCB — the larger department and the closest prerequisite
    // match to the other eight. Pins confirmed 2026-07-22; the excluded
    // specializations and the reasoning are in docs/major-pins.md.
    programs: {
      79: ['Molecular and Cell Biology, B.A.'],
      89: ['Biological Sciences B.S.'],
      120: ['Biological Sciences, B.S.'],
      117: ['Biology/B.S.'],
      144: ['BIOLOGICAL SCIENCES, General Biology Emphasis, B.S.'],
      46: ['Biology, B.A. or B.S.'],
      7: ['Biology: General Biology B.S.'],
      128: ['Biological Sciences, B.A. & B.S.'],
      132: ['Biology B.S.'],
    },
    // Confirmed against the nine ported templates on 2026-07-23; these are the
    // fine categories services/courseTypesBio.js assigns, so the curated
    // tagging vocabulary and the figure taxonomy are one list. `axis` is the
    // faithful (four-column) rollup. See docs/figures/bio-course-types.md.
    categories: [
      { key: 'bio_series', axis: 'biology' },
      { key: 'calculus', axis: 'math' },
      { key: 'statistics', axis: 'math' },
      { key: 'computing', axis: 'math' },
      { key: 'gen_chem', axis: 'chem_physics' },
      { key: 'organic_chem', axis: 'chem_physics' },
      { key: 'physics', axis: 'chem_physics' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    // The cohorts the associate-degree figures compare. Biology is a science
    // award like Computer Science, so it uses the same two: 108 A.S.-T records
    // and 67 local A.S. records were found across 115 colleges. The 21
    // local_other records are too thin a cohort to stand as their own series.
    degreeAnalysisSlots: ['local_as', 'ast'],
    broadAxes: ['biology', 'math', 'chem_physics', 'non_stem'],
    // Column order mirrors the Computer Science figure's: own discipline,
    // quantitative, supporting science, everything else. The extended variant
    // exists because the faithful rollup necessarily hides that chemistry is
    // the largest block of a biology degree — 87 course references against
    // biology's ~45 — and the ported figure must not carry an annotation the
    // source figure does not have.
    courseTypes: {
      module: 'bio',
      axes: {
        faithful: [
          { key: 'biology', label: 'Biology', categories: ['bio_series'] },
          { key: 'math', label: 'Math', categories: ['calculus', 'statistics', 'computing'] },
          { key: 'chem_physics', label: 'Chemistry & Physics', categories: ['gen_chem', 'organic_chem', 'physics'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
        extended: [
          { key: 'biology', label: 'Biology', categories: ['bio_series'] },
          { key: 'chemistry', label: 'Chemistry', categories: ['gen_chem', 'organic_chem'] },
          { key: 'physics', label: 'Physics', categories: ['physics'] },
          { key: 'math', label: 'Math', categories: ['calculus', 'statistics'] },
          { key: 'computing', label: 'Computing', categories: ['computing'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
      },
      // CA Figure 5's 2x3 panel grid, in reading order.
      barrierPanels: [
        { key: 'bio_series', label: 'Intro Biology' },
        { key: 'gen_chem', label: 'General Chemistry' },
        { key: 'organic_chem', label: 'Organic Chemistry' },
        { key: 'calculus', label: 'Calculus' },
        { key: 'statistics', label: 'Statistics' },
        { key: 'physics', label: 'Physics' },
      ],
    },
    conceptDisciplines: ['math', 'chem', 'bio', 'physics', 'stats'],
    capabilities: {
      assistAgreements: true,
      caCreditLossArtifact: true,
      // Per-agreement exact-path artifacts still need blocked-path and solver-
      // proof metadata before the exploratory minimum/choice-cost cards are
      // honest for this larger corpus.
      agreementPathways: false,
      // 166 found AS/AS-T records across 105 colleges, imported 2026-07-23.
      asDegrees: true,
      paperBaselines: false,
      // Deliberately permanent: new majors are ASSIST-driven end to end, so
      // there are no hand-curated website minimums to gather.
      transferMinimums: false,
      degreeTemplates: true,
      // Category names and prerequisite concepts are provisional until their
      // dedicated validation passes are complete.
      courseCategories: false,
      courseTypeFigures: true,
      prerequisites: false,
      snapshots: [],
    },
  },
  {
    slug: 'econ',
    label: 'Economics',
    match: 'econom',
    // `ast` is the major-neutral internal slot for an Associate Degree for
    // Transfer. Nearly every Economics catalog prints an arts award, while one
    // prints A.S.-T and two have conflicting A.A.-T/A.S.-T headings. The
    // aggregate control names both without rewriting the source-specific award.
    degreeSlotLabels: { ast: 'A.A.-T / A.S.-T', local_other: 'Local A.A.' },
    // The flagship Economics degree per campus, excluding business,
    // managerial, joint-math and policy variants — they carry different
    // lower-division requirements. Economics is a letters-and-science degree
    // system-wide, so the flagship is the B.A. everywhere.
    programs: {
      79: ['Economics, B.A.'],
      89: ['Economics A.B.'],
      120: ['Economics, B.A.'],
      117: ['Economics/B.A.'],
      144: ['ECONOMICS, B.A.'],
      46: ['Economics, B.A.'],
      7: ['Economics B.A.'],
      128: ['Economics, B.A.'],
      132: ['Economics B.A.'],
    },
    // Economics has a statewide A.A.-T and local A.A. cohort. No researched
    // college publishes a general local Economics A.S. in the pinned corpus,
    // so an empty A.S. control would be misleading.
    degreeAnalysisSlots: ['ast', 'local_other'],
    // Confirmed against the nine ported templates on 2026-07-23. Principles are
    // NOT split into micro and macro: seven campuses name them, but Berkeley
    // states ECON 1/2 as "Introduction to Economics" and Irvine states
    // ECON 20A/20B as "Basic Economics I/II", so a split would print a "not
    // required" bar at two campuses that plainly require both halves.
    categories: [
      { key: 'econ_principles', axis: 'economics' },
      { key: 'econ_theory', axis: 'economics' },
      { key: 'calculus', axis: 'math' },
      { key: 'statistics', axis: 'math' },
      { key: 'computing', axis: 'math' },
      { key: 'other_social', axis: 'other_social' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    broadAxes: ['economics', 'math', 'other_social', 'non_stem'],
    // Same four-column shape as Computer Science and Biology: own discipline,
    // quantitative, the supporting discipline, everything else. Economics fills
    // the supporting slot with other social sciences rather than lab science.
    courseTypes: {
      module: 'econ',
      axes: {
        faithful: [
          { key: 'economics', label: 'Economics', categories: ['econ_principles', 'econ_theory'] },
          { key: 'math', label: 'Math', categories: ['calculus', 'statistics', 'computing'] },
          { key: 'other_social', label: 'Other Social Science', categories: ['other_social'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
        extended: [
          { key: 'economics', label: 'Economics', categories: ['econ_principles', 'econ_theory'] },
          { key: 'calculus', label: 'Calculus', categories: ['calculus'] },
          { key: 'statistics', label: 'Statistics', categories: ['statistics'] },
          { key: 'computing', label: 'Computing', categories: ['computing'] },
          { key: 'other_social', label: 'Other Social Science', categories: ['other_social'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
      },
      barrierPanels: [
        { key: 'econ_principles', label: 'Economics Principles' },
        { key: 'econ_theory', label: 'Intermediate Theory' },
        { key: 'calculus', label: 'Calculus' },
        { key: 'statistics', label: 'Statistics' },
        { key: 'computing', label: 'Computing' },
        { key: 'other_social', label: 'Other Social Science' },
      ],
    },
    conceptDisciplines: ['math', 'stats', 'other'],
    capabilities: {
      assistAgreements: true,
      caCreditLossArtifact: true,
      agreementPathways: false,
      // The 2025-2026 statewide associate-degree corpus and all nine
      // four-year templates are present. Source-review warnings remain visible
      // in the analysis payload until the extracted rows are hand-verified.
      asDegrees: true,
      paperBaselines: false,
      // Deliberately permanent: new majors are ASSIST-driven end to end, so
      // there are no hand-curated website minimums to gather.
      transferMinimums: false,
      degreeTemplates: true,
      // Category names and prerequisite concepts are provisional until their
      // dedicated validation passes are complete.
      courseCategories: false,
      courseTypeFigures: true,
      prerequisites: false,
      snapshots: [],
    },
  },
];

const bySlug = new Map(MAJORS.map((m) => [m.slug, m]));

function getMajor(slug) {
  return bySlug.get(String(slug ?? '')) || null;
}

function listMajors() {
  return [...MAJORS];
}

function defaultMajor() {
  return MAJORS[0];
}

function programsFor(majorOrPrograms) {
  if (typeof majorOrPrograms === 'string') return getMajor(majorOrPrograms)?.programs || null;
  if (majorOrPrograms?.programs) return majorOrPrograms.programs;
  return majorOrPrograms && typeof majorOrPrograms === 'object' ? majorOrPrograms : null;
}

/** Flatten a configured major into exact, JSON-safe campus/program pairs. */
function programPairs(majorOrPrograms) {
  const programs = programsFor(majorOrPrograms);
  if (!programs) return [];
  return Object.entries(programs).flatMap(([schoolId, names]) =>
    (Array.isArray(names) ? names : []).map((major) => ({
      school_id: Number(schoolId),
      major: String(major),
    }))).filter((pair) => Number.isFinite(pair.school_id));
}

/** Exact Mongo clause for a configured major's campus/program pairs. */
function programPairClause(majorOrPrograms, {
  schoolField = 'uc_school_id', majorField = 'major',
} = {}) {
  const pairs = programPairs(majorOrPrograms);
  // Configured majors always have pairs. Keeping an explicit match-nothing
  // result makes an incomplete future entry fail closed instead of exposing
  // the full corpus.
  if (!pairs.length) return { _id: { $exists: false } };
  const namesBySchool = new Map();
  for (const pair of pairs) {
    if (!namesBySchool.has(pair.school_id)) namesBySchool.set(pair.school_id, []);
    namesBySchool.get(pair.school_id).push(pair.major);
  }
  return {
    $or: [...namesBySchool.entries()].map(([schoolId, majors]) => ({
      [schoolField]: schoolId,
      [majorField]: { $in: majors },
    })),
  };
}

/** The majors payload for GET /api/majors. Every field here is JSON-safe. */
function serializeMajors() {
  return [...MAJORS];
}

/**
 * Resolve ?major=<slug> (preferred) or the legacy ?majorContains=<text> into
 * the scope the analysis layer already speaks. The slug wins when both are
 * given. An unknown slug returns {error, known} for the endpoint to 400 on.
 */
function majorScopeFromQuery(query = {}) {
  const slug = String(query.major ?? '').trim();
  if (slug) {
    const entry = getMajor(slug);
    if (!entry) return { error: `unknown major: ${slug}`, known: MAJORS.map((m) => m.slug) };
    return { slug: entry.slug, majorPrograms: entry.programs, majorContains: '' };
  }
  return {
    slug: null,
    majorPrograms: null,
    majorContains: String(query.majorContains ?? '').trim(),
  };
}

module.exports = {
  getMajor, listMajors, defaultMajor, serializeMajors, majorScopeFromQuery,
  programPairs, programPairClause,
};
