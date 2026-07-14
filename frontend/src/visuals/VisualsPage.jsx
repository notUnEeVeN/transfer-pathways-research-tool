import React, { useEffect, useMemo, useState } from 'react'
import { PencilSquareIcon, TrashIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { Alert, Badge, Button, EmptyState, Input, Spinner, SwitchField } from '../components/ui'
import AnalysisCard from '../analyses/AnalysisCard'
import { ANALYSES, getAnalysisById } from '../analyses/registry'
import apiClient from '../shared/api/apiClient'
import { fmtDate } from '../shared/fmtDate'
import { useAccessMe, useVisualSettings } from '../shared/query/hooks/useAccess'
import { useDeleteFigure, useEditFigure, useFigures } from '../shared/query/hooks/useData'

const shortAuthorUid = (uid) => (uid ? `UID ${String(uid).slice(0, 8)}` : 'unknown author')

export function filterBuiltInAnalyses(analyses, { isAdmin, releasedIds = [], disabledIds = [] }) {
  const released = new Set(releasedIds)
  const disabled = new Set(disabledIds)
  return analyses.filter((analysis) =>
    !disabled.has(analysis.id) && (isAdmin || released.has(analysis.id)))
}

function PublicationBadge({ published }) {
  return <Badge variant={published ? 'success' : 'neutral'}>{published ? 'Published' : 'Admin only'}</Badge>
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
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
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
      <span className='text-[12px] text-ink-subtle'>{control.label}</span>
      <div className='inline-flex items-center gap-0.5 p-[3px] rounded-pill bg-surface-sunken'>
        {control.options.map((option) => {
          const candidate = variantForChange(variants, controls, active, control.key, option.value, true)
          const selected = active?.state?.[control.key] === option.value
          return (
            <button key={option.value} type='button' disabled={!candidate}
              aria-pressed={selected} onClick={() => candidate && onSelect(candidate.key)}
              className={`px-[13px] py-1.5 rounded-pill text-[12.5px] whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                selected ? 'bg-primary text-on-primary font-[650]' : 'text-ink-muted font-medium hover:text-ink'
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

  return (
    <PublicationCard fig={fig} canModify={canModify} onDelete={onDelete} deleting={deleting}
      onSave={onSave} saving={saving} showFooter={!analysis}>
      {!Component ? (
        <Alert type='error'>This interactive visual renderer is not available in the current application.</Alert>
      ) : (
        <Component publicationOptions={fig.visual?.options || {}} />
      )}
    </PublicationCard>
  )
}

export default function VisualsPage({ onNavigate = () => {} }) {
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
  const figuresQuery = useFigures()
  const deleteFigure = useDeleteFigure()
  const editFigure = useEditFigure()
  const figures = figuresQuery.data?.figures || []
  const gallery = useMemo(() => {
    const builtIns = visibleAnalyses.map((analysis) => ({
      kind: 'analysis', key: analysis.id, at: analysis.published_at, analysis,
    }))
    const published = figures.map((figure) => ({
      kind: 'figure', key: figure.slug, at: figure.updated_at, figure,
    }))
    return [...builtIns, ...published]
      .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0))
  }, [figures, visibleAnalyses])

  const loading = figuresQuery.isLoading || visualSettings.isLoading
  const failed = figuresQuery.isError || visualSettings.isError

  return (
    // App.jsx already wraps every tab in a max-w-screen-2xl px-6 py-6 shell, so
    // this only narrows to the console mockup's 1180px reading column (v2:668)
    // and sets the vertical rhythm between cards. The pb-6 on the bottom edge
    // stacks with App.jsx's 24px to reach 48px total bottom padding per spec.
    <div className='max-w-[1180px] mx-auto flex flex-col gap-5 pb-6'>
      {figuresQuery.isError && <Alert type='error'>Failed to load the figure gallery.</Alert>}
      {visualSettings.isError && <Alert type='error'>Failed to load built-in visual settings.</Alert>}
      {loading && !gallery.length && <div className='flex justify-center py-10'><Spinner /></div>}
      {!loading && !failed && !gallery.length && (
        <EmptyState icon={ChartBarIcon}
          title={isAdmin ? 'No visuals available' : 'No visuals published yet'}
          description={isAdmin
            ? 'Make a built-in visual available in Admin, or publish a finished local figure.'
            : 'Published visuals will appear here as the team finishes them.'}
          action={isAdmin ? <Button onClick={() => onNavigate('admin')}>Open visual settings</Button> : null} />
      )}
      {gallery.map((item) => {
        if (item.kind === 'figure') {
          const figure = item.figure
          const PublishedCard = figure.publication_type === 'interactive'
            ? InteractiveFigureCard
            : FigureCard
          return (
            <PublishedCard key={item.key} fig={figure}
              canModify={isAdmin || (!!myUid && figure.author_uid === myUid)}
              onDelete={() => deleteFigure.mutate(figure.slug)} deleting={deleteFigure.isPending}
              onSave={(fields) => editFigure.mutateAsync({ slug: figure.slug, fields })}
              saving={editFigure.isPending} />
          )
        }

        const { analysis } = item
        const Component = analysis.Component
        return (
          <AnalysisCard key={item.key} title={analysis.title}
            source={`${analysis.author_label} · ${fmtDate(analysis.published_at)}`}
            exportName={analysis.id}
            badge={isAdmin ? <PublicationBadge published={releasedSet.has(analysis.id)} /> : null}>
            <Component />
          </AnalysisCard>
        )
      })}
    </div>
  )
}
