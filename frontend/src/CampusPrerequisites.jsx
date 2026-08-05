import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Alert, Badge, EmptyState, Spinner, Stack } from './components/ui'
import apiClient from './shared/api/apiClient'
import { useAuth } from './shared/hooks/useAuth'

/**
 * A campus's own published prerequisites, read from its catalogue.
 *
 * These are stated requirements, not inferred ones: the community-college side
 * of the corpus projects a shared concept template across colleges, but a
 * university states its prerequisites on the course's own page, so they are
 * recorded verbatim. `requisite_text` keeps the catalogue's own sentence beside
 * the parsed structure so a verifier can check one against the other.
 */
function useCampusPrerequisites(schoolId, { search = '', onlyWithPrerequisites = false } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['campus-prerequisites', schoolId, search, onlyWithPrerequisites],
    queryFn: async () => {
      const { data } = await apiClient.get('/curated/prerequisites', {
        params: {
          institution_id: `uc:${schoolId}`,
          ...(search ? { q: search } : {}),
          ...(onlyWithPrerequisites ? { with_prerequisites: 'true' } : {}),
          limit: 4000,
        },
      })
      return data
    },
    enabled: !!user?.uid && schoolId != null,
    staleTime: 5 * 60 * 1000,
  })
}

/** "uc:7:CSE 100" reads as "CSE 100" once you are already looking at one campus. */
const shortKey = (key) => String(key).replace(/^uc:\d+:/, '')

function Requisite({ groups }) {
  if (!groups?.length) return <span className='text-ink-subtle'>—</span>
  return (
    <span className='flex flex-wrap items-center gap-x-1.5 gap-y-1'>
      {groups.map((group, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className='text-tag text-ink-subtle'>and</span>}
          <span className='inline-flex items-center gap-1 rounded-md bg-surface-hover px-1.5 py-0.5'>
            {group.map((key, j) => (
              <React.Fragment key={key}>
                {j > 0 && <span className='text-tag text-ink-subtle'>or</span>}
                <span className='text-tag font-mono'>{shortKey(key)}</span>
              </React.Fragment>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  )
}

export default function CampusPrerequisites({ schoolId, school }) {
  const [search, setSearch] = useState('')
  const [onlyWithPrerequisites, setOnlyWithPrerequisites] = useState(true)
  const query = useCampusPrerequisites(schoolId, { search, onlyWithPrerequisites })

  const rows = query.data?.rows || []
  const total = query.data?.total ?? 0
  const truncated = total > rows.length

  const sourceNote = useMemo(() => {
    const sources = [...new Set(rows.map((r) => r.source).filter(Boolean))]
    return sources[0] || null
  }, [rows])
  const needsReview = rows.filter((r) => r.status === 'needs_review').length

  return (
    <Stack gap='cozy'>
      <div className='surface-card px-4 py-3'>
        <p className='text-caption ink-subtle'>
          Prerequisites as {school || 'this campus'} publishes them, read from its own catalogue rather than
          inferred from a shared template. Each row shows the parsed structure — requirements joined by
          <span className='font-mono text-tag'> and</span>, alternatives by
          <span className='font-mono text-tag'> or</span> — beside the catalogue’s own sentence.
        </p>
        {sourceNote && (
          <p className='mt-1 text-caption text-ink-subtle'>
            Source: <a className='underline' href={sourceNote} target='_blank' rel='noreferrer'>{sourceNote}</a>
          </p>
        )}
        {needsReview > 0 && (
          <p className='mt-1 text-caption text-ink-muted'>
            {needsReview} row{needsReview === 1 ? '' : 's'} marked <em>needs review</em>: the campus states a
            prerequisite the catalogue no longer lists, usually a retired course kept as a legacy alternative.
          </p>
        )}
      </div>

      <div className='flex flex-wrap items-center gap-3' data-export-exclude>
        <label className='flex-none w-[320px] flex items-center gap-2 bg-surface border border-border rounded-pill px-[15px] py-[9px]'>
          <MagnifyingGlassIcon className='w-[14px] h-[14px] text-ink-subtle shrink-0' />
          <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label='Search courses'
            placeholder='Search code / title…'
            className='flex-1 min-w-0 bg-transparent outline-none border-none text-caption ink-default placeholder:text-ink-subtle' />
        </label>
        <label className='flex items-center gap-2 text-caption ink-default'>
          <input type='checkbox' checked={onlyWithPrerequisites}
            onChange={(e) => setOnlyWithPrerequisites(e.target.checked)} />
          Only courses with prerequisites
        </label>
        {!query.isLoading && (
          <span className='text-caption text-ink-subtle'>
            {rows.length.toLocaleString()}
            {truncated ? ` of ${total.toLocaleString()}` : ''} course{rows.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {query.isLoading ? <div className='flex justify-center py-10'><Spinner /></div>
        : query.isError ? <Alert type='error'>Failed to load prerequisites for this campus.</Alert>
        : !rows.length ? (
          <EmptyState card className='p-8' title='No prerequisites on file'
            description={search
              ? 'No course here matches that search.'
              : 'This campus’s catalogue has not been captured yet.'} />
        ) : (
          <div className='surface-card overflow-auto max-h-[70vh]'>
            <table className='border-separate border-spacing-0 min-w-full'>
              <thead>
                <tr>
                  {['Course', 'Title', 'Units', 'Prerequisites', 'As published'].map((h, i) => (
                    <th key={h}
                      className={`sticky top-0 z-10 bg-surface border-b border-border px-3 py-2 text-left text-label ${i === 0 ? 'min-w-28' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className='hover:bg-surface-hover'>
                    <td className='border-b border-border px-3 py-1.5 text-caption font-mono whitespace-nowrap'>
                      {row.course_code}
                      {row.status === 'needs_review' && <Badge className='ml-1.5'>review</Badge>}
                    </td>
                    <td className='border-b border-border px-3 py-1.5 text-caption ink-subtle max-w-[280px] truncate'>
                      {row.course_name || '—'}
                    </td>
                    <td className='border-b border-border px-3 py-1.5 text-caption font-mono tabular-nums text-right'>
                      {row.units ?? '—'}
                    </td>
                    <td className='border-b border-border px-3 py-1.5'>
                      <Requisite groups={row.prerequisite_groups} />
                    </td>
                    <td className='border-b border-border px-3 py-1.5 text-tag text-ink-subtle max-w-[320px]'>
                      {row.requisite_text || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {truncated && (
        <p className='text-caption text-ink-subtle'>
          Showing the first {rows.length.toLocaleString()} of {total.toLocaleString()}. Narrow with the search
          to see the rest.
        </p>
      )}
    </Stack>
  )
}
