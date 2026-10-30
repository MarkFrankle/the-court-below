import { supabase } from './supabase'
import type { Confession, GameState, Matchup, Phase, R1Item, Realm, Shade, Vote } from './game'

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Not signed in.')
  return id
}

// Row shapes, snake_case as stored.
type ShadeRow = { id: string; name: string; guise: string | null; portrait_path: string | null; hidden: boolean
  realm: Realm | null; late: boolean; test: boolean; created_at: string }
type ConfessionRow = { shade_id: string; sin: string | null; talent: string | null; bargain: string | null }
type MatchupRow = { idx: number; prompt: string; note: string | null; subject_id: string | null; opened: boolean
  answer_a: string | null; answer_b: string | null; writer_a: string | null; writer_b: string | null; votes_a: number | null; votes_b: number | null }
type VoteRow = { voter_id: string; round: 1 | 2 | 3; item: number; choice: string }

export const toShade = (r: ShadeRow): Shade => ({
  id: r.id, name: r.name, guise: r.guise, portraitPath: r.portrait_path, hidden: r.hidden,
  realm: r.realm, late: r.late, test: r.test, createdAt: r.created_at,
})
export const toConfession = (r: ConfessionRow): Confession => ({ shadeId: r.shade_id, sin: r.sin, talent: r.talent, bargain: r.bargain })
const toMatchup = (r: MatchupRow): Matchup => ({
  idx: r.idx, prompt: r.prompt, note: r.note, subjectId: r.subject_id, opened: r.opened,
  answerA: r.answer_a, answerB: r.answer_b, writerA: r.writer_a, writerB: r.writer_b, votesA: r.votes_a, votesB: r.votes_b,
})
export const toVote = (r: VoteRow): Vote => ({ voterId: r.voter_id, round: r.round, item: r.item, choice: r.choice })

export class RateLimited extends Error {}

// Guests and the TV sign in anonymously; an existing session (including a host's) is kept.
export async function ensureAnonymous(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  const res = await supabase.auth.signInAnonymously()
  // Supabase caps anonymous sign-ins per IP address per hour, and the whole party shares one Wi-Fi address.
  if (res.error?.status === 429) throw new RateLimited()
  if (res.error || !res.data.user) throw new Error(res.error?.message ?? 'Could not sign in.')
  return res.data.user.id
}

export async function isHost(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return false
  return check(await supabase.rpc('is_host')) as boolean
}

export async function signInHost(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!(await isHost())) throw new Error('This account is not a host.')
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function setPhase(phase: Phase, step: number, seconds: number): Promise<void> {
  check(await supabase.rpc('set_phase', { p: phase, s: step, seconds }))
}

export async function addTime(seconds: number): Promise<void> {
  check(await supabase.rpc('add_time', { seconds }))
}

export async function resetGame(): Promise<void> {
  check(await supabase.rpc('reset_game'))
}

export async function serverNow(): Promise<number> {
  return Date.parse(check(await supabase.rpc('server_now')) as string)
}

export async function voteCount(round: 1 | 2 | 3, item: number): Promise<number> {
  return check(await supabase.rpc('vote_count', { r: round, i: item })) as number
}

export async function answerCount(): Promise<number> {
  return check(await supabase.rpc('answer_count')) as number
}

export async function saveShade(s: { name: string; guise: string | null; portraitPath: string | null }): Promise<void> {
  check(await supabase.from('shades').upsert({ id: await uid(), name: s.name, guise: s.guise, portrait_path: s.portraitPath }))
}

export async function saveConfession(c: Omit<Confession, 'shadeId'>): Promise<void> {
  check(await supabase.from('confessions').upsert({ shade_id: await uid(), ...c }))
}

// One file per shade; a retake overwrites it, and the ?v= in the path busts caches.
export async function uploadPortrait(jpeg: Blob): Promise<string> {
  const name = `${await uid()}.jpg`
  check(await supabase.storage.from('portraits').upload(name, jpeg, { upsert: true, contentType: 'image/jpeg' }))
  return `${name}?v=${Date.now()}`
}

export function portraitUrl(path: string | null): string | null {
  if (!path) return null
  const [name, query] = path.split('?')
  const url = supabase.storage.from('portraits').getPublicUrl(name).data.publicUrl
  return query ? `${url}?${query}` : url
}

export async function vote(round: 1 | 2 | 3, item: number, choice: string): Promise<void> {
  check(await supabase.from('votes').upsert({ voter_id: await uid(), round, item, choice }, { onConflict: 'voter_id,round,item' }))
}

export async function saveAnswer(matchup: number, text: string): Promise<void> {
  check(await supabase.from('r2_answers').upsert({ matchup, writer_id: await uid(), text }, { onConflict: 'matchup,writer_id' }))
}

// Fresh votes for one item, read by the engine at reveal time (host only).
export async function votesFor(round: 1 | 2 | 3, item: number): Promise<Vote[]> {
  const rows = check(await supabase.from('votes').select('voter_id, round, item, choice').eq('round', round).eq('item', item)) as VoteRow[]
  return rows.map(toVote)
}

export interface Mine {
  votes: Vote[]; assignments: { matchup: number; slot: 'a' | 'b' }[]; answers: { matchup: number; text: string }[]
  confession: Confession | null
}

export interface HostData {
  confessions: Confession[]; answers: { matchup: number; writerId: string; text: string }[]
  assignments: { matchup: number; slot: 'a' | 'b'; writerId: string }[]
  r1Authors: { idx: number; authorId: string }[]; hidden: Set<string>
}

export interface GameData {
  game: GameState; shades: Shade[]; r1: R1Item[]; r2: Matchup[]; r3: string[]; obols: { shadeId: string; amount: number }[]
  mine: Mine | null; host: HostData | null
}

export async function fetchAll(opts: { userId: string | null; host: boolean }): Promise<GameData> {
  const [g, s, r1, r2, r3, o] = await Promise.all([
    supabase.from('game').select('phase, step, deadline_at').single(),
    supabase.from('shades').select('*').order('created_at'),
    supabase.from('r1_items').select('*').order('idx'),
    supabase.from('r2_matchups').select('*').order('idx'),
    supabase.from('r3_items').select('*').order('idx'),
    supabase.from('obols').select('shade_id, amount'),
  ])
  const game = check(g) as { phase: Phase; step: number; deadline_at: string | null }
  const data: GameData = {
    game: { phase: game.phase, step: game.step, deadlineAt: game.deadline_at },
    shades: (check(s) as ShadeRow[]).map(toShade),
    r1: (check(r1) as { idx: number; text: string; author_id: string | null; correct: number | null; guessers: number | null }[])
      .map((r) => ({ idx: r.idx, text: r.text, authorId: r.author_id, correct: r.correct, guessers: r.guessers })),
    r2: (check(r2) as MatchupRow[]).map(toMatchup),
    r3: (check(r3) as { idx: number; shade_id: string }[]).map((r) => r.shade_id),
    obols: (check(o) as { shade_id: string; amount: number }[]).map((r) => ({ shadeId: r.shade_id, amount: r.amount })),
    mine: null,
    host: null,
  }
  if (opts.userId) data.mine = await fetchMine(opts.userId)
  if (opts.host) data.host = await fetchHost()
  return data
}

async function fetchMine(userId: string): Promise<Mine> {
  const [v, a, w, c] = await Promise.all([
    supabase.from('votes').select('voter_id, round, item, choice').eq('voter_id', userId),
    supabase.from('r2_assignments').select('matchup, slot').eq('writer_id', userId).order('matchup'),
    supabase.from('r2_answers').select('matchup, text').eq('writer_id', userId),
    supabase.from('confessions').select('*').eq('shade_id', userId).maybeSingle(),
  ])
  const confession = check(c) as ConfessionRow | null
  return {
    votes: (check(v) as VoteRow[]).map(toVote),
    assignments: check(a) as { matchup: number; slot: 'a' | 'b' }[],
    answers: check(w) as { matchup: number; text: string }[],
    confession: confession ? toConfession(confession) : null,
  }
}

async function fetchHost(): Promise<HostData> {
  const [c, w, a, r, h] = await Promise.all([
    supabase.from('confessions').select('*'),
    supabase.from('r2_answers').select('matchup, writer_id, text'),
    supabase.from('r2_assignments').select('matchup, slot, writer_id').order('matchup'),
    supabase.from('r1_authors').select('idx, author_id'),
    supabase.from('hidden_items').select('kind, ref'),
  ])
  return {
    confessions: (check(c) as ConfessionRow[]).map(toConfession),
    answers: (check(w) as { matchup: number; writer_id: string; text: string }[]).map((x) => ({ matchup: x.matchup, writerId: x.writer_id, text: x.text })),
    assignments: (check(a) as { matchup: number; slot: 'a' | 'b'; writer_id: string }[]).map((x) => ({ matchup: x.matchup, slot: x.slot, writerId: x.writer_id })),
    r1Authors: (check(r) as { idx: number; author_id: string }[]).map((x) => ({ idx: x.idx, authorId: x.author_id })),
    hidden: new Set((check(h) as { kind: string; ref: string }[]).map((x) => x.ref)),
  }
}
