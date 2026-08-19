import { describe, expect, it } from 'vitest'
import { groupSavedComparisons } from './savedComparisonOrder'

const MAJORS = new Map([
  ['cs', { slug: 'cs', label: 'Computer Science (CA)' }],
  ['ma-cs', { slug: 'ma-cs', label: 'Computer Science (MA)', state: 'ma' }],
  ['va-cs', { slug: 'va-cs', label: 'Computer Science (VA)', state: 'va' }],
])

const row = (id, figure, majors, { title = id, updatedAt = '2026-08-19T00:00:00Z' } = {}) => ({
  _id: id,
  title,
  updated_at: updatedAt,
  panes: majors.map((major, index) => ({
    id: `p${index + 1}`, figure, major, knobs: {}, label: null,
  })),
})

describe('saved comparison presentation order', () => {
  it('groups CA–MA Figures 1–6 before MA source exhibits using pane and registry metadata', () => {
    const comparisons = [
      row('audit-6', 'pathway-complexity', ['ma-cs', 'ma-cs'], {
        // Misleading titles and timestamps are deliberate: neither may control
        // the meeting sequence.
        title: 'AAA newest', updatedAt: '2030-01-01T00:00:00Z',
      }),
      row('state-5', 'transfer-extra-cost', ['ma-cs', 'cs'], { updatedAt: '2020-01-01T00:00:00Z' }),
      row('state-1', 'coverage-heatmap', ['ma-cs', 'cs'], { title: 'ZZZ' }),
      row('other-2', 'course-type-coverage', ['ca-cs', 'va-cs']),
      row('audit-3', 'transfer-credit-rate', ['ma-cs', 'ma-cs']),
      row('state-6', 'pathway-complexity', ['ma-cs', 'cs']),
      row('state-3', 'transfer-credit-rate', ['ma-cs', 'cs']),
      row('state-2', 'course-type-coverage', ['ma-cs', 'cs']),
      row('state-4', 'transfer-extra-units', ['ma-cs', 'cs']),
    ]

    const groups = groupSavedComparisons(comparisons, MAJORS)

    expect(groups.map((group) => group.key)).toEqual(['ca-ma', 'ma-audit', 'other'])
    expect(groups[0].comparisons.map((entry) => entry._id)).toEqual([
      'state-1', 'state-2', 'state-3', 'state-4', 'state-5', 'state-6',
    ])
    expect(groups[1].comparisons.map((entry) => entry._id)).toEqual(['audit-3', 'audit-6'])
    expect(groups[2].comparisons.map((entry) => entry._id)).toEqual(['other-2'])
  })

  it('uses state-slug prefixes only as a resilient fallback when major metadata is unavailable', () => {
    const groups = groupSavedComparisons([
      row('state', 'coverage-heatmap', ['ma-cs', 'cs']),
      row('audit', 'pathway-complexity', ['ma-cs', 'ma-cs']),
    ], new Map())

    expect(groups.map((group) => [group.key, group.comparisons.map((entry) => entry._id)]))
      .toEqual([
        ['ca-ma', ['state']],
        ['ma-audit', ['audit']],
      ])
  })
})
