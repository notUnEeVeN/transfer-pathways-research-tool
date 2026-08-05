#!/usr/bin/env node
/**
 * Land captured UC catalogue prerequisites into `curated_prerequisites`.
 *
 * These are the campus's own published prerequisites, read off its catalogue —
 * not a projected concept template. Records are keyed `university:<parent_id>`
 * so one collection holds both sides of the system: community-college records
 * stay keyed `cc:<course_id>`.
 *
 *   node scripts/importUcPrerequisites.js --dry-run
 *   node scripts/importUcPrerequisites.js
 *
 * The catalogue is the source of truth for what a campus teaches, NOT ASSIST.
 * `assist_courses` only holds courses some community college articulates to, so
 * keying on it would drop 92% of the catalogue — including every upper-division
 * course, which is exactly the part a resident degree pathway is made of. Each
 * record is therefore keyed by campus and course code, with the ASSIST parent id
 * attached where one exists so articulation still joins cleanly.
 *
 * Prerequisite codes resolve against the catalogue too. Codes that resolve to
 * nothing are counted and reported rather than guessed at, because an
 * unresolved prerequisite is a silent hole in a graph.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { parseCatalogPage } = require('../services/uc/parsePrereqs');
const { splitAcalogCourses } = require('../services/uc/acalogRequisites');
const { splitUcrCourses } = require('../services/uc/ucrRequisites');

const ROOT = path.resolve(__dirname, '../.uc-catalogs');
const flag = (name) => process.argv.includes(`--${name}`);

/** "CSE 100", "CSE 0100", "CSE100" and "cse 100" must all be one key. */
const normalizeCode = (code) => String(code || '')
  .toUpperCase()
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^(.*?)\s*(\d{1,4})([A-Z]{0,2})$/, (_, prefix, digits, suffix) =>
    `${prefix.replace(/\s+/g, ' ')} ${String(Number(digits))}${suffix}`);

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  const dryRun = flag('dry-run');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'index.json'), 'utf8'));
  const byCampus = new Map();
  for (const page of index.pages) {
    if (!byCampus.has(page.school_id)) byCampus.set(page.school_id, []);
    byCampus.get(page.school_id).push(page);
  }
  // Acalog catalogues are captured whole rather than per department, so they
  // arrive as one concatenated document instead of index entries.
  // Riverside publishes only a PDF; its extracted text is treated as one document.
  const pdfDir = path.join(ROOT, 'pdf');
  if (fs.existsSync(pdfDir)) {
    for (const file of fs.readdirSync(pdfDir).filter((f) => f.endsWith('.txt'))) {
      const schoolId = Number(path.basename(file, '.txt'));
      if (!byCampus.has(schoolId)) byCampus.set(schoolId, []);
      byCampus.get(schoolId).push({
        school_id: schoolId,
        campus: schoolId === 46 ? 'UC Riverside' : `campus ${schoolId}`,
        prefix: '(whole catalogue)',
        format: 'ucr-pdf',
        url: 'https://documents.ucr.edu/registrar/UCR%20Catalog%202025-2026.pdf',
        file: path.join('pdf', file),
      });
    }
  }
  const acalogDir = path.join(ROOT, 'acalog');
  if (fs.existsSync(acalogDir)) {
    for (const file of fs.readdirSync(acalogDir).filter((f) => f.endsWith('.html'))) {
      const schoolId = Number(path.basename(file, '.html'));
      if (!byCampus.has(schoolId)) byCampus.set(schoolId, []);
      byCampus.get(schoolId).push({
        school_id: schoolId,
        campus: schoolId === 144 ? 'UC Merced' : `campus ${schoolId}`,
        prefix: '(whole catalogue)',
        format: 'acalog-expanded',
        url: 'https://catalog.ucmerced.edu/content.php?catoid=26&navoid=3778',
        file: path.join('acalog', file),
      });
    }
  }

  const summary = [];
  for (const [schoolId, pages] of [...byCampus.entries()].sort((a, b) => a[0] - b[0])) {
    // Every course this campus has in ASSIST, by normalized code.
    const courses = await db.collection('assist_courses')
      .find({ side: 'receiving', university_id: schoolId })
      .project({ parent_id: 1, prefix: 1, number: 1, title: 1, min_units: 1 })
      .toArray();
    const byCode = new Map();
    for (const course of courses) {
      byCode.set(normalizeCode(`${course.prefix} ${course.number}`), course);
    }

    // First pass: every course the catalogue publishes, keyed by its own code.
    const catalogue = new Map();
    let parsed = 0;
    for (const page of pages) {
      const html = fs.readFileSync(path.join(ROOT, page.file), 'utf8');
      let list = [];
      try {
        if (page.format === 'acalog-expanded') list = splitAcalogCourses(html);
        else if (page.format === 'ucr-pdf') list = splitUcrCourses(html);
        else list = parseCatalogPage(page.format, html);
      } catch { continue; }
      for (const course of list) {
        parsed += 1;
        const key = normalizeCode(course.code);
        // A course can appear on more than one department page; keep the entry
        // that actually states prerequisites.
        const prior = catalogue.get(key);
        if (!prior || (!prior.course.requires.length && course.requires.length)) {
          catalogue.set(key, { course, page });
        }
      }
    }

    const records = [];
    let inAssist = 0;
    let edgesKept = 0;
    const unresolved = new Map();
    const keyOf = (code) => `uc:${schoolId}:${normalizeCode(code)}`;

    for (const [key, { course, page }] of catalogue) {
      const assist = byCode.get(key);
      if (assist) inAssist += 1;
      const groups = [];
      const dangling = [];
      for (const alternatives of course.requires) {
        const ids = [];
        for (const code of alternatives) {
          const norm = normalizeCode(code);
          // Resolve against the CATALOGUE, so upper-division chains survive.
          if (catalogue.has(norm)) ids.push(keyOf(norm));
          else {
            dangling.push(code);
            unresolved.set(code, (unresolved.get(code) || 0) + 1);
          }
        }
        if (ids.length) groups.push([...new Set(ids)]);
      }
      edgesKept += groups.length;
      records.push({
        _id: keyOf(key),
        course_id: keyOf(key),
        institution_id: `uc:${schoolId}`,
        university_id: schoolId,
        side: 'receiving',
        course_code: assist ? `${assist.prefix} ${assist.number}` : course.code,
        course_name: course.title || assist?.title || null,
        units: course.units != null ? Number(course.units) : (assist?.min_units ?? null),
        // Present only when a community college articulates to this course; it is
        // the join key into ASSIST, and absent for most upper-division courses.
        parent_id: assist ? Number(assist.parent_id) : null,
        // AND of ORs: every group must be satisfied, any member of one will do.
        prerequisite_groups: groups,
        prerequisite_ids: [...new Set(groups.flat())],
        requisite_text: course.requisite_text || null,
        source: page.url,
        source_format: page.format,
        // A course with no prerequisites is fully resolved, not unreviewed: the
        // catalogue was read and it gates on nothing. `needs_review` is for a
        // course whose stated prerequisites name something the catalogue no
        // longer publishes — usually a retired course kept as a legacy
        // alternative, like UC San Diego's CSE 8B.
        status: dangling.length ? 'needs_review' : 'resolved',
        unresolved_prerequisites: dangling.length ? [...new Set(dangling)] : [],
        updated_at: new Date().toISOString(),
      });
    }
    const resolved = records.length;

    if (!dryRun && records.length) {
      const ops = records.map((doc) => ({
        replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
      }));
      for (let i = 0; i < ops.length; i += 500) {
        await db.collection('curated_prerequisites').bulkWrite(ops.slice(i, i + 500));
      }
    }

    const campus = pages[0]?.campus || schoolId;
    const withEdges = records.filter((r) => r.prerequisite_groups.length).length;
    summary.push({ campus, parsed, resolved, records: records.length, withEdges, edgesKept, unresolved });
    const topUnresolved = [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    console.log(`  ${String(campus).padEnd(18)} parsed ${String(parsed).padStart(5)}`
      + `  courses ${String(resolved).padStart(5)}`
      + `  in ASSIST ${String(inAssist).padStart(4)}`
      + `  with prerequisites ${String(withEdges).padStart(4)}`
      + (topUnresolved.length ? `   unresolved e.g. ${topUnresolved.map(([c, n]) => `${c}×${n}`).join(', ')}` : ''));
  }

  const totals = summary.reduce((a, s) => ({
    resolved: a.resolved + s.resolved, withEdges: a.withEdges + s.withEdges,
  }), { resolved: 0, withEdges: 0 });
  console.log(`\n${dryRun ? '[dry run] ' : ''}${totals.resolved} catalogue courses stored, `
    + `${totals.withEdges} carry published course prerequisites`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
