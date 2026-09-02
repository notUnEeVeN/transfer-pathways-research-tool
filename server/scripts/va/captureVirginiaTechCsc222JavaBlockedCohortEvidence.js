#!/usr/bin/env node
/**
 * Capture/replay the exact official sources used to audit the 15 still-blocked
 * Virginia Tech CSC 222 -> CS 1114 sender cells. This script never opens MongoDB.
 *
 * Default mode is a network-free replay. `--refresh` respects each published
 * robots policy/crawl delay, then rewrites only this standalone evidence bundle.
 * `--rebuild` regenerates only the JSON artifact from retained source bytes.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  BLOCKED_COHORT,
  GERMANNA_RESOURCES_URL,
  GERMANNA_ROBOTS_URL,
  LAUREL_RIDGE_ARTICLE_URL,
  LAUREL_RIDGE_ROBOTS_URL,
  REYNOLDS_OUTLINE_URL,
  REYNOLDS_ROBOTS_URL,
  VCCS_ROBOTS_URL,
  buildVirginiaTechCsc222JavaBlockedCohortEvidence,
  robotsPolicy,
  sha256,
} = require('../../services/analysis/virginiaTechCsc222JavaBlockedCohortEvidence');

const SERVER = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(
  SERVER,
  '.va-catalogs/research/virginia-tech-csc222-java-blocked-cohort-sources',
);
const OUTPUT = path.join(
  SERVER,
  '.va-catalogs/research/virginia-tech-csc222-java-blocked-cohort-evidence.json',
);
const METADATA_FILE = path.join(SOURCE_DIR, 'capture-metadata.json');
const FILES = Object.freeze({
  vccs_robots: path.join(SOURCE_DIR, 'courses-vccs-robots.txt'),
  ...Object.fromEntries(BLOCKED_COHORT.map((row) => [
    row.source_key,
    path.join(SOURCE_DIR, `${row.file_slug}-csc222-current.html`),
  ])),
  germanna_robots: path.join(SOURCE_DIR, 'germanna-robots.txt'),
  germanna_resources: path.join(SOURCE_DIR, 'germanna-csc222-course-resources.html'),
  laurel_ridge_robots: path.join(SOURCE_DIR, 'laurel-ridge-robots.txt'),
  laurel_ridge_article: path.join(SOURCE_DIR, 'laurel-ridge-2022-csc222-java-article.html'),
  reynolds_robots: path.join(SOURCE_DIR, 'reynolds-robots-response.html'),
  reynolds_outline: path.join(SOURCE_DIR, 'reynolds-csc222-outline.pdf'),
  reynolds_outline_text: path.join(SOURCE_DIR, 'reynolds-csc222-outline.pdftotext.txt'),
});
const URLS = Object.freeze({
  vccs_robots: VCCS_ROBOTS_URL,
  ...Object.fromEntries(BLOCKED_COHORT.map((row) => [row.source_key, row.schedule_url])),
  germanna_robots: GERMANNA_ROBOTS_URL,
  germanna_resources: GERMANNA_RESOURCES_URL,
  laurel_ridge_robots: LAUREL_RIDGE_ROBOTS_URL,
  laurel_ridge_article: LAUREL_RIDGE_ARTICLE_URL,
  reynolds_robots: REYNOLDS_ROBOTS_URL,
  reynolds_outline: REYNOLDS_OUTLINE_URL,
});
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchSource(name, { binary = false } = {}) {
  const url = URLS[name];
  const response = await fetch(url, {
    headers: {
      accept: name.includes('robots')
        ? 'text/plain, text/html;q=0.9, */*;q=0.8'
        : (binary ? 'application/pdf' : 'text/html'),
      'user-agent': USER_AGENT,
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return {
    body: binary
      ? Buffer.from(await response.arrayBuffer())
      : await response.text(),
    requestedUrl: url,
    finalUrl: response.url,
    contentType: response.headers.get('content-type') || '',
    status: response.status,
  };
}

function assertRobots(source, robotsUrl, protectedUrl) {
  const policy = robotsPolicy(source.body, {
    requestedUrl: robotsUrl,
    finalUrl: source.finalUrl,
    contentType: source.contentType,
    status: source.status,
    protectedUrl,
  });
  if (policy.issues.length) {
    throw new Error(`robots policy disallows ${protectedUrl}`);
  }
  return policy;
}

async function liveSources() {
  const sources = {};
  sources.vccs_robots = await fetchSource('vccs_robots');
  const vccsPolicy = assertRobots(
    sources.vccs_robots,
    VCCS_ROBOTS_URL,
    BLOCKED_COHORT[0].schedule_url,
  );
  const vccsDelay = Math.max(1000, vccsPolicy.crawl_delay_seconds * 1000);
  for (let index = 0; index < BLOCKED_COHORT.length; index += 1) {
    const entry = BLOCKED_COHORT[index];
    assertRobots(sources.vccs_robots, VCCS_ROBOTS_URL, entry.schedule_url);
    if (index > 0) await wait(vccsDelay + 100);
    sources[entry.source_key] = await fetchSource(entry.source_key);
  }

  sources.germanna_robots = await fetchSource('germanna_robots');
  const germannaPolicy = assertRobots(
    sources.germanna_robots,
    GERMANNA_ROBOTS_URL,
    GERMANNA_RESOURCES_URL,
  );
  if (germannaPolicy.crawl_delay_seconds > 0) {
    await wait(germannaPolicy.crawl_delay_seconds * 1000 + 100);
  }
  sources.germanna_resources = await fetchSource('germanna_resources');

  sources.laurel_ridge_robots = await fetchSource('laurel_ridge_robots');
  const laurelPolicy = assertRobots(
    sources.laurel_ridge_robots,
    LAUREL_RIDGE_ROBOTS_URL,
    LAUREL_RIDGE_ARTICLE_URL,
  );
  if (laurelPolicy.crawl_delay_seconds > 0) {
    await wait(laurelPolicy.crawl_delay_seconds * 1000 + 100);
  }
  sources.laurel_ridge_article = await fetchSource('laurel_ridge_article');

  sources.reynolds_robots = await fetchSource('reynolds_robots');
  const reynoldsPolicy = assertRobots(
    sources.reynolds_robots,
    REYNOLDS_ROBOTS_URL,
    REYNOLDS_OUTLINE_URL,
  );
  if (reynoldsPolicy.crawl_delay_seconds > 0) {
    await wait(reynoldsPolicy.crawl_delay_seconds * 1000 + 100);
  }
  sources.reynolds_outline = await fetchSource('reynolds_outline', { binary: true });
  const extractedText = execFileSync('pdftotext', ['-', '-'], {
    input: sources.reynolds_outline.body,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  sources.reynolds_outline_text = {
    body: extractedText,
    extractedFromSha256: sha256(sources.reynolds_outline.body),
    derivation: 'pdftotext - -',
  };
  return sources;
}

function captureMetadata(sources) {
  return Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, {
    ...(source.requestedUrl ? { requestedUrl: source.requestedUrl } : {}),
    ...(source.finalUrl ? { finalUrl: source.finalUrl } : {}),
    ...(source.contentType ? { contentType: source.contentType } : {}),
    ...(source.status ? { status: source.status } : {}),
    ...(source.extractedFromSha256
      ? { extractedFromSha256: source.extractedFromSha256 } : {}),
    ...(source.derivation ? { derivation: source.derivation } : {}),
  }]));
}

function retainedSources() {
  if (!fs.existsSync(METADATA_FILE)) {
    throw new Error(`missing retained CSC 222 cohort metadata: ${METADATA_FILE}`);
  }
  const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
  return Object.fromEntries(Object.entries(FILES).map(([name, file]) => {
    if (!fs.existsSync(file)) {
      throw new Error(`missing retained CSC 222 cohort source: ${file}`);
    }
    const binary = name === 'reynolds_outline';
    return [name, {
      body: fs.readFileSync(file, binary ? undefined : 'utf8'),
      ...(metadata[name] || {}),
    }];
  }));
}

/** Refresh one newly exposed college endpoint without recapturing unrelated evidence. */
async function refreshedCollegeSources(communityCollegeId) {
  const entry = BLOCKED_COHORT.find((row) => (
    row.community_college_id === Number(communityCollegeId)
  ));
  if (!entry) throw new Error(`unknown blocked CSC 222 college: ${communityCollegeId}`);
  if (!fs.existsSync(METADATA_FILE)) {
    throw new Error(`missing retained CSC 222 cohort metadata: ${METADATA_FILE}`);
  }
  const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
  const sources = {};
  for (const [name, file] of Object.entries(FILES)) {
    if (name === entry.source_key) continue;
    if (!fs.existsSync(file)) throw new Error(`missing retained CSC 222 cohort source: ${file}`);
    const binary = name === 'reynolds_outline';
    sources[name] = {
      body: fs.readFileSync(file, binary ? undefined : 'utf8'),
      ...(metadata[name] || {}),
    };
  }
  assertRobots(sources.vccs_robots, VCCS_ROBOTS_URL, entry.schedule_url);
  sources[entry.source_key] = await fetchSource(entry.source_key);
  return { entry, sources };
}

function renderArtifact(sources) {
  return `${JSON.stringify(
    buildVirginiaTechCsc222JavaBlockedCohortEvidence(sources),
    null,
    2,
  )}\n`;
}

async function main(argv = process.argv.slice(2)) {
  const refresh = argv.includes('--refresh');
  const rebuild = argv.includes('--rebuild');
  const jsonOnly = argv.includes('--json');
  const refreshCollegeArg = argv.find((arg) => arg.startsWith('--refresh-college='));
  const refreshCollegeId = refreshCollegeArg
    ? Number(refreshCollegeArg.split('=')[1]) : null;
  const unknown = argv.filter((arg) => !['--refresh', '--rebuild', '--json'].includes(arg)
    && arg !== refreshCollegeArg);
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  if ([refresh, rebuild, jsonOnly, refreshCollegeArg != null].filter(Boolean).length > 1) {
    throw new Error('--refresh, --refresh-college, --rebuild, and --json are mutually exclusive');
  }

  const targeted = refreshCollegeArg != null
    ? await refreshedCollegeSources(refreshCollegeId) : null;
  const sources = refresh ? await liveSources() : (targeted?.sources || retainedSources());
  const rendered = renderArtifact(sources);
  if (refresh) {
    fs.mkdirSync(SOURCE_DIR, { recursive: true });
    for (const [name, source] of Object.entries(sources)) {
      fs.writeFileSync(FILES[name], source.body);
    }
    fs.writeFileSync(METADATA_FILE, `${JSON.stringify(captureMetadata(sources), null, 2)}\n`);
    fs.writeFileSync(OUTPUT, rendered);
  } else if (targeted) {
    fs.writeFileSync(FILES[targeted.entry.source_key], sources[targeted.entry.source_key].body);
    fs.writeFileSync(METADATA_FILE, `${JSON.stringify(captureMetadata(sources), null, 2)}\n`);
    fs.writeFileSync(OUTPUT, rendered);
  } else if (rebuild) {
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('retained blocked CSC 222 Java cohort evidence artifact drifted');
    }
  }

  const artifact = JSON.parse(rendered);
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Virginia Tech blocked CSC 222 Java cohort evidence: PASS');
    console.log(`  source-plan cohort: ${artifact.facts.source_plan_reproduction.blocked_cell_count}`);
    console.log(`  newly resolved: ${artifact.paper_interpretation.newly_resolved_cells}`);
    console.log(`  still blocked: ${artifact.paper_interpretation.still_blocked_cells}`);
    console.log(`  facts SHA-256: ${artifact.facts_sha256}`);
    if (refresh) console.log(`  wrote ${OUTPUT}`);
    else if (targeted) console.log(`  refreshed ${targeted.entry.college_name} and wrote ${OUTPUT}`);
    else if (rebuild) console.log(`  rebuilt ${OUTPUT} from retained sources`);
    else console.log('  retained replay: no drift');
  }
  return artifact;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  FILES,
  METADATA_FILE,
  OUTPUT,
  URLS,
  captureMetadata,
  liveSources,
  main,
  renderArtifact,
  refreshedCollegeSources,
  retainedSources,
};
