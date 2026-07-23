import React, { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PlusIcon, ChevronDownIcon, ChevronRightIcon, ArchiveBoxArrowDownIcon } from '@heroicons/react/24/outline'
import TaskCard from './TaskCard'
import { isAwaitingVerification, taskTypeLabel } from './taskWorkflow'
import { usePersistedState } from '../shared/hooks/usePersistedState'

const DONE_LIMIT = 10

// Verification is a DERIVED column, not a stored status: a task lands there when
// it is in_progress and its next stage is in the verification phase — Self-verify
// or peer approval (see isAwaitingVerification). Backlog was removed; legacy
// 'backlog' docs read as 'todo' server-side, so they never reach the board.
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

const tasksByColumn = (tasks) => {
  const columns = Object.fromEntries(COLUMNS.map((column) => [column.status, []]))
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task.archived) continue
    const status = columnFor(task)
    if (columns[status]) columns[status].push(task)
  }
  for (const status of Object.keys(columns)) {
    columns[status].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  return columns
}

const updatedTime = (task) => {
  const time = Date.parse(task?.updated_at)
  return Number.isNaN(time) ? 0 : time
}

const groupByTaskType = (tasks) => {
  const groups = []
  const byType = new Map()
  for (const task of tasks) {
    const taskType = task.task_type || 'porting'
    let group = byType.get(taskType)
    if (!group) {
      group = { taskType, tasks: [] }
      byType.set(taskType, group)
      groups.push(group)
    }
    group.tasks.push(task)
  }
  return groups
}

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

// Convert a visible DOM boundary into adjacent neighbors from the complete,
// true-order column. The next visible card is the anchor; filtered-out cards
// immediately before it still participate in the midpoint. A drop below every
// rendered card appends after the true final card, including capped/hidden ones.
function trueOrderSlot(
  column,
  draggedId,
  nextVisibleId,
  { grouped = false, prevVisibleId = null, draggedTaskType = null } = {}
) {
  const ordered = column.filter((task) => task._id !== draggedId)
  // Grouping changes DOM adjacency: the card after the final card in one type
  // section belongs to the next section, even when it appeared much earlier in
  // the column's true order. Treat that boundary as "append to this type" and
  // anchor after the final matching task in the complete ordering universe.
  // This also keeps filtered-out cards of the same type ahead of the append.
  if (grouped && prevVisibleId != null && nextVisibleId != null) {
    const prevVisible = ordered.find((task) => task._id === prevVisibleId)
    const nextVisible = ordered.find((task) => task._id === nextVisibleId)
    const typeFor = (task) => task?.task_type || 'porting'
    if (prevVisible && nextVisible
      && typeFor(prevVisible) === draggedTaskType
      && typeFor(nextVisible) !== draggedTaskType) {
      let lastTypeIndex = -1
      for (let index = 0; index < ordered.length; index += 1) {
        if (typeFor(ordered[index]) === draggedTaskType) lastTypeIndex = index
      }
      if (lastTypeIndex >= 0) {
        return {
          prev: ordered[lastTypeIndex],
          next: ordered[lastTypeIndex + 1] || null,
        }
      }
    }
  }
  if (nextVisibleId != null) {
    const nextIndex = ordered.findIndex((task) => task._id === nextVisibleId)
    if (nextIndex >= 0) {
      return {
        prev: nextIndex > 0 ? ordered[nextIndex - 1] : null,
        next: ordered[nextIndex],
      }
    }
  }
  return { prev: ordered.length ? ordered[ordered.length - 1] : null, next: null }
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
 * a drop target: cards enter it by completing Publish (the verification phase
 * is Self-verify + peer approval) and leave via approval or a stage reopen,
 * so its cards don't drag and it takes no drops.
 * Columns with more than six visible cards and multiple task types split into
 * persisted, collapsible type sections. Done starts with the ten most recently
 * updated cards and can expand to the full column. Neither presentation layer
 * changes ordering: orderingTasks supplies the complete column used for every
 * fractional-order calculation, even when tasks is a filtered subset.
 * A long column scrolls
 * within a bounded height rather than growing the page; while a drag is in
 * flight every column switches to overflow-visible so the dragged card isn't
 * clipped crossing between columns. The Done column offers an archive sweep
 * (onArchiveDone) so finished work leaves the board without being lost —
 * archived tasks stay reachable in the All list.
 */
export default function TaskBoard({
  tasks = [], orderingTasks = tasks, onOpen, onMove, onNewIn, onArchiveDone,
  onReviewVerification, me = null,
}) {
  const columnRefs = useRef(new Map())
  const [dragging, setDragging] = useState(null)   // task _id being dragged
  const [hoverCol, setHoverCol] = useState(null)   // status under the pointer
  const [collapsed, setCollapsed] = usePersistedState('tasks-board-collapsed', [])
  const [collapsedSections, setCollapsedSections] = usePersistedState('tasks-board-sections', [])
  const [showAllDone, setShowAllDone] = useState(false)
  const didDrag = useRef(false)

  const byColumn = useMemo(() => tasksByColumn(tasks), [tasks])
  const orderingByColumn = useMemo(() => tasksByColumn(orderingTasks), [orderingTasks])
  const collapsedColumns = Array.isArray(collapsed) ? collapsed : []
  const sectionKeys = Array.isArray(collapsedSections) ? collapsedSections : []

  const isCollapsed = (status) => collapsedColumns.includes(status)
  const toggleCollapsed = (status) => setCollapsed(
    isCollapsed(status) ? collapsedColumns.filter((s) => s !== status) : [...collapsedColumns, status]
  )
  const isSectionCollapsed = (status, taskType) => sectionKeys.includes(`${status}:${taskType}`)
  const toggleSection = (status, taskType) => {
    const key = `${status}:${taskType}`
    setCollapsedSections(
      sectionKeys.includes(key) ? sectionKeys.filter((item) => item !== key) : [...sectionKeys, key]
    )
  }

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
    const col = orderingByColumn[status] || []
    let order
    if (isCollapsed(status)) {
      // no cards in the DOM to slot between — append to the column's end
      const { prev, next } = trueOrderSlot(col, task._id, null)
      order = orderBetween(prev?.order ?? null, next?.order ?? null)
    } else {
      const el = columnRefs.current.get(status)
      const { prevId, nextId } = dropSlot(el, task._id, info.point.y)
      const { prev, next } = trueOrderSlot(col, task._id, nextId, {
        grouped: Boolean(el.querySelector('[data-task-section]')),
        prevVisibleId: prevId,
        draggedTaskType: task.task_type || 'porting',
      })
      order = orderBetween(prev?.order ?? null, next?.order ?? null)
    }
    if (status === task.status && order === task.order) return
    onMove(task, { status, order })
  }

  const renderCard = (task, status) => (
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
        const column = columnAt(info.point)
        if (column !== hoverCol) setHoverCol(column)
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
  )

  return (
    <div className='flex flex-col xl:flex-row gap-4 items-stretch xl:items-start'>
      {COLUMNS.map(({ status, label }) => {
        const col = byColumn[status]
        const folded = isCollapsed(status)
        const displayOrder = status === 'done'
          ? col.slice().sort((a, b) => updatedTime(b) - updatedTime(a))
          : col
        const visibleCards = status === 'done' && !showAllDone
          ? displayOrder.slice(0, DONE_LIMIT)
          : displayOrder
        const groups = groupByTaskType(visibleCards)
        const grouped = visibleCards.length > 6 && groups.length > 1
        // Verification is high-volume and homogeneous; the board shows it as a
        // summary tile that hands off to the dedicated review queue rather than
        // a long, non-draggable card list nobody wants sprawling here.
        const myVerifyCount = status === 'verification'
          ? col.filter((task) => task.assignee_uid && task.assignee_uid === me?.uid).length
          : 0
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
                    <button type='button' onClick={() => onArchiveDone?.(col)}
                      aria-label={`Archive ${col.length} ${col.length === 1 ? 'task' : 'tasks'} in Done`}
                      title='Archive this Done column — tasks excluded by filters are kept'
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
            {!folded && status === 'verification' && (
              <div className='mt-1'>
                {col.length === 0 ? (
                  <p className='rounded-xl px-3 py-[22px] text-center text-tag text-ink-subtle'>
                    Nothing awaiting verification
                  </p>
                ) : (
                  <div className='rounded-xl border border-border bg-surface px-3 py-4 text-center'>
                    <p className='text-[26px] font-[680] leading-none text-ink tabular'>{col.length}</p>
                    <p className='mt-1 text-tag text-ink-subtle'>
                      awaiting{myVerifyCount ? ` · ${myVerifyCount} yours` : ''}
                    </p>
                    <button type='button' onClick={() => onReviewVerification?.()}
                      className='mt-3 inline-flex items-center gap-1 rounded-pill bg-primary px-3.5 py-1.5 text-caption font-[650] text-on-primary hover:bg-primary-hover'>
                      Review →
                    </button>
                  </div>
                )}
              </div>
            )}
            {!folded && status !== 'verification' && (
              // Bounded height → the column scrolls instead of stretching the
              // page. During a drag, overflow goes visible so the dragged card
              // isn't clipped leaving the column (you can't scroll mid-drag
              // anyway); the drop is resolved from pointer position regardless.
              <div className={`mt-1 space-y-2 min-h-[3rem] max-h-[70vh] pr-0.5 ${
                dragging ? 'overflow-visible' : 'overflow-y-auto'}`}>
                {col.length === 0 && (
                  status === 'verification' ? (
                    <p className='rounded-xl px-3 py-[22px] text-center text-tag text-ink-subtle'>
                      Nothing awaiting verification
                    </p>
                  ) : (
                    <p className='border-[1.5px] border-dashed border-border-strong rounded-xl px-3 py-[22px] text-center text-tag text-ink-subtle'>
                      Drop a task here
                    </p>
                  )
                )}
                {/* Match the transformed wrapper to TaskCard's radius; the
                    rounded child owns the shadow so no square drag layer shows. */}
                {grouped ? groups.map(({ taskType, tasks: groupTasks }) => {
                  const sectionCollapsed = isSectionCollapsed(status, taskType)
                  return (
                    <section key={taskType} data-task-section={`${status}:${taskType}`}
                      className='rounded-xl border border-border p-2'>
                      <button type='button' onClick={() => toggleSection(status, taskType)}
                        aria-expanded={!sectionCollapsed}
                        aria-label={`${sectionCollapsed ? 'Expand' : 'Collapse'} ${taskTypeLabel(taskType)} in ${label}`}
                        className='flex w-full items-center gap-1.5 rounded-md px-0.5 py-0.5 text-left text-ink-muted hover:text-ink'>
                        {sectionCollapsed
                          ? <ChevronRightIcon className='h-3.5 w-3.5' />
                          : <ChevronDownIcon className='h-3.5 w-3.5' />}
                        <span className='text-tag font-[650]'>{taskTypeLabel(taskType)}</span>
                        <span className='chip bg-surface'>{groupTasks.length}</span>
                      </button>
                      {!sectionCollapsed && (
                        <div className='mt-2 space-y-2'>
                          {groupTasks.map((task) => renderCard(task, status))}
                        </div>
                      )}
                    </section>
                  )
                }) : visibleCards.map((task) => renderCard(task, status))}
                {status === 'done' && col.length > DONE_LIMIT && (
                  <button type='button' onClick={() => setShowAllDone((shown) => !shown)}
                    className='w-full rounded-xl px-3 py-2 text-caption text-ink-muted hover:bg-surface-hover hover:text-ink'>
                    {showAllDone ? `Show recent ${DONE_LIMIT}` : `Show all ${col.length}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
