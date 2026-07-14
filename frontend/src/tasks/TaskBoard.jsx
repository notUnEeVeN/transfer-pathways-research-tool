import React, { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PlusIcon, ChevronDownIcon, ChevronRightIcon, ArchiveBoxArrowDownIcon } from '@heroicons/react/24/outline'
import TaskCard from './TaskCard'
import { isAwaitingVerification } from './taskWorkflow'
import { usePersistedState } from '../shared/hooks/usePersistedState'

// Verification is a DERIVED column, not a stored status: a task lands there when
// it is in_progress and its only remaining stage is peer approval (see
// isAwaitingVerification). Backlog was removed; legacy 'backlog' docs read as
// 'todo' server-side, so they never reach the board.
export const COLUMNS = [
  { status: 'todo',         label: 'To do' },
  { status: 'in_progress',  label: 'In progress' },
  { status: 'verification', label: 'Verification' },
  { status: 'done',         label: 'Done' },
]

// Which board column a task is drawn in. Everything is keyed on the stored
// status except the derived Verification bucket, which pulls self-verified
// in_progress tasks out of In progress.
const columnFor = (task) => (isAwaitingVerification(task) ? 'verification' : task.status)

// Fractional index between two neighbors for drag-drop reordering — the moved
// card takes the midpoint, so a reorder writes one doc instead of renumbering
// the column. 1000-step edge gaps leave room for many midpoint splits.
function orderBetween(prevOrder, nextOrder) {
  if (prevOrder == null && nextOrder == null) return 1000
  if (prevOrder == null) return nextOrder - 1000
  if (nextOrder == null) return prevOrder + 1000
  return (prevOrder + nextOrder) / 2
}

// Insert position within a column: first card whose vertical midpoint sits
// below the pointer. Rects are read at drop time (not tracked live) — cheap
// and accurate enough for card-height targets. A drop below the last card
// (or into a scrolled region) lands at the end, which is a valid order.
function dropSlot(columnEl, draggedId, pointY) {
  const cards = [...columnEl.querySelectorAll('[data-task-id]')]
    .filter((el) => el.dataset.taskId !== draggedId)
  let prev = null
  for (const el of cards) {
    const r = el.getBoundingClientRect()
    if (pointY < r.top + r.height / 2) return { prevId: prev, nextId: el.dataset.taskId }
    prev = el.dataset.taskId
  }
  return { prevId: prev, nextId: null }
}

/**
 * TaskBoard — four-column kanban over the shared tasks list. Cards drag
 * between/within columns with framer-motion; the drop writes ONE patch
 * { status, order } using fractional ordering (orderBetween), applied
 * optimistically by useUpdateTask so the board never flickers.
 *
 * Columns collapse to a slim header bar (chevron; sessionStorage-persisted) —
 * an empty To do or a swollen Done folds out of the way but stays a valid
 * drop target (drops append to the column's end). Verification is derived, not
 * a drop target: cards enter it by completing Self-verify and leave via peer
 * approval or a stage reopen, so its cards don't drag and it takes no drops.
 * A long column scrolls
 * within a bounded height rather than growing the page; while a drag is in
 * flight every column switches to overflow-visible so the dragged card isn't
 * clipped crossing between columns. The Done column offers an archive sweep
 * (onArchiveDone) so finished work leaves the board without being lost —
 * archived tasks stay reachable in the All list.
 */
export default function TaskBoard({ tasks, onOpen, onMove, onNewIn, onArchiveDone }) {
  const columnRefs = useRef(new Map())
  const [dragging, setDragging] = useState(null)   // task _id being dragged
  const [hoverCol, setHoverCol] = useState(null)   // status under the pointer
  const [collapsed, setCollapsed] = usePersistedState('tasks-board-collapsed', [])
  const didDrag = useRef(false)

  const byColumn = useMemo(() => {
    const m = Object.fromEntries(COLUMNS.map((c) => [c.status, []]))
    for (const t of tasks) {
      if (t.archived) continue
      const col = columnFor(t)
      if (m[col]) m[col].push(t)
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    return m
  }, [tasks])

  const isCollapsed = (status) => collapsed.includes(status)
  const toggleCollapsed = (status) => setCollapsed(
    isCollapsed(status) ? collapsed.filter((s) => s !== status) : [...collapsed, status]
  )

  const columnAt = (point) => {
    for (const [status, el] of columnRefs.current) {
      const r = el?.getBoundingClientRect()
      if (r && point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) return status
    }
    return null
  }

  const handleDragEnd = (task, info) => {
    setDragging(null)
    setHoverCol(null)
    const status = columnAt(info.point)
    if (!status) return
    const col = byColumn[status]
    let order
    if (isCollapsed(status)) {
      // no cards in the DOM to slot between — append to the column's end
      order = orderBetween(col.length ? col[col.length - 1].order : null, null)
    } else {
      const el = columnRefs.current.get(status)
      const { prevId, nextId } = dropSlot(el, task._id, info.point.y)
      const prev = col.find((t) => t._id === prevId)
      const next = col.find((t) => t._id === nextId)
      order = orderBetween(prev?.order ?? null, next?.order ?? null)
    }
    if (status === task.status && order === task.order) return
    onMove(task, { status, order })
  }

  return (
    <div className='flex flex-col xl:flex-row gap-4 items-stretch xl:items-start'>
      {COLUMNS.map(({ status, label }) => {
        const col = byColumn[status]
        const folded = isCollapsed(status)
        return (
          <div
            key={status}
            ref={(el) => { el ? columnRefs.current.set(status, el) : columnRefs.current.delete(status) }}
            className={`bg-surface-muted rounded-2xl p-3 transition-shadow ${
              folded ? 'xl:w-44 xl:flex-none' : 'flex-1 min-w-0'} ${
              hoverCol === status && dragging ? 'ring-2 ring-primary/40' : ''}`}
          >
            <div className='flex items-center gap-1.5 px-1 py-1'>
              <button type='button' onClick={() => toggleCollapsed(status)}
                aria-expanded={!folded} aria-label={`${folded ? 'Expand' : 'Collapse'} ${label}`}
                className='inline-flex items-center gap-1.5 text-ink-muted hover:text-ink rounded-md px-0.5'>
                {folded
                  ? <ChevronRightIcon className='w-3.5 h-3.5' />
                  : <ChevronDownIcon className='w-3.5 h-3.5' />}
                <span className='text-label'>{label}</span>
              </button>
              <span className='chip bg-surface'>{col.length}</span>
              {!folded && (
                <span className='ml-auto inline-flex items-center gap-0.5'>
                  {status === 'done' && col.length > 0 && (
                    <button type='button' onClick={() => onArchiveDone?.()}
                      aria-label='Archive all done tasks' title='Archive all — clears the column; find them under All tasks'
                      className='text-ink-subtle hover:text-ink rounded-md p-0.5'>
                      <ArchiveBoxArrowDownIcon className='w-4 h-4' />
                    </button>
                  )}
                  {status !== 'done' && status !== 'verification' && (
                    <button type='button' onClick={() => onNewIn(status)} aria-label={`New task in ${label}`}
                      className='text-ink-subtle hover:text-ink rounded-md p-0.5'>
                      <PlusIcon className='w-4 h-4' />
                    </button>
                  )}
                </span>
              )}
            </div>
            {!folded && (
              // Bounded height → the column scrolls instead of stretching the
              // page. During a drag, overflow goes visible so the dragged card
              // isn't clipped leaving the column (you can't scroll mid-drag
              // anyway); the drop is resolved from pointer position regardless.
              <div className={`mt-1 space-y-2 min-h-[3rem] max-h-[70vh] pr-0.5 ${
                dragging ? 'overflow-visible' : 'overflow-y-auto'}`}>
                {col.length === 0 && (
                  status === 'verification' ? (
                    <p className='rounded-xl px-3 py-[22px] text-center text-[12.5px] text-ink-subtle'>
                      Nothing awaiting verification
                    </p>
                  ) : (
                    <p className='border-[1.5px] border-dashed border-border-strong rounded-xl px-3 py-[22px] text-center text-[12.5px] text-ink-subtle'>
                      Drop a task here
                    </p>
                  )
                )}
                {/* Match the transformed wrapper to TaskCard's radius; the
                    rounded child owns the shadow so no square drag layer shows. */}
                {col.map((task) => (
                  <motion.div
                    key={task._id}
                    data-task-id={task._id}
                    layout='position'
                    drag={status !== 'verification'}
                    dragSnapToOrigin
                    dragElastic={0.15}
                    whileDrag={{ scale: 1.03, zIndex: 40, cursor: 'grabbing' }}
                    onDragStart={() => { setDragging(task._id); didDrag.current = true }}
                    onDrag={(_, info) => {
                      const c = columnAt(info.point)
                      if (c !== hoverCol) setHoverCol(c)
                    }}
                    onDragEnd={(_, info) => handleDragEnd(task, info)}
                    className='relative rounded-xl isolate'
                  >
                    <TaskCard
                      task={task}
                      dragging={dragging === task._id}
                      onOpen={() => {
                        // a real drag ends with a click on the same element — swallow it
                        if (didDrag.current) { didDrag.current = false; return }
                        onOpen(task)
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
