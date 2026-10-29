export type Person = 'sarah' | 'mark'
export type Viewer = Person | 'helper'
// 'hosts' means Sarah or Mark, never helpers; null means anyone.
export type Assignee = Person | 'hosts' | null
export type Priority = 'must' | 'should' | 'nice'
export type SlotId = 'fri_shops' | 'fri_evening' | 'sat_shops' | 'sat_afternoon' | 'before_doors'

export interface Slot {
  id: SlotId
  label: string
  start: Date
  end: Date
}

// Rough windows in Amsterdam time (UTC+01:00 on both days, since DST ended on 25 October).
// A task with no slot is Anytime.
export const SLOTS: Record<SlotId, Slot> = {
  fri_shops: slot('fri_shops', 'Friday, shops open', '2026-10-30T09:00:00+01:00', '2026-10-30T20:00:00+01:00'),
  fri_evening: slot('fri_evening', 'Friday evening', '2026-10-30T17:00:00+01:00', '2026-10-31T00:00:00+01:00'),
  sat_shops: slot('sat_shops', 'Saturday, shops open', '2026-10-31T09:00:00+01:00', '2026-10-31T18:00:00+01:00'),
  sat_afternoon: slot('sat_afternoon', 'Saturday afternoon', '2026-10-31T12:00:00+01:00', '2026-10-31T19:00:00+01:00'),
  before_doors: slot('before_doors', 'Before doors', '2026-10-31T19:00:00+01:00', '2026-10-31T20:00:00+01:00'),
}

function slot(id: SlotId, label: string, start: string, end: string): Slot {
  return { id, label, start: new Date(start), end: new Date(end) }
}

export const PRIORITY_ORDER: Priority[] = ['must', 'should', 'nice']

export const PRIORITY_LABELS: Record<Priority, string> = {
  must: 'Must',
  should: 'Should',
  nice: 'Nice to have',
}

export const HELPERS_LABEL = 'Pain & Panic'

export const PERSON_NAMES: Record<Person, string> = { sarah: 'Sarah', mark: 'Mark' }

export const HOSTS_LABEL = 'Sarah or Mark'

const HOST_EMAILS: Record<string, Person> = {
  'sarah@frankle.fyi': 'sarah',
  'mark@frankle.fyi': 'mark',
}

export function personFromEmail(email: string | undefined): Person | null {
  return (email && HOST_EMAILS[email.trim().toLowerCase()]) || null
}

export interface Section {
  id: string
  key: string
  title: string
  kind: 'room' | 'shopping' | 'day'
  position: number
}

export interface Task {
  id: string
  key: string
  sectionId: string
  text: string
  note: string | null
  assignee: Assignee
  priority: Priority
  slot: SlotId | null
  position: number
  doneBy: string | null
  doneAt: string | null
}

export interface Blocker {
  itemId: string
  blockedById: string
}

export interface Editor {
  userId: string
  name: string
}

// A task's fixed id, used by SQL scripts that edit the live list.
export function makeKey(text: string, taken: Set<string>): string {
  const suffix = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  const slug = text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34).replace(/-$/, '')
  if (!slug) return `task-${suffix()}`
  return taken.has(slug) ? `${slug}-${suffix()}` : slug
}

// A draft from the editor may have an empty key; the stored one always wins, so scripts keep working.
export function keyForSave(draft: Task, stored: Task | undefined, taken: Set<string>): string {
  return stored?.key || draft.key || makeKey(draft.text, taken)
}

// Swaps a task with its neighbour and renumbers the section, so shared positions get separated.
// Returns only the tasks whose position changed.
export function swapWithNeighbour(tasks: Task[], id: string, direction: -1 | 1): { id: string; position: number }[] {
  const task = tasks.find((t) => t.id === id)
  if (!task) return []
  const siblings = tasks
    .filter((t) => t.sectionId === task.sectionId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  const i = siblings.indexOf(task)
  const j = i + direction
  if (j < 0 || j >= siblings.length) return []
  ;[siblings[i], siblings[j]] = [siblings[j], siblings[i]]
  return siblings.map((t, position) => ({ id: t.id, position })).filter((m) => tasks.find((t) => t.id === m.id)!.position !== m.position)
}
