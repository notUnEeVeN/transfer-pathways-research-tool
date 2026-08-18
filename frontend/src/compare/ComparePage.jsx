import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, PageContainer, Spinner } from '../components/ui'
import SubNav from '../components/SubNav'
import { getAnalysisById } from '../analyses/registry'
import { fmtDate } from '../shared/fmtDate'
import { readUrlParam, writeUrlParam } from '../shared/urlState'
import {
  useComparison, useComparisonList, useDeleteComparison, useSaveComparison,
} from '../shared/query/hooks/useComparisons'
import ErrorBoundary from '../components/ErrorBoundary'
import ComparisonWorkspace from './ComparisonWorkspace'

/**
 * Compare — a first-class console surface, because a comparison spans states
 * and therefore cannot live inside a state page.
 *
 * The URL is the draft and the collection is the keepsake: `?panes=` carries an
 * unsaved assembly, `?cmp=` carries a saved one. There is no "save before you
 * can write" ceremony — the first note mints the document.
 *
 * `?panes=` is plain readable text rather than base64. This is an internal
 * tool; being able to read and hand-edit a pane list out of a pasted link is
 * worth more than a tidy query string.
 */

const TABS = [
  { value: 'workspace', label: 'Workspace' },
  { value: 'saved', label: 'Saved' },
]

const TAB_ROUTES = {
  workspace: { path: '/api/comparisons/:id' },
  saved: { path: '/api/comparisons' },
}

const PANE_SEPARATOR = '|'

export function encodePanes(panes) {
  return (panes || []).map((pane) => {
    const entries = Object.entries(pane.knobs || {})
      .map(([key, value]) => `${key}=${value === true ? '1' : value === false ? '0' : String(value)}`)
      .sort()
    return `${pane.figure}@${pane.major}${entries.length ? `?${entries.join('&')}` : ''}`
  }).join(PANE_SEPARATOR)
}

export function decodePanes(text) {
  return String(text || '').split(PANE_SEPARATOR).filter(Boolean).map((chunk, index) => {
    const [address, query = ''] = chunk.split('?')
    const [figure = '', major = ''] = address.split('@')
    // The knob's declared type decides how its serialized value reads back;
    // a figure that no longer declares the key keeps the raw string, which the
    // pane then reports as a stale pinned control rather than silently drops.
    const declared = getAnalysisById(figure)?.viewKnobs || []
    const knobs = {}
    for (const pair of query.split('&').filter(Boolean)) {
      const [key, raw = ''] = pair.split('=')
      const knob = declared.find((entry) => entry.key === key)
      knobs[key] = knob?.type === 'toggle' ? raw === '1' : raw
    }
    // No fingerprint here: eliding a knob that sits at its default needs the
    // major, which only the workspace has resolved. It stamps every pane
    // before the first write, so a pasted link and a hand-assembled pair
    // index identically rather than splitting note discovery in two.
    return { id: `p${index + 1}`, figure, major, knobs, label: null }
  })
}

const emptyDraft = (panes = []) => ({
  _id: null,
  title: '',
  panes,
  baseline_pane: panes[0]?.id || null,
  breakdown_id: null,
  verdict_at_pin: null,
  notes: [],
})

const bodyOf = (comparison, verdictAtPin) => ({
  // Sent even when blank, so clearing a title actually clears it. Omitting the
  // key would leave the stored name in place and the box would repopulate.
  title: comparison.title?.trim() || '',
  panes: comparison.panes,
  baseline_pane: comparison.baseline_pane,
  breakdown_id: comparison.breakdown_id || null,
  verdict_at_pin: verdictAtPin ?? comparison.verdict_at_pin ?? null,
})

function SavedList({ onOpen }) {
  const list = useComparisonList()
  const rows = list.data?.comparisons || []

  if (list.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (list.isError) return <Alert type='error'>Could not load the saved comparisons.</Alert>
  if (!rows.length) {
    return (
      <EmptyState title='No saved comparisons yet'
        description='Assemble two views in the workspace and save — or just write the first note, which saves it for you.' />
    )
  }

  return (
    <ul className='flex flex-col gap-2'>
      {rows.map((row) => (
        <li key={row._id}>
          <button type='button' onClick={() => onOpen(row._id)}
            className='surface-card flex w-full items-center gap-3 px-[22px] py-3.5 text-left
              hover:border-border-strong'>
            <span className='min-w-0 flex-1'>
              <span className='block truncate text-body-strong text-ink'>{row.title || row._id}</span>
              <span className='block truncate text-caption ink-subtle'>
                {row.panes?.length ?? 0} views · {row.note_count ?? 0} notes
                {row.author_label ? ` · ${row.author_label}` : ''}
                {row.updated_at ? ` · ${fmtDate(row.updated_at)}` : ''}
              </span>
            </span>
            <span className='shrink-0 text-caption ink-subtle font-mono'>{row._id}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function ComparePage() {
  const [tab, setTab] = useState(() => (readUrlParam('tab') === 'saved' ? 'saved' : 'workspace'))
  const [cmpId, setCmpId] = useState(
    () => (readUrlParam('tab') === 'saved' ? null : readUrlParam('cmp'))
  )
  const [draft, setDraft] = useState(() => emptyDraft(decodePanes(readUrlParam('panes'))))
  const [writeError, setWriteError] = useState(null)

  // The Saved tab is its OWN viewer. Opening a saved comparison must not take
  // over the workspace, or there is nowhere left to assemble the next pairing.
  const [viewingId, setViewingId] = useState(
    () => (readUrlParam('tab') === 'saved' ? readUrlParam('cmp') : null)
  )
  const saved = useComparison(cmpId)
  const viewing = useComparison(viewingId)
  const saveComparison = useSaveComparison()
  const deleteComparison = useDeleteComparison()

  // Back/Forward restores whichever comparison the URL names, the same
  // popstate contract the major pickers use.
  useEffect(() => {
    const syncFromUrl = () => {
      const cmp = readUrlParam('cmp')
      const onSaved = readUrlParam('tab') === 'saved'
      setTab(onSaved ? 'saved' : 'workspace')
      setViewingId(onSaved ? cmp : null)
      setCmpId(onSaved ? null : cmp)
      setDraft(emptyDraft(decodePanes(readUrlParam('panes'))))
    }
    window.addEventListener('popstate', syncFromUrl)
    return () => window.removeEventListener('popstate', syncFromUrl)
  }, [])

  const openSaved = useCallback((id) => {
    setViewingId(id)
    writeUrlParam('tab', 'saved')
    writeUrlParam('cmp', id)
  }, [])

  const closeSaved = useCallback(() => {
    setViewingId(null)
    writeUrlParam('cmp', null)
  }, [])

  // Switching tabs never moves a comparison between the two slots — the bench
  // keeps what is on it while saved comparisons are read.
  const changeTab = useCallback((next) => {
    setTab(next)
    writeUrlParam('tab', next === 'saved' ? 'saved' : null)
    writeUrlParam('cmp', (next === 'saved' ? viewingId : cmpId) || null)
  }, [viewingId, cmpId])

  // The workspace holds the working comparison — a draft, or the document that
  // draft became once it was saved. It always keeps its assembly controls.
  const comparison = cmpId ? saved.data?.comparison || null : draft
  const viewed = viewingId ? viewing.data?.comparison || null : null

  const onChange = useCallback((next) => {
    if (next._id) {
      // A rejected PATCH leaves the cached document unchanged, so without this
      // the edit would simply appear not to have happened.
      setWriteError(null)
      saveComparison.mutate({ id: next._id, body: bodyOf(next) }, {
        onError: () => setWriteError('That change could not be saved.'),
      })
    } else {
      setDraft(next)
      writeUrlParam('panes', encodePanes(next.panes))
    }
  }, [saveComparison])

  // Lazy identity: the first write mints the document. Called by Save and by
  // the notes rail alike, so writing a note on an unsaved draft POSTs the
  // comparison and then the note.
  // `panes` lets the workspace hand up fingerprint-stamped panes, which only it
  // can compute (eliding a default needs the resolved major).
  const ensureSaved = useCallback(async (verdictAtPin = null, panes = null) => {
    if (!comparison) throw new Error('No comparison to save')
    const doc = panes ? { ...comparison, panes } : comparison
    if (doc._id) {
      if (verdictAtPin && !doc.verdict_at_pin) {
        await saveComparison.mutateAsync({ id: doc._id, body: bodyOf(doc, verdictAtPin) })
      }
      return doc._id
    }
    const created = await saveComparison.mutateAsync({ body: bodyOf(doc, verdictAtPin) })
    const id = created?.comparison?._id
    if (!id) throw new Error('The server did not return a comparison id')
    setCmpId(id)
    writeUrlParam('panes', null)
    writeUrlParam('cmp', id)
    return id
  }, [comparison, saveComparison])

  const onDelete = useCallback(async () => {
    if (!cmpId) return
    await deleteComparison.mutateAsync(cmpId)
    setCmpId(null)
    writeUrlParam('cmp', null)
    setDraft(emptyDraft([]))
  }, [cmpId, deleteComparison])

  const onDeleteViewed = useCallback(async () => {
    if (!viewingId) return
    await deleteComparison.mutateAsync(viewingId)
    closeSaved()
  }, [viewingId, deleteComparison, closeSaved])

  const clearBench = useCallback(() => {
    setCmpId(null)
    setDraft(emptyDraft([]))
    writeUrlParam('panes', null)
    writeUrlParam('cmp', null)
  }, [])

  const route = useMemo(() => (tab === 'workspace' && cmpId
    ? { path: `/api/comparisons/${cmpId}` }
    : TAB_ROUTES[tab]), [tab, cmpId])

  return (
    <div className='h-full flex flex-col'>
      <SubNav tabs={{ value: tab, onChange: changeTab, options: TABS }} route={route} />
      <div className='flex-1 min-h-0 overflow-auto'>
        {/* Full width: two or three figure matrices side by side need every
            pixel, and the console's 7xl cap left each one too narrow to read. */}
        <PageContainer width='full'>
          <ErrorBoundary scope='The comparison' resetKey={`${tab}:${cmpId || ''}:${viewingId || ''}`}>
          {tab === 'saved' && (
            !viewingId ? <SavedList onOpen={openSaved} />
            : viewing.isLoading ? <div className='flex justify-center py-10'><Spinner /></div>
            : viewing.isError || !viewed ? <Alert type='error'>Could not load this comparison.</Alert>
            : (
              <div className='flex flex-col gap-4'>
                <div>
                  <Button variant='secondary' size='sm' leadingIcon={ArrowLeftIcon}
                    onClick={closeSaved}>All saved comparisons</Button>
                </div>
                {writeError && <Alert type='error'>{writeError}</Alert>}
                {/* Exhibit mode: the assembly controls fold away here, because
                    this is the comparison being read rather than built. */}
                <ComparisonWorkspace comparison={viewed} onChange={onChange}
                  ensureSaved={ensureSaved} onDelete={onDeleteViewed} mode='exhibit'
                  saving={saveComparison.isPending || deleteComparison.isPending} />
              </div>
            )
          )}
          {tab === 'workspace' && (
            cmpId && saved.isLoading ? <div className='flex justify-center py-10'><Spinner /></div>
            : cmpId && saved.isError ? <Alert type='error'>Could not load this comparison.</Alert>
            : !comparison ? <Alert type='error'>This comparison could not be read.</Alert>
            : (
              <>
                {writeError && <Alert type='error'>{writeError}</Alert>}
                {/* The bench. Its assembly controls never fold away, and it
                    keeps whatever is on it while saved comparisons are read. */}
                <ComparisonWorkspace comparison={comparison} onChange={onChange}
                  ensureSaved={ensureSaved} onDelete={cmpId ? onDelete : null} mode='build'
                  saving={saveComparison.isPending || deleteComparison.isPending} />
                {cmpId && (
                  <p className='mt-3 text-caption ink-subtle'>
                    Saved. It is in the Saved tab now — clear the bench to start another pairing.
                  </p>
                )}
                {cmpId && (
                  <Button variant='secondary' size='sm' className='mt-2' onClick={clearBench}>
                    Start a new comparison
                  </Button>
                )}
              </>
            )
          )}
          </ErrorBoundary>
        </PageContainer>
      </div>
    </div>
  )
}
