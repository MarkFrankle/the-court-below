import { describe, expect, test } from 'vitest'
import { personFromEmail, type Blocker, type Section, type Task } from '../../src/setup/model'
import { groupByPriority, groupByRoom, rankNext, viewTasks } from '../../src/setup/rank'

const sections: Section[] = [
  { id: 's1', key: 'kitchen', title: 'Kitchen', kind: 'room', position: 0 },
  { id: 's2', key: 'guest-room', title: 'Guest room', kind: 'room', position: 1 },
  { id: 's3', key: 'empty', title: 'Empty', kind: 'room', position: 2 },
]
const withShop: Section[] = [...sections, { id: 's4', key: 'shop-food', title: 'Shop: food', kind: 'shopping', position: 3 }]

let n = 0
function task(over: Partial<Task> = {}): Task {
  n += 1
  return {
    id: over.id ?? `t${n}`,
    key: over.key ?? `task-${n}`,
    sectionId: 's1',
    text: `Task ${n}`,
    note: null,
    assignee: null,
    priority: 'should',
    slot: null,
    position: n,
    doneBy: null,
    doneAt: null,
    ...over,
  }
}

const friNoon = new Date('2026-10-30T12:00:00+01:00')
const friLate = new Date('2026-10-30T21:00:00+01:00')

function stateOf(tasks: Task[], blockers: Blocker[], id: string, now = friNoon) {
  return viewTasks(tasks, blockers, 'sarah', now).get(id)!
}

describe('personFromEmail', () => {
  test('personFromEmail maps host emails', () => {
    expect(personFromEmail('sarah@frankle.fyi')).toBe('sarah')
    expect(personFromEmail('MARK@frankle.fyi')).toBe('mark')
    expect(personFromEmail('x@y.z')).toBeNull()
    expect(personFromEmail(undefined)).toBeNull()
  })
})

describe('task states', () => {
  test('anytime task with no blockers is doable', () => {
    const a = task()
    expect(stateOf([a], [], a.id).state).toBe('doable')
  })

  test('task with an open blocker is blocked and lists it in waitingOn', () => {
    const a = task()
    const b = task()
    const v = stateOf([a, b], [{ itemId: a.id, blockedById: b.id }], a.id)
    expect(v.state).toBe('blocked')
    expect(v.waitingOn.map((t) => t.id)).toEqual([b.id])
  })

  test('ticking the blocker makes the dependent doable', () => {
    const a = task()
    const b = task({ doneBy: 'u1', doneAt: '2026-10-30T10:00:00Z' })
    const v = stateOf([a, b], [{ itemId: a.id, blockedById: b.id }], a.id)
    expect(v.state).toBe('doable')
    expect(v.waitingOn).toEqual([])
  })

  test('blocker that no longer exists does not block', () => {
    const a = task()
    expect(stateOf([a], [{ itemId: a.id, blockedById: 'gone' }], a.id).state).toBe('doable')
  })

  test('slot not started is not_yet', () => {
    const a = task({ slot: 'fri_evening' })
    expect(stateOf([a], [], a.id).state).toBe('not_yet')
  })

  test('slot ended is late', () => {
    const a = task({ slot: 'fri_shops' })
    expect(stateOf([a], [], a.id, friLate).state).toBe('late')
  })

  test('blocked wins over late', () => {
    const a = task({ slot: 'fri_shops' })
    const b = task()
    expect(stateOf([a, b], [{ itemId: a.id, blockedById: b.id }], a.id, friLate).state).toBe('blocked')
  })

  test('done task is done', () => {
    const a = task({ doneBy: 'u1', doneAt: '2026-10-30T10:00:00Z' })
    expect(stateOf([a], [], a.id).state).toBe('done')
  })
})

describe('rankNext', () => {
  const ids = (views: { task: Task }[]) => views.map((v) => v.task.id)

  test('helpers only see unassigned tasks in Next', () => {
    const a = task({ assignee: 'sarah' })
    const b = task({ assignee: 'mark' })
    const c = task()
    expect(ids(rankNext([a, b, c], sections, [], 'helper', friNoon))).toEqual([c.id])
  })

  test("Sarah sees her tasks and unassigned, not Mark's", () => {
    const a = task({ assignee: 'sarah' })
    const b = task({ assignee: 'mark' })
    const c = task()
    expect(ids(rankNext([a, b, c], sections, [], 'sarah', friNoon)).sort()).toEqual([a.id, c.id].sort())
  })

  test('Sarah-or-Mark tasks show for both hosts, not helpers', () => {
    const a = task({ assignee: 'hosts' })
    expect(ids(rankNext([a], sections, [], 'sarah', friNoon))).toEqual([a.id])
    expect(ids(rankNext([a], sections, [], 'mark', friNoon))).toEqual([a.id])
    expect(ids(rankNext([a], sections, [], 'helper', friNoon))).toEqual([])
  })

  test('a Sarah-or-Mark task does not count as only-mine', () => {
    const shared = task({ assignee: 'hosts' })
    const mine = task({ assignee: 'sarah' })
    expect(ids(rankNext([shared, mine], sections, [], 'sarah', friNoon))).toEqual([mine.id, shared.id])
  })

  test('Next excludes done tasks', () => {
    const a = task({ doneBy: 'u1', doneAt: '2026-10-30T10:00:00Z' })
    const b = task()
    expect(ids(rankNext([a, b], sections, [], 'sarah', friNoon))).toEqual([b.id])
  })

  test('must beats a nice task only Sarah can do', () => {
    const a = task({ assignee: 'sarah', priority: 'nice' })
    const b = task({ priority: 'must' })
    expect(ids(rankNext([a, b], sections, [], 'sarah', friNoon))).toEqual([b.id, a.id])
  })

  test('within a priority, only-mine beats unassigned', () => {
    const a = task()
    const b = task({ assignee: 'sarah' })
    expect(ids(rankNext([a, b], sections, [], 'sarah', friNoon))).toEqual([b.id, a.id])
  })

  test('within a priority, a task that unblocks others beats one that does not', () => {
    const plain = task()
    const unblocker = task()
    const marks = task({ assignee: 'mark' })
    const blockers = [{ itemId: marks.id, blockedById: unblocker.id }]
    const ranked = ids(rankNext([plain, unblocker, marks], sections, blockers, 'sarah', friNoon))
    expect(ranked).toEqual([unblocker.id, plain.id])
    expect(viewTasks([plain, unblocker, marks], blockers, 'sarah', friNoon).get(unblocker.id)!.unblocksOthers).toBe(true)
  })

  test('within a priority and tier, late beats doable', () => {
    const doable = task()
    const late = task({ slot: 'fri_shops' })
    expect(ids(rankNext([doable, late], sections, [], 'sarah', friLate))).toEqual([late.id, doable.id])
  })

  test('Next leaves out tasks that are blocked or not yet due', () => {
    const blocker = task({ priority: 'nice' })
    const blocked = task({ priority: 'must' })
    const notYet = task({ priority: 'must', slot: 'fri_evening' })
    const ranked = ids(rankNext([blocked, notYet, blocker], sections, [{ itemId: blocked.id, blockedById: blocker.id }], 'sarah', friNoon))
    expect(ranked).toEqual([blocker.id])
  })

  test('Next leaves out shopping, but a shopping blocker still blocks', () => {
    const buy = task({ sectionId: 's4' })
    const carve = task()
    const free = task()
    const ranked = ids(rankNext([buy, carve, free], withShop, [{ itemId: carve.id, blockedById: buy.id }], 'sarah', friNoon))
    expect(ranked).toEqual([free.id])
  })
})

describe('groups', () => {
  test('groupByRoom keeps done tasks and empty sections in order', () => {
    const a = task({ sectionId: 's2', position: 1 })
    const b = task({ sectionId: 's1', position: 2, doneBy: 'u1', doneAt: '2026-10-30T10:00:00Z' })
    const c = task({ sectionId: 's1', position: 1 })
    const groups = groupByRoom([a, b, c], sections, [], 'sarah', friNoon)
    expect(groups.map((g) => g.section.id)).toEqual(['s1', 's2', 's3'])
    expect(groups[0].items.map((v) => v.task.id)).toEqual([c.id, b.id])
    expect(groups[2].items).toEqual([])
  })

  test('groupByRoom puts must before should before nice, then position', () => {
    const nice = task({ priority: 'nice', position: 0 })
    const should = task({ priority: 'should', position: 1 })
    const must = task({ priority: 'must', position: 2 })
    const groups = groupByRoom([nice, should, must], sections, [], 'sarah', friNoon)
    expect(groups[0].items.map((v) => v.task.id)).toEqual([must.id, should.id, nice.id])
  })

  test('groupByPriority groups must, should, nice', () => {
    const a = task({ priority: 'nice' })
    const b = task({ priority: 'must' })
    const groups = groupByPriority([a, b], sections, [], 'sarah', friNoon)
    expect(groups.map((g) => g.priority)).toEqual(['must', 'should', 'nice'])
    expect(groups[0].items.map((v) => v.task.id)).toEqual([b.id])
    expect(groups[2].items.map((v) => v.task.id)).toEqual([a.id])
  })

  test('groupByPriority leaves out shopping', () => {
    const a = task({ priority: 'must' })
    const b = task({ priority: 'must', sectionId: 's4' })
    const groups = groupByPriority([a, b], withShop, [], 'sarah', friNoon)
    expect(groups[0].items.map((v) => v.task.id)).toEqual([a.id])
  })
})
