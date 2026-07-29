/**
 * ARTSYS Program Transfer Guide HTML -> intermediate structure.
 *
 * One guide page rendered for one sending college is one agreement:
 *   /program_transfer_guides/<guideId>?sender_university_id=<senderId>
 *
 * The markup is semantic and has been stable across every guide sampled:
 *
 *   li.ptg-requirement-container          a requirement group
 *     div.req-header                        group label + rule + credits
 *     div.andbranch | div.orbranch          a section (conjunction is the class)
 *       div.leaf-item                       one receiver
 *         div.sender-course                   what the college offers, or none
 *         div.receiving-course                the university course being asked for
 *
 * Branches NEST, and leaves are not always inside one. A group may render its
 * receivers directly under `.reqs-container`, and an `orbranch` may sit inside
 * an `andbranch` to mean "complete all of these and one of those". Both are
 * handled explicitly; walking branches alone silently drops ~24% of receivers.
 *
 * The sending side has FIVE renderings, and telling them apart is the whole
 * game because two of them are what make a gap measurable:
 *
 *   1. one equivalent   -> a single `content-loader-modal` div whose button IS
 *                          the sending course. Its dialog body is EMPTY and
 *                          filled by AJAX on click, so a naive "read the dialog"
 *                          parse silently yields zero alternatives here.
 *   2. N equivalents    -> a `modal` div whose button reads "N equivalent
 *                          courses found" and whose dialog body IS populated.
 *   3. no equivalent    -> a bare button reading "No equivalency found."
 *                          The `not_articulated` signal.
 *   4. category slot    -> "N Courses for this Requirement|Subject": the
 *                          receiving side names a bucket ("Science Elective",
 *                          "ANCS Ancient Studies") and the dialog lists every
 *                          qualifying course at the sending college. A slot is
 *                          REPEATABLE — one can absorb a whole multi-course ask.
 *   5. empty category   -> "No courses found for this Requirement|Subject":
 *                          the college cannot fill the bucket at all. Also a gap.
 *
 * Category receivers keep `receiving.kind = 'category'` so a consumer can decide
 * whether to count them, rather than being dropped as unparseable.
 */
const cheerio = require('cheerio');
const { parseGroupRule } = require('./quantifiers');
const { splitCourseLabel, splitAndCombination } = require('./ids');

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** `/equivalencies/courses/15578718?modal=true` -> 15578718 */
function idFromModalUrl(url, kind) {
  if (!url) return null;
  const re = kind === 'course'
    ? /\/equivalencies\/courses\/(\d+)/
    : /\/equivalencies\/(\d+)/;
  const m = re.exec(String(url));
  return m ? Number(m[1]) : null;
}

/** Header block -> program title, receiving institution, effective terms. */
function parseHeader($) {
  const heading = clean($('h1').first().text()) || clean($('h2').first().text());
  // The guide header renders as: <program> / "Program Transfer Guide" /
  // <receiving institution> / "Effective" / <term range>.
  const lines = clean($('main').text() || $('body').text());
  const eff = /Effective\s+((?:Fall|Spring|Summer|Winter),?\s*\d{4}\s*-\s*(?:Current|(?:Fall|Spring|Summer|Winter),?\s*\d{4}))/i.exec(lines);
  let receiving = null;
  const marker = 'Program Transfer Guide';
  const idx = lines.indexOf(marker);
  if (idx >= 0) {
    const after = lines.slice(idx + marker.length, idx + marker.length + 160);
    const stop = after.search(/\bEffective\b/i);
    receiving = clean(stop > 0 ? after.slice(0, stop) : after.split('  ')[0]) || null;
  }
  return {
    program: heading || null,
    receiving_institution: receiving,
    effective: eff ? clean(eff[1]) : null,
  };
}

/** The sender <select> gives every (guide, sender) pair the guide supports. */
function parseSenders($) {
  const out = [];
  $('#sender_university_id option').each((_, el) => {
    const value = $(el).attr('value') || '';
    const m = /sender_university_id=(\d+)/.exec(value);
    if (!m) return;
    out.push({ artsys_id: Number(m[1]), name: clean($(el).text()) });
  });
  return out;
}

/** Which sender the page was rendered for. */
function parseSelectedSender($) {
  const sel = $('#sender_university_id option[selected]').attr('value')
    || $('#sender_university_id option').filter((_, el) => $(el).attr('selected') != null).first().attr('value');
  const m = /sender_university_id=(\d+)/.exec(sel || '');
  const name = clean($('#sender_university_id option[selected]').text()) || null;
  return m ? { artsys_id: Number(m[1]), name } : null;
}

/** One `.sender-course` block -> the option set that satisfies its receiver. */
function parseSenderSide($, node) {
  const html = $.html(node);
  if (html.includes('No equivalency found')) {
    return { status: 'not_articulated', options: [] };
  }

  const collect = (holder) => {
    const options = [];
    holder.find('div[data-content-loader-modal-url]').each((_, el) => {
      const $el = $(el);
      // Skip links that live inside a *nested* dialog; the populated
      // alternatives body is handled by its own explicit call below.
      if (holder.get(0) !== el && $el.parentsUntil(holder).filter('dialog').length) return;
      const label = clean($el.find('button').first().text());
      if (!label) return;
      const equivalencyId = idFromModalUrl($el.attr('data-content-loader-modal-url'), 'equivalency');
      const courseIdFromUrl = idFromModalUrl($el.attr('data-content-loader-modal-url'), 'course');
      // A multi-course equivalency renders as one label joined by " AND ".
      const parts = splitAndCombination(label).map(splitCourseLabel);
      options.push({
        conjunction: parts.length > 1 ? 'and' : 'or',
        courses: parts,
        artsys_equivalency_id: equivalencyId,
        artsys_course_id: parts.length === 1 ? courseIdFromUrl : null,
        label,
      });
    });
    return options;
  };

  // Case 2: "N equivalent courses found" -> alternatives live in the dialog body.
  const trigger = clean(node.find('> div > button').first().text());
  if (/^\d+ equivalent courses found$/i.test(trigger)) {
    const body = node.find('.dialog-modal-body').first();
    const options = collect(body);
    return { status: options.length ? 'articulated' : 'unknown', options };
  }

  // Case 4: a category requirement slot ("Science Elective"). The dialog lists
  // every course at the sending college that qualifies, or says none do. These
  // are alternatives, so the receiver is satisfied by any ONE of them.
  const body = node.find('.dialog-modal-body').first();
  const bodyText = body.length ? clean(body.text()) : '';
  // ARTSYS labels these slots two ways — "(Requirement)" for a degree
  // requirement bucket and "(Subject)" for a discipline bucket ("ANCS Ancient
  // Studies"). Both behave identically: a repeatable slot filled by any
  // qualifying course at the sending college.
  if (/No courses found for this (?:Requirement|Subject)/i.test(bodyText)) {
    return { status: 'not_articulated', slot: 'category', options: [] };
  }
  if (/Courses? for this (?:Requirement|Subject)/i.test(bodyText)) {
    const options = collect(body);
    return {
      status: options.length ? 'articulated' : 'not_articulated',
      slot: 'category',
      options,
    };
  }

  // Case 1: single equivalent — the visible button IS the course, and the
  // dialog body is empty until AJAX fills it, so the dialog must be ignored.
  const options = collect(node);
  return { status: options.length ? 'articulated' : 'unknown', options };
}

/** One `.receiving-course` block -> the university course being required. */
function parseReceivingSide($, node) {
  const holder = node.find('div[data-content-loader-modal-url]').first();
  const label = clean(holder.length ? holder.find('button').first().text() : node.find('button').first().text())
    || clean(node.text());
  const creditsText = clean(node.find('.course-credits').first().text()) || clean(node.text());
  const cm = /(\d+(?:\.\d+)?)\s*credits?/i.exec(creditsText);
  const { code, title } = splitCourseLabel(label);
  // No " - " separator and no modal link means ARTSYS is naming a category
  // ("Humanities Elective", "Arts and Humanities Gen Ed"), not a course.
  const isCategory = !holder.length && title == null;
  return {
    kind: isCategory ? 'category' : 'course',
    code: isCategory ? null : code,
    title: isCategory ? label : title,
    label,
    units: cm ? Number(cm[1]) : null,
    artsys_course_id: idFromModalUrl(holder.attr('data-content-loader-modal-url'), 'course'),
  };
}

/** One `.leaf-item` -> a receiver, or null when the row is not a requirement. */
function parseLeaf($, $leaf) {
  const sender = $leaf.find('> div > .sender-course').first();
  const receiving = $leaf.find('> div > .receiving-course').first();
  if (!sender.length || !receiving.length) return null;
  return { receiving: parseReceivingSide($, receiving), ...parseSenderSide($, sender) };
}

/**
 * Parse a rendered guide.
 *
 * @param {string} html
 * @param {{guideId:number|string}} meta
 * @returns {{guide_id:number, program:string|null, receiving_institution:string|null,
 *            effective:string|null, sender:object|null, senders:object[],
 *            groups:object[], stats:object}}
 */
function parseGuide(html, { guideId } = {}) {
  const $ = cheerio.load(html);
  const header = parseHeader($);
  const groups = [];
  let leafCount = 0;
  let notArticulated = 0;
  let unknown = 0;

  $('li.ptg-requirement-container').each((gi, groupEl) => {
    const $group = $(groupEl);
    const headerText = clean($group.find('.req-header').first().text());
    const rule = parseGroupRule(headerText);
    const sections = [];

    $group.find('.andbranch, .orbranch').each((_, branchEl) => {
      const $branch = $(branchEl);
      // A branch nested inside a dialog belongs to an alternatives popup, not
      // to the requirement tree.
      if ($branch.parents('dialog').length) return;
      const conjunction = ($branch.attr('class') || '').includes('orbranch') ? 'or' : 'and';
      const receivers = [];

      // Branches NEST: ARTSYS expresses "complete A, B, C and one of X/Y/Z" as
      // an orbranch inside an andbranch. Each branch therefore contributes only
      // the leaves it owns directly — a descendant branch is emitted as its own
      // section on the next iteration of this loop. Counting descendants here
      // would both double-count those receivers and, far worse, fold a
      // choose-one alternative set into the required and-branch, inflating
      // section_advisement and manufacturing gaps that do not exist.
      $branch.find('.leaf-item').each((_, leafEl) => {
        const $leaf = $(leafEl);
        if ($leaf.parents('dialog').length) return;
        if ($leaf.parentsUntil($branch).filter('.andbranch, .orbranch').length) return;
        const receiver = parseLeaf($, $leaf);
        if (!receiver) return;
        leafCount += 1;
        if (receiver.status === 'not_articulated') notArticulated += 1;
        if (receiver.status === 'unknown') unknown += 1;
        receivers.push(receiver);
      });

      if (receivers.length) sections.push({ conjunction, receivers });
    });

    // Not every group wraps its leaves in a branch: ARTSYS also renders
    // `leaf-item` directly under `.reqs-container` (often with the `complex`
    // modifier) when a group is a single flat list. Walking branches alone
    // drops those receivers entirely and the group imports empty — the group
    // still shows its "take one course" header, so the loss is invisible
    // without the stated-count cross-check. Collect them as one implicit
    // all-of section.
    const orphans = [];
    $group.find('.leaf-item').each((_, leafEl) => {
      const $leaf = $(leafEl);
      if ($leaf.parents('dialog').length) return;
      if ($leaf.parentsUntil($group).filter('.andbranch, .orbranch').length) return;
      const receiver = parseLeaf($, $leaf);
      if (!receiver) return;
      leafCount += 1;
      if (receiver.status === 'not_articulated') notArticulated += 1;
      if (receiver.status === 'unknown') unknown += 1;
      orphans.push(receiver);
    });
    if (orphans.length) sections.push({ conjunction: 'and', receivers: orphans, implicit: true });

    groups.push({
      index: gi,
      header: headerText,
      rule,
      sections,
    });
  });

  // Semantic cross-check, free from the data: when a header states a course
  // count ("complete the following 11 requirements"), the sections beneath it
  // should be able to supply exactly that many — every leaf of an and-section
  // plus one per or-section. A mismatch means the branch tree was read wrongly,
  // and it is how the nested-branch bug was caught: the same group read 14
  // against a stated 11 until descendant leaves stopped being double-counted.
  // Supply is computed the way the engine will read the group, not the way the
  // markup looks. Two rules matter:
  //   - a group that states its own count does not let its sections cap their
  //     contribution (see transform.js), so every receiver is available to it;
  //   - a category slot ("Gen Ed: Arts & Humanities") is REPEATABLE — one slot
  //     can absorb the whole ask — so it supplies at least the stated count.
  // supply > stated is the ordinary choose-N case ("take 3 from these 5") and
  // is not a defect. Only an under-supply is impossible: a group cannot ask for
  // more requirements than its tree can offer.
  const supplyOf = (g) => {
    const stated = g.rule?.group_advisement;
    if (g.sections.some((s) => s.receivers.some((r) => r.receiving.kind === 'category'))) {
      return Math.max(stated ?? 0, g.sections.reduce((n, s) => n + s.receivers.length, 0));
    }
    if (stated != null) return g.sections.reduce((n, s) => n + s.receivers.length, 0);
    return g.sections.reduce((n, s) => n + (s.conjunction === 'or' ? 1 : s.receivers.length), 0);
  };
  const countMismatches = groups
    .filter((g) => g.rule?.group_advisement != null && supplyOf(g) < g.rule.group_advisement)
    .map((g) => ({
      header: g.header.slice(0, 80),
      stated: g.rule.group_advisement,
      supply: supplyOf(g),
    }));

  return {
    guide_id: Number(guideId) || null,
    ...header,
    sender: parseSelectedSender($),
    senders: parseSenders($),
    groups,
    count_mismatches: countMismatches,
    stats: {
      groups: groups.length,
      sections: groups.reduce((n, g) => n + g.sections.length, 0),
      receivers: leafCount,
      not_articulated: notArticulated,
      unknown_sender_state: unknown,
      unmatched_header: groups.filter((g) => !g.rule.matched).length,
      count_mismatch: countMismatches.length,
    },
  };
}

/**
 * The receiving skeleton of a guide, independent of which college it was
 * rendered for. Two renderings of the same guide MUST produce the same value:
 * only the sending side varies. The importer asserts this across all 16
 * senders, which validates the parse on the whole corpus without anyone
 * reading a document.
 */
function receivingSkeleton(parsed) {
  return JSON.stringify((parsed.groups || []).map((g) => [
    g.header,
    g.sections.map((s) => [s.conjunction, s.receivers.map((r) => r.receiving.label)]),
  ]));
}

module.exports = { parseGuide, receivingSkeleton, parseSenders, idFromModalUrl };
