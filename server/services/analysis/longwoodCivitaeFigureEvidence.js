/**
 * Structural capture/validation for Longwood's 2026-2027 Civitae menus.
 *
 * Acalog's AJAX responses contain volatile presentation ids, so raw-response
 * hashes are not reproducible.  This module retains the stable authority:
 * program title, complete ordered course roster, and the exact selected course
 * entry.  The capture command re-fetches every official catoid-19 endpoint and
 * rebuilds this artifact; the paper evaluator separately binds the artifact's
 * bytes to the complete reviewed degree tree.
 */

const { createHash } = require('node:crypto');

const CATALOG_YEAR = '2026-2027';
const CATALOG_ID = 19;
const BASE = 'https://catalog.longwood.edu';

const PROGRAM_SOURCES = Object.freeze([
  Object.freeze({ id: 'pillar_overview', poid: 2788 }),
  Object.freeze({ id: 'pillar_historical', poid: 2789 }),
  Object.freeze({ id: 'pillar_behavioral', poid: 2791 }),
  Object.freeze({ id: 'pillar_global', poid: 2792 }),
  Object.freeze({ id: 'pillar_aesthetic', poid: 2793 }),
  Object.freeze({ id: 'pillar_quantitative', poid: 2794 }),
  Object.freeze({ id: 'pillar_scientific', poid: 2795 }),
  Object.freeze({ id: 'perspectives_overview', poid: 2796 }),
  Object.freeze({ id: 'perspective_historical_or_behavioral', poid: 2797 }),
  Object.freeze({ id: 'perspective_global_or_aesthetic', poid: 2798 }),
  Object.freeze({ id: 'perspective_quantitative_or_scientific', poid: 2799 }),
  Object.freeze({ id: 'perspective_integrating_world_languages', poid: 2800 }),
]);

const COURSE_SOURCES = Object.freeze([
  Object.freeze({
    code: 'HIST150', coid: 25345, program_source_id: 'pillar_historical',
    units: 3, designation: 'FHCI', role: 'pillar_historical',
    prerequisite: 'None',
  }),
  Object.freeze({
    code: 'PSYC230', coid: 24702, program_source_id: 'pillar_behavioral',
    units: 3, designation: 'FHBS', role: 'pillar_behavioral',
    prerequisite: 'None',
  }),
  Object.freeze({
    code: 'RELI242', coid: 24377, program_source_id: 'pillar_global',
    units: 3, designation: 'FGLO', role: 'pillar_global',
    prerequisite: 'None',
  }),
  Object.freeze({
    code: 'ART125', coid: 24848, program_source_id: 'pillar_aesthetic',
    units: 3, designation: 'FAES', role: 'pillar_aesthetic',
    prerequisite: null,
  }),
  Object.freeze({
    code: 'MATH171', coid: 24502, program_source_id: 'pillar_quantitative',
    units: 3, designation: 'FQRC', role: 'pillar_quantitative_and_major',
    prerequisite: 'None',
  }),
  Object.freeze({
    code: 'ENSC162', coid: 25329, program_source_id: 'pillar_scientific',
    units: 3, designation: 'FSRC', role: 'pillar_scientific',
    prerequisite: null,
  }),
  Object.freeze({
    code: 'PSYC335', coid: 25651,
    program_source_id: 'perspective_historical_or_behavioral',
    units: 3, designation: 'PHBS', role: 'perspective_behavioral',
    prerequisite: 'Completion of FHBS pillar',
    sacsco_category: 'social_behavioral_science',
  }),
  Object.freeze({
    code: 'RELI301', coid: 25603,
    program_source_id: 'perspective_global_or_aesthetic',
    units: 3, designation: 'PGLO', role: 'perspective_global',
    prerequisite: 'Completion of FGLO pillar',
    sacsco_category: 'humanities_fine_arts',
  }),
  Object.freeze({
    code: 'MATH301', coid: 24510,
    program_source_id: 'perspective_quantitative_or_scientific',
    units: 3, designation: 'PQRC', role: 'perspective_quantitative',
    prerequisite: 'MATH 171 with a grade of C- or better and completion of FHBS pillar',
    sacsco_category: 'mathematics_natural_sciences',
  }),
  Object.freeze({
    code: 'SPAN320', coid: 24360,
    program_source_id: 'perspective_integrating_world_languages',
    units: 3, designation: 'PWLA', role: 'perspective_integrating_world_languages',
    prerequisite: 'SPAN 212 or appropriate placement test score',
    selected_prerequisite_route: 'appropriate placement test score',
  }),
]);

const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#8217;|&rsquo;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#(\d+);/g, (_match, number) => String.fromCodePoint(Number(number)));
}

function normalizedHtmlText(value) {
  return decodeEntities(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function structuralHash(value) {
  return sha256(JSON.stringify(stable(value)));
}

function parseProgramResponse(html) {
  const title = normalizedHtmlText((String(html).match(/<h1>([\s\S]*?)<\/h1>/i) || [])[1]);
  const courses = [...String(html).matchAll(
    /preview_course_nopop\.php\?catoid=19&(?:amp;)?coid=(\d+)[^>]*>([\s\S]*?)<\/a>/gi,
  )].map((match) => {
    const label = normalizedHtmlText(match[2]);
    const code = normalizeCode((label.match(/^([A-Z]{2,8}\s*\d{2,4}[A-Z]?)/i) || [])[1]);
    if (!code) throw new Error(`Civitae roster has an unparseable course label: ${label}`);
    return { coid: Number(match[1]), code, label };
  });
  const childPrograms = [...String(html).matchAll(
    /preview_program\.php\?catoid=19&(?:amp;)?poid=(\d+)[^>]*>([\s\S]*?)<\/a>/gi,
  )].map((match) => ({ poid: Number(match[1]), label: normalizedHtmlText(match[2]) }));
  if (!title || (!courses.length && !childPrograms.length)) {
    throw new Error(`Civitae program response is structurally incomplete: ${title || '<title>'}`);
  }
  const seen = new Set();
  for (const row of courses) {
    if (seen.has(row.code)) throw new Error(`${title} duplicates ${row.code}`);
    seen.add(row.code);
  }
  return { title, courses, child_programs: childPrograms };
}

function parseCourseResponse(html) {
  const fragment = (String(html).match(/<div><h3>[\s\S]*?<\/div>/i) || [])[0];
  const exactEntryText = normalizedHtmlText(fragment);
  const head = exactEntryText.match(/^([A-Z]{2,8})\s*(\d{2,4}[A-Z]?)\s*-\s*(.*?)\s+(\d+)\s+credits\b/i);
  if (!fragment || !head) throw new Error('Civitae course response has no exact course entry');
  const prerequisite = (exactEntryText.match(
    /Prerequisite\(s\):\s*(.*?)\s*(?:Corequisite\(s\):|\*Fulfills|$)/i,
  ) || [])[1] || null;
  const designation = (exactEntryText.match(/\*Fulfills Civitae Core\s+([A-Z]+)/i) || [])[1] || null;
  return {
    code: normalizeCode(`${head[1]}${head[2]}`),
    title: head[3].trim(),
    units: Number(head[4]),
    prerequisite: prerequisite?.trim() || null,
    designation: designation?.toUpperCase() || null,
    exact_entry_text: exactEntryText,
    exact_entry_sha256: sha256(exactEntryText),
  };
}

function exactIncludes(text, excerpt, label) {
  if (!String(text).includes(excerpt)) throw new Error(`${label} changed: missing “${excerpt}”`);
}

function buildLongwoodCivitaeFigureEvidence({
  programResponses,
  courseResponses,
  retainedGeText,
  retainedGeSha256,
  retainedProgramText,
  retainedProgramSha256,
}) {
  const programs = Object.fromEntries(PROGRAM_SOURCES.map((source) => {
    const html = programResponses[source.id];
    if (!html) throw new Error(`missing ${source.id} response`);
    const parsed = parseProgramResponse(html);
    return [source.id, {
      id: source.id,
      poid: source.poid,
      official_url: `${BASE}/ajax/preview_program.php?catoid=${CATALOG_ID}&poid=${source.poid}`,
      title: parsed.title,
      roster_count: parsed.courses.length,
      roster_sha256: structuralHash(parsed.courses),
      courses: parsed.courses,
      child_programs: parsed.child_programs,
      child_programs_sha256: structuralHash(parsed.child_programs),
      normalized_response_text: normalizedHtmlText(html),
    }];
  }));

  const pillarOverview = programs.pillar_overview.normalized_response_text;
  exactIncludes(
    pillarOverview,
    'Pillar courses are introductory 100-200 level courses open to all students and have no prerequisites.',
    'Pillar overview',
  );
  exactIncludes(
    pillarOverview,
    'students may count up to two courses that satisfy program requirements toward the Civitae Core Pillar requirements.',
    'Pillar overlap rule',
  );
  exactIncludes(
    pillarOverview,
    'Students may transfer Pillar courses from other institutions with appropriate approval',
    'Pillar transfer rule',
  );

  const perspectivesOverview = programs.perspectives_overview.normalized_response_text;
  exactIncludes(
    perspectivesOverview,
    'Perspectives courses are Longwood-distinctive courses and cannot be transferred from other institutions. Perspectives courses cannot be waived.',
    'Perspectives transfer rule',
  );
  exactIncludes(
    perspectivesOverview,
    'students may count no more than one course that satisfies program requirements toward the Civitae Core Perspectives requirements.',
    'Perspectives overlap rule',
  );
  exactIncludes(
    perspectivesOverview,
    'The fourth Civitae Core Perspectives requirement must be taken prior to or concurrently with the Symposium course.',
    'Perspectives sequence rule',
  );

  const selectedCourses = COURSE_SOURCES.map((expected) => {
    const program = programs[expected.program_source_id];
    const rosterRow = program.courses.find((row) => (
      row.code === expected.code && row.coid === expected.coid
    ));
    if (!rosterRow) throw new Error(`${expected.code} left ${program.title}`);
    const html = courseResponses[expected.code];
    if (!html) throw new Error(`missing ${expected.code} course response`);
    const parsed = parseCourseResponse(html);
    if (parsed.code !== expected.code
        || parsed.units !== expected.units
        || parsed.designation !== expected.designation
        || (expected.prerequisite != null && parsed.prerequisite !== expected.prerequisite)) {
      throw new Error(`${expected.code} course identity, units, designation, or prerequisite changed`);
    }
    return {
      ...expected,
      title: parsed.title,
      official_url: `${BASE}/ajax/preview_course.php?catoid=${CATALOG_ID}&coid=${expected.coid}`,
      exact_entry_text: parsed.exact_entry_text,
      exact_entry_sha256: parsed.exact_entry_sha256,
    };
  });

  if (sha256(retainedGeText) !== retainedGeSha256) {
    throw new Error('retained Longwood general-education source hash changed');
  }
  if (sha256(retainedProgramText) !== retainedProgramSha256) {
    throw new Error('retained Longwood program source hash changed');
  }
  const normalizedGeText = normalizedHtmlText(retainedGeText);
  const normalizedProgramText = normalizedHtmlText(retainedProgramText);
  for (const excerpt of [
    'one Pillar or Perspectives course from the humanities or the arts',
    'one from the behavioral or social sciences',
    'one from mathematics or natural sciences',
    'If a course is cross-listed in different categories, students may count it toward the completion of only one requirement.',
  ]) exactIncludes(normalizedGeText, excerpt, 'retained Civitae distribution source');
  for (const excerpt of [
    'up to two Pillar courses and one Perspectives course',
    'MATH 171',
    'General Elective credit must be substituted to restore the total.',
  ]) exactIncludes(normalizedProgramText, excerpt, 'retained Computer Science overlap source');

  const pillars = selectedCourses.filter((row) => row.role.startsWith('pillar_'));
  const perspectives = selectedCourses.filter((row) => row.role.startsWith('perspective_'));
  const selectedCodes = selectedCourses.map((row) => row.code);
  const distributions = perspectives.map((row) => row.sacsco_category).filter(Boolean).sort();
  if (new Set(selectedCodes).size !== selectedCodes.length
      || pillars.length !== 6
      || perspectives.length !== 4
      || pillars.reduce((sum, row) => sum + row.units, 0) !== 18
      || perspectives.reduce((sum, row) => sum + row.units, 0) !== 12
      || JSON.stringify(distributions) !== JSON.stringify([
        'humanities_fine_arts', 'mathematics_natural_sciences', 'social_behavioral_science',
      ])) throw new Error('Civitae deterministic witness no longer closes distinctness/distribution');

  const programEvidence = Object.values(programs).map((program) => ({
    id: program.id,
    poid: program.poid,
    official_url: program.official_url,
    title: program.title,
    roster_count: program.roster_count,
    roster_sha256: program.roster_sha256,
    child_programs_sha256: program.child_programs_sha256,
  }));
  return {
    schema_version: 1,
    artifact: 'longwood_2026_2027_civitae_figure_34_evidence',
    generated_on: '2026-08-24',
    institution: { slug: 'longwood-university', school_id: 9214 },
    catalog_year: CATALOG_YEAR,
    paper_scope: {
      figures_proven_zero_impact: ['3', '4'],
      figures_still_blocked: ['6'],
      reason_figure_6_remains_blocked: 'The paper prerequisite graph still needs exact course vertices/formulas for the selected resident Perspectives and the language-placement route; this artifact does not bypass that runtime boundary.',
    },
    source_contract: {
      catalog_id: CATALOG_ID,
      catalog_context_url: `${BASE}/content.php?catoid=${CATALOG_ID}&navoid=1004`,
      retained_general_education_sha256: retainedGeSha256,
      retained_program_sha256: retainedProgramSha256,
      acalog_ajax_note: 'Volatile presentation markup is excluded; every complete ordered roster and selected exact course entry is retained structurally.',
      program_sources: programEvidence,
    },
    rules: {
      pillars_may_transfer_with_approval: true,
      perspectives_transferable: false,
      perspectives_waivable: false,
      selected_major_pillar_overlap_maximum: 2,
      selected_major_perspective_overlap_maximum: 1,
      cross_listed_course_requirement_maximum: 1,
      sacsco_categories_required: [
        'humanities_fine_arts',
        'social_behavioral_science',
        'mathematics_natural_sciences',
      ],
    },
    deterministic_witness: {
      selected_courses: selectedCourses,
      selected_course_codes: selectedCodes,
      selected_pillar_codes: pillars.map((row) => row.code),
      selected_perspective_codes: perspectives.map((row) => row.code),
      perspective_sacsco_witnesses: Object.fromEntries(perspectives
        .filter((row) => row.sacsco_category)
        .map((row) => [row.sacsco_category, row.code])),
      major_pillar_overlap_codes: ['MATH171'],
      major_perspective_overlap_codes: [],
      selected_current_major_elective_overlap_codes: [],
      fixed_first_year_units: 6,
      pillar_units: 18,
      perspective_units: 12,
      symposium_units: 3,
      total_civitae_units: 39,
      degree_total_units: 120,
      additional_units_due_to_distribution_or_single_count: 0,
      transferable_units_changed_by_resident_perspective_selection: 0,
    },
  };
}

module.exports = {
  CATALOG_ID,
  COURSE_SOURCES,
  PROGRAM_SOURCES,
  buildLongwoodCivitaeFigureEvidence,
  normalizedHtmlText,
  parseCourseResponse,
  parseProgramResponse,
  structuralHash,
};
