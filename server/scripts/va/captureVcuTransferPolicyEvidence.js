#!/usr/bin/env node
/**
 * Rebuild/check VCU's exact transfer-degree GE/residency policy receipt.
 * This command uses official HTTPS sources only and never opens the database.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  POLICY_URL,
  ROBOTS_URL,
  USER_AGENT,
  buildVcuTransferPolicyEvidence,
} = require('../../services/analysis/vcuTransferPolicyEvidence');

const SERVER = path.resolve(__dirname, '../..');
const PAGE = path.join(
  SERVER,
  '.va-catalogs',
  'pages',
  'virginia-commonwealth-university__transfer_admission.html',
);
const ROBOTS = path.join(
  SERVER,
  '.va-catalogs',
  'pages',
  'virginia-commonwealth-university__bulletin_robots.txt',
);
const OUTPUT = path.join(
  SERVER,
  '.va-catalogs',
  'research',
  'virginia-commonwealth-university-transfer-policy-evidence.json',
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

async function buildFromOfficialCatalog() {
  const [policy, robots] = await Promise.all([
    fetchText(POLICY_URL, 'text/html'),
    fetchText(ROBOTS_URL, 'text/plain'),
  ]);
  const evidence = buildVcuTransferPolicyEvidence(policy.body, {
    requestedUrl: POLICY_URL,
    finalUrl: policy.finalUrl,
    contentType: policy.contentType,
    robotsText: robots.body,
    robotsStatus: robots.status,
    // Acquisition time is operational metadata. Keep the artifact stable
    // across byte-identical checks and retain the dated snapshot in
    // generated_on instead.
    capturedAt: null,
  });
  return { evidence, policy: policy.body, robots: robots.body };
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const built = await buildFromOfficialCatalog();
  const rendered = `${JSON.stringify(built.evidence, null, 2)}\n`;

  if (write) {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.mkdirSync(path.dirname(PAGE), { recursive: true });
    fs.writeFileSync(PAGE, built.policy);
    fs.writeFileSync(ROBOTS, built.robots);
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    for (const file of [PAGE, ROBOTS, OUTPUT]) {
      if (!fs.existsSync(file)) throw new Error(`missing checked-in VCU evidence: ${file}`);
    }
    if (fs.readFileSync(PAGE, 'utf8') !== built.policy
        || fs.readFileSync(ROBOTS, 'utf8') !== built.robots
        || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('VCU transfer-policy evidence drifted; inspect and rerun with --write');
    }
  }

  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('VCU transfer-pathway policy evidence: PASS');
    console.log(`  policy facts SHA-256: ${built.evidence.policy_facts_sha256}`);
    console.log(`  transfer ceiling: ${built.evidence.policy_facts.transfer_ceiling.maximum_units}`);
    console.log(`  AS lower-division GE waiver: ${built.evidence.paper_interpretation.lower_division_connected_category_distribution_waived}`);
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
  buildFromOfficialCatalog,
  main,
};
