#!/usr/bin/env node
/**
 * Check every four-year degree document against the modelling standard.
 *
 *   node scripts/auditDegreeStandard.js
 *   node scripts/auditDegreeStandard.js --major cs
 *
 * The standard is in docs/uc-degree-modelling-rules.md. This asks, of each
 * document, the questions that standard implies, and reports where documents
 * disagree with each other rather than only where one disagrees with itself.
 * Cross-major comparability is the point: a figure that means one thing for
 * Biology and another for Computer Science cannot go in the same chart.
 *
 * Two document shapes are in use and both are legitimate. Biology and Economics
 * carry explicit units and mark university-only work with `course_level` plus
 * `cc_articulable`; the computer-science documents are course-count shaped and
 * mark the same fact with `tier: 'nontransferable'`. The budget reads both, so
 * the shapes are reported rather than treated as errors — what matters is
 * whether they produce comparable answers, not whether they look alike.
 */
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');
const { computeTransferBudget } = require('../services/degreeTransferBudget');
const { computeUnitBudget, resolveSectionTier } = require('../services/degreeSlots');

const CAMPUS = Object.freeze({
  79: 'Berkeley', 89: 'Davis', 120: 'Irvine', 117: 'UCLA', 144: 'Merced',
  46: 'Riverside', 7: 'San Diego', 128: 'S Barbara', 132: 'S Cruz',
});
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
const sum = (g) => (g.sections || []).reduce((a, s) => a + Number(s.unit_advisement || 0), 0);

function checks(doc, budget) {
  const out = [];
  const fail = (code, detail) => out.push({ level: 'fail', code, detail });
  const warn = (code, detail) => out.push({ level: 'warn', code, detail });

  // --- the three rules -----------------------------------------------------
  if (!budget.within_total) {
    fail('over_total', `${budget.requirements.stated}u stated against a ${budget.total}u degree`);
  }
  if (budget.cap != null && budget.transferred > budget.cap) {
    fail('over_cap', `${budget.transferred} transfers against a ${budget.cap} cap`);
  }
  if (budget.upper_division_minimum != null && budget.upper_division_shortfall > 0) {
    warn('upper_division_short', `${budget.requirements.upper_division} against a `
      + `${budget.upper_division_minimum} floor; ${budget.upper_division_shortfall} derived`);
  }

  // --- one document, one answer: the two unit readers must agree ----------
  //
  // computeUnitBudget prices the figure denominators; computeTransferBudget
  // prices the coverage heatmap. Both collapse Or groups and resolve tier
  // vocabulary through shared rules, so a disagreement means one of them has
  // drifted — the same document would show different numbers in different
  // charts, which is the one thing these documents exist to prevent.
  const modeled = computeUnitBudget(doc.requirement_groups);
  if (modeled.modeled_units !== budget.requirements.stated) {
    fail('reader_drift', `computeUnitBudget models ${modeled.modeled_units}u where the transfer `
      + `budget states ${budget.requirements.stated}u — the readers disagree about this document`);
  }
  // Closure: stated requirements should account for the whole degree. A gap is
  // elective slack (fine, but say so); an excess breaks comparability.
  if (doc.total_units && modeled.modeled_units < Number(doc.total_units)) {
    warn('under_modeled', `${modeled.modeled_units}u modeled of ${doc.total_units}u — the remainder `
      + 'is read as free elective');
  }

  // --- section tiers must agree with their group ---------------------------
  //
  // A group marked university-only is university-only in its entirety; a
  // section saying otherwise beneath it is editor residue that once reported
  // Berkeley MCB's whole upper division as lower division. The repair is
  // scripts/repairDegreeSectionTiers.js.
  for (const g of doc.requirement_groups || []) {
    for (const s of g.sections || []) {
      if (s.tier != null && s.tier !== resolveSectionTier(g, s)) {
        fail('section_tier_contradiction', `"${String(g.title || '').slice(0, 40)}" carries a section `
          + `tier '${s.tier}' under a group resolving '${resolveSectionTier(g, s)}'`);
      }
    }
  }

  // --- campus constants, so the rules can be applied at all ----------------
  if (!doc.total_units) fail('no_total_units', 'the degree states no unit minimum');
  if (!doc.unit_system) warn('no_unit_system', 'calendar inferred from the unit total');
  if (!doc.transfer_unit_cap) warn('cap_inferred', 'transfer cap not stored; taken from the calendar');
  if (doc.upper_division_minimum === undefined) {
    warn('no_upper_floor', 'no upper-division minimum recorded — confirm the campus states none');
  }

  // --- the year the articulation data describes ---------------------------
  // '2025-2026' and '2025-26' are the same cohort written two ways.
  const cohort = String(doc.catalog_year || '').replace(/^(20\d{2})-20(\d{2})$/, '$1-$2');
  if (doc.catalog_year && !cohort.startsWith('2025-26')) {
    warn('catalog_year_skew', `pinned to ${doc.catalog_year}; the agreements are 2025-26`);
  }

  // --- general education ---------------------------------------------------
  const geGroups = (doc.requirement_groups || []).filter((g) => /general education|breadth|\bGE\b/i.test(g.title)
    && g.cc_articulable !== false && !/^upper/.test(g.course_level || ''));
  const geUnits = geGroups.reduce((a, g) => a + sum(g), 0);
  const quarter = (doc.unit_system || (Number(doc.total_units) >= 150 ? 'quarter' : 'semester')) === 'quarter';
  const ceiling = quarter ? 51 : 34;
  if (geUnits > ceiling) {
    fail('ge_above_pattern', `${geUnits}u of general education against a ${ceiling}u certification `
      + 'pattern — this is usually the campus’s native requirement, which a certified transfer never faces');
  }
  if (geGroups.length && typeof doc.ge_model === 'string') {
    warn('ge_model_unstructured', 'ge_model is prose; the overlap is not recorded as data');
  }
  if (geGroups.length && !doc.ge_model) warn('ge_model_missing', 'no ge_model recorded');

  // --- choices priced on paths that exist ---------------------------------
  for (const g of doc.requirement_groups || []) {
    const isChoice = String(g.group_conjunction || '').toLowerCase() === 'or' && (g.sections || []).length > 1;
    if (!isChoice) continue;
    const withReach = g.sections.filter((s) => s.articulation_reach != null).length;
    if (!withReach) {
      warn('choice_without_reach', `"${g.title.slice(0, 40)}" offers ${g.sections.length} paths with `
        + 'no articulation reach, so the budget cannot tell a real option from a dead one');
    }
  }

  // --- a flattened choice: alternatives concatenated into a take-all list ---
  //
  // A section with several receivers and a section_advisement below the
  // receiver count is a legitimate "choose N" encoding — UCSB's two chemistry
  // lab routes sit as two series receivers in a choose-1 section, and a course
  // shared between routes duplicates across receivers by design. The defect is
  // only when a single receiver repeats a course, or when a take-all section
  // does: then the document literally asks for the same course twice, which is
  // how UCSC's fifteen-entry mathematics list was built.
  for (const g of doc.requirement_groups || []) {
    if (String(g.group_conjunction || '').toLowerCase() === 'or') continue;
    for (const s of g.sections || []) {
      const receivers = s.receivers || [];
      const perReceiver = receivers.map((r) => (r.receiving?.kind === 'series'
        ? (r.receiving.parent_ids || []) : [r.receiving?.parent_id]).filter((x) => x != null));
      for (const ids of perReceiver) {
        const dupes = ids.length - new Set(ids.map(Number)).size;
        if (dupes > 0) {
          fail('flattened_choice', `"${g.title.slice(0, 36)}" repeats ${dupes} course(s) inside one `
            + 'receiver — alternatives concatenated into a single series');
        }
      }
      const ask = Number(s.section_advisement);
      const isChoice = Number.isFinite(ask) && ask < receivers.length;
      if (!isChoice && receivers.length > 1) {
        const all = perReceiver.flat();
        const dupes = all.length - new Set(all.map(Number)).size;
        if (dupes > 0) {
          fail('flattened_choice', `"${g.title.slice(0, 36)}" repeats ${dupes} course(s) across a `
            + 'take-all section — alternatives concatenated into a list');
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
  const wanted = arg('major');
  const docs = (await db.collection('curated_requirements').find({ kind: 'degree' }).toArray())
    .filter((d) => !wanted || d.major_slug === wanted)
    .sort((a, b) => String(a.major_slug).localeCompare(String(b.major_slug))
      || String(CAMPUS[a.school_id]).localeCompare(String(CAMPUS[b.school_id])));

  const shapes = new Map();
  let fails = 0;
  let warns = 0;

  console.log('doc                campus      shape    total  transf  atUC   binding');
  for (const doc of docs) {
    const budget = computeTransferBudget(doc);
    const unitBearing = (doc.requirement_groups || []).filter((g) => sum(g) > 0).length;
    const shape = unitBearing >= (doc.requirement_groups || []).length * 0.6 ? 'units' : 'courses';
    shapes.set(shape, (shapes.get(shape) || 0) + 1);
    console.log(`${String(doc._id).padEnd(19)}${String(CAMPUS[doc.school_id] || '?').padEnd(12)}`
      + `${shape.padEnd(9)}${String(`${budget.requirements.stated}/${budget.total}`).padEnd(7)}`
      + `${String(budget.transferred).padEnd(8)}${String(budget.university.total).padEnd(7)}`
      + `${budget.binding}`);
    for (const c of checks(doc, budget)) {
      if (c.level === 'fail') fails += 1; else warns += 1;
      console.log(`      ${c.level === 'fail' ? 'FAIL' : 'warn'}  ${c.code}: ${c.detail}`);
    }
  }

  console.log(`\n${docs.length} documents — shapes: ${[...shapes].map(([k, v]) => `${v} ${k}`).join(', ')}`);
  console.log(`${fails} failing check(s), ${warns} warning(s)`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
