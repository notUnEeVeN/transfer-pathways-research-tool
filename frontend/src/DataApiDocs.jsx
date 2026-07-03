import React, { useState } from 'react'
import { ClipboardIcon, TrashIcon, KeyIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, Stack, Input } from './components/ui'
import { API_BASE_URL } from '@frontend/lib/constants'
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '@frontend/query/hooks/useData'

// API reference — plain database documentation. Auth, data model, endpoints.
// All responses are scoped server-side to the caller's granted (school,
// major) subset and carry the dataset_version they were computed from.

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

const DATA_MODEL = `Collections (UC-only; ids are numeric unless noted)

uc_agreements          one doc per (community college × UC campus × major)
  _id                  string (ObjectId)
  uc_school_id, uc_school, community_college_id, community_college
  major, major_id      major_id = ASSIST UUID (string)
  requirement_groups[] group → sections[] → receivers[]
    group:    is_required, group_conjunction ('And'|'Or'),
              group_advisement (satisfy N receivers), group_unit_advisement
    section:  section_advisement, unit_advisement
    receiver: one UC requirement
      receiving          {kind:'course', parent_id} | {kind:'series', parent_ids[], conjunction}
                         | {kind:'requirement', name} | {kind:'ge_area', code, name}
      articulation_status  'articulated' | 'not_articulated' (+ not_articulated_reason)
      options[]            alternative CC paths: {course_ids[], course_conjunction 'and'|'or'}
      options_conjunction  'and'|'or' across options
      hash_id              stable hash of the receiving side

courses                CC catalog (referenced by the agreements in scope)
  course_id (number), prefix, number, title, units, community_college_id, same_as[]

university_courses     UC catalog
  parent_id (number), prefix, number, title, min_units, max_units, department, university_id

community_colleges / uc_schools    { id, name }`

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

const pythonSnippet = (base) => `import io, requests, pandas as pd

BASE = "${base}"
H = {"Authorization": "Bearer pmtr_..."}   # your token

receivers = pd.DataFrame(requests.get(f"{BASE}/export/receivers", headers=H).json()["rows"])
coverage  = pd.DataFrame(requests.get(f"{BASE}/analysis/coverage", headers=H).json()["rows"])

r = requests.get(f"{BASE}/analysis/credit-loss", params={"format": "csv"}, headers=H)
loss = pd.read_csv(io.StringIO(r.text))          # dataset version: r.headers["X-Dataset-Version"]`

export default function DataApiDocs() {
  return (
    <div className='mx-auto max-w-screen-md'>
      <Stack gap='section'>
        <div>
          <h2 className='text-heading'>API reference</h2>
          <p className='text-caption text-ink-muted mt-1'>
            Base URL <span className='font-mono text-ink'>{API_BASE_URL}</span> · header{' '}
            <span className='font-mono text-ink'>Authorization: Bearer &lt;token&gt;</span> ·
            all endpoints GET · JSON by default, <span className='font-mono'>?format=csv</span> where noted ·
            responses are scoped to your granted majors and include{' '}
            <span className='font-mono'>dataset_version</span>.
          </p>
        </div>
        <TokenManager />
        <section>
          <h3 className='text-body-strong mb-2'>Quick start</h3>
          <Code>{pythonSnippet(API_BASE_URL)}</Code>
        </section>
        <section>
          <h3 className='text-body-strong mb-2'>Data model</h3>
          <Code>{DATA_MODEL}</Code>
        </section>
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
      </Stack>
    </div>
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
