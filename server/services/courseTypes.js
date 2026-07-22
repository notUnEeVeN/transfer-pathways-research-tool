/**
 * Course types for the Massachusetts paper's Figure 2 analysis: every degree
 * requirement is Computing, Math, Science (including engineering), or
 * Non-STEM.
 *
 * The MA paper's rule is "allocate courses based on the course codes at the
 * Four Years — with the exception of Discrete Math, which we categorized
 * always as math, despite some variation". This module applies exactly that
 * rule to the UC side:
 *
 *   1. A requirement that names university courses is typed by its FIRST
 *      course's catalog prefix (a cross-listed code such as "EE/CS 120A"
 *      resolves to the computing side, since one code is enough to place it).
 *   2. Discrete math overrides the prefix in both directions — UC San Diego's
 *      CSE 20 and UC Santa Barbara's CMPSC 40 are math, not computing.
 *   3. Requirements stored as free text (upper-division blocks, elective
 *      pools, GE areas) have no course code to read, so they are typed by an
 *      ORDERED, explicitly documented rule list. Those rules are the only
 *      judgment in the figure; see docs/figures/ma-course-type-spread.md.
 *
 * The prefix sets below cover every receiving prefix present in the nine
 * curated UC degree templates. An unknown prefix falls through to Non-STEM,
 * which is the correct default for the humanities/writing codes that appear
 * there (WCWP, ENGLISH, LING).
 */

const COURSE_TYPES = ['computing', 'math', 'science', 'non_stem'];

const COMPUTING_PREFIXES = new Set([
  'CS', 'CSE', 'ECS', 'CMPSC', 'COM SCI', 'COMPSCI', 'I&C SCI', 'IN4MATX',
  'EECS', 'COGS', 'ICS',
]);
const MATH_PREFIXES = new Set(['MATH', 'MAT', 'STAT', 'STATS', 'PSTAT', 'AM']);
// MA counts engineering with science.
const SCIENCE_PREFIXES = new Set([
  'PHYS', 'PHYSICS', 'PHY', 'CHEM', 'CHE', 'BILD', 'BIOL', 'BIOLOGY', 'MCELLBI',
  'ASTRON', 'BIS', 'ENGR', 'EE', 'ECE', 'EC ENGR', 'MAE', 'ME', 'NANO', 'ENSC',
  'BIEN', 'ENGRCS', 'ESM',
]);

// Discrete math by any name: the paper's single documented exception.
const DISCRETE_MATH = /discrete\s*(math|structure)|\bCSE\s*0*20\b|\bCMPSC\s*0*40\b|\bCSE\s*0*16\b|\bECS\s*0*20\b|\bCS\s*0*111\b|\bMATH\s*0*61\b/i;

/**
 * Ordered rules for requirements with no university course code. First match
 * wins, so the list reads top-down as the categorization policy itself.
 */
const TEXT_RULES = [
  [DISCRETE_MATH, 'math'],
  // Blocks the template names as major coursework are computing even when one
  // course inside also carries a writing designation (UC Irvine's I&C SCI 139W).
  [/upper-?division (major|elective)|major (field|coursework)|technical elective|systems elective|theory\/?\s?abstraction|applications of computing|computing elective|project in computer science/i, 'computing'],
  // Writing, communication, ethics and breadth: often satisfied by a
  // computing-prefixed course, but not computing coursework.
  [/writing|composition|disciplinary communication|communication \(|\bethic/i, 'non_stem'],
  [/humanities|social (science|analysis|&|and)|\barts\b|literature|historical|history|culture|language other than english|cross-?cultural|crossroads|breadth|perspectives|textual analysis|interpreting arts|ethnicity|practice \(pr\)/i, 'non_stem'],
  [/unrestricted elective|additional upper-division units|non-?contiguous|general[- ]education|cal-?getc|\bGE:/i, 'non_stem'],
  [/\b(CS|CSE|CMPSC|ECS|EECS|COMPSCI|COM SCI|I&C SCI|ICS|IN4MATX)\b|software|algorithm|compiler|operating system|comput/i, 'computing'],
  [/probabil|statist|\bmath/i, 'math'],
  [/\b(PHYS|CHEM|BIOL|BILD|ASTRON|MCELLBI|ENGR)\b|physic|chemis|biolog|life science|scientific|science|engineering|laborator|\blab\b/i, 'science'],
];

function normalizePrefix(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** The type implied by a university course code, before any text rules. */
function typeOfCourseCode(prefix, number = '', title = '') {
  const code = `${normalizePrefix(prefix)} ${number} ${title}`;
  if (DISCRETE_MATH.test(code)) return 'math';
  // Whole prefix first — several UC codes contain punctuation ("I&C SCI").
  const whole = normalizePrefix(prefix);
  if (COMPUTING_PREFIXES.has(whole)) return 'computing';
  if (MATH_PREFIXES.has(whole)) return 'math';
  if (SCIENCE_PREFIXES.has(whole)) return 'science';
  // Cross-listed codes ("EE/CS 120A") count as computing if any side is.
  const parts = whole.split(/[/&+]| AND /).map((part) => part.trim()).filter(Boolean);
  if (parts.some((part) => COMPUTING_PREFIXES.has(part))) return 'computing';
  if (parts.some((part) => MATH_PREFIXES.has(part))) return 'math';
  if (parts.some((part) => SCIENCE_PREFIXES.has(part))) return 'science';
  return 'non_stem';
}

/** The type implied by a free-text requirement or group title. */
function typeOfText(text) {
  const value = String(text || '');
  // A leading course code is still a course code, even inside free text.
  const match = value.match(/^\s*([A-Z][A-Z&/ ]{0,10}?)\s*0*(\d+[A-Z]*)\b/);
  if (match) {
    const byCode = typeOfCourseCode(match[1], match[2], value);
    if (byCode !== 'non_stem') return byCode;
  }
  // Match the requirement's own title first — the text after an em dash or
  // inside parentheses is commentary, and it often names other departments
  // ("...outside Engineering/ICS/Economics/Mathematics"), which would
  // otherwise decide the type.
  const head = value.split(/\s+[—–-]\s+|\(/)[0];
  for (const source of [head, value]) {
    for (const [pattern, type] of TEXT_RULES) {
      if (pattern.test(source)) return type;
    }
  }
  return 'non_stem';
}

/**
 * The course type of one degree requirement section.
 *
 * `universityCoursesById` maps parent_id -> { prefix, number, title }. When a
 * section lists real courses the first one decides, matching the paper's
 * course-code rule; otherwise the receiver name (falling back to the group
 * title) goes through the text rules.
 */
function typeOfSection(section, group, universityCoursesById = {}) {
  const receivers = section?.receivers || [];
  for (const receiver of receivers) {
    const receiving = receiver?.receiving || {};
    const parentIds = receiving.kind === 'series'
      ? (receiving.parent_ids || [])
      : [receiving.parent_id];
    const course = parentIds.map((id) => universityCoursesById[id]).find(Boolean);
    if (course) return typeOfCourseCode(course.prefix, course.number, course.title);
  }
  const name = receivers.find((receiver) => receiver?.receiving?.name)?.receiving?.name;
  return typeOfText(name || group?.title || '');
}

/** The course type of a single requirement receiver. */
function typeOfReceiver(receiver, group, universityCoursesById = {}) {
  const receiving = receiver?.receiving || {};
  const parentIds = receiving.kind === 'series'
    ? (receiving.parent_ids || [])
    : [receiving.parent_id];
  const course = parentIds.map((id) => universityCoursesById[id]).find(Boolean);
  if (course) return typeOfCourseCode(course.prefix, course.number, course.title);
  return typeOfText(receiving.name || group?.title || '');
}

/**
 * The `categoryOf` callback buildDegreeGroups expects: receiver-level typing
 * where a receiver is available, section-level typing otherwise.
 */
function degreeCategoryOf(universityCoursesById = {}) {
  return ({ receiver, section, group }) => (
    receiver
      ? typeOfReceiver(receiver, group, universityCoursesById)
      : typeOfSection(section, group, universityCoursesById)
  );
}

module.exports = {
  COURSE_TYPES,
  typeOfCourseCode,
  typeOfText,
  typeOfSection,
  typeOfReceiver,
  degreeCategoryOf,
};
