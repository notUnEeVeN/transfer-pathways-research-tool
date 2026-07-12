// Shared figure-controller ownership helpers.
const { isAdmin } = require('../services/access');

const auditHandle = (req) => req.app.locals.auditDb || req.app.locals.db;

// Modify rights over a figure: its author, or an admin. Imported rows with a
// null author stay admin-only.
const canModify = (user, ownerUid) =>
  isAdmin(user?.uid) || (!!user?.uid && !!ownerUid && user.uid === ownerUid);

module.exports = { auditHandle, canModify };
