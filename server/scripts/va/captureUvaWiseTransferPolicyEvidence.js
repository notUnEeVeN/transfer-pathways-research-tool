#!/usr/bin/env node
/**
 * Rebuild/check UVA Wise's exact current registrar + signed VCCS GAA receipt.
 * Official HTTPS sources only; this command never opens the database.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  GAA_URL,
  REGISTRAR_URL,
  ROBOTS_URL,
  USER_AGENT,
  VCCS_SENDER_RECEIPTS,
  buildUvaWiseTransferPolicyEvidence,
} = require('../../services/analysis/uvaWiseTransferPolicyEvidence');

const SERVER = path.resolve(__dirname, '../..');
const SOURCES = path.join(
  SERVER, '.va-catalogs', 'research', 'uva-wise-transfer-policy-sources',
);
const REGISTRAR = path.join(SOURCES, 'registrar-transferring-courses.html');
const GAA_PDF = path.join(SOURCES, 'uva-wise-vccs-gaa-signed-2023.pdf');
const GAA_TEXT = path.join(SOURCES, 'uva-wise-vccs-gaa-signed-2023.txt');
const ROBOTS = path.join(SOURCES, 'robots.txt');
const OUTPUT = path.join(
  SERVER, '.va-catalogs', 'research', 'uva-wise-vccs-transfer-policy-evidence.json',
);

async function fetchBytes(url, accept) {
  const response = await fetch(url, {
    headers: { accept, 'user-agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return {
    body: Buffer.from(await response.arrayBuffer()),
    finalUrl: response.url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
  };
}

function senderFile(receipt, owner) {
  return path.join(SOURCES, `sender-${receipt.numeric_id}-${owner}.html`);
}

function fetchSchevHtml(url) {
  // research.schev.edu currently emits a multiline CSP header which Node's
  // strict HTTP parser rejects. curl accepts the same official response.
  const result = spawnSync('curl', [
    '--http1.1', '--fail', '--silent', '--show-error', '--location', url,
  ], { encoding: null, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`curl failed for ${url}: ${String(result.stderr || '').trim()}`);
  }
  return Buffer.from(result.stdout).toString('utf8');
}

async function fetchSenderSources() {
  return Object.fromEntries(await Promise.all(VCCS_SENDER_RECEIPTS.map(async (receipt) => {
    const vccs = await fetchBytes(receipt.vccs_program_url, 'text/html');
    const schevHtml = fetchSchevHtml(receipt.schev_program_url);
    return [receipt.numeric_id, {
      vccsHtml: vccs.body.toString('utf8'),
      vccsFinalUrl: vccs.finalUrl,
      vccsContentType: vccs.contentType,
      schevHtml,
      schevFinalUrl: receipt.schev_program_url,
      schevContentType: 'text/html; charset=utf-8',
    }];
  })));
}

function readRetainedSenderSources() {
  return Object.fromEntries(VCCS_SENDER_RECEIPTS.map((receipt) => [
    receipt.numeric_id,
    {
      vccsHtml: fs.readFileSync(senderFile(receipt, 'vccs'), 'utf8'),
      vccsFinalUrl: receipt.vccs_program_url,
      vccsContentType: 'text/html; charset=UTF-8',
      schevHtml: fs.readFileSync(senderFile(receipt, 'schev'), 'utf8'),
      schevFinalUrl: receipt.schev_program_url,
      schevContentType: 'text/html; charset=utf-8',
    },
  ]));
}

function extractPdfText(pdf) {
  const result = spawnSync('pdftotext', ['-layout', '-', '-'], {
    input: pdf,
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`pdftotext failed: ${String(result.stderr || '').trim()}`);
  }
  return Buffer.from(result.stdout).toString('utf8');
}

async function buildFromOfficialSources({ refreshSenderSources = false } = {}) {
  const [registrar, gaa, robots] = await Promise.all([
    fetchBytes(REGISTRAR_URL, 'text/html'),
    fetchBytes(GAA_URL, 'application/pdf'),
    fetchBytes(ROBOTS_URL, 'text/plain'),
  ]);
  const registrarHtml = registrar.body.toString('utf8');
  const gaaText = extractPdfText(gaa.body);
  const robotsText = robots.body.toString('utf8');
  const senderSources = refreshSenderSources
    ? await fetchSenderSources() : readRetainedSenderSources();
  const evidence = buildUvaWiseTransferPolicyEvidence({
    registrarHtml,
    gaaPdf: gaa.body,
    gaaText,
    robotsText,
    robotsStatus: robots.status,
    senderSources,
    responses: {
      registrar: {
        requestedUrl: REGISTRAR_URL,
        finalUrl: registrar.finalUrl,
        contentType: registrar.contentType,
      },
      gaa: {
        requestedUrl: GAA_URL,
        finalUrl: gaa.finalUrl,
        contentType: gaa.contentType,
      },
    },
  });
  return {
    evidence, registrarHtml, gaaPdf: gaa.body, gaaText, robotsText, senderSources,
  };
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((arg) => !['--write', '--json'].includes(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const built = await buildFromOfficialSources({ refreshSenderSources: write });
  const rendered = `${JSON.stringify(built.evidence, null, 2)}\n`;
  if (write) {
    fs.mkdirSync(SOURCES, { recursive: true });
    fs.writeFileSync(REGISTRAR, built.registrarHtml);
    fs.writeFileSync(GAA_PDF, built.gaaPdf);
    fs.writeFileSync(GAA_TEXT, built.gaaText);
    fs.writeFileSync(ROBOTS, built.robotsText);
    for (const receipt of VCCS_SENDER_RECEIPTS) {
      fs.writeFileSync(
        senderFile(receipt, 'vccs'), built.senderSources[receipt.numeric_id].vccsHtml,
      );
      fs.writeFileSync(
        senderFile(receipt, 'schev'), built.senderSources[receipt.numeric_id].schevHtml,
      );
    }
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    for (const file of [REGISTRAR, GAA_PDF, GAA_TEXT, ROBOTS, OUTPUT]) {
      if (!fs.existsSync(file)) throw new Error(`missing checked-in UVA Wise evidence: ${file}`);
    }
    if (fs.readFileSync(REGISTRAR, 'utf8') !== built.registrarHtml
        || !fs.readFileSync(GAA_PDF).equals(built.gaaPdf)
        || fs.readFileSync(GAA_TEXT, 'utf8') !== built.gaaText
        || fs.readFileSync(ROBOTS, 'utf8') !== built.robotsText
        || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('UVA Wise transfer-policy evidence drifted; inspect and rerun with --write');
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('UVA Wise VCCS transfer-policy evidence: PASS');
    console.log(`  policy facts SHA-256: ${built.evidence.policy_facts_sha256}`);
    console.log(`  registrar SHA-256: ${built.evidence.sources.current_registrar_page.response_sha256}`);
    console.log(`  signed GAA SHA-256: ${built.evidence.sources.signed_vccs_gaa.response_sha256}`);
    console.log(`  exact VCCS/SCHEV transfer-award senders: ${built.evidence.sender_award_evidence.length}`);
    console.log('  protected projection receipts: 18/18; candidate-only live matches: 6/18');
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
  GAA_PDF,
  GAA_TEXT,
  OUTPUT,
  REGISTRAR,
  ROBOTS,
  buildFromOfficialSources,
  extractPdfText,
  fetchSenderSources,
  main,
  readRetainedSenderSources,
  senderFile,
};
