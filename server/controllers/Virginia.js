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

const COURSES = 'va_courses';
const INSTITUTIONS = 'va_institutions';
const REQUIREMENTS = 'va_requirements';
const COVERAGE = 'va_coverage';
const REVISIONS = 'va_revisions';

/** The two document kinds `va_requirements` holds, mirroring California. */
const EDITABLE_KINDS = new Set(['as_degree', 'degree']);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const intOr = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

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
  const projection = { code: 1, title: 1, credits: 1, department: 1, counts: 1, source_url: 1 };
  if (receiver) projection.articulates_to = 1;

  const [rows, total] = await Promise.all([
    coll.find(q, { projection }).sort({ code: 1 }).skip(skip).limit(limit).toArray(),
    coll.countDocuments(q),
  ]);
  const courses = receiver
    ? rows.map(({ articulates_to, ...r }) => ({
      ...r,
      lands_as: (articulates_to || []).find((e) => e.institution === receiver) || null,
    }))
    : rows;
  res.json({ courses, total, skip, limit, receiver });
});

/** One course in full: description, the colleges that offer it, every target. */
exports.course = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').replace(/\s+/g, '').toUpperCase();
  const doc = await req.app.locals.db.collection(COURSES).findOne({ code });
  if (!doc) return res.status(404).json({ error: `no course ${code}` });
  res.json({ course: doc });
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
      for (const e of r.articulates_to || []) {
        bucket.set(e.institution, (bucket.get(e.institution) || 0) + 1);
        receiverTotals.set(e.institution, (receiverTotals.get(e.institution) || 0) + 1);
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
  const slug = institution.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // One degree per institution. Two sources were captured — the college's own
  // catalogue and Transfer Virginia's program map — and both were kept so a
  // verifier could see disagreement. They did not disagree: where both stated
  // units they matched in 11 of 11 cases. The richer document now survives as
  // the single record, carrying the other's URL under `corroborating_sources`,
  // and the losers are marked `superseded` rather than deleted.
  const docs = await db.collection(REQUIREMENTS)
    .find({
      $or: [{ college_id: `va:cc:${slug}` }, { school_id: `va:uni:${slug}` }],
      status: { $nin: ['superseded', 'out_of_scope'] },
    })
    .toArray();

  // The shared RequirementsLedger resolves courses on BOTH sides, and they use
  // different lookups:
  //   left  (the requirement)  — `receiving.parent_id` via `universityCoursesById`
  //   right (what satisfies it) — `options[].course_ids` via a `courses` array
  //                               matched on `course_id`
  // Supplying only the first leaves the sending side rendering raw ids, which
  // is exactly what a reader sees as "just numbers". Both are built here from
  // the ids actually referenced by these documents.
  const parentIds = new Map();   // parent_id -> code_seen
  const courseIds = new Set();   // ids used by options on the sending side
  for (const d of docs) {
    for (const g of d.requirement_groups || []) {
      for (const s of g.sections || []) {
        for (const r of s.receivers || []) {
          if (r.receiving?.parent_id != null && r.code_seen) parentIds.set(r.receiving.parent_id, r.code_seen);
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
              const code = seriesCodes[i] || seriesCodes[0];
              if (code && !parentIds.has(pid)) parentIds.set(pid, code);
            });
          }
          for (const o of r.options || []) for (const id of o.course_ids || []) courseIds.add(id);
        }
      }
    }
  }

  // `va_courses.course_id` is the minted id the importers wrote, so both sides
  // resolve through the same registry.
  const referenced = await db.collection(COURSES).find(
    { $or: [{ course_id: { $in: [...courseIds] } }, { code: { $in: [...parentIds.values()] } }] },
    { projection: { code: 1, title: 1, credits: 1, course_id: 1 } }
  ).toArray();
  const byCode = new Map(referenced.map((c) => [c.code, c]));
  const byCourseId = new Map(referenced.map((c) => [c.course_id, c]));

  const split = (code) => {
    const m = /^([A-Za-z]+)(\d.*)$/.exec(code || '');
    return { prefix: m ? m[1] : code, number: m ? m[2] : '' };
  };

  // Titles harvested from each institution's own catalog page. Four-year
  // courses are not in `va_courses`, so without this their requirements render
  // as a bare code — the reason a reader saw unnamed courses.
  const catalogTitles = new Map();
  for (const d of docs) {
    for (const [code, title] of Object.entries(d.course_titles || {})) {
      if (!catalogTitles.has(code)) catalogTitles.set(code, title);
    }
  }

  const universityCoursesById = {};
  for (const [pid, code] of parentIds) {
    const hit = byCode.get(code);
    universityCoursesById[pid] = {
      ...split(code),
      title: hit?.title ?? catalogTitles.get(code) ?? null,
      min_units: hit?.credits ?? null,
      max_units: hit?.credits ?? null,
    };
  }

  // Sending side: `{ course_id, prefix, number, title, units }`, the shape
  // `CcCourse` matches on. Ids with no course record still get a readable code
  // where the document preserved one, rather than falling back to `#id`.
  const courses = [...courseIds].map((id) => {
    const hit = byCourseId.get(id);
    if (hit) {
      return {
        course_id: id, ...split(hit.code),
        title: hit.title ?? catalogTitles.get(hit.code) ?? null,
        units: hit.credits ?? null,
      };
    }
    return { course_id: id, prefix: '#', number: String(id), title: null, units: null };
  });

  res.json({ institution, degrees: docs, university_courses_by_id: universityCoursesById, courses });
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
