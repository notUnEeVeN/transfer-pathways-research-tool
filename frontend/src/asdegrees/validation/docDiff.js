const DOC_FIELD_PRIORITY = [
  'status',
  'degree_title_seen',
  'catalog_url',
  'catalog_year',
  'unit_system',
  'total_units',
  'verification',
]

const IGNORED_DOC_FIELDS = new Set([
  '_id',
  'legacy_id',
  'kind',
  'community_college_id',
  'college_id',
  'degree_type',
  'major_slug',
  'requirement_groups',
  // These are replaced by the canonical PUT and are not user edits.
  'updated_at',
  'curated_at',
  'curated_by',
])

function normalize(value) {
  if (value == null || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalize)
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, normalize(value[key])]),
  )
}

function same(left, right) {
  return JSON.stringify(normalize(left ?? null)) === JSON.stringify(normalize(right ?? null))
}

/** Group-level plus selected document-field diff used by the approval UI. */
export function diffDocs(current = {}, proposed = {}) {
  const changes = []
  const beforeGroups = new Map((current.requirement_groups || []).map((group) => [group.group_id, group]))
  const afterGroups = new Map((proposed.requirement_groups || []).map((group) => [group.group_id, group]))
  const beforeIndex = new Map((current.requirement_groups || []).map((group, index) => [group.group_id, index]))
  const afterIndex = new Map((proposed.requirement_groups || []).map((group, index) => [group.group_id, index]))

  for (const [groupId, before] of beforeGroups) {
    const after = afterGroups.get(groupId)
    if (!after) changes.push({ group_id: groupId, kind: 'removed', before, after: null })
  }
  for (const [groupId, after] of afterGroups) {
    const before = beforeGroups.get(groupId)
    if (!before) changes.push({ group_id: groupId, kind: 'added', before: null, after })
    else if (!same(before, after) || beforeIndex.get(groupId) !== afterIndex.get(groupId)) {
      changes.push({
        group_id: groupId,
        kind: 'changed',
        before,
        after,
        before_index: beforeIndex.get(groupId),
        after_index: afterIndex.get(groupId),
      })
    }
  }

  const allDocFields = new Set([...Object.keys(current), ...Object.keys(proposed)])
  const docFields = [
    ...DOC_FIELD_PRIORITY.filter((field) => allDocFields.has(field)),
    ...[...allDocFields]
      .filter((field) => !DOC_FIELD_PRIORITY.includes(field) && !IGNORED_DOC_FIELDS.has(field))
      .sort(),
  ]
  for (const field of docFields) {
    if (!same(current[field], proposed[field])) {
      changes.push({ group_id: field, kind: 'doc_field', before: current[field] ?? null, after: proposed[field] ?? null })
    }
  }
  return changes
}

export { same as _sameCanonicalValue }

/** Attach explicit AI provenance before the proposal enters the normal save path. */
export function stampAiAssistedGroups(current = {}, proposed = {}) {
  const changes = diffDocs(current, proposed)
  const changedIds = new Set(
    changes
      .filter((change) => change.kind === 'added' || change.kind === 'changed')
      .map((change) => change.group_id),
  )
  const next = {
    ...proposed,
    requirement_groups: (proposed.requirement_groups || []).map((group) => {
      if (!changedIds.has(group.group_id)) return group
      const next = {
        ...group,
        source: 'curated',
        confidence: null,
        curated_by: null,
        curated_via: 'ai_assist',
      }
      delete next.curated_at
      return next
    }),
  }
  if (Object.prototype.hasOwnProperty.call(current, 'verification')) {
    next.verification = normalize(current.verification)
    if (changes.length && next.verification?.verified === true) {
      next.verification = {
        ...next.verification,
        verified: false,
        verified_by: null,
        verified_at: null,
      }
    }
  } else {
    delete next.verification
  }
  return next
}
