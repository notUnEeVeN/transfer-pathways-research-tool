import React, { useState } from 'react'
import { Alert, Stack } from './components/ui'
import GoogleIdentityButton from '@frontend/components/auth/GoogleIdentityButton'
import { signInWithGoogleIdToken } from '@frontend/components/auth/googleAuth'

/**
 * Interactive Google sign-in for the research console — replaces the desktop
 * tool's silent local-token mint. Anyone with a Google account can sign in;
 * the server's allowlist (admins + granted partners) decides whether the
 * console actually opens (see App's /access/me gate).
 */
export default function SignInScreen() {
  const [error, setError] = useState(null)

  const onCredential = async (idToken) => {
    try {
      setError(null)
      await signInWithGoogleIdToken(idToken)
    } catch (e) {
      setError(e?.message || 'Sign-in failed. Please try again.')
    }
  }

  return (
    <div className='h-screen bg-surface text-ink flex items-center justify-center px-6'>
      <div className='w-full max-w-sm'>
        <Stack gap='comfortable'>
          <div>
            <h1 className='text-heading'>Transfer Pathways Research Console</h1>
            <p className='text-caption text-ink-muted mt-1'>
              Transfer-pathway auditing and analysis. Access is limited to
              project members — sign in with the Google account your admin
              granted.
            </p>
          </div>
          {error && <Alert type='error'>{error}</Alert>}
          <GoogleIdentityButton onCredential={onCredential} text='signin_with' />
        </Stack>
      </div>
    </div>
  )
}
