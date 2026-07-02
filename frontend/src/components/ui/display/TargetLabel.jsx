import React from 'react'

/**
 * Canonical transfer-target typography: a bold school name followed by the muted
 * " · major". Renders inline content only — the caller owns the wrapping element
 * and its truncation/width. Use anywhere a target (school + major) is named so
 * the bold/muted split and the separator stay identical everywhere.
 */
export default function TargetLabel({ target }) {
  return (
    <>
      <span className='text-body-strong'>{target.school_name}</span>
      <span className='text-ink-subtle'> · {target.major}</span>
    </>
  )
}
