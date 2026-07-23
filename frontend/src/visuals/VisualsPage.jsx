import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowsPointingOutIcon, ChartBarIcon, PencilSquareIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import {
  Alert, Badge, Button, EmptyState, FullScreenPanel, Input, Spinner, SwitchField,
} from '../components/ui'
import AnalysisCard from '../analyses/AnalysisCard'
import { downloadBlob } from '../analyses/exportCard'
import { ANALYSES, getAnalysisById } from '../analyses/registry'
import apiClient from '../shared/api/apiClient'
import { fmtDate } from '../shared/fmtDate'
import { useAccessMe, useVisualSettings } from '../shared/query/hooks/useAccess'
import {
  useDegreeRequirements, useDeleteFigure, useEditFigure, useFigures,
} from '../shared/query/hooks/useData'
import MeasurePanel from '../analyses/MeasurePanel'
import { measureFor } from '../analyses/measures'
import { filterBuiltInAnalyses } from './analysisVisibility'
import { resolveAnalysisAvailability } from './analysisAvailability'
import { SOURCE_META, figureRefForItem, groupGalleryBySource, sourceForItem } from './provenance'
import { useMajorChoice } from '../shared/majors/MajorContext'
import MajorPicker from '../shared/majors/MajorPicker'

export { filterBuiltInAnalyses } from './analysisVisibility'

const shortAuthorUid = (uid) => (uid ? `UID ${String(uid).slice(0, 8)}` : 'unknown author')

function AvailabilityBadge({ availability }) {
  if (!availability) return null
  const variant = availability.available && !availability.fixed ? 'success' : 'neutral'
  return <Badge variant={variant}>{availability.label}</Badge>
}

// One clear, large statement of which major the figure is showing. Kept out of
// exports (a downloaded figure carries its own in-figure label); here it is the
// single header that replaces every figure's scattered scope/provenance lines.
function AnalysisScopeNotice({ availability, selectedMajor }) {
  if (!availability?.available) return null
  const label = selectedMajor?.label || availability.effectiveMajorSlug
  return (
    <div className='flex items-center gap-2.5' data-export-exclude>
      <span className='inline-block w-2.5 h-2.5 rounded-full bg-primary shrink-0' />
      <span className='text-title font-[680] text-ink leading-none'>{label}</span>
      {availability.fixed && <Badge variant='neutral'>reference dataset</Badge>}
    </div>
  )
}

function PublicationBadge({ published }) {
  return <Badge variant={published ? 'success' : 'neutral'}>{published ? 'Published' : 'Admin only'}</Badge>
}

function useDeferredPreview() {
  const [node, setNode] = useState(null)
  const [ready, setReady] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (!node || ready || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      setReady(true)
      observer.disconnect()
    }, { rootMargin: '280px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, ready])

  return { previewRef: setNode, ready }
}

function FigureThumbnail({ fig }) {
  const variants = fig.variants?.length
    ? fig.variants
    : [{ key: null, svg: fig.svg }]
  const active = variants.find((variant) => variant.key === fig.default_variant) || variants[0] || null
  const inlineSrc = active?.svg ? `data:image/svg+xml;base64,${active.svg}` : null
  const [imageSrc, setImageSrc] = useState(inlineSrc)
  const [assetError, setAssetError] = useState(false)

  useEffect(() => {
    setImageSrc(inlineSrc)
    setAssetError(false)
    if (inlineSrc || !active) return undefined

    let cancelled = false
    apiClient.get(figureAssetPath(fig.slug, 'svg', active.key), { responseType: 'blob' })
      .then((response) => blobAsDataUrl(response.data))
      .then((src) => { if (!cancelled) setImageSrc(src) })
      .catch(() => { if (!cancelled) setAssetError(true) })
    return () => { cancelled = true }
  }, [active?.key, fig.slug, fig.updated_at, inlineSrc])

  if (assetError) {
    return (
      <div className='absolute inset-0 grid place-items-center text-caption'>
        Preview unavailable
      </div>
    )
  }
  if (!imageSrc) return <div className='absolute inset-0 grid place-items-center'><Spinner /></div>
  return (
    <img src={imageSrc} alt='' className='absolute inset-0 h-full w-full object-contain p-3
      transition-transform duration-300 ease-out group-hover:scale-[1.025]' />
  )
}

function LiveThumbnail({
  Component,
  publicationOptions,
  figureOnly = false,
  majorSlug = 'cs',
  majorLabel = '',
  majorCapabilities = null,
  unavailableMessage = 'Interactive preview unavailable',
}) {
  if (!Component) {
    return (
      <div className='absolute inset-0 grid place-items-center px-6 text-center text-caption'>
        {unavailableMessage}
      </div>
    )
  }
  return (
    // The live component is rendered at a useful desktop width, then reduced to
    // one third. `inert` keeps its controls out of the tab order until the user
    // opens the full visual.
    <div className='absolute inset-0 overflow-hidden bg-surface' aria-hidden='true' inert={true}>
      <div className='w-[300%] min-h-[300%] origin-top-left scale-[.333333] p-5
        transition-transform duration-300 ease-out group-hover:scale-[.341666]'
        style={figureOnly ? { display: 'grid', alignItems: 'center' } : undefined}>
        <Component publicationOptions={publicationOptions || {}}
          majorSlug={majorSlug} majorLabel={majorLabel}
          majorCapabilities={majorCapabilities} />
      </div>
    </div>
  )
}

function itemDetails(item, { isAdmin, releasedSet }) {
  if (item.kind === 'figure') {
    const fig = item.figure
    return {
      title: fig.title,
      description: fig.caption || 'A visual published by the research team.',
      source: `${fig.author_label || shortAuthorUid(fig.author_uid)}${fig.updated_at ? ` · ${fmtDate(fig.updated_at)}` : ''}`,
      badge: <Badge variant='accent'>{fig.publication_type === 'interactive' ? 'Interactive' : 'Published figure'}</Badge>,
    }
  }

  const { analysis } = item
  return {
    title: analysis.title,
    description: analysis.description,
    source: `${analysis.author_label} · ${fmtDate(analysis.published_at)}`,
    badge: isAdmin
      ? <PublicationBadge published={releasedSet.has(analysis.id)} />
      : <Badge variant='accent'>Interactive</Badge>,
  }
}

export function VisualThumbnailCard({
  item,
  isAdmin = false,
  releasedSet = new Set(),
  onOpen,
  selectedMajor = null,
}) {
  const { previewRef, ready } = useDeferredPreview()
  const details = itemDetails(item, { isAdmin, releasedSet })
  // Ported figures show a "CA Fig. 1" / "MA Fig. 3" pill so the source figure
  // is legible on the card without opening it. Originals get none.
  const figureRef = figureRefForItem(item)
  const lane = SOURCE_META[sourceForItem(item)]
  const figure = item.kind === 'figure' ? item.figure : null
  const analysis = item.kind === 'analysis'
    ? item.analysis
    : getAnalysisById(figure?.visual?.id)
  const Component = analysis?.PreviewComponent || analysis?.Component || null
  const figureOnlyPreview = Boolean(analysis?.PreviewComponent)
  const availability = item.kind === 'analysis'
    ? resolveAnalysisAvailability(item.analysis, selectedMajor)
    : null
  const previewComponent = availability && !availability.available ? null : Component
  // Published interactive figures are frozen publications. Their manifest's
  // major wins; old manifests predate the field and therefore remain CS.
  const previewMajorSlug = item.kind === 'figure'
    ? (figure?.visual?.options?.majorSlug || analysis?.pinnedMajor || 'cs')
    : availability?.effectiveMajorSlug
  const previewMajorLabel = item.kind === 'figure'
    ? (figure?.visual?.options?.majorLabel || '')
    : (selectedMajor?.label || '')
  const unavailableMessage = availability && !availability.available
    ? availability.reason
    : 'Interactive preview unavailable'

  return (
    <article className='group relative surface-card overflow-hidden transition-[border-color,transform]
      duration-200 hover:-translate-y-0.5 hover:border-border-strong focus-within:border-primary'>
      <div ref={previewRef} className='relative aspect-[16/10] overflow-hidden border-b border-border bg-surface-muted'>
        {figureRef && (
          <span className={`pointer-events-none absolute left-2 top-2 z-20 rounded-pill border
            bg-surface/85 px-2 py-0.5 text-tag font-[650] backdrop-blur-sm ${lane.borderClass} ${lane.textClass}`}>
            {figureRef}
          </span>
        )}
        {ready && (figure && figure.publication_type !== 'interactive'
          ? <FigureThumbnail fig={figure} />
          : <LiveThumbnail key={`${item.key}:${previewMajorSlug || availability?.status || 'frozen'}`}
              Component={previewComponent} publicationOptions={figure?.visual?.options}
              figureOnly={figureOnlyPreview} majorSlug={previewMajorSlug}
              majorLabel={previewMajorLabel}
              majorCapabilities={item.kind === 'analysis' ? selectedMajor?.capabilities : null}
              unavailableMessage={unavailableMessage} />)}
        {!ready && <div className='absolute inset-0 grid place-items-center'><Spinner /></div>}
        <div className='absolute inset-0 z-10 grid place-items-center bg-primary/0 transition-colors
          duration-200 group-hover:bg-primary/18 group-focus-within:bg-primary/18' aria-hidden='true'>
          <span className='flex translate-y-1 items-center gap-2 rounded-pill bg-primary px-4 py-2
            text-button text-on-primary opacity-0 transition-[opacity,transform] duration-200
            group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0
            group-focus-within:opacity-100'>
            <ArrowsPointingOutIcon className='h-4 w-4' />
            Open visual
          </span>
        </div>
      </div>

      <div className='flex min-h-[152px] flex-col gap-2 p-4'>
        <div className='flex items-start gap-3'>
          <h2 className='min-w-0 flex-1 text-body-strong leading-snug'>
            {details.title}
          </h2>
          <div className='flex shrink-0 flex-col items-end gap-1'>
            {details.badge}
            <AvailabilityBadge availability={availability} />
          </div>
        </div>
        <p className='line-clamp-2 text-caption text-ink-muted'>{details.description}</p>
        <p className='mt-auto truncate text-caption'>{details.source}</p>
      </div>

      <button type='button' onClick={onOpen}
        className='absolute inset-0 z-20 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        aria-label={`Open ${details.title}`} title={`Open ${details.title}`} />
    </article>
  )
}

function stateMatches(variant, controls, desired) {
  return controls.every((control) => variant.state?.[control.key] === desired[control.key])
}

function variantForChange(variants, controls, active, key, value, allowFallback = false) {
  const desired = { ...(active?.state || {}), [key]: value }
  const exact = variants.find((variant) => stateMatches(variant, controls, desired))
  if (exact || !allowFallback) return exact || null

  // A select may invalidate a dependent toggle (for example, the paper
  // baseline has no differences view). Prefer the candidate that preserves
  // the most other controls; toggles themselves never use this fallback.
  return variants
    .filter((variant) => variant.state?.[key] === value)
    .map((variant) => ({
      variant,
      matches: controls.filter(
        (control) => control.key !== key && variant.state?.[control.key] === active?.state?.[control.key]
      ).length,
    }))
    .sort((a, b) => b.matches - a.matches)[0]?.variant || null
}

function variantForToggle(variants, controls, active, key) {
  const value = !Boolean(active?.state?.[key])
  const exact = variantForChange(variants, controls, active, key, value)
  if (exact) return exact

  // Toggling a parent mode may reset another toggle, but it must never move a
  // select control such as Version or Campus labels behind the user's back.
  return variants
    .filter((variant) => variant.state?.[key] === value)
    .filter((variant) => controls
      .filter((control) => control.type === 'select')
      .every((control) => variant.state?.[control.key] === active?.state?.[control.key]))
    .map((variant) => ({
      variant,
      matches: controls.filter(
        (control) => control.type === 'toggle'
          && control.key !== key
          && variant.state?.[control.key] === active?.state?.[control.key]
      ).length,
    }))
    .sort((a, b) => b.matches - a.matches)[0]?.variant || null
}

function figureAssetPath(slug, format, variantKey = null) {
  const variantPath = variantKey ? `/variants/${encodeURIComponent(variantKey)}` : ''
  return `/gallery/${encodeURIComponent(slug)}${variantPath}/${format}`
}

async function downloadFigure(slug, format, variantKey = null) {
  const response = await apiClient.get(figureAssetPath(slug, format, variantKey), { responseType: 'blob' })
  const disposition = response.headers['content-disposition'] || ''
  const fallback = `${slug}${variantKey ? `-${variantKey}` : ''}.${format}`
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || fallback
  downloadBlob(response.data, filename)
}

function blobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function SelectControl({ control, active, variants, controls, onSelect }) {
  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-tag text-ink-subtle'>{control.label}</span>
      <div className='inline-flex items-center gap-0.5 p-[3px] rounded-pill bg-surface-sunken'>
        {control.options.map((option) => {
          const candidate = variantForChange(variants, controls, active, control.key, option.value, true)
          const selected = active?.state?.[control.key] === option.value
          return (
            <button key={option.value} type='button' disabled={!candidate}
              aria-pressed={selected} onClick={() => candidate && onSelect(candidate.key)}
              className={`px-[13px] py-1.5 rounded-pill text-tag whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                selected ? 'bg-primary text-on-primary font-[650]' : 'text-ink-muted hover:text-ink'
              }`}>
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function VariantControls({ controls, variants, active, onSelect }) {
  if (!controls.length || !active) return null
  return (
    // AnalysisCard's shell now spaces direct children with gap-[18px], so this
    // row no longer needs its own margin/divider (v2:683 shows a plain row).
    <div className='flex flex-wrap items-end gap-4' data-export-exclude>
      {controls.map((control) => {
        if (control.type === 'toggle') {
          const next = variantForToggle(variants, controls, active, control.key)
          return (
            <div key={control.key} className='h-9 flex items-center'>
              <SwitchField label={control.label} checked={Boolean(active.state?.[control.key])}
                disabled={!next} onChange={() => next && onSelect(next.key)} />
            </div>
          )
        }
        return <SelectControl key={control.key} control={control} active={active}
          variants={variants} controls={controls} onSelect={onSelect} />
      })}
    </div>
  )
}

function PublicationCard({
  fig, canModify, onDelete, deleting, onSave, saving, children,
  downloadFormats = null, onDownload = null, exportName = null, showFooter = true,
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(fig.title)
  const [caption, setCaption] = useState(fig.caption || '')
  const [sourceUrl, setSourceUrl] = useState(fig.source_url || '')

  const resetFields = () => {
    setTitle(fig.title)
    setCaption(fig.caption || '')
    setSourceUrl(fig.source_url || '')
  }

  const save = async () => {
    await onSave({
      title: title.trim(),
      caption: caption.trim() || null,
      source_url: sourceUrl.trim() || null,
    })
    setEditing(false)
  }

  const source = (
    <>
      {fig.author_label || shortAuthorUid(fig.author_uid)}
      {fig.updated_at ? ` · ${fmtDate(fig.updated_at)}` : ''}
      {fig.source_url && (
        <> · <a className='text-primary hover:underline' href={fig.source_url}
          target='_blank' rel='noreferrer'>source</a></>
      )}
    </>
  )

  const actions = canModify ? (
    <>
      <Button variant='ghost' leadingIcon={PencilSquareIcon} title='Edit figure details'
        aria-label='Edit figure details'
        onClick={() => { if (editing) resetFields(); setEditing((value) => !value) }} />
      <Button variant='ghost' leadingIcon={TrashIcon} disabled={deleting}
        title='Delete figure' aria-label='Delete figure'
        onClick={() => {
          if (window.confirm(`Delete "${fig.title}"? Republishing the slug brings it back.`)) onDelete()
        }} />
    </>
  ) : null

  return (
    <AnalysisCard title={fig.title} source={source} actions={actions}
      exportName={exportName || fig.slug}
      downloadFormats={downloadFormats} onDownload={onDownload}>
      {editing && (
        <div className='flex flex-col gap-2' data-export-exclude>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder='Title' />
          <Input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder='Caption (optional)' />
          <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder='Source URL (optional)' />
          <div className='flex gap-2'>
            <Button onClick={save} disabled={saving || !title.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button variant='ghost' onClick={() => { resetFields(); setEditing(false) }}>Cancel</Button>
          </div>
        </div>
      )}
      {children}
      {showFooter && fig.caption && <p className='text-caption text-ink-muted max-w-prose'>{fig.caption}</p>}
      {showFooter && <p className='text-caption text-ink-subtle font-mono' data-export-exclude>{fig.slug}</p>}
    </AnalysisCard>
  )
}

export function FigureCard({ fig, canModify, onDelete, deleting, onSave, saving }) {
  const variants = fig.variants?.length
    ? fig.variants
    : [{ key: null, label: fig.title, state: {}, svg: fig.svg }]
  const controls = fig.controls || []
  const initialKey = fig.default_variant || variants[0]?.key || null
  const [variantKey, setVariantKey] = useState(initialKey)
  const active = variants.find((variant) => variant.key === variantKey) || variants[0] || null
  const assetKey = active?.key || '__default__'
  const inlineSrc = active?.svg ? `data:image/svg+xml;base64,${active.svg}` : null
  const [loadedSvgs, setLoadedSvgs] = useState({})
  const [assetError, setAssetError] = useState(false)
  const imageSrc = inlineSrc || loadedSvgs[assetKey] || null

  useEffect(() => {
    if (!variants.some((variant) => variant.key === variantKey)) setVariantKey(initialKey)
  }, [initialKey, variantKey, variants])

  useEffect(() => {
    setLoadedSvgs({})
  }, [fig.updated_at])

  useEffect(() => {
    if (inlineSrc || loadedSvgs[assetKey]) return undefined
    let cancelled = false
    setAssetError(false)
    apiClient.get(figureAssetPath(fig.slug, 'svg', active?.key), { responseType: 'blob' })
      .then((response) => blobAsDataUrl(response.data))
      .then((src) => {
        if (!cancelled) setLoadedSvgs((current) => ({ ...current, [assetKey]: src }))
      })
      .catch(() => { if (!cancelled) setAssetError(true) })
    return () => { cancelled = true }
  }, [active?.key, assetKey, fig.slug, inlineSrc, loadedSvgs])

  return (
    <PublicationCard fig={fig} canModify={canModify} onDelete={onDelete} deleting={deleting}
      onSave={onSave} saving={saving} downloadFormats={['svg', 'png', 'pdf']}
      onDownload={(format) => downloadFigure(fig.slug, format, active?.key)}>
      <VariantControls controls={controls} variants={variants} active={active} onSelect={setVariantKey} />
      {!imageSrc && !assetError && <div className='flex justify-center py-10'><Spinner /></div>}
      {assetError && <Alert type='error'>Could not load this figure state.</Alert>}
      {imageSrc && (
        <div className='bg-white rounded-md overflow-hidden'>
          <img src={imageSrc} alt={`${fig.title}${active?.label ? ` - ${active.label}` : ''}`}
            className='w-full h-auto' />
        </div>
      )}
    </PublicationCard>
  )
}

export function InteractiveFigureCard({ fig, canModify, onDelete, deleting, onSave, saving }) {
  // Resolve manifests through the built-in registry so published and native
  // copies share one renderer instead of drifting into parallel implementations.
  const analysis = getAnalysisById(fig.visual?.id)
  const Component = analysis?.Component || null
  const frozenMajorSlug = fig.visual?.options?.majorSlug || analysis?.pinnedMajor || 'cs'

  return (
    <PublicationCard fig={fig} canModify={canModify} onDelete={onDelete} deleting={deleting}
      onSave={onSave} saving={saving} showFooter={!analysis}>
      {!Component ? (
        <Alert type='error'>This interactive visual renderer is not available in the current application.</Alert>
      ) : (
        <>
          <p className='text-caption text-ink-subtle' data-export-exclude>
            Frozen publication · {frozenMajorSlug} data
          </p>
          <Component publicationOptions={fig.visual?.options || {}}
            majorSlug={frozenMajorSlug}
            majorLabel={fig.visual?.options?.majorLabel || ''} />
        </>
      )}
    </PublicationCard>
  )
}

export function BuiltInAnalysisCard({
  analysis,
  selectedMajor,
  isAdmin = false,
  releasedSet = new Set(),
  availability: providedAvailability = null,
}) {
  const availability = providedAvailability
    || resolveAnalysisAvailability(analysis, selectedMajor)
  const Component = analysis?.Component || null
  const majorLabel = selectedMajor?.label || selectedMajor?.slug || 'the selected major'
  const fixedMajorLabel = analysis?.majorScope?.label || analysis?.majorScope?.slug || 'its configured major'
  const scopeBadge = <AvailabilityBadge availability={availability} />

  return (
    <AnalysisCard title={analysis.title}
      source={`${analysis.author_label} · ${fmtDate(analysis.published_at)}`}
      exportName={`${analysis.id}-${availability.effectiveMajorSlug || selectedMajor?.slug || 'unavailable'}`}
      exportable={availability.available && !!Component}
      badge={isAdmin
        ? (
          <span className='flex items-center gap-2'>
            <PublicationBadge published={releasedSet.has(analysis.id)} />
            {scopeBadge}
          </span>
        )
        : scopeBadge}>
      {!availability.available ? (
        <Alert type='info'>
          <span className='font-[650] text-ink'>
            {availability.fixed
              ? `This audited visual is available only for ${fixedMajorLabel}.`
              : `This visual is not ready for ${majorLabel}.`}
          </span>
          {' '}{availability.reason}
          {!!availability.datasets?.length && (
            <> Required data: {availability.datasets.join(', ')}.</>
          )}
        </Alert>
      ) : !Component ? (
        <Alert type='error'>This visual renderer is not available in the current application.</Alert>
      ) : (
        <>
          <AnalysisScopeNotice availability={availability} selectedMajor={selectedMajor} />
          <Component key={`${analysis.id}:${availability.effectiveMajorSlug}`}
            majorSlug={availability.effectiveMajorSlug}
            majorLabel={selectedMajor?.label || ''}
            majorCapabilities={selectedMajor?.capabilities || null} />
          {/* Kept out of exports — a downloaded figure should read as a figure. */}
          <MeasurePanel measure={measureFor(analysis.id)} className='mt-5' data-export-exclude />
        </>
      )}
    </AnalysisCard>
  )
}

// A sticky, non-destructive filter: hovering or pinning a lane spotlights it by
// dimming the others — it never hides a card, which is the whole point of
// organizing by source without making the reader click into a single lane.
function SpotlightLegend({ groups, active, pinned, onHover, onLeave, onToggle }) {
  if (groups.length < 2) return null
  return (
    <div className='sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2
      bg-canvas/85 px-1 py-2 backdrop-blur-sm' onMouseLeave={onLeave}>
      <span className='mr-1 text-tag ink-subtle'>Source</span>
      {groups.map(({ id, meta, items }) => {
        const isActive = active === id
        const dimmed = active && !isActive
        return (
          <button key={id} type='button' aria-pressed={pinned === id} title={meta.tagline}
            onMouseEnter={() => onHover(id)} onFocus={() => onHover(id)} onBlur={onLeave}
            onClick={() => onToggle(id)}
            className={`inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-tag
              transition-[opacity,border-color,background-color,color] duration-200 ${
              isActive
                ? `${meta.borderClass} ${meta.softClass} ${meta.textClass}`
                : 'border-border text-ink-muted hover:border-border-strong hover:text-ink'
            } ${dimmed ? 'opacity-45' : 'opacity-100'}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} aria-hidden='true' />
            <span className='font-[650]'>{meta.label}</span>
            <span className='tabular opacity-70'>{items.length}</span>
          </button>
        )
      })}
    </div>
  )
}

function ProvenanceShelf({
  group, dimmed, shelfRef, isAdmin, releasedSet, onOpen, selectedMajor,
}) {
  const { meta, items } = group
  return (
    <section ref={shelfRef} aria-label={meta.name}
      className={`scroll-mt-20 transition-opacity duration-300 ease-out ${
        dimmed ? 'opacity-40' : 'opacity-100'}`}>
      <div className='mb-3 flex items-center gap-3'>
        <span className={`h-5 w-1.5 rounded-pill ${meta.dotClass}`} aria-hidden='true' />
        <h2 className='heading-card'>{meta.name}</h2>
        <span className={`rounded-pill px-2 py-0.5 text-tag font-[650] ${meta.softClass} ${meta.textClass}`}>
          {items.length}
        </span>
        <p className='hidden truncate text-caption ink-subtle sm:block'>{meta.tagline}</p>
      </div>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {items.map((item) => (
          <VisualThumbnailCard key={item.key} item={item} isAdmin={isAdmin}
            releasedSet={releasedSet} selectedMajor={selectedMajor}
            onOpen={() => onOpen(item.key)} />
        ))}
      </div>
    </section>
  )
}

export default function VisualsPage({ onNavigate = () => {} }) {
  const [selectedKey, setSelectedKey] = useState(null)
  const {
    slug: majorSlug,
    setSlug: setMajorSlug,
    major: selectedMajor,
    majors,
    isLoading: majorsLoading,
    isError: majorsError,
  } = useMajorChoice('visuals', { urlParam: 'major' })
  // /majors initially exposes a CS-only fallback. Do not mount any analysis
  // against that temporary value: a deep link such as ?major=bio must not fire
  // a transient CS request before the configured major registry arrives.
  const analysisMajor = majorsLoading || majorsError ? null : selectedMajor
  const me = useAccessMe()
  const isAdmin = me.data?.role === 'admin'
  const myUid = me.data?.uid || null
  const visualSettings = useVisualSettings()
  const releasedIds = visualSettings.data?.released_ids || []
  const disabledIds = visualSettings.data?.disabled_ids || []
  const visibleAnalyses = useMemo(
    () => visualSettings.isLoading
      ? []
      : filterBuiltInAnalyses(ANALYSES, { isAdmin, releasedIds, disabledIds }),
    [disabledIds, isAdmin, releasedIds, visualSettings.isLoading]
  )
  const releasedSet = useMemo(() => new Set(releasedIds), [releasedIds])
  const analysisAvailability = useMemo(
    () => new Map(visibleAnalyses.map((analysis) => [
      analysis.id,
      resolveAnalysisAvailability(analysis, analysisMajor),
    ])),
    [analysisMajor, visibleAnalyses]
  )
  const figuresQuery = useFigures()
  const degreeRequirements = useDegreeRequirements()
  const deleteFigure = useDeleteFigure()
  const editFigure = useEditFigure()
  const figures = figuresQuery.data?.figures || []
  const gallery = useMemo(() => {
    const builtIns = visibleAnalyses.map((analysis) => ({
      kind: 'analysis', key: `analysis:${analysis.id}`, at: analysis.published_at, analysis,
    }))
    const published = figures.map((figure) => ({
      kind: 'figure', key: `figure:${figure.slug}`, at: figure.updated_at, figure,
    }))
    return [...builtIns, ...published]
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
  }, [figures, visibleAnalyses])
  // Group the flat gallery into the three source lanes (CA / MA / New).
  const groups = useMemo(() => groupGalleryBySource(gallery), [gallery])

  // Spotlight state: a lane is `active` while hovered/focused, or `pinned` by a
  // click. Pinning wins and persists; hovering only previews.
  const [hoveredSource, setHoveredSource] = useState(null)
  const [pinnedSource, setPinnedSource] = useState(null)
  // Hover wins over the pin, so you can peek another lane and snap back on exit.
  const activeSource = hoveredSource || pinnedSource
  const shelfRefs = useRef({})
  const togglePin = (id) => {
    const next = pinnedSource === id ? null : id
    setPinnedSource(next)
    if (!next) return
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    shelfRefs.current[next]?.scrollIntoView?.({
      behavior: reduce ? 'auto' : 'smooth', block: 'start',
    })
  }

  const selectedItem = gallery.find((item) => item.key === selectedKey) || null
  const selectedDetails = selectedItem
    ? itemDetails(selectedItem, { isAdmin, releasedSet })
    : null

  const loading = figuresQuery.isLoading || visualSettings.isLoading || majorsLoading
  const failed = figuresQuery.isError || visualSettings.isError || majorsError
  const renderDetail = (item) => {
    if (item.kind === 'figure') {
      const figure = item.figure
      const PublishedCard = figure.publication_type === 'interactive'
        ? InteractiveFigureCard
        : FigureCard
      return (
        <PublishedCard fig={figure}
          canModify={isAdmin || (!!myUid && figure.author_uid === myUid)}
          onDelete={() => {
            deleteFigure.mutate(figure.slug)
            setSelectedKey(null)
          }}
          deleting={deleteFigure.isPending}
          onSave={(fields) => editFigure.mutateAsync({ slug: figure.slug, fields })}
          saving={editFigure.isPending} />
      )
    }

    const { analysis } = item
    const availability = analysisAvailability.get(analysis.id)
      || resolveAnalysisAvailability(analysis, analysisMajor)
    return (
      <BuiltInAnalysisCard analysis={analysis} selectedMajor={analysisMajor}
        isAdmin={isAdmin} releasedSet={releasedSet} availability={availability} />
    )
  }

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex items-end justify-between gap-6'>
        <div>
          <h1 className='text-heading'>Visual library</h1>
          <p className='mt-1 text-body text-ink-muted'>
            Choose a major once, then browse every ready visual and every clearly marked data gap.
          </p>
        </div>
        {!!gallery.length && (
          <Badge variant='neutral'>{gallery.length} {gallery.length === 1 ? 'visual' : 'visuals'}</Badge>
        )}
      </div>
      <section className='surface-card flex items-center gap-3 px-[22px] py-4'>
        <p className='text-label shrink-0'>Major</p>
        <div className='ml-auto min-w-52'>
          {majorsLoading ? (
            <span className='inline-flex min-h-9 items-center gap-2 text-caption text-ink-subtle'>
              <Spinner /> Loading majors…
            </span>
          ) : majorsError ? (
            <span className='inline-flex min-h-9 items-center text-caption text-danger'>
              Major registry unavailable
            </span>
          ) : majors.length < 2 ? (
            <p className='text-body-strong'>{selectedMajor?.label || majorSlug}</p>
          ) : (
            <MajorPicker value={majorSlug} onChange={setMajorSlug} className='w-full' />
          )}
        </div>
      </section>
      {figuresQuery.isError && <Alert type='error'>Failed to load the figure gallery.</Alert>}
      {visualSettings.isError && <Alert type='error'>Failed to load built-in visual settings.</Alert>}
      {majorsError && (
        <Alert type='error'>
          Failed to load the major registry. No live analysis was started, and the requested major
          remains in the URL so a reload can retry it safely.
        </Alert>
      )}
      {degreeRequirements.isError && (
        <Alert type='error'>Could not load graduation-template verification status.</Alert>
      )}
      {loading && (!gallery.length || majorsLoading)
        && <div className='flex justify-center py-10'><Spinner /></div>}
      {!loading && !failed && !gallery.length && (
        <EmptyState icon={ChartBarIcon}
          title={isAdmin ? 'No visuals available' : 'No visuals published yet'}
          description={isAdmin
            ? 'Make a built-in visual available in Admin, or publish a finished local figure.'
            : 'Published visuals will appear here as the team finishes them.'}
          action={isAdmin ? <Button onClick={() => onNavigate('admin')}>Open visual settings</Button> : null} />
      )}
      {!majorsLoading && !majorsError && !!groups.length && (
        <div className='flex flex-col gap-3'>
          <SpotlightLegend groups={groups} active={activeSource} pinned={pinnedSource}
            onHover={setHoveredSource} onLeave={() => setHoveredSource(null)} onToggle={togglePin} />
          <div className='flex flex-col gap-9'>
            {groups.map((group) => (
              <ProvenanceShelf key={group.id} group={group}
                dimmed={!!activeSource && activeSource !== group.id}
                shelfRef={(el) => { shelfRefs.current[group.id] = el }}
                isAdmin={isAdmin} releasedSet={releasedSet} selectedMajor={analysisMajor}
                onOpen={setSelectedKey} />
            ))}
          </div>
        </div>
      )}

      <FullScreenPanel open={!!selectedItem} onClose={() => setSelectedKey(null)}
        title={selectedDetails?.title} subtitle={selectedDetails?.source}
        ariaLabel={selectedDetails ? `${selectedDetails.title} visual detail` : 'Visual detail'}>
        {selectedItem && renderDetail(selectedItem)}
      </FullScreenPanel>
    </div>
  )
}
