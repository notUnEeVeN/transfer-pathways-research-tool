const { createHash } = require('node:crypto');
const {
  canonicalContractIssues,
} = require('./canonicalSourceContract');
const {
  canonicalCourseCode,
  courseIdFor,
  institutionCourseIdFor,
  institutionCourseKeyFor,
  institutionReceivingCourseRefs,
} = require('../virginia/courseIdentity');

const asArray = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const finiteId = (value) => value != null && value !== ''
  && Number.isInteger(Number(value)) && Number(value) > 0;
const SOURCE_NAMED_OFFERING_CONTRACT = 'va-associate-requirement-course-offer-v1';
const exactRowsSha256 = (rows) => createHash('sha256')
  .update(JSON.stringify(rows || [])).digest('hex');

function authoredReceivingTitle(doc, code) {
  const titles = doc?.course_titles || {};
  if (typeof titles[code] === 'string' && titles[code].trim()) return titles[code].trim();
  const entry = Object.entries(titles).find(([candidate]) => (
    canonicalCourseCode(candidate) === code
  ));
  return typeof entry?.[1] === 'string' && entry[1].trim()
    ? entry[1].trim() : code;
}

function exactReceivingUnitEvidence(doc, code) {
  const observations = asArray(doc?.course_unit_evidence)
    .filter((row) => canonicalCourseCode(row?.code) === code)
    .map((row) => ({
      min: Number(row?.min_units ?? row?.units),
      max: Number(row?.max_units ?? row?.units),
    }))
    .filter((row) => Number.isFinite(row.min) && Number.isFinite(row.max)
      && row.min > 0 && row.max > 0 && Math.abs(row.min - row.max) <= 0.000001);
  const units = [...new Set(observations.map((row) => row.min))];
  return units.length === 1 ? units[0] : null;
}

function auditCanonicalProjection(projection = {}, {
  expectedState = 'va',
  requireExactSourceContract = true,
} = {}) {
  const issues = [];
  const seenIds = new Map();
  const issue = (path, code, detail = null) => issues.push({ path, code, detail });
  const register = (row, path) => {
    if (!text(row?._id)) {
      issue(`${path}._id`, 'canonical_id_required');
      return;
    }
    if (seenIds.has(row._id)) {
      issue(`${path}._id`, 'canonical_id_collision', { first: seenIds.get(row._id), id: row._id });
    } else seenIds.set(row._id, path);
    if (row?.state !== expectedState) issue(`${path}.state`, 'projection_state_mismatch', row?.state);
  };

  const institutionIds = new Set();
  const universityIds = new Set();
  const collegeNumericIds = new Set();
  const collegeNameByNumericId = new Map();
  for (const [index, row] of asArray(projection.institutions).entries()) {
    const path = `institutions[${index}]`;
    register(row, path);
    if (!['university', 'community_college'].includes(row?.kind)) {
      issue(`${path}.kind`, 'institution_kind_not_canonical', row?.kind);
    }
    if (!text(row?.institution_id) || row.institution_id !== row._id) {
      issue(`${path}.institution_id`, 'institution_identity_not_canonical');
    }
    if (!finiteId(row?.source_id)) issue(`${path}.source_id`, 'numeric_source_id_required');
    if (!text(row?.name)) issue(`${path}.name`, 'institution_name_required');
    institutionIds.add(row?._id);
    if (row?.kind === 'university') universityIds.add(row?._id);
    if (row?.kind === 'community_college' && finiteId(row?.source_id)) {
      collegeNumericIds.add(Number(row.source_id));
      collegeNameByNumericId.set(Number(row.source_id), row?.name);
    }
  }

  const receivingIds = new Set();
  const receivingById = new Map();
  const sendingIds = new Set();
  const sendingById = new Map();
  for (const [index, row] of asArray(projection.courses).entries()) {
    const path = `courses[${index}]`;
    register(row, path);
    if (!['receiving', 'sending'].includes(row?.side)) {
      issue(`${path}.side`, 'course_side_not_canonical', row?.side);
      continue;
    }
    if (!text(row?.prefix) || typeof row?.number !== 'string') {
      issue(path, 'course_code_fields_required');
    }
    if (row.side === 'receiving') {
      if (!finiteId(row?.parent_id)) issue(`${path}.parent_id`, 'receiving_parent_id_required');
      else if (receivingIds.has(Number(row.parent_id))) {
        issue(`${path}.parent_id`, 'receiving_parent_id_collision', Number(row.parent_id));
      } else {
        receivingIds.add(Number(row.parent_id));
        receivingById.set(Number(row.parent_id), row);
      }
      if (!universityIds.has(row?.institution_id)) {
        issue(`${path}.institution_id`, 'receiving_institution_missing', row?.institution_id);
      }
      let expectedParentId = null;
      let expectedCourseKey = null;
      try {
        expectedParentId = institutionCourseIdFor(row?.institution_id, row?.code);
        expectedCourseKey = institutionCourseKeyFor(row?.institution_id, row?.code);
      } catch (_) {
        // The institution error is already reported above; keep identity
        // diagnostics deterministic without leaking an implementation error.
      }
      const canonicalCode = canonicalCourseCode(row?.code);
      if (expectedParentId == null
          || Number(row?.parent_id) !== expectedParentId
          || Number(row?.source_id) !== expectedParentId
          || Number(row?.source_parent_id) !== courseIdFor(row?.code)
          || row?.code !== canonicalCode
          || row?.course_key !== expectedCourseKey
          || row?.identity_scope !== 'institution_local'
          || row?.identity_contract !== 'owner_plus_course_id'
          || row?.vccs_master_applicable !== false) {
        issue(path, 'receiving_course_identity_not_owner_scoped', {
          owner: row?.institution_id ?? null,
          code: row?.code ?? null,
          parent_id: row?.parent_id ?? null,
          expected_parent_id: expectedParentId,
          source_parent_id: row?.source_parent_id ?? null,
          expected_source_parent_id: row?.code ? courseIdFor(row.code) : null,
        });
      }
    } else {
      if (row?.code !== canonicalCourseCode(`${row?.prefix || ''}${row?.number || ''}`)) {
        issue(path, 'sending_course_code_mismatch', {
          code: row?.code ?? null,
          expected: canonicalCourseCode(`${row?.prefix || ''}${row?.number || ''}`),
        });
      }
      if (!finiteId(row?.course_id)) issue(`${path}.course_id`, 'sending_course_id_required');
      else if (sendingIds.has(Number(row.course_id))) {
        issue(`${path}.course_id`, 'sending_course_id_collision', Number(row.course_id));
      } else sendingIds.add(Number(row.course_id));
      if (finiteId(row?.course_id)) sendingById.set(Number(row.course_id), row);
      if (!finiteId(row?.source_id) || Number(row.source_id) !== Number(row?.course_id)) {
        issue(`${path}.source_id`, 'sending_source_id_mismatch', row?.source_id);
      }
      if (!text(row?.course_key) || !text(row?.institution_id)) {
        issue(path, 'sending_course_identity_fields_required');
      }
    }
  }

  const walkRequirementTree = (doc, path, {
    associate,
    receivingOwner = null,
    verifyReceivingMetadata = false,
  }) => {
    if (!Array.isArray(doc?.requirement_groups)) {
      issue(`${path}.requirement_groups`, 'requirement_groups_array_required');
      return;
    }
    doc.requirement_groups.forEach((group, groupIndex) => {
      const groupPath = `${path}.requirement_groups[${groupIndex}]`;
      if (!['and', 'or'].includes(String(group?.group_conjunction || '').toLowerCase())) {
        issue(`${groupPath}.group_conjunction`, 'explicit_group_conjunction_required');
      }
      if (!Array.isArray(group?.sections)) issue(`${groupPath}.sections`, 'sections_array_required');
      asArray(group?.sections).forEach((section, sectionIndex) => {
        const sectionPath = `${groupPath}.sections[${sectionIndex}]`;
        if (!Array.isArray(section?.receivers)) {
          issue(`${sectionPath}.receivers`, 'receivers_array_required');
        }
        asArray(section?.receivers).forEach((receiver, receiverIndex) => {
          const receiverPath = `${sectionPath}.receivers[${receiverIndex}]`;
          if (associate) {
            if (receiver?.receiving != null) issue(`${receiverPath}.receiving`, 'sending_receiver_must_be_option_based');
            if (!['and', 'or'].includes(String(receiver?.options_conjunction || '').toLowerCase())) {
              issue(`${receiverPath}.options_conjunction`, 'explicit_option_conjunction_required');
            }
          }
          if (!Array.isArray(receiver?.options)) issue(`${receiverPath}.options`, 'options_array_required');
          asArray(receiver?.options).forEach((option, optionIndex) => {
            const optionPath = `${receiverPath}.options[${optionIndex}]`;
            if (!['and', 'or'].includes(String(option?.course_conjunction || '').toLowerCase())) {
              issue(`${optionPath}.course_conjunction`, 'explicit_course_conjunction_required');
            }
            for (const id of asArray(option?.course_ids)) {
              if (!sendingIds.has(Number(id))) issue(`${optionPath}.course_ids`, 'sending_course_reference_missing', id);
            }
          });
          const receiving = receiver?.receiving;
          const parentIds = receiving?.kind === 'series'
            ? asArray(receiving?.parent_ids) : [receiving?.parent_id].filter((id) => id != null);
          let exactRefs = [];
          if (receivingOwner && parentIds.length) {
            try {
              exactRefs = institutionReceivingCourseRefs(receiver, receivingOwner);
              const exactIds = exactRefs.map((ref) => ref.parent_id);
              if (JSON.stringify(parentIds.map(Number)) !== JSON.stringify(exactIds)) {
                issue(`${receiverPath}.receiving`, 'receiving_reference_identity_mismatch', {
                  owner: receivingOwner,
                  actual: parentIds,
                  expected: exactIds,
                });
              }
            } catch (error) {
              issue(`${receiverPath}.receiving`, 'receiving_reference_identity_mismatch', {
                owner: receivingOwner,
                detail: error.message,
              });
            }
          }
          for (const [parentIndex, id] of parentIds.entries()) {
            const receivingCourse = receivingById.get(Number(id));
            if (!receivingCourse) {
              issue(`${receiverPath}.receiving`, 'receiving_course_reference_missing', id);
            } else if (receivingOwner && receivingCourse.institution_id !== receivingOwner) {
              issue(`${receiverPath}.receiving`, 'receiving_course_owner_mismatch', {
                parent_id: Number(id),
                expected_owner: receivingOwner,
                actual_owner: receivingCourse.institution_id,
              });
            } else if (verifyReceivingMetadata && exactRefs[parentIndex]) {
              const code = exactRefs[parentIndex].code;
              const expectedTitle = authoredReceivingTitle(doc, code);
              const expectedUnits = exactReceivingUnitEvidence(doc, code);
              if (receivingCourse.title !== expectedTitle) {
                issue(`${receiverPath}.receiving`, 'receiving_course_title_mismatch', {
                  parent_id: Number(id),
                  code,
                  expected: expectedTitle,
                  actual: receivingCourse.title ?? null,
                });
              }
              if (expectedUnits == null) {
                if (receivingCourse.units != null
                    || receivingCourse.min_units != null || receivingCourse.max_units != null
                    || receivingCourse.unit_evidence !== 'not_individually_stated') {
                  issue(`${receiverPath}.receiving`, 'receiving_course_units_invented', {
                    parent_id: Number(id), code,
                    units: receivingCourse.units ?? null,
                    min_units: receivingCourse.min_units ?? null,
                    max_units: receivingCourse.max_units ?? null,
                  });
                }
              } else if (Number(receivingCourse.units) !== expectedUnits
                  || Number(receivingCourse.min_units) !== expectedUnits
                  || Number(receivingCourse.max_units) !== expectedUnits
                  || receivingCourse.unit_evidence === 'not_individually_stated') {
                issue(`${receiverPath}.receiving`, 'receiving_course_units_mismatch', {
                  parent_id: Number(id), code, expected: expectedUnits,
                  units: receivingCourse.units ?? null,
                  min_units: receivingCourse.min_units ?? null,
                  max_units: receivingCourse.max_units ?? null,
                });
              }
            }
          }
        });
      });
    });
  };

  for (const [index, row] of asArray(projection.degrees).entries()) {
    const path = `degrees[${index}]`;
    register(row, path);
    if (row?.kind !== 'degree') issue(`${path}.kind`, 'degree_kind_required');
    if (!finiteId(row?.school_id) || !universityIds.has(row?.institution_id)) {
      issue(path, 'degree_institution_identity_missing');
    }
    if (!text(row?.major_slug) || !text(row?.program)) issue(path, 'degree_program_identity_required');
    if (!(Number(row?.total_units) > 0) || !text(row?.unit_system)) issue(path, 'degree_units_required');
    if (!text(row?.va_requirement_id)) issue(`${path}.va_requirement_id`, 'source_projection_link_required');
    if (requireExactSourceContract) {
      for (const code of canonicalContractIssues(row)) issue(`${path}.analysis_contract`, code);
    }
    walkRequirementTree(row, path, {
      associate: false,
      receivingOwner: row?.institution_id || null,
      verifyReceivingMetadata: true,
    });
    for (const [variantIndex, variant] of asArray(row?.requirement_variants).entries()) {
      walkRequirementTree({
        ...variant,
        course_titles: row?.course_titles,
        course_unit_evidence: row?.course_unit_evidence,
      }, `${path}.requirement_variants[${variantIndex}]`, {
        associate: false,
        receivingOwner: row?.institution_id || null,
        verifyReceivingMetadata: true,
      });
    }
  }

  for (const [index, row] of asArray(projection.asDegrees).entries()) {
    const path = `asDegrees[${index}]`;
    register(row, path);
    if (row?.kind !== 'as_degree' || row?.status !== 'found') issue(path, 'associate_degree_shape_required');
    if (!finiteId(row?.community_college_id)
        || !collegeNumericIds.has(Number(row.community_college_id))) {
      issue(path, 'associate_institution_identity_missing');
    }
    if (!text(row?.major_slug) || !text(row?.degree_type)) issue(path, 'associate_program_identity_required');
    if (!(Number(row?.total_units) > 0) || !text(row?.unit_system)) issue(path, 'associate_units_required');
    if (!text(row?.va_requirement_id)) issue(`${path}.va_requirement_id`, 'source_projection_link_required');
    if (requireExactSourceContract) {
      for (const code of canonicalContractIssues(row)) issue(`${path}.analysis_contract`, code);
    }
    walkRequirementTree(row, path, { associate: true });
    for (const [variantIndex, variant] of asArray(row?.requirement_variants).entries()) {
      walkRequirementTree(variant, `${path}.requirement_variants[${variantIndex}]`, {
        associate: true,
      });
    }
  }

  const associateBySourceId = new Map(asArray(projection.asDegrees)
    .filter((row) => text(row?.va_requirement_id))
    .map((row) => [row.va_requirement_id, row]));
  const associateCourseIds = (row) => new Set(asArray(row?.requirement_groups)
    .flatMap((group) => asArray(group?.sections))
    .flatMap((section) => asArray(section?.receivers))
    .flatMap((receiver) => asArray(receiver?.options))
    .flatMap((option) => asArray(option?.course_ids))
    .map(Number));

  for (const [index, row] of asArray(projection.agreements).entries()) {
    const path = `agreements[${index}]`;
    register(row, path);
    if (!finiteId(row?.uc_school_id) || !finiteId(row?.community_college_id)) {
      issue(path, 'agreement_pair_identity_required');
    }
    if (!text(row?.major) || !Array.isArray(row?.requirement_groups)) {
      issue(path, 'agreement_shared_shape_required');
    }
    const receivingOwner = finiteId(row?.uc_school_id)
      ? `va:uni:${Number(row.uc_school_id)}` : null;
    if (receivingOwner && !universityIds.has(receivingOwner)) {
      issue(`${path}.uc_school_id`, 'agreement_receiving_institution_missing', receivingOwner);
    }
    const offeringRows = asArray(row?.source_named_offerings);
    if (row?.source_named_offerings_contract !== SOURCE_NAMED_OFFERING_CONTRACT
        || !Array.isArray(row?.source_named_offerings)
        || Number(row?.source_named_offerings_count) !== offeringRows.length
        || row?.source_named_offerings_sha256 !== exactRowsSha256(offeringRows)) {
      issue(`${path}.source_named_offerings`, 'source_named_offerings_contract_mismatch');
    }
    for (const [receiptIndex, receipt] of offeringRows.entries()) {
      const receiptPath = `${path}.source_named_offerings[${receiptIndex}]`;
      const source = associateBySourceId.get(receipt?.source_requirement_id);
      const sending = sendingById.get(Number(receipt?.course_id));
      const sourceIds = associateCourseIds(source);
      const expectedCollegeId = Number(row?.community_college_id);
      const expectedCollegeName = collegeNameByNumericId.get(expectedCollegeId);
      if (receipt?.contract !== SOURCE_NAMED_OFFERING_CONTRACT
          || !source
          || Number(source?.community_college_id) !== expectedCollegeId
          || Number(receipt?.community_college_id) !== expectedCollegeId
          || receipt?.college_name !== expectedCollegeName
          || !sending
          || Number(sending?.course_id) !== Number(receipt?.course_id)
          || sending?.course_key !== receipt?.course_key
          || canonicalCourseCode(sending?.prefix + sending?.number) !== receipt?.code
          || !asArray(sending?.offered_by_ids).map(Number).includes(expectedCollegeId)
          || !sourceIds.has(Number(receipt?.course_id))) {
        issue(receiptPath, 'source_named_offering_receipt_not_owner_bound', {
          source_requirement_id: receipt?.source_requirement_id ?? null,
          community_college_id: receipt?.community_college_id ?? null,
          course_id: receipt?.course_id ?? null,
        });
      }
    }
    walkRequirementTree(row, path, { associate: false, receivingOwner });
    for (const [variantIndex, variant] of asArray(row?.requirement_variants).entries()) {
      walkRequirementTree(variant, `${path}.requirement_variants[${variantIndex}]`, {
        associate: false,
        receivingOwner,
      });
    }
  }

  return {
    ready: issues.length === 0,
    contract: 'shared-analysis-projection-v1',
    counts: {
      institutions: asArray(projection.institutions).length,
      courses: asArray(projection.courses).length,
      degrees: asArray(projection.degrees).length,
      associate_degrees: asArray(projection.asDegrees).length,
      agreements: asArray(projection.agreements).length,
    },
    issues,
  };
}

module.exports = { auditCanonicalProjection };
