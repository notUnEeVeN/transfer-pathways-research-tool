/**
 * API over the Transfer Virginia course corpus and curated Virginia degrees.
 *
 * `va_courses` and `va_institutions` are written by the import pipeline; degree
 * edits and signed verification live in `va_requirements`/`va_revisions`.
 * Nothing here reads the ASSIST collections: Virginia is a separate dataset
 * under evaluation, not a second source feeding the California analyses.
 *
 * The unit of the corpus is the **VCCS common course**, not a college-to-college
 * pair. Four renderings of CSC221 from different sending colleges returned
 * identical four-year mappings, so a course document holds one `articulates_to`
 * list plus the `offered_by` set of colleges whose catalog carries it. A pair
 * question — "can this college reach this university?" — is therefore a join
 * across those two fields rather than a stored row, which is what `matrix`
 * computes and why its cells are shared-course counts rather than verdicts.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { diffDocs } = require('../services/docDiff');
const {
  UnknownVirginiaInstitutionError,
  virginiaPrerequisiteGraphData,
} = require('../services/virginia/prereqGraph');
const {
  canonicalCourseCode,
  courseIdFor,
  courseKeyFor,
  parentIdForLanding,
} = require('../services/virginia/courseIdentity');
const { validateDegreeAcceptance } = require('../services/virginia/degreeAcceptance');
const {
  EXTERNAL_RECEIVER_COHORT_ID,
  OTHER_FOUR_YEAR_COHORT_ID,
  PRIMARY_COHORT_ID,
  TWO_YEAR_COHORT_ID,
  canonicalInstitutionIdentity,
  cohortSummary,
  decorateInstitution,
  mergeInstitutionRows,
  primaryCohort,
  registryInstitutionFor,
  sourceNamesForInstitution,
} = require('../services/virginia/institutionCohorts');

const COURSES = 'va_courses';
const INSTITUTIONS = 'va_institutions';
const REQUIREMENTS = 'va_requirements';
const COVERAGE = 'va_coverage';
const REVISIONS = 'va_revisions';

/** The two document kinds `va_requirements` holds, mirroring California. */
const EDITABLE_KINDS = new Set(['as_degree', 'degree']);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const intOr = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Resolver used when a researcher asks to sign a Virginia degree. */
function degreeCourseResolver(doc, catalogCodes = new Set()) {
  const titleCodes = new Set(Object.keys(doc.course_titles || {})
    .map(canonicalCourseCode).filter((code) => courseIdFor(code) != null));
  const documentCodes = new Set([
    ...(doc.codes_seen || []),
    ...titleCodes,
  ].map(canonicalCourseCode).filter((code) => courseIdFor(code) != null));
  const byId = new Map([...documentCodes].map((code) => [courseIdFor(code), code]));
  return ({ side, id, key }) => {
    const keyCode = /^va:/i.test(String(key || ''))
      ? canonicalCourseCode(String(key).slice(3)) : null;
    const code = keyCode || byId.get(Number(id));
    if (!code || courseIdFor(code) !== Number(id) || !documentCodes.has(code)) return false;
    // `va_courses` is incomplete, so a title captured from this college's own
    // official catalog is also direct evidence (notably NOVA MTH 283 and the
    // institution-local Richard Bland namespace).
    if (side === 'community_college'
        && !catalogCodes.has(code)
        && !titleCodes.has(code)) return false;
    return side === 'community_college'
      ? { course_id: Number(id), course_key: key || courseKeyFor(code) }
      : { parent_id: Number(id) };
  };
}

const verificationMaterialChanges = (before, after) => diffDocs(before, after).filter((change) => (
  change.path !== 'verification'
  && !change.path.startsWith('verification.')
  && change.path !== 'acceptance'
  && !change.path.startsWith('acceptance.')
  && change.path !== 'collection_status'
));

const sameUpdateToken = (left, right) => {
  const leftTime = left == null ? null : Date.parse(left instanceof Date ? left.toISOString() : left);
  const rightTime = right == null ? null : Date.parse(right instanceof Date ? right.toISOString() : right);
  return leftTime != null && rightTime != null && leftTime === rightTime;
};

/** Add the public VCCS identity fields, including for pre-identity imports. */
function withCourseIdentity(row) {
  if (!row) return row;
  return {
    ...row,
    course_id: row.course_id ?? courseIdFor(row.code),
    course_key: row.course_key ?? courseKeyFor(row.code),
  };
}

/**
 * A Transfer Virginia landing is a university course only when its identifier
 * is one concrete catalog code. Elective buckets such as TRNS1XX deliberately
 * retain `parent_id: null` so they cannot be pasted into a degree by mistake.
 */
function withUniversityCourseIdentity(landing) {
  if (!landing) return null;
  const code = canonicalCourseCode(landing.identifier);
  const generatedParentId = parentIdForLanding(landing);
  return {
    ...landing,
    code,
    parent_id: generatedParentId == null ? null : landing.parent_id ?? generatedParentId,
  };
}

/**
 * Published Virginia course prerequisites, kept separate from ASSIST's
 * inferred prerequisite endpoint. `university` is explicitly a transfer-
 * preparation projection over accepted VCCS courses; it never represents the
 * receiving university's own catalog prerequisite policy.
 */
exports.prerequisiteGraph = asyncHandler(async (req, res) => {
  const college = String(req.query.college || '').trim() || null;
  const university = String(req.query.university || '').trim() || null;
  try {
    const graph = await virginiaPrerequisiteGraphData(req.app.locals.db, { college, university });
    return res.json(graph);
  } catch (error) {
    if (error instanceof UnknownVirginiaInstitutionError) {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});

/** Corpus counts for the landing view. */
exports.summary = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const [courses, institutions] = await Promise.all([
    db.collection(COURSES).countDocuments(),
    db.collection(INSTITUTIONS).countDocuments(),
  ]);
  if (!courses) return res.json({
    imported: false,
    courses: 0,
    institutions: 0,
    public_four_year: primaryCohort.institution_slugs.length,
  });

  const [agg] = await db.collection(COURSES).aggregate([{
    $group: {
      _id: null,
      equivalencies: { $sum: { $size: { $ifNull: ['$articulates_to', []] } } },
      with_notes: { $sum: '$counts.with_notes' },
      departments: { $addToSet: '$department' },
      imported_at: { $max: '$imported_at' },
    },
  }]).toArray();
  const levels = await db.collection(INSTITUTIONS).aggregate([
    { $group: { _id: '$level', n: { $sum: 1 } } },
  ]).toArray();

  res.json({
    imported: true,
    courses,
    institutions,
    community_colleges: levels.find((l) => l._id === 'community_college')?.n ?? 0,
    four_year: levels.find((l) => l._id === 'four_year')?.n ?? 0,
    // Stable comparison denominator. The broader Transfer Virginia receiver
    // count above intentionally remains available for corpus diagnostics.
    public_four_year: primaryCohort.institution_slugs.length,
    equivalencies: agg?.equivalencies ?? 0,
    with_notes: agg?.with_notes ?? 0,
    departments: (agg?.departments ?? []).filter(Boolean).length,
    imported_at: agg?.imported_at ?? null,
  });
});

/**
 * Institutions, optionally restricted to one level, each stamped with whether
 * its CS degree has been collected.
 *
 * `degree_status` is what the rails show, and it distinguishes four different
 * facts that a single "collected" boolean would flatten:
 *   full       — a degree document with a parsed course list
 *   url_only   — a verified catalog URL, but the institution publishes no
 *                machine-readable course list (a data gap)
 *   no_program — no current source-prescribed CS-specific degree/path (not a
 *                collection gap; a broad Science A.S. may still exist)
 *   alias      — a renamed duplicate; the degree is filed under the other name
 *   none       — no degree document at all
 */
exports.institutions = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const q = req.query.level ? { level: String(req.query.level) } : {};
  const corpusRows = await db.collection(INSTITUTIONS).find(q).sort({ name: 1 }).toArray();
  const rows = mergeInstitutionRows(corpusRows, {
    includePrimaryMissing: !q.level || q.level === 'four_year',
  });

  const requestedCohort = String(req.query.cohort || '').trim() || null;
  const knownCohorts = new Set([
    PRIMARY_COHORT_ID, OTHER_FOUR_YEAR_COHORT_ID,
    EXTERNAL_RECEIVER_COHORT_ID, TWO_YEAR_COHORT_ID,
  ]);
  if (requestedCohort && !knownCohorts.has(requestedCohort)) {
    return res.status(400).json({
      error: `unknown Virginia institution cohort: ${requestedCohort}`,
      cohorts: [...knownCohorts],
    });
  }

  const degrees = await db.collection(REQUIREMENTS)
    .find({
      source: 'institution_catalog',
      status: { $nin: ['superseded', 'out_of_scope'] },
    },
      { projection: { college_id: 1, school_id: 1, codes_seen: 1, total_units: 1, verification: 1, offers_cs: 1 } })
    .toArray();
  const byOwner = new Map(degrees.map((d) => [d.college_id || d.school_id, d]));

  res.json({
    cohorts: cohortSummary(),
    institutions: rows.filter((i) => !requestedCohort || i.cohort === requestedCohort).map((i) => {
      const key = i.level === 'community_college'
        ? `va:cc:${i.institution_slug}` : `va:uni:${i.institution_slug}`;
      const d = byOwner.get(key);
      // Five distinct facts, because collapsing them answers the wrong
      // question: "no published course list" is a data gap, while "no current
      // source-prescribed CS-specific degree/path" is a catalog finding.
      const status = !d ? (i.catalog_offers_cs === false ? 'no_program' : i.alias_of ? 'alias' : 'none')
        : d.offers_cs === false ? 'no_program'
        : (d.codes_seen || []).length ? 'full'
        : 'url_only';
      const collectionStatus = status === 'full' ? 'catalog_collected'
        : status === 'url_only' ? 'catalog_url_only'
        : status === 'no_program' ? 'no_program'
        : status === 'alias' ? 'alias'
        : 'not_collected';
      return {
        ...i,
        degree_status: status,
        collection_status: collectionStatus,
        needs_collection: collectionStatus === 'not_collected' || collectionStatus === 'catalog_url_only',
        degree_courses: d ? (d.codes_seen || []).length : 0,
        degree_units: d?.total_units ?? null,
        degree_verified: !!d?.verification?.verified,
      };
    }),
  });
});

/**
 * Courses, filtered. `receiver` and `college` are the two filters that matter:
 * "which courses articulate to this university" and "which courses does this
 * college offer".
 */
exports.courses = asyncHandler(async (req, res) => {
  const q = {};
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
    q.$or = [{ code: rx }, { title: rx }, { department: rx }];
  }
  if (req.query.department) q.department = String(req.query.department);
  if (req.query.college) q.offered_by = String(req.query.college);
  const requestedReceiver = req.query.receiver ? String(req.query.receiver).trim() : null;
  const receiverIdentity = requestedReceiver ? canonicalInstitutionIdentity(requestedReceiver) : null;
  const receiverNames = requestedReceiver
    ? sourceNamesForInstitution(requestedReceiver)
    : [];
  if (requestedReceiver) {
    q['articulates_to.institution'] = receiverNames.length === 1
      ? receiverNames[0]
      : { $in: receiverNames };
  }
  if (req.query.prefix) q.code = new RegExp(`^${escapeRegex(String(req.query.prefix))}`, 'i');

  const limit = Math.min(2000, intOr(req.query.limit, 200));
  const skip = Math.max(0, intOr(req.query.skip, 0));
  const coll = req.app.locals.db.collection(COURSES);

  // Browsing from the receiving side needs the target course, not just the
  // fact that one exists — "CSC221 lands as CS108" is the whole point of the
  // view — so the matching equivalency is projected onto each row.
  const receiver = receiverIdentity?.name || null;
  const projection = {
    course_id: 1, course_key: 1, code: 1, title: 1, credits: 1,
    department: 1, counts: 1, source_url: 1,
  };
  if (receiver) projection.articulates_to = 1;

  const [rows, total] = await Promise.all([
    coll.find(q, { projection }).sort({ code: 1 }).skip(skip).limit(limit).toArray(),
    coll.countDocuments(q),
  ]);
  const courses = rows.map(({ articulates_to, ...row }) => {
    const course = withCourseIdentity(row);
    if (!receiver) return course;
    const landings = (articulates_to || [])
      .filter((e) => receiverNames.includes(e.institution))
      .map(withUniversityCourseIdentity);
    return {
      ...course,
      // Backward compatibility for the web table and existing notebooks.
      lands_as: landings[0] || null,
      // Lossless form for pairs with more than one receiving target.
      landings,
    };
  });
  res.json({ courses, total, skip, limit, receiver, receiver_sources: receiverNames });
});

/** One course in full: description, the colleges that offer it, every target. */
exports.course = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').replace(/\s+/g, '').toUpperCase();
  const doc = await req.app.locals.db.collection(COURSES).findOne({ code });
  if (!doc) return res.status(404).json({ error: `no course ${code}` });
  res.json({
    course: withCourseIdentity({
      ...doc,
      articulates_to: (doc.articulates_to || []).map(withUniversityCourseIdentity),
    }),
  });
});

/** Distinct departments with course counts, for the filter control. */
exports.departments = asyncHandler(async (req, res) => {
  const rows = await req.app.locals.db.collection(COURSES).aggregate([
    { $group: { _id: '$department', courses: { $sum: 1 } } },
    { $match: { _id: { $ne: null } } },
    { $sort: { courses: -1 } },
  ]).toArray();
  res.json({ departments: rows.map((r) => ({ department: r._id, courses: r.courses })) });
});

/**
 * College × university reachability: for each community college, how many
 * corpus courses it offers that carry an equivalency at each four-year
 * institution.
 *
 * A cell is a count of shared courses, nothing stronger. It says the college
 * teaches N courses this university has agreed to accept — not that N is
 * sufficient for any particular degree.
 */
exports.matrix = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const requestedCohort = String(req.query.cohort || '').trim() || null;
  const receivingCohorts = [
    PRIMARY_COHORT_ID, OTHER_FOUR_YEAR_COHORT_ID, EXTERNAL_RECEIVER_COHORT_ID,
  ];
  if (requestedCohort && !receivingCohorts.includes(requestedCohort)) {
    return res.status(400).json({
      error: `unknown Virginia receiving cohort: ${requestedCohort}`,
      cohorts: receivingCohorts,
    });
  }
  const rows = await db.collection(COURSES)
    .find({}, { projection: { offered_by: 1, 'articulates_to.institution': 1 } }).toArray();

  // The row axis is community colleges only. `offered_by` legitimately names
  // any institution whose catalog carries the course, and for the handful of
  // non-VCCS codes in scope (Richard Bland numbering: HIST201, ENGL…) the
  // course search returns a four-year-owned record — so using it unfiltered
  // would put universities on the sending axis of a sending→receiving view.
  const ccNames = new Set((await db.collection(INSTITUTIONS)
    .find({ level: 'community_college' }, { projection: { name: 1 } }).toArray()).map((i) => i.name));

  const colleges = new Map();
  const receiverTotals = new Map();
  if (requestedCohort === PRIMARY_COHORT_ID) {
    for (const slug of primaryCohort.institution_slugs) {
      receiverTotals.set(registryInstitutionFor(slug).name, 0);
    }
  }
  for (const r of rows) {
    for (const c of r.offered_by || []) {
      if (!ccNames.has(c)) continue;
      if (!colleges.has(c)) colleges.set(c, new Map());
      const bucket = colleges.get(c);
      // A course with two target courses at one university is still one shared
      // VCCS course in this matrix, not two.
      const receivers = new Set((r.articulates_to || [])
        .map((e) => e.institution && canonicalInstitutionIdentity(e.institution).name)
        .filter(Boolean));
      for (const receiver of receivers) {
        const canonical = canonicalInstitutionIdentity(receiver);
        const decorated = decorateInstitution({ name: canonical.name, level: 'four_year' });
        if (requestedCohort && decorated.cohort !== requestedCohort) continue;
        bucket.set(receiver, (bucket.get(receiver) || 0) + 1);
        receiverTotals.set(receiver, (receiverTotals.get(receiver) || 0) + 1);
      }
    }
  }
  const collegeNames = [...colleges.keys()].sort();
  const receiverNames = requestedCohort === PRIMARY_COHORT_ID
    ? primaryCohort.institution_slugs.map((slug) => registryInstitutionFor(slug).name)
    : [...receiverTotals.keys()].sort();
  res.json({
    colleges: collegeNames,
    receivers: receiverNames,
    receiver_institutions: receiverNames.map((name) => decorateInstitution({ name, level: 'four_year' })),
    cells: collegeNames.map((c) => receiverNames.map((r) => colleges.get(c).get(r) || 0)),
    courses: rows.length,
    cohort: requestedCohort,
  });
});

/**
 * CS degrees for one institution, in the canonical `as_degree` / `degree`
 * shape. Both sources are returned when both exist — the institution's own
 * catalog and Transfer Virginia's program map — because they are independent
 * and a hand verifier wants to see the disagreement, not an averaged answer.
 */
exports.degrees = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const requestedInstitution = String(req.query.institution || '').trim();
  if (!requestedInstitution) return res.status(400).json({ error: 'institution is required' });
  const canonicalInstitution = canonicalInstitutionIdentity(requestedInstitution);
  const institution = canonicalInstitution.name;
  const institutionSourceNames = sourceNamesForInstitution(requestedInstitution);

  // `codes` is an escape hatch for building a document from scratch. It
  // resolves the same project-minted identity the importers would use for a
  // syntactically valid code, without claiming the course exists in a catalog.
  const codeParams = req.query.codes == null
    ? []
    : (Array.isArray(req.query.codes) ? req.query.codes : [req.query.codes]);
  const rawRequestedCodes = codeParams
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  if (rawRequestedCodes.length > 500) {
    return res.status(400).json({ error: 'codes accepts at most 500 comma-separated course codes' });
  }
  const invalidCodes = rawRequestedCodes.filter((code) => courseIdFor(code) == null);
  if (invalidCodes.length) {
    return res.status(400).json({
      error: 'codes must be course-shaped (letters followed by a course number)',
      invalid_codes: [...new Set(invalidCodes)],
    });
  }
  const requestedCodes = [...new Set(rawRequestedCodes.map(canonicalCourseCode))];

  const slug = canonicalInstitution.slug;
  // One degree per institution. Two sources were captured — the college's own
  // catalogue and Transfer Virginia's program map — and both were kept so a
  // verifier could see disagreement. They did not disagree: where both stated
  // units they matched in 11 of 11 cases. The richer document now survives as
  // the single record, carrying the other's URL under `corroborating_sources`,
  // and the losers are marked `superseded` rather than deleted.
  const [docs, institutionRecord] = await Promise.all([
    db.collection(REQUIREMENTS)
      .find({
        $or: [{ college_id: `va:cc:${slug}` }, { school_id: `va:uni:${slug}` }],
        status: { $nin: ['superseded', 'out_of_scope'] },
      })
      .toArray(),
    db.collection(INSTITUTIONS).findOne({
      $or: [
        { name: { $in: institutionSourceNames } },
        { _id: { $in: institutionSourceNames.map((name) => (
          `va:inst:${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
        )) } },
      ],
    }),
  ]);

  const documentKinds = new Set(docs.map((doc) => doc.kind));
  const registryLevel = canonicalInstitution.institution?.level || null;
  const ownerSide = institutionRecord?.level === 'community_college' || registryLevel === 'community_college'
    ? 'community_college'
    : institutionRecord?.level === 'four_year' || registryLevel === 'four_year'
      ? 'four_year'
      : documentKinds.has('as_degree') && !documentKinds.has('degree')
        ? 'community_college'
        : documentKinds.has('degree')
          ? 'four_year'
          : null;
  if (requestedCodes.length && !ownerSide) {
    return res.status(400).json({ error: `unknown Virginia institution: ${requestedInstitution}` });
  }
  const ownerId = ownerSide === 'community_college'
    ? docs.find((doc) => doc.college_id)?.college_id ?? `va:cc:${slug}`
    : ownerSide === 'four_year'
      ? docs.find((doc) => doc.school_id)?.school_id ?? `va:uni:${slug}`
      : null;
  const localCourseNamespace = ownerSide === 'community_college'
    ? docs.map((doc) => doc.course_namespace).find((namespace) => (
      namespace?.kind === 'institution_local'
      && namespace.institution_id === ownerId
      && namespace.vccs_master_applicable === false
      && namespace.identity_contract === 'owner_plus_course_id'
      && namespace.scoped_key_format === `${ownerId}:<code>`
    ))
    : null;
  const localCourseIdentity = (code) => (localCourseNamespace ? {
    college_id: ownerId,
    institution_id: ownerId,
    identity_scope: 'institution_local',
    scoped_course_key: code ? `${ownerId}:${code}` : null,
  } : {});

  // The shared RequirementsLedger resolves courses on BOTH sides, and they use
  // different lookups:
  //   left  (the requirement)  — `receiving.parent_id` via `universityCoursesById`
  //   right (what satisfies it) — `options[].course_ids` via a `courses` array
  //                               matched on `course_id`
  // Supplying only the first leaves the sending side rendering raw ids, which
  // is exactly what a reader sees as "just numbers". The lookups also include
  // valid catalog codes not yet referenced by the tree so a researcher can add
  // a missing requirement without first reverse-engineering its id.
  const parentIds = new Map();   // parent_id -> code_seen
  const parentUnits = new Map(); // singular receiver units, keyed by parent_id
  const courseIds = new Map();   // course_id -> readable course_key, when kept
  const universityCatalogCodes = new Set();
  const universityDocumentCodes = new Set();
  const communityCollegeDocumentCodes = new Set();
  for (const d of docs) {
    if (d.kind === 'degree') {
      for (const code of d.codes_seen || []) {
        const canonical = canonicalCourseCode(code);
        if (courseIdFor(canonical) != null) {
          universityCatalogCodes.add(canonical);
          universityDocumentCodes.add(canonical);
        }
      }
      for (const code of Object.keys(d.course_titles || {})) {
        const canonical = canonicalCourseCode(code);
        if (courseIdFor(canonical) != null) {
          universityCatalogCodes.add(canonical);
          universityDocumentCodes.add(canonical);
        }
      }
    }
    if (d.kind === 'as_degree') {
      const catalogCodes = [
        ...(d.codes_seen || []),
        ...Object.keys(d.course_titles || {}),
      ];
      for (const code of catalogCodes) {
        const canonical = canonicalCourseCode(code);
        const id = courseIdFor(canonical);
        if (id != null) {
          communityCollegeDocumentCodes.add(canonical);
          if (!courseIds.has(id)) courseIds.set(id, courseKeyFor(canonical));
        }
      }
    }
    for (const g of d.requirement_groups || []) {
      for (const s of g.sections || []) {
        for (const r of s.receivers || []) {
          if (r.receiving?.parent_id != null && r.code_seen) {
            const code = canonicalCourseCode(r.code_seen);
            if (courseIdFor(code) != null) {
              parentIds.set(r.receiving.parent_id, code);
              universityDocumentCodes.add(code);
              const units = Number(r.receiving.units);
              if (r.receiving.units != null && Number.isFinite(units)
                && !parentUnits.has(r.receiving.parent_id)) {
                parentUnits.set(r.receiving.parent_id, units);
              }
            }
          }
          // A series receiver names its members in `parent_ids` and carries no
          // singular `parent_id`. Mapping only the singular left every member of
          // every series unresolved, and the ledger renders an unresolved id as
          // `#914981327` — the bare numbers a reader sees instead of a course.
          //
          // Extracted OR-era records use `/`, while source-composed AND series
          // use `+`. In both cases the codes are positionally aligned with the
          // ids, so split either explicit separator and zip against the ids.
          const seriesIds = r.receiving?.parent_ids || [];
          if (seriesIds.length) {
            const seriesCodes = String(r.code_seen || '').split(/\s*(?:\/|\+)\s*/).map((x) => x.trim()).filter(Boolean);
            seriesIds.forEach((pid, i) => {
              if (pid == null) return;
              // A repeated id inside a series (four exist) keeps the first code
              // rather than being relabelled by a later position.
              const code = canonicalCourseCode(seriesCodes[i] || seriesCodes[0]);
              if (courseIdFor(code) != null) {
                universityDocumentCodes.add(code);
                if (!parentIds.has(pid)) parentIds.set(pid, code);
              }
            });
          }
          for (const o of r.options || []) {
            (o.course_ids || []).forEach((id, index) => {
              const key = (o.course_keys || [])[index] || null;
              const code = canonicalCourseCode(String(key || '').replace(/^va:/i, ''));
              if (courseIdFor(code) != null) communityCollegeDocumentCodes.add(code);
              if (!courseIds.has(id) || (!courseIds.get(id) && key)) courseIds.set(id, key);
            });
          }
        }
      }
    }
  }

  // Requested codes are side-aware. The same deterministic number is called a
  // `course_id` for a VCCS sender and a `parent_id` for a receiving university.
  // Institution validation above prevents a caller from accidentally building
  // the wrong object shape for an unknown name.
  if (ownerSide === 'community_college') {
    for (const code of requestedCodes) {
      const courseId = courseIdFor(code);
      if (!courseIds.has(courseId)) courseIds.set(courseId, courseKeyFor(code));
    }
  } else if (ownerSide === 'four_year') {
    for (const code of requestedCodes) universityCatalogCodes.add(code);
  }

  // Include every concrete course named by the university catalog, not only
  // courses that the current requirement tree already references. Without this
  // additive catalog, repairing a missing requirement would require knowing its
  // parent_id before the API could reveal that parent_id.
  const parentCodes = new Set(parentIds.values());
  for (const code of universityCatalogCodes) {
    if (parentCodes.has(code)) continue;
    const parentId = courseIdFor(code);
    if (parentId != null && !parentIds.has(parentId)) parentIds.set(parentId, code);
  }

  // `va_courses` contains VCCS sending courses only. Never use a same-code row
  // from this collection to supply a university title or unit value.
  const referenced = courseIds.size
    ? await db.collection(COURSES).find(
      { course_id: { $in: [...courseIds.keys()] } },
      {
        projection: {
          code: 1, title: 1, credits: 1, course_id: 1, course_key: 1, offered_by: 1,
        },
      }
    ).toArray()
    : [];
  const byCourseId = new Map(referenced.map((c) => [c.course_id, c]));

  const split = (code) => {
    const m = /^([A-Za-z]+)(\d.*)$/.exec(code || '');
    return { prefix: m ? m[1] : code, number: m ? m[2] : '' };
  };

  // Titles harvested from each institution's own catalog page. Four-year
  // courses are not in `va_courses`, so without this their requirements render
  // as a bare code — the reason a reader saw unnamed courses.
  const catalogTitles = new Map();
  const universityCatalogTitles = new Map();
  for (const d of docs) {
    for (const [rawCode, title] of Object.entries(d.course_titles || {})) {
      const code = canonicalCourseCode(rawCode);
      if (!catalogTitles.has(code)) catalogTitles.set(code, title);
      if (d.kind === 'degree' && !universityCatalogTitles.has(code)) {
        universityCatalogTitles.set(code, title);
      }
    }
  }

  const universityCoursesById = {};
  for (const [pid, code] of parentIds) {
    const numericParentId = Number.isFinite(Number(pid)) ? Number(pid) : pid;
    const documentNamed = universityDocumentCodes.has(code);
    const units = parentUnits.get(pid) ?? null;
    universityCoursesById[pid] = {
      parent_id: numericParentId,
      code,
      institution,
      school_id: ownerId,
      ...split(code),
      title: universityCatalogTitles.get(code) ?? null,
      min_units: units,
      max_units: units,
      document_named: documentNamed,
      identity_source: documentNamed ? 'degree_document' : 'requested_code',
    };
  }

  // Sending side: `{ course_id, prefix, number, title, units }`, the shape
  // `CcCourse` matches on. Ids with no course record still get a readable code
  // where the document preserved one, rather than falling back to `#id`.
  const courses = [...courseIds].map(([id, referencedKey]) => {
    const hit = byCourseId.get(id);
    if (hit) {
      const code = canonicalCourseCode(hit.code);
      const documentNamed = communityCollegeDocumentCodes.has(code);
      const offeredAtOwner = (hit.offered_by || []).some((name) => institutionSourceNames.includes(name));
      return {
        course_id: id,
        course_key: hit.course_key ?? referencedKey ?? courseKeyFor(hit.code),
        code,
        ...localCourseIdentity(code),
        ...split(code),
        // Institution-local numbering (notably Richard Bland) can collide with
        // an unrelated VCCS/four-year row. Prefer the selected college's own
        // degree title, and trust corpus credits only when that college offers
        // the matched course.
        title: catalogTitles.get(code) ?? (offeredAtOwner ? hit.title : null),
        units: offeredAtOwner ? hit.credits ?? null : null,
        document_named: documentNamed,
        identity_source: documentNamed ? 'degree_document' : 'requested_code',
      };
    }
    const code = canonicalCourseCode(String(referencedKey || '').replace(/^va:/, ''));
    if (courseIdFor(code) != null) {
      const documentNamed = communityCollegeDocumentCodes.has(code);
      return {
        course_id: id,
        course_key: referencedKey || courseKeyFor(code),
        code,
        ...localCourseIdentity(code),
        ...split(code),
        title: catalogTitles.get(code) ?? null,
        units: null,
        document_named: documentNamed,
        identity_source: documentNamed ? 'degree_document' : 'requested_code',
      };
    }
    return {
      course_id: id, course_key: referencedKey, code: null,
      ...localCourseIdentity(null),
      prefix: '#', number: String(id), title: null, units: null,
      document_named: true,
      identity_source: 'degree_document',
    };
  });

  res.json({
    institution,
    requested_institution: requestedInstitution,
    institution_slug: slug,
    institution_sources: institutionSourceNames,
    owner_id: ownerId,
    degrees: docs,
    university_courses_by_id: universityCoursesById,
    university_courses: Object.values(universityCoursesById),
    courses,
  });
});

/** One requirement document reduced to what a verifier needs to triage it. */
function verificationState(doc) {
  const groups = doc.requirement_groups || [];
  const catalogAccepted = doc.acceptance?.accepted === true
    || ['catalog_accepted', 'analysis_ready'].includes(doc.collection_status);
  return {
    doc_id: doc._id,
    source: doc.source,
    status: doc.status,
    verified: doc.verification?.verified === true,
    verified_by_label: doc.verification?.verified_by_label ?? null,
    verified_at: doc.verification?.verified_at ?? null,
    has_notes: Boolean(doc.verification?.notes),
    collection_status: doc.collection_status ?? null,
    catalog_accepted: catalogAccepted,
    analysis_ready: doc.acceptance?.ready_for_analysis === true
      || doc.collection_status === 'analysis_ready',
    acceptance_failures: doc.acceptance ? {
      catalog: doc.acceptance.catalog?.failed || [],
      analysis: doc.acceptance.analysis_ready?.failed || [],
    } : null,
    // The machine's own verdict on the parse. It does not substitute for a
    // human reading the page, but it says where to look hardest first.
    validation: doc.provenance?.validation?.verdict ?? null,
    groups: groups.length,
    receivers: groups.reduce((n, g) => n + (g.sections || []).reduce((m, s) => m + (s.receivers || []).length, 0), 0),
    total_units: doc.total_units ?? null,
    url: doc.catalog_url || doc.source_url || null,
  };
}

/**
 * Which institutions offer CS, whether their requirements are collected, and
 * where each one stands with a human verifier.
 *
 * The verification state ships with coverage rather than as a second endpoint
 * because they answer one question between them — *what is left to do* — and
 * splitting them would make the landing view fetch twice to render one table.
 *
 * Both documents an institution can hold are returned, not just the catalog
 * one. A college whose catalog degree is verified while its Transfer Virginia
 * map is not is genuinely half-done, and collapsing that to a single tick would
 * hide the remaining work.
 */
exports.coverage = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const [storedRows, docs] = await Promise.all([
    db.collection(COVERAGE).find({}).sort({ institution: 1 }).toArray(),
    db.collection(REQUIREMENTS).find({ status: { $nin: ['superseded', 'out_of_scope'] } }, {
      projection: {
        kind: 1, source: 1, status: 1, verification: 1, college_id: 1, school_id: 1,
        requirement_groups: 1, total_units: 1, catalog_url: 1, source_url: 1,
        collection_status: 1, acceptance: 1,
        'provenance.validation.verdict': 1,
      },
    }).toArray(),
  ]);

  // Coverage is a research-work queue, so every primary public university must
  // be visible even before it has an extraction row.  These virtual rows are
  // explicit `not_collected` records, never `url_only` or `no_program`.
  const rows = [...storedRows];
  const storedSlugs = new Set(rows.map((row) => {
    const idSlug = String(row._id || '').replace(/^va:cov:(cc|uni):/, '');
    return canonicalInstitutionIdentity({ institution_slug: idSlug, name: row.institution }).slug;
  }));
  for (const slug of primaryCohort.institution_slugs) {
    if (storedSlugs.has(slug)) continue;
    const institution = registryInstitutionFor(slug);
    rows.push({
      _id: `va:cov:uni:${slug}`,
      institution: institution.name,
      level: 'four_year',
      offers_cs: null,
      registry_url: institution.catalog_root || null,
      source_url: null,
      outcome: 'not_collected',
      validation: null,
      source_composed: false,
      publication_eligible: false,
      publication_blocker: 'current_extraction_required',
      catalog_accepted: false,
      analysis_ready: false,
      acceptance_failures: null,
      collected: false,
      registry_only: true,
    });
  }

  // Coverage rows are keyed `va:cov:<cc|uni>:<slug>` and documents by
  // `va:cc:<slug>` / `va:uni:<slug>`, so the slug is the join.
  const bySlug = new Map();
  for (const doc of docs) {
    const owner = doc.college_id || doc.school_id || '';
    const slug = owner.replace(/^va:(cc|uni):/, '');
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, { as_degree: [], degree: [] });
    const bucket = bySlug.get(slug)[doc.kind];
    if (bucket) bucket.push(verificationState(doc));
  }

  const enriched = rows.map((row) => {
    const rawSlug = String(row._id).replace(/^va:cov:(cc|uni):/, '');
    const institutionMetadata = decorateInstitution({
      name: row.institution,
      level: row.level,
      institution_slug: rawSlug,
    }, { corpusPresent: row.registry_only !== true });
    const slug = institutionMetadata.institution_slug;
    const found = bySlug.get(slug) || { as_degree: [], degree: [] };
    // Catalog first — it is the spine, the program map is corroboration.
    const order = (list) => [...list].sort((a, b) => (a.source === 'institution_catalog' ? -1 : 1));
    const documents = { as_degree: order(found.as_degree), degree: order(found.degree) };
    const documentList = [...documents.as_degree, ...documents.degree];
    const collectionStatus = row.offers_cs === false || row.outcome === 'no_cs_program'
      ? 'no_program'
      : row.registry_only ? 'not_collected'
      : row.outcome === 'url_only' ? 'catalog_url_only'
      : row.collected || documentList.length ? 'catalog_collected'
      : row.outcome === 'captured' ? 'captured_needs_review'
      : 'not_collected';
    return {
      ...row,
      institution: institutionMetadata.name,
      institution_slug: slug,
      cohort: institutionMetadata.cohort,
      is_primary: institutionMetadata.is_primary,
      scope_source_url: institutionMetadata.scope_source_url,
      cohort_rank: institutionMetadata.cohort_rank,
      corpus_present: institutionMetadata.corpus_present,
      collection_status: collectionStatus,
      needs_collection: ['not_collected', 'catalog_url_only', 'captured_needs_review'].includes(collectionStatus),
      documents,
    };
  }).sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.is_primary) return a.cohort_rank - b.cohort_rank;
    return a.institution.localeCompare(b.institution);
  });

  const all = enriched.flatMap((r) => [...r.documents.as_degree, ...r.documents.degree]);
  // A parser-only document is reviewable but cannot be signed under the
  // acceptance gate. Keep it out of the verification denominator so the
  // progress figure never asks researchers to complete an impossible action.
  const reviewable = all.filter((d) => d.status === 'extracted');
  const verifiable = reviewable.filter((d) => d.catalog_accepted);

  res.json({
    coverage: enriched,
    collected: rows.filter((r) => r.collected).length,
    total: rows.length,
    public_four_year: primaryCohort.institution_slugs.length,
    verification: {
      documents: all.length,
      reviewable: reviewable.length,
      verifiable: verifiable.length,
      verified: verifiable.filter((d) => d.verified).length,
      as_verifiable: verifiable.filter((d) => d.doc_id.startsWith('va:as:')).length,
      as_verified: verifiable.filter((d) => d.doc_id.startsWith('va:as:') && d.verified).length,
      bs_verifiable: verifiable.filter((d) => d.doc_id.startsWith('va:degree:')).length,
      bs_verified: verifiable.filter((d) => d.doc_id.startsWith('va:degree:') && d.verified).length,
    },
  });
});

/**
 * Hand-edit a Virginia degree document.
 *
 * Deliberately the same contract as California's `PUT /curated/requirements/:kind`:
 * same stamping (`curated_by`, `curated_at`, `updated_at`), the same
 * authoritative verification stamp taken from the signed-in user rather than
 * the request body, and the same append-only revision log. The only difference
 * is storage — `va_requirements` / `va_revisions` — so the two states stay
 * separable in Mongo while behaving identically to edit.
 *
 * Notes are never written here on the user's behalf; `verification.notes` is
 * passed through exactly as submitted.
 */
exports.putDegree = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const row = req.body || {};
  const id = String(req.params.id || row._id || '').trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  if (!EDITABLE_KINDS.has(row.kind)) {
    return res.status(400).json({ error: `kind must be one of ${[...EDITABLE_KINDS].join(', ')}` });
  }

  const before = await db.collection(REQUIREMENTS).findOne({ _id: id });
  // Documents returned by GET carry `updated_at`; treat it as an optimistic
  // concurrency token. This prevents a stale browser save from restoring the
  // pre-publication tree after an atomic catalog import has completed.
  if (before && row.updated_at != null && !sameUpdateToken(before.updated_at, row.updated_at)) {
    return res.status(409).json({
      error: 'This degree changed after it was loaded. Refresh it before saving.',
      current_updated_at: before.updated_at ?? null,
    });
  }
  const canonical = {
    ...row,
    _id: id,
    curated_by: req.user?.uid ?? null,
    curated_at: new Date(),
    updated_at: new Date(),
  };

  // Acceptance is always recalculated from the submitted tree. A caller may
  // edit a partial document, but cannot self-assert `acceptance.accepted` in
  // the request body and then sign it as a complete degree.
  let catalogCodes = new Set();
  if (canonical.kind === 'as_degree') {
    const ownerSlug = String(canonical.college_id || canonical.community_college_id || '')
      .replace(/^va:cc:/, '');
    const owner = await db.collection(INSTITUTIONS).findOne({
      $or: [{ _id: `va:inst:${ownerSlug}` }, { slug: ownerSlug }],
    });
    if (owner?.name) {
      catalogCodes = new Set((await db.collection(COURSES).find(
        { offered_by: owner.name }, { projection: { code: 1 } },
      ).toArray()).map((courseRow) => canonicalCourseCode(courseRow.code)));
    }
  }
  canonical.acceptance = validateDegreeAcceptance(canonical, {
    institutionLevel: canonical.kind === 'as_degree' ? 'community_college' : 'four_year',
    resolveCourse: degreeCourseResolver(canonical, catalogCodes),
  });
  canonical.collection_status = canonical.acceptance.ready_for_analysis
    ? 'analysis_ready'
    : canonical.acceptance.accepted
      ? 'catalog_accepted'
      : (canonical.collection_status === 'captured_only' ? 'captured_only' : 'major_only');

  const requestedVerified = canonical.verification?.verified === true;
  if (requestedVerified && !canonical.acceptance.accepted) {
    return res.status(400).json({
      error: 'This degree is not catalog-complete and cannot be verified yet.',
      acceptance_failures: canonical.acceptance.catalog.failed,
    });
  }

  const changedAfterVerification = before?.verification?.verified === true
    && verificationMaterialChanges(before, canonical).length > 0;
  if (changedAfterVerification && !canonical.verification) canonical.verification = { verified: false };

  // The verdict is stamped from the signed-in user, never from the body, and
  // cleared on reopen so a stale name cannot linger on an unverified record.
  // Editing a signed degree reopens it even if a stale browser submitted the
  // old `verified: true` value alongside the edit.
  if (canonical.verification) {
    const verified = requestedVerified && !changedAfterVerification;
    const preservingVerdict = verified && before?.verification?.verified === true;
    canonical.verification.verified = verified;
    canonical.verification.verified_at = verified
      ? (preservingVerdict ? before.verification.verified_at : new Date()) : null;
    canonical.verification.verified_by = verified
      ? (preservingVerdict ? before.verification.verified_by : (req.user?.uid ?? null)) : null;
    canonical.verification.verified_by_label = verified
      ? (preservingVerdict
        ? before.verification.verified_by_label
        : (req.user?.name || req.user?.email || null)) : null;
    if (changedAfterVerification) {
      canonical.verification.stale = true;
      canonical.verification.stale_reason = 'degree content changed after verification';
      canonical.verification.previous = before.verification;
    } else if (verified) {
      canonical.verification.stale = false;
      canonical.verification.stale_reason = null;
      delete canonical.verification.previous;
    }
  }

  const saveFilter = before
    ? {
      _id: id,
      ...(before.updated_at != null
        ? { updated_at: before.updated_at }
        : { updated_at: { $exists: false } }),
    }
    : { _id: id };
  const saveResult = await db.collection(REQUIREMENTS).replaceOne(
    saveFilter,
    canonical,
    { upsert: !before },
  );
  if (before && saveResult.matchedCount !== 1) {
    return res.status(409).json({
      error: 'This degree changed while it was being saved. Refresh it and try again.',
    });
  }

  // A save that changed nothing human-meaningful writes no revision, so the
  // history stays a list of real edits rather than of save clicks.
  const changes = diffDocs(before, canonical);
  if (!before || changes.length) {
    await db.collection(REVISIONS).insertOne({
      doc_id: id,
      kind: canonical.kind,
      at: new Date(),
      by_uid: req.user?.uid ?? null,
      by_label: req.user?.name || req.user?.email || null,
      created: !before,
      verified: !!canonical.verification?.verified,
      changes,
    });
  }
  res.json({
    ok: true,
    id,
    revision_recorded: !before || changes.length > 0,
    verification_reopened: changedAfterVerification,
    acceptance: canonical.acceptance,
  });
});

/** Remove a degree document, recording the deletion in the revision log. */
exports.deleteDegree = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const id = String(req.params.id || '').trim();
  const before = await db.collection(REQUIREMENTS).findOne({ _id: id });
  if (!before) return res.status(404).json({ error: `no document ${id}` });
  await db.collection(REQUIREMENTS).deleteOne({ _id: id });
  await db.collection(REVISIONS).insertOne({
    doc_id: id,
    kind: before.kind,
    at: new Date(),
    by_uid: req.user?.uid ?? null,
    by_label: req.user?.name || req.user?.email || null,
    deleted: true,
    changes: diffDocs(before, null),
  });
  res.json({ ok: true, id });
});

/** Hand-edit history for one degree document. Admin-only, as in California. */
exports.degreeRevisions = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  const rows = await req.app.locals.db.collection(REVISIONS)
    .find({ doc_id: id }).sort({ at: -1 }).limit(200).toArray();
  res.json({
    doc_id: id,
    revisions: rows.map((r) => ({
      id: String(r._id),
      at: r.at,
      by: r.by_label || r.by_uid || null,
      created: !!r.created,
      deleted: !!r.deleted,
      verified: !!r.verified,
      changes: r.changes || [],
    })),
  });
});
