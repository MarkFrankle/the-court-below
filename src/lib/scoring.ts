import { REALMS, type Award, type Realm, type Reason, type Vote } from './game'

// Builds one award row per shade and reason, leaving out zeros.
function award(awards: Award[], shadeId: string, amount: number, round: 1 | 2 | 3, item: number, reason: Reason) {
  if (amount > 0) awards.push({ shadeId, amount, round, item, reason })
}

const valid = (votes: Vote[], round: 1 | 2 | 3, item: number, voterIds: Set<string>) =>
  votes.filter((v) => v.round === round && v.item === item && voterIds.has(v.voterId))

// The author's vote is their frame. Everyone else is a guesser.
export function scoreRound1(p: { item: number; authorId: string; votes: Vote[]; playerIds: Set<string>; voterIds: Set<string> }) {
  const votes = valid(p.votes, 1, p.item, p.voterIds).filter((v) => p.playerIds.has(v.choice) && v.choice !== v.voterId)
  const framed = votes.find((v) => v.voterId === p.authorId)?.choice
  const guesses = votes.filter((v) => v.voterId !== p.authorId)
  const right = guesses.filter((v) => v.choice === p.authorId)
  const awards: Award[] = []
  for (const v of right) award(awards, v.voterId, 1, 1, p.item, 'guess')
  award(awards, p.authorId, guesses.length - right.length, 1, p.item, 'fooled')
  if (framed) award(awards, p.authorId, guesses.filter((v) => v.choice === framed).length, 1, p.item, 'framed')
  return { correct: right.length, guessers: guesses.length, awards }
}

// Which Round 1 reveal line to read. 'none' means nobody at all named the author.
export function revealTone(correct: number, guessers: number): 'most' | 'half' | 'few' | 'none' {
  if (correct === 0 || guessers === 0) return 'none'
  const share = correct / guessers
  if (share > 0.6) return 'most'
  if (share >= 0.25) return 'half'
  return 'few'
}

// The writers' votes are bets on the winner; everyone else's are votes.
// A lone petition wins by default. Otherwise more votes wins, and a tie has no winner.
export function petitionWinner(p: { hasA: boolean; hasB: boolean; votesA: number; votesB: number }): 'a' | 'b' | null {
  if (p.hasA !== p.hasB) return p.hasA ? 'a' : 'b'
  if (p.hasA && p.votesA !== p.votesB) return p.votesA > p.votesB ? 'a' : 'b'
  return null
}

export function scoreRound2(p: { item: number; writerA: string; writerB: string; hasA: boolean; hasB: boolean; votes: Vote[]; voterIds: Set<string> }) {
  const has = { a: p.hasA, b: p.hasB }
  const votes = valid(p.votes, 2, p.item, p.voterIds).filter((v) => (v.choice === 'a' || v.choice === 'b') && has[v.choice])
  const writers = new Set([p.writerA, p.writerB])
  const cast = votes.filter((v) => !writers.has(v.voterId))
  const votesA = cast.filter((v) => v.choice === 'a').length
  const votesB = cast.length - votesA

  const winner = petitionWinner({ hasA: p.hasA, hasB: p.hasB, votesA, votesB })

  const awards: Award[] = []
  award(awards, p.writerA, votesA, 2, p.item, 'votes')
  award(awards, p.writerB, votesB, 2, p.item, 'votes')
  if (p.hasA && p.hasB && cast.length >= 3) {
    if (votesA === cast.length) award(awards, p.writerA, 2, 2, p.item, 'sweep')
    if (votesB === cast.length) award(awards, p.writerB, 2, 2, p.item, 'sweep')
  }
  if (winner) {
    for (const v of votes) if (writers.has(v.voterId) && v.choice === winner) award(awards, v.voterId, 1, 2, p.item, 'bet')
  }
  return { votesA, votesB, winner, awards }
}

// Majority realm. A tie, or nobody voting, leaves the shade in Asphodel.
export function judge(p: { item: number; votes: Vote[]; voterIds: Set<string> }): Realm {
  const counts = new Map<Realm, number>(REALMS.map((r) => [r, 0]))
  for (const v of valid(p.votes, 3, p.item, p.voterIds)) {
    if (counts.has(v.choice as Realm)) counts.set(v.choice as Realm, counts.get(v.choice as Realm)! + 1)
  }
  const top = Math.max(...counts.values())
  const leaders = REALMS.filter((r) => counts.get(r) === top)
  return top > 0 && leaders.length === 1 ? leaders[0] : 'asphodel'
}

// Realms visible after each step of the reveal.
export function realmsRevealed(step: number): Realm[] {
  return REALMS.slice(0, Math.min(step, REALMS.length - 1) + 1)
}

export function totals(obols: { shadeId: string; amount: number }[]): Map<string, number> {
  const t = new Map<string, number>()
  for (const o of obols) t.set(o.shadeId, (t.get(o.shadeId) ?? 0) + o.amount)
  return t
}

// Favored of Hades: the highest total, jointly on a tie. Nobody if nobody scored.
export function favored(totals: Map<string, number>, candidates: string[]): string[] {
  const top = Math.max(0, ...candidates.map((id) => totals.get(id) ?? 0))
  return top === 0 ? [] : candidates.filter((id) => (totals.get(id) ?? 0) === top)
}
