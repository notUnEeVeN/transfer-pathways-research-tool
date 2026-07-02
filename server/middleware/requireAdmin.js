const { isAdmin } = require('../services/access');

// Admin-only gate (dataset visibility, partner access management). Must run
// AFTER authenticateToken. Admins are the ADMIN_UIDS env allowlist only —
// partners can never grant themselves access.
const requireAdmin = (req, res, next) => {
  if (!isAdmin(req.user?.uid)) return res.sendStatus(403);
  next();
};

module.exports = requireAdmin;
