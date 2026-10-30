import { round1 } from '../content/copy'
import type { GameData } from '../lib/api'
import { revealTone } from '../lib/scoring'
import { Portrait } from '../ui/Portrait'
import { Clock } from './Clock'

export function Round1(props: { data: GameData }) {
  const { phase, step } = props.data.game

  if (phase === 'r1_intro') {
    return (
      <section className="tv-stage">
        <p className="tv-round">Round 1</p>
        <h1 className="display tv-title">{round1.title}</h1>
      </section>
    )
  }

  const item = props.data.r1[step]
  if (!item) return null
  const author = item.authorId ? props.data.shades.find((s) => s.id === item.authorId) : null

  // The reveal waits until the remote has written the author.
  if (phase === 'r1_reveal' && author) {
    return (
      <section className="tv-stage tv-reveal" key={`reveal-${step}`}>
        <p className="tv-confession speech">“{item.text}”</p>
        <Portrait shade={author} size="lg" />
        <h2 className="display tv-name">{author.name}</h2>
        <p className="tv-count">{item.correct ?? 0} of {item.guessers ?? 0} guessed right</p>
        <p className="speech tv-verdict">{round1.reveal[revealTone(item.correct ?? 0, item.guessers ?? 0)]}</p>
      </section>
    )
  }

  return (
    <section className="tv-stage" key={`vote-${step}`}>
      <p className="tv-round">{round1.title} · {step + 1} of {props.data.r1.length}</p>
      <p className="muted">{round1.confesses}</p>
      <p className="tv-confession speech">“{item.text}”</p>
      <Clock data={props.data} />
    </section>
  )
}
