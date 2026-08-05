#!/usr/bin/env node
/**
 * Capture each UC major's REQUIRED courses, so a resident degree pathway can be
 * built for the curricular-complexity figure.
 *
 *   node scripts/captureUcMajorRequirements.js --list
 *   node scripts/captureUcMajorRequirements.js
 *
 * Only required courses are wanted, not elective catalogues. The MA paper's
 * method names the courses a degree requires, resolves any choice by taking the
 * option with the fewest prerequisites, and fills the remaining credits with
 * generic courses carrying no prerequisites. Generic filler contributes delay 1
 * and blocking 0, so an unbounded elective list changes nothing — which is why
 * the enumeration stops at the required core.
 *
 * Program pages are found from each campus's own index rather than guessed, and
 * the resolved URL is recorded next to the courses so a verifier can open the
 * page the list came from.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../.uc-catalogs');
const OUT = path.join(ROOT, 'majors');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const flag = (name) => process.argv.includes(`--${name}`);

/**
 * `index` is crawled for links whose text matches a major's pattern. `direct`
 * skips discovery where a campus files majors at a predictable path.
 */
const CAMPUSES = Object.freeze({
  7: {
    campus: 'UC San Diego',
    direct: {
      cs: 'https://catalog.ucsd.edu/curric/CSE-ug.html',
      bio: 'https://catalog.ucsd.edu/curric/BIOL-ug.html',
      econ: 'https://catalog.ucsd.edu/curric/ECON-ug.html',
    },
  },
  89: {
    campus: 'UC Davis',
    index: 'https://catalog.ucdavis.edu/departments-programs-degrees/',
    match: {
      cs: /^Computer Science, Bachelor of Science/i,
      bio: /^Biological Sciences, Bachelor of Science/i,
      econ: /^Economics, Bachelor of (Arts|Science)/i,
    },
  },
  120: {
    campus: 'UC Irvine',
    direct: {
      cs: 'https://catalogue.uci.edu/donaldbrenschoolofinformationandcomputersciences/departmentofcomputerscience/#majorstext',
      bio: 'https://catalogue.uci.edu/charliedunlopschoolofbiologicalsciences/#majorstext',
      econ: 'https://catalogue.uci.edu/schoolofsocialsciences/departmentofeconomics/#majorstext',
    },
  },
  132: {
    campus: 'UC Santa Cruz',
    direct: {
      cs: 'https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computer-science-and-engineering/computer-science-bs/',
      bio: 'https://catalog.ucsc.edu/en/current/general-catalog/academic-units/physical-and-biological-sciences/molecular-cell-and-developmental-biology/molecular-cell-and-developmental-biology-bs/',
      econ: 'https://catalog.ucsc.edu/en/current/general-catalog/academic-units/social-sciences/economics/economics-ba/',
    },
  },
});

const strip = (html) => String(html)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&[a-z#0-9]+;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Course codes on a program page, split by division. */
function coursesOn(html) {
  const text = strip(html);
  const CODE = /\b((?:[A-Z&]{1,4}\s+)?[A-Z&]{2,6})\s?(\d{1,3}[A-Z]{0,2})\b/g;
  const seen = new Map();
  let m;
  while ((m = CODE.exec(text)) !== null) {
    const prefix = m[1].trim();
    // Skip prose words that look like a prefix.
    if (/^(AND|OR|THE|ONE|TWO|ALL|ANY|FROM|WITH|FOR|OF|IN|A|AN|NOTE|UNIT|UNITS)$/i.test(prefix)) continue;
    const number = Number((/\d{1,3}/.exec(m[2]) || [0])[0]);
    const code = `${prefix} ${m[2]}`;
    if (!seen.has(code)) seen.set(code, number);
  }
  const lower = [];
  const upper = [];
  for (const [code, number] of seen) (number >= 100 ? upper : lower).push(code);
  return { lower: lower.sort(), upper: upper.sort() };
}

async function discover(spec) {
  const html = await get(spec.index);
  const found = {};
  for (const [major, pattern] of Object.entries(spec.match || {})) {
    for (const m of html.matchAll(/href="([^"]+)"[^>]*>([^<]{3,120})</g)) {
      const label = strip(m[2]);
      if (!pattern.test(label)) continue;
      const url = m[1].startsWith('http') ? m[1] : new URL(m[1], spec.index).toString();
      // Discovery links are truncated on some indexes; require a real path.
      if (url.replace(spec.index, '').length < 4) continue;
      found[major] = { url, label };
      break;
    }
  }
  return found;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  for (const [schoolId, spec] of Object.entries(CAMPUSES)) {
    let targets = {};
    if (spec.direct) {
      targets = Object.fromEntries(Object.entries(spec.direct).map(([k, url]) => [k, { url, label: null }]));
    } else if (spec.index) {
      try { targets = await discover(spec); } catch (error) {
        console.log(`  ${spec.campus}: index failed — ${error.message}`);
      }
    }
    for (const [major, target] of Object.entries(targets)) {
      if (flag('list')) { console.log(`  ${spec.campus.padEnd(16)} ${major.padEnd(5)} ${target.url}`); continue; }
      try {
        const html = await get(target.url);
        const { lower, upper } = coursesOn(html);
        const file = path.join(OUT, `${schoolId}-${major}.html`);
        fs.writeFileSync(file, html);
        results.push({
          school_id: Number(schoolId), campus: spec.campus, major,
          url: target.url, label: target.label, file: path.relative(ROOT, file),
          lower_division: lower, upper_division: upper,
        });
        console.log(`  ${spec.campus.padEnd(16)} ${major.padEnd(5)}`
          + ` lower ${String(lower.length).padStart(3)}  upper ${String(upper.length).padStart(3)}`
          + `   ${upper.slice(0, 5).join(', ')}`);
      } catch (error) {
        console.log(`  ${spec.campus.padEnd(16)} ${major.padEnd(5)} failed: ${error.message}`);
      }
    }
  }
  if (!flag('list')) {
    fs.writeFileSync(path.join(OUT, 'index.json'),
      `${JSON.stringify({ captured_at: new Date().toISOString(), majors: results }, null, 1)}\n`);
    console.log(`\n${results.length} major pages captured -> ${path.join(OUT, 'index.json')}`);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
