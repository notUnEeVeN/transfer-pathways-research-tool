import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { courseIdFor } from '../services/virginia/courseIdentity';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
const research = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'research', 'cc-highlands-peninsula-western-composition.json'),
  'utf8',
));

const SLUGS = [
  'virginia-highlands-community-college',
  'virginia-peninsula-community-college',
  'virginia-western-community-college',
];

function composedDegree(slug) {
  const institution = registry.find((row) => row.slug === slug);
  const evidence = research.institutions.find((row) => row.slug === slug);
  const extract = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'requirements', `${slug}.json`),
    'utf8',
  ));
  const composition = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'composed', `${slug}.json`),
    'utf8',
  ));
  const compiled = compileDegreeComposition(composition, { institutionLevel: institution.level });

  // A reviewed composition is itself official catalog evidence for course
  // identity. Keep the statewide credit lookup empty so missing local titles
  // cannot be hidden by unrelated Transfer Virginia rows.
  const credits = new Map();
  const doc = toDocument(extract, institution, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return {
    acceptance, compiled, composition, doc, evidence, extract, institution,
  };
}

const check = (acceptance, bucket, name) => acceptance[bucket].checks
  .find((row) => row.name === name);

const optionCodes = (section) => section.receivers.flatMap((receiver) => receiver.options.map(
  (option) => option.course_keys.map((key) => key.slice(3)),
));

function optionSetCodes(optionSets) {
  return [...new Set(Object.values(optionSets || {}).flatMap((set) => [
    ...(set.courses || []),
    ...Object.values(set.categories || {}).flat(),
    ...(set.routes || []).flat(),
  ]))].sort();
}

describe('Virginia Highlands, Peninsula, and Western official-source CS A.S. compositions', () => {
  it('pins every institution to its current official 2026-2027 catalog identity', () => {
    const highlands = registry.find((row) => row.slug === SLUGS[0]);
    expect(highlands).toMatchObject({
      platform: 'pdf',
      pdf_parse: {
        catalog_sha256: 'a3126a08f12390d358094695a87df51d81cbf0c90c80c7b51b949dc845735e3a',
        catalog_pdf_pages: 266,
        program_pdf_pages: [62, 64],
      },
      degree_context: { catalog_year: '2026-2027', award: 'AS' },
    });
    expect(highlands.seeds.map((seed) => seed.role)).toEqual([
      'program', 'ge', 'graduation', 'course_catalog',
    ]);

    const peninsula = registry.find((row) => row.slug === SLUGS[1]);
    expect(peninsula).toMatchObject({
      platform: 'acalog',
      acalog_parse: { catalog_id: 26, program_id: 6026 },
      degree_context: { catalog_year: '2026-2027', award: 'AS', program_code: '246' },
    });
    expect(peninsula.seeds.find((seed) => seed.role === 'program').url)
      .toBe('https://catalog.vpcc.edu/preview_program.php?catoid=26&poid=6026');
    expect(peninsula.seeds.map((seed) => seed.url).join(' ')).not.toContain('catoid=13');

    const western = registry.find((row) => row.slug === SLUGS[2]);
    expect(western).toMatchObject({
      platform: 'acalog',
      acalog_parse: { catalog_id: 25, program_id: 3520 },
      degree_context: { catalog_year: '2026-2027', award: 'AS', program_code: '246' },
    });
    expect(western.seeds.find((seed) => seed.role === 'program').url)
      .toBe('https://catalog.virginiawestern.edu/preview_program.php?catoid=25&poid=3520&returnto=2597');
    expect(western.seeds.map((seed) => seed.url).join(' ')).not.toContain('catoid=22');
  });

  it('imports all three full compositions with captured provenance and researcher-facing option identities', () => {
    for (const slug of SLUGS) {
      const {
        acceptance, composition, doc,
      } = composedDegree(slug);
      expect(doc).toMatchObject({
        _id: `va:as:${slug}:cs`,
        college_id: `va:cc:${slug}`,
        source_method: 'official_catalog_composition',
        collection_status: 'composed_full_degree',
        catalog_year: '2026-2027',
        option_sets: composition.option_sets,
        provenance: {
          composition_artifact: `server/.va-catalogs/composed/${slug}.json`,
          composition_schema_version: 1,
        },
      });
      expect(composition.source_bundle_required.every(
        (sourceId) => doc.sources.some((source) => source.id === sourceId),
      )).toBe(true);
      expect(Object.values(doc.capture_layers).every((layer) => layer.status === 'captured'))
        .toBe(true);
      for (const optionSet of Object.values(composition.option_sets)) {
        expect(optionSet.source_refs.every(
          (sourceId) => doc.sources.some((source) => source.id === sourceId),
        )).toBe(true);
      }
      for (const code of optionSetCodes(composition.option_sets)) {
        expect(composition.course_titles[code], `${slug} ${code} title`).toBeTruthy();
        expect(doc.codes_seen, `${slug} ${code} API identity`).toContain(code);
        expect(Number.isInteger(courseIdFor(code)), `${slug} ${code} numeric id`).toBe(true);
      }
      expect(doc.requirement_groups.some((group) => group.units_fill)).toBe(false);
      expect(acceptance.catalog.failed).toEqual([]);
      expect(check(acceptance, 'analysis_ready', 'course_resolution').severity).toBe('pass');
      expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
        severity: 'pass', modeled_units: 60,
      });
      expect(doc.requirement_groups.map((group) => group.title).join(' '))
        .not.toMatch(/fall|spring|semester|plan of study|recommended/i);
    }
  });

  it('closes Virginia Highlands at 60 and retains its exact breadth and recurring math rules', () => {
    const {
      acceptance, composition, doc, evidence, extract,
    } = composedDegree(SLUGS[0]);
    expect(evidence).toMatchObject({
      finding: 'current_standalone_cs_as_exists',
      catalog: {
        binary_sha256: 'a3126a08f12390d358094695a87df51d81cbf0c90c80c7b51b949dc845735e3a',
        pages: 266,
      },
      degree: { published_total_credits: '60-63', modeled_total_credits: '60-62' },
    });
    expect(extract.pdf_window).toMatchObject({
      found: true, start_page: 62, end_page: 64,
    });
    expect(doc).toMatchObject({
      total_units: 60,
      total_units_max: 62,
      published_unit_audit: {
        published_program_units_minimum: 60,
        published_program_units_maximum: 63,
      },
      unit_audit: {
        modeled_units_minimum: 60,
        modeled_units_maximum: 62,
        residency: { minimum_percent: 25 },
        minimum_curriculum_gpa: 2,
      },
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: true });
    expect(acceptance.analysis_ready.failed).toEqual([]);
    expect(check(acceptance, 'analysis_ready', 'constraint_support').severity).toBe('pass');

    const math = doc.requirement_groups.find((group) => group.title === 'Mathematics progression');
    expect(math.distinct_course_ids_across_sections).toBe(true);
    expect(math.analysis_constraints.map((constraint) => constraint.kind)).toEqual([
      'no_double_count_across_requirement_slots',
    ]);
    expect(math.sections.map(optionCodes)).toEqual([
      [['MTH161'], ['MTH263']],
      [['MTH162'], ['MTH264']],
      [['MTH263'], ['MTH265']],
      [['MTH264'], ['MTH266']],
    ]);
    expect(composition.option_sets.ucgs_block_ii_non_literature.categories).toMatchObject({
      art: expect.any(Array), humanities: expect.any(Array),
    });
    expect(optionSetCodes({ block: composition.option_sets.ucgs_block_ii_non_literature }))
      .toHaveLength(12);
    expect(optionSetCodes({ block: composition.option_sets.ucgs_block_ii_non_literature }))
      .not.toEqual(expect.arrayContaining(['ENG245', 'ENG246']));
    expect(composition.option_sets.ucgs_block_iii.courses).toHaveLength(9);

    const science = doc.requirement_groups.find(
      (group) => group.title === 'UCGS Block IV — Natural Sciences',
    );
    expect(science).toMatchObject({
      distinct_course_ids_across_sections: true,
      sections: [{ unit_advisement: 4 }, { unit_advisement: 4 }],
    });
    expect(optionCodes(science.sections[0])).toHaveLength(12);
    expect(optionCodes(science.sections[1])).toEqual(optionCodes(science.sections[0]));
  });

  it('preserves Virginia Peninsula category-distinct UCGS breadth and dynamic elective menus', () => {
    const {
      acceptance, composition, doc, evidence,
    } = composedDegree(SLUGS[1]);
    expect(evidence).toMatchObject({
      finding: 'current_standalone_cs_as_exists',
      catalog: { catalog_id: 26, program_id: 6026, program_code: '246' },
      degree: { published_total_credits: '60-63', modeled_total_credits: '60-63' },
    });
    expect(doc).toMatchObject({
      total_units: 60,
      total_units_max: 63,
      unit_audit: {
        modeled_units_minimum: 60,
        modeled_units_maximum: 63,
        residency: { minimum_percent: 25 },
        minimum_curriculum_gpa: 2,
      },
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: true });
    expect(acceptance.analysis_ready.failed).toEqual([]);

    const blockII = doc.requirement_groups.find(
      (group) => group.title === 'UCGS Block II — Arts, Humanities, and Literature',
    );
    expect(blockII).toMatchObject({
      distinct_course_ids_across_sections: true,
      analysis_constraints: [{
        kind: 'distinct_categories_across_sections',
        status: 'supported',
        minimum_distinct_categories: 2,
      }],
      sections: [{ unit_advisement: 3 }, { unit_advisement: 3 }],
    });
    expect(optionCodes(blockII.sections[0])).toHaveLength(31);
    expect(optionCodes(blockII.sections[1])).toEqual(optionCodes(blockII.sections[0]));
    expect(Object.fromEntries(Object.entries(composition.option_sets.ucgs_block_ii.categories)
      .map(([name, courses]) => [name, courses.length]))).toEqual({
      arts: 9, humanities: 15, literature: 7,
    });
    expect(composition.option_sets.ucgs_block_iii.courses).toHaveLength(12);
    expect(composition.option_sets.ucgs_block_vi.courses).toHaveLength(6);
    expect(composition.option_sets.computer_science_1.courses).toHaveLength(16);
    expect(composition.option_sets.computer_science_2.courses).toHaveLength(17);

    const cs2 = doc.requirement_groups.find(
      (group) => group.title === 'Computer Science 2 approved choices',
    );
    expect(cs2).toMatchObject({
      stated_credits: '7-10',
      sections: [{ section_advisement: 3, unit_advisement: 10 }],
    });
    expect(cs2.sections[0].receivers).toHaveLength(17);
    expect(cs2.analysis_constraints.map((constraint) => constraint.kind)).toEqual([
      'dynamic_elective_credits_to_degree_minimum',
      'variable_choice_count_with_minimum_units',
      'no_double_count_across_requirement_slots',
    ]);
    expect(composition.modeling_notes.join(' ')).toMatch(/MTH 161\/162 prerequisite/i);
  });

  it('fully resolves Virginia Western pseudo-courses and keeps the science sequence as AND inside OR', () => {
    const {
      acceptance, composition, doc, evidence,
    } = composedDegree(SLUGS[2]);
    expect(evidence).toMatchObject({
      finding: 'current_standalone_cs_as_exists',
      catalog: { catalog_id: 25, program_id: 3520, program_code: '246' },
      degree: { published_total_credits_minimum: 60, modeled_total_credits: '60-61' },
      excluded_variant: expect.stringMatching(/Engineering: Computer Science Major/),
    });
    expect(doc).toMatchObject({
      total_units: 60,
      total_units_max: 61,
      unit_audit: {
        modeled_units_minimum: 60,
        modeled_units_maximum: 61,
        residency: { minimum_percent: 25 },
        minimum_curriculum_gpa: 2,
      },
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: true });
    expect(acceptance.analysis_ready.failed).toEqual([]);
    expect(composition.catalog_version).toMatchObject({
      social_science_menu_course_id: 29546,
      literature_menu_course_id: 29505,
    });
    expect(composition.option_sets.social_science_elective.courses).toEqual([
      'ECO201', 'GEO210', 'PLS135', 'PLS241', 'PSY200', 'SOC200', 'SOC268',
    ]);
    expect(composition.option_sets.literature_elective.courses).toEqual([
      'ENG225', 'ENG245', 'ENG246', 'ENG250', 'ENG255', 'ENG258', 'ENG275',
    ]);
    expect(composition.option_sets.laboratory_science_sequence.routes).toEqual([
      ['CHM111', 'CHM112'], ['PHY241', 'PHY242'],
    ]);

    const science = doc.requirement_groups.find((group) => group.title === 'Laboratory science sequence');
    expect(science.sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 8 });
    expect(optionCodes(science.sections[0])).toEqual([
      ['CHM111', 'CHM112'], ['PHY241', 'PHY242'],
    ]);
    expect(doc.codes_seen).not.toEqual(expect.arrayContaining(['SocialScienceELE', 'ENGLIT']));
  });

  it('records the source-complete verdict separately from evaluator limitations', () => {
    expect(research.summary).toEqual({
      institutions_composed: 3,
      current_standalone_cs_as: 3,
      catalog_acceptance_passed: 3,
      analysis_ready: 3,
      analysis_blockers: {
        'virginia-highlands-community-college': [],
        'virginia-peninsula-community-college': [],
        'virginia-western-community-college': [],
      },
    });
    for (const slug of SLUGS) {
      const { acceptance, evidence } = composedDegree(slug);
      expect(evidence.catalog_acceptance.accepted).toBe(true);
      expect(evidence.catalog_acceptance.ready_for_analysis).toBe(acceptance.ready_for_analysis);
      expect(evidence.catalog_acceptance.analysis_blockers).toEqual(
        acceptance.analysis_ready.failed,
      );
    }
  });
});
