import React, { useEffect, useMemo, useState } from 'react'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import {
  Alert, Button, Combobox, EmptyState, RemovableItem, Spinner, Stack, Tabs, Textarea,
} from '../../components/ui'
import { useAsDegreeDetail, useCcCourses, useSaveAsDegree } from '../../shared/query/hooks/useData'
import apiClient from '../../shared/api/apiClient'
import {
  courseByIdKey, courseLabel, groupCourseIds, groupLabel, isComplexGroup, setGroupCourses,
} from './asDegreeCourses'

/**
 * Check one college's AI-scraped AS degrees against its catalog.
 *
 * The job is reading, not data entry: the degree is rendered the way a catalog
 * lists it, next to a link to the catalog itself. Three actions cover the work
 * — mark the record, fix a group's courses, or describe anything else in
 * English and let the assist rewrite it. Nothing here mentions sections,
 * receivers or options; asDegreeCourses.js translates to and from the stored
 * shape.
 */
export default function AsDegreeReview({ collegeId, onClose = null }) {
  const detail = useAsDegreeDetail(collegeId != null ? `cc:${collegeId}` : null)
  const courses = useCcCourses(collegeId)
  const save = useSaveAsDegree()

  const records = detail.data?.degrees || []
  const [recordId, setRecordId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)

  const active = records.find((r) => r.doc?._id === recordId) || records[0] || null

  useEffect(() => {
    if (!active?.doc) return
    setDraft((current) => {
      if (current?._id === active.doc._id) return current
      setNote(active.doc.verification?.note || '')
      return active.doc
    })
    setRecordId((current) => current ?? active.doc._id)
  }, [active])

  const courseOptions = useMemo(() => (courses.data?.rows || []).map((c) => ({
    value: String(c.course_id ?? c.id),
    label: courseLabel(c),
  })), [courses.data])

  const coursesById = active?.courses_by_id || {}
  const dirty = draft && active?.doc && JSON.stringify(draft) !== JSON.stringify(active.doc)

  const applyGroup = (groupId, courseIds) => setDraft((doc) => ({
    ...doc,
    requirement_groups: (doc.requirement_groups || []).map((g) => (
      g.group_id === groupId ? setGroupCourses(g, courseIds) : g
    )),
  }))

  const persist = async (doc, { verified = null } = {}) => {
    setError(null)
    const next = verified === null ? doc : {
      ...doc,
      verification: {
        ...(doc.verification || {}),
        verified,
        verified_at: new Date().toISOString(),
        // Written by the person checking the catalog, never generated.
        note: note.trim() || null,
      },
    }
    try {
      await save.mutateAsync(next)
      setDraft(next)
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save this record.')
    }
  }

  if (detail.isLoading) return <div className='flex justify-center py-12'><Spinner /></div>
  if (detail.isError && detail.error?.response?.status !== 404) {
    return <Alert type='error'>Could not load this college's records.</Alert>
  }
  if (!records.length) {
    return <EmptyState card title='No AS-degree records'
      description='Nothing has been scraped for this college yet.' />
  }
  if (!draft) return <div className='flex justify-center py-12'><Spinner /></div>

  const groups = draft.requirement_groups || []
  const verified = !!draft.verification?.verified

  return (
    <Stack gap='section'>
      {error && <Alert type='error'>{error}</Alert>}

      <div className='flex flex-wrap items-center gap-3'>
        {records.length > 1 && (
          <Tabs
            value={recordId || records[0].doc._id}
            onChange={(id) => { setRecordId(id); setDraft(records.find((r) => r.doc._id === id)?.doc || null) }}
            options={records.map((r) => ({ value: r.doc._id, label: r.doc.degree_title_seen || r.doc.degree_type }))}
          />
        )}
        {draft.catalog_url && (
          <a href={draft.catalog_url} target='_blank' rel='noreferrer'
            className='inline-flex items-center gap-1.5 text-caption text-ink-muted hover:text-ink'>
            <ArrowTopRightOnSquareIcon className='w-4 h-4' aria-hidden='true' />
            Catalog{draft.catalog_year ? ` ${draft.catalog_year}` : ''}
          </a>
        )}
        <span className={`ml-auto text-caption ${verified ? 'text-primary' : 'text-ink-subtle'}`}>
          {verified ? 'Verified' : 'Not yet verified'}
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyState card title='This record has no requirement groups'
          description='Use the box below to describe what it should contain.' />
      ) : (
        <Stack gap='comfortable'>
          {groups.map((group) => (
            <GroupRow key={group.group_id} group={group} coursesById={coursesById}
              courseOptions={courseOptions}
              onChange={(ids) => applyGroup(group.group_id, ids)} />
          ))}
        </Stack>
      )}

      <AssistBox recordId={draft._id} onApply={(doc) => setDraft(doc)} />

      <div className='border-t border-border pt-4'>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="What's wrong with this record, or what did you check? (saved with your verdict)" />
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <Button onClick={() => persist(draft, { verified: true })}
          disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Mark verified'}
        </Button>
        <Button variant='secondary' onClick={() => persist(draft, { verified: false })}
          disabled={save.isPending}>
          Needs work
        </Button>
        {dirty && (
          <Button variant='ghost' onClick={() => persist(draft)} disabled={save.isPending}>
            Save changes only
          </Button>
        )}
        {onClose && <Button variant='ghost' className='ml-auto' onClick={onClose}>Close</Button>}
      </div>
    </Stack>
  )
}

/** One requirement group: its name, and the courses it asks for. */
function GroupRow({ group, coursesById, courseOptions, onChange }) {
  const ids = groupCourseIds(group)
  const complex = isComplexGroup(group)

  return (
    <div className='surface-card p-4'>
      <div className='flex flex-wrap items-baseline gap-2 mb-3'>
        <p className='text-body-strong'>{groupLabel(group)}</p>
        {group.ge_area && <span className='text-caption text-ink-subtle'>{group.ge_area}</span>}
        {group.source === 'curated' && <span className='text-caption text-primary'>edited</span>}
      </div>

      {complex ? (
        <>
          <ul className='flex flex-col gap-1'>
            {ids.map((id) => (
              <li key={id} className='text-body'>{courseLabel(coursesById[courseByIdKey(id)]) || `Course ${id}`}</li>
            ))}
          </ul>
          <p className='mt-2 text-caption text-ink-subtle'>
            This group has a choice rule that a plain list can't show, so it is read-only here.
            Describe any change in the box below.
          </p>
        </>
      ) : (
        <Stack gap='cozy'>
          {ids.length === 0
            ? <p className='text-caption text-ink-subtle'>No courses.</p>
            : (
              <div className='flex flex-col gap-1.5'>
                {ids.map((id) => (
                  <RemovableItem key={id}
                    label={courseLabel(coursesById[courseByIdKey(id)]) || `Course ${id}`}
                    removeLabel='Remove course'
                    onRemove={() => onChange(ids.filter((x) => x !== id))} />
                ))}
              </div>
            )}
          <Combobox value='' options={courseOptions} placeholder='Add a course…'
            onChange={(value) => value && onChange([...ids, Number(value)])} />
        </Stack>
      )}
    </div>
  )
}

/** Describe a problem in English; review the rewrite before it is applied. */
function AssistBox({ recordId, onApply }) {
  const [instruction, setInstruction] = useState('')
  const [proposal, setProposal] = useState(null)
  const [state, setState] = useState({ busy: false, error: null })

  const propose = async () => {
    setState({ busy: true, error: null })
    try {
      const { data } = await apiClient.post(
        `/curated/as-degrees/${encodeURIComponent(recordId)}/assist`,
        { instruction },
      )
      setProposal(data)
    } catch (e) {
      setState({ busy: false, error: e?.response?.data?.error || 'Could not produce a change.' })
      return
    }
    setState({ busy: false, error: null })
  }

  return (
    <div className='surface-card p-4'>
      <p className='field-label mb-2'>Something else wrong?</p>
      <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2}
        placeholder='e.g. the core group should be split into maths and computing' />
      {state.error && <Alert type='error' className='mt-2'>{state.error}</Alert>}
      {proposal ? (
        <div className='mt-3'>
          <ul className='flex flex-col gap-1 mb-3'>
            {(proposal.changes || []).map((c, i) => (
              <li key={i} className='text-caption'>
                <span className='text-ink-subtle'>{c.group_id}</span> — {c.summary}
              </li>
            ))}
          </ul>
          <div className='flex gap-2'>
            <Button onClick={() => { onApply(proposal.proposed_doc); setProposal(null); setInstruction('') }}>
              Apply
            </Button>
            <Button variant='ghost' onClick={() => setProposal(null)}>Discard</Button>
          </div>
        </div>
      ) : (
        <Button className='mt-2' variant='secondary' disabled={!instruction.trim() || state.busy}
          onClick={propose}>
          {state.busy ? 'Thinking…' : 'Propose a change'}
        </Button>
      )}
    </div>
  )
}
