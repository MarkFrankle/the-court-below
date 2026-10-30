import { PROMPTS } from '../content/prompts'
import * as api from '../lib/api'
import { nextStep, prevStep } from '../lib/phases'
import { buildRound1, buildRound2, buildRound3, players, voters } from '../lib/rounds'
import { judge, realmsRevealed, scoreRound1, scoreRound2 } from '../lib/scoring'
import { answerRef, confessionRef, REALMS, type Award, type GameState } from '../lib/game'
import { supabase } from '../lib/supabase'

// The game engine runs on the host remote. Next changes the phase first (which closes any open vote),
// then does the new phase's entry work. Entry work is idempotent, so the remote reruns it on every load
// and a reload mid-reveal is harmless. Both read fresh data rather than trusting what's on screen.

const fresh = () => api.fetchAll({ userId: null, host: true })

function check(res: { error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message)
}

// One engine call at a time, so a Next pressed during the on-load rerun can't race it.
// That only covers this tab: a second remote is held off by set_phase and build_rounds in the database.
let queue: Promise<unknown> = Promise.resolve()
function serial(fn: () => Promise<void>): Promise<void> {
  const run = queue.then(fn)
  queue = run.catch(() => {})
  return run
}

export const advance = () => serial(async () => {
  const d = await fresh()
  const next = nextStep(d.game, { r1: d.r1.length, r2: d.r2.length, r3: d.r3.length })
  if (!next) return
  // False if another remote moved the game first: this press is then a no-op.
  if (!(await api.setPhase(next.phase, next.step, next.seconds, d.game))) return
  await doEntry()
})

// Back undoes what the screen it leaves had written (a reveal's obols and result, the first petitions
// on the TV, revealed realms), so moving forward again redoes it from the votes as they then stand.
export const retreat = () => serial(async () => {
  const d = await fresh()
  const prev = prevStep(d.game, { r1: d.r1.length, r2: d.r2.length, r3: d.r3.length })
  if (!prev) return
  if (!(await api.setPhase(prev.phase, prev.step, prev.seconds, d.game))) return
  await undo(d.game)
  await doEntry()
})

export const enter = () => serial(doEntry)

async function undo(left: GameState) {
  const { phase, step } = left
  if (phase === 'r1_reveal') {
    check(await supabase.from('obols').delete().eq('round', 1).eq('item', step))
    check(await supabase.from('r1_items').update({ author_id: null, correct: null, guessers: null }).eq('idx', step))
  }
  if (phase === 'r2_reveal') {
    check(await supabase.from('obols').delete().eq('round', 2).eq('item', step))
    check(await supabase.from('r2_matchups').update({ writer_a: null, writer_b: null, votes_a: null, votes_b: null }).eq('idx', step))
  }
  // Back to the lobby: take the rounds down, so Next builds them again from the shades there then.
  // r3_items first: the build skips while it exists, so a clear that fails partway makes the next build fail
  // loudly rather than run a half-cleared Trial.
  if (phase === 'intro' && step === 0) {
    check(await supabase.from('r3_items').delete().gte('idx', 0))
    check(await supabase.from('r2_assignments').delete().gte('matchup', 0))
    check(await supabase.from('r2_matchups').delete().gte('idx', 0))
    check(await supabase.from('r1_items').delete().gte('idx', 0)) // r1_authors go with them
  }
  // Back from the first vote to the writing: take the answers off the TV, so edits are copied in again.
  if (phase === 'r2_vote' && step === 0) {
    check(await supabase.from('r2_matchups').update({ opened: false, answer_a: null, answer_b: null }).eq('idx', 0))
  }
  if (phase === 'r3_reveal') {
    const keep = new Set(step > 0 ? realmsRevealed(step - 1) : [])
    for (const realm of REALMS.filter((r) => !keep.has(r))) {
      check(await supabase.from('shades').update({ realm: null }).eq('realm', realm))
    }
  }
}

async function doEntry(): Promise<void> {
  const d = await fresh()
  switch (d.game.phase) {
    case 'intro':
      if (d.r3.length === 0) await buildRounds(d)
      break
    case 'r1_reveal':
      if (d.r1[d.game.step] && !d.r1[d.game.step].authorId) await revealRound1(d, d.game.step)
      break
    case 'r2_vote':
      if (d.r2[d.game.step] && !d.r2[d.game.step].opened) await openPetitions(d, d.game.step)
      break
    case 'r2_reveal':
      if (d.r2[d.game.step] && d.r2[d.game.step].votesA === null) await revealPetitions(d, d.game.step)
      break
    case 'r3_vote':
      if (d.r3[d.game.step] && !d.r3[d.game.step].opened) await openJudgment(d, d.game.step)
      break
    case 'r3_reveal':
      await revealRealms(d, d.game.step)
      break
  }
}

// The unique key on (shade, round, item, reason) makes a rerun overwrite rather than add.
async function writeObols(awards: Award[]) {
  if (awards.length === 0) return
  check(await supabase.from('obols').upsert(
    awards.map((a) => ({ shade_id: a.shadeId, amount: a.amount, round: a.round, item: a.item, reason: a.reason })),
    { onConflict: 'shade_id,round,item,reason' },
  ))
}

// Obols first, then the author: once author_id is public the reveal is done.
async function revealRound1(d: api.GameData, idx: number) {
  const authorId = d.host!.r1Authors.find((a) => a.idx === idx)?.authorId
  if (!authorId) throw new Error(`Round 1 item ${idx} has no author.`)
  const result = scoreRound1({
    item: idx, authorId, votes: await api.votesFor(1, idx),
    playerIds: new Set(players(d.shades).map((s) => s.id)), voterIds: voters(d.shades),
  })
  await writeObols(result.awards)
  check(await supabase.from('r1_items').update({ author_id: authorId, correct: result.correct, guessers: result.guessers }).eq('idx', idx))
}

// Builds all three rounds from the shades in the room when the Court opens.
// build_rounds writes them in one transaction, and does nothing if another remote got there first.
async function buildRounds(d: api.GameData) {
  const host = d.host!
  const ps = players(d.shades)
  const r1 = buildRound1(ps, host.confessions, host.hidden, Math.random)
  const r2 = buildRound2(ps, PROMPTS, Math.random)
  const r3 = buildRound3(ps, Math.random)
  check(await supabase.rpc('build_rounds', {
    r1: r1.map((i) => ({ idx: i.idx, text: i.text, author_id: i.authorId })),
    r2: r2.matchups.map((m) => ({ idx: m.idx, prompt: m.prompt, note: m.note, subject_id: m.subjectId })),
    r2_writers: r2.assignments.map((a) => ({ matchup: a.matchup, slot: a.slot, writer_id: a.writerId })),
    r3: r3.map((shadeId, idx) => ({ idx, shade_id: shadeId })),
  }))
}

// The bargain goes public only when its shade is up, and never if a host hid it.
async function openJudgment(d: api.GameData, idx: number) {
  const { shadeId } = d.r3[idx]
  const c = d.host!.confessions.find((x) => x.shadeId === shadeId)
  const bargain = c?.bargain?.trim() && !d.host!.hidden.has(confessionRef(shadeId, 'bargain')) ? c.bargain.trim() : null
  check(await supabase.from('r3_items').update({ opened: true, bargain }).eq('idx', idx))
}

// Realm by realm: each step writes only the realms revealed so far, so phones can't see the rest early.
async function revealRealms(d: api.GameData, step: number) {
  const votes = await api.votesForRound(3)
  const voterIds = voters(d.shades)
  const shown = new Set(realmsRevealed(step))
  for (const realm of REALMS.filter((r) => shown.has(r))) {
    const ids = d.r3.filter((item) => judge({ item: item.idx, votes, voterIds }) === realm).map((item) => item.shadeId)
    if (ids.length > 0) check(await supabase.from('shades').update({ realm }).in('id', ids))
  }
}

function writersOf(d: api.GameData, idx: number) {
  const a = d.host!.assignments.find((x) => x.matchup === idx && x.slot === 'a')!.writerId
  const b = d.host!.assignments.find((x) => x.matchup === idx && x.slot === 'b')!.writerId
  return { a, b }
}

// Both answers go public, unsigned, only when their prompt's vote opens. A missing or hidden one stays null.
async function openPetitions(d: api.GameData, idx: number) {
  const w = writersOf(d, idx)
  const answer = (writerId: string) =>
    d.host!.hidden.has(answerRef(idx, writerId)) ? null
      : d.host!.answers.find((x) => x.matchup === idx && x.writerId === writerId)?.text.trim() || null
  check(await supabase.from('r2_matchups').update({ opened: true, answer_a: answer(w.a), answer_b: answer(w.b) }).eq('idx', idx))
}

// Obols first, then the writers and the split: once votes_a is set the reveal is done.
async function revealPetitions(d: api.GameData, idx: number) {
  const w = writersOf(d, idx)
  const m = d.r2[idx]
  const result = scoreRound2({
    item: idx, writerA: w.a, writerB: w.b, hasA: m.answerA !== null, hasB: m.answerB !== null,
    votes: await api.votesFor(2, idx), voterIds: voters(d.shades),
  })
  await writeObols(result.awards)
  check(await supabase.from('r2_matchups').update({ writer_a: w.a, writer_b: w.b, votes_a: result.votesA, votes_b: result.votesB }).eq('idx', idx))
}
