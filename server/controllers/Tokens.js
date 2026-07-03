/**
 * Personal API-token management (every console user manages their own).
 * The plaintext token appears exactly once, in the POST response — only the
 * hash is stored. Revoking is by hash id. See services/apiTokens.js.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { createToken, listTokens, revokeToken } = require('../services/apiTokens');

const tokensDb = (req) => req.app.locals.auditDb || req.app.locals.db;

exports.list = asyncHandler(async (req, res) => {
  res.json({ tokens: await listTokens(tokensDb(req), req.user.uid) });
});

exports.create = asyncHandler(async (req, res) => {
  const { label } = req.body || {};
  const token = await createToken(tokensDb(req), req.user.uid, label);
  res.status(201).json({ token, note: 'Store this now — it is not shown again.' });
});

exports.revoke = asyncHandler(async (req, res) => {
  const ok = await revokeToken(tokensDb(req), req.user.uid, req.params.id);
  if (!ok) return res.status(404).json({ error: 'no such token' });
  res.json({ ok: true });
});
