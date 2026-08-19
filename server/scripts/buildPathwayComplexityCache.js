#!/usr/bin/env node
/**
 * Precompute the pathway-complexity matrices into `analysis_cache`.
 *
 * The Figure-6 assembly scores every (campus × college) pathway for a major —
 * roughly ten seconds per major — so the endpoint serves from this cache and
 * only visibility scoping runs per request. Re-run after any change to degree
 * templates, associate degrees, agreements, or prerequisite data (the
 * endpoint's `?refresh=1` recomputes one variant on demand). Canonical console
 * edits retire affected caches automatically; run this once after the final
 * curation session to prewarm every variant.
 *
 *   node scripts/buildPathwayComplexityCache.js
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const { pathwayComplexityCached } = require('../services/analysis/pathwayComplexity');
const { listMajors } = require('../config/majors');
const { AS_DEGREE_SLOTS } = require('../config/asDegreeSlots');

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  // Every engine-scored major. listMajors() already excludes state-scoped
  // majors (Massachusetts serves its committed paper snapshot; Virginia's
  // requisite collections are not imported yet).
  const majors = listMajors().filter((m) => m.capabilities.prerequisites);
  for (const major of majors) {
    const degreeTypes = (major.degreeAnalysisSlots || [])
      .filter((slot) => AS_DEGREE_SLOTS.includes(slot));
    for (const degreeType of degreeTypes.length ? degreeTypes : ['ast']) {
      for (const verifiedOnly of [true, false]) {
        const started = Date.now();
        const { rows } = await pathwayComplexityCached(db, {
          majorSlug: major.slug,
          degreeType,
          verifiedOnly,
          refresh: true,
        });
        const scored = rows.filter((row) => Number.isFinite(row.delta_vs_resident)).length;
        const excluded = rows.filter((row) => row.method_status === 'excluded').length;
        const cohort = verifiedOnly ? 'verified' : 'all';
        console.log(`${major.slug.padEnd(6)} (${degreeType}, ${cohort})  ${String(scored).padStart(4)} scored, ${String(excluded).padStart(3)} excluded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
      }
    }
  }
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
