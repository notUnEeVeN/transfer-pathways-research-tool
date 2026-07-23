import { describe, expect, it } from 'vitest'
import { filterTasks, hasActiveTaskFilters } from './taskFilter'

const tasks = [
  {
    _id: 'degree',
    title: 'Gather Biology degree template',
    description: 'Structure the UC Davis catalog requirements.',
    task_type: 'general',
    assignee_uid: 'uid-alex',
  },
  {
    _id: 'audit',
    title: 'Resolve audit mismatch',
    description: 'Check the missing CHEM articulation.',
    task_type: 'audit_fix',
    assignee_uid: 'uid-sam',
  },
  {
    _id: 'port',
    title: 'Port Figure 4',
    description: null,
    task_type: 'porting',
    assignee_uid: null,
  },
]

describe('filterTasks', () => {
  it('matches title and description text case-insensitively', () => {
    expect(filterTasks(tasks, { text: '  biology  ' }).map((task) => task._id)).toEqual(['degree'])
    expect(filterTasks(tasks, { text: 'CHEM' }).map((task) => task._id)).toEqual(['audit'])
  })

  it('narrows to any selected task type, while an empty selection means all', () => {
    expect(filterTasks(tasks, { types: [] })).toEqual(tasks)
    expect(filterTasks(tasks, { types: ['general', 'porting'] }).map((task) => task._id))
      .toEqual(['degree', 'port'])
  })

  it('filters by assignee', () => {
    expect(filterTasks(tasks, { assignee: 'uid-sam' }).map((task) => task._id)).toEqual(['audit'])
    expect(filterTasks(tasks, { assignee: 'deleted-uid' })).toEqual([])
  })

  it('matches nothing for an assignee outside the current roster, even when an old task retains the uid', () => {
    const withFormerAssignee = [
      ...tasks,
      { ...tasks[0], _id: 'former', assignee_uid: 'deleted-uid' },
    ]

    expect(filterTasks(withFormerAssignee, {
      assignee: 'deleted-uid',
      validAssigneeUids: ['uid-alex', 'uid-sam'],
    })).toEqual([])
    expect(filterTasks(withFormerAssignee, {
      assignee: 'uid-sam',
      validAssigneeUids: ['uid-alex', 'uid-sam'],
    }).map((task) => task._id)).toEqual(['audit'])
  })

  it('shows only the current user when mine-only is enabled', () => {
    expect(filterTasks(tasks, { mineOnly: true, uid: 'uid-alex' }).map((task) => task._id)).toEqual(['degree'])
    expect(filterTasks(tasks, { mineOnly: true })).toEqual([])
  })

  it('combines filter dimensions with AND without mutating the input', () => {
    const filters = { text: 'catalog', types: ['general'], assignee: 'uid-alex' }
    const before = tasks.slice()

    expect(filterTasks(tasks, filters).map((task) => task._id)).toEqual(['degree'])
    expect(tasks).toEqual(before)
  })

  it('is safe on absent or malformed collections', () => {
    expect(filterTasks()).toEqual([])
    expect(filterTasks(null, { text: 'anything' })).toEqual([])
  })
})

describe('hasActiveTaskFilters', () => {
  it('ignores empty defaults and whitespace-only text', () => {
    expect(hasActiveTaskFilters()).toBe(false)
    expect(hasActiveTaskFilters({ text: '  ', types: [], assignee: '', mineOnly: false })).toBe(false)
  })

  it.each([
    [{ text: 'audit' }],
    [{ types: ['general'] }],
    [{ assignee: 'uid-alex' }],
    [{ mineOnly: true }],
  ])('detects an active filter in %o', (filters) => {
    expect(hasActiveTaskFilters(filters)).toBe(true)
  })
})
