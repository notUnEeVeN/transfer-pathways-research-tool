import React, { useMemo, useState } from 'react'
import { Button, Input, Select } from '../components/ui'
import { itemDetails } from '../visuals/VisualsPage'
import { resolveAnalysisAvailability } from '../visuals/analysisAvailability'
import { knobsFor } from './viewKnobs'

/**
 * Assemble one View: figure × major × pinned controls.
 *
 * The figure list is the registry's own, filtered by the same visibility rule
 * the Visuals gallery uses (disabled beats released, and a disabled figure
 * never mounts). A figure the selected major cannot run is still LISTED, with
 * its availability reason as the suffix — "why can't I compare this" is itself
 * meeting content.
 *
 * Every knob offers an explicit unpinned choice, because "pinned to the
 * figure's default" and "not pinned" are different claims about the document
 * and the pane chip says which one is true.
 */

const NOT_PINNED = ''
const NO_RELEASES = new Set()

function knobOptions(knob) {
  const pinnable = knob.type === 'toggle'
    ? [{ value: '1', label: 'On' }, { value: '0', label: 'Off' }]
    : (knob.options || []).map((option) => ({ value: String(option.value), label: option.label }))
  return [{ value: NOT_PINNED, label: 'Not pinned — figure default' }, ...pinnable]
}

const knobValueAsString = (knob, value) => {
  if (value === undefined) return NOT_PINNED
  if (knob.type === 'toggle') return value ? '1' : '0'
  return String(value)
}

const knobValueFromString = (knob, raw) => (knob.type === 'toggle' ? raw === '1' : raw)

export default function PaneBuilder({
  pane = null, analyses, majors, onSubmit, onCancel, submitLabel = 'Add view',
}) {
  const [figure, setFigure] = useState(() => pane?.figure || analyses[0]?.id || '')
  const [major, setMajor] = useState(() => pane?.major || majors[0]?.slug || '')
  const [knobs, setKnobs] = useState(() => ({ ...(pane?.knobs || {}) }))
  const [label, setLabel] = useState(() => pane?.label || '')

  const majorObject = majors.find((entry) => entry.slug === major) || null
  const analysis = analyses.find((entry) => entry.id === figure) || null
  const applicable = useMemo(() => knobsFor(analysis, majorObject), [analysis, majorObject])

  const figureOptions = analyses.map((entry) => {
    const availability = resolveAnalysisAvailability(entry, majorObject)
    const title = itemDetails({ kind: 'analysis', key: entry.id, analysis: entry },
      { isAdmin: false, releasedSet: NO_RELEASES, selectedMajor: majorObject }).title
    // Numbered, because these are addressed as "Figure 3" in the paper, in the
    // meeting notes, and in conversation.
    const named = Number.isFinite(entry.figureNo) ? `Fig. ${entry.figureNo} — ${title}` : title
    return {
      value: entry.id,
      label: availability.available ? named : `${named} — ${availability.label}`,
    }
  })

  const setKnob = (knob, raw) => setKnobs((current) => {
    const next = { ...current }
    if (raw === NOT_PINNED) delete next[knob.key]
    else next[knob.key] = knobValueFromString(knob, raw)
    return next
  })

  const submit = () => {
    // Knobs the chosen figure/major combination does not offer are dropped
    // here rather than stored — a pane must not claim a control it cannot set.
    const kept = {}
    for (const knob of applicable) {
      if (Object.prototype.hasOwnProperty.call(knobs, knob.key)) kept[knob.key] = knobs[knob.key]
    }
    onSubmit({ ...(pane || {}), figure, major, knobs: kept, label: label.trim() || null })
  }

  return (
    <section className='surface-card flex flex-col gap-3.5 p-5' data-export-exclude>
      <p className='text-label'>{pane ? 'Edit view' : 'Add a view'}</p>
      <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
        <label className='flex flex-col gap-1.5'>
          <span className='text-tag ink-subtle'>Figure</span>
          <Select value={figure} onChange={setFigure} options={figureOptions} />
        </label>
        <label className='flex flex-col gap-1.5'>
          <span className='text-tag ink-subtle'>Major</span>
          <Select value={major} onChange={setMajor}
            options={majors.map((entry) => ({ value: entry.slug, label: entry.label }))} />
        </label>
      </div>

      {applicable.length ? (
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          {applicable.map((knob) => (
            <label key={knob.key} className='flex flex-col gap-1.5'>
              <span className='text-tag ink-subtle'>{knob.label}</span>
              <Select value={knobValueAsString(knob, knobs[knob.key])}
                onChange={(raw) => setKnob(knob, raw)} options={knobOptions(knob)} />
            </label>
          ))}
        </div>
      ) : (
        <p className='text-caption ink-subtle'>
          This figure declares no pinnable controls, so the pane renders at its own defaults.
        </p>
      )}

      <label className='flex flex-col gap-1.5'>
        <span className='text-tag ink-subtle'>Caption (optional)</span>
        <Input value={label} onChange={(event) => setLabel(event.target.value)}
          placeholder='Auto-derived from the figure and pinned controls' />
      </label>

      <div className='flex items-center gap-2'>
        <Button size='sm' onClick={submit} disabled={!figure || !major}>{submitLabel}</Button>
        {onCancel && <Button size='sm' variant='ghost' onClick={onCancel}>Cancel</Button>}
      </div>
    </section>
  )
}
