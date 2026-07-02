/**
 * Classify a MongoDB connection string, for connection logging (config/db.js).
 * Atlas uses mongodb+srv:// / *.mongodb.net; local dev uses localhost/127.0.0.1.
 *
 * Note: the production tool also derived an `auditEnabled()` gate from this
 * (audit blocked whenever the reference handle pointed at Atlas, to protect the
 * shared prod cluster). The research server has no such gate — its reference
 * handle points at the dedicated research cluster by design.
 */
function isAtlasUri(uri = '') {
  const u = String(uri).toLowerCase();
  return u.includes('mongodb+srv') || u.includes('mongodb.net');
}

function describeTarget(uri = '') {
  if (isAtlasUri(uri)) return 'MongoDB Atlas';
  const u = String(uri).toLowerCase();
  if (u.includes('localhost') || u.includes('127.0.0.1')) return 'local MongoDB';
  return 'MongoDB';
}

module.exports = { isAtlasUri, describeTarget };
