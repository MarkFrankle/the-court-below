import { PRIORITY_ORDER, SLOTS, type Blocker, type Priority, type Section, type Task, type Viewer } from './model'

export type TaskState = 'done' | 'doable' | 'late' | 'blocked' | 'not_yet'

export interface TaskView {
  task: Task
  state: TaskState
  waitingOn: Task[]
  unblocksOthers: boolean
}

export function viewTasks(tasks: Task[], blockers: Blocker[], viewer: Viewer, now: Date): Map<string, TaskView> {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const waitingOn = new Map<string, Task[]>()
  const dependents = new Map<string, Task[]>()
  for (const b of blockers) {
    const item = byId.get(b.itemId)
    const blocker = byId.get(b.blockedById)
    // A blocker row pointing at a deleted task blocks nothing.
    if (!item || !blocker) continue
    if (!blocker.doneBy) push(waitingOn, item.id, blocker)
    push(dependents, blocker.id, item)
  }

  const views = new Map<string, TaskView>()
  for (const task of tasks) {
    const open = waitingOn.get(task.id) ?? []
    const unblocksOthers = (dependents.get(task.id) ?? []).some(
      (d) => !d.doneBy && (d.assignee === null || d.assignee !== viewer),
    )
    views.set(task.id, { task, state: stateOf(task, open, now), waitingOn: open, unblocksOthers })
  }
  return views
}

function stateOf(task: Task, waitingOn: Task[], now: Date): TaskState {
  if (task.doneBy) return 'done'
  if (waitingOn.length > 0) return 'blocked'
  if (!task.slot) return 'doable'
  const slot = SLOTS[task.slot]
  if (now < slot.start) return 'not_yet'
  if (now >= slot.end) return 'late'
  return 'doable'
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

// Next is only what you can do right now: open, unblocked, in its slot or late, and not shopping.
// Ranking still sees every task, so a shopping item can block a to-do.
export function rankNext(tasks: Task[], sections: Section[], blockers: Blocker[], viewer: Viewer, now: Date): TaskView[] {
  const shopping = shoppingSections(sections)
  const place = placement(sections)
  const ready = [...viewTasks(tasks, blockers, viewer, now).values()].filter(
    (v) => (v.state === 'doable' || v.state === 'late') && isForViewer(v.task, viewer) && !shopping.has(v.task.sectionId),
  )

  // Anything due before friends arrive on Friday outranks every priority.
  const beforeFriends = (v: TaskView) => Number(v.task.slot === 'fri_before_friends')
  return ready.sort((a, b) =>
    beforeFriends(b) - beforeFriends(a)
    || priorityRank(a.task.priority) - priorityRank(b.task.priority)
    || Number(isMineOrUnblocking(b, viewer)) - Number(isMineOrUnblocking(a, viewer))
    || Number(b.state === 'late') - Number(a.state === 'late')
    || slotEnd(a.task) - slotEnd(b.task)
    || place(a.task) - place(b.task))
}

function shoppingSections(sections: Section[]): Set<string> {
  return new Set(sections.filter((s) => s.kind === 'shopping').map((s) => s.id))
}

function isForViewer(task: Task, viewer: Viewer): boolean {
  if (task.assignee === null) return true
  if (viewer === 'helper') return false
  return task.assignee === viewer || task.assignee === 'hosts'
}

function isMineOrUnblocking(v: TaskView, viewer: Viewer): boolean {
  return v.task.assignee === viewer || v.unblocksOthers
}

function priorityRank(p: Priority): number {
  return PRIORITY_ORDER.indexOf(p)
}

function slotEnd(task: Task): number {
  return task.slot ? SLOTS[task.slot].end.getTime() : Infinity
}

// Orders tasks by section position, then by position within the section.
function placement(sections: Section[]): (task: Task) => number {
  const sectionPos = new Map(sections.map((s) => [s.id, s.position]))
  return (task) => (sectionPos.get(task.sectionId) ?? Infinity) * 1e6 + task.position
}

export function groupByRoom(tasks: Task[], sections: Section[], blockers: Blocker[], viewer: Viewer, now: Date) {
  const views = viewTasks(tasks, blockers, viewer, now)
  return [...sections]
    .sort((a, b) => a.position - b.position)
    .map((section) => ({
      section,
      items: tasks
        .filter((t) => t.sectionId === section.id)
        .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.position - b.position)
        .map((t) => views.get(t.id)!),
    }))
}

export function groupByPriority(tasks: Task[], sections: Section[], blockers: Blocker[], viewer: Viewer, now: Date) {
  const views = viewTasks(tasks, blockers, viewer, now)
  const place = placement(sections)
  const shopping = shoppingSections(sections)
  const sorted = tasks.filter((t) => !shopping.has(t.sectionId)).sort((a, b) => place(a) - place(b))
  return PRIORITY_ORDER.map((priority) => ({
    priority,
    items: sorted.filter((t) => t.priority === priority).map((t) => views.get(t.id)!),
  }))
}
