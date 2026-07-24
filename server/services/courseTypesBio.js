/**
 * Course types for Biology, the second major to carry the MA Figure 2 and CA
 * Figure 5 course-type figures. See docs/figures/bio-course-types.md for the
 * taxonomy and the reasoning behind the two faithful-rollup merges.
 *
 * Typing is receiver-level and rule-based, against the four-year's own course
 * code, exactly as services/courseTypes.js does for Computer Science. It is a
 * separate module rather than more prefix sets in that one because the two
 * majors disagree about what a prefix means: CHEM is peripheral science for a
 * computer scientist and the largest single block of a biology degree, and
 * MCELLBI is Berkeley's own-discipline prefix here but has no meaning there.
 *
 * FINE categories are the unit of typing. Both figures roll them up:
 *
 *   fine       bio_series │ gen_chem · organic_chem │ physics │ calculus · statistics │ computing │ non_stem
 *   extended   Biology    │ Chemistry               │ Physics │ Math                  │ Computing │ Non-STEM
 *   faithful   Biology    │ Chemistry & Physics ─────────────┤ Math ─────────────────────────────┤ Non-STEM
 *
 * A receiver may type into MORE THAN ONE fine category, which is why this
 * module returns arrays. Berkeley, UCLA, Merced and UCSD state chemistry as a
 * single indivisible series spanning general and organic courses
 * (CHEM 1A + 3A + 3B at Berkeley), so neither "type by the first course" nor
 * "type by the last" is true: the requirement is only satisfied when the whole
 * series articulates, so it counts against both disciplines. Figure 5 reads
 * every category returned; Figure 2 reads only the first, which costs nothing
 * because neither of its rollups separates general from organic chemistry.
 */

const FINE_CATEGORIES = [
  'bio_series', 'gen_chem', 'organic_chem', 'physics',
  'calculus', 'statistics', 'computing', 'non_stem',
];

// Berkeley's pin is Molecular and Cell Biology, so MCELLBI is an own-discipline
// prefix here rather than a general life-science one.
const BIO_PREFIXES = new Set([
  'BIO', 'BIOL', 'BIOLOGY', 'BILD', 'BIS', 'BIO SCI', 'BIOSCI', 'LIFESCI',
  'LIFE SCI', 'MCELLBI', 'MCDB', 'EEMB', 'BIOE', 'BIMM', 'BICD',
]);
const CHEM_PREFIXES = new Set(['CHEM', 'CHE', 'CHEM H', 'CHM']);
const PHYSICS_PREFIXES = new Set(['PHYS', 'PHYSICS', 'PHY']);
const MATH_PREFIXES = new Set(['MATH', 'MAT', 'AM']);
const STATS_PREFIXES = new Set(['STAT', 'STATS', 'PSTAT']);
const COMPUTING_PREFIXES = new Set(['CSE', 'DSC', 'CS', 'CMPSC', 'ECS', 'ICS']);

/**
 * The organic-chemistry course numbers of each pinned program, by school id.
 * Campus-scoped because the numbering collides: CHEM 3A is organic chemistry
 * at Berkeley and general chemistry at Santa Cruz. Anything on a chemistry
 * prefix that is not listed here is general chemistry.
 *
 * Transcribed from the nine curated templates; UCSB's CHEM 109A is retained
 * even though the template marks it upper-division preparation, so the figure
 * can still see it when whole-degree requirements are counted.
 */
const ORGANIC_BY_SCHOOL = {
  79: [/^3A[L]?$/, /^3B[L]?$/],                       // UC Berkeley
  89: [/^0*8[AB]$/, /^0*118[ABC]?$/],                 // UC Davis (CHE)
  120: [/^51[ABC]$/, /^51L[BC]$/],                    // UC Irvine
  117: [/^14[CD]$/, /^30A[L]?$/, /^30B$/],            // UCLA
  144: [/^0*8L?$/],                                   // UC Merced
  46: [/^0*8[AB]$/, /^0*8L[AB]$/],                    // UC Riverside
  7: [/^40[AB]$/, /^41[AB]$/],                        // UC San Diego
  128: [/^2[AB]L$/, /^6AL$/, /^109[AB]$/],            // UC Santa Barbara
  132: [/^0*8[AB]$/, /^0*8L$/],                       // UC Santa Cruz
};

/**
 * Courses whose prefix does not describe what the requirement is asking for.
 * The MA paper carries the same kind of exception for discrete math; these are
 * ours, and they are all one campus.
 *
 * UC Merced states its computing and its statistics requirements as
 * cross-department option lists ("select 1 of BIOE 021, CSE 019, CSE 022,
 * DSC 011, ME 021"), so prefix alone would file biostatistics under biology,
 * probability under calculus, and a MATLAB course under mechanical
 * engineering. Every entry below is an option inside one of those two
 * sections; nothing here is a judgment about the course in isolation.
 */
const COURSE_OVERRIDES = {
  117: {
    // UCLA lists Life Sciences 30A/B as one of three calculus pathways.
    'LIFESCI 30A': 'calculus',
    'LIFESCI 30B': 'calculus',
  },
  144: {
    // Computing option list.
    'BIOE 21': 'computing',
    'CSE 19': 'computing',
    'CSE 22': 'computing',
    'DSC 11': 'computing',
    'ME 21': 'computing',
    // Probability/statistics option list.
    'BIO 18': 'statistics',
    'DSC 8': 'statistics',
    'ECON 10': 'statistics',
    'MATH 32': 'statistics',
    'PSY 10': 'statistics',
  },
};

// A statistics course can sit on a math prefix (UCSD MATH 11, UCSB MATH 4A is
// not statistics but PSTAT 5A is). Name-matching catches the former.
const STATISTICS_TEXT = /statist|biostat|probabilit|data analysis/i;
// Life-science calculus is still calculus.
const CALCULUS_TEXT = /calculus|differential|linear algebra|analytic geometry/i;

/**
 * Ordered rules for requirements with no university course code — GE blocks,
 * elective pools, upper-division depth. First match wins, so the list reads
 * top-down as the policy. Non-STEM is the fallthrough, which is correct for
 * writing and breadth blocks and is guarded by a test asserting that no course
 * in the nine templates reaches it by accident.
 */
const TEXT_RULES = [
  [/writing|composition|communication \(|\bethic|entry level writing/i, 'non_stem'],
  [/humanities|social science|\barts\b|literature|historical|history|culture|language other than english|cross-?cultural|breadth|perspectives|ethnicity|general[- ]education|cal-?getc|\bIGETC\b|\bGE\b|elective capacity|unrestricted elective|remaining after/i, 'non_stem'],
  [/organic chem/i, 'organic_chem'],
  [/general chem|inorganic chem|\bchemistry\b|\bCHEM\b|\bCHE\b/i, 'gen_chem'],
  [/\bphysics\b|\bPHYS\b/i, 'physics'],
  [STATISTICS_TEXT, 'statistics'],
  [CALCULUS_TEXT, 'calculus'],
  [/\bmathematics\b|\bMATH\b/i, 'calculus'],
  [/biolog|life science|molecular|cell\b|organism|ecolog|evolution|genetic|physiolog|BIO SCI|\bBILD\b|\bBIS\b/i, 'bio_series'],
  [/comput|programming|data science|\bCSE\b|\bDSC\b/i, 'computing'],
];

function normalizePrefix(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function isOrganic(schoolId, number) {
  const patterns = ORGANIC_BY_SCHOOL[Number(schoolId)];
  if (!patterns) return false;
  const value = String(number || '').toUpperCase().trim();
  return patterns.some((pattern) => pattern.test(value));
}

/**
 * The fine category of one university course code, for one campus. Chemistry
 * splits by the campus's own organic numbering; a math-prefixed course whose
 * title names statistics is statistics.
 */
function typeOfCourseCode(schoolId, prefix, number = '', title = '') {
  const whole = normalizePrefix(prefix);
  // Leading zeroes vary between the templates and ASSIST ("CHE 008A" / "CHE 8A").
  const bare = String(number || '').toUpperCase().trim().replace(/^0+(?=\d)/, '');
  const override = COURSE_OVERRIDES[Number(schoolId)]?.[`${whole} ${bare}`];
  if (override) return override;
  if (BIO_PREFIXES.has(whole)) return 'bio_series';
  if (CHEM_PREFIXES.has(whole)) {
    return isOrganic(schoolId, number) ? 'organic_chem' : 'gen_chem';
  }
  if (PHYSICS_PREFIXES.has(whole)) return 'physics';
  if (STATS_PREFIXES.has(whole)) return 'statistics';
  if (MATH_PREFIXES.has(whole)) {
    return STATISTICS_TEXT.test(String(title || '')) ? 'statistics' : 'calculus';
  }
  if (COMPUTING_PREFIXES.has(whole)) return 'computing';
  return 'non_stem';
}

/** The fine category implied by a free-text requirement or group title. */
function typeOfText(text) {
  const value = String(text || '');
  // Commentary after an em dash or inside parentheses often names other
  // departments, which would otherwise decide the type. Try the head first.
  const head = value.split(/\s+[—–-]\s+|\(/)[0];
  for (const source of [head, value]) {
    for (const [pattern, category] of TEXT_RULES) {
      if (pattern.test(source)) return category;
    }
  }
  return 'non_stem';
}

/** Distinct categories, order preserved — the first is the primary. */
function distinct(categories) {
  return [...new Set(categories.filter(Boolean))];
}

/**
 * Every fine category one receiver belongs to.
 *
 * A `series` receiver spans several university courses and is satisfied only
 * when all of them articulate, so it is typed by every distinct category among
 * them rather than by whichever course happens to be listed first.
 */
function categoriesOfReceiver(schoolId, receiver, group, universityCoursesById = {}) {
  const receiving = receiver?.receiving || {};
  const parentIds = receiving.kind === 'series'
    ? (receiving.parent_ids || [])
    : [receiving.parent_id];
  const courses = parentIds.map((id) => universityCoursesById[id]).filter(Boolean);
  if (courses.length) {
    return distinct(courses.map((course) =>
      typeOfCourseCode(schoolId, course.prefix, course.number, course.title)));
  }
  return [typeOfText(receiving.name || group?.title || '')];
}

/** Every fine category one requirement section belongs to. */
function categoriesOfSection(schoolId, section, group, universityCoursesById = {}) {
  const receivers = section?.receivers || [];
  const fromCourses = distinct(receivers.flatMap((receiver) =>
    categoriesOfReceiver(schoolId, receiver, group, universityCoursesById)));
  if (fromCourses.length) return fromCourses;
  const name = receivers.find((receiver) => receiver?.receiving?.name)?.receiving?.name;
  return [typeOfText(name || group?.title || '')];
}

/**
 * The `categoryOf` callback buildDegreeGroups expects, bound to one campus.
 * Returns an array; buildDegreeGroups counts the first entry as the primary
 * category and every entry into the multi-category rollup.
 */
function degreeCategoryOf(schoolId, universityCoursesById = {}) {
  return ({ receiver, section, group }) => (
    receiver
      ? categoriesOfReceiver(schoolId, receiver, group, universityCoursesById)
      : categoriesOfSection(schoolId, section, group, universityCoursesById)
  );
}

module.exports = {
  FINE_CATEGORIES,
  ORGANIC_BY_SCHOOL,
  typeOfCourseCode,
  typeOfText,
  categoriesOfReceiver,
  categoriesOfSection,
  degreeCategoryOf,
};
