import { useEffect, useState, type ReactNode } from 'react'
import { arrival, screens, TRIAL_STARTS_AT } from '../content/copy'
import * as api from '../lib/api'
import { useGame } from '../lib/useGame'
import { Reconnecting } from '../ui/Reconnecting'
import { ArrivalForm } from './ArrivalForm'
import { play } from './play'
import { Verdict } from './Verdict'
import '../ui/game.css'
import './guest.css'

export function GuestPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.ensureAnonymous().then(setUserId, (e) =>
      setError(e instanceof api.RateLimited
        ? 'Too many phones have joined from this Wi-Fi in the last hour. Tell Hades or Persephone, or try again on mobile data.'
        : "The Court can't be reached. Check your Wi-Fi and reload the page."))
  }, [])

  if (error) return <Shell><p className="error">{error}</p></Shell>
  if (!userId) return <Shell><p className="muted">Opening the gates…</p></Shell>
  return <Guest userId={userId} />
}

function Shell(props: { children: ReactNode }) {
  return (
    <main className="court guest">
      <h1 className="display guest-title">The Court Below</h1>
      {props.children}
    </main>
  )
}

function Guest(props: { userId: string }) {
  const game = useGame('guest', props.userId)
  return (
    <>
      <GuestScreen userId={props.userId} {...game} />
      <Reconnecting show={game.stale} />
    </>
  )
}

function GuestScreen(props: { userId: string } & ReturnType<typeof useGame>) {
  const { data, error, refresh } = props
  const [editing, setEditing] = useState(false)

  if (!data) return <Shell>{error ? <p className="error">{error}</p> : <p className="muted">Opening the gates…</p>}</Shell>

  const { phase } = data.game
  const me = data.shades.find((s) => s.id === props.userId) ?? null
  const closed = phase === 'finale' || phase === 'after'

  if (me && closed) return <Shell><Verdict data={data} userId={props.userId} /></Shell>

  // Editing is for the lobby only: once the Court opens, an open edit form gives way to the game.
  if ((!me || (editing && phase === 'lobby')) && !closed) {
    return (
      <Shell>
        <ArrivalForm
          late={phase !== 'lobby'}
          shade={me}
          confession={data.mine?.confession ?? null}
          onSaved={() => {
            setEditing(false)
            refresh()
          }}
        />
      </Shell>
    )
  }

  if (me && phase === 'lobby') {
    return (
      <Shell>
        <Recorded onEdit={() => setEditing(true)} />
      </Shell>
    )
  }

  const action = play(data, props.userId, refresh)
  if (action) return <Shell>{action}</Shell>

  return (
    <Shell>
      <p className="guest-look display">{screens.lookToTheCourt}</p>
    </Shell>
  )
}

function Recorded(props: { onEdit: () => void }) {
  return (
    <section className="recorded">
      <h2 className="display">{arrival.recorded}</h2>
      <p className="speech">{arrival.closing}</p>
      <Countdown to={TRIAL_STARTS_AT} />
      <button className="link" onClick={props.onEdit}>Edit my shade</button>
    </section>
  )
}

// The phone's own clock is fine here: it only counts down to eleven.
function Countdown(props: { to: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const left = Math.floor((Date.parse(props.to) - now) / 1000)
  if (left <= 0) return null
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const s = left % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return <p className="countdown display">{h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`}</p>
}
