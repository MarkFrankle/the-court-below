import { useEffect, useState } from 'react'
import { screens } from '../content/copy'
import * as api from '../lib/api'
import { useCountdown } from '../lib/clock'

const MAX = 80

// Round 2 writing on the phone: your two prompts, one box each. Saved on blur and on Save.
export function Petitions(props: { data: api.GameData; onSaved: () => void }) {
  const { data } = props
  const left = useCountdown(data.game.deadlineAt)
  const mine = data.mine?.assignments ?? []
  const saved = new Map((data.mine?.answers ?? []).map((a) => [a.matchup, a.text]))
  const [drafts, setDrafts] = useState<Record<number, string>>(() => Object.fromEntries(mine.map((a) => [a.matchup, saved.get(a.matchup) ?? ''])))
  const [error, setError] = useState<string | null>(null)

  async function save(matchup: number) {
    const text = (drafts[matchup] ?? '').trim()
    if (!text || text === saved.get(matchup)) return
    setError(null)
    try {
      await api.saveAnswer(matchup, text)
    } catch {
      // Writing stays open until the host moves on (which unmounts this), so a failure here is the connection.
      setError("That petition didn't reach the Court. Check your connection and try again.")
    } finally {
      props.onSaved()
    }
  }

  // At time-up the boxes give way to "heard enough", and unmounting fires no blur, so save whatever is still unsaved.
  const timeUp = left === 0
  useEffect(() => {
    if (timeUp) for (const { matchup } of mine) save(matchup)
  }, [timeUp])

  if (mine.length === 0) return <p className="guest-look display">{screens.lookToTheCourt}</p>
  // A failed save keeps the boxes up so the guest can retry.
  if (timeUp && !error) return <p className="guest-look display">{screens.heardEnough}</p>

  return (
    <section className="vote">
      <header className="vote-header">
        {left !== null && <span className="vote-time">{left}</span>}
      </header>
      {mine.map(({ matchup }) => {
        const m = data.r2[matchup]
        const draft = drafts[matchup] ?? ''
        const isSaved = !!draft.trim() && draft.trim() === saved.get(matchup)
        return (
          <label className="field petition" key={matchup}>
            <span className="field-question">{m?.prompt}</span>
            {m?.note && <span className="field-hint">{m.note}</span>}
            <textarea
              value={draft}
              maxLength={MAX}
              rows={2}
              onChange={(e) => setDrafts({ ...drafts, [matchup]: e.target.value })}
              onBlur={() => save(matchup)}
            />
            <span className="petition-meta">
              <span className="muted">{draft.length}/{MAX}</span>
              {isSaved ? <span className="petition-saved">Saved</span> : (
                <button type="button" className="link" onClick={() => save(matchup)} disabled={!draft.trim()}>Save</button>
              )}
            </span>
          </label>
        )
      })}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
