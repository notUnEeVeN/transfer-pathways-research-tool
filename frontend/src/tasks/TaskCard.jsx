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
export default function TaskCard({ task, onOpen, dragging = false, compact = false }) {
  const notes = task.notes || []
  const workflowNotes = (task.workflow_log || []).filter((entry) => entry.note)
  const noteCount = notes.length + workflowNotes.length
  const isDone = task.status === 'done'
  const nextLine = nextStepLabel(task)

  const stages = stagesForTask(task)
  // Up-next = first incomplete in list order; fills are per-stage (checklist
  // items complete in any order, so "everything before the cursor" is wrong).
  const upNextIndex = currentStageIndex(task)
  const doneN = stages.filter((stage) => isStageComplete(task, stage.key)).length

  // A slim two-line card so a long column holds many more before scrolling:
  // title + stage dots on top, type and assignee beneath. Full detail is one
  // click away in the modal. Audit fixes read as "N open", not progress.
  if (compact) {
    return (
      <div
        role='button'
        tabIndex={0}
        data-task-drag-surface
        data-dragging={dragging || undefined}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() } }}
        style={dragging ? { boxShadow: 'var(--shadow-lg)' } : undefined}
        className={`w-full overflow-hidden text-left surface-card px-3 py-2 outline-none transition-[background-color,border-color,box-shadow] hover:bg-surface-hover hover:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/40 ${dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
      >
        <div className='flex items-center gap-2 min-w-0'>
          <p className={`flex-1 min-w-0 text-caption font-[650] leading-snug truncate ${isDone ? 'text-ink-muted line-through decoration-ink-subtle/60' : ''}`}>
            {task.title}
          </p>
          {stages.length > 0 && (task.task_type === 'audit_fix' ? (
            <span className='shrink-0 text-tag text-ink-subtle whitespace-nowrap tabular'>{stages.length - doneN} open</span>
          ) : (
            <div className='flex items-center gap-[3px] shrink-0'>
              {stages.map((stage, i) => (
                <span key={stage.key} title={stage.label}
                  className={`w-2 h-2 rounded-pill ${
                    isStageComplete(task, stage.key) ? 'bg-primary'
                      : i === upNextIndex ? 'bg-surface border border-accent'
                        : 'bg-surface border border-border-strong'}`} />
              ))}
            </div>
          ))}
        </div>
        <div className='mt-1 flex items-center gap-2 min-w-0'>
          <Badge variant={taskTypeBadgeVariant(task.task_type)}>{taskTypeLabel(task.task_type)}</Badge>
          {task.assignee_uid && (
            <UserInitialsAvatar email={task.assignee_label || task.assignee_uid} size='sm' className='!w-[18px] !h-[18px]' />
          )}
          {noteCount > 0 && (
            <span className='ml-auto inline-flex items-center gap-1 text-tag text-ink-subtle'>
              <ChatBubbleLeftIcon className='w-3.5 h-3.5' />{noteCount}
            </span>
          )}
        </div>
      </div>
    )
  }

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
        {isDone && <Badge variant='success'>{task.task_type === 'porting' ? 'Approved' : 'Done'}</Badge>}
      </div>

      <p className={`text-body-strong leading-snug break-words ${isDone ? 'text-ink-muted line-through decoration-ink-subtle/60' : ''}`}>
        {task.title}
      </p>

      {stages.length > 0 && <div className='mt-2.5 flex items-center gap-2'>
        {task.task_type === 'audit_fix' ? (
          // A collection, not a pipeline: tier-colored dots, no connectors,
          // and the count reads as open fixes rather than progress-to-done.
          <>
            <div className='flex items-center gap-[5px] flex-wrap'>
              {stages.map((stage) => {
                const item = (task.checklist_items || []).find((i) => i.key === stage.key)
                const tier = item?.tier || (/— conservative$/.test(stage.label) ? 'conservative' : 'error')
                const done = isStageComplete(task, stage.key)
                return (
                  <span key={stage.key} title={stage.label}
                    className={`w-3 h-3 rounded-pill box-border shrink-0 ${done ? 'bg-surface-sunken' : ''}`}
                    style={done ? undefined : {
                      backgroundColor: tier === 'error' ? 'var(--color-danger-bright)' : 'var(--color-conservative-fill)',
                    }} />
                )
              })}
            </div>
            <span className='ml-auto text-tag text-ink-subtle whitespace-nowrap tabular'>
              {stages.length - doneN} open
            </span>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>}
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
