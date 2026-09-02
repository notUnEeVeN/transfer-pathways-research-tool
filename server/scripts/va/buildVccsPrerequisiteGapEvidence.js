#!/usr/bin/env node
/**
 * Build the review ledger for VCCS courses that Figure 6 still cannot source,
 * plus the hash-bound resolutions that reduced the ledger to its current state.
 *
 * This is deliberately not a prerequisite override file. A historical menu,
 * a Transfer Virginia title, or an unbounded empty page cannot establish a
 * prerequisite formula or a no-stated-requisite finding. Rows remain blocked
 * until an official VCCS record or controlled owner-complete record supplies
 * that fact.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const {
  adaptVccsPrerequisiteArtifact,
} = require('../../services/virginia/pathwayComplexityPrerequisites');
const {
  parseVccsCoursePage,
} = require('../../services/virginia/vccsCourse');
const {
  loadSouthwestVccsPrerequisiteEvidence,
} = require('../../services/virginia/southwestVccsPrerequisiteEvidence');
const {
  loadLaurelRidgeVccsPrerequisiteEvidence,
} = require('../../services/virginia/laurelRidgeVccsPrerequisiteEvidence');

const SERVER = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(SERVER, '..');
const DEFAULT_SCOPE = path.join(SERVER, '.va-degrees', 'cs_course_scope.json');
const DEFAULT_REQUISITES = path.join(REPO, 'scripts', 'data', 'va_course_requisites.json');
const DEFAULT_CACHE = path.join(SERVER, '.va-prerequisites-cache');
const DEFAULT_OUTPUT = path.join(
  SERVER,
  '.va-catalogs',
  'research',
  'vccs-prerequisite-source-gaps.json',
);

const LIVE_PROBE = Object.freeze({
  observed_at: '2026-08-24',
  user_agent: 'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)',
  result: 'No residual VCCS rows remain. PHI102 has no current master record, but its exact archived owner record is a bounded CourseLeaf entry with zero requisite clauses and a same-catalog marker control; EGR126 is an exact complete current master record with zero requisite clauses.',
});

const CURRENT_MASTER_CLOSURE_RESOLUTIONS = Object.freeze([
  { code: 'EGR126', required_by: ['CSC201'] },
]);

const PARSER_ENGINEERING_RESOLUTIONS = Object.freeze([
  {
    code: 'BIO141',
    former_blocker: 'unsupported_semicolon_grammar',
    resolution: 'whole_clause_alternatives',
    expected_timing: 'corequisite_or_prerequisite',
  },
  {
    code: 'EGR121',
    former_blocker: 'unsupported_semicolon_grammar',
    resolution: 'conjunctive_groups_then_whole_clause_alternatives',
    expected_timing: 'prerequisite',
  },
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sha1 = (value) => createHash('sha1').update(value).digest('hex');
const isVccsCollege = (name) => /community college$/i.test(String(name || '').trim());

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function offeredByRows(html) {
  const $ = cheerio.load(html);
  const rows = [];
  $('#offeredByDiv a[href*="/colleges/"][href*="/courses/"]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    const name = $(anchor).text().replace(/\s+/g, ' ').trim();
    if (!href || !name) return;
    rows.push({
      college: name,
      official_url: new URL(href, 'https://courses.vccs.edu').href,
    });
  });
  return rows;
}

function buildEvidence({
  scopeFile = DEFAULT_SCOPE,
  requisiteFile = DEFAULT_REQUISITES,
  cacheDir = DEFAULT_CACHE,
} = {}) {
  const scope = readJson(scopeFile);
  const sourceArtifact = readJson(requisiteFile);
  const strict = adaptVccsPrerequisiteArtifact(sourceArtifact, scope);
  const southwestEvidence = loadSouthwestVccsPrerequisiteEvidence({ scopeRows: scope });
  const laurelRidgeEvidence = loadLaurelRidgeVccsPrerequisiteEvidence({
    scopeRows: scope,
    cacheDir,
  });
  const unresolvedOwnerEntries = [
    ...southwestEvidence.unresolved.map((row) => ({
      ...row,
      institution: southwestEvidence.artifact.institution,
    })),
    ...laurelRidgeEvidence.unresolved.map((row) => ({
      ...row,
      institution: laurelRidgeEvidence.artifact.institution,
    })),
  ];
  const required = new Set(strict.requiredKeys);
  const scopeByCode = new Map(scope.map((row) => [String(row.code || '').toUpperCase(), row]));
  const rows = strict.rows
    .filter((row) => (
      (required.has(row.course_key) || row.scope_role === 'prerequisite_only')
        && row.status === 'missing'
    ))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((row) => {
      const officialUrl = `https://courses.vccs.edu/courses/${row.code}`;
      const cacheFile = path.join(cacheDir, `${sha1(officialUrl)}.html`);
      if (!fs.existsSync(cacheFile)) throw new Error(`missing official-page cache for ${row.code}`);
      const body = fs.readFileSync(cacheFile);
      const html = body.toString('utf8');
      const parsed = parseVccsCoursePage(html, { requestedCode: row.code, url: officialUrl });
      if (parsed.found || parsed.status !== 'missing') {
        throw new Error(`${row.code} is no longer a source gap; rebuild the prerequisite artifacts first`);
      }
      const owners = (scopeByCode.get(row.code)?.colleges || [])
        .filter(isVccsCollege)
        .sort();
      const closureOnly = row.scope_role === 'prerequisite_only';
      if (!owners.length && !closureOnly) throw new Error(`${row.code} has no VCCS scope owner`);
      const transferStatus = row.transfer_evidence?.status || 'missing';
      const unresolvedOwnerEntry = unresolvedOwnerEntries.find((entry) => (
        entry.code === row.code
      ));
      return {
        code: row.code,
        course_key: row.course_key,
        owning_colleges: owners,
        source_artifact_status: row.status,
        source_artifact_authority: row.source,
        transfer_evidence_status: transferStatus,
        current_master_page: {
          official_url: officialUrl,
          observed_http_status: 200,
          cached_content_bytes: body.length,
          cached_content_sha256: sha256(body),
          parser_status: parsed.status,
          exact_course_record_found: false,
          raw_requisite_text: null,
          historical_offered_by_links: offeredByRows(html),
        },
        ...(unresolvedOwnerEntry ? {
          owner_complete_course_entry: {
            institution: unresolvedOwnerEntry.institution,
            official_url: unresolvedOwnerEntry.source_url,
            catalog_year: unresolvedOwnerEntry.catalog_year,
            raw_entry_text: unresolvedOwnerEntry.raw_entry_text,
            raw_entry_sha256: unresolvedOwnerEntry.raw_entry_sha256,
            prerequisite_marker_found: false,
            accepted_explicit_none: false,
            disposition: unresolvedOwnerEntry.disposition,
          },
        } : {}),
        resolution: {
          status: 'unresolved',
          accepted_prerequisite_formula: null,
          accepted_explicit_none: false,
          reason: transferStatus === 'scope_college_overlap'
            ? 'Transfer Virginia corroborates a title only; the current VCCS page has no exact course record or prerequisite authority.'
            : closureOnly
              ? 'A parsed direct-course formula cites this retired VCCS identity, but the current VCCS page has no exact course record or prerequisite authority.'
              : 'Only requirement-scope identity remains; the current VCCS page has no exact course record or prerequisite authority.',
          evidence_required: closureOnly
            ? 'An official current or historical VCCS exact course entry. No prerequisite must be explicit; it is never inferred from omission.'
            : 'An official current/historical VCCS exact course entry, or exact official college prerequisite fields for every owning college. No prerequisite must be explicit; it is never inferred from omission.',
        },
        ...(row.code.startsWith('STD') ? {
          identity_review: {
            possible_prefix: row.code.replace(/^STD/, 'SDV'),
            status: 'not_accepted',
            reason: 'A similarly numbered SDV course is not proof that the requirement-scoped STD identity is a typo or renumbering.',
          },
        } : {}),
      };
    });

  const sourceBreakdown = Object.fromEntries(
    [...new Set(rows.map((row) => row.source_artifact_authority))]
      .sort()
      .map((source) => [source, rows.filter((row) => row.source_artifact_authority === source).length]),
  );
  const parserResolutions = PARSER_ENGINEERING_RESOLUTIONS.map((expected) => {
    const row = strict.rows.find((candidate) => candidate.code === expected.code);
    const group = row?.groups?.[0];
    const officialUrl = `https://courses.vccs.edu/courses/${expected.code}`;
    const cacheFile = path.join(cacheDir, `${sha1(officialUrl)}.html`);
    if (!fs.existsSync(cacheFile)) {
      throw new Error(`missing official-page cache for parser proof ${expected.code}`);
    }
    const body = fs.readFileSync(cacheFile);
    const parsed = parseVccsCoursePage(body.toString('utf8'), {
      requestedCode: expected.code,
      url: officialUrl,
    });
    const parsedGroup = parsed.groups?.[0];
    const expectedTimingMatches = expected.expected_timing === 'corequisite_or_prerequisite'
      ? parsedGroup?.timing === expected.expected_timing
      : parsedGroup?.kind === expected.expected_timing;
    if (row?.status !== 'parsed' || parsed.status !== 'parsed'
        || group?.semicolon_topology !== expected.resolution
        || parsedGroup?.semicolon_topology !== expected.resolution
        || !expectedTimingMatches
        || row.raw_requisites !== parsed.raw_requisites
        || JSON.stringify(row.groups) !== JSON.stringify(parsed.groups)) {
      throw new Error(`${expected.code} parser-engineering proof no longer passes`);
    }
    return {
      ...expected,
      source_url: officialUrl,
      effective: parsed.effective,
      raw_requisites: parsed.raw_requisites,
      raw_course_endtext: parsed.raw_course_endtext,
      status: parsed.status,
      cached_content_bytes: body.length,
      cached_content_sha256: sha256(body),
      parsed_group: parsedGroup,
    };
  });
  const acceptedOwnerEvidence = [
    ...[...southwestEvidence.accepted].map(([code, accepted]) => ({
      code, accepted, institution: southwestEvidence.artifact.institution,
    })),
    ...[...laurelRidgeEvidence.accepted].map(([code, accepted]) => ({
      code, accepted, institution: laurelRidgeEvidence.artifact.institution,
    })),
  ];
  const ownerSourceResolutions = acceptedOwnerEvidence.map(({ code, accepted, institution }) => {
    const row = strict.rows.find((candidate) => candidate.code === code);
    if (row?.status !== accepted.status
        || row.source !== accepted.source
        || row.source_content_sha256 !== accepted.source_content_sha256
        || row.raw_requisites !== accepted.raw_requisites
        || JSON.stringify(row.groups) !== JSON.stringify(accepted.groups)
        || JSON.stringify(row.source_evidence) !== JSON.stringify(accepted.source_evidence)
        || JSON.stringify(row.explicit_none_evidence || null)
          !== JSON.stringify(accepted.explicit_none_evidence || null)) {
      throw new Error(`${code} owner-source resolution no longer matches the strict corpus`);
    }
    return {
      code,
      resolution: accepted.status === 'none'
        ? 'structured_owner_complete_record_none'
        : 'exact_owner_complete_formula',
      institution,
      owning_colleges: accepted.owner_coverage,
      ...(accepted.required_by ? { required_by: accepted.required_by } : {}),
      source_url: accepted.source_url,
      catalog_year: accepted.catalog_year,
      raw_requisites: accepted.raw_requisites,
      source_content_sha256: accepted.source_content_sha256,
      status: row.status,
      groups: row.groups,
      source_evidence: row.source_evidence,
      ...(row.explicit_none_evidence ? {
        explicit_none_evidence: row.explicit_none_evidence,
      } : {}),
    };
  });
  const currentMasterClosureResolutions = CURRENT_MASTER_CLOSURE_RESOLUTIONS.map((expected) => {
    const row = strict.rows.find((candidate) => candidate.code === expected.code);
    const officialUrl = `https://courses.vccs.edu/courses/${expected.code}`;
    const cacheFile = path.join(cacheDir, `${sha1(officialUrl)}.html`);
    if (!fs.existsSync(cacheFile)) {
      throw new Error(`missing official-page cache for current closure proof ${expected.code}`);
    }
    const body = fs.readFileSync(cacheFile);
    const parsed = parseVccsCoursePage(body.toString('utf8'), {
      requestedCode: expected.code,
      url: officialUrl,
    });
    const archivedOwnerEntry = laurelRidgeEvidence.unresolved.find((entry) => (
      entry.code === expected.code
    ));
    const dependencyRows = strict.rows.filter((candidate) => expected.required_by.includes(
      candidate.code,
    ));
    const cited = dependencyRows.every((dependent) => dependent.groups.some((group) => (
      group.paths.some((formulaPath) => formulaPath.all_of.some((condition) => (
        condition.type === 'course' && condition.code === expected.code
      )))
    )));
    if (row?.scope_role !== 'prerequisite_only'
        || row.status !== 'none'
        || row.source !== 'vccs_master_course_file'
        || parsed.found !== true
        || parsed.status !== 'none'
        || parsed.raw_requisites !== null
        || parsed.explicit_none_evidence?.kind !== 'structured_vccs_master_record_boundary'
        || parsed.explicit_none_evidence?.literal_none_statement !== false
        || JSON.stringify(row.source_evidence) !== JSON.stringify(parsed.source_evidence)
        || JSON.stringify(row.explicit_none_evidence) !== JSON.stringify(parsed.explicit_none_evidence)
        || !archivedOwnerEntry
        || archivedOwnerEntry.accepted_explicit_none !== false
        || archivedOwnerEntry.disposition !== 'unresolved_no_explicit_none_statement'
        || !cited) {
      throw new Error(`${expected.code} structured current-master closure proof no longer passes`);
    }
    return {
      code: expected.code,
      required_by: expected.required_by,
      resolution: 'structured_current_vccs_master_record_none',
      source_url: officialUrl,
      title: parsed.title,
      effective: parsed.effective,
      raw_course_endtext: parsed.raw_course_endtext,
      cached_content_bytes: body.length,
      cached_content_sha256: sha256(body),
      source_evidence: parsed.source_evidence,
      explicit_none_evidence: parsed.explicit_none_evidence,
      archived_owner_entry: {
        institution: laurelRidgeEvidence.artifact.institution,
        source_url: archivedOwnerEntry.source_url,
        raw_entry_sha256: archivedOwnerEntry.raw_entry_sha256,
        disposition: archivedOwnerEntry.disposition,
        accepted_explicit_none: false,
        role: 'corroborating_identity_only_not_none_authority',
      },
    };
  });
  const directMissing = rows.filter((row) => row.scope_role !== 'prerequisite_only').length;
  const closureMissing = rows.length - directMissing;
  return {
    meta: {
      version: 'va-vccs-prerequisite-source-gaps-v4',
      audited_at: LIVE_PROBE.observed_at,
      purpose: 'Fail-closed evidence ledger and resolution receipts for required VCCS Figure 6 prerequisite status.',
      authority_rule: 'A row resolves only through an exact official formula, a literal official none statement, an exact current VCCS Master Course File record whose complete dt/dd record boundary has zero recognized requisite clauses, or an exact owner CourseLeaf record with a pinned single-record boundary and same-catalog requisite-marker control. Unbounded or uncontrolled omission never resolves none.',
      live_probe: LIVE_PROBE,
      counts: {
        required_vccs_courses: strict.report.counts.required,
        exact_formula_or_validated_none: strict.report.counts.parsed + strict.report.counts.none,
        prerequisite_closure_courses: strict.rows.filter((row) => (
          row.scope_role === 'prerequisite_only'
        )).length,
        parser_engineering_resolved: parserResolutions.length,
        owner_source_resolved: ownerSourceResolutions.length,
        current_master_closure_resolved: currentMasterClosureResolutions.length,
        missing_source_rows: rows.length,
        missing_direct_source_rows: directMissing,
        missing_closure_source_rows: closureMissing,
        resolved_by_this_research: ownerSourceResolutions.length
          + currentMasterClosureResolutions.length,
        remaining_unresolved: rows.length,
        ...sourceBreakdown,
      },
      owner_course_entry_research: [southwestEvidence, laurelRidgeEvidence]
        .flatMap((evidence) => evidence.artifact.rows.map((row) => ({
          code: row.code,
          institution: evidence.artifact.institution,
          official_url: row.source_url || evidence.artifact.source_document?.source_url,
          catalog_year: row.catalog_year || evidence.artifact.source_document?.catalog_year,
          raw_entry_sha256: row.raw_entry_sha256,
          raw_requisites: row.raw_requisites,
          accepted_explicit_none: row.accepted_explicit_none,
          disposition: row.disposition,
          ...(row.source_capture ? { source_capture: row.source_capture } : {}),
          ...(row.required_by ? { required_by: row.required_by } : {}),
          ...(evidence.artifact.source_document ? {
            source_document_sha256: evidence.artifact.source_document.content_sha256,
          } : {}),
        }))),
      parser_engineering_resolutions: parserResolutions,
      owner_source_resolutions: ownerSourceResolutions,
      current_master_closure_resolutions: currentMasterClosureResolutions,
    },
    rows,
  };
}

function validateEvidence(artifact, options = {}) {
  const rebuilt = buildEvidence(options);
  const errors = [];
  if (JSON.stringify(artifact) !== JSON.stringify(rebuilt)) {
    errors.push('artifact_does_not_match_cached_official_sources');
  }
  if (artifact?.meta?.counts?.remaining_unresolved !== artifact?.rows?.length) {
    errors.push('remaining_count_mismatch');
  }
  if ((artifact?.rows || []).some((row) => (
    row.resolution?.status !== 'unresolved'
    || row.resolution?.accepted_prerequisite_formula != null
    || row.resolution?.accepted_explicit_none !== false
  ))) errors.push('unsupported_resolution_claim');
  return { ready: errors.length === 0, errors, counts: rebuilt.meta.counts };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(argv = process.argv.slice(2)) {
  const artifact = buildEvidence();
  if (argv.includes('--write')) {
    writeJson(DEFAULT_OUTPUT, artifact);
    console.log(`[va:vccs-prereq-gaps] wrote ${DEFAULT_OUTPUT}`);
  } else if (fs.existsSync(DEFAULT_OUTPUT)) {
    const report = validateEvidence(readJson(DEFAULT_OUTPUT));
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready) process.exitCode = 1;
  } else {
    console.log(JSON.stringify(artifact, null, 2));
  }
  return artifact;
}

module.exports = {
  DEFAULT_OUTPUT,
  LIVE_PROBE,
  PARSER_ENGINEERING_RESOLUTIONS,
  CURRENT_MASTER_CLOSURE_RESOLUTIONS,
  buildEvidence,
  validateEvidence,
  run,
};

if (require.main === module) run();
