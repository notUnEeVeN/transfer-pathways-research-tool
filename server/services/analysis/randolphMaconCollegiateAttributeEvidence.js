/**
 * Exact supplemental evidence for Randolph-Macon's 2026-2027 published
 * Collegiate Requirement lists.
 *
 * The catalog itself says these public lists omit temporary designations,
 * special-topics courses, and recent approvals. Accordingly, this module
 * parses every published row and permits positive-membership proofs only. It
 * must never be used to infer that an absent course is ineligible or that the
 * published lists are an exhaustive transfer-optimizing universe.
 */
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const {
  ROBOTS_BYTES,
  ROBOTS_SHA256,
  ROBOTS_URL,
  SOURCES,
  normalizeHtmlText,
  robotsAllows,
} = require('../../scripts/va/captureRandolphMaconCollegiateAttributeSources');

const ARTIFACT = 'randolph_macon_2026_2027_collegiate_attribute_evidence';
const CATALOG_YEAR = '2026-2027';
const INCOMPLETENESS_SENTENCE =
  'This list does not include temporary designations, special topics courses, or recent approvals. For the most current information please see MyMaconWeb.';

const PAGE_IDENTITIES = Object.freeze({
  overview: Object.freeze({
    title: 'Courses Approved for Collegiate Requirements | Randolph-Macon College Academic Catalog',
    heading: 'Courses Approved for Collegiate Requirements',
  }),
  effective_communication: Object.freeze({
    title: 'Effective Communication | Randolph-Macon College Academic Catalog',
    heading: 'Effective Communication',
  }),
  pillars: Object.freeze({
    title: 'Pillars of the Liberal Arts | Randolph-Macon College Academic Catalog',
    heading: 'Pillars of the Liberal Arts',
  }),
  cross_area: Object.freeze({
    title: 'Cross-Area Requirements | Randolph-Macon College Academic Catalog',
    heading: 'Cross-Area Requirements',
  }),
  collegiate_requirements: Object.freeze({
    title: 'The Collegiate Requirements | Randolph-Macon College Academic Catalog',
    heading: 'The Collegiate Requirements',
  }),
});

const ROSTER_SPECS = Object.freeze({
  foreign_language: Object.freeze({
    source_id: 'effective_communication',
    container_id: 'foreignlanguagecommunicationtextcontainer',
    heading: 'Foreign Language Communication (FL)',
    table_count: 1,
    occurrence_count: 30,
  }),
  AE: Object.freeze({
    source_id: 'pillars', container_id: 'aetextcontainer',
    heading: 'Aesthetic Expression (AE)', table_count: 1, occurrence_count: 93,
    distribution_counts: Object.freeze({ HU: 93, SS: 0, NS: 0 }),
  }),
  CL: Object.freeze({
    source_id: 'pillars', container_id: 'cltextcontainer',
    heading: 'Civic Life (CL)', table_count: 1, occurrence_count: 64,
    distribution_counts: Object.freeze({ HU: 35, SS: 26, NS: 3 }),
  }),
  GE: Object.freeze({
    source_id: 'pillars', container_id: 'getextcontainer',
    heading: 'Global Experiences (GE)', table_count: 1, occurrence_count: 54,
    distribution_counts: Object.freeze({ HU: 42, SS: 12, NS: 0 }),
  }),
  HC: Object.freeze({
    source_id: 'pillars', container_id: 'hctextcontainer',
    heading: 'The Human Condition (HC)', table_count: 1, occurrence_count: 82,
    distribution_counts: Object.freeze({ HU: 61, SS: 19, NS: 2 }),
  }),
  QS: Object.freeze({
    source_id: 'pillars', container_id: 'qstextcontainer',
    heading: 'Quantitative and Symbolic Reasoning (QS)', table_count: 1,
    occurrence_count: 21,
    distribution_counts: Object.freeze({ HU: 1, SS: 1, NS: 19 }),
  }),
  SP: Object.freeze({
    source_id: 'pillars', container_id: 'sptextcontainer',
    heading: 'The Scientific Process (SP)', table_count: 1, occurrence_count: 31,
    distribution_counts: Object.freeze({ HU: 0, SS: 0, NS: 31 }),
  }),
  WA: Object.freeze({
    source_id: 'pillars', container_id: 'watextcontainer',
    heading: 'Writing Attentive (WA)', table_count: 1, occurrence_count: 77,
  }),
  EL: Object.freeze({
    source_id: 'cross_area', container_id: 'eltextcontainer',
    heading: 'Experiential Learning (EL)', table_count: 5, occurrence_count: 247,
    unique_count: 246,
    subcategories: Object.freeze([
      'Travel and Study Abroad', 'Research Experience',
      'Field Study and Student Teaching', 'Service Learning', 'Internship',
    ]),
  }),
  NW: Object.freeze({
    source_id: 'cross_area', container_id: 'nwtextcontainer',
    heading: 'Non-Western Culture (NW)', table_count: 1, occurrence_count: 78,
  }),
  DI: Object.freeze({
    source_id: 'cross_area', container_id: 'ditextcontainer',
    heading: 'Diversity and Inclusion (DI)', table_count: 1, occurrence_count: 55,
  }),
  CS: Object.freeze({
    source_id: 'cross_area', container_id: 'cstextcontainer',
    heading: 'Capstone Experience (CS)', table_count: 1, occurrence_count: 97,
  }),
});

const RULE_EXCERPTS = Object.freeze([
  'All students must successfully complete two approved consecutive courses in a foreign language, or complete a foreign language through the intermediate level.',
  'The intermediate level is normally defined as completion of the 211 – 212 sequence or through a single accelerated course, 215.',
  'A student whose native language is not English may satisfy the collegiate requirement by receiving proficiency in a foreign language in consultation with the Registrar’s Office.',
  'All students must successfully complete one approved course from each of six areas.',
  'Therefore, all students must successfully complete at least one course that is designated as writing attentive (WA).',
  'To ensure a breadth of knowledge, a single course cannot be used to satisfy more than one Pillar requirement, nor may a student use more than one course on a major to satisfy the Pillar requirements.',
  'From among the courses used to satisfy the Pillar requirements, all students must successfully complete at least one course designated as arts/humanities (HU), at least one designated as social/behavioral science (SS), and at least one designated as natural science/mathematics (NS).',
  'These courses may be a part of a student’s major or may be an approved curricular project.',
  'A single course cannot be used to satisfy more than two cross-area requirements.',
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalizeText = (value) => String(value || '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeCode = (value) => String(value || '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');
const exactArray = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function semanticSha256(value) {
  return sha256(JSON.stringify(stable(value)));
}

function occurrences(text, excerpt) {
  return String(text || '').split(excerpt).length - 1;
}

function catalogIdentityIssues($, sourceId) {
  const expected = PAGE_IDENTITIES[sourceId];
  const title = normalizeText($('title').text());
  const headings = $('h1').map((index, element) => normalizeText($(element).text())).get();
  const edition = normalizeText($('#local-header .eyebrow').text());
  return [
    ...(title === expected.title ? [] : [`${sourceId}:title`]),
    ...(exactArray(headings, [expected.heading]) ? [] : [`${sourceId}:heading`]),
    ...(edition === `${CATALOG_YEAR} Academic Catalog` ? [] : [`${sourceId}:edition`]),
  ];
}

function parseCourseRow($, element, { roster, subcategory = null } = {}) {
  const row = $(element);
  const cells = row.children('td');
  const anchors = row.find('td.codecol > a.code');
  const visibleCode = normalizeCode(anchors.text());
  const titleCode = normalizeCode(anchors.attr('title'));
  const hrefCode = normalizeCode(decodeURIComponent(
    String(anchors.attr('href') || '').replace(/^\/search\/\?P=/, ''),
  ));
  const rawTitle = normalizeText(cells.eq(1).text());
  const distributionMatches = [...rawTitle.matchAll(/\((HU|SS|NS)\)/g)]
    .map((match) => match[1]);
  const title = rawTitle.replace(/\s+\((?:HU|SS|NS)\)$/, '').trim();
  const unitsText = normalizeText(row.find('td.hourscol').text());
  const units = /^\d+$/.test(unitsText) ? Number(unitsText) : null;
  const rawRowText = normalizeText(row.text());
  const issues = [];
  if (cells.length !== 3 || anchors.length !== 1 || !visibleCode
      || visibleCode !== titleCode || visibleCode !== hrefCode
      || !title || ![1, 3, 4, 6].includes(units)) issues.push('row_shape');
  if (['AE', 'CL', 'GE', 'HC', 'QS', 'SP'].includes(roster)
      && distributionMatches.length !== 1) issues.push('distribution_attribute');
  if (!['AE', 'CL', 'GE', 'HC', 'QS', 'SP'].includes(roster)
      && distributionMatches.length) issues.push('unexpected_distribution_attribute');
  return {
    issues,
    entry: {
      code: visibleCode,
      title,
      units,
      ...(distributionMatches.length === 1
        ? { distribution_attribute: distributionMatches[0] } : {}),
      ...(subcategory ? { subcategory } : {}),
      raw_row_text: rawRowText,
      raw_row_sha256: sha256(rawRowText),
    },
  };
}

function parseRoster(html, roster, spec) {
  const $ = cheerio.load(String(html || ''));
  const issues = [];
  const container = $(`#${spec.container_id}`);
  const headings = container.children('h2')
    .map((index, element) => normalizeText($(element).text())).get();
  const tables = container.children('table.sc_courselist');
  if (container.length !== 1 || !exactArray(headings, [spec.heading])
      || tables.length !== spec.table_count) issues.push(`${roster}:container_shape`);
  const subcategories = tables.map((index, element) => (
    normalizeText($(element).prevAll('h5').first().text()) || null
  )).get();
  if (spec.subcategories && !exactArray(subcategories, spec.subcategories)) {
    issues.push(`${roster}:subcategories`);
  }
  const entries = [];
  tables.each((tableIndex, table) => {
    const headers = $(table).find('thead tr').map((index, row) => (
      normalizeText($(row).text())
    )).get();
    if (!exactArray(headers, ['Code Title Hours'])) issues.push(`${roster}:header`);
    $(table).find('tbody > tr').each((rowIndex, row) => {
      const parsed = parseCourseRow($, row, {
        roster,
        subcategory: spec.subcategories ? subcategories[tableIndex] : null,
      });
      issues.push(...parsed.issues.map((issue) => (
        `${roster}:table_${tableIndex}:row_${rowIndex}:${issue}`
      )));
      entries.push(parsed.entry);
    });
  });
  const uniqueCodes = new Set(entries.map((entry) => entry.code));
  if (entries.length !== spec.occurrence_count
      || uniqueCodes.size !== (spec.unique_count ?? spec.occurrence_count)) {
    issues.push(`${roster}:counts`);
  }
  if (roster === 'EL') {
    const duplicates = entries.reduce((counts, entry) => (
      counts.set(entry.code, (counts.get(entry.code) || 0) + 1), counts
    ), new Map());
    if (!exactArray([...duplicates].filter(([, count]) => count > 1), [['CRIM460', 2]])) {
      issues.push('EL:duplicate_occurrence_contract');
    }
  } else if (uniqueCodes.size !== entries.length) issues.push(`${roster}:duplicate_code`);
  if (spec.distribution_counts) {
    const counts = Object.fromEntries(['HU', 'SS', 'NS'].map((attribute) => [
      attribute,
      entries.filter((entry) => entry.distribution_attribute === attribute).length,
    ]));
    if (JSON.stringify(counts) !== JSON.stringify(spec.distribution_counts)) {
      issues.push(`${roster}:distribution_counts`);
    }
  }
  return {
    verified: issues.length === 0,
    issues,
    heading: headings[0] || null,
    occurrence_count: entries.length,
    unique_course_count: uniqueCodes.size,
    roster_sha256: semanticSha256(entries),
    entries,
  };
}

function listedMembership(rosters, code) {
  const normalized = normalizeCode(code);
  return Object.fromEntries(Object.entries(rosters).flatMap(([name, roster]) => {
    const matches = roster.entries.filter((entry) => entry.code === normalized);
    return matches.length ? [[name, matches]] : [];
  }));
}

function positiveWitnessIssues(rosters) {
  const issues = [];
  const pillarSelection = {
    AE: 'ARTH201', CL: 'BUSN230', GE: 'ARTH227',
    HC: 'ASTR235', QS: 'CSCI111', SP: 'ASTR101',
  };
  const rows = Object.entries(pillarSelection).map(([roster, code]) => (
    rosters[roster].entries.find((entry) => entry.code === code)
  ));
  if (rows.some((row) => !row) || new Set(Object.values(pillarSelection)).size !== 6
      || !rows.some((row) => row.distribution_attribute === 'HU')
      || !rows.some((row) => row.distribution_attribute === 'SS')
      || !rows.some((row) => row.distribution_attribute === 'NS')
      || !rosters.WA.entries.some((entry) => entry.code === pillarSelection.AE)) {
    issues.push('published_pillar_positive_witness');
  }
  const publishedPillarCodes = new Set(
    ['AE', 'CL', 'GE', 'HC', 'QS', 'SP']
      .flatMap((roster) => rosters[roster].entries.map((entry) => entry.code)),
  );
  const publishedWaPillarCount = rosters.WA.entries
    .filter((entry) => publishedPillarCodes.has(entry.code)).length;
  if (publishedWaPillarCount !== rosters.WA.entries.length) {
    issues.push('published_wa_rows_outside_pillar_lists');
  }
  const crossAreaSelection = {
    EL: 'CSCI485', NW: 'ARTH210', DI: 'ARTH225', CS: 'CSCI485',
  };
  for (const [roster, code] of Object.entries(crossAreaSelection)) {
    if (!rosters[roster].entries.some((entry) => entry.code === code)) {
      issues.push(`published_cross_area_positive_witness:${roster}`);
    }
  }
  const uses = Object.values(crossAreaSelection).reduce((counts, code) => (
    counts.set(code, (counts.get(code) || 0) + 1), counts
  ), new Map());
  if ([...uses.values()].some((count) => count > 2)) {
    issues.push('published_cross_area_positive_witness:overlap');
  }
  const language = rosters.foreign_language.entries.map((entry) => entry.code);
  for (const code of ['CHIN211', 'CHIN212', 'FREN211', 'FREN212', 'SPAN211', 'SPAN212']) {
    if (!language.includes(code)) issues.push(`published_language_positive_witness:${code}`);
  }
  return {
    issues, pillarSelection, crossAreaSelection, publishedWaPillarCount,
  };
}

function buildRandolphMaconCollegiateAttributeEvidence({
  htmlBySource = {}, normalizedBySource = {}, captureMetadata = null, robotsText = '',
} = {}) {
  const issues = [];
  const sourceReceipts = [];
  for (const expected of SOURCES) {
    const html = String(htmlBySource[expected.id] || '');
    const normalized = String(normalizedBySource[expected.id] || '');
    const $ = cheerio.load(html);
    issues.push(...catalogIdentityIssues($, expected.id));
    if (sha256(html) !== expected.raw_sha256
        || Buffer.byteLength(html) !== expected.raw_bytes) {
      issues.push(`${expected.id}:raw_bytes`);
    }
    if (sha256(normalized) !== expected.normalized_sha256
        || Buffer.byteLength(normalized) !== expected.normalized_bytes
        || normalized !== normalizeHtmlText(html)) {
      issues.push(`${expected.id}:normalized_bytes`);
    }
    sourceReceipts.push({
      id: expected.id,
      official_url: expected.url,
      raw_sha256: expected.raw_sha256,
      raw_bytes: expected.raw_bytes,
      normalized_sha256: expected.normalized_sha256,
      normalized_bytes: expected.normalized_bytes,
    });
  }
  const metadataRows = Array.isArray(captureMetadata?.sources)
    ? captureMetadata.sources : [];
  if (captureMetadata?.schema_version !== 1
      || metadataRows.length !== SOURCES.length
      || SOURCES.some((expected, index) => (
        metadataRows[index]?.id !== expected.id
          || metadataRows[index]?.requested_url !== expected.url
          || metadataRows[index]?.final_url !== expected.url
          || metadataRows[index]?.status !== 200
          || metadataRows[index]?.raw_sha256 !== expected.raw_sha256
          || metadataRows[index]?.raw_bytes !== expected.raw_bytes
          || metadataRows[index]?.normalized_sha256 !== expected.normalized_sha256
          || metadataRows[index]?.normalized_bytes !== expected.normalized_bytes
      ))) issues.push('capture_metadata');
  if (sha256(robotsText) !== ROBOTS_SHA256
      || Buffer.byteLength(robotsText) !== ROBOTS_BYTES
      || captureMetadata?.robots?.sha256 !== ROBOTS_SHA256
      || captureMetadata?.robots?.bytes !== ROBOTS_BYTES
      || captureMetadata?.robots?.status !== 200
      || captureMetadata?.robots?.url !== ROBOTS_URL
      || captureMetadata?.robots?.final_url !== ROBOTS_URL
      || SOURCES.some((source) => !robotsAllows(robotsText, new URL(source.url).pathname))) {
    issues.push('robots_receipt');
  }

  const overviewText = normalizeText(normalizedBySource.overview);
  if (occurrences(overviewText, INCOMPLETENESS_SENTENCE) !== 1) {
    issues.push('overview:incompleteness_boundary');
  }
  const rulesText = normalizeText(normalizedBySource.collegiate_requirements);
  for (const excerpt of RULE_EXCERPTS) {
    if (occurrences(rulesText, excerpt) !== 1) issues.push(`rules:${excerpt}`);
  }

  const rosters = {};
  for (const [name, spec] of Object.entries(ROSTER_SPECS)) {
    const roster = parseRoster(htmlBySource[spec.source_id], name, spec);
    issues.push(...roster.issues);
    rosters[name] = {
      source_id: spec.source_id,
      heading: roster.heading,
      occurrence_count: roster.occurrence_count,
      unique_course_count: roster.unique_course_count,
      roster_sha256: roster.roster_sha256,
      entries: roster.entries,
    };
  }
  const positive = positiveWitnessIssues(rosters);
  issues.push(...positive.issues);
  const controls = {
    CSCI111: listedMembership(rosters, 'CSCI111'),
    CSCI403: listedMembership(rosters, 'CSCI403'),
    CSCI485: listedMembership(rosters, 'CSCI485'),
  };
  if (!controls.CSCI111.QS?.some((entry) => entry.distribution_attribute === 'NS')
      || !controls.CSCI403.EL || !controls.CSCI403.CS
      || !controls.CSCI485.EL || !controls.CSCI485.CS) {
    issues.push('computer_science_positive_controls');
  }
  if (issues.length) {
    throw new Error(`Randolph-Macon Collegiate attribute evidence invalid: ${issues.join(', ')}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-25',
    institution: { slug: 'randolph-macon-college', school_id: 9221 },
    catalog_year: CATALOG_YEAR,
    source_contract: {
      source_receipts: sourceReceipts,
      robots_receipt: {
        official_url: ROBOTS_URL,
        status: 200,
        sha256: ROBOTS_SHA256,
        bytes: ROBOTS_BYTES,
        required_catalog_routes_allowed: true,
      },
    },
    roster_scope: {
      classification: 'exact_published_lower_bound_positive_attributes_only',
      exhaustive_for_current_eligibility: false,
      exact_catalog_limitation: INCOMPLETENESS_SENTENCE,
      omitted_by_official_page: [
        'temporary_designations', 'special_topics_courses', 'recent_approvals',
      ],
      current_authority_named_by_catalog: 'MyMaconWeb',
      negative_membership_inference_allowed: false,
      transfer_optimizing_feasibility_closed: false,
    },
    rules: {
      exact_excerpts: [...RULE_EXCERPTS],
      writing_attentive_requirement_is_course_attribute: true,
      pillar_course_may_satisfy_at_most_one_pillar: true,
      major_courses_satisfying_pillars_maximum: 1,
      pillar_distribution_attributes_required: ['HU', 'SS', 'NS'],
      cross_area_attributes_required: ['EL', 'NW', 'DI', 'CS'],
      cross_area_attributes_per_course_maximum: 2,
      experiential_learning_allows_approved_curricular_project: true,
      registrar_language_proficiency_route_present: true,
    },
    rosters,
    published_positive_witnesses: {
      pillars: {
        selection_by_pillar: positive.pillarSelection,
        distinct_course_count: 6,
        distribution_attributes_present: ['HU', 'SS', 'NS'],
        writing_attentive_course: 'ARTH201',
        published_wa_rows_also_listed_as_pillars: positive.publishedWaPillarCount,
        known_major_pillar_course: 'CSCI111',
      },
      cross_area: {
        selection_by_attribute: positive.crossAreaSelection,
        maximum_attributes_on_one_course: 2,
      },
      foreign_language: {
        explicit_intermediate_sequence_witnesses: [
          ['CHIN211', 'CHIN212'], ['FREN211', 'FREN212'], ['SPAN211', 'SPAN212'],
        ],
        registrar_proficiency_route_resolved_for_degree_application: false,
      },
      computer_science_attribute_controls: controls,
    },
    publication_disposition: {
      safely_resolved_constraint_kinds: [],
      paper_impact_scoped_constraint_kinds: {
        writing_attentive_overlap: ['6'],
      },
      still_blocked_constraint_kinds: [
        'foreign_language_sequence_or_proficiency',
        'distinct_pillar_courses',
        'major_to_pillar_overlap_limit',
        'pillar_distribution_attributes',
        'writing_attentive_overlap',
        'cross_area_overlap_limit',
        'cross_area_course_or_project_forms',
      ],
      official_catalog_wording_conflict_resolved: false,
      transfer_application_discretion_resolved: false,
      reason: 'The exact public lists supply a zero-increment WA/Pillar witness and all 77 published WA rows also appear on a published Pillar list, which removes Figures 1/3/4 impact under the fixed 80-credit capacity. WA identity/prerequisites and every exhaustive membership-dependent optimization remain fail-closed because the official public lists expressly omit current eligible options.',
    },
  };
}

module.exports = {
  ARTIFACT,
  CATALOG_YEAR,
  INCOMPLETENESS_SENTENCE,
  PAGE_IDENTITIES,
  ROSTER_SPECS,
  RULE_EXCERPTS,
  buildRandolphMaconCollegiateAttributeEvidence,
  listedMembership,
  normalizeCode,
  normalizeText,
  parseCourseRow,
  parseRoster,
  semanticSha256,
};
