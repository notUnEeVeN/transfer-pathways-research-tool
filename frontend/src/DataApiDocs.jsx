import React, { useState } from 'react'
import { ClipboardIcon, CheckIcon, TrashIcon, KeyIcon, SparklesIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Input, PageContainer, Spinner, Tabs } from './components/ui'
import SubNav from './components/SubNav'
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
      <SubNav tabs={{
        value: tab, onChange: setTab,
        options: [
          { value: 'tokens',    label: 'Tokens' },
          { value: 'starter',   label: 'Starter' },
          { value: 'endpoints', label: 'Endpoints' },
          { value: 'guide',     label: 'Data guide' },
        ],
      }} />
      <div className='flex-1 min-h-0 overflow-auto'>
        <PageContainer width='form' className='flex flex-col gap-[18px]'>
          {tab === 'tokens' && <TokenManager />}
          {tab === 'starter' && <StarterSection />}
          {tab === 'endpoints' && <EndpointsSection />}
          {tab === 'guide' && <GuideSection />}
        </PageContainer>
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
    <div className='flex flex-col gap-[18px]'>
      <div className='flex flex-col gap-1.5'>
        <h3 className='heading-card tracking-[-.01em]'>Starter code</h3>
        <p className='text-caption leading-[1.6] ink-muted max-w-[64ch]'>{STARTER_EXPLANATION}</p>
      </div>

      <ol className='flex flex-col gap-4'>
        {STARTER_STEPS.map(([title, desc], i) => (
          <li key={title} className='flex items-start gap-3.5'>
            <span className='shrink-0 w-[26px] h-[26px] rounded-pill border border-border-strong bg-surface grid place-items-center text-tag font-[650] text-ink-muted'>
              {i + 1}
            </span>
            <div>
              <p className='text-body-strong'>{title}</p>
              <p className='mt-[3px] text-caption leading-[1.55] ink-muted max-w-[62ch]'>{desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className='surface-card overflow-hidden'>
        <div className='px-5 py-3.5 border-b border-border flex items-center gap-2.5'>
          <span className='text-caption ink-default font-[650]'>starter.py</span>
          <span className='text-tag font-normal text-ink-subtle'>preconfigured for this API</span>
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
            <pre className='px-5 py-[18px] bg-surface-muted font-mono text-tag font-normal leading-[1.65] text-ink-muted overflow-auto whitespace-pre max-h-[60vh]'>
              {py.data}
            </pre>
          )}
      </div>

      <div>
        <h3 className='heading-card tracking-[-.01em]'>Starting examples</h3>
        <p className='mt-1 mb-3 text-caption leading-[1.55] ink-muted max-w-[62ch]'>
          Keep the same starter.py and choose the smallest script that matches the visual.
        </p>
        <Tabs value={template.id} onChange={setTemplateId}
          options={STARTER_TEMPLATES.map((item) => ({ value: item.id, label: item.label }))} />
        <div className='flex flex-wrap items-start gap-3 mt-4 mb-3'>
          <div className='min-w-0 flex-1'>
            <p className='text-caption ink-default font-[650] font-mono'>{template.filename}</p>
            <p className='text-tag font-normal text-ink-subtle mt-0.5'>{template.summary}</p>
          </div>
          <div className='flex gap-1'>
            <Button variant='ghost' leadingIcon={ArrowDownTrayIcon}
              onClick={() => downloadText(template.code, template.filename)}>Download</Button>
          </div>
        </div>
        <CodeBlock>{template.code}</CodeBlock>
      </div>
    </div>
  )
}

// ───────── shared bits ─────────

function CopyButton({ text, label = 'Copy', variant = 'ghost', leadingIcon = ClipboardIcon, className = '' }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button variant={variant} leadingIcon={copied ? CheckIcon : leadingIcon} className={className}
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
    <div className='surface-card overflow-hidden relative'>
      <div className='absolute top-1.5 right-1.5 z-10'><CopyButton text={text} /></div>
      <pre className='p-3 pr-24 bg-surface-muted font-mono text-tag font-normal leading-[1.65] text-ink-muted overflow-auto whitespace-pre'>{text}</pre>
    </div>
  )
}

// Two-column definition table (field/meaning, from/to). `head.length` stays
// generic, but the 240px label column matches the mockup's fixed grid, which
// only ever feeds it two-column data.
function DocTable({ head, rows }) {
  const gridCols = head.length === 2 ? '240px 1fr' : `repeat(${head.length}, minmax(0,1fr))`
  return (
    <div className='surface-card overflow-hidden'>
      <div className='grid gap-3.5 px-5 py-3 border-b border-border' style={{ gridTemplateColumns: gridCols }}>
        {head.map((h) => <span key={h} className='text-label whitespace-nowrap'>{h}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ gridTemplateColumns: gridCols }}
          className='grid gap-3.5 items-center px-5 py-3 border-b border-border last:border-0 hover:bg-surface-hover'>
          {r.map((cell, j) => (
            <span key={j} className={`min-w-0 ${j === 0 ? 'font-mono text-tag font-semibold text-ink' : 'text-caption ink-muted'}`}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

// ───────── endpoints ─────────

function GettingStarted() {
  return (
    <div className='surface-card px-5 py-[18px] flex flex-col gap-2'>
      <p className='text-caption ink-muted'>
        Base URL <strong className='font-mono text-ink font-semibold'>{API_BASE_URL}</strong>
      </p>
      <p className='text-caption ink-muted'>
        Every request <strong className='font-mono text-ink font-semibold'>{AUTH_HEADER}</strong>
      </p>
      <p className='text-caption ink-muted'>
        Use <strong className='font-mono text-ink font-semibold'>?format=csv</strong> on bulk exports.
        Pass any path below to <strong className='font-mono text-ink font-semibold'>get()</strong> from the Starter tab.
      </p>
    </div>
  )
}

function EndpointCard({ e }) {
  const hasDetails = e.returns || e.fields?.length || e.example
  return (
    <div className='px-5 py-4 flex flex-col gap-1.5'>
      <div className='flex items-baseline gap-2'>
        <span className='text-tag font-bold tracking-[.05em] text-ink-subtle uppercase'>{e.method}</span>
        <span className='font-mono text-caption font-semibold ink-default'>{e.path}</span>
      </div>
      <p className='text-body-strong'>{e.title}</p>
      <p className='text-caption leading-[1.55] ink-muted max-w-[64ch]'>{e.plain}</p>
      {hasDetails && (
        <details className='mt-1 group'>
          <summary className='text-caption font-[550] text-success cursor-pointer select-none list-none inline-flex items-center gap-1'>
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
              <div className='divide-y divide-border border border-border rounded-md px-4'>
                {e.fields.map(([f, d]) => (
                  <div key={f} className='py-2'>
                    <span className='font-mono text-caption ink-default break-words'>{f}</span>
                    <p className='text-caption ink-muted mt-0.5'>{d}</p>
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
    <div className='flex flex-col gap-[18px]'>
      <GettingStarted />
      {PARTNER_ENDPOINT_GROUPS.map((g) => (
        <div key={g.id} className='flex flex-col gap-2.5'>
          <div>
            <h3 className='heading-card tracking-[-.01em]'>{g.title}</h3>
            {g.blurb && <p className='mt-1 text-caption ink-subtle'>{g.blurb}</p>}
          </div>
          <div className='surface-card overflow-hidden divide-y divide-border'>
            {g.endpoints.map((e) => <EndpointCard key={e.path} e={e} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ───────── data guide ─────────

function GuideSection() {
  return (
    <div className='flex flex-col gap-[18px]'>
      <div className='surface-card px-5 py-[18px] flex items-center gap-4'>
        <div className='min-w-0 flex-1'>
          <p className='text-body-strong'>How to read this dataset</p>
          <p className='mt-1 text-caption leading-[1.55] ink-muted max-w-[60ch]'>
            This copies the endpoint reference, database structure, publishing
            rules, and both starter examples as one prompt for an AI assistant.
            Keep personal tokens out of the prompt.
          </p>
        </div>
        <CopyButton variant='primary' leadingIcon={SparklesIcon} label='Copy for AI'
          text={() => buildAiBriefing(API_BASE_URL)} className='ml-auto whitespace-nowrap' />
      </div>
      {GUIDE_SECTIONS.map((s) => (
        <section key={s.id} className='flex flex-col gap-3'>
          <h3 className='heading-card tracking-[-.01em]'>{s.title}</h3>
          <div className='flex flex-col gap-3'>
            {s.blocks.map((b, i) => {
              if (b.type === 'p') return <p key={i} className='text-caption leading-[1.65] ink-muted max-w-[66ch]'>{b.text}</p>
              if (b.type === 'code') return <CodeBlock key={i}>{b.text}</CodeBlock>
              if (b.type === 'table') return <DocTable key={i} head={b.head} rows={b.rows} />
              if (b.type === 'list') {
                return (
                  <ul key={i} className='list-disc pl-5 space-y-1.5'>
                    {b.items.map((item) => <li key={item} className='text-caption leading-[1.65] ink-muted'>{item}</li>)}
                  </ul>
                )
              }
              return null
            })}
          </div>
        </section>
      ))}
    </div>
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
    <div className='flex flex-col gap-[18px]'>
      <div className='flex flex-col gap-1.5'>
        <h3 className='heading-card tracking-[-.01em]'>Personal API tokens</h3>
        <p className='text-caption leading-[1.6] ink-muted max-w-[68ch]'>
          A token lets scripts and notebooks call the API. Send it on every
          request as{' '}
          <strong className='font-mono text-ink font-semibold'>Authorization: Bearer pmtr_…</strong>.
          Treat it like a password; revoke it here if it leaks.
        </p>
      </div>
      <div className='surface-card px-5 py-[18px] flex flex-col gap-4'>
        <form onSubmit={submit} className='flex items-center gap-2.5'>
          <Input className='w-[300px] flex-none' value={label} onChange={(e) => setLabel(e.target.value)}
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
          <div>
            {(list.data?.tokens || []).map((t) => (
              <div key={t.id} className='flex items-center gap-3 py-3 border-b border-border last:border-0'>
                <div className='min-w-0'>
                  <p className='text-body-strong'>{t.label || 'unlabeled token'}</p>
                  <p className='text-tag font-normal text-ink-subtle mt-0.5'>
                    created {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                    {t.last_used_at ? ` · last used ${new Date(t.last_used_at).toLocaleString()}` : ' · never used'}
                  </p>
                </div>
                <Button variant='ghost' className='ml-auto hover:bg-danger-soft! hover:text-danger!' leadingIcon={TrashIcon}
                  onClick={() => revoke.mutate(t.id)} disabled={revoke.isPending}>Revoke</Button>
              </div>
            ))}
            {!(list.data?.tokens || []).length && (
              <p className='text-caption ink-subtle py-1'>No tokens yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
