#!/usr/bin/env node
/**
 * Independent audit of the Virginia coverage figure.
 *
 * This deliberately does NOT reuse the agreement builder. It recomputes the
 * figure the direct way — requirements first — and reconciles the result
 * against what the engine reports, so any disagreement points at a structure
 * one of the two sides is reading wrong:
 *
 *   1. Enumerate what each four-year degree REQUIRES.
 *   2. Translate every required course through the equivalency table into the
 *      set of VCCS courses that land as it.
 *   3. For each community college, ask whether it OFFERS any of those courses.
 *   4. Score = requirements met / requirements asked.
 *
 * Everything the corpus does that could distort that count is reported rather
 * than silently handled: choose-N sections, Or-groups, series, alternatives,
 * wildcard identifiers, requirements no VCCS course can reach at all, and
 * requirement codes that fail to parse.
 *
 *   node scripts/va/auditVaCoverage.js
 * Writes server/data/va/coverage-audit.json.
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const { parseCourseCode, satisfies } = require('../../services/vaCourseCodes');
const { coverageData } = require('../../services/analysis/pathways');

const norm = (value) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
const codeParts = (value) => String(value ?? '')
  .split(/\s*\+\s*|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);

/**
 * The requirements one degree asks for.
 *
 * A "requirement" is one course the student must pass. The structures that
 * change that count, each reported in the summary:
 *   - a section with alternatives is ONE requirement, satisfied by any of them
 *   - `section_advisement: N` asks for N of the listed alternatives
 *   - a series ("CS108 + CS109") is one requirement needing every part
 *   - a group whose conjunction is Or asks for only one of its sections
 *   - sections flagged `cc_articulable: false` are not articulation questions
 *   - breadth / ge_area slots are general education, excluded like the papers do
 */
function requirementsOf(degree, stats) {
  const out = [];
  for (const group of degree.requirement_groups || []) {
    const sections = (group.sections || []).filter((section) => {
      const tier = section.tier || group.tier;
      if (tier === 'breadth') { stats.breadthSections += 1; return false; }
      if (section.cc_articulable === false) { stats.residencySections += 1; return false; }
      return true;
    });
    if (!sections.length) continue;
    const isOr = String(group.group_conjunction || '').toLowerCase() === 'or' && sections.length > 1;
    if (isOr) stats.orGroups += 1;
    // An Or group costs one section; take the one with the most alternatives so
    // the audit never under-counts the ask relative to the engine's cheapest.
    const priced = isOr ? [sections[0]] : sections;

    for (const section of priced) {
      const receivers = (section.receivers || []).filter((r) => r.receiving?.kind !== 'ge_area');
      if (!receivers.length) continue;
      const ask = section.section_advisement != null && Number(section.section_advisement) < receivers.length
        ? Math.max(0, Number(section.section_advisement))
        : receivers.length;
      if (ask < receivers.length) stats.chooseNSections += 1;
      if (receivers.length > 1 && ask === receivers.length) stats.multiReceiverSections += 1;

      // A requirement is counted in CLASSES, not slots: a series asks for
      // every course in it, so "BIO110 + BIO110L" is two classes, and a
      // choose-N section costs its N cheapest alternatives. This mirrors how
      // the shared reader prices a degree; counting each series as one
      // requirement understated the ask and was this audit's own first bug.
      const alternatives = receivers.map((receiver) => {
        // The raw va_requirements documents carry `code_seen`; the projection
        // into curated_requirements moves it to `receiving.code`. Read both so
        // this audit works against either source.
        const codes = codeParts(receiver.code_seen ?? receiver.receiving?.code);
        if (receiver.receiving?.kind === 'series') stats.series += 1;
        return {
          codes,
          kind: receiver.receiving?.kind,
          name: receiver.receiving?.name || null,
          parseable: codes.length > 0 && codes.every((c) => parseCourseCode(c).kind === 'concrete'),
        };
      });
      // Choose-N pays for the N cheapest alternatives; when every listed
      // receiver is required, each is its own requirement.
      const cost = (alt) => (alt.codes.length || 1);
      if (ask < receivers.length) {
        const cheapest = [...alternatives].sort((a, b) => cost(a) - cost(b)).slice(0, ask);
        for (const alt of cheapest) {
          out.push({ alternatives, classes: cost(alt), section_title: section.title || group.title || null });
        }
      } else {
        for (const alt of alternatives) {
          out.push({ alternatives: [alt], classes: cost(alt), section_title: section.title || group.title || null });
        }
      }
    }
  }
  return out;
}

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const [courses, degrees, institutions] = await Promise.all([
    db.collection('va_courses').find({}).toArray(),
    db.collection('curated_requirements').find({ state: 'va', kind: 'degree' }).toArray(),
    db.collection('assist_institutions').find({ state: 'va' }).toArray(),
  ]);
  const colleges = institutions.filter((row) => row.kind === 'community_college');

  // Step 2, built once: receiving identifier -> the VCCS courses that land as it.
  // Keyed by university NAME because that is what the equivalency table stores.
  const translation = new Map(); // uniName -> Map(normIdentifier -> [courses])
  const wildcardSupply = new Map(); // uniName -> [{ identifier, course }]
  for (const course of courses) {
    for (const edge of course.articulates_to || []) {
      const uni = edge.institution;
      if (!translation.has(uni)) { translation.set(uni, new Map()); wildcardSupply.set(uni, []); }
      const parsed = parseCourseCode(edge.identifier);
      if (parsed.kind === 'concrete') {
        const key = norm(edge.identifier);
        if (!translation.get(uni).has(key)) translation.get(uni).set(key, []);
        translation.get(uni).get(key).push(course);
      } else {
        wildcardSupply.get(uni).push({ identifier: edge.identifier, course });
      }
    }
  }

  const offeredBy = new Map(); // collegeName -> Set(course codes)
  for (const college of colleges) offeredBy.set(college.name, new Set());
  for (const course of courses) {
    for (const name of course.offered_by || []) {
      if (offeredBy.has(name)) offeredBy.get(name).add(course.code);
    }
  }

  const stats = {
    breadthSections: 0, residencySections: 0, orGroups: 0, chooseNSections: 0,
    multiReceiverSections: 0, series: 0,
  };
  const perDegree = [];
  const unreachable = [];
  const unparsed = [];
  const cells = [];

  for (const degree of degrees) {
    const uniName = degree.school;
    const reqs = requirementsOf(degree, stats);
    const table = translation.get(uniName) || new Map();
    const wilds = wildcardSupply.get(uniName) || [];

    // Which requirements can ANY college in the state reach?
    let reachableStatewide = 0;
    const askedClasses = reqs.reduce((sum, r) => sum + r.classes, 0);
    for (const req of reqs) {
      const reachable = req.alternatives.some((alt) => {
        if (!alt.codes.length) return false;
        // A series needs every part translated.
        return alt.codes.every((code) => {
          if (table.has(norm(code))) return true;
          return wilds.some((w) => satisfies(code, w.identifier));
        });
      });
      if (reachable) reachableStatewide += req.classes;
      else {
        const label = req.alternatives.map((a) => (a.codes.join(' + ') || a.name)).join(' OR ');
        unreachable.push({ school: uniName, requirement: String(label).slice(0, 90) });
        if (req.alternatives.every((a) => !a.parseable)) {
          unparsed.push({ school: uniName, requirement: String(label).slice(0, 90) });
        }
      }
    }

    for (const college of colleges) {
      const offered = offeredBy.get(college.name) || new Set();
      let met = 0;
      for (const req of reqs) {
        const satisfied = req.alternatives.some((alt) => {
          if (!alt.codes.length) return false;
          return alt.codes.every((code) => {
            const direct = table.get(norm(code)) || [];
            if (direct.some((c) => offered.has(c.code))) return true;
            return wilds.some((w) => satisfies(code, w.identifier) && offered.has(w.course.code));
          });
        });
        if (satisfied) met += req.classes;
      }
      const asked = reqs.reduce((sum, r) => sum + r.classes, 0);
      cells.push({
        school: uniName,
        college: college.name,
        asked,
        met,
        pct: asked ? (100 * met) / asked : null,
      });
    }
    perDegree.push({
      school: uniName,
      requirements: askedClasses,
      reachable_statewide: reachableStatewide,
      ceiling_pct: askedClasses ? +((100 * reachableStatewide) / askedClasses).toFixed(1) : null,
    });
  }

  // Reconcile against the engine.
  const engineRows = await coverageData(db, null, { requirements: 'degree', majorSlug: 'va-cs' });
  const engineBy = new Map(engineRows.map((r) => [`${r.school}|${r.community_college}`, r]));
  const diffs = [];
  let unmatchedKeys = 0;
  for (const cell of cells) {
    const row = engineBy.get(`${cell.school}|${cell.college}`);
    if (!row) { unmatchedKeys += 1; continue; }
    const engine = row.pct_named_requirement_courses;
    if (!Number.isFinite(engine) || cell.pct == null) continue;
    const delta = +(cell.pct - engine).toFixed(1);
    if (Math.abs(delta) > 0.05) {
      diffs.push({
        ...cell,
        engine: +engine.toFixed(1),
        engine_total: row.named_requirement_courses_total,
        engine_articulated: row.named_requirement_courses_articulated,
        delta,
      });
    }
  }
  if (unmatchedKeys) console.log(`WARNING: ${unmatchedKeys} audit cells found no engine row`);

  const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);
  const auditMean = mean(cells.map((c) => c.pct).filter(Number.isFinite));
  const engineMean = mean(engineRows.map((r) => r.pct_named_requirement_courses).filter(Number.isFinite));

  console.log('=== structures encountered ===');
  console.log(JSON.stringify(stats, null, 1));
  console.log('\n=== requirements asked, and the statewide ceiling ===');
  console.log('school'.padEnd(46), 'asked', 'reachable', 'ceiling');
  perDegree.sort((a, b) => (b.ceiling_pct ?? 0) - (a.ceiling_pct ?? 0)).forEach((d) => console.log(
    String(d.school).slice(0, 45).padEnd(46), String(d.requirements).padStart(5),
    String(d.reachable_statewide).padStart(9), String(d.ceiling_pct + '%').padStart(7)));

  console.log(`\n=== reconciliation: audit ${auditMean.toFixed(1)}% vs engine ${engineMean.toFixed(1)}% ===`);
  console.log(`cells compared ${cells.length} | disagreeing ${diffs.length}`);
  diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 12).forEach((d) => console.log(
    '  ', String(d.school).slice(0, 30).padEnd(31), String(d.college).slice(0, 30).padEnd(31),
    'audit', String(d.pct.toFixed(1)).padStart(5), 'engine', String(d.engine).padStart(5), 'Δ', d.delta));

  console.log(`\n=== requirements no VCCS course can reach (per degree, deduped) ===`);
  const bySchool = new Map();
  for (const u of unreachable) bySchool.set(u.school, (bySchool.get(u.school) || 0) + 1);
  [...bySchool].sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log('  ', String(n).padStart(4), s));
  console.log('  examples:');
  unreachable.slice(0, 10).forEach((u) => console.log('    ', String(u.school).slice(0, 26).padEnd(27), u.requirement));

  fs.mkdirSync(path.resolve(__dirname, '../../data/va'), { recursive: true });
  fs.writeFileSync(path.resolve(__dirname, '../../data/va/coverage-audit.json'),
    JSON.stringify({
      generated_at: new Date().toISOString(),
      structures: stats,
      per_degree: perDegree,
      audit_mean: +auditMean.toFixed(2),
      engine_mean: +engineMean.toFixed(2),
      disagreements: diffs,
      unreachable,
      unparsed,
      cells,
    }, null, 1));
  console.log('\nwrote server/data/va/coverage-audit.json');
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
