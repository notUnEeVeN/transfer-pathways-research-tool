#!/usr/bin/env node
/**
 * Harvest course titles from the institution catalogs already scraped.
 *
 * The requirement ledger names a course as `PREFIX NUMBER · Title`. VCCS codes
 * resolve their title through `va_courses`, but four-year courses have no such
 * registry — GMU's `CS 425` had a code and no name, which is what a reader sees
 * as an unnamed requirement.
 *
 * Catalog pages carry the title right beside the code, so this re-reads the
 * pages already recorded in `merged.json` and fills a `course_titles` map per
 * institution. Nothing is re-discovered: every URL comes from the corpus.
 *
 * CourseLeaf and Acalog print the pairing differently, so both shapes are read:
 *   CourseLeaf  `table.sc_courselist` rows: `.codecol` + `.titlecol`
 *   Acalog      flat text: `CS 425 - Advanced Algorithms Credits: 3`
 *
 * Acalog hosts answer scripted requests with an HTTP 202 bot challenge, so they
 * are skipped here rather than silently recorded as empty — they need the
 * browser, and their absence is reported at the end.
 */
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const FILE = path.join(__dirname, '..', '.va-catalogs', 'merged.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const codeForm = (s) => norm(s).replace(/\s+/g, '').toUpperCase();

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
    if (!res.ok) return { html: null, status: res.status };
    return { html: await res.text(), status: res.status };
  } catch { return { html: null, status: 0 }; }
}

/** `{ CODE: title }` from a CourseLeaf requirement or plan table. */
function fromCourseLeaf(html) {
  const $ = cheerio.load(html);
  const out = {};
  $('table.sc_courselist tr, table.sc_plangrid tr').each((_, tr) => {
    const code = codeForm($(tr).find('.codecol').text());
    if (!/^[A-Z]{2,5}\d{3,4}[A-Z]?$/.test(code)) return;
    // Not every CourseLeaf template tags the title cell: George Mason emits a
    // bare <td> between .codecol and .hourscol. Fall back to that middle cell
    // rather than reading the row as titleless.
    let title = norm($(tr).find('.titlecol').text());
    if (!title) {
      title = norm($(tr).children('td').filter((_, td) => {
        const cls = $(td).attr('class') || '';
        return !/codecol|hourscol|.*col$/.test(cls) || cls === '';
      }).first().text());
    }
    if (title && !/^total/i.test(title)) out[code] = title;
  });
  return out;
}

/**
 * `{ CODE: title }` from Acalog's flat text, which prints
 * `CS 425 - Advanced Algorithms Credits: 3`. The title runs up to the credit
 * marker or the next course code, whichever comes first.
 */
function fromAcalog(html) {
  const $ = cheerio.load(html);
  $('script, style').remove();
  const text = norm($('body').text());
  const out = {};
  const re = /([A-Z]{2,5})\s?(\d{3,4}[A-Z]?)\s*[-–—]\s*([^]{2,90}?)(?=\s*(?:Credits?:|Credit Hours?:|[A-Z]{2,5}\s?\d{3,4}\s*[-–—]|$))/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const title = norm(m[3]).replace(/\s*\d+(\.\d+)?$/, '');
    if (title.length >= 3) out[`${m[1]}${m[2]}`] = title;
  }
  return out;
}

(async () => {
  const rows = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const targets = rows.filter((r) => r.source_url && (r.codes || []).length);
  console.log(`[titles] ${targets.length} institutions with a URL and codes`);

  let filled = 0;
  const blocked = [];
  for (const r of targets) {
    const { html, status } = await get(r.source_url);
    await sleep(800);
    if (!html) { blocked.push(`${r.institution} (HTTP ${status})`); continue; }
    // A bot challenge answers 202 with a stub; treat it as blocked, never as
    // "this catalog has no titles".
    if (status === 202 || html.length < 4000) { blocked.push(`${r.institution} (challenge)`); continue; }

    const found = { ...fromCourseLeaf(html), ...fromAcalog(html) };
    const wanted = new Set(r.codes);
    const titles = Object.fromEntries(Object.entries(found).filter(([c]) => wanted.has(c)));
    if (Object.keys(titles).length) {
      r.course_titles = titles;
      filled += 1;
    }
    const pct = Math.round((Object.keys(titles).length / r.codes.length) * 100);
    console.log(`  ${String(Object.keys(titles).length).padStart(3)}/${String(r.codes.length).padEnd(3)} ${String(pct).padStart(3)}%  ${r.institution.slice(0, 44)}`);
  }

  fs.writeFileSync(FILE, JSON.stringify(rows, null, 1));
  const covered = rows.reduce((n, r) => n + Object.keys(r.course_titles || {}).length, 0);
  console.log(`\n[titles] institutions filled: ${filled}/${targets.length} · titles captured: ${covered}`);
  if (blocked.length) console.log(`[titles] needs the browser (not recorded as empty): ${blocked.join(', ')}`);
})();
