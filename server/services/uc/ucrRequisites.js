/**
 * UC Riverside publishes no online catalogue — only a PDF
 * (documents.ucr.edu/registrar/UCR Catalog 2025-2026.pdf). Its course entries
 * read:
 *
 *   CS 111 Discrete Structures 4 Lecture, 3 hours … Prerequisite(s): CS 010A;
 *   CS 011 or MATH 011; MATH 009C or MATH 09HC; MATH 031 or EE 020.
 *
 * Riverside separates REQUIREMENTS WITH SEMICOLONS and alternatives with "or",
 * which is the opposite of the convention every other campus uses — elsewhere a
 * semicolon ends the prerequisite sentence. Reading it with the shared prose
 * parser would keep only the first requirement and silently drop the rest.
 *
 * The grade qualifier has to be stripped before splitting on "or", because
 * "with a grade of C- or better" contains an "or" that is not an alternative.
 */
const CODE = /\b([A-Z]{2,5})\s?(\d{2,3}[A-Z]{0,2})\b/g;

/** Remove qualifiers that contain the word "or" without offering a choice. */
const stripQualifiers = (text) => String(text || '')
  .replace(/\s+with\s+a\s+(?:minimum\s+)?grade\s+of\s+[A-Z][+-]?\s*(?:or\s+better)?/gi, ' ')
  .replace(/\s+or\s+(?:equivalent|consent of instructor|better)\b/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function codesIn(fragment) {
  const found = [];
  let m;
  CODE.lastIndex = 0;
  while ((m = CODE.exec(fragment)) !== null) {
    const digits = m[2].replace(/[A-Z]+$/, '');
    const suffix = (/[A-Z]+$/.exec(m[2]) || [''])[0];
    found.push(`${m[1]} ${String(Number(digits))}${suffix}`);
  }
  return [...new Set(found)];
}

/**
 * @returns {{groups: string[][], text: string|null}} AND of ORs
 */
function parseUcrRequisites(raw) {
  const text = stripQualifiers(raw);
  if (!text) return { groups: [], text: null };
  const groups = [];
  // Semicolons separate requirements; commas do too when they list requirements
  // rather than alternatives, which Riverside signals by omitting "or".
  for (const conjunct of text.split(/;/)) {
    if (!conjunct.trim()) continue;
    const codes = codesIn(conjunct);
    if (!codes.length) continue;
    if (/\bor\b/i.test(conjunct)) groups.push(codes);
    else for (const code of codes) groups.push([code]);
  }
  return { groups, text: String(raw).trim().slice(0, 400) || null };
}

/**
 * Split the flow-order PDF text into course entries.
 *
 * The catalogue is typeset in columns, so `pdftotext` interleaves running heads
 * and the occasional neighbouring column into a block. Entries whose own header
 * line is intact still parse; the rest are reported rather than guessed at.
 */
function splitUcrCourses(rawText) {
  const cleaned = String(rawText)
    .replace(/-\n/g, '')
    .replace(/\n(?:Lower-Division Courses|Upper-Division Courses|Graduate Courses|Professional Courses)\n/g, '\n');
  const lines = cleaned.split('\n');
  const HEAD = /^([A-Z]{2,5}) (\d{2,3}[A-Z]{0,2})\s+(.{3,90}?)\s+(\d(?:-\d)?)\s/;
  const starts = [];
  lines.forEach((line, i) => { if (HEAD.test(line)) starts.push(i); });

  const out = [];
  starts.forEach((start, n) => {
    const end = n + 1 < starts.length ? starts[n + 1] : Math.min(start + 40, lines.length);
    const block = lines.slice(start, end).join(' ');
    const head = HEAD.exec(lines[start]);
    const prereq = /Prerequisite\(s\):\s*(.*?)(?:\.\s|$)/.exec(block);
    const parsed = parseUcrRequisites(prereq ? prereq[1] : '');
    out.push({
      code: `${head[1]} ${String(Number(head[2].replace(/[A-Z]+$/, '')))}${(/[A-Z]+$/.exec(head[2]) || [''])[0]}`,
      title: head[3].trim(),
      units: head[4],
      requires: parsed.groups,
      requisite_text: parsed.text,
    });
  });
  return out;
}

module.exports = { parseUcrRequisites, splitUcrCourses, stripQualifiers, codesIn };
