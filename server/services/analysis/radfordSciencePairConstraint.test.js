import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import remainingSciencePairEvidence from '../../.va-catalogs/research/radford-remaining-science-pair-evidence.json';
import {
  ASSOCIATE_MATRIX,
  ASSOCIATE_TREE_SHA256,
  ASSOCIATE_VARIANT_BINDINGS,
  AUTHORITATIVE_STORED_VARIANTS,
  MOUNTAIN_STORED_CARRIER_SHA256,
  RADFORD_REMAINING_FREE_ELECTIVE_UNITS,
  SOURCE_BOUND_CARRIER_EVIDENCE,
  applyRadfordSciencePair,
  associateScienceTreeFingerprint,
  associateSourceIdentityFingerprint,
  baseSciencePairContext,
  exactAssociateScienceTree,
  exactAssociateVariantFingerprintBinding,
  exactMountainStoredCarrierFingerprintBinding,
  exactRadfordScienceRule,
  exactRichardBlandPairEvidence,
  radfordAssociateSciencePairCarrier,
  radfordSciencePairRuntimeContext,
  sourceEquivalenciesSha256,
} from './radfordSciencePairConstraint';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import { PAIR_TARGETS } from './radfordCollegeSciencePairEvidence';

const sourcePlan = () => cachedAcceptedSourcePlan();
const sourceAssociates = () => sourcePlan().documents.filter((document) => (
  document.kind === 'as_degree' && document.status === 'extracted'
));
const acceptedRadford = () => sourcePlan().evaluatedDocuments.find((document) => (
  document.institution_id === 'va:uni:radford-university'
));

function finalAssociateProjections() {
  const asDegrees = sourceAssociates();
  const slugs = new Set(asDegrees.map((document) => (
    document._id.replace(/^va:as:/, '').replace(/:cs$/, '')
  )));
  const institutions = VA_INSTITUTION_REGISTRY.filter((row) => (
    row.level === 'community_college' && slugs.has(row.slug)
  )).map((row) => ({
    _id: `va:cc:${row.slug}`, level: row.level, name: row.name,
  }));
  return buildProjection({ courses: [], degrees: [], asDegrees, institutions }).asDegrees;
}

function finalRadfordProjection() {
  const degree = sourcePlan().documents.find((document) => (
    document.institution_id === 'va:uni:radford-university'
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9219);
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  const institutions = [college, university].map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level, name: row.name,
  }));
  const supply = {
    course_id: courseIdFor('CSC299'), course_key: 'va:CSC299', code: 'CSC299',
    title: 'Radford science final-projection parity witness', credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: 'NO_MATCH_299' }],
  };
  return buildProjection({
    courses: [supply], degrees: [degree], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9219);
}

function exactAgreement(context) {
  const sourceEquivalencies = context.pair.map((fact) => ({
    sending_course_id: fact.sending_course_id,
    sending_course_key: `va:${fact.sending_code}`,
    sending_code: fact.sending_code,
    receiving_identifier: fact.receiving_code,
    receiving_name: fact.receiving_name,
    receiving_notes: fact.receiving_notes,
    receiving_parent_id: fact.receiving_parent_id,
    sending_source_url: fact.sending_source_url,
  })).sort((left, right) => (
    left.sending_course_id - right.sending_course_id
      || left.receiving_parent_id - right.receiving_parent_id
      || left.receiving_name.localeCompare(right.receiving_name)
  ));
  const agreement = {
    _id: `va:agreement:9219:${context.college.numeric_id}`,
    university_id: 'va:uni:radford-university',
    college_id: `va:cc:${context.college.slug}`,
    uc_school_id: 9219,
    community_college_id: context.college.numeric_id,
    university_name: 'Radford University',
    college_name: context.college.name,
    major: 'Computer Science, B.S.',
    state: 'va',
    source: 'derived from Transfer Virginia course equivalencies × published degree requirements',
    pairing: 'course-equivalency-join',
    derived_from: { degree_id: 'va:degree:radford-university:cs', supply_edges: 2 },
    source_equivalencies_contract: 'va-concrete-supply-edge-v2',
    source_equivalencies_count: sourceEquivalencies.length,
    source_equivalencies_sha256: sourceEquivalenciesSha256(sourceEquivalencies),
    source_equivalencies: sourceEquivalencies,
  };
  return agreement;
}

function restampSourceEquivalencies(agreement) {
  agreement.source_equivalencies_count = agreement.source_equivalencies.length;
  agreement.source_equivalencies_sha256 = sourceEquivalenciesSha256(
    agreement.source_equivalencies,
  );
  agreement.derived_from.supply_edges = Math.max(
    agreement.derived_from.supply_edges,
    agreement.source_equivalencies.length,
  );
}

function runtimeMaps(context) {
  const degreeCourseSet = new Set(context.pair_ids);
  const unitsById = new Map(context.pair.map((fact) => [
    fact.sending_course_id, fact.sending_credits,
  ]));
  return { degreeCourseSet, unitsById, agreements: [exactAgreement(context)] };
}

describe('Radford exact pair-level science constraint', () => {
  it('is inapplicable to California, Massachusetts, and every non-Radford template', () => {
    for (const document of [
      { _id: 'degree:1100:computer-science', state: 'ca', school_id: 1100 },
      { _id: 'ma:degree:computer-science', state: 'ma', school: 'Example University' },
      { _id: 'degree:9230:va-cs', state: 'va', school_id: 9230 },
    ]) {
      expect(baseSciencePairContext(document, {})).toEqual({
        applicable: false,
        ready: false,
      });
    }
  });

  it('has exact accepted-source/final-projection parity for all 19 A.S. trees', () => {
    const projected = finalAssociateProjections();
    expect(sourceAssociates()).toHaveLength(19);
    expect(projected).toHaveLength(19);
    expect(Object.keys(ASSOCIATE_MATRIX)).toHaveLength(19);
    expect(Object.keys(ASSOCIATE_TREE_SHA256)).toHaveLength(19);
    expect(Object.keys(ASSOCIATE_VARIANT_BINDINGS)).toHaveLength(19);
    for (const source of sourceAssociates()) {
      const slug = source._id.replace(/^va:as:/, '').replace(/:cs$/, '');
      const projection = projected.find((row) => row.va_requirement_id === source._id);
      expect(projection, slug).toBeTruthy();
      expect(associateScienceTreeFingerprint(source), `${slug}:source`)
        .toBe(ASSOCIATE_TREE_SHA256[slug]);
      expect(associateScienceTreeFingerprint(projection), `${slug}:projection`)
        .toBe(ASSOCIATE_TREE_SHA256[slug]);
      expect(associateSourceIdentityFingerprint(source), `${slug}:source identity`)
        .toBe(ASSOCIATE_VARIANT_BINDINGS[slug][0].source_identity_sha256);
      expect(exactAssociateScienceTree(source), `${slug}:source receipt`)
        .toMatchObject({
          supported: true,
          proof: {
            document_style: 'accepted_source',
            variant: 'candidate',
            condition_scope: 'radford_figure_3_4_condition_only',
            publication_readiness_authorized: false,
          },
        });
      expect(exactAssociateScienceTree(projection), `${slug}:projection receipt`)
        .toMatchObject({
          supported: true,
          proof: {
            document_style: 'final_projection',
            variant: 'candidate',
            publication_readiness_authorized: false,
          },
        });
    }
  });

  it('binds every authoritative stored variant by style, source, tree, and verification', () => {
    const stored = Object.entries(ASSOCIATE_VARIANT_BINDINGS).flatMap(([slug, variants]) => (
      variants.filter((variant) => variant.variant === 'authoritative_stored')
        .map((variant) => [slug, variant])
    ));
    expect(stored).toHaveLength(13);
    expect(Object.keys(AUTHORITATIVE_STORED_VARIANTS)).toHaveLength(13);
    for (const [slug, binding] of stored) {
      for (const documentStyle of ['accepted_source', 'final_projection']) {
        const exact = {
          usage: 'radford_figure_3_4_condition',
          document_style: documentStyle,
          source_bundle_sha256: binding.source_bundle_sha256,
          source_identity_sha256: binding.source_identity_sha256,
          associate_tree_sha256: binding.tree_sha256[documentStyle],
          verification_sha256: binding.verification_sha256,
          verification_verified: binding.verification_verified,
        };
        expect(exactAssociateVariantFingerprintBinding(slug, exact), `${slug}:${documentStyle}`)
          .toMatchObject({
            supported: true,
            binding: {
              variant: 'authoritative_stored',
              publication_readiness_authorized: false,
            },
          });
        for (const key of [
          'source_bundle_sha256', 'source_identity_sha256',
          'associate_tree_sha256', 'verification_sha256',
        ]) {
          expect(exactAssociateVariantFingerprintBinding(slug, {
            ...exact,
            [key]: '0'.repeat(64),
          }), `${slug}:${documentStyle}:${key}`).toMatchObject({ supported: false });
        }
        expect(exactAssociateVariantFingerprintBinding(slug, {
          ...exact,
          verification_verified: !binding.verification_verified,
        }), `${slug}:${documentStyle}:verification verdict`)
          .toMatchObject({ supported: false });
      }
    }
  });

  it('retains both exact stored trees while closing only the supplemented Richard Bland pair', () => {
    expect(ASSOCIATE_MATRIX['richard-bland-college']).toMatchObject({
      pair: ['PHYS201', 'PHYS202'], blocker: null,
    });
    expect(ASSOCIATE_MATRIX['southwest-virginia-community-college']).toMatchObject({
      pair: null, blocker: expect.stringMatching(/only one named eligible science course/),
    });
    for (const slug of [
      'richard-bland-college', 'southwest-virginia-community-college',
    ]) {
      const binding = ASSOCIATE_VARIANT_BINDINGS[slug]
        .find((variant) => variant.variant === 'authoritative_stored');
      expect(binding).toMatchObject({
        verification_verified: true,
        condition_scope: 'radford_figure_3_4_condition_only',
        publication_readiness_authorized: false,
      });
      for (const documentStyle of ['accepted_source', 'final_projection']) {
        expect(exactAssociateVariantFingerprintBinding(slug, {
          usage: 'radford_figure_3_4_condition',
          document_style: documentStyle,
          source_bundle_sha256: binding.source_bundle_sha256,
          source_identity_sha256: binding.source_identity_sha256,
          verification_sha256: binding.verification_sha256,
          verification_verified: binding.verification_verified,
          associate_tree_sha256: binding.tree_sha256[documentStyle],
        })).toMatchObject({ supported: true });
      }
    }
    expect(exactRichardBlandPairEvidence()).toMatchObject({
      supported: true,
      facts_sha256: remainingSciencePairEvidence.facts_sha256,
      pair: [
        { sending_code: 'PHYS201', sending_course_key: 'va:cc:richard-bland-college:PHYS201' },
        { sending_code: 'PHYS202', sending_course_key: 'va:cc:richard-bland-college:PHYS202' },
      ],
    });
    const drifted = structuredClone(remainingSciencePairEvidence);
    drifted.facts.cells[0].selected_pair[0].receiving_code = 'PHYS999';
    expect(exactRichardBlandPairEvidence(drifted)).toMatchObject({ supported: false });
  });

  it('never lets the JSR/Camp verified:false condition receipt authorize publication', () => {
    for (const slug of [
      'j-sargeant-reynolds-community-college',
      'paul-d-camp-community-college',
    ]) {
      const binding = ASSOCIATE_VARIANT_BINDINGS[slug]
        .find((variant) => variant.variant === 'authoritative_stored');
      expect(binding).toMatchObject({
        verification_verified: false,
        condition_scope: 'radford_figure_3_4_condition_only',
        publication_readiness_authorized: false,
      });
      expect(exactAssociateVariantFingerprintBinding(slug, {
        usage: 'publication_readiness',
        document_style: 'final_projection',
        source_bundle_sha256: binding.source_bundle_sha256,
        source_identity_sha256: binding.source_identity_sha256,
        associate_tree_sha256: binding.tree_sha256.final_projection,
        verification_sha256: binding.verification_sha256,
        verification_verified: false,
      })).toMatchObject({
        supported: false,
        reason: expect.stringMatching(/cannot authorize publication readiness/),
      });
    }
  });

  it('replays the three aggregate-carrier source receipts and preserves source/projection parity', () => {
    const projected = finalAssociateProjections();
    for (const [slug, evidence] of Object.entries(SOURCE_BOUND_CARRIER_EVIDENCE)) {
      const source = sourceAssociates().find((document) => (
        document._id === `va:as:${slug}:cs`
      ));
      const projection = projected.find((document) => (
        document.va_requirement_id === source._id
      ));
      for (const receipt of evidence.sources) {
        const file = path.resolve(
          __dirname, '../../.va-catalogs/pages', receipt.retained_text,
        );
        const bytes = fs.readFileSync(file);
        expect(createHash('sha256').update(bytes).digest('hex'), file)
          .toBe(receipt.sha256);
        const retained = bytes.toString('utf8');
        for (const fragment of receipt.required_fragments) {
          expect(retained, `${slug}:${receipt.id}:${fragment}`).toContain(fragment);
        }
      }
      const sourceCarrier = radfordAssociateSciencePairCarrier(source);
      const projectionCarrier = radfordAssociateSciencePairCarrier(projection);
      expect(sourceCarrier, `${slug}:source`).toMatchObject({
        ready: true,
        rule: evidence.rule,
        pair_codes: ['CHM111', 'CHM112'],
        aggregate_units_replaced: evidence.aggregate_units_replaced,
        proof: { source_bound_aggregate_carrier: true },
      });
      expect(projectionCarrier, `${slug}:projection`).toEqual(sourceCarrier);
    }

    // Mountain Gateway's locally listed menu is deliberately outside the
    // generic tree fingerprint; the carrier itself must independently bind it.
    const changed = structuredClone(sourceAssociates().find((document) => (
      document._id === 'va:as:mountain-gateway-community-college:cs'
    )));
    changed.option_sets.science_specialized.locally_listed_courses
      = changed.option_sets.science_specialized.locally_listed_courses
        .filter((code) => code !== 'CHM112');
    expect(radfordAssociateSciencePairCarrier(changed)).toMatchObject({
      ready: false,
      reason: expect.stringMatching(/carrier changed/),
    });

    for (const [documentStyle, carrierSha256] of Object.entries(
      MOUNTAIN_STORED_CARRIER_SHA256,
    )) {
      expect(exactMountainStoredCarrierFingerprintBinding({
        variant: 'authoritative_stored',
        document_style: documentStyle,
        carrier_sha256: carrierSha256,
      }), documentStyle).toMatchObject({
        supported: true,
        carrier_sha256: carrierSha256,
      });
      expect(exactMountainStoredCarrierFingerprintBinding({
        variant: 'authoritative_stored',
        document_style: documentStyle,
        carrier_sha256: '0'.repeat(64),
      }), `${documentStyle}:raw receiver mutation`).toMatchObject({ supported: false });
    }
    expect(exactMountainStoredCarrierFingerprintBinding({
      variant: 'candidate',
      document_style: 'final_projection',
      carrier_sha256: MOUNTAIN_STORED_CARRIER_SHA256.final_projection,
    })).toMatchObject({ supported: false });
  });

  it('publishes eighteen source-valid pairs and leaves only Southwest blocked', () => {
    expect(PAIR_TARGETS.map((target) => [
      target.college_slug, [...target.sending_codes],
    ])).toEqual(Object.values(ASSOCIATE_MATRIX)
      .filter((row) => row.pair && row.slug !== 'richard-bland-college')
      .map((row) => [row.slug, [...row.pair]]));
    const bachelor = finalRadfordProjection();
    expect(exactRadfordScienceRule(acceptedRadford())).toMatchObject({ supported: true });
    expect(exactRadfordScienceRule(bachelor)).toMatchObject({ supported: true });
    const projected = finalAssociateProjections();
    const matrix = projected.map((associate) => {
      const context = baseSciencePairContext(bachelor, associate);
      return {
        college: associate.college_name,
        ready: context.ready,
        pair: context.ready ? context.pair.map((fact) => fact.sending_code) : null,
        reason: context.reason || null,
      };
    });
    expect(matrix.filter((row) => row.ready)).toHaveLength(18);
    expect(matrix.filter((row) => !row.ready)).toHaveLength(1);
    expect(matrix.find((row) => row.college === 'Wytheville Community College'))
      .toMatchObject({
        ready: true,
        pair: ['PHY201', 'PHY202'],
        reason: null,
      });
    expect(matrix.find((row) => row.college === 'Brightpoint Community College'))
      .toMatchObject({
        ready: true,
        pair: ['CHM111', 'CHM112'],
        reason: null,
      });
    expect(matrix.find((row) => row.college === 'Mountain Gateway Community College'))
      .toMatchObject({
        ready: true,
        pair: ['CHM111', 'CHM112'],
        reason: null,
      });
    expect(matrix.find((row) => row.college === 'Richard Bland College'))
      .toMatchObject({
        ready: true,
        pair: ['PHYS201', 'PHYS202'],
        reason: null,
      });
    expect(matrix.filter((row) => !row.ready).map((row) => row.college).sort()).toEqual([
      'Southwest Virginia Community College',
    ].sort());
  });

  it('requires exact source-tree units and both current incoming runtime edges', () => {
    const bachelor = finalRadfordProjection();
    const associate = finalAssociateProjections().find((document) => (
      document.community_college_id === 9301
    ));
    const base = baseSciencePairContext(bachelor, associate);
    const maps = runtimeMaps(base);
    expect(radfordSciencePairRuntimeContext(bachelor, associate, maps))
      .toMatchObject({ ready: true, pair_ids: base.pair_ids });

    const missingCourse = { ...maps, degreeCourseSet: new Set([base.pair_ids[0]]) };
    expect(radfordSciencePairRuntimeContext(bachelor, associate, missingCourse))
      .toMatchObject({ ready: false, reason: expect.stringMatching(/source-tree identity/) });
    const wrongUnits = { ...maps, unitsById: new Map(maps.unitsById) };
    wrongUnits.unitsById.set(base.pair_ids[1], 3);
    expect(radfordSciencePairRuntimeContext(bachelor, associate, wrongUnits))
      .toMatchObject({ ready: false, reason: expect.stringMatching(/four-credit receipt/) });
    const absentProjectedEdge = { ...maps, agreements: [{
      ...maps.agreements[0], source_equivalencies: [],
    }] };
    expect(radfordSciencePairRuntimeContext(bachelor, associate, absentProjectedEdge))
      .toMatchObject({ ready: false, reason: expect.stringMatching(/no concrete/) });
    const contradictoryEdge = structuredClone(maps);
    contradictoryEdge.agreements[0].source_equivalencies[1].receiving_parent_id = courseIdFor('BIO101');
    restampSourceEquivalencies(contradictoryEdge.agreements[0]);
    expect(radfordSciencePairRuntimeContext(bachelor, associate, contradictoryEdge))
      .toMatchObject({ ready: false, reason: expect.stringMatching(/identity contract/) });
  });

  it('never stitches, widens, duplicates, or relabels the rebuilt pair edge bundle', () => {
    const bachelor = finalRadfordProjection();
    const associate = finalAssociateProjections().find((document) => (
      document.community_college_id === 9301
    ));
    const base = baseSciencePairContext(bachelor, associate);
    const good = runtimeMaps(base);
    const mutations = [
      ['foreign college', (maps) => { maps.agreements[0].community_college_id = 9302; }],
      ['one edge', (maps) => { maps.agreements[0].source_equivalencies.pop(); }],
      ['duplicate edge', (maps) => {
        maps.agreements[0].source_equivalencies.push(
          structuredClone(maps.agreements[0].source_equivalencies[0]),
        );
      }],
      ['duplicate endpoint under a second display name', (maps) => {
        const duplicate = structuredClone(maps.agreements[0].source_equivalencies[0]);
        duplicate.receiving_name = 'Alternate non-generic display name';
        maps.agreements[0].source_equivalencies.push(duplicate);
        maps.agreements[0].source_equivalencies.sort((left, right) => (
          left.sending_course_id - right.sending_course_id
            || left.receiving_parent_id - right.receiving_parent_id
            || left.receiving_name.localeCompare(right.receiving_name)
        ));
      }],
      ['swapped sending id', (maps) => {
        const rows = maps.agreements[0].source_equivalencies;
        [rows[0].sending_course_id, rows[1].sending_course_id]
          = [rows[1].sending_course_id, rows[0].sending_course_id];
      }],
      ['generic receiving identifier', (maps) => {
        maps.agreements[0].source_equivalencies[0].receiving_identifier = 'CHEM2XX';
      }],
      ['missing explicit notes field', (maps) => {
        delete maps.agreements[0].source_equivalencies[0].receiving_notes;
      }],
      ['unknown future condition field', (maps) => {
        maps.agreements[0].source_equivalencies[0].conditions = 'department approval';
      }],
      ['unsorted edge bundle', (maps) => {
        maps.agreements[0].source_equivalencies.reverse();
      }],
    ];
    for (const [label, mutate] of mutations) {
      const maps = structuredClone(good);
      mutate(maps);
      restampSourceEquivalencies(maps.agreements[0]);
      expect(radfordSciencePairRuntimeContext(bachelor, associate, maps), label)
        .toMatchObject({ ready: false });
    }

    const split = structuredClone(good);
    const [first, second] = split.agreements[0].source_equivalencies;
    split.agreements = [
      { ...split.agreements[0], source_equivalencies: [first] },
      { ...split.agreements[0], _id: `${split.agreements[0]._id}:copy`, source_equivalencies: [second] },
    ];
    split.agreements.forEach(restampSourceEquivalencies);
    expect(radfordSciencePairRuntimeContext(bachelor, associate, split))
      .toMatchObject({ ready: false, reason: expect.stringMatching(/one rebuilt agreement/) });

    // A real course may publish more than one landing. The exact pair remains
    // valid only because the one required edge is still present unchanged.
    const additionalLanding = structuredClone(good);
    const extra = {
      ...additionalLanding.agreements[0].source_equivalencies[0],
      receiving_identifier: 'CHEM101',
      receiving_parent_id: courseIdFor('CHEM101'),
    };
    additionalLanding.agreements[0].source_equivalencies.push(extra);
    additionalLanding.agreements[0].source_equivalencies.sort((left, right) => (
      left.sending_course_id - right.sending_course_id
        || left.receiving_parent_id - right.receiving_parent_id
    ));
    restampSourceEquivalencies(additionalLanding.agreements[0]);
    expect(radfordSciencePairRuntimeContext(bachelor, associate, additionalLanding))
      .toMatchObject({ ready: true });
  });

  it('binds the complete sorted channel with count, hash, and raw-supply receipts', () => {
    const bachelor = finalRadfordProjection();
    const associate = finalAssociateProjections().find((document) => (
      document.community_college_id === 9301
    ));
    const base = baseSciencePairContext(bachelor, associate);
    const good = runtimeMaps(base);
    const unrelated = {
      ...good.agreements[0].source_equivalencies[0],
      sending_course_id: courseIdFor('BIO101'),
      sending_course_key: 'va:BIO101',
      sending_code: 'BIO101',
      receiving_identifier: 'BIOL101',
      receiving_name: 'General Biology',
      receiving_parent_id: courseIdFor('BIOL101'),
      sending_source_url: 'https://www.transfervirginia.org/course/DEADBEEF',
    };
    good.agreements[0].source_equivalencies.push(unrelated);
    good.agreements[0].source_equivalencies.sort((left, right) => (
      left.sending_course_id - right.sending_course_id
        || left.receiving_parent_id - right.receiving_parent_id
    ));
    restampSourceEquivalencies(good.agreements[0]);
    expect(radfordSciencePairRuntimeContext(bachelor, associate, good))
      .toMatchObject({ ready: true });

    for (const mutate of [
      (maps) => { maps.agreements[0].source_equivalencies.pop(); },
      (maps) => { maps.agreements[0].source_equivalencies.push(structuredClone(unrelated)); },
      (maps) => { maps.agreements[0].source_equivalencies_count += 1; },
      (maps) => { maps.agreements[0].source_equivalencies_sha256 = '0'.repeat(64); },
      (maps) => { maps.agreements[0].derived_from.supply_edges = 0; },
    ]) {
      const changed = structuredClone(good);
      mutate(changed);
      expect(radfordSciencePairRuntimeContext(bachelor, associate, changed))
        .toMatchObject({
          ready: false,
          reason: expect.stringMatching(/count, hash, or supply receipt/),
        });
    }
  });

  it('commits two distinct eight-credit named courses and the exact 8+33 capacity equation', () => {
    const bachelor = finalRadfordProjection();
    const associate = finalAssociateProjections().find((document) => (
      document.community_college_id === 9301
    ));
    const base = baseSciencePairContext(bachelor, associate);
    const context = radfordSciencePairRuntimeContext(
      bachelor, associate, runtimeMaps(base),
    );
    const state = {
      directIds: new Set(), lowerDirectIds: new Set(),
      directAppliedUnits: 0, lowerDirectAppliedUnits: 0,
    };
    expect(applyRadfordSciencePair(state, context, new Set(context.pair_ids)))
      .toEqual({ applied: true });
    expect(state).toMatchObject({
      directAppliedUnits: 8,
      lowerDirectAppliedUnits: 8,
      sourceBoundRadfordSciencePair: {
        sending_codes: ['CHM111', 'CHM112'],
        receiving_codes: ['CHEM111', 'CHEM112'],
        sending_units: 8,
        receiving_units: 8,
        free_elective_displacement: 2,
        remaining_free_elective_units: RADFORD_REMAINING_FREE_ELECTIVE_UNITS,
      },
    });
    expect([...state.directIds]).toEqual(context.pair_ids);
    expect(8 + RADFORD_REMAINING_FREE_ELECTIVE_UNITS).toBe(41);

    const onlyOne = new Set([context.pair_ids[0]]);
    expect(applyRadfordSciencePair({
      directIds: new Set(), lowerDirectIds: new Set(),
      directAppliedUnits: 0, lowerDirectAppliedUnits: 0,
    }, context, onlyOne)).toMatchObject({ applied: false });
    const reused = {
      directIds: new Set([context.pair_ids[0]]), lowerDirectIds: new Set(),
      directAppliedUnits: 4, lowerDirectAppliedUnits: 4,
    };
    expect(applyRadfordSciencePair(reused, context, new Set(context.pair_ids)))
      .toMatchObject({ applied: false, reason: expect.stringMatching(/already spent/) });
  });

  it.each(['accepted_source', 'final_projection'])(
    'fails closed on bachelor/associate/source/identity tampering in %s',
    (style) => {
      const bachelor = structuredClone(style === 'accepted_source'
        ? acceptedRadford() : finalRadfordProjection());
      const associates = style === 'accepted_source'
        ? sourceAssociates() : finalAssociateProjections();
      const associate = structuredClone(associates.find((document) => (
        document.va_requirement_id === 'va:as:blue-ridge-community-college:cs'
          || document._id === 'va:as:blue-ridge-community-college:cs'
      )));
      const mutations = [
        ['bachelor range', () => { bachelor.requirement_groups[2].sections[0].unit_advisement_max = 7; }],
        ['bachelor free capacity', () => { bachelor.requirement_groups[12].sections[0].unit_advisement = 34; }],
        ['associate pair identity', () => {
          const option = associate.requirement_groups[5].sections[0].receivers[0]
            .options.find((row) => row.course_ids?.includes(courseIdFor('CHM111')));
          option.course_ids[0] += 1;
        }],
        ['associate bundle', () => { associate.provenance.source_bundle_hash = '0'.repeat(64); }],
      ];
      if (style === 'final_projection') {
        mutations.push(['projection contract', () => { delete associate.analysis_contract; }]);
      }
      for (const [label, mutate] of mutations) {
        const bachelorCopy = structuredClone(bachelor);
        const associateCopy = structuredClone(associate);
        // Mutators close over the originals, so restore and invoke against the
        // corresponding carrier explicitly for deterministic independent rows.
        Object.assign(bachelor, bachelorCopy);
        Object.assign(associate, associateCopy);
        mutate();
        expect(baseSciencePairContext(bachelor, associate), label)
          .toMatchObject({ applicable: true, ready: false });
        Object.assign(bachelor, style === 'accepted_source'
          ? structuredClone(acceptedRadford()) : structuredClone(finalRadfordProjection()));
        Object.assign(associate, structuredClone(associates.find((document) => (
          document.va_requirement_id === 'va:as:blue-ridge-community-college:cs'
            || document._id === 'va:as:blue-ridge-community-college:cs'
        ))));
      }
    },
  );
});
