import { useEffect, useReducer } from 'react'
import { Modal, Button, Input, Alert, Spinner, Stack } from '../../../../components/ui'
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  useAuditGrouping,
  useCreateGrouping,
  useRenameGrouping,
  useDeleteGrouping
} from '@frontend/query/hooks/useAudit'
import NewGroupingForm from './NewGroupingForm'

const INITIAL = {
  mode: 'browse', // 'browse' | 'new'
  highlightId: null,
  renameId: null,
  renameValue: '',
  confirmDeleteId: null,
  newName: '',
  newMembers: [],
  createError: ''
}

function reducer(state, action) {
  switch (action.type) {
    // Modal opened — discard in-flight edits, highlight the active/first grouping.
    case 'open':
      return { ...INITIAL, highlightId: action.highlightId }
    case 'browse':
      return { ...state, mode: 'browse', highlightId: action.id }
    case 'startCreate':
      return { ...state, mode: 'new', newName: '', newMembers: [], createError: '' }
    case 'cancelCreate':
      return { ...state, mode: 'browse' }
    case 'setNewName':
      return { ...state, newName: action.value }
    case 'setNewMembers':
      return { ...state, newMembers: action.members }
    case 'createError':
      return { ...state, createError: action.error }
    case 'startRename':
      return { ...state, renameId: action.id, renameValue: action.value }
    case 'setRenameValue':
      return { ...state, renameValue: action.value }
    case 'cancelRename':
      return { ...state, renameId: null, renameValue: '' }
    case 'renamed':
      return { ...state, renameId: null, renameValue: '' }
    case 'confirmDelete':
      return { ...state, confirmDeleteId: action.id }
    case 'cancelDelete':
      return { ...state, confirmDeleteId: null }
    case 'deleted':
      return { ...state, confirmDeleteId: null, highlightId: action.clearHighlight ? null : state.highlightId }
    default:
      return state
  }
}

export default function GroupingsManager({ open, onClose, groupings, activeGroupingId, onApply, onCleared }) {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const { mode, highlightId, renameId, renameValue, confirmDeleteId, newName, newMembers, createError } = state

  const renameMut = useRenameGrouping()
  const deleteMut = useDeleteGrouping()
  const createMut = useCreateGrouping()

  // Reset local state every time the modal opens — old in-flight edits or
  // half-built groupings shouldn't bleed across sessions. `groupings` is
  // deliberately excluded from the dep array: opening with current state
  // matters, but later list updates shouldn't reset what the user is doing.
  useEffect(() => {
    if (open) {
      dispatch({ type: 'open', highlightId: activeGroupingId || (groupings[0]?._id ?? null) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeGroupingId])

  const previewQ = useAuditGrouping(mode === 'browse' ? highlightId : null)

  const startCreate = () => dispatch({ type: 'startCreate' })

  const submitCreate = async () => {
    const name = newName.trim()
    if (!name) {
      dispatch({ type: 'createError', error: 'Name is required.' })
      return
    }
    if (!newMembers.length) {
      dispatch({ type: 'createError', error: 'Add at least one (school, major) pair.' })
      return
    }
    try {
      const created = await createMut.mutateAsync({ name, members: newMembers })
      onApply(created._id)
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to create.'
      dispatch({ type: 'createError', error: msg })
    }
  }

  const submitRename = async (id) => {
    const name = renameValue.trim()
    if (!name) return
    try {
      await renameMut.mutateAsync({ id, name })
      dispatch({ type: 'renamed' })
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to rename.'
      alert(msg) // surfacing inline is overkill for this rare path; alert is fine
    }
  }

  const submitDelete = async (id) => {
    try {
      await deleteMut.mutateAsync({ id })
      if (id === activeGroupingId) onCleared?.()
      dispatch({ type: 'deleted', clearHighlight: id === highlightId })
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || 'Failed to delete.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title='Manage groupings'
      subtitle='Named sets of (school, major) pairs. Membership is immutable — delete and recreate to change pairs.'
      size='xl'
    >
      <div className='grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 min-h-[420px]'>
        {/* ────── List ────── */}
        <div className='flex flex-col gap-2 min-h-0'>
          <div className='flex items-center justify-between gap-2'>
            <p className='text-label'>Saved ({groupings.length})</p>
            <Button size='sm' leadingIcon={PlusIcon} onClick={startCreate}>
              New
            </Button>
          </div>
          <div className='flex flex-col gap-1 overflow-y-auto max-h-[420px] -mx-1 px-1'>
            {groupings.length === 0 && mode !== 'new' && (
              <p className='text-caption text-ink-subtle italic py-3'>
                No groupings yet. Click <span className='text-ink-muted'>New</span> to create one.
              </p>
            )}
            {groupings.map((g) => {
              const active = g._id === activeGroupingId
              const highlighted = mode === 'browse' && g._id === highlightId
              const renaming = g._id === renameId
              const deleting = g._id === confirmDeleteId
              return (
                <div
                  key={g._id}
                  className={`px-3 py-2 rounded-md border transition-colors ${
                    highlighted ? 'border-primary bg-primary-soft' : 'border-border'
                  } ${active ? 'ring-1 ring-success/40' : ''}`}
                >
                  {renaming ? (
                    <div className='flex flex-col gap-2'>
                      <Input
                        value={renameValue}
                        onChange={(e) => dispatch({ type: 'setRenameValue', value: e.target.value })}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRename(g._id)
                        }}
                      />
                      <div className='flex gap-1.5'>
                        <Button size='sm' onClick={() => submitRename(g._id)} disabled={renameMut.isPending}>
                          Save
                        </Button>
                        <Button size='sm' variant='ghost' onClick={() => dispatch({ type: 'cancelRename' })}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Stack gap='tight'>
                      <button
                        type='button'
                        onClick={() => dispatch({ type: 'browse', id: g._id })}
                        className='text-left w-full'
                      >
                        <div className='text-body-strong break-words leading-snug'>{g.name}</div>
                        <div className='text-caption text-ink-subtle'>
                          {g.member_count} pair{g.member_count === 1 ? '' : 's'}
                          {active && (
                            <>
                              {' '}
                              · <span className='text-success'>active</span>
                            </>
                          )}
                        </div>
                      </button>
                      <div className='flex gap-1.5'>
                        <Button size='sm' onClick={() => onApply(g._id)}>
                          Apply
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          leadingIcon={PencilSquareIcon}
                          onClick={() => dispatch({ type: 'startRename', id: g._id, value: g.name })}
                        >
                          Rename
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          leadingIcon={TrashIcon}
                          onClick={() => dispatch({ type: 'confirmDelete', id: g._id })}
                        >
                          Delete
                        </Button>
                      </div>
                      {deleting && (
                        <div className='p-2 rounded-md bg-danger-soft text-danger flex flex-col gap-2'>
                          <p className='text-caption'>Delete this grouping?</p>
                          <div className='flex gap-1.5'>
                            <Button
                              size='sm'
                              variant='danger'
                              onClick={() => submitDelete(g._id)}
                              disabled={deleteMut.isPending}
                            >
                              Yes, delete
                            </Button>
                            <Button size='sm' variant='ghost' onClick={() => dispatch({ type: 'cancelDelete' })}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </Stack>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ────── Right pane ────── */}
        <div className='flex flex-col gap-3 min-h-0'>
          {mode === 'new' ? (
            <NewGroupingForm
              name={newName}
              setName={(value) => dispatch({ type: 'setNewName', value })}
              members={newMembers}
              setMembers={(members) => dispatch({ type: 'setNewMembers', members })}
              error={createError}
              clearError={() => dispatch({ type: 'createError', error: '' })}
              onCancel={() => dispatch({ type: 'cancelCreate' })}
              onSubmit={submitCreate}
              busy={createMut.isPending}
            />
          ) : (
            <GroupingPreview grouping={previewQ.data} loading={previewQ.isLoading} />
          )}
        </div>
      </div>
    </Modal>
  )
}

function GroupingPreview({ grouping, loading }) {
  if (loading)
    return (
      <div className='flex items-center gap-2 text-caption'>
        <Spinner /> Loading…
      </div>
    )
  if (!grouping) {
    return (
      <p className='text-caption text-ink-subtle italic'>
        Select a grouping on the left, or click <span className='text-ink-muted'>New</span> to create one.
      </p>
    )
  }
  // Highlight zero-match pairs at the top so silent picker/storage mismatches
  // surface immediately (e.g. the "trailing space stripped" UC Merced case).
  const zeroMatchCount = (grouping.members || []).filter((m) => (m.doc_count ?? 0) === 0).length
  return (
    <div className='flex flex-col gap-3'>
      <div>
        <p className='text-label'>Name</p>
        <p className='text-body-strong'>{grouping.name}</p>
      </div>
      {zeroMatchCount > 0 && (
        <Alert type='warning'>
          {zeroMatchCount} pair{zeroMatchCount === 1 ? '' : 's'} match no agreements. Usually a whitespace or casing
          difference between the stored major and ASSIST. Delete and re-add the affected pairs from the picker.
        </Alert>
      )}
      <Stack gap='tight'>
        <p className='text-label'>
          Members <span className='text-ink-subtle font-mono'>({grouping.member_count})</span>
        </p>
        <div className='hairline-t pt-2 flex flex-col gap-2 max-h-[340px] overflow-y-auto'>
          {(grouping.members || []).map((m, i) => {
            const n = m.doc_count ?? 0
            const zero = n === 0
            return (
              <div key={i} className={`flex items-center gap-2 text-body ${zero ? 'text-danger' : ''}`}>
                <span className={zero ? 'text-danger' : 'text-ink-subtle'}>
                  {m.school_name || `School #${m.school_id}`}
                </span>
                <span className='text-ink-subtle'>·</span>
                <span className={`break-words flex-1 min-w-0 ${zero ? 'text-danger' : 'text-ink'}`}>{m.major}</span>
                <span
                  className={`font-mono text-caption tabular-nums shrink-0 ${zero ? 'text-danger' : 'text-ink-subtle'}`}
                >
                  {n} doc{n === 1 ? '' : 's'}
                </span>
              </div>
            )
          })}
          {(grouping.members || []).length === 0 && (
            <p className='text-caption text-ink-subtle italic'>(no members)</p>
          )}
        </div>
      </Stack>
    </div>
  )
}
