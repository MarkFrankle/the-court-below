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
  const ranked = rankNext(props.tasks, props.sections, props.blockers, props.viewer, props.now)
  const ready = ranked.filter((v) => v.state === 'doable' || v.state === 'late')
  const waiting = ranked.filter((v) => v.state === 'blocked' || v.state === 'not_yet')
  const row = (view: (typeof ranked)[number], first = false) => (
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

  return (
    <>
      {ready.length === 0 ? (
        <p className="empty">Nothing for you right now.</p>
      ) : (
        <ul className="tasks">{ready.map((v, i) => row(v, i === 0))}</ul>
      )}
      {waiting.length > 0 && (
        <>
          <p className="divider">Coming up</p>
          <ul className="tasks">{waiting.map((v) => row(v))}</ul>
        </>
      )}
    </>
  )
}
