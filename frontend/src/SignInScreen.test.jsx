import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Task 6 (Sign-in hero): GIS only ever renders its own button (no
// custom-trigger API), so the button is stubbed here — this test exercises
// the hero layout/copy and the onCredential -> signInWithGoogleIdToken
// wiring, not Google's actual rendered button. Mock idiom follows
// App.chrome.test.jsx / InstitutionRail.test.jsx (whole-module replacement
// so the real GIS script / Firebase never loads in tests).
const { capturedProps } = vi.hoisted(() => ({ capturedProps: {} }))

vi.mock('@frontend/components/auth/GoogleIdentityButton', () => ({
  default: (props) => {
    Object.assign(capturedProps, props)
    return <div data-testid='gis' />
  }
}))

vi.mock('@frontend/components/auth/googleAuth', () => ({
  signInWithGoogleIdToken: vi.fn()
}))

import { signInWithGoogleIdToken } from '@frontend/components/auth/googleAuth'
import SignInScreen from './SignInScreen'

describe('SignInScreen', () => {
  it('renders the two-line hero heading', () => {
    render(<SignInScreen />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(/Transfer Pathways/)
    expect(heading).toHaveTextContent(/Research Console/)
  })

  it('renders the eyebrow label above the heading', () => {
    render(<SignInScreen />)
    expect(screen.getByText('Transfer Pathways · Research')).toBeInTheDocument()
  })

  it('renders the sign-in caption copy verbatim', () => {
    render(<SignInScreen />)
    expect(
      screen.getByText(
        'Transfer-pathway auditing and analysis. Access is limited to project members — sign in with the Google account your admin granted.'
      )
    ).toBeInTheDocument()
  })

  it('renders the allowlist caption below the Google button', () => {
    render(<SignInScreen />)
    expect(
      screen.getByText('Access is allowlisted per project. Wrong account? Ask your admin.')
    ).toBeInTheDocument()
  })

  it('renders the copyright footer', () => {
    render(<SignInScreen />)
    expect(screen.getByText('© 2026 Transfer Pathways Research')).toBeInTheDocument()
  })

  it('renders the Google Identity button', () => {
    render(<SignInScreen />)
    expect(screen.getByTestId('gis')).toBeInTheDocument()
  })

  it('renders the Google button as a centered pill CTA with signin_with text', () => {
    render(<SignInScreen />)
    expect(capturedProps.text).toBe('signin_with')
    expect(capturedProps.shape).toBe('pill')
    expect(capturedProps.fullWidth).toBe(false)
    expect(typeof capturedProps.onCredential).toBe('function')
  })

  it('shows no error alert before any sign-in attempt', () => {
    render(<SignInScreen />)
    expect(screen.queryByText(/sign-in failed/i)).not.toBeInTheDocument()
  })

  it('wires onCredential to signInWithGoogleIdToken and shows an error Alert on failure', async () => {
    signInWithGoogleIdToken.mockRejectedValueOnce(new Error('Sign-in failed. Please try again.'))
    render(<SignInScreen />)

    await act(async () => {
      await capturedProps.onCredential('fake-id-token')
    })

    expect(signInWithGoogleIdToken).toHaveBeenCalledWith('fake-id-token')
    expect(screen.getByText('Sign-in failed. Please try again.')).toBeInTheDocument()
  })
})
