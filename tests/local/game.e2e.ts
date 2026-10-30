import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, expect, test } from 'vitest'
import * as api from '../../src/lib/api'
import { supabase } from '../../src/lib/supabase'
import { advance } from '../../src/host/engine'
import { autoVote, seedTestShades } from '../../src/host/rehearsal'

const URL = process.env.VITE_SUPABASE_URL!
const ANON = process.env.VITE_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!URL.includes('127.0.0.1') && !URL.includes('localhost')) throw new Error('Refusing to run against anything but a local Supabase.')

const HOST = { email: 'host@local.test', password: 'host-password-local' }
const fresh = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
const ok = <T>(res: { data: T; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

// A tiny valid JPEG, so the upload path runs without a camera.
const JPEG = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='), (c) => c.charCodeAt(0))

const guests: { client: SupabaseClient; id: string; name: string }[] = []

async function host() {
  await supabase.auth.signOut()
  ok(await supabase.auth.signInWithPassword(HOST))
}

const game = async () => (await api.fetchAll({ userId: null, host: true })).game

beforeAll(async () => {
  // Host user and host row, made with the local service key (never used in the app).
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
  const existing = ok(await admin.auth.admin.listUsers()).users.find((u) => u.email === HOST.email)
  const hostId = existing?.id ?? ok(await admin.auth.admin.createUser({ ...HOST, email_confirm: true })).user!.id
  ok(await admin.from('hosts').upsert({ user_id: hostId }))
  await host()
  expect(await api.isHost()).toBe(true)
  await api.resetGame()
})

test('a guest creates a shade through the app api', async () => {
  await supabase.auth.signOut()
  const id = await api.ensureAnonymous()
  const path = await api.uploadPortrait(new Blob([JPEG], { type: 'image/jpeg' }))
  expect(path).toMatch(new RegExp(`^${id}\\.jpg\\?v=\\d+$`))
  await api.saveShade({ name: 'Persephone Test', guise: 'Queen of the Underworld', portraitPath: path })
  await api.saveConfession({ sin: 'I eat the seeds.', talent: 'I can grow anything.', bargain: 'Spring, all year.' })
  // A retake overwrites the same file.
  await api.uploadPortrait(new Blob([JPEG], { type: 'image/jpeg' }))

  const data = await api.fetchAll({ userId: id, host: false })
  expect(data.game.phase).toBe('lobby')
  expect(data.shades.find((s) => s.id === id)?.name).toBe('Persephone Test')
  expect(data.mine?.confession?.sin).toBe('I eat the seeds.')
  expect(data.host).toBeNull()

  const res = await fetch(api.portraitUrl(path)!)
  expect(res.status).toBe(200)
  guests.push({ client: supabase, id, name: 'Persephone Test' })
})

test('three more guests join on their own connections', async () => {
  for (const name of ['Ana', 'Ben', 'Cal']) {
    const client = fresh()
    const id = ok(await client.auth.signInAnonymously()).user!.id
    ok(await client.from('shades').insert({ name }))
    ok(await client.from('confessions').insert({ sin: `${name} sins.`, talent: `${name} talents.`, bargain: `${name} bargains.` }))
    guests.push({ client, id, name })
  }
  // Guests see only their own confessions.
  expect(ok(await guests[1].client.from('confessions').select())).toHaveLength(1)
})

test('the host seeds test shades and opens the court', async () => {
  await host()
  await seedTestShades(12)
  let d = await api.fetchAll({ userId: null, host: true })
  expect(d.shades).toHaveLength(16)
  expect(d.host!.confessions).toHaveLength(16)

  // A guest's realtime subscription hears the phase change.
  const heard = new Promise<string>((resolve) => {
    const ch = guests[1].client.channel(`t-${crypto.randomUUID()}`)
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game' }, (p) => resolve((p.new as { phase: string }).phase))
    // Changes only flow once Realtime says so, a moment after SUBSCRIBED.
    ch.on('system', {}, (p: { extension?: string; status?: string }) => {
      if (p.extension === 'postgres_changes' && p.status === 'ok') advance()
    })
    ch.subscribe()
  })
  expect(await heard).toBe('intro')

  d = await api.fetchAll({ userId: null, host: true })
  expect(d.r1).toHaveLength(8)
  expect(d.r1.every((i) => i.authorId === null)).toBe(true)
  expect(d.host!.r1Authors).toHaveLength(8)
  expect(d.r2).toHaveLength(16)
  expect(d.host!.assignments).toHaveLength(32)
  expect(d.r3).toHaveLength(16)

  // Authors and other people's assignments stay private.
  expect(ok(await guests[1].client.from('r1_authors').select())).toEqual([])
  expect(ok(await guests[1].client.from('r2_assignments').select()).length).toBe(2)
  // Confessions are locked once the Court is open.
  expect(ok(await guests[1].client.from('confessions').update({ sin: 'changed' }).eq('shade_id', guests[1].id).select())).toEqual([])
})

test('the remote reruns the build harmlessly', async () => {
  const before = await api.fetchAll({ userId: null, host: true })
  const { enter } = await import('../../src/host/engine')
  await enter()
  const after = await api.fetchAll({ userId: null, host: true })
  expect(after.r1.map((i) => i.text)).toEqual(before.r1.map((i) => i.text))
})

test('round 1 runs end to end', async () => {
  await advance() // intro 1
  await advance() // intro 2
  await advance() // r1_intro
  expect((await game()).phase).toBe('r1_intro')

  for (let i = 0; i < 8; i++) {
    await advance()
    expect(await game()).toMatchObject({ phase: 'r1_vote', step: i })
    const d = await api.fetchAll({ userId: null, host: true })
    const authorId = d.host!.r1Authors.find((a) => a.idx === i)!.authorId
    // Real guests: Ana always names the author, the others vote for Ana.
    for (const g of guests.slice(1)) {
      const choice = g.name === 'Ana' ? authorId : guests[1].id
      if (choice === g.id) continue
      ok(await g.client.from('votes').upsert({ voter_id: g.id, round: 1, item: i, choice }, { onConflict: 'voter_id,round,item' }))
    }
    await autoVote(d)
    expect(await api.voteCount(1, i)).toBeGreaterThanOrEqual(12)

    await advance()
    const after = await api.fetchAll({ userId: null, host: true })
    expect(after.game).toMatchObject({ phase: 'r1_reveal', step: i })
    const item = after.r1[i]
    expect(item.authorId).toBe(authorId)
    expect(item.guessers).toBeGreaterThan(0)
    // A vote after the reveal is refused.
    const late = await guests[2].client.from('votes').upsert({ voter_id: guests[2].id, round: 1, item: i, choice: authorId }, { onConflict: 'voter_id,round,item' })
    expect(late.error?.message).toMatch(/row-level security/)
  }

  const d = await api.fetchAll({ userId: null, host: true })
  const ana = guests.find((g) => g.name === 'Ana')!
  const anaGuesses = d.obols.filter((o) => o.shadeId === ana.id).reduce((n, o) => n + o.amount, 0)
  // Ana guessed right on every item she didn't write.
  const anaAuthored = d.host!.r1Authors.some((a) => a.authorId === ana.id)
  expect(anaGuesses).toBeGreaterThanOrEqual(anaAuthored ? 7 : 8)

  // Re-entering a reveal doesn't double-count.
  const total = d.obols.reduce((n, o) => n + o.amount, 0)
  const { enter } = await import('../../src/host/engine')
  await enter()
  const again = await api.fetchAll({ userId: null, host: true })
  expect(again.obols.reduce((n, o) => n + o.amount, 0)).toBe(total)

  await advance()
  expect((await game()).phase).toBe('r2_intro')
})
