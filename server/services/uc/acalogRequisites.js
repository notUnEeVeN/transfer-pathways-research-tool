/**
 * UC Merced (Acalog) states prerequisites with explicit parentheses:
 *
 *   "Prerequisite Courses: MATH 024 and (ENGR 057 or ENGR 057H) and ENGR 151"
 *
 * That is unambiguous — unlike the prose the other campuses publish, where a
 * comma may mean either "and" or "or" — so it is parsed structurally: split the
 * top level on "and" while respecting brackets, then read each bracketed group
 * as a set of alternatives.
 */
const CODE = /\b([A-Z]{2,5})\s*(\d{1,3}[A-Z]{0,2})\b/g;

const clean = (value) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** Codes in one fragment, normalized to "PREFIX NUMBER" with leading zeros kept off. */
function codesIn(fragment) {
  const found = [];
  let m;
  CODE.lastIndex = 0;
  while ((m = CODE.exec(fragment)) !== null) {
    found.push(`${m[1]} ${String(Number(m[2].replace(/[A-Z]+$/, '')))}${(/[A-Z]+$/.exec(m[2]) || [''])[0]}`);
  }
  return [...new Set(found)];
}

/** Split on a separator that appears outside brackets. */
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let current = '';
  const re = new RegExp(`^\\s*${separator}\\s+`, 'i');
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const rest = text.slice(i);
      const hit = re.exec(rest);
      if (hit) {
        parts.push(current);
        current = '';
        i += hit[0].length - 1;
        continue;
      }
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * @returns {{groups: string[][], text: string|null}} AND of ORs
 */
function parseAcalogRequisites(raw) {
  const text = clean(raw);
  if (!text) return { groups: [], text: null };
  const m = /Prerequisite\s*(?:Courses?)?\s*:?\s*(.*)$/i.exec(text);
  if (!m) return { groups: [], text: null };
  // The clause ends where the next labelled field begins.
  const clause = m[1].split(/\s*(?:Open only to|Instructor Permission|Corequisite|Restriction|View course)/i)[0].trim();
  if (!clause) return { groups: [], text: null };

  const groups = [];
  for (const conjunct of splitTopLevel(clause, 'and')) {
    const alternatives = splitTopLevel(conjunct.replace(/^\(|\)$/g, ''), 'or');
    if (alternatives.length > 1) {
      const codes = alternatives.flatMap(codesIn);
      if (codes.length) groups.push([...new Set(codes)]);
    } else {
      const codes = codesIn(conjunct);
      // A conjunct naming several codes without "or" is several requirements.
      for (const code of codes) groups.push([code]);
    }
  }
  return { groups, text: clause || null };
}

/** Split the concatenated catalogue into one entry per course. */
function splitAcalogCourses(html) {
  const out = [];
  const blocks = html.split(/<h3>/).slice(1);
  for (const block of blocks) {
    const head = /^\s*([A-Z]{2,5}\s?\d{1,3}[A-Z]{0,2}):\s*([^<]{2,140})<\/h3>/.exec(block);
    if (!head) continue;
    const body = block.slice(0, 9000);
    const units = (/Units:\s*([\d.]+)/.exec(clean(body)) || [])[1] || null;
    const requisites = /Requisites and Restrictions<\/strong>([\s\S]{0,1200})/.exec(body);
    const parsed = parseAcalogRequisites(requisites ? requisites[1] : '');
    out.push({
      code: head[1].replace(/\s+/g, ' ').trim(),
      title: clean(head[2]),
      units,
      requires: parsed.groups,
      requisite_text: parsed.text,
    });
  }
  return out;
}

module.exports = { parseAcalogRequisites, splitAcalogCourses, splitTopLevel, codesIn };
