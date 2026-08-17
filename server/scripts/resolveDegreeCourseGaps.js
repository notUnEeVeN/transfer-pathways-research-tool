#!/usr/bin/env node
/**
 * Resolve unit-only degree sections into the explicit courses they stand for.
 *
 * The nine UC degree templates were authored with some requirement blocks
 * carried as a unit count plus prose ("Upper-division major coursework — 12
 * courses (60 units)") rather than as linked catalog courses. That was enough
 * for the unit-based figures, but a prerequisite graph — and therefore the
 * curricular-complexity metric — needs the courses themselves.
 *
 * Most of the work needs no new research: the prose already names the courses
 * ("CSE 16, CSE 40, ECE 30"), and every UC catalog course is already stored in
 * `assist_courses`. This script reads the names, resolves them against the
 * catalog, and proposes a fill.
 *
 * THE INVARIANT, checked per section and never overridden: a proposed fill must
 * reproduce the section's stated `unit_advisement` exactly. A block that says 5
 * units must resolve to courses totalling 5 units. Anything that does not
 * reconcile is reported for research, never written.
 *
 * Blocks that are genuinely open are left alone and reported as such:
 *   - GE / breadth blocks are satisfied by an IGETC AREA, not a course list;
 *     enumerating hundreds of qualifying courses would misrepresent them.
 *   - "Unrestricted electives — 12 units to reach the 180-unit minimum" is
 *     capacity, not a requirement; any course counts.
 *
 *   node scripts/resolveDegreeCourseGaps.js --doc degree:132:cs
 *   node scripts/resolveDegreeCourseGaps.js --major cs            # all campuses
 *   node scripts/resolveDegreeCourseGaps.js --doc degree:132:cs --apply
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const isExplicit = (r) => {
  const k = r.receiving?.kind;
  if (k === 'course') return r.receiving.parent_id != null;
  if (k === 'series') return (r.receiving.parent_ids || []).length > 0;
  return false;
};

/** Course codes named inside requirement prose. */
const CODE_RE = /\b([A-Z][A-Z&]*(?:\s+[A-Z&]+)*)\s+0*(\d{1,3}[A-Z]{0,2})\b/g;
const NOT_A_SUBJECT = /^(GE|IGETC|AREA|LIST|UNIT|UNITS|COURSE|COURSES|AND|OR|THE|AT|IN|TO|A|B|C|D|E|F|G|W|EW|CC|ER|PE|IM|TA|SI|PR)$/i;

const normalizeCode = (prefix, number) => `${String(prefix).toUpperCase().replace(/\s+/g, ' ').trim()} ${String(number).toUpperCase()}`;

/**
 * The code expression a receiver names, read from the head of its label.
 *
 * These labels are regular: a code expression, an em dash, then a human title —
 * "CSE 102 or CSE 103 — Analysis of Algorithms / Computational Models". Only the
 * head carries codes; parsing the whole string picks up range text out of the
 * tail ("CSE 100–189/195") and invents requirements that are not there.
 *
 * Returns `{ alternatives, conjunction }`, where alternatives are the codes that
 * each independently satisfy the slot. "or", a comma and a slash all separate
 * alternatives ("CSE 115A, CSE 185E/185S, or CSE 195").
 */
function codeExpression(label) {
  const full = String(label || '');
  const head = full.split(/\s+[—–]\s+/)[0];
  // Most labels lead with the codes ("CSE 102 or CSE 103 — Analysis..."), but a
  // few lead with the requirement's name and list the codes after the dash
  // ("Disciplinary Communication (DC) — CSE 115A, CSE 185E/185S, or CSE 195").
  // Read the head, and fall back to the whole label when it names nothing.
  const headHasCode = [...head.matchAll(CODE_RE)]
    .some((m) => !NOT_A_SUBJECT.test(m[1].trim()));
  const scope = headHasCode ? head : full;
  // A range ("CSE 100-189") is a category, not a list of alternatives.
  if (/\d\s*[–—]\s*\d/.test(scope)) return { alternatives: [], conjunction: 'range' };
  // "...toward the L&S 36-unit minimum" states a unit total, not a course.
  if (/\d+\s*-?\s*unit\b/i.test(scope)) return { alternatives: [], conjunction: 'unit-prose' };
  // Walk left to right so a bare number inherits the subject that preceded it:
  // "ECON 101, 102, 103, and 103L" is four ECON courses, and reading only the
  // first would fill a slot with an incomplete list and silently break its unit
  // total. A new subject resets the inheritance.
  const codes = [];
  let subject = null;
  const TOKEN = /([A-Z][A-Z&]*(?:\s+[A-Z&]+)*)\s+0*(\d{1,3}[A-Z]{0,2})\b|(?:^|[,;/]|\bor\b|\band\b)\s*0*(\d{1,3}[A-Z]{0,2})\b/g;
  for (const m of scope.matchAll(TOKEN)) {
    if (m[1]) {
      const prefix = m[1].trim();
      if (NOT_A_SUBJECT.test(prefix)) { subject = null; continue; }
      subject = prefix;
      codes.push(normalizeCode(prefix, m[2]));
    } else if (m[3] && subject) {
      codes.push(normalizeCode(subject, m[3]));
    }
  }
  // Spaceless tokens ("MCELLBI100B", "CHEMC130") carry no separator for the
  // regex above to find, so surface them for prefix-based splitting later.
  for (const m of scope.matchAll(/\b([A-Z]{3,10}[A-Z]?\d{1,3}[A-Z]{0,2})\b/g)) {
    if (!/\d/.test(m[1])) continue;
    codes.push(m[1].toUpperCase());
  }
  const unique = [...new Set(codes)];
  // Bare suffixes: "CSE 185E/185S" writes the second without its subject.
  for (const m of scope.matchAll(/\/\s*0*(\d{1,3}[A-Z]{0,2})\b/g)) {
    const last = unique[unique.length - 1];
    if (!last) continue;
    const subject = last.replace(/\s+\S+$/, '');
    const candidate = normalizeCode(subject, m[1]);
    if (!unique.includes(candidate)) unique.push(candidate);
  }
  // Whether the listed codes are alternatives or a required set changes the
  // unit arithmetic entirely: an OR slot is satisfied by ONE of them (each must
  // match the slot), an AND slot needs all of them (they must sum to it).
  // "One of BCH 100, 100H, 110A, or 110HA" is a choice; "ECON 101, 102, 103,
  // and 103L" is four required courses.
  const looksOr = /\bone of\b|\bor\b|\beither\b/i.test(scope);
  const conjunction = unique.length <= 1 ? 'single' : (looksOr ? 'or' : 'and');
  return { alternatives: unique, conjunction };
}

/**
 * Why a section carries no course list. Only `named` blocks are fillable; the
 * others are correctly unit-only and are reported, not patched.
 */
function sectionClass(text, tier) {
  const t = String(text || '');
  if (/unrestricted elective|elective capacity|to reach the \d+/i.test(t)) return 'open-capacity';
  if (/^\s*GE[:\s]|general education|american history & institutions/i.test(t)) return 'ge-area';
  if (tier === 'breadth') return 'ge-area';
  return 'named';
}

/**
 * Index every catalog course for one campus by its normalized code.
 *
 * Two collections hold campus courses and they cover different halves:
 * `assist_courses` carries the ASSIST RECEIVING courses, which are by
 * definition the lower-division articulable ones (3,848 of 3,903 are
 * lower-division), while `curated_prerequisites` carries the catalogue proper,
 * including 28,713 upper-division courses with units. The upper-division blocks
 * this script fills live only in the second, so both are indexed and the
 * catalogue wins on conflict.
 */
function catalogIndex(courses) {
  const byCode = new Map();
  const add = (code, entry) => {
    if (!code.trim()) return;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(entry);
  };
  for (const c of courses) {
    if (c.course_code) {
      // curated_prerequisites: one stored code string, e.g. "CSE 101".
      const m = String(c.course_code).match(/^\s*([A-Z][A-Z&\s]*?)\s*0*(\d{1,3}[A-Z]{0,2})\s*$/i);
      if (m) {
        add(normalizeCode(m[1], m[2]), {
          parent_id: c.course_id ?? null,
          title: c.course_name ?? null,
          units: Number.isFinite(Number(c.units)) ? Number(c.units) : null,
          source: 'catalogue',
        });
      }
      continue;
    }
    add(normalizeCode(c.prefix || '', c.number || ''), {
      parent_id: c.parent_id ?? null,
      title: c.title ?? null,
      units: Number.isFinite(Number(c.min_units ?? c.units)) ? Number(c.min_units ?? c.units) : null,
      source: 'assist',
    });
  }
  // Prefer the catalogue record when a code appears in both.
  for (const [code, list] of byCode) {
    byCode.set(code, list.sort((a, b) => (a.source === 'catalogue' ? -1 : 1)));
  }
  // The campus's own subject prefixes, longest first. Requirement prose and the
  // catalogue disagree about spacing — Berkeley writes "MCELLBI100B" in a
  // requirement and "ECON 100A" in the catalogue — so a code is split against
  // the prefixes the campus actually uses rather than by guessing where the
  // subject ends. "MCELLBIC100A" is MCELLBI + C100A, not MCELLBIC + 100A.
  byCode.prefixes = [...new Set([...byCode.keys()].map((k) => k.split(' ')[0]))]
    .sort((a, b) => b.length - a.length);
  return byCode;
}

/** Split a spaceless code ("MCELLBI100B") using a campus's known prefixes. */
function splitAgainstPrefixes(token, prefixes) {
  const flat = String(token || '').toUpperCase().replace(/\s+/g, '');
  for (const prefix of prefixes || []) {
    if (!flat.startsWith(prefix)) continue;
    const rest = flat.slice(prefix.length);
    if (/^[A-Z]?\d{1,3}[A-Z]{0,2}$/.test(rest)) return `${prefix} ${rest}`;
  }
  return null;
}



function proposeForDegree(degree, courses) {
  const byCode = catalogIndex(courses);
  const sections = [];
  for (const group of degree.requirement_groups || []) {
    for (const section of group.sections || []) {
      const receivers = section.receivers || [];
      if (receivers.some(isExplicit)) continue;
      const classText = [group.title, section.title, ...receivers.map((r) => r.receiving?.name)]
        .filter(Boolean).join(' — ');
      const cls = sectionClass(classText, section.tier || group.tier);
      const stated = section.unit_advisement == null ? null : Number(section.unit_advisement);
      // Identical slots share a section's units: four 5-unit electives are one
      // 20-unit section, so a slot is worth the section over its receiver count.
      const perSlot = stated != null && receivers.length ? stated / receivers.length : null;

      // Some sections carry ONE descriptive label repeated on every receiver
      // and list all of that section's courses inside it — UCLA econ has four
      // receivers each labelled "ECON 101, 102, 103, and 103L" for a 13-unit
      // section. Those are four slots, one per course, not four copies of the
      // whole list. Distribute positionally when the counts line up and the
      // course units sum to the section: reading them as repeats would fill
      // every slot with the same course.
      const labels = receivers.map((r) => r.receiving?.name || '');
      const sharedLabel = labels.length > 1 && labels.every((l) => l === labels[0]);
      let distribute = null;
      if (sharedLabel) {
        const { alternatives } = codeExpression(labels[0]);
        if (alternatives.length === receivers.length) {
          const units = alternatives.map((code) => (byCode.get(code) || [])[0]?.units);
          const total = units.reduce((t, u) => t + (u || 0), 0);
          if (units.every((u) => u != null) && stated != null && Math.abs(total - stated) < 0.001) {
            distribute = alternatives;
          }
        }
      }

      const slots = receivers.map((receiver, index) => {
        const label = receiver.receiving?.name || '';
        const { alternatives, conjunction } = distribute
          ? { alternatives: [distribute[index]], conjunction: 'single' }
          : codeExpression(label);
        const resolved = alternatives.map((rawCode) => {
          let code = rawCode;
          if (!byCode.has(code)) {
            const split = splitAgainstPrefixes(code.replace(/\s+/g, ''), byCode.prefixes);
            if (split && byCode.has(split)) code = split;
          }
          const hit = (byCode.get(code) || [])[0];
          return {
            code,
            parent_id: hit?.parent_id ?? null,
            title: hit?.title ?? null,
            units: hit?.units ?? null,
            source: hit?.source ?? null,
          };
        });
        const known = resolved.filter((r) => r.units != null);
        // An OR slot is satisfied by ONE alternative, so each alternative must
        // match the slot's units; an AND slot needs them all, so they must sum
        // to it. Using the wrong rule either double-counts a choice or splits a
        // required sequence.
        const target = distribute ? (known[0]?.units ?? null) : perSlot;
        const complete = known.length === resolved.length && known.length > 0 && target != null;
        const sum = known.reduce((t, r) => t + r.units, 0);
        const unitsAgree = complete && (distribute ? true : (conjunction === 'and'
          ? Math.abs(sum - perSlot) < 0.001
          : known.every((r) => Math.abs(r.units - perSlot) < 0.001)));
        return {
          label, conjunction, resolved,
          slot_units: distribute ? (known[0]?.units ?? perSlot) : perSlot,
          fillable: unitsAgree,
          reason: conjunction === 'range' ? 'range/category — no discrete course to name'
            : !resolved.length ? 'no course code in the label'
              : known.length < resolved.length ? `not in catalogue: ${resolved.filter((r) => r.units == null).map((r) => r.code).join(', ')}`
                : unitsAgree ? 'ok'
                  : perSlot == null ? 'section states no units — nothing to reconcile against'
              : `units differ (${conjunction}): ${known.map((r) => `${r.code}=${r.units}u`).join(', ')} vs slot ${perSlot}u`,
        };
      });

      const fillable = cls === 'named' && slots.length > 0 && slots.every((s2) => s2.fillable);
      sections.push({
        group: group.title || null,
        tier: section.tier || group.tier || null,
        stated_units: stated,
        per_slot_units: perSlot,
        class: cls,
        slots,
        reconciles: fillable,
        verdict: cls !== 'named' ? `left as ${cls}`
          : fillable ? 'FILL'
            : slots.map((s2) => s2.reason).find((r) => r !== 'ok') || 'unresolved',
      });
    }
  }
  return sections;
}

async function main() {
  const docId = arg('doc');
  const major = arg('major', 'cs');
  const apply = process.argv.includes('--apply');

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const filter = docId
    ? { _id: docId }
    : { state: { $exists: false }, kind: 'degree', major_slug: major };
  const degrees = await db.collection('curated_requirements').find(filter).sort({ _id: 1 }).toArray();
  if (!degrees.length) throw new Error(`no degree documents matched ${JSON.stringify(filter)}`);

  const report = [];
  for (const degree of degrees) {
    const [assistCourses, catalogue] = await Promise.all([
      db.collection('assist_courses')
        .find({ institution_id: `uc:${degree.school_id}`, parent_id: { $exists: true, $ne: null } }).toArray(),
      db.collection('curated_prerequisites')
        .find({ institution_id: `uc:${degree.school_id}` }).toArray(),
    ]);
    const courses = [...catalogue, ...assistCourses];
    const sections = proposeForDegree(degree, courses);
    report.push({ doc: degree._id, school: degree.school, catalog_courses: courses.length, catalogue_rows: catalogue.length, sections });

    const tally = {};
    for (const s of sections) {
      const key = s.verdict.startsWith('FILL') ? 'FILL'
        : s.verdict.startsWith('left as') ? s.verdict : s.verdict.split(':')[0];
      tally[key] = (tally[key] || 0) + 1;
    }
    console.log(`\n=== ${degree.school} (${degree._id}) — ${sections.length} unit-only sections, ${catalogue.length} catalogue + ${assistCourses.length} ASSIST courses ===`);
    Object.entries(tally).sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => console.log('  ', String(n).padStart(3), k));

    for (const sec of sections.filter((x) => x.class === 'named')) {
      console.log(`   ${sec.reconciles ? '✓' : '·'} ${String(sec.stated_units ?? '—').padStart(4)}u  ${sec.verdict}`);
      for (const slot of sec.slots) {
        const shown = slot.resolved.map((r) => `${r.code}${r.units != null ? `(${r.units}u)` : '[?]'}`).join(slot.conjunction === 'or' ? ' OR ' : ' + ');
        console.log(`        ${String(slot.slot_units ?? '—').padStart(4)}u  ${(shown || '(no codes)').slice(0, 74).padEnd(75)} ${slot.reason === 'ok' ? '' : slot.reason}`);
      }
    }
  }

  const outPath = path.resolve(__dirname, '../data/degree-course-gaps.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), report }, null, 1));
  console.log(`\nwrote ${path.relative(process.cwd(), outPath)}`);

  const fillable = report.flatMap((r) => r.sections).filter((s) => s.reconciles);
  console.log(`\nsections that reconcile exactly and could be filled now: ${fillable.length}`);
  if (apply) console.log('(--apply is not implemented yet: review the proposal first)');
  await client.close();
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });

module.exports = { proposeForDegree, codeExpression, sectionClass, catalogIndex };
