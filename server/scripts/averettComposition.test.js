import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { narrowToProgram } from '../services/virginia/catalogParse/pdf';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { assessRolePage } from './captureVirginiaCatalogs';
import { buildCapturedDocument } from './extractVirginiaRequirements';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8')).institutions;
const researchBatch = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'research', 'four-year-url-gap-averett-bridgewater.json'),
  'utf8',
));
const institution = registry.find((row) => row.slug === 'averett-university');
const research = researchBatch.institutions.find((row) => row.slug === 'averett-university');
const extract = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'requirements', 'averett-university.json'),
  'utf8',
));
const composition = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'composed', 'averett-university.json'),
  'utf8',
));

/**
 * Exact requirement-bearing text from printed/PDF page 110, surrounded by
 * enough form-feed pages to exercise the registry's real PDF-page contract.
 * The advisory sentence is deliberately the end anchor, and the sample-plan
 * only CSC 306 line follows it so a successful window can never ingest it.
 */
function officialPage110Fixture({ includeEndAnchor = true } = {}) {
  const page110 = [
    'COMPUTER SCIENCE (CSS) AND',
    'COMPUTER INFORMATION SYSTEMS (CIS)',
    'Averett offers Bachelor of Arts and Bachelor of Science degrees in two majors: Computer Science and',
    'Computer Information Systems.',
    'Students must attain at least a 2. 0 grade point average in the major in order to graduate.',
    'Requirements for a Major in Computer Science:',
    'CSC 211, Introduction to Programming I ............................................................ 4',
    'CSC 212, Introduction to Programming II ........................................................... 4',
    'CSC 200, Web Programming ............................................................................... 4',
    'CSC 202, I. T. Infrastructure ................................................................................ 3',
    'CSC 235, Programming in Java………………………………………………….4',
    'CSC 333, Data Structures ..................................................................................... 3',
    'CSC 372, Networks and Internets ........................................................................ 3',
    'CSC 375, Data & Information Management ........................................................ 3',
    'CSC 381, Architecture and Assembly Language ................................................. 3',
    'CSC 411, Modeling and Simulation ..................................................................... 3',
    'MTH 160, Introduction to Statistics, or MTH 403, Probability & Statistics ........ 3',
    'MTH 211, Foundations of Higher Mathematics .................................................. 3',
    'Choose nine hours of the following:',
    'CSC Elective(s) 200+ level .................................................................................. 6',
    'CSC Elective 300+ level MTH Elective 200+ level ............................................. 3',
    'Total 52',
    includeEndAnchor
      ? 'A student without previous computer experience would normally be expected to begin with CSC 211,'
      : 'A revised advisory sentence that no longer satisfies the source contract.',
    'Sample Four-Year Course Sequence for Computer Science',
    'CSC 306 Software Engineering ........................................................................... 3',
  ].join('\n');
  const pages = Array.from({ length: 110 }, () => '');
  pages[109] = page110;
  return pages.join('\f');
}

function fixtureCapture(text) {
  const finalUrl = 'https://www.averett.edu/wp-content/uploads/Academic-Catalog-2025-26.pdf';
  return {
    outcome: 'captured',
    captured_at: '2026-08-09T00:00:00.000Z',
    pages: institution.seeds.map((seed) => ({
      role: seed.role,
      requested_url: seed.url,
      final_url: finalUrl,
      status: 200,
      bytes_text: text.length,
      sha256: 'averett-page-110-fixture',
      has_content: true,
      has_requirements: seed.role === 'program' ? true : null,
      file: `averett-fixture__${seed.role}`,
    })),
  };
}

function composedDegree() {
  const compiled = compileDegreeComposition(composition, {
    institutionLevel: institution.level,
  });
  const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
  const doc = toDocument(extract, institution, credits, composition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { acceptance, compiled, doc };
}

const check = (acceptance, bucket, name) => acceptance[bucket].checks
  .find((row) => row.name === name);

const sectionUnits = (group) => group.sections.reduce(
  (sum, section) => sum + section.unit_advisement,
  0,
);

describe('Averett 2025-2026 official-source blocked composition', () => {
  it('pins capture and extraction to the exact page-110 source window and fails closed', () => {
    expect(institution).toMatchObject({
      platform: 'pdf',
      degree_context: {
        catalog_year: '2025-2026',
        award: 'BA/BS',
      },
      pdf_parse: {
        catalog_sha256: 'e6d19cb876277c065456d67427a22355e9aff9a2082bb48188b893ac25d31dad',
        catalog_pdf_pages: 341,
        program_pdf_pages: [110, 110],
        requirements_start_anchor: 'Requirements for a Major in Computer Science:',
        requirements_end_anchor: 'A student without previous computer experience would normally be expected to begin with CSC 211,',
      },
    });
    expect(institution.pdf_parse).not.toHaveProperty('program_printed_pages');
    expect(institution.seeds.map((seed) => seed.role)).toEqual([
      'program', 'ge', 'graduation', 'policy',
    ]);

    const text = officialPage110Fixture();
    const assessment = assessRolePage('program', text, {
      transport: 'pdf',
      pdfValid: true,
      pdfParse: institution.pdf_parse,
    });
    expect(assessment).toMatchObject({
      ok: true,
      reason: null,
      window: {
        found: true,
        mode: 'configured_anchors',
        start_page: 110,
        end_page: 110,
        evidence: {
          pages: {
            configured_pdf_pages: [110, 110],
            configured_printed_pages: null,
          },
        },
      },
    });
    expect(assessment.window.text).toContain('Total 52');
    expect(assessment.window.text).not.toMatch(/A student without previous|Sample Four-Year|CSC 306/i);

    const captured = buildCapturedDocument(institution, fixtureCapture(text), {
      readFiles: () => ({ html: null, text }),
      extractedAt: '2026-08-09T01:00:00.000Z',
    });
    expect(captured).toMatchObject({
      parser: 'pdf',
      source_role: 'program',
      source_ref: 'major',
      pdf_window: {
        found: true,
        mode: 'configured_anchors',
        start_page: 110,
        end_page: 110,
      },
      source_layers: {
        major: { status: 'captured', source_refs: ['major'] },
        general_education: { status: 'captured', source_refs: ['general_education'] },
        graduation: { status: 'captured', source_refs: ['graduation'] },
        academic_policy: { status: 'captured', source_refs: ['policy'] },
      },
    });
    expect(captured.groups).toHaveLength(1);
    expect(JSON.stringify(captured.groups)).not.toMatch(/Sample Four-Year|CSC306|CSC 306/i);

    const stale = narrowToProgram(officialPage110Fixture({ includeEndAnchor: false }), institution.pdf_parse);
    expect(stale).toMatchObject({ found: false, text: '', lines: 0 });
    expect(stale.reason).toMatch(/requirements_end_anchor not found/i);

    expect(extract).toMatchObject({
      outcome: 'captured',
      catalog_year: '2025-2026',
      parser: 'pdf',
      pdf_window: {
        found: true,
        mode: 'configured_anchors',
        start_page: 110,
        end_page: 110,
      },
    });
    expect(extract.sources.map((source) => source.id)).toEqual([
      'major', 'general_education', 'graduation', 'policy',
    ]);
    expect(Object.values(extract.source_layers).every((layer) => layer.status === 'captured'))
      .toBe(true);
    expect(JSON.stringify(extract.groups)).not.toMatch(/Sample Four-Year|CSC306|CSC 306/i);
  });

  it('preserves the 49-versus-52 discrepancy and never promotes sample-plan-only CSC 306', () => {
    const fixed = research.major_requirements.fixed_courses.reduce(
      (sum, course) => sum + course.credits,
      0,
    );
    const statistics = research.major_requirements.choice_groups
      .find((group) => group.name === 'statistics_choice').credits;
    const electives = research.major_requirements.choice_groups
      .find((group) => group.name === 'computer_science_and_mathematics_electives').published_credits;
    const enumerated = fixed + statistics + electives;

    expect({ fixed, statistics, electives, enumerated }).toEqual({
      fixed: 37,
      statistics: 3,
      electives: 9,
      enumerated: 49,
    });
    expect(research.major_requirements.credit_arithmetic).toMatchObject({
      computed_total: 49,
      published_total: 52,
      difference: 3,
      status: 'does_not_reconcile',
    });
    const finalElective = research.major_requirements.choice_groups[1].subrequirements[1];
    expect(finalElective).toMatchObject({
      operator: null,
      credits: 3,
      status: 'unresolved_missing_connector_in_published_pdf',
      automatic_composition: 'blocked',
    });
    expect(research.major_requirements.excluded_content[0].important_difference)
      .toMatch(/CSC 306.*sample.*not.*requirement/i);

    const { acceptance, compiled, doc } = composedDegree();
    expect(doc).toMatchObject({
      kind: 'degree',
      _id: 'va:degree:averett-university:cs',
      school_id: 'va:uni:averett-university',
      program: 'Computer Science, B.A. or B.S.',
      degree_variant: 'BA/BS',
      catalog_year: '2025-2026',
      total_units: 120,
      collection_status: 'source_composed_blocked_draft',
      unit_audit: {
        published_major_units: 52,
        enumerated_major_units: 49,
        unresolved_published_major_difference_units: 3,
        general_education_units: 30,
        post_major_and_general_education_capacity_units: 38,
        modeled_units: 120,
        residency: {
          minimum_units: 30,
          minimum_fraction: 0.25,
          major_units_for_transfer_students_minimum: 12,
          final_units_at_averett_minimum: 30,
        },
        minimum_cumulative_gpa: 2,
        minimum_major_gpa: 2,
      },
    });
    expect(acceptance).toMatchObject({ accepted: false, ready_for_analysis: false });
    expect(acceptance.catalog.failed).toEqual(['source_quality', 'unresolved_courses']);
    expect(check(acceptance, 'analysis_ready', 'unit_closure')).toMatchObject({
      severity: 'pass',
      modeled_units: 120,
    });
    expect(check(acceptance, 'analysis_ready', 'constraint_support').severity).toBe('fail');

    const unresolved = check(acceptance, 'catalog', 'unresolved_courses');
    expect(unresolved.issues).toEqual([
      {
        path: 'requirement_groups[2].sections[1].receivers[0]',
        values: ['unresolved source connector between the CSC 300+ and MTH 200+ pools'],
      },
      {
        path: 'requirement_groups[3].sections[0].receivers[0]',
        values: ['unresolved three-credit difference between the 52-credit publication and 49 enumerated credits; CSC 306 is sample-only'],
      },
    ]);

    expect(sectionUnits(doc.requirement_groups[0])).toBe(37);
    expect(sectionUnits(doc.requirement_groups[1])).toBe(3);
    expect(sectionUnits(doc.requirement_groups[2])).toBe(9);
    expect(sectionUnits(doc.requirement_groups[3])).toBe(3);
    expect(doc.requirement_groups.flatMap((group) => group.sections)
      .reduce((sum, section) => sum + section.unit_advisement, 0)).toBe(120);
    expect(doc.requirement_groups.some((group) => group.units_fill)).toBe(false);

    const gap = composition.requirement_groups.find(
      (group) => group.title === 'Unreconciled published major-credit difference',
    );
    expect(gap.sections[0].receivers[0]).toMatchObject({
      kind: 'requirement',
      units: 3,
    });
    expect(gap.sections[0].receivers[0]).not.toHaveProperty('code');
    expect(compiled.codes_seen).not.toContain('CSC306');
    expect(doc.codes_seen).not.toContain('CSC306');
    expect(Object.keys(doc.course_titles)).not.toContain('CSC306');
    expect(composition.award_choices).toMatchObject([
      { abbreviation: 'BA', shared_major: true, additional_units: 0 },
      { abbreviation: 'BS', shared_major: true, additional_units: 0 },
    ]);
    expect(composition.excluded_content[0]).toMatchObject({
      title: 'Sample Four-Year Course Sequence for Computer Science',
      excluded_course_codes: ['CSC306'],
    });
    expect(composition.source_bundle_required.every(
      (sourceId) => doc.sources.some((source) => source.id === sourceId),
    )).toBe(true);
  });
});
