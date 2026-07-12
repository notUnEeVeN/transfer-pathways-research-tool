import React, { useMemo } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { Badge, EmptyState, Panel } from '../components/ui'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import { COLUMNS } from './TaskBoard'
import { taskTypeLabel } from './taskWorkflow'

const STATUS_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.status, c.label]))
const STATUS_TONE = { backlog: 'neutral', todo: 'neutral', in_progress: 'accent', done: 'success' }

const fmtDay = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')

/**
 * TaskList — the flat row view (My tasks / All tasks). Same click-to-open
 * contract as the board; rows are ordered by status column then board order so
 * the two views never disagree about sequence.
 */
export default function TaskList({ tasks, onOpen, includeArchived = false, emptyTitle = 'No tasks here' }) {
  const rows = useMemo(() => {
    const rank = Object.fromEntries(COLUMNS.map((c, i) => [c.status, i]))
    return tasks
      .filter((t) => includeArchived || !t.archived)
      .slice()
      .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (a.order ?? 0) - (b.order ?? 0))
  }, [tasks, includeArchived])

  if (!rows.length) {
    return <EmptyState card icon={CheckCircleIcon} title={emptyTitle} description='Tasks assigned to you will show up here.' />
  }

  return (
    <Panel padded={false}>
      <div className='divide-y divide-border/60'>
        {rows.map((t) => (
          <button key={t._id} type='button' onClick={() => onOpen(t)}
            className='w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-surface-hover transition-colors'>
            <Badge variant={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status] || t.status}</Badge>
            {t.archived && <Badge>archived</Badge>}
            <Badge className='hidden md:inline-flex'>{taskTypeLabel(t.task_type)}</Badge>
            <span className={`text-body flex-1 min-w-0 truncate ${t.status === 'done' || t.archived ? 'text-ink-muted' : ''}`}>{t.title}</span>
            {t.status !== 'done' && (
              <span className='hidden lg:flex items-center gap-2 w-28 shrink-0'>
                <span className='h-1.5 flex-1 rounded-full bg-surface-sunken overflow-hidden'>
                  <span className='block h-full rounded-full bg-primary' style={{ width: `${Math.max(0, Math.min(100, t.progress || 0))}%` }} />
                </span>
                <span className='text-tag text-ink-subtle tabular-nums w-8 text-right'>{t.progress || 0}%</span>
              </span>
            )}
            <span className='hidden sm:inline-flex items-center gap-1.5 w-40 shrink-0'>
              {t.assignee_uid
                ? (<><UserInitialsAvatar email={t.assignee_label || t.assignee_uid} size='sm' className='!w-[22px] !h-[22px]' />
                    <span className='text-tag text-ink-subtle truncate'>{t.assignee_label || t.assignee_uid}</span></>)
                : <span className='text-tag text-ink-subtle'>unassigned</span>}
            </span>
            <span className='text-tag text-ink-subtle tabular-nums w-14 text-right shrink-0'>{fmtDay(t.updated_at)}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}
