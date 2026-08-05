#!/usr/bin/env node
/**
 * Exercise every /va controller against the local database with a stub
 * req/res, so the data path is verified without a signed-in browser session.
 */
const { MongoClient } = require('mongodb');
const va = require('../controllers/Virginia');

const URI = process.argv[2] || 'mongodb://localhost:27017';
const DB = process.argv[3] || 'pmt_research';

function stub(db, { query = {}, params = {} } = {}) {
  const res = {};
  const done = new Promise((resolve) => {
    res.json = (body) => { res.body = body; resolve(body); return res; };
    res.status = (code) => { res.code = code; return res; };
  });
  return { req: { app: { locals: { db } }, query, params }, res, done };
}

const call = async (fn, db, opts) => {
  const { req, res, done } = stub(db, opts);
  await Promise.resolve(fn(req, res, () => {})).catch((e) => { res.json({ error: e.message }); });
  return done;
};

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);
  try {
    const names = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => n.startsWith('va_'));
    console.log('collections:', names.join(', ') || '(none)');
    const idx = await db.collection('va_courses').indexes().catch(() => []);
    console.log('va_courses indexes:', idx.map((i) => i.name).join(', '));
    console.log();

    const s = await call(va.summary, db);
    console.log('GET /va/summary');
    console.log('  ', JSON.stringify(s));
    if (!s.imported) { console.log('\n(not imported yet — run the import)'); return; }

    const inst = await call(va.institutions, db);
    const cc = inst.institutions.filter((i) => i.level === 'community_college');
    const fy = inst.institutions.filter((i) => i.level === 'four_year');
    console.log(`\nGET /va/institutions -> ${inst.institutions.length} (${cc.length} CC, ${fy.length} four-year)`);
    console.log('   top CC by courses:', cc.sort((a, b) => b.course_count - a.course_count).slice(0, 3)
      .map((i) => `${i.name} (${i.course_count})`).join(' · '));
    console.log('   top 4y by accepted:', fy.sort((a, b) => b.receives_count - a.receives_count).slice(0, 3)
      .map((i) => `${i.name} (${i.receives_count})`).join(' · '));

    const dep = await call(va.departments, db);
    console.log(`\nGET /va/departments -> ${dep.departments.length}`);
    console.log('   ', dep.departments.slice(0, 6).map((d) => `${d.department}:${d.courses}`).join(' · '));

    const all = await call(va.courses, db, { query: { limit: 5 } });
    console.log(`\nGET /va/courses -> total ${all.total}, page ${all.courses.length}`);
    all.courses.forEach((c) => console.log(`   ${c.code.padEnd(8)} ${String(c.title).slice(0, 40).padEnd(40)} ${c.counts.offered_by} colleges / ${c.counts.four_year} unis`));

    const filtered = await call(va.courses, db, { query: { receiver: 'George Mason University', limit: 3 } });
    console.log(`\nGET /va/courses?receiver=George Mason University -> ${filtered.total}`);
    filtered.courses.forEach((c) => console.log(`   ${c.code} ${String(c.title).slice(0, 44)}`));

    const one = await call(va.course, db, { params: { code: 'CSC221' } });
    if (one.course) {
      const c = one.course;
      console.log(`\nGET /va/courses/CSC221 -> ${c.code} "${c.title}" ${c.credits}cr`);
      console.log(`   offered_by ${c.offered_by.length} · articulates_to ${c.articulates_to.length} · notes ${c.counts.with_notes}`);
      c.articulates_to.slice(0, 3).forEach((e) => console.log(`     ${e.institution.slice(0, 34).padEnd(34)} ${e.identifier}`));
    } else {
      console.log('\nGET /va/courses/CSC221 ->', JSON.stringify(one));
    }

    const m = await call(va.matrix, db);
    const flat = m.cells.flat();
    console.log(`\nGET /va/matrix -> ${m.colleges.length} colleges × ${m.receivers.length} receivers`);
    console.log(`   cells: max ${Math.max(...flat)} · zero ${flat.filter((v) => !v).length}/${flat.length}`);
  } finally {
    await client.close();
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
