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

  it('carries the human denominators (figure-2 strip and notes)', () => {
    const { people } = snapshot
    // The strip's person-first stats: typical reach nearly doubles across
    // quartiles, a fifth of the state lives behind a majority-shut door, and
    // the deepest shutouts are small — stated as a tail, never the typical case.
    expect(people.weightedStair.enrollment[3]).toBeGreaterThan(people.weightedStair.enrollment[0] * 1.5)
    expect(people.residentsMajorityShut).toBeGreaterThan(people.residents.total * 0.15)
    expect(people.residentsMajorityShut).toBeLessThan(people.residents.total * 0.35)
    expect(people.students.gated).toBeGreaterThan(10000)
    expect(people.students.gated).toBeLessThan(people.students.total * 0.05)
    // Robustness stairs both rise: enrollment-weighted and ACS-income-ranked.
    for (const stair of [people.weightedStair.enrollment, people.acsStair]) {
      expect(stair[3]).toBeGreaterThan(stair[0] + 0.2)
    }
    // Why there is NO demographics beat: person-weighted mean reach is nearly
    // flat across groups (spread under one program of nine). If this ever
    // widens, the angle deserves a fresh look — the notes say it was set aside.
    const g = people.groupReach
    const reaches = [g.hispanic, g.asian, g.white, g.black]
    expect(Math.max(...reaches) - Math.min(...reaches)).toBeLessThan(1)
  })

  it('carries the detour, wall, and concentration sections (beats 4, 6, 7)', () => {
    const { detour, wall, lorenz } = snapshot
    // The detour to full choice falls steeply with income: the poorest
    // quartile's median detour is a multiple of the richest's, and nearly
    // everyone there pays some detour.
    expect(detour.byQuartile[0].medianDetourKm).toBeGreaterThan(detour.byQuartile[3].medianDetourKm * 4)
    expect(detour.byQuartile[0].shareDetoured).toBeGreaterThan(0.9)
    // The wall is narrow choice, not zero paths: a real minority of the
    // state's CS associate graduates come from at-most-four colleges.
    expect(wall.totals.completionsNarrow / wall.totals.completions).toBeGreaterThan(0.15)
    expect(wall.totals.completionsNarrow / wall.totals.completions).toBeLessThan(0.5)
    expect(wall.bands).toHaveLength(4)
    // Concentration: subject opportunity is spread meaningfully less evenly
    // than field opportunity, and the counterfactual shows stock sufficiency.
    expect(lorenz.cs.gini).toBeGreaterThan(lorenz.field.gini * 1.8)
    expect(lorenz.counterfactual.optimalResidentShare).toBeGreaterThan(lorenz.counterfactual.actualResidentShare * 2)
    // Lorenz curves are valid: monotone, ending at (1, 1).
    for (const curve of [lorenz.cs, lorenz.field]) {
      const last = curve.points[curve.points.length - 1]
      expect(last[0]).toBeCloseTo(1, 2)
      expect(last[1]).toBeCloseTo(1, 2)
      for (let i = 1; i < curve.points.length; i += 1) {
        expect(curve.points[i][1]).toBeGreaterThanOrEqual(curve.points[i - 1][1])
      }
    }
  })

  it('carries the curated-minimums basis alongside strict', () => {
    const m = snapshot.minimums
    // No campus is closed on the eligibility floor; one stays open.
    expect(m.fig1.filter((p) => p.regime === 'closed')).toHaveLength(0)
    expect(m.fig1.filter((p) => p.regime === 'open')).toHaveLength(1)
    // Seven campuses are identical under both bases (their ASSIST listing IS
    // the floor); the two competitive campuses open up only on the floor.
    const strictBy = new Map(snapshot.fig1.map((p) => [p.campus, p]))
    const sameCount = m.fig1.filter((p) => {
      const st = strictBy.get(p.campus)
      return st && st.q1 === p.q1 && st.q4 === p.q4
    }).length
    expect(sameCount).toBe(7)
    const ucla = m.fig1.find((p) => p.campus === 'UCLA')
    expect(ucla.q1).toBeGreaterThan(0)
    expect(ucla.q4).toBeGreaterThan(0.9)
    // The floor staircase is monotone and STEEPER than the stated one — the
    // strict basis was diluting the income story, not inflating it.
    for (let q = 1; q < 4; q += 1) expect(m.fig3cs[q]).toBeGreaterThanOrEqual(m.fig3cs[q - 1])
    const floorGap = m.fig3cs[3] - m.fig3cs[0]
    const strictGap = snapshot.fig3.cs[3] - snapshot.fig3.cs[0]
    expect(floorGap).toBeGreaterThan(strictGap)
    // Distance grid survives on the floor: both gates still positive for CS.
    expect(m.responses.income.near).toBeGreaterThan(0)
    expect(m.responses.proximity.poor).toBeGreaterThan(0)
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

describe('priceOfPlaceSnapshot permutation check', () => {
  it('carries the committed label-permutation test on both bases', () => {
    const p = snapshot.permutation
    expect(p.strict.iterations).toBeGreaterThanOrEqual(100000)
    for (const basis of [p.strict, p.floor]) {
      // The observed Q4-Q1 gap exceeds every gap seen under random
      // relabeling of districts into quartiles.
      expect(basis.observedGap).toBeGreaterThan(basis.maxNullGap)
      expect(basis.pUpperBound).toBeLessThan(0.001)
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
    expect(screen.getByText('Complete transfer paths by district income')).toBeInTheDocument()
    // The eligibility floor is the default basis: nothing is closed until the
    // basis is switched to stated preparation.
    expect(screen.queryByText(/CLOSED IN EVERY DISTRICT/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stated preparation' }))
    expect(screen.getByText(/CLOSED IN EVERY DISTRICT/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eligibility floor' }))
    expect(screen.getByText('District income and transfer access, mapped')).toBeInTheDocument()
    expect(screen.getByText(/Transfer-access gradients by district income/)).toBeInTheDocument()
    expect(screen.getByText('Transfer demand and income sensitivity across measurable programs')).toBeInTheDocument()
    expect(screen.getByText(/high demand, large income swing/)).toBeInTheDocument()
    // On the floor basis all nine CS programs are in the market figure,
    // including the two that are closed under stated preparation.
    expect(screen.getByText(/Computer Science on the eligibility floor/)).toBeInTheDocument()
    expect(screen.getAllByText('UC Los Angeles').length).toBeGreaterThan(1)
    expect(screen.getByText('Distance to the nearest campus, by district income')).toBeInTheDocument()
    expect(screen.getByText('Income and distance, compared within broad strata')).toBeInTheDocument()
    // The sequence is exactly the five-beat core — the person/geography beats
    // were built, judged clutter, and retired to the notes and data file.
    expect(screen.queryByText('The graduates at the narrow end')).not.toBeInTheDocument()
    expect(screen.queryByText('Unequal, and unnecessary')).not.toBeInTheDocument()
    expect(screen.queryByText(/CUT NEEDED/)).not.toBeInTheDocument()
    // Real numbers on the figure, not hover-only.
    expect(screen.getAllByText(`${Math.round(snapshot.minimums.fig3cs[3] * 100)}%`).length).toBeGreaterThan(0)
    // The gate grid states its four conditional responses as in-place arrows.
    expect(screen.getAllByText(/^field \+\d+$/).length).toBe(4)
    expect(screen.getByText('NEARER HALF')).toBeInTheDocument()
    // The author's notes are on the page, in note form.
    expect(screen.getByText('Robustness checks')).toBeInTheDocument()
    expect(screen.getByText('Alternative explanations, checked')).toBeInTheDocument()
    expect(screen.getByText(/census median household income/)).toBeInTheDocument()
    expect(screen.getByText(/Spearman rank correlation/)).toBeInTheDocument()
  })


  it('preview renders the tether map alone', () => {
    render(<PriceOfPlacePreview />)
    expect(screen.getByText('Median tether, by income quartile')).toBeInTheDocument()
  })

})
