#!/usr/bin/env node
/**
 * Capture Acalog course catalogues — UC Merced — by paging the course list with
 * descriptions expanded inline.
 *
 *   node scripts/captureAcalogCatalogs.js --campus 144
 *
 * Acalog normally lists courses as links to per-course popups, which would mean
 * a fetch per course. Adding `expand=1` renders every description in place, so a
 * page of 100 courses arrives in one request: 84 KB with the prerequisites in it
 * rather than 12 KB of links.
 *
 * It sits behind Cloudflare and answers plain requests with HTTP 202, so pages
 * are fetched with headed Chrome — the same transport the Virginia Acalog
 * catalogues needed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../.uc-catalogs');
const OUT = path.join(ROOT, 'acalog');
const PROFILE = path.join(ROOT, '.browser-profile');

const CAMPUSES = Object.freeze({
  144: {
    campus: 'UC Merced',
    // catoid/navoid change with each catalogue year; these were read off the
    // catalogue's own "Course Descriptions" link rather than guessed.
    page: (n) => 'https://catalog.ucmerced.edu/content.php?catoid=26&navoid=3778'
      + `&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=${n}&expand=1`,
  },
});

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
};

const INTERSTITIAL = /Performing security verification|Just a moment|Checking your browser/i;

async function main() {
  const { chromium } = require('playwright');
  fs.mkdirSync(PROFILE, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: true, viewport: { width: 1400, height: 1000 },
  });
  const only = arg('campus') ? Number(arg('campus')) : null;

  try {
    for (const [id, spec] of Object.entries(CAMPUSES)) {
      if (only && Number(id) !== only) continue;
      const pages = [];
      const seen = new Set();
      for (let n = 1; n <= 60; n += 1) {
        const page = await ctx.newPage();
        let html = '';
        try {
          await page.goto(spec.page(n), { waitUntil: 'domcontentloaded', timeout: 90000 });
          for (let wait = 0; wait < 8; wait += 1) {
            await page.waitForTimeout(1800);
            const text = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
            if (!INTERSTITIAL.test(text) && text.length > 2000) break;
          }
          html = await page.content();
        } catch (error) {
          console.log(`    page ${n}: ${error.message.split('\n')[0].slice(0, 60)}`);
        } finally {
          await page.close().catch(() => {});
        }
        if (!html) break;
        // Acalog serves the last page again once you run past the end, so stop
        // when a page repeats rather than trusting a page count.
        const codes = [...html.matchAll(/([A-Z]{2,5})\s?(\d{1,3}[A-Z]{0,2}):/g)].map((m) => `${m[1]} ${m[2]}`);
        const fingerprint = codes.slice(0, 5).join('|');
        if (!codes.length || seen.has(fingerprint)) break;
        seen.add(fingerprint);
        pages.push(html);
        process.stdout.write(`\r  ${spec.campus}: page ${n}, ${codes.length} courses`);
        await new Promise((r) => setTimeout(r, 400));
      }
      const file = path.join(OUT, `${id}.html`);
      // One concatenated document — the parser reads course blocks, not pages.
      fs.writeFileSync(file, pages.join('\n<!-- page break -->\n'));
      console.log(`\n  ${spec.campus.padEnd(16)} ${pages.length} pages, ${fs.statSync(file).size} bytes -> ${path.relative(ROOT, file)}`);
    }
  } finally {
    await ctx.close().catch(() => {});
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
