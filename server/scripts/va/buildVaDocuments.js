#!/usr/bin/env node
/**
 * Project the Virginia corpus into the shared analysis schemas.
 *
 * The Virginia collections (`va_courses`, `va_requirements`, `va_institutions`)
 * are the source of truth and are not modified. This script writes the derived
 * projection the figure engine reads, exactly as the Massachusetts import does:
 *
 *   assist_institutions   universities 9201–9233, colleges 9301–9324
 *   assist_courses        receiving-side four-year courses, sending-side VCCS
 *   curated_requirements  kind `degree` per four-year, `as_degree` per college
 *   assist_agreements     the per-pair join (scripts/va/buildVaAgreements.js)
 *
 * Everything is keyed by `state: 'va'` so a rebuild replaces only Virginia and
 * California/Massachusetts data is never touched.
 *
 * Verification travels with the associate degrees: Virginia's `verification`
 * block has the same shape the California figures filter on
 * (`verification.verified`), so the verified/unverified cohort control works
 * here for the same reason it works in California — we gathered this data and
 * Roy Martinez verifies it.
 *
 *   node scripts/va/buildVaDocuments.js            # report only
 *   node scripts/va/buildVaDocuments.js --source-plan # compare checked-in candidates, read only
 *   node scripts/va/buildVaDocuments.js --apply    # publish only after gate passes
 *   node scripts/va/buildVaDocuments.js --restore=<generation-id>          # validate/preview
 *   node scripts/va/buildVaDocuments.js --restore=<generation-id> --apply  # exact rollback
 *
 * Publication snapshots all four prior Virginia target sets, then replaces all
 * four in one MongoDB transaction. California and Massachusetts rows are never
 * selected by either the snapshot or replacement filter. An incomplete gate
 * can be exercised only in an explicitly allowlisted non-production database with both
 * `--allow-incomplete --staging`; there is no production bypass.
 *
 * This builder is the normalization boundary. `va_requirements` already holds
 * source-walked requirement trees, including exact AND-inside-OR routes and
 * aggregate requirements. This script preserves that evidence while changing
 * only the identifiers/wrappers the shared readers require. Display categories
 * are stamped in memory, so the entire rebuild is one atomic publication:
 *
 *   node scripts/va/buildVaDocuments.js --apply
 *
 * Do not run normalizeVirginiaSchema after this builder: its legacy label and
 * credit heuristics would reinterpret source-authored structures that are now
 * projected directly.
 */
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { BSON, MongoClient } = require('mongodb');
const {
  canonicalSourceContract,
} = require('../../services/analysis/canonicalSourceContract');
const {
  deriveVaAgreements,
  SOURCE_NAMED_OFFERING_CONTRACT,
} = require('./buildVaAgreements');
const { stampDegreeCategories } = require('../normalizeDegreeCategories');
const { parseCourseCode } = require('../../services/vaCourseCodes');
const {
  courseIdFor,
  courseIdentityForNamespace,
  canonicalCourseCode,
  institutionReceivingCourseRefs,
  parseCourseKey,
  projectInstitutionReceivingGroups,
  sharedCourseIdentity,
} = require('../../services/virginia/courseIdentity');
const { auditCourseIdentityResolution } = require('../../services/virginia/courseIdentityAudit');
const {
  buildCourseUnitEvidenceOverlay,
  evidenceOverlaySha256,
} = require('../../services/virginia/courseUnitEvidenceOverlay');
const {
  CONTRACTS: BACHELOR_REQUIREMENT_CAPACITY_CONTRACTS,
  buildBachelorRequirementCapacityEvidenceOverlay,
  projectBachelorRequirementCapacity,
  validateBachelorRequirementCapacityEvidenceOverlay,
} = require('../../services/virginia/bachelorRequirementCapacityEvidence');
const {
  CONTRACTS: ASSOCIATE_CONSTRAINT_METADATA_CONTRACTS,
  buildAssociateConstraintMetadataEvidenceOverlay,
  validateAssociateConstraintMetadataEvidenceOverlay,
} = require('../../services/virginia/associateConstraintMetadataEvidence');
const { documentCourseCatalog } = require('../../services/virginia/institutionCourseCatalog');
const {
  publicationAudit,
  projectionConservationIssues,
  requirementInventory,
} = require('../../services/virginia/publicationReadiness');
const { majorCoreHash } = require('../../services/virginia/majorCoreIntegrity');
const { validateDegreeAcceptance } = require('../../services/virginia/degreeAcceptance');
const {
  requireInstitutionIdentity,
} = require('../../services/virginia/institutionIds');
const {
  acceptanceResolver,
  cachedAcceptedSourcePlan,
  verificationForSourceBundle,
  verifiedCoreConflict,
  verifiedImportConflict,
} = require('../importVirginiaCatalogDegrees');
const {
  validateVirginiaFigure6PrerequisiteSources,
} = require('../../services/virginia/pathwayComplexityPrerequisites');
const {
  validateUniversityPrerequisiteScope,
} = require('../../services/virginia/universityPrerequisiteScope');
const {
  auditVirginiaProjectionEquivalencyConditions,
} = require('../../services/analysis/transferCreditRate');
const {
  buildVirginiaAnalysisPublicationReceipt,
  buildVirginiaUncertifiedPublicationReceipt,
} = require('../../services/virginia/analysisPublicationGate');
const {
  allocateVirginiaPublicationTransition,
  persistVirginiaPublicationTransition,
} = require('../../services/virginia/publicationTransition');
const {
  buildPublicationVerificationReview,
  sourcePlanFromVerificationReview,
  validatePublicationVerificationReview,
} = require('../../services/virginia/publicationVerificationReview');

const VCCS_FIGURE6_SCOPE = require('../../.va-degrees/cs_course_scope.json');
const UNIVERSITY_FIGURE6_SCOPE = require(
  '../../.va-catalogs/research/va-university-prerequisite-scope.json',
);

const MAJOR_SLUG = 'va-cs';
const PROGRAM = 'Computer Science, B.S.';
const SOURCE_METHOD = 'Derived from Transfer Virginia course equivalencies and published degree '
  + 'requirements; see docs/virginia-courses.md and docs/virginia-degree-collection.md';

const VA_TARGETS = Object.freeze([
  Object.freeze({ collection: 'assist_institutions', projectionKey: 'institutions' }),
  Object.freeze({ collection: 'assist_courses', projectionKey: 'courses' }),
  Object.freeze({ collection: 'assist_agreements', projectionKey: 'agreements' }),
  Object.freeze({ collection: 'curated_requirements', projectionKey: 'requirements' }),
]);
const VA_FILTER = Object.freeze({ state: 'va' });
const REVISION_COLLECTION = 'va_projection_revisions';
const REVISION_DOCUMENT_COLLECTION = 'va_projection_revision_documents';
const SNAPSHOT_SCHEMA_VERSION = 1;
const INCOMPLETE_OVERRIDE_DATABASES = new Set([
  'pmt_research_preview',
  'pmt_research_sandbox',
  'pmt_research_staging',
  'pmt_research_test',
]);
// Publication preflights are deliberately process-local capabilities. A
// caller cannot deserialize or hand-construct a passing report and reach the
// writer: the report must be the exact, untampered object returned by
// publicationPreflight in this process.
const PREFLIGHT_ATTESTATIONS = new WeakMap();

const idSlug = (row) => String(row?._id ?? '').replace(/^va:(inst|uni|cc):/, '');
const degreeSlug = (degree) => String(degree?.institution_id ?? '').replace(/^va:(uni|inst):/, '');
const collegeSlugOf = (doc) => String(doc?.community_college_id ?? doc?.college_id ?? '')
  .replace(/^va:(cc|inst):/, '');

const VALID_GROUP_SOURCE = new Set(['extracted', 'template_default', 'curated']);
const GROUP_ID_RE = /^[a-z0-9_]+$/;
const clone = (value) => value == null ? value : structuredClone(value);

const idPart = (value) => String(value ?? '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);

function uniqueGroupId(group, index, used) {
  const original = String(group?.group_id || '');
  const base = GROUP_ID_RE.test(original)
    ? original
    : idPart(group?.label_seen || group?.title || original) || `requirement_${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function unresolvedCitation(value, fallback, extra = {}) {
  if (value && typeof value === 'object' && typeof value.course_code_seen === 'string') {
    return clone(value);
  }
  const raw = typeof value === 'string' ? value : null;
  return {
    ...(value && typeof value === 'object' ? clone(value) : {}),
    course_code_seen: raw || fallback || 'Unenumerated catalog requirement',
    title_seen: raw || fallback || null,
    ...(value != null ? { source_value: clone(value) } : {}),
    ...extra,
  };
}

function unresolvedReceiver(receiver, fallback, reason) {
  const receiving = receiver?.receiving || {};
  const units = Number(receiving.units);
  return unresolvedCitation(null,
    receiver?.code_seen || receiving.code || receiving.name || fallback,
    {
      title_seen: receiving.name || receiver?.human_review || fallback || null,
      units_seen: Number.isFinite(units) && units > 0 ? units : null,
      reason,
      // Retain the exact rejected wrapper. A later resolver can reconstruct the
      // source ask instead of reverse-engineering it from a warning string.
      source_receiver: clone(receiver),
    });
}

function sourceOptionIdentities(option, courseNamespace = null) {
  const ids = Array.isArray(option?.course_ids) ? option.course_ids.map(Number) : [];
  const keys = Array.isArray(option?.course_keys) ? option.course_keys : [];
  if (!ids.length || ids.some((id) => !Number.isInteger(id))) return null;
  // A readable source key is the stable identity; numeric ids are projection
  // mechanics. Remint both legacy VCCS ids and institution-local ids from that
  // key. If a shared source predates keys, retain its ids; an explicit local
  // namespace cannot safely do so because owner scope cannot be recovered.
  if (!keys.length && courseNamespace == null) return { ids, keys, legacyKeys: null };
  if (keys.length !== ids.length) return null;
  try {
    const identities = keys.map((key) => {
      const parsed = parseCourseKey(key);
      return parsed ? courseIdentityForNamespace(parsed.code, courseNamespace) : null;
    });
    if (identities.some((identity) => identity == null)) return null;
    const canonicalKeys = identities.map((identity) => identity.course_key);
    return {
      ids: identities.map((identity) => identity.course_id),
      keys: canonicalKeys,
      legacyKeys: keys.some((key, index) => key !== canonicalKeys[index]) ? keys : null,
    };
  } catch (_) {
    return null;
  }
}

function normalizedSourceRequirementGroups(source) {
  const groups = clone(source?.requirement_groups || []);
  for (const group of groups) {
    for (const section of group?.sections || []) {
      for (const receiver of section?.receivers || []) {
        for (const option of receiver?.options || []) {
          const normalized = sourceOptionIdentities(option, source?.course_namespace || null);
          if (!normalized) continue;
          option.course_ids = normalized.ids;
          option.course_keys = normalized.keys;
        }
      }
    }
  }
  return groups;
}

function projectAsOption(option, courseNamespace = null) {
  const normalized = sourceOptionIdentities(option, courseNamespace);
  if (!normalized) return null;
  const courseIds = normalized.ids;
  const sourceKeys = normalized.keys;
  const courseKeys = courseIds.map((id) => `cc:${id}`);
  return {
    ...clone(option),
    course_ids: courseIds,
    course_conjunction: option?.course_conjunction || 'and',
    course_keys: courseKeys,
    ...(sourceKeys.length && sourceKeys.some((key, index) => key !== courseKeys[index])
      ? { source_course_keys: sourceKeys }
      : {}),
    ...(normalized.legacyKeys ? { legacy_source_course_keys: normalized.legacyKeys } : {}),
  };
}

function projectAsReceiver(receiver, fallback, unresolved, courseNamespace = null) {
  const rawOptions = Array.isArray(receiver?.options) ? receiver.options : [];
  const options = [];
  for (const option of rawOptions) {
    const projected = projectAsOption(option, courseNamespace);
    if (projected) options.push(projected);
    else unresolved.push(unresolvedReceiver(
      { ...receiver, options: [option] }, fallback, 'invalid_or_empty_course_option',
    ));
  }
  if (!options.length) {
    if (!rawOptions.length) {
      unresolved.push(unresolvedReceiver(receiver, fallback, 'no_resolved_course_option'));
    }
    return null;
  }
  return {
    ...clone(receiver),
    receiving: null,
    articulation_status: 'articulated',
    not_articulated_reason: null,
    options,
    options_conjunction: receiver?.options_conjunction
      || (options.length > 1 ? 'or' : 'and'),
    hash_id: receiver?.hash_id ?? null,
    ...(receiver?.receiving != null ? { source_receiving: clone(receiver.receiving) } : {}),
  };
}

/**
 * Receiving-side course rows for one four-year degree.
 *
 * The requirement groups passed here have already crossed the projection
 * boundary, so every parent id is owner + code scoped. The source code-only id
 * remains explicit provenance and is never used as a shared-schema join key.
 */
function exactReceivingUnitEvidenceByCode(degree) {
  const byCode = new Map();
  for (const evidence of degree?.course_unit_evidence || []) {
    const code = canonicalCourseCode(evidence?.code);
    const min = Number(evidence?.min_units ?? evidence?.units);
    const max = Number(evidence?.max_units ?? evidence?.units);
    if (!code || !Number.isFinite(min) || !Number.isFinite(max)
        || min <= 0 || max <= 0 || Math.abs(min - max) > 0.000001) continue;
    const prior = byCode.get(code);
    if (prior && (prior.min_units !== min || prior.max_units !== max)) {
      throw new Error(
        `conflicting Virginia receiving unit evidence for ${degree?._id || '<unknown degree>'} ${code}`,
      );
    }
    if (!prior) byCode.set(code, {
      min_units: min,
      max_units: max,
      evidence: evidence?.evidence || 'exact_course_unit_evidence',
      source_refs: clone(evidence?.source_refs || []),
      source_paths: clone(evidence?.source_paths || []),
    });
  }
  return byCode;
}

function authoredReceivingTitle(degree, code) {
  const titles = degree?.course_titles || {};
  if (typeof titles[code] === 'string' && titles[code].trim()) return titles[code].trim();
  const entry = Object.entries(titles).find(([candidate]) => (
    canonicalCourseCode(candidate) === code
  ));
  return typeof entry?.[1] === 'string' && entry[1].trim()
    ? entry[1].trim() : code;
}

function receivingCourses(degree, requirementGroups, institutionId) {
  const rows = new Map();
  const unitEvidenceByCode = exactReceivingUnitEvidenceByCode(degree);
  for (const group of requirementGroups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        const receiving = receiver.receiving || {};
        const refs = institutionReceivingCourseRefs(receiver, institutionId);
        refs.forEach((ref) => {
          const { code, parent_id: parentId } = ref;
          // The source tree uses the legacy code-only wrapper. `requirementGroups`
          // may already be owner-reminted, so it cannot supply this provenance
          // field reliably; derive it from the exact authored code instead.
          const sourceParentId = courseIdFor(code);
          if (rows.has(parentId)) {
            const prior = rows.get(parentId);
            if (prior.code !== code || prior.institution_id !== institutionId) {
              throw new Error(
                `Virginia receiving id collision ${parentId}: `
                  + `${prior.institution_id} ${prior.code} vs ${institutionId} ${code}`,
              );
            }
            return;
          }
          const parsed = parseCourseCode(code);
          const unitEvidence = unitEvidenceByCode.get(code) || null;
          rows.set(parentId, {
            _id: `va:receiving:${parentId}`,
            institution_id: institutionId,
            source_id: parentId,
            source_parent_id: sourceParentId,
            side: 'receiving',
            parent_id: parentId,
            code,
            course_key: ref.course_key,
            identity_scope: 'institution_local',
            identity_contract: 'owner_plus_course_id',
            vccs_master_applicable: false,
            prefix: parsed.prefix || '',
            number: parsed.number != null ? String(parsed.number) : '',
            title: authoredReceivingTitle(degree, code),
            title_evidence: authoredReceivingTitle(degree, code) === code
              ? 'course_code_fallback' : 'degree_course_titles',
            min_units: unitEvidence?.min_units ?? null,
            max_units: unitEvidence?.max_units ?? null,
            units: unitEvidence?.min_units ?? null,
            unit_evidence: unitEvidence?.evidence || 'not_individually_stated',
            unit_source_refs: unitEvidence?.source_refs || [],
            unit_source_paths: unitEvidence?.source_paths || [],
            source_requirement_id: degree?._id ?? null,
            state: 'va',
          });
        });
      }
    }
  }
  return [...rows.values()];
}

/**
 * Project a source requirement tree without reinterpreting it.
 *
 * Source-composed documents already encode choices structurally. In
 * particular, one receiver option may contain an entire AND route, and a
 * group may explicitly be `Or`. Preserve those shapes; labels are provenance,
 * never instructions to rewrite the tree.
 */
function projectGroups(source, { associate = source?.kind === 'as_degree' } = {}) {
  const usedIds = new Set();
  const confidence = Number.isFinite(source?.extraction?.confidence)
    ? source.extraction.confidence : 0;
  return (source?.requirement_groups || []).map((rawGroup, index) => {
    const group = clone(rawGroup) || {};
    const label = group.label_seen || group.title || group.group_id || `Requirement ${index + 1}`;
    const groupId = uniqueGroupId(group, index, usedIds);
    const unresolved = (Array.isArray(group.unresolved_courses_seen)
      ? group.unresolved_courses_seen : []).map((value) => unresolvedCitation(value, label));
    const sections = (group.sections || []).map((rawSection) => {
      const section = clone(rawSection) || {};
      if (!associate) {
        return {
          ...section,
          label_seen: section.label_seen || section.title || null,
          assume_satisfiable: section.assume_satisfiable === true,
          receivers: (section.receivers || []).map((receiver) => clone(receiver)),
        };
      }
      const receivers = [];
      for (const receiver of section.receivers || []) {
        const projected = projectAsReceiver(
          receiver,
          section.label_seen || label,
          unresolved,
          source?.course_namespace || null,
        );
        if (projected) receivers.push(projected);
      }
      return {
        ...section,
        label_seen: section.label_seen || section.title || null,
        assume_satisfiable: section.assume_satisfiable === true,
        receivers,
      };
    });

    const explicitNonCourse = group.non_course === true
      || group.kind === 'non_course'
      || group.requirement_kind === 'non_course';
    if (associate && !sections.length && group.units_fill !== true
        && group.ge_area == null && !explicitNonCourse && !unresolved.length) {
      unresolved.push(unresolvedCitation(null, label, {
        reason: 'empty_substantive_requirement_group',
        source_group: clone(rawGroup),
      }));
    }

    const projected = {
      ...group,
      group_id: groupId,
      label_seen: label,
      title: group.title || label,
      group_conjunction: group.group_conjunction || group.conjunction || 'And',
      sections,
    };
    if (!associate) return projected;

    const groupSource = VALID_GROUP_SOURCE.has(group.source) ? group.source : 'extracted';
    return {
      ...projected,
      ...(group.group_id && group.group_id !== groupId ? { source_group_id: group.group_id } : {}),
      template_group: group.template_group ?? null,
      source: groupSource,
      confidence: groupSource === 'extracted'
        ? (Number.isFinite(group.confidence) ? group.confidence : confidence)
        : null,
      curated_by: group.curated_by ?? null,
      ge_area: group.ge_area ?? null,
      units_fill: group.units_fill === true,
      unresolved_courses_seen: unresolved,
    };
  });
}

function sourceProvenanceScore(source) {
  if (source?.source_method === 'official_catalog_composition'
      && source?.source === 'institution_catalog') return 4;
  if (source?.source === 'institution_catalog') return 3;
  if (source?.source_method === 'official_catalog_composition') return 2;
  if (source?.source === 'transferva_program_map') return 1;
  return 0;
}

function associateSourceRank(source) {
  const provenance = sourceProvenanceScore(source);
  return [
    source?.acceptance?.ready_for_analysis === true ? 1 : 0,
    provenance >= 2 ? 1 : 0,
    source?.verification?.verified === true ? 1 : 0,
    source?.acceptance?.accepted === true ? 1 : 0,
    provenance,
    source?.primary === true ? 1 : 0,
  ];
}

function compareAssociateSources(a, b) {
  const left = associateSourceRank(a);
  const right = associateSourceRank(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return right[index] - left[index];
  }
  return String(a?._id || '').localeCompare(String(b?._id || ''));
}

const ASSOCIATE_SOURCE_DISPOSITION_CONTRACT =
  'va-associate-source-disposition-v1';

function associateRequirementSemanticMaterial(source) {
  const inventory = requirementInventory(source || {});
  // Acceptance is an executable release receipt and titles are a display
  // cache.  Neither should make two otherwise identical curricular trees look
  // semantically different.  The protected-core hash below remains the
  // stricter comparison and includes every authored major-core field.
  delete inventory.acceptance_receipt;
  delete inventory.course_titles;
  return inventory;
}

function stableAssociateDisposition(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableAssociateDisposition);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stableAssociateDisposition(value[key])]));
}

function associateRequirementSemanticHash(source) {
  return createHash('sha256')
    .update(JSON.stringify(stableAssociateDisposition(
      associateRequirementSemanticMaterial(source),
    )))
    .digest('hex');
}

function verificationDisposition(source) {
  return {
    verified: source?.verification?.verified === true,
    verified_by: source?.verification?.verified_by || null,
    verified_at: source?.verification?.verified_at || null,
    stale: source?.verification?.stale === true,
  };
}

function associateSourceDisposition(chosen, alternate) {
  const chosenCoreHash = majorCoreHash(chosen || {});
  const alternateCoreHash = majorCoreHash(alternate || {});
  const chosenSemanticHash = associateRequirementSemanticHash(chosen);
  const alternateSemanticHash = associateRequirementSemanticHash(alternate);
  const differingFields = projectionConservationIssues(alternate, chosen)
    .map((issue) => issue?.field)
    .filter((field) => field && !['acceptance_receipt', 'course_titles'].includes(field))
    .sort();
  const chosenVerification = verificationDisposition(chosen);
  const alternateVerification = verificationDisposition(alternate);
  const safetyIssues = [];
  const selectedCurrentlyVerified = chosenVerification.verified
    && !chosenVerification.stale;
  if (alternateVerification.verified && !selectedCurrentlyVerified) {
    safetyIssues.push('verified_alternate_replaced_by_unverified_source');
  }
  if (alternateVerification.verified && chosenCoreHash !== alternateCoreHash
      && !selectedCurrentlyVerified) {
    safetyIssues.push('verified_alternate_major_core_not_reverified');
  }
  return {
    contract: ASSOCIATE_SOURCE_DISPOSITION_CONTRACT,
    college_slug: collegeSlugOf(chosen),
    selected_source_id: chosen?._id || null,
    alternate_source_id: alternate?._id || null,
    disposition: 'superseded_by_selected_source',
    projected: false,
    selected_provenance: {
      source: chosen?.source || null,
      source_method: chosen?.source_method || null,
      catalog_year: chosen?.catalog_year || null,
    },
    alternate_provenance: {
      source: alternate?.source || null,
      source_method: alternate?.source_method || null,
      catalog_year: alternate?.catalog_year || null,
    },
    selected_verification: chosenVerification,
    alternate_verification: alternateVerification,
    comparison: {
      selected_major_core_sha256: chosenCoreHash,
      alternate_major_core_sha256: alternateCoreHash,
      exact_major_core_match: chosenCoreHash === alternateCoreHash,
      selected_requirement_semantics_sha256: chosenSemanticHash,
      alternate_requirement_semantics_sha256: alternateSemanticHash,
      exact_requirement_semantics_match: chosenSemanticHash === alternateSemanticHash,
      differing_requirement_fields: differingFields,
    },
    safe: safetyIssues.length === 0,
    issues: safetyIssues,
  };
}

function selectAssociateSources(asDegrees) {
  const byCollege = new Map();
  for (const source of asDegrees || []) {
    // `extracted` is the source collection's positive-degree contract. A
    // coverage/negative/superseded record must never become a found degree just
    // because it has attractive verification metadata.
    if (source?.status !== 'extracted') continue;
    const slug = collegeSlugOf(source);
    if (!slug) continue;
    if (!byCollege.has(slug)) byCollege.set(slug, []);
    byCollege.get(slug).push(source);
  }
  const selected = [];
  const alternates = [];
  const dispositions = [];
  for (const candidates of byCollege.values()) {
    const sorted = [...candidates].sort(compareAssociateSources);
    selected.push(sorted[0]);
    if (sorted.length > 1) {
      const candidateDispositions = sorted.slice(1)
        .map((source) => associateSourceDisposition(sorted[0], source));
      dispositions.push(...candidateDispositions);
      alternates.push({
        chosen: sorted[0]._id,
        chosen_rank: associateSourceRank(sorted[0]),
        dropped: sorted.slice(1).map((source) => source._id),
        dispositions: candidateDispositions,
      });
    }
  }
  return { selected, alternates, dispositions };
}

/**
 * Course supply proved by an official community-college degree document.
 *
 * This fills only a missing VCCS master row. A requirement citation proves
 * that its owning college offers the named course, but it does not always
 * prove that course's individual credits. Credits therefore travel only from
 * a one-course choice whose section explicitly selects one course; bundled or
 * variable-credit sections remain null and visible to the readiness audit.
 */
function sourceNamedSharedCourseEvidence(source, { collegeId, collegeName }) {
  if (source?.course_namespace != null) return [];
  return documentCourseCatalog({
    codes: source?.codes_seen || [],
    courseTitles: source?.course_titles || {},
    requirementGroups: normalizedSourceRequirementGroups(source),
    unitEvidence: source?.course_unit_evidence || [],
    namespace: null,
    requirementOwnerId: source?.community_college_id ?? source?.college_id ?? null,
    sourceDocumentId: source?._id ?? null,
  }).map((entry) => ({
    ...entry,
    college_id: collegeId,
    college_name: collegeName,
    title_observations: entry.title ? [entry.title] : [],
    unit_ranges: Number.isFinite(entry.min_units) && Number.isFinite(entry.max_units)
      ? [[entry.min_units, entry.max_units]] : [],
    source_requirement_id: source._id,
  }));
}

/**
 * Add only owner-bound offerings proved by a selected official associate
 * degree. The shared VCCS course and its four-year articulation edges must
 * already exist; a requirement citation can add its own college to the offer
 * roster but cannot invent a course or an equivalency.
 */
function augmentAgreementCourseOfferings({
  courses,
  associateSources,
  collegeIdBySlug,
  nameBySlug,
}) {
  const projected = (courses || []).map((course) => clone(course));
  const byCourseId = new Map(projected
    .filter((course) => Number.isInteger(Number(course?.course_id)))
    .map((course) => [Number(course.course_id), course]));
  const receipts = [];
  for (const source of associateSources || []) {
    const slug = collegeSlugOf(source);
    const collegeId = collegeIdBySlug.get(slug);
    const collegeName = nameBySlug.get(slug);
    if (collegeId == null || !collegeName) continue;
    const evidenceRows = sourceNamedSharedCourseEvidence(source, { collegeId, collegeName });
    for (const evidence of evidenceRows) {
      const expected = sharedCourseIdentity(evidence.code);
      const course = byCourseId.get(Number(evidence.course_id));
      if (!expected || !course) continue;
      if (Number(evidence.course_id) !== expected.course_id
          || evidence.course_key !== expected.course_key
          || Number(course.course_id) !== expected.course_id
          || canonicalCourseCode(course.code) !== expected.code
          || course.course_key !== expected.course_key) {
        throw new Error(
          `Virginia source-named offering identity conflict for ${source?._id} ${evidence.code}`,
        );
      }
      const offered = Array.isArray(course.offered_by) ? course.offered_by : [];
      if (offered.includes(collegeName)) continue;
      course.offered_by = [...offered, collegeName].sort();
      const receipt = {
        contract: SOURCE_NAMED_OFFERING_CONTRACT,
        source_requirement_id: source._id,
        community_college_id: collegeId,
        college_name: collegeName,
        course_id: expected.course_id,
        course_key: expected.course_key,
        code: expected.code,
        source_refs: [...new Set(evidence.source_refs || [])].sort(),
      };
      course.source_named_offering_receipts = [
        ...(course.source_named_offering_receipts || []),
        receipt,
      ];
      receipts.push(receipt);
    }
  }
  receipts.sort((left, right) => (
    left.community_college_id - right.community_college_id
      || left.course_id - right.course_id
      || left.source_requirement_id.localeCompare(right.source_requirement_id)
  ));
  return {
    courses: projected,
    contract: SOURCE_NAMED_OFFERING_CONTRACT,
    added_offerings: receipts.length,
    receipts,
  };
}

function localSendingCourses(source, { collegeId, collegeName }) {
  if (source?.course_namespace?.kind !== 'institution_local') return [];
  const normalizedGroups = normalizedSourceRequirementGroups(source);
  // Rebuild this derived catalog from the verified source document. This lets
  // projection repair stale identity wrappers without requiring a write to
  // `va_requirements`; it cannot add a course the source did not name.
  const catalog = documentCourseCatalog({
    codes: source?.codes_seen || [],
    courseTitles: source?.course_titles || {},
    requirementGroups: normalizedGroups,
    unitEvidence: source?.course_unit_evidence || [],
    namespace: source.course_namespace,
    requirementOwnerId: source?.community_college_id ?? source?.college_id ?? null,
    sourceDocumentId: source?._id ?? null,
  });
  return catalog
    .filter((row) => Number.isInteger(Number(row?.course_id)))
    .map((row) => {
      const parsed = parseCourseCode(row.code);
      return {
        ...clone(row),
        _id: `va:sending:${Number(row.course_id)}`,
        source_id: Number(row.course_id),
        course_id: Number(row.course_id),
        side: 'sending',
        state: 'va',
        prefix: parsed.prefix || '',
        number: parsed.number != null ? String(parsed.number) : '',
        offered_by: [collegeName],
        offered_by_ids: [collegeId],
        sending_eligible: true,
        source: 'institution_catalog_requirement',
        source_requirement_ids: [source._id],
      };
    });
}

function mergeSourceNamedSharedCourses(courseById, evidenceRows) {
  const sourceUnitOverrides = (rows, prior = []) => {
    const bySource = new Map();
    for (const row of rows) {
      const sourceId = row?.source_requirement_id;
      const min = Number(row?.min_units);
      const max = Number(row?.max_units);
      if (!sourceId || !Number.isFinite(min) || !Number.isFinite(max)
          || min <= 0 || Math.abs(min - max) > 0.000001) continue;
      if (!bySource.has(sourceId)) bySource.set(sourceId, []);
      bySource.get(sourceId).push({ row, units: min });
    }
    const next = [];
    for (const [sourceId, observations] of bySource) {
      const values = [...new Set(observations.map((entry) => entry.units))];
      if (values.length !== 1) continue;
      const row = observations[0].row;
      next.push({
        source_requirement_id: sourceId,
        requirement_owner_id: row.requirement_owner_id ?? null,
        units: values[0],
        min_units: values[0],
        max_units: values[0],
        unit_evidence: row.unit_evidence,
        source_refs: [...new Set(observations.flatMap((entry) => entry.row.source_refs || []))].sort(),
      });
    }
    const merged = new Map((prior || []).map((row) => [row.source_requirement_id, clone(row)]));
    for (const row of next) merged.set(row.source_requirement_id, row);
    return [...merged.values()].sort((a, b) => (
      String(a.source_requirement_id).localeCompare(String(b.source_requirement_id))
    ));
  };
  const byId = new Map();
  for (const evidence of evidenceRows) {
    if (!byId.has(evidence.course_id)) byId.set(evidence.course_id, []);
    byId.get(evidence.course_id).push(evidence);
  }
  for (const [courseId, evidence] of byId) {
    const id = `va:sending:${courseId}`;
    const existing = courseById.get(id);
    const offeredBy = [...new Set([
      ...(existing?.offered_by || []),
      ...evidence.map((row) => row.college_name),
    ])].filter(Boolean).sort();
    const offeredByIds = [...new Set([
      ...(existing?.offered_by_ids || []).map(Number),
      ...evidence.map((row) => Number(row.college_id)),
    ])].filter(Number.isFinite).sort((a, b) => a - b);
    const requirementIds = [...new Set([
      ...(existing?.source_requirement_ids || []),
      ...evidence.map((row) => row.source_requirement_id),
    ])].filter(Boolean).sort();
    const unitOverrides = sourceUnitOverrides(
      evidence,
      existing?.units_by_source_requirement || [],
    ).map((row) => ({
      ...row,
      differs_from_global: Number.isFinite(Number(existing?.units))
        ? Math.abs(Number(existing.units) - row.units) > 0.000001
        : null,
    }));
    if (existing) {
      courseById.set(id, {
        ...existing,
        offered_by: offeredBy,
        offered_by_ids: offeredByIds,
        source_requirement_ids: requirementIds,
        ...(unitOverrides.length ? { units_by_source_requirement: unitOverrides } : {}),
      });
      continue;
    }

    const identity = evidence[0];
    const titles = [...new Set(evidence.flatMap((row) => row.title_observations))].sort();
    const ranges = evidence.flatMap((row) => row.unit_ranges)
      .map(([min, max]) => `${min}:${max}`);
    const uniqueRanges = [...new Set(ranges)];
    const conflictingEvidence = evidence.some((row) => (
      row.unit_evidence === 'conflicting_source_sections'
    ));
    const exactUnits = !conflictingEvidence && uniqueRanges.length === 1;
    const [minUnits, maxUnits] = exactUnits
      ? uniqueRanges[0].split(':').map(Number)
      : [null, null];
    const unitObservations = [...new Set(evidence
      .flatMap((row) => row.unit_observations || []))].sort((a, b) => a - b);
    const unitMaxObservations = [...new Set(evidence
      .flatMap((row) => row.unit_max_observations || []))].sort((a, b) => a - b);
    const parsed = parseCourseCode(identity.code);
    courseById.set(id, {
      _id: id,
      code: identity.code,
      course_id: identity.course_id,
      course_key: identity.course_key,
      institution_id: identity.institution_id,
      identity_scope: identity.identity_scope,
      identity_contract: identity.identity_contract,
      vccs_master_applicable: identity.vccs_master_applicable,
      source_id: identity.course_id,
      side: 'sending',
      state: 'va',
      prefix: parsed.prefix || '',
      number: parsed.number != null ? String(parsed.number) : '',
      title: titles.length === 1 ? titles[0] : null,
      title_observations: titles,
      units: minUnits,
      min_units: minUnits,
      max_units: maxUnits,
      unit_evidence: exactUnits
        ? 'single_course_source_section'
        : (conflictingEvidence || uniqueRanges.length > 1)
          ? 'conflicting_source_sections' : 'not_individually_stated',
      unit_observations: unitObservations,
      unit_max_observations: unitMaxObservations,
      offered_by: offeredBy,
      offered_by_ids: offeredByIds,
      sending_eligible: true,
      source: 'institution_catalog_requirement',
      source_requirement_ids: requirementIds,
      source_refs: [...new Set(evidence.flatMap((row) => row.source_refs))].sort(),
      ...(unitOverrides.length ? { units_by_source_requirement: unitOverrides } : {}),
    });
  }
}

/**
 * The Transfer Virginia equivalency corpus is intentionally the source of
 * `va_institutions`, so a university that publishes no equivalencies may be
 * absent even though its official degree document is in scope (currently UVA
 * and VMI). Add those source-backed owners after the sorted equivalency roster:
 * existing numeric ids stay stable, while the omission is classified honestly
 * as "no published course equivalencies" rather than "no institution record".
 */
function completeInstitutionRoster(institutions, degrees, asDegrees) {
  const byLevel = {
    community_college: (institutions || [])
      .filter((row) => row?.level === 'community_college')
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    four_year: (institutions || [])
      .filter((row) => row?.level === 'four_year')
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
  };
  const known = new Set([
    ...byLevel.community_college,
    ...byLevel.four_year,
  ].map((row) => idSlug(row)));
  const appendMissing = (documents, level, prefix, nameOf) => {
    const missing = [];
    for (const document of documents || []) {
      const owner = String(document?.institution_id
        ?? document?.community_college_id
        ?? document?.college_id
        ?? '');
      const slug = owner.replace(/^va:(?:uni|cc|inst):/, '');
      if (!slug || known.has(slug)) continue;
      known.add(slug);
      missing.push({
        _id: `va:${prefix}:${slug}`,
        slug,
        level,
        name: nameOf(document) || slug.replace(/-/g, ' '),
        source: 'official_requirement_document',
        source_requirement_id: document?._id ?? null,
        source_url: document?.source_url ?? document?.catalog_url ?? null,
      });
    }
    missing.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    byLevel[level].push(...missing);
  };
  appendMissing(
    asDegrees,
    'community_college',
    'cc',
    (doc) => doc?.college_name || doc?.school || doc?.institution_name,
  );
  appendMissing(
    degrees,
    'four_year',
    'uni',
    (doc) => doc?.school || doc?.institution_name,
  );
  for (const [level, documents] of Object.entries(byLevel)) {
    for (const document of documents) {
      requireInstitutionIdentity(idSlug(document), level);
    }
    documents.sort((left, right) => (
      requireInstitutionIdentity(idSlug(left), level).id
        - requireInstitutionIdentity(idSlug(right), level).id
    ));
  }
  return byLevel;
}

function buildProjection({
  courses,
  degrees,
  asDegrees,
  institutions,
  requirementCapacityEvidenceOverlay = null,
}) {
  const roster = completeInstitutionRoster(institutions, degrees, asDegrees);
  const colleges = roster.community_college;
  const universities = roster.four_year;

  const collegeIdBySlug = new Map(colleges.map((row) => [
    idSlug(row), requireInstitutionIdentity(idSlug(row), 'community_college').id,
  ]));
  const universityIdBySlug = new Map(universities.map((row) => [
    idSlug(row), requireInstitutionIdentity(idSlug(row), 'four_year').id,
  ]));
  const nameBySlug = new Map([...colleges, ...universities].map((row) => [idSlug(row), row.name]));

  const {
    selected: chosenAsDegrees,
    alternates: asAlternates,
    dispositions: associateSourceDispositions,
  }
    = selectAssociateSources(asDegrees);
  const agreementOfferingAugmentation = augmentAgreementCourseOfferings({
    courses,
    associateSources: chosenAsDegrees,
    collegeIdBySlug,
    nameBySlug,
  });
  const agreements = deriveVaAgreements({
    courses: agreementOfferingAugmentation.courses,
    degrees,
    colleges,
    universities,
  });
  // Only institutions that actually carry agreements enter the projection; a
  // four-year with requirements but no published equivalencies would otherwise
  // render as a column of zeroes rather than as absent.
  const activeUniversities = new Set(agreements.map((a) => a.uc_school_id));

  const institutionDocs = [
    ...universities
      .filter((row) => activeUniversities.has(universityIdBySlug.get(idSlug(row))))
      .map((row) => {
        const schoolId = universityIdBySlug.get(idSlug(row));
        return {
          _id: `va:uni:${schoolId}`,
          institution_id: `va:uni:${schoolId}`,
          kind: 'university',
          source_id: schoolId,
          name: row.name,
          state: 'va',
          academic_calendar: 'semester',
          va_institution_id: row._id,
        };
      }),
    ...colleges.map((row) => {
      const collegeId = collegeIdBySlug.get(idSlug(row));
      return {
        _id: `va:cc:${collegeId}`,
        institution_id: `va:cc:${collegeId}`,
        kind: 'community_college',
        source_id: collegeId,
        name: row.name,
        state: 'va',
        academic_calendar: 'semester',
        va_institution_id: row._id,
      };
    }),
  ];

  // Receiving ids are owner-scoped. A duplicate within one owner/code is the
  // same projected catalog course; any different identity sharing its hash is
  // an error, never a first-wins row loss.
  const courseById = new Map();
  const degreeDocs = [];
  for (const degree of degrees) {
    const schoolId = universityIdBySlug.get(degreeSlug(degree));
    if (schoolId == null || !activeUniversities.has(schoolId)) continue;
    const institutionId = `va:uni:${schoolId}`;
    const capacityProjection = projectBachelorRequirementCapacity({
      sourceDocument: degree,
      requirementGroups: projectGroups(degree, { associate: false }),
      overlay: requirementCapacityEvidenceOverlay,
    });
    const requirementGroups = projectInstitutionReceivingGroups(
      capacityProjection.requirement_groups,
      institutionId,
    );
    const requirementVariants = (degree.requirement_variants || []).map((variant) => ({
      ...clone(variant),
      requirement_groups: projectInstitutionReceivingGroups(
        variant?.requirement_groups || [],
        institutionId,
      ),
    }));
    const allReceivingGroups = [
      ...requirementGroups,
      ...requirementVariants.flatMap((variant) => variant.requirement_groups || []),
    ];
    for (const row of receivingCourses(degree, allReceivingGroups, institutionId)) {
      const prior = courseById.get(row._id);
      if (prior && (prior.parent_id !== row.parent_id
          || prior.institution_id !== row.institution_id
          || prior.code !== row.code
          || prior.course_key !== row.course_key)) {
        throw new Error(
          `Virginia receiving course collision ${row._id}: `
            + `${prior.institution_id} ${prior.code} vs ${row.institution_id} ${row.code}`,
        );
      }
      if (!prior) courseById.set(row._id, row);
    }
    const projectedDegree = {
      ...clone(degree),
      _id: `degree:${schoolId}:${MAJOR_SLUG}`,
      kind: 'degree',
      major_slug: MAJOR_SLUG,
      state: 'va',
      school_id: schoolId,
      institution_id: `va:uni:${schoolId}`,
      school: nameBySlug.get(degreeSlug(degree)),
      // The configured analysis cohort uses one stable cross-source program
      // identity. Preserve the catalog's literal award label separately; using
      // it as the join key would make ten current universities disappear from
      // the configured major despite retaining the correct source document.
      program: PROGRAM,
      ...(degree.program && degree.program !== PROGRAM
        ? { source_program: degree.program }
        : {}),
      total_units: degree.total_units ?? null,
      unit_system: degree.unit_system || 'semester',
      catalog_year: degree.catalog_year || null,
      research_status: degree.research_status || 'collected',
      source_method: degree.source_method || SOURCE_METHOD,
      source_url: degree.source_url || null,
      verification: degree.verification || null,
      modeling_notes: degree.modeling_notes || [],
      acceptance: clone(degree.acceptance) || null,
      analysis_ready: degree.acceptance?.ready_for_analysis === true,
      analysis_contract: canonicalSourceContract(),
      provenance: clone(degree.provenance) || null,
      va_requirement_status: degree.status || null,
      va_requirement_id: degree._id,
      requirement_groups: requirementGroups,
      ...(requirementVariants.length ? { requirement_variants: requirementVariants } : {}),
      ...(capacityProjection.applicable ? {
        requirement_capacity_projection: capacityProjection.receipt,
      } : {}),
    };
    degreeDocs.push(stampDegreeCategories(projectedDegree).doc);
  }

  // A college can have a corroborating Transfer Virginia map beside its
  // source-of-record institution catalog. Explicit analysis readiness wins;
  // then verification and provenance decide. `primary:true` is only the final
  // legacy tie-breaker and can never displace stronger catalog evidence.
  // Sending-side shared rows: one per VCCS course, not one per college.
  //
  // California mints a catalog course per college, so its ids are naturally
  // per-college and `assist_courses` carries a unique index on
  // (side, source_id). Virginia uses statewide common course numbering: MTH 263
  // is one object taught at many colleges and carries one id. Modelling it as
  // the statewide course it is keeps that index satisfied and stays true to the
  // source; `offered_by_ids` records which colleges teach it.
  const collegeIdByName = new Map(colleges.map((row) => [row.name, collegeIdBySlug.get(idSlug(row))]));
  for (const course of courses) {
    if (course?.sending_eligible === false || !Number.isInteger(Number(course?.course_id))) continue;
    const expectedIdentity = sharedCourseIdentity(course.code);
    if (!expectedIdentity) continue;
    const parsed = parseCourseCode(course.code);
    const offeredIds = (course.offered_by || [])
      .map((name) => collegeIdByName.get(name))
      .filter((id) => id != null);
    const row = {
      _id: `va:sending:${Number(course.course_id)}`,
      institution_id: course.institution_id ?? expectedIdentity.institution_id,
      source_id: Number(course.course_id),
      course_id: Number(course.course_id),
      course_key: course.course_key ?? expectedIdentity.course_key,
      identity_scope: course.identity_scope ?? expectedIdentity.identity_scope,
      identity_contract: course.identity_contract ?? expectedIdentity.identity_contract,
      vccs_master_applicable: course.vccs_master_applicable
        ?? expectedIdentity.vccs_master_applicable,
      sending_eligible: course.sending_eligible !== false,
      side: 'sending',
      code: expectedIdentity.code,
      prefix: parsed.prefix || '',
      number: parsed.number != null ? String(parsed.number) : '',
      title: course.title || '',
      units: course.credits ?? null,
      min_units: course.credits ?? null,
      max_units: course.credits ?? null,
      state: 'va',
      offered_by: course.offered_by || [],
      offered_by_ids: offeredIds,
    };
    if (!courseById.has(row._id)) courseById.set(row._id, row);
  }

  const sharedEvidence = [];
  for (const source of chosenAsDegrees) {
    const slug = collegeSlugOf(source);
    const collegeId = collegeIdBySlug.get(slug);
    const collegeName = nameBySlug.get(slug);
    if (collegeId == null) continue;
    for (const row of localSendingCourses(source, { collegeId, collegeName })) {
      if (!courseById.has(row._id)) courseById.set(row._id, row);
    }
    sharedEvidence.push(...sourceNamedSharedCourseEvidence(source, { collegeId, collegeName }));
  }
  mergeSourceNamedSharedCourses(courseById, sharedEvidence);

  const asDegreeDocs = [];
  for (const source of chosenAsDegrees) {
    const slug = collegeSlugOf(source);
    const collegeId = collegeIdBySlug.get(slug);
    if (collegeId == null) continue;
    const requirementVariants = (source.requirement_variants || []).map((variant) => ({
      ...clone(variant),
      requirement_groups: projectGroups({
        ...source,
        ...variant,
        requirement_groups: variant?.requirement_groups || [],
      }, { associate: true }),
    }));
    asDegreeDocs.push({
      ...clone(source),
      _id: `as_degree:${collegeId}:${MAJOR_SLUG}:local_as`,
      kind: 'as_degree',
      major_slug: MAJOR_SLUG,
      state: 'va',
      community_college_id: collegeId,
      college_id: `va:cc:${collegeId}`,
      college_name: nameBySlug.get(slug),
      degree_type: 'local_as',
      // Preserve the source award classification before mapping it onto the
      // shared cross-state `local_as` analysis type.  Pair-level policy proofs
      // (for example, VCU's transfer-oriented A.S. GE waiver) must be able to
      // distinguish an A.S. from an A.A.S. without guessing from a title.
      source_degree_type: source.degree_type || null,
      status: 'found',
      degree_title_seen: source.degree_title_seen || null,
      catalog_url: source.catalog_url || null,
      catalog_year: source.catalog_year || null,
      unit_system: source.unit_system || 'semester',
      total_units: source.total_units ?? null,
      verification: source.verification || null,
      extraction: source.extraction || null,
      acceptance: clone(source.acceptance) || null,
      analysis_ready: source.acceptance?.ready_for_analysis === true,
      analysis_contract: canonicalSourceContract(),
      provenance: clone(source.provenance) || null,
      research_status: source.research_status || null,
      va_requirement_status: source.status,
      va_requirement_id: source._id,
      requirement_groups: projectGroups(source, { associate: true }),
      ...(requirementVariants.length ? { requirement_variants: requirementVariants } : {}),
    });
  }

  return {
    institutions: institutionDocs,
    courses: [...courseById.values()],
    degrees: degreeDocs,
    asDegrees: asDegreeDocs,
    agreements,
    agreementOfferingAugmentation,
    asAlternates,
    associateSourceDispositions,
    withoutEquivalencies: agreements.withoutEquivalencies || [],
  };
}

function canonicalJson(value) {
  const sortKeys = (entry) => {
    if (Array.isArray(entry)) return entry.map(sortKeys);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(Object.keys(entry).sort()
      .map((key) => [key, sortKeys(entry[key])]));
  };
  return JSON.stringify(sortKeys(BSON.EJSON.serialize(value, { relaxed: false })));
}

function sortedDocuments(documents) {
  return [...(documents || [])].sort((left, right) => {
    const ids = canonicalJson(left?._id).localeCompare(canonicalJson(right?._id));
    return ids || canonicalJson(left).localeCompare(canonicalJson(right));
  });
}

function canonicalDocumentHash(documents) {
  const hash = createHash('sha256');
  for (const document of sortedDocuments(documents)) {
    const encoded = canonicalJson(document);
    hash.update(String(Buffer.byteLength(encoded)));
    hash.update(':');
    hash.update(encoded);
    hash.update('\n');
  }
  return hash.digest('hex');
}

function projectionReceipt(projection) {
  const projectionManifest = targetManifest(projectionTargetDocuments(projection));
  return {
    projection_manifest: projectionManifest,
    projection_manifest_sha256: createHash('sha256')
      .update(canonicalJson(projectionManifest)).digest('hex'),
  };
}

function reportSha256(report) {
  return createHash('sha256').update(canonicalJson(report)).digest('hex');
}

function clearlyNamedStagingDatabase(dbName) {
  // This is an allowlist, not a lexical hint.  Adding another database is a
  // reviewed code change; names such as production_dev, dev_production, or a
  // production backup with a "test" token can never enable the bypass.
  return INCOMPLETE_OVERRIDE_DATABASES.has(String(dbName || ''));
}

/** Re-run the executable acceptance contract with the checked-out code. */
function recomputeVirginiaAcceptance(sourceDocuments = [], courses = []) {
  const creditsByCode = new Map((courses || []).map((course) => [course?.code, course?.credits]));
  return (sourceDocuments || []).map((doc) => {
    if (doc?.status !== 'extracted'
        || doc?.source !== 'institution_catalog'
        || !['as_degree', 'degree'].includes(doc?.kind)) return doc;
    const next = clone(doc);
    next.acceptance = validateDegreeAcceptance(next, {
      institutionLevel: next.kind === 'as_degree' ? 'community_college' : 'four_year',
      resolveCourse: acceptanceResolver(next, creditsByCode),
    });
    return next;
  });
}

function officialVirginiaDegreeSources(sourceDocuments = []) {
  return (sourceDocuments || []).filter((doc) => (
    doc?.status === 'extracted'
      && doc?.source === 'institution_catalog'
      && ['as_degree', 'degree'].includes(doc?.kind)
  ));
}

/**
 * Rejoin exact operational overlays to the complete extracted source cohort.
 *
 * Unit/capacity overlays intentionally accept only official-catalog records,
 * but that must not erase older Transfer Virginia maps before the one-program-
 * per-college selector can record an explicit disposition for them.  Official
 * rows come from the checked overlay; non-official rows remain byte-for-byte
 * source clones and can only enter the projection if the selector chooses
 * them.
 */
function operationalVirginiaDegreeSources(sourceDocuments = [], overlayDocuments = []) {
  const overlayById = new Map((overlayDocuments || []).map((doc) => [doc?._id, doc]));
  return (sourceDocuments || []).filter((doc) => (
    doc?.status === 'extracted' && ['as_degree', 'degree'].includes(doc?.kind)
  )).map((doc) => clone(overlayById.get(doc?._id) || doc));
}

/**
 * Copy only exact course-unit evidence from the checked-in candidate plan onto
 * clones of the current source documents. Candidate requirement trees never
 * cross this boundary; the overlay's major-core hashes prove that property.
 */
function operationalCourseUnitEvidenceOverlay({
  sourceDocuments = [],
  courses = [],
  candidateDocuments = null,
} = {}) {
  const creditsByCode = new Map((courses || []).map((course) => [
    course?.code, course?.credits,
  ]));
  const candidates = (candidateDocuments
    || cachedAcceptedSourcePlan(creditsByCode).documents).map((doc) => {
    const candidate = clone(doc);
    // Import timestamps are invocation metadata, not source or evidence. The
    // operational overlay never persists a candidate wrapper, so remove the
    // volatile clock value before hashing its otherwise complete input.
    delete candidate.updated_at;
    return candidate;
  });
  const courseUnitOverlay = buildCourseUnitEvidenceOverlay({
    currentDocuments: officialVirginiaDegreeSources(sourceDocuments),
    candidateDocuments: officialVirginiaDegreeSources(candidates),
  });
  const requirementCapacityEvidence = buildBachelorRequirementCapacityEvidenceOverlay({
    currentDocuments: officialVirginiaDegreeSources(courseUnitOverlay.documents),
    candidateDocuments: officialVirginiaDegreeSources(candidates),
  });
  const associateConstraintMetadataEvidence =
    buildAssociateConstraintMetadataEvidenceOverlay({
      currentDocuments: officialVirginiaDegreeSources(sourceDocuments),
      candidateDocuments: officialVirginiaDegreeSources(candidates),
    });
  const {
    documents,
    report_sha256: ignoredCourseUnitReportSha256,
    ...courseUnitPayload
  } = courseUnitOverlay;
  const combinedPayload = {
    ...courseUnitPayload,
    requirement_capacity_evidence: requirementCapacityEvidence,
    associate_constraint_metadata_evidence: associateConstraintMetadataEvidence,
  };
  return {
    ...combinedPayload,
    documents,
    report_sha256: evidenceOverlaySha256(combinedPayload),
  };
}

function courseUnitOverlayGate(overlay, expectedDocuments) {
  const expectedIds = officialVirginiaDegreeSources(expectedDocuments)
    .map((doc) => doc._id).sort();
  const outputIds = Array.isArray(overlay?.documents)
    ? overlay.documents.map((doc) => doc?._id).sort() : [];
  const receipts = Array.isArray(overlay?.receipts) ? overlay.receipts : [];
  const issues = [];
  if (!overlay || overlay.ready !== true) issues.push('operational course-unit evidence overlay did not pass');
  if (!overlay?.report_sha256 || !/^[a-f0-9]{64}$/.test(overlay.report_sha256)) {
    issues.push('operational course-unit evidence overlay report hash is missing');
  }
  const {
    documents: ignoredOverlayDocuments,
    report_sha256: actualOverlayReportSha256,
    ...overlayReportPayload
  } = overlay || {};
  if (actualOverlayReportSha256 !== evidenceOverlaySha256(overlayReportPayload)) {
    issues.push('operational course-unit evidence overlay report hash changed');
  }
  if (JSON.stringify(outputIds) !== JSON.stringify(expectedIds)) {
    issues.push('operational course-unit evidence overlay cohort does not match current source documents');
  }
  if (receipts.length !== expectedIds.length) {
    issues.push('operational course-unit evidence overlay receipt count does not match the source cohort');
  }
  if (receipts.some((receipt) => receipt?.output_major_core_unchanged !== true)) {
    issues.push('operational course-unit evidence overlay changed a verified major core');
  }
  if (Number(overlay?.counts?.conflicts) !== 0
      || (Array.isArray(overlay?.conflicts) && overlay.conflicts.length !== 0)) {
    issues.push('operational course-unit evidence overlay contains conflicts');
  }
  const capacityValidation = validateBachelorRequirementCapacityEvidenceOverlay(
    overlay?.requirement_capacity_evidence,
  );
  const expectedCapacityIds = expectedIds.filter((id) => (
    BACHELOR_REQUIREMENT_CAPACITY_CONTRACTS[id] != null
  ));
  const capacityReceiptIds = (overlay?.requirement_capacity_evidence?.receipts || [])
    .map((receipt) => receipt?.document_id).sort();
  if (!capacityValidation.valid
      || overlay?.requirement_capacity_evidence?.ready !== true
      || JSON.stringify(capacityReceiptIds) !== JSON.stringify(expectedCapacityIds)) {
    issues.push('operational requirement-capacity evidence projection did not pass');
  }
  const metadataValidation = validateAssociateConstraintMetadataEvidenceOverlay(
    overlay?.associate_constraint_metadata_evidence,
  );
  const expectedMetadataIds = expectedIds.filter((id) => (
    ASSOCIATE_CONSTRAINT_METADATA_CONTRACTS[id] != null
  ));
  const metadataReceiptIds = (overlay?.associate_constraint_metadata_evidence?.receipts || [])
    .map((receipt) => receipt?.document_id).sort();
  if (!metadataValidation.valid
      || overlay?.associate_constraint_metadata_evidence?.ready !== true
      || JSON.stringify(metadataReceiptIds) !== JSON.stringify(expectedMetadataIds)) {
    issues.push('operational associate-constraint metadata no-op evidence did not pass');
  }
  return {
    ready: issues.length === 0,
    issues,
    report_sha256: overlay?.report_sha256 || null,
    output_documents_sha256: overlay?.output_documents_sha256 || null,
    counts: clone(overlay?.counts || null),
    receipts: clone(receipts),
    conflicts: clone(overlay?.conflicts || []),
    requirement_capacity_evidence: clone(
      overlay?.requirement_capacity_evidence || null,
    ),
    associate_constraint_metadata_evidence: clone(
      overlay?.associate_constraint_metadata_evidence || null,
    ),
  };
}

/**
 * Compare checked-in accepted compositions with the persisted source cohort.
 *
 * This is deliberately an audit, not a merge. Candidate trees remain
 * unverified and no field from them is copied onto a persisted document. The
 * result explains exactly which importer guards must be resolved before the
 * candidate can become authoritative.
 */
function candidateSourceSafetyAudit({
  storedSourceDocuments = [],
  candidateDocuments = [],
} = {}) {
  const stored = officialVirginiaDegreeSources(storedSourceDocuments);
  const candidates = officialVirginiaDegreeSources(candidateDocuments);
  const storedById = new Map(stored.map((doc) => [doc._id, doc]));
  const candidateIds = candidates.map((doc) => doc._id);
  const duplicateCandidateIds = [...new Set(candidateIds.filter((id, index) => (
    candidateIds.indexOf(id) !== index
  )))].sort();
  const missingStoredIds = [];
  const verifiedCoreConflicts = [];
  const verifiedMaterialConflicts = [];
  const sourceChangedIds = [];
  const safeCarriedVerificationIds = [];
  const humanVerificationRequiredIds = [];

  for (const candidate of candidates) {
    const prior = storedById.get(candidate._id) || null;
    if (!prior) missingStoredIds.push(candidate._id);
    const coreConflict = verifiedCoreConflict(prior, candidate);
    const materialConflict = verifiedImportConflict(prior, candidate);
    if (coreConflict) verifiedCoreConflicts.push(candidate._id);
    if (materialConflict) verifiedMaterialConflicts.push(candidate._id);
    const carried = verificationForSourceBundle(
      prior?.status === 'superseded' ? null : prior,
      candidate?.provenance?.source_bundle_hash,
    );
    if (carried.source_changed) sourceChangedIds.push(candidate._id);
    const safelyCarried = !coreConflict && !materialConflict
      && carried.source_changed !== true
      && carried.verification?.verified === true;
    if (safelyCarried) safeCarriedVerificationIds.push(candidate._id);
    else humanVerificationRequiredIds.push(candidate._id);
  }

  const overlap = verifiedCoreConflicts.filter((id) => (
    verifiedMaterialConflicts.includes(id)
  ));
  const hardConflictIds = [...new Set([
    ...verifiedCoreConflicts,
    ...verifiedMaterialConflicts,
  ])].sort();
  const defaultImportBlocked = duplicateCandidateIds.length > 0
    || verifiedCoreConflicts.length > 0
    || verifiedMaterialConflicts.length > 0
    || sourceChangedIds.length > 0;
  return {
    ready_for_default_import: !defaultImportBlocked,
    authoritative_import_blocked: defaultImportBlocked,
    counts: {
      stored_documents: stored.length,
      candidate_documents: candidates.length,
      missing_stored_documents: missingStoredIds.length,
      duplicate_candidate_ids: duplicateCandidateIds.length,
      verified_core_conflicts: verifiedCoreConflicts.length,
      verified_material_conflicts: verifiedMaterialConflicts.length,
      overlapping_verified_conflicts: overlap.length,
      distinct_hard_conflicts: hardConflictIds.length,
      changed_verified_source_bundles: sourceChangedIds.length,
      safe_carried_verifications: safeCarriedVerificationIds.length,
      human_verification_required: humanVerificationRequiredIds.length,
    },
    missing_stored_ids: missingStoredIds.sort(),
    duplicate_candidate_ids: duplicateCandidateIds,
    verified_core_conflicts: verifiedCoreConflicts.sort(),
    verified_material_conflicts: verifiedMaterialConflicts.sort(),
    overlapping_verified_conflicts: overlap.sort(),
    distinct_hard_conflicts: hardConflictIds,
    changed_verified_source_bundles: sourceChangedIds.sort(),
    safe_carried_verification_ids: safeCarriedVerificationIds.sort(),
    human_verification_required_ids: humanVerificationRequiredIds.sort(),
  };
}

const conditionCellKey = (cell) => (
  `${Number(cell?.community_college_id)}:${Number(cell?.school_id)}`
);

function conditionMatrixKeys(projection) {
  const associateIds = (projection?.asDegrees || []).map((row) => (
    Number(row?.community_college_id)
  )).filter(Number.isFinite).sort((left, right) => left - right);
  const bachelorIds = (projection?.degrees || []).map((row) => (
    Number(row?.school_id)
  )).filter(Number.isFinite).sort((left, right) => left - right);
  return associateIds.flatMap((collegeId) => (
    bachelorIds.map((schoolId) => `${collegeId}:${schoolId}`)
  )).sort();
}

/** Exact blocked-cell set difference, guarded by an identical matrix roster. */
function equivalencyConditionDelta({
  authoritativeProjection,
  candidateProjection,
  authoritativeAudit,
  candidateAudit,
} = {}) {
  const issues = [];
  const authoritativeKeys = conditionMatrixKeys(authoritativeProjection);
  const candidateKeys = conditionMatrixKeys(candidateProjection);
  if (JSON.stringify(authoritativeKeys) !== JSON.stringify(candidateKeys)) {
    issues.push('authoritative and candidate condition matrices have different pair rosters');
  }
  const expectedAuthoritativeCells = authoritativeKeys.length;
  const expectedCandidateCells = candidateKeys.length;
  if (Number(authoritativeAudit?.counts?.cells) !== expectedAuthoritativeCells) {
    issues.push('authoritative condition audit cell count does not match its projection roster');
  }
  if (Number(candidateAudit?.counts?.cells) !== expectedCandidateCells) {
    issues.push('candidate condition audit cell count does not match its projection roster');
  }

  const indexBlocked = (rows, label) => {
    const byKey = new Map();
    for (const cell of rows || []) {
      const key = conditionCellKey(cell);
      if (byKey.has(key)) issues.push(`${label} condition audit contains duplicate cell ${key}`);
      byKey.set(key, cell);
    }
    return byKey;
  };
  const authoritativeBlocked = indexBlocked(
    authoritativeAudit?.blocked_cells, 'authoritative',
  );
  const candidateBlocked = indexBlocked(candidateAudit?.blocked_cells, 'candidate');
  const comparable = issues.length === 0;
  const gains = comparable
    ? [...authoritativeBlocked.entries()].filter(([key]) => !candidateBlocked.has(key))
      .map(([, cell]) => clone(cell)) : [];
  const regressions = comparable
    ? [...candidateBlocked.entries()].filter(([key]) => !authoritativeBlocked.has(key))
      .map(([, cell]) => clone(cell)) : [];
  const readyCellDelta = Number(candidateAudit?.counts?.ready_cells || 0)
    - Number(authoritativeAudit?.counts?.ready_cells || 0);
  const exact = comparable && readyCellDelta === gains.length - regressions.length;
  if (comparable && !exact) {
    issues.push('ready-cell count delta does not equal the exact blocked-cell set difference');
  }
  return {
    comparable,
    exact,
    ready_cell_delta: readyCellDelta,
    gained_cells: gains.sort((left, right) => (
      conditionCellKey(left).localeCompare(conditionCellKey(right), undefined, { numeric: true })
    )),
    regressed_cells: regressions.sort((left, right) => (
      conditionCellKey(left).localeCompare(conditionCellKey(right), undefined, { numeric: true })
    )),
    issues,
  };
}

/**
 * Build the checked-in accepted source plan against the same courses,
 * institutions, and evaluator code as production, without substituting it for
 * `va_requirements` or constructing a publication attestation.
 */
function acceptedSourcePlanComparison({
  storedSourceDocuments = [],
  candidateDocuments = [],
  courses = [],
  institutions = [],
  authoritativeProjection,
  authoritativeConditionAudit,
  courseUnitEvidenceOverlay = null,
} = {}) {
  const evaluatedCandidates = recomputeVirginiaAcceptance(candidateDocuments, courses);
  const candidateProjection = buildProjection({
    courses,
    institutions,
    degrees: evaluatedCandidates.filter((doc) => (
      doc.kind === 'degree' && doc.status === 'extracted'
    )),
    asDegrees: evaluatedCandidates.filter((doc) => (
      doc.kind === 'as_degree' && doc.status === 'extracted'
    )),
  });
  // Exercise the complete production projection validation boundary, but do
  // not create a publication preflight capability for this unapproved tree.
  projectionTargetDocuments(candidateProjection);
  const candidateConditionAudit = auditVirginiaProjectionEquivalencyConditions(
    candidateProjection,
  );
  const delta = equivalencyConditionDelta({
    authoritativeProjection,
    candidateProjection,
    authoritativeAudit: authoritativeConditionAudit,
    candidateAudit: candidateConditionAudit,
  });
  const verificationReview = buildPublicationVerificationReview({
    candidateDocuments: evaluatedCandidates,
    storedDocuments: storedSourceDocuments,
    courseUnitEvidenceOverlay,
  });
  const verificationReviewValidation = validatePublicationVerificationReview(
    verificationReview,
  );
  if (!verificationReviewValidation.valid) {
    throw new Error(
      'invalid Virginia accepted-source verification review: '
        + verificationReviewValidation.issues.join(', '),
    );
  }
  return {
    schema_version: 1,
    mode: 'accepted_source_plan_read_only_comparison',
    writes_authorized: false,
    authoritative_source: 'MongoDB va_requirements',
    candidate_source: 'checked-in accepted composition cache',
    safety: candidateSourceSafetyAudit({
      storedSourceDocuments,
      candidateDocuments: evaluatedCandidates,
    }),
    verification_review: sourcePlanFromVerificationReview(verificationReview),
    authoritative_condition_counts: clone(authoritativeConditionAudit?.counts || null),
    candidate_condition_counts: clone(candidateConditionAudit.counts),
    condition_delta: delta,
    authoritative_projection_manifest_sha256:
      projectionReceipt(authoritativeProjection).projection_manifest_sha256,
    candidate_projection_manifest_sha256:
      projectionReceipt(candidateProjection).projection_manifest_sha256,
  };
}

function documentsForTarget(documentsByCollection, collection) {
  if (documentsByCollection instanceof Map) return documentsByCollection.get(collection) || [];
  return documentsByCollection?.[collection] || [];
}

function validateTargetDocuments(documentsByCollection) {
  const errors = [];
  for (const target of VA_TARGETS) {
    const documents = documentsForTarget(documentsByCollection, target.collection);
    if (!Array.isArray(documents)) {
      errors.push(`${target.collection}: target must be an array`);
      continue;
    }
    const ids = new Set();
    documents.forEach((document, index) => {
      if (!document || typeof document !== 'object' || Array.isArray(document)) {
        errors.push(`${target.collection}[${index}]: document must be an object`);
        return;
      }
      if (document.state !== 'va') {
        errors.push(`${target.collection}[${index}]: state must be exactly 'va'`);
      }
      if (document._id == null) {
        errors.push(`${target.collection}[${index}]: _id is required`);
        return;
      }
      const token = canonicalJson(document._id);
      if (ids.has(token)) errors.push(`${target.collection}: duplicate _id ${token}`);
      ids.add(token);
    });
  }
  return { valid: errors.length === 0, errors };
}

function projectionTargetDocuments(projection) {
  const documents = {
    assist_institutions: projection?.institutions || [],
    assist_courses: projection?.courses || [],
    assist_agreements: projection?.agreements || [],
    curated_requirements: [
      ...(projection?.degrees || []),
      ...(projection?.asDegrees || []),
    ],
  };
  const validation = validateTargetDocuments(documents);
  if (!validation.valid) {
    throw new Error(`invalid Virginia projection:\n${validation.errors.join('\n')}`);
  }
  return documents;
}

function targetManifest(documentsByCollection) {
  return VA_TARGETS.map(({ collection }) => {
    const documents = documentsForTarget(documentsByCollection, collection);
    return {
      collection,
      filter: { state: 'va' },
      count: documents.length,
      sha256: canonicalDocumentHash(documents),
    };
  });
}

function buildSnapshot({
  generationId,
  documentsByCollection,
  operation = 'publish',
  createdAt = new Date(),
  sourceGenerationId = null,
}) {
  if (typeof generationId !== 'string' || !generationId.trim()) {
    throw new Error('snapshot generation id is required');
  }
  const targetValidation = validateTargetDocuments(documentsByCollection);
  if (!targetValidation.valid) {
    throw new Error(`cannot snapshot invalid Virginia state:\n${targetValidation.errors.join('\n')}`);
  }
  const payload = VA_TARGETS.flatMap(({ collection }) => (
    sortedDocuments(documentsForTarget(documentsByCollection, collection))
      .map((document, ordinal) => ({
        _id: `${generationId}:${collection}:${String(ordinal).padStart(8, '0')}`,
        generation_id: generationId,
        state: 'va',
        collection,
        ordinal,
        document,
      }))
  ));
  const manifest = {
    _id: generationId,
    kind: 'va_projection_snapshot',
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    generation_id: generationId,
    state: 'va',
    operation,
    source_generation_id: sourceGenerationId,
    created_at: createdAt,
    status: 'complete',
    targets: targetManifest(documentsByCollection),
  };
  return { manifest, payload };
}

function validateSnapshot(manifest, payload) {
  const errors = [];
  const documentsByCollection = Object.fromEntries(
    VA_TARGETS.map(({ collection }) => [collection, []]),
  );
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['snapshot manifest is missing'], documentsByCollection };
  }
  if (manifest.kind !== 'va_projection_snapshot') errors.push('manifest kind is invalid');
  if (manifest.schema_version !== SNAPSHOT_SCHEMA_VERSION) {
    errors.push(`unsupported snapshot schema version ${manifest.schema_version ?? '<missing>'}`);
  }
  if (manifest.state !== 'va') errors.push("manifest state must be exactly 'va'");
  if (manifest.status !== 'complete') errors.push("manifest status must be 'complete'");
  if (typeof manifest.generation_id !== 'string' || !manifest.generation_id) {
    errors.push('manifest generation_id is missing');
  }
  if (manifest._id !== manifest.generation_id) errors.push('manifest _id/generation_id mismatch');

  const expectedCollections = new Set(VA_TARGETS.map(({ collection }) => collection));
  const manifestTargets = Array.isArray(manifest.targets) ? manifest.targets : [];
  if (manifestTargets.length !== VA_TARGETS.length) {
    errors.push(`manifest must contain exactly ${VA_TARGETS.length} targets`);
  }
  const targetsByCollection = new Map();
  for (const target of manifestTargets) {
    if (!expectedCollections.has(target?.collection)) {
      errors.push(`manifest contains unknown target ${target?.collection ?? '<missing>'}`);
      continue;
    }
    if (targetsByCollection.has(target.collection)) {
      errors.push(`manifest contains duplicate target ${target.collection}`);
      continue;
    }
    targetsByCollection.set(target.collection, target);
    if (canonicalJson(target.filter) !== canonicalJson(VA_FILTER)) {
      errors.push(`${target.collection}: backup filter must be exactly { state: 'va' }`);
    }
    if (!Number.isInteger(target.count) || target.count < 0) {
      errors.push(`${target.collection}: backup count is invalid`);
    }
    if (!/^[a-f0-9]{64}$/.test(String(target.sha256 || ''))) {
      errors.push(`${target.collection}: backup hash is invalid`);
    }
  }
  for (const collection of expectedCollections) {
    if (!targetsByCollection.has(collection)) errors.push(`manifest is missing target ${collection}`);
  }

  if (!Array.isArray(payload)) errors.push('snapshot payload is missing');
  else {
    const payloadIds = new Set();
    for (const row of payload) {
      if (row?.generation_id !== manifest.generation_id) {
        errors.push('payload generation_id does not match manifest');
        continue;
      }
      if (row?.state !== 'va') errors.push(`${row?._id || '<payload>'}: payload state is not va`);
      if (!expectedCollections.has(row?.collection)) {
        errors.push(`${row?._id || '<payload>'}: payload target is unknown`);
        continue;
      }
      const token = canonicalJson(row?._id);
      if (payloadIds.has(token)) errors.push(`duplicate payload _id ${token}`);
      payloadIds.add(token);
      documentsByCollection[row.collection].push(row);
    }
  }

  for (const { collection } of VA_TARGETS) {
    const target = targetsByCollection.get(collection);
    const rows = documentsByCollection[collection]
      .sort((left, right) => Number(left.ordinal) - Number(right.ordinal));
    const ordinals = rows.map((row) => row.ordinal);
    if (ordinals.some((ordinal, index) => !Number.isInteger(ordinal) || ordinal !== index)) {
      errors.push(`${collection}: payload ordinals are incomplete or duplicated`);
    }
    rows.forEach((row, index) => {
      const expectedId = `${manifest.generation_id}:${collection}:${String(index).padStart(8, '0')}`;
      if (row._id !== expectedId) errors.push(`${collection}: payload _id does not match ordinal ${index}`);
    });
    const documents = rows.map((row) => row.document);
    const validation = validateTargetDocuments({
      ...Object.fromEntries(VA_TARGETS.map((item) => [item.collection, []])),
      [collection]: documents,
    });
    errors.push(...validation.errors.filter((error) => error.startsWith(collection)));
    if (!target) continue;
    if (documents.length !== target.count) {
      errors.push(`${collection}: expected ${target.count} documents, found ${documents.length}`);
    }
    if (canonicalDocumentHash(documents) !== target.sha256) {
      errors.push(`${collection}: content hash does not match manifest`);
    }
    documentsByCollection[collection] = documents;
  }

  return { valid: errors.length === 0, errors, documentsByCollection };
}

async function readVirginiaTargets(db, session) {
  const documents = {};
  // MongoDB transactions do not support parallel operations on one session.
  for (const { collection } of VA_TARGETS) {
    documents[collection] = await db.collection(collection)
      .find(VA_FILTER, { session }).sort({ _id: 1 }).toArray();
  }
  return documents;
}

async function persistSnapshot(db, snapshot, transition, session) {
  if (canonicalJson(snapshot?.manifest?.publication_transition)
      !== canonicalJson(transition?.binding)) {
    throw new Error('Virginia projection snapshot is not bound to its publication transition');
  }
  if (snapshot.payload.length) {
    await db.collection(REVISION_DOCUMENT_COLLECTION)
      .insertMany(snapshot.payload, { ordered: true, session });
  }
  await db.collection(REVISION_COLLECTION).insertOne(snapshot.manifest, { session });
  await persistVirginiaPublicationTransition(db, transition, session);
}

async function loadSnapshot(db, generationId, session) {
  const manifest = await db.collection(REVISION_COLLECTION)
    .findOne({ _id: generationId, generation_id: generationId, state: 'va' }, { session });
  if (!manifest) throw new Error(`Virginia projection backup ${generationId} does not exist`);
  const payload = await db.collection(REVISION_DOCUMENT_COLLECTION)
    .find({ generation_id: generationId, state: 'va' }, { session })
    .sort({ collection: 1, ordinal: 1 }).toArray();
  const validation = validateSnapshot(manifest, payload);
  if (!validation.valid) {
    throw new Error(`Virginia projection backup ${generationId} is incomplete:\n${validation.errors.join('\n')}`);
  }
  return { manifest, payload, documentsByCollection: validation.documentsByCollection };
}

async function replaceVirginiaTargets(db, documentsByCollection, session) {
  const validation = validateTargetDocuments(documentsByCollection);
  if (!validation.valid) {
    throw new Error(`refusing invalid Virginia replacement:\n${validation.errors.join('\n')}`);
  }
  for (const { collection } of VA_TARGETS) {
    const target = db.collection(collection);
    await target.deleteMany(VA_FILTER, { session });
    const documents = documentsForTarget(documentsByCollection, collection);
    if (documents.length) await target.insertMany(documents, { ordered: true, session });
  }
  const written = await readVirginiaTargets(db, session);
  const expected = targetManifest(documentsByCollection);
  const actual = targetManifest(written);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error('post-write Virginia projection manifest does not match requested projection');
  }
}

const TRANSACTION_OPTIONS = Object.freeze({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary',
});

async function authoritativePublicationState(db, session) {
  // These reads share the publication transaction's snapshot. The low-level
  // writer therefore cannot be handed a self-consistent but fabricated set of
  // equivalency channels: it rebuilds those channels from the authoritative
  // Virginia source collections immediately before the first write.
  const courses = await db.collection('va_courses').find({}, { session }).toArray();
  const sourceDocuments = await db.collection('va_requirements')
    .find({}, { session }).toArray();
  const institutions = await db.collection('va_institutions')
    .find({}, { session }).toArray();
  const communityCollegeRows = await db.collection('va_course_requisites')
    .find({}, { session }).toArray();
  const universityRows = await db.collection('va_university_course_requisites')
    .find({}, { session }).toArray();
  const activeReceipts = await db.collection('va_figure6_prerequisite_publications')
    .find({ active: true }, { session }).limit(2).toArray();
  const verificationReceipt = activeReceipts.length === 1 ? activeReceipts[0] : null;
  const courseUnitEvidenceOverlay = operationalCourseUnitEvidenceOverlay({
    sourceDocuments,
    courses,
  });
  const evaluatedSourceDocuments = recomputeVirginiaAcceptance(
    operationalVirginiaDegreeSources(
      sourceDocuments,
      courseUnitEvidenceOverlay.documents,
    ),
    courses,
  );
  const projection = buildProjection({
    courses,
    institutions,
    requirementCapacityEvidenceOverlay:
      courseUnitEvidenceOverlay.requirement_capacity_evidence,
    degrees: evaluatedSourceDocuments.filter((doc) => (
      doc.kind === 'degree' && doc.status === 'extracted'
    )),
    asDegrees: evaluatedSourceDocuments.filter((doc) => (
      doc.kind === 'as_degree' && doc.status === 'extracted'
    )),
  });
  const preflightReport = publicationPreflight({
    sourceDocuments,
    projection,
    courses,
    courseUnitEvidenceOverlay,
    prerequisiteCorpora: {
      communityCollegeRows,
      universityRows,
      verificationReceipt,
      adapterIntegrated: true,
    },
  });
  return {
    projection,
    preflightReport,
    prerequisiteCorpora: {
      communityCollegeRows,
      universityRows,
      verificationReceipt,
    },
  };
}

async function publishProjection({
  client,
  db,
  projection,
  preflightReport,
  allowIncompleteStaging = false,
  figuresUncertified = false,
  generationId = randomUUID(),
}) {
  if (!preflightReport) {
    throw new Error('publishProjection requires a passing preflight report');
  }
  const attestation = PREFLIGHT_ATTESTATIONS.get(preflightReport);
  if (!attestation || attestation !== reportSha256(preflightReport)) {
    throw new Error(
      'publishProjection requires an internally generated, untampered preflight report',
    );
  }
  // Never retain a caller-owned document or report across the first await.
  // Every validation, receipt, snapshot, and replacement below reads these
  // private snapshots, closing mutation/TOCTOU gaps at the write boundary.
  const boundProjection = clone(projection);
  const boundPreflightReport = clone(preflightReport);
  // A figures-uncertified publish still has to clear every structural gate;
  // it waives only paper-figure certification, which the figure pipeline then
  // enforces per cell. Re-derive that here rather than trusting the caller:
  // this is the write boundary, and the CLI check above is not.
  const waivedFigures = figuresUncertified ? waivedFigureBlockers(boundPreflightReport) : [];
  if (figuresUncertified) {
    const issues = structuralPublicationIssues(boundPreflightReport);
    if (issues.length) {
      throw new Error(
        `publishProjection cannot waive figure certification while ${issues.join(', ')} fail`,
      );
    }
  }
  if (boundPreflightReport.publishable !== true
      && !allowIncompleteStaging && !figuresUncertified) {
    throw new Error('publishProjection requires a passing preflight report');
  }
  if (allowIncompleteStaging && !clearlyNamedStagingDatabase(db?.databaseName)) {
    throw new Error(
      'publishProjection incomplete override is restricted to an allowlisted non-production database',
    );
  }
  if (boundPreflightReport.course_unit_evidence_overlay?.ready !== true) {
    throw new Error('publishProjection requires a passing, core-preserving course-unit evidence overlay');
  }
  const requestedNext = projectionTargetDocuments(boundProjection);
  const receipt = projectionReceipt(boundProjection);
  if (!boundPreflightReport.projection_manifest_sha256
      || boundPreflightReport.projection_manifest_sha256 !== receipt.projection_manifest_sha256
      || canonicalJson(boundPreflightReport.projection_manifest)
        !== canonicalJson(receipt.projection_manifest)) {
    throw new Error('publishProjection preflight is not bound to this Virginia projection');
  }
  const conditionReport = boundPreflightReport.publication?.figure_readiness
    ?.transfer_equivalency_conditions;
  if (!allowIncompleteStaging) {
    const recomputedConditionReport = auditVirginiaProjectionEquivalencyConditions(boundProjection);
    // The recompute must still match the preflight exactly -- that is the
    // binding between what was audited and what is being written, and it holds
    // for every publish. `ready` is the separate claim that every pair cleared
    // certification; a figures-uncertified publish does not make it, and the
    // figure pipeline excludes each unresolved pair per cell instead.
    if (canonicalJson(conditionReport) !== canonicalJson(recomputedConditionReport)
        || (!figuresUncertified
          && (conditionReport?.ready !== true || recomputedConditionReport.ready !== true))) {
      throw new Error(
        'publishProjection requires a passing selected-equivalency condition audit '
          + 'recomputed from this exact projection',
      );
    }
  }
  const session = client.startSession();
  let publishedTargets;
  try {
    await session.withTransaction(async () => {
      let next = requestedNext;
      let effectivePreflightReport = boundPreflightReport;
      let authoritativePrerequisiteCorpora = null;
      if (!allowIncompleteStaging) {
        const authoritative = await authoritativePublicationState(db, session);
        const authoritativeNext = projectionTargetDocuments(authoritative.projection);
        const authoritativeReceipt = projectionReceipt(authoritative.projection);
        // The in-transaction rebuild must still be structurally sound, and the
        // manifest comparison below still has to match exactly. `publishable`
        // additionally asserts figure certification, which a figures-uncertified
        // publish does not claim.
        const authoritativeIssues = structuralPublicationIssues(authoritative.preflightReport);
        if (authoritativeIssues.length
            || (!figuresUncertified && authoritative.preflightReport.publishable !== true)) {
          throw new Error(
            'authoritative Virginia publication preflight failed inside the write transaction'
              + (authoritativeIssues.length ? `: ${authoritativeIssues.join(', ')}` : ''),
          );
        }
        if (authoritativeReceipt.projection_manifest_sha256
              !== receipt.projection_manifest_sha256
            || canonicalJson(authoritativeReceipt.projection_manifest)
              !== canonicalJson(receipt.projection_manifest)
            || canonicalJson(targetManifest(authoritativeNext))
              !== canonicalJson(targetManifest(requestedNext))) {
          throw new Error(
            'requested Virginia projection does not match the authoritative in-transaction rebuild',
          );
        }
        const authoritativeConditions = authoritative.preflightReport.publication
          ?.figure_readiness?.transfer_equivalency_conditions;
        // Equality with the preflight is the binding and always holds; `ready`
        // is the certification claim a figures-uncertified publish forgoes.
        if (canonicalJson(authoritativeConditions) !== canonicalJson(conditionReport)
            || (!figuresUncertified && authoritativeConditions?.ready !== true)) {
          throw new Error(
            'selected-equivalency condition audit does not match the authoritative source rebuild',
          );
        }
        next = authoritativeNext;
        effectivePreflightReport = authoritative.preflightReport;
        authoritativePrerequisiteCorpora = authoritative.prerequisiteCorpora;
      }
      const previous = await readVirginiaTargets(db, session);
      const snapshot = buildSnapshot({
        generationId,
        documentsByCollection: previous,
        operation: 'publish',
      });
      snapshot.manifest.replacement_targets = targetManifest(next);
      snapshot.manifest.preflight_verdict = effectivePreflightReport.verdict
        || (effectivePreflightReport.publishable ? 'pass' : 'fail');
      snapshot.manifest.preflight_projection_manifest_sha256
        = receipt.projection_manifest_sha256;
      snapshot.manifest.preflight_report_sha256 = reportSha256(effectivePreflightReport);
      snapshot.manifest.publication_audit_report_sha256
        = reportSha256(effectivePreflightReport.publication);
      snapshot.manifest.course_unit_evidence_overlay_report_sha256
        = effectivePreflightReport.course_unit_evidence_overlay.report_sha256;
      snapshot.manifest.course_unit_evidence_output_documents_sha256
        = effectivePreflightReport.course_unit_evidence_overlay.output_documents_sha256;
      snapshot.manifest.transfer_equivalency_condition_report_sha256
        = conditionReport ? reportSha256(conditionReport) : null;
      const pathwayPrerequisiteReport = effectivePreflightReport.publication
        ?.figure_readiness?.pathway_complexity;
      snapshot.manifest.pathway_complexity_prerequisite_report_sha256
        = pathwayPrerequisiteReport ? reportSha256(pathwayPrerequisiteReport) : null;
      snapshot.manifest.incomplete_staging_override = allowIncompleteStaging === true;
      // Record exactly which paper figures were published without release
      // certification, so a reader of this generation can see what was waived
      // rather than inferring it from a passing verdict.
      snapshot.manifest.figures_uncertified_override = figuresUncertified === true;
      snapshot.manifest.waived_figure_certifications = waivedFigures;
      snapshot.manifest.waived_alternate_source_dispositions = figuresUncertified
        ? waivedAlternateSourceDispositions(effectivePreflightReport) : [];
      // A figures-uncertified generation gets a receipt that says so, rather
      // than the certified one -- which would require a signed Figure-6
      // verification receipt this publication deliberately does not claim.
      // Built lazily: the staging/restore path carries no prerequisite corpora.
      const analysisReceiptInput = () => ({
        generationId,
        createdAt: snapshot.manifest.created_at,
        projectionManifest: targetManifest(next),
        preflightReport: effectivePreflightReport,
        communityCollegeRows: authoritativePrerequisiteCorpora.communityCollegeRows,
        universityRows: authoritativePrerequisiteCorpora.universityRows,
      });
      snapshot.manifest.analysis_publication_receipt = allowIncompleteStaging ? null
        : (figuresUncertified
          ? buildVirginiaUncertifiedPublicationReceipt({
            ...analysisReceiptInput(),
            waivedFigureCertifications: waivedFigures,
          })
          : buildVirginiaAnalysisPublicationReceipt({
            ...analysisReceiptInput(),
            verificationReceipt: authoritativePrerequisiteCorpora.verificationReceipt,
          }));
      const analysisReceipt = snapshot.manifest.analysis_publication_receipt;
      snapshot.manifest.publication_evaluator_fingerprint_contract
        = analysisReceipt?.publication_evaluator_fingerprint_contract || null;
      snapshot.manifest.publication_evaluator_fingerprint_sha256
        = analysisReceipt?.publication_evaluator_fingerprint_sha256 || null;
      snapshot.manifest.publication_evaluator_fingerprint_file_count
        = analysisReceipt?.publication_evaluator_fingerprint_file_count || null;
      const transition = await allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'projection',
        operation: 'publish',
        generationId,
        createdAt: snapshot.manifest.created_at,
      });
      snapshot.manifest.publication_transition = transition.binding;
      await persistSnapshot(db, snapshot, transition, session);
      await replaceVirginiaTargets(db, next, session);
      publishedTargets = targetManifest(next);
    }, TRANSACTION_OPTIONS);
  } finally {
    await session.endSession();
  }
  return { generation_id: generationId, targets: publishedTargets };
}

function projectionFromTargetDocuments(documentsByCollection) {
  const requirements = documentsForTarget(documentsByCollection, 'curated_requirements');
  return {
    institutions: documentsForTarget(documentsByCollection, 'assist_institutions'),
    courses: documentsForTarget(documentsByCollection, 'assist_courses'),
    agreements: documentsForTarget(documentsByCollection, 'assist_agreements'),
    degrees: requirements.filter((row) => row?.kind === 'degree'),
    asDegrees: requirements.filter((row) => row?.kind === 'as_degree'),
    withoutEquivalencies: [],
  };
}

function auditRestoreTargetDocuments(documentsByCollection) {
  try {
    const projection = projectionFromTargetDocuments(documentsByCollection);
    projectionTargetDocuments(projection);
    return auditVirginiaProjectionEquivalencyConditions(projection);
  } catch (error) {
    return {
      ready: false,
      blocker: 'restore_projection_reconstruction_failed',
      issues: [{
        code: 'restore_projection_reconstruction_failed',
        message: error.message,
      }],
    };
  }
}

async function restoreProjection({
  client,
  db,
  generationId,
  backupGenerationId = randomUUID(),
  allowIncompleteStaging = false,
}) {
  if (allowIncompleteStaging && !clearlyNamedStagingDatabase(db?.databaseName)) {
    throw new Error(
      'restoreProjection incomplete override is restricted to an allowlisted non-production database',
    );
  }
  const session = client.startSession();
  let restoredTargets;
  let restoreConditionAudit;
  try {
    await session.withTransaction(async () => {
      // Validation happens before the first write in the transaction. A
      // missing/tampered/incomplete generation can never erase current data.
      const requested = await loadSnapshot(db, generationId, session);
      restoreConditionAudit = auditRestoreTargetDocuments(requested.documentsByCollection);
      // A publication revision's receipt attests the *replacement* written by
      // that publication, while its payload is the pre-publication state.  It
      // therefore cannot authorize the payload as publishable.  Restore only
      // the manifest-bound bytes and deliberately leave Virginia invisible
      // until a subsequent full publication creates a fresh passing receipt.
      // Current source equality is intentionally irrelevant: source drift is
      // one of the primary reasons an operator needs a rollback.
      const current = await readVirginiaTargets(db, session);
      const rollbackOfRestore = buildSnapshot({
        generationId: backupGenerationId,
        documentsByCollection: current,
        operation: 'restore',
        sourceGenerationId: generationId,
      });
      rollbackOfRestore.manifest.replacement_targets = clone(requested.manifest.targets);
      rollbackOfRestore.manifest.restore_policy_contract = 'va-exact-snapshot-restore-v1';
      rollbackOfRestore.manifest.restored_snapshot_manifest_sha256
        = reportSha256(requested.manifest);
      rollbackOfRestore.manifest.analysis_visibility = 'disabled_pending_revalidation';
      rollbackOfRestore.manifest.analysis_publication_receipt = null;
      rollbackOfRestore.manifest.preflight_verdict = 'not_revalidated';
      rollbackOfRestore.manifest.incomplete_staging_override = false;
      const transition = await allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'projection',
        operation: 'restore',
        generationId: backupGenerationId,
        createdAt: rollbackOfRestore.manifest.created_at,
      });
      rollbackOfRestore.manifest.publication_transition = transition.binding;
      await persistSnapshot(db, rollbackOfRestore, transition, session);
      await replaceVirginiaTargets(db, requested.documentsByCollection, session);
      restoredTargets = requested.manifest.targets;
    }, TRANSACTION_OPTIONS);
  } finally {
    await session.endSession();
  }
  return {
    restored_generation_id: generationId,
    rollback_generation_id: backupGenerationId,
    targets: restoredTargets,
    transfer_equivalency_condition_audit: restoreConditionAudit,
  };
}

function parseCliArgs(argv = []) {
  const options = {
    apply: false,
    allowIncomplete: false,
    staging: false,
    figuresUncertified: false,
    sourcePlan: false,
    restoreGenerationId: null,
  };
  const unknown = [];
  for (const argument of argv) {
    if (argument === '--apply') options.apply = true;
    else if (argument === '--allow-incomplete') options.allowIncomplete = true;
    else if (argument === '--staging') options.staging = true;
    else if (argument === '--figures-uncertified') options.figuresUncertified = true;
    else if (argument === '--source-plan') options.sourcePlan = true;
    else if (argument.startsWith('--restore=')) {
      const generationId = argument.slice('--restore='.length).trim();
      if (!generationId || options.restoreGenerationId) {
        throw new Error('--restore requires exactly one non-empty generation id');
      }
      options.restoreGenerationId = generationId;
    } else unknown.push(argument);
  }
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  if (options.allowIncomplete !== options.staging) {
    throw new Error('--allow-incomplete and --staging must be supplied together');
  }
  // Without --apply this is a preview: it reports exactly which figure
  // certifications the publish would waive, so nobody has to run the write to
  // find out what it would skip.
  if (options.figuresUncertified && options.allowIncomplete) {
    throw new Error('--figures-uncertified and --allow-incomplete are mutually exclusive');
  }
  if (options.sourcePlan && (
    options.apply || options.allowIncomplete || options.staging
    || options.figuresUncertified || options.restoreGenerationId
  )) {
    throw new Error('--source-plan is read-only and cannot be combined with publication or restore options');
  }
  return options;
}

function publicationPreflight({
  sourceDocuments,
  projection,
  courses = [],
  prerequisiteCorpora = null,
  courseUnitEvidenceOverlay = null,
}) {
  let figureReadiness = {
    transfer_equivalency_conditions:
      auditVirginiaProjectionEquivalencyConditions(projection),
  };
  if (prerequisiteCorpora) {
    const universityScope = prerequisiteCorpora.universityScope || UNIVERSITY_FIGURE6_SCOPE;
    const scopeValidation = validateUniversityPrerequisiteScope(universityScope);
    if (!scopeValidation.valid) {
      throw new Error(
        `invalid Virginia university prerequisite scope: ${scopeValidation.issues.join(', ')}`,
      );
    }
    figureReadiness = {
      ...figureReadiness,
      pathway_complexity: validateVirginiaFigure6PrerequisiteSources({
        communityCollegeRows: prerequisiteCorpora.communityCollegeRows || [],
        universityRows: prerequisiteCorpora.universityRows || [],
        vccsScopeRows: prerequisiteCorpora.vccsScopeRows || VCCS_FIGURE6_SCOPE,
        universityScope,
        adapterIntegrated: prerequisiteCorpora.adapterIntegrated === true,
        verificationReceipt: prerequisiteCorpora.verificationReceipt || null,
      }),
    };
  }
  const currentSourceDocuments = officialVirginiaDegreeSources(sourceDocuments);
  const primaryOverlayRequired = currentSourceDocuments.length === 37;
  const overlayGate = courseUnitEvidenceOverlay
    ? courseUnitOverlayGate(courseUnitEvidenceOverlay, currentSourceDocuments)
    : {
      ready: !primaryOverlayRequired,
      skipped: !primaryOverlayRequired,
      issues: primaryOverlayRequired
        ? ['operational course-unit evidence overlay is required for the Virginia publication cohort']
        : [],
      report_sha256: null,
      output_documents_sha256: null,
      counts: null,
      receipts: [],
      conflicts: [],
    };
  const operationalDocuments = operationalVirginiaDegreeSources(
    sourceDocuments,
    courseUnitEvidenceOverlay?.documents || currentSourceDocuments,
  );
  const evaluatedSourceDocuments = recomputeVirginiaAcceptance(operationalDocuments, courses);
  const publication = publicationAudit({
    sourceDocuments: evaluatedSourceDocuments,
    projection,
    figureReadiness,
    requirementCapacityEvidenceOverlay:
      courseUnitEvidenceOverlay?.requirement_capacity_evidence || null,
  });
  // The shared projection deliberately rewrites option keys to `cc:<id>` for
  // the cross-state evaluator. Audit the projected document itself: it retains
  // the canonical Virginia source key (`va:CODE` or owner-scoped
  // `va:cc:<owner>:CODE`) in `source_course_keys`, including any deterministic
  // namespace repair performed at this projection boundary. Falling back to
  // the stale source wrapper here would falsely reject that safe remint.
  const identityDocuments = projection?.asDegrees || [];
  const identity = auditCourseIdentityResolution(
    identityDocuments,
    (projection?.courses || []).filter((row) => row?.side === 'sending'),
  );
  const report = {
    publishable: publication.publishable
      && identity.publication_ready
      && overlayGate.ready,
    verdict: publication.publishable
      && identity.publication_ready
      && overlayGate.ready ? 'pass' : 'fail',
    publication,
    identity,
    course_unit_evidence_overlay: overlayGate,
    ...projectionReceipt(projection),
  };
  PREFLIGHT_ATTESTATIONS.set(report, reportSha256(report));
  return report;
}

/**
 * Everything the Virginia publication gate checks EXCEPT whether each paper
 * figure is certified for release.
 *
 * The gate is otherwise all-or-nothing: one uncertified source row fails a
 * whole figure, which fails the whole publish, which is why no Virginia
 * document was ever written and every Virginia figure rendered null. But the
 * two questions are not the same. "Are these documents structurally sound?"
 * is answered here. "Is every pair backed by institutional verification?" is
 * answered per cell at render time, where an unproven pair already excludes
 * itself with a stated reason rather than being silently averaged in.
 *
 * So `--figures-uncertified` waives ONLY figure readiness. Cohort shape,
 * lossless projection, source accounting, shared schema, course identity, and
 * the unit-evidence overlay all still fail closed, and the exact figure
 * blockers being waived are recorded on the published manifest.
 */
function structuralPublicationIssues(report) {
  const publication = report?.publication || {};
  const issues = [];
  const push = (label, rows) => {
    if (Array.isArray(rows) && rows.length) issues.push(`${label} (${rows.length})`);
  };
  push('cohort', publication.cohort_failures);
  push('projection_loss', publication.projection_losses);
  push('source_accounting', publication.source_accounting_failures);
  // NOT structural: an alternate-source disposition asks which of two captures
  // of the same college to trust, not whether the document that actually
  // projects is sound. The selected source still has to pass cohort, lossless
  // projection, accounting, schema, and identity above. Waiving it is recorded
  // in `waived_alternate_source_dispositions` on the manifest.
  if (publication.projection_schema && publication.projection_schema.ready !== true) {
    issues.push('shared_schema');
  }
  if (report?.identity?.publication_ready !== true) issues.push('course_identity');
  if (report?.course_unit_evidence_overlay?.ready !== true) {
    issues.push('course_unit_evidence_overlay');
  }
  return issues;
}

function waivedFigureBlockers(report) {
  return (report?.publication?.paper_figure_failures || []).map((row) => ({
    figure: row.figure,
    blockers: [...(row.blockers || [])],
  }));
}

function waivedAlternateSourceDispositions(report) {
  return (report?.publication?.associate_source_disposition?.failures || []).map((row) => ({
    selected_source_id: row.selected_source_id,
    alternate_source_id: row.alternate_source_id,
    safety_issues: [...(row.safety_issues || [])],
  }));
}

function assertPublicationAllowed(report, options, dbName) {
  if (options.figuresUncertified) {
    const issues = structuralPublicationIssues(report);
    if (issues.length) {
      throw new Error(
        '--figures-uncertified waives paper-figure certification only; '
        + `these structural gates still fail: ${issues.join(', ')}`,
      );
    }
    return { override: !report.publishable, figuresUncertified: true };
  }
  if (options.allowIncomplete) {
    if (!options.staging || !clearlyNamedStagingDatabase(dbName)) {
      throw new Error(
        '--allow-incomplete is restricted to --staging and an allowlisted non-production database',
      );
    }
    return { override: !report.publishable };
  }
  if (!report.publishable) {
    throw new Error(
      'Virginia publication readiness failed; no data was changed. '
      + 'Resolve the reported blockers, or use --apply --allow-incomplete --staging '
      + 'against an allowlisted non-production database.',
    );
  }
  return { override: false };
}

function printPreflight(report) {
  const publication = report.publication;
  const identity = report.identity;
  const overlay = report.course_unit_evidence_overlay;
  console.log(`  publication gate   ${publication.verdict}`);
  console.log(`  source readiness   ${publication.source_summary.ready}/${publication.source_summary.total}`);
  console.log(`  source accounting  ${publication.source_accounting.length - publication.source_accounting_failures.length}/${publication.source_accounting.length}`);
  const sourceDispositions = publication.associate_source_disposition;
  if (sourceDispositions) {
    console.log(
      `  source alternates   ${sourceDispositions.counts?.safe || 0}`
        + `/${sourceDispositions.counts?.dispositions || 0} safe dispositions`,
    );
  }
  console.log(`  lossless documents ${publication.projection_conservation.length - publication.projection_losses.length}/${publication.projection_conservation.length}`);
  console.log(`  shared schema      ${publication.projection_schema?.ready === true ? 'pass' : 'fail'}`);
  const equivalencies = publication.figure_readiness?.transfer_equivalency_conditions;
  if (equivalencies) {
    console.log(
      `  equivalency notes  ${equivalencies.ready === true ? 'pass' : 'fail'}`
        + ` · ${equivalencies.counts?.ready_cells || 0}`
        + `/${equivalencies.counts?.cells || 0} cells`,
    );
  }
  console.log(`  identity references ${identity.stats.resolved}/${identity.stats.references}`);
  if (overlay) {
    console.log(
      `  unit evidence      ${overlay.ready === true ? 'pass' : 'fail'}`
        + ` · ${overlay.counts?.applied_evidence_rows || 0} exact rows`
        + ` · core unchanged ${overlay.receipts.filter((row) => (
          row.output_major_core_unchanged === true
        )).length}/${overlay.receipts.length}`,
    );
    for (const issue of overlay.issues || []) console.log(`  BLOCK unit_evidence — ${issue}`);
    for (const conflict of overlay.conflicts || []) {
      console.log(
        `  BLOCK unit_evidence:${conflict.document_id || '<cohort>'}:${conflict.path}`
          + ` [${conflict.code}]`,
      );
    }
  }
  const prerequisiteCounts = publication.figure_readiness?.pathway_complexity?.counts;
  if (prerequisiteCounts) {
    console.log(
      `  figure 6 corpus    VCCS ${prerequisiteCounts.community_college}`
        + ` rows / ${prerequisiteCounts.required_community_college} required`
        + ` · university ${prerequisiteCounts.university}`
        + ` rows / ${prerequisiteCounts.required_university} required`,
    );
  }
  for (const failure of publication.cohort_failures) {
    console.log(`  BLOCK cohort:${failure.field} expected ${failure.expected}, got ${failure.actual}`);
  }
  for (const source of publication.sources.filter((row) => !row.ready)) {
    const reasons = [...new Set([
      ...source.catalog_failures,
      ...source.analysis_failures,
      ...source.blockers,
    ])];
    console.log(`  BLOCK ${source.id} [${source.route}] — ${reasons.join(', ')}`);
  }
  for (const loss of publication.projection_losses) {
    console.log(`  BLOCK ${loss.id} [projection_loss] — ${loss.issues.map((issue) => issue.field).join(', ')}`);
  }
  for (const failure of publication.source_accounting_failures) {
    console.log(`  BLOCK ${failure.id} [source_accounting] — ${failure.issues.join(', ')}`);
  }
  for (const failure of publication.associate_source_disposition?.failures || []) {
    console.log(
      `  BLOCK ${failure.alternate_source_id || '<unknown>'} [source_alternate] — `
        + [...failure.receipt_issues, ...failure.safety_issues].join(', '),
    );
  }
  for (const failure of publication.identity_cohort?.issues || []) {
    const detail = failure.detail == null ? '' : ` — ${JSON.stringify(failure.detail)}`;
    console.log(`  BLOCK identity:${failure.path} [${failure.code}]${detail}`);
  }
  for (const failure of publication.projection_schema?.issues || []) {
    const detail = failure.detail == null ? '' : ` — ${JSON.stringify(failure.detail)}`;
    console.log(`  BLOCK schema:${failure.path} [${failure.code}]${detail}`);
  }
  for (const [issue, count] of Object.entries(identity.stats.issue_counts)) {
    console.log(`  BLOCK course_identity:${issue} ${count}`);
  }
  for (const failure of publication.figure_failures || []) {
    console.log(`  BLOCK ${failure.figure}:${failure.blocker}`);
  }
  console.log(`  combined verdict   ${report.verdict}`);
}

function printAcceptedSourcePlanComparison(report) {
  const authoritative = report.authoritative_condition_counts || {};
  const candidate = report.candidate_condition_counts || {};
  const delta = report.condition_delta || {};
  const safety = report.safety || {};
  const counts = safety.counts || {};
  const review = report.verification_review || {};
  console.log('\naccepted-source plan comparison (READ ONLY; NOT AUTHORITATIVE):');
  console.log('  authoritative input MongoDB va_requirements');
  console.log('  candidate input     checked-in accepted composition cache');
  console.log(
    `  condition cells    stored ${authoritative.ready_cells || 0}`
      + `/${authoritative.cells || 0} · candidate ${candidate.ready_cells || 0}`
      + `/${candidate.cells || 0}`,
  );
  console.log(
    `  exact matrix delta ${delta.exact === true ? 'pass' : 'fail'}`
      + ` · +${delta.gained_cells?.length || 0} gains`
      + ` · ${delta.regressed_cells?.length || 0} regressions`,
  );
  console.log(
    `  raw import safety  ${safety.ready_for_default_import === true ? 'pass' : 'BLOCKED'}`
      + ` · ${counts.verified_material_conflicts || 0} verified-material conflicts`
      + ` · ${counts.verified_core_conflicts || 0} verified-core conflicts`
      + ` · ${counts.overlapping_verified_conflicts || 0} overlap`,
  );
  console.log(
    `  operational review ${review.carried_verifications || 0} safe carries`
      + ` · ${review.validated_course_unit_evidence_overlays?.length || 0}`
      + ' evidence-only overlays'
      + ` · ${review.validated_requirement_capacity_evidence_projections?.length || 0}`
      + ' capacity projections'
      + ` · ${review.verified_core_conflicts?.length || 0} unresolved core`
      + ` · ${review.verified_material_conflicts?.length || 0} unresolved other material`,
  );
  console.log(
    `  review queue       ${review.changed_source_bundles || 0} changed source bundles`
      + ` · ${review.human_verification_required || 0} unsigned`
      + ` · ${(review.verified_core_conflicts?.length || 0)
        + (review.verified_material_conflicts?.length || 0)
        + (review.changed_source_bundles || 0)
        + (review.human_verification_required || 0)} total`,
  );
  for (const issue of delta.issues || []) console.log(`  BLOCK comparison — ${issue}`);
  for (const cell of delta.gained_cells || []) {
    console.log(
      `  GAIN ${cell.college_name} → ${cell.school}`
        + ` [${cell.associate_source_id}]`,
    );
  }
  for (const cell of delta.regressed_cells || []) {
    console.log(
      `  REGRESSION ${cell.college_name} → ${cell.school}`
        + ` [${cell.associate_source_id}]`,
    );
  }
  if (safety.verified_material_conflicts?.length) {
    console.log(
      `  RAW candidate material conflicts — ${safety.verified_material_conflicts.join(', ')}`,
    );
  }
  if (safety.verified_core_conflicts?.length) {
    console.log(`  BLOCK unresolved verified core — ${(review.verified_core_conflicts
      || safety.verified_core_conflicts).join(', ')}`);
  }
  if (safety.changed_verified_source_bundles?.length) {
    console.log(
      `  RAW candidate changed sources — ${safety.changed_verified_source_bundles.join(', ')}`,
    );
  }
  console.log(
    '  release status     candidate trees were not substituted, attested, or written; '
      + 'resolve importer conflicts and renew human verification first',
  );
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const dbName = process.env.DB_NAME || 'pmt_research';
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try {
    const db = client.db(dbName);
    if (options.restoreGenerationId) {
      const requested = await loadSnapshot(db, options.restoreGenerationId);
      const restoreConditionAudit = auditRestoreTargetDocuments(requested.documentsByCollection);
      console.log(`Virginia projection restore ${options.restoreGenerationId}`);
      for (const target of requested.manifest.targets) {
        console.log(`  ${target.collection.padEnd(22)} ${target.count} ${target.sha256}`);
      }
      console.log(
        `  equivalency audit      ${restoreConditionAudit.ready === true ? 'pass' : 'fail'}`,
      );
      if (!options.apply) {
        console.log(
          restoreConditionAudit.ready === true
            ? '\ndry run — backup bytes are complete and pass the current diagnostic audit. '
              + 'An applied restore is exact and leaves Virginia analysis disabled until '
              + 'a fresh full publication passes.'
            : '\ndry run — backup bytes are complete but fail the current diagnostic audit. '
              + 'An applied restore remains available for recovery, but Virginia analysis '
              + 'will stay disabled until a fresh full publication passes.',
        );
        return;
      }
      const restored = await restoreProjection({
        client,
        db,
        generationId: options.restoreGenerationId,
        allowIncompleteStaging: options.allowIncomplete,
      });
      console.log(`\nrestored ${restored.restored_generation_id} transactionally.`);
      console.log(`pre-restore state saved as ${restored.rollback_generation_id}.`);
      return;
    }

    const [
      courses,
      sourceDocuments,
      institutions,
      communityCollegeRequisites,
      universityRequisites,
      activePrerequisiteVerificationReceipts,
    ] = await Promise.all([
      db.collection('va_courses').find({}).toArray(),
      db.collection('va_requirements').find({}).toArray(),
      db.collection('va_institutions').find({}).toArray(),
      db.collection('va_course_requisites').find({}).toArray(),
      db.collection('va_university_course_requisites').find({}).toArray(),
      db.collection('va_figure6_prerequisite_publications')
        .find({ active: true }).limit(2).toArray(),
    ]);
    const prerequisiteVerificationReceipt = activePrerequisiteVerificationReceipts.length === 1
      ? activePrerequisiteVerificationReceipts[0] : null;
    // Exact unit facts may advance independently of a human-approved major
    // tree. Overlay only those facts onto the current source cohort, with a
    // per-document proof that the verified core stayed byte-stable, before
    // either acceptance or projection reads the documents.
    const unitEvidenceOverlay = operationalCourseUnitEvidenceOverlay({
      sourceDocuments,
      courses,
    });
    // Production uses the same checked-out acceptance evaluator as the
    // read-only audit. Persisted receipts are provenance, not authority.
    const evaluatedSourceDocuments = recomputeVirginiaAcceptance(
      operationalVirginiaDegreeSources(sourceDocuments, unitEvidenceOverlay.documents),
      courses,
    );
    const degrees = evaluatedSourceDocuments
      .filter((doc) => doc.kind === 'degree' && doc.status === 'extracted');
    const asDegrees = evaluatedSourceDocuments
      .filter((doc) => doc.kind === 'as_degree' && doc.status === 'extracted');
    const projection = buildProjection({
      courses,
      degrees,
      asDegrees,
      institutions,
      requirementCapacityEvidenceOverlay:
        unitEvidenceOverlay.requirement_capacity_evidence,
    });
    projectionTargetDocuments(projection);
    const verified = projection.asDegrees.filter((doc) => doc.verification?.verified === true).length;
    const analysisReady = projection.asDegrees.filter((doc) => doc.analysis_ready === true).length;
    console.log('Virginia projection');
    console.log(`  institutions      ${projection.institutions.length}`);
    console.log(`  courses           ${projection.courses.length}`);
    console.log(`  degrees           ${projection.degrees.length}`);
    console.log(`  associate degrees ${projection.asDegrees.length} (${verified} verified, ${analysisReady} analysis ready)`);
    console.log(`  agreements        ${projection.agreements.length}`);
    for (const alt of projection.asAlternates) {
      console.log(
        `  note: ${alt.chosen} chosen as the college's program; explicitly superseded `
          + alt.dropped.join(', '),
      );
    }
    for (const skipped of projection.withoutEquivalencies) {
      console.log(`  note: ${skipped.degree_id} excluded — ${skipped.reason}`);
    }

    const preflight = publicationPreflight({
      sourceDocuments,
      projection,
      courses,
      courseUnitEvidenceOverlay: unitEvidenceOverlay,
      prerequisiteCorpora: {
        communityCollegeRows: communityCollegeRequisites,
        universityRows: universityRequisites,
        verificationReceipt: prerequisiteVerificationReceipt,
        adapterIntegrated: true,
      },
    });
    const sourcePlanComparison = options.sourcePlan
      ? acceptedSourcePlanComparison({
        storedSourceDocuments: sourceDocuments,
        candidateDocuments: cachedAcceptedSourcePlan(new Map(courses.map((course) => [
          course.code, course.credits,
        ]))).documents,
        courses,
        institutions,
        authoritativeProjection: projection,
        authoritativeConditionAudit: preflight.publication.figure_readiness
          .transfer_equivalency_conditions,
        courseUnitEvidenceOverlay: unitEvidenceOverlay,
      }) : null;
    console.log('\npreflight:');
    printPreflight(preflight);
    if (sourcePlanComparison) printAcceptedSourcePlanComparison(sourcePlanComparison);
    if (!options.apply) {
      if (options.figuresUncertified) {
        const structural = structuralPublicationIssues(preflight);
        const waived = waivedFigureBlockers(preflight);
        console.log('\nfigures-uncertified preview:');
        console.log(`  structural gates   ${structural.length ? `FAIL — ${structural.join(', ')}` : 'pass'}`);
        for (const row of waived) {
          console.log(`  WAIVE Figure ${row.figure} — ${row.blockers.join(', ')}`);
        }
        for (const row of waivedAlternateSourceDispositions(preflight)) {
          console.log(`  WAIVE alternate source ${row.alternate_source_id} — ${row.safety_issues.join(', ')}`);
        }
        console.log(
          structural.length
            ? '\ndry run — nothing written. --figures-uncertified cannot run while a '
              + 'structural gate fails.'
            : '\ndry run — nothing written. Re-run with --apply --figures-uncertified to '
              + 'publish these documents with the figure certifications above waived.',
        );
        if (structural.length) process.exitCode = 1;
        return;
      }
      console.log(
        options.sourcePlan
          ? '\nsource-plan dry run — nothing written; the authoritative projection still uses '
            + 'va_requirements, and candidate trees cannot be published by this command.'
          : '\ndry run — nothing written. A passing gate is required for --apply.',
      );
      if (preflight.publishable !== true) process.exitCode = 1;
      return;
    }

    const permission = assertPublicationAllowed(preflight, options, dbName);
    if (permission.figuresUncertified) {
      console.log('\nUNCERTIFIED: publishing structurally sound documents whose paper figures '
        + 'carry no release certification. Every figure renders behind that notice, and '
        + 'unproven pairs exclude themselves per cell.');
    } else if (permission.override) {
      console.log('\nSTAGING ONLY: publishing an incomplete projection under explicit override.');
    }
    const published = await publishProjection({
      client,
      db,
      projection,
      preflightReport: preflight,
      // Keep the two overrides distinct. The staging override bypasses every
      // gate and is allowlisted to a non-production database; the
      // figures-uncertified override waives only paper-figure certification
      // and still requires every structural gate to pass.
      allowIncompleteStaging: permission.figuresUncertified ? false : permission.override,
      figuresUncertified: permission.figuresUncertified === true,
    });
    console.log('\npublished all four Virginia targets in one transaction.');
    console.log(`pre-publication rollback generation: ${published.generation_id}`);
    console.log(`restore preview: node scripts/va/buildVaDocuments.js --restore=${published.generation_id}`);
    console.log(`restore apply:   node scripts/va/buildVaDocuments.js --restore=${published.generation_id} --apply`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = {
  ASSOCIATE_SOURCE_DISPOSITION_CONTRACT,
  VA_FILTER,
  VA_TARGETS,
  acceptedSourcePlanComparison,
  associateSourceRank,
  assertPublicationAllowed,
  buildSnapshot,
  buildProjection,
  canonicalDocumentHash,
  candidateSourceSafetyAudit,
  clearlyNamedStagingDatabase,
  compareAssociateSources,
  completeInstitutionRoster,
  courseUnitOverlayGate,
  localSendingCourses,
  mergeSourceNamedSharedCourses,
  augmentAgreementCourseOfferings,
  officialVirginiaDegreeSources,
  operationalCourseUnitEvidenceOverlay,
  operationalVirginiaDegreeSources,
  equivalencyConditionDelta,
  parseCliArgs,
  printAcceptedSourcePlanComparison,
  printPreflight,
  projectGroups,
  projectionTargetDocuments,
  projectionReceipt,
  publicationPreflight,
  recomputeVirginiaAcceptance,
  receivingCourses,
  restoreProjection,
  selectAssociateSources,
  sourceNamedSharedCourseEvidence,
  targetManifest,
  validateSnapshot,
  validateTargetDocuments,
  publishProjection,
};
