import React from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PriceOfPlace, { PriceOfPlacePreview, fig1Rows, projectCA } from './PriceOfPlace'
import snapshot from './priceOfPlaceSnapshot.json'

describe('priceOfPlaceSnapshot (committed data contract)', () => {
  it('carries the verified headline aggregates', () => {
    // Nine subject programs, three regimes.
    expect(snapshot.fig1).toHaveLength(9)
    expect(snapshot.fig1.filter((p) => p.regime === 'closed')).toHaveLength(2)
    expect(snapshot.fig1.filter((p) => p.regime === 'open')).toHaveLength(1)
    // The access staircase rises monotonically for both series.
    for (const series of [snapshot.fig3.cs, snapshot.fig3.field]) {
      for (let q = 1; q < 4; q += 1) expect(series[q]).toBeGreaterThanOrEqual(series[q - 1])
    }
    // CS response is a multiple of the field's.
    const csDelta = snapshot.fig3.cs[3] - snapshot.fig3.cs[0]
    const fieldDelta = snapshot.fig3.field[3] - snapshot.fig3.field[0]
    expect(csDelta).toBeGreaterThan(fieldDelta * 2.5)
    // Size is stated as a fact, not controlled by construction: the subject's
    // burden is ordinary for the corpus, so the sequence can rule out a size
    // effect without any matched-cohort machinery.
    expect(snapshot.fig3.subjectSize.fieldPercentile).toBeLessThan(80)
    expect(snapshot.fig3.subjectSize.belowFieldMedian).toBeGreaterThanOrEqual(1)
    // College-level robustness: the triple-response contrast survives with no
    // district pooling — the claim is not the multi-college-district mechanic.
    const csCollege = snapshot.fig3.collegeLevel.cs[3] - snapshot.fig3.collegeLevel.cs[0]
    const fieldCollege = snapshot.fig3.collegeLevel.field[3] - snapshot.fig3.collegeLevel.field[0]
    expect(csCollege).toBeGreaterThan(fieldCollege * 2.5)
    // Binding collapse (kept as archived analysis in the snapshot): CS under
    // 1.2 in the richest quartile, from 3+.
    expect(snapshot.fig5a.cs[0].binding).toBeGreaterThan(3)
    expect(snapshot.fig5a.cs[3].binding).toBeLessThan(1.2)
    // Every figure-2 district has a quartile, a reach band, and coordinates.
    for (const d of snapshot.fig2.districts) {
      expect(d.incomeQuartile).toBeGreaterThanOrEqual(0)
      expect(d.reachBand).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(d.lon) && Number.isFinite(d.lat)).toBe(true)
    }
  })

  it('carries the distance stratification (figures 4 and 5)', () => {
    const { distance } = snapshot
    // One tether per matched district, each with a campus and a quartile.
    expect(distance.tethers).toHaveLength(snapshot.counts.districts)
    for (const t of distance.tethers) {
      expect(distance.campuses.some((c) => c.name === t.campus)).toBe(true)
      expect(Number.isFinite(t.km) && t.km >= 0).toBe(true)
    }
    // The confound: median tether length falls monotonically with income.
    for (let q = 1; q < 4; q += 1) {
      expect(distance.medianKmByQuartile[q]).toBeLessThan(distance.medianKmByQuartile[q - 1])
    }
    // The stratification covers all districts, cells uneven by construction.
    const { cells } = distance
    const total = cells.nearPoor.n + cells.nearRich.n + cells.farPoor.n + cells.farRich.n
    expect(total).toBe(snapshot.counts.districts)
    // Both gates: with either factor held, the other still moves CS access,
    // and the CS response exceeds the field's on every one of the four cuts.
    const conditionals = [
      distance.responses.income.near, distance.responses.income.far,
      distance.responses.proximity.poor, distance.responses.proximity.rich,
    ]
    for (const r of conditionals) {
      expect(r.cs).toBeGreaterThan(0)
      expect(r.cs).toBeGreaterThan(r.field)
    }
  })
})

describe('fig1Rows', () => {
  it('groups the nine programs into regime bands, contested sorted by poorest-quartile share', () => {
    const bands = fig1Rows()
    expect(bands.map((b) => b.regime)).toEqual(['closed', 'open', 'contested'])
    const contested = bands[2].members
    expect(contested).toHaveLength(6)
    for (let i = 1; i < contested.length; i += 1) {
      expect(contested[i].q1).toBeLessThanOrEqual(contested[i - 1].q1)
    }
  })
})

describe('projectCA', () => {
  it('is monotone: east is right, north is up (smaller py)', () => {
    const sf = projectCA(-122.4, 37.8)
    const la = projectCA(-118.2, 34.05)
    expect(la.px).toBeGreaterThan(sf.px)
    expect(la.py).toBeGreaterThan(sf.py)
  })
})

describe('PriceOfPlace', () => {
  it('renders all five beats with the committed values, no hooks required', () => {
    render(<PriceOfPlace />)
    expect(screen.getByText('Nine programs, three fates')).toBeInTheDocument()
    expect(screen.getByText('Two maps, nearly the same map')).toBeInTheDocument()
    expect(screen.getByText('Same start, triple the response')).toBeInTheDocument()
    expect(screen.getByText('Distance is wealth’s twin')).toBeInTheDocument()
    expect(screen.getByText('Two gates, tested separately')).toBeInTheDocument()
    // Real numbers on the figure, not hover-only.
    expect(screen.getAllByText(`${Math.round(snapshot.fig3.cs[3] * 100)}%`).length).toBeGreaterThan(0)
    // The gate grid states its conditional responses in visible text.
    expect(screen.getAllByText(/INCOME ALONE/).length).toBe(2)
    expect(screen.getAllByText(/DISTANCE ALONE/).length).toBe(2)
    // The author's plain-language log of checked angles is on the page.
    expect(screen.getByText(/the angles we checked/i)).toBeInTheDocument()
    expect(screen.getByText(/three times farther from the nearest campus/)).toBeInTheDocument()
  })

  it('switches between the detailed and at-a-glance registers', () => {
    render(<PriceOfPlace />)
    // Detailed default: standfirsts and method caveats, no headline conclusions.
    expect(screen.getByText(/CLOSED EVERYWHERE — WEALTH IRRELEVANT/)).toBeInTheDocument()
    expect(screen.getByText(/that imbalance is the confound itself/)).toBeInTheDocument()
    expect(screen.getByText(/coarse but even-handed ruler/)).toBeInTheDocument()
    expect(screen.queryByText(/Six come down to money/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'At a glance' }))
    // Glance: designed headline conclusions appear, method caveats retire.
    expect(screen.getByText(/Six come down to money/)).toBeInTheDocument()
    expect(screen.getByText(/distance still pays/)).toBeInTheDocument()
    expect(screen.getByText(/Both gates are real/)).toBeInTheDocument()
    expect(screen.queryByText(/that imbalance is the confound itself/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }))
    expect(screen.getByText(/that imbalance is the confound itself/)).toBeInTheDocument()
  })

  it('preview renders the evidence figure alone', () => {
    render(<PriceOfPlacePreview />)
    expect(screen.getByText(/no curve is being fitted/)).toBeInTheDocument()
  })
})
