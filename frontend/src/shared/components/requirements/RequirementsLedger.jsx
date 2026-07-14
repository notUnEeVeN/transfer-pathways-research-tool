import React from 'react'
import { ArrowNarrowLeft } from '@untitledui-pro/icons/duotone';
import Stack from '@/components/ui/layout/Stack'
import CompletionCheck from '@/components/ui/display/CompletionCheck'
import SectionCard from '@/components/ui/display/SectionCard'
import { isReceiverCompleted, isCourseCompleted, isGroupCompleted, getGroupDisplayStat } from '../../lib/eligibility'
import {
  notArticulatedCopy,
  unitText,
  sectionRule,
  sectionStatus,
  groupRule,
  sectionHidden
} from './ledgerText'

/**
 * ASSIST-style requirements renderer, shared by the major modal and the
 * internal audit console.
 *
 *   group (Required / Recommended)  ── full-height bracket spine + heading + advisement
 *     └─ section  ── tinted instruction header + status
 *          └─ row  ── [university requirement]  ←  [satisfied by (CC courses)]
 *                     with bracketed AND / OR groups, completion-tinted
 *
 * Mirrors how assist.org presents agreements (two columns, an arrow, AND/OR
 * brackets) but uses our tokens, type, and dark-mode-aware surfaces. Completion
 * math is delegated to lib/eligibility.
 *
 * Pass `preserveOrder` (audit) to render groups in parser/ASSIST order; the
 * default sorts required-first (modal).
 */

// ---------------------------------------------------------------------------
// Course atoms
// ---------------------------------------------------------------------------

// `mark` opts a course into a per-course completion affordance: a small green
// check when it's individually done, else a same-width spacer so codes in a
// bracket stay left-aligned. The sending (CC) side sets it — those are the
// courses the student actually completes; the receiving side relies on the
// row-level satisfied check and just tints its text.
// Opt-in: when a toggle handler is provided (the desktop eligibility-simulation
// tool), CC courses render an interactive checkbox. null on the website (and by
// default), so behavior there is unchanged — no checkbox.
const ToggleCourseCtx = React.createContext(null)

// Opt-in row marking (audit Judge tool): when the parent passes both
// `markedRows` (a Set of `${groupIdx}-${sectionIdx}-${rowIdx}` keys) and
// `onMarkRow(rowKey)`, every requirement row becomes a click target that
// toggles an "in error" mark. null by default (website + reference views), so
// rows render exactly as before — no click target, no chip, no wash.
const MarkRowCtx = React.createContext(null)

function CourseItem({ code, title, units, done, mark = false }) {
  return (
    <div className='min-w-0'>
      <div className='flex items-baseline gap-2'>
        {mark &&
          (done ? (
            <CompletionCheck size='sm' className='self-center' label={`${code} complete`} />
          ) : (
            <span className='w-3.5 h-3.5 shrink-0' aria-hidden />
          ))}
        {/* The course code is a label, not a figure — let the warm grotesque carry
            it. Weight (not a clinical mono) marks it as the identifier; done tints
            it to the success ink. */}
        <span className={`text-[14px] font-bold tabular tracking-[.01em] shrink-0 ${done ? 'text-success' : 'text-ink'}`}>{code}</span>
        {units && (
          <span className='inline-flex items-center px-1.5 py-px rounded-[6px] bg-surface-sunken text-ink-muted text-[11px] font-[650] shrink-0'>
            {units}
          </span>
        )}
      </div>
      {title && <p className='text-[13px] text-ink-muted mt-0.5'>{title}</p>}
    </div>
  )
}

// Groups course items with an AND/OR badge, echoing ASSIST's "[" bracket. The
// badge lives in its own left gutter (not overlapping the text), and nested
// brackets simply add another gutter. The gutter is ALWAYS reserved — even for
// a single item, where the bracket line/badge are omitted — so single courses
// line up with conjuncted ones instead of sitting flush-left.
function Bracket({ conj, children }) {
  const items = React.Children.toArray(children)
  const multi = items.length > 1
  const word = (conj || 'and').toUpperCase()
  return (
    <div className='flex items-stretch'>
      <div className='relative shrink-0 w-11'>
        {multi && (
          <>
            {/* The articulation bracket — a formal "[" spanning the conjuncted
                courses, drawn in the strong stone hairline so AND/OR grouping
                reads as structure, not decoration. */}
            <span
              aria-hidden
              className='absolute left-1/2 -translate-x-1/2 top-1.5 bottom-1.5 w-2 border-y-2 border-l-2 border-border-strong/60 rounded-l-md'
            />
            {/* badge masks the line at its midpoint, like ASSIST */}
            <span className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center h-4 px-1.5 rounded-[6px] bg-surface border border-border-strong/60 text-ink-muted text-xs font-medium'>
              {word}
            </span>
          </>
        )}
      </div>
      <div className='flex-1 min-w-0 flex flex-col gap-3'>{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// University (receiving) side
// ---------------------------------------------------------------------------

function ReceivingSide({ receiving, universityCoursesById, done }) {
  const lookup = (pid) => universityCoursesById?.[pid] || universityCoursesById?.[String(pid)]

  if (receiving.kind === 'series') {
    return (
      <Bracket conj={receiving.conjunction || 'and'}>
        {(receiving.parent_ids || []).map((pid) => {
          const uc = lookup(pid)
          return (
            <CourseItem
              key={pid}
              code={uc ? `${uc.prefix} ${uc.number}` : `#${pid}`}
              title={uc?.title}
              units={uc ? unitText(uc.min_units, uc.max_units) : null}
              done={done}
            />
          )
        })}
      </Bracket>
    )
  }

  // Single items still go through Bracket (1 child) so they align with the
  // conjuncted (bracketed) rows rather than sitting flush-left.
  let item
  if (receiving.kind === 'course') {
    const uc = lookup(receiving.parent_id)
    item = (
      <CourseItem
        code={uc ? `${uc.prefix} ${uc.number}` : `#${receiving.parent_id}`}
        title={uc?.title}
        units={uc ? unitText(uc.min_units, uc.max_units) : null}
        done={done}
      />
    )
  } else if (receiving.kind === 'ge_area') {
    item = <CourseItem code={`GE${receiving.code ? ` ${receiving.code}` : ''}`} title={receiving.name} done={done} />
  } else {
    item = <CourseItem code='Requirement' title={receiving.name} done={done} />
  }
  return <Bracket>{item}</Bracket>
}

// ---------------------------------------------------------------------------
// Community-college (sending) side
// ---------------------------------------------------------------------------

// A single CC course, marked complete on its own merits (it's in the student's
// transcript with a credit-earning grade or a same-as peer is) — independent of
// whether the whole AND/OR option it sits in is satisfied yet.
function CcCourse({ id, courses, userCourses, mark }) {
  const c = (courses || []).find((cc) => cc.course_id === id)
  const onToggle = React.useContext(ToggleCourseCtx)
  const done = isCourseCompleted(id, userCourses)
  const item = (
    <CourseItem
      code={c ? `${c.prefix} ${c.number}` : `#${id}`}
      title={c?.title}
      units={c?.units != null ? `${c.units}u` : null}
      done={done}
      mark={mark}
    />
  )
  if (!onToggle || id == null) return item
  // Interactive (desktop sim): tick to simulate the student having taken this CC
  // course. The checkbox is pinned to the RIGHT so it never shifts the course
  // code/prefix off the shared left alignment that non-interactive rows use.
  return (
    // stopPropagation: when the row is a mark target (audit Judge), a click
    // anywhere in this label — checkbox included — simulates the plan, never
    // marks the row in error.
    <label className='flex items-start gap-2 cursor-pointer' onClick={(e) => e.stopPropagation()}>
      <div className='min-w-0 flex-1'>{item}</div>
      <input
        type='checkbox'
        checked={done}
        onChange={() => onToggle(id)}
        className='mt-1 shrink-0 accent-primary cursor-pointer'
        title='Simulate having taken this course'
      />
    </label>
  )
}

// One option's CC courses: a single course renders bare; multiple courses get
// an AND bracket. The alignment gutter for a *lone* option is added by the
// caller, so a single course isn't double-indented inside its own bracket.
function OptionContent({ option, courses, userCourses, mark }) {
  const ids = option.course_ids || []
  if (ids.length <= 1) return <CcCourse id={ids[0]} courses={courses} userCourses={userCourses} mark={mark} />
  return (
    <Bracket conj={option.course_conjunction || 'and'}>
      {ids.map((id) => (
        <CcCourse key={id} id={id} courses={courses} userCourses={userCourses} mark={mark} />
      ))}
    </Bracket>
  )
}

// How many CC course atoms the sending side will render. A receiver satisfied by
// a single lone course needs no per-course check — the row's "Requirement
// satisfied" mark already says it, so a course-level check would just be a
// redundant second tick. Per-course checks only earn their keep when there are
// siblings (an AND/OR, possibly nested) to disambiguate which ones are done.
function sendingCourseCount(receiver) {
  const optionCourses = (opts) => (opts || []).reduce((n, o) => n + (o.course_ids || []).length, 0)
  if (receiver.cell_groups && receiver.cell_groups.length > 0) {
    return receiver.cell_groups.reduce((n, cell) => n + optionCourses(cell.options), 0)
  }
  return optionCourses(receiver.options)
}

function SendingSide({ receiver, courses, userCourses, mark }) {
  // Series with per-cell options: cells ANDed, options within a cell ORed.
  if (receiver.cell_groups && receiver.cell_groups.length > 0) {
    return (
      <Bracket conj='and'>
        {receiver.cell_groups.map((cell, ci) => {
          const opts = cell.options || []
          if (opts.length <= 1) {
            return (
              <OptionContent
                key={ci}
                option={opts[0] || { course_ids: [] }}
                courses={courses}
                userCourses={userCourses}
                mark={mark}
              />
            )
          }
          return (
            <Bracket key={ci} conj={cell.options_conjunction || 'or'}>
              {opts.map((opt, oi) => (
                <OptionContent key={oi} option={opt} courses={courses} userCourses={userCourses} mark={mark} />
              ))}
            </Bracket>
          )
        })}
      </Bracket>
    )
  }

  const options = receiver.options || []
  // One option: bracket only if it's an AND of several courses; a lone course
  // gets a single phantom gutter so it lines up with bracketed rows.
  if (options.length <= 1) {
    const opt = options[0] || { course_ids: [] }
    const content = <OptionContent option={opt} courses={courses} userCourses={userCourses} mark={mark} />
    return (opt.course_ids || []).length <= 1 ? <Bracket>{content}</Bracket> : content
  }
  // Multiple options (OR): one OR gutter; single-course options sit bare inside
  // it (depth reflects real nesting, not one gutter per alternative).
  return (
    <Bracket conj={receiver.options_conjunction || 'or'}>
      {options.map((opt, i) => (
        <OptionContent key={i} option={opt} courses={courses} userCourses={userCourses} mark={mark} />
      ))}
    </Bracket>
  )
}

function CategoryMatch({ match }) {
  const areas = (match.areas || []).join(', ')
  if (match.assumed) {
    return (
      <div className='min-w-0'>
        <p className='text-[14px] font-semibold text-ink'>Qualifying community-college course</p>
        <p className='text-[13px] text-ink-muted mt-0.5'>Available across community colleges; verify the approved local course.</p>
      </div>
    )
  }

  return (
    <div className='min-w-0'>
      <p className='text-[14px] font-semibold text-ink'>
        {match.qualifying_count == null
          ? 'Eligible course category'
          : `${match.qualifying_count} qualifying ${match.qualifying_count === 1 ? 'course' : 'courses'}`}
      </p>
      <p className='text-[13px] text-ink-muted mt-0.5'>
        {areas ? `UC-transferable courses tagged for IGETC ${areas}` : 'Approved UC-transferable breadth courses'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Receiver row — requirement  ←  satisfied by
// ---------------------------------------------------------------------------

function ReceiverRow({ receiver, ctx, rowKey }) {
  const { courses, userCourses, crossCc, universityCoursesById } = ctx
  const completed = ctx.showCompletion && isReceiverCompleted(receiver, userCourses, crossCc)
  const notArt = receiver.articulation_status === 'not_articulated'
  const hasOptions = (receiver.options || []).length > 0 || (receiver.cell_groups || []).length > 0
  const unavailable = !completed && (notArt || !hasOptions)
  // A stored template (no college context yet): articulation was never stamped,
  // so there is no sending side to speak of — leave the right column blank
  // rather than claiming "no course articulates".
  const unstamped = receiver.articulation_status == null && !hasOptions

  // Opt-in row marking (audit Judge). When absent (the default everywhere else),
  // `mark` is null and the row renders byte-identically to before: same wrapper
  // class, no onClick, no wash, no chip.
  const mark = React.useContext(MarkRowCtx)
  const marked = !!mark && mark.markedRows.has(rowKey)
  const baseRowClass = 'grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] gap-2 items-center px-5 py-3.5'
  const rowProps = mark
    ? {
        className: `${baseRowClass} cursor-pointer`,
        onClick: () => mark.onMarkRow(rowKey),
        ...(marked ? { style: { background: 'var(--color-danger-soft)', boxShadow: 'inset 3px 0 0 var(--color-danger-bright)' } } : {}),
      }
    : { className: baseRowClass }
  // The left (university requirement) cell, optionally footnoted with the
  // MARKED IN ERROR chip. Unmarked (or ctx-absent) → the bare ReceivingSide, so
  // no wrapper is introduced on the default path.
  const leftCell = (done) => {
    const receiving = (
      <ReceivingSide receiving={receiver.receiving} universityCoursesById={universityCoursesById} done={done} />
    )
    if (!marked) return receiving
    return (
      <div className='min-w-0 flex flex-col'>
        {receiving}
        <span className='inline-block mt-1.5 self-start text-[10.5px] font-bold tracking-[.05em] uppercase text-danger bg-danger-soft rounded-pill px-2.5 py-[2.5px]'>
          Marked in error
        </span>
      </div>
    )
  }

  // Category requirements stand for an entire catalog subset, not a short OR
  // list. Show the category and its full qualifying count on the sending side.
  if (receiver.category_match) {
    return (
      <div {...rowProps}>
        {leftCell(false)}
        <div className='flex justify-center'><ArrowNarrowLeft className='w-5 h-5 text-ink-subtle' /></div>
        <CategoryMatch match={receiver.category_match} />
      </div>
    )
  }

  if (unstamped) {
    return (
      <div {...rowProps}>
        {leftCell(false)}
        <span aria-hidden />
        <span aria-hidden />
      </div>
    )
  }

  return (
    <div {...rowProps}>
      {leftCell(completed)}
      <div className='flex justify-center'>
        {completed ? (
          <CompletionCheck label='Requirement satisfied' />
        ) : (
          <ArrowNarrowLeft className='w-5 h-5 text-ink-subtle' />
        )}
      </div>
      {unavailable ? (
        // Advisory, not a course path — italic + subtle ink sets it apart from
        // the satisfied-by codes so "take at the university" reads as a note.
        <span className='text-sm italic text-ink-subtle'>{notArticulatedCopy(receiver, notArt)}</span>
      ) : (
        <SendingSide
          receiver={receiver}
          courses={courses}
          userCourses={userCourses}
          mark={sendingCourseCount(receiver) > 1}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section card (numbered, ASSIST-style) + group
// ---------------------------------------------------------------------------
// Section/group rule + status text live in ledgerText.js (pure, golden-locked).

function RequirementSection({ section, group, ctx, soleStat, pooled, groupComplete, groupIdx, sectionIdx }) {
  const { userCourses, crossCc } = ctx
  const receivers = section.receivers || []
  // Once the whole group is satisfied, every section in it reads as done — even
  // ones not individually complete (e.g. unused buckets of a pooled "complete N
  // courses across the sections" group). Exception: a section with nothing
  // articulated stays grey — there's nothing here to mark as done.
  const natural = sectionStatus(section, group, userCourses, crossCc, soleStat, pooled)
  const isUnstampedTemplate = receivers.length > 0 && receivers.every(
    (receiver) => receiver.articulation_status == null
  )
  // With completion display off, only the greyed nothing-at-a-CC state survives;
  // vacuous "done" (auto-satisfied because nothing articulates) never shows.
  // An unstamped template has no college context yet, so lack of options is
  // neutral rather than evidence that the requirement cannot articulate.
  const status = !ctx.showCompletion
    ? (natural.kind === 'none' && !isUnstampedTemplate ? natural : { kind: 'progress' })
    : groupComplete && natural.kind !== 'none' ? { kind: 'done' } : natural
  const done = status.kind === 'done'
  // Nothing actionable at a CC — grey the whole section and footnote it.
  const greyed = status.kind === 'none'
  const rule = sectionRule(section, group, receivers, soleStat, pooled)

  // The shared SectionCard owns the rail + tinted header + divided body; we only
  // pick the tone and supply the instruction header, done check, and footnote.
  return (
    <SectionCard
      tone={done ? 'success' : greyed ? 'muted' : 'primary'}
      header={section.title || rule ? (
        <span className='flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 min-w-0'>
          {section.title && <span className='text-[13px] font-[650]'>{section.title}</span>}
          {rule && <span className={`text-[13px] font-[650] ${section.title ? 'ml-auto' : ''}`}>{rule}</span>}
        </span>
      ) : null}
      headerMark={done ? <CompletionCheck /> : null}
    >
      {receivers.map((r, i) => (
        <ReceiverRow key={i} receiver={r} ctx={ctx} rowKey={`${groupIdx}-${sectionIdx}-${i}`} />
      ))}
    </SectionCard>
  )
}

function Group({ group, ctx, showMissing, groupIdx }) {
  const { userCourses, crossCc } = ctx
  const groupComplete = ctx.showCompletion && isGroupCompleted(group, userCourses, crossCc)
  const sections = group.sections || []

  const visible = sections
    .map((s, i) => ({ section: s, index: i }))
    .filter(({ section }) => !sectionHidden(section, group, showMissing, userCourses, crossCc))
  if (visible.length === 0) return null

  // One uniform statement of how the sections combine — no per-card AND/OR
  // connectors that could contradict it. Sections that are auto-satisfied
  // (non-articulated) don't count as a real choice, so they're excluded from
  // the "you don't need them all" callout.
  const stat = getGroupDisplayStat(group, userCourses, crossCc)
  const notNeededCount = sections.filter((s) => sectionStatus(s, group, userCourses, crossCc).kind === 'none').length
  const ruleLine = groupRule(group, stat, sections.length, notNeededCount)
  // A pooled group advisement ("Complete N courses across the sections below")
  // means the sections are buckets — tells each section to soften its wording.
  const pooled = sections.length > 1 && stat.label !== 'section' && stat.label !== 'sections'

  // Group spine: the inner Bracket's shape one weight rank up — a closed "["
  // running the group's full height, so header + sections read as one
  // bracketed unit. The tone restates the heading word — success-green once
  // satisfied (matching the completion check), a strong stone hairline for
  // required, a soft hairline for recommended — it never replaces it.
  const spineTone = groupComplete
    ? 'border-success/40'
    : group.is_required
      ? 'border-border-strong/60'
      : 'border-border'

  return (
    <section className='flex'>
      <div className='relative w-6 shrink-0' aria-hidden>
        {/* top-2 tucks the top tick under the heading's cap height */}
        <span className={`absolute left-0 top-2 bottom-0 w-2 rounded-l-md border-l-2 border-y-2 ${spineTone}`} />
      </div>
      <Stack gap='cozy' className='flex-1 min-w-0'>
        <Stack gap='tight'>
          <div className='flex items-center gap-2'>
            {/* A group `title` (degree/comparison views) replaces the generic
                Required/Recommended heading; agreements have no title so they
                keep the original wording. */}
            <h3 className='text-[21px] font-[650] tracking-[-.01em] text-ink'>{group.title || (group.is_required ? 'Required' : 'Recommended')}</h3>
            {groupComplete && <CompletionCheck />}
          </div>
          {ruleLine && <p className='text-[13px] text-ink-subtle font-medium'>{ruleLine}</p>}
        </Stack>
        <div className='flex flex-col gap-3'>
          {visible.map(({ section, index }) => (
            <RequirementSection
              key={index}
              section={section}
              group={group}
              ctx={ctx}
              soleStat={sections.length === 1 ? stat : null}
              pooled={pooled}
              groupComplete={groupComplete}
              groupIdx={groupIdx}
              sectionIdx={index}
            />
          ))}
        </div>
      </Stack>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

export default function RequirementsLedger({
  major,
  courses = [],
  userCourses = [],
  crossCc = [],
  universityCoursesById = null,
  showMissing = false,
  preserveOrder = false,
  onToggleCourse = null,
  // Audit row-marking (Judge). Both must be present to arm it: `markedRows` is
  // a Set of `${groupIdx}-${sectionIdx}-${rowIdx}` keys, `onMarkRow(key)`
  // toggles one. Absent on the website and reference views — rows stay inert.
  markedRows = null,
  onMarkRow = null,
  // Completion affordances (green checks, success tint) come from the PMT
  // eligibility engine, which treats requirements nothing articulates as
  // vacuously satisfied. Right for a student plan; misleading in reference
  // views with no student — those pass false to render plain.
  showCompletion = true
}) {
  if (!major || !Array.isArray(major.requirement_groups)) return null

  // Audit renders in parser/ASSIST order; the modal sorts required-first.
  const groups = preserveOrder
    ? major.requirement_groups
    : [...major.requirement_groups].sort((a, b) => (a.is_required === b.is_required ? 0 : a.is_required ? -1 : 1))

  const ctx = { courses, userCourses, crossCc, universityCoursesById, showCompletion }

  const cards = groups
    .filter((g) => !(showMissing && (!g.is_required || isGroupCompleted(g, userCourses, crossCc))))
    .map((group, i) => <Group key={i} group={group} ctx={ctx} showMissing={showMissing} groupIdx={i} />)
    .filter(Boolean)

  if (cards.length === 0) {
    return <p className='text-sm text-ink-muted'>Nothing left — every required group is satisfied.</p>
  }

  // Arm row-marking only when the caller wires up BOTH halves; otherwise the
  // context stays null and ReceiverRow renders inert (default everywhere else).
  const markRowValue = markedRows && onMarkRow ? { markedRows, onMarkRow } : null

  return (
    <MarkRowCtx.Provider value={markRowValue}>
      <ToggleCourseCtx.Provider value={onToggleCourse}>
        <Stack gap='section'>{cards}</Stack>
      </ToggleCourseCtx.Provider>
    </MarkRowCtx.Provider>
  )
}
