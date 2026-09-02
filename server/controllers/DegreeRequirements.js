/**
 * Read-only views of the hand-gathered full-degree requirements
 * (`curated_requirements`, kind `degree`): the template list (agreement-shaped
 * groups the shared RequirementsLedger renders directly) and one degree
 * evaluated against a community college (the "4-year degree" tab). See
 * docs/figures/degree-coverage-sources.md.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  buildDegreeGroups,
  buildLedgerGroups,
  loadUniversityCourses,
  computeUnitBudget,
  degreeUnitSystem,
} = require('../services/degreeSlots');
const { evaluateDegreeAtCollege } = require('../services/degreeCoverage');
const { defaultMajor, getMajor, listMajors } = require('../config/majors');
const {
  VA_ANALYSIS_MAJOR,
  VA_ANALYSIS_PUBLICATION_CONTRACT,
  virginiaAnalysisPublicationStatus,
} = require('../services/virginia/analysisPublicationGate');

const COLLECTION = 'curated_requirements';

function configuredPublicationError(major) {
  return {
    ready: false,
    blocker: 'analysis_publication_gate_configuration_error',
    contract: major?.publicationGate?.contract || null,
    major_slug: major?.slug || null,
    generation_id: null,
    issues: [{ code: 'unsupported_publication_gate_contract' }],
  };
}

async function publicationStatusForMajor(db, major) {
  if (!major?.publicationGate) return null;
  if (major.publicationGate.contract !== VA_ANALYSIS_PUBLICATION_CONTRACT) {
    return configuredPublicationError(major);
  }
  return virginiaAnalysisPublicationStatus(db);
}

function publicationReadyForMajor(status, major) {
  return status?.ready === true
    && status.major_slug === major?.slug
    && status.contract === major?.publicationGate?.contract;
}

function publicationMajorForDegree(doc) {
  const declared = getMajor(doc?.major_slug);
  if (declared?.publicationGate) return declared;
  // Virginia projection documents are state stamped. Keep that stamp
  // authoritative even if a malformed or historical row lacks the major slug:
  // falling back to California CS here would expose the exact rows the
  // publication receipt is meant to withhold.
  if (doc?.state === 'va') return getMajor(VA_ANALYSIS_MAJOR);
  return null;
}

function sendPublicationBlocked(res, major, status) {
  return res.status(503).json({
    error: 'publication_receipt_required',
    capability: 'analysisPublicationReceipt',
    major: major.slug,
    detail: 'Virginia analysis is unavailable until one exact, current publication receipt passes every figure gate.',
    publication_blocker: status,
  });
}

exports.list = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const candidates = await db.collection(COLLECTION)
    .find({ kind: 'degree' }).sort({ school_id: 1 }).toArray();
  const gatedMajors = new Map();
  for (const doc of candidates) {
    const major = publicationMajorForDegree(doc);
    if (major) gatedMajors.set(major.slug, major);
  }
  const publicationStatuses = new Map();
  // Gate before enriching any Virginia row. The raw source documents remain
  // available through the existing Virginia/curated research endpoints, while
  // this computed view cannot leak totals, unit summaries, or resolved ledgers
  // from an unpublished corpus.
  for (const major of gatedMajors.values()) {
    publicationStatuses.set(major.slug, await publicationStatusForMajor(db, major));
  }
  const docs = candidates.filter((doc) => {
    const major = publicationMajorForDegree(doc);
    return !major || publicationReadyForMajor(publicationStatuses.get(major.slug), major);
  });
  const calendars = await db.collection('assist_institutions')
    .find({ kind: 'university' }, { projection: { source_id: 1, academic_calendar: 1, _id: 0 } })
    .toArray();
  const calendarBySchool = new Map(calendars.map((row) => [Number(row.source_id), row.academic_calendar]));

  const rows = [];
  for (const doc of docs) {
    const universityCoursesById = await loadUniversityCourses(db, doc.requirement_groups, doc.course_unit_overrides);
    const { total } = buildDegreeGroups(doc.requirement_groups, {
      universityCoursesById,
      sourceDocument: doc,
    });
    const ledger = buildLedgerGroups(doc.requirement_groups, { template: true });
    rows.push({
      _id: doc._id,
      school_id: doc.school_id,
      school: doc.school,
      // All legacy degree templates predate the major dimension and are CS.
      // Exposing that identity lets the frontend isolate templates now; the
      // next editor save persists the field on the canonical document.
      major_slug: doc.major_slug || defaultMajor().slug,
      program: doc.program,
      total_units: doc.total_units ?? null,
      unit_system: degreeUnitSystem(doc, calendarBySchool.get(Number(doc.school_id))),
      source_url: doc.source_url || null,
      // New major-dimensional templates carry their own official verification
      // trail instead of using the historical CS-only static source map.
      sources: Array.isArray(doc.sources) ? doc.sources : [],
      catalog_year: doc.catalog_year || null,
      college: doc.college || null,
      academic_unit: doc.academic_unit || null,
      ge_authority: doc.ge_authority || null,
      degree_variant: doc.degree_variant || null,
      research_status: doc.research_status || null,
      source_method: doc.source_method || null,
      unit_audit: doc.unit_audit || null,
      modeling_notes: Array.isArray(doc.modeling_notes) ? doc.modeling_notes : [],
      verification_notes: doc.verification_notes || [],
      // A template is verified when its official pages have been walked. That is
      // usually recorded as notes, but may also be an explicit verdict flag
      // (verified + verified_by) for verification done outside the notes flow.
      verification: doc.verification || null,
      units_summary: computeUnitBudget(doc.requirement_groups, { sourceDocument: doc }),
      updated_at: doc.updated_at || null,
      total,
      requirement_groups: ledger.requirement_groups,
      university_courses_by_id: universityCoursesById,
    });
  }
  const publication_blockers = [...gatedMajors.values()]
    .filter((major) => !publicationReadyForMajor(publicationStatuses.get(major.slug), major))
    .map((major) => ({
      major_slug: major.slug,
      publication_blocker: publicationStatuses.get(major.slug),
    }));
  res.json({ rows, publication_blockers, generated_at: new Date() });
});

// One degree evaluated against one community college.
// ?school_id= & ?community_college_id= & ?majorSlug=cs.
exports.evaluate = asyncHandler(async (req, res) => {
  const school_id = Number(req.query.school_id);
  const community_college_id = Number(req.query.community_college_id);
  if (!Number.isFinite(school_id) || !Number.isFinite(community_college_id)) {
    return res.status(400).json({ error: 'school_id and community_college_id are required' });
  }
  const majorSlug = String(req.query.majorSlug || defaultMajor().slug).trim();
  const major = getMajor(majorSlug);
  if (!major) {
    return res.status(400).json({
      error: `unknown major: ${majorSlug}`,
      known: listMajors({ includeStates: true }).map((major) => major.slug),
    });
  }
  const publicationStatus = await publicationStatusForMajor(req.app.locals.db, major);
  if (publicationStatus && !publicationReadyForMajor(publicationStatus, major)) {
    return sendPublicationBlocked(res, major, publicationStatus);
  }
  const result = await evaluateDegreeAtCollege(req.app.locals.db, {
    schoolId: school_id, communityCollegeId: community_college_id, majorSlug,
  });
  if (!result) return res.status(404).json({ error: 'no degree template for this campus yet' });
  res.json(result);
});
