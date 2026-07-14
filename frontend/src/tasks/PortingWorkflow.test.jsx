import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PortingWorkflow from './PortingWorkflow'
import { PORTING_STAGES } from './taskWorkflow'

const baseTask = {
  _id: 'tp-test0001',
  title: 'Port the graph',
  task_type: 'porting',
  status: 'todo',
  progress: 0,
  created_by: 'author',
  created_by_label: 'Ari',
  workflow_stages: {},
  workflow_log: [],
}

describe('PortingWorkflow', () => {
  it('saves iterative notes without completing the stage', async () => {
    const onAddStageNote = vi.fn().mockResolvedValue({})
    const onCompleteStage = vi.fn()
    render(
      <PortingWorkflow task={baseTask} me={{ uid: 'author' }}
        onAddStageNote={onAddStageNote} onCompleteStage={onCompleteStage} onReopenStage={vi.fn()} />
    )

    fireEvent.change(screen.getByPlaceholderText('What did you learn about the graph and its assumptions?'), {
      target: { value: 'Confirmed the denominator.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))

    await waitFor(() => expect(onAddStageNote).toHaveBeenCalledWith(
      'tp-test0001', 'understand', 'Confirmed the denominator.'
    ))
    expect(onCompleteStage).not.toHaveBeenCalled()
    expect(screen.queryByText('+15%')).not.toBeInTheDocument()
  })

  it('allows notes on a later stage before it unlocks', async () => {
    const onAddStageNote = vi.fn().mockResolvedValue({})
    render(
      <PortingWorkflow task={baseTask} me={{ uid: 'author' }}
        onAddStageNote={onAddStageNote} onCompleteStage={vi.fn()} onReopenStage={vi.fn()} />
    )

    const researchStage = screen.getByRole('heading', { name: 'Research missing data' }).closest('li')
    fireEvent.click(within(researchStage).getByRole('button', { name: 'Add note' }))
    fireEvent.change(screen.getByPlaceholderText('What did you find, add, or determine is still missing?'), {
      target: { value: 'Located a missing district-boundary source.' },
    })
    fireEvent.click(within(researchStage).getByRole('button', { name: 'Save note' }))

    await waitFor(() => expect(onAddStageNote).toHaveBeenCalledWith(
      'tp-test0001', 'research', 'Located a missing district-boundary source.'
    ))
  })

  it('saves an unsaved draft before completing the stage', async () => {
    const onAddStageNote = vi.fn().mockResolvedValue({})
    const onCompleteStage = vi.fn().mockResolvedValue({})
    render(
      <PortingWorkflow task={baseTask} me={{ uid: 'author' }}
        onAddStageNote={onAddStageNote} onCompleteStage={onCompleteStage} onReopenStage={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Complete stage' }))
    expect(screen.getByText('Add at least one note before completing this stage.')).toBeInTheDocument()
    expect(onCompleteStage).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('What did you learn about the graph and its assumptions?'), {
      target: { value: 'Documented the denominator and source assumptions.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Complete stage' }))
    await waitFor(() => expect(onAddStageNote).toHaveBeenCalledWith(
      'tp-test0001', 'understand', 'Documented the denominator and source assumptions.'
    ))
    await waitFor(() => expect(onCompleteStage).toHaveBeenCalledWith('tp-test0001', 'understand'))
    expect(onAddStageNote.mock.invocationCallOrder[0]).toBeLessThan(onCompleteStage.mock.invocationCallOrder[0])
  })

  it('reserves final approval for someone other than the creator', () => {
    const workflowStages = Object.fromEntries(PORTING_STAGES.slice(0, -1).map((stage) => [
      stage.key,
      {
        completed: true,
        completed_at: '2026-07-11T10:00:00Z',
        completed_by: 'author',
        completed_by_label: 'Ari',
        note: `Finished ${stage.label}`,
      },
    ]))
    render(
      <PortingWorkflow task={{ ...baseTask, status: 'in_progress', progress: 90, workflow_stages: workflowStages }}
        me={{ uid: 'author' }} onAddStageNote={vi.fn()} onCompleteStage={vi.fn()} onReopenStage={vi.fn()} />
    )

    expect(screen.getByText(/Waiting for another teammate/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve task' })).not.toBeInTheDocument()
  })

  it('groups the workflow log into elapsed weeks', () => {
    render(
      <PortingWorkflow
        task={{
          ...baseTask,
          created_at: '2026-07-01T16:00:00.000Z',
          workflow_log: [
            {
              _id: 'week-1', stage: 'understand', action: 'noted', note: 'First week note',
              by: 'author', by_label: 'Ari', at: '2026-07-02T16:00:00.000Z',
            },
            {
              _id: 'week-2', stage: 'research', action: 'noted', note: 'Second week note',
              by: 'author', by_label: 'Ari', at: '2026-07-09T16:00:00.000Z',
            },
          ],
        }}
        me={{ uid: 'author' }} onAddStageNote={vi.fn()}
        onCompleteStage={vi.fn()} onReopenStage={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Week 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Week 2' })).toBeInTheDocument()
    expect(screen.getAllByText('Second week note')).toHaveLength(2)
  })
})

describe('PortingWorkflow assignee-gated completion (T22)', () => {
  const assignedTask = {
    ...baseTask, assignee_uid: 'assignee', assignee_label: 'Cy',
  }

  it('hides Complete stage and shows a caption for a non-assignee viewer', () => {
    render(
      <PortingWorkflow task={assignedTask} me={{ uid: 'someone-else' }}
        onAddStageNote={vi.fn()} onCompleteStage={vi.fn()} onReopenStage={vi.fn()} />
    )

    expect(screen.queryByRole('button', { name: 'Complete stage' })).not.toBeInTheDocument()
    expect(screen.getByText('Only Cy can complete this stage.')).toBeInTheDocument()
    // The note composer stays available to everyone — notes are collaborative.
    expect(screen.getByRole('button', { name: 'Save note' })).toBeInTheDocument()
  })

  it('shows Complete stage for the assignee and no caption', () => {
    render(
      <PortingWorkflow task={assignedTask} me={{ uid: 'assignee' }}
        onAddStageNote={vi.fn()} onCompleteStage={vi.fn()} onReopenStage={vi.fn()} />
    )

    expect(screen.getByRole('button', { name: 'Complete stage' })).toBeInTheDocument()
    expect(screen.queryByText(/can complete this stage/)).not.toBeInTheDocument()
  })

  it('blocks the assignee from approving their own work, with an updated peer-approval notice', () => {
    const workflowStages = Object.fromEntries(PORTING_STAGES.slice(0, -1).map((stage) => [
      stage.key,
      {
        completed: true,
        completed_at: '2026-07-11T10:00:00Z',
        completed_by: 'assignee',
        completed_by_label: 'Cy',
        note: `Finished ${stage.label}`,
      },
    ]))
    render(
      <PortingWorkflow
        task={{ ...assignedTask, status: 'in_progress', progress: 90, workflow_stages: workflowStages }}
        me={{ uid: 'assignee' }} onAddStageNote={vi.fn()} onCompleteStage={vi.fn()} onReopenStage={vi.fn()}
      />
    )

    expect(screen.getByText(/Waiting for another teammate/)).toBeInTheDocument()
    expect(screen.getByText(/didn't do the work/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve task' })).not.toBeInTheDocument()
  })

  it('renders approve button for third-party reviewer at active approval stage on assigned task', () => {
    const workflowStages = Object.fromEntries(PORTING_STAGES.slice(0, -1).map((stage) => [
      stage.key,
      {
        completed: true,
        completed_at: '2026-07-11T10:00:00Z',
        completed_by: 'assignee',
        completed_by_label: 'Cy',
        note: `Finished ${stage.label}`,
      },
    ]))
    render(
      <PortingWorkflow
        task={{ ...assignedTask, status: 'in_progress', progress: 90, workflow_stages: workflowStages }}
        me={{ uid: 'reviewer' }} onAddStageNote={vi.fn()} onCompleteStage={vi.fn()} onReopenStage={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /approve task/i })).toBeInTheDocument()
  })
})

describe('PortingWorkflow stage-note delete & resolve', () => {
  const notedEntry = (over = {}) => ({
    _id: 'tl-note1', stage: 'understand', action: 'noted', note: 'Spotted a mismatch in the totals.',
    by: 'author', by_label: 'Ari', at: '2026-07-11T10:00:00Z', ...over,
  })
  const notedTask = (entry) => ({
    ...baseTask, status: 'in_progress', workflow_log: [entry],
  })
  const wiring = (over) => ({
    onAddStageNote: vi.fn(), onCompleteStage: vi.fn(), onReopenStage: vi.fn(),
    onDeleteStageNote: vi.fn().mockResolvedValue({}), onResolveStageNote: vi.fn().mockResolvedValue({}), ...over,
  })

  it('lets the author delete their own note', async () => {
    const props = wiring()
    render(<PortingWorkflow task={notedTask(notedEntry())} me={{ uid: 'author' }} {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }))
    await waitFor(() => expect(props.onDeleteStageNote).toHaveBeenCalledWith('tp-test0001', 'tl-note1'))
  })

  it('hides the delete control from someone who is not the note author', () => {
    render(<PortingWorkflow task={notedTask(notedEntry())} me={{ uid: 'stranger' }} {...wiring()} />)
    expect(screen.queryByRole('button', { name: 'Delete note' })).not.toBeInTheDocument()
  })

  it('lets the task owner resolve an open note', async () => {
    const props = wiring()
    render(<PortingWorkflow task={notedTask(notedEntry())} me={{ uid: 'author' }} {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await waitFor(() => expect(props.onResolveStageNote).toHaveBeenCalledWith('tp-test0001', 'tl-note1', true))
  })

  it('marks a resolved note and toggles it back open', async () => {
    const props = wiring()
    const resolved = notedEntry({ resolved: true, resolved_by: 'author', resolved_by_label: 'Ari', resolved_at: '2026-07-12T10:00:00Z' })
    render(<PortingWorkflow task={notedTask(resolved)} me={{ uid: 'author' }} {...props} />)

    expect(screen.getByText('Resolved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Resolved/ }))
    await waitFor(() => expect(props.onResolveStageNote).toHaveBeenCalledWith('tp-test0001', 'tl-note1', false))
  })
})
