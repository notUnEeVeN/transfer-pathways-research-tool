/**
 * Exact retained-source evidence for UVA Wise Liberal Arts Core rosters.
 *
 * This module intentionally distinguishes three claims which are easy to
 * conflate:
 *
 *   1. the catalog publishes complete Self/Community/Nation/World lists;
 *   2. those lists contain one fixed 18-credit Figure 3/4 witness satisfying
 *      the published subarea, disciplinary-breadth, and single-count rules;
 *   3. the catalog does NOT publish a complete course-level Inclusive
 *      Excellence (IE) designation list in either retained official source.
 *
 * Likewise, the General Education page enumerates twelve Scientific Reasoning
 * routes, but the CS major's broader prefix rule also names Environmental
 * Science and is not limited by text to that GE list.  The GE list is therefore
 * positive evidence for an eight-credit route, not a complete major-lab roster.
 * No absence is converted into a negative course attribute here.
 */

const { createHash } = require('node:crypto');

const ARTIFACT = 'uva_wise_2026_2027_ge_roster_and_ie_gap_evidence';
const CATALOG_YEAR = '2026-2027';
const SLUG = 'the-university-of-virginia-s-college-at-wise';
const GE_URL = 'http://catalog.uvawise.edu/content.php?catoid=9&navoid=1044';
const IE_URL = 'https://www.uvawise.edu/about/leadership/advocacy-opportunity/inclusive-excellence';
const ROBOTS_URL = 'https://www.uvawise.edu/robots.txt';

const SOURCE_SHA256 = Object.freeze({
  general_education_text: 'eeaf89b77c60ab9b29edf6ee9f11fe89bd2ef7bef2b04a9c686196ffabd88a11',
  cs_major_text: '351dcdfb593b6eb07d8a13d406e1b63bb383ce0f5e132ae7b96b09309348f944',
  inclusive_excellence_html: '948e602804a30b70807ac62979aea7361e56772d7ccac50b5cd08a9d44bb8b68',
  uvawise_robots_text: '773fb8d35bb9a39d35335ee6db8dc5c912d2aacbfb823152d9c61cd647dd902d',
});

// Filled from the source parser and then frozen.  These are semantic hashes,
// not replacements for the byte hashes above; both boundaries must match.
const EXPECTED_SEMANTIC_SHA256 = Object.freeze({
  scientific_reasoning_routes: '2e1cc282b233cf1ed5b23a1f9130b049158091b796406544342697622ec20156',
  contextual_occurrences: 'afd97032fb2c2df0791509b61391ca8a6182337c05d2c03ce6e05dc62f5edf01',
  contextual_witness: 'e91163c7d9a3bc8e5a9b87eecb00ab7a621136f88e4e1cc65af1590abb244652',
});

const AREA_HEADINGS = Object.freeze([
  'Studies of Self',
  'Studies of Community',
  'Studies of Nation',
  'Studies of World',
]);
const EXPECTED_AREA_COUNTS = Object.freeze({
  Self: 53,
  Community: 38,
  Nation: 12,
  World: 42,
});
const HFA_PREFIXES = Object.freeze(['ART', 'ENG', 'HIS', 'HUM', 'MUS', 'PHI', 'THT']);
const SBS_PREFIXES = Object.freeze(['ECO', 'POL', 'PSY', 'SOC']);
const MAJOR_LAB_PREFIXES = Object.freeze(['BIO', 'CHM', 'ENV', 'GLG', 'PHY']);
const COURSE_ROW = /^([A-Z]{3})\s+([0-9X]{4})\s*-\s*(.*?)\s+Credit\(s\):\s*(.+?)(?:\s+AND)?$/;
const COURSE_LIKE_ROW = /^[A-Z]{3}\s+[0-9X]{4}\b/;

const CONTEXTUAL_WITNESS = Object.freeze([
  Object.freeze({ area: 'Self', code: 'SWE1790', units: 3, carrier: 'major_overlap' }),
  Object.freeze({ area: 'Community', code: 'SOC1100', units: 3, carrier: 'remaining_core' }),
  Object.freeze({ area: 'Nation', code: 'POL1010', units: 3, carrier: 'remaining_core' }),
  Object.freeze({ area: 'World', code: 'ANT1020', units: 3, carrier: 'remaining_core' }),
  Object.freeze({ area: 'Community', code: 'HED2230', units: 3, carrier: 'additional' }),
  Object.freeze({ area: 'Nation', code: 'HIS1070', units: 3, carrier: 'additional' }),
  Object.freeze({ area: 'World', code: 'GEO2020', units: 3, carrier: 'additional' }),
]);

const normalizeSpace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function semanticSha256(value) {
  return sha256(JSON.stringify(stable(value)));
}

function exactOccurrences(lines, marker) {
  return lines.reduce((count, line) => count + (line === marker ? 1 : 0), 0);
}

function normalizedLines(source) {
  return String(source ?? '').replace(/\u00a0/g, ' ').split(/\r?\n/)
    .map((line) => normalizeSpace(line)).filter(Boolean);
}

function unitsFromText(raw) {
  const text = normalizeSpace(raw);
  let values = [];
  const range = text.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (range) values = [Number(range[1]), Number(range[2])];
  else values = text.split(',').map((value) => Number(value.trim())).filter(Number.isFinite);
  if (!values.length || values.some((value) => value < 0)) return null;
  return {
    published: text,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    values,
  };
}

function parseCourseLine(line) {
  const match = normalizeSpace(line).match(COURSE_ROW);
  if (!match) return null;
  const units = unitsFromText(match[4]);
  if (!units) return null;
  return {
    code: `${match[1]}${match[2]}`,
    prefix: match[1],
    number: match[2],
    title: normalizeSpace(match[3]),
    units,
    followed_by_and: /\sAND$/i.test(normalizeSpace(line)),
  };
}

function boundedLines(lines, start, end, issues, label) {
  if (exactOccurrences(lines, start) !== 1 || exactOccurrences(lines, end) !== 1) {
    issues.push(`${label}:heading_occurrence`);
    return [];
  }
  const from = lines.indexOf(start);
  const to = lines.indexOf(end);
  if (from >= to) {
    issues.push(`${label}:heading_order`);
    return [];
  }
  return lines.slice(from + 1, to);
}

function parseRows(lines, issues, label) {
  const courseLike = lines.filter((line) => COURSE_LIKE_ROW.test(line));
  const entries = courseLike.map(parseCourseLine);
  if (entries.some((entry) => !entry)) issues.push(`${label}:unparseable_course_row`);
  return entries.filter(Boolean);
}

function parseScientificReasoning(lines, issues) {
  const segment = boundedLines(
    lines,
    'Scientific Reasoning 8 Hours',
    'Contextual Coursework 21 Hours (with at least 3 hours from each subarea)',
    issues,
    'scientific_reasoning',
  );
  const entries = parseRows(segment, issues, 'scientific_reasoning');
  const routes = [];
  for (let index = 0; index < entries.length; index += 1) {
    const first = entries[index];
    if (first.followed_by_and) {
      const second = entries[index + 1];
      if (!second || second.followed_by_and || first.prefix !== second.prefix) {
        issues.push(`scientific_reasoning:series_${first.code}`);
        continue;
      }
      routes.push({
        codes: [first.code, second.code],
        prefix: first.prefix,
        units: first.units.minimum + second.units.minimum,
      });
      index += 1;
    } else {
      routes.push({ codes: [first.code], prefix: first.prefix, units: first.units.minimum });
    }
  }
  if (entries.length !== 21 || routes.length !== 12) {
    issues.push('scientific_reasoning:counts');
  }
  if (new Set(entries.map((entry) => entry.code)).size !== entries.length) {
    issues.push('scientific_reasoning:duplicate_code');
  }
  if (routes.some((route) => !['BIO', 'CHM', 'GLG', 'PHY'].includes(route.prefix)
      || ![4, 5].includes(route.units))) {
    issues.push('scientific_reasoning:route_semantics');
  }
  return { entries, routes, roster_sha256: semanticSha256(routes) };
}

function parseContextualAreas(lines, issues) {
  const boundaryAfter = {
    'Studies of Self': 'Studies of Community',
    'Studies of Community': 'Studies of Nation',
    'Studies of Nation': 'Studies of World',
    'Studies of World': 'Additional Requirements',
  };
  const areas = {};
  for (const heading of AREA_HEADINGS) {
    const name = heading.replace('Studies of ', '');
    const segment = boundedLines(lines, heading, boundaryAfter[heading], issues, `context_${name}`);
    const entries = parseRows(segment, issues, `context_${name}`).map((entry) => ({
      ...entry,
      area: name,
      attributes: [
        ...(HFA_PREFIXES.includes(entry.prefix) ? ['humanities_fine_arts'] : []),
        ...(SBS_PREFIXES.includes(entry.prefix) ? ['social_behavioral_science'] : []),
      ],
    }));
    if (entries.length !== EXPECTED_AREA_COUNTS[name]) issues.push(`context_${name}:count`);
    if (new Set(entries.map((entry) => entry.code)).size !== entries.length) {
      issues.push(`context_${name}:duplicate_code`);
    }
    areas[name] = entries;
  }
  const occurrences = Object.values(areas).flat();
  if (occurrences.length !== 145) issues.push('context:occurrence_count');
  const crossArea = new Map();
  for (const entry of occurrences) {
    if (!crossArea.has(entry.code)) crossArea.set(entry.code, []);
    crossArea.get(entry.code).push(entry.area);
  }
  const repeatedAcrossAreas = [...crossArea.entries()]
    .filter(([, memberships]) => memberships.length > 1)
    .map(([code, memberships]) => ({ code, areas: memberships }));
  if (JSON.stringify(repeatedAcrossAreas) !== JSON.stringify([
    { code: 'ENG3030', areas: ['Community', 'Nation'] },
    { code: 'ENG3170', areas: ['Nation', 'World'] },
  ])) issues.push('context:cross_area_occurrences');
  return {
    areas,
    occurrences,
    unique_course_count: crossArea.size,
    repeated_across_areas: repeatedAcrossAreas,
    roster_sha256: semanticSha256(occurrences),
  };
}

function contextualPolicyText(geText, issues) {
  const normalized = normalizeSpace(geText);
  const exact = [
    'Students must take at least 3 credit hours from each subarea (Self, Community, Nation, and World) and a total of 21 hours.',
    'Humanities/Fine Arts Course – At least one Contextual course (minimum 3 credit hours) must be from Art, English, History, Humanities, Music, Philosophy, or Theater',
    'Social/Behavioral Sciences – At least one Contextual course (minimum 3 credit hours) must be from Economics, Political Science, Psychology, or Sociology',
    'Note: One course may not be used to satisfy more than one of the listed area requirements.',
  ];
  exact.forEach((statement, index) => {
    if (!normalized.includes(statement)) issues.push(`context:policy_statement_${index + 1}`);
  });
}

function contextualWitness(contextual, issues) {
  const rows = CONTEXTUAL_WITNESS.map((expected) => {
    const matches = contextual.areas[expected.area]
      .filter((entry) => entry.code === expected.code);
    if (matches.length !== 1 || matches[0].units.minimum !== expected.units
        || matches[0].units.maximum !== expected.units) {
      issues.push(`context_witness:${expected.area}:${expected.code}`);
    }
    const entry = matches[0] || null;
    return {
      ...expected,
      attributes: entry ? [...entry.attributes] : [],
      title: entry?.title || null,
    };
  });
  const codes = rows.map((row) => row.code);
  const self = rows.filter((row) => row.area === 'Self');
  const remaining = rows.filter((row) => row.carrier !== 'major_overlap');
  const areas = new Set(rows.map((row) => row.area));
  const attributes = new Set(rows.flatMap((row) => row.attributes));
  const allCoursesBelow3000 = codes.every((code) => {
    const number = Number(code.match(/(\d{4})$/)?.[1]);
    return Number.isInteger(number) && number < 3000;
  });
  if (codes.length !== new Set(codes).size) issues.push('context_witness:duplicate_course');
  if (self.length !== 1 || self[0].code !== 'SWE1790') issues.push('context_witness:self');
  if (remaining.reduce((sum, row) => sum + row.units, 0) !== 18) {
    issues.push('context_witness:remaining_units');
  }
  if (rows.reduce((sum, row) => sum + row.units, 0) !== 21) {
    issues.push('context_witness:total_units');
  }
  if (!['Self', 'Community', 'Nation', 'World'].every((area) => areas.has(area))) {
    issues.push('context_witness:subareas');
  }
  if (!attributes.has('humanities_fine_arts')
      || !attributes.has('social_behavioral_science')) {
    issues.push('context_witness:disciplinary_breadth');
  }
  if (!allCoursesBelow3000) issues.push('context_witness:course_level');
  return {
    courses: rows,
    liberal_arts_core_units: 21,
    major_overlap_self_units: 3,
    remaining_contextual_capacity_units: 18,
    distinct_course_count: new Set(codes).size,
    subareas_satisfied: ['Self', 'Community', 'Nation', 'World'],
    disciplinary_attributes_satisfied: [
      'humanities_fine_arts', 'social_behavioral_science',
    ],
    one_course_per_area_observed: codes.length === new Set(codes).size,
    all_courses_below_3000: allCoursesBelow3000,
    witness_sha256: semanticSha256(rows),
  };
}

function majorLabPrefixRule(majorText, issues) {
  const normalized = normalizeSpace(majorText);
  const exact = 'BIO XXXX/LAB, CHM XXXX/LAB, ENV XXXX/LAB, GLG XXXX/LAB or PHY XXXX/LAB - At least two natural science with associated labs. Courses must be chosen from biology, chemistry, environmental science, geology or physics. Credit(s) 8-10 *';
  if (!normalized.includes(exact)) issues.push('major_lab_prefix_rule');
  return {
    prefixes: [...MAJOR_LAB_PREFIXES],
    minimum_distinct_sciences: 2,
    minimum_units: 8,
    maximum_units: 10,
    scientific_reasoning_route_prefixes: ['BIO', 'CHM', 'GLG', 'PHY'],
    environmental_science_route_enumerated_on_ge_page: false,
    complete_major_course_roster_proved: false,
    forbidden_inference: 'The complete General Education Scientific Reasoning list is not textually declared to exhaust the broader CS-major prefix rule.',
  };
}

function ieEvidence(geText, ieHtml, issues) {
  const normalizedGe = normalizeSpace(geText);
  const normalizedIe = normalizeSpace(ieHtml.replace(/<[^>]*>/g, ' '));
  const requiredCatalogText = 'Inclusive Excellence (IE) – At least one course (minimum 3 credit hours) taken in the Liberal Arts Core Curriculum must be deignated as IE.';
  const markers = [
    'What is Inclusive Excellence coursework?',
    'IE Courses Require:',
    "IE course interest? Contact Registrar's Office",
  ];
  if (!normalizedGe.includes(requiredCatalogText)) issues.push('ie:catalog_rule');
  if (!/<title>Inclusive Excellence \| UVA Wise<\/title>/.test(ieHtml)
      || !/<h1[^>]*>[\s\S]*Inclusive Excellence[\s\S]*<\/h1>/.test(ieHtml)) {
    issues.push('ie:page_identity');
  }
  for (const marker of markers) {
    if (!normalizedIe.includes(marker)) issues.push(`ie:marker:${marker}`);
  }
  return {
    minimum_courses: 1,
    minimum_units: 3,
    scope: 'Liberal Arts Core Curriculum',
    designation_definition_published: true,
    designation_assignment_authority: 'UVA Wise Registrar / curriculum process',
    course_level_designation_rows: [],
    course_level_roster_completeness_proved: false,
    negative_membership_inference_allowed: false,
    reason: 'The official current IE page defines the designation and directs course-interest questions to the Registrar, but does not publish a complete current course-level designation roster.',
  };
}

function robotsAllowsPath(robotsText, pathname) {
  const lines = String(robotsText ?? '').split(/\r?\n/).map((line) => (
    line.replace(/#.*$/, '').trim()
  ));
  let inWildcard = false;
  const disallowed = [];
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      inWildcard = value === '*';
    } else if (inWildcard && key === 'disallow' && value) {
      disallowed.push(value);
    }
  }
  return !disallowed.some((prefix) => pathname.startsWith(prefix));
}

function buildUvaWiseGeRosterEvidence({
  geText,
  majorText,
  ieHtml,
  robotsText,
  ieResponse = {},
} = {}) {
  const issues = [];
  const sourceInputs = { geText, majorText, ieHtml, robotsText };
  const sourceActual = Object.fromEntries(Object.entries(sourceInputs).map(([key, value]) => [
    key, sha256(String(value ?? '')),
  ]));
  const sourceExpected = {
    geText: SOURCE_SHA256.general_education_text,
    majorText: SOURCE_SHA256.cs_major_text,
    ieHtml: SOURCE_SHA256.inclusive_excellence_html,
    robotsText: SOURCE_SHA256.uvawise_robots_text,
  };
  for (const [key, expected] of Object.entries(sourceExpected)) {
    if (sourceActual[key] !== expected) issues.push(`source_sha256:${key}`);
  }
  const lines = normalizedLines(geText);
  if (exactOccurrences(lines, '2026-2027 UVA Wise Catalog') !== 1
      || exactOccurrences(lines, 'General Education Liberal Arts Core') !== 2) {
    issues.push('general_education:catalog_identity');
  }
  if (!robotsAllowsPath(robotsText, '/about/leadership/advocacy-opportunity/inclusive-excellence')) {
    issues.push('robots:ie_path_disallowed');
  }
  if (ieResponse.requested_url !== IE_URL || ieResponse.final_url !== IE_URL
      || Number(ieResponse.http_status) !== 200
      || !/^text\/html\b/i.test(String(ieResponse.content_type || ''))
      || Number(ieResponse.response_bytes) !== Buffer.byteLength(String(ieHtml ?? ''))
      || ieResponse.response_sha256 !== sourceActual.ieHtml) {
    issues.push('ie:response_receipt');
  }
  const science = parseScientificReasoning(lines, issues);
  contextualPolicyText(geText, issues);
  const contextual = parseContextualAreas(lines, issues);
  const witness = contextualWitness(contextual, issues);
  const labRule = majorLabPrefixRule(majorText, issues);
  const ie = ieEvidence(geText, ieHtml, issues);
  const actualSemantic = {
    scientific_reasoning_routes: science.roster_sha256,
    contextual_occurrences: contextual.roster_sha256,
    contextual_witness: witness.witness_sha256,
  };
  for (const [key, expected] of Object.entries(EXPECTED_SEMANTIC_SHA256)) {
    if (actualSemantic[key] !== expected) issues.push(`semantic_sha256:${key}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    catalog_year: CATALOG_YEAR,
    institution: { slug: SLUG, school_id: 9226 },
    source_receipts: {
      general_education: {
        requested_url: GE_URL,
        response_bytes: Buffer.byteLength(String(geText ?? '')),
        response_sha256: sourceActual.geText,
        retained_path: 'server/.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__ge.txt',
      },
      cs_major: {
        response_bytes: Buffer.byteLength(String(majorText ?? '')),
        response_sha256: sourceActual.majorText,
        retained_path: 'server/.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__program.txt',
      },
      inclusive_excellence: {
        requested_url: ieResponse.requested_url || IE_URL,
        final_url: ieResponse.final_url || null,
        http_status: Number(ieResponse.http_status) || null,
        content_type: ieResponse.content_type || null,
        response_bytes: Buffer.byteLength(String(ieHtml ?? '')),
        response_sha256: sourceActual.ieHtml,
        fetched_at: ieResponse.fetched_at || null,
        retained_path: 'server/.va-catalogs/research/uva-wise-ge-roster-sources/inclusive-excellence.html',
      },
      robots: {
        requested_url: ROBOTS_URL,
        response_bytes: Buffer.byteLength(String(robotsText ?? '')),
        response_sha256: sourceActual.robotsText,
        ie_path_allowed: robotsAllowsPath(
          robotsText,
          '/about/leadership/advocacy-opportunity/inclusive-excellence',
        ),
        retained_path: 'server/.va-catalogs/research/uva-wise-transfer-policy-sources/robots.txt',
      },
    },
    scientific_reasoning: {
      course_occurrence_count: science.entries.length,
      route_count: science.routes.length,
      roster_sha256: science.roster_sha256,
      routes: science.routes,
      positive_eight_credit_witness: [
        science.routes.find((route) => route.codes[0] === 'BIO1010'),
        science.routes.find((route) => route.codes[0] === 'CHM1010'),
      ],
      positive_witness_units: 8,
    },
    major_lab_rule: labRule,
    contextual: {
      occurrence_count: contextual.occurrences.length,
      unique_course_count: contextual.unique_course_count,
      counts_by_area: Object.fromEntries(Object.entries(contextual.areas).map(([area, rows]) => [
        area, rows.length,
      ])),
      roster_sha256: contextual.roster_sha256,
      repeated_across_areas: contextual.repeated_across_areas,
      humanities_fine_arts_prefixes: [...HFA_PREFIXES],
      social_behavioral_science_prefixes: [...SBS_PREFIXES],
      one_course_may_satisfy_more_than_one_area: false,
      areas: contextual.areas,
      fixed_figure_3_4_witness: witness,
    },
    inclusive_excellence: ie,
    capability: {
      contextual_subarea_minimums: {
        figure_3_4_capacity_exact: true,
        figure_6_identity_and_prerequisites_exact: false,
      },
      contextual_disciplinary_breadth: {
        figure_3_4_capacity_exact: true,
        figure_6_identity_and_prerequisites_exact: false,
      },
      no_core_cross_area_double_count: {
        figure_3_4_capacity_exact: true,
        figure_6_identity_and_prerequisites_exact: false,
      },
      inclusive_excellence_designation: {
        figure_3_4_capacity_exact: false,
        figure_6_identity_and_prerequisites_exact: false,
      },
      two_distinct_lab_sciences_from_approved_disciplines: {
        positive_eight_credit_route_proved: true,
        complete_major_roster_proved: false,
        pair_level_sending_qualification_proved: false,
        figure_3_4_capacity_exact: false,
      },
    },
    verified: issues.length === 0,
    issues: [...new Set(issues)].sort(),
  };
}

function uvaWiseGeRosterEvidenceIssue(evidence) {
  if (!evidence || evidence.schema_version !== 1 || evidence.artifact !== ARTIFACT
      || evidence.catalog_year !== CATALOG_YEAR
      || evidence.institution?.slug !== SLUG || evidence.institution?.school_id !== 9226
      || evidence.verified !== true || !Array.isArray(evidence.issues)
      || evidence.issues.length !== 0) {
    return 'the UVA Wise GE roster evidence identity or verification status changed';
  }
  for (const [key, expected] of Object.entries(SOURCE_SHA256)) {
    const source = key === 'general_education_text' ? evidence.source_receipts?.general_education
      : key === 'cs_major_text' ? evidence.source_receipts?.cs_major
        : key === 'inclusive_excellence_html' ? evidence.source_receipts?.inclusive_excellence
          : evidence.source_receipts?.robots;
    if (source?.response_sha256 !== expected) {
      return `the UVA Wise GE evidence ${key} source receipt changed`;
    }
  }
  if (evidence.scientific_reasoning?.course_occurrence_count !== 21
      || evidence.scientific_reasoning?.route_count !== 12
      || evidence.scientific_reasoning?.roster_sha256
        !== EXPECTED_SEMANTIC_SHA256.scientific_reasoning_routes
      || semanticSha256(evidence.scientific_reasoning?.routes)
        !== EXPECTED_SEMANTIC_SHA256.scientific_reasoning_routes
      || evidence.contextual?.occurrence_count !== 145
      || evidence.contextual?.unique_course_count !== 143
      || evidence.contextual?.roster_sha256
        !== EXPECTED_SEMANTIC_SHA256.contextual_occurrences
      || semanticSha256(Object.values(evidence.contextual?.areas || {}).flat())
        !== EXPECTED_SEMANTIC_SHA256.contextual_occurrences
      || evidence.contextual?.fixed_figure_3_4_witness?.witness_sha256
        !== EXPECTED_SEMANTIC_SHA256.contextual_witness
      || semanticSha256(evidence.contextual?.fixed_figure_3_4_witness?.courses)
        !== EXPECTED_SEMANTIC_SHA256.contextual_witness
      || JSON.stringify(evidence.contextual?.counts_by_area)
        !== JSON.stringify(EXPECTED_AREA_COUNTS)
      || JSON.stringify(evidence.contextual?.humanities_fine_arts_prefixes)
        !== JSON.stringify(HFA_PREFIXES)
      || JSON.stringify(evidence.contextual?.social_behavioral_science_prefixes)
        !== JSON.stringify(SBS_PREFIXES)
      || evidence.contextual?.one_course_may_satisfy_more_than_one_area !== false) {
    return 'the exact UVA Wise GE roster counts or semantic hashes changed';
  }
  if (evidence.inclusive_excellence?.course_level_roster_completeness_proved !== false
      || evidence.inclusive_excellence?.negative_membership_inference_allowed !== false
      || evidence.major_lab_rule?.complete_major_course_roster_proved !== false
      || evidence.capability?.inclusive_excellence_designation?.figure_3_4_capacity_exact !== false
      || evidence.capability?.two_distinct_lab_sciences_from_approved_disciplines
        ?.figure_3_4_capacity_exact !== false) {
    return 'an unresolved UVA Wise IE or major-lab gap was promoted without complete evidence';
  }
  return null;
}

function uvaWiseContextualFigure34CapacityProof(evidence) {
  const issue = uvaWiseGeRosterEvidenceIssue(evidence);
  if (issue) return { ready: false, reason: issue };
  const witness = evidence.contextual.fixed_figure_3_4_witness;
  if (witness.remaining_contextual_capacity_units !== 18
      || witness.liberal_arts_core_units !== 21
      || witness.major_overlap_self_units !== 3
      || witness.distinct_course_count !== 7
      || witness.one_course_per_area_observed !== true
      || witness.all_courses_below_3000 !== true
      || JSON.stringify(witness.subareas_satisfied)
        !== JSON.stringify(['Self', 'Community', 'Nation', 'World'])
      || JSON.stringify(witness.disciplinary_attributes_satisfied)
        !== JSON.stringify(['humanities_fine_arts', 'social_behavioral_science'])) {
    return { ready: false, reason: 'the exact UVA Wise contextual capacity witness changed' };
  }
  return {
    ready: true,
    figure_3_4_capacity_exact: true,
    remaining_contextual_capacity_units: 18,
    liberal_arts_core_units: 21,
    major_overlap_self_units: 3,
    selected_course_codes: witness.courses.map((row) => row.code),
    selected_course_areas: witness.courses.map((row) => row.area),
    witness_sha256: witness.witness_sha256,
    roster_sha256: evidence.contextual.roster_sha256,
    all_courses_below_3000: true,
    figure_6_identity_and_prerequisites_exact: false,
  };
}

module.exports = {
  ARTIFACT,
  CONTEXTUAL_WITNESS,
  EXPECTED_AREA_COUNTS,
  EXPECTED_SEMANTIC_SHA256,
  GE_URL,
  IE_URL,
  MAJOR_LAB_PREFIXES,
  ROBOTS_URL,
  SOURCE_SHA256,
  buildUvaWiseGeRosterEvidence,
  semanticSha256,
  uvaWiseContextualFigure34CapacityProof,
  uvaWiseGeRosterEvidenceIssue,
};
