import { closing, realms } from '../content/copy'
import type { GameData } from '../lib/api'
import { favored, totals } from '../lib/scoring'
import { Portrait } from '../ui/Portrait'

// Step 0: every shade's obols, highest first. Step 1: the Favored of Hades, while the hosts read the closing lines.
export function Finale(props: { data: GameData }) {
  const shades = props.data.shades.filter((s) => !s.hidden)
  const t = totals(props.data.obols)
  const winners = favored(t, shades.map((s) => s.id)).map((id) => shades.find((s) => s.id === id)!)

  if (props.data.game.step === 0) {
    const ranked = [...shades].sort((a, b) => (t.get(b.id) ?? 0) - (t.get(a.id) ?? 0))
    return (
      <section className="tv-stage tv-leaderboard">
        <h1 className="display tv-title">Obols</h1>
        <ol>
          {ranked.map((s) => (
            <li key={s.id}>
              <Portrait shade={s} size="sm" />
              <span className="tv-lb-name">{s.name}</span>
              {s.realm && <span className="hall-realm">{realms[s.realm].name}</span>}
              <span className="tv-lb-score">{t.get(s.id) ?? 0}</span>
            </li>
          ))}
        </ol>
      </section>
    )
  }

  return (
    <section className="tv-stage tv-finale">
      {winners.length > 0 && (
        <>
          <div className="tv-favored">
            {winners.map((w) => (
              <figure key={w.id}>
                <Portrait shade={w} size="lg" />
                <figcaption className="display tv-favored-name">{w.name}</figcaption>
              </figure>
            ))}
          </div>
          <p className="tv-round">{closing.favored}</p>
        </>
      )}
    </section>
  )
}
