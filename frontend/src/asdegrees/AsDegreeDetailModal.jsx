import React, { useEffect, useState } from 'react'
import { Alert, Badge, Button, Input, Modal, Select, Spinner, Stack } from '../components/ui'
import { useAsDegreeDetail, useSaveAsDegree } from '../shared/query/hooks/useData'

// Badge has no 'warning' tone — 'conservative' (lavender) is the kit's
// caution/attention-needed tone (see components/ui/display/Badge.jsx).
const SOURCE_VARIANT = { extracted: 'neutral', template_default: 'conservative', curated: 'success' }

const describeSection = (s) => {
  if (s.unit_advisement != null) return `${s.unit_advisement} units from:`
  if (s.section_advisement != null) return `choose ${s.section_advisement} of:`
  return 'all of:'
}

// Plain, triage-grade detail view for one college's AS degree doc — bulk QA
// only (mark-group-reviewed, doc status, total_units). Course-level
// corrections and verification notes belong to the Phase 3 designed view
// (docs/as-degree-view-design-prompt.md); this modal deliberately doesn't
// touch either.
export default function AsDegreeDetailModal({ collegeId, onClose }) {
  const detail = useAsDegreeDetail(collegeId)
  const save = useSaveAsDegree()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Deep-copy the stored doc so edits never leak into the query cache.
    setDraft(detail.data?.doc ? JSON.parse(JSON.stringify(detail.data.doc)) : null)
    setError(null)
  }, [detail.data])

  if (!collegeId) return null
  const courses = detail.data?.courses_by_id || {}

  const markCurated = (i) => setDraft((d) => {
    const next = JSON.parse(JSON.stringify(d))
    next.requirement_groups[i].source = 'curated'
    next.requirement_groups[i].confidence = null
    return next
  })

  const commit = async () => {
    setError(null)
    try {
      await save.mutateAsync(draft)
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save.')
    }
  }

  return (
    <Modal open={!!collegeId} onClose={onClose} title={detail.data?.college_name || 'AS degree'}>
      {detail.isLoading && <Spinner />}
      {detail.isError && <Alert type='error'>Could not load this college.</Alert>}
      {draft && (
        <Stack gap='cozy'>
          <div className='flex items-center gap-3'>
            <Select value={draft.status} onChange={(status) => setDraft({ ...draft, status })}
              options={['found', 'none_found', 'ambiguous'].map((value) => ({ value, label: value }))} />
            {draft.status === 'found' && (
              <Input type='number' value={draft.total_units ?? ''} aria-label='Total units'
                onChange={(e) => setDraft({ ...draft, total_units: Number(e.target.value) })} />
            )}
            {draft.catalog_url && (
              <a className='underline' href={draft.catalog_url} target='_blank' rel='noreferrer'>
                open catalog ({draft.catalog_year})
              </a>
            )}
          </div>
          {(draft.requirement_groups || []).map((g, i) => (
            <div key={g.group_id} className='surface-card p-4'>
              <div className='flex items-center gap-2'>
                <strong>{g.label_seen || g.group_id}</strong>
                <Badge variant={SOURCE_VARIANT[g.source]}>{g.source}</Badge>
                {g.confidence != null && <span className='text-caption'>{Math.round(g.confidence * 100)}%</span>}
                {g.template_group == null && <Badge variant='conservative'>school-specific</Badge>}
                {g.source !== 'curated' && (
                  <Button variant='ghost' onClick={() => markCurated(i)}>Mark reviewed</Button>
                )}
              </div>
              {g.source === 'template_default' && (
                <p className='text-caption text-ink-subtle'>Placeholder — template group stands in; not catalog data.</p>
              )}
              {(g.sections || []).map((s, j) => (
                <div key={j} className='pl-3'>
                  <em className='text-caption'>{describeSection(s)}</em>
                  <ul>
                    {(s.receivers || []).map((r, k) => (
                      <li key={k} className='text-caption'>
                        {(r.options || []).map((o) =>
                          o.course_keys.map((key) => {
                            const c = courses[key]
                            return c ? `${c.code} — ${c.title} (${c.units ?? '?'}u)` : key
                          }).join(' + ')
                        ).join('  ·  or  ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {(g.unresolved_courses_seen || []).length > 0 && (
                <p className='text-caption text-danger'>
                  Unmatched catalog citations: {g.unresolved_courses_seen.map((u) => u.course_code_seen).join(', ')}
                </p>
              )}
            </div>
          ))}
          {error && <Alert type='error'>{error}</Alert>}
          <div className='flex justify-end gap-2'>
            <Button variant='ghost' onClick={onClose}>Cancel</Button>
            <Button onClick={commit} disabled={save.isPending}>Save</Button>
          </div>
        </Stack>
      )}
    </Modal>
  )
}
