// Major → academic-area classifier for the coverage matrix.
//
// ASSIST majors are free text and there is no canonical taxonomy in the data,
// so this is a deliberately TRANSPARENT, TUNABLE keyword classifier — adjust the
// RULES below to re-bucket a major. It only powers the coverage *navigation*
// matrix (where to audit next), never any safety/confidence number, so an
// imperfect bucket is low-stakes.
//
// Order matters: the first matching rule wins, so list specific phrases before
// broad stems (e.g. "chemical engineering" lands in Engineering via the engineer
// stem before "chemistry" could pull it into Physical Sci). Anything unmatched
// falls to "Other".

const AREAS = [
  'Bio Sci',
  'Engineering & CS',
  'Physical Sci',
  'Social Sci',
  'Humanities',
  'Business / Econ',
  'Arts',
  'Other',
];

// [area, /regex/] — first match wins. Stems use a leading \b (word start) and no
// trailing boundary so "engineer" matches "engineering", "theat" matches
// "theatre", etc.
const RULES = [
  ['Engineering & CS', /\b(comput|software|informatic|cyber|data scien|robotic|engineer|electrical|mechanical|aerospace)/],
  ['Business / Econ',  /\b(business|econ|account|finance|marketing|management|administrat|entrepreneur|supply chain|real estate)/],
  ['Bio Sci',          /\b(biolog|biochem|microbio|molecular|genetic|neuro|physiolog|ecolog|zoolog|botan|marine|biotech|nursing|kinesiolog|health|pre-?med|nutrition|anatomy)/],
  ['Physical Sci',     /\b(physic|chemist|astronom|geolog|geophys|earth|environment|atmospher|oceanograph|\bmath|statistic)/],
  ['Social Sci',       /\b(psycholog|sociolog|anthropolog|politic|criminolog|social|communicat|international relation|public policy|ethnic|gender|urban|human development|geograph)/],
  ['Humanities',       /\b(histor|philosoph|english|literatur|linguist|religio|classic|spanish|french|german|chinese|japanese|italian|language|writing|rhetoric|humanities|cultural|liberal)/],
  ['Arts',             /\b(art|music|theat|dance|film|cinema|design|architect|media|visual|performing|studio|photograph|drama)/],
];

function classifyArea(major) {
  const s = String(major || '').toLowerCase();
  for (const [area, re] of RULES) {
    if (re.test(s)) return area;
  }
  return 'Other';
}

module.exports = { AREAS, classifyArea };
