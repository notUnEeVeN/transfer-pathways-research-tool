// Shared bits for the figure controllers (Figures.js + FigureScripts.js), so
// the two surfaces that gate the SAME slugs can't drift apart on ownership.
const { isAdmin } = require('../services/access');

const auditHandle = (req) => req.app.locals.auditDb || req.app.locals.db;

// Modify rights over a figure/script: its author, or an admin. Legacy rows
// with a null author stay admin-only.
const canModify = (user, ownerUid) =>
  isAdmin(user?.uid) || (!!user?.uid && !!ownerUid && user.uid === ownerUid);

module.exports = { auditHandle, canModify };
