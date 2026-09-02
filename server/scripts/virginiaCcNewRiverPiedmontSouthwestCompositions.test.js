import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { courseIdFor } from '../services/virginia/courseIdentity';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const slugs = [
  'new-river-community-college',
  'piedmont-virginia-community-college',
  'southwest-virginia-community-college',
];
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
const research = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'research', 'cc-new-river-piedmont-southwest-composition.json'), 'utf8',
));

function build(slug) {
  const institution = registry.find((row) => row.slug === slug);
  const extract = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'requirements', `${slug}.json`), 'utf8',
  ));
  const composition = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'composed', `${slug}.json`), 'utf8',
  ));
  const compiled = compileDegreeComposition(composition, { institutionLevel: institution.level });
  const everyCode = new Set([...compiled.codes_seen, ...Object.keys(compiled.course_titles)]);
  const credits = new Map([...everyCode].map((code) => [code, 3]));
  const doc = toDocument(extract, institution, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { acceptance, compiled, composition, doc, extract, institution };
}

function options(group) {
  return group.sections.flatMap((section) => section.receivers.flatMap(
    (receiver) => receiver.options.map((option) => option.course_keys.map((key) => key.slice(3))),
  ));
}

function allOptionSetCourses(value, titles, out = new Set()) {
  if (typeof value === 'string' && Object.hasOwn(titles, value)) out.add(value);
  else if (Array.isArray(value)) value.forEach((entry) => allOptionSetCourses(entry, titles, out));
  else if (value && typeof value === 'object') Object.values(value)
    .forEach((entry) => allOptionSetCourses(entry, titles, out));
  return out;
}

describe('New River, Piedmont, and Southwest current Computer Science A.S. compositions', () => {
  it('pins all three programs and their source layers to the current 2026-2027 catalogs', () => {
    const expected = {
      'new-river-community-college': { catalog_id: 42, program_id: 1965, roles: ['program', 'ge', 'graduation', 'course_catalog'] },
      'piedmont-virginia-community-college': { catalog_id: 9, program_id: 1070, roles: ['program', 'ge', 'graduation', 'policy', 'gpa_policy', 'course_catalog'] },
      'southwest-virginia-community-college': { catalog_id: 13, program_id: 1613, roles: ['program', 'ge', 'humanities', 'social_sciences', 'graduation', 'policy', 'course_catalog'] },
    };
    for (const slug of slugs) {
      const institution = registry.find((row) => row.slug === slug);
      expect(institution).toMatchObject({
        level: 'community_college',
        degree_context: {
          award: 'AS',
          catalog_year: '2026-2027',
          catalog_version: {
            catalog_id: expected[slug].catalog_id,
            program_id: expected[slug].program_id,
          },
        },
      });
      expect(institution.seeds.map((seed) => seed.role)).toEqual(expected[slug].roles);
      const { extract } = build(slug);
      expect(extract.catalog_year).toBe('2026-2027');
      expect(Object.values(extract.source_layers).every((layer) => layer.status === 'captured')).toBe(true);
      expect(extract.sources.every((source) => source.official && source.secure && source.sha256)).toBe(true);
    }
  });

  it('catalog-accepts all three trees and derives readiness from implemented constraints', () => {
    const expectedReadiness = {
      'new-river-community-college': false,
      'piedmont-virginia-community-college': true,
      'southwest-virginia-community-college': true,
    };
    for (const slug of slugs) {
      const { acceptance, composition, doc } = build(slug);
      expect(composition.composition_status).toBe('composed_full_degree');
      expect(doc).toMatchObject({
        _id: `va:as:${slug}:cs`,
        kind: 'as_degree',
        degree_type: 'AS',
        catalog_year: '2026-2027',
        source_method: 'official_catalog_composition',
        collection_status: 'composed_full_degree',
      });
      expect(acceptance).toMatchObject({
        accepted: true,
        ready_for_analysis: expectedReadiness[slug],
      });
      expect(acceptance.catalog.failed).toEqual([]);
      expect(acceptance.analysis_ready.failed).toEqual(
        expectedReadiness[slug] ? [] : ['constraint_support'],
      );
      expect(composition.source_bundle_required.every(
        (id) => doc.sources.some((source) => source.id === id),
      )).toBe(true);
    }
  });

  it('closes New River at 61-63 without inventing cardinality for its category slots', () => {
    const { composition, doc } = build('new-river-community-college');
    expect(doc).toMatchObject({
      total_units: 61,
      total_units_max: 63,
      unit_audit: {
        modeled_units_minimum: 61,
        modeled_units_maximum: 63,
        residency: { minimum_percent: 25 },
        minimum_curriculum_gpa: 2,
      },
    });
    const science = doc.requirement_groups.find((group) => group.title === 'Laboratory sciences');
    expect(science).toMatchObject({
      distinct_course_ids_across_sections: true,
      sections: [{ unit_advisement: 4 }, { unit_advisement: 4 }],
    });
    expect(options(science)[0]).toEqual(['BIO101']);
    expect(options(science)).toHaveLength(14);
    const csCategory = doc.requirement_groups.find((group) => group.title === 'Computer Science Requirements');
    expect(csCategory).toMatchObject({
      ge_area: 'new_river_computer_science_requirements',
      analysis_constraints: [
        { kind: 'variable_credit_category_with_sequences' },
        { kind: 'no_double_count_across_requirement_slots' },
      ],
      sections: [{ unit_advisement: 6, unit_advisement_max: 8, receivers: [] }],
    });
    expect(doc.option_sets.computer_science_requirements).toEqual(
      composition.option_sets.computer_science_requirements,
    );
    expect(composition.option_sets.computer_science_requirements).toMatchObject({
      required_credits_minimum: 6,
      required_credits_maximum: 8,
      categorical_allowances: ['CSC 1XX', 'World Languages'],
    });
    expect(composition.option_sets.computer_science_requirements.printed_sequences).toEqual([
      ['MTH161', 'MTH162'],
      ['BIO101', 'BIO102'],
      ['CHM111', 'CHM112'],
      ['PHY241', 'PHY242'],
    ]);
  });

  it('models Piedmont as one exact 60-credit path with complete UCGS menus', () => {
    const { composition, doc } = build('piedmont-virginia-community-college');
    expect(doc).toMatchObject({
      total_units: 60,
      total_units_max: 60,
      unit_audit: {
        modeled_units_minimum: 60,
        modeled_units_maximum: 60,
        residency: { minimum_percent: 25 },
        minimum_curriculum_gpa: 2,
      },
    });
    const science = doc.requirement_groups.find((group) => group.title === 'Laboratory science sequence');
    expect(options(science)).toEqual([['BIO101', 'BIO102'], ['CHM111', 'CHM112']]);
    expect(composition.option_sets.social_behavioral_science.courses).toHaveLength(11);
    expect(composition.option_sets.fine_arts_or_literature.courses).toHaveLength(17);
    expect(composition.option_sets.history.courses).toHaveLength(6);
    expect(composition.option_sets.humanities_fine_arts_literature.courses).toHaveLength(28);
  });

  it('closes Southwest from the published 16+14+13+17 rows and keeps each breadth menu exact', () => {
    const { composition, doc } = build('southwest-virginia-community-college');
    expect(doc).toMatchObject({
      total_units: 60,
      total_units_max: 60,
      unit_audit: {
        modeled_units_minimum: 60,
        modeled_units_maximum: 60,
        residency: { minimum_percent: 25 },
        minimum_curriculum_gpa: 2,
      },
    });
    expect(composition.option_sets.history.courses).toHaveLength(6);
    expect(composition.option_sets.humanities_literature_fine_arts.courses).toHaveLength(25);
    expect(composition.option_sets.social_behavioral_science.courses).toHaveLength(14);
    expect(composition.option_sets.social_behavioral_science.courses.some(
      (code) => code.startsWith('HIS'),
    )).toBe(false);
    const humanities = doc.requirement_groups.find(
      (group) => group.title === 'Humanities, Literature, or Fine Arts elective',
    );
    expect(options(humanities)).toHaveLength(25);
    expect(humanities.analysis_constraints[0].kind).toBe('no_double_count_with_fixed_courses');
  });

  it('exposes a deterministic API identity and official title for every concrete option-set course', () => {
    for (const slug of slugs) {
      const { composition, doc } = build(slug);
      const exposed = new Set([...doc.codes_seen, ...Object.keys(doc.course_titles)]);
      const optionCourses = allOptionSetCourses(
        composition.option_sets, composition.course_titles,
      );
      expect(optionCourses.size).toBeGreaterThan(0);
      for (const code of optionCourses) {
        expect(exposed.has(code), `${slug} missing API identity for ${code}`).toBe(true);
        expect(Number.isInteger(courseIdFor(code))).toBe(true);
        expect(doc.course_titles[code]).toEqual(expect.any(String));
      }
      expect(doc.requirement_groups.map((group) => group.title).join(' '))
        .not.toMatch(/recommended schedule|sample plan|suggested semester/i);
    }
  });

  it('backs every retained course identity with the captured official program or menu text', () => {
    const sourceRoles = {
      'new-river-community-college': ['program', 'ge'],
      'piedmont-virginia-community-college': ['program', 'ge'],
      'southwest-virginia-community-college': ['program', 'humanities', 'social_sciences'],
    };
    for (const slug of slugs) {
      const { composition } = build(slug);
      const source = sourceRoles[slug].map((role) => fs.readFileSync(
        path.join(ROOT, 'pages', `${slug}__${role}.txt`), 'utf8',
      )).join('\n');
      for (const code of Object.keys(composition.course_titles)) {
        const match = /^([A-Z]{2,4})(\d{2,4}[A-Z]{0,2})$/.exec(code);
        expect(match, `${slug} has malformed course identity ${code}`).not.toBeNull();
        expect(
          new RegExp(`\\b${match[1]}\\s*${match[2]}\\b`, 'i').test(source),
          `${slug} retains ${code} without captured official-source evidence`,
        ).toBe(true);
      }
    }
  });

  it('retains a durable source-walk audit for all three findings', () => {
    expect(research).toMatchObject({
      schema_version: 1,
      researched_at: '2026-08-10',
      institutions: [
        { slug: 'new-river-community-college', finding: 'current_standalone_cs_as_exists' },
        { slug: 'piedmont-virginia-community-college', finding: 'current_standalone_cs_as_exists' },
        { slug: 'southwest-virginia-community-college', finding: 'current_standalone_cs_as_exists' },
      ],
    });
    for (const row of research.institutions) {
      expect(row.sources.length).toBeGreaterThanOrEqual(4);
      expect(row.sources.every((source) => /^https:\/\//.test(source.url) && source.sha256)).toBe(true);
    }
  });
});
