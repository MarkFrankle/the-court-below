import type { ReactNode } from 'react'
import type { GameData } from '../lib/api'
import { ChooseAnswer } from './ChooseAnswer'
import { Judge } from './Judge'
import { Petitions } from './Petitions'
import { PickShade } from './PickShade'

// What a shade can do right now in the Trial, or null when there's nothing. Shared by the guest page and the
// remote, so a host who joined plays from the remote. Keyed by step, so each item starts fresh.
export function play(data: GameData, userId: string, refresh: () => void): ReactNode | null {
  const me = data.shades.find((s) => s.id === userId)
  if (!me) return null
  const { phase, step } = data.game
  if (phase === 'r1_vote') return <PickShade key={`r1-${step}`} data={data} userId={userId} onVoted={refresh} />
  if (phase === 'r2_write') return <Petitions data={data} onSaved={refresh} />
  if (!me.hidden && phase === 'r2_vote') return <ChooseAnswer key={`r2-${step}`} data={data} onVoted={refresh} />
  if (!me.hidden && phase === 'r3_vote') return <Judge key={`r3-${step}`} data={data} onVoted={refresh} />
  return null
}
