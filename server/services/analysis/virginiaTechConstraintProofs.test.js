import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_ONLY_ALTERNATIVES,
  FIGURE_34_RESOLVER_ANCHORS,
  PATHWAYS_CAPACITY_EVIDENCE_SHA256,
  PROOF_TREE_SHA256,
  PROTECTED_PROOF_TREE_SHA256,
  SOURCE_RECEIPTS,
  conceptFourProof,
  evaluateVirginiaTechConstraint,
  evaluateVirginiaTechResidencyPolicy,
  exactVirginiaTechFigure34Tree,
  exactVirginiaTechTree,
  figureOneNaturalScienceSelection,
  fixedCampusMenuWitness,
  pathwaysFigure34CapacityProof,
  standardMathAndPathwaysSelection,
  supplementalPathwaysCapacityEvidence,
  virginiaTechProofTreeFingerprint,
  virginiaTechQualityFlagAffectedFigures,
  virginiaTechRequirementRole,
  virginiaTechSectionTier,
  virginiaTechSourceSpecificAffectedFigures,
} from './virginiaTechConstraintProofs';
import {
  affectedFiguresForConstraint,
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import { assemblePathway } from './pathwayComplexity';
import { canonicalRequirementRole } from './canonicalRequirementRole';
import { buildDegreeGroups, resolveSectionTier } from '../degreeSlots';
import { evaluateVirginiaResidencyTransferPolicy } from './virginiaResidencyTransferCaps';
import { _evaluateTemplate } from './transferCreditRate';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import {
  ROBOTS_SOURCES,
  robotsAllows,
} from '../../scripts/va/captureVirginiaTechPathwaysCapacity';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const ROOT = path.resolve(__dirname, '../..');
const SLUG = 'virginia-polytechnic-institute-and-state-university';
const COMPOSED_PATH = path.join(ROOT, `.va-catalogs/composed/${SLUG}.json`);
const PATHWAYS_EVIDENCE_PATH = path.join(
  ROOT, '.va-catalogs/research/virginia-tech-pathways-capacity-evidence.json',
);
const PREREQUISITE_REVIEW_PATH = path.join(
  ROOT, '.va-catalogs/research/va-university-prerequisite-review.json',
);
const sourcePath = (suffix) => path.join(ROOT, `.va-catalogs/pages/${SLUG}__${suffix}.txt`);
const loadComposition = () => JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
const sourcePlan = () => cachedAcceptedSourcePlan();
const acceptedSource = () => sourcePlan().evaluatedDocuments.find((doc) => (
  doc.institution_id === `va:uni:${SLUG}`
));

function buildFinalProjection() {
  const plan = sourcePlan();
  const degree = plan.documents.find((document) => (
    document.institution_id === `va:uni:${SLUG}`
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9230);
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
    title: 'Virginia Tech final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: 'NO_MATCH_299' }],
  };
  return buildProjection({
    courses: [supply], degrees: [degree], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9230);
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

describe('exact Virginia Tech paper-figure proofs', () => {
  it('binds all six official receipts and the exact source statements', () => {
    const suffixes = {
      major: 'program', general_education: 'ge', college: 'college',
      graduation: 'graduation', policy: 'policy', course_catalog: 'course_catalog',
    };
    const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    for (const receipt of SOURCE_RECEIPTS) {
      expect(sha(sourcePath(suffixes[receipt.id])), receipt.id).toBe(receipt.sha256);
    }
    const program = fs.readFileSync(sourcePath('program'), 'utf8').replace(/\s+/g, ' ');
    const graduation = fs.readFileSync(sourcePath('graduation'), 'utf8').replace(/\s+/g, ' ');
    const policy = fs.readFileSync(sourcePath('policy'), 'utf8').replace(/\s+/g, ' ');
    const catalog = fs.readFileSync(sourcePath('course_catalog'), 'utf8');
    expect(program).toContain('Pathways Concept 4 - Reasoning in the Natural Sciences Natural Science Elective4 Natural Science Elective4');
    expect(program).toContain('MATH 2405H may be substituted for MATH 2114');
    expect(program).toContain('MATH 2405H (5 cr) + MATH 2406H (5 cr)');
    expect(program).toContain('College-level credits used to meet this requirement do not count towards the degree');
    expect(program).toContain('B.S. in CS students must complete 30 credits of non-technical courses');
    expect(program).toContain('all departments in the College of Engineering, except for engineering courses satisfying Pathways 7');
    expect(graduation).toContain('minimum of 25% of their degree requirements at Virginia Tech');
    expect(graduation).toContain('No more than 50% of a student’s graduation requirements');
    expect(policy).toContain('Of the last 45 semester hours before graduation, a maximum of 18 semester hours may be transfer hours');
    expect(catalog).not.toMatch(/\bENGE\s*2724\b/);
    expect(catalog).not.toMatch(/\bENGE\s*4724\b/);
  });

  it('binds a current official course-level witness for the 30-credit nontechnical overlay', () => {
    const evidence = JSON.parse(fs.readFileSync(PATHWAYS_EVIDENCE_PATH, 'utf8'));
    expect(supplementalPathwaysCapacityEvidence(evidence)).toMatchObject({
      supported: true,
      evidence_sha256: PATHWAYS_CAPACITY_EVIDENCE_SHA256,
      robots_receipts: [
        {
          id: 'pathways_host_robots',
          exact_path_decisions: [{ source_id: 'pathways_guide_2026_27', allowed: true }],
        },
        {
          id: 'catalog_host_robots',
          exact_path_decisions: [
            { source_id: 'visual_arts_course_descriptions', allowed: true },
            { source_id: 'psychology_course_descriptions', allowed: true },
            { source_id: 'sociology_course_descriptions', allowed: true },
          ],
        },
      ],
      witness_codes: [
        'ENGL1105', 'ENGL1106', 'ART1104', 'ART1334', 'PSYC1004',
        'SOC1004', 'ART1004', 'COMM2004', 'ENGL3764', 'ART1204',
      ],
      arithmetic: { total_nontechnical_units: 30, additional_degree_units: 0 },
    });
    for (const source of evidence.sources) {
      const cached = path.join(ROOT, `.va-catalogs/pages/virginia-tech__${source.id}.pdf`);
      expect(fs.existsSync(cached), source.id).toBe(true);
      expect(createHash('sha256').update(fs.readFileSync(cached)).digest('hex'), source.id)
        .toBe(source.sha256);
    }
    const drift = structuredClone(evidence);
    drift.witness.pathways_concept_2[0].units = 4;
    expect(supplementalPathwaysCapacityEvidence(drift)).toMatchObject({ supported: false });
    const disallowed = structuredClone(evidence);
    disallowed.robots_receipts[1].exact_path_decisions[0].allowed = false;
    expect(supplementalPathwaysCapacityEvidence(disallowed))
      .toMatchObject({ supported: false });
  });

  it('evaluates the exact supplemental source paths under robots precedence', () => {
    expect(ROBOTS_SOURCES.map((source) => source.id)).toEqual([
      'pathways_host_robots', 'catalog_host_robots',
    ]);
    const policy = [
      'User-agent: *',
      'Disallow: /course-descriptions/',
      'Allow: /course-descriptions/art/art.pdf$',
    ].join('\n');
    expect(robotsAllows(policy, '/course-descriptions/art/art.pdf')).toBe(true);
    expect(robotsAllows(policy, '/course-descriptions/psyc/psyc.pdf')).toBe(false);
    expect(robotsAllows([
      'User-agent: *',
      'Disallow: /',
      '',
      'User-agent: pmt-research-import',
      'Allow: /course-descriptions/',
    ].join('\n'), '/course-descriptions/soc/soc.pdf')).toBe(true);
  });

  it('retains one complete proof through composition, source, and final projection', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(documents.map(virginiaTechProofTreeFingerprint))).toEqual(new Set([
      PROOF_TREE_SHA256,
    ]));
    expect(documents.map((doc) => exactVirginiaTechTree(doc))).toEqual([
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'composition' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'accepted_source' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'final_projection' }) }),
    ]);
  });

  it('proves the exact ordinary math, Pathways 1a, and once-counted Concept 4 routes', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(conceptFourProof(doc)).toMatchObject({
        supported: true,
        carrier_path: 'requirement_groups[6].sections[0]',
        carrier_units: 8,
        policy_receipt_units: 0,
        gross_pathways_units: 47,
        net_pathways_units: 39,
      });
      const found = findRule(doc, 'pathways_concept_4_natural_science_overlap');
      expect(evaluateVirginiaTechConstraint(found.group, {
        constraint: found.constraint,
        container: found.group,
        document: doc,
        path: `requirement_groups[${found.groupIndex}]`,
      })).toMatchObject({
        supported: true,
        evaluator: 'evaluateVirginiaTechConstraint',
      });
    }
    const source = acceptedSource();
    for (const doc of [loadComposition(), source, buildFinalProjection()]) {
      for (const kind of [
        'honors_math_substitution_and_free_credit_adjustment',
        'pathways_1a_inside_existing_capacity',
      ]) {
        const found = findRule(doc, kind);
        expect(evaluateVirginiaTechConstraint(found.group, {
          constraint: found.constraint,
          container: found.group,
          document: doc,
          path: `requirement_groups[${found.groupIndex}]`,
        }), `${kind}:${doc.provenance?.document_style || doc.id}`).toMatchObject({
          supported: true,
          evaluator: 'evaluateVirginiaTechConstraint',
        });
      }
    }
    for (const kind of [
      'no_double_count_across_cs_elective_groups',
      'conditional_5000_level_undergraduate_eligibility',
      'approved_experience_and_plan',
      'eligible_course_exclusions_and_distinctness',
      'department_approval_and_no_double_count',
      'pathways_no_degree_core_overlap',
      'nontechnical_course_distribution',
      'minimum_course_grades_and_gpas',
      'foreign_language_proficiency',
    ]) {
      const found = findRule(source, kind);
      expect(evaluateVirginiaTechConstraint(found.group, {
        constraint: found.constraint,
        container: found.group,
        document: source,
        path: `requirement_groups[${found.groupIndex}]`,
      }), kind).toMatchObject({ supported: false });
    }
  });

  it('preserves articulation alternatives outside Figure 6 while proving fixed capacities', () => {
    const source = acceptedSource();
    expect(standardMathAndPathwaysSelection(source)).toMatchObject({
      ready: true,
      figure6: false,
      section_receiver_indices: {
        '0:5': [0, 1],
        '0:6': [0, 1],
        '6:0': [0, 2],
        '1:2': [0],
        '1:3': [1],
        '1:4': [0],
        '4:0': [2, 6],
        '5:0': [2],
      },
      eligible_math_route_codes: ['MATH2114', 'MATH2405H', 'MATH2204', 'CMDA2005'],
      math_route: 'ordinary_or_standalone_2405h',
      honors_math_2406_enabled: false,
      pathways_1a_codes: [],
      figure_1_natural_science_codes: ['BIOL1105', 'BIOL1115', 'PHYS2305'],
      figure_1_natural_science_course_observations: 3,
      figure_1_campus_menu_codes: [
        'CS4104', 'BIT4614', 'CS4094', 'CMDA3654', 'MATH3414', 'AOE4434',
      ],
    });
    const honorsFirstParent = source.requirement_groups[0].sections[5]
      .receivers[1].receiving.parent_id;
    const honorsSecondParent = source.requirement_groups[0].sections[6]
      .receivers[2].receiving.parent_id;
    const ordinaryFirstParent = source.requirement_groups[0].sections[5]
      .receivers[0].receiving.parent_id;
    expect(standardMathAndPathwaysSelection(source, {
      articulated: new Set([honorsFirstParent]),
    })).toMatchObject({
      ready: true,
      section_receiver_indices: {
        '0:5': [0, 1],
        '0:6': [0, 1],
      },
      eligible_math_route_codes: [
        'MATH2114', 'MATH2405H', 'MATH2204', 'CMDA2005',
      ],
      math_route: 'ordinary_or_standalone_2405h',
      honors_math_2406_enabled: false,
    });
    expect(standardMathAndPathwaysSelection(source, {
      articulated: new Set([ordinaryFirstParent, honorsSecondParent]),
    })).toMatchObject({
      section_receiver_indices: {
        '0:5': [0, 1],
        '0:6': [0, 1],
      },
      math_route: 'ordinary_or_standalone_2405h',
      honors_math_2406_enabled: false,
    });
    for (const articulated of [
      [honorsSecondParent],
      [honorsFirstParent, honorsSecondParent],
    ]) {
      expect(standardMathAndPathwaysSelection(source, {
        articulated: new Set(articulated),
      })).toMatchObject({
        ready: true,
        section_receiver_indices: {
          '0:5': [1],
          '0:6': [2],
        },
        eligible_math_route_codes: ['MATH2405H', 'MATH2406H'],
        math_route: 'honors_pair',
        honors_math_2406_enabled: true,
      });
    }
    expect(standardMathAndPathwaysSelection(source, { figure6: true })).toMatchObject({
      ready: true,
      figure6: true,
      section_receiver_indices: {
        '0:5': [0],
        '0:6': [0],
        '8:0': [0],
        '9:0': [0],
      },
      pathways_1a_codes: ['COMM2004', 'ENGL3764'],
    });
    expect(pathwaysFigure34CapacityProof(source)).toMatchObject({
      supported: true,
      proof: {
        total_nontechnical_witness_units: 30,
        minimum_free_elective_capacity_units: 4,
        supplemental_evidence_sha256: PATHWAYS_CAPACITY_EVIDENCE_SHA256,
        fixed_pathways_degree_core_overlap_codes: [],
      },
    });
  });

  it('optimizes the exact Figure 1 science route without clamping two series to three courses', () => {
    const projection = buildFinalProjection();
    const science = projection.requirement_groups[6].sections[0];
    const parentIds = (index) => {
      const receiving = science.receivers[index].receiving;
      return receiving.kind === 'series' ? receiving.parent_ids : [receiving.parent_id];
    };
    const route = (indices) => figureOneNaturalScienceSelection(projection, {
      articulated: new Set(indices.flatMap(parentIds)),
    });

    expect(route([])).toMatchObject({
      receiver_indices: [0, 2], total_course_observations: 3,
      covered_course_observations: 0,
    });
    expect(route([0])).toMatchObject({
      receiver_indices: [0, 2], total_course_observations: 3,
      covered_course_observations: 2,
    });
    expect(route([1])).toMatchObject({
      receiver_indices: [1, 2], total_course_observations: 3,
      covered_course_observations: 2,
    });
    expect(route([2])).toMatchObject({
      receiver_indices: [0, 2], total_course_observations: 3,
      covered_course_observations: 1,
    });
    expect(route([0, 1])).toMatchObject({
      receiver_indices: [0, 1], total_course_observations: 4,
      covered_course_observations: 4,
    });
    expect(route([0, 2])).toMatchObject({
      receiver_indices: [0, 2], total_course_observations: 3,
      covered_course_observations: 3,
    });
    expect(route([0, 1, 2])).toMatchObject({
      receiver_indices: [0, 2], total_course_observations: 3,
      covered_course_observations: 3,
    });

    const partialSeries = new Set([parentIds(0)[0], ...parentIds(2)]);
    expect(figureOneNaturalScienceSelection(projection, {
      articulated: partialSeries,
    })).toMatchObject({
      receiver_indices: [0, 2], total_course_observations: 3,
      covered_course_observations: 1,
    });

    const twoSeries = new Set([...parentIds(0), ...parentIds(1)]);
    expect(buildDegreeGroups(projection.requirement_groups, {
      sourceDocument: projection, articulated: twoSeries,
    }).named_requirements.courses).toEqual({ total: 27, covered: 4 });
    expect(buildDegreeGroups(projection.requirement_groups, {
      sourceDocument: projection,
      articulated: new Set([...parentIds(0), ...parentIds(2)]),
    }).named_requirements.courses).toEqual({ total: 26, covered: 3 });
  });

  it('narrows only rules whose fixed capacity makes particular figures invariant', () => {
    const source = acceptedSource();
    expect(fixedCampusMenuWitness(source)).toEqual({
      supported: true,
      constrained_campus_units: 18,
      figure_1_supported: true,
      figure_6_supported: false,
      figure_6_blocker:
        'selected campus-menu identities lack complete official prerequisite evidence',
      selected_codes: [
        'CS4104', 'BIT4614', 'CS4094', 'CMDA3654', 'MATH3414', 'AOE4434',
      ],
      section_receiver_indices: {
        '1:2': [0], '1:3': [1], '1:4': [0], '4:0': [2, 6], '5:0': [2],
      },
    });
    const expected = {
      no_double_count_across_cs_elective_groups: ['6'],
      conditional_5000_level_undergraduate_eligibility: ['6'],
      approved_experience_and_plan: ['6'],
      eligible_course_exclusions_and_distinctness: ['6'],
      department_approval_and_no_double_count: ['6'],
      pathways_no_degree_core_overlap: ['6'],
      nontechnical_course_distribution: ['6'],
      foreign_language_proficiency: ['6'],
    };
    for (const [kind, figures] of Object.entries(expected)) {
      const found = findRule(source, kind);
      expect(virginiaTechSourceSpecificAffectedFigures(found.constraint, {
        constraint: found.constraint,
        container: found.group,
        document: source,
        path: `requirement_groups[${found.groupIndex}]`,
      }), kind).toEqual(figures);
    }
    for (const kind of [
      'honors_math_substitution_and_free_credit_adjustment',
      'pathways_1a_inside_existing_capacity',
    ]) {
      const found = findRule(source, kind);
      expect(virginiaTechSourceSpecificAffectedFigures(found.constraint, {
        constraint: found.constraint,
        container: found.group,
        document: source,
        path: `requirement_groups[${found.groupIndex}]`,
      }), kind).toBeNull();
    }

    const drift = structuredClone(source);
    drift.requirement_groups[4].tier = 'breadth';
    const open = findRule(drift, 'eligible_course_exclusions_and_distinctness');
    expect(virginiaTechSourceSpecificAffectedFigures(open.constraint, {
      constraint: open.constraint,
      container: open.group,
      document: drift,
      path: `requirement_groups[${open.groupIndex}]`,
    })).toBeNull();
    expect(fixedCampusMenuWitness(drift).supported).toBe(false);
  });

  it('keeps Figure 6 closed while required named-menu layers mix resolved and unresolved prerequisite evidence', () => {
    const source = acceptedSource();
    const review = JSON.parse(fs.readFileSync(PREREQUISITE_REVIEW_PATH, 'utf8'));
    const rows = new Map(review.review_rows.filter((row) => row.school_id === 9230)
      .map((row) => [row.code, row]));
    const codes = (receiver) => String(receiver.code_seen || '')
      .split(/\s*\+\s*|\s+and\s+/i).map((code) => code.replace(/[^A-Z0-9]/gi, ''))
      .filter(Boolean);
    const menus = [
      [1, 3], // required 4/5XXX elective
      [4, 0], // required two-course 3/4/5XXX menu
      [5, 0], // required technical elective
    ];
    const resolvedStatuses = new Set(['parsed', 'none']);
    const unresolvedStatuses = new Set(['missing', 'unparsed']);
    for (const [groupIndex, sectionIndex] of menus) {
      const section = source.requirement_groups[groupIndex].sections[sectionIndex];
      const named = section.receivers.flatMap(codes);
      const statuses = named.map((code) => rows.get(code)?.status);
      expect(named.length, `${groupIndex}:${sectionIndex}`).toBeGreaterThan(0);
      expect(statuses.every((status) => resolvedStatuses.has(status) || unresolvedStatuses.has(status)),
        `${groupIndex}:${sectionIndex}`).toBe(true);
      expect(statuses.some((status) => resolvedStatuses.has(status)),
        `${groupIndex}:${sectionIndex}`).toBe(true);
      expect(statuses.some((status) => unresolvedStatuses.has(status)),
        `${groupIndex}:${sectionIndex}`).toBe(true);
      expect(section.receivers.some((receiver) => receiver.receiving.kind === 'requirement'),
        `${groupIndex}:${sectionIndex}`).toBe(true);
    }
    expect(review.publication_ready).toBe(false);
    expect(review.publication_blocker).toBe('recursive_prerequisite_closure_incomplete');
  });

  it('keeps open source gaps blocked on every figure they can change', () => {
    const source = acceptedSource();
    expect(source.data_quality_flags.map((flag) => ({
      code: flag.code,
      figures: virginiaTechQualityFlagAffectedFigures(flag, source),
    }))).toEqual([
      { code: 'cross_group_elective_distinctness', figures: ['6'] },
      { code: 'pathways_attribute_and_overlap_evaluator_required', figures: ['6'] },
      { code: 'variable_credit_and_conditional_5000_level_options', figures: ['6'] },
      { code: 'catalog_noninteractive_capture_challenge', figures: null },
      { code: 'program_listed_codes_absent_from_course_catalog', figures: ['6'] },
    ]);
  });

  it('classifies only exact zero-unit Bridge and suspended-Concept-7 capacity roles', () => {
    for (const doc of [acceptedSource(), buildFinalProjection()]) {
      const bridge = doc.requirement_groups[2];
      for (const [sectionIndex, section] of bridge.sections.entries()) {
        expect(virginiaTechRequirementRole(doc, bridge, section)).toMatchObject({
          applies: true,
          exact: true,
          role: 'zero_unit_requirement',
          evidence: { path: `requirement_groups[2].sections[${sectionIndex}]` },
        });
      }
      const capacity = doc.requirement_groups[16];
      expect(virginiaTechRequirementRole(doc, capacity, capacity.sections[0])).toMatchObject({
        applies: true,
        exact: true,
        role: 'elective_capacity',
        evidence: { exact_capacity_units: 3 },
      });
    }
    const drift = structuredClone(buildFinalProjection());
    drift.requirement_groups[16].sections[0].unit_advisement = 4;
    expect(virginiaTechRequirementRole(
      drift, drift.requirement_groups[16], drift.requirement_groups[16].sections[0],
    )).toBeNull();
  });

  it('honors the exact lower-division CS 2104 choice inside its upper-default group', () => {
    for (const doc of [acceptedSource(), buildFinalProjection()]) {
      const group = doc.requirement_groups[1];
      const section = group.sections[0];
      expect(virginiaTechSectionTier(doc, group, section)).toEqual({
        tier: 'transferable',
        source_bound_evaluator: 'virginiaTechSectionTier',
        proof_tree_sha256: PROOF_TREE_SHA256,
        path: 'requirement_groups[1].sections[0]',
        receiver_codes: ['CS2104', 'CS2144', 'CS4144'],
      });
      expect(virginiaTechSectionTier(doc, group, group.sections[1])).toBeNull();
    }

    const drift = structuredClone(buildFinalProjection());
    drift.requirement_groups[1].sections[0].cc_articulable = false;
    expect(virginiaTechSectionTier(
      drift, drift.requirement_groups[1], drift.requirement_groups[1].sections[0],
    )).toBeNull();
  });

  it('uses the lower-division override in both Figure 1 and Figure 3/4 readers', () => {
    const projection = buildFinalProjection();
    const parentId = projection.requirement_groups[1].sections[0]
      .receivers[0].receiving.parent_id;
    const sendingId = courseIdFor('CSC210');
    const coverage = buildDegreeGroups(projection.requirement_groups, {
      sourceDocument: projection,
      articulated: new Set([parentId]),
    });
    expect(coverage.groups[1]).toMatchObject({ covered: 1 });
    expect(coverage.named_requirements.courses.covered).toBe(1);

    const agreements = [{
      requirement_groups: [{
        sections: [{
          receivers: [{
            articulation_status: 'articulated',
            receiving: { kind: 'course', parent_id: parentId },
            options: [{ course_ids: [sendingId] }],
          }],
        }],
      }],
    }];
    const state = _evaluateTemplate(
      projection,
      agreements,
      new Set([sendingId]),
      new Map([[sendingId, 3]]),
      'semester',
      'semester',
      true,
    );
    expect(state).toMatchObject({
      directAppliedUnits: 3,
      lowerDirectAppliedUnits: 3,
      requirementRoleIssues: [],
    });
    expect([...state.directIds]).toEqual([sendingId]);
  });

  it('preserves the standalone honors substitution and enforces the honors-pair correlation', () => {
    const projection = buildFinalProjection();
    const parentId = (group, section, receiver) => (
      projection.requirement_groups[group].sections[section]
        .receivers[receiver].receiving.parent_id
    );
    const groupResult = (articulated, label) => buildDegreeGroups(
      projection.requirement_groups,
      { sourceDocument: projection, articulated: new Set(articulated) },
    ).groups.find((group) => group.label === label);
    const groupCoverage = (articulated, label) => groupResult(articulated, label).covered;

    expect(groupCoverage([
      parentId(0, 5, 1),
    ], 'Degree Core Requirements')).toBe(1);
    expect(groupCoverage([
      parentId(0, 6, 2),
    ], 'Degree Core Requirements')).toBe(1);
    expect(groupCoverage([
      parentId(0, 5, 1), parentId(0, 6, 2),
    ], 'Degree Core Requirements')).toBe(2);
    expect(groupCoverage([
      parentId(0, 5, 0), parentId(0, 6, 1),
    ], 'Degree Core Requirements')).toBe(2);
    expect(groupCoverage([
      parentId(8, 0, 1),
    ], 'Communications Elective')).toBe(1);
    expect(groupResult([
      parentId(9, 0, 1),
    ], 'Professional Writing Elective')).toMatchObject({
      total: 1,
      covered: 0,
      lines: [expect.objectContaining({ detail: 'choose 1 of 7' })],
    });

    const codes = [
      'MATH2114', 'MATH2204', 'CMDA2005', 'MATH2405H', 'MATH2406H',
      'COMM2004', 'COMM2014', 'ENGL3764', 'ENGL3804',
    ];
    const codeToParent = new Map();
    for (const group of projection.requirement_groups) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          if (codes.includes(receiver.code_seen)) {
            codeToParent.set(receiver.code_seen, receiver.receiving.parent_id);
          }
        }
      }
    }
    const assembled = assemblePathway({
      degree: projection,
      asIds: [],
      agreementByParent: new Map(),
      ucCatalog: new Map(codes.map((code) => [code, { id: `uc:${code}`, units: 3 }])),
      ucCodeByParent: new Map([...codeToParent].map(([code, id]) => [id, code])),
      ccUnits: new Map(),
    });
    for (const code of ['MATH2114', 'MATH2204', 'COMM2004', 'ENGL3764']) {
      expect(assembled.vertices.has(`uc:${code}`), code).toBe(true);
    }
    for (const code of ['CMDA2005', 'MATH2405H', 'MATH2406H', 'COMM2014', 'ENGL3804']) {
      expect(assembled.vertices.has(`uc:${code}`), code).toBe(false);
    }
  });

  it('enforces all three exact Virginia Tech residency ceilings', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(evaluateVirginiaTechResidencyPolicy(doc)).toMatchObject({
        supported: true,
        overall_transfer_cap_units: 92,
        two_year_transfer_cap_units: 61.5,
        final_window_transfer_cap_units: 96,
        effective_two_year_transfer_cap_units: 61.5,
        proof: {
          senior_window_units: 45,
          senior_window_transfer_maximum: 18,
          senior_window_resident_minimum: 27,
        },
      });
    }
    const source = acceptedSource();
    for (const mutate of [
      (doc) => { doc.unit_audit.residency.minimum_units = 30; },
      (doc) => { doc.unit_audit.senior_residency_transfer_units_maximum = 19; },
      (doc) => { doc.unit_audit.two_year_transfer_maximum_percent = 51; },
    ]) {
      const drift = structuredClone(source);
      mutate(drift);
      expect(evaluateVirginiaTechResidencyPolicy(drift)).toBeNull();
    }
  });

  it('fails closed on identity, receipt, title, ref, rule, course, unit, flag, and accounting drift', () => {
    const source = acceptedSource();
    const mutations = [
      (doc) => { doc.school = 'Not Virginia Tech'; },
      (doc) => { doc.provenance.source_bundle_hash = '0'.repeat(64); },
      (doc) => { doc.sources[0].sha256 = '0'.repeat(64); },
      (doc) => { [doc.sources[0], doc.sources[1]] = [doc.sources[1], doc.sources[0]]; },
      (doc) => { doc.course_titles.ENGE2724 = 'Invented title'; },
      (doc) => { doc.requirement_groups[6].source_refs = ['major']; },
      (doc) => { doc.requirement_groups[17].analysis_constraints[1].description += ' drift'; },
      (doc) => { doc.requirement_groups[6].sections[0].receivers[0].code_seen = 'BIOL9999'; },
      (doc) => { doc.requirement_groups[6].sections[0].unit_advisement = 9; },
      (doc) => { doc.data_quality_flags[4].code = 'missing_evidence_hidden'; },
      (doc) => { doc.unit_audit.net_pathways_units_after_natural_science_overlap = 40; },
      (doc) => { doc.requirement_groups[0].sections[0].receivers[0].receiving.parent_id += 1; },
    ];
    for (const mutate of mutations) {
      const drift = structuredClone(source);
      mutate(drift);
      expect(exactVirginiaTechTree(drift).supported).toBe(false);
    }
  });

  it('keeps source/final blocker parity with the residual open facts explicit', () => {
    const sourceAudit = auditFourYearDocument(acceptedSource());
    const projectedAudit = auditFourYearDocument(buildFinalProjection());
    expect(sourceAudit.summary).toMatchObject({
      supported_active_rules: 4,
      blocked_active_rules: 9,
      blocked_unit_audit_rules: 2,
      blocked_rules_by_figure: { '1': 0, '3': 0, '4': 0, '6': 8 },
      ready_by_figure: { '1': true, '3': true, '4': true, '6': false },
    });
    for (const figure of ['1', '3', '4', '6']) {
      expect(blockers(projectedAudit, figure), `Figure ${figure}`)
        .toEqual(blockers(sourceAudit, figure));
    }
    expect(sourceAudit.active_rules.filter((row) => !row.supported).map((row) => row.kind))
      .toEqual([
        'no_double_count_across_cs_elective_groups',
        'conditional_5000_level_undergraduate_eligibility',
        'approved_experience_and_plan',
        'eligible_course_exclusions_and_distinctness',
        'department_approval_and_no_double_count',
        'pathways_no_degree_core_overlap',
        'nontechnical_course_distribution',
        'minimum_course_grades_and_gpas',
        'foreign_language_proficiency',
      ]);
  });

  it('uses the integrated central readers only after the exact tree passes', () => {
    const source = acceptedSource();
    const concept = findRule(source, 'pathways_concept_4_natural_science_overlap');
    expect(evaluateFourYearConstraint(concept.constraint, {
      constraint: concept.constraint,
      container: concept.group,
      document: source,
      path: `requirement_groups[${concept.groupIndex}]`,
    })).toMatchObject({ supported: true, evaluator: 'evaluateVirginiaTechConstraint' });

    const foreign = findRule(source, 'foreign_language_proficiency');
    expect(affectedFiguresForConstraint(foreign.constraint, {
      constraint: foreign.constraint,
      container: foreign.group,
      document: source,
      path: `requirement_groups[${foreign.groupIndex}]`,
    })).toEqual(['6']);
    expect(evaluateVirginiaResidencyTransferPolicy(source)).toMatchObject({
      supported: true,
      evaluator: 'evaluateVirginiaTechResidencyPolicy',
    });
    expect(auditFourYearAnalysisQualityFlags(source).map((row) => ({
      code: row.code, figures: row.affected_figures,
    }))).toEqual([
      { code: 'cross_group_elective_distinctness', figures: ['6'] },
      { code: 'pathways_attribute_and_overlap_evaluator_required', figures: ['6'] },
      { code: 'variable_credit_and_conditional_5000_level_options', figures: ['6'] },
      { code: 'catalog_noninteractive_capture_challenge', figures: ['1', '3', '4', '6'] },
      { code: 'program_listed_codes_absent_from_course_catalog', figures: ['6'] },
    ]);

    const projection = buildFinalProjection();
    const bridge = projection.requirement_groups[2];
    expect(canonicalRequirementRole(projection, bridge, bridge.sections[0])).toMatchObject({
      exact: true, role: 'zero_unit_requirement',
    });
    const capacity = projection.requirement_groups[16];
    expect(canonicalRequirementRole(projection, capacity, capacity.sections[0])).toMatchObject({
      exact: true, role: 'elective_capacity',
    });
    const lower = projection.requirement_groups[1].sections[0];
    expect(resolveSectionTier(projection.requirement_groups[1], lower, projection))
      .toBe('transferable');
  });
});

// The stored, human-verified tree is the reviewed candidate minus exactly the
// five candidate-only alternatives.  Removing them highest-index-first keeps
// every remaining receiver at its own index.
const receiverCodeOf = (receiver) => String(
  receiver?.code_seen ?? receiver?.receiving?.code ?? receiver?.code ?? '',
).trim();

function buildProtectedTree(document) {
  const tree = structuredClone(document);
  const ordered = [...CANDIDATE_ONLY_ALTERNATIVES].sort((left, right) => (
    right.receiver_index - left.receiver_index
  ));
  for (const alternative of ordered) {
    const receivers = tree.requirement_groups[alternative.group_index]
      .sections[alternative.section_index].receivers;
    expect(receiverCodeOf(receivers[alternative.receiver_index])).toBe(alternative.code);
    receivers.splice(alternative.receiver_index, 1);
  }
  return tree;
}

describe('Figure 3/4-scoped Virginia Tech tree binding', () => {
  it('reconstructs the exact protected tree from the reviewed candidate', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(virginiaTechProofTreeFingerprint(doc)).toBe(PROOF_TREE_SHA256);
      expect(virginiaTechProofTreeFingerprint(buildProtectedTree(doc)))
        .toBe(PROTECTED_PROOF_TREE_SHA256);
    }
  });

  it('resolves Figure 3/4 against both the stored verified and candidate trees', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(exactVirginiaTechFigure34Tree(doc)).toMatchObject({
        supported: true,
        proof: { tree_role: 'reviewed_candidate', figure_scope: ['3', '4'], proof_tree_sha256: PROOF_TREE_SHA256 },
      });
      expect(exactVirginiaTechFigure34Tree(buildProtectedTree(doc))).toMatchObject({
        supported: true,
        proof: {
          tree_role: 'stored_verified',
          figure_scope: ['3', '4'],
          proof_tree_sha256: PROTECTED_PROOF_TREE_SHA256,
        },
      });
    }
  });

  it('never lets the stored verified tree past the unscoped proof', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      const unscoped = exactVirginiaTechTree(buildProtectedTree(doc));
      expect(unscoped.supported).toBe(false);
      expect(unscoped.affected_figures).toEqual(['1', '3', '4', '6']);
      // The unscoped proof result must stay byte-identical for its ten other
      // consumers: no figure_scope, no tree_role, no widened acceptance.
      expect(exactVirginiaTechTree(doc)).toMatchObject({ supported: true });
      expect(exactVirginiaTechTree(doc).proof.figure_scope).toBeUndefined();
      expect(exactVirginiaTechTree(doc).proof.tree_role).toBeUndefined();
    }
  });

  it('scopes its own failures and rejects a third tree shape', () => {
    const mutated = structuredClone(acceptedSource());
    mutated.requirement_groups[0].sections[0].receivers[0].code_seen = 'CS1113';
    const result = exactVirginiaTechFigure34Tree(mutated);
    expect(result.supported).toBe(false);
    expect(result.affected_figures).toEqual(['3', '4']);
  });

  it('fails closed when a candidate-only alternative would displace an anchor', () => {
    const displaced = CANDIDATE_ONLY_ALTERNATIVES.some((alternative) => (
      FIGURE_34_RESOLVER_ANCHORS.some((entry) => (
        entry.group_index === alternative.group_index
        && entry.section_index === alternative.section_index
        && entry.receiver_index >= alternative.receiver_index
      ))
    ));
    // The binding is only sound while this holds; the resolver re-checks it on
    // every call so a newly added anchor cannot silently read a shifted index.
    expect(displaced).toBe(false);
  });

  it('fails closed on drift at any Figure 3/4 resolver anchor', () => {
    for (const entry of FIGURE_34_RESOLVER_ANCHORS) {
      const doc = structuredClone(acceptedSource());
      const receivers = doc.requirement_groups[entry.group_index]
        .sections[entry.section_index].receivers;
      const target = receivers[entry.receiver_index];
      const body = target.receiving && typeof target.receiving === 'object'
        ? target.receiving : target;
      expect(body.units).toBe(entry.units);
      body.units = entry.units + 1;
      expect(exactVirginiaTechFigure34Tree(doc)).toMatchObject({
        supported: false,
        affected_figures: ['3', '4'],
      });
    }
  });
});
