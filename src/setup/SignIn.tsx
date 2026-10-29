import { useState, type FormEvent } from 'react'
import * as api from './api'
import { HELPERS_LABEL } from './model'

export function SignIn(props: { onSignedIn: (s: api.Session) => void }) {
  const [mode, setMode] = useState<'helper' | 'host'>('helper')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'helper') {
        if ((await api.joinAsHelper(code, name)) === 'bad_code') {
          setError("That's not the code.")
          return
        }
        const session = await api.currentSession()
        if (session) props.onSignedIn(session)
      } else {
        props.onSignedIn(await api.signInHost(email, password))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setup signin">
      <h1>The Court Below</h1>
      <p className="lede">Preparing the underworld</p>
      <div className="tabs" role="tablist" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button role="tab" aria-selected={mode === 'helper'} onClick={() => setMode('helper')}>
          {HELPERS_LABEL}
        </button>
        <button role="tab" aria-selected={mode === 'host'} onClick={() => setMode('host')}>
          Host
        </button>
      </div>
      <form className="form" onSubmit={submit}>
        {mode === 'helper' ? (
          <>
            <label className="field">
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required autoComplete="given-name" />
            </label>
            <label className="field">
              Setup code
              <input value={code} onChange={(e) => setCode(e.target.value)} required autoCapitalize="none" autoCorrect="off" />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            </label>
            <label className="field">
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </label>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button className="button" disabled={busy}>{busy ? 'One moment…' : 'Enter'}</button>
      </form>
    </div>
  )
}
