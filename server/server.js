require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const connectDB = require('./config/db');
const { connectAuditDB } = require('./config/db');
const apiRoutes = require('./routes/api');
const { globalIpLimiter } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errorHandler');
const { ensureAuditIndexes } = require('./services/audit/indexes');
const { ensureTokenIndexes } = require('./services/apiTokens');
const { ensureTaskIndexes } = require('./services/tasks');

const app = express();
const port = process.env.PORT || 3000;

// Deployed origins come from env (comma-separated) so the repo carries no
// hosting decisions; localhost is always allowed outside production.
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://localhost:3000'
  );
}

// Trust the first proxy (hosting platform's load balancer) so req.ip reflects
// the real client IP for rate limiting.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// gzip the responses — the agreements payloads are large, highly repetitive
// JSON; gzip cuts them ~5-10x on the wire.
app.use(compression());

// No global body parser: JSON is parsed per-route (see routes/api.js) so each
// endpoint gets the limit it actually needs and GET routes never parse a body.
app.use(globalIpLimiter);

// Serve the built React app (frontend/dist) from the same origin as the API
// when a production build is present, so a single deployed service hosts both.
// Static assets are served here; non-file paths (e.g. /schools) fall through to
// the API routes below, and any GET no API route claims returns index.html via
// the catch-all registered after the routes (SPA client-side routing). Without
// a build (pure-API / dev runs) we keep a plain liveness string at '/'.
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
const hasFrontendBuild = fs.existsSync(path.join(distDir, 'index.html'));

if (hasFrontendBuild) {
  app.use(express.static(distDir));
} else {
  app.get('/', (req, res) => {
    res.send('Transfer Pathways Research API is running.');
  });
}

connectDB()
  .then(async (db) => {
    app.locals.db = db;
    // Team working state (reviews, tasks, access, and figures) lives on auditDb,
    // which is the same handle as `db` unless AUDIT_MONGO_URI selects a
    // separate cluster. On the research deployment both usually point at the
    // research cluster.
    const auditDb = await connectAuditDB(db);
    app.locals.auditDb = auditDb;
    try {
      await ensureAuditIndexes(auditDb);
    } catch (e) {
      console.warn(`[audit] index setup failed: ${e.message}`);
    }
    ensureTokenIndexes(auditDb).catch((e) => console.warn(`[tokens] index setup failed: ${e.message}`));
    ensureTaskIndexes(auditDb).catch((e) => console.warn(`[tasks] index setup failed: ${e.message}`));
    // Platform liveness probe: a quick Mongo ping + process uptime. Returns 200
    // when the DB answers, 503 otherwise, so the host's health check can tell a
    // live server from one that's up but can't reach Mongo.
    app.get('/health', async (req, res) => {
      const started = Date.now();
      const health = {
        ok: true,
        checkedAt: new Date().toISOString(),
        uptimeSec: Math.round(process.uptime()),
        mongo: { ok: false, dbName: db?.databaseName || process.env.DB_NAME || null, pingMs: null },
      };
      try {
        await db.command({ ping: 1 });
        health.mongo.ok = true;
        health.mongo.pingMs = Date.now() - started;
      } catch (err) {
        health.ok = false;
        health.mongo.error = err.message;
      }
      res.status(health.ok ? 200 : 503).json(health);
    });
    // `/api` is the permanent contract.
    app.use('/api', apiRoutes);
    // Unknown canonical API paths must stay API responses. Without this
    // boundary they fall through to the SPA shell and misleadingly return
    // HTML with status 200.
    app.use('/api', (req, res) => {
      res.status(404).json({ error: 'API route not found' });
    });
    // SPA fallback: any GET the API didn't claim returns the app shell so
    // client-side routes survive deep links and refreshes. Registered after the
    // API routes so real endpoints always win; skipped when there's no build.
    if (hasFrontendBuild) {
      app.get('*', (req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
    // Central error handler — must be registered after the routes so thrown
    // handler errors (forwarded via asyncHandler) land here and get a generic
    // client response instead of leaking internals.
    app.use(errorHandler);
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Error starting the server:', error);
  });
