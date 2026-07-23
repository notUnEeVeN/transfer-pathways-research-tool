import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskBoard from './TaskBoard'

// Framer Motion owns pointer gestures in production. The test double keeps its
// DOM contract while translating a native dragend into Motion's { point } info.
vi.mock('framer-motion', async () => {
  const { createElement } = await vi.importActual('react')
  const MotionDiv = ({
    children, layout, drag, dragSnapToOrigin, dragElastic, whileDrag,
    onDragStart, onDrag, onDragEnd, ...props
  }) => {
    const info = (event) => ({ point: { x: event.clientX, y: event.clientY } })
    return createElement('div', {
      ...props,
      draggable: Boolean(drag),
      onDragStart: (event) => onDragStart?.(event, info(event)),
      onDrag: (event) => onDrag?.(event, info(event)),
      onDragEnd: (event) => onDragEnd?.(event, info(event)),
    }, children)
  }
  return { motion: { div: MotionDiv } }
})

const task = (id, overrides = {}) => ({
  _id: id,
  title: `Task ${id}`,
  description: '',
  task_type: 'general',
  checklist_items: [],
  status: 'todo',
  progress: 0,
  workflow_stages: {},
  workflow_log: [],
  order: Number(String(id).replace(/\D/g, '')) * 1000 || 1000,
  archived: false,
  updated_at: '2026-07-01T12:00:00Z',
  ...overrides,
})

const renderBoard = (tasks, props = {}) => render(
  <TaskBoard
    tasks={tasks}
    onOpen={vi.fn()}
    onMove={vi.fn()}
    onNewIn={vi.fn()}
    onArchiveDone={vi.fn()}
    {...props}
  />
)

const column = (label) => (
  screen.getByRole('button', { name: `Collapse ${label}` }).closest('.bg-surface-muted')
)

const rect = ({ left = 0, top = 0, width = 100, height = 100 } = {}) => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON: () => {},
})

const dragEndAt = (element, point) => fireEvent(
  element,
  new MouseEvent('dragend', { bubbles: true, clientX: point.x, clientY: point.y })
)

beforeEach(() => {
  sessionStorage.clear()
})

describe('TaskBoard type sections', () => {
  it('keeps six mixed-type cards flat', () => {
    const tasks = Array.from({ length: 6 }, (_, index) => task(String(index + 1), {
      task_type: index < 3 ? 'general' : 'porting',
    }))

    renderBoard(tasks)

    expect(screen.queryByRole('button', { name: 'Collapse General in To do' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Collapse Porting in To do' })).not.toBeInTheDocument()
  })

  it('groups more than six visible cards by type and shows section counts', () => {
    const tasks = Array.from({ length: 7 }, (_, index) => task(String(index + 1), {
      task_type: index < 4 ? 'general' : 'porting',
    }))

    renderBoard(tasks)

    const general = screen.getByRole('button', { name: 'Collapse General in To do' })
    const porting = screen.getByRole('button', { name: 'Collapse Porting in To do' })
    expect(within(general).getByText('4')).toBeInTheDocument()
    expect(within(porting).getByText('3')).toBeInTheDocument()
  })

  it('persists collapsed type sections in session storage', async () => {
    const tasks = Array.from({ length: 7 }, (_, index) => task(String(index + 1), {
      task_type: index < 4 ? 'general' : 'porting',
    }))
    const first = renderBoard(tasks)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse General in To do' }))
    expect(screen.queryByText('Task 1')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem('tasks-board-sections'))).toContain('todo:general')
    })

    first.unmount()
    renderBoard(tasks)
    expect(screen.getByRole('button', { name: 'Expand General in To do' })).toBeInTheDocument()
    expect(screen.queryByText('Task 1')).not.toBeInTheDocument()
  })
})

describe('TaskBoard Done cap', () => {
  it('shows the ten most recently updated Done cards before expanding all', () => {
    const tasks = Array.from({ length: 12 }, (_, index) => task(String(index + 1), {
      status: 'done',
      updated_at: `2026-07-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
    }))

    renderBoard(tasks)

    expect(within(column('Done')).getByText('Task 12')).toBeInTheDocument()
    expect(within(column('Done')).getByText('Task 3')).toBeInTheDocument()
    expect(within(column('Done')).queryByText('Task 2')).not.toBeInTheDocument()
    expect(within(column('Done')).queryByText('Task 1')).not.toBeInTheDocument()

    fireEvent.click(within(column('Done')).getByRole('button', { name: 'Show all 12' }))
    expect(within(column('Done')).getByText('Task 1')).toBeInTheDocument()
    expect(within(column('Done')).getByRole('button', { name: 'Show recent 10' })).toBeInTheDocument()
  })
})

describe('TaskBoard true-order drag calculations', () => {
  it('appends at the end of a non-final type group instead of anchoring to the next group', () => {
    const all = [
      task('a', { order: 1000, task_type: 'general' }),
      task('b', { order: 2000, task_type: 'porting' }),
      task('c', { order: 3000, task_type: 'general' }),
      task('d', { order: 4000, task_type: 'porting' }),
      task('e', { order: 5000, task_type: 'general' }),
      task('f', { order: 6000, task_type: 'porting' }),
      task('g', { order: 7000, task_type: 'general' }),
      task('h', { order: 8000, task_type: 'porting' }),
    ]
    const onMove = vi.fn()
    renderBoard(all, { onMove })

    vi.spyOn(column('To do'), 'getBoundingClientRect').mockReturnValue(rect({ height: 1000 }))
    const domOrder = ['a', 'c', 'e', 'g', 'b', 'd', 'f', 'h']
    domOrder.forEach((id, index) => {
      vi.spyOn(document.querySelector(`[data-task-id="${id}"]`), 'getBoundingClientRect')
        .mockReturnValue(rect({ top: index * 100 }))
    })

    // The pointer is below G (the last General card) but above B (the first
    // Porting card). B is early in true order, so anchoring before B would put
    // A back near the top. The correct slot is after G and before H.
    dragEndAt(document.querySelector('[data-task-id="a"]'), { x: 50, y: 390 })

    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'a' }),
      { status: 'todo', order: 7500 }
    )
  })

  it('uses complete column neighbors when grouping and filtering change DOM adjacency', () => {
    const all = [
      task('a', { order: 1000, task_type: 'general' }),
      task('b', { order: 2000, task_type: 'porting' }), // filtered out
      task('c', { order: 3000, task_type: 'general' }),
      task('d', { order: 4000, task_type: 'porting' }),
      task('e', { order: 5000, task_type: 'general' }),
      task('f', { order: 6000, task_type: 'porting' }),
      task('g', { order: 7000, task_type: 'general' }),
      task('h', { order: 8000, task_type: 'porting' }),
    ]
    const visible = all.filter((item) => item._id !== 'b')
    const onMove = vi.fn()
    renderBoard(visible, { orderingTasks: all, onMove })

    expect(screen.getByRole('button', { name: 'Collapse General in To do' })).toBeInTheDocument()
    vi.spyOn(column('To do'), 'getBoundingClientRect').mockReturnValue(rect({ height: 1000 }))
    const domOrder = ['a', 'c', 'e', 'g', 'd', 'f', 'h']
    domOrder.forEach((id, index) => {
      vi.spyOn(document.querySelector(`[data-task-id="${id}"]`), 'getBoundingClientRect')
        .mockReturnValue(rect({ top: index * 100 }))
    })

    // C's visible predecessor is A, but its true predecessor is filtered-out B.
    // Dropping G before C must therefore use midpoint(B=2000, C=3000) = 2500.
    dragEndAt(document.querySelector('[data-task-id="g"]'), { x: 50, y: 140 })

    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'g' }),
      { status: 'todo', order: 2500 }
    )
  })

  it('appends after the true final Done card when the rendered column is capped', () => {
    const done = Array.from({ length: 11 }, (_, index) => task(String(index + 1), {
      status: 'done',
      order: (index + 1) * 1000,
      updated_at: `2026-07-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
    }))
    const dragged = task('dragged', { order: 500, status: 'todo' })
    const onMove = vi.fn()
    renderBoard([...done, dragged], { onMove })

    vi.spyOn(column('Done'), 'getBoundingClientRect').mockReturnValue(rect({ left: 300, height: 1000 }))
    within(column('Done')).getAllByText(/^Task \d+$/).forEach((title, index) => {
      const wrapper = title.closest('[data-task-id]')
      vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(rect({ left: 300, top: index * 50, height: 40 }))
    })

    dragEndAt(document.querySelector('[data-task-id="dragged"]'), { x: 350, y: 900 })

    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'dragged' }),
      { status: 'done', order: 12000 }
    )
  })
})
