import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { courseIdFor } from '../services/virginia/courseIdentity';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');

function fixture() {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8'));
  const institution = registry.institutions.find((row) => row.slug === 'virginia-military-institute');
  const extract = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'requirements', 'virginia-military-institute.json'), 'utf8',
  ));
  const composition = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'composed', 'virginia-military-institute.json'), 'utf8',
  ));
  const doc = toDocument(extract, institution, new Map(), composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, new Map()),
  });
  return { acceptance, composition, doc, extract, institution };
}

const explicitUnits = (groups = []) => groups.reduce((total, group) => (
  total + (group.sections || []).reduce((sum, section) => sum + section.unit_advisement, 0)
), 0);

describe('Virginia Military Institute 2025-2026 source composition', () => {
  it('captures every track and composes the broad Theory and Application path to 136 credits', () => {
    const { acceptance, doc, extract, institution } = fixture();

    expect(institution).toMatchObject({ platform: 'acalog' });
    expect(extract).toMatchObject({
      outcome: 'captured',
      catalog_year: '2025-2026',
      parser: 'variant_set',
    });
    expect(extract.requirement_variants.captured_source_roles).toEqual([
      'program', 'program_cybersecurity', 'program_information_technology',
    ]);
    expect(extract.sources.map((source) => source.id)).toEqual([
      'major', 'program_cybersecurity', 'program_information_technology',
      'general_education', 'graduation', 'policy', 'course_catalog',
    ]);
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.analysis_ready.failed).toEqual(['constraint_support']);
    expect(doc).toMatchObject({
      program: 'Computer Science, B.S. - Theory and Application Track',
      total_units: 136,
      college: 'Virginia Military Institute',
      ge_authority: 'VMI Core Curriculum',
      unit_audit: {
        graduation_minimum: 136,
        modeled_units: 136,
        residency: { minimum_units: 68 },
      },
    });
    expect(explicitUnits(doc.requirement_groups)).toBe(136);
  });

  it('preserves all three complete curricula and their different published totals', () => {
    const { doc } = fixture();
    expect(doc.requirement_variants.map((variant) => [
      variant.key, variant.selected, variant.published_total_units,
    ])).toEqual([
      ['theory_and_application', true, 136],
      ['cybersecurity', false, 137],
      ['information_technology', false, 136],
    ]);

    const cyber = doc.requirement_variants.find((variant) => variant.key === 'cybersecurity');
    const informationTechnology = doc.requirement_variants.find((variant) => (
      variant.key === 'information_technology'
    ));
    expect(explicitUnits(cyber.requirement_groups)).toBe(137);
    expect(explicitUnits(informationTechnology.requirement_groups)).toBe(136);
    expect(cyber.codes_seen).toEqual(expect.arrayContaining(['CIS303L', 'CIS401', 'MA106', 'IS307']));
    expect(informationTechnology.codes_seen).toEqual(expect.arrayContaining([
      'CIS131', 'CIS231WX', 'CIS431', 'CIS476W',
    ]));
    expect(courseIdFor('CIS231WX')).toBeTypeOf('number');
  });

  it('models categorical degree requirements without duplicating semester synopsis rows', () => {
    const { doc } = fixture();
    expect(doc.requirement_groups.some((group) => /semester|freshman|sophomore|junior|senior/i
      .test(group.title))).toBe(false);
    expect(doc.requirement_groups.map((group) => group.title)).toEqual(expect.arrayContaining([
      'VMI Core Curriculum for the Theory and Application track',
      'Required Computer Science core',
      'Required Theory and Application track courses',
      'Reserve Officers Training Corps',
      'Institute graduation and residence rules',
    ]));
    expect(doc.requirement_groups.find((group) => (
      group.title === 'VMI Core Curriculum for the Theory and Application track'
    )).sections.reduce((sum, section) => sum + section.unit_advisement, 0)).toBe(34);
  });
});
