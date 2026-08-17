/**
 * Virginia course codes, including the wildcard forms Transfer Virginia uses to
 * record generic transfer credit.
 *
 * Virginia writes an articulation two ways. A **concrete** identifier names the
 * receiving course ("MTH263 lands as MATH113 at George Mason"). A **wildcard**
 * identifier says the course transfers only as unspecified credit in a subject
 * and level band ("SOC268 lands as SOCY2XX — Sociology Transfer Elective"). The
 * distinction is the whole point of the Virginia figures: wildcard credit
 * transfers but does not satisfy a named requirement, which is exactly the
 * applicability gap the research measures.
 *
 * Measured across the 4,668 stored articulation edges, the wildcard forms are:
 *
 *   SOCY2XX   level wildcard  — prefix + level digit + X run (446 edges)
 *   CS 4XXX   level wildcard  — four-digit institutions (Virginia Tech)
 *   ENGH----  open wildcard   — prefix + dash run, no level at all (109)
 *   MATH1XXP  suffixed        — a designation letter rides after the X run (20)
 *   SOC2ELE   elective marker — institution-specific "elective" spelling (~557)
 *
 * The X run sets the digit width, so the band follows from the pattern itself
 * rather than from a per-institution table: `2XX` is a three-digit code in
 * 200–299, `4XXX` is a four-digit code in 4000–4999. `CS 4/5XXX` carries two
 * bands.
 *
 * Nothing here decides whether a wildcard *satisfies* a requirement — that is
 * `satisfies()`, which requires the requirement to be generic in the same
 * subject and band. A wildcard never satisfies a named course.
 */

// A run of X or the letter O standing in for the digits ("SOCY2XX", "CSOOO"),
// optionally followed by a designation suffix ("MATH1XXP", "PHYS1XXX4").
const LEVEL_WILDCARD = /^([A-Z&]{2,6})\s*(\d(?:\/\d)*)([XO]{1,3})[A-Z0-9+]{0,3}$/i;
// The prefix is lazy so a trailing placeholder run wins the characters it
// needs: "CSOOO" is CS + OOO, not CSO + OO. Backtracking still recovers real
// prefixes that end in one of those letters ("GEO----").
const OPEN_WILDCARD = /^([A-Z&]{2,6}?)\s*(?:-{2,}|[XO]{2,4})$/i;
// A real course number is three or four digits in every Virginia catalog we
// hold, and a trailing designation may ride on it: "BIO101L" (lab), "ED200SL"
// (service learning), "PE118+". A one- or two-digit number is only a course
// when nothing trails it — otherwise the shape is a level marker plus an area
// code ("LANG1GC", "TRNS1SS", "ENGL2HC"), which is generic credit, not a
// course numbered 1. Reading those as courses would let elective credit
// satisfy a named requirement.
const CONCRETE = /^([A-Z&]{2,6})\s*(?:(\d{3,4})([A-Z]{0,2}\+?)|(\d{1,2}))$/i;
// Subject slots that name no subject: these are slot bookkeeping, not catalog
// prefixes, so a number after them is an index rather than a course number.
const MARKER_PREFIX = /^(PREREQ|LABSCI|TRNS?|TRAN|ELEC?T?|GEN?|SLOT|REQ)$/i;
// A prefix ending in a run of letter O is the O-for-zero placeholder form
// ("PSYCOO2", "SOCIOO1").
const O_PLACEHOLDER = /OO+$/i;
// A general-education area marker names the area after a GE prefix.
const GE_AREA = /^GE([A-Z]{2,8})$/i;
// Free-floating elective credit with no subject at all.
const FREE_CREDIT = /^(?:ELECTIVE|ELEC|ELECT|ELCT|TRNFREE|FREE|TRANSFER|TRNS|TRAN)$/i;
// Anything else: a leading subject run, optionally carrying one level digit
// ("LIT1REQ", "SOC2ELE", "ENGLNOTMJ", "HUMNT").
const GENERIC_SHAPE = /^([A-Z&]{2,8}?)(\d)?([A-Z]{1,8})?$/i;

const normalize = (value) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
const bandFor = (digit, width) => {
  const base = Number(digit) * 10 ** (width - 1);
  return [base, base + 10 ** (width - 1) - 1];
};
const OPEN_BAND = [[0, Infinity]];

/**
 * Parse a Virginia course identifier.
 *
 * Returns `{ kind, prefix, bands, number, raw }`. `kind` is `concrete` for a
 * real course, or one of `level_wildcard` / `open_wildcard` / `generic_credit`
 * for the forms that stand for unspecified credit. `bands` lists the inclusive
 * `[min, max]` number ranges the identifier can cover; `concrete` carries
 * `number` instead.
 *
 * The cascade is ordered by how specific the evidence is, and its last rule is
 * deliberately total: **an identifier that is not a parseable concrete course
 * code is generic credit.** Virginia spells generic credit at least a dozen
 * ways across 33 institutions (`TRNFREE`, `GESCI`, `ENGLNOTMJ`, `QUANTELCT`),
 * and inventing a course out of an unrecognised string would credit a named
 * requirement that nothing satisfies. Falling back to generic is the
 * conservative direction: it can never satisfy a named requirement.
 */
function parseCourseCode(value) {
  const raw = String(value ?? '').trim();
  const code = normalize(raw);
  const base = { prefix: null, bands: [], number: null, suffix: '', raw };
  if (!code) return { ...base, kind: 'unparsed' };

  const level = code.match(LEVEL_WILDCARD);
  if (level) {
    const [, prefix, digits, run] = level;
    const width = digits.split('/')[0].length + run.length;
    return {
      ...base,
      kind: 'level_wildcard',
      prefix: prefix.toUpperCase(),
      bands: digits.split('/').map((digit) => bandFor(digit, width)),
    };
  }

  const open = code.match(OPEN_WILDCARD);
  if (open) {
    return { ...base, kind: 'open_wildcard', prefix: open[1].toUpperCase(), bands: OPEN_BAND };
  }

  const concrete = code.match(CONCRETE);
  if (concrete) {
    const prefix = concrete[1].toUpperCase();
    const number = Number(concrete[2] ?? concrete[4]);
    // "CS000" is a zero-numbered placeholder, not course zero.
    if (number === 0) return { ...base, kind: 'open_wildcard', prefix, bands: OPEN_BAND };
    if (O_PLACEHOLDER.test(prefix)) {
      return { ...base, kind: 'open_wildcard', prefix: prefix.replace(O_PLACEHOLDER, ''), bands: OPEN_BAND };
    }
    if (MARKER_PREFIX.test(prefix)) {
      return { ...base, kind: 'generic_credit', prefix: null, bands: OPEN_BAND };
    }
    // The suffix is part of the course's identity, not decoration: "BIO 110L"
    // is the laboratory and "BIO 110" the lecture, and Virginia degrees require
    // the pair as a series. Dropping it let a lecture equivalency satisfy a lab
    // requirement and credited series that cannot actually be completed.
    return { ...base, kind: 'concrete', prefix, number, suffix: (concrete[3] || '').toUpperCase() };
  }

  if (FREE_CREDIT.test(code)) {
    return { ...base, kind: 'generic_credit', prefix: null, bands: OPEN_BAND };
  }

  const geArea = code.match(GE_AREA);
  if (geArea) {
    return { ...base, kind: 'generic_credit', prefix: geArea[1].toUpperCase(), bands: OPEN_BAND };
  }

  const generic = code.match(GENERIC_SHAPE);
  if (generic) {
    const [, prefix, digit] = generic;
    return {
      ...base,
      kind: 'generic_credit',
      prefix: prefix.toUpperCase(),
      bands: digit ? [bandFor(digit, 3)] : OPEN_BAND,
    };
  }
  return { ...base, kind: 'generic_credit', bands: OPEN_BAND };
}

/** True when the identifier stands for a band of courses rather than one course. */
const isWildcard = (value) => parseCourseCode(value).kind !== 'concrete';

/** True when a concrete code falls inside a parsed wildcard's subject and band. */
function codeInBand(wildcard, candidate) {
  const pattern = typeof wildcard === 'string' ? parseCourseCode(wildcard) : wildcard;
  const target = typeof candidate === 'string' ? parseCourseCode(candidate) : candidate;
  if (!pattern || !target || target.kind !== 'concrete') return false;
  if (!pattern.prefix || pattern.prefix !== target.prefix) return false;
  return pattern.bands.some(([min, max]) => target.number >= min && target.number <= max);
}

/**
 * Does `supply` satisfy `demand`?
 *
 * The asymmetry is deliberate and is the heart of the Virginia figures:
 *
 * - concrete → concrete: the codes must match.
 * - wildcard demand ← concrete supply: a slot written `CSC 1XX` accepts any
 *   real 100-level CSC course.
 * - **wildcard supply → concrete demand: never.** "Lands as SOCY2XX" is
 *   unspecified elective credit; it cannot stand in for a named requirement.
 *   Treating it as satisfying would inflate articulation exactly the way a
 *   set-membership check inflated the Massachusetts placeholder slots.
 * - wildcard supply → wildcard demand: allowed when subject matches and the
 *   bands overlap, because the requirement is itself generic.
 */
function satisfies(demand, supply) {
  const want = typeof demand === 'string' ? parseCourseCode(demand) : demand;
  const have = typeof supply === 'string' ? parseCourseCode(supply) : supply;
  if (!want || !have) return false;
  if (want.kind === 'unparsed' || have.kind === 'unparsed') return false;

  if (want.kind === 'concrete') {
    if (have.kind !== 'concrete') return false;
    return want.prefix === have.prefix
      && want.number === have.number
      && (want.suffix || '') === (have.suffix || '');
  }
  // Generic demand: a real course in the band satisfies it.
  if (have.kind === 'concrete') return codeInBand(want, have);
  // Generic on both sides: the subject must match outright, including the case
  // where both are subjectless (free elective credit filling a free slot).
  //
  // A null prefix must never act as a wildcard on the demand side. Requirement
  // text that names no parseable subject ("Mason Core Literature", "Additional
  // qualifying natural science") parses to a null prefix, and treating that as
  // "matches any subject" let generic Computer Science credit satisfy a
  // literature requirement and English Composition satisfy a science slot.
  if (want.prefix !== have.prefix) return false;
  return want.bands.some(([wMin, wMax]) => have.bands.some(([hMin, hMax]) => wMin <= hMax && hMin <= wMax));
}

/**
 * Consume matches from a supply pool, one demand at a time.
 *
 * Virginia repeats identical generic slots ("SOCY2XX" twice in one degree) and
 * a college can offer several courses that fit the same band, so membership
 * tests overstate coverage. Every match here removes the supply row it used —
 * the same multiset discipline the Massachusetts overlay needs.
 *
 * Returns `{ matched, unmatched, leftover }`; `matched` pairs each satisfied
 * demand with the supply entry spent on it.
 */
function consumeMatches(demands, supplies) {
  const pool = supplies.map((entry) => ({ entry, used: false }));
  const matched = [];
  const unmatched = [];
  for (const demand of demands) {
    const slot = pool.find((row) => !row.used && satisfies(demand, row.entry));
    if (slot) {
      slot.used = true;
      matched.push({ demand, supply: slot.entry });
    } else {
      unmatched.push(demand);
    }
  }
  return { matched, unmatched, leftover: pool.filter((row) => !row.used).map((row) => row.entry) };
}

module.exports = {
  parseCourseCode, isWildcard, codeInBand, satisfies, consumeMatches,
};
