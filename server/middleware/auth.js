const admin = require('../config/firebase');
const { looksLikeApiToken, resolveApiToken } = require('../services/apiTokens');

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Two credential kinds on the same Bearer header:
//   - pmtr_… personal API tokens (scripts/notebooks; see services/apiTokens)
//   - Firebase ID tokens (the browser console)
// Both resolve to a uid on req.user, so every downstream gate (console
// allowlist, admin role, major visibility) treats them identically.
//
// One carve-out: ephemeral runner tokens (minted per live-figure run) are
// READ-ONLY. A script's publish() is captured by the runner rather than
// POSTed, and sandbox runs must not be able to write audit/curation state or
// trigger further runs — that would let a scheduled refresh mutate research
// data, or re-dirty the sweeper and refresh itself in a loop.
const authenticateToken = async (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1]; // Bearer TOKEN
  if (!token) return res.sendStatus(401);

  if (looksLikeApiToken(token)) {
    try {
      const auditDb = req.app.locals.auditDb || req.app.locals.db;
      const resolved = await resolveApiToken(auditDb, token);
      if (!resolved) return res.sendStatus(403);
      if (resolved.ephemeral && !READ_METHODS.has(req.method)) {
        return res.status(403).json({
          error: 'live-figure run tokens are read-only — the runner captures publish() output itself',
        });
      }
      req.user = { uid: resolved.uid, api_token: true, ephemeral_token: resolved.ephemeral };
      return next();
    } catch (error) {
      console.error('Error verifying API token:', error);
      return res.sendStatus(403);
    }
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.sendStatus(403);
  }
};

module.exports = authenticateToken;
