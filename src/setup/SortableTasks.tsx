import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ComponentProps } from 'react'
import { TaskRow } from './TaskRow'
import type { TaskView } from './rank'

type RowProps = Omit<ComponentProps<typeof TaskRow>, 'view' | 'liRef' | 'liStyle' | 'handle'>

// One drag list per priority within a room, so a task can only be dragged among tasks of the same priority.
export function SortableTasks(props: {
  items: TaskView[]
  row: (view: TaskView) => RowProps
  onReorder: (id: string, overId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function end(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) props.onReorder(String(e.active.id), String(e.over.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={end}>
      <SortableContext items={props.items.map((v) => v.task.id)} strategy={verticalListSortingStrategy}>
        <ul className="tasks">
          {props.items.map((view) => <SortableTaskRow key={view.task.id} view={view} {...props.row(view)} />)}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableTaskRow(props: RowProps & { view: TaskView }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.view.task.id })
  return (
    <TaskRow
      {...props}
      liRef={setNodeRef}
      liStyle={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 1 : undefined }}
      handle={
        <button className="drag-handle" ref={setActivatorNodeRef} aria-label={`Reorder ${props.view.task.text}`} {...attributes} {...listeners}>
          ☰
        </button>
      }
    />
  )
}
