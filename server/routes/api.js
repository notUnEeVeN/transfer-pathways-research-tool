const express = require('express');
const router = express.Router();
const communityCollegeController = require('../controllers/CommunityCollege');
const agreementsController = require('../controllers/Agreements');
const coursesController = require('../controllers/Courses');
const universityCoursesController = require('../controllers/UniversityCourses');
const authenticateToken = require('../middleware/auth');
const requireAuditAccess = require('../middleware/requireAuditAccess');
const requireAdmin = require('../middleware/requireAdmin');
const { userLimiter } = require('../middleware/rateLimit');

// Per-route JSON parsers (there is no global one).
const jsonBody = express.json({ limit: '256kb' });

// Every route on the research server is allowlist-gated — this is a private
// research console over a curated dataset, not a public API. The reference
// data routes reuse the same guard as the audit console.
const guarded = [authenticateToken, requireAuditAccess, userLimiter];

// ───────── Reference data (research subset) ─────────
router.get('/community-colleges', ...guarded, communityCollegeController.listAll);
router.get('/schools', ...guarded, agreementsController.getSchools);
router.get(
  '/uc-agreements-batch/:community_college_id',
  ...guarded,
  agreementsController.getAllUCAgreementsForCommunityCollege
);
router.get(
  '/courses/:community_college_id',
  ...guarded,
  coursesController.getCoursesByCommunityCollegeId
);
router.get(
  '/university-courses/:university_id',
  ...guarded,
  universityCoursesController.getUniversityCoursesByUniversityId
);

// ───────── Audit console ─────────
// Same audit stack as the production tool, minus its local-Mongo gates: the
// research reference handle points at the dedicated research cluster by
// design. Verdicts carry dataset_version + source for the eventual manual
// merge back into the production audit store.
const auditController = require('../controllers/Audit');
router.use('/audit', ...guarded);
router.get('/audit/next',              auditController.getNext);
router.get('/audit/doc/:docId',        auditController.getDoc);
router.post('/audit/verify',           jsonBody, auditController.postVerify);
router.get('/audit/errors',            auditController.getErrors);
router.get('/audit/conservative',      auditController.getConservative);
router.get('/audit/flagged',           auditController.getFlagged);
router.get('/audit/stale',             auditController.getStale);
router.get('/audit/correct',           auditController.getCorrect);
router.get('/audit/template-variants', auditController.getTemplateVariants);
router.get('/audit/bootstrap',         auditController.getBootstrap);
router.get('/audit/matrix',            auditController.getMatrix);
router.get('/audit/search',            auditController.searchPicker);
// No /audit/groupings here: the visible-major subset replaces groupings.
// (Stale was re-added by request: after a parser refresh, retired verdicts
// surface there so prior flags/errors can be revisited.)

// ───────── Curation (categories, overrides, prereqs, ADTs, ref tables) ─────────
// Open to every console user — partners do curation work; writes are stamped
// with the curator's uid.
const curationController = require('../controllers/Curation');
router.use('/curation', ...guarded);
router.get('/curation/categories',              curationController.listCategories);
router.put('/curation/categories/:parentId',    jsonBody, curationController.putCategory);
router.get('/curation/receiver-overrides',      curationController.listOverrides);
router.put('/curation/receiver-overrides/:hashId', jsonBody, curationController.putOverride);
router.get('/curation/prereqs',                 curationController.listPrereqs);
router.put('/curation/prereqs/:key',            jsonBody, curationController.putPrereqs);
router.get('/curation/assoc-degrees',           curationController.listAssocDegrees);
router.put('/curation/assoc-degrees',           jsonBody, curationController.putAssocDegree);
router.delete('/curation/assoc-degrees/:id',    curationController.deleteAssocDegree);
router.get('/curation/ref/:table',              curationController.getRefTable);
router.put('/curation/ref/:table',              jsonBody, curationController.putRefRow);
router.delete('/curation/ref/:table/:id',       curationController.deleteRefRow);

// ───────── Personal API tokens (programmatic access for scripts) ─────────
const tokensController = require('../controllers/Tokens');
router.get('/tokens',        ...guarded, tokensController.list);
router.post('/tokens',       ...guarded, jsonBody, tokensController.create);
router.delete('/tokens/:id', ...guarded, tokensController.revoke);

// ───────── Data explorer (scoped dataset summary + raw ASSIST payloads) ─────────
const dataController = require('../controllers/Data');
router.get('/data/summary',        ...guarded, dataController.getSummary);
router.get('/data/raw-assist/:id', ...guarded, dataController.getRawAssist);

// ───────── Analysis + export (papers' statistics; JSON or ?format=csv) ─────────
const analysisController = require('../controllers/Analysis');
router.use('/analysis', ...guarded);
router.get('/analysis/coverage',        analysisController.coverage);
router.get('/analysis/credit-loss',     analysisController.creditLoss);
router.get('/analysis/choice-cost',     analysisController.choiceCost);
router.get('/analysis/category-gaps',   analysisController.categoryGaps);
router.get('/analysis/complexity',      analysisController.complexity);
router.get('/analysis/time-to-degree',  analysisController.timeToDegree);
router.get('/analysis/raw/:collection', analysisController.rawExport);

// ───────── Admin (dataset visibility + partner access) ─────────
// Admins come from ADMIN_UIDS (env); partners from access_grants (managed
// here). Data porting itself runs locally via scripts/port.py — the hosted
// server never holds source-cluster credentials.
const adminController = require('../controllers/Admin');
router.get('/access/me', ...guarded, adminController.getMe);
router.use('/admin', authenticateToken, requireAdmin, userLimiter);
router.get('/admin/dataset',            adminController.getDataset);
router.get('/admin/access',             adminController.listAccess);
router.post('/admin/access',            jsonBody, adminController.grantAccess);
router.delete('/admin/access/:uid',     adminController.revokeAccess);
// Which ported majors partners can see (deny-by-default until selected).
router.get('/admin/visible-majors',     adminController.getVisibleMajors);
router.put('/admin/visible-majors',     jsonBody, adminController.putVisibleMajors);
// Re-port the current majors from the source DB (post-parser-update refresh).
router.post('/admin/refresh-dataset',   adminController.postRefreshDataset);
router.get('/admin/refresh-dataset',    adminController.getRefreshStatus);

module.exports = router;
