/**
 * UC Santa Barbara states prerequisites as prose, and writes course references
 * two different ways — sometimes by code ("CHEM 2B or CHEM 1B"), sometimes by
 * department name ("Chemistry 115A", "Anthropology 3 or 3SS"). Roughly 422 of
 * 1,388 in-scope courses use names and 314 use codes, so both must be read.
 *
 * It also uses a hyphenated series shorthand — "Chemistry 112A-B-C" means 112A,
 * 112B and 112C — which expands to three separate requirements.
 *
 * The department map is hand-written because UC Santa Barbara's Coursedog
 * instance exposes no subject endpoint. It covers the departments our majors
 * reach; a name outside it simply yields no edge rather than a wrong one.
 */
const SUBJECT_BY_NAME = Object.freeze({
  'computer science': 'CMPSC',
  mathematics: 'MATH',
  math: 'MATH',
  physics: 'PHYS',
  chemistry: 'CHEM',
  'chemistry and biochemistry': 'CHEM',
  economics: 'ECON',
  statistics: 'PSTAT',
  'probability and statistics': 'PSTAT',
  'statistics and applied probability': 'PSTAT',
  biology: 'BIOL',
  'molecular, cellular, and developmental biology': 'MCDB',
  'molecular biology': 'MCDB',
  'ecology, evolution, and marine biology': 'EEMB',
  anthropology: 'ANTH',
  'electrical and computer engineering': 'ECE',
  'mechanical engineering': 'ME',
  'earth science': 'EARTH',
  psychology: 'PSY',
  'psychological and brain sciences': 'PSY',
  'communication': 'COMM',
  'political science': 'POL S',
  sociology: 'SOC',
  'environmental studies': 'ENV S',
  'chemical engineering': 'CH E',
  'materials': 'MATRL',
  writing: 'WRIT',
});

const NAMES_BY_LENGTH = Object.keys(SUBJECT_BY_NAME).sort((a, b) => b.length - a.length);

const stripHtml = (value) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Expand "112A-B-C" into ["112A", "112B", "112C"]. Returns [number] unchanged
 * when there is no series shorthand.
 */
function expandSeries(number) {
  const m = /^(\d{1,3})([A-Z])((?:-[A-Z])+)$/.exec(number);
  if (!m) return [number];
  const [, digits, first, rest] = m;
  return [`${digits}${first}`, ...rest.split('-').filter(Boolean).map((s) => `${digits}${s}`)];
}

/**
 * Find every course reference in one clause, as normalized "PREFIX NUMBER".
 * Handles both the code form and the department-name form.
 */
function referencesIn(text, currentSubject = null) {
  const found = [];
  const push = (prefix, number) => {
    for (const n of expandSeries(number)) found.push(`${prefix} ${n}`);
  };

  // Department-name form first, so "Chemistry 115A" is not also read as a code.
  let working = text;
  for (const name of NAMES_BY_LENGTH) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d{1,3}[A-Z]{0,2}(?:-[A-Z])*)`, 'gi');
    working = working.replace(re, (_, number) => {
      push(SUBJECT_BY_NAME[name], number.toUpperCase());
      return ' ';
    });
  }

  // Code form.
  const CODE = /\b([A-Z]{2,6}(?:\s[A-Z]{1,3})?)\s?(\d{1,3}[A-Z]{0,2}(?:-[A-Z])*)\b/g;
  let m;
  while ((m = CODE.exec(working)) !== null) push(m[1].trim(), m[2].toUpperCase());

  // A bare number after a resolved reference belongs to the same department:
  // "Anthropology 3 or 3SS" means ANTH 3 and ANTH 3SS.
  const subject = found.length ? found[found.length - 1].replace(/\s\S+$/, '') : currentSubject;
  if (subject) {
    const bare = /\bor\s+(\d{1,3}[A-Z]{1,2})\b/g;
    let b;
    while ((b = bare.exec(working)) !== null) push(subject, b[1].toUpperCase());
  }
  return [...new Set(found)];
}

/**
 * Read one UC Santa Barbara requisite blob into an AND of ORs.
 * Conjuncts split on "and"; alternatives on "or" or a comma inside an or-clause.
 */
function parseUcsbRequisites(raw, currentSubject = null) {
  const text = stripHtml(raw);
  if (!text) return { groups: [], text: null };
  // Stop before conditions that are not course gates.
  const clause = text.split(/;|\.\s+(?=[A-Z])|\bwith a minimum grade\b|\bConsent of\b/i)[0];
  const groups = [];
  for (const conjunct of clause.split(/\s+and\s+/i)) {
    const refs = referencesIn(conjunct, currentSubject);
    if (!refs.length) continue;
    if (/\bor\b/i.test(conjunct)) groups.push(refs);
    else for (const ref of refs) groups.push([ref]);
  }
  return { groups, text: clause.trim() || null };
}

module.exports = { parseUcsbRequisites, referencesIn, expandSeries, SUBJECT_BY_NAME };
