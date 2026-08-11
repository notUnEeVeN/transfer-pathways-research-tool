import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');

function williamMary() {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8'));
  const institution = registry.institutions.find((row) => row.slug === 'william-mary');
  const extract = JSON.parse(fs.readFileSync(path.join(ROOT, 'requirements', 'william-mary.json'), 'utf8'));
  const composition = JSON.parse(fs.readFileSync(path.join(ROOT, 'composed', 'william-mary.json'), 'utf8'));
  const doc = toDocument(extract, institution, new Map(), composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, new Map()),
  });
  return { acceptance, composition, doc, extract, institution };
}

describe('William & Mary 2026-2027 source composition', () => {
  it('uses the live official catalog and composes all degree layers to 120 credits', () => {
    const { acceptance, doc, extract, institution } = williamMary();

    expect(institution).toMatchObject({ platform: 'courseleaf' });
    expect(extract).toMatchObject({ outcome: 'captured', catalog_year: '2026-2027' });
    expect(extract.sources.map((source) => source.id)).toEqual([
      'major', 'general_education', 'college', 'policy', 'course_catalog',
    ]);
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.analysis_ready.failed).toEqual(['constraint_support']);
    expect(doc).toMatchObject({
      program: 'Computer Science (BS in Computer Science)',
      degree_variant: 'BS',
      total_units: 120,
      college: 'School of Computing, Data Sciences & Physics',
      ge_authority: 'William & Mary College Curriculum (COLL)',
      requirement_layers: {
        major: { status: 'complete' },
        ge_college: { status: 'complete' },
        university_graduation: { status: 'complete' },
      },
      unit_audit: {
        graduation_minimum: 120,
        modeled_units: 120,
        canonical_major_units: 48,
        canonical_distinct_coll_and_arts_units: 34,
        remaining_elective_capacity_units: 38,
        residency: { minimum_units: 60 },
      },
    });
  });

  it('preserves the required General, Cybersecurity, and AI/ML concentrations', () => {
    const { doc } = williamMary();
    expect(doc.requirement_variants.map((variant) => [variant.key, variant.selected])).toEqual([
      ['general', true],
      ['cybersecurity', false],
      ['artificial_intelligence_machine_learning', false],
    ]);

    const cybersecurity = doc.requirement_variants.find((variant) => variant.key === 'cybersecurity');
    expect(cybersecurity.requirement_groups[0].sections.slice(0, 3)
      .map((section) => section.receivers[0].code_seen)).toEqual(['CSCI444', 'CSCI454', 'CSCI464']);
    expect(cybersecurity.requirement_groups[0].sections[3]).toMatchObject({
      section_advisement: 1,
      unit_advisement: 3,
    });

    const ai = doc.requirement_variants.find((variant) => (
      variant.key === 'artificial_intelligence_machine_learning'
    ));
    expect(ai.requirement_groups[0].sections).toMatchObject([
      { section_advisement: 1, unit_advisement: 3 },
      { section_advisement: 4, unit_advisement: 12 },
    ]);
    expect(doc.codes_seen).toEqual(expect.arrayContaining([
      'CSCI141', 'CSCI423', 'CSCI444', 'CSCI464', 'CSCI416', 'DATA441', 'MATH451',
    ]));
  });

  it('keeps COLL overlap and residence rules explicit without importing a sample plan', () => {
    const { doc } = williamMary();
    const coll = doc.requirement_groups.find((group) => (
      group.title === 'College Curriculum and degree proficiencies'
    ));
    expect(coll.sections.map((section) => section.label_seen)).toEqual(expect.arrayContaining([
      'COLL 100', 'COLL 150', 'COLL 200 domains', 'COLL 300', 'COLL 350', 'COLL 400',
      'Foreign-language proficiency',
    ]));
    expect(doc.requirement_groups.find((group) => (
      group.title === 'Remaining elective capacity to the degree minimum'
    )).sections[0].unit_advisement).toBe(38);
    expect(doc.requirement_groups.some((group) => /sample|schedule|semester/i.test(group.title))).toBe(false);
  });
});
