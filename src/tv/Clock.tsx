import { screens } from '../content/copy'
import type { GameData } from '../lib/api'
import { useCountdown } from '../lib/clock'
import { voters } from '../lib/rounds'
import { useLiveCount } from '../lib/useLiveCount'

// The countdown and "9 of 15 have judged" under every timed screen. Out of time, the Court has heard enough.
export function Clock(props: { data: GameData; of?: number; noun?: string }) {
  const left = useCountdown(props.data.game.deadlineAt)
  const live = useLiveCount(props.data.game)
  const of = props.of ?? voters(props.data.shades).size
  return (
    <div className="tv-clock">
      {left === 0 ? <p className="display tv-heard">{screens.heardEnough}</p> : left !== null && <p className="tv-seconds display">{left}</p>}
      {live !== null && <p className="tv-count">{live} of {of} {props.noun ?? 'have judged'}</p>}
    </div>
  )
}
