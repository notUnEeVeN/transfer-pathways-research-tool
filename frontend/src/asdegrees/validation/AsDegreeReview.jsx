import React, { useEffect, useState } from 'react'
import { Alert, Button, EmptyState, Spinner, Stack, Tabs, Textarea } from '../../components/ui'
import { useAsDegreeDetail, useSaveAsDegree } from '../../shared/query/hooks/useData'
import apiClient from '../../shared/api/apiClient'

/**
 * Record a verdict on one college's AI-scraped AS degrees, and change them by
 * describing the change.
 *
 * The degree itself is already rendered above this panel, in catalog form, by
 * DegreePanel — that is what the researcher reads and judges against the real
 * catalog. This panel deliberately does not repeat it. It carries only the two
 * things that view cannot: a way to rewrite the record, and a verdict.
 */
export default function AsDegreeReview({ collegeId }) {
  const detail = useAsDegreeDetail(collegeId != null ? `cc:${collegeId}` : null)
  const save = useSaveAsDegree()

  const records = detail.data?.degrees || []
  const [recordId, setRecordId] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)

  const active = records.find((r) => r.doc?._id === recordId) || records[0] || null
  const doc = active?.doc || null

  useEffect(() => {
    if (!doc) return
    setNote(doc.verification?.note || '')
    setSaved(null)
  }, [doc?._id])

  const persist = async (verified) => {
    setError(null)
    setSaved(null)
    try {
      await save.mutateAsync({
        ...doc,
        verification: {
          ...(doc.verification || {}),
          verified,
          verified_at: new Date().toISOString(),
          // Written by the person reading the catalog, never generated.
          note: note.trim() || null,
        },
      })
      setSaved(verified ? 'Marked verified.' : 'Flagged as needing work.')
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save this record.')
    }
  }

  if (detail.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (detail.isError && detail.error?.response?.status !== 404) {
    return <Alert type='error'>Could not load this college&apos;s records.</Alert>
  }
  if (!doc) {
    return <EmptyState card title='No AS-degree records'
      description='Nothing has been scraped for this college yet.' />
  }

  const verified = !!doc.verification?.verified

  return (
    <Stack gap='comfortable'>
      <div className='flex flex-wrap items-center gap-3'>
        {records.length > 1 && (
          <Tabs value={doc._id} onChange={setRecordId}
            options={records.map((r) => ({
              value: r.doc._id,
              label: r.doc.degree_title_seen || r.doc.degree_type,
            }))} />
        )}
        <span className={`ml-auto text-caption ${verified ? 'text-primary' : 'text-ink-subtle'}`}>
          {verified ? 'Verified' : 'Not yet verified'}
        </span>
      </div>

      <AssistBox recordId={doc._id} onApplied={() => detail.refetch()} />

      <div>
        <span className='field-label'>Verification note</span>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder='What you checked, or what is still wrong. Saved with your verdict.' />
      </div>

      {error && <Alert type='error'>{error}</Alert>}
      {saved && <Alert type='success'>{saved}</Alert>}

      <div className='flex flex-wrap items-center gap-2'>
        <Button onClick={() => persist(true)} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Mark verified'}
        </Button>
        <Button variant='secondary' onClick={() => persist(false)} disabled={save.isPending}>
          Needs work
        </Button>
      </div>
    </Stack>
  )
}

/**
 * Describe a correction in plain English; the assistant rewrites the stored
 * document, and the change is listed before anything is saved.
 */
function AssistBox({ recordId, onApplied }) {
  const save = useSaveAsDegree()
  const [instruction, setInstruction] = useState('')
  const [proposal, setProposal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const propose = async () => {
    setBusy(true)
    setError(null)
    try {
      const { data } = await apiClient.post(
        `/curated/as-degrees/${encodeURIComponent(recordId)}/assist`,
        { instruction },
      )
      setProposal(data)
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not produce a change.')
    }
    setBusy(false)
  }

  const apply = async () => {
    setBusy(true)
    setError(null)
    try {
      await save.mutateAsync(proposal.proposed_doc)
      setProposal(null)
      setInstruction('')
      onApplied?.()
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save the change.')
    }
    setBusy(false)
  }

  return (
    <div className='surface-card p-4'>
      <p className='text-body-strong'>Tell the assistant what to change</p>
      <p className='text-caption text-ink-subtle mt-0.5 mb-3'>
        Describe the correction in your own words and it rewrites this degree record.
        It can see the college&apos;s course list but not the catalog page, so tell it
        what the catalog actually says. You review the change before it is saved.
      </p>

      <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3}
        placeholder='e.g. remove PHYS 163 from the program requirements, it is not in the catalog · MATH 115 is missing from the electives · this group should be pick 2 of 4, not all four' />

      {error && <Alert type='error' className='mt-2'>{error}</Alert>}

      {proposal ? (
        <div className='mt-3'>
          <p className='field-label mb-1.5'>Proposed change</p>
          <ul className='flex flex-col gap-1 mb-3'>
            {(proposal.changes || []).map((change, index) => (
              <li key={index} className='text-caption'>
                <span className='text-ink-subtle'>{change.group_id}</span> — {change.summary}
              </li>
            ))}
          </ul>
          <div className='flex gap-2'>
            <Button onClick={apply} disabled={busy}>
              {busy ? 'Saving…' : 'Apply change'}
            </Button>
            <Button variant='ghost' onClick={() => setProposal(null)} disabled={busy}>
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <Button className='mt-2' variant='secondary'
          disabled={!instruction.trim() || busy} onClick={propose}>
          {busy ? 'Thinking…' : 'Propose a change'}
        </Button>
      )}
    </div>
  )
}
