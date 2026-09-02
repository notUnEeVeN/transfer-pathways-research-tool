const { createHash } = require('node:crypto');
const { parseCourseKey } = require('./courseIdentity');

/**
 * Content a researcher verifies when signing a Virginia degree record.
 *
 * Projection ids, parser receipts, source hashes, course-title caches, and
 * acceptance/verification state are deliberately outside this object. They
 * may be regenerated while moving the same requirements into a shared schema.
 * Courses, choices, units, conjunctions, degree policy, and authored
 * constraints remain inside it and therefore cannot move in a batch cleanup.
 */
const CORE_FIELDS = Object.freeze([
  'kind',
  'institution_id',
  'community_college_id',
  'college_id',
  'program',
  'degree_title_seen',
  'degree_type',
  'degree_variant',
  'academic_unit',
  'college',
  'catalog_year',
  'unit_system',
  // The namespace determines whether a readable course code is VCCS-shared
  // or owned by one institution.  Keep that authored distinction immutable,
  // while allowing stale numeric/key wrappers to be reminted to comply with
  // an already-verified namespace.
  'course_namespace',
  'total_units',
  'total_units_max',
  'requirement_groups',
  // Alternate maps are still verified curricular content. In particular, a
  // later projection may promote `selected: true`, so their courses and
  // policy cannot sit outside the signed major even while inactive today.
  'requirement_variants',
  'option_sets',
  'analysis_constraints',
  'non_course_requirements_seen',
  'unit_audit',
  'published_unit_audit',
  'requirement_layers',
  'ge_authority',
  'ge_model',
  'ge_variants',
]);

/**
 * Known top-level fields that are evidence, provenance, display caches, or
 * mutable release receipts rather than the signed curricular tree.
 *
 * This is intentionally an allowlist. A newly introduced top-level field is
 * protected until it is explicitly reviewed and classified here; otherwise a
 * future `transfer_unit_cap`/`analysis_constraints`-style policy could bypass
 * the guard simply because CORE_FIELDS had not learned its name yet.
 */
const NON_CORE_TOP_LEVEL_FIELDS = new Set([
  '_id',
  'acceptance',
  'campus_key',
  'capture_layers',
  'catalog_platform',
  'catalog_url',
  'codes_seen',
  'collection_status',
  'course_titles',
  'course_unit_evidence',
  'covered_concepts',
  'created_at',
  'curated_at',
  'curated_by',
  'data_quality_flags',
  'extraction',
  'institution_course_catalog',
  'legacy_id',
  'major_slug',
  'modeling_notes',
  'offers_cs',
  'provenance',
  'research_status',
  'school',
  'school_id',
  'source',
  'source_method',
  'source_url',
  'sources',
  'status',
  'template_ref',
  'updated_at',
  'verification',
]);

const RECEIPT_KEYS = new Set([
  '_id',
  'group_id',
  'section_id',
  'hash_id',
  'source_refs',
  'curated_at',
  'curated_by',
  // These are regenerated summaries on requirement variants, just as they
  // are at document level. The underlying course keys remain protected.
  'codes_seen',
  'course_titles',
]);

// Both labels are historical evaluator-capability receipts. The analysis gate
// deliberately accepts either only when the checked-out evaluator proves the
// exact constraint shape, so moving between them changes no source policy.
const EQUIVALENT_EVALUATOR_STATUSES = new Set([
  'supported',
  'evaluator_not_implemented',
]);

function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function semanticTree(value, { receiverCode = null, constraintEntry = false } = {}) {
  if (Array.isArray(value)) {
    return value.map((entry) => semanticTree(entry, { receiverCode, constraintEntry }));
  }
  if (!value || typeof value !== 'object') return value;

  const localReceiverCode = typeof value.code_seen === 'string' && value.code_seen.trim()
    ? value.code_seen.trim() : receiverCode;
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (RECEIPT_KEYS.has(key)) continue;
    if (constraintEntry && key === 'status') {
      const normalized = String(value[key] || '').trim().toLowerCase();
      if (EQUIVALENT_EVALUATOR_STATUSES.has(normalized)) {
        result[key] = 'evaluator_capability_receipt';
        continue;
      }
    }
    // Numeric ids are projection mechanics when the same option carries its
    // stable source key. A standardization may remint ids, never source keys.
    if (key === 'course_ids' && Array.isArray(value.course_keys) && value.course_keys.length) continue;
    // A source key carries two facts: readable course code and identity
    // namespace.  The document-level `course_namespace` above protects the
    // latter. Compare the former here, so correcting legacy `va:CODE` wrappers
    // to `va:cc:<owner>:CODE` is standardization while CODE -> OTHER remains a
    // protected curriculum change. Unknown keys are retained verbatim and
    // therefore continue to fail closed.
    if (key === 'course_keys' && Array.isArray(value.course_keys)) {
      result[key] = value.course_keys.map((courseKey) => (
        parseCourseKey(courseKey)?.code || courseKey
      ));
      continue;
    }
    // Receiving-course ids are likewise derived from the retained catalog
    // code on the enclosing receiver.
    if ((key === 'parent_id' || key === 'parent_ids') && localReceiverCode) continue;
    if (key === 'analysis_constraints' && Array.isArray(value[key])) {
      result[key] = value[key].map((constraint) => semanticTree(constraint, {
        constraintEntry: true,
      }));
    } else {
      result[key] = semanticTree(value[key], {
        receiverCode: key === 'receiving' ? localReceiverCode : null,
      });
    }
  }
  return result;
}

function majorCoreMaterial(doc = {}) {
  const selected = {};
  // Known core fields document the current schema. Unknown top-level fields
  // also fail closed unless explicitly classified as non-core above.
  const protectedFields = new Set([
    ...CORE_FIELDS,
    ...Object.keys(doc).filter((field) => !NON_CORE_TOP_LEVEL_FIELDS.has(field)),
  ]);
  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(doc, field)) {
      selected[field] = field === 'analysis_constraints' && Array.isArray(doc[field])
        ? doc[field].map((constraint) => semanticTree(constraint, { constraintEntry: true }))
        : semanticTree(doc[field]);
    }
  }
  return stable(selected);
}

function majorCoreHash(doc) {
  return createHash('sha256')
    .update(JSON.stringify(majorCoreMaterial(doc)))
    .digest('hex');
}

function verifiedCoreConflict(prior, next) {
  return prior?.verification?.verified === true
    && majorCoreHash(prior) !== majorCoreHash(next);
}

module.exports = {
  CORE_FIELDS,
  majorCoreHash,
  majorCoreMaterial,
  verifiedCoreConflict,
};
