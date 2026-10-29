import { useState } from 'react'
import { BlockerPicker } from './BlockerPicker'
import { PRIORITY_LABELS, PRIORITY_ORDER, SLOTS, type Assignee, type Priority, type Section, type SlotId, type Task } from './model'
import { assigneeLabel } from './TaskRow'

const ASSIGNEES: Assignee[] = [null, 'sarah', 'mark', 'hosts']

export function TaskEditor(props: {
  task: Task
  isNew: boolean
  tasks: Task[]
  sections: Section[]
  blockedBy: string[]
  onSave: (task: Task, blockedBy: string[]) => Promise<void>
  onDelete: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(props.task)
  const [blockedBy, setBlockedBy] = useState(props.blockedBy)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Task>) => setDraft((d) => ({ ...d, ...patch }))

  async function save() {
    if (!draft.text.trim()) {
      setError('A task needs some text.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await props.onSave({ ...draft, text: draft.text.trim(), note: draft.note?.trim() || null }, blockedBy)
      props.onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message.includes('blocker loop') ? 'That would make a loop.' : message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className="sheet" role="dialog" aria-label={props.isNew ? 'New task' : 'Edit task'} onClick={(e) => e.stopPropagation()}>
        <h2>{props.isNew ? 'New task' : 'Edit task'}</h2>
        <div className="form">
          <label className="field">
            Task
            <textarea value={draft.text} maxLength={200} onChange={(e) => set({ text: e.target.value })} autoFocus={props.isNew} />
          </label>
          <label className="field">
            Note
            <input value={draft.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
          </label>
          <div className="row">
            <label className="field">
              Who
              <select value={draft.assignee ?? ''} onChange={(e) => set({ assignee: (e.target.value || null) as Assignee })}>
                {ASSIGNEES.map((a) => (
                  <option key={a ?? 'anyone'} value={a ?? ''}>{assigneeLabel(a)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Priority
              <select value={draft.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <label className="field">
              When
              <select value={draft.slot ?? ''} onChange={(e) => set({ slot: (e.target.value || null) as SlotId | null })}>
                <option value="">Anytime</option>
                {Object.values(SLOTS).map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Room
              <select value={draft.sectionId} onChange={(e) => set({ sectionId: e.target.value })}>
                {[...props.sections].sort((a, b) => a.position - b.position).map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </label>
          </div>
          <BlockerPicker
            taskId={draft.id}
            tasks={props.tasks}
            selected={blockedBy}
            onChange={setBlockedBy}
          />
          {error && <p className="error">{error}</p>}
        </div>
        <div className="actions">
          {props.isNew ? <span /> : <button className="button danger" onClick={props.onDelete}>Delete</button>}
          <span style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="button ghost" onClick={props.onClose}>Cancel</button>
            <button className="button" onClick={save} disabled={busy}>Save</button>
          </span>
        </div>
      </div>
    </div>
  )
}
