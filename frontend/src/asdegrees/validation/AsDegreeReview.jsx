import React, { useEffect, useState } from 'react'
import {
  Alert, Button, EmptyState, Spinner, Stack, Textarea,
} from '../../components/ui'
import { useAsDegreeDetail, useCcCourses, useSaveAsDegree } from '../../shared/query/hooks/useData'
import { DegreePanel } from '../AsDegreeSchoolView'
import AsDegreeJsonPanel from './AsDegreeJsonPanel'
import { courseLabel, isComplexGroup, setGroupCourses } from './asDegreeCourses'

/**
 * Read one college's AI-scraped AS degrees against the catalog, and correct
 * them in place.
 *
 * The degree renders exactly as it does everywhere else — the shared ledger, in
 * catalog order — with an Edit button on each group the researcher can fix by
 * clicking. Anything a flat course list cannot state is edited as the stored
 * document itself, by hand or with help from whichever AI they prefer.
 */
export default function AsDegreeReview({ collegeId, degreeType = null }) {
  const detail = useAsDegreeDetail(collegeId != null ? `cc:${collegeId}` : null)
  const courses = useCcCourses(collegeId)
  const save = useSaveAsDegree()

  const records = detail.data?.degrees || []
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)

  // Which degree to show is the caller's choice — the section owns the type
  // tabs so the page header and the record below it can never disagree.
  const active = records.find((r) => r.degree_type === degreeType) || records[0] || null
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
  // choice rule, a GE pattern, or an electives-to-total total is edited in the
  // document below rather than shown half-editable here.
  const isEditable = (group) => !!group?.group_id && !group.ge_area && !group.units_fill
    && !isComplexGroup(group)

  const editGroup = (groupId, courseIds) => setDraft({
    ...doc,
    requirement_groups: doc.requirement_groups.map((g) => (
      g.group_id === groupId ? setGroupCourses(g, courseIds) : g
    )),
  })

  // verified === null saves edits without touching the verdict.
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
        ? 'Changes saved.'
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
        <span className={`ml-auto text-caption ${verified ? 'text-primary' : 'text-ink-subtle'}`}>
          {verified ? 'Verified' : 'Not yet verified'}
        </span>
      </div>

      <DegreePanel degree={{ ...active, doc }} showDegreeTitle={false}
        editing={{ isEditable, courseOptions, onChange: editGroup }} />

      <AsDegreeJsonPanel doc={doc} courses={courses.data?.rows || []}
        onChange={(next) => setDraft(next)} />

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
            Save changes
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
