import { describe, expect, it } from 'vitest'
import {
  buildTaskHistoryAiBriefing, buildTaskHistoryMarkdown, groupEventsByWeek, weekNumberFor,
} from './taskHistory'

const task = {
  _id: 'tp-history',
  title: 'Port district chart',
  description: 'Recreate and validate the source figure.',
  task_type: 'porting',
  status: 'in_progress',
  progress: 15,
  assignee_label: 'Ari',
  created_by: 'author',
  created_by_label: 'Ari',
  created_at: '2026-07-01T16:00:00.000Z',
  notes: [{
    uid: 'author', label: 'Ari', text: 'Keep the original denominator.', at: '2026-07-02T16:00:00.000Z',
  }],
  workflow_stages: {
    understand: {
      completed: true,
      completed_at: '2026-07-02T18:00:00.000Z',
      completed_by: 'author',
      completed_by_label: 'Ari',
      note: 'Confirmed the source population.',
      event_id: 'log-2',
    },
  },
  workflow_log: [
    {
      _id: 'log-1', stage: 'understand', action: 'noted', note: 'Confirmed the source population.',
      by: 'author', by_label: 'Ari', at: '2026-07-02T17:00:00.000Z',
    },
    {
      _id: 'log-2', stage: 'understand', action: 'completed',
      by: 'author', by_label: 'Ari', at: '2026-07-02T18:00:00.000Z',
    },
    {
      _id: 'log-3', stage: 'research', action: 'noted', note: 'Found district boundary data.',
      by: 'author', by_label: 'Ari', at: '2026-07-09T17:00:00.000Z',
    },
  ],
}

describe('task history export', () => {
  it('assigns Monday-Sunday log weeks from the first recorded week', () => {
    expect(weekNumberFor('2026-07-05T23:59:00', task.created_at)).toBe(1)
    expect(weekNumberFor('2026-07-06T00:00:00', task.created_at)).toBe(2)
  })

  it('groups a copied event list newest-first without mutating it', () => {
    const events = [task.workflow_log[0], task.workflow_log[2]]
    const grouped = groupEventsByWeek(events, task.created_at, { descending: true })
    expect(grouped.map((group) => group.week)).toEqual([2, 1])
    expect(grouped[0].events[0]._id).toBe('log-3')
    expect(events.map((event) => event._id)).toEqual(['log-1', 'log-3'])
  })

  it('exports general notes and the full workflow under week headings', () => {
    const markdown = buildTaskHistoryMarkdown([task], {
      generatedAt: '2026-07-12T20:00:00.000Z',
    })
    expect(markdown).toContain('# Research task history')
    expect(markdown).toContain('Calendar: Actual activity grouped Monday through Sunday')
    expect(markdown).toContain('## Week 1 - 2026-06-29 to 2026-07-05')
    expect(markdown).toContain('## Week 1')
    expect(markdown).toContain('## Week 2')
    expect(markdown).toContain('Keep the original denominator.')
    expect(markdown).toContain('[Read & understand] Ari completed the stage.')
    expect(markdown).toContain('Found district boundary data.')
  })

  it('wraps the same complete export in a factual AI cleanup prompt', () => {
    const briefing = buildTaskHistoryAiBriefing([task], {
      generatedAt: '2026-07-12T20:00:00.000Z',
    })
    expect(briefing).toContain('never invent work, dates, durations, approvals, or conclusions')
    expect(briefing).toContain('Timesheet weeks run Sunday through Saturday')
    expect(briefing).toContain('not as advice, options, proposals, or recommendations')
    expect(briefing).toContain('Received Y reporting hours worked on YYYY-MM-DD')
    expect(briefing).toContain('Hour-allocation notes')
    expect(briefing).toContain('# Research task history')
    expect(briefing).toContain('## Week 2')
  })
})
