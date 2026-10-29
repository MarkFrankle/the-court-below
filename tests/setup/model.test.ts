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
