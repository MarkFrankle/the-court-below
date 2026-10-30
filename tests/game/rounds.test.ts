import { expect, test } from 'vitest'
import type { Confession, Shade } from '../../src/lib/game'
import { seeded } from '../../src/lib/random'
import { buildRound1, buildRound2, buildRound3, players, voters } from '../../src/lib/rounds'

const shade = (id: string, extra: Partial<Shade> = {}): Shade => ({
  id, name: id.toUpperCase(), guise: null, portraitPath: `${id}.jpg`, hidden: false, realm: null,
  late: false, test: false, createdAt: '2026-10-31T20:00:00+01:00', ...extra,
})
const many = (n: number) => Array.from({ length: n }, (_, i) => shade(`s${i}`))
const confess = (shadeId: string, extra: Partial<Confession> = {}): Confession => ({
  shadeId, sin: `${shadeId} sin`, talent: `${shadeId} talent`, bargain: `${shadeId} bargain`, ...extra,
})
const prompts = [
  { text: 'Why should Hades release [Name] back to the living?' },
  { text: 'The River Styx’s one-star review.' },
  { text: 'What Cerberus’s third head is thinking.', note: 'Cerberus is Hades’ three-headed guard dog.' },
]

test('players leaves out hidden and late shades; voters leaves out only hidden ones', () => {
  const all = [shade('a'), shade('b', { hidden: true }), shade('c', { late: true })]
  expect(players(all).map((s) => s.id)).toEqual(['a'])
  expect(voters(all)).toEqual(new Set(['a', 'c']))
})

test('round 1 picks at most 8 confessions, one per shade', () => {
  const ps = many(15)
  const items = buildRound1(ps, ps.map((s) => confess(s.id)), new Set(), seeded(1))
  expect(items).toHaveLength(8)
  expect(new Set(items.map((i) => i.authorId)).size).toBe(8)
  expect(items.map((i) => i.idx)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  for (const i of items) expect([`${i.authorId} sin`, `${i.authorId} talent`]).toContain(i.text)
})

test('round 1 skips empty and hidden confessions', () => {
  const ps = many(3)
  const cs = [confess('s0', { sin: '', talent: null }), confess('s1', { talent: '  ' }), confess('s2')]
  const items = buildRound1(ps, cs, new Set(['s1:sin']), seeded(2))
  expect(items.map((i) => i.authorId).sort()).toEqual(['s2'])
})

test('round 1 prefers shades with portraits', () => {
  const ps = [...many(8), shade('x', { portraitPath: null }), shade('y', { portraitPath: null })]
  const items = buildRound1(ps, ps.map((s) => confess(s.id)), new Set(), seeded(3))
  expect(items.map((i) => i.authorId)).not.toContain('x')
  expect(items.map((i) => i.authorId)).not.toContain('y')
})

test.each([3, 8, 15, 20])('round 2 with %i players: everyone writes exactly two, never against themselves', (n) => {
  const { matchups, assignments } = buildRound2(many(n), prompts, seeded(n))
  expect(matchups).toHaveLength(n)
  const counts = new Map<string, number>()
  for (const a of assignments) counts.set(a.writerId, (counts.get(a.writerId) ?? 0) + 1)
  expect([...counts.values()].every((v) => v === 2)).toBe(true)
  expect(counts.size).toBe(n)
  for (const m of matchups) {
    const [a, b] = assignments.filter((x) => x.matchup === m.idx)
    expect(a.writerId).not.toBe(b.writerId)
  }
})

test('round 2 fills in a subject who is not one of the writers', () => {
  const ps = many(8)
  const { matchups, assignments } = buildRound2(ps, prompts, seeded(4))
  const named = matchups.filter((m) => m.subjectId)
  expect(named.length).toBeGreaterThan(0)
  for (const m of named) {
    const writers = assignments.filter((a) => a.matchup === m.idx).map((a) => a.writerId)
    expect(writers).not.toContain(m.subjectId)
    expect(m.prompt).toContain(ps.find((s) => s.id === m.subjectId)!.name)
    expect(m.prompt).not.toContain('[Name]')
  }
  for (const m of matchups.filter((x) => !x.subjectId)) expect(m.prompt).not.toContain('[Name]')
})

test('round 2 keeps the lore note', () => {
  const { matchups } = buildRound2(many(6), prompts, seeded(5))
  expect(matchups.find((m) => m.prompt.startsWith('What Cerberus'))?.note).toBe('Cerberus is Hades’ three-headed guard dog.')
})

test('round 2 needs at least 3 players', () => {
  expect(buildRound2(many(2), prompts, seeded(6))).toEqual({ matchups: [], assignments: [] })
})

test('round 3 judges every player once', () => {
  const ps = many(15)
  expect(buildRound3(ps, seeded(7)).sort()).toEqual(ps.map((s) => s.id).sort())
})

test('builders are deterministic for a seed', () => {
  const ps = many(10)
  expect(buildRound3(ps, seeded(8))).toEqual(buildRound3(ps, seeded(8)))
})

import { uuid } from '../../src/lib/random'

test('uuid makes distinct v4 ids', () => {
  const a = uuid()
  expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(uuid()).not.toBe(a)
})
