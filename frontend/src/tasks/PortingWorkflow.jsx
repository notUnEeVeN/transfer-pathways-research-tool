import React, { useMemo, useState } from 'react'
import {
  ArrowDownTrayIcon, ArrowPathIcon, CheckIcon, ClockIcon, LockClosedIcon,
  PencilSquareIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, CompletionCheck, Textarea } from '../components/ui'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import {
  currentStageIndex, isStageComplete, stagesForTask,
} from './taskWorkflow'
import { groupEventsByWeek } from './taskHistory'

const fmtWhen = (value) => (value
  ? new Date(value).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  : '')

const stageLabel = (stages, key) => stages.find((stage) => stage.key === key)?.label || key

const logNotesForStage = (task, stageKey, state) => {
  const events = (task.workflow_log || []).filter((event) => (
    event.stage === stageKey
    && (event.action === 'noted' || event.action === 'completed')
    && typeof event.note === 'string'
    && event.note.trim()
  ))
  const stateNoteIsLogged = state?.note && events.some((event) => event.note === state.note)
  if (state?.note && !stateNoteIsLogged) {
    events.unshift({
      _id: `state-note:${stageKey}`,
      stage: stageKey,
      action: 'completed',
      note: state.note,
      by: state.completed_by,
      by_label: state.completed_by_label,
      at: state.completed_at,
      migrated: state.migrated,
    })
  }
  return events
}

const currentCycleNotes = (task, stageKey) => {
  const log = task.workflow_log || []
  let cycleStart = -1
  log.forEach((event, index) => {
    if (event.action === 'reopened'
      && (event.stage === stageKey || event.affected_stages?.includes(stageKey))) {
      cycleStart = index
    }
  })
  return log.slice(cycleStart + 1).filter((event) => (
    event.stage === stageKey
    && (event.action === 'noted' || event.action === 'completed')
    && typeof event.note === 'string'
    && event.note.trim()
  ))
}

const eventAction = (event) => {
  if (event.action === 'noted') return 'added a note to'
  if (event.action === 'reopened') return 'reopened'
  return 'completed'
}

export default function PortingWorkflow({
  task, me, roster = [], onAddStageNote, onCompleteStage, onReopenStage,
  onCopyHistory, onExportHistory,
}) {
  const stages = stagesForTask(task)
  const activeIndex = currentStageIndex(task)
  const completedCount = activeIndex === -1 ? stages.length : activeIndex
  const progress = Math.max(0, Math.min(100, task.progress || 0))
  const [drafts, setDrafts] = useState({})
  const [noteStage, setNoteStage] = useState(null)
  const [reopening, setReopening] = useState(null)
  const [busyAction, setBusyAction] = useState(null)
  const [error, setError] = useState(null)

  const names = useMemo(() => new Map(roster.map((person) => [person.uid, person.label])), [roster])
  const creatorLabel = task.created_by_label || names.get(task.created_by) || 'The task creator'
  const actorLabel = (uid, storedLabel) => storedLabel || names.get(uid) || uid || 'Unknown teammate'
  const setDraft = (key, value) => setDrafts((current) => ({ ...current, [key]: value }))

  const saveNote = async (stage, active) => {
    const note = (drafts[stage.key] || '').trim()
    if (!note) { setError({ stage: stage.key, message: 'Write a note before saving.' }); return }
    setBusyAction(`note:${stage.key}`)
    setError(null)
    try {
      await onAddStageNote(task._id, stage.key, note)
      setDraft(stage.key, '')
      if (!active) setNoteStage(null)
    } catch (err) {
      setError({ stage: stage.key, message: err?.response?.data?.error || 'Could not save this note.' })
    } finally {
      setBusyAction(null)
    }
  }

  const complete = async (stage, savedNotes) => {
    const draft = (drafts[stage.key] || '').trim()
    if (!draft && savedNotes.length === 0) {
      setError({ stage: stage.key, message: 'Add at least one note before completing this stage.' })
      return
    }
    if (stage.requiresPeer && !draft && !savedNotes.some((event) => event.by === me?.uid)) {
      setError({ stage: stage.key, message: 'Add your review note before approving this task.' })
      return
    }

    setBusyAction(`complete:${stage.key}`)
    setError(null)
    try {
      if (draft) {
        await onAddStageNote(task._id, stage.key, draft)
        setDraft(stage.key, '')
      }
      await onCompleteStage(task._id, stage.key)
    } catch (err) {
      setError({ stage: stage.key, message: err?.response?.data?.error || 'Could not complete this stage.' })
    } finally {
      setBusyAction(null)
    }
  }

  const reopen = async (stage) => {
    const key = `reopen:${stage.key}`
    const note = (drafts[key] || '').trim()
    if (!note) { setError({ stage: stage.key, message: 'Add a reason before reopening this stage.' }); return }
    setBusyAction(key)
    setError(null)
    try {
      await onReopenStage(task._id, stage.key, note)
      setDraft(key, '')
      setReopening(null)
    } catch (err) {
      setError({ stage: stage.key, message: err?.response?.data?.error || 'Could not reopen this stage.' })
    } finally {
      setBusyAction(null)
    }
  }

  const log = task.workflow_log || []
  const logWeeks = groupEventsByWeek(log, task.created_at, { descending: true })

  return (
    <div>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h3 className='text-heading'>Porting workflow</h3>
          <p className='text-caption text-ink-subtle mt-0.5'>{completedCount} of {stages.length} stages complete</p>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-1'>
          {onCopyHistory && (
            <Button size='sm' variant='ghost' leadingIcon={SparklesIcon} onClick={onCopyHistory}>Copy for AI</Button>
          )}
          {onExportHistory && (
            <Button size='sm' variant='ghost' leadingIcon={ArrowDownTrayIcon} onClick={onExportHistory}>Export</Button>
          )}
          <span className='text-heading text-primary tabular-nums ml-2'>{progress}%</span>
        </div>
      </div>
      <div className='mt-3 h-2 rounded-full bg-surface-sunken overflow-hidden' role='progressbar'
        aria-label='Task progress' aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span className={`block h-full rounded-full transition-[width] duration-300 ${progress === 100 ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${progress}%` }} />
      </div>

      <ol className='mt-6'>
        {stages.map((stage, index) => {
          const state = task.workflow_stages?.[stage.key]
          const completeStage = isStageComplete(task, stage.key)
          const active = index === activeIndex
          const locked = activeIndex !== -1 && index > activeIndex
          const peerBlocked = active && stage.requiresPeer && me?.uid === task.created_by
          const completedAfter = stages.slice(index + 1).filter((later) => isStageComplete(task, later.key)).length
          const stageNotes = logNotesForStage(task, stage.key, state)
          const savedNotes = currentCycleNotes(task, stage.key)
          const showComposer = reopening !== stage.key && (active || noteStage === stage.key)
          return (
            <li key={stage.key} className='relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0'>
              {index < stages.length - 1 && (
                <span className={`absolute left-[15px] top-8 bottom-0 w-px ${completeStage ? 'bg-success/35' : 'bg-border'}`} aria-hidden />
              )}
              <div className='relative z-1 pt-0.5'>
                {completeStage ? (
                  <CompletionCheck label={`${stage.label} complete`} />
                ) : (
                  <span className={`grid place-items-center w-8 h-8 rounded-full border text-tag tabular-nums ${
                    active ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface-muted text-ink-subtle'
                  }`}>
                    {locked ? <LockClosedIcon className='w-3.5 h-3.5' /> : index + 1}
                  </span>
                )}
              </div>

              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2 min-h-7'>
                  <h4 className={`text-body-strong ${locked ? 'text-ink-muted' : ''}`}>{stage.label}</h4>
                  {state?.migrated && <Badge>Imported completion</Badge>}
                  {stageNotes.length > 0 && (
                    <span className='text-tag text-ink-subtle ml-auto'>{stageNotes.length} {stageNotes.length === 1 ? 'note' : 'notes'}</span>
                  )}
                </div>
                <p className='text-caption text-ink-subtle mt-0.5'>{stage.description}</p>

                {stageNotes.length > 0 && (
                  <div className={`mt-3 pl-3 border-l-2 space-y-3 ${completeStage ? 'border-success/30' : 'border-primary/25'}`}>
                    {stageNotes.map((entry) => (
                      <div key={entry._id}>
                        <p className='text-body whitespace-pre-wrap break-words'>{entry.note}</p>
                        <div className='mt-1 flex items-center gap-1.5'>
                          <UserInitialsAvatar email={actorLabel(entry.by, entry.by_label)} size='sm'
                            className='!w-[20px] !h-[20px]' />
                          <span className='text-tag text-ink-subtle'>
                            {actorLabel(entry.by, entry.by_label)} · {fmtWhen(entry.at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {completeStage && reopening !== stage.key && (
                  <div className='mt-3 flex flex-wrap items-center gap-2'>
                    <span className='text-tag text-ink-subtle'>
                      Completed by {actorLabel(state.completed_by, state.completed_by_label)} · {fmtWhen(state.completed_at)}
                    </span>
                    <span className='ml-auto inline-flex items-center gap-1'>
                      {noteStage !== stage.key && (
                        <Button size='sm' variant='ghost' leadingIcon={PencilSquareIcon}
                          onClick={() => { setNoteStage(stage.key); setError(null) }}>Add note</Button>
                      )}
                      <Button size='sm' variant='ghost' leadingIcon={ArrowPathIcon}
                        onClick={() => { setReopening(stage.key); setNoteStage(null); setError(null) }}>
                        Reopen
                      </Button>
                    </span>
                  </div>
                )}

                {reopening === stage.key && (
                  <div className='mt-3 space-y-2'>
                    <Textarea label='Reason for reopening' rows={2}
                      value={drafts[`reopen:${stage.key}`] || ''}
                      onChange={(event) => setDraft(`reopen:${stage.key}`, event.target.value)}
                      placeholder='What changed or needs another pass?'
                      error={error?.stage === stage.key ? error.message : undefined} />
                    {completedAfter > 0 && (
                      <p className='text-caption text-conservative'>This will also reopen {completedAfter} later {completedAfter === 1 ? 'stage' : 'stages'}.</p>
                    )}
                    <div className='flex justify-end gap-2'>
                      <Button size='sm' variant='ghost' onClick={() => { setReopening(null); setError(null) }}>Cancel</Button>
                      <Button size='sm' variant='secondary' leadingIcon={ArrowPathIcon}
                        loading={busyAction === `reopen:${stage.key}`} onClick={() => reopen(stage)}>Reopen stage</Button>
                    </div>
                  </div>
                )}

                {showComposer && (
                  <div className='mt-3 space-y-2'>
                    <Textarea label={stage.requiresPeer && active ? 'Review note' : 'Stage note'} rows={3}
                      value={drafts[stage.key] || ''}
                      onChange={(event) => setDraft(stage.key, event.target.value)}
                      placeholder={stage.notePrompt}
                      error={error?.stage === stage.key ? error.message : undefined} />
                    <div className='flex flex-wrap justify-end gap-2'>
                      {!active && (
                        <Button size='sm' variant='ghost' onClick={() => { setNoteStage(null); setError(null) }}>Cancel</Button>
                      )}
                      <Button size='sm' variant='secondary' leadingIcon={PencilSquareIcon}
                        loading={busyAction === `note:${stage.key}`}
                        disabled={Boolean(busyAction) && busyAction !== `note:${stage.key}`}
                        onClick={() => saveNote(stage, active)}>Save note</Button>
                      {active && !peerBlocked && (
                        <Button size='sm' leadingIcon={CheckIcon}
                          loading={busyAction === `complete:${stage.key}`}
                          disabled={Boolean(busyAction) && busyAction !== `complete:${stage.key}`}
                          onClick={() => complete(stage, savedNotes)}>
                          {stage.requiresPeer ? 'Approve task' : 'Complete stage'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {!completeStage && !showComposer && (
                  <div className='mt-2 flex flex-wrap items-center gap-2'>
                    {locked && <p className='text-tag text-ink-subtle'>Complete the previous stage before completing this one.</p>}
                    <Button size='sm' variant='ghost' leadingIcon={PencilSquareIcon} className='ml-auto'
                      onClick={() => { setNoteStage(stage.key); setError(null) }}>Add note</Button>
                  </div>
                )}

                {peerBlocked && (
                  <div className='mt-3 rounded-md bg-surface-muted px-3 py-2.5 flex items-start gap-2'>
                    <ClockIcon className='w-4 h-4 text-ink-subtle mt-0.5 shrink-0' />
                    <p className='text-caption text-ink-muted'>Waiting for another teammate. {creatorLabel} cannot approve their own task.</p>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {log.length > 0 && (
        <section className='mt-7 pt-5 border-t border-border'>
          <div className='flex items-center gap-2'>
            <ClockIcon className='w-4 h-4 text-ink-subtle' />
            <h4 className='text-body-strong'>Workflow log</h4>
            <Badge>{log.length}</Badge>
          </div>
          <div className='mt-3 max-h-64 overflow-y-auto'>
            {logWeeks.map(({ week, events }) => (
              <section key={week} aria-labelledby={`workflow-week-${week}`} className='pb-3 last:pb-0'>
                <h5 id={`workflow-week-${week}`} className='text-label text-ink-muted py-1.5'>Week {week}</h5>
                <div className='divide-y divide-border'>
                  {events.map((event) => (
                    <div key={event._id} className='py-2.5 first:pt-1'>
                      <p className='text-tag text-ink-subtle'>
                        {actorLabel(event.by, event.by_label)} {eventAction(event)} {stageLabel(stages, event.stage)} · {fmtWhen(event.at)}
                      </p>
                      {event.note && <p className='text-body mt-0.5 whitespace-pre-wrap break-words'>{event.note}</p>}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
