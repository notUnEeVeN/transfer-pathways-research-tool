import React, { useMemo } from 'react'
import { CheckCircleIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Badge, EmptyState, Panel } from '../components/ui'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import { usePersistedState } from '../shared/hooks/usePersistedState'
import { COLUMNS } from './TaskBoard'
import {
  isAwaitingVerification, isBareGeneralTask, taskTypeBadgeVariant, taskTypeLabel,
} from './taskWorkflow'

const STATUS_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.status, c.label]))
// Verification is a derived board state (stored status stays in_progress); its
// lavender pill sets it apart from the In progress success pill.
const STATUS_TONE = { todo: 'neutral', in_progress: 'success', verification: 'conservative', done: 'success' }
const STATUS_RANK = Object.fromEntries(COLUMNS.map((c, i) => [c.status, i]))

const fmtDay = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')

const displayStatusOf = (t) => (isAwaitingVerification(t) ? 'verification' : t.status)

function TaskRow({ t, onOpen }) {
  const displayStatus = displayStatusOf(t)
  return (
    <button type='button' onClick={() => onOpen(t)}
      className='w-full text-left px-5 py-2 border-b border-border last:border-0 hover:bg-surface-hover cursor-pointer flex items-center gap-3 transition-colors'>
      {t.archived && <Badge>archived</Badge>}
      <Badge variant={taskTypeBadgeVariant(t.task_type)} className='hidden md:inline-flex'>{taskTypeLabel(t.task_type)}</Badge>
      <span className={`text-caption font-semibold flex-1 min-w-0 truncate ${t.status === 'done' || t.archived ? 'ink-muted' : 'ink-default'}`}>{t.title}</span>
      {t.status !== 'done' && !isBareGeneralTask(t) && (t.task_type === 'audit_fix' ? (
        // The fix inbox has no progress framing — just how many are open.
        <Badge className='hidden lg:inline-flex tabular'>
          {(t.checklist_items || []).filter((item) => !(t.workflow_stages?.[item.key]?.completed || t.workflow_stages?.[item.key]?.completed_at)).length} open
        </Badge>
      ) : (
        <span className='hidden lg:flex items-center gap-2 shrink-0'>
          <span className='w-20 h-[5px] rounded-full bg-surface-sunken overflow-hidden shrink-0'>
            <span className='block h-full rounded-full bg-primary' style={{ width: `${Math.max(0, Math.min(100, t.progress || 0))}%` }} />
          </span>
          <span className='text-tag text-ink-subtle w-8 text-right shrink-0'>{t.progress || 0}%</span>
        </span>
      ))}
      <span className='hidden sm:inline-flex items-center gap-1.5 w-40 shrink-0'>
        {t.assignee_uid
          ? (<><UserInitialsAvatar email={t.assignee_label || t.assignee_uid} size='sm' className='!w-[22px] !h-[22px]' />
              <span className='text-tag text-ink-subtle truncate'>{t.assignee_label || t.assignee_uid}</span></>)
          : <span className='text-tag text-ink-subtle'>unassigned</span>}
      </span>
      <span className='text-tag text-ink-subtle w-14 text-right shrink-0'>{fmtDay(t.updated_at)}</span>
    </button>
  )
}

/**
 * TaskList — a dense table grouped by status, each group collapsible so a
 * swollen column (a long Done, a big Verification backlog) folds out of the way.
 * Same click-to-open contract as the board; rows keep the board's order within
 * each group so the two views never disagree about sequence.
 */
export default function TaskList({ tasks, onOpen, includeArchived = false, emptyTitle = 'No tasks here' }) {
  const [collapsed, setCollapsed] = usePersistedState('tasks-table-collapsed', [])
  const collapsedGroups = Array.isArray(collapsed) ? collapsed : []
  const toggle = (status) => setCollapsed(
    collapsedGroups.includes(status)
      ? collapsedGroups.filter((s) => s !== status)
      : [...collapsedGroups, status]
  )

  const groups = useMemo(() => {
    const visible = tasks
      .filter((t) => includeArchived || !t.archived)
      .slice()
      .sort((a, b) => (STATUS_RANK[displayStatusOf(a)] ?? 9) - (STATUS_RANK[displayStatusOf(b)] ?? 9)
        || (a.order ?? 0) - (b.order ?? 0))
    const byStatus = new Map()
    for (const t of visible) {
      const status = displayStatusOf(t)
      if (!byStatus.has(status)) byStatus.set(status, [])
      byStatus.get(status).push(t)
    }
    return COLUMNS.map((c) => c.status)
      .filter((status) => byStatus.has(status))
      .map((status) => ({ status, tasks: byStatus.get(status) }))
  }, [tasks, includeArchived])

  if (!groups.length) {
    return <EmptyState card icon={CheckCircleIcon} title={emptyTitle} description='Tasks assigned to you will show up here.' />
  }

  return (
    <Panel padded={false}>
      {groups.map(({ status, tasks: groupTasks }) => {
        const isCollapsed = collapsedGroups.includes(status)
        return (
          <section key={status} className='border-b border-border last:border-0'>
            <button type='button' onClick={() => toggle(status)}
              aria-expanded={!isCollapsed}
              className='sticky top-0 z-10 flex w-full items-center gap-2 bg-surface-muted px-4 py-2 text-left hover:bg-surface-hover'>
              {isCollapsed ? <ChevronRightIcon className='h-3.5 w-3.5 text-ink-muted' />
                : <ChevronDownIcon className='h-3.5 w-3.5 text-ink-muted' />}
              <Badge variant={STATUS_TONE[status]}>{STATUS_LABEL[status] || status}</Badge>
              <span className='chip bg-surface'>{groupTasks.length}</span>
            </button>
            {!isCollapsed && groupTasks.map((t) => <TaskRow key={t._id} t={t} onOpen={onOpen} />)}
          </section>
        )
      })}
    </Panel>
  )
}
