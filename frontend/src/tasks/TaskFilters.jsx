import React, { useMemo } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Input, Select, SwitchField, Tabs } from '../components/ui'
import { TASK_TYPE_OPTIONS } from './taskWorkflow'
import { EMPTY_TASK_FILTERS } from './taskFilter'

/**
 * Controlled filter bar for TasksPage. Persistence belongs to the page so the
 * component stays reusable and deterministic in tests.
 */
export default function TaskFilters({ value = EMPTY_TASK_FILTERS, onChange, roster = [] }) {
  const filters = {
    ...EMPTY_TASK_FILTERS,
    ...value,
    types: Array.isArray(value?.types) ? value.types : [],
  }

  const assigneeOptions = useMemo(() => {
    const seen = new Set()
    const people = (Array.isArray(roster) ? roster : []).filter((person) => {
      if (!person?.uid || seen.has(person.uid)) return false
      seen.add(person.uid)
      return true
    })
    const unavailable = filters.assignee && !seen.has(filters.assignee)
    return [
      { value: '', label: 'All assignees' },
      ...(unavailable ? [{
        value: filters.assignee,
        label: `Unavailable assignee (${filters.assignee})`,
      }] : []),
      ...people.map((person) => ({ value: person.uid, label: person.label || person.uid })),
    ]
  }, [filters.assignee, roster])

  const set = (patch) => onChange?.({ ...filters, ...patch })
  const toggleType = (taskType) => set({
    types: filters.types.includes(taskType)
      ? filters.types.filter((value) => value !== taskType)
      : [...filters.types, taskType],
  })

  return (
    <section aria-label='Task filters'
      className='flex flex-col gap-3 rounded-2xl bg-surface-muted p-3 lg:flex-row lg:items-center'>
      <div className='min-w-[14rem] flex-1'>
        <Input
          type='search'
          value={filters.text}
          onChange={(event) => set({ text: event.target.value })}
          placeholder='Search tasks…'
          aria-label='Search tasks'
          leadingIcon={MagnifyingGlassIcon}
        />
      </div>

      <fieldset className='min-w-0'>
        <legend className='sr-only'>Task types</legend>
        <div className='max-w-full overflow-x-auto'>
          <Tabs
            multiple
            value={filters.types}
            onChange={toggleType}
            options={TASK_TYPE_OPTIONS}
          />
        </div>
      </fieldset>

      <Select
        pill
        className='min-w-[10rem] lg:w-44'
        value={filters.assignee}
        onChange={(assignee) => set({ assignee })}
        options={assigneeOptions}
        placeholder='All assignees'
        aria-label='Assignee'
      />

      <SwitchField
        className='shrink-0'
        label='Mine'
        srLabel='Show only my tasks'
        checked={filters.mineOnly}
        onChange={() => set({ mineOnly: !filters.mineOnly })}
      />
    </section>
  )
}
