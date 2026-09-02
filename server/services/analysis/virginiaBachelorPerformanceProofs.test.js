import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  POLICY_RECEIPTS,
  proveVirginiaBachelorPerformancePolicy,
} from './virginiaBachelorPerformanceProofs';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { getMajor } from '../../config/majors';
import {
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
} from './fourYearConstraints';
import { readinessForSource } from '../virginia/publicationReadiness';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const ROOT = path.resolve(__dirname, '../..');
const loadComposition = (slug) => JSON.parse(fs.readFileSync(
  path.join(ROOT, `.va-catalogs/composed/${slug}.json`), 'utf8',
));

const plan = cachedAcceptedSourcePlan();
const acceptedSource = (slug) => plan.documents.find((document) => (
  document._id === `va:degree:${slug}:cs`
));

let projected;
function projectedDegrees() {
  if (projected) return projected;
  const degrees = plan.documents.filter((document) => (
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
    title: 'grade-policy projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: universities.map((row) => ({
      institution: row.name,
      identifier: 'NO_MATCH_299',
    })),
  };
  projected = buildProjection({
    courses: [supply], degrees, asDegrees: [], institutions,
  }).degrees;
  return projected;
}

function finalProjection(receipt) {
  return projectedDegrees().find((document) => document.school_id === receipt.school_id);
}

function findRule(document, kind, expectedPath = null) {
  for (const [groupIndex, group] of (document.requirement_groups || []).entries()) {
    const constraint = (group.analysis_constraints || []).find((entry) => entry.kind === kind);
    if (constraint && (!expectedPath || expectedPath === `requirement_groups[${groupIndex}]`)) {
      return { constraint, group, groupIndex, path: `requirement_groups[${groupIndex}]` };
    }
  }
  return null;
}

function prove(document, receipt, overrides = {}) {
  const found = findRule(document, receipt.kind, receipt.path);
  return proveVirginiaBachelorPerformancePolicy(
    overrides.constraint || found.constraint,
    {
      container: overrides.container || found.group,
      document,
      path: overrides.path || found.path,
    },
  );
}

function sourceText(slug, suffix) {
  return fs.readFileSync(
    path.join(ROOT, `.va-catalogs/pages/${slug}__${suffix}.txt`), 'utf8',
  ).replace(/\s+/g, ' ');
}

describe('Virginia bachelor student-performance paper-impact proofs', () => {
  it('binds exactly five zero-impact performance carriers through source and projection', () => {
    expect(POLICY_RECEIPTS.map(({ id }) => id)).toEqual([
      'longwood_major_course_grade',
      'vcu_major_course_grade',
      'virginia_tech_program_grades_and_gpas',
      'virginia_state_english_composition_grade',
      'virginia_state_major_subject_grade',
    ]);
    for (const receipt of POLICY_RECEIPTS) {
      for (const document of [
        loadComposition(receipt.slug),
        acceptedSource(receipt.slug),
        finalProjection(receipt),
      ]) {
        expect(prove(document, receipt), receipt.id).toMatchObject({
          proven: true,
          paper_impact_proven: true,
          affected_figures: [],
          proof: {
            policy_receipt_id: receipt.id,
            rule_path: receipt.path,
            source_id: `va:degree:${receipt.slug}:cs`,
            proof_tree_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            policy_capacity_units: 0,
            policy_course_receiver_count: 0,
            policy_requirement_receiver_count:
              receipt.carrier === 'attached_fixed_course_selection' ? 0 : receipt.section_count,
            host_course_capacity_units:
              receipt.carrier === 'attached_fixed_course_selection' ? 6 : 0,
            host_course_receiver_count:
              receipt.carrier === 'attached_fixed_course_selection' ? 4 : 0,
            paper_inputs: ['authored_course_identity', 'authored_credit_capacity'],
            excluded_student_inputs: ['transcript_grade', 'cumulative_gpa', 'major_gpa'],
            conditioned_pathway_model: 'hypothetical_grade_eligible_successful_pathway',
            discretionary_transfer_credit_application_resolved: false,
            complete_degree_policy_preserved: true,
          },
        });
      }
    }
  });

  it('ties each safe classification to explicit graduation/performance source language', () => {
    expect(sourceText('longwood-university', 'program')).toContain(
      'Computer Science Majors must earn a C− or better in any CMSC course for it to count towards the major.',
    );
    expect(sourceText('virginia-commonwealth-university', 'program')).toContain(
      'Students must receive a minimum grade of C in all computer science courses in order to graduate.',
    );
    const tech = sourceText(
      'virginia-polytechnic-institute-and-state-university', 'program',
    );
    expect(tech).toContain('Graduation Requirements To qualify for a B.S. degree in CS');
    expect(tech).toContain('Earn a minimum overall GPA of 2.00 and a minimum in-major GPA of 2.00');
    expect(sourceText('virginia-state-university', 'ge')).toContain(
      'The minimum grade required for successful completion of English 110/112 and English 111/113 (Composition I and II) is “C.”',
    );
    expect(sourceText('virginia-state-university', 'college')).toContain(
      "Students must earn at least a 'C' in all CSCI, MATH, and STAT courses",
    );
  });

  it('does not whitelist transfer-credit, timing, discretion, residence, or selection rules', () => {
    const vcu = acceptedSource('virginia-commonwealth-university');
    for (const kind of [
      'focused_inquiry_grade_and_postmatriculation_transfer_rule',
      'gpa_and_residency',
    ]) {
      const found = findRule(vcu, kind);
      expect(proveVirginiaBachelorPerformancePolicy(found.constraint, {
        container: found.group, document: vcu, path: found.path,
      }), kind).toBeNull();
    }

    const randolphMacon = acceptedSource('randolph-macon-college');
    const transfer = findRule(randolphMacon, 'transfer_grade_and_application_review');
    expect(proveVirginiaBachelorPerformancePolicy(transfer.constraint, {
      container: transfer.group, document: randolphMacon, path: transfer.path,
    })).toBeNull();

    const vcuGe = sourceText('virginia-commonwealth-university', 'ge');
    expect(vcuGe).toContain(
      'Transfer credits are not accepted for the two UNIV courses after a student is enrolled at the university.',
    );
    const vsuPolicy = sourceText('virginia-state-university', 'policy');
    expect(vsuPolicy).toContain(
      'Virginia State University accepts only transfer courses from other accredited colleges and universities in which the student earns a "C" or better.',
    );
    expect(vsuPolicy).toContain(
      "the application of transfer coursework to a student's program of study are made at the discretion of the student's academic program",
    );
    expect(POLICY_RECEIPTS.some((receipt) => (
      receipt.kind === 'transfer_grade_and_application_review'
    ))).toBe(false);
    const randolphPolicy = sourceText('randolph-macon-college', 'policy');
    expect(randolphPolicy).toContain(
      'Courses may be accepted in transfer if they are completed with a grade of C- or higher',
    );
    expect(randolphPolicy).toContain('The Registrar may request additional documentation');
  });

  it('fails closed on source, identity, tree, attachment, and carrier mutations', () => {
    for (const receipt of POLICY_RECEIPTS) {
      const mutations = [
        (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
        (document) => { document.catalog_year = 'changed'; },
        (document) => { document.requirement_groups[Number(receipt.path.match(/\d+/)[0])].tier = 'transferable'; },
        (document) => { document.requirement_groups[Number(receipt.path.match(/\d+/)[0])].source_refs = ['major']; },
        (document) => { document.requirement_groups[Number(receipt.path.match(/\d+/)[0])].sections[0].unit_advisement = 1; },
        (document) => {
          const group = document.requirement_groups[Number(receipt.path.match(/\d+/)[0])];
          group.sections[0].receivers[0].receiving.kind =
            receipt.carrier === 'attached_fixed_course_selection' ? 'requirement' : 'course';
        },
        (document) => {
          const group = document.requirement_groups[Number(receipt.path.match(/\d+/)[0])];
          group.analysis_constraints.push(structuredClone(group.analysis_constraints[0]));
        },
      ];
      for (const mutate of mutations) {
        const document = structuredClone(acceptedSource(receipt.slug));
        mutate(document);
        expect(prove(document, receipt)?.proven, receipt.id).toBe(false);
      }

      const source = acceptedSource(receipt.slug);
      const found = findRule(source, receipt.kind, receipt.path);
      expect(prove(source, receipt, {
        path: receipt.path === 'requirement_groups[0]'
          ? 'requirement_groups[1]' : 'requirement_groups[0]',
      })?.proven, `${receipt.id}:path`).toBe(false);
      expect(prove(source, receipt, {
        constraint: structuredClone(found.constraint),
      })?.proven, `${receipt.id}:detached`).toBe(false);

      const projection = structuredClone(finalProjection(receipt));
      delete projection.analysis_contract;
      expect(prove(projection, receipt)?.proven, `${receipt.id}:contract`).toBe(false);
    }
  });

  it('does not turn a kind label on another document into a proof', () => {
    const document = structuredClone(acceptedSource('randolph-macon-college'));
    const group = document.requirement_groups[0];
    const constraint = {
      kind: 'minimum_course_grade',
      status: 'evaluator_not_implemented',
      description: 'invented label',
    };
    group.analysis_constraints = [...(group.analysis_constraints || []), constraint];
    expect(proveVirginiaBachelorPerformancePolicy(constraint, {
      container: group,
      document,
      path: 'requirement_groups[0]',
    })).toBeNull();
  });

  it('dispatches only the exact performance receipts and inventories every residual Figure 3/4 grade rule', () => {
    const exact = POLICY_RECEIPTS.map((receipt) => {
      const document = acceptedSource(receipt.slug);
      const row = auditFourYearDocument(document).active_rules.find((entry) => (
        entry.kind === receipt.kind && entry.path.startsWith(`${receipt.path}.`)
      ));
      expect(row, receipt.id).toMatchObject({
        supported: false,
        evaluator: 'proveVirginiaBachelorPerformancePolicy',
        paper_impact_proven: true,
        affected_figures: [],
        remediation: {
          category: 'out_of_scope_administrative_rule',
          reason: expect.stringMatching(/exact source-bound proof/),
        },
        proof: {
          policy_receipt_id: receipt.id,
          complete_degree_policy_preserved: true,
        },
      });
      const published = readinessForSource(document)
        .four_year_constraint_audit.active_blockers.find((entry) => (
          entry.kind === receipt.kind && entry.path.startsWith(`${receipt.path}.`)
        ));
      expect(published, `${receipt.id}:publication receipt`).toMatchObject({
        paper_impact_proven: true,
        affected_figures: [],
        remediation: { category: 'out_of_scope_administrative_rule' },
      });
      return `${receipt.slug}|${row.path}|${row.kind}`;
    });
    expect(exact).toEqual([
      'longwood-university|requirement_groups[17].analysis_constraints[0]|minimum_course_grade',
      'virginia-commonwealth-university|requirement_groups[10].analysis_constraints[0]|minimum_course_grade',
      'virginia-polytechnic-institute-and-state-university|requirement_groups[19].analysis_constraints[0]|minimum_course_grades_and_gpas',
      'virginia-state-university|requirement_groups[0].analysis_constraints[0]|minimum_course_grade',
      'virginia-state-university|requirement_groups[14].analysis_constraints[0]|minimum_course_grade_by_subject',
    ]);

    const documents = plan.documents.filter((document) => (
      document.kind === 'degree'
      && document.status === 'extracted'
    ));
    expect(documents).toHaveLength(18);
    const gradeKinds = new Set([
      'focused_inquiry_grade_and_postmatriculation_transfer_rule',
      'gpa_and_residency',
      'minimum_course_grade',
      'minimum_course_grade_by_subject',
      'minimum_course_grades_and_gpas',
      'required_non_elective_cs_minimum_grade',
      'transfer_grade_and_application_review',
    ]);
    const rows = documents.flatMap((document) => {
      const audit = auditFourYearDocument(document);
      return [...audit.active_rules, ...audit.unit_audit.filter((row) => row.blocking)]
        .filter((row) => gradeKinds.has(row.kind) && row.supported !== true)
        .map((row) => ({
          slug: document._id.replace(/^va:degree:/, '').replace(/:cs$/, ''),
          row,
        }));
    });
    expect(rows.filter(({ row }) => row.paper_impact_proven === true)
      .map(({ slug, row }) => `${slug}|${row.path}|${row.kind}`).sort())
      .toEqual([
        'longwood-university|requirement_groups[17].analysis_constraints[0]|minimum_course_grade',
        'old-dominion-university|unit_audit.required_non_elective_cs_minimum_grade|required_non_elective_cs_minimum_grade',
        'virginia-commonwealth-university|requirement_groups[10].analysis_constraints[0]|minimum_course_grade',
        'virginia-polytechnic-institute-and-state-university|requirement_groups[19].analysis_constraints[0]|minimum_course_grades_and_gpas',
        'virginia-state-university|requirement_groups[0].analysis_constraints[0]|minimum_course_grade',
        'virginia-state-university|requirement_groups[14].analysis_constraints[0]|minimum_course_grade_by_subject',
      ]);
    expect(rows.filter(({ row }) => row.affected_figures.includes('3'))
      .map(({ slug, row }) => `${slug}|${row.path}|${row.kind}`).sort())
      .toEqual([
        'randolph-macon-college|requirement_groups[9].analysis_constraints[1]|transfer_grade_and_application_review',
      ]);

    const state = acceptedSource('virginia-state-university');
    expect(auditFourYearAnalysisQualityFlags(state)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'data_quality_flags[3]',
        code: 'major_subject_course_grade_requirement',
        affected_figures: [],
        resolved_by_exact_evaluator: true,
      }),
    ]));
  });

  it('makes a source-tree mutation fall back to a real Figure 3/4 blocker at runtime', () => {
    for (const receipt of POLICY_RECEIPTS) {
      const document = structuredClone(acceptedSource(receipt.slug));
      const index = Number(receipt.path.match(/\d+/)[0]);
      document.requirement_groups[index].source_refs = ['major'];
      const row = auditFourYearDocument(document).active_rules.find((entry) => (
        entry.kind === receipt.kind && entry.path.startsWith(`${receipt.path}.`)
      ));
      expect(row, receipt.id).toMatchObject({
        supported: false,
        evaluator: 'proveVirginiaBachelorPerformancePolicy',
        paper_impact_proven: false,
        affected_figures: ['3', '4'],
        remediation: { category: 'evaluator_engineering' },
      });
    }
  });
});
