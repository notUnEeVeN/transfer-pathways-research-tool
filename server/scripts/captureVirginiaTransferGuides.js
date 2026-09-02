#!/usr/bin/env node
/**
 * Capture Transfer Virginia's published **Transfer Guides** and reduce each to
 * the community-college side of the pathway.
 *
 * Why the guide rather than the program map. Transfer Virginia publishes two
 * different artifacts per program, and the earlier collection took the wrong
 * one. The program map (`.va-degrees/map_<id>.json`) states the requirements
 * "if you are **not** following a Transfer Guide" — that sentence is in the
 * markup we stored. The Transfer Guide is the receiving institution's own
 * course-by-course plan for a VCCS student, and it carries three things the
 * per-course equivalency tables do not:
 *
 *   - the **requirement the credit satisfies**, in words ("Scientific Literacy
 *     Requirement"), which is the applies-vs-transfers distinction stated by
 *     the receiver instead of inferred from an identifier;
 *   - **choice groups** as a single slot ("BIO 101, CHM 111, PHY 201, ... " for
 *     one 4-credit science requirement);
 *   - equivalencies that appear **nowhere else**. Lynchburg's guide maps
 *     CSC 221 to CS 131; the CSC221 course page lists 17 universities and
 *     Lynchburg is not among them.
 *
 * The faceted resources URL answers scripted fetch with HTTP 202 and a bot
 * challenge, so the unfiltered pager is crawled and filtered here instead.
 *
 * Capture is separated from interpretation: pages land verbatim under
 * `.va-guides/pages/` (ignored) and the parse is a pure function of those
 * bytes, written to `.va-guides/guides.json` (committed).
 *
 *   node scripts/captureVirginiaTransferGuides.js
 *   node scripts/captureVirginiaTransferGuides.js --parse-only
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const run = promisify(execFile);
const SERVER = path.resolve(__dirname, '..');
const ROOT = path.join(SERVER, '.va-guides');
const PAGES = path.join(ROOT, 'pages');
const SOURCE = 'https://www.transfervirginia.org';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126 Safari/537.36';

/** Guides in scope: computer science proper, plus the adjacent computing majors. */
const IN_SCOPE = /computer science|computing|cyber|information technology|data science/i;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const clean = (s) => String(s ?? '')
  .replace(/&nbsp;| /g, ' ')
  .replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&ndash;|&mdash;/g, '-')
  .replace(/\s+/g, ' ')
  .trim();
const strip = (s) => clean(String(s ?? '').replace(/<[^>]+>/g, ' '));

// A row that names a general-education CATEGORY rather than specific courses.
// Every VCCS college teaches the UCGS general-education blocks, so these are
// satisfiable by construction — but they are flagged, never silently counted,
// so a reader can see how much of a coverage figure is assumption.
const CATEGORY = new RegExp(
  '\\bany\\s+ucgs\\b|\\bucgs\\b'
  + '|^\\s*(world\\s+languages?|foreign\\s+language|second\\s+natural\\s+science'
  + '|any\\s+(social\\s+science|art\\s+or\\s+humanities|natural\\s+science))', 'i',
);
// Structural rows: credit totals and "fill the rest with electives" padding.
// These are not requirements and must not land in a denominator.
const FILLER = new RegExp(
  '^\\s*(pre-transfer|post-transfer|credits?\\s+pre-transfer|total'
  + '|if needed|electives?( as needed| to reach|,)|select (from|course from) previous'
  + '|additional courses|prerequisites or electives|general electives)', 'i',
);

function options(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : null;
  };
  return {
    parseOnly: argv.includes('--parse-only'),
    refresh: argv.includes('--refresh'),
    delayMs: Number(get('--delay') || 1500),
    maxPages: Number(get('--max-pages') || 40),
  };
}

async function fetchPage(url, file, opts) {
  if (!opts.refresh && fs.existsSync(file) && fs.statSync(file).size > 1200) {
    return fs.readFileSync(file, 'utf8');
  }
  if (opts.parseOnly) throw new Error(`missing cached page: ${file}`);
  const { stdout } = await run('curl', ['-sS', '-L', '--max-time', '45', '-A', UA, url],
    { maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(file, stdout);
  await sleep(opts.delayMs);
  return stdout;
}

/**
 * Expand a requirement cell into VCCS course codes.
 *
 * The prefix is **sticky**: guides write "HIST 101, 102, 111, or 112", so a
 * bare three-digit number inherits the last prefix seen. Without that the cell
 * yields one course and three orphan integers, and a four-way choice reads as
 * a single required course.
 */
function expandCodes(text) {
  const codes = [];
  let prefix = null;
  const token = /([A-Z]{2,4})\s*-?\s*(\d{3})|(?<![A-Z0-9])(\d{3})(?![0-9])/g;
  for (const match of String(text).matchAll(token)) {
    if (match[1]) {
      prefix = match[1].toUpperCase();
      codes.push(`${prefix}${match[2]}`);
    } else if (prefix) {
      codes.push(`${prefix}${match[3]}`);
    }
  }
  return [...new Set(codes)];
}

function tableRows(html) {
  const rows = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/**
 * Reduce one guide page to its community-college requirement rows.
 *
 * A guide is two stacked tables sharing one `<table>`: the CC plan, then a
 * "Complete at <University>" section listing what remains after transfer. Only
 * the first half is a transfer requirement; the second half is the rest of the
 * bachelor's degree and always totals the same 60 credits, so it is not stored.
 */
function parseGuide(html, meta) {
  const rows = tableRows(html);
  let start = null;
  let end = rows.length;
  for (let i = 0; i < rows.length; i += 1) {
    const joined = rows[i].join(' ').toLowerCase();
    if (start === null
      && (joined.includes('complete at a virginia community college')
        || joined.startsWith('community college course'))) {
      start = i + 1;
    } else if (start !== null
      && (/^complete at /i.test(rows[i][0]) || /^pre-transfer/i.test(rows[i][0]))) {
      end = i;
      break;
    }
  }

  // The guide states its own credit totals ("Pre-Transfer Credits | 60-62").
  // Those are the authoritative denominators for a units-based figure; summing
  // the visible rows instead lands anywhere from 50 to 68 because the elective
  // padding that fills the associate degree is written as prose.
  // Guides state their totals three ways, and missing one silently changes the
  // figure's denominator: "Pre-Transfer Credits | 60-62" puts the number in the
  // second cell, "Credits Pre-Transfer: 60" puts it in the label cell, and
  // William & Mary writes "At least 60", which has no leading digit. Read the
  // first number found in either cell.
  const totalOf = (half) => {
    // Anchored. Unanchored, this matched the elective-padding row "Electives
    // as needed to reach 60 pre-transfer credits", whose own value is 3-7, and
    // Randolph-Macon's denominator became 65 instead of 120 — a 5.4% cell.
    const label = new RegExp(`^\\s*(?:${half}[- ]transfer credits|credits ${half}[- ]transfer)`, 'i');
    const row = rows.find((c) => label.test(c[0] || ''));
    if (!row) return null;
    for (const cell of [row[1], row[0]]) {
      const match = /(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)/.exec(String(cell || ''));
      if (match) return match[1].replace(/\s+/g, '');
    }
    return null;
  };

  const items = [];
  for (const cells of rows.slice(start ?? 0, end)) {
    if (cells.length < 3) continue;
    const [text, credits, equivalent] = cells;
    const notes = cells[3] || '';
    if (!text) continue;
    const codes = expandCodes(text);
    let kind;
    if (FILLER.test(text)) kind = 'filler';
    else if (codes.length > 1) kind = 'course_choice';
    else if (codes.length === 1) kind = 'course';
    else if (CATEGORY.test(text)) kind = 'gened_category';
    else kind = 'unresolved';
    items.push({
      requirement_text: text,
      credits: credits || null,
      equivalent: equivalent || null,
      notes: notes || null,
      cc_codes: codes,
      kind,
      // Satisfiable by construction (every college teaches the UCGS blocks),
      // but recorded as an assumption so coverage figures can separate
      // "verified against a catalogue" from "assumed".
      auto_satisfied: kind === 'gened_category',
      counts_toward_stats: kind !== 'filler',
    });
  }

  // The bachelor-side half, kept because Figure 1's denominator is the whole
  // degree's named work: coursework a community college cannot supply has to
  // stay in the denominator as uncovered, or coverage is measured only over
  // the requirements the guide already decided a transfer student would meet.
  const post = [];
  for (const cells of rows.slice(end + 1)) {
    if (cells.length < 2) continue;
    const [text, credits] = cells;
    if (!text || FILLER.test(text) || /^credits$/i.test(credits || '')) continue;
    // "General Electives", "Computer Science Electives — any courses CS 300+":
    // free-elective padding, excluded from Figure 1 the same way the paper
    // excludes it on the community-college side.
    const elective = /^(general |free |unrestricted )?electives?\b|\belectives?$/i.test(text);
    post.push({
      requirement_text: text,
      credits: credits || null,
      notes: cells[2] || null,
      kind: elective ? 'free_elective' : 'named',
      // Named bachelor-side work is university-only by construction here: it
      // sits after the transfer point, so no community college supplies it.
      counts_toward_stats: !elective,
    });
  }

  return {
    ...meta,
    rows: rows.length,
    totals: {
      pre_transfer_raw: totalOf('pre'),
      post_transfer_raw: totalOf('post'),
    },
    cc_items: items,
    post_items: post,
  };
}

/** Crawl the unfiltered resources pager and keep the in-scope transfer guides. */
async function discover(opts) {
  const found = new Map();
  for (let page = 0; page < opts.maxPages; page += 1) {
    const file = path.join(PAGES, `resources-p${page}.html`);
    const html = await fetchPage(`${SOURCE}/resources?page=${page}`, file, opts);
    const before = found.size;
    let any = false;
    for (const link of html.matchAll(/href="(\/content\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      any = true;
      const title = strip(link[2]);
      if (!title || !/transfer guide/i.test(title) || !IN_SCOPE.test(title)) continue;
      if (!found.has(link[1])) found.set(link[1], title);
    }
    if (!any) break;
    if (found.size === before && page > 3 && !any) break;
  }
  return found;
}

async function main() {
  const opts = options(process.argv.slice(2));
  fs.mkdirSync(PAGES, { recursive: true });

  const found = await discover(opts);
  console.log(`in-scope transfer guides discovered: ${found.size}`);

  const guides = [];
  for (const [href, title] of [...found].sort()) {
    const slug = href.replace('/content/', '');
    const file = path.join(PAGES, `guide-${slug}.html`);
    const html = await fetchPage(`${SOURCE}${href}`, file, opts);
    const guide = parseGuide(html, { slug, title, source_url: `${SOURCE}${href}` });
    guides.push(guide);
    const counted = guide.cc_items.filter((i) => i.counts_toward_stats).length;
    const auto = guide.cc_items.filter((i) => i.auto_satisfied).length;
    console.log(`  ${String(counted).padStart(3)} req (${String(auto).padStart(2)} assumed)  ${title}`);
  }

  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'guides.json'), `${JSON.stringify({
    source: SOURCE,
    captured_at: new Date().toISOString(),
    guides,
  }, null, 1)}\n`);

  const items = guides.flatMap((g) => g.cc_items);
  const counted = items.filter((i) => i.counts_toward_stats);
  console.log(`\nguides ${guides.length} | rows ${items.length} | requirements ${counted.length}`
    + ` | assumed ${counted.filter((i) => i.auto_satisfied).length}`
    + ` | distinct VCCS codes ${new Set(items.flatMap((i) => i.cc_codes)).size}`);
  console.log(`wrote ${ROOT}/guides.json`);
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = { expandCodes, parseGuide, tableRows };
