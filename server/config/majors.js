/**
 * Per-major metadata that is NOT in the database: which ASSIST program counts
 * as the major at each campus, the free-text match string, the course-category
 * vocabulary, the course-code typing rules, and capability flags.
 *
 * This module is the single source of truth. `services/analysis/pathways.js`,
 * `controllers/Curation.js` and `services/courseTypes.js` read from here rather
 * than holding their own copies.
 *
 * Onboarding a major (roadmap W1) = port its agreements with scripts/port.py,
 * then add an entry here. Program pins for Biology and Economics are recorded
 * in docs/major-pins.md, already ported and awaiting their entries.
 *
 * It is a JS module rather than a Mongo collection because the values are
 * regexes and because adding a major already requires an admin at a terminal
 * (port.py). Moving it to a collection later is a contained change.
 */
const MAJORS = [
  {
    slug: 'cs',
    label: 'Computer Science',
    // Case-insensitive substring used by the majorContains filters. Safe as a
    // contains match because the research cluster only ever holds ported
    // (pinned) programs — see docs/major-pins.md.
    match: 'computer science',
    // The exact ASSIST program names the paper scraped, per UC school id.
    // Byte-identical values are load-bearing: the paper-port figures pin to
    // these stored names, so an edit here changes replicated figures.
    // Keep in sync with analysis/paper_credit_loss.PAPER_MAJORS.
    programs: {
      89: ['Computer Science & Engineering B.S.', 'Computer Science B.S.'],
      144: ['APPLIED MATHEMATICAL SCIENCES, Computer Science Emphasis, B.S.',
        'COMPUTER SCIENCE AND ENGINEERING, B.S. '], // trailing space is stored
      7: ['CSE: Computer Science B.S.',
        'CSE: Computer Science with a Specialization in Bioinformatics B.S.',
        'Mathematics/Computer Science B.S.'],
      128: ['Computer Science, B.S.'],
      117: ['Computer Science and Engineering/B.S.', 'Computer Science/B.S.',
        'Linguistics and Computer Science/B.A.'],
      // UCB needs BOTH: ASSIST moved its paper-era CS math articulations onto
      // the EECS page — single-program pinning breaks paper replication.
      79: ['Computer Science, B.A.', 'Electrical Engineering & Computer Sciences, B.S.'],
      132: ['Computer Science B.A.', 'Computer Science B.S.', 'Computer Science Minor',
        'Computer Science: Computer Game Design B.S.'],
      120: ['Computer Science and Engineering, B.S.', 'Computer Science, B.S.'],
      46: ['Computer Science with Business Applications B.S.', 'Computer Science, B.S.'],
    },
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
    // Which prereq-concept disciplines this major's chains draw on.
    conceptDisciplines: ['math', 'cs', 'physics', 'engr', 'stats'],
    // Course-code typing rules are NOT here: the only analysis that types
    // courses (MA Figure 2) is a paper-baseline figure, and those stay
    // CS-only. Its rules live in services/courseTypes.js. Give this config a
    // coursePatterns field when a second major actually needs course typing.
    //
    // What this major's data supports. Everything defaults false for a new
    // major; cs has the full historical dataset.
    capabilities: {
      asDegrees: true,
      paperBaselines: true,
      transferMinimums: true,
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
    // Provisional until the Phase 3 mapping pass confirms them against the
    // ported receivers (docs/superpowers/plans/2026-07-22-bio-econ-onboarding.md).
    categories: [
      { key: 'calculus', axis: 'math' },
      { key: 'statistics', axis: 'math' },
      { key: 'gen_chem', axis: 'science' },
      { key: 'organic_chem', axis: 'science' },
      { key: 'bio_series', axis: 'science' },
      { key: 'physics', axis: 'science' },
      { key: 'other_science', axis: 'science' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    broadAxes: ['science', 'math', 'non_stem'],
    conceptDisciplines: ['math', 'chem', 'bio', 'physics', 'stats'],
    capabilities: {
      asDegrees: false,
      paperBaselines: false,
      transferMinimums: false,
      snapshots: [],
    },
  },
  {
    slug: 'econ',
    label: 'Economics',
    match: 'econom',
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
    // Provisional — see the bio note above.
    categories: [
      { key: 'micro_principles', axis: 'economics' },
      { key: 'macro_principles', axis: 'economics' },
      { key: 'calculus', axis: 'math' },
      { key: 'statistics', axis: 'math' },
      { key: 'other_math', axis: 'math' },
      { key: 'other_social', axis: 'non_stem' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    broadAxes: ['economics', 'math', 'non_stem'],
    conceptDisciplines: ['math', 'stats', 'other'],
    capabilities: {
      asDegrees: false,
      paperBaselines: false,
      transferMinimums: false,
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
    return { slug: entry.slug, majorContains: entry.match };
  }
  return { slug: null, majorContains: String(query.majorContains ?? '').trim() };
}

module.exports = {
  getMajor, listMajors, defaultMajor, serializeMajors, majorScopeFromQuery,
};
