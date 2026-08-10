/**
 * Canonical Virginia institution scope layered over the Transfer Virginia
 * course corpus.
 *
 * Transfer Virginia is intentionally broader than the public-university
 * comparison cohort: it includes private partners, renamed schools and an
 * out-of-state receiver.  The catalog registry records the authoritative SCHEV
 * cohort without deleting any of those useful equivalency rows.  API callers
 * can therefore select the exact public cohort while unfiltered callers still
 * receive every known institution.
 */
const registry = require('../../.va-catalogs/institutions.json');

const PRIMARY_COHORT_ID = 'schev_public_four_year';
const OTHER_FOUR_YEAR_COHORT_ID = 'other_four_year';
const EXTERNAL_RECEIVER_COHORT_ID = 'external_receiver';
const TWO_YEAR_COHORT_ID = 'virginia_two_year';
const primaryCohort = registry.cohorts[PRIMARY_COHORT_ID];
const primarySlugs = new Set(primaryCohort.institution_slugs);
const primaryRank = new Map(primaryCohort.institution_slugs.map((slug, index) => [slug, index]));
const registryBySlug = new Map(registry.institutions.map((institution) => [institution.slug, institution]));

const slugifyInstitution = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const registryByName = new Map();
for (const institution of registry.institutions) {
  for (const name of [institution.name, institution.official_name, ...(institution.aliases || [])]) {
    if (name) registryByName.set(slugifyInstitution(name), institution);
  }
}

function registryInstitutionFor(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    if (value.institution_slug && registryBySlug.has(value.institution_slug)) {
      return registryBySlug.get(value.institution_slug);
    }
    if (value.slug && registryBySlug.has(value.slug)) return registryBySlug.get(value.slug);
    return registryByName.get(slugifyInstitution(value.name || value.canonical_name)) || null;
  }
  const slug = slugifyInstitution(value);
  return registryBySlug.get(slug) || registryByName.get(slug) || null;
}

function sourceNamesForInstitution(value) {
  const institution = registryInstitutionFor(value);
  if (!institution) return [String(typeof value === 'object' ? value.name || '' : value)].filter(Boolean);
  return [...new Set([
    institution.name,
    institution.official_name,
    ...(institution.aliases || []),
  ].filter(Boolean))];
}

function canonicalInstitutionIdentity(value) {
  const institution = registryInstitutionFor(value);
  const fallbackName = typeof value === 'object' ? value.name : value;
  const fallbackSlug = slugifyInstitution(fallbackName);
  return {
    institution: institution || null,
    slug: institution?.slug || fallbackSlug,
    name: institution?.name || String(fallbackName || ''),
    source_names: institution ? sourceNamesForInstitution(institution) : [String(fallbackName || '')].filter(Boolean),
  };
}

function cohortFor(level, slug) {
  if (level === 'community_college') return TWO_YEAR_COHORT_ID;
  if (level === 'four_year' && primarySlugs.has(slug)) return PRIMARY_COHORT_ID;
  if (level === 'four_year' && registryBySlug.has(slug)) return OTHER_FOUR_YEAR_COHORT_ID;
  if (level === 'four_year') return EXTERNAL_RECEIVER_COHORT_ID;
  return null;
}

function decorateInstitution(row, { corpusPresent = true } = {}) {
  const canonical = canonicalInstitutionIdentity(row);
  const level = canonical.institution?.level || row.level;
  const cohort = cohortFor(level, canonical.slug);
  const isPrimary = cohort === PRIMARY_COHORT_ID;
  return {
    ...row,
    name: canonical.name,
    level,
    institution_slug: canonical.slug,
    canonical_name: canonical.name,
    cohort,
    is_primary: isPrimary,
    scope_source_url: isPrimary ? primaryCohort.source_url : null,
    cohort_rank: isPrimary ? primaryRank.get(canonical.slug) : null,
    corpus_present: corpusPresent,
    registry_present: Boolean(canonical.institution),
    catalog_offers_cs: canonical.institution?.offers_cs ?? null,
    source_names: [...new Set([
      ...(row.source_names || []),
      ...(row.name ? [row.name] : []),
      ...canonical.source_names,
    ])],
  };
}

const numberSum = (rows, field) => rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);

function mergeInstitutionRows(rows, { includePrimaryMissing = true } = {}) {
  const groups = new Map();
  for (const row of rows) {
    const corpusPresent = row.corpus_present != null
      ? row.corpus_present !== false
      : row.source !== 'schev_registry';
    const decorated = decorateInstitution(row, { corpusPresent });
    if (!groups.has(decorated.institution_slug)) groups.set(decorated.institution_slug, []);
    groups.get(decorated.institution_slug).push(decorated);
  }

  const merged = [];
  for (const [slug, matches] of groups) {
    const canonical = registryBySlug.get(slug);
    const preferred = matches.find((row) => row.source_names.includes(canonical?.name)) || matches[0];
    merged.push(decorateInstitution({
      ...preferred,
      _id: `va:inst:${slug}`,
      course_count: numberSum(matches, 'course_count'),
      receives_count: numberSum(matches, 'receives_count'),
      source_names: matches.flatMap((row) => row.source_names || [row.name]),
      corpus_alias_rows: matches.length,
    }, { corpusPresent: matches.some((row) => row.corpus_present) }));
  }

  if (includePrimaryMissing) {
    for (const slug of primaryCohort.institution_slugs) {
      if (groups.has(slug)) continue;
      const institution = registryBySlug.get(slug);
      if (!institution) throw new Error(`SCHEV cohort institution is missing from registry: ${slug}`);
      merged.push(decorateInstitution({
        _id: `va:inst:${slug}`,
        source: 'schev_registry',
        name: institution.name,
        level: institution.level,
        course_count: 0,
        receives_count: 0,
        source_names: sourceNamesForInstitution(institution),
        corpus_alias_rows: 0,
      }, { corpusPresent: false }));
    }
  }

  return merged.sort((a, b) => {
    const aGroup = a.is_primary ? 0 : a.level === 'community_college' ? 1 : 2;
    const bGroup = b.is_primary ? 0 : b.level === 'community_college' ? 1 : 2;
    if (aGroup !== bGroup) return aGroup - bGroup;
    if (a.is_primary && b.is_primary) return a.cohort_rank - b.cohort_rank;
    return a.name.localeCompare(b.name);
  });
}

function cohortSummary() {
  return {
    [PRIMARY_COHORT_ID]: {
      id: PRIMARY_COHORT_ID,
      label: primaryCohort.label,
      description: primaryCohort.description,
      level: primaryCohort.level,
      primary: true,
      authority: primaryCohort.authority,
      source_url: primaryCohort.source_url,
      verified_at: primaryCohort.verified_at,
      institution_count: primaryCohort.institution_slugs.length,
    },
    [OTHER_FOUR_YEAR_COHORT_ID]: {
      id: OTHER_FOUR_YEAR_COHORT_ID,
      label: 'Other Virginia four-year institutions',
      description: 'Virginia private and professional institutions retained as a secondary research cohort.',
      level: 'four_year',
      primary: false,
      institution_count: registry.institutions.filter((institution) => (
        institution.level === 'four_year' && !primarySlugs.has(institution.slug)
      )).length,
    },
    [EXTERNAL_RECEIVER_COHORT_ID]: {
      id: EXTERNAL_RECEIVER_COHORT_ID,
      label: 'External or unscoped receivers',
      description: 'Course-corpus receiver names that are not in the Virginia catalog research registry.',
      level: 'four_year',
      primary: false,
      institution_count: null,
    },
  };
}

module.exports = {
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
  slugifyInstitution,
  sourceNamesForInstitution,
};
