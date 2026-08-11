import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { courseIdFor } from '../services/virginia/courseIdentity';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'institutions.json'), 'utf8',
)).institutions;
const research = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'research', 'cc-danville-rappahannock-audit.json'), 'utf8',
));

const institution = (slug) => registry.find((row) => row.slug === slug);
const requirement = (slug) => JSON.parse(fs.readFileSync(
  path.join(ROOT, 'requirements', `${slug}.json`), 'utf8',
));

function rappahannock() {
  const slug = 'rappahannock-community-college';
  const inst = institution(slug);
  const extract = requirement(slug);
  const composition = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'composed', `${slug}.json`), 'utf8',
  ));
  const compiled = compileDegreeComposition(composition, {
    institutionLevel: inst.level,
  });
  const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
  const doc = toDocument(extract, inst, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: inst.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { acceptance, compiled, composition, doc, extract, inst };
}

function optionCodes(value, titles, found = new Set()) {
  if (typeof value === 'string' && Object.hasOwn(titles, value)) found.add(value);
  else if (Array.isArray(value)) value.forEach((entry) => optionCodes(entry, titles, found));
  else if (value && typeof value === 'object') Object.values(value)
    .forEach((entry) => optionCodes(entry, titles, found));
  return found;
}

describe('Danville and Rappahannock current Computer Science transfer-award audit', () => {
  it('records Danville as a sourced current-catalog discontinuation, not a discovery guess', () => {
    const inst = institution('danville-community-college');
    const extract = requirement('danville-community-college');

    expect(inst).toMatchObject({
      level: 'community_college',
      offers_cs: false,
      degree_context: {
        catalog_year: '2026-2027',
        catalog_version: { catalog_id: 7, program_index_nav_id: 222 },
      },
      program_finding: {
        code: 'current_cs_transfer_specialization_discontinued',
        alternate_path: {
          program: 'Science (AS)',
          computer_science_alignment: 'not_defined_by_current_catalog',
        },
      },
    });
    expect(inst.seeds.map((source) => source.role)).toEqual([
      'catalog',
      'current_program_index',
      'stale_public_index',
      'prior_program',
      'alternate_science_program',
    ]);
    expect(extract).toMatchObject({
      outcome: 'no_cs_program',
      offers_cs: false,
      catalog_year: '2026-2027',
      program_finding: {
        code: 'current_cs_transfer_specialization_discontinued',
      },
    });
    expect(extract.sources.map((source) => source.id)).toEqual([
      'catalog',
      'current_program_index',
      'stale_public_index',
      'prior_program',
      'alternate_science_program',
    ]);
    expect(extract.sources.every((source) => (
      source.official && source.secure && /^[a-f0-9]{64}$/.test(source.sha256)
    ))).toBe(true);
    expect(Object.values(extract.source_layers).every(
      (layer) => layer.status === 'captured',
    )).toBe(true);
    const currentPrograms = fs.readFileSync(path.join(
      ROOT, 'pages', 'danville-community-college__current_program_index.txt',
    ), 'utf8');
    const stalePrograms = fs.readFileSync(path.join(
      ROOT, 'pages', 'danville-community-college__stale_public_index.txt',
    ), 'utf8');
    const currentScience = fs.readFileSync(path.join(
      ROOT, 'pages', 'danville-community-college__alternate_science_program.txt',
    ), 'utf8');
    expect(currentPrograms).toContain('2026-2027 DCC College Catalog');
    expect(currentPrograms).toContain('•\u00a0 Science (AS)');
    expect(currentPrograms).not.toMatch(/Computer Science/i);
    expect(stalePrograms).toContain('Science - Computer Science Specialization');
    expect(currentScience).toContain('medical or other science-related programs of study');
    expect(currentScience).not.toMatch(/Computer Science/i);
    expect(extract.sources.find((source) => source.id === 'prior_program')).toMatchObject({
      requested_url: 'https://catalog.danville.edu/preview_program.php?catoid=4&poid=450&returnto=108',
      url: 'https://catalog.danville.edu/index.php?catoid=7',
    });
    expect(fs.existsSync(path.join(
      ROOT, 'composed', 'danville-community-college.json',
    ))).toBe(false);
  });

  it('pins the Rappahannock CS-transfer relationship and every degree layer to current sources', () => {
    const { composition, extract, inst } = rappahannock();
    expect(inst).toMatchObject({
      level: 'community_college',
      acalog_parse: { catalog_id: 9, program_id: 695 },
      degree_context: {
        award: 'AS',
        catalog_year: '2026-2027',
        cip_code: '30.0101',
      },
    });
    expect(extract).toMatchObject({
      outcome: 'captured',
      offers_cs: true,
      catalog_year: '2026-2027',
      total_credits: { min: 60, max: 62 },
    });
    expect(extract.sources.map((source) => source.id)).toEqual(
      composition.source_bundle_required,
    );
    expect(extract.sources.every((source) => (
      source.official && source.secure && /^[a-f0-9]{64}$/.test(source.sha256)
    ))).toBe(true);
    expect(Object.values(extract.source_layers).every(
      (layer) => layer.status === 'captured',
    )).toBe(true);
    expect(extract.source_layers.program_applicability.source_refs).toEqual(['program_intent']);
  });

  it('catalog-accepts the complete 60-62 credit Rappahannock tree', () => {
    const { acceptance, composition, doc } = rappahannock();
    expect(doc).toMatchObject({
      _id: 'va:as:rappahannock-community-college:cs',
      kind: 'as_degree',
      degree_type: 'AS',
      catalog_year: '2026-2027',
      status: 'extracted',
      source_method: 'official_catalog_composition',
      collection_status: 'composed_full_degree',
      total_units: 60,
      total_units_max: 62,
      unit_audit: {
        modeled_units_minimum: 60,
        modeled_units_maximum: 62,
        residency: { minimum_percent: 25 },
        minimum_curriculum_gpa: 2,
        computer_literacy: { satisfied_by_fixed_course: 'ITE152' },
      },
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual(['constraint_support']);

    const minimum = doc.requirement_groups.flatMap((group) => group.sections)
      .reduce((sum, section) => sum + (section.unit_advisement || 0), 0);
    const maximum = doc.requirement_groups.flatMap((group) => group.sections)
      .reduce((sum, section) => sum + (section.unit_advisement_max || 0), 0);
    expect([minimum, maximum]).toEqual([60, 62]);
    expect(composition.requirement_groups.map((group) => group.title).join(' '))
      .not.toMatch(/sample|suggested|recommended schedule|semester plan/i);
  });

  it('preserves the complete menus without inventing a Computer Science sequence', () => {
    const { composition, doc } = rappahannock();
    const options = composition.option_sets;
    expect(options.ucgs_laboratory_science_i.courses).toHaveLength(14);
    expect(options.approved_transfer_laboratory_science_ii.courses).toHaveLength(20);
    expect(options.history.courses).toHaveLength(6);
    expect(options.non_history_social_behavioral_science.courses).toHaveLength(9);
    expect(options.non_literature_humanities_fine_arts.courses).toHaveLength(11);
    expect(options.literature.courses).toHaveLength(6);
    expect(options.social_behavioral_science.courses).toHaveLength(15);
    expect(options.communication_humanities_fine_arts.courses).toHaveLength(19);
    expect(options.approved_transfer_electives).toMatchObject({
      required_credits_minimum: 18,
      required_credits_maximum: 19,
      computer_science_course_prescribed: false,
    });
    expect(options.approved_transfer_electives.courses).toHaveLength(123);
    const menuText = fs.readFileSync(path.join(
      ROOT, 'pages', 'rappahannock-community-college__ge.txt',
    ), 'utf8');
    const menuWindow = menuText.slice(
      menuText.indexOf('Courses which meet the APPROVED TRANSFER ELECTIVES requirement'),
      menuText.indexOf('Note(s):'),
    );
    const capturedMenu = [...menuWindow.matchAll(
      /^(?:\s*)([A-Z]{2,4})\s+(\d{3}[A-Z]?)\s*[-–—]/gm,
    )].map((match) => `${match[1]}${match[2]}`)
      .filter((code, index, all) => all.indexOf(code) === index);
    expect(options.approved_transfer_electives.courses).toEqual(capturedMenu);
    expect(options.approved_transfer_electives.courses.some(
      (code) => code.startsWith('CSC'),
    )).toBe(false);
    expect(doc.option_sets).toEqual(options);

    const electives = doc.requirement_groups.find(
      (group) => group.title === 'Advisor-selected approved transfer electives',
    );
    expect(electives).toMatchObject({
      ge_area: 'rcc_approved_transfer_electives_for_receiving_major',
      sections: [{
        unit_advisement: 18,
        unit_advisement_max: 19,
        receivers: [],
      }],
    });
  });

  it('exposes deterministic IDs and official titles for every concrete option code', () => {
    const { composition, doc } = rappahannock();
    const codes = optionCodes(composition.option_sets, composition.course_titles);
    expect(codes.size).toBe(129);
    for (const code of codes) {
      expect(Number.isInteger(courseIdFor(code)), code).toBe(true);
      expect(composition.course_titles[code], code).toEqual(expect.any(String));
      expect(doc.codes_seen).toContain(code);
      expect(doc.course_titles[code]).toBe(composition.course_titles[code]);
    }

    const officialMenus = [
      'rappahannock-community-college__program.txt',
      'rappahannock-community-college__ge.txt',
    ].map((file) => fs.readFileSync(path.join(ROOT, 'pages', file), 'utf8')).join('\n');
    for (const code of Object.keys(composition.course_titles)) {
      const match = /^([A-Z]{2,4})(\d{3}[A-Z]?)$/.exec(code);
      expect(match, `malformed course identity ${code}`).not.toBeNull();
      expect(
        new RegExp(`\\b${match[1]}\\s*${match[2]}\\b`, 'i').test(officialMenus),
        `${code} lacks captured official-source evidence`,
      ).toBe(true);
    }
  });

  it('retains a durable, hashed source-walk audit for both decisions', () => {
    expect(research).toMatchObject({
      schema_version: 1,
      researched_at: '2026-08-10',
      institutions: [
        {
          slug: 'danville-community-college',
          finding: 'current_cs_transfer_specialization_discontinued',
        },
        {
          slug: 'rappahannock-community-college',
          finding: 'current_general_science_as_explicitly_supports_cs_transfer',
          catalog_acceptance: {
            accepted: true,
            ready_for_analysis: false,
            analysis_blockers: ['constraint_support'],
          },
        },
      ],
    });
    for (const row of research.institutions) {
      expect(row.sources.length).toBeGreaterThanOrEqual(5);
      expect(row.sources.every((source) => (
        /^https:\/\//.test(source.url || source.final_url)
        && /^[a-f0-9]{64}$/.test(source.sha256)
      ))).toBe(true);
    }
  });
});
