import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, Button, EmptyState, Input, Spinner } from '../components/ui'
import RefreshButton from '../components/RefreshButton'
import { ANALYSES, getAnalysisById } from '../analyses/registry'
import { filterBuiltInAnalyses } from '../visuals/analysisVisibility'
import { useAccessMe, useVisualSettings } from '../shared/query/hooks/useAccess'
import { useRefreshAnalyses } from '../shared/query/refresh'
import { useMajors } from '../shared/majors/useMajors'
import { useAddNote, useDeleteNote, useEditNote } from '../shared/query/hooks/useComparisons'
import { assessComparability } from './comparability'
import { compareDistributions, joinCells, pinnableVerdict } from './delta'
import { fingerprintOf, knobsFor, paneLabel } from './viewKnobs'
import { breakdownFor, getBreakdown } from './breakdowns/registry'
import CellSource from './CellSource'
import ComparisonNotes from './ComparisonNotes'
import JoinReceipt from './JoinReceipt'
import DistributionReceipt from './DistributionReceipt'
import { comparisonColorScaleFor } from './comparisonColorScale'
import PaneBuilder from './PaneBuilder'
import VerdictDrift from './VerdictDrift'
import ViewPane, { PaneChip } from './ViewPane'

/**
 * Figures side by side at the full width of the window, with the computed
 * difference and the written argument underneath.
 *
 * An earlier draft collapsed the figures and led with the delta alone, on the
 * strength of a 2024 remark that a plain side-by-side was not interesting
 * enough. Tybalt corrected that: reading the two matrices against each other IS
 * the work, and the delta is what you turn to once you have seen them. So the
 * panes open, they span the window (this page deliberately escapes the
 * console's 7xl frame), and the argument sits below rather than beside them.
 * Two panes is the common case and three is the ceiling — past that no column
 * is wide enough to read. Every value on screen is computed live from the join
 * or read from the figure's own adapter; nothing is a stat tile from a constant.
 *
 * Explicit non-goal, carried in from the design: this is a meeting-and-audit
 * tool. It is not the census research program and will never scale to "every
 * major as the comparison distribution". That work needs its own fused
 * figures, commissioned as ordinary registry entries; this tool will host and
 * annotate them, and it renders no figure type of its own.
 */

// Three is the practical ceiling for reading matrices side by side, and two is
// the common case. Beyond three, every column is too narrow to be worth it.
const MAX_PANES = 3

// Complete Tailwind literals per pane count — never interpolated, or the
// class is absent from the built stylesheet.
const PANE_GRID = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3',
}

// The figures this tool compares today: the Massachusetts paper's Figures 1-6,
// which are the ones with a published counterpart to argue against. Exported so
// the scope is assertable in a test rather than being an invisible filter.
export const COMPARABLE_SCOPE = (analysis) => (
  analysis.provenance === 'ma' && Number.isFinite(analysis.figureNo)
)

// The key the whole-comparison refresh is tracked under. Not a major slug, and
// it must never collide with one.
const REFRESH_ALL = '*all'

const nextPaneId = (panes) => {
  const used = new Set(panes.map((pane) => pane.id))
  let n = 1
  while (used.has(`p${n}`)) n += 1
  return `p${n}`
}

function stamped(pane, majorsBySlug) {
  const analysis = getAnalysisById(pane.figure)
  return { ...pane, fingerprint: fingerprintOf(pane, analysis, majorsBySlug.get(pane.major) || null) }
}

export default function ComparisonWorkspace({
  comparison, onChange, ensureSaved, onDelete, saving = false, mode = 'build',
}) {
  const [cellsByPane, setCellsByPane] = useState({})
  // Panes render OPEN; this tracks the ones deliberately closed, so adding a
  // view shows its figure straight away.
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [builder, setBuilder] = useState(null)
  const [selectedCell, setSelectedCell] = useState(null)
  const [pendingAnchor, setPendingAnchor] = useState(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  // An exhibit folds its assembly controls (pane chips, Add a view) away,
  // leaving the figures with their own control rows — what a reader reaches
  // for. The bench keeps them always: it is where pairings get built.
  const [editingViews, setEditingViews] = useState(false)
  const [noteError, setNoteError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  // WHICH refresh is running (a major slug, or REFRESH_ALL), and when each
  // target last landed. Both are keyed the same way so a pane reports when ITS
  // numbers came back rather than when any refresh happened to run, and so one
  // pane refreshing does not put a spinner on the other two.
  const [refreshTarget, setRefreshTarget] = useState(null)
  const [refreshedAt, setRefreshedAt] = useState({})

  const me = useAccessMe()
  const myUid = me.data?.uid || null
  const isAdmin = me.data?.role === 'admin'
  const visualSettings = useVisualSettings()
  // The cross-corpus registry the pane picker needs. `?state=all` lands with
  // the full picker in a later increment; until the server accepts it, each
  // configured corpus is read by its own call so the hook count stays fixed.
  const california = useMajors()
  const massachusetts = useMajors({ state: 'ma' })
  const virginia = useMajors({ state: 'va' })

  const addNote = useAddNote()
  const editNote = useEditNote()
  const deleteNote = useDeleteNote()
  const { refresh, isRefreshing } = useRefreshAnalyses()

  const majorsLoading = california.isLoading || massachusetts.isLoading || virginia.isLoading
  const majors = useMemo(
    () => [...california.majors, ...massachusetts.majors, ...virginia.majors],
    [california.majors, massachusetts.majors, virginia.majors]
  )
  const majorsBySlug = useMemo(() => new Map(majors.map((major) => [major.slug, major])), [majors])

  // Disabled beats released, and a disabled figure must not mount at all —
  // that rule survives into this surface unchanged. On top of it the tool is
  // scoped to the Massachusetts paper's Figures 1-6 for now: the six are
  // DERIVED (the `ma` provenance lane plus a figure number) rather than listed,
  // so the scope cannot drift from the registry. Widening it is deleting the
  // COMPARABLE_SCOPE filter.
  const analyses = useMemo(() => filterBuiltInAnalyses(ANALYSES, {
    isAdmin,
    releasedIds: visualSettings.data?.released_ids || [],
    disabledIds: visualSettings.data?.disabled_ids || [],
  }).filter(COMPARABLE_SCOPE).sort((a, b) => a.figureNo - b.figureNo),
  [isAdmin, visualSettings.data])

  // The single resolution point for a stored pane's figure. A saved comparison
  // or a hand-typed ?panes= must not be a way around the release gate, so
  // nothing below this line reads the unfiltered registry.
  const visibleAnalysis = useCallback((figureId) => (
    analyses.find((entry) => entry.id === figureId) || null
  ), [analyses])

  // Knobs a pane has reported and we have SENT, but which the server document
  // has not echoed back yet.
  //
  // A saved comparison is written by PATCH, so the `comparison` prop keeps
  // arriving as the pre-write document for as long as the request is in flight
  // — and the mutation itself re-renders. Without holding the sent values here,
  // every render handed the panes back their old knobs, each pane re-reported,
  // and two panes took turns overwriting each other's write forever. That is
  // the "Maximum update depth exceeded" crash.
  const pendingKnobs = useRef({})

  // The document as the reader is actually looking at it: the server's copy
  // with anything already sent laid over the top. A pending entry retires as
  // soon as the server agrees with it.
  const effective = useMemo(() => {
    const pending = pendingKnobs.current
    const ids = Object.keys(pending)
    if (!ids.length) return comparison
    const panesNow = comparison.panes || []
    for (const id of ids) {
      const landed = panesNow.find((entry) => entry.id === id)
      if (landed && JSON.stringify(landed.knobs || {}) === JSON.stringify(pending[id])) {
        delete pending[id]
      }
    }
    if (!Object.keys(pending).length) return comparison
    return {
      ...comparison,
      panes: panesNow.map((entry) => (
        pending[entry.id] ? { ...entry, knobs: pending[entry.id] } : entry
      )),
    }
  }, [comparison])

  const effectiveRef = useRef(effective)
  effectiveRef.current = effective

  const panes = effective.panes || []
  const comparisonColorScale = useMemo(
    () => comparisonColorScaleFor(panes, cellsByPane),
    [panes, cellsByPane]
  )
  const showBuildControls = mode === 'build' || editingViews
  const baselineId = panes.some((pane) => pane.id === comparison.baseline_pane)
    ? comparison.baseline_pane
    : panes[0]?.id || null

  const reportCells = useCallback((paneId, payload) => {
    setCellsByPane((current) => {
      const previous = current[paneId]
      if (previous && previous.status === payload.status && payload.status !== 'ready') return current
      return { ...current, [paneId]: payload }
    })
  }, [])

  // Every pane write re-derives the fingerprint. It is a discovery index, not
  // an identity, so a stale one costs a lookup and never a note.
  const writePanes = (nextPanes) => {
    const stampedPanes = nextPanes.map((pane) => stamped(pane, majorsBySlug))
    const nextBaseline = stampedPanes.some((pane) => pane.id === baselineId)
      ? baselineId
      : stampedPanes[0]?.id || null
    onChange({ ...comparison, panes: stampedPanes, baseline_pane: nextBaseline })
  }

  // A mounted figure owns its controls; this mirrors what it reports back onto
  // the pane, so the selections a reader makes while exploring are the ones the
  // comparison reopens with. Keyed by the knob's declared `prop`, which is the
  // same channel used to seed it.
  const reportView = useCallback((paneId, reported) => {
    const current = effectiveRef.current
    const pane = (current.panes || []).find((entry) => entry.id === paneId)
    if (!pane || !reported) return
    const analysis = visibleAnalysis(pane.figure)
    const applicable = knobsFor(analysis, majorsBySlug.get(pane.major) || null)
    const next = { ...(pane.knobs || {}) }
    let moved = false
    for (const knob of applicable) {
      if (!Object.prototype.hasOwnProperty.call(reported, knob.prop)) continue
      const value = reported[knob.prop]
      if (next[knob.key] === value) continue
      next[knob.key] = value
      moved = true
    }
    if (!moved) return

    // Record the send BEFORE writing, and carry every other pane's pending
    // knobs along, so a second pane reporting in the same commit neither
    // re-sends this one nor drops it.
    pendingKnobs.current[paneId] = next
    const nextPanes = (current.panes || []).map((entry) => (
      pendingKnobs.current[entry.id]
        ? { ...entry, knobs: pendingKnobs.current[entry.id] }
        : entry
    )).map((entry) => stamped(entry, majorsBySlug))
    const nextDoc = { ...current, panes: nextPanes }
    effectiveRef.current = nextDoc
    onChange(nextDoc)
  }, [visibleAnalysis, majorsBySlug, onChange])

  // One stable callback per pane, for the lifetime of the workspace. An inline
  // arrow is a new identity every render and the figures' report effects depend
  // on it, so an unstable one makes every render re-report — the other half of
  // the loop. The callback dispatches through a ref so it can stay identical
  // while the logic behind it stays current.
  const reportViewRef = useRef(reportView)
  reportViewRef.current = reportView
  const reporterCache = useRef(new Map())
  const paneReporters = useCallback((paneId) => {
    if (!reporterCache.current.has(paneId)) {
      reporterCache.current.set(paneId, (reported) => reportViewRef.current(paneId, reported))
    }
    return reporterCache.current.get(paneId)
  }, [])

  const assessment = useMemo(
    () => assessComparability(panes, majorsBySlug, visibleAnalysis),
    [panes, majorsBySlug, visibleAnalysis]
  )

  const baselinePane = panes.find((pane) => pane.id === baselineId) || null
  const baselineAnalysis = baselinePane ? visibleAnalysis(baselinePane.figure) : null
  const baselineMajor = baselinePane ? majorsBySlug.get(baselinePane.major) || null : null
  const baselineStatus = cellsByPane[baselineId]?.status || 'loading'

  const subjects = useMemo(() => panes
    .filter((pane) => pane.id !== baselineId)
    .map((pane) => {
      const analysis = visibleAnalysis(pane.figure)
      const major = majorsBySlug.get(pane.major) || null
      const status = cellsByPane[pane.id]?.status || 'loading'
      const joinable = assessment.join === 'aligned' && status === 'ready' && baselineStatus === 'ready'
      const distributable = assessment.join === 'disjoint' && status === 'ready' && baselineStatus === 'ready'
      return {
        pane,
        analysis,
        status,
        label: paneLabel(pane, analysis, major),
        join: joinable
          ? joinCells(cellsByPane[baselineId].cells, cellsByPane[pane.id].cells, {
            tolerance: analysis?.comparable?.tolerance ?? 0,
          })
          : null,
        distribution: distributable
          ? compareDistributions(
            cellsByPane[baselineId].cells,
            cellsByPane[pane.id].cells,
            assessment.contracts?.[0]?.distribution,
          )
          : null,
      }
    }), [panes, baselineId, baselineStatus, cellsByPane, majorsBySlug, assessment])

  // One comparison stores one verdict, so it is the baseline against the FIRST
  // other pane in pane order — the pair the reader is looking at when there are
  // only two, and a named, stable choice when there are more.
  const primary = subjects[0] || null
  // A cross-state pair has no cell join, so its pinnable reading is the
  // population contrast instead. Either way one comparison pins one reading.
  const verdict = pinnableVerdict(primary?.join, primary?.distribution)

  const breakdown = useMemo(() => {
    const explicit = comparison.breakdown_id ? getBreakdown(comparison.breakdown_id) : null
    return explicit || breakdownFor(panes, baselineAnalysis) || null
  }, [comparison.breakdown_id, panes, baselineAnalysis])

  const pin = () => (verdict ? { ...verdict, computed_at: new Date().toISOString() } : null)
  // Panes as they should be INDEXED. A draft restored from ?panes= arrives
  // unstamped, so every save path normalizes rather than trusting whatever
  // route the pane took to get here.
  const stampedPanes = () => panes.map((pane) => stamped(pane, majorsBySlug))

  // Every write reports. A rejected save that left the button looking idle
  // would be indistinguishable from a save that worked.
  const save = async () => {
    setSaveError(null)
    try {
      await ensureSaved(pin(), stampedPanes())
    } catch {
      setSaveError('Could not save this comparison.')
    }
  }

  /**
   * The explicit refetch. `majorSlug` null means every pane at once, in ONE
   * call: panes may sit in different corpora (an MA figure beside a VA one),
   * and a comparison refreshed one major at a time would spend part of its life
   * showing two vintages of the same claim.
   *
   * It refetches the queries the panes already hold. No pane is remounted —
   * the reader's control state lives inside the mounted figure, and re-seeding
   * it to deliver the same numbers is the bug this workspace just fixed.
   */
  const runRefresh = async (majorSlug = null) => {
    const target = majorSlug || REFRESH_ALL
    setRefreshTarget(target)
    try {
      await refresh(majorSlug ? { majorSlug } : undefined)
      const at = Date.now()
      // Refreshing everything makes every pane current, so every pane gets to
      // say so; refreshing one major may not have touched the others.
      setRefreshedAt((current) => (majorSlug
        ? { ...current, [target]: at }
        : { ...current, ...Object.fromEntries(panes.map((pane) => [pane.major, at])), [REFRESH_ALL]: at }))
    } catch {
      // A refetch that failed reports itself through the failing pane's own
      // error state. Stamping "Updated just now" over data that never arrived
      // would be the console lying about its own freshness, so the timestamp
      // stands where it was.
    } finally {
      setRefreshTarget(null)
    }
  }

  // Busy means THIS target is refetching, so refreshing one pane leaves the
  // others alone. Two refreshes may overlap (the hook supports it) and only the
  // latest target is remembered, so a refresh still in flight with no target
  // named falls back to marking every control busy rather than none.
  const refreshBusy = (target) => (refreshTarget ? refreshTarget === target : isRefreshing)

  const submitPane = (pane) => {
    if (builder?.mode === 'edit') {
      writePanes(panes.map((entry) => (entry.id === builder.paneId ? { ...pane, id: entry.id } : entry)))
    } else {
      writePanes([...panes, { ...pane, id: nextPaneId(panes) }])
    }
    setBuilder(null)
  }

  // Null clears the selection: a breakdown or overlay collapsing its open row
  // sends nothing rather than a cell.
  const selectCell = (cell) => {
    if (!cell || typeof cell !== 'object') {
      setSelectedCell(null)
      setPendingAnchor(null)
      return
    }
    setSelectedCell(cell.key)
    setPendingAnchor({ rowKey: cell.rowKey, colKey: cell.colKey, label: `${cell.rowLabel} × ${cell.colLabel}` })
  }

  // Returns false on failure so the rail keeps the prose in the box.
  const runNote = async (action) => {
    setNoteError(null)
    try {
      const id = await ensureSaved(verdict ? pin() : null, stampedPanes())
      await action(id)
      return true
    } catch {
      setNoteError('Could not save the note.')
      return false
    }
  }

  if (majorsLoading) return <div className='flex justify-center py-10'><Spinner /></div>

  return (
    <div className='flex flex-col gap-5'>
      {/* Headless: one per pane, so the overlay reads the figure's own hook and
          shares its react-query cache entry instead of opening a second data
          layer. Keyed by figure so switching one remounts rather than
          reordering the hooks inside. */}
      {panes.map((pane) => (
        <CellSource key={`${pane.id}:${pane.figure}`} pane={pane}
          analysis={visibleAnalysis(pane.figure)} major={majorsBySlug.get(pane.major) || null}
          onCells={reportCells} />
      ))}

      <section className='surface-card flex flex-col gap-3 p-5'>
          <div className='flex items-center gap-3'>
            {/* Uncontrolled and committed on blur: a saved comparison persists
                through a PATCH, and one request per keystroke is not that. */}
            <Input key={comparison._id || 'draft'} defaultValue={comparison.title || ''}
              className='flex-1' aria-label='Comparison title'
              placeholder='Untitled comparison — named from the pane labels when you save'
              onBlur={(event) => {
                const title = event.target.value
                if (title !== (comparison.title || '')) onChange({ ...comparison, title })
              }} />
            {/* Compare is a READING surface: nobody edits curated data here, so
                its figures hold their data for the session instead of refetching
                on every mount. That trade is only honest if the reader can ask
                for fresh numbers and see that they asked — this is the asking.
                A curated save elsewhere still invalidates these queries on its
                own; this button is for changes made outside this browser. */}
            <RefreshButton onRefresh={() => runRefresh(null)}
              refreshing={refreshBusy(REFRESH_ALL)}
              label='Refresh all' title='Refresh all panes in this comparison'
              updatedAt={refreshedAt[REFRESH_ALL] || null} />
            {!comparison._id && (
              <Button size='sm' onClick={save} disabled={saving || panes.length < 2}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            )}
            {mode === 'exhibit' && (
              <Button size='sm' variant='ghost'
                onClick={() => setEditingViews((value) => !value)}>
                {editingViews ? 'Done editing' : 'Edit views'}
              </Button>
            )}
            {comparison._id && onDelete && (
              <Button size='sm' variant='ghost' onClick={() => {
                if (window.confirm('Delete this comparison? Its notes go with it.')) onDelete()
              }}>Delete</Button>
            )}
          </div>
          {saveError && <Alert type='error'>{saveError}</Alert>}
          <p className='text-caption text-ink-muted'>{assessment.line}</p>
          {assessment.warnings.map((warning) => (
            <p key={warning.code} className='text-caption ink-subtle'>
              {warning.text} <span className='text-ink'>{warning.fix}</span>
            </p>
          ))}
        </section>

        <VerdictDrift pinned={comparison.verdict_at_pin} current={verdict}
          onRepin={() => onChange({ ...comparison, verdict_at_pin: pin() })} repinning={saving}
          pinnable={Boolean(verdict) && Boolean(comparison._id)} />

        {showBuildControls && (
        <div className={`grid gap-3 ${PANE_GRID[panes.length] || PANE_GRID[3]}`}>
          {panes.map((pane) => (
            <PaneChip key={pane.id} pane={pane} major={majorsBySlug.get(pane.major) || null}
              analysis={visibleAnalysis(pane.figure)}
              isBaseline={pane.id === baselineId}
              onSetBaseline={() => onChange({ ...comparison, baseline_pane: pane.id })}
              onEdit={() => setBuilder({ mode: 'edit', paneId: pane.id })}
              onDuplicate={panes.length < MAX_PANES
                ? () => writePanes([...panes, { ...pane, id: nextPaneId(panes), label: null }])
                : null}
              onClose={() => writePanes(panes.filter((entry) => entry.id !== pane.id))}
              // Shown at every count and disabled at two rather than hidden, so
              // "why is there no remove" is never a question the reader has to
              // answer for themselves. Two is the floor: one view is not a
              // comparison, and the server rejects a shorter list.
              canClose={panes.length > 2} />
          ))}
        </div>
        )}

        {builder ? (
          <PaneBuilder
            pane={builder.mode === 'edit' ? panes.find((pane) => pane.id === builder.paneId) : null}
            analyses={analyses} majors={majors}
            submitLabel={builder.mode === 'edit' ? 'Save view' : 'Add view'}
            onSubmit={submitPane} onCancel={() => setBuilder(null)} />
        ) : showBuildControls && panes.length < MAX_PANES && (
          <div>
            <Button size='sm' variant='secondary' onClick={() => setBuilder({ mode: 'add' })}>
              Add a view
            </Button>
          </div>
        )}

        {panes.length < 2 ? (
          <EmptyState title='One view is not a comparison'
            description='Add a second view — the same figure with a control flipped, or the same figure for another major — and the difference between them becomes the page.' />
        ) : (
          <>
            {/* The figures themselves, side by side at the full width of the
                window. A matrix squeezed into a third of a capped column is
                unreadable, which is the whole reason this page is not inside
                the console's usual 7xl frame. */}
            <div className={`grid gap-4 items-start ${PANE_GRID[panes.length] || PANE_GRID[3]}`}>
              {panes.map((pane, paneIndex) => (
                <ViewPane key={pane.id} pane={pane} major={majorsBySlug.get(pane.major) || null}
                  analysis={visibleAnalysis(pane.figure)}
                  comparisonContract={assessment.contracts?.[paneIndex] || null}
                  comparisonColorScale={comparisonColorScale}
                  isBaseline={pane.id === baselineId}
                  collapsed={collapsed.has(pane.id)}
                  onToggle={() => setCollapsed((current) => {
                    const next = new Set(current)
                    if (next.has(pane.id)) next.delete(pane.id)
                    else next.add(pane.id)
                    return next
                  })}
                  onChange={(nextPane) => writePanes(
                    panes.map((entry) => (entry.id === pane.id ? nextPane : entry))
                  )}
                  onRefresh={() => runRefresh(pane.major)}
                  refreshing={refreshBusy(pane.major)}
                  refreshedAt={refreshedAt[pane.major] || null}
                  onViewChange={paneReporters(pane.id)} />
              ))}
            </div>

            {/* Below the figures the page narrows into argument + notes: the
                prose belongs next to the delta it explains, not in a rail that
                takes 340px away from the charts above. */}
            <div className='grid grid-cols-1 gap-4 items-start xl:grid-cols-[minmax(0,1fr)_360px]'>
              <div className='flex min-w-0 flex-col gap-4'>
            {/* What the comparison found, in words. The figures carry their own
                difference view, so repeating the deltas here was the same
                picture twice — but a comparison that CANNOT be differenced
                still has to say so. */}
            {!primary?.join && !primary?.distribution && (
              <p className='text-caption ink-subtle max-w-[78ch]'>
                {assessment.join !== 'aligned'
                  ? 'No cell-by-cell difference is shown for these panes — see the note above.'
                  : !baselineAnalysis?.comparable
                    ? `No delta lens for ${baselinePane?.figure} yet, so these panes are shown side by side without a computed difference.`
                    : 'Working out the difference…'}
              </p>
            )}

            {primary?.join && (
              <JoinReceipt grain={baselineAnalysis?.comparable?.grain || null}
                assessment={assessment} join={primary.join}
                baselineLabel={paneLabel(baselinePane, baselineAnalysis, baselineMajor)}
                subjectLabel={primary.label} />
            )}

            {primary?.distribution && (
              <DistributionReceipt distribution={primary.distribution}
                contract={assessment.contracts?.[0] || null}
                baselineLabel={paneLabel(baselinePane, baselineAnalysis, baselineMajor)}
                subjectLabel={primary.label} />
            )}

            {breakdown && (
              <section className='surface-card p-5' data-export-exclude>
                <button type='button' onClick={() => setBreakdownOpen((value) => !value)}
                  aria-expanded={breakdownOpen} className='flex w-full items-center gap-2 text-left'>
                  <span className='flex-1 text-heading'>{breakdown.title}</span>
                  <span className='text-caption ink-subtle'>{breakdownOpen ? 'Hide' : 'Show'}</span>
                </button>
                {breakdownOpen && (
                  <div className='mt-4'>
                    <breakdown.Component comparison={comparison} panes={panes}
                      delta={primary?.join || null} selectedCell={selectedCell}
                      onSelectCell={selectCell} />
                  </div>
                )}
              </section>
            )}
              </div>

              <ComparisonNotes notes={comparison.notes || []}
        canEditNote={(note) => !!myUid && note.author_uid === myUid}
        pendingAnchor={pendingAnchor}
        onClearAnchor={() => setPendingAnchor(null)}
        onSelectAnchor={(anchor) => setSelectedCell(`${anchor.rowKey}|${anchor.colKey}`)}
        onAdd={(text, anchor) => runNote((id) => addNote.mutateAsync({ id, text, anchor })
          .then(() => setPendingAnchor(null)))}
        onEdit={(noteId, text) => runNote((id) => editNote.mutateAsync({ id, noteId, text }))}
        onDelete={(noteId) => runNote((id) => deleteNote.mutateAsync({ id, noteId }))}
        busy={addNote.isPending || editNote.isPending || deleteNote.isPending || saving}
        error={noteError} />
            </div>
          </>
        )}

        {me.isError && <Alert type='error'>Could not confirm your console role; note authorship may be incomplete.</Alert>}

    </div>
  )
}
