import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;

function composed(slug) {
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
  return { acceptance, composition, doc };
}

function canonicalUnits(groups) {
  return groups.reduce((total, group) => {
    const units = group.sections.map((section) => section.unit_advisement);
    if (group.group_conjunction === 'Or') return total + units[group.canonical_section_index || 0];
    return total + units.reduce((sum, value) => sum + value, 0);
  }, 0);
}

describe('VCU, VSU, and Virginia Tech official full-degree compositions', () => {
  it('composes the ordinary VCU B.S., ConnectED overlap, upper-level, REAL, and residence rules', () => {
    const { acceptance, composition, doc } = composed('virginia-commonwealth-university');

    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual([
      'analysis_quality_flags', 'constraint_support',
    ]);
    expect(doc).toMatchObject({
      total_units: 120,
      academic_unit: 'Department of Computer Science',
      college: 'College of Engineering',
      unit_audit: {
        graduation_minimum: 120,
        modeled_units: 120,
        upper_division: { minimum_units: 45, modeled_units: 50 },
        residency: { minimum_units: 30 },
      },
    });
    expect(canonicalUnits(doc.requirement_groups)).toBe(120);
    expect(doc.requirement_groups.find((group) => group.title === 'Natural science option and path-adjusted open electives')
      .sections.map((section) => section.unit_advisement)).toEqual([13, 13, 13]);
    expect(doc.requirement_groups.find((group) => group.title === 'CMSC upper-level electives')
      .sections[0].receivers).toHaveLength(18);
    expect(doc.requirement_groups.find((group) => group.title === 'Computer Science core: lower-level requirements')
      .analysis_constraints[0].kind).toBe('placement_dependent_introductory_course');
    expect(doc.requirement_groups.map((group) => group.title)).toEqual(expect.arrayContaining([
      'VCU REAL experiential-learning requirement',
      'University graduation GPA and residence policies',
    ]));
    expect(doc.requirement_groups.find((group) => group.title === 'ConnectED foundations not already counted in the program table')
      .analysis_constraints[0].kind).toBe('focused_inquiry_grade_and_postmatriculation_transfer_rule');
    expect(composition.excluded_variants).toEqual(expect.arrayContaining([
      'Cybersecurity concentration',
      'Accelerated bachelor\'s-to-master\'s pathways',
    ]));
    expect(doc.course_titles).toMatchObject({
      BIOL151: 'Introduction to Biological Sciences I',
      BIOZ151: 'Introduction to Biological Science Laboratory I',
      CHEM101: 'General Chemistry I',
      CHEZ101: 'General Chemistry Laboratory I',
      PHYS207: 'University Physics I',
      PHYZ207: 'University Physics I Laboratory',
    });
  });

  it('composes VSU from the authoritative summary and preserves every bounded GE and restricted menu', () => {
    const { acceptance, doc } = composed('virginia-state-university');

    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual([
      'analysis_quality_flags', 'constraint_support',
    ]);
    expect(doc.total_units).toBe(120);
    expect(canonicalUnits(doc.requirement_groups)).toBe(120);
    expect(doc.codes_seen).toHaveLength(161);
    expect(doc.codes_seen).toContain('CSCI471');
    expect(doc.codes_seen).not.toContain('CSCI470');
    expect(doc.codes_seen).toEqual(expect.arrayContaining(['AGRI100', 'CHEM161', 'CHEM163', 'PHYS100']));
    expect(doc.requirement_groups.filter((group) => group.title.startsWith('General Education')))
      .toHaveLength(10);

    const restricted = doc.requirement_groups.find((group) => group.title === 'Restricted electives: complete published option pool');
    expect(restricted).toMatchObject({
      sections: [{ section_advisement: 4, unit_advisement: 13, assume_satisfiable: true }],
    });
    expect(restricted.sections[0].receivers.length).toBeGreaterThanOrEqual(45);
    expect(restricted.analysis_constraints[0].kind)
      .toBe('credit_based_pool_with_unpublished_submenu_distribution');
    expect(doc.unit_audit).toMatchObject({
      upper_division: { status: 'none_stated' },
      residency: { status: 'none_stated' },
      minimum_cumulative_gpa: { status: 'none_stated' },
    });
    expect(doc.requirement_groups.find((group) => group.title === 'General Education: English composition')
      .sections.map((section) => section.unit_advisement)).toEqual([3, 3]);
    const mathematics = doc.requirement_groups.find((group) => (
      group.title === 'General Education: Mathematics'
    )).sections[0];
    expect(mathematics).toMatchObject({
      section_advisement: 2,
      unit_advisement: 6,
      unit_advisement_max: 8,
    });
    expect(mathematics.receivers.map((receiver) => receiver.receiving.units))
      .toEqual(expect.arrayContaining([3, 4]));
    expect(doc.requirement_groups.find((group) => group.title === 'General Education and university nonunit policies')
      .sections).toHaveLength(2);
    expect(doc.requirement_groups.map((group) => group.title)).toContain(
      'Computer Science subject-course grade requirement',
    );
    expect(doc.course_titles).toMatchObject({
      CHEM161: 'Chemistry I',
      CHEM162: 'Chemistry II',
      CHEM163: 'Chemistry Laboratory I',
      CHEM164: 'Chemistry Laboratory II',
    });
  });

  it('composes Virginia Tech to 123 with exact Pathways overlap, elective menus, and exclusions', () => {
    const { acceptance, composition, doc } = composed('virginia-polytechnic-institute-and-state-university');

    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual([]);
    expect(acceptance.analysis_ready.failed).toEqual([
      'analysis_quality_flags', 'constraint_support',
    ]);
    expect(doc.total_units).toBe(123);
    expect(canonicalUnits(doc.requirement_groups)).toBe(123);
    expect(doc.unit_audit).toMatchObject({
      graduation_minimum: 123,
      modeled_units: 123,
      elective_subtotal_units: 37,
      net_pathways_units_after_natural_science_overlap: 39,
      upper_division: { status: 'none_stated' },
      residency: { status: 'required', minimum_units: 31 },
    });

    expect(doc.requirement_groups.find((group) => group.title === 'Natural Science Electives')
      .sections[0]).toMatchObject({ section_advisement: 2, unit_advisement: 8 });
    expect(doc.requirement_groups.find((group) => group.title === 'Career Bridge Experience')
      .sections[1].receivers).toHaveLength(9);
    expect(doc.codes_seen).toEqual(expect.arrayContaining(['ENGE2724', 'ENGE4724']));
    expect(doc.course_titles).not.toHaveProperty('ENGE2724');
    expect(doc.course_titles).not.toHaveProperty('ENGE4724');
    expect(composition.data_quality_flags).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'program_listed_codes_absent_from_course_catalog',
        severity: 'block_analysis',
      }),
    ]));
    expect(doc.requirement_groups.find((group) => group.title === 'Statistics Elective and path-adjusted Free Electives')
      .sections.map((section) => section.unit_advisement)).toEqual([10, 10, 10, 10, 10, 10]);
    expect(doc.requirement_groups.find((group) => group.title === 'Program course-grade and GPA requirements')
      .sections[0].label_seen).toBe('Calculus grade');
    expect(doc.codes_seen).toEqual(expect.arrayContaining([
      'CS2064', 'CS2144', 'CS4144', 'ECE2564', 'ECE3514', 'MATH2405H', 'MATH2406H',
    ]));
    expect(composition.requirement_groups.find((group) => group.title === 'Major Requirements')
      .sections[0].receivers.map((receiver) => receiver.title)).toEqual([
        'Introduction to Problem Solving in Computer Science',
        'Competitive Problem Solving I',
        'Competitive Problem Solving II',
      ]);
    expect(doc.codes_seen).not.toEqual(expect.arrayContaining([
      'CS4774', 'CS5040', 'CS5044', 'CS5045', 'CS5046', 'CS5644', 'CS5664',
      'CS5904', 'CS5944', 'CS5974', 'CS5994',
    ]));
    expect(doc.requirement_groups.some((group) => /roadmap|plan of study|accelerated/i.test(group.title)))
      .toBe(false);
  });

  it('marks every source layer complete and keeps schedule/accelerated content out of all three trees', () => {
    for (const slug of [
      'virginia-commonwealth-university',
      'virginia-state-university',
      'virginia-polytechnic-institute-and-state-university',
    ]) {
      const { doc } = composed(slug);
      expect(doc.requirement_layers).toMatchObject({
        major: { status: 'complete' },
        ge_college: { status: 'complete' },
        university_graduation: { status: 'complete' },
      });
      expect(doc.requirement_groups.some((group) => /recommended|roadmap|plan of study|accelerated/i.test(group.title)))
        .toBe(false);
      expect(doc.provenance.composition_artifact).toContain(`${slug}.json`);
    }
  });
});
