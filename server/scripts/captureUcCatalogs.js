#!/usr/bin/env node
/**
 * Capture UC course catalogue pages so real published prerequisites can be read
 * from them.
 *
 *   node scripts/captureUcCatalogs.js                  # every http/json campus
 *   node scripts/captureUcCatalogs.js --campus 7       # one campus
 *   node scripts/captureUcCatalogs.js --list           # show the work, fetch nothing
 *
 * Departments are derived from the curated degree documents, so the capture
 * covers exactly what our majors reference — computer science, biology and
 * economics together — and widens on its own as majors are added.
 *
 * Pages land in server/.uc-catalogs/pages/<campus>/<PREFIX>.html with an index
 * recording where each came from. Campuses whose catalogues render client-side
 * or sit behind Cloudflare are fetched with headed Chrome (`--browser`), the
 * same transport the Virginia Acalog catalogues needed.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { SOURCES } = require('../services/uc/catalogSources');

const ROOT = path.resolve(__dirname, '../.uc-catalogs');
const PAGES = path.join(ROOT, 'pages');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const PROFILE = path.join(ROOT, '.browser-profile');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// Client-rendered catalogues and Cloudflare both serve an interstitial that
// swaps itself out once the real page is ready.
const INTERSTITIAL = /Performing security verification|Just a moment|Checking your browser|Enable JavaScript and cookies/i;

let browserCtx = null;
async function browser() {
  if (browserCtx) return browserCtx;
  const { chromium } = require('playwright');
  fs.mkdirSync(PROFILE, { recursive: true });
  browserCtx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1400, height: 1000 },
    userAgent: UA,
  });
  return browserCtx;
}

/**
 * Render a catalogue page and return its HTML once the content has settled.
 * A client-rendered catalogue reports `domcontentloaded` long before the course
 * list exists, so wait for the page to stop looking like an interstitial and to
 * carry real text.
 */
async function browserGet(url, { settle = 2500, patience = 45000 } = {}) {
  const ctx = await browser();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const deadline = Date.now() + patience;
    for (;;) {
      await page.waitForTimeout(settle);
      const text = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
      if (!INTERSTITIAL.test(text) && text.trim().length > 400) break;
      if (Date.now() > deadline) break;
    }
    return page.content();
  } finally {
    await page.close().catch(() => {});
  }
}

/** Departments each campus's degree documents actually name. */
async function departmentsByCampus(db) {
  const degrees = await db.collection('curated_requirements')
    .find({ kind: 'degree' }).toArray();
  const wanted = new Map();
  for (const degree of degrees) {
    const schoolId = Number(String(degree._id).split(':')[1]);
    if (!Number.isFinite(schoolId)) continue;
    const parentIds = new Set();
    for (const group of degree.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          for (const pid of [receiver.receiving?.parent_id, ...(receiver.receiving?.parent_ids || [])]) {
            if (pid != null) parentIds.add(Number(pid));
          }
        }
      }
    }
    if (!parentIds.size) continue;
    const courses = await db.collection('assist_courses')
      .find({ side: 'receiving', university_id: schoolId, parent_id: { $in: [...parentIds] } })
      .project({ prefix: 1 }).toArray();
    if (!wanted.has(schoolId)) wanted.set(schoolId, new Set());
    for (const course of courses) if (course.prefix) wanted.get(schoolId).add(course.prefix);
  }
  return wanted;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      // Catalogues serve different markup to obvious robots; identify as a
      // normal browser and accept HTML.
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/**
 * UC Santa Cruz slugs carry the department name as well as its code, so they are
 * read off the catalogue index rather than derived from the prefix.
 */
async function resolveUcscSlugs(indexUrl) {
  const html = await fetchText(indexUrl);
  const found = new Map();
  const re = /href="([^"]*\/courses\/([a-z0-9-]+)\/?)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const code = m[2].split('-')[0].toUpperCase();
    if (!found.has(code)) {
      found.set(code, m[1].startsWith('http') ? m[1] : new URL(m[1], indexUrl).toString());
    }
  }
  return found;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const wanted = await departmentsByCampus(db);
  await client.close();

  const only = arg('campus') ? Number(arg('campus')) : null;
  const index = [];
  let ok = 0;
  let failed = 0;
  let deferred = 0;

  for (const [schoolId, prefixes] of [...wanted.entries()].sort((a, b) => a[0] - b[0])) {
    if (only && schoolId !== only) continue;
    const source = SOURCES[schoolId];
    if (!source) { console.log(`  no catalogue source registered for campus ${schoolId}`); continue; }
    const list = [...prefixes].sort();

    if (source.transport === 'browser' && !flag('browser')) {
      deferred += list.length;
      console.log(`  ${source.campus.padEnd(18)} ${String(list.length).padStart(2)} departments — needs headed Chrome, pass --browser`);
      continue;
    }
    if (flag('list')) {
      console.log(`  ${source.campus.padEnd(18)} ${String(list.length).padStart(2)} departments: ${list.join(' ')}`);
      continue;
    }

    const ucscSlugs = source.index ? await resolveUcscSlugs(source.index) : null;
    const dir = path.join(PAGES, String(schoolId));
    fs.mkdirSync(dir, { recursive: true });

    for (const prefix of list) {
      const resolved = ucscSlugs ? ucscSlugs.get(prefix.replace(/\s+/g, '').toUpperCase()) : null;
      if (source.index && !resolved) {
        failed += 1;
        console.log(`    ${source.campus} ${prefix}: no slug on the catalogue index`);
        continue;
      }
      const url = source.url(prefix, resolved, source.aliases || {});
      try {
        const body = source.transport === 'browser' || source.transport === 'json'
          ? await browserGet(url)
          : await fetchText(url);
        const file = path.join(dir, `${prefix.replace(/[^A-Za-z0-9]+/g, '_')}.html`);
        fs.writeFileSync(file, body);
        index.push({
          school_id: schoolId,
          campus: source.campus,
          prefix,
          format: source.format,
          url,
          file: path.relative(ROOT, file),
          bytes: body.length,
        });
        ok += 1;
      } catch (error) {
        failed += 1;
        console.log(`    ${source.campus} ${prefix}: ${error.message}`);
      }
    }
    console.log(`  ${source.campus.padEnd(18)} ${String(list.length).padStart(2)} departments captured`);
  }

  if (!flag('list')) {
    fs.mkdirSync(ROOT, { recursive: true });
    // Preserve entries for campuses this run did not touch, so a scoped run
    // never discards the rest of the index.
    const indexPath = path.join(ROOT, 'index.json');
    const previous = fs.existsSync(indexPath)
      ? JSON.parse(fs.readFileSync(indexPath, 'utf8')).pages || [] : [];
    const touched = new Set(index.map((p) => `${p.school_id}|${p.prefix}`));
    const merged = previous.filter((p) => !touched.has(`${p.school_id}|${p.prefix}`)).concat(index);
    fs.writeFileSync(indexPath, `${JSON.stringify({ captured_at: new Date().toISOString(), pages: merged }, null, 2)}\n`);
    console.log(`\ncaptured ${ok}, failed ${failed}, deferred to headed Chrome ${deferred}`);
    console.log(`index: ${path.join(ROOT, 'index.json')}`);
  }
  if (browserCtx) await browserCtx.close().catch(() => {});
}

main().catch((error) => { console.error(error); process.exit(1); });
