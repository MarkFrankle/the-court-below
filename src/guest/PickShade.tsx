import { useState } from 'react'
import { round1, screens } from '../content/copy'
import * as api from '../lib/api'
import { useCountdown } from '../lib/clock'
import { players } from '../lib/rounds'
import { Portrait } from '../ui/Portrait'

// Round 1 on the phone: name the sinner, or, for the author, frame someone.
export function PickShade(props: { data: api.GameData; userId: string; onVoted: () => void }) {
  const { data, userId } = props
  const step = data.game.step
  const item = data.r1[step]
  const left = useCountdown(data.game.deadlineAt)
  const [rejected, setRejected] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  if (!item) return null
  if (left === 0 || rejected) return <p className="guest-look display">{screens.heardEnough}</p>

  const c = data.mine?.confession
  const isAuthor = !!c && [c.sin, c.talent].some((t) => t?.trim() === item.text)
  const choice = data.mine?.votes.find((v) => v.round === 1 && v.item === step)?.choice
  const others = players(data.shades).filter((s) => s.id !== userId)

  async function pick(id: string) {
    setSending(id)
    try {
      await api.vote(1, step, id)
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
        {isAuthor ? (
          <h2 className="display">{round1.frame}</h2>
        ) : (
          <>
            <p className="muted">{round1.confesses}</p>
            <p className="speech">“{item.text}”</p>
          </>
        )}
        {left !== null && <span className="vote-time">{left}</span>}
      </header>
      <ul className="pick-grid">
        {others.map((s) => (
          <li key={s.id}>
            <button
              className={`pick${choice === s.id ? ' chosen' : ''}${sending === s.id ? ' sending' : ''}`}
              onClick={() => pick(s.id)}
              aria-pressed={choice === s.id}
            >
              <Portrait shade={s} size="md" />
              <span>{s.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
