#!/usr/bin/env node
/**
 * Precompute the pathway-complexity matrices into `analysis_cache`.
 *
 * The Figure-6 assembly scores every (campus × college) pathway for a major —
 * roughly ten seconds per major — so the endpoint serves from this cache and
 * only visibility scoping runs per request. Re-run after any change to degree
 * templates, associate degrees, agreements, or prerequisite data (the
 * endpoint's `?refresh=1` recomputes one major on demand).
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
    const degreeType = (major.degreeAnalysisSlots || []).find((slot) => AS_DEGREE_SLOTS.includes(slot)) || 'ast';
    const started = Date.now();
    const { rows } = await pathwayComplexityCached(db, { majorSlug: major.slug, degreeType, refresh: true });
    console.log(`${major.slug.padEnd(6)} (${degreeType})  ${String(rows.length).padStart(4)} pathways cached in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
