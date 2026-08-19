import React, { useCallback, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, DocumentDuplicateIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Alert, Badge, Button, Input } from '../components/ui'
import ErrorBoundary from '../components/ErrorBoundary'
import RefreshButton from '../components/RefreshButton'
import { BuiltInAnalysisCard, itemDetails } from '../visuals/VisualsPage'
import { resolveAnalysisAvailability } from '../visuals/analysisAvailability'
import { getAnalysisById } from '../analyses/registry'
import { paneLabel, resolveKnobs, viewPropsFor } from './viewKnobs'
import ContractStrip from './ContractStrip'

/**
 * One pane = the registry's own Component, mounted through the existing
 * BuiltInAnalysisCard. No figure is copied, wrapped or forked for this
 * workspace, so renderer parity is exact by construction and the fail-closed
 * availability Alerts, the scope notice, the MeasurePanel (vital — two panes
 * that look alike each have to state what they measure) and per-pane export
 * all arrive free.
 *
 * Pinned controls ride `componentProps`, the channel the console already uses
 * for page-level figure defaults. The figures stay uncontrolled.
 */

const NO_RELEASES = new Set()

const figureTitle = (analysis, major) => itemDetails(
  { kind: 'analysis', key: analysis.id, analysis },
  { isAdmin: false, releasedSet: NO_RELEASES, selectedMajor: major }
).title

/**
 * What a pane claims about its own controls, said out loud.
 *
 * A stored pane naming a control the figure no longer declares renders amber
 * and falls back to the figure's default: silently ignoring an unknown key
 * would let a meeting exhibit quietly render something other than what the
 * document says it renders.
 */
export function KnobPills({ pane, analysis, major }) {
  const { resolved, stale, applicable } = resolveKnobs(pane, analysis, major)
  const pinned = applicable.filter((knob) => Object.prototype.hasOwnProperty.call(resolved, knob.key))

  return (
    <>
      {pinned.map((knob) => {
        const value = resolved[knob.key]
        const option = (knob.options || []).find((entry) => entry.value === value)
        return (
          <Badge key={knob.key} variant='accent'>
            {knob.label}: {option?.label ?? (value === true ? 'on' : value === false ? 'off' : String(value))}
          </Badge>
        )
      })}
      {/* Same words whether the figure declares no controls or declares some
          and none are pinned: either way the document is claiming nothing
          about what is on screen, and it must not imply otherwise. */}
      {!pinned.length && <Badge variant='neutral'>not pinned — showing figure defaults</Badge>}
      {stale.map((key) => (
        <span key={key}
          className='inline-flex items-center rounded-pill bg-prov-ca-soft px-2.5 py-[3px] text-tag text-prov-ca'>
          Pinned control “{key}” no longer exists — showing the figure’s default
        </span>
      ))}
    </>
  )
}

/**
 * The assembly gesture is duplicate-then-change-one-field: a version diff is a
 * duplicate with one knob flipped, a major comparison is a duplicate with the
 * major changed. Both are two clicks from here.
 */
export function PaneChip({
  pane, major, isBaseline, onSetBaseline, onEdit, onDuplicate, onClose, canClose = true,
  analysis: providedAnalysis,
}) {
  // The workspace passes the figure resolved through the RELEASE-FILTERED
  // registry; resolving it here would reopen a disabled figure to any reader.
  const analysis = providedAnalysis ?? getAnalysisById(pane.figure)
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 rounded-xl border px-3 py-2.5 ${
      isBaseline ? 'border-primary bg-primary-soft' : 'border-border bg-surface'
    }`}>
      <div className='flex min-w-0 items-center gap-2'>
        <label className='flex items-center gap-1.5 text-tag ink-muted'>
          <input type='radio' name='compare-baseline' checked={isBaseline}
            onChange={onSetBaseline} aria-label={`Use ${paneLabel(pane, analysis, major)} as the baseline`} />
          Baseline
        </label>
        <span className='min-w-0 flex-1 truncate text-body-strong text-ink'>
          {paneLabel(pane, analysis, major)}
        </span>
        <Button variant='ghost' size='sm' leadingIcon={PencilSquareIcon}
          title='Edit this view' aria-label='Edit this view' onClick={onEdit} />
        {onDuplicate && (
          <Button variant='ghost' size='sm' leadingIcon={DocumentDuplicateIcon}
            title='Duplicate this view' aria-label='Duplicate this view' onClick={onDuplicate} />
        )}
        {/* Always present, disabled at two views rather than hidden: a control
            that vanishes reads as a missing feature. */}
        <Button variant='ghost' size='sm' leadingIcon={XMarkIcon}
          disabled={!canClose}
          title={canClose ? 'Remove this view' : 'A comparison needs two views'}
          aria-label='Remove this view' onClick={onClose} />
      </div>
      <div className='flex flex-wrap items-center gap-1.5'>
        <span className='text-caption ink-subtle truncate'>
          {analysis ? figureTitle(analysis, major) : pane.figure} · {major?.label || pane.major}
        </span>
        <KnobPills pane={pane} analysis={analysis} major={major} />
      </div>
    </div>
  )
}

export default function ViewPane({
  pane, major, isBaseline = false, onChange, collapsed = false, onToggle,
  analysis: providedAnalysis, onViewChange,
  comparisonContract = null,
  comparisonColorScale = null,
  // The refresh affordance is passed in rather than wired here: the query layer
  // is the workspace's business, and one holder of it there can say WHICH pane
  // is refreshing instead of every pane spinning at once.
  onRefresh = null, refreshing = false, refreshedAt = null,
}) {
  const [renaming, setRenaming] = useState(false)
  // See PaneChip: the visibility gate lives with the caller, not here.
  const analysis = providedAnalysis ?? getAnalysisById(pane.figure)
  const availability = resolveAnalysisAvailability(analysis, major)
  const viewProps = viewPropsFor(pane, analysis, major)

  // The knob values the CURRENT mount was seeded with.
  //
  // componentProps only seed a figure's useState, so an EXTERNAL change to a
  // pinned control has to remount the figure or it would keep rendering its old
  // view under a chip claiming the new one. But a change the figure itself
  // reported must NOT remount it — that would discard the state it just
  // reported and refetch underneath the reader.
  //
  // The two are told apart by what the figure last said: if the incoming props
  // match its own last report, this is the echo of its own change and the mount
  // stands. Anything else came from outside and re-seeds.
  const identity = `${pane.figure}:${pane.major}`
  const reportedRef = useRef(null)
  // A figure reports once as it mounts, describing the state it was just
  // seeded with plus its own defaults for everything unpinned. That is not a
  // reader's choice, and mirroring it would (a) silently pin every control the
  // figure happens to have and (b) feed a write -> refetch -> re-render ->
  // re-report cycle. Only changes AFTER the mount echo are a decision.
  const seenFirstReportRef = useRef(false)

  const seedRef = useRef({ identity, props: viewProps })
  const echoesOwnReport = reportedRef.current
    && Object.keys(viewProps).every((key) => viewProps[key] === reportedRef.current[key])
  if (seedRef.current.identity !== identity || !echoesOwnReport) {
    seedRef.current = { identity, props: viewProps }
    reportedRef.current = null
    seenFirstReportRef.current = false
  }
  const seedProps = seedRef.current.props

  const handleViewChange = useCallback((reported) => {
    reportedRef.current = reported || null
    if (!seenFirstReportRef.current) {
      seenFirstReportRef.current = true
      return
    }
    onViewChange?.(reported)
  }, [onViewChange])

  return (
    <section className='surface-card flex flex-col gap-3 p-4'>
      <div className='flex min-w-0 items-center gap-2'>
        <button type='button' onClick={onToggle} aria-expanded={!collapsed}
          className='flex min-w-0 flex-1 items-center gap-1.5 text-left'>
          {collapsed
            ? <ChevronRightIcon className='h-4 w-4 shrink-0 text-ink-subtle' />
            : <ChevronDownIcon className='h-4 w-4 shrink-0 text-ink-subtle' />}
          <span className='min-w-0 truncate text-body-strong text-ink'>
            {paneLabel(pane, analysis, major)}
          </span>
          {isBaseline && <Badge variant='accent'>baseline</Badge>}
        </button>
        {/* Refetches this pane's data UNDER the mounted figure: it touches
            nothing the mount key below is built from, because re-seeding the
            figure to deliver the same numbers would throw away the view the
            reader had arrived at. Titled with the major, because "Refresh"
            alone is the same word on every pane. */}
        {onRefresh && (
          <RefreshButton onRefresh={onRefresh} refreshing={refreshing}
            title={`Refresh ${major?.label || pane.major}`} updatedAt={refreshedAt} />
        )}
        <Button variant='ghost' size='sm' leadingIcon={PencilSquareIcon}
          title='Rename this pane' aria-label='Rename this pane'
          onClick={() => setRenaming((value) => !value)} />
      </div>

      {renaming && (
        <Input defaultValue={pane.label || ''} placeholder='Pane caption'
          onBlur={(event) => {
            onChange({ ...pane, label: event.target.value.trim() || null })
            setRenaming(false)
          }} />
      )}

      <ContractStrip contract={comparisonContract} />

      {/* A collapsed pane never mounts, so it fires no query at all; an open
          one reads the session cache and only recomputes when a curated save
          invalidates it or the reader asks. */}
      {!collapsed && (
        !analysis
          ? <Alert type='error'>This visual renderer is not available in the current application.</Alert>
          // Keyed by the pinned controls as well as the figure and major:
          // componentProps only SEED the figure's useState, so without this a
          // knob edit would leave the matrix showing its previous view under a
          // chip claiming the new one.
          : (
            <ErrorBoundary scope={`The ${figureTitle(analysis, major)} figure`}
              resetKey={`${identity}:${JSON.stringify(seedProps)}`}>
              <BuiltInAnalysisCard key={`${identity}:${JSON.stringify(seedProps)}`}
                analysis={analysis} selectedMajor={major}
                availability={availability}
                componentProps={{
                  ...seedProps,
                  ...(comparisonColorScale ? { comparisonColorScale } : {}),
                  onViewChange: handleViewChange,
                }} />
            </ErrorBoundary>
          )
      )}
    </section>
  )
}
