/**
 * Internal audit console endpoints.
 *
 * Source of truth for verdicts: `audit_results` (one row per doc).
 * Template status is DERIVED from per-doc rows — verified iff any doc has a
 * verdict, errored iff any has result='error'. No cross-collection writes.
 *
 * Both UC and CSU agreements are auditable. Each verdict record carries a
 * `system: 'uc'|'csu'` field plus the system-specific school fields
 * (uc_school_id/uc_school OR csu_school_id/csu_school) — field names are
 * NOT normalized, to keep the audit storage compatible with the agreements'
 * native shape.
 *
 * Filter query params (accepted by every read endpoint):
 *   scope=all|uc|csu              — system selector (default all)
 *   schoolIds=12,34,56            — narrow to specific school ids
 *   majorContains=computer        — case-insensitive substring match on major
 *
 * The filter restricts the sampling pool (Verify), the error list (Errors),
 * the cluster set (Templates), AND the stat tile denominators/numerators.
 */

const { ObjectId } = require('mongodb');
const cache = require('../services/auditCache');
const { asyncHandler } = require('../middleware/asyncHandler');
const { currentDatasetVersion } = require('../services/datasetVersion');
const { majorScope } = require('../services/majorVisibility');
// Audit business logic lives in services/audit/*; the controller keeps thin
// handlers + the tier-list/search read helpers. stats.js owns the stats payload
// (computeAuditStats + the DB-coupled _statsData); filters.js the query layer;
// staleness.js the live/stale partition; templates.js the Templates-tab
// clustering; bootstrap.js the agreement reads + bootstrap payload.
const { _templateVariantsData } = require('../services/audit/templates');
const { _matrixData } = require('../services/audit/dashboard');
const {
  AUDIT_RESULTS,
  SYSTEMS,
  SYSTEM_BY_KEY,
  ASSIST_URL,
  escapeRegex,
  parseFilter,
  scopeKey,
  verdictMatch,
  _strid,
  _countReceivers,
} = require('../services/audit/filters');
const { _partitionLiveStale } = require('../services/audit/staleness');
const {
  _courseMap,
  _universityCoursesMap,
  _nextData,
  _buildBootstrapPayload,
} = require('../services/audit/bootstrap');

// Look up an agreement doc by _id across all systems (or a specific one if
// `preferSystem` is given). Returns { doc, system } or null.
async function findAgreement(db, oid, preferSystem) {
  const order = preferSystem && SYSTEM_BY_KEY.has(preferSystem)
    ? [SYSTEM_BY_KEY.get(preferSystem), ...SYSTEMS.filter((s) => s.key !== preferSystem)]
    : SYSTEMS;
  for (const s of order) {
    const doc = await db.collection(s.coll).findOne({ _id: oid });
    if (doc) return { doc, system: s.key };
  }
  return null;
}

// ───────── endpoints ─────────
// (The production tool's silent desktop-token endpoint is intentionally not
// ported: research users sign in interactively with Google and are gated by
// the env-driven allowlist.)

exports.getNext = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const data = await _nextData(req.app.locals.db, await parseFilter(req), req.query.skip, auditDb);
  res.json(data);
});

/**
 * Fetch a doc by _id from either system. Caller may pass ?system= to hint
 * which collection to try first (saves one round-trip when known); otherwise
 * we probe each system in turn.
 */
exports.getDoc = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  if (!ObjectId.isValid(req.params.docId)) return res.status(400).json({ error: 'Invalid document id' });
  const oid = new ObjectId(req.params.docId);
  const hint = req.query.system === 'csu' ? 'csu' : req.query.system === 'uc' ? 'uc' : null;
  const found = await findAgreement(db, oid, hint);
  if (!found) return res.status(404).json({ error: 'not found' });
  // Direct-by-id reads must honor partner visibility too — otherwise a doc id
  // outside the granted subset would leak through this endpoint.
  const visibleMajors = await majorScope(req);
  if (visibleMajors != null && !visibleMajors.includes(found.doc.major)) {
    return res.status(404).json({ error: 'not found' });
  }
  const { doc, system: systemKey } = found;
  const sysEntry = SYSTEM_BY_KEY.get(systemKey);
  const universityId = doc[sysEntry.idField];
  const [courseNames, universityCourses] = await Promise.all([
    _courseMap(db, doc.community_college_id, doc),
    _universityCoursesMap(db, doc),
  ]);
  res.json({
    system: systemKey,
    doc: _strid(doc),
    course_names: courseNames,
    university_courses: universityCourses,
    assist_url: ASSIST_URL(doc.community_college_id, universityId, doc.major_id),
  });
});

/**
 * Record a per-doc verdict. Body: { doc_id, result, notes, source?, system? }
 *   - result: 'correct' | 'error'
 *   - source: 'verify' | 'template' (informational — which tab produced it)
 *   - system: 'uc' | 'csu' (hint; if omitted we probe each collection)
 *
 * Denormalizes the system-specific school id/name + major + template_fp onto
 * the verdict row so _statsData / getTemplateVariants can derive rollups
 * without an agreements-side join. Field names match the source system —
 * uc_* for UC docs, csu_* for CSU. Upserts by doc_id, so re-clicking is
 * idempotent.
 */
exports.postVerify = async (req, res) => {
  try {
    const { doc_id, result, notes, source, system: bodySystem, cells_in_error } = req.body;
    if (!doc_id || !['correct', 'conservative', 'error', 'flagged'].includes(result)) {
      return res.status(400).json({ error: 'doc_id + result required (must be correct, conservative, error, or flagged)' });
    }
    // Notes are optional for correct/conservative/error but required for
    // flagged — the whole purpose of flagging is to capture what to look
    // at later, so an empty flag carries no information.
    if (result === 'flagged' && !String(notes || '').trim()) {
      return res.status(400).json({ error: 'notes required when marking a doc flagged' });
    }
    const db = req.app.locals.db;
    if (!ObjectId.isValid(doc_id)) return res.status(400).json({ error: 'Invalid document id' });
    const oid = new ObjectId(doc_id);
    const found = await findAgreement(db, oid, bodySystem);
    if (!found) return res.status(404).json({ error: 'agreement not found' });
    // Partners can only record verdicts inside their granted major subset.
    const visibleMajors = await majorScope(req);
    if (visibleMajors != null && !visibleMajors.includes(found.doc.major)) {
      return res.status(404).json({ error: 'agreement not found' });
    }
    const { doc: ref, system: systemKey } = found;
    const sysEntry = SYSTEM_BY_KEY.get(systemKey);

    // Cell-level bookkeeping. `receivers_checked` is the number of receivers
    // in the doc the auditor just reviewed — counted automatically from the
    // doc's parsed structure. `cells_in_error` defaults to 0; the auditor
    // can bump it on Tier 2/3 if they explicitly saw cell-level parser
    // mistakes (rare in practice — most non-Tier-1 verdicts are structural,
    // not cell-level). The cell-level Wilson CI on the stats endpoint reads
    // these two sums to bound per-cell error rate independently of doc-level.
    const receiversChecked = _countReceivers(ref);
    const cellsInErrorRaw = Number(cells_in_error);
    const cellsInError = Number.isFinite(cellsInErrorRaw) && cellsInErrorRaw >= 0
      ? Math.min(Math.floor(cellsInErrorRaw), receiversChecked)
      : 0;

    // Non-Tier-1 verdicts surface in their own tab for review, so they all
    // get an "open" status. Resolve only applies to Tier 3 today; Tier 2
    // and Flagged use reclassify (a fresh /audit/verify with a different
    // result).
    const isOpen = result === 'error' || result === 'conservative' || result === 'flagged';
    // Sampling provenance. sample_method records whether this doc was drawn by a
    // RANDOM mechanism (Verify tab / "Random audit") vs TARGETED (a chosen
    // template row); sample_scope records the population that random draw ranged
    // over (whole corpus / a grouping / a legacy filter), derived from the
    // active filter the client passes in `scope`. These let the headline bound
    // pool only draws that were uniform over the population it reports on. They
    // are written with $setOnInsert below so they reflect the FIRST draw and
    // survive later reclassifications.
    const sampleMethod = source === 'template' ? 'targeted' : 'random';
    const sampleScope = scopeKey(req.body.scope || {});
    const payload = {
      doc_id: oid,
      result,
      notes: notes || '',
      // Preserve the real source ('verify' | 'random_template_weighted' |
      // 'template'); unknown values default to 'verify'.
      source: ['verify', 'random_template_weighted', 'template'].includes(source) ? source : 'verify',
      system: systemKey,
      [sysEntry.idField]:   ref[sysEntry.idField]   ?? null,
      [sysEntry.nameField]: ref[sysEntry.nameField] ?? null,
      major:        ref.major        ?? null,
      // raw_template_hash is the byte-identity of ASSIST's raw template
      // and the cluster key the audit uses. template_fp is still stored
      // for reference / over-fragmentation diagnostics. parser_output_hash
      // is the full-output hash (UC + CC side) — drift on any of these
      // marks the verdict stale.
      raw_template_hash:   ref.raw_template_hash   ?? null,
      template_fp:         ref.template_fp         ?? null,
      parser_output_hash:  ref.parser_output_hash  ?? null,
      receivers_checked: receiversChecked,
      cells_in_error:    cellsInError,
      verifier_uid: req.user?.uid ?? null,
      verified_at:  new Date(),
      // Research provenance: which frozen snapshot this verdict was judged
      // against, and that it came from the research console — both required
      // by the end-of-project merge back into the production audit store.
      dataset_version: await currentDatasetVersion(db),
      verdict_origin: 'research',
      ...(isOpen ? { status: 'open' } : {}),
    };
    // A fresh verdict supersedes any prior resolution bookkeeping — whether
    // we're flipping error→correct, re-asserting error on a resolved doc, or
    // re-verifying a correct doc, stale resolution metadata must go.
    const update = {
      $set: payload,
      // Provenance is stamped once, on the doc's first audit, and preserved
      // through later reclassifications (a tier change is not a new draw).
      $setOnInsert: { sample_method: sampleMethod, sample_scope: sampleScope },
      $unset: {
        resolution_notes: '',
        resolved_by_uid:  '',
        resolved_at:      '',
        // status is set above when result is conservative or error; for
        // correct we clear it so a re-verified-correct doc loses any
        // historical 'open'/'resolved' marker.
        ...(isOpen ? {} : { status: '' }),
      },
    };
    const auditDb = req.app.locals.auditDb || db;
    await auditDb.collection(AUDIT_RESULTS).updateOne({ doc_id: oid }, update, { upsert: true });
    cache.clear();
    res.json({ ok: true });
  } catch (err) {
    console.error('audit.postVerify:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

// Shared verdict-list builder used by _errorsData (Tier 3), _conservativeData
// (Tier 2), and _flaggedData (Flagged). All three tabs render identical row
// shapes; only the verdict filter differs. Errors additionally exclude
// resolved rows.
//
// Stale verdicts (audit.raw_template_hash drifted from current doc) are
// filtered out — they appear in the Stale tab instead, regardless of their
// original tier. Re-verifying via the Stale tab writes a new row with the
// current hash, which then surfaces under the appropriate tier tab.
async function _verdictListData(db, filter, resultValue, extraMatch = {}, auditDb = db) {
  const baseMatch = { ...verdictMatch(filter), result: resultValue, ...extraMatch };
  // Verdicts from auditDb (the audit handle); the live/stale partition + row
  // hydration read agreement docs from db (reference).
  const rawRows = await auditDb.collection(AUDIT_RESULTS).find(baseMatch).toArray();
  if (rawRows.length === 0) return [];
  const { live: rows } = await _partitionLiveStale(db, rawRows);
  return _hydrateLiveRows(db, rows);
}

// Hydrate already-fetched, already-LIVE verdict rows into the list-row shape the
// Errors / Conservative / Flagged / Correct tabs render. Shared by
// _verdictListData (full-list tabs) and _correctData (recent-N + search).
async function _hydrateLiveRows(db, rows) {
  if (rows.length === 0) return [];
  const idsBySystem = new Map();
  for (const r of rows) {
    const sysKey = r.system || 'uc';
    if (!idsBySystem.has(sysKey)) idsBySystem.set(sysKey, []);
    idsBySystem.get(sysKey).push(r.doc_id);
  }
  const docByIdSystem = new Map();
  for (const [sysKey, ids] of idsBySystem) {
    const s = SYSTEM_BY_KEY.get(sysKey);
    if (!s) continue;
    const docs = await db.collection(s.coll).find(
      { _id: { $in: ids } },
      { projection: {
        _id: 1,
        community_college: 1, community_college_id: 1,
        [s.nameField]: 1, [s.idField]: 1, major: 1, major_id: 1,
        template_fp: 1,
      } }
    ).toArray();
    for (const d of docs) docByIdSystem.set(String(d._id), { d, sysKey });
  }
  const out = rows.map((r) => {
    const entry = docByIdSystem.get(String(r.doc_id));
    if (!entry) return null;
    const { d, sysKey } = entry;
    const s = SYSTEM_BY_KEY.get(sysKey);
    return {
      id: String(r.doc_id),
      doc_id: String(r.doc_id),
      system: sysKey,
      community_college: d.community_college,
      // System-native field names preserved (uc_school OR csu_school) so the
      // frontend can read whichever matches `system` without a normalized alias.
      [s.nameField]: d[s.nameField],
      major: d.major,
      notes: r.notes || '',
      source: r.source || 'verify',
      result: r.result,
      assist_url: ASSIST_URL(d.community_college_id, d[s.idField], d.major_id),
      verified_at: r.verified_at,
    };
  }).filter(Boolean);
  // Always ordered newest-first; callers that pre-sort at the DB level (e.g.
  // _correctData's verified_at limit) get the same order back.
  out.sort((a, b) => String(b.verified_at).localeCompare(String(a.verified_at)));
  return out;
}

async function _errorsData(db, filter, auditDb = db) {
  return cache.memoize('errors', filter, async () =>
    // result='error' already implies unresolved — a resolved verdict has its
    // result flipped to 'correct'. The status filter is belt-and-suspenders
    // against out-of-band edits that might leave the two fields inconsistent.
    _verdictListData(db, filter, 'error', { status: { $ne: 'resolved' } }, auditDb)
  );
}

async function _conservativeData(db, filter, auditDb = db) {
  return cache.memoize('conservative', filter, async () =>
    // Conservative rows have no "resolved" concept (they're not bugs); the
    // tab shows every Tier 2 verdict matching the filter. Reclassify moves
    // them to a different tier via a fresh /audit/verify, which the upsert
    // semantics overwrite cleanly.
    _verdictListData(db, filter, 'conservative', {}, auditDb)
  );
}

async function _flaggedData(db, filter, auditDb = db) {
  return cache.memoize('flagged', filter, async () =>
    // Flagged rows are items the auditor wants to revisit later (visually
    // off, hard to parse, or otherwise worth a second look). Treated as
    // safe (no under-prepare risk) like Conservative; same
    // reclassify-not-resolve workflow.
    _verdictListData(db, filter, 'flagged', {}, auditDb)
  );
}


// Most-recent CORRECT verdicts (recent-N + optional search). The correct set
// can be huge, so unlike the other tier lists this sorts + limits at the DB
// level and searches the verdict row's DENORMALIZED major/school — at most N
// doc lookups regardless of how many correct verdicts exist. Not memoized: the
// query is already bounded to N, and search varies per keystroke (a filter-only
// memo key would collide across searches).
async function _correctData(db, filter, { search = '', limit = 200 } = {}, auditDb = db) {
  const n = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const match = { ...verdictMatch(filter), result: 'correct' };
  const q = String(search || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    match.$or = [{ major: rx }, { uc_school: rx }, { csu_school: rx }];
  }
  const rawRows = await auditDb.collection(AUDIT_RESULTS)
    .find(match).sort({ verified_at: -1 }).limit(n).toArray();
  if (rawRows.length === 0) return [];
  // The result may be < n if some of the most-recent N rows are stale (hash
  // drift) — they're dropped here and surface in the Stale tab instead. Fewer
  // rows is expected, not an error.
  const { live: rows } = await _partitionLiveStale(db, rawRows);
  return _hydrateLiveRows(db, rows);
}

exports.getCorrect = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const data = await _correctData(req.app.locals.db, await parseFilter(req), {
    search: req.query.search,
    limit: req.query.limit,
  }, auditDb);
  res.json(data);
});

exports.getErrors = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const data = await _errorsData(req.app.locals.db, await parseFilter(req), auditDb);
  res.json(data);
});

exports.getConservative = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const data = await _conservativeData(req.app.locals.db, await parseFilter(req), auditDb);
  res.json(data);
});

exports.getFlagged = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const data = await _flaggedData(req.app.locals.db, await parseFilter(req), auditDb);
  res.json(data);
});

// (No /audit/stale endpoint on the research console: staleness is a parser-
// drift concern the admin handles in the main tooling; partners never see it.)

exports.getTemplateVariants = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const data = await _templateVariantsData(req.app.locals.db, await parseFilter(req), auditDb);
  res.json(data);
});

// Coverage heatmap (UC campus × major area) + largest unverified templates.
exports.getMatrix = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const data = await _matrixData(req.app.locals.db, await parseFilter(req), auditDb);
  res.json(data);
});

exports.getBootstrap = async (req, res) => {
  try {
    const auditDb = req.app.locals.auditDb || req.app.locals.db;
    const baseFilter = await parseFilter(req);
    const skip = req.query.skip;
    const payload = await _buildBootstrapPayload(req.app.locals.db, baseFilter, skip, auditDb);
    res.json(payload);
  } catch (err) {
    console.error('audit.getBootstrap:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

// (No groupings on the research console: the admin-selected visible-major
// subset IS the scoping mechanism — see services/majorVisibility.js.)

// ───────── Picker search ─────────
//
// Unified search bar for the grouping picker. Returns schools whose name
// matches and (school, major) pairs whose major or school name matches.
// Caches per query for 5 minutes since the underlying distinct set rarely
// changes within a session.

const _searchCache = new Map();
const _SEARCH_TTL_MS = 5 * 60 * 1000;
const _SEARCH_LIMIT_DEFAULT = 50;

exports.searchPicker = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const systems = String(req.query.systems || '')
      .split(',').map((s) => s.trim()).filter(Boolean)
      .filter((k) => SYSTEM_BY_KEY.has(k));
    const activeSys = systems.length ? systems : SYSTEMS.map((s) => s.key);
    const limit = Math.max(1, Math.min(200,
      Number(req.query.limit) || _SEARCH_LIMIT_DEFAULT
    ));

    const cacheKey = `${activeSys.sort().join(',')}|${q.toLowerCase()}|${limit}`;
    const hit = _searchCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return res.json(hit.value);

    const db = req.app.locals.db;
    const needle = q.toLowerCase();
    const schools = [];
    const pairs = [];

    for (const sysKey of activeSys) {
      const s = SYSTEM_BY_KEY.get(sysKey);
      // School list: aggregate distinct (id, name). Filter in JS — the school
      // list is small (single digits per system), so a regex match would be
      // overkill.
      const schoolRows = await db.collection(s.coll).aggregate([
        { $group: { _id: { id: `$${s.idField}`, name: `$${s.nameField}` } } },
      ]).toArray();
      for (const r of schoolRows) {
        if (r._id.id == null) continue;
        const name = r._id.name || '';
        if (!needle || name.toLowerCase().includes(needle)) {
          schools.push({ system: sysKey, school_id: r._id.id, name });
        }
      }

      // Pairs: distinct (school_id, school_name, major). For empty q we
      // return zero pairs (the picker browses schools cold); otherwise we
      // match against major OR school name.
      if (needle) {
        const pairRows = await db.collection(s.coll).aggregate([
          { $match: {
              $or: [
                { major:           { $regex: escapeRegex(q), $options: 'i' } },
                { [s.nameField]:   { $regex: escapeRegex(q), $options: 'i' } },
              ],
          } },
          { $group: { _id: {
              id:    `$${s.idField}`,
              name:  `$${s.nameField}`,
              major: '$major',
          } } },
          { $limit: limit * 4 },  // overshoot — we slice after merging systems
        ]).toArray();
        for (const r of pairRows) {
          if (r._id.id == null || !r._id.major) continue;
          pairs.push({
            system:    sysKey,
            school_id: r._id.id,
            name:      r._id.name || '',
            major:     r._id.major,
          });
        }
      }
    }

    schools.sort((a, b) =>
      a.system.localeCompare(b.system) || a.name.localeCompare(b.name)
    );
    pairs.sort((a, b) =>
      a.system.localeCompare(b.system) ||
      a.name.localeCompare(b.name) ||
      a.major.localeCompare(b.major)
    );
    const value = { schools, pairs: pairs.slice(0, limit) };
    _searchCache.set(cacheKey, { value, expiresAt: Date.now() + _SEARCH_TTL_MS });
    res.json(value);
  } catch (err) {
    console.error('audit.searchPicker:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
