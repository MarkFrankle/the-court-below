import { PRIORITY_LABELS, type Blocker, type Section, type Task, type Viewer } from './model'
import { groupByPriority } from './rank'
import { TaskRow } from './TaskRow'

export function PriorityView(props: {
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
  const groups = groupByPriority(props.tasks, props.sections, props.blockers, props.viewer, props.now)
  return (
    <>
      {groups.map(({ priority, items }) => (
        <section key={priority}>
          <div className="section-head">
            <h2>{PRIORITY_LABELS[priority]}</h2>
            <span className="section-count">
              {items.filter((v) => v.state === 'done').length} of {items.length} done
            </span>
          </div>
          <ul className="tasks">
            {items.map((view) => (
              <TaskRow
                key={view.task.id}
                view={view}
                editors={props.editors}
                canEdit={props.canEdit}
                onToggle={(done) => props.onToggle(view.task, done)}
                onEdit={() => props.onEdit(view.task)}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
