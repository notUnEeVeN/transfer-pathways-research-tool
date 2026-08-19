/**
 * Build Massachusetts documents in the exact shapes the California engine
 * reads, from the raw JSON the converter produces.
 *
 * The point of every choice here is that pathways.js, degreeSlots.js and
 * transferCreditRate.js run over these documents UNCHANGED. Templates are
 * course-count-shaped like the nine CA CS templates; the paper's per-course
 * articulation booleans become agreement receivers; the recovered pathway
 * overlays become the receivers' sending-course options so credit
 * accounting works; and everything carries `state: 'ma'` plus reserved id
 * ranges so nothing can bleed into California queries.
 *
 * GE handling: the resident plans include the general-education courses the
 * heatmap analysis deliberately excluded. They become one GE-titled group
 * per template with minted parent_ids of their own — the GE title keeps them
 * out of the paper-population course lens (their Fig 1), while the parent_ids
 * let their GE↔GE transfer mappings flow through the engine as ordinary
 * named articulation (their Fig 3 includes GE by construction).
 */

const MA_UNIVERSITIES = [
  'Bridgewater', 'Fitchburg', 'Framingham', 'MCLA', 'Salem',
  'UMass Amherst', 'UMass Boston', 'UMass Dartmouth', 'UMass Lowell',
  'Westfield', 'Worcester',
];
const MA_COLLEGES = [
  'Berkshire', 'Bristol', 'Bunker Hill', 'Cape Cod', 'Greenfield',
  'Holyoke', 'Massasoit', 'MassBay', 'Middlesex', 'Mount Wachusett',
  'North Shore', 'Northern Essex', 'Quinsigamond', 'Roxbury',
  'Springfield Technical',
];

const MA_SCHOOL_IDS = Object.freeze(Object.fromEntries(
  MA_UNIVERSITIES.map((name, index) => [name, 9001 + index]),
));
const MA_CC_IDS = Object.freeze(Object.fromEntries(
  MA_COLLEGES.map((name, index) => [name, 9101 + index]),
));

const PROGRAM = 'Computer Science, B.S.';

const normName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const codeKey = (prefix, number) => `${String(prefix || '').toUpperCase().trim()} ${String(number || '').toUpperCase().trim()}`;

function idFor(map, base, name) {
  if (map[name] != null) return map[name];
  // Fixture/unknown names get deterministic ids after the reserved block.
  const extras = Object.keys(map).filter((key) => map[key] >= base + 500).sort();
  const assigned = base + 500 + extras.length;
  map[name] = assigned;
  return assigned;
}

function courseKeySet(courses) {
  const byCode = new Set();
  const byName = new Set();
  for (const course of courses) {
    byCode.add(codeKey(course.prefix, course.number));
    byName.add(normName(course.name));
  }
  return { byCode, byName };
}

// Where a baseline measure's numbers come from: the repo workbook for the
// original tabs, or the numbered final-PDF figure for a transcribed revision.
function baselineSource(measure) {
  const pdfFigures = {
    pct_as_pdf: 3,
    extra_hours_pdf: 4,
    extra_cost_pdf: 5,
  };
  return pdfFigures[measure]
    ? `final PDF Figure ${pdfFigures[measure]} (see data/ma/pdf-figures.json)`
    : 'CurrComp Master.xlsx';
}

// Codes whose number is a stand-in ("ELEC xxx", "XXXX 199", "SLOT n"): the
// category lives in the NAME, so the bare code identifies nothing and must
// never satisfy a claim by itself.
const PLACEHOLDER_CODE = /^(ELEC|XXXX|SLOT)\b/;

/**
 * The overlay's removal credits as a consumable multiset. Each removed
 * resident row is ONE credit; each template course may claim at most one —
 * exact (code+name) first, then code alone (real codes only), then name.
 * Set-membership loses multiplicity, and with placeholder codes it loses the
 * category too — both collapse kept rows into removed ones.
 */
function makeRemovedClaims(removedCourses) {
  const credits = removedCourses.map((course) => ({
    code: codeKey(course.prefix, course.number),
    name: normName(course.name),
    used: false,
  }));
  const consume = (predicate) => {
    const credit = credits.find((row) => !row.used && predicate(row));
    if (!credit) return false;
    credit.used = true;
    return true;
  };
  return {
    claim({ code, name }) {
      return consume((row) => row.code === code && row.name === name)
        || (!PLACEHOLDER_CODE.test(code) && consume((row) => row.code === code))
        || consume((row) => row.name === name);
    },
  };
}

/** Courses of `all` that do NOT appear in `kept` — the overlay's removals. */
function removedFrom(all, kept) {
  const keys = courseKeySet(kept);
  return all.filter((course) => !keys.byCode.has(codeKey(course.prefix, course.number))
    && !keys.byName.has(normName(course.name)));
}

/**
 * Which resident-plan courses did the overlay remove?
 *
 * The layered pathway is (resident − removed) ⊎ (all AS courses), but the
 * sides share names ("Calculus I" in both catalogs) and even placeholder
 * codes ("ELEC xxx" marks electives in all three lists), so provenance must
 * respect MULTIPLICITY. Each pathway row consumes one catalog entry, best
 * match first: exact code+name in the resident plan, exact in the AS, code
 * in the resident, code in the AS, name in the resident, name in the AS.
 * Whatever resident entries stay unconsumed are the removed requirements —
 * the ones satisfied by transfer.
 */
function removedResidentByMatching(resident, asCourses, pathway) {
  const pools = { resident: new Map(), as: new Map() };
  const push = (pool, key, ref) => {
    if (!pools[pool].has(key)) pools[pool].set(key, []);
    pools[pool].get(key).push(ref);
  };
  const consumed = new Set();
  const refs = resident.map((course, index) => ({ course, index }));
  refs.forEach((ref) => {
    const code = codeKey(ref.course.prefix, ref.course.number);
    const name = normName(ref.course.name);
    push('resident', `1|${code}|${name}`, ref);
    push('resident', `2|${code}`, ref);
    push('resident', `3|${name}`, ref);
  });
  asCourses.forEach((course) => {
    const ref = { course, as: true };
    const code = codeKey(course.prefix, course.number);
    const name = normName(course.name);
    push('as', `1|${code}|${name}`, ref);
    push('as', `2|${code}`, ref);
    push('as', `3|${name}`, ref);
  });
  const take = (pool, key) => {
    const bucket = pools[pool].get(key);
    while (bucket && bucket.length) {
      const ref = bucket.shift();
      if (ref.as) { if (!ref.taken) { ref.taken = true; return ref; } continue; }
      if (!consumed.has(ref.index)) { consumed.add(ref.index); return ref; }
    }
    return null;
  };
  const unmatched = [];
  for (const row of pathway) {
    const code = codeKey(row.prefix, row.number);
    const name = normName(row.name);
    const hit = take('resident', `1|${code}|${name}`)
      || take('as', `1|${code}|${name}`)
      || take('resident', `2|${code}`)
      || take('as', `2|${code}`)
      || take('resident', `3|${name}`)
      || take('as', `3|${name}`);
    if (!hit) unmatched.push(row);
  }
  // Hand edits leave typos and renames ("Computer Scince I") that the exact
  // tiers miss; a final fuzzy pass matches leftover rows to leftover catalog
  // entries by shared name tokens, so a renamed kept course is not
  // misreported as removed.
  const tokens = (text) => new Set(String(text || '').toLowerCase()
    .split(/[^a-z0-9+]+/).filter((token) => token.length > 1));
  for (const row of unmatched) {
    const rowTokens = tokens(row.name);
    let best = null;
    resident.forEach((course, index) => {
      if (consumed.has(index)) return;
      let shared = 0;
      for (const token of tokens(course.name)) if (rowTokens.has(token)) shared += 1;
      if (shared > 0 && (!best || shared > best.shared)) best = { index, shared };
    });
    if (best) consumed.add(best.index);
  }
  return resident.filter((course, index) => !consumed.has(index));
}

/**
 * Recover each university's per-credit tuition from the paper's own artifacts.
 *
 * The published Cost tab is "Cost of Tuition & Fees over 120 Credits":
 * (credit hours − 120) × a flat per-credit rate. The rate is therefore
 * recoverable wherever a pair (or a resident plan) exceeds 120 hours, and on
 * the real workbook every university's implied rate is constant across all of
 * its cells (Bridgewater $488.92 … UMass Amherst $740.50). A university whose
 * cells never exceed 120 hours stays unpriced — no guessing.
 */
function deriveTuitionRates(raw) {
  const samples = new Map();
  const push = (school, cost, hours) => {
    if (cost == null || hours == null || hours <= 120 || cost <= 0) return;
    if (!samples.has(school)) samples.set(school, []);
    samples.get(school).push(cost / (hours - 120));
  };
  const cost = raw.baselines?.cost || {};
  const hours = raw.baselines?.credit_hours || {};
  for (const [cc, bySchool] of Object.entries(cost.cells || {})) {
    for (const [school, value] of Object.entries(bySchool)) {
      push(school, value, hours.cells?.[cc]?.[school]);
    }
  }
  for (const [school, value] of Object.entries(cost.resident || {})) {
    push(school, value, hours.resident?.[school]);
  }

  const rates = new Map();
  const warnings = [];
  for (const [school, list] of samples) {
    const min = Math.min(...list);
    const max = Math.max(...list);
    if (max - min > 0.5) {
      warnings.push(`${school}: implied per-credit rate spreads $${min.toFixed(2)}–$${max.toFixed(2)} across its own cost cells`);
      continue;
    }
    rates.set(school, +(list.reduce((sum, rate) => sum + rate, 0) / list.length).toFixed(2));
  }
  return { rates, warnings };
}

function buildMaDocuments(raw) {
  const schoolIds = { ...MA_SCHOOL_IDS };
  const ccIds = { ...MA_CC_IDS };

  const institutions = [];
  const degrees = [];
  const asDegrees = [];
  const agreements = [];
  const courses = [];
  const baselines = [];

  // ── Community colleges and their AS degrees ─────────────────────────────
  for (const [cc, as] of Object.entries(raw.as_degrees || {})) {
    const ccId = idFor(ccIds, 9100, cc);
    institutions.push({
      _id: `ma:cc:${ccId}`,
      institution_id: `ma:cc:${ccId}`,
      kind: 'community_college',
      source_id: ccId,
      name: `${cc} Community College`,
      state: 'ma',
      academic_calendar: 'semester',
    });
    const receivers = [];
    for (const course of as.courses) {
      const courseId = ccId * 1000 + course.id;
      courses.push({
        _id: `ma:sending:${courseId}`,
        institution_id: `ma:cc:${ccId}`,
        source_id: courseId,
        side: 'sending',
        course_id: courseId,
        prefix: course.prefix,
        number: course.number,
        title: course.name,
        units: course.credits ?? 0,
        uc_transferable: true,
        community_college_id: ccId,
        state: 'ma',
      });
      receivers.push({
        receiving: { kind: 'requirement', parent_id: null },
        articulation_status: null,
        options: [{ course_ids: [courseId], course_conjunction: 'and' }],
      });
    }
    asDegrees.push({
      _id: `as_degree:ma:${ccId}:local_as`,
      kind: 'as_degree',
      degree_type: 'local_as',
      major_slug: 'ma-cs',
      state: 'ma',
      status: 'found',
      // asDegreeDetail (the shared per-college view) joins on this field.
      college_id: `ma:cc:${ccId}`,
      community_college_id: ccId,
      college_name: `${cc} Community College`,
      total_units: as.courses.reduce((sum, course) => sum + (course.credits || 0), 0),
      unit_system: 'semester',
      catalog_year: '2024-25',
      verification: { verified: true, verified_by: 'paper source (recovered workbook)' },
      requirement_groups: [{
        title: 'Associate degree requirements',
        label_seen: 'Associate degree requirements',
        ge_area: null,
        units_fill: false,
        sections: [{
          section_advisement: receivers.length,
          receivers,
        }],
      }],
    });
  }

  // ── Universities, templates, agreements ─────────────────────────────────
  const tuition = deriveTuitionRates(raw);
  for (const university of (raw.heatmap?.universities || [])) {
    const schoolId = idFor(schoolIds, 9000, university.name);
    const perCredit = tuition.rates.get(university.name);
    institutions.push({
      _id: `ma:uni:${schoolId}`,
      institution_id: `ma:uni:${schoolId}`,
      kind: 'university',
      source_id: schoolId,
      name: university.name,
      state: 'ma',
      academic_calendar: 'semester',
      // Per-credit tuition recovered from the paper's own Cost tab (see
      // deriveTuitionRates). The annual field re-expresses it on the credit-
      // rate pricer's convention (perSemesterUnit = annual / 24), so the
      // unmodified California cost pipeline prices extra units at exactly the
      // paper's rate.
      ...(perCredit != null ? {
        tuition_per_credit_usd: perCredit,
        tuition_annual_resident_usd: +(perCredit * 24).toFixed(2),
        // This is not an independently sourced annual sticker price. It is the
        // campus-constant rate recoverable from the paper repository's own Cost
        // tab, re-expressed on the shared pricer's annual/24 convention.
        tuition_source: 'CurrComp Master.xlsx Cost tab (cost divided by pathway hours above 120)',
      } : {}),
    });

    const resident = raw.pathways?.[university.name]?.resident || [];
    // Heatmap-column matching CONSUMES resident rows, one per column — a Set
    // lookup let a single resident row satisfy every same-code column AND
    // then swallowed its duplicates out of the residue. Framingham lists 31
    // resident rows against 20 matrix columns; the Set filter left FOUR
    // residue receivers, so most GE transfers at its pairs could never earn
    // credit and the Massasoit cell starved at 10 of 43 removed units.
    const residentPool = resident.map((row) => ({
      row,
      code: codeKey(row.prefix, row.number),
      name: normName(row.name),
      used: false,
    }));
    const consumeResident = (course) => {
      const code = codeKey(course.prefix, course.number);
      const name = normName(course.header || course.name);
      const entry = residentPool.find((item) => !item.used && item.code === code)
        || residentPool.find((item) => !item.used && item.name === name);
      if (!entry) return null;
      entry.used = true;
      return entry.row;
    };

    const modelingNotes = [];
    // Template courses: heatmap courses first (their analysis population),
    // then the resident GE/elective residue. parent_id = schoolId*1000+index.
    const templateCourses = university.courses.map((course, index) => {
      const residentRow = consumeResident(course);
      if (!residentRow) {
        modelingNotes.push(`No resident-plan row for "${course.header}"; 4-credit assumption used.`);
      }
      return {
        parent_id: schoolId * 1000 + index,
        code: codeKey(course.prefix, course.number),
        name: course.header,
        tokenSource: `${course.header} ${residentRow?.name || ''}`,
        upper: course.upper,
        ge: false,
        credits: residentRow?.credits ?? 4,
        residentKeys: residentRow
          ? { code: codeKey(residentRow.prefix, residentRow.number), name: normName(residentRow.name) }
          : { code: codeKey(course.prefix, course.number), name: normName(course.header) },
      };
    });
    // The residue — every resident row NO heatmap column consumed — is the
    // GE/elective block. Multiset complement, so duplicate codes and names
    // (three "Free elec" rows, two writing courses) each keep their own slot.
    let geIndex = templateCourses.length;
    for (const entry of residentPool) {
      if (entry.used) continue;
      const row = entry.row;
      templateCourses.push({
        parent_id: schoolId * 1000 + geIndex,
        code: codeKey(row.prefix, row.number),
        name: row.name,
        tokenSource: `${row.name} ${codeKey(row.prefix, row.number)}`,
        upper: false,
        ge: true,
        credits: row.credits ?? 0,
        residentKeys: { code: codeKey(row.prefix, row.number), name: normName(row.name) },
      });
      geIndex += 1;
    }

    for (const course of templateCourses) {
      courses.push({
        _id: `ma:receiving:${course.parent_id}`,
        institution_id: `ma:uni:${schoolId}`,
        source_id: course.parent_id,
        side: 'receiving',
        parent_id: course.parent_id,
        prefix: course.code.split(' ')[0],
        number: course.code.split(' ').slice(1).join(' '),
        title: course.name,
        min_units: course.credits,
        max_units: course.credits,
        state: 'ma',
      });
    }

    const groupOf = (subset, title, tier) => ({
      title,
      tier,
      group_conjunction: 'And',
      course_level: null,
      cc_articulable: tier === 'nontransferable' ? false : true,
      sections: [{
        section_advisement: subset.length,
        unit_advisement: +subset.reduce((sum, course) => sum + course.credits, 0).toFixed(1),
        tier,
        receivers: subset.map((course) => ({
          receiving: { kind: 'course', parent_id: course.parent_id, code: course.code, name: course.name },
        })),
      }],
    });
    const lower = templateCourses.filter((course) => !course.ge && !course.upper);
    const upper = templateCourses.filter((course) => !course.ge && course.upper);
    const ge = templateCourses.filter((course) => course.ge);
    degrees.push({
      _id: `degree:${schoolId}:ma-cs`,
      kind: 'degree',
      major_slug: 'ma-cs',
      state: 'ma',
      school_id: schoolId,
      school: university.name,
      program: PROGRAM,
      total_units: +resident.reduce((sum, row) => sum + (row.credits || 0), 0).toFixed(1),
      unit_system: 'semester',
      catalog_year: '2024-25',
      research_status: 'paper_source',
      source_method: 'Imported from the recovered Massachusetts paper workbooks; see server/data/ma/PROVENANCE.md',
      modeling_notes: modelingNotes,
      requirement_groups: [
        groupOf(lower, 'Lower-division major requirements', 'transferable'),
        groupOf(upper, 'Upper-division major requirements', 'nontransferable'),
        groupOf(ge, "GE: general education and electives (excluded from the paper's articulation analysis)", 'transferable'),
      ],
    });

    // Agreements: one per community college that appears in the matrix.
    const pairs = raw.pathways?.[university.name]?.pairs || {};
    for (const [cc, verdicts] of Object.entries(university.matrix || {})) {
      const ccId = idFor(ccIds, 9100, cc);
      const asCourses = raw.as_degrees?.[cc]?.courses || [];
      const pathway = pairs[cc] || null;

      // The overlay: courses on either side that the pathway no longer
      // carries were matched away by transfer. Removal credits are a
      // MULTISET consumed one template course at a time — a Set collapsed
      // placeholder multiplicity (Bridgewater lists eleven "ELEC xxx" GE
      // slots; six removed against Bristol lit up all eleven, crediting the
      // kept Arts/Humanities rows and overstating the pair at 100%).
      const removedClaims = pathway
        ? makeRemovedClaims(removedResidentByMatching(resident, asCourses, pathway))
        : null;
      // One decision per template course, in template order: did the overlay
      // remove this row? Placeholder codes (ELEC xxx / XXXX / SLOT) carry the
      // category in the NAME, so they never claim on the bare code — six
      // removed "Social Science / Global Culture" slots must not satisfy a
      // kept "Arts" slot that happens to share the ELEC xxx code.
      const overlayRemoved = templateCourses.map((course) => (
        removedClaims ? removedClaims.claim(course.residentKeys) : false
      ));

      const articulatedFlags = templateCourses.map((course, index) => {
        if (!course.ge) return Boolean(verdicts[index]);
        // GE courses articulate when the overlay removed their resident row.
        return overlayRemoved[index];
      });

      // Options: the layered pathway keeps every AS course (the student takes
      // the whole associate degree) and removes only satisfied BS
      // requirements, so the per-course AS↔BS pairing exists nowhere in the
      // source. Recover it by name similarity — the AS calculus pairs to the
      // removed calculus requirement — greedy best-match first, one AS course
      // per receiver, order fallback for what similarity cannot place. The
      // agreement declares the approximation (`pairing`), and the
      // reproduction report diffs the resulting credit totals against the
      // published `% Credit Hours` cells.
      const optionsByIndex = new Map();
      if (pathway) {
        const tokens = (text) => new Set(String(text || '').toLowerCase()
          .split(/[^a-z0-9+]+/).filter((token) => token.length > 1));
        // Only requirements the overlay REMOVED consumed an AS course. A
        // boolean-true receiver the pathway kept is the paper's designed
        // offerings-vs-AS gap: articulable at the college, absent from the
        // AS, so nothing was consumed and it earns no option.
        const articulatedIndexes = articulatedFlags
          .map((flag, index) => (flag ? index : -1))
          .filter((index) => index >= 0)
          .filter((index) => overlayRemoved[index]);
        const candidates = [];
        for (const index of articulatedIndexes) {
          const receiverTokens = tokens(templateCourses[index].tokenSource);
          asCourses.forEach((course, asIndex) => {
            let shared = 0;
            for (const token of tokens(course.name)) {
              if (receiverTokens.has(token)) shared += 1;
            }
            if (shared > 0) candidates.push({ index, asIndex, shared });
          });
        }
        candidates.sort((a, b) => b.shared - a.shared || a.index - b.index || a.asIndex - b.asIndex);
        const usedReceivers = new Set();
        const usedAs = new Set();
        for (const candidate of candidates) {
          if (usedReceivers.has(candidate.index) || usedAs.has(candidate.asIndex)) continue;
          usedReceivers.add(candidate.index);
          usedAs.add(candidate.asIndex);
          optionsByIndex.set(candidate.index, [{
            course_ids: [ccId * 1000 + asCourses[candidate.asIndex].id],
            course_conjunction: 'and',
          }]);
        }
        // Order fallback: articulated receivers similarity could not place
        // consume the remaining AS courses in catalog order.
        const bareReceivers = articulatedIndexes.filter((index) => !usedReceivers.has(index));
        const leftoverAs = asCourses.map((course, asIndex) => ({ course, asIndex }))
          .filter(({ asIndex }) => !usedAs.has(asIndex));
        bareReceivers.forEach((index, position) => {
          const leftover = leftoverAs[position];
          if (!leftover) return;
          optionsByIndex.set(index, [{
            course_ids: [ccId * 1000 + leftover.course.id],
            course_conjunction: 'and',
          }]);
        });
      }

      agreements.push({
        _id: `ma:agreement:${schoolId}:${ccId}`,
        university_id: `ma:uni:${schoolId}`,
        college_id: `ma:cc:${ccId}`,
        uc_school_id: schoolId,
        community_college_id: ccId,
        major: PROGRAM,
        state: 'ma',
        source: pathway ? 'paper heatmap + pathway overlay' : 'paper heatmap',
        pairing: pathway ? 'order-approximate' : 'booleans-only',
        requirement_groups: [{
          sections: [{
            receivers: templateCourses.map((course, index) => ({
              receiving: { kind: 'course', parent_id: course.parent_id, code: course.code, name: course.name },
              articulation_status: articulatedFlags[index] ? 'articulated' : 'not_articulated',
              options: optionsByIndex.get(index) || [],
            })),
          }],
        }],
      });
    }
  }

  // ── Published baselines ─────────────────────────────────────────────────
  for (const [measure, block] of Object.entries(raw.baselines || {})) {
    for (const [uniName, value] of Object.entries(block.resident || {})) {
      baselines.push({
        _id: `ma:baseline:${measure}:${idFor(schoolIds, 9000, uniName)}:resident`,
        measure,
        school_id: idFor(schoolIds, 9000, uniName),
        school: uniName,
        community_college_id: null,
        value,
        state: 'ma',
        source: baselineSource(measure),
      });
    }
    for (const [cc, byUni] of Object.entries(block.cells || {})) {
      for (const [uniName, value] of Object.entries(byUni)) {
        baselines.push({
          _id: `ma:baseline:${measure}:${idFor(schoolIds, 9000, uniName)}:${idFor(ccIds, 9100, cc)}`,
          measure,
          school_id: idFor(schoolIds, 9000, uniName),
          school: uniName,
          community_college_id: idFor(ccIds, 9100, cc),
          college_name: `${cc} Community College`,
          value,
          state: 'ma',
          source: baselineSource(measure),
        });
      }
    }
  }

  return { institutions, degrees, asDegrees, agreements, courses, baselines };
}

/**
 * The importer's gate. Failures mean the built documents cannot reproduce
 * the source's own numbers and must not be written. Warnings are the
 * source's internal drifts — they ride into the reproduction report as
 * findings rather than blocking the import.
 */
function validateMaDocuments(raw, built) {
  const failures = [];
  const warnings = [];
  const notes = [];
  const agreementByPair = new Map(built.agreements.map((agreement) => [
    `${agreement.uc_school_id}|${agreement.community_college_id}`, agreement,
  ]));
  const schoolIdOf = new Map(built.institutions
    .filter((row) => row.kind === 'university').map((row) => [row.name, row.source_id]));
  const ccIdOf = new Map(built.institutions
    .filter((row) => row.kind === 'community_college')
    .map((row) => [row.name.replace(/ Community College$/, ''), row.source_id]));

  for (const university of (raw.heatmap?.universities || [])) {
    const schoolId = schoolIdOf.get(university.name);
    const heatmapCount = university.courses.length;
    const lowerCount = university.lower_count;

    for (const [cc, verdicts] of Object.entries(university.matrix || {})) {
      const agreement = agreementByPair.get(`${schoolId}|${ccIdOf.get(cc)}`);
      if (!agreement) {
        failures.push(`${university.name}/${cc}: no agreement was built for a matrix row`);
        continue;
      }
      const receivers = agreement.requirement_groups[0].sections[0].receivers;
      const flags = receivers.slice(0, heatmapCount)
        .map((receiver) => receiver.articulation_status === 'articulated');
      const lower = flags.slice(0, lowerCount).filter(Boolean).length / lowerCount;
      const all = flags.filter(Boolean).length / heatmapCount;
      if (Math.abs(lower - university.lower_ratio[cc]) > 1e-6) {
        failures.push(`${university.name}/${cc}: rebuilt lower ratio ${lower.toFixed(4)} `
          + `does not reproduce the tab's ${university.lower_ratio[cc].toFixed(4)}`);
      }
      if (Math.abs(all - university.all_ratio[cc]) > 1e-6) {
        failures.push(`${university.name}/${cc}: rebuilt all-levels ratio ${all.toFixed(4)} `
          + `does not reproduce the tab's ${university.all_ratio[cc].toFixed(4)}`);
      }

      // Overlay-vs-boolean drift: the pathway's removals and the heatmap's
      // verdicts are two hand records of one fact.
      const pathway = raw.pathways?.[university.name]?.pairs?.[cc];
      if (pathway) {
        const resident = raw.pathways[university.name].resident || [];
        const asCourses = raw.as_degrees?.[cc]?.courses || [];
        const removed = courseKeySet(removedResidentByMatching(resident, asCourses, pathway));
        university.courses.forEach((course, index) => {
          const receiver = receivers[index];
          const leftPathway = removed.byCode.has(codeKey(course.prefix, course.number))
            || removed.byName.has(normName(course.header));
          if (leftPathway && !verdicts[index]) {
            warnings.push(`${university.name}/${cc}: ${receiver.receiving.code} left the pathway `
              + 'but the heatmap says not articulated (overlay vs boolean)');
          }
          if (!leftPathway && verdicts[index]) {
            // The paper's designed Q1/Q2 difference: an equivalent exists at
            // the college (heatmap) but the AS degree does not carry it, so
            // the pathway keeps the requirement. Expected, and analytically
            // interesting — it measures the offerings-vs-AS gap.
            notes.push(`${university.name}/${cc}: ${receiver.receiving.code} stayed in the pathway `
              + 'although the heatmap says articulated (offerings vs AS contents)');
          }
        });
      }
    }

    // Resident sums against the published Resident row.
    const resident = raw.pathways?.[university.name]?.resident || [];
    const residentSum = resident.reduce((sum, row) => sum + (row.credits || 0), 0);
    const publishedResident = raw.baselines?.credit_hours?.resident?.[university.name];
    if (publishedResident != null && Math.abs(residentSum - publishedResident) > 0.5) {
      warnings.push(`${university.name}: resident plan sums ${residentSum} against the `
        + `published ${publishedResident}`);
    }

    // Pathway credit sums against the published Credit Hours cells.
    const pairs = raw.pathways?.[university.name]?.pairs || {};
    const publishedCells = raw.baselines?.credit_hours?.cells || {};
    for (const [cc, pathway] of Object.entries(pairs)) {
      const published = publishedCells[cc]?.[university.name];
      const sum = pathway.reduce((total, row) => total + (row.credits || 0), 0);
      if (published == null) {
        warnings.push(`${university.name}/${cc}: pathway tab exists with no published Credit Hours cell`);
      } else if (Math.abs(sum - published) > 0.5) {
        // Cross-artifact drift in the source: the published summary sheet and
        // the pathway tab disagree (UMass Boston/MassBay matches neither
        // revision of the tab). Our import carries the course-level tab; the
        // reproduction report quantifies the drift.
        warnings.push(`${university.name}/${cc}: pathway sums ${sum} against the published ${published}`);
      }
    }
    for (const [cc, byUni] of Object.entries(publishedCells)) {
      if (byUni[university.name] != null && !pairs[cc]) {
        failures.push(`${university.name}/${cc}: published Credit Hours cell has no pathway tab`);
      }
    }
  }

  for (const degree of built.degrees) {
    for (const note of degree.modeling_notes || []) {
      notes.push(`${degree.school}: ${note}`);
    }
  }
  return { failures, warnings, notes };
}

module.exports = {
  buildMaDocuments, validateMaDocuments, deriveTuitionRates,
  removedResidentByMatching,
  MA_SCHOOL_IDS, MA_CC_IDS, MA_UNIVERSITIES, MA_COLLEGES,
};
