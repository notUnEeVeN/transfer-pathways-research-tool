import React from 'react'
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import { Badge } from '../components/ui'
import { nextStage, taskTypeLabel } from './taskWorkflow'

/**
 * TaskCard — one task on the board. Workflow stage progress is server-derived;
 * drag chrome lives in TaskBoard.
 */
export default function TaskCard({ task, onOpen }) {
  const notes = task.notes || []
  const workflowNotes = (task.workflow_log || []).filter((entry) => entry.note)
  const progress = Math.max(0, Math.min(100, task.progress || 0))
  const isDone = task.status === 'done'
  const upcoming = nextStage(task)

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() } }}
      className='w-full text-left surface-card p-3 cursor-pointer transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary/40 outline-none'
    >
      <div className='flex flex-wrap items-center gap-1.5 mb-2'>
        <Badge variant='accent'>{taskTypeLabel(task.task_type)}</Badge>
        {isDone && <Badge variant='success'>Approved</Badge>}
      </div>

      <p className={`text-body-strong leading-snug break-words ${isDone ? 'text-ink-muted line-through decoration-ink-subtle/60' : ''}`}>
        {task.title}
      </p>

      {!isDone && (
        <div className='mt-2.5'>
          <div className='flex items-center gap-2'>
            <span className='flex-1 h-1.5 rounded-full bg-surface-sunken overflow-hidden'>
              <span className='block h-full rounded-full bg-primary transition-[width] duration-300' style={{ width: `${progress}%` }} />
            </span>
            <span className='text-tag text-ink-subtle tabular-nums'>{progress}%</span>
          </div>
          {upcoming && <p className='text-tag text-ink-subtle mt-1.5 truncate'>Next: {upcoming.label}</p>}
        </div>
      )}

      <div className='mt-2.5 flex items-center gap-2 min-h-[1.25rem]'>
        {task.assignee_uid ? (
          <span className='inline-flex items-center gap-1.5 min-w-0'>
            <UserInitialsAvatar email={task.assignee_label || task.assignee_uid} size='sm' className='!w-[22px] !h-[22px]' />
            <span className='text-tag text-ink-subtle truncate max-w-[10rem]'>{task.assignee_label || task.assignee_uid}</span>
          </span>
        ) : (
          <span className='text-tag text-ink-subtle'>unassigned</span>
        )}
        {notes.length + workflowNotes.length > 0 && (
          <span className='ml-auto inline-flex items-center gap-1 text-tag text-ink-subtle'>
            <ChatBubbleLeftIcon className='w-3.5 h-3.5' />{notes.length + workflowNotes.length}
          </span>
        )}
      </div>
    </div>
  )
}
