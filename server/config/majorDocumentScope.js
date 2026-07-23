const { defaultMajor } = require('./majors');

/**
 * The one rule for scoping curated documents to a major.
 *
 * Curated course categories, receiver overrides, mappings and associate-degree
 * rows all carry a `major_slug`. Rows stamped with `slug` always match. Rows
 * with no stamp are the historical corpus from before the major dimension
 * existed; they belong to the legacy owner — the default major — alone. So a
 * later major only ever matches rows explicitly carrying its slug, and an equal
 * receiver hash or course id in one major's curation can never bleed into
 * another's.
 *
 * A blank slug returns an empty clause (no major scoping) — callers that want a
 * definite major default the slug before calling.
 *
 * This clause was copied into pathways, the pathway planner, and curation, each
 * free to drift. It lives here so there is exactly one definition; onboarding a
 * major needs no change to it.
 */
function majorDocumentClause(majorSlug) {
  const slug = String(majorSlug || '').trim();
  if (!slug) return {};
  if (slug === defaultMajor().slug) {
    return {
      $or: [
        { major_slug: slug },
        { major_slug: { $exists: false } },
        { major_slug: null },
      ],
    };
  }
  return { major_slug: slug };
}

module.exports = { majorDocumentClause };
