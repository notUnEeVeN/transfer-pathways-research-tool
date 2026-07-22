const asPositiveId = (value) => {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function canonicalSchoolIds(values = []) {
  return [...new Set(values.map(asPositiveId).filter((value) => value != null))]
    .sort((a, b) => a - b)
}

export function snapshotSchoolIds(snapshot = {}) {
  const supplied = snapshot.school_ids
    || snapshot.campus_ids
    || snapshot.campus_order
    || snapshot.campuses?.map((campus) => campus.school_id)
    || snapshot.programs?.map((program) => program.school_id)
    || []
  return supplied.map(asPositiveId).filter((value) => value != null)
}

/**
 * Combinations are stored under a nine-bit mask. Bit positions follow the
 * artifact's explicit school order; they do not depend on the order in which
 * a visitor selected campus buttons.
 */
export function combinationMask(snapshot, selectedIds) {
  const ordered = snapshotSchoolIds(snapshot)
  const position = new Map(ordered.map((id, index) => [id, index]))
  const selected = canonicalSchoolIds(selectedIds)
  if (!selected.length || selected.some((id) => !position.has(id))) return null
  return selected.reduce((mask, id) => mask + (2 ** position.get(id)), 0)
}

function setPath(target, path, value) {
  const parts = String(path).split('.')
  let cursor = target
  parts.forEach((part, index) => {
    if (index === parts.length - 1) cursor[part] = value
    else {
      cursor[part] ||= {}
      cursor = cursor[part]
    }
  })
}

function materializeTuple(tuple, fields = []) {
  if (!Array.isArray(tuple)) return tuple
  const row = {}
  fields.forEach((field, index) => setPath(row, field, tuple[index]))
  return row
}

function collegeByReference(snapshot, row, alignedIndex) {
  const colleges = snapshot.colleges || []
  const rawIndex = row.college_index
  const byIndex = Number.isInteger(Number(rawIndex))
    ? colleges[Number(rawIndex)]
    : colleges[alignedIndex]
  const rawId = Number(row.community_college_id)
  const byId = Number.isFinite(rawId)
    ? colleges.find((college) => Number(college.source_id ?? college.id ?? college.community_college_id) === rawId)
    : null
  const college = byIndex || byId
  if (!college) return row
  return {
    ...row,
    community_college_id: row.community_college_id
      ?? college.source_id ?? college.id ?? college.community_college_id,
    community_college: row.community_college
      || college.name || college.community_college,
    unit_system: row.unit_system || college.unit_system || college.calendar,
  }
}

function materializeRows(snapshot, entry, schoolIds) {
  const fields = entry.row_fields || snapshot.row_fields || []
  const campusPositions = new Map(snapshotSchoolIds(snapshot)
    .map((schoolId, index) => [schoolId, index]))
  const campusById = new Map((snapshot.campuses || snapshot.programs || [])
    .map((campus) => [Number(campus.school_id), campus]))
  const warningDictionary = snapshot.warnings || []
  return (entry.rows || []).map((raw, index) => {
    const compact = materializeTuple(raw, fields)
    const strictMask = Number(compact.strict_complete_mask) || 0
    const warningIndices = compact.warning_indices || []
    const warnings = compact.warnings || warningIndices
      .map((warningIndex) => warningDictionary[Number(warningIndex)])
      .filter(Boolean)
    return collegeByReference(snapshot, {
      ...compact,
      warnings,
      campuses: schoolIds.map((schoolId) => {
        const campus = campusById.get(Number(schoolId)) || { school_id: schoolId }
        const position = campusPositions.get(Number(schoolId))
        const complete = position != null && (strictMask & (2 ** position)) !== 0
        return {
          ...campus,
          strict_complete: complete,
          fully_satisfiable: complete,
        }
      }),
    }, index)
  })
}

/**
 * Turns one compact snapshot combination back into the response shape already
 * consumed by MultiCampusPathways. Keeping this boundary pure lets the page
 * change storage formats without duplicating any statistics in React.
 */
export function materializeAverageSnapshot(snapshot, selectedIds, requestedProfileId = null) {
  if (!snapshot) return null
  const schoolIds = canonicalSchoolIds(selectedIds)
  const mask = combinationMask(snapshot, schoolIds)
  if (mask == null) return null
  const profileId = requestedProfileId || snapshot.default_load_profile
  const profile = snapshot.load_profiles?.[profileId] || null
  const combinations = profile?.combinations || snapshot.combinations || snapshot.results || {}
  const entry = combinations[String(mask)]
    || combinations[mask]
    || combinations[schoolIds.join(',')]
  if (!entry) return null
  const payload = entry.data || entry.result || entry
  const selected = new Set(schoolIds)
  const programs = payload.programs
    || (snapshot.campuses || snapshot.programs || [])
      .filter((program) => selected.has(Number(program.school_id)))
  const globalWarnings = payload.warnings || (snapshot.global_warning_indices || [])
    .map((warningIndex) => snapshot.warnings?.[Number(warningIndex)])
    .filter(Boolean)

  return {
    ...payload,
    method: payload.method || snapshot.method,
    warnings: globalWarnings,
    programs,
    rows: materializeRows(snapshot, payload, schoolIds),
    snapshot: {
      schema_version: snapshot.schema_version ?? snapshot.version ?? null,
      generated_at: snapshot.generated_at || snapshot.created_at || null,
      profile_id: profileId,
      semester_load: profile?.semester_load ?? snapshot.semester_load
        ?? snapshot.params?.semester_load ?? snapshot.loads?.semester ?? null,
      quarter_load: profile?.quarter_load ?? snapshot.quarter_load
        ?? snapshot.params?.quarter_load ?? snapshot.loads?.quarter ?? null,
      combination_mask: mask,
    },
  }
}
