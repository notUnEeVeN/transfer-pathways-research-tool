import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TasksPage from './TasksPage'

const mocks = vi.hoisted(() => ({
  tasks: [],
  update: vi.fn(),
  updateAsync: vi.fn().mockResolvedValue(undefined),
  createAsync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-me', email: 'me@example.edu' } }),
}))

vi.mock('../shared/query/hooks/useAccess', () => ({
  useAccessMe: () => ({ data: { role: 'admin' } }),
}))

vi.mock('../shared/query/hooks/useData', () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined) })
  return {
    useTasks: () => ({ data: { rows: mocks.tasks }, isLoading: false }),
    useTaskRoster: () => ({ data: { rows: [
      { uid: 'uid-me', label: 'Me' },
      { uid: 'uid-other', label: 'Other' },
    ] } }),
    useCreateTask: () => ({ mutate: vi.fn(), mutateAsync: mocks.createAsync }),
    useUpdateTask: () => ({ mutate: mocks.update, mutateAsync: mocks.updateAsync }),
    useAddTaskStageNote: mutation,
    useCompleteTaskStage: mutation,
    useReopenTaskStage: mutation,
    useDeleteTaskStageNote: mutation,
    useResolveTaskStageNote: mutation,
    useDeleteTask: mutation,
    useSchools: () => ({ data: { uc: [] }, isLoading: false }),
    useColleges: () => ({ data: [], isLoading: false }),
  }
})

const task = (overrides) => ({
  _id: 'task-id',
  title: 'Task',
  description: '',
  task_type: 'general',
  status: 'todo',
  order: 1000,
  progress: 0,
  workflow_stages: {},
  workflow_log: [],
  notes: [],
  archived: false,
  created_by: 'uid-me',
  created_at: '2026-07-20T12:00:00.000Z',
  updated_at: '2026-07-20T12:00:00.000Z',
  ...overrides,
})

beforeEach(() => {
  sessionStorage.clear()
  mocks.update.mockClear()
  mocks.updateAsync.mockClear()
  mocks.createAsync.mockClear()
  mocks.tasks = [
    task({ _id: 'biology', title: 'Gather Biology degree template', assignee_uid: 'uid-me' }),
    task({
      _id: 'figure', title: 'Port district figure', task_type: 'porting', status: 'in_progress',
      order: 2000, assignee_uid: 'uid-other', progress: 15,
      workflow_stages: { understand: { completed: true } },
    }),
  ]
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('TasksPage filters and export', () => {
  it('applies one persisted filter set to the board and stats', () => {
    render(<TasksPage />)

    expect(screen.getByText('Gather Biology degree template')).toBeInTheDocument()
    expect(screen.getByText('Port district figure')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), {
      target: { value: 'biology' },
    })

    expect(screen.getByText('Gather Biology degree template')).toBeInTheDocument()
    expect(screen.queryByText('Port district figure')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('tasks-filters')).toContain('biology')

    const openTile = screen.getByText('Open').parentElement
    const doingTile = screen.getAllByText('In progress')
      .find((element) => element.tagName === 'P').parentElement
    expect(within(openTile).getByText('1')).toBeInTheDocument()
    expect(within(openTile).getByText('of 1')).toBeInTheDocument()
    expect(within(doingTile).getByText('0')).toBeInTheDocument()
    expect(within(doingTile).getByText('of 1')).toBeInTheDocument()
  })

  it('shows an unavailable persisted assignee and does not match legacy tasks retaining that uid', () => {
    mocks.tasks = [
      task({
        _id: 'former-task',
        title: 'Former teammate task',
        assignee_uid: 'uid-deleted',
        assignee_label: 'Former teammate',
      }),
    ]
    sessionStorage.setItem('tasks-filters', JSON.stringify({
      text: '', types: [], assignee: 'uid-deleted', mineOnly: false,
    }))

    render(<TasksPage />)

    expect(screen.getByRole('button', { name: 'Assignee' }))
      .toHaveTextContent('Unavailable assignee (uid-deleted)')
    expect(screen.queryByText('Former teammate task')).not.toBeInTheDocument()
  })

  it('archives only Done tasks in the filtered board column', async () => {
    mocks.tasks = [
      task({ _id: 'biology-done', title: 'Biology template done', status: 'done' }),
      task({ _id: 'figure-done', title: 'District figure done', status: 'done', task_type: 'porting' }),
    ]

    render(<TasksPage />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), {
      target: { value: 'biology' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Archive 1 task in Done' }))

    await waitFor(() => expect(mocks.updateAsync).toHaveBeenCalledTimes(1))
    expect(mocks.updateAsync).toHaveBeenCalledWith({
      id: 'biology-done', patch: { archived: true },
    })
  })

  it('copies both complete-history exports from the Table view', async () => {
    render(<TasksPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }))

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy weekly history (markdown)' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain('# Research task history')
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain('Gather Biology degree template')

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy timesheet briefing' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2))
    expect(navigator.clipboard.writeText.mock.calls[1][0]).toContain('Timesheet reconciliation rules:')
    expect(navigator.clipboard.writeText.mock.calls[1][0]).toContain('# Research task history')
  })

  it('dismisses the Export menu with Escape and when leaving the Table view', () => {
    render(<TasksPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }))

    const exportButton = screen.getByRole('button', { name: 'Export' })
    fireEvent.click(exportButton)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Copy weekly history (markdown)' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(exportButton).toHaveFocus()

    fireEvent.click(exportButton)
    fireEvent.click(screen.getByRole('tab', { name: 'Board' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
