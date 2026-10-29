import { PRIORITY_ORDER, type Blocker, type Section, type Task, type Viewer } from './model'
import { groupByRoom, type TaskView } from './rank'
import { SortableTasks } from './SortableTasks'
import { TaskRow } from './TaskRow'

const SKETCHES = [
  ['guest-room.jpg', 'Guest room sketch'],
  ['kitchen.jpg', 'Kitchen sketch'],
  ['living-room.jpg', 'Living room notes'],
  ['menu-and-todo.jpg', 'Menu and to-do notes'],
]

export function RoomView(props: {
  tasks: Task[]
  sections: Section[]
  blockers: Blocker[]
  viewer: Viewer
  now: Date
  editors: Map<string, string>
  canEdit: boolean
  onToggle: (task: Task, done: boolean) => void
  onEdit: (task: Task) => void
  onAdd: (section: Section) => void
  onRenameSection: (section: Section) => void
  onAddSection: () => void
  onReorder: (id: string, overId: string) => void
  sketches?: boolean
}) {
  const groups = groupByRoom(props.tasks, props.sections, props.blockers, props.viewer, props.now)
  const rowProps = (view: TaskView) => ({
    editors: props.editors,
    canEdit: props.canEdit,
    onToggle: (done: boolean) => props.onToggle(view.task, done),
    onEdit: () => props.onEdit(view.task),
  })
  return (
    <>
      {groups.map(({ section, items }) => (
        <section key={section.id}>
          <div className="section-head">
            {props.canEdit ? (
              <h2><button className="task-text" style={{ font: 'inherit', color: 'inherit' }} onClick={() => props.onRenameSection(section)}>{section.title}</button></h2>
            ) : (
              <h2>{section.title}</h2>
            )}
            <span className="section-count">
              {items.filter((v) => v.state === 'done').length} of {items.length} done
            </span>
          </div>
          {props.canEdit ? (
            PRIORITY_ORDER.map((p) => items.filter((v) => v.task.priority === p)).filter((run) => run.length > 0).map((run) => (
              <SortableTasks key={run[0].task.priority} items={run} row={rowProps} onReorder={props.onReorder} />
            ))
          ) : (
            <ul className="tasks">
              {items.map((view) => <TaskRow key={view.task.id} view={view} {...rowProps(view)} />)}
            </ul>
          )}
          {props.canEdit && (
            <button className="button ghost add" onClick={() => props.onAdd(section)}>+ Add task</button>
          )}
        </section>
      ))}
      {props.canEdit && (
        <p><button className="button ghost add" onClick={props.onAddSection}>+ Add section</button></p>
      )}
      {props.sketches && (
        <div className="sketches">
          {SKETCHES.map(([file, alt]) => (
            <img key={file} src={`/sketches/${file}`} alt={alt} loading="lazy" />
          ))}
        </div>
      )}
    </>
  )
}
