const { isAuditAllowed } = require('../services/auditAccess');

// Gate for the audit/curation routes. Must run AFTER authenticateToken, which
// populates req.user. Unlike the production tool, there is no local-Mongo
// gate here: the research server's reference handle points at the dedicated
// research Atlas cluster by design (a versioned subset, not the shared prod
// cluster). Allowlisted UIDs only; bare status so it leaks nothing.
const requireAuditAccess = (req, res, next) => {
  if (!isAuditAllowed(req.user?.uid)) return res.sendStatus(403);
  next();
};

module.exports = requireAuditAccess;
