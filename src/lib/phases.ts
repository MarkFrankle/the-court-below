import type { Phase } from './game'

// Seconds on the clock for each timed phase.
export const TIMERS = { r1_vote: 20, r2_write: 90, r2_vote: 20, r3_vote: 12 } as const

// Screens in phases that have a fixed number of steps.
export const STEPS = { intro: 3, r3_intro: 2, r3_reveal: 3, finale: 2 } as const

export interface Counts { r1: number; r2: number; r3: number }

type Next = { phase: Phase; step: number; seconds: number }

const to = (phase: Phase, step = 0): Next => ({ phase, step, seconds: (TIMERS as Record<string, number>)[phase] ?? 0 })

// The first screen of each round, skipping rounds with nothing in them.
function startRound(round: 1 | 2 | 3, c: Counts): Next {
  if (round === 1 && c.r1 > 0) return to('r1_intro')
  if (round <= 2 && c.r2 > 0) return to('r2_intro')
  if (c.r3 > 0) return to('r3_intro')
  return to('finale')
}

// What the remote's Next button moves to. Null once the party is over.
export function nextStep(g: { phase: Phase; step: number }, c: Counts): Next | null {
  const { phase, step } = g
  switch (phase) {
    case 'lobby': return to('intro')
    case 'intro': return step + 1 < STEPS.intro ? to('intro', step + 1) : startRound(1, c)
    case 'r1_intro': return to('r1_vote', 0)
    case 'r1_vote': return to('r1_reveal', step)
    case 'r1_reveal': return step + 1 < c.r1 ? to('r1_vote', step + 1) : startRound(2, c)
    case 'r2_intro': return to('r2_write')
    case 'r2_write': return to('r2_vote', 0)
    case 'r2_vote': return to('r2_reveal', step)
    case 'r2_reveal': return step + 1 < c.r2 ? to('r2_vote', step + 1) : startRound(3, c)
    case 'r3_intro': return step + 1 < STEPS.r3_intro ? to('r3_intro', step + 1) : to('r3_vote', 0)
    case 'r3_vote': return step + 1 < c.r3 ? to('r3_vote', step + 1) : to('r3_reveal', 0)
    case 'r3_reveal': return step + 1 < STEPS.r3_reveal ? to('r3_reveal', step + 1) : to('finale')
    case 'finale': return step + 1 < STEPS.finale ? to('finale', step + 1) : to('after')
    case 'after': return null
  }
}

// The last screen of each round, or of the opening, falling back past rounds with nothing in them.
function endBefore(round: 1 | 2 | 3 | 4, c: Counts): Next {
  if (round > 3 && c.r3 > 0) return to('r3_reveal', STEPS.r3_reveal - 1)
  if (round > 2 && c.r2 > 0) return to('r2_reveal', c.r2 - 1)
  if (round > 1 && c.r1 > 0) return to('r1_reveal', c.r1 - 1)
  return to('intro', STEPS.intro - 1)
}

// What the remote's Back button moves to: the inverse of nextStep. Null in the lobby.
export function prevStep(g: { phase: Phase; step: number }, c: Counts): Next | null {
  const { phase, step } = g
  switch (phase) {
    case 'lobby': return null
    case 'intro': return step > 0 ? to('intro', step - 1) : to('lobby')
    case 'r1_intro': return endBefore(1, c)
    case 'r1_vote': return step > 0 ? to('r1_reveal', step - 1) : to('r1_intro')
    case 'r1_reveal': return to('r1_vote', step)
    case 'r2_intro': return endBefore(2, c)
    case 'r2_write': return to('r2_intro')
    case 'r2_vote': return step > 0 ? to('r2_reveal', step - 1) : to('r2_write')
    case 'r2_reveal': return to('r2_vote', step)
    case 'r3_intro': return step > 0 ? to('r3_intro', step - 1) : endBefore(3, c)
    case 'r3_vote': return step > 0 ? to('r3_vote', step - 1) : to('r3_intro', STEPS.r3_intro - 1)
    case 'r3_reveal': return step > 0 ? to('r3_reveal', step - 1) : to('r3_vote', c.r3 - 1)
    case 'finale': return step > 0 ? to('finale', step - 1) : endBefore(4, c)
    case 'after': return to('finale', STEPS.finale - 1)
  }
}
