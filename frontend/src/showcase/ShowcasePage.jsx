import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDaysIcon,
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
import { EvidenceBadge } from './previews'
import FigureStage, { STAGE_ENTRIES } from './FigureStage'
import AuditStepper from './AuditStepper'
import BeyondPaper from './BeyondPaper'
import PlatformBand from './PlatformBand'
import {
  LIMITATIONS,
  SHOWCASE_HERO,
  SHOWCASE_SNAPSHOT,
  WEDNESDAY_QUESTIONS,
} from './showcaseContent'

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
        <p className='mt-8 text-label'>{SHOWCASE_HERO.eyebrow}</p>
        <h1 className='mt-3 max-w-4xl text-display-lg text-balance'>{SHOWCASE_HERO.title}</h1>
        <p className='mt-5 max-w-2xl text-[18px] leading-7 text-ink-muted text-pretty'>{SHOWCASE_HERO.lede}</p>
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

function MethodSection() {
  const readiness = [
    { label: 'Audited', copy: 'A person compared the parser result with the source structure for an exact template variant.' },
    { label: 'Working finding', copy: 'The result uses current California data, but its source records or assumptions still need research review.' },
    { label: 'Live visual', copy: 'The detail view reads the current endpoint and may move after this dated snapshot.' },
  ]
  return (
    <MarketingSection band={false} className='border-y border-border' containerClassName='py-24'>
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
      <div className='mx-auto mt-10 max-w-2xl'>
        <QuestionList eyebrow='Wednesday methods conversation' title='Questions for the Massachusetts team'
          questions={WEDNESDAY_QUESTIONS} />
      </div>
      <p className='mt-10 text-center text-caption'>
        Prototype showcase. Compiled {SHOWCASE_SNAPSHOT.compiledOn}. Narrative values remain fixed until the next prepared update.
      </p>
    </MarketingSection>
  )
}

function ShowcaseStory({
  activeEntryId, onSelectEntry, onOpen, onPresent, canOpenAnalysis, presentation = false,
}) {
  return (
    <div className='bg-canvas text-ink'>
      <Hero onPresent={onPresent} presentation={presentation} />
      <FigureStage activeId={activeEntryId} onSelect={onSelectEntry}
        onOpen={onOpen} canOpenAnalysis={canOpenAnalysis} />
      <AuditStepper />
      <MethodSection />
      <BeyondPaper />
      <PlatformBand />
      <MeetingQuestions />
    </div>
  )
}

export default function ShowcasePage() {
  const [presenting, setPresenting] = useState(false)
  const [activeEntryId, setActiveEntryId] = useState(STAGE_ENTRIES[0].id)
  const [selectedEntry, setSelectedEntry] = useState(null)
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
  const analysis = selectedEntry ? getAnalysisById(selectedEntry.analysisId) : null
  const Visual = analysis?.Component || null

  const openAnalysis = (entry) => {
    if (presenting && typeof document !== 'undefined') {
      const dialog = document.querySelector('[role="dialog"][aria-label="California transfer pathways"]')
      presentationScrollTop.current = dialog?.querySelector('.overflow-auto')?.scrollTop || 0
    }
    setSelectedEntry(entry)
  }

  const closeAnalysis = () => {
    restorePresentationScroll.current = presenting
    setSelectedEntry(null)
  }

  useEffect(() => {
    if (!presenting || selectedEntry || !restorePresentationScroll.current || typeof document === 'undefined') return undefined
    const frame = window.requestAnimationFrame(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="California transfer pathways"]')
      const scrollArea = dialog?.querySelector('.overflow-auto')
      if (scrollArea) scrollArea.scrollTop = presentationScrollTop.current
      restorePresentationScroll.current = false
    })
    return () => window.cancelAnimationFrame(frame)
  }, [presenting, selectedEntry])

  return (
    <>
      <ShowcaseStory activeEntryId={activeEntryId} onSelectEntry={setActiveEntryId}
        onOpen={openAnalysis} canOpenAnalysis={canOpenAnalysis}
        onPresent={() => setPresenting(true)} />

      <FullScreenPanel open={presenting && !selectedEntry} onClose={() => setPresenting(false)}
        title='California transfer pathways' subtitle={`Research showcase, ${SHOWCASE_SNAPSHOT.label.toLowerCase()}, ${SHOWCASE_SNAPSHOT.compiledOn}`}
        actions={<Badge variant='accent'>Presentation mode</Badge>}>
        <ShowcaseStory presentation activeEntryId={activeEntryId}
          onSelectEntry={setActiveEntryId} onOpen={openAnalysis} canOpenAnalysis={canOpenAnalysis} />
      </FullScreenPanel>

      <FullScreenPanel open={!!selectedEntry} onClose={closeAnalysis}
        title={selectedEntry?.title}
        subtitle={selectedEntry
          ? (selectedEntry.provenance || `${selectedEntry.status} finding, ${selectedEntry.scope}`)
          : undefined}
        ariaLabel={selectedEntry ? `${selectedEntry.title} full visual` : 'Full visual'}>
        {selectedEntry && (
          <div className='flex flex-col gap-5'>
            <Alert type='info'>
              This is a related live, read only visual. {selectedEntry.liveNote} Its current values may also move after the narrative snapshot compiled on {SHOWCASE_SNAPSHOT.compiledOn}.
            </Alert>
            <div className='grid grid-cols-[300px_minmax(0,1fr)] items-start gap-8'>
              <aside className='rounded-2xl border border-border bg-surface-muted p-5'>
                {selectedEntry.entryKind === 'figure'
                  ? <Badge variant='accent'>Live visual</Badge>
                  : <EvidenceBadge status={selectedEntry.status} />}
                <p className='mt-4 text-label'>Research question</p>
                <p className='mt-2 text-body text-ink-muted'>{selectedEntry.question}</p>
                <p className='mt-5 text-label'>Method note</p>
                <p className='mt-2 text-body text-ink-muted'>{selectedEntry.method}</p>
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
