import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from './degreeAcceptance';

const source = (id, kind, url) => ({
  id,
  kind,
  label: `${kind} source`,
  url,
});

const section = (units, receivers, refs, select = 1, rest = {}) => ({
  section_advisement: select,
  unit_advisement: units,
  unit_advisement_max: units,
  source_refs: refs,
  receivers,
  ...rest,
});

const templateReceiver = (receiving, rest = {}) => ({
  receiving,
  articulation_status: null,
  options: [],
  options_conjunction: 'or',
  ...rest,
});

function fourYearDoc() {
  return {
    _id: 'va:degree:sample-university:cs',
    kind: 'degree',
    school_id: 'va:uni:sample-university',
    institution_id: 'va:uni:sample-university',
    school: 'Sample University',
    major_slug: 'cs',
    program: 'Computer Science, B.S.',
    degree_variant: 'B.S.',
    catalog_year: '2026-27',
    unit_system: 'semester',
    total_units: 120,
    academic_unit: 'Department of Computer Science',
    ge_authority: 'College of Science',
    source_url: 'https://catalog.sample.edu/programs/computer-science-bs',
    sources: [
      source('major', 'major', 'https://catalog.sample.edu/programs/computer-science-bs'),
      source('ge', 'ge', 'https://catalog.sample.edu/college/general-education'),
      source('graduation', 'graduation', 'https://catalog.sample.edu/policies/graduation'),
    ],
    requirement_layers: {
      major: { status: 'complete', source_refs: ['major'] },
      ge_college: { status: 'complete', source_refs: ['ge'] },
      university_graduation: { status: 'complete', source_refs: ['graduation'] },
    },
    unit_audit: {
      graduation_minimum: 120,
      modeled_units: 120,
      upper_division: {
        status: 'required', minimum_units: 30, modeled_units: 30,
        source_refs: ['graduation'],
      },
      residency: {
        status: 'none_stated', reason: 'No numeric residency rule is stated for this fixture.',
        source_refs: ['graduation'],
      },
    },
    requirement_groups: [
      {
        title: 'Lower-division major preparation',
        requirement_layer: 'major',
        group_conjunction: 'And',
        tier: 'transferable',
        course_level: 'lower_division',
        cc_articulable: true,
        source_refs: ['major'],
        sections: [section(3, [templateReceiver({ kind: 'course', parent_id: 101, units: 3 })], ['major'])],
      },
      {
        title: 'College general education after major overlap',
        requirement_layer: 'ge_college',
        group_conjunction: 'And',
        tier: 'breadth',
        course_level: 'lower_division',
        cc_articulable: true,
        source_refs: ['ge'],
        sections: [section(30, [templateReceiver({
          kind: 'ge_area', parent_id: null, code: 'VA-GE', name: 'Virginia transfer GE',
        })], ['ge'], 10)],
      },
      {
        title: 'Upper-division Computer Science',
        requirement_layer: 'major',
        group_conjunction: 'And',
        tier: 'nontransferable',
        course_level: 'upper_division',
        cc_articulable: false,
        source_refs: ['major'],
        sections: [section(30, [templateReceiver({
          kind: 'requirement', parent_id: null, name: 'Upper-division major block',
        })], ['major'], 1, { cc_articulable: false })],
      },
      {
        title: 'University electives and residence capacity',
        requirement_layer: 'university_graduation',
        group_conjunction: 'And',
        tier: 'nontransferable',
        course_level: 'residency',
        cc_articulable: false,
        source_refs: ['graduation'],
        sections: [section(57, [templateReceiver({
          kind: 'requirement', parent_id: null, name: 'Remaining university credit',
        })], ['graduation'], 1, { cc_articulable: false })],
      },
    ],
  };
}

const asReceiver = (options) => ({
  receiving: null,
  articulation_status: 'articulated',
  options_conjunction: 'or',
  options,
});

const option = (...pairs) => ({
  course_ids: pairs.map(([id]) => id),
  course_keys: pairs.map(([, key]) => key),
  course_conjunction: 'and',
});

function associateDoc() {
  return {
    _id: 'va:as:sample-community-college:cs',
    kind: 'as_degree',
    college_id: 'va:cc:sample-community-college',
    community_college_id: 'va:cc:sample-community-college',
    major_slug: 'cs',
    degree_type: 'AS',
    degree_title_seen: 'Associate of Science in Computer Science',
    catalog_year: '2026-27',
    unit_system: 'semester',
    total_units: 60,
    source: 'institution_catalog',
    catalog_url: 'https://catalog.samplecc.edu/programs/computer-science-as',
    sources: [source(
      'catalog', 'program', 'https://catalog.samplecc.edu/programs/computer-science-as',
    )],
    requirement_groups: [
      {
        title: 'Major requirements',
        group_conjunction: 'And',
        source_refs: ['catalog'],
        sections: [
          section(3, [asReceiver([
            option([201, 'va:CSC221']),
            option([202, 'va:CSC222']),
          ])], ['catalog']),
          section(6, [asReceiver([
            option([203, 'va:MTH263'], [204, 'va:MTH264']),
          ])], ['catalog']),
        ],
      },
      {
        title: 'VCCS general education',
        group_conjunction: 'And',
        ge_area: 'vccs_ge',
        source_refs: ['catalog'],
        sections: [{
          section_advisement: null,
          unit_advisement: 34,
          source_refs: ['catalog'],
          receivers: [],
        }],
      },
      {
        title: 'Electives to the degree minimum',
        group_conjunction: 'And',
        units_fill: true,
        source_refs: ['catalog'],
      },
    ],
  };
}

const clone = (value) => structuredClone(value);
const check = (result, bucket, name) => result[bucket].checks.find((row) => row.name === name);

describe('four-year Virginia degree acceptance', () => {
  it('separates a source-complete catalog verdict from an analysis-ready verdict', () => {
    const result = validateDegreeAcceptance(fourYearDoc(), {
      institutionLevel: 'four_year',
      resolveCourse: ({ side, id }) => side === 'receiving' && id === 101,
    });

    expect(result).toMatchObject({
      level: 'four_year', accepted: true, ready_for_analysis: true,
      catalog: { verdict: 'pass' }, analysis_ready: { verdict: 'pass' },
    });
    expect(check(result, 'catalog', 'four_year_layers').severity).toBe('pass');
    expect(check(result, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 120,
    });
  });

  it('accepts source-backed layers embedded in tagged requirement groups', () => {
    const doc = fourYearDoc();
    delete doc.requirement_layers;
    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'university',
      resolveCourse: ({ id }) => id === 101,
    });

    expect(result.catalog.verdict).toBe('pass');
    expect(check(result, 'catalog', 'four_year_layers').severity).toBe('pass');
  });

  it('accepts a fixed-credit floor only when every choose-N route proves it', () => {
    const doc = fourYearDoc();
    doc.requirement_groups[0].analysis_constraints = [{
      kind: 'minimum_credit_selection',
      status: 'evaluator_not_implemented',
      description: 'Complete at least three credits from this one-course menu.',
    }];
    let result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year',
      resolveCourse: ({ id }) => id === 101,
    });
    expect(check(result, 'analysis_ready', 'constraint_support')).toMatchObject({ severity: 'pass' });

    doc.requirement_groups[0].sections[0].receivers[0].receiving.units = 2;
    result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year',
      resolveCourse: ({ id }) => id === 101,
    });
    const support = check(result, 'analysis_ready', 'constraint_support');
    expect(support).toMatchObject({ severity: 'fail' });
    expect(support.issues[0].evaluator_reason).toMatch(/only 2 credits/);
  });

  it('does not confuse a valid residency declaration with a Figure 3/4 evaluator', () => {
    const doc = fourYearDoc();
    doc.unit_audit.residency = {
      status: 'required',
      minimum_units: 30,
      rule: 'At least 30 credits must be earned in residence.',
      source_refs: ['graduation'],
    };
    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year',
      resolveCourse: ({ id }) => id === 101,
    });
    expect(check(result, 'analysis_ready', 'unit_closure')).toMatchObject({ severity: 'pass' });
    expect(check(result, 'analysis_ready', 'constraint_support')).toMatchObject({
      severity: 'fail',
      issues: [expect.objectContaining({
        path: 'doc.unit_audit.residency',
        kind: 'residency',
        affected_figures: ['3', '4'],
      })],
    });
  });

  it('passes the complete source document into document-bound bachelor evaluators', () => {
    const doc = fourYearDoc();
    doc._id = 'va:degree:james-madison-university:cs';
    doc.school_id = 'va:uni:james-madison-university';
    doc.institution_id = 'va:uni:james-madison-university';
    doc.unit_audit.residency = {
      status: 'required',
      minimum_units: 30,
      rule: 'At least 30 credits at JMU and 60 credits at four-year institutions.',
      source_refs: ['graduation'],
    };
    doc.unit_audit.four_year_institution_units_minimum = 60;
    doc.requirement_groups[3].analysis_constraints = [{
      kind: 'overlapping_residency_rules',
      status: 'evaluator_not_implemented',
      description: 'The exact structured JMU residency limits overlap.',
    }];

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year',
      resolveCourse: ({ id }) => id === 101,
    });

    expect(check(result, 'analysis_ready', 'constraint_support')).toMatchObject({
      severity: 'pass',
    });
  });

  it('does not let an unselected preserved variant block the selected degree', () => {
    const doc = fourYearDoc();
    doc.requirement_variants = [{
      key: 'unselected_concentration',
      selected: false,
      requirement_groups: [{
        analysis_constraints: [{
          kind: 'approved_special_topics',
          status: 'evaluator_not_implemented',
        }],
      }],
    }];
    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year',
      resolveCourse: ({ id }) => id === 101,
    });
    expect(check(result, 'analysis_ready', 'constraint_support')).toMatchObject({ severity: 'pass' });
  });

  it('does not ignore a selected variant that carries its own requirement tree', () => {
    const doc = fourYearDoc();
    doc.requirement_variants = [{
      key: 'selected_concentration',
      selected: true,
      analysis_constraints: [{
        kind: 'selected_track_residency',
        status: 'evaluator_not_implemented',
      }],
      requirement_groups: [{
        analysis_constraints: [{
          kind: 'approved_special_topics',
          status: 'evaluator_not_implemented',
        }],
      }],
    }];
    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year',
      resolveCourse: ({ id }) => id === 101,
    });
    expect(check(result, 'analysis_ready', 'constraint_support')).toMatchObject({
      severity: 'fail',
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: 'doc.requirement_variants[0].analysis_constraints[0]',
          kind: 'selected_track_residency',
        }),
        expect.objectContaining({
          path: 'doc.requirement_variants[0].requirement_groups[0].analysis_constraints[0]',
          kind: 'approved_special_topics',
        }),
      ]),
    });
  });

  it('honors explicit catalog and analysis quality blockers without treating review as a block', () => {
    const resolveCourse = ({ id }) => id === 101;
    const catalogBlocked = fourYearDoc();
    catalogBlocked.data_quality_flags = [{
      code: 'source_arithmetic_conflict',
      severity: 'block_catalog_acceptance',
      message: 'The official subtotals conflict.',
    }];
    let result = validateDegreeAcceptance(catalogBlocked, {
      institutionLevel: 'four_year', resolveCourse,
    });
    expect(check(result, 'catalog', 'source_quality')).toMatchObject({ severity: 'fail' });
    expect(check(result, 'analysis_ready', 'analysis_quality_flags'))
      .toMatchObject({ severity: 'fail' });
    expect(result.accepted).toBe(false);

    const analysisBlocked = fourYearDoc();
    analysisBlocked.data_quality_flags = [{
      code: 'attribute_evaluator_required',
      severity: 'block_analysis',
      message: 'A source-authored attribute rule has no evaluator.',
    }];
    result = validateDegreeAcceptance(analysisBlocked, {
      institutionLevel: 'four_year', resolveCourse,
    });
    expect(check(result, 'catalog', 'source_quality')).toMatchObject({ severity: 'pass' });
    expect(check(result, 'analysis_ready', 'analysis_quality_flags'))
      .toMatchObject({ severity: 'fail' });
    expect(result.accepted).toBe(true);
    expect(result.ready_for_analysis).toBe(false);

    analysisBlocked.data_quality_flags[0].severity = 'block';
    result = validateDegreeAcceptance(analysisBlocked, {
      institutionLevel: 'four_year', resolveCourse,
    });
    expect(check(result, 'catalog', 'source_quality')).toMatchObject({ severity: 'pass' });
    expect(check(result, 'analysis_ready', 'analysis_quality_flags'))
      .toMatchObject({ severity: 'fail' });
    expect(result.accepted).toBe(true);
    expect(result.ready_for_analysis).toBe(false);

    analysisBlocked.data_quality_flags[0].severity = 'review';
    result = validateDegreeAcceptance(analysisBlocked, {
      institutionLevel: 'four_year', resolveCourse,
    });
    expect(check(result, 'analysis_ready', 'analysis_quality_flags'))
      .toMatchObject({ severity: 'pass' });
    expect(result.ready_for_analysis).toBe(true);
  });

  it('rejects unofficial/duplicate sources and dangling source refs', () => {
    const doc = fourYearDoc();
    doc.sources[1] = {
      id: 'major', kind: 'ge', label: 'Unsecured mirror', url: 'http://example.com/ge',
    };
    doc.requirement_groups[1].source_refs = ['missing'];

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year', resolveCourse: () => true,
    });

    expect(result.accepted).toBe(false);
    expect(check(result, 'catalog', 'official_sources')).toMatchObject({ severity: 'fail' });
    expect(check(result, 'catalog', 'source_references')).toMatchObject({ severity: 'fail' });
  });

  it('allows empty refs only on an explicitly not-applicable captured layer', () => {
    const notApplicable = fourYearDoc();
    notApplicable.capture_layers = {
      college: { status: 'not_applicable', source_refs: [] },
    };
    const accepted = validateDegreeAcceptance(notApplicable, {
      institutionLevel: 'four_year', resolveCourse: ({ id }) => id === 101,
    });
    expect(check(accepted, 'catalog', 'source_references')).toMatchObject({ severity: 'pass' });

    const missingRequiredRefs = clone(notApplicable);
    missingRequiredRefs.capture_layers.college.status = 'captured';
    const rejectedEmpty = validateDegreeAcceptance(missingRequiredRefs, {
      institutionLevel: 'four_year', resolveCourse: ({ id }) => id === 101,
    });
    expect(check(rejectedEmpty, 'catalog', 'source_references')).toMatchObject({ severity: 'fail' });

    const danglingNotApplicable = clone(notApplicable);
    danglingNotApplicable.capture_layers.college.source_refs = ['missing'];
    const rejectedUnknown = validateDegreeAcceptance(danglingNotApplicable, {
      institutionLevel: 'four_year', resolveCourse: ({ id }) => id === 101,
    });
    expect(check(rejectedUnknown, 'catalog', 'source_references')).toMatchObject({ severity: 'fail' });
  });

  it('requires all three catalog layers and their organizational owners', () => {
    const doc = fourYearDoc();
    delete doc.requirement_layers.ge_college;
    delete doc.ge_authority;
    doc.requirement_groups[1].source_refs = ['major'];

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year', resolveCourse: () => true,
    });

    expect(check(result, 'catalog', 'four_year_layers')).toMatchObject({ severity: 'fail' });
    expect(result.ready_for_analysis).toBe(false);
  });

  it('requires a dated catalog title, published total, and primary official URL', () => {
    const doc = fourYearDoc();
    doc.catalog_year = null;
    doc.program = '';
    doc.total_units = null;
    doc.source_url = 'https://catalog.sample.edu/programs/not-in-the-registry';

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year', resolveCourse: () => true,
    });

    expect(check(result, 'catalog', 'catalog_metadata')).toMatchObject({ severity: 'fail' });
    expect(result.catalog_structural.verdict).toBe('fail');
  });

  it('allows the host-exact current UVA Wise HTTP catalog exception', () => {
    const doc = fourYearDoc();
    const currentProgram = 'http://catalog.uvawise.edu/preview_program.php?catoid=9&poid=1199';
    doc.source_url = currentProgram;
    doc.sources[0].url = currentProgram;

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year', resolveCourse: ({ id }) => id === 101,
    });

    expect(result.catalog.verdict).toBe('pass');
    expect(check(result, 'catalog', 'official_sources')).toMatchObject({ severity: 'pass' });
  });

  it('does not promote a catalog record whose unit audit or policy declarations are incomplete', () => {
    const doc = fourYearDoc();
    doc.unit_audit.modeled_units = 117;
    doc.unit_audit.upper_division.modeled_units = 24;
    delete doc.unit_audit.residency;

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year', resolveCourse: () => true,
    });

    expect(result.catalog.verdict).toBe('pass');
    expect(result.analysis_ready.verdict).toBe('fail');
    expect(check(result, 'analysis_ready', 'unit_closure').issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'unit_audit.modeled_units' }),
      expect.objectContaining({ field: 'upper_division' }),
      expect.objectContaining({ field: 'residency' }),
    ]));
  });

  it('rejects OR-in-series encoding, non-explicit section asks, and unresolved parent ids', () => {
    const doc = fourYearDoc();
    const first = doc.requirement_groups[0].sections[0];
    delete first.section_advisement;
    first.receivers[0].receiving = {
      kind: 'series', conjunction: 'or', parent_ids: [101, 102], parent_id: null,
    };

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year',
      resolveCourse: ({ id }) => id === 101,
    });

    expect(check(result, 'analysis_ready', 'requirement_structure').severity).toBe('fail');
    expect(check(result, 'analysis_ready', 'choice_semantics').severity).toBe('fail');
    expect(check(result, 'analysis_ready', 'course_resolution').severity).toBe('fail');
  });

  it('does not disguise an unresolved catalog code as a university-only requirement', () => {
    const doc = fourYearDoc();
    doc.requirement_groups[2].sections[0].receivers[0].receiving.name = 'CS 499 (no catalog articulation)';

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year', resolveCourse: () => true,
    });

    expect(check(result, 'analysis_ready', 'unresolved_courses')).toMatchObject({ severity: 'fail' });
  });

  it('rejects sample-plan and accelerated-program contamination', () => {
    const doc = fourYearDoc();
    doc.requirement_groups[0].source_text = ['Suggested Schedule — First Year'];
    doc.program = 'Accelerated Computer Science B.S./M.S.';

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year', resolveCourse: () => true,
    });

    expect(check(result, 'catalog', 'catalog_scope')).toMatchObject({ severity: 'fail' });
    expect(result.ready_for_analysis).toBe(false);
  });

  it('keeps exact unsupported constraints in the catalog but blocks analysis readiness', () => {
    const doc = fourYearDoc();
    doc.requirement_groups[0].analysis_constraints = [{
      kind: 'distinct_courses_across_sections',
      status: 'evaluator_not_implemented',
      description: 'Selections in the two menus must be different courses.',
    }];

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year', resolveCourse: ({ id }) => id === 101,
    });

    expect(result.accepted).toBe(true);
    expect(result.ready_for_analysis).toBe(false);
    expect(check(result, 'analysis_ready', 'constraint_support')).toMatchObject({ severity: 'fail' });
  });

  it('does not treat associate-only evaluator support as four-year support', () => {
    const doc = fourYearDoc();
    doc.requirement_groups[0].analysis_constraints = [{
      kind: 'no_double_count_across_requirement_slots',
      status: 'supported',
    }];

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'four_year', resolveCourse: ({ id }) => id === 101,
    });

    expect(result.accepted).toBe(true);
    expect(result.ready_for_analysis).toBe(false);
    expect(check(result, 'analysis_ready', 'constraint_support')).toMatchObject({ severity: 'fail' });
  });
});

describe('Virginia associate-degree acceptance', () => {
  const registry = new Map([
    [201, 'va:CSC221'], [202, 'va:CSC222'], [203, 'va:MTH263'], [204, 'va:MTH264'],
  ]);
  const resolveCourse = ({ id, key }) => registry.get(id) === key;

  it('accepts explicit alternatives, an AND sequence, GE, and one residual fill group', () => {
    const result = validateDegreeAcceptance(associateDoc(), {
      institutionLevel: 'community_college', resolveCourse,
    });

    expect(result).toMatchObject({ accepted: true, ready_for_analysis: true });
    expect(check(result, 'analysis_ready', 'choice_semantics').severity).toBe('pass');
    expect(check(result, 'analysis_ready', 'course_resolution').detail).toContain('4 referenced course identities resolve');
    expect(check(result, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 60,
    });
  });

  it('accepts only the associate constraint primitives the planner evaluates', () => {
    const supported = associateDoc();
    supported.requirement_groups[0].distinct_course_ids_across_sections = true;
    supported.requirement_groups[0].analysis_constraints = [
      { kind: 'complete_one_route', status: 'evaluator_not_implemented' },
      { kind: 'no_double_count_across_requirement_slots', status: 'evaluator_not_implemented' },
      { kind: 'variable_choice_count_with_minimum_units', status: 'evaluator_not_implemented' },
    ];

    const accepted = validateDegreeAcceptance(supported, {
      institutionLevel: 'community_college', resolveCourse,
    });
    expect(accepted.ready_for_analysis).toBe(true);
    expect(check(accepted, 'analysis_ready', 'constraint_support')).toMatchObject({ severity: 'pass' });

    const adviserChoice = associateDoc();
    adviserChoice.requirement_groups[0].analysis_constraints = [{
      kind: 'advisor_approved_open_roster',
      status: 'supported',
    }];
    const rejected = validateDegreeAcceptance(adviserChoice, {
      institutionLevel: 'community_college', resolveCourse,
    });
    expect(rejected.ready_for_analysis).toBe(false);
    expect(check(rejected, 'analysis_ready', 'constraint_support')).toMatchObject({ severity: 'fail' });

    const unresolved = associateDoc();
    unresolved.requirement_groups[0].analysis_constraints = [{
      kind: 'no_double_count_across_requirement_slots',
      status: 'unresolved_source_language',
    }];
    const unresolvedResult = validateDegreeAcceptance(unresolved, {
      institutionLevel: 'community_college', resolveCourse,
    });
    expect(unresolvedResult.ready_for_analysis).toBe(false);
    expect(check(unresolvedResult, 'analysis_ready', 'constraint_support'))
      .toMatchObject({ severity: 'fail' });
  });

  it('requires a complete machine-readable category dictionary for named distinct-area choices', () => {
    const doc = associateDoc();
    doc.requirement_groups[0] = {
      title: 'Two source-defined categories',
      group_conjunction: 'And',
      source_refs: ['catalog'],
      distinct_course_ids_across_sections: true,
      analysis_constraints: [{
        kind: 'distinct_ge_areas',
        status: 'supported',
        minimum_distinct_categories: 2,
        category_subjects: {
          programming: ['CSC'],
          mathematics: ['MTH'],
        },
      }],
      sections: [
        section(3, [asReceiver([
          option([201, 'va:CSC221']), option([203, 'va:MTH263']),
        ])], ['catalog']),
        section(3, [asReceiver([
          option([202, 'va:CSC222']), option([204, 'va:MTH264']),
        ])], ['catalog']),
      ],
    };

    const accepted = validateDegreeAcceptance(doc, {
      institutionLevel: 'community_college', resolveCourse,
    });
    expect(check(accepted, 'analysis_ready', 'constraint_support'))
      .toMatchObject({ severity: 'pass' });

    doc.requirement_groups[0].group_conjunction = 'Or';
    const mutuallyExclusive = validateDegreeAcceptance(doc, {
      institutionLevel: 'community_college', resolveCourse,
    });
    expect(check(mutuallyExclusive, 'analysis_ready', 'constraint_support'))
      .toMatchObject({ severity: 'fail' });

    doc.requirement_groups[0].group_conjunction = 'And';
    delete doc.requirement_groups[0].analysis_constraints[0].category_subjects;
    const malformed = validateDegreeAcceptance(doc, {
      institutionLevel: 'community_college', resolveCourse,
    });
    expect(check(malformed, 'analysis_ready', 'constraint_support'))
      .toMatchObject({ severity: 'fail' });
  });

  it('accepts explicit category and subject filters on invariant aggregate GE units', () => {
    const doc = associateDoc();
    const ge = doc.requirement_groups[1];
    ge.distinct_areas = 2;
    ge.analysis_constraints = [
      {
        kind: 'distinct_ge_areas',
        status: 'supported',
        evaluation_scope: 'aggregate_ge_units',
        minimum_distinct_categories: 2,
        category_names: ['fine_arts', 'humanities', 'literature'],
      },
      {
        kind: 'excluded_ge_subject',
        status: 'supported',
        evaluation_scope: 'aggregate_ge_units',
        excluded_subjects: ['HIS'],
      },
    ];

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'community_college', resolveCourse,
    });
    expect(check(result, 'analysis_ready', 'constraint_support'))
      .toMatchObject({ severity: 'pass' });
  });

  it('retains a named GE/category roster instead of forcing it into an aggregate block', () => {
    const doc = associateDoc();
    doc.requirement_groups[1].sections[0] = {
      section_advisement: null,
      unit_advisement: 6,
      source_refs: ['catalog'],
      receivers: [asReceiver([
        option([201, 'va:CSC221']),
        option([202, 'va:CSC222']),
      ])],
    };

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'community_college', resolveCourse,
    });

    expect(check(result, 'catalog', 'requirement_structure')).toMatchObject({ severity: 'pass' });
    expect(check(result, 'analysis_ready', 'choice_semantics')).toMatchObject({ severity: 'pass' });
  });

  it('requires an AS identity and matching Virginia college owner', () => {
    const doc = associateDoc();
    doc.kind = 'degree';
    doc.degree_type = 'BA';
    doc.community_college_id = 'va:cc:another-college';

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'community_college', resolveCourse,
    });

    expect(check(result, 'catalog', 'identity')).toMatchObject({ severity: 'fail' });
    expect(result.accepted).toBe(false);
  });

  it('does not promote a career-oriented AAS to the transfer AS cohort', () => {
    const doc = associateDoc();
    doc.degree_type = 'AAS';
    doc.degree_title_seen = 'Computer Science, Associate of Applied Science';

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'community_college', resolveCourse,
    });

    expect(check(result, 'catalog', 'identity')).toMatchObject({ severity: 'fail' });
    expect(result.accepted).toBe(false);
  });

  it('rejects implicit choices, bad option conjunctions, and id/key mismatches', () => {
    const doc = associateDoc();
    const first = doc.requirement_groups[0].sections[0];
    first.section_advisement = null;
    first.receivers[0].options_conjunction = 'and';
    delete first.receivers[0].options[0].course_conjunction;
    first.receivers[0].options[1].course_keys[0] = 'va:CSC999';

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'community_college', resolveCourse,
    });

    expect(check(result, 'analysis_ready', 'requirement_structure').severity).toBe('fail');
    expect(check(result, 'analysis_ready', 'choice_semantics').severity).toBe('fail');
    expect(check(result, 'analysis_ready', 'course_resolution').severity).toBe('fail');
  });

  it('does not allow ordinary unenumerated groups to masquerade as GE or fill', () => {
    const doc = associateDoc();
    doc.requirement_groups[0].sections[0].receivers = [];
    doc.requirement_groups[1].sections[0].receivers = [asReceiver([option([201, 'va:CSC221'])])];
    doc.requirement_groups[2].sections = [section(17, [], ['catalog'])];

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'community_college', resolveCourse,
    });

    expect(check(result, 'analysis_ready', 'requirement_structure').severity).toBe('fail');
  });

  it('fails unresolved-course arrays even when the remaining tree resolves', () => {
    const doc = associateDoc();
    doc.requirement_groups[0].unresolved_courses_seen = [{ course_code_seen: 'CSC999' }];

    const result = validateDegreeAcceptance(doc, {
      institutionLevel: 'cc', resolveCourse,
    });

    expect(check(result, 'analysis_ready', 'unresolved_courses')).toMatchObject({ severity: 'fail' });
    expect(result.ready_for_analysis).toBe(false);
  });
});
