import React, { useMemo, useState } from 'react'
import {
  ArrowPathIcon, CheckIcon, ClockIcon, LockClosedIcon, PencilSquareIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, IconButton, Textarea } from '../components/ui'
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

const eventAction = (event) => {
  if (event.action === 'noted') return 'added a note to'
  if (event.action === 'reopened') return 'reopened'
  if (event.forced) return 'force-approved'
  return 'completed'
}

// Porting's ordered, code-defined stage timeline. Checklist-shaped tasks
// render through VerificationChecklist instead. `admin` unlocks force-approval
// of the viewer's own task (the server enforces the same rule).
export default function PortingWorkflow({
  task, me, admin = false, roster = [], onAddStageNote, onCompleteStage, onReopenStage,
  onDeleteStageNote, onResolveStageNote,
}) {
  const stages = stagesForTask(task)
  const activeIndex = currentStageIndex(task)
  const completedCount = stages.filter((stage) => isStageComplete(task, stage.key)).length
  const progress = Math.max(0, Math.min(100, task.progress || 0))
  const [drafts, setDrafts] = useState({})
  const [noteStage, setNoteStage] = useState(null)
  const [reopening, setReopening] = useState(null)
  const [busyAction, setBusyAction] = useState(null)
  const [busyNote, setBusyNote] = useState(null)
  const [error, setError] = useState(null)
  // Owners resolve feedback from other teammates. A note author may resolve
  // their own feedback only when it is on somebody else's task (or delete it).
  const viewerUid = me?.uid
  const isOwner = Boolean(viewerUid)
    && (viewerUid === task.assignee_uid || viewerUid === task.created_by)

  const names = useMemo(() => new Map(roster.map((person) => [person.uid, person.label])), [roster])
  const creatorLabel = task.created_by_label || names.get(task.created_by) || 'The task creator'
  const assigneeLabel = task.assignee_label || names.get(task.assignee_uid) || 'the assignee'
  const actorLabel = (uid, storedLabel) => storedLabel || names.get(uid) || uid || 'Unknown teammate'
  // Only the assignee may complete non-peer stages (an unassigned task has no
  // such signal, so anyone may — otherwise a task nobody claimed could never
  // move). The peer approval stage is the opposite: it must come from someone
  // who did NOT do the work, so both the creator and the assignee are excluded.
  const isCreator = viewerUid === task.created_by
  const isAssignee = viewerUid === task.assignee_uid
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

  const complete = async (stage) => {
    const draft = (drafts[stage.key] || '').trim()
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

  const removeNote = async (entry) => {
    setBusyNote(`delete:${entry._id}`)
    setError(null)
    try {
      await onDeleteStageNote(task._id, entry._id)
    } catch (err) {
      setError({ stage: entry.stage, message: err?.response?.data?.error || 'Could not delete this note.' })
    } finally {
      setBusyNote(null)
    }
  }

  const toggleResolve = async (entry, resolved) => {
    setBusyNote(`resolve:${entry._id}`)
    setError(null)
    try {
      await onResolveStageNote(task._id, entry._id, resolved)
    } catch (err) {
      setError({ stage: entry.stage, message: err?.response?.data?.error || 'Could not update this note.' })
    } finally {
      setBusyNote(null)
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
          <span className='text-heading text-success ml-2'>{progress}%</span>
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
          // An admin may force-approve their own task; the completion is
          // stamped as forced server-side so the log says what happened.
          const selfApproval = stage.requiresPeer && (isCreator || isAssignee)
          const forcing = selfApproval && admin
          const peerBlocked = active && selfApproval && !admin
          const canComplete = stage.requiresPeer
            ? (!isCreator && !isAssignee) || admin
            : (task.assignee_uid ? isAssignee : true)
          const completedAfter = stages.slice(index + 1).filter((later) => isStageComplete(task, later.key)).length
          const stageNotes = logNotesForStage(task, stage.key, state)
          const showComposer = reopening !== stage.key && (active || noteStage === stage.key)
          return (
            <li key={stage.key} className='relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0'>
              {index < stages.length - 1 && (
                <span className={`absolute left-[15px] top-8 bottom-0 w-px ${completeStage ? 'bg-success/35' : 'bg-border'}`} aria-hidden />
              )}
              <div className='relative z-1 pt-0.5'>
                {completeStage ? (
                  <span role='img' aria-label={`${stage.label} complete`}
                    className='mx-auto grid place-items-center w-6 h-6 rounded-pill bg-success border-[1.5px] border-success box-border'>
                    <CheckIcon className='w-3 h-3 text-on-primary' strokeWidth={2.5} aria-hidden='true' />
                  </span>
                ) : (
                  <span className={`mx-auto grid place-items-center w-6 h-6 rounded-pill border-[1.5px] box-border ${
                    active ? 'bg-surface border-border-strong text-ink-muted' : 'bg-surface-muted border-border text-ink-subtle'
                  }`}>
                    {locked
                      ? <LockClosedIcon className='w-3 h-3' />
                      : <span className='text-[11.5px] font-[650] tabular'>{index + 1}</span>}
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
                    {stageNotes.map((entry) => {
                      // Only iterative review notes ('noted') are deletable/resolvable —
                      // completion notes are part of the immutable stage record.
                      const manageable = entry.action === 'noted'
                      const isNoteAuthor = Boolean(viewerUid) && viewerUid === entry.by
                      const canDelete = manageable && Boolean(onDeleteStageNote) && isNoteAuthor
                      const canResolve = manageable && Boolean(onResolveStageNote)
                        && ((isOwner && !isNoteAuthor) || (!isOwner && isNoteAuthor))
                      const resolved = Boolean(entry.resolved)
                      return (
                        <div key={entry._id}>
                          <p className={`text-body whitespace-pre-wrap break-words ${resolved ? 'opacity-60' : ''}`}>{entry.note}</p>
                          <div className='mt-1 flex items-center gap-1.5'>
                            <UserInitialsAvatar email={actorLabel(entry.by, entry.by_label)} size='sm'
                              className='!w-[20px] !h-[20px]' />
                            <span className='text-tag text-ink-subtle'>
                              {actorLabel(entry.by, entry.by_label)} · {fmtWhen(entry.at)}
                            </span>
                            {resolved && <Badge variant='success'>Resolved</Badge>}
                            {(canResolve || canDelete) && (
                              <span className='ml-auto inline-flex items-center gap-1'>
                                {canResolve && (
                                  <Button size='sm' variant='ghost' leadingIcon={CheckIcon}
                                    loading={busyNote === `resolve:${entry._id}`}
                                    onClick={() => toggleResolve(entry, !resolved)}>
                                    {resolved ? 'Resolved ✓' : 'Resolve'}
                                  </Button>
                                )}
                                {canDelete && (
                                  <IconButton icon={TrashIcon} label='Delete note' size='sm' variant='danger'
                                    disabled={busyNote === `delete:${entry._id}`}
                                    onClick={() => removeNote(entry)} />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {completeStage && reopening !== stage.key && (
                  <div className='mt-3 flex flex-wrap items-center gap-2'>
                    <span className='text-tag text-ink-subtle'>
                      Completed by {actorLabel(state.completed_by, state.completed_by_label)} · {fmtWhen(state.completed_at)}
                    </span>
                    {state.forced && <Badge variant='conservative'>Admin override</Badge>}
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
                    <Textarea label={`${stage.requiresPeer && active ? 'Review note' : 'Stage note'} (optional)`} rows={3}
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
                      {active && canComplete && (
                        <Button size='sm' leadingIcon={CheckIcon}
                          loading={busyAction === `complete:${stage.key}`}
                          disabled={Boolean(busyAction) && busyAction !== `complete:${stage.key}`}
                          onClick={() => complete(stage)}>
                          {forcing ? 'Force approve' : stage.requiresPeer ? 'Approve task' : 'Complete stage'}
                        </Button>
                      )}
                      {active && !canComplete && !stage.requiresPeer && (
                        <span className='text-[12.5px] text-ink-subtle'>Only {assigneeLabel} can complete this stage.</span>
                      )}
                    </div>
                    {active && forcing && (
                      <p className='text-caption text-conservative'>
                        Admin override — this approves your own work and is logged as a forced approval.
                      </p>
                    )}
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
                    <p className='text-caption text-ink-muted'>
                      Waiting for another teammate. {isCreator
                        ? `${creatorLabel} cannot approve their own task.`
                        : "A teammate who didn't do the work approves this stage."}
                    </p>
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
            <Badge className='tabular'>{log.length}</Badge>
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
