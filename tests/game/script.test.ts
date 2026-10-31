import { expect, test } from 'vitest'
import { script } from '../../src/host/script'

const at = (phase: string, step = 0, winners = '') => script({ phase: phase as never, step }, winners)
const speakers = (phase: string, step = 0) => at(phase, step).map((l) => l.speaker)

test('the opening screen has both opening lines, the rest of the opening has none', () => {
  expect(speakers('intro', 0)).toEqual(['Hades', 'Persephone'])
  expect(at('intro', 1)).toEqual([])
  expect(at('intro', 2)).toEqual([])
})

test('each round intro has its line', () => {
  expect(speakers('r1_intro')).toEqual(['Persephone'])
})

test('round 2 intro has Hades read the three rules, then the last line', () => {
  const lines = at('r2_intro')
  expect(lines.map((l) => l.speaker)).toEqual(['Hades', 'Hades', 'Hades', 'Hades'])
  expect(lines[3].text).toMatch(/^Pander shamelessly/)
})

test('the finale names the favored shade in Hades’ line', () => {
  expect(at('finale', 0)).toEqual([])
  const lines = at('finale', 1, 'Mark and Sarah')
  expect(lines.map((l) => l.speaker)).toEqual(['Hades'])
  expect(lines[0].text).toContain('is... Mark and Sarah.')
})

test('voting, writing and reveals have nothing to read', () => {
  for (const phase of ['lobby', 'r1_vote', 'r1_reveal', 'r2_write', 'r2_vote', 'r2_reveal', 'r3_vote', 'after']) {
    expect(at(phase)).toEqual([])
  }
})
