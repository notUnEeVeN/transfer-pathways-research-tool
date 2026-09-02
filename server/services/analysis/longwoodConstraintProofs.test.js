import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CIVITAE_FIGURE_34_EVIDENCE,
  CIVITAE_FIGURE_34_EVIDENCE_SHA256,
  CTZN410_SEQUENCE_EVIDENCE,
  CURRENT_CIVITAE_DESIGNATION_POSITIVE_CONTROL,
  CURRENT_CMSC_RESPONSE,
  MAJOR_ELECTIVE_SELECTION,
  MATH250_PREREQUISITE_EVIDENCE,
  SOURCE_RECEIPTS,
  civitaeFigure34Proof,
  evaluateLongwoodConstraint,
  evaluateLongwoodResidencyPolicy,
  exactLongwoodTree,
  languagePlacementProof,
  longwoodFigureSelection,
  longwoodProofTreeFingerprint,
  majorElectiveSelectionProof,
  perspectivesSequenceProof,
  upperLevelProof,
  variableCapacityProof,
} from './longwoodConstraintProofs';
import {
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import { evaluateVirginiaResidencyTransferPolicy } from './virginiaResidencyTransferCaps';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { getMajor } from '../../config/majors';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import { buildDegreeGroups } from '../degreeSlots';
import { assemblePathway } from './pathwayComplexity';
import { _evaluateTemplate } from './transferCreditRate';
import {
  extractLongwoodComputerScienceEntries,
} from '../virginia/longwoodDepartmentPrerequisiteAcquisition';

const ROOT = path.resolve(__dirname, '../..');
const COMPOSED_PATH = path.join(ROOT, '.va-catalogs/composed/longwood-university.json');
const REVIEW_PATH = path.join(
  ROOT, '.va-catalogs/research/va-university-prerequisite-review.json',
);
const CURRENT_CMSC_PATH = path.join(
  ROOT,
  '.va-catalogs/university-prerequisites/raw/longwood-university/longwood-university__computer_science_course_listing.html',
);
const sourcePath = (suffix) => path.join(
  ROOT, `.va-catalogs/pages/longwood-university__${suffix}.txt`,
);
const loadComposition = () => JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
const acceptedSource = () => cachedAcceptedSourcePlan().evaluatedDocuments.find((doc) => (
  doc.institution_id === 'va:uni:longwood-university'
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
    title: 'Longwood final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: universities.map((row) => ({
      institution: row.name,
      identifier: 'NO_MATCH_299',
    })),
  };
  return buildProjection({
    courses: [supply], degrees, asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9214);
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

const clone = (value) => structuredClone(value);

describe('exact Longwood paper-figure proofs', () => {
  it('binds all six retained official source roles and the exact source policies', () => {
    const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const suffixes = {
      major: 'program', general_education: 'ge', college: 'college',
      graduation: 'graduation', policy: 'policy', course_catalog: 'course_catalog',
    };
    for (const receipt of SOURCE_RECEIPTS) {
      expect(sha(sourcePath(suffixes[receipt.id])), receipt.id).toBe(receipt.sha256);
    }
    const program = fs.readFileSync(sourcePath('program'), 'utf8').replace(/\s+/g, ' ');
    const graduation = fs.readFileSync(sourcePath('graduation'), 'utf8').replace(/\s+/g, ' ');
    expect(program).toContain('Additional Degree Requirements BS Degree: 3-4 credits');
    expect(program).toContain('at least 6 credits must be at the 300-level or above');
    expect(program).toContain('Students must complete at least 12 additional credits of CMSC courses at the 200-level or above');
    expect(program).toContain('CMSC 350 may not count as an elective');
    expect(program).toContain('passing CMSC 140, CMSC 210, or CMSC 280');
    expect(program).toContain('may also count as major electives if they are of sufficient level');
    expect(program).toContain('General Elective credit must be substituted to restore the total');
    expect(program).toContain('General Electives for BS degree: 31-33 credits');
    expect(graduation).toContain('A minimum of 25 percent of the degree credit must be earned at Longwood University');
    expect(graduation).toContain('At least 30 credit hours at the upper level must be earned at Longwood University');
    expect(graduation).toContain('Exceptions must be approved in writing by the student’s college dean');
  });

  it('binds the deterministic elective route to complete current first-party entry boundaries', () => {
    const html = fs.readFileSync(CURRENT_CMSC_PATH, 'utf8');
    expect(createHash('sha256').update(html).digest('hex'))
      .toBe(CURRENT_CMSC_RESPONSE.response_sha256);
    expect(Buffer.byteLength(html)).toBe(CURRENT_CMSC_RESPONSE.response_bytes);
    const targets = [
      CURRENT_CIVITAE_DESIGNATION_POSITIVE_CONTROL.code,
      ...MAJOR_ELECTIVE_SELECTION.map((row) => row.code),
    ];
    const parsed = extractLongwoodComputerScienceEntries(html, targets);
    expect(parsed).toMatchObject({ verified: true, issues: [], missing: [] });
    const byCode = new Map(parsed.entries.map((row) => [row.course_code, row]));
    for (const expected of MAJOR_ELECTIVE_SELECTION) {
      const row = byCode.get(expected.code);
      expect(row, expected.code).toMatchObject({
        title: expected.title,
        published_units: {
          kind: 'published_fixed_credits',
          credit_hours_min: expected.units,
          credit_hours_max: expected.units,
        },
        raw_entry_sha256: expected.raw_entry_sha256,
        raw_entry_html_sha256: expected.raw_entry_html_sha256,
      });
      // The complete `.course-listing-fade` entry boundary ends at the credit
      // statement for every selected course, so no current Civitae tokens are
      // being hidden outside a prerequisite substring.
      expect(row.raw_entry_text).toMatch(/ 3 credits\.$/);
    }
    const positive = byCode.get(CURRENT_CIVITAE_DESIGNATION_POSITIVE_CONTROL.code);
    expect(positive).toMatchObject({
      raw_entry_sha256: CURRENT_CIVITAE_DESIGNATION_POSITIVE_CONTROL.raw_entry_sha256,
      raw_entry_html_sha256:
        CURRENT_CIVITAE_DESIGNATION_POSITIVE_CONTROL.raw_entry_html_sha256,
    });
    for (const token of CURRENT_CIVITAE_DESIGNATION_POSITIVE_CONTROL.designation_tokens) {
      expect(positive.raw_entry_text).toMatch(new RegExp(`\\b${token}\\b`));
    }

    const mutated = html.replace('Theory of Computation</p>', 'Changed</p>');
    expect(extractLongwoodComputerScienceEntries(mutated, ['CMSC415'])
      .entries[0].raw_entry_sha256).not.toBe(MAJOR_ELECTIVE_SELECTION[0].raw_entry_sha256);
    const duplicate = html.replace(
      '</body>',
      '<div class="course-listing-fade"><p><strong>CMSC415</strong>. Duplicate</p><p><span class="trunccourse">3 credits.</span></p></div></body>',
    );
    expect(extractLongwoodComputerScienceEntries(duplicate, ['CMSC415']))
      .toMatchObject({ verified: false, issues: ['target_entry_boundary'], missing: ['CMSC415'] });
  });

  it('binds a complete distinct Civitae witness and scopes only Figures 3/4 to zero impact', () => {
    expect(CIVITAE_FIGURE_34_EVIDENCE).toMatchObject({
      catalog_year: '2026-2027',
      paper_scope: {
        figures_proven_zero_impact: ['3', '4'],
        figures_still_blocked: ['6'],
      },
      deterministic_witness: {
        selected_pillar_codes: [
          'HIST150', 'PSYC230', 'RELI242', 'ART125', 'MATH171', 'ENSC162',
        ],
        selected_perspective_codes: ['PSYC335', 'RELI301', 'MATH301', 'SPAN320'],
        perspective_sacsco_witnesses: {
          social_behavioral_science: 'PSYC335',
          humanities_fine_arts: 'RELI301',
          mathematics_natural_sciences: 'MATH301',
        },
        total_civitae_units: 39,
        additional_units_due_to_distribution_or_single_count: 0,
        transferable_units_changed_by_resident_perspective_selection: 0,
      },
    });
    expect(CIVITAE_FIGURE_34_EVIDENCE_SHA256)
      .toBe('157a03c4b1c576863d4debce15e834e9df9905a9b584d94b53dfeac5ff265df6');
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(civitaeFigure34Proof(doc)).toMatchObject({
        supported: true,
        proof: {
          selected_perspective_codes: ['PSYC335', 'RELI301', 'MATH301', 'SPAN320'],
          resident_perspective_units: 12,
          total_civitae_units: 39,
          additional_units: 0,
          transferable_units_changed: 0,
          figures_proven_zero_impact: ['3', '4'],
        },
      });
      const found = findRule(doc, 'civitae_single_count_and_distribution');
      expect(evaluateFourYearConstraint(found.constraint, {
        container: found.group,
        document: doc,
        path: `requirement_groups[${found.groupIndex}]`,
      })).toMatchObject({
        supported: false,
        paper_impact_proven: true,
        evaluator: 'evaluateLongwoodConstraint',
        affected_figures: ['6'],
        proof: {
          evidence_sha256: CIVITAE_FIGURE_34_EVIDENCE_SHA256,
          transferable_units_changed: 0,
        },
      });
    }

    for (const mutate of [
      (evidence) => { evidence.catalog_year = '2025-2026'; },
      (evidence) => { evidence.source_contract.program_sources[8].roster_sha256 = '0'.repeat(64); },
      (evidence) => { evidence.deterministic_witness.selected_perspective_codes[0] = 'PSYC336'; },
      (evidence) => { evidence.deterministic_witness.perspective_sacsco_witnesses = {}; },
      (evidence) => { evidence.deterministic_witness.total_civitae_units = 40; },
    ]) {
      const evidence = clone(CIVITAE_FIGURE_34_EVIDENCE);
      mutate(evidence);
      expect(civitaeFigure34Proof(acceptedSource(), evidence).supported).toBe(false);
    }
  });

  it('retains one whole-tree fingerprint through composition, source, and final projection', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(documents.map(longwoodProofTreeFingerprint))).toEqual(new Set([
      '5926ef44b66d491623f861c1e9840d6fc7dc12c198f238aae7f96b9ccb83ff68',
    ]));
    expect(documents.map((doc) => exactLongwoodTree(doc))).toEqual([
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'composition' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'accepted_source' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'final_projection' }) }),
    ]);
  });

  it('proves all six evaluator-engineering rules from one exact runtime selection', () => {
    const kinds = [
      'language_placement_route',
      'perspectives_sequence',
      'course_level_menu_and_exclusion',
      'distinct_course_and_exclusion_pool',
      'major_elective_overlap',
      'future_civitae_major_overlap',
    ];
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(languagePlacementProof(doc)).toMatchObject({
        supported: true,
        selected_section_index: 0,
        route_units: [3, 4],
        requirement_vertices_by_route: [1, 1],
        invariant_degree_units: 120,
      });
      expect(perspectivesSequenceProof(doc)).toMatchObject({
        supported: true,
        perspective_slot_keys: [
          'slot:longwood-perspective:0',
          'slot:longwood-perspective:1',
          'slot:longwood-perspective:2',
          'slot:longwood-perspective:3',
        ],
        symposium_course_key: CTZN410_SEQUENCE_EVIDENCE.course_key,
        prerequisite_source_content_sha256:
          CTZN410_SEQUENCE_EVIDENCE.source_content_sha256,
        strictly_prior_slot_count: 3,
        prior_or_concurrent_slot_count: 1,
      });
      expect(majorElectiveSelectionProof(doc)).toMatchObject({
        supported: true,
        selected_course_codes: ['CMSC415', 'CMSC455', 'CMSC210', 'CMSC360'],
        selected_units: 12,
        selected_upper_division_units: 9,
        excluded_course_codes: ['CMSC350'],
        proficiency_course_code: 'CMSC210',
        proficiency_incremental_units: 0,
        selected_current_civitae_designations: [],
      });
      const selection = longwoodFigureSelection(doc);
      expect(selection).toMatchObject({
        ready: true,
        group_section_indices: { 3: 0, 14: 0, 16: 0 },
        selected_course_codes: ['CMSC415', 'CMSC455', 'CMSC210', 'CMSC360'],
        selected_perspective_course_codes: [
          'PSYC335', 'RELI301', 'MATH301', 'SPAN320',
        ],
        selected_perspective_course_keys: [
          'va:uni:9214:PSYC335', 'va:uni:9214:RELI301',
          'va:uni:9214:MATH301', 'va:uni:9214:SPAN320',
        ],
        proficiency_overlay_section_key: '13:0',
        perspective_section_keys: ['7:0', '7:1', '7:2', '7:3'],
      });
      expect(Object.keys(selection.prerequisite_condition_bindings[
        CTZN410_SEQUENCE_EVIDENCE.course_key
      ])).toHaveLength(2);
      expect(selection.virtual_sections['11:0'].receivers).toHaveLength(2);
      expect(selection.virtual_sections['12:0'].receivers).toHaveLength(2);

      for (const kind of kinds) {
        const found = findRule(doc, kind);
        expect(evaluateLongwoodConstraint(found.group, {
          constraint: found.constraint,
          document: doc,
          path: `requirement_groups[${found.groupIndex}]`,
        }), `${kind}:${doc._id || doc.slug}`).toMatchObject({ supported: true });
      }
    }
  });

  it('binds the exact CTZN 410 connector order and rejects semantically changed formulas', () => {
    const review = JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8'));
    const row = review.review_rows.find((entry) => (
      entry.slug === 'longwood-university' && entry.code === 'CTZN410'
    ));
    expect(row).toMatchObject({
      review_status: 'promoted_strict_formula',
      source_content_sha256: CTZN410_SEQUENCE_EVIDENCE.source_content_sha256,
      groups: [{ kind: 'prerequisite', formula: 'paths_or__conditions_and' }],
    });
    expect(row.groups[0].paths).toHaveLength(1);
    expect(row.groups[0].paths[0].all_of).toEqual(CTZN410_SEQUENCE_EVIDENCE.conditions);

    const source = acceptedSource();
    const selection = longwoodFigureSelection(source);
    const bindings = selection.prerequisite_condition_bindings[row.course_key];
    const hashes = row.groups[0].paths[0].all_of.map((condition) => (
      createHash('sha256').update(JSON.stringify(
        Object.fromEntries(Object.keys(condition).sort().map((key) => [key, condition[key]])),
      )).digest('hex')
    ));
    expect(hashes.map((conditionHash) => bindings[conditionHash])).toEqual([
      [
        'va:uni:9214:PSYC335',
        'va:uni:9214:RELI301',
        'va:uni:9214:MATH301',
      ],
      ['va:uni:9214:SPAN320'],
    ]);
    const reordered = clone(row.groups[0].paths[0].all_of).reverse();
    expect(reordered).not.toEqual(CTZN410_SEQUENCE_EVIDENCE.conditions);
    const weakened = clone(row.groups[0].paths[0].all_of);
    weakened[1].concurrent_allowed = false;
    expect(weakened).not.toEqual(CTZN410_SEQUENCE_EVIDENCE.conditions);
  });

  it('supports exactly the nine closed active rules and leaves source/admin policies fail-closed', () => {
    const supportedKinds = [
      'course_level_menu_and_exclusion',
      'dependent_elective_capacity',
      'distinct_course_and_exclusion_pool',
      'future_civitae_major_overlap',
      'language_placement_route',
      'major_elective_overlap',
      'perspectives_sequence',
      'prerequisite_gate',
      'upper_level_distribution_across_degree',
    ];
    const blockedKinds = [
      'civitae_single_count_and_distribution',
      'gpa_and_administrative_completion',
      'minimum_course_grade',
    ];
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      for (const kind of supportedKinds) {
        const found = findRule(doc, kind);
        expect(evaluateFourYearConstraint(found.constraint, {
          container: found.group,
          document: doc,
          path: `requirement_groups[${found.groupIndex}]`,
        }), `${kind}:${doc._id || doc.slug}`).toMatchObject({
          supported: true,
          evaluator: 'evaluateLongwoodConstraint',
        });
      }
      const audit = auditFourYearDocument(doc);
      expect(audit.active_rules.filter((row) => row.supported).map((row) => row.kind).sort())
        .toEqual(supportedKinds.slice().sort());
      expect(audit.active_rules.filter((row) => !row.supported).map((row) => row.kind).sort())
        .toEqual(blockedKinds.slice().sort());
      expect(audit.summary).toMatchObject({
        supported_active_rules: 9,
        blocked_active_rules: 3,
        blocked_unit_audit_rules: 2,
        blocked_rules_by_figure: { 1: 0, 3: 0, 4: 0, 6: 1 },
        ready_by_figure: { 1: true, 3: true, 4: true, 6: false },
      });
    }
  });

  it('proves every variable-unit branch and the exact 30-credit upper-level allocation', () => {
    const source = acceptedSource();
    expect(variableCapacityProof(source)).toMatchObject({
      supported: true,
      canonical_group_section_indices: { 3: 0, 14: 0, 16: 0 },
      route_units: [[3, 3, 21], [3, 4, 20], [4, 3, 20], [4, 4, 19]],
      invariant_variable_capacity_units: 27,
    });
    expect(upperLevelProof(source)).toMatchObject({
      supported: true,
      fixed_resident_upper_units: 30,
      carriers: [
        { path: 'requirement_groups[8].sections[0]', units: 3 },
        { path: 'requirement_groups[9].sections[8]', units: 3 },
        { path: 'requirement_groups[9].sections[9]', units: 3 },
        { path: 'requirement_groups[9].sections[10]', units: 0 },
        { path: 'requirement_groups[9].sections[11]', units: 3 },
        { path: 'requirement_groups[11].sections[0]', units: 6 },
        { path: 'requirement_groups[15].sections[0]', units: 12 },
      ],
    });
  });

  it('binds the selected MATH 250 prerequisite route to retained exact formula evidence', () => {
    const review = JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8'));
    const row = review.review_rows.find((entry) => (
      entry.slug === 'longwood-university' && entry.code === 'MATH250'
    ));
    expect(row).toMatchObject({
      review_status: 'promoted_strict_formula',
      review_reason: 'every_required_clause_character_accounted_for_by_strict_grammar',
      source_content_sha256: MATH250_PREREQUISITE_EVIDENCE.source_content_sha256,
    });
    const paths = row.groups[0].paths.map((formulaPath) => formulaPath.all_of
      .filter((condition) => condition.type === 'course')
      .map((condition) => condition.code));
    expect(paths).toEqual(MATH250_PREREQUISITE_EVIDENCE.paths);
    expect(acceptedSource().requirement_groups[10].sections[0].receivers[0].code_seen)
      .toBe(MATH250_PREREQUISITE_EVIDENCE.selected_path[0]);
  });

  it('enforces residency from exact resident upper carriers without selecting the exchange exception', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(evaluateLongwoodResidencyPolicy(doc)).toMatchObject({
        supported: true,
        overall_transfer_cap_units: 90,
        effective_two_year_transfer_cap_units: 90,
        proof: {
          fixed_resident_upper_units: 30,
          residency_minimum_fraction: 0.25,
          international_exchange_exception_selected: false,
        },
      });
      expect(evaluateVirginiaResidencyTransferPolicy(doc)).toMatchObject({
        supported: true,
        evaluator: 'evaluateLongwoodResidencyPolicy',
      });
    }
  });

  it('uses the same exact selection in Figure 1/3/4 accounting and Figure 6 assembly', () => {
    const source = acceptedSource();
    const degreeGroups = buildDegreeGroups(source.requirement_groups, {
      sourceDocument: source,
      articulated: new Set(),
    });
    expect(degreeGroups.groups.find((group) => (
      group.label === 'Major Electives: upper-level minimum'
    ))).toMatchObject({ total: 2, covered: 0 });
    expect(degreeGroups.groups.find((group) => (
      group.label === 'Major Electives: remaining credit'
    ))).toMatchObject({ total: 2, covered: 0 });
    expect(degreeGroups.groups.find((group) => (
      group.label === 'Multiple programming languages and technologies proficiency'
    ))).toMatchObject({ total: 1, covered: 0 });
    expect(degreeGroups.units).toEqual({ total: 120, covered: 0, ge_total: 48, ge_covered: 0 });

    const exactSelection = longwoodFigureSelection(source);
    const selectedParentIds = new Set(Object.values(exactSelection.virtual_sections)
      .flatMap((section) => section.receivers)
      .map((receiver) => receiver.receiving.parent_id));
    const adversarialCoverage = buildDegreeGroups(source.requirement_groups, {
      sourceDocument: source,
      articulated: selectedParentIds,
    });
    expect(adversarialCoverage.groups.find((group) => (
      group.label === 'Major Electives: upper-level minimum'
    ))).toMatchObject({ total: 2, covered: 0 });
    expect(adversarialCoverage.groups.find((group) => (
      group.label === 'Major Electives: remaining credit'
    ))).toMatchObject({ total: 2, covered: 0 });

    const ucCatalog = new Map();
    const ucCodeByParent = new Map();
    for (const group of source.requirement_groups) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          const code = receiver.code_seen || receiver.receiving?.code || null;
          const parentId = receiver.receiving?.parent_id;
          if (code) {
            ucCatalog.set(code, {
              id: `va:uni:9214:${code}`,
              units: Number(receiver.receiving?.units) || null,
            });
          }
          if (code && parentId != null) ucCodeByParent.set(parentId, code);
        }
      }
    }
    for (const row of MAJOR_ELECTIVE_SELECTION) {
      ucCatalog.set(row.code, {
        id: `va:uni:9214:${row.code}`,
        units: row.units,
      });
    }
    for (const code of exactSelection.selected_perspective_course_codes) {
      ucCatalog.set(code, {
        id: `va:uni:9214:${code}`,
        units: 3,
      });
    }
    const pathway = assemblePathway({
      degree: source,
      asIds: [],
      agreementByParent: new Map(),
      ucCatalog,
      ucCodeByParent,
      ccUnits: new Map(),
      normalizeCatalogCode: (value) => String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase(),
    });
    const keys = new Set(pathway.vertices.keys());
    for (const code of ['CMSC415', 'CMSC455', 'CMSC210', 'CMSC360']) {
      expect(keys.has(`va:uni:9214:${code}`), code).toBe(true);
    }
    expect(keys.has('va:uni:9214:CMSC140')).toBe(false);
    expect(keys.has('va:uni:9214:CMSC280')).toBe(false);
    expect([...keys].filter((key) => key === 'va:uni:9214:CMSC210')).toHaveLength(1);
    expect([...keys].filter((key) => (
      exactSelection.selected_perspective_course_keys.includes(key)
    ))).toEqual(exactSelection.selected_perspective_course_keys);
    expect([...keys].some((key) => key.startsWith('slot:longwood-perspective:')))
      .toBe(false);
    expect(pathway.exact_non_course_condition_bindings)
      .toEqual(longwoodFigureSelection(source).prerequisite_condition_bindings);

    // The fixed resident major-elective witness closes an open roster; it is
    // not permission to let a community-college articulation discharge the
    // university-only elective sections. Exercise the Figure 3/4 allocator
    // directly with a deliberately matching articulation and prove it cannot
    // spend that sending course.
    const selected = exactSelection.virtual_sections['12:0']
      .receivers.find((receiver) => receiver.receiving.code === 'CMSC210');
    const sendingCourseId = 921400210;
    const transferState = _evaluateTemplate(source, [{
      requirement_groups: [{
        sections: [{
          receivers: [{
            receiving: {
              kind: 'course',
              parent_id: selected.receiving.parent_id,
            },
            articulation_status: 'articulated',
            options: [{ course_ids: [sendingCourseId], course_conjunction: 'and' }],
          }],
        }],
      }],
    }], new Set([sendingCourseId]), new Map([[sendingCourseId, 3]]),
    'semester', 'semester', false);
    expect(transferState.directAppliedUnits).toBe(0);
    expect(transferState.directIds).toEqual(new Set());
  });

  it('resolves both exact evaluator flags and keeps only Civitae Figure 6 closed', () => {
    const flags = auditFourYearAnalysisQualityFlags(acceptedSource());
    expect(flags.map((row) => ({
      code: row.code,
      resolved: row.resolved_by_exact_evaluator,
      figures: row.affected_figures,
    }))).toEqual([
      {
        code: 'cross_group_variable_credit_dependency',
        resolved: true,
        figures: ['1', '3', '4', '6'],
      },
      {
        code: 'multiple_languages_overlap_dependency',
        resolved: true,
        figures: ['1', '3', '4', '6'],
      },
      {
        code: 'civitae_attribute_and_distribution_dependency',
        resolved: false,
        figures: ['6'],
      },
    ]);
  });

  it('fails closed on identity, source, ref, declaration, course, unit, and accounting drift', () => {
    const source = acceptedSource();
    const mutations = [
      (doc) => { doc.school = 'Not Longwood'; },
      (doc) => { doc.sources[0].sha256 = '0'.repeat(64); },
      (doc) => { [doc.sources[0], doc.sources[1]] = [doc.sources[1], doc.sources[0]]; },
      (doc) => { doc.requirement_groups[14].source_refs = ['major']; },
      (doc) => { doc.requirement_groups[16].canonical_section_index = 1; },
      (doc) => { doc.requirement_groups[16].sections[1].unit_advisement = 21; },
      (doc) => { doc.requirement_groups[15].sections[0].unit_advisement = 11; },
      (doc) => { doc.requirement_groups[9].sections[8].cc_articulable = true; },
      (doc) => { doc.requirement_groups[14].sections[0].receivers[0].receiving.parent_id += 1; },
      (doc) => { doc.requirement_groups[10].sections[0].receivers[0].code_seen = 'MATH176'; },
      (doc) => { doc.requirement_groups[16].analysis_constraints.push(clone(doc.requirement_groups[16].analysis_constraints[0])); },
      (doc) => { doc.unit_audit.upper_division.modeled_units = 29; },
      (doc) => { doc.unit_audit.residency.minimum_fraction = 0.2; },
      (doc) => { doc.data_quality_flags[0].code = 'unreviewed_variable_dependency'; },
    ];
    for (const mutate of mutations) {
      const doc = clone(source);
      mutate(doc);
      expect(exactLongwoodTree(doc).supported).toBe(false);
      expect(evaluateLongwoodResidencyPolicy(doc)).toBeNull();
    }

    const detached = clone(source);
    const found = findRule(detached, 'dependent_elective_capacity');
    expect(evaluateFourYearConstraint(found.constraint, {
      container: found.group,
      document: detached,
      path: 'requirement_groups[15]',
    }).supported).toBe(false);
  });

  it('keeps every paper-figure blocker receipt identical in source and final projection', () => {
    const sourceAudit = auditFourYearDocument(acceptedSource());
    const projectionAudit = auditFourYearDocument(buildFinalProjection());
    for (const figure of ['1', '3', '4', '6']) {
      expect(blockers(projectionAudit, figure), figure).toEqual(blockers(sourceAudit, figure));
    }
  });
});
