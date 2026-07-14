import React, { useMemo, useState } from 'react'
import { ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline'
import { Button } from '../components/ui'
import { isStageComplete, stagesForTask } from './taskWorkflow'

const fmtWhen = (value) => (value
  ? new Date(value).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  : '')

const TIER_DOT = {
  error: 'var(--color-danger-bright)',
  conservative: 'var(--color-conservative-fill)',
}
const TIER_CHIP = {
  error: 'text-danger bg-danger-soft',
  conservative: 'text-conservative bg-conservative-soft',
}

// Items carry their verdict tier since the audit hook stamps it; older items
// fall back to the "— tier" suffix the label ends with.
const tierOf = (item) => item.tier
  || (/— conservative$/.test(item.label) ? 'conservative' : 'error')
// The row shows the label without its tier suffix (the chip carries that).
const displayLabel = (item) => item.label.replace(/ — (error|conservative)$/, '')

// The auditor's latest verdict note for an item (notes accrue on re-verdicts;
// the newest is the live context).
const latestNoteFor = (task, key) => (task.workflow_log || [])
  .filter((event) => event.stage === key && event.action === 'noted' && event.note?.trim())
  .at(-1) || null

// A regression chip shows when the item is open but has been machine-reopened.
const lastReopenFor = (task, key) => (task.workflow_log || [])
  .filter((event) => event.stage === key && event.action === 'reopened')
  .at(-1) || null

/**
 * AuditFixInbox — the Audit Fixes task's right column. A machine-fed inbox:
 * verdicts append items, correct re-audits auto-resolve them, and the task
 * closes itself when the last item resolves. No progress framing by design.
 */
export default function AuditFixInbox({ task, me, onCompleteStage, onReopenStage }) {
  const items = stagesForTask(task).map((stage) => {
    const item = (task.checklist_items || []).find((i) => i.key === stage.key) || stage
    const state = task.workflow_stages?.[stage.key]
    const done = isStageComplete(task, stage.key)
    return {
      key: stage.key,
      label: displayLabel(item),
      tier: tierOf(item),
      done,
      auto: done && state?.note === 'Re-audited correct.',
      state,
      note: latestNoteFor(task, stage.key),
      reopen: !done ? lastReopenFor(task, stage.key) : null,
    }
  })
  const open = items.filter((item) => !item.done)
  const resolved = items.filter((item) => item.done)
  const openErrors = open.filter((item) => item.tier === 'error')
  const openConservative = open.filter((item) => item.tier === 'conservative')
  const [showResolved, setShowResolved] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  // Fixing needs the data scripts, so the inbox belongs to its assignee (the
  // admin); everyone else reads it.
  const canAct = task.assignee_uid ? me?.uid === task.assignee_uid : true

  const run = async (key, action, failMessage) => {
    setBusy(key)
    setError(null)
    try { await action() } catch (err) { setError(err?.response?.data?.error || failMessage) } finally { setBusy(null) }
  }
  const markFixed = (item) => run(`fix:${item.key}`,
    () => onCompleteStage(task._id, item.key), 'Could not mark this fixed.')
  const reopen = (item) => run(`reopen:${item.key}`,
    () => onReopenStage(task._id, item.key), 'Could not reopen this fix.')

  const tierChips = useMemo(() => [
    { tier: 'error', n: openErrors.length, label: `${openErrors.length} error${openErrors.length === 1 ? '' : 's'}` },
    { tier: 'conservative', n: openConservative.length, label: `${openConservative.length} conservative` },
  ].filter((part) => part.n > 0), [openErrors.length, openConservative.length])

  const groups = [
    { tier: 'error', label: 'Errors', rows: openErrors },
    { tier: 'conservative', label: 'Conservative', rows: openConservative },
  ].filter((group) => group.rows.length > 0)

  return (
    <div>
      <div className='flex flex-wrap items-start gap-3'>
        <div>
          <h3 className='text-heading'>Fix inbox</h3>
          <p className='text-caption text-ink-subtle mt-0.5'>
            {open.length === 0 ? 'Nothing open' : `${open.length} open fix${open.length === 1 ? '' : 'es'}`}
          </p>
        </div>
        {tierChips.length > 0 && (
          <span className='ml-auto flex items-center gap-3 mt-1'>
            {tierChips.map((part) => (
              <span key={part.tier} className='inline-flex items-center gap-1.5'>
                <span className='w-[7px] h-[7px] rounded-pill' style={{ backgroundColor: TIER_DOT[part.tier] }} />
                <span className='text-tag text-ink-muted'>{part.label}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      <p className='text-tag text-ink-subtle mt-2.5 leading-relaxed'>
        Fed automatically by the Audit judge — a correct re-audit checks items off on its own.
      </p>
      {error && <p className='text-caption text-danger mt-2'>{error}</p>}

      {open.length === 0 && items.length > 0 && (
        <div className='mt-4 flex items-center gap-3 bg-primary-soft rounded-[12px] px-4 py-3.5'>
          <span className='shrink-0 grid place-items-center w-[26px] h-[26px] rounded-pill bg-primary'>
            <CheckIcon className='w-3.5 h-3.5 text-accent' strokeWidth={2.5} />
          </span>
          <div className='min-w-0'>
            <p className='text-[13px] font-[600]'>Inbox clear — everything flagged is fixed or re-audited correct.</p>
            <p className='text-tag text-ink-subtle mt-0.5'>
              {task.status === 'done'
                ? 'This task closed itself; new verdicts start a fresh one.'
                : 'The task closes itself; new verdicts start a fresh one.'}
            </p>
          </div>
        </div>
      )}

      <div className='mt-2 flex flex-col'>
        {groups.map((group) => (
          <div key={group.tier} className='flex flex-col'>
            <div className='flex items-center gap-2.5 pt-5 pb-2'>
              <span className='w-2 h-2 rounded-pill' style={{ backgroundColor: TIER_DOT[group.tier] }} />
              <span className='text-label text-[11px]'>{group.label}</span>
              <span className='text-[11.5px] font-[600] text-ink-muted bg-surface-sunken rounded-pill px-2 py-px'>
                {group.rows.length} open
              </span>
            </div>
            {group.rows.map((item) => (
              <div key={item.key} className='flex items-start gap-3 py-3.5 border-b border-border/40 last:border-0'>
                <span className='shrink-0 w-2 h-2 rounded-pill mt-[7px]' style={{ backgroundColor: TIER_DOT[item.tier] }} />
                <div className='flex-1 min-w-0 flex flex-col gap-1.5'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-[13.5px] font-[600] break-words'>{item.label}</span>
                    <span className={`shrink-0 text-[10.5px] font-bold tracking-[.05em] uppercase rounded-pill px-2 py-[2px] ${TIER_CHIP[item.tier]}`}>
                      {item.tier}
                    </span>
                    {item.reopen && (
                      <span className='shrink-0 inline-flex items-center gap-1 text-[10.5px] font-[600] text-danger bg-danger-soft rounded-pill px-2 py-[2px]'>
                        <ArrowPathIcon className='w-2.5 h-2.5' />Reopened {fmtWhen(item.reopen.at)}
                      </span>
                    )}
                  </div>
                  {item.note && (
                    <p title={item.note.note} className='text-caption text-ink-subtle truncate'>
                      “{item.note.note}” — {item.note.by_label || 'auditor'} · {fmtWhen(item.note.at)}
                    </p>
                  )}
                </div>
                {canAct && (
                  <Button size='sm' variant='secondary' leadingIcon={CheckIcon} className='shrink-0'
                    loading={busy === `fix:${item.key}`} disabled={Boolean(busy) && busy !== `fix:${item.key}`}
                    onClick={() => markFixed(item)}>Fixed</Button>
                )}
              </div>
            ))}
          </div>
        ))}

        {resolved.length > 0 && (
          <div className='flex flex-col'>
            <div className='flex items-center gap-2.5 pt-5 pb-2'>
              <span className='text-label text-[11px]'>Resolved</span>
              <span className='text-[11.5px] font-[600] text-ink-muted bg-surface-sunken rounded-pill px-2 py-px'>{resolved.length}</span>
              <Button size='sm' variant='ghost' className='ml-auto'
                onClick={() => setShowResolved((current) => !current)}>
                {showResolved ? 'Hide' : 'Show'}
              </Button>
            </div>
            {showResolved && resolved.map((item) => (
              <div key={item.key} className='flex items-center gap-3 py-3 border-b border-border/40 last:border-0'>
                {item.auto ? (
                  <span title='Checked off automatically by a re-audit'
                    className='shrink-0 grid place-items-center w-[18px] h-[18px] rounded-pill bg-success-soft'>
                    <ArrowPathIcon className='w-2.5 h-2.5 text-success' />
                  </span>
                ) : (
                  <span title='Marked fixed by a teammate'
                    className='shrink-0 grid place-items-center w-[18px] h-[18px] rounded-pill bg-primary'>
                    <CheckIcon className='w-2.5 h-2.5 text-accent' strokeWidth={2.5} />
                  </span>
                )}
                <span className='text-[13px] font-[550] text-ink-muted min-w-0 truncate'>{item.label}</span>
                <span className={`ml-auto shrink-0 text-tag ${item.auto ? 'text-success' : 'text-ink-subtle'}`}>
                  {item.auto
                    ? `Re-audited correct · ${fmtWhen(item.state?.completed_at)}`
                    : `Fixed · ${item.state?.completed_by_label || 'teammate'} · ${fmtWhen(item.state?.completed_at)}`}
                </span>
                {canAct && (
                  <Button size='sm' variant='ghost' className='shrink-0'
                    loading={busy === `reopen:${item.key}`} disabled={Boolean(busy) && busy !== `reopen:${item.key}`}
                    onClick={() => reopen(item)}>Reopen</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
