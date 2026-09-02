/**
 * Stable numeric identities for the Virginia projection.
 *
 * These ids are part of the shared-analysis schema and are referenced by the
 * configured Virginia program cohort.  They must never be recomputed from a
 * display-name sort: a spelling correction or newly discovered institution
 * would otherwise move every later school onto somebody else's id.
 */

const rows = [
  [9201, 'four_year', 'appalachian-college-of-pharmacy', 'Appalachian College of Pharmacy'],
  [9202, 'four_year', 'averett-university', 'Averett University'],
  [9203, 'four_year', 'batten-university', 'Batten University'],
  [9204, 'four_year', 'bluefield-college', 'Bluefield College'],
  [9205, 'four_year', 'bridgewater-college', 'Bridgewater College'],
  [9206, 'four_year', 'christopher-newport-university', 'Christopher Newport University'],
  [9207, 'four_year', 'eastern-mennonite-university', 'Eastern Mennonite University'],
  [9208, 'four_year', 'emory-henry-college', 'Emory & Henry College'],
  [9209, 'four_year', 'ferrum-college', 'Ferrum College'],
  [9210, 'four_year', 'george-mason-university', 'George Mason University'],
  [9211, 'four_year', 'george-washington-university', 'George Washington University'],
  [9212, 'four_year', 'hollins-university', 'Hollins University'],
  [9213, 'four_year', 'james-madison-university', 'James Madison University'],
  [9214, 'four_year', 'longwood-university', 'Longwood University'],
  [9215, 'four_year', 'mary-baldwin-university', 'Mary Baldwin University'],
  [9216, 'four_year', 'marymount-university', 'Marymount University'],
  [9217, 'four_year', 'norfolk-state-university', 'Norfolk State University'],
  [9218, 'four_year', 'old-dominion-university', 'Old Dominion University'],
  [9219, 'four_year', 'radford-university', 'Radford University'],
  [9220, 'four_year', 'randolph-college', 'Randolph College'],
  [9221, 'four_year', 'randolph-macon-college', 'Randolph-Macon College'],
  [9222, 'four_year', 'regent-university', 'Regent University'],
  [9223, 'four_year', 'roanoke-college', 'Roanoke College'],
  [9224, 'four_year', 'shenandoah-university', 'Shenandoah University'],
  [9225, 'four_year', 'sweet-briar-college', 'Sweet Briar College'],
  [9226, 'four_year', 'the-university-of-virginia-s-college-at-wise', "The University of Virginia's College at Wise"],
  [9227, 'four_year', 'university-of-lynchburg', 'University of Lynchburg'],
  [9228, 'four_year', 'university-of-mary-washington', 'University of Mary Washington'],
  [9229, 'four_year', 'virginia-commonwealth-university', 'Virginia Commonwealth University'],
  [9230, 'four_year', 'virginia-polytechnic-institute-and-state-university', 'Virginia Polytechnic Institute and State University'],
  [9231, 'four_year', 'virginia-state-university', 'Virginia State University'],
  [9232, 'four_year', 'virginia-wesleyan-university', 'Virginia Wesleyan University'],
  [9233, 'four_year', 'william-mary', 'William & Mary'],
  // Official CS degree sources with no Transfer Virginia equivalency owner.
  // They remain source-accounted exclusions rather than active figure columns.
  [9234, 'four_year', 'university-of-virginia', 'University of Virginia'],
  [9235, 'four_year', 'virginia-military-institute', 'Virginia Military Institute'],
  [9301, 'community_college', 'blue-ridge-community-college', 'Blue Ridge Community College'],
  [9302, 'community_college', 'brightpoint-community-college', 'Brightpoint Community College'],
  [9303, 'community_college', 'central-virginia-community-college', 'Central Virginia Community College'],
  [9304, 'community_college', 'danville-community-college', 'Danville Community College'],
  [9305, 'community_college', 'eastern-shore-community-college', 'Eastern Shore Community College'],
  [9306, 'community_college', 'germanna-community-college', 'Germanna Community College'],
  [9307, 'community_college', 'j-sargeant-reynolds-community-college', 'J Sargeant Reynolds Community College'],
  [9308, 'community_college', 'laurel-ridge-community-college', 'Laurel Ridge Community College'],
  [9309, 'community_college', 'mountain-empire-community-college', 'Mountain Empire Community College'],
  [9310, 'community_college', 'mountain-gateway-community-college', 'Mountain Gateway Community College'],
  [9311, 'community_college', 'new-river-community-college', 'New River Community College'],
  [9312, 'community_college', 'northern-virginia-community-college', 'Northern Virginia Community College'],
  [9313, 'community_college', 'patrick-henry-community-college', 'Patrick & Henry Community College'],
  [9314, 'community_college', 'paul-d-camp-community-college', 'Paul D. Camp Community College'],
  [9315, 'community_college', 'piedmont-virginia-community-college', 'Piedmont Virginia Community College'],
  [9316, 'community_college', 'rappahannock-community-college', 'Rappahannock Community College'],
  [9317, 'community_college', 'richard-bland-college', 'Richard Bland College'],
  [9318, 'community_college', 'southside-virginia-community-college', 'Southside Virginia Community College'],
  [9319, 'community_college', 'southwest-virginia-community-college', 'Southwest Virginia Community College'],
  [9320, 'community_college', 'tidewater-community-college', 'Tidewater Community College'],
  [9321, 'community_college', 'virginia-highlands-community-college', 'Virginia Highlands Community College'],
  [9322, 'community_college', 'virginia-peninsula-community-college', 'Virginia Peninsula Community College'],
  [9323, 'community_college', 'virginia-western-community-college', 'Virginia Western Community College'],
  [9324, 'community_college', 'wytheville-community-college', 'Wytheville Community College'],
];

const VA_INSTITUTION_REGISTRY = Object.freeze(rows.map(([id, level, slug, name]) => (
  Object.freeze({ id, level, slug, name })
)));
const BY_SLUG = new Map(VA_INSTITUTION_REGISTRY.map((row) => [row.slug, row]));
const BY_ID = new Map(VA_INSTITUTION_REGISTRY.map((row) => [row.id, row]));

function institutionIdentityBySlug(slug, level = null) {
  const identity = BY_SLUG.get(String(slug || '')) || null;
  return identity && (!level || identity.level === level) ? identity : null;
}

function institutionIdentityById(id, level = null) {
  const identity = BY_ID.get(Number(id)) || null;
  return identity && (!level || identity.level === level) ? identity : null;
}

function requireInstitutionIdentity(slug, level) {
  const identity = institutionIdentityBySlug(slug, level);
  if (!identity) {
    throw new Error(`Virginia institution ${slug || '<missing>'} is not registered as ${level}`);
  }
  return identity;
}

module.exports = {
  VA_INSTITUTION_REGISTRY,
  institutionIdentityById,
  institutionIdentityBySlug,
  requireInstitutionIdentity,
};
