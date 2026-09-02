import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_PDF_SHA256,
  OFFICIAL_TEXT_SHA256,
  cnuFigureSelection,
  cnuProofTreeFingerprint,
  evaluateCnuResidencyPolicy,
  exactCnuTree,
} from './christopherNewportConstraintProofs';
import {
  affectedFiguresForConstraint,
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import { evaluateVirginiaResidencyTransferPolicy } from './virginiaResidencyTransferCaps';
import { assemblePathway } from './pathwayComplexity';
import { buildDegreeGroups } from '../degreeSlots';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { getMajor } from '../../config/majors';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const ROOT = path.resolve(__dirname, '../..');
const COMPOSED_PATH = path.join(
  ROOT, '.va-catalogs/composed/christopher-newport-university.json',
);
const PDF_PATH = path.join(
  ROOT, '.va-catalogs/pages/christopher-newport-university__program.pdf',
);
const TEXT_PATH = path.join(
  ROOT, '.va-catalogs/pages/christopher-newport-university__program.txt',
);
const loadComposition = () => JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
const acceptedSource = () => cachedAcceptedSourcePlan().evaluatedDocuments.find((doc) => (
  doc.institution_id === 'va:uni:christopher-newport-university'
));

function buildFinalProjection() {
  const sourcePlan = cachedAcceptedSourcePlan();
  const degrees = sourcePlan.documents.filter((document) => (
    document.kind === 'degree' && document.status === 'extracted'
  ));
  const configuredIds = Object.keys(getMajor('va-cs').programs).map(Number);
  const universities = VA_INSTITUTION_REGISTRY.filter((row) => (
    row.level === 'four_year' && configuredIds.includes(row.id)
  ));
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  const institutions = [college, ...universities].map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  const supply = {
    course_id: courseIdFor('CSC299'),
    course_key: 'va:CSC299',
    code: 'CSC299',
    title: 'CNU final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: universities.map((row) => ({
      institution: row.name,
      identifier: 'NO_MATCH_299',
    })),
  };
  return buildProjection({
    courses: [supply], degrees, asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9206);
}

function findRule(doc, kind) {
  for (const [groupIndex, group] of (doc.requirement_groups || []).entries()) {
    const constraint = (group.analysis_constraints || []).find((entry) => entry.kind === kind);
    if (constraint) return { group, groupIndex, constraint };
  }
  return null;
}

function blockers(audit, figure) {
  return [
    ...audit.active_rules.filter((row) => (
      !row.supported && row.affected_figures.includes(figure)
    )),
    ...audit.unit_audit.filter((row) => (
      row.blocking && row.affected_figures.includes(figure)
    )),
  ].map((row) => `${row.path}|${row.kind}`).sort();
}

function campusCatalog(doc) {
  const ucCatalog = new Map();
  const ucCodeByParent = new Map();
  for (const group of doc.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        const body = receiver.receiving || {};
        const codes = String(receiver.code_seen || body.code || '')
          .split(/\s*\+\s*/).filter(Boolean);
        const ids = body.kind === 'series' ? body.parent_ids || [] : [body.parent_id];
        ids.forEach((id, index) => {
          if (!Number.isInteger(Number(id)) || !codes[index]) return;
          ucCodeByParent.set(Number(id), codes[index]);
          ucCatalog.set(codes[index], {
            id: `uc:cnu:${codes[index]}`,
            units: Number(body.units) / ids.length,
          });
        });
      }
    }
  }
  return { ucCatalog, ucCodeByParent };
}

describe('exact Christopher Newport paper-figure proofs', () => {
  it('binds the evaluator to the retained official PDF/text and exact catalog statements', () => {
    const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    expect(sha(PDF_PATH)).toBe(OFFICIAL_PDF_SHA256);
    expect(sha(TEXT_PATH)).toBe(OFFICIAL_TEXT_SHA256);
    const source = fs.readFileSync(TEXT_PATH, 'utf8').replace(/\s+/g, ' ');
    expect(source).toContain('with courses numbered 495 and above used no more');
    expect(source).toContain('Only one three credit hour course in the discipline of the major');
    expect(source).toContain('No more than eight hours across the Areas of Inquiry');
    expect(source).toContain('Completion of two 300- or 400-level courses that are designed as writing intensive');
    expect(source).toContain('CPSC 495. Special Topics (Credits vary 1-3)');
    expect(source).toContain('PCSE 495. Special Topics (Credits vary 1-3)');
  });

  it('retains one exact proof fingerprint through composition, accepted source, and final projection', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    const fingerprints = documents.map(cnuProofTreeFingerprint);
    expect(new Set(fingerprints)).toEqual(new Set([
      '03f04015838dcc99d55bb9edb5150cc2756e5eb66ef1c819145c4767a6e83b67',
    ]));
    expect(documents.map((doc) => exactCnuTree(doc))).toEqual([
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'composition' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'accepted_source' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'final_projection' }) }),
    ]);
  });

  it('enforces the closed advanced-selection cap with an exact source-valid receiver set', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      const found = findRule(doc, 'special_topics_and_500_level_limit');
      const row = evaluateFourYearConstraint(found.constraint, {
        container: found.group,
        document: doc,
        path: `requirement_groups[${found.groupIndex}]`,
      });
      expect(row).toMatchObject({
        supported: true,
        evaluator: 'evaluateCnuConstraint',
        proof: {
          selected_receiver_indices: [0, 1, 2],
          selected_codes: ['CPSC425', 'CPSC440', 'CPSC470'],
          restricted_selected_count: 0,
          restricted_selected_maximum: 2,
        },
      });
      expect(cnuFigureSelection(doc)).toMatchObject({
        ready: true,
        section_receiver_indices: { '1:0': [0, 1, 2] },
      });
    }
  });

  it('uses that selection in the Figure 1 reader and Figure 6 pathway assembler', () => {
    const source = acceptedSource();
    const degreeGroups = buildDegreeGroups(source.requirement_groups, {
      sourceDocument: source,
      articulated: new Set(),
    });
    expect(degreeGroups.groups.find((group) => group.label === 'Advanced major selection'))
      .toMatchObject({ total: 3, covered: 0 });

    const { ucCatalog, ucCodeByParent } = campusCatalog(source);
    const pathway = assemblePathway({
      degree: source,
      asIds: [],
      agreementByParent: new Map(),
      ucCatalog,
      ucCodeByParent,
      ccUnits: new Map(),
    });
    const keys = new Set(pathway.vertices.keys());
    for (const code of ['CPSC425', 'CPSC440', 'CPSC470']) {
      expect(keys.has(`uc:cnu:${code}`), code).toBe(true);
    }
    for (const code of ['CPSC495', 'PCSE495']) {
      expect(keys.has(`uc:cnu:${code}`), code).toBe(false);
    }
  });

  it('keeps the open AOI and WI course-attribute menus blocked only where identities matter', () => {
    const source = acceptedSource();
    for (const kind of [
      'area_of_inquiry_discipline_limits',
      'writing_intensive_attribute_within_capacity',
    ]) {
      const found = findRule(source, kind);
      expect(affectedFiguresForConstraint(found.constraint, {
        container: found.group,
        document: source,
        path: `requirement_groups[${found.groupIndex}]`,
      })).toEqual(['6']);
      expect(evaluateFourYearConstraint(found.constraint, {
        container: found.group,
        document: source,
        path: `requirement_groups[${found.groupIndex}]`,
      })).toMatchObject({
        supported: false,
        evaluator: null,
        affected_figures: ['6'],
        remediation: { category: 'targeted_source_research' },
      });
    }

    const drift = structuredClone(source);
    drift.requirement_groups[4].sections[0].unit_advisement = 4;
    const found = findRule(drift, 'area_of_inquiry_discipline_limits');
    expect(affectedFiguresForConstraint(found.constraint, {
      container: found.group,
      document: drift,
      path: `requirement_groups[${found.groupIndex}]`,
    })).toEqual(['1', '3', '4', '6']);
  });

  it('fails closed on identity, receipt, source-ref, roster, accounting, and declaration drift', () => {
    const source = acceptedSource();
    const mutations = [
      (doc) => { doc.school_id = '9206'; },
      (doc) => { doc.provenance.source_bundle_hash = '0'.repeat(64); },
      (doc) => { doc.sources[0].sha256 = '0'.repeat(64); },
      (doc) => { doc.requirement_groups[1].source_refs = ['major']; },
      (doc) => { doc.requirement_groups[1].sections[0].receivers[0].receiving.parent_id += 1; },
      (doc) => { doc.requirement_groups[1].sections[0].receivers[0].code_seen = 'CPSC495'; },
      (doc) => { doc.requirement_groups[4].sections[3].unit_advisement = 8; },
      (doc) => { doc.unit_audit.remaining_elective_units = 18; },
      (doc) => { doc.data_quality_flags[1].severity = 'warn'; },
      (doc) => { doc.requirement_groups[1].analysis_constraints.push(
        structuredClone(doc.requirement_groups[1].analysis_constraints[1]),
      ); },
    ];
    for (const mutate of mutations) {
      const doc = structuredClone(source);
      mutate(doc);
      expect(exactCnuTree(doc).supported).toBe(false);
      expect(cnuFigureSelection(doc).ready).toBe(false);
    }
  });

  it('enforces the exact CNU residency ceiling without reclassifying verified core courses', () => {
    const source = acceptedSource();
    expect(evaluateCnuResidencyPolicy(source)).toMatchObject({
      supported: true,
      overall_transfer_cap_units: 75,
      final_window_transfer_cap_units: 90,
      effective_two_year_transfer_cap_units: 75,
      proof: {
        final_credit_window_units: 36,
        final_credit_window_residency_units_minimum: 30,
        final_major_residency_units_minimum: 12,
        fixed_nontransferable_upper_major_units: 29,
      },
    });
    expect(evaluateVirginiaResidencyTransferPolicy(source)).toMatchObject({
      supported: true,
      evaluator: 'evaluateCnuResidencyPolicy',
      effective_two_year_transfer_cap_units: 75,
    });

    const drift = structuredClone(source);
    drift.unit_audit.residency.minimum_units = 44;
    expect(evaluateCnuResidencyPolicy(drift)).toBeNull();
    expect(evaluateVirginiaResidencyTransferPolicy(drift)).toMatchObject({ supported: false });
  });

  it('resolves only the implemented quality flag and keeps source/final blocker parity', () => {
    const source = acceptedSource();
    const projection = buildFinalProjection();
    const flags = auditFourYearAnalysisQualityFlags(source);
    expect(flags).toEqual([
      expect.objectContaining({
        code: 'advanced_selection_variable_topic_credit',
        resolved_by_exact_evaluator: true,
        mapped_constraint_kinds: ['variable_topics_credit_must_close_selection'],
      }),
      expect.objectContaining({
        code: 'liberal_learning_distribution_constraints',
        resolved_by_exact_evaluator: false,
        affected_figures: ['6'],
        mapped_constraint_kinds: [
          'area_of_inquiry_discipline_limits',
          'writing_intensive_attribute_within_capacity',
        ],
      }),
    ]);
    const sourceAudit = auditFourYearDocument(source);
    const projectedAudit = auditFourYearDocument(projection);
    expect(sourceAudit.summary).toMatchObject({
      supported_active_rules: 2,
      blocked_unit_audit_rules: 2,
      blocked_rules_by_figure: { '1': 0, '3': 0, '4': 0, '6': 2 },
      ready_by_figure: { '1': true, '3': true, '4': true, '6': false },
    });
    for (const figure of ['1', '3', '4', '6']) {
      expect(blockers(projectedAudit, figure), `Figure ${figure}`)
        .toEqual(blockers(sourceAudit, figure));
    }
  });
});
