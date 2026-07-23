import React, { useMemo, useState } from 'react'
import { CheckIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { Badge, Button, Checkbox, EmptyState } from '../components/ui'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import {
  isAwaitingVerification, nextStage, taskTypeBadgeVariant, taskTypeLabel,
} from './taskWorkflow'

// Compact relative age — "3h", "2d", "5w" — enough to spot a stale item.
function ageLabel(task) {
  const then = Date.parse(task?.updated_at)
  if (Number.isNaN(then)) return ''
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  return `${Math.round(days / 7)}w`
}

/**
 * VerificationQueue — a dense, scannable table of everything awaiting
 * verification, built for burning through a high-volume backlog that a vertical
 * board column can't hold.
 *
 * Each row's "Stage" says what Approve does: complete the task's current
 * verification stage (Self-verify or Team approval). The server enforces the
 * peer rule, so an approval you aren't allowed to make surfaces as an error
 * rather than being hidden here. Select rows to approve them in one batch.
 */
export default function VerificationQueue({
  tasks = [], me = null, onOpen, onApprove, onApproveMany, onNeedsWork, busy = false,
}) {
  const rows = useMemo(
    () => tasks.filter((task) => isAwaitingVerification(task) && !task.archived)
      .sort((a, b) => (Date.parse(a.updated_at) || 0) - (Date.parse(b.updated_at) || 0)),
    [tasks]
  )
  const [selected, setSelected] = useState(() => new Set())
  // Keep the selection to rows that still exist in the queue.
  const liveSelected = useMemo(() => {
    const ids = new Set(rows.map((task) => task._id))
    return [...selected].filter((id) => ids.has(id))
  }, [rows, selected])

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const allSelected = rows.length > 0 && liveSelected.length === rows.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((t) => t._id)))

  const approveSelected = async () => {
    const picked = rows.filter((task) => liveSelected.includes(task._id))
    if (!picked.length) return
    await onApproveMany?.(picked)
    setSelected(new Set())
  }

  if (rows.length === 0) {
    return <EmptyState card icon={CheckIcon} title='Nothing awaiting verification'
      description='Tasks arrive here once their work is published and self-verification or team approval is the next step.' />
  }

  return (
    <div className='surface-card overflow-hidden'>
      <div className='flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5'>
        <p className='text-body-strong'>Awaiting verification</p>
        <span className='chip bg-surface-sunken'>{rows.length}</span>
        {liveSelected.length > 0 && (
          <span className='ml-auto flex items-center gap-2'>
            <span className='text-caption text-ink-subtle'>{liveSelected.length} selected</span>
            <Button size='sm' leadingIcon={CheckIcon} loading={busy} onClick={approveSelected}>
              Approve {liveSelected.length}
            </Button>
          </span>
        )}
      </div>

      <div className='max-h-[70vh] overflow-y-auto'>
        <table className='w-full border-collapse text-left'>
          <thead className='sticky top-0 z-10 bg-surface'>
            <tr className='text-tag text-ink-subtle'>
              <th className='w-9 px-3 py-2'>
                <Checkbox checked={allSelected} onChange={toggleAll} aria-label='Select all' />
              </th>
              <th className='px-2 py-2 font-[650]'>Task</th>
              <th className='px-2 py-2 font-[650] hidden sm:table-cell'>Stage</th>
              <th className='px-2 py-2 font-[650] hidden md:table-cell'>Assignee</th>
              <th className='px-2 py-2 font-[650] text-right tabular'>Age</th>
              <th className='px-2 py-2' />
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const stage = nextStage(task)
              const checked = liveSelected.includes(task._id)
              return (
                <tr key={task._id}
                  className={`border-t border-border transition-colors hover:bg-surface-hover ${checked ? 'bg-primary-soft/40' : ''}`}>
                  <td className='px-3 py-2 align-middle'>
                    <Checkbox checked={checked} onChange={() => toggle(task._id)}
                      aria-label={`Select ${task.title}`} />
                  </td>
                  <td className='px-2 py-2 align-middle min-w-0'>
                    <button type='button' onClick={() => onOpen?.(task)}
                      className='flex items-center gap-2 text-left min-w-0 hover:text-primary'>
                      <Badge variant={taskTypeBadgeVariant(task.task_type)}>{taskTypeLabel(task.task_type)}</Badge>
                      <span className='text-caption text-ink truncate max-w-[28ch]'>{task.title}</span>
                    </button>
                  </td>
                  <td className='px-2 py-2 align-middle hidden sm:table-cell'>
                    <span className='text-tag text-ink-muted whitespace-nowrap'>{stage?.label || '—'}</span>
                  </td>
                  <td className='px-2 py-2 align-middle hidden md:table-cell'>
                    {task.assignee_uid ? (
                      <span className='inline-flex items-center gap-1.5 min-w-0'>
                        <UserInitialsAvatar email={task.assignee_label || task.assignee_uid} size='sm'
                          className='!w-[20px] !h-[20px]' />
                        <span className='text-tag text-ink-subtle truncate max-w-[12ch]'>
                          {task.assignee_label || task.assignee_uid}
                        </span>
                      </span>
                    ) : <span className='text-tag text-ink-subtle'>unassigned</span>}
                  </td>
                  <td className='px-2 py-2 align-middle text-right'>
                    <span className='text-tag text-ink-subtle tabular'>{ageLabel(task)}</span>
                  </td>
                  <td className='px-2 py-2 align-middle'>
                    <span className='flex items-center justify-end gap-1'>
                      <Button size='sm' variant='ghost' leadingIcon={ArrowUturnLeftIcon}
                        onClick={() => onNeedsWork?.(task)} title='Needs work'>
                        <span className='sr-only'>Needs work</span>
                      </Button>
                      <Button size='sm' variant='secondary' leadingIcon={CheckIcon} disabled={busy}
                        onClick={() => onApprove?.(task)}>
                        Approve
                      </Button>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
