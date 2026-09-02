/**
 * Exact pair-level resolver for Virginia Tech Passport/UCGS annotations.
 *
 * The selected edge says a course applies to a Pathways concept "with
 * Passport or UCGS." The paper never observes an individual student's earned
 * credential. It instead models completion of a source-bound Virginia A.S.
 * degree, which Virginia Tech independently says fulfills all Pathways general
 * education. This resolver therefore makes only the annotation advisory; it
 * never asserts Passport/UCGS completion and never waives a named major rule.
 */

const EVIDENCE = require(
  '../../.va-catalogs/research/virginia-tech-transferable-associate-policy-evidence.json'
);
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const {
  exactVirginiaTechFigure34Tree,
} = require('./virginiaTechConstraintProofs');
const {
  validateVirginiaTechAgreementIdentity,
} = require('./virginiaTechAtomicArticulation');
const {
  POLICY_FACTS_SHA256,
  POLICY_RESPONSE_SHA256,
  POLICY_URL,
  ROBOTS_RESPONSE_SHA256,
  virginiaTechTransferPolicyEvidenceIssue,
} = require('./virginiaTechTransferPolicyEvidence');

const EXACT_NOTE_PATTERN =
  /^With Passport or UCGS, applies to General Education, Pathway (1A|1F|3|4)\.$/;

const EDGES = Object.freeze([
  Object.freeze({
    sending_code: 'PHY241', receiving_identifier: 'PHYS2305',
    receiving_name: 'Foundations of Physics', pathway: '4',
    requirement_group_index: 6, section_index: 0, receiver_index: 2,
    sending_source_url:
      'https://www.transfervirginia.org/course/D3A19B971F9411F082AC0242AC15010A',
  }),
  Object.freeze({
    sending_code: 'PHY242', receiving_identifier: 'PHYS2306',
    receiving_name: 'Foundations of Physics', pathway: '4',
    requirement_group_index: 7, section_index: 0, receiver_index: 2,
    sending_source_url:
      'https://www.transfervirginia.org/course/D3A19C591F9411F082AC0242AC15010A',
  }),
  Object.freeze({
    sending_code: 'CST100', receiving_identifier: 'COMM2004',
    receiving_name: 'Public Speaking', pathway: '1A',
    requirement_group_index: 8, section_index: 0, receiver_index: 0,
    sending_source_url:
      'https://www.transfervirginia.org/course/D37A6B7C1F9411F082AC0242AC15010A',
  }),
  Object.freeze({
    sending_code: 'CST110', receiving_identifier: 'COMM2014',
    receiving_name: 'Comm Principles of Teamwork', pathway: '3',
    requirement_group_index: 8, section_index: 0, receiver_index: 1,
    sending_source_url:
      'https://www.transfervirginia.org/course/D37A6BB71F9411F082AC0242AC15010A',
  }),
  Object.freeze({
    sending_code: 'ENG111', receiving_identifier: 'ENGL1105',
    receiving_name: 'First-Year Writing', pathway: '1F',
    requirement_group_index: 11, section_index: 0, receiver_index: 0,
    sending_source_url:
      'https://www.transfervirginia.org/course/D37AE0551F9411F082AC0242AC15010A',
  }),
  Object.freeze({
    sending_code: 'ENG112', receiving_identifier: 'ENGL1106',
    receiving_name: 'First-Year Writing', pathway: '1F',
    requirement_group_index: 11, section_index: 1, receiver_index: 0,
    sending_source_url:
      'https://www.transfervirginia.org/course/D37AE0F71F9411F082AC0242AC15010A',
  }),
]);

const text = (value) => value == null ? null : String(value).trim();
const number = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;

function exactTransferableAssociateIdentity(associateDocument, college) {
  const id = college?.id;
  const slug = college?.slug;
  const officialVccsOrRbc = slug === 'richard-bland-college'
    || String(slug || '').endsWith('-community-college');
  const sourceBundleSha256 = text(associateDocument?.provenance?.source_bundle_hash);
  const sources = Array.isArray(associateDocument?.sources) ? associateDocument.sources : [];
  const sourceIds = sources.map((source) => text(source?.id));
  const exactOfficialSources = sources.length > 0
    && new Set(sourceIds).size === sources.length
    && sourceIds.includes('major')
    && sources.every((source) => (
      source?.official === true
      && source?.secure === true
      && /^https:\/\//.test(text(source?.url) || '')
      && /^[a-f0-9]{64}$/.test(text(source?.sha256) || '')
    ));
  if (!officialVccsOrRbc
      || !exactOfficialSources
      || associateDocument?.kind !== 'as_degree'
      || text(associateDocument?.state)?.toLowerCase() !== 'va'
      || text(associateDocument?.major_slug) !== 'va-cs'
      || text(associateDocument?.degree_type) !== 'local_as'
      || text(associateDocument?.source_degree_type)?.toUpperCase() !== 'AS'
      || text(associateDocument?.status) !== 'found'
      || text(associateDocument?.va_requirement_status) !== 'extracted'
      || number(associateDocument?.community_college_id) !== id
      || text(associateDocument?.college_id) !== `va:cc:${id}`
      || text(associateDocument?.college_name) !== college.name
      || text(associateDocument?._id) !== `as_degree:${id}:va-cs:local_as`
      || text(associateDocument?.va_requirement_id) !== `va:as:${slug}:cs`
      || text(associateDocument?.unit_system) !== 'semester'
      || text(associateDocument?.catalog_year) !== '2026-2027'
      || number(associateDocument?.total_units) < 60
      || !usesCanonicalSourceContract(associateDocument)
      || !/^[a-f0-9]{64}$/.test(sourceBundleSha256 || '')
      || /^0{64}$/.test(sourceBundleSha256 || '')
      || text(associateDocument?.provenance?.composition_artifact)
        !== `server/.va-catalogs/composed/${slug}.json`
      || number(associateDocument?.provenance?.composition_schema_version) !== 1) return null;
  return {
    community_college_id: id,
    college_name: college.name,
    source_slug: slug,
    source_requirement_id: associateDocument.va_requirement_id,
    source_bundle_sha256: sourceBundleSha256,
    award: 'AS',
  };
}

function exactEdge(row) {
  const match = text(row?.source_receiving_notes)?.match(EXACT_NOTE_PATTERN);
  if (!match) return null;
  const candidates = EDGES.filter((edge) => (
    text(row?.sending_code) === edge.sending_code
    && text(row?.source_receiving_identifier) === edge.receiving_identifier
    && text(row?.source_receiving_name) === edge.receiving_name
    && text(row?.sending_source_url) === edge.sending_source_url
    && number(row?.requirement_group_index) === edge.requirement_group_index
    && number(row?.section_index) === edge.section_index
    && number(row?.receiver_index) === edge.receiver_index
    && number(row?.option_index) === 0
    && number(row?.demand_index) === 0
    && match[1] === edge.pathway
  ));
  return candidates.length === 1 ? candidates[0] : null;
}

function resolveVirginiaTechTransferableAsPassportNote({
  agreement,
  row,
  bachelorDocument,
  associateDocument,
  figureModel,
  evidence = EVIDENCE,
} = {}) {
  if (!EXACT_NOTE_PATTERN.test(text(row?.source_receiving_notes) || '')) {
    return { applicable: false, ready: false };
  }
  const fail = (reason) => ({ applicable: true, ready: false, reason });
  if (figureModel !== 'complete_degree_path') {
    return fail('the Virginia Tech policy resolution is limited to the complete-degree paper model');
  }
  const agreementIdentity = validateVirginiaTechAgreementIdentity(agreement);
  if (!agreementIdentity.valid) return fail(agreementIdentity.reason);
  const associate = exactTransferableAssociateIdentity(
    associateDocument, agreementIdentity.college,
  );
  if (!associate) {
    return fail('the Virginia Tech policy proof requires an exact completed transferable VCCS/RBC A.S. source document owned by this agreement');
  }
  const exact = exactVirginiaTechFigure34Tree(bachelorDocument);
  if (!exact.supported) return fail(exact.reason);
  const policyIssue = virginiaTechTransferPolicyEvidenceIssue(evidence);
  if (policyIssue) return fail(policyIssue);
  const edge = exactEdge(row);
  if (!edge) {
    return fail('the exact Virginia Tech Passport/UCGS selected-edge identity, note, or tree path changed');
  }
  return {
    applicable: true,
    ready: true,
    classification: {
      kind: 'passport_ucgs_annotation_resolved_by_completed_transferable_as',
      blocking: false,
      resolution: {
        rule: 'exact_virginia_tech_completed_transferable_as_pathways_policy_v1',
        policy_url: POLICY_URL,
        policy_facts_sha256: POLICY_FACTS_SHA256,
        policy_response_sha256: POLICY_RESPONSE_SHA256,
        policy_robots_sha256: ROBOTS_RESPONSE_SHA256,
        proof_tree_sha256: exact.proof.proof_tree_sha256,
        figure_model: 'complete_degree_path',
        associate_identity: associate,
        requirement_group_index: edge.requirement_group_index,
        section_index: edge.section_index,
        receiver_index: edge.receiver_index,
        option_index: 0,
        demand_index: 0,
        pathway: edge.pathway,
        passport_or_ucgs_earned_assumed: false,
        resolution_basis: 'independently_qualifying_completed_as',
        major_specific_course_requirements_waived: false,
      },
    },
  };
}

module.exports = {
  EDGES,
  EXACT_NOTE_PATTERN,
  exactTransferableAssociateIdentity,
  resolveVirginiaTechTransferableAsPassportNote,
};
