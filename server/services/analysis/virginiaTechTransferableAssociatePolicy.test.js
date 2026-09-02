import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/virginia-tech-transferable-associate-policy-evidence.json';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import { courseIdFor } from '../virginia/courseIdentity';
import {
  auditVirginiaSourceEquivalencyConditions,
} from './virginiaTransferEquivalencyConditions';
import {
  EDGES,
  resolveVirginiaTechTransferableAsPassportNote,
} from './virginiaTechTransferableAssociatePolicy';

function exactProjection() {
  const documents = cachedAcceptedSourcePlan().documents;
  const degree = documents.find((document) => (
    document._id === 'va:degree:virginia-polytechnic-institute-and-state-university:cs'
  ));
  const associate = documents.find((document) => (
    document._id === 'va:as:mountain-gateway-community-college:cs'
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9230);
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9310);
  const edge = EDGES[0];
  const course = {
    course_id: courseIdFor(edge.sending_code),
    course_key: `va:${edge.sending_code}`,
    code: edge.sending_code,
    credits: 4,
    source_url: edge.sending_source_url,
    offered_by: [college.name],
    articulates_to: [{
      institution: university.name,
      identifier: edge.receiving_identifier,
      name: edge.receiving_name,
      notes: `With Passport or UCGS, applies to General Education, Pathway ${edge.pathway}.`,
    }],
  };
  const projection = buildProjection({
    courses: [course],
    degrees: [degree],
    asDegrees: [associate],
    institutions: [college, university].map((row) => ({
      _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
      level: row.level,
      name: row.name,
    })),
  });
  const agreement = projection.agreements.find((row) => (
    row.uc_school_id === 9230 && row.community_college_id === 9310
  ));
  const selected = agreement.selected_equivalencies.find((row) => (
    row.sending_code === edge.sending_code
  ));
  return {
    agreement,
    row: selected,
    bachelorDocument: projection.degrees[0],
    associateDocument: projection.asDegrees[0],
  };
}

function resolve(input = exactProjection(), overrides = {}) {
  return resolveVirginiaTechTransferableAsPassportNote({
    ...input,
    figureModel: 'complete_degree_path',
    ...overrides,
  });
}

describe('Virginia Tech completed-transferable-AS policy resolver', () => {
  it('resolves only the exact selected annotation without claiming Passport/UCGS', () => {
    const result = resolve();
    expect(result).toMatchObject({
      applicable: true,
      ready: true,
      classification: {
        kind: 'passport_ucgs_annotation_resolved_by_completed_transferable_as',
        blocking: false,
        resolution: {
          rule: 'exact_virginia_tech_completed_transferable_as_pathways_policy_v1',
          figure_model: 'complete_degree_path',
          pathway: '4',
          passport_or_ucgs_earned_assumed: false,
          resolution_basis: 'independently_qualifying_completed_as',
          major_specific_course_requirements_waived: false,
          associate_identity: {
            community_college_id: 9310,
            college_name: 'Mountain Gateway Community College',
            award: 'AS',
          },
        },
      },
    });
  });

  it('moves the exact note to advisory only when the audit receives the associate document', () => {
    const input = exactProjection();
    const context = {
      degreeCourseSet: new Set([courseIdFor('PHY241')]),
      bachelorDocument: input.bachelorDocument,
      associateDocument: input.associateDocument,
      unitsById: new Map([[courseIdFor('PHY241'), 4]]),
      figureModel: 'complete_degree_path',
      requireVirginiaChannels: true,
    };
    expect(auditVirginiaSourceEquivalencyConditions([input.agreement], context))
      .toMatchObject({
        ready: true,
        blocking_conditions: [],
        advisory_conditions: [{
          condition_kind: 'passport_ucgs_annotation_resolved_by_completed_transferable_as',
          resolution: { pathway: '4' },
        }],
      });
    expect(auditVirginiaSourceEquivalencyConditions([input.agreement], {
      ...context,
      associateDocument: null,
    })).toMatchObject({
      ready: false,
      blocking_conditions: [{
        condition_kind: 'alternative_receiving_award',
      }],
      advisory_conditions: [],
    });
  });

  it.each([
    ['award type', (input) => { input.associateDocument.source_degree_type = 'AAS'; }],
    ['college owner id', (input) => { input.associateDocument.community_college_id = 9301; }],
    ['college owner name', (input) => { input.associateDocument.college_name = 'Other College'; }],
    ['source bundle', (input) => { input.associateDocument.provenance.source_bundle_hash = '0'.repeat(64); }],
    ['note punctuation', (input) => { input.row.source_receiving_notes = input.row.source_receiving_notes.slice(0, -1); }],
    ['Pathway number', (input) => { input.row.source_receiving_notes = input.row.source_receiving_notes.replace('Pathway 4', 'Pathway 3'); }],
    ['selected path', (input) => { input.row.requirement_group_index = 7; }],
    ['receiving course', (input) => { input.row.source_receiving_identifier = 'PHYS2306'; }],
    ['VT proof tree', (input) => { input.bachelorDocument.total_units = 124; }],
  ])('fails closed on a %s mutation', (_label, mutate) => {
    const input = exactProjection();
    mutate(input);
    const result = resolve(input);
    expect(result.ready).toBe(false);
  });

  it('fails closed on figure model and policy text/hash mutations', () => {
    expect(resolve(exactProjection(), { figureModel: 'course_only' }))
      .toMatchObject({ applicable: true, ready: false });
    for (const mutate of [
      (copy) => { copy.source.response_sha256 = '0'.repeat(64); },
      (copy) => {
        copy.policy_facts.completed_transferable_associate
          .pathways_general_education_satisfied = false;
      },
      (copy) => { copy.paper_interpretation.passport_or_ucgs_earned_assumed = true; },
    ]) {
      const copy = structuredClone(evidence);
      mutate(copy);
      expect(resolve(exactProjection(), { evidence: copy }))
        .toMatchObject({ applicable: true, ready: false });
    }
  });
});
