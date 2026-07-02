const { MongoClient } = require('mongodb');
const { describeTarget } = require('./mongoTarget');

const connectDB = async () => {
  const target = describeTarget(process.env.MONGO_URI);
  try {
    // `compressors: ['zlib']` turns on wire compression between this app and
    // Atlas. The large agreement reads compress well on the network hop, and
    // it's lossless — the driver decompresses to byte-identical BSON, so query
    // results never change. zlib ships with the driver (Node's built-in zlib),
    // so this needs no extra native dependency; Atlas negotiates it or falls
    // back to no compression.
    const client = await MongoClient.connect(process.env.MONGO_URI, {
      compressors: ['zlib'],
    });
    console.log(`Connected to ${target}`);
    return client.db(process.env.DB_NAME);
  } catch (error) {
    console.error(`Error connecting to ${target}:`, error);
    process.exit(1);
  }
};

// Audit working-state DB — owns `audit_results` + `audit_groupings`. Defaults to
// the main connection when AUDIT_MONGO_URI is unset (or equals MONGO_URI), so
// single-DB setups are completely unchanged. When AUDIT_MONGO_URI points at a
// shared Atlas cluster, this opens a SECOND client so two people share verdicts
// while reference data (agreements/courses) stays on the main (local) handle —
// reference reads must never cross to this handle (Mongo can't join clusters).
const connectAuditDB = async (fallbackDb) => {
  const uri = process.env.AUDIT_MONGO_URI;
  if (!uri || uri === process.env.MONGO_URI) return fallbackDb;
  const target = describeTarget(uri);
  try {
    const client = await MongoClient.connect(uri, { compressors: ['zlib'] });
    console.log(`Connected to audit ${target}`);
    return client.db(process.env.DB_NAME);
  } catch (error) {
    console.error(`Error connecting to audit ${target}:`, error);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.connectAuditDB = connectAuditDB;