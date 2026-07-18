export const TASK_TYPE_OPTIONS = [
  { value: 'porting', label: 'Porting' },
  { value: 'data_verification', label: 'Data Verification' },
  // Machine-made: audit verdicts feed one standing task (no manual creation).
  { value: 'audit_fix', label: 'Audit Fix' },
]
export const CREATABLE_TASK_TYPES = TASK_TYPE_OPTIONS.filter((option) => option.value !== 'audit_fix')

// Checklist-shaped types: workflow points live on task.checklist_items,
// completable in any order, no peer gate. Mirrors the server's
// CHECKLIST_TASK_TYPES.
export const isChecklistTask = (task) => (
  task?.task_type === 'data_verification' || task?.task_type === 'audit_fix'
)

export const PORTING_STAGES = [
  {
    key: 'understand',
    label: 'Read & understand',
    description: 'Read the source graph and understand its measure, population, encodings, and assumptions.',
    weight: 15,
    notePrompt: 'What did you learn about the graph and its assumptions?',
  },
  {
    key: 'research',
    label: 'Research missing data',
    description: 'Identify and gather missing sources, including coverage gaps and caveats.',
    weight: 20,
    notePrompt: 'What did you find, add, or determine is still missing?',
  },
  {
    key: 'data_access',
    label: 'Data & endpoints',
    description: 'Confirm the existing data access is sufficient or create the endpoint(s) the visual needs.',
    weight: 15,
    notePrompt: 'Which data or endpoints will the visualization use?',
  },
  {
    key: 'visualization',
    label: 'Develop visualization',
    description: 'Implement and validate the visual against the source graph and research question.',
    weight: 25,
    notePrompt: 'What did you build, validate, and decide?',
  },
  {
    key: 'publish',
    label: 'Publish',
    description: 'Publish the finished visual so the team can review it.',
    weight: 10,
    notePrompt: 'Where was the visual published?',
  },
  {
    key: 'self_verify',
    label: 'Self-verify',
    description: 'Re-check the published output and the underlying data yourself before handing it to a teammate.',
    weight: 5,
    notePrompt: 'What did you re-check, and what still worries you?',
    // Part of the verification phase: the board's Verification column picks the
    // task up here, alongside the peer-approval stage.
    verification: true,
  },
  {
    key: 'approval',
    label: 'Team approval',
    description: 'A second teammate reviews the data and approach and approves the result.',
    weight: 10,
    notePrompt: 'What did you review and approve?',
    requiresPeer: true,
  },
]

export const WORKFLOWS = { porting: PORTING_STAGES }

export const stagesForTask = (task) => {
  if (isChecklistTask(task)) {
    const items = Array.isArray(task?.checklist_items) ? task.checklist_items : []
    const weight = items.length ? 100 / items.length : 0
    return items.map((item) => ({
      key: item.key,
      label: item.label,
      description: null,
      weight,
      notePrompt: 'What did you check, and what did you find?',
    }))
  }
  return WORKFLOWS[task?.task_type || 'porting'] || PORTING_STAGES
}

export const isStageComplete = (task, stageKey) => {
  const state = task?.workflow_stages?.[stageKey]
  return Boolean(state?.completed || state?.completed_at)
}

export const derivedProgress = (task) => Math.round(stagesForTask(task).reduce(
  (total, stage) => total + (isStageComplete(task, stage.key) ? stage.weight : 0),
  0
))

export const currentStageIndex = (task) => stagesForTask(task).findIndex(
  (stage) => !isStageComplete(task, stage.key)
)

export const nextStage = (task) => {
  const stages = stagesForTask(task)
  const index = currentStageIndex(task)
  return index === -1 ? null : stages[index]
}

// Derived board membership for the Verification column: an in-progress task
// whose next stage is part of the verification phase — Self-verify or the
// peer-review (requiresPeer) step — i.e. everything through publish is
// complete. The stored status stays 'in_progress'; the board and list surface
// these separately so both self-checks and peer reviews live in one place.
export const isAwaitingVerification = (task) => {
  if (task?.status !== 'in_progress') return false
  const upcoming = nextStage(task)
  return Boolean(upcoming?.requiresPeer || upcoming?.verification)
}

// Board ownership follows active work: pulling a To do card into In progress
// claims it for the person making the move; returning it releases the task.
// Reorders and every other status transition leave the assignee untouched.
export const withBoardAssignment = (task, patch, user, roster = []) => {
  const next = { ...patch }
  if (task?.status === 'todo' && patch?.status === 'in_progress' && user?.uid) {
    const rosterLabel = roster.find((person) => person.uid === user.uid)?.label
    next.assignee_uid = user.uid
    next.assignee_label = rosterLabel || user.displayName || user.email || user.uid
  } else if (task?.status === 'in_progress' && patch?.status === 'todo') {
    next.assignee_uid = null
    next.assignee_label = null
  }
  return next
}

export const taskTypeLabel = (taskType) => (
  TASK_TYPE_OPTIONS.find((option) => option.value === taskType)?.label || taskType || 'Porting'
)

// Type chip tone: porting lavender, verification mint/success, audit fixes danger.
export const taskTypeBadgeVariant = (taskType) => (
  taskType === 'data_verification' ? 'verify'
    : taskType === 'audit_fix' ? 'danger'
      : 'conservative'
)

// Card copy under the dot strip. Checklist items are "verified"/"fixed",
// stages are worked; a finished checklist says so instead of a next step.
export const nextStepLabel = (task) => {
  const upcoming = nextStage(task)
  if (task?.task_type === 'audit_fix') {
    return upcoming ? `Next: fix ${upcoming.label}` : 'Inbox clear — new verdicts reopen it'
  }
  if (isChecklistTask(task)) {
    return upcoming ? `Next: verify ${upcoming.label}` : 'All checkpoints verified'
  }
  return upcoming ? `Next: ${upcoming.label}` : null
}
