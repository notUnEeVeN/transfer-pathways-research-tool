import React, { useState, useEffect, useMemo } from 'react'
import { FlagIcon, ArrowsRightLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Button, Spinner, Alert, EmptyState, Stack, LoadingLogo, Skeleton, Tabs, Input, Textarea } from './components/ui'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import DocHead from './pages/Audit/components/DocHead'
import { useCourseList } from './pages/Audit/hooks/useCourseList'
import { DEFAULT_FILTER, schoolNameOf, openAssist } from './pages/Audit/lib/auditFormat'
import {
  useAuditCorrect, useAuditConservative, useAuditErrors, useAuditFlagged,
  useAuditDoc, useVerifyDoc,
} from '@frontend/query/hooks/useAudit'

/**
 * Review tab — browse previously-audited majors by tier and re-judge them in a
 * three-pane layout (list · ledger · actions). ASSIST opens in a managed popup
 * (openAssist); while that popup is open it follows the selection, so the
 * error queue with auto-advance stays one action per item.
 */
// No Stale tier here: staleness (parser drift) is the admin's concern in the
// main tooling, not part of the research console.
const TIERS = [
  { value: 'error', label: 'Error' },
  { value: 'conservative', label: 'Conservative' },
  { value: 'correct', label: 'Correct' },
  { value: 'flagged', label: 'Flagged' },
]

const matchesSearch = (r, q) => {
  if (!q) return true
  const s = q.toLowerCase()
  return (r.major || '').toLowerCase().includes(s) ||
    schoolNameOf(r).toLowerCase().includes(s) ||
    (r.community_college || '').toLowerCase().includes(s)
}

export default function ReviewTab({ filter = DEFAULT_FILTER, setFilter }) {
  const [tier, setTier] = useState('error')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [notes, setNotes] = useState('')
  const [cellsInError, setCellsInError] = useState(0)
  const verify = useVerifyDoc()

  // One list hook per tier; only the active tier fetches. Correct is searched
  // server-side; the small lists fetch fully and filter client-side.
  const correct = useAuditCorrect(filter, { search, limit: 200, enabled: tier === 'correct' })
  const conservative = useAuditConservative(filter, { enabled: tier === 'conservative' })
  const errors = useAuditErrors(filter, { enabled: tier === 'error' })
  const flagged = useAuditFlagged(filter, { enabled: tier === 'flagged' })
  const activeQuery = { correct, conservative, error: errors, flagged }[tier]

  const rows = activeQuery.data || []
  const filtered = useMemo(
    () => (tier === 'correct' ? rows : rows.filter((r) => matchesSearch(r, search))),
    [rows, tier, search]
  )

  const selIdx = filtered.findIndex((r) => r.id === selectedId)
  const selected = selIdx >= 0 ? filtered[selIdx] : null

  // Auto-select the first row whenever the active list changes and the current
  // selection is no longer in it (tier switch, search, or a re-judge dropping it).
  useEffect(() => {
    if (!selected && filtered.length) setSelectedId(filtered[0].id)
  }, [filtered, selected])

  // Prefill notes from the selected verdict; reset cells. Keyed by id (stable
  // across background refetches; the object identity is not).
  useEffect(() => {
    setNotes(selected?.notes || '')
    setCellsInError(0)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const docQ = useAuditDoc(selected?.id, selected?.system)
  const doc = docQ.data?.doc
  const courses = useCourseList(docQ.data?.course_names)
  const universityCoursesById = docQ.data?.university_courses || null
  const assistUrl = docQ.data?.assist_url || selected?.assist_url
  // A stale row whose doc was deleted has no agreement to re-verify against —
  // block re-judging and the ledger/ASSIST preview for it.
  const docDeleted = selected?.reason === 'deleted'

  // While the ASSIST popup is open, keep it pointed at the selected doc (so
  // Next/Prev and re-judge auto-advance carry ASSIST along).
  useEffect(() => {
    if (assistUrl) openAssist(assistUrl, { onlyIfOpen: true })
  }, [assistUrl])

  const go = (delta) => {
    const i = selIdx + delta
    if (i >= 0 && i < filtered.length) setSelectedId(filtered[i].id)
  }

  const submit = async (result) => {
    if (!selected || docDeleted) return
    if (result === 'flagged' && !notes.trim()) { document.querySelector('[data-review-notes]')?.focus(); return }
    // Capture the next row BEFORE the list refetch drops the judged one.
    const nextRow = filtered[selIdx + 1] || filtered[selIdx - 1] || null
    try {
      await verify.mutateAsync({
        doc_id: selected.id,
        result,
        notes: notes.trim(),
        source: 'verify',
        system: selected.system,
        cells_in_error: Number(cellsInError) || 0,
        scope: { groupingId: filter.groupingId, schoolIds: filter.schoolIds, majorContains: filter.majorContains },
      })
      setSelectedId(nextRow ? nextRow.id : null)
    } catch (e) {
      // Keep the selection so the failed verdict is visible to retry, rather
      // than advancing past it on an unhandled rejection.
      console.error('re-judge failed:', e)
    }
  }

  const openAssistPopup = () => { if (assistUrl) openAssist(assistUrl) }

  // ── shared pieces ──
  const actionButtons = (
    <div data-testid='verdict-actions' className='flex flex-wrap items-center gap-2'>
      <Button onClick={() => submit('correct')} disabled={verify.isPending || !selected || docDeleted}>Correct</Button>
      <Button variant='warning' onClick={() => submit('conservative')} disabled={verify.isPending || !selected || docDeleted}>Conservative</Button>
      <Button variant='danger' onClick={() => submit('error')} disabled={verify.isPending || !selected || docDeleted}>Error</Button>
      <Button variant='secondary' leadingIcon={FlagIcon} onClick={() => submit('flagged')} disabled={verify.isPending || !selected || docDeleted}>Flag</Button>
    </div>
  )

  const notesAndCells = (
    <div className='flex flex-col gap-2'>
      <label className='flex items-center gap-1.5 text-caption text-ink-subtle'>
        Cells in error
        <Input type='number' min={0} step={1} value={cellsInError}
          onChange={(e) => setCellsInError(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
          className='w-14 font-mono tabular-nums text-right' />
      </label>
      <Textarea data-review-notes value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder='Notes (required when flagging)…' rows={3} />
    </div>
  )

  const docPreview = docDeleted
    ? <Alert type='info'>This agreement was deleted — there's nothing left to re-verify against. The stale verdict clears on a fresh audit pass, not from here.</Alert>
    : docQ.isError
    ? <Alert type='error'>Failed to load the agreement.</Alert>
    : !selected
      ? <EmptyState title='Nothing selected' description='Pick a major from the list to review it.' />
      : (docQ.isLoading || !doc)
        ? <div className='flex items-center justify-center py-8'><LoadingLogo size={48} /></div>
        : (
          <Stack gap='comfortable'>
            <DocHead doc={doc} assistUrl={assistUrl} showAssist={false} />
            <div className='uui-scope'><RequirementsLedger major={doc} courses={courses} universityCoursesById={universityCoursesById} preserveOrder /></div>
          </Stack>
        )

  // ── Browse layout: three columns, full window ──
  return (
    <div className='h-full overflow-hidden flex flex-col'>
      <div className='shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3'>
        <Tabs value={tier} onChange={(v) => { setTier(v); setSelectedId(null) }} options={TIERS} />
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder='Search major / school / college…'
          leadingIcon={MagnifyingGlassIcon}
          className='w-64 ml-auto' />
      </div>
      <div className='flex-1 min-h-0 grid grid-cols-[300px_minmax(0,1fr)_320px]'>
        <div className='h-full overflow-auto border-r border-border p-3'>
          <ResultList query={activeQuery} rows={filtered} selectedId={selectedId} onSelect={setSelectedId} tier={tier} />
        </div>
        <div className='h-full overflow-auto px-4 py-4'>{docPreview}</div>
        <div className='h-full overflow-auto border-l border-border p-4'>
          <Stack gap='comfortable'>
            <p className='text-label'>Set verdict</p>
            {actionButtons}
            {notesAndCells}
            <div className='inline-flex gap-1'>
              <Button variant='ghost' onClick={() => go(-1)} disabled={selIdx <= 0}>‹ Prev</Button>
              <Button variant='ghost' onClick={() => go(1)} disabled={selIdx < 0 || selIdx >= filtered.length - 1}>Next ›</Button>
            </div>
            <Button variant='secondary' leadingIcon={ArrowsRightLeftIcon} onClick={openAssistPopup} disabled={!selected || !assistUrl}>
              Open ASSIST
            </Button>
          </Stack>
        </div>
      </div>
    </div>
  )
}

function ResultListSkeleton({ rows = 6 }) {
  return (
    <div className='flex flex-col gap-1' aria-hidden='true'>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className='px-3 py-2 rounded-md border border-border flex flex-col gap-1.5'>
          <Skeleton className='h-3.5 w-40 max-w-full' />
          <Skeleton className='h-2.5 w-28' />
        </div>
      ))}
    </div>
  )
}

function ResultList({ query, rows, selectedId, onSelect, tier }) {
  if (query.isLoading) return <ResultListSkeleton />
  if (query.isError) return <Alert type='error'>Failed to load.</Alert>
  if (!rows.length) return <EmptyState title='Empty' description='No majors in this tier.' />
  const capHint = tier === 'correct' && rows.length >= 200 ? ' (most recent — search to narrow)' : ''
  return (
    <Stack gap='tight'>
      <p className='text-label'>{rows.length}{capHint}</p>
      <div className='flex flex-col gap-1'>
        {rows.map((r) => (
          <button key={r.id} type='button' onClick={() => onSelect(r.id)}
            className={`text-left px-3 py-2 rounded-md border transition-colors ${
              r.id === selectedId ? 'border-primary bg-primary-soft hover:bg-primary-soft' : 'border-border hover:bg-surface-hover'}`}>
            <div className='text-body-strong break-words leading-snug'>{r.major}</div>
            <div className='text-caption break-words leading-snug'>{schoolNameOf(r)} ← {r.community_college || '—'}</div>
            {r.notes ? <div className='text-caption text-ink-subtle break-words mt-1'>{r.notes}</div> : null}
          </button>
        ))}
      </div>
    </Stack>
  )
}
