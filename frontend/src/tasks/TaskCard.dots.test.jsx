import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TaskCard from './TaskCard'
import { PORTING_STAGES } from './taskWorkflow'

// Two porting stages complete ('understand', 'research') — matches the
// PORTING_STAGES key shape in taskWorkflow.js: { [stageKey]: { completed: true } }.
// The dot strip is derived from PORTING_STAGES, so counts follow its length.
const inProgressTask = {
  _id: 'tc-test0001',
  title: 'Recreate MA Fig 3 — transfer credit rate',
  task_type: 'porting',
  status: 'in_progress',
  progress: 35,
  workflow_stages: {
    understand: { completed: true },
    research: { completed: true },
  },
  workflow_log: [],
}

const doneTask = {
  ...inProgressTask,
  _id: 'tc-test0002',
  status: 'done',
  progress: 100,
  workflow_stages: Object.fromEntries(PORTING_STAGES.map((stage) => [stage.key, { completed: true }])),
}

describe('TaskCard stage-dot strip', () => {
  it('renders one titled dot per stage and the doneN-of-total count, with no leftover percent text', () => {
    const { container } = render(<TaskCard task={inProgressTask} onOpen={() => {}} />)

    const dots = container.querySelectorAll('[title]')
    expect(dots).toHaveLength(PORTING_STAGES.length)
    expect(Array.from(dots).map((el) => el.getAttribute('title'))).toEqual(
      PORTING_STAGES.map((stage) => stage.label)
    )

    expect(screen.getByText(`2 of ${PORTING_STAGES.length}`)).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('shows the full count for a done task with every stage complete', () => {
    const { container } = render(<TaskCard task={doneTask} onOpen={() => {}} />)

    const dots = container.querySelectorAll('[title]')
    expect(dots).toHaveLength(PORTING_STAGES.length)

    expect(screen.getByText(`${PORTING_STAGES.length} of ${PORTING_STAGES.length}`)).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('omits the progress strip for a bare general task', () => {
    const task = {
      _id: 'tc-general1',
      title: 'Write results section',
      task_type: 'general',
      status: 'todo',
      progress: 0,
      workflow_stages: {},
      workflow_log: [],
    }
    const { container } = render(<TaskCard task={task} onOpen={() => {}} />)

    expect(screen.getByText('General')).toBeInTheDocument()
    expect(container.querySelectorAll('[title]')).toHaveLength(0)
    expect(screen.queryByText('0 of 0')).not.toBeInTheDocument()
  })
})
