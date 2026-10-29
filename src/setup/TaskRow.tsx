import { HOSTS_LABEL, PERSON_NAMES, PRIORITY_LABELS, SLOTS, type Assignee } from './model'
import type { TaskView } from './rank'

export function assigneeLabel(a: Assignee): string {
  if (a === null) return 'Anyone'
  if (a === 'hosts') return HOSTS_LABEL
  return PERSON_NAMES[a]
}

export function TaskRow(props: {
  view: TaskView
  editors: Map<string, string>
  canEdit: boolean
  first?: boolean
  onToggle: (done: boolean) => void
  onEdit?: () => void
}) {
  const { task, state, waitingOn } = props.view
  const done = state === 'done'
  const waiting = state === 'blocked' || state === 'not_yet'
  const classes = ['task', done && 'done', waiting && 'waiting', props.first && 'first'].filter(Boolean).join(' ')

  return (
    <li className={classes}>
      <button
        className="check"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Untick ${task.text}` : `Tick ${task.text}`}
        onClick={() => props.onToggle(!done)}
      >
        {done ? '✓' : ''}
      </button>
      <div className="task-body">
        {props.canEdit && props.onEdit ? (
          <button className="task-text" onClick={props.onEdit}>{task.text}</button>
        ) : (
          <span className="task-text">{task.text}</span>
        )}
        {task.note && <p className="task-note">{task.note}</p>}
        <div className="meta">
          {done ? (
            <span className="chip quiet">done by {props.editors.get(task.doneBy!) ?? '…'}</span>
          ) : (
            <>
              {state === 'late' && <span className="chip late">late</span>}
              {state === 'blocked' && (
                <span className="chip quiet">waiting on: {waitingOn.map((t) => t.text).join('; ')}</span>
              )}
              {task.slot && state !== 'late' && <span className="chip">{SLOTS[task.slot].label}</span>}
              <span className={`chip ${task.priority === 'must' ? 'must' : ''}`}>{PRIORITY_LABELS[task.priority]}</span>
              <span className="chip">{assigneeLabel(task.assignee)}</span>
            </>
          )}
        </div>
      </div>
    </li>
  )
}
