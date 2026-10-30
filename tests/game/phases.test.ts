import { expect, test } from 'vitest'
import { nextStep } from '../../src/lib/phases'

const c = { r1: 8, r2: 15, r3: 15 }
const at = (phase: string, step = 0, counts = c) => nextStep({ phase: phase as never, step }, counts)

test('the lobby opens the court', () => {
  expect(at('lobby')).toEqual({ phase: 'intro', step: 0, seconds: 0 })
})

test('the opening has three screens, then round 1', () => {
  expect(at('intro', 0)).toEqual({ phase: 'intro', step: 1, seconds: 0 })
  expect(at('intro', 2)).toEqual({ phase: 'r1_intro', step: 0, seconds: 0 })
})

test('round 1 alternates vote and reveal', () => {
  expect(at('r1_intro')).toEqual({ phase: 'r1_vote', step: 0, seconds: 20 })
  expect(at('r1_vote', 3)).toEqual({ phase: 'r1_reveal', step: 3, seconds: 0 })
  expect(at('r1_reveal', 3)).toEqual({ phase: 'r1_vote', step: 4, seconds: 20 })
  expect(at('r1_reveal', 7)).toEqual({ phase: 'r2_intro', step: 0, seconds: 0 })
})

test('round 2 writes, then alternates vote and reveal', () => {
  expect(at('r2_intro')).toEqual({ phase: 'r2_write', step: 0, seconds: 90 })
  expect(at('r2_write')).toEqual({ phase: 'r2_vote', step: 0, seconds: 20 })
  expect(at('r2_vote', 2)).toEqual({ phase: 'r2_reveal', step: 2, seconds: 0 })
  expect(at('r2_reveal', 14)).toEqual({ phase: 'r3_intro', step: 0, seconds: 0 })
})

test('round 3 votes on every shade, then reveals realm by realm', () => {
  expect(at('r3_intro', 1)).toEqual({ phase: 'r3_vote', step: 0, seconds: 12 })
  expect(at('r3_vote', 5)).toEqual({ phase: 'r3_vote', step: 6, seconds: 12 })
  expect(at('r3_vote', 14)).toEqual({ phase: 'r3_reveal', step: 0, seconds: 0 })
  expect(at('r3_reveal', 2)).toEqual({ phase: 'finale', step: 0, seconds: 0 })
})

test('the finale ends in the after-party, then stops', () => {
  expect(at('finale', 1)).toEqual({ phase: 'after', step: 0, seconds: 0 })
  expect(at('after')).toBeNull()
})

test('skips round 2 when it has no matchups', () => {
  expect(at('r1_reveal', 7, { ...c, r2: 0 })).toEqual({ phase: 'r3_intro', step: 0, seconds: 0 })
})

test('skips round 1 when it has no items', () => {
  expect(at('intro', 2, { ...c, r1: 0 })).toEqual({ phase: 'r2_intro', step: 0, seconds: 0 })
})
