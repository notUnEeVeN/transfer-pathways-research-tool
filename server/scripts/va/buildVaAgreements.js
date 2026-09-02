#!/usr/bin/env node
/**
 * Derive Virginia per-pair transfer agreements.
 *
 * California gets agreements from ASSIST and Massachusetts got them from the
 * paper's workbooks. Virginia publishes the two halves separately and never
 * joins them:
 *
 *   va_courses      — each VCCS course, which colleges offer it (`offered_by`)
 *                     and what it lands as at each four-year (`articulates_to`)
 *   va_requirements — what each four-year's CS degree requires (`code_seen`
 *                     per receiver), already tiered by the collection pipeline
 *
 * The join across them is the agreement: for a (community college × four-year)
 * pair, a requirement is articulated when some course the college offers lands
 * as the course that requirement names. Output is written to
 * `assist_agreements` with `state: 'va'`, in the same shape the California
 * engine already reads, so every figure runs unmodified.
 *
 * Two rules carry the accuracy of the result:
 *
 * 1. **Generic credit never satisfies a named requirement.** Virginia records
 *    roughly a quarter of its articulations as unspecified elective credit
 *    ("SOC268 lands as SOCY2XX — Sociology Transfer Elective"). That credit
 *    transfers but does not fill a named slot; `vaCourseCodes.satisfies`
 *    enforces the asymmetry.
 * 2. **Every match is consumed.** A college can offer several courses fitting
 *    one generic band and a degree can repeat an elective slot, so matching by
 *    membership would credit one course to many slots. Supply is a multiset and
 *    each entry is spent once.
 *
 * Named requirements are matched before generic ones, so a course that can fill
 * a specific slot is never spent on an elective slot first — the same
 * best-case-student reading the California credit-rate figure documents.
 *
 *   node scripts/va/buildVaAgreements.js            # report only
 *
 * Agreement publication is intentionally available only through
 * `buildVaDocuments.js`, whose all-target transaction, rollback snapshot, and
 * publication preflight prevent this derived channel from drifting alone.
 */
const path = require('node:path');
const { createHash } = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const { parseCourseCode, satisfies } = require('../../services/vaCourseCodes');
const {
  canonicalCourseCode,
  parentIdForLanding,
  projectInstitutionReceivingGroups,
} = require('../../services/virginia/courseIdentity');
const {
  requireInstitutionIdentity,
} = require('../../services/virginia/institutionIds');
const {
  exactVirginiaTechTree,
} = require('../../services/analysis/virginiaTechConstraintProofs');
const {
  VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX,
  VIRGINIA_TECH_CSC_PAIR_OPTION_FIELD,
  VIRGINIA_TECH_CSC_PAIR_RECEIVER_INDEX,
  VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER,
  VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID,
  VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX,
  atomicOptionReceipt,
  claimsVirginiaTechBachelor,
  exactVirginiaTechPairEntries,
} = require('../../services/analysis/virginiaTechAtomicArticulation');

/** Reserved numeric id blocks; California uses 2–200 and Massachusetts 9001–9115. */
const VA_UNIVERSITY_BASE = 9201;
const VA_COLLEGE_BASE = 9301;

const slugify = (value) => String(value ?? '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A receiver demands one or more codes; a series demands all of its parts. */
function demandedCodes(receiver) {
  const seen = String(receiver?.code_seen ?? '').trim();
  if (seen) return seen.split(/\s*\+\s*|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  const name = receiver?.receiving?.name;
  return name ? [String(name).trim()] : [];
}

/**
 * A receiver is generic when it names no specific course — a category, a GE
 * area, or a free-text requirement. Generic receivers are the only ones
 * Virginia's unspecified elective credit can fill.
 */
function isGenericReceiver(receiver) {
  const kind = receiver?.receiving?.kind;
  if (kind === 'category' || kind === 'ge_area' || kind === 'requirement') return true;
  const codes = demandedCodes(receiver);
  if (!codes.length) return true;
  return codes.every((code) => parseCourseCode(code).kind !== 'concrete');
}

/**
 * Preserve every concrete incoming equivalency independently of the bachelor
 * requirement tree. Open category receivers cannot carry a course parent id,
 * but exact source-bound evaluators still need the real per-college supply
 * edge after the Virginia projection is rebuilt.
 *
 * The canonical id is derived through the same identifier-plus-landing-name
 * contract as the course importer, so concrete-looking transfer-elective
 * buckets cannot be resurrected as named courses. A supplied parent id is
 * corroborating data: explicit null or disagreement removes the edge from
 * this exact channel so downstream rules fail closed.
 */
function concreteSourceEquivalencies(entries) {
  const rows = [];
  for (const entry of entries || []) {
    const sendingCourseId = Number(entry?.course_id);
    const sendingCode = canonicalCourseCode(entry?.code);
    const sendingCourseKey = String(entry?.course_key || '').trim();
    const receivingIdentifier = canonicalCourseCode(entry?.identifier);
    const receivingName = String(entry?.receiving_name || '').trim();
    const sourceUrl = String(entry?.source_url || '').trim();
    const receivingNotes = entry?.receiving_notes == null
      ? null : String(entry.receiving_notes).trim();
    const receivingParentId = parentIdForLanding({
      identifier: receivingIdentifier,
      name: receivingName,
    });
    const suppliedParentId = entry?.receiving_parent_id;
    if (!Number.isInteger(sendingCourseId) || !sendingCode || !sendingCourseKey
        || !receivingName || !sourceUrl
        || entry?.receiving_notes_supplied !== true
        || parseCourseCode(sendingCode).kind !== 'concrete'
        || parseCourseCode(receivingIdentifier).kind !== 'concrete'
        || receivingParentId == null
        || (entry?.receiving_parent_id_supplied === true
          && (suppliedParentId == null
            || Number(suppliedParentId) !== receivingParentId))) continue;
    const row = {
      sending_course_id: sendingCourseId,
      sending_course_key: sendingCourseKey,
      sending_code: sendingCode,
      receiving_identifier: receivingIdentifier,
      receiving_name: receivingName,
      receiving_notes: receivingNotes,
      receiving_parent_id: receivingParentId,
      sending_source_url: sourceUrl || null,
    };
    rows.push(row);
  }
  return rows.sort((left, right) => (
    left.sending_course_id - right.sending_course_id
      || left.receiving_parent_id - right.receiving_parent_id
      || left.sending_course_key.localeCompare(right.sending_course_key)
      || left.sending_code.localeCompare(right.sending_code)
      || left.receiving_identifier.localeCompare(right.receiving_identifier)
      || String(left.receiving_name || '').localeCompare(String(right.receiving_name || ''))
      || String(left.receiving_notes || '').localeCompare(String(right.receiving_notes || ''))
      || String(left.sending_source_url || '').localeCompare(String(right.sending_source_url || ''))
  ));
}

function sourceEquivalenciesSha256(rows) {
  return createHash('sha256').update(JSON.stringify(rows || [])).digest('hex');
}

const SELECTED_EQUIVALENCIES_CONTRACT = 'va-selected-supply-edge-v1';
const SOURCE_NAMED_OFFERING_CONTRACT = 'va-associate-requirement-course-offer-v1';

function selectedSourceEquivalency(entry, {
  groupIndex, sectionIndex, receiverIndex, optionIndex = 0, demandIndex,
}) {
  return {
    requirement_group_index: groupIndex,
    section_index: sectionIndex,
    receiver_index: receiverIndex,
    option_index: optionIndex,
    demand_index: demandIndex,
    sending_course_id: Number(entry.course_id),
    sending_course_key: String(entry.course_key || '').trim(),
    sending_code: canonicalCourseCode(entry.code),
    source_receiving_identifier: String(entry.identifier || '').trim(),
    source_receiving_name: entry.receiving_name == null
      ? null : String(entry.receiving_name).trim(),
    source_receiving_notes_supplied: entry.receiving_notes_supplied === true,
    source_receiving_notes: entry.receiving_notes == null
      ? null : String(entry.receiving_notes).trim(),
    source_receiving_parent_id_supplied: entry.receiving_parent_id_supplied === true,
    source_receiving_parent_id: entry.receiving_parent_id == null
      ? null : Number(entry.receiving_parent_id),
    sending_source_url: entry.source_url == null ? null : String(entry.source_url).trim(),
  };
}

function selectedSourceEquivalencySort(left, right) {
  return left.requirement_group_index - right.requirement_group_index
    || left.section_index - right.section_index
    || left.receiver_index - right.receiver_index
    || left.option_index - right.option_index
    || left.demand_index - right.demand_index
    || left.sending_course_id - right.sending_course_id
    || String(left.sending_course_key || '').localeCompare(String(right.sending_course_key || ''))
    || String(left.source_receiving_identifier || '')
      .localeCompare(String(right.source_receiving_identifier || ''))
    || String(left.source_receiving_name || '').localeCompare(String(right.source_receiving_name || ''))
    || String(left.source_receiving_notes || '').localeCompare(String(right.source_receiving_notes || ''))
    || String(left.sending_source_url || '').localeCompare(String(right.sending_source_url || ''));
}

function selectedEquivalenciesSha256(rows) {
  return createHash('sha256').update(JSON.stringify(rows || [])).digest('hex');
}

function sourceNamedOfferingReceipts(entries) {
  const byIdentity = new Map();
  for (const entry of entries || []) {
    for (const receipt of entry?.source_named_offering_receipts || []) {
      const normalized = {
        contract: SOURCE_NAMED_OFFERING_CONTRACT,
        source_requirement_id: String(receipt?.source_requirement_id || ''),
        community_college_id: Number(receipt?.community_college_id),
        college_name: String(receipt?.college_name || ''),
        course_id: Number(receipt?.course_id),
        course_key: String(receipt?.course_key || ''),
        code: canonicalCourseCode(receipt?.code),
        source_refs: [...new Set(receipt?.source_refs || [])].map(String).sort(),
      };
      if (!normalized.source_requirement_id
          || !Number.isInteger(normalized.community_college_id)
          || !normalized.college_name || !Number.isInteger(normalized.course_id)
          || !normalized.course_key || !normalized.code) continue;
      const key = JSON.stringify(normalized);
      byIdentity.set(key, normalized);
    }
  }
  return [...byIdentity.values()].sort((left, right) => (
    left.community_college_id - right.community_college_id
      || left.course_id - right.course_id
      || left.source_requirement_id.localeCompare(right.source_requirement_id)
  ));
}

/**
 * Build one agreement's requirement groups.
 *
 * `supply` is the college's articulated identifiers at this four-year, each
 * `{ identifier, course_id, course_key, code }`. Returns the rebuilt groups
 * plus the tallies the report prints.
 */
function articulateGroups(degree, supply, { receivingOwner = null } = {}) {
  const pool = supply.map((entry) => ({ entry, used: false }));
  const claim = (codes) => {
    // A series needs every part, and each part spends its own supply row.
    const spent = [];
    for (const code of codes) {
      const row = pool.find((candidate) => !candidate.used && !spent.includes(candidate)
        && satisfies(code, candidate.entry.identifier));
      if (!row) return null;
      spent.push(row);
    }
    spent.forEach((row) => { row.used = true; });
    return spent.map((row) => row.entry);
  };

  // Index every receiver once, then resolve named demands before generic ones
  // so a specific course is not spent filling an elective slot.
  const slots = [];
  const groups = (degree.requirement_groups || []).map((group, groupIndex) => ({
    ...group,
    sections: (group.sections || []).map((section, sectionIndex) => ({
      ...section,
      receivers: (section.receivers || []).map((receiver, receiverIndex) => {
        const slot = {
          receiver,
          section,
          groupIndex,
          sectionIndex,
          receiverIndex,
          generic: isGenericReceiver(receiver),
          codes: demandedCodes(receiver),
          matched: null,
          sourceBoundAtomicArticulation: null,
        };
        slots.push(slot);
        return slot;
      }),
    })),
  }));

  // Transfer Virginia publishes CSC 205 and CSC 215 as two observations of
  // one compound Virginia Tech award. A normal one-demand match would let
  // either half claim CS 2505. Guard every CS 2505 slot on the exact VT source
  // identity, then open only the reviewed source-tree path with both exact
  // three-credit edges present. Tree or edge drift therefore removes the
  // articulation instead of falling back to the ordinary matcher.
  const claimsVirginiaTech = claimsVirginiaTechBachelor(degree);
  const exactVirginiaTech = claimsVirginiaTech ? exactVirginiaTechTree(degree) : null;
  for (const slot of slots) {
    const guardsVirginiaTechPair = claimsVirginiaTech
      && slot.codes.length === 1
      && slot.codes[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase()
        === VIRGINIA_TECH_CSC_PAIR_RECEIVING_IDENTIFIER;
    if (!guardsVirginiaTechPair) continue;
    slot.sourceBoundAtomicArticulation = { guarded: true, ready: false };
    const exactPath = slot.groupIndex === VIRGINIA_TECH_CSC_PAIR_GROUP_INDEX
      && slot.sectionIndex === VIRGINIA_TECH_CSC_PAIR_SECTION_INDEX
      && slot.receiverIndex === VIRGINIA_TECH_CSC_PAIR_RECEIVER_INDEX
      && Number(slot.receiver?.receiving?.parent_id)
        === VIRGINIA_TECH_CSC_PAIR_RECEIVING_PARENT_ID;
    if (!exactVirginiaTech?.supported || !exactPath) continue;
    const exactPair = exactVirginiaTechPairEntries(pool.map((row) => row.entry));
    if (!exactPair.ready) continue;
    const rows = exactPair.entries.map((entry) => pool.find((row) => row.entry === entry));
    if (rows.some((row) => !row || row.used)) continue;
    rows.forEach((row) => { row.used = true; });
    slot.matched = exactPair.entries;
    slot.sourceBoundAtomicArticulation = { guarded: true, ready: true };
  }

  for (const generic of [false, true]) {
    for (const slot of slots) {
      if (slot.generic !== generic || slot.matched || !slot.codes.length) continue;
      if (slot.sourceBoundAtomicArticulation?.guarded) continue;
      // The collection pipeline already decided which requirements a community
      // college could ever satisfy; upper-division residency work is excluded
      // at the source rather than by our matcher.
      if (slot.section?.cc_articulable === false) continue;
      slot.matched = claim(slot.codes);
    }
  }

  let articulated = 0; let considered = 0;
  const selectedEquivalencies = [];
  const rebuilt = groups.map((group) => ({
    ...group,
    sections: group.sections.map((section) => ({
      ...section,
      receivers: section.receivers.map((slot) => {
        const { receiver, matched } = slot;
        if (slot.section?.cc_articulable !== false && slot.codes.length) considered += 1;
        if (matched) {
          articulated += 1;
          selectedEquivalencies.push(...matched.map((entry, demandIndex) => selectedSourceEquivalency(
            entry,
            {
              groupIndex: slot.groupIndex,
              sectionIndex: slot.sectionIndex,
              receiverIndex: slot.receiverIndex,
              demandIndex,
            },
          )));
        }
        return {
          ...receiver,
          articulation_status: matched ? 'articulated' : 'not_articulated',
          options: matched
            ? [{
              course_ids: matched.map((entry) => entry.course_id).filter((id) => id != null),
              course_keys: matched.map((entry) => entry.course_key).filter(Boolean),
              course_conjunction: 'and',
              ...(slot.sourceBoundAtomicArticulation?.ready ? {
                [VIRGINIA_TECH_CSC_PAIR_OPTION_FIELD]: atomicOptionReceipt(),
              } : {}),
            }]
            : [],
        };
      }),
    })),
  }));
  selectedEquivalencies.sort(selectedSourceEquivalencySort);
  return {
    groups: receivingOwner
      ? projectInstitutionReceivingGroups(rebuilt, receivingOwner)
      : rebuilt,
    articulated,
    considered,
    selectedEquivalencies,
  };
}

/**
 * Derive every (college × four-year) agreement.
 *
 * `courses` are va_courses documents, `degrees` the extracted four-year degree
 * documents, `colleges`/`universities` the institution rows.
 */
function deriveVaAgreements({ courses, degrees, colleges, universities }) {
  // Key institutions on their own document id, not on a slug of their display
  // name: "William & Mary" slugs to `william-and-mary` while its id and the
  // degree that points at it both say `william-mary`.
  const idSlug = (row) => String(row._id ?? '').replace(/^va:(inst|uni|cc):/, '');
  const collegeIdBySlug = new Map(colleges.map((row) => {
    const slug = idSlug(row);
    return [slug, requireInstitutionIdentity(slug, 'community_college').id];
  }));
  const collegeNameBySlug = new Map(colleges.map((row) => [idSlug(row), row.name]));
  const collegeSlugByName = new Map(colleges.map((row) => [slugify(row.name), idSlug(row)]));
  const universityBySlug = new Map(universities.map((row) => {
    const slug = idSlug(row);
    return [slug, {
      numericId: requireInstitutionIdentity(slug, 'four_year').id,
      name: row.name,
    }];
  }));
  const universitySlugByName = new Map(universities.map((row) => [slugify(row.name), idSlug(row)]));

  // supply[collegeSlug][universitySlug] = articulated identifiers
  const supply = new Map();
  for (const course of courses) {
    // `offered_by` and `articulates_to[].institution` are display names, so they
    // resolve through the name index back to the document id.
    const offered = (course.offered_by || [])
      .map((name) => collegeSlugByName.get(slugify(name)))
      .filter(Boolean);
    if (!offered.length) continue;
    for (const edge of course.articulates_to || []) {
      const uniSlug = universitySlugByName.get(slugify(edge.institution));
      if (!uniSlug || !universityBySlug.has(uniSlug)) continue;
      const entry = {
        identifier: edge.identifier,
        receiving_name: edge.name ?? null,
        receiving_notes_supplied: Object.prototype.hasOwnProperty.call(edge, 'notes'),
        receiving_notes: edge.notes ?? null,
        receiving_parent_id_supplied: Object.prototype.hasOwnProperty.call(edge, 'parent_id'),
        receiving_parent_id: edge.parent_id ?? null,
        source_url: course.source_url ?? null,
        units: course.credits ?? course.units ?? null,
        course_id: course.course_id,
        course_key: course.course_key,
        code: course.code,
      };
      for (const collegeSlug of offered) {
        const communityCollegeId = collegeIdBySlug.get(collegeSlug);
        const sourceNamedReceipts = (course.source_named_offering_receipts || [])
          .filter((receipt) => (
            Number(receipt?.community_college_id) === Number(communityCollegeId)
          ));
        if (!supply.has(collegeSlug)) supply.set(collegeSlug, new Map());
        const byUni = supply.get(collegeSlug);
        if (!byUni.has(uniSlug)) byUni.set(uniSlug, []);
        byUni.get(uniSlug).push({
          ...entry,
          ...(sourceNamedReceipts.length ? {
            source_named_offering_receipts: sourceNamedReceipts,
          } : {}),
        });
      }
    }
  }

  const agreements = [];
  const withoutEquivalencies = [];
  for (const degree of degrees) {
    const uniSlug = String(degree.institution_id || '').replace(/^va:(uni|inst):/, '');
    const university = universityBySlug.get(uniSlug);
    if (!university) {
      withoutEquivalencies.push({ degree_id: degree._id, reason: 'no institution record' });
      continue;
    }
    // A four-year that publishes no equivalencies at all (the University of
    // Virginia and Virginia Military Institute do not) has requirements but no
    // articulation evidence. Emitting zeroes would read as "nothing transfers"
    // when the truth is "nothing is published" — leave the pair out and say so.
    const anySupply = [...collegeIdBySlug.keys()].some((slug) => (supply.get(slug)?.get(uniSlug) || []).length);
    if (!anySupply) {
      withoutEquivalencies.push({ degree_id: degree._id, reason: 'no published course equivalencies' });
      continue;
    }
    for (const [collegeSlug, numericId] of collegeIdBySlug) {
      const entries = supply.get(collegeSlug)?.get(uniSlug) || [];
      const {
        groups, articulated, considered, selectedEquivalencies,
      } = articulateGroups(degree, entries, {
        receivingOwner: `va:uni:${university.numericId}`,
      });
      const sourceEquivalencies = concreteSourceEquivalencies(entries);
      const offeringReceipts = sourceNamedOfferingReceipts(entries);
      agreements.push({
        _id: `va:agreement:${university.numericId}:${numericId}`,
        university_id: `va:uni:${uniSlug}`,
        college_id: `va:cc:${collegeSlug}`,
        uc_school_id: university.numericId,
        community_college_id: numericId,
        university_name: university.name,
        college_name: collegeNameBySlug.get(collegeSlug),
        major: 'Computer Science, B.S.',
        state: 'va',
        source: 'derived from Transfer Virginia course equivalencies × published degree requirements',
        pairing: 'course-equivalency-join',
        derived_from: { degree_id: degree._id, supply_edges: entries.length },
        articulated_receivers: articulated,
        considered_receivers: considered,
        source_equivalencies_contract: 'va-concrete-supply-edge-v2',
        source_equivalencies_count: sourceEquivalencies.length,
        source_equivalencies_sha256: sourceEquivalenciesSha256(sourceEquivalencies),
        source_equivalencies: sourceEquivalencies,
        selected_equivalencies_contract: SELECTED_EQUIVALENCIES_CONTRACT,
        selected_equivalencies_count: selectedEquivalencies.length,
        selected_equivalencies_sha256: selectedEquivalenciesSha256(selectedEquivalencies),
        selected_equivalencies: selectedEquivalencies,
        source_named_offerings_contract: SOURCE_NAMED_OFFERING_CONTRACT,
        source_named_offerings_count: offeringReceipts.length,
        source_named_offerings_sha256: sourceEquivalenciesSha256(offeringReceipts),
        source_named_offerings: offeringReceipts,
        requirement_groups: groups,
      });
    }
  }
  agreements.withoutEquivalencies = withoutEquivalencies;
  return agreements;
}

function assertDryRunOnly(argv = process.argv.slice(2)) {
  if (argv.includes('--apply')) {
    throw new Error(
      'standalone Virginia agreement writes are disabled; publish all projection targets through scripts/va/buildVaDocuments.js --apply',
    );
  }
  if (argv.length) throw new Error(`unknown option(s): ${argv.join(', ')}`);
}

async function main() {
  assertDryRunOnly();
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const [courses, degrees, institutions] = await Promise.all([
    db.collection('va_courses').find({}).toArray(),
    db.collection('va_requirements').find({ kind: 'degree', status: 'extracted' }).toArray(),
    db.collection('va_institutions').find({}).toArray(),
  ]);
  const colleges = institutions.filter((row) => row.level === 'community_college')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const universities = institutions.filter((row) => row.level === 'four_year')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const agreements = deriveVaAgreements({ courses, degrees, colleges, universities });
  const rates = agreements.map((a) => (a.considered_receivers
    ? (100 * a.articulated_receivers) / a.considered_receivers : 0));
  const mean = rates.reduce((sum, value) => sum + value, 0) / (rates.length || 1);
  const withSupply = agreements.filter((a) => a.derived_from.supply_edges > 0);

  console.log(`agreements: ${agreements.length} (${degrees.length} degrees × ${colleges.length} colleges)`);
  console.log(`pairs with any articulation edge: ${withSupply.length}`);
  for (const skipped of agreements.withoutEquivalencies || []) {
    console.log(`  excluded: ${skipped.degree_id} — ${skipped.reason}`);
  }
  console.log(`mean articulated share of CC-articulable receivers: ${mean.toFixed(1)}%`);
  const byUni = new Map();
  for (const a of agreements) {
    if (!byUni.has(a.university_name)) byUni.set(a.university_name, []);
    byUni.get(a.university_name).push(a.considered_receivers
      ? (100 * a.articulated_receivers) / a.considered_receivers : 0);
  }
  console.log('\nper four-year mean:');
  [...byUni].map(([name, values]) => [name, values.reduce((s, v) => s + v, 0) / values.length])
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, value]) => console.log('  ', value.toFixed(1).padStart(5) + '%', name));

  console.log('\ndry run — publish only through scripts/va/buildVaDocuments.js --apply.');
  await client.close();
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = {
  deriveVaAgreements, articulateGroups, concreteSourceEquivalencies,
  sourceEquivalenciesSha256, selectedEquivalenciesSha256,
  SELECTED_EQUIVALENCIES_CONTRACT,
  SOURCE_NAMED_OFFERING_CONTRACT,
  assertDryRunOnly,
  isGenericReceiver, demandedCodes, slugify,
  VA_UNIVERSITY_BASE, VA_COLLEGE_BASE,
};
