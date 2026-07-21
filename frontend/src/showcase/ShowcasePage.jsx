import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRightIcon,
  ArrowsPointingOutIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  PresentationChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  Alert, Badge, Button, FullScreenPanel, Logo, MarketingSection,
} from '../components/ui'
import { getAnalysisById } from '../analyses/registry'
import { useAccessMe, useVisualSettings } from '../shared/query/hooks/useAccess'
import { canViewBuiltInAnalysis } from '../visuals/analysisVisibility'
import {
  DEGREE_COMPARISON,
  LIMITATIONS,
  SCOPE_METRICS,
  SHOWCASE_FINDINGS,
  SHOWCASE_SNAPSHOT,
  WEDNESDAY_QUESTIONS,
  WEEKLY_REVIEW_QUESTIONS,
} from './showcaseContent'

const COMPLETE_PATHS_BY_CAMPUS = [
  { campus: 'Berkeley', districts: 69 },
  { campus: 'Merced', districts: 64 },
  { campus: 'Riverside', districts: 57 },
  { campus: 'Santa Barbara', districts: 50 },
  { campus: 'Santa Cruz', districts: 47 },
  { campus: 'Irvine', districts: 39 },
  { campus: 'Davis', districts: 30 },
  { campus: 'San Diego', districts: 0 },
  { campus: 'Los Angeles', districts: 0 },
]

function EvidenceBadge({ status }) {
  const variant = status === 'Audited' ? 'success' : 'conservative'
  return <Badge variant={variant}>{status}</Badge>
}

function Hero({ onPresent, presentation }) {
  return (
    <MarketingSection
      band={false}
      className='overflow-hidden border-b border-border'
      containerClassName='py-20'
      bg={(
        <div aria-hidden='true' className='pointer-events-none absolute inset-0 overflow-hidden'>
          <Logo size={420} className='absolute -top-56 left-1/2 -translate-x-1/2 text-primary opacity-[.055]' />
        </div>
      )}
    >
      <div className='relative mx-auto flex max-w-4xl flex-col items-center text-center'>
        <div className='flex items-center gap-2'>
          <Badge variant='accent'>Research showcase</Badge>
          <span className='inline-flex items-center gap-1.5 text-caption text-ink-subtle'>
            <CalendarDaysIcon className='h-4 w-4' aria-hidden='true' />
            {SHOWCASE_SNAPSHOT.compiledOn}
          </span>
        </div>
        <p className='mt-8 text-label'>California transfer pathways research</p>
        <h1 className='mt-3 max-w-4xl text-display-lg text-balance'>
          How much of a community college pathway carries into a UC degree?
        </h1>
        <p className='mt-5 max-w-2xl text-[18px] leading-7 text-ink-muted text-pretty'>
          We connect California degree records, current ASSIST agreements, and UC graduation
          requirements to show what students can complete before transfer and what may remain afterward.
        </p>
        <div className='mt-8 flex items-center gap-3'>
          <span className='rounded-pill bg-surface-sunken px-4 py-2 text-caption text-ink-muted'>
            {SHOWCASE_SNAPSHOT.label}
          </span>
          {!presentation && (
            <Button variant='accent' size='lg' leadingIcon={PresentationChartBarIcon} onClick={onPresent}>
              Present showcase
            </Button>
          )}
        </div>
      </div>
    </MarketingSection>
  )
}

function CompletePathsPreview() {
  return (
    <div className='grid h-full grid-cols-[minmax(0,1fr)_190px] items-center gap-8' role='img'
      aria-label='Complete community college district paths by UC campus, ranging from 69 districts at Berkeley to none at San Diego and Los Angeles'>
      <div className='rounded-2xl border border-border bg-surface px-6 py-5'>
        <div className='flex items-end justify-between gap-4 border-b border-border pb-4'>
          <div>
            <p className='text-body-strong'>Districts with a complete path</p>
            <p className='mt-1 text-caption'>Current required ASSIST groups for each selected program.</p>
          </div>
          <span className='text-tag text-ink-subtle'>out of 72</span>
        </div>
        <div className='mt-4 flex flex-col gap-2.5'>
          {COMPLETE_PATHS_BY_CAMPUS.map((row) => (
            <div key={row.campus} className='grid grid-cols-[92px_minmax(0,1fr)_28px] items-center gap-3'>
              <span className='truncate text-caption text-ink-muted'>{row.campus}</span>
              <div className='h-3 overflow-hidden rounded-pill bg-surface-sunken'>
                <div className={`h-full rounded-pill ${row.districts ? 'bg-primary' : 'bg-danger'}`}
                  style={{ width: row.districts ? `${(row.districts / 72) * 100}%` : '3px' }} />
              </div>
              <span className='text-right text-tag text-ink-muted'>{row.districts}</span>
            </div>
          ))}
        </div>
      </div>
      <div className='flex flex-col gap-4'>
        <div className='rounded-2xl bg-primary-soft px-5 py-6 text-center'>
          <p className='text-display-lg text-primary'>5</p>
          <p className='mt-2 text-body-strong'>campuses for a typical district</p>
        </div>
        <div className='rounded-2xl bg-surface-muted px-5 py-5 text-center'>
          <p className='text-stat-lg'>356 of 648</p>
          <p className='mt-2 text-caption'>district and campus paths are complete</p>
        </div>
      </div>
    </div>
  )
}

function RequirementCoveragePreview() {
  const rows = [
    { label: 'Course requirements designed to transfer', value: 74.6, count: '11,751 of 15,755 slots' },
    { label: 'All modeled graduation requirements', value: 47.1, count: 'includes work reserved for the university' },
  ]
  return (
    <div className='flex h-full flex-col justify-center rounded-2xl border border-border bg-surface px-8 py-7'
      role='img' aria-label='Community colleges cover 74.6 percent of course requirements designed to transfer and 47.1 percent of all modeled graduation requirements'>
      <div className='flex items-end justify-between gap-5'>
        <div>
          <p className='text-body-strong'>Requirement coverage before transfer</p>
          <p className='mt-1 text-caption'>Across 115 colleges and nine selected UC programs.</p>
        </div>
        <Badge variant='conservative'>Graduation model</Badge>
      </div>
      <div className='mt-8 flex flex-col gap-7'>
        {rows.map((row) => (
          <div key={row.label}>
            <div className='mb-2 flex items-end justify-between gap-4'>
              <div>
                <p className='text-body-strong'>{row.label}</p>
                <p className='text-caption'>{row.count}</p>
              </div>
              <p className='text-stat-lg'>{row.value.toFixed(1)}%</p>
            </div>
            <div className='h-5 overflow-hidden rounded-pill bg-surface-sunken'>
              <div className='h-full rounded-pill bg-primary' style={{ width: `${row.value}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className='mt-7 grid grid-cols-2 gap-3 border-t border-border pt-5 text-caption text-ink-muted'>
        <p className='rounded-xl bg-success-soft p-4'>Transferable course slots ask whether an equivalent exists at the college.</p>
        <p className='rounded-xl bg-surface-muted p-4'>The full plan also contains requirements expected after transfer.</p>
      </div>
    </div>
  )
}

function PairedDegreePreview() {
  const rows = [
    { label: 'Local computer science degree', rate: 56.8, extra: '25.8 extra units' },
    { label: 'Associate Degree for Transfer', rate: 66.3, extra: '16.6 extra units' },
  ]
  return (
    <div className='flex h-full flex-col justify-center rounded-2xl border border-border bg-surface px-8 py-7'
      role='img' aria-label='In 21 matched semester system colleges, local degrees average 56.8 percent alignment and transfer degrees average 66.3 percent'>
      <div className='flex items-end justify-between gap-5'>
        <div>
          <p className='text-body-strong'>Matched degree comparison</p>
          <p className='mt-1 text-caption'>The same 21 semester system colleges and the same nine UC programs.</p>
        </div>
        <Badge variant='conservative'>Descriptive result</Badge>
      </div>
      <div className='mt-8 flex flex-col gap-7'>
        {rows.map((row) => (
          <div key={row.label}>
            <div className='mb-2 flex items-end justify-between gap-4'>
              <div>
                <p className='text-body-strong'>{row.label}</p>
                <p className='text-caption'>{row.extra} in the working model</p>
              </div>
              <p className='text-stat-lg'>{row.rate.toFixed(1)}%</p>
            </div>
            <div className='h-5 overflow-hidden rounded-pill bg-surface-sunken'>
              <div className='h-full rounded-pill bg-primary' style={{ width: `${row.rate}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className='mt-7 flex items-center justify-between gap-5 border-t border-border pt-5'>
        <p className='text-caption text-ink-muted'>The transfer degree is higher in 131 of 189 matched campus comparisons.</p>
        <p className='shrink-0 text-body-strong text-success'>9.2 fewer semester units</p>
      </div>
    </div>
  )
}

function VisualPreview({ kind }) {
  if (kind === 'complete-paths') return <CompletePathsPreview />
  if (kind === 'requirement-coverage') return <RequirementCoveragePreview />
  return <PairedDegreePreview />
}

function FindingStage({ activeId, onSelect, onOpen, canOpenAnalysis }) {
  const active = SHOWCASE_FINDINGS.find((finding) => finding.id === activeId) || SHOWCASE_FINDINGS[0]
  const canOpen = canOpenAnalysis(active.analysisId)

  return (
    <MarketingSection band={false} containerClassName='py-24'>
      <div className='mb-9 max-w-3xl'>
        <p className='text-label'>The current research story</p>
        <h2 className='mt-3 text-display'>Three findings worth discussing</h2>
        <p className='mt-3 text-[17px] leading-7 text-ink-muted'>
          These results come from California’s current agreements, graduation requirements, and degree records. The earlier paper reproduction remains an implementation check, not a research finding.
        </p>
      </div>

      <div className='rounded-3xl bg-primary p-5'>
        <div className='grid grid-cols-[minmax(0,1fr)_300px] items-stretch gap-5'>
          <section className='flex min-h-[540px] min-w-0 flex-col overflow-hidden rounded-2xl bg-surface'
            aria-labelledby={`showcase-finding-${active.id}`}>
            <div className='flex items-start gap-5 border-b border-border px-7 py-6'>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <EvidenceBadge status={active.status} />
                  <span className='text-caption'>{active.scope}</span>
                </div>
                <h3 id={`showcase-finding-${active.id}`} className='mt-3 text-heading'>{active.title}</h3>
                <p className='mt-2 max-w-3xl text-body text-ink-muted'>{active.description}</p>
              </div>
              <p className='shrink-0 text-display-lg'>{active.metric}</p>
            </div>
            <button type='button' disabled={!canOpen} onClick={() => canOpen && onOpen(active.analysisId)}
              className='group flex min-h-0 flex-1 flex-col px-7 py-6 text-left transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:hover:bg-transparent'
              aria-label={canOpen ? `${active.actionLabel}: ${active.title}` : `Related visual not released: ${active.title}`}>
              <div className='min-h-0 flex-1'><VisualPreview kind={active.preview} /></div>
              <div className={`mt-5 flex items-center gap-2 text-button ${canOpen ? 'text-primary' : 'text-ink-subtle'}`}>
                <ArrowsPointingOutIcon className='h-4 w-4' aria-hidden='true' />
                {canOpen ? active.actionLabel : 'Related visual is not released for this account'}
                {canOpen && <ArrowRightIcon className='h-4 w-4 transition-transform group-hover:translate-x-1' aria-hidden='true' />}
              </div>
            </button>
          </section>

          <ol className='flex flex-col gap-2'>
            {SHOWCASE_FINDINGS.map((finding, index) => {
              const selected = finding.id === active.id
              return (
                <li key={finding.id} className='flex-1'>
                  <button type='button' onClick={() => onSelect(finding.id)} aria-pressed={selected}
                    className={`flex h-full w-full flex-col rounded-2xl p-5 text-left transition-[background-color,opacity,transform] ${
                      selected ? 'bg-accent text-on-accent' : 'text-on-primary opacity-60 hover:opacity-100'
                    }`}>
                    <div className='flex items-center gap-3'>
                      <span className={`grid h-8 w-8 place-items-center rounded-full text-body-strong ${
                        selected ? 'bg-white text-primary' : 'bg-white/10 text-on-primary'
                      }`}>{index + 1}</span>
                      <span className={`text-tag ${selected ? 'text-on-accent' : 'text-on-primary/70'}`}>
                        {finding.status}
                      </span>
                    </div>
                    <p className='mt-4 text-body-strong'>{finding.title}</p>
                    <p className={`mt-2 text-caption ${selected ? '!text-primary/75' : '!text-on-primary/60'}`}>
                      {finding.question}
                    </p>
                    <p className='mt-auto pt-4 text-stat'>{finding.metric}</p>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </MarketingSection>
  )
}

function ConfidenceSection() {
  return (
    <MarketingSection band={false} className='bg-surface-muted' containerClassName='py-24'>
      <div className='mx-auto max-w-3xl text-center'>
        <p className='text-label'>Verification completed</p>
        <h2 className='mt-3 text-display'>What we have actually checked</h2>
        <p className='mt-3 text-[17px] leading-7 text-ink-muted'>
          The parser audit covers every exact requirement template in the nine selected pathways. Degree outcome estimates remain a separate working model.
        </p>
      </div>
      <div className='mt-10 grid grid-cols-2 gap-6'>
        <article className='flex min-h-[420px] flex-col overflow-hidden rounded-3xl bg-success-soft'>
          <div className='px-8 pt-8'>
            <div className='flex items-center gap-2 text-success'>
              <CheckBadgeIcon className='h-6 w-6' aria-hidden='true' />
              <span className='text-label !text-success'>Direct parser audit</span>
            </div>
            <h3 className='mt-4 text-display'>The audit found no errors that would leave students underprepared.</h3>
            <p className='mt-3 max-w-xl text-[16px] leading-6 text-ink-muted'>
              Forty six template shapes matched exactly. One asked for more coursework than ASSIST requires, and none omitted required work.
            </p>
          </div>
          <div className='mx-6 mt-8 grid flex-1 grid-cols-2 divide-x divide-border overflow-hidden rounded-t-2xl border border-b-0 border-border bg-surface'>
            <div className='flex flex-col justify-end p-7'>
              <p className='text-display-lg'>0</p>
              <p className='mt-2 text-body-strong'>unsafe template errors</p>
              <p className='mt-1 text-caption'>46 exact and 1 conservative</p>
            </div>
            <div className='flex flex-col justify-end p-7'>
              <p className='text-display-lg'>48</p>
              <p className='mt-2 text-body-strong'>live agreement reviews</p>
              <p className='mt-1 text-caption'>41 colleges and all 9 campuses</p>
            </div>
          </div>
        </article>

        <article className='flex min-h-[420px] flex-col overflow-hidden rounded-3xl bg-primary'>
          <div className='px-8 pt-8'>
            <div className='flex items-center gap-2 text-accent'>
              <CheckBadgeIcon className='h-6 w-6' aria-hidden='true' />
              <span className='text-label !text-accent'>Exact template coverage</span>
            </div>
            <h3 className='mt-4 text-display text-on-primary'>Every template shape in the working dataset has a current review.</h3>
            <p className='mt-3 max-w-xl text-[16px] leading-6 text-on-primary/70'>
              One review can represent agreements only when their ASSIST source structure is exactly the same. That gives complete structural coverage without claiming every agreement was reviewed separately.
            </p>
          </div>
          <div className='mx-6 mt-8 flex flex-1 flex-col justify-end rounded-t-2xl border border-b-0 border-white/20 bg-white/10 px-7 py-6 text-on-primary'>
            <div className='flex items-end justify-between gap-6'>
              <div>
                <p className='text-display-lg text-accent'>47 of 47</p>
                <p className='mt-2 text-body-strong'>template variants reviewed</p>
              </div>
              <Badge variant='accent'>100% covered</Badge>
            </div>
            <div className='mt-6 h-3 overflow-hidden rounded-pill bg-white/15'>
              <div className='h-full w-full rounded-pill bg-accent' />
            </div>
            <p className='mt-5 text-caption !text-on-primary/65'>Those exact templates span all 1,035 agreements in the nine selected pathways. All 48 stored reviews still match the current parser output.</p>
          </div>
        </article>
      </div>

      <div className='mt-6 overflow-hidden rounded-2xl border border-border bg-surface'>
        <div className='border-b border-border px-6 py-4'>
          <p className='text-label'>Degree data readiness</p>
          <p className='mt-1 text-caption'>Positive coverage checks that support the new analysis without replacing direct source review.</p>
        </div>
        <dl className='grid grid-cols-4 divide-x divide-border'>
          <div className='p-6'>
            <dt className='text-stat-lg'>199 of 199</dt>
            <dd className='mt-2 text-caption'>stored degree records retain a catalog source and year</dd>
          </div>
          <div className='p-6'>
            <dt className='text-stat-lg'>97.8%</dt>
            <dd className='mt-2 text-caption'>local degree course references link to ASSIST</dd>
          </div>
          <div className='p-6'>
            <dt className='text-stat-lg'>97.1%</dt>
            <dd className='mt-2 text-caption'>transfer degree course references link to ASSIST</dd>
          </div>
          <div className='p-6'>
            <dt className='text-stat-lg'>95.3%</dt>
            <dd className='mt-2 text-caption'>pathway courses have a prerequisite category mapping</dd>
          </div>
        </dl>
      </div>
    </MarketingSection>
  )
}

function DegreeComparisonSection() {
  return (
    <MarketingSection band={false} containerClassName='py-24'>
      <div className='grid grid-cols-[360px_minmax(0,1fr)] items-start gap-14'>
        <div>
          <p className='text-label'>A working California comparison</p>
          <h2 className='mt-3 text-display'>Degree types differ in how much work carries forward.</h2>
          <p className='mt-4 text-[16px] leading-7 text-ink-muted'>
            Holding the college set and unit system constant, the Associate Degree for Transfer has a higher modeled credit rate and 9.2 fewer semester units of additional work. This is a descriptive comparison, not evidence that the degree type caused the difference.
          </p>
          <div className='mt-6 rounded-2xl bg-primary-soft p-5'>
            <p className='text-body-strong'>Shared comparison group</p>
            <p className='mt-1 text-caption'>Twenty one semester system colleges have both a local computer science associate degree and an Associate Degree for Transfer record. The quarter system college is kept out of the unit comparison.</p>
          </div>
        </div>
        <div className='overflow-hidden rounded-2xl border border-border bg-surface'>
          <div className='grid grid-cols-[minmax(0,1fr)_160px_180px] border-b border-border bg-surface-muted px-6 py-3 text-label'>
            <span>Degree pathway</span>
            <span>Credit that counts</span>
            <span>Modeled extra units</span>
          </div>
          {DEGREE_COMPARISON.map((degree) => (
            <div key={degree.label}
              className='grid grid-cols-[minmax(0,1fr)_160px_180px] items-center border-b border-border px-6 py-6 last:border-b-0'>
              <div>
                <p className='text-body-strong'>{degree.label}</p>
                <p className='mt-1 text-caption'>{degree.colleges}</p>
              </div>
              <p className='text-stat-lg'>{degree.creditRate}</p>
              <div>
                <p className='text-stat-lg'>{degree.extraUnits}</p>
                <p className='mt-1 text-caption'>semester units in the working model</p>
              </div>
            </div>
          ))}
          <div className='border-t border-border bg-surface-muted px-6 py-4 text-caption'>
            Values are frozen to the {SHOWCASE_SNAPSHOT.compiledOn.toLowerCase()} working snapshot.
          </div>
        </div>
      </div>
    </MarketingSection>
  )
}

function ScopeBand() {
  return (
    <MarketingSection band={false} containerClassName='py-24'>
      <div className='relative overflow-hidden rounded-3xl bg-primary px-10 py-14 text-on-primary'>
        <Logo size={260} className='pointer-events-none absolute -bottom-32 -left-24 text-accent opacity-10' />
        <div className='relative grid grid-cols-2 items-center gap-16'>
          <div>
            <p className='text-label !text-on-primary/60'>Dataset scope</p>
            <h2 className='mt-3 text-display text-on-primary'>Built on a statewide working dataset.</h2>
            <p className='mt-4 max-w-lg text-[17px] leading-7 text-on-primary/70'>
              The source corpus spans the California community college and UC systems. The current findings use one selected computer science program at each of nine UC campuses; the broader corpus retains 21 candidate campus and major combinations.
            </p>
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

function MethodSection() {
  const readiness = [
    { label: 'Audited', copy: 'A person compared the parser result with the source structure for an exact template variant.' },
    { label: 'Working finding', copy: 'The result uses current California data, but its source records or assumptions still need research review.' },
    { label: 'Live visual', copy: 'The detail view reads the current endpoint and may move after this dated snapshot.' },
  ]
  return (
    <MarketingSection band={false} className='border-y border-border bg-surface-muted' containerClassName='py-24'>
      <div className='grid grid-cols-[360px_minmax(0,1fr)] gap-14'>
        <div>
          <p className='text-label'>How to read the evidence</p>
          <h2 className='mt-3 text-display'>Confidence and caveats stay beside the findings.</h2>
          <p className='mt-4 text-[16px] leading-7 text-ink-muted'>
            The paper reproduction checks the implementation behind the scenes. It is not presented as a California finding. Every result here keeps its current evidence status and limitations nearby.
          </p>
          <div className='mt-7 flex items-center gap-2 text-caption text-ink-muted'>
            <EyeIcon className='h-5 w-5 text-primary' aria-hidden='true' />
            Read only means this page contains no editing, task, audit, or publishing controls.
          </div>
        </div>
        <div className='grid grid-cols-2 gap-6'>
          <div className='overflow-hidden rounded-2xl border border-border bg-surface'>
            <h3 className='border-b border-border px-6 py-4 text-body-strong'>Evidence labels</h3>
            {readiness.map((item) => (
              <div key={item.label} className='border-b border-border px-6 py-5 last:border-b-0'>
                <div className='flex items-center gap-2'>
                  {item.label === 'Live visual'
                    ? <Badge variant='accent'>{item.label}</Badge>
                    : <EvidenceBadge status={item.label} />}
                </div>
                <p className='mt-2 text-caption text-ink-muted'>{item.copy}</p>
              </div>
            ))}
          </div>
          <div className='overflow-hidden rounded-2xl border border-border bg-surface'>
            <h3 className='border-b border-border px-6 py-4 text-body-strong'>Limitations kept visible</h3>
            <ul className='divide-y divide-border'>
              {LIMITATIONS.map((limitation) => (
                <li key={limitation} className='flex gap-3 px-6 py-3.5 text-caption text-ink-muted'>
                  <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-conservative' aria-hidden='true' />
                  {limitation}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </MarketingSection>
  )
}

function QuestionList({ title, eyebrow, questions }) {
  return (
    <article className='overflow-hidden rounded-2xl border border-border bg-surface text-left'>
      <div className='border-b border-border px-6 py-5'>
        <p className='text-label'>{eyebrow}</p>
        <h3 className='mt-2 text-heading'>{title}</h3>
      </div>
      <ol className='divide-y divide-border'>
        {questions.map((question, index) => (
          <li key={question} className='grid grid-cols-[32px_minmax(0,1fr)] gap-3 px-6 py-4'>
            <span className='grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-tag text-primary'>{index + 1}</span>
            <p className='pt-1 text-body text-ink-muted'>{question}</p>
          </li>
        ))}
      </ol>
    </article>
  )
}

function MeetingQuestions() {
  return (
    <MarketingSection band={false} containerClassName='py-24'>
      <div className='mx-auto max-w-3xl text-center'>
        <ChatBubbleLeftRightIcon className='mx-auto h-8 w-8 text-success' aria-hidden='true' />
        <h2 className='mt-5 text-display'>What do we need to learn next?</h2>
        <p className='mt-3 text-[17px] leading-7 text-ink-muted'>
          The best outcome from each meeting is a smaller set of assumptions and a clearer next verification step.
        </p>
      </div>
      <div className='mt-10 grid grid-cols-2 gap-6'>
        <QuestionList eyebrow='Wednesday methods conversation' title='Questions for the Massachusetts team' questions={WEDNESDAY_QUESTIONS} />
        <QuestionList eyebrow='Weekly research review' title='Questions for the professor' questions={WEEKLY_REVIEW_QUESTIONS} />
      </div>
      <p className='mt-10 text-center text-caption'>
        Prototype showcase. Compiled {SHOWCASE_SNAPSHOT.compiledOn}. Narrative values remain fixed until the next prepared update.
      </p>
    </MarketingSection>
  )
}

function ShowcaseStory({
  activeFindingId, onSelectFinding, onOpen, onPresent, canOpenAnalysis, presentation = false,
}) {
  return (
    <div className='bg-canvas text-ink'>
      <Hero onPresent={onPresent} presentation={presentation} />
      <FindingStage activeId={activeFindingId} onSelect={onSelectFinding}
        onOpen={onOpen} canOpenAnalysis={canOpenAnalysis} />
      <ConfidenceSection />
      <DegreeComparisonSection />
      <ScopeBand />
      <MethodSection />
      <MeetingQuestions />
    </div>
  )
}

export default function ShowcasePage() {
  const [presenting, setPresenting] = useState(false)
  const [activeFindingId, setActiveFindingId] = useState(SHOWCASE_FINDINGS[0].id)
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null)
  const presentationScrollTop = useRef(0)
  const restorePresentationScroll = useRef(false)
  const access = useAccessMe()
  const visualSettings = useVisualSettings()
  const analysisAccess = useMemo(() => ({
    isAdmin: access.data?.role === 'admin',
    releasedIds: visualSettings.data?.released_ids || [],
    disabledIds: visualSettings.data?.disabled_ids || [],
  }), [access.data?.role, visualSettings.data?.disabled_ids, visualSettings.data?.released_ids])
  const canOpenAnalysis = (analysisId) => !visualSettings.isLoading && !visualSettings.isError
    && canViewBuiltInAnalysis(analysisId, analysisAccess)
  const selected = useMemo(
    () => SHOWCASE_FINDINGS.find((finding) => finding.analysisId === selectedAnalysisId) || null,
    [selectedAnalysisId]
  )
  const analysis = selected ? getAnalysisById(selected.analysisId) : null
  const Visual = analysis?.Component || null

  const openAnalysis = (analysisId) => {
    if (presenting && typeof document !== 'undefined') {
      const dialog = document.querySelector('[role="dialog"][aria-label="California transfer pathways"]')
      presentationScrollTop.current = dialog?.querySelector('.overflow-auto')?.scrollTop || 0
    }
    setSelectedAnalysisId(analysisId)
  }

  const closeAnalysis = () => {
    restorePresentationScroll.current = presenting
    setSelectedAnalysisId(null)
  }

  useEffect(() => {
    if (!presenting || selected || !restorePresentationScroll.current || typeof document === 'undefined') return undefined
    const frame = window.requestAnimationFrame(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="California transfer pathways"]')
      const scrollArea = dialog?.querySelector('.overflow-auto')
      if (scrollArea) scrollArea.scrollTop = presentationScrollTop.current
      restorePresentationScroll.current = false
    })
    return () => window.cancelAnimationFrame(frame)
  }, [presenting, selected])

  return (
    <>
      <ShowcaseStory activeFindingId={activeFindingId} onSelectFinding={setActiveFindingId}
        onOpen={openAnalysis} canOpenAnalysis={canOpenAnalysis}
        onPresent={() => setPresenting(true)} />

      <FullScreenPanel open={presenting && !selected} onClose={() => setPresenting(false)}
        title='California transfer pathways' subtitle={`Research showcase, ${SHOWCASE_SNAPSHOT.label.toLowerCase()}, ${SHOWCASE_SNAPSHOT.compiledOn}`}
        actions={<Badge variant='accent'>Presentation mode</Badge>}>
        <ShowcaseStory presentation activeFindingId={activeFindingId}
          onSelectFinding={setActiveFindingId} onOpen={openAnalysis} canOpenAnalysis={canOpenAnalysis} />
      </FullScreenPanel>

      <FullScreenPanel open={!!selected} onClose={closeAnalysis}
        title={selected?.title} subtitle={selected ? `${selected.status} finding, ${selected.scope}` : undefined}
        ariaLabel={selected ? `${selected.title} full visual` : 'Full visual'}>
        {selected && (
          <div className='flex flex-col gap-5'>
            <Alert type='info'>
              This is a related live, read only visual. {selected.liveNote} Its current values may also move after the narrative snapshot compiled on {SHOWCASE_SNAPSHOT.compiledOn}.
            </Alert>
            <div className='grid grid-cols-[300px_minmax(0,1fr)] items-start gap-8'>
              <aside className='rounded-2xl border border-border bg-surface-muted p-5'>
                <EvidenceBadge status={selected.status} />
                <p className='mt-4 text-label'>Research question</p>
                <p className='mt-2 text-body text-ink-muted'>{selected.question}</p>
                <p className='mt-5 text-label'>Method note</p>
                <p className='mt-2 text-body text-ink-muted'>{selected.method}</p>
              </aside>
              <section className='min-w-0 rounded-2xl border border-border bg-surface p-6'>
                {Visual ? <Visual /> : <Alert type='error'>This visual is not available in the current application.</Alert>}
              </section>
            </div>
          </div>
        )}
      </FullScreenPanel>
    </>
  )
}
