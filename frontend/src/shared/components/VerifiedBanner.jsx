import React from 'react'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'

/**
 * "Verified by <person>, on <date>" — the one place that sentence is drawn.
 *
 * It was written three times: a full banner on the four-year templates, a
 * near-identical one on the associate-degree review whose wording had drifted,
 * and a small `verified · Name` badge in the Virginia console. The same fact
 * about the same kind of record read as three different assurances depending on
 * which tab you were standing in, and the compact badge in particular gave a
 * hand-verified Virginia degree less standing on the page than a Californian
 * one — a difference in emphasis nobody had decided on.
 *
 * `checkedAgainst` is the only copy that legitimately varies: what a verifier
 * actually compared the record against differs by corpus (official program
 * pages, a college catalog), and saying so is the substance of the claim.
 */
export default function VerifiedBanner({
  verifiers = [],
  verifiedAt = null,
  checkedAgainst = 'the official pages',
  subject = 'This record has',
  reopenLabel = 'Unverify',
}) {
  const names = (Array.isArray(verifiers) ? verifiers : [verifiers]).filter(Boolean)
  return (
    <div className='surface-card border-l-4 border-success bg-success-soft px-4 py-3 flex items-center gap-2.5'>
      <CheckBadgeIcon className='w-5 h-5 text-success shrink-0' />
      <div className='min-w-0'>
        <p className='text-body-strong text-success'>
          Verified{names.length ? ` by ${names.join(', ')}` : ''}
        </p>
        <p className='text-caption text-ink-muted'>
          {subject} been checked against {checkedAgainst}
          {verifiedAt ? ` · ${new Date(verifiedAt).toLocaleDateString()}` : ''}.
          {' '}Use {reopenLabel} below to flag it for another look.
        </p>
      </div>
    </div>
  )
}
