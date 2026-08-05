#!/usr/bin/env node
/**
 * Collect courses from Coursedog-powered UC catalogues — Berkeley and Santa
 * Barbara — through the same API their own front ends call.
 *
 *   node scripts/captureCoursedogCatalogs.js --campus 79
 *   node scripts/captureCoursedogCatalogs.js            # every Coursedog campus
 *
 * Why drive a browser for a JSON API: the endpoint is session-bound. Called with
 * curl it answers once and then returns `Unauthenticated`; called from inside the
 * catalogue page it answers reliably, because the app's own origin, cookies and
 * headers come along. So the page is opened, its network traffic watched to learn
 * the tenant and catalogue id, and the API then paged from within that page.
 *
 * This source is better than scraping prose. Coursedog states prerequisites as
 * rules — `completedAllOf` over arrays of course ids, with `logic: and|or` — so
 * the boolean structure is machine-readable and needs no English parsing. The
 * human-readable string is kept alongside for verification.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../.uc-catalogs');
const OUT = path.join(ROOT, 'coursedog');
const PROFILE = path.join(ROOT, '.browser-profile');

const CAMPUSES = Object.freeze({
  79: { campus: 'UC Berkeley', home: 'https://undergraduate.catalog.berkeley.edu/courses' },
  128: { campus: 'UC Santa Barbara', home: 'https://catalog.ucsb.edu/courses' },
});

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
};

async function collect(schoolId, spec, browserCtx) {
  const page = await browserCtx.newPage();
  // The app announces its own tenant and catalogue id by calling them; watching
  // one request is more durable than hard-coding ids that change per catalogue year.
  let discovered = null;
  page.on('request', (req) => {
    const url = req.url();
    if (!discovered && /\/cm\/[^/]+\/courses\/search/.test(url) && req.method() === 'POST') {
      const tenant = /\/cm\/([^/]+)\/courses\/search/.exec(url)?.[1];
      const catalogId = /catalogId=([^&]+)/.exec(url)?.[1];
      if (tenant) discovered = { tenant, catalogId: catalogId || null };
    }
  });

  await page.goto(spec.home, { waitUntil: 'networkidle', timeout: 90000 });
  for (let i = 0; i < 12 && !discovered; i += 1) await page.waitForTimeout(1500);
  if (!discovered) {
    await page.close().catch(() => {});
    throw new Error('never saw a courses/search call — the catalogue may have changed');
  }

  const all = await page.evaluate(async ({ tenant, catalogId }) => {
    const base = `https://app.coursedog.com/api/v1/cm/${tenant}/courses/search/%24filters`;
    const body = {
      condition: 'AND',
      filters: [{
        id: 'status-course', condition: 'field', name: 'status', inputType: 'select',
        group: 'course', type: 'is', value: 'Active', customField: false,
      }],
    };
    const courses = [];
    let skip = 0;
    const limit = 200;
    for (;;) {
      const qs = new URLSearchParams({
        ...(catalogId ? { catalogId } : {}),
        skip: String(skip), limit: String(limit),
        orderBy: 'subjectCode', formatDependents: 'false',
      });
      const res = await fetch(`${base}?${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) break;
      const json = await res.json();
      const page = Array.isArray(json.data) ? json.data : Object.values(json.data || {});
      if (!page.length) break;
      // Keep only what a prerequisite graph needs; a full course record is large
      // and most of it is scheduling metadata.
      for (const c of page) {
        courses.push({
          id: c.id ?? c.courseId ?? null,
          subjectCode: c.subjectCode ?? null,
          courseNumber: c.courseNumber ?? null,
          name: c.name ?? c.longName ?? null,
          credits: c.credits ?? null,
          career: c.career ?? null,
          requisites: c.requisites ?? null,
        });
      }
      skip += page.length;
      const total = Number(json.listLength);
      if (Number.isFinite(total) && skip >= total) break;
      if (skip > 40000) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    return courses;
  }, discovered);

  await page.close().catch(() => {});
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${schoolId}.json`);
  fs.writeFileSync(file, `${JSON.stringify({
    school_id: schoolId,
    campus: spec.campus,
    tenant: discovered.tenant,
    catalog_id: discovered.catalogId,
    source: spec.home,
    captured_at: new Date().toISOString(),
    courses: all,
  }, null, 1)}\n`);
  const withReq = all.filter((c) => c.requisites && JSON.stringify(c.requisites).length > 2).length;
  console.log(`  ${spec.campus.padEnd(18)} ${String(all.length).padStart(6)} courses`
    + `  ${String(withReq).padStart(5)} with requisites   tenant=${discovered.tenant}`);
  return { count: all.length, withReq };
}

async function main() {
  const { chromium } = require('playwright');
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1400, height: 1000 },
  });
  const only = arg('campus') ? Number(arg('campus')) : null;
  try {
    for (const [id, spec] of Object.entries(CAMPUSES)) {
      if (only && Number(id) !== only) continue;
      try {
        await collect(Number(id), spec, ctx);
      } catch (error) {
        console.log(`  ${spec.campus.padEnd(18)} failed: ${error.message}`);
      }
    }
  } finally {
    await ctx.close().catch(() => {});
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
