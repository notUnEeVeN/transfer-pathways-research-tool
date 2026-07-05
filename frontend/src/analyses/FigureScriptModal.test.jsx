// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FigureScriptModalView, liveBadge } from './FigureScriptModal'

const script = (over = {}) => ({
  slug: 'coverage-by-district',
  code: 'import pmt\npmt.publish(fig, "coverage-by-district", "T")\n',
  enabled: true,
  updated_at: '2026-07-01T10:00:00Z',
  consecutive_failures: 0,
  last_run: {
    status: 'ok', trigger: 'publish', started_at: '2026-07-01T10:00:00Z',
    duration_ms: 2100, dataset_version: '2026-07-01-v1', log: 'captured for the figure runner',
  },
  ...over,
})

const view = (props = {}) => render(
  <FigureScriptModalView
    open
    onClose={() => {}}
    slug='coverage-by-district'
    title='Coverage by district'
    script={script()}
    isLoading={false}
    isError={false}
    canModify={false}
    onRefresh={vi.fn()}
    onToggleEnabled={vi.fn()}
    onDetach={vi.fn()}
    {...props}
  />
)

describe('liveBadge', () => {
  it('is absent for static figures', () => {
    expect(liveBadge({ mode: undefined })).toBeNull()
    expect(liveBadge(undefined)).toBeNull()
  })

  it('is green with the recompute date for healthy live figures', () => {
    const b = liveBadge({ mode: 'live', live: { status: 'ok', computed_at: '2026-07-01T10:00:00Z' } })
    expect(b.variant).toBe('success')
    expect(b.text).toContain('Live')
    expect(b.text).toMatch(/2026|Jul/)
  })

  it('is amber when the last refresh failed', () => {
    const b = liveBadge({ mode: 'live', live: { status: 'error', computed_at: '2026-07-01T10:00:00Z' } })
    expect(b.variant).toBe('conservative')
    expect(b.text).toMatch(/failed/i)
  })
})

describe('FigureScriptModalView', () => {
  it('shows everyone the script source with a copy affordance', () => {
    view()
    expect(screen.getByText(/import pmt/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy()
  })

  it('keeps the control surface away from non-owners', () => {
    view({ canModify: false })
    expect(screen.queryByRole('button', { name: /run again now/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /detach/i })).toBeNull()
    expect(screen.queryByText(/captured for the figure runner/)).toBeNull() // the run log
  })

  it('gives the owner refresh, the auto-refresh switch, detach, and the run log', () => {
    view({ canModify: true })
    expect(screen.getByRole('button', { name: /run again now/i })).toBeTruthy()
    expect(screen.getByRole('switch')).toBeTruthy()
    expect(screen.getByRole('button', { name: /detach/i })).toBeTruthy()
    expect(screen.getByText(/captured for the figure runner/)).toBeTruthy()
  })

  it('reflects a failing last run to the owner', () => {
    view({
      canModify: true,
      script: script({
        consecutive_failures: 2,
        last_run: { status: 'timeout', trigger: 'dataset', started_at: '2026-07-02T04:00:00Z', duration_ms: 120000, log: 'killed after 120000ms' },
      }),
    })
    expect(screen.getByText(/timeout/i)).toBeTruthy()
    expect(screen.getByText(/killed after/)).toBeTruthy()
  })

  it('renders loading and error states', () => {
    const { unmount } = view({ script: undefined, isLoading: true })
    expect(document.querySelector('[class*="animate"]')).toBeTruthy()
    unmount()
    view({ script: undefined, isError: true })
    expect(screen.getByText(/could not load/i)).toBeTruthy()
  })
})
