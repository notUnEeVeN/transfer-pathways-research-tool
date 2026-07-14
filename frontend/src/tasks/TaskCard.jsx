import React from 'react'
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import { Badge } from '../components/ui'
import {
  currentStageIndex, isStageComplete, nextStepLabel, stagesForTask,
  taskTypeBadgeVariant, taskTypeLabel,
} from './taskWorkflow'

/**
 * TaskCard — one task on the board. Workflow stage progress is server-derived;
 * drag chrome lives in TaskBoard.
 */
export default function TaskCard({ task, onOpen, dragging = false }) {
  const notes = task.notes || []
  const workflowNotes = (task.workflow_log || []).filter((entry) => entry.note)
  const isDone = task.status === 'done'
  const nextLine = nextStepLabel(task)

  const stages = stagesForTask(task)
  // Up-next = first incomplete in list order; fills are per-stage (checklist
  // items complete in any order, so "everything before the cursor" is wrong).
  const upNextIndex = currentStageIndex(task)
  const doneN = stages.filter((stage) => isStageComplete(task, stage.key)).length

  return (
    <div
      role='button'
      tabIndex={0}
      data-task-drag-surface
      data-dragging={dragging || undefined}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() } }}
      style={dragging ? { boxShadow: 'var(--shadow-lg)' } : undefined}
      className={`w-full overflow-hidden text-left surface-card p-3 outline-none transition-[background-color,border-color,box-shadow] hover:bg-surface-hover hover:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/40 ${dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
    >
      <div className='flex flex-wrap items-center gap-1.5 mb-2'>
        <Badge variant={taskTypeBadgeVariant(task.task_type)}>{taskTypeLabel(task.task_type)}</Badge>
        {isDone && <Badge variant='success'>{task.task_type === 'data_verification' ? 'Done' : 'Approved'}</Badge>}
      </div>

      <p className={`text-body-strong leading-snug break-words ${isDone ? 'text-ink-muted line-through decoration-ink-subtle/60' : ''}`}>
        {task.title}
      </p>

      <div className='mt-2.5 flex items-center gap-2'>
        <div className='flex items-center'>
          {stages.map((stage, i) => (
            <React.Fragment key={stage.key}>
              <span
                title={stage.label}
                className={`w-3 h-3 rounded-pill box-border shrink-0 ${
                  isStageComplete(task, stage.key)
                    ? 'bg-primary border-2 border-primary'
                    : i === upNextIndex
                      ? 'bg-surface border-2 border-accent'
                      : 'bg-surface border-2 border-border-strong'
                }`}
              />
              {i < stages.length - 1 && <span className='w-[9px] h-[1.5px] bg-border-strong/60 shrink-0' />}
            </React.Fragment>
          ))}
        </div>
        <span className='ml-auto text-tag text-ink-subtle whitespace-nowrap tabular'>{doneN} of {stages.length}</span>
      </div>
      {!isDone && nextLine && <p className='text-tag text-ink-subtle mt-1.5 truncate'>{nextLine}</p>}

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
