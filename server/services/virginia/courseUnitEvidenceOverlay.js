const { createHash } = require('node:crypto');
const {
  canonicalCourseCode,
  courseIdFor,
  courseIdentityForNamespace,
  parseCourseKey,
} = require('./courseIdentity');
const { majorCoreHash } = require('./majorCoreIntegrity');

const SCHEMA_VERSION = 1;

// This boundary may copy evidence, never an arbitrary candidate payload. New
// evidence fields must be reviewed here before they can enter a verified doc.
const EVIDENCE_FIELDS = Object.freeze([
  'code',
  'course_id',
  'course_key',
  'institution_id',
  'identity_scope',
  'identity_contract',
  'vccs_master_applicable',
  'units',
  'min_units',
  'max_units',
  'source_refs',
  'source_paths',
  'evidence',
  'unit_sources',
]);
const EVIDENCE_FIELD_SET = new Set(EVIDENCE_FIELDS);

function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function sha256(value) {
  const serialized = JSON.stringify(stable(value)) ?? 'undefined';
  return createHash('sha256').update(serialized).digest('hex');
}

const clone = (value) => structuredClone(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const documentId = (doc) => (
  typeof doc?._id === 'string' && doc._id.trim() ? doc._id.trim() : null
);

function conflict(document_id, path, code, detail = null) {
  return {
    document_id: document_id || null,
    path,
    code,
    ...(detail == null ? {} : { detail: stable(detail) }),
  };
}

function compareConflicts(a, b) {
  return String(a.document_id || '').localeCompare(String(b.document_id || ''))
    || String(a.path).localeCompare(String(b.path))
    || String(a.code).localeCompare(String(b.code))
    || JSON.stringify(a.detail || null).localeCompare(JSON.stringify(b.detail || null));
}

function indexDocuments(rows, role, conflicts) {
  const byId = new Map();
  rows.forEach((doc, index) => {
    const id = documentId(doc);
    if (!id) {
      conflicts.push(conflict(null, `${role}[${index}]._id`, 'document_id_required'));
      return;
    }
    if (byId.has(id)) {
      conflicts.push(conflict(id, `${role}[${index}]._id`, `duplicate_${role}_document`));
      return;
    }
    byId.set(id, doc);
  });
  return byId;
}

function addCourseKey(codes, key) {
  const identity = parseCourseKey(key);
  if (identity) codes.add(identity.code);
}

function addReadableCode(codes, value) {
  const code = canonicalCourseCode(value);
  if (courseIdFor(code) != null) codes.add(code);
}

function walkRequirementTree(value, codes) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry) => walkRequirementTree(entry, codes));
    return;
  }
  if (typeof value.code_seen === 'string') addReadableCode(codes, value.code_seen);
  for (const [key, child] of Object.entries(value)) {
    if ((key === 'course_keys' || key === 'source_course_keys') && Array.isArray(child)) {
      child.forEach((courseKey) => addCourseKey(codes, courseKey));
    } else {
      walkRequirementTree(child, codes);
    }
  }
}

/** Course identities present in the verified canonical or preserved variant trees. */
function referencedCourseCodes(doc) {
  const codes = new Set();
  walkRequirementTree(doc?.requirement_groups || [], codes);
  for (const variant of doc?.requirement_variants || []) {
    walkRequirementTree(variant?.requirement_groups || [], codes);
  }
  return [...codes].sort();
}

function evidenceCode(row) {
  const fromKey = parseCourseKey(row?.course_key)?.code || null;
  const fromCode = canonicalCourseCode(row?.code);
  if (courseIdFor(fromCode) != null) return fromCode;
  return fromKey;
}

function currentSourceIds(doc, id, issues) {
  if (!Array.isArray(doc?.sources)) {
    issues.push(conflict(id, 'current.sources', 'current_sources_required'));
    return new Set();
  }
  const ids = new Set();
  doc.sources.forEach((source, index) => {
    const sourceId = typeof source?.id === 'string' && source.id.trim()
      ? source.id.trim() : null;
    if (!sourceId) {
      issues.push(conflict(id, `current.sources[${index}].id`, 'current_source_id_required'));
    } else if (ids.has(sourceId)) {
      issues.push(conflict(id, `current.sources[${index}].id`, 'duplicate_current_source_id', {
        source_ref: sourceId,
      }));
    } else {
      ids.add(sourceId);
    }
  });
  return ids;
}

function copiedEvidenceRow(row) {
  const out = {};
  for (const key of EVIDENCE_FIELDS) {
    if (!own(row, key)) continue;
    if (key === 'source_refs') {
      out[key] = [...new Set(row[key])].sort();
    } else {
      out[key] = clone(row[key]);
    }
  }
  return out;
}

function identityDifferences(row, expected) {
  const keys = [
    'course_id',
    'course_key',
    'institution_id',
    'identity_scope',
    'identity_contract',
    'vccs_master_applicable',
  ];
  return keys.filter((key) => row?.[key] !== expected?.[key]);
}

function currentUnitConflict(rows, code, candidateUnits) {
  const matching = (rows || []).filter((row) => evidenceCode(row) === code);
  for (const row of matching) {
    const declared = ['units', 'min_units', 'max_units']
      .filter((key) => own(row, key) && row[key] != null)
      .map((key) => row[key]);
    if (!declared.length) continue;
    if (declared.some((value) => (
      typeof value !== 'number' || !Number.isFinite(value) || value <= 0
    ))) {
      return { reason: 'current evidence has a non-positive or non-numeric unit claim' };
    }
    const values = [...new Set(declared)];
    if (values.length !== 1 || values[0] !== candidateUnits) {
      return { current_units: values, candidate_units: candidateUnits };
    }
  }
  return null;
}

function validateCandidateEvidence({ current, candidate, referencedCodes, issues }) {
  const id = current._id;
  const rows = candidate?.course_unit_evidence == null
    ? [] : candidate.course_unit_evidence;
  if (!Array.isArray(rows)) {
    issues.push(conflict(id, 'candidate.course_unit_evidence', 'candidate_evidence_array_required'));
    return { candidateRows: 0, rows: [] };
  }

  const sourceIds = currentSourceIds(current, id, issues);
  const currentRows = Array.isArray(current?.course_unit_evidence)
    ? current.course_unit_evidence : [];
  const referenced = new Set(referencedCodes);
  const seenCodes = new Set();
  const valid = [];

  rows.forEach((row, index) => {
    const path = `candidate.course_unit_evidence[${index}]`;
    const before = issues.length;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      issues.push(conflict(id, path, 'candidate_evidence_object_required'));
      return;
    }

    const unknownFields = Object.keys(row).filter((key) => !EVIDENCE_FIELD_SET.has(key)).sort();
    if (unknownFields.length) {
      issues.push(conflict(id, path, 'candidate_evidence_fields_not_allowed', {
        fields: unknownFields,
      }));
    }

    const canonical = canonicalCourseCode(row.code);
    let expected = null;
    try {
      expected = row.code === canonical
        ? courseIdentityForNamespace(canonical, current.course_namespace ?? null)
        : null;
    } catch (_) {
      expected = null;
    }
    if (!expected) {
      issues.push(conflict(id, `${path}.code`, 'candidate_course_code_or_namespace_invalid', {
        code: row.code ?? null,
      }));
    } else {
      const identityFields = identityDifferences(row, expected);
      if (identityFields.length) {
        issues.push(conflict(id, path, 'candidate_course_identity_mismatch', {
          code: canonical,
          fields: identityFields,
        }));
      }
      if (!referenced.has(canonical)) {
        issues.push(conflict(id, `${path}.code`, 'course_not_referenced_by_current_requirement_tree', {
          code: canonical,
        }));
      }
      if (seenCodes.has(canonical)) {
        issues.push(conflict(id, `${path}.code`, 'duplicate_candidate_course_unit_evidence', {
          code: canonical,
        }));
      }
      seenCodes.add(canonical);
    }

    const exactUnits = typeof row.units === 'number'
      && typeof row.min_units === 'number'
      && typeof row.max_units === 'number'
      && Number.isFinite(row.units)
      && row.units > 0
      && row.units === row.min_units
      && row.units === row.max_units;
    if (!exactUnits) {
      issues.push(conflict(id, path, 'candidate_units_must_be_exact_and_positive', {
        units: row.units ?? null,
        min_units: row.min_units ?? null,
        max_units: row.max_units ?? null,
      }));
    }

    const refs = row.source_refs;
    if (!Array.isArray(refs) || !refs.length
        || refs.some((ref) => typeof ref !== 'string' || !ref.trim())) {
      issues.push(conflict(id, `${path}.source_refs`, 'candidate_source_refs_required'));
    } else {
      const unknownRefs = [...new Set(refs.filter((ref) => !sourceIds.has(ref)))].sort();
      if (unknownRefs.length) {
        issues.push(conflict(id, `${path}.source_refs`, 'candidate_source_refs_not_in_current_sources', {
          source_refs: unknownRefs,
        }));
      }
    }
    if (typeof row.evidence !== 'string' || !row.evidence.trim()) {
      issues.push(conflict(id, `${path}.evidence`, 'candidate_evidence_kind_required'));
    }
    if (own(row, 'source_paths') && (!Array.isArray(row.source_paths)
        || row.source_paths.some((value) => typeof value !== 'string' || !value.trim()))) {
      issues.push(conflict(id, `${path}.source_paths`, 'candidate_source_paths_invalid'));
    }
    if (own(row, 'unit_sources') && (!Array.isArray(row.unit_sources)
        || row.unit_sources.some((value) => !value || typeof value !== 'object' || Array.isArray(value)))) {
      issues.push(conflict(id, `${path}.unit_sources`, 'candidate_unit_sources_invalid'));
    }

    if (expected && exactUnits) {
      const unitsConflict = currentUnitConflict(currentRows, canonical, row.units);
      if (unitsConflict) {
        issues.push(conflict(id, path, 'current_candidate_course_units_conflict', {
          code: canonical,
          ...unitsConflict,
        }));
      }
    }

    if (issues.length === before) valid.push(copiedEvidenceRow(row));
  });

  return {
    candidateRows: rows.length,
    rows: valid.sort((a, b) => a.code.localeCompare(b.code)),
  };
}

function mergeEvidence(currentRows, candidateRows) {
  if (!candidateRows.length) return clone(currentRows);
  const replacements = new Map(candidateRows.map((row) => [row.code, row]));
  const used = new Set();
  const merged = [];
  for (const current of currentRows) {
    const code = evidenceCode(current);
    if (!code || !replacements.has(code)) {
      merged.push(clone(current));
      continue;
    }
    if (!used.has(code)) merged.push(clone(replacements.get(code)));
    used.add(code);
  }
  for (const [code, row] of replacements) {
    if (!used.has(code)) merged.push(clone(row));
  }
  return merged.sort((a, b) => (
    String(evidenceCode(a) || '').localeCompare(String(evidenceCode(b) || ''))
    || sha256(a).localeCompare(sha256(b))
  ));
}

function receiptHash(receipt) {
  const { receipt_sha256: _ignored, ...payload } = receipt;
  return sha256(payload);
}

function sortedDocumentClones(documents) {
  return documents.map(clone).sort((a, b) => (
    String(documentId(a) || '').localeCompare(String(documentId(b) || ''))
    || sha256(a).localeCompare(sha256(b))
  ));
}

/**
 * Prepare a lossless operational evidence overlay without importing candidate
 * curriculum. The result is globally atomic: if any conflict exists, every
 * returned document is an unchanged clone of its current input.
 */
function buildCourseUnitEvidenceOverlay({
  currentDocuments = [],
  candidateDocuments = [],
} = {}) {
  const conflicts = [];
  const currentRows = Array.isArray(currentDocuments) ? currentDocuments : [];
  const candidateRows = Array.isArray(candidateDocuments) ? candidateDocuments : [];
  if (!Array.isArray(currentDocuments)) {
    conflicts.push(conflict(null, 'currentDocuments', 'current_documents_array_required'));
  }
  if (!Array.isArray(candidateDocuments)) {
    conflicts.push(conflict(null, 'candidateDocuments', 'candidate_documents_array_required'));
  }

  const currentById = indexDocuments(currentRows, 'current', conflicts);
  const candidateById = indexDocuments(candidateRows, 'candidate', conflicts);
  for (const id of candidateById.keys()) {
    if (!currentById.has(id)) {
      conflicts.push(conflict(id, 'candidate._id', 'candidate_document_has_no_current_document'));
    }
  }

  const proposals = [];
  for (const id of [...currentById.keys()].sort()) {
    const current = currentById.get(id);
    const candidate = candidateById.get(id);
    const localIssues = conflicts.filter((entry) => entry.document_id === id);
    if (!candidate) {
      const missing = conflict(id, 'candidate', 'candidate_document_missing');
      conflicts.push(missing);
      localIssues.push(missing);
    }

    const currentClone = clone(current);
    const referencedCodes = referencedCourseCodes(current);
    let candidateEvidenceRows = 0;
    let validEvidence = [];
    if (candidate) {
      if (sha256(current.course_namespace ?? null) !== sha256(candidate.course_namespace ?? null)) {
        const mismatch = conflict(id, 'candidate.course_namespace', 'course_namespace_mismatch');
        conflicts.push(mismatch);
        localIssues.push(mismatch);
      } else {
        const validationIssues = [];
        const validation = validateCandidateEvidence({
          current,
          candidate,
          referencedCodes,
          issues: validationIssues,
        });
        candidateEvidenceRows = validation.candidateRows;
        validEvidence = validation.rows;
        conflicts.push(...validationIssues);
        localIssues.push(...validationIssues);
      }
    }

    let proposed = currentClone;
    if (!localIssues.length && validEvidence.length) {
      proposed = clone(current);
      const existing = Array.isArray(current.course_unit_evidence)
        ? current.course_unit_evidence : [];
      proposed.course_unit_evidence = mergeEvidence(existing, validEvidence);
    }
    const currentCoreHash = majorCoreHash(current);
    const proposedCoreHash = majorCoreHash(proposed);
    if (currentCoreHash !== proposedCoreHash) {
      const changed = conflict(id, 'proposed', 'major_core_changed_by_evidence_overlay', {
        current_major_core_sha256: currentCoreHash,
        proposed_major_core_sha256: proposedCoreHash,
      });
      conflicts.push(changed);
      localIssues.push(changed);
      proposed = currentClone;
    }

    proposals.push({
      id,
      current: currentClone,
      candidate: candidate ? clone(candidate) : null,
      proposed,
      referencedCodes,
      candidateEvidenceRows,
      validEvidence,
      localIssues,
    });
  }

  conflicts.sort(compareConflicts);
  const ready = conflicts.length === 0;
  // On failure retain every current row, including malformed/duplicate-id
  // rows that could not receive a per-document proposal. This service never
  // turns an input defect into an in-memory deletion.
  const documents = ready
    ? proposals.map((proposal) => clone(proposal.proposed))
    : sortedDocumentClones(currentRows);
  const receipts = proposals.map((proposal, index) => {
    const output = ready ? documents[index] : proposal.current;
    const currentEvidence = proposal.current.course_unit_evidence ?? null;
    const candidateEvidence = proposal.candidate?.course_unit_evidence ?? null;
    const proposedEvidence = proposal.proposed.course_unit_evidence ?? null;
    const outputEvidence = output.course_unit_evidence ?? null;
    const currentCoreHash = majorCoreHash(proposal.current);
    const proposedCoreHash = majorCoreHash(proposal.proposed);
    const outputCoreHash = majorCoreHash(output);
    const ownConflicts = conflicts.filter((entry) => entry.document_id === proposal.id);
    const changed = sha256(proposal.current) !== sha256(proposal.proposed);
    const status = ownConflicts.length
      ? 'conflict'
      : !ready ? 'withheld_due_to_report_conflicts'
        : changed ? 'applied' : 'no_change';
    const receipt = {
      schema_version: SCHEMA_VERSION,
      document_id: proposal.id,
      status,
      overlay_applied: status === 'applied',
      current_document_sha256: sha256(proposal.current),
      candidate_document_sha256: proposal.candidate ? sha256(proposal.candidate) : null,
      proposed_document_sha256: sha256(proposal.proposed),
      output_document_sha256: sha256(output),
      current_major_core_sha256: currentCoreHash,
      candidate_major_core_sha256: proposal.candidate
        ? majorCoreHash(proposal.candidate) : null,
      proposed_major_core_sha256: proposedCoreHash,
      output_major_core_sha256: outputCoreHash,
      candidate_core_matches_current: proposal.candidate
        ? majorCoreHash(proposal.candidate) === currentCoreHash : null,
      proposed_major_core_unchanged: proposedCoreHash === currentCoreHash,
      output_major_core_unchanged: outputCoreHash === currentCoreHash,
      current_evidence_sha256: sha256(currentEvidence),
      candidate_evidence_sha256: sha256(candidateEvidence),
      proposed_evidence_sha256: sha256(proposedEvidence),
      output_evidence_sha256: sha256(outputEvidence),
      referenced_course_codes_sha256: sha256(proposal.referencedCodes),
      referenced_course_code_count: proposal.referencedCodes.length,
      candidate_evidence_rows: proposal.candidateEvidenceRows,
      validated_evidence_rows: proposal.validEvidence.length,
      applied_evidence_rows: status === 'applied' ? proposal.validEvidence.length : 0,
      validated_codes: proposal.validEvidence.map((row) => row.code),
      applied_codes: status === 'applied' ? proposal.validEvidence.map((row) => row.code) : [],
      conflict_count: ownConflicts.length,
    };
    receipt.receipt_sha256 = receiptHash(receipt);
    return receipt;
  });

  const counts = {
    current_documents: currentRows.length,
    candidate_documents: candidateRows.length,
    output_documents: documents.length,
    receipts: receipts.length,
    candidate_evidence_rows: proposals.reduce((sum, row) => sum + row.candidateEvidenceRows, 0),
    validated_evidence_rows: proposals.reduce((sum, row) => sum + row.validEvidence.length, 0),
    applied_evidence_rows: receipts.reduce((sum, row) => sum + row.applied_evidence_rows, 0),
    conflicts: conflicts.length,
  };
  const reportPayload = {
    schema_version: SCHEMA_VERSION,
    ready,
    counts,
    conflicts,
    receipts,
    output_documents_sha256: sha256(documents),
  };
  return {
    ...reportPayload,
    documents,
    report_sha256: sha256(reportPayload),
  };
}

module.exports = {
  EVIDENCE_FIELDS,
  SCHEMA_VERSION,
  buildCourseUnitEvidenceOverlay,
  evidenceOverlaySha256: sha256,
  referencedCourseCodes,
};
