// @vitest-environment happy-dom
//
// Unit tests for the dashboard chart primitives: MiniBarChart, ProportionBar,
// HBarList, KeyValuePanel. Asserts bar/segment counts, geometry widths/heights,
// and legend content. Colours are token classes — assert the class is applied,
// never a hex.
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import MiniBarChart from './MiniBarChart'
import ProportionBar from './ProportionBar'
import HBarList from './HBarList'
import KeyValuePanel from './KeyValuePanel'

afterEach(cleanup)

// ─── MiniBarChart ─────────────────────────────────────────────────────────────

describe('MiniBarChart', () => {
  it('renders one bar per value', () => {
    const { container } = render(<MiniBarChart data={[1, 2, 3, 4]} />)
    expect(container.querySelectorAll('i').length).toBe(4)
  })

  it('maps the max value to 100% height and applies the bright token class', () => {
    const { container } = render(<MiniBarChart data={[10, 5]} />)
    const bars = container.querySelectorAll('i')
    expect(bars[0].style.height).toBe('100%')
    // the peak bar gets the bright primary fill (token class, not a hex)
    expect(bars[0].className).toContain('bg-primary')
    // a low bar gets the soft tint
    expect(bars[1].className).toContain('bg-primary-soft')
  })

  it('uses a custom colorFn when provided', () => {
    const { container } = render(<MiniBarChart data={[1, 2]} colorFn={() => 'bg-success'} />)
    container.querySelectorAll('i').forEach((b) => expect(b.className).toContain('bg-success'))
  })

  it('renders axis labels when given', () => {
    render(<MiniBarChart data={[1, 2]} labels={['A', 'B', 'C']} />)
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.getByText('C')).toBeTruthy()
  })
})

// ─── ProportionBar ────────────────────────────────────────────────────────────

describe('ProportionBar', () => {
  const segments = [
    { label: 'Verified', value: 73, colorClass: 'bg-success' },
    { label: 'Unverified', value: 27, colorClass: 'bg-surface-muted' },
  ]

  it('renders one track segment per item with width derived from value share', () => {
    const { container } = render(<ProportionBar segments={segments} />)
    const track = container.querySelector('[aria-label="proportion bar"]')
    const segs = track.querySelectorAll('span')
    expect(segs.length).toBe(2)
    expect(segs[0].style.width).toBe('73%')
    expect(segs[1].style.width).toBe('27%')
    // token class colours
    expect(segs[0].className).toContain('bg-success')
  })

  it('honours an explicit pct over the derived share', () => {
    const { container } = render(
      <ProportionBar segments={[{ label: 'A', value: 1, pct: 40, colorClass: 'bg-primary' }, { label: 'B', value: 1, pct: 60, colorClass: 'bg-primary-soft' }]} />
    )
    const track = container.querySelector('[aria-label="proportion bar"]')
    const segs = track.querySelectorAll('span')
    expect(segs[0].style.width).toBe('40%')
    expect(segs[1].style.width).toBe('60%')
  })

  it('renders a legend row (label + count + pct) per segment', () => {
    render(<ProportionBar segments={segments} />)
    expect(screen.getByText('Verified')).toBeTruthy()
    expect(screen.getByText('73')).toBeTruthy()
    expect(screen.getByText('73%')).toBeTruthy()
  })

  it('renders the timestamp caption when provided', () => {
    render(<ProportionBar segments={segments} timestamp='as of 14:32' />)
    expect(screen.getByText('as of 14:32')).toBeTruthy()
  })
})

// ─── HBarList ─────────────────────────────────────────────────────────────────

describe('HBarList', () => {
  const rows = [
    { label: 'SMC', value: 1200 },
    { label: 'De Anza', value: 600 },
  ]

  it('renders one row per item with the leader at 100% and the rest scaled', () => {
    const { container } = render(<HBarList rows={rows} />)
    const fills = container.querySelectorAll('span.block')
    expect(fills.length).toBe(2)
    expect(fills[0].style.width).toBe('100%')
    expect(fills[1].style.width).toBe('50%')
  })

  it('applies the row colorClass token (defaults to bg-primary)', () => {
    const { container } = render(
      <HBarList rows={[{ label: 'X', value: 5, colorClass: 'bg-primary/60' }]} />
    )
    expect(container.querySelector('span.block').className).toContain('bg-primary/60')
  })

  it('renders labels and comma-grouped counts', () => {
    render(<HBarList rows={rows} />)
    expect(screen.getByText('SMC')).toBeTruthy()
    expect(screen.getByText('1,200')).toBeTruthy()
  })
})

// ─── KeyValuePanel ────────────────────────────────────────────────────────────

describe('KeyValuePanel', () => {
  it('renders a label/value pair per row', () => {
    render(
      <KeyValuePanel
        rows={[
          { label: 'Last build', value: '2h ago' },
          { label: 'Last publish', value: '—' },
        ]}
      />
    )
    expect(screen.getByText('Last build')).toBeTruthy()
    expect(screen.getByText('2h ago')).toBeTruthy()
    expect(screen.getByText('Last publish')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('accepts node values (e.g. a Badge)', () => {
    render(<KeyValuePanel rows={[{ label: 'Ingest', value: <span data-testid='node'>2d ago</span> }]} />)
    expect(screen.getByTestId('node')).toBeTruthy()
  })
})
