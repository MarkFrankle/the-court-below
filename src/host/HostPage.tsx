import { useEffect, useState, type FormEvent } from 'react'
import * as api from '../lib/api'
import { useCountdown } from '../lib/clock'
import { nextStep, prevStep } from '../lib/phases'
import { voters } from '../lib/rounds'
import { useGame } from '../lib/useGame'
import { useLiveCount } from '../lib/useLiveCount'
import { supabase } from '../lib/supabase'
import { Portrait } from '../ui/Portrait'
import { describe } from './describe'
import { advance, enter, retreat } from './engine'
import { Moderation } from './Moderation'
import { autoVote, seedTestShades } from './rehearsal'
import '../ui/game.css'
import './host.css'

export function HostPage() {
  const [userId, setUserId] = useState<string | null | 'loading'>('loading')
  useEffect(() => {
    api.isHost().then(
      async (ok) => setUserId(ok ? ((await supabase.auth.getSession()).data.session?.user.id ?? null) : null),
      () => setUserId(null),
    )
  }, [])

  if (userId === 'loading') return <main className="court host"><p className="muted">Opening the gates…</p></main>
  if (!userId) return <HostSignIn onSignedIn={setUserId} />
  return <Remote userId={userId} onSignOut={() => api.signOut().then(() => setUserId(null))} />
}

function HostSignIn(props: { onSignedIn: (userId: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.signInHost(email, password)
      props.onSignedIn((await supabase.auth.getSession()).data.session!.user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="court host">
      <h1 className="display host-title">The Court Below</h1>
      <p className="muted">The remote, for Hades and Persephone.</p>
      <form className="host-form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button" disabled={busy}>{busy ? 'One moment…' : 'Enter'}</button>
      </form>
    </main>
  )
}

function Remote(props: { userId: string; onSignOut: () => void }) {
  const { data, error: loadError, refresh } = useGame('host', props.userId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const game = data?.game ?? { phase: 'lobby' as const, step: 0, deadlineAt: null }
  const left = useCountdown(game.deadlineAt)
  const live = useLiveCount(game)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      refresh()
    }
  }

  // Finish any entry work a reload or a dropped connection interrupted.
  useEffect(() => {
    run(enter)
  }, [])

  if (!data) return <main className="court host"><p className={loadError ? 'error' : 'muted'}>{loadError ?? 'Opening the gates…'}</p></main>

  const counts = { r1: data.r1.length, r2: data.r2.length, r3: data.r3.length }
  const next = nextStep(game, counts)
  const prev = prevStep(game, counts)
  const voterCount = voters(data.shades).size
  const writers = data.host?.assignments.length ?? 0
  // Leaving the writing early shows those petitions as "no petition", so Next says how many are still missing.
  const missing = game.phase === 'r2_write' ? writers - (live ?? data.host?.answers.length ?? 0) : 0
  const visible = data.shades.filter((s) => !s.hidden)
  const hasTest = data.shades.some((s) => s.test)
  // Once the rounds are built, hiding a shade in them would leave Round 1 unguessable and their petitions empty.
  const inTrial = new Set(data.r3.map((i) => i.shadeId))

  return (
    <main className="court host">
      <header className="host-header">
        <p className="host-phase">{describe(game, counts)}</p>
        <div className="host-stats">
          {left !== null && <span className={left === 0 ? 'host-time up' : 'host-time'}>{left === 0 ? 'Time' : `${left}s`}</span>}
          {live !== null && <span>{live} of {game.phase === 'r2_write' ? writers : voterCount} in</span>}
          {game.phase === 'lobby' && <span>{visible.length} shades</span>}
        </div>
      </header>

      <button className="button host-next" disabled={busy || !next} onClick={() => run(advance)}>
        {next ? `Next: ${describe(next, counts)}${missing > 0 ? ` (${missing} of ${writers} petitions missing)` : ''}` : 'The Court is adjourned'}
      </button>
      <div className="host-row">
        {prev && (
          <button className="button ghost" disabled={busy} onClick={() => run(retreat)}>Back: {describe(prev, counts)}</button>
        )}
        {game.deadlineAt && (
          <button className="button ghost" disabled={busy} onClick={() => run(() => api.addTime(10))}>+10 seconds</button>
        )}
      </div>
      {(error ?? loadError) && <p className="error">{error ?? loadError}</p>}

      <Moderation data={data} busy={busy} run={run} />

      <section className="host-section">
        <h2 className="display">Shades</h2>
        {inTrial.size > 0 && <p className="muted">Shades in the Trial can't be hidden. Hide duplicates in the lobby.</p>}
        <ul className="host-shades">
          {data.shades.map((s) => (
            <li key={s.id} className={s.hidden ? 'is-hidden' : undefined}>
              <Portrait shade={s} size="sm" />
              <span>
                {s.name}
                {s.guise && <span className="muted">, {s.guise}</span>}
                {s.late && <span className="host-tag">late</span>}
                {s.test && <span className="host-tag">test</span>}
              </span>
              <button
                className="link"
                disabled={busy || inTrial.has(s.id)}
                onClick={() => run(async () => {
                  const res = await supabase.from('shades').update({ hidden: !s.hidden }).eq('id', s.id)
                  if (res.error) throw new Error(res.error.message)
                })}
              >
                {s.hidden ? 'Show' : 'Hide'}
              </button>
            </li>
          ))}
          {data.shades.length === 0 && <li className="muted">No shades yet.</li>}
        </ul>
      </section>

      <section className="host-section">
        <h2 className="display">Rehearsal</h2>
        <div className="host-row">
          {hasTest && ['r1_vote', 'r2_write', 'r2_vote', 'r3_vote'].includes(game.phase) && (
            <button className="button ghost" disabled={busy} onClick={() => run(() => autoVote(data))}>
              {game.phase === 'r2_write' ? 'Write test petitions' : 'Auto-vote for test shades'}
            </button>
          )}
          {game.phase === 'lobby' && !hasTest && (
            <button className="button ghost" disabled={busy} onClick={() => run(() => seedTestShades(12))}>Seed 12 test shades</button>
          )}
          <button
            className="button danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Reset the game? Every shade, confession, vote and obol is deleted.')) run(api.resetGame)
            }}
          >
            Reset game
          </button>
        </div>
      </section>

      <button className="link host-signout" onClick={props.onSignOut}>Sign out</button>
    </main>
  )
}
