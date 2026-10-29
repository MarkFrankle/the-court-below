import { useState } from 'react'
import type { Task } from './model'

export function BlockerPicker(props: {
  taskId: string
  tasks: Task[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const byId = new Map(props.tasks.map((t) => [t.id, t]))
  const q = query.trim().toLowerCase()
  const results = q
    ? props.tasks
        .filter((t) => t.id !== props.taskId && !props.selected.includes(t.id) && t.text.toLowerCase().includes(q))
        .slice(0, 8)
    : []

  return (
    <div className="field">
      Waits on
      {props.selected.length > 0 && (
        <div className="meta">
          {props.selected.map((id) => (
            <span key={id} className="chip">
              {byId.get(id)?.text ?? 'deleted task'}
              <button aria-label="Remove" onClick={() => props.onChange(props.selected.filter((s) => s !== id))}>×</button>
            </span>
          ))}
        </div>
      )}
      <input placeholder="Search tasks to wait on" value={query} onChange={(e) => setQuery(e.target.value)} />
      {results.length > 0 && (
        <ul className="picker-results">
          {results.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => {
                  props.onChange([...props.selected, t.id])
                  setQuery('')
                }}
              >
                {t.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
