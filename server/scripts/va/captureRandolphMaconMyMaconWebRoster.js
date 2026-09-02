#!/usr/bin/env node

/**
 * Capture the public, current Curriculum21 roster exposed by Randolph-Macon's
 * MyMaconWeb instance.  This is source capture only: it does not touch MongoDB
 * or any composed degree document.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(
  ROOT,
  '.va-catalogs/research/randolph-macon-mymaconweb-current-roster-sources',
);
const USER_AGENT = 'transfer-pathways-source-audit/1.0 (+read-only academic verification)';
const PORTLET_ID = '9e1fb40b-9fad-4eeb-bcfa-25363794acfa';
const TERM_PORTLET_IDS = Object.freeze({
  fall_2026: 'bc2f7098-34af-4667-b126-cca9da4380b4',
  jterm_2027: 'c3b2707f-3a14-4597-b782-5ad2fe942d61',
  spring_2027: '02ae318f-8725-473a-b4c0-dbd368bce871',
});

const SOURCES = Object.freeze([
  Object.freeze({
    id: 'robots',
    url: 'https://mymaconweb.rmc.edu/robots.txt',
    method: 'GET',
    expected_status: 404,
    extension: 'txt',
  }),
  Object.freeze({
    id: 'academics_collegiate_requirements',
    url: 'https://mymaconweb.rmc.edu/ICS/Academics/Home.jnz?portlet=Curriculum',
    method: 'GET',
    expected_status: 200,
    extension: 'html',
  }),
  Object.freeze({
    id: 'curriculum21_landing',
    url: 'https://mymaconweb.rmc.edu/ICS/Academics/Curriculum21.jnz',
    method: 'GET',
    expected_status: 200,
    extension: 'html',
  }),
  Object.freeze({
    id: 'curriculum21_all_courses_query',
    url: 'https://mymaconweb.rmc.edu/ICS/Academics/Curriculum21.jnz?portlet=Simple_Query',
    method: 'GET',
    expected_status: 200,
    extension: 'html',
  }),
  Object.freeze({
    id: 'curriculum21_all_courses_data',
    url: 'https://mymaconweb.rmc.edu/ICS/Portlets/CUS/ICS/SimpleQuery/Query.ashx',
    method: 'POST',
    body: `portletId=${PORTLET_ID}&action=RunQuery`,
    expected_status: 200,
    extension: 'json',
  }),
  ...Object.entries(TERM_PORTLET_IDS).map(([term, portletId]) => Object.freeze({
    id: `curriculum21_${term}_data`,
    url: 'https://mymaconweb.rmc.edu/ICS/Portlets/CUS/ICS/SimpleQuery/Query.ashx',
    method: 'POST',
    body: `portletId=${portletId}&action=RunQuery`,
    expected_status: 200,
    extension: 'json',
  })),
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function capture(source) {
  const response = await fetch(source.url, {
    method: source.method,
    headers: {
      'user-agent': USER_AGENT,
      ...(source.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(source.body ? { body: source.body } : {}),
    redirect: 'follow',
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (response.status !== source.expected_status) {
    throw new Error(`${source.id}: expected HTTP ${source.expected_status}, received ${response.status}`);
  }
  const receipt = {
    requested_url: source.url,
    final_url: response.url,
    method: source.method,
    request_body_sha256: source.body ? sha256(Buffer.from(source.body)) : null,
    http_status: response.status,
    content_type: response.headers.get('content-type'),
    response_bytes: bytes.length,
    response_sha256: sha256(bytes),
    fetched_at: new Date().toISOString(),
  };
  await fs.writeFile(path.join(OUTPUT_DIR, `${source.id}.${source.extension}`), bytes);
  await fs.writeFile(
    path.join(OUTPUT_DIR, `${source.id}.receipt.json`),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  return { id: source.id, ...receipt };
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const receipts = [];
  for (const source of SOURCES) receipts.push(await capture(source));
  process.stdout.write(`${JSON.stringify({ output_dir: OUTPUT_DIR, receipts }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  OUTPUT_DIR, PORTLET_ID, SOURCES, TERM_PORTLET_IDS, USER_AGENT, capture,
};
