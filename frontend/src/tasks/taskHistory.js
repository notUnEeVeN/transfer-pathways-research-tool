import { stagesForTask, taskTypeLabel } from './taskWorkflow'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

const STATUS_LABELS = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

const timestamp = (value) => {
  const time = value ? new Date(value).getTime() : NaN
  return Number.isFinite(time) ? time : null
}

// A timezone-neutral ordinal for the date as it appears in the user's local
// calendar. This avoids classifying Sunday evening as Monday merely because the
// stored ISO timestamp is already on Monday in UTC.
const localDateOrdinal = (value) => {
  const time = timestamp(value)
  if (time == null) return null
  const date = new Date(time)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

// The research log uses Monday-Sunday weeks. Timesheet weeks are deliberately
// handled only by the AI reconciliation prompt because their Sunday-Saturday
// calendar is a separate reporting view, not a reason to rewrite source history.
const localLogWeekStartOrdinal = (value) => {
  const ordinal = localDateOrdinal(value)
  if (ordinal == null) return null
  const day = new Date(ordinal).getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  return ordinal - daysSinceMonday * DAY_MS
}

const localNoonFromOrdinal = (ordinal) => {
  const date = new Date(ordinal)
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)
}

const actorLabel = (uid, label) => label || uid || 'Unknown teammate'

const stageLabelsFor = (task) => new Map(
  stagesForTask(task).map((stage) => [stage.key, stage.label])
)

export function weekNumberFor(value, startAt) {
  const eventDay = localDateOrdinal(value)
  const startWeek = localLogWeekStartOrdinal(startAt)
  if (eventDay == null || startWeek == null) return 1
  return Math.max(1, Math.floor((eventDay - startWeek) / WEEK_MS) + 1)
}

/** Groups a copied event list without changing the server-provided ordering. */
export function groupEventsByWeek(events = [], startAt = null, { descending = false } = {}) {
  const dated = events.map((event, index) => ({ event, index, time: timestamp(event.at) }))
  const firstEventAt = dated
    .filter((entry) => entry.time != null)
    .reduce((earliest, entry) => Math.min(earliest, entry.time), Infinity)
  const anchor = startAt || (Number.isFinite(firstEventAt) ? new Date(firstEventAt) : null)

  dated.sort((left, right) => {
    const leftTime = left.time ?? timestamp(anchor) ?? 0
    const rightTime = right.time ?? timestamp(anchor) ?? 0
    const order = leftTime - rightTime || left.index - right.index
    return descending ? -order : order
  })

  const groups = new Map()
  dated.forEach(({ event }) => {
    const week = weekNumberFor(event.at, anchor)
    if (!groups.has(week)) groups.set(week, [])
    groups.get(week).push(event)
  })
  return [...groups.entries()]
    .sort(([left], [right]) => descending ? right - left : left - right)
    .map(([week, groupedEvents]) => ({ week, events: groupedEvents }))
}

export function historyEventsForTask(task) {
  const stageLabels = stageLabelsFor(task)
  const workflowLog = Array.isArray(task?.workflow_log) ? task.workflow_log : []
  const events = [{
    id: `created:${task?._id || task?.title || 'task'}`,
    taskId: task?._id,
    taskTitle: task?.title || 'Untitled task',
    kind: 'created',
    action: 'created',
    actor: actorLabel(task?.created_by, task?.created_by_label),
    at: task?.created_at,
  }]

  workflowLog.forEach((event, index) => {
    events.push({
      id: event._id || `workflow:${task?._id}:${index}`,
      taskId: task?._id,
      taskTitle: task?.title || 'Untitled task',
      kind: 'workflow',
      action: event.action || 'noted',
      stage: event.stage,
      stageLabel: stageLabels.get(event.stage) || event.stage || 'Workflow',
      affectedStageLabels: (event.affected_stages || []).map((key) => stageLabels.get(key) || key),
      actor: actorLabel(event.by, event.by_label),
      note: typeof event.note === 'string' ? event.note.trim() : '',
      at: event.at,
    })
  })

  // Legacy completed tasks may only have stage state, with no matching log
  // events. Preserve those imported notes in the complete export.
  const loggedCompletions = new Set(
    workflowLog.filter((event) => event.action === 'completed').map((event) => event.stage)
  )
  stagesForTask(task).forEach((stage) => {
    const state = task?.workflow_stages?.[stage.key]
    if ((!state?.completed && !state?.completed_at) || loggedCompletions.has(stage.key)) return
    events.push({
      id: state.event_id || `stage-state:${task?._id}:${stage.key}`,
      taskId: task?._id,
      taskTitle: task?.title || 'Untitled task',
      kind: 'workflow',
      action: 'completed',
      stage: stage.key,
      stageLabel: stage.label,
      affectedStageLabels: [],
      actor: actorLabel(state.completed_by, state.completed_by_label),
      note: typeof state.note === 'string' ? state.note.trim() : '',
      at: state.completed_at,
    })
  })

  const generalNotes = Array.isArray(task?.notes) ? task.notes : []
  generalNotes.forEach((note, index) => {
    if (typeof note?.text !== 'string' || !note.text.trim()) return
    events.push({
      id: `general:${task?._id}:${note.at || index}`,
      taskId: task?._id,
      taskTitle: task?.title || 'Untitled task',
      kind: 'general_note',
      action: 'noted',
      actor: actorLabel(note.uid, note.label),
      note: note.text.trim(),
      at: note.at,
    })
  })

  return events.sort((left, right) => (
    (timestamp(left.at) ?? 0) - (timestamp(right.at) ?? 0)
  ))
}

export function taskHistoryStart(tasks = []) {
  const times = tasks
    .flatMap(historyEventsForTask)
    .map((event) => timestamp(event.at))
    .filter((time) => time != null)
  if (!times.length) return null
  const monday = localLogWeekStartOrdinal(Math.min(...times))
  return localNoonFromOrdinal(monday).toISOString()
}

const isoDate = (value) => {
  const time = timestamp(value)
  if (time == null) return 'Undated'
  const date = new Date(time)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const isoWhen = (value) => {
  const time = timestamp(value)
  if (time == null) return 'Undated'
  const date = new Date(time)
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const offsetHours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const offsetMinutes = String(Math.abs(offset) % 60).padStart(2, '0')
  const timeText = [date.getHours(), date.getMinutes()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
  return `${isoDate(date)} ${timeText} UTC${sign}${offsetHours}:${offsetMinutes}`
}

const noteText = (value) => String(value || '').replace(/\r\n?/g, '\n').replace(/\n/g, '\n  ')

const renderEvent = (event) => {
  const prefix = `- ${isoWhen(event.at)} - `
  if (event.kind === 'created') return `${prefix}${event.actor} created the task.`
  if (event.kind === 'general_note') {
    return `${prefix}${event.actor} added a general note: ${noteText(event.note)}`
  }

  const stage = `[${event.stageLabel}]`
  if (event.action === 'completed') {
    return `${prefix}${stage} ${event.actor} completed the stage.${event.note ? ` Note: ${noteText(event.note)}` : ''}`
  }
  if (event.action === 'reopened') {
    const affected = event.affectedStageLabels?.length > 1
      ? ` This also reopened: ${event.affectedStageLabels.slice(1).join(', ')}.`
      : ''
    return `${prefix}${stage} ${event.actor} reopened the stage.${affected}${event.note ? ` Reason: ${noteText(event.note)}` : ''}`
  }
  return `${prefix}${stage} ${event.actor} added a stage note: ${noteText(event.note)}`
}

const weekRange = (anchor, week) => {
  const start = localLogWeekStartOrdinal(anchor)
  if (start == null) return ''
  const weekStart = start + (week - 1) * WEEK_MS
  const weekEnd = weekStart + 6 * DAY_MS
  const ordinalDate = (ordinal) => new Date(ordinal).toISOString().slice(0, 10)
  return `${ordinalDate(weekStart)} to ${ordinalDate(weekEnd)}`
}

export function buildTaskHistoryMarkdown(tasks = [], { generatedAt = new Date() } = {}) {
  const orderedTasks = [...tasks].sort((left, right) => (
    (timestamp(left.created_at) ?? 0) - (timestamp(right.created_at) ?? 0)
      || String(left.title || '').localeCompare(String(right.title || ''))
  ))
  const events = orderedTasks.flatMap(historyEventsForTask)
  const anchor = taskHistoryStart(orderedTasks)
  const weeks = groupEventsByWeek(events, anchor)
  const lines = [
    '# Research task history',
    '',
    `Generated: ${isoWhen(generatedAt)}`,
    'Calendar: Actual activity grouped Monday through Sunday',
    `Tasks: ${orderedTasks.length}`,
    `Timeline entries: ${events.length}`,
  ]

  if (!orderedTasks.length) return [...lines, '', 'No task history recorded.'].join('\n')

  lines.push('', '## Task index', '')
  orderedTasks.forEach((task) => {
    const details = [
      taskTypeLabel(task.task_type),
      STATUS_LABELS[task.status] || task.status || 'Unknown status',
      `${Math.max(0, Math.min(100, task.progress || 0))}% complete`,
    ]
    if (task.archived) details.push('Archived')
    if (task.assignee_label || task.assignee_uid) {
      details.push(`Assigned to ${task.assignee_label || task.assignee_uid}`)
    }
    lines.push(`- **${task.title || 'Untitled task'}** (${task._id || 'no id'}) - ${details.join('; ')}`)
    if (task.description) lines.push(`  ${noteText(task.description)}`)
  })

  weeks.forEach(({ week, events: weekEvents }) => {
    lines.push('', `## Week ${week}${anchor ? ` - ${weekRange(anchor, week)}` : ''}`)
    const byTask = new Map()
    weekEvents.forEach((event) => {
      const key = event.taskId || event.taskTitle
      if (!byTask.has(key)) byTask.set(key, [])
      byTask.get(key).push(event)
    })
    byTask.forEach((taskEvents) => {
      lines.push('', `### ${taskEvents[0].taskTitle}`, '')
      taskEvents.forEach((event) => lines.push(renderEvent(event)))
    })
  })

  return lines.join('\n')
}

export function buildTaskHistoryAiBriefing(tasks = [], options = {}) {
  return [
    'Prepare an accurate, teacher-facing activity and timesheet reconciliation record from the complete research history below.',
    '',
    'Source-of-truth rules:',
    '- The activity log is canonical. Keep work on the date it actually happened and group log weeks Monday through Sunday.',
    '- Preserve factual details, decisions, sources, caveats, authors, review outcomes, and explicit hour totals.',
    '- Improve clarity and remove repetition, but never invent work, dates, durations, approvals, or conclusions.',
    '- A note timestamp is not proof of hours worked. Use only durations explicitly written in the notes; flag anything missing or ambiguous.',
    '',
    'Timesheet reconciliation rules:',
    '- Timesheet weeks run Sunday through Saturday, with at most 8 reported hours per day and 40 per timesheet week.',
    '- Sunday belongs to the ending Monday-Sunday activity-log week and the starting Sunday-Saturday timesheet week. Always print both date ranges so this boundary is explicit.',
    '- Do not rewrite or move the canonical activity-log entry. Record the corresponding timesheet placement in a separate section.',
    '- Only document the professor-approved reallocation process, and describe every moved block transparently as reporting allocation.',
    '- Write the final document as a record of allocations made, not as advice, options, proposals, or recommendations. Do not label any section "suggested" or "proposed".',
    '- Pair every transfer in past tense. The origin note must name the actual work date, total actual hours, hours moved, and reporting date. The receiving note must name the hours received and original work date.',
    '- Use origin wording like "Of X hours actually worked on YYYY-MM-DD, Y hours were reported on YYYY-MM-DD under the approved cap allocation."',
    '- Use receiving wording like "Received Y reporting hours worked on YYYY-MM-DD; reporting allocation only, with no additional work claimed on this date."',
    '- Put each origin or receiving note directly in the affected date row, in an "Allocation note" column. Do not collect the usable notes only in a section at the bottom.',
    '- The true activity-log table must use: Date | Actual hours | Work performed | Allocation note. Put the moved-out note beside the actual work date.',
    '- The timesheet table must use: Date | Reported hours | Work description | Allocation note. Put the received-hours note beside the reporting date.',
    '- If one date sends or receives multiple blocks, list every paired block in that date row. Keep each note concise and ready to paste into the corresponding timesheet day.',
    '- Never imply the work happened twice or happened on the receiving date.',
    '- Reconcile all transfers: hours sent must equal hours received, with no duplicated or unaccounted hours.',
    '',
    'Return polished Markdown with these sections:',
    '1. True activity log (Monday-Sunday daily table, preserving Week 1, Week 2, and later labels, with inline allocation notes).',
    '2. Timesheet record (Sunday-Saturday daily table with inline allocation notes plus daily and weekly totals).',
    '3. Weekly reconciliation totals (actual hours, reported hours, hours moved out, hours received, and a zero-balance check; no detached duplicate notes).',
    '4. Missing or ambiguous information that needs human confirmation.',
    '',
    '---',
    '',
    buildTaskHistoryMarkdown(tasks, options),
  ].join('\n')
}
