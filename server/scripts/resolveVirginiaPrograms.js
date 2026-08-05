#!/usr/bin/env node
/**
 * Resolve every Transfer Virginia CS program to its institution's own catalog
 * page and parse the requirements from there.
 *
 * Seeds come from the portal itself: each `/degrees/<GUID>` page carries a
 * "Program Web Page" external link, published by the institution — 78 of 78 CS
 * programs have one. That removes all URL guessing, which is what stalled the
 * host-pattern approach at 11 of 54.
 *
 * Some links land on a catalog program page (parse it directly); others land on
 * a department page, so one hop is followed to whatever it links to that looks
 * like a catalog/requirements/curriculum page.
 */
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { parseCourseLeaf, get } = require('./scrapeVirginiaCatalogs');

const C = path.join(__dirname, '..', '.va-degrees');
const OUT = path.join(__dirname, '..', '.va-catalogs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FOLLOW = /catalog|bulletin|curricul|requirement|program of study|plan of study|degree|major/i;

/** Candidate requirement pages one hop from a department landing page. */
function nextHops(html, base) {
  const $ = cheerio.load(html);
  const out = [];
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const text = `${$(a).text()}`.replace(/\s+/g, ' ').trim();
    if (!FOLLOW.test(`${href} ${text}`)) return;
    if (/\.(pdf|docx?|xlsx?)$/i.test(href)) return;
    try {
      const u = new URL(href, base);
      if (/^https?:/.test(u.protocol)) out.push(u.href);
    } catch { /* ignore */ }
  });
  // Catalog hosts first — they carry the structured tables.
  return [...new Set(out)].sort((a, b) => (/catalog|bulletin/i.test(b) ? 1 : 0) - (/catalog|bulletin/i.test(a) ? 1 : 0)).slice(0, 6);
}

(async () => {
  const seeds = JSON.parse(fs.readFileSync(path.join(C, 'external_links.json'), 'utf8'));
  const results = [];
  for (const s of seeds) {
    let rec = { institution: s.inst, program: s.prog, seed_url: s.url, status: 'no_requirements' };
    const html = await get(s.url);
    await sleep(700);
    const direct = html && parseCourseLeaf(html);
    if (direct && direct.codes.length >= 8 && direct.codes.length <= 200) {
      rec = { ...rec, status: 'ok', hops: 0, source_url: s.url, ...direct };
    } else if (html) {
      for (const hop of nextHops(html, s.url)) {
        const h2 = await get(hop);
        await sleep(700);
        const p = h2 && parseCourseLeaf(h2);
        if (p && p.codes.length >= 8 && p.codes.length <= 200) {
          rec = { ...rec, status: 'ok', hops: 1, source_url: hop, ...p };
          break;
        }
      }
    }
    results.push(rec);
    console.log(`${rec.status === 'ok' ? 'ok  ' : 'MISS'} ${String(rec.codes ? rec.codes.length : 0).padStart(3)} ${rec.institution.slice(0, 40)}`);
  }
  fs.writeFileSync(path.join(OUT, 'programs.json'), JSON.stringify(results, null, 1));
  const ok = results.filter((r) => r.status === 'ok');
  const insts = new Set(ok.map((r) => r.institution));
  console.log(`\n${ok.length}/${results.length} programs parsed · ${insts.size} institutions`);
})();
