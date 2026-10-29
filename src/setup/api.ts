import { supabase } from '../lib/supabase'
import { personFromEmail, type Blocker, type Editor, type Section, type Task, type Viewer } from './model'

export type Session = { viewer: Viewer; name: string; userId: string }

type TaskRow = {
  id: string; key: string; section_id: string; text: string; note: string | null
  assignee: Task['assignee']; priority: Task['priority']; slot: Task['slot']; position: number
  done_by: string | null; done_at: string | null
}

const toTask = (r: TaskRow): Task => ({
  id: r.id, key: r.key, sectionId: r.section_id, text: r.text, note: r.note,
  assignee: r.assignee, priority: r.priority, slot: r.slot, position: r.position,
  doneBy: r.done_by, doneAt: r.done_at,
})

const fromTask = (t: Task) => ({
  id: t.id, key: t.key, section_id: t.sectionId, text: t.text, note: t.note,
  assignee: t.assignee, priority: t.priority, slot: t.slot, position: t.position,
  done_by: t.doneBy, done_at: t.doneAt, updated_at: new Date().toISOString(),
})

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

// Hosts are recognised by email and get their editor row from claim_host_editor.
// Anonymous users only count once join_setup has accepted their code.
export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return null
  const person = personFromEmail(user.email)
  if (person) {
    const name = check(await supabase.rpc('claim_host_editor')) as string
    return { viewer: person, name, userId: user.id }
  }
  const row = check(await supabase.from('setup_editors').select('name').eq('user_id', user.id).maybeSingle())
  return row ? { viewer: 'helper', name: row.name, userId: user.id } : null
}

export async function joinAsHelper(code: string, name: string): Promise<'ok' | 'bad_code'> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw new Error(error.message)
  }
  const ok = check(await supabase.rpc('join_setup', { p_code: code, p_name: name })) as boolean
  return ok ? 'ok' : 'bad_code'
}

export async function signInHost(email: string, password: string): Promise<Session> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  const session = await currentSession()
  if (!session || session.viewer === 'helper') throw new Error('This account is not a host.')
  return session
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function fetchAll(): Promise<{ sections: Section[]; tasks: Task[]; blockers: Blocker[]; editors: Editor[] }> {
  const [s, t, b, e] = await Promise.all([
    supabase.from('setup_sections').select('id, key, title, kind, position'),
    supabase.from('setup_items').select('id, key, section_id, text, note, assignee, priority, slot, position, done_by, done_at'),
    supabase.from('setup_blockers').select('item_id, blocked_by_id'),
    supabase.from('setup_editors').select('user_id, name'),
  ])
  return {
    sections: check(s) as Section[],
    tasks: (check(t) as TaskRow[]).map(toTask),
    blockers: (check(b) as { item_id: string; blocked_by_id: string }[]).map((r) => ({ itemId: r.item_id, blockedById: r.blocked_by_id })),
    editors: (check(e) as { user_id: string; name: string }[]).map((r) => ({ userId: r.user_id, name: r.name })),
  }
}

export async function setDone(taskId: string, done: boolean): Promise<void> {
  check(await supabase.rpc('set_task_done', { p_task: taskId, p_done: done }))
}

export async function saveTask(task: Task): Promise<void> {
  const { done_by: _doneBy, done_at: _doneAt, ...row } = fromTask(task)
  check(await supabase.from('setup_items').upsert(row))
}

export async function deleteTask(id: string): Promise<void> {
  check(await supabase.from('setup_items').delete().eq('id', id))
}

// Brings back a deleted task with its done state and every blocker it was part of.
export async function restoreTask(task: Task, blockers: Blocker[]): Promise<void> {
  check(await supabase.from('setup_items').insert(fromTask(task)))
  if (blockers.length > 0) {
    check(await supabase.from('setup_blockers').insert(blockers.map((b) => ({ item_id: b.itemId, blocked_by_id: b.blockedById }))))
  }
}

export async function setBlockers(itemId: string, blockedByIds: string[]): Promise<void> {
  const current = (check(await supabase.from('setup_blockers').select('blocked_by_id').eq('item_id', itemId)) as { blocked_by_id: string }[])
    .map((r) => r.blocked_by_id)
  const remove = current.filter((id) => !blockedByIds.includes(id))
  const add = blockedByIds.filter((id) => !current.includes(id))
  // Insert first: if a new blocker makes a loop, the existing ones are still there.
  if (add.length > 0) check(await supabase.from('setup_blockers').insert(add.map((id) => ({ item_id: itemId, blocked_by_id: id }))))
  if (remove.length > 0) check(await supabase.from('setup_blockers').delete().eq('item_id', itemId).in('blocked_by_id', remove))
}

export async function setPositions(moves: { id: string; position: number }[]): Promise<void> {
  for (const m of moves) check(await supabase.from('setup_items').update({ position: m.position }).eq('id', m.id))
}

export async function saveSection(section: Section): Promise<void> {
  check(await supabase.from('setup_sections').upsert(section))
}
