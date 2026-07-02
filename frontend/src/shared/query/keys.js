/**
 * Query key factory. Every key includes the user uid so a sign-out + sign-in
 * as a different user can never leak data. Catalog keys additionally include
 * the (home, secondaries) tuple — adding a secondary college in Settings
 * mutates the user doc; the new query key becomes a different cache entry
 * and the new fetch fires automatically.
 */
export const qk = {
  userData: (uid) => ['userData', uid],
  colleges: () => ['colleges'],
  transferDeadlines: () => ['transferDeadlines'],
  siteMeta: () => ['siteMeta'],
  ccKeyDates: (collegeId) => ['ccKeyDates', Number(collegeId) || null],

  // Demand-driven catalog:
  //   schools         — the tiny UC+CSU id/name list for the nav/tabs (no agreements)
  //   collegeCourses  — the home + secondary CC course catalog (small)
  //   agreementSlice  — ONE school's agreements at ONE college, loaded on demand
  // Slicing by (college, system, school) means a returning visitor only re-fetches
  // the school they actually open, and CSU never loads until the CSU tab is used.
  schools: (uid) => ['schools', uid],
  collegeCourses: (uid, homeId, secondaryIds) => [
    'collegeCourses',
    uid,
    Number(homeId) || null,
    [...(secondaryIds || [])].sort().join(',')
  ],
  agreementSlice: (uid, collegeId, system, schoolId) => [
    'agreementSlice',
    uid,
    Number(collegeId) || null,
    system,
    Number(schoolId) || null
  ],

  // Receiving-side (UC/CSU) course catalog, fetched lazily after the main
  // catalog resolves and keyed by the set of school ids it covers. Split out
  // of `catalog` so its ~32 round-trips don't block the eligibility/plan tools
  // from painting — it only feeds the receiving-side course names in the
  // major-detail modal.
  universityCourses: (uid, schoolIds) => ['universityCourses', uid, [...(schoolIds || [])].join(',')],

  // Internal desktop audit. Bucketed by (scope, schoolIds, majorContains, groupingId)
  // via _filterKey; bootstrap drops scope on purpose since one fetch covers
  // every scope. When a groupingId is active, the legacy scope/schoolIds/
  // majorContains fields are collapsed out of the key — the backend ignores
  // them in that case.
  auditBootstrap:       (uid, filter) => ['audit', 'bootstrap', uid, _bootstrapKey(filter)],
  auditNext:            (uid, filter) => ['audit', 'next', uid, _filterKey(filter)],
  auditDoc:             (uid, docId, system) => ['audit', 'doc', uid, docId, system || null],
  auditErrors:          (uid, filter) => ['audit', 'errors', uid, _filterKey(filter)],
  auditConservative:    (uid, filter) => ['audit', 'conservative', uid, _filterKey(filter)],
  auditFlagged:         (uid, filter) => ['audit', 'flagged', uid, _filterKey(filter)],
  auditStale:           (uid, filter) => ['audit', 'stale', uid, _filterKey(filter)],
  auditCorrect:         (uid, filter, search, limit) => ['audit', 'correct', uid, _filterKey(filter), (search || '').toLowerCase(), limit || 200],
  auditStats:           (uid, filter) => ['audit', 'stats', uid, _filterKey(filter)],
  auditTemplateVariants:(uid, filter) => ['audit', 'templateVariants', uid, _filterKey(filter)],
  auditMatrix:          (uid, filter) => ['audit', 'matrix', uid, _filterKey(filter)],
  auditGroupings:       (uid) => ['audit', 'groupings', uid],
  auditGrouping:        (uid, id) => ['audit', 'grouping', uid, id || null],
  auditSearch:          (uid, q) => ['audit', 'search', uid, (q || '').toLowerCase()]
}

// Stable, content-addressable key for the audit filter. Sorted ids + lowercase
// substring ensures `{scope:'uc', schoolIds:[2,1]}` and `{scope:'uc',
// schoolIds:[1,2]}` hash to the same cache entry. When `groupingId` is set,
// it alone determines the bucket — legacy fields are ignored to match the
// server's filter resolution.
function _filterKey(filter) {
  if (!filter) return 'all||'
  if (filter.groupingId) return `g:${filter.groupingId}`
  const scope = filter.scope || 'all'
  const ids = [...(filter.schoolIds || [])].map(Number).filter(Boolean).sort((a, b) => a - b).join(',')
  const major = (filter.majorContains || '').trim().toLowerCase()
  return `${scope}|${ids}|${major}`
}

// Like _filterKey but without scope — bootstrap covers every scope in one
// payload so (schoolIds, majorContains) alone hashes to one cache entry
// regardless of which scope the user is viewing. Grouping case still keys
// off the grouping id alone.
function _bootstrapKey(filter) {
  if (!filter) return '||'
  if (filter.groupingId) return `g:${filter.groupingId}`
  const ids = [...(filter.schoolIds || [])].map(Number).filter(Boolean).sort((a, b) => a - b).join(',')
  const major = (filter.majorContains || '').trim().toLowerCase()
  return `${ids}|${major}`
}
