import type { Blocker, Section, Task, Viewer } from './model'
import { groupByRoom } from './rank'
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
  sketches?: boolean
}) {
  const groups = groupByRoom(props.tasks, props.sections, props.blockers, props.viewer, props.now)
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
