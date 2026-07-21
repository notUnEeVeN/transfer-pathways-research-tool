import React, { useMemo } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { Badge, EmptyState, Panel } from '../components/ui'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import { COLUMNS } from './TaskBoard'
import { isAwaitingVerification, taskTypeBadgeVariant, taskTypeLabel } from './taskWorkflow'

const STATUS_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.status, c.label]))
// Verification is a derived board state (stored status stays in_progress); its
// lavender pill sets it apart from the In progress success pill.
const STATUS_TONE = { todo: 'neutral', in_progress: 'success', verification: 'conservative', done: 'success' }

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
      <div>
        {rows.map((t) => {
          const displayStatus = isAwaitingVerification(t) ? 'verification' : t.status
          return (
          <button key={t._id} type='button' onClick={() => onOpen(t)}
            className='w-full text-left px-5 py-3 border-b border-border last:border-0 hover:bg-surface-hover cursor-pointer flex items-center gap-3 transition-colors'>
            <Badge variant={STATUS_TONE[displayStatus]}>{STATUS_LABEL[displayStatus] || displayStatus}</Badge>
            {t.archived && <Badge>archived</Badge>}
            <Badge variant={taskTypeBadgeVariant(t.task_type)} className='hidden md:inline-flex'>{taskTypeLabel(t.task_type)}</Badge>
            <span className={`text-caption font-semibold flex-1 min-w-0 truncate ${t.status === 'done' || t.archived ? 'ink-muted' : 'ink-default'}`}>{t.title}</span>
            {t.status !== 'done' && (t.task_type === 'audit_fix' ? (
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
        })}
      </div>
    </Panel>
  )
}
