import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AUDIT_STORY } from './showcaseContent'
import AuditStepper from './AuditStepper'

describe('audit stepper', () => {
  it('walks corpus → templates → review → bound', () => {
    render(<AuditStepper />)
    expect(screen.getByText('2,415')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Template collapse/ }))
    expect(screen.getByText(/byte-identical/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Complete review/ }))
    expect(screen.getByText('47 of 47')).toBeInTheDocument()
    expect(screen.getByText(/no student would be left underprepared/i)).toBeInTheDocument()
  })

  it('shows the pending state instead of a fabricated bound', () => {
    render(<AuditStepper />)
    fireEvent.click(screen.getByRole('button', { name: /Statistical bound/ }))
    if (AUDIT_STORY.bound.ceilingPct === null) {
      expect(screen.getByText(AUDIT_STORY.bound.pendingNote)).toBeInTheDocument()
      expect(screen.queryByText(/≤ /)).not.toBeInTheDocument()
    } else {
      expect(screen.getByText(`${AUDIT_STORY.bound.ceilingPct.toFixed(1)}%`)).toBeInTheDocument()
    }
  })
})
