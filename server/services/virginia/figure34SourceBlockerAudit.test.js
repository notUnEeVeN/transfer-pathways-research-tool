import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { auditAssociateDocument } from '../analysis/associateFigureConstraints';
import {
  VIRGINIA_TECH_CANDIDATE_ONLY_ALTERNATIVES,
  VIRGINIA_TECH_DOCUMENT_ID,
  blockerReferenceInventory,
  recountFigure34SourceGate,
  validateFigure34SourceBlockerArtifact,
} from './figure34SourceBlockerAudit';

const SERVER = path.resolve(__dirname, '../..');
const PAGES = path.join(SERVER, '.va-catalogs/pages');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const artifact = readJson(path.join(
  SERVER, '.va-catalogs/research/va-figure34-source-blocker-audit.json',
));
const pageIndex = readJson(path.join(PAGES, 'index.json'));
const integrityManifest = readJson(path.join(
  SERVER, '.va-catalogs/research/primary-source-integrity-manifest.json',
));

function rowFromDocument(document) {
  const constraints = [];
  const quality = [];
  const sourceFlags = [];
  const catalogFailures = [];
  for (const ref of document.operational_refs) {
    if (ref.startsWith('constraint:')) {
      const body = ref.slice('constraint:'.length);
      const split = body.lastIndexOf(':');
      constraints.push({ path: body.slice(0, split), kind: body.slice(split + 1) });
    } else if (ref.startsWith('quality:')) {
      quality.push({ code: ref.slice('quality:'.length) });
    } else if (ref.startsWith('source_flag:')) {
      sourceFlags.push({ code: ref.slice('source_flag:'.length) });
    } else if (ref.startsWith('catalog:')) {
      catalogFailures.push(ref.slice('catalog:'.length));
    }
  }
  return {
    id: document.id,
    kind: document.kind,
    ready: false,
    blockers: [...document.operational_blockers],
    catalog_failures: catalogFailures,
    figure_constraint_blockers: constraints,
    unresolved_analysis_quality_flags: quality,
    blocking_source_research_flags: sourceFlags,
  };
}

function gateReport() {
  const blocked = artifact.documents.map(rowFromDocument);
  const ready = Array.from({ length: artifact.gate_reproduction.ready_rows }, (_, index) => ({
    id: `va:ready:${String(index).padStart(2, '0')}`,
    kind: index < 10 ? 'as_degree' : 'degree',
    ready: true,
    blockers: [],
  }));
  const rows = [...blocked, ...ready];
  const gate = (figure) => ({
    figure,
    sources: structuredClone(rows),
    projected_sources: structuredClone(rows),
    source_summary: { total: 35, ready: 21, blocked: 14 },
    projected_source_summary: { total: 35, ready: 21, blocked: 14 },
  });
  const virginiaTech = artifact.documents.find((document) => (
    document.id === VIRGINIA_TECH_DOCUMENT_ID
  ));
  return {
    publication_by_figure: { 3: gate('3'), 4: gate('4') },
    source_plan: {
      raw_verified_core_conflicts: [VIRGINIA_TECH_DOCUMENT_ID],
      verified_core_conflicts: [VIRGINIA_TECH_DOCUMENT_ID],
      conflict_receipts: [{
        id: VIRGINIA_TECH_DOCUMENT_ID,
        ...structuredClone(
          virginiaTech.protected_tree_reconciliation.publication_verification_receipt,
        ),
      }],
    },
  };
}

describe('Virginia Figure 3/4 source-blocker audit', () => {
  it('binds all 14 classifications to the checked-in source bundles and retained bytes', () => {
    const result = validateFigure34SourceBlockerArtifact(artifact, {
      sourceDocuments: cachedAcceptedSourcePlan().documents,
      pageIndex,
      integrityManifest,
      pagesDir: PAGES,
    });
    expect(result).toEqual({
      valid: true,
      issues: [],
      counts: {
        documents: 14,
        associate_documents: 9,
        bachelor_documents: 5,
        exact_retained_official_byte_documents: 13,
        transport_exception_documents: 1,
        human_verification_documents: 5,
        figure34_remaining_action_documents: 5,
        figure34_remaining_actions: 13,
        automatable_actions_total: 2,
        automatable_actions_immediately_executable: 0,
        automatable_actions_dependency_blocked: 2,
      },
    });
  });

  it('independently recounts 21/35 and covers every exact detailed blocker once', () => {
    const report = gateReport();
    const result = recountFigure34SourceGate(report, artifact);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.figures['3']).toMatchObject({
      source: { total: 35, ready: 21, blocked: 14 },
      projected: { total: 35, ready: 21, blocked: 14 },
      source_projected_id_parity: true,
      source_projected_blocked_parity: true,
    });
    expect(result.figures['4'].blocked_document_ids)
      .toEqual(result.figures['3'].blocked_document_ids);
    expect(result.classification_counts).toEqual({
      a_existing_evidence_automation: 2,
      b_new_official_source_capture: 12,
      c_human_institutional_verification: 16,
    });
    expect(result.figure34_remaining_action_counts).toEqual({
      a_existing_evidence_automation: 2,
      b_new_official_source_capture: 3,
      c_human_institutional_verification: 8,
    });
    expect(result.figure34_automatable_action_readiness).toEqual({
      total: 2,
      immediately_executable: 0,
      dependency_blocked: 2,
      actions: [
        {
          id: 'va:degree:randolph-macon-college:cs',
          key: 'rmc_integrate_collegiate_overlap_evaluator',
          depends_on: ['rmc_complete_current_collegiate_roster'],
          dependency_classifications: ['b_new_official_source_capture'],
          immediately_executable: false,
        },
        {
          id: 'va:degree:randolph-macon-college:cs',
          key: 'rmc_integrate_transfer_residency_allocator',
          depends_on: ['rmc_obtain_program_transfer_application_decisions'],
          dependency_classifications: ['c_human_institutional_verification'],
          immediately_executable: false,
        },
      ],
    });
    expect(artifact.documents.flatMap((document) => document.operational_refs)).toHaveLength(68);
  });

  it('separates gate refs from the exact remaining Figure 3/4 actions', () => {
    const byId = new Map(artifact.documents.map((document) => [document.id, document]));
    const bridgewater = byId.get('va:degree:bridgewater-college:cs');
    const shenandoah = byId.get('va:degree:shenandoah-university:cs');
    const rmc = byId.get('va:degree:randolph-macon-college:cs');
    const uvaWise = byId.get(
      'va:degree:the-university-of-virginia-s-college-at-wise:cs',
    );

    expect(bridgewater.findings.find((finding) => (
      finding.key === 'bridgewater_cl200_exception_conflict'
    )).affected_figures).toEqual(['6']);
    expect(bridgewater.figure34_remaining_actions).toEqual([
      expect.objectContaining({
        key: 'bridgewater_figure34_exact_hash_signature',
        classification: 'c_human_institutional_verification',
        refs: ['human:current_human_verification_required'],
      }),
    ]);
    expect(shenandoah.figure34_remaining_actions).toEqual([
      expect.objectContaining({
        key: 'shenandoah_figure34_exact_hash_signature',
        classification: 'c_human_institutional_verification',
        refs: ['human:current_human_verification_required'],
      }),
    ]);

    expect(Object.fromEntries(rmc.findings.map((finding) => [
      finding.key, finding.classification,
    ]))).toMatchObject({
      rmc_collegiate_attribute_roster_capture: 'b_new_official_source_capture',
      rmc_collegiate_overlap_evaluator: 'a_existing_evidence_automation',
      rmc_proficiency_and_project_application: 'c_human_institutional_verification',
      rmc_capacity_and_residency: 'a_existing_evidence_automation',
    });
    expect(rmc.figure34_remaining_actions.map((action) => action.key)).toEqual([
      'rmc_complete_current_collegiate_roster',
      'rmc_integrate_collegiate_overlap_evaluator',
      'rmc_obtain_proficiency_and_project_decisions',
      'rmc_integrate_transfer_residency_allocator',
      'rmc_resolve_pe_wording_conflict',
      'rmc_obtain_program_transfer_application_decisions',
      'rmc_figure34_exact_hash_signature',
    ]);

    const labRef = 'constraint:requirement_groups[2].analysis_constraints[0]:'
      + 'two_distinct_lab_sciences_from_approved_disciplines';
    expect(uvaWise.figure34_remaining_actions.filter((action) => (
      action.refs.includes(labRef)
    )).map((action) => action.classification)).toEqual([
      'b_new_official_source_capture',
      'c_human_institutional_verification',
    ]);
    expect(uvaWise.figure34_remaining_actions.map((action) => action.key)).toContain(
      'uva_wise_capture_inclusive_excellence_roster',
    );
  });

  it('keeps Virginia Tech blocked on an exact five-receiver protected-core reconciliation', () => {
    const virginiaTech = artifact.documents.find((document) => (
      document.id === VIRGINIA_TECH_DOCUMENT_ID
    ));
    expect(virginiaTech.protected_tree_reconciliation).toMatchObject({
      protected_proof_tree_sha256:
        '14bc69c7b2e40a83e875f41ef0a3d8cb980348e25e6b643ad1f3571d88ba6c67',
      candidate_proof_tree_sha256:
        '7914e1e4ebff823fdc00d3e345f8db2c604109c7a15739960a7122ea5fb49376',
      raw_candidate_signature_status: 'unsigned',
      raw_candidate_import_blocked: true,
      automatic_overlay_allowed: false,
      required_closure: 'independent_protected_core_reconciliation_and_current_signature',
      candidate_only_official_alternatives:
        VIRGINIA_TECH_CANDIDATE_ONLY_ALTERNATIVES,
      publication_verification_receipt: {
        category: 'verified_protected_core_change',
        unresolved: true,
        protected_core_diff_count: 5,
      },
    });
    expect(virginiaTech.findings).toEqual([
      expect.objectContaining({
        key: 'virginia_tech_protected_core_reconciliation',
        classification: 'c_human_institutional_verification',
        refs: virginiaTech.operational_refs,
      }),
    ]);
    expect(virginiaTech.figure34_remaining_actions).toEqual([
      expect.objectContaining({
        key: 'virginia_tech_independent_protected_core_reconciliation_and_signature',
        classification: 'c_human_institutional_verification',
        refs: virginiaTech.operational_refs,
        action: expect.stringContaining('Do not auto-overlay'),
      }),
    ]);

    const changedReceipt = structuredClone(artifact);
    changedReceipt.documents.find((document) => (
      document.id === VIRGINIA_TECH_DOCUMENT_ID
    )).protected_tree_reconciliation.automatic_overlay_allowed = true;
    expect(validateFigure34SourceBlockerArtifact(changedReceipt, {
      sourceDocuments: cachedAcceptedSourcePlan().documents,
      pageIndex,
      integrityManifest,
      pagesDir: PAGES,
    }).issues).toContain(
      `${VIRGINIA_TECH_DOCUMENT_ID} protected-tree reconciliation receipt changed`,
    );

    const changedLiveConflict = gateReport();
    changedLiveConflict.source_plan.conflict_receipts[0].raw_candidate_import_blocked = false;
    expect(recountFigure34SourceGate(changedLiveConflict, artifact).issues).toContain(
      `${VIRGINIA_TECH_DOCUMENT_ID} live protected-core conflict receipt changed`,
    );
  });

  it('fails closed on Figure-specific scope, action dependency, or ref drift', () => {
    const validate = (candidate) => validateFigure34SourceBlockerArtifact(candidate, {
      sourceDocuments: cachedAcceptedSourcePlan().documents,
      pageIndex,
      integrityManifest,
      pagesDir: PAGES,
    });

    const scopeDrift = structuredClone(artifact);
    const bridgewater = scopeDrift.documents.find((document) => (
      document.id === 'va:degree:bridgewater-college:cs'
    ));
    delete bridgewater.findings.find((finding) => (
      finding.key === 'bridgewater_cl200_exception_conflict'
    )).affected_figures;
    expect(validate(scopeDrift).issues).toContain(
      'va:degree:bridgewater-college:cs Figure 3/4 actions do not cover the exact figure-specific blocker refs',
    );

    const dependencyDrift = structuredClone(artifact);
    const uvaWise = dependencyDrift.documents.find((document) => (
      document.id === 'va:degree:the-university-of-virginia-s-college-at-wise:cs'
    ));
    uvaWise.figure34_remaining_actions = uvaWise.figure34_remaining_actions.filter((action) => (
      action.key !== 'uva_wise_capture_closed_major_lab_roster'
    ));
    expect(validate(dependencyDrift).issues).toContain(
      'va:degree:the-university-of-virginia-s-college-at-wise:cs Figure 3/4 action '
        + 'uva_wise_certify_sender_lab_application has missing dependency '
        + 'uva_wise_capture_closed_major_lab_roster',
    );

    const unsafeAutomation = structuredClone(artifact);
    delete unsafeAutomation.documents.find((document) => (
      document.id === 'va:degree:randolph-macon-college:cs'
    )).figure34_remaining_actions.find((action) => (
      action.key === 'rmc_integrate_collegiate_overlap_evaluator'
    )).depends_on;
    expect(validate(unsafeAutomation).issues).toContain(
      'Figure 3/4 automatable-action dependency receipt changed',
    );

    const refDrift = structuredClone(artifact);
    const bridgewaterAction = refDrift.documents.find((document) => (
      document.id === 'va:degree:bridgewater-college:cs'
    )).figure34_remaining_actions[0];
    bridgewaterAction.refs.push('source_flag:full_stack_cl200_corequisite_policy_gap');
    expect(validate(refDrift).issues).toContain(
      'va:degree:bridgewater-college:cs Figure 3/4 action '
        + 'bridgewater_figure34_exact_hash_signature cites non-Figure-3/4 ref '
        + 'source_flag:full_stack_cl200_corequisite_policy_gap',
    );
  });

  it('fails a lying summary, id substitution, projection mismatch, or unclassified blocker', () => {
    const summary = gateReport();
    summary.publication_by_figure['3'].source_summary.ready = 23;
    expect(recountFigure34SourceGate(summary, artifact).issues)
      .toContain('figure 3 source summary ready is 23, recounted 21');

    const substituted = gateReport();
    substituted.publication_by_figure['3'].sources[0].id = 'va:as:substituted:cs';
    expect(recountFigure34SourceGate(substituted, artifact).valid).toBe(false);

    const projection = gateReport();
    projection.publication_by_figure['4'].projected_sources[0].ready = true;
    expect(recountFigure34SourceGate(projection, artifact).issues)
      .toContain(`figure 4 source/projected readiness differs for ${artifact.documents[0].id}`);

    const blocker = gateReport();
    blocker.publication_by_figure['3'].sources[0].figure_constraint_blockers.push({
      path: 'requirement_groups[99].analysis_constraints[0]',
      kind: 'invented_unclassified_rule',
    });
    expect(recountFigure34SourceGate(blocker, artifact).issues)
      .toContain(`${artifact.documents[0].id} detailed blocker inventory changed`);
  });

  it('separates safe Figure 3/4 aggregate proofs from unintegrated destination/identity claims', () => {
    const documents = cachedAcceptedSourcePlan().documents;
    const jsr = documents.find((document) => (
      document._id === 'va:as:j-sargeant-reynolds-community-college:cs'
    ));
    const camp = documents.find((document) => (
      document._id === 'va:as:paul-d-camp-community-college:cs'
    ));
    const richardBland = documents.find((document) => (
      document._id === 'va:as:richard-bland-college:cs'
    ));

    for (const document of [jsr, camp]) {
      const blockers = auditAssociateDocument(document).active_blockers
        .filter((row) => row.affected_figures.includes('3'));
      expect(blockers.map((row) => row.kind)).not.toContain('distinct_areas');
      expect(document.acceptance.catalog.ok).toBe(true);
      expect(document.acceptance.ready_for_analysis).toBe(false);
    }
    expect(richardBland.acceptance.catalog).toMatchObject({
      ok: true,
      failed: [],
    });
    expect(richardBland.data_quality_flags.find((flag) => (
      flag.code === 'non_vccs_course_namespace'
    ))).toMatchObject({ severity: 'resolved' });
    expect(richardBland.acceptance.ready_for_analysis).toBe(false);

    const findings = new Map(artifact.documents.flatMap((document) => (
      document.findings.map((finding) => [finding.key, finding])
    )));
    expect(findings.get('jsr_destination_variants')).toMatchObject({
      classification: 'b_new_official_source_capture',
    });
    expect(findings.get('richard_bland_owner_scoped_identity')).toMatchObject({
      classification: 'c_human_institutional_verification',
    });
    expect(findings.get('richard_bland_owner_scoped_identity').basis)
      .toContain('93 globally scoped ids and 93 globally scoped keys');
    const jsrArtifact = artifact.documents.find((document) => document.id === jsr._id);
    const campArtifact = artifact.documents.find((document) => document.id === camp._id);
    const rappArtifact = artifact.documents.find((document) => (
      document.id === 'va:as:rappahannock-community-college:cs'
    ));
    expect(jsrArtifact.operational_refs).not.toContain(
      'constraint:requirement_groups[5].distinct_areas:distinct_areas',
    );
    expect(campArtifact.operational_refs).not.toContain(
      'constraint:requirement_groups[6].distinct_areas:distinct_areas',
    );
    expect(rappArtifact.operational_refs).not.toContain(
      'constraint:requirement_groups[12].analysis_constraints[0]:variable_credit_category_with_course_combinations',
    );
  });

  it('extracts the same exact reference vocabulary used by the artifact', () => {
    for (const document of artifact.documents) {
      expect(blockerReferenceInventory(rowFromDocument(document)))
        .toEqual([...document.operational_refs].sort((left, right) => left.localeCompare(right)));
    }
  });
});
