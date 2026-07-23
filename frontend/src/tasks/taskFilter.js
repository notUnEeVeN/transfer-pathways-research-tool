export const EMPTY_TASK_FILTERS = Object.freeze({
  text: '',
  types: [],
  assignee: '',
  mineOnly: false,
})

const normalizedTypes = (types) => (
  Array.isArray(types) ? [...new Set(types.filter(Boolean))] : []
)

/**
 * Whether the controlled filter state narrows the task collection.
 * Whitespace-only search text and an empty type list are intentionally inert.
 */
export function hasActiveTaskFilters(filters = EMPTY_TASK_FILTERS) {
  return Boolean(
    String(filters?.text ?? '').trim()
    || normalizedTypes(filters?.types).length
    || filters?.assignee
    || filters?.mineOnly
  )
}

/**
 * Pure task filtering shared by the board and list views. Filter dimensions
 * combine with AND; multiple selected task types combine with OR.
 */
export function filterTasks(tasks = [], filters = EMPTY_TASK_FILTERS) {
  const rows = Array.isArray(tasks) ? tasks : []
  const text = String(filters?.text ?? '').trim().toLocaleLowerCase()
  const types = new Set(normalizedTypes(filters?.types))
  const assignee = filters?.assignee || ''
  // When supplied, the roster is authoritative: a persisted filter for a
  // deleted teammate must not start matching legacy tasks that retain the uid.
  const validAssignees = Array.isArray(filters?.validAssigneeUids)
    ? new Set(filters.validAssigneeUids.filter(Boolean))
    : null
  const mineOnly = Boolean(filters?.mineOnly)
  const uid = filters?.uid

  return rows.filter((task) => {
    if (text) {
      const searchable = `${task?.title ?? ''} ${task?.description ?? ''}`.toLocaleLowerCase()
      if (!searchable.includes(text)) return false
    }

    if (types.size && !types.has(task?.task_type)) return false
    if (assignee && (validAssignees?.has(assignee) === false || task?.assignee_uid !== assignee)) return false
    if (mineOnly && (!uid || task?.assignee_uid !== uid)) return false

    return true
  })
}
