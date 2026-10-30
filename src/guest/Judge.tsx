import { useState } from 'react'
import { realms, screens } from '../content/copy'
import * as api from '../lib/api'
import { useCountdown } from '../lib/clock'
import { REALMS } from '../lib/game'

// Round 3 on the phone: send the shade on screen to a realm. Elysium first, as on the TV.
const ORDER = [...REALMS].reverse()

export function Judge(props: { data: api.GameData; onVoted: () => void }) {
  const { data } = props
  const step = data.game.step
  const item = data.r3[step]
  const left = useCountdown(data.game.deadlineAt)
  const [rejected, setRejected] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  if (!item) return null
  if (left === 0 || rejected) return <p className="guest-look display">{screens.heardEnough}</p>

  const shade = data.shades.find((s) => s.id === item.shadeId)
  const choice = data.mine?.votes.find((v) => v.round === 3 && v.item === step)?.choice

  async function pick(realm: string) {
    setSending(realm)
    try {
      await api.vote(3, step, realm)
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
        <h2 className="display">{shade?.name}</h2>
        {left !== null && <span className="vote-time">{left}</span>}
      </header>
      <div className="realm-buttons">
        {ORDER.map((r) => (
          <button
            key={r}
            className={`realm-button realm-${r}${choice === r ? ' chosen' : ''}${sending === r ? ' sending' : ''}`}
            onClick={() => pick(r)}
            aria-pressed={choice === r}
          >
            <span className="display">{realms[r].name}</span>
            <span className="realm-description">{realms[r].description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
