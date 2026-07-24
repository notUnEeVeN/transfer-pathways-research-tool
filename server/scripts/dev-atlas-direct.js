#!/usr/bin/env node
/**
 * Hotspot / restricted-DNS workaround for connecting to Atlas.
 *
 * Some networks (notably phone Personal Hotspots) break Node's DNS SRV
 * resolution — `mongodb+srv://` fails with `querySrv EBADRESP` — even though the
 * OS resolver answers fine. This launcher rewrites the srv URIs to a direct
 * seedlist that skips the SRV lookup, then starts the normal server.
 *
 * It reads credentials from .env at runtime and never logs them. The shard
 * hostnames below are this cluster's current topology; if Atlas rescales they
 * can change, so this is a temporary aid — go back to `npm run dev` once you're
 * on a network where SRV resolves.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SHARDS = [
  'ac-mbdqzmx-shard-00-00',
  'ac-mbdqzmx-shard-00-01',
  'ac-mbdqzmx-shard-00-02',
].map((h) => `${h}.08t6fak.mongodb.net:27017`).join(',');
const OPTS = 'ssl=true&replicaSet=atlas-sw1cbf-shard-0&authSource=admin&retryWrites=true&w=majority';

// Only rewrite srv URIs pointing at this cluster; leave anything else untouched.
function toDirect(uri) {
  const m = String(uri || '').match(/^mongodb\+srv:\/\/([^@]+)@[^/?]*08t6fak\.mongodb\.net/);
  return m ? `mongodb://${m[1]}@${SHARDS}/?${OPTS}` : uri;
}

if (process.env.MONGO_URI) process.env.MONGO_URI = toDirect(process.env.MONGO_URI);
if (process.env.AUDIT_MONGO_URI) process.env.AUDIT_MONGO_URI = toDirect(process.env.AUDIT_MONGO_URI);

// server.js reads process.env.MONGO_URI (dotenv won't override an already-set
// value), so requiring it here starts the server against the direct URIs.
require('../server.js');
