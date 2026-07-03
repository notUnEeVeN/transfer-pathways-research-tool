const admin = require('../config/firebase');
const { looksLikeApiToken, uidForToken } = require('../services/apiTokens');

// Two credential kinds on the same Bearer header:
//   - pmtr_… personal API tokens (scripts/notebooks; see services/apiTokens)
//   - Firebase ID tokens (the browser console)
// Both resolve to a uid on req.user, so every downstream gate (console
// allowlist, admin role, major visibility) treats them identically.
const authenticateToken = async (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1]; // Bearer TOKEN
  if (!token) return res.sendStatus(401);

  if (looksLikeApiToken(token)) {
    try {
      const auditDb = req.app.locals.auditDb || req.app.locals.db;
      const uid = await uidForToken(auditDb, token);
      if (!uid) return res.sendStatus(403);
      req.user = { uid, api_token: true };
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
