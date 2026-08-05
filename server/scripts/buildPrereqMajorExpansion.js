#!/usr/bin/env node
/**
 * Build the California Biology/Economics prerequisite-mapping expansion.
 *
 * The committed mapping predates the two new exact program corpora. This
 * script reproduces the expansion from the same source of truth used by the
 * graph: sending-course IDs in the configured ASSIST agreements. Existing
 * human-reviewed rows are immutable; only catalog-present Bio/Econ IDs absent
 * from the artifact are appended.
 *
 * Classification is deliberately auditable:
 *   1. explicit UC receiver anchors for genuinely new concepts;
 *   2. unanimous concept reuse for the same UC receiver or normalized title;
 *   3. narrow title-family rules;
 *   4. examined-null for the broad UCI social-science menu and unresolved
 *      one-offs, with flags so partners can review them in the Mapping tab.
 *
 * Usage (from server/):
 *   node scripts/buildPrereqMajorExpansion.js          # report only
 *   node scripts/buildPrereqMajorExpansion.js --write  # replace artifact
 */

const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const { getMajor, programPairClause } = require('../config/majors');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });

const DATA_DIR = path.resolve(__dirname, '../../scripts/data');
const MAPPING_PATH = path.join(DATA_DIR, 'course_concepts.json');
const TARGET_MAJORS = ['bio', 'econ'];
const GENERATOR_FLAG = 'bio_econ_expansion_v1';
const NULL_KEY = '__examined_null__';
const AMBIGUOUS_COURSE_IDS = new Set([292700, 304010, 150435, 279688, 353536, 353121]);
const INTRO_STATS_RECEIVER_IDS = new Set([
  308406, 304771, 284304, 277266, 128000, 369313, 269489,
  269477, 264335, 262474, 296594, 354134, 384644, 249879,
]);

const clean = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .toLowerCase();

const conceptKey = (concept) => (concept == null ? NULL_KEY : String(concept));
const fromConceptKey = (key) => (key === NULL_KEY ? null : key);

function forEachReceiver(agreement, visit) {
  for (const group of agreement.requirement_groups || [])
    for (const section of group.sections || [])
      for (const receiver of section.receivers || [])
        for (const option of receiver.options || [])
          for (const rawId of option.course_ids || []) visit(Number(rawId), receiver.receiving || {});
}

function receiverIds(receiving) {
  if (receiving?.kind === 'series') return (receiving.parent_ids || []).map(Number);
  return receiving?.parent_id == null ? [] : [Number(receiving.parent_id)];
}

function courseAnchor(row) {
  if (!row) return '';
  return `${row.institution_id}|${clean(row.prefix)}|${clean(row.number)}`;
}

function singleReceiverKey(receiving) {
  const ids = receiverIds(receiving);
  return receiving?.kind === 'course' && ids.length === 1 ? `course:${ids[0]}` : null;
}

function addVote(index, key, concept) {
  if (!key) return;
  if (!index.has(key)) index.set(key, new Set());
  index.get(key).add(conceptKey(concept));
}

function unanimous(index) {
  const result = new Map();
  for (const [key, votes] of index) {
    if (votes.size === 1) result.set(key, fromConceptKey([...votes][0]));
  }
  return result;
}

function sequencePart(doc) {
  const title = clean(doc.title);
  const number = String(doc.number ?? '').trim();
  if (/\b(?:iv|fourth|4)\b/.test(title)) return 4;
  if (/\b(?:iii|third|3)\b/.test(title)) return 3;
  if (/\b(?:ii|second|2)\b/.test(title)) return 2;
  if (/\b(?:i|first|1)\b/.test(title)) return 1;
  if (/d$/i.test(number)) return 4;
  if (/c$/i.test(number)) return 3;
  if (/b$/i.test(number)) return 2;
  if (/a$/i.test(number)) return 1;
  return null;
}

function rowResult(concept, confidence, method, extraFlags = [], note = null) {
  return {
    concept,
    confidence,
    flags: [...new Set([GENERATOR_FLAG, method, ...extraFlags])],
    ...(note ? { note } : {}),
  };
}

function hasAnchor(context, anchor) {
  return context.anchors.has(anchor);
}

function hasReceiverTitle(context, pattern) {
  return context.receiverCourses.some((course) => pattern.test(`${course.prefix} ${course.number} ${course.title}`));
}

function hasReceiverId(context, ids) {
  return context.receivers.some((receiving) => receiverIds(receiving).some((id) => ids.has(id)));
}

function isGenericSocialOnly(context) {
  return context.receivers.length > 0 && context.receivers.every((receiving) =>
    receiving.kind === 'requirement'
      && clean(receiving.name).includes('introductory social science courses in disciplines other than economics'));
}

function classifyNewConcept(doc, context) {
  const title = clean(doc.title);
  const organicBiochemSurvey = /(?:organic.*(?:biochem|biological chemistry)|biochem.*organic|general organic|survey.*organic|chemistry.*health)/.test(title);

  // These six rows have genuinely conflicting or insufficient evidence in the
  // available ASSIST/course-title data. Keep them explicit in the partner
  // queue instead of letting receiver precedence manufacture certainty.
  if (AMBIGUOUS_COURSE_IDS.has(Number(doc.course_id)))
    return rowResult(null, 0, 'needs_review', ['needs_review', 'conflicting_evidence'],
      'Direct receiver/title evidence does not determine one prerequisite concept.');
  if (Number(doc.course_id) === 353524)
    return rowResult(null, 0.9, 'explicit_nonstructural', [],
      'General Microbiology appears only as a laboratory-methodology articulation; no recurring prerequisite chain.');

  // New Biology anchors. Receiver identity wins over a vague sending title;
  // survey-course exceptions are made before the major-biochemistry rule.
  if (hasAnchor(context, 'uc:120|bio sci|97'))
    return rowResult('bio_genetics', 0.95, 'receiver_anchor');
  if (hasAnchor(context, 'uc:120|bio sci|98') || hasAnchor(context, 'uc:117|chem|153a')) {
    if (organicBiochemSurvey)
      return rowResult('organic_biochem_survey', 0.8, 'receiver_plus_title', ['needs_review']);
    return rowResult('biochemistry', 0.9, 'receiver_anchor');
  }
  if (hasAnchor(context, 'uc:120|bio sci|99') || hasAnchor(context, 'uc:144|bio|011'))
    return rowResult('molecular_biology', 0.9, 'receiver_anchor');
  if (hasAnchor(context, 'uc:120|bio sci|93'))
    return rowResult('bio_cell_molec', 0.9, 'receiver_anchor');
  if (hasAnchor(context, 'uc:144|me|021'))
    return rowResult('engr_programming', 0.9, 'receiver_anchor');
  if (hasAnchor(context, 'uc:89|sta|032') || hasAnchor(context, 'uc:144|dsc|008'))
    return rowResult('intro_data_science', 0.9, 'receiver_anchor');
  if (/^(?:foundations|introduction|introductory|technest).*data science|^data science for all$/.test(title))
    return rowResult('intro_data_science', 0.85, 'receiver_plus_title');
  if (/finite math|modern business mathematics|mathematics for business decisions/.test(title))
    return rowResult(null, 0.95, 'explicit_nonstructural', [],
      'Examined finite/business-mathematics option; no recurring prerequisite chain in this template.');
  if (hasReceiverId(context, INTRO_STATS_RECEIVER_IDS))
    return rowResult('intro_stats', 0.9, 'receiver_anchor');
  if (hasAnchor(context, 'uc:117|lifesci|7c') || hasAnchor(context, 'uc:132|bioe|20b'))
    return rowResult('human_physiology', 0.85, 'receiver_anchor', ['broadened_concept']);
  if (hasAnchor(context, 'uc:132|bioe|20c'))
    return rowResult('bio_organismal', 0.9, 'receiver_anchor');
  if (hasAnchor(context, 'uc:117|lifesci|7l'))
    return rowResult('bio_cell_molec', 0.75, 'receiver_anchor', ['partial_course', 'needs_review']);

  // Direct Economics supporting-course anchors. Generic UCI choices do not
  // trigger these concepts unless the course also articulates directly here.
  if (hasAnchor(context, 'uc:144|psy|001'))
    return rowResult('intro_psychology', 0.95, 'receiver_anchor');
  if (hasAnchor(context, 'uc:144|poli|001'))
    return rowResult('intro_american_government', 0.95, 'receiver_anchor');
  if (hasAnchor(context, 'uc:144|soc|001'))
    return rowResult('intro_sociology', 0.95, 'receiver_anchor');

  // One-course introductions articulate where another campus takes a
  // micro+macro pair. Preserve the combined course instead of guessing a half.
  if ((hasAnchor(context, 'uc:79|econ|1') || hasAnchor(context, 'uc:144|econ|001'))
      && /(?:introduction|introductory|principles) (?:to |of )?economics$/.test(title)
      && !/micro|macro/.test(title))
    return rowResult('econ_intro_combined', 0.85, 'receiver_plus_title');

  // BIO 18 mostly takes ordinary statistics, but a small genuine data-science
  // subset should not be flattened into intro statistics.
  if (hasAnchor(context, 'uc:144|bio|018')
      && /data science|data analytics|data literacy|understanding data/.test(title))
    return rowResult('intro_data_science', 0.8, 'receiver_plus_title');

  // Brief organic chemistry is a distinct sending-side chain from the full
  // science-majors sequence. Handle explicit Davis/Merced brief anchors first.
  const briefOrganic = hasReceiverTitle(context, /CHE 0?08[AB]\b.*Brief Course/i)
    || hasAnchor(context, 'uc:144|chem|008');
  if (briefOrganic || /brief organic|survey of organic|principles of organic/.test(title)) {
    if (organicBiochemSurvey)
      return rowResult('organic_biochem_survey', 0.8, 'receiver_plus_title', ['needs_review']);
    const part = sequencePart(doc);
    return rowResult(part && part >= 2 ? 'organic_chem_survey_2' : 'organic_chem_survey_1',
      part ? 0.85 : 0.65, 'receiver_plus_title', part ? [] : ['needs_review']);
  }

  // A third life-science calculus/mathematical-methods course is not Calc III;
  // it follows the applied two-course sequence and often bundles LA/DE.
  if ((/calculus (?:for|with).*?(?:life|social|business|econom)/.test(title)
      || /mathematical methods for economists/.test(title)) && sequencePart(doc) >= 3)
    return rowResult('applied_math_3', 0.8, 'title_rule');

  // Course-specific molecular/genetics titles are useful even when a category
  // receiver (rather than a single UC course) supplied the option.
  if (/molecular biology|molecular and cell biology/.test(title))
    return rowResult('molecular_biology', 0.75, 'title_rule');
  if (/\bgenetic|\bgenetics|heredity|human heredity/.test(title))
    return rowResult('bio_genetics', 0.75, 'title_rule');
  if (/\bbiochemistry|biological chemistry/.test(title)) {
    if (organicBiochemSurvey)
      return rowResult('organic_biochem_survey', 0.7, 'title_rule', ['needs_review']);
    return rowResult('biochemistry', 0.75, 'title_rule');
  }
  if (hasAnchor(context, 'uc:120|bio sci|94') || hasAnchor(context, 'uc:117|lifesci|7b'))
    return rowResult('bio_organismal', 0.85, 'receiver_anchor');

  const appliedCalculus = /calculus.*(?:business|social|life|biolog|management|econom)/.test(title)
    || /mathematical methods for economists/.test(title);
  if (appliedCalculus) {
    const part = sequencePart(doc);
    if (part && part >= 3) return rowResult('applied_math_3', 0.8, 'receiver_plus_title');
    return rowResult(part === 2 ? 'bus_calc_2' : 'bus_calc_1', 0.85, 'receiver_plus_title');
  }

  return null;
}

function classifyTitleFamily(doc, context) {
  const title = clean(doc.title);
  const prefix = clean(doc.prefix);
  const part = sequencePart(doc);

  if (/physics.*calculus supplement|calculus supplement.*physics/.test(title)) {
    const physicsPart = /\b(?:ii|second)\b/.test(title) ? 2
      : /\b(?:iii|third)\b/.test(title) ? 3 : 1;
    return rowResult(physicsPart >= 3 ? 'phys_waves_thermo' : physicsPart === 2 ? 'phys_em' : 'phys_mech',
      0.7, 'title_rule', ['partial_course', 'needs_review']);
  }

  if (/data science|data analytics|data literacy|understanding data/.test(title))
    return rowResult('intro_data_science', 0.7, 'title_rule');
  if (/statistic|statistical|probability/.test(title)) {
    if (/calculus based|calculus.*probability|probability.*calculus|engineering probability/.test(title)
        || hasAnchor(context, 'uc:7|math|11'))
      return rowResult('stats_calc', 0.75, 'title_rule');
    return rowResult('intro_stats', 0.75, 'title_rule');
  }

  if (/linear algebra.*differential|differential equations.*linear algebra/.test(title))
    return rowResult('linear_alg_diff_eq', 0.85, 'title_rule', ['combined_course']);
  if (/linear algebra/.test(title)) return rowResult('linear_alg', 0.75, 'title_rule');
  if (/differential equation/.test(title)) return rowResult('diff_eq', 0.75, 'title_rule');
  if (/multivariable|vector calculus|calculus (?:iii|3|c)\b/.test(title))
    return rowResult('calc_3', 0.8, 'title_rule');
  if (/business calculus|applied calculus|calculus for (?:business|social|life|biology|econom)/.test(title))
    return rowResult(part && part >= 2 ? 'bus_calc_2' : 'bus_calc_1', part ? 0.8 : 0.65,
      'title_rule', part ? [] : ['needs_review']);
  if (/calculus/.test(title)) {
    if (part === 3 || part === 4) return rowResult('calc_3', 0.75, 'title_rule');
    if (part === 2) return rowResult('calc_2', 0.75, 'title_rule');
    if (part === 1 || /differential calculus/.test(title)) return rowResult('calc_1', 0.75, 'title_rule');
  }
  if (/discrete math|discrete structure/.test(title)) return rowResult('discrete_math', 0.8, 'title_rule');

  if (/microeconom/.test(title)) return rowResult('econ_micro', 0.85, 'title_rule');
  if (/macroeconom/.test(title)) return rowResult('econ_macro', 0.85, 'title_rule');
  if (/^(?:introduction|introductory|principles) (?:to |of )?economics$/.test(title))
    return rowResult('econ_intro_combined', 0.7, 'title_rule', ['needs_review']);

  if (/general chemistry|principles of chemistry|chemistry for science/.test(title))
    return rowResult(part && part >= 2 ? 'gen_chem_2' : 'gen_chem_1', part ? 0.75 : 0.6,
      'title_rule', part ? [] : ['needs_review']);
  if (/organic chemistry/.test(title)) {
    if (/brief|survey|principles/.test(title))
      return rowResult(part && part >= 2 ? 'organic_chem_survey_2' : 'organic_chem_survey_1',
        part ? 0.75 : 0.6, 'title_rule', part ? [] : ['needs_review']);
    return rowResult(part && part >= 2 ? 'organic_chem_2' : 'organic_chem_1',
      part ? 0.75 : 0.6, 'title_rule', part ? [] : ['needs_review']);
  }

  if (/cell and molecular|cellular and molecular|general biology|principles of biology/.test(title))
    return rowResult('bio_cell_molec', 0.7, 'title_rule');
  if (/organism|ecology|ecological|evolution|biodiversity|zoology|botany|animal biology/.test(title))
    return rowResult('bio_organismal', 0.7, 'title_rule');
  if (/physiology|human biology|developmental biology/.test(title))
    return rowResult('human_physiology', 0.65, 'title_rule', ['needs_review']);

  if (/general physics|introductory physics|physics for (?:life|health|biology)/.test(title))
    return rowResult(part && part >= 2 ? 'phys_gen_2' : 'phys_gen_1', part ? 0.7 : 0.55,
      'title_rule', part ? [] : ['needs_review']);
  if (/electricity|electromagnet|electric and magnetic/.test(title))
    return rowResult('phys_em', 0.7, 'title_rule');
  if (/mechanics/.test(title)) return rowResult('phys_mech', 0.7, 'title_rule');
  if (/waves|thermodynamic|optics/.test(title)) return rowResult('phys_waves_thermo', 0.65, 'title_rule');
  if (/modern physics|nuclear physics/.test(title)) return rowResult('phys_modern', 0.65, 'title_rule');

  if (/programming|computer science|computing/.test(title)) {
    if (/engineering|matlab|numerical/.test(title) || prefix === 'engr')
      return rowResult('engr_programming', 0.65, 'title_rule', ['needs_review']);
    return rowResult('cs_1', 0.6, 'title_rule', ['needs_review']);
  }

  return null;
}

function classify(doc, context, titleConsensus, receiverConsensus) {
  const explicit = classifyNewConcept(doc, context);
  if (explicit) return explicit;

  const receiverVotes = new Set(context.receivers
    .map(singleReceiverKey)
    .filter((key) => key && receiverConsensus.has(key))
    .map((key) => conceptKey(receiverConsensus.get(key))));
  const receiverConcept = receiverVotes.size === 1 ? fromConceptKey([...receiverVotes][0]) : undefined;
  const normalizedTitle = clean(doc.title);
  const titleKnown = titleConsensus.has(normalizedTitle);
  const titleConcept = titleConsensus.get(normalizedTitle);

  if (receiverConcept !== undefined && titleKnown && conceptKey(receiverConcept) === conceptKey(titleConcept))
    return rowResult(receiverConcept, 1, 'receiver_title_consensus');
  if (receiverConcept !== undefined)
    return rowResult(receiverConcept, 0.9, 'receiver_consensus',
      titleKnown && conceptKey(receiverConcept) !== conceptKey(titleConcept) ? ['title_conflict'] : []);
  if (titleKnown)
    return rowResult(titleConcept, 0.9, 'title_consensus');

  const family = classifyTitleFamily(doc, context);
  if (family) return family;

  if (isGenericSocialOnly(context))
    return rowResult(null, 0.9, 'generic_social_science', [],
      'Examined UCI introductory-social-science option; no recurring prerequisite chain.');

  return rowResult(null, 0.5, 'needs_review', ['needs_review'],
    'No stable concept assignment from receiver, title, or recurring family.');
}

function contextFor(id, contexts, receivingById) {
  const receivers = contexts.get(id) || [];
  const receiverCourses = receivers.flatMap((receiving) => receiverIds(receiving)
    .map((receiverId) => receivingById.get(receiverId)).filter(Boolean));
  return {
    receivers,
    receiverCourses,
    anchors: new Set(receiverCourses.map(courseAnchor)),
  };
}

async function loadMajorAgreements(db, slug) {
  const major = getMajor(slug);
  return db.collection('assist_agreements').find(programPairClause(major, {
    schoolField: 'uc_school_id', majorField: 'major',
  }), { projection: { requirement_groups: 1 } }).toArray();
}

async function main() {
  const write = process.argv.includes('--write');
  if (!process.env.TARGET_MONGO_URI) throw new Error('TARGET_MONGO_URI is required (scripts/.env is loaded).');

  const artifact = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  // Generated rows are replaceable output, not additional evidence. Removing
  // them here makes --write idempotent and lets classifier fixes rebuild the
  // same 1,966-row slice without duplicating or freezing an older pass.
  const existingRows = (artifact.rows || []).filter((row) =>
    !(row.flags || []).includes(GENERATOR_FLAG));
  const existingById = new Map(existingRows.map((row) => [Number(row.course_id), row]));
  if (existingById.size !== existingRows.length)
    throw new Error('Existing artifact has duplicate course_id rows; refusing to expand.');

  const client = new MongoClient(process.env.TARGET_MONGO_URI);
  await client.connect();
  try {
    const db = client.db(process.env.TARGET_DB_NAME || 'pmt_research');
    const agreementsByMajor = new Map();
    for (const slug of ['cs', ...TARGET_MAJORS]) agreementsByMajor.set(slug, await loadMajorAgreements(db, slug));

    const allSending = await db.collection('assist_courses').find({ side: 'sending' }, {
      projection: { course_id: 1, institution_id: 1, prefix: 1, number: 1, title: 1 },
    }).toArray();
    const sendingById = new Map(allSending.map((row) => [Number(row.course_id), row]));
    const allReceiving = await db.collection('assist_courses').find({ side: 'receiving' }, {
      projection: { parent_id: 1, institution_id: 1, prefix: 1, number: 1, title: 1 },
    }).toArray();
    const receivingById = new Map(allReceiving.map((row) => [Number(row.parent_id), row]));

    const contexts = new Map();
    const targetIds = new Set();
    for (const [slug, agreements] of agreementsByMajor) {
      for (const agreement of agreements) forEachReceiver(agreement, (id, receiving) => {
        if (!contexts.has(id)) contexts.set(id, []);
        contexts.get(id).push({ ...receiving, major_slug: slug });
        if (TARGET_MAJORS.includes(slug)) targetIds.add(id);
      });
    }

    // Reuse evidence is learned only from the already committed mapping.
    const titleVotes = new Map();
    const receiverVotes = new Map();
    for (const row of existingRows) {
      const doc = sendingById.get(Number(row.course_id));
      if (doc) addVote(titleVotes, clean(doc.title), row.concept);
      for (const receiving of contexts.get(Number(row.course_id)) || [])
        addVote(receiverVotes, singleReceiverKey(receiving), row.concept);
    }
    const titleConsensus = unanimous(titleVotes);
    const receiverConsensus = unanimous(receiverVotes);

    const newIds = [...targetIds]
      .filter((id) => !existingById.has(id) && sendingById.has(id))
      .sort((a, b) => a - b);
    const phantomIds = [...targetIds]
      .filter((id) => !existingById.has(id) && !sendingById.has(id))
      .sort((a, b) => a - b);

    const newRows = newIds.map((id) => {
      const doc = sendingById.get(id);
      const result = classify(doc, contextFor(id, contexts, receivingById), titleConsensus, receiverConsensus);
      return {
        course_id: id,
        institution_id: doc.institution_id,
        concept: result.concept,
        confidence: result.confidence,
        title_seen: doc.title,
        ...(result.note ? { note: result.note } : {}),
        flags: result.flags,
      };
    });

    const conceptCounts = new Map();
    const methodCounts = new Map();
    for (const row of newRows) {
      const concept = conceptKey(row.concept);
      conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
      for (const flag of row.flags || []) if (flag !== GENERATOR_FLAG)
        methodCounts.set(flag, (methodCounts.get(flag) || 0) + 1);
    }
    const needsReview = newRows.filter((row) => (row.flags || []).includes('needs_review'));
    const mapped = newRows.filter((row) => row.concept != null).length;
    const finalRows = [...existingRows, ...newRows].sort((a, b) => Number(a.course_id) - Number(b.course_id));
    const finalIds = new Set(finalRows.map((row) => Number(row.course_id)));
    if (finalIds.size !== finalRows.length) throw new Error('Expansion produced duplicate course_id rows.');

    console.log(`Existing rows: ${existingRows.length}`);
    console.log(`New Bio/Econ catalog rows: ${newRows.length} (${mapped} mapped; ${newRows.length - mapped} examined-null)`);
    console.log(`New phantom IDs omitted: ${phantomIds.length}`);
    console.log(`Needs review: ${needsReview.length}`);
    console.log('Concept counts:', Object.fromEntries([...conceptCounts].sort()));
    console.log('Method/flag counts:', Object.fromEntries([...methodCounts].sort()));
    console.log('Needs-review sample:', needsReview.slice(0, 30).map((row) => ({
      id: row.course_id, college: row.institution_id, code: `${sendingById.get(row.course_id)?.prefix} ${sendingById.get(row.course_id)?.number}`,
      title: row.title_seen, concept: row.concept,
    })));

    if (!write) {
      console.log('Report only; pass --write to replace scripts/data/course_concepts.json.');
      return;
    }

    const finalMapped = finalRows.filter((row) => row.concept != null).length;
    const now = new Date().toISOString().slice(0, 10);
    const originalClassification = artifact.meta?.original_classification || {
      vote_protocol: artifact.meta?.vote_protocol,
      agreement: artifact.meta?.agreement,
    };
    const {
      authored: priorAuthored,
      vote_protocol: _priorVoteProtocol,
      agreement: _priorAgreement,
      original_classification: _priorOriginalClassification,
      ...priorMeta
    } = artifact.meta || {};
    const originalAuthored = String(priorAuthored || '2026-07-16')
      .split('; Bio/Econ expansion')[0];
    const output = {
      meta: {
        ...priorMeta,
        authored: `${originalAuthored}; Bio/Econ expansion ${now}`,
        session: 'original in-session classification plus deterministic ASSIST receiver/title expansion',
        vocabulary: 'scripts/data/prereq_concepts.json',
        original_classification: originalClassification,
        expansion: {
          majors: TARGET_MAJORS,
          source: 'exact configured California ASSIST program pairs',
          generator: 'server/scripts/buildPrereqMajorExpansion.js',
          added_catalog_rows: newRows.length,
          added_mapped: mapped,
          added_examined_null: newRows.length - mapped,
          omitted_phantom_ids: phantomIds.length,
          needs_review: needsReview.length,
          generated_at: now,
        },
        totals: {
          rows: finalRows.length,
          mapped: finalMapped,
          examined_null: finalRows.length - finalMapped,
        },
        sample_error_rate: null,
        sample_note: 'Partner verification pending in Data -> Prerequisites -> Mapping; expansion flags define the review queue.',
      },
      rows: finalRows,
    };
    // Preserve the artifact's established one-space indentation so generated
    // updates remain reviewable instead of reformatting every existing row.
    const serialized = JSON.stringify(output, null, 1)
      // JSON.stringify collapses 1.0 to 1. Keep the artifact's established
      // confidence notation so untouched classifications do not churn.
      .replace(/("confidence": )1,/g, '$11.0,');
    fs.writeFileSync(MAPPING_PATH, `${serialized}\n`);
    console.log(`Wrote ${finalRows.length} unique rows to ${MAPPING_PATH}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
