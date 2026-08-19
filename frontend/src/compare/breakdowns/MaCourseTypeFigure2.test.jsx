import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MaCourseTypeFigure2, { reconcileMaFigure2Distributions } from './MaCourseTypeFigure2'

describe('MaCourseTypeFigure2', () => {
  it('reconciles anonymous observations as category multisets, not indexed campuses', () => {
    const audit = reconcileMaFigure2Distributions()
    const byKey = Object.fromEntries(audit.groups.map((group) => [group.key, group]))

    expect(audit).toMatchObject({ matched: 34, observations: 38 })
    expect(byKey.own_discipline).toMatchObject({
      matched: 9,
      directOnly: [6, 28],
      pdfOnly: [5, 30],
    })
    expect(byKey.quantitative).toMatchObject({
      matched: 10,
      directOnly: [95],
      pdfOnly: [98],
    })
    expect(byKey.supporting_discipline).toMatchObject({
      matched: 11,
      directOnly: [],
      pdfOnly: [],
    })
    expect(byKey.non_stem).toMatchObject({
      matched: 4,
      directOnly: [33],
      pdfOnly: [67],
    })
  })

  it('states the reproducibility result and the anonymity limitation plainly', () => {
    render(<MaCourseTypeFigure2 />)

    expect(screen.getByText(/34 of 38 observations reproduce/i)).toBeInTheDocument()
    expect(screen.getByText(/no observation index or campus identity is joined/i))
      .toBeInTheDocument()
    expect(screen.getByText(/Non-STEM is the substantive mean disagreement/i))
      .toBeInTheDocument()
    expect(screen.getByText(/deposited rerun is 69\.4%, while the final PDF is 76\.2%/i))
      .toBeInTheDocument()
    expect(screen.getByText(/Rerun-only \[33\] · PDF-only \[67\]/i)).toBeInTheDocument()
  })
})
