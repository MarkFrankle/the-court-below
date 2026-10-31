import type { GameData } from '../lib/api'
import { answerRef, confessionRef } from '../lib/game'
import { supabase } from '../lib/supabase'

const FIELDS = ['sin', 'talent'] as const

function check(res: { error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message)
}

async function setHidden(kind: 'confession' | 'answer', ref: string, hidden: boolean) {
  if (hidden) check(await supabase.from('hidden_items').upsert({ kind, ref }))
  else check(await supabase.from('hidden_items').delete().eq('kind', kind).eq('ref', ref))
}

// Hide anything that shouldn't be read aloud. The engine skips hidden items when it builds rounds and opens petitions.
export function Moderation(props: { data: GameData; busy: boolean; run: (action: () => Promise<void>) => void }) {
  const { data, busy, run } = props
  const host = data.host
  if (!host) return null
  const { phase, step } = data.game
  const name = (id: string) => data.shades.find((s) => s.id === id)?.name ?? '?'

  if (phase === 'lobby') {
    const rows = host.confessions.flatMap((c) =>
      FIELDS.filter((f) => c[f]?.trim()).map((f) => ({ ref: confessionRef(c.shadeId, f), who: name(c.shadeId), field: f, text: c[f]! })))
    if (rows.length === 0) return null
    return (
      <section className="host-section">
        <h2 className="display">Confessions</h2>
        <ul className="host-items">
          {rows.map((r) => {
            const hidden = host.hidden.has(r.ref)
            return (
              <li key={r.ref} className={hidden ? 'is-hidden' : undefined}>
                <span><span className="muted">{r.who}, {r.field}:</span> {r.text}</span>
                <button className="link" disabled={busy} onClick={() => run(() => setHidden('confession', r.ref, !hidden))}>
                  {hidden ? 'Show' : 'Hide'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  if (phase !== 'r2_write' && phase !== 'r2_vote' && phase !== 'r2_reveal') return null
  // While writing, every answer as it arrives; while voting, the two on screen.
  const answers = host.answers.filter((a) => phase === 'r2_write' || a.matchup === step)
  if (answers.length === 0) return null

  async function toggle(matchup: number, writerId: string, hide: boolean) {
    await setHidden('answer', answerRef(matchup, writerId), hide)
    // Already on the TV: take it down now. Showing it again is left to the next open, which never comes once voting started.
    const m = data.r2[matchup]
    if (hide && m?.opened) {
      const slot = host!.assignments.find((a) => a.matchup === matchup && a.writerId === writerId)?.slot
      if (slot) check(await supabase.from('r2_matchups').update({ [`answer_${slot}`]: null }).eq('idx', matchup))
    }
  }

  return (
    <section className="host-section">
      <h2 className="display">Petitions</h2>
      <ul className="host-items">
        {answers.map((a) => {
          const ref = answerRef(a.matchup, a.writerId)
          const hidden = host.hidden.has(ref)
          const shown = data.r2[a.matchup]?.opened
          return (
            <li key={ref} className={hidden ? 'is-hidden' : undefined}>
              <span><span className="muted">{name(a.writerId)}:</span> {a.text}</span>
              {!(hidden && shown) && (
                <button className="link" disabled={busy} onClick={() => run(() => toggle(a.matchup, a.writerId, !hidden))}>
                  {hidden ? 'Show' : 'Hide'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
