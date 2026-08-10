/**
 * Provenance helpers for the layered Virginia degree collector.
 *
 * Captures use transport-oriented roles (`program`, `ge`, ...). Requirement
 * artifacts use stable research roles (`major`, `general_education`, ...), so
 * source references survive a URL or catalog-platform change.
 */

const ROLE_IDS = {
  program: 'major',
  ge: 'general_education',
  college: 'college',
  graduation: 'graduation',
  policy: 'policy',
  catalog: 'catalog',
  course_catalog: 'course_catalog',
};

const ROLE_LABELS = {
  program: 'major and degree requirements',
  ge: 'general education requirements',
  college: 'college or school requirements',
  graduation: 'university graduation requirements',
  policy: 'academic policies',
  catalog: 'academic catalog',
  course_catalog: 'course descriptions and credit values',
};

const sourceIdForRole = (role) => ROLE_IDS[role] || String(role || 'source').replace(/[^a-z0-9]+/gi, '_').toLowerCase();

/** `2026–2027 Edition` / `University Catalog 2026-2027` -> `2026-2027`. */
function extractCatalogYear(text) {
  const normalized = String(text || '').replace(/[\u2012-\u2015]/g, '-');
  const explicit = /\b((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2})\b/.exec(normalized);
  if (explicit) return `${explicit[1]}-${explicit[2]}`;
  return null;
}

function hostOf(value) {
  try { return new URL(value).hostname.toLowerCase(); } catch { return null; }
}

function approvedHosts(institution) {
  return new Set([
    hostOf(institution.catalog_root),
    ...(institution.seeds || []).map((seed) => hostOf(seed.url)),
  ].filter(Boolean));
}

function isApprovedOfficialUrl(institution, value) {
  const host = hostOf(value);
  if (!host) return false;
  return approvedHosts(institution).has(host);
}

function pageSucceeded(page) {
  if (!page || !page.file || page.status < 200 || page.status >= 300) return false;
  if (page.role === 'program') return page.has_requirements === true;
  return page.has_content === true || page.bytes_text >= 400;
}

/**
 * Turn capture-index pages into the source registry embedded in an extraction.
 * Only successfully read pages enter the registry. Failed attempts remain in
 * the capture index, where they are useful transport diagnostics but are not
 * evidence for a degree requirement.
 */
function buildSourceRegistry(institution, capture) {
  const seen = new Map();
  const sources = [];
  for (const page of (capture && capture.pages) || []) {
    if (!pageSucceeded(page)) continue;
    const baseId = sourceIdForRole(page.role);
    const duplicate = seen.get(baseId) || 0;
    seen.set(baseId, duplicate + 1);
    const id = duplicate ? `${baseId}_${duplicate + 1}` : baseId;
    sources.push({
      id,
      role: page.role,
      kind: baseId,
      label: `${institution.name} ${ROLE_LABELS[page.role] || page.role || 'catalog source'}`,
      url: page.final_url || page.requested_url,
      requested_url: page.requested_url || null,
      catalog_platform: institution.platform || null,
      captured_at: capture.captured_at || null,
      sha256: page.sha256 || null,
      official: isApprovedOfficialUrl(institution, page.final_url || page.requested_url),
      secure: /^https:\/\//i.test(page.final_url || page.requested_url || ''),
    });
  }
  return sources;
}

/**
 * Evidence status for every layer an institution says is required.
 *
 * Registry shape:
 *   degree_context.layers.major.source_roles = ['program']
 * A layer is captured only when every listed source role was successfully
 * captured. This deliberately makes missing context visible rather than
 * treating the major page as the whole degree.
 */
function buildLayerCoverage(institution, sources) {
  const configured = institution.degree_context && institution.degree_context.layers;
  const layers = configured || { major: { source_roles: ['program'] } };
  const result = {};

  for (const [name, config = {}] of Object.entries(layers)) {
    if (config.status === 'not_applicable') {
      result[name] = { status: 'not_applicable', source_refs: [], note: config.note || null };
      continue;
    }
    const roles = Array.isArray(config.source_roles) ? config.source_roles : [];
    const refs = roles.flatMap((role) => sources.filter((source) => source.role === role).map((source) => source.id));
    const presentRoles = new Set(roles.filter((role) => sources.some((source) => source.role === role)));
    result[name] = {
      status: roles.length > 0 && presentRoles.size === roles.length ? (config.status || 'captured') : 'missing',
      source_refs: refs,
      note: config.note || null,
    };
  }
  return result;
}

module.exports = {
  buildLayerCoverage,
  buildSourceRegistry,
  extractCatalogYear,
  isApprovedOfficialUrl,
  sourceIdForRole,
};
