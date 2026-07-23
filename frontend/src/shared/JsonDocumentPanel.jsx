import React, { useEffect, useRef, useState } from 'react'
import { Alert, Button } from '../components/ui'

/**
 * A stored document, open for editing as its own JSON.
 *
 * Edit the JSON by hand, or copy the briefing into whichever AI you like, tell
 * it what to change, and paste the result back. Either way the view above
 * redraws on every valid keystroke, so the structure is checked by reading it
 * rather than by trusting the edit. Nothing is written until the caller saves —
 * this only moves the draft.
 *
 * The document's meaning is the caller's: `buildBriefing()` supplies the
 * AI briefing, and `ariaLabel` / `redrawNote` name what redraws above. This is
 * shared by the associate-degree editor and the four-year graduation-template
 * editor so the two behave identically.
 */
export default function JsonDocumentPanel({
  doc,
  onChange,
  buildBriefing,
  ariaLabel = 'Document JSON',
  redrawNote = 'The view above redraws as you type.',
}) {
  const [text, setText] = useState(() => JSON.stringify(doc, null, 2))
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  // What this box last handed upward. Lets the effect below tell "the doc
  // changed because I typed" from "the doc changed under me" (an outside edit,
  // or switching records) without stomping on the cursor mid-edit.
  const emitted = useRef(text)

  useEffect(() => {
    const next = JSON.stringify(doc, null, 2)
    if (next === emitted.current) return
    emitted.current = next
    setText(next)
    setError(null)
  }, [doc])

  const edit = (value) => {
    setText(value)
    let parsed
    try {
      parsed = JSON.parse(value)
    } catch (e) {
      // Half-typed JSON is the normal state of a textarea — say so plainly and
      // leave the last valid version on screen above.
      setError(e.message)
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('The document must be a JSON object.')
      return
    }
    setError(null)
    emitted.current = JSON.stringify(parsed, null, 2)
    onChange(parsed)
  }

  const copyBriefing = async () => {
    await navigator.clipboard.writeText(buildBriefing())
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className='surface-card p-4'>
      <div className='flex flex-wrap items-start gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-body-strong'>Document</p>
          <p className='text-caption text-ink-subtle mt-0.5'>
            Edit it directly, or copy the briefing into an AI, describe the fix, and
            paste its answer back. {redrawNote}
          </p>
        </div>
        <Button variant='secondary' className='shrink-0' onClick={copyBriefing}>
          {copied ? 'Copied' : 'Copy AI briefing'}
        </Button>
      </div>

      <textarea value={text} onChange={(e) => edit(e.target.value)}
        spellCheck={false} rows={18} aria-label={ariaLabel}
        className={`mt-3 w-full rounded-md border bg-surface-sunken px-3 py-2.5 font-mono text-[12px] leading-[1.55] text-ink ${
          error ? 'border-danger' : 'border-border-strong'
        }`} />

      {error
        ? <Alert type='error' className='mt-2'>Not valid JSON yet — {error}</Alert>
        : <p className='mt-1.5 text-caption text-ink-subtle'>Valid JSON · the view above matches this document.</p>}
    </div>
  )
}
