import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Spinner, Stack, Textarea,
} from '../../components/ui'
import { useAsDegreeDetail, useCcCourses, useSaveAsDegree } from '../../shared/query/hooks/useData'
import { DegreePanel } from '../AsDegreeSchoolView'
import AsDegreeHeaderFields from './AsDegreeHeaderFields'
import { buildScaffold, saveBlockers } from './asDegreeScaffold'
import AsDegreeJsonPanel from './AsDegreeJsonPanel'
import { courseLabel, isComplexGroup, setGroupCourses } from './asDegreeCourses'

/**
 * Read one college's AI-scraped AS degrees against the catalog, and correct
 * them in place — or, for a slot with no record yet, create one.
 *
 * The degree renders exactly as it does everywhere else — the shared ledger, in
 * catalog order — with an Edit button on each group the researcher can fix by
 * clicking. Anything a flat course list cannot state is edited as the stored
 * document itself, by hand or with help from whichever AI they prefer.
 *
 * An empty slot works the same way against a client-side scaffold: nothing
 * reaches the database until the researcher presses Create record.
 */
export default function AsDegreeReview({ collegeId, major = 'cs', slot }) {
  const detail = useAsDegreeDetail(collegeId != null ? `cc:${collegeId}` : null, major)
  const courses = useCcCourses(collegeId)
  const save = useSaveAsDegree()

  const records = detail.data?.degrees || []
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)

  // Which degree to show is the caller's choice — the section owns the type
  // tabs so the page header and the record below it can never disagree.
  const active = records.find((r) => r.degree_type === slot) || null
  const stored = active?.doc || null
  const creating = !stored

  const scaffold = useMemo(
    () => buildScaffold({ collegeId, major, slot }),
    [collegeId, major, slot],
  )
  const doc = draft && draft.legacy_id === (stored?.legacy_id ?? scaffold.legacy_id)
    ? draft
    : (stored || scaffold)
  const blockers = saveBlockers(doc)

  // Reset whenever the record identity changes underneath us — including a
  // switch between two still-empty slots, where `stored` stays null on both
  // sides of the change and would otherwise leave the old draft in place.
  useEffect(() => {
    setNote(stored?.verification?.note || '')
    setDraft(null)
    setSaved(null)
  }, [stored?._id, slot, major])

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
        ? (creating ? 'Record created.' : 'Changes saved.')
        : verified ? 'Marked verified.' : 'Flagged as needing work.')
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save this record.')
    }
  }

  if (detail.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (detail.isError && detail.error?.response?.status !== 404) {
    return <Alert type='error'>Could not load this college&apos;s records.</Alert>
  }

  const verified = !!doc.verification?.verified

  return (
    <Stack gap='comfortable'>
      <div className='flex flex-wrap items-center gap-3'>
        <span className={`ml-auto text-caption ${verified ? 'text-primary' : 'text-ink-subtle'}`}>
          {verified ? 'Verified' : 'Not yet verified'}
        </span>
      </div>

      {creating && (
        <>
          <Alert type='info'>
            This slot is empty. Fill in the catalog details, then paste a requirement
            structure below — nothing is saved until you press Create record.
          </Alert>
          <AsDegreeHeaderFields doc={doc} onChange={setDraft} />
        </>
      )}

      <DegreePanel degree={{ ...active, doc }} showDegreeTitle={false}
        editing={{ isEditable, courseOptions, onChange: editGroup }} />

      <AsDegreeJsonPanel doc={doc} courses={courses.data?.rows || []}
        mode={creating ? 'create' : 'edit'}
        collegeName={detail.data?.college_name || null}
        onChange={(next) => setDraft(next)} />

      <div>
        <span className='field-label'>Verification note</span>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder='What you checked, or what is still wrong. Saved with your verdict.' />
      </div>

      {error && <Alert type='error'>{error}</Alert>}
      {saved && <Alert type='success'>{saved}</Alert>}

      <div className='flex flex-wrap items-center gap-2'>
        {(draft || creating) && (
          <Button onClick={() => persist(null)}
            disabled={save.isPending || blockers.length > 0}>
            {creating ? 'Create record' : 'Save changes'}
          </Button>
        )}
        {!creating && (
          <>
            <Button onClick={() => persist(true)}
              disabled={save.isPending || blockers.length > 0}>
              {save.isPending ? 'Saving…' : 'Mark verified'}
            </Button>
            <Button variant='secondary' onClick={() => persist(false)}
              disabled={save.isPending || blockers.length > 0}>
              Needs work
            </Button>
          </>
        )}
        {blockers.length > 0 && (
          <span className='text-caption text-ink-subtle'>
            Still needs {blockers.join(', ')}.
          </span>
        )}
      </div>
    </Stack>
  )
}
