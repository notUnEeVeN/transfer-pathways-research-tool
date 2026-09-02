/**
 * Source-bound proofs that a small set of bachelor grade/GPA policies have
 * zero impact on the paper's curriculum-level Figures 3/4.
 *
 * Figures 3/4 optimize authored course identities and credits for a
 * hypothetical successful pathway.  They do not accept a transcript or
 * predict whether a student earns a particular grade.  A grade rule can
 * therefore be scoped away from those figures only when the retained source
 * tree proves that it is a separate, zero-credit student-performance gate:
 * it must add no course, credit, alternative, transfer-timing condition, or
 * discretionary credit-application decision.
 *
 * This is deliberately not a kind-wide exemption.  Virginia State's two
 * curriculum-grade thresholds are included only at their exact source-bound
 * carriers; its separate discretionary transfer-credit application policy is
 * not resolved here.  Randolph-Macon's transfer/application-review rule and
 * VCU's mixed postmatriculation and residency rules remain outside this
 * allowlist.  Any source, projection, path, attachment, or carrier drift
 * fails closed.
 */

const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const { exactLongwoodTree } = require('./longwoodConstraintProofs');
const { exactVcuTree } = require('./vcuConstraintProofs');
const { exactVirginiaTechTree } = require('./virginiaTechConstraintProofs');
const { exactVirginiaStateTree } = require('./virginiaStateConstraintProofs');

const PAPER_FIGURES = Object.freeze(['3', '4']);

const POLICY_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'longwood_major_course_grade',
    slug: 'longwood-university',
    school: 'Longwood University',
    school_id: 9214,
    kind: 'minimum_course_grade',
    path: 'requirement_groups[17]',
    layer: 'major',
    source_refs: Object.freeze(['major', 'policy']),
    section_count: 1,
    exactTree: exactLongwoodTree,
    reason: 'the exact Longwood carrier is a zero-credit graduation-performance gate; Figures 3/4 condition on a successfully completed course and use no transcript-grade input',
  }),
  Object.freeze({
    id: 'vcu_major_course_grade',
    slug: 'virginia-commonwealth-university',
    school: 'Virginia Commonwealth University',
    school_id: 9229,
    kind: 'minimum_course_grade',
    path: 'requirement_groups[10]',
    layer: 'major',
    source_refs: Object.freeze(['major', 'graduation']),
    section_count: 1,
    exactTree: exactVcuTree,
    reason: 'the exact VCU carrier is a zero-credit graduation-performance gate; it changes neither the selected CS courses nor their applied credits in Figures 3/4',
  }),
  Object.freeze({
    id: 'virginia_tech_program_grades_and_gpas',
    slug: 'virginia-polytechnic-institute-and-state-university',
    school: 'Virginia Polytechnic Institute and State University',
    school_id: 9230,
    kind: 'minimum_course_grades_and_gpas',
    path: 'requirement_groups[19]',
    layer: 'university_graduation',
    source_refs: Object.freeze(['major', 'graduation']),
    section_count: 4,
    exactTree: exactVirginiaTechTree,
    reason: 'the exact Virginia Tech carrier contains only zero-credit grade/GPA outcomes for already-authored degree courses; Figures 3/4 condition on successful completion and use no transcript or GPA input',
  }),
  Object.freeze({
    id: 'virginia_state_english_composition_grade',
    slug: 'virginia-state-university',
    school: 'Virginia State University',
    school_id: 9231,
    kind: 'minimum_course_grade',
    path: 'requirement_groups[0]',
    layer: 'general_education',
    tier: 'breadth',
    course_level: 'lower_division',
    cc_articulable: true,
    source_refs: Object.freeze(['major', 'general_education']),
    section_count: 2,
    carrier: 'attached_fixed_course_selection',
    exactTree: exactVirginiaStateTree,
    reason: 'the exact Virginia State English-composition declaration is a grade threshold attached to an already-authored two-course, six-credit selection; Figures 3/4 condition on a grade-eligible successful pathway and the threshold adds no course, credit, transfer timing, or application decision',
  }),
  Object.freeze({
    id: 'virginia_state_major_subject_grade',
    slug: 'virginia-state-university',
    school: 'Virginia State University',
    school_id: 9231,
    kind: 'minimum_course_grade_by_subject',
    path: 'requirement_groups[14]',
    layer: 'major',
    tier: 'nontransferable',
    course_level: 'nonunit_policy',
    cc_articulable: false,
    source_refs: Object.freeze(['major', 'college']),
    section_count: 1,
    carrier: 'zero_unit_policy',
    exactTree: exactVirginiaStateTree,
    reason: 'the exact Virginia State CSCI/MATH/STAT declaration is a zero-credit student-performance gate over already-authored program courses; Figures 3/4 condition on a grade-eligible successful pathway and use no transcript-grade input',
  }),
]);

const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const number = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;

function receiverBody(receiver) {
  return receiver?.receiving && typeof receiver.receiving === 'object'
    ? receiver.receiving : receiver || {};
}

function receiverCode(receiver) {
  const body = receiverBody(receiver);
  return text(receiver?.code_seen ?? body?.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function sourceId(receipt) {
  return `va:degree:${receipt.slug}:cs`;
}

function claimsReceipt(document, receipt) {
  const values = [
    document?.slug,
    document?._id,
    document?.va_requirement_id,
    document?.institution_id,
    document?.school_id,
    document?.school,
    document?.provenance?.composition_artifact,
  ].map(text).filter(Boolean);
  return values.some((value) => [
    receipt.slug,
    sourceId(receipt),
    `degree:${receipt.school_id}:va-cs`,
    `va:uni:${receipt.slug}`,
    `va:uni:${receipt.school_id}`,
    String(receipt.school_id),
    receipt.school,
    `server/.va-catalogs/composed/${receipt.slug}.json`,
  ].includes(value));
}

function finalProjection(document, receipt) {
  return document?._id === `degree:${receipt.school_id}:va-cs`
    || document?.va_requirement_id === sourceId(receipt)
      && Number(document?.school_id) === receipt.school_id;
}

function exactAttachment(receipt, value, { container, document, path } = {}) {
  if (path !== receipt.path) {
    return `the ${receipt.id} declaration moved from ${receipt.path}`;
  }
  const index = Number(/^requirement_groups\[(\d+)\]$/.exec(receipt.path)?.[1]);
  const group = document?.requirement_groups?.[index];
  if (!Number.isInteger(index) || group !== container) {
    return `the ${receipt.id} proof did not receive its exact source container`;
  }
  const declarations = array(group?.analysis_constraints)
    .filter((constraint) => text(constraint?.kind) === receipt.kind);
  if (declarations.length !== 1 || declarations[0] !== value) {
    return `the ${receipt.id} declaration is absent, duplicated, or detached`;
  }
  if (text(value?.status).toLowerCase() !== 'evaluator_not_implemented') {
    return `the ${receipt.id} source status changed`;
  }
  return null;
}

function zeroUnitPerformanceCarrier(receipt, group) {
  if (text(group?.requirement_layer) !== receipt.layer
      || text(group?.tier) !== (receipt.tier || 'nontransferable')
      || text(group?.course_level) !== (receipt.course_level || 'nonunit_policy')
      || group?.cc_articulable !== (receipt.cc_articulable ?? false)
      || JSON.stringify(array(group?.source_refs)) !== JSON.stringify(receipt.source_refs)) {
    return { ready: false, reason: `the ${receipt.id} authority or nontransferable policy role changed` };
  }
  const sections = array(group?.sections);
  if (sections.length !== receipt.section_count) {
    return { ready: false, reason: `the ${receipt.id} zero-unit section count changed` };
  }
  if (receipt.carrier === 'attached_fixed_course_selection') {
    if (sections.length !== 2) {
      return { ready: false, reason: `the ${receipt.id} fixed host section count changed` };
    }
    const identities = [];
    for (const section of sections) {
      const receivers = array(section?.receivers);
      if (number(section?.section_advisement ?? section?.select) !== 1
          || number(section?.unit_advisement ?? section?.units) !== 3
          || receivers.length !== 2
          || receivers.some((receiver) => {
            const body = receiverBody(receiver);
            return text(body?.kind).toLowerCase() !== 'course'
              || number(body?.units) !== 3
              || !receiverCode(receiver)
              || array(body?.parent_ids).length;
          })) {
        return { ready: false, reason: `the ${receipt.id} fixed course host gained an open identity, alternative shape, or credit change` };
      }
      identities.push(...receivers.map(receiverCode));
    }
    if (new Set(identities).size !== 4) {
      return { ready: false, reason: `the ${receipt.id} fixed course host lost distinct identities` };
    }
    return {
      ready: true,
      policy_capacity_units: 0,
      policy_course_receiver_count: 0,
      policy_requirement_receiver_count: 0,
      host_course_capacity_units: 6,
      host_course_receiver_count: 4,
    };
  }
  let receiverCount = 0;
  for (const section of sections) {
    const receivers = array(section?.receivers);
    if (number(section?.section_advisement ?? section?.select) !== 1
        || number(section?.unit_advisement ?? section?.units) !== 0
        || receivers.length !== 1) {
      return { ready: false, reason: `the ${receipt.id} zero-unit section shape changed` };
    }
    const body = receiverBody(receivers[0]);
    if (text(body?.kind).toLowerCase() !== 'requirement'
        || number(body?.units) !== 0
        || body?.parent_id != null
        || array(body?.parent_ids).length
        || text(body?.code)
        || array(body?.codes).length) {
      return { ready: false, reason: `the ${receipt.id} carrier gained a course identity, credit, or alternative` };
    }
    receiverCount += 1;
  }
  return {
    ready: true,
    policy_capacity_units: 0,
    policy_course_receiver_count: 0,
      policy_requirement_receiver_count: receiverCount,
      host_course_capacity_units: 0,
      host_course_receiver_count: 0,
  };
}

/**
 * Return null for a rule outside the reviewed receipts, a failed proof for a
 * claimed-but-drifted receipt, or an exact zero-paper-impact receipt.
 */
function proveVirginiaBachelorPerformancePolicy(value, context = {}) {
  const kind = text(value?.kind);
  const candidates = POLICY_RECEIPTS.filter((receipt) => receipt.kind === kind);
  if (!candidates.length) return null;

  const exactMatches = candidates.map((receipt) => ({
    receipt,
    exact: receipt.exactTree(context.document),
  })).filter((entry) => entry.exact?.supported === true);
  const claimed = candidates.filter((receipt) => claimsReceipt(context.document, receipt));
  if (exactMatches.length !== 1) {
    if (!claimed.length) return null;
    const reason = exactMatches.length > 1
      ? 'the grade/GPA policy matched more than one institution proof'
      : claimed[0].exactTree(context.document)?.reason
        || 'the claimed grade/GPA source tree did not match its retained proof';
    return { proven: false, reason, affected_figures: [...PAPER_FIGURES] };
  }

  const { receipt, exact } = exactMatches[0];
  if (finalProjection(context.document, receipt)
      && !usesCanonicalSourceContract(context.document)) {
    return {
      proven: false,
      reason: `the ${receipt.id} projection lacks the canonical source contract`,
      affected_figures: [...PAPER_FIGURES],
    };
  }
  const attachmentIssue = exactAttachment(receipt, value, context);
  if (attachmentIssue) {
    return { proven: false, reason: attachmentIssue, affected_figures: [...PAPER_FIGURES] };
  }
  const carrier = zeroUnitPerformanceCarrier(receipt, context.container);
  if (!carrier.ready) {
    return { proven: false, reason: carrier.reason, affected_figures: [...PAPER_FIGURES] };
  }
  return {
    proven: true,
    paper_impact_proven: true,
    affected_figures: [],
    reason: receipt.reason,
    proof: {
      policy_receipt_id: receipt.id,
      rule_path: receipt.path,
      source_id: sourceId(receipt),
      proof_tree_sha256: exact.proof?.proof_tree_sha256 || null,
      source_bundle_sha256: exact.proof?.source_bundle_sha256 || null,
      official_source_sha256: exact.proof?.official_source_sha256 || null,
      policy_capacity_units: carrier.policy_capacity_units,
      policy_course_receiver_count: carrier.policy_course_receiver_count,
      policy_requirement_receiver_count: carrier.policy_requirement_receiver_count,
      host_course_capacity_units: carrier.host_course_capacity_units,
      host_course_receiver_count: carrier.host_course_receiver_count,
      paper_inputs: Object.freeze(['authored_course_identity', 'authored_credit_capacity']),
      excluded_student_inputs: Object.freeze(['transcript_grade', 'cumulative_gpa', 'major_gpa']),
      conditioned_pathway_model: 'hypothetical_grade_eligible_successful_pathway',
      discretionary_transfer_credit_application_resolved: false,
      complete_degree_policy_preserved: true,
    },
  };
}

function virginiaBachelorPerformanceAffectedFigures(value, context = {}) {
  const proof = proveVirginiaBachelorPerformancePolicy(value, context);
  return proof?.proven === true ? [] : null;
}

module.exports = {
  PAPER_FIGURES,
  POLICY_RECEIPTS,
  proveVirginiaBachelorPerformancePolicy,
  virginiaBachelorPerformanceAffectedFigures,
};
