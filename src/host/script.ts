import { closing, opening, realmReveal, round1, round2, round3, type Line } from '../content/copy'
import { REALMS, type GameState } from '../lib/game'

// What Hades and Persephone read aloud while the TV shows this screen. The remote shows it; the TV doesn't.
// winners is the Favored of Hades, already joined ("Mark and Sarah"), for the closing line.
export function script(g: Pick<GameState, 'phase' | 'step'>, winners: string): Line[] {
  const { phase, step } = g
  switch (phase) {
    case 'intro': return step === 0 ? opening : []
    case 'r1_intro': return [round1.intro]
    case 'r2_intro': return [...round2.rules.map((text): Line => ({ speaker: 'Hades', text })), round2.intro]
    case 'r3_intro': return step === 0 ? [round3.intro] : []
    case 'r3_reveal': return REALMS[step] ? [realmReveal[REALMS[step]]] : []
    case 'finale':
      return step === 1 ? [{ ...closing.hades, text: closing.hades.text.replace('[Name]', winners || '…') }] : []
    default: return []
  }
}
