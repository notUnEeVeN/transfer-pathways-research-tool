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
        status: 'required', rule: 'At least 30 credits must be earned in residence.',
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
