import React from 'react'
import { createRequire } from 'node:module'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PrereqGraph from './PrereqGraph'

const cjs = createRequire(import.meta.url)
const { concepts } = cjs('../../../scripts/data/prereq_concepts.json')

function rulesFromConcepts(rows) {
  let sequence = 0
  return rows.flatMap((concept) => (concept.requires || []).flatMap((entry) => {
    if (!Array.isArray(entry)) return [{ from: entry, to: concept.slug }]
    const group = `or:${concept.slug}:${sequence++}`
    return entry.map((from) => ({ from, to: concept.slug, option: true, group }))
  }))
}

describe('PrereqGraph expanded shared vocabulary', () => {
  it('lays out the Biology/Economics and Virginia expansion, including OR and satisfies concepts', () => {
    render(<PrereqGraph mode='canonical' concepts={concepts} rules={rulesFromConcepts(concepts)} />)

    expect(concepts).toHaveLength(57)
    expect(screen.getByLabelText(/^Precalculus I \(Algebra and Functions\),/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Genetics,/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Biochemistry \(Science Majors\),/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Introduction to Psychology,/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Introduction to Economics \(Combined Micro & Macro\),/)).toBeInTheDocument()
    expect(screen.getByRole('group', {
      name: 'Prerequisite graph: disciplines as rows, prerequisite depth as columns',
    })).toBeInTheDocument()
  })
})
