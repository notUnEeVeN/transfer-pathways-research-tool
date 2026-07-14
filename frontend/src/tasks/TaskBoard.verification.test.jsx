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
const midTask = task({
  _id: 'tk-mid', title: 'Mid flow', progress: 35, order: 2000,
  workflow_stages: complete(['understand', 'research']),
})
const todoTask = task({ _id: 'tk-todo', title: 'Todo item', status: 'todo', progress: 0, workflow_stages: {} })

// The collapse toggle carries the column label in its accessible name; climb to
// the column container so we can scope queries to one column.
const column = (label) =>
  screen.getByRole('button', { name: `Collapse ${label}` }).closest('.bg-surface-muted')

const renderBoard = (tasks) => render(
  <TaskBoard tasks={tasks} onOpen={vi.fn()} onMove={vi.fn()} onNewIn={vi.fn()} onArchiveDone={vi.fn()} />
)

beforeEach(() => { sessionStorage.clear() })

describe('TaskBoard Verification column', () => {
  it('routes a self-verified task into Verification, not In progress', () => {
    renderBoard([awaitingTask, midTask, todoTask])

    expect(within(column('Verification')).getByText('Awaiting verification')).toBeInTheDocument()
    expect(within(column('In progress')).queryByText('Awaiting verification')).not.toBeInTheDocument()
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
