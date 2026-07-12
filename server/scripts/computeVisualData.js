#!/usr/bin/env node
/**
 * Local-only bridge from the canonical Mongo data to the figure scripts.
 *
 * The calculation functions are the same tested functions the former React
 * visuals used. This command emits their rows as JSON so local Python files
 * can focus on presentation and publishing. It is intentionally not mounted
 * as an HTTP endpoint.
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const metrics = require('../services/analysis/pathways');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const COMMANDS = Object.freeze({
  coverage: metrics.coverageData,
  'credit-loss': metrics.creditLossData,
  'choice-cost': metrics.choiceCostData,
  'category-gaps': metrics.categoryGapsData,
  complexity: metrics.complexityData,
  'transfer-credit-rate': metrics.timeToDegreeData,
});

async function main() {
  const [command, rawParams = '{}'] = process.argv.slice(2);
  if (!COMMANDS[command] && command !== 'institutions') {
    throw new Error(`unknown visual dataset "${command || ''}"`);
  }
  const params = JSON.parse(rawParams);
  const uri = process.env.MONGO_URI || process.env.TARGET_MONGO_URI;
  if (!uri) throw new Error('MONGO_URI or TARGET_MONGO_URI is required');
  const auditUri = process.env.AUDIT_MONGO_URI || uri;
  const dbName = process.env.DB_NAME || process.env.TARGET_DB_NAME || 'pmt_research';

  const mainClient = await MongoClient.connect(uri, { compressors: ['zlib'] });
  const auditClient = auditUri === uri
    ? mainClient
    : await MongoClient.connect(auditUri, { compressors: ['zlib'] });
  try {
    const db = mainClient.db(dbName);
    const auditDb = auditClient.db(dbName);
    const rows = command === 'institutions'
      ? await db.collection('assist_institutions').find().sort({ name: 1 }).toArray()
      : await COMMANDS[command](db, auditDb, { ...params, visiblePairs: null });
    process.stdout.write(JSON.stringify(rows));
  } finally {
    if (auditClient !== mainClient) await auditClient.close();
    await mainClient.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
