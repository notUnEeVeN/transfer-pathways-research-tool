import React, { useState } from 'react'
import { ChevronRightIcon, ClockIcon } from '@heroicons/react/24/outline'
import { Alert, Spinner } from './ui'
import { useRequirementRevisions } from '@frontend/query/hooks/useData'
import { useAccessMe } from '@frontend/query/hooks/useAccess'

// Admin-only view of the hand edits made to a verified document — who saved,
// when, and the field-level changes. AI-scraped data enters through the import
// scripts, never the save endpoint, so every entry here is a human correction:
// the point is to review the hand-verification, not the machine import.

function fmtValue(v) {
  if (v === null || v === undefined) return '∅'
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return s.length > 90 ? `${s.slice(0, 90)}…` : s
}

function revisionKind(rev) {
  if (rev.created) return { label: 'created', tone: 'text-ink-muted' }
  if (rev.verified) return { label: 'verified', tone: 'text-success' }
  return { label: 'edited', tone: 'text-ink-muted' }
}

/**
 * `kind` — 'as_degree' | 'degree'; `id` — the document's _id (or legacy id).
 * Renders nothing for non-admins, so callers can drop it in unconditionally.
 */
export default function RevisionHistory({ kind, id }) {
  const me = useAccessMe()
  const isAdmin = me.data?.role === 'admin'
  const [open, setOpen] = useState(false)
  const q = useRequirementRevisions(kind, id, { enabled: isAdmin && !!id })

  if (!isAdmin || !id) return null

  const revisions = q.data?.revisions || []
  const count = revisions.length

  return (
    <div className='surface-card overflow-hidden'>
      <button type='button' onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className='w-full flex items-center gap-2.5 px-5 py-3 text-left hover:bg-surface-hover'>
        <ClockIcon className='w-4 h-4 text-ink-subtle shrink-0' />
        <span className='text-label'>Edit history</span>
        <span className='text-tag text-ink-subtle'>admin · {q.isLoading ? '…' : count} edit{count === 1 ? '' : 's'}</span>
        <ChevronRightIcon className={`w-4 h-4 ml-auto text-ink-subtle transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className='border-t border-border px-5 py-4'>
          {q.isLoading ? (
            <div className='flex justify-center py-4'><Spinner /></div>
          ) : q.isError ? (
            <Alert type='error'>Could not load the edit history.</Alert>
          ) : !count ? (
            <p className='text-caption text-ink-muted'>No hand edits recorded yet.</p>
          ) : (
            <ol className='flex flex-col gap-4'>
              {revisions.map((rev) => {
                const meta = revisionKind(rev)
                return (
                  <li key={rev.id} className='min-w-0'>
                    <div className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
                      <span className='text-body-strong'>{rev.by_label || rev.by_uid || 'unknown'}</span>
                      <span className={`text-caption font-[650] ${meta.tone}`}>{meta.label}</span>
                      <span className='text-caption text-ink-subtle'>
                        {rev.at ? new Date(rev.at).toLocaleString() : ''}
                      </span>
                    </div>
                    {rev.changes.length > 0 && (
                      <ul className='mt-1.5 flex flex-col gap-1'>
                        {rev.changes.map((c, i) => (
                          <li key={`${c.path}:${i}`} className='text-caption min-w-0'>
                            <code className='text-ink-muted break-words'>{c.path}</code>
                            <span className='mx-1.5 text-ink-subtle'>·</span>
                            <span className='text-danger line-through break-words'>{fmtValue(c.from)}</span>
                            <span className='mx-1.5 text-ink-subtle'>→</span>
                            <span className='text-success break-words'>{fmtValue(c.to)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
