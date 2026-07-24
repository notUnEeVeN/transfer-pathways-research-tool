/**
 * Resolves a major to its course-typing rules.
 *
 * Typing rules are per-major modules rather than per-major data because they
 * are regexes, prefix sets and campus-scoped course-number tables. The rollups
 * those categories feed (figure columns and panels) ARE data, and live on the
 * major's `courseTypes` entry in config/majors.js.
 *
 * A major without a `courseTypes` entry gets no typing callback, and the
 * coverage rows simply carry no course-type breakdown — the figures gate on
 * the `courseTypeFigures` capability, so they never ask.
 */
const { getMajor, defaultMajor } = require('../config/majors');
const cs = require('./courseTypes');
const bio = require('./courseTypesBio');
const econ = require('./courseTypesEcon');

const MODULES = {
  // Computer Science types one category per receiver. Wrapped so every major
  // presents the same array-returning contract to buildDegreeGroups.
  cs: {
    fineCategories: cs.COURSE_TYPES,
    degreeCategoryOf: (schoolId, universityCoursesById) => {
      const categoryOf = cs.degreeCategoryOf(universityCoursesById);
      return (ctx) => {
        const category = categoryOf(ctx);
        return category ? [category] : [];
      };
    },
  },
  bio: {
    fineCategories: bio.FINE_CATEGORIES,
    degreeCategoryOf: bio.degreeCategoryOf,
  },
  econ: {
    fineCategories: econ.FINE_CATEGORIES,
    degreeCategoryOf: econ.degreeCategoryOf,
  },
};

/**
 * The typing module a major uses, or null when it declares none.
 *
 * An ABSENT slug resolves to the default major. That is not a scope fallback —
 * the caller has already selected its degrees by then, and this only decides
 * how those degrees' requirements are labelled. It preserves the contract for
 * legacy `majorContains` callers, which typed through the Computer Science
 * rules unconditionally before typing became per-major. An UNKNOWN slug still
 * resolves to null, so a misspelling fails closed rather than silently
 * labelling one major's degrees with another's vocabulary.
 */
function courseTypeModuleFor(majorSlug) {
  const slug = String(majorSlug ?? '').trim();
  const major = slug ? getMajor(slug) : defaultMajor();
  const name = major?.courseTypes?.module;
  return (name && MODULES[name]) || null;
}

/**
 * A `categoryOf` callback for one campus, or null when the major does not
 * support course typing. Bound per campus because course numbering collides
 * across campuses (CHEM 3A is organic chemistry at Berkeley and general
 * chemistry at Santa Cruz).
 */
function categoryOfFor(majorSlug, schoolId, universityCoursesById = {}) {
  const module = courseTypeModuleFor(majorSlug);
  if (!module) return null;
  return module.degreeCategoryOf(schoolId, universityCoursesById);
}

/** Every fine category the major's typing module can emit. */
function fineCategoriesFor(majorSlug) {
  return courseTypeModuleFor(majorSlug)?.fineCategories || [];
}

module.exports = {
  courseTypeModuleFor,
  categoryOfFor,
  fineCategoriesFor,
};
