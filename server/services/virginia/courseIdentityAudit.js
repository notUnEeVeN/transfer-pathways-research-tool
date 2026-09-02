/**
 * Read-only publication preflight for Virginia sending-course identities.
 *
 * The figure engine joins requirement citations to `assist_courses` by numeric
 * id.  This audit deliberately requires the key, owner, and scope contract as
 * well, so a same-code row from another institution cannot turn an unresolved
 * citation into an apparently complete requirement.
 */
const {
  canonicalCourseCode,
  courseIdentityForNamespace,
  courseRowMatchesIdentity,
  parseCourseKey,
} = require('./courseIdentity');

function requirementCourseReferences(doc) {
  const references = [];
  const numericOwner = [doc?.community_college_id, doc?.college_id]
    .map(Number).find(Number.isFinite);
  const trees = [{ groups: doc?.requirement_groups || [], path: 'requirement_groups' }];
  (doc?.requirement_variants || []).forEach((variant, variantIndex) => {
    trees.push({
      groups: variant?.requirement_groups || [],
      path: `requirement_variants[${variantIndex}].requirement_groups`,
    });
  });
  trees.forEach((tree) => tree.groups.forEach((group, gi) => {
    (group?.sections || []).forEach((section, si) => {
      (section?.receivers || []).forEach((receiver, ri) => {
        (receiver?.options || []).forEach((option, oi) => {
          const ids = option?.course_ids || [];
          // The shared curated-requirements schema mirrors numeric ids as
          // `cc:<id>`. Virginia's source identity is therefore retained in
          // `source_course_keys` at the projection boundary. Audit that
          // canonical source key when present; `cc:<id>` alone cannot prove
          // VCCS-vs-institution scope or distinguish a hash collision.
          const keys = option?.source_course_keys ?? option?.course_keys ?? [];
          const length = Math.max(ids.length, keys.length);
          for (let ci = 0; ci < length; ci += 1) {
            references.push({
              document_id: doc?._id ?? null,
              source_document_id: doc?.va_requirement_id ?? doc?._id ?? null,
              owner_id: numericOwner
                ?? doc?.college_id ?? doc?.community_college_id ?? null,
              college_name: doc?.college_name ?? null,
              path: `${tree.path}[${gi}].sections[${si}].receivers[${ri}].options[${oi}].course_ids[${ci}]`,
              course_id: ids[ci] ?? null,
              course_key: keys[ci] ?? null,
              namespace: doc?.course_namespace || null,
            });
          }
        });
      });
    });
  }));
  return references;
}

const compactRow = (row) => ({
  _id: row?._id ?? null,
  code: row?.code ?? null,
  course_id: row?.course_id ?? null,
  course_key: row?.course_key ?? null,
  institution_id: row?.institution_id ?? null,
  identity_scope: row?.identity_scope ?? null,
  identity_contract: row?.identity_contract ?? null,
  vccs_master_applicable: row?.vccs_master_applicable ?? null,
  units: row?.units ?? null,
  min_units: row?.min_units ?? null,
  max_units: row?.max_units ?? null,
  units_by_source_requirement: Array.isArray(row?.units_by_source_requirement)
    ? row.units_by_source_requirement.length : 0,
});

function ownerOffersSharedCourse(row, reference) {
  if (Array.isArray(row?.source_requirement_ids)
      && row.source_requirement_ids.includes(reference.document_id)) return true;
  const ownerNumeric = Number(reference.owner_id);
  if (Array.isArray(row?.offered_by_ids) && Number.isFinite(ownerNumeric)) {
    return row.offered_by_ids.map(Number).includes(ownerNumeric);
  }
  if (Array.isArray(row?.offered_by) && reference.college_name) {
    return row.offered_by.includes(reference.college_name);
  }
  // Absence is not evidence that the degree owner offers the course. Failing
  // closed here prevents a statewide same-code row from filling a real local
  // supply gap merely because no `offered_by` metadata was collected.
  return false;
}

function sourceSpecificUnitRow(row, reference) {
  const matches = (row?.units_by_source_requirement || []).filter((entry) => (
    entry?.source_requirement_id === reference?.source_document_id
  ));
  // Multiple rows for one source are contradictory even if their current
  // values happen to agree; the projection contract permits one exact witness.
  if (matches.length > 1) return null;
  return matches[0] || row;
}

function hasDeterministicUnits(row, reference) {
  const selected = sourceSpecificUnitRow(row, reference);
  if (!selected) return false;
  const values = [selected?.units, selected?.min_units, selected?.max_units].map(Number);
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return false;
  return values.every((value) => Math.abs(value - values[0]) <= 0.000001);
}

function auditCourseIdentityResolution(degreeDocuments = [], courseRows = []) {
  const byId = new Map();
  const byKey = new Map();
  const byCode = new Map();
  const add = (map, key, row) => {
    if (key == null) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  };
  for (const row of courseRows || []) {
    add(byId, Number(row?.course_id), row);
    add(byKey, row?.course_key, row);
    const parsed = parseCourseKey(row?.course_key);
    const code = canonicalCourseCode(row?.code || parsed?.code);
    if (code) add(byCode, code, row);
  }

  const references = (degreeDocuments || []).flatMap(requirementCourseReferences);
  const issues = [];
  const resolved = [];
  for (const reference of references) {
    const parsed = parseCourseKey(reference.course_key);
    if (!parsed) {
      issues.push({ ...reference, code: null, issue: 'invalid_course_key' });
      continue;
    }
    let expected;
    try {
      expected = courseIdentityForNamespace(parsed.code, reference.namespace);
    } catch (error) {
      issues.push({ ...reference, code: parsed.code, issue: 'invalid_namespace', detail: error.message });
      continue;
    }
    if (Number(reference.course_id) !== expected.course_id
        || reference.course_key !== expected.course_key) {
      issues.push({
        ...reference,
        code: parsed.code,
        issue: 'reference_scope_mismatch',
        expected: compactRow(expected),
      });
      continue;
    }

    const exact = (byId.get(expected.course_id) || []).filter((row) => (
      row.course_key === expected.course_key
    ));
    const scoped = exact.filter((row) => courseRowMatchesIdentity(row, expected));
    if (scoped.length !== 1) {
      const candidates = [...new Set([
        ...(byId.get(expected.course_id) || []),
        ...(byKey.get(expected.course_key) || []),
        ...(byCode.get(expected.code) || []),
      ])];
      issues.push({
        ...reference,
        code: expected.code,
        issue: scoped.length > 1
          ? 'duplicate_scoped_course_rows'
          : candidates.length ? 'course_row_scope_mismatch' : 'course_row_missing',
        expected: compactRow(expected),
        candidates: candidates.map(compactRow),
      });
      continue;
    }
    const [row] = scoped;
    if (expected.identity_scope === 'vccs_shared' && !ownerOffersSharedCourse(row, reference)) {
      issues.push({
        ...reference,
        code: expected.code,
        issue: 'course_not_offered_by_degree_owner',
        expected: compactRow(expected),
        candidates: [compactRow(row)],
      });
      continue;
    }
    if (!hasDeterministicUnits(row, reference)) {
      issues.push({
        ...reference,
        code: expected.code,
        issue: 'course_units_missing_or_ambiguous',
        expected: compactRow(expected),
        candidates: [compactRow(row)],
      });
      continue;
    }
    const unitRow = sourceSpecificUnitRow(row, reference);
    resolved.push({
      ...reference,
      code: expected.code,
      row_id: row._id ?? null,
      units: Number(unitRow.units),
      unit_source_requirement_id: unitRow === row
        ? null : unitRow.source_requirement_id,
    });
  }

  const issueCounts = issues.reduce((counts, issue) => {
    counts[issue.issue] = (counts[issue.issue] || 0) + 1;
    return counts;
  }, {});
  return {
    publication_ready: issues.length === 0,
    stats: {
      documents: (degreeDocuments || []).length,
      course_rows: (courseRows || []).length,
      references: references.length,
      resolved: resolved.length,
      issues: issues.length,
      issue_counts: issueCounts,
    },
    issues,
    resolved,
  };
}

module.exports = {
  requirementCourseReferences,
  auditCourseIdentityResolution,
};
