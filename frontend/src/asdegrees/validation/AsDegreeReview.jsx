import React, { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  Alert, Button, Combobox, EmptyState, Spinner, Stack, Tabs, Textarea,
} from '../../components/ui'
import { useAsDegreeDetail, useCcCourses, useSaveAsDegree } from '../../shared/query/hooks/useData'
import apiClient from '../../shared/api/apiClient'
import {
  courseByIdKey, courseLabel, groupCourseIds, groupLabel, isComplexGroup, setGroupCourses,
} from './asDegreeCourses'

/**
 * Correct and sign off one college's AI-scraped AS degrees.
 *
 * The degree is already rendered above this panel, in catalog form, by
 * DegreePanel — that is what the researcher reads against the real catalog, so
 * this panel never repeats it. It carries the three things that view cannot:
 * adding or removing a course, describing a change too involved to click, and
 * a verdict with a note.
 */
export default function AsDegreeReview({ collegeId }) {
  const detail = useAsDegreeDetail(collegeId != null ? `cc:${collegeId}` : null)
  const courses = useCcCourses(collegeId)
  const save = useSaveAsDegree()

  const records = detail.data?.degrees || []
  const [recordId, setRecordId] = useState(null)
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)

  const active = records.find((r) => r.doc?._id === recordId) || records[0] || null
  const stored = active?.doc || null
  const doc = draft && draft._id === stored?._id ? draft : stored

  useEffect(() => {
    if (!stored) return
    setNote(stored.verification?.note || '')
    setDraft(null)
    setSaved(null)
  }, [stored?._id])

  const courseOptions = (courses.data?.rows || []).map((c) => ({
    value: String(c.course_id),
    label: courseLabel(c),
  }))

  // Only groups a flat list can represent honestly. A group encoding a real
  // choice rule is left to the assistant rather than shown here half-editable.
  const quickFixGroups = (doc?.requirement_groups || [])
    .filter((g) => !isComplexGroup(g) && groupCourseIds(g).length)

  const editGroup = (groupId, courseIds) => setDraft({
    ...doc,
    requirement_groups: doc.requirement_groups.map((g) => (
      g.group_id === groupId ? setGroupCourses(g, courseIds) : g
    )),
  })

  // verified === null saves course edits without touching the verdict.
  const persist = async (verified) => {
    setError(null)
    setSaved(null)
    try {
      await save.mutateAsync(verified === null ? doc : {
        ...doc,
        verification: {
          ...(doc.verification || {}),
          verified,
          verified_at: new Date().toISOString(),
          // Written by the person reading the catalog, never generated.
          note: note.trim() || null,
        },
      })
      setDraft(null)
      setSaved(verified === null
        ? 'Course changes saved.'
        : verified ? 'Marked verified.' : 'Flagged as needing work.')
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save this record.')
    }
  }

  if (detail.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (detail.isError && detail.error?.response?.status !== 404) {
    return <Alert type='error'>Could not load this college&apos;s records.</Alert>
  }
  if (!doc) {
    return <EmptyState card title='No AS-degree records'
      description='Nothing has been scraped for this college yet.' />
  }

  const verified = !!doc.verification?.verified

  return (
    <Stack gap='comfortable'>
      <div className='flex flex-wrap items-center gap-3'>
        {records.length > 1 && (
          <Tabs value={doc._id} onChange={setRecordId}
            options={records.map((r) => ({
              value: r.doc._id,
              label: r.doc.degree_title_seen || r.doc.degree_type,
            }))} />
        )}
        <span className={`ml-auto text-caption ${verified ? 'text-primary' : 'text-ink-subtle'}`}>
          {verified ? 'Verified' : 'Not yet verified'}
        </span>
      </div>

      {quickFixGroups.length > 0 && (
        <div className='surface-card p-4'>
          <p className='text-body-strong'>Quick fixes</p>
          <p className='text-caption text-ink-subtle mt-0.5 mb-3'>
            Add or remove a course. Anything more involved — splitting a group,
            changing how many are required — goes to the assistant below.
          </p>
          <Stack gap='comfortable'>
            {quickFixGroups.map((group) => (
              <QuickFixGroup key={group.group_id} group={group}
                coursesById={active?.courses_by_id || {}} courseOptions={courseOptions}
                onChange={(ids) => editGroup(group.group_id, ids)} />
            ))}
          </Stack>
        </div>
      )}

      <AssistBox recordId={doc._id} onApplied={() => { setDraft(null); detail.refetch() }} />

      <div>
        <span className='field-label'>Verification note</span>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder='What you checked, or what is still wrong. Saved with your verdict.' />
      </div>

      {error && <Alert type='error'>{error}</Alert>}
      {saved && <Alert type='success'>{saved}</Alert>}

      <div className='flex flex-wrap items-center gap-2'>
        {draft && (
          <Button variant='secondary' onClick={() => persist(null)} disabled={save.isPending}>
            Save course changes
          </Button>
        )}
        <Button onClick={() => persist(true)} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Mark verified'}
        </Button>
        <Button variant='secondary' onClick={() => persist(false)} disabled={save.isPending}>
          Needs work
        </Button>
      </div>
    </Stack>
  )
}

/**
 * Describe a correction in plain English; the assistant rewrites the stored
 * document, and the change is listed before anything is saved.
 */
function AssistBox({ recordId, onApplied }) {
  const save = useSaveAsDegree()
  const [instruction, setInstruction] = useState('')
  const [proposal, setProposal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const propose = async () => {
    setBusy(true)
    setError(null)
    try {
      const { data } = await apiClient.post(
        `/curated/as-degrees/${encodeURIComponent(recordId)}/assist`,
        { instruction },
      )
      setProposal(data)
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not produce a change.')
    }
    setBusy(false)
  }

  const apply = async () => {
    setBusy(true)
    setError(null)
    try {
      await save.mutateAsync(proposal.proposed_doc)
      setProposal(null)
      setInstruction('')
      onApplied?.()
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save the change.')
    }
    setBusy(false)
  }

  return (
    <div className='surface-card p-4'>
      <p className='text-body-strong'>Tell the assistant what to change</p>
      <p className='text-caption text-ink-subtle mt-0.5 mb-3'>
        Describe the correction in your own words and it rewrites this degree record.
        It can see the college&apos;s course list but not the catalog page, so tell it
        what the catalog actually says. You review the change before it is saved.
      </p>

      <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3}
        placeholder='e.g. remove PHYS 163 from the program requirements, it is not in the catalog · MATH 115 is missing from the electives · this group should be pick 2 of 4, not all four' />

      {error && <Alert type='error' className='mt-2'>{error}</Alert>}

      {proposal ? (
        <div className='mt-3'>
          <p className='field-label mb-1.5'>Proposed change</p>
          <ul className='flex flex-col gap-1 mb-3'>
            {(proposal.changes || []).map((change, index) => (
              <li key={index} className='text-caption'>
                <span className='text-ink-subtle'>{change.group_id}</span> — {change.summary}
              </li>
            ))}
          </ul>
          <div className='flex gap-2'>
            <Button onClick={apply} disabled={busy}>
              {busy ? 'Saving…' : 'Apply change'}
            </Button>
            <Button variant='ghost' onClick={() => setProposal(null)} disabled={busy}>
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <Button className='mt-2' variant='secondary'
          disabled={!instruction.trim() || busy} onClick={propose}>
          {busy ? 'Thinking…' : 'Propose a change'}
        </Button>
      )}
    </div>
  )
}

/** One group's courses, as removable rows plus a picker. */
function QuickFixGroup({ group, coursesById, courseOptions, onChange }) {
  const ids = groupCourseIds(group)
  return (
    <div>
      <p className='text-caption text-ink-muted mb-1.5'>{groupLabel(group)}</p>
      <div className='flex flex-col gap-1'>
        {ids.map((id) => (
          <div key={id} className='flex items-center gap-2'>
            <span className='text-body flex-1 min-w-0 truncate'>
              {courseLabel(coursesById[courseByIdKey(id)]) || `Course ${id}`}
            </span>
            <button type='button' aria-label={`Remove course ${id}`}
              onClick={() => onChange(ids.filter((x) => x !== id))}
              className='shrink-0 rounded-pill p-1 text-ink-subtle hover:bg-primary-soft hover:text-ink'>
              <XMarkIcon className='w-4 h-4' aria-hidden='true' />
            </button>
          </div>
        ))}
      </div>
      <Combobox value='' options={courseOptions} placeholder='Add a course…'
        className='mt-1.5'
        onChange={(value) => value && onChange([...ids, Number(value)])} />
    </div>
  )
}
