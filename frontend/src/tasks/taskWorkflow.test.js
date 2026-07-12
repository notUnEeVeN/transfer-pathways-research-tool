import { describe, expect, it } from 'vitest'
import {
  PORTING_STAGES, currentStageIndex, derivedProgress, nextStage,
} from './taskWorkflow'

describe('Porting task workflow', () => {
  it('has six stages whose weights total 100', () => {
    expect(PORTING_STAGES).toHaveLength(6)
    expect(PORTING_STAGES.reduce((sum, stage) => sum + stage.weight, 0)).toBe(100)
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
})
