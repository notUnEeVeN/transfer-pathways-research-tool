import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { courseIdFor } from '../services/virginia/courseIdentity';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
const SLUGS = [
  'central-virginia-community-college',
  'germanna-community-college',
  'laurel-ridge-community-college',
];

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
  const visit = (value, key = '') => {
    if (Array.isArray(value)) {
      if (key === 'courses') value.forEach((code) => found.add(code));
      else value.forEach((child) => visit(child));
      return;
    }
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
  };
  visit(composition.option_sets || {});
  return [...found];
};

describe('Central Virginia, Germanna, and Laurel Ridge Computer Science A.S. compositions', () => {
  it.each(SLUGS)('%s is catalog-accepted and blocked only on unsupported exact constraints', (slug) => {
    const { acceptance, composition, doc, extract } = degree(slug);
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual(['constraint_support']);
    expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 60,
    });
    expect(check(acceptance, 'analysis_ready', 'course_resolution').severity).toBe('pass');
    expect(new Set(extract.sources.map((source) => source.id))).toEqual(
      new Set(composition.source_bundle_required),
    );
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

  it.each(SLUGS)('%s retains deterministic identities and titles for every option-set course', (slug) => {
    const { composition, doc } = degree(slug);
    for (const code of optionSetCodes(composition)) {
      expect(doc.codes_seen.includes(code) || Object.hasOwn(doc.course_titles, code)).toBe(true);
      expect(doc.course_titles[code]).toEqual(expect.any(String));
      expect(doc.course_titles[code].length).toBeGreaterThan(0);
      expect(courseIdFor(code)).toBeGreaterThan(0);
    }
  });

  it('preserves Central Virginia linked UCGS dictionaries and both separate introductory-science slots', () => {
    const { composition, doc } = degree('central-virginia-community-college');
    expect(doc).toMatchObject({
      degree_title_seen: 'Computer Science, Associate of Science',
      total_units: 60,
      total_units_max: 61,
      unit_audit: {
        minimum_curriculum_gpa: 2,
        residency: { minimum_percent: 25, minimum_units_on_60_credit_path: 15 },
      },
    });
    expect(composition.option_sets.ucgs_block_ii.categories).toMatchObject({
      art: ['ART100', 'ART101', 'ART102', 'CST151', 'MUS121'],
      humanities: ['HUM256', 'PHI100', 'PHI111', 'PHI220', 'REL230'],
      literature: ['ENG225', 'ENG245', 'ENG246', 'ENG250', 'ENG255', 'ENG258'],
    });
    const science = doc.requirement_groups.find((group) => (
      group.title === 'Two distinct introductory laboratory-science selections'
    ));
    expect(science).toMatchObject({ distinct_course_ids_across_sections: true });
    expect(science.sections).toHaveLength(2);
    for (const section of science.sections) {
      expect(section).toMatchObject({ section_advisement: 1, unit_advisement: 4 });
      expect(section.receivers[0].options.map((option) => option.course_keys)).toEqual([
        ['va:PHY241'], ['va:CHM111'],
      ]);
    }
    const core = doc.requirement_groups.find((group) => (
      group.title === 'Calculus, engineering, and computer science core'
    ));
    expect(core.sections.find((section) => /MTH 245/.test(section.label_seen))).toMatchObject({
      unit_advisement: 3,
      unit_advisement_max: 4,
    });
  });

  it('preserves Germanna categorical requirements, 7-10 elective pool, and 60-62 fill rule', () => {
    const { composition, doc } = degree('germanna-community-college');
    expect(doc).toMatchObject({
      total_units: 60,
      total_units_max: 62,
      unit_audit: {
        fixed_and_choice_units_before_transfer_electives_minimum: 50,
        published_transfer_elective_units_minimum: 7,
        published_transfer_elective_units_maximum: 10,
        minimum_curriculum_gpa: 2,
        computer_competency_required: true,
        exit_assessment_required: true,
        residency: { minimum_percent: 25 },
      },
    });
    expect(composition.option_sets.world_language.courses).toHaveLength(40);
    expect(composition.option_sets.transfer_electives.courses).toEqual(expect.arrayContaining([
      'MTH161', 'MTH162', 'MTH167', 'CSC205', 'EGR121', 'EGR122', 'EGR270',
      'CST100', 'CST110', 'MTH265', 'MTH266', 'ASL101', 'SPA202',
    ]));
    const elective = doc.requirement_groups.find((group) => (
      group.title === "Transfer electives from the program's approved pool"
    ));
    expect(elective).toMatchObject({
      ge_area: 'germanna_computer_science_transfer_electives',
      sections: [{ unit_advisement: 7, unit_advisement_max: 10 }],
    });
    expect(doc.requirement_groups.find((group) => group.units_fill === true)).toMatchObject({
      title: 'Additional applicable transfer-elective credit to the degree minimum',
    });
    expect(doc.course_titles).toMatchObject({
      ITA202: 'Intermediate Italian I',
      EGR270: 'Fundamentals of Computer Engineering',
      SPA202: 'Intermediate Spanish II',
    });
  });

  it('preserves Laurel Ridge fixed AND sequences and exactly-two 5-8 credit elective rule', () => {
    const { doc } = degree('laurel-ridge-community-college');
    expect(doc).toMatchObject({
      total_units: 60,
      total_units_max: 64,
      unit_audit: {
        fixed_requirements_before_electives: 55,
        printed_elective_units_minimum: 5,
        printed_elective_units_maximum: 8,
        modeled_units_maximum: 63,
        minimum_curriculum_gpa: 2,
        residency: { minimum_percent: 25 },
      },
    });
    const science = doc.requirement_groups.find((group) => group.title === 'Natural Science sequence');
    expect(science.sections[0].receivers[0].options[0]).toMatchObject({
      course_keys: ['va:CHM111', 'va:CHM112'],
      course_conjunction: 'and',
    });
    const calculus = doc.requirement_groups.find((group) => group.title === 'Calculus sequence');
    expect(calculus.sections[0].receivers[0].options[0]).toMatchObject({
      course_keys: ['va:MTH263', 'va:MTH264'],
      course_conjunction: 'and',
    });
    const electives = doc.requirement_groups.find((group) => (
      group.title === 'Two distinct electives totaling 5-8 credits'
    ));
    expect(electives.sections[0]).toMatchObject({
      section_advisement: 2,
      unit_advisement: 5,
      unit_advisement_max: 8,
    });
    expect(electives.sections[0].receivers).toHaveLength(14);
    expect(electives.sections[0].receivers.map((receiver) => receiver.code_seen)).toEqual(
      expect.arrayContaining(['CSC110', 'CSC295', 'EGR270', 'MTH167', 'MTH266']),
    );
  });
});
