/**
 * Course types for Economics. See docs/figures/bio-course-types.md for the
 * shape this follows; the taxonomy notes specific to Economics are below.
 *
 * Economics is the thinnest of the three onboarded majors and shows the same
 * inversion Biology does: across the nine templates MATH carries 39 course
 * references against Economics' 23. A quantitative service discipline, not the
 * major's own department, is the heaviest lower-division dependency.
 *
 *   fine       econ_principles · econ_theory │ calculus · statistics · computing │ other_social │ non_stem
 *   extended   Economics                     │ Calculus │ Statistics │ Computing │ Other Social │ Non-STEM
 *   faithful   Economics                     │ Math ─────────────────────────────┤ Other Social │ Non-STEM
 *
 * TWO rules here are title-driven rather than prefix-driven, because Economics
 * departments teach their own quantitative courses:
 *
 *   1. Statistics is taught under the ECON prefix at three campuses — UCLA
 *      ECON 41 "Probability and Statistics for Economists", UCSB ECON 5
 *      "Statistics for Economics", UC Irvine ECON 15. Prefix alone would file
 *      them as economics coursework and hide the statistics requirement.
 *   2. Intermediate theory is likewise an ECON course but a materially harder
 *      articulation target than principles — UCLA ECON 11 "Microeconomic
 *      Theory", UCSB ECON 10A "Intermediate Microeconomic Theory". It gets its
 *      own category so the figure can show that only two campuses ask for it.
 *
 * What this module deliberately does NOT do is split principles into micro and
 * macro. Seven campuses name them ("Principles of Microeconomics"), but
 * Berkeley states ECON 1/2 as "Introduction to Economics" and Irvine states
 * ECON 20A/20B as "Basic Economics I/II". Splitting would print a "not
 * required" bar at two campuses that plainly require both halves, which is
 * worse than not splitting at all.
 */

const FINE_CATEGORIES = [
  'econ_principles', 'econ_theory', 'calculus', 'statistics',
  'computing', 'other_social', 'non_stem',
];

const ECON_PREFIXES = new Set(['ECON', 'ECN', 'ECONOMICS']);
const MATH_PREFIXES = new Set(['MATH', 'MAT', 'AM', 'APPM']);
const STATS_PREFIXES = new Set(['STAT', 'STATS', 'STA', 'PSTAT']);
const COMPUTING_PREFIXES = new Set(['I&C SCI', 'ICS', 'CSE', 'CS', 'COMPSCI', 'IN4MATX']);
// Social-science departments other than economics. COGS appears on BOTH sides —
// Merced's COGS 1 is an introductory social science, Irvine's COGS 14M/14P are
// its computer-education requirement — so the title decides, not the prefix.
const SOCIAL_PREFIXES = new Set([
  'POLI', 'POL SCI', 'PSY', 'PSYCH', 'SOC', 'SOCIOL', 'ANTHRO', 'ANTH',
  'COGS', 'SOC SCI', 'GEOG', 'HIST',
]);

const STATISTICS_TEXT = /statistic|probabilit|econometric|data science|statistical/i;
const THEORY_TEXT = /intermediate|(micro|macro)economic theory/i;
const COMPUTING_TEXT = /programming|computer|computation|software/i;

/**
 * Ordered rules for requirements with no university course code — GE blocks,
 * elective pools, the free-text "additional Social Sciences" requirement.
 * First match wins. Non-STEM is the fallthrough.
 */
const TEXT_RULES = [
  [/writing|composition|communication \(|\bethic|entry level writing/i, 'non_stem'],
  [/general[- ]education|cal-?getc|\bIGETC\b|\bGE\b|elective capacity|unrestricted elective|breadth|humanities|\barts\b|literature|remaining after/i, 'non_stem'],
  [THEORY_TEXT, 'econ_theory'],
  [STATISTICS_TEXT, 'statistics'],
  [COMPUTING_TEXT, 'computing'],
  [/calculus|\bmathematic|\bMATH\b|differential|linear algebra/i, 'calculus'],
  [/social science|sociolog|political|psycholog|anthropolog|geograph/i, 'other_social'],
  [/econom|\bECON\b/i, 'econ_principles'],
];

function normalizePrefix(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** The fine category of one university course code. */
function typeOfCourseCode(schoolId, prefix, number = '', title = '') {
  const whole = normalizePrefix(prefix);
  const name = String(title || '');

  if (ECON_PREFIXES.has(whole)) {
    // An economics department teaching statistics or intermediate theory is
    // still teaching statistics or intermediate theory.
    if (STATISTICS_TEXT.test(name)) return 'statistics';
    if (THEORY_TEXT.test(name)) return 'econ_theory';
    return 'econ_principles';
  }
  if (STATS_PREFIXES.has(whole)) return 'statistics';
  if (MATH_PREFIXES.has(whole)) {
    return STATISTICS_TEXT.test(name) ? 'statistics' : 'calculus';
  }
  if (COMPUTING_PREFIXES.has(whole)) return 'computing';
  if (SOCIAL_PREFIXES.has(whole)) {
    // Irvine's computer-education requirement is drawn from social-science
    // departments (COGS 14P, SOC SCI 3A); Merced's COGS 1 is not.
    return COMPUTING_TEXT.test(name) ? 'computing' : 'other_social';
  }
  return 'non_stem';
}

/** The fine category implied by a free-text requirement or group title. */
function typeOfText(text) {
  const value = String(text || '');
  const head = value.split(/\s+[—–-]\s+|\(/)[0];
  for (const source of [head, value]) {
    for (const [pattern, category] of TEXT_RULES) {
      if (pattern.test(source)) return category;
    }
  }
  return 'non_stem';
}

function distinct(categories) {
  return [...new Set(categories.filter(Boolean))];
}

/** Every fine category one receiver belongs to. */
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

/** The `categoryOf` callback buildDegreeGroups expects, bound to one campus. */
function degreeCategoryOf(schoolId, universityCoursesById = {}) {
  return ({ receiver, section, group }) => (
    receiver
      ? categoriesOfReceiver(schoolId, receiver, group, universityCoursesById)
      : categoriesOfSection(schoolId, section, group, universityCoursesById)
  );
}

module.exports = {
  FINE_CATEGORIES,
  typeOfCourseCode,
  typeOfText,
  categoriesOfReceiver,
  categoriesOfSection,
  degreeCategoryOf,
};
