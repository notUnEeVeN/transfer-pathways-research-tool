#!/usr/bin/env node
/**
 * Builds analysis/data/ipeds_ccc.v1.json — IPEDS directory + enrollment facts
 * for the 115 California community colleges in the corpus.
 *
 * Inputs (downloaded from nces.ed.gov/ipeds/datacenter/data/):
 *   HD2023.csv      — directory: name, city, sector, NCES locale code
 *   EFFY2023_RV.csv — 12-month unduplicated headcount by race/ethnicity
 * Matching: normalized-name match against pmt_data.community_colleges,
 * with an explicit alias map for naming differences. Unmatched colleges are
 * listed loudly rather than silently dropped.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const SCRATCH = process.argv[2];
if (!SCRATCH) { console.error('usage: node _build_ipeds_artifact.js <dir with HD2023.csv/EFFY2023_RV.csv>'); process.exit(1); }
const OUT = path.resolve(__dirname, '../../analysis/data/ipeds_ccc.v1.json');

function parseCsv(raw) {
  // Strip the UTF-8 BOM (appears as 'ï»¿' when the file is read as latin1).
  const text = raw.replace(/^﻿|^ï»¿/, '');
  const rows = []; let row = []; let cur = ''; let inQ = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i += 1; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (cur !== '' || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; }
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const norm = (s) => String(s || '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

// pmt_data name -> IPEDS INSTNM, for names that don't survive normalization.
const ALIASES = {
  'Mt. San Jacinto College': 'Mt San Jacinto Community College District',
  'Mount San Antonio College': 'Mt San Antonio College',
  'El Camino College': 'El Camino Community College District',
  'Copper Mountain College': 'Copper Mountain Community College',
  'Antelope Valley College': 'Antelope Valley Community College District',
  'Feather River College': 'Feather River Community College District',
};

(async () => {
  const hd = parseCsv(fs.readFileSync(path.join(SCRATCH, 'HD2023.csv'), 'latin1'));
  const hdHead = hd[0];
  const hcol = (name) => hdHead.indexOf(name);
  const ca2yr = hd.slice(1).filter((r) => r[hcol('STABBR')] === 'CA'
    && ['1', '4'].includes(r[hcol('SECTOR')]));
  const byNorm = new Map();
  for (const r of ca2yr) byNorm.set(norm(r[hcol('INSTNM')]), r);

  const effy = parseCsv(fs.readFileSync(path.join(SCRATCH, 'EFFY2023_RV.csv'), 'latin1'));
  const eHead = effy[0];
  const ecol = (name) => eHead.indexOf(name);
  const enrollByUnit = new Map();
  for (const r of effy.slice(1)) {
    if (r[ecol('EFFYALEV')] !== '1') continue; // all-students total row
    enrollByUnit.set(r[ecol('UNITID')], {
      headcount: Number(r[ecol('EFYTOTLT')]),
      hispanic: Number(r[ecol('EFYHISPT')]),
      white: Number(r[ecol('EFYWHITT')]),
      black: Number(r[ecol('EFYBKAAT')]),
      asian: Number(r[ecol('EFYASIAT')]),
      americanIndian: Number(r[ecol('EFYAIANT')]),
      pacificIslander: Number(r[ecol('EFYNHPIT')]),
      twoOrMore: Number(r[ecol('EFY2MORT')]),
      unknown: Number(r[ecol('EFYUNKNT')]),
      nonresident: Number(r[ecol('EFYNRALT')]),
    });
  }

  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const colleges = await client.db('pmt_data').collection('community_colleges')
    .find({}, { projection: { id: 1, name: 1 } }).toArray();
  await client.close();

  const out = []; const unmatched = [];
  for (const c of colleges) {
    const target = ALIASES[c.name] || c.name;
    const r = byNorm.get(norm(target));
    if (!r) { unmatched.push(c.name); continue; }
    const unitid = r[hcol('UNITID')];
    const enroll = enrollByUnit.get(unitid) || null;
    out.push({
      college_id: c.id,
      name: c.name,
      ipeds_unitid: Number(unitid),
      ipeds_name: r[hcol('INSTNM')],
      city: r[hcol('CITY')],
      locale: Number(r[hcol('LOCALE')]),
      ...(enroll || { headcount: null }),
    });
  }

  console.log(`matched ${out.length}/${colleges.length}`);
  if (unmatched.length) {
    console.log('UNMATCHED:', JSON.stringify(unmatched, null, 1));
    console.log('\nCandidate IPEDS names not used:');
    const used = new Set(out.map((o) => o.ipeds_name));
    for (const r of ca2yr) {
      if (!used.has(r[hcol('INSTNM')])) console.log(' ·', r[hcol('INSTNM')], `(${r[hcol('CITY')]})`);
    }
  }
  if (process.argv.includes('--write')) {
    const artifact = {
      dataset_version: 'ipeds-ccc.2023.v1',
      source: {
        name: 'IPEDS HD2023 (directory, NCES locale) and EFFY2023 revised (12-month unduplicated headcount by race/ethnicity)',
        publisher: 'U.S. Department of Education, National Center for Education Statistics',
        page: 'https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx',
        year: '2022-23',
        license: 'public domain (U.S. federal data)',
      },
      method: 'California public institutions from HD2023 matched by normalized name (plus explicit aliases) to the 115 corpus community colleges; enrollment is the EFFYALEV=1 all-students 12-month unduplicated headcount. Locale is the NCES urban-centric code (11-13 city, 21-23 suburb, 31-33 town, 41-43 rural).',
      colleges: out.sort((a, b) => a.college_id - b.college_id),
    };
    fs.writeFileSync(OUT, JSON.stringify(artifact, null, 1));
    console.log(`wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
