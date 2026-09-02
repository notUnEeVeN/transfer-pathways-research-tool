#!/usr/bin/env node
/**
 * Capture the per-college course catalogue for the Virginia community colleges
 * that publish a Computer Science associate degree.
 *
 * Why this source. Course supply used to be read off `va_courses.offered_by`,
 * which is derived from the 2-Year rows on a Transfer Virginia course page.
 * Those rows fan a statewide common-course record out to every college whether
 * or not the college teaches it, so the field claims near-universal supply.
 * Germanna is the cheapest counterexample: the Transfer Virginia course page
 * lists it as carrying ART100, its own VCCS catalogue runs ART101-ART287 and
 * has no ART100 at all. Transfer Virginia's Solr institution facet agrees with
 * the catalogue rather than with its own course page.
 *
 * So supply comes from the VCCS course site instead, which is the system of
 * record for the inventory and is plain server-rendered HTML:
 *
 *   /colleges/<slug>/courses                     subject index
 *   /colleges/<slug>/courses/<CODE>-<SubjectName> one subject's courses
 *
 * A course is a `<dt id="ART-101">` holding the code and title, followed by a
 * `<dd>` carrying description, contact hours and credits. A `<dt>` marked
 * `class="notScheduled"` is **in the catalogue but not currently offered** —
 * captured as a flag rather than dropped, because "listed" and "runnable this
 * year" are different questions and the second one is not what a transfer
 * pathway is planned against.
 *
 * Capture is separated from interpretation on purpose, the same way the
 * catalog scrape is: pages land verbatim under `.va-courses/pages/` (ignored,
 * a transport cache) and the derived catalogue is written to
 * `.va-courses/catalog/<slug>.json` (committed). Re-parsing never re-fetches.
 *
 *   node scripts/captureVccsCourseCatalogs.js              # capture + derive
 *   node scripts/captureVccsCourseCatalogs.js --parse-only # re-derive from cache
 *   node scripts/captureVccsCourseCatalogs.js --colleges gcc,tcc --subjects ART,CSC
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const run = promisify(execFile);
const SERVER = path.resolve(__dirname, '..');
const ROOT = path.join(SERVER, '.va-courses');
const PAGES = path.join(ROOT, 'pages');
const CATALOG = path.join(ROOT, 'catalog');
const SOURCE = 'https://courses.vccs.edu';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126 Safari/537.36';

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const clean = (s) => String(s ?? '')
  .replace(/&nbsp;| /g, ' ')
  .replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();
const strip = (s) => clean(String(s ?? '').replace(/<[^>]+>/g, ' '));

function options(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : null;
  };
  const list = (flag) => (get(flag) || '')
    .split(',').map((v) => v.trim()).filter(Boolean);
  return {
    parseOnly: argv.includes('--parse-only'),
    includeNonCs: argv.includes('--include-non-cs'),
    refresh: argv.includes('--refresh'),
    colleges: list('--colleges'),
    subjects: list('--subjects').map((s) => s.toUpperCase()),
    delayMs: Number(get('--delay') || 1200),
  };
}

/**
 * The colleges to capture.
 *
 * The 16 publishing a CS associate degree come from the existing ledger. The
 * other seven VCCS colleges are listed here so the catalogue can be captured
 * for them too: a college without the credential may still teach the courses a
 * guide names, and whether it does is a question worth being able to answer
 * rather than assume. Their slugs are the ones courses.vccs.edu actually uses —
 * guessing them produced four silent 404s that looked like "no CS programs".
 */
const NON_CS_COLLEGES = [
  { slug: 'dcc', name: 'Danville' },
  { slug: 'escc', name: 'Eastern Shore' },
  { slug: 'mecc', name: 'Mountain Empire' },
  { slug: 'mgcc', name: 'Mountain Gateway' },
  { slug: 'phcc', name: 'Patrick & Henry' },
  { slug: 'rcc', name: 'Rappahannock' },
  { slug: 'svcc', name: 'Southside Virginia' },
];

function csColleges({ includeNonCs = false } = {}) {
  const file = path.join(SERVER, '.va-catalogs', 'cs_offering_colleges.json');
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
    .map((row) => ({ slug: row.slug, name: row.name, offersCs: true }));
  return includeNonCs
    ? [...ledger, ...NON_CS_COLLEGES.map((c) => ({ ...c, offersCs: false }))]
    : ledger;
}

/**
 * Fetch through curl rather than global fetch: several Virginia hosts answer
 * Node's fetch with a TLS error while curl retrieves them first try, and this
 * script should not be the place that discovery gets re-litigated.
 */
async function fetchPage(url, file, { refresh, delayMs }) {
  if (!refresh && fs.existsSync(file) && fs.statSync(file).size > 1200) {
    return fs.readFileSync(file, 'utf8');
  }
  const { stdout } = await run('curl', [
    '-sS', '-L', '--max-time', '45', '-A', UA, url,
  ], { maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(file, stdout);
  await sleep(delayMs);
  return stdout;
}

/** `<a href="/colleges/gcc/courses/ART-Arts">` -> `{ code: 'ART', slug: 'ART-Arts' }`. */
function subjectsFrom(html, collegeSlug) {
  const pattern = new RegExp(
    `href="/colleges/${collegeSlug}/courses/([A-Z&]{2,5}-[A-Za-z0-9&;]+)"`, 'g',
  );
  const seen = new Map();
  for (const match of html.matchAll(pattern)) {
    const slug = match[1];
    const code = slug.split('-')[0].toUpperCase();
    // A course link ("ART101-HistoryOfArt") shares the shape; a subject link
    // never carries digits in its leading segment.
    if (/\d/.test(slug.split('-')[0])) continue;
    if (!seen.has(slug)) seen.set(slug, { code, slug });
  }
  return [...seen.values()];
}

/**
 * Parse one subject page into course records.
 *
 * The list is a definition list: `<dt id="ART-101">` carries the code, title
 * and the notScheduled marker; the `<dd>` that follows carries description,
 * contact hours and credits. Reading the pair together keeps a course whose
 * `<dd>` is missing from silently borrowing the next course's credits.
 */
function parseSubject(html) {
  const main = html.slice(Math.max(0, html.indexOf('<main')));
  const courses = [];
  // Slice on <dt> boundaries rather than matching a dt/dd pair with one
  // expression. A lazy `[\s\S]*?` between them backtracks across an orphaned
  // <dt>, pairing that heading with the NEXT course's <dd> — so a course
  // missing its body silently inherits the following course's credits.
  const starts = [...main.matchAll(/<dt([^>]*)>/g)];
  for (let i = 0; i < starts.length; i += 1) {
    const attrs = starts[i][1];
    const from = starts[i].index;
    const to = i + 1 < starts.length ? starts[i + 1].index : main.length;
    const block = main.slice(from, to);
    const head = (/<dt[^>]*>([\s\S]*?)<\/dt>/.exec(block) || [])[1];
    const body = (/<dd[^>]*>([\s\S]*?)<\/dd>/.exec(block) || [])[1];
    if (head === undefined || body === undefined) continue;
    const id = (/id="([^"]+)"/.exec(attrs) || [])[1] || '';
    const heading = strip(head);
    const parsed = /^([A-Z&]{2,5})\s*-?\s*(\d{2,4}[A-Z]?)\s*-\s*(.*)$/.exec(heading);
    if (!parsed) continue;
    const [, prefix, number, title] = parsed;
    const creditsRaw = strip((/<div class="credits">([\s\S]*?)<\/div>/.exec(body) || [])[1]);
    const credits = (/([\d.]+)(?:\s*-\s*([\d.]+))?/.exec(creditsRaw) || [])[1];
    courses.push({
      // The join key: prefix + number, no space. VCCS common numbering means
      // this is the same identifier a four-year transfer guide names, so
      // "does this college carry the required course" is set membership.
      code: `${prefix}${number}`.toUpperCase(),
      prefix: prefix.toUpperCase(),
      number,
      title: clean(title),
      credits: credits ? Number(credits) : null,
      credits_raw: creditsRaw || null,
      // In the catalogue but not on the current schedule. Kept, not dropped.
      scheduled: !/class="[^"]*notScheduled/.test(attrs),
      contact_hours: strip((/<div class="endtext">([\s\S]*?)<\/div>/.exec(body) || [])[1]) || null,
      description: strip((/<div class="coursedesc">([\s\S]*?)<\/div>/.exec(body) || [])[1]) || null,
      dt_id: id,
    });
  }
  return courses;
}

async function captureCollege(college, opts) {
  const indexFile = path.join(PAGES, `${college.slug}__index.html`);
  const indexUrl = `${SOURCE}/colleges/${college.slug}/courses`;
  const index = opts.parseOnly && fs.existsSync(indexFile)
    ? fs.readFileSync(indexFile, 'utf8')
    : await fetchPage(indexUrl, indexFile, opts);

  let subjects = subjectsFrom(index, college.slug);
  if (opts.subjects.length) {
    subjects = subjects.filter((s) => opts.subjects.includes(s.code));
  }

  const courses = [];
  const failures = [];
  for (const subject of subjects) {
    const file = path.join(PAGES, `${college.slug}__${subject.slug}.html`);
    let html;
    try {
      html = opts.parseOnly && fs.existsSync(file)
        ? fs.readFileSync(file, 'utf8')
        : await fetchPage(`${SOURCE}/colleges/${college.slug}/courses/${subject.slug}`, file, opts);
    } catch (error) {
      failures.push({ subject: subject.slug, error: error.message });
      continue;
    }
    const parsed = parseSubject(html);
    if (!parsed.length) failures.push({ subject: subject.slug, error: 'no courses parsed' });
    courses.push(...parsed);
  }

  const byCode = new Map();
  for (const course of courses) if (!byCode.has(course.code)) byCode.set(course.code, course);
  const unique = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));

  return {
    slug: college.slug,
    name: college.name,
    offers_cs: college.offersCs !== false,
    source: indexUrl,
    captured_at: new Date().toISOString(),
    subjects: subjects.length,
    counts: {
      courses: unique.length,
      scheduled: unique.filter((c) => c.scheduled).length,
      not_scheduled: unique.filter((c) => !c.scheduled).length,
      duplicates_collapsed: courses.length - unique.length,
    },
    failures,
    courses: unique,
  };
}

async function main() {
  const opts = options(process.argv.slice(2));
  fs.mkdirSync(PAGES, { recursive: true });
  fs.mkdirSync(CATALOG, { recursive: true });

  let colleges = csColleges({ includeNonCs: opts.includeNonCs });
  if (opts.colleges.length) colleges = colleges.filter((c) => opts.colleges.includes(c.slug));
  console.log(`colleges: ${colleges.length}  (${colleges.map((c) => c.slug).join(', ')})`);

  const summary = [];
  for (const college of colleges) {
    const result = await captureCollege(college, opts);
    fs.writeFileSync(
      path.join(CATALOG, `${college.slug}.json`),
      `${JSON.stringify(result, null, 1)}\n`,
    );
    summary.push({
      slug: result.slug,
      name: result.name,
      subjects: result.subjects,
      ...result.counts,
      failures: result.failures.length,
    });
    console.log(
      `${result.slug.padEnd(12)} subjects=${String(result.subjects).padStart(3)} `
      + `courses=${String(result.counts.courses).padStart(4)} `
      + `scheduled=${String(result.counts.scheduled).padStart(4)} `
      + `notScheduled=${String(result.counts.not_scheduled).padStart(4)} `
      + `failures=${result.failures.length}`,
    );
  }

  // The index describes every catalogue on disk, not just the colleges this
  // run touched. Summarising `summary` instead made a `--colleges gcc` run
  // silently replace a 16-college index with a 1-college one, and the stale
  // totals then flowed into anything reading the index rather than the
  // per-college files.
  const onDisk = fs.readdirSync(CATALOG)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(CATALOG, f), 'utf8')))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  fs.writeFileSync(
    path.join(ROOT, 'index.json'),
    `${JSON.stringify({
      source: SOURCE,
      updated_at: new Date().toISOString(),
      colleges: onDisk.map((doc) => ({
        slug: doc.slug,
        name: doc.name,
        offers_cs: doc.offers_cs !== false,
        captured_at: doc.captured_at,
        subjects: doc.subjects,
        ...doc.counts,
        failures: doc.failures.length,
      })),
      totals: {
        colleges: onDisk.length,
        courses: onDisk.reduce((n, doc) => n + doc.counts.courses, 0),
        scheduled: onDisk.reduce((n, doc) => n + doc.counts.scheduled, 0),
        distinct_codes: new Set(onDisk.flatMap((doc) => doc.courses.map((c) => c.code))).size,
      },
    }, null, 1)}\n`,
  );
  console.log(`\nwrote ${CATALOG}/<slug>.json and ${ROOT}/index.json (${onDisk.length} colleges on disk)`);
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = { subjectsFrom, parseSubject, csColleges };
