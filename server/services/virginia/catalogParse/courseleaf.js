/**
 * Read a program's requirements out of a CourseLeaf catalog page.
 *
 * CourseLeaf is the one Virginia catalog platform whose markup carries the
 * structure explicitly, so this parser reads HTML rather than text. The classes
 * are semantic and stable across installs:
 *
 *   table.sc_plangrid       a term-by-term plan; `tr.plangridterm` starts a term
 *   table.sc_courselist     a requirement list; `tr.areaheader` starts an area
 *   td.codecol / .titlecol / .hourscol   the three columns
 *   a.code                  a course code
 *   span.comment            an instruction or an unenumerated category
 *   div.blockindent         nesting — an option under the comment above it
 *   tr.plangridsum          the term's credit subtotal
 *
 * Note what a plan grid means here. At the community colleges that use
 * CourseLeaf, the term grid **is** the published requirement structure — NOVA
 * publishes no categorical breakdown at all — so its terms become the
 * requirement groups. That is the opposite of the rule the text parser applies
 * to Acalog, where a suggested schedule follows a real requirement list and
 * must be discarded to avoid counting the degree twice. The difference is in
 * the source, not in the reader: one publishes a plan instead of requirements,
 * the other publishes a plan in addition to them.
 */
const cheerio = require('cheerio');
const { normCode, parseCredits, parseInstruction, INSTRUCTION, TOTAL_LINE } = require('./normalize');

const clean = (s) => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

const newGroup = (title, source) => ({
  title: title || 'Requirements',
  credits: null,
  choose: null,
  choose_credits: null,
  distinct_sections: null,
  note: null,
  source_text: source ? [source] : [],
  sections: [{ label: null, choose: null, credits: null, rows: [] }],
});

const lastSection = (group) => group.sections[group.sections.length - 1];

/**
 * One table row into a requirement row.
 *
 * `a.code` gives the codes and `td.titlecol` the titles, in the same order, so
 * they are zipped positionally. An `or` alternative is printed as a second code
 * inside a `div.blockindent` — the indent is the only thing distinguishing
 * "CSC 208 or MTH 288 (choose one)" from two separate required courses.
 */
function rowFrom($, tr) {
  const codeCell = $(tr).find('td.codecol').first();
  // Not every CourseLeaf template tags the title cell: George Mason and
  // Virginia Tech emit a bare `<td>` between `.codecol` and `.hourscol`.
  // Reading only `.titlecol` returns zero titles for them, and a four-year
  // course has no registry to look its name up in afterwards — the document
  // ends up rendering bare numbers, which is precisely the complaint.
  const titleCell = $(tr).find('td.titlecol').first().length
    ? $(tr).find('td.titlecol').first()
    : $(tr).find('td').not('.codecol').not('.hourscol').first();
  const hours = clean($(tr).find('td.hourscol').first().text());

  // A lecture-plus-lab pair is printed `EET 111& 111L`, and CourseLeaf wraps the
  // lab in its own anchor without repeating the prefix. Carrying the prefix
  // forward keeps the lab as the course it is instead of dropping it.
  const codes = [];
  let prefix = null;
  codeCell.find('a.code').each((_, a) => {
    const raw = normCode($(a).text());
    if (/^[A-Z]{2,5}\d{3,4}[A-Z]?$/.test(raw)) {
      prefix = /^[A-Z]{2,5}/.exec(raw)[0];
      codes.push(raw);
    } else if (prefix && /^\d{3,4}[A-Z]?$/.test(raw)) {
      codes.push(`${prefix}${raw}`);
    }
  });
  const titles = titleCell.contents().map((_, n) => clean($(n).text())).get().filter(Boolean);

  // `or` appears as literal text before the alternative, in its own indent
  // block. It must be read from that block and not from the flattened cell
  // text: flattening yields `SDV 100or SDV 101`, where `\bor\b` finds no left
  // word boundary between `0` and `o` and silently reports a required pair
  // instead of a choice.
  const codeText = clean(codeCell.text());
  const orIndent = codeCell.find('div.blockindent').toArray()
    .some((d) => /^or\b/i.test(clean($(d).text())));
  const conjunction = codes.length > 1 && (orIndent || /or\s+[A-Z]{2,5}\s?\d{3}/.test(codeText)) ? 'or' : 'and';

  return {
    codes: codes.map((code, i) => ({
      code,
      title: (titles[i] || '').replace(/^or\s+/i, '').replace(/[:]\s*$/, '') || null,
    })),
    conjunction,
    text: clean(`${codeText} ${clean(titleCell.text())}`),
    credits: parseCredits(hours),
    indented: codeCell.find('div.blockindent').length > 0 && codeCell.children('a.code').length === 0,
  };
}

/** A row that names no course: either an instruction or an unenumerated category. */
function commentRow($, tr) {
  const codeCell = $(tr).find('td.codecol, td[colspan]').first();
  const text = clean(codeCell.text());
  const hours = clean($(tr).find('td.hourscol').first().text());
  return { text, credits: parseCredits(hours) };
}

function parseCourseLeafProgram(html, { programTitle = null } = {}) {
  const $ = cheerio.load(html || '');
  $('script, style, noscript').remove();

  // A four-year CourseLeaf page is tabbed: curriculum, graduation requirements,
  // and a term-by-term *roadmap* that restates the whole degree. The roadmap is
  // a suggested schedule, not a requirement — Virginia Tech's would add a
  // second copy of all 123 credits — so it is dropped whenever the page also
  // carries a real requirement tab. When the roadmap is all there is (the
  // community-college plan grids), it is kept, because then it is the
  // requirements.
  const roadmap = $('[id*="roadmap" i]');
  if (roadmap.length) {
    const outside = $('table.sc_courselist').filter((_, t) => $(t).closest('[id*="roadmap" i]').length === 0);
    if (outside.length) roadmap.remove();
  }

  const groups = [];
  let total = null;
  let current = null;
  let pendingHeading = null;

  const open = (title, source) => {
    current = newGroup(title, source);
    groups.push(current);
    return current;
  };

  // Walk headings and tables in document order so a course list is attributed
  // to the heading printed above it.
  // `strong` counts as a heading here because the four-year pages label their
  // elective menus that way — `<p><strong>Statistics Elective.</strong>` above
  // the list — rather than with a real heading tag. Without it every menu on
  // the page comes through titled "Requirements".
  const nodes = $('h1, h2, h3, h4, strong, table.sc_plangrid, table.sc_courselist').toArray();
  for (const node of nodes) {
    const tag = node.tagName ? node.tagName.toLowerCase() : '';

    if (tag !== 'table') {
      const text = clean($(node).text());
      if (text && text.length <= 120) pendingHeading = text;
      continue;
    }

    const isPlanGrid = $(node).hasClass('sc_plangrid');
    $(node).find('tr').each((_, tr) => {
      const $tr = $(tr);
      const cls = $tr.attr('class') || '';
      if (/hidden|noscript/.test(cls)) return;

      // Term header in a plan grid, area header in a course list. `plangridyear`
      // is the same row with a coarser label — Norfolk State groups by year
      // rather than by semester, and missing it collapses the whole degree into
      // a single group.
      if (/plangridterm|plangridyear/.test(cls)) {
        open(clean($tr.find('td, th').first().text()), null);
        return;
      }
      if (/areaheader/.test(cls)) {
        open(clean($tr.text()), null);
        return;
      }
      // Sum rows. `Subtotal` is the group's; `Total Credits` is the degree's.
      // CourseLeaf marks them with a class at some institutions and with the
      // label alone at others (Virginia Tech prints `Subtotal` in an ordinary
      // row), so both signals are read. Getting this backwards is not a small
      // error: it files the whole 120-credit degree as one group's cost and
      // leaves the degree total reading as the major's 46.
      const sumLabel = clean($tr.find('td.titlecol, td').not('.hourscol').text());
      const isSumRow = /plangridsum|listsum|plangridtotal/.test(cls)
        || /^(sub\s?total|total\s+(credits?|hours?|credit\s+hours?))\b/i.test(sumLabel);
      if (isSumRow) {
        const hours = parseCredits(clean($tr.find('td.hourscol').first().text()));
        if (!hours) return;
        const isDegreeTotal = /^total\b/i.test(sumLabel) && !/^sub/i.test(sumLabel);
        if (isDegreeTotal) {
          // The largest stated total is the degree's; a program that prints
          // several "Total" rows is totalling its sections, not itself.
          if (!total || hours.min > total.min) total = hours;
        } else if (current) {
          current.credits = hours;
        }
        return;
      }

      if (!current) open(pendingHeading || (isPlanGrid ? 'Plan of study' : 'Requirements'), null);

      const hasCodes = $tr.find('a.code').length > 0;
      if (!hasCodes) {
        const { text, credits } = commentRow($, $tr);
        if (!text) return;
        const totalMatch = TOTAL_LINE.exec(text);
        if (totalMatch && !total) { total = parseCredits(totalMatch[1]); return; }
        if (INSTRUCTION.test(text)) {
          // Opens a choice section; the hours column carries its credit ask.
          const parsed = parseInstruction(text) || {};
          const section = lastSection(current);
          const target = section.rows.length ? { label: null, choose: null, credits: null, rows: [] } : section;
          if (target !== section) current.sections.push(target);
          target.choose = parsed.courses != null ? parsed.courses : 1;
          if (credits) target.credits = credits;
          if (parsed.distinct_sections != null) current.distinct_sections = parsed.distinct_sections;
          current.note = current.note ? `${current.note} ${text}` : text;
          current.source_text.push(text);
          return;
        }
        // Not an instruction: a requirement with no enumerated course list
        // ("HIS Elective", "Humanities/Fine Arts Elective"). Real, consumes
        // credits, and deliberately kept rather than dropped — it is the
        // difference between a 60-credit degree and a 48-credit one.
        lastSection(current).rows.push({ codes: [], conjunction: 'and', text, category: text, credits });
        current.source_text.push(text);
        return;
      }

      const row = rowFrom($, $tr);
      if (!row.codes.length) return;
      lastSection(current).rows.push(row);
      current.source_text.push(row.text);
    });

    current = null;
    pendingHeading = null;
  }

  for (const g of groups) g.sections = g.sections.filter((s) => s.rows.length || s.choose != null || s.credits);

  return {
    program_title: programTitle,
    total_credits: total,
    groups: groups.filter((g) => g.sections.length),
    stopped_at: null,
    narrative: [],
    unassigned: [],
  };
}

module.exports = { parseCourseLeafProgram, rowFrom };
