/**
 * Maryland (ARTSYS) routes, mounted at /api/md.
 *
 * A self-contained router so the second state is one `router.use` line in
 * routes/api.js and one folder on the frontend. Nothing here is referenced by
 * the California routes; removing the mount removes the feature.
 *
 * Read-only by design. The Maryland corpus is imported by a script and is not
 * hand-curated, so there is nothing here for the console to write back — and
 * no write route can therefore damage it.
 */
const express = require('express');
const maryland = require('../controllers/Maryland');

/**
 * @param {import('express').RequestHandler[]} guarded the same
 *   [authenticateToken, requireAuditAccess, userLimiter] chain every other
 *   route uses. Passed in rather than re-imported so there is exactly one
 *   definition of who may read this console.
 */
module.exports = function marylandRouter(guarded) {
  const router = express.Router();
  router.use(...guarded);

  router.get('/summary', maryland.summary);
  router.get('/institutions', maryland.listInstitutions);
  router.get('/programs', maryland.listPrograms);
  router.get('/agreements', maryland.listAgreements);
  router.get('/agreements/:id', maryland.getAgreement);
  router.get('/college-rollup', maryland.collegeRollup);
  router.get('/coverage-matrix', maryland.coverageMatrix);

  return router;
};
