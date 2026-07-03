import React, { useState } from 'react'
import { ClipboardIcon, TrashIcon, KeyIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, Stack, Input } from './components/ui'
import { API_BASE_URL } from '@frontend/lib/constants'
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '@frontend/query/hooks/useData'

// API reference — database documentation for programmatic access.
// Order: endpoints → tokens → the full data model.
// All responses are scoped server-side to the caller's granted (school, major)
// subset and carry the dataset_version they were computed from.

function Code({ children }) {
  const text = typeof children === 'string' ? children : String(children)
  return (
    <div className='surface-card relative'>
      <Button variant='ghost' leadingIcon={ClipboardIcon} className='absolute top-1.5 right-1.5 z-10'
        onClick={() => navigator.clipboard.writeText(text)}>Copy</Button>
      <pre className='p-3 pr-24 text-[11px] leading-relaxed font-mono overflow-auto whitespace-pre'>{text}</pre>
    </div>
  )
}

// Field | Type | Description table — the data model's building block.
function FieldTable({ rows }) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-left'>
        <thead>
          <tr className='border-b border-border'>
            <th className='py-1.5 pr-4 text-label whitespace-nowrap'>Field</th>
            <th className='py-1.5 pr-4 text-label whitespace-nowrap'>Type</th>
            <th className='py-1.5 text-label'>Description</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border/60'>
          {rows.map(([field, type, desc]) => (
            <tr key={field} className='align-top'>
              <td className='py-1.5 pr-4 font-mono text-caption text-ink whitespace-nowrap'>{field}</td>
              <td className='py-1.5 pr-4 font-mono text-caption text-ink-subtle whitespace-nowrap'>{type}</td>
              <td className='py-1.5 text-caption text-ink-muted'>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ title, sub, children }) {
  return (
    <div className='surface-card p-4'>
      <p className='text-body-strong font-mono'>{title}</p>
      {sub && <p className='text-caption text-ink-muted mt-0.5 mb-2'>{sub}</p>}
      {children}
    </div>
  )
}

// ───────────────────────────── endpoints ─────────────────────────────

const ENDPOINTS = [
  {
    group: 'Bulk exports — full scoped corpus, one call each',
    rows: [
      ['GET /export/agreements', 'Every agreement in scope, full nested structure.'],
      ['GET /export/receivers', 'One row per receiver: agreement keys, group/section context (is_required, conjunctions, advisements), receiving kind + parent_ids, articulation_status, options. The unit of analysis for most statistics.'],
      ['GET /export/courses', 'The whole CC course catalog in scope.'],
      ['GET /export/university-courses', 'The whole UC course catalog in scope.'],
    ],
  },
  {
    group: 'Precomputed analyses',
    rows: [
      ['GET /analysis/coverage', 'Per agreement: receivers required/articulated, pct_articulated, fully_articulated.'],
      ['GET /analysis/credit-loss', 'Per agreement: minimal CC course set (+units), many_to_one count, semester_equiv_required (quarter-normalized), blocked receivers.'],
      ['GET /analysis/choice-cost?schoolIds=7,117', 'Per college: incremental CC courses for each additional campus, in the given order (schoolIds required).'],
      ['GET /analysis/category-gaps', 'Per campus × canonical course category: % of colleges missing articulation (needs curation tags).'],
      ['GET /analysis/complexity', 'Per agreement pathway: prereq delay/blocking factors, total complexity (needs curated prereqs).'],
      ['GET /analysis/time-to-degree', 'Per curated associate degree × agreement: transfer-credit rate, lost units, estimated cost.'],
      ['GET /analysis/raw/:collection', 'audit_results · curation_course_categories · curation_receiver_overrides · curation_prereqs · curation_assoc_degrees · ref_campus_calendars · ref_tuition · ref_cc_districts · ref_locations'],
    ],
  },
  {
    group: 'Reference reads',
    rows: [
      ['GET /data/summary', 'Your subset: majors per campus, counts, dataset_version.'],
      ['GET /community-colleges', 'All colleges (id, name).'],
      ['GET /schools', 'UC campuses (id, name).'],
      ['GET /uc-agreements-batch/:ccId?school_id=:ucId', 'One college’s agreements, grouped by campus, admissions stats attached.'],
      ['GET /audit/doc/:agreementId', 'One agreement + course-name maps + ASSIST link.'],
      ['GET /data/raw-assist/:agreementId', 'The upstream raw ASSIST.org payload for one agreement.'],
      ['GET /courses/:ccId · GET /university-courses/:ucId', 'Catalog rows for one institution.'],
    ],
  },
]

const RECEIVER_EXAMPLE = `{
  "receiving": { "kind": "course", "parent_id": 292039 },
  "articulation_status": "articulated",
  "not_articulated_reason": null,
  "options": [
    { "course_ids": [195603], "course_conjunction": "and" },
    { "course_ids": [353175, 353176], "course_conjunction": "and" }
  ],
  "options_conjunction": "or",
  "hash_id": "a41f0c…"
}
// Satisfied by course 195603, OR by taking BOTH 353175 and 353176.`

// ───────────────────────────── page ─────────────────────────────

export default function DataApiDocs() {
  return (
    <div className='mx-auto max-w-screen-md'>
      <Stack gap='section'>
        <div>
          <h2 className='text-heading'>API reference</h2>
          <p className='text-caption text-ink-muted mt-1'>
            Base URL <span className='font-mono text-ink'>{API_BASE_URL}</span> · header{' '}
            <span className='font-mono text-ink'>Authorization: Bearer &lt;token&gt;</span> ·
            all endpoints GET · JSON by default, <span className='font-mono'>?format=csv</span> on
            analysis + export endpoints · responses are scoped to your granted majors and include{' '}
            <span className='font-mono'>dataset_version</span>.
          </p>
        </div>

        <section>
          <h3 className='text-body-strong mb-2'>Endpoints</h3>
          <Stack gap='comfortable'>
            {ENDPOINTS.map((g) => (
              <div key={g.group} className='surface-card p-4'>
                <p className='text-label mb-2'>{g.group}</p>
                <div className='divide-y divide-border/60'>
                  {g.rows.map(([sig, desc]) => (
                    <div key={sig} className='py-2'>
                      <p className='font-mono text-caption text-ink'>{sig}</p>
                      <p className='text-caption text-ink-muted mt-0.5'>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Stack>
        </section>

        <TokenManager />
        <DataModel />
      </Stack>
    </div>
  )
}

// ───────────────────────────── data model ─────────────────────────────

function DataModel() {
  return (
    <section>
      <h3 className='text-body-strong mb-2'>Data model</h3>
      <Stack gap='comfortable'>
        <Section title='uc_agreements'
          sub='One document per (community college × UC campus × major) articulation agreement. The model is receiver-centric: each UC-side requirement is a receiver carrying the CC-side paths that satisfy it.'>
          <FieldTable rows={[
            ['_id', 'string', 'Agreement id (ObjectId as string in exports). audit_results.doc_id references it.'],
            ['uc_school_id', 'number', 'ASSIST institution id of the campus (see uc_schools table below).'],
            ['uc_school', 'string', 'Campus name, e.g. "UC San Diego".'],
            ['community_college_id', 'number', 'ASSIST institution id of the college.'],
            ['community_college', 'string', 'College name.'],
            ['major', 'string', 'Major name as published on ASSIST, e.g. "CSE: Computer Science B.S.".'],
            ['major_id', 'string', 'ASSIST major UUID — used for ASSIST deep links and the raw API.'],
            ['requirement_groups', 'RequirementGroup[]', 'The requirement tree: groups → sections → receivers.'],
          ]} />
        </Section>

        <Section title='RequirementGroup'
          sub='A block of requirements. Position relative to ASSIST’s "Recommended" marker determines is_required.'>
          <FieldTable rows={[
            ['is_required', 'boolean', 'false ⇒ recommended/elective — exclude from "strictly required" analyses.'],
            ['group_conjunction', "'And' | 'Or'", "How the group's sections relate: 'Or' ⇒ satisfying ONE section satisfies the group."],
            ['group_advisement', 'number | null', 'Satisfy N receivers across the whole group (overrides section advisements).'],
            ['group_unit_advisement', 'number | null', 'Satisfy N units across the group. When set, all section-level advisements are null.'],
            ['sections', 'Section[]', 'The group’s sections.'],
          ]} />
        </Section>

        <Section title='Section'>
          <FieldTable rows={[
            ['section_advisement', 'number | null', 'Satisfy any N receivers in this section (null ⇒ all).'],
            ['unit_advisement', 'number | null', 'Satisfy receivers totalling N units. When set, section_advisement is null.'],
            ['receivers', 'Receiver[]', 'The individual UC requirements.'],
          ]} />
        </Section>

        <Section title='Receiver'
          sub='One UC requirement + how (or whether) it articulates. THE unit of analysis — /export/receivers serves these flattened with all parent context attached.'>
          <FieldTable rows={[
            ['receiving', 'ReceivingPayload', 'What the UC side asks for — one of four kinds, below.'],
            ['articulation_status', "'articulated' | 'not_articulated'", 'Whether any CC path exists at this college.'],
            ['not_articulated_reason', 'enum | null', 'Normalized reason when not articulated — see enum below.'],
            ['options', 'Option[]', 'Alternative CC paths. Empty when not articulated.'],
            ['options_conjunction', "'and' | 'or'", "How options combine: 'or' ⇒ any one option suffices; 'and' ⇒ every option must be satisfied."],
            ['hash_id', 'string', 'Stable hash of the receiving side — the join key for curation_receiver_overrides.'],
          ]} />
          <p className='text-label mt-3 mb-1'>ReceivingPayload — the four kinds</p>
          <FieldTable rows={[
            ["kind: 'course'", '{ parent_id: number }', 'A single UC course. Join parent_id → university_courses.'],
            ["kind: 'series'", '{ name?, conjunction, parent_ids: number[] }', "Multiple UC courses bundled ('and'/'or' per conjunction)."],
            ["kind: 'requirement'", '{ name: string }', 'Free-text rule with no specific UC course.'],
            ["kind: 'ge_area'", '{ code, name }', 'A general-education area requirement.'],
          ]} />
          <p className='text-label mt-3 mb-1'>Option — one CC path</p>
          <FieldTable rows={[
            ['course_ids', 'number[]', 'CC courses in this path. Join → courses.course_id.'],
            ['course_conjunction', "'and' | 'or'", "'and' ⇒ take ALL listed courses; 'or' ⇒ any ONE of them."],
          ]} />
          <p className='text-label mt-3 mb-1'>not_articulated_reason values</p>
          <FieldTable rows={[
            ['must_take_at_university', 'reason', 'Must be taken at the university after transfer (informational, not a gap).'],
            ['no_course_articulated', 'reason', 'The college has not articulated this requirement — the classic coverage gap.'],
            ['never_articulated', 'reason', 'The campus excludes CC equivalents for this requirement (hard stop).'],
            ['missing_articulation_entry', 'reason', 'No articulation entry in the ASSIST response at all (parser-internal).'],
          ]} />
          <p className='text-label mt-3 mb-1'>Example</p>
          <Code>{RECEIVER_EXAMPLE}</Code>
        </Section>

        <Section title='courses'
          sub='Community-college catalog — restricted to courses referenced by the agreements in scope.'>
          <FieldTable rows={[
            ['course_id', 'number', 'ASSIST course id — what options.course_ids reference. Numeric since the 2026-07 parser update.'],
            ['prefix · number', 'string', 'e.g. "MATH" · "1A".'],
            ['title', 'string', 'Course title.'],
            ['units', 'number', 'Minimum units.'],
            ['community_college_id', 'number', 'Owning college.'],
            ['same_as', 'object[]', 'Cross-listed equivalents at the same college ({course_id, prefix, number, title, units}).'],
            ['igetc_area · csu_ge_area · calgetc_area', 'string[]', 'GE-area memberships.'],
            ['uc_transferable', 'boolean', 'UC transferability flag.'],
          ]} />
        </Section>

        <Section title='university_courses' sub='UC-side catalog — the receiving courses.'>
          <FieldTable rows={[
            ['parent_id', 'number', 'ASSIST id — what receiving.parent_id(s) reference. Globally unique.'],
            ['prefix · number', 'string', 'e.g. "CSE" · "8A".'],
            ['title', 'string', 'Course title.'],
            ['min_units · max_units', 'number', 'Unit range.'],
            ['department', 'string', 'Owning department.'],
            ['university_id', 'number', 'Back-reference to uc_schools.id.'],
            ['begin · end', 'string', 'ASSIST effective terms, e.g. "F2007".'],
          ]} />
        </Section>

        <Section title='community_colleges · uc_schools' sub='Institutions: { id: number, name: string }. Campus ids:'>
          <FieldTable rows={[
            ['UC Berkeley', '79', ''], ['UC Davis', '89', ''], ['UC Irvine', '120', ''],
            ['UC Los Angeles', '117', ''], ['UC Merced', '144', ''], ['UC Riverside', '46', ''],
            ['UC San Diego', '7', ''], ['UC Santa Barbara', '128', ''], ['UC Santa Cruz', '132', ''],
          ]} />
        </Section>

        <Section title='audit_results' sub='Human audit verdicts (via /analysis/raw/audit_results) — one row per judged agreement.'>
          <FieldTable rows={[
            ['doc_id', 'string', 'The judged agreement’s _id.'],
            ['result', "'correct' | 'conservative' | 'error' | 'flagged'", 'The verdict tier. "conservative" = we ask for more than ASSIST (never under-prepares).'],
            ['system · uc_school_id · uc_school · major', 'mixed', 'Denormalized agreement identity.'],
            ['receivers_checked · cells_in_error', 'number', 'Audit bookkeeping for the error-rate confidence intervals.'],
            ['notes · verifier_uid · verified_at', 'mixed', 'Free-text notes + provenance.'],
            ['dataset_version · verdict_origin', 'string', "Which snapshot was judged; 'research' marks this console's verdicts."],
          ]} />
        </Section>

        <Section title='Join keys' sub='How the collections connect.'>
          <FieldTable rows={[
            ['options.course_ids[i]', '→ courses.course_id', 'CC side of an articulation path.'],
            ['receiving.parent_id / parent_ids[i]', '→ university_courses.parent_id', 'UC side of a requirement.'],
            ['uc_school_id', '→ uc_schools.id', 'Campus identity (also university_courses.university_id).'],
            ['community_college_id', '→ community_colleges.id', 'College identity (also courses.community_college_id).'],
            ['agreement _id', '→ audit_results.doc_id', 'Verdicts per agreement.'],
            ['receiver hash_id', '→ curation_receiver_overrides._id', 'Human judgment overlays (exclude / categorize).'],
            ['university parent_id', '→ curation_course_categories._id', 'Canonical course-category tags.'],
          ]} />
        </Section>
      </Stack>
    </section>
  )
}

// ───────────────────────────── tokens ─────────────────────────────

function TokenManager() {
  const list = useApiTokens()
  const create = useCreateApiToken()
  const revoke = useRevokeApiToken()
  const [label, setLabel] = useState('')
  const [freshToken, setFreshToken] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const res = await create.mutateAsync(label)
    setFreshToken(res.token)
    setLabel('')
  }

  return (
    <section>
      <h3 className='text-body-strong mb-2'>Tokens</h3>
      <div className='surface-card p-4'>
        <Stack gap='cozy'>
          <form onSubmit={submit} className='flex flex-wrap items-center gap-2'>
            <Input className='w-64' value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder='Label (e.g. "analysis notebook")' />
            <Button type='submit' leadingIcon={KeyIcon} disabled={create.isPending}>
              {create.isPending ? 'Generating…' : 'Generate token'}
            </Button>
          </form>
          {create.isError && <Alert type='error'>{create.error?.response?.data?.error || 'Could not create the token.'}</Alert>}
          {freshToken && (
            <Alert type='success'>
              <div className='flex items-center gap-2 flex-wrap'>
                <span>Copy it now — it won't be shown again:</span>
                <span className='font-mono text-caption break-all'>{freshToken}</span>
                <Button variant='ghost' leadingIcon={ClipboardIcon}
                  onClick={() => navigator.clipboard.writeText(freshToken)}>Copy</Button>
              </div>
            </Alert>
          )}
          {list.isLoading ? <Spinner /> : (
            <div className='divide-y divide-border/60'>
              {(list.data?.tokens || []).map((t) => (
                <div key={t.id} className='py-2 flex items-center gap-3'>
                  <div className='min-w-0'>
                    <p className='text-body'>{t.label || 'unlabeled token'}</p>
                    <p className='text-caption text-ink-subtle'>
                      created {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                      {t.last_used_at ? ` · last used ${new Date(t.last_used_at).toLocaleString()}` : ' · never used'}
                    </p>
                  </div>
                  <Button variant='ghost' className='ml-auto' leadingIcon={TrashIcon}
                    onClick={() => revoke.mutate(t.id)} disabled={revoke.isPending}>Revoke</Button>
                </div>
              ))}
              {!(list.data?.tokens || []).length && (
                <p className='text-caption text-ink-subtle py-1'>No tokens yet.</p>
              )}
            </div>
          )}
        </Stack>
      </div>
    </section>
  )
}
