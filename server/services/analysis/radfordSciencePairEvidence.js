const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const { parseCoursePage } = require('../virginia/courseEquivalency');
const { courseIdFor } = require('../virginia/courseIdentity');

const ARTIFACT = 'radford_2026_2027_vccs_science_pair_evidence';
const CATALOG_YEAR = '2026-2027';
const RADFORD_CATOID = 62;
const VCCS_HOST = 'courses.vccs.edu';
const TRANSFER_VIRGINIA_HOST = 'www.transfervirginia.org';
const RADFORD_HOST = 'catalog.radford.edu';
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

const COURSE_FACTS = Object.freeze({
  CHM111: Object.freeze({
    sending_code: 'CHM111', sending_title: 'General Chemistry I',
    sending_credits: 4, sending_lab_hours: 3,
    transfer_guid: 'D37A4B681F9411F082AC0242AC15010A',
    receiving_code: 'CHEM111', receiving_title: 'General Chemistry I (GE)',
    receiving_credits: 4, receiving_lab_hours: 3, coid: 108293,
    receiving_instruction: 'Three hours lecture; three hours laboratory.',
  }),
  CHM112: Object.freeze({
    sending_code: 'CHM112', sending_title: 'General Chemistry II',
    sending_credits: 4, sending_lab_hours: 3,
    transfer_guid: 'D37A4BA11F9411F082AC0242AC15010A',
    receiving_code: 'CHEM112', receiving_title: 'General Chemistry II (GE)',
    receiving_credits: 4, receiving_lab_hours: 3, coid: 108294,
    receiving_instruction: 'Three hours lecture, three hours laboratory.',
  }),
  PHY201: Object.freeze({
    sending_code: 'PHY201', sending_title: 'General College Physics I',
    sending_credits: 4, sending_lab_hours: 3,
    transfer_guid: 'D3A19A611F9411F082AC0242AC15010A',
    receiving_code: 'PHYS111', receiving_title: 'General Physics I',
    receiving_credits: 4, receiving_lab_hours: 2, coid: 109347,
    receiving_instruction: 'Three hours lecture; two hours laboratory.',
  }),
  PHY202: Object.freeze({
    sending_code: 'PHY202', sending_title: 'General College Physics II',
    sending_credits: 4, sending_lab_hours: 3,
    transfer_guid: 'D3A19B281F9411F082AC0242AC15010A',
    receiving_code: 'PHYS112', receiving_title: 'General Physics II (GE)',
    receiving_credits: 4, receiving_lab_hours: 2, coid: 109348,
    receiving_instruction: 'Three hours lecture; two hours laboratory.',
  }),
});

const SCIENCE_FACTS = Object.freeze(Object.values(COURSE_FACTS).map((fact) => Object.freeze({
  sending_code: fact.sending_code,
  sending_course_id: courseIdFor(fact.sending_code),
  sending_credits: fact.sending_credits,
  sending_lab_hours: fact.sending_lab_hours,
  receiving_code: fact.receiving_code,
  receiving_course_id: courseIdFor(fact.receiving_code),
  receiving_parent_id: courseIdFor(fact.receiving_code),
  receiving_credits: fact.receiving_credits,
  receiving_lab_hours: fact.receiving_lab_hours,
  articulation_institution: 'Radford University',
})));
const SCIENCE_FACTS_SHA256 =
  'c7d659c91910ca6567d26e6b4c58e4402bfc6a799c76eda92d684e07b40062fc';
const EQUIVALENCY_RECEIVING_NAMES = Object.freeze({
  CHM111: 'N/A',
  CHM112: 'N/A',
  PHY201: 'General Physics',
  PHY202: 'General Physics',
});
const EQUIVALENCY_RECEIVING_NOTES = Object.freeze({
  CHM111: null,
  CHM112: null,
  PHY201: null,
  PHY202: null,
});
const EQUIVALENCY_SOURCE_URLS = Object.freeze(Object.fromEntries(
  Object.entries(COURSE_FACTS).map(([code, fact]) => [
    code, `https://${TRANSFER_VIRGINIA_HOST}/course/${fact.transfer_guid}`,
  ]),
));
const SOURCE_RESPONSE_RECEIPTS = Object.freeze({
  CHM111: Object.freeze({
    sending: Object.freeze([18684, '32320c44b09023c54d5ec14b36fb1e94d77dcc784a571a1ab25731fcbcc5fc18']),
    equivalency: Object.freeze([48075, 'f3fea434837bceacad1f9b64135d798a4bd8bac9f7437a671a07e8fc651eca06']),
    receiving: Object.freeze([79301, '72e984bb97d5222628310fdcbeef6be2317409985dee16a8e89ed8c9c7227866']),
  }),
  CHM112: Object.freeze({
    sending: Object.freeze([18834, '7478ace2398a18830e6d8663a3945ea4dbefb4d6ec558298c346e44bde051372']),
    equivalency: Object.freeze([48149, '3940a5c87ab3349bf5ab3b062fb9e7558be2c1d4788788f58124034192c55e5c']),
    receiving: Object.freeze([78712, '38ca21324d8046696665c9a044d12f46b57bcef4eaab6e8327004ef6fc3d534a']),
  }),
  PHY201: Object.freeze({
    sending: Object.freeze([18920, '9c1b598181e2059f23b2a234ab44db7dde00f4d09f256475f9318b596ec70630']),
    equivalency: Object.freeze([48068, '39535a7b42e26e4c6a546c4531be90eda4254171daad7d8a4726fc082f65b6f5']),
    receiving: Object.freeze([79000, '28bc3e56ae14dbb914347ada4f7eed132d04935c4a4f30282c020c2a88e7842d']),
  }),
  PHY202: Object.freeze({
    sending: Object.freeze([19198, 'aac5460784dcf0c089a2c4dd0ca46067d5cdc84ee62041894060d3fde43dd72f']),
    equivalency: Object.freeze([48140, '5702d13a48c3243197115faf2355f053ebe60d67390e3ab6eb9c6d40d76efdff']),
    receiving: Object.freeze([79397, '8abe994e592ce8fda1453582fa3f6ee18bfc7951af2ef15bf3d8d1e78090dfb9']),
  }),
});
const ROBOTS_RESPONSE_RECEIPTS = Object.freeze({
  vccs: Object.freeze([126, '23ff21a5ebd4649c2a062308c0a9689bbc2727abe24ebed666cd78553bfc082d']),
  transfer_virginia: Object.freeze([2189, '278e83bcf567badfebcdea4d5d20ca9898e4449fe4eb2e3b5a08227b4ca9b762']),
  radford: Object.freeze([509, '1dfe956a6b5e20dc3c081043faf71e746170ae4dfefa0f00c2bacc8dc8c8a0c3']),
});

const SOURCE_REPLAY_CONTRACT = 'radford-science-pair-stable-source-replay-v1';
const EXACT_BYTES_NORMALIZATION = 'exact_bytes';
const DRUPAL_THEME_TOKEN_NORMALIZATION = 'transfer_virginia_drupal_theme_token_v1';
const ACALOG_TOOLTIP_ID_NORMALIZATION = 'modern_campus_acalog_tooltip_ids_v1';
const SOURCE_REPLAY_POLICY = Object.freeze({
  contract: SOURCE_REPLAY_CONTRACT,
  retained_raw_receipts: 'exact_response_bytes_and_sha256',
  live_transport_receipts: 'exact_requested_url_final_url_http_status_and_content_type',
  live_content_receipts: 'full_page_sha256_after_strict_cardinality_normalization',
  allowed_volatile_fields: Object.freeze({
    transfer_virginia: Object.freeze({
      field: 'Drupal.settings.ajaxPageState.theme_token',
      grammar: '[A-Za-z0-9_-]{43}',
    }),
    radford: Object.freeze({
      field: 'Modern Campus Acalog course-link id',
      grammar: 'id=(quote)tt[0-9]+(same quote)',
    }),
  }),
  fail_closed_on_every_other_byte: true,
});
const SOURCE_REPLAY_RECEIPTS_SHA256 =
  'c36a7919791030af9dffc1b78e640d93738b0dc4a8664c240bc3e51f54c7b097';

const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const semanticSha256 = (value) => sha256(JSON.stringify(stable(value)));

function normalizedOfficialPage(body, kind) {
  const raw = String(body || '');
  if (kind === 'vccs') {
    return {
      contract: EXACT_BYTES_NORMALIZATION,
      normalized: raw,
      volatile_field_counts: {},
      volatile_field_values_unique: true,
    };
  }
  if (kind === 'transfer_virginia') {
    // Drupal emits one per-request theme token while leaving every other byte
    // stable. The exact grammar and later retained-count comparison make this
    // a single-field normalization rather than a general script scrub.
    const values = [];
    const normalized = raw.replace(
      /("theme_token":")([A-Za-z0-9_-]{43})(")/g,
      (match, prefix, value, suffix) => {
        values.push(value);
        return `${prefix}<PER_REQUEST_DRUPAL_THEME_TOKEN>${suffix}`;
      },
    );
    return {
      contract: DRUPAL_THEME_TOKEN_NORMALIZATION,
      normalized,
      volatile_field_counts: { drupal_theme_token: values.length },
      volatile_field_values_unique: new Set(values).size === values.length,
    };
  }
  if (kind === 'radford') {
    // Modern Campus assigns random numeric ids to course-preview tooltip
    // anchors. Preserve quote style, position, ordering, and all surrounding
    // bytes; replace only the numeric suffix and require unique retained
    // cardinality during replay.
    const values = [];
    const normalized = raw.replace(
      /\bid=(["'])tt([0-9]+)\1/g,
      (match, quote, value) => {
        values.push(value);
        return `id=${quote}tt<PER_REQUEST_TOOLTIP_${values.length}>${quote}`;
      },
    );
    return {
      contract: ACALOG_TOOLTIP_ID_NORMALIZATION,
      normalized,
      volatile_field_counts: { acalog_tooltip_id: values.length },
      volatile_field_values_unique: new Set(values).size === values.length,
    };
  }
  throw new Error(`unsupported Radford source replay kind: ${kind}`);
}

function urlsFor(fact) {
  return {
    vccs: `https://${VCCS_HOST}/courses/${fact.sending_code}`,
    transfer_virginia:
      `https://${TRANSFER_VIRGINIA_HOST}/course/${fact.transfer_guid}`,
    radford:
      `https://${RADFORD_HOST}/preview_course_nopop.php?catoid=${RADFORD_CATOID}&coid=${fact.coid}`,
  };
}

function responseMetadata(body, response = {}, expectedUrl, kind) {
  const replay = normalizedOfficialPage(body, kind);
  return {
    requested_url: response.requestedUrl || expectedUrl,
    final_url: response.finalUrl || expectedUrl,
    http_status: response.status ?? 200,
    content_type: response.contentType || 'text/html; charset=UTF-8',
    response_bytes: Buffer.byteLength(String(body || '')),
    response_sha256: sha256(String(body || '')),
    replay: {
      contract: SOURCE_REPLAY_CONTRACT,
      normalization: replay.contract,
      volatile_field_counts: replay.volatile_field_counts,
      volatile_field_values_unique: replay.volatile_field_values_unique,
      normalized_response_bytes: Buffer.byteLength(replay.normalized),
      normalized_response_sha256: sha256(replay.normalized),
    },
  };
}

function parseVccsCourse(html, fact) {
  const $ = cheerio.load(String(html || ''));
  const headings = $(`dt#${fact.sending_code.replace(/^(\D+)(\d+)$/, '$1-$2')}`)
    .map((index, element) => normalize($(element).text())).get();
  const expectedHeading = `${fact.sending_code.replace(/^(\D+)(\d+)$/, '$1 $2')} - ${fact.sending_title}`;
  const descriptions = $('div.endtext').map((index, element) => normalize($(element).text())).get();
  const credits = $('div.credits').map((index, element) => normalize($(element).text())).get();
  const labPattern = new RegExp(`(?:Recitation and )?Laboratory ${fact.sending_lab_hours} hours\\.`, 'i');
  const issues = [];
  if (headings.length !== 1 || headings[0] !== expectedHeading) issues.push('unique_course_heading');
  if (descriptions.length !== 1 || !labPattern.test(descriptions[0])) issues.push('laboratory_hours');
  if (credits.length !== 1 || credits[0] !== `${fact.sending_credits} credits`) {
    issues.push('published_credits');
  }
  return {
    verified: issues.length === 0,
    issues,
    receipt: {
      course_code: fact.sending_code,
      title: fact.sending_title,
      credits: fact.sending_credits,
      laboratory_hours: fact.sending_lab_hours,
      exact_heading: headings[0] || null,
      exact_contact_hours: descriptions[0] || null,
    },
  };
}

function parseTransferVirginiaCourse(html, fact) {
  const page = parseCoursePage(String(html || ''), {
    url: urlsFor(fact).transfer_virginia,
  });
  const edges = (page.equivalencies || []).filter((edge) => (
    edge.institution === 'Radford University'
      && edge.identifier === fact.receiving_code
      && edge.level === 'four_year'
  ));
  const issues = [];
  if (page.institution !== 'Blue Ridge Community College') issues.push('source_institution');
  if (page.code !== fact.sending_code || page.title !== fact.sending_title) {
    issues.push('sending_course_identity');
  }
  if (Number(page.credits) !== fact.sending_credits) issues.push('sending_course_credits');
  if (edges.length !== 1) issues.push('unique_radford_equivalency');
  return {
    verified: issues.length === 0,
    issues,
    receipt: {
      source_institution: page.institution || null,
      sending_code: page.code || null,
      sending_credits: Number(page.credits) || null,
      receiving_institution: edges[0]?.institution || null,
      receiving_code: edges[0]?.identifier || null,
      receiving_name: edges[0]?.name ?? null,
      receiving_notes: edges[0]?.notes ?? null,
    },
  };
}

function parseRadfordCourse(html, fact) {
  const $ = cheerio.load(String(html || ''));
  const catalog = normalize($('#acalog-catalog-name').text());
  const headings = $('h1#course_preview_title')
    .map((index, element) => normalize($(element).text())).get();
  const expectedHeading = `${fact.receiving_code.replace(/^(\D+)(\d+)$/, '$1 $2')} - ${fact.receiving_title}`;
  const cell = $('h1#course_preview_title').first().closest('td.block_content');
  const text = normalize(cell.text());
  const creditMatches = [...text.matchAll(/Credits:\s*\((\d+(?:\.\d+)?)\)/g)];
  const instructionMatches = [...text.matchAll(/Instructional Method:\s*([^]*?)(?=Prerequisites?:|$)/g)]
    .map((match) => normalize(match[1]));
  const issues = [];
  if (catalog !== '2026-2027 University Academic Catalog') issues.push('catalog_identity');
  if (headings.length !== 1 || headings[0] !== expectedHeading) issues.push('unique_course_heading');
  if (creditMatches.length !== 1
      || Number(creditMatches[0][1]) !== fact.receiving_credits) issues.push('published_credits');
  if (instructionMatches.length !== 1
      || instructionMatches[0] !== fact.receiving_instruction) issues.push('instructional_method');
  return {
    verified: issues.length === 0,
    issues,
    receipt: {
      catoid: RADFORD_CATOID,
      coid: fact.coid,
      course_code: fact.receiving_code,
      title: fact.receiving_title,
      credits: fact.receiving_credits,
      laboratory_hours: fact.receiving_lab_hours,
      exact_heading: headings[0] || null,
      exact_instructional_method: instructionMatches[0] || null,
    },
  };
}

function robotsAllows(url, robotsText) {
  const target = new URL(url);
  const path = `${target.pathname}${target.search}`;
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const rawLine of String(robotsText || '').split(/\r?\n/)) {
    const line = rawLine.replace(/\s*#.*$/, '').trim();
    if (!line) continue;
    const agent = /^User-agent:\s*(.+)$/i.exec(line);
    if (agent) {
      if (rules.length) flush();
      agents.push(agent[1].trim().toLowerCase());
      continue;
    }
    const rule = /^(Allow|Disallow):\s*(.*)$/i.exec(line);
    if (rule && agents.length) {
      rules.push({ allow: rule[1].toLowerCase() === 'allow', pattern: rule[2].trim() });
    }
  }
  flush();
  const wildcardRules = groups
    .filter((group) => group.agents.includes('*'))
    .flatMap((group) => group.rules)
    .filter((rule) => rule.pattern);
  const matches = wildcardRules.filter((rule) => {
    const anchored = rule.pattern.endsWith('$');
    const source = rule.pattern.replace(/\$$/, '').split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path);
  }).sort((a, b) => b.pattern.length - a.pattern.length
    || Number(b.allow) - Number(a.allow));
  return matches.length === 0 || matches[0].allow;
}

function buildRadfordSciencePairEvidence({ pages = {}, responses = {}, robots = {} } = {}) {
  const issues = [];
  const courses = [];
  for (const [code, fact] of Object.entries(COURSE_FACTS)) {
    const urls = urlsFor(fact);
    const sourcePages = pages[code] || {};
    const sourceResponses = responses[code] || {};
    const vccs = parseVccsCourse(sourcePages.vccs, fact);
    const transferVirginia = parseTransferVirginiaCourse(
      sourcePages.transfer_virginia, fact,
    );
    const radford = parseRadfordCourse(sourcePages.radford, fact);
    for (const [kind, parsed] of Object.entries({ vccs, transferVirginia, radford })) {
      issues.push(...parsed.issues.map((issue) => `${code}:${kind}:${issue}`));
    }
    for (const [kind, url] of Object.entries(urls)) {
      const response = sourceResponses[kind] || {};
      if ((response.requestedUrl || url) !== url || (response.finalUrl || url) !== url) {
        issues.push(`${code}:${kind}:source_url`);
      }
      if (!String(response.contentType || 'text/html').toLowerCase().includes('text/html')) {
        issues.push(`${code}:${kind}:content_type`);
      }
      const robotsKey = kind === 'transfer_virginia' ? 'transfer_virginia' : kind;
      if (!robotsAllows(url, robots[robotsKey]?.text)) {
        issues.push(`${code}:${kind}:robots_policy`);
      }
    }
    courses.push({
      sending_code: code,
      sending_course_id: courseIdFor(code),
      receiving_code: fact.receiving_code,
      receiving_course_id: courseIdFor(fact.receiving_code),
      receiving_parent_id: courseIdFor(fact.receiving_code),
      sending: {
        ...vccs.receipt,
        source: responseMetadata(sourcePages.vccs, sourceResponses.vccs, urls.vccs, 'vccs'),
      },
      equivalency: {
        ...transferVirginia.receipt,
        source: responseMetadata(
          sourcePages.transfer_virginia,
          sourceResponses.transfer_virginia,
          urls.transfer_virginia,
          'transfer_virginia',
        ),
      },
      receiving: {
        ...radford.receipt,
        source: responseMetadata(
          sourcePages.radford,
          sourceResponses.radford,
          urls.radford,
          'radford',
        ),
      },
    });
  }
  for (const [key, expected] of Object.entries({
    vccs: { host: VCCS_HOST, delay: 1 },
    transfer_virginia: { host: TRANSFER_VIRGINIA_HOST, delay: 10 },
    radford: { host: RADFORD_HOST, delay: 120 },
  })) {
    const receipt = robots[key] || {};
    if (receipt.status !== 200 || !String(receipt.text || '').trim()) {
      issues.push(`${key}:robots_response`);
    }
    if (receipt.host && receipt.host !== expected.host) issues.push(`${key}:robots_host`);
    if (Number(receipt.crawlDelay) !== expected.delay) issues.push(`${key}:robots_crawl_delay`);
  }
  const facts = courses.map((course) => ({
    sending_code: course.sending_code,
    sending_course_id: course.sending_course_id,
    sending_credits: course.sending.credits,
    sending_lab_hours: course.sending.laboratory_hours,
    receiving_code: course.receiving_code,
    receiving_course_id: course.receiving_course_id,
    receiving_parent_id: course.receiving_parent_id,
    receiving_credits: course.receiving.credits,
    receiving_lab_hours: course.receiving.laboratory_hours,
    articulation_institution: course.equivalency.receiving_institution,
  }));
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-24',
    institution: { name: 'Radford University', slug: 'radford-university', school_id: 9219 },
    catalog_year: CATALOG_YEAR,
    purpose: 'Exact Figure 3/4 pair-level receipts for two distinct 3-4 credit VCCS sciences, at least one laboratory course, and their current Radford course identities. These receipts do not waive the science rule or modify either curriculum tree.',
    source_replay_contract: SOURCE_REPLAY_POLICY,
    verified: issues.length === 0,
    issues,
    courses,
    robots: Object.fromEntries(Object.entries(robots).map(([key, value]) => [key, {
      url: `https://${value.host}/robots.txt`,
      http_status: value.status,
      response_bytes: Buffer.byteLength(String(value.text || '')),
      response_sha256: sha256(String(value.text || '')),
      crawl_delay_seconds: value.crawlDelay,
      policy_paths_allowed: true,
    }])),
    facts,
    facts_sha256: semanticSha256(facts),
  };
}

function radfordSciencePairSemanticIssue(evidence) {
  if (!evidence || evidence.schema_version !== 1 || evidence.artifact !== ARTIFACT
      || evidence.catalog_year !== CATALOG_YEAR || evidence.verified !== true
      || (evidence.issues || []).length !== 0
      || semanticSha256(evidence.source_replay_contract) !== semanticSha256(SOURCE_REPLAY_POLICY)
      || evidence.facts_sha256 !== SCIENCE_FACTS_SHA256
      || semanticSha256(evidence.facts) !== SCIENCE_FACTS_SHA256
      || JSON.stringify(evidence.facts) !== JSON.stringify(SCIENCE_FACTS)) {
    return 'the Radford science-pair semantic evidence changed';
  }
  if (!Array.isArray(evidence.courses) || evidence.courses.length !== SCIENCE_FACTS.length) {
    return 'the Radford science-pair course receipt inventory changed';
  }
  for (const expected of SCIENCE_FACTS) {
    const course = evidence.courses.find((row) => row.sending_code === expected.sending_code);
    if (!course || course.receiving_code !== expected.receiving_code
        || course.sending_course_id !== expected.sending_course_id
        || course.receiving_course_id !== expected.receiving_course_id
        || course.receiving_parent_id !== expected.receiving_parent_id
        || course.sending?.credits !== expected.sending_credits
        || course.sending?.laboratory_hours !== expected.sending_lab_hours
        || course.equivalency?.source_institution !== 'Blue Ridge Community College'
        || course.equivalency?.sending_code !== expected.sending_code
        || course.equivalency?.receiving_institution !== 'Radford University'
        || course.equivalency?.receiving_code !== expected.receiving_code
        || course.equivalency?.receiving_name
          !== EQUIVALENCY_RECEIVING_NAMES[expected.sending_code]
        || course.equivalency?.receiving_notes
          !== EQUIVALENCY_RECEIVING_NOTES[expected.sending_code]
        || course.receiving?.course_code !== expected.receiving_code
        || course.receiving?.credits !== expected.receiving_credits
        || course.receiving?.laboratory_hours !== expected.receiving_lab_hours) {
      return `the exact ${expected.sending_code} to ${expected.receiving_code} receipt changed`;
    }
    const urls = urlsFor(COURSE_FACTS[expected.sending_code]);
    for (const [kind, source] of Object.entries({
      sending: course.sending?.source,
      equivalency: course.equivalency?.source,
      receiving: course.receiving?.source,
    })) {
      const expectedUrl = kind === 'sending' ? urls.vccs
        : kind === 'equivalency' ? urls.transfer_virginia : urls.radford;
      if (!source || source.requested_url !== expectedUrl || source.final_url !== expectedUrl
          || source.http_status !== 200
          || !String(source.content_type || '').toLowerCase().includes('text/html')) {
        return `the ${expected.sending_code} official response metadata changed`;
      }
    }
  }
  return null;
}

function sourceReplayReceiptRows(evidence) {
  return (evidence?.courses || []).map((course) => ({
    sending_code: course.sending_code,
    sending: course.sending?.source?.replay || null,
    equivalency: course.equivalency?.source?.replay || null,
    receiving: course.receiving?.source?.replay || null,
  }));
}

function radfordSciencePairEvidenceIssue(evidence) {
  const semanticIssue = radfordSciencePairSemanticIssue(evidence);
  if (semanticIssue) return semanticIssue;
  for (const expected of SCIENCE_FACTS) {
    const course = evidence.courses.find((row) => row.sending_code === expected.sending_code);
    for (const [kind, source] of Object.entries({
      sending: course.sending?.source,
      equivalency: course.equivalency?.source,
      receiving: course.receiving?.source,
    })) {
      const [bytes, responseHash] = SOURCE_RESPONSE_RECEIPTS[expected.sending_code][kind];
      if (source.response_bytes !== bytes || source.response_sha256 !== responseHash) {
        return `the ${expected.sending_code} official response metadata changed`;
      }
    }
  }
  if (semanticSha256(sourceReplayReceiptRows(evidence))
      !== SOURCE_REPLAY_RECEIPTS_SHA256) {
    return 'the Radford stable full-page replay receipts changed';
  }
  for (const [key, expected] of Object.entries({ vccs: [VCCS_HOST, 1], transfer_virginia: [TRANSFER_VIRGINIA_HOST, 10], radford: [RADFORD_HOST, 120] })) {
    const receipt = evidence.robots?.[key];
    const [bytes, responseHash] = ROBOTS_RESPONSE_RECEIPTS[key];
    if (receipt?.url !== `https://${expected[0]}/robots.txt`
        || receipt?.http_status !== 200 || receipt?.policy_paths_allowed !== true
        || receipt?.crawl_delay_seconds !== expected[1]
        || receipt?.response_bytes !== bytes || receipt?.response_sha256 !== responseHash) {
      return `the ${key} robots receipt changed or no longer permits acquisition`;
    }
  }
  return null;
}

function sourceReplayMetadataIssue(retained, live) {
  for (const expected of SCIENCE_FACTS) {
    const retainedCourse = retained?.courses?.find(
      (row) => row.sending_code === expected.sending_code,
    );
    const liveCourse = live?.courses?.find(
      (row) => row.sending_code === expected.sending_code,
    );
    for (const [kind, retainedSource, liveSource] of [
      ['sending', retainedCourse?.sending?.source, liveCourse?.sending?.source],
      ['equivalency', retainedCourse?.equivalency?.source, liveCourse?.equivalency?.source],
      ['receiving', retainedCourse?.receiving?.source, liveCourse?.receiving?.source],
    ]) {
      const expectedReplay = retainedSource?.replay;
      const actualReplay = liveSource?.replay;
      if (!Number.isInteger(liveSource?.response_bytes) || liveSource.response_bytes <= 0
          || !/^[a-f0-9]{64}$/.test(String(liveSource?.response_sha256 || ''))) {
        return `${expected.sending_code}:${kind} raw response receipt is missing`;
      }
      if (!expectedReplay || expectedReplay.contract !== SOURCE_REPLAY_CONTRACT
          || !actualReplay || actualReplay.contract !== SOURCE_REPLAY_CONTRACT) {
        return `${expected.sending_code}:${kind} stable replay contract is missing`;
      }
      if (actualReplay.volatile_field_values_unique !== true
          || expectedReplay.volatile_field_values_unique !== true
          || actualReplay.normalization !== expectedReplay.normalization
          || semanticSha256(actualReplay.volatile_field_counts)
            !== semanticSha256(expectedReplay.volatile_field_counts)
          || actualReplay.normalized_response_bytes
            !== expectedReplay.normalized_response_bytes
          || actualReplay.normalized_response_sha256
            !== expectedReplay.normalized_response_sha256) {
        return `${expected.sending_code}:${kind} normalized official response changed`;
      }
      if (expectedReplay.normalization === EXACT_BYTES_NORMALIZATION
          && (liveSource.response_bytes !== retainedSource.response_bytes
            || liveSource.response_sha256 !== retainedSource.response_sha256)) {
        return `${expected.sending_code}:${kind} exact official response changed`;
      }
    }
  }
  return null;
}

function radfordSciencePairReplayIssue(retained, live) {
  const retainedIssue = radfordSciencePairEvidenceIssue(retained);
  if (retainedIssue) return `retained evidence invalid: ${retainedIssue}`;
  const liveIssue = radfordSciencePairSemanticIssue(live);
  if (liveIssue) return `live evidence invalid: ${liveIssue}`;
  const replayIssue = sourceReplayMetadataIssue(retained, live);
  if (replayIssue) return replayIssue;
  for (const key of ['vccs', 'transfer_virginia', 'radford']) {
    if (semanticSha256(live?.robots?.[key]) !== semanticSha256(retained?.robots?.[key])) {
      return `the ${key} robots receipt changed or no longer permits acquisition`;
    }
  }
  return null;
}

module.exports = {
  ARTIFACT,
  CATALOG_YEAR,
  COURSE_FACTS,
  EQUIVALENCY_RECEIVING_NAMES,
  EQUIVALENCY_RECEIVING_NOTES,
  EQUIVALENCY_SOURCE_URLS,
  SCIENCE_FACTS,
  SCIENCE_FACTS_SHA256,
  RADFORD_CATOID,
  RADFORD_HOST,
  TRANSFER_VIRGINIA_HOST,
  USER_AGENT,
  VCCS_HOST,
  buildRadfordSciencePairEvidence,
  normalize,
  normalizedOfficialPage,
  parseRadfordCourse,
  parseTransferVirginiaCourse,
  parseVccsCourse,
  radfordSciencePairEvidenceIssue,
  radfordSciencePairReplayIssue,
  radfordSciencePairSemanticIssue,
  robotsAllows,
  sourceReplayMetadataIssue,
  semanticSha256,
  sha256,
  urlsFor,
};
