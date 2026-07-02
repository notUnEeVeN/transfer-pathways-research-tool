const express = require('express');
const router = express.Router();
const communityCollegeController = require('../controllers/CommunityCollege');
const agreementsController = require('../controllers/Agreements');
const coursesController = require('../controllers/Courses');
const universityCoursesController = require('../controllers/UniversityCourses');
const authenticateToken = require('../middleware/auth');
const requireAuditAccess = require('../middleware/requireAuditAccess');
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
  '/csu-agreements-batch/:community_college_id',
  ...guarded,
  agreementsController.getAllCSUAgreementsForCommunityCollege
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
router.get('/audit/groupings',         auditController.listGroupings);
router.post('/audit/groupings',        jsonBody, auditController.createGrouping);
router.get('/audit/groupings/:id',     auditController.getGrouping);
router.patch('/audit/groupings/:id',   jsonBody, auditController.renameGrouping);
router.delete('/audit/groupings/:id',  auditController.deleteGrouping);

module.exports = router;
