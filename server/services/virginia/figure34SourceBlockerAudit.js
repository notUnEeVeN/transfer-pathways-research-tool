/**
 * Independent, read-only recount and evidence audit for the Virginia Figure
 * 3/4 source-blocked cohort.
 *
 * The publication gate remains authoritative.  This module does not change a
 * source document, acceptance receipt, or gate decision; it only checks the
 * row-level output against a separately reviewed, hash-bound closure plan.
 */

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  PROOF_TREE_SHA256: VIRGINIA_TECH_CANDIDATE_PROOF_TREE_SHA256,
  SOURCE_BUNDLE_SHA256: VIRGINIA_TECH_SOURCE_BUNDLE_SHA256,
  virginiaTechProofTreeFingerprint,
} = require('../analysis/virginiaTechConstraintProofs');
const { majorCoreHash } = require('./majorCoreIntegrity');

const EXPECTED_GATE_REPRODUCTION = Object.freeze({
  total_rows: 35,
  ready_rows: 21,
  blocked_rows: 14,
  blocked_associate_documents: 9,
  blocked_bachelor_documents: 5,
});

const VIRGINIA_TECH_DOCUMENT_ID =
  'va:degree:virginia-polytechnic-institute-and-state-university:cs';
const VIRGINIA_TECH_PROTECTED_PROOF_TREE_SHA256 =
  '14bc69c7b2e40a83e875f41ef0a3d8cb980348e25e6b643ad1f3571d88ba6c67';
const VIRGINIA_TECH_CANDIDATE_CORE_SHA256 =
  'aa0c2173007ff7a6ca97164f391941f4a3365361ca57099ce545abb900593f2d';
const VIRGINIA_TECH_PROTECTED_CORE_SHA256 =
  'f4448d879189e426d36192e1f165a920d8545a5c284a40cce91d0a041de99469';
const VIRGINIA_TECH_CANDIDATE_ONLY_ALTERNATIVES = Object.freeze([
  Object.freeze({
    code: 'CS2064', units: 3,
    path: 'requirement_groups[0].sections[0].receivers[1]',
  }),
  Object.freeze({
    code: 'ECE2564', units: 3,
    path: 'requirement_groups[0].sections[1].receivers[1]',
  }),
  Object.freeze({
    code: 'MATH2405H', units: 5,
    path: 'requirement_groups[0].sections[5].receivers[1]',
  }),
  Object.freeze({
    code: 'MATH2406H', units: 5,
    path: 'requirement_groups[0].sections[6].receivers[2]',
  }),
  Object.freeze({
    code: 'ECE3514', units: 3,
    path: 'requirement_groups[3].sections[1].receivers[1]',
  }),
]);

const CLASSIFICATIONS = new Set([
  'a_existing_evidence_automation',
  'b_new_official_source_capture',
  'c_human_institutional_verification',
]);

// These are engineering actions, but they are not executable from the
// retained evidence today.  Pinning the dependency edges prevents the class-A
// label from being used as an authorization to run either evaluator against
// an incomplete roster or an unresolved degree-application policy.
const EXPECTED_DEPENDENCY_BLOCKED_AUTOMATION = Object.freeze([
  Object.freeze({
    id: 'va:degree:randolph-macon-college:cs',
    key: 'rmc_integrate_collegiate_overlap_evaluator',
    depends_on: Object.freeze(['rmc_complete_current_collegiate_roster']),
    dependency_classifications: Object.freeze(['b_new_official_source_capture']),
  }),
  Object.freeze({
    id: 'va:degree:randolph-macon-college:cs',
    key: 'rmc_integrate_transfer_residency_allocator',
    depends_on: Object.freeze(['rmc_obtain_program_transfer_application_decisions']),
    dependency_classifications: Object.freeze(['c_human_institutional_verification']),
  }),
]);

const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const sorted = (values) => [...values].sort((left, right) => (
  String(left).localeCompare(String(right))
));

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sameSet(actual, expected) {
  const left = sorted(new Set(actual));
  const right = sorted(new Set(expected));
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function exactArray(actual, expected) {
  return Array.isArray(actual) && Array.isArray(expected)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function exactJson(actual, expected) {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected)
      && actual.length === expected.length
      && actual.every((value, index) => exactJson(value, expected[index]));
  }
  if (!actual || typeof actual !== 'object'
      || !expected || typeof expected !== 'object') return actual === expected;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return exactArray(actualKeys, expectedKeys)
    && actualKeys.every((key) => exactJson(actual[key], expected[key]));
}

function virginiaTechReceiver(document, receipt) {
  const match = /^requirement_groups\[(\d+)]\.sections\[(\d+)]\.receivers\[(\d+)]$/
    .exec(text(receipt?.path));
  if (!match) return null;
  return document?.requirement_groups?.[Number(match[1])]
    ?.sections?.[Number(match[2])]?.receivers?.[Number(match[3])] || null;
}

function removeVirginiaTechReceiver(document, receipt) {
  const match = /^requirement_groups\[(\d+)]\.sections\[(\d+)]\.receivers\[(\d+)]$/
    .exec(text(receipt?.path));
  if (!match) return false;
  const receivers = document?.requirement_groups?.[Number(match[1])]
    ?.sections?.[Number(match[2])]?.receivers;
  if (!Array.isArray(receivers) || Number(match[3]) >= receivers.length) return false;
  receivers.splice(Number(match[3]), 1);
  return true;
}

function virginiaTechProtectedCoreIssues(document, sourceDocument) {
  if (document?.id !== VIRGINIA_TECH_DOCUMENT_ID) return [];
  const issues = [];
  const receipt = document?.protected_tree_reconciliation;
  const expectedConflictReceipt = {
    category: 'verified_protected_core_change',
    unresolved: true,
    raw_candidate_import_blocked: true,
    protected_core_diff_count: 5,
    protected_core_path_receipts: [{
      category: 'course_or_choice',
      path_pattern: 'requirement_groups[].sections[].receivers[]',
      change: 'added',
      leaf_diff_count: 5,
    }],
    requirement_capacity_evidence_projection: { safe: false },
  };
  if (!receipt
      || receipt.contract !== 'virginia_tech_protected_candidate_core_reconciliation_v1'
      || receipt.source_bundle_sha256 !== VIRGINIA_TECH_SOURCE_BUNDLE_SHA256
      || receipt.protected_proof_tree_sha256
        !== VIRGINIA_TECH_PROTECTED_PROOF_TREE_SHA256
      || receipt.candidate_proof_tree_sha256
        !== VIRGINIA_TECH_CANDIDATE_PROOF_TREE_SHA256
      || receipt.protected_major_core_sha256 !== VIRGINIA_TECH_PROTECTED_CORE_SHA256
      || receipt.candidate_major_core_sha256 !== VIRGINIA_TECH_CANDIDATE_CORE_SHA256
      || receipt.raw_candidate_signature_status !== 'unsigned'
      || receipt.raw_candidate_import_blocked !== true
      || receipt.automatic_overlay_allowed !== false
      || receipt.required_closure
        !== 'independent_protected_core_reconciliation_and_current_signature'
      || !exactJson(
        receipt.candidate_only_official_alternatives,
        VIRGINIA_TECH_CANDIDATE_ONLY_ALTERNATIVES,
      )
      || !exactJson(receipt.publication_verification_receipt, expectedConflictReceipt)) {
    issues.push(`${document.id} protected-tree reconciliation receipt changed`);
    return issues;
  }

  if (sourceDocument?.provenance?.source_bundle_hash
      !== VIRGINIA_TECH_SOURCE_BUNDLE_SHA256
      || virginiaTechProofTreeFingerprint(sourceDocument)
        !== VIRGINIA_TECH_CANDIDATE_PROOF_TREE_SHA256
      || majorCoreHash(sourceDocument) !== VIRGINIA_TECH_CANDIDATE_CORE_SHA256
      || sourceDocument?.verification?.verified === true) {
    issues.push(`${document.id} unsigned candidate source/core receipt changed`);
    return issues;
  }

  const reconstructedProtected = structuredClone(sourceDocument);
  for (const alternative of VIRGINIA_TECH_CANDIDATE_ONLY_ALTERNATIVES) {
    const receiver = virginiaTechReceiver(sourceDocument, alternative);
    if (text(receiver?.code_seen) !== alternative.code
        || text(receiver?.receiving?.kind) !== 'course'
        || Number(receiver?.receiving?.units) !== alternative.units
        || !removeVirginiaTechReceiver(reconstructedProtected, alternative)) {
      issues.push(`${document.id} candidate-only alternative ${alternative.code} changed`);
    }
  }
  if (issues.length) return issues;
  if (virginiaTechProofTreeFingerprint(reconstructedProtected)
      !== VIRGINIA_TECH_PROTECTED_PROOF_TREE_SHA256
      || majorCoreHash(reconstructedProtected) !== VIRGINIA_TECH_PROTECTED_CORE_SHA256) {
    issues.push(`${document.id} exact five-receiver protected-tree reconstruction changed`);
  }
  return issues;
}

function virginiaTechSourcePlanIssues(report, document) {
  if (document?.id !== VIRGINIA_TECH_DOCUMENT_ID) return [];
  const issues = [];
  const plan = report?.source_plan;
  const expected = document?.protected_tree_reconciliation
    ?.publication_verification_receipt;
  const conflict = array(plan?.conflict_receipts).find((row) => (
    text(row?.id) === VIRGINIA_TECH_DOCUMENT_ID
  ));
  if (!array(plan?.raw_verified_core_conflicts).includes(VIRGINIA_TECH_DOCUMENT_ID)
      || !array(plan?.verified_core_conflicts).includes(VIRGINIA_TECH_DOCUMENT_ID)
      || !conflict) {
    issues.push(`${document.id} live protected-core conflict receipt is missing`);
    return issues;
  }
  const actual = {
    category: conflict.category,
    unresolved: conflict.unresolved,
    raw_candidate_import_blocked: conflict.raw_candidate_import_blocked,
    protected_core_diff_count: conflict.protected_core_diff_count,
    protected_core_path_receipts: conflict.protected_core_path_receipts,
    requirement_capacity_evidence_projection:
      conflict.requirement_capacity_evidence_projection,
  };
  if (!exactJson(actual, expected)) {
    issues.push(`${document.id} live protected-core conflict receipt changed`);
  }
  return issues;
}

function blockerReferenceInventory(row) {
  const refs = [];
  if (array(row?.blockers).includes('current_human_verification_required')) {
    refs.push('human:current_human_verification_required');
  }
  for (const failure of array(row?.catalog_failures)) {
    refs.push(`catalog:${text(failure)}`);
  }
  for (const constraint of array(row?.figure_constraint_blockers)) {
    refs.push(`constraint:${text(constraint?.path)}:${text(constraint?.kind)}`);
  }
  for (const flag of array(row?.unresolved_analysis_quality_flags)) {
    refs.push(`quality:${text(flag?.code)}`);
  }
  for (const flag of array(row?.blocking_source_research_flags)) {
    refs.push(`source_flag:${text(flag?.code)}`);
  }
  return sorted(refs);
}

function directSummary(rows) {
  const total = array(rows).length;
  const ready = array(rows).filter((row) => row?.ready === true).length;
  return { total, ready, blocked: total - ready };
}

function sourceIdentity(row) {
  return text(row?.source_id || row?.id);
}

function rowIds(rows) {
  return array(rows).map(sourceIdentity);
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return sorted(duplicates);
}

function findingReferences(document) {
  return array(document?.findings).flatMap((finding) => array(finding?.refs));
}

function findingAffectedFigures(finding) {
  const declared = array(finding?.affected_figures).map(text).filter(Boolean);
  return declared.length ? declared : ['3', '4'];
}

function figure34FindingReferences(document) {
  return array(document?.findings)
    .filter((finding) => findingAffectedFigures(finding)
      .some((figure) => figure === '3' || figure === '4'))
    .flatMap((finding) => array(finding?.refs).map(text));
}

function remainingActionReferences(document) {
  return array(document?.figure34_remaining_actions)
    .flatMap((action) => array(action?.refs).map(text));
}

function classificationCounts(rows) {
  return Object.fromEntries([...CLASSIFICATIONS].map((classification) => (
    [classification, array(rows).filter((row) => row?.classification === classification).length]
  )));
}

/**
 * Distinguish an action's implementation class from whether it can safely run
 * now. Every `depends_on` target is another open action in this artifact, so a
 * declared dependency is unresolved by construction. This report is derived
 * rather than trusted from a summary field in the JSON artifact.
 */
function automatableActionReadiness(documents) {
  const actions = array(documents).flatMap((document) => {
    const actionByKey = new Map(array(document?.figure34_remaining_actions).map((action) => [
      text(action?.key), action,
    ]));
    return array(document?.figure34_remaining_actions)
      .filter((action) => action?.classification === 'a_existing_evidence_automation')
      .map((action) => {
        const dependencies = array(action?.depends_on).map(text);
        return {
          id: text(document?.id),
          key: text(action?.key),
          depends_on: dependencies,
          dependency_classifications: dependencies.map((key) => (
            text(actionByKey.get(key)?.classification)
          )),
          immediately_executable: dependencies.length === 0,
        };
      });
  });
  return {
    total: actions.length,
    immediately_executable: actions.filter((action) => action.immediately_executable).length,
    dependency_blocked: actions.filter((action) => !action.immediately_executable).length,
    actions,
  };
}

function automationDependencyIssues(documents) {
  const actual = automatableActionReadiness(documents).actions.map((action) => ({
    id: action.id,
    key: action.key,
    depends_on: action.depends_on,
    dependency_classifications: action.dependency_classifications,
  }));
  return exactJson(actual, EXPECTED_DEPENDENCY_BLOCKED_AUTOMATION)
    ? []
    : ['Figure 3/4 automatable-action dependency receipt changed'];
}

function remainingActionIssues(document) {
  const issues = [];
  const id = text(document?.id);
  const actions = array(document?.figure34_remaining_actions);
  if (document?.kind === 'degree' && !actions.length) {
    issues.push(`${id} has no explicit Figure 3/4 remaining actions`);
    return issues;
  }
  if (!actions.length) return issues;

  const keys = actions.map((action) => text(action?.key));
  if (keys.some((key) => !key)) issues.push(`${id} has a Figure 3/4 action without a key`);
  if (duplicateValues(keys).length) {
    issues.push(`${id} Figure 3/4 action keys are duplicated: ${duplicateValues(keys).join(', ')}`);
  }
  const keySet = new Set(keys);
  const relevantRefs = figure34FindingReferences(document);
  const actionRefs = remainingActionReferences(document);

  for (const action of actions) {
    const key = text(action?.key) || '<missing>';
    if (!CLASSIFICATIONS.has(action?.classification)) {
      issues.push(`${id} Figure 3/4 action ${key} has an invalid classification`);
    }
    if (!text(action?.action)) {
      issues.push(`${id} Figure 3/4 action ${key} has no action text`);
    }
    if (!array(action?.refs).length) {
      issues.push(`${id} Figure 3/4 action ${key} has no exact output refs`);
    }
    for (const ref of array(action?.refs).map(text)) {
      if (!relevantRefs.includes(ref)) {
        issues.push(`${id} Figure 3/4 action ${key} cites non-Figure-3/4 ref ${ref}`);
      }
    }
    for (const dependency of array(action?.depends_on).map(text)) {
      if (!keySet.has(dependency)) {
        issues.push(`${id} Figure 3/4 action ${key} has missing dependency ${dependency}`);
      }
      if (dependency === key) {
        issues.push(`${id} Figure 3/4 action ${key} depends on itself`);
      }
    }
  }
  // A blocker can legitimately need more than one action (for example, an
  // official roster followed by an institutional application decision), so
  // duplicate action refs are allowed.  The set must nevertheless cover
  // every and only the finding refs that can affect Figures 3/4.
  if (!sameSet(relevantRefs, actionRefs)) {
    issues.push(`${id} Figure 3/4 actions do not cover the exact figure-specific blocker refs`);
  }
  return issues;
}

/**
 * Recount Figure 3/4 rows directly.  The stored summary is compared only
 * after the count is derived from each row, so a self-consistent but false
 * summary or a count-preserving id substitution fails.
 */
function recountFigure34SourceGate(report, artifact) {
  const issues = [];
  const expected = artifact?.gate_reproduction || {};
  const figures = ['3', '4'];
  const byFigure = {};

  for (const figure of figures) {
    const gate = report?.publication_by_figure?.[figure];
    if (!gate) {
      issues.push(`publication_by_figure.${figure} is missing`);
      continue;
    }
    const sourceRows = array(gate.sources);
    const projectedRows = array(gate.projected_sources);
    const source = directSummary(sourceRows);
    const projected = directSummary(projectedRows);
    const sourceIds = rowIds(sourceRows);
    const projectedIds = rowIds(projectedRows);
    const blockedIds = sorted(sourceRows.filter((row) => row?.ready !== true)
      .map(sourceIdentity));
    const projectedBlockedIds = sorted(projectedRows.filter((row) => row?.ready !== true)
      .map(sourceIdentity));

    if (duplicateValues(sourceIds).length) {
      issues.push(`figure ${figure} source ids are duplicated: ${duplicateValues(sourceIds).join(', ')}`);
    }
    if (duplicateValues(projectedIds).length) {
      issues.push(`figure ${figure} projected ids are duplicated: ${duplicateValues(projectedIds).join(', ')}`);
    }
    if (!sameSet(sourceIds, projectedIds)) {
      issues.push(`figure ${figure} source/projected id cohorts differ`);
    }
    if (!sameSet(blockedIds, projectedBlockedIds)) {
      issues.push(`figure ${figure} source/projected blocked id cohorts differ`);
    }
    for (const id of sourceIds) {
      const sourceReady = sourceRows.find((row) => sourceIdentity(row) === id)?.ready === true;
      const projectedReady = projectedRows.find((row) => sourceIdentity(row) === id)?.ready === true;
      if (sourceReady !== projectedReady) {
        issues.push(`figure ${figure} source/projected readiness differs for ${id}`);
      }
    }
    for (const [key, value] of Object.entries(source)) {
      if (Number(gate?.source_summary?.[key]) !== value) {
        issues.push(`figure ${figure} source summary ${key} is ${gate?.source_summary?.[key]}, recounted ${value}`);
      }
    }
    for (const [key, value] of Object.entries(projected)) {
      if (Number(gate?.projected_source_summary?.[key]) !== value) {
        issues.push(`figure ${figure} projected summary ${key} is ${gate?.projected_source_summary?.[key]}, recounted ${value}`);
      }
    }
    if (source.total !== Number(expected.total_rows)
        || source.ready !== Number(expected.ready_rows)
        || source.blocked !== Number(expected.blocked_rows)) {
      issues.push(
        `figure ${figure} direct count is ${source.ready}/${source.total}`
          + ` with ${source.blocked} blocked; expected ${expected.ready_rows}`
          + `/${expected.total_rows} with ${expected.blocked_rows} blocked`,
      );
    }
    if (!sameSet(blockedIds, array(expected.blocked_document_ids))) {
      issues.push(`figure ${figure} blocked id cohort differs from the reviewed blocked cohort`);
    }
    byFigure[figure] = {
      source,
      projected,
      blocked_document_ids: blockedIds,
      source_projected_id_parity: sameSet(sourceIds, projectedIds),
      source_projected_blocked_parity: sameSet(blockedIds, projectedBlockedIds),
    };
  }

  if (byFigure['3'] && byFigure['4']
      && !sameSet(byFigure['3'].blocked_document_ids, byFigure['4'].blocked_document_ids)) {
    issues.push('Figure 3 and Figure 4 blocked id cohorts differ');
  }

  const artifactById = new Map(array(artifact?.documents).map((document) => [
    text(document?.id), document,
  ]));
  const figure3Rows = array(report?.publication_by_figure?.['3']?.sources)
    .filter((row) => row?.ready !== true);
  for (const row of figure3Rows) {
    const id = text(row?.id);
    const document = artifactById.get(id);
    if (!document) {
      issues.push(`blocked document ${id} has no reviewed classification`);
      continue;
    }
    const actualBlockers = sorted(array(row?.blockers).map(text));
    const expectedBlockers = sorted(array(document?.operational_blockers).map(text));
    if (!exactArray(actualBlockers, expectedBlockers)) {
      issues.push(`${id} operational blocker codes changed`);
    }
    const actualRefs = blockerReferenceInventory(row);
    const expectedRefs = sorted(array(document?.operational_refs).map(text));
    if (!exactArray(actualRefs, expectedRefs)) {
      issues.push(`${id} detailed blocker inventory changed`);
    }
    const covered = findingReferences(document);
    if (!sameSet(actualRefs, covered)) {
      issues.push(`${id} findings do not classify every detailed blocker exactly`);
    }
    if (duplicateValues(covered).length) {
      issues.push(`${id} blocker references have multiple classifications: ${duplicateValues(covered).join(', ')}`);
    }
    issues.push(...virginiaTechSourcePlanIssues(report, document));
  }

  const findings = array(artifact?.documents).flatMap((document) => array(document?.findings));
  const remainingActions = array(artifact?.documents)
    .flatMap((document) => array(document?.figure34_remaining_actions));
  const automationReadiness = automatableActionReadiness(artifact?.documents);
  return {
    valid: issues.length === 0,
    issues,
    figures: byFigure,
    classification_counts: classificationCounts(findings),
    figure34_remaining_action_counts: classificationCounts(remainingActions),
    figure34_automatable_action_readiness: automationReadiness,
  };
}

function exactRetainedSourceIssues(
  document, sourceDocument, pageIndex, pagesDir, integrityManifest,
) {
  const issues = [];
  const pageRows = array(pageIndex?.[document.slug]?.pages);
  for (const source of array(sourceDocument?.sources)) {
    const matches = pageRows.filter((page) => text(page?.sha256) === text(source?.sha256));
    const indexedRetained = matches.find((page) => {
      const file = path.join(pagesDir, `${page.file}.txt`);
      return fs.existsSync(file) && sha256File(file) === text(source?.sha256);
    });
    const manifestRow = array(integrityManifest?.exact_local_byte_matches).find((row) => (
      text(row?.institution) === document.slug
        && text(row?.source_id) === text(source?.id)
        && text(row?.declared_sha256) === text(source?.sha256)
        && row?.byte_reproducible === true
    ));
    const manifestFile = manifestRow?.retained_text_path
      ? path.resolve(pagesDir, '../../..', manifestRow.retained_text_path) : null;
    const manifestRetained = manifestFile && fs.existsSync(manifestFile)
      && sha256File(manifestFile) === text(source?.sha256);
    if (!indexedRetained && !manifestRetained) {
      issues.push(`${document.id} source ${source.id} has no exact retained text bytes`);
    }
  }
  return issues;
}

function transparentExceptionIssues(document, sourceDocument, pageIndex, integrityManifest) {
  const issues = [];
  const pageRecord = pageIndex?.[document.slug];
  if (text(pageRecord?.outcome) !== 'blocked') {
    issues.push(`${document.id} transport exception no longer has a blocked capture outcome`);
  }
  const catalogSources = array(sourceDocument?.sources).filter((source) => (
    source.id !== 'vccs_master_csc221'
  ));
  const pages = array(pageRecord?.pages);
  if (!catalogSources.length || pages.length < catalogSources.length
      || pages.some((page) => Number(page?.status) !== 403 || page?.has_content === true)) {
    issues.push(`${document.id} transport exception is not pinned to the retained 403 challenge captures`);
  }
  const exceptions = array(integrityManifest?.exceptions).filter((row) => (
    text(row?.institution) === document.slug
  ));
  for (const source of array(sourceDocument?.sources)) {
    const match = exceptions.find((row) => (
      text(row?.source_id) === text(source?.id)
        && text(row?.declared_sha256) === text(source?.sha256)
        && row?.byte_reproducible === false
    ));
    if (!match) {
      issues.push(`${document.id} source ${source.id} lacks its explicit non-byte-reproducible manifest exception`);
    }
  }
  return issues;
}

/**
 * Validate the static closure plan against the checked-in candidate source
 * plan and retained capture hashes.  This deliberately does not treat a
 * provenance-only exception as equivalent to retained official bytes.
 */
function validateFigure34SourceBlockerArtifact(artifact, {
  sourceDocuments = [],
  pageIndex = {},
  integrityManifest = {},
  pagesDir,
} = {}) {
  const issues = [];
  if (Number(artifact?.schema_version) !== 1) issues.push('schema_version must be 1');
  if (text(artifact?.artifact) !== 'virginia_figure34_source_blocker_audit') {
    issues.push('artifact identity is invalid');
  }
  const documents = array(artifact?.documents);
  for (const [field, expected] of Object.entries(EXPECTED_GATE_REPRODUCTION)) {
    if (Number(artifact?.gate_reproduction?.[field]) !== expected) {
      issues.push(`gate_reproduction.${field} must be ${expected}`);
    }
  }
  const ids = documents.map((document) => text(document?.id));
  if (documents.length !== Number(artifact?.gate_reproduction?.blocked_rows)) {
    issues.push('document count does not match gate_reproduction.blocked_rows');
  }
  if (duplicateValues(ids).length) issues.push(`document ids are duplicated: ${duplicateValues(ids).join(', ')}`);
  if (!sameSet(ids, array(artifact?.gate_reproduction?.blocked_document_ids))) {
    issues.push('document ids do not match the reviewed blocked cohort');
  }
  const associateCount = documents.filter((document) => document?.kind === 'as_degree').length;
  const bachelorCount = documents.filter((document) => document?.kind === 'degree').length;
  if (associateCount !== EXPECTED_GATE_REPRODUCTION.blocked_associate_documents
      || bachelorCount !== EXPECTED_GATE_REPRODUCTION.blocked_bachelor_documents) {
    issues.push(`blocked kind counts are ${associateCount} associate and ${bachelorCount} bachelor`);
  }

  const sourceById = new Map(array(sourceDocuments).map((document) => [text(document?._id), document]));
  let humanDocuments = 0;
  for (const document of documents) {
    const id = text(document?.id);
    const sourceDocument = sourceById.get(id);
    if (!sourceDocument) {
      issues.push(`${id} is absent from the checked-in candidate source plan`);
      continue;
    }
    if (text(sourceDocument?.kind) !== text(document?.kind)) issues.push(`${id} kind changed`);
    if (text(sourceDocument?.provenance?.source_bundle_hash)
        !== text(document?.source_bundle_sha256)) {
      issues.push(`${id} source bundle hash changed`);
    }
    issues.push(...virginiaTechProtectedCoreIssues(document, sourceDocument));
    const refs = array(document?.operational_refs).map(text);
    const classifiedRefs = findingReferences(document).map(text);
    if (!sameSet(refs, classifiedRefs)) issues.push(`${id} has an unclassified or invented blocker reference`);
    if (duplicateValues(classifiedRefs).length) issues.push(`${id} blocker references are classified more than once`);
    for (const finding of array(document?.findings)) {
      if (!CLASSIFICATIONS.has(finding?.classification)) {
        issues.push(`${id} finding ${finding?.key || '<missing>'} has an invalid classification`);
      }
      if (!text(finding?.basis) || !text(finding?.closure)) {
        issues.push(`${id} finding ${finding?.key || '<missing>'} lacks basis or closure`);
      }
      if (!array(finding?.refs).length) issues.push(`${id} finding ${finding?.key || '<missing>'} has no exact output refs`);
      const figures = findingAffectedFigures(finding);
      if (figures.some((figure) => !['1', '3', '4', '6'].includes(figure))
          || duplicateValues(figures).length) {
        issues.push(`${id} finding ${finding?.key || '<missing>'} has invalid affected figures`);
      }
    }
    issues.push(...remainingActionIssues(document));
    if (refs.includes('human:current_human_verification_required')) humanDocuments += 1;
    if (document?.retained_source_status === 'exact_retained_official_bytes') {
      issues.push(...exactRetainedSourceIssues(
        document, sourceDocument, pageIndex, pagesDir, integrityManifest,
      ));
    } else if (document?.retained_source_status === 'transparent_render_transport_exception') {
      issues.push(...transparentExceptionIssues(
        document, sourceDocument, pageIndex, integrityManifest,
      ));
    } else {
      issues.push(`${id} retained_source_status is invalid`);
    }
  }
  if (humanDocuments !== Number(artifact?.gate_reproduction?.human_verification_documents)) {
    issues.push(`human-verification document count is ${humanDocuments}`);
  }
  issues.push(...automationDependencyIssues(documents));

  const automationReadiness = automatableActionReadiness(documents);

  return {
    valid: issues.length === 0,
    issues,
    counts: {
      documents: documents.length,
      associate_documents: associateCount,
      bachelor_documents: bachelorCount,
      exact_retained_official_byte_documents: documents.filter((document) => (
        document?.retained_source_status === 'exact_retained_official_bytes'
      )).length,
      transport_exception_documents: documents.filter((document) => (
        document?.retained_source_status === 'transparent_render_transport_exception'
      )).length,
      human_verification_documents: humanDocuments,
      figure34_remaining_action_documents: documents.filter((document) => (
        array(document?.figure34_remaining_actions).length > 0
      )).length,
      figure34_remaining_actions: documents.flatMap((document) => (
        array(document?.figure34_remaining_actions)
      )).length,
      automatable_actions_total: automationReadiness.total,
      automatable_actions_immediately_executable: automationReadiness.immediately_executable,
      automatable_actions_dependency_blocked: automationReadiness.dependency_blocked,
    },
  };
}

module.exports = {
  CLASSIFICATIONS,
  EXPECTED_DEPENDENCY_BLOCKED_AUTOMATION,
  EXPECTED_GATE_REPRODUCTION,
  VIRGINIA_TECH_CANDIDATE_ONLY_ALTERNATIVES,
  VIRGINIA_TECH_DOCUMENT_ID,
  VIRGINIA_TECH_PROTECTED_PROOF_TREE_SHA256,
  automatableActionReadiness,
  blockerReferenceInventory,
  directSummary,
  figure34FindingReferences,
  findingAffectedFigures,
  remainingActionReferences,
  recountFigure34SourceGate,
  sha256File,
  validateFigure34SourceBlockerArtifact,
  virginiaTechProtectedCoreIssues,
  virginiaTechSourcePlanIssues,
};
