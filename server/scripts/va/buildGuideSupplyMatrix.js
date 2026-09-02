#!/usr/bin/env node
/**
 * Join Transfer Guides against VCCS course catalogues.
 *
 * The whole analysis reduces to set membership, because VCCS common course
 * numbering means a guide and a college catalogue name the same identifier.
 * A guide row demands `MTH263`; Germanna's catalogue either contains `MTH263`
 * or it does not. No equivalence has to be inferred — the receiving
 * institution already did that work in the guide's own "Course Equivalent"
 * column, which is why this reads guides rather than equivalency tables.
 *
 * Three requirement shapes, evaluated differently:
 *
 *   course          one code; the college must carry it
 *   course_choice   several codes; the college must carry at least one
 *   gened_category  "Any UCGS History"; satisfiable by construction, because
 *                   every VCCS college teaches the general-education blocks
 *
 * The third is an **assumption**, not a measurement, so it is reported on its
 * own line everywhere rather than folded into a single coverage percentage. A
 * reader who wants to discount it can.
 *
 * `--scheduled` narrows supply to courses the college currently has on its
 * schedule. The default is catalogue membership, which is what a transfer plan
 * is actually written against; a course can be catalogued and simply not run
 * this year without the pathway being impossible.
 *
 *   node scripts/va/buildGuideSupplyMatrix.js
 *   node scripts/va/buildGuideSupplyMatrix.js --scheduled --write
 */
const fs = require('node:fs');
const path = require('node:path');

const SERVER = path.resolve(__dirname, '..', '..');
const GUIDES = path.join(SERVER, '.va-guides', 'guides.json');
const CATALOG = path.join(SERVER, '.va-courses', 'catalog');
const OUT = path.join(SERVER, '.va-courses', 'guide-supply-matrix.json');

/**
 * Subject prefixes some guides write in a longer form than VCCS uses.
 *
 * Not a guess: each left-hand prefix appears in **zero** of the 16 catalogues
 * while the right-hand form appears in nearly all of them — MATH263 0/16 vs
 * MTH263 16/16, HIST101 0/16 vs HIS101 16/16, ENGR121 0/16 vs EGR121 15/16.
 * Left unresolved, these read as four requirements no college in Virginia can
 * satisfy, which is how they first surfaced: as a "blocked at all 16 colleges"
 * row for a course every college in fact teaches.
 *
 * Applied only when the literal code is absent everywhere, so a real course
 * can never be rewritten out from under a college that offers it.
 */
const PREFIX_ALIASES = new Map([['ENGR', 'EGR'], ['HIST', 'HIS'], ['MATH', 'MTH']]);

function resolveCode(code, universe) {
  if (universe.has(code)) return code;
  const parts = /^([A-Z]+)(\d.*)$/.exec(code);
  if (!parts) return code;
  const alias = PREFIX_ALIASES.get(parts[1]);
  const candidate = alias ? `${alias}${parts[2]}` : null;
  return candidate && universe.has(candidate) ? candidate : code;
}

function loadColleges({ scheduledOnly }) {
  if (!fs.existsSync(CATALOG)) throw new Error(`missing ${CATALOG}; run captureVccsCourseCatalogs.js`);
  return fs.readdirSync(CATALOG)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const doc = JSON.parse(fs.readFileSync(path.join(CATALOG, f), 'utf8'));
      const courses = scheduledOnly ? doc.courses.filter((c) => c.scheduled) : doc.courses;
      return { slug: doc.slug, name: doc.name, codes: new Set(courses.map((c) => c.code)) };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Can this college satisfy this requirement? */
function evaluate(item, college, universe = college.codes) {
  if (!item.counts_toward_stats) return null;
  if (item.kind === 'gened_category') return { status: 'assumed', matched: null };
  if (item.kind === 'unresolved') return { status: 'unresolved', matched: null };
  const matched = item.cc_codes
    .map((code) => resolveCode(code, universe))
    .filter((code) => college.codes.has(code));
  // A choice row needs one of its options; a single-course row needs the one.
  return matched.length
    ? { status: 'satisfied', matched }
    : { status: 'unsatisfied', matched: [] };
}

function main() {
  const argv = process.argv.slice(2);
  const scheduledOnly = argv.includes('--scheduled');
  const write = argv.includes('--write');

  const { guides } = JSON.parse(fs.readFileSync(GUIDES, 'utf8'));
  const colleges = loadColleges({ scheduledOnly });
  if (!colleges.length) throw new Error('no college catalogues found');

  // Alias resolution is judged against every catalogue, not one college's, so
  // a code counts as "absent" only when no Virginia college teaches it.
  const universe = new Set(colleges.flatMap((c) => [...c.codes]));

  const cells = [];
  for (const guide of guides) {
    for (const college of colleges) {
      const tally = {
        satisfied: 0, unsatisfied: 0, assumed: 0, unresolved: 0,
      };
      const gaps = [];
      for (const item of guide.cc_items) {
        const verdict = evaluate(item, college, universe);
        if (!verdict) continue;
        tally[verdict.status] += 1;
        if (verdict.status === 'unsatisfied') {
          gaps.push({ requirement: item.requirement_text, codes: item.cc_codes });
        }
      }
      const measured = tally.satisfied + tally.unsatisfied;
      cells.push({
        guide: guide.slug,
        guide_title: guide.title,
        college: college.slug,
        college_name: college.name,
        ...tally,
        measured,
        // Coverage over rows we can actually check. The assumed rows are
        // reported beside it, never inside it.
        verified_rate: measured ? tally.satisfied / measured : null,
        gaps,
      });
    }
  }

  const pct = (n) => (n === null ? '  n/a' : `${(100 * n).toFixed(1)}%`);
  const byCollege = new Map();
  for (const cell of cells) {
    if (!byCollege.has(cell.college)) byCollege.set(cell.college, []);
    byCollege.get(cell.college).push(cell);
  }

  console.log(`supply basis: ${scheduledOnly ? 'SCHEDULED courses only' : 'catalogue membership'}`);
  console.log(`${guides.length} guides x ${colleges.length} colleges = ${cells.length} pathway cells\n`);
  console.log('college         guides   avg verified   unsatisfied rows   assumed rows');
  for (const [slug, rows] of [...byCollege].sort()) {
    const avg = rows.reduce((n, r) => n + (r.verified_rate ?? 0), 0) / rows.length;
    const uns = rows.reduce((n, r) => n + r.unsatisfied, 0);
    const asm = rows.reduce((n, r) => n + r.assumed, 0);
    console.log(`${slug.padEnd(14)} ${String(rows.length).padStart(6)}   ${pct(avg).padStart(10)}   `
      + `${String(uns).padStart(14)}   ${String(asm).padStart(12)}`);
  }

  // The requirements that actually block people, ranked.
  const blocked = new Map();
  for (const cell of cells) {
    for (const gap of cell.gaps) {
      const key = gap.codes.join('/') || gap.requirement;
      if (!blocked.has(key)) blocked.set(key, { key, requirement: gap.requirement, count: 0, colleges: new Set() });
      const row = blocked.get(key);
      row.count += 1;
      row.colleges.add(cell.college);
    }
  }
  console.log('\nmost-blocking requirements (cells blocked / colleges lacking it):');
  for (const row of [...blocked.values()].sort((a, b) => b.count - a.count).slice(0, 15)) {
    console.log(`  ${String(row.count).padStart(4)}  ${String(row.colleges.size).padStart(2)} colleges  `
      + `${row.key.slice(0, 46).padEnd(46)}  ${row.requirement.slice(0, 40)}`);
  }

  const totals = {
    satisfied: cells.reduce((n, c) => n + c.satisfied, 0),
    unsatisfied: cells.reduce((n, c) => n + c.unsatisfied, 0),
    assumed: cells.reduce((n, c) => n + c.assumed, 0),
    unresolved: cells.reduce((n, c) => n + c.unresolved, 0),
  };
  const measured = totals.satisfied + totals.unsatisfied;
  console.log(`\nverified coverage: ${totals.satisfied}/${measured} = ${pct(totals.satisfied / measured)}`
    + `  (+${totals.assumed} assumed gen-ed rows, ${totals.unresolved} unresolved)`);

  if (write) {
    fs.writeFileSync(OUT, `${JSON.stringify({
      basis: scheduledOnly ? 'scheduled' : 'catalog',
      built_at: new Date().toISOString(),
      totals,
      cells: cells.map((c) => ({ ...c, gaps: c.gaps.slice(0, 40) })),
    }, null, 1)}\n`);
    console.log(`\nwrote ${OUT}`);
  } else {
    console.log('\n(report only — pass --write to persist the matrix)');
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exit(1); }
}

module.exports = { evaluate, loadColleges };
