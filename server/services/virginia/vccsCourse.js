/**
 * Parser and cached client for the VCCS Master Course File.
 *
 * The statewide page is the authority for common-course prerequisites.  A
 * college may add local rules, so the output deliberately calls these
 * `master` requisites and keeps the source sentence verbatim.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const BASE = 'https://courses.vccs.edu';
const USER_AGENT = 'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

const clean = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/[\t\r\n]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeCode = (value) => clean(value).replace(/[\s-]+/g, '').toUpperCase();
const displayCode = (value) => {
  const code = normalizeCode(value);
  const match = /^([A-Z]{2,5})(\d{2,4}[A-Z]?)$/.exec(code);
  return match ? `${match[1]} ${match[2]}` : code;
};

const COURSE_RE = /\b([A-Z]{2,5})\s*(\d{2,4}[A-Z]?)\b/g;
const GRADE_RE = /(?:minimum\s+)?grade\s+of\s+([ABCDF][+-]?)\s+or\s+(?:better|higher)/i;

function courseRefs(text) {
  const refs = [];
  const seen = new Set();
  let match;
  COURSE_RE.lastIndex = 0;
  while ((match = COURSE_RE.exec(clean(text))) !== null) {
    const code = `${match[1]}${match[2]}`.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    refs.push({ code, index: match.index, raw: match[0] });
  }
  return refs;
}

function conditionType(text) {
  const raw = clean(text);
  if (/\b(place(?:ment|d)|direct placement|placement test|assessment)\b/i.test(raw)) return 'placement';
  if (/\b(consent|permission|approval)\b/i.test(raw)) return 'consent';
  if (/\b(admission|accepted|enrollment)\b.*\b(program|plan|curriculum)\b/i.test(raw)) return 'program_admission';
  if (/\blicensed|certification|credential|experience\b/i.test(raw)) return 'credential_or_experience';
  if (/\bequivalent\b/i.test(raw)) return 'equivalent';
  return 'other';
}

function nonCourseCondition(text) {
  const raw = clean(text).replace(/^[,;:.\s]+|[,;:.\s]+$/g, '');
  if (!raw) return null;
  return { type: 'non_course', condition: conditionType(raw), raw };
}

/**
 * Replace grammar-internal "or" tokens before splitting alternatives.
 * "or better" belongs to a grade and "or equivalent" qualifies the course
 * immediately before it; neither creates a separate path.
 */
function protectInternalOr(text) {
  return clean(text)
    .replace(/\bor\s+(?:better|higher)\b/gi, '__OR_GRADE__')
    .replace(/\bor\s+(?:an\s+)?equivalent\b/gi, '__OR_EQUIVALENT__')
    .replace(/\band\s*\/\s*or\b/gi, '__AND_OR__');
}

function restoreInternalOr(text) {
  return clean(text)
    .replace(/__OR_GRADE__/g, 'or better')
    .replace(/__OR_EQUIVALENT__/g, 'or equivalent')
    .replace(/__AND_OR__/g, 'and/or');
}

function splitAlternatives(raw) {
  const protectedText = protectInternalOr(raw);
  const parts = [];
  let depth = 0;
  let start = 0;
  const re = /[()]|\bor\b|;/gi;
  let match;
  while ((match = re.exec(protectedText)) !== null) {
    if (match[0] === '(') { depth += 1; continue; }
    if (match[0] === ')') { depth = Math.max(0, depth - 1); continue; }
    // Semicolons separate alternatives in the catalog often enough to treat
    // them like OR only when the clause also contains an explicit OR.  With no
    // OR they remain inside one path and are split as AND below.
    if (depth === 0 && (/^or$/i.test(match[0]) || (/;/.test(match[0]) && /\bor\b/i.test(protectedText)))) {
      parts.push(restoreInternalOr(protectedText.slice(start, match.index)));
      start = re.lastIndex;
    }
  }
  parts.push(restoreInternalOr(protectedText.slice(start)));
  return parts.map(clean).filter(Boolean);
}

function expandSlashCodes(text) {
  // VCCS uses `MTH 161/162` for the two-course sequence.  It must never be
  // flattened to an OR.  Expand it before ordinary code extraction.
  return clean(text).replace(
    /\b([A-Z]{2,5})\s*(\d{2,4}[A-Z]?)\s*\/\s*(\d{2,4}[A-Z]?)\b/g,
    (_, prefix, first, second) => `${prefix} ${first} and ${prefix} ${second}`
  );
}

function expandCarriedPrefixCodes(text) {
  let expanded = clean(text);
  // Catalog shorthand carries the subject across a bare second number:
  // `CSC 201 and 202` means two courses, not course 201 plus opaque text.
  const re = /\b([A-Z]{2,5})\s*(\d{2,4}[A-Z]?)(\s*(?:,|and|or)\s+)(\d{2,4}[A-Z]?)\b/gi;
  for (;;) {
    const next = expanded.replace(re, (_, prefix, first, joiner, second) => (
      `${prefix} ${first}${joiner}${prefix} ${second}`
    ));
    if (next === expanded) return expanded;
    expanded = next;
  }
}

function expandParentheticalAlternatives(text) {
  let source = clean(text);
  // `BIO 142 (or BIO 232)` is the catalog's compact form for a parenthetical
  // alternative, not BIO 142 plus a separate condition.
  source = source.replace(
    /\b([A-Z]{2,5})\s*(\d{2,4}[A-Z]?)\s*\(\s*or\s+([A-Z]{2,5})\s*(\d{2,4}[A-Z]?)\s*\)/gi,
    '($1 $2 or $3 $4)'
  );

  let variants = [source];
  for (;;) {
    let changed = false;
    const next = [];
    for (const variant of variants) {
      const match = /\(([^()]*)\)/.exec(variant);
      if (!match || !/\bor\b/i.test(match[1]) || courseRefs(match[1]).length < 2) {
        next.push(variant);
        continue;
      }
      const alternatives = splitAlternatives(match[1]);
      if (alternatives.length < 2) { next.push(variant); continue; }
      changed = true;
      for (const alternative of alternatives) {
        next.push(clean(`${variant.slice(0, match.index)} ${alternative} ${variant.slice(match.index + match[0].length)}`));
      }
    }
    variants = next;
    if (!changed) return variants;
  }
}

const prefixOf = (code) => (/^[A-Z]+/.exec(code || '') || [null])[0];

function distributeSharedConjunction(parts) {
  if (parts.length < 2) return parts;
  const first = parts[0];
  let shared = null;
  let firstBranch = null;
  const either = /^(.*?)\band\s+either\s+(.*)$/i.exec(first);
  if (either && courseRefs(either[1]).length && courseRefs(either[2]).length) {
    [, shared, firstBranch] = either;
  } else {
    const andMatches = [...first.matchAll(/\band\b/gi)];
    const lastAnd = andMatches.at(-1);
    if (lastAnd) {
      const possibleShared = clean(first.slice(0, lastAnd.index));
      const possibleBranch = clean(first.slice(lastAnd.index + lastAnd[0].length));
      const sharedRefs = courseRefs(possibleShared);
      const branchRefs = courseRefs(possibleBranch);
      const laterRefs = parts.slice(1).flatMap(courseRefs);
      // `PHY 201 and MTH 162 or MTH 167` means PHY 201 is shared across
      // the two MTH alternatives.  Same-prefix `CSC 201 and 202, or EGR 125`
      // remains a compound first path rather than distributing CSC 201.
      if (sharedRefs.length && branchRefs.length && laterRefs.length
        && prefixOf(sharedRefs.at(-1).code) !== prefixOf(branchRefs[0].code)
        && laterRefs.every((ref) => prefixOf(ref.code) === prefixOf(branchRefs[0].code))) {
        shared = possibleShared;
        firstBranch = possibleBranch;
      }
    }
  }
  if (!shared) return parts;
  return [firstBranch, ...parts.slice(1)].map((branch) => clean(`${shared} and ${branch}`));
}

function logicalPathTexts(raw) {
  let normalized = expandCarriedPrefixCodes(expandSlashCodes(raw.replace(/&/g, ' and ')));
  // An Oxford-comma list ending in OR is a list of alternatives.  Comma lists
  // ending in AND remain one compound path.
  if (/,[^;]*\bor\b/i.test(normalized) && !/\band\b/i.test(normalized)) {
    normalized = normalized.replace(/,/g, ' or ');
  }
  const parentheticalVariants = expandParentheticalAlternatives(normalized);
  return parentheticalVariants.flatMap((variant) => (
    distributeSharedConjunction(splitAlternatives(variant))
  )).map(clean).filter(Boolean);
}

function pathFromText(part, { inheritedGrade = null } = {}) {
  const expandedRaw = expandCarriedPrefixCodes(expandSlashCodes(part)).replace(/^\(+|\)+$/g, '');
  // Keep linked course titles in `raw`, but remove them from the formula.  In
  // the source they appear as `MTH 264: Calculus II or equivalent`.
  const expanded = expandedRaw.replace(
    /\b([A-Z]{2,5}\s*\d{2,4}[A-Z]?)\s*:\s*[^,;]*?(?=\s+or\s+(?:an\s+)?equivalent\b|\s+with\s+(?:a\s+)?grade\b|$)/gi,
    '$1 '
  );
  const refs = courseRefs(expanded);
  const localGrade = (GRADE_RE.exec(expanded) || [])[1] || inheritedGrade;
  const equivalentAllowed = /\bor\s+(?:an\s+)?equivalent\b/i.test(expanded)
    || /\bequivalent\s+(?:course|credit)\b/i.test(expanded);
  const allOf = refs.map((ref, index) => {
    const next = refs[index + 1];
    const tail = expanded.slice(ref.index, next ? next.index : expanded.length);
    if (/\beligib(?:le|ility)\b/i.test(tail)) {
      return {
        type: 'non_course',
        condition: 'course_eligibility',
        course_key: `va:${ref.code}`,
        course_ref: `va:crs:${ref.code}`,
        code: ref.code,
        raw: clean(tail),
      };
    }
    const grade = (GRADE_RE.exec(tail) || [])[1] || localGrade || null;
    return {
      type: 'course',
      // Virginia requirements already join on `va:CODE`.  `va:crs:CODE` is
      // the Mongo document identity and is carried separately as course_ref.
      course_key: `va:${ref.code}`,
      course_ref: `va:crs:${ref.code}`,
      code: ref.code,
      ...(grade ? { minimum_grade: grade.toUpperCase() } : {}),
      ...(equivalentAllowed ? { equivalent_allowed: true } : {}),
    };
  });

  let residue = expanded;
  residue = residue.replace(COURSE_RE, ' ')
    .replace(new RegExp(GRADE_RE.source, 'gi'), ' ')
    .replace(/\b(?:completion of|successful completion of|satisfactory completion of|prerequisites?|corequisites?)\b/gi, ' ')
    .replace(/\b(?:and|with|a|an|the|course|courses|or equivalent|equivalent|eligible|eligibility)\b/gi, ' ')
    .replace(/[(),.:]/g, ' ');
  residue = clean(residue);

  // Consent, placement, admission, and other non-course paths are first-class
  // conditions.  Boilerplate alone is not emitted as an opaque condition.
  let residualText = null;
  if (residue && !/^(?:of|in|to|for|better|minimum)$/i.test(residue)) {
    const condition = nonCourseCondition(residue);
    if (condition?.condition !== 'other' || !refs.length) allOf.push(condition);
    else residualText = residue;
  }
  if (!allOf.length) {
    const condition = nonCourseCondition(expanded);
    if (condition) allOf.push(condition);
  }

  return {
    raw: clean(part),
    all_of: allOf,
    ...(residualText ? { residual_text: residualText } : {}),
  };
}

/**
 * Parse one prerequisite/corequisite sentence into disjunctive normal form:
 * `paths` are OR; the conditions in each `all_of` are AND.  This represents
 * `(CSC 201 AND CSC 202) OR EGR 125 OR permission` without information loss.
 */
function parseRequisiteClause(kind, raw) {
  const text = clean(raw).replace(/[.;\s]+$/g, '');
  const grades = [...text.matchAll(new RegExp(GRADE_RE.source, 'gi'))].map((m) => m[1].toUpperCase());
  const inheritedGrade = grades.length === 1 ? grades[0] : null;
  const parts = logicalPathTexts(text);
  const paths = parts.map((part) => pathFromText(part, { inheritedGrade })).filter((p) => p.all_of.length);
  if ((text.match(/\bor\s+(?:an\s+)?equivalent\b/gi) || []).length === 1) {
    for (const path of paths) {
      for (const condition of path.all_of) {
        if (condition.type === 'course') condition.equivalent_allowed = true;
      }
    }
  }
  const flags = [];
  if (/\band\s*\/\s*or\b/i.test(text)) flags.push('and_or_language');
  if (/;/.test(text)) flags.push('unsupported_semicolon_grammar');
  if (paths.some((path) => /[()]/.test(path.raw) && /\bor\b/i.test(path.raw))) {
    flags.push('unsupported_boolean_grammar');
  }
  if (paths.some((p) => p.all_of.length > 1)) flags.push('compound_path');
  if (paths.some((p) => p.all_of.some((c) => c.type === 'non_course'))) flags.push('non_course_condition');
  if (paths.some((p) => p.residual_text)) flags.push('unparsed_residue');
  if (!paths.length) flags.push('unparsed_clause');

  const singletonCourses = paths.map((path) => (
    path.all_of.length === 1 && path.all_of[0].type === 'course' ? path.all_of[0] : null
  ));

  return {
    kind,
    raw: text,
    formula: 'paths_or__conditions_and',
    paths,
    ...(singletonCourses.every(Boolean) ? { any_of: singletonCourses } : {}),
    flags,
  };
}

function extractRequisiteClauses(text) {
  const source = clean(text);
  const labels = [...source.matchAll(/\b(Prerequisites?|Corequisites?)\s*:\s*/gi)];
  return labels.map((match, index) => {
    const start = match.index + match[0].length;
    const end = labels[index + 1]?.index ?? source.length;
    return {
      kind: /^pre/i.test(match[1]) ? 'prerequisite' : 'corequisite',
      raw: clean(source.slice(start, end)),
    };
  }).filter((clause) => clause.raw);
}

function headingParts(text) {
  const heading = clean(text);
  const match = /^(.*?)\s+-\s+(.*)$/.exec(heading);
  if (!match) return { code: null, title: heading || null };
  return { code: normalizeCode(match[1]), title: clean(match[2]) || null };
}

/** Parse a statewide `/courses/<CODE>` page. */
function parseVccsCoursePage(html, { requestedCode = null, url = null } = {}) {
  const $ = cheerio.load(html || '');
  const wanted = normalizeCode(requestedCode);
  const entries = [];

  $('dl > dt').each((_, dt) => {
    const $dt = $(dt);
    const { code, title } = headingParts($dt.text());
    if (!code) return;
    const $dd = $dt.next('dd');
    if (!$dd.length) return;
    const description = clean($dd.find('.coursedesc').first().text()) || null;
    const rawCourseEndtext = clean($dd.find('.endtext').first().text()) || null;
    const creditText = clean($dd.find('.credits').first().text());
    const creditMatch = /(\d+(?:\.\d+)?)\s+credits?/i.exec(creditText);
    const effectiveMatch = /<!--\s*(\d{4}-\d{2}-\d{2})\s*-->/.exec($dd.html() || '');
    entries.push({
      code,
      title,
      description,
      raw_course_endtext: rawCourseEndtext,
      credits: creditMatch ? Number(creditMatch[1]) : null,
      effective: effectiveMatch?.[1] || null,
    });
  });

  const entry = entries.find((candidate) => !wanted || candidate.code === wanted) || null;
  if (!entry) {
    return {
      code: wanted || null,
      found: false,
      status: 'missing',
      source_url: url,
      groups: [],
      flags: ['no_exact_master_course'],
    };
  }

  const clauses = extractRequisiteClauses(entry.raw_course_endtext);
  const groups = clauses
    .map((clause) => parseRequisiteClause(clause.kind, clause.raw));
  const flags = [...new Set(groups.flatMap((group) => group.flags))];
  const unsafeFlags = new Set([
    'unparsed_clause',
    'unparsed_residue',
    'and_or_language',
    'unsupported_boolean_grammar',
    'unsupported_semicolon_grammar',
  ]);
  const status = groups.length
    ? (groups.some((group) => group.flags.some((flag) => unsafeFlags.has(flag))) ? 'unparsed' : 'parsed')
    : 'none';

  const supply = [];
  $('#offeredByDiv a[href*="/colleges/"][href*="/courses/"]').each((_, anchor) => {
    const href = $(anchor).attr('href') || '';
    const match = /^\/colleges\/([^/]+)\/courses\//.exec(href);
    if (!match) return;
    const name = clean($(anchor).text());
    if (!name || supply.some((row) => row.slug === match[1])) return;
    supply.push({
      slug: match[1],
      name,
      scheduled: $(anchor).hasClass('scheduled'),
      url: new URL(href, BASE).href,
    });
  });

  return {
    ...entry,
    raw_requisites: clauses.length
      ? clauses.map((clause) => `${clause.kind === 'prerequisite' ? 'Prerequisite' : 'Corequisite'}: ${clause.raw}`).join(' ')
      : null,
    found: true,
    status,
    source_url: url,
    groups,
    supply: supply.sort((a, b) => a.slug.localeCompare(b.slug)),
    flags,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class VccsCourseClient {
  constructor({ cacheDir, delayMs = 100, concurrency = 4, refresh = false } = {}) {
    Object.assign(this, {
      cacheDir,
      delayMs: Math.max(0, Number(delayMs) || 0),
      concurrency: Math.max(1, Number(concurrency) || 1),
      refresh,
    });
    this.stats = { hits: 0, misses: 0, errors: 0 };
    this._nextRequestAt = 0;
    this._gate = Promise.resolve();
    if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });
  }

  urlFor(code) {
    return `${BASE}/courses/${normalizeCode(code)}`;
  }

  cachePath(url) {
    if (!this.cacheDir) return null;
    return path.join(this.cacheDir, `${createHash('sha1').update(url).digest('hex')}.html`);
  }

  async throttle() {
    const prior = this._gate;
    let release;
    this._gate = new Promise((resolve) => { release = resolve; });
    await prior;
    const waitMs = Math.max(0, this._nextRequestAt - Date.now());
    if (waitMs) await sleep(waitMs);
    this._nextRequestAt = Date.now() + this.delayMs;
    release();
  }

  async getUrl(url, { requestedCode = null } = {}) {
    const cachePath = this.cachePath(url);
    let html = null;
    if (!this.refresh && cachePath && fs.existsSync(cachePath)) {
      html = fs.readFileSync(cachePath, 'utf8');
      this.stats.hits += 1;
    } else {
      await this.throttle();
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        html = await response.text();
        this.stats.misses += 1;
        if (cachePath) fs.writeFileSync(cachePath, html);
      } catch (error) {
        this.stats.errors += 1;
        return {
          code: normalizeCode(requestedCode),
          found: false,
          status: 'missing',
          source_url: url,
          groups: [],
          flags: ['fetch_failed'],
          fetch_error: error.message,
        };
      }
    }
    return parseVccsCoursePage(html, { requestedCode, url });
  }

  async getCourse(code) {
    return this.getUrl(this.urlFor(code), { requestedCode: code });
  }

  async mapLimit(items, worker) {
    const output = new Array(items.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(this.concurrency, items.length) }, async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        output[index] = await worker(items[index], index);
      }
    }));
    return output;
  }
}

module.exports = {
  BASE,
  VccsCourseClient,
  clean,
  normalizeCode,
  displayCode,
  courseRefs,
  extractRequisiteClauses,
  parseRequisiteClause,
  parseVccsCoursePage,
};
