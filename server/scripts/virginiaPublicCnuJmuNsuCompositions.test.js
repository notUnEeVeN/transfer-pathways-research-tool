import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
const SLUGS = [
  'christopher-newport-university',
  'james-madison-university',
  'norfolk-state-university',
];

function composedDegree(slug) {
  const institution = registry.find((row) => row.slug === slug);
  const extract = JSON.parse(fs.readFileSync(path.join(ROOT, 'requirements', `${slug}.json`), 'utf8'));
  const composition = JSON.parse(fs.readFileSync(path.join(ROOT, 'composed', `${slug}.json`), 'utf8'));
  const compiled = compileDegreeComposition(composition, { institutionLevel: institution.level });
  const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
  const doc = toDocument(extract, institution, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { acceptance, composition, doc };
}

const groupUnits = (doc) => doc.requirement_groups.map((group) => (
  group.sections.reduce((total, section) => total + section.unit_advisement, 0)
));

describe('official-source CNU, JMU, and NSU compositions', () => {
  it.each(SLUGS)('%s passes catalog acceptance with only explicit evaluator blockers', (slug) => {
    const { acceptance, doc } = composedDegree(slug);
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual(['constraint_support']);
    expect(doc.requirement_layers).toMatchObject({
      major: { status: 'complete' },
      ge_college: { status: 'complete' },
      university_graduation: { status: 'complete' },
    });
    expect(groupUnits(doc).reduce((sum, units) => sum + units, 0)).toBe(120);
    expect(doc.provenance.composition_artifact).toContain(`${slug}.json`);
  });

  it('closes Christopher Newport from its 70-credit major through Liberal Learning and residence', () => {
    const { acceptance, doc } = composedDegree('christopher-newport-university');
    expect(doc).toMatchObject({
      program: 'Bachelor of Science in Computer Foundations, Computer Science Major',
      total_units: 120,
      academic_unit: 'School of Engineering and Computing',
      college: 'College of Natural and Behavioral Sciences',
      unit_audit: {
        graduation_minimum: 120,
        modeled_units: 120,
        canonical_major_and_support_units: 70,
        liberal_learning_unique_nonmajor_units: 31,
        remaining_elective_units: 19,
        major_scoped_upper_division_units_minimum: 29,
        residency: { minimum_units: 45 },
      },
    });
    expect(groupUnits(doc)).toEqual([58, 9, 3, 12, 19, 19, 0]);

    const science = doc.requirement_groups[0].sections.find((section) => (
      section.label_seen === 'B.S. laboratory science sequence specified by the major'
    ));
    expect(science).toMatchObject({ section_advisement: 1, unit_advisement: 8 });
    expect(science.receivers.map((receiver) => receiver.code_seen)).toEqual([
      'PHYS151 + PHYS151L + PHYS152 + PHYS152L',
      'PHYS201 + PHYS201L + PHYS202 + PHYS202L',
    ]);
    expect(doc.requirement_groups[1]).toMatchObject({
      title: 'Advanced major selection',
      sections: [{ section_advisement: 3, unit_advisement: 9 }],
    });
    expect(acceptance.analysis_ready.checks.find((check) => check.name === 'constraint_support')
      .issues.map((issue) => issue.kind)).toEqual(expect.arrayContaining([
        'variable_topics_credit_must_close_selection',
        'area_of_inquiry_discipline_limits',
        'writing_intensive_attribute_within_capacity',
      ]));
  });

  it('models JMU degree requirements, all 14 GE requirements, and the canonical variable major path', () => {
    const { acceptance, doc } = composedDegree('james-madison-university');
    expect(doc).toMatchObject({
      program: 'Computer Science, B.S.',
      catalog_year: '2026-2027',
      total_units: 120,
      academic_unit: 'Department of Computer Science',
      college: 'College of Integrated Science and Engineering',
      unit_audit: {
        canonical_major_units: 49,
        major_units_maximum: 52,
        general_education_units: 41,
        bs_quantitative_units_beyond_general_education: 3,
        canonical_university_elective_units: 27,
        university_elective_units_minimum: 24,
        four_year_institution_units_minimum: 60,
        residency: { minimum_units: 30 },
      },
    });
    expect(groupUnits(doc)).toEqual([24, 9, 3, 4, 3, 3, 3, 41, 3, 27, 0]);

    const ge = doc.requirement_groups.find((group) => group.title === 'General Education: The Human Community');
    expect(ge.sections).toHaveLength(14);
    expect(ge.sections.reduce((sum, section) => sum + section.unit_advisement, 0)).toBe(41);
    const calculus = doc.requirement_groups.find((group) => group.title === 'Calculus sequence').sections[0];
    expect(calculus).toMatchObject({ section_advisement: 1, unit_advisement: 4, unit_advisement_max: 6 });
    expect(calculus.receivers[1].receiving).toMatchObject({ kind: 'series', conjunction: 'and', units: 6 });
    expect(doc.requirement_groups.some((group) => /Fall|Spring|sample|plan of study/i.test(group.title))).toBe(false);
    expect(acceptance.analysis_ready.checks.find((check) => check.name === 'constraint_support')
      .issues.map((issue) => issue.kind)).toEqual(expect.arrayContaining([
        'minimum_course_number_distribution',
        'correlated_variable_major_and_elective_units',
      ]));
  });

  it('uses NSU curriculum rows as requirements while dropping their semester sequencing', () => {
    const { acceptance, doc } = composedDegree('norfolk-state-university');
    expect(doc).toMatchObject({
      program: 'Bachelor of Science in Computer Science - Standard Track',
      total_units: 120,
      academic_unit: 'Department of Computer Science',
      college: 'College of Science, Engineering, and Technology',
      unit_audit: {
        published_general_education_units: 40,
        published_core_major_units: 53,
        published_requirements_elective_units: 27,
        fixed_computing_math_and_writing_units: 64,
        laboratory_science_support_units: 8,
        remaining_explicit_general_education_units: 27,
        upper_cs_or_math_elective_units: 18,
        free_elective_units: 3,
        residency: { minimum_units: 30 },
      },
    });
    expect(groupUnits(doc)).toEqual([64, 8, 27, 0, 18, 3, 0]);
    expect(doc.requirement_groups.some((group) => /Fall|Spring|First Year|Second Year|plan of study/i.test(group.title))).toBe(false);

    const science = doc.requirement_groups[1];
    expect(science.distinct_course_ids_across_sections).toBe(true);
    expect(science.sections).toHaveLength(2);
    expect(science.sections.every((section) => section.unit_advisement === 4
      && section.receivers.length === 3
      && section.receivers.every((receiver) => receiver.receiving.kind === 'series'))).toBe(true);

    const upperElectives = doc.requirement_groups[4];
    expect(upperElectives.sections.map((section) => ({
      select: section.section_advisement,
      units: section.unit_advisement,
    }))).toEqual([{ select: 5, units: 15 }, { select: 1, units: 3 }]);
    expect(upperElectives.sections[1].receivers.at(-1).receiving).toMatchObject({
      kind: 'ge_area',
      code: 'NSU-MATH-300',
    });
    expect(acceptance.analysis_ready.checks.find((check) => check.name === 'constraint_support')
      .issues.map((issue) => issue.kind).filter(Boolean)).toEqual(expect.arrayContaining([
        'distinct_laboratory_science_sequences',
        'general_education_major_overlap',
        'minimum_major_menu_units',
      ]));
  });
});
