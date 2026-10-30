import { round2 } from '../content/copy'
import type { GameData } from '../lib/api'
import { petitionWinner } from '../lib/scoring'
import { Portrait } from '../ui/Portrait'
import { Speech } from '../ui/Speech'
import { Clock } from './Clock'

export function Round2(props: { data: GameData }) {
  const { phase, step } = props.data.game

  if (phase === 'r2_intro') {
    return (
      <section className="tv-stage">
        <p className="tv-round">Round 2</p>
        <h1 className="display tv-title">{round2.title}</h1>
        <Speech line={round2.intro} />
      </section>
    )
  }

  if (phase === 'r2_write') {
    return (
      <section className="tv-stage">
        <h1 className="display tv-title">{round2.writing}</h1>
        <Clock data={props.data} of={props.data.r2.length * 2} noun="petitions received" />
      </section>
    )
  }

  const m = props.data.r2[step]
  if (!m) return null
  // The reveal waits until the remote has written the split.
  const revealed = phase === 'r2_reveal' && m.votesA !== null
  const writer = (id: string | null) => (id ? props.data.shades.find((s) => s.id === id) : undefined)
  const winner = revealed ? petitionWinner({ hasA: m.answerA !== null, hasB: m.answerB !== null, votesA: m.votesA!, votesB: m.votesB! }) : null

  return (
    <section className="tv-stage tv-petition" key={`petition-${step}`}>
      <p className="tv-round">{round2.title} · {step + 1} of {props.data.r2.length}</p>
      <h2 className="display tv-prompt">{m.prompt}</h2>
      {m.note && <p className="muted">{m.note}</p>}
      {m.opened && (
        <div className="tv-answers">
          {(['a', 'b'] as const).map((side) => {
            const text = side === 'a' ? m.answerA : m.answerB
            const w = writer(side === 'a' ? m.writerA : m.writerB)
            const votes = side === 'a' ? m.votesA : m.votesB
            return (
              <div key={side} className={`tv-answer${winner === side ? ' won' : ''}${text ? '' : ' empty'}`}>
                <span className="answer-letter display">{side.toUpperCase()}</span>
                <p className="speech">{text ? `“${text}”` : round2.noPetition}</p>
                {revealed && w && (
                  <div className="tv-writer">
                    <Portrait shade={w} size="sm" />
                    <span>{w.name}</span>
                    <span className="tv-lb-score">{votes}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!revealed && <Clock data={props.data} />}
    </section>
  )
}
