/**
 * Fixed remediation boundary for the Norfolk State and Virginia State rows
 * that were still unparsed in the checked-in 2026-08-25 review.
 *
 * This is deliberately not a prefix-wide opt-in.  Exact official CourseLeaf
 * captures may supersede the older retained-text candidate only for these
 * reviewed rows.  A future unparsed row must be audited and added explicitly.
 */

const INSTITUTIONS = Object.freeze({
  'norfolk-state-university': Object.freeze({
    owner_namespace: 'va:uni:9217',
    course_codes: Object.freeze([
      'CHM221L',
      'CSC101',
      'CSC295',
      'CSC316',
      'CSC369',
      'CSC395',
      'CSC435',
      'CSC466',
      'CSC467',
      'CSC470',
      'CSC471',
      'CSC476',
      'CSC477',
      'CSC486',
      'CSC492',
      'CSC499',
      'ECN200',
      'ENG101',
      'HRP320',
      'SEM101',
      'SEM102',
      'SEM201',
    ]),
  }),
  'virginia-state-university': Object.freeze({
    owner_namespace: 'va:uni:9231',
    course_codes: Object.freeze([
      'AGRI100',
      'AGRI150',
      'BIOL116',
      'BIOL120',
      'CHEM105',
      'CHEM153',
      'CHEM163',
      'CSCI150',
      'CSCI151',
      'CSCI457',
      'DIET101',
      'DRAM199',
      'FREN110',
      'GEOG210',
      'GLST202',
      'HPER160',
      'HPER165',
      'HPER166',
      'HPER169',
      'HPER170',
      'HPER171',
      'MATH130',
      'MATH150',
      'PHYS100',
      'PHYS112',
      'PSYC212',
      'SOCI101',
      'SPAN110',
    ]),
  }),
});

const scopedCodesBySlug = new Map(Object.entries(INSTITUTIONS).map(([slug, row]) => [
  slug,
  new Set(row.course_codes),
]));

function isScopedNorfolkVirginiaStatePrerequisite({
  slug,
  owner_namespace: ownerNamespace,
  course_code: courseCode,
  code,
  course_key: courseKey,
} = {}) {
  const institution = INSTITUTIONS[slug];
  const normalizedCode = String(courseCode || code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!institution || ownerNamespace !== institution.owner_namespace
      || !scopedCodesBySlug.get(slug).has(normalizedCode)) return false;
  return courseKey == null || courseKey === `${ownerNamespace}:${normalizedCode}`;
}

function scopedUnparsedCourseKeys(review) {
  const rows = [
    ...(Array.isArray(review?.direct_review_rows) ? review.direct_review_rows : []),
    ...(Array.isArray(review?.closure_review_rows) ? review.closure_review_rows : []),
  ];
  return [...new Set(rows.filter((row) => (
    row?.status === 'unparsed'
      && isScopedNorfolkVirginiaStatePrerequisite(row)
  )).map((row) => row.course_key))].sort();
}

function scopedInventoryAudit(review) {
  const expected = Object.entries(INSTITUTIONS).flatMap(([slug, row]) => (
    row.course_codes.map((courseCode) => ({
      slug,
      owner_namespace: row.owner_namespace,
      course_key: `${row.owner_namespace}:${courseCode}`,
      course_code: courseCode,
    }))
  ));
  const actualKeys = new Set(scopedUnparsedCourseKeys(review));
  const expectedKeys = new Set(expected.map((row) => row.course_key));
  return {
    expected_count: expectedKeys.size,
    actual_count: actualKeys.size,
    missing_expected_keys: [...expectedKeys].filter((key) => !actualKeys.has(key)).sort(),
    unexpected_scoped_keys: [...actualKeys].filter((key) => !expectedKeys.has(key)).sort(),
  };
}

module.exports = {
  INSTITUTIONS,
  isScopedNorfolkVirginiaStatePrerequisite,
  scopedInventoryAudit,
  scopedUnparsedCourseKeys,
};
