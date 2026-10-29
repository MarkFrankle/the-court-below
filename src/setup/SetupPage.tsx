import { useEffect, useState } from 'react'
import * as api from './api'
import { makeKey, type Section, type Task } from './model'
import { NextView } from './NextView'
import { PriorityView } from './PriorityView'
import { RoomView } from './RoomView'
import { SignIn } from './SignIn'
import { TaskEditor } from './TaskEditor'
import { useSetupData } from './useSetupData'
import { useUndo } from './Undo'
import './setup.css'

type Tab = 'next' | 'room' | 'priority'
const TABS: [Tab, string][] = [['next', 'Next'], ['room', 'By room'], ['priority', 'By priority']]

function savedTab(): Tab {
  try {
    const t = localStorage.getItem('setup-tab')
    return t === 'room' || t === 'priority' ? t : 'next'
  } catch {
    return 'next'
  }
}

export function SetupPage() {
  const [session, setSession] = useState<api.Session | null | 'loading'>('loading')
  useEffect(() => {
    api.currentSession().then(setSession, () => setSession(null))
  }, [])

  if (session === 'loading') return <div className="setup"><p className="empty">Opening the gates…</p></div>
  if (!session) return <SignIn onSignedIn={setSession} />
  return <Checklist session={session} onSignOut={() => api.signOut().then(() => setSession(null))} />
}

function Checklist(props: { session: api.Session; onSignOut: () => void }) {
  const { session } = props
  const data = useSetupData(true)
  const undo = useUndo()
  const [tab, setTab] = useState<Tab>(savedTab)
  const [now, setNow] = useState(() => new Date())
  const [editing, setEditing] = useState<{ task: Task; isNew: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canEdit = session.viewer !== 'helper'

  // Slots roll over without a reload.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  function chooseTab(t: Tab) {
    setTab(t)
    try {
      localStorage.setItem('setup-tab', t)
    } catch {
      // Private mode: the tab just isn't remembered.
    }
  }

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      data.refresh()
    }
  }

  function toggle(task: Task, done: boolean) {
    data.patchTask(task.id, done ? { doneBy: session.userId, doneAt: new Date().toISOString() } : { doneBy: null, doneAt: null })
    run(() => api.setDone(task.id, done))
    if (done) undo.show(`Ticked: ${task.text}`, () => toggle(task, false))
  }

  function add(section: Section) {
    const inSection = data.tasks.filter((t) => t.sectionId === section.id)
    setEditing({
      isNew: true,
      task: {
        id: crypto.randomUUID(), key: '', sectionId: section.id, text: '', note: null, assignee: null,
        priority: 'should', slot: null, position: Math.max(-1, ...inSection.map((t) => t.position)) + 1,
        doneBy: null, doneAt: null,
      },
    })
  }

  async function save(task: Task, blockedBy: string[]) {
    const original = data.tasks.find((t) => t.id === task.id)
    let next = task
    if (!original) {
      next = { ...task, key: makeKey(task.text, new Set(data.tasks.map((t) => t.key))) }
    } else if (original.sectionId !== task.sectionId) {
      // Moving to another room puts the task last there.
      const there = data.tasks.filter((t) => t.sectionId === task.sectionId)
      next = { ...task, position: Math.max(-1, ...there.map((t) => t.position)) + 1 }
    }
    await api.saveTask(next)
    await api.setBlockers(next.id, blockedBy)
    data.refresh()
  }

  function remove(task: Task) {
    const related = data.blockers.filter((b) => b.itemId === task.id || b.blockedById === task.id)
    setEditing(null)
    run(() => api.deleteTask(task.id))
    undo.show(`Deleted: ${task.text}`, () => run(() => api.restoreTask(task, related)))
  }

  function move(task: Task, direction: -1 | 1) {
    const siblings = data.tasks.filter((t) => t.sectionId === task.sectionId).sort((a, b) => a.position - b.position)
    const i = siblings.findIndex((t) => t.id === task.id)
    const other = siblings[i + direction]
    if (!other) return
    run(async () => {
      await api.saveTask({ ...task, position: other.position })
      await api.saveTask({ ...other, position: task.position })
    })
    setEditing({ task: { ...task, position: other.position }, isNew: false })
  }

  function renameSection(section: Section) {
    const title = window.prompt('Rename section', section.title)?.trim()
    if (title && title !== section.title) run(() => api.saveSection({ ...section, title }))
  }

  function addSection() {
    const title = window.prompt('New section name')?.trim()
    if (!title) return
    const key = makeKey(title, new Set(data.sections.map((s) => s.key)))
    const position = Math.max(-1, ...data.sections.map((s) => s.position)) + 1
    run(() => api.saveSection({ id: crypto.randomUUID(), key, title, kind: 'room', position }))
  }

  const viewProps = {
    tasks: data.tasks, sections: data.sections, blockers: data.blockers, viewer: session.viewer, now,
    editors: data.editors, canEdit, onToggle: toggle, onEdit: (task: Task) => setEditing({ task, isNew: false }),
  }

  return (
    <div className="setup">
      <header className="setup-header">
        <div className="setup-title">
          <h1>Setup</h1>
          <span className="setup-who">
            {session.name} · <button className="link" onClick={props.onSignOut}>sign out</button>
          </span>
        </div>
        <div className="tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => chooseTab(id)}>{label}</button>
          ))}
        </div>
      </header>
      {(error || data.error) && <p className="error">{error ?? data.error}</p>}
      {tab === 'next' && <NextView {...viewProps} />}
      {tab === 'room' && (
        <RoomView {...viewProps} onAdd={add} onRenameSection={renameSection} onAddSection={addSection} />
      )}
      {tab === 'priority' && <PriorityView {...viewProps} />}
      {editing && (
        <TaskEditor
          key={editing.task.id + editing.task.position}
          task={editing.task}
          isNew={editing.isNew}
          tasks={data.tasks}
          sections={data.sections}
          blockedBy={data.blockers.filter((b) => b.itemId === editing.task.id).map((b) => b.blockedById)}
          onSave={save}
          onDelete={() => remove(editing.task)}
          onMove={(d) => move(editing.task, d)}
          onClose={() => setEditing(null)}
        />
      )}
      {undo.element}
    </div>
  )
}
