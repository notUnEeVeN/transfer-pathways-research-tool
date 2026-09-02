#!/usr/bin/env node
/**
 * Virginia Figure 1 cells — one coverage value per community college ×
 * university program, which is the grain the coverage heatmap already uses for
 * California and Massachusetts.
 *
 * Two sources, and the figure needs both. A transfer guide states what a course
 * BECOMES at the receiving institution, but a guide does not vary by college:
 * there is one UVA computer-science guide, not sixteen. Guide data alone would
 * therefore paint sixteen identical rows. The college dimension comes from the
 * VCCS catalogues instead — whether that college actually teaches the course
 * the guide asks for.
 *
 * So a requirement is covered only when BOTH hold:
 *
 *   articulation  the guide says the course lands on a named course or a named
 *                 requirement, rather than elective space or no credit
 *   supply        the college's own catalogue carries at least one of the
 *                 course codes the requirement accepts
 *
 * Failing the second is `unavailable` — the credit would apply, but this
 * college does not teach the course. That is the only bucket that varies
 * across colleges, and it is what gives the heatmap its shape.
 *
 * Failing the FIRST is recorded as `denied` but is deliberately kept OUT of the
 * denominator. Those are community-college units that land in elective space —
 * a fact about wasted associate credit, which is Figure 3's subject. The
 * bachelor requirement they fail to satisfy is already counted here, as
 * university-only work; putting the CC-side units in as well would count the
 * same failure twice and drag every cell down by about two points.
 *
 * University-only work stays in every denominator. A Virginia guide splits the
 * degree evenly, so roughly half the named work sits after the transfer point
 * and is unreachable by construction; that is what puts the ceiling near 50%
 * rather than 100%, and dropping it would report a structural fact as success.
 *
 * General education is counted, as in `buildGuideFigures.js` — see that file
 * for why excluding it is one-sided against this data.
 *
 * Both bases are written in one artifact. Catalogue is the default because it
 * is the honest description of what a college publishes; scheduled is the
 * toggle, and the pair is itself the finding — the guides work at every college
 * on paper and only at the well-resourced ones in a given term.
 *
 *   node scripts/va/buildVaCoverageCells.js            # report both
 *   node scripts/va/buildVaCoverageCells.js --write    # write both
 */
const fs = require('node:fs');
const path = require('node:path');
const { outcome, credits, maxCredits } = require('./buildGuideFigures');

const SERVER = path.resolve(__dirname, '..', '..');
const GUIDES = path.join(SERVER, '.va-guides', 'guides.json');
const CATALOG = path.join(SERVER, '.va-courses', 'catalog');
const OUT = path.join(SERVER, '.va-courses', 'va-coverage-cells.json');

// What a community-college course can discharge. Elective landings are
// INCLUDED: "HSS Elective (2 of 5)", "Unrestricted Elective (1 of 4)",
// "Advanced Natural Science Elective" name a slot the degree defines, and the
// guide has already done the capacity accounting in writing them "n of m". A
// course filling one is meeting a requirement, not wasting a credit. Counting
// them as loss put UVA at 33.2% purely for describing its own elective
// structure in detail — 20.5 units per cell — while a university that wrote
// "Elective" once scored higher for saying less.
//
// Only an outright refusal is loss, and across the 23 computer-science guides
// that is four rows: "Does not transfer", "No transfer credit".
const APPLIED = new Set(['named_course', 'named_requirement', 'elective_only']);

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
 * How many courses a requirement row stands for.
 *
 * The Massachusetts paper counts required courses binary, and Virginia is held
 * to the same convention. It cannot be done by counting rows, because the two
 * halves of a guide are not typeset alike: the community-college half is
 * itemised course by course, while the university half collapses blocks into
 * single rows — Norfolk State's "Required Core Courses" is one row worth 30
 * credits. So every row on BOTH sides is converted by this one function, and a
 * row worth one course's credit is one course.
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
  const appears = (code, part) => {
    const [, prefix, number] = /^([A-Z]+)(\d+)$/.exec(code) || [];
    return Boolean(prefix) && new RegExp(`${prefix}\\s*-?\\s*${number}\\b`, 'i').test(part);
  };
  const groups = [];
  const claimed = new Set();
  for (const part of String(text).split(/\s+or\s+/i)) {
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
  const groups = alternatives(item.requirement_text, item.cc_codes);
  const ok = groups.some((group) => group.every((code) => college.codes.has(resolveCode(code, universe))));
  return ok ? 'supplied' : 'missing';
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
    const rows = guide.cc_items
      .filter((i) => i.counts_toward_stats)
      // The TOP of a stated range, not its midpoint. A guide writes "3-4
      // credits" because the student picks an option, and the guide's own
      // stated maximum is what keeps the sum honest — Bridgewater's rows reach
      // 65 at their heaviest against a stated ceiling of 62. Crediting the
      // midpoint instead summed to 60, so the ceiling never bound and every
      // cell came in a point and a half under the pathway the guide describes.
      .map((i) => ({ ...i, outcome: outcome(i.equivalent), units: maxCredits(i.credits) ?? 0 }));
    // Rows whose outcome the guide never states are held out of the figure
    // entirely rather than counted as failures; see buildGuideFigures.js.
    // EVERY itemised pre-transfer row is scored. The `outcome` column says what
    // the UNIVERSITY grants for a course; this figure asks what the COLLEGE can
    // teach, and `classify` answers that from the row's course codes alone. So
    // filtering on outcome only lost rows: Bridgewater's "Any UCGS Art"
    // (unclassified) and its second science choice (indeterminate) are both
    // real requirements, and dropping them took 6.5 of 60 pre-transfer credits
    // out of the figure without anyone deciding they should go.
    const scored = rows;
    const unstatedUnits = 0;
    // ALL post-transfer units, free electives included. Excluding the
    // university's elective space shrinks the denominator without shrinking the
    // numerator, and coverage then exceeds the degree's own transfer ceiling:
    // JMU allows at most 62 of 122 units from a community college, and dropping
    // its 29 elective units reported 63.3%. The paper excludes free-elective
    // padding from a requirement count; this is a unit measure over the whole
    // degree, where that space is real units a transfer student cannot bring.
    const universityOnly = (guide.post_items || [])
      .reduce((n, p) => n + (maxCredits(p.credits) ?? 0), 0);
    // The bachelor side's NAMED work only, with free-elective padding dropped.
    // The Massachusetts paper's Figure 1 counts named course requirements and
    // excludes general education and elective padding from both halves; this is
    // that half of the exclusion.
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
      // Three verdicts per requirement row, and they sum to the transferable
      // half: courses this college teaches, courses it does not, and rows that
      // name no course at all and are satisfiable anywhere.
      const tally = { supplied: 0, missing: 0, assumed: 0 };
      // The same three buckets counted the paper's way, binary per course.
      const count = { supplied: 0, missing: 0, assumed: 0 };
      const rate = courseSize(guide);
      const missing = [];
      for (const row of scored) {
        const verdict = classify(row, college, universe);
        tally[verdict] += row.units;
        count[verdict] += courseCount(row.units, rate);
        if (verdict === 'missing') {
          missing.push({ requirement: row.requirement_text, codes: row.cc_codes, units: row.units });
        }
      }
      // Figure 3 reads the same three buckets from the associate degree's side.
      // A requirement this college cannot supply is still completed for the
      // A.S. — the student substitutes another option — but the substitute is
      // not what the guide asked for, so those units arrive as elective credit
      // and do no requirement work. Applied units are what lands on something
      // named; everything else is the loss.
      const asTotal = tally.supplied + tally.missing + tally.assumed;
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
      const postItems = (guide.post_items || []).filter((p) => p.counts_toward_stats);
      const postUnits = postItems.reduce((n, p) => n + (maxCredits(p.credits) ?? 0), 0);
      const itemisedPre = tally.supplied + tally.missing + tally.assumed;
      const statedPost = statedTotal != null && statedPre != null
        ? Math.max(0, statedTotal - statedPre) : null;
      /** Row-counted courses, held to the credit their own half claims. */
      const held = (courses, itemised, claimed) => (
        claimed != null && itemised > claimed && itemised > 0
          ? courses * (claimed / itemised)
          : courses);
      const postCourses = held(
        postItems.reduce((n, p) => n + courseCount(maxCredits(p.credits) ?? 0, rate), 0),
        postUnits, statedPost);
      const preScale = statedPre != null && itemisedPre > statedPre && itemisedPre > 0
        ? statedPre / itemisedPre : 1;
      // Credit each half states but never itemises, converted at the rate the
      // guide's own single courses exhibit.
      const sparePre = Math.max(0, (statedPre ?? itemisedPre) - itemisedPre) / rate;
      const sparePost = Math.max(0, (statedPost ?? postUnits) - postUnits) / rate;
      const coveredCourses = count.supplied * preScale + sparePre;
      const preCourses = (count.supplied + count.missing) * preScale + sparePre;
      const courseTotal = preCourses + postCourses + sparePost;
      // What this college can actually put on the degree, counted the way
      // California counts it: the itemised requirements it can supply, not the
      // guide's stated half less what it cannot. The two differ whenever the
      // rows do not sum to the stated total, and the old form credited that
      // difference to every college for free.
      //
      // The guide's stated maximum is then respected as a ceiling. A student
      // cannot carry more preparation than the guide says the pathway holds,
      // however many heavy options the rows offer.
      const transferable = statedPre ?? (tally.supplied + tally.missing + tally.assumed);
      const ceilingPre = statedPreMax ?? transferable;
      // Held to the guide's stated half, at the rate this college supplies the
      // rows we DID parse.
      //
      // Counting only parsed rows punishes a guide for our own gaps: eleven of
      // the fifteen itemise their community-college half to within a credit or
      // two of the ceiling they state, but William & Mary itemises 53 against a
      // stated 63 and VCU 53 against 62, and those two read four points low for
      // that reason alone. Substituting the stated half outright is the other
      // error — it credits unparsed rows to every college for free, whatever
      // its catalogue holds. Scaling does neither: the unparsed remainder is
      // assumed available exactly as often as the parsed remainder is, so a
      // college missing a fifth of what we read is credited with four fifths of
      // what we did not. Where the rows overshoot the stated ceiling, this is
      // the ceiling.
      const itemisedPreUnits = tally.supplied + tally.missing + tally.assumed;
      const covered = itemisedPreUnits > 0
        ? ceilingPre * ((tally.supplied + tally.assumed) / itemisedPreUnits)
        : 0;
      cells.push({
        college: college.slug,
        collegeName: college.name,
        collegeOffersCs: college.offersCs,
        guide: guide.slug,
        guideTitle: guide.title.replace(/ Transfer Guide$/, ''),
        supplied: tally.supplied,
        missing_units: tally.missing,
        assumed: tally.assumed,
        universityOnly,
        denominator,
        coverage: denominator ? covered / denominator : null,
        // Paper-equivalent lens: general education out of BOTH sides, the same
        // number of units from each. The degree is lower division plus upper
        // division, so removing N units of general education leaves
        // (covered - N) over (total - N) — it does not touch the university's
        // half at all. An earlier version dropped the university's free
        // electives from the denominator instead, which shrank the bottom
        // without shrinking the top and pushed 137 of 240 cells above the
        // degree's own ceiling, one to 61.9% where nothing can exceed ~52%.
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
        // The Massachusetts convention: required courses, binary, general
        // education excluded — which the count does by construction, since a
        // general-education row names no course to require.
        coverage_courses: courseTotal ? Math.min(1, coveredCourses / courseTotal) : null,
        ceiling_courses: courseTotal ? Math.min(1, preCourses / courseTotal) : null,
        courses_supplied: count.supplied,
        courses_missing: count.missing,
        courses_total: courseTotal,
        course_size: Math.round(rate * 100) / 100,
        // MA-paper preset: required courses, general education excluded — which
        // the count does by construction, since a general-education row names
        // no course to require.
        supplied_named: tally.supplied,
        university_only_named: universityOnlyNamed,
        stated_pre_units: statedPre,
        stated_total_units: statedTotal,
        itemised_units: tally.covered + tally.denied + tally.unavailable + universityOnly,
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
        as_applied_units: Math.max(0, transferable - tally.missing),
        as_wasted_units: tally.missing,
        utilization: transferable
          ? Math.max(0, transferable - tally.missing) / transferable : null,
        // Best case for this college: what coverage would be if nothing were
        // denied and nothing were missing from its catalogue.
        // The whole transferable half: what this college would reach if its
        // catalogue lacked nothing. This is the ceiling the guide itself sets.
        // The ceiling is the same construction with nothing missing: every
        // itemised pre-transfer requirement supplied, still held to the guide's
        // stated maximum. It must be built from the same numerator the value
        // is, or a cell can sit above its own ceiling.
        ceiling: denominator ? ceilingPre / denominator : null,
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
  const asU = cells.reduce((n, c) => n + c.as_unstated_units, 0);
  console.log(`\nFigure 1 coverage    ${pct(cov)} · missing ${una} units · assumed ${asum} units`);
  console.log(`Figure 3 utilization ${pct(asA / asT)} of itemised associate units`);
  console.log(`spread across colleges: ${pct(ranked[0].cov)} (${ranked[0].name}) to `
    + `${pct(ranked[ranked.length - 1].cov)} (${ranked[ranked.length - 1].name})`);
  return { coverage: cov, missing_units: una, assumed_units: asum };

  return { coverage: cov / den, covered: cov, denied: den2, unavailable: una, denominator: den };
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

module.exports = { build, classify };
