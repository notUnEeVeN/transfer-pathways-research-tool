// Broad, reusable task starters. Project- and school-specific scope belongs in
// the editable title/checklist instead of multiplying one-off presets.
export const TASK_PRESETS = [
  {
    key: 'data_validation',
    label: 'Data validation',
    blurb: 'Validate any set of schools, datasets, or records in one checklist.',
    task_type: 'data_verification',
    params: [],
    build: () => ({
      title: 'Data validation — <scope>',
      description: 'Add each school, dataset, or validation unit as a checkpoint, then verify them one by one in this task.',
      checklist_items: [],
    }),
  },
  {
    key: 'figure_work',
    label: 'Visual creation',
    blurb: 'Create a new visual or analysis with a lightweight workflow.',
    task_type: 'general',
    params: [],
    build: () => ({
      title: 'New visual — <name>',
      description: 'Define the question, confirm the data, build the visual, and publish it for review.',
      checklist_items: [
        { key: 'question', label: 'Research question + measure defined' },
        { key: 'data', label: 'Data/endpoint confirmed or built' },
        { key: 'implementation', label: 'Visualization implemented' },
        { key: 'publish', label: 'Published for team review' },
        { key: 'review', label: 'Peer feedback addressed' },
      ],
    }),
  },
  {
    key: 'porting',
    label: 'Porting',
    blurb: 'Use the established seven-stage workflow to recreate or adapt a visual.',
    task_type: 'porting',
    params: [],
    build: () => ({
      title: 'Port visual — <name>',
      description: 'Recreate or adapt an existing visual through the established porting and review workflow.',
    }),
  },
  {
    key: 'custom',
    label: 'Custom (blank)',
    blurb: 'Plain task — title, description, optional checklist.',
    task_type: 'general',
    params: [],
    build: () => ({ title: '', description: '', checklist_items: [] }),
  },
]

export function buildPresetTask(presetKey, params = {}) {
  const preset = TASK_PRESETS.find((p) => p.key === presetKey)
  if (!preset) throw new Error(`unknown preset: ${presetKey}`)
  return { task_type: preset.task_type, ...preset.build(params) }
}
