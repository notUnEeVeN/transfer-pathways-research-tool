import React from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PaperGate, { PaperGatePreview } from './PaperGate'
import repairs from '../../../analysis/data/course_repairs.v2.json'

describe('course_repairs artifact (committed data contract)', () => {
  it('carries the fates, census, and repair headline values', () => {
    const { counts, instances } = repairs.fates
    // Fates partition the instances exactly.
    expect(counts.A + counts.B + counts.C + counts.unclassified).toBe(instances)
    expect(counts.A1 + counts.A2 + counts.A3).toBe(counts.A)
    // The v2 thesis, stated honestly: under same-CLASS evidence (the finer
    // taxonomy), most — not nearly all — missing entries have a like course
    // accepted somewhere. The share dropped from ~0.8 under v1's broad
    // buckets; that drop is the point of the rebuild.
    expect(counts.A / instances).toBeGreaterThan(0.6)
    expect(counts.A / instances).toBeLessThan(0.8)
    // Census families plus unclassified partition the instances too.
    const censusSum = repairs.census.families.reduce((s, f) => s + f.instances, 0)
    expect(censusSum + repairs.census.unclassified).toBe(instances)
    // Blockers carry the blocks/opens pairing and its near-inversion, plus
    // the per-course evidence stamp for the ledger.
    expect(repairs.blockers[0].blocks).toBe(115)
    expect(repairs.blockers[0].opens).toBeLessThan(10)
    for (const b of repairs.blockers) {
      expect(b.preApproved).toBeGreaterThanOrEqual(0)
      expect(b.preApproved).toBeLessThanOrEqual(b.blocks)
    }
    // The repaired map is a range at two standards, conservative below full.
    const cons = repairs.repairs.conservativeRepairedMap
    const full = repairs.repairs.tierARepairedMap
    expect(cons.access[0]).toBeLessThanOrEqual(full.access[0])
    expect(cons.access[0]).toBeGreaterThan(repairs.baseline.access[0] + 0.08)
    expect(full.gapQ4Q1).toBeLessThan(repairs.baseline.gapQ4Q1)
    expect(repairs.keystones.length).toBeGreaterThan(100)
  })

  it('carries the curated-minimums basis with the same shape and stronger closure', () => {
    const m = repairs.minimums
    expect(m.fates.counts.A + m.fates.counts.B + m.fates.counts.C + m.fates.counts.unclassified)
      .toBe(m.fates.instances)
    expect(m.fates.counts.A / m.fates.instances).toBeGreaterThan(0.6)
    expect(m.baseline.access[0]).toBeGreaterThan(0.35)
    expect(m.baseline.gapQ4Q1).toBeGreaterThan(0.4)
    // On the floor, the evidence-backed repairs close most of the gap.
    expect(m.repairs.tierARepairedMap.gapQ4Q1).toBeLessThan(m.baseline.gapQ4Q1 * 0.65)
    expect(m.repairs.conservativeRepairedMap.access[0]).toBeGreaterThan(m.baseline.access[0] + 0.12)
    for (const b of m.blockers) {
      expect(b.preApproved).toBeLessThanOrEqual(b.blocks)
    }
  })

  it('carries the tiered intro scenarios and the validation design', () => {
    for (const d of [repairs, repairs.minimums]) {
      const { lowestBar, introEvidence } = d.repairs.scenarios
      // The universal scenario patches every missing intro-sequence entry and
      // says so in its name; the evidence-scoped scenario patches the subset
      // with same-class acceptance evidence and can never beat it.
      expect(lowestBar.name).toMatch(/^Universal/)
      expect(introEvidence.instances).toBeLessThanOrEqual(lowestBar.instances)
      expect(introEvidence.access[0]).toBeLessThanOrEqual(lowestBar.access[0])
      expect(introEvidence.access[0]).toBeGreaterThan(d.baseline.access[0])
    }
    // Single-coder validation: a committed stratified sample awaiting codes,
    // with the PPV hook reporting once codes exist.
    expect(repairs.validation.sampleSize).toBeGreaterThanOrEqual(80)
    expect(repairs.validation.poolSize).toBeGreaterThan(repairs.validation.sampleSize)
    expect(repairs.validationSample.length).toBe(repairs.validation.sampleSize)
    for (const c of repairs.validationSample.slice(0, 5)) {
      expect(c.id).toBeTruthy()
      expect(c.evidence.length).toBeGreaterThan(0)
      expect(['A1', 'A2', 'A3']).toContain(c.tier)
    }
  })

  it('carries the cumulative class ladder on both bases', () => {
    for (const d of [repairs, repairs.minimums]) {
      const ladder = d.repairs.scenarios.classLadder
      expect(ladder.length).toBeGreaterThanOrEqual(4)
      // Ends at the everything ceiling; earlier rungs are cumulative, so
      // access never falls as rungs are added.
      expect(ladder[ladder.length - 1].id).toBe('everything')
      let prev = d.baseline
      for (const rung of ladder) {
        for (let q = 0; q < 4; q += 1) {
          expect(rung.access[q]).toBeGreaterThanOrEqual(prev.access[q] - 1e-9)
        }
        prev = rung
      }
      // The ceiling closes nearly everything.
      expect(ladder[ladder.length - 1].gapQ4Q1).toBeLessThan(d.baseline.gapQ4Q1 * 0.3)
      // The milestone route: each milestone measured twice on top of the
      // previous ones — signatures only, then universal — so the geometry's
      // from <= evidence <= universal ordering is a data guarantee.
      const route = d.repairs.scenarios.route
      expect(route.length).toBeGreaterThanOrEqual(3)
      let prevQ1 = d.baseline.access[0]
      for (const m of route) {
        expect(m.from[0]).toBeCloseTo(prevQ1, 5)
        expect(m.evidence.access[0]).toBeGreaterThanOrEqual(m.from[0] - 1e-9)
        expect(m.access[0]).toBeGreaterThanOrEqual(m.evidence.access[0] - 1e-9)
        prevQ1 = m.access[0]
      }
      // Greedy ordering: the first rung is the class with the largest
      // standalone poorest-quartile gain, so it always moves access. Later
      // marginals may rise or fall (complementarities), so no ordering
      // assertion beyond the cumulative-access monotonicity above.
      expect(ladder[0].access[0]).toBeGreaterThan(d.baseline.access[0])
    }
  })

  it('carries the lowest-bar scenario on both bases', () => {
    for (const d of [repairs, repairs.minimums]) {
      const low = d.repairs.scenarios.lowestBar
      expect(low.access).toHaveLength(4)
      // Signing intro programming alone narrows the gap substantially. Note
      // the gap is NOT monotone in repairs (the full stack lifts rich
      // districts too) — on the stated basis the cheap fix narrows the gap
      // more than the full stack — so only access ordering is asserted.
      expect(low.gapQ4Q1).toBeLessThan(d.baseline.gapQ4Q1 * 0.85)
      expect(low.access[0]).toBeGreaterThan(d.baseline.access[0])
      // The staged ladder is nested: the cumulative maps contain the intro
      // stage by construction, so access is monotone across stages.
      const cum = d.repairs.scenarios.cumulative
      for (let q = 0; q < 4; q += 1) {
        expect(cum.full.access[q]).toBeGreaterThanOrEqual(low.access[q])
        expect(cum.conservative.access[q]).toBeGreaterThanOrEqual(low.access[q])
        expect(cum.full.access[q]).toBeGreaterThanOrEqual(cum.conservative.access[q])
      }
    }
  })

  it('carries the arch — every course by level and swing', () => {
    const { courses, summary } = repairs.arch
    expect(courses.length).toBeGreaterThan(3000)
    // Composition: CS courses concentrate in the contested band.
    expect(summary.csContestedShare).toBeGreaterThan(summary.otherContestedShare * 2)
    // Within-band steepness: contested CS courses are more income-graded
    // than other contested courses — the new, deepest fact.
    expect(summary.csContestedSwing).toBeGreaterThan(summary.otherContestedSwing * 1.5)
    for (const r of courses) {
      expect(r.level).toBeGreaterThanOrEqual(0)
      expect(r.level).toBeLessThanOrEqual(1)
    }
  })

  it('carries the cross-major market view', () => {
    const { programs, excludedCount } = repairs.market
    expect(programs.length).toBeGreaterThan(200)
    expect(excludedCount).toBeGreaterThan(100)
    const cs = programs.filter((r) => r.cs)
    const field = programs.filter((r) => !r.cs)
    expect(cs.length).toBeGreaterThanOrEqual(5)
    const meanSwing = (list) => list.reduce((sum, r) => sum + r.swing, 0) / list.length
    // The anomaly: CS income sensitivity well above the field's, on the same
    // engine, with nothing hidden.
    expect(meanSwing(cs)).toBeGreaterThan(meanSwing(field) * 1.5)
    for (const r of programs) {
      expect(r.swing).toBeGreaterThanOrEqual(-1)
      expect(r.swing).toBeLessThanOrEqual(1)
      expect(r.applicants).toBeGreaterThan(0)
    }
  })

  it('carries the ingredients mechanism on both bases', () => {
    for (const ing of [repairs.ingredients, repairs.minimums.ingredients]) {
      // Commodities vs bespoke pairings.
      expect(ing.summary.genericMedianRate).toBeGreaterThan(0.9)
      expect(ing.summary.csMedianRate).toBeLessThan(0.8)
      // The mechanism: the income gradient lives in the CS requirements.
      const csSwing = ing.gradient.cs[3] - ing.gradient.cs[0]
      const genSwing = ing.gradient.generic[3] - ing.gradient.generic[0]
      expect(csSwing).toBeGreaterThan(genSwing * 2.5)
      for (const lineData of [ing.gradient.cs, ing.gradient.generic]) {
        for (let q = 1; q < 4; q += 1) expect(lineData[q]).toBeGreaterThanOrEqual(lineData[q - 1])
      }
      expect(ing.requirements.length).toBeGreaterThan(50)
    }
  })
})

describe('PaperGate (four moments)', () => {
  it('renders the four moments at a glance by default, floor basis', () => {
    render(<PaperGate />)
    expect(screen.getByText('Articulation level and income sensitivity, across every frequently required course')).toBeInTheDocument()
    // The checklist beat was cut: its claim lives in the arch and gradient.
    expect(screen.queryByText('Split the checklist')).not.toBeInTheDocument()
    expect(screen.getByText('the contested middle')).toBeInTheDocument()
    expect(screen.getAllByText('Income swing, points').length).toBe(2)
    // The market scatter lives in The Price of Place now, not here.
    expect(screen.queryByText('What wealth decides, across every major')).not.toBeInTheDocument()
    expect(screen.getByText('The income gradient, concentrated in the computing courses')).toBeInTheDocument()
    expect(screen.getByText('What articulating each course type would open, and the evidence behind it')).toBeInTheDocument()
    expect(screen.getByText('The simulated repair route through the computing courses')).toBeInTheDocument()
    expect(screen.getByText('How repairing the computing courses narrows the income gap')).toBeInTheDocument()
    // The verdict figure introduces no scenario of its own: its stages are
    // figure 4's route endpoints, honestly labeled.
    expect(screen.getByText('All evidence-backed articulations')).toBeInTheDocument()
    expect(screen.getByText('Computing courses repaired')).toBeInTheDocument()
    expect(screen.getByText('articulated and taught everywhere')).toBeInTheDocument()
    expect(screen.getByText(/disproportionately benefits the lowest-income districts/)).toBeInTheDocument()
    // Each moment closes with its claim as figure ink.
    expect(screen.getByText(/articulated nearly everywhere/)).toBeInTheDocument()
    // Course-type repair bars with real pathway counts, and the waffle's
    // centerpiece stat with its tier detail.
    expect(screen.getAllByText(/\+\d+ pathways/).length).toBeGreaterThanOrEqual(4)
    expect(screen.getByText('Data structures')).toBeInTheDocument()
    expect(screen.getAllByText('Introductory programming').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/same-type/).length).toBeGreaterThan(0)
    // Honesty ink present in both registers: the not-taught remainder and the
    // subject-level-evidence caveat.
    expect(screen.getAllByText(/not taught/).length).toBeGreaterThan(0)
  })

  it('switches basis: the ledger re-populates and moment-4 lines change', () => {
    const pts = (v) => Math.round(v * 100)
    render(<PaperGate />)
    // Floor: the type panel shows the floor's own top pathway count.
    const floorTop = repairs.minimums.repairs.types.filter((t) => t.completeCells > 0)[0]
    expect(screen.getByText(new RegExp(`\\+${floorTop.completeCells} pathways`))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stated preparation' }))
    // Stated: its own counts and its own waffle total.
    const statedTop = repairs.repairs.types.filter((t) => t.completeCells > 0)[0]
    expect(screen.getByText(new RegExp(`\\+${statedTop.completeCells} pathways`))).toBeInTheDocument()
    expect(screen.getByText(/of the 1,761 missing entries/)).toBeInTheDocument()
    // Stated basis: the access-row note states the computed distance to the
    // richest quartile, and the gap inset re-measures both endpoints.
    expect(screen.getAllByText(/evidence-backed articulations · \d+-point gap/).length).toBeGreaterThan(0)
    expect(screen.getByTestId('paper-gate-ladder-signatures')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eligibility floor' }))
    expect(screen.getByTestId('paper-gate-ladder-signatures')).toBeInTheDocument()
  })

  it('separates access movement from the contracting rich-poor gap', () => {
    render(<PaperGate />)
    const fpts = (v) => Math.round(v * 100)
    const fm = repairs.minimums
    const COMPUTING = new Set(['intro_programming', 'intro_programming_2', 'data_structures', 'algorithms', 'software_eng', 'computer_org', 'assembly_systems', 'programming_other', 'discrete'])
    const cutR = (arr, rows) => {
      const i = arr.findIndex((m) => !COMPUTING.has(m.id))
      return (i >= 0 ? arr.slice(0, i) : arr).slice(0, rows)
    }
    const sharedPrefix = (() => {
      const t = cutR(fm.repairs.scenarios.route, 99)
      const g = cutR(fm.repairs.scenarios.routeSignatures, 99)
      let n = 0
      while (n < t.length && n < g.length && t[n].id === g[n].id) n += 1
      return g.slice(0, Math.max(1, n))
    })()
    const route = sharedPrefix
    const last = route[route.length - 1]
    const ladder = screen.getByTestId('paper-gate-ladder-signatures')
    // One rightward arrow per milestone row; the gap inset has exactly the
    // two labeled spans and no scatter marks.
    const arrows = [...ladder.querySelectorAll('[data-movement-arrow]')]
    expect(arrows).toHaveLength(route.length)
    expect(arrows.every((arrow) => arrow.getAttribute('data-movement-arrow') === 'right')).toBe(true)
    // The restored conclusion inset: named endpoints for the drawn steps and
    // the continuation note carrying the full eight-type route.
    const gap = screen.getByTestId('paper-gate-ladder-gap-signatures')
    expect(gap.querySelectorAll('[data-gap-span]')).toHaveLength(2)
    expect(gap.textContent).toContain(`Evidence-backed articulations close ${fpts(fm.baseline.gapQ4Q1) - fpts(last.evidence.gapQ4Q1)} of the ${fpts(fm.baseline.gapQ4Q1)} points across these steps`)
    expect(gap.textContent).toContain(`${fpts(fm.baseline.gapQ4Q1)}-POINT GAP`)
    expect(gap.textContent).toContain(`evidence-backed articulations · ${fpts(last.evidence.gapQ4Q1)}-point gap`)
    expect(gap.textContent).toContain(`all entries repaired · ${fpts(last.gapQ4Q1)}-point gap`)
    expect(ladder.textContent).toContain('AFTER INTRO PROGRAMMING')
    expect(ladder.textContent).not.toContain('Worst distance stratum')
    // The read-before-quoting notes are on the page.
    expect(screen.getByText(/read before quoting/i)).toBeInTheDocument()
    expect(screen.getByText(/not ordered bounds on gap reduction/)).toBeInTheDocument()
  })


  it('preview renders the all-courses arch alone', () => {
    render(<PaperGatePreview />)
    expect(screen.getByText('Inside the contested band')).toBeInTheDocument()
  })
})
