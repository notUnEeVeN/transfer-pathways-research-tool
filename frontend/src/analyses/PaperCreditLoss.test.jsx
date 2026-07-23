import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PaperCreditLoss, {
  FigureSVG,
  getAssistCreditLossArtifact,
  PaperCreditLossPreview,
} from './PaperCreditLoss'
import oursData from './data/paper-credit-loss.ours.json'
import { PAPER_UC_BARS } from './paperCreditLossBaseline'

describe('California paper credit-loss figure', () => {
  it('ships the canonical nine-program CS scope with verifiable provenance', () => {
    expect(oursData.dataset_version).toBe('2026-07-22-canonical-cs-v1')
    expect(oursData.major_scope.program_pins).toHaveLength(9)
    expect(oursData.major_scope.program_pins.find((pin) => pin.school_id === 79)?.program)
      .toBe('Electrical Engineering & Computer Sciences, B.S.')
    expect(oursData.major_scope_fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(oursData.artifact_fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  // The figure now opens on ASSIST; the paper baseline is one click away and
  // still has to come out byte-identical on the legacy renderer.
  it('keeps the paper baseline on the legacy renderer unchanged', () => {
    const direct = render(<FigureSVG bars={PAPER_UC_BARS} labelMode='names' />)
    const expected = direct.getByRole('img').outerHTML
    direct.unmount()

    const { container } = render(<PaperCreditLoss />)
    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    const figure = container.querySelector('[data-export-root] svg')

    expect(figure.outerHTML).toBe(expected)
    expect(figure.getAttribute('viewBox')).toBe('0 0 1990.3 1190.3')
    expect(container.querySelector('[data-modern-california-figure]')).toBeNull()
  })

  it('uses the modern publication renderer for hand-curated data and its differences', () => {
    const { container } = render(<PaperCreditLoss />)
    fireEvent.click(screen.getByRole('button', { name: 'Hand-curated minimums' }))

    const figure = container.querySelector('[data-modern-california-figure="credit-loss"]')
    expect(figure).toBeTruthy()
    expect(figure.getAttribute('viewBox')).toBe('0 0 1240 742')
    expect(figure.getAttribute('font-family')).toContain('Hanken Grotesk')
    expect(figure.querySelector('[data-modern-panel-border="credit-loss"]')
      .getAttribute('stroke-opacity')).toBe('0.45')
    expect(figure.querySelectorAll('[data-modern-bar]')).toHaveLength(45)
    expect(figure.querySelector('[data-series="requirement"]').textContent).toContain('8.00')
    expect(figure.querySelector('[data-series="choice-1"]').getAttribute('fill')).toBeNull()
    expect(figure.querySelector('[data-series="choice-1"] path').getAttribute('fill')).toBe('#1E3A5F')
    expect(screen.queryByText('Mean 1st-choice Δ')).toBeNull()
    expect(screen.getByText('University of California campus')).toBeTruthy()
    expect(screen.getByText('Number of courses').getAttribute('x')).toBe('34')
    expect(screen.getByText('quarter-system campus · unmarked = semester')).toBeTruthy()
    expect(figure.querySelector('[data-major-label]').textContent).toContain('Computer Science')
    expect(figure.querySelector('title').textContent).toContain('Computer Science')
    expect(figure.querySelector('desc').textContent).toContain('CS and math requirements')
    expect(figure.getAttribute('aria-labelledby')).toBe(figure.querySelector('title').id)
    expect(figure.getAttribute('aria-describedby')).toBe(figure.querySelector('desc').id)
    expect(figure.querySelector('[data-campus="UCD"] [data-series="requirement"]')
      .getAttribute('aria-label')).toContain('CS and math requirements')

    fireEvent.click(screen.getByRole('switch', { name: 'Show differences' }))
    expect(figure.querySelectorAll('[data-comparison-overlay]').length).toBeGreaterThan(0)
    expect(figure.querySelectorAll('[data-difference="increase"]').length).toBeGreaterThan(0)
    expect(figure.querySelectorAll('[data-difference="decrease"]').length).toBeGreaterThan(0)
  })

  it('expands the modern y-axis for the taller ASSIST requirements', () => {
    const { container } = render(<PaperCreditLoss />)
    fireEvent.click(screen.getByRole('button', { name: 'ASSIST minimums' }))

    const figure = container.querySelector('[data-modern-california-figure="credit-loss"]')
    expect(figure.getAttribute('data-figure-version')).toBe('assist')
    expect(figure.querySelector('[data-y-tick="20"]')).toBeTruthy()
    expect(figure.querySelector('[data-campus="UCLA"] [data-series="requirement"]')
      .getAttribute('data-value')).toBe('16')
    expect(figure.querySelectorAll('[data-unavailable="true"]')).toHaveLength(8)
    expect(figure.querySelector('[data-campus="UCSD"] [data-series="choice-1"]')
      .getAttribute('data-value')).toBeNull()
    expect(screen.getByText('No eligible districts')).toBeTruthy()
  })

  it('exports a figure-only live ASSIST preview for gallery thumbnails', () => {
    const cs = getAssistCreditLossArtifact('cs')
    const { container } = render(<PaperCreditLossPreview />)
    const figure = container.querySelector('[data-modern-california-figure="credit-loss"]')

    expect(figure).toBeTruthy()
    expect(figure.getAttribute('data-figure-version')).toBe('assist')
    expect(figure.querySelector('[data-campus="UCD"] [data-series="choice-1"]')
      .getAttribute('data-value')).toBe(String(cs.campuses[0].choices[0].transferable_average))
    expect(figure.querySelector('[data-major-label]').textContent).toContain('Computer Science')
    expect(screen.getByText('ASSIST requirement slots')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('Mean 1st-choice Δ')).toBeNull()
  })

  it('exports the selected non-CS ASSIST artifact and configured label in previews', () => {
    const bio = getAssistCreditLossArtifact('bio')
    const { container } = render(
      <PaperCreditLossPreview majorSlug='bio' majorLabel='Biological Sciences' />,
    )
    const figure = container.querySelector('[data-modern-california-figure="credit-loss"]')

    expect(figure).toBeTruthy()
    expect(figure.getAttribute('data-figure-version')).toBe('assist')
    expect(figure.querySelector('[data-major-label]').textContent).toContain('Biological Sciences')
    expect(figure.querySelector('title').textContent).toContain('Biological Sciences')
    expect(figure.querySelector('[data-campus="UCD"] [data-series="requirement"]')
      .getAttribute('data-value')).toBe(String(bio.campuses[0].requirement.native_count))
    expect(figure.querySelector('[data-campus="UCD"] [data-series="requirement"]')
      .getAttribute('aria-label')).toContain('Biological Sciences ASSIST required receiver slots')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it.each([
    ['bio', 'Biology'],
    ['econ', 'Economics'],
  ])('renders %s from only its audited ASSIST artifact', (majorSlug, majorLabel) => {
    const artifact = getAssistCreditLossArtifact(majorSlug)
    expect(artifact?.major_scope?.slug).toBe(majorSlug)
    expect(artifact?.schema_version).toBe(2)

    const { container } = render(<PaperCreditLoss majorSlug={majorSlug} />)
    const figure = container.querySelector('[data-modern-california-figure="credit-loss"]')
    const expectedUcd = artifact.campuses.find((campus) => campus.code === 'UCD')
      .requirement.native_count

    expect(figure).toBeTruthy()
    expect(figure.getAttribute('data-figure-version')).toBe('assist')
    expect(figure.querySelector('title').textContent).toContain(majorLabel)
    expect(figure.querySelector('desc').textContent)
      .toContain(`${majorLabel} ASSIST required receiver slots`)
    expect(figure.querySelector('desc').textContent).not.toContain('CS')
    expect(screen.getByText('ASSIST requirement slots')).toBeTruthy()
    expect(figure.querySelector('[data-campus="UCD"] [data-series="requirement"]')
      .getAttribute('data-value')).toBe(String(expectedUcd))
    expect(screen.queryByText('Current ASSIST requirements · receiver-slot model')).toBeNull()
    expect(screen.queryByText('Version')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Paper baseline' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hand-curated minimums' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'ASSIST minimums' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Show differences' })).toBeNull()
  })

  it('prefers a configured major label throughout the modern non-CS export', () => {
    const { container } = render(
      <PaperCreditLoss majorSlug='bio' majorLabel='Biological Sciences' />,
    )
    const figure = container.querySelector('[data-modern-california-figure="credit-loss"]')

    expect(figure.querySelector('[data-major-label]').textContent).toContain('Biological Sciences')
    expect(figure.querySelector('title').textContent).toContain('Biological Sciences')
    expect(figure.querySelector('desc').textContent)
      .toContain('Biological Sciences ASSIST required receiver slots')
    expect(figure.querySelector('[data-campus="UCD"] [data-series="requirement"]')
      .getAttribute('aria-label')).toContain('Biological Sciences ASSIST required receiver slots')
  })

  it('fails closed when a major has no audited artifact', () => {
    render(<PaperCreditLoss majorSlug='future-major' />)

    expect(screen.getByText(/No audited ASSIST credit-loss artifact/)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    expect(getAssistCreditLossArtifact('future-major')).toBeNull()
  })
})
