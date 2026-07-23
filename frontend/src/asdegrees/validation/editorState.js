/**
 * Pure state transitions for the structured AS-degree editor.
 *
 * The saved row stays in the agreement-skeleton shape validated by
 * server/controllers/CanonicalData.js. Every nested human edit marks its
 * containing group curated and resets group stamps so the existing PUT can
 * stamp the current saver. Callers may provide explicit `{ by, at }` stamps
 * when they already have that context (for example, verification toggles).
 */

export const AS_DEGREE_STATUSES = ['found', 'none_found', 'ambiguous']
export const AS_DEGREE_SOURCES = ['extracted', 'template_default', 'curated']
export const AS_DEGREE_TYPES = ['local_cs_as', 'local_computing', 'ast']
export const UNIT_SYSTEMS = ['semester', 'quarter']
export const GE_AREAS = [
  'natural_sciences',
  'social_behavioral',
  'humanities',
  'language_rationality',
  'math_competency',
  'local_pattern',
  'calgetc',
  'igetc',
  'csu_ge',
]

const SLUG_RE = /^[a-z0-9_]+$/
const VIEW_ONLY_FIELDS = [
  'college_name',
  'courses_by_id',
  'missing_core_concepts',
  'coverage_pct',
  'ge_breakdowns',
  'source_counts',
  'confidence_min',
  'confidence_mean',
  'unresolved_count',
  'units_accounted',
  'missing_core_count',
  'group_count',
  'flags',
  'verified',
]

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const clone = (value) => {
  if (value == null) return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

const dateValue = (value) => {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.toISOString()
  return value
}

const stampValues = (stamp, at) => {
  if (typeof stamp === 'string') return { by: stamp, at: dateValue(at) }
  if (!isRecord(stamp)) return { by: null, at: null }
  return {
    by: stamp.by ?? stamp.uid ?? stamp.curated_by ?? stamp.verified_by ?? null,
    at: dateValue(stamp.at ?? stamp.now ?? stamp.curated_at ?? stamp.verified_at),
    via: stamp.via ?? stamp.curated_via,
  }
}

export const slugifyGroupId = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '') || 'group'

const labelFromGroupId = (value) => String(value ?? '')
  .trim()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/^./, (letter) => letter.toUpperCase())

const uniqueGroupId = (groups, requested, exceptIndex = -1) => {
  const base = slugifyGroupId(requested)
  const used = new Set((groups || [])
    .filter((_, index) => index !== exceptIndex)
    .map((group) => group?.group_id))
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}_${suffix}`)) suffix += 1
  return `${base}_${suffix}`
}

export function markGroupCurated(group, stamp = null, at = null) {
  const next = { ...(clone(group) || {}) }
  const provenance = stampValues(stamp, at)
  next.source = 'curated'
  next.confidence = null
  // Clearing old stamps is deliberate. CanonicalData's PUT stamps a curated
  // group whose curated_by is empty with the identity/time of the current
  // saver, so a later human edit cannot retain a stale review attribution.
  next.curated_by = provenance.by
  next.curated_at = provenance.at
  if (provenance.via !== undefined) next.curated_via = provenance.via
  return next
}

export function createOption(courseIds = [], overrides = {}) {
  const ids = normalizeCourseIds(courseIds)
  return {
    ...(clone(overrides) || {}),
    course_ids: ids,
    course_conjunction: overrides?.course_conjunction || 'and',
    course_keys: ids.map((id) => `cc:${id}`),
  }
}

export function createReceiver(courseIds = [], overrides = {}) {
  if (isRecord(courseIds)) {
    overrides = courseIds
    courseIds = []
  }
  const suppliedOptions = Array.isArray(overrides?.options)
    ? overrides.options.map((option) => createOption(option?.course_ids, option))
    : null
  const ids = normalizeCourseIds(courseIds)
  return {
    ...(clone(overrides) || {}),
    receiving: null,
    articulation_status: 'articulated',
    not_articulated_reason: overrides?.not_articulated_reason ?? null,
    options: suppliedOptions ?? (ids.length ? [createOption(ids)] : []),
    options_conjunction: overrides?.options_conjunction || 'and',
    hash_id: overrides?.hash_id ?? null,
  }
}

export function createSection(overrides = {}) {
  return {
    ...(clone(overrides) || {}),
    section_advisement: overrides?.section_advisement ?? null,
    unit_advisement: overrides?.unit_advisement ?? null,
    receivers: Array.isArray(overrides?.receivers)
      ? overrides.receivers.map((receiver) => createReceiver(receiver))
      : [],
  }
}

export function createGroup(groupId, overrides = {}, stamp = null) {
  const requested = String(groupId ?? '').trim()
  const group = {
    is_required: true,
    group_conjunction: 'And',
    group_advisement: null,
    group_unit_advisement: null,
    group_min_distinct_sections: null,
    group_max_distinct_sections: null,
    group_section_min_courses: null,
    template_group: null,
    label_seen: labelFromGroupId(requested),
    ge_area: null,
    units_fill: false,
    unresolved_courses_seen: [],
    sections: [createSection()],
    ...(clone(overrides) || {}),
    group_id: slugifyGroupId(groupId),
  }
  if (group.units_fill === true) delete group.sections
  else if (!Array.isArray(group.sections)) group.sections = [createSection()]
  return markGroupCurated(group, stamp)
}

export function normalizeCourseIds(courseIds) {
  const seen = new Set()
  const ids = []
  for (const raw of Array.isArray(courseIds) ? courseIds : []) {
    const text = String(raw ?? '').trim().replace(/^cc:/, '')
    if (!text) continue
    const id = Number(text)
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function toEditableDoc(detailPayloadDoc) {
  const source = isRecord(detailPayloadDoc?.doc) ? detailPayloadDoc.doc : detailPayloadDoc
  const next = clone(isRecord(source) ? source : {})
  for (const field of VIEW_ONLY_FIELDS) delete next[field]

  if (!next.kind) next.kind = 'as_degree'
  if (!next.legacy_id && String(next._id || '').startsWith('as_degree:')) {
    next.legacy_id = String(next._id).slice('as_degree:'.length)
  }
  next.verification = {
    verified: false,
    verified_by: null,
    verified_at: null,
    notes: null,
    ...(isRecord(next.verification) ? next.verification : {}),
  }
  if (next.status === 'found' && next.requirement_groups == null) {
    next.requirement_groups = []
  }
  return next
}

const mutateGroup = (doc, groupId, mutate, stamp) => {
  const next = clone(doc) || {}
  if (!Array.isArray(next.requirement_groups)) return next
  const index = next.requirement_groups.findIndex((group) => group?.group_id === groupId)
  if (index < 0) return next
  const changed = mutate(next.requirement_groups[index], next, index)
  if (changed === false) return next
  next.requirement_groups[index] = markGroupCurated(
    changed === undefined ? next.requirement_groups[index] : changed,
    stamp
  )
  return next
}

export function updateGroup(doc, groupId, patch = {}, stamp = null) {
  return mutateGroup(doc, groupId, (group, next, index) => {
    const cleanPatch = clone(patch) || {}
    if ('group_id' in cleanPatch) {
      cleanPatch.group_id = uniqueGroupId(next.requirement_groups, cleanPatch.group_id, index)
      if (!('template_group' in cleanPatch)) cleanPatch.template_group = null
    }
    const changed = { ...group, ...cleanPatch }
    if (changed.units_fill === true) delete changed.sections
    return changed
  }, stamp)
}

// Preserve the user's in-progress text while typing a group id. The editor
// calls updateGroup on blur to normalize/dedupe the finished value; keeping
// the raw interim value here makes trailing underscores and multiword edits
// possible without remounting the field after every keystroke.
export function setGroupIdDraft(doc, groupIndex, value, stamp = null) {
  const next = clone(doc) || {}
  if (!Array.isArray(next.requirement_groups)
      || !Number.isInteger(groupIndex)
      || !isRecord(next.requirement_groups[groupIndex])) return next
  next.requirement_groups[groupIndex] = markGroupCurated({
    ...next.requirement_groups[groupIndex],
    group_id: String(value ?? ''),
    template_group: null,
  }, stamp)
  return next
}

export function normalizeGroupIdDraft(doc, groupIndex, stamp = null) {
  const next = clone(doc) || {}
  if (!Array.isArray(next.requirement_groups)
      || !Number.isInteger(groupIndex)
      || !isRecord(next.requirement_groups[groupIndex])) return next
  const group = next.requirement_groups[groupIndex]
  next.requirement_groups[groupIndex] = markGroupCurated({
    ...group,
    group_id: uniqueGroupId(next.requirement_groups, group.group_id, groupIndex),
    template_group: null,
  }, stamp)
  return next
}

export const markGroupReviewed = (doc, groupId, stamp = null) =>
  updateGroup(doc, groupId, {}, stamp)

export const renameGroup = (doc, groupId, nextGroupId, stamp = null) =>
  updateGroup(doc, groupId, { group_id: nextGroupId }, stamp)

export function addGroup(doc, groupId, overrides = {}, stamp = null) {
  const next = clone(doc) || {}
  const groups = Array.isArray(next.requirement_groups) ? next.requirement_groups : []
  const id = uniqueGroupId(groups, groupId)
  next.requirement_groups = [
    ...groups,
    createGroup(id, {
      ...(clone(overrides) || {}),
      label_seen: overrides?.label_seen ?? labelFromGroupId(groupId),
    }, stamp),
  ]
  return next
}

export function removeGroup(doc, groupId) {
  const next = clone(doc) || {}
  if (!Array.isArray(next.requirement_groups)) return next
  next.requirement_groups = next.requirement_groups.filter((group) => group?.group_id !== groupId)
  return next
}

const directionDelta = (direction) => {
  if (direction === 'up') return -1
  if (direction === 'down') return 1
  const numeric = Number(direction)
  return numeric < 0 ? -1 : numeric > 0 ? 1 : 0
}

const moveItem = (items, index, direction) => {
  const target = index + directionDelta(direction)
  if (index < 0 || target < 0 || target >= items.length || target === index) return index
  const [item] = items.splice(index, 1)
  items.splice(target, 0, item)
  return target
}

export function moveGroup(doc, groupId, direction, stamp = null) {
  const next = clone(doc) || {}
  if (!Array.isArray(next.requirement_groups)) return next
  const index = next.requirement_groups.findIndex((group) => group?.group_id === groupId)
  const target = moveItem(next.requirement_groups, index, direction)
  if (target !== index && target >= 0) {
    next.requirement_groups[target] = markGroupCurated(next.requirement_groups[target], stamp)
  }
  return next
}

export function addSection(doc, groupId, section = {}, stamp = null) {
  return mutateGroup(doc, groupId, (group) => {
    group.units_fill = false
    group.sections = [
      ...(Array.isArray(group.sections) ? group.sections : []),
      createSection(section),
    ]
  }, stamp)
}

export function updateSection(doc, groupId, sectionIndex, patch = {}, stamp = null) {
  return mutateGroup(doc, groupId, (group) => {
    if (!Array.isArray(group.sections) || !isRecord(group.sections[sectionIndex])) return false
    group.sections[sectionIndex] = createSection({
      ...group.sections[sectionIndex],
      ...(clone(patch) || {}),
    })
  }, stamp)
}

export function removeSection(doc, groupId, sectionIndex, stamp = null) {
  return mutateGroup(doc, groupId, (group) => {
    if (!Array.isArray(group.sections) || sectionIndex < 0 || sectionIndex >= group.sections.length) return false
    group.sections.splice(sectionIndex, 1)
  }, stamp)
}

export function moveSection(doc, groupId, sectionIndex, direction, stamp = null) {
  return mutateGroup(doc, groupId, (group) => {
    if (!Array.isArray(group.sections)) return false
    return moveItem(group.sections, sectionIndex, direction) === sectionIndex ? false : undefined
  }, stamp)
}

export function addReceiver(doc, groupId, sectionIndex, receiverOrCourseIds = [], stamp = null) {
  return mutateGroup(doc, groupId, (group) => {
    if (!Array.isArray(group.sections) || !isRecord(group.sections[sectionIndex])) return false
    const section = group.sections[sectionIndex]
    if (!Array.isArray(section.receivers)) section.receivers = []
    section.receivers.push(createReceiver(receiverOrCourseIds))
  }, stamp)
}

export function updateReceiver(doc, groupId, sectionIndex, receiverIndex, patch = {}, stamp = null) {
  return mutateGroup(doc, groupId, (group) => {
    const receivers = group.sections?.[sectionIndex]?.receivers
    if (!Array.isArray(receivers) || !isRecord(receivers[receiverIndex])) return false
    receivers[receiverIndex] = createReceiver({
      ...receivers[receiverIndex],
      ...(clone(patch) || {}),
    })
  }, stamp)
}

export function removeReceiver(doc, groupId, sectionIndex, receiverIndex, stamp = null) {
  return mutateGroup(doc, groupId, (group) => {
    const receivers = group.sections?.[sectionIndex]?.receivers
    if (!Array.isArray(receivers) || receiverIndex < 0 || receiverIndex >= receivers.length) return false
    receivers.splice(receiverIndex, 1)
  }, stamp)
}

export function moveReceiver(doc, groupId, sectionIndex, receiverIndex, direction, stamp = null) {
  return mutateGroup(doc, groupId, (group) => {
    const receivers = group.sections?.[sectionIndex]?.receivers
    if (!Array.isArray(receivers)) return false
    return moveItem(receivers, receiverIndex, direction) === receiverIndex ? false : undefined
  }, stamp)
}

export function addOption(
  doc, groupId, sectionIndex, receiverIndex, courseIds = [], stamp = null
) {
  return mutateGroup(doc, groupId, (group) => {
    const receiver = group.sections?.[sectionIndex]?.receivers?.[receiverIndex]
    if (!isRecord(receiver)) return false
    if (!Array.isArray(receiver.options)) receiver.options = []
    receiver.options.push(createOption(courseIds))
  }, stamp)
}

export function updateOption(
  doc, groupId, sectionIndex, receiverIndex, optionIndex, patch = {}, stamp = null
) {
  return mutateGroup(doc, groupId, (group) => {
    const options = group.sections?.[sectionIndex]?.receivers?.[receiverIndex]?.options
    if (!Array.isArray(options) || !isRecord(options[optionIndex])) return false
    const changed = { ...options[optionIndex], ...(clone(patch) || {}) }
    options[optionIndex] = createOption(changed.course_ids, changed)
  }, stamp)
}

export function removeOption(
  doc, groupId, sectionIndex, receiverIndex, optionIndex, stamp = null
) {
  return mutateGroup(doc, groupId, (group) => {
    const options = group.sections?.[sectionIndex]?.receivers?.[receiverIndex]?.options
    if (!Array.isArray(options) || optionIndex < 0 || optionIndex >= options.length) return false
    options.splice(optionIndex, 1)
  }, stamp)
}

export function moveOption(
  doc, groupId, sectionIndex, receiverIndex, optionIndex, direction, stamp = null
) {
  return mutateGroup(doc, groupId, (group) => {
    const options = group.sections?.[sectionIndex]?.receivers?.[receiverIndex]?.options
    if (!Array.isArray(options)) return false
    return moveItem(options, optionIndex, direction) === optionIndex ? false : undefined
  }, stamp)
}

export function setOptionCourses(
  doc, groupId, sectionIndex, receiverIndex, optionIndex, courseIds, stamp = null
) {
  return updateOption(
    doc,
    groupId,
    sectionIndex,
    receiverIndex,
    optionIndex,
    { course_ids: courseIds },
    stamp
  )
}

// Convenience transition used by a single course-picker row: one receiver,
// one AND option. Missing first section/receiver rows are created so a newly
// added group can become valid in one picker action.
export function setGroupCourses(
  doc, groupId, sectionIndex, receiverIndex, courseIds, stamp = null
) {
  return mutateGroup(doc, groupId, (group) => {
    if (!Number.isInteger(sectionIndex) || sectionIndex < 0
        || !Number.isInteger(receiverIndex) || receiverIndex < 0) return false
    if (!Array.isArray(group.sections)) group.sections = []
    while (group.sections.length <= sectionIndex) group.sections.push(createSection())
    const section = group.sections[sectionIndex]
    if (!Array.isArray(section.receivers)) section.receivers = []
    while (section.receivers.length <= receiverIndex) section.receivers.push(createReceiver())
    const receiver = createReceiver(section.receivers[receiverIndex])
    const ids = normalizeCourseIds(courseIds)
    receiver.options = ids.length ? [createOption(ids)] : []
    receiver.options_conjunction = 'and'
    section.receivers[receiverIndex] = receiver
    group.units_fill = false
  }, stamp)
}

export const setUnresolvedCourses = (doc, groupId, entries, stamp = null) =>
  updateGroup(doc, groupId, {
    unresolved_courses_seen: Array.isArray(entries) ? clone(entries) : [],
  }, stamp)

export function setDocField(doc, field, value) {
  const next = clone(doc) || {}
  next[field] = clone(value)
  if (field === 'status') {
    if (value === 'found') {
      if (!Array.isArray(next.requirement_groups)) next.requirement_groups = []
    } else {
      delete next.requirement_groups
    }
  }
  return next
}

export function setVerification(doc, verified, stamp = null, at = null) {
  const next = clone(doc) || {}
  const current = isRecord(next.verification) ? next.verification : {}
  const provenance = stampValues(stamp, at)
  next.verification = {
    verified: false,
    verified_by: null,
    verified_at: null,
    notes: null,
    ...current,
    verified: Boolean(verified),
    verified_by: verified ? provenance.by : null,
    verified_at: verified ? provenance.at : null,
  }
  return next
}

// Verification notes are never synthesized. This helper exists only for an
// explicit user-authored value and preserves every other verification key.
export function setVerificationNotes(doc, notes) {
  const next = clone(doc) || {}
  next.verification = {
    verified: false,
    verified_by: null,
    verified_at: null,
    ...(isRecord(next.verification) ? next.verification : {}),
    notes: notes == null || notes === '' ? null : String(notes),
  }
  return next
}

const positiveOrNull = (value) => value == null || (Number.isFinite(value) && value > 0)

export function validateLocal(doc) {
  if (!isRecord(doc)) return ['document is required']
  const errors = []
  const canonicalId = String(doc._id || '')
  const legacyId = String(doc.legacy_id || canonicalId.replace(/^as_degree:/, ''))
  const idMatch = /^(\d+):([a-z0-9_]+)$/.exec(legacyId)
  if (!idMatch) {
    errors.push('row id must look like <community_college_id>:<degree_type>')
  } else {
    const collegeId = Number(idMatch[1])
    if (doc.community_college_id !== collegeId) {
      errors.push('community_college_id must match the numeric part of the row id')
    }
    if (doc.college_id !== `cc:${collegeId}`) errors.push(`college_id must be 'cc:${collegeId}'`)
    if (doc.degree_type !== idMatch[2]) errors.push('degree_type must match the slug part of the row id')
  }
  if (!AS_DEGREE_TYPES.includes(doc.degree_type)) {
    errors.push(`degree_type must be one of ${AS_DEGREE_TYPES.join(', ')}`)
  }
  if (typeof doc.major_slug !== 'string' || !SLUG_RE.test(doc.major_slug)) {
    errors.push('major_slug must be a non-empty slug matching ^[a-z0-9_]+$')
  }
  if (!AS_DEGREE_STATUSES.includes(doc.status)) {
    errors.push(`status must be one of ${AS_DEGREE_STATUSES.join(', ')}`)
  }
  if (doc.verification != null && !isRecord(doc.verification)) {
    errors.push('verification must be an object')
  }
  if (doc.covered_concepts != null
      && (!Array.isArray(doc.covered_concepts)
        || doc.covered_concepts.some((concept) => typeof concept !== 'string'))) {
    errors.push('covered_concepts must be an array of strings')
  }

  if (doc.status !== 'found') {
    if (doc.requirement_groups != null
        && (!Array.isArray(doc.requirement_groups) || doc.requirement_groups.length)) {
      errors.push(`a ${doc.status} row must not carry requirement_groups`)
    }
    return errors
  }

  if (typeof doc.degree_title_seen !== 'string' || !doc.degree_title_seen.trim()) {
    errors.push('degree_title_seen is required on a found row')
  }
  if (typeof doc.catalog_url !== 'string' || !/^https?:\/\//.test(doc.catalog_url)) {
    errors.push('catalog_url must be an http(s) URL')
  }
  if (typeof doc.catalog_year !== 'string' || !doc.catalog_year.trim()) {
    errors.push('catalog_year is required on a found row')
  }
  if (!UNIT_SYSTEMS.includes(doc.unit_system)) {
    errors.push(`unit_system must be one of ${UNIT_SYSTEMS.join(', ')}`)
  }
  if (!Number.isFinite(doc.total_units) || doc.total_units <= 0) {
    errors.push('total_units must be a positive number')
  }
  if (!Array.isArray(doc.requirement_groups) || !doc.requirement_groups.length) {
    errors.push('requirement_groups must be a non-empty array on a found row')
    return errors
  }

  const seenIds = new Set()
  for (const group of doc.requirement_groups) {
    if (!isRecord(group)) {
      errors.push('each group must be an object')
      continue
    }
    const groupId = String(group.group_id || '')
    if (!SLUG_RE.test(groupId)) errors.push('each group needs a group_id matching ^[a-z0-9_]+$')
    if (seenIds.has(groupId)) errors.push(`duplicate group_id: ${groupId}`)
    seenIds.add(groupId)
    if (group.template_group != null && group.template_group !== groupId) {
      errors.push(`group ${groupId}: template_group must equal group_id or be null`)
    }
    if (!AS_DEGREE_SOURCES.includes(group.source)) {
      errors.push(`group ${groupId}: source must be one of ${AS_DEGREE_SOURCES.join(', ')}`)
    }
    if (group.source === 'extracted') {
      if (!Number.isFinite(group.confidence) || group.confidence < 0 || group.confidence > 1) {
        errors.push(`group ${groupId}: an extracted group needs confidence in [0,1]`)
      }
    } else if (group.confidence != null) {
      errors.push(`group ${groupId}: confidence must be null unless source is extracted`)
    }
    if (group.ge_area != null && !GE_AREAS.includes(group.ge_area)) {
      errors.push(`group ${groupId}: ge_area must be one of ${GE_AREAS.join(', ')}`)
    }
    if (group.source === 'template_default') {
      if (group.template_group == null) {
        errors.push(`group ${groupId}: a template_default group needs template_group`)
      }
      if (Array.isArray(group.sections) && group.sections.length) {
        errors.push(`group ${groupId}: a template_default stub must not carry sections`)
      }
      continue
    }
    if (group.units_fill === true) {
      if (Array.isArray(group.sections) && group.sections.length) {
        errors.push(`group ${groupId}: a units_fill group must not have sections`)
      }
      continue
    }
    if (!Array.isArray(group.sections) || !group.sections.length) {
      errors.push(`group ${groupId}: sections must be a non-empty array`)
      continue
    }
    for (const section of group.sections) {
      if (!isRecord(section)) {
        errors.push(`group ${groupId}: each section must be an object`)
        continue
      }
      for (const key of ['section_advisement', 'unit_advisement']) {
        if (!positiveOrNull(section[key])) {
          errors.push(`group ${groupId}: ${key} must be null or a positive number`)
        }
      }
      if (!Array.isArray(section.receivers)) {
        errors.push(`group ${groupId}: each section needs a receivers array`)
        continue
      }
      if (group.ge_area == null && !section.receivers.length) {
        errors.push(`group ${groupId}: a non-ge_area section must list at least one receiver`)
      }
      for (const receiver of section.receivers) {
        if (!isRecord(receiver)) {
          errors.push(`group ${groupId}: each receiver must be an object`)
          continue
        }
        if (receiver.receiving != null) {
          errors.push(`group ${groupId}: receiving must be null on as_degree receivers`)
        }
        if (receiver.articulation_status !== 'articulated') {
          errors.push(`group ${groupId}: articulation_status must be 'articulated'`)
        }
        if (!Array.isArray(receiver.options) || !receiver.options.length) {
          errors.push(`group ${groupId}: each receiver needs at least one option`)
          continue
        }
        for (const option of receiver.options) {
          if (!isRecord(option)) {
            errors.push(`group ${groupId}: each option must be an object`)
            continue
          }
          if (!Array.isArray(option.course_ids) || !option.course_ids.length
              || option.course_ids.some((id) => !Number.isInteger(id))) {
            errors.push(`group ${groupId}: option course_ids must be a non-empty array of Numbers`)
            continue
          }
          if (!Array.isArray(option.course_keys)
              || option.course_keys.length !== option.course_ids.length
              || option.course_keys.some((key, index) => key !== `cc:${option.course_ids[index]}`)) {
            errors.push(`group ${groupId}: course_keys must mirror course_ids as cc:<n>`)
          }
        }
      }
    }
    const unresolved = group.unresolved_courses_seen
    if (unresolved != null && (!Array.isArray(unresolved)
        || unresolved.some((entry) => typeof entry?.course_code_seen !== 'string'))) {
      errors.push(`group ${groupId}: unresolved_courses_seen must be an array of {course_code_seen, ...}`)
    }
  }
  return errors
}
