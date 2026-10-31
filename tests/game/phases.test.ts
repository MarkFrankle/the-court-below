import { expect, test } from 'vitest'
import { nextStep, prevStep } from '../../src/lib/phases'

const c = { r1: 8, r2: 15 }
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
  expect(at('r2_reveal', 14)).toEqual({ phase: 'finale', step: 0, seconds: 0 })
})

test('round 3 is cut: its phases lead out of it, never into it', () => {
  for (const phase of ['r3_intro', 'r3_vote', 'r3_reveal']) {
    expect(at(phase)).toEqual({ phase: 'finale', step: 0, seconds: 0 })
    expect(prevStep({ phase: phase as never, step: 0 }, c)).toEqual({ phase: 'r2_reveal', step: 14, seconds: 0 })
  }
})

test('the finale ends in the after-party, then stops', () => {
  expect(at('finale', 1)).toEqual({ phase: 'after', step: 0, seconds: 0 })
  expect(at('after')).toBeNull()
})

test('skips round 2 when it has no matchups', () => {
  expect(at('r1_reveal', 7, { ...c, r2: 0 })).toEqual({ phase: 'finale', step: 0, seconds: 0 })
})

test('skips round 1 when it has no items', () => {
  expect(at('intro', 2, { ...c, r1: 0 })).toEqual({ phase: 'r2_intro', step: 0, seconds: 0 })
})

// Every screen Next visits from the lobby, in order.
function walk(counts: typeof c) {
  const seq: { phase: string; step: number }[] = [{ phase: 'lobby', step: 0 }]
  for (;;) {
    const n = nextStep(seq[seq.length - 1] as never, counts)
    if (!n) return seq
    seq.push({ phase: n.phase, step: n.step })
  }
}

test.each([
  ['every round', c],
  ['no round 2', { ...c, r2: 0 }],
  ['no round 1', { ...c, r1: 0 }],
  ['small', { r1: 1, r2: 3 }],
  ['no rounds', { r1: 0, r2: 0 }],
])('back undoes next, screen by screen (%s)', (_, counts) => {
  const seq = walk(counts)
  // From the second opening screen on, back lands on the screen before.
  for (let i = 1; i < seq.length; i++) {
    expect(prevStep(seq[i] as never, counts), `${seq[i].phase} ${seq[i].step}`).toMatchObject(seq[i - 1])
  }
})

test('back from the first opening screen returns to the lobby, and stops there', () => {
  expect(prevStep({ phase: 'intro', step: 0 }, c)).toEqual({ phase: 'lobby', step: 0, seconds: 0 })
  expect(prevStep({ phase: 'lobby', step: 0 }, c)).toBeNull()
})

test('back into a vote restarts its clock', () => {
  expect(prevStep({ phase: 'r1_reveal', step: 3 }, c)).toEqual({ phase: 'r1_vote', step: 3, seconds: 20 })
  expect(prevStep({ phase: 'r2_vote', step: 0 }, c)).toEqual({ phase: 'r2_write', step: 0, seconds: 90 })
  expect(prevStep({ phase: 'finale', step: 0 }, c)).toEqual({ phase: 'r2_reveal', step: 14, seconds: 0 })
})
