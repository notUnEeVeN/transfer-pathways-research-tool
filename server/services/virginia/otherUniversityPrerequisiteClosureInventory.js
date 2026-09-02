const SCOPED_COURSE_KEYS = Object.freeze([
  'va:uni:9205:CL100',
  'va:uni:9205:CL150',
  'va:uni:9206:ENGL123',
  'va:uni:9214:CMSC140',
  'va:uni:9214:CMSC160',
  'va:uni:9214:CMSC161',
  'va:uni:9214:CMSC483',
  'va:uni:9214:CTZN110',
  'va:uni:9214:ENGL165',
  'va:uni:9214:MATH171',
  'va:uni:9214:MATH175',
  'va:uni:9218:CS115',
  'va:uni:9218:CS121G',
  'va:uni:9218:CS222',
  'va:uni:9218:OEAS106N',
  'va:uni:9218:OEAS110N',
  'va:uni:9218:OEAS111N',
  'va:uni:9218:OEAS126N',
]);

const SAFE_RESOLUTION_KEYS = Object.freeze([
  'va:uni:9205:CL100',
  'va:uni:9205:CL150',
  'va:uni:9206:ENGL123',
  'va:uni:9218:CS115',
  'va:uni:9218:CS121G',
  'va:uni:9218:CS222',
  'va:uni:9218:OEAS110N',
  'va:uni:9218:OEAS111N',
  'va:uni:9218:OEAS126N',
]);

const EXPECTED_DIRECT_REVIEW_DELTA = Object.freeze({
  parsed: 0,
  none: 9,
  unparsed: -9,
  missing: 0,
});

function auditOtherUniversityPrerequisiteClosureInventory(resolutionsByCourseKey) {
  const entries = resolutionsByCourseKey instanceof Map
    ? [...resolutionsByCourseKey.entries()]
    : Object.entries(resolutionsByCourseKey || {});
  const actualKeys = entries.map(([key]) => key).sort();
  const expectedKeys = [...SCOPED_COURSE_KEYS].sort();
  const byKey = new Map(entries);
  const readyKeys = actualKeys.filter((key) => byKey.get(key)?.ready === true);
  const blockedKeys = actualKeys.filter((key) => byKey.get(key)?.ready === false);
  return {
    valid: JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)
      && JSON.stringify(readyKeys) === JSON.stringify([...SAFE_RESOLUTION_KEYS].sort())
      && blockedKeys.length === 9
      && actualKeys.every((key) => byKey.get(key)?.applicable === true),
    scoped_count: expectedKeys.length,
    ready_count: readyKeys.length,
    blocked_count: blockedKeys.length,
    missing_scoped_keys: expectedKeys.filter((key) => !actualKeys.includes(key)),
    unexpected_keys: actualKeys.filter((key) => !expectedKeys.includes(key)),
    ready_keys: readyKeys,
    blocked_keys: blockedKeys,
    expected_direct_review_delta: EXPECTED_DIRECT_REVIEW_DELTA,
  };
}

module.exports = {
  EXPECTED_DIRECT_REVIEW_DELTA,
  SAFE_RESOLUTION_KEYS,
  SCOPED_COURSE_KEYS,
  auditOtherUniversityPrerequisiteClosureInventory,
};
