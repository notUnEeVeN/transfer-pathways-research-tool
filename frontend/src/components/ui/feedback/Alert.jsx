import React from 'react'
import { CheckCircleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

const variants = {
  success: { icon: CheckCircleIcon, fg: 'text-success', bar: 'bg-success', tint: 'bg-success-soft', border: 'border-success/20' },
  error: { icon: XCircleIcon, fg: 'text-danger', bar: 'bg-danger', tint: 'bg-danger-soft', border: 'border-danger/20' },
  info: { icon: InformationCircleIcon, fg: 'text-primary', bar: 'bg-primary', tint: 'bg-primary-soft', border: 'border-primary/20' }
}

/**
 * Page-level banner — a soft tinted fill, a tone-colored left accent bar, and a
 * matching icon. Three tones: success, error, info. "Warning" is intentionally
 * not a tone — fold lighter prompts into info.
 */
export default function Alert({ type = 'info', message, children, className = '' }) {
  const v = variants[type] || variants.info
  const Icon = v.icon
  return (
    <div
      className={`relative flex items-start gap-2.5 pl-4 pr-4 py-3 rounded-lg border ${v.border} ${v.tint} overflow-hidden ${className}`}
    >
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-1 ${v.bar}`} />
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${v.fg}`} />
      <div className='text-body text-ink-muted min-w-0'>{message ?? children}</div>
    </div>
  )
}
