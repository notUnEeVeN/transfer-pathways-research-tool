const express = require('express');
const router = express.Router();
const canonicalDataController = require('../controllers/CanonicalData');
const analysisController = require('../controllers/Analysis');
const curationController = require('../controllers/Curation');
const degreeRequirementsController = require('../controllers/DegreeRequirements');
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

// ───────── Canonical data contract ─────────
// The router is mounted at /api. Storage names stay private; these are the
// stable paths new notebooks and the web app use from this migration onward.
router.get('/assist/institutions', ...guarded, canonicalDataController.listInstitutions);
router.put('/assist/institutions/:id', ...guarded, jsonBody, canonicalDataController.putInstitutionProfile);
router.delete('/assist/institutions/:id/profile', ...guarded, canonicalDataController.deleteInstitutionProfile);
router.get('/assist/courses',      ...guarded, canonicalDataController.listCourses);
router.put('/assist/courses/:id/concept', ...guarded, jsonBody, canonicalDataController.putCourseConcept);
router.get('/assist/agreements',   ...guarded, canonicalDataController.listAgreements);
router.get('/assist/coverage',     ...guarded, analysisController.coverage);
router.get('/admissions',          ...guarded, canonicalDataController.listAdmissions);
router.get('/curated/requirements', ...guarded, canonicalDataController.listRequirements);
router.get('/curated/requirement-comparison', ...guarded, analysisController.requirementComparison);
router.put('/curated/requirements/:kind', ...guarded, jsonBody, canonicalDataController.putRequirement);
router.delete('/curated/requirements/:kind/:id', ...guarded, canonicalDataController.deleteRequirement);
router.get('/curated/prerequisites', ...guarded, canonicalDataController.listPrerequisites);
router.put('/curated/prerequisites', ...guarded, jsonBody, canonicalDataController.putPrerequisite);
router.delete('/curated/prerequisites/:id', ...guarded, canonicalDataController.deletePrerequisite);
router.get('/curated/prerequisite-graph', ...guarded, canonicalDataController.prerequisiteGraph);
router.get('/curated/course-categories', ...guarded, curationController.listCategories);
router.put('/curated/course-categories/:parentId', ...guarded, jsonBody, curationController.putCategory);
router.get('/curated/receiver-overrides', ...guarded, curationController.listOverrides);
router.put('/curated/receiver-overrides/:hashId', ...guarded, jsonBody, curationController.putOverride);
router.get('/curated/associate-degrees', ...guarded, curationController.listAssocDegrees);
router.put('/curated/associate-degrees', ...guarded, jsonBody, curationController.putAssocDegree);
router.delete('/curated/associate-degrees/:id', ...guarded, curationController.deleteAssocDegree);
router.get('/curated/degrees', ...guarded, degreeRequirementsController.list);
router.get('/curated/degree-evaluation', ...guarded, degreeRequirementsController.evaluate);
router.get('/curated/as-degrees', ...guarded, canonicalDataController.asDegrees);
router.get('/curated/as-degree-availability', ...guarded, canonicalDataController.asDegreeAvailability);

// ───────── Built-in visual analyses (JSON or ?format=csv) ─────────
// These routes compute from the same canonical collections as the data API.
// majorScope keeps every result limited to the caller's visible programs.
router.get('/analysis/releases', ...guarded, analysisController.getReleases);
router.get('/analysis/coverage', ...guarded, analysisController.coverage);
router.get('/analysis/requirement-comparison', ...guarded, analysisController.requirementComparison);
router.get('/analysis/credit-loss', ...guarded, analysisController.creditLoss);
router.get('/analysis/choice-cost', ...guarded, analysisController.choiceCost);
router.get('/analysis/category-gaps', ...guarded, analysisController.categoryGaps);
router.get('/analysis/complexity', ...guarded, analysisController.complexity);
router.get('/analysis/time-to-degree', ...guarded, analysisController.timeToDegree);

// ───────── Audit console ─────────
// Same audit stack as the production tool, minus its local-Mongo gates: the
// research reference handle points at the dedicated research cluster by
// design. Verdicts carry their source for the eventual manual merge back into
// the production audit store.
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

// ───────── Personal API tokens (programmatic access for scripts) ─────────
const tokensController = require('../controllers/Tokens');
router.get('/tokens',        ...guarded, tokensController.list);
router.post('/tokens',       ...guarded, jsonBody, tokensController.create);
router.delete('/tokens/:id', ...guarded, tokensController.revoke);

// ───────── Data explorer (scoped dataset summary + raw ASSIST payloads) ─────────
const dataController = require('../controllers/Data');
router.get('/data/summary',        ...guarded, dataController.getSummary);
router.get('/data/raw-assist/:id', ...guarded, dataController.getRawAssist);

// ───────── Published visuals + Python client ─────────
// Static figures are rendered on the teammate's machine. Named interactive
// visuals store only an allowlisted renderer manifest. Neither path executes
// researcher-supplied Python or JavaScript on the server.
const figuresController = require('../controllers/Figures');
const figureBody = express.json({ limit: '72mb' });
router.get('/gallery',                 ...guarded, figuresController.list);
router.post('/publish',                ...guarded, figureBody, figuresController.publish);
router.get('/gallery/:slug/variants/:variant/:format', ...guarded, figuresController.download);
router.get('/gallery/:slug/:format',   ...guarded, figuresController.download);
router.patch('/gallery/:slug',         ...guarded, jsonBody, figuresController.update);
router.delete('/gallery/:slug',        ...guarded, figuresController.remove);
router.get('/client.py',               ...guarded, figuresController.pmtPy);

// ───────── Bulk source-data exports (JSON or ?format=csv) ─────────
router.use('/exports', ...guarded);
router.get('/exports/agreements',         analysisController.exportAgreements);
router.get('/exports/receivers',          analysisController.exportReceivers);
router.get('/exports/courses',            analysisController.exportCourses);
router.get('/exports/university-courses', analysisController.exportUniversityCourses);
router.get('/exports/cs-ast-degrees',      analysisController.exportCsAstDegrees);
router.get('/exports/local-cs-as-degrees', analysisController.exportLocalCsAsDegrees);

// ───────── Tasks (typed research workflows + shared kanban) ─────────
// Open to every console user — everyone may edit anything (3-person team
// decision); writes are stamped with who. /tasks/roster is registered before
// the '/tasks/:id' verbs so "roster" is never parsed as a task id.
const tasksController = require('../controllers/Tasks');
router.use('/tasks', ...guarded);
router.get('/tasks',           tasksController.list);
router.get('/tasks/roster',    tasksController.roster);
router.post('/tasks',          jsonBody, tasksController.create);
router.post('/tasks/:id/stages/:stage/notes',    jsonBody, tasksController.addStageNote);
router.post('/tasks/:id/stages/:stage/complete', jsonBody, tasksController.completeStage);
router.post('/tasks/:id/stages/:stage/reopen',   jsonBody, tasksController.reopenStage);
// Stage-note management (log-only): registered before the '/tasks/:id' verbs so
// the longer '/tasks/:id/log/:logId' paths win the match.
router.delete('/tasks/:id/log/:logId',           tasksController.deleteLogNote);
router.post('/tasks/:id/log/:logId/resolve',     jsonBody, tasksController.resolveLogNote);
router.put('/tasks/:id',       jsonBody, tasksController.update);
router.delete('/tasks/:id',    tasksController.remove);

// ───────── Admin (dataset visibility + partner access) ─────────
// Admins come from ADMIN_UIDS (env); partners from team_members (managed
// here). Data porting itself runs locally via scripts/port.py — the hosted
// server never holds source-cluster credentials.
const adminController = require('../controllers/Admin');
const accessRequestsController = require('../controllers/AccessRequests');
router.get('/access/me', ...guarded, adminController.getMe);
// Deliberately NOT allowlist-gated: the denied screen files the caller's
// sign-in request here so the admin can approve it in-app.
router.post('/access/request', authenticateToken, userLimiter, accessRequestsController.postRequest);
router.use('/admin', authenticateToken, requireAdmin, userLimiter);
router.get('/admin/dataset',            adminController.getDataset);
router.get('/admin/audit-pulse',        adminController.getAuditPulse);
router.get('/admin/access',             adminController.listAccess);
router.post('/admin/access',            jsonBody, adminController.grantAccess);
router.delete('/admin/access/:uid',     adminController.revokeAccess);
// Editable display names per account (shown for task assignees + figure authors).
router.get('/admin/team',               adminController.listTeam);
router.put('/admin/team/:uid',          jsonBody, adminController.setTeamName);
// Pending sign-in requests (filed by /access/request; granting clears them).
router.get('/admin/access-requests',        accessRequestsController.adminList);
router.delete('/admin/access-requests/:uid', accessRequestsController.adminDismiss);
// Rejected accounts (deny-list): reject a request, list the blocked, un-block.
// Blocking clears the request, revokes any live grant, and stops re-requests.
router.post('/admin/access-blocks',          jsonBody, accessRequestsController.adminBlock);
router.get('/admin/access-blocks',           accessRequestsController.adminListBlocked);
router.delete('/admin/access-blocks/:uid',   accessRequestsController.adminUnblock);
// Which ported majors partners can see (deny-by-default until selected).
router.get('/admin/visible-majors',     adminController.getVisibleMajors);
router.put('/admin/visible-majors',     jsonBody, adminController.putVisibleMajors);
router.put('/admin/analysis-releases',  jsonBody, adminController.putAnalysisReleases);
router.put('/admin/analysis-disabled',  jsonBody, adminController.putAnalysisDisabled);
module.exports = router;
