import { useState } from 'react'
import { round2, screens } from '../content/copy'
import * as api from '../lib/api'
import { useCountdown } from '../lib/clock'

// Round 2 voting on the phone: A or B. For the two writers the same tap is a bet on the winner.
export function ChooseAnswer(props: { data: api.GameData; onVoted: () => void }) {
  const { data } = props
  const step = data.game.step
  const m = data.r2[step]
  const left = useCountdown(data.game.deadlineAt)
  const [rejected, setRejected] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  if (!m || !m.opened) return <p className="guest-look display">{screens.lookToTheCourt}</p>
  if (left === 0 || rejected) return <p className="guest-look display">{screens.heardEnough}</p>

  const isWriter = (data.mine?.assignments ?? []).some((a) => a.matchup === step)
  const choice = data.mine?.votes.find((v) => v.round === 2 && v.item === step)?.choice

  async function pick(side: 'a' | 'b') {
    setSending(side)
    try {
      await api.vote(2, step, side)
    } catch {
      setRejected(true)
    } finally {
      setSending(null)
      props.onVoted()
    }
  }

  return (
    <section className="vote">
      <header className="vote-header">
        <p className="speech">{m.prompt}</p>
        {isWriter && <p className="field-hint">{round2.bet}</p>}
        {left !== null && <span className="vote-time">{left}</span>}
      </header>
      <div className="answer-buttons">
        {(['a', 'b'] as const).map((side) => {
          const text = side === 'a' ? m.answerA : m.answerB
          return (
            <button
              key={side}
              className={`answer-button${choice === side ? ' chosen' : ''}${sending === side ? ' sending' : ''}`}
              disabled={!text}
              onClick={() => pick(side)}
              aria-pressed={choice === side}
            >
              <span className="answer-letter display">{side.toUpperCase()}</span>
              <span>{text ?? round2.noPetition}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
