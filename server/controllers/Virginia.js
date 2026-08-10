/**
 * Read-only API over the Transfer Virginia course corpus.
 *
 * Two collections, `va_courses` and `va_institutions`, both written by
 * `scripts/importVirginiaCourses.js`. Nothing here writes, and nothing here
 * reads the ASSIST collections: Virginia is a separate dataset under
 * evaluation, not a second source feeding the California analyses.
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

const COURSES = 'va_courses';
const INSTITUTIONS = 'va_institutions';
const REQUIREMENTS = 'va_requirements';
const COVERAGE = 'va_coverage';
const REVISIONS = 'va_revisions';

/** The two document kinds `va_requirements` holds, mirroring California. */
const EDITABLE_KINDS = new Set(['as_degree', 'degree']);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const intOr = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

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
  if (!courses) return res.json({ imported: false, courses: 0, institutions: 0 });

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
 *   no_program — the institution offers no CS degree (not a gap)
 *   alias      — a renamed duplicate; the degree is filed under the other name
 *   none       — no degree document at all
 */
exports.institutions = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const q = req.query.level ? { level: String(req.query.level) } : {};
  const rows = await db.collection(INSTITUTIONS).find(q).sort({ name: 1 }).toArray();

  const degrees = await db.collection(REQUIREMENTS)
    .find({ source: 'institution_catalog' },
      { projection: { college_id: 1, school_id: 1, codes_seen: 1, total_units: 1, verification: 1, offers_cs: 1 } })
    .toArray();
  const byOwner = new Map(degrees.map((d) => [d.college_id || d.school_id, d]));
  const slugOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  res.json({
    institutions: rows.map((i) => {
      const key = i.level === 'community_college' ? `va:cc:${slugOf(i.name)}` : `va:uni:${slugOf(i.name)}`;
      const d = byOwner.get(key);
      // Five distinct facts, because collapsing them answers the wrong
      // question: "no published course list" is a data gap, "offers no CS
      // degree" is a fact about the institution.
      const status = !d ? (i.alias_of ? 'alias' : 'none')
        : d.offers_cs === false ? 'no_program'
        : (d.codes_seen || []).length ? 'full'
        : 'url_only';
      return {
        ...i,
        degree_status: status,
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
  if (req.query.receiver) q['articulates_to.institution'] = String(req.query.receiver);
  if (req.query.prefix) q.code = new RegExp(`^${escapeRegex(String(req.query.prefix))}`, 'i');

  const limit = Math.min(2000, intOr(req.query.limit, 200));
  const skip = Math.max(0, intOr(req.query.skip, 0));
  const coll = req.app.locals.db.collection(COURSES);

  // Browsing from the receiving side needs the target course, not just the
  // fact that one exists — "CSC221 lands as CS108" is the whole point of the
  // view — so the matching equivalency is projected onto each row.
  const receiver = req.query.receiver ? String(req.query.receiver) : null;
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
      .filter((e) => e.institution === receiver)
      .map(withUniversityCourseIdentity);
    return {
      ...course,
      // Backward compatibility for the web table and existing notebooks.
      lands_as: landings[0] || null,
      // Lossless form for pairs with more than one receiving target.
      landings,
    };
  });
  res.json({ courses, total, skip, limit, receiver });
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
  for (const r of rows) {
    for (const c of r.offered_by || []) {
      if (!ccNames.has(c)) continue;
      if (!colleges.has(c)) colleges.set(c, new Map());
      const bucket = colleges.get(c);
      // A course with two target courses at one university is still one shared
      // VCCS course in this matrix, not two.
      const receivers = new Set((r.articulates_to || []).map((e) => e.institution).filter(Boolean));
      for (const receiver of receivers) {
        bucket.set(receiver, (bucket.get(receiver) || 0) + 1);
        receiverTotals.set(receiver, (receiverTotals.get(receiver) || 0) + 1);
      }
    }
  }
  const collegeNames = [...colleges.keys()].sort();
  const receiverNames = [...receiverTotals.keys()].sort();
  res.json({
    colleges: collegeNames,
    receivers: receiverNames,
    cells: collegeNames.map((c) => receiverNames.map((r) => colleges.get(c).get(r) || 0)),
    courses: rows.length,
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
  const institution = String(req.query.institution || '').trim();
  if (!institution) return res.status(400).json({ error: 'institution is required' });

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

  const slug = institution.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
      $or: [{ name: institution }, { _id: `va:inst:${slug}` }],
    }),
  ]);

  const documentKinds = new Set(docs.map((doc) => doc.kind));
  const ownerSide = institutionRecord?.level === 'community_college'
    ? 'community_college'
    : institutionRecord?.level === 'four_year'
      ? 'four_year'
      : documentKinds.has('as_degree') && !documentKinds.has('degree')
        ? 'community_college'
        : documentKinds.has('degree')
          ? 'four_year'
          : null;
  if (requestedCodes.length && !ownerSide) {
    return res.status(400).json({ error: `unknown Virginia institution: ${institution}` });
  }
  const ownerId = ownerSide === 'community_college'
    ? docs.find((doc) => doc.college_id)?.college_id ?? `va:cc:${slug}`
    : ownerSide === 'four_year'
      ? docs.find((doc) => doc.school_id)?.school_id ?? `va:uni:${slug}`
      : null;

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
          // The extractors record a series' codes as one `/`-separated string
          // positionally aligned with the ids: `parent_ids: [a, b]` alongside
          // `code_seen: "CS108 / CS109"`. All 46 series in the corpus take that
          // shape, so the string is split and zipped against the ids.
          const seriesIds = r.receiving?.parent_ids || [];
          if (seriesIds.length) {
            const seriesCodes = String(r.code_seen || '').split('/').map((x) => x.trim()).filter(Boolean);
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
      const offeredAtOwner = (hit.offered_by || []).includes(institution);
      return {
        course_id: id,
        course_key: hit.course_key ?? referencedKey ?? courseKeyFor(hit.code),
        code,
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
        ...split(code),
        title: catalogTitles.get(code) ?? null,
        units: null,
        document_named: documentNamed,
        identity_source: documentNamed ? 'degree_document' : 'requested_code',
      };
    }
    return {
      course_id: id, course_key: referencedKey, code: null,
      prefix: '#', number: String(id), title: null, units: null,
      document_named: true,
      identity_source: 'degree_document',
    };
  });

  res.json({
    institution,
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
  return {
    doc_id: doc._id,
    source: doc.source,
    status: doc.status,
    verified: doc.verification?.verified === true,
    verified_by_label: doc.verification?.verified_by_label ?? null,
    verified_at: doc.verification?.verified_at ?? null,
    has_notes: Boolean(doc.verification?.notes),
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
  const [rows, docs] = await Promise.all([
    db.collection(COVERAGE).find({}).sort({ institution: 1 }).toArray(),
    db.collection(REQUIREMENTS).find({ status: { $nin: ['superseded', 'out_of_scope'] } }, {
      projection: {
        kind: 1, source: 1, status: 1, verification: 1, college_id: 1, school_id: 1,
        requirement_groups: 1, total_units: 1, catalog_url: 1, source_url: 1,
        'provenance.validation.verdict': 1,
      },
    }).toArray(),
  ]);

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
    const slug = String(row._id).replace(/^va:cov:(cc|uni):/, '');
    const found = bySlug.get(slug) || { as_degree: [], degree: [] };
    // Catalog first — it is the spine, the program map is corroboration.
    const order = (list) => [...list].sort((a, b) => (a.source === 'institution_catalog' ? -1 : 1));
    return { ...row, documents: { as_degree: order(found.as_degree), degree: order(found.degree) } };
  });

  const all = enriched.flatMap((r) => [...r.documents.as_degree, ...r.documents.degree]);
  // "Verifiable" excludes documents with nothing to read: an institution that
  // offers no CS degree, or publishes no course list, cannot be worked through
  // and should not sit in the denominator of a progress figure forever.
  const verifiable = all.filter((d) => d.status === 'extracted');

  res.json({
    coverage: enriched,
    collected: rows.filter((r) => r.collected).length,
    total: rows.length,
    verification: {
      documents: all.length,
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

  const canonical = {
    ...row,
    _id: id,
    curated_by: req.user?.uid ?? null,
    curated_at: new Date(),
    updated_at: new Date(),
  };

  // The verdict is stamped from the signed-in user, never from the body, and
  // cleared on reopen so a stale name cannot linger on an unverified record.
  if (canonical.verification) {
    const verified = !!canonical.verification.verified;
    canonical.verification.verified_at = verified ? new Date() : null;
    canonical.verification.verified_by = verified ? (req.user?.uid ?? null) : null;
    canonical.verification.verified_by_label = verified
      ? (req.user?.name || req.user?.email || null) : null;
  }

  const before = await db.collection(REQUIREMENTS).findOne({ _id: id });
  await db.collection(REQUIREMENTS).replaceOne({ _id: id }, canonical, { upsert: true });

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
  res.json({ ok: true, id, revision_recorded: !before || changes.length > 0 });
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
