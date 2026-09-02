import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const SLUGS = [
  'old-dominion-university',
  'radford-university',
  'the-university-of-virginia-s-college-at-wise',
];

function load(slug) {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8'));
  const institution = registry.institutions.find((row) => row.slug === slug);
  const extract = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'requirements', `${slug}.json`),
    'utf8',
  ));
  const composition = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'composed', `${slug}.json`),
    'utf8',
  ));
  const credits = new Map();
  const doc = toDocument(extract, institution, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { acceptance, composition, doc, extract, institution };
}

function canonicalUnits(group) {
  const sections = group.sections || [];
  if (String(group.group_conjunction || '').toLowerCase() !== 'or') {
    return sections.reduce((sum, section) => sum + section.unit_advisement, 0);
  }
  const index = Number.isInteger(group.canonical_section_index)
    ? group.canonical_section_index
    : 0;
  return sections[index].unit_advisement;
}

function allRequirementGroups(doc) {
  return [
    ...(doc.requirement_groups || []),
    ...(doc.requirement_variants || []).flatMap((variant) => variant.requirement_groups || []),
  ];
}

function expectConcreteCourseIdentities(doc) {
  for (const group of allRequirementGroups(doc)) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        if (receiver.receiving?.kind === 'course') {
          expect(Number.isSafeInteger(receiver.receiving.parent_id)).toBe(true);
        }
        if (receiver.receiving?.kind === 'series') {
          expect(receiver.receiving.parent_ids.length).toBeGreaterThan(1);
          expect(receiver.receiving.parent_ids.every(Number.isSafeInteger)).toBe(true);
        }
      }
    }
  }
}

describe('ODU, Radford, and UVA Wise 2026-2027 official-source compositions', () => {
  it.each(SLUGS)('%s passes catalog acceptance with explicit constraint blockers', (slug) => {
    const { acceptance, doc, extract } = load(slug);

    expect(extract).toMatchObject({ outcome: 'captured', catalog_year: '2026-2027' });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual(slug === 'radford-university'
      ? ['analysis_quality_flags', 'constraint_support']
      : ['constraint_support']);
    expect(doc.requirement_layers).toMatchObject({
      major: { status: 'complete' },
      ge_college: { status: 'complete' },
      university_graduation: { status: 'complete' },
    });
    expect(doc.requirement_groups.reduce((sum, group) => sum + canonicalUnits(group), 0)).toBe(120);
    expect(doc.unit_audit).toMatchObject({
      graduation_minimum: 120,
      modeled_units: 120,
      upper_division: { status: 'none_stated' },
      residency: { status: 'required' },
    });
    expect(doc.requirement_groups.some((group) => (
      /sample|suggested|semester schedule|plan of study|accelerated|4\s*\+\s*1/i.test(group.title)
    ))).toBe(false);
    expectConcreteCourseIdentities(doc);
  });

  it('closes the standard ODU BSCS as 79 major plus 41 distinct General Education credits', () => {
    const { doc, extract } = load('old-dominion-university');

    expect(extract.sources.map((source) => source.id)).toEqual([
      'major', 'general_education', 'college', 'policy', 'course_catalog',
    ]);
    expect(doc).toMatchObject({
      program: 'Computer Science (BSCS)',
      degree_variant: 'BSCS',
      total_units: 120,
      total_units_max: null,
      college: 'College of Sciences',
      ge_authority: 'Old Dominion University General Education Requirements',
      unit_audit: {
        published_requirement_table_units_minimum: 120,
        published_requirement_table_units_maximum: 134,
        upper_division_general_education_units_minimum: 6,
        upper_level_computer_science_elective_units: 9,
        major_upper_division_residency_minimum: 12,
        residency: { minimum_units: 30 },
        required_non_elective_cs_minimum_grade: 'C',
        senior_assessment_required: true,
      },
    });

    const major = doc.requirement_groups
      .filter((group) => group.requirement_layer === 'major')
      .reduce((sum, group) => sum + canonicalUnits(group), 0);
    const ge = doc.requirement_groups
      .filter((group) => group.requirement_layer === 'ge_college')
      .reduce((sum, group) => sum + canonicalUnits(group), 0);
    expect({ major, ge }).toEqual({ major: 79, ge: 41 });

    const upperGe = doc.requirement_groups.find((group) => (
      group.title === 'Upper-Division General Education'
    ));
    expect(upperGe).toMatchObject({
      group_conjunction: 'Or',
      canonical_section_index: 3,
    });
    expect(upperGe.sections.map((section) => section.unit_advisement)).toEqual([12, 12, 6, 6]);
    expect(doc.requirement_groups.find((group) => (
      group.title === 'Language and Culture'
    )).sections.map((section) => section.unit_advisement)).toEqual([0, 6]);
    expect(doc.codes_seen).toEqual(expect.arrayContaining([
      'CS151', 'CS260', 'CS411W', 'CS417', 'CS422', 'CS480', 'MATH212', 'STAT330',
    ]));
    expect(doc.course_titles).toMatchObject({
      COMM101R: 'Public Speaking',
      CS121G: 'Introduction to Information Literacy and Research for Scientists',
      CS202G: 'Information Literacy for Cybersecurity',
      CS367: 'Cooperative Education',
      CS368: 'Computer Science Internship',
      ENGL211C: 'Writing, Rhetoric, and Research',
      ENGL231C: 'Writing, Rhetoric, and Research: Special Topics',
      OEAS110N: 'Earth Science',
      OEAS111N: 'Physical Geology',
      OEAS112N: 'Historical Geology',
      PHIL160R: 'Raising Moral Issues in STEM',
    });
    expect(doc.requirement_groups.find((group) => (
      group.title === 'Major grade and university assessment completion gates'
    )).sections.map((section) => section.unit_advisement)).toEqual([0, 0]);
  });

  it('preserves Radford’s no-concentration route and all five mutually exclusive concentrations', () => {
    const { composition, doc, extract } = load('radford-university');

    expect(extract.sources.map((source) => source.id)).toEqual([
      'major', 'general_education', 'college', 'graduation', 'policy', 'course_catalog',
    ]);
    expect(doc).toMatchObject({
      program: 'Computer Science, B.S. (R, L)',
      degree_variant: 'BS',
      total_units: 120,
      college: 'Artis College of Science and Technology',
      ge_authority: 'Radford University REAL Curriculum',
      unit_audit: {
        canonical_major_units: 55,
        canonical_real_units_inside_major: 18,
        canonical_remaining_real_capacity: 30,
        canonical_unrestricted_capacity: 35,
        base_path_upper_level_cs_units: 12,
        residency: { minimum_units: 30 },
      },
    });
    expect(doc.requirement_variants.map((variant) => [variant.key, variant.selected])).toEqual([
      ['base_no_concentration', true],
      ['advanced_computer_science', false],
      ['advanced_database', false],
      ['advanced_networks', false],
      ['advanced_software_engineering', false],
      ['advanced_artificial_intelligence', false],
    ]);
    const networks = composition.requirement_variants.find((variant) => (
      variant.key === 'advanced_networks'
    ));
    expect(networks).toMatchObject({
      published_concentration_units_minimum: 21,
      named_rows_units_minimum: 24,
      named_rows_units_maximum: 25,
      canonical_major_units_from_named_rows: 67,
    });
    expect(networks.source_conflict).toMatch(/printed 21-credit subtotal/i);
    const advanced = doc.requirement_variants.find((variant) => (
      variant.key === 'advanced_computer_science'
    ));
    expect(advanced).toMatchObject({ canonical_major_units: 64 });
    expect(advanced.requirement_groups.map((group) => group.title)).toEqual([
      'Advanced Computer Science concentration-specific B.S. science requirement',
      'Advanced Computer Science concentration delta',
      'Advanced Computer Science concentration additional degree gates',
    ]);
    expect(advanced.requirement_groups[0].sections[0]).toMatchObject({
      section_advisement: 2,
      unit_advisement: 7,
      unit_advisement_max: 8,
    });
    expect(advanced.requirement_groups[2].sections.map((section) => (
      section.unit_advisement
    ))).toEqual([0, 0]);
    expect(composition.data_quality_flags.map((flag) => flag.code)).toEqual(expect.arrayContaining([
      'published_major_range_does_not_reconcile',
      'network_concentration_subtotal_conflict',
      'advanced_ai_science_requirement_not_named',
      'published_open_credit_range_does_not_reconcile',
      'program_listed_code_absent_from_course_catalog',
    ]));
    expect(doc.codes_seen).toEqual(expect.arrayContaining([
      'CS120', 'CS220', 'CS340', 'CS411', 'CS451', 'CS455', 'CS481', 'STAT301',
    ]));
    expect(doc.course_titles).toMatchObject({
      ASTR151: 'Astronomy I',
      ASTR152: 'Astronomy II',
      BIOL106: 'Biology for Health Sciences (GE)',
      BIOL111: 'Integrative Biology I (GE)',
      BIOL112: 'Integrative Biology II (GE)',
      BIOL229: 'Ecology (GE)',
      BIOL230: 'Cell Biology (GE)',
      BIOL231: 'Genetics',
      BIOL310: 'Human Anatomy and Physiology I (GE)',
      BIOL311: 'Human Anatomy and Physiology II (GE)',
      CHEM111: 'General Chemistry I (GE)',
      CHEM112: 'General Chemistry II (GE)',
      CS540: 'Data Engineering',
      GEOL105: 'Exploring Earth (GE)',
      GEOL120: 'Earth Science and Society (GE)',
      GEOL206: 'It’s About Time: A History of Earth, Life, and Global Change (GE)',
      PHYS111: 'General Physics I',
      PHYS112: 'General Physics II (GE)',
      PHYS221: 'Physics I (GE)',
      PHYS222: 'Physics II (GE)',
    });
    expect(doc.course_titles.GEOL121).toBeUndefined();
    expect(composition.data_quality_flags.find((flag) => (
      flag.code === 'program_listed_code_absent_from_course_catalog'
    ))).toMatchObject({ severity: 'block_analysis' });
  });

  it('closes UVA Wise with exact Core overlap and preserves both department concentrations', () => {
    const { composition, doc, extract } = load(
      'the-university-of-virginia-s-college-at-wise',
    );

    expect(extract.sources.map((source) => source.id)).toEqual([
      'major',
      'general_education',
      'college',
      'graduation',
      'course_catalog',
      'cybersecurity_concentration',
      'data_science_concentration',
    ]);
    expect(extract.source_layers.major).toMatchObject({
      status: 'captured',
      source_refs: ['major', 'cybersecurity_concentration', 'data_science_concentration'],
    });
    expect(doc).toMatchObject({
      program: 'Computer Science, B.S.',
      degree_variant: 'BS',
      total_units: 120,
      college: null,
      ge_authority: 'UVA Wise General Education Liberal Arts Core',
      unit_audit: {
        canonical_major_units: 77,
        canonical_math_and_science_units: 25,
        computer_science_core_units: 37,
        additional_upper_division_major_units: 15,
        canonical_liberal_arts_core_actual_units: 48,
        canonical_liberal_arts_core_units_inside_major: 15,
        canonical_net_liberal_arts_core_units: 33,
        remaining_elective_capacity_units: 10,
        residency: { minimum_units: 45 },
        four_year_institution_units_minimum: 58,
        two_year_transfer_units_maximum: 62,
      },
    });
    expect(doc.requirement_variants.map((variant) => [variant.key, variant.selected])).toEqual([
      ['standard_computer_science_bs', true],
      ['cybersecurity_concentration', false],
      ['data_science_concentration', false],
    ]);

    const cyber = doc.requirement_variants.find((variant) => (
      variant.key === 'cybersecurity_concentration'
    ));
    expect(cyber.requirement_groups[0].sections[0]).toMatchObject({
      section_advisement: 3,
      unit_advisement: 9,
    });
    expect(cyber.requirement_groups[0].sections[0].receivers.map((receiver) => (
      receiver.code_seen
    ))).toEqual(['CSC4280', 'CSC4281', 'CSC4282', 'CSC4380']);

    const data = doc.requirement_variants.find((variant) => (
      variant.key === 'data_science_concentration'
    ));
    expect(data).toMatchObject({
      published_concentration_units_minimum: 17,
      published_concentration_units_maximum: 20,
      minimum_course_grade: 'C',
    });
    expect(data.eligible_majors).toContain('Computer Science');
    expect(data.requirement_groups[0].sections.map((section) => [
      section.unit_advisement,
      section.unit_advisement_max,
    ])).toEqual([[1, 3], [3, 4], [3, 3], [4, 4], [3, 3], [3, 3]]);

    const overlapTitles = [
      'Liberal Arts Core Quantitative Reasoning satisfied by the major',
      'Liberal Arts Core Scientific Reasoning satisfied by the major',
      'Liberal Arts Core Studies of Self satisfied by the major',
    ];
    expect(doc.requirement_groups
      .filter((group) => overlapTitles.includes(group.title))
      .map((group) => canonicalUnits(group))).toEqual([0, 0, 0]);
    expect(doc.requirement_groups.find((group) => (
      group.title === 'Remaining Liberal Arts Core Contextual Coursework'
    )).sections.map((section) => section.unit_advisement)).toEqual([3, 3, 3, 9]);
    expect(doc.requirement_groups.find((group) => (
      group.title === 'Liberal Arts Core co-curricular completion requirements'
    )).sections.map((section) => section.unit_advisement)).toEqual([0, 0]);
    expect(composition.data_quality_flags.map((flag) => flag.code)).toEqual(expect.arrayContaining([
      'liberal_arts_core_published_range_conflict',
      'cybersecurity_concentration_applicability_not_enumerated',
    ]));
    expect(doc.codes_seen).toEqual(expect.arrayContaining([
      'MTH2040', 'CSC1010', 'CSC4990', 'SWE1790', 'CSC4280', 'DSC3500', 'MIS4500',
    ]));
    expect(doc.course_titles).toMatchObject({
      ENG1010: 'Composition',
      ENG1020: 'Composition',
      FRE1010: 'Elementary French',
      FRE1020: 'Elementary French',
      GER1010: 'Elementary German',
      GER1020: 'Elementary German',
      SPA1010: 'Elementary Spanish',
      SPA1020: 'Elementary Spanish',
    });
  });
});
