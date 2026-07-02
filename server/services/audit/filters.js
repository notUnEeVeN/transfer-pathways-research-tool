// Foundational audit query layer: system metadata, collection-name constants,
// the query-string filter parser, the Mongo match-clause builders, and the
// tiny pure doc helpers (receiver/cell counts). Every other services/audit/*
// module + the controller imports from here. parseFilter also applies the
// research console's partner major-visibility scope (services/majorVisibility).

const { majorScope, scopeTag } = require('../majorVisibility');

const ASSIST_ACADEMIC_YEAR = 76;
const AUDIT_RESULTS      = 'audit_results';
const COURSES            = 'courses';
const UNIVERSITY_COURSES = 'university_courses';

// Per-system metadata. UC-only for now; CSU was removed pending advanced
// internal audit tooling. To re-introduce CSU later, append its row here
// and re-add the matching csu entries in the bootstrap (next/schools)
// + the frontend SCOPE_OPTIONS / SYSTEM_LABEL.
const SYSTEMS = [
  { key: 'uc',  coll: 'uc_agreements',  idField: 'uc_school_id',  nameField: 'uc_school'  },
];
const SYSTEM_BY_KEY = new Map(SYSTEMS.map((s) => [s.key, s]));

// Per-receiver cell multiplier. Each receiver represents one UC requirement
// plus its CC-side option(s); auditing one verdict means parse-checking both
// sides, so a doc's cell count for audit-statistics purposes is 2 × (UC
// receiver count). The DB field `receivers_checked` keeps the raw UC count to
// avoid a backfill; the doubling is applied at read time.
const CELLS_PER_RECEIVER = 2;

const ASSIST_URL = (cc_id, university_id, major_id) =>
  major_id
    ? `https://assist.org/transfer/results?year=${ASSIST_ACADEMIC_YEAR}` +
      `&institution=${cc_id}&agreement=${university_id}&agreementType=to` +
      `&view=agreement&viewBy=major&viewSendingAgreements=false` +
      `&viewByKey=${ASSIST_ACADEMIC_YEAR}%2F${cc_id}%2Fto%2F${university_id}%2FMajor%2F${major_id}`
    : null;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ───────── filter parsing ─────────

/**
 * Parse the audit query-string filter. Async because a `groupingId` triggers
 * a Mongo lookup to resolve the grouping doc's member pairs; when present,
 * the legacy scope/schoolIds/majorContains fields are ignored downstream.
 *
 * A malformed or deleted groupingId falls through silently to the legacy
 * filter — callers never error out on stale client state.
 */
async function parseFilter(req) {
  const raw = req.query.scope;
  const scope = raw === 'uc' ? 'uc' : 'all';
  const schoolIds = String(req.query.schoolIds || '')
    .split(',').map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const majorContains = String(req.query.majorContains || '').trim();

  // Research-console access scoping: admins see every ported major
  // (visibleMajors = null); partners are hard-limited to the admin-selected
  // subset (possibly empty). Applied by systemMatch/verdictMatch below, so
  // every audit read/stat automatically reflects the granted majors.
  const visibleMajors = await majorScope(req);

  return { scope, schoolIds, majorContains, groupingId: null, pairs: [], visibleMajors };
}

/**
 * Stable key for the SAMPLING population a verdict was (or a bound is) drawn
 * over. Used both at verify time (stamped on the row as sample_scope) and at
 * read time (to restrict the random sample to draws over the requested
 * population). UC is the only system, so the scope=all|uc toggle is ignored —
 * only a grouping or legacy school/major filter narrows the population.
 *   grouping active            → `g:<groupingId>`
 *   legacy school/major filter → `f:<sortedSchoolIds>|<majorContains lower>`
 *   whole corpus               → `all`
 */
function scopeKey(filter = {}) {
  // Partner visibility narrows the population, so it must be part of the key —
  // otherwise a partner-scoped result could be cached under (and served for)
  // the admin's unscoped view, or vice versa.
  const vis = filter.visibleMajors != null ? `|v:${scopeTag(filter.visibleMajors)}` : '';
  if (filter.groupingId) return `g:${filter.groupingId}${vis}`;
  const ids = (filter.schoolIds || []).slice().sort((a, b) => a - b).join(',');
  const mc = String(filter.majorContains || '').trim().toLowerCase();
  if (ids || mc) return `f:${ids}|${mc}${vis}`;
  return `all${vis}`;
}

function activeSystems(filter) {
  if (filter.pairs?.length) {
    const keys = new Set(filter.pairs.map((p) => p.system));
    return SYSTEMS.filter((s) => keys.has(s.key));
  }
  if (filter.scope === 'uc') return [SYSTEM_BY_KEY.get('uc')];
  return SYSTEMS;
}

// Mongo match clause for an agreements collection of the given system.
// When a grouping is active, the school/major sub-clause is the $or of the
// grouping's pairs for this system; legacy fields are ignored.
function systemMatch(system, filter) {
  if (filter.pairs?.length) {
    const pairs = filter.pairs.filter((p) => p.system === system.key);
    if (!pairs.length) {
      // grouping doesn't reference this system → match nothing
      return { _id: { $exists: false } };
    }
    return { $or: pairs.map((p) => ({ [system.idField]: p.school_id, major: p.major })) };
  }
  const m = {};
  if (filter.schoolIds.length) m[system.idField] = { $in: filter.schoolIds };
  applyMajorClauses(m, filter);
  return m;
}

// Combine the (optional) majorContains regex and the (optional) partner
// visibility allowlist onto a match object. Both constrain `major`, so when
// both are present they go through $and.
function applyMajorClauses(m, filter) {
  const clauses = [];
  if (filter.majorContains) {
    clauses.push({ major: { $regex: escapeRegex(filter.majorContains), $options: 'i' } });
  }
  if (filter.visibleMajors != null) {
    clauses.push({ major: { $in: filter.visibleMajors } });
  }
  if (clauses.length === 1) Object.assign(m, clauses[0]);
  else if (clauses.length > 1) m.$and = [...(m.$and || []), ...clauses];
  return m;
}

// Mongo match clause for `audit_results`. Verdicts carry a system-tagged
// school id. UC is the only active system today, so schoolIds match against
// uc_school_id directly; the multi-system $or branch below is dormant
// scaffolding for re-introducing a second system (see SYSTEMS note above),
// where a numeric id could refer to either system's school.
function verdictMatch(filter) {
  if (filter.pairs?.length) {
    return {
      $or: filter.pairs.map((p) => ({
        system: p.system,
        [SYSTEM_BY_KEY.get(p.system).idField]: p.school_id,
        major: p.major,
      })),
    };
  }
  const m = {};
  const sys = activeSystems(filter);
  if (sys.length === 1) m.system = sys[0].key;
  if (filter.schoolIds.length) {
    if (sys.length === 1) {
      m[sys[0].idField] = { $in: filter.schoolIds };
    } else {
      m.$or = SYSTEMS.map((s) => ({ [s.idField]: { $in: filter.schoolIds } }));
    }
  }
  applyMajorClauses(m, filter);
  return m;
}

// ───────── pure doc helpers ─────────

// Stringify a doc's _id in place (for JSON responses) and return it.
function _strid(doc) {
  if (doc && doc._id) doc._id = String(doc._id);
  return doc;
}

// Raw UC-receiver count for a parsed doc. Persisted to `receivers_checked`.
// Multiply by CELLS_PER_RECEIVER to get the audit-stats "cells" count.
function _countReceivers(doc) {
  let n = 0;
  for (const g of (doc.requirement_groups || [])) {
    for (const s of (g.sections || [])) {
      n += (s.receivers || []).length;
    }
  }
  return n;
}

// Audit-stats cell count for a parsed doc (UC side + CC side per receiver).
function _countCells(doc) {
  return _countReceivers(doc) * CELLS_PER_RECEIVER;
}

module.exports = {
  AUDIT_RESULTS,
  COURSES,
  UNIVERSITY_COURSES,
  CELLS_PER_RECEIVER,
  SYSTEMS,
  SYSTEM_BY_KEY,
  ASSIST_URL,
  escapeRegex,
  parseFilter,
  scopeKey,
  activeSystems,
  systemMatch,
  verdictMatch,
  _strid,
  _countReceivers,
  _countCells,
};
