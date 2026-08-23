#!/usr/bin/env node
/**
 * One-command proof that a change moved no published figure.
 *
 * This project's product is the figures. A refactor that changes a rendered
 * value by a tenth of a point is a failure even when every unit test passes,
 * and the suites do not pin figure values — they pin behavior on seeded
 * fixtures. This script closes that gap: it computes a fingerprint over every
 * configured corpus from the live database and diffs it against a committed
 * baseline.
 *
 * The measures are the ones actually rendered:
 *   Figure 1  pct_named_requirement_courses          (coverage, degree lens)
 *   Figure 3  paper_equivalent_as_unit_utilization_pct
 *             full_degree_completion_pct
 *   Figure 4  modeled_hours_above_120
 * plus the row/computed/excluded counts, because a figure can also change by
 * gaining or losing cells while its mean holds still.
 *
 * `scripts/normalizeDegreeCategories.js` runs a narrower version of this
 * inline as its own write gate. This is the standalone, all-corpus form.
 *
 *   node scripts/figureBaseline.js            # diff against the committed baseline
 *   node scripts/figureBaseline.js --write    # record a new baseline
 *   node scripts/figureBaseline.js --json     # print the fingerprint, no diff
 *
 * Exit code is 1 on any drift, so it works as a pre-merge check.
 */
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { listMajors } = require('../config/majors');
const { coverageData } = require('../services/analysis/pathways');
const { transferCreditRateData } = require('../services/analysis/transferCreditRate');

const BASELINE = path.resolve(__dirname, '../data/figure-baseline.json');
const WRITE = process.argv.includes('--write');
const JSON_ONLY = process.argv.includes('--json');

// Three decimals: below display precision, above floating-point noise. A
// change smaller than this cannot reach a reader; a change larger than it is
// real and must be explained.
const round = (value) => (Number.isFinite(value) ? Number(value.toFixed(3)) : null);
const mean = (values) => {
  const finite = values.filter(Number.isFinite);
  return finite.length ? round(finite.reduce((a, b) => a + b, 0) / finite.length) : null;
};

async function fingerprint(db) {
  const out = {};
  // Every configured major, states included, so a newly ported corpus is
  // covered the moment it lands in the registry rather than when someone
  // remembers to add it here.
  for (const major of listMajors({ includeStates: true })) {
    const slug = major.slug;
    const coverage = await coverageData(db, db, { majorSlug: slug, requirements: 'degree' });
    out[`${slug}|figure1`] = {
      rows: coverage.length,
      pct_named_requirement_courses: mean(coverage.map((r) => r.pct_named_requirement_courses)),
      pct_named_requirement_courses_with_ge:
        mean(coverage.map((r) => r.pct_named_requirement_courses_with_ge)),
    };
    const slots = major.degreeAnalysisSlots?.length ? major.degreeAnalysisSlots : ['local_as'];
    for (const degreeType of slots) {
      const rows = await transferCreditRateData(db, null, {
        degreeType, majorSlug: slug, verifiedOnly: false,
      });
      const computed = rows.filter((r) => (
        Number.isFinite(r.paper_equivalent_as_unit_utilization_pct)
      ));
      out[`${slug}|${degreeType}`] = {
        rows: rows.length,
        computed: computed.length,
        excluded: rows.filter((r) => r.method_status === 'excluded').length,
        paper_equivalent_as_unit_utilization_pct:
          mean(computed.map((r) => r.paper_equivalent_as_unit_utilization_pct)),
        full_degree_completion_pct: mean(computed.map((r) => r.full_degree_completion_pct)),
        lower_division_completion_pct: mean(computed.map((r) => r.lower_division_completion_pct)),
        modeled_hours_above_120: mean(computed.map((r) => r.modeled_hours_above_120)),
      };
    }
  }
  return out;
}

function diff(before, after) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const drift = [];
  for (const key of keys) {
    const a = before[key];
    const b = after[key];
    if (!a) { drift.push(`  + ${key} is NEW (not in the baseline)`); continue; }
    if (!b) { drift.push(`  - ${key} is GONE (present in the baseline)`); continue; }
    for (const field of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
      if (a[field] !== b[field]) {
        drift.push(`  ~ ${key}.${field}: ${a[field]} -> ${b[field]}`);
      }
    }
  }
  return drift;
}

(async () => {
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const db = client.db(process.env.DB_NAME || 'pmt_research');
  try {
    const current = await fingerprint(db);
    if (JSON_ONLY) {
      console.log(JSON.stringify(current, null, 1));
      return;
    }
    if (WRITE) {
      fs.writeFileSync(BASELINE, `${JSON.stringify(current, null, 1)}\n`);
      console.log(`baseline written: ${BASELINE}`);
      console.log(`${Object.keys(current).length} measures across ${new Set(Object.keys(current).map((k) => k.split('|')[0])).size} corpora`);
      return;
    }
    if (!fs.existsSync(BASELINE)) {
      console.error(`no baseline at ${BASELINE} — run with --write first`);
      process.exitCode = 1;
      return;
    }
    const drift = diff(JSON.parse(fs.readFileSync(BASELINE, 'utf8')), current);
    if (!drift.length) {
      console.log(`✓ no figure drift — ${Object.keys(current).length} measures match the baseline`);
      return;
    }
    console.error(`✗ ${drift.length} figure value(s) moved:\n${drift.join('\n')}`);
    console.error('\nIf the change is intended, re-record with --write and say why in the commit.');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
