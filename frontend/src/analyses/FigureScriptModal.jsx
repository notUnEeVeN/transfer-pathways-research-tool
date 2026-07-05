import React from 'react'
import {
  ClipboardIcon, ArrowPathIcon, LinkSlashIcon, CodeBracketIcon,
} from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, Badge, SwitchField, Modal } from '../components/ui'
import { useFigureScript, useRefreshFigureScript, useSetFigureScriptEnabled, useDetachFigureScript } from '@frontend/query/hooks/useData'
import { fmtDate } from '../shared/fmtDate'

// Gallery-card pill for live figures. Static figures get null (their existing
// dataset-version chip already tells the story).
export function liveBadge(fig) {
  if (fig?.mode !== 'live') return null
  if (fig.live?.status === 'error') return { variant: 'conservative', text: 'Live · refresh failed' }
  const when = fmtDate(fig.live?.computed_at)
  return { variant: 'success', text: when ? `Live · ${when}` : 'Live' }
}

const runStatusVariant = { ok: 'success', error: 'danger', timeout: 'danger' }

/**
 * The script behind a live figure. Everyone with console access can read the
 * code (that's the collaboration story — copy it, change the slug, publish
 * your own variant); the run log and controls are owner/admin only.
 */
export function FigureScriptModalView({
  open, onClose, slug, title, script, isLoading, isError, canModify,
  onRefresh, refreshing = false, refreshError = null,
  onToggleEnabled, toggling = false,
  onDetach, detaching = false,
}) {
  const copyCode = () => navigator.clipboard.writeText(script?.code || '')
  return (
    <Modal open={open} onClose={onClose} size='xl' title={title || slug}
      subtitle={<span className='font-mono'>{slug}</span>}
      leading={<CodeBracketIcon className='w-5 h-5 text-ink-subtle shrink-0' />}>
      {isLoading && <div className='flex justify-center py-10'><Spinner /></div>}
      {isError && <Alert type='error'>Could not load the script behind this figure.</Alert>}
      {script && (
        <div className='flex flex-col gap-4'>
          {canModify && (
            <div className='surface-card p-4 flex flex-col gap-3'>
              <div className='flex flex-wrap items-center gap-3'>
                {script.last_run && (
                  <>
                    <Badge variant={runStatusVariant[script.last_run.status] || 'neutral'}>
                      {script.last_run.status}
                    </Badge>
                    <span className='text-caption text-ink-muted'>
                      last run {fmtDate(script.last_run.started_at)}
                      {script.last_run.duration_ms != null && ` · ${(script.last_run.duration_ms / 1000).toFixed(1)}s`}
                      {script.last_run.dataset_version && ` · dataset ${script.last_run.dataset_version}`}
                      {` · via ${script.last_run.trigger || '?'}`}
                    </span>
                  </>
                )}
                {script.consecutive_failures > 0 && (
                  <Badge variant='conservative'>{script.consecutive_failures} consecutive failures</Badge>
                )}
                <div className='ml-auto flex items-center gap-3'>
                  <SwitchField label={script.enabled ? 'Auto-refresh on' : 'Auto-refresh off'}
                    srLabel='Re-run this script automatically when the data changes'
                    checked={!!script.enabled} disabled={toggling}
                    onChange={() => onToggleEnabled(!script.enabled)} />
                  <Button variant='ghost' leadingIcon={ArrowPathIcon} disabled={refreshing}
                    onClick={onRefresh}>{refreshing ? 'Running…' : 'Run again now'}</Button>
                </div>
              </div>
              {refreshError && <Alert type='error'>{refreshError}</Alert>}
              {script.last_run?.log && (
                <pre className='p-3 rounded-md bg-surface-hover text-[11px] leading-relaxed font-mono overflow-auto max-h-48 whitespace-pre-wrap'>
                  {script.last_run.log}
                </pre>
              )}
            </div>
          )}

          <div className='surface-card'>
            <div className='flex items-center gap-2 px-3 py-2 border-b border-border'>
              <span className='text-caption text-ink-subtle font-mono'>{slug}.py</span>
              <div className='ml-auto flex gap-1'>
                <Button variant='ghost' leadingIcon={ClipboardIcon} onClick={copyCode}>Copy</Button>
              </div>
            </div>
            <pre className='p-3 text-[11px] leading-relaxed font-mono overflow-auto max-h-[45vh] whitespace-pre'>
              {script.code}
            </pre>
          </div>

          <p className='text-caption text-ink-subtle'>
            {canModify ? (
              <>Update it by editing the file locally and running{' '}
                <span className='font-mono text-ink'>pmt.publish_script("{slug}.py")</span> again.</>
            ) : (
              <>Want a variant? Copy the code, change the slug inside{' '}
                <span className='font-mono text-ink'>pmt.publish(…)</span>, and publish it as your own
                with <span className='font-mono text-ink'>pmt.publish_script(…)</span>.</>
            )}
          </p>

          {canModify && (
            <div className='flex justify-end'>
              <Button variant='ghost' leadingIcon={LinkSlashIcon} disabled={detaching}
                onClick={() => {
                  if (window.confirm('Detach the script? The figure stays as a static snapshot and stops auto-refreshing.')) onDetach()
                }}>
                {detaching ? 'Detaching…' : 'Detach script (make static)'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// Container: fetch + mutations. `cardCanModify` is the gallery's owner/admin
// verdict; the server's can_modify (returned with the script) wins once loaded.
export default function FigureScriptModal({ open, onClose, slug, title, cardCanModify = false }) {
  const q = useFigureScript(slug, { enabled: open })
  const refresh = useRefreshFigureScript()
  const toggle = useSetFigureScriptEnabled()
  const detach = useDetachFigureScript()
  return (
    <FigureScriptModalView
      open={open}
      onClose={onClose}
      slug={slug}
      title={title}
      script={q.data}
      isLoading={q.isLoading}
      isError={q.isError}
      canModify={q.data?.can_modify ?? cardCanModify}
      onRefresh={() => refresh.mutate(slug)}
      refreshing={refresh.isPending}
      refreshError={refresh.isError
        ? (refresh.error?.response?.data?.error || 'The run failed — see the log above once it reloads.')
        : null}
      onToggleEnabled={(enabled) => toggle.mutate({ slug, enabled })}
      toggling={toggle.isPending}
      onDetach={() => detach.mutate(slug, { onSuccess: onClose })}
      detaching={detach.isPending}
    />
  )
}
