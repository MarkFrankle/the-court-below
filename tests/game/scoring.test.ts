import { expect, test } from 'vitest'
import type { Vote } from '../../src/lib/game'
import { favored, judge, realmsRevealed, revealTone, scoreRound1, scoreRound2, totals } from '../../src/lib/scoring'

const v = (voterId: string, round: 1 | 2 | 3, item: number, choice: string): Vote => ({ voterId, round, item, choice })
const ids = (...xs: string[]) => new Set(xs)
const everyone = ids('ana', 'ben', 'cal', 'dev', 'eve', 'fay')

test('round 1: guessers who name the author score, the author scores for the rest and for the frame', () => {
  const votes = [v('ana', 1, 0, 'ben'), v('cal', 1, 0, 'ana'), v('dev', 1, 0, 'ben'), v('eve', 1, 0, 'ben'), v('fay', 1, 0, 'ana')]
  const r = scoreRound1({ item: 0, authorId: 'ana', votes, playerIds: everyone, voterIds: everyone })
  expect(r.correct).toBe(2)
  expect(r.guessers).toBe(4)
  expect(r.awards).toEqual(expect.arrayContaining([
    { shadeId: 'cal', amount: 1, round: 1, item: 0, reason: 'guess' },
    { shadeId: 'fay', amount: 1, round: 1, item: 0, reason: 'guess' },
    { shadeId: 'ana', amount: 2, round: 1, item: 0, reason: 'fooled' },
    { shadeId: 'ana', amount: 2, round: 1, item: 0, reason: 'framed' },
  ]))
  expect(r.awards).toHaveLength(4)
})

test('round 1 ignores other items, hidden voters, self votes and non-players', () => {
  const votes = [v('ben', 1, 1, 'ana'), v('zed', 1, 0, 'ana'), v('cal', 1, 0, 'cal'), v('dev', 1, 0, 'nobody'), v('eve', 2, 0, 'ana')]
  const r = scoreRound1({ item: 0, authorId: 'ana', votes, playerIds: everyone, voterIds: everyone })
  expect(r).toEqual({ correct: 0, guessers: 0, awards: [] })
})

test('round 1: a late shade can guess, though it is not a player', () => {
  const r = scoreRound1({ item: 0, authorId: 'ana', votes: [v('lat', 1, 0, 'ana')], playerIds: everyone, voterIds: ids(...everyone, 'lat') })
  expect(r.awards).toEqual([{ shadeId: 'lat', amount: 1, round: 1, item: 0, reason: 'guess' }])
})

test.each([
  [0, 0, 'none'], [1, 5, 'none'], [1, 4, 'half'], [3, 5, 'half'], [4, 5, 'most'],
] as const)('reveal tone for %i of %i is %s', (correct, guessers, tone) => {
  expect(revealTone(correct, guessers)).toBe(tone)
})

const r2 = (votes: Vote[], hasA = true, hasB = true) =>
  scoreRound2({ item: 0, writerA: 'ana', writerB: 'ben', hasA, hasB, votes, voterIds: everyone })

test('round 2: each writer earns a coin per vote', () => {
  const r = r2([v('cal', 2, 0, 'a'), v('dev', 2, 0, 'a'), v('eve', 2, 0, 'a'), v('fay', 2, 0, 'b')])
  expect([r.votesA, r.votesB, r.winner]).toEqual([3, 1, 'a'])
  expect(r.awards).toEqual(expect.arrayContaining([
    { shadeId: 'ana', amount: 3, round: 2, item: 0, reason: 'votes' },
    { shadeId: 'ben', amount: 1, round: 2, item: 0, reason: 'votes' },
  ]))
  expect(r.awards).toHaveLength(2)
})

test('round 2: a clean sweep of at least three votes earns the bonus', () => {
  expect(r2([v('cal', 2, 0, 'b'), v('dev', 2, 0, 'b'), v('eve', 2, 0, 'b')]).awards)
    .toContainEqual({ shadeId: 'ben', amount: 2, round: 2, item: 0, reason: 'sweep' })
  expect(r2([v('cal', 2, 0, 'b'), v('dev', 2, 0, 'b')]).awards.map((a) => a.reason)).not.toContain('sweep')
})

test('round 2: writers’ votes are bets, paid when they back the winner', () => {
  const r = r2([v('ana', 2, 0, 'b'), v('ben', 2, 0, 'b'), v('cal', 2, 0, 'a'), v('dev', 2, 0, 'b'), v('eve', 2, 0, 'b')])
  expect([r.votesA, r.votesB]).toEqual([1, 2])
  expect(r.awards).toContainEqual({ shadeId: 'ana', amount: 1, round: 2, item: 0, reason: 'bet' })
  expect(r.awards).toContainEqual({ shadeId: 'ben', amount: 1, round: 2, item: 0, reason: 'bet' })
})

test('round 2: a tie pays no bets', () => {
  const r = r2([v('ana', 2, 0, 'a'), v('cal', 2, 0, 'a'), v('dev', 2, 0, 'b')])
  expect(r.winner).toBeNull()
  expect(r.awards.map((a) => a.reason)).not.toContain('bet')
})

test('round 2: a missing answer loses by default, without the bonus for the other', () => {
  const r = r2([v('cal', 2, 0, 'a'), v('dev', 2, 0, 'b'), v('eve', 2, 0, 'b'), v('fay', 2, 0, 'b')], false, true)
  expect([r.votesA, r.votesB, r.winner]).toEqual([0, 3, 'b'])
  expect(r.awards).toEqual([{ shadeId: 'ben', amount: 3, round: 2, item: 0, reason: 'votes' }])
})

test('round 3: the majority realm wins; ties and silence go to Asphodel', () => {
  const j = (choices: string[]) => judge({ item: 0, voterIds: everyone, votes: choices.map((c, i) => v([...everyone][i], 3, 0, c)) })
  expect(j(['tartarus', 'tartarus', 'elysium'])).toBe('tartarus')
  expect(j(['tartarus', 'elysium'])).toBe('asphodel')
  expect(j([])).toBe('asphodel')
  expect(j(['heaven', 'elysium'])).toBe('elysium')
})

test('realms are revealed Tartarus first, Elysium last', () => {
  expect(realmsRevealed(0)).toEqual(['tartarus'])
  expect(realmsRevealed(1)).toEqual(['tartarus', 'asphodel'])
  expect(realmsRevealed(2)).toEqual(['tartarus', 'asphodel', 'elysium'])
})

test('favored of Hades is the highest total, jointly on a tie', () => {
  const t = totals([{ shadeId: 'ana', amount: 3 }, { shadeId: 'ben', amount: 2 }, { shadeId: 'ben', amount: 1 }, { shadeId: 'cal', amount: 1 }])
  expect(t.get('ben')).toBe(3)
  expect(favored(t, ['ana', 'ben', 'cal']).sort()).toEqual(['ana', 'ben'])
  expect(favored(new Map(), ['ana'])).toEqual([])
})
