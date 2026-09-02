import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CARRIER_SHA256,
  OFFICIAL_RESPONSE_RECEIPTS,
  OPEN_RULE_CARRIER_SHA256,
  OPEN_RULE_EVIDENCE_SHA256,
  SOURCE_RECEIPTS,
  evaluateVmiConstraint,
  exactVmiCarrier,
  exactVmiOpenRuleCarrier,
  vmiCarrierFingerprint,
  vmiCoverageSelection,
  vmiFigure6Selection,
  vmiOpenRuleCarrierFingerprint,
} from './virginiaMilitaryInstituteConstraintProofs';
import {
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import { assemblePathway } from './pathwayComplexity';
import { buildDegreeGroups } from '../degreeSlots';
import { courseIdFor, institutionCourseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';

const ROOT = path.resolve(__dirname, '../..');
const SLUG = 'virginia-military-institute';
const COMPOSED_PATH = path.join(ROOT, `.va-catalogs/composed/${SLUG}.json`);

function loadComposition() {
  return JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
}

function acceptedSource() {
  return cachedAcceptedSourcePlan().documents.find((document) => (
    document.institution_id === `va:uni:${SLUG}`
  ));
}

function buildFinalProjection(source = acceptedSource()) {
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9235);
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  const institutions = [college, university].map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  const supply = {
    course_id: courseIdFor('CSC299'),
    course_key: 'va:CSC299',
    code: 'CSC299',
    title: 'VMI final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: 'NO_MATCH_299' }],
  };
  return buildProjection({
    courses: [supply], degrees: [source], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9235);
}

function findRule(document) {
  const group = document.requirement_groups[3];
  return {
    group,
    constraint: group.analysis_constraints.find((row) => (
      row.kind === 'choose_six_credits_from_variable_credit_menu'
    )),
  };
}

function evaluateRule(document, { path: rulePath = 'requirement_groups[3]' } = {}) {
  const { group, constraint } = findRule(document);
  return evaluateFourYearConstraint(constraint, {
    container: group,
    document,
    path: rulePath,
  });
}

function findOpenRule(document, groupIndex) {
  const group = document.requirement_groups[groupIndex];
  return { group, constraint: group.analysis_constraints[0] };
}

function evaluateOpenRule(document, groupIndex, rulePath = `requirement_groups[${groupIndex}]`) {
  const { group, constraint } = findOpenRule(document, groupIndex);
  return evaluateFourYearConstraint(constraint, {
    container: group,
    document,
    path: rulePath,
  });
}

describe('exact Virginia Military Institute variable-credit menu proof', () => {
  it('binds the retained official responses and all seven source receipts', () => {
    const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    for (const receipt of SOURCE_RECEIPTS) {
      const suffix = receipt.id === 'major' ? 'program'
        : receipt.id === 'general_education' ? 'ge' : receipt.id;
      const file = path.join(ROOT, `.va-catalogs/pages/${SLUG}__${suffix}.txt`);
      expect(sha(file), receipt.id).toBe(receipt.sha256);
    }
    for (const [suffix, receipt] of [
      ['program.html', OFFICIAL_RESPONSE_RECEIPTS.program_html],
      ['course_catalog.html', OFFICIAL_RESPONSE_RECEIPTS.course_catalog_html],
    ]) {
      const body = fs.readFileSync(path.join(ROOT, `.va-catalogs/pages/${SLUG}__${suffix}`));
      expect(body.byteLength, suffix).toBe(receipt.bytes);
      expect(createHash('sha256').update(body).digest('hex'), suffix).toBe(receipt.sha256);
    }

    const program = fs.readFileSync(
      path.join(ROOT, `.va-catalogs/pages/${SLUG}__program.txt`), 'utf8',
    ).replace(/\s+/g, ' ');
    expect(program).toContain('Computer and Information Sciences Electives*: 6 credits');
    expect(program).toContain('CIS 303L - Computer and Information Security Laboratory Credit Hours: 1');
  });

  it('accepts exactly the composition, accepted source, and final projection carriers', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(documents.map(vmiCarrierFingerprint))).toEqual(new Set([
      CARRIER_SHA256,
    ]));
    expect(documents.map((document) => exactVmiCarrier(document))).toEqual([
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'composition' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'accepted_source' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'final_projection' }) }),
    ]);
  });

  it('binds the complete source/projection carrier used by the supplemental rules', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(documents.map(vmiOpenRuleCarrierFingerprint))).toEqual(new Set([
      OPEN_RULE_CARRIER_SHA256,
    ]));
    expect(documents.map((document) => exactVmiOpenRuleCarrier(document))).toEqual([
      expect.objectContaining({ supported: true, proof: expect.objectContaining({
        document_style: 'composition',
        supplemental_evidence_sha256: OPEN_RULE_EVIDENCE_SHA256,
      }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({
        document_style: 'accepted_source',
        supplemental_evidence_sha256: OPEN_RULE_EVIDENCE_SHA256,
      }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({
        document_style: 'final_projection',
        supplemental_evidence_sha256: OPEN_RULE_EVIDENCE_SHA256,
      }) }),
    ]);
  });

  it('supports only the exact math-floor and cross-allocation witnesses', () => {
    for (const document of [acceptedSource(), buildFinalProjection()]) {
      expect(evaluateOpenRule(document, 5)).toMatchObject({
        kind: 'approved_math_elective_level_floor',
        supported: true,
        evaluator: 'evaluateVmiConstraint',
        proof: {
          rule_path: 'requirement_groups[5]',
          selected_course_code: 'MA331X',
          selected_allocation: 'open mathematics elective',
          prerequisite_course_code: 'MA124',
          incremental_units_above_degree_total: 0,
          supplemental_evidence_sha256: OPEN_RULE_EVIDENCE_SHA256,
        },
      });
      expect(evaluateOpenRule(document, 7)).toMatchObject({
        kind: 'core_overlay_inside_free_electives',
        supported: true,
        evaluator: 'evaluateVmiConstraint',
        proof: {
          rule_path: 'requirement_groups[7]',
          selected_courses: [
            { course_code: 'MA331X', allocation: 'open mathematics elective', units: 3 },
            { course_code: 'MA330WX', allocation: 'free electives', units: 3 },
          ],
          free_elective_units_consumed: 3,
          free_elective_units_remaining: 21,
          incremental_units_above_degree_total: 0,
          literal_both_courses_inside_free_electives_claimed: false,
          supplemental_evidence_sha256: OPEN_RULE_EVIDENCE_SHA256,
        },
      });
    }
    const rules = auditFourYearDocument(acceptedSource()).active_rules;
    expect(rules.find((row) => row.kind === 'approved_math_elective_level_floor'))
      .toMatchObject({ supported: true, evaluator: 'evaluateVmiConstraint' });
    expect(rules.find((row) => row.kind === 'core_overlay_inside_free_electives'))
      .toMatchObject({ supported: true, evaluator: 'evaluateVmiConstraint' });
    expect(rules.find((row) => row.kind === 'approved_science_sequence'))
      .toMatchObject({ supported: false });
    expect(rules.find((row) => row.kind === 'conditional_residency_by_advanced_standing'))
      .toMatchObject({ supported: false });
  });

  it('fails the supplemental rules closed on prerequisite, carrier, path, and identity drift', () => {
    const cases = [
      { group: 5, mutate: (document) => {
        document.requirement_groups[0].sections[3].receivers[0].code_seen = 'MA123 + MA125';
      } },
      { group: 5, mutate: (document) => {
        document.requirement_groups[5].title = 'changed';
      } },
      { group: 5, mutate: (document) => {
        document.requirement_groups[5].sections[2].unit_advisement = 4;
      } },
      { group: 7, mutate: (document) => {
        document.requirement_groups[7].sections[0].receivers[0].receiving.units = 23;
      } },
      { group: 7, mutate: (document) => {
        document.requirement_groups[7].analysis_constraints.push(
          structuredClone(document.requirement_groups[7].analysis_constraints[0]),
        );
      } },
    ];
    for (const { group, mutate } of cases) {
      const document = structuredClone(acceptedSource());
      mutate(document);
      expect(evaluateOpenRule(document, group).supported).toBe(false);
    }
    expect(evaluateOpenRule(acceptedSource(), 5, 'requirement_groups[4]').supported)
      .toBe(false);
    const unrelated = structuredClone(acceptedSource());
    const { group, constraint } = findOpenRule(unrelated, 5);
    expect(evaluateVmiConstraint(group, {
      document: { ...unrelated, _id: 'va:degree:not-vmi:cs', institution_id: 'va:uni:not-vmi' },
      path: 'requirement_groups[5]', constraint,
    }).supported).toBe(false);
  });

  it('supersedes the six-credit rule with one exact legal roster', () => {
    for (const document of [acceptedSource(), buildFinalProjection()]) {
      expect(evaluateRule(document)).toMatchObject({
        kind: 'choose_six_credits_from_variable_credit_menu',
        supported: true,
        evaluator: 'evaluateVmiConstraint',
        proof: {
          rule_path: 'requirement_groups[3]',
          ask: 2,
          required_units: 6,
          eligible_receiver_indices: [0, 1, 3, 4, 5],
          excluded_receiver_code: 'CIS303L',
          excluded_receiver_units: 1,
          figure_6_receiver_indices: [0, 1],
        },
      });
      expect(vmiCoverageSelection(document)).toMatchObject({
        ready: true,
        section_receiver_indices: { '3:0': [0, 1, 3, 4, 5] },
        excluded_receiver_codes: ['CIS303L'],
      });
      expect(vmiFigure6Selection(document)).toMatchObject({
        ready: true,
        section_receiver_indices: { '3:0': [0, 1] },
        selected_course_codes: ['CIS211', 'CIS303'],
        selected_units: 6,
      });
    }
  });

  it('uses the exact roster in the shared coverage and Figure 6 readers', () => {
    const degree = buildFinalProjection();
    const group = degree.requirement_groups[3];
    const receivingId = (code) => institutionCourseIdFor('va:uni:9235', code);
    const legal = [receivingId('CIS211'), receivingId('CIS303')];
    const labOnly = new Set([receivingId('CIS303L')]);
    const legalOnly = new Set(legal);

    const evaluate = (articulated) => buildDegreeGroups(degree.requirement_groups, {
      articulated,
      sourceDocument: degree,
      universityCoursesById: Object.fromEntries([
        ...legal,
        receivingId('CIS303L'),
      ].map((id) => [id, { prefix: 'CIS', number: String(id), title: 'test' }])),
    }).groups.find((row) => row.label === group.title);
    // This is university-only major work, so neither route can be covered by
    // the two-year segment. The important reader change is that the displayed
    // choose-two denominator is the five-course legal roster, not all six
    // stored receivers including the one-credit lab.
    expect(evaluate(labOnly)).toMatchObject({
      total: 2,
      covered: 0,
      lines: [expect.objectContaining({ detail: 'choose 2 of 5' })],
    });
    expect(evaluate(legalOnly)).toMatchObject({
      total: 2,
      covered: 0,
      lines: [expect.objectContaining({ detail: 'choose 2 of 5' })],
    });

    const codes = ['CIS211', 'CIS303', 'CIS303L', 'CIS342', 'CIS331', 'CIS377'];
    const ucCatalog = new Map(codes.map((code) => [code, {
      id: `uc:${code}`, units: code === 'CIS303L' ? 1 : 3,
    }]));
    const ucCodeByParent = new Map(codes.map((code) => [receivingId(code), code]));
    const assembled = assemblePathway({
      degree,
      asIds: [],
      agreementByParent: new Map(),
      ucCatalog,
      ucCodeByParent,
      ccUnits: new Map(),
      normalizeCatalogCode: (value) => String(value).toUpperCase().replace(/[^A-Z0-9]/g, ''),
    });
    expect(assembled.vertices.has('uc:CIS211')).toBe(true);
    expect(assembled.vertices.has('uc:CIS303')).toBe(true);
    expect(assembled.vertices.has('uc:CIS303L')).toBe(false);
  });

  it('attaches both exact receipts to the nonblocking source-review flag', () => {
    const document = acceptedSource();
    const flag = auditFourYearAnalysisQualityFlags(document).find((row) => (
      row.code === 'variable_credit_cis_elective_menu'
    ));
    expect(flag).toMatchObject({
      blocking_analysis: false,
      resolved_by_exact_evaluator: false,
      mapped_constraint_kinds: [
        'choose_six_credits_from_variable_credit_menu',
        'variable_credit_internship',
      ],
      rule_receipts: [
        expect.objectContaining({ kind: 'choose_six_credits_from_variable_credit_menu', supported: true }),
        expect.objectContaining({ kind: 'variable_credit_internship', supported: true }),
      ],
    });
    expect(auditFourYearDocument(document).active_rules.find((row) => (
      row.kind === 'choose_six_credits_from_variable_credit_menu'
    ))).toMatchObject({ supported: true, evaluator: 'evaluateVmiConstraint' });
  });

  it('fails closed on identity, source, carrier, path, roster, unit, and id drift', () => {
    const mutations = [
      (document) => { document.catalog_year = '2024-2025'; },
      (document) => { document.total_units = 135; },
      (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
      (document) => { document.sources[0].sha256 = '0'.repeat(64); },
      (document) => { document.requirement_groups[3].title = 'changed'; },
      (document) => { document.requirement_groups[3].sections[0].section_advisement = 3; },
      (document) => { document.requirement_groups[3].sections[0].unit_advisement = 5; },
      (document) => { document.requirement_groups[3].sections[0].unit_advisement_max = 7; },
      (document) => { document.requirement_groups[3].sections[0].receivers[2].receiving.units = 3; },
      (document) => { document.requirement_groups[3].sections[0].receivers[0].code_seen = 'CIS999'; },
      (document) => { document.requirement_groups[3].sections[0].receivers[0].receiving.parent_id += 1; },
      (document) => { document.requirement_groups[3].analysis_constraints.push(
        structuredClone(document.requirement_groups[3].analysis_constraints[0]),
      ); },
    ];
    for (const mutate of mutations) {
      const document = structuredClone(acceptedSource());
      mutate(document);
      expect(evaluateRule(document).supported).toBe(false);
      expect(vmiCoverageSelection(document).ready).toBe(false);
      expect(vmiFigure6Selection(document).ready).toBe(false);
    }
    expect(evaluateRule(acceptedSource(), { path: 'requirement_groups[2]' }).supported)
      .toBe(false);

    const unrelated = structuredClone(acceptedSource());
    const { group, constraint } = findRule(unrelated);
    expect(evaluateVmiConstraint(group, {
      document: { ...unrelated, _id: 'va:degree:not-vmi:cs', institution_id: 'va:uni:not-vmi' },
      path: 'requirement_groups[3]',
      constraint,
    }).supported).toBe(false);
  });
});
