#!/usr/bin/env node
/**
 * Copy the historical research collections into the final compact schema.
 *
 * Default is a read-only audit. `--apply` builds each destination under a
 * staging name, creates indexes, validates counts, then atomically renames it.
 * `--drop-legacy --yes` is the explicit final-cleanup operation used after a
 * backup. It is also run after local source ports so staging never lingers.
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DROP_LEGACY = args.has('--drop-legacy');
const CONFIRMED = args.has('--yes');

const DESTINATIONS = Object.freeze([
  'assist_institutions',
  'assist_courses',
  'assist_agreements',
  'admissions',
  'curated_requirements',
  'curated_prerequisites',
  'curated_mappings',
  'agreement_reviews',
  'team_members',
  'settings',
  'published_figures',
]);

const LEGACY_COLLECTIONS = Object.freeze([
  'community_colleges', 'uc_schools', 'courses', 'university_courses',
  'uc_agreements', 'uc_major_admissions',
  'ref_cc_districts', 'ref_ge_patterns', 'ref_igetc', 'ref_prerequisites',
  'ref_uc_degree_requirements', 'ref_uc_transfer_requirements',
  'ref_campus_calendars', 'ref_tuition', 'ref_locations',
  'curation_course_categories', 'curation_receiver_overrides',
  'curation_prereqs', 'curation_assoc_degrees', 'audit_results',
  'access_requests', 'access_grants', 'access_blocks', 'display_names',
  'dataset_changelog', 'dataset_meta', 'dataset_config',
  'figures', 'figure_scripts', 'figure_runs', 'audit_groupings',
]);

const norm = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const withoutId = ({ _id, ...rest }) => rest;
const stringifyId = (value) => String(value);
const rowTime = (row) => {
  const value = row?.updated_at ?? row?.curated_at ?? row?.verified_at ?? row?.last_seen
    ?? row?.granted_at ?? row?.blocked_at ?? row?.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};
const setIfNewer = (map, row) => {
  const key = String(row._id);
  const current = map.get(key);
  if (!current || rowTime(row) >= rowTime(current)) map.set(key, row);
};

// These fields are edited directly on the canonical institution row.  A
// source port recreates the legacy college catalog before this migration runs,
// so treating that catalog as the whole institution record would erase the
// team's district curation on every port/rebuild.
const CURATED_INSTITUTION_FIELDS = Object.freeze([
  'district',
  'region',
  'counties_served',
  'district_source',
  'district_source_college_name',
  'curated_by',
  'curated_at',
  'updated_at',
]);

function carryCuratedInstitutionFields(imported, existing) {
  if (!existing) return imported;
  const carried = {};
  for (const field of CURATED_INSTITUTION_FIELDS) {
    if (existing[field] !== undefined) carried[field] = existing[field];
  }
  return { ...imported, ...carried };
}

function canonicalPrereqKey(value) {
  const key = String(value || '');
  if (key.startsWith('uni:')) return `university:${key.slice(4)}`;
  return key;
}

function normalizeAgreement(row) {
  return {
    ...row,
    system: 'uc',
    college_id: `cc:${row.community_college_id}`,
    university_id: `uc:${row.uc_school_id}`,
    requirement_groups: (row.requirement_groups || []).map((group) => ({
      ...group,
      sections: (group.sections || []).map((section) => ({
        ...section,
        receivers: (section.receivers || []).map((receiver) => {
          const receiving = { ...(receiver.receiving || {}) };
          if (receiving.parent_id != null) receiving.course_id = `university:${receiving.parent_id}`;
          if (Array.isArray(receiving.parent_ids)) {
            receiving.course_ids = receiving.parent_ids.map((id) => `university:${id}`);
          }
          return {
            ...receiver,
            receiving,
            options: (receiver.options || []).map((option) => ({
              ...option,
              course_keys: (option.course_ids || []).map((id) => `cc:${id}`),
            })),
          };
        }),
      })),
    })),
  };
}

function normalizeRequirement(row, kind, extra = {}) {
  const prefix = `${kind}:`;
  let legacyId = String(row.legacy_id ?? row._id);
  while (legacyId.startsWith(prefix)) legacyId = legacyId.slice(prefix.length);
  return {
    ...withoutId(row),
    ...extra,
    _id: `${prefix}${legacyId}`,
    legacy_id: legacyId,
    kind,
  };
}

function normalizeStoredFormats(formats = {}) {
  return Object.fromEntries(Object.entries(formats).map(([format, value]) => {
    if (Buffer.isBuffer(value)) return [format, value];
    if (value?.buffer) return [format, Buffer.from(value.buffer)];
    return [format, Buffer.from(String(value), 'base64')];
  }));
}

async function readAll(db, name) {
  return db.collection(name).find().toArray();
}

async function buildModel(db) {
  const [
    colleges, universities, ccCourses, universityCourses, agreements, admissions,
    districts, gePatterns, igetc, transferRequirements, degreeRequirements,
    prerequisiteEvidence, prerequisiteGraph, reviews,
    requests, grants, blocks, displayNames, configs, meta, figures,
  ] = await Promise.all([
    readAll(db, 'community_colleges'), readAll(db, 'uc_schools'),
    readAll(db, 'courses'), readAll(db, 'university_courses'),
    readAll(db, 'uc_agreements'), readAll(db, 'uc_major_admissions'),
    readAll(db, 'ref_cc_districts'), readAll(db, 'ref_ge_patterns'), readAll(db, 'ref_igetc'),
    readAll(db, 'ref_uc_transfer_requirements'), readAll(db, 'ref_uc_degree_requirements'),
    readAll(db, 'ref_prerequisites'), readAll(db, 'curation_prereqs'), readAll(db, 'audit_results'),
    readAll(db, 'access_requests'), readAll(db, 'access_grants'), readAll(db, 'access_blocks'),
    readAll(db, 'display_names'), readAll(db, 'dataset_config'), readAll(db, 'dataset_meta'),
    readAll(db, 'figures'),
  ]);

  // These collections may be absent today, but they are part of the curation
  // contract. Existing canonical rows are also read so rerunning this tool
  // after teammates have curated or published cannot overwrite newer work.
  const [
    categories, overrides, associateDegrees, calendars, tuition, locations,
    existingInstitutions, existingCourses, existingAgreements, existingAdmissions,
    existingRequirements, existingPrerequisites, existingMappings,
    existingReviews, existingMembers, existingSettings, existingFigures,
  ] = await Promise.all([
    readAll(db, 'curation_course_categories'), readAll(db, 'curation_receiver_overrides'),
    readAll(db, 'curation_assoc_degrees'), readAll(db, 'ref_campus_calendars'),
    readAll(db, 'ref_tuition'), readAll(db, 'ref_locations'),
    readAll(db, 'assist_institutions'), readAll(db, 'assist_courses'),
    readAll(db, 'assist_agreements'), readAll(db, 'admissions'),
    readAll(db, 'curated_requirements'), readAll(db, 'curated_prerequisites'),
    readAll(db, 'curated_mappings'), readAll(db, 'agreement_reviews'),
    readAll(db, 'team_members'), readAll(db, 'settings'), readAll(db, 'published_figures'),
  ]);

  const districtById = new Map(districts.map((row) => [Number(row._id), row]));
  const calendarById = new Map(calendars.map((row) => [Number(row._id), row]));
  const tuitionById = new Map(tuition.map((row) => [Number(row._id), row]));
  const locationById = new Map(locations.map((row) => {
    const raw = String(row._id);
    const kind = row.kind === 'cc' ? 'cc' : row.kind === 'university' || row.kind === 'uc' ? 'uc' : null;
    const key = /^(cc|uc|university):/.test(raw)
      ? raw.replace(/^university:/, 'uc:')
      : kind && row.source_id != null ? `${kind}:${row.source_id}` : raw;
    return [key, row];
  }));
  const locationFields = (key) => {
    const row = locationById.get(key);
    return row ? { latitude: row.lat ?? row.latitude ?? null, longitude: row.lng ?? row.longitude ?? null } : {};
  };
  const importedInstitutions = [
    ...colleges.map((row) => {
      const district = districtById.get(Number(row.id));
      return {
        _id: `cc:${row.id}`,
        institution_id: `cc:${row.id}`,
        source_id: row.id,
        kind: 'community_college',
        system: 'ccc',
        name: row.name,
        district: district?.district ?? null,
        region: district?.region ?? null,
        counties_served: Array.isArray(district?.counties_served) ? district.counties_served : [],
        district_source: district?.source ?? null,
        ...locationFields(`cc:${row.id}`),
      };
    }),
    ...universities.map((row) => {
      const calendar = calendarById.get(Number(row.id));
      const price = tuitionById.get(Number(row.id));
      return {
        _id: `uc:${row.id}`,
        institution_id: `uc:${row.id}`,
        source_id: row.id,
        kind: 'university',
        system: 'uc',
        name: row.name,
        academic_calendar: calendar?.system ?? calendar?.calendar ?? null,
        tuition_per_credit_usd: price?.per_credit_usd ?? null,
        tuition_source: price?.source ?? null,
        ...locationFields(`uc:${row.id}`),
      };
    }),
  ];
  const existingInstitutionById = new Map(
    existingInstitutions.map((row) => [String(row._id), row])
  );
  const institutions = importedInstitutions.length ? importedInstitutions.map((row) => (
    carryCuratedInstitutionFields(row, existingInstitutionById.get(String(row._id)))
  )) : existingInstitutions.map((row) => {
    if (row.kind === 'community_college') {
      const district = districtById.get(Number(row.source_id));
      return district ? {
        ...row,
        district: district.district ?? null,
        region: district.region ?? null,
        counties_served: Array.isArray(district.counties_served) ? district.counties_served : [],
        district_source: district.source ?? null,
        ...locationFields(String(row._id)),
      } : { ...row, ...locationFields(String(row._id)) };
    }
    const calendar = calendarById.get(Number(row.source_id));
    const price = tuitionById.get(Number(row.source_id));
    return {
      ...row,
      ...(calendar ? { academic_calendar: calendar.system ?? calendar.calendar ?? null } : {}),
      ...(price ? {
        tuition_per_credit_usd: price.per_credit_usd ?? null,
        tuition_source: price.source ?? null,
      } : {}),
      ...locationFields(String(row._id)),
    };
  });

  // Concept-mapping enrichment (spec 2026-07-15-prerequisite-concept-graph):
  // these fields exist only on canonical rows (stamped by the importer or the
  // console), so a rebuild from legacy sources must carry them forward or
  // console edits die with every port.
  const CONCEPT_FIELDS = [
    'concept', 'concept_source', 'concept_confidence', 'concept_title_seen',
    'concept_note', 'concept_curated_by', 'concept_curated_at', 'language',
  ];
  const conceptCarry = new Map();
  for (const row of existingCourses) {
    const carried = {};
    for (const field of CONCEPT_FIELDS) {
      if (row[field] !== undefined) carried[field] = row[field];
    }
    if (Object.keys(carried).length) conceptCarry.set(String(row._id), carried);
  }

  const importedCourses = [
    ...ccCourses.map((row) => ({
      ...withoutId(row),
      _id: `cc:${row.course_id}`,
      canonical_id: `cc:${row.course_id}`,
      source_id: row.course_id,
      institution_id: `cc:${row.community_college_id}`,
      side: 'sending',
      min_units: Number(row.units) || 0,
      max_units: Number(row.units) || 0,
      same_as_keys: (row.same_as || []).map((id) => `cc:${id}`),
      ...(conceptCarry.get(`cc:${row.course_id}`) || {}),
    })),
    ...universityCourses.map((row) => ({
      ...withoutId(row),
      _id: `university:${row.parent_id}`,
      canonical_id: `university:${row.parent_id}`,
      source_id: row.parent_id,
      institution_id: `uc:${row.university_id}`,
      side: 'receiving',
      ...(conceptCarry.get(`university:${row.parent_id}`) || {}),
    })),
  ];
  const courses = importedCourses.length ? importedCourses : existingCourses;

  const importedRequirements = [
    ...transferRequirements.map((row) => normalizeRequirement(row, 'transfer_minimum', {
      institution_id: `uc:${row.school_id}`,
    })),
    ...degreeRequirements.map((row) => normalizeRequirement(row, 'degree', {
      institution_id: `uc:${row.school_id}`,
    })),
    ...gePatterns.map((row) => normalizeRequirement(row, 'ge_pattern')),
    ...igetc.map((row) => normalizeRequirement(row, 'igetc', { pattern: 'igetc' })),
    ...associateDegrees.map((row) => normalizeRequirement(row, 'associate_degree', {
      institution_id: `cc:${row.community_college_id}`,
      course_ids: (row.course_ids || []).map((id) => `cc:${id}`),
    })),
  ];
  const requirementsById = new Map(importedRequirements.map((row) => [String(row._id), row]));
  for (const row of existingRequirements) {
    if (!row.kind) continue;
    setIfNewer(requirementsById, normalizeRequirement(row, row.kind));
  }
  const requirements = [...requirementsById.values()];

  const importedMappings = [
    ...categories.map((row) => ({
      ...withoutId(row),
      _id: `course_category:${row._id}`,
      kind: 'course_category',
      course_id: `university:${row._id}`,
      legacy_id: row._id,
    })),
    ...overrides.map((row) => ({
      ...withoutId(row),
      _id: `receiver_override:${row._id}`,
      kind: 'receiver_override',
      receiver_hash: String(row._id),
      legacy_id: row._id,
    })),
  ];
  const mappingsById = new Map(importedMappings.map((row) => [String(row._id), row]));
  for (const row of existingMappings) setIfNewer(mappingsById, row);
  const mappings = [...mappingsById.values()];

  const collegeCatalog = colleges.length ? colleges : existingInstitutions
    .filter((row) => row.kind === 'community_college')
    .map((row) => ({ id: row.source_id, name: row.name }));
  const ccCourseCatalog = ccCourses.length ? ccCourses : existingCourses.filter((row) => row.side === 'sending');
  const institutionByName = new Map(collegeCatalog.map((row) => [norm(row.name), `cc:${row.id}`]));
  const courseByCode = new Map(ccCourseCatalog.map((row) => [
    `${row.community_college_id}|${norm(`${row.prefix || ''}${row.number || ''}`)}`,
    `cc:${row.course_id}`,
  ]));
  const prerequisites = new Map();
  let mappedPrerequisiteEdges = 0;
  let totalPrerequisiteEdges = 0;
  for (const row of prerequisiteEvidence) {
    const institutionId = institutionByName.get(norm(row.college)) || null;
    const numericInstitutionId = institutionId ? Number(institutionId.slice(3)) : null;
    const courseId = numericInstitutionId != null
      ? courseByCode.get(`${numericInstitutionId}|${norm(row.course_code)}`) || null
      : null;
    const prerequisiteKeys = [];
    const unresolvedPrerequisites = [];
    for (const code of row.prerequisites || []) {
      totalPrerequisiteEdges += 1;
      const key = numericInstitutionId != null
        ? courseByCode.get(`${numericInstitutionId}|${norm(code)}`)
        : null;
      if (key) {
        prerequisiteKeys.push(key);
        mappedPrerequisiteEdges += 1;
      } else {
        unresolvedPrerequisites.push(code);
      }
    }
    const id = courseId || `unresolved:${row._id}`;
    prerequisites.set(id, {
      _id: id,
      course_id: courseId,
      institution_id: institutionId,
      course_code: row.course_code,
      course_name: row.course_name ?? null,
      units: row.units ?? null,
      prerequisite_ids: prerequisiteKeys,
      unresolved_prerequisites: unresolvedPrerequisites,
      source: row.source ?? null,
      status: courseId && !unresolvedPrerequisites.length ? 'resolved' : 'needs_review',
      updated_at: row.updated_at ?? null,
    });
  }
  for (const row of prerequisiteGraph) {
    const id = canonicalPrereqKey(row._id);
    const existing = prerequisites.get(id) || {};
    prerequisites.set(id, {
      ...existing,
      _id: id,
      course_id: id,
      prerequisite_ids: (row.prereqs || []).map(canonicalPrereqKey),
      unresolved_prerequisites: [],
      note: row.note ?? existing.note ?? null,
      curated_by: row.curated_by ?? null,
      curated_at: row.curated_at ?? null,
      status: 'resolved',
    });
  }
  for (const row of existingPrerequisites) setIfNewer(prerequisites, row);
  if (!prerequisiteEvidence.length) {
    const canonicalEvidence = existingPrerequisites.filter((row) => Array.isArray(row.prerequisites));
    totalPrerequisiteEdges = canonicalEvidence.reduce(
      (sum, row) => sum + row.prerequisites.length, 0
    );
    mappedPrerequisiteEdges = canonicalEvidence.reduce(
      (sum, row) => sum + (row.prerequisite_ids || []).length, 0
    );
  }

  const memberIds = new Set([
    ...requests.map((row) => stringifyId(row._id)),
    ...grants.map((row) => stringifyId(row._id)),
    ...blocks.map((row) => stringifyId(row._id)),
    ...displayNames.map((row) => stringifyId(row._id)),
  ]);
  const byId = (rows) => new Map(rows.map((row) => [stringifyId(row._id), row]));
  const requestById = byId(requests);
  const grantById = byId(grants);
  const blockById = byId(blocks);
  const nameById = byId(displayNames);
  const importedMembers = [...memberIds].map((id) => {
    const request = requestById.get(id);
    const grant = grantById.get(id);
    const block = blockById.get(id);
    const display = nameById.get(id);
    const accessStatus = block ? 'blocked' : grant ? 'granted' : request ? 'pending' : 'profile_only';
    return {
      _id: id,
      access_status: accessStatus,
      email: block?.email ?? grant?.email ?? request?.email ?? null,
      display_name: display?.name ?? request?.name ?? block?.name ?? null,
      note: grant?.note ?? request?.note ?? null,
      requested_at: request?.requested_at ?? request?.created_at ?? null,
      granted_at: grant?.granted_at ?? null,
      granted_by: grant?.granted_by ?? null,
      blocked_at: block?.blocked_at ?? null,
      blocked_by: block?.blocked_by ?? null,
      updated_at: display?.updated_at ?? block?.blocked_at ?? grant?.granted_at ?? request?.requested_at ?? null,
    };
  });
  const membersById = new Map(importedMembers.map((row) => [String(row._id), row]));
  for (const row of existingMembers) setIfNewer(membersById, row);
  const members = [...membersById.values()];

  const partnerAccess = configs.find((row) => row._id === 'partner_access');
  const currentMeta = meta.find((row) => row._id === 'current');
  const priorSettings = existingSettings.find((row) => row._id === 'app');
  const appSettings = {
    ...(priorSettings ? withoutId(priorSettings) : {}),
    _id: 'app',
    visible_pairs: priorSettings?.visible_pairs ?? partnerAccess?.visible_pairs ?? [],
    last_data_refresh_at: priorSettings?.last_data_refresh_at ?? currentMeta?.updated_at ?? null,
    canonical_dirty: false,
  };
  delete appSettings.schema_version;
  // `settings` is shared application state, not a singleton collection.  In
  // particular, the AS-degree validation cohort lives in its own settings
  // document.  Keep every non-app document byte-for-byte and only normalize
  // the fields owned by this migration on settings.app.
  const settingsById = new Map(
    existingSettings
      .filter((row) => row._id !== 'app')
      .map((row) => [String(row._id), row])
  );
  settingsById.set('app', appSettings);
  const settings = [...settingsById.values()];

  const importedFigures = figures.map((row) => ({
    ...withoutId(row),
    _id: row._id,
    formats: normalizeStoredFormats(row.formats),
    dataset_version: undefined,
    mode: undefined,
    live: undefined,
  }));
  for (const row of importedFigures) {
    delete row.dataset_version;
    delete row.mode;
    delete row.live;
  }
  const figuresById = new Map(importedFigures.map((row) => [String(row._id), row]));
  for (const row of existingFigures) {
    const clean = { ...row };
    delete clean.dataset_version;
    delete clean.mode;
    delete clean.live;
    setIfNewer(figuresById, clean);
  }
  const publishedFigures = [...figuresById.values()];

  const importedReviews = reviews.map((row) => {
    const clean = withoutId(row);
    delete clean.dataset_version;
    return {
      ...clean,
      _id: row._id,
      system: row.system || 'uc',
    };
  });
  const reviewsById = new Map(importedReviews.map((row) => [String(row._id), row]));
  for (const row of existingReviews) {
    const clean = { ...row };
    delete clean.dataset_version;
    setIfNewer(reviewsById, clean);
  }
  const agreementReviews = [...reviewsById.values()];

  return {
    collections: {
      assist_institutions: institutions,
      assist_courses: courses,
      assist_agreements: (agreements.length ? agreements : existingAgreements).map(normalizeAgreement),
      admissions: (admissions.length ? admissions : existingAdmissions).map((row) => ({
        ...row,
        institution_id: `uc:${row.uc_school_id}`,
      })),
      curated_requirements: requirements,
      curated_prerequisites: [...prerequisites.values()],
      curated_mappings: mappings,
      agreement_reviews: agreementReviews,
      team_members: members,
      settings,
      published_figures: publishedFigures,
    },
    sourceCounts: {
      institutions: institutions.length,
      courses: courses.length,
      agreements: (agreements.length ? agreements : existingAgreements).length,
      admissions: (admissions.length ? admissions : existingAdmissions).length,
      requirements: requirements.length,
      prerequisiteEvidence: prerequisiteEvidence.length,
      reviews: agreementReviews.length,
      members: members.length,
      figures: publishedFigures.length,
      settings: settings.length,
    },
    prerequisiteCoverage: {
      rows: prerequisiteEvidence.length || existingPrerequisites.filter(
        (row) => Array.isArray(row.prerequisites)
      ).length,
      total_edges: totalPrerequisiteEdges,
      mapped_edges: mappedPrerequisiteEdges,
    },
  };
}

const INDEXES = Object.freeze({
  assist_institutions: [
    [{ kind: 1, name: 1 }, {}],
    [{ system: 1, source_id: 1 }, { unique: true }],
  ],
  assist_courses: [
    [{ institution_id: 1, prefix: 1, number: 1 }, {}],
    [{ side: 1, source_id: 1 }, { unique: true }],
    [{ course_id: 1 }, { sparse: true }],
    [{ parent_id: 1 }, { sparse: true }],
  ],
  assist_agreements: [
    [{ community_college_id: 1, uc_school_id: 1, major: 1 }, { unique: true }],
    [{ college_id: 1, university_id: 1, major: 1 }, {}],
  ],
  admissions: [[{ institution_id: 1, major: 1 }, { unique: true }]],
  curated_requirements: [[{ kind: 1, institution_id: 1 }, {}]],
  curated_prerequisites: [[{ institution_id: 1, status: 1 }, {}], [{ course_id: 1 }, {}]],
  curated_mappings: [[{ kind: 1, course_id: 1 }, {}], [{ kind: 1, receiver_hash: 1 }, {}]],
  agreement_reviews: [[{ system: 1, doc_id: 1 }, { unique: true }], [{ result: 1 }, {}]],
  team_members: [[{ access_status: 1 }, {}]],
  settings: [],
  published_figures: [
    [{ record_type: 1, updated_at: -1 }, {}],
    [{ figure_slug: 1, variant_key: 1 }, {
      partialFilterExpression: { record_type: 'figure_variant' },
    }],
  ],
});

const VALIDATORS = Object.freeze({
  assist_institutions: {
    $jsonSchema: {
      bsonType: 'object', required: ['_id', 'institution_id', 'source_id', 'kind', 'name'],
      properties: { kind: { enum: ['community_college', 'university'] } },
    },
  },
  assist_courses: {
    $jsonSchema: {
      bsonType: 'object', required: ['_id', 'institution_id', 'source_id', 'side'],
      properties: { side: { enum: ['sending', 'receiving'] } },
    },
  },
  assist_agreements: {
    $jsonSchema: {
      bsonType: 'object', required: ['_id', 'college_id', 'university_id', 'major', 'requirement_groups'],
    },
  },
  admissions: {
    $jsonSchema: { bsonType: 'object', required: ['_id', 'institution_id', 'major'] },
  },
  curated_requirements: {
    $jsonSchema: { bsonType: 'object', required: ['_id', 'kind'] },
  },
  curated_prerequisites: {
    $jsonSchema: {
      bsonType: 'object', required: ['_id', 'status'],
      properties: { status: { enum: ['resolved', 'needs_review', 'legacy_unresolved'] } },
    },
  },
  curated_mappings: {
    $jsonSchema: {
      bsonType: 'object', required: ['_id', 'kind'],
      properties: { kind: { enum: ['course_category', 'receiver_override'] } },
    },
  },
  agreement_reviews: {
    $jsonSchema: { bsonType: 'object', required: ['_id', 'doc_id', 'system', 'result'] },
  },
  team_members: {
    $jsonSchema: {
      bsonType: 'object', required: ['_id', 'access_status'],
      properties: { access_status: { enum: ['pending', 'granted', 'blocked', 'revoked', 'profile_only'] } },
    },
  },
  settings: {
    // Only settings.app owns visible_pairs/canonical_dirty. Other documents
    // have independent schemas (for example, as_degree_validation).
    $jsonSchema: { bsonType: 'object', required: ['_id'] },
  },
  published_figures: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'title'],
      properties: {
        publication_type: { enum: ['static', 'interactive'] },
      },
    },
  },
});

async function replaceAtomically(db, name, docs) {
  const stageName = `__next_${name}`;
  await db.collection(stageName).drop().catch(() => {});
  await db.createCollection(stageName, {
    ...(VALIDATORS[name] ? { validator: VALIDATORS[name], validationLevel: 'strict' } : {}),
  });
  for (let index = 0; index < docs.length; index += 1000) {
    await db.collection(stageName).insertMany(docs.slice(index, index + 1000), { ordered: false });
  }
  for (const [keys, options] of INDEXES[name] || []) {
    await db.collection(stageName).createIndex(keys, options);
  }
  const inserted = await db.collection(stageName).countDocuments();
  if (inserted !== docs.length) throw new Error(`${name}: staged ${inserted}, expected ${docs.length}`);
  await db.collection(stageName).rename(name, { dropTarget: true });
}

async function validateModel(model) {
  const c = model.collections;
  const checks = {
    institutions: c.assist_institutions.length === model.sourceCounts.institutions,
    courses: c.assist_courses.length === model.sourceCounts.courses,
    agreements: c.assist_agreements.length === model.sourceCounts.agreements,
    admissions: c.admissions.length === model.sourceCounts.admissions,
    requirements: c.curated_requirements.length === model.sourceCounts.requirements,
    reviews: c.agreement_reviews.length === model.sourceCounts.reviews,
    members: c.team_members.length === model.sourceCounts.members,
    figures: c.published_figures.length === model.sourceCounts.figures,
    settings: c.settings.length === model.sourceCounts.settings
      && c.settings.some((row) => (
        row._id === 'app'
        && Array.isArray(row.visible_pairs)
        && typeof row.canonical_dirty === 'boolean'
      )),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`model validation failed: ${failed.join(', ')}`);

  const courseIds = new Set(c.assist_courses.map((row) => row._id));
  const missingOptionIds = new Set();
  for (const agreement of c.assist_agreements) {
    for (const group of agreement.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          for (const option of receiver.options || []) {
            for (const id of option.course_keys || []) if (!courseIds.has(id)) missingOptionIds.add(id);
          }
        }
      }
    }
  }
  return { checks, missing_agreement_course_ids: missingOptionIds.size };
}

async function dropLegacy(db) {
  if (!APPLY || !CONFIRMED) {
    throw new Error('--drop-legacy requires both --apply and --yes');
  }
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name));
  for (const name of DESTINATIONS) {
    if (!existing.has(name)) throw new Error(`refusing cleanup: ${name} is missing`);
  }
  for (const name of ['assist_institutions', 'assist_courses', 'settings']) {
    if (!await db.collection(name).countDocuments()) {
      throw new Error(`refusing cleanup: ${name} is empty`);
    }
  }
  for (const name of LEGACY_COLLECTIONS) {
    await db.collection(name).drop().catch((error) => {
      if (error.codeName !== 'NamespaceNotFound') throw error;
    });
  }
}

async function main() {
  const uri = process.env.TARGET_MONGO_URI || process.env.MONGO_URI;
  const dbName = process.env.TARGET_DB_NAME || process.env.DB_NAME || 'pmt_research';
  if (!uri) throw new Error('TARGET_MONGO_URI or MONGO_URI is required');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    if (DROP_LEGACY) {
      await dropLegacy(db);
      console.log(JSON.stringify({ mode: 'cleanup', dropped: LEGACY_COLLECTIONS }, null, 2));
      return;
    }

    const model = await buildModel(db);
    const validation = await validateModel(model);
    const counts = Object.fromEntries(
      Object.entries(model.collections).map(([name, docs]) => [name, docs.length])
    );
    if (APPLY) {
      for (const name of DESTINATIONS) {
        await replaceAtomically(db, name, model.collections[name]);
      }
    }
    const existingNames = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name)
    );
    console.log(JSON.stringify({
      mode: APPLY ? 'applied-copy-first' : 'dry-run',
      database: dbName,
      counts,
      validation,
      prerequisite_coverage: model.prerequisiteCoverage,
      legacy_collections_present: LEGACY_COLLECTIONS.filter((name) => existingNames.has(name)),
    }, null, 2));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  DESTINATIONS,
  LEGACY_COLLECTIONS,
  INDEXES,
  VALIDATORS,
  buildModel,
  validateModel,
  replaceAtomically,
};
