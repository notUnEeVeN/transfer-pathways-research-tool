import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownTrayIcon, ChevronDownIcon, ClipboardDocumentListIcon, PlusIcon,
} from '@heroicons/react/24/outline'
import { Button, EmptyState, Spinner, Stack, StatStrip, SwitchField, Tabs, useToast } from '../components/ui'
import { useAuth } from '../shared/hooks/useAuth'
import { usePersistedState } from '../shared/hooks/usePersistedState'
import { useAccessMe } from '../shared/query/hooks/useAccess'
import {
  useAddTaskStageNote, useCompleteTaskStage, useCreateTask, useDeleteTask,
  useDeleteTaskStageNote, useReopenTaskStage, useResolveTaskStageNote,
  useTaskRoster, useTasks, useUpdateTask,
} from '../shared/query/hooks/useData'
import { SEED_TASKS } from './seedTasks'
import TaskBoard from './TaskBoard'
import TaskFilters from './TaskFilters'
import TaskList from './TaskList'
import TaskModal from './TaskModal'
import { buildTaskHistoryAiBriefing, buildTaskHistoryMarkdown } from './taskHistory'
import {
  EMPTY_TASK_FILTERS, filterTasks, hasActiveTaskFilters,
} from './taskFilter'
import { isBareGeneralTask, withBoardAssignment } from './taskWorkflow'

const VIEWS = [
  { value: 'board', label: 'Board' },
  { value: 'mine', label: 'My tasks' },
  { value: 'all', label: 'All tasks' },
]

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const taskStats = (rows) => {
  const active = rows.filter((task) => !task.archived)
  return {
    open: active.filter((task) => task.status === 'todo').length,
    doing: active.filter((task) => task.status === 'in_progress').length,
    doneWeek: active.filter((task) => task.status === 'done' && task.completed_at
      && Date.now() - new Date(task.completed_at).getTime() < WEEK_MS).length,
  }
}

/**
 * TasksPage — the team's shared board over typed, stage-driven research work.
 */
export default function TasksPage() {
  const { user } = useAuth()
  // Admins may force-approve their own task; the server enforces the same rule.
  const access = useAccessMe()
  const isAdminUser = access.data?.role === 'admin'
  const toast = useToast()
  const tasksQ = useTasks()
  const rosterQ = useTaskRoster()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const addTaskStageNote = useAddTaskStageNote()
  const completeTaskStage = useCompleteTaskStage()
  const reopenTaskStage = useReopenTaskStage()
  const deleteTaskStageNote = useDeleteTaskStageNote()
  const resolveTaskStageNote = useResolveTaskStageNote()
  const deleteTask = useDeleteTask()

  const tasks = tasksQ.data?.rows || []
  const [view, setView] = useState('board')
  const [modal, setModal] = useState(null) // null | { task } | { initialStatus }
  const [seeding, setSeeding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef(null)
  const [filters, setFilters] = usePersistedState('tasks-filters', EMPTY_TASK_FILTERS)
  const validAssigneeUids = useMemo(
    () => (Array.isArray(rosterQ.data?.rows) ? rosterQ.data.rows : [])
      .map((person) => person?.uid).filter(Boolean),
    [rosterQ.data?.rows]
  )

  const filteredTasks = useMemo(
    () => filterTasks(tasks, { ...filters, uid: user?.uid, validAssigneeUids }),
    [tasks, filters, user?.uid, validAssigneeUids]
  )
  const filtersActive = hasActiveTaskFilters(filters)

  const stats = useMemo(() => taskStats(filteredTasks), [filteredTasks])
  const totalStats = useMemo(() => taskStats(tasks), [tasks])

  useEffect(() => {
    if (!exportOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!exportRef.current?.contains(event.target)) setExportOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setExportOpen(false)
      exportRef.current?.querySelector('[aria-haspopup="menu"]')?.focus()
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    exportRef.current?.querySelector('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [exportOpen])

  const onExportMenuKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = [...(exportRef.current?.querySelectorAll('[role="menuitem"]') || [])]
    if (!items.length) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement)
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowUp'
          ? (current <= 0 ? items.length - 1 : current - 1)
          : (current + 1) % items.length
    items[next].focus()
  }

  const onMove = (task, patch) => {
    // Verification is derived, not a drop target — a task reaches it by finishing
    // the Publish stage (Self-verify and peer approval both live there), so
    // reject drops onto that column.
    if (patch.status === 'verification') {
      toast.error('Tasks reach Verification by completing the Publish stage.')
      return
    }
    const bareGeneral = isBareGeneralTask(task)
    if (patch.status === 'done' && (task.progress || 0) < 100 && !bareGeneral) {
      toast.error(task.task_type === 'general'
        ? 'Complete every checkpoint before moving this task to Done.'
        : 'Complete team approval before moving this task to Done.')
      setModal({ task })
      return
    }
    if (task.status === 'done' && patch.status && patch.status !== 'done' && !bareGeneral) {
      toast.error('Reopen a workflow stage before moving this task out of Done.')
      setModal({ task })
      return
    }
    const movePatch = withBoardAssignment(task, patch, user, rosterQ.data?.rows || [])
    updateTask.mutate({ id: task._id, patch: movePatch }, {
      onError: (error) => toast.error(error?.response?.data?.error || 'Could not move the task.'),
    })
  }
  const onDelete = (task) => deleteTask.mutate(task._id, {
    onSuccess: () => toast.success('Task deleted'),
    onError: () => toast.error('Could not delete the task.'),
  })

  // Sweep only the board's current (filtered) Done column into the archive.
  // Tasks excluded by the active filters stay untouched and remain recoverable
  // from this same action after the filter changes.
  const archiveDone = async (columnTasks = []) => {
    const done = (Array.isArray(columnTasks) ? columnTasks : [])
      .filter((task) => task.status === 'done' && !task.archived)
    if (!done.length) return
    try {
      await Promise.all(done.map((t) => updateTask.mutateAsync({ id: t._id, patch: { archived: true } })))
      toast.success(`Archived ${done.length} done ${done.length === 1 ? 'task' : 'tasks'}`)
    } catch {
      toast.error('Could not archive every task in this Done column.')
    }
  }

  const seed = async () => {
    setSeeding(true)
    try {
      for (const t of SEED_TASKS) await createTask.mutateAsync(t)
      toast.success(`Seeded ${SEED_TASKS.length} tasks from the research portfolio`)
    } catch {
      toast.error('Seeding stopped partway — the created tasks are kept.')
    } finally {
      setSeeding(false)
    }
  }

  const copyHistory = async (kind) => {
    const briefing = kind === 'briefing'
    const text = briefing
      ? buildTaskHistoryAiBriefing(tasks)
      : buildTaskHistoryMarkdown(tasks)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      toast.success(briefing ? 'Timesheet briefing copied' : 'Weekly history copied')
      setExportOpen(false)
    } catch {
      toast.error('Could not copy the task history.')
    }
  }

  if (tasksQ.isLoading) {
    return <div className='flex justify-center py-16'><Spinner /></div>
  }

  const mine = filteredTasks.filter((t) => t.assignee_uid === user?.uid)
  const modalTask = modal?.task
    ? (tasks.find((task) => task._id === modal.task._id) || modal.task)
    : null

  return (
    // App owns the page's outer scroll — this wrapper only normalizes the
    // inner rhythm to the console mockup's 18px page gap (v2:789), which
    // doesn't match any of Stack's named gaps.
    <div className='flex flex-col gap-[18px]'>
      <div className='flex flex-wrap items-center gap-3'>
        <Tabs value={view} onChange={(nextView) => { setView(nextView); setExportOpen(false) }} options={VIEWS} />
        <span className='ml-auto flex flex-wrap items-center justify-end gap-1'>
          {view === 'all' && (
            <span ref={exportRef} className='relative' onKeyDown={onExportMenuKeyDown}>
              <Button variant='secondary' leadingIcon={ArrowDownTrayIcon} trailingIcon={ChevronDownIcon}
                aria-haspopup='menu' aria-expanded={exportOpen}
                onClick={() => setExportOpen((current) => !current)}>
                Export
              </Button>
              {exportOpen && (
                <span role='menu'
                  className='absolute right-0 top-full z-30 mt-1 w-64 surface-elevated p-1'
                  style={{ boxShadow: 'var(--shadow-lg)' }}>
                  <button type='button' role='menuitem' onClick={() => copyHistory('markdown')}
                    className='block w-full rounded-md px-3 py-2 text-left text-caption text-ink-muted hover:bg-primary-soft hover:text-ink'>
                    Copy weekly history (markdown)
                  </button>
                  <button type='button' role='menuitem' onClick={() => copyHistory('briefing')}
                    className='block w-full rounded-md px-3 py-2 text-left text-caption text-ink-muted hover:bg-primary-soft hover:text-ink'>
                    Copy timesheet briefing
                  </button>
                </span>
              )}
            </span>
          )}
          <Button leadingIcon={PlusIcon} onClick={() => setModal({ initialStatus: 'todo' })}>New task</Button>
        </span>
      </div>

      {tasks.length > 0 && (
        <TaskFilters value={filters} onChange={setFilters} roster={rosterQ.data?.rows || []} />
      )}

      {tasks.length > 0 && (
        <StatStrip tiles={[
          { label: 'Open', value: String(stats.open), sub: filtersActive ? `of ${totalStats.open}` : null },
          { label: 'In progress', value: String(stats.doing), accent: true, sub: filtersActive ? `of ${totalStats.doing}` : null },
          { label: 'Done this week', value: String(stats.doneWeek), sub: filtersActive ? `of ${totalStats.doneWeek}` : null },
        ]} />
      )}

      {tasks.length === 0 ? (
        <EmptyState
          card
          icon={ClipboardDocumentListIcon}
          title='No tasks yet'
          description='Start from the research portfolio — the remaining CA-paper figures and the MA recreations — or begin with a blank board.'
          action={
            <span className='flex items-center gap-2'>
              <Button onClick={seed} loading={seeding}>Seed the research backlog</Button>
              <Button variant='ghost' onClick={() => setModal({ initialStatus: 'todo' })}>New task</Button>
            </span>
          }
        />
      ) : view === 'board' ? (
        <TaskBoard
          tasks={filteredTasks}
          orderingTasks={tasks}
          onOpen={(task) => setModal({ task })}
          onMove={onMove}
          onNewIn={(status) => setModal({ initialStatus: status })}
          onArchiveDone={archiveDone}
        />
      ) : (
        <Stack gap='cozy'>
          {view === 'all' && (
            <SwitchField className='justify-end' label='Show archived'
              checked={showArchived} onChange={() => setShowArchived((s) => !s)} />
          )}
          <TaskList
            tasks={view === 'mine' ? mine : filteredTasks}
            onOpen={(task) => setModal({ task })}
            includeArchived={view === 'all' && showArchived}
            emptyTitle={view === 'mine' ? 'Nothing assigned to you' : 'No tasks'}
          />
        </Stack>
      )}

      {modal && (
        <TaskModal
          key={modal.task?._id || 'new'}
          open
          onClose={() => setModal(null)}
          // the LIVE row, not the snapshot captured at open — notes append to
          // task.notes, and a stale snapshot would drop earlier posts
          task={modalTask}
          initialStatus={modal.initialStatus || 'todo'}
          roster={rosterQ.data?.rows || []}
          me={user}
          admin={isAdminUser}
          onCreate={(body) => createTask.mutateAsync(body)}
          onPatch={(id, patch) => updateTask.mutateAsync({ id, patch })}
          onAddStageNote={(id, stage, note) => addTaskStageNote.mutateAsync({ id, stage, note })}
          onCompleteStage={(id, stage) => completeTaskStage.mutateAsync({ id, stage })}
          onReopenStage={(id, stage, note) => reopenTaskStage.mutateAsync({ id, stage, note })}
          onDeleteStageNote={(id, logId) => deleteTaskStageNote.mutateAsync({ id, logId })}
          onResolveStageNote={(id, logId, resolved) => resolveTaskStageNote.mutateAsync({ id, logId, resolved })}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}
