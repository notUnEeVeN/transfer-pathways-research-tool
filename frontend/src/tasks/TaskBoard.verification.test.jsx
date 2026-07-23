import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskBoard from './TaskBoard'
import TaskCard from './TaskCard'
import { PORTING_STAGES } from './taskWorkflow'

// Every stage complete except peer approval — the porter has self-verified and
// the task is waiting for a teammate to review it.
const preApprovalKeys = PORTING_STAGES.slice(0, -1).map((stage) => stage.key)
const complete = (keys) => Object.fromEntries(keys.map((key) => [key, { completed: true }]))

const task = (over) => ({
  _id: 'tk', title: 'A task', task_type: 'porting', status: 'in_progress',
  progress: 0, workflow_stages: {}, workflow_log: [], order: 1000, archived: false, ...over,
})

const awaitingTask = task({
  _id: 'tk-verify', title: 'Awaiting verification', progress: 90,
  workflow_stages: complete(preApprovalKeys),
})
const selfVerifyTask = task({
  _id: 'tk-self', title: 'Awaiting self-verify', progress: 85, order: 1500,
  workflow_stages: complete(['understand', 'research', 'data_access', 'visualization', 'publish']),
})
const midTask = task({
  _id: 'tk-mid', title: 'Mid flow', progress: 35, order: 2000,
  workflow_stages: complete(['understand', 'research']),
})
const todoTask = task({ _id: 'tk-todo', title: 'Todo item', status: 'todo', progress: 0, workflow_stages: {} })

// The collapse toggle carries the column label in its accessible name; climb to
// the column container so we can scope queries to one column.
const column = (label) =>
  screen.getByRole('button', { name: `Collapse ${label}` }).closest('.bg-surface-muted')

const renderBoard = (tasks, extra = {}) => render(
  <TaskBoard tasks={tasks} onOpen={vi.fn()} onMove={vi.fn()} onNewIn={vi.fn()}
    onArchiveDone={vi.fn()} {...extra} />
)

beforeEach(() => { sessionStorage.clear() })

describe('TaskBoard Verification column', () => {
  it('summarizes a self-verified task into Verification, not In progress', () => {
    const onReviewVerification = vi.fn()
    renderBoard([awaitingTask, midTask, todoTask], { onReviewVerification })
    const verification = column('Verification')

    // High-volume verification is a summary tile that hands off to the queue,
    // not a card list — so the task is counted here, and reviewed there.
    const review = within(verification).getByRole('button', { name: /Review/ })
    expect(within(verification).getByText('awaiting')).toBeInTheDocument()
    review.click()
    expect(onReviewVerification).toHaveBeenCalled()
    // Routed out of In progress.
    expect(within(column('In progress')).queryByText('Awaiting verification')).not.toBeInTheDocument()
  })

  it('counts a published task still pending self-verify into Verification too', () => {
    renderBoard([selfVerifyTask, midTask, todoTask])

    expect(within(column('Verification')).getByRole('button', { name: /Review/ })).toBeInTheDocument()
    expect(within(column('In progress')).queryByText('Awaiting self-verify')).not.toBeInTheDocument()
  })

  it('keeps a mid-flow in_progress task in In progress', () => {
    renderBoard([awaitingTask, midTask, todoTask])

    expect(within(column('In progress')).getByText('Mid flow')).toBeInTheDocument()
    expect(within(column('Verification')).queryByText('Mid flow')).not.toBeInTheDocument()
  })

  it('drops the Backlog column in favour of To do, In progress, Verification, Done', () => {
    renderBoard([todoTask])

    expect(screen.getByRole('button', { name: 'Collapse To do' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse Verification' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Backlog/ })).not.toBeInTheDocument()
  })

  it('offers no add button or drop target in the Verification column', () => {
    renderBoard([todoTask]) // Verification is empty here

    const verification = column('Verification')
    expect(within(verification).queryByRole('button', { name: /New task/i })).not.toBeInTheDocument()
    expect(within(verification).queryByText('Drop a task here')).not.toBeInTheDocument()

    // The affordance the derived column omits is present on a real drop column.
    expect(within(column('To do')).getByRole('button', { name: 'New task in To do' })).toBeInTheDocument()
  })
})

describe('TaskBoard drag surface', () => {
  it('uses the same rounded silhouette on the motion wrapper and card', () => {
    renderBoard([todoTask])

    const wrapper = document.querySelector('[data-task-id="tk-todo"]')
    const surface = wrapper.querySelector('[data-task-drag-surface]')
    expect(wrapper.className).toContain('rounded-xl')
    expect(wrapper.className).toContain('isolate')
    expect(surface.className).toContain('overflow-hidden')
  })

  it('puts the drag shadow on the rounded card instead of its wrapper', () => {
    render(<TaskCard task={todoTask} dragging onOpen={vi.fn()} />)

    const surface = document.querySelector('[data-task-drag-surface]')
    expect(surface.dataset.dragging).toBe('true')
    expect(surface.style.boxShadow).toBe('var(--shadow-lg)')
    expect(surface.className).toContain('cursor-grabbing')
  })
})
