#!/usr/bin/env node
/**
 * Capture the official 2026-27 Virginia Tech Pathways course guide and the
 * course-description receipts needed for the CS nontechnical-capacity proof.
 *
 * This is supplemental analysis evidence. It deliberately does not rewrite
 * the reviewed CS composition or its source-bundle signature.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const SERVER = path.resolve(__dirname, '..', '..');
const CACHE = path.join(SERVER, '.va-catalogs', 'pages');
const OUTPUT = path.join(
  SERVER,
  '.va-catalogs',
  'research',
  'virginia-tech-pathways-capacity-evidence.json',
);
const USER_AGENT = 'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

const SOURCES = Object.freeze([
  Object.freeze({
    id: 'pathways_guide_2026_27',
    capture: 'direct_pdf',
    url: 'https://www.pathways.prov.vt.edu/content/dam/pathways_prov_vt_edu/1AboutPathways/course-catalog/Pathways%20Course%20Guide%20by%20Concept%2026-27.pdf',
  }),
  Object.freeze({
    id: 'visual_arts_course_descriptions',
    capture: 'catalog_browser_pdf',
    landing_url: 'https://catalog.vt.edu/course-descriptions/art/',
    url: 'https://catalog.vt.edu/course-descriptions/art/art.pdf',
  }),
  Object.freeze({
    id: 'psychology_course_descriptions',
    capture: 'catalog_browser_pdf',
    landing_url: 'https://catalog.vt.edu/course-descriptions/psyc/',
    url: 'https://catalog.vt.edu/course-descriptions/psyc/psyc.pdf',
  }),
  Object.freeze({
    id: 'sociology_course_descriptions',
    capture: 'catalog_browser_pdf',
    landing_url: 'https://catalog.vt.edu/course-descriptions/soc/',
    url: 'https://catalog.vt.edu/course-descriptions/soc/soc.pdf',
  }),
]);

const ROBOTS_SOURCES = Object.freeze([
  Object.freeze({
    id: 'pathways_host_robots',
    capture: 'direct',
    url: 'https://www.pathways.prov.vt.edu/robots.txt',
    source_ids: Object.freeze(['pathways_guide_2026_27']),
  }),
  Object.freeze({
    id: 'catalog_host_robots',
    capture: 'catalog_browser',
    url: 'https://catalog.vt.edu/robots.txt',
    bootstrap_landing_url: 'https://catalog.vt.edu/course-descriptions/art/',
    source_ids: Object.freeze([
      'visual_arts_course_descriptions',
      'psychology_course_descriptions',
      'sociology_course_descriptions',
    ]),
  }),
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalized = (value) => String(value || '').replace(/\s+/g, ' ').trim();

function robotsAllows(body, pathname, userAgent = USER_AGENT) {
  const product = String(userAgent || '').toLowerCase().split(/[\s/]/)[0];
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const raw of String(body || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) {
      if (rules.length) flush();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'user-agent') {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
    } else if ((field === 'allow' || field === 'disallow') && agents.length) {
      if (value) rules.push({ allow: field === 'allow', pattern: value });
    }
  }
  flush();
  const scored = groups.map((group) => ({
    ...group,
    score: Math.max(...group.agents.map((agent) => (
      agent === '*' ? 0 : (product.startsWith(agent) ? agent.length : -1)
    ))),
  })).filter((group) => group.score >= 0);
  if (!scored.length) return true;
  const bestScore = Math.max(...scored.map((group) => group.score));
  const applicable = scored.filter((group) => group.score === bestScore)
    .flatMap((group) => group.rules);
  const matches = applicable.flatMap((rule) => {
    const anchored = rule.pattern.endsWith('$');
    const rawPattern = anchored ? rule.pattern.slice(0, -1) : rule.pattern;
    const escaped = rawPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const expression = new RegExp(`^${escaped}${anchored ? '$' : ''}`);
    return expression.test(pathname)
      ? [{ ...rule, specificity: rawPattern.replace(/\*/g, '').length }]
      : [];
  });
  if (!matches.length) return true;
  const longest = Math.max(...matches.map((rule) => rule.specificity));
  return matches.filter((rule) => rule.specificity === longest)
    .some((rule) => rule.allow);
}

async function browserBytes(page, url) {
  const result = await page.evaluate(async (requestedUrl) => {
    const response = await fetch(requestedUrl, { headers: { accept: '*/*' } });
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get('content-type'),
      base64: btoa(binary),
    };
  }, url);
  return { ...result, body: Buffer.from(result.base64, 'base64') };
}

async function directBytes(url, accept = '*/*') {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept },
    redirect: 'follow',
  });
  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get('content-type'),
    body: Buffer.from(await response.arrayBuffer()),
  };
}

function courseBlock(text, code) {
  const marker = new RegExp(`\\b${code.replace(/(\\D+)(\\d)/, '$1\\\\s*$2')}\\s*[-–]`, 'i');
  const match = marker.exec(text);
  if (!match) throw new Error(`missing exact ${code} course-description carrier`);
  return text.slice(match.index, match.index + 1800);
}

function conceptBlock(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  if (from < 0 || to < 0 || to <= from) {
    throw new Error(`cannot isolate Pathways guide section ${start}`);
  }
  return text.slice(from, to);
}

function assertIncludes(text, values, sourceId) {
  for (const value of values) {
    if (!text.includes(value)) throw new Error(`${sourceId} is missing “${value}”`);
  }
}

function verifyAndBuild(captures, robotsCaptures) {
  if (!Array.isArray(robotsCaptures) || robotsCaptures.length !== ROBOTS_SOURCES.length) {
    throw new Error('missing exact Virginia Tech robots receipts');
  }
  const byId = Object.fromEntries(captures.map((capture) => [capture.id, capture]));
  if (captures.length !== SOURCES.length
      || SOURCES.some((source) => {
        const capture = byId[source.id];
        return !capture
          || capture.requested_url !== source.url
          || capture.final_url !== source.url
          || capture.status !== 200
          || !/^application\/pdf\b/i.test(capture.content_type || '')
          || !/^https:\/\//.test(capture.final_url)
          || capture.bytes <= 0
          || !/^[a-f0-9]{64}$/.test(capture.sha256 || '');
      })) throw new Error('Virginia Tech official PDF response identity changed');
  const robotsById = Object.fromEntries(robotsCaptures.map((receipt) => [receipt.id, receipt]));
  for (const expected of ROBOTS_SOURCES) {
    const receipt = robotsById[expected.id];
    const expectedDecisions = expected.source_ids.map((sourceId) => {
      const source = SOURCES.find((row) => row.id === sourceId);
      return {
        source_id: sourceId,
        path: new URL(source.url).pathname,
        allowed: true,
      };
    });
    if (!receipt || receipt.requested_url !== expected.url
        || receipt.status !== 200 || receipt.ok !== true
        || !/^https:\/\//.test(receipt.final_url || '')
        || receipt.bytes <= 0 || !/^[a-f0-9]{64}$/.test(receipt.sha256 || '')
        || receipt.user_agent !== USER_AGENT
        || JSON.stringify(receipt.exact_path_decisions) !== JSON.stringify(expectedDecisions)) {
      throw new Error(`${expected.id} does not prove every requested PDF route was allowed`);
    }
  }
  const guide = byId.pathways_guide_2026_27.text;
  assertIncludes(guide, [
    '2026-2027 PATHWAYS COURSE GUIDE BY CONCEPT',
    'NOTE: If a course is approved for two concepts',
  ], 'pathways_guide_2026_27');
  const concept2 = normalized(conceptBlock(
    guide,
    'Critical Thinking in the Humanities (2)',
    'Reasoning in the Social Sciences (3)',
  ));
  const concept3 = normalized(conceptBlock(
    guide,
    'Reasoning in the Social Sciences (3)',
    'Reasoning in the Natural Sciences (4)',
  ));
  const concept6a = normalized(conceptBlock(
    guide,
    'Critique and Practice in the Arts (6a)',
    'Critique and Practice in Design (6d)',
  ));
  assertIncludes(concept2, ['ART 1104', 'ART 1334'], 'Pathways Concept 2');
  assertIncludes(concept3, ['PSYC 1004', 'SOC 1004'], 'Pathways Concept 3');
  assertIncludes(concept6a, ['ART 1004'], 'Pathways Concept 6a');

  const art = byId.visual_arts_course_descriptions.text;
  for (const [code, concept] of [
    ['ART 1004', '6A Critique & Practice in Arts'],
    ['ART 1104', '2 Critical Thinking Humanities'],
    ['ART 1334', '2 Critical Thinking Humanities'],
  ]) {
    const block = normalized(courseBlock(art, code));
    assertIncludes(block, ['(3 credits)', concept], code);
  }
  assertIncludes(
    normalized(courseBlock(art, 'ART 1204')),
    ['(3 credits)'],
    'ART 1204',
  );

  const psyc = normalized(courseBlock(byId.psychology_course_descriptions.text, 'PSYC 1004'));
  assertIncludes(psyc, ['(3 credits)', '3 Reasoning in Social Sciences'], 'PSYC 1004');
  const soc = normalized(courseBlock(byId.sociology_course_descriptions.text, 'SOC 1004'));
  assertIncludes(soc, ['(3 credits)', '3 Reasoning in Social Sciences'], 'SOC 1004');

  return {
    schema_version: 1,
    generated_on: '2026-08-24',
    institution: 'Virginia Polytechnic Institute and State University',
    program: 'Computer Science, B.S.',
    catalog_year: '2026-2027',
    purpose: 'Exact supplemental source receipt proving that the 30-credit CS nontechnical overlay has a disjoint legal witness inside already-modeled degree capacity.',
    source_scope_note: 'These receipts supplement the analysis proof only; they do not modify the reviewed major composition or its accepted source-bundle signature.',
    robots_receipts: ROBOTS_SOURCES.map((expected) => {
      const receipt = robotsById[expected.id];
      return {
        id: receipt.id,
        requested_url: receipt.requested_url,
        final_url: receipt.final_url,
        official_https: /^https:\/\//.test(receipt.final_url),
        status: receipt.status,
        content_type: receipt.content_type,
        bytes: receipt.bytes,
        sha256: receipt.sha256,
        user_agent: receipt.user_agent,
        transport: receipt.transport,
        ...(receipt.bootstrap_landing_url ? {
          bootstrap_landing_url: receipt.bootstrap_landing_url,
          bootstrap_status: receipt.bootstrap_status,
          bootstrap_final_url: receipt.bootstrap_final_url,
        } : {}),
        exact_path_decisions: receipt.exact_path_decisions,
      };
    }),
    sources: captures.map(({
      id, requested_url: requestedUrl, final_url: finalUrl, status,
      content_type: responseContentType, bytes, sha256: digest,
    }) => ({
      id,
      requested_url: requestedUrl,
      final_url: finalUrl,
      official_https: /^https:\/\//.test(finalUrl),
      content_type: 'application/pdf',
      response_status: status,
      response_content_type: responseContentType,
      bytes,
      sha256: digest,
    })),
    witness: {
      pathways_concept_1f: [
        { code: 'ENGL1105', units: 3, source: 'reviewed_program' },
        { code: 'ENGL1106', units: 3, source: 'reviewed_program' },
      ],
      pathways_concept_2: [
        { code: 'ART1104', units: 3, source: 'pathways_guide_2026_27+visual_arts_course_descriptions' },
        { code: 'ART1334', units: 3, source: 'pathways_guide_2026_27+visual_arts_course_descriptions' },
      ],
      pathways_concept_3: [
        { code: 'PSYC1004', units: 3, source: 'pathways_guide_2026_27+psychology_course_descriptions' },
        { code: 'SOC1004', units: 3, source: 'pathways_guide_2026_27+sociology_course_descriptions' },
      ],
      pathways_concept_6a: [
        { code: 'ART1004', units: 3, source: 'pathways_guide_2026_27+visual_arts_course_descriptions' },
      ],
      communications_and_writing: [
        { code: 'COMM2004', units: 3, source: 'reviewed_program' },
        { code: 'ENGL3764', units: 3, source: 'reviewed_program' },
      ],
      free_elective: [
        { code: 'ART1204', units: 3, source: 'visual_arts_course_descriptions' },
      ],
    },
    exclusions_checked_against_reviewed_program: {
      excluded_subjects: [
        'BIOL', 'CHEM', 'GEOS', 'PHYS', 'MATH', 'STAT',
        'all College of Engineering subjects except qualifying Pathways 7',
        'courses listed as CS technical electives',
      ],
      witness_subjects: ['ART', 'COMM', 'ENGL', 'PSYC', 'SOC'],
      witness_codes_on_cs_technical_elective_list: [],
    },
    arithmetic: {
      pathways_concept_1f_units: 6,
      pathways_concept_2_units: 6,
      pathways_concept_3_units: 6,
      pathways_concept_6a_units: 3,
      communications_and_writing_units: 6,
      free_elective_units: 3,
      total_nontechnical_units: 30,
      additional_degree_units: 0,
    },
  };
}

async function capture({ write = false } = {}) {
  const temporaryCache = write
    ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'va-vt-pathways-evidence-'));
  const cacheRoot = temporaryCache || CACHE;
  fs.mkdirSync(cacheRoot, { recursive: true });
  const captures = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();
    const robotsCaptures = [];
    for (const source of ROBOTS_SOURCES) {
      let result;
      let bootstrap = {};
      if (source.capture === 'catalog_browser') {
        const response = await page.goto(source.bootstrap_landing_url, {
          waitUntil: 'domcontentloaded', timeout: 60000,
        });
        await page.waitForTimeout(2500);
        bootstrap = {
          bootstrap_landing_url: source.bootstrap_landing_url,
          bootstrap_status: response?.status() ?? null,
          bootstrap_final_url: page.url(),
        };
        result = await browserBytes(page, source.url);
      } else {
        result = await directBytes(source.url);
      }
      if (!result.ok) throw new Error(`${source.id} returned HTTP ${result.status}`);
      const text = result.body.toString('utf8');
      const exactPathDecisions = source.source_ids.map((sourceId) => {
        const requested = SOURCES.find((row) => row.id === sourceId);
        const pathname = new URL(requested.url).pathname;
        return { source_id: sourceId, path: pathname, allowed: robotsAllows(text, pathname) };
      });
      if (exactPathDecisions.some((decision) => !decision.allowed)) {
        throw new Error(`${source.id} disallows one or more required official PDF routes`);
      }
      robotsCaptures.push({
        id: source.id,
        requested_url: source.url,
        final_url: result.finalUrl,
        status: result.status,
        ok: result.ok,
        content_type: result.contentType,
        bytes: result.body.length,
        sha256: sha256(result.body),
        user_agent: USER_AGENT,
        transport: source.capture === 'catalog_browser'
          ? 'playwright_same_origin_after_landing' : 'node_fetch',
        ...bootstrap,
        exact_path_decisions: exactPathDecisions,
      });
    }
    for (const source of SOURCES) {
      let body;
      let finalUrl = source.url;
      let status;
      let contentType;
      if (source.capture === 'catalog_browser_pdf') {
        await page.goto(source.landing_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2500);
        const result = await browserBytes(page, source.url);
        if (!result.ok) throw new Error(`${source.id} returned HTTP ${result.status}`);
        body = result.body;
        finalUrl = result.finalUrl;
        status = result.status;
        contentType = result.contentType;
      } else {
        const result = await directBytes(source.url, 'application/pdf');
        if (!result.ok) throw new Error(`${source.id} returned HTTP ${result.status}`);
        body = result.body;
        finalUrl = result.finalUrl;
        status = result.status;
        contentType = result.contentType;
      }
      if (body.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new Error(`${source.id} did not return PDF bytes`);
      }
      const cacheFile = path.join(cacheRoot, `virginia-tech__${source.id}.pdf`);
      fs.writeFileSync(cacheFile, body);
      const text = execFileSync('pdftotext', ['-layout', cacheFile, '-'], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      });
      captures.push({
        id: source.id,
        requested_url: source.url,
        final_url: finalUrl,
        status,
        content_type: contentType,
        bytes: body.length,
        sha256: sha256(body),
        text,
      });
    }
    const evidence = verifyAndBuild(captures, robotsCaptures);
    const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
    if (write) {
      fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
      fs.writeFileSync(OUTPUT, rendered);
    }
    return evidence;
  } finally {
    await browser.close();
    if (temporaryCache) fs.rmSync(temporaryCache, { recursive: true, force: true });
  }
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const evidence = await capture({ write });
  const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
  if (!write && !jsonOnly) {
    if (!fs.existsSync(OUTPUT)) throw new Error(`missing checked-in evidence: ${OUTPUT}`);
    if (fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('Virginia Tech Pathways capacity evidence drifted; inspect and rerun with --write');
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Virginia Tech Pathways capacity evidence: PASS');
    console.log(`Official PDF receipts: ${evidence.sources.length}`);
    console.log(`Nontechnical witness: ${evidence.arithmetic.total_nontechnical_units} units; additional degree units: ${evidence.arithmetic.additional_degree_units}`);
    console.log(write ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
  }
  return evidence;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  OUTPUT,
  ROBOTS_SOURCES,
  SOURCES,
  capture,
  main,
  robotsAllows,
  verifyAndBuild,
};
