/**
 * Fail-closed publication audit for the Virginia figure corpus.
 *
 * Collection, projection, and publication are deliberately separate states:
 * an official catalog document can be useful research evidence without being
 * safe to turn into a figure cell.  This module keeps that distinction
 * machine-readable and checks that the projection did not lose any of the
 * source requirement tree on the way to the shared analysis collections.
 */

const { createHash } = require('node:crypto');
const { majorCoreHash } = require('./majorCoreIntegrity');

const EXPECTED_PRIMARY_COHORT = Object.freeze({
  extracted_source_records: 42,
  alternate_source_records: 5,
  associate_degrees: 19,
  bachelor_degrees: 18,
  active_bachelor_templates: 16,
  agreement_cells: 304,
});
const PAPER_FIGURES = Object.freeze(['1', '3', '4', '6']);
const ASSOCIATE_SOURCE_DISPOSITION_CONTRACT =
  'va-associate-source-disposition-v1';
const {
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
} = require('../analysis/fourYearConstraints');
const {
  auditAssociateAnalysisQualityFlags,
  auditAssociateDocument,
} = require('../analysis/associateFigureConstraints');
const { auditCanonicalProjection } = require('../analysis/canonicalProjectionAudit');
const { getMajor, programPairs } = require('../../config/majors');
const {
  institutionIdentityById,
  institutionIdentityBySlug,
} = require('./institutionIds');
const {
  unavailableVirginiaFigure6PrerequisiteReport,
} = require('./pathwayComplexityPrerequisites');
const { parseCourseKey } = require('./courseIdentity');
const {
  bachelorRequirementCapacityProjectionProof,
} = require('./bachelorRequirementCapacityEvidence');

const text = (value) => typeof value === 'string' && value.trim().length > 0;

function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function same(a, b) {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

function walk(value, visitor, path = 'doc') {
  if (!value || typeof value !== 'object') return;
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, visitor, `${path}[${index}]`));
    return;
  }
  Object.entries(value).forEach(([key, child]) => walk(child, visitor, `${path}.${key}`));
}

function semanticCourseReferences(option = {}) {
  const ids = Array.isArray(option.course_ids) ? option.course_ids : [];
  const keys = Array.isArray(option.source_course_keys)
    ? option.source_course_keys
    : Array.isArray(option.course_keys) ? option.course_keys : [];
  if (keys.length === ids.length) {
    const codes = keys.map((key) => parseCourseKey(key)?.code || null);
    if (codes.every(Boolean)) return codes;
  }
  // Unknown/missing source keys cannot authorize a remint. Numeric identities
  // remain the fail-closed comparison in that case.
  return ids.map(Number);
}

function semanticReceivingReference(receiver = {}) {
  const receiving = structuredClone(receiver?.source_receiving ?? receiver?.receiving ?? null);
  // Four-year parent ids are projection mechanics. The retained receiver code
  // is the source fact that authorizes owner-scoped reminting; every other
  // receiving property (kind, units, title, conjunction) remains protected.
  if (receiving && text(receiver?.code_seen)) {
    delete receiving.parent_id;
    delete receiving.parent_ids;
  }
  return stable(receiving);
}

function requirementInventory(doc) {
  const inventory = {
    total_units: doc?.total_units ?? null,
    total_units_max: doc?.total_units_max ?? null,
    unit_audit: stable(doc?.unit_audit ?? null),
    acceptance_receipt: stable(doc?.acceptance ?? null),
    groups: 0,
    sections: 0,
    receivers: 0,
    options: 0,
    course_references: [],
    unit_facts: [],
    group_semantics: [],
    section_semantics: [],
    receiver_semantics: [],
    option_semantics: [],
    variant_semantics: [],
    constraints: [],
    unresolved: [],
    non_course_requirements: stable(doc?.non_course_requirements_seen || []),
    course_titles: stable(doc?.course_titles || {}),
  };

  const trees = [{ groups: doc?.requirement_groups || [], prefix: '' }];
  for (const [variantIndex, variant] of (doc?.requirement_variants || []).entries()) {
    const prefix = `v${variantIndex}.`;
    inventory.variant_semantics.push({
      path: `v${variantIndex}`,
      id: variant?.id ?? variant?.variant_id ?? null,
      selected: variant?.selected ?? null,
      title: variant?.title ?? variant?.label ?? null,
    });
    trees.push({ groups: variant?.requirement_groups || [], prefix });
  }

  for (const tree of trees) {
    for (const [gi, group] of tree.groups.entries()) {
      const groupPath = `${tree.prefix}g${gi}`;
    inventory.groups += 1;
    inventory.group_semantics.push({
      path: groupPath,
      title: group?.title ?? null,
      label_seen: group?.label_seen ?? null,
      group_id: group?.group_id ?? null,
      group_conjunction: group?.group_conjunction ?? null,
      group_unit_advisement: group?.group_unit_advisement ?? null,
      units_fill: group?.units_fill === true,
      ge_area: group?.ge_area ?? null,
      canonical_section_index: group?.canonical_section_index ?? null,
      source_refs: stable(group?.source_refs || []),
      analysis_constraints: stable(group?.analysis_constraints || []),
      non_course: group?.non_course ?? null,
      requirement_kind: group?.requirement_kind ?? null,
      distinct_course_ids_across_sections:
        group?.distinct_course_ids_across_sections ?? null,
      distinct_areas: group?.distinct_areas ?? null,
      overlap_key: group?.overlap_key ?? null,
    });
    inventory.unresolved.push({
      path: groupPath,
      values: stable(group?.unresolved_courses_seen || []),
    });

    for (const [si, section] of (group?.sections || []).entries()) {
      inventory.sections += 1;
      const sectionPath = `${groupPath}.s${si}`;
      inventory.section_semantics.push({
        path: sectionPath,
        title: section?.title ?? null,
        label_seen: section?.label_seen ?? null,
        conjunction: section?.conjunction ?? section?.section_conjunction ?? null,
        tier: section?.tier ?? null,
        course_level: section?.course_level ?? null,
        cc_articulable: section?.cc_articulable ?? null,
        assume_satisfiable: section?.assume_satisfiable ?? null,
        ge_areas: stable(section?.ge_areas || []),
        analysis_constraints: stable(section?.analysis_constraints || []),
        distinct_course_ids_across_sections:
          section?.distinct_course_ids_across_sections ?? null,
        distinct_areas: section?.distinct_areas ?? null,
        overlap_key: section?.overlap_key ?? null,
      });
      inventory.unit_facts.push({
        path: sectionPath,
        section_advisement: section?.section_advisement ?? null,
        unit_advisement: section?.unit_advisement ?? null,
        unit_advisement_min: section?.unit_advisement_min ?? null,
        unit_advisement_max: section?.unit_advisement_max ?? null,
        source_refs: stable(section?.source_refs || []),
      });
      for (const [ri, receiver] of (section?.receivers || []).entries()) {
        inventory.receivers += 1;
        const receiverPath = `${sectionPath}.r${ri}`;
        inventory.receiver_semantics.push({
          path: receiverPath,
          receiving: semanticReceivingReference(receiver),
          options_conjunction: receiver?.options_conjunction ?? null,
          code_seen: receiver?.code_seen ?? null,
          ge_areas: stable(receiver?.ge_areas || []),
          assume_satisfiable: receiver?.assume_satisfiable ?? null,
          analysis_constraints: stable(receiver?.analysis_constraints || []),
        });
        for (const [oi, option] of (receiver?.options || []).entries()) {
          const courseReferences = semanticCourseReferences(option);
          inventory.options += 1;
          inventory.option_semantics.push({
            path: `${receiverPath}.o${oi}`,
            course_references: stable(courseReferences),
            course_conjunction: option?.course_conjunction ?? null,
            units: option?.units ?? option?.credits ?? null,
            source_refs: stable(option?.source_refs || []),
            analysis_constraints: stable(option?.analysis_constraints || []),
          });
          inventory.course_references.push(...courseReferences);
        }
      }
    }
    }
  }

  walk(doc, (value, path) => {
    if (Array.isArray(value?.analysis_constraints) && value.analysis_constraints.length) {
      inventory.constraints.push({ path, values: stable(value.analysis_constraints) });
    }
  });

  inventory.course_references.sort((a, b) => String(a).localeCompare(String(b)));
  return stable(inventory);
}

function associateRequirementSemanticMaterial(source) {
  const inventory = requirementInventory(source || {});
  delete inventory.acceptance_receipt;
  delete inventory.course_titles;
  return inventory;
}

function associateRequirementSemanticHash(source) {
  return createHash('sha256')
    .update(JSON.stringify(stable(associateRequirementSemanticMaterial(source))))
    .digest('hex');
}

function sourceVerificationDisposition(source) {
  return stable({
    verified: source?.verification?.verified === true,
    verified_by: source?.verification?.verified_by || null,
    verified_at: source?.verification?.verified_at || null,
    stale: source?.verification?.stale === true,
  });
}

const associateCollegeSlug = (source) => String(
  source?.community_college_id ?? source?.college_id ?? '',
).replace(/^va:(?:cc|inst):/, '');

function expectedAssociateSourceDisposition(selected, alternate) {
  const selectedCore = majorCoreHash(selected || {});
  const alternateCore = majorCoreHash(alternate || {});
  const selectedSemantic = associateRequirementSemanticHash(selected);
  const alternateSemantic = associateRequirementSemanticHash(alternate);
  const selectedVerification = sourceVerificationDisposition(selected);
  const alternateVerification = sourceVerificationDisposition(alternate);
  const issues = [];
  const selectedCurrentlyVerified = selectedVerification.verified
    && !selectedVerification.stale;
  if (alternateVerification.verified && !selectedCurrentlyVerified) {
    issues.push('verified_alternate_replaced_by_unverified_source');
  }
  if (alternateVerification.verified && selectedCore !== alternateCore
      && !selectedCurrentlyVerified) {
    issues.push('verified_alternate_major_core_not_reverified');
  }
  return {
    contract: ASSOCIATE_SOURCE_DISPOSITION_CONTRACT,
    college_slug: associateCollegeSlug(selected),
    selected_source_id: selected?._id || null,
    alternate_source_id: alternate?._id || null,
    disposition: 'superseded_by_selected_source',
    projected: false,
    selected_provenance: stable({
      source: selected?.source || null,
      source_method: selected?.source_method || null,
      catalog_year: selected?.catalog_year || null,
    }),
    alternate_provenance: stable({
      source: alternate?.source || null,
      source_method: alternate?.source_method || null,
      catalog_year: alternate?.catalog_year || null,
    }),
    selected_verification: selectedVerification,
    alternate_verification: alternateVerification,
    comparison: {
      selected_major_core_sha256: selectedCore,
      alternate_major_core_sha256: alternateCore,
      exact_major_core_match: selectedCore === alternateCore,
      selected_requirement_semantics_sha256: selectedSemantic,
      alternate_requirement_semantics_sha256: alternateSemantic,
      exact_requirement_semantics_match: selectedSemantic === alternateSemantic,
      differing_requirement_fields: projectionConservationIssues(alternate, selected)
        .map((issue) => issue?.field)
        .filter((field) => field && !['acceptance_receipt', 'course_titles'].includes(field))
        .sort(),
    },
    safe: issues.length === 0,
    issues,
  };
}

function auditAssociateSourceDispositions(sourceDocuments = [], projection = {}) {
  const sourcesById = new Map((sourceDocuments || []).map((source) => [source?._id, source]));
  const projectedCounts = new Map();
  for (const projected of [
    ...(projection?.asDegrees || []),
    ...(projection?.degrees || []),
  ]) {
    if (!text(projected?.va_requirement_id)) continue;
    projectedCounts.set(
      projected.va_requirement_id,
      (projectedCounts.get(projected.va_requirement_id) || 0) + 1,
    );
  }
  const exclusionCounts = new Map();
  for (const exclusion of (projection?.withoutEquivalencies || [])) {
    if (!text(exclusion?.degree_id)) continue;
    exclusionCounts.set(
      exclusion.degree_id,
      (exclusionCounts.get(exclusion.degree_id) || 0) + 1,
    );
  }
  const dispositions = Array.isArray(projection?.associateSourceDispositions)
    ? projection.associateSourceDispositions : [];
  const alternateCounts = new Map();
  const rows = dispositions.map((actual, index) => {
    const selected = sourcesById.get(actual?.selected_source_id) || null;
    const alternate = sourcesById.get(actual?.alternate_source_id) || null;
    const receiptIssues = [];
    if (!selected) receiptIssues.push('selected source does not exist in extracted source cohort');
    if (!alternate) receiptIssues.push('alternate source does not exist in extracted source cohort');
    if (selected && selected.kind !== 'as_degree') {
      receiptIssues.push('selected source is not an associate degree');
    }
    if (alternate && alternate.kind !== 'as_degree') {
      receiptIssues.push('alternate source is not an associate degree');
    }
    if (selected && alternate
        && associateCollegeSlug(selected) !== associateCollegeSlug(alternate)) {
      receiptIssues.push('selected and alternate sources belong to different colleges');
    }
    if (selected && alternate && selected._id === alternate._id) {
      receiptIssues.push('selected and alternate source identities are identical');
    }
    if (selected && (projectedCounts.get(selected._id) || 0) !== 1) {
      receiptIssues.push('selected source is not projected exactly once');
    }
    if (alternate && (projectedCounts.get(alternate._id) || 0) !== 0) {
      receiptIssues.push('alternate source is also projected');
    }
    if (alternate && (exclusionCounts.get(alternate._id) || 0) !== 0) {
      receiptIssues.push('alternate source is both superseded and explicitly excluded');
    }
    if (actual?.alternate_source_id) {
      alternateCounts.set(
        actual.alternate_source_id,
        (alternateCounts.get(actual.alternate_source_id) || 0) + 1,
      );
    }
    const expected = selected && alternate
      ? expectedAssociateSourceDisposition(selected, alternate) : null;
    if (expected) {
      for (const field of [
        'contract', 'college_slug', 'selected_source_id', 'alternate_source_id',
        'disposition', 'projected', 'selected_provenance', 'alternate_provenance',
        'selected_verification', 'alternate_verification', 'comparison', 'safe', 'issues',
      ]) {
        if (!same(actual?.[field], expected[field])) {
          receiptIssues.push(`${field} does not match the current source documents`);
        }
      }
    }
    return {
      index,
      selected_source_id: actual?.selected_source_id || null,
      alternate_source_id: actual?.alternate_source_id || null,
      structurally_valid: receiptIssues.length === 0,
      safe: receiptIssues.length === 0 && expected?.safe === true,
      receipt_issues: receiptIssues,
      safety_issues: expected?.issues || [],
      comparison: expected?.comparison || actual?.comparison || null,
      selected_verification: expected?.selected_verification
        || actual?.selected_verification || null,
      alternate_verification: expected?.alternate_verification
        || actual?.alternate_verification || null,
    };
  });
  for (const [alternateId, count] of alternateCounts) {
    if (count <= 1) continue;
    for (const row of rows.filter((entry) => entry.alternate_source_id === alternateId)) {
      row.receipt_issues.push('alternate source is represented by more than one disposition');
      row.structurally_valid = false;
      row.safe = false;
    }
  }
  const failures = rows.filter((row) => !row.safe);
  return {
    contract: ASSOCIATE_SOURCE_DISPOSITION_CONTRACT,
    ready: failures.length === 0,
    counts: {
      dispositions: rows.length,
      structurally_valid: rows.filter((row) => row.structurally_valid).length,
      safe: rows.length - failures.length,
      unsafe: failures.length,
    },
    rows,
    failures,
    alternate_counts: alternateCounts,
  };
}

const ownerSlug = (value) => String(value || '').replace(/^va:(?:inst|uni|cc):/, '');

/**
 * Verify the stable numeric-id and configured-program contract, not just the
 * cohort cardinality. A count-preserving institution rename/reorder must not
 * be able to move one university onto another university's configured id.
 */
function vaProjectionIdentityAudit(sourceDocuments = [], projection = {}) {
  const issues = [];
  const major = getMajor('va-cs');
  const expectedPrograms = new Set(programPairs(major?.programs || {})
    .map((pair) => `${pair.school_id}|${pair.major}`));
  const sourceById = new Map((sourceDocuments || []).map((doc) => [doc?._id, doc]));
  const projectedPrograms = new Set();
  const projectedProgramCounts = new Map();

  const issue = (path, code, detail = null) => issues.push({ path, code, detail });
  for (const [index, institution] of (projection.institutions || []).entries()) {
    const level = institution?.kind === 'university' ? 'four_year' : 'community_college';
    const slug = ownerSlug(institution?.va_institution_id);
    const identity = institutionIdentityBySlug(slug, level);
    const path = `institutions[${index}]`;
    if (!identity) {
      issue(path, 'unregistered_institution_slug', slug || null);
      continue;
    }
    if (Number(institution.source_id) !== identity.id
        || institution._id !== `va:${level === 'four_year' ? 'uni' : 'cc'}:${identity.id}`
        || institution.institution_id !== institution._id) {
      issue(path, 'institution_numeric_identity_mismatch', identity);
    }
    if (institution.name !== identity.name) {
      issue(`${path}.name`, 'institution_registry_name_mismatch', {
        expected: identity.name, actual: institution.name,
      });
    }
  }

  for (const [index, degree] of (projection.degrees || []).entries()) {
    const path = `degrees[${index}]`;
    const source = sourceById.get(degree?.va_requirement_id);
    const slug = ownerSlug(source?.institution_id);
    const identity = institutionIdentityBySlug(slug, 'four_year');
    if (!source || !identity) {
      issue(path, 'degree_source_institution_unregistered', slug || null);
      continue;
    }
    if (Number(degree.school_id) !== identity.id
        || degree.institution_id !== `va:uni:${identity.id}`) {
      issue(path, 'degree_numeric_identity_mismatch', identity);
    }
    if (degree.school !== identity.name) {
      issue(`${path}.school`, 'degree_registry_name_mismatch', {
        expected: identity.name, actual: degree.school,
      });
    }
    const token = `${Number(degree.school_id)}|${String(degree.program || '')}`;
    projectedPrograms.add(token);
    projectedProgramCounts.set(token, (projectedProgramCounts.get(token) || 0) + 1);
    if (!expectedPrograms.has(token)) issue(`${path}.program`, 'unexpected_program_identity', token);
  }

  for (const token of expectedPrograms) {
    if (!projectedPrograms.has(token)) issue('degrees', 'configured_program_missing', token);
  }
  for (const [token, count] of projectedProgramCounts) {
    if (count > 1) issue('degrees', 'duplicate_program_identity', { token, count });
  }
  for (const token of projectedPrograms) {
    if (!expectedPrograms.has(token)) issue('degrees', 'unconfigured_program_projected', token);
  }

  for (const [index, degree] of (projection.asDegrees || []).entries()) {
    const path = `asDegrees[${index}]`;
    const source = sourceById.get(degree?.va_requirement_id);
    const slug = ownerSlug(source?.community_college_id ?? source?.college_id);
    const identity = institutionIdentityBySlug(slug, 'community_college');
    if (!source || !identity) {
      issue(path, 'associate_source_institution_unregistered', slug || null);
      continue;
    }
    if (Number(degree.community_college_id) !== identity.id
        || degree.college_id !== `va:cc:${identity.id}`) {
      issue(path, 'associate_numeric_identity_mismatch', identity);
    }
    if (degree.college_name !== identity.name) {
      issue(`${path}.college_name`, 'associate_registry_name_mismatch', {
        expected: identity.name, actual: degree.college_name,
      });
    }
  }

  for (const [index, agreement] of (projection.agreements || []).entries()) {
    const path = `agreements[${index}]`;
    const universitySlug = ownerSlug(agreement?.university_id);
    const collegeSlug = ownerSlug(agreement?.college_id);
    const university = institutionIdentityBySlug(universitySlug, 'four_year');
    const college = institutionIdentityBySlug(collegeSlug, 'community_college');
    if (!university || Number(agreement.uc_school_id) !== university.id) {
      issue(path, 'agreement_university_identity_mismatch', universitySlug || null);
    }
    if (!college || Number(agreement.community_college_id) !== college.id) {
      issue(path, 'agreement_college_identity_mismatch', collegeSlug || null);
    }
    const registeredById = institutionIdentityById(agreement?.uc_school_id, 'four_year');
    if (university && registeredById?.slug !== university.slug) {
      issue(path, 'agreement_university_id_slug_disagreement', {
        id_slug: registeredById?.slug || null, source_slug: university.slug,
      });
    }
    if (university && !expectedPrograms.has(`${university.id}|${agreement.major}`)) {
      issue(`${path}.major`, 'agreement_program_not_configured', agreement.major || null);
    }
  }

  return {
    ready: issues.length === 0,
    expected_programs: [...expectedPrograms].sort(),
    projected_programs: [...projectedPrograms].sort(),
    issues,
  };
}

function projectionConservationIssues(source, projected, {
  requirementCapacityEvidenceOverlay = null,
} = {}) {
  if (!source || !projected) return ['source and projected documents are both required'];
  const before = requirementInventory(source);
  const after = requirementInventory(projected);
  const capacityProof = bachelorRequirementCapacityProjectionProof(
    source,
    projected,
    requirementCapacityEvidenceOverlay,
  );
  const issues = [];
  for (const field of Object.keys(before)) {
    let preserved = same(before[field], after[field]);
    if (field.endsWith('_semantics')
        && Array.isArray(before[field])
        && Array.isArray(after[field])
        && before[field].length === after[field].length) {
      // The shared schema requires display ids/labels. Adding one where the
      // source was silent is harmless; replacing any fact the source actually
      // stated is loss. Arrays, booleans, zeroes, and empty strings remain
      // authored values and therefore still compare exactly.
      preserved = before[field].every((sourceGroup, index) => {
        const projectedGroup = after[field][index] || {};
        return Object.entries(sourceGroup).every(([key, value]) => (
          value == null || same(value, projectedGroup[key])
        ));
      });
    }
    if (!preserved && !(field === 'unit_facts' && capacityProof.safe === true)) {
      issues.push({
        field,
        source: before[field],
        projected: after[field],
      });
    }
  }
  return issues;
}

function failedChecks(doc, layer) {
  const acceptance = doc?.acceptance || {};
  const report = layer === 'catalog'
    ? (acceptance.catalog || acceptance.catalog_structural)
    : (acceptance.analysis_ready || acceptance.analysis);
  return (report?.checks || []).filter((check) => check?.severity === 'fail');
}

function constraintKinds(doc) {
  const kinds = new Set();
  walk({
    requirement_groups: doc?.requirement_groups || [],
    unit_audit: doc?.unit_audit || null,
  }, (value) => {
    if (value?.distinct_course_ids_across_sections === true) {
      kinds.add('distinct_course_ids_across_sections');
    }
    if (Number(value?.distinct_areas) > 0) kinds.add('distinct_areas');
    if (text(value?.overlap_key)) kinds.add('overlap_key');
    for (const constraint of value?.analysis_constraints || []) {
      kinds.add(constraint?.kind || 'unnamed_constraint');
    }
  });
  return [...kinds].sort();
}

function hasSourceProblem(checks) {
  return checks.some((check) => [
    'official_sources', 'source_references', 'unresolved_courses', 'catalog_metadata',
    'source_quality',
  ].includes(check.name));
}

function hasModelProblem(checks) {
  return checks.some((check) => [
    'requirement_structure', 'receiver_structure', 'choice_semantics',
    'course_resolution', 'unit_closure', 'constraint_support',
    'analysis_quality_flags',
  ].includes(check.name));
}

const SOURCE_RESEARCH_CONSTRAINT = /(?:source_(?:language_)?ambiguity|source_conflict|official_catalog_wording_conflict|unresolved|missing_(?:source|course)|alternative_course_credit_mismatch|published_(?:maximum_source_conflict|variable_component_closure))/i;
const SOURCE_RESEARCH_FLAG = new RegExp([
  'policy_gap',
  'wording_conflict',
  'official_core_subtotal',
  'published_.*(?:conflict|does_not_reconcile)',
  'restricted_elective_distribution_not_published',
  '(?:source|catalog).*(?:conflict|absent|missing|preliminary|lag|challenge|not_published|not_enumerated)',
  '(?:conflict|absent|missing|not_published|not_enumerated).*(?:source|catalog)',
].join('|'), 'i');

function sourceResearchFlags(doc) {
  return (Array.isArray(doc?.data_quality_flags) ? doc.data_quality_flags : [])
    .filter((flag) => SOURCE_RESEARCH_FLAG.test(String(flag?.code || '')))
    .map((flag) => ({
      code: flag?.code || null,
      severity: flag?.severity || null,
      message: flag?.message || null,
    }));
}

/**
 * Classify the next action without pretending every gap is a scrape gap.
 * A changed official byte bundle needs recapture/review; an exact open roster
 * or an unsupported constraint needs modeling and possibly human judgment.
 */
function readinessForSource(doc) {
  const catalogChecks = failedChecks(doc, 'catalog');
  const analysisChecks = failedChecks(doc, 'analysis');
  const checks = [...catalogChecks, ...analysisChecks];
  const blockers = [];

  if (doc?.status !== 'extracted') blockers.push('current_extraction_required');
  if (doc?.source_method !== 'official_catalog_composition') {
    blockers.push('official_catalog_composition_required');
  }
  if (doc?.acceptance?.accepted !== true) blockers.push('catalog_acceptance_failed');
  if (doc?.acceptance?.ready_for_analysis !== true) blockers.push('analysis_acceptance_failed');
  if (doc?.verification?.verified !== true || doc?.verification?.stale === true) {
    blockers.push('current_human_verification_required');
  }
  if (!text(doc?.provenance?.source_bundle_hash)) blockers.push('source_bundle_hash_required');

  const kinds = constraintKinds(doc);
  const fourYearConstraintAudit = doc?.kind === 'degree'
    ? auditFourYearDocument(doc) : null;
  const fourYearQualityFlagAudit = doc?.kind === 'degree'
    ? auditFourYearAnalysisQualityFlags(doc) : [];
  const associateConstraintAudit = doc?.kind === 'as_degree'
    ? auditAssociateDocument(doc) : null;
  const associateQualityFlagAudit = doc?.kind === 'as_degree'
    ? auditAssociateAnalysisQualityFlags(doc) : [];
  const fourYearRuleBlockers = [
    ...(fourYearConstraintAudit?.active_rules.filter((rule) => !rule.supported) || []),
    ...(fourYearConstraintAudit?.unit_audit.filter((rule) => rule.blocking) || []),
  ];
  const fourYearRemediation = new Set(fourYearRuleBlockers
    .map((rule) => rule?.remediation?.category).filter(Boolean));
  const associateRuleBlockers = associateConstraintAudit?.active_blockers || [];
  const associateRemediation = new Set(associateRuleBlockers
    .map((rule) => rule?.remediation?.category).filter(Boolean));
  // Recompute this capability from the source tree instead of trusting a
  // persisted acceptance receipt. A newly authored constraint must fail the
  // request-time publication gate even before the next catalog import.
  if (fourYearRuleBlockers.length) {
    blockers.push('four_year_constraint_evaluator_required');
  }
  if (associateRuleBlockers.length) {
    blockers.push('associate_constraint_evaluator_required');
  }
  const ambiguousSourceRule = kinds.some((kind) => SOURCE_RESEARCH_CONSTRAINT.test(kind));
  const sourceFlags = sourceResearchFlags(doc);
  const blockingSourceFlags = sourceFlags.filter((flag) => (
    ['block', 'block_analysis', 'block_catalog_acceptance']
      .includes(String(flag.severity || '').toLowerCase())
  ));
  const actions = [];
  if (hasSourceProblem(checks)
      || blockers.includes('current_extraction_required')
      || blockers.includes('official_catalog_composition_required')
      || blockers.includes('source_bundle_hash_required')
      || ambiguousSourceRule
      || blockingSourceFlags.length) actions.push('targeted_source_research');
  if (hasModelProblem(checks)) actions.push('model_or_evaluator_work');
  if (fourYearRemediation.has('targeted_source_research')
      && !actions.includes('targeted_source_research')) {
    actions.push('targeted_source_research');
  }
  if (fourYearRemediation.has('evaluator_engineering')
      && !actions.includes('model_or_evaluator_work')) {
    actions.push('model_or_evaluator_work');
  }
  if (fourYearRemediation.has('out_of_scope_administrative_rule')) {
    actions.push('scope_or_policy_decision');
  }
  if (associateRemediation.has('targeted_source_research')
      && !actions.includes('targeted_source_research')) {
    actions.push('targeted_source_research');
  }
  if (associateRemediation.has('evaluator_engineering')
      && !actions.includes('model_or_evaluator_work')) {
    actions.push('model_or_evaluator_work');
  }
  if (associateRemediation.has('out_of_scope_administrative_rule')) {
    actions.push('scope_or_policy_decision');
  }
  if (blockers.includes('current_human_verification_required')) actions.push('human_verification');

  let route = 'ready';
  const requiresScrape = actions.includes('targeted_source_research');
  if (requiresScrape) {
    route = 'targeted_source_research';
  } else if (actions.includes('model_or_evaluator_work')) {
    route = 'model_or_evaluator_work';
  } else if (actions.includes('scope_or_policy_decision')) {
    route = 'scope_or_policy_decision';
  } else if (actions.includes('human_verification')) {
    route = 'human_verification';
  } else if (blockers.length) {
    route = 'source_review';
  }

  return {
    id: doc?._id || null,
    kind: doc?.kind || null,
    ready: blockers.length === 0,
    route,
    actions,
    requires_scrape: requiresScrape,
    blockers: [...new Set(blockers)],
    catalog_failures: [...new Set(catalogChecks.map((check) => check.name))],
    analysis_failures: [...new Set(analysisChecks.map((check) => check.name))],
    constraint_kinds: kinds,
    source_research_flags: sourceFlags,
    blocking_source_research_flags: blockingSourceFlags,
    ...(fourYearConstraintAudit ? {
      four_year_constraint_audit: {
        summary: fourYearConstraintAudit.summary,
        active_blockers: fourYearConstraintAudit.active_rules
          .filter((rule) => !rule.supported)
          .concat(fourYearConstraintAudit.unit_audit.filter((rule) => rule.blocking))
          .map((rule) => ({
            path: rule.path,
            kind: rule.kind,
            affected_figures: rule.affected_figures,
            reason: rule.reason,
            remediation: rule.remediation || null,
            paper_impact_proven: rule.paper_impact_proven === true,
          })),
        inactive_variant_rules: fourYearConstraintAudit.inactive_variant_rules.length,
        unit_audit: fourYearConstraintAudit.unit_audit,
        blocker_remediation: fourYearConstraintAudit.summary.all_blocker_remediation,
        analysis_quality_flags: fourYearQualityFlagAudit,
        // The source-level `ready` verdict above intentionally means complete
        // degree-analysis readiness and is therefore stricter than any one
        // paper figure. Preserve the narrower impact map so figure-specific
        // gates can remain fail-closed without pretending GPA/administrative
        // rules numerically change a paper cell.
        blockers_by_figure: fourYearConstraintAudit.summary.blocked_rules_by_figure,
      },
    } : {}),
    ...(associateConstraintAudit ? {
      associate_constraint_audit: {
        summary: associateConstraintAudit.summary,
        active_blockers: associateConstraintAudit.active_blockers.map((rule) => ({
          path: rule.path,
          kind: rule.kind,
          affected_figures: rule.affected_figures,
          reason: rule.reason,
          remediation: rule.remediation || null,
          paper_impact_proven: rule.paper_impact_proven === true,
        })),
        blocker_remediation: associateConstraintAudit.summary.active_rule_remediation,
        analysis_quality_flags: associateQualityFlagAudit,
        blockers_by_figure: associateConstraintAudit.summary.blocked_rules_by_figure,
      },
    } : {}),
  };
}

function normalizedFigureIds(figures) {
  return [...new Set((Array.isArray(figures) ? figures : [figures])
    .map((figure) => String(figure || '').trim())
    .filter((figure) => ['1', '3', '4', '6'].includes(figure)))];
}

/**
 * Narrow the complete-degree gate to the paper figure(s) being computed.
 *
 * A GPA, graduation application, or other non-credit administrative rule is
 * real degree content and therefore remains a blocker in `readinessForSource`.
 * It must not, however, make a course/credit figure look unavailable when its
 * exact evaluator audit says the rule affects no paper figure. Conversely, a
 * rule whose impact is unknown defaults to every figure in
 * `fourYearConstraints`, so this narrower gate is still fail-closed.
 *
 * The stored `acceptance.ready_for_analysis` receipt is intentionally not the
 * authority here: it is the stricter complete-degree verdict and may also lag
 * newly implemented evaluators. All non-constraint analysis failures remain
 * blocking, while constraint capability is recomputed from the current tree.
 */
function readinessForSourceFigures(doc, { figures = [] } = {}) {
  const requestedFigures = normalizedFigureIds(figures);
  const complete = readinessForSource(doc);
  if (requestedFigures.length === 0) {
    return {
      ...complete,
      figures: requestedFigures,
      complete_degree_ready: complete.ready,
      figure_constraint_blockers: doc?.kind === 'degree'
        ? (complete.four_year_constraint_audit?.active_blockers || [])
        : (complete.associate_constraint_audit?.active_blockers || []),
    };
  }

  if (doc?.kind === 'as_degree') {
    const qualityFlagAudit = complete.associate_constraint_audit
      ?.analysis_quality_flags || [];
    const blockingQualityFlags = qualityFlagAudit.filter((flag) => flag.blocking_analysis);
    const unresolvedQualityFlags = blockingQualityFlags.filter((flag) => (
      flag.resolved_by_exact_evaluator !== true
        && (!Array.isArray(flag.affected_figures)
          || flag.affected_figures.some((figure) => requestedFigures.includes(String(figure))))
    ));
    const qualityFlagFailureResolved = blockingQualityFlags.length > 0
      && unresolvedQualityFlags.length === 0;
    const nonConstraintAnalysisFailures = complete.analysis_failures
      .filter((name) => name !== 'constraint_support'
        && !(name === 'analysis_quality_flags' && qualityFlagFailureResolved));
    const figureConstraintBlockers = (complete.associate_constraint_audit
      ?.active_blockers || []).filter((rule) => (
      (rule.affected_figures || []).some((figure) => requestedFigures.includes(String(figure)))
    ));
    const blockers = complete.blockers.filter((blocker) => ![
      'analysis_acceptance_failed',
      'associate_constraint_evaluator_required',
    ].includes(blocker));
    if (nonConstraintAnalysisFailures.length) blockers.push('analysis_acceptance_failed');
    if (figureConstraintBlockers.length) blockers.push('associate_constraint_evaluator_required');
    const uniqueBlockers = [...new Set(blockers)];

    return {
      ...complete,
      ready: uniqueBlockers.length === 0,
      blockers: uniqueBlockers,
      figures: requestedFigures,
      complete_degree_ready: complete.ready,
      analysis_failures: nonConstraintAnalysisFailures,
      analysis_quality_flag_resolutions: qualityFlagAudit,
      unresolved_analysis_quality_flags: unresolvedQualityFlags,
      figure_constraint_blockers: figureConstraintBlockers,
      warning: uniqueBlockers.length
        ? `Virginia source is not ready for figure${requestedFigures.length === 1 ? '' : 's'} ${requestedFigures.join('/')}`
          + ` (${uniqueBlockers.join(', ')}).`
        : null,
    };
  }

  if (doc?.kind !== 'degree') {
    return {
      ...complete,
      figures: requestedFigures,
      complete_degree_ready: complete.ready,
      figure_constraint_blockers: [],
    };
  }

  const qualityFlagAudit = complete.four_year_constraint_audit
    ?.analysis_quality_flags || [];
  const blockingQualityFlags = qualityFlagAudit.filter((flag) => flag.blocking_analysis);
  const unresolvedQualityFlags = blockingQualityFlags.filter((flag) => (
    flag.resolved_by_exact_evaluator !== true
      && (!Array.isArray(flag.affected_figures)
        || flag.affected_figures.some((figure) => requestedFigures.includes(String(figure))))
  ));
  // An aggregate acceptance check can be superseded only when it corresponds
  // to at least one current blocking flag and every such flag has an exact,
  // active evaluator receipt.  A stale fail with no inspectable flags stays
  // closed, as does any mixed set containing an unmapped/source-drifted flag.
  const qualityFlagFailureResolved = blockingQualityFlags.length > 0
    && unresolvedQualityFlags.length === 0;
  const nonConstraintAnalysisFailures = complete.analysis_failures
    .filter((name) => name !== 'constraint_support'
      && !(name === 'analysis_quality_flags' && qualityFlagFailureResolved));
  const figureConstraintBlockers = (complete.four_year_constraint_audit
    ?.active_blockers || []).filter((rule) => (
    (rule.affected_figures || []).some((figure) => requestedFigures.includes(String(figure)))
  ));
  const blockers = complete.blockers.filter((blocker) => ![
    'analysis_acceptance_failed',
    'four_year_constraint_evaluator_required',
  ].includes(blocker));
  if (nonConstraintAnalysisFailures.length) blockers.push('analysis_acceptance_failed');
  if (figureConstraintBlockers.length) blockers.push('four_year_constraint_evaluator_required');
  const uniqueBlockers = [...new Set(blockers)];

  return {
    ...complete,
    ready: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    figures: requestedFigures,
    complete_degree_ready: complete.ready,
    analysis_failures: nonConstraintAnalysisFailures,
    analysis_quality_flag_resolutions: qualityFlagAudit,
    unresolved_analysis_quality_flags: unresolvedQualityFlags,
    figure_constraint_blockers: figureConstraintBlockers,
    warning: uniqueBlockers.length
      ? `Virginia source is not ready for figure${requestedFigures.length === 1 ? '' : 's'} ${requestedFigures.join('/')}`
        + ` (${uniqueBlockers.join(', ')}).`
      : null,
  };
}

/**
 * Apply the official-source gate to one document in the shared figure schema.
 *
 * A projected `curated_requirements` row uses `status: found` for the shared
 * reader, so its source extraction status travels separately as
 * `va_requirement_status`.  Rebuild a source-shaped view for the common gate,
 * then require the projection link and the explicit analysis-ready stamp as
 * well.  Figure services use this at request time so a stale cache or a manual
 * verification edit cannot turn an unpublishable Virginia source into a
 * numeric cell.
 */
function readinessForProjectedSource(doc, { label = 'Virginia source' } = {}) {
  const sourceStatus = doc?.va_requirement_status ?? doc?.status;
  const source = readinessForSource({ ...doc, status: sourceStatus });
  const blockers = [...source.blockers];
  if (!text(doc?.va_requirement_id)) blockers.push('source_projection_link_required');
  if (doc?.analysis_ready !== true) blockers.push('explicit_analysis_ready_projection_required');

  const uniqueBlockers = [...new Set(blockers)];
  return {
    ...source,
    ready: uniqueBlockers.length === 0,
    route: uniqueBlockers.length && source.route === 'ready'
      ? 'projection_not_ready' : source.route,
    blockers: uniqueBlockers,
    label,
    source_id: doc?.va_requirement_id || null,
    source_bundle_hash: text(doc?.provenance?.source_bundle_hash)
      ? doc.provenance.source_bundle_hash : null,
    warning: uniqueBlockers.length
      ? `${label} is not publication-ready (${uniqueBlockers.join(', ')}).`
      : null,
  };
}

function readinessForProjectedFigures(doc, {
  label = 'Virginia source',
  figures = [],
} = {}) {
  const sourceStatus = doc?.va_requirement_status ?? doc?.status;
  const source = readinessForSourceFigures({ ...doc, status: sourceStatus }, { figures });
  const blockers = [...source.blockers];
  if (!text(doc?.va_requirement_id)) blockers.push('source_projection_link_required');
  // A complete-degree analysis stamp may legitimately be false solely because
  // of a source-bound rule with zero paper impact.  Require the historical
  // stamp whenever the recomputed figure gate is still closed, but do not let
  // it veto a current exact source-tree proof for either degree kind.
  if (doc?.kind !== 'degree' && doc?.analysis_ready !== true
      && !(source.ready === true && source.complete_degree_ready === false)) {
    blockers.push('explicit_analysis_ready_projection_required');
  }
  const uniqueBlockers = [...new Set(blockers)];
  return {
    ...source,
    ready: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    label,
    source_id: doc?.va_requirement_id || null,
    source_bundle_hash: text(doc?.provenance?.source_bundle_hash)
      ? doc.provenance.source_bundle_hash : null,
    warning: uniqueBlockers.length
      ? `${label} is not publication-ready for figure${source.figures.length === 1 ? '' : 's'}`
        + ` ${source.figures.join('/')} (${uniqueBlockers.join(', ')}).`
      : null,
  };
}

function publicationAudit({
  sourceDocuments = [],
  projection = {},
  identityAudit = null,
  figureReadiness = {},
  requirementCapacityEvidenceOverlay = null,
  expected = EXPECTED_PRIMARY_COHORT,
} = {}) {
  const allSources = sourceDocuments.filter((doc) => (
    doc?.status === 'extracted'
      && ['as_degree', 'degree'].includes(doc?.kind)
  ));
  // Source-readiness/cohort counts stay attached to the 37 selected official
  // catalog records. Source accounting is broader: every extracted record,
  // including a superseded Transfer Virginia map, must have one explicit
  // disposition.
  const sources = allSources.filter((doc) => (
    doc?.status === 'extracted'
      && doc?.source === 'institution_catalog'
      && ['as_degree', 'degree'].includes(doc?.kind)
  ));
  const sourceReadiness = sources.map(readinessForSource);
  const sourceById = new Map(allSources.map((doc) => [doc._id, doc]));
  const projectedRequirements = [
    ...(projection.asDegrees || []),
    ...(projection.degrees || []),
  ];
  const projectedSourceCounts = new Map();
  for (const doc of projectedRequirements) {
    const id = doc?.va_requirement_id;
    if (text(id)) projectedSourceCounts.set(id, (projectedSourceCounts.get(id) || 0) + 1);
  }
  const exclusions = Array.isArray(projection.withoutEquivalencies)
    ? projection.withoutEquivalencies : [];
  const exclusionCounts = new Map();
  for (const exclusion of exclusions) {
    const id = exclusion?.degree_id;
    if (text(id)) exclusionCounts.set(id, (exclusionCounts.get(id) || 0) + 1);
  }
  const associateSourceDisposition = auditAssociateSourceDispositions(
    allSources,
    projection,
  );
  const dispositionCounts = associateSourceDisposition.alternate_counts;
  // The expected cohort intentionally has two more bachelor source records
  // than active figure templates: UVA and VMI publish no equivalency corpus.
  // They may be omitted from figure columns, but only through an explicit,
  // source-linked exclusion. This proves that every source document is either
  // conserved in the projection or visibly accounted for.
  const sourceAccounting = allSources.map((doc) => {
    const projected = projectedSourceCounts.get(doc._id) || 0;
    const excluded = exclusionCounts.get(doc._id) || 0;
    const superseded = dispositionCounts.get(doc._id) || 0;
    const issues = [];
    if (projected + excluded + superseded !== 1) {
      issues.push(projected + excluded + superseded === 0
        ? 'source document is neither projected nor explicitly excluded or superseded'
        : 'source document is represented more than once');
    }
    if (excluded && doc.kind !== 'degree') {
      issues.push('associate-degree sources cannot be excluded for missing four-year equivalencies');
    }
    const matchingExclusions = exclusions.filter((row) => row?.degree_id === doc._id);
    if (matchingExclusions.some((row) => row?.reason !== 'no published course equivalencies')) {
      issues.push('exclusion is not supported by an explicit no-equivalencies finding');
    }
    if (superseded && doc.kind !== 'as_degree') {
      issues.push('only associate-degree source alternates can be superseded');
    }
    return {
      id: doc._id,
      projected,
      excluded,
      superseded,
      accounted: issues.length === 0,
      issues,
    };
  });
  const knownSourceIds = new Set(allSources.map((doc) => doc._id));
  const orphanExclusions = exclusions.filter((row) => !knownSourceIds.has(row?.degree_id));
  const sourceAccountingFailures = [
    ...sourceAccounting.filter((row) => !row.accounted),
    ...orphanExclusions.map((row) => ({
      id: row?.degree_id || null,
      projected: 0,
      excluded: 1,
      accounted: false,
      issues: ['exclusion does not identify a current official source document'],
    })),
  ];
  const sourceAlternateFailures = associateSourceDisposition.failures;
  const projectedCollegeIds = new Set((projection.asDegrees || [])
    .map((doc) => Number(doc?.community_college_id))
    .filter(Number.isFinite));
  const relevantAgreements = (projection.agreements || []).filter((agreement) => (
    projectedCollegeIds.has(Number(agreement?.community_college_id))
  ));
  const conservation = projectedRequirements.map((doc) => {
    const source = sourceById.get(doc?.va_requirement_id);
    const capacityProof = source ? bachelorRequirementCapacityProjectionProof(
      source,
      doc,
      requirementCapacityEvidenceOverlay,
    ) : null;
    const issues = source ? projectionConservationIssues(source, doc, {
      requirementCapacityEvidenceOverlay,
    }) : [{
      field: 'va_requirement_id',
      source: doc?.va_requirement_id || null,
      projected: null,
    }];
    return {
      id: doc?._id || null,
      source_id: doc?.va_requirement_id || null,
      conserved: issues.length === 0,
      issues,
      ...(capacityProof?.applicable ? {
        requirement_capacity_evidence_projection: capacityProof,
      } : {}),
    };
  });

  const counts = {
    extracted_source_records: allSources.length,
    alternate_source_records: associateSourceDisposition.counts.dispositions,
    associate_degrees: sources.filter((doc) => doc.kind === 'as_degree').length,
    bachelor_degrees: sources.filter((doc) => doc.kind === 'degree').length,
    active_bachelor_templates: (projection.degrees || []).length,
    agreement_cells: relevantAgreements.length,
    all_agreement_documents: (projection.agreements || []).length,
    projected_associate_degrees: (projection.asDegrees || []).length,
  };
  const cohortFailures = Object.entries(expected).filter(([field, count]) => (
    Number.isFinite(count) && counts[field] !== count
  )).map(([field, count]) => ({ field, expected: count, actual: counts[field] }));
  if (counts.projected_associate_degrees !== expected.associate_degrees) {
    cohortFailures.push({
      field: 'projected_associate_degrees',
      expected: expected.associate_degrees,
      actual: counts.projected_associate_degrees,
    });
  }

  const sourceReady = sourceReadiness.filter((row) => row.ready).length;
  const fourYearBlockerRemediation = Object.fromEntries([
    'targeted_source_research',
    'evaluator_engineering',
    'out_of_scope_administrative_rule',
  ].map((category) => [category, sourceReadiness.reduce((sum, row) => (
    sum + Number(row?.four_year_constraint_audit
      ?.blocker_remediation?.[category] || 0)
  ), 0)]));
  const projectionLosses = conservation.filter((row) => !row.conserved);
  const enforcePrimaryIdentity = expected?.active_bachelor_templates
      === EXPECTED_PRIMARY_COHORT.active_bachelor_templates
    && expected?.agreement_cells === EXPECTED_PRIMARY_COHORT.agreement_cells;
  const identityCohort = enforcePrimaryIdentity
    ? vaProjectionIdentityAudit(sources, projection)
    : { ready: true, skipped: true, issues: [] };
  // Referential/shared-schema validation is a release gate for the real
  // publication cohort. Keep deliberately small unit-test and diagnostic
  // cohorts usable under the same opt-out already established for the stable
  // institution/program identity audit; a primary-sized projection never gets
  // that exemption.
  const projectionSchema = enforcePrimaryIdentity
    ? auditCanonicalProjection(projection)
    : {
      ready: true,
      skipped: true,
      contract: 'shared-analysis-projection-v1',
      issues: [],
    };
  const equivalencyConditionReadiness = figureReadiness.transfer_equivalency_conditions
    || (enforcePrimaryIdentity ? {
      ready: false,
      blocker: 'virginia_transfer_equivalency_condition_audit_unavailable',
      issues: [{
        code: 'projection_equivalency_condition_audit_missing',
        message: 'The primary Virginia projection was not checked against its selected source-equivalency conditions.',
      }],
    } : {
      ready: true,
      skipped: true,
      blocker: null,
    });
  const resolvedFigureReadiness = {
    pathway_complexity: figureReadiness.pathway_complexity
      || unavailableVirginiaFigure6PrerequisiteReport(),
    transfer_equivalency_conditions: equivalencyConditionReadiness,
  };
  const figureFailures = Object.entries(resolvedFigureReadiness)
    .filter(([, report]) => report?.ready !== true)
    .map(([figure, report]) => ({
      figure,
      blocker: report?.blocker || 'figure_readiness_failed',
      report,
    }));
  const commonFigureBlockers = [];
  if (cohortFailures.length) commonFigureBlockers.push('cohort_contract_failed');
  if (projectionLosses.length) commonFigureBlockers.push('projection_conservation_failed');
  if (sourceAccountingFailures.length) commonFigureBlockers.push('source_accounting_failed');
  if (sourceAlternateFailures.length) {
    commonFigureBlockers.push('associate_source_disposition_failed');
  }
  if (identityCohort.ready !== true) commonFigureBlockers.push('identity_cohort_failed');
  if (projectionSchema.ready !== true) commonFigureBlockers.push('projection_schema_failed');
  if (identityAudit != null && identityAudit.publication_ready !== true) {
    commonFigureBlockers.push('course_identity_failed');
  }

  // Figure 1 consumes bachelor templates only. Figures 3/4 and Figure 6
  // consume both sides of the projected pathway. Explicit no-equivalency
  // exclusions remain source-accounting facts, but cannot block a figure in
  // which the source has no projected row.
  const projectedForFigure = (figure) => (figure === '1'
    ? (projection.degrees || [])
    : projectedRequirements);
  const publicationByFigure = Object.fromEntries(PAPER_FIGURES.map((figure) => {
    const projectedRows = projectedForFigure(figure);
    const relevantSourceIds = new Set(projectedRows
      .map((doc) => doc?.va_requirement_id)
      .filter(text));
    const relevantSources = sources.filter((doc) => relevantSourceIds.has(doc?._id));
    const sourceRows = relevantSources.map((doc) => (
      readinessForSourceFigures(doc, { figures: [figure] })
    ));
    const projectionRows = projectedRows.map((doc) => (
      readinessForProjectedFigures(doc, { figures: [figure] })
    ));
    const blockedSources = sourceRows.filter((row) => !row.ready);
    const blockedProjections = projectionRows.filter((row) => !row.ready);
    const blockers = [...commonFigureBlockers];
    if (blockedSources.length) blockers.push('source_readiness_failed');
    if (blockedProjections.length) blockers.push('projected_source_readiness_failed');
    const runtimeReadiness = {};
    if (figure === '6') {
      runtimeReadiness.pathway_complexity = resolvedFigureReadiness.pathway_complexity;
    }
    if (enforcePrimaryIdentity && ['3', '4', '6'].includes(figure)) {
      runtimeReadiness.transfer_equivalency_conditions =
        resolvedFigureReadiness.transfer_equivalency_conditions;
    }
    if (Object.values(runtimeReadiness).some((runtime) => runtime?.ready !== true)) {
      blockers.push('figure_runtime_readiness_failed');
    }
    const uniqueBlockers = [...new Set(blockers)];

    return [figure, {
      figure,
      publishable: uniqueBlockers.length === 0,
      blockers: uniqueBlockers,
      source_summary: {
        total: sourceRows.length,
        ready: sourceRows.length - blockedSources.length,
        blocked: blockedSources.length,
        complete_degree_ready: sourceRows.filter((row) => row.complete_degree_ready).length,
      },
      projected_source_summary: {
        total: projectionRows.length,
        ready: projectionRows.length - blockedProjections.length,
        blocked: blockedProjections.length,
        complete_degree_ready:
          projectionRows.filter((row) => row.complete_degree_ready).length,
      },
      sources: sourceRows,
      projected_sources: projectionRows,
      constraint_blockers: [
        ...sourceRows.flatMap((row) => row.figure_constraint_blockers || []),
        ...projectionRows.flatMap((row) => row.figure_constraint_blockers || []),
      ],
      ...(figure === '6' ? {
        // Backward-compatible alias for the original sole runtime gate.
        runtime: resolvedFigureReadiness.pathway_complexity,
      } : {}),
      ...(Object.keys(runtimeReadiness).length ? { runtime_readiness: runtimeReadiness } : {}),
    }];
  }));
  const paperFigureFailures = Object.values(publicationByFigure)
    .filter((report) => !report.publishable)
    .map((report) => ({
      figure: report.figure,
      blockers: report.blockers,
    }));
  const publishable = paperFigureFailures.length === 0;

  return {
    publishable,
    verdict: publishable ? 'pass' : 'fail',
    publication_scope: 'paper_figures_1_3_4_6',
    complete_degree_ready: sourceReady === sourceReadiness.length,
    counts,
    expected: { ...expected },
    cohort_failures: cohortFailures,
    source_summary: {
      scope: 'complete_degree_analysis_diagnostic',
      total: sourceReadiness.length,
      ready: sourceReady,
      blocked: sourceReadiness.length - sourceReady,
      requires_targeted_source_research:
        sourceReadiness.filter((row) => row.actions.includes('targeted_source_research')).length,
      requires_model_or_evaluator_work:
        sourceReadiness.filter((row) => row.actions.includes('model_or_evaluator_work')).length,
      requires_human_verification:
        sourceReadiness.filter((row) => row.actions.includes('human_verification')).length,
      requires_scope_or_policy_decision:
        sourceReadiness.filter((row) => row.actions.includes('scope_or_policy_decision')).length,
      four_year_blocker_remediation: fourYearBlockerRemediation,
    },
    sources: sourceReadiness,
    source_accounting: sourceAccounting,
    source_accounting_failures: sourceAccountingFailures,
    associate_source_disposition: {
      contract: associateSourceDisposition.contract,
      ready: associateSourceDisposition.ready,
      counts: associateSourceDisposition.counts,
      rows: associateSourceDisposition.rows,
      failures: sourceAlternateFailures,
    },
    identity_cohort: identityCohort,
    projection_schema: projectionSchema,
    projection_conservation: conservation,
    projection_losses: projectionLosses,
    course_identity: identityAudit,
    figure_readiness: resolvedFigureReadiness,
    figure_failures: figureFailures,
    publication_by_figure: publicationByFigure,
    paper_figure_failures: paperFigureFailures,
  };
}

module.exports = {
  ASSOCIATE_SOURCE_DISPOSITION_CONTRACT,
  EXPECTED_PRIMARY_COHORT,
  PAPER_FIGURES,
  auditAssociateSourceDispositions,
  constraintKinds,
  publicationAudit,
  projectionConservationIssues,
  readinessForProjectedFigures,
  readinessForProjectedSource,
  readinessForSourceFigures,
  readinessForSource,
  requirementInventory,
  vaProjectionIdentityAudit,
};
