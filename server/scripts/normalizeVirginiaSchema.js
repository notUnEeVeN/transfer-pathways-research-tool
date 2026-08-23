#!/usr/bin/env node
/**
 * Bring the Virginia curated documents onto the California schema so every
 * analysis service reads one vocabulary instead of branching on `state`.
 *
 * Virginia was imported through its own path (scripts/buildVaDocuments.js,
 * which `insertMany`s straight past the write-path validator in
 * controllers/CanonicalData.js), so its documents describe the same facts in a
 * different shape. Four are normalized here, each measured against the live
 * corpus:
 *
 *   as_degree receivers   CA: receiving null + articulation_status
 *                             'articulated' on 7068/7068
 *                         VA: receiving {code,name} or {kind:'category'},
 *                             articulation_status absent on 366/366
 *   option course_keys    CA: 'cc:<course_id>', mirroring course_ids
 *                         VA: 'va:<CODE>', which the validator rejects
 *   group label           CA: label_seen on 2275/2275
 *                         VA: 0/213, and 135/213 carry no title either
 *   unresolved citations  CA: the key is present on 2275/2275 groups
 *                         VA: absent, so a missing citation is unrecorded
 *
 * Three differences are deliberately NOT normalized here:
 *
 *   advisements       Virginia sets both a course count and a unit floor on
 *                     221/313 sections (California: 4/1952). Rewriting either
 *                     way measured WORSE — see normalizeSection.
 *   GE blocks         California cites GE as an aggregate block; Virginia
 *                     enumerates the same work as named courses. See the note
 *                     on `ge_area` below — Virginia's encoding is the better
 *                     one and stamping it would lose real courses.
 *   template category `scripts/normalizeDegreeCategories.js --state=va` owns
 *                     that taxonomy and proves an unchanged figure
 *                     fingerprint before writing. Run it after this.
 *
 * The transform only re-expresses what the documents already say. It never
 * invents a requirement, a course, or a unit count. Requirements that name no
 * course become `unresolved_courses_seen` entries and graduation rules move to
 * `non_course_requirements_seen`, so nothing is silently discarded. Every
 * edited document is checked against the same predicate the write path
 * enforces before it is written, and a backup of the pre-edit documents is
 * stored in `va_schema_backup`.
 *
 *   node scripts/normalizeVirginiaSchema.js            # dry run, prints a diff
 *   node scripts/normalizeVirginiaSchema.js --apply    # writes
 *   node scripts/normalizeVirginiaSchema.js --apply --state=va
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const RESTORE = process.argv.includes('--restore');
const STATE = (process.argv.find((a) => a.startsWith('--state=')) || '--state=va').split('=')[1];

// Deliberately NOT stamping `ge_area` on Virginia groups.
//
// California's associate degrees cite general education as an aggregate block
// ("IGETC, 37 units"), so `geBlocks` has to credit that capacity wholesale.
// The VCCS transfer degrees enumerate the same work as named courses — ENG
// 111, ENG 112, CST 100, HIS — which already resolve to real course ids and
// articulate individually. Stamping them `ge_area` would delete the courses
// from the named plan and replace them with an assumed block, making Virginia
// LESS accurate than it is now. The audit read "0 GE blocks in Virginia" as a
// missing field; it is a different and better encoding of the same fact.
//
// A requirement Virginia states without any course list is a different case:
// it becomes an `unresolved_courses_seen` entry below, which is how California
// records a citation it could not resolve to a course.

// Requirements that are not coursework at all. These are graduation rules, not
// credits a student earns by taking classes, and Tidewater's document stores
// three of them as 60-unit course pools with no options — which is what made
// the whole college unmodelable. They are removed from requirement_groups and
// recorded on the document so the fact is kept rather than dropped.
const NON_COURSE_REQUIREMENT = /\bGPA\b|residency|grad(uation)?\s*req|degree\s*audit|academic\s*standing/i;

const slug = (value) => String(value || '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);

/** CA's option shape: course_keys mirror course_ids as 'cc:<n>'. */
function normalizeOption(option) {
  const courseIds = [...new Set((option?.course_ids || [])
    .map(Number).filter(Number.isInteger))];
  return {
    course_ids: courseIds,
    course_conjunction: option?.course_conjunction === 'or' ? 'or' : 'and',
    course_keys: courseIds.map((id) => `cc:${id}`),
  };
}

/**
 * CA carries no `receiving` on an associate-degree receiver: the sending
 * course IS the requirement, and the code/name Virginia stores there is
 * already recoverable from the option's course ids. Keep Virginia's own
 * `code_seen` so the ledger still has a printable label.
 */
function normalizeReceiver(receiver) {
  const options = (receiver?.options || []).map(normalizeOption)
    .filter((option) => option.course_ids.length);
  // Virginia leaves `options_conjunction` unset, and several receivers carry
  // more than one option — "MTH264 / MTH245", "SDV100 / SDV101". Those are
  // ALTERNATIVES: importVirginiaCatalogDegrees.js emits one option per code
  // for `conjunction !== 'and'`, and folds a genuine AND into a single option
  // holding every id. So a receiver with several options is an Or, and
  // defaulting it to 'and' would both misdescribe it and disable the unit-pool
  // split in associateNamedSections that depends on this field.
  return {
    receiving: null,
    articulation_status: 'articulated',
    not_articulated_reason: null,
    options,
    options_conjunction: receiver?.options_conjunction
      || (options.length > 1 ? 'or' : 'and'),
    hash_id: receiver?.hash_id ?? null,
    ...(receiver?.code_seen ? { code_seen: receiver.code_seen } : {}),
  };
}

/**
 * Units a section can actually supply from its own resolved courses, mirroring
 * `splitUnitPoolReceivers` in transferCreditRate.js: an Or receiver is split so
 * every alternative becomes spendable, an And receiver contributes its best
 * single option.
 */
function attainableUnits(receivers, unitsById) {
  return receivers.reduce((total, receiver) => {
    const perOption = (receiver.options || []).map((option) => (option.course_ids || [])
      .reduce((sum, id) => sum + (unitsById.get(Number(id)) || 0), 0));
    if (!perOption.length) return total;
    const isOr = (receiver.options_conjunction || 'or').toLowerCase() !== 'and';
    return total + (isOr && perOption.length > 1
      ? perOption.reduce((a, b) => a + b, 0)
      : Math.max(...perOption));
  }, 0);
}

function normalizeSection(section, { unitsById, groupHasUnresolved } = {}) {
  const receivers = (section?.receivers || [])
    .map(normalizeReceiver)
    .filter((receiver) => receiver.options.length);

  // ONE source of truth for credits: the course catalog.
  //
  // A course's credit value is a fact Transfer Virginia publishes per course.
  // A section's `unit_advisement` is a parse of a catalog page's credit
  // annotation, and on four Virginia sections the two disagree — Paul D. Camp
  // asks 4 units for MTH 245, which is a 3-unit course; Richard Bland asks 4
  // for each of PHYS 201 and PHYS 202, both 3-unit. The pool can never close,
  // and the whole college goes blank across all 16 campuses.
  //
  // Where a section's own resolved courses cannot reach its stated ask AND the
  // group records no unresolved citation, the ask is the mis-parsed side:
  // there is no missing course to find, the arithmetic simply does not add up.
  // Clamp to what the courses supply and keep the original for audit.
  //
  // The unresolved test is what keeps this honest. A section short because a
  // cited course never resolved is a DATA GAP and must stay short — clamping
  // it would invent completion out of missing information.
  if (section?.unit_advisement != null && unitsById && !groupHasUnresolved) {
    const reach = attainableUnits(receivers, unitsById);
    const ask = Number(section.unit_advisement);
    if (Number.isFinite(ask) && reach > 0 && reach + 1e-7 < ask) {
      return {
        ...section,
        unit_advisement: reach,
        unit_advisement_seen: ask,
        unit_advisement_clamped_by: 'va_schema_normalization: resolved course credits',
        receivers,
      };
    }
  }
  // Advisements are left EXACTLY as Virginia authored them, including the 221
  // sections that set both a course count and a unit floor.
  //
  // Two rules were tried and measured against the live corpus, and both made
  // Virginia worse. Clearing the unit floor wherever a count existed moved 221
  // sections into the choose-N branch, over-selected past the 60-unit degree
  // total, and cut computed cells from 252 to 115. Clearing it only where the
  // count asks for fewer than the receivers offer — a genuine choice — still
  // cost 40 cells (252 -> 212).
  //
  // The reason is that `section_advisement` is usually synthetic here:
  // importVirginiaCatalogDegrees.js writes
  //   explicitCount ?? (parsed.credits ? null : Math.max(1, receivers.length))
  // so on an all-required block it merely restates the receiver count, while
  // the unit floor is the number the catalog actually printed. The unit branch
  // winning is therefore the RIGHT default for this corpus.
  //
  // Known, measured limitation: four Virginia sections state a real choose-N
  // that the unit branch shadows. Four sections is not worth 40 cells, and the
  // fix belongs in the importer — emitting only the advisement the catalog
  // states — not in a rewrite of documents that already parse correctly.
  return { ...section, receivers };
}

/**
 * Virginia leaves `title` null on 135 of 213 groups because the catalog row IS
 * the course: the code lives on `receiving.code` ("MTH264 / MTH245"). Recover
 * the label from the receivers rather than writing "(unlabelled)".
 */
function labelFor(group) {
  if (group?.label_seen) return group.label_seen;
  if (group?.title) return group.title;
  const codes = (group?.sections || []).flatMap((section) => (section.receivers || [])
    .map((receiver) => receiver.code_seen || receiver.receiving?.code || receiver.receiving?.name)
    .filter(Boolean));
  return codes.length ? [...new Set(codes)].join(' + ') : null;
}

/**
 * A Virginia receiver shaped `receiving:{kind:'category', units:N}` with an
 * empty option list is a requirement whose course menu was never resolved —
 * "CSC 215, 3 credits" with no course behind it. California records exactly
 * that in `unresolved_courses_seen`, and its planner then leaves the section
 * short rather than pretending the requirement is met.
 *
 * California's `units_fill` is NOT the right home: those groups carry no
 * sections at all and mean "whatever is left to reach 60", not a stated count.
 *
 * Routing these to `unresolved_courses_seen` also populates the channel the
 * corpus is missing — Virginia currently reports 0 unresolved citations across
 * 304 courses, which is what CS's 0 extraction warnings turned out to be.
 */
function unresolvedFromReceiver(receiver, label) {
  const units = Number(receiver?.receiving?.units);
  return {
    course_code_seen: receiver?.code_seen || receiver?.receiving?.code || label || null,
    title_seen: receiver?.receiving?.name || null,
    units_seen: Number.isFinite(units) && units > 0 ? units : null,
    source: 'va_schema_normalization',
  };
}

// A group whose own label says "or" but whose alternatives were emitted as
// separate sections. `projectGroups` in scripts/va/buildVaDocuments.js writes
// `group_conjunction: 'And'` unconditionally, and sections inside a group are
// ANDed, so "CHM111 or PHY 241" demands BOTH courses. Virginia Western asks 71
// units against a 60-unit degree for exactly this reason, on three groups
// (4 + 3 + 4 = 11 excess), and the whole college goes blank.
//
// Collapsed to what the label says: one section, choose one, alternatives as
// options on a single receiver. `unit_advisement` is cleared because the ask
// is now a course count — leaving it would send this back through the unit
// planner, which spends one option per receiver and would re-inflate it.
const LABEL_SAYS_OR = /\bor\b/i;

function collapseLabeledOrGroup(group) {
  const sections = group?.sections || [];
  if (sections.length < 2) return group;
  if (!LABEL_SAYS_OR.test(String(group.label_seen || group.title || ''))) return group;
  // Only when every section is a single alternative. A group mixing a real
  // sequence with an either/or is not something a label can disambiguate.
  if (!sections.every((section) => (section.receivers || []).length === 1)) return group;
  const options = sections.flatMap((section) => (section.receivers || [])
    .flatMap((receiver) => receiver.options || []));
  if (options.length < 2) return group;
  const first = sections[0].receivers[0];
  return {
    ...group,
    group_or_collapsed_from: sections.length,
    sections: [{
      ...sections[0],
      section_advisement: 1,
      unit_advisement: null,
      receivers: [{ ...first, options, options_conjunction: 'or' }],
    }],
  };
}

function normalizeGroup(rawGroup, unitsById) {
  const group = collapseLabeledOrGroup(rawGroup);
  const label = labelFor(group);
  const carried = Array.isArray(group?.unresolved_courses_seen)
    ? [...group.unresolved_courses_seen] : [];
  const sections = [];
  for (const section of group?.sections || []) {
    const kept = [];
    for (const receiver of section.receivers || []) {
      const hasCourses = (receiver.options || []).some((o) => (o.course_ids || []).length);
      if (hasCourses) kept.push(receiver);
      else carried.push(unresolvedFromReceiver(receiver, label));
    }
    const next = normalizeSection({ ...section, receivers: kept }, {
      unitsById,
      // Evaluated against the citations the group carries INCLUDING the ones
      // this pass just moved out of the receivers, so a section emptied of a
      // course here can never be clamped into looking complete.
      groupHasUnresolved: carried.length > 0,
    });
    if (next.receivers.length) sections.push(next);
  }
  return {
    ...group,
    group_id: group?.group_id || slug(label) || null,
    label_seen: label,
    unresolved_courses_seen: carried,
    ge_area: group?.ge_area ?? null,
    units_fill: group?.units_fill === true,
    sections,
  };
}

/**
 * The predicate the write path enforces, applied here so a normalized document
 * cannot be written in a shape the API would reject.
 */
function asDegreeError(doc) {
  const groups = doc.requirement_groups;
  if (!Array.isArray(groups) || !groups.length) return 'requirement_groups must be a non-empty array';
  for (const g of groups) {
    const gid = g?.group_id || g?.label_seen || '(unlabelled)';
    if (!Array.isArray(g.sections) || !g.sections.length) return `group ${gid}: sections must be a non-empty array`;
    for (const s of g.sections) {
      for (const key of ['section_advisement', 'unit_advisement']) {
        if (s[key] != null && (!Number.isFinite(s[key]) || s[key] <= 0)) {
          return `group ${gid}: ${key} must be null or a positive number`;
        }
      }
      if (!Array.isArray(s.receivers)) return `group ${gid}: each section needs a receivers array`;
      if (g.ge_area == null && !s.receivers.length) return `group ${gid}: a non-ge_area section must list at least one receiver`;
      for (const r of s.receivers) {
        if (r.receiving != null) return `group ${gid}: receiving must be null on as_degree receivers`;
        if (r.articulation_status !== 'articulated') return `group ${gid}: articulation_status must be 'articulated'`;
        if (!Array.isArray(r.options) || !r.options.length) return `group ${gid}: each receiver needs at least one option`;
        for (const o of r.options) {
          if (!Array.isArray(o.course_ids) || !o.course_ids.length
              || o.course_ids.some((id) => !Number.isInteger(id))) {
            return `group ${gid}: option course_ids must be a non-empty array of Numbers`;
          }
          if (!Array.isArray(o.course_keys) || o.course_keys.length !== o.course_ids.length
              || o.course_keys.some((k, i) => k !== `cc:${o.course_ids[i]}`)) {
            return `group ${gid}: course_keys must mirror course_ids as 'cc:<n>'`;
          }
        }
      }
    }
  }
  return null;
}

(async () => {
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const db = client.db(process.env.DB_NAME || 'pmt_research');
  const collection = db.collection('curated_requirements');
  try {
    // Normalizing an already-normalized document is not idempotent for the
    // advisement rule (the receiver count it keys off can already have moved),
    // so a re-run always starts from the earliest pre-edit copy.
    if (RESTORE) {
      const backup = await db.collection('va_schema_backup')
        .find({ state: STATE }).sort({ created_at: 1 }).limit(1).next();
      if (!backup) throw new Error('no backup to restore from');
      for (const doc of [...(backup.as_degree || []), ...(backup.degree || [])]) {
        await collection.replaceOne({ _id: doc._id }, doc, { upsert: false });
      }
      console.log(`restored ${(backup.as_degree || []).length + (backup.degree || []).length} documents from ${backup.created_at}`);
      return;
    }

    const degrees = await collection.find({ kind: 'as_degree', state: STATE }).toArray();
    // Course credits are the authority for the clamp in normalizeSection.
    const citedIds = [...new Set(degrees.flatMap((doc) => (doc.requirement_groups || [])
      .flatMap((g) => (g.sections || [])
        .flatMap((sec) => (sec.receivers || [])
          .flatMap((r) => (r.options || [])
            .flatMap((o) => (o.course_ids || []).map(Number)))))))];
    const unitsById = new Map((await db.collection('assist_courses')
      .find({ side: 'sending', course_id: { $in: citedIds } },
        { projection: { course_id: 1, units: 1, _id: 0 } }).toArray())
      .map((row) => [Number(row.course_id), Number(row.units) || 0]));
    const templates = await collection.find({ kind: 'degree', state: STATE }).toArray();
    console.log(`${STATE}: ${degrees.length} associate degrees, ${templates.length} bachelor templates`);
    console.log(APPLY ? '\n*** APPLYING ***\n' : '\n(dry run — pass --apply to write)\n');

    const before = { recvNull: 0, articulated: 0, ccKeys: 0, labels: 0, unresKey: 0, ge: 0, both: 0, recv: 0, groups: 0, sections: 0 };
    const after = { ...before };
    const tally = (docs, bucket) => {
      for (const d of docs) for (const g of d.requirement_groups || []) {
        bucket.groups++;
        if (g.label_seen) bucket.labels++;
        if (Array.isArray(g.unresolved_courses_seen)) bucket.unresKey++;
        if (g.ge_area) bucket.ge++;
        for (const s of g.sections || []) {
          bucket.sections++;
          if (s.section_advisement != null && s.unit_advisement != null) bucket.both++;
          for (const r of s.receivers || []) {
            bucket.recv++;
            if (r.receiving === null) bucket.recvNull++;
            if (r.articulation_status === 'articulated') bucket.articulated++;
            if ((r.options || []).every((o) => (o.course_keys || [])
              .every((k, i) => k === `cc:${(o.course_ids || [])[i]}`))) bucket.ccKeys++;
          }
        }
      }
    };
    tally(degrees, before);

    const normalized = [];
    const failures = [];
    let droppedRules = 0;
    let carriedUnresolved = 0;
    for (const doc of degrees) {
      // Graduation rules are not coursework. Tidewater stores three of them as
      // 60-unit pools with no courses, which is what made the whole college
      // unmodelable. Keep the fact on the document, out of the credit model.
      const rules = [];
      const kept = [];
      for (const group of doc.requirement_groups || []) {
        const label = labelFor(group);
        if (NON_COURSE_REQUIREMENT.test(String(label || ''))) {
          rules.push({ label_seen: label, source: 'va_schema_normalization' });
          continue;
        }
        kept.push(normalizeGroup(group, unitsById));
      }
      droppedRules += rules.length;
      const groups = kept.filter((group) => group.sections.length
        || (group.unresolved_courses_seen || []).length);
      carriedUnresolved += groups.reduce((t, g) => t + (g.unresolved_courses_seen || []).length, 0);
      const next = {
        ...doc,
        requirement_groups: groups,
        ...(rules.length ? { non_course_requirements_seen: rules } : {}),
      };
      // A group kept only to carry an unresolved citation has no sections, so
      // exclude it from the shape check the write path applies to real groups.
      const checkable = { ...next, requirement_groups: groups.filter((g) => g.sections.length) };
      const error = checkable.requirement_groups.length ? asDegreeError(checkable) : null;
      if (error) failures.push({ id: doc._id, error });
      else normalized.push(next);
      if (!checkable.requirement_groups.length) {
        console.log(`  note: ${doc._id} models no coursework at all — every group was a graduation rule or an unresolved citation`);
      }
    }
    tally(normalized, after);

    const row = (label, b, a, total) => console.log(`  ${label.padEnd(34)} ${String(b).padStart(5)}  ->  ${String(a).padStart(5)}   of ${total}`);
    console.log('associate degrees:');
    row('receivers with receiving:null', before.recvNull, after.recvNull, after.recv);
    row("articulation_status 'articulated'", before.articulated, after.articulated, after.recv);
    row("course_keys as 'cc:<n>'", before.ccKeys, after.ccKeys, after.recv);
    row('groups with label_seen', before.labels, after.labels, after.groups);
    row('groups with unresolved key', before.unresKey, after.unresKey, after.groups);
    row('sections with BOTH advisements', before.both, after.both, after.sections);
    console.log('    (left as authored — see normalizeSection; measured better than either rewrite)');
    console.log(`  ${'graduation rules moved out'.padEnd(34)} ${String(droppedRules).padStart(5)}`);
    console.log(`  ${'unresolved citations recorded'.padEnd(34)} ${String(carriedUnresolved).padStart(5)}   (was 0)`);
    console.log('  ge_area: deliberately not stamped — Virginia enumerates GE as named courses');

    if (failures.length) {
      console.log(`\n${failures.length} document(s) still fail the write-path validator:`);
      failures.slice(0, 10).forEach((f) => console.log(`   ${f.id}: ${f.error}`));
    } else {
      console.log('\nall normalized documents pass the write-path validator');
    }

    // Bachelor templates are NOT stamped here. `scripts/normalizeDegreeCategories.js`
    // owns that taxonomy, derives it from the same degreeSlots predicates the
    // figures use, and proves both an additive-only edit and an unchanged
    // figure fingerprint before it writes. Duplicating the classifier here
    // would be the second source of truth that script exists to prevent.
    const missingSource = templates.filter((d) => !d.source).length;
    const unstamped = templates.reduce((t, d) => t + (d.requirement_groups || [])
      .reduce((s, g) => s + (g.sections || []).filter((x) => !x.category).length, 0), 0);
    console.log('\nbachelor templates (handled elsewhere):');
    console.log(`  ${String(unstamped).padStart(5)} sections need a category  ->  node scripts/normalizeDegreeCategories.js --state=${STATE} --apply`);
    console.log(`  ${String(missingSource).padStart(5)} templates missing \`source\` — provenance is a claim, not a transform; set it where the catalog is known`);

    if (!APPLY) {
      console.log('\nno writes performed');
      return;
    }
    if (failures.length) {
      console.log('\nrefusing to write while any document fails validation');
      process.exitCode = 1;
      return;
    }
    const stamp = new Date().toISOString();
    await db.collection('va_schema_backup').insertOne({
      created_at: stamp, state: STATE,
      as_degree: degrees, degree: templates,
    });
    let written = 0;
    for (const doc of normalized) {
      await collection.replaceOne({ _id: doc._id },
        { ...doc, schema_normalized_at: stamp }, { upsert: false });
      written++;
    }
    console.log(`\nwrote ${written} associate-degree documents; pre-edit copies of both kinds in va_schema_backup (${stamp})`);
    console.log(`next: node scripts/normalizeDegreeCategories.js --state=${STATE} --apply`);
  } finally {
    await client.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
