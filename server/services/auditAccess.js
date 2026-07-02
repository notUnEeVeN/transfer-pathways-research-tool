// Access control for the research console. Only these Firebase UIDs may reach
// any allowlist-gated route. The list is env-driven so partners can be added
// without a code change: set AUDIT_ALLOWLIST_UIDS to a comma-separated list of
// Firebase UIDs. The backend is the real security boundary; any client-side
// mirror only hides the UI.
function parseAllowlist(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

// Read the env on each call (cached on the raw value) rather than at import
// time — keeps module-load order irrelevant and the middleware testable.
let cachedRaw;
let cachedSet = new Set();
function allowlist(env = process.env) {
  const raw = env.AUDIT_ALLOWLIST_UIDS || '';
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSet = parseAllowlist(raw);
  }
  return cachedSet;
}

function isAuditAllowed(uid, uids = allowlist()) {
  return typeof uid === 'string' && uids.has(uid);
}

module.exports = { isAuditAllowed, parseAllowlist, allowlist };
