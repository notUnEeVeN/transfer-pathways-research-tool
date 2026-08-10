import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { parseCourseLeafProgram } from '../services/virginia/catalogParse/courseleaf';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { courseIdFor } from '../services/virginia/courseIdentity';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
const research = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'research', 'cc-blue-ridge-brightpoint-batch.json'), 'utf8',
));

function composedDegree(slug) {
  const institution = registry.find((row) => row.slug === slug);
  const evidence = research.institutions.find((row) => row.slug === slug);
  const rawExtract = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'requirements', `${slug}.json`), 'utf8',
  ));
  const composition = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'composed', `${slug}.json`), 'utf8',
  ));
  const compiled = compileDegreeComposition(composition, { institutionLevel: institution.level });
  // The targeted live capture must supply every role required by composition;
  // no test-only provenance is synthesized here.
  const extract = rawExtract;
  const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
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

describe('Blue Ridge and Brightpoint official-source degree compositions', () => {
  it('pins both institutions to their current official 2026-2027 source bundles', () => {
    const blue = registry.find((row) => row.slug === 'blue-ridge-community-college');
    expect(blue).toMatchObject({
      platform: 'courseleaf',
      courseleaf_parse: {
        requirements_selector: '#content',
        exclude_plan_grids_when_course_lists: false,
      },
      degree_context: { catalog_year: '2026-2027', award: 'AS' },
    });
    expect(blue.seeds.map((seed) => seed.role)).toEqual([
      'program', 'ge', 'elective', 'student_development', 'graduation',
    ]);

    const bright = registry.find((row) => row.slug === 'brightpoint-community-college');
    expect(bright).toMatchObject({
      platform: 'acalog',
      acalog_parse: {
        catalog_id: 12,
        program_id: 1464,
        requirements_selector: '#acalog-content .acalog-core',
      },
      degree_context: { catalog_year: '2026-2027', award: 'AS' },
    });
    expect(bright.seeds.find((seed) => seed.role === 'program').url)
      .toBe('https://catalog.brightpoint.edu/preview_program.php?catoid=12&poid=1464&returnto=1157');
    expect(bright.seeds.map((seed) => seed.url).join(' ')).not.toContain('catoid=8');
  });

  it('keeps both Blue Ridge sibling CourseLeaf requirement containers in scope', () => {
    const html = fs.readFileSync(path.join(
      ROOT, 'pages', 'blue-ridge-community-college__program.html',
    ), 'utf8');
    const tree = parseCourseLeafProgram(html, {
      requirementsSelector: '#content',
      excludePlanGridsWhenCourseLists: false,
    });
    expect(tree.parse_error).toBeUndefined();
    expect(tree.total_credits).toMatchObject({ min: 60, max: 62 });
    expect(tree.groups.map((group) => group.title)).toEqual([
      'First Semester',
      'Second Semester',
      'Third Semester',
      'Fourth Semester',
      'Laboratory Science Electives',
      'General Education Electives',
      'Computer Science Electives',
    ]);
  });

  it('closes Blue Ridge at the published 60-credit minimum and preserves the 60-62 range', () => {
    const {
      acceptance, composition, doc, evidence,
    } = composedDegree('blue-ridge-community-college');
    expect(evidence).toMatchObject({
      finding: 'current_standalone_cs_as_exists',
      degree: {
        published_total_credits_minimum: 60,
        published_total_credits_maximum: 62,
      },
    });
    expect(doc).toMatchObject({
      kind: 'as_degree',
      degree_type: 'AS',
      degree_title_seen: 'Computer Science, Associate of Science',
      catalog_year: '2026-2027',
      total_units: 60,
      total_units_max: 62,
      collection_status: 'composed_full_degree',
      unit_audit: {
        modeled_units_minimum: 60,
        modeled_units_maximum: 62,
        residency: { minimum_percent: 25 },
        minimum_curriculum_gpa: 2,
        minimum_major_gpa: 2,
      },
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 60,
    });
    expect(check(acceptance, 'analysis_ready', 'constraint_support').severity).toBe('fail');
    expect(doc.requirement_groups.some((group) => group.units_fill)).toBe(false);
    expect(composition.option_sets.general_education_elective.courses).toHaveLength(22);
    expect(composition.option_sets.computer_science_elective.courses).toHaveLength(27);
    const documentCodes = new Set([...doc.codes_seen, ...Object.keys(doc.course_titles)]);
    expect(composition.option_sets.computer_science_elective.courses.every(
      (code) => documentCodes.has(code) && Number.isInteger(courseIdFor(code)),
    )).toBe(true);
  });

  it('retains Blue Ridge exact options and the unsupported distinct/overlap rules', () => {
    const { composition, doc } = composedDegree('blue-ridge-community-college');
    const lab = doc.requirement_groups.find((group) => group.title === 'Laboratory science');
    expect(optionCodes(lab.sections[0])).toEqual([
      ['BIO101'], ['CHM111'], ['GOL105'], ['GOL110'], ['PHY201'], ['PHY241'],
    ]);

    const general = doc.requirement_groups.find((group) => group.title === 'General Education Elective');
    expect(general.sections[0]).toMatchObject({ unit_advisement: 4, unit_advisement_max: 4 });
    expect(optionCodes(general.sections[0])).toHaveLength(22);
    expect(general.analysis_constraints.map((constraint) => constraint.kind)).toEqual([
      'alternative_course_credit_mismatch',
      'no_double_count_across_requirement_slots',
    ]);

    const blockII = doc.requirement_groups.find(
      (group) => group.title === 'UCGS Block II — Humanities, Art, and Literature',
    );
    expect(blockII).toMatchObject({
      distinct_course_ids_across_sections: true,
      sections: [{ unit_advisement: 3 }, { unit_advisement: 3 }],
    });
    expect(optionCodes(blockII.sections[0])).toHaveLength(21);
    expect(composition.option_sets.ucgs_block_ii.categories).toMatchObject({
      art: expect.any(Array), humanities: expect.any(Array), literature: expect.any(Array),
    });
    expect(composition.option_sets.ucgs_block_iii.courses).toHaveLength(11);
    expect(composition.option_sets.ucgs_block_vi.courses).toHaveLength(6);
  });

  it('models Brightpoint fixed courses, one complete lab sequence, and exact breadth menus', () => {
    const {
      acceptance, composition, doc, evidence,
    } = composedDegree('brightpoint-community-college');
    expect(evidence).toMatchObject({
      finding: 'current_standalone_cs_as_exists',
      catalog: { catalog_id: 12, program_id: 1464 },
      degree: { published_total_credits_minimum: 60, modeled_total_credits_maximum: 61 },
    });
    expect(doc).toMatchObject({
      kind: 'as_degree',
      degree_type: 'AS',
      degree_title_seen: 'Computer Science, Associate of Science',
      total_units: 60,
      total_units_max: 61,
      unit_audit: {
        modeled_units_minimum: 60,
        modeled_units_maximum: 61,
        residency: { minimum_percent: 25 },
        minimum_curriculum_gpa: 2,
      },
    });
    expect(acceptance).toMatchObject({ accepted: true, ready_for_analysis: false });
    expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass', modeled_units: 60,
    });

    const lab = doc.requirement_groups.find((group) => group.title === 'Laboratory science sequence');
    expect(lab.sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 8 });
    expect(optionCodes(lab.sections[0])).toEqual([
      ['BIO101', 'BIO102'],
      ['CHM111', 'CHM112'],
      ['PHY201', 'PHY202'],
      ['PHY241', 'PHY242'],
    ]);
    expect(composition.option_sets.history.courses).toHaveLength(6);
    expect(composition.option_sets.humanities.courses).toHaveLength(5);
    expect(composition.option_sets.social_behavioral_sciences.courses).toHaveLength(12);
    expect(composition.option_sets.arts_literature.courses).toHaveLength(12);
  });

  it('keeps Brightpoint approved electives exact without promoting advisory text', () => {
    const { acceptance, composition, doc } = composedDegree('brightpoint-community-college');
    const electives = doc.requirement_groups.find((group) => group.title === 'Approved electives');
    expect(electives.sections[0]).toMatchObject({
      section_advisement: 2,
      unit_advisement: 8,
      unit_advisement_max: 9,
    });
    expect(electives.sections[0].receivers).toHaveLength(16);
    expect(optionCodes(electives.sections[0])).toEqual(
      composition.option_sets.approved_electives.courses.map((code) => [code]),
    );
    expect(electives.analysis_constraints.map((constraint) => constraint.kind)).toEqual([
      'variable_choice_count_with_minimum_units',
      'no_double_count_across_requirement_slots',
    ]);
    expect(check(acceptance, 'analysis_ready', 'constraint_support').severity).toBe('fail');
    expect(doc.codes_seen).toContain('ITE152');
    expect(doc.codes_seen).not.toContain('TE152');
    expect(composition.option_sets.approved_electives.courses.every(
      (code) => doc.codes_seen.includes(code) && Number.isInteger(courseIdFor(code)),
    )).toBe(true);
    expect(doc.codes_seen.filter((code) => ['BIO101', 'BIO102', 'CHM111', 'CHM112', 'PHY241', 'PHY242'].includes(code)))
      .toHaveLength(6);
    expect(doc.requirement_groups.map((group) => group.title).join(' '))
      .not.toMatch(/recommended|spring only|plan of study/i);
  });

  it('imports both compositions with complete official-source provenance', () => {
    for (const slug of ['blue-ridge-community-college', 'brightpoint-community-college']) {
      const {
        acceptance, composition, doc,
      } = composedDegree(slug);
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
      expect(Object.values(doc.capture_layers).every((layer) => layer.status === 'captured'))
        .toBe(true);
      expect(acceptance.catalog.failed).toEqual([]);
      expect(check(acceptance, 'analysis_ready', 'course_resolution').severity).toBe('pass');
    }
  });
});
