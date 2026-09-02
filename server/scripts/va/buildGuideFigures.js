#!/usr/bin/env node
/**
 * Figures 1 and 3 computed from Transfer Guides.
 *
 * The guide is the receiving institution's own statement of what a VCCS
 * student should take and what each course becomes, so the outcome does not
 * have to be inferred from an identifier the way the equivalency tables force.
 * The associate degree here is the guide's community-college half, per the
 * modelling decision to treat the guide's CC side as the student's A.S.
 *
 * Figure 1 — degree coverage. Share of the degree's named work a community
 * college can supply. Denominator is named work across the whole degree: the
 * CC-side rows plus the bachelor-side rows the guide lists after the transfer
 * point. Free-elective padding is excluded from both halves; university-only
 * named work stays in as uncovered, which is why this is not near 100%.
 *
 * General education is COUNTED here, departing from the paper's rule, because
 * that rule is one-sided against this data structure. A transfer guide puts
 * general education at the community college by construction — that is what
 * the 60/60 split is — so excluding it removes 406 units from the covered side
 * and almost nothing from the university side, which is upper-division major
 * work with no general education left in it. Excluding it reports 39.9% for a
 * degree whose own structure implies about half; counting it reports 47.5%,
 * where the shortfall against the structural 49.3% ceiling is exactly the
 * credit denied at transfer. `coverage_units_ex_ge` keeps the paper-faithful
 * number alongside for comparison against California and Massachusetts.
 *
 * Figure 3 — associate-degree credit utilization. Share of the associate
 * degree's own units that land on something specific. Denominator is the sum
 * of the guide's own itemised community-college rows, so applied, lost and
 * indeterminate units sum to the whole; the guide's stated "Pre-Transfer
 * Credits" is carried alongside as `stated_total_units` to show how far
 * range-midpoint arithmetic drifts from the published figure. Numerator is
 * units whose stated equivalent is a named course or a named requirement;
 * elective-only and no-credit units are the loss.
 *
 * Not every guide can answer Figure 1. Some state requirement categories and
 * never a receiving course number — GW's cybersecurity guide says "1 course in
 * English composition" throughout and leaves the computing rows blank. Those
 * are marked `course_level_equivalents: false` and held out of the pooled
 * coverage rate, because a guide that publishes no course-level equivalence
 * has produced no evidence of non-coverage either.
 *
 * Both are reported unit-weighted and count-weighted, because a 4-credit
 * course lost is not the same event as a 1-credit orientation lost, and the
 * two answers differ enough that quoting one silently would be a choice.
 *
 *   node scripts/va/buildGuideFigures.js
 *   node scripts/va/buildGuideFigures.js --write
 */
const fs = require('node:fs');
const path = require('node:path');

const SERVER = path.resolve(__dirname, '..', '..');
const GUIDES = path.join(SERVER, '.va-guides', 'guides.json');
const OUT = path.join(SERVER, '.va-courses', 'guide-figures.json');

/** `3-4` -> 3.5; `7-10` -> 8.5; `3` -> 3. A range is credited at its midpoint. */
function credits(raw) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?/.exec(String(raw ?? ''));
  if (!m) return null;
  const lo = Number(m[1]);
  return m[2] ? (lo + Number(m[2])) / 2 : lo;
}

/** The TOP of a stated credit range: "60-62" -> 62, "60" -> 60. */
function maxCredits(raw) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?/.exec(String(raw ?? ''));
  if (!m) return null;
  return m[2] ? Number(m[2]) : Number(m[1]);
}

const NO_CREDIT = /no transfer credit|does not transfer|not applicable|no credit/i;
// Three OR FOUR digits. UVA, Virginia Tech and UVA-Wise number courses with
// four digits (CS 1110, MATH 1225, MTH 2040); a three-digit-only pattern read
// every one of those as unclassified and pushed those institutions' coverage
// down by counting real named articulations as nothing.
const COURSE_CODE = /\b[A-Z]{2,5}\s?\d{3,4}[A-Z]?\b/;
// Named non-course requirements: a general-education area, a curricular block,
// or an institution's own framework label ("Civitae", "Pathways Concept 2").
const REQUIREMENT = new RegExp(
  'requirement|\\breq\\b|pillar|\\bcore\\b|literacy|curriculum|liberal learning'
  + '|liberal arts|concept|general education|gen ed|foundations|reasoning'
  + '|proficiency|intensive|competency|perspective|humanities|social science'
  + '|natural science|\\bscience\\b|fine arts|\\barts\\b|literature|history'
  + '|world language|foreign language|oral comm|composition|behavior'
  + '|quantitative|scientific|storytelling|diversity|inquiry|creativity'
  + '|study of|thinking like|interpreting the past', 'i',
);
const ELECTIVE = /\belect(ive|ives|\.|s)?\b|\bELT\b|\bXXX\b|\b\dXX\b/i;
// Cells that decline to state an outcome. These are neither applied nor lost —
// counting them either way would invent a verdict the guide withheld.
const INDETERMINATE = /^(any|various|additional courses|additional as req)$|equivalency dependent/i;

/**
 * What does the guide say this course becomes?
 *
 * Order matters. A refusal wins outright. A cell naming a real course number
 * counts as a named course even when it also offers an elective fallback
 * ("Elective / MATH 211"), because the student who takes the right option gets
 * the course — reading that row as elective-only would overstate loss.
 */
function outcome(equivalent) {
  const text = String(equivalent ?? '').trim();
  if (!text) return 'unstated';
  if (NO_CREDIT.test(text)) return 'no_credit';
  if (INDETERMINATE.test(text)) return 'indeterminate';
  if (COURSE_CODE.test(text)) return 'named_course';
  if (REQUIREMENT.test(text)) return 'named_requirement';
  if (ELECTIVE.test(text)) return 'elective_only';
  return 'unclassified';
}

const APPLIED = new Set(['named_course', 'named_requirement']);

function figuresFor(guide) {
  const cc = guide.cc_items.filter((i) => i.counts_toward_stats);
  const rows = cc.map((i) => ({ ...i, outcome: outcome(i.equivalent), units: credits(i.credits) }));

  // ---- Figure 3: associate-degree credit utilization -------------------
  const statedTotal = credits(guide.totals?.pre_transfer_raw);
  const rowUnits = rows.reduce((n, r) => n + (r.units ?? 0), 0);
  // The denominator must be the same rows the numerator draws from, or the
  // parts stop summing to the whole: NSU's itemised rows total 64 units while
  // its stated pre-transfer figure is 61, which reported as 100% applied AND
  // 4.9% lost. The guide's stated total is kept alongside as a check on how
  // far range-midpoint arithmetic drifts from the published number.
  const totalUnits = rowUnits;
  const appliedUnits = rows.filter((r) => APPLIED.has(r.outcome))
    .reduce((n, r) => n + (r.units ?? 0), 0);
  const lostUnits = rows.filter((r) => r.outcome === 'elective_only' || r.outcome === 'no_credit')
    .reduce((n, r) => n + (r.units ?? 0), 0);

  // ---- Figure 1: degree coverage over named work -----------------------
  // GE-style requirements are excluded from Figure 1 on both halves, matching
  // the paper; they are counted in Figure 3, where units are what matter.
  const ccNamed = rows.filter((r) => APPLIED.has(r.outcome));
  const ccNamedCourseOnly = rows.filter((r) => r.outcome === 'named_course');
  const ccNamedMissed = rows.filter(
    (r) => r.outcome === 'elective_only' || r.outcome === 'no_credit',
  );
  const bachelorNamed = (guide.post_items || []).filter((p) => p.counts_toward_stats);

  const coveredCount = ccNamed.length;
  const deniedCount = ccNamedMissed.length;
  const universityOnlyCount = bachelorNamed.length;
  const namedDenomCount = coveredCount + deniedCount + universityOnlyCount;

  const coveredUnits = ccNamed.reduce((n, r) => n + (r.units ?? 0), 0);
  const coveredUnitsExGe = ccNamedCourseOnly.reduce((n, r) => n + (r.units ?? 0), 0);
  const deniedUnits = ccNamedMissed.reduce((n, r) => n + (r.units ?? 0), 0);
  const universityOnlyUnits = bachelorNamed.reduce((n, p) => n + (credits(p.credits) ?? 0), 0);
  const namedDenomUnits = coveredUnits + deniedUnits + universityOnlyUnits;

  // A guide that never names a receiving course cannot evidence coverage in
  // either direction; reporting it as 0% would read as total failure when it
  // is an absence of published detail.
  const courseLevel = ccNamedCourseOnly.length > 0;

  return {
    guide: guide.slug,
    title: guide.title,
    course_level_equivalents: courseLevel,
    figure1: {
      covered_count: coveredCount,
      denied_count: deniedCount,
      university_only_count: universityOnlyCount,
      denominator_count: namedDenomCount,
      coverage_count: namedDenomCount ? coveredCount / namedDenomCount : null,
      covered_units: coveredUnits,
      denied_units: deniedUnits,
      university_only_units: universityOnlyUnits,
      denominator_units: namedDenomUnits,
      coverage_units: namedDenomUnits ? coveredUnits / namedDenomUnits : null,
      // Paper-faithful variant: general education excluded from both halves.
      covered_units_ex_ge: coveredUnitsExGe,
      denominator_units_ex_ge: coveredUnitsExGe + deniedUnits + universityOnlyUnits,
      coverage_units_ex_ge: (coveredUnitsExGe + deniedUnits + universityOnlyUnits)
        ? coveredUnitsExGe / (coveredUnitsExGe + deniedUnits + universityOnlyUnits) : null,
      // What coverage would be if nothing were denied at transfer. The gap
      // between this and coverage_units is the loss, in coverage points.
      coverage_ceiling: (coveredUnits + universityOnlyUnits)
        ? coveredUnits / (coveredUnits + universityOnlyUnits) : null,
    },
    figure3: {
      total_units: totalUnits,
      stated_total_units: statedTotal,
      // How far the itemised rows drift from the guide's published total.
      stated_delta: statedTotal == null ? null : Number((rowUnits - statedTotal).toFixed(1)),
      applied_units: appliedUnits,
      lost_units: lostUnits,
      utilization: totalUnits ? appliedUnits / totalUnits : null,
      loss_rate: totalUnits ? lostUnits / totalUnits : null,
    },
    outcomes: rows.reduce((acc, r) => {
      acc[r.outcome] = (acc[r.outcome] || 0) + 1;
      return acc;
    }, {}),
    unclassified: rows.filter((r) => r.outcome === 'unclassified' || r.outcome === 'unstated')
      .map((r) => r.equivalent),
  };
}

function main() {
  const write = process.argv.includes('--write');
  const { guides } = JSON.parse(fs.readFileSync(GUIDES, 'utf8'));
  const results = guides.map(figuresFor);

  const pct = (v) => (v === null ? '   n/a' : `${(100 * v).toFixed(1)}%`);
  console.log('FIGURE 3 — associate-degree credit utilization (guide CC side as the A.S.)\n');
  console.log('  util   loss   applied/total  guide');
  for (const r of [...results].sort((a, b) => a.figure3.utilization - b.figure3.utilization)) {
    console.log(`  ${pct(r.figure3.utilization)}  ${pct(r.figure3.loss_rate)}  `
      + `${String(r.figure3.applied_units).padStart(5)}/${String(r.figure3.total_units).padEnd(5)}  `
      + `${r.title.replace(/ Transfer Guide$/, '').slice(0, 52)}`);
  }

  const reportableSorted = results.filter((r) => r.course_level_equivalents)
    .sort((a, b) => a.figure1.coverage_units - b.figure1.coverage_units);
  const held = results.filter((r) => !r.course_level_equivalents);
  console.log('\n\nFIGURE 1 — degree coverage over named requirements (units-weighted)\n');
  console.log('  cover  covered/denom   uni-only  guide');
  for (const r of reportableSorted) {
    console.log(`  ${pct(r.figure1.coverage_units)}  `
      + `${String(r.figure1.covered_units).padStart(5)}/${String(r.figure1.denominator_units).padEnd(6)} `
      + `${String(r.figure1.university_only_units).padStart(6)}    `
      + `${r.title.replace(/ Transfer Guide$/, '').slice(0, 50)}`);
  }

  const sum = (f, rows = results) => rows.reduce((n, r) => n + f(r), 0);
  const reportable = results.filter((r) => r.course_level_equivalents);
  const f1u = sum((r) => r.figure1.covered_units, reportable)
    / sum((r) => r.figure1.denominator_units, reportable);
  const f1c = sum((r) => r.figure1.covered_count, reportable)
    / sum((r) => r.figure1.denominator_count, reportable);
  const f3 = sum((r) => r.figure3.applied_units) / sum((r) => r.figure3.total_units);
  const outcomes = {};
  for (const r of results) {
    for (const [k, v] of Object.entries(r.outcomes)) outcomes[k] = (outcomes[k] || 0) + v;
  }
  const rows = Object.values(outcomes).reduce((a, b) => a + b, 0);

  if (held.length) {
    console.log(`\n  held out (no course-level equivalents published): `
      + held.map((r) => r.title.replace(/ Transfer Guide$/, '')).join('; '));
  }
  console.log('\n\nPOOLED');
  const f1x = sum((r) => r.figure1.covered_units_ex_ge, reportable)
    / sum((r) => r.figure1.denominator_units_ex_ge, reportable);
  const ceil = sum((r) => r.figure1.covered_units, reportable)
    / (sum((r) => r.figure1.covered_units, reportable)
      + sum((r) => r.figure1.university_only_units, reportable));
  console.log(`  Figure 1 ceiling  : ${pct(ceil)} if nothing were denied at transfer`);
  console.log(`  Figure 1 (ex-GE)  : ${pct(f1x)} paper-faithful variant, GE excluded both halves`);
  console.log(`  Figure 1 coverage : ${pct(f1u)} by units, ${pct(f1c)} by count`
    + `  (${reportable.length}/${results.length} guides publish course-level equivalents)`);
  console.log(`  Figure 3 utilization: ${pct(f3)} of associate units applied to something named`);
  console.log('\n  outcome mix across all CC-side requirement rows:');
  for (const [k, v] of Object.entries(outcomes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(4)}  ${(100 * v / rows).toFixed(1).padStart(5)}%  ${k}`);
  }
  const stray = results.flatMap((r) => r.unclassified);
  if (stray.length) console.log(`\n  unclassified equivalents (${stray.length}): ${[...new Set(stray)].slice(0, 12).join(' | ')}`);

  if (write) {
    fs.writeFileSync(OUT, `${JSON.stringify({
      built_at: new Date().toISOString(),
      basis: 'transfer_guides',
      pooled: { figure1_units: f1u, figure1_count: f1c, figure3_units: f3, outcomes },
      guides: results,
    }, null, 1)}\n`);
    console.log(`\nwrote ${OUT}`);
  }
}

if (require.main === module) main();

module.exports = { outcome, credits, maxCredits, figuresFor };
