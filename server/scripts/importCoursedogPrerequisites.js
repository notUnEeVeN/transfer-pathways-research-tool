#!/usr/bin/env node
/**
 * Land Coursedog-sourced prerequisites (Berkeley, Santa Barbara) into
 * `curated_prerequisites`, in the same shape as the scraped campuses.
 *
 *   node scripts/importCoursedogPrerequisites.js --dry-run
 *   node scripts/importCoursedogPrerequisites.js
 *
 * Coursedog states requisites as RULES rather than prose, which removes the
 * natural-language step entirely:
 *
 *   condition: completedAllOf        every listed group is required
 *   condition: completedAnyOf        any one group suffices
 *   value.values[]: { value: [ids], logic: 'and' | 'or' }
 *
 * So COMPSCI C149's rule — ids [1063391] and [1044281] and [1044331, 1147081]
 * with logic 'or' on the last — is read directly as an AND of ORs. The
 * human-readable sentence is kept as `requisite_text` so a verifier can check
 * the encoding against what the catalogue actually says.
 *
 * `freeformText` rules (over half of Berkeley's) carry no course ids — they are
 * "consent of instructor" and standing requirements. They are recorded as text
 * and produce no edges, which is correct: they gate on nothing enumerable.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { parseUcsbRequisites } = require('../services/uc/ucsbRequisites');

const ROOT = path.resolve(__dirname, '../.uc-catalogs/coursedog');
const flag = (name) => process.argv.includes(`--${name}`);

const normalizeCode = (code) => String(code || '')
  .toUpperCase().replace(/\s+/g, ' ').trim()
  .replace(/^(.*?)\s*(\d{1,4})([A-Z]{0,2})$/, (_, p, d, s) => `${p.replace(/\s+/g, ' ')} ${String(Number(d))}${s}`);

/** "Prerequisite" sections only; a corequisite is not a gate on starting. */
const isPrerequisite = (section) => String(section?.type || '').toLowerCase() === 'prerequisite';

/**
 * Turn one Coursedog rule into groups of course ids: an outer AND of inner ORs.
 * Returns [] for rules that name no course.
 */
function groupsFromRule(rule) {
  const condition = String(rule?.condition || '');
  const values = rule?.value?.values;
  if (!Array.isArray(values) || !values.length) return [];
  const groups = values
    .map((entry) => (Array.isArray(entry?.value) ? entry.value.map(String) : []))
    .filter((ids) => ids.length);
  if (!groups.length) return [];
  if (condition === 'completedAnyOf') {
    // Any one of the listed groups will do, so the whole rule is one alternative set.
    return [[...new Set(groups.flat())]];
  }
  if (condition === 'completedAllOf') {
    // Each group must be satisfied; `logic: or` inside a group makes its members
    // alternatives, which is already how a group is represented.
    return groups.map((ids) => [...new Set(ids)]);
  }
  return [];
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  const dryRun = flag('dry-run');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const files = fs.existsSync(ROOT)
    ? fs.readdirSync(ROOT).filter((f) => f.endsWith('.json')) : [];
  if (!files.length) throw new Error(`no captures in ${ROOT} — run captureCoursedogCatalogs.js first`);

  let grandCourses = 0;
  let grandEdges = 0;
  for (const file of files) {
    const capture = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const schoolId = Number(capture.school_id);

    // Coursedog's own course ids are what the rules reference; map them to codes.
    // Berkeley's course id carries an effective date — "1617251-2025-08-20" —
    // while the requisite rules reference the bare id. Index both.
    const codeById = new Map();
    for (const course of capture.courses) {
      if (course.id == null || !course.subjectCode || course.courseNumber == null) continue;
      const code = normalizeCode(`${course.subjectCode} ${course.courseNumber}`);
      const raw = String(course.id);
      codeById.set(raw, code);
      const bare = raw.split('-')[0];
      if (bare !== raw && !codeById.has(bare)) codeById.set(bare, code);
    }

    const assist = await db.collection('assist_courses')
      .find({ side: 'receiving', university_id: schoolId })
      .project({ parent_id: 1, prefix: 1, number: 1 }).toArray();
    const assistByCode = new Map(assist.map((c) => [normalizeCode(`${c.prefix} ${c.number}`), c]));

    const keyOf = (code) => `uc:${schoolId}:${code}`;
    const records = [];
    let unresolvedRefs = 0;
    for (const course of capture.courses) {
      if (!course.subjectCode || course.courseNumber == null) continue;
      const code = normalizeCode(`${course.subjectCode} ${course.courseNumber}`);
      const groups = [];
      const texts = [];

      // Santa Barbara publishes no rules at all — only freeform prose, written
      // sometimes by code and sometimes by department name. It is parsed rather
      // than read structurally, so its edges are weaker evidence than Berkeley's
      // and are marked as such.
      const freeform = course.requisites?.requisitesFreeform?.value;
      let proseParsed = false;
      if (freeform && String(freeform).trim().length > 3) {
        const { groups: proseGroups, text } = parseUcsbRequisites(freeform, course.subjectCode);
        for (const g of proseGroups) groups.push(g.map((c) => keyOf(normalizeCode(c))));
        if (text) texts.push(text);
        proseParsed = true;
      }

      const sections = (course.requisites?.requisitesSimple || []).filter(isPrerequisite);
      for (const section of sections) {
        for (const rule of section.rules || []) {
          if (rule.condition === 'freeformText' && rule.value) texts.push(String(rule.value));
          else if (rule.name && rule.condition !== 'freeformText') texts.push(String(rule.name));
          for (const ids of groupsFromRule(rule)) {
            const keys = [];
            for (const id of ids) {
              const target = codeById.get(String(id));
              if (target) keys.push(keyOf(target));
              else unresolvedRefs += 1;
            }
            if (keys.length) groups.push([...new Set(keys)]);
          }
        }
      }
      const hit = assistByCode.get(code);
      records.push({
        _id: keyOf(code),
        course_id: keyOf(code),
        institution_id: `uc:${schoolId}`,
        university_id: schoolId,
        side: 'receiving',
        course_code: `${course.subjectCode} ${course.courseNumber}`,
        course_name: course.name || null,
        units: course.credits?.value ?? course.credits?.max ?? null,
        parent_id: hit ? Number(hit.parent_id) : null,
        prerequisite_groups: groups,
        prerequisite_ids: [...new Set(groups.flat())],
        requisite_text: texts.length ? texts.join(' ').slice(0, 1000) : null,
        source: capture.source,
        source_format: proseParsed ? 'coursedog-freeform' : 'coursedog',
        // Structured rules are read; prose is interpreted. Flag the latter so a
        // verifier knows which records rest on a parse.
        status: proseParsed && groups.length ? 'needs_review' : 'resolved',
        unresolved_prerequisites: [],
        updated_at: new Date().toISOString(),
      });
    }

    if (!dryRun && records.length) {
      const ops = records.map((doc) => ({
        replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
      }));
      for (let i = 0; i < ops.length; i += 500) {
        await db.collection('curated_prerequisites').bulkWrite(ops.slice(i, i + 500));
      }
    }
    const withEdges = records.filter((r) => r.prerequisite_groups.length).length;
    grandCourses += records.length;
    grandEdges += withEdges;
    console.log(`  ${String(capture.campus).padEnd(18)} ${String(records.length).padStart(6)} courses`
      + `  ${String(withEdges).padStart(5)} with course prerequisites`
      + `  ${String(unresolvedRefs).padStart(4)} rule refs outside the catalogue`);
  }
  console.log(`\n${dryRun ? '[dry run] ' : ''}${grandCourses} courses, ${grandEdges} with course prerequisites`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
