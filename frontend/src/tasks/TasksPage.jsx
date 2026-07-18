import React, { useMemo, useState } from 'react'
import { ClipboardDocumentListIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Button, EmptyState, Spinner, Stack, StatStrip, SwitchField, Tabs, useToast } from '../components/ui'
import { useAuth } from '../shared/hooks/useAuth'
import { useAccessMe } from '../shared/query/hooks/useAccess'
import {
  useAddTaskStageNote, useCompleteTaskStage, useCreateTask, useDeleteTask,
  useDeleteTaskStageNote, useReopenTaskStage, useResolveTaskStageNote,
  useTaskRoster, useTasks, useUpdateTask,
} from '../shared/query/hooks/useData'
import { SEED_TASKS } from './seedTasks'
import TaskBoard from './TaskBoard'
import TaskList from './TaskList'
import TaskModal from './TaskModal'
import { withBoardAssignment } from './taskWorkflow'

const VIEWS = [
  { value: 'board', label: 'Board' },
  { value: 'mine', label: 'My tasks' },
  { value: 'all', label: 'All tasks' },
]

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

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

  const stats = useMemo(() => {
    const active = tasks.filter((t) => !t.archived)
    // Legacy 'backlog' docs read as 'todo' server-side, so counting todo covers
    // them too.
    const open = active.filter((t) => t.status === 'todo').length
    const doing = active.filter((t) => t.status === 'in_progress').length
    const doneWeek = active.filter((t) => t.status === 'done' && t.completed_at
      && Date.now() - new Date(t.completed_at).getTime() < WEEK_MS).length
    return { open, doing, doneWeek }
  }, [tasks])

  const onMove = (task, patch) => {
    // Verification is derived, not a drop target — a task reaches it by finishing
    // the Publish stage (Self-verify and peer approval both live there), so
    // reject drops onto that column.
    if (patch.status === 'verification') {
      toast.error('Tasks reach Verification by completing the Publish stage.')
      return
    }
    if (patch.status === 'done' && (task.progress || 0) < 100) {
      toast.error('Complete team approval before moving this task to Done.')
      setModal({ task })
      return
    }
    if (task.status === 'done' && patch.status && patch.status !== 'done') {
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

  // Sweep the Done column into the archive — off the board, still in the All
  // list behind the "Show archived" switch. Reversible per task from its modal.
  const archiveDone = async () => {
    const done = tasks.filter((t) => t.status === 'done' && !t.archived)
    if (!done.length) return
    try {
      await Promise.all(done.map((t) => updateTask.mutateAsync({ id: t._id, patch: { archived: true } })))
      toast.success(`Archived ${done.length} done ${done.length === 1 ? 'task' : 'tasks'}`)
    } catch {
      toast.error('Could not archive everything — the rest are untouched.')
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

  if (tasksQ.isLoading) {
    return <div className='flex justify-center py-16'><Spinner /></div>
  }

  const mine = tasks.filter((t) => t.assignee_uid === user?.uid)
  const modalTask = modal?.task
    ? (tasks.find((task) => task._id === modal.task._id) || modal.task)
    : null

  return (
    // App owns the page's outer scroll — this wrapper only normalizes the
    // inner rhythm to the console mockup's 18px page gap (v2:789), which
    // doesn't match any of Stack's named gaps.
    <div className='flex flex-col gap-[18px]'>
      <div className='flex flex-wrap items-center gap-3'>
        <Tabs value={view} onChange={setView} options={VIEWS} />
        <span className='ml-auto flex flex-wrap items-center justify-end gap-1'>
          <Button leadingIcon={PlusIcon} onClick={() => setModal({ initialStatus: 'todo' })}>New task</Button>
        </span>
      </div>

      {tasks.length > 0 && (
        <StatStrip tiles={[
          { label: 'Open', value: String(stats.open) },
          { label: 'In progress', value: String(stats.doing), accent: true },
          { label: 'Done this week', value: String(stats.doneWeek) },
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
          tasks={tasks}
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
            tasks={view === 'mine' ? mine : tasks}
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
