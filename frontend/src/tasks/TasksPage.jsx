import React, { useMemo, useState } from 'react'
import { ClipboardDocumentListIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Button, EmptyState, Spinner, Stack, StatStrip, SwitchField, Tabs, useToast } from '../components/ui'
import { useAuth } from '../shared/hooks/useAuth'
import { useTasks, useTaskRoster, useCreateTask, useUpdateTask, useDeleteTask } from '../shared/query/hooks/useData'
import { SEED_TASKS } from './seedTasks'
import TaskBoard from './TaskBoard'
import TaskList from './TaskList'
import TaskModal from './TaskModal'

const VIEWS = [
  { value: 'board', label: 'Board' },
  { value: 'mine', label: 'My tasks' },
  { value: 'all', label: 'All tasks' },
]

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * TasksPage — the team's shared task board. Deliberately simple: title,
 * description, assignee, board status, a self-reported progress bar, and notes
 * where the team leaves tips on how to tackle each task.
 */
export default function TasksPage() {
  const { user } = useAuth()
  const toast = useToast()
  const tasksQ = useTasks()
  const rosterQ = useTaskRoster()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const tasks = tasksQ.data?.rows || []
  const [view, setView] = useState('board')
  const [modal, setModal] = useState(null) // null | { task } | { initialStatus }
  const [seeding, setSeeding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const stats = useMemo(() => {
    const active = tasks.filter((t) => !t.archived)
    const open = active.filter((t) => t.status === 'backlog' || t.status === 'todo').length
    const doing = active.filter((t) => t.status === 'in_progress').length
    const doneWeek = active.filter((t) => t.status === 'done' && t.completed_at
      && Date.now() - new Date(t.completed_at).getTime() < WEEK_MS).length
    return { open, doing, doneWeek }
  }, [tasks])

  const onMove = (task, patch) => updateTask.mutate({ id: task._id, patch }, {
    onError: () => toast.error('Could not move the task.'),
  })
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

  return (
    <Stack gap='section'>
      <div className='flex flex-wrap items-center gap-3'>
        <Tabs value={view} onChange={setView} options={VIEWS} />
        <span className='ml-auto'>
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
          task={modal.task ? (tasks.find((t) => t._id === modal.task._id) || modal.task) : null}
          initialStatus={modal.initialStatus || 'todo'}
          roster={rosterQ.data?.rows || []}
          me={user}
          onCreate={(body) => createTask.mutateAsync(body)}
          onPatch={(id, patch) => updateTask.mutateAsync({ id, patch })}
          onDelete={onDelete}
        />
      )}
    </Stack>
  )
}
