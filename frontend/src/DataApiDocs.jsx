import React, { useState } from 'react'
import { ClipboardIcon, TrashIcon, KeyIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, Stack, Input } from './components/ui'
import { API_BASE_URL } from '@frontend/lib/constants'
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '@frontend/query/hooks/useData'

// API page: token manager on top, the endpoint reference, then ONE large
// copy-pastable briefing that explains the whole data structure — written to
// be handed to an AI assistant (and readable as plaintext) so analysis
// scripts can be written against the live API immediately.

function Code({ children, maxH = null }) {
  const text = typeof children === 'string' ? children : String(children)
  return (
    <div className='surface-card relative'>
      <Button variant='ghost' leadingIcon={ClipboardIcon} className='absolute top-1.5 right-1.5 z-10'
        onClick={() => navigator.clipboard.writeText(text)}>Copy</Button>
      <pre className={`p-3 pr-24 text-[11px] leading-relaxed font-mono overflow-auto whitespace-pre ${maxH || ''}`}>{text}</pre>
    </div>
  )
}

const ENDPOINTS = [
  {
    group: 'Bulk exports — full scoped corpus, one call each',
    rows: [
      ['GET /export/agreements', 'Every agreement in scope, full nested structure.'],
      ['GET /export/receivers', 'One row per receiver with all agreement/group/section context — the unit of analysis for most statistics.'],
      ['GET /export/courses', 'The whole CC course catalog in scope.'],
      ['GET /export/university-courses', 'The whole UC course catalog in scope.'],
    ],
  },
  {
    group: 'Precomputed analyses',
    rows: [
      ['GET /analysis/coverage', 'Per agreement: receivers required/articulated, pct_articulated, fully_articulated.'],
      ['GET /analysis/credit-loss', 'Per agreement: minimal CC course set (+units), many_to_one count, semester_equiv_required, blocked receivers.'],
      ['GET /analysis/choice-cost?schoolIds=7,117', 'Per college: incremental CC courses per additional campus, in order (schoolIds required).'],
      ['GET /analysis/category-gaps', 'Per campus × course category: % of colleges missing articulation (needs curation tags).'],
      ['GET /analysis/complexity', 'Per pathway: prereq delay/blocking factors (needs curated prereqs).'],
      ['GET /analysis/time-to-degree', 'Per curated associate degree × agreement: transfer-credit rate, lost units, cost.'],
      ['GET /analysis/raw/:collection', 'audit_results · curation_* · ref_* working collections.'],
    ],
  },
  {
    group: 'Reference reads',
    rows: [
      ['GET /data/summary', 'Your subset: majors per campus, counts, dataset_version.'],
      ['GET /community-colleges · GET /schools', 'Institutions (id, name).'],
      ['GET /uc-agreements-batch/:ccId?school_id=:ucId', 'One college’s agreements, grouped by campus.'],
      ['GET /audit/doc/:agreementId', 'One agreement + course-name maps + ASSIST link.'],
      ['GET /data/raw-assist/:agreementId', 'The upstream raw ASSIST.org payload.'],
      ['GET /courses/:ccId · GET /university-courses/:ucId', 'Catalog rows for one institution.'],
    ],
  },
]

const briefing = (base) => `PMT RESEARCH API — DATA BRIEFING
Paste this whole block into your AI assistant (with your token) before asking
for analysis scripts. It contains everything needed to use the data correctly.

== CONTEXT ==
The dataset covers California community-college → UC transfer articulation,
parsed from ASSIST.org. It is UC-only and server-scoped: every response covers
exactly the majors this account has been granted. Every JSON response includes
"dataset_version" (CSV responses carry it in the X-Dataset-Version header) —
record it beside any figure or table you produce.

== ACCESS ==
Base URL: ${base}
Every request: header  Authorization: Bearer <token>   (tokens start pmtr_)
All endpoints are GET. JSON by default; /export/* and /analysis/* also accept
?format=csv. JSON list responses look like { dataset_version, n, rows: [...] }.

Example (Python):
    import requests, pandas as pd
    H = {"Authorization": "Bearer pmtr_..."}
    rows = requests.get("${base}/export/receivers", headers=H).json()["rows"]
    receivers = pd.DataFrame(rows)

== CORE CONCEPTS ==
An ARTICULATION AGREEMENT is one document per (community college × UC campus
× major). It lists the campus's requirements for that major and how (or
whether) each one can be satisfied at that college.

The model is RECEIVER-CENTRIC. A receiver is ONE campus-side requirement.
Agreements nest: requirement_groups[] → sections[] → receivers[].

RECEIVER fields:
  receiving              what the campus asks for — one of four kinds:
                           {kind:"course", parent_id}                    a single UC course
                           {kind:"series", parent_ids[], conjunction}    several UC courses ("and"/"or")
                           {kind:"requirement", name}                    free-text rule, no course
                           {kind:"ge_area", code, name}                  a GE area
  articulation_status    "articulated" | "not_articulated"
  not_articulated_reason (when not articulated)
                           "no_course_articulated"       college hasn't articulated it — the real coverage gap
                           "must_take_at_university"     informational; taken after transfer, NOT a gap
                           "never_articulated"           campus never accepts CC equivalents — hard stop
                           "missing_articulation_entry"  parser-internal absence
  options[]              alternative CC paths that satisfy the receiver:
                           each option = { course_ids: [number], course_conjunction: "and"|"or" }
                           "and" ⇒ take ALL courses in the option; "or" ⇒ any ONE
  options_conjunction    across options: "or" ⇒ any one option suffices; "and" ⇒ all options required
  hash_id                stable id of the receiving side (joins curation overlays)

Example receiver — satisfied by course 195603 OR by BOTH 353175 and 353176:
  { "receiving": {"kind":"course","parent_id":292039},
    "articulation_status": "articulated",
    "options": [
      {"course_ids":[195603],        "course_conjunction":"and"},
      {"course_ids":[353175,353176], "course_conjunction":"and"} ],
    "options_conjunction": "or" }

GROUP / SECTION context (matters for "what is actually required"):
  group.is_required          false ⇒ recommended/elective — exclude from strict-requirement stats
  group.group_conjunction    "And"|"Or" — "Or" ⇒ ONE of the group's sections suffices
  group.group_advisement     satisfy any N receivers across the group (overrides section advisements)
  group.group_unit_advisement  satisfy N units across the group (all section advisements null out)
  section.section_advisement satisfy any N receivers in the section (null ⇒ all)
  section.unit_advisement    satisfy N units in the section

== FLAT EXPORT (usually what you want) ==
GET /export/receivers returns one row per receiver with the tree already
flattened onto it:
  agreement_id, school_id, school, community_college_id, community_college,
  major, group_index, is_required, group_conjunction, group_advisement,
  group_unit_advisement, section_index, section_advisement,
  section_unit_advisement, receiver_index, hash_id, kind, receiving_name,
  parent_ids[], ge_code, articulation_status, not_articulated_reason,
  options_conjunction, n_options, options[]
(in CSV, list/object columns are JSON-encoded strings — json.loads them.)

== CATALOGS & JOIN KEYS ==
courses (CC catalog; only courses referenced by in-scope agreements):
  course_id (number), prefix, number, title, units, community_college_id,
  same_as[] (cross-listed equivalents), igetc_area[], csu_ge_area[],
  calgetc_area[], uc_transferable
university_courses (UC catalog):
  parent_id (number, globally unique), prefix, number, title, min_units,
  max_units, department, university_id
Joins:
  options.course_ids[i]        → courses.course_id        (numbers, both sides)
  receiving.parent_id(s)       → university_courses.parent_id
  uc_school_id                 → uc_schools.id  (= university_courses.university_id)
  community_college_id         → community_colleges.id
  agreement _id                → audit_results.doc_id     (human audit verdicts)
  receiver hash_id             → curation_receiver_overrides._id
  university parent_id         → curation_course_categories._id

UC campus ids: Berkeley 79 · Davis 89 · Irvine 120 · UCLA 117 · Merced 144 ·
Riverside 46 · San Diego 7 · Santa Barbara 128 · Santa Cruz 132

== ANALYSIS GUIDANCE ==
Prefer the precomputed /analysis endpoints when they fit; recompute from
/export/receivers only when receiver-level detail is needed.
  Coverage heatmap (college × campus % articulated)  → /analysis/coverage,
    pivot pct_articulated by community_college × school
  Credit loss / minimal course counts                → /analysis/credit-loss
    (min_cc_courses solves option trees with overlap; many_to_one counts
    receivers whose cheapest path needs >1 CC course; semester_equiv_required
    normalizes quarter campuses by 2/3)
  Inter-campus misalignment ("2nd choice adds N")    → /analysis/choice-cost
    with an ordered schoolIds list; iterate permutations for averages
  Course-category gap charts                         → /analysis/category-gaps
  Curricular complexity (delay/blocking)             → /analysis/complexity
  Transfer credit rate / lost units / cost           → /analysis/time-to-degree
Counting coverage yourself: a receiver counts as a gap when
articulation_status == "not_articulated" AND is_required — and consider
excluding reason "must_take_at_university" (it is not a college-side gap).`

/**
 * Top-level API page — the console's programmatic heart, next to Audit and
 * Data. Sub-tabs: Tokens (credentials) · Endpoints (reference) · Data
 * briefing (the one copyable block for humans/AI).
 */
export default function ApiPage() {
  const [tab, setTab] = useState('tokens')
  return (
    <div className='h-full flex flex-col'>
      <div className='shrink-0 flex items-center px-4 h-11 border-b border-border'>
        <Tabs value={tab} onChange={setTab}
          options={[
            { value: 'tokens',    label: 'Tokens' },
            { value: 'endpoints', label: 'Endpoints' },
            { value: 'briefing',  label: 'Data briefing' },
          ]} />
      </div>
      <div className='flex-1 min-h-0 overflow-auto'>
        <div className='mx-auto max-w-screen-md px-6 py-6'>
          <Stack gap='section'>
            <p className='text-caption text-ink-muted'>
              Base URL <span className='font-mono text-ink'>{API_BASE_URL}</span> · header{' '}
              <span className='font-mono text-ink'>Authorization: Bearer &lt;token&gt;</span> ·
              all endpoints GET · <span className='font-mono'>?format=csv</span> on export/analysis
              endpoints · responses scoped to your granted majors, stamped with{' '}
              <span className='font-mono'>dataset_version</span>.
            </p>
            {tab === 'tokens' && <TokenManager />}
            {tab === 'endpoints' && <EndpointsSection />}
            {tab === 'briefing' && <BriefingSection />}
          </Stack>
        </div>
      </div>
    </div>
  )
}

function EndpointsSection() {
  return (
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
  )
}

function BriefingSection() {
  return (
    <section>
      <p className='text-caption text-ink-muted mb-2'>
        The complete data-structure reference as one copyable block — paste it into
        your AI assistant (with a token) and it can start writing analysis scripts
        against the live API.
      </p>
      <Code>{briefing(API_BASE_URL)}</Code>
    </section>
  )
}

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
