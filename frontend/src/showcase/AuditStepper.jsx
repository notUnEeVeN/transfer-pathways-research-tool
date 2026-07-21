/**
 * Act 2 — how the parsed corpus earns trust.
 *
 * The stepper explains the chain from raw agreements to a published error
 * bound. Values are frozen editorial copy: the gauge stays empty until the
 * six bound fields are read off the live Audit stats page at snapshot time,
 * because an estimated accuracy bound would be worse than none.
 */

import React, { useState } from 'react'
import { MarketingSection } from '../components/ui'
import { AUDIT_STORY } from './showcaseContent'

function BoundStage({ bound }) {
  if (bound.ceilingPct === null) {
    return (
      <div className='rounded-2xl border border-border bg-surface-muted p-8 text-center'>
        <p className='text-caption text-ink-muted'>{bound.pendingNote}</p>
      </div>
    )
  }
  const pos = (v) => `${Math.min(100, Math.max(0, v))}%`
  return (
    <div className='rounded-2xl border border-border bg-surface p-8'>
      <div className='flex flex-wrap items-start justify-between gap-6'>
        <div>
          <p className='text-stat-lg'>
            <span className='text-ink-subtle' style={{ fontSize: '0.6em' }}>≤ </span>
            {bound.ceilingPct.toFixed(1)}%
          </p>
          <p className='mt-2 text-caption text-ink-subtle'>
            observed <span className='text-ink'>{bound.observedPct}%</span> · {bound.k}/{bound.n} templates
          </p>
        </div>
        <div className='text-right'>
          <p className='text-stat'>≤ {bound.estMax}</p>
          <p className='mt-1 text-caption text-ink-subtle'>docs may deviate of {bound.totalDocs}</p>
        </div>
      </div>
      <div className='relative mt-6 h-3 rounded-pill bg-surface-sunken'>
        <div className='absolute inset-y-0 left-0 rounded-pill bg-primary/30' style={{ width: pos(bound.ceilingPct) }} />
        <div className='absolute inset-y-0 w-1 rounded-pill bg-primary' style={{ left: pos(bound.observedPct) }} />
      </div>
      <div className='mt-2 flex justify-between text-tag text-ink-subtle'>
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

export default function AuditStepper() {
  const [activeId, setActiveId] = useState(AUDIT_STORY.steps[0].id)
  const active = AUDIT_STORY.steps.find((step) => step.id === activeId) || AUDIT_STORY.steps[0]

  return (
    <MarketingSection band={false} className='bg-surface-muted' containerClassName='py-24'>
      <div className='mb-9 max-w-3xl'>
        <p className='text-label'>How the data earns trust</p>
        <h2 className='mt-3 text-display'>An audit with a published bound, not a promise</h2>
        <p className='mt-3 text-[17px] leading-7 text-ink-muted'>{AUDIT_STORY.intro}</p>
      </div>

      <div className='grid grid-cols-4 gap-3'>
        {AUDIT_STORY.steps.map((step, index) => (
          <button key={step.id} type='button' aria-pressed={step.id === activeId}
            onClick={() => setActiveId(step.id)}
            className={`rounded-2xl p-5 text-left transition-colors ${
              step.id === activeId
                ? 'bg-primary text-on-primary'
                : 'border border-border bg-surface hover:bg-surface-hover'
            }`}>
            <span className={`grid h-8 w-8 place-items-center rounded-full text-body-strong ${
              step.id === activeId ? 'bg-white text-primary' : 'bg-primary-soft text-primary'
            }`}>{index + 1}</span>
            <p className='mt-3 text-body-strong'>{step.label}</p>
          </button>
        ))}
      </div>

      <div className='mt-5 rounded-3xl border border-border bg-surface p-8'>
        <div className='grid grid-cols-[280px_minmax(0,1fr)] items-start gap-10'>
          {active.id === 'bound' ? (
            <>
              <p className='text-body text-ink-muted'>{active.body}</p>
              <BoundStage bound={AUDIT_STORY.bound} />
            </>
          ) : (
            <>
              <div>
                <p className='text-display-lg text-primary'>{active.stat}</p>
                <p className='mt-2 text-body-strong'>{active.statLabel}</p>
              </div>
              <div>
                <p className='text-body text-ink-muted'>{active.body}</p>
                {active.facts && (
                  <ul className='mt-5 grid grid-cols-2 gap-3'>
                    {active.facts.map((fact) => (
                      <li key={fact} className='rounded-xl bg-success-soft px-4 py-3 text-caption'>{fact}</li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </MarketingSection>
  )
}
