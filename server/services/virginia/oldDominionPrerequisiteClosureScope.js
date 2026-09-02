const ODU_SLUG = 'old-dominion-university';
const ODU_OWNER_NAMESPACE = 'va:uni:9218';

// The three unresolved CS rows need exact CourseLeaf boundaries. CS 202G is
// retained alongside them solely as an exact same-response positive control.
const ODU_CLOSURE_CAPTURE_CODES = Object.freeze([
  'CS115',
  'CS121G',
  'CS202G',
  'CS222',
]);

function oldDominionClosureCaptureKeys(scope) {
  const university = (scope?.universities || []).find((row) => (
    row?.slug === ODU_SLUG && row?.owner_namespace === ODU_OWNER_NAMESPACE
  ));
  if (!university) return [];
  return ODU_CLOSURE_CAPTURE_CODES.map((code) => `${ODU_OWNER_NAMESPACE}:${code}`);
}

function isScopedOldDominionClosureCapture(value) {
  return value?.slug === ODU_SLUG
    && value?.owner_namespace === ODU_OWNER_NAMESPACE
    && ODU_CLOSURE_CAPTURE_CODES.includes(value?.course_code);
}

module.exports = {
  ODU_CLOSURE_CAPTURE_CODES,
  ODU_OWNER_NAMESPACE,
  ODU_SLUG,
  isScopedOldDominionClosureCapture,
  oldDominionClosureCaptureKeys,
};
