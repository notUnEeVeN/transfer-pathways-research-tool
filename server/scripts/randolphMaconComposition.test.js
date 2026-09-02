import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');

function composedDegree() {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
  const institution = registry.find((row) => row.slug === 'randolph-macon-college');
  const extract = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'requirements', 'randolph-macon-college.json',
  ), 'utf8'));
  const composition = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'composed', 'randolph-macon-college.json',
  ), 'utf8'));
  const compiled = compileDegreeComposition(composition, { institutionLevel: institution.level });
  const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
  const doc = toDocument(extract, institution, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { acceptance, composition, doc };
}

describe('Randolph-Macon official full-degree composition', () => {
  it('catalog-accepts the current B.S. while blocking unsupported overlap analysis', () => {
    const { acceptance, doc } = composedDegree();
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual([
      'analysis_quality_flags', 'constraint_support',
    ]);
    expect(doc).toMatchObject({
      program: 'Computer Science, B.S.',
      degree_variant: 'BS',
      catalog_year: '2026-2027',
      total_units: 120,
      academic_unit: 'Computer Science',
      college: 'Randolph-Macon College',
      ge_authority: 'Randolph-Macon College Collegiate Requirements',
      requirement_layers: {
        major: { status: 'complete' },
        ge_college: { status: 'complete' },
        university_graduation: { status: 'complete' },
      },
      unit_audit: {
        graduation_minimum: 120,
        modeled_units: 120,
        major_units: 40,
        major_scoped_upper_division_units_minimum: 12,
        transfer_and_external_credit_units_maximum: 75,
        residency: { minimum_units: 45 },
      },
    });
  });

  it('preserves the exact 25 + 3 + 12 Computer Science major structure', () => {
    const { doc } = composedDegree();
    const foundation = doc.requirement_groups.find((group) => (
      group.title === 'Computer Science Foundation'
    ));
    expect(foundation.sections.map((section) => section.unit_advisement))
      .toEqual([4, 4, 3, 3, 4, 4, 3]);
    expect(foundation.sections.reduce((sum, section) => sum + section.unit_advisement, 0)).toBe(25);
    expect(foundation.sections.map((section) => section.receivers[0].code_seen))
      .toEqual(['CSCI111', 'CSCI112', 'CSCI210', 'CSCI211', 'CSCI212', 'CSCI213', 'CSCI311']);

    const emphasis = doc.requirement_groups.find((group) => (
      group.title === 'Computer Science Programming Emphasis'
    ));
    expect(emphasis.sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 3 });
    expect(emphasis.sections[0].receivers.map((receiver) => receiver.code_seen)).toEqual([
      'CSCI330', 'CSCI332', 'CSCI335', 'CSCI340', 'CSCI343', 'CSCI350', 'CSCI382',
    ]);

    const electives = doc.requirement_groups.find((group) => (
      group.title === 'Computer Science Electives'
    ));
    expect(electives.sections[0]).toMatchObject({ section_advisement: 4, unit_advisement: 12 });
    expect(electives.sections[0].receivers).toHaveLength(17);
    expect(electives.analysis_constraints.map((constraint) => constraint.kind)).toEqual([
      'elective_minimum_course_level',
      'no_double_count_with_programming_emphasis',
      'special_topics_range_membership',
    ]);
    expect(electives.sections[0].receivers.filter((receiver) => (
      receiver.receiving.kind === 'ge_area'
    )).map((receiver) => receiver.receiving.code)).toEqual([
      'RMC-CSCI-280-284', 'RMC-CSCI-380-384',
    ]);
  });

  it('retains every Collegiate Requirement as a nonadditive completion gate', () => {
    const { doc } = composedDegree();
    const effective = doc.requirement_groups.find((group) => (
      group.title === 'Collegiate Requirements: Effective Communication'
    ));
    expect(effective.sections.map((section) => section.label_seen)).toEqual([
      'Written Communication',
      'Oral Communication',
      'Communication in Context',
      'Foreign Language Communication',
    ]);
    expect(effective.sections.every((section) => section.unit_advisement === 0)).toBe(true);

    const pillars = doc.requirement_groups.find((group) => (
      group.title === 'Collegiate Requirements: Pillars of the Liberal Arts'
    ));
    expect(pillars.sections.map((section) => section.label_seen)).toEqual([
      'Aesthetic Expression',
      'Civic Life',
      'Global Experiences',
      'The Human Condition',
      'Quantitative and Symbolic Reasoning',
      'The Scientific Process',
    ]);

    const attributes = doc.requirement_groups.find((group) => (
      group.title === 'Collegiate Requirements: Pillar attributes and distribution'
    ));
    expect(attributes.sections.map((section) => section.label_seen)).toEqual([
      'Writing Attentive',
      'Arts and Humanities distribution',
      'Social and Behavioral Science distribution',
      'Natural Science and Mathematics distribution',
    ]);

    const crossArea = doc.requirement_groups.find((group) => (
      group.title === 'Collegiate Requirements: Cross-Area Requirements'
    ));
    expect(crossArea.sections.map((section) => section.label_seen)).toEqual([
      'Experiential Learning',
      'Non-Western Culture',
      'Diversity and Inclusion',
      'Capstone Experience',
    ]);

    const capacity = doc.requirement_groups.find((group) => (
      group.title === 'General Education and elective capacity after the Computer Science major'
    ));
    expect(capacity.sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 80 });
  });

  it('keeps current noncredit, GPA, transfer-cap, and major-residence policies visible', () => {
    const { composition, doc } = composedDegree();
    const wellness = doc.requirement_groups.find((group) => (
      group.title === 'Physical Education and Wellness experiences'
    ));
    expect(wellness.sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 0 });
    expect(wellness.sections[0].receivers[0].receiving.name)
      .toBe('Complete two approved Physical Education and Wellness experiences');

    const policies = doc.requirement_groups.find((group) => (
      group.title === 'University graduation, transfer-credit, and residence rules'
    ));
    expect(policies.sections.map((section) => section.label_seen)).toEqual([
      'Randolph-Macon cumulative GPA',
      'Combined transfer and external credit maximum',
      'Derived institutional-credit floor',
      'Major residence',
    ]);
    expect(composition.data_quality_flags.map((flag) => flag.code)).toContain(
      'physical_education_wording_conflict',
    );
    expect(doc.requirement_groups.some((group) => /Fall|Spring|plan of study/i.test(group.title))).toBe(false);
    expect(doc.requirement_groups.every((group) => group.source_refs.length > 0
      && group.sections.every((section) => section.source_refs.length > 0))).toBe(true);
  });
});
