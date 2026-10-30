import { PROMPTS } from '../content/prompts'
import * as api from '../lib/api'
import { nextStep } from '../lib/phases'
import { buildRound1, buildRound2, buildRound3, players } from '../lib/rounds'
import { supabase } from '../lib/supabase'

// The game engine runs on the host remote. Next changes the phase first (which closes any open vote),
// then does the new phase's entry work. Entry work is idempotent, so the remote reruns it on every load
// and a reload mid-reveal is harmless. Both read fresh data rather than trusting what's on screen.

const fresh = () => api.fetchAll({ userId: null, host: true })

function check(res: { error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message)
}

// One engine call at a time, so a Next pressed during the on-load rerun can't race it.
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
  await api.setPhase(next.phase, next.step, next.seconds)
  await doEntry()
})

export const enter = () => serial(doEntry)

async function doEntry(): Promise<void> {
  const d = await fresh()
  switch (d.game.phase) {
    case 'intro':
      if (d.r3.length === 0) await buildRounds(d)
      break
  }
}

// Builds all three rounds from the shades in the room when the Court opens.
async function buildRounds(d: api.GameData) {
  const host = d.host!
  const ps = players(d.shades)
  const r1 = buildRound1(ps, host.confessions, host.hidden, Math.random)
  const r2 = buildRound2(ps, PROMPTS, Math.random)
  const r3 = buildRound3(ps, Math.random)

  // Clear anything a half-finished build left behind. r3_items goes last, so it marks a complete build.
  check(await supabase.from('r1_items').delete().gte('idx', 0))
  check(await supabase.from('r2_assignments').delete().gte('matchup', 0))
  check(await supabase.from('r2_matchups').delete().gte('idx', 0))

  if (r1.length > 0) {
    check(await supabase.from('r1_items').insert(r1.map((i) => ({ idx: i.idx, text: i.text }))))
    check(await supabase.from('r1_authors').insert(r1.map((i) => ({ idx: i.idx, author_id: i.authorId }))))
  }
  if (r2.matchups.length > 0) {
    check(await supabase.from('r2_matchups').insert(r2.matchups.map((m) => ({ idx: m.idx, prompt: m.prompt, note: m.note, subject_id: m.subjectId }))))
    check(await supabase.from('r2_assignments').insert(r2.assignments.map((a) => ({ matchup: a.matchup, slot: a.slot, writer_id: a.writerId }))))
  }
  if (r3.length > 0) check(await supabase.from('r3_items').insert(r3.map((shadeId, idx) => ({ idx, shade_id: shadeId }))))
}
