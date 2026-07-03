import React, { useState } from 'react'
import { ClipboardIcon, TrashIcon, KeyIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, Stack, Input } from './components/ui'
import { API_BASE_URL } from '@frontend/lib/constants'
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '@frontend/query/hooks/useData'

/**
 * API documentation + personal-token manager — how partners (and their AI
 * assistants) pull the scoped dataset into scripts, notebooks, R, etc.
 * Everything served by these endpoints is already restricted to the caller's
 * granted (school, major) subset; tokens inherit exactly the owner's access.
 */

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

const ENDPOINTS = [
  {
    group: 'Analysis (add ?format=csv for CSV; JSON includes dataset_version)',
    rows: [
      ['GET /analysis/coverage', 'Per-agreement articulation coverage: receivers required/articulated, % , full-articulation flag. Params: majorContains.'],
      ['GET /analysis/credit-loss', 'Minimal CC course set per agreement, units, many-to-one count, quarter/semester normalization, blocked receivers. Params: majorContains.'],
      ['GET /analysis/choice-cost', 'Incremental CC courses per additional campus, in order. Params: schoolIds=7,117,79 (ordered, required), majorContains.'],
      ['GET /analysis/category-gaps', '% of colleges missing articulation per campus × canonical course category (needs curation tags). Params: majorContains.'],
      ['GET /analysis/complexity', 'Curricular-Analytics delay/blocking over curated prereqs, per pathway. Params: majorContains.'],
      ['GET /analysis/time-to-degree', 'ADT transfer-credit rate + costed lost units (needs curated ADTs + tuition). Params: majorContains.'],
      ['GET /analysis/raw/:collection', 'Raw working collections: audit_results, curation_course_categories, curation_receiver_overrides, curation_prereqs, curation_assoc_degrees, ref_campus_calendars, ref_tuition, ref_cc_districts, ref_locations.'],
    ],
  },
  {
    group: 'Reference data (your visible subset)',
    rows: [
      ['GET /data/summary', 'What your dataset contains: majors per campus, counts, dataset_version.'],
      ['GET /community-colleges', 'All 115 community colleges (id, name).'],
      ['GET /schools', 'UC campuses (id, name).'],
      ['GET /uc-agreements-batch/:ccId?school_id=:ucId', 'Agreements for one college (optionally one campus), grouped by campus, with admissions stats attached.'],
      ['GET /audit/doc/:agreementId', 'One full agreement doc + course-name maps + ASSIST deep link.'],
      ['GET /data/raw-assist/:agreementId', 'The live raw ASSIST.org API payload for one agreement.'],
      ['GET /courses/:ccId', 'CC course catalog rows for one college (course_id, prefix, number, title, units).'],
      ['GET /university-courses/:ucId', 'UC-side catalog rows for one campus (parent_id, prefix, number, title, units).'],
    ],
  },
]

const pythonSnippet = (base) => `import io
import pandas as pd
import requests

BASE = "${base}"
TOKEN = "pmtr_..."   # generate above; keep it secret
H = {"Authorization": f"Bearer {TOKEN}"}

# Analysis endpoints → DataFrames (JSON keeps dataset_version for citation)
r = requests.get(f"{BASE}/analysis/coverage", headers=H)
r.raise_for_status()
payload = r.json()
coverage = pd.DataFrame(payload["rows"])
print(payload["dataset_version"], coverage.shape)

# The papers' Fig-1-style heatmap in one line:
heat = coverage.pivot_table(index="community_college", columns="school",
                            values="pct_articulated")

# CSV works too (dataset version rides in the X-Dataset-Version header):
r = requests.get(f"{BASE}/analysis/credit-loss", params={"format": "csv"}, headers=H)
loss = pd.read_csv(io.StringIO(r.text))
print(r.headers["X-Dataset-Version"], loss.shape)`

const aiPrompt = (base) => `You are helping me analyze California CS transfer-pathway data from the PMT
Research API. Facts you need:

- Base URL: ${base}
- Auth: every request needs the header  Authorization: Bearer <my pmtr_ token>
- All data is UC-only and scoped server-side to the majors I've been granted;
  responses include "dataset_version" — record it beside any figure.
- The data model is receiver-centric: an articulation agreement (one community
  college × one UC campus × one major) contains requirement_groups → sections →
  receivers. A receiver is one UC requirement with articulation_status
  ('articulated' | 'not_articulated') and options — alternative CC course sets
  that satisfy it (course_conjunction 'and'/'or' within an option,
  options_conjunction across options). CC courses are keyed by numeric
  course_id; UC courses by parent_id.

Endpoints (GET, JSON by default, ?format=csv for CSV):
- /analysis/coverage            per-agreement articulation coverage (% articulated, full-articulation flag)
- /analysis/credit-loss         min CC courses + units per agreement, many-to-one, quarter-normalized
- /analysis/choice-cost?schoolIds=7,117  incremental courses per added campus (ordered)
- /analysis/category-gaps       % colleges missing articulation per campus × course category
- /analysis/complexity          prereq delay/blocking factors per pathway
- /analysis/time-to-degree      ADT transfer-credit rate + costed lost units
- /analysis/raw/:collection     raw working collections (audit_results, curation_*, ref_*)
- /data/summary                 my subset's majors + counts
- /community-colleges, /schools, /courses/:ccId, /university-courses/:ucId
- /uc-agreements-batch/:ccId?school_id=:ucId   full agreements (grouped by campus)
- /audit/doc/:id                one agreement + course-name maps
- /data/raw-assist/:id          the upstream raw ASSIST.org payload

Typical tasks: coverage heatmaps (college × campus), credit-loss decomposition,
inter-campus misalignment simulation, category gap charts, curricular
complexity — the analyses from Jiang et al. (SIGCSE 2024) and the MA
transfer-pathways papers. Prefer the /analysis endpoints (pre-computed rows)
over recomputing from raw agreements unless the task needs receiver-level
detail.`

export default function DataApiDocs() {
  return (
    <div className='mx-auto max-w-screen-md'>
      <Stack gap='section'>
        <div>
          <h2 className='text-heading'>Programmatic access</h2>
          <p className='text-body text-ink-muted mt-1'>
            Everything this console shows is also served as JSON/CSV for scripts and
            notebooks — same endpoints, same access rules: responses cover exactly the
            majors you've been granted, and every payload carries the{' '}
            <span className='font-mono'>dataset_version</span> it was computed from
            (record it beside any figure you keep).
          </p>
        </div>
        <TokenManager />
        <section>
          <h3 className='text-body-strong mb-2'>Quick start (Python / pandas)</h3>
          <Code>{pythonSnippet(API_BASE_URL)}</Code>
        </section>
        <section>
          <h3 className='text-body-strong mb-2'>Endpoints</h3>
          <p className='text-caption text-ink-muted mb-3'>
            Base URL: <span className='font-mono text-ink'>{API_BASE_URL}</span> · header{' '}
            <span className='font-mono text-ink'>Authorization: Bearer &lt;token&gt;</span>
          </p>
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
        <section>
          <h3 className='text-body-strong mb-2'>Working with an AI assistant</h3>
          <p className='text-caption text-ink-muted mb-2'>
            Paste this into Claude/ChatGPT (with your token) and it has everything it
            needs to write analysis scripts against the live API:
          </p>
          <Code>{aiPrompt(API_BASE_URL)}</Code>
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
      <h3 className='text-body-strong mb-2'>Your API tokens</h3>
      <div className='surface-card p-4'>
        <Stack gap='cozy'>
          <p className='text-caption text-ink-muted'>
            Tokens are long-lived credentials for scripts — they carry exactly your
            access, nothing more. Treat them like passwords; revoke any you stop using.
          </p>
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
