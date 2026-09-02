#!/usr/bin/env node
/**
 * Build the direct Virginia community-college course scope consumed by the
 * prerequisite pipeline.
 *
 * The former checked-in ledger predated the canonical catalog cohort and was
 * assembled from 21 legacy maps.  Figure 6 must instead use the same 19
 * accepted associate source documents as every other Virginia figure.  This
 * builder derives that scope from their exact option identities; it never
 * edits a requirement document or guesses a course from display prose.
 *
 * Report-only by default:
 *
 *   node scripts/va/buildCanonicalVccsCourseScope.js
 *   node scripts/va/buildCanonicalVccsCourseScope.js --write
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  cachedAcceptedSourcePlan,
} = require('../importVirginiaCatalogDegrees');
const {
  parseCourseKey,
} = require('../../services/virginia/courseIdentity');

const SERVER = path.resolve(__dirname, '..', '..');
const DEFAULT_OUTPUT = path.join(SERVER, '.va-degrees', 'cs_course_scope.json');
const RICHARD_BLAND_SLUG = 'richard-bland-college';

const normalizedId = (value) => String(value || '').trim();
const collegeSlug = (document) => normalizedId(
  document?.community_college_id || document?.college_id,
).replace(/^va:cc:/, '');
const sorted = (values) => [...new Set(values)].sort((left, right) => (
  left.localeCompare(right)
));

function acceptedAssociateDocuments(plan) {
  const documents = (plan?.documents || []).filter((document) => (
    document?.kind === 'as_degree'
  ));
  if (documents.length !== 19) {
    throw new Error(
      `canonical prerequisite scope requires 19 accepted associate documents; found ${documents.length}`,
    );
  }
  const collegeSlugs = documents.map(collegeSlug);
  if (new Set(collegeSlugs).size !== documents.length) {
    throw new Error('canonical prerequisite scope requires one accepted source per college');
  }
  return documents;
}

function institutionNames(plan) {
  const rows = plan?.registry?.institutions;
  if (!Array.isArray(rows)) throw new Error('accepted source plan lacks its institution registry');
  return new Map(rows.map((row) => [normalizedId(row?.slug), normalizedId(row?.name)]));
}

function optionCourseIdentities(option, context) {
  const ids = Array.isArray(option?.course_ids) ? option.course_ids : [];
  const keys = Array.isArray(option?.course_keys) ? option.course_keys : [];
  if (!ids.length && !keys.length) return [];
  if (!ids.length || ids.length !== keys.length) {
    throw new Error(`${context} has ${ids.length} course ids but ${keys.length} source keys`);
  }
  if (ids.some((id) => !Number.isInteger(Number(id)))) {
    throw new Error(`${context} contains a non-integer course id`);
  }
  return keys.map((key, index) => {
    const identity = parseCourseKey(key);
    if (!identity) throw new Error(`${context} has invalid source course key ${key}`);
    if (Number(ids[index]) !== Number(identity.course_id)) {
      throw new Error(
        `${context} course id ${ids[index]} does not match source key ${key}`,
      );
    }
    return identity;
  });
}

function expectedIdentityScope(slug) {
  return slug === RICHARD_BLAND_SLUG ? 'institution_local' : 'vccs_shared';
}

function expectedInstitutionId(slug) {
  return slug === RICHARD_BLAND_SLUG
    ? `va:cc:${RICHARD_BLAND_SLUG}`
    : 'va:vccs';
}

function buildCanonicalCourseScope(plan = cachedAcceptedSourcePlan()) {
  const names = institutionNames(plan);
  const documents = acceptedAssociateDocuments(plan);
  const ownersByCode = new Map();
  const authoritiesByCode = new Map();
  let optionCount = 0;
  let identityCount = 0;

  for (const document of documents) {
    const slug = collegeSlug(document);
    const college = names.get(slug);
    if (!slug || !college) {
      throw new Error(`${document?._id || '<unknown associate>'} has no registry-backed college identity`);
    }
    for (const [groupIndex, group] of (document.requirement_groups || []).entries()) {
      for (const [sectionIndex, section] of (group.sections || []).entries()) {
        for (const [receiverIndex, receiver] of (section.receivers || []).entries()) {
          for (const [optionIndex, option] of (receiver.options || []).entries()) {
            const context = [
              document._id,
              `requirement_groups[${groupIndex}]`,
              `sections[${sectionIndex}]`,
              `receivers[${receiverIndex}]`,
              `options[${optionIndex}]`,
            ].join('.');
            const identities = optionCourseIdentities(option, context);
            if (!identities.length) continue;
            optionCount += 1;
            for (const identity of identities) {
              if (identity.identity_scope !== expectedIdentityScope(slug)
                  || identity.institution_id !== expectedInstitutionId(slug)) {
                throw new Error(
                  `${context} course key ${identity.course_key} crosses the ${college} ownership boundary`,
                );
              }
              identityCount += 1;
              if (!ownersByCode.has(identity.code)) ownersByCode.set(identity.code, new Set());
              if (!authoritiesByCode.has(identity.code)) {
                authoritiesByCode.set(identity.code, new Set());
              }
              ownersByCode.get(identity.code).add(college);
              authoritiesByCode.get(identity.code).add(identity.institution_id);
            }
          }
        }
      }
    }
  }

  const rows = [...ownersByCode]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, owners]) => ({ code, colleges: sorted(owners) }));
  const hasAuthority = (row, institutionId) => (
    authoritiesByCode.get(row.code)?.has(institutionId) === true
  );
  const vccsRows = rows.filter((row) => hasAuthority(row, 'va:vccs'));
  const richardBlandId = `va:cc:${RICHARD_BLAND_SLUG}`;
  const richardBlandRows = rows.filter((row) => hasAuthority(row, richardBlandId));
  const mixedRows = rows.filter((row) => (
    (authoritiesByCode.get(row.code)?.size || 0) > 1
  ));
  if (rows.length !== 260 || vccsRows.length !== 184
      || richardBlandRows.length !== 76 || mixedRows.length) {
    throw new Error(
      'canonical course-scope cardinality drifted '
      + `(all=${rows.length}, vccs=${vccsRows.length}, `
      + `richard_bland=${richardBlandRows.length}, mixed=${mixedRows.length})`,
    );
  }
  return {
    rows,
    report: {
      accepted_associate_documents: documents.length,
      concrete_options: optionCount,
      concrete_course_identities: identityCount,
      direct_course_codes: rows.length,
      vccs_course_codes: vccsRows.length,
      richard_bland_course_codes: richardBlandRows.length,
      cross_authority_course_codes: mixedRows.length,
    },
  };
}

function serializedScope(rows) {
  return `${JSON.stringify(rows, null, 2)}\n`;
}

function validateCheckedInScope(file = DEFAULT_OUTPUT, plan = cachedAcceptedSourcePlan()) {
  const built = buildCanonicalCourseScope(plan);
  const actual = fs.readFileSync(file, 'utf8');
  const expected = serializedScope(built.rows);
  return {
    ready: actual === expected,
    issue: actual === expected ? null : 'canonical_course_scope_drift',
    report: built.report,
  };
}

function run(argv = process.argv.slice(2)) {
  const unknown = argv.filter((argument) => argument !== '--write');
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const built = buildCanonicalCourseScope();
  if (argv.includes('--write')) {
    fs.writeFileSync(DEFAULT_OUTPUT, serializedScope(built.rows));
    console.log(`[va:vccs-scope] wrote ${DEFAULT_OUTPUT}`);
  }
  const validation = validateCheckedInScope();
  console.log(JSON.stringify(validation, null, 2));
  if (!validation.ready) process.exitCode = 1;
  return validation;
}

module.exports = {
  DEFAULT_OUTPUT,
  buildCanonicalCourseScope,
  serializedScope,
  validateCheckedInScope,
  run,
};

if (require.main === module) run();
