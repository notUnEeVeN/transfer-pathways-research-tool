const positiveInt = (value, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const unique = (values) => [...new Set(values.filter((value) => value != null && value !== ''))]

const newHashId = (kind) => {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `degree-editor:${kind}:${id}`
}

const receiverWithoutDisplayFields = (receiver = {}) => {
  const { category_match: _categoryMatch, ...stored } = receiver || {}
  return stored
}

export const DEGREE_TIERS = [
  { value: 'transferable', label: 'Major preparation' },
  { value: 'breadth', label: 'Breadth / general education' },
  { value: 'nontransferable', label: 'At the university' },
]

export const SECTION_TYPES = [
  { value: 'courses', label: 'Specific UC courses' },
  { value: 'ge_area', label: 'Breadth course category' },
  { value: 'assumed', label: 'Generally available at CCs' },
  { value: 'university', label: 'Completed at the university' },
]

export function cloneDegreeDocument(document) {
  return document ? JSON.parse(JSON.stringify(document)) : null
}

export function createDegreeDocument({
  schoolId,
  school,
  campusKey = null,
  majorSlug,
  defaultProgram = '',
}) {
  const id = Number(schoolId)
  const slug = String(majorSlug || '').trim()
  return {
    _id: slug ? `degree:${id}:${slug}` : `degree:${id}`,
    legacy_id: slug ? `${id}:${slug}` : String(id),
    kind: 'degree',
    institution_id: `uc:${id}`,
    school_id: id,
    school: school || `UC campus ${id}`,
    ...(slug ? { major_slug: slug } : {}),
    program: defaultProgram,
    total_units: null,
    source_url: '',
    requirement_groups: [],
    source: 'hand_curated_degree',
    ...(campusKey ? { campus_key: campusKey } : {}),
  }
}

export function createDegreeGroup() {
  return {
    is_required: true,
    group_conjunction: 'And',
    title: 'New requirement group',
    tier: 'transferable',
    sections: [],
  }
}

export function createSectionDraft(tier = 'transferable') {
  return tier === 'nontransferable'
    ? {
        type: 'university', required: 1, courseIds: [], code: '',
        description: '', geAreas: '', units: '',
      }
    : {
        type: 'courses', required: 1, courseIds: [], code: '',
        description: '', geAreas: '', units: '',
      }
}

export function degreeSectionType(section = {}) {
  const receivers = section.receivers || []
  const kinds = new Set(receivers.map((receiver) => receiver.receiving?.kind).filter(Boolean))
  if (kinds.has('course')) return 'courses'
  if (kinds.has('ge_area')) {
    return section.assume_satisfiable || receivers.some((receiver) => receiver.assume_satisfiable)
      ? 'assumed'
      : 'ge_area'
  }
  return 'university'
}

export function sectionToDraft(section = {}, tier = 'transferable') {
  const type = degreeSectionType(section)
  const receivers = section.receivers || []
  const first = receivers[0] || {}
  const areaValues = unique([
    ...(section.ge_areas || []),
    ...receivers.flatMap((receiver) => receiver.ge_areas || []),
  ])
  return {
    type,
    required: positiveInt(section.section_advisement, type === 'university' ? receivers.length || 1 : 1),
    courseIds: type === 'courses'
      ? unique(receivers.map((receiver) => receiver.receiving?.parent_id))
      : [],
    code: first.receiving?.code || '',
    description: first.receiving?.name || (type === 'university' ? first.receiving?.name : '') || '',
    geAreas: areaValues.join(', '),
    units: section.unit_advisement ?? '',
    tier,
  }
}

function baseReceiver(existing, receiving, tier, kind) {
  return {
    ...receiverWithoutDisplayFields(existing),
    receiving,
    articulation_status: null,
    not_articulated_reason: null,
    options: [],
    options_conjunction: 'or',
    hash_id: existing?.hash_id || newHashId(kind),
    tier,
  }
}

export function sectionFromDraft(form, { original = {}, tier = 'transferable', coursesById = new Map() } = {}) {
  const type = form.type || 'courses'
  const required = positiveInt(form.required)
  const geAreas = unique(String(form.geAreas || '').split(',').map((area) => area.trim()))
  const oldReceivers = original.receivers || []
  let receivers = []

  if (type === 'courses') {
    receivers = unique(form.courseIds || []).map((rawId) => {
      const numeric = Number(rawId)
      const parentId = Number.isFinite(numeric) ? numeric : rawId
      const course = coursesById.get(String(parentId)) || coursesById.get(parentId) || {}
      const existing = oldReceivers.find((receiver) => String(receiver.receiving?.parent_id) === String(parentId))
      const receiver = baseReceiver(existing, {
        kind: 'course',
        parent_id: parentId,
        units: course.max_units ?? course.min_units ?? course.units ?? existing?.receiving?.units ?? null,
      }, tier, 'course')
      if (geAreas.length) receiver.ge_areas = geAreas
      else delete receiver.ge_areas
      return receiver
    })
  } else if (type === 'ge_area' || type === 'assumed') {
    const existing = oldReceivers.find((receiver) => receiver.receiving?.kind === 'ge_area')
    const assumed = type === 'assumed'
    const receiver = baseReceiver(existing, {
      kind: 'ge_area',
      code: String(form.code || (assumed ? 'REQ' : 'GE')).trim(),
      name: String(form.description || '').trim(),
      parent_id: null,
      units: null,
    }, tier, 'ge-area')
    receiver.ge_areas = assumed ? [] : geAreas
    receiver.assume_satisfiable = assumed
    receivers = [receiver]
  } else {
    const description = String(form.description || '').trim() || 'Complete at the university'
    receivers = Array.from({ length: required }, (_, index) => {
      const existing = oldReceivers[index]?.receiving?.kind === 'requirement' ? oldReceivers[index] : null
      return baseReceiver(existing, {
        kind: 'requirement', parent_id: null, units: null, name: description,
      }, tier, 'university')
    })
  }

  // Authored units (a stated unit rule like a 20-unit upper-division block)
  // survive edits; for at-the-university sections the field is editable.
  const draftUnits = Number(form.units)
  const section = {
    ...original,
    section_advisement: required,
    unit_advisement: type === 'university'
      ? (Number.isFinite(draftUnits) && draftUnits > 0 ? draftUnits : null)
      : original.unit_advisement ?? null,
    tier,
    receivers,
  }
  delete section.category_match
  delete section.ge_areas
  delete section.assume_satisfiable
  if (type === 'courses' && geAreas.length) section.ge_areas = geAreas
  if (type === 'ge_area') section.ge_areas = geAreas
  if (type === 'assumed') section.assume_satisfiable = true
  return section
}

export function setDegreeGroupTier(group, tier) {
  return {
    ...group,
    tier,
    sections: (group.sections || []).map((section) => ({
      ...section,
      tier,
      receivers: (section.receivers || []).map((receiver) => ({ ...receiver, tier })),
    })),
  }
}

export function moveItem(items, from, to) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = items.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function validateDegreeDocument(document) {
  if (!String(document?.program || '').trim()) return 'Program name is required.'
  const groups = document?.requirement_groups || []
  if (!groups.length) return 'Add at least one requirement group.'
  for (const group of groups) {
    if (!String(group.title || '').trim()) return 'Every requirement group needs a title.'
    if (!(group.sections || []).length) return `${group.title} needs at least one requirement.`
    for (const section of group.sections || []) {
      if (degreeSectionType(section) === 'courses' && !(section.receivers || []).length) {
        return `${group.title} has a course requirement with no UC courses selected.`
      }
    }
  }
  return null
}
