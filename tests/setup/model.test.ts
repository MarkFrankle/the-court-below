import { expect, test } from 'vitest'
import { makeKey } from '../../src/setup/model'

test('makeKey slugifies text', () => {
  expect(makeKey("Hang the skulls' eyes!", new Set())).toBe('hang-the-skulls-eyes')
})

test('makeKey keeps keys short', () => {
  expect(makeKey('a'.repeat(80), new Set()).length).toBeLessThanOrEqual(40)
})

test('makeKey adds a suffix when the key is taken', () => {
  const key = makeKey('Tidy the counters', new Set(['tidy-the-counters']))
  expect(key).toMatch(/^tidy-the-counters-[a-z0-9]{4}$/)
})

test('makeKey falls back for text with no letters', () => {
  expect(makeKey('!!!', new Set())).toMatch(/^task-[a-z0-9]{4}$/)
})

import { keyForSave, swapWithNeighbour } from '../../src/setup/model'
import type { Task } from '../../src/setup/model'

const t = (id: string, position: number, sectionId = 's1', key = id): Task => ({
  id, key, sectionId, text: id, note: null, assignee: null, priority: 'should', slot: null, position, doneBy: null, doneAt: null,
})

test('keyForSave keeps the stored key when the draft has none', () => {
  expect(keyForSave(t('a', 0, 's1', ''), t('a', 0, 's1', 'arch-wisteria'), new Set())).toBe('arch-wisteria')
})

test('keyForSave makes a key for a brand new task', () => {
  expect(keyForSave({ ...t('a', 0, 's1', ''), text: 'Tidy the hall' }, undefined, new Set())).toBe('tidy-the-hall')
})

test('swapWithNeighbour swaps positions with the task above', () => {
  const tasks = [t('a', 0), t('b', 1), t('c', 2), t('x', 0, 's2')]
  expect(swapWithNeighbour(tasks, 'c', -1)).toEqual([{ id: 'c', position: 1 }, { id: 'b', position: 2 }])
})

test('swapWithNeighbour does nothing at the edge', () => {
  expect(swapWithNeighbour([t('a', 0), t('b', 1)], 'a', -1)).toEqual([])
})

test('swapWithNeighbour separates tasks that share a position', () => {
  const moves = swapWithNeighbour([t('a', 0), t('b', 1), t('c', 1)], 'c', -1)
  const positions = new Map([['a', 0], ['b', 1], ['c', 1]])
  for (const m of moves) positions.set(m.id, m.position)
  expect(new Set(positions.values()).size).toBe(3)
})

test('swapWithNeighbour skips tasks of another priority, since rooms sort by priority first', () => {
  const tasks = [t('a', 0), { ...t('m', 1), priority: 'must' as const }, t('b', 2)]
  expect(swapWithNeighbour(tasks, 'b', -1)).toEqual([{ id: 'b', position: 0 }, { id: 'a', position: 1 }])
})
