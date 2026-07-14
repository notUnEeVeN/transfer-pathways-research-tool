import { describe, expect, it } from 'vitest'
import {
  PORTING_STAGES, currentStageIndex, derivedProgress, nextStage, isAwaitingVerification,
  withBoardAssignment,
} from './taskWorkflow'

const through = (keys) => Object.fromEntries(keys.map((key) => [key, { completed: true }]))

describe('Porting task workflow', () => {
  it('has seven stages whose weights total 100, with self_verify before approval', () => {
    expect(PORTING_STAGES).toHaveLength(7)
    expect(PORTING_STAGES.reduce((sum, stage) => sum + stage.weight, 0)).toBe(100)
    expect(PORTING_STAGES.map((stage) => stage.key)).toEqual([
      'understand', 'research', 'data_access', 'visualization', 'publish', 'self_verify', 'approval',
    ])
    expect(PORTING_STAGES.find((stage) => stage.key === 'visualization').weight).toBe(25)
    expect(PORTING_STAGES.find((stage) => stage.key === 'self_verify')).toMatchObject({ label: 'Self-verify', weight: 5 })
  })

  it('derives progress and the next stage from stage completion state', () => {
    const task = {
      task_type: 'porting',
      workflow_stages: {
        understand: { completed: true },
        research: { completed_at: '2026-07-11T10:00:00Z' },
      },
    }
    expect(derivedProgress(task)).toBe(35)
    expect(currentStageIndex(task)).toBe(2)
    expect(nextStage(task)?.key).toBe('data_access')
  })

  describe('isAwaitingVerification (derived board membership)', () => {
    const preApprovalKeys = PORTING_STAGES.slice(0, -1).map((stage) => stage.key)

    it('is true for an in_progress task whose only remaining stage is peer approval', () => {
      const task = { task_type: 'porting', status: 'in_progress', workflow_stages: through(preApprovalKeys) }
      expect(nextStage(task)?.key).toBe('approval')
      expect(isAwaitingVerification(task)).toBe(true)
    })

    it('is false right after publish while self_verify is still pending', () => {
      const task = {
        task_type: 'porting', status: 'in_progress',
        workflow_stages: through(['understand', 'research', 'data_access', 'visualization', 'publish']),
      }
      expect(nextStage(task)?.key).toBe('self_verify')
      expect(isAwaitingVerification(task)).toBe(false)
    })

    it('is false for a mid-flow, a todo, and a done task', () => {
      expect(isAwaitingVerification({ task_type: 'porting', status: 'in_progress', workflow_stages: through(['understand']) })).toBe(false)
      expect(isAwaitingVerification({ task_type: 'porting', status: 'todo', workflow_stages: {} })).toBe(false)
      expect(isAwaitingVerification({
        task_type: 'porting', status: 'done', workflow_stages: through(PORTING_STAGES.map((stage) => stage.key)),
      })).toBe(false)
    })
  })

  describe('withBoardAssignment', () => {
    const me = { uid: 'u-me', displayName: 'Fallback Name', email: 'me@example.edu' }
    const roster = [{ uid: 'u-me', label: 'Researcher Name' }]

    it('claims a task for the person moving it from To do to In progress', () => {
      const task = { status: 'todo', assignee_uid: 'u-old', assignee_label: 'Old Owner' }
      expect(withBoardAssignment(task, { status: 'in_progress', order: 2000 }, me, roster)).toEqual({
        status: 'in_progress',
        order: 2000,
        assignee_uid: 'u-me',
        assignee_label: 'Researcher Name',
      })
    })

    it('releases a task returned from In progress to To do', () => {
      const task = { status: 'in_progress', assignee_uid: 'u-me', assignee_label: 'Researcher Name' }
      expect(withBoardAssignment(task, { status: 'todo', order: 1000 }, me, roster)).toEqual({
        status: 'todo',
        order: 1000,
        assignee_uid: null,
        assignee_label: null,
      })
    })

    it('does not change ownership for reorders or later status transitions', () => {
      const task = { status: 'in_progress', assignee_uid: 'u-other', assignee_label: 'Other Owner' }
      expect(withBoardAssignment(task, { status: 'in_progress', order: 3000 }, me, roster)).toEqual({
        status: 'in_progress', order: 3000,
      })
      expect(withBoardAssignment(task, { status: 'done', order: 4000 }, me, roster)).toEqual({
        status: 'done', order: 4000,
      })
    })
  })
})
