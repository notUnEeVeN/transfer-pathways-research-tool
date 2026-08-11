import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');

function fixture() {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8'));
  const institution = registry.institutions.find((row) => row.slug === 'university-of-virginia');
  const extract = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'requirements', 'university-of-virginia.json'), 'utf8',
  ));
  const composition = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'composed', 'university-of-virginia.json'), 'utf8',
  ));
  const doc = toDocument(extract, institution, new Map(), composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, new Map()),
  });
  return { acceptance, doc, extract, institution };
}

const explicitUnits = (groups = []) => groups.reduce((total, group) => (
  total + (group.sections || []).reduce((sum, section) => sum + section.unit_advisement, 0)
), 0);

describe('University of Virginia 2026-2027 Computer Science B.S. composition', () => {
  it('uses the current Undergraduate Record and closes the Engineering B.S. to 127 credits', () => {
    const { acceptance, doc, extract, institution } = fixture();

    expect(institution).toMatchObject({ platform: 'acalog' });
    expect(extract).toMatchObject({ outcome: 'captured', catalog_year: '2026-2027' });
    expect(extract.sources.map((source) => source.id)).toEqual([
      'major', 'general_education', 'college', 'graduation', 'course_catalog',
    ]);
    expect(extract.source_layers).toMatchObject({
      major: { status: 'captured' },
      general_education: { status: 'captured' },
      college: { status: 'captured' },
      graduation: { status: 'captured' },
      course_catalog: { status: 'captured' },
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.analysis_ready.failed).toEqual(['constraint_support']);
    expect(doc).toMatchObject({
      program: 'Computer Science, B.S.',
      total_units: 127,
      college: 'School of Engineering and Applied Science',
      ge_authority: 'School of Engineering and Applied Science',
      unit_audit: {
        graduation_minimum: 127,
        modeled_units: 127,
        residency: { minimum_units: 63.5 },
      },
    });
    expect(explicitUnits(doc.requirement_groups)).toBe(127);
  });

  it('preserves exact major choices, the AI overlay, and named special routes', () => {
    const { doc } = fixture();
    expect(doc.codes_seen).toEqual(expect.arrayContaining([
      'CS1110', 'CS2100', 'CS3240', 'CS4971', 'CS4980', 'CS4991', 'CS4993',
      'APMA2130', 'APMA3150', 'CS4710', 'CS4774', 'COMM4211',
    ]));
    expect(doc.requirement_variants.map((variant) => [variant.key, variant.selected])).toEqual([
      ['standard_bscs', true],
      ['artificial_intelligence_concentration', false],
      ['cs4991_capstone_route', false],
      ['cs4993_elective_allowance', false],
    ]);

    const ai = doc.requirement_variants.find((variant) => (
      variant.key === 'artificial_intelligence_concentration'
    ));
    expect(explicitUnits(ai.requirement_groups)).toBe(12);
    expect(ai.codes_seen).toEqual(expect.arrayContaining([
      'CS4501', 'CS4710', 'CS4770', 'CS4771', 'CS4774', 'ECON4444', 'MDST3510',
    ]));
  });

  it('keeps variable math capacity and capstone conjunctions explicit without importing advising plans', () => {
    const { doc } = fixture();
    const appliedMath = doc.requirement_groups.find((group) => (
      group.title === 'Applied Mathematics electives'
    ));
    expect(appliedMath.sections).toMatchObject([
      { section_advisement: 1, unit_advisement: 3 },
      { section_advisement: 2, unit_advisement: 7 },
    ]);
    expect(appliedMath.analysis_constraints[0].kind).toBe('variable_credit_choose_two_with_exclusion');

    const capstone = doc.requirement_groups.find((group) => (
      group.title === 'Computer Science capstone'
    ));
    expect(capstone.sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 3 });
    expect(capstone.sections[0].receivers.map((receiver) => receiver.receiving.kind)).toEqual([
      'course', 'course', 'requirement',
    ]);
    expect(doc.requirement_groups.some((group) => /sample|schedule|semester/i.test(group.title))).toBe(false);
  });
});
