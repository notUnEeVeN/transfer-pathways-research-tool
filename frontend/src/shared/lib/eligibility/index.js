// Receiver-centric eligibility evaluation, split across:
//   predicates.js   — course/option/receiver/section/group/major completion
//                     + computeCrossCcEquivalents (the cross-CC record set)
//   displayStats.js — getGroupDisplayStat (the per-group progress chip)
//   rollups.js      — calculateMajorCompletionPercentage
// Cross-CC equivalency flows explicitly: compute the record set once with
// computeCrossCcEquivalents and thread it into the predicates as `crossCc`.
// This barrel re-exports the public surface so `import { … } from 'lib/eligibility'`
// keeps working unchanged.

export {
  isCourseCompleted,
  isReceiverCompleted,
  isReceiverAvailable,
  calculateUnitsFromCompletedReceivers,
  sectionMaxContribution,
  sectionContribution,
  interSectionConjOf,
  getEffectiveGroupAsk,
  dBucketQualifyingCount,
  isSectionCompleted,
  isGroupCompleted,
  isMajorCompleted,
  computeCrossCcEquivalents
} from './predicates'

export { getGroupDisplayStat } from './displayStats'

export { calculateMajorCompletionPercentage } from './rollups'

// The shared "which courses count" selector behind the page's include-planned
// toggle. Lives in courseModel (it's a course-shape concern); re-exported here so
// eligibility consumers can import it alongside the evaluators.
export { selectEligibilityCourses } from '../courseModel'
