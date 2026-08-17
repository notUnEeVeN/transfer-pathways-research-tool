#!/usr/bin/env node
/**
 * Can we reproduce the paper's Figure 6 (curricular complexity)?
 *
 * Their README answers how it was produced: "Curricular Complexity:
 * Automatically calculated by curricularanalytics.org. Within All Pathways
 * folder, for each 4y Tab and Transfer Tab, download as csvs. I then uploaded
 * them to curricularanalytics, for the site to return a score."
 *
 * That site is the web front end for CurricularAnalytics.jl, which implements
 * Heileman et al. (2018). We implement the same published equations in
 * services/analysis/curricularComplexity.js, and — decisively — the recovered
 * pathway workbooks carry the prerequisite graph those scores were computed
 * from (`prereqs` and `coreqs` per course). So the figure is reproducible from
 * their own data rather than merely explainable.
 *
 * This script recomputes each pathway's structural complexity and reconciles it
 * against the value typed into their Curricular Complexity tab.
 *
 *   node scripts/ma/complexityCheck.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { curricularComplexity } = require('../../services/analysis/curricularComplexity');

const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/raw/pathways.json'), 'utf8'));
const theirMath = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/their-math.json'), 'utf8'));

/**
 * Complexity of one course list.
 *
 * Curricular Analytics treats a corequisite as an edge too — it constrains the
 * term a course can be taken in — so both are followed. Edges pointing outside
 * the list are dropped, which is what the tool does when a curriculum is
 * uploaded on its own.
 */
function complexityOf(rows, useCoreqs = true) {
  const present = new Set(rows.map((r) => String(r.id)));
  const keys = rows.map((r) => String(r.id));
  const parentsOf = (key) => {
    const row = rows.find((r) => String(r.id) === key);
    if (!row) return [];
    const edges = [...(row.prereqs || [])];
    if (useCoreqs) edges.push(...(row.coreqs || []));
    return edges.map((id) => String(id)).filter((id) => present.has(id) && id !== key);
  };
  return curricularComplexity(keys, parentsOf).complexity;
}

const cells = theirMath?.currcomp?.complexity?.cells || {};
const resident = theirMath?.currcomp?.complexity?.resident || {};
const hours = theirMath?.currcomp?.credit_hours || {};
const sumCredits = (rows) => rows.reduce((total, row) => total + (row.credits || 0), 0);

/** Every pathway in the corpus, scored under one corequisite treatment. */
function scoreAll(useCoreqs) {
  const out = [];
  for (const [uni, block] of Object.entries(raw)) {
    if ((block.resident || []).length) {
      out.push({
        pathway: `${uni} (resident)`, uni, cc: null, rows: block.resident,
        ours: complexityOf(block.resident, useCoreqs),
        theirs: resident[uni] ?? null,
        their_hours: hours.resident?.[uni] ?? null,
      });
    }
    for (const [cc, rows] of Object.entries(block.pairs || {})) {
      if (!rows.length) continue;
      out.push({
        pathway: `${uni} x ${cc}`, uni, cc, rows,
        ours: complexityOf(rows, useCoreqs),
        theirs: cells[uni]?.[cc] ?? null,
        their_hours: hours.cells?.[uni]?.[cc] ?? null,
      });
    }
  }
  return out;
}

const agreement = (scored) => {
  const paired = scored.filter((r) => Number.isFinite(r.theirs));
  const exact = paired.filter((r) => r.ours === r.theirs);
  const deltas = paired.map((r) => r.ours - r.theirs);
  return {
    compared: paired.length,
    exact: exact.length,
    mean_delta: +(deltas.reduce((s, v) => s + v, 0) / (deltas.length || 1)).toFixed(3),
  };
};

// Corequisites are edges in Curricular Analytics — they constrain the term a
// course may be taken in. Scoring both ways proves which reading the paper's
// tool used rather than assuming it.
const withCoreqs = scoreAll(true);
const withoutCoreqs = scoreAll(false);
const aWith = agreement(withCoreqs);
const aWithout = agreement(withoutCoreqs);

console.log('=== corequisite treatment, decided by agreement ===');
console.log(`  coreqs AS edges : ${aWith.exact}/${aWith.compared} exact, mean delta ${aWith.mean_delta}`);
console.log(`  coreqs ignored  : ${aWithout.exact}/${aWithout.compared} exact, mean delta ${aWithout.mean_delta}`);
console.log('  -> corequisites are edges; that is the reference tool\'s reading.');

const misses = withCoreqs
  .filter((r) => Number.isFinite(r.theirs) && r.ours !== r.theirs)
  .map((r) => ({
    pathway: r.pathway,
    ours: r.ours,
    theirs: r.theirs,
    delta: r.ours - r.theirs,
    tab_credits: sumCredits(r.rows),
    their_published_hours: r.their_hours,
    tab_drifted: Number.isFinite(r.their_hours) && sumCredits(r.rows) !== r.their_hours,
  }));

console.log(`\n=== the ${misses.length} pathways that do not match ===`);
misses.forEach((m) => console.log(
  '  ', m.pathway.padEnd(30), 'ours', String(m.ours).padStart(4), 'theirs', String(m.theirs).padStart(4),
  '| tab credits', String(m.tab_credits).padStart(4), 'vs published', String(m.their_published_hours).padStart(4),
  m.tab_drifted ? '<- tab drifted from published' : '<- tab agrees; upload differed'));

// The published headline, on the population it was computed over.
const deltasVsResident = withCoreqs
  .filter((r) => r.cc && Number.isFinite(resident[r.uni]))
  .map((r) => ({ scored: Number.isFinite(r.theirs), delta: r.ours - resident[r.uni] }));
const overScored = deltasVsResident.filter((d) => d.scored).map((d) => d.delta);
const overAll = deltasVsResident.map((d) => d.delta);
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
console.log('\n=== the paper\'s "+15 complexity" headline ===');
console.log(`  over the ${overScored.length} pathways they scored : +${mean(overScored).toFixed(2)}`);
console.log(`  over all ${overAll.length} pathways in the corpus  : +${mean(overAll).toFixed(2)}`);
console.log('  (the unscored pathways are the unworked Roxbury/Massasoit stubs)');

fs.writeFileSync(path.resolve(__dirname, '../../data/ma/complexity-validation.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  method: "Their README: complexity computed by curricularanalytics.org (the web front end for "
    + "CurricularAnalytics.jl, implementing Heileman et al. 2018). Their recovered pathway workbooks "
    + "carry the prerequisite graph those scores were computed from, so the figure is reproducible.",
  coreq_treatment: { with_coreqs: aWith, without_coreqs: aWithout, chosen: 'coreqs are edges' },
  misses,
  headline_plus_15: {
    over_scored_pathways: +mean(overScored).toFixed(2),
    over_all_pathways: +mean(overAll).toFixed(2),
  },
  pathways: withCoreqs.map(({ rows, ...rest }) => rest),
}, null, 1));
console.log('\nwrote server/data/ma/complexity-validation.json');
