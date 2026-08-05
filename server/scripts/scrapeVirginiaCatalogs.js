#!/usr/bin/env node
/**
 * Scrape Computer Science degree requirements from Virginia institutions' own
 * catalogs — the same way the California four-year requirements were gathered,
 * rather than from Transfer Virginia's program maps.
 *
 * Two facts make this a batch job instead of 55 hand visits:
 *
 * 1. **Most Virginia catalogs run CourseLeaf**, and every CourseLeaf program
 *    page renders requirements as `table.sc_courselist` with `.codecol` /
 *    `.titlecol` / `.hourscol` and `tr.areaheader` group headings. One parser
 *    covers VT, VCU, GMU, JMU, Radford, Longwood and the rest.
 * 2. **The markup is in the raw HTML** — it only looks JavaScript-rendered.
 *    The catalogs 403 a default curl User-Agent and return a shell; with a
 *    browser UA the tables are right there. That one header is the difference
 *    between "needs a headless browser" and "needs fetch".
 *
 * Discovery uses CourseLeaf's own search endpoint (`/search/?search=…`), so no
 * program URL is hardcoded — only the institution's catalog host, which is the
 * one thing that genuinely varies.
 *
 * Everything is written with its `source_url`, because all of this is verified
 * by hand: the URL is what makes a check fast. Nothing here decides what is
 * correct — where the Transfer Virginia program map also covers a college, the
 * two are compared and both kept.
 */
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const OUT = path.join(__dirname, '..', '.va-catalogs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const DELAY = Number(argv.includes('--delay') ? argv[argv.indexOf('--delay') + 1] : 1200);

/**
 * Institution -> catalog host(s), most likely first. Hosts are the only
 * hardcoded part; program URLs are discovered.
 */
const HOSTS = {
  // ── community colleges (AS) ────────────────────────────────────────────────
  'Blue Ridge Community College': ['catalog.brcc.edu', 'brcc.edu'],
  'Brightpoint Community College': ['catalog.brightpoint.edu', 'brightpoint.edu'],
  'Central Virginia Community College': ['catalog.centralvirginia.edu', 'centralvirginia.edu'],
  'Danville Community College': ['catalog.danville.edu', 'danville.edu'],
  'Eastern Shore Community College': ['catalog.es.vccs.edu', 'es.vccs.edu'],
  'Germanna Community College': ['catalog.germanna.edu', 'germanna.edu'],
  'J Sargeant Reynolds Community College': ['catalog.reynolds.edu', 'reynolds.edu'],
  'Laurel Ridge Community College': ['catalog.laurelridge.edu', 'laurelridge.edu'],
  'Mountain Empire Community College': ['catalog.mecc.edu', 'mecc.edu'],
  'Mountain Gateway Community College': ['catalog.mgcc.edu', 'mgcc.edu'],
  'New River Community College': ['catalog.nr.edu', 'nr.edu'],
  'Northern Virginia Community College': ['catalog.nvcc.edu'],
  'Patrick & Henry Community College': ['catalog.patrickhenry.edu', 'patrickhenry.edu'],
  'Paul D. Camp Community College': ['catalog.pdc.edu', 'pdc.edu'],
  'Piedmont Virginia Community College': ['catalog.pvcc.edu', 'pvcc.edu'],
  'Rappahannock Community College': ['catalog.rappahannock.edu', 'rappahannock.edu'],
  'Richard Bland College': ['catalog.rbc.edu', 'rbc.edu'],
  'Southside Virginia Community College': ['catalog.southside.edu', 'southside.edu'],
  'Southwest Virginia Community College': ['catalog.sw.edu', 'sw.edu'],
  'Tidewater Community College': ['catalog.tcc.edu', 'tcc.edu'],
  'Virginia Highlands Community College': ['catalog.vhcc.edu', 'vhcc.edu'],
  'Virginia Peninsula Community College': ['catalog.vpcc.edu', 'vpcc.edu'],
  'Virginia Western Community College': ['catalog.virginiawestern.edu', 'virginiawestern.edu'],
  'Wytheville Community College': ['catalog.wcc.vccs.edu', 'wcc.vccs.edu'],
  // ── universities (BS) ─────────────────────────────────────────────────────
  'Averett University': ['catalog.averett.edu', 'averett.edu'],
  'Bluefield College': ['catalog.bluefield.edu', 'bluefield.edu'],
  'Bridgewater College': ['catalog.bridgewater.edu', 'bridgewater.edu'],
  'Christopher Newport University': ['catalog.cnu.edu', 'cnu.edu'],
  'Eastern Mennonite University': ['catalog.emu.edu', 'emu.edu'],
  'Emory & Henry College': ['catalog.ehc.edu', 'ehc.edu'],
  'Ferrum College': ['catalog.ferrum.edu', 'ferrum.edu'],
  'George Mason University': ['catalog.gmu.edu'],
  'Hollins University': ['catalog.hollins.edu', 'hollins.edu'],
  'James Madison University': ['catalog.jmu.edu'],
  'Longwood University': ['catalog.longwood.edu', 'longwood.edu'],
  'Mary Baldwin University': ['catalog.marybaldwin.edu', 'marybaldwin.edu'],
  'Marymount University': ['catalog.marymount.edu', 'marymount.edu'],
  'Norfolk State University': ['catalog.nsu.edu', 'nsu.edu'],
  'Old Dominion University': ['catalog.odu.edu', 'odu.edu'],
  'Radford University': ['catalog.radford.edu', 'radford.edu'],
  'Randolph College': ['catalog.randolphcollege.edu', 'randolphcollege.edu'],
  'Randolph-Macon College': ['catalog.rmc.edu', 'rmc.edu'],
  'Regent University': ['catalog.regent.edu', 'regent.edu'],
  'Roanoke College': ['catalog.roanoke.edu', 'roanoke.edu'],
  'Shenandoah University': ['catalog.su.edu', 'su.edu'],
  'Sweet Briar College': ['catalog.sbc.edu', 'sbc.edu'],
  'The University of Virginia\'s College at Wise': ['catalog.uvawise.edu', 'uvawise.edu'],
  'University of Lynchburg': ['catalog.lynchburg.edu', 'lynchburg.edu'],
  'University of Mary Washington': ['catalog.umw.edu', 'umw.edu'],
  'Virginia Commonwealth University': ['bulletin.vcu.edu'],
  'Virginia Polytechnic Institute and State University': ['catalog.vt.edu'],
  'Virginia State University': ['catalog.vsu.edu', 'vsu.edu'],
  'Virginia Wesleyan University': ['catalog.vwu.edu', 'vwu.edu'],
  'William & Mary': ['catalog.wm.edu', 'wm.edu'],
};

const isCC = (n) => /community college|Richard Bland/i.test(n);

/**
 * Catalog hosts for an institution: the seeded guesses first, then whatever the
 * homepage links to. Guessing `catalog.<domain>` is right often enough to try
 * but wrong often enough that it cannot be the only strategy.
 */
async function catalogHosts(seeds) {
  const out = [...seeds];
  const base = seeds[seeds.length - 1];
  const home = await get(`https://${base}/`);
  if (home) {
    const $ = cheerio.load(home);
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const text = `${$(a).text()}`.trim();
      if (!/catalog|bulletin/i.test(`${href} ${text}`)) return;
      try {
        const u = new URL(href, `https://${base}`);
        if (/catalog|bulletin/i.test(u.host)) out.push(u.host);
        else if (/catalog|bulletin/i.test(u.pathname)) out.push(u.host + u.pathname.replace(/\/$/, ''));
      } catch { /* skip unparseable links */ }
    });
  }
  return [...new Set(out)].slice(0, 6);
}

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

/** Program pages that look like a CS degree, from CourseLeaf's search. */
async function discover(host, wantAward) {
  const html = await get(`https://${host}/search/?search=computer+science`);
  if (!html) return [];
  const $ = cheerio.load(html);
  const hits = [];
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const text = `${$(a).text()}`.replace(/\s+/g, ' ').trim();
    if (!/computer/i.test(text)) return;
    if (/\/(courses|azcourses|archives)\//.test(href)) return;
    const award = /\bB\.?S\.?\b|bachelor of science/i.test(text) ? 'BS'
      : /\bB\.?A\.?\b/i.test(text) ? 'BA'
      : /\bA\.?S\.?\b|associate of science/i.test(text) ? 'AS'
      : /\bA\.?A\.?\s?&\s?S\.?\b/i.test(text) ? 'AA&S' : null;
    hits.push({ url: href.startsWith('http') ? href : `https://${host}${href}`, text, award });
  });
  // Exact award first, then anything CS-shaped; concentrations sort last so a
  // plain "Computer Science, BS" beats "…BS with a concentration in …".
  const score = (h) => (h.award === wantAward ? 0 : h.award ? 2 : 3)
    + (/concentration|minor|certificate|accelerated|\bMS\b|\bPh\.?D/i.test(h.text) ? 4 : 0)
    // A program URL ends in the award slug; a department or course index does not.
    + (new RegExp(`-${wantAward}/?$`, 'i').test(h.url) ? -1 : 0)
    + (/\/(courses|azcourses|faculty)\b/i.test(h.url) ? 6 : 0);
  return [...new Map(hits.map((h) => [h.url, h])).values()].sort((a, b) => score(a) - score(b));
}

/** CourseLeaf requirement table -> groups of codes. */
function parseCourseLeaf(html) {
  const $ = cheerio.load(html);
  // CourseLeaf renders requirements either as a requirement list
  // (`sc_courselist`) or a semester-by-semester plan grid (`sc_plangrid`).
  // Community colleges overwhelmingly publish the grid, which is why an
  // earlier pass found only a third of NOVA's courses.
  const tables = $('table.sc_courselist, table.sc_plangrid');
  if (!tables.length) return null;
  const groups = [];
  let current = null;
  let total = null;

  tables.find('tr').each((_, tr) => {
    const $tr = $(tr);
    const txt = (sel) => $tr.find(sel).text().replace(/\s+/g, ' ').trim();
    if ($tr.hasClass('areaheader') || $tr.hasClass('areasubheader')) {
      current = { title: txt('span, td') || txt('td'), credits: null, codes: [], note: null };
      groups.push(current);
      return;
    }
    const code = txt('.codecol').replace(/\s+/g, '');
    const hours = txt('.hourscol');
    const title = txt('.titlecol');
    if (/^total credits?$/i.test(title)) { total = Number(hours) || total; return; }
    if (!current) { current = { title: 'Requirements', credits: null, codes: [], note: null }; groups.push(current); }
    // `or CS 3034` continuation rows and `A & B` pairs both yield codes.
    for (const c of code.split(/or|&/i).map((s) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase())) {
      if (/^[A-Z]{2,5}\d{3,4}[A-Z]?$/.test(c)) current.codes.push(c);
    }
    if (!code && title) current.note = [current.note, title].filter(Boolean).join('; ').slice(0, 400);
  });

  const codes = [...new Set(groups.flatMap((g) => g.codes))];
  return { total_credits: total, groups: groups.filter((g) => g.codes.length || g.note), codes };
}

module.exports = { parseCourseLeaf, get, UA };

if (require.main !== module) return;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const names = Object.keys(HOSTS).filter((n) => !only || n.toLowerCase().includes(only.toLowerCase()));
  const results = [];
  for (const name of names) {
    const wantAward = isCC(name) ? 'AS' : 'BS';
    let record = { institution: name, level: isCC(name) ? 'community_college' : 'four_year', award: wantAward, status: 'not_found' };
    for (const host of await catalogHosts(HOSTS[name])) {
      const hits = await discover(host, wantAward);
      await sleep(DELAY);
      for (const hit of hits.slice(0, 5)) {
        const html = await get(hit.url);
        await sleep(DELAY);
        const parsed = html && parseCourseLeaf(html);
        if (parsed && parsed.codes.length >= 8 && parsed.codes.length <= 140) {
          record = {
            ...record,
            status: 'ok',
            platform: 'courseleaf',
            program_title: hit.text,
            award: hit.award || wantAward,
            source_url: hit.url,
            total_credits: parsed.total_credits,
            groups: parsed.groups,
            codes: parsed.codes,
          };
          break;
        }
      }
      if (record.status === 'ok') break;
    }
    results.push(record);
    const mark = record.status === 'ok' ? `${String(record.codes.length).padStart(3)} codes` : '  --      ';
    console.log(`${record.status === 'ok' ? 'ok ' : 'MISS'} ${mark}  ${name.slice(0, 46)}`);
  }
  fs.writeFileSync(path.join(OUT, 'catalogs.json'), JSON.stringify(results, null, 1));
  const ok = results.filter((r) => r.status === 'ok');
  console.log(`\n${ok.length}/${results.length} found · CC ${ok.filter((r) => r.level === 'community_college').length}/24 · 4yr ${ok.filter((r) => r.level === 'four_year').length}/30`);
  console.log(`missing: ${results.filter((r) => r.status !== 'ok').map((r) => r.institution).join(', ') || '(none)'}`);
  console.log(`wrote ${path.join(OUT, 'catalogs.json')}`);
})();
