import { useEffect, useState, type FormEvent } from 'react'
import { arrival } from '../content/copy'
import * as api from '../lib/api'
import type { Confession, Shade } from '../lib/game'
import { toPortrait } from '../lib/image'
import { Portrait } from '../ui/Portrait'

type Field = 'sin' | 'talent'
const FIELDS: Field[] = ['sin', 'talent']

// The arrival form. A late shade (after the lobby) gives only a name and a portrait.
export function ArrivalForm(props: { late: boolean; shade: Shade | null; confession: Confession | null; onSaved: () => void }) {
  const [name, setName] = useState(props.shade?.name ?? '')
  const [guise, setGuise] = useState(props.shade?.guise ?? '')
  const [answers, setAnswers] = useState<Record<Field, string>>({
    sin: props.confession?.sin ?? '', talent: props.confession?.talent ?? '',
  })
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url)
  }, [photo])

  async function pick(file: File | undefined) {
    if (!file) return
    setReading(true)
    setError(null)
    try {
      const blob = await toPortrait(file)
      setPhoto({ blob, url: URL.createObjectURL(blob) })
    } catch {
      setError("That photo couldn't be read. Try taking it again.")
    } finally {
      setReading(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const portraitPath = photo ? await api.uploadPortrait(photo.blob) : (props.shade?.portraitPath ?? null)
      await api.saveShade({ name: name.trim(), guise: props.late ? null : guise.trim() || null, portraitPath })
      if (!props.late) {
        await api.saveConfession({ sin: answers.sin.trim(), talent: answers.talent.trim() })
      }
      props.onSaved()
    } catch {
      setError("The Court couldn't record that. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const preview = { name: name || '?', portraitPath: props.shade?.portraitPath ?? null }

  return (
    <form className="arrival" onSubmit={submit}>
      <p className="speech arrival-welcome">{props.late ? arrival.lateWelcome : arrival.welcome}</p>

      <label className="field">
        <span className="field-label">{arrival.name.label}</span>
        <span className="field-question">{arrival.name.question}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoComplete="given-name" />
      </label>

      {!props.late && (
        <label className="field">
          <span className="field-label">{arrival.guise.label}</span>
          <span className="field-question">{arrival.guise.question}</span>
          <input value={guise} onChange={(e) => setGuise(e.target.value)} maxLength={60} />
          <span className="field-hint">{arrival.guise.hint}</span>
        </label>
      )}

      <div className="field">
        <span className="field-label">{arrival.portrait.label}</span>
        <span className="field-question">{arrival.portrait.question}</span>
        <label className="arrival-photo">
          <Portrait shade={preview} size="lg" src={photo?.url} />
          <span className="button ghost">{reading ? 'One moment…' : photo || props.shade?.portraitPath ? 'Retake' : 'Take your portrait'}</span>
          <input type="file" accept="image/*" capture="user" onChange={(e) => pick(e.target.files?.[0])} hidden />
        </label>
      </div>

      {!props.late && (
        <fieldset className="arrival-confessions">
          {FIELDS.map((f) => (
            <label className="field" key={f}>
              <span className="field-question">{arrival.confessions[f].question}</span>
              <textarea
                value={answers[f]}
                onChange={(e) => setAnswers({ ...answers, [f]: e.target.value })}
                placeholder={arrival.confessions[f].example}
                maxLength={140}
                rows={2}
                required
              />
            </label>
          ))}
          <p className="field-hint">{arrival.confessions.note}</p>
        </fieldset>
      )}

      {error && <p className="error">{error}</p>}
      <button className="button" disabled={busy || reading}>{busy ? 'One moment…' : 'Enter the Court'}</button>
    </form>
  )
}
