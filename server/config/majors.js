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
const {
  COMPUTING_PREFIXES, MATH_PREFIXES, SCIENCE_PREFIXES, DISCRETE_MATH, TEXT_RULES,
} = require('../services/courseTypes');

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
    // Course-typing rules for the MA Figure 2 course-type analysis.
    coursePatterns: {
      computingPrefixes: [...COMPUTING_PREFIXES],
      mathPrefixes: [...MATH_PREFIXES],
      sciencePrefixes: [...SCIENCE_PREFIXES],
      discreteMath: DISCRETE_MATH,
      textRules: TEXT_RULES,
    },
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

const serializeRegex = (re) => ({ source: re.source, flags: re.flags });

/**
 * JSON-safe projection for GET /api/majors. RegExp values cannot survive
 * JSON.stringify, so they become {source, flags} and the client rebuilds them.
 */
function serializeMajors() {
  return MAJORS.map((m) => ({
    ...m,
    coursePatterns: {
      ...m.coursePatterns,
      discreteMath: serializeRegex(m.coursePatterns.discreteMath),
      textRules: m.coursePatterns.textRules.map(([pattern, type]) => ({
        pattern: serializeRegex(pattern), type,
      })),
    },
  }));
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
