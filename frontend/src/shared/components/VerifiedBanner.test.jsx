import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import VerifiedBanner from './VerifiedBanner'

describe('VerifiedBanner', () => {
  it('names the verifier and dates the verdict', () => {
    // The banner renders a UTC instant in the reader's own timezone, so the
    // calendar day it prints depends on where the reader is: 15:26Z on the 3rd
    // is already the 4th in Tokyo. Hard-coding "8/3/2026" made this test pass
    // in the Americas and fail across the dateline. Expect what the component's
    // own formatter yields for that instant instead.
    const at = '2026-08-03T15:26:00Z'
    const expected = new Date(at).toLocaleDateString()
    render(<VerifiedBanner verifiers={['Tybalt Mallet']} verifiedAt={at} />)
    expect(screen.getByText('Verified by Tybalt Mallet')).toBeTruthy()
    expect(screen.getByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy()
  })

  it('accepts a bare string as well as a list, so every caller can pass what it holds', () => {
    render(<VerifiedBanner verifiers='Roy Martinez' />)
    expect(screen.getByText('Verified by Roy Martinez')).toBeTruthy()
  })

  it('still reads as verified when nobody is named', () => {
    render(<VerifiedBanner />)
    expect(screen.getByText('Verified')).toBeTruthy()
  })

  it('says what the record was checked against, which is the substance of the claim', () => {
    render(<VerifiedBanner checkedAgainst='the college catalog' />)
    expect(screen.getByText(/checked against the college catalog/)).toBeTruthy()
  })

  it('names the button that reopens it, which differs by console', () => {
    render(<VerifiedBanner reopenLabel='Reopen' />)
    expect(screen.getByText(/Use Reopen below/)).toBeTruthy()
  })
})
