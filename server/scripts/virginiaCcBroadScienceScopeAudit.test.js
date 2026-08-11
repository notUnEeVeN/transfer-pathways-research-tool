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
  path.join(ROOT, 'research', 'cc-broad-science-scope-audit.json'), 'utf8',
));
const NEGATIVES = [
  'eastern-shore-community-college',
  'mountain-empire-community-college',
  'patrick-henry-community-college',
  'southside-virginia-community-college',
];

const record = (slug) => ({
  institution: registry.find((row) => row.slug === slug),
  extract: JSON.parse(fs.readFileSync(path.join(ROOT, 'requirements', `${slug}.json`), 'utf8')),
});

function composedDegree(slug) {
  const { institution, extract } = record(slug);
  const composition = JSON.parse(fs.readFileSync(path.join(ROOT, 'composed', `${slug}.json`), 'utf8'));
  const compiled = compileDegreeComposition(composition, { institutionLevel: institution.level });
  const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
  const doc = toDocument(extract, institution, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { acceptance, compiled, composition, doc, extract, institution };
}

const concreteOptionCodes = (value) => {
  const out = new Set();
  const visit = (child) => {
    if (typeof child === 'string') {
      if (courseIdFor(child) != null) out.add(child.replace(/\s+/g, '').toUpperCase());
      return;
    }
    if (Array.isArray(child)) child.forEach(visit);
    else if (child && typeof child === 'object') Object.values(child).forEach(visit);
  };
  visit(value);
  return [...out].sort();
};

describe('Virginia broad Science A.S. Computer Science scope audit', () => {
  it.each(NEGATIVES)('%s has a durable, narrowly classified current-catalog negative finding', (slug) => {
    const { institution, extract } = record(slug);
    expect(institution.offers_cs).toBe(false);
    expect(extract).toMatchObject({
      outcome: 'no_cs_program',
      offers_cs: false,
      hand_read: true,
      catalog_year: institution.degree_context.catalog_year,
      program_finding: {
        code: 'broad_science_as_no_cs_specific_curriculum',
        alternate_path: {
          award: 'AS',
          supports_cs_transfer_pathway: false,
        },
      },
    });
    expect(extract.program_finding).toEqual(institution.program_finding);
    expect(extract.program_finding.summary).toMatch(/broad Science A\.S\./);
    expect(extract.program_finding.summary).not.toMatch(/^no (?:CS|Computer Science) program/i);

    const ids = new Set(extract.sources.map((source) => source.id));
    expect(new Set(extract.program_finding.source_refs)).toEqual(
      new Set(['catalog_index', 'broad_science_program']),
    );
    expect(extract.program_finding.source_refs.every((sourceId) => ids.has(sourceId))).toBe(true);
    expect(extract.sources).toHaveLength(2);
    expect(extract.sources.every((source) => (
      source.official === true
      && source.secure === true
      && source.url.startsWith('https://')
      && /^[a-f0-9]{64}$/.test(source.sha256)
    ))).toBe(true);
    expect(extract.source_layers).toMatchObject({
      catalog_identity: { status: 'captured' },
      major: { status: 'not_applicable' },
      general_education: { status: 'not_applicable' },
      graduation: { status: 'not_applicable' },
    });
    expect(fs.existsSync(path.join(ROOT, 'composed', `${slug}.json`))).toBe(false);
  });

  it('composes Mountain Gateway exactly as a generic CS-supported Science A.S.', () => {
    const { acceptance, composition, doc, extract, institution } = composedDegree(
      'mountain-gateway-community-college',
    );
    expect(institution).toMatchObject({
      offers_cs: true,
      acalog_parse: { catalog_id: 9, program_id: 895 },
      degree_context: {
        program: 'Science, AS',
        variant: expect.stringMatching(/generic multi-pathway.*Computer Science.*no CS-specific/i),
      },
    });
    expect(extract).toMatchObject({ outcome: 'captured', offers_cs: true, hand_read: true });
    expect(doc).toMatchObject({
      degree_title_seen: 'Science, Associate of Science — Computer Science-supported generic transfer path',
      catalog_year: '2026-2027',
      total_units: 60,
      total_units_max: 64,
      unit_audit: {
        generic_multi_pathway_degree: true,
        computer_science_supported_pathway: true,
        computer_science_specific_prescribed_branch: false,
        residency: { minimum_percent: 25, minimum_units_on_60_credit_path: 15 },
      },
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual(['constraint_support']);
    expect(acceptance.analysis_ready.checks.find((check) => check.name === 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 60,
    });
    expect(doc.requirement_groups.map((group) => (
      group.sections.reduce((sum, section) => sum + section.unit_advisement, 0)
    ))).toEqual([1, 6, 6, 3, 4, 3, 3, 6, 12, 16]);
    expect(doc.requirement_groups.some((group) => (
      /Biology|Natural Resources|Fall|Spring|Year 1|Year 2/i.test(group.title)
    ))).toBe(false);
    expect(new Set(extract.sources.map((source) => source.id))).toEqual(
      new Set(composition.source_bundle_required),
    );
  });

  it('publishes deterministic identities and titles for every concrete Mountain Gateway option', () => {
    const { compiled, composition, doc } = composedDegree('mountain-gateway-community-college');
    const optionCodes = concreteOptionCodes(composition.option_sets);
    expect(optionCodes.length).toBeGreaterThan(40);
    expect(optionCodes.every((code) => compiled.codes_seen.includes(code))).toBe(true);
    expect(optionCodes.every((code) => doc.codes_seen.includes(code))).toBe(true);
    expect(optionCodes.every((code) => (
      typeof doc.course_titles[code] === 'string' && doc.course_titles[code].length > 0
    ))).toBe(true);
    expect(optionCodes.every((code) => courseIdFor(code) > 0)).toBe(true);
    expect(doc.option_sets).toEqual(composition.option_sets);
  });

  it('keeps Christopher Newport reproducible through its official role-complete PDF bundle', () => {
    const { institution, extract } = record('christopher-newport-university');
    expect(institution).toMatchObject({
      platform: 'pdf',
      pdf_parse: {
        requirements_start_anchor: 'Students pursuing the major in computer science are strongly',
        requirements_end_anchor: 'Major in Cybersecurity',
        program_identity_start_anchor: 'Bachelor of Science degree in Computer Foundations',
        program_pdf_pages: [269, 270],
        program_printed_pages: [269, 270],
      },
    });
    expect(institution.seeds.map((seed) => seed.role)).toEqual([
      'program', 'ge', 'college', 'graduation', 'course_catalog',
    ]);
    expect(extract).toMatchObject({ platform: 'pdf', hand_read: true, catalog_year: '2025-2026' });
    expect(extract.sources.map((source) => source.role)).toEqual([
      'program', 'ge', 'college', 'graduation', 'course_catalog',
    ]);
    expect(extract.sources.every((source) => (
      source.official === true
      && source.url.startsWith('https://cnu.edu/')
      && /^[a-f0-9]{64}$/.test(source.sha256)
    ))).toBe(true);
    expect(new Set(extract.sources.map((source) => source.sha256))).toEqual(
      new Set(['decd8d2605842c3ce1fc7714dda8c4c1eb82abc293b89f0208773a4dd09112ec']),
    );
    expect(extract.source_layers).toMatchObject({
      major: { status: 'captured' },
      general_education: { status: 'captured' },
      college: { status: 'captured' },
      graduation: { status: 'captured' },
      course_catalog: { status: 'captured' },
    });
    expect(composedDegree(institution.slug).acceptance.accepted).toBe(true);
  });

  it('records the final intended 24-college outcome contract', () => {
    expect(research.summary.expected_primary_cc_cohort_after_all_batches).toEqual({
      accepted_cs_directed_paths: 19,
      source_backed_no_current_cs_specific_path_findings: 5,
      total: 24,
    });
  });
});
