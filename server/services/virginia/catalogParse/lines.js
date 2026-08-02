/**
 * Read a program's requirements out of catalog *text*.
 *
 * Used for Acalog and for department pages. Both were considered as HTML first
 * and rejected: Acalog's markup for a requirement block is not stable across
 * installs (`<ul class="program-core">` at one college, bare `<p><strong>` at
 * the next), while the *printed* form is stable across all of them, because it
 * is written for a human reading a catalog. The line grammar below is that
 * printed form:
 *
 *     Written Communication (6cr)          <- heading: title + credit figure
 *     ENG 111: College Composition I       <- a requirement row
 *     ENG 112: ... or ENG 113: ...         <- a row with alternatives
 *     Arts, Humanities, and Literature (6cr)
 *     Choose any two courses (6cr) ...     <- an instruction: how many
 *     Art                                  <- a sub-heading inside the group
 *     ART 101: History of Art ...
 *
 * Two rules earn their keep more than the rest:
 *
 * 1. **Stop at the suggested schedule.** These pages routinely print a
 *    term-by-term plan after the requirements, restating every course. Reading
 *    past it counts the whole degree twice.
 * 2. **A bare line inside a group is a sub-heading, not a new group.** `Art`,
 *    `Humanities` and `Literature` are three sections of one 6-credit
 *    requirement. Promoting them to groups turns one "choose two" into three
 *    separate requirements and inflates the degree.
 */
const {
  codesIn, hasCode, normCode, parseCredits, creditsFromHeading, headingTitle,
  parseInstruction, INSTRUCTION, PLAN_OF_STUDY, TOTAL_LINE, ADMINISTRATIVE,
  LABELLED_CREDITS,
} = require('./normalize');

/** Site furniture that survives text extraction. Never requirement content. */
const CHROME = /^(skip to (content|main)|image|print this page|catalog (search|home)|share this page|back to top|request info|apply|visit|give|home|menu|search|facebook|twitter|instagram|©|copyright|all rights reserved|add to (my )?portfolio|help \(opens a new window\)|\[\s*\]|\d{4}-\d{4} (academic )?catalog.*|course number\s+course title\s+credits?|code\s+title\s+(credits?|hours?)|school of .*|\d{4}-\d{4} college catalog.*)$/i;

/**
 * Headings that introduce a requirement group even without a credit figure.
 *
 * The term-heading half matters for the PDF catalogs, which lay a degree out as
 * `First Semester (Fall)` … `Fourth Semester (Spring)`. Without it every course
 * in the degree lands in one group and the page reads as flat — the exact
 * defect being fixed.
 */
const HEADING_SHAPE = new RegExp([
  '(requirements?|electives?|courses?|core|curriculum|general education|major|minor',
  '|concentration|emphasis|foundation|prerequisites?|support(ing)?|cognate|capstone|sequence)\\s*:?\\s*$',
  '|^(first|second|third|fourth|fifth|sixth|seventh|eighth|1st|2nd|3rd|4th|5th|6th|7th|8th)\\s+(semester|year|term)\\b',
  '|^(fall|spring|summer|winter)\\s*(semester|term)?\\s*\\d?\\s*$',
  '|^semester\\s*[-–—]?\\s*\\d+\\b',
  '|\\b(semester|term)\\s*[-–—]\\s*year\\s*\\d+\\s*$',
].join(''), 'i');

/**
 * A term's own credit figure: `Total  16-17`, `Semester Total Credits 17`.
 *
 * Distinct from the degree total, which carries a qualifier (`Program Total`,
 * `Total Minimum Credits`). Reading a term subtotal as the degree total makes
 * a 60-credit degree look like a 17-credit one.
 */
const GROUP_TOTAL = /^(?:semester\s+total(?:\s+(?:credits?|hours?))?|total)\s*[:\-–—]?\s*(\d+(?:[-–/]\d+)?)\s*$/i;

/**
 * A requirement written without naming a course.
 *
 * Virginia Peninsula writes its general-education slots as
 * `— xx3 - Arts/Humanities/Literature (BLK II) (3 credits)`. The line carries a
 * credit figure and no course, which is exactly the shape of a heading, so
 * without this it opens a group instead of being the requirement it is.
 */
const PLACEHOLDER_ROW = /^\s*[—–-]\s|\bx{2,3}\d\b/i;

/** Prose that is about the program but is not a requirement. */
const NARRATIVE = new RegExp([
  '^(purpose|description|overview|admissions?\\s+(requirements?|information)|entrance requirements',
  '|program (goals|outcomes|objectives)|student learning outcomes|upon completion|graduates',
  '|the curriculum|this (program|curriculum|degree)|contact|for more information',
  '|transfer (note|information)|note:|notes:|view approved',
  // Advice to the reader, and the numbered footnotes that follow a term table.
  // Both sit after the requirements and name courses, so without this they are
  // read as further requirements.
  '|students?\\s+(are|is|should|must|may|will)\\b',
  '|\\d+\\.\\s+see\\b)',
].join(''), 'i');

const clean = (s) => String(s ?? '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();

/**
 * Repair codes split across a line break.
 *
 * A PDF wraps wherever the column ends, including between a course prefix and
 * its number: `… OR CS` / `245 Programming in Java (2)`. Left alone the
 * fragment opens a group called "245 Programming in Java" and the course is
 * lost. Only a line beginning with a bare course number is joined, and only to
 * a line ending in a bare prefix, so ordinary prose is untouched.
 */
function rejoinWrapped(lines) {
  const out = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev && /(?:^|\s)[A-Z]{2,5}$/.test(prev) && /^\d{3,4}[A-Z]?\b/.test(line)) {
      out[out.length - 1] = `${prev} ${line}`;
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * Split one printed line into the courses it names.
 *
 * Per-gap connectors, not a single verdict for the line: `CSC 205: Computer
 * Organization or MTH 265 Calculus III` is a choice, `MTH 161 /MTH 162` is a
 * sequence, and a line can carry both. The connector text sitting between two
 * codes is the only evidence of which, so it is read where it sits.
 */
function parseRow(rawLine) {
  let text = clean(rawLine);

  // PDF catalogs print the credit figure in a right-hand column, which flattens
  // onto the end of the line. Take it off before reading titles, or every title
  // ends in a stray number.
  let rowCredits = null;
  // `… Credits: 3` — the figure is labelled and can sit mid-line, ahead of an
  // `Or` alternative. Take it out wherever it is, so it neither survives into a
  // course title nor gets mistaken for a course number.
  const labelled = LABELLED_CREDITS.exec(text);
  if (labelled) {
    rowCredits = parseCredits(labelled[1]);
    text = `${text.slice(0, labelled.index)} ${text.slice(labelled.index + labelled[0].length)}`.replace(/\s+/g, ' ').trim();
  }
  if (!rowCredits) {
    const trailing = /\s(\d+(?:[-–]\d+)?)$/.exec(text);
    if (trailing) {
      rowCredits = parseCredits(trailing[1]);
      if (rowCredits) text = text.slice(0, trailing.index).trim();
    }
  }

  const marks = [];
  for (const m of text.matchAll(/([A-Z]{2,5})\s?[-–—]?\s?(\d{3,4}[A-Z]?)(?![\dA-Za-z])/g)) {
    const code = normCode(`${m[1]}${m[2]}`);
    if (/^(HELP|BOX|FF|ROOM|SUITE|PHONE|FAX|ISBN|USC|VA|PO|GPA|FAQ|HTTP|HTTPS|WWW)\d/.test(code)) continue;
    marks.push({ code, start: m.index, end: m.index + m[0].length });
  }
  if (!marks.length) return { codes: [], conjunction: 'and', text, category: text, credits: rowCredits };

  const courses = marks.map((mark, i) => {
    const next = marks[i + 1];
    let title = text.slice(mark.end, next ? next.start : text.length);
    title = title.replace(/^\s*[:\-–—]\s*/, '');
    // Trim the connector that belongs to the *next* course, not this title.
    title = title.replace(/\s*(?:\bor\b|\band\b|\/|,|;)\s*$/i, '');
    title = title.replace(/\s*\(\s*\d+(?:[-–]\d+)?\s*(?:cr|credits?|credit\s*hours?)?\s*\)\s*$/i, '');
    return { code: mark.code, title: clean(title) || null };
  });

  const gaps = marks.slice(0, -1).map((mark, i) => text.slice(mark.end, marks[i + 1].start));
  let conjunction = 'and';
  if (courses.length > 1) {
    if (gaps.some((g) => /\bor\b/i.test(g))) conjunction = 'or';
    else if (gaps.every((g) => /^\s*\/\s*$/.test(g))) {
      // A bare slash is ambiguous in these catalogs and the prefixes settle it:
      // `MTH 161/MTH 162` is the precalculus sequence (take both), while
      // `CSC 208/MTH 288` is the same either-or the other pages spell out.
      const prefixes = new Set(courses.map((c) => /^[A-Z]+/.exec(c.code)[0]));
      conjunction = prefixes.size > 1 ? 'or' : 'and';
    }
  }

  // `HIS 121 or HIS 122   United States History to 1877 or United States History
  // Since 1865` — the titles trail all the codes in a single column, so the
  // per-code split leaves every title but the last empty. Re-split when the
  // separator count matches the course count exactly.
  const last = courses[courses.length - 1];
  if (courses.length > 1 && last.title && courses.slice(0, -1).every((c) => !c.title)) {
    const parts = last.title.split(/\s+or\s+|\s*\/\s*/i).map((s) => clean(s)).filter(Boolean);
    if (parts.length === courses.length) courses.forEach((c, i) => { c.title = parts[i]; });
  }

  const inline = creditsFromHeading(text);
  return {
    codes: courses,
    conjunction,
    text,
    credits: rowCredits || (inline ? inline.credits : null),
    administrative: ADMINISTRATIVE.test(text),
  };
}

const newGroup = (title, credits, source) => ({
  title,
  credits: credits || null,
  // Advisement that scopes the whole group rather than one of its sections:
  // "choose any two courses (6cr) ... from two different categories" binds
  // across Art / Humanities / Literature, not within any one of them.
  choose: null,
  choose_credits: null,
  distinct_sections: null,
  note: null,
  source_text: [source],
  sections: [{ label: null, choose: null, credits: null, rows: [] }],
});

const lastSection = (group) => group.sections[group.sections.length - 1];

/**
 * Parse a captured page's text into the neutral requirement tree.
 *
 * `program_title` is taken from the caller when the capture index knows it;
 * the parser will not guess a title out of page furniture.
 */
function parseTextProgram(rawText, { programTitle = null } = {}) {
  const lines = rejoinWrapped(String(rawText || '').split('\n').map(clean));

  // Does this page print `Credits: N` on its requirement rows?
  //
  // It changes what a credit figure means. On Germanna a credit figure marks a
  // heading; at Central Virginia every single row ends in one, so reading a
  // figure as a heading would promote each course to its own group and reduce
  // the degree to noise. Settled once per document from the rows that also
  // carry a course code, rather than guessed line by line.
  const inlineCreditRows = lines.filter((l) => LABELLED_CREDITS.test(l) && hasCode(l)).length >= 3;

  const groups = [];
  let total = null;
  let stoppedAt = null;
  const narrative = [];
  const unassigned = [];

  let current = null;
  let started = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || CHROME.test(line)) continue;

    if (PLAN_OF_STUDY.test(line) && started) { stoppedAt = line; break; }

    // Term subtotals are tested first, because they are the narrower pattern:
    // `Semester Total Credits 17` also satisfies the degree-total pattern, and
    // whichever runs first wins the line. A term's figure belongs to its group.
    const groupTotal = GROUP_TOTAL.exec(line);
    if (groupTotal && current) {
      if (!current.credits) current.credits = parseCredits(groupTotal[1]);
      current.source_text.push(line);
      continue;
    }

    const totalMatch = TOTAL_LINE.exec(line);
    if (totalMatch) {
      const parsed = parseCredits(totalMatch[1] || totalMatch[2] || totalMatch[3]);
      // A degree total states a qualifier — `Total Minimum Credits: 60-63`,
      // `Program Total: 60-64`. The largest figure wins so that a subtotal that
      // slipped through cannot be mistaken for the whole degree.
      if (parsed && (total == null || parsed.min > total.min)) total = parsed;
      if (!hasCode(line)) continue;
    }

    const heading = creditsFromHeading(line);
    const codes = codesIn(line);
    const isInstruction = INSTRUCTION.test(line);

    // A heading carries a credit figure and no course code of its own — unless
    // this page states credits on every row, in which case the figure says
    // nothing about whether the line is a heading.
    const headingByCredits = heading
      && !(inlineCreditRows && LABELLED_CREDITS.test(line))
      && !PLACEHOLDER_ROW.test(line);
    // 80 characters is generous for a real heading ("Transfer Electives
    // (Prerequisites if needed) (7-10)" is 50) and short enough to exclude the
    // wrapped prose that describes a degree in passing — "…database
    // technologies; 12 SH of mathematics…" carries a credit figure and would
    // otherwise open a group named after half a sentence.
    if (headingByCredits && !codes.length && !isInstruction && line.length <= 80) {
      current = newGroup(headingTitle(line) || 'Requirements', heading.credits, line);
      groups.push(current);
      started = true;
      continue;
    }

    // A heading without a figure: only when it reads like one and a course
    // follows it, so ordinary prose does not open an empty group.
    if (!codes.length && !isInstruction && !NARRATIVE.test(line) && HEADING_SHAPE.test(line) && line.length <= 90) {
      const soon = lines.slice(i + 1, i + 5).some((l) => hasCode(l));
      if (soon) {
        current = newGroup(headingTitle(line) || line, null, line);
        groups.push(current);
        started = true;
        continue;
      }
    }

    if (!started) {
      if (NARRATIVE.test(line)) narrative.push(line);
      if (!codes.length) continue;
      // Courses named before any heading. Kept for pages that print a bare
      // list with no headings at all, but marked implicit and dropped below if
      // the page turns out to have real headings — before them, a course code
      // is prose ("placement into MTH 263 or completion of MTH 167"), not a
      // requirement.
      current = newGroup('Requirements', null, line);
      current.implicit = true;
      groups.push(current);
      started = true;
    }

    if (isInstruction) {
      const parsed = parseInstruction(line) || {};
      const section = lastSection(current);
      const opensTheGroup = !section.rows.length && current.sections.length === 1;
      if (opensTheGroup) {
        // Stated before any course: it governs everything under the heading,
        // including sub-headings that have not appeared yet. Filing it on the
        // first section would bind it to whichever category happens to be
        // printed first and leave the rest unadvised.
        if (parsed.courses != null) current.choose = parsed.courses;
        if (parsed.credits) current.choose_credits = parsed.credits;
        if (parsed.distinct_sections != null) current.distinct_sections = parsed.distinct_sections;
      } else {
        // An instruction after rows opens the next section rather than
        // retroactively re-scoping the rows already collected.
        const target = { label: null, choose: null, credits: null, rows: [] };
        current.sections.push(target);
        if (parsed.courses != null) target.choose = parsed.courses;
        if (parsed.credits) target.credits = parsed.credits;
      }
      current.note = current.note ? `${current.note} ${line}` : line;
      current.source_text.push(line);
      continue;
    }

    if (codes.length) {
      lastSection(current).rows.push(parseRow(line));
      current.source_text.push(line);
      continue;
    }

    // A credit-bearing line with no course names a requirement, not a section:
    // `UCGS Block III: Social and Behavioral Sciences: Credits: 3` is three
    // credits a student must earn, and filing it as a label would quietly drop
    // it from the degree.
    if (heading && !codes.length) {
      lastSection(current).rows.push({
        codes: [], conjunction: 'and', text: line, category: headingTitle(line) || line, credits: heading.credits,
      });
      current.source_text.push(line);
      continue;
    }

    // No code, no figure, short: a sub-heading inside the current group.
    if (line.length <= 60 && !NARRATIVE.test(line)) {
      const section = lastSection(current);
      if (section.rows.length) current.sections.push({ label: line, choose: null, credits: null, rows: [] });
      else section.label = line;
      current.source_text.push(line);
      continue;
    }

    // Longer prose inside a group: an unenumerated requirement when it asks for
    // coursework, otherwise a note on the group.
    if (/\belective|\bcourse|\bcredits?\b/i.test(line) && line.length <= 200) {
      lastSection(current).rows.push({ codes: [], conjunction: 'and', text: line, category: line });
      current.source_text.push(line);
    } else {
      current.note = current.note ? `${current.note} ${line}` : line;
      unassigned.push(line);
    }
  }

  for (const g of groups) g.sections = g.sections.filter((s) => s.rows.length || s.choose != null || s.credits);

  const explicit = groups.filter((g) => !g.implicit);
  const kept = explicit.length ? explicit : groups;

  return {
    program_title: programTitle,
    total_credits: total,
    groups: kept.filter((g) => g.sections.length),
    stopped_at: stoppedAt,
    narrative,
    unassigned,
  };
}

module.exports = { parseTextProgram, parseRow, CHROME, HEADING_SHAPE, NARRATIVE };
