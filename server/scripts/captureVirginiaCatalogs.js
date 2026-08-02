#!/usr/bin/env node
/**
 * Capture the Computer Science requirements page for every Virginia institution.
 *
 * This is the collection half of the Virginia CS scrape. It does one job and
 * refuses to do the other: it saves pages, it does not interpret them. The
 * previous collector conflated the two — it ran a regex for course codes over
 * whatever HTML it got and stored the codes — which is why every Virginia
 * degree ended up as one undifferentiated bag of courses. Headings, credit
 * figures and "choose two of the following" instructions were all thrown away
 * at fetch time and could not be recovered downstream.
 *
 * So: capture writes `.va-catalogs/pages/<slug>__<role>.html` and `.txt`
 * verbatim, and `extractVirginiaRequirements.js` reads those. Re-parsing never
 * requires re-fetching, which matters because the browser transport is slow and
 * some of these hosts rate-limit.
 *
 * ## Transports
 *
 * Which one an institution needs is a property of its catalog software, not of
 * the institution, and it is recorded in the registry:
 *
 *   http     Plain fetch with a browser User-Agent. CourseLeaf, CleanCatalog,
 *            Coursedog, SmartCatalog and department pages all answer this.
 *   browser  Real Chrome under Playwright. **Acalog answers scripted fetch with
 *            HTTP 202 and a bot challenge, and Tidewater adds Cloudflare on
 *            top.** Headless Chrome fails both; headed Chrome passes both. This
 *            is not a preference — it is the only path that returns the page.
 *   pdf      Download and run pdftotext -layout. Two institutions publish their
 *            catalog only as a PDF.
 *
 * The browser transport uses a *persistent* profile so the Cloudflare clearance
 * cookie survives between runs; a fresh profile gets challenged on every hit.
 *
 * ## Discovery
 *
 * Registry seeds are hints, not answers. Acalog's `poid` is repointed every
 * catalog year and search engines index the old one, so a seed URL silently
 * becomes last year's program — or a 404 — without changing shape. For Acalog
 * the script therefore self-discovers on the newest `catoid` and only falls
 * back to the seed. Other platforms get a shallow link crawl from the catalog
 * root when their seed is missing or yields nothing.
 *
 * Usage:
 *   node scripts/captureVirginiaCatalogs.js                  # everything
 *   node scripts/captureVirginiaCatalogs.js --only tcc,gcc   # slugs, prefix ok
 *   node scripts/captureVirginiaCatalogs.js --level community_college
 *   node scripts/captureVirginiaCatalogs.js --force          # ignore the cache
 *   node scripts/captureVirginiaCatalogs.js --headless       # will fail Acalog
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const CAT = path.join(__dirname, '..', '.va-catalogs');
const PAGES = path.join(CAT, 'pages');
const PROFILE = path.join(CAT, '.browser-profile');
const INDEX = path.join(PAGES, 'index.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const HOST_DELAY_MS = 1500;

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f, d = null) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const opts = {
  only: (val('--only') || '').split(',').map((s) => s.trim()).filter(Boolean),
  level: val('--level'),
  force: flag('--force'),
  headless: flag('--headless'),
};
const log = (...a) => console.log('[va:capture]', ...a);

const sha = (s) => createHash('sha256').update(s || '').digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One in-flight request per host, spaced by HOST_DELAY_MS. */
const lastHit = new Map();
async function polite(url) {
  let host;
  try { host = new URL(url).host; } catch { return; }
  const since = Date.now() - (lastHit.get(host) || 0);
  if (since < HOST_DELAY_MS) await sleep(HOST_DELAY_MS - since);
  lastHit.set(host, Date.now());
}

// ── the CS program, and the things that look like it but are not ────────────
// A "Career Studies Certificate in Computer Science" and a "Computer Science
// minor" both match /computer science/i. Neither is the transfer degree, and
// picking one silently substitutes a 9-credit certificate for a 60-credit
// degree, so the exclusions matter as much as the match.
const CS_NAME = /computer\s*science|computing\s+science/i;
const NOT_THE_DEGREE = /certificate|career\s*studies|minor|endorsement|concentration\s+only|networking|cyber|information\s+technology|software\s+engineering|data\s+science|associate\s+of\s+applied|\bA\.?A\.?S\b/i;
/** Award words that mark the real thing, used to break ties. */
const AWARD = /associate\s+of\s+science|\bA\.?S\.?\b|bachelor\s+of\s+science|\bB\.?S\.?\b/i;

function scoreProgramLink(text, href) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!CS_NAME.test(t)) return -1;
  if (NOT_THE_DEGREE.test(t)) return -1;
  let s = 10;
  if (AWARD.test(t)) s += 5;
  if (/^computer science\b/i.test(t)) s += 3;
  if (/preview_program\.php/.test(href || '')) s += 2;
  s -= Math.min(4, Math.floor(t.length / 40));
  return s;
}

// ── transports ──────────────────────────────────────────────────────────────

/**
 * Plain fetch, falling back to curl.
 *
 * Node's fetch fails outright — not a status, a thrown connection error — on
 * several of these hosts (Central Virginia, Rappahannock, Roanoke, Paul D.
 * Camp) while curl retrieves them on the first try from the same machine. The
 * cause is in the TLS/ALPN negotiation, not in the sites, and it is not worth
 * diagnosing: curl is already a dependency of this workflow through the PDF
 * path, and a page fetched by curl is byte-identical to one fetched any other
 * way. Without this, four institutions read as "publishes nothing".
 */
async function httpGet(url) {
  await polite(url);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(45000),
    });
    if (res.ok) return { status: res.status, html: await res.text(), finalUrl: res.url };
    const viaCurl = curlGet(url);
    if (viaCurl.html) return viaCurl;
    return { status: res.status, html: '', finalUrl: res.url };
  } catch (e) {
    const viaCurl = curlGet(url);
    if (viaCurl.html) return viaCurl;
    return { status: 0, html: '', finalUrl: url, error: e.message };
  }
}

function curlGet(url) {
  try {
    const out = execFileSync('curl', [
      '-sSL', '--max-time', '45', '--compressed',
      '-A', UA,
      '-w', '\n__STATUS__%{http_code}\n__URL__%{url_effective}',
      url,
    ], { maxBuffer: 64 * 1024 * 1024 }).toString();
    const status = Number((/__STATUS__(\d+)/.exec(out) || [])[1] || 0);
    const finalUrl = (/__URL__(.*)$/.exec(out) || [])[1] || url;
    const html = out.replace(/\n__STATUS__\d+\n__URL__.*$/s, '');
    return { status, html: status >= 200 && status < 300 ? html : '', finalUrl, transport_note: 'curl' };
  } catch {
    return { status: 0, html: '', finalUrl: url };
  }
}

/** Chrome, kept alive across the whole run. Opened lazily — a pure-http run never starts it. */
let browserCtx = null;
async function browser() {
  if (browserCtx) return browserCtx;
  const { chromium } = require('playwright');
  fs.mkdirSync(PROFILE, { recursive: true });
  browserCtx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: opts.headless,
    viewport: { width: 1400, height: 1000 },
    userAgent: UA,
  });
  return browserCtx;
}

/** Cloudflare and Acalog both serve an interstitial that swaps itself out. */
const INTERSTITIAL = /Performing security verification|Just a moment|Checking your browser|Enable JavaScript and cookies/i;

async function browserGet(url, { settle = 3000, patience = 45000 } = {}) {
  await polite(url);
  const ctx = await browser();
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const deadline = Date.now() + patience;
    for (;;) {
      await page.waitForTimeout(settle);
      const text = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      if (!INTERSTITIAL.test(text) && text.trim().length > 200) break;
      if (Date.now() > deadline) break;
      settle = 2500;
    }
    return {
      status: res ? res.status() : 0,
      html: await page.content(),
      text: await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => ''),
      finalUrl: page.url(),
    };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Run a function inside the page's own origin.
 *
 * This is the whole trick for Acalog: once Chrome holds the challenge cookie,
 * `fetch()` from within the page is authorised, so catalog discovery can walk
 * dozens of nav pages without paying a full navigation for each one.
 */
async function browserEval(url, fn, arg) {
  await polite(url);
  const ctx = await browser();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (let i = 0; i < 8; i += 1) {
      await page.waitForTimeout(2500);
      const text = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      if (!INTERSTITIAL.test(text)) break;
    }
    return await page.evaluate(fn, arg);
  } finally {
    await page.close().catch(() => {});
  }
}

async function pdfGet(url, slug, role) {
  await polite(url);
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!res.ok) return { status: res.status, html: '', text: '', finalUrl: res.url };
  const buf = Buffer.from(await res.arrayBuffer());
  const pdfPath = path.join(PAGES, `${slug}__${role}.pdf`);
  fs.writeFileSync(pdfPath, buf);
  let text = '';
  try {
    text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { maxBuffer: 128 * 1024 * 1024 }).toString();
  } catch (e) {
    text = '';
  }
  return { status: res.status, html: '', text, finalUrl: res.url, pdf: pdfPath };
}

const transportFor = (platform) => (platform === 'acalog' ? 'browser' : platform === 'pdf' ? 'pdf' : 'http');

// ── discovery ───────────────────────────────────────────────────────────────

/**
 * Acalog: find the CS program on the newest catalog.
 *
 * Walks `catoid` descending because the newest catalog is the live one, then
 * each `navoid` (the program-index pages) looking for a program link that
 * scores as the degree. Returns the print view, which is one flat document
 * instead of the tabbed default.
 */
const ACALOG_DISCOVER = async (limitNavs) => {
  const org = location.origin;
  // The challenge applies to in-page fetches too, not just to the navigation.
  // On a cold profile the first `index.php` read comes back 202 with no body,
  // which silently yields zero navs and therefore zero programs — the failure
  // mode that made this look like "the college has no CS degree". Retry, and
  // report what was actually read so an empty result is never ambiguous.
  const txt = async (u) => {
    for (let i = 0; i < 4; i += 1) {
      try {
        const r = await fetch(u, { credentials: 'include' });
        if (r.ok) return await r.text();
      } catch { /* fall through to the retry */ }
      await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
    }
    return '';
  };
  const score = (t, href) => {
    const s = String(t || '').replace(/\s+/g, ' ').trim();
    if (!/computer\s*science|computing\s+science/i.test(s)) return -1;
    if (/certificate|career\s*studies|minor|endorsement|networking|cyber|information\s+technology|software\s+engineering|data\s+science|associate\s+of\s+applied|\bA\.?A\.?S\b/i.test(s)) return -1;
    let n = 10;
    if (/associate\s+of\s+science|\bA\.?S\.?\b|bachelor\s+of\s+science|\bB\.?S\.?\b/i.test(s)) n += 5;
    if (/^computer science\b/i.test(s)) n += 3;
    if (/preview_program\.php/.test(href || '')) n += 2;
    return n - Math.min(4, Math.floor(s.length / 40));
  };
  const cats = [...new Set((document.documentElement.innerHTML.match(/catoid=(\d+)/g) || [])
    .map((s) => Number(s.split('=')[1])))].sort((a, b) => b - a);
  const found = [];
  const read = { navs_seen: 0, nav_pages_read: 0, program_links_seen: 0 };
  for (const cat of cats.slice(0, 2)) {
    const home = await txt(`${org}/index.php?catoid=${cat}`);
    const navs = [...new Set((home.match(/navoid=(\d+)/g) || []).map((s) => Number(s.split('=')[1])))];
    read.navs_seen += navs.length;
    for (const n of navs.slice(0, limitNavs)) {
      const body = await txt(`${org}/content.php?catoid=${cat}&navoid=${n}`);
      if (body) read.nav_pages_read += 1;
      const doc = new DOMParser().parseFromString(body, 'text/html');
      const links = doc.querySelectorAll('a[href*="preview_program.php"]');
      read.program_links_seen += links.length;
      for (const a of links) {
        const s = score(a.textContent, a.getAttribute('href'));
        if (s > 0) found.push({ score: s, title: a.textContent.replace(/\s+/g, ' ').trim(), href: new URL(a.getAttribute('href'), org).href, catoid: cat });
      }
    }
    if (found.length) break;
  }
  found.sort((a, b) => b.score - a.score);
  return { cats: cats.slice(0, 4), found: found.slice(0, 6), read };
};

/** Nav pages worth a full page load when in-page fetch is refused. */
const PROGRAM_INDEX_HINT = /program|major|degree|pathway|curricul|areas?\s+of\s+study|academic/i;

/**
 * Acalog discovery over real navigations.
 *
 * Some Acalog installs (Danville) challenge in-page `fetch` no matter how long
 * the profile has been warm, while answering ordinary navigations fine. Loading
 * every nav page that way would cost 30 page loads per college, so the nav
 * links are ranked by their own text first and only the few that read like a
 * program index are visited.
 */
async function discoverAcalogByNavigation(inst) {
  const ctx = await browser();
  const page = await ctx.newPage();
  const read = { navs_seen: 0, nav_pages_read: 0, program_links_seen: 0, via: 'navigation' };
  const found = [];
  const settle = async () => {
    for (let i = 0; i < 6; i += 1) {
      await page.waitForTimeout(2000);
      const t = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
      if (!INTERSTITIAL.test(t) && t.trim().length > 200) return;
    }
  };
  try {
    await polite(inst.catalog_root);
    await page.goto(inst.catalog_root, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await settle();
    const cats = await page.evaluate(() => [...new Set((document.documentElement.innerHTML.match(/catoid=(\d+)/g) || [])
      .map((s) => Number(s.split('=')[1])))].sort((a, b) => b - a));
    const cat = cats[0];
    if (cat == null) return { url: null, candidates: [], catoids: [], read };

    await polite(inst.catalog_root);
    await page.goto(new URL(`index.php?catoid=${cat}`, inst.catalog_root).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await settle();
    const navs = await page.evaluate(() => [...document.querySelectorAll('a[href*="navoid="]')]
      .map((a) => ({ href: a.href, text: (a.textContent || '').replace(/\s+/g, ' ').trim() }))
      .filter((n, i, all) => all.findIndex((m) => m.href === n.href) === i));
    read.navs_seen = navs.length;

    const ranked = navs
      .map((n) => ({ ...n, rank: PROGRAM_INDEX_HINT.test(n.text) ? 2 : 0 }))
      .sort((a, b) => b.rank - a.rank)
      .filter((n) => n.rank > 0)
      .slice(0, 8);

    for (const nav of ranked) {
      await polite(nav.href);
      await page.goto(nav.href, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await settle();
      const links = await page.evaluate(() => [...document.querySelectorAll('a[href*="preview_program.php"]')]
        .map((a) => ({ href: a.href, text: (a.textContent || '').replace(/\s+/g, ' ').trim() }))).catch(() => []);
      // Pages read and pages that happened to carry program links are
      // different facts. Conflating them reported "read nothing" for a college
      // whose index simply lists no CS degree, which then read as blocked
      // rather than as the finding it is.
      read.nav_pages_read += 1;
      read.program_links_seen += links.length;
      for (const l of links) {
        const s = scoreProgramLink(l.text, l.href);
        if (s > 0) found.push({ score: s, title: l.text, href: l.href, catoid: cat });
      }
      // Keep reading past the first index that has any links. A college can
      // list its transfer degrees on a different page from its career ones, and
      // stopping early is how "no CS program" gets recorded for a college that
      // simply files CS somewhere else.
      if (found.length && read.nav_pages_read >= 3) break;
    }
    found.sort((a, b) => b.score - a.score);
    if (!found.length) return { url: null, candidates: [], catoids: cats.slice(0, 4), read };
    const best = found[0];
    const url = best.href.includes('print=') ? best.href : `${best.href}${best.href.includes('?') ? '&' : '?'}print=1`;
    return { url, title: best.title, candidates: found.slice(0, 6), catoids: cats.slice(0, 4), read };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Acalog discovery over curl.
 *
 * Third and last route. Some installs (Rappahannock) refuse both in-page fetch
 * and Node's fetch, yet answer curl plainly — the bot filter is keyed on
 * something curl happens not to trip. Cheap to try, and the alternative is
 * recording a college as blocked when its catalog is simply sitting there.
 */
function discoverAcalogByCurl(inst) {
  const read = { navs_seen: 0, nav_pages_read: 0, program_links_seen: 0, via: 'curl' };
  const root = curlGet(inst.catalog_root);
  if (!root.html) return { url: null, candidates: [], catoids: [], read };

  const cats = [...new Set((root.html.match(/catoid=(\d+)/g) || []).map((s) => Number(s.split('=')[1])))].sort((a, b) => b - a);
  const found = [];
  for (const cat of cats.slice(0, 2)) {
    const home = curlGet(new URL(`index.php?catoid=${cat}`, inst.catalog_root).href);
    const navs = [...new Set((home.html.match(/navoid=(\d+)/g) || []).map((s) => Number(s.split('=')[1])))];
    read.navs_seen += navs.length;
    for (const n of navs.slice(0, 20)) {
      const page = curlGet(new URL(`content.php?catoid=${cat}&navoid=${n}`, inst.catalog_root).href);
      if (!page.html) continue;
      read.nav_pages_read += 1;
      const links = [...page.html.matchAll(/<a[^>]+href="([^"]*preview_program\.php[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
      read.program_links_seen += links.length;
      for (const [, href, inner] of links) {
        const text = inner.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
        const s = scoreProgramLink(text, href);
        if (s > 0) found.push({ score: s, title: text, href: new URL(href.replace(/&amp;/g, '&'), inst.catalog_root).href, catoid: cat });
      }
    }
    if (found.length) break;
  }
  found.sort((a, b) => b.score - a.score);
  if (!found.length) return { url: null, candidates: [], catoids: cats.slice(0, 4), read };
  const best = found[0];
  const url = best.href.includes('print=') ? best.href : `${best.href}${best.href.includes('?') ? '&' : '?'}print=1`;
  return { url, title: best.title, candidates: found.slice(0, 6), catoids: cats.slice(0, 4), read };
}

async function discoverAcalog(inst) {
  const hits = await browserEval(inst.catalog_root, ACALOG_DISCOVER, 30).catch(() => null);
  const read = hits ? hits.read : null;
  if (hits && hits.found && hits.found.length) {
    const best = hits.found[0];
    const url = best.href.includes('print=') ? best.href : `${best.href}${best.href.includes('?') ? '&' : '?'}print=1`;
    return { url, title: best.title, candidates: hits.found, catoids: hits.cats, read };
  }
  // Nothing read at all means a fetch path was refused, not that the college
  // has no CS degree. Exhaust the other two routes before believing a negative
  // — "no CS program" is a published finding, and it has to be earned.
  if (!read || read.nav_pages_read === 0) {
    const byNav = await discoverAcalogByNavigation(inst).catch(() => null);
    if (byNav && byNav.url) return { ...byNav, read_fetch: read };
    const byCurl = discoverAcalogByCurl(inst);
    if (byCurl.url || !byNav) return { ...byCurl, read_fetch: read, read_nav: byNav ? byNav.read : null };
    return { ...byNav, read_fetch: read, read_curl: byCurl.read };
  }
  return { url: null, candidates: [], catoids: hits ? hits.cats : [], read };
}

/** Everything that is not Acalog: a shallow crawl of the catalog root for a CS program link. */
async function discoverLinks(inst) {
  const cheerio = require('cheerio');
  const seen = new Set();
  const candidates = [];
  const visit = async (url, depth) => {
    if (depth > 1 || seen.has(url) || seen.size > 12) return;
    seen.add(url);
    let page;
    try { page = await httpGet(url); } catch { return; }
    if (!page.html) return;
    const $ = cheerio.load(page.html);
    const base = page.finalUrl || url;
    const next = [];
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href');
      const text = $(a).text();
      let abs;
      try { abs = new URL(href, base).href; } catch { return; }
      if (new URL(abs).host !== new URL(base).host) return;
      const s = scoreProgramLink(text, abs);
      if (s > 0) candidates.push({ score: s, title: text.replace(/\s+/g, ' ').trim(), href: abs });
      else if (depth === 0 && /program|major|academic|degree|catalog|undergraduate|areas-of-study/i.test(abs)) next.push(abs);
    });
    if (!candidates.length) for (const u of next.slice(0, 6)) await visit(u, depth + 1);
  };
  await visit(inst.catalog_root, 0);
  candidates.sort((a, b) => b.score - a.score);
  return { url: candidates.length ? candidates[0].href : null, candidates: candidates.slice(0, 6) };
}

// ── capture one institution ─────────────────────────────────────────────────

function htmlToText(html) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html || '');
  $('script, style, noscript, nav, footer, header').remove();
  return $('body').text().replace(/[ \t ]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

/** Statuses that mean "a bot filter answered", not "this page does not exist". */
const REFUSED = new Set([0, 202, 403, 405, 429, 503]);

async function fetchOne(inst, url, role) {
  const transport = transportFor(inst.platform);
  if (transport === 'pdf') return { ...(await pdfGet(url, inst.slug, role)), transport };
  if (transport === 'browser') {
    const r = await browserGet(url);
    return { ...r, text: r.text || htmlToText(r.html), transport };
  }

  const r = await httpGet(url);
  const text = htmlToText(r.html);
  // A 200 that carries almost no text is a single-page app that has not run
  // yet — Coursedog and CleanCatalog both render their requirements client
  // side. Treating that as the page would record "publishes nothing" for a
  // catalog that publishes everything, so thinness escalates just like a
  // refusal does.
  const tooThin = text.length < 3000;
  if (!REFUSED.has(r.status) && text && !tooThin) return { ...r, text, transport };

  // Cloudflare and friends are not exclusive to Acalog — Mary Baldwin,
  // Marymount, Randolph and Roanoke all refuse a scripted fetch while serving
  // an ordinary browser. Escalating here rather than recording `blocked` is the
  // difference between four institutions of real requirements and four dead
  // links.
  try {
    const viaBrowser = await browserGet(url);
    const browserText = viaBrowser.text || htmlToText(viaBrowser.html);
    if (browserText.length > text.length) {
      return { ...viaBrowser, text: browserText, transport: 'browser', escalated_from: r.status };
    }
  } catch (e) {
    return { ...r, text, transport, error: `http ${r.status}; browser retry failed: ${e.message}` };
  }
  return { ...r, text, transport };
}

/**
 * Course codes as printed, for the "is this really the program page?" test.
 *
 * Three *or four* digits, and no left `\b`. A three-digit-only pattern reads
 * `CS 1114` as `CS 111` followed by a stray `4`, fails its trailing boundary,
 * and reports zero courses — which marked Virginia Tech's complete, correctly
 * captured requirements page as publishing nothing.
 */
const PAGE_CODE = /[A-Z]{2,5}\s?\d{3,4}[A-Z]?(?![\dA-Za-z])/g;
const countCodes = (text) => new Set(String(text || '').match(PAGE_CODE) || []).size;

/** A page that is really the program, not a redirect to a search box or a 404 shell. */
function looksLikeRequirements(text) {
  if (!text || text.length < 400) return false;
  return countCodes(text) >= 4;
}

async function captureInstitution(inst, index) {
  const out = {
    slug: inst.slug,
    name: inst.name,
    level: inst.level,
    platform: inst.platform,
    transport: transportFor(inst.platform),
    captured_at: new Date().toISOString(),
    pages: [],
    outcome: 'no_cs_program',
    discovery: null,
  };

  // Targets: registry seeds, plus discovery. Acalog always rediscovers (stale
  // poids), other platforms only when the seed did not produce requirements.
  const targets = (inst.seeds || []).map((s) => ({ role: s.role, url: s.url, from: 'seed' }));
  if (inst.platform === 'acalog') {
    try {
      const d = await discoverAcalog(inst);
      out.discovery = d;
      if (d.url) {
        targets.unshift({ role: 'program', url: d.url, from: 'discovered' });
        // Some Acalog programs publish an empty `preview_program` shell and put
        // the actual course list only in the degree planner view. Queue it as a
        // second attempt rather than recording the college as url-only.
        targets.splice(1, 0, {
          role: 'program',
          url: d.url.replace('preview_program.php', 'preview_degree_planner.php'),
          from: 'discovered_planner',
        });
      }
    } catch (e) { out.discovery = { error: e.message }; }
  }

  const tried = new Set();
  const attempts = new Map();
  for (const t of targets) {
    if (tried.has(t.url)) continue;
    tried.add(t.url);
    let r;
    try { r = await fetchOne(inst, t.url, t.role); } catch (e) { r = { status: 0, html: '', text: '', error: e.message }; }
    const body = r.text || '';
    const ok = looksLikeRequirements(body);
    // Several attempts can share a role (program page, then degree planner,
    // then the seed). Each gets its own file so a later failure cannot
    // overwrite an earlier success on disk.
    const n = (attempts.get(t.role) || 0) + 1;
    attempts.set(t.role, n);
    const file = n === 1 ? `${inst.slug}__${t.role}` : `${inst.slug}__${t.role}${n}`;
    if (r.html) fs.writeFileSync(path.join(PAGES, `${file}.html`), r.html);
    if (body) fs.writeFileSync(path.join(PAGES, `${file}.txt`), body);
    out.pages.push({
      role: t.role,
      requested_url: t.url,
      final_url: r.finalUrl || t.url,
      from: t.from,
      status: r.status,
      transport: r.transport || out.transport,
      bytes_html: (r.html || '').length,
      bytes_text: body.length,
      sha256: sha(body),
      distinct_codes: countCodes(body),
      has_requirements: ok,
      file: r.html || body ? file : null,
      error: r.error || null,
    });
    if (ok && t.role === 'program') { out.outcome = 'captured'; break; }
  }

  // Seeds produced nothing usable and this platform has not been crawled yet.
  if (out.outcome !== 'captured' && inst.platform !== 'acalog' && inst.platform !== 'pdf' && inst.offers_cs !== false) {
    try {
      const d = await discoverLinks(inst);
      out.discovery = d;
      if (d.url && !tried.has(d.url)) {
        const r = await fetchOne(inst, d.url, 'program');
        const body = r.text || '';
        const file = `${inst.slug}__program`;
        if (r.html) fs.writeFileSync(path.join(PAGES, `${file}.html`), r.html);
        if (body) fs.writeFileSync(path.join(PAGES, `${file}.txt`), body);
        out.pages.push({
          role: 'program',
          requested_url: d.url,
          final_url: r.finalUrl || d.url,
          from: 'crawled',
          status: r.status,
          transport: r.transport || out.transport,
          bytes_html: (r.html || '').length,
          bytes_text: body.length,
          sha256: sha(body),
          distinct_codes: countCodes(body),
          has_requirements: looksLikeRequirements(body),
          file: r.html || body ? file : null,
          error: null,
        });
        if (looksLikeRequirements(body)) out.outcome = 'captured';
      }
    } catch (e) { out.discovery = { error: e.message }; }
  }

  // Three distinguishable failures, and the difference is the whole point of
  // recording them: `blocked` is our problem, `url_only` is theirs, and
  // `no_cs_program` is a finding about the institution.
  if (out.outcome !== 'captured') {
    const anyPage = out.pages.some((p) => p.bytes_text > 0);
    const anyBlocked = out.pages.some((p) => p.status === 202 || p.status === 403 || p.status === 0);
    // An Acalog run that read no nav pages searched nothing. Calling that
    // "no CS program" would be inventing a finding out of a network failure.
    const searchedNothing = inst.platform === 'acalog'
      && (!out.discovery || !out.discovery.read || out.discovery.read.nav_pages_read === 0);
    if (inst.offers_cs === false) out.outcome = 'no_cs_program';
    else if (searchedNothing) out.outcome = 'blocked';
    else if (anyBlocked && !anyPage) out.outcome = 'blocked';
    else if (anyPage) out.outcome = 'url_only';
  }

  index[inst.slug] = out;
  const first = out.pages[0];
  log(`${out.outcome.padEnd(14)} ${inst.slug.padEnd(52)} ${out.pages.length}p ${first ? `${first.status} ${first.distinct_codes} codes` : ''}`);
  return out;
}

// ── driver ──────────────────────────────────────────────────────────────────

(async () => {
  fs.mkdirSync(PAGES, { recursive: true });
  const registry = JSON.parse(fs.readFileSync(path.join(CAT, 'institutions.json'), 'utf8'));
  let list = registry.institutions;
  if (opts.level) list = list.filter((i) => i.level === opts.level);
  if (opts.only.length) list = list.filter((i) => opts.only.some((o) => i.slug.startsWith(o) || (i.vccs_slug || '') === o));

  // The index is always loaded, `--force` or not. `--force` re-fetches the
  // institutions in *this* run; it must not discard entries for institutions
  // the run does not touch, or a `--only` re-run silently erases the rest of
  // the corpus from the index while their captured pages sit on disk.
  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : {};
  log(`${list.length} institutions · transport mix: ${JSON.stringify(list.reduce((a, i) => { const t = transportFor(i.platform); a[t] = (a[t] || 0) + 1; return a; }, {}))}`);
  if (list.some((i) => transportFor(i.platform) === 'browser') && !opts.headless) {
    log('Acalog institutions need real Chrome — a browser window will open. Leave it alone; it closes itself.');
  }

  for (const inst of list) {
    if (!opts.force && index[inst.slug] && index[inst.slug].outcome === 'captured') {
      log(`cached         ${inst.slug}`);
      continue;
    }
    try { await captureInstitution(inst, index); } catch (e) { log(`ERROR ${inst.slug}: ${e.message}`); index[inst.slug] = { slug: inst.slug, outcome: 'error', error: e.message }; }
    fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
  }

  if (browserCtx) await browserCtx.close().catch(() => {});
  const tally = Object.values(index).reduce((a, r) => { a[r.outcome] = (a[r.outcome] || 0) + 1; return a; }, {});
  log('done —', JSON.stringify(tally));
})();
