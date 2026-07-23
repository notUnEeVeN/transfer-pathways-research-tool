import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AsDegreeHeaderFields from './AsDegreeHeaderFields'
import { buildScaffold } from './asDegreeScaffold'

const doc = buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' })

describe('AsDegreeHeaderFields', () => {
  it('writes the catalog year back onto the whole document', () => {
    const onChange = vi.fn()
    render(<AsDegreeHeaderFields doc={doc} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Catalog year'), { target: { value: '2025-26' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      catalog_year: '2025-26', legacy_id: '110:cs:ast',
    }))
  })

  it('parses total units as a number, not a string', () => {
    const onChange = vi.fn()
    render(<AsDegreeHeaderFields doc={doc} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Total units'), { target: { value: '60' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ total_units: 60 }))
  })

  it('leaves total units null when the field is cleared', () => {
    const onChange = vi.fn()
    render(<AsDegreeHeaderFields doc={{ ...doc, total_units: 60 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Total units'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ total_units: null }))
  })
})
