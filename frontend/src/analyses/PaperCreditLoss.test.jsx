import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PaperCreditLoss, {
  FigureSVG,
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

  it('keeps the default paper baseline on the legacy renderer unchanged', () => {
    const direct = render(<FigureSVG bars={PAPER_UC_BARS} labelMode='names' />)
    const expected = direct.getByRole('img').outerHTML
    direct.unmount()

    const { container } = render(<PaperCreditLoss />)
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
      .getAttribute('data-value')).toBe('17')
    expect(figure.querySelectorAll('[data-unavailable="true"]')).toHaveLength(8)
    expect(figure.querySelector('[data-campus="UCSD"] [data-series="choice-1"]')
      .getAttribute('data-value')).toBeNull()
    expect(screen.getByText('No eligible districts')).toBeTruthy()
  })

  it('exports a figure-only current-data preview for gallery thumbnails', () => {
    const { container } = render(<PaperCreditLossPreview />)
    const figure = container.querySelector('[data-modern-california-figure="credit-loss"]')

    expect(figure).toBeTruthy()
    expect(figure.getAttribute('data-figure-version')).toBe('website')
    expect(figure.querySelector('[data-campus="UCD"] [data-series="choice-1"]')
      .getAttribute('data-value')).toBe('7')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('Mean 1st-choice Δ')).toBeNull()
  })
})
