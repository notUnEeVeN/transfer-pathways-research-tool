/**
 * Act 3 — what this dataset carries that a coverage analysis alone does not.
 *
 * The concept graph mounts live and keeps its own college picker, so a viewer
 * can switch colleges during a walkthrough. The readiness figures beside it
 * stay frozen with the rest of the showcase narrative.
 */

import React from 'react'
import { Badge, MarketingSection } from '../components/ui'
import ConceptGraphView from '../prereqs/ConceptGraphView'
import { DEGREE_READINESS, PREREQ_EXHIBIT } from './showcaseContent'

export default function BeyondPaper() {
  return (
    <MarketingSection band={false} containerClassName='py-24'>
      <div className='grid grid-cols-[360px_minmax(0,1fr)] items-start gap-14'>
        <div>
          <p className='text-label'>Beyond the paper</p>
          <h2 className='mt-3 text-display'>{PREREQ_EXHIBIT.heading}</h2>
          <p className='mt-4 text-[16px] leading-7 text-ink-muted'>{PREREQ_EXHIBIT.body}</p>
          <dl className='mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface'>
            {DEGREE_READINESS.map((row) => (
              <div key={row.label} className='px-5 py-4'>
                <dt className='text-stat-lg'>{row.value}</dt>
                <dd className='mt-1 text-caption'>{row.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className='min-w-0 rounded-2xl border border-border bg-surface p-6'>
          <div className='mb-4 flex items-center justify-between gap-3'>
            <p className='text-body-strong'>Prerequisite concept graph</p>
            <Badge variant='accent'>Live visual</Badge>
          </div>
          <ConceptGraphView initialCollegeId={PREREQ_EXHIBIT.initialCollegeId} />
        </div>
      </div>
    </MarketingSection>
  )
}
