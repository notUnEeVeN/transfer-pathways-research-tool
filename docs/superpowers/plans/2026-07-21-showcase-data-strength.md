# Showcase Data-Strength Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-21-showcase-data-strength-design.md` — read it first; it holds the rationale and the five-act structure.

**Goal:** Restructure the gated research showcase into a five-act data-strength narrative for the Massachusetts research group, with real interactive components embedded in-page.

**Architecture:** The existing `ShowcasePage.jsx` keeps its frozen-content convention (`showcaseContent.js`), its `FullScreenPanel` presentation mode, and its per-analysis gating. New act sections are extracted into focused showcase-local components (`FigureStage`, `AuditStepper`, `BeyondPaper`, `PlatformBand`); the page file becomes a thin composition. Live analysis components from `analyses/registry.js` and the prereq `ConceptGraphView` are embedded directly; every headline number stays hand-authored and frozen.

**Tech Stack:** React 18 + Vite, Tailwind utility classes via the project's design tokens (`text-display`, `surface-card`, etc.), vitest + @testing-library/react. No new dependencies.

## Global Constraints

- **No intermediate commits.** Tybalt's workflow: no commits until the feature is fully implemented (see memory: commit-workflow-hold-until-complete). Every task ends by running tests, not by committing. One commit at the very end (Task 8). Never push.
- **Frozen narrative values** live only in `frontend/src/showcase/showcaseContent.js`, hand-authored, with the snapshot date. Embedded live components are labeled live.
- **Never fabricate audit statistics.** The Wilson-bound gauge values ship as `null` with a designed "pending snapshot" state until they are read off the live Audit → Stats page (Task 8). All other frozen numbers below are already verified on the current showcase page.
- **Read-only page**: no editing, task, audit, or publishing controls.
- **Verification notes are user-authored** — never generate note text anywhere.
- Work happens on the current branch (`as-degree-data`).
- Test commands run from `frontend/`: `npx vitest run src/showcase` (scoped) and `npx vitest run` (full, Task 8 only).

## File Structure

| File | Role |
|---|---|
| `frontend/src/showcase/showcaseContent.js` (modify) | All frozen copy + numbers for the five acts |
| `frontend/src/showcase/showcaseContent.test.js` (create) | Shape test for the content module |
| `frontend/src/showcase/previews.jsx` (create) | The three hand-drawn finding previews + `EvidenceBadge`, moved out of `ShowcasePage.jsx` verbatim |
| `frontend/src/showcase/FigureStage.jsx` (create) | Act 1: interactive stage over figure ports + findings |
| `frontend/src/showcase/FigureStage.test.jsx` (create) | Stage behavior tests |
| `frontend/src/showcase/AuditStepper.jsx` (create) | Act 2: audit process stepper + frozen Wilson gauge |
| `frontend/src/showcase/AuditStepper.test.jsx` (create) | Stepper tests |
| `frontend/src/showcase/BeyondPaper.jsx` (create) | Act 3: `ConceptGraphView` embed + degree readiness strip |
| `frontend/src/showcase/BeyondPaper.test.jsx` (create) | Embed tests (hooks mocked) |
| `frontend/src/showcase/PlatformBand.jsx` (create) | Act 4: platform cards + scope band |
| `frontend/src/showcase/ShowcasePage.jsx` (modify) | Hero copy, act composition, full-screen wiring; removes superseded sections |
| `frontend/src/showcase/ShowcasePage.test.jsx` (modify) | Integration tests for the new structure |

Nothing outside `frontend/src/showcase/` changes.

---

### Task 1: Content module — five-act frozen content

**Files:**
- Modify: `frontend/src/showcase/showcaseContent.js`
- Test: `frontend/src/showcase/showcaseContent.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all named exports, consumed by Tasks 3–7):
  - existing, unchanged: `SHOWCASE_SNAPSHOT`, `SCOPE_METRICS`, `SHOWCASE_FINDINGS`, `DEGREE_COMPARISON`, `LIMITATIONS`, `WEDNESDAY_QUESTIONS`, `WEEKLY_REVIEW_QUESTIONS`
  - new: `SHOWCASE_HERO` `{ eyebrow, title, lede }`
  - new: `FEATURED_FIGURES` — array of `{ id, analysisId, provenance, metric, metricLabel, title, question, method, scope, actionLabel, liveNote }`
  - new: `AUDIT_STORY` — `{ intro, steps: [{ id, label, stat, statLabel, body, facts? }], bound: { ceilingPct, observedPct, k, n, estMax, totalDocs, pendingNote } }`
  - new: `DEGREE_READINESS` — array of `{ value, label }`
  - new: `PREREQ_EXHIBIT` — `{ initialCollegeId, heading, body }`
  - new: `PLATFORM_SURFACES` — array of `{ id, title, body }`

- [ ] **Step 1: Write the failing shape test**

Create `frontend/src/showcase/showcaseContent.test.js`:

```js
import { describe, expect, it } from 'vitest'
import {
  AUDIT_STORY,
  DEGREE_READINESS,
  FEATURED_FIGURES,
  PLATFORM_SURFACES,
  PREREQ_EXHIBIT,
  SHOWCASE_FINDINGS,
  SHOWCASE_HERO,
} from './showcaseContent'

describe('showcase content module', () => {
  it('features the four ported figures ahead of the three findings', () => {
    expect(FEATURED_FIGURES.map((f) => f.analysisId)).toEqual([
      'paper-district-heatmap',
      'transfer-credit-rate',
      'transfer-extra-units',
      'coverage-heatmap',
    ])
    expect(SHOWCASE_FINDINGS).toHaveLength(3)
    for (const figure of FEATURED_FIGURES) {
      expect(figure.provenance).toMatch(/Massachusetts/)
      expect(figure.metric).toBeTruthy()
      expect(figure.liveNote).toBeTruthy()
    }
  })

  it('tells the audit story in four steps and never fabricates the bound', () => {
    expect(AUDIT_STORY.steps.map((s) => s.id)).toEqual([
      'corpus', 'templates', 'review', 'bound',
    ])
    // The gauge ships empty until values are read off the live Audit stats
    // page at snapshot time. Frozen numbers must be entered by hand, so a
    // filled-in gauge must carry every field together.
    const g = AUDIT_STORY.bound
    const filled = [g.ceilingPct, g.observedPct, g.k, g.n, g.estMax, g.totalDocs]
    const allNull = filled.every((v) => v === null)
    const allSet = filled.every((v) => typeof v === 'number')
    expect(allNull || allSet).toBe(true)
    expect(g.pendingNote).toBeTruthy()
  })

  it('keeps hero, readiness, prereq exhibit, and platform cards present', () => {
    expect(SHOWCASE_HERO.title).toBeTruthy()
    expect(DEGREE_READINESS).toHaveLength(4)
    expect(PREREQ_EXHIBIT.heading).toBeTruthy()
    expect(PLATFORM_SURFACES).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd frontend && npx vitest run src/showcase/showcaseContent.test.js`
Expected: FAIL — `SHOWCASE_HERO` (and the other new names) are not exported.

- [ ] **Step 3: Add the new content to `showcaseContent.js`**

Keep every existing export untouched. Append:

```js
export const SHOWCASE_HERO = {
  eyebrow: 'California transfer pathways research',
  title: 'Your figures, rebuilt on California data',
  lede: 'We ported the Massachusetts transfer pathways analyses to California: 115 community colleges, nine UC computer science programs, current ASSIST agreements, and an audited requirement dataset behind every figure.',
}

export const FEATURED_FIGURES = [
  {
    id: 'figure-district-coverage',
    analysisId: 'paper-district-heatmap',
    provenance: 'After the Massachusetts paper’s district coverage figure',
    metric: '356 of 648',
    metricLabel: 'district and campus paths are complete',
    title: 'Which districts have a complete path to each UC campus',
    question: 'Can a student in each community college district finish every required course group before transfer?',
    scope: '72 districts and 9 selected programs',
    method: 'Uses each program’s current required ASSIST groups and counts a district as complete when its member colleges collectively cover every group.',
    actionLabel: 'Open the full district heatmap',
    liveNote: 'The live heatmap reads current agreements and may move after the frozen snapshot.',
  },
  {
    id: 'figure-credit-rate',
    analysisId: 'transfer-credit-rate',
    provenance: 'After Figure 3 of the Massachusetts paper',
    metric: '66.3%',
    metricLabel: 'transfer degree credit counts toward graduation at matched colleges',
    title: 'How much of an associate degree counts toward a UC degree',
    question: 'What share of a computer science associate degree carries into each UC graduation plan?',
    scope: '21 matched semester colleges and 9 UC campuses',
    method: 'Applies the same articulation and graduation requirement model to both degree types at the same colleges.',
    actionLabel: 'Open the full credit rate figure',
    liveNote: 'The live figure shows the full local and transfer cohorts, not only the matched 21 college slice.',
  },
  {
    id: 'figure-extra-units',
    analysisId: 'transfer-extra-units',
    provenance: 'After Figure 4 of the Massachusetts paper',
    metric: '+16.6',
    metricLabel: 'modeled extra semester units for transfer degree holders',
    title: 'Additional coursework after transfer',
    question: 'How many extra units may transfer students need compared with students who began at the university?',
    scope: '21 matched semester colleges and 9 UC campuses',
    method: 'Extra units are the associate degree total minus the requirement work it covers — a modeled burden, not observed time to degree.',
    actionLabel: 'Open the full extra units figure',
    liveNote: 'The live figure reads the current working model and may move after the frozen snapshot.',
  },
  {
    id: 'figure-coverage',
    analysisId: 'coverage-heatmap',
    provenance: 'After the Massachusetts paper’s requirement coverage lens',
    metric: '74.6%',
    metricLabel: 'of transfer-designed course requirements have a community college equivalent',
    title: 'Graduation requirement coverage before transfer',
    question: 'How much of a UC graduation plan can be completed at each community college?',
    scope: '1,035 college and campus pairs',
    method: 'Counts course requirements marked transferable separately from breadth and work reserved for the university.',
    actionLabel: 'Open the full coverage heatmap',
    liveNote: 'The live heatmap opens on all modeled graduation requirements; the 74.6% value isolates requirements meant for transfer.',
  },
]

export const AUDIT_STORY = {
  intro: 'Every figure above rests on parsed ASSIST agreements. The audit measures how much that parse can be trusted, and publishes the bound instead of a promise.',
  steps: [
    {
      id: 'corpus',
      label: 'Source corpus',
      stat: '2,415',
      statLabel: 'transfer agreements in the source corpus',
      body: 'Current ASSIST articulation agreements between 115 California community colleges and the University of California campuses, refreshed July 11, 2026.',
    },
    {
      id: 'templates',
      label: 'Template collapse',
      stat: '47',
      statLabel: 'exact template shapes span all 1,035 agreements in the nine selected pathways',
      body: 'Agreements parse into exact requirement templates. One human review covers every agreement whose ASSIST source structure is byte-identical, so a small number of careful reviews covers the whole selected corpus.',
    },
    {
      id: 'review',
      label: 'Complete review',
      stat: '47 of 47',
      statLabel: 'template variants have a current human review',
      body: 'A person compared the parser result against the ASSIST source structure for every template shape in the working dataset.',
      facts: [
        '46 reviews matched exactly',
        '1 asked for more coursework than ASSIST requires',
        '0 omitted required work — no student would be left underprepared',
        '48 stored reviews still match current parser output',
      ],
    },
    {
      id: 'bound',
      label: 'Statistical bound',
      body: 'A uniform random sample of templates gives a finite-population Wilson 95% upper bound on the rate of any deviation from ASSIST. We report the ceiling, not the observed rate alone.',
    },
  ],
  bound: {
    // Read these off the live Audit → Stats page (MismatchGauge) at snapshot
    // time and fill them together — see Task 8. Never estimate them.
    ceilingPct: null,
    observedPct: null,
    k: null,
    n: null,
    estMax: null,
    totalDocs: null,
    pendingNote: 'Bound values are frozen from the live audit at each snapshot. This snapshot has not recorded them yet.',
  },
}

export const DEGREE_READINESS = [
  { value: '199 of 199', label: 'stored degree records retain a catalog source and year' },
  { value: '97.8%', label: 'local degree course references link to ASSIST' },
  { value: '97.1%', label: 'transfer degree course references link to ASSIST' },
  { value: '95.3%', label: 'pathway courses have a prerequisite category mapping' },
]

export const PREREQ_EXHIBIT = {
  // null renders the canonical concept graph; viewers can switch to any
  // college live. Set a source_id here to open on a specific college.
  initialCollegeId: null,
  heading: 'Beyond coverage: the prerequisite structure inside the pathway',
  body: 'Articulation coverage says whether an equivalent course exists. Our concept graph also models what each course requires, per college, and shows the chain-relevant concepts a college has no course for.',
}

export const PLATFORM_SURFACES = [
  {
    id: 'degrees',
    title: 'Per-college degree pages',
    body: 'Every analyzable computing degree, with its catalog source, course list, and how each course maps to ASSIST and to prerequisite concepts.',
  },
  {
    id: 'audit',
    title: 'Audit workbench',
    body: 'Random-sample reviews, verdict tracking, and live statistical bounds over the parsed corpus — the numbers in this showcase come from here.',
  },
  {
    id: 'visuals',
    title: 'Visuals gallery',
    body: 'Published, dated figures with per-account release control. Everything you saw above is a live view, not a screenshot.',
  },
  {
    id: 'api',
    title: 'Data API',
    body: 'The same scoped endpoints that power these pages are documented and queryable, so results can be reproduced outside the interface.',
  },
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/showcase/showcaseContent.test.js`
Expected: PASS (3 tests). Existing suites untouched.

---

### Task 2: Extract previews and `EvidenceBadge` into `previews.jsx`

Mechanical move so later tasks can import them without circular references. No behavior change.

**Files:**
- Create: `frontend/src/showcase/previews.jsx`
- Modify: `frontend/src/showcase/ShowcasePage.jsx` (delete the moved code, import instead)

**Interfaces:**
- Produces: `EvidenceBadge({ status })`, `VisualPreview({ kind })` (kinds: `complete-paths`, `requirement-coverage`, anything else → paired-degree preview) — consumed by Tasks 3 and 7.

- [ ] **Step 1: Create `previews.jsx`**

Move these blocks out of `ShowcasePage.jsx` **verbatim** (they are currently at roughly lines 27–208): the `COMPLETE_PATHS_BY_CAMPUS` constant, `EvidenceBadge`, `CompletePathsPreview`, `RequirementCoveragePreview`, `PairedDegreePreview`, and `VisualPreview`. File skeleton:

```jsx
import React from 'react'
import { Badge } from '../components/ui'

// ...moved constants and components, unchanged...

export { EvidenceBadge, VisualPreview }
```

`PairedDegreePreview` has no `showcaseContent` imports; none of the moved code does. Keep every className exactly as it was.

- [ ] **Step 2: Update `ShowcasePage.jsx` imports**

Remove the moved code from `ShowcasePage.jsx` and add:

```js
import { EvidenceBadge, VisualPreview } from './previews'
```

- [ ] **Step 3: Run the showcase suite to verify nothing changed**

Run: `cd frontend && npx vitest run src/showcase`
Expected: PASS — all pre-existing `ShowcasePage.test.jsx` tests still green.

---

### Task 3: `FigureStage` — Act 1 interactive stage

**Files:**
- Create: `frontend/src/showcase/FigureStage.jsx`
- Test: `frontend/src/showcase/FigureStage.test.jsx`

**Interfaces:**
- Consumes: `FEATURED_FIGURES`, `SHOWCASE_FINDINGS` (Task 1); `EvidenceBadge`, `VisualPreview` (Task 2); `getAnalysisById` from `../analyses/registry`.
- Produces: default export `FigureStage({ activeId, onSelect, onOpen, canOpenAnalysis })` and named export `STAGE_ENTRIES` (figures first, then findings; each entry has `entryKind: 'figure' | 'finding'`). Consumed by Task 7. `onOpen(entry)` receives the whole entry object.

Behavior contract:
- Right-hand numbered rail lists all 7 entries (same visual pattern as the current `FindingStage` rail; figures show their `provenance` where findings show `status`).
- Stage for a **figure** entry: header (provenance badge `Badge variant='accent'` with text `Live visual`, title, question, big frozen `metric` + `metricLabel`), then — when `canOpenAnalysis(entry.analysisId)` — the live component rendered inline inside a bordered panel (`getAnalysisById(entry.analysisId).Component`), plus a button (`entry.actionLabel`) calling `onOpen(entry)` for full-screen. When not released: a frozen fallback panel showing metric, metricLabel, and the existing copy `Related visual is not released for this account`; no live mount, button disabled.
- Stage for a **finding** entry: exactly the current `FindingStage` body — `EvidenceBadge`, description, `VisualPreview kind={entry.preview}` inside the clickable button that calls `onOpen(entry)` (gated the same way, same aria-labels as today: `` `${entry.actionLabel}: ${entry.title}` `` / `` `Related visual not released: ${entry.title}` ``).
- Section headline: eyebrow `The ported figures`, heading `Your analyses, run statewide in California`, and one lede sentence noting the three findings that follow the four ports.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/showcase/FigureStage.test.jsx`:

```jsx
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../analyses/registry', () => ({
  getAnalysisById: (id) => ({ id, Component: () => <div>{`Live ${id} embed`}</div> }),
}))

import FigureStage, { STAGE_ENTRIES } from './FigureStage'

const noop = () => {}

describe('figure stage', () => {
  it('orders the four ported figures ahead of the three findings', () => {
    expect(STAGE_ENTRIES.map((e) => e.entryKind)).toEqual([
      'figure', 'figure', 'figure', 'figure', 'finding', 'finding', 'finding',
    ])
  })

  it('embeds the live figure inline when the analysis is released', () => {
    render(<FigureStage activeId={STAGE_ENTRIES[0].id} onSelect={noop}
      onOpen={noop} canOpenAnalysis={() => true} />)
    expect(screen.getByText('Live paper-district-heatmap embed')).toBeInTheDocument()
    expect(screen.getByText(/After the Massachusetts paper/)).toBeInTheDocument()
    expect(screen.getByText('356 of 648')).toBeInTheDocument()
  })

  it('falls back to the frozen panel when the analysis is not released', () => {
    render(<FigureStage activeId={STAGE_ENTRIES[0].id} onSelect={noop}
      onOpen={noop} canOpenAnalysis={() => false} />)
    expect(screen.queryByText('Live paper-district-heatmap embed')).not.toBeInTheDocument()
    expect(screen.getByText(/not released for this account/)).toBeInTheDocument()
    expect(screen.getByText('356 of 648')).toBeInTheDocument()
  })

  it('switches entries from the rail and keeps finding previews clickable', () => {
    const onSelect = vi.fn()
    const onOpen = vi.fn()
    const findingEntry = STAGE_ENTRIES.find((e) => e.entryKind === 'finding')
    const { rerender } = render(<FigureStage activeId={STAGE_ENTRIES[0].id}
      onSelect={onSelect} onOpen={onOpen} canOpenAnalysis={() => true} />)

    fireEvent.click(screen.getByRole('button', { name: new RegExp(findingEntry.title.slice(0, 30)) }))
    expect(onSelect).toHaveBeenCalledWith(findingEntry.id)

    rerender(<FigureStage activeId={findingEntry.id} onSelect={onSelect}
      onOpen={onOpen} canOpenAnalysis={() => true} />)
    fireEvent.click(screen.getByRole('button', {
      name: `${findingEntry.actionLabel}: ${findingEntry.title}`,
    }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: findingEntry.id }))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/showcase/FigureStage.test.jsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `FigureStage.jsx`**

Start from the current `FindingStage` in `ShowcasePage.jsx` (lines ~210–282) — copy its layout (the `rounded-3xl bg-primary p-5` shell, `grid-cols-[minmax(0,1fr)_300px]`, the rail `ol`) and generalize:

```jsx
import React from 'react'
import { ArrowRightIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import { Badge, MarketingSection } from '../components/ui'
import { getAnalysisById } from '../analyses/registry'
import { FEATURED_FIGURES, SHOWCASE_FINDINGS } from './showcaseContent'
import { EvidenceBadge, VisualPreview } from './previews'

export const STAGE_ENTRIES = [
  ...FEATURED_FIGURES.map((f) => ({ ...f, entryKind: 'figure' })),
  ...SHOWCASE_FINDINGS.map((f) => ({ ...f, entryKind: 'finding' })),
]

function FigureBody({ entry, canOpen, onOpen }) {
  const Live = canOpen ? getAnalysisById(entry.analysisId)?.Component : null
  return (
    <div className='flex min-h-0 flex-1 flex-col px-7 py-6'>
      {Live ? (
        <div className='min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-surface p-4'>
          <Live />
        </div>
      ) : (
        <div className='flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-surface-muted text-center'>
          <p className='text-display-lg'>{entry.metric}</p>
          <p className='mt-2 max-w-sm text-body-strong'>{entry.metricLabel}</p>
          <p className='mt-4 text-caption text-ink-subtle'>Related visual is not released for this account</p>
        </div>
      )}
      <button type='button' disabled={!canOpen} onClick={() => canOpen && onOpen(entry)}
        className='mt-5 flex items-center gap-2 text-button text-primary disabled:text-ink-subtle'
        aria-label={canOpen ? `${entry.actionLabel}: ${entry.title}` : `Related visual not released: ${entry.title}`}>
        <ArrowsPointingOutIcon className='h-4 w-4' aria-hidden='true' />
        {canOpen ? entry.actionLabel : 'Related visual is not released for this account'}
        {canOpen && <ArrowRightIcon className='h-4 w-4' aria-hidden='true' />}
      </button>
    </div>
  )
}
```

The finding body is the existing clickable-preview `button` block from `FindingStage`, unchanged (aria-labels included). The header block shows, for figures: `<Badge variant='accent'>Live visual</Badge>` + a `text-caption` provenance line + `entry.scope`; for findings: `EvidenceBadge status={entry.status}` + `entry.scope` as today. Big number on the right: `entry.metric`. Rail buttons: same as today, with `entry.provenance ?? entry.status` as the small tag line and `entry.question` as the caption.

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/showcase/FigureStage.test.jsx`
Expected: PASS (4 tests).

---

### Task 4: `AuditStepper` — Act 2 audit story

**Files:**
- Create: `frontend/src/showcase/AuditStepper.jsx`
- Test: `frontend/src/showcase/AuditStepper.test.jsx`

**Interfaces:**
- Consumes: `AUDIT_STORY` (Task 1); `MarketingSection`, `Badge` from `../components/ui`.
- Produces: default export `AuditStepper()` — self-contained, no props. Consumed by Task 7.

Behavior contract:
- Section headline: eyebrow `How the data earns trust`, heading `An audit with a published bound, not a promise`, lede = `AUDIT_STORY.intro`.
- A horizontal rail of 4 step buttons (`aria-pressed` on the active one, numbered 1–4 like the finding rail); clicking swaps the stage. Default active: first step.
- Steps 1–3 stage: big `stat`, `statLabel`, `body`; step 3 also renders its `facts` as a two-column checklist.
- Step 4 (`bound`) stage: when `bound.ceilingPct` is `null`, render `bound.pendingNote` in a `text-caption` panel — no gauge, no invented number. When filled, render the gauge in `MismatchGauge`'s visual language (see `frontend/src/pages/Audit/components/stats/MismatchGauge.jsx` for reference — do **not** import it; it reads live hooks upstream): `≤ {ceilingPct}%` as the big value, `observed {observedPct}% · {k}/{n} templates` beneath, `≤ {estMax} docs may deviate of {totalDocs}` on the right, and a 0–100 scale bar with markers at the observed rate and the ceiling.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/showcase/AuditStepper.test.jsx`:

```jsx
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./showcaseContent', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, AUDIT_STORY: { ...real.AUDIT_STORY } }
})

import { AUDIT_STORY } from './showcaseContent'
import AuditStepper from './AuditStepper'

describe('audit stepper', () => {
  it('walks corpus → templates → review → bound', () => {
    render(<AuditStepper />)
    expect(screen.getByText('2,415')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Template collapse/ }))
    expect(screen.getByText(/byte-identical/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Complete review/ }))
    expect(screen.getByText('47 of 47')).toBeInTheDocument()
    expect(screen.getByText(/no student would be left underprepared/i)).toBeInTheDocument()
  })

  it('shows the pending state instead of a fabricated bound', () => {
    render(<AuditStepper />)
    fireEvent.click(screen.getByRole('button', { name: /Statistical bound/ }))
    if (AUDIT_STORY.bound.ceilingPct === null) {
      expect(screen.getByText(AUDIT_STORY.bound.pendingNote)).toBeInTheDocument()
      expect(screen.queryByText(/≤ /)).not.toBeInTheDocument()
    } else {
      expect(screen.getByText(`≤ ${AUDIT_STORY.bound.ceilingPct.toFixed(1)}%`)).toBeInTheDocument()
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/showcase/AuditStepper.test.jsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `AuditStepper.jsx`**

```jsx
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
      <div className='flex items-start justify-between gap-6 flex-wrap'>
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
        <span>0%</span><span>100%</span>
      </div>
    </div>
  )
}

export default function AuditStepper() {
  const [activeId, setActiveId] = useState(AUDIT_STORY.steps[0].id)
  const active = AUDIT_STORY.steps.find((s) => s.id === activeId)
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
              step.id === activeId ? 'bg-primary text-on-primary' : 'bg-surface hover:bg-surface-hover border border-border'
            }`}>
            <span className={`grid h-8 w-8 place-items-center rounded-full text-body-strong ${
              step.id === activeId ? 'bg-white text-primary' : 'bg-primary-soft text-primary'
            }`}>{index + 1}</span>
            <p className='mt-3 text-body-strong'>{step.label}</p>
          </button>
        ))}
      </div>
      <div className='mt-5 rounded-3xl border border-border bg-surface p-8'>
        {active.id !== 'bound' ? (
          <div className='grid grid-cols-[280px_minmax(0,1fr)] items-start gap-10'>
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
          </div>
        ) : (
          <div className='grid grid-cols-[280px_minmax(0,1fr)] items-start gap-10'>
            <p className='text-body text-ink-muted'>{active.body}</p>
            <BoundStage bound={AUDIT_STORY.bound} />
          </div>
        )}
      </div>
    </MarketingSection>
  )
}
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/showcase/AuditStepper.test.jsx`
Expected: PASS (2 tests).

---

### Task 5: `BeyondPaper` — Act 3 prereq graph embed + readiness

**Files:**
- Create: `frontend/src/showcase/BeyondPaper.jsx`
- Test: `frontend/src/showcase/BeyondPaper.test.jsx`

**Interfaces:**
- Consumes: `PREREQ_EXHIBIT`, `DEGREE_READINESS` (Task 1); `ConceptGraphView` from `../prereqs/ConceptGraphView` (props: `initialCollegeId`, `lockCollege` — pass `lockCollege={false}` implicitly by omitting it so the college Combobox stays available).
- Produces: default export `BeyondPaper()` — no props. Consumed by Task 7. **Note for Task 7:** `ConceptGraphView` calls `useColleges()` and `usePrereqGraph()` from `../shared/query/hooks/useData`, so `ShowcasePage.test.jsx` must mock that module (shown in Task 7).

Layout: `MarketingSection` with a `grid-cols-[360px_minmax(0,1fr)]` — left column: eyebrow `Beyond the paper`, `PREREQ_EXHIBIT.heading` as the `text-display` heading, `PREREQ_EXHIBIT.body`, then the `DEGREE_READINESS` values as a stacked `dl` (value `text-stat-lg`, label `text-caption`, divided rows). Right column: the live `ConceptGraphView` inside `rounded-2xl border border-border bg-surface p-6`, with a `Badge variant='accent'>Live visual</Badge>` header row titled `Prerequisite concept graph`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/showcase/BeyondPaper.test.jsx`:

```jsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [], isLoading: false, isError: false }),
  usePrereqGraph: () => ({
    data: { concepts: [{ slug: 'calc-1', name: 'Calculus I', requires: [], satisfies: [] }], rules: [], courses: [], edges: [] },
    isLoading: false,
    isError: false,
  }),
}))

import BeyondPaper from './BeyondPaper'

describe('beyond the paper', () => {
  it('frames the prereq exhibit and embeds the live concept graph', () => {
    render(<BeyondPaper />)
    expect(screen.getByRole('heading', { name: /prerequisite structure inside the pathway/i })).toBeInTheDocument()
    expect(screen.getByText('Prerequisite concept graph')).toBeInTheDocument()
    expect(screen.getByText('199 of 199')).toBeInTheDocument()
    expect(screen.getByText('95.3%')).toBeInTheDocument()
  })
})
```

If `PrereqGraph` renders SVG that jsdom chokes on with this minimal data, additionally mock `../prereqs/PrereqGraph` with `() => <div>graph</div>` — check `frontend/src/prereqs/ConceptGraphView.test.jsx` first and mirror whatever it mocks.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/showcase/BeyondPaper.test.jsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `BeyondPaper.jsx`**

```jsx
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
          <dl className='mt-8 divide-y divide-border rounded-2xl border border-border bg-surface'>
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
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/showcase/BeyondPaper.test.jsx`
Expected: PASS.

---

### Task 6: `PlatformBand` — Act 4 platform cards + scope band

**Files:**
- Create: `frontend/src/showcase/PlatformBand.jsx`
- Test: covered by `ShowcasePage.test.jsx` in Task 7 (static content only — a dedicated test file would restate the content module).

**Interfaces:**
- Consumes: `PLATFORM_SURFACES`, `SCOPE_METRICS`, `SHOWCASE_SNAPSHOT` (Task 1); `MarketingSection`, `Logo` from `../components/ui`; `CalendarDaysIcon` from heroicons.
- Produces: default export `PlatformBand()` — no props. Consumed by Task 7.

- [ ] **Step 1: Implement `PlatformBand.jsx`**

```jsx
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
```

- [ ] **Step 2: Confirm the file compiles under the scoped suite**

Run: `cd frontend && npx vitest run src/showcase`
Expected: PASS — existing tests unaffected (component not yet mounted anywhere).

---

### Task 7: Recompose `ShowcasePage` and update its tests

**Files:**
- Modify: `frontend/src/showcase/ShowcasePage.jsx`
- Modify: `frontend/src/showcase/ShowcasePage.test.jsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1–6.
- Produces: the final page. Act order inside `ShowcaseStory`: `Hero` → `FigureStage` → `AuditStepper` → `MethodSection` (kept, unchanged) → `BeyondPaper` → `PlatformBand` → `MeetingQuestions` (Wednesday list only).

- [ ] **Step 1: Update the tests first**

Rewrite `frontend/src/showcase/ShowcasePage.test.jsx`. Keep the existing `useAccess` and `registry` mocks and the `window.scrollTo` setup exactly as they are, **add** the `useData` mock required by the `ConceptGraphView` embed:

```jsx
vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [], isLoading: false, isError: false }),
  usePrereqGraph: () => ({
    data: { concepts: [], rules: [], courses: [], edges: [] },
    isLoading: false,
    isError: false,
  }),
}))
```

(If Task 5 needed a `PrereqGraph` mock, add the same one here.)

Replace the test bodies:

```jsx
describe('research showcase', () => {
  it('tells the five-act data-strength story in order, read only', () => {
    render(<ShowcasePage />)
    expect(screen.getByRole('heading', { name: 'Your figures, rebuilt on California data' })).toBeInTheDocument()

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    const order = [
      'Your analyses, run statewide in California',
      'An audit with a published bound, not a promise',
      'Confidence and caveats stay beside the findings.',
      'Beyond coverage: the prerequisite structure inside the pathway',
      'A living research instrument, not a one-off analysis',
    ]
    const indexes = order.map((t) => headings.findIndex((h) => h === t))
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b))
    expect(indexes.every((i) => i >= 0)).toBe(true)

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
  })

  it('leads with the ported figures and embeds the live figure inline for admins', () => {
    render(<ShowcasePage />)
    expect(screen.getByText('Live paper-district-heatmap visual')).toBeInTheDocument()
    expect(screen.getByText(/After the Massachusetts paper/)).toBeInTheDocument()
  })

  it('falls back to frozen panels for accounts without the release', () => {
    visualAccess.role = 'partner'
    visualAccess.releasedIds = []
    render(<ShowcasePage />)
    expect(screen.queryByText('Live paper-district-heatmap visual')).not.toBeInTheDocument()
    expect(screen.getAllByText(/not released for this account/i).length).toBeGreaterThan(0)
  })

  it('walks the audit story and never shows a fabricated bound', () => {
    render(<ShowcasePage />)
    fireEvent.click(screen.getByRole('button', { name: /Statistical bound/ }))
    expect(screen.getByText(/frozen from the live audit/i)).toBeInTheDocument()
  })

  it('opens a full live visual from the stage and returns cleanly', async () => {
    render(<ShowcasePage />)
    fireEvent.click(screen.getByRole('button', {
      name: 'Open the full district heatmap: Which districts have a complete path to each UC campus',
    }))
    const dialog = screen.getByRole('dialog', {
      name: 'Which districts have a complete path to each UC campus full visual',
    })
    expect(within(dialog).getByText('Live paper-district-heatmap visual')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps presentation mode over the new structure', () => {
    render(<ShowcasePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Present showcase' }))
    const dialog = screen.getByRole('dialog', { name: 'California transfer pathways' })
    expect(within(dialog).getByText('Presentation mode')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Your figures, rebuilt on California data' })).toBeInTheDocument()
  })
})
```

Note the mocked registry component renders `Live ${id} visual` (existing mock) — the inline embed and the full-screen dialog therefore show the same string; the inline-embed assertion runs before any dialog opens, so there is no ambiguity in the first two tests.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd frontend && npx vitest run src/showcase/ShowcasePage.test.jsx`
Expected: FAIL — old hero heading, missing sections.

- [ ] **Step 3: Recompose `ShowcasePage.jsx`**

- `Hero`: replace the hard-coded eyebrow/title/lede with `SHOWCASE_HERO.eyebrow`, `SHOWCASE_HERO.title`, `SHOWCASE_HERO.lede` (import from `showcaseContent`). Keep the badge, date, snapshot pill, and `Present showcase` button as they are.
- Delete `FindingStage`, `ConfidenceSection`, `DegreeComparisonSection`, and `ScopeBand` (and the now-unused `CheckBadgeIcon` import and `DEGREE_COMPARISON` import). Keep `MethodSection`, `QuestionList`, `MeetingQuestions`, `Hero`.
- `MeetingQuestions`: drop the `WEEKLY_REVIEW_QUESTIONS` column — render the Wednesday `QuestionList` alone, centered (`mx-auto max-w-2xl`). Keep the snapshot footer line. (`WEEKLY_REVIEW_QUESTIONS` stays exported from the content module.)
- `ShowcaseStory` becomes:

```jsx
function ShowcaseStory({ activeEntryId, onSelectEntry, onOpen, onPresent, canOpenAnalysis, presentation = false }) {
  return (
    <div className='bg-canvas text-ink'>
      <Hero onPresent={onPresent} presentation={presentation} />
      <FigureStage activeId={activeEntryId} onSelect={onSelectEntry} onOpen={onOpen} canOpenAnalysis={canOpenAnalysis} />
      <AuditStepper />
      <MethodSection />
      <BeyondPaper />
      <PlatformBand />
      <MeetingQuestions />
    </div>
  )
}
```

- Page state: rename `activeFindingId` → `activeEntryId`, initialized to `STAGE_ENTRIES[0].id`. The full-screen selection state becomes the whole entry: `const [selectedEntry, setSelectedEntry] = useState(null)`; `openAnalysis(entry)` keeps the presentation scroll-save logic but stores the entry (`setSelectedEntry(entry)`), `closeAnalysis` clears it. The detail `FullScreenPanel` reads `selectedEntry.analysisId` through `getAnalysisById` exactly as today, and its sidebar shows `selectedEntry.question` / `selectedEntry.method`; the subtitle uses `selectedEntry.provenance ?? `${selectedEntry.status} finding, ${selectedEntry.scope}``. The `Alert` live-note line keeps its wording with `selectedEntry.liveNote`.
- The scroll-restore `useEffect` and both `FullScreenPanel`s otherwise stay as they are (`selected` → `selectedEntry` renames only).

- [ ] **Step 4: Run the showcase suite**

Run: `cd frontend && npx vitest run src/showcase`
Expected: PASS — all files (content, FigureStage, AuditStepper, BeyondPaper, ShowcasePage).

- [ ] **Step 5: Check the app-chrome test still passes**

Run: `cd frontend && npx vitest run src/App.chrome.test.jsx`
Expected: PASS (the Showcase tab wiring did not change). If it asserts old showcase copy, update only those strings.

---

### Task 8: Freeze the bound values, full verification, single commit

**Files:**
- Modify: `frontend/src/showcase/showcaseContent.js` (bound values only, if obtainable)

- [ ] **Step 1: Try to read the live audit bound**

Start the app (`npm run dev` from the repo root — all-Atlas dev per the project workflow), sign in, open **Audit → Stats**, and read the strict-mismatch gauge: ceiling %, observed %, `k/n` templates, `≤ N docs of total`. Fill all six fields of `AUDIT_STORY.bound` together. If the app or Atlas is unreachable in this session, leave the `null`s — the pending state is designed for exactly this — and tell Tybalt the six values are still to be filled from Audit → Stats before presenting.

- [ ] **Step 2: Full test run**

Run: `cd frontend && npx vitest run`
Expected: PASS across the entire frontend suite. Fix any stragglers before proceeding.

- [ ] **Step 3: Visual smoke check (if the dev server is running)**

Open the Showcase tab: scroll all five acts, click all seven stage entries, all four stepper steps, switch a college in the concept graph, enter presentation mode, open and close one full-screen figure. Confirm no console errors.

- [ ] **Step 4: Single commit (do not push)**

```bash
git add frontend/src/showcase docs/superpowers/specs/2026-07-21-showcase-data-strength-design.md docs/superpowers/plans/2026-07-21-showcase-data-strength.md
git commit -m "feat: showcase redesign — five-act data-strength narrative for the MA group

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: one commit on `as-degree-data`. Do not push; Tybalt decides when.
