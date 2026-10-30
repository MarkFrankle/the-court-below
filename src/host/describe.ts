import { REALMS, type GameState } from '../lib/game'
import { STEPS } from '../lib/phases'
import { realms } from '../content/copy'

// The remote's plain-words label for where the game is.
export function describe(g: Pick<GameState, 'phase' | 'step'>, counts: { r1: number; r2: number; r3: number }): string {
  const { phase, step } = g
  const of = (n: number) => `${step + 1} of ${n}`
  switch (phase) {
    case 'lobby': return 'Lobby: shades arriving'
    case 'intro': return `Opening, screen ${of(STEPS.intro)}`
    case 'r1_intro': return 'Round 1: intro'
    case 'r1_vote': return `Round 1: confession ${of(counts.r1)}, voting`
    case 'r1_reveal': return `Round 1: confession ${of(counts.r1)}, reveal`
    case 'r2_intro': return 'Round 2: intro'
    case 'r2_write': return 'Round 2: writing petitions'
    case 'r2_vote': return `Round 2: petition ${of(counts.r2)}, voting`
    case 'r2_reveal': return `Round 2: petition ${of(counts.r2)}, reveal`
    case 'r3_intro': return `Round 3: intro, screen ${of(STEPS.r3_intro)}`
    case 'r3_vote': return `Round 3: shade ${of(counts.r3)}`
    case 'r3_reveal': return `Judgment: ${realms[REALMS[step]]?.name ?? ''}`
    case 'finale': return step === 0 ? 'Finale: the obols' : 'Finale: Favored of Hades'
    case 'after': return 'After-party'
  }
}
