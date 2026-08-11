import { describe, expect, it } from 'vitest';
import { courseIdFor } from './courseIdentity';
import { compileDegreeComposition } from './degreeComposition';

describe('Virginia degree composition compiler', () => {
  it('compiles readable AS options and complete course bundles', () => {
    const result = compileDegreeComposition({
      requirement_groups: [{
        title: 'Programming', source_refs: ['major'], sections: [{
          select: 1, units: 4, receivers: [{
            kind: 'cc_course', options: [['CSC222'], ['CSC221', 'CSC223']],
          }],
        }],
      }],
    }, { institutionLevel: 'community_college' });

    const receiver = result.requirement_groups[0].sections[0].receivers[0];
    expect(receiver.options_conjunction).toBe('or');
    expect(receiver.options).toEqual([
      { course_ids: [courseIdFor('CSC222')], course_keys: ['va:CSC222'], course_conjunction: 'and' },
      {
        course_ids: [courseIdFor('CSC221'), courseIdFor('CSC223')],
        course_keys: ['va:CSC221', 'va:CSC223'], course_conjunction: 'and',
      },
    ]);
    expect(result.codes_seen).toEqual(['CSC221', 'CSC222', 'CSC223']);
  });

  it('compiles university course, AND-series, GE, and policy receivers', () => {
    const result = compileDegreeComposition({
      requirement_groups: [{
        title: 'Requirements', requirement_layer: 'major', tier: 'transferable',
        course_level: 'lower_division', cc_articulable: true, source_refs: ['major'],
        sections: [{ select: 1, units: 4, receivers: [
          { kind: 'course', code: 'CS112', units: 4 },
          { kind: 'series', codes: ['CS108', 'CS109'], units: 4 },
        ] }, { select: 1, units: 3, receivers: [
          { kind: 'ge_area', code: 'VA-GE', name: 'Breadth' },
          { kind: 'requirement', name: 'University proficiency' },
        ] }],
      }],
    }, { institutionLevel: 'four_year' });

    const [course, series] = result.requirement_groups[0].sections[0].receivers;
    expect(course.receiving).toEqual({ kind: 'course', parent_id: courseIdFor('CS112'), units: 4 });
    expect(series.receiving).toEqual({
      kind: 'series', conjunction: 'and',
      parent_ids: [courseIdFor('CS108'), courseIdFor('CS109')], units: 4,
    });
    expect(result.codes_seen).toEqual(['CS108', 'CS109', 'CS112']);
  });

  it('retains category metadata and unsupported constraints for CC unit pools', () => {
    const result = compileDegreeComposition({
      requirement_groups: [{
        title: 'Variable transfer electives',
        source_refs: ['major', 'electives'],
        ge_area: 'example_transfer_electives',
        units: 7,
        units_max: 10,
        stated_credits: { min: 7, max: 10 },
        human_review: 'Exact menu retained outside a universal choose-N.',
        analysis_constraints: [{
          kind: 'variable_credit_pool',
          status: 'evaluator_not_implemented',
          description: 'Choose enough distinct courses to reach the credit range.',
        }],
      }],
    }, { institutionLevel: 'community_college' });

    expect(result.requirement_groups[0]).toMatchObject({
      ge_area: 'example_transfer_electives',
      stated_credits: { min: 7, max: 10 },
      human_review: 'Exact menu retained outside a universal choose-N.',
      analysis_constraints: [{ kind: 'variable_credit_pool' }],
      sections: [{ unit_advisement: 7, unit_advisement_max: 10, receivers: [] }],
    });
  });

  it('includes concrete option-dictionary courses in the identity catalog', () => {
    const composition = {
      course_titles: { CSC221: 'Introduction to Problem Solving and Programming' },
      option_sets: {
        transfer_electives: {
          source_refs: ['major'],
          courses: ['CSC 222', 'MTH263'],
          printed_sequences: [['PHY241', 'PHY242']],
          categorical_allowances: ['CSC 1XX', 'World Languages'],
          rule: 'Choose 6-8 credits.',
        },
      },
      requirement_groups: [{
        title: 'Required course',
        source_refs: ['major'],
        sections: [{
          select: 1,
          units: 3,
          source_refs: ['major'],
          receivers: [{ kind: 'cc_course', options: [['CSC221']] }],
        }],
      }],
    };

    const compiled = compileDegreeComposition(composition, { institutionLevel: 'community_college' });
    expect(compiled.codes_seen).toEqual(['CSC221', 'CSC222', 'MTH263', 'PHY241', 'PHY242']);
  });

  it('rejects pseudo codes and implicit section asks', () => {
    expect(() => compileDegreeComposition({
      requirement_groups: [{
        title: 'Bad', source_refs: ['major'], sections: [{
          select: 1, units: 3, receivers: [{ kind: 'course', code: 'TRNS1XX' }],
        }],
      }],
    }, { institutionLevel: 'four_year' })).toThrow(/invalid concrete course code/);

    expect(() => compileDegreeComposition({
      requirement_groups: [{
        title: 'Bad', source_refs: ['major'], sections: [{
          select: null, units: null, receivers: [{ kind: 'course', code: 'CS101' }],
        }],
      }],
    }, { institutionLevel: 'four_year' })).toThrow(/positive integer required/);
  });
});
