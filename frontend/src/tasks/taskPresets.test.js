import { describe, expect, it } from 'vitest'
import { TASK_PRESETS, buildPresetTask } from './taskPresets'

describe('task preset library', () => {
  it('builds one broad data-validation task whose schools are added as checkpoints', () => {
    const task = buildPresetTask('data_validation')

    expect(task).toMatchObject({
      task_type: 'data_verification',
      title: 'Data validation — <scope>',
      checklist_items: [],
    })
    expect(task.description).toContain('Add each school')
  })

  it('keeps separate visual-creation, porting, and blank starters', () => {
    expect(buildPresetTask('figure_work')).toMatchObject({
      task_type: 'general',
      title: 'New visual — <name>',
    })
    expect(buildPresetTask('porting')).toMatchObject({
      task_type: 'porting',
      title: 'Port visual — <name>',
    })
    expect(buildPresetTask('custom')).toEqual({
      task_type: 'general', title: '', description: '', checklist_items: [],
    })
  })

  it('throws for an unknown preset key', () => {
    expect(() => buildPresetTask('does_not_exist')).toThrow('unknown preset: does_not_exist')
  })

  it('defines unique presets with the supported interface', () => {
    const keys = TASK_PRESETS.map((preset) => preset.key)

    expect(keys).toEqual([
      'data_validation',
      'figure_work',
      'porting',
      'custom',
    ])
    expect(new Set(keys).size).toBe(keys.length)

    for (const preset of TASK_PRESETS) {
      expect(preset).toEqual(expect.objectContaining({
        key: expect.any(String),
        label: expect.any(String),
        blurb: expect.any(String),
        task_type: expect.stringMatching(/^(general|data_verification|porting)$/),
        params: expect.any(Array),
        build: expect.any(Function),
      }))
      expect(preset.params.every((param) => ['campus', 'college', 'major'].includes(param))).toBe(true)
      expect(new Set(preset.params).size).toBe(preset.params.length)
    }
  })

  it('builds every preset with valid, uniquely keyed checklist items', () => {
    for (const preset of TASK_PRESETS) {
      const task = buildPresetTask(preset.key)

      expect(task.task_type).toBe(preset.task_type)
      expect(task.title).toEqual(expect.any(String))
      expect(task.description).toEqual(expect.any(String))
      if (task.checklist_items == null) continue

      const checklistKeys = task.checklist_items.map((item) => item.key)
      expect(new Set(checklistKeys).size).toBe(checklistKeys.length)

      for (const item of task.checklist_items) {
        expect(item.key).toMatch(/^[a-z0-9_]+$/)
        expect(item.label).toEqual(expect.any(String))
        expect(item.label.length).toBeGreaterThan(0)
      }
    }
  })
})
