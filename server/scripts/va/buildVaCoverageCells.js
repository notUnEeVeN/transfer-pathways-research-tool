#!/usr/bin/env node
/**
 * Virginia Figure 1 cells — one coverage value per community college ×
 * university program, which is the grain the coverage heatmap already uses for
 * California and Massachusetts.
 *
 * A guide supplies the requirements and stated credit totals; each VCCS
 * catalogue supplies the college-specific course set. Figure 1 measures guide
 * preparation availability: stated pre-transfer credit less unavailable rows,
 * divided by the stated pre- and post-transfer credit total. It is a supply
 * estimate, not the canonical degree evaluator's proof of credit application.
 *
 * Figures 3/4 retain the guide's stated pre-transfer credit as earned credit,
 * then remove explicit no-credit rows and model unavailable rows as substituted
 * credit that does no bachelor requirement work. Those two loss reasons are
 * disjoint. Ordinary elective landings are retained as applied credit.
 *
 * Catalogue and currently scheduled supply are both emitted, with and without
 * colleges that lack a CS associate degree. Credit ranges use their upper
 * bounds. Course totals are rounded credit-derived estimates. Source conditions
 * that this join cannot prove travel with the cells as interpretation warnings;
 * see docs/virginia-final-audit.md for the limits of these measures.
 *
 *   node scripts/va/buildVaCoverageCells.js            # report both
 *   node scripts/va/buildVaCoverageCells.js --write    # write both
 */
const fs = require('node:fs');
const path = require('node:path');
const { outcome, credits, maxCredits } = require('./buildGuideFigures');
const { typeOfCourseCode } = require('../../services/courseTypes');

const SERVER = path.resolve(__dirname, '..', '..');
const GUIDES = path.join(SERVER, '.va-guides', 'guides.json');
const CATALOG = path.join(SERVER, '.va-courses', 'catalog');
const OUT = path.join(SERVER, '.va-courses', 'va-coverage-cells.json');

/**
 * Computer-science degrees only.
 *
 * The portal's computing discipline filter also returns information technology,
 * cybersecurity, data science and business analytics. Those are different
 * majors with different lower-division preparation, and pooling them reports a
 * blend rather than a comparison. A concentration WITHIN a computer-science
 * degree stays — Radford's four and VCU's three are the same major differing
 * after transfer. George Mason's Secondary Education BSEd is excluded despite
 * naming computer science: it is an education degree.
 */
const IS_COMPUTER_SCIENCE = (title) => /computer science/i.test(title)
  && !/secondary education/i.test(title);

/**
 * One program per university.
 *
 * Radford publishes four concentrations and VCU four, all of the same degree
 * and all with near-identical community-college halves — they diverge after
 * transfer. Carrying them as separate columns made a university's weight in the
 * figure depend on how finely it subdivides its own major, so Radford counted
 * five times and Bridgewater once. The base program stands for the degree;
 * where there is no base, the shortest title is the least qualified one.
 */
/** "VCU Computer Science BS Concentration in Data Science" -> "VCU". */
const universityOf = (guide) =>
  guide.title.split(/\s+Computer\s+(?:Science|Foundations)/i)[0].trim();

function oneProgramPerUniversity(guides) {
  const byUniversity = new Map();
  for (const guide of guides) {
    const university = universityOf(guide);
    const current = byUniversity.get(university);
    if (!current || guide.title.length < current.title.length) {
      byUniversity.set(university, guide);
    }
  }
  return [...byUniversity.values()];
}
// Guides write some subject prefixes longer than VCCS does. Verified against
// the catalogues: MATH263 appears in 0 of 16 colleges, MTH263 in all 16.
const PREFIX_ALIASES = new Map([['ENGR', 'EGR'], ['HIST', 'HIS'], ['MATH', 'MTH']]);

const resolveCode = (code, universe) => {
  if (universe.has(code)) return code;
  const parts = /^([A-Z]+)(\d.*)$/.exec(code);
  const alias = parts && PREFIX_ALIASES.get(parts[1]);
  const candidate = alias ? `${alias}${parts[2]}` : null;
  return candidate && universe.has(candidate) ? candidate : code;
};

/**
 * @param scheduledOnly  supply is what the college currently runs, not what it lists
 * @param includeNonCs   include the seven VCCS colleges with no CS associate degree
 *
 * A college without the credential can still teach the courses a guide names,
 * and whether it does is worth being able to see. It is off by default because
 * the pathway those colleges would be on does not formally exist.
 */
function loadColleges(scheduledOnly, includeNonCs = false) {
  return fs.readdirSync(CATALOG).filter((f) => f.endsWith('.json')).map((f) => {
    const doc = JSON.parse(fs.readFileSync(path.join(CATALOG, f), 'utf8'));
    const courses = scheduledOnly ? doc.courses.filter((c) => c.scheduled) : doc.courses;
    return {
      slug: doc.slug,
      name: doc.name,
      offersCs: doc.offers_cs !== false,
      codes: new Set(courses.map((c) => c.code)),
    };
  }).filter((c) => includeNonCs || c.offersCs)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parse a requirement cell's boolean structure.
 *
 * Guides write choices three ways and they do not mean the same thing:
 *
 *   "CST 100 or CST 110"              either satisfies
 *   "CSC 205 + CSC 215"               both are needed
 *   "MTH 161 and MTH 162 or MTH 167"  (161 AND 162) OR 167
 *
 * Flattening all of them to "any one of these codes" accepted a college that
 * teaches half of a required pair. Splitting on `or` first and on `and` within
 * each alternative reproduces the stated logic: the row is satisfied when any
 * one alternative is satisfied in full.
 *
 * The `&` in "Social & Behavioral Science" is a conjunction in prose, not in
 * the requirement, so only `+` and the word `and` join courses.
 */
/**
 * Estimate the number of courses represented by a credit quantity.
 *
 * The guide halves use different layouts: community-college work is usually
 * itemized, while the university half can collapse many courses into one row.
 * Both halves therefore use this credit conversion. These rounded estimates
 * are not literal course counts or a reproduction of the Massachusetts paper's
 * binary named-course measure. A zero-credit named requirement still occupies
 * one estimated slot; it is not erased merely because it carries no credits.
 */
function courseCount(units, rate) {
  const value = Number(units);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.max(1, Math.round(value / rate));
}

/**
 * The credits-per-course a guide itself exhibits.
 *
 * Converting at a flat three was the bug behind a ten-point drop: the guides'
 * own single courses average 3.22 credits, so a flat three cut the denominator
 * finer than the numerator and every cell sagged. Worse, the choice was a free
 * parameter — 3.00, 3.22 and 3.43 moved the statewide figure 38.2%, 39.9%,
 * 41.4% with no fact changing. Reading the rate off the rows that ARE single
 * courses removes the parameter: the guide tells us how big its courses are.
 */
function courseSize(guide) {
  const single = [...guide.cc_items, ...(guide.post_items || [])]
    .filter((i) => i.counts_toward_stats)
    .map((i) => credits(i.credits))
    .filter((u) => Number.isFinite(u) && u > 0 && u <= 5);
  if (!single.length) return 3;
  return single.reduce((a, b) => a + b, 0) / single.length;
}

function alternatives(text, codes) {
  if (codes.length < 2) return [codes];
  // Preserve the parser's sticky-prefix expansion inside the Boolean grammar.
  // Otherwise "MTH 161 and 162" becomes two independent alternatives because
  // the second code cannot be found by its full name in the original text.
  let prefix = null;
  const expanded = String(text).replace(
    /([A-Z]{2,4})\s*-?\s*(\d{3})\b|(?<![A-Z0-9])(\d{3})(?![0-9])/g,
    (match, namedPrefix, namedNumber, bareNumber) => {
      if (namedPrefix) prefix = namedPrefix;
      return prefix ? `${prefix} ${namedNumber || bareNumber}` : match;
    },
  );
  const appears = (code, part) => {
    const [, prefix, number] = /^([A-Z]+)(\d+)$/.exec(code) || [];
    return Boolean(prefix) && new RegExp(`${prefix}\\s*-?\\s*${number}\\b`, 'i').test(part);
  };
  const groups = [];
  const claimed = new Set();
  for (const part of expanded.split(/\s+or\s+/i)) {
    const inPart = codes.filter((code) => appears(code, part));
    if (!inPart.length) continue;
    // Only a conjunction binds courses together; anything else is a choice.
    if (/\band\b|\+/i.test(part) && inPart.length > 1) groups.push(inPart);
    else for (const code of inPart) groups.push([code]);
    for (const code of inPart) claimed.add(code);
  }
  // A comma list drops the prefix after the first entry — "HIST 101, 102, 111,
  // or 112" — so those codes match no part by name even though the sticky-
  // prefix expansion recovered them. They are alternatives, not conjunctions:
  // without this the four-way choice collapsed to HIST101 alone and three
  // colleges read as unable to satisfy a requirement they can.
  for (const code of codes) if (!claimed.has(code)) groups.push([code]);
  return groups.length ? groups : codes.map((code) => [code]);
}

/**
 * Can this college satisfy this requirement?
 *
 *   assumed    the row names no specific course — an elective slot, a UCGS
 *              general-education category, or prose. Every VCCS college teaches
 *              the general-education blocks and can fill an elective slot, so
 *              these are satisfiable by construction. Counted separately, never
 *              folded silently into the supplied total.
 *   supplied   the row names courses and this college teaches enough of them
 *   missing    the row names courses and this college does not
 */
function classify(item, college, universe) {
  if (!item.cc_codes.length || item.kind === 'gened_category') return 'assumed';
  // A named-course alternative does not erase an unrestricted UCGS branch.
  // NSU explicitly allows "Any UCGS course or PED 101 and HLT 110"; testing
  // only the two named courses falsely charged colleges three missing credits.
  const openUcgsAlternative = String(item.requirement_text).split(/\s+or\s+/i)
    .some((part) => /^\s*any\s+ucgs\b/i.test(part)
      && !/\d{3}|[:;\u2013\u2014]/.test(part));
  if (openUcgsAlternative) return 'assumed';
  const groups = alternatives(item.requirement_text, item.cc_codes);
  const ok = groups.some((group) => group.every((code) => college.codes.has(resolveCode(code, universe))));
  return ok ? 'supplied' : 'missing';
}

// Older captures misclassified Radford's inline post-transfer total as a
// named requirement. Keep structural totals out even before a source recapture.
const countedRequirement = (item) => item.counts_toward_stats
  && !/^\s*(?:credits?\s+(?:pre|post)[- ]transfer|(?:pre|post)[- ]transfer\s+credits?)\b/i
    .test(item.requirement_text || '');

/**
 * The lower-division lens, read from the bachelor's side as it is in
 * California and Massachusetts: the bachelor's lower-division credit, elective
 * credit included, general education separable. Catalogue supply only — the
 * other two states are measured on what a college publishes, not on what it
 * happens to be running.
 *
 * The pre-transfer half is the guide's own stated credit, the convention every
 * Virginia figure uses: its itemised rows overshoot it wherever a range is
 * read at its top. Every pre-transfer row is lower division — a VCCS course is
 * a 100- or 200-level course — and each is classified by what the UNIVERSITY
 * grants for it:
 *
 *   no_credit  the university grants nothing ("Does not transfer"), so the
 *              credit is not part of the bachelor's degree and comes off the
 *              stated half.
 *   elective   lands as general, free or unrestricted elective credit. Part of
 *              the bachelor's degree and filled by any transferable course, so
 *              covered whatever the college teaches — as is the elective credit
 *              the stated half holds beyond its itemised rows.
 *   ge         an open general-education category, or a named course with no
 *              STEM alternative that the guide does not mark as major work.
 *   major      everything else: a STEM row, or a row the guide maps to a
 *              major requirement.
 *
 * Post-transfer rows are the work a guide says must be done at the university.
 * Those whose every course number is below the 300 (or 3000) level are
 * lower-division requirements, uncovered unless the row's own note names a
 * VCCS course that satisfies it and the college teaches that course. Rows that
 * name no course number, mix divisions, carry no credit, or only repeat a
 * pre-transfer row ("if not completed at the community college", or a course
 * the pre-transfer half already maps onto) are not lower-division requirements
 * of their own.
 */
const ELECTIVE_EQUIVALENT = /\b(?:general|unrestricted|free)\s+elective\b|^\s*electives?(?:\s+credit)?\s*$|^\s*elective hours\b/i;
// The shared classifier knows university prefixes; VCCS writes chemistry,
// geology and environmental science differently, and CNU's computer
// engineering prefix is a CS major subject.
const VA_STEM_PREFIXES = new Set(['CHM', 'GOL', 'ENV', 'NAS', 'CPEN']);
// Post-transfer rows are the guide's own program list, so they are major work
// unless the guide labels them general education or they carry a
// general-education subject. A closed list, so nothing is GE by default.
const VA_GE_SUBJECTS = new Set(['COLL', 'COMM', 'STS', 'ENGL', 'WRIT', 'HIST', 'PHIL']);

const splitCode = (code) => /^([A-Z]+)\s*-?\s*(\d.*)$/.exec(code)?.slice(1) || [];
const isStemCode = (code) => {
  const [prefix, number] = splitCode(code);
  if (!prefix) return false;
  return VA_STEM_PREFIXES.has(prefix) || typeOfCourseCode(prefix, number) !== 'non_stem';
};

function classifyPreTransferRow(row) {
  const equivalent = String(row.equivalent || '');
  if (row.kind === 'filler' || row.kind === 'unresolved') return 'elective';
  if (outcome(equivalent) === 'no_credit') return 'no_credit';
  if (ELECTIVE_EQUIVALENT.test(equivalent)) return 'elective';
  if (row.kind === 'gened_category' || !row.cc_codes.length) return 'ge';
  if (/(?<!non-)\bmajor\b/i.test(equivalent)) return 'major';
  const stem = row.cc_codes.some(isStemCode) || universityCodes(equivalent).some(isStemCode);
  return stem ? 'major' : 'ge';
}

/** University course codes in a post-transfer row, prefixes carried forward. */
function universityCodes(text) {
  const codes = [];
  let prefix = null;
  const pattern = /\b([A-Z]{2,5})\s*-?\s*(\d{3,4})[A-Z]?\b|(?<![A-Za-z0-9-])(\d{3,4})(?![0-9])/g;
  for (const match of String(text || '').matchAll(pattern)) {
    if (match[1]) prefix = match[1];
    if (prefix) codes.push(`${prefix} ${match[2] || match[3]}`);
  }
  return codes;
}

const lowerDivisionNumber = (code) => {
  const digits = /(\d{3,4})$/.exec(code)?.[1];
  if (!digits) return false;
  return digits.length === 4 ? Number(digits) < 3000 : Number(digits) < 300;
};

function classifyPostTransferRow(row) {
  const units = maxCredits(row.credits) ?? 0;
  if (units <= 0 || /^\s*0\s*-/.test(String(row.credits || ''))) return null;
  if (/\bif\b[^.]*\bnot\b[^.]*\b(?:completed|taken)\b/i.test(String(row.notes || ''))) return null;
  const codes = universityCodes(row.requirement_text);
  if (!codes.length || !codes.every(lowerDivisionNumber)) return null;
  if (/\bgen(?:eral)?\.?\s*ed/i.test(row.requirement_text)) return 'ge';
  return codes.every((code) => VA_GE_SUBJECTS.has(splitCode(code)[0])) ? 'ge' : 'major';
}

/** Course codes with any letter suffix kept, so a lab (CSC 170L) is not its lecture. */
const exactCodes = (text) => [...String(text || '')
  .matchAll(/\b([A-Z]{2,5})\s*-?\s*(\d{3,4}[A-Z]?)\b/g)].map((m) => `${m[1]} ${m[2]}`);

/**
 * The VCCS courses a post-transfer row's own note says can satisfy it at the
 * college ("Can be completed at VCCS through CSC 215", "MTH 266 can be taken at
 * VCCS"). Such a row is lower-division work the college CAN reach.
 */
function vccsAlternatives(row) {
  const notes = String(row.notes || '');
  if (!/\bVCCS\b/.test(notes)) return [];
  return exactCodes(notes).map((code) => code.replace(' ', ''));
}

/**
 * One cell's lower-division credit: the whole lens (`total`, `covered`) and
 * its general-education share, so the GE-excluded reading is the difference.
 */
function lowerDivisionCell(guide, college, universe) {
  let noCredit = 0;
  let itemised = 0;
  let geTotal = 0;
  let geMissing = 0;
  let majorMissing = 0;
  for (const row of guide.cc_items.filter(countedRequirement)) {
    const units = maxCredits(row.credits) ?? 0;
    const role = classifyPreTransferRow(row);
    if (role === 'no_credit') { noCredit += units; continue; }
    itemised += units;
    if (role === 'elective') continue;
    const missing = classify(row, college, universe) === 'missing';
    if (role === 'ge') {
      geTotal += units;
      if (missing) geMissing += units;
    } else if (missing) {
      majorMissing += units;
    }
  }
  const stated = maxCredits(guide.totals?.pre_transfer_raw);
  const pre = stated != null ? Math.max(0, stated - noCredit) : itemised;
  const out = {
    total: pre,
    covered: Math.max(0, pre - geMissing - majorMissing),
    ge_total: geTotal,
    ge_covered: geTotal - geMissing,
  };
  // A university course the pre-transfer half already maps onto (UVA's CS 2130
  // from CSC 215) is that requirement listed twice, and counts once.
  const mappedBeforeTransfer = new Set(guide.cc_items.flatMap((row) => exactCodes(row.equivalent)));
  for (const row of (guide.post_items || []).filter(countedRequirement)) {
    const role = classifyPostTransferRow(row);
    if (!role) continue;
    if (exactCodes(row.requirement_text).some((code) => mappedBeforeTransfer.has(code))) continue;
    const units = maxCredits(row.credits) ?? 0;
    out.total += units;
    if (role === 'ge') out.ge_total += units;
    const reachable = vccsAlternatives(row)
      .some((code) => college.codes.has(resolveCode(code, universe)));
    if (reachable) {
      out.covered += units;
      if (role === 'ge') out.ge_covered += units;
    }
  }
  return out;
}

function sourceInterpretationWarnings(guide) {
  const rows = [...guide.cc_items, ...(guide.post_items || [])].filter(countedRequirement);
  const warnings = [];
  if (rows.some((row) => /\d\s*-\s*\d/.test(row.credits || ''))) {
    warnings.push('Credit ranges use their upper bounds; choices are not checked against one complete degree plan.');
  }
  const unresolved = rows.filter((row) => maxCredits(row.credits) == null);
  if (unresolved.length) warnings.push(`Unresolved credit quantities: ${unresolved.map(
    (row) => `${row.requirement_text} (${row.credits || 'unstated'})`,
  ).join('; ')}. Stated totals retain the credit, but its requirement allocation is uncertain.`);
  for (const row of rows) {
    const notes = String(row.notes || '').trim();
    if (/\bmust\b|\brequired\b|\bsequence\b|\bboth\b|\bdifferent\b|\bonly if\b|\bJava\b|C\+\+/i.test(notes)) {
      warnings.push(`Source condition not evaluated for ${row.requirement_text}: ${notes}`);
    }
  }
  return [...new Set(warnings)];
}

function build({ scheduledOnly, includeNonCs = false }) {
  const { guides } = JSON.parse(fs.readFileSync(GUIDES, 'utf8'));
  const colleges = loadColleges(scheduledOnly, includeNonCs);
  const universe = new Set(colleges.flatMap((c) => [...c.codes]));

  const cells = [];
  const programs = oneProgramPerUniversity(guides.filter((g) => IS_COMPUTER_SCIENCE(g.title)));
  // What the corpus consists of, counted from the corpus rather than written
  // down. The overview reports these, and a number typed into a page is a
  // number that goes stale the first time a guide or a catalogue is recaptured.
  const census = {
    guides_captured: guides.length,
    computing_guides: guides.filter((g) => IS_COMPUTER_SCIENCE(g.title)).length,
    programs: programs.length,
    universities: new Set(programs.map(universityOf)).size,
    colleges: colleges.length,
    colleges_offering_cs: colleges.filter((c) => c.offersCs !== false).length,
    catalog_courses: universe.size,
  };
  for (const guide of programs) {
    const guideWarnings = sourceInterpretationWarnings(guide);
    const rows = guide.cc_items
      .filter(countedRequirement)
      // The TOP of a stated range, not its midpoint. A guide writes "3-4
      // credits" because the student picks an option, and the guide's own
      // stated maximum is what keeps the sum honest — Bridgewater's rows reach
      // 65 at their heaviest against a stated ceiling of 62. Crediting the
      // midpoint instead summed to 60, so the ceiling never bound and every
      // cell came in a point and a half under the pathway the guide describes.
      .map((i) => ({ ...i, outcome: outcome(i.equivalent), units: maxCredits(i.credits) ?? 0 }));
    // EVERY itemised pre-transfer row is scored. The `outcome` column says what
    // the UNIVERSITY grants for a course; this figure asks what the COLLEGE can
    // teach, and `classify` answers that from the row's course codes alone. So
    // filtering on outcome only lost rows: Bridgewater's "Any UCGS Art"
    // (unclassified) and its second science choice (indeterminate) are both
    // real requirements, and dropping them took 6.5 of 60 pre-transfer credits
    // out of the figure without anyone deciding they should go.
    const scored = rows;
    // ALL post-transfer units, free electives included. Excluding the
    // university's elective space shrinks the denominator without shrinking the
    // numerator, and coverage then exceeds the degree's own transfer ceiling:
    // JMU allows at most 62 of 122 units from a community college, and dropping
    // its 29 elective units reported 63.3%. The paper excludes free-elective
    // padding from a requirement count; this is a unit measure over the whole
    // degree, where that space is real units a transfer student cannot bring.
    const universityOnly = (guide.post_items || [])
      .reduce((n, p) => n + (maxCredits(p.credits) ?? 0), 0);
    // The bachelor side's named work, with unrestricted padding dropped.
    // This source classification does not exclude every GE requirement.
    const universityOnlyNamed = (guide.post_items || [])
      .filter((p) => p.counts_toward_stats)
      .reduce((n, p) => n + (maxCredits(p.credits) ?? 0), 0);
    const statedPre = maxCredits(guide.totals?.pre_transfer_raw);
    // The TOP of a stated range. A guide that says "60-62 credits before
    // transfer" is stating a ceiling, and the itemised rows can sum past it
    // because several are ranges or choices — Bridgewater's seventeen rows sum
    // to 55 at their lightest, 60 at midpoint and 65 at their heaviest. The
    // ceiling is the guide's own answer to how much of it actually counts.
    const statedPreMax = maxCredits(guide.totals?.pre_transfer_raw);
    const statedPost = maxCredits(guide.totals?.post_transfer_raw);
    const statedTotal = statedPre != null && statedPost != null
      ? statedPre + statedPost
      : null;
    if (!scored.some((r) => r.outcome === 'named_course')) continue; // no course-level detail

    for (const college of colleges) {
      const sourceWarnings = [...guideWarnings];
      // Three verdicts per requirement row, and they sum to the transferable
      // half: courses this college teaches, courses it does not, and rows that
      // name no course at all and are satisfiable anywhere.
      const tally = { supplied: 0, missing: 0, assumed: 0 };
      // The same buckets converted to estimated course counts.
      const count = { supplied: 0, missing: 0, assumed: 0 };
      const rate = courseSize(guide);
      const missing = [];
      const denied = [];
      let unavailableAppliedUnits = 0;
      for (const row of scored) {
        const verdict = classify(row, college, universe);
        if (verdict === 'supplied' && /must take two of the courses/i.test(row.notes || '')) {
          const available = row.cc_codes.filter((code) => college.codes.has(resolveCode(code, universe)));
          if (available.length < 2) sourceWarnings.push(
            `Insufficient distinct choices for ${row.requirement_text}: ${college.name} supplies ${available.length} of the two required courses. The row's full credit is an unverified estimate, not demonstrated coverage.`,
          );
        }
        tally[verdict] += row.units;
        count[verdict] += courseCount(row.units, rate);
        if (verdict === 'missing') {
          missing.push({ requirement: row.requirement_text, codes: row.cc_codes, units: row.units });
          if (row.outcome !== 'no_credit') unavailableAppliedUnits += row.units;
        }
        if (row.outcome === 'no_credit') {
          denied.push({ requirement: row.requirement_text, codes: row.cc_codes,
            units: row.units, equivalent: row.equivalent });
        }
      }
      // Figure 3 reads the same three buckets from the associate degree's side.
      // A requirement this college cannot supply is still completed for the
      // A.S. — the student substitutes another option — but the substitute is
      // not what the guide asked for, so those units arrive as elective credit
      // and do no requirement work. Applied units are what lands on something
      // named; everything else is the loss.
      // The denominator is the guide's OWN stated size, not our itemised sum.
      // Summing the rows we could parse made the denominator a measure of
      // parsing completeness: it ran from 78.5 units at William & Mary to 157
      // at Norfolk State against stated totals near 120, so a guide we read
      // less of scored higher and the column spread was mostly our own gaps.
      // The guide states both halves; those are the degree.
      const denominator = statedTotal
        ?? (tally.supplied + tally.missing + tally.assumed + universityOnly);
      // The course figure must be built from the SAME statement of the degree
      // the credit figure uses, or the two are not two readings of one guide.
      //
      // Two ways that breaks, both seen here. First, a guide's stated half
      // includes elective padding it never itemises — Bridgewater states 61
      // pre-transfer credits and itemises 53.5 — and that padding is covered by
      // any college, so it belongs in the numerator, not only the denominator.
      // Second, some guides print a summary row AND the rows it summarises:
      // Norfolk State lists "Required Core Courses, 30 credits" and then the
      // thirteen courses that make up those same 30, so its post-transfer rows
      // sum to 93 against a stated 63. Counting rows gave it ten courses that
      // do not exist and dropped the cell fifteen points below its own credit
      // reading. Five of the twenty-four guides overstate a half this way.
      //
      // So each half is scaled to the credit the guide itself states for it,
      // which is the same refusal to trust a row sum that the credit
      // denominator already makes.
      const postItems = (guide.post_items || []).filter(countedRequirement);
      const postUnits = postItems.reduce((n, p) => n + (maxCredits(p.credits) ?? 0), 0);
      const itemisedPre = tally.supplied + tally.missing + tally.assumed;
      const statedPost = statedTotal != null && statedPre != null
        ? Math.max(0, statedTotal - statedPre) : null;
      /** Estimated courses, held to the credit their own half claims. */
      const held = (courses, itemised, claimed) => (
        claimed != null && itemised > claimed && itemised > 0
          ? courses * (claimed / itemised)
          : courses);
      // Round the credit-derived estimates to whole course slots. Rounding
      // removes fractional displays; it does not establish an enrollment count.
      const postCourses = Math.round(held(
        postItems.reduce((n, p) => n + courseCount(maxCredits(p.credits) ?? 0, rate), 0),
        postUnits, statedPost));
      // Credit each half states but never itemises, converted at the rate the
      // guide's own single courses exhibit.
      const sparePre = Math.round(Math.max(0, (statedPre ?? itemisedPre) - itemisedPre) / rate);
      const sparePost = Math.round(Math.max(0, (statedPost ?? postUnits) - postUnits) / rate);
      const coveredCourses = count.supplied + sparePre;
      const preCourses = count.supplied + count.missing + sparePre;
      const courseTotal = preCourses + postCourses + sparePost;
      // The guide's stated pre-transfer maximum is the supply ceiling even
      // when the maxima of its itemized credit ranges sum to a larger amount.
      const transferable = statedPre ?? (tally.supplied + tally.missing + tally.assumed);
      const ceilingPre = statedPreMax ?? transferable;
      // The guide's stated half, less the credit this college cannot teach.
      //
      // This used to SCALE: stated x (supplied / itemised), crediting the
      // unparsed remainder at the rate the parsed rows were supplied. It agreed
      // with subtraction to two decimal places on every basis — 50.09% either
      // way — but it returned a RATE applied to a total rather than a count of
      // credits, so numerators came out fractional. Paul D. Camp reached CNU
      // with 56.25 credits, which is not a quantity anyone can enrol in.
      //
      // Subtracting is also the more literal reading: a four-credit course this
      // college does not teach costs four credits, not 3.75. A row only counts
      // missing after `alternatives()` has failed to find any satisfiable
      // option group, so there is no substitute left to fall back on.
      const covered = Math.max(0, ceilingPre - tally.missing);
      // Figure 3/4 asks which earned credits apply after transfer. A guide's
      // explicit refusal is loss even when the college supplies that course.
      // Keep it disjoint from unavailable rows so a missing denied course is
      // charged once. The Figure 1 supply numerator remains a separate fact.
      const deniedUnits = denied.reduce((sum, row) => sum + row.units, 0);
      const wastedUnits = Math.min(transferable, deniedUnits + unavailableAppliedUnits);
      const lower = lowerDivisionCell(guide, college, universe);
      cells.push({
        college: college.slug,
        collegeName: college.name,
        collegeOffersCs: college.offersCs,
        method_status: sourceWarnings.length ? 'estimated' : 'ok',
        source_interpretation_warnings: sourceWarnings,
        course_count_method: 'estimated_from_credits',
        guide: guide.slug,
        guideTitle: guide.title.replace(/ Transfer Guide$/, ''),
        supplied: tally.supplied,
        missing_units: tally.missing,
        assumed: tally.assumed,
        universityOnly,
        denominator,
        coverage: denominator ? covered / denominator : null,
        // Historical `_paper` fields remove assumed-category credits from
        // numerator and denominator equally. The bucket includes open-category
        // assumptions and is not a complete GE taxonomy: enumerated GE courses
        // can remain. This is not literal Massachusetts paper equivalence.
        coverage_paper: (denominator - tally.assumed) > 0
          ? Math.max(0, covered - tally.assumed) / (denominator - tally.assumed) : null,
        ceiling_paper: (denominator - tally.assumed) > 0
          ? Math.max(0, ceilingPre - tally.assumed) / (denominator - tally.assumed) : null,
        ge_units: tally.assumed,
        // The numerator each ratio is actually built from. These must be
        // emitted alongside the percentage, because the figure recomputes the
        // cell from counts and ignores the percentage entirely — publishing a
        // percentage that its own numerator and denominator do not reproduce
        // put 44.2% on screen against 50.4% in the data.
        covered_units: covered,
        covered_units_no_ge: Math.max(0, covered - tally.assumed),
        covered_courses: coveredCourses,
        pre_courses: preCourses,
        // Estimated course coverage with the assumed-category bucket excluded.
        coverage_courses: courseTotal ? Math.min(1, coveredCourses / courseTotal) : null,
        ceiling_courses: courseTotal ? Math.min(1, preCourses / courseTotal) : null,
        courses_supplied: count.supplied,
        courses_missing: count.missing,
        courses_total: courseTotal,
        course_size: Math.round(rate * 100) / 100,
        // Historical named-work fields retain the source's supplied-row and
        // named post-transfer buckets; neither is a complete GE classification.
        supplied_named: tally.supplied,
        university_only_named: universityOnlyNamed,
        stated_pre_units: statedPre,
        stated_total_units: statedTotal,
        itemised_units: itemisedPre + universityOnly,
        // Figure 3 — associate-degree credit utilization.
        //
        // A college that does not teach a course the guide names does not stop
        // the student graduating: the associate degree has options, and they
        // take another one. That substitute is not what the receiving guide
        // asked for, so it arrives as credit the bachelor's applies to nothing
        // — earned, transferred, and wasted. Utilization is therefore the
        // transferable half less the units this college forces a student to
        // substitute, over that half.
        as_total_units: transferable,
        as_applied_units: transferable - wastedUnits,
        as_wasted_units: wastedUnits,
        as_denied_units: deniedUnits,
        as_unavailable_applied_units: unavailableAppliedUnits,
        denied,
        utilization: transferable
          ? (transferable - wastedUnits) / transferable : null,
        // Best case for this college: what coverage would be if nothing were
        // denied and nothing were missing from its catalogue.
        // The whole transferable half: what this college would reach if its
        // catalogue lacked nothing. This is the ceiling the guide itself sets.
        // The ceiling is the same construction with nothing missing: every
        // itemised pre-transfer requirement supplied, still held to the guide's
        // stated maximum. It must be built from the same numerator the value
        // is, or a cell can sit above its own ceiling.
        ceiling: denominator ? ceilingPre / denominator : null,
        // The lower-division lens (see lowerDivisionCell): the bachelor's
        // lower-division requirement credits, free electives excluded, with
        // general education first excluded and then included.
        ld_units: lower.total,
        ld_covered: lower.covered,
        ld_ge_units: lower.ge_total,
        ld_ge_covered: lower.ge_covered,
        missing,
      });
    }
  }
  return { cells, colleges, census };
}

function report(basis, cells) {
  const pct = (v) => `${(100 * v).toFixed(1)}%`;

  const byCollege = new Map();
  for (const c of cells) {
    if (!byCollege.has(c.college)) byCollege.set(c.college, []);
    byCollege.get(c.college).push(c);
  }
  console.log(`\n=== basis: ${basis} · ${byCollege.size} colleges × `
    + `${cells.length / byCollege.size} guides = ${cells.length} cells ===\n`);
  console.log('college                        coverage   unavailable units   guides losing units');
  const ranked = [...byCollege].map(([slug, rows]) => {
    const cov = rows.reduce((n, r) => n + r.coverage, 0) / rows.length;
    const un = rows.reduce((n, r) => n + r.missing_units, 0);
    return { slug, name: rows[0].collegeName, cov, un, hit: rows.filter((r) => r.missing_units > 0).length };
  }).sort((a, b) => b.cov - a.cov);
  for (const r of ranked) {
    console.log(`  ${r.name.slice(0, 30).padEnd(30)} ${pct(r.cov).padStart(7)}   ${String(r.un).padStart(15)}   ${String(r.hit).padStart(17)}`);
  }
  const cov = cells.reduce((n, c) => n + c.coverage, 0) / cells.length;
  const una = cells.reduce((n, c) => n + c.missing_units, 0);
  const asum = cells.reduce((n, c) => n + c.assumed, 0);
  const asT = cells.reduce((n, c) => n + c.as_total_units, 0);
  const asA = cells.reduce((n, c) => n + c.as_applied_units, 0);
  console.log(`\nFigure 1 coverage    ${pct(cov)} · missing ${una} units · assumed ${asum} units`);
  console.log(`Figure 3 utilization ${pct(asA / asT)} of stated pre-transfer units`);
  console.log(`spread across colleges: ${pct(ranked[0].cov)} (${ranked[0].name}) to `
    + `${pct(ranked[ranked.length - 1].cov)} (${ranked[ranked.length - 1].name})`);
  return { coverage: cov, missing_units: una, assumed_units: asum };

}

function main() {
  const write = process.argv.includes('--write');
  const variants = {
    catalog: build({ scheduledOnly: false }),
    scheduled: build({ scheduledOnly: true }),
    catalog_all: build({ scheduledOnly: false, includeNonCs: true }),
    scheduled_all: build({ scheduledOnly: true, includeNonCs: true }),
  };
  const pooled = {};
  for (const [key, v] of Object.entries(variants)) pooled[key] = report(key, v.cells);
  const catalog = variants.catalog;
  const scheduled = variants.scheduled;
  const pooledCatalog = pooled.catalog;
  const pooledScheduled = pooled.scheduled;

  if (write) {
    const trim = (cells) => cells.map((c) => ({ ...c, missing: c.missing.slice(0, 12) }));
    fs.writeFileSync(OUT, `${JSON.stringify({
      built_at: new Date().toISOString(),
      default_basis: 'catalog',
      colleges: catalog.colleges.map((c) => ({ slug: c.slug, name: c.name })),
      census: { ...variants.catalog_all.census, ...variants.catalog.census, colleges_all: variants.catalog_all.census.colleges },
      catalog: { pooled: pooled.catalog, cells: trim(variants.catalog.cells) },
      scheduled: { pooled: pooled.scheduled, cells: trim(variants.scheduled.cells) },
      catalog_all: { pooled: pooled.catalog_all, cells: trim(variants.catalog_all.cells) },
      scheduled_all: { pooled: pooled.scheduled_all, cells: trim(variants.scheduled_all.cells) },
    }, null, 1)}\n`);
    console.log(`\nwrote ${OUT}`);
  }
}

if (require.main === module) main();

module.exports = {
  build, classify, classifyPreTransferRow, classifyPostTransferRow, lowerDivisionCell, universityCodes,
  vccsAlternatives,
};
