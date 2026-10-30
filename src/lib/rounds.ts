import { confessionRef, type Confession, type Prompt, type Shade } from './game'
import { shuffle, type Rand } from './random'

const ROUND_1_ITEMS = 8

// Players are guessed, write and are judged. Late and hidden shades are not players.
export function players(shades: Shade[]): Shade[] {
  return shades.filter((s) => !s.hidden && !s.late)
}

// Everyone whose vote counts: late shades vote too, hidden ones (duplicates) don't.
export function voters(shades: Shade[]): Set<string> {
  return new Set(shades.filter((s) => !s.hidden).map((s) => s.id))
}

// Up to 8 confessions, one per shade, each a sin or a talent. Shades with a portrait first.
export function buildRound1(players: Shade[], confessions: Confession[], hidden: Set<string>, rand: Rand) {
  const byShade = new Map(confessions.map((c) => [c.shadeId, c]))
  const candidates: { shade: Shade; text: string }[] = []
  for (const shade of players) {
    const c = byShade.get(shade.id)
    if (!c) continue
    const options = (['sin', 'talent'] as const)
      .filter((f) => c[f]?.trim() && !hidden.has(confessionRef(shade.id, f)))
      .map((f) => c[f]!.trim())
    if (options.length > 0) candidates.push({ shade, text: options[Math.floor(rand() * options.length)] })
  }
  const withPortrait = shuffle(candidates.filter((c) => c.shade.portraitPath), rand)
  const without = shuffle(candidates.filter((c) => !c.shade.portraitPath), rand)
  return [...withPortrait, ...without]
    .slice(0, ROUND_1_ITEMS)
    .map((c, idx) => ({ idx, text: c.text, authorId: c.shade.id }))
}

// One matchup per player: matchup i goes to players i and i + 1, so everyone writes exactly two.
export function buildRound2(players: Shade[], prompts: Prompt[], rand: Rand) {
  const matchups: { idx: number; prompt: string; note: string | null; subjectId: string | null }[] = []
  const assignments: { matchup: number; slot: 'a' | 'b'; writerId: string }[] = []
  const n = players.length
  if (n < 3 || prompts.length === 0) return { matchups, assignments }

  const order = shuffle(players, rand)
  const pool = shuffle(prompts, rand)
  const subjectCount = new Map(order.map((s) => [s.id, 0]))
  for (let idx = 0; idx < n; idx++) {
    const a = order[idx]
    const b = order[(idx + 1) % n]
    const p = pool[idx % pool.length]
    let subject: Shade | null = null
    if (p.text.includes('[Name]')) {
      // The least-used subject who isn't writing this one, so names spread around the room.
      const options = shuffle(order.filter((s) => s.id !== a.id && s.id !== b.id), rand)
      subject = options.reduce((best, s) => (subjectCount.get(s.id)! < subjectCount.get(best.id)! ? s : best))
      subjectCount.set(subject.id, subjectCount.get(subject.id)! + 1)
    }
    matchups.push({
      idx,
      prompt: subject ? p.text.replaceAll('[Name]', subject.name) : p.text,
      note: p.note ?? null,
      subjectId: subject?.id ?? null,
    })
    assignments.push({ matchup: idx, slot: 'a', writerId: a.id }, { matchup: idx, slot: 'b', writerId: b.id })
  }
  return { matchups, assignments }
}

// Every player is judged once, in random order.
export function buildRound3(players: Shade[], rand: Rand): string[] {
  return shuffle(players, rand).map((s) => s.id)
}
