import React, { useEffect, useMemo, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import {
  ArrowUturnLeftIcon, Bars2Icon, CheckIcon, PencilSquareIcon, PlusIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { Button, IconButton, Textarea } from '../components/ui'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import { isStageComplete, stagesForTask } from './taskWorkflow'

const fmtWhen = (value) => (value
  ? new Date(value).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  : '')

// One note per checkpoint (the redesign's contract): the latest logged note
// for the item, falling back to the completion-snapshot note.
const latestNoteFor = (task, stageKey, state) => {
  const events = (task.workflow_log || []).filter((event) => (
    event.stage === stageKey
    && (event.action === 'noted' || event.action === 'completed')
    && typeof event.note === 'string'
    && event.note.trim()
  ))
  const last = events.at(-1)
  if (last) return last
  if (state?.note) {
    return {
      _id: `state-note:${stageKey}`,
      action: 'completed',
      note: state.note,
      by: state.completed_by,
      by_label: state.completed_by_label,
      at: state.completed_at,
    }
  }
  return null
}

/**
 * VerificationChecklist — the Data Verification task's right column.
 * User-authored checkpoints verified in any order: segmented progress,
 * a pulsing up-next node, one-click verify/undo (node or button), one
 * editable note per checkpoint, inline add/remove, and an explicit
 * ready-to-close banner once every checkpoint is verified.
 */
export default function VerificationChecklist({
  task, me, roster = [], onCompleteStage, onReopenStage, onAddStageNote,
  onDeleteStageNote, onPatch, onClose = null,
}) {
  const allStages = stagesForTask(task)
  const [noteStage, setNoteStage] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [newItem, setNewItem] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  // Drag-to-reorder: the displayed order is local while a drag is live, then
  // the settled order is patched into checklist_items (keys ride along, so
  // notes/completions follow their item). The server list is the source of
  // truth again the moment it confirms.
  const serverKeys = useMemo(() => allStages.map((stage) => stage.key), [task.checklist_items])
  const [orderKeys, setOrderKeys] = useState(serverKeys)
  useEffect(() => { setOrderKeys(serverKeys) }, [serverKeys])
  const stages = useMemo(() => {
    const byKey = new Map(allStages.map((stage) => [stage.key, stage]))
    const ordered = orderKeys.map((key) => byKey.get(key)).filter(Boolean)
    // Items the local order doesn't know yet (just added) append at the end.
    for (const stage of allStages) if (!orderKeys.includes(stage.key)) ordered.push(stage)
    return ordered
  }, [allStages, orderKeys])

  const upNextIndex = stages.findIndex((stage) => !isStageComplete(task, stage.key))
  const doneCount = stages.filter((stage) => isStageComplete(task, stage.key)).length
  const allDone = stages.length > 0 && doneCount === stages.length
  const pct = Math.max(0, Math.min(100, task.progress || 0))

  const names = useMemo(() => new Map(roster.map((person) => [person.uid, person.label])), [roster])
  const actorLabel = (uid, storedLabel) => storedLabel || names.get(uid) || uid || 'Unknown teammate'
  const viewerUid = me?.uid
  // Server rule mirrored: an assigned task's checkpoints are the assignee's
  // to verify; unassigned tasks are anyone's.
  const canVerify = task.assignee_uid ? viewerUid === task.assignee_uid : true

  const run = async (key, action, failMessage) => {
    setBusy(key)
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(err?.response?.data?.error || failMessage)
      return false
    } finally {
      setBusy(null)
    }
  }

  const verify = (stage) => run(`verify:${stage.key}`,
    () => onCompleteStage(task._id, stage.key), 'Could not verify this checkpoint.')
  const undo = (stage) => run(`undo:${stage.key}`,
    () => onReopenStage(task._id, stage.key), 'Could not un-verify this checkpoint.')
  const toggle = (stage) => (isStageComplete(task, stage.key) ? undo(stage) : verify(stage))

  const openNote = (stage) => {
    const existing = latestNoteFor(task, stage.key, task.workflow_stages?.[stage.key])
    setNoteDraft(existing?.note || '')
    setNoteStage(stage.key)
    setError(null)
  }
  const saveNote = async (stage) => {
    const text = noteDraft.trim()
    const existing = latestNoteFor(task, stage.key, task.workflow_stages?.[stage.key])
    const ok = await run(`note:${stage.key}`, async () => {
      if (text) {
        if (text !== existing?.note) await onAddStageNote(task._id, stage.key, text)
      } else if (existing && existing.action === 'noted' && existing.by === viewerUid) {
        // Saving an empty note clears it (only your own saved notes can clear).
        await onDeleteStageNote(task._id, existing._id)
      }
    }, 'Could not save this note.')
    if (ok) { setNoteStage(null); setNoteDraft('') }
  }

  const addItem = async () => {
    const label = newItem.trim()
    if (!label) return
    const ok = await run('add-item',
      () => onPatch(task._id, { checklist_items: [...(task.checklist_items || []), label] }),
      'Could not add the checkpoint.')
    if (ok) setNewItem('')
  }
  const removeItem = (stage) => run(`remove:${stage.key}`,
    () => onPatch(task._id, {
      checklist_items: (task.checklist_items || []).filter((item) => item.key !== stage.key),
    }),
    'Could not remove the checkpoint.')

  const markDone = async () => {
    const ok = await run('mark-done',
      () => onPatch(task._id, { status: 'done' }), 'Could not mark the task done.')
    if (ok) onClose?.()
  }

  // Reordering is disabled on a done task — the server treats checklist
  // edits on done tasks as "reopen something first".
  const canReorder = task.status !== 'done' && stages.length > 1
  const commitOrder = () => {
    const current = task.checklist_items || []
    if (orderKeys.join('|') === current.map((item) => item.key).join('|')) return
    const byKey = new Map(current.map((item) => [item.key, item]))
    const next = orderKeys.map((key) => byKey.get(key)).filter(Boolean)
    for (const item of current) if (!orderKeys.includes(item.key)) next.push(item)
    run('reorder', () => onPatch(task._id, { checklist_items: next }), 'Could not reorder the checkpoints.')
  }

  return (
    <div>
      <div className='flex flex-wrap items-end gap-3'>
        <div>
          <h3 className='text-heading'>Verification checkpoints</h3>
          <p className='text-caption text-ink-subtle mt-0.5'>{doneCount} of {stages.length} checkpoints verified</p>
        </div>
        <span className='ml-auto text-[22px] font-[650] tracking-[-.01em] leading-none text-success'>{pct}%</span>
      </div>

      {/* Segmented progress: one pill per checkpoint. */}
      <div className='mt-3 flex gap-1' role='progressbar' aria-label='Checkpoints verified'
        aria-valuemin={0} aria-valuemax={stages.length} aria-valuenow={doneCount}>
        {stages.map((stage, i) => (
          <span key={stage.key} className={`flex-1 h-[7px] rounded-pill transition-colors duration-200 ${
            isStageComplete(task, stage.key) ? 'bg-success' : i === upNextIndex ? 'bg-accent' : 'bg-surface-sunken'
          }`} />
        ))}
      </div>

      {allDone && task.status !== 'done' && (
        <div className='mt-4 flex items-center gap-3 bg-primary-soft border border-accent rounded-[12px] px-3.5 py-3'>
          <span className='shrink-0 grid place-items-center w-[26px] h-[26px] rounded-pill bg-primary'>
            <CheckIcon className='w-3.5 h-3.5 text-accent' strokeWidth={2.5} />
          </span>
          <span className='text-[13px] font-[600] min-w-0'>Every checkpoint is verified — this task is ready to close.</span>
          <Button className='ml-auto shrink-0' size='sm' loading={busy === 'mark-done'} onClick={markDone}>
            Mark task done
          </Button>
        </div>
      )}
      {error && <p className='text-caption text-danger mt-3'>{error}</p>}

      <Reorder.Group axis='y' as='div' values={orderKeys} onReorder={setOrderKeys} className='mt-5 flex flex-col'>
        {stages.map((stage, index) => {
          const state = task.workflow_stages?.[stage.key]
          const done = isStageComplete(task, stage.key)
          const isNext = index === upNextIndex
          const note = latestNoteFor(task, stage.key, state)
          const noteOpen = noteStage === stage.key
          return (
            <CheckpointRow key={stage.key} value={stage.key} onDrop={commitOrder} draggable={canReorder}>
              <div className='flex flex-col items-center'>
                <button
                  type='button'
                  title={done ? 'Click to un-verify' : 'Click to verify'}
                  disabled={Boolean(busy) || (!done && !canVerify)}
                  onClick={() => toggle(stage)}
                  className={`shrink-0 w-7 h-7 rounded-pill box-border grid place-items-center cursor-pointer border-2 transition-colors ${
                    done
                      ? 'bg-success border-success'
                      : isNext
                        ? 'bg-surface border-accent animate-[pmtPulse_2.4s_ease-out_infinite]'
                        : 'bg-surface border-border'
                  }`}
                >
                  {done
                    ? <CheckIcon className='w-3.5 h-3.5 text-accent' strokeWidth={2.5} aria-label={`${stage.label} verified`} />
                    : <span className={`text-[11.5px] font-[650] ${isNext ? 'text-ink-muted' : 'text-ink-subtle'}`}>{index + 1}</span>}
                </button>
                <span className={`w-[2px] flex-1 min-h-[16px] rounded-[1px] mt-1 ${done ? 'bg-success/60' : 'bg-border'}`} aria-hidden />
              </div>

              <div className='flex-1 min-w-0 flex flex-col gap-2.5 pb-8'>
                <div className='flex flex-wrap items-center gap-2.5 min-h-7'>
                  <span className={`text-[14.5px] break-words ${
                    done ? 'font-[550] text-ink-muted' : isNext ? 'font-[650]' : 'font-[600]'
                  }`}>{stage.label}</span>
                  {isNext && (
                    <span className='shrink-0 text-[10.5px] font-bold tracking-[.06em] uppercase text-primary bg-accent rounded-pill px-[9px] py-[2.5px]'>Up next</span>
                  )}
                  {done && state?.completed_at && (
                    <span className='shrink-0 text-tag text-ink-subtle'>
                      {actorLabel(state.completed_by, state.completed_by_label)} · {fmtWhen(state.completed_at)}
                    </span>
                  )}
                  <span className='ml-auto shrink-0 inline-flex items-center gap-1.5'>
                    {done ? (
                      <Button size='sm' variant='ghost' leadingIcon={ArrowUturnLeftIcon}
                        loading={busy === `undo:${stage.key}`} disabled={Boolean(busy) && busy !== `undo:${stage.key}`}
                        onClick={() => undo(stage)}>Undo</Button>
                    ) : (
                      <>
                        {!noteOpen && (
                          <Button size='sm' variant='ghost' leadingIcon={PencilSquareIcon}
                            onClick={() => openNote(stage)}>Note</Button>
                        )}
                        {canVerify && (
                          <Button size='sm' variant={isNext ? 'primary' : 'secondary'} leadingIcon={CheckIcon}
                            loading={busy === `verify:${stage.key}`} disabled={Boolean(busy) && busy !== `verify:${stage.key}`}
                            onClick={() => verify(stage)}>Verify</Button>
                        )}
                      </>
                    )}
                    <IconButton icon={XMarkIcon} label={`Remove ${stage.label}`} size='sm'
                      disabled={busy === `remove:${stage.key}`}
                      onClick={() => removeItem(stage)} />
                  </span>
                </div>

                {note && !noteOpen && (
                  <div className='border-l-2 border-border pl-3 flex flex-col gap-1.5'>
                    <p className='text-[13px] leading-relaxed whitespace-pre-wrap break-words'>{note.note}</p>
                    <span className='inline-flex items-center gap-1.5'>
                      <UserInitialsAvatar email={actorLabel(note.by, note.by_label)} size='sm' className='!w-[18px] !h-[18px]' />
                      <span className='text-tag text-ink-subtle'>{actorLabel(note.by, note.by_label)} · {fmtWhen(note.at)}</span>
                    </span>
                  </div>
                )}

                {noteOpen && (
                  <div className='flex flex-col gap-2'>
                    <Textarea rows={2} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder='What did you check, and what did you find?' />
                    <div className='flex justify-end gap-2'>
                      <Button size='sm' variant='ghost' onClick={() => { setNoteStage(null); setNoteDraft('') }}>Cancel</Button>
                      <Button size='sm' variant='secondary' leadingIcon={PencilSquareIcon}
                        loading={busy === `note:${stage.key}`}
                        onClick={() => saveNote(stage)}>Save note</Button>
                    </div>
                  </div>
                )}
              </div>
            </CheckpointRow>
          )
        })}

        {/* Add checkpoint — the timeline's open end. */}
        <div className='flex gap-4 items-center'>
          <span className='shrink-0 w-7 h-7 rounded-pill box-border border-[1.5px] border-dashed border-border-strong grid place-items-center text-ink-subtle'>
            <PlusIcon className='w-3 h-3' strokeWidth={2} />
          </span>
          <div className='flex-1 min-w-0'>
            <input
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') addItem() }}
              placeholder='Add a checkpoint — a campus, dataset, or spot-check…'
              className='w-full bg-surface border border-border rounded-pill px-4 py-[9px] text-[13px] outline-none placeholder:text-ink-subtle focus:border-primary'
            />
          </div>
          <Button size='sm' variant='secondary' loading={busy === 'add-item'}
            disabled={!newItem.trim()} onClick={addItem}>Add</Button>
        </div>
      </Reorder.Group>
    </div>
  )
}

// One reorderable checkpoint row. Dragging is handle-only (the row is full of
// buttons), via a grip that fades in on hover along the row's left edge.
function CheckpointRow({ value, onDrop, draggable, children }) {
  const controls = useDragControls()
  return (
    <Reorder.Item as='div' value={value} dragListener={false} dragControls={controls}
      onDragEnd={onDrop} className='relative flex gap-4 group/row bg-surface'>
      {draggable && (
        <span
          onPointerDown={(event) => { event.preventDefault(); controls.start(event) }}
          title='Drag to reorder'
          className='absolute -left-5 top-1.5 p-0.5 cursor-grab active:cursor-grabbing touch-none select-none text-ink-subtle opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity'
        >
          <Bars2Icon className='w-3.5 h-3.5' />
        </span>
      )}
      {children}
    </Reorder.Item>
  )
}
