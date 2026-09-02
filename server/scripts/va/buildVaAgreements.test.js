import { describe, expect, it } from 'vitest';
import {
  assertDryRunOnly,
  concreteSourceEquivalencies,
  deriveVaAgreements,
  selectedEquivalenciesSha256,
  sourceEquivalenciesSha256,
} from './buildVaAgreements';
import { courseIdFor } from '../../services/virginia/courseIdentity';
import { cachedAcceptedSourcePlan } from '../importVirginiaCatalogDegrees';
import { VA_INSTITUTION_REGISTRY } from '../../services/virginia/institutionIds';
import {
  VIRGINIA_TECH_CSC_PAIR_CONTRACT,
  VIRGINIA_TECH_CSC_PAIR_NOTE,
} from '../../services/analysis/virginiaTechAtomicArticulation';

const edge = (identifier, overrides = {}) => ({
  institution: 'Radford University', identifier, name: identifier, notes: null, ...overrides,
});

const course = (code, articulatesTo) => ({
  course_id: courseIdFor(code),
  course_key: `va:${code}`,
  code,
  source_url: `https://www.transfervirginia.org/course/${code}GUID`,
  offered_by: ['Blue Ridge Community College'],
  articulates_to: articulatesTo,
});

describe('Virginia concrete source-equivalency agreement channel', () => {
  it('fails before any standalone agreement write can be attempted', () => {
    expect(() => assertDryRunOnly([])).not.toThrow();
    expect(() => assertDryRunOnly(['--apply']))
      .toThrow(/standalone Virginia agreement writes are disabled/i);
    expect(() => assertDryRunOnly(['--unknown'])).toThrow(/unknown option/i);
  });

  it('retains every concrete raw pair edge in canonical order with explicit provenance', () => {
    const courses = [
      course('CHM111', [edge('CHEM111'), edge('CHEM101', {
        notes: 'Department approval required',
      })]),
      course('CHM112', [edge('CHEM112', { parent_id: courseIdFor('CHEM112') })]),
      course('BIO101', [edge('BIOL2XX')]),
      course('PHY201', [edge('PHYS111', { parent_id: courseIdFor('BIO101') })]),
      course('ENG111', [edge('ENGL111', { name: 'English Transfer Elective' })]),
      course('MTH161', [edge('MATH111', { parent_id: null })]),
    ];
    const [agreement] = deriveVaAgreements({
      courses,
      degrees: [{
        _id: 'va:degree:radford-university:cs',
        institution_id: 'va:uni:radford-university',
        requirement_groups: [{
          sections: [{ receivers: [{
            receiving: { kind: 'ge_area', code: 'RADFORD-BS-SCIENCE-WITH-LAB' },
            code_seen: 'Natural science',
          }] }],
        }],
      }],
      colleges: [{
        _id: 'va:cc:blue-ridge-community-college',
        name: 'Blue Ridge Community College',
      }],
      universities: [{
        _id: 'va:uni:radford-university', name: 'Radford University',
      }],
    });

    expect(agreement).toMatchObject({
      _id: 'va:agreement:9219:9301',
      source: 'derived from Transfer Virginia course equivalencies × published degree requirements',
      pairing: 'course-equivalency-join',
      derived_from: {
        degree_id: 'va:degree:radford-university:cs',
        supply_edges: 7,
      },
      source_equivalencies_contract: 'va-concrete-supply-edge-v2',
      source_equivalencies_count: 3,
      source_equivalencies_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      selected_equivalencies_contract: 'va-selected-supply-edge-v1',
      selected_equivalencies_count: 0,
      selected_equivalencies_sha256: selectedEquivalenciesSha256([]),
      selected_equivalencies: [],
    });
    expect(agreement.source_equivalencies).toEqual([
      {
        sending_course_id: courseIdFor('CHM112'),
        sending_course_key: 'va:CHM112',
        sending_code: 'CHM112',
        receiving_identifier: 'CHEM112',
        receiving_name: 'CHEM112',
        receiving_notes: null,
        receiving_parent_id: courseIdFor('CHEM112'),
        sending_source_url: 'https://www.transfervirginia.org/course/CHM112GUID',
      },
      {
        sending_course_id: courseIdFor('CHM111'),
        sending_course_key: 'va:CHM111',
        sending_code: 'CHM111',
        receiving_identifier: 'CHEM101',
        receiving_name: 'CHEM101',
        receiving_notes: 'Department approval required',
        receiving_parent_id: courseIdFor('CHEM101'),
        sending_source_url: 'https://www.transfervirginia.org/course/CHM111GUID',
      },
      {
        sending_course_id: courseIdFor('CHM111'),
        sending_course_key: 'va:CHM111',
        sending_code: 'CHM111',
        receiving_identifier: 'CHEM111',
        receiving_name: 'CHEM111',
        receiving_notes: null,
        receiving_parent_id: courseIdFor('CHEM111'),
        sending_source_url: 'https://www.transfervirginia.org/course/CHM111GUID',
      },
    ]);
    expect(agreement.source_equivalencies.some((row) => (
      row.receiving_identifier === 'BIOL2XX'
        || ['PHY201', 'ENG111', 'MTH161'].includes(row.sending_code)
    ))).toBe(false);
    expect(agreement.source_equivalencies_sha256)
      .toBe(sourceEquivalenciesSha256(agreement.source_equivalencies));
  });

  it('preserves duplicate concrete supply observations so exact readers can reject them', () => {
    const entry = {
      identifier: 'CHEM111', receiving_name: 'General Chemistry I',
      receiving_notes_supplied: true, receiving_notes: null,
      receiving_parent_id: null,
      source_url: 'https://www.transfervirginia.org/course/CHM111',
      course_id: courseIdFor('CHM111'), course_key: 'va:CHM111', code: 'CHM111',
    };
    expect(concreteSourceEquivalencies([entry, structuredClone(entry)]))
      .toHaveLength(2);
  });

  it('retains a path-bound receipt for every selected concrete and generic edge', () => {
    const [agreement] = deriveVaAgreements({
      courses: [
        course('CHM111', [edge('CHEM111', { name: 'General Chemistry I' })]),
        course('HIS101', [edge('HIST2XX', {
          name: 'History Transfer Elective',
          notes: 'Consult an advisor before applying this credit.',
        })]),
      ],
      degrees: [{
        _id: 'va:degree:radford-university:cs',
        institution_id: 'va:uni:radford-university',
        requirement_groups: [{ sections: [{ receivers: [
          {
            receiving: { kind: 'course', parent_id: courseIdFor('CHEM111') },
            code_seen: 'CHEM111',
          },
          {
            receiving: { kind: 'ge_area', code: 'HIST2XX' },
            code_seen: 'HIST2XX',
          },
        ] }] }],
      }],
      colleges: [{
        _id: 'va:cc:blue-ridge-community-college',
        name: 'Blue Ridge Community College',
      }],
      universities: [{
        _id: 'va:uni:radford-university', name: 'Radford University',
      }],
    });

    expect(agreement.selected_equivalencies_count).toBe(2);
    expect(agreement.selected_equivalencies_sha256)
      .toBe(selectedEquivalenciesSha256(agreement.selected_equivalencies));
    expect(agreement.selected_equivalencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        requirement_group_index: 0,
        section_index: 0,
        receiver_index: 0,
        option_index: 0,
        sending_code: 'CHM111',
        source_receiving_identifier: 'CHEM111',
        source_receiving_notes_supplied: true,
        source_receiving_notes: null,
      }),
      expect.objectContaining({
        requirement_group_index: 0,
        section_index: 0,
        receiver_index: 1,
        option_index: 0,
        sending_code: 'HIS101',
        source_receiving_identifier: 'HIST2XX',
        source_receiving_notes_supplied: true,
        source_receiving_notes: 'Consult an advisor before applying this credit.',
      }),
    ]));
    // Generic selected supply is deliberately absent from the concrete v2
    // channel, but its exact condition/provenance is no longer lost.
    expect(agreement.source_equivalencies.map((row) => row.sending_code))
      .toEqual(['CHM111']);
  });

  it('derives CSC205+CSC215 as one exact VT option and never promotes a partial or ambiguous edge', () => {
    const sourceDegree = cachedAcceptedSourcePlan().documents.find((document) => (
      document._id
        === 'va:degree:virginia-polytechnic-institute-and-state-university:cs'
    ));
    const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9230);
    const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9307);
    const institutions = {
      colleges: [{ _id: `va:cc:${college.slug}`, name: college.name }],
      universities: [{ _id: `va:uni:${university.slug}`, name: university.name }],
    };
    const exactCourse = (code) => ({
      course_id: courseIdFor(code),
      course_key: `va:${code}`,
      code,
      credits: 3,
      source_url: code === 'CSC205'
        ? 'https://www.transfervirginia.org/course/D37A690E1F9411F082AC0242AC15010A'
        : 'https://www.transfervirginia.org/course/D37A6A2A1F9411F082AC0242AC15010A',
      offered_by: [college.name],
      articulates_to: [{
        institution: university.name,
        identifier: 'CS2505',
        name: 'Intro Computer Organization',
        notes: VIRGINIA_TECH_CSC_PAIR_NOTE,
      }],
    });
    const derive = (courses, degree = sourceDegree) => deriveVaAgreements({
      courses,
      degrees: [degree],
      ...institutions,
    })[0];
    const cs2505 = (agreement) => agreement.requirement_groups[0].sections[1].receivers[0];

    const exact = derive([exactCourse('CSC205'), exactCourse('CSC215')]);
    expect(cs2505(exact)).toMatchObject({
      articulation_status: 'articulated',
      options: [{
        course_ids: [courseIdFor('CSC205'), courseIdFor('CSC215')],
        course_conjunction: 'and',
        source_bound_atomic_articulation: {
          contract: VIRGINIA_TECH_CSC_PAIR_CONTRACT,
          named_application_cap_units: 3,
          residual_elective_credit_supported: false,
        },
      }],
    });
    expect(exact.selected_equivalencies.map((row) => ({
      code: row.sending_code,
      demand: row.demand_index,
      path: [row.requirement_group_index, row.section_index, row.receiver_index],
    }))).toEqual([
      { code: 'CSC205', demand: 0, path: [0, 1, 0] },
      { code: 'CSC215', demand: 1, path: [0, 1, 0] },
    ]);

    const mutations = [
      [exactCourse('CSC205')],
      [exactCourse('CSC215')],
      [exactCourse('CSC205'), exactCourse('CSC215'), exactCourse('CSC205')],
      (() => {
        const changed = exactCourse('CSC205');
        changed.articulates_to[0].notes += ' Changed.';
        return [changed, exactCourse('CSC215')];
      })(),
      (() => {
        const changed = exactCourse('CSC215');
        changed.credits = 4;
        return [exactCourse('CSC205'), changed];
      })(),
      (() => {
        const changed = exactCourse('CSC205');
        changed.articulates_to.push({
          institution: university.name,
          identifier: 'CS2XXX',
          name: 'Computer Science Transfer Elective',
          notes: null,
        });
        return [changed, exactCourse('CSC215')];
      })(),
    ];
    for (const courses of mutations) {
      expect(cs2505(derive(courses)), JSON.stringify(courses)).toMatchObject({
        articulation_status: 'not_articulated', options: [],
      });
    }

    const treeDrift = structuredClone(sourceDegree);
    treeDrift.requirement_groups[0].sections[1].unit_advisement = 4;
    expect(cs2505(derive([
      exactCourse('CSC205'), exactCourse('CSC215'),
    ], treeDrift))).toMatchObject({
      articulation_status: 'not_articulated', options: [],
    });
  });
});
