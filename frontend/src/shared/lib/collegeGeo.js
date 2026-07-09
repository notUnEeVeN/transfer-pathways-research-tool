// Geography filtering for the community-college lists in the data explorer.
// Colleges come from /community-colleges already carrying { district, region,
// counties_served } (see server/controllers/CommunityCollege.js). A college
// belongs to exactly one district/region and serves one or more counties.

const uniqSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

// The distinct filter options for a college list, narrowed to what belongs
// under the current coarser selection: districts are limited to the chosen
// region, and counties to the chosen region + district. Regions are always the
// full set. Each list is sorted; counties come from the counties_served arrays
// (a college can serve several). Pass no selection for the unfiltered options.
export function geoOptions(colleges = [], { region = '', district = '' } = {}) {
  const inRegion = region ? colleges.filter((c) => c.region === region) : colleges;
  const inDistrict = district ? inRegion.filter((c) => c.district === district) : inRegion;
  return {
    regions: uniqSorted(colleges.map((c) => c.region)),
    districts: uniqSorted(inRegion.map((c) => c.district)),
    counties: uniqSorted(inDistrict.flatMap((c) => c.counties_served || [])),
  };
}

// True when a college satisfies every set geography filter. An unset filter
// (falsy) never excludes. County matches when it is among the college's
// counties_served.
export function matchesGeo(college, { region, district, county } = {}) {
  if (region && college.region !== region) return false;
  if (district && college.district !== district) return false;
  if (county && !(college.counties_served || []).includes(county)) return false;
  return true;
}

export const hasActiveGeo = ({ region, district, county } = {}) =>
  Boolean(region || district || county);
