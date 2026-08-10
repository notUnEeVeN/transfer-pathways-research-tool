import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;

function pilot(slug) {
  const institution = registry.find((row) => row.slug === slug);
  const extract = JSON.parse(fs.readFileSync(path.join(ROOT, 'requirements', `${slug}.json`), 'utf8'));
  const composition = JSON.parse(fs.readFileSync(path.join(ROOT, 'composed', `${slug}.json`), 'utf8'));
  const compiled = compileDegreeComposition(composition, { institutionLevel: institution.level });
  // The production resolver uses `va_courses`. This registry-shaped map keeps
  // the artifact test pure while still requiring every cited CC identity.
  const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
  const doc = toDocument(extract, institution, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { doc, acceptance, composition };
}

describe('source-composed Virginia pilots', () => {
  it('models NOVA rules instead of counting supplemental option pools as requirements', () => {
    const { doc, acceptance } = pilot('northern-virginia-community-college');
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.analysis_ready.failed).toContain('constraint_support');
    expect(doc.total_units).toBe(60);
    expect(doc.total_units_max).toBe(63);
    expect(doc.requirement_groups.map((group) => group.title)).toEqual(expect.arrayContaining([
      'Mathematics placement path',
      'Approved elective',
      'Additional applicable credit to the degree minimum',
    ]));
    const placement = doc.requirement_groups.find((group) => group.title === 'Mathematics placement path');
    expect(placement.group_conjunction).toBe('Or');
    expect(placement.sections).toHaveLength(2);
    expect(placement.sections[1]).toMatchObject({ section_advisement: 2, unit_advisement: 5 });
  });

  it('accepts a college course directly evidenced by the reviewed official degree page', () => {
    const institution = registry.find((row) => row.slug === 'northern-virginia-community-college');
    const extract = JSON.parse(fs.readFileSync(path.join(
      ROOT, 'requirements', 'northern-virginia-community-college.json',
    ), 'utf8'));
    const composition = JSON.parse(fs.readFileSync(path.join(
      ROOT, 'composed', 'northern-virginia-community-college.json',
    ), 'utf8'));
    const doc = toDocument(extract, institution, new Map(), composition);
    const resolve = acceptanceResolver(doc, new Map());
    const mth283 = doc.requirement_groups
      .flatMap((group) => group.sections || [])
      .flatMap((section) => section.receivers || [])
      .flatMap((receiver) => receiver.options || [])
      .find((option) => option.course_keys.includes('va:MTH283'));
    expect(doc.course_titles.MTH283).toBe('Probability and Statistics');
    expect(resolve({
      side: 'community_college', id: mth283.course_ids[0], key: 'va:MTH283',
    })).toMatchObject({ course_key: 'va:MTH283' });
  });

  it('composes Mason major, net GE, graduation, upper-level, and residency layers to 120', () => {
    const { doc, acceptance } = pilot('george-mason-university');
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.analysis_ready.failed).toContain('constraint_support');
    expect(doc.requirement_layers).toMatchObject({
      major: { status: 'complete' },
      ge_college: { status: 'complete' },
      university_graduation: { status: 'complete' },
    });
    expect(doc.unit_audit).toMatchObject({
      graduation_minimum: 120,
      modeled_units: 120,
      upper_division: { minimum_units: 45, modeled_units: 45 },
      residency: { minimum_units: 30 },
    });
    expect(doc.codes_seen).not.toEqual(expect.arrayContaining(['CS571', 'CS583', 'CS555']));
    expect(doc.requirement_groups.find((group) => group.title === 'Natural Science laboratory sequence')
      .sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 8 });
    expect(doc.provenance.composition_artifact).toContain('george-mason-university.json');
  });

  it('composes Mary Washington requirements without importing its suggested plan', () => {
    const { doc, acceptance } = pilot('university-of-mary-washington');
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.analysis_ready.failed).toContain('constraint_support');
    expect(doc.total_units).toBe(120);
    expect(doc.unit_audit).toMatchObject({
      graduation_minimum: 120,
      modeled_units: 120,
      major_scoped_upper_division_units_minimum: 33,
      residency: { minimum_units: 30 },
    });
    expect(doc.requirement_groups.map((group) => group.title)).toEqual([
      'Computer Science major',
      'General Education course, attribute, and experience requirements',
      'General Education and elective capacity after the canonical major path',
      'University graduation and residence rules',
    ]);
    const discrete = doc.requirement_groups[0].sections.find((section) => section.label_seen === 'Discrete mathematics');
    expect(discrete).toMatchObject({ section_advisement: 1, unit_advisement: 4, unit_advisement_max: 6 });
    expect(discrete.receivers[1].receiving).toMatchObject({ kind: 'series', conjunction: 'and' });
    expect(doc.requirement_groups.some((group) => /Fall|Spring|plan of study/i.test(group.title))).toBe(false);
  });

  it('composes Longwood B.S. major, Civitae choices, graduation policies, and elective closure', () => {
    const { doc, acceptance, composition } = pilot('longwood-university');
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.analysis_ready.failed).toContain('constraint_support');
    expect(doc).toMatchObject({
      program: 'Computer Science, B.S.',
      degree_variant: 'BS',
      total_units: 120,
      academic_unit: 'Department of Mathematics and Computer Science',
      college: 'Cook-Cole College of Arts and Sciences',
      ge_authority: 'Longwood University Civitae Core Curriculum',
      requirement_layers: {
        major: { status: 'complete' },
        ge_college: { status: 'complete' },
        university_graduation: { status: 'complete' },
      },
      unit_audit: {
        graduation_minimum: 120,
        modeled_units: 120,
        upper_division: { minimum_units: 30, modeled_units: 30 },
        residency: { minimum_units: 30, minimum_fraction: 0.25 },
        minimum_longwood_gpa: 2,
        minimum_major_gpa: 2,
      },
    });

    const bs = doc.requirement_groups.find((group) => group.title === 'B.S. Additional Degree Requirement');
    expect(bs).toMatchObject({ group_conjunction: 'Or', canonical_section_index: 0 });
    expect(bs.sections.map((section) => section.unit_advisement)).toEqual([3, 4]);
    expect(bs.sections.map((section) => section.receivers[0].code_seen)).toEqual(['MATH250', 'MATH261']);

    const perspectives = doc.requirement_groups.find((group) => group.title === 'Civitae Perspectives');
    expect(perspectives.sections).toHaveLength(4);
    expect(perspectives.sections.slice(0, 3).map((section) => section.receivers.length)).toEqual([2, 2, 2]);
    expect(perspectives.sections[3].receivers[0].receiving.name)
      .toBe('Approved Integrating World Languages Perspective');

    const remainder = doc.requirement_groups.find((group) => group.title === 'General Electives: remaining B.S. capacity');
    expect(remainder).toMatchObject({ group_conjunction: 'Or', canonical_section_index: 0 });
    expect(remainder.sections.map((section) => section.unit_advisement)).toEqual([21, 20, 19]);
    expect(doc.requirement_groups.find((group) => group.title === 'General Electives: upper-level Longwood capacity')
      .sections[0].unit_advisement).toBe(12);

    const math171 = doc.requirement_groups.flatMap((group) => group.sections)
      .flatMap((section) => section.receivers)
      .filter((receiver) => receiver.code_seen === 'MATH171');
    expect(math171).toHaveLength(1);
    expect(doc.requirement_groups.every((group) => group.source_refs.length > 0
      && group.sections.every((section) => section.source_refs.length > 0))).toBe(true);
    expect(composition.excluded_variants).toEqual(['Bachelor of Arts path']);
    expect(doc.requirement_groups.some((group) => /Fall|Spring|plan of study/i.test(group.title))).toBe(false);
    expect(doc.provenance.composition_artifact).toContain('longwood-university.json');
  });
});
