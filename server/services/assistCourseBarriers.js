/**
 * Category-level ASSIST requirement verdicts for California Figure 5.
 *
 * The figure asks whether a district can satisfy each course category that is
 * structurally required by the receiving program's ASSIST agreement. Other
 * categories are held satisfied while one category is tested, so a missing
 * chemistry articulation cannot make the calculus bar fail.
 *
 * This also gives cross-discipline alternatives their correct meaning. If a
 * requirement says "statistics OR biology", neither category is independently
 * required. If both accepted calculus pathways contain calculus, calculus is
 * required and either complete pathway can satisfy it.
 */
const { isMajorArticulable } = require('./analysis/eligibility');

const receiverHashKey = (receiver) => String(
  receiver?.hash_id
    ?? `${receiver?.receiving?.kind || 'receiver'}:${receiver?.receiving?.parent_id || ''}`
);

function categoriesFor(categoryOf, receiver, section, group) {
  const result = categoryOf?.({ receiver, section, group });
  return new Set((Array.isArray(result) ? result : [result]).filter(Boolean));
}

/** Keep the exact groups PMT considers required; do not reinterpret receivers. */
function requiredAssistRequirementGroups(requirementGroups = []) {
  return (requirementGroups || [])
    .filter((group) => group?.is_required)
    .map((group) => ({
      ...group,
      sections: (group.sections || []).map((section) => ({
        ...section,
        receivers: section.receivers || [],
      })),
    }));
}

/** Build synthetic groups whose available receivers have unique evidence. */
function groupsWithAvailability(groups, isAvailable) {
  let evidenceId = 0;
  return (groups || []).map((group) => ({
    ...group,
    is_required: true,
    sections: (group.sections || []).map((section) => ({
      ...section,
      receivers: (section.receivers || []).map((receiver) => {
        const available = isAvailable(receiver, section, group);
        evidenceId += 1;
        return {
          receiving: receiver.receiving,
          hash_id: receiver.hash_id,
          articulation_status: available ? 'articulated' : 'not_articulated',
          options: available
            ? [{ course_ids: [`assist-evidence-${evidenceId}`], course_conjunction: 'and' }]
            : [],
          options_conjunction: 'and',
        };
      }),
    })),
  }));
}

function groupIsArticulable(group, isAvailable) {
  return isMajorArticulable({
    requirement_groups: groupsWithAvailability([group], isAvailable),
  }, true);
}

/**
 * Return an explicit verdict for every declared category.
 *
 * `articulatedByHash` is already pooled at the requested row grain (a college,
 * district, or county). Callers may supply the same receiver-level completion
 * predicate used for whole-program eligibility. Non-category receivers are
 * made available on purpose: each panel isolates one course category instead
 * of repeating whole-program completion under six labels.
 */
function assistCourseCategoryCoverage(
  requirementGroups = [], categoryKeys = [], categoryOf = null,
  articulatedByHash = new Map(), receiverIsArticulated = null
) {
  const groups = requiredAssistRequirementGroups(requirementGroups);

  return Object.fromEntries((categoryKeys || []).map((categoryKey) => {
    let requiredGroups = 0;
    let satisfiedGroups = 0;

    for (const group of groups) {
      const membership = new Map();
      let appears = false;
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          const belongs = categoriesFor(categoryOf, receiver, section, group).has(categoryKey);
          membership.set(receiver, belongs);
          if (belongs) appears = true;
        }
      }
      if (!appears) continue;

      // If every receiver outside this category is available and the group can
      // still be completed, this category is only an optional alternative.
      const structurallyRequired = !groupIsArticulable(
        group, (receiver) => !membership.get(receiver)
      );
      if (!structurallyRequired) continue;

      requiredGroups += 1;
      const satisfied = groupIsArticulable(group, (receiver) => (
        !membership.get(receiver)
          || (receiverIsArticulated
            ? receiverIsArticulated(receiver)
            : articulatedByHash.get(receiverHashKey(receiver)) === true)
      ));
      if (satisfied) satisfiedGroups += 1;
    }

    return [categoryKey, {
      required: requiredGroups > 0,
      satisfied: requiredGroups > 0 ? satisfiedGroups === requiredGroups : null,
      required_groups: requiredGroups,
      satisfied_groups: satisfiedGroups,
      missing_groups: requiredGroups - satisfiedGroups,
    }];
  }));
}

module.exports = {
  assistCourseCategoryCoverage,
};
