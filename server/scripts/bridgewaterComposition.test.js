import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
const institution = registry.find((row) => row.slug === 'bridgewater-college');
const extract = JSON.parse(fs.readFileSync(path.join(
  ROOT, 'requirements', 'bridgewater-college.json',
), 'utf8'));
const composition = JSON.parse(fs.readFileSync(path.join(
  ROOT, 'composed', 'bridgewater-college.json',
), 'utf8'));

function composedDegree() {
  const compiled = compileDegreeComposition(composition, { institutionLevel: institution.level });
  const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
  const doc = toDocument(extract, institution, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { acceptance, compiled, doc };
}

const rawCodes = (section) => (section.receivers || []).flatMap((receiver) => (
  receiver.code ? [receiver.code] : receiver.codes || []
));

describe('Bridgewater current official Computer Science B.S. composition', () => {
  it('pins a reproducible 2026-2027 CleanCatalog source bundle', () => {
    expect(institution).toMatchObject({
      platform: 'cleancatalog',
      degree_context: {
        award: 'BS',
        catalog_year: '2026-2027',
        academic_unit: 'Department of Mathematics and Computer Science',
        college: 'Coffman School of Natural Sciences',
      },
    });
    expect(institution.seeds.map(({ role, url }) => ({ role, url }))).toEqual([
      { role: 'catalog', url: 'https://bridgewater.cleancatalog.io/undergraduate-catalog' },
      {
        role: 'program',
        url: 'https://bridgewater.cleancatalog.io/mathematics-computer-science/bachelor-of-science-major/computer-science',
      },
      { role: 'ge', url: 'https://bridgewater.cleancatalog.io/the-connected-learning-cl-curriculum' },
      {
        role: 'ge',
        url: 'https://bridgewater.cleancatalog.io/connected-learning-general-education/connected-learning-cl-general-education-curriculum',
      },
      { role: 'college', url: 'https://bridgewater.cleancatalog.io/courses-of-instruction' },
      { role: 'graduation', url: 'https://bridgewater.cleancatalog.io/degree-requirements' },
      { role: 'course_catalog', url: 'https://bridgewater.cleancatalog.io/mathematics-computer-science' },
      { role: 'course_catalog', url: 'https://bridgewater.cleancatalog.io/art' },
    ]);

    expect(extract).toMatchObject({
      outcome: 'captured',
      source_url: 'https://bridgewater.cleancatalog.io/mathematics-computer-science/bachelor-of-science-major/computer-science',
      catalog_year: '2026-2027',
      parser: 'lines',
      validation: { verdict: 'warn', needs_hand_read: false },
    });
    expect(extract.sources.map((source) => source.id)).toEqual(composition.source_bundle_required);
    expect(Object.values(extract.source_layers).every((layer) => layer.status === 'captured')).toBe(true);
    expect(new Set(extract.groups.flatMap((group) => group.sections)
      .flatMap((section) => section.rows)
      .flatMap((row) => row.codes)
      .map((course) => course.code))).toHaveProperty('size', 20);
  });

  it('catalog-accepts the complete degree and blocks only unsupported analysis rules', () => {
    const { acceptance, doc } = composedDegree();
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual([
      'analysis_quality_flags', 'constraint_support',
    ]);
    expect(doc).toMatchObject({
      program: 'Computer Science, B.S.',
      degree_variant: 'BS',
      catalog_year: '2026-2027',
      total_units: 120,
      academic_unit: 'Department of Mathematics and Computer Science',
      college: 'Coffman School of Natural Sciences',
      ge_authority: 'Connected Learning (CL): General Education Curriculum',
      requirement_layers: {
        major: { status: 'complete' },
        ge_college: { status: 'complete' },
        university_graduation: { status: 'complete' },
      },
      unit_audit: {
        graduation_minimum: 120,
        modeled_units: 120,
        major_units: 46,
        major_shared_core_units: 31,
        selected_track_units: 15,
        upper_division: { minimum_units: 45, modeled_units: 45 },
        residency: { minimum_units: 33 },
        final_credit_window_units: 33,
        final_credit_window_residency_units_minimum: 30,
        major_residency_units_minimum: 9,
        minimum_cumulative_gpa: 2,
        minimum_major_gpa: 2,
      },
    });
    expect(doc.provenance.composition_artifact).toContain('bridgewater-college.json');
  });

  it('preserves the mandatory 31-credit core plus exactly one intact 15-credit track', () => {
    const lowerCore = composition.requirement_groups.find((group) => (
      group.title === 'Computer Science shared core: lower-division courses'
    ));
    const upperCore = composition.requirement_groups.find((group) => (
      group.title === 'Computer Science shared core: upper-division courses'
    ));
    expect([...lowerCore.sections, ...upperCore.sections]
      .reduce((sum, section) => sum + section.units, 0)).toBe(31);
    expect([...lowerCore.sections, ...upperCore.sections].flatMap(rawCodes)).toEqual([
      'CSCI101', 'CSCI102', 'CSCI110', 'CSCI220', 'CSCI250', 'DSA230',
      'CSCI320', 'CSCI341', 'CSCI342', 'CSCI400',
    ]);

    const lowerTrack = composition.requirement_groups.find((group) => (
      group.title === 'Required track: lower-division component'
    ));
    const upperTrack = composition.requirement_groups.find((group) => (
      group.title === 'Required track: upper-division component'
    ));
    expect(composition.track_selection).toMatchObject({
      choose: 1, selection_required: true, untracked_path_exists: false,
    });
    expect(lowerTrack).toMatchObject({ conjunction: 'Or', canonical_section_index: 0 });
    expect(upperTrack).toMatchObject({ conjunction: 'Or', canonical_section_index: 0 });

    const cyber = [lowerTrack.sections[0], upperTrack.sections[0]];
    expect(cyber.reduce((sum, section) => sum + section.units, 0)).toBe(15);
    expect(cyber.flatMap(rawCodes)).toEqual([
      'CSCI130', 'CSCI261', 'CSCI361', 'CSCI461', 'DSA350',
    ]);
    const fullStack = [lowerTrack.sections[1], upperTrack.sections[1]];
    expect(fullStack.reduce((sum, section) => sum + section.units, 0)).toBe(15);
    expect(fullStack.flatMap(rawCodes)).toEqual([
      'CSCI131', 'ART321', 'ART322', 'CSCI331', 'CSCI332',
    ]);
    expect(lowerTrack.analysis_constraints[0].kind).toBe('correlated_required_track_choice');
    expect(upperTrack.analysis_constraints[0].kind).toBe('correlated_required_track_choice');
  });

  it('closes both track paths to 120 and exposes the 45-credit upper-level audit', () => {
    expect(composition.unit_audit.track_paths).toEqual({
      cybersecurity: {
        shared_core_units: 31,
        track_units: 15,
        major_units: 46,
        major_upper_division_units: 21,
        additional_upper_division_capacity_units: 24,
        remaining_connected_learning_and_elective_capacity_units: 50,
        total_units: 120,
      },
      full_stack_software_development: {
        shared_core_units: 31,
        track_units: 15,
        major_units: 46,
        major_upper_division_units: 24,
        additional_upper_division_capacity_units: 21,
        remaining_connected_learning_and_elective_capacity_units: 53,
        total_units: 120,
      },
    });
    const upper = composition.requirement_groups.find((group) => (
      group.title === 'Additional upper-level capacity required by the selected track'
    ));
    const remainder = composition.requirement_groups.find((group) => (
      group.title === 'Remaining Connected Learning and applicable-credit capacity by selected track'
    ));
    expect(upper.sections.map((section) => section.units)).toEqual([24, 21]);
    expect(remainder.sections.map((section) => section.units)).toEqual([50, 53]);
    expect(31 + 15 + upper.sections[0].units + remainder.sections[0].units).toBe(120);
    expect(31 + 15 + upper.sections[1].units + remainder.sections[1].units).toBe(120);
  });

  it('retains all Connected Learning, school, graduation, and residence gates', () => {
    const titles = composition.requirement_groups.map((group) => group.title);
    expect(titles).toEqual(expect.arrayContaining([
      'Connected Learning entry seminar',
      'Connected Learning writing and capstone completion gates',
      'Foundations of Connected Learning',
      'Ways of Learning',
      'University graduation, GPA, and residence rules',
    ]));
    const ways = composition.requirement_groups.find((group) => group.title === 'Ways of Learning');
    expect(ways.sections.map((section) => section.label)).toEqual([
      'Creative and Artistic Practices',
      'Engaging in US Diversity',
      'Engaging in Global Diversity',
      'Scientific Study of People and Society',
      'Scientific Study of Nature',
      'Study of Human Narratives',
      'Study of the Past',
    ]);
    const graduation = composition.requirement_groups.find((group) => (
      group.title === 'University graduation, GPA, and residence rules'
    ));
    expect(graduation.sections.map((section) => section.label)).toEqual([
      'Degree credit minimum',
      'Junior- and senior-level minimum',
      'Cumulative GPA',
      'Major GPA',
      'Institutional credit minimum',
      'Final-credit residence',
      'Major residence',
      'Major field size',
      'Graduation application',
    ]);
    expect(composition.requirement_layers.ge_college.note)
      .toMatch(/no separate additive school curriculum/i);
    expect(composition.modeling_notes.join(' ')).toMatch(/approved transfer-oriented associate degree/i);
    expect(composition.data_quality_flags.map((flag) => flag.code)).toEqual(expect.arrayContaining([
      'connected_learning_overlap_and_choice_rules',
      'approved_associate_transfer_exception',
      'full_stack_cl200_corequisite_policy_gap',
    ]));
  });

  it('publishes official CleanCatalog node and parent identities for every major course', () => {
    const majorCodes = [
      'CSCI101', 'CSCI102', 'CSCI110', 'CSCI220', 'CSCI250', 'CSCI320', 'CSCI341',
      'CSCI342', 'CSCI400', 'DSA230', 'CSCI130', 'CSCI261', 'CSCI361', 'CSCI461',
      'DSA350', 'ART321', 'ART322', 'CSCI131', 'CSCI331', 'CSCI332',
    ];
    expect(majorCodes.every((code) => composition.source_course_identities[code])).toBe(true);
    expect(composition.source_course_identities).toMatchObject({
      CSCI101: { catalog_node_id: 1039, parent_term_id: 1849 },
      CSCI261: { catalog_node_id: 2933, parent_term_id: 1849 },
      ART321: { catalog_node_id: 831, parent_term_id: 1808 },
      MATH110: { catalog_node_id: 1412, parent_term_id: 1849 },
    });
    expect(majorCodes.every((code) => {
      const identity = composition.source_course_identities[code];
      return Number.isInteger(identity.catalog_node_id)
        && Number.isInteger(identity.parent_term_id)
        && identity.url.startsWith('https://bridgewater.cleancatalog.io/');
    })).toBe(true);
  });

  it('does not import a term sequence as categorical requirements', () => {
    const visible = composition.requirement_groups.flatMap((group) => [
      group.title,
      ...group.sections.map((section) => section.label || ''),
    ]);
    expect(visible.some((value) => /Fall|Spring|semester|plan of study|sample schedule/i.test(value)))
      .toBe(false);
    expect(composition.excluded_variants).toContain('historical or prospective term-by-term schedules');
  });
});
