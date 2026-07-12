export const TASK_TYPE_OPTIONS = [
  { value: 'porting', label: 'Porting' },
]

export const PORTING_STAGES = [
  {
    key: 'understand',
    label: 'Read & understand',
    description: 'Read the source graph and document its measure, population, encodings, and assumptions.',
    weight: 15,
    notePrompt: 'What did you learn about the graph and its assumptions?',
  },
  {
    key: 'research',
    label: 'Research missing data',
    description: 'Identify and gather missing sources, then record coverage gaps and caveats.',
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
    weight: 30,
    notePrompt: 'What did you build, validate, and decide?',
  },
  {
    key: 'publish',
    label: 'Publish',
    description: 'Publish the finished visual and record where the team can review it.',
    weight: 10,
    notePrompt: 'Where was the visual published?',
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

export const stagesForTask = (task) => WORKFLOWS[task?.task_type || 'porting'] || PORTING_STAGES

export const isStageComplete = (task, stageKey) => {
  const state = task?.workflow_stages?.[stageKey]
  return Boolean(state?.completed || state?.completed_at)
}

export const derivedProgress = (task) => stagesForTask(task).reduce(
  (total, stage) => total + (isStageComplete(task, stage.key) ? stage.weight : 0),
  0
)

export const currentStageIndex = (task) => stagesForTask(task).findIndex(
  (stage) => !isStageComplete(task, stage.key)
)

export const nextStage = (task) => {
  const stages = stagesForTask(task)
  const index = currentStageIndex(task)
  return index === -1 ? null : stages[index]
}

export const taskTypeLabel = (taskType) => (
  TASK_TYPE_OPTIONS.find((option) => option.value === taskType)?.label || taskType || 'Porting'
)
