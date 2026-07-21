import React, { useState } from 'react'
import { Alert, Logo } from './components/ui'
import GoogleIdentityButton from '@frontend/components/auth/GoogleIdentityButton'
import { signInWithGoogleIdToken } from '@frontend/components/auth/googleAuth'

/**
 * Interactive Google sign-in for the research console — replaces the desktop
 * tool's silent local-token mint. Anyone with a Google account can sign in;
 * the server's allowlist (admins + granted partners) decides whether the
 * console actually opens (see App's /access/me gate).
 *
 * Layout is the v2 mockup's sign-in hero (v2:1347-1384): a giant watermark
 * logomark anchored bottom-left, a centered column (mark, eyebrow, display
 * heading, caption, Google button, allowlist note), and a fixed footer line.
 * GIS only ever renders its own button (no custom-trigger API), so it sits
 * where the mockup's lime CTA sits, rendered as a centered pill.
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
    <div className='min-h-screen relative overflow-hidden grid place-items-center bg-canvas'>
      <span
        aria-hidden
        className='absolute pointer-events-none'
        style={{ left: -190, bottom: -150, color: 'var(--color-accent)', opacity: 0.16 }}
      >
        <Logo size={470} />
      </span>

      <div className='flex flex-col items-center text-center px-6 py-10 max-w-[620px]'>
        <span style={{ color: 'var(--color-accent)' }}>
          <Logo size={54} />
        </span>

        <div className='mt-[26px] text-[12px] font-[650] tracking-[.14em] uppercase text-ink-muted'>
          Transfer Pathways · Research
        </div>

        <h1 className='text-display-lg mt-3.5'>
          Transfer Pathways
          <br />
          Research Console
        </h1>

        <p className='mt-[18px] max-w-[44ch] text-body leading-[1.6] text-ink-muted'>
          Transfer-pathway auditing and analysis. Access is limited to
          project members — sign in with the Google account your admin
          granted.
        </p>

        {error && (
          <Alert type='error' className='mt-4'>
            {error}
          </Alert>
        )}

        <GoogleIdentityButton
          onCredential={onCredential}
          text='signin_with'
          shape='pill'
          fullWidth={false}
          className='mt-[30px]'
        />

        <div className='mt-3.5 text-[12.5px] text-ink-subtle'>
          Access is allowlisted per project. Wrong account? Ask your admin.
        </div>
      </div>

      <div className='absolute bottom-[22px] left-0 right-0 text-center text-[12px] text-ink-subtle'>
        © 2026 Transfer Pathways Research
      </div>
    </div>
  )
}
