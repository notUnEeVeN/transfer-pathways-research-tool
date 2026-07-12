const { isConsoleAllowed } = require('../services/access');

// Gate for every console route. Must run AFTER authenticateToken, which
// populates req.user. Passes admins (ADMIN_UIDS env) and granted partners
// (`team_members.access_status`). Bare status so it leaks nothing.
const requireAuditAccess = async (req, res, next) => {
  try {
    const auditDb = req.app.locals.auditDb || req.app.locals.db;
    if (!(await isConsoleAllowed(req.user?.uid, auditDb))) return res.sendStatus(403);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = requireAuditAccess;
