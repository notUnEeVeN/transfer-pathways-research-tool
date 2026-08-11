import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { courseIdFor } from '../services/virginia/courseIdentity';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
const SLUGS = ['wytheville-community-college', 'tidewater-community-college'];

function degree(slug) {
  const institution = registry.find((row) => row.slug === slug);
  const extract = JSON.parse(fs.readFileSync(path.join(ROOT, 'requirements', `${slug}.json`), 'utf8'));
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

const check = (acceptance, bucket, name) => acceptance[bucket].checks.find((row) => row.name === name);

const optionSetCodes = (composition) => {
  const found = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value && typeof value === 'object') { Object.values(value).forEach(visit); return; }
    if (typeof value === 'string' && /^[A-Z]{2,4}\d{3}[A-Z]?$/.test(value)) found.add(value);
  };
  visit(composition.option_sets || {});
  return [...found];
};

describe('Wytheville and Tidewater current Computer Science A.S. compositions', () => {
  it.each(SLUGS)('%s is catalog-accepted with exact constraints retained for analysis', (slug) => {
    const { acceptance, composition, doc, extract } = degree(slug);
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual(['constraint_support']);
    expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: composition.total_units,
    });
    expect(check(acceptance, 'analysis_ready', 'course_resolution').severity).toBe('pass');
    expect(doc.status).toBe('extracted');
    expect(extract.hand_read).toBe(true);
    expect(extract.validation).toMatchObject({ verdict: 'pass', needs_hand_read: false });
    const sourceIds = new Set(extract.sources.map((source) => source.id));
    for (const required of composition.source_bundle_required) expect(sourceIds.has(required)).toBe(true);
    expect(extract.sources.every((source) => (
      source.official === true
      && source.secure === true
      && typeof source.sha256 === 'string'
      && source.sha256.length === 64
    ))).toBe(true);
    expect(doc.requirement_groups.some((group) => (
      /suggested|semester|schedule|plan of study/i.test(group.title)
    ))).toBe(false);
  });

  it.each(SLUGS)('%s exposes deterministic identities and titles for every option-set course', (slug) => {
    const { composition, doc } = degree(slug);
    for (const code of optionSetCodes(composition)) {
      expect(doc.course_titles[code]).toEqual(expect.any(String));
      expect(doc.course_titles[code].length).toBeGreaterThan(0);
      expect(courseIdFor(code)).toBeGreaterThan(0);
    }
  });

  it('preserves Wytheville exact 62-credit tree, paired physics slots, and open transfer elective', () => {
    const { composition, doc, extract } = degree('wytheville-community-college');
    expect(doc).toMatchObject({
      degree_title_seen: 'Science, Major in Computer Science, AS',
      total_units: 62,
      total_units_max: 62,
      unit_audit: {
        modeled_units_minimum: 62,
        minimum_program_gpa: 2,
        computer_competency_required: true,
        residency: { minimum_percent: 25, minimum_units_on_62_credit_path: 15.5 },
      },
    });
    expect(extract.sources.every((source) => source.local_text && source.local_html)).toBe(true);
    expect(composition.option_sets.humanities_elective.courses).toHaveLength(7);
    const humanities = doc.requirement_groups.find((group) => (
      group.title === 'Two humanities electives from different clusters'
    ));
    expect(humanities).toMatchObject({ distinct_course_ids_across_sections: true });
    expect(humanities.sections).toHaveLength(2);
    const physics = doc.requirement_groups.find((group) => group.title === 'Two-course physics sequence');
    expect(physics.sections.map((section) => section.receivers[0].options.map((option) => option.course_keys))).toEqual([
      [['va:PHY201'], ['va:PHY241']],
      [['va:PHY202'], ['va:PHY242']],
    ]);
    const elective = doc.requirement_groups.find((group) => (
      group.title === 'Computer Science or Engineering transfer elective'
    ));
    expect(elective.sections[0].receivers[0].options.map((option) => option.course_keys)).toEqual([
      ['va:EGR121'], ['va:EGR122'], ['va:CSC215'],
    ]);
    expect(elective.analysis_constraints.map((constraint) => constraint.kind)).toContain(
      'advisor_approved_transfer_course_open_option',
    );
  });

  it('catalog-accepts Tidewater only from the complete retained source walk, not the blocked origin response', () => {
    const { acceptance, composition, doc, extract } = degree('tidewater-community-college');
    expect(composition.capture_gate).toMatchObject({
      status: 'source_walk_complete_origin_cloudflare',
      direct_origin_capture_status: 'blocked_cloudflare_403',
      catalog_acceptance_allowed: true,
    });
    expect(composition.research_sources).toHaveLength(4);
    expect(composition.research_sources.every((source) => (
      source.official === true
      && source.evidence_retained_locally === true
      && source.evidence_method === 'transparent_render_of_exact_official_origin_plus_hand_read'
    ))).toBe(true);
    expect(extract.sources.filter((source) => source.id !== 'vccs_master_csc221').every((source) => (
      source.capture_transport === 'transparent_render_of_exact_official_origin'
      && source.evidence_artifact === 'server/.va-catalogs/research/cc-wytheville-tidewater-composition.json'
    ))).toBe(true);
    expect(doc).toMatchObject({
      total_units: 60,
      total_units_max: 63,
      status: 'extracted',
      unit_audit: {
        modeled_canonical_units: 60,
        minimum_program_gpa: 2,
        residency: { minimum_percent: 25 },
      },
    });
    expect(acceptance.accepted).toBe(true);
  });

  it('preserves Tidewater nested math, complete GE dictionaries, and two technical slots', () => {
    const { composition, doc } = degree('tidewater-community-college');
    expect(composition.precalculus_requirement_paths).toEqual([
      expect.objectContaining({ kind: 'course', all_of: ['MTH167'], units: 5 }),
      expect.objectContaining({ kind: 'series', all_of: ['MTH161', 'MTH162'], units: 6 }),
      expect.objectContaining({ kind: 'direct_placement', condition: 'Student places directly into MTH 263' }),
    ]);
    const preparation = doc.requirement_groups.find((group) => (
      group.title === 'Precalculus preparation or direct-placement replacement path'
    ));
    expect(preparation).toMatchObject({ group_conjunction: 'Or', canonical_section_index: 0 });
    expect(preparation.sections.map((section) => section.unit_advisement)).toEqual([5, 6]);
    expect(preparation.sections[1].receivers[0].options[0]).toMatchObject({
      course_keys: ['va:MTH161', 'va:MTH162'], course_conjunction: 'and',
    });

    expect(composition.option_sets.humanities.categories).toMatchObject({
      artistic_expression: expect.any(Array),
      human_culture: expect.any(Array),
      literature_and_creative_writing: expect.any(Array),
    });
    expect(composition.option_sets.humanities.categories.artistic_expression).toHaveLength(9);
    expect(composition.option_sets.humanities.categories.human_culture).toHaveLength(11);
    expect(composition.option_sets.humanities.categories.literature_and_creative_writing).toHaveLength(10);
    expect(composition.option_sets.social_science_excluding_history.courses).toHaveLength(22);
    expect(composition.option_sets.world_language.courses).toHaveLength(13);

    const humanities = doc.requirement_groups.find((group) => (
      group.title === 'Humanities from two distinct categories'
    ));
    expect(humanities).toMatchObject({ distinct_course_ids_across_sections: true });
    expect(humanities.sections).toHaveLength(2);
    expect(humanities.sections.every((section) => section.unit_advisement === 3)).toBe(true);

    const technical = doc.requirement_groups.find((group) => (
      group.title === 'Two distinct technical selections'
    ));
    expect(technical).toMatchObject({ distinct_course_ids_across_sections: true });
    expect(technical.sections.map((section) => section.label_seen)).toEqual([
      'Technical slot A — printed CSC 215 slot governed by footnote 8',
      'Technical slot B — footnote 7',
    ]);
    expect(technical.sections[0].receivers[0].options.map((option) => option.course_keys)).toEqual(
      expect.arrayContaining([['va:PHY201'], ['va:CSC205'], ['va:CSC215'], ['va:EGR270'], ['va:SPA102']]),
    );
    expect(technical.sections[1].receivers[0].options.map((option) => option.course_keys)).toEqual([
      ['va:CSC205'], ['va:CSC215'], ['va:MTH265'],
    ]);
    expect(technical.analysis_constraints.map((constraint) => constraint.kind)).toContain(
      'footnote_8_source_language_ambiguity',
    );
  });
});
