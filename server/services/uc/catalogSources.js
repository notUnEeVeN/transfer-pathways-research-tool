/**
 * Where each UC publishes its course catalogue, and how to address one
 * department on it.
 *
 * The departments are not listed here: they are derived from the curated degree
 * documents, so the capture covers exactly the departments our majors reference
 * (computer science, biology and economics together) and grows automatically as
 * majors are added.
 *
 * `transport` says how a page can be fetched:
 *   http     — prerequisites are in the served HTML
 *   json     — a Coursedog payload carries requisites as structured data
 *   browser  — the catalogue renders client-side, or sits behind Cloudflare, and
 *              needs the headed-Chrome capture (the same wall the Virginia
 *              Acalog catalogues put up; see captureVirginiaCatalogs.js)
 */
const SOURCES = Object.freeze({
  7: {
    campus: 'UC San Diego',
    transport: 'http',
    format: 'ucsd',
    // catalog.ucsd.edu/courses/CSE.html — prefix uppercased, spaces removed.
    // Some departments file several course prefixes on one page: every biology
    // prefix (BILD, BIBC, BIEB, BIMM, BIPN) lives on BIOL.html.
    aliases: { BILD: 'BIOL', BIBC: 'BIOL', BIEB: 'BIOL', BIMM: 'BIOL', BIPN: 'BIOL' },
    url: (prefix, _resolved, aliases = {}) =>
      `https://catalog.ucsd.edu/courses/${(aliases[prefix] || prefix).replace(/\s+/g, '')}.html`,
  },
  89: {
    campus: 'UC Davis',
    transport: 'http',
    format: 'courseleaf',
    url: (prefix) => `https://catalog.ucdavis.edu/courses-subject-code/${slug(prefix)}/`,
  },
  120: {
    campus: 'UC Irvine',
    transport: 'http',
    format: 'courseleaf',
    // catalogue.uci.edu/allcourses/i_c_sci/ — non-alphanumerics become underscores.
    url: (prefix) => `https://catalogue.uci.edu/allcourses/${prefix.toLowerCase().replace(/[^a-z0-9]+/g, '_')}/`,
  },
  132: {
    campus: 'UC Santa Cruz',
    transport: 'http',
    format: 'ucsc',
    // Slugs carry the department name as well as its code, so they are resolved
    // from the catalogue index rather than derived.
    index: 'https://catalog.ucsc.edu/en/current/general-catalog/courses/',
    url: (_prefix, resolved) => resolved,
  },
  128: {
    campus: 'UC Santa Barbara',
    transport: 'json',
    format: 'coursedog',
    url: (prefix) => `https://catalog.ucsb.edu/courses?subject=${encodeURIComponent(prefix)}`,
  },
  79: {
    campus: 'UC Berkeley',
    transport: 'browser',
    format: 'berkeley-guide',
    url: (prefix) => `https://guide.berkeley.edu/courses/${slug(prefix)}/`,
  },
  117: {
    campus: 'UCLA',
    transport: 'browser',
    format: 'ucla',
    url: (prefix) => `https://catalog.registrar.ucla.edu/subject/2025/${prefix.replace(/\s+/g, '')}`,
  },
  46: {
    campus: 'UC Riverside',
    transport: 'browser',
    format: 'ucr',
    url: () => 'https://catalog.ucr.edu/content.php?catoid=15&navoid=1490',
  },
  144: {
    campus: 'UC Merced',
    transport: 'browser',
    format: 'acalog',
    url: () => 'https://catalog.ucmerced.edu/content.php?catoid=22&navoid=2716',
  },
});

function slug(prefix) {
  return String(prefix).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

module.exports = { SOURCES, slug };
