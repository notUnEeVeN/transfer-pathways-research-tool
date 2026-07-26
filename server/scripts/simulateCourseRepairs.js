#!/usr/bin/env node
/**
 * Course-repair simulation for the nine registry Computer Science programs.
 *
 * Answers two questions for the course-anatomy visual set:
 *
 *  1. FATES — for every binding-missing course (a receiver the strict
 *     eligibility engine reports as blocking a path), why is it missing?
 *       A · accepted-for-this-subject-elsewhere: the college holds an
 *           ARTICULATED entry for a same-bucket receiving course at another
 *           campus (or another course at this one) — the sector's own
 *           paperwork shows the college teaches this subject at an accepted
 *           level; this particular agreement just lacks the entry.
 *           Because campuses set different bars, A is tiered by WHO accepted:
 *             A1 — the demanding campus itself accepts another course of this
 *                  college in the same subject (near-proof);
 *             A2 — a campus at least as strict accepts it, strictness being
 *                  the campus's revealed acceptance rate in that subject
 *                  (accepted colleges ÷ colleges whose catalog offers it);
 *             A3 — only laxer campuses accept it (weakest tier).
 *       B · taught-but-never-accepted: no articulation evidence anywhere,
 *           but the college catalog holds a UC-transferable course whose
 *           title matches the subject bucket. Title evidence only.
 *       C · not-taught: neither articulation evidence nor a catalog match.
 *       (unclassified: the receiving course's title matches no bucket, so
 *        the fates cannot be distinguished; counted separately, never
 *        guessed.)
 *     Note a structural discovery from a first draft: "this exact pair is
 *     articulated in another agreement" NEVER happens — ASSIST articulation
 *     is campus-wide per course pair, so pair-level inconsistency across
 *     agreements is impossible. Subject-bucket evidence is the strongest
 *     available standard.
 *
 *  2. REPAIRS — what would fixing a course buy? Each candidate repair sets
 *     the matching receivers' articulation_status to 'articulated', re-runs
 *     the strict engine, and measures the change in the Price of Place
 *     statistics: complete college-program cells, the district access
 *     staircase by income quartile, and the far-poor stratum of the distance
 *     grid. Three candidate shapes:
 *       - one receiving course, patched statewide;
 *       - one subject bucket (the "sequence" unit — e.g. all calculus
 *         receivers), patched statewide;
 *       - the tier-A set: every paperwork-proven missing receiver at its own
 *         college — the "free fixes only" repaired map.
 *     Plus KEYSTONES: incomplete (college, program) cells that a single
 *     course repair would flip to complete.
 *
 * Scope: subject agreements only (nine CS programs × ~115 colleges). The
 * full 120k-agreement corpus is read once, read-only, as the evidence index
 * for fate A. Nothing is written to any database.
 *
 * Output: analysis/data/course_repairs.v1.json + a terminal summary.
 * Usage:  node server/scripts/simulateCourseRepairs.js
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { isMajorArticulable } = require('../services/analysis/eligibility');
const { getMajor, programPairs } = require('../config/majors');
const { bucketOf, courseTypeOf } = require('./lib/courseBuckets');

const OUT_PATH = path.resolve(__dirname, '../../analysis/data/course_repairs.v1.json');
const placeSnapshot = require('../../frontend/src/analyses/priceOfPlaceSnapshot.json');

const REGISTRY_CS = new Set(programPairs(getMajor('cs').programs)
  .map((pair) => `${pair.school_id}|${pair.major}`));
const CS_BUCKETS = new Set(['programming', 'architecture', 'discrete']);
const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const round = (v, d = 3) => (v == null ? null : Number(v.toFixed(d)));
const banner = (title) => console.log(`\n━━ ${title} ${'━'.repeat(Math.max(0, 60 - title.length))}`);

/** Iterate every receiver of an agreement, with its group. */
function* receivers(agreement) {
  for (const g of agreement.requirement_groups || []) {
    for (const s of g.sections || []) {
      for (const r of s.receivers || []) yield { group: g, receiver: r };
    }
  }
}

/**
 * Run `fn` with every not-articulated receiver matching `shouldPatch` given a
 * synthetic articulation, then restore. The engine's articulability check
 * builds a "took everything that articulates" transcript from receiver
 * OPTIONS — so a repair must supply both the status and a synthetic sending
 * course (unique negative id, so it can never collide with a real one).
 */
let syntheticId = -1;
function withPatched(agreements, shouldPatch, fn) {
  const patched = [];
  for (const a of agreements) {
    for (const { receiver } of receivers(a)) {
      if (receiver.articulation_status === 'not_articulated' && shouldPatch(a, receiver)) {
        patched.push({ receiver, options: receiver.options });
        receiver.articulation_status = 'articulated';
        receiver.options = [{ course_ids: [syntheticId], course_conjunction: 'and' }];
        syntheticId -= 1;
      }
    }
  }
  try {
    return fn();
  } finally {
    for (const { receiver, options } of patched) {
      receiver.articulation_status = 'not_articulated';
      receiver.options = options;
    }
  }
}

(async () => {
  const atlas = await MongoClient.connect(process.env.MONGO_URI);
  const local = await MongoClient.connect('mongodb://127.0.0.1:27017');
  try {
    // ══ Phase 0 · context ═════════════════════════════════════════════════
    banner('Phase 0 · load context');

    // College → district, district → income quartile (identical to the Place
    // generator: 72 income-matched districts, quartiles of 18).
    const insts = await atlas.db(process.env.DB_NAME || 'pmt_research')
      .collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { source_id: 1, district: 1 } }).toArray();
    const districtOf = new Map(insts.map((i) => [Number(i.source_id), i.district]));
    const districtIncome = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../analysis/data/district_income.v1.json'), 'utf8'));
    const incomeOf = new Map(Object.entries(districtIncome.districts)
      .map(([n, e]) => [norm(n), e?.catchment?.mean_agi_per_return]));
    const matched = [...new Set([...districtOf.values()])]
      .map((d) => ({ d, income: incomeOf.get(norm(d)) }))
      .filter((x) => Number.isFinite(x.income))
      .sort((a, b) => a.income - b.income);
    const quartileOf = new Map(matched.map((x, i) => [x.d, Math.min(3, Math.floor((i * 4) / matched.length))]));

    // Near/far halves from the committed Place snapshot's tether data, so the
    // distance stratum here means exactly what it means on that page.
    const nearDistrict = new Map(placeSnapshot.distance.tethers
      .map((t) => [t.district, t.km <= placeSnapshot.distance.medianKm]));

    // Receiving-course titles (for names and buckets).
    const ucTitle = new Map();
    for (const c of await local.db('pmt_data').collection('university_courses')
      .find({}, { projection: { parent_id: 1, title: 1, prefix: 1, number: 1 } }).toArray()) {
      ucTitle.set(Number(c.parent_id), c.title || `${c.prefix} ${c.number}`);
    }

    // College catalogs: which subject buckets does each college teach a
    // UC-transferable course in? (Fate B/C evidence.)
    const catalogBuckets = new Map(); // college_id -> Set(bucketId)
    for (const c of await local.db('pmt_data').collection('courses')
      .find({ uc_transferable: true }, { projection: { community_college_id: 1, title: 1 } }).toArray()) {
      const bucket = bucketOf(c.title || '');
      if (!bucket) continue;
      const set = catalogBuckets.get(c.community_college_id) || new Set();
      set.add(bucket.id);
      catalogBuckets.set(c.community_college_id, set);
    }
    console.log(`districts ${matched.length} · UC courses ${ucTitle.size} · colleges with bucketed catalogs ${catalogBuckets.size}`);

    // Transfer demand per (campus, major) — for the cross-major market view.
    const demandByProgram = new Map();
    for (const d of await local.db('pmt_data').collection('uc_major_admissions').find({}).toArray()) {
      const dKey = `${Number(d.uc_school_id)}|${String(d.major || '').replace(/\s+/g, ' ').trim().toLowerCase()}`;
      const applicants = (d.stats || []).reduce((sum, st) => sum + (st.applicants || 0), 0);
      demandByProgram.set(dKey, (demandByProgram.get(dKey) || 0) + applicants);
    }
    const marketPrograms = new Map();

    // ══ Phase 1 · evidence index + subject agreements (one corpus pass) ═══
    banner('Phase 1 · scan full corpus');
    // acceptedBy: "college X has an ARTICULATED entry for some receiving
    // course in bucket Z" → the set of campuses that accepted, with example
    // courses for the validation sample. (Exact-pair evidence is provably
    // vacuous: articulation is campus-wide per course pair, so a pair is
    // either articulated in every agreement that lists it or in none.)
    const courseField = new Map();     // pid -> per-quartile college seen/ok (the arch)
    const acceptedBy = new Map();      // `${college}|${bucketId}` -> Map(campusId -> Set(pid))
    const campusAccepts = new Map();   // `${campusId}|${bucketId}` -> Set(college)
    const campusName = new Map();      // campusId -> short name
    const subject = []; // the nine programs' agreements, held in memory
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { uc_school: 1, uc_school_id: 1, major: 1, community_college_id: 1, requirement_groups: 1 } })
      .batchSize(200);
    let scanned = 0;
    for await (const a of cursor) {
      scanned += 1;
      if (scanned % 20000 === 0) process.stdout.write(`  …${scanned} agreements\r`);
      const college = Number(a.community_college_id);
      const campus = Number(a.uc_school_id);
      if (!campusName.has(campus)) {
        campusName.set(campus, String(a.uc_school || '').replace(/^University of California,\s*/i, ''));
      }
      const collegeQ = quartileOf.get(districtOf.get(college));
      for (const { receiver } of receivers(a)) {
        const anyPid = receiver.receiving?.kind === 'course' ? Number(receiver.receiving.parent_id) : null;
        if (anyPid != null && collegeQ != null) {
          if (!courseField.has(anyPid)) {
            courseField.set(anyPid, {
              seen: [new Set(), new Set(), new Set(), new Set()],
              ok: [new Set(), new Set(), new Set(), new Set()],
            });
          }
          const cf = courseField.get(anyPid);
          cf.seen[collegeQ].add(college);
          if (receiver.articulation_status === 'articulated') cf.ok[collegeQ].add(college);
        }
        if (receiver.articulation_status !== 'articulated') continue;
        const pid = receiver.receiving?.kind === 'course' ? Number(receiver.receiving.parent_id) : null;
        if (pid == null) continue;
        const bucket = bucketOf(ucTitle.get(pid) || '');
        if (!bucket) continue;
        const key = `${college}|${bucket.id}`;
        if (!acceptedBy.has(key)) acceptedBy.set(key, new Map());
        const byCampus = acceptedBy.get(key);
        if (!byCampus.has(campus)) byCampus.set(campus, new Set());
        byCampus.get(campus).add(pid);
        const cKey = `${campus}|${bucket.id}`;
        if (!campusAccepts.has(cKey)) campusAccepts.set(cKey, new Set());
        campusAccepts.get(cKey).add(college);
      }
      if (REGISTRY_CS.has(`${a.uc_school_id}|${a.major}`)
        && Array.isArray(a.requirement_groups) && a.requirement_groups.length
        && quartileOf.has(districtOf.get(college))) {
        subject.push(a);
      }
      const demandKey = `${campus}|${String(a.major).replace(/\s+/g, ' ').trim().toLowerCase()}`;
      if (demandByProgram.has(demandKey) && !/minor/i.test(a.major)
        && Array.isArray(a.requirement_groups) && a.requirement_groups.length) {
        const district = districtOf.get(college);
        const q = quartileOf.get(district);
        if (q != null) {
          const mKey = `${campus}|${a.major}`;
          if (!marketPrograms.has(mKey)) {
            marketPrograms.set(mKey, {
              campus, major: a.major,
              seen: [new Set(), new Set(), new Set(), new Set()],
              complete: [new Set(), new Set(), new Set(), new Set()],
            });
          }
          const mp = marketPrograms.get(mKey);
          mp.seen[q].add(district);
          if (isMajorArticulable(a, true)) mp.complete[q].add(district);
        }
      }
    }

    // The market view: every demand-matched program's income swing on the
    // stated basis — the only basis the field has. Programs closed everywhere
    // on stated preparation are excluded as unmeasurable (their floors are
    // unknown), never counted as flat.
    const market = (() => {
      const programsOut = []; const excluded = [];
      for (const mp of marketPrograms.values()) {
        const totalSeen = mp.seen.reduce((sum, set) => sum + set.size, 0);
        if (totalSeen < 60) continue;
        const applicants = demandByProgram.get(`${mp.campus}|${mp.major.replace(/\s+/g, ' ').trim().toLowerCase()}`);
        const q1 = mp.complete[0].size / Math.max(1, mp.seen[0].size);
        const q4 = mp.complete[3].size / Math.max(1, mp.seen[3].size);
        const overall = mp.complete.reduce((sum, set) => sum + set.size, 0) / totalSeen;
        const row = {
          major: mp.major.trim(),
          campus: campusName.get(mp.campus) || String(mp.campus),
          cs: REGISTRY_CS.has(`${mp.campus}|${mp.major}`),
          applicants,
          q1: round(q1), q4: round(q4), swing: round(q4 - q1),
        };
        if (overall === 0) excluded.push(row);
        else programsOut.push(row);
      }
      programsOut.sort((x, y) => y.applicants - x.applicants);
      excluded.sort((x, y) => y.applicants - x.applicants);
      return {
        programs: programsOut,
        excludedCount: excluded.length,
        excludedTop: excluded.slice(0, 6).map((r) => ({ major: r.major, campus: r.campus, applicants: r.applicants })),
      };
    })();
    console.log(`  scanned ${scanned} agreements · college-bucket evidence keys ${acceptedBy.size} · subject agreements ${subject.length}`);

    // Revealed strictness: a campus's acceptance rate in a bucket = colleges
    // it accepts ÷ colleges whose catalog offers the subject. Lower = stricter.
    const offering = new Map(); // bucketId -> count of colleges teaching it
    for (const set of catalogBuckets.values()) {
      for (const b of set) offering.set(b, (offering.get(b) || 0) + 1);
    }
    const acceptanceRate = (campus, bucketId) => {
      const teach = offering.get(bucketId) || 0;
      if (!teach) return null;
      const accepts = campusAccepts.get(`${campus}|${bucketId}`);
      return accepts ? accepts.size / teach : null; // null: campus never asks for this subject
    };

    // The arch: every receiving course's articulation level and income swing.
    // Courses near 0% or 100% cannot show gradients (censoring), so the fair
    // CS-vs-everything comparison is made inside the contested band — and the
    // composition (who lives in that band) is the other half of the claim.
    // Basis-independent: articulation status is a raw fact of the corpus.
    const arch = (() => {
      const rows = [];
      for (const [pid, cf] of courseField) {
        const seenTotal = cf.seen.reduce((sum, set) => sum + set.size, 0);
        if (seenTotal < 80) continue;
        const okTotal = cf.ok.reduce((sum, set) => sum + set.size, 0);
        const q1 = cf.ok[0].size / Math.max(1, cf.seen[0].size);
        const q4 = cf.ok[3].size / Math.max(1, cf.seen[3].size);
        const title = (ucTitle.get(pid) || '').trim().slice(0, 60);
        const bucket = bucketOf(title)?.id ?? null;
        rows.push({
          title,
          cs: bucket != null && CS_BUCKETS.has(bucket),
          level: round(okTotal / seenTotal),
          swing: round(q4 - q1),
        });
      }
      const contested = (r) => r.level >= 0.1 && r.level < 0.9;
      const meanSwing = (list) => (list.length
        ? Number((list.reduce((sum, r) => sum + r.swing, 0) / list.length).toFixed(3)) : null);
      const csRows = rows.filter((r) => r.cs);
      const rest = rows.filter((r) => !r.cs);
      return {
        courses: rows,
        summary: {
          csCourses: csRows.length,
          otherCourses: rest.length,
          csContestedShare: round(csRows.filter(contested).length / csRows.length),
          otherContestedShare: round(rest.filter(contested).length / rest.length),
          csContestedSwing: meanSwing(csRows.filter(contested)),
          otherContestedSwing: meanSwing(rest.filter(contested)),
        },
      };
    })();
    console.log(`  arch: ${arch.courses.length} courses · CS contested ${Math.round(arch.summary.csContestedShare * 100)}% vs ${Math.round(arch.summary.otherContestedShare * 100)}%` +
      ` · contested swings +${Math.round(arch.summary.csContestedSwing * 100)} vs +${Math.round(arch.summary.otherContestedSwing * 100)}`);

    // ══ Phase 2 · binding-missing instances and their fates ═══════════════
    banner('Phase 2 · classify the missing courses');
    // An instance = one not-articulated receiver inside a required group the
    // strict engine reports unsatisfied, in one subject agreement.
    const instances = [];
    for (const a of subject) {
      for (const g of a.requirement_groups) {
        if (g.is_required !== true) continue;
        if (isMajorArticulable({ requirement_groups: [g] }, true)) continue; // group satisfied — nothing binding here
        for (const s of g.sections || []) {
          for (const r of s.receivers || []) {
            if (r.articulation_status !== 'not_articulated') continue;
            const pid = r.receiving?.kind === 'course' ? Number(r.receiving.parent_id) : null;
            if (pid == null) continue;
            const college = Number(a.community_college_id);
            const campus = Number(a.uc_school_id);
            const title = ucTitle.get(pid) || `course ${pid}`;
            const bucket = bucketOf(title);
            let fate; let tier = null;
            const evidence = bucket ? acceptedBy.get(`${college}|${bucket.id}`) : null;
            if (!bucket) fate = 'unclassified';
            else if (evidence) {
              fate = 'A';
              const demandRate = acceptanceRate(campus, bucket.id);
              if (evidence.has(campus)) tier = 'A1';
              else if ([...evidence.keys()].some((c) => {
                const r = acceptanceRate(c, bucket.id);
                return r != null && demandRate != null && r <= demandRate;
              })) tier = 'A2';
              else tier = 'A3';
            } else if (catalogBuckets.get(college)?.has(bucket.id)) fate = 'B';
            else fate = 'C';
            instances.push({ college, campus, pid, title, bucket: bucket?.id ?? null, fate, tier, agreement: a });
          }
        }
      }
    }
    const fateCount = { A: 0, A1: 0, A2: 0, A3: 0, B: 0, C: 0, unclassified: 0 };
    for (const i of instances) {
      fateCount[i.fate] += 1;
      if (i.tier) fateCount[i.tier] += 1;
    }
    console.log(`  binding-missing instances ${instances.length} · fates ${JSON.stringify(fateCount)}`);

    // ══ Phase 3 · metrics and repairs ═════════════════════════════════════
    banner('Phase 3 · simulate repairs');

    /**
     * The Price of Place statistics, computed fresh from the (possibly
     * patched) subject agreements:
     *  - completeCells: (college, program) pairs with a complete path
     *  - access[q]: district-level staircase, the fig-3 method — for each
     *    district, complete programs ÷ programs seen there, averaged over
     *    the quartile's districts
     *  - farPoorAccess: program×district access share in the far half of the
     *    poorer 36 districts — the worst cell of the distance grid
     */
    function metrics() {
      const perProgram = new Map(); // program -> Map(district -> {seen, complete})
      let completeCells = 0;
      for (const a of subject) {
        const key = `${a.uc_school_id}|${a.major}`;
        const district = districtOf.get(Number(a.community_college_id));
        const complete = isMajorArticulable(a, true);
        if (complete) completeCells += 1;
        const byDistrict = perProgram.get(key) || new Map();
        const cell = byDistrict.get(district) || { complete: false };
        cell.complete = cell.complete || complete;
        byDistrict.set(district, cell);
        perProgram.set(key, byDistrict);
      }
      const perDistrict = new Map(); // district -> {seen, complete}
      let farPoorSeen = 0; let farPoorComplete = 0;
      for (const byDistrict of perProgram.values()) {
        for (const [district, cell] of byDistrict) {
          const d = perDistrict.get(district) || { seen: 0, complete: 0 };
          d.seen += 1; if (cell.complete) d.complete += 1;
          perDistrict.set(district, d);
          if (quartileOf.get(district) <= 1 && nearDistrict.get(district) === false) {
            farPoorSeen += 1; if (cell.complete) farPoorComplete += 1;
          }
        }
      }
      const access = [0, 1, 2, 3].map((q) => {
        const shares = [...perDistrict.entries()]
          .filter(([district]) => quartileOf.get(district) === q)
          .map(([, d]) => d.complete / d.seen);
        return round(shares.reduce((s, v) => s + v, 0) / shares.length);
      });
      return {
        completeCells,
        access,
        gapQ4Q1: round(access[3] - access[0]),
        farPoorAccess: round(farPoorComplete / farPoorSeen),
      };
    }
    const baseline = metrics();
    console.log(`  baseline: ${JSON.stringify(baseline)}`);

    const delta = (m) => ({
      completeCells: m.completeCells - baseline.completeCells,
      q1Points: Math.round((m.access[0] - baseline.access[0]) * 100),
      gapPoints: Math.round((m.gapQ4Q1 - baseline.gapQ4Q1) * 100), // negative = staircase flattens
      farPoorPoints: Math.round((m.farPoorAccess - baseline.farPoorAccess) * 100),
    });

    // Candidate 1 · each receiving course, patched statewide.
    const byCourse = new Map(); // pid -> instance list
    for (const i of instances) {
      if (!byCourse.has(i.pid)) byCourse.set(i.pid, []);
      byCourse.get(i.pid).push(i);
    }
    const courseRepairs = [];
    let done = 0;
    for (const [pid, list] of byCourse) {
      done += 1;
      process.stdout.write(`  course repairs ${done}/${byCourse.size}\r`);
      const m = withPatched(subject,
        (a, r) => Number(r.receiving?.parent_id) === pid, metrics);
      courseRepairs.push({
        pid,
        title: list[0].title,
        campus: String(list[0].agreement.uc_school || '').replace(/^University of California,\s*/i, ''),
        blockedInstances: list.length,
        fates: ['A', 'B', 'C'].map((f) => list.filter((i) => i.fate === f).length),
        ...delta(m),
      });
    }
    courseRepairs.sort((a, b) => b.q1Points - a.q1Points || b.completeCells - a.completeCells);
    console.log(`  course repairs ${byCourse.size}/${byCourse.size} — done`);

    // Candidate 2 · each bucket (the sequence unit), patched statewide.
    const bucketIds = [...new Set(instances.map((i) => i.bucket).filter(Boolean))];
    const bucketRepairs = bucketIds.map((bucketId, idx) => {
      process.stdout.write(`  bucket repairs ${idx + 1}/${bucketIds.length}\r`);
      const inBucket = instances.filter((i) => i.bucket === bucketId);
      const pids = new Set(inBucket.map((i) => i.pid));
      const m = withPatched(subject,
        (a, r) => pids.has(Number(r.receiving?.parent_id)), metrics);
      return {
        bucket: bucketId,
        name: bucketOf(ucTitle.get([...pids][0]) || '')?.name ?? bucketId,
        courses: pids.size,
        preApprovedShare: round(inBucket.filter((i) => i.fate === 'A').length / inBucket.length),
        ...delta(m),
      };
    }).sort((a, b) => b.q1Points - a.q1Points);
    console.log(`  bucket repairs ${bucketIds.length}/${bucketIds.length} — done`);

    // Candidate 2½ · course-TYPE repairs (finer than buckets: data structures
    // split from introductory programming and so on) — the repair figure's
    // display unit.
    const typeGroups = new Map();
    for (const i of instances) {
      const t = courseTypeOf(i.title);
      if (!t) continue;
      if (!typeGroups.has(t.id)) typeGroups.set(t.id, { name: t.name, list: [] });
      typeGroups.get(t.id).list.push(i);
    }
    const typeRepairs = [...typeGroups.entries()].map(([typeId, g]) => {
      const pids = new Set(g.list.map((i) => i.pid));
      const m = withPatched(subject, (a, r) => pids.has(Number(r.receiving?.parent_id)), metrics);
      return {
        type: typeId,
        name: g.name,
        courses: pids.size,
        preApprovedShare: round(g.list.filter((i) => i.fate === 'A').length / g.list.length),
        ...delta(m),
      };
    }).sort((a, b) => b.completeCells - a.completeCells);

    // The lowest-bar scenario: introductory programming alone — the material
    // every college can unquestionably host — kept as a first-class scenario
    // with FULL metrics, for the staged payoff figure.
    const introGroup = typeGroups.get('intro_programming');
    const introPids = new Set(introGroup ? introGroup.list.map((i) => i.pid) : []);
    const lowestBar = introGroup ? {
      name: 'Introductory programming',
      courses: introPids.size,
      instances: introGroup.list.length,
      preApprovedShare: round(introGroup.list.filter((i) => i.fate === 'A').length / introGroup.list.length),
      ...withPatched(subject, (a, r) => introPids.has(Number(r.receiving?.parent_id)), metrics),
    } : null;

    // Candidate 3 · the repaired map, at two evidence standards: every fate-A
    // fix (full), and only A1/A2 fixes (conservative — evidence from the
    // demanding campus itself or a stricter one). Each fix applies at its own
    // college only. Instance-level patching: a receiver is patched only in
    // the specific agreement where its instance was classified as repairable.
    const repairedMapFor = (keep) => {
      const pairs = new Set(instances.filter(keep)
        .map((i) => `${i.agreement.uc_school_id}|${i.agreement.major}|${i.college}|${i.pid}`));
      return withPatched(subject,
        (a, r) => pairs.has(`${a.uc_school_id}|${a.major}|${Number(a.community_college_id)}|${Number(r.receiving?.parent_id)}`),
        metrics);
    };
    const tierAMap = repairedMapFor((i) => i.fate === 'A');
    const conservativeMap = repairedMapFor((i) => i.tier === 'A1' || i.tier === 'A2');
    console.log(`  full tier-A repaired map: ${JSON.stringify(tierAMap)}`);
    console.log(`  conservative (A1+A2) repaired map: ${JSON.stringify(conservativeMap)}`);

    // Campus ask profiles (beat-4 data): how much each campus requires, how
    // much of it articulates, and how subject-core the ask is.
    const campusProfiles = [];
    {
      const byCampus = new Map();
      for (const a of subject) {
        const campus = Number(a.uc_school_id);
        let required = 0; let articulated = 0; let core = 0;
        for (const g of a.requirement_groups) {
          if (g.is_required !== true) continue;
          for (const s of g.sections || []) {
            for (const r of s.receivers || []) {
              required += 1;
              if (r.articulation_status === 'articulated') articulated += 1;
              const b = r.receiving?.kind === 'course'
                ? bucketOf(ucTitle.get(Number(r.receiving.parent_id)) || '') : null;
              if (b && ['programming', 'architecture', 'discrete'].includes(b.id)) core += 1;
            }
          }
        }
        if (!byCampus.has(campus)) byCampus.set(campus, []);
        byCampus.get(campus).push({ required, articulated, core });
      }
      for (const [campus, rows] of byCampus) {
        const medianOf = (v) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)];
        const total = rows.reduce((s, r) => s + r.required, 0);
        campusProfiles.push({
          campus: campusName.get(campus) || String(campus),
          medianRequired: medianOf(rows.map((r) => r.required)),
          articulatedRate: round(rows.reduce((s, r) => s + r.articulated, 0) / total),
          csCoreShare: round(rows.reduce((s, r) => s + r.core, 0) / total),
        });
      }
      campusProfiles.sort((a, b) => b.medianRequired - a.medianRequired);
    }

    // Census cuts for the figures: blocking instances per subject family
    // (figure 1A) and the top blocking courses with their opens-alone pairing
    // (figure 1B) — same-titled receiving courses at one campus merged for
    // display, keeping the higher count. "Blocks" counts paths the course
    // stands in; "opens" counts cells that flip if it alone is repaired —
    // nearly inverse quantities, which is the panel's finding.
    const census = (() => {
      const byFamily = new Map();
      let unclassifiedCount = 0;
      for (const i of instances) {
        if (!i.bucket) { unclassifiedCount += 1; continue; }
        const name = bucketOf(i.title)?.name ?? i.bucket;
        byFamily.set(name, (byFamily.get(name) || 0) + 1);
      }
      return {
        families: [...byFamily].map(([name, count]) => ({ name, instances: count }))
          .sort((a, b) => b.instances - a.instances),
        unclassified: unclassifiedCount,
      };
    })();
    const blockers = (() => {
      const merged = new Map();
      for (const c of courseRepairs) {
        const key = `${c.campus}|${c.title.trim()}`;
        const row = merged.get(key);
        const preApproved = c.fates[0]; // fate-A instances for this course
        if (!row) {
          merged.set(key, { title: c.title.trim(), campus: c.campus, blocks: c.blockedInstances, opens: c.completeCells, preApproved });
        } else if (c.blockedInstances > row.blocks) {
          row.blocks = c.blockedInstances;
          row.opens = Math.max(row.opens, c.completeCells);
          row.preApproved = preApproved;
        }
      }
      return [...merged.values()].sort((a, b) => b.blocks - a.blocks).slice(0, 6);
    })();
    const bestSingle = [...courseRepairs].sort((a, b) => b.q1Points - a.q1Points)[0];

    // Validation sample: 25 random fate-A instances with their evidence, for
    // a human judgment of whether the equivalences look genuine.
    const collegeName = new Map((await local.db('pmt_data').collection('community_colleges')
      .find({}, { projection: { id: 1, name: 1 } }).toArray()).map((c) => [c.id, c.name]));
    const aInstances = instances.filter((i) => i.fate === 'A');
    const validationSample = [...aInstances].sort(() => Math.random() - 0.5).slice(0, 25)
      .map((i) => ({
        college: collegeName.get(i.college) || String(i.college),
        missing: `${i.title} (${campusName.get(i.campus)})`,
        tier: i.tier,
        evidence: [...(acceptedBy.get(`${i.college}|${i.bucket}`) || new Map())].slice(0, 3)
          .map(([campus, pids]) => `${campusName.get(campus)} accepts: ${[...pids].slice(0, 2)
            .map((pid) => ucTitle.get(pid) || pid).join('; ')}`),
      }));

    // Keystones · incomplete cells that one course repair would complete.
    const keystones = [];
    for (const a of subject) {
      if (isMajorArticulable(a, true)) continue;
      const pids = [...new Set([...receivers(a)]
        .filter(({ receiver }) => receiver.articulation_status === 'not_articulated'
          && receiver.receiving?.kind === 'course')
        .map(({ receiver }) => Number(receiver.receiving.parent_id)))];
      for (const pid of pids) {
        const flips = withPatched([a],
          (_, r) => Number(r.receiving?.parent_id) === pid,
          () => isMajorArticulable(a, true));
        if (flips) {
          keystones.push({
            college: Number(a.community_college_id),
            campus: String(a.uc_school || '').replace(/^University of California,\s*/i, ''),
            pid,
            title: ucTitle.get(pid) || `course ${pid}`,
            fate: instances.find((i) => i.agreement === a && i.pid === pid)?.fate ?? null,
          });
        }
      }
    }
    console.log(`  keystone repairs (one course flips a cell): ${keystones.length}`);

    // ══ Phase 3½ · ingredients: commodities vs bespoke pairings ═══════════
    // The mechanism behind the whole story. Per required receiving course in
    // the subject asks: at what share of colleges is THAT course articulated?
    // Generic requirements (a campus's calculus) are commodities — near-100%
    // everywhere, flat across income. CS-proper requirements are bespoke
    // campus-by-campus pairings — half the rate, and THE income gradient:
    // the Price of Place staircase is the CS-requirement curve.
    banner('Phase 3½ · ingredient rates');
    const collegeQuartile = new Map();
    for (const [cid, d] of districtOf) if (quartileOf.has(d)) collegeQuartile.set(cid, quartileOf.get(d));
    const reqRates = new Map(); // pid -> { title, campus, bucket, seen:Set, ok:Set }
    for (const a of subject) {
      const college = Number(a.community_college_id);
      for (const g of a.requirement_groups) {
        if (g.is_required !== true) continue;
        for (const s of g.sections || []) {
          for (const r of s.receivers || []) {
            const pid = r.receiving?.kind === 'course' ? Number(r.receiving.parent_id) : null;
            if (pid == null) continue;
            if (!reqRates.has(pid)) {
              const title = (ucTitle.get(pid) || '').trim();
              reqRates.set(pid, {
                title,
                campus: String(a.uc_school || '').replace(/^University of California,\s*/i, ''),
                bucket: bucketOf(title)?.id ?? null,
                seen: new Set(),
                ok: new Set(),
              });
            }
            const req = reqRates.get(pid);
            req.seen.add(college);
            if (r.articulation_status === 'articulated') req.ok.add(college);
          }
        }
      }
    }
    const buildIngredients = (rows) => {
      const classified = rows.filter((r) => r.bucket != null);
      const csRows = classified.filter((r) => CS_BUCKETS.has(r.bucket));
      const genRows = classified.filter((r) => !CS_BUCKETS.has(r.bucket));
      const rateOf = (r) => r.ok.size / Math.max(1, r.seen.size);
      const median = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
      const pooled = (list, q) => {
        let ok = 0; let seen = 0;
        for (const r of list) {
          for (const c of r.seen) {
            if (collegeQuartile.get(c) !== q) continue;
            seen += 1; if (r.ok.has(c)) ok += 1;
          }
        }
        return seen ? round(ok / seen) : null;
      };
      return {
        requirements: classified.map((r) => ({
          title: r.title, campus: r.campus, bucket: r.bucket,
          cs: CS_BUCKETS.has(r.bucket), seen: r.seen.size, rate: round(rateOf(r)),
        })).sort((a, b) => a.rate - b.rate),
        summary: {
          csCount: csRows.length,
          genericCount: genRows.length,
          csMedianRate: round(median(csRows.map(rateOf))),
          genericMedianRate: round(median(genRows.map(rateOf))),
        },
        gradient: {
          cs: [0, 1, 2, 3].map((q) => pooled(csRows, q)),
          generic: [0, 1, 2, 3].map((q) => pooled(genRows, q)),
        },
      };
    };
    const ingredients = buildIngredients([...reqRates.values()].filter((r) => r.seen.size >= 30));
    console.log(`  requirements: cs ${ingredients.summary.csCount} (median rate ${ingredients.summary.csMedianRate})` +
      ` · generic ${ingredients.summary.genericCount} (median ${ingredients.summary.genericMedianRate})`);
    console.log(`  gradient cs ${JSON.stringify(ingredients.gradient.cs)} · generic ${JSON.stringify(ingredients.gradient.generic)}`);

    // ══ Phase 4 · the same analysis on the curated-minimums basis ═════════
    // ASSIST-strict treats every stated requirement as binding; the curated
    // minimums are the hand-verified eligibility floor. Both bases ship so
    // the figures can toggle without recomputation. The minimum for a campus
    // is groups of alternative sets; a set is met when every requirement in
    // it has some articulated parent course at the college.
    banner('Phase 4 · curated-minimums basis');
    const minRowsRaw = await atlas.db(process.env.DB_NAME || 'pmt_research')
      .collection('curated_requirements')
      .find({ kind: 'transfer_minimum' })
      .sort({ school_id: 1, group_id: 1, set_id: 1, source_order: 1 }).toArray();
    const minsBySchool = new Map();
    for (const row of minRowsRaw) {
      const sid = Number(row.school_id);
      if (!minsBySchool.has(sid)) minsBySchool.set(sid, { school: row.school, groups: new Map() });
      const m = minsBySchool.get(sid);
      const g = String(row.group_id); const st = String(row.set_id);
      if (!m.groups.has(g)) m.groups.set(g, new Map());
      if (!m.groups.get(g).has(st)) m.groups.get(g).set(st, []);
      const pids = (row.parent_ids || []).map(Number).filter(Number.isFinite);
      const title = pids.length ? (ucTitle.get(pids[0]) || row.receiving_code || 'course') : (row.receiving_code || 'course');
      m.groups.get(g).get(st).push({
        reqId: `${sid}|${g}|${st}|${m.groups.get(g).get(st).length}`,
        pids, title, bucket: bucketOf(title)?.id ?? null,
      });
    }

    // Precompute, per subject agreement, which minimum requirements are met.
    const minAgreements = [];
    for (const a of subject) {
      const m = minsBySchool.get(Number(a.uc_school_id));
      if (!m) continue;
      const articulated = new Set();
      for (const { receiver } of receivers(a)) {
        if (receiver.articulation_status !== 'articulated') continue;
        const receiving = receiver.receiving || {};
        if (receiving.kind === 'course' && receiving.parent_id != null) articulated.add(Number(receiving.parent_id));
        if (receiving.kind === 'series') for (const pid of receiving.parent_ids || []) articulated.add(Number(pid));
      }
      const college = Number(a.community_college_id);
      minAgreements.push({
        college,
        campus: Number(a.uc_school_id),
        campusName: String(a.uc_school || '').replace(/^University of California,\s*/i, ''),
        district: districtOf.get(college),
        groups: [...m.groups.values()].map((sets) => [...sets.values()].map((reqs) =>
          reqs.map((req) => ({ ...req, met: req.pids.some((p) => articulated.has(p)) })))),
      });
    }

    // Completion under an optional patch: a requirement counts as met when it
    // was articulated, or the patch covers it (statewide predicates get the
    // req itself; per-college patches get `${college}|${reqId}` pairs).
    const minComplete = (ag, patched = null) => ag.groups.every((sets) =>
      sets.some((reqs) => reqs.length && reqs.every((r) => r.met
        || (patched && patched(ag, r)))));
    const minMetrics = (patched = null) => {
      const perDistrict = new Map();
      let completeCells = 0; let farPoorSeen = 0; let farPoorComplete = 0;
      for (const ag of minAgreements) {
        const done = minComplete(ag, patched);
        if (done) completeCells += 1;
        const d = perDistrict.get(ag.district) || { seen: 0, ok: 0 };
        d.seen += 1; if (done) d.ok += 1;
        perDistrict.set(ag.district, d);
      }
      // District-level (any college in district) shares, fig-3 method.
      const perProgramDistrict = new Map();
      for (const ag of minAgreements) {
        const key = `${ag.campus}|${ag.district}`;
        const cell = perProgramDistrict.get(key) || { district: ag.district, ok: false };
        cell.ok = cell.ok || minComplete(ag, patched);
        perProgramDistrict.set(key, cell);
      }
      const byDistrict = new Map();
      for (const cell of perProgramDistrict.values()) {
        const d = byDistrict.get(cell.district) || { seen: 0, ok: 0 };
        d.seen += 1; if (cell.ok) d.ok += 1;
        byDistrict.set(cell.district, d);
        if (quartileOf.get(cell.district) <= 1 && nearDistrict.get(cell.district) === false) {
          farPoorSeen += 1; if (cell.ok) farPoorComplete += 1;
        }
      }
      const access = [0, 1, 2, 3].map((q) => {
        const shares = [...byDistrict.entries()].filter(([d]) => quartileOf.get(d) === q)
          .map(([, v]) => v.ok / v.seen);
        return round(shares.reduce((s, v) => s + v, 0) / shares.length);
      });
      return {
        completeCells,
        access,
        gapQ4Q1: round(access[3] - access[0]),
        farPoorAccess: round(farPoorComplete / farPoorSeen),
      };
    };

    // Blocking instances on the floor: for each unsatisfied group, the best
    // set (fewest missing) contributes its missing requirements.
    const minInstances = [];
    for (const ag of minAgreements) {
      for (const sets of ag.groups) {
        if (sets.some((reqs) => reqs.length && reqs.every((r) => r.met))) continue;
        const best = [...sets].sort((x, y) =>
          x.filter((r) => !r.met).length - y.filter((r) => !r.met).length)[0] || [];
        for (const r of best.filter((rr) => !rr.met)) {
          let fate; let tier = null;
          const evidence = r.bucket ? acceptedBy.get(`${ag.college}|${r.bucket}`) : null;
          if (!r.bucket) fate = 'unclassified';
          else if (evidence) {
            fate = 'A';
            const demandRate = acceptanceRate(ag.campus, r.bucket);
            if (evidence.has(ag.campus)) tier = 'A1';
            else if ([...evidence.keys()].some((c) => {
              const rate = acceptanceRate(c, r.bucket);
              return rate != null && demandRate != null && rate <= demandRate;
            })) tier = 'A2';
            else tier = 'A3';
          } else if (catalogBuckets.get(ag.college)?.has(r.bucket)) fate = 'B';
          else fate = 'C';
          minInstances.push({
            college: ag.college, campus: ag.campus, campusName: ag.campusName,
            reqId: r.reqId, title: r.title, bucket: r.bucket, fate, tier,
          });
        }
      }
    }
    const minFates = { A: 0, A1: 0, A2: 0, A3: 0, B: 0, C: 0, unclassified: 0 };
    for (const i of minInstances) { minFates[i.fate] += 1; if (i.tier) minFates[i.tier] += 1; }

    const minCensus = (() => {
      const byFamily = new Map(); let un = 0;
      for (const i of minInstances) {
        if (!i.bucket) { un += 1; continue; }
        const name = bucketOf(i.title)?.name ?? i.bucket;
        byFamily.set(name, (byFamily.get(name) || 0) + 1);
      }
      return {
        families: [...byFamily].map(([name, count]) => ({ name, instances: count }))
          .sort((a, b) => b.instances - a.instances),
        unclassified: un,
      };
    })();

    const minBaseline = minMetrics();
    const minDelta = (m) => ({
      completeCells: m.completeCells - minBaseline.completeCells,
      q1Points: Math.round((m.access[0] - minBaseline.access[0]) * 100),
      gapPoints: Math.round((m.gapQ4Q1 - minBaseline.gapQ4Q1) * 100),
      farPoorPoints: Math.round((m.farPoorAccess - minBaseline.farPoorAccess) * 100),
    });

    // Statewide requirement repairs (the floor's "single course" unit) and
    // bucket repairs; blockers pair blocks-at with opens-alone as before.
    const reqIdsWithInstances = new Map();
    for (const i of minInstances) {
      if (!reqIdsWithInstances.has(i.reqId)) reqIdsWithInstances.set(i.reqId, []);
      reqIdsWithInstances.get(i.reqId).push(i);
    }
    const minCourseRepairs = [];
    for (const [reqId, list] of reqIdsWithInstances) {
      const m = minMetrics((ag, r) => r.reqId === reqId);
      minCourseRepairs.push({
        reqId,
        title: list[0].title.trim(),
        campus: `UC ${list[0].campusName}`.replace(/^UC UC /, 'UC '),
        blocks: new Set(list.map((i) => i.college)).size,
        opens: m.completeCells - minBaseline.completeCells,
        q1Points: Math.round((m.access[0] - minBaseline.access[0]) * 100),
      });
    }
    minCourseRepairs.sort((a, b) => b.q1Points - a.q1Points || b.opens - a.opens);
    const minBlockers = [...minCourseRepairs].sort((a, b) => b.blocks - a.blocks).slice(0, 6)
      .map((r) => ({
        title: r.title,
        campus: r.campus,
        blocks: r.blocks,
        opens: r.opens,
        preApproved: minInstances.filter((i) => i.reqId === r.reqId && i.fate === 'A').length,
      }));
    const minBucketIds = [...new Set(minInstances.map((i) => i.bucket).filter(Boolean))];
    const minBucketRepairs = minBucketIds.map((bucketId) => {
      const m = minMetrics((ag, r) => r.bucket === bucketId);
      const inBucket = minInstances.filter((i) => i.bucket === bucketId);
      return {
        bucket: bucketId,
        name: bucketOf(inBucket[0].title)?.name ?? bucketId,
        courses: new Set(inBucket.map((i) => i.reqId)).size,
        preApprovedShare: round(inBucket.filter((i) => i.fate === 'A').length / inBucket.length),
        q1Points: Math.round((m.access[0] - minBaseline.access[0]) * 100),
        completeCells: m.completeCells - minBaseline.completeCells,
      };
    }).sort((a, b) => b.q1Points - a.q1Points);

    const minTypeGroups = new Map();
    for (const i of minInstances) {
      const t = courseTypeOf(i.title);
      if (!t) continue;
      if (!minTypeGroups.has(t.id)) minTypeGroups.set(t.id, { name: t.name, list: [] });
      minTypeGroups.get(t.id).list.push(i);
    }
    const minTypeRepairs = [...minTypeGroups.entries()].map(([typeId, g]) => {
      const reqIds = new Set(g.list.map((i) => i.reqId));
      const m = minMetrics((ag, r) => reqIds.has(r.reqId));
      return {
        type: typeId,
        name: g.name,
        courses: reqIds.size,
        preApprovedShare: round(g.list.filter((i) => i.fate === 'A').length / g.list.length),
        q1Points: Math.round((m.access[0] - minBaseline.access[0]) * 100),
        gapPoints: Math.round((m.gapQ4Q1 - minBaseline.gapQ4Q1) * 100),
        completeCells: m.completeCells - minBaseline.completeCells,
      };
    }).sort((a, b) => b.completeCells - a.completeCells);

    const minIntroGroup = minTypeGroups.get('intro_programming');
    const minIntroReqIds = new Set(minIntroGroup ? minIntroGroup.list.map((i) => i.reqId) : []);
    const minLowestBar = minIntroGroup ? {
      name: 'Introductory programming',
      courses: minIntroReqIds.size,
      instances: minIntroGroup.list.length,
      preApprovedShare: round(minIntroGroup.list.filter((i) => i.fate === 'A').length / minIntroGroup.list.length),
      ...minMetrics((ag, r) => minIntroReqIds.has(r.reqId)),
    } : null;

    const minTierAPairs = new Set(minInstances.filter((i) => i.fate === 'A')
      .map((i) => `${i.college}|${i.reqId}`));
    const minConsPairs = new Set(minInstances.filter((i) => i.tier === 'A1' || i.tier === 'A2')
      .map((i) => `${i.college}|${i.reqId}`));
    const minTierAMap = minMetrics((ag, r) => minTierAPairs.has(`${ag.college}|${r.reqId}`));
    const minConsMap = minMetrics((ag, r) => minConsPairs.has(`${ag.college}|${r.reqId}`));

    const minKeystones = [];
    for (const ag of minAgreements) {
      if (minComplete(ag)) continue;
      const missing = [...new Set(minInstances
        .filter((i) => i.college === ag.college && i.campus === ag.campus)
        .map((i) => i.reqId))];
      for (const reqId of missing) {
        if (minComplete(ag, (a2, r) => r.reqId === reqId)) {
          minKeystones.push({ college: ag.college, campus: ag.campusName, reqId });
        }
      }
    }

    // Campus floor profiles: the minimal ask (smallest set per group), its
    // articulated share at the median college, and its CS-core share.
    const minCampusProfiles = [];
    {
      const byCampus = new Map();
      for (const ag of minAgreements) {
        const minimalSets = ag.groups.map((sets) => [...sets].sort((x, y) => x.length - y.length)[0] || []);
        const reqs = minimalSets.flat();
        const row = {
          required: reqs.length,
          articulated: reqs.filter((r) => r.met).length,
          core: reqs.filter((r) => ['programming', 'architecture', 'discrete'].includes(r.bucket)).length,
        };
        if (!byCampus.has(ag.campus)) byCampus.set(ag.campus, { name: `UC ${ag.campusName}`, rows: [] });
        byCampus.get(ag.campus).rows.push(row);
      }
      for (const { name, rows } of byCampus.values()) {
        const med = (v) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)];
        const total = rows.reduce((s, r) => s + r.required, 0);
        minCampusProfiles.push({
          campus: name,
          medianRequired: med(rows.map((r) => r.required)),
          articulatedRate: round(rows.reduce((s, r) => s + r.articulated, 0) / total),
          csCoreShare: round(rows.reduce((s, r) => s + r.core, 0) / total),
        });
      }
      minCampusProfiles.sort((a, b) => b.medianRequired - a.medianRequired);
    }

    // Floor ingredients: same commodity/bespoke comparison over the minimum
    // requirements, "articulated" meaning the requirement is met (some parent
    // course articulated) at the college.
    const minReqRates = new Map();
    for (const ag of minAgreements) {
      for (const sets of ag.groups) {
        for (const reqs of sets) {
          for (const r of reqs) {
            if (!minReqRates.has(r.reqId)) {
              minReqRates.set(r.reqId, {
                title: r.title, campus: ag.campusName, bucket: r.bucket,
                seen: new Set(), ok: new Set(),
              });
            }
            const row = minReqRates.get(r.reqId);
            row.seen.add(ag.college);
            if (r.met) row.ok.add(ag.college);
          }
        }
      }
    }
    const minIngredients = buildIngredients([...minReqRates.values()].filter((r) => r.seen.size >= 30));
    console.log(`  floor ingredients: cs median ${minIngredients.summary.csMedianRate} · generic median ${minIngredients.summary.genericMedianRate}` +
      ` · gradient cs ${JSON.stringify(minIngredients.gradient.cs)} generic ${JSON.stringify(minIngredients.gradient.generic)}`);

    const minimums = {
      baseline: { ...minBaseline, totalCells: minAgreements.length },
      fates: { counts: minFates, instances: minInstances.length },
      census: minCensus,
      blockers: minBlockers,
      repairs: {
        buckets: minBucketRepairs,
        types: minTypeRepairs,
        scenarios: { lowestBar: minLowestBar },
        bestSingle: minCourseRepairs.length
          ? { title: minCourseRepairs[0].title, campus: minCourseRepairs[0].campus, q1Points: minCourseRepairs[0].q1Points }
          : null,
        tierARepairedMap: { ...minTierAMap, delta: minDelta(minTierAMap), instancesPatched: minFates.A },
        conservativeRepairedMap: { ...minConsMap, delta: minDelta(minConsMap), instancesPatched: minFates.A1 + minFates.A2 },
      },
      keystones: minKeystones,
      campusProfiles: minCampusProfiles,
      ingredients: minIngredients,
    };
    console.log(`  floor instances ${minInstances.length} · fates ${JSON.stringify(minFates)}`);
    console.log(`  floor baseline ${JSON.stringify(minBaseline)} of ${minAgreements.length} cells`);
    console.log(`  floor tier-A map ${JSON.stringify(minTierAMap)} · conservative ${JSON.stringify(minConsMap)}`);
    console.log(`  floor keystones ${minKeystones.length} · census top ${JSON.stringify(minCensus.families[0])}`);
    const csMarket = market.programs.filter((r) => r.cs);
    const fieldMarket = market.programs.filter((r) => !r.cs);
    const meanSwing = (list) => list.reduce((sum, r) => sum + r.swing, 0) / list.length;
    console.log(`  market: ${market.programs.length} measurable programs (CS ${csMarket.length}) · excluded closed-on-stated ${market.excludedCount}`);
    console.log(`  market mean swing — CS ${Math.round(meanSwing(csMarket) * 100)} pts · field ${Math.round(meanSwing(fieldMarket) * 100)} pts`);

    // ══ Output ════════════════════════════════════════════════════════════
    banner('Write artifact');
    const artifact = {
      dataset_version: 'course-repairs.v1',
      scope: 'nine registry Computer Science programs, strict eligibility engine, 72 income-matched districts',
      method: 'Binding-missing receivers classified by evidence (A: the college holds an articulated entry for a same-bucket receiving course somewhere in the full corpus; B: no articulation evidence but the catalog holds a UC-transferable title-bucket match; C: neither). Exact-pair cross-agreement evidence is structurally impossible — articulation is campus-wide per course pair. Repairs give matching receivers a synthetic articulation option and recompute complete cells, the district access staircase, and the far-poor distance stratum.',
      baseline: { ...baseline, totalCells: subject.length },
      fates: {
        counts: fateCount,
        instances: instances.length,
      },
      census,
      blockers,
      repairs: {
        courses: courseRepairs,
        buckets: bucketRepairs,
        types: typeRepairs,
        scenarios: { lowestBar },
        bestSingle: { title: bestSingle.title.trim(), campus: bestSingle.campus, q1Points: bestSingle.q1Points },
        tierARepairedMap: { ...tierAMap, delta: delta(tierAMap), instancesPatched: fateCount.A },
        conservativeRepairedMap: {
          ...conservativeMap,
          delta: delta(conservativeMap),
          instancesPatched: fateCount.A1 + fateCount.A2,
        },
      },
      campusProfiles,
      keystones,
      validationSample,
      ingredients,
      market,
      arch,
      minimums,
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(artifact, null, 1));
    console.log(`wrote ${OUT_PATH} (${Math.round(fs.statSync(OUT_PATH).size / 1024)} KB)`);

    banner('Summary');
    console.log(`fates: A ${fateCount.A} (A1 ${fateCount.A1} · A2 ${fateCount.A2} · A3 ${fateCount.A3}) · B ${fateCount.B} · C ${fateCount.C} · unclassified ${fateCount.unclassified}`);
    console.log('\ncampus ask profiles (median required · articulated rate · CS-core share):');
    for (const p of campusProfiles) {
      console.log(`  ${p.campus.padEnd(14)} ${String(p.medianRequired).padStart(3)} · ${p.articulatedRate} · ${p.csCoreShare}`);
    }
    console.log('\ntop course repairs by poorest-quartile gain:');
    for (const r of courseRepairs.slice(0, 8)) {
      console.log(`  +${r.q1Points} pts Q1 · +${r.completeCells} cells · ${r.title} (${r.campus}) — blocks ${r.blockedInstances}, fates A/B/C ${r.fates.join('/')}`);
    }
    console.log('\ntop bucket (sequence) repairs:');
    for (const r of bucketRepairs.slice(0, 5)) {
      console.log(`  +${r.q1Points} pts Q1 · +${r.completeCells} cells · ${r.name} (${r.courses} receiving courses)`);
    }
    const t = artifact.repairs.tierARepairedMap;
    const cM = artifact.repairs.conservativeRepairedMap;
    console.log(`\nfull tier-A (${t.instancesPatched} instances): Q1 ${baseline.access[0]} → ${t.access[0]} · gap ${baseline.gapQ4Q1} → ${t.gapQ4Q1} · far-poor ${baseline.farPoorAccess} → ${t.farPoorAccess}`);
    console.log(`conservative A1+A2 (${cM.instancesPatched} instances): Q1 ${baseline.access[0]} → ${cM.access[0]} · gap ${baseline.gapQ4Q1} → ${cM.gapQ4Q1} · far-poor ${baseline.farPoorAccess} → ${cM.farPoorAccess}`);
    console.log('\nvalidation sample (25 fate-A cases for hand-checking) written into the artifact.');
  } finally { await atlas.close(); await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
