import React, { useMemo, useState } from 'react'
import {
  CheckIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Alert, Badge, Button, Panel, Stack, Textarea } from '../../components/ui'
import apiClient from '../../shared/api/apiClient'
import { _sameCanonicalValue, diffDocs, stampAiAssistedGroups } from './docDiff'

const KIND_LABEL = {
  added: 'Added group',
  removed: 'Removed group',
  changed: 'Changed group',
  doc_field: 'Document field',
}

function errorMessage(error) {
  if (error?.response?.status === 503 || error?.response?.data?.error === 'ai_assist_unavailable') {
    return 'AI assist is not configured on this server. You can keep using the structured editor.'
  }
  return error?.response?.data?.error || error?.message || 'AI assist could not create a proposal.'
}

function groupSummary(value) {
  if (value == null) return 'Not present'
  if (typeof value !== 'object') return String(value)
  if (!value.group_id) return JSON.stringify(value)
  const sections = Array.isArray(value.sections) ? value.sections : []
  const receivers = sections.reduce((sum, section) => sum + (section.receivers?.length || 0), 0)
  const courses = sections.reduce((sum, section) => sum + (section.receivers || []).reduce(
    (receiverSum, receiver) => receiverSum + (receiver.options || []).reduce(
      (optionSum, option) => optionSum + (option.course_ids?.length || 0), 0,
    ), 0,
  ), 0)
  return [
    value.label_seen || value.group_id,
    value.ge_area ? `GE: ${value.ge_area}` : null,
    `${sections.length} section${sections.length === 1 ? '' : 's'}`,
    `${receivers} choice${receivers === 1 ? '' : 's'}`,
    `${courses} course${courses === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ')
}

function DiffCard({ change, summary }) {
  return (
    <article className='rounded-xl border border-border bg-surface p-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant={change.kind === 'removed' ? 'danger' : change.kind === 'added' ? 'success' : 'accent'}>
          {KIND_LABEL[change.kind] || change.kind}
        </Badge>
        <span className='font-mono text-tag text-ink-muted'>{change.group_id}</span>
      </div>
      {summary && <p className='mt-2 text-body text-ink'>{summary}</p>}
      {Number.isInteger(change.before_index) && Number.isInteger(change.after_index) && (
        <p className='mt-2 text-caption font-medium text-primary'>
          Position {change.before_index + 1} → {change.after_index + 1}
        </p>
      )}
      <div className='mt-3 grid gap-3 sm:grid-cols-2'>
        <div className='rounded-lg bg-surface-sunken p-3'>
          <p className='text-label'>Before</p>
          <p className='mt-1 text-caption text-ink-muted break-words'>{groupSummary(change.before)}</p>
        </div>
        <div className='rounded-lg bg-primary-soft p-3'>
          <p className='text-label text-primary'>After</p>
          <p className='mt-1 text-caption text-ink break-words'>{groupSummary(change.after)}</p>
        </div>
      </div>
      <details className='mt-3'>
        <summary className='cursor-pointer text-tag text-ink-subtle'>Inspect exact JSON</summary>
        <pre className='mt-2 max-h-72 overflow-auto rounded-lg bg-surface-sunken p-3 text-[11px] leading-relaxed text-ink-muted'>
          {JSON.stringify({ before: change.before, after: change.after }, null, 2)}
        </pre>
      </details>
    </article>
  )
}

/** English instruction → validated proposal → explicit human approval. */
export default function AiAssistPanel({ doc, onApprove, disabled = false, disabledReason = '' }) {
  const [instruction, setInstruction] = useState('')
  const [proposal, setProposal] = useState(null)
  const [error, setError] = useState('')
  const [proposing, setProposing] = useState(false)
  const [approving, setApproving] = useState(false)

  const proposalIsStale = Boolean(proposal && !_sameCanonicalValue(proposal.base_doc, doc))
  const diff = useMemo(
    () => proposal?.proposed_doc ? diffDocs(proposal.base_doc, proposal.proposed_doc) : [],
    [proposal],
  )
  const summaryByGroup = useMemo(() => new Map(
    (proposal?.changes || []).map((change) => [change.group_id, change.summary]),
  ), [proposal])

  const propose = () => {
    const clean = instruction.trim()
    if (!clean || !doc?._id) return
    setError('')
    setProposal(null)
    setProposing(true)
    apiClient.post(
        `/curated/as-degrees/${encodeURIComponent(doc._id)}/assist`,
        { instruction: clean },
      )
      .then((response) => {
        if (!_sameCanonicalValue(response.data?.proposed_doc?.verification, doc.verification)) {
          throw new Error('AI assist returned a protected verification change. No proposal was accepted.')
        }
        setProposal({
          ...response.data,
          base_doc: typeof structuredClone === 'function'
            ? structuredClone(doc)
            : JSON.parse(JSON.stringify(doc)),
        })
      })
      .catch((nextError) => setError(errorMessage(nextError)))
      .finally(() => setProposing(false))
  }

  const approve = async () => {
    if (!proposal?.proposed_doc) return
    if (disabled) {
      setError('Save or reload your manual changes before approving this proposal.')
      return
    }
    if (proposalIsStale) {
      setError('The document changed after this proposal was created. Discard it and request a new proposal.')
      return
    }
    setError('')
    setApproving(true)
    try {
      await onApprove(stampAiAssistedGroups(proposal.base_doc, proposal.proposed_doc))
      setInstruction('')
      setProposal(null)
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      setApproving(false)
    }
  }

  const discard = () => {
    setProposal(null)
    setError('')
  }

  return (
    <Panel title='AI-assisted correction' icon={SparklesIcon} overflowVisible>
      <Stack gap='comfortable'>
        <p className='text-body text-ink-muted'>
          Describe a structural correction in plain English. Nothing changes until you review the
          proposal below and approve it through the normal validated save.
        </p>
        <Textarea
          label='Describe the correction'
          value={instruction}
          rows={3}
          disabled={disabled || proposing || approving}
          placeholder='Example: In the core programming group, replace CS 110 with CS 111 and CS 112.'
          onChange={(event) => setInstruction(event.target.value)}
        />
        {disabledReason && <Alert>{disabledReason}</Alert>}
        <div className='flex flex-wrap gap-2'>
          <Button
            leadingIcon={SparklesIcon}
            loading={proposing}
            disabled={disabled || !instruction.trim() || approving}
            onClick={propose}
          >
            Propose changes
          </Button>
          {proposal && (
            <Button variant='ghost' leadingIcon={XMarkIcon} disabled={approving} onClick={discard}>
              Discard proposal
            </Button>
          )}
        </div>

        {error && <Alert type='error'>{error}</Alert>}

        {proposal && (
          <div className='border-t border-border pt-5'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <p className='text-label'>Review before saving</p>
                <p className='mt-1 text-caption text-ink-muted'>
                  {diff.length} structural change{diff.length === 1 ? '' : 's'} detected
                </p>
              </div>
              <Button
                leadingIcon={CheckIcon}
                loading={approving}
                disabled={disabled || proposalIsStale || diff.length === 0}
                onClick={approve}
              >
                Approve and save
              </Button>
            </div>
            {proposalIsStale && (
              <Alert className='mt-4'>
                The document changed after this proposal was created. Discard it and request a new proposal.
              </Alert>
            )}
            {diff.length ? (
              <div className='mt-4 grid gap-3'>
                {diff.map((change) => (
                  <DiffCard
                    key={`${change.kind}:${change.group_id}`}
                    change={change}
                    summary={summaryByGroup.get(change.group_id)}
                  />
                ))}
              </div>
            ) : (
              <Alert className='mt-4'>The proposal does not change the current document.</Alert>
            )}
          </div>
        )}
      </Stack>
    </Panel>
  )
}

export { DiffCard, errorMessage as _errorMessage }
