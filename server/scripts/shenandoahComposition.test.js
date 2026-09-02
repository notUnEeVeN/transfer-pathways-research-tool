import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');

function composedDegree() {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
  const institution = registry.find((row) => row.slug === 'shenandoah-university');
  const extract = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'requirements', 'shenandoah-university.json',
  ), 'utf8'));
  const composition = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'composed', 'shenandoah-university.json',
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

describe('Shenandoah University official full-degree composition', () => {
  it('catalog-accepts the actual 2025-2026 standard B.S. with complete unit closure', () => {
    const { acceptance, doc } = composedDegree();
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual([
      'analysis_quality_flags', 'constraint_support',
    ]);
    expect(doc).toMatchObject({
      program: 'Computer Science (B.S.)',
      degree_variant: 'BS',
      catalog_year: '2025-2026',
      total_units: 120,
      academic_unit: 'Computer Science program',
      college: 'Division of Advanced Technology',
      ge_authority: 'Shenandoah University ShenEd Curriculum',
      requirement_layers: {
        major: { status: 'complete' },
        ge_college: { status: 'complete' },
        university_graduation: { status: 'complete' },
      },
      unit_audit: {
        graduation_minimum: 120,
        modeled_units: 120,
        major_units: 55,
        general_education_units_minimum: 30,
        general_education_and_elective_capacity_units: 65,
        upper_division: { minimum_units: 30, modeled_units: 32 },
        residency: { minimum_units: 30, minimum_fraction: 0.25 },
        transfer_credit_units_maximum: 90,
        final_thirty_resident_units_minimum: 24,
        minimum_cumulative_gpa: 2,
      },
    });
  });

  it('preserves the exact 43 + 6 + 6 major and its 32-credit upper-level floor', () => {
    const { doc } = composedDegree();
    const fixed = doc.requirement_groups.find((group) => (
      group.title === 'Computer Science and mathematics fixed requirements'
    ));
    expect(fixed.sections.map((section) => section.receivers[0].code_seen)).toEqual([
      'CSC121', 'CSC122', 'CSC210', 'CSC301', 'CSC403', 'CSC410', 'MATH201',
      'MATH202', 'MATH370', 'MATH209', 'CSC310', 'CSC407', 'CSC430', 'CSC480',
    ]);
    expect(fixed.sections.map((section) => section.unit_advisement)).toEqual([
      3, 3, 3, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3, 2,
    ]);
    expect(fixed.sections.reduce((sum, section) => sum + section.unit_advisement, 0)).toBe(43);
    expect(fixed.sections.find((section) => section.receivers[0].code_seen === 'CSC407'))
      .toMatchObject({ unit_advisement: 3 });

    const mathematics = doc.requirement_groups.find((group) => group.title === 'Mathematics electives');
    expect(mathematics.sections.map((section) => section.unit_advisement)).toEqual([3, 3]);
    expect(mathematics.sections.map((section) => section.course_level)).toEqual([
      'upper_division', 'mixed',
    ]);

    const computing = doc.requirement_groups.find((group) => (
      group.title === 'Computer Science electives'
    ));
    expect(computing.sections[0]).toMatchObject({ unit_advisement: 6, course_level: 'upper_division' });

    const upperUnits = doc.requirement_groups.reduce((groupSum, group) => (
      groupSum + group.sections.reduce((sectionSum, section) => (
        sectionSum + (section.course_level === 'upper_division' ? section.unit_advisement : 0)
      ), 0)
    ), 0);
    expect(upperUnits).toBe(32);
  });

  it('retains all ShenEd sphere ranges and conditional transfer semantics without double counting', () => {
    const { doc } = composedDegree();
    const seminar = doc.requirement_groups.find((group) => (
      group.title === 'ShenEd entry-status seminar route'
    ));
    expect(seminar.group_conjunction).toBe('Or');
    expect(seminar.sections.map((section) => section.label_seen)).toEqual([
      'FYS 101 for a first-time, first-year student',
      'Additional three Navigating Difference credits for a transfer student',
    ]);
    expect(seminar.sections.every((section) => section.unit_advisement === 0)).toBe(true);
    expect(seminar.sections[0].receivers[0].code_seen).toBe('FYS101');

    const spheres = [
      ['ShenEd Communicative and Quantitative Literacies sphere', '9-12'],
      ['ShenEd Scientific Inquiry sphere', '6-14'],
      ['ShenEd Navigating Difference sphere', '6-9'],
      ['ShenEd Creative Expression sphere', '3-6'],
    ];
    for (const [title, credits] of spheres) {
      const group = doc.requirement_groups.find((candidate) => candidate.title === title);
      expect(group.stated_credits).toBe(credits);
      expect(group.sections.every((section) => section.unit_advisement === 0)).toBe(true);
    }

    const literacies = doc.requirement_groups.find((group) => (
      group.title === 'ShenEd Communicative and Quantitative Literacies sphere'
    ));
    expect(literacies.sections.map((section) => section.label_seen)).toEqual([
      'Oral communication (3-6 credits)',
      'Written communication: ENG 101 or equivalent (3-6 credits)',
      'Quantitative literacy (3-6 credits)',
    ]);
    expect(literacies.sections[1].receivers.map((receiver) => (
      receiver.code_seen || receiver.receiving.code
    ))).toEqual(['ENG101', 'SU-SHENED-CQL-WRITTEN-EQUIVALENT']);

    const total = doc.requirement_groups.find((group) => (
      group.title === 'ShenEd total, disciplinary distribution, and transfer treatment'
    ));
    expect(total.sections.map((section) => section.label_seen)).toEqual([
      'Thirty ShenEd credits across all four spheres',
      'Humanities or fine arts distribution',
      'Natural sciences or mathematics distribution',
      'Social or behavioral sciences distribution',
    ]);
    expect(total.analysis_constraints.map((constraint) => constraint.kind)).toContain(
      'conditional_associate_degree_domain_fulfillment',
    );

    const capacity = doc.requirement_groups.find((group) => (
      group.title === 'General Education and elective capacity after the Computer Science major'
    ));
    expect(capacity.sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 65 });
  });

  it('keeps graduation policies cited and excludes the prospective Course Map tree', () => {
    const { composition, doc } = composedDegree();
    const policies = doc.requirement_groups.find((group) => (
      group.title === 'University graduation, transfer-credit, GPA, and residence rules'
    ));
    expect(policies.sections.map((section) => section.label_seen)).toEqual([
      'Baccalaureate credit minimum',
      'Upper-level credit minimum',
      'Shenandoah institutional-credit minimum',
      'Transfer-credit maximum',
      'Final-credit residence',
      'Cumulative GPA minimum',
      'Required assessments and surveys',
    ]);
    expect(composition.source_bundle_required).toEqual([
      'major', 'general_education', 'college', 'graduation', 'policy', 'course_catalog',
    ]);
    expect(doc.codes_seen).toEqual([
      'CSC121', 'CSC122', 'CSC210', 'CSC301', 'CSC310', 'CSC403', 'CSC407', 'CSC410',
      'CSC430', 'CSC480', 'ENG101', 'FYS101', 'MATH201', 'MATH202', 'MATH209', 'MATH370',
    ]);
    expect(doc.requirement_groups.some((group) => (
      /Course Map|(?:1st|2nd|3rd|4th) Year|Fall|Spring/i.test(group.title)
      || group.sections.some((section) => (
        /Course Map|(?:1st|2nd|3rd|4th) Year|Fall|Spring/i.test(section.label_seen || '')
      ))
    ))).toBe(false);
    expect(doc.requirement_groups.every((group) => (
      group.source_refs.length > 0
      && group.sections.every((section) => section.source_refs.length > 0)
    ))).toBe(true);
  });
});
