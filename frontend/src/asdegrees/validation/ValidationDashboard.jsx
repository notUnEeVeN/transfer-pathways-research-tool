import React, { useMemo, useState } from 'react'
import {
  AcademicCapIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Panel,
  Select,
  Spinner,
  Stack,
} from '../../components/ui'
import { useColleges } from '../../shared/query/hooks/useData'
import { useSetValidationCohort, useValidationCohort } from './useValidation'

const DEGREE_LABEL = {
  ast: 'CS A.S.-T',
  local_cs_as: 'Local CS A.S.',
  local_computing: 'Other computing',
}

function errorMessage(error) {
  return error?.response?.data?.error || error?.message || 'The validation cohort could not be updated.'
}

function ProgressBar({ label, value, total, tone = 'brand' }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  const fill = tone === 'success' ? 'bg-success' : 'bg-primary'
  const rangeProps = total > 0 ? {
    role: 'progressbar',
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': total,
    'aria-valuenow': value,
    'aria-valuetext': `${value} of ${total}`,
  } : {
    'aria-label': `${label}: no records`,
  }
  return (
    <div className='min-w-0'>
      <div className='mb-1.5 flex items-baseline justify-between gap-3'>
        <span className='text-tag text-ink-subtle'>{label}</span>
        <span className='font-mono text-tag text-ink-muted'>{value}/{total}</span>
      </div>
      <div
        className='h-1.5 overflow-hidden rounded-pill bg-surface-sunken'
        {...rangeProps}
      >
        <div className={`h-full rounded-pill ${fill}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function DegreeChip({ degree }) {
  const label = DEGREE_LABEL[degree.degree_type] || degree.degree_type || 'Degree record'
  return (
    <div className='flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2'>
      <span className='text-caption text-ink-muted'>
        {label} · {degree.groups_curated}/{degree.groups_total} groups
      </span>
      {degree.verified ? (
        <Badge variant='success' icon={CheckCircleIcon}>Verified</Badge>
      ) : degree.status !== 'found' ? (
        <Badge>{degree.status === 'none_found' ? 'None found' : 'Ambiguous'}</Badge>
      ) : (
        <Badge>In review</Badge>
      )}
    </div>
  )
}

function CollegeRow({ college, onOpenEditor, onRemove, removing }) {
  const degrees = college.degrees || []
  const groupsTotal = degrees.reduce((sum, degree) => sum + (degree.groups_total || 0), 0)
  const groupsCurated = degrees.reduce((sum, degree) => sum + (degree.groups_curated || 0), 0)
  const degreesFound = degrees.filter((degree) => degree.status === 'found').length
  const verified = degrees.filter((degree) => degree.verified).length
  const name = college.name || `Community college ${college.college_id}`

  return (
    <article className='border-b border-border px-5 py-5 last:border-b-0'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h3 className='text-body-strong truncate'>{name}</h3>
          <p className='text-tag text-ink-subtle'>College ID {college.college_id}</p>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='sm'
            leadingIcon={TrashIcon}
            disabled={removing}
            aria-label={`Remove ${name} from cohort`}
            onClick={() => onRemove(college.college_id)}
          >
            Remove
          </Button>
          <Button
            variant='secondary'
            size='sm'
            trailingIcon={ArrowRightIcon}
            aria-label={`Open ${name} editor`}
            onClick={() => onOpenEditor(college.college_id)}
          >
            Open editor
          </Button>
        </div>
      </div>

      {degrees.length > 0 ? (
        <>
          <div className='mt-4 grid gap-4 sm:grid-cols-3'>
            <ProgressBar label='Degrees found' value={degreesFound} total={degrees.length} />
            <ProgressBar label='Groups curated' value={groupsCurated} total={groupsTotal} />
            <ProgressBar label='Records verified' value={verified} total={degrees.length} tone='success' />
          </div>
          <div className='mt-4 flex flex-wrap gap-2'>
            {degrees.map((degree) => (
              <DegreeChip key={degree.record_id || degree.degree_type} degree={degree} />
            ))}
          </div>
        </>
      ) : (
        <p className='mt-4 text-caption text-ink-subtle'>No AS-degree records yet</p>
      )}
    </article>
  )
}

/**
 * Team workspace for choosing the deep-validation cohort and opening one
 * college in the structured editor. The editor remains an injected handoff so
 * this dashboard can mount anywhere the AS-degree pane is available.
 */
export default function ValidationDashboard({ onOpenEditor = () => {} }) {
  const cohort = useValidationCohort()
  const colleges = useColleges()
  const setCohort = useSetValidationCohort()
  const [selectedCollege, setSelectedCollege] = useState('')
  const [actionError, setActionError] = useState('')

  const collegeIds = cohort.data?.college_ids || []
  const cohortById = useMemo(
    () => new Map((cohort.data?.colleges || []).map((college) => [Number(college.college_id), college])),
    [cohort.data?.colleges],
  )
  const rosterById = useMemo(
    () => new Map((colleges.data || []).map((college) => [Number(college.id), college])),
    [colleges.data],
  )
  const cohortColleges = useMemo(() => collegeIds.map((id) => {
    const numericId = Number(id)
    const progress = cohortById.get(numericId)
    return progress ? {
      ...progress,
      name: progress.name || rosterById.get(numericId)?.name || null,
    } : {
      college_id: numericId,
      name: rosterById.get(numericId)?.name || null,
      degrees: [],
    }
  }), [cohortById, collegeIds, rosterById])
  const availableOptions = useMemo(() => {
    const selectedIds = new Set(collegeIds.map(Number))
    return (colleges.data || [])
      .filter((college) => !selectedIds.has(Number(college.id)))
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((college) => ({ value: Number(college.id), label: college.name }))
  }, [collegeIds, colleges.data])

  const replaceCohort = async (nextIds) => {
    setActionError('')
    try {
      await setCohort.mutateAsync({ college_ids: nextIds })
      return true
    } catch (error) {
      setActionError(errorMessage(error))
      return false
    }
  }

  const addCollege = async () => {
    const id = Number(selectedCollege)
    if (!Number.isFinite(id)) return
    const saved = await replaceCohort([...collegeIds.map(Number), id])
    if (saved) setSelectedCollege('')
  }

  const removeCollege = (collegeId) => replaceCohort(
    collegeIds.map(Number).filter((id) => id !== Number(collegeId)),
  )

  if (cohort.isLoading || colleges.isLoading) {
    return (
      <div className='flex items-center justify-center py-16' aria-label='Loading validation cohort'>
        <Spinner />
      </div>
    )
  }

  if (cohort.isError) {
    return <Alert type='error' message={errorMessage(cohort.error)} />
  }

  return (
    <Stack gap='section'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='text-eyebrow text-primary'>Deep validation</p>
          <h2 className='text-title mt-1'>AS-degree validation cohort</h2>
          <p className='text-body text-ink-muted mt-1 max-w-[65ch]'>
            Choose the colleges your research partner is checking in depth. Progress updates from
            the same degree records that power the visualizations.
          </p>
        </div>
        <Badge variant={cohortColleges.length ? 'accent' : 'neutral'}>
          {cohortColleges.length} college{cohortColleges.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {(actionError || setCohort.isError) && (
        <Alert type='error' message={actionError || errorMessage(setCohort.error)} />
      )}

      <Panel title='Add a college' icon={PlusIcon} overflowVisible>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <Select
            className='min-w-0 flex-1'
            value={selectedCollege}
            onChange={setSelectedCollege}
            options={availableOptions}
            placeholder={availableOptions.length ? 'Choose a college' : 'All colleges are in the cohort'}
            aria-label='Choose a college'
            disabled={!availableOptions.length || setCohort.isPending}
          />
          <Button
            leadingIcon={PlusIcon}
            onClick={addCollege}
            loading={setCohort.isPending}
            disabled={!selectedCollege}
          >
            Add to cohort
          </Button>
        </div>
      </Panel>

      {cohortColleges.length > 0 ? (
        <Panel title='Validation progress' icon={AcademicCapIcon} padded={false}>
          {cohortColleges.map((college) => (
            <CollegeRow
              key={college.college_id}
              college={college}
              onOpenEditor={onOpenEditor}
              onRemove={removeCollege}
              removing={setCohort.isPending}
            />
          ))}
        </Panel>
      ) : (
        <EmptyState
          card
          icon={AcademicCapIcon}
          title='No colleges in the validation cohort'
          description='Add a community college above to begin checking its AS-degree records and tracking review progress.'
        />
      )}
    </Stack>
  )
}

export { ProgressBar, CollegeRow }
