/**
 * A new, unsaved AS-degree document, and the client-side answer to "would the
 * server take this yet?".
 *
 * saveBlockers mirrors the found-row rules in validateAsDegree
 * (server/controllers/CanonicalData.js). It exists so the Save button can be
 * honest before the round trip, not to replace the server check — the server
 * validates every save regardless. If a rule changes there, change it here.
 */

/** An empty document with the identity the validator cross-checks. */
export function buildScaffold({ collegeId, major, slot }) {
  const id = Number(collegeId)
  const legacyId = `${id}:${major}:${slot}`
  return {
    _id: `as_degree:${legacyId}`,
    legacy_id: legacyId,
    kind: 'as_degree',
    college_id: `cc:${id}`,
    community_college_id: id,
    major_slug: major,
    degree_type: slot,
    template_ref: null,
    status: 'found',
    degree_title_seen: '',
    catalog_url: '',
    catalog_year: '',
    unit_system: 'semester',
    total_units: null,
    requirement_groups: [],
  }
}

const filled = (value) => typeof value === 'string' && value.trim().length > 0

/** Plain-language reasons the server would reject this row; [] when saveable. */
export function saveBlockers(doc) {
  if (!doc || typeof doc !== 'object') return ['a document']
  const groups = Array.isArray(doc.requirement_groups) ? doc.requirement_groups : []
  if (doc.status !== 'found') {
    return groups.length
      ? [`no requirement groups (a ${doc.status} row must not carry any)`]
      : []
  }
  const blockers = []
  if (!filled(doc.degree_title_seen)) blockers.push('a degree title as printed in the catalog')
  if (!/^https?:\/\//.test(String(doc.catalog_url || ''))) blockers.push('a catalog URL starting with http')
  if (!filled(doc.catalog_year)) blockers.push('a catalog year')
  if (!Number.isFinite(doc.total_units) || doc.total_units <= 0) blockers.push('a positive total unit count')
  if (!groups.length) blockers.push('at least one requirement group')
  return blockers
}
