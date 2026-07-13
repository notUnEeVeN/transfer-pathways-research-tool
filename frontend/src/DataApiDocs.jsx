import React, { useState } from 'react'
import { ClipboardIcon, CheckIcon, TrashIcon, KeyIcon, SparklesIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, Stack, Input, Tabs } from './components/ui'
import { API_BASE_URL } from '@frontend/lib/constants'
import { useApiTokens, useCreateApiToken, useRevokeApiToken, usePmtPy } from '@frontend/query/hooks/useData'
import {
  PARTNER_ENDPOINT_GROUPS, GUIDE_SECTIONS,
  AUTH_HEADER, buildAiBriefing,
  STARTER_EXPLANATION, STARTER_STEPS, STARTER_TEMPLATES,
} from './apiDocs/content'

/**
 * API page: Tokens, Starter, Endpoints, and Data guide.
 * guide. Copy lives in apiDocs/content.js and server/client/pmtPy.js; this file
 * renders it. "Copy for AI" serializes the same content, so page and paste stay in sync.
 */
export default function ApiPage() {
  const [tab, setTab] = useState('starter')
  return (
    <div className='h-full flex flex-col'>
      <div className='shrink-0 flex items-center px-4 h-11 border-b border-border'>
        <Tabs value={tab} onChange={setTab}
          options={[
            { value: 'tokens',    label: 'Tokens' },
            { value: 'starter',   label: 'Starter' },
            { value: 'endpoints', label: 'Endpoints' },
            { value: 'guide',     label: 'Data guide' },
          ]} />
      </div>
      <div className='flex-1 min-h-0 overflow-auto'>
        <div className='mx-auto max-w-screen-md px-6 py-10'>
          <Stack gap='section'>
            {tab === 'tokens' && <TokenManager />}
            {tab === 'starter' && <StarterSection />}
            {tab === 'endpoints' && <EndpointsSection />}
            {tab === 'guide' && <GuideSection />}
          </Stack>
        </div>
      </div>
    </div>
  )
}

// ───────── starter ─────────

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/x-python' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

// One stable API client plus two researcher-side starting scripts. Keeping the
// examples separate lets existing starter.py users add variants without
// replacing the client they already import.
function StarterSection() {
  const py = usePmtPy()
  const [templateId, setTemplateId] = useState('simple')
  const template = STARTER_TEMPLATES.find((item) => item.id === templateId) || STARTER_TEMPLATES[0]

  return (
    <Stack gap='section'>
      <div>
        <h3 className='text-heading'>Starter code</h3>
        <p className='text-body text-ink-muted mt-1 max-w-prose'>{STARTER_EXPLANATION}</p>
      </div>

      <ol className='flex flex-col gap-4'>
        {STARTER_STEPS.map(([title, desc], i) => (
          <li key={title} className='flex gap-4'>
            <span className='shrink-0 w-7 h-7 rounded-full border border-border flex items-center justify-center text-caption font-mono text-ink-muted'>
              {i + 1}
            </span>
            <div>
              <p className='text-body-strong'>{title}</p>
              <p className='text-body text-ink-muted mt-0.5 max-w-prose'>{desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div>
        <div className='flex items-center gap-2 mb-3'>
          <h3 className='text-body-strong'>starter.py</h3>
          <span className='text-caption text-ink-subtle'>preconfigured for this API</span>
          <div className='ml-auto flex gap-1'>
            {py.data && <CopyButton text={py.data} />}
            <Button variant='ghost' leadingIcon={ArrowDownTrayIcon}
              onClick={() => downloadText(py.data || '', 'starter.py')}
              disabled={!py.data}>Download</Button>
          </div>
        </div>
        {py.isLoading ? <div className='flex justify-center py-6'><Spinner /></div>
          : py.isError ? <Alert type='error'>Could not load starter.py from the API.</Alert>
          : (
            <pre className='surface-card p-4 text-[11px] leading-relaxed font-mono overflow-auto whitespace-pre max-h-[60vh]'>
              {py.data}
            </pre>
          )}
      </div>

      <div>
        <h3 className='text-body-strong'>Starting examples</h3>
        <p className='text-body text-ink-muted mt-1 mb-3 max-w-prose'>
          Keep the same starter.py and choose the smallest script that matches the visual.
        </p>
        <Tabs value={template.id} onChange={setTemplateId}
          options={STARTER_TEMPLATES.map((item) => ({ value: item.id, label: item.label }))} />
        <div className='flex flex-wrap items-start gap-3 mt-4 mb-3'>
          <div className='min-w-0 flex-1'>
            <p className='text-body-strong font-mono'>{template.filename}</p>
            <p className='text-caption text-ink-muted mt-0.5'>{template.summary}</p>
          </div>
          <div className='flex gap-1'>
            <Button variant='ghost' leadingIcon={ArrowDownTrayIcon}
              onClick={() => downloadText(template.code, template.filename)}>Download</Button>
          </div>
        </div>
        <CodeBlock>{template.code}</CodeBlock>
      </div>
    </Stack>
  )
}

// ───────── shared bits ─────────

function CopyButton({ text, label = 'Copy', variant = 'ghost', leadingIcon = ClipboardIcon }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button variant={variant} leadingIcon={copied ? CheckIcon : leadingIcon}
      onClick={() => {
        navigator.clipboard.writeText(typeof text === 'function' ? text() : text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}>
      {copied ? 'Copied' : label}
    </Button>
  )
}

function CodeBlock({ children }) {
  const text = typeof children === 'string' ? children : String(children)
  return (
    <div className='surface-card relative'>
      <div className='absolute top-1.5 right-1.5 z-10'><CopyButton text={text} /></div>
      <pre className='p-3 pr-24 text-[11px] leading-relaxed font-mono overflow-auto whitespace-pre'>{text}</pre>
    </div>
  )
}

function DocTable({ head, rows }) {
  return (
    <div className='surface-card overflow-x-auto'>
      <table className='w-full text-left'>
        <thead className='border-b border-border'>
          <tr>{head.map((h) => <th key={h} className='px-4 py-2.5 text-label whitespace-nowrap'>{h}</th>)}</tr>
        </thead>
        <tbody className='divide-y divide-border/60'>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 text-caption align-top ${j === 0 ? 'text-ink font-mono' : 'text-ink-muted'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ───────── endpoints ─────────

function GettingStarted() {
  return (
    <div className='surface-card p-6'>
      <div className='flex flex-col gap-2'>
        <p className='text-body'>
          <span className='text-ink-subtle'>Base URL</span>{' '}
          <span className='font-mono text-ink'>{API_BASE_URL}</span>
        </p>
        <p className='text-body'>
          <span className='text-ink-subtle'>Every request</span>{' '}
          <span className='font-mono text-ink'>{AUTH_HEADER}</span>
        </p>
        <p className='text-caption text-ink-muted'>
          Use <span className='font-mono'>?format=csv</span> on bulk exports.
          Pass any path below to <span className='font-mono'>get()</span> from the Starter tab.
        </p>
      </div>
    </div>
  )
}

function EndpointCard({ e }) {
  const hasDetails = e.returns || e.fields?.length || e.example
  return (
    <div className='py-5'>
      <p className='font-mono text-caption text-ink-subtle'>
        {e.method} <span className='text-ink'>{e.path}</span>
      </p>
      <p className='text-body-strong mt-1'>{e.title}</p>
      <p className='text-body text-ink-muted mt-1 leading-relaxed max-w-prose'>{e.plain}</p>
      {hasDetails && (
        <details className='mt-2 group'>
          <summary className='text-caption text-primary cursor-pointer select-none list-none inline-flex items-center gap-1'>
            <span className='transition-transform group-open:rotate-90'>▸</span> Details
          </summary>
          <div className='mt-3 flex flex-col gap-3'>
            {e.returns && (
              <p className='text-caption'>
                <span className='text-ink-subtle'>Returns</span>{' '}
                <span className='font-mono text-ink'>{e.returns}</span>
              </p>
            )}
            {e.fields?.length > 0 && (
              <div className='divide-y divide-border/40 border border-border/60 rounded-md px-4'>
                {e.fields.map(([f, d]) => (
                  <div key={f} className='py-2'>
                    <span className='font-mono text-caption text-ink break-words'>{f}</span>
                    <p className='text-caption text-ink-muted mt-0.5'>{d}</p>
                  </div>
                ))}
              </div>
            )}
            {e.example && <CodeBlock>{e.example}</CodeBlock>}
          </div>
        </details>
      )}
    </div>
  )
}

function EndpointsSection() {
  return (
    <Stack gap='section'>
      <GettingStarted />
      {PARTNER_ENDPOINT_GROUPS.map((g) => (
        <div key={g.id}>
          <h3 className='text-heading'>{g.title}</h3>
          {g.blurb && <p className='text-body text-ink-muted mt-1'>{g.blurb}</p>}
          <div className='surface-card px-6 divide-y divide-border/60 mt-3'>
            {g.endpoints.map((e) => <EndpointCard key={e.path} e={e} />)}
          </div>
        </div>
      ))}
    </Stack>
  )
}

// ───────── data guide ─────────

function GuideSection() {
  return (
    <Stack gap='section'>
      <div className='surface-card p-6 flex flex-wrap items-center gap-4'>
        <div className='min-w-0 flex-1'>
          <p className='text-body-strong'>How to read this dataset</p>
          <p className='text-body text-ink-muted mt-1'>
            This copies the endpoint reference, database structure, publishing
            rules, and both starter examples as one prompt for an AI assistant.
            Keep personal tokens out of the prompt.
          </p>
        </div>
        <CopyButton variant='primary' leadingIcon={SparklesIcon} label='Copy for AI'
          text={() => buildAiBriefing(API_BASE_URL)} />
      </div>
      {GUIDE_SECTIONS.map((s) => (
        <section key={s.id}>
          <h3 className='text-heading mb-3'>{s.title}</h3>
          <div className='flex flex-col gap-3'>
            {s.blocks.map((b, i) => {
              if (b.type === 'p') return <p key={i} className='text-body text-ink-muted leading-relaxed max-w-prose'>{b.text}</p>
              if (b.type === 'code') return <CodeBlock key={i}>{b.text}</CodeBlock>
              if (b.type === 'table') return <DocTable key={i} head={b.head} rows={b.rows} />
              if (b.type === 'list') {
                return (
                  <ul key={i} className='list-disc pl-5 space-y-1.5'>
                    {b.items.map((item) => <li key={item} className='text-body text-ink-muted'>{item}</li>)}
                  </ul>
                )
              }
              return null
            })}
          </div>
        </section>
      ))}
    </Stack>
  )
}

// ───────── tokens ─────────

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
      <div className='mb-3'>
        <h3 className='text-body-strong'>Personal API tokens</h3>
        <p className='text-body text-ink-muted mt-1'>
          A token lets scripts and notebooks call the API. Send it on every
          request as{' '}
          <span className='font-mono text-ink'>Authorization: Bearer pmtr_…</span>.
          Treat it like a password; revoke it here if it leaks.
        </p>
      </div>
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
                <CopyButton text={freshToken} />
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
