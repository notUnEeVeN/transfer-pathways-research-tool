#!/usr/bin/env node
/**
 * Parse stored prerequisite sentences into edges.
 *
 * Roughly 13,000 UC catalogue rows carry the catalog's prerequisite sentence
 * verbatim (`requisite_text`) but no parsed `prerequisite_ids` — so the
 * complexity figure sees no edges for them. The sentences are already ours;
 * this is parsing, not fetching.
 *
 * Reading rules, deliberately conservative:
 *   - Clauses split on ';' and ' and ' — each clause is one requirement.
 *   - Within a clause, 'or' / ',' separate alternatives; a bare number
 *     inherits the subject before it ("Anthropology 3 or 3SS" is ANTH 3 and
 *     ANTH 3SS) — the same continuation rule the Virginia parser needed.
 *   - Spelled-out subjects resolve against the campus's own prefix list
 *     (ANTHROPOLOGY starts with ANTH; MATHEMATICS with MATH). A code only
 *     counts when the campus catalogue actually contains it; anything else
 *     lands in `unresolved_prerequisites`, never invented.
 *   - `prerequisite_groups` keeps each clause's alternatives;
 *     `prerequisite_ids` carries one representative per clause (the first
 *     resolved alternative), matching the Or-collapse convention every other
 *     reader uses — so an OR of five codes contributes ONE edge, not five.
 *   - Corequisite sentences count too: the reference tool treats a corequisite
 *     as an edge, which our MA validation confirmed (58/60 with, 17/60 without).
 *
 * Rows already parsed are never touched. Idempotent.
 *
 *   node scripts/parseRequisiteText.js            # report
 *   node scripts/parseRequisiteText.js --apply
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const STOP_WORDS = /^(AND|OR|ONE|OF|THE|A|AN|WITH|FOR|IN|TO|AT|BY|AS|IS|ARE|MAY|BE|TAKEN|CONCURRENTLY|PREREQUISITE|PREREQUISITES|COREQUISITE|COREQUISITES|CONSENT|INSTRUCTOR|EQUIVALENT|STANDING|UPPER|LOWER|DIVISION|GRADE|BETTER|SCORE|EXAM|PLACEMENT|COMPLETION|SATISFACTION|ENTRY|LEVEL|COURSE|COURSES|CREDIT|ENROLLMENT|DEPARTMENT|MAJOR|MAJORS|STUDENTS?|SENIOR|JUNIOR|SOPHOMORE|FRESHMAN|REQUIRED|RECOMMENDED|PREVIOUS|CONCURRENT)$/i;

function buildResolver(codes) {
  const codeSet = new Set(codes);
  const prefixes = [...new Set(codes.map((code) => code.split(' ')[0]))]
    .sort((a, b) => b.length - a.length);
  const resolveSubject = (word) => {
    const upper = word.toUpperCase().replace(/[^A-Z&]/g, '');
    if (!upper || STOP_WORDS.test(upper)) return null;
    if (prefixes.includes(upper)) return upper;
    // Spelled-out subject: the catalogue prefix is a prefix of the word
    // (ANTHROPOLOGY → ANTH). Longest prefix wins; require length ≥ 3 so a
    // 2-letter prefix cannot swallow an unrelated word.
    const hit = prefixes.find((prefix) => prefix.length >= 3 && upper.startsWith(prefix));
    return hit || null;
  };
  return { codeSet, resolveSubject };
}

/**
 * Parse one requisite sentence against a campus resolver.
 * Returns { groups, unresolved } where groups is an array of alternative-code
 * arrays (already verified to exist in the campus catalogue).
 */
function parseRequisite(text, resolver, selfPrefix = null) {
  const cleaned = String(text || '')
    .replace(/(?:pre|co)requisite\(s\)?\s*:/gi, ';')
    .replace(/\(may be taken concurrently\)/gi, '')
    .replace(/\(|\)/g, ' ');
  const groups = [];
  const unresolved = new Set();
  for (const clause of cleaned.split(/;|\.\s|\band\b/i)) {
    const alternatives = [];
    let subject = null;
    // Multi-word subjects ("COM SCI", "I&C SCI"): accumulate capitalised words
    // until a number, then emit subject+number.
    const tokens = clause.split(/[\s,]+/).filter(Boolean);
    let pendingWords = [];
    for (const token of tokens) {
      // UCLA's house style: "course 1" / "courses 100A, 101" refer to the SAME
      // subject as the course being described (CHEM 1 inside a CHEM listing).
      // The word switches the active subject to the row's own prefix.
      if (/^courses?$/i.test(token)) { subject = selfPrefix || subject; pendingWords = []; continue; }
      const numberMatch = token.match(/^0*(\d{1,3}[A-Z]{0,3})\.?$/i);
      if (numberMatch) {
        if (pendingWords.length) {
          const joined = pendingWords.join(' ').toUpperCase().replace(/[^A-Z&\s]/g, '').trim();
          subject = resolver.codeSet.has(`${joined} ${numberMatch[1].toUpperCase()}`)
            ? joined : (resolver.resolveSubject(pendingWords[pendingWords.length - 1]) || (
              resolver.codeSet.has(`${joined.split(' ').pop()} ${numberMatch[1].toUpperCase()}`)
                ? joined.split(' ').pop() : subject));
          if (joined && [...resolver.codeSet].some((c) => c.startsWith(`${joined} `))) subject = joined;
          pendingWords = [];
        }
        if (!subject && selfPrefix) subject = selfPrefix;
        if (!subject) { unresolved.add(token); continue; }
        const code = `${subject} ${numberMatch[1].toUpperCase()}`;
        if (resolver.codeSet.has(code)) alternatives.push(code);
        else unresolved.add(code);
        continue;
      }
      if (/^[A-Za-z&][\w&']*$/.test(token) && !STOP_WORDS.test(token)) pendingWords.push(token);
      else pendingWords = pendingWords.length && STOP_WORDS.test(token) ? [] : pendingWords;
    }
    if (alternatives.length) groups.push([...new Set(alternatives)]);
  }
  return { groups, unresolved: [...unresolved] };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const collection = db.collection('curated_prerequisites');

  const campuses = await collection.distinct('institution_id', { institution_id: /^uc:/ });
  let candidates = 0; let parsed = 0; let edgesAdded = 0; let noCode = 0;
  const unresolvedTally = new Map();

  for (const campus of campuses) {
    const rows = await collection.find({ institution_id: campus }).toArray();
    const resolver = buildResolver(rows.map((r) => String(r.course_code || '').toUpperCase().replace(/\s+/g, ' ').trim()).filter(Boolean));
    const idByCode = new Map(rows.map((r) => [String(r.course_code || '').toUpperCase().replace(/\s+/g, ' ').trim(), r.course_id]));

    for (const row of rows) {
      if ((row.prerequisite_ids || []).length || (row.prerequisite_groups || []).length) continue;
      const text = String(row.requisite_text || '').trim();
      if (!text) continue;
      candidates += 1;
      const selfPrefix = String(row.course_code || '').toUpperCase().replace(/\s+/g, ' ').trim().replace(/\s+\S+$/, '') || null;
      const { groups, unresolved } = parseRequisite(text, resolver, selfPrefix);
      unresolved.forEach((u) => unresolvedTally.set(u, (unresolvedTally.get(u) || 0) + 1));
      if (!groups.length) { noCode += 1; continue; }
      const idGroups = groups
        .map((alts) => alts.map((code) => idByCode.get(code)).filter(Boolean))
        .filter((ids) => ids.length);
      if (!idGroups.length) { noCode += 1; continue; }
      parsed += 1;
      edgesAdded += idGroups.length;
      if (apply) {
        await collection.updateOne({ _id: row._id }, {
          $set: {
            prerequisite_groups: idGroups,
            // One representative per clause: an OR contributes one edge.
            prerequisite_ids: idGroups.map((ids) => ids[0]),
            unresolved_prerequisites: unresolved,
            parse_source: 'requisite-text-parse-2026-08-16',
          },
        });
      }
    }
  }

  console.log(`rows with text and no edges: ${candidates}`);
  console.log(`parsed into edges: ${parsed} (${edgesAdded} requirement clauses)`);
  console.log(`text yielded no resolvable code: ${noCode}`);
  console.log('top unresolved tokens:', [...unresolvedTally.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}×${n}`).join('  '));
  if (!apply) console.log('\ndry run — re-run with --apply.');
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
