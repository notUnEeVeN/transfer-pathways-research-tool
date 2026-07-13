import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  FullScreenPanel,
  IconButton,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Textarea,
} from '../components/ui'
import { useSaveDegreeRequirement, useUniversityCourses } from '@frontend/query/hooks/useData'
import {
  cloneDegreeDocument,
  createDegreeDocument,
  createDegreeGroup,
  createSectionDraft,
  DEGREE_TIERS,
  degreeSectionType,
  moveItem,
  SECTION_TYPES,
  sectionFromDraft,
  sectionToDraft,
  setDegreeGroupTier,
  validateDegreeDocument,
} from './degreeTemplateModel'

const TYPE_LABELS = Object.fromEntries(SECTION_TYPES.map((type) => [type.value, type.label]))

const courseCode = (course) => course
  ? `${course.prefix || ''} ${course.number || ''}`.trim()
  : ''

function CoursePicker({ courses, loading, value, onChange }) {
  const [query, setQuery] = useState('')
  const selectedIds = value || []
  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds])
  const coursesById = useMemo(
    () => new Map(courses.map((course) => [String(course.parent_id), course])),
    [courses]
  )
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) {
      return selectedIds.map((id) => coursesById.get(String(id)) || {
        parent_id: id, prefix: `#${id}`, number: '', title: 'Catalog course unavailable',
      })
    }
    return courses
      .filter((course) => `${courseCode(course)} ${course.title || ''} ${course.department || ''}`.toLowerCase().includes(search))
      .slice(0, 60)
  }, [courses, coursesById, query, selectedIds])

  const toggle = (id) => {
    const key = String(id)
    onChange(selectedSet.has(key)
      ? selectedIds.filter((current) => String(current) !== key)
      : [...selectedIds, id])
  }

  return (
    <Stack gap='tight'>
      <div className='flex flex-wrap items-center gap-3'>
        <Input className='w-full sm:w-80' value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder='Search UC course code or title...'
          leadingIcon={MagnifyingGlassIcon} />
        <span className='text-caption text-ink-subtle'>{selectedIds.length} selected</span>
      </div>
      {loading ? (
        <div className='flex justify-center py-6'><Spinner /></div>
      ) : visible.length ? (
        <div className='border-y border-border divide-y divide-border max-h-72 overflow-auto'>
          {visible.map((course) => {
            const id = course.parent_id
            return (
              <div key={String(id)} className='px-2 py-2 hover:bg-surface-hover'>
                <Checkbox checked={selectedSet.has(String(id))} onChange={() => toggle(id)}
                  className='w-full min-w-0'
                  label={(
                    <span className='min-w-0'>
                      <span className='font-mono text-ink'>{courseCode(course)}</span>
                      {course.title && <span className='ml-2 text-caption text-ink-muted'>{course.title}</span>}
                    </span>
                  )} />
              </div>
            )
          })}
        </div>
      ) : (
        <p className='text-caption text-ink-subtle py-3'>No matching courses.</p>
      )}
    </Stack>
  )
}

function SectionEditorModal({ editing, tier, courses, coursesLoading, onClose, onSave }) {
  const [form, setForm] = useState(createSectionDraft(tier))
  const [error, setError] = useState(null)
  const coursesById = useMemo(
    () => new Map(courses.map((course) => [String(course.parent_id), course])),
    [courses]
  )

  useEffect(() => {
    setForm(editing?.section
      ? sectionToDraft(editing.section, tier)
      : createSectionDraft(tier))
    setError(null)
  }, [editing, tier])

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const commit = () => {
    if (form.type === 'courses' && !form.courseIds.length) {
      setError('Select at least one UC course.')
      return
    }
    if (form.type === 'courses' && Number(form.required) > form.courseIds.length) {
      setError('Courses required cannot exceed the number of selected UC courses.')
      return
    }
    if (form.type === 'ge_area' && !String(form.geAreas || '').trim()) {
      setError('Add at least one IGETC area.')
      return
    }
    if (form.type !== 'courses' && !String(form.description || '').trim()) {
      setError('Add a description for this requirement.')
      return
    }
    onSave(sectionFromDraft(form, {
      original: editing?.section || {},
      tier,
      coursesById,
    }))
  }

  return (
    <Modal open={!!editing} onClose={onClose} size='xl'
      title={editing?.section ? 'Edit degree requirement' : 'Add degree requirement'}
      actions={(
        <>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button leadingIcon={CheckIcon} onClick={commit}>Apply</Button>
        </>
      )}>
      {editing && (
        <Stack gap='cozy'>
          {error && <Alert type='error'>{error}</Alert>}
          <div className='grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem] gap-4'>
            <div>
              <label className='field-label block mb-1'>Requirement type</label>
              <Select value={form.type} options={SECTION_TYPES} onChange={(value) => set('type', value)} />
            </div>
            <Input label='Courses required' type='number' min='1' value={form.required}
              onChange={(event) => set('required', event.target.value === '' ? '' : Number(event.target.value))} />
          </div>

          {form.type === 'courses' && (
            <>
              <CoursePicker courses={courses} loading={coursesLoading}
                value={form.courseIds} onChange={(value) => set('courseIds', value)} />
              <Input label='IGETC fallback areas (optional)' value={form.geAreas}
                placeholder='1A, 1B'
                onChange={(event) => set('geAreas', event.target.value)} />
            </>
          )}

          {form.type === 'ge_area' && (
            <>
              <div className='grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)] gap-4'>
                <Input label='Category code' value={form.code} placeholder='H/SS'
                  onChange={(event) => set('code', event.target.value)} />
                <Input label='IGETC areas' value={form.geAreas} placeholder='3A, 3B, 4'
                  onChange={(event) => set('geAreas', event.target.value)} />
              </div>
              <Textarea label='Category description' rows={3} value={form.description}
                onChange={(event) => set('description', event.target.value)} />
            </>
          )}

          {form.type === 'assumed' && (
            <>
              <Input label='Requirement code' value={form.code} placeholder='AH&I'
                onChange={(event) => set('code', event.target.value)} />
              <Textarea label='Requirement description' rows={3} value={form.description}
                onChange={(event) => set('description', event.target.value)} />
            </>
          )}

          {form.type === 'university' && (
            <Textarea label='Requirement description' rows={3} value={form.description}
              onChange={(event) => set('description', event.target.value)} />
          )}
        </Stack>
      )}
    </Modal>
  )
}

function sectionSummary(section, coursesById) {
  const type = degreeSectionType(section)
  const required = Number(section.section_advisement || 1)
  const receivers = section.receivers || []
  if (type === 'courses') {
    const codes = receivers.map((receiver) => {
      const id = receiver.receiving?.parent_id
      const course = coursesById.get(String(id))
      return courseCode(course) || `#${id}`
    })
    const prefix = required < codes.length ? `Select ${required} of ${codes.length}` : `Complete ${required}`
    return `${prefix}: ${codes.join(', ')}`
  }
  const receiving = receivers[0]?.receiving || {}
  if (type === 'ge_area') {
    const areas = section.ge_areas || receivers[0]?.ge_areas || []
    return `${required} from ${receiving.code || 'GE'}${areas.length ? ` (IGETC ${areas.join(', ')})` : ''}`
  }
  if (type === 'assumed') return receiving.name || receiving.code || 'Generally available requirement'
  return `${required} ${required === 1 ? 'requirement' : 'requirements'}: ${receiving.name || 'Complete at the university'}`
}

export default function DegreeTemplateEditor({
  open,
  onClose,
  initialDocument,
  schoolId,
  school,
  campusKey = null,
  onSaved,
}) {
  const save = useSaveDegreeRequirement()
  const coursesQuery = useUniversityCourses(open ? schoolId : null)
  const courses = coursesQuery.data || []
  const coursesById = useMemo(
    () => new Map(courses.map((course) => [String(course.parent_id), course])),
    [courses]
  )
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState(null)
  const [sectionEditor, setSectionEditor] = useState(null)

  useEffect(() => {
    if (!open) return
    const next = cloneDegreeDocument(initialDocument) || createDegreeDocument({ schoolId, school, campusKey })
    next.requirement_groups = Array.isArray(next.requirement_groups) ? next.requirement_groups : []
    setDraft(next)
    setDirty(false)
    setError(null)
    setSectionEditor(null)
  }, [campusKey, initialDocument, open, school, schoolId])

  const change = (updater) => {
    setDraft((current) => typeof updater === 'function' ? updater(current) : updater)
    setDirty(true)
    setError(null)
  }

  const changeGroups = (updater) => change((current) => ({
    ...current,
    requirement_groups: updater(current.requirement_groups || []),
  }))

  const updateGroup = (index, updater) => changeGroups((groups) => groups.map((group, groupIndex) =>
    groupIndex === index ? updater(group) : group))

  const removeGroup = (index) => {
    if (!window.confirm('Delete this requirement group and all of its requirements?')) return
    changeGroups((groups) => groups.filter((_, groupIndex) => groupIndex !== index))
  }

  const removeSection = (groupIndex, sectionIndex) => {
    if (!window.confirm('Delete this degree requirement?')) return
    updateGroup(groupIndex, (group) => ({
      ...group,
      sections: (group.sections || []).filter((_, index) => index !== sectionIndex),
    }))
  }

  const applySection = (section) => {
    const { groupIndex, sectionIndex } = sectionEditor
    updateGroup(groupIndex, (group) => {
      const sections = (group.sections || []).slice()
      if (sectionIndex == null) sections.push(section)
      else sections[sectionIndex] = section
      return { ...group, sections }
    })
    setSectionEditor(null)
  }

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your unsaved degree-template changes?')) return
    onClose()
  }

  const commit = async () => {
    const validation = validateDegreeDocument(draft)
    if (validation) {
      setError(validation)
      return
    }
    const totalUnits = draft.total_units === '' || draft.total_units == null
      ? null
      : Number(draft.total_units)
    const payload = {
      ...draft,
      program: String(draft.program).trim(),
      source_url: String(draft.source_url || '').trim(),
      total_units: Number.isFinite(totalUnits) ? totalUnits : null,
      requirement_groups: draft.requirement_groups.map((group) => ({
        ...group,
        title: String(group.title || '').trim(),
        is_required: true,
      })),
    }
    try {
      await save.mutateAsync(payload)
      setDirty(false)
      onSaved?.(payload)
    } catch (saveError) {
      setError(saveError?.response?.data?.error || 'Could not save the degree template.')
    }
  }

  if (!draft) return null

  return (
    <>
      <FullScreenPanel open={open} onClose={requestClose}
        title={`Edit ${draft.school || school} degree template`}
        subtitle={draft.program || 'New hand-curated template'}
        actions={(
          <Button leadingIcon={CheckIcon} loading={save.isPending} onClick={commit}>
            Save changes
          </Button>
        )}>
        <Stack gap='section'>
          {error && <Alert type='error'>{error}</Alert>}

          <section className='border-b border-border pb-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <Input label='Program name' value={draft.program || ''}
                onChange={(event) => change((current) => ({ ...current, program: event.target.value }))} />
              <Input label='Total degree units' type='number' min='0' value={draft.total_units ?? ''}
                onChange={(event) => change((current) => ({
                  ...current,
                  total_units: event.target.value === '' ? '' : Number(event.target.value),
                }))} />
              <div className='md:col-span-2'>
                <Input label='Source URL' value={draft.source_url || ''}
                  onChange={(event) => change((current) => ({ ...current, source_url: event.target.value }))} />
              </div>
            </div>
          </section>

          <section>
            <div className='flex flex-wrap items-center gap-3 mb-2'>
              <div>
                <h3 className='text-heading'>Requirement groups</h3>
                <p className='text-caption text-ink-muted mt-0.5'>{draft.requirement_groups.length} groups</p>
              </div>
              <Button className='ml-auto' variant='secondary' leadingIcon={PlusIcon}
                onClick={() => changeGroups((groups) => [...groups, createDegreeGroup()])}>
                Add group
              </Button>
            </div>

            {draft.requirement_groups.length === 0 && (
              <p className='py-10 text-center text-body text-ink-subtle border-y border-border'>No requirement groups yet.</p>
            )}

            {draft.requirement_groups.map((group, groupIndex) => (
              <section key={group.hash_id || groupIndex} className='py-6 border-b border-border'>
                <div className='grid grid-cols-1 xl:grid-cols-[minmax(15rem,1fr)_16rem_auto] gap-3 items-end'>
                  <Input label='Group title' value={group.title || ''}
                    onChange={(event) => updateGroup(groupIndex, (current) => ({ ...current, title: event.target.value }))} />
                  <div>
                    <label className='field-label block mb-1'>Requirement tier</label>
                    <Select value={group.tier || 'transferable'} options={DEGREE_TIERS}
                      onChange={(tier) => updateGroup(groupIndex, (current) => setDegreeGroupTier(current, tier))} />
                  </div>
                  <div className='flex items-center justify-end gap-1'>
                    <IconButton icon={ChevronUpIcon} label='Move group up' disabled={groupIndex === 0}
                      onClick={() => changeGroups((groups) => moveItem(groups, groupIndex, groupIndex - 1))} />
                    <IconButton icon={ChevronDownIcon} label='Move group down'
                      disabled={groupIndex === draft.requirement_groups.length - 1}
                      onClick={() => changeGroups((groups) => moveItem(groups, groupIndex, groupIndex + 1))} />
                    <IconButton icon={TrashIcon} label='Delete group' onClick={() => removeGroup(groupIndex)} />
                  </div>
                </div>

                <div className='mt-4 border-y border-border divide-y divide-border'>
                  {(group.sections || []).map((section, sectionIndex) => (
                    <div key={section.hash_id || section.receivers?.[0]?.hash_id || sectionIndex}
                      className='grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center px-3 py-3 hover:bg-surface-hover'>
                      <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Badge>{TYPE_LABELS[degreeSectionType(section)]}</Badge>
                          <span className='text-caption text-ink-subtle'>Requirement {sectionIndex + 1}</span>
                        </div>
                        <p className='text-body text-ink mt-1 break-words'>{sectionSummary(section, coursesById)}</p>
                      </div>
                      <div className='flex items-center justify-end gap-1'>
                        <IconButton icon={ChevronUpIcon} label='Move requirement up' disabled={sectionIndex === 0}
                          onClick={() => updateGroup(groupIndex, (current) => ({
                            ...current,
                            sections: moveItem(current.sections || [], sectionIndex, sectionIndex - 1),
                          }))} />
                        <IconButton icon={ChevronDownIcon} label='Move requirement down'
                          disabled={sectionIndex === (group.sections || []).length - 1}
                          onClick={() => updateGroup(groupIndex, (current) => ({
                            ...current,
                            sections: moveItem(current.sections || [], sectionIndex, sectionIndex + 1),
                          }))} />
                        <IconButton icon={PencilSquareIcon} label='Edit requirement'
                          onClick={() => setSectionEditor({ groupIndex, sectionIndex, section })} />
                        <IconButton icon={TrashIcon} label='Delete requirement'
                          onClick={() => removeSection(groupIndex, sectionIndex)} />
                      </div>
                    </div>
                  ))}
                  {!(group.sections || []).length && (
                    <p className='px-3 py-4 text-caption text-ink-subtle'>No requirements in this group.</p>
                  )}
                </div>
                <Button className='mt-3' variant='ghost' leadingIcon={PlusIcon}
                  onClick={() => setSectionEditor({ groupIndex, sectionIndex: null, section: null })}>
                  Add requirement
                </Button>
              </section>
            ))}
          </section>
        </Stack>
      </FullScreenPanel>

      <SectionEditorModal editing={sectionEditor}
        tier={sectionEditor ? draft.requirement_groups[sectionEditor.groupIndex]?.tier || 'transferable' : 'transferable'}
        courses={courses} coursesLoading={coursesQuery.isLoading}
        onClose={() => setSectionEditor(null)} onSave={applySection} />
    </>
  )
}
