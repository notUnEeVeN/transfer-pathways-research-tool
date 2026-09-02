#!/usr/bin/env node
/**
 * Rebuild/check Virginia Tech's exact transferable-associate policy receipt.
 * Official HTTPS sources only; this command never opens the database.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  POLICY_URL,
  ROBOTS_URL,
  USER_AGENT,
  buildVirginiaTechTransferPolicyEvidence,
} = require('../../services/analysis/virginiaTechTransferPolicyEvidence');

const SERVER = path.resolve(__dirname, '../..');
const PAGE = path.join(
  SERVER, '.va-catalogs', 'research', 'virginia-tech-transfer-policy-sources',
  'vccs-transfer-policy.html',
);
const ROBOTS = path.join(
  SERVER, '.va-catalogs', 'research', 'virginia-tech-transfer-policy-sources',
  'robots.txt',
);
const OUTPUT = path.join(
  SERVER, '.va-catalogs', 'research',
  'virginia-tech-transferable-associate-policy-evidence.json',
);

async function fetchText(url, accept) {
  const response = await fetch(url, {
    headers: { accept, 'user-agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return {
    body: await response.text(),
    finalUrl: response.url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
  };
}

async function buildFromOfficialPolicy() {
  const [policy, robots] = await Promise.all([
    fetchText(POLICY_URL, 'text/html'),
    fetchText(ROBOTS_URL, 'text/plain'),
  ]);
  const evidence = buildVirginiaTechTransferPolicyEvidence(policy.body, {
    requestedUrl: POLICY_URL,
    finalUrl: policy.finalUrl,
    contentType: policy.contentType,
    robotsText: robots.body,
    robotsStatus: robots.status,
    robotsRequestedUrl: ROBOTS_URL,
    robotsFinalUrl: robots.finalUrl,
    robotsContentType: robots.contentType,
    capturedAt: null,
  });
  return { evidence, policy: policy.body, robots: robots.body };
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const built = await buildFromOfficialPolicy();
  const rendered = `${JSON.stringify(built.evidence, null, 2)}\n`;

  if (write) {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.mkdirSync(path.dirname(PAGE), { recursive: true });
    fs.writeFileSync(PAGE, built.policy);
    fs.writeFileSync(ROBOTS, built.robots);
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    for (const file of [PAGE, ROBOTS, OUTPUT]) {
      if (!fs.existsSync(file)) throw new Error(`missing checked-in VT evidence: ${file}`);
    }
    if (fs.readFileSync(PAGE, 'utf8') !== built.policy
        || fs.readFileSync(ROBOTS, 'utf8') !== built.robots
        || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('Virginia Tech transfer-policy evidence drifted; inspect and rerun with --write');
    }
  }

  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Virginia Tech transferable-associate policy evidence: PASS');
    console.log(`  policy facts SHA-256: ${built.evidence.policy_facts_sha256}`);
    console.log(`  response SHA-256: ${built.evidence.source.response_sha256}`);
    console.log(`  robots SHA-256: ${built.evidence.robots.response_sha256}`);
    console.log(write ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
  }
  return built.evidence;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  OUTPUT,
  PAGE,
  ROBOTS,
  buildFromOfficialPolicy,
  main,
};
