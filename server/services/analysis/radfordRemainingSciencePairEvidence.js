/**
 * Standalone audit for the two Radford Figure 3/4 science-pair cells omitted
 * by the original college-specific receipt corpus.
 *
 * A positive result requires, conjunctively, exact retained official bytes,
 * one exact college-owned sending plan, two selected four-credit sciences,
 * explicit laboratory evidence, exact college-specific Transfer Virginia
 * landings, and exact Radford receiving-course pages. An equivalency for a
 * course absent from the selected plan is retained as evidence but cannot
 * create curriculum capacity.
 */

const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const { parseCoursePage } = require('../virginia/courseEquivalency');
const {
  courseIdFor,
  institutionCourseIdentity,
} = require('../virginia/courseIdentity');
const {
  PAIR_TARGETS,
} = require('./radfordCollegeSciencePairEvidence');
const {
  robotsAllows,
} = require('./radfordSciencePairEvidence');

const ARTIFACT = 'radford_remaining_science_pair_exact_source_audit';
const CATALOG_YEAR = '2026-2027';
const GENERATED_ON = '2026-08-25';
const RICHARD_BLAND_OWNER = 'va:cc:richard-bland-college';
const FACTS_SHA256 =
  '24594cf34fdcdecd7118bee2879b09e8c082bbb24583f82f715a8cfeda17e6fb';

// This audit explains the two omissions in the original 17-college corpus.
// Keep that historical boundary local instead of consulting the live
// condition matrix: once 9317 is integrated, the live matrix quite correctly
// changes while the retained proof of why the old corpus omitted it must not.
const LEGACY_OMISSION_MATRIX = Object.freeze({
  'richard-bland-college': Object.freeze({
    pair: null,
    blocker:
      'the exact A.S. tree has local PHYS identities but the current incoming Radford equivalency corpus has no exact edge',
    source_bundle_sha256:
      'eaae55d519535782ad80339e3365627a7855dededae58b8326bf643478d94186',
  }),
  'southwest-virginia-community-college': Object.freeze({
    pair: null,
    blocker: 'the exact A.S. tree exposes only one named eligible science course',
    source_bundle_sha256:
      '0dfe87d22adef2dcc0588b3c13e7fab92748c027add477fd087f91f93a981d1c',
  }),
});

const TRANSFER_RECEIPTS = Object.freeze({
  'richard-bland-college:PHYS201': Object.freeze({
    institution: 'Richard Bland College', code: 'PHYS201', title: 'University Physics',
    credits: 4, receiving_code: 'PHYS221', receiving_name: 'Physics',
    url: 'https://www.transfervirginia.org/course/2FB60A081F9511F082AC0242AC15010A',
    bytes: 44040,
    sha256: 'c6af4364c181f0d3a1c8e530f540f5ef77c612a9139aec568e5703b511f24288',
    exact_course_note:
      'Continuous course; three hours lecture; one hour laboratory. UCGS approved course, 2021.',
  }),
  'richard-bland-college:PHYS202': Object.freeze({
    institution: 'Richard Bland College', code: 'PHYS202', title: 'University Physics',
    credits: 4, receiving_code: 'PHYS222', receiving_name: 'Physics',
    url: 'https://www.transfervirginia.org/course/2FB60A911F9511F082AC0242AC15010A',
    bytes: 43691,
    sha256: '1e0b16b566448e44afd2c67522b995c7cd762470cef62e10a54352b5fa366a2c',
    exact_course_note:
      'Continuous course; three hours lecture; one hour laboratory. UCGS approved course, 2021.',
  }),
  'southwest-virginia-community-college:PHY241': Object.freeze({
    institution: 'Southwest Virginia Community College', code: 'PHY241',
    title: 'University Physics I', credits: 4,
    receiving_code: 'PHYS221', receiving_name: 'Physics',
    url: 'https://www.transfervirginia.org/course/0E2F34D61F9511F082AC0242AC15010A',
    bytes: 47643,
    sha256: '939694b81bbed69db16478432249ade9d8a43a6ee7f3dc8f8d57c21e4086b6e1',
    exact_course_note: null,
  }),
  'southwest-virginia-community-college:PHY242': Object.freeze({
    institution: 'Southwest Virginia Community College', code: 'PHY242',
    title: 'University Physics II', credits: 4,
    receiving_code: 'PHYS222', receiving_name: 'Physics',
    url: 'https://www.transfervirginia.org/course/0E2F35301F9511F082AC0242AC15010A',
    bytes: 47104,
    sha256: '7a7a90b5630677f85c3d6d1fb69ddabcf20a131b46bd9920ba76a7a80946c59f',
    exact_course_note: null,
  }),
});

const RADFORD_RECEIPTS = Object.freeze({
  PHYS221: Object.freeze({
    title: 'Physics I (GE)', credits: 4,
    url: 'https://www.radford.edu/registrar/course-descriptions/physics/phys-221.html',
    bytes: 111045,
    sha256: 'fd957d8cf9b9fdc48b8d8708f688977fcae92a7ceda96a81820e3d639374f108',
  }),
  PHYS222: Object.freeze({
    title: 'Physics II (GE)', credits: 4,
    url: 'https://www.radford.edu/registrar/course-descriptions/physics/phys-222.html',
    bytes: 111516,
    sha256: 'af355d4c6f0108f9b22b7be61120ec50b133bdd53958f35781cc4ec6e0bc7dcd',
  }),
});

const ROBOTS_RECEIPTS = Object.freeze({
  transfer: Object.freeze({
    host: 'www.transfervirginia.org',
    url: 'https://www.transfervirginia.org/robots.txt',
    crawl_delay: 10,
    bytes: 2189,
    sha256: '278e83bcf567badfebcdea4d5d20ca9898e4449fe4eb2e3b5a08227b4ca9b762',
  }),
  radford: Object.freeze({
    host: 'www.radford.edu',
    url: 'https://www.radford.edu/robots.txt',
    crawl_delay: 0,
    bytes: 401,
    sha256: '16bbefe843bf06054d6f7df31d8978a401777519bbf5558066477dc0a8af0a4e',
  }),
});

const PLAN_RECEIPTS = Object.freeze({
  'richard-bland-college': Object.freeze({
    numeric_id: 9317,
    institution: 'Richard Bland College',
    url: 'http://catalog.rbc.edu/preview_program.php?catoid=10&poid=197&returnto=412&print=1',
    text_bytes: 6442,
    text_sha256: 'a77c485b8d11292d18c445a8f956b7a75e59ef84a909d336b801e3f5acf48a89',
    composition_sha256: '40c4bbf5eb4fa651dcb48dbda3eb295cffec6359e8d1614b76c6179d7d4f6d34',
    source_bundle_sha256:
      'eaae55d519535782ad80339e3365627a7855dededae58b8326bf643478d94186',
    selected_pair: Object.freeze(['PHYS201', 'PHYS202']),
    exact_plan_fragment:
      'Investigation of the Natural World: 8 Credit Hours Required Courses: PHYS - 201 University Physics (Lecture and Lab) Credits: 4 PHYS - 202 University Physics (Lecture and Lab) Credits: 4',
    existing_blocker:
      'the exact A.S. tree has local PHYS identities but the current incoming Radford equivalency corpus has no exact edge',
  }),
  'southwest-virginia-community-college': Object.freeze({
    numeric_id: 9319,
    institution: 'Southwest Virginia Community College',
    url: 'https://catalog.sw.edu/preview_program.php?catoid=13&poid=1613&returnto=761&print=1',
    text_bytes: 2350,
    text_sha256: '14d006b4f24c1f790c799faf988df8bbb4c46345a93de778832713942b05e130',
    composition_sha256: '900428318fe220f6571836dcb78bf85b119f5cbde164461d4d96785de0b09fb3',
    source_bundle_sha256:
      '0dfe87d22adef2dcc0588b3c13e7fab92748c027add477fd087f91f93a981d1c',
    selected_pair: null,
    existing_blocker: 'the exact A.S. tree exposes only one named eligible science course',
  }),
});

const SOUTHWEST_REQUIRED_ROWS = Object.freeze([
  Object.freeze(['MTH263', 4]), Object.freeze(['EGR121', 2]),
  Object.freeze(['CSC221', 3]), Object.freeze(['HISTORY_ELECTIVE', 3]),
  Object.freeze(['ENG111', 3]), Object.freeze(['SDV100', 1]),
  Object.freeze(['ENG112', 3]), Object.freeze(['MTH264', 4]),
  Object.freeze(['EGR122', 3]), Object.freeze(['CSC222', 4]),
  Object.freeze(['MTH288', 3]), Object.freeze(['PHY241', 4]),
  Object.freeze(['CSC205', 3]), Object.freeze(['HUMANITIES_ELECTIVE', 3]),
  Object.freeze(['MTH265', 4]), Object.freeze(['CSC223', 4]),
  Object.freeze(['PHI220', 3]), Object.freeze(['CST100', 3]),
  Object.freeze(['SOCIAL_BEHAVIORAL_ELECTIVE', 3]),
]);

const normalize = (value) => String(value || '')
  .replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const bytes = (value) => Buffer.isBuffer(value)
  ? value : Buffer.from(String(value || ''), 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function semanticSha256(value) {
  return sha256(JSON.stringify(stable(value)));
}

function compositionBoundary(composition) {
  return {
    slug: composition?.slug,
    catalog_year: composition?.catalog_year,
    program: composition?.program,
    award: composition?.award,
    total_units: composition?.total_units,
    total_units_max: composition?.total_units_max,
    course_namespace: composition?.course_namespace || null,
    unit_audit: composition?.unit_audit,
    modeling_notes: composition?.modeling_notes,
    data_quality_flags: composition?.data_quality_flags,
    requirement_groups: composition?.requirement_groups,
  };
}

function responseBoundaryIssues(body, response, expected, prefix) {
  const source = bytes(body);
  const issues = [];
  if (response?.requestedUrl !== expected.url || response?.finalUrl !== expected.url) {
    issues.push(`${prefix}:url`);
  }
  if (Number(response?.status) !== 200
      || !String(response?.contentType || '').toLowerCase().includes('text/html')) {
    issues.push(`${prefix}:response`);
  }
  if (source.length !== expected.bytes || sha256(source) !== expected.sha256
      || (response?.responseBytes != null && Number(response.responseBytes) !== source.length)
      || (response?.responseSha256 != null && response.responseSha256 !== sha256(source))) {
    issues.push(`${prefix}:bytes`);
  }
  return issues;
}

function courseNote(html) {
  const $ = cheerio.load(bytes(html).toString('utf8'));
  const values = $('.card').filter((index, card) => (
    normalize($(card).find('.title-header').first().text()) === 'Course Notes'
  )).find('.title-info').map((index, element) => normalize($(element).text())).get();
  return values.length === 1 ? values[0] : null;
}

function exactTransferReceipt(body, response, expected, prefix) {
  const issues = responseBoundaryIssues(body, response, expected, prefix);
  const page = parseCoursePage(bytes(body).toString('utf8'), { url: expected.url });
  const radfordEdges = (page.equivalencies || []).filter((edge) => (
    edge.institution === 'Radford University' && edge.level === 'four_year'
  ));
  const exactEdges = radfordEdges.filter((edge) => (
    edge.identifier === expected.receiving_code
      && edge.name === expected.receiving_name
      && edge.notes == null
  ));
  if (page.institution !== expected.institution || page.code !== expected.code
      || page.title !== expected.title || Number(page.credits) !== expected.credits) {
    issues.push(`${prefix}:sending_identity`);
  }
  if (exactEdges.length !== 1) issues.push(`${prefix}:radford_edge`);
  const note = courseNote(body);
  if (expected.exact_course_note != null && note !== expected.exact_course_note) {
    issues.push(`${prefix}:laboratory_note`);
  }
  return {
    issues,
    receipt: {
      source_institution: page.institution || null,
      sending_code: page.code || null,
      sending_title: page.title || null,
      sending_credits: Number(page.credits) || null,
      sending_course_note: note,
      receiving_institution: exactEdges[0]?.institution || null,
      receiving_code: exactEdges[0]?.identifier || null,
      receiving_name: exactEdges[0]?.name ?? null,
      receiving_notes: exactEdges[0]?.notes ?? null,
      observed_radford_edges: radfordEdges.map((edge) => ({
        receiving_code: edge.identifier,
        receiving_name: edge.name ?? null,
        receiving_notes: edge.notes ?? null,
      })),
      source: {
        requested_url: response?.requestedUrl || null,
        final_url: response?.finalUrl || null,
        http_status: Number(response?.status) || null,
        content_type: response?.contentType || null,
        response_bytes: bytes(body).length,
        response_sha256: sha256(bytes(body)),
      },
    },
  };
}

function exactRadfordReceipt(body, response, code, expected) {
  const prefix = `radford:${code}`;
  const issues = responseBoundaryIssues(body, response, expected, prefix);
  const $ = cheerio.load(bytes(body).toString('utf8'));
  const displayCode = code.replace(/^(\D+)(\d+)$/, '$1 $2');
  const title = normalize($('title').text());
  const headings = $('h1').map((index, element) => normalize($(element).text())).get();
  const mainText = normalize($('main').text() || $('body').text());
  const bodyText = normalize($('body').text());
  const credit = new RegExp(`${displayCode.replace(' ', '\\s*')}[\\s\\S]{0,100}${expected.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,80}Credit hours \\(4\\)`, 'i');
  const labFragments = [
    "The lab exercises are designed to reinforce the student's understanding",
    'A lab report must be submitted for each lab exercise.',
  ];
  if (title !== displayCode || headings.length !== 1 || headings[0] !== displayCode
      || !credit.test(mainText)) issues.push(`${prefix}:course_identity_or_credits`);
  if (!labFragments.every((fragment) => mainText.includes(fragment))) {
    issues.push(`${prefix}:laboratory_instruction`);
  }
  if (!bodyText.includes('Copyright © 2026 Radford University')) {
    issues.push(`${prefix}:current_official_boundary`);
  }
  return {
    issues,
    receipt: {
      course_code: code,
      title: expected.title,
      credits: expected.credits,
      laboratory_exercises_required: labFragments[0],
      laboratory_report_required: labFragments[1],
      source: {
        requested_url: response?.requestedUrl || null,
        final_url: response?.finalUrl || null,
        http_status: Number(response?.status) || null,
        content_type: response?.contentType || null,
        response_bytes: bytes(body).length,
        response_sha256: sha256(bytes(body)),
      },
    },
  };
}

function exactRobotsReceipt(body, response, expected, targetUrls, key) {
  const source = bytes(body);
  const text = source.toString('utf8');
  const issues = [];
  if (response?.host !== expected.host
      || response?.requestedUrl !== expected.url || response?.finalUrl !== expected.url
      || Number(response?.status) !== 200
      || Number(response?.crawlDelay) !== expected.crawl_delay
      || source.length !== expected.bytes || sha256(source) !== expected.sha256
      || !targetUrls.every((url) => robotsAllows(url, text))) {
    issues.push(`robots:${key}`);
  }
  return {
    issues,
    receipt: {
      url: expected.url,
      http_status: Number(response?.status) || null,
      response_bytes: source.length,
      response_sha256: sha256(source),
      crawl_delay_seconds: Number(response?.crawlDelay) || 0,
      policy_paths_allowed: targetUrls.every((url) => robotsAllows(url, text)),
    },
  };
}

function planSource(requirements, slug) {
  const matches = (requirements?.sources || []).filter((source) => source?.id === 'major');
  return matches.length === 1 ? matches[0] : null;
}

function sectionCodes(section) {
  return (section?.receivers || []).flatMap((receiver) => (
    (receiver?.options || []).flatMap((option) => option)
  ));
}

function allCompositionCodes(value, out = []) {
  if (typeof value === 'string' && /^[A-Z]{2,5}\d{2,4}[A-Z]{0,2}$/.test(value)) {
    out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => allCompositionCodes(entry, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => allCompositionCodes(entry, out));
  }
  return out;
}

function richardBlandPlan(textBody, requirements, composition) {
  const expected = PLAN_RECEIPTS['richard-bland-college'];
  const source = bytes(textBody);
  const text = normalize(source.toString('utf8'));
  const sourceRow = planSource(requirements, 'richard-bland-college');
  const science = (composition?.requirement_groups || []).filter((group) => (
    group?.title === 'Investigation of the Natural World'
  ));
  const issues = [];
  if (source.length !== expected.text_bytes || sha256(source) !== expected.text_sha256
      || !text.includes(expected.exact_plan_fragment)) issues.push('plan:richard_bland:bytes');
  if (!sourceRow || sourceRow.url !== expected.url || sourceRow.requested_url !== expected.url
      || sourceRow.sha256 !== expected.text_sha256 || sourceRow.official !== true) {
    issues.push('plan:richard_bland:source_boundary');
  }
  if (composition?.catalog_year !== CATALOG_YEAR || composition?.total_units !== 60
      || semanticSha256(compositionBoundary(composition)) !== expected.composition_sha256
      || composition?.course_namespace?.kind !== 'institution_local'
      || composition?.course_namespace?.institution_id !== RICHARD_BLAND_OWNER
      || composition?.course_namespace?.vccs_master_applicable !== false
      || science.length !== 1 || science[0].sections?.length !== 2
      || JSON.stringify(science[0].sections.map(sectionCodes))
        !== JSON.stringify([['PHYS201'], ['PHYS202']])
      || science[0].sections.some((section) => (
        section?.select !== 1 || Number(section?.units) !== 4
      ))) {
    issues.push('plan:richard_bland:selected_tree');
  }
  const identities = expected.selected_pair.map((code) => institutionCourseIdentity(
    RICHARD_BLAND_OWNER, code,
  ));
  if (identities.some((identity, index) => !identity
      || identity.code !== expected.selected_pair[index]
      || identity.identity_scope !== 'institution_local'
      || identity.vccs_master_applicable !== false
      || identity.course_id === courseIdFor(identity.code))) {
    issues.push('plan:richard_bland:owner_identity');
  }
  return {
    issues,
    receipt: {
      source_url: expected.url,
      response_bytes: source.length,
      response_sha256: sha256(source),
      source_bundle_sha256: expected.source_bundle_sha256,
      composition_sha256: semanticSha256(compositionBoundary(composition)),
      degree_total_units: composition?.total_units ?? null,
      science_requirement_units: 8,
      selected_sciences: identities,
      laboratory_basis: 'Both exact official plan rows are labeled Lecture and Lab.',
      exact_plan_fragment: expected.exact_plan_fragment,
    },
  };
}

function southwestSourceRows(text) {
  const rows = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = normalize(rawLine);
    const course = /^([A-Z]{2,5})\s+(\d{2,4}[A-Z]{0,2}):.+?(\d+) Credits?$/.exec(line);
    if (course) {
      rows.push([`${course[1]}${course[2]}`, Number(course[3])]);
      continue;
    }
    const elective = /^Elective:\s*(History Elective|Humanities, Literature or Fine Arts Elective|Social & Behavioral Science Elective)\s+(\d+) Credits?$/.exec(line);
    if (elective) {
      const key = elective[1] === 'History Elective' ? 'HISTORY_ELECTIVE'
        : elective[1].startsWith('Humanities') ? 'HUMANITIES_ELECTIVE'
          : 'SOCIAL_BEHAVIORAL_ELECTIVE';
      rows.push([key, Number(elective[2])]);
    }
  }
  return rows;
}

function southwestPlan(textBody, requirements, composition) {
  const expected = PLAN_RECEIPTS['southwest-virginia-community-college'];
  const source = bytes(textBody);
  const rawText = source.toString('utf8');
  const text = normalize(rawText);
  const rows = southwestSourceRows(rawText);
  const sourceRow = planSource(requirements, 'southwest-virginia-community-college');
  const issues = [];
  if (source.length !== expected.text_bytes || sha256(source) !== expected.text_sha256) {
    issues.push('plan:southwest:bytes');
  }
  if (!sourceRow || sourceRow.url !== expected.url || sourceRow.requested_url !== expected.url
      || sourceRow.sha256 !== expected.text_sha256 || sourceRow.official !== true) {
    issues.push('plan:southwest:source_boundary');
  }
  if (JSON.stringify(rows) !== JSON.stringify(SOUTHWEST_REQUIRED_ROWS)
      || rows.reduce((sum, row) => sum + row[1], 0) !== 60
      || !text.includes('Labs Hours: 4 Course Credits: 13')
      || !text.includes('Total Minimum Credits: 60')) {
    issues.push('plan:southwest:fixed_inventory');
  }
  const groups = composition?.requirement_groups || [];
  const codes = allCompositionCodes(groups);
  const scienceCodes = [...new Set(codes.filter((code) => (
    /^(?:BIO|CHM|ENV|GOL|NAS|PHY)\d/.test(code)
  )))];
  const modeledUnits = groups.flatMap((group) => group.sections || [])
    .reduce((sum, section) => sum + Number(section?.units || 0), 0);
  const hasOpenCapacity = groups.some((group) => (
    Number(group?.units || 0) > 0
      || (group?.sections || []).some((section) => !(section?.receivers || []).length)
  ));
  if (composition?.catalog_year !== CATALOG_YEAR || composition?.total_units !== 60
      || composition?.total_units_max !== 60
      || semanticSha256(compositionBoundary(composition)) !== expected.composition_sha256
      || modeledUnits !== 60 || hasOpenCapacity
      || JSON.stringify(scienceCodes) !== JSON.stringify(['PHY241'])) {
    issues.push('plan:southwest:selected_tree');
  }
  return {
    issues,
    receipt: {
      source_url: expected.url,
      response_bytes: source.length,
      response_sha256: sha256(source),
      source_bundle_sha256: expected.source_bundle_sha256,
      composition_sha256: semanticSha256(compositionBoundary(composition)),
      degree_total_units: composition?.total_units ?? null,
      fixed_or_typed_rows: rows,
      fixed_or_typed_row_units: rows.reduce((sum, row) => sum + row[1], 0),
      selected_sciences: scienceCodes,
      open_science_capacity: hasOpenCapacity,
      selected_laboratory_hours: 4,
      missing_pair_course: 'PHY242',
    },
  };
}

function legacyRows(html, institution) {
  const $ = cheerio.load(String(html || ''));
  const rows = [];
  $('#courses-equivalencies-table table tr').each((index, row) => {
    const cells = $(row).find('td').map((cellIndex, cell) => normalize($(cell).text())).get();
    if (cells.length >= 5 && cells[0] === institution && cells[4].toLowerCase() === '2-year') {
      rows.push({ code: cells[1].replace(/[\s-]/g, '').toUpperCase(), title: cells[2] });
    }
  });
  return rows;
}

function reproduceExistingOmission(legacyDiscoveryPages = {}) {
  const issues = [];
  const output = {};
  const expectedRows = {
    'richard-bland-college': ['CHEM101', 'CHEM102', 'PHYS101', 'PHYS102'],
    'southwest-virginia-community-college': ['CHM111', 'CHM112', 'PHY201', 'PHY202'],
  };
  for (const [slug, plan] of Object.entries(PLAN_RECEIPTS)) {
    const rows = Object.values(legacyDiscoveryPages).flatMap((html) => (
      legacyRows(html, plan.institution)
    ));
    const matrix = LEGACY_OMISSION_MATRIX[slug];
    const targeted = PAIR_TARGETS.some((target) => target.college_slug === slug);
    if (targeted || matrix?.pair !== null || matrix?.blocker !== plan.existing_blocker
        || matrix?.source_bundle_sha256 !== plan.source_bundle_sha256
        || JSON.stringify(rows.map((row) => row.code)) !== JSON.stringify(expectedRows[slug])) {
      issues.push(`legacy_omission:${slug}`);
    }
    output[slug] = {
      existing_pair_target: targeted,
      observed_legacy_discovery_codes: rows.map((row) => row.code),
      selected_plan_codes: plan.selected_pair || ['PHY241'],
      exact_selected_codes_discovered: (plan.selected_pair || ['PHY241'])
        .filter((code) => rows.some((row) => row.code === code)),
      matrix_pair: matrix?.pair || null,
      matrix_blocker: matrix?.blocker || null,
      matrix_source_bundle_sha256: matrix?.source_bundle_sha256 || null,
      reproduced: !targeted && matrix?.pair === null
        && matrix?.blocker === plan.existing_blocker
        && matrix?.source_bundle_sha256 === plan.source_bundle_sha256,
    };
  }
  return { issues, output };
}

function buildRadfordRemainingSciencePairEvidence({
  transferPages = {},
  transferResponses = {},
  radfordPages = {},
  radfordResponses = {},
  robots = {},
  planTexts = {},
  requirements = {},
  compositions = {},
  legacyDiscoveryPages = {},
} = {}) {
  const issues = [];
  const transfer = {};
  for (const [key, expected] of Object.entries(TRANSFER_RECEIPTS)) {
    const parsed = exactTransferReceipt(
      transferPages[key], transferResponses[key], expected, `transfer:${key}`,
    );
    transfer[key] = parsed.receipt;
    issues.push(...parsed.issues);
  }
  const radford = {};
  for (const [code, expected] of Object.entries(RADFORD_RECEIPTS)) {
    const parsed = exactRadfordReceipt(
      radfordPages[code], radfordResponses[code], code, expected,
    );
    radford[code] = parsed.receipt;
    issues.push(...parsed.issues);
  }
  const transferRobots = exactRobotsReceipt(
    robots.transfer?.body, robots.transfer, ROBOTS_RECEIPTS.transfer,
    Object.values(TRANSFER_RECEIPTS).map((receipt) => receipt.url), 'transfer',
  );
  const radfordRobots = exactRobotsReceipt(
    robots.radford?.body, robots.radford, ROBOTS_RECEIPTS.radford,
    Object.values(RADFORD_RECEIPTS).map((receipt) => receipt.url), 'radford',
  );
  issues.push(...transferRobots.issues, ...radfordRobots.issues);

  const richardBland = richardBlandPlan(
    planTexts['richard-bland-college'], requirements['richard-bland-college'],
    compositions['richard-bland-college'],
  );
  const southwest = southwestPlan(
    planTexts['southwest-virginia-community-college'],
    requirements['southwest-virginia-community-college'],
    compositions['southwest-virginia-community-college'],
  );
  issues.push(...richardBland.issues, ...southwest.issues);
  const omission = reproduceExistingOmission(legacyDiscoveryPages);
  issues.push(...omission.issues);

  const boundaryVerified = issues.length === 0;
  const cells = [
    {
      numeric_id: 9317,
      slug: 'richard-bland-college',
      institution: 'Richard Bland College',
      existing_omission: omission.output['richard-bland-college'],
      sending_plan: richardBland.receipt,
      selected_pair: [
        transfer['richard-bland-college:PHYS201'],
        transfer['richard-bland-college:PHYS202'],
      ],
      receiving_courses: [radford.PHYS221, radford.PHYS222],
      selected_sending_units: 8,
      selected_receiving_units: 8,
      distinct_selected_sciences: 2,
      selected_laboratory_courses: 2,
      safe_to_close: boundaryVerified,
      verdict: boundaryVerified ? 'closed_by_exact_college_specific_evidence' : 'not_verified',
      blocker: boundaryVerified ? null : 'an exact source, byte, route, owner, or plan boundary changed',
    },
    {
      numeric_id: 9319,
      slug: 'southwest-virginia-community-college',
      institution: 'Southwest Virginia Community College',
      existing_omission: omission.output['southwest-virginia-community-college'],
      sending_plan: southwest.receipt,
      selected_pair: null,
      selected_course_receipt: transfer['southwest-virginia-community-college:PHY241'],
      absent_plan_course_receipt: transfer['southwest-virginia-community-college:PHY242'],
      receiving_courses: [radford.PHYS221, radford.PHYS222],
      selected_sending_units: 4,
      selected_receiving_units: 4,
      distinct_selected_sciences: 1,
      selected_laboratory_courses: 1,
      safe_to_close: false,
      verdict: boundaryVerified ? 'irreducible_selected_plan_gap' : 'not_verified',
      blocker: boundaryVerified
        ? 'The exact 60-credit selected plan contains PHY241 but not PHY242 and has no open science capacity; the unselected PHY242 equivalency cannot create a requirement.'
        : 'an exact source, byte, route, or plan boundary changed',
    },
  ];
  const facts = {
    existing_corpus_target_count: PAIR_TARGETS.length,
    audited_numeric_ids: cells.map((cell) => cell.numeric_id),
    exact_cells_closed: cells.filter((cell) => cell.safe_to_close).map((cell) => cell.numeric_id),
    irreducible_numeric_ids: cells.filter((cell) => (
      cell.verdict === 'irreducible_selected_plan_gap'
    )).map((cell) => cell.numeric_id),
    cells,
  };
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: GENERATED_ON,
    catalog_year: CATALOG_YEAR,
    purpose:
      'Exact-source audit of the two omitted Radford two-sciences/one-laboratory cells. Equivalency evidence never adds an unselected sending course or collapses institution-local identity into VCCS identity.',
    verified: boundaryVerified,
    issues,
    robots: { transfer: transferRobots.receipt, radford: radfordRobots.receipt },
    facts,
    facts_sha256: semanticSha256(facts),
    safe_resolution_delta: facts.exact_cells_closed.length,
    exact_cells_closed: facts.exact_cells_closed,
    irreducible_numeric_ids: facts.irreducible_numeric_ids,
  };
}

function radfordRemainingSciencePairEvidenceIssue(evidence) {
  if (!evidence || evidence.schema_version !== 1 || evidence.artifact !== ARTIFACT
      || evidence.generated_on !== GENERATED_ON || evidence.catalog_year !== CATALOG_YEAR
      || evidence.verified !== true || (evidence.issues || []).length !== 0
      || evidence.facts_sha256 !== FACTS_SHA256
      || semanticSha256(evidence.facts) !== FACTS_SHA256
      || evidence.safe_resolution_delta !== 1
      || JSON.stringify(evidence.exact_cells_closed) !== JSON.stringify([9317])
      || JSON.stringify(evidence.irreducible_numeric_ids) !== JSON.stringify([9319])) {
    return 'the exact remaining Radford science-pair audit inventory changed';
  }
  for (const [key, expected] of Object.entries(ROBOTS_RECEIPTS)) {
    const receipt = evidence.robots?.[key];
    if (receipt?.url !== expected.url || receipt?.http_status !== 200
        || receipt?.response_bytes !== expected.bytes
        || receipt?.response_sha256 !== expected.sha256
        || receipt?.crawl_delay_seconds !== expected.crawl_delay
        || receipt?.policy_paths_allowed !== true) {
      return `the exact ${key} robots receipt changed`;
    }
  }
  return null;
}

module.exports = {
  ARTIFACT,
  CATALOG_YEAR,
  FACTS_SHA256,
  GENERATED_ON,
  LEGACY_OMISSION_MATRIX,
  PLAN_RECEIPTS,
  RADFORD_RECEIPTS,
  RICHARD_BLAND_OWNER,
  ROBOTS_RECEIPTS,
  SOUTHWEST_REQUIRED_ROWS,
  TRANSFER_RECEIPTS,
  allCompositionCodes,
  buildRadfordRemainingSciencePairEvidence,
  compositionBoundary,
  exactRadfordReceipt,
  exactRobotsReceipt,
  exactTransferReceipt,
  legacyRows,
  normalize,
  radfordRemainingSciencePairEvidenceIssue,
  reproduceExistingOmission,
  richardBlandPlan,
  semanticSha256,
  southwestPlan,
  southwestSourceRows,
};
