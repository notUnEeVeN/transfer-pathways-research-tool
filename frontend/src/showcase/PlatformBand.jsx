/**
 * Act 4 — the surfaces behind the figures, and the dataset they run on.
 *
 * Text-first cards on purpose: these surfaces are gated and stateful, so they
 * are described rather than embedded. Screenshot thumbnails can be added
 * later without changing the layout.
 */

import React from 'react'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { Logo, MarketingSection } from '../components/ui'
import { PLATFORM_SURFACES, SCOPE_METRICS, SHOWCASE_SNAPSHOT } from './showcaseContent'

export default function PlatformBand() {
  return (
    <MarketingSection band={false} className='border-y border-border bg-surface-muted' containerClassName='py-24'>
      <div className='mb-9 max-w-3xl'>
        <p className='text-label'>The platform</p>
        <h2 className='mt-3 text-display'>A living research instrument, not a one-off analysis</h2>
        <p className='mt-3 text-[17px] leading-7 text-ink-muted'>
          Every figure in this showcase is a page in a working tool. The same interface carries the
          data, the audit, and the publishing controls that produced what you just saw.
        </p>
      </div>

      <div className='grid grid-cols-4 gap-5'>
        {PLATFORM_SURFACES.map((surface) => (
          <article key={surface.id} className='rounded-2xl border border-border bg-surface p-6'>
            <h3 className='text-body-strong'>{surface.title}</h3>
            <p className='mt-2 text-caption text-ink-muted'>{surface.body}</p>
          </article>
        ))}
      </div>

      <div className='relative mt-10 overflow-hidden rounded-3xl bg-primary px-10 py-12 text-on-primary'>
        <Logo size={260} className='pointer-events-none absolute -bottom-32 -left-24 text-accent opacity-10' />
        <div className='relative grid grid-cols-2 items-center gap-16'>
          <div>
            <p className='text-label !text-on-primary/60'>Dataset scope</p>
            <h3 className='mt-3 text-display text-on-primary'>Built on a statewide working dataset.</h3>
            <p className='mt-6 inline-flex items-center gap-2 text-caption !text-on-primary/60'>
              <CalendarDaysIcon className='h-4 w-4' aria-hidden='true' />
              ASSIST source refresh: {SHOWCASE_SNAPSHOT.assistRefreshedOn}
            </p>
          </div>
          <dl className='grid grid-cols-2 gap-x-10 gap-y-10'>
            {SCOPE_METRICS.map((metric) => (
              <div key={metric.label}>
                <dt className='text-display-lg text-accent'>{metric.value}</dt>
                <dd className='mt-2 max-w-[220px] text-body text-on-primary/65'>{metric.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </MarketingSection>
  )
}
