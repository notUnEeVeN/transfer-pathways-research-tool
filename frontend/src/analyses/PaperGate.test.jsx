import React from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PaperGate, { PaperGatePreview } from './PaperGate'
import repairs from '../../../analysis/data/course_repairs.v1.json'

describe('course_repairs artifact (committed data contract)', () => {
  it('carries the fates, census, and repair headline values', () => {
    const { counts, instances } = repairs.fates
    // Fates partition the instances exactly.
    expect(counts.A + counts.B + counts.C + counts.unclassified).toBe(instances)
    expect(counts.A1 + counts.A2 + counts.A3).toBe(counts.A)
    // The thesis: the gate is overwhelmingly paperwork.
    expect(counts.A / instances).toBeGreaterThan(0.7)
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
    expect(cons.access[0]).toBeGreaterThan(repairs.baseline.access[0] * 1.5)
    expect(full.gapQ4Q1).toBeLessThan(repairs.baseline.gapQ4Q1)
    expect(repairs.keystones.length).toBeGreaterThan(100)
  })

  it('carries the curated-minimums basis with the same shape and stronger closure', () => {
    const m = repairs.minimums
    expect(m.fates.counts.A + m.fates.counts.B + m.fates.counts.C + m.fates.counts.unclassified)
      .toBe(m.fates.instances)
    expect(m.fates.counts.A / m.fates.instances).toBeGreaterThan(0.7)
    expect(m.baseline.access[0]).toBeGreaterThan(0.35)
    expect(m.baseline.gapQ4Q1).toBeGreaterThan(0.4)
    // On the floor, the evidence-backed repairs close most of the gap.
    expect(m.repairs.tierARepairedMap.gapQ4Q1).toBeLessThan(m.baseline.gapQ4Q1 * 0.5)
    expect(m.repairs.conservativeRepairedMap.access[0]).toBeGreaterThan(m.baseline.access[0] * 1.5)
    for (const b of m.blockers) {
      expect(b.preApproved).toBeLessThanOrEqual(b.blocks)
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
      expect(low.access[0]).toBeLessThan(d.repairs.tierARepairedMap.access[0])
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
    expect(screen.getByText('Every course in the system')).toBeInTheDocument()
    // The checklist beat was cut: its claim lives in the arch and gradient.
    expect(screen.queryByText('Split the checklist')).not.toBeInTheDocument()
    expect(screen.getByText('the contested middle')).toBeInTheDocument()
    expect(screen.getByText(/Inside the contested band, like for like/)).toBeInTheDocument()
    expect(screen.getByText(/that is arithmetic, not a finding/)).toBeInTheDocument()
    // The market scatter lives in The Price of Place now, not here.
    expect(screen.queryByText('What wealth decides, across every major')).not.toBeInTheDocument()
    expect(screen.getByText('The staircase, taken apart')).toBeInTheDocument()
    expect(screen.getByText('The unwritten agreements')).toBeInTheDocument()
    expect(screen.getByText('Sign the papers')).toBeInTheDocument()
    expect(screen.getByText('How the gap closes')).toBeInTheDocument()
    expect(screen.getByText('Sign the introductory courses')).toBeInTheDocument()
    expect(screen.getByText(/The rich were always fine/)).toBeInTheDocument()
    // Each moment closes with its claim as figure ink.
    expect(screen.getByText(/The staircase climbs only where the blue line climbs/)).toBeInTheDocument()
    // Course-type repair bars with real pathway counts, and the waffle's
    // centerpiece stat with its tier detail.
    expect(screen.getAllByText(/\+\d+ pathways/).length).toBeGreaterThanOrEqual(4)
    expect(screen.getByText('Data structures')).toBeInTheDocument()
    expect(screen.getByText('Introductory programming')).toBeInTheDocument()
    expect(screen.getByText(/are already accepted for the/)).toBeInTheDocument()
    expect(screen.getByText(/accepted by the demanding campus itself/)).toBeInTheDocument()
    expect(screen.getByText(/what is missing is the entry in this campus’s table/)).toBeInTheDocument()
    expect(screen.getByText(/an observational bound/)).toBeInTheDocument()
    // Honesty ink present in both registers: the not-taught remainder and the
    // subject-level-evidence caveat.
    expect(screen.getAllByText(/not taught — no signature fixes these/).length).toBeGreaterThan(0)
    expect(screen.getByText(/subject-level evidence, not course-level proof/)).toBeInTheDocument()
  })

  it('switches basis: the ledger re-populates and moment-4 lines change', () => {
    render(<PaperGate />)
    // Floor: the type panel shows the floor's pathway counts.
    expect(screen.getByText(/\+103 pathways/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stated preparation' }))
    // Stated: its own counts and its own waffle total.
    expect(screen.getByText(/\+68 pathways/)).toBeInTheDocument()
    expect(screen.getByText(/of the 1,761 missing entries/)).toBeInTheDocument()
    // Stated basis: the gap-row note is suppressed by the collision guard;
    // the access-row verdict line carries the quotable geometry instead.
    expect(screen.getByText(/lands exactly on today’s richest quartile/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eligibility floor' }))
    expect(screen.getByText(/the gap shrinks by more than half/)).toBeInTheDocument()
  })

  it('separates access movement from the contracting rich-poor gap', () => {
    render(<PaperGate />)
    const signing = screen.getByTestId('paper-gate-signing')
    const arrows = [...signing.querySelectorAll('[data-movement-arrow]')]
    expect(arrows).toHaveLength(2)
    expect(arrows.every((arrow) => arrow.getAttribute('data-movement-arrow') === 'right')).toBe(true)
    expect(signing.querySelectorAll('circle')).toHaveLength(0)
    const gap = screen.getByTestId('paper-gate-gap-closing')
    expect(gap.querySelectorAll('[data-gap-span]')).toHaveLength(3)
    expect(gap.textContent).toContain('THE GAP ITSELF')
    expect(gap.textContent).toContain('the span contracts; no score moves left')
    expect(signing.textContent).toContain('Access moves along the blue arrows')
    expect(signing.textContent).toContain('AFTER SIGNATURES')
  })

  it('switches to the detailed register with methods ink', () => {
    render(<PaperGate />)
    expect(screen.queryByText(/Nothing here is a stacked decomposition/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }))
    // The conjunction guard, the tier sentence, and the decimals footnote
    // live in the detailed register only.
    expect(screen.getByText(/Nothing here is a stacked decomposition/)).toBeInTheDocument()
    expect(screen.getByText(/Decimals:/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'At a glance' }))
    expect(screen.queryByText(/Decimals:/)).not.toBeInTheDocument()
  })

  it('preview renders the mechanism figure alone', () => {
    render(<PaperGatePreview />)
    expect(screen.getByText(/solved infrastructure/)).toBeInTheDocument()
  })
})
