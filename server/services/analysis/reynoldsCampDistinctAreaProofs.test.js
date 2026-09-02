import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  PLANS,
  proveReynoldsCampFixedDistinctAreaAggregate,
} from './reynoldsCampDistinctAreaProofs';
import { auditAssociateDocument } from './associateFigureConstraints';
import { canonicalSourceContract } from './canonicalSourceContract';

const require = createRequire(import.meta.url);
const { cachedAcceptedSourcePlan } = require('../../scripts/importVirginiaCatalogDegrees');
const { projectGroups } = require('../../scripts/va/buildVaDocuments');

const sourceDocuments = cachedAcceptedSourcePlan().documents
  .filter((document) => document.kind === 'as_degree');

function source(plan) {
  return structuredClone(sourceDocuments.find((document) => document._id === plan.sourceId));
}

function tuple(plan, tupleStyle) {
  return Object.entries(plan.reviewedTuples).find(([, value]) => (
    value.tupleStyle === tupleStyle
  ));
}

function operational(plan) {
  const document = source(plan);
  const [bundle] = tuple(plan, 'protected_operational');
  document.provenance.source_bundle_hash = bundle;
  document.requirement_groups[plan.groupIndex].analysis_constraints = [];
  return document;
}

function projection(document, plan) {
  return {
    ...structuredClone(document),
    _id: `as_degree:${plan.numericId}:va-cs:local_as`,
    kind: 'as_degree',
    major_slug: 'va-cs',
    state: 'va',
    community_college_id: plan.numericId,
    college_id: `va:cc:${plan.numericId}`,
    college_name: plan.name,
    status: 'found',
    va_requirement_status: 'extracted',
    va_requirement_id: document._id,
    analysis_ready: document.acceptance?.ready_for_analysis === true,
    analysis_contract: canonicalSourceContract(),
    requirement_groups: projectGroups(document, { associate: true }),
  };
}

function receipt(document, plan) {
  return proveReynoldsCampFixedDistinctAreaAggregate(
    document.requirement_groups[plan.groupIndex],
    document,
  );
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const SOURCE_SUFFIX = Object.freeze({
  reynolds: Object.freeze({
    catalog: 'catalog',
    major: 'program3',
    program_ba: 'program_ba',
    general_education: 'ge',
    graduation: 'graduation',
    college: 'college',
    college_2: 'college2',
  }),
  camp: Object.freeze({
    major: 'program',
    general_education: 'ge',
    graduation: 'graduation',
  }),
});

describe('Reynolds/Camp fixed distinct-area Figure 3/4 receipts', () => {
  it.each(Object.entries(PLANS))(
    'binds every $1 source receipt to retained official bytes',
    (key, plan) => {
      for (const sourceReceipt of plan.sources) {
        const file = path.resolve(
          __dirname,
          `../../.va-catalogs/pages/${plan.slug}__${SOURCE_SUFFIX[key][sourceReceipt.id]}.txt`,
        );
        expect(fs.existsSync(file), file).toBe(true);
        expect(sha256(fs.readFileSync(file)), sourceReceipt.id).toBe(sourceReceipt.sha256);
      }
    },
  );

  it('does not overstate the source evidence behind the Reynolds B.S. category rule', () => {
    const bs = fs.readFileSync(path.resolve(
      __dirname,
      '../../.va-catalogs/pages/j-sargeant-reynolds-community-college__program3.txt',
    ), 'utf8');
    const ba = fs.readFileSync(path.resolve(
      __dirname,
      '../../.va-catalogs/pages/j-sargeant-reynolds-community-college__program_ba.txt',
    ), 'utf8');
    expect(bs).not.toMatch(/Cannot be from the same discipline area/i);
    expect(ba).toMatch(/Cannot be from the same discipline area/i);
    expect(receipt(source(PLANS.reynolds), PLANS.reynolds).proof).toMatchObject({
      figure_3_4_aggregate_resolved: true,
      figure_6_category_roster_resolved: false,
      category_rule_validity_proven_by_this_receipt: false,
    });
  });

  it('retains Camp\'s exact two-course footnote without inventing a course roster', () => {
    const text = fs.readFileSync(path.resolve(
      __dirname,
      '../../.va-catalogs/pages/paul-d-camp-community-college__program.txt',
    ), 'utf8');
    expect(text).toContain('Students cannot select two humanities courses from the same subgroup.');
    expect(text).toContain('other cannot be a humanities course.');
    expect(receipt(source(PLANS.camp), PLANS.camp).proof).toMatchObject({
      fixed_aggregate_units: 6,
      distinct_areas_retained: 2,
      figure_6_category_roster_resolved: false,
    });
  });

  it.each(Object.entries(PLANS))(
    'has exact candidate/operational and source/projection parity for $1',
    (_key, plan) => {
      for (const accepted of [source(plan), operational(plan)]) {
        const final = projection(accepted, plan);
        const sourceReceipt = receipt(accepted, plan);
        const projectionReceipt = receipt(final, plan);
        expect(sourceReceipt).toMatchObject({
          handled: true,
          ready: true,
          supported: false,
          affected_figures: ['6'],
          proof: {
            fixed_aggregate_units: 6,
            figure_3_4_aggregate_resolved: true,
            figure_6_category_roster_resolved: false,
            core_tree_changed_by_this_receipt: false,
          },
        });
        expect(projectionReceipt).toMatchObject({
          handled: true,
          ready: true,
          supported: false,
          affected_figures: ['6'],
        });
        expect(sourceReceipt.proof.proof_tree_sha256)
          .toBe(projectionReceipt.proof.proof_tree_sha256);

        for (const document of [accepted, final]) {
          const row = auditAssociateDocument(document).active_rules.find((entry) => (
            entry.path === `requirement_groups[${plan.groupIndex}].distinct_areas`
          ));
          expect(row).toMatchObject({
            supported: false,
            paper_impact_proven: true,
            evaluator: 'proveReynoldsCampFixedDistinctAreaAggregate',
            affected_figures: ['6'],
            proof: { fixed_aggregate_units: 6 },
          });
        }
      }
    },
  );

  it.each(Object.entries(PLANS))(
    'rejects crossed candidate/operational bundle-tree tuples for $1',
    (_key, plan) => {
      const candidate = source(plan);
      const protectedDocument = operational(plan);
      candidate.provenance.source_bundle_hash = tuple(plan, 'protected_operational')[0];
      protectedDocument.provenance.source_bundle_hash = tuple(plan, 'checked_in_candidate')[0];
      for (const document of [candidate, protectedDocument]) {
        expect(receipt(document, plan)).toMatchObject({
          handled: true,
          ready: false,
          supported: false,
          affected_figures: ['3', '4', '6'],
        });
      }
    },
  );

  it.each(Object.entries(PLANS))(
    'fails closed on whole-source, moved-carrier, widened-unit, roster, or rule drift for $1',
    (_key, plan) => {
      const mutations = [
        (document) => { document.sources[0].sha256 = '0'.repeat(64); },
        (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
        (document) => {
          const [group] = document.requirement_groups.splice(plan.groupIndex, 1);
          document.requirement_groups.push(group);
        },
        (document) => {
          document.requirement_groups[plan.groupIndex].sections[0].unit_advisement = 7;
        },
        (document) => {
          document.requirement_groups[plan.groupIndex].sections[0].unit_advisement_max = 7;
        },
        (document) => { document.requirement_groups[plan.groupIndex].distinct_areas = 3; },
        (document) => { document.requirement_groups[plan.groupIndex].source_refs.pop(); },
        (document) => {
          document.requirement_groups[plan.groupIndex].sections[0].receivers.push({
            options_conjunction: 'or', options: [],
          });
        },
        (document) => { document.requirement_groups[plan.groupIndex].note = 'broader'; },
        (document) => { document.total_units_max += 1; },
      ];
      for (const base of [source(plan), operational(plan)]) {
        for (const mutate of mutations) {
          const changed = structuredClone(base);
          mutate(changed);
          const result = receipt(changed, plan);
          expect(result).toMatchObject({
            handled: true,
            ready: false,
            supported: false,
            affected_figures: ['3', '4', '6'],
          });
          expect(result.proof.figure_3_4_aggregate_resolved).toBeUndefined();
        }
      }
    },
  );

  it.each(Object.entries(PLANS))(
    'fails a drifted final projection contract closed for $1',
    (_key, plan) => {
      const final = projection(source(plan), plan);
      final.analysis_contract.aggregate_fill = 'guess';
      expect(receipt(final, plan)).toMatchObject({
        ready: false,
        affected_figures: ['3', '4', '6'],
      });
    },
  );
});
