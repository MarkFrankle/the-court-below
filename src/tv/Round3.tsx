import { arrival, realms, round3 } from '../content/copy'
import type { GameData } from '../lib/api'
import { REALMS } from '../lib/game'
import { Portrait } from '../ui/Portrait'
import { Clock } from './Clock'

export function Round3(props: { data: GameData }) {
  const { phase, step } = props.data.game

  if (phase === 'r3_intro' && step === 0) {
    return (
      <section className="tv-stage">
        <p className="tv-round">Round 3</p>
        <h1 className="display tv-title">{round3.title}</h1>
      </section>
    )
  }

  if (phase === 'r3_intro') {
    return (
      <section className="tv-stage tv-realms">
        {[...REALMS].reverse().map((r) => (
          <div key={r} className={`tv-realm realm-${r}`}>
            <h2 className="display">{realms[r].name}</h2>
            <p>{realms[r].description}</p>
          </div>
        ))}
      </section>
    )
  }

  if (phase === 'r3_vote') {
    const item = props.data.r3[step]
    const shade = item && props.data.shades.find((s) => s.id === item.shadeId)
    if (!shade) return null
    return (
      <section className="tv-stage tv-judged" key={`judge-${step}`}>
        <p className="tv-round">{round3.title} · {step + 1} of {props.data.r3.length}</p>
        <Portrait shade={shade} size="lg" />
        <h2 className="display tv-name">{shade.name}</h2>
        {shade.guise && <p className="hall-guise">{shade.guise}</p>}
        {item.bargain && (
          <div className="tv-bargain">
            <p className="muted">{arrival.confessions.bargain.question}</p>
            <p className="speech">“{item.bargain}”</p>
          </div>
        )}
        <Clock data={props.data} />
      </section>
    )
  }

  // r3_reveal: one realm per step, portraits filling the screen.
  const realm = REALMS[step]
  if (!realm) return null
  const judged = new Set(props.data.r3.map((i) => i.shadeId))
  const souls = props.data.shades.filter((s) => s.realm === realm && judged.has(s.id))
  return (
    <section className={`tv-stage tv-verdict-stage realm-${realm}`} key={`realm-${realm}`}>
      <h1 className="display tv-title">{realms[realm].name}</h1>
      <ul className="tv-souls">
        {souls.map((s) => (
          <li key={s.id}>
            <Portrait shade={s} size="md" />
            <span>{s.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
