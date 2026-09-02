import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { parseCourseKey } from '../services/virginia/courseIdentity';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
const research = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'cc-gap-batch.json'), 'utf8'));

function composedDegree(slug) {
  const institution = registry.find((row) => row.slug === slug);
  const evidence = research.institutions.find((row) => row.slug === slug);
  const extract = JSON.parse(fs.readFileSync(path.join(ROOT, 'requirements', `${slug}.json`), 'utf8'));
  const composition = JSON.parse(fs.readFileSync(path.join(ROOT, 'composed', `${slug}.json`), 'utf8'));
  const compiled = compileDegreeComposition(composition, { institutionLevel: institution.level });

  // Deliberately leave the VCCS map empty. Every course in these reviewed
  // compositions must resolve from the institution's own official degree
  // evidence; this is essential for Richard Bland's non-VCCS namespace.
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
  (option) => option.course_keys.map((key) => parseCourseKey(key)?.code),
));

const rawMenu = (composition, title) => composition.requirement_groups
  .find((group) => group.title === title).sections[0].receivers[0].options.flat();

const extractedCodes = (extract, title) => [...new Set(extract.groups
  .find((group) => group.title === title).sections
  .flatMap((section) => section.rows)
  .flatMap((row) => row.codes)
  .map((course) => course.code))];

describe('Camp and Richard Bland official-source degree compositions', () => {
  it('composes Camp plan 246 to the published 61-credit row total without hiding its subtotal conflicts', () => {
    const {
      acceptance, composition, doc, evidence,
    } = composedDegree('paul-d-camp-community-college');

    expect(evidence).toMatchObject({
      finding: 'current_standalone_cs_as_exists_with_legacy_teachout',
      degree: { published_total_credits: 61, program_code: '246' },
      legacy_teachout: { program_code: '697-02' },
    });
    expect(doc).toMatchObject({
      kind: 'as_degree',
      degree_type: 'AS',
      degree_title_seen: 'Computer Science, Associate of Science (Plan 246)',
      total_units: 61,
      total_units_max: 61,
      collection_status: 'composed_full_degree',
      unit_audit: {
        published_program_units: 61,
        printed_term_subtotals_units: 62,
        modeled_units: 61,
        residency: { minimum_percent: 25 },
        minimum_program_gpa: 2,
      },
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 61,
    });
    expect(check(acceptance, 'analysis_ready', 'constraint_support').severity).toBe('fail');
    expect(doc.requirement_groups.some((group) => group.units_fill)).toBe(false);

    const math = doc.requirement_groups.find((group) => group.title === 'Calculus II or Statistics I');
    expect(math.sections[0]).toMatchObject({ unit_advisement: 4, unit_advisement_max: 4 });
    expect(optionCodes(math.sections[0])).toEqual([['MTH264'], ['MTH245']]);
    expect(doc.course_titles.MTH245).toBe('Statistics I');
    expect(doc.data_quality_flags.map((flag) => flag.code)).toEqual(expect.arrayContaining([
      'catalog_credit_arithmetic_conflict',
      'variable_credit_alternative_conflict',
      'legacy_teachout_excluded',
    ]));
    expect(composition.excluded_variants).toEqual([
      expect.stringMatching(/697-02 teachout/),
    ]);
    const requiredCodes = evidence.degree.requirement_logic.fixed_courses
      .map((code) => code.replace(/\s+/g, ''));
    expect(doc.codes_seen.sort()).toEqual([...requiredCodes, 'MTH264', 'MTH245'].sort());
    expect(doc.codes_seen).not.toContain('PHY202');
  });

  it('keeps Camp breadth requirements as official categories and the humanities cross-subgroup rule', () => {
    const { doc } = composedDegree('paul-d-camp-community-college');
    const humanities = doc.requirement_groups.find(
      (group) => group.title === 'Humanities, art, and literature',
    );
    expect(humanities).toMatchObject({
      ge_area: 'camp_ucgs_humanities_art_literature',
      distinct_areas: 2,
      sections: [{ unit_advisement: 6, receivers: [] }],
    });
    expect(doc.requirement_groups.filter((group) => group.ge_area).map((group) => group.ge_area))
      .toEqual([
        'camp_ucgs_humanities_art_literature',
        'camp_ucgs_social_science',
        'camp_ucgs_history',
        'camp_ucgs_natural_science',
        'camp_transferva_approved_science',
      ]);
  });

  it('models Richard Bland as the Computer Science branch of the combined award', () => {
    const {
      acceptance, composition, doc, evidence,
    } = composedDegree('richard-bland-college');

    expect(evidence).toMatchObject({
      finding: 'current_combined_math_computer_science_as_exists_but_no_standalone_cs_as',
      standalone_cs_as_exists: false,
      degree: { published_total_credits: 60, cip_code: '30.0801' },
    });
    expect(doc).toMatchObject({
      kind: 'as_degree',
      degree_type: 'AS',
      degree_title_seen: 'Math/Computer Science, Associate of Science — Computer Science branch',
      total_units: 60,
      total_units_max: 60,
      collection_status: 'composed_full_degree',
      unit_audit: {
        published_program_units: 60,
        published_component_units_minimum: 60,
        published_component_units_maximum: 62,
        modeled_units: 60,
        residency: { minimum_units: 30 },
        minimum_cumulative_gpa: 2,
      },
    });
    expect(composition.course_namespace).toMatchObject({
      kind: 'institution_local',
      institution_id: 'va:cc:richard-bland-college',
      vccs_master_applicable: false,
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 60,
    });
    expect(check(acceptance, 'analysis_ready', 'course_resolution')).toMatchObject({ severity: 'pass' });
    expect(check(acceptance, 'analysis_ready', 'constraint_support').severity).toBe('fail');
    expect(doc.course_titles.CSCI221).toBe('Programming for Computer Science & Engineering Majors I');
    expect(doc.codes_seen).toContain('CSCI221');
    expect(doc.codes_seen).not.toContain('CSC221');
  });

  it('encodes CSCI 222 AND one math option and does not promote recommendations to requirements', () => {
    const {
      composition, doc, evidence,
    } = composedDegree('richard-bland-college');
    const branch = doc.requirement_groups.find(
      (group) => group.title === 'Computer Science branch of quantitative and symbolic reasoning',
    );
    expect(branch.sections[0]).toMatchObject({
      section_advisement: 1,
      unit_advisement: 7,
      unit_advisement_max: 8,
    });
    expect(optionCodes(branch.sections[0])).toEqual([
      ['CSCI222', 'MATH254'],
      ['CSCI222', 'MATH261'],
      ['CSCI222', 'MATH271'],
    ]);

    const electives = doc.requirement_groups.find(
      (group) => group.title === 'Electives to the published degree total',
    );
    expect(electives).toMatchObject({
      ge_area: 'richard_bland_degree_electives',
      sections: [{ unit_advisement: 15, unit_advisement_max: 16, receivers: [] }],
    });
    const occurrences = doc.requirement_groups.flatMap((group) => group.sections)
      .flatMap((section) => section.receivers)
      .flatMap((receiver) => receiver.options)
      .filter((option) => option.course_keys.some((key) => parseCourseKey(key)?.code === 'MATH261'));
    expect(occurrences).toHaveLength(1);
    expect(evidence.degree.requirement_logic.electives.recommendations_not_requirements).toHaveLength(3);
    expect(composition.modeling_notes.join(' ')).toMatch(/recommendations.*not additional AND requirements/i);
    expect(doc.requirement_groups.some((group) => /foreign language|computer proficiency/i.test(group.title)))
      .toBe(false);
  });

  it('copies all four Richard Bland general-education menus exactly from the fresh program artifact', () => {
    const { composition, extract } = composedDegree('richard-bland-college');
    for (const title of [
      'The Art of Language and Ideas',
      'The Language and History of Fine Arts',
      'The Human Experience',
      'U.S. and World Cultures',
    ]) {
      expect(rawMenu(composition, title)).toEqual(extractedCodes(extract, title));
    }
  });

  it('imports both compositions with official-source provenance and no VCCS lookup dependency', () => {
    for (const slug of ['paul-d-camp-community-college', 'richard-bland-college']) {
      const { acceptance, composition, doc } = composedDegree(slug);
      expect(doc).toMatchObject({
        _id: `va:as:${slug}:cs`,
        college_id: `va:cc:${slug}`,
        source_method: 'official_catalog_composition',
        provenance: {
          composition_artifact: `server/.va-catalogs/composed/${slug}.json`,
          composition_schema_version: 1,
        },
      });
      expect(composition.source_bundle_required.every(
        (sourceId) => doc.sources.some((source) => source.id === sourceId),
      )).toBe(true);
      expect(acceptance.catalog.failed).toEqual([]);
      expect(check(acceptance, 'analysis_ready', 'course_resolution').severity).toBe('pass');
    }
  });
});
