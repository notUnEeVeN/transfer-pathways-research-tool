import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { courseIdFor } from '../services/virginia/courseIdentity';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;

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
  return { acceptance, compiled, composition, doc, institution };
}

const check = (acceptance, bucket, name) => acceptance[bucket].checks.find((row) => row.name === name);

describe('Reynolds and Tidewater source-composed Computer Science A.S. degrees', () => {
  it('catalog-accepts only Reynolds selected B.S.-destination variant at exactly 63 credits', () => {
    const { acceptance, composition, doc } = degree('j-sargeant-reynolds-community-college');
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual(['constraint_support']);
    expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 63,
    });
    expect(doc).toMatchObject({
      degree_title_seen: 'Computer Science, A.S. — B.S.-destination requirements',
      degree_type: 'AS',
      total_units: 63,
      total_units_max: 63,
      unit_audit: {
        selected_variant_units: 63,
        minimum_program_gpa: 2,
        residency: { minimum_percent: 25 },
      },
    });
    expect(composition.selected_variant).toMatchObject({
      key: 'full_time_bs_destination', source_ref: 'major', catalog_program_id: 4173,
    });
    expect(composition.data_quality_flags.map((flag) => flag.code)).toContain(
      'bs_map_one_credit_internal_conflict',
    );
    expect(doc.requirement_groups.some((group) => /Year|Semester|plan of study/i.test(group.title))).toBe(false);
  });

  it('retains the B.A. 62-63 tree as a separate compilable source variant', () => {
    const { composition, doc, institution } = degree('j-sargeant-reynolds-community-college');
    const variants = composition.requirement_variants;
    expect(variants.map((variant) => variant.key)).toEqual([
      'full_time_bs_destination',
      'full_time_ba_destination',
    ]);
    const ba = variants[1];
    expect(ba).toMatchObject({
      selected: false,
      source_refs: ['catalog', 'program_ba'],
      published_units_minimum: 62,
      published_units_maximum: 63,
    });
    const compiledBa = compileDegreeComposition({
      ...composition,
      requirement_groups: ba.requirement_groups,
    }, { institutionLevel: institution.level });
    const canonicalBaUnits = compiledBa.requirement_groups.reduce((total, group) => (
      total + group.sections.reduce((sum, section) => sum + section.unit_advisement, 0)
    ), 0);
    expect(canonicalBaUnits).toBe(62);
    expect(compiledBa.codes_seen).toEqual(expect.arrayContaining([
      'MTH245', 'MTH266', 'MTH288', 'CST100', 'SPA101',
    ]));

    // Alternate-only codes remain in the imported document's title registry,
    // which is what the degree API uses to expose deterministic identities.
    expect(doc.codes_seen).toEqual(expect.arrayContaining(['MTH245', 'SPA101']));
    expect(doc.course_titles).toMatchObject({
      MTH245: 'Statistics I',
      SPA101: 'Beginning Spanish I',
    });
    expect(courseIdFor('SPA101')).toBeGreaterThan(0);
    const importedBa = doc.requirement_variants.find((variant) => (
      variant.key === 'full_time_ba_destination'
    ));
    expect(importedBa).toMatchObject({
      published_units_minimum: 62,
      published_units_maximum: 63,
    });
    const importedLanguage = importedBa.requirement_groups.find((group) => (
      group.title === 'B.A.-destination world language or destination elective'
    ));
    expect(importedLanguage.sections[0].receivers[0].options[0]).toMatchObject({
      course_ids: [courseIdFor('SPA101')],
      course_keys: ['va:SPA101'],
      course_conjunction: 'and',
    });
  });

  it('keeps all five B.S. elective slots without pretending the conflicting rows sum to 63', () => {
    const { composition, doc } = degree('j-sargeant-reynolds-community-college');
    expect(composition.unit_audit.selected_variant_arithmetic).toMatchObject({
      fixed_major_general_education_and_advanced_choice_units: 48,
      computer_systems_or_advisor_elective_units: 3,
      remaining_four_destination_slot_capacity_units: 12,
      total_units: 63,
      published_row_total_if_the_four_credit_label_is_summed_verbatim: 64,
    });
    const systems = doc.requirement_groups.find((group) => (
      group.title === 'B.S.-destination computer systems or advisor-selected elective'
    ));
    expect(systems.sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 3 });
    expect(systems.sections[0].receivers[0].options[0].course_keys).toEqual(['va:CSC215']);
    const slots = doc.requirement_groups.find((group) => (
      group.title === 'B.S.-destination elective capacity across four distinct printed slots'
    ));
    expect(slots.sections[0]).toMatchObject({ unit_advisement: 12 });
    const rawSlots = composition.requirement_groups.find((group) => (
      group.title === 'B.S.-destination elective capacity across four distinct printed slots'
    ));
    expect(rawSlots.printed_slot_count).toBe(4);
    expect(rawSlots.printed_slots.map((slot) => slot.printed_units)).toEqual([4, 3, 3, 3]);
  });

  it('compiles Tidewater to the 60-credit minimum but refuses catalog acceptance without source bytes', () => {
    const { acceptance, composition, doc } = degree('tidewater-community-college');
    expect(composition.capture_gate).toMatchObject({
      status: 'blocked_cloudflare',
      catalog_bytes_captured: false,
      catalog_acceptance_allowed: false,
    });
    expect(composition.research_sources.every((source) => (
      source.official === true && source.captured_locally === false
    ))).toBe(true);
    expect(doc).toMatchObject({
      degree_title_seen: 'Computer Science, Associate of Science',
      total_units: 60,
      total_units_max: 63,
      status: 'url_only',
      collection_status: 'captured_only',
      unit_audit: {
        published_program_units_minimum: 60,
        published_program_units_maximum: 63,
        minimum_program_gpa: 2,
        residency: { minimum_percent: 25 },
      },
    });
    expect(acceptance).toMatchObject({ accepted: false, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual(['source_references']);
    expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 60,
    });
    expect(doc.requirement_groups.some((group) => /Semester|plan of study/i.test(group.title))).toBe(false);
  });

  it('preserves Tidewater nested math, distinct humanities, and two technical slots', () => {
    const { composition, doc } = degree('tidewater-community-college');
    expect(composition.precalculus_requirement_paths).toEqual([
      expect.objectContaining({ kind: 'course', all_of: ['MTH167'], units: 5 }),
      expect.objectContaining({ kind: 'series', all_of: ['MTH161', 'MTH162'], units: 6 }),
      expect.objectContaining({
        kind: 'direct_placement',
        condition: 'Student places directly into MTH 263',
      }),
    ]);
    const preparation = doc.requirement_groups.find((group) => (
      group.title === 'Precalculus preparation or direct-placement replacement path'
    ));
    expect(preparation).toMatchObject({ group_conjunction: 'Or', canonical_section_index: 0 });
    expect(preparation.sections.map((section) => section.unit_advisement)).toEqual([5, 6]);
    expect(preparation.sections[1].receivers[0].options[0]).toMatchObject({
      course_keys: ['va:MTH161', 'va:MTH162'],
      course_conjunction: 'and',
    });
    expect(preparation.analysis_constraints.map((constraint) => constraint.kind)).toContain(
      'direct_placement_with_category_replacement',
    );

    const humanities = doc.requirement_groups.find((group) => (
      group.title === 'Humanities from two distinct categories'
    ));
    expect(humanities).toMatchObject({ distinct_areas: 2 });
    expect(humanities.sections[0]).toMatchObject({ unit_advisement: 6 });

    const technical = doc.requirement_groups.find((group) => (
      group.title === 'Two distinct technical selections'
    ));
    expect(technical).toMatchObject({ distinct_course_ids_across_sections: true });
    expect(technical.sections).toHaveLength(2);
    expect(technical.sections.map((section) => section.unit_advisement)).toEqual([3, 3]);
    expect(technical.sections.map((section) => section.label_seen)).toEqual([
      'Technical slot A — printed CSC 215 slot governed by footnote 8',
      'Technical slot B — footnote 7',
    ]);
    expect(technical.analysis_constraints.map((constraint) => constraint.kind)).toContain(
      'footnote_8_source_language_ambiguity',
    );
    const aCodes = technical.sections[0].receivers[0].options
      .flatMap((option) => option.course_keys);
    const bCodes = technical.sections[1].receivers[0].options
      .flatMap((option) => option.course_keys);
    expect(aCodes).toEqual(expect.arrayContaining(['va:CSC205', 'va:CSC215']));
    expect(bCodes).toEqual(['va:CSC205', 'va:CSC215', 'va:MTH265']);
  });
});
