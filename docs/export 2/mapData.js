// Geometry + district data for the California articulation coverage map.
//
// GEOMETRY is real: the California boundary ring is census-derived for the
// eastern/southern borders (public domain) plus real coastal landmark anchors
// for the central/north coast. District names and coordinates are real
// California Community College Districts (main campus / HQ city).
//
// `count` (0-9 fully-articulated UC campuses) is ILLUSTRATIVE SAMPLE DATA in
// this file — replace each district's `count` with the real value produced by
// your coverage calculation. Do not change the bucket thresholds elsewhere;
// this file carries no calculation logic.

// California outline as [lon, lat], clockwise from the NW (Oregon) corner.
export const CA_RING = [
  [-124.213, 42.000], [-123.233, 42.006], [-122.379, 42.012], [-121.037, 41.995],
  [-120.002, 41.995], [-119.996, 40.265], [-120.002, 38.999], [-118.715, 38.101],
  [-117.499, 37.219], [-116.540, 36.502], [-115.850, 35.971], [-114.634, 35.001],
  [-114.634, 34.875], [-114.470, 34.711], [-114.333, 34.448], [-114.136, 34.306],
  [-114.257, 34.174], [-114.415, 34.108], [-114.536, 33.933], [-114.498, 33.698],
  [-114.525, 33.550], [-114.728, 33.407], [-114.662, 33.035], [-114.525, 33.029],
  [-114.470, 32.843], [-114.525, 32.756], [-114.722, 32.717], [-116.048, 32.624],
  [-117.126, 32.537], [-117.247, 32.668], [-117.252, 32.876], [-117.329, 33.123],
  [-117.472, 33.298], [-117.784, 33.539], [-118.184, 33.763], [-118.260, 33.703],
  [-118.414, 33.741], [-118.392, 33.840], [-118.567, 34.043], [-118.802, 33.999],
  [-119.219, 34.147], [-119.300, 34.270], [-119.690, 34.420], [-120.230, 34.470],
  [-120.470, 34.450], [-120.630, 34.900], [-120.630, 35.130], [-120.870, 35.370],
  [-121.280, 35.670], [-121.900, 36.310], [-121.970, 36.580], [-122.060, 36.950],
  [-122.410, 37.180], [-122.510, 37.500], [-122.520, 37.780], [-122.980, 37.990],
  [-123.020, 38.060], [-123.050, 38.300], [-123.240, 38.510], [-123.740, 38.910],
  [-123.800, 39.300], [-123.780, 39.640], [-124.070, 40.020], [-124.410, 40.440],
  [-124.160, 40.780], [-124.150, 41.060], [-124.080, 41.530], [-124.210, 41.760],
  [-124.213, 42.000],
];

// The nine UC undergraduate campuses (used only to list covered campus names in
// the tooltip; the component derives the covered set as the `count` nearest UCs
// to each district — swap in your real per-district covered lists if you have them).
export const UC_CAMPUSES = [
  { code: 'UCB',  name: 'Berkeley',      lat: 37.872, lon: -122.259 },
  { code: 'UCD',  name: 'Davis',         lat: 38.538, lon: -121.762 },
  { code: 'UCM',  name: 'Merced',        lat: 37.366, lon: -120.425 },
  { code: 'UCSC', name: 'Santa Cruz',    lat: 36.992, lon: -122.058 },
  { code: 'UCSB', name: 'Santa Barbara', lat: 34.414, lon: -119.849 },
  { code: 'UCLA', name: 'Los Angeles',   lat: 34.069, lon: -118.445 },
  { code: 'UCI',  name: 'Irvine',        lat: 33.641, lon: -117.844 },
  { code: 'UCR',  name: 'Riverside',     lat: 33.974, lon: -117.328 },
  { code: 'UCSD', name: 'San Diego',     lat: 32.880, lon: -117.234 },
];

// 72 California Community College Districts. count = fully-articulated UC
// campuses (0-9). count values here are illustrative sample data.
export const DISTRICTS = [
  { id: 'siskiyou',      name: 'Siskiyou Joint',        lat: 41.42, lon: -122.38, count: 1 },
  { id: 'redwoods',      name: 'Redwoods',              lat: 40.70, lon: -124.20, count: 1 },
  { id: 'shasta',        name: 'Shasta-Tehama-Trinity', lat: 40.62, lon: -122.32, count: 2 },
  { id: 'lassen',        name: 'Lassen',                lat: 40.42, lon: -120.65, count: 0 },
  { id: 'feather',       name: 'Feather River',         lat: 39.94, lon: -120.95, count: 1 },
  { id: 'butte',         name: 'Butte-Glenn',           lat: 39.44, lon: -121.61, count: 3 },
  { id: 'mendocino',     name: 'Mendocino-Lake',        lat: 39.15, lon: -123.20, count: 2 },
  { id: 'yuba',          name: 'Yuba',                  lat: 39.14, lon: -121.59, count: 4 },
  { id: 'sierra',        name: 'Sierra Joint',          lat: 38.79, lon: -121.24, count: 6 },
  { id: 'laketahoe',     name: 'Lake Tahoe',            lat: 38.94, lon: -119.98, count: 1 },
  { id: 'losrios',       name: 'Los Rios',              lat: 38.57, lon: -121.49, count: 8 },
  { id: 'sonoma',        name: 'Sonoma County',         lat: 38.46, lon: -122.71, count: 5 },
  { id: 'napa',          name: 'Napa Valley',           lat: 38.30, lon: -122.29, count: 5 },
  { id: 'solano',        name: 'Solano',                lat: 38.26, lon: -122.06, count: 6 },
  { id: 'marin',         name: 'Marin',                 lat: 37.95, lon: -122.55, count: 6 },
  { id: 'contracosta',   name: 'Contra Costa',          lat: 37.99, lon: -122.06, count: 7 },
  { id: 'sanjoaquin',    name: 'San Joaquin Delta',     lat: 37.98, lon: -121.31, count: 6 },
  { id: 'peralta',       name: 'Peralta',               lat: 37.80, lon: -122.27, count: 9 },
  { id: 'sf',            name: 'San Francisco',         lat: 37.73, lon: -122.45, count: 9 },
  { id: 'chabot',        name: 'Chabot-Las Positas',    lat: 37.67, lon: -122.07, count: 7 },
  { id: 'yosemite',      name: 'Yosemite',              lat: 37.66, lon: -121.00, count: 5 },
  { id: 'sanmateo',      name: 'San Mateo County',      lat: 37.53, lon: -122.31, count: 8 },
  { id: 'ohlone',        name: 'Ohlone',                lat: 37.53, lon: -121.99, count: 7 },
  { id: 'merced',        name: 'Merced',                lat: 37.31, lon: -120.48, count: 5 },
  { id: 'foothill',      name: 'Foothill-De Anza',      lat: 37.36, lon: -122.13, count: 8 },
  { id: 'sanjose',       name: 'San Jose-Evergreen',    lat: 37.31, lon: -121.87, count: 8 },
  { id: 'westvalley',    name: 'West Valley-Mission',   lat: 37.26, lon: -122.01, count: 7 },
  { id: 'cabrillo',      name: 'Cabrillo',              lat: 36.98, lon: -121.90, count: 6 },
  { id: 'gavilan',       name: 'Gavilan',               lat: 36.99, lon: -121.57, count: 5 },
  { id: 'statecenter',   name: 'State Center',          lat: 36.77, lon: -119.79, count: 6 },
  { id: 'hartnell',      name: 'Hartnell',              lat: 36.68, lon: -121.65, count: 4 },
  { id: 'monterey',      name: 'Monterey Peninsula',    lat: 36.58, lon: -121.90, count: 5 },
  { id: 'sequoias',      name: 'Sequoias',              lat: 36.33, lon: -119.29, count: 3 },
  { id: 'westhills',     name: 'West Hills',            lat: 36.14, lon: -120.36, count: 2 },
  { id: 'kern',          name: 'Kern',                  lat: 35.38, lon: -119.02, count: 4 },
  { id: 'cuesta',        name: 'San Luis Obispo County',lat: 35.30, lon: -120.66, count: 4 },
  { id: 'westkern',      name: 'West Kern',             lat: 35.13, lon: -119.45, count: 1 },
  { id: 'hancock',       name: 'Allan Hancock Joint',   lat: 34.95, lon: -120.42, count: 3 },
  { id: 'barstow',       name: 'Barstow',               lat: 34.90, lon: -117.02, count: 1 },
  { id: 'antelope',      name: 'Antelope Valley',       lat: 34.69, lon: -118.14, count: 3 },
  { id: 'victorvalley',  name: 'Victor Valley',         lat: 34.53, lon: -117.29, count: 3 },
  { id: 'santaclarita',  name: 'Santa Clarita',         lat: 34.42, lon: -118.55, count: 5 },
  { id: 'sbcc',          name: 'Santa Barbara City',    lat: 34.44, lon: -119.71, count: 6 },
  { id: 'ventura',       name: 'Ventura County',        lat: 34.28, lon: -119.29, count: 6 },
  { id: 'glendale',      name: 'Glendale',              lat: 34.15, lon: -118.25, count: 8 },
  { id: 'pasadena',      name: 'Pasadena Area',         lat: 34.15, lon: -118.13, count: 8 },
  { id: 'citrus',        name: 'Citrus',                lat: 34.14, lon: -117.87, count: 7 },
  { id: 'coppermtn',     name: 'Copper Mountain',       lat: 34.14, lon: -116.31, count: 1 },
  { id: 'chaffey',       name: 'Chaffey',               lat: 34.10, lon: -117.59, count: 6 },
  { id: 'sanbernardino', name: 'San Bernardino',        lat: 34.13, lon: -117.30, count: 6 },
  { id: 'la',            name: 'Los Angeles',           lat: 34.05, lon: -118.25, count: 9 },
  { id: 'mtsac',         name: 'Mt. San Antonio',       lat: 34.05, lon: -117.84, count: 8 },
  { id: 'santamonica',   name: 'Santa Monica',          lat: 34.02, lon: -118.47, count: 9 },
  { id: 'riohondo',      name: 'Rio Hondo',             lat: 33.99, lon: -118.03, count: 7 },
  { id: 'riverside',     name: 'Riverside',             lat: 33.98, lon: -117.38, count: 7 },
  { id: 'northoc',       name: 'North Orange County',   lat: 33.87, lon: -117.92, count: 8 },
  { id: 'elcamino',      name: 'El Camino',             lat: 33.88, lon: -118.33, count: 7 },
  { id: 'compton',       name: 'Compton',               lat: 33.90, lon: -118.22, count: 5 },
  { id: 'cerritos',      name: 'Cerritos',              lat: 33.91, lon: -118.09, count: 7 },
  { id: 'mtsanjacinto',  name: 'Mt. San Jacinto',       lat: 33.79, lon: -116.96, count: 4 },
  { id: 'longbeach',     name: 'Long Beach City',       lat: 33.79, lon: -118.14, count: 8 },
  { id: 'desert',        name: 'Desert',                lat: 33.72, lon: -116.37, count: 4 },
  { id: 'coast',         name: 'Coast',                 lat: 33.67, lon: -117.91, count: 7 },
  { id: 'paloverde',     name: 'Palo Verde',            lat: 33.62, lon: -114.60, count: 0 },
  { id: 'ranchosantiago',name: 'Rancho Santiago',       lat: 33.75, lon: -117.88, count: 7 },
  { id: 'southoc',       name: 'South Orange County',   lat: 33.60, lon: -117.67, count: 6 },
  { id: 'miracosta',     name: 'MiraCosta',             lat: 33.19, lon: -117.35, count: 6 },
  { id: 'palomar',       name: 'Palomar',               lat: 33.14, lon: -117.17, count: 6 },
  { id: 'grossmont',     name: 'Grossmont-Cuyamaca',    lat: 32.80, lon: -116.95, count: 6 },
  { id: 'sandiego',      name: 'San Diego',             lat: 32.72, lon: -117.15, count: 8 },
  { id: 'southwestern',  name: 'Southwestern',          lat: 32.64, lon: -117.08, count: 5 },
  { id: 'imperial',      name: 'Imperial',              lat: 32.85, lon: -115.57, count: 2 },
];
