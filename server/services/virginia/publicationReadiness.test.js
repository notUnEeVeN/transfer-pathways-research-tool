import { describe, expect, it } from 'vitest';
import {
  publicationAudit,
  projectionConservationIssues,
  readinessForProjectedFigures,
  readinessForProjectedSource,
  readinessForSourceFigures,
  readinessForSource,
  requirementInventory,
  vaProjectionIdentityAudit,
} from './publicationReadiness';
import { canonicalSourceContract } from '../analysis/canonicalSourceContract';
import { getMajor, programPairs } from '../../config/majors';
import {
  VA_INSTITUTION_REGISTRY,
  institutionIdentityById,
} from './institutionIds';
import {
  courseIdFor,
  institutionCourseIdentity,
} from './courseIdentity';
import { selectAssociateSources } from '../../scripts/va/buildVaDocuments';

const source = (overrides = {}) => ({
  _id: 'va:as:example:cs',
  kind: 'as_degree',
  status: 'extracted',
  source: 'institution_catalog',
  source_method: 'official_catalog_composition',
  // Source documents retain the accepted analysis receipt; projected
  // associate rows also carry this explicit request-time authorization.
  analysis_ready: true,
  provenance: { source_bundle_hash: 'abc' },
  verification: { verified: true, stale: false },
  acceptance: {
    accepted: true,
    ready_for_analysis: true,
    catalog: { checks: [] },
    analysis_ready: { checks: [] },
  },
  course_titles: { CSC221: 'Introduction to Problem Solving and Programming' },
  requirement_groups: [{
    group_id: 'core',
    label_seen: 'Core',
    group_conjunction: 'And',
    source_refs: ['program'],
    unresolved_courses_seen: [],
    sections: [{
      section_advisement: 1,
      unit_advisement: 3,
      source_refs: ['program'],
      receivers: [{
        receiving: null,
        options: [{ course_ids: [101], course_keys: ['va:CSC221'], course_conjunction: 'and' }],
      }],
    }],
  }],
  ...overrides,
});

function primaryProjectionFixture() {
  const pairs = programPairs(getMajor('va-cs').programs);
  const universities = pairs.map((pair) => institutionIdentityById(pair.school_id, 'four_year'));
  const excludedUniversities = [9234, 9235]
    .map((id) => institutionIdentityById(id, 'four_year'));
  const colleges = VA_INSTITUTION_REGISTRY
    .filter((identity) => identity.level === 'community_college')
    .slice(0, 19);

  const degreeGroup = (parentId, code) => ({
    group_id: 'major_core',
    label_seen: 'Major core',
    group_conjunction: 'And',
    source_refs: ['program'],
    unresolved_courses_seen: [],
    course_level: 'upper_division',
    tier: 'nontransferable',
    cc_articulable: false,
    sections: [{
      section_advisement: 1,
      unit_advisement: 3,
      source_refs: ['program'],
      course_level: 'upper_division',
      tier: 'nontransferable',
      cc_articulable: false,
      receivers: [{
        code_seen: code,
        receiving: { kind: 'course', parent_id: parentId, units: 3 },
        options: [],
        options_conjunction: 'or',
      }],
    }],
  });
  const associateGroup = (courseId) => ({
    group_id: 'associate_core',
    label_seen: 'Associate core',
    group_conjunction: 'And',
    source_refs: ['program'],
    unresolved_courses_seen: [],
    sections: [{
      section_advisement: 1,
      unit_advisement: 60,
      source_refs: ['program'],
      receivers: [{
        receiving: null,
        options_conjunction: 'or',
        options: [{
          course_ids: [courseId],
          course_keys: [`va:SYN${courseId}`],
          course_conjunction: 'and',
        }],
      }],
    }],
  });

  const sourceDocuments = [];
  const projection = {
    institutions: [], courses: [], degrees: [], asDegrees: [], agreements: [],
    withoutEquivalencies: [],
  };
  const parentByUniversity = new Map();
  for (const [index, pair] of pairs.entries()) {
    const identity = universities[index];
    const code = `CS${100 + index}`;
    const receivingIdentity = institutionCourseIdentity(`va:uni:${identity.id}`, code);
    const parentId = receivingIdentity.course_id;
    parentByUniversity.set(identity.id, { parentId, code });
    const sourceId = `va:degree:${identity.slug}:cs`;
    const requirementGroups = [degreeGroup(courseIdFor(code), code)];
    const sourceDegree = source({
      _id: sourceId,
      kind: 'degree',
      institution_id: `va:uni:${identity.slug}`,
      total_units: 3,
      total_units_max: 3,
      unit_system: 'semester',
      unit_audit: {
        graduation_minimum: 3,
        modeled_units: 3,
        upper_division: { status: 'none_stated' },
        residency: { status: 'none_stated' },
      },
      course_titles: { [code]: `${identity.name} ${code}` },
      course_unit_evidence: [{ code, units: 3, min_units: 3, max_units: 3 }],
      requirement_groups: requirementGroups,
    });
    sourceDocuments.push(sourceDegree);
    projection.institutions.push({
      _id: `va:uni:${identity.id}`,
      institution_id: `va:uni:${identity.id}`,
      va_institution_id: `va:inst:${identity.slug}`,
      kind: 'university', source_id: identity.id, name: identity.name, state: 'va',
    });
    projection.courses.push({
      _id: `va:receiving:${parentId}`,
      side: 'receiving', source_id: parentId, parent_id: parentId,
      source_parent_id: courseIdFor(code),
      institution_id: `va:uni:${identity.id}`,
      code, course_key: receivingIdentity.course_key,
      identity_scope: 'institution_local', identity_contract: 'owner_plus_course_id',
      vccs_master_applicable: false,
      prefix: 'CS', number: String(100 + index), title: `${identity.name} ${code}`,
      units: 3, min_units: 3, max_units: 3, unit_evidence: 'fixture_exact', state: 'va',
    });
    projection.degrees.push({
      ...structuredClone(sourceDegree),
      _id: `degree:${identity.id}:va-cs`,
      kind: 'degree', state: 'va', school_id: identity.id,
      institution_id: `va:uni:${identity.id}`, school: identity.name,
      major_slug: 'va-cs', program: pair.major,
      va_requirement_id: sourceId,
      va_requirement_status: 'extracted',
      analysis_contract: canonicalSourceContract(),
      requirement_groups: [degreeGroup(parentId, code)],
    });
  }

  for (const [index, identity] of excludedUniversities.entries()) {
    const sourceId = `va:degree:${identity.slug}:cs`;
    sourceDocuments.push(source({
      _id: sourceId,
      kind: 'degree',
      institution_id: `va:uni:${identity.slug}`,
      total_units: 3,
      total_units_max: 3,
      unit_system: 'semester',
      unit_audit: {
        graduation_minimum: 3,
        modeled_units: 3,
        upper_division: { status: 'none_stated' },
        residency: { status: 'none_stated' },
      },
      requirement_groups: [degreeGroup(courseIdFor(`CS${900 + index}`), `CS${900 + index}`)],
    }));
    projection.withoutEquivalencies.push({
      degree_id: sourceId,
      reason: 'no published course equivalencies',
    });
  }

  const sendingByCollege = new Map();
  for (const [index, identity] of colleges.entries()) {
    const courseId = 710000 + index;
    sendingByCollege.set(identity.id, courseId);
    const sourceId = `va:as:${identity.slug}:cs`;
    const sourceAssociate = source({
      _id: sourceId,
      kind: 'as_degree',
      community_college_id: `va:cc:${identity.slug}`,
      college_id: `va:cc:${identity.slug}`,
      total_units: 60,
      total_units_max: 60,
      unit_system: 'semester',
      requirement_groups: [associateGroup(courseId)],
    });
    sourceDocuments.push(sourceAssociate);
    projection.institutions.push({
      _id: `va:cc:${identity.id}`,
      institution_id: `va:cc:${identity.id}`,
      va_institution_id: `va:inst:${identity.slug}`,
      kind: 'community_college', source_id: identity.id, name: identity.name, state: 'va',
    });
    projection.courses.push({
      _id: `va:sending:${courseId}`,
      side: 'sending', source_id: courseId, course_id: courseId,
      course_key: `va:SYN${courseId}`, institution_id: 'va:vccs',
      code: `SYN${index}`, prefix: 'SYN', number: String(index), state: 'va',
    });
    projection.asDegrees.push({
      ...structuredClone(sourceAssociate),
      _id: `as_degree:${identity.id}:va-cs:local_as`,
      kind: 'as_degree', status: 'found', state: 'va',
      community_college_id: identity.id,
      college_id: `va:cc:${identity.id}`,
      college_name: identity.name,
      major_slug: 'va-cs', degree_type: 'local_as',
      va_requirement_id: sourceId,
      va_requirement_status: 'extracted',
      analysis_contract: canonicalSourceContract(),
    });
  }

  const selectedAssociates = sourceDocuments.filter((doc) => doc.kind === 'as_degree');
  const alternateAssociates = selectedAssociates.slice(0, 5).map((selected, index) => ({
    ...structuredClone(selected),
    _id: `${selected._id}:legacy-${index + 1}`,
    source: 'transferva_program_map',
    source_method: null,
    verification: { verified: false, stale: false },
  }));
  sourceDocuments.push(...alternateAssociates);
  projection.associateSourceDispositions = selectAssociateSources([
    ...selectedAssociates,
    ...alternateAssociates,
  ]).dispositions;

  for (const [universityIndex, pair] of pairs.entries()) {
    const university = universities[universityIndex];
    for (const college of colleges) {
      const { parentId, code } = parentByUniversity.get(university.id);
      const courseId = sendingByCollege.get(college.id);
      projection.agreements.push({
        _id: `va:agreement:${university.id}:${college.id}`,
        state: 'va',
        uc_school_id: university.id,
        community_college_id: college.id,
        university_id: `va:uni:${university.slug}`,
        college_id: `va:cc:${college.slug}`,
        major: pair.major,
        source_named_offerings_contract: 'va-associate-requirement-course-offer-v1',
        source_named_offerings_count: 0,
        source_named_offerings_sha256:
          '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
        source_named_offerings: [],
        requirement_groups: [{
          group_conjunction: 'And',
          sections: [{ receivers: [{
            code_seen: code,
            receiving: { kind: 'course', parent_id: parentId },
            options: [{ course_ids: [courseId], course_conjunction: 'and' }],
          }] }],
        }],
      });
    }
  }

  return { sourceDocuments, projection };
}

describe('Virginia publication readiness', () => {
  it('detects a dropped requirement, course reference, unit fact, or title map', () => {
    const before = source();
    const after = structuredClone(before);
    after.requirement_groups = [];
    expect(projectionConservationIssues(before, after).map((issue) => issue.field))
      .toEqual(expect.arrayContaining([
        'groups', 'sections', 'receivers', 'options', 'course_references',
        'unit_facts', 'group_semantics', 'section_semantics',
        'receiver_semantics', 'option_semantics',
      ]));

    const withoutTitles = structuredClone(before);
    delete withoutTitles.course_titles;
    expect(projectionConservationIssues(before, withoutTitles))
      .toContainEqual(expect.objectContaining({ field: 'course_titles' }));
  });

  it('conserves degree totals, maximums, unit audits, and the executable acceptance receipt', () => {
    const before = source({
      total_units: 60,
      total_units_max: 62,
      unit_audit: { graduation_minimum: 60 },
    });
    const after = structuredClone(before);
    after.total_units = 0;
    delete after.total_units_max;
    delete after.unit_audit;
    after.acceptance = { accepted: true, ready_for_analysis: false };
    expect(projectionConservationIssues(before, after).map((issue) => issue.field))
      .toEqual(expect.arrayContaining([
        'total_units', 'total_units_max', 'unit_audit', 'acceptance_receipt',
      ]));
  });

  it('audits stable institution ids and configured programs, not counts alone', () => {
    const pairs = programPairs(getMajor('va-cs').programs);
    const sources = pairs.map((pair) => {
      const identity = institutionIdentityById(pair.school_id, 'four_year');
      return {
        _id: `va:degree:${identity.slug}:cs`,
        institution_id: `va:uni:${identity.slug}`,
      };
    });
    const degrees = pairs.map((pair) => {
      const identity = institutionIdentityById(pair.school_id, 'four_year');
      return {
        va_requirement_id: `va:degree:${identity.slug}:cs`,
        school_id: identity.id,
        institution_id: `va:uni:${identity.id}`,
        school: identity.name,
        program: pair.major,
      };
    });
    const institutions = pairs.map((pair) => {
      const identity = institutionIdentityById(pair.school_id, 'four_year');
      return {
        _id: `va:uni:${identity.id}`,
        institution_id: `va:uni:${identity.id}`,
        source_id: identity.id,
        va_institution_id: `va:inst:${identity.slug}`,
        kind: 'university',
        name: identity.name,
      };
    });
    expect(vaProjectionIdentityAudit(sources, { degrees, institutions })).toMatchObject({
      ready: true, issues: [],
    });

    const reordered = structuredClone({ degrees, institutions });
    reordered.degrees[0].school_id = reordered.degrees[1].school_id;
    reordered.degrees[0].institution_id = reordered.degrees[1].institution_id;
    reordered.institutions[0].name = 'ZZZ renamed institution';
    const audit = vaProjectionIdentityAudit(sources, reordered);
    expect(audit.ready).toBe(false);
    expect(audit.issues.map((row) => row.code)).toEqual(expect.arrayContaining([
      'degree_numeric_identity_mismatch',
      'duplicate_program_identity',
      'configured_program_missing',
      'institution_registry_name_mismatch',
    ]));
  });

  it('allows wrapper ids to be reminted while requiring identical source course codes', () => {
    const before = source();
    const after = structuredClone(before);
    after.requirement_groups[0].sections[0].receivers[0].options[0].source_course_keys
      = ['va:CSC221'];
    after.requirement_groups[0].sections[0].receivers[0].options[0].course_keys = ['cc:101'];
    expect(projectionConservationIssues(before, after)).toEqual([]);

    after.requirement_groups[0].sections[0].receivers[0].options[0].course_ids = [1200000102];
    after.requirement_groups[0].sections[0].receivers[0].options[0].source_course_keys
      = ['va:cc:example:CSC221'];
    expect(projectionConservationIssues(before, after)).toEqual([]);

    after.requirement_groups[0].sections[0].receivers[0].options[0].source_course_keys
      = ['va:cc:example:CSC222'];
    expect(projectionConservationIssues(before, after))
      .toContainEqual(expect.objectContaining({ field: 'course_references' }));
  });

  it('detects changed AND/OR semantics even when every count and course id is unchanged', () => {
    const before = source();
    before.requirement_groups[0].sections[0].receivers[0].options_conjunction = 'or';
    const after = structuredClone(before);
    after.requirement_groups[0].sections[0].receivers[0].options_conjunction = 'and';
    after.requirement_groups[0].sections[0].receivers[0].options[0].course_conjunction = 'or';

    expect(projectionConservationIssues(before, after).map((issue) => issue.field))
      .toEqual(expect.arrayContaining(['receiver_semantics', 'option_semantics']));
  });

  it('allows additive shared-schema labels but never overwrites an authored label', () => {
    const before = source();
    delete before.requirement_groups[0].group_id;
    delete before.requirement_groups[0].label_seen;
    const after = structuredClone(before);
    after.requirement_groups[0].group_id = 'core';
    after.requirement_groups[0].label_seen = 'Core';
    expect(projectionConservationIssues(before, after)).toEqual([]);

    before.requirement_groups[0].label_seen = 'Authored label';
    expect(projectionConservationIssues(before, after))
      .toContainEqual(expect.objectContaining({ field: 'group_semantics' }));
  });

  it('routes source, model, and human blockers separately', () => {
    const sourceGap = source({
      acceptance: {
        accepted: false,
        ready_for_analysis: false,
        catalog: { checks: [{ name: 'unresolved_courses', severity: 'fail' }] },
        analysis_ready: { checks: [] },
      },
    });
    expect(readinessForSource(sourceGap)).toMatchObject({
      ready: false, route: 'targeted_source_research', requires_scrape: true,
    });

    const modelGap = source({
      acceptance: {
        accepted: true,
        ready_for_analysis: false,
        catalog: { checks: [] },
        analysis_ready: { checks: [{ name: 'constraint_support', severity: 'fail' }] },
      },
    });
    expect(readinessForSource(modelGap)).toMatchObject({
      route: 'model_or_evaluator_work', requires_scrape: false,
    });

    const staleBachelorAcceptance = source({
      kind: 'degree',
      total_units: 3,
      unit_audit: {
        graduation_minimum: 3,
        modeled_units: 3,
        upper_division: { status: 'none_stated' },
        residency: { status: 'none_stated' },
      },
    });
    staleBachelorAcceptance.requirement_groups[0].analysis_constraints = [{
      kind: 'advisor_approval', status: 'evaluator_not_implemented',
    }];
    expect(readinessForSource(staleBachelorAcceptance)).toMatchObject({
      ready: false,
      route: 'model_or_evaluator_work',
      blockers: expect.arrayContaining(['four_year_constraint_evaluator_required']),
      four_year_constraint_audit: {
        summary: expect.objectContaining({
          blocked_active_rules: 1,
          active_rule_remediation: {
            targeted_source_research: 0,
            evaluator_engineering: 1,
            out_of_scope_administrative_rule: 0,
          },
        }),
        blocker_remediation: expect.objectContaining({
          evaluator_engineering: 1,
        }),
        active_blockers: expect.arrayContaining([expect.objectContaining({
          kind: 'advisor_approval',
          remediation: expect.objectContaining({ category: 'evaluator_engineering' }),
        })]),
        inactive_variant_rules: 0,
        unit_audit: expect.any(Array),
        blockers_by_figure: expect.any(Object),
      },
    });

    expect(readinessForSource(staleBachelorAcceptance)
      .four_year_constraint_audit.summary.active_rule_remediation).toEqual({
        targeted_source_research: 0,
        evaluator_engineering: 1,
        out_of_scope_administrative_rule: 0,
      });

    const administrativeOnly = source({
      _id: 'va:degree:administrative-only:cs',
      kind: 'degree',
      total_units: 3,
      unit_audit: {
        graduation_minimum: 3,
        modeled_units: 3,
        upper_division: { status: 'none_stated' },
        residency: { status: 'none_stated' },
      },
    });
    administrativeOnly.requirement_groups[0].analysis_constraints = [{
      kind: 'general_education_assessment', status: 'evaluator_not_implemented',
    }];
    expect(readinessForSource(administrativeOnly)).toMatchObject({
      route: 'scope_or_policy_decision',
      requires_scrape: false,
      actions: ['scope_or_policy_decision'],
    });
    administrativeOnly.acceptance.ready_for_analysis = false;
    administrativeOnly.acceptance.analysis_ready.checks = [{
      name: 'constraint_support', severity: 'fail',
    }];
    expect(readinessForSourceFigures(administrativeOnly, { figures: ['1', '3', '4', '6'] }))
      .toMatchObject({
        ready: true,
        complete_degree_ready: false,
        blockers: [],
        figure_constraint_blockers: [],
      });

    const projectedAdministrative = {
      ...administrativeOnly,
      status: 'found',
      va_requirement_status: 'extracted',
      va_requirement_id: administrativeOnly._id,
      analysis_ready: false,
    };
    expect(readinessForProjectedFigures(projectedAdministrative, { figures: ['1'] }))
      .toMatchObject({ ready: true, complete_degree_ready: false });

    const unknownRule = structuredClone(administrativeOnly);
    unknownRule.requirement_groups[0].analysis_constraints = [{
      kind: 'advisor_approval', status: 'evaluator_not_implemented',
    }];
    expect(readinessForSourceFigures(unknownRule, { figures: ['1'] })).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining(['four_year_constraint_evaluator_required']),
      figure_constraint_blockers: [expect.objectContaining({ kind: 'advisor_approval' })],
    });

    const structuralFailure = structuredClone(administrativeOnly);
    structuralFailure.acceptance.analysis_ready.checks.push({
      name: 'course_resolution', severity: 'fail',
    });
    expect(readinessForSourceFigures(structuralFailure, { figures: ['1'] })).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining(['analysis_acceptance_failed']),
      analysis_failures: ['course_resolution'],
    });

    const sourcePolicyGap = source({
      data_quality_flags: [{
        code: 'catalog_policy_gap', severity: 'block_analysis',
        message: 'The official sources leave the applicable rule unresolved.',
      }],
      acceptance: {
        accepted: true,
        ready_for_analysis: false,
        catalog: { checks: [] },
        analysis_ready: { checks: [{ name: 'analysis_quality_flags', severity: 'fail' }] },
      },
    });
    expect(readinessForSource(sourcePolicyGap)).toMatchObject({
      route: 'targeted_source_research',
      requires_scrape: true,
      blocking_source_research_flags: [{ code: 'catalog_policy_gap' }],
    });

    expect(readinessForSource(source({ verification: { verified: false } })))
      .toMatchObject({ route: 'human_verification', requires_scrape: false });

    const sourceCreditConflict = source({
      unit_audit: {
        analysis_constraints: [{
          kind: 'published_maximum_source_conflict',
          status: 'evaluator_not_implemented',
        }],
      },
      acceptance: {
        accepted: true,
        ready_for_analysis: false,
        catalog: { checks: [] },
        analysis_ready: { checks: [{ name: 'constraint_support', severity: 'fail' }] },
      },
    });
    expect(readinessForSource(sourceCreditConflict)).toMatchObject({
      route: 'targeted_source_research',
      constraint_kinds: ['published_maximum_source_conflict'],
    });
  });

  it('reuses the source gate for projected figure documents and requires a source link', () => {
    const projected = source({
      status: 'found',
      va_requirement_status: 'extracted',
      va_requirement_id: 'va:as:example:cs',
      analysis_ready: true,
    });
    expect(readinessForProjectedSource(projected)).toMatchObject({
      ready: true,
      source_id: 'va:as:example:cs',
      source_bundle_hash: 'abc',
    });

    delete projected.va_requirement_id;
    projected.verification = { verified: true, stale: true };
    expect(readinessForProjectedSource(projected)).toMatchObject({ ready: false });
    expect(readinessForProjectedSource(projected).blockers).toEqual(expect.arrayContaining([
      'source_projection_link_required',
      'current_human_verification_required',
    ]));
  });

  it('publishes by paper figure without relabeling administrative-only gaps as complete-degree ready', () => {
    const administrative = source({
      _id: 'va:degree:figure-scoped:cs',
      kind: 'degree',
      total_units: 3,
      total_units_max: 3,
      analysis_ready: false,
      unit_audit: {
        graduation_minimum: 3,
        modeled_units: 3,
        upper_division: { status: 'none_stated' },
        residency: { status: 'none_stated' },
      },
      acceptance: {
        accepted: true,
        ready_for_analysis: false,
        catalog: { checks: [] },
        analysis_ready: { checks: [{ name: 'constraint_support', severity: 'fail' }] },
      },
    });
    administrative.requirement_groups[0].analysis_constraints = [{
      kind: 'general_education_assessment', status: 'evaluator_not_implemented',
    }];
    const project = (doc) => ({
      ...structuredClone(doc),
      _id: 'degree:9999:va-cs',
      status: 'found',
      state: 'va',
      school_id: 9999,
      school: 'Source-shaped fixture university',
      major_slug: 'va-cs',
      program: 'Computer Science, B.S.',
      va_requirement_id: doc._id,
      va_requirement_status: 'extracted',
      analysis_contract: canonicalSourceContract(),
    });
    const expected = {
      associate_degrees: 0,
      bachelor_degrees: 1,
      active_bachelor_templates: 1,
      agreement_cells: 0,
    };
    const audit = (doc) => publicationAudit({
      sourceDocuments: [doc],
      projection: {
        institutions: [], courses: [], asDegrees: [], degrees: [project(doc)],
        agreements: [], withoutEquivalencies: [],
      },
      figureReadiness: { pathway_complexity: { ready: true } },
      expected,
    });

    const administrativeReport = audit(administrative);
    expect(administrativeReport).toMatchObject({
      publishable: true,
      verdict: 'pass',
      publication_scope: 'paper_figures_1_3_4_6',
      complete_degree_ready: false,
      source_summary: {
        scope: 'complete_degree_analysis_diagnostic',
        total: 1, ready: 0, blocked: 1,
      },
    });
    expect(Object.values(administrativeReport.publication_by_figure))
      .toHaveLength(4);
    expect(Object.values(administrativeReport.publication_by_figure)
      .every((figure) => (
        figure.publishable
        && figure.source_summary.complete_degree_ready === 0
        && figure.projected_source_summary.complete_degree_ready === 0
      ))).toBe(true);
    expect(administrativeReport.paper_figure_failures).toEqual([]);

    const unknownRule = structuredClone(administrative);
    unknownRule.requirement_groups[0].analysis_constraints = [{
      kind: 'advisor_approval', status: 'evaluator_not_implemented',
    }];
    const unknownReport = audit(unknownRule);
    expect(unknownReport.publishable).toBe(false);
    expect(unknownReport.paper_figure_failures.map((row) => row.figure))
      .toEqual(['1', '3', '4', '6']);
    expect(unknownReport.publication_by_figure['3']).toMatchObject({
      publishable: false,
      blockers: expect.arrayContaining([
        'source_readiness_failed', 'projected_source_readiness_failed',
      ]),
      constraint_blockers: expect.arrayContaining([
        expect.objectContaining({ kind: 'advisor_approval' }),
      ]),
    });

    const nonConstraintFailure = structuredClone(administrative);
    nonConstraintFailure.acceptance.analysis_ready.checks.push({
      name: 'course_resolution', severity: 'fail',
    });
    const failureReport = audit(nonConstraintFailure);
    expect(failureReport.publishable).toBe(false);
    expect(failureReport.publication_by_figure['1'].sources[0]).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining(['analysis_acceptance_failed']),
      analysis_failures: ['course_resolution'],
    });
  });

  it('recomputes core unit declarations instead of trusting a stale acceptance receipt', () => {
    const doc = source({
      kind: 'degree',
      total_units: 120,
      unit_audit: {
        graduation_minimum: 120,
        modeled_units: 120,
        upper_division: {
          status: 'required', minimum_units: 30, modeled_units: 30,
        },
        residency: { status: 'none_stated', reason: 'No numeric rule.' },
      },
    });
    doc.requirement_groups[0].course_level = 'lower_division';
    doc.requirement_groups[0].sections[0].course_level = 'lower_division';
    doc.requirement_groups[0].sections[0].unit_advisement = 120;

    expect(readinessForSource(doc)).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining(['four_year_constraint_evaluator_required']),
      four_year_constraint_audit: {
        summary: expect.objectContaining({ blocked_unit_audit_rules: 1 }),
        active_blockers: [expect.objectContaining({
          path: 'unit_audit.upper_division', kind: 'upper_division',
        })],
      },
    });
  });

  it('fails the release on cohort drift or any projection loss', () => {
    const doc = source();
    const projected = { ...structuredClone(doc), va_requirement_id: doc._id };
    const pass = publicationAudit({
      sourceDocuments: [doc],
      figureReadiness: { pathway_complexity: { ready: true } },
      projection: {
        asDegrees: [projected], degrees: [], agreements: [], withoutEquivalencies: [],
      },
      expected: {
        associate_degrees: 1, bachelor_degrees: 0,
        active_bachelor_templates: 0, agreement_cells: 0,
      },
    });
    expect(pass).toMatchObject({
      publishable: true,
      verdict: 'pass',
      projection_schema: { ready: true, skipped: true, issues: [] },
    });

    projected.requirement_groups = [];
    const fail = publicationAudit({
      sourceDocuments: [doc],
      projection: {
        asDegrees: [projected], degrees: [], agreements: [], withoutEquivalencies: [],
      },
      expected: {
        associate_degrees: 1, bachelor_degrees: 0,
        active_bachelor_templates: 0, agreement_cells: 0,
      },
    });
    expect(fail).toMatchObject({ publishable: false, verdict: 'fail' });
    expect(fail.projection_losses).toHaveLength(1);
  });

  it('gates the primary cohort on a referentially closed shared-schema projection', () => {
    const valid = primaryProjectionFixture();
    const pass = publicationAudit({
      ...valid,
      figureReadiness: {
        pathway_complexity: { ready: true },
        transfer_equivalency_conditions: { ready: true, blocker: null },
      },
    });
    expect(pass.publication_by_figure['3'].projected_sources
      .filter((row) => !row.ready)).toEqual([]);
    expect(pass).toMatchObject({
      publishable: true,
      verdict: 'pass',
      projection_schema: {
        ready: true,
        contract: 'shared-analysis-projection-v1',
        issues: [],
      },
    });

    const dangling = primaryProjectionFixture();
    const removed = dangling.projection.courses.find((course) => course.side === 'sending');
    dangling.projection.courses = dangling.projection.courses
      .filter((course) => course !== removed);
    const fail = publicationAudit({
      ...dangling,
      figureReadiness: {
        pathway_complexity: { ready: true },
        transfer_equivalency_conditions: { ready: true, blocker: null },
      },
    });
    expect(fail).toMatchObject({
      publishable: false,
      verdict: 'fail',
      projection_schema: { ready: false },
    });
    expect(fail.projection_schema.issues).toContainEqual(expect.objectContaining({
      code: 'sending_course_reference_missing',
      detail: removed.course_id,
    }));
    // The source documents themselves are still conserved: this failure is
    // specifically the missing shared-schema course row/reference closure.
    expect(fail.projection_losses).toEqual([]);
  });

  it('fails closed when the primary projection omits or fails its selected-equivalency condition audit', () => {
    const valid = primaryProjectionFixture();
    const missing = publicationAudit({
      ...valid,
      figureReadiness: { pathway_complexity: { ready: true } },
    });

    expect(missing.publication_by_figure['1'].publishable).toBe(true);
    for (const figure of ['3', '4', '6']) {
      expect(missing.publication_by_figure[figure]).toMatchObject({
        publishable: false,
        blockers: expect.arrayContaining(['figure_runtime_readiness_failed']),
        runtime_readiness: {
          transfer_equivalency_conditions: {
            ready: false,
            blocker: 'virginia_transfer_equivalency_condition_audit_unavailable',
          },
        },
      });
    }

    const blocked = publicationAudit({
      ...valid,
      figureReadiness: {
        pathway_complexity: { ready: true },
        transfer_equivalency_conditions: {
          ready: false,
          blocker: 'unresolved_selected_equivalency_conditions',
          counts: { cells: 304, ready_cells: 286, blocked_cells: 18 },
        },
      },
    });
    expect(blocked.publishable).toBe(false);
    expect(blocked.figure_failures).toContainEqual(expect.objectContaining({
      figure: 'transfer_equivalency_conditions',
      blocker: 'unresolved_selected_equivalency_conditions',
    }));
    expect(blocked.publication_by_figure['1'].publishable).toBe(true);
    expect(blocked.publication_by_figure['3'].publishable).toBe(false);
  });

  it('fails the release when a course identity does not resolve in its namespace', () => {
    const doc = source();
    const projected = { ...structuredClone(doc), va_requirement_id: doc._id };
    const report = publicationAudit({
      sourceDocuments: [doc],
      projection: { asDegrees: [projected], degrees: [], agreements: [] },
      identityAudit: {
        publication_ready: false,
        stats: { references: 1, resolved: 0, issues: 1 },
        issues: [{ issue: 'course_row_scope_mismatch' }],
      },
      expected: {
        associate_degrees: 1, bachelor_degrees: 0,
        active_bachelor_templates: 0, agreement_cells: 0,
      },
    });
    expect(report).toMatchObject({
      publishable: false,
      course_identity: { publication_ready: false },
    });
  });

  it('accounts for every source as projected or as an explicit no-equivalencies exclusion', () => {
    const bachelor = source({
      _id: 'va:degree:uva:cs',
      kind: 'degree',
      total_units: 120,
      unit_audit: {
        graduation_minimum: 120,
        modeled_units: 120,
        upper_division: {
          status: 'none_stated', reason: 'No aggregate rule in this fixture.',
        },
        residency: {
          status: 'none_stated', reason: 'No numeric rule in this fixture.',
        },
      },
    });
    bachelor.requirement_groups[0].sections[0].unit_advisement = 120;
    const expected = {
      associate_degrees: 0,
      bachelor_degrees: 1,
      active_bachelor_templates: 0,
      agreement_cells: 0,
    };
    const pass = publicationAudit({
      sourceDocuments: [bachelor],
      figureReadiness: { pathway_complexity: { ready: true } },
      projection: {
        asDegrees: [], degrees: [], agreements: [],
        withoutEquivalencies: [{
          degree_id: bachelor._id,
          reason: 'no published course equivalencies',
        }],
      },
      expected,
    });
    expect(pass).toMatchObject({
      publishable: true,
      source_accounting: [{ accounted: true, excluded: 1, projected: 0 }],
    });

    const silentlyDropped = publicationAudit({
      sourceDocuments: [bachelor],
      projection: {
        asDegrees: [], degrees: [], agreements: [], withoutEquivalencies: [],
      },
      expected,
    });
    expect(silentlyDropped).toMatchObject({ publishable: false });
    expect(silentlyDropped.source_accounting_failures[0].issues[0])
      .toMatch(/neither projected nor explicitly excluded/);
  });

  it('accounts for superseded source maps but blocks an unverified replacement of a verified core', () => {
    const official = source({
      _id: 'va:as:example:official',
      community_college_id: 'va:cc:example',
      verification: { verified: false },
    });
    const transferVa = source({
      _id: 'va:as:example:transferva',
      community_college_id: 'va:cc:example',
      source: 'transferva_program_map',
      source_method: null,
      verification: { verified: true, verified_by: 'researcher' },
    });
    transferVa.requirement_groups[0].sections[0].unit_advisement = 4;
    const { dispositions } = selectAssociateSources([official, transferVa]);
    const projected = {
      ...structuredClone(official),
      va_requirement_id: official._id,
    };
    const report = publicationAudit({
      sourceDocuments: [official, transferVa],
      projection: {
        asDegrees: [projected],
        degrees: [],
        agreements: [],
        associateSourceDispositions: dispositions,
      },
      expected: {
        associate_degrees: 1,
        bachelor_degrees: 0,
        active_bachelor_templates: 0,
        agreement_cells: 0,
      },
    });

    expect(report.source_accounting).toHaveLength(2);
    expect(report.source_accounting_failures).toEqual([]);
    expect(report.source_accounting.find((row) => row.id === transferVa._id))
      .toMatchObject({ accounted: true, projected: 0, excluded: 0, superseded: 1 });
    expect(report.associate_source_disposition).toMatchObject({
      ready: false,
      counts: { dispositions: 1, structurally_valid: 1, safe: 0, unsafe: 1 },
      failures: [{
        alternate_source_id: transferVa._id,
        safety_issues: [
          'verified_alternate_replaced_by_unverified_source',
          'verified_alternate_major_core_not_reverified',
        ],
      }],
    });
    expect(report.publication_by_figure['3'].blockers)
      .toContain('associate_source_disposition_failed');

    const tampered = structuredClone(dispositions);
    tampered[0].comparison.alternate_major_core_sha256 = '0'.repeat(64);
    const tamperedReport = publicationAudit({
      sourceDocuments: [official, transferVa],
      projection: {
        asDegrees: [projected], degrees: [], agreements: [],
        associateSourceDispositions: tampered,
      },
      expected: {
        associate_degrees: 1, bachelor_degrees: 0,
        active_bachelor_templates: 0, agreement_cells: 0,
      },
    });
    expect(tamperedReport.associate_source_disposition.failures[0].receipt_issues)
      .toContain('comparison does not match the current source documents');
  });

  it('inventories explicit fills, GE labels, unresolved citations, and duplicate uses', () => {
    const doc = source();
    doc.requirement_groups[0].units_fill = true;
    doc.requirement_groups[0].ge_area = 'UCGS Block II';
    doc.requirement_groups[0].unresolved_courses_seen = [{ code_seen: 'CSC999' }];
    doc.requirement_groups[0].sections[0].receivers.push(
      structuredClone(doc.requirement_groups[0].sections[0].receivers[0]),
    );
    const inventory = requirementInventory(doc);
    expect(inventory).toMatchObject({
      receivers: 2,
      options: 2,
      course_references: ['CSC221', 'CSC221'],
      group_semantics: [{ units_fill: true, ge_area: 'UCGS Block II' }],
      unresolved: [{ values: [{ code_seen: 'CSC999' }] }],
    });
  });

  it('keeps the overall publication gate closed while Virginia Figure 6 lacks both prerequisite namespaces', () => {
    const doc = source();
    const projected = { ...structuredClone(doc), va_requirement_id: doc._id };
    const report = publicationAudit({
      sourceDocuments: [doc],
      projection: { asDegrees: [projected], degrees: [], agreements: [] },
      expected: {
        associate_degrees: 1, bachelor_degrees: 0,
        active_bachelor_templates: 0, agreement_cells: 0,
      },
    });
    expect(report).toMatchObject({
      publishable: false,
      figure_failures: [{
        figure: 'pathway_complexity',
        blocker: 'virginia_figure6_prerequisite_model_unavailable',
      }],
    });
  });
});
