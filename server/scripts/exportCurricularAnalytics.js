#!/usr/bin/env node
/**
 * Export transfer pathways into the Curricular Analytics CSV interchange format.
 *
 * The MA transfer paper computes its Figure 6 complexity with the authors' own
 * tool at curricularanalytics.org, which is the web front end for
 * CurricularAnalytics.jl. Feeding that tool our pathways lets us report the
 * metric exactly as the paper does, and lets us hold our own live implementation
 * (services/analysis/curricularComplexity.js) to the reference numbers.
 *
 * Format per docs/src/persistence.md in CurricularAnalytics.jl: five header
 * lines, then a `Courses` keyword, then a course table whose Prerequisites
 * column is a semicolon-separated list of Course IDs.
 *
 *   node scripts/exportCurricularAnalytics.js --major cs --out .ca-export
 *
 * Writes one CSV per community college x campus pathway, plus manifest.json
 * carrying our own computed metrics so the Julia run can be diffed against them.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { projectPrereqEdges } = require('../services/prereqGraph');
const { curricularComplexity } = require('../services/analysis/curricularComplexity');
const pathways = require('../services/analysis/pathways');

const agreementMinSetExact = pathways._agreementMinSetExact;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** A CSV field: quote when it carries a comma, quote or newline. */
const cell = (value) => {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * @param {object} meta   curriculum name, institution, degree type, system type
 * @param {object[]} courses  { id, name, prefix, number, prerequisites[], credits }
 */
function toCurriculumCsv(meta, courses) {
  // Ten columns wide throughout, matching the reference example file.
  const pad = (cells) => cells.concat(Array(Math.max(0, 10 - cells.length)).fill('')).join(',');
  const lines = [
    pad(['Curriculum', cell(meta.curriculum)]),
    pad(['Institution', cell(meta.institution)]),
    pad(['Degree Type', cell(meta.degreeType || 'BS')]),
    pad(['System Type', cell(meta.systemType || 'semester')]),
    pad(['CIP', cell(meta.cip || '')]),
    pad(['Courses']),
    pad(['Course ID', 'Course Name', 'Prefix', 'Number', 'Prerequisites',
      'Corequisites', 'Strict-Corequisites', 'Credit Hours', 'Institution', 'Canonical Name']),
  ];
  for (const c of courses) {
    lines.push(pad([
      cell(c.id), cell(c.name), cell(c.prefix), cell(c.number),
      cell((c.prerequisites || []).join(';')), '', '',
      cell(c.credits ?? 3), '', '',
    ]));
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const majorSlug = arg('major', 'cs');
  const outDir = path.resolve(arg('out', '.ca-export'));
  const limit = Number(arg('limit', '0')) || 0;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const prereqsByKey = await projectPrereqEdges(db);
  const courseRows = await db.collection('assist_courses')
    .find({ side: 'sending' })
    .project({ course_id: 1, prefix: 1, number: 1, title: 1, min_units: 1, max_units: 1 })
    .toArray();
  const courseById = new Map(courseRows.map((r) => [Number(r.course_id), r]));

  // `assist_agreements` holds one document per campus x college x MAJOR, so the
  // major has to scope the query and disambiguate the filename. Without it three
  // majors write to the same path and the manifest points at whichever wrote last.
  const majorFilter = arg('major-contains', null);
  const agreements = await db.collection('assist_agreements')
    .find(majorFilter ? { major: new RegExp(majorFilter, 'i') } : {}).toArray();
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = [];
  let written = 0;
  let skippedNoPrereqs = 0;
  for (const doc of agreements) {
    if (limit && written >= limit) break;
    const solved = agreementMinSetExact(doc, () => false, courseById);
    const keys = (solved.courses || []).map((id) => `cc:${id}`);
    if (!keys.length) continue;
    const inSet = new Set(keys);
    const parents = (k) => (prereqsByKey.get(k) || []).filter((p) => inSet.has(p));
    const edgeCount = keys.reduce((n, k) => n + parents(k).length, 0);
    // A pathway with no prerequisite edges has complexity = one per course and
    // tells the comparison nothing. Keep the count, skip the file.
    if (!edgeCount) { skippedNoPrereqs += 1; continue; }

    // Course IDs must be integers in this format; the ASSIST course id already is.
    const idOf = (key) => Number(String(key).replace(/^cc:/, ''));
    const courses = keys.map((key) => {
      const row = courseById.get(idOf(key)) || {};
      return {
        id: idOf(key),
        name: row.title || `Course ${idOf(key)}`,
        prefix: row.prefix || '',
        number: row.number || '',
        prerequisites: parents(key).map(idOf),
        credits: row.min_units ?? row.max_units ?? 3,
      };
    });

    const majorKey = String(doc.major || 'unknown')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const slug = `${doc.uc_school_id}-${doc.community_college_id}-${majorKey}`;
    const file = path.join(outDir, `${slug}.csv`);
    fs.writeFileSync(file, toCurriculumCsv({
      curriculum: `${doc.community_college} to ${doc.school || doc.uc_school_id} — ${doc.major}`,
      institution: doc.community_college || String(doc.community_college_id),
      degreeType: 'AS',
      systemType: 'semester',
    }, courses));

    const ours = curricularComplexity(keys, parents);
    manifest.push({
      file: path.basename(file),
      uc_school_id: doc.uc_school_id,
      community_college_id: doc.community_college_id,
      major: doc.major,
      n_courses: keys.length,
      n_prereq_edges: edgeCount,
      ours: {
        complexity: ours.complexity,
        delay_total: ours.delayTotal,
        blocking_total: ours.blockingTotal,
      },
    });
    written += 1;
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'),
    `${JSON.stringify({
      major_slug: majorSlug,
      generated_from: 'assist_agreements x projected prerequisite concept graph',
      note: 'ours.* are this repo\'s live metrics; run analysis/curricular_analytics.jl to produce theirs and diff.',
      pathways: manifest,
    }, null, 2)}\n`);

  console.log(`wrote ${written} curricula to ${outDir}`);
  console.log(`skipped ${skippedNoPrereqs} pathways with no prerequisite edges in range`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
