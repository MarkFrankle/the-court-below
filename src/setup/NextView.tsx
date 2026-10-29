import type { Blocker, Section, Task, Viewer } from './model'
import { rankNext } from './rank'
import { TaskRow } from './TaskRow'

export function NextView(props: {
  tasks: Task[]
  sections: Section[]
  blockers: Blocker[]
  viewer: Viewer
  now: Date
  editors: Map<string, string>
  canEdit: boolean
  onToggle: (task: Task, done: boolean) => void
  onEdit: (task: Task) => void
}) {
  const ready = rankNext(props.tasks, props.sections, props.blockers, props.viewer, props.now)
  const row = (view: (typeof ready)[number], first = false) => (
    <TaskRow
      key={view.task.id}
      view={view}
      first={first}
      editors={props.editors}
      canEdit={props.canEdit}
      onToggle={(done) => props.onToggle(view.task, done)}
      onEdit={() => props.onEdit(view.task)}
    />
  )

  if (ready.length === 0) return <p className="empty">Nothing for you right now.</p>
  return <ul className="tasks">{ready.map((v, i) => row(v, i === 0))}</ul>
}
