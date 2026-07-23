import React, { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import {
  Alert,
  Badge,
  Button,
  Combobox,
  EmptyState,
  FullScreenPanel,
  Input,
  Panel,
  Select,
  Spinner,
  Stack,
  SwitchField,
  Textarea,
} from '../../components/ui'
import { useAuth } from '../../shared/hooks/useAuth'
import {
  useAsDegreeDetail,
  useCcCourses,
  useSaveAsDegree,
} from '../../shared/query/hooks/useData'
import AiAssistPanel from './AiAssistPanel'
import {
  AS_DEGREE_STATUSES,
  GE_AREAS,
  UNIT_SYSTEMS,
  addGroup,
  addOption,
  addReceiver,
  addSection,
  markGroupReviewed,
  moveGroup,
  moveSection,
  normalizeGroupIdDraft,
  removeGroup,
  removeOption,
  removeReceiver,
  removeSection,
  setDocField,
  setGroupIdDraft,
  setOptionCourses,
  setUnresolvedCourses,
  setVerification,
  setVerificationNotes,
  toEditableDoc,
  updateGroup,
  updateReceiver,
  updateSection,
  validateLocal,
} from './editorState'

const DEGREE_LABELS = {
  ast: 'CS A.S.-T',
  local_cs_as: 'Local CS A.S.',
  local_computing: 'Other computing degree',
}

const GE_OPTIONS = [
  { value: '', label: 'Not a GE group' },
  ...GE_AREAS.map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]

const STATUS_OPTIONS = AS_DEGREE_STATUSES.map((value) => ({
  value,
  label: value === 'none_found' ? 'None found' : value[0].toUpperCase() + value.slice(1),
}))

const UNIT_OPTIONS = UNIT_SYSTEMS.map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}))

function versionOf(doc) {
  if (doc?.updated_at instanceof Date) return doc.updated_at.toISOString()
  return String(doc?.updated_at || '')
}

function serverError(error) {
  return error?.response?.data?.error || error?.message || 'Could not save this degree record.'
}

function numberOrNull(value) {
  if (value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function unresolvedEntries(existing, rawValue) {
  const byCode = new Map((existing || []).map((entry) => [
    String(entry?.course_code_seen || '').trim(),
    entry,
  ]))
  return String(rawValue || '')
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((courseCode) => ({
      ...(byCode.get(courseCode) || {}),
      course_code_seen: courseCode,
    }))
}

function invalidateVerification(doc) {
  if (doc?.verification?.verified !== true) return doc
  return {
    ...doc,
    verification: {
      ...doc.verification,
      verified: false,
      verified_by: null,
      verified_at: null,
    },
  }
}

function courseLabel(course) {
  const code = [course.prefix, course.number].filter(Boolean).join(' ').trim()
  return [code || `Course ${course.course_id}`, course.title, course.units != null ? `${course.units} units` : null]
    .filter(Boolean).join(' · ')
}

function CourseOptionEditor({
  groupId,
  sectionIndex,
  receiverIndex,
  optionIndex,
  option,
  courses,
  onApply,
  onRemove,
}) {
  const [pendingCourse, setPendingCourse] = useState('')
  const ids = option.course_ids || []
  const coursesById = useMemo(
    () => new Map(courses.map((course) => [Number(course.course_id), course])),
    [courses],
  )
  const available = courses
    .filter((course) => !ids.includes(Number(course.course_id)))
    .map((course) => ({ value: Number(course.course_id), label: courseLabel(course) }))

  const addCourse = (courseId) => {
    const id = Number(courseId)
    if (Number.isInteger(id)) onApply((doc) => setOptionCourses(
      doc, groupId, sectionIndex, receiverIndex, optionIndex, [...ids, id],
    ))
    setPendingCourse('')
  }

  return (
    <div className='rounded-lg border border-border bg-surface p-3'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-label'>Course set {optionIndex + 1}</p>
        <Button variant='ghost' size='sm' leadingIcon={TrashIcon} onClick={onRemove}>
          Remove set
        </Button>
      </div>
      <div className='mt-2 flex flex-wrap gap-2'>
        {ids.map((id) => {
          const course = coursesById.get(Number(id))
          return (
            <span key={id} className='inline-flex items-center gap-1.5 rounded-pill bg-primary-soft px-3 py-1 text-tag text-primary'>
              {course ? courseLabel(course) : `Course ${id}`}
              <button
                type='button'
                className='font-bold hover:text-danger'
                aria-label={`Remove course ${id}`}
                onClick={() => onApply((doc) => setOptionCourses(
                  doc, groupId, sectionIndex, receiverIndex, optionIndex, ids.filter((value) => value !== id),
                ))}
              >
                ×
              </button>
            </span>
          )
        })}
        {!ids.length && <span className='text-caption text-danger'>Choose at least one course.</span>}
      </div>
      <label className='mt-3 block'>
        <span className='field-label'>Add catalog course</span>
        <Combobox
          value={pendingCourse}
          onChange={addCourse}
          options={available}
          placeholder={available.length ? 'Add a catalog course' : 'No more catalog courses'}
        />
      </label>
    </div>
  )
}

function ReceiverEditor({ groupId, sectionIndex, receiverIndex, receiver, courses, onApply }) {
  const options = receiver.options || []
  return (
    <div className='rounded-xl bg-surface-sunken p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <p className='text-body-strong'>Choice {receiverIndex + 1}</p>
          <Badge>{receiver.options_conjunction === 'or' ? 'Either option' : 'All sets'}</Badge>
        </div>
        <div className='flex items-center gap-2'>
          <Select
            aria-label={`Course-set requirement for choice ${receiverIndex + 1}`}
            value={receiver.options_conjunction || 'and'}
            onChange={(value) => onApply((doc) => updateReceiver(
              doc, groupId, sectionIndex, receiverIndex, { options_conjunction: value },
            ))}
            options={[{ value: 'and', label: 'All sets' }, { value: 'or', label: 'Either set' }]}
          />
          <Button
            variant='ghost'
            size='sm'
            leadingIcon={TrashIcon}
            onClick={() => onApply((doc) => removeReceiver(doc, groupId, sectionIndex, receiverIndex))}
          >
            Remove choice
          </Button>
        </div>
      </div>
      <div className='mt-3 grid gap-3'>
        {options.map((option, optionIndex) => (
          <CourseOptionEditor
            key={optionIndex}
            groupId={groupId}
            sectionIndex={sectionIndex}
            receiverIndex={receiverIndex}
            optionIndex={optionIndex}
            option={option}
            courses={courses}
            onApply={onApply}
            onRemove={() => onApply((doc) => removeOption(
              doc, groupId, sectionIndex, receiverIndex, optionIndex,
            ))}
          />
        ))}
        {!options.length && (
          <Alert type='error'>This course choice needs at least one course set.</Alert>
        )}
      </div>
      <Button
        className='mt-3'
        variant='secondary'
        size='sm'
        leadingIcon={PlusIcon}
        onClick={() => onApply((doc) => addOption(doc, groupId, sectionIndex, receiverIndex))}
      >
        Add alternative course set
      </Button>
    </div>
  )
}

function SectionEditor({ group, section, sectionIndex, courses, onApply }) {
  const groupId = group.group_id
  return (
    <div className='rounded-xl border border-border bg-surface p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <h4 className='text-body-strong'>Section {sectionIndex + 1}</h4>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='sm'
            leadingIcon={ArrowUpIcon}
            disabled={sectionIndex === 0}
            onClick={() => onApply((doc) => moveSection(doc, groupId, sectionIndex, 'up'))}
          >Up</Button>
          <Button
            variant='ghost'
            size='sm'
            leadingIcon={ArrowDownIcon}
            disabled={sectionIndex === group.sections.length - 1}
            onClick={() => onApply((doc) => moveSection(doc, groupId, sectionIndex, 'down'))}
          >Down</Button>
          <Button
            variant='ghost'
            size='sm'
            leadingIcon={TrashIcon}
            onClick={() => onApply((doc) => removeSection(doc, groupId, sectionIndex))}
          >Remove</Button>
        </div>
      </div>
      <div className='mt-3 grid gap-3 sm:grid-cols-2'>
        <Input
          label='Choose this many choices'
          type='number'
          min='1'
          value={section.section_advisement ?? ''}
          onChange={(event) => onApply((doc) => updateSection(doc, groupId, sectionIndex, {
            section_advisement: numberOrNull(event.target.value),
          }))}
        />
        <Input
          label='Or require this many units'
          type='number'
          min='0.1'
          step='0.1'
          value={section.unit_advisement ?? ''}
          onChange={(event) => onApply((doc) => updateSection(doc, groupId, sectionIndex, {
            unit_advisement: numberOrNull(event.target.value),
          }))}
        />
      </div>
      <div className='mt-4 grid gap-3'>
        {(section.receivers || []).map((receiver, receiverIndex) => (
          <ReceiverEditor
            key={receiverIndex}
            groupId={groupId}
            sectionIndex={sectionIndex}
            receiverIndex={receiverIndex}
            receiver={receiver}
            courses={courses}
            onApply={onApply}
          />
        ))}
      </div>
      <Button
        className='mt-3'
        variant='secondary'
        size='sm'
        leadingIcon={PlusIcon}
        onClick={() => onApply((doc) => addReceiver(doc, groupId, sectionIndex))}
      >
        Add course choice
      </Button>
    </div>
  )
}

function GroupEditor({ group, index, total, courses, userId, onApply }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState(false)
  const templateStub = group.source === 'template_default'
  const reviewed = group.source === 'curated' || group.reviewed === true || group.reviewed_by || group.reviewed_at
  const groupId = group.group_id
  useEffect(() => setConfirmRemove(false), [groupId])
  const review = () => {
    const stamp = { by: userId ?? null, at: new Date().toISOString() }
    if (templateStub) {
      onApply((doc) => ({
        ...doc,
        requirement_groups: (doc.requirement_groups || []).map((candidate) => (
          candidate.group_id === groupId
            ? { ...candidate, reviewed: true, reviewed_by: stamp.by, reviewed_at: stamp.at }
            : candidate
        )),
      }))
    } else {
      // Leave curator fields empty so the canonical PUT stamps the current
      // authenticated saver with a server Date.
      onApply((doc) => markGroupReviewed(doc, groupId))
    }
  }
  const customizeTemplate = () => onApply((doc) => updateGroup(doc, groupId, {
    template_group: null,
    sections: [{ section_advisement: null, unit_advisement: null, receivers: [] }],
  }))

  return (
    <Panel
      title={group.label_seen || groupId}
      icon={reviewed ? CheckCircleIcon : undefined}
      iconTone={reviewed ? 'success' : 'brand'}
      overflowVisible
      action={(
        <div className='flex flex-wrap items-center gap-1'>
          <Badge variant={reviewed ? 'success' : templateStub ? 'conservative' : 'neutral'}>
            {reviewed ? 'Reviewed' : templateStub ? 'Template default' : group.source || 'Unknown source'}
          </Badge>
          <Button variant='ghost' size='sm' leadingIcon={ArrowUpIcon} disabled={index === 0}
            onClick={() => onApply((doc) => moveGroup(doc, groupId, 'up'))}>Up</Button>
          <Button variant='ghost' size='sm' leadingIcon={ArrowDownIcon} disabled={index === total - 1}
            onClick={() => onApply((doc) => moveGroup(doc, groupId, 'down'))}>Down</Button>
        </div>
      )}
    >
      {templateStub ? (
        <Alert>
          This group currently inherits the statewide template. Mark it reviewed as-is, or customize
          it to enter this college’s exact courses.
        </Alert>
      ) : (
        <div className='grid gap-3 sm:grid-cols-2'>
          <Input
            label={`Group label ${groupId}`}
            value={group.label_seen || ''}
            onChange={(event) => onApply((doc) => updateGroup(doc, groupId, { label_seen: event.target.value }))}
          />
          <Input
            label={`Group ID ${groupId}`}
            value={groupId}
            onChange={(event) => {
              setEditingGroupId(true)
              onApply((doc) => setGroupIdDraft(doc, index, event.target.value))
            }}
            onBlur={() => {
              if (!editingGroupId) return
              setEditingGroupId(false)
              onApply((doc) => normalizeGroupIdDraft(doc, index))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            hint='Lowercase letters, numbers, and underscores.'
          />
          <div>
            <span className='field-label'>GE area</span>
            <Select
              aria-label={`GE area for ${groupId}`}
              value={group.ge_area || ''}
              onChange={(value) => onApply((doc) => updateGroup(doc, groupId, { ge_area: value || null }))}
              options={GE_OPTIONS}
            />
          </div>
          <SwitchField
            className='self-end pb-2'
            label='Units-fill group'
            checked={group.units_fill === true}
            onChange={() => {
              if (
                group.units_fill !== true
                && group.sections?.length
                && !window.confirm('Making this a units-fill group removes all of its sections and courses. Continue?')
              ) return
              onApply((doc) => updateGroup(doc, groupId, {
                units_fill: group.units_fill !== true,
              }))
            }}
          />
        </div>
      )}

      <div className='mt-4 flex flex-wrap gap-2'>
        <Button variant={reviewed ? 'secondary' : 'primary'} leadingIcon={CheckCircleIcon} onClick={review}>
          {reviewed ? 'Review again' : 'Mark group reviewed'}
        </Button>
        {templateStub && (
          <Button variant='secondary' onClick={customizeTemplate}>Use college-specific requirements</Button>
        )}
        {!confirmRemove ? (
          <Button variant='ghost' leadingIcon={TrashIcon} onClick={() => setConfirmRemove(true)}>
            Remove group
          </Button>
        ) : (
          <>
            <Button variant='danger' onClick={() => onApply((doc) => removeGroup(doc, groupId))}>
              Confirm removal
            </Button>
            <Button variant='ghost' onClick={() => setConfirmRemove(false)}>Keep group</Button>
          </>
        )}
      </div>

      {!templateStub && !group.units_fill && (
        <div className='mt-5 grid gap-4'>
          {(group.sections || []).map((section, sectionIndex) => (
            <SectionEditor
              key={sectionIndex}
              group={group}
              section={section}
              sectionIndex={sectionIndex}
              courses={courses}
              onApply={onApply}
            />
          ))}
          <Button variant='secondary' leadingIcon={PlusIcon}
            onClick={() => onApply((doc) => addSection(doc, groupId))}>
            Add section
          </Button>
        </div>
      )}

      {!templateStub && (
        <Textarea
          className='mt-4'
          label='Unresolved catalog course codes'
          hint='One course code per line. Keep codes here until they can be matched to the catalog.'
          value={(group.unresolved_courses_seen || []).map((entry) => entry.course_code_seen).join('\n')}
          onChange={(event) => onApply((doc) => setUnresolvedCourses(
            doc,
            groupId,
            unresolvedEntries(group.unresolved_courses_seen, event.target.value),
          ))}
        />
      )}
    </Panel>
  )
}

export default function AsDegreeEditor({ collegeId, initialDegreeType = null, onClose = () => {} }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const detail = useAsDegreeDetail(collegeId != null ? `cc:${collegeId}` : null)
  const coursesQuery = useCcCourses(collegeId)
  const save = useSaveAsDegree()
  const [recordId, setRecordId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [baseVersion, setBaseVersion] = useState('')
  const [dirty, setDirty] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [newGroupId, setNewGroupId] = useState('')

  const degrees = detail.data?.degrees || []
  const requested = degrees.find((entry) => entry.degree_type === initialDegreeType)
  const selectedEntry = degrees.find((entry) => entry.doc?._id === recordId)
    || requested
    || degrees[0]
    || null
  const serverDoc = selectedEntry?.doc || null

  useEffect(() => {
    setRecordId(null)
    setDraft(null)
    setBaseVersion('')
    setDirty(false)
    setStale(false)
  }, [collegeId])

  useEffect(() => {
    if (!dirty) return undefined
    const warnBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!serverDoc) return
    const incomingVersion = versionOf(serverDoc)
    if (!draft || draft._id !== serverDoc._id) {
      setRecordId(serverDoc._id)
      setDraft(toEditableDoc(serverDoc))
      setBaseVersion(incomingVersion)
      setDirty(false)
      setStale(false)
      setError('')
      return
    }
    if (incomingVersion !== baseVersion) {
      if (dirty) {
        setStale(true)
      } else {
        setDraft(toEditableDoc(serverDoc))
        setBaseVersion(incomingVersion)
        setStale(false)
      }
    }
  }, [baseVersion, dirty, draft, serverDoc])

  const validationErrors = useMemo(() => draft ? validateLocal(draft) : [], [draft])
  const degreeOptions = degrees.map((entry) => ({
    value: entry.doc?._id,
    label: DEGREE_LABELS[entry.degree_type] || entry.degree_type || entry.doc?.degree_title_seen,
  })).filter((option) => option.value)

  const apply = (transition, { preserveVerification = false } = {}) => {
    setDraft((current) => {
      const next = transition(current)
      return preserveVerification ? next : invalidateVerification(next)
    })
    setDirty(true)
    setError('')
  }

  const reloadLatest = () => {
    if (!serverDoc) return
    setDraft(toEditableDoc(serverDoc))
    setBaseVersion(versionOf(serverDoc))
    setDirty(false)
    setStale(false)
    setError('')
  }

  const commit = async (nextDoc = draft) => {
    const localErrors = validateLocal(nextDoc)
    if (localErrors.length) {
      const nextError = new Error(localErrors[0])
      setError(nextError.message)
      throw nextError
    }
    setError('')
    try {
      const refreshed = await detail.refetch?.()
      if (!refreshed || refreshed.isError || !refreshed.data) {
        const refreshError = new Error(
          'Could not confirm the latest server version. Check your connection and try saving again.',
        )
        setError(refreshError.message)
        throw refreshError
      }
      const latest = refreshed?.data?.degrees
        ?.find((entry) => entry.doc?._id === nextDoc._id)?.doc
      if (!latest) {
        const missingError = new Error(
          'This degree record no longer exists on the server. Close the editor and reload before continuing.',
        )
        setStale(true)
        setError(missingError.message)
        throw missingError
      }
      if (latest && versionOf(latest) !== baseVersion) {
        const staleError = new Error(
          'A newer version of this record is available. Reload it before saving to avoid overwriting your partner’s work.',
        )
        setStale(true)
        setError(staleError.message)
        throw staleError
      }
      await save.mutateAsync(nextDoc)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['as-degree-validation-cohort'] }),
        // Coverage, transfer-credit, and planning views all consume canonical
        // degree structure. Refresh every analysis family after an approved edit.
        queryClient.invalidateQueries({
          predicate: (query) => String(query.queryKey[0] || '').startsWith('analysis-'),
        }),
      ])
      setDraft(toEditableDoc(nextDoc))
      setDirty(false)
      setStale(false)
      return nextDoc
    } catch (nextError) {
      setError(serverError(nextError))
      throw nextError
    }
  }

  const addNewGroup = () => {
    const requestedId = newGroupId.trim() || 'new_requirement'
    apply((doc) => addGroup(doc, requestedId))
    setNewGroupId('')
  }

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your unsaved AS-degree changes?')) return
    onClose()
  }

  const changeStatus = (value) => {
    if (
      draft?.status === 'found'
      && value !== 'found'
      && draft.requirement_groups?.length
      && !window.confirm('Changing this status removes all structured requirement groups. Continue?')
    ) return
    apply((doc) => setDocField(doc, 'status', value))
  }

  const panelActions = draft ? (
    <Button
      leadingIcon={CheckCircleIcon}
      loading={save.isPending}
      disabled={!dirty || validationErrors.length > 0}
      onClick={() => commit().catch(() => {})}
    >
      Save changes
    </Button>
  ) : null

  return (
    <FullScreenPanel
      open={collegeId != null}
      onClose={requestClose}
      title={detail.data?.college_name || 'AS-degree editor'}
      subtitle='Validated degree data used directly by pathway analyses and visualizations'
      actions={panelActions}
    >
      {detail.isLoading && <div className='flex justify-center py-16'><Spinner /></div>}
      {detail.isError && detail.error?.response?.status !== 404 && (
        <Alert type='error'>{serverError(detail.error || new Error('Could not load this college.'))}</Alert>
      )}
      {!detail.isLoading
        && (detail.error?.response?.status === 404 || (!detail.isError && !degrees.length)) && (
        <EmptyState
          card
          title='No AS-degree records for this college'
          description='Create or import a canonical AS-degree record before opening the validation editor.'
        />
      )}
      {draft && (
        <Stack gap='section'>
          {stale && (
            <Alert>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <span>A newer version of this record is available. Your unsaved work is still shown.</span>
                <Button variant='secondary' size='sm' onClick={reloadLatest}>Reload latest</Button>
              </div>
            </Alert>
          )}
          {error && <Alert type='error'>{error}</Alert>}

          <div className='grid items-start gap-6 lg:grid-cols-[310px_minmax(0,1fr)]'>
            <Stack gap='comfortable'>
              <Panel title='Degree record' overflowVisible>
                <Stack gap='comfortable'>
                  <div>
                    <span className='field-label'>Degree type</span>
                    <Select
                      aria-label='Degree type'
                      value={draft._id}
                      onChange={(value) => setRecordId(value)}
                      options={degreeOptions}
                      disabled={dirty}
                    />
                    {dirty && (
                      <p className='mt-2 text-caption text-ink-subtle'>
                        Save or reload this record before switching degree types.
                      </p>
                    )}
                  </div>
                  <div>
                    <span className='field-label'>Status</span>
                    <Select
                      aria-label='Status'
                      value={draft.status}
                      onChange={changeStatus}
                      options={STATUS_OPTIONS}
                    />
                  </div>
                  {draft.status === 'found' && (
                    <>
                      <Input label='Degree title' value={draft.degree_title_seen || ''}
                        onChange={(event) => apply((doc) => setDocField(doc, 'degree_title_seen', event.target.value))} />
                      <Input label='Catalog URL' type='url' value={draft.catalog_url || ''}
                        onChange={(event) => apply((doc) => setDocField(doc, 'catalog_url', event.target.value))} />
                      <Input label='Catalog year' value={draft.catalog_year || ''}
                        onChange={(event) => apply((doc) => setDocField(doc, 'catalog_year', event.target.value))} />
                      <div>
                        <span className='field-label'>Unit system</span>
                        <Select aria-label='Unit system' value={draft.unit_system} options={UNIT_OPTIONS}
                          onChange={(value) => apply((doc) => setDocField(doc, 'unit_system', value))} />
                      </div>
                      <Input label='Total degree units' type='number' min='0.1' step='0.1'
                        value={draft.total_units ?? ''}
                        onChange={(event) => apply((doc) => setDocField(
                          doc, 'total_units', numberOrNull(event.target.value),
                        ))} />
                    </>
                  )}
                </Stack>
              </Panel>

              <Panel title='Verification' icon={CheckCircleIcon} iconTone='success'>
                <Stack gap='comfortable'>
                  <p className='text-caption text-ink-subtle'>
                    Any structural edit clears an existing verification stamp until the corrected record is reviewed again.
                  </p>
                  <SwitchField
                    label='Verified'
                    checked={draft.verification?.verified === true}
                    onChange={() => apply(
                      (doc) => setVerification(doc, !draft.verification?.verified, {
                        by: user?.uid ?? null,
                        at: new Date().toISOString(),
                      }),
                      { preserveVerification: true },
                    )}
                  />
                  <Textarea
                    label='Verification notes'
                    hint='These notes are always written by the reviewer; AI assist never edits them.'
                    value={draft.verification?.notes || ''}
                    onChange={(event) => apply(
                      (doc) => setVerificationNotes(doc, event.target.value),
                      { preserveVerification: true },
                    )}
                  />
                  {draft.verification?.verified_by && (
                    <p className='text-tag text-ink-subtle'>Verified by {draft.verification.verified_by}</p>
                  )}
                </Stack>
              </Panel>
            </Stack>

            <Stack gap='section'>
              {draft.status === 'found' ? (
                <>
                  <div className='flex flex-wrap items-end justify-between gap-3'>
                    <div>
                      <p className='text-eyebrow text-primary'>Structured requirements</p>
                      <h2 className='mt-1 text-title'>{draft.requirement_groups?.length || 0} groups</h2>
                    </div>
                    <div className='flex items-end gap-2'>
                      <Input label='New group ID' value={newGroupId} placeholder='e.g. core_programming'
                        onChange={(event) => setNewGroupId(event.target.value)} />
                      <Button leadingIcon={PlusIcon} onClick={addNewGroup}>Add group</Button>
                    </div>
                  </div>

                  {(draft.requirement_groups || []).map((group, index) => (
                    <GroupEditor
                      key={`${draft._id}:group:${index}`}
                      group={group}
                      index={index}
                      total={draft.requirement_groups.length}
                      courses={coursesQuery.data || []}
                      userId={user?.uid}
                      onApply={apply}
                    />
                  ))}

                  {coursesQuery.isLoading && <Alert>Loading this college’s course catalog…</Alert>}
                  {coursesQuery.isError && (
                    <Alert type='error'>
                      {serverError(coursesQuery.error || new Error('Could not load this college’s course catalog.'))}
                    </Alert>
                  )}

                  <Panel title='Save readiness'>
                    {validationErrors.length ? (
                      <div>
                        <p className='text-body-strong text-danger'>Fix these issues before saving:</p>
                        <ul className='mt-2 list-disc space-y-1 pl-5 text-caption text-ink-muted'>
                          {validationErrors.map((message, index) => <li key={`${message}:${index}`}>{message}</li>)}
                        </ul>
                      </div>
                    ) : (
                      <div className='flex items-center gap-2 text-body text-success'>
                        <CheckCircleIcon className='h-5 w-5' />
                        This document passes the local canonical checks.
                      </div>
                    )}
                  </Panel>

                  <AiAssistPanel
                    doc={draft}
                    disabled={save.isPending || dirty}
                    disabledReason={dirty
                      ? 'Save or reload your manual changes before asking AI for a proposal.'
                      : ''}
                    onApprove={commit}
                  />
                </>
              ) : (
                <Panel title='No structured groups for this status'>
                  <p className='text-body text-ink-muted'>
                    Canonical records marked {draft.status.replaceAll('_', ' ')} cannot carry requirement groups.
                    Save this status after checking the catalog evidence.
                  </p>
                </Panel>
              )}
            </Stack>
          </div>
        </Stack>
      )}
    </FullScreenPanel>
  )
}

export { unresolvedEntries as _unresolvedEntries }
