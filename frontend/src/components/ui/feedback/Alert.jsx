import React from 'react'
import { CheckCircleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

const variants = {
  success: { icon: CheckCircleIcon, fg: 'text-success', bar: 'bg-success' },
  error: { icon: XCircleIcon, fg: 'text-danger', bar: 'bg-danger' },
  // Info's bar is the brand accent (lime) — the flat-card "brand hook",
  // not a role color like success/error.
  info: { icon: InformationCircleIcon, fg: 'text-primary', bar: 'bg-accent' }
}

/**
 * Page-level banner — a flat white card with a tone-colored 3px left accent
 * bar and a matching icon. Three tones: success, error, info. "Warning" is
 * intentionally not a tone — fold lighter prompts into info.
 */
export default function Alert({ type = 'info', message, children, className = '' }) {
  const v = variants[type] || variants.info
  const Icon = v.icon
  return (
    <div className={`relative flex items-start gap-2.5 px-[22px] py-4 surface-card overflow-hidden ${className}`}>
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${v.bar}`} />
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${v.fg}`} />
      <div className='text-body text-ink-muted min-w-0'>{message ?? children}</div>
    </div>
  )
}
