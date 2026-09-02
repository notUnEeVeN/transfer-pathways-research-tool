import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  BLUE_RIDGE_CATEGORY_COURSES,
  BLUE_RIDGE_GENERAL_EDUCATION_CODES,
  BLUE_RIDGE_THREE_CREDIT_GENERAL_EDUCATION_CODES,
  COLLEGES,
  LAUREL_RIDGE_ELECTIVE_CODES,
  LAUREL_RIDGE_PROOF_TREE_SHA256,
  MOUNTAIN_GATEWAY_UCGS_PROOF_TREE_SHA256,
  MOUNTAIN_GATEWAY_UCGS_PROOF_TREES,
  MOUNTAIN_GATEWAY_UCGS_SOURCE_BOUND_RULE,
  NEW_RIVER_FIGURE_6_LAB_CODES,
  associateConflictProofTreeFingerprint,
  blueRidgeDistinctAreaRuntimeCarrier,
  evaluateAssociateCollegeConstraint,
  evaluateMountainGatewayUcgsUnitAssignment,
  mountainGatewayUcgsComponentCap,
  mountainGatewayUcgsUnitTuples,
  newRiverFigure6LaboratorySelection,
  northernVirginiaFigure34Aggregates,
} from './associateCollegeConstraintProofs';
import {
  auditAssociateAnalysisQualityFlags,
  auditAssociateDocument,
} from './associateFigureConstraints';
import {
  associateNamedSections,
  planAssociateDegree,
  unresolvedSourceConflictCount,
} from './transferCreditRate';
import { canonicalSourceContract } from './canonicalSourceContract';
import { courseIdFor } from '../virginia/courseIdentity';

const require = createRequire(import.meta.url);
const { cachedAcceptedSourcePlan } = require('../../scripts/importVirginiaCatalogDegrees');
const { buildProjection, projectGroups } = require('../../scripts/va/buildVaDocuments');
const { getMajor } = require('../../config/majors');
const { VA_INSTITUTION_REGISTRY } = require('../virginia/institutionIds');
const requisiteArtifact = require('../../../scripts/data/va_course_requisites.json');

const sourceDocuments = cachedAcceptedSourcePlan().documents
  .filter((document) => document.kind === 'as_degree');

function source(slug) {
  return structuredClone(sourceDocuments.find((document) => (
    document._id === `va:as:${slug}:cs`
  )));
}

function projection(document, college) {
  return {
    ...structuredClone(document),
    _id: `as_degree:${college.numericId}:va-cs:local_as`,
    kind: 'as_degree',
    major_slug: 'va-cs',
    state: 'va',
    community_college_id: college.numericId,
    college_id: `va:cc:${college.numericId}`,
    college_name: college.name,
    status: 'found',
    va_requirement_status: 'extracted',
    va_requirement_id: document._id,
    analysis_ready: document.acceptance?.ready_for_analysis === true,
    analysis_contract: canonicalSourceContract(),
    requirement_groups: projectGroups(document, { associate: true }),
  };
}

function finalNumericProjection() {
  const sourcePlan = cachedAcceptedSourcePlan();
  const degrees = sourcePlan.documents.filter((document) => (
    document.kind === 'degree' && document.status === 'extracted'
  ));
  const asDegrees = sourcePlan.documents.filter((document) => (
    document.kind === 'as_degree' && document.status === 'extracted'
  ));
  const configuredIds = new Set(Object.keys(getMajor('va-cs').programs).map(Number));
  const universities = VA_INSTITUTION_REGISTRY.filter((row) => (
    row.level === 'four_year' && configuredIds.has(row.id)
  ));
  const associateSlugs = new Set(asDegrees.map((document) => (
    document._id.replace(/^va:as:/, '').replace(/:cs$/, '')
  )));
  const colleges = VA_INSTITUTION_REGISTRY.filter((row) => (
    row.level === 'community_college' && associateSlugs.has(row.slug)
  ));
  const institutions = [...colleges, ...universities].map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  // One deliberately unmatched statewide row activates the exact production
  // 19 x 16 projection cohort without satisfying or changing a requirement.
  const supply = {
    course_id: courseIdFor('CSC299'),
    course_key: 'va:CSC299',
    code: 'CSC299',
    title: 'Associate final-projection parity witness',
    credits: 3,
    offered_by: colleges.map((row) => row.name),
    articulates_to: universities.map((row) => ({
      institution: row.name,
      identifier: 'NO_MATCH_299',
    })),
  };
  return buildProjection({
    courses: [supply], degrees, asDegrees, institutions,
  });
}

function protectedOperationalNova() {
  const document = source(COLLEGES.northernVirginia.slug);
  document.provenance.source_bundle_hash = COLLEGES.northernVirginia.sourceBundleHashes[1];
  const carrier = {
    nova_humanities_fine_arts_literature: [
      'ART100', 'ART101', 'ART102', 'CST130', 'CST151',
      'MUS121', 'MUS221', 'MUS222', 'MUS226',
    ],
    nova_history: [
      'HIS101', 'HIS102', 'HIS111', 'HIS112',
      'HIS121', 'HIS122', 'HIS203', 'HIS254',
    ],
    nova_social_behavioral_nonhistory: [
      'ADJ100', 'ECO150', 'ECO201', 'ECO202', 'GEO200', 'GEO210', 'GEO220',
      'PLS135', 'PLS140', 'PLS241', 'PSY200', 'PSY216', 'PSY230',
      'SOC200', 'SOC211', 'SOC268',
    ],
  };
  for (const group of document.requirement_groups || []) {
    const codes = carrier[group.ge_area];
    if (!codes) continue;
    group.sections[0].receivers = [{
      options_conjunction: 'or',
      options: codes.map((code) => ({
        course_ids: [courseIdFor(code)],
        course_keys: [`va:${code}`],
        course_conjunction: 'or',
      })),
    }];
    for (const constraint of group.analysis_constraints || []) {
      constraint.status = 'evaluator_not_implemented';
      delete constraint.evaluation_scope;
      delete constraint.minimum_distinct_categories;
      delete constraint.category_names;
      delete constraint.excluded_subjects;
    }
  }
  return document;
}

function protectedOperationalBlueRidge() {
  const document = source(COLLEGES.blueRidge.slug);
  document.provenance.source_bundle_hash = COLLEGES.blueRidge.sourceBundleHashes[1];
  const row = constraintOwner(document, 'distinct_ge_areas');
  row.constraint.status = 'evaluator_not_implemented';
  delete row.constraint.minimum_distinct_categories;
  delete row.constraint.category_subjects;
  delete row.constraint.category_courses;
  delete row.constraint.evaluation_scope;
  const folded = structuredClone(row.owner.sections[0]);
  folded.unit_advisement = 6;
  folded.unit_advisement_max = 6;
  row.owner.sections = [folded];
  return document;
}

function protectedOperationalMountainGateway() {
  const document = source(COLLEGES.mountainGateway.slug);
  document.provenance.source_bundle_hash =
    COLLEGES.mountainGateway.sourceBundleHashes[1];
  const category = constraintOwner(document, 'distinct_ge_areas').constraint;
  category.status = 'evaluator_not_implemented';
  delete category.minimum_distinct_categories;
  delete category.category_subjects;
  Object.assign(document.course_titles, {
    FRE201: 'Intermediate French I',
    FRE202: 'Intermediate French II',
    SPA201: 'Intermediate Spanish I',
    SPA202: 'Intermediate Spanish II',
  });
  const receiver = (entries) => ({
    articulation_status: 'articulated',
    not_articulated_reason: null,
    options: entries.map(([key, idCode = key]) => ({
      course_ids: [courseIdFor(idCode)],
      course_keys: [`va:${key}`],
      course_conjunction: 'or',
    })),
    options_conjunction: 'or',
    code_seen: 'HIS121 / HIS122',
  });
  document.requirement_groups[7].sections[0].receivers = [receiver([
    ['CST110'], ['FRE201'], ['FRE202'], ['ITE152'], ['SPA201'], ['SPA202'],
  ])];
  document.requirement_groups[8].sections[0].receivers = [receiver([
    ['BIO101'], ['BIO102'], ['CHM111'], ['CHM112'], ['MTH161'], ['MTH162'],
    ['MTH167'], ['MTH245'], ['MTH263'], ['MTH264'], ['MTH265'], ['PHY201'],
    ['PHY202'], ['PHY241'],
    // The protected operational source carries this historical readable-key
    // typo. Its numeric identity is still PHY 242. Keep the exact bytes in
    // the fixture: the cap proof must not silently repair an unrelated menu.
    ['PHY241', 'PHY242'],
  ])];
  document.requirement_groups[9].title = 'Transfer Core (Same as GE Requirements)';
  return document;
}

function constraintOwner(document, kind) {
  const matches = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    (value.analysis_constraints || []).forEach((constraint) => {
      if (constraint.kind === kind) matches.push({ owner: value, constraint });
    });
    Object.entries(value).forEach(([key, child]) => {
      if (key !== 'analysis_constraints') visit(child);
    });
  };
  visit({
    unit_audit: document.unit_audit,
    requirement_groups: document.requirement_groups,
  });
  if (matches.length !== 1) throw new Error(`expected one ${kind}, found ${matches.length}`);
  return matches[0];
}

function constraintRows(document, kind) {
  const matches = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    (value.analysis_constraints || []).forEach((constraint) => {
      if (constraint.kind === kind) matches.push({ owner: value, constraint });
    });
    Object.entries(value).forEach(([key, child]) => {
      if (key !== 'analysis_constraints') visit(child);
    });
  };
  visit({ unit_audit: document.unit_audit, requirement_groups: document.requirement_groups });
  return matches;
}

function proof(document, kind) {
  const { owner, constraint } = constraintOwner(document, kind);
  return evaluateAssociateCollegeConstraint(constraint, { owner, doc: document });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const PAGE_SUFFIX = Object.freeze({
  major: 'program',
  catalog: 'catalog',
  general_education: 'ge',
  elective: 'elective',
  student_development: 'student_development',
  graduation: 'graduation',
  policy: 'policy',
  course_catalog: 'course_catalog',
  uniform_general_studies: 'uniform_general_studies',
  science_specialized: 'science_specialized',
  transfer_core: 'transfer_core',
});

function retainedPage(college, sourceId) {
  return path.resolve(
    __dirname,
    `../../.va-catalogs/pages/${college.slug}__${PAGE_SUFFIX[sourceId]}.txt`,
  );
}

function fixedLocalUnits(document) {
  const units = new Map();
  for (const group of document.requirement_groups || []) {
    for (const section of group.sections || []) {
      if (section.section_advisement !== 1
          || Number(section.unit_advisement) !== Number(section.unit_advisement_max)) continue;
      for (const receiver of section.receivers || []) {
        for (const option of receiver.options || []) {
          if (option.course_ids?.length === 1) {
            units.set(option.course_ids[0], Number(section.unit_advisement));
          }
        }
      }
    }
  }
  return units;
}

function labIds(ids) {
  const roster = new Set([
    'BIO101', 'BIO102', 'CHM111', 'CHM112', 'GOL105', 'PHY241', 'PHY242',
  ].map(courseIdFor));
  return ids.filter((id) => roster.has(id)).sort((left, right) => left - right);
}

function blockerKeys(document, figure) {
  return auditAssociateDocument(document).active_blockers
    .filter((row) => row.affected_figures.includes(figure))
    .map((row) => `${row.path}|${row.kind}`)
    .sort();
}

function laurelRidgeUnits(document) {
  const units = new Map();
  for (const group of document.requirement_groups || []) {
    for (const section of group.sections || []) {
      const options = (section.receivers || []).flatMap((receiver) => receiver.options || []);
      if (Number(section.unit_advisement) === Number(section.unit_advisement_max)) {
        for (const option of options) {
          const ids = option.course_ids || [];
          if (ids.length === 1) units.set(ids[0], Number(section.unit_advisement));
        }
      }
    }
  }
  for (const [code, unit] of Object.entries({
    CHM111: 4, CHM112: 4, MTH263: 4, MTH264: 4,
    CSC110: 3, CSC205: 3, CSC210: 4, CSC215: 3,
    CSC295: 1, CSC298: 1, EGR121: 2, EGR122: 3, EGR270: 4,
    MTH161: 3, MTH162: 3, MTH167: 5, MTH265: 4, MTH266: 3,
  })) units.set(courseIdFor(code), unit);
  return units;
}

describe('source-bound NOVA and New River associate constraints', () => {
  it.each([
    ['Blue Ridge', COLLEGES.blueRidge],
    ['Laurel Ridge', COLLEGES.laurelRidge],
    ['Mountain Gateway', COLLEGES.mountainGateway],
    ['NOVA', COLLEGES.northernVirginia],
    ['New River', COLLEGES.newRiver],
  ])('reproduces every retained official %s source hash', (_label, college) => {
    for (const sourceRow of college.sources) {
      const content = fs.readFileSync(retainedPage(college, sourceRow.id));
      expect(sha256(content), sourceRow.id).toBe(sourceRow.sha256);
    }
  });

  it.each(['accepted_source', 'final_projection'])(
    'enforces Mountain Gateway’s exact seven-block 31-33 UCGS cap in the %s tree without closing an open roster',
    (style) => {
      const accepted = source(COLLEGES.mountainGateway.slug);
      const document = style === 'accepted_source'
        ? accepted : projection(accepted, COLLEGES.mountainGateway);
      expect(associateConflictProofTreeFingerprint(document))
        .toBe(MOUNTAIN_GATEWAY_UCGS_PROOF_TREE_SHA256);
      expect(mountainGatewayUcgsComponentCap(document)).toMatchObject({
        handled: true,
        ready: true,
        proof: {
          document_style: style,
          source_bound_rule: MOUNTAIN_GATEWAY_UCGS_SOURCE_BOUND_RULE,
          proof_tree_sha256: MOUNTAIN_GATEWAY_UCGS_PROOF_TREE_SHA256,
          component_group_indices: [1, 2, 3, 4, 5, 6, 7],
          exact_block_unit_ranges: {
            I: { minimum: 6, maximum: 6 },
            II: { minimum: 6, maximum: 6 },
            III: { minimum: 3, maximum: 3 },
            IV: { minimum: 4, maximum: 4 },
            V: { minimum: 3, maximum: 5 },
            VI: { minimum: 3, maximum: 3 },
            VII: { minimum: 6, maximum: 8 },
          },
          fixed_blocks_i_iv_vi_units: 22,
          published_ucgs_units: { minimum: 31, maximum: 33 },
          raw_unit_tuple_count: 9,
          allowed_unit_tuples: [
            { mathematics_units: 3, block_vii_units: 6, ucgs_units: 31 },
            { mathematics_units: 3, block_vii_units: 7, ucgs_units: 32 },
            { mathematics_units: 3, block_vii_units: 8, ucgs_units: 33 },
            { mathematics_units: 4, block_vii_units: 6, ucgs_units: 32 },
            { mathematics_units: 4, block_vii_units: 7, ucgs_units: 33 },
            { mathematics_units: 5, block_vii_units: 6, ucgs_units: 33 },
          ],
          rejected_unit_tuples: [
            { mathematics_units: 4, block_vii_units: 8, ucgs_units: 34 },
            { mathematics_units: 5, block_vii_units: 7, ucgs_units: 34 },
            { mathematics_units: 5, block_vii_units: 8, ucgs_units: 35 },
          ],
          computer_science_specific_prescribed_branch: false,
          destination_selected_course_identities_resolved: false,
          independent_open_constraint_kinds: [
            'choose_two_variable_credit_open_roster',
            'destination_selected_open_stem_roster',
            'destination_selected_transfer_core',
          ],
        },
      });
      expect(proof(document, 'published_ucgs_component_cap')).toMatchObject({
        handled: true,
        supported: true,
        affected_figures: ['3', '4', '6'],
        resolved_constraint: {
          status: 'supported',
          source_bound_rule: MOUNTAIN_GATEWAY_UCGS_SOURCE_BOUND_RULE,
          evaluation_scope: 'source_bound_component_unit_sum',
          component_group_indices: [1, 2, 3, 4, 5, 6, 7],
          minimum_component_units: 31,
          maximum_component_units: 33,
          allowed_math_block_vii_unit_pairs: [
            { mathematics_units: 3, block_vii_units: 6 },
            { mathematics_units: 3, block_vii_units: 7 },
            { mathematics_units: 3, block_vii_units: 8 },
            { mathematics_units: 4, block_vii_units: 6 },
            { mathematics_units: 4, block_vii_units: 7 },
            { mathematics_units: 5, block_vii_units: 6 },
          ],
        },
      });
      expect(auditAssociateDocument(document).active_blockers.map((row) => row.kind))
        .toEqual([
          'choose_two_variable_credit_open_roster',
          'destination_selected_open_stem_roster',
          'destination_selected_transfer_core',
        ]);
    },
  );

  it('filters all nine Mountain Gateway math/Block VII credit combinations at the published cap', () => {
    const document = source(COLLEGES.mountainGateway.slug);
    const tuples = mountainGatewayUcgsUnitTuples();
    expect(tuples).toHaveLength(9);
    for (const tuple of tuples) {
      expect(evaluateMountainGatewayUcgsUnitAssignment(document, tuple.block_units),
        `${tuple.mathematics_units}+${tuple.block_vii_units}`).toMatchObject({
        handled: true,
        ready: true,
        supported: true,
        allowed: tuple.allowed,
        block_units: tuple.block_units,
        ucgs_units: tuple.ucgs_units,
      });
    }
    expect(evaluateMountainGatewayUcgsUnitAssignment(document, {
      I: 6, II: 6, III: 3, IV: 4, V: 6, VI: 3, VII: 5,
    })).toMatchObject({ ready: false, supported: false, allowed: false });
    expect(evaluateMountainGatewayUcgsUnitAssignment(document, {
      I: 6, II: 6, III: 3, IV: 4, V: 3, VI: 3, VII: 6, VIII: 0,
    })).toMatchObject({ ready: false, supported: false, allowed: false });
  });

  it.each(['accepted_source', 'final_projection'])(
    'fails the Mountain Gateway %s cap proof closed on every material mutation',
    (style) => {
      const make = () => {
        const accepted = source(COLLEGES.mountainGateway.slug);
        return style === 'accepted_source'
          ? accepted : projection(accepted, COLLEGES.mountainGateway);
      };
      const mutations = [
        ['identity', (document) => {
          document._id = 'as_degree:9999:wrong:local_as';
          document.va_requirement_id = 'va:as:wrong:cs';
          document.community_college_id = 9999;
          document.college_id = 'va:cc:9999';
          document.college_name = 'Wrong College';
        }],
        ['source bundle', (document) => {
          document.provenance.source_bundle_hash = '0'.repeat(64);
        }],
        ['official source hash', (document) => {
          document.sources.find((row) => row.id === 'uniform_general_studies').sha256 = '0'.repeat(64);
        }],
        ['published cap', (document) => {
          document.published_unit_audit.component_units.uniform_general_studies_maximum = 34;
        }],
        ['canonical component accounting', (document) => {
          document.unit_audit.canonical_component_units.uniform_general_studies = 32;
        }],
        ['widened math carrier', (document) => {
          document.requirement_groups[5].sections[0].unit_advisement_max = 6;
        }],
        ['widened Block VII carrier', (document) => {
          document.requirement_groups[7].sections[0].unit_advisement_max = 9;
        }],
        ['course roster', (document) => {
          document.requirement_groups[5].sections[0].receivers[0].options.pop();
        }],
        ['constraint description', (document) => {
          constraintRows(document, 'published_ucgs_component_cap')[0]
            .constraint.description = 'changed';
        }],
        ['constraint status', (document) => {
          constraintRows(document, 'published_ucgs_component_cap')[0]
            .constraint.status = 'supported';
        }],
        ['duplicate declaration', (document) => {
          const row = constraintRows(document, 'published_ucgs_component_cap')[0];
          row.owner.analysis_constraints.push(structuredClone(row.constraint));
        }],
        ['moved declaration', (document) => {
          const row = constraintRows(document, 'published_ucgs_component_cap')[0];
          row.owner.analysis_constraints = row.owner.analysis_constraints.filter((entry) => (
            entry !== row.constraint
          ));
          document.requirement_groups[4].analysis_constraints.push(row.constraint);
        }],
        ['open rule removed', (document) => {
          document.requirement_groups[8].analysis_constraints = [];
        }],
      ];
      if (style === 'final_projection') {
        mutations.push(['canonical projection contract', (document) => {
          delete document.analysis_contract;
        }]);
      }
      for (const [label, mutate] of mutations) {
        const document = make();
        mutate(document);
        const rows = constraintRows(document, 'published_ucgs_component_cap');
        expect(rows, label).toHaveLength(label === 'duplicate declaration' ? 2 : 1);
        const receipt = evaluateAssociateCollegeConstraint(rows[0].constraint, {
          owner: rows[0].owner,
          doc: document,
        });
        expect(receipt, label).toMatchObject({
          handled: true,
          supported: false,
          affected_figures: ['3', '4', '6'],
        });
        expect(mountainGatewayUcgsComponentCap(document), label)
          .toMatchObject({ handled: true, ready: false });
      }
    },
  );

  it.each(['accepted_source', 'final_projection'])(
    'pins the protected operational Mountain Gateway %s cap without treating its partial menus as complete',
    (style) => {
      const make = () => {
        const accepted = protectedOperationalMountainGateway();
        return style === 'accepted_source'
          ? accepted : projection(accepted, COLLEGES.mountainGateway);
      };
      const document = make();
      const bundle = COLLEGES.mountainGateway.sourceBundleHashes[1];
      expect(associateConflictProofTreeFingerprint(document))
        .toBe(MOUNTAIN_GATEWAY_UCGS_PROOF_TREES[bundle][style]);
      expect(mountainGatewayUcgsComponentCap(document)).toMatchObject({
        handled: true,
        ready: true,
        proof: {
          document_style: style,
          source_bundle_hash: bundle,
          proof_tree_sha256: MOUNTAIN_GATEWAY_UCGS_PROOF_TREES[bundle][style],
          protected_partial_destination_roster_retained: true,
          destination_selected_course_identities_resolved: false,
        },
      });
      expect(auditAssociateDocument(document).active_blockers.map((row) => row.kind))
        .toEqual([
          'choose_two_variable_credit_open_roster',
          'destination_selected_open_stem_roster',
          'destination_selected_transfer_core',
        ]);

      const mutations = [
        ['crossed bundle/tree tuple', (value) => {
          value.provenance.source_bundle_hash =
            COLLEGES.mountainGateway.sourceBundleHashes[0];
        }],
        ['official source hash', (value) => {
          value.sources.find((row) => row.id === 'uniform_general_studies').sha256 =
            '0'.repeat(64);
        }],
        ['widened math capacity', (value) => {
          value.requirement_groups[5].sections[0].unit_advisement_max = 6;
        }],
        ['widened published cap', (value) => {
          value.published_unit_audit.component_units.uniform_general_studies_maximum = 34;
        }],
        ['moved cap declaration', (value) => {
          const row = constraintRows(value, 'published_ucgs_component_cap')[0];
          row.owner.analysis_constraints = [];
          value.requirement_groups[4].analysis_constraints.push(row.constraint);
        }],
        ['partial destination menu drift', (value) => {
          value.requirement_groups[7].sections[0].receivers[0].options.pop();
        }],
      ];
      for (const [label, mutate] of mutations) {
        const changed = make();
        mutate(changed);
        const row = constraintRows(changed, 'published_ucgs_component_cap')[0];
        expect(evaluateAssociateCollegeConstraint(row.constraint, {
          owner: row.owner,
          doc: changed,
        }), label).toMatchObject({
          handled: true,
          supported: false,
          affected_figures: ['3', '4', '6'],
        });
        expect(mountainGatewayUcgsComponentCap(changed), label)
          .toMatchObject({ handled: true, ready: false });
      }
    },
  );

  it('retains the exact Mountain Gateway printed heading, five-credit carrier, Block VII range, and final UCGS total', () => {
    const page = fs.readFileSync(
      retainedPage(COLLEGES.mountainGateway, 'uniform_general_studies'), 'utf8',
    );
    expect(page).toMatch(/Block V: Mathematics\s+\(3 Cr - 4 Cr, select one course\)/i);
    expect(page).toMatch(/MTH 167[^\n]*Credits: 5/i);
    expect(page).toMatch(/Block VII: Specialized GE Requirements\s+\(6 CR - 8 CR, select two courses/i);
    expect(page).toMatch(/Minimum Credit Hours for Certificate: 31-33/i);
  });

  it.each(['accepted_source', 'final_projection'])(
    'binds the checked-in Blue Ridge %s carrier to its exact 21-course category rule',
    (style) => {
      const accepted = source(COLLEGES.blueRidge.slug);
      const document = style === 'accepted_source'
        ? accepted : projection(accepted, COLLEGES.blueRidge);
      expect(proof(document, 'distinct_ge_areas')).toMatchObject({
        handled: true,
        supported: true,
        affected_figures: ['3', '4', '6'],
        proof: {
          carrier_style: 'checked_in_two_sections',
          selected_courses: 2,
          selected_units: 6,
          minimum_distinct_categories: 2,
          category_courses: BLUE_RIDGE_CATEGORY_COURSES,
        },
        resolved_constraint: {
          minimum_distinct_categories: 2,
          category_courses: BLUE_RIDGE_CATEGORY_COURSES,
        },
      });
      expect(blueRidgeDistinctAreaRuntimeCarrier(document)).toMatchObject({
        handled: true,
        ready: true,
        sections: [{ section_advisement: 1 }, { section_advisement: 1 }],
      });
      expect(auditAssociateDocument(document).active_blockers.map((row) => row.kind))
        .toEqual(['alternative_course_credit_mismatch']);
    },
  );

  it.each(['accepted_source', 'final_projection'])(
    'replays the protected folded Blue Ridge %s carrier as an exact runtime choose-two rule',
    (style) => {
      const accepted = protectedOperationalBlueRidge();
      const document = style === 'accepted_source'
        ? accepted : projection(accepted, COLLEGES.blueRidge);
      expect(proof(document, 'distinct_ge_areas')).toMatchObject({
        handled: true,
        supported: true,
        proof: {
          carrier_style: 'protected_folded_section',
          selected_courses: 2,
          selected_units: 6,
        },
      });
      const runtime = blueRidgeDistinctAreaRuntimeCarrier(document);
      expect(runtime).toMatchObject({
        handled: true,
        ready: true,
        sections: [{ section_advisement: 2, unit_advisement: 6 }],
      });
      // Runtime enforcement is derived. The protected source/core remains
      // byte-for-byte at its historical one-choice folded carrier.
      expect(constraintOwner(document, 'distinct_ge_areas').owner.sections)
        .toMatchObject([{ section_advisement: 1, unit_advisement: 6 }]);
    },
  );

  it.each([
    ['checked_in', () => source(COLLEGES.blueRidge.slug)],
    ['protected', protectedOperationalBlueRidge],
  ])('enforces two different Blue Ridge categories in every shared planner for the %s carrier', (_carrier, make) => {
    const document = projection(make(), COLLEGES.blueRidge);
    const runtime = blueRidgeDistinctAreaRuntimeCarrier(document);
    const sections = associateNamedSections(document).filter((section) => (
      section.groupIndex === runtime.group_index
    ));
    const units = new Map(Object.values(BLUE_RIDGE_CATEGORY_COURSES).flat()
      .map((code) => [courseIdFor(code), 3]));
    const temptingSameCategory = new Set(['ART100', 'ART101'].map(courseIdFor));
    const all = new Set(units.keys());
    const categoryById = new Map(Object.entries(BLUE_RIDGE_CATEGORY_COURSES)
      .flatMap(([category, codes]) => codes.map((code) => [courseIdFor(code), category])));

    for (const paperFigure of ['3_4', '6']) {
      const plan = planAssociateDegree(
        sections,
        temptingSameCategory,
        all,
        units,
        {
          strictConstraints: true,
          paperFigure,
          sourceDocument: document,
          totalUnits: 6,
          totalUnitsMax: 6,
          aggregateUnits: 0,
          hasUnitsFill: false,
        },
      );
      expect(plan, paperFigure).toMatchObject({ complete: true, total: 6, warnings: [] });
      expect(plan.ids, paperFigure).toHaveLength(2);
      expect(new Set(plan.ids.map((id) => categoryById.get(id))).size, paperFigure).toBe(2);
    }
  });

  it.each([
    ['checked_in', () => source(COLLEGES.blueRidge.slug)],
    ['protected', protectedOperationalBlueRidge],
  ])('fails the Blue Ridge %s source and projection proof on every material mutation', (_carrier, make) => {
    for (const style of ['accepted_source', 'final_projection']) {
      const documentFor = () => {
        const accepted = make();
        return style === 'accepted_source'
          ? accepted : projection(accepted, COLLEGES.blueRidge);
      };
      const mutations = [
        ['document identity', (document) => {
          document._id = 'as_degree:9999:wrong:local_as';
          document.va_requirement_id = 'va:as:wrong:cs';
          document.community_college_id = 9999;
          document.college_id = 'va:cc:9999';
          document.college_name = 'Wrong College';
        }],
        ['bundle hash', (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); }],
        ['source hash', (document) => { document.sources[0].sha256 = '0'.repeat(64); }],
        ['option-set category', (document) => { document.option_sets.ucgs_block_ii.categories.art.pop(); }],
        ['carrier roster', (document) => {
          constraintOwner(document, 'distinct_ge_areas').owner.sections[0]
            .receivers[0].options.pop();
        }],
        ['course identity', (document) => {
          constraintOwner(document, 'distinct_ge_areas').owner.sections[0]
            .receivers[0].options[0].course_ids[0] += 1;
        }],
        ['selection ask', (document) => {
          constraintOwner(document, 'distinct_ge_areas').owner.sections[0]
            .section_advisement = 9;
        }],
        ['source reference', (document) => {
          constraintOwner(document, 'distinct_ge_areas').owner.source_refs = ['major'];
        }],
        ['constraint declaration', (document) => {
          const constraint = constraintOwner(document, 'distinct_ge_areas').constraint;
          constraint.status = 'unresolved_source_language';
          constraint.minimum_distinct_categories = 1;
        }],
        ['duplicate declaration', (document) => {
          const row = constraintOwner(document, 'distinct_ge_areas');
          row.owner.analysis_constraints.push(structuredClone(row.constraint));
        }],
      ];
      if (style === 'final_projection') {
        mutations.push(['canonical contract', (document) => { delete document.analysis_contract; }]);
      }
      for (const [label, mutate] of mutations) {
        const document = documentFor();
        mutate(document);
        const rows = [];
        const visit = (value) => {
          if (!value || typeof value !== 'object') return;
          if (Array.isArray(value)) return value.forEach(visit);
          for (const constraint of value.analysis_constraints || []) {
            if (constraint.kind === 'distinct_ge_areas') rows.push({ owner: value, constraint });
          }
          Object.entries(value).forEach(([key, child]) => {
            if (key !== 'analysis_constraints') visit(child);
          });
        };
        visit(document.requirement_groups);
        expect(evaluateAssociateCollegeConstraint(rows[0].constraint, {
          owner: rows[0].owner,
          doc: document,
        }), `${style}: ${label}`).toMatchObject({ handled: true, supported: false });
        expect(blueRidgeDistinctAreaRuntimeCarrier(document), `${style}: ${label}`)
          .toMatchObject({ handled: true, ready: false });
      }
    }
  });

  it('does not infer the Blue Ridge rule from labels and fails direct runtime calls without the bound source', () => {
    const document = projection(source(COLLEGES.blueRidge.slug), COLLEGES.blueRidge);
    const row = constraintOwner(document, 'distinct_ge_areas');
    row.owner.title = 'Misleading prose: one course or another';
    row.owner.sections.forEach((section) => { section.label_seen = 'arbitrary label'; });
    expect(proof(document, 'distinct_ge_areas')).toMatchObject({ supported: true });

    const runtime = blueRidgeDistinctAreaRuntimeCarrier(document);
    const sections = associateNamedSections(document).filter((section) => (
      section.groupIndex === runtime.group_index
    ));
    const units = new Map(Object.values(BLUE_RIDGE_CATEGORY_COURSES).flat()
      .map((code) => [courseIdFor(code), 3]));
    const plan = (sourceDocument) => planAssociateDegree(
      sections, new Set(), new Set(units.keys()), units, {
        strictConstraints: true,
        paperFigure: '6',
        sourceDocument,
        totalUnits: 6,
        totalUnitsMax: 6,
        aggregateUnits: 0,
        hasUnitsFill: false,
      },
    );
    expect(plan(null)).toMatchObject({ complete: false });
    const changedSource = structuredClone(document);
    changedSource.sources[0].sha256 = '0'.repeat(64);
    expect(plan(changedSource)).toMatchObject({ complete: false });
  });

  it('binds fixed NOVA GE credits to Figures 3/4 and keeps the incomplete Figure 6 roster closed', () => {
    const accepted = source(COLLEGES.northernVirginia.slug);
    const projected = projection(accepted, COLLEGES.northernVirginia);
    for (const document of [accepted, projected]) {
      expect(proof(document, 'distinct_ge_areas')).toMatchObject({
        handled: true,
        supported: false,
        affected_figures: ['6'],
        proof: {
          minimum_distinct_categories: 2,
          category_names: ['fine_arts', 'humanities', 'literature'],
          aggregate_units: 6,
        },
      });
      expect(proof(document, 'excluded_ge_subject')).toMatchObject({
        handled: true,
        supported: false,
        affected_figures: ['6'],
        proof: { excluded_subjects: ['HIS'], aggregate_units: 3 },
      });
      expect(northernVirginiaFigure34Aggregates(document)).toMatchObject({
        handled: true,
        ready: true,
        total_units: 12,
      });
      expect(auditAssociateDocument(document).summary.ready_by_figure)
        .toEqual({ '3': true, '4': true, '6': false });
    }

    const program = fs.readFileSync(
      retainedPage(COLLEGES.northernVirginia, 'major'), 'utf8',
    );
    expect(program).toMatch(/choose courses from two of the following three areas: Fine Arts, Humanities, and Literature/i);
    expect(program).toMatch(/Credit will not be awarded for taking two courses from the same area/i);
    expect(program).toMatch(/Select a class which is not a History course/i);
  });

  it.each(['accepted_source', 'final_projection'])(
    'fails the NOVA %s proof on source or carrier mutation',
    (style) => {
      const make = () => {
        const accepted = source(COLLEGES.northernVirginia.slug);
        return style === 'accepted_source'
          ? accepted : projection(accepted, COLLEGES.northernVirginia);
      };
      const mutations = [
        ['document identity', (document) => {
          document._id = 'as_degree:9999:wrong:local_as';
          document.va_requirement_id = 'va:as:wrong:cs';
          document.community_college_id = 9999;
          document.college_id = 'va:cc:9999';
          document.college_name = 'Wrong College';
        }, 'distinct_ge_areas'],
        ['bundle hash', (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); }, 'distinct_ge_areas'],
        ['source content hash', (document) => { document.sources[0].sha256 = '0'.repeat(64); }, 'excluded_ge_subject'],
        ['category dictionary', (document) => {
          constraintOwner(document, 'distinct_ge_areas').constraint.category_names = ['fine_arts'];
        }, 'distinct_ge_areas'],
        ['category minimum', (document) => {
          constraintOwner(document, 'distinct_ge_areas').constraint.minimum_distinct_categories = 1;
        }, 'distinct_ge_areas'],
        ['aggregate receivers', (document) => {
          constraintOwner(document, 'distinct_ge_areas').owner.sections[0].receivers.push({ options: [] });
        }, 'distinct_ge_areas'],
        ['excluded subjects', (document) => {
          constraintOwner(document, 'excluded_ge_subject').constraint.excluded_subjects = ['HIS', 'ECO'];
        }, 'excluded_ge_subject'],
        ['duplicate declaration', (document) => {
          const row = constraintOwner(document, 'excluded_ge_subject');
          row.owner.analysis_constraints.push(structuredClone(row.constraint));
        }, 'excluded_ge_subject'],
      ];
      for (const [label, mutate, kind] of mutations) {
        const document = make();
        mutate(document);
        const rows = [];
        const visit = (value) => {
          if (!value || typeof value !== 'object') return;
          if (Array.isArray(value)) return value.forEach(visit);
          for (const constraint of value.analysis_constraints || []) {
            if (constraint.kind === kind) rows.push({ owner: value, constraint });
          }
          Object.entries(value).forEach(([key, child]) => {
            if (key !== 'analysis_constraints') visit(child);
          });
        };
        visit(document.requirement_groups);
        expect(rows.length, label).toBeGreaterThan(0);
        expect(evaluateAssociateCollegeConstraint(rows[0].constraint, {
          owner: rows[0].owner,
          doc: document,
        }), label).toMatchObject({ handled: true, supported: false });
        expect(northernVirginiaFigure34Aggregates(document), label)
          .toMatchObject({ handled: true, ready: false });
      }
    },
  );

  it.each(['accepted_source', 'final_projection'])(
    'replays the protected operational NOVA %s carrier without treating its partial menu as Figure 6-complete',
    (style) => {
      const accepted = protectedOperationalNova();
      const document = style === 'accepted_source'
        ? accepted : projection(accepted, COLLEGES.northernVirginia);
      expect(northernVirginiaFigure34Aggregates(document)).toMatchObject({
        handled: true,
        ready: true,
        total_units: 12,
        proof: { figure_6_roster_complete: false },
      });
      expect(auditAssociateDocument(document).summary.ready_by_figure)
        .toEqual({ '3': true, '4': true, '6': false });

      const figure34Sections = associateNamedSections(document, { paperFigure: '3_4' });
      const figure6Sections = associateNamedSections(document, { paperFigure: '6' });
      const protectedIds = new Set([
        'ART100', 'ART101', 'ART102', 'CST130', 'CST151',
        'MUS121', 'MUS221', 'MUS222', 'MUS226',
      ].map(courseIdFor));
      expect(figure34Sections.flatMap((section) => section.receivers || [])
        .flatMap((receiver) => receiver.options || [])
        .flatMap((option) => option.course_ids || [])
        .some((id) => protectedIds.has(id))).toBe(false);
      if (style === 'final_projection') {
        expect(figure6Sections.flatMap((section) => section.receivers || [])
          .flatMap((receiver) => receiver.options || [])
          .flatMap((option) => option.course_ids || [])
          .some((id) => protectedIds.has(id))).toBe(true);
      }
    },
  );

  it('proves only New River laboratory compatibility and keeps the open variable-credit roster closed', () => {
    const accepted = source(COLLEGES.newRiver.slug);
    const projected = projection(accepted, COLLEGES.newRiver);
    for (const document of [accepted, projected]) {
      expect(proof(document, 'prerequisite_and_sequence_compatibility')).toMatchObject({
        handled: true,
        supported: true,
        affected_figures: ['6'],
        proof: {
          fixed_sections: 2,
          selections_per_section: 1,
          units_per_section: 4,
          deterministic_figure_6_course_codes: ['GOL105', 'PHY241'],
          destination_sequence_is_advisory: true,
          figure_3_4_increment_units: 0,
        },
      });
      expect(newRiverFigure6LaboratorySelection(document)).toMatchObject({
        ready: true,
        course_codes: ['GOL105', 'PHY241'],
      });
      const audit = auditAssociateDocument(document);
      expect(audit.active_blockers.map((row) => row.kind))
        .toEqual(['variable_credit_category_with_sequences']);
      // The defensive service gate counts both the live unsupported rule and
      // the accepted source's cached `constraint_support` failure receipt.
      // Keeping both witnesses is intentional: neither can be used to stamp
      // this still-open degree ready by mutating only one layer.
      expect(unresolvedSourceConflictCount(document)).toBe(2);
      expect(audit.summary.ready_by_figure).toEqual({
        '3': false, '4': false, '6': false,
      });
    }

    const program = fs.readFileSync(retainedPage(COLLEGES.newRiver, 'major'), 'utf8');
    expect(program).toMatch(/Natural Science requirements may be selected from the following: BIO 101-BIO 102.*CHM 111-CHM 112.*PHY 241-PHY 242.*GOL 105/s);
    expect(program).toMatch(/Some four-year degree programs require a two-semester sequence of a single laboratory science/i);
    expect(program).toMatch(/CSC 1XX, CSC 205, World Languages/i);
  });

  it('binds New River Figure 6 selection to exact prerequisite evidence', () => {
    const byCode = new Map(requisiteArtifact.rows.map((row) => [row.code, row]));
    expect(byCode.get('GOL105')).toMatchObject({
      status: 'none',
      explicit_none_evidence: {
        kind: 'structured_vccs_master_record_boundary',
        requisite_clause_count: 0,
      },
    });
    expect(byCode.get('PHY241')).toMatchObject({
      status: 'parsed',
      groups: [{
        kind: 'prerequisite',
        formula: 'paths_or__conditions_and',
        paths: [{ all_of: [{ type: 'course', code: 'MTH263' }] }],
      }],
    });
    expect(byCode.get('PHY241').groups).toHaveLength(1);
    expect(byCode.get('PHY241').groups[0].paths).toHaveLength(1);
    expect(byCode.get('PHY241').groups[0].paths[0].all_of).toHaveLength(1);
  });

  it.each(['accepted_source', 'final_projection'])(
    'fails the New River %s proof on every relevant mutation',
    (style) => {
      const make = () => {
        const accepted = source(COLLEGES.newRiver.slug);
        return style === 'accepted_source'
          ? accepted : projection(accepted, COLLEGES.newRiver);
      };
      const mutations = [
        ['document identity', (document) => {
          document._id = 'as_degree:9999:wrong:local_as';
          document.va_requirement_id = 'va:as:wrong:cs';
          document.community_college_id = 9999;
          document.college_id = 'va:cc:9999';
          document.college_name = 'Wrong College';
        }],
        ['bundle hash', (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); }],
        ['program hash', (document) => { document.sources[0].sha256 = '0'.repeat(64); }],
        ['ask', (document) => {
          constraintOwner(document, 'prerequisite_and_sequence_compatibility')
            .owner.sections[0].section_advisement = 2;
        }],
        ['units', (document) => {
          constraintOwner(document, 'prerequisite_and_sequence_compatibility')
            .owner.sections[0].unit_advisement = 3;
        }],
        ['roster', (document) => {
          constraintOwner(document, 'prerequisite_and_sequence_compatibility')
            .owner.sections[0].receivers[0].options.pop();
        }],
        ['numeric identity', (document) => {
          constraintOwner(document, 'prerequisite_and_sequence_compatibility')
            .owner.sections[0].receivers[0].options[0].course_ids[0] += 1;
        }],
        ['distinctness', (document) => {
          constraintOwner(document, 'prerequisite_and_sequence_compatibility')
            .owner.distinct_course_ids_across_sections = false;
        }],
        ['source reference', (document) => {
          constraintOwner(document, 'prerequisite_and_sequence_compatibility')
            .owner.sections[0].source_refs = ['course_catalog'];
        }],
        ['status', (document) => {
          constraintOwner(document, 'prerequisite_and_sequence_compatibility')
            .constraint.status = 'unresolved_source_language';
        }],
        ['duplicate', (document) => {
          const row = constraintOwner(document, 'prerequisite_and_sequence_compatibility');
          row.owner.analysis_constraints.push(structuredClone(row.constraint));
        }],
      ];
      for (const [label, mutate] of mutations) {
        const document = make();
        mutate(document);
        const rows = [];
        const visit = (value) => {
          if (!value || typeof value !== 'object') return;
          if (Array.isArray(value)) return value.forEach(visit);
          for (const constraint of value.analysis_constraints || []) {
            if (constraint.kind === 'prerequisite_and_sequence_compatibility') {
              rows.push({ owner: value, constraint });
            }
          }
          Object.entries(value).forEach(([key, child]) => {
            if (key !== 'analysis_constraints') visit(child);
          });
        };
        visit(document.requirement_groups);
        expect(evaluateAssociateCollegeConstraint(rows[0].constraint, {
          owner: rows[0].owner,
          doc: document,
        }), label).toMatchObject({ handled: true, supported: false });
        expect(newRiverFigure6LaboratorySelection(document), label)
          .toMatchObject({ ready: false });
      }
    },
  );

  it('makes the exact New River Figure 6 selection at the shared planner boundary', () => {
    const accepted = source(COLLEGES.newRiver.slug);
    const document = projection(accepted, COLLEGES.newRiver);
    const units = fixedLocalUnits(document);
    const sections = associateNamedSections(document);
    const common = {
      strictConstraints: true,
      sourceDocument: document,
      // Named requirements contribute 54 credits; the two receiver-less
      // source categories contribute the remaining 7 and stay independently
      // blocked by the open-roster audit.
      totalUnits: 54,
      totalUnitsMax: 54,
      aggregateUnits: 0,
      hasUnitsFill: false,
    };
    const figure6 = planAssociateDegree(
      sections, new Set(), new Set(), units, { ...common, paperFigure: '6' },
    );
    expect(figure6).toMatchObject({ complete: true, total: 54, warnings: [] });
    expect(labIds(figure6.ids)).toEqual(
      NEW_RIVER_FIGURE_6_LAB_CODES.map(courseIdFor).sort((left, right) => left - right),
    );

    const figure34 = planAssociateDegree(
      sections, new Set(), new Set(), units, { ...common, paperFigure: '3_4' },
    );
    expect(figure34).toMatchObject({ complete: true, total: 54, warnings: [] });
    expect(labIds(figure34.ids)).not.toEqual(labIds(figure6.ids));

    const missingSource = planAssociateDegree(
      sections, new Set(), new Set(), units, {
        ...common, paperFigure: '6', sourceDocument: null,
      },
    );
    expect(missingSource).toMatchObject({ complete: false });
    expect(missingSource.warnings.join(' ')).toMatch(/exact New River laboratory rule/i);
  });

  it('keeps Blue Ridge closed with an exact negative source receipt', () => {
    const final = finalNumericProjection().asDegrees.find((document) => (
      document.community_college_id === COLLEGES.blueRidge.numericId
    ));
    for (const document of [source(COLLEGES.blueRidge.slug), final]) {
      expect(proof(document, 'alternative_course_credit_mismatch')).toMatchObject({
        handled: true,
        supported: false,
        affected_figures: ['3', '4', '6'],
        proof: {
          printed_slot_units: 4,
          exact_option_count: BLUE_RIDGE_GENERAL_EDUCATION_CODES.length,
          exact_three_credit_options: BLUE_RIDGE_THREE_CREDIT_GENERAL_EDUCATION_CODES,
          source_conflict_reconciled: false,
          missing_source_fact: expect.stringMatching(/filler|compensating/i),
        },
      });
      expect(auditAssociateDocument(document).summary.ready_by_figure)
        .toEqual({ '3': false, '4': false, '6': false });
    }
    expect(auditAssociateAnalysisQualityFlags(source(COLLEGES.blueRidge.slug)))
      .toContainEqual(expect.objectContaining({
        code: 'general_education_slot_credit_conflict',
        severity: 'block',
        resolved_by_exact_evaluator: false,
      }));

    const program = fs.readFileSync(retainedPage(COLLEGES.blueRidge, 'major'), 'utf8');
    const graduation = fs.readFileSync(
      retainedPage(COLLEGES.blueRidge, 'graduation'), 'utf8',
    );
    expect(program).toMatch(/General Education Electives 4 Credit Hours/i);
    expect(program).toMatch(/CST 100Principles of Public Speaking3/i);
    expect(graduation).toMatch(/fulfill all of the course and credit hour requirements as specified/i);
  });

  it('scopes only Laurel Ridge’s unreconciled maximum away from Figures 3/4', () => {
    const final = finalNumericProjection().asDegrees.find((document) => (
      document.community_college_id === COLLEGES.laurelRidge.numericId
    ));
    for (const document of [source(COLLEGES.laurelRidge.slug), final]) {
      expect(associateConflictProofTreeFingerprint(document))
        .toBe(LAUREL_RIDGE_PROOF_TREE_SHA256);
      expect(proof(document, 'published_maximum_source_conflict')).toMatchObject({
        handled: true,
        supported: false,
        affected_figures: ['6'],
        proof: {
          proof_tree_sha256: LAUREL_RIDGE_PROOF_TREE_SHA256,
          published_units: { minimum: 60, maximum: 64 },
          structured_units: { minimum: 60, maximum: 63 },
          elective_rule: { selected_courses: 2, minimum_units: 5, maximum_units: 8 },
          figure_3_4_denominator_units: 60,
          figure_3_4_feasible_set_change_if_ceiling_is_63: 0,
          source_conflict_reconciled: false,
        },
      });
      const audit = auditAssociateDocument(document);
      expect(audit.active_blockers).toEqual([expect.objectContaining({
        kind: 'published_maximum_source_conflict',
        affected_figures: ['6'],
        remediation: { category: 'targeted_source_research', reason: expect.any(String) },
      })]);
      expect(audit.summary.ready_by_figure).toEqual({
        '3': true, '4': true, '6': false,
      });
    }

    const program = fs.readFileSync(retainedPage(COLLEGES.laurelRidge, 'major'), 'utf8');
    expect(program).toMatch(/Student Development \(1 cr\).*SDV 100.*1 cr.*SDV 101.*1 cr/s);
    expect(program).toMatch(/Elective \(5-8 cr\).*Select two courses/s);
    expect(program).toMatch(/Program Total: 60-64 Credits/i);
  });

  it('makes Laurel Ridge’s Figure 3/4 runtime plan invariant to the loose 64-credit ceiling', () => {
    const document = finalNumericProjection().asDegrees.find((entry) => (
      entry.community_college_id === COLLEGES.laurelRidge.numericId
    ));
    const sections = associateNamedSections(document, { paperFigure: '3_4' });
    const units = laurelRidgeUnits(document);
    const all = new Set(units.keys());
    const common = {
      strictConstraints: true,
      paperFigure: '3_4',
      sourceDocument: document,
      totalUnits: 60,
      aggregateUnits: 0,
      hasUnitsFill: false,
    };
    const publishedCeiling = planAssociateDegree(
      sections, new Set(), all, units, { ...common, totalUnitsMax: 64 },
    );
    const structuredCeiling = planAssociateDegree(
      sections, new Set(), all, units, { ...common, totalUnitsMax: 63 },
    );
    expect(publishedCeiling).toEqual(structuredCeiling);
    expect(publishedCeiling).toMatchObject({ complete: true, total: 60, warnings: [] });
    expect(publishedCeiling.ids).toEqual(expect.arrayContaining([
      courseIdFor('CHM111'), courseIdFor('CHM112'),
      courseIdFor('MTH263'), courseIdFor('MTH264'),
    ]));
  });

  it.each(['accepted_source', 'final_projection'])(
    'fails the Laurel Ridge Figure 3/4 scope proof on every material %s mutation',
    (style) => {
      const final = finalNumericProjection().asDegrees.find((document) => (
        document.community_college_id === COLLEGES.laurelRidge.numericId
      ));
      const make = () => structuredClone(style === 'accepted_source'
        ? source(COLLEGES.laurelRidge.slug) : final);
      const mutations = [
        ['document identity', (document) => {
          document._id = 'as_degree:9999:wrong:local_as';
          document.va_requirement_id = 'va:as:wrong:cs';
          document.community_college_id = 9999;
          document.college_id = 'va:cc:9999';
          document.college_name = 'Wrong College';
        }],
        ['bundle hash', (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); }],
        ['official source hash', (document) => { document.sources[0].sha256 = '0'.repeat(64); }],
        ['published maximum', (document) => { document.unit_audit.published_program_units_maximum = 65; }],
        ['modeled maximum', (document) => { document.unit_audit.modeled_units_maximum = 64; }],
        ['section maximum', (document) => { document.requirement_groups[0].sections[0].unit_advisement_max = 2; }],
        ['course identity', (document) => { document.requirement_groups[0].sections[0].receivers[0].options[0].course_ids[0] += 1; }],
        ['elective roster', (document) => {
          document.requirement_groups.find((group) => (
            group.title === 'Two distinct electives totaling 5-8 credits'
          )).sections[0].receivers.pop();
        }],
        ['constraint text', (document) => {
          constraintRows(document, 'published_maximum_source_conflict')[0]
            .constraint.description = 'changed';
        }],
        ['duplicate constraint', (document) => {
          const row = constraintRows(document, 'published_maximum_source_conflict')[0];
          row.owner.analysis_constraints.push(structuredClone(row.constraint));
        }],
        ['moved constraint', (document) => {
          const [constraint] = document.unit_audit.analysis_constraints.splice(0, 1);
          document.requirement_groups[0].analysis_constraints.push(constraint);
        }],
      ];
      if (style === 'final_projection') {
        mutations.push(['canonical source contract', (document) => {
          delete document.analysis_contract;
        }]);
      }
      for (const [label, mutate] of mutations) {
        const document = make();
        mutate(document);
        const row = constraintRows(document, 'published_maximum_source_conflict')[0];
        expect(evaluateAssociateCollegeConstraint(row.constraint, {
          owner: row.owner, doc: document,
        }), label).toMatchObject({
          handled: true,
          supported: false,
          affected_figures: ['3', '4', '6'],
        });
      }
    },
  );

  it.each(['accepted_source', 'final_projection'])(
    'fails the Blue Ridge negative receipt closed on every material %s mutation',
    (style) => {
      const final = finalNumericProjection().asDegrees.find((document) => (
        document.community_college_id === COLLEGES.blueRidge.numericId
      ));
      const make = () => structuredClone(style === 'accepted_source'
        ? source(COLLEGES.blueRidge.slug) : final);
      const mutations = [
        ['document identity', (document) => {
          document._id = 'as_degree:9999:wrong:local_as';
          document.va_requirement_id = 'va:as:wrong:cs';
          document.community_college_id = 9999;
          document.college_id = 'va:cc:9999';
          document.college_name = 'Wrong College';
        }],
        ['bundle hash', (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); }],
        ['official source hash', (document) => { document.sources[0].sha256 = '0'.repeat(64); }],
        ['printed slot', (document) => {
          constraintRows(document, 'alternative_course_credit_mismatch')[0]
            .owner.sections[0].unit_advisement = 3;
        }],
        ['course roster', (document) => {
          constraintRows(document, 'alternative_course_credit_mismatch')[0]
            .owner.sections[0].receivers[0].options.pop();
        }],
        ['numeric identity', (document) => {
          constraintRows(document, 'alternative_course_credit_mismatch')[0]
            .owner.sections[0].receivers[0].options[0].course_ids[0] += 1;
        }],
        ['option-set roster', (document) => {
          document.option_sets.general_education_elective.courses.pop();
        }],
        ['constraint text', (document) => {
          constraintRows(document, 'alternative_course_credit_mismatch')[0]
            .constraint.description = 'changed';
        }],
        ['duplicate constraint', (document) => {
          const row = constraintRows(document, 'alternative_course_credit_mismatch')[0];
          row.owner.analysis_constraints.unshift(structuredClone(row.constraint));
        }],
      ];
      if (style === 'final_projection') {
        mutations.push(['canonical source contract', (document) => {
          delete document.analysis_contract;
        }]);
      }
      for (const [label, mutate] of mutations) {
        const document = make();
        mutate(document);
        const row = constraintRows(document, 'alternative_course_credit_mismatch')[0];
        const receipt = evaluateAssociateCollegeConstraint(row.constraint, {
          owner: row.owner, doc: document,
        });
        expect(receipt, label).toMatchObject({ handled: true, supported: false });
        expect(receipt.proof?.source_conflict_reconciled, label).not.toBe(false);
      }
    },
  );

  it('keeps every active associate source/final-projection blocker set identical', () => {
    const final = finalNumericProjection();
    expect(final.asDegrees).toHaveLength(19);
    expect(final.degrees).toHaveLength(16);
    expect(final.agreements).toHaveLength(304);
    for (const projected of final.asDegrees) {
      const accepted = sourceDocuments.find((document) => (
        document._id === projected.va_requirement_id
      ));
      expect(accepted, `${projected._id}:source-link`).toBeTruthy();
      for (const figure of ['3', '4', '6']) {
        expect(blockerKeys(projected, figure), `${projected._id}:Figure${figure}`)
          .toEqual(blockerKeys(accepted, figure));
      }
    }
  });
});
