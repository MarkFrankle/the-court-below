import { realms } from '../content/copy'
import type { GameData } from '../lib/api'
import { totals } from '../lib/scoring'
import { Portrait } from '../ui/Portrait'

// The finale on the phone: your realm and your obols, shown nowhere before this.
export function Verdict(props: { data: GameData; userId: string }) {
  const me = props.data.shades.find((s) => s.id === props.userId)
  if (!me) return null
  const obols = totals(props.data.obols).get(me.id) ?? 0
  return (
    <section className="verdict">
      <Portrait shade={me} size="lg" />
      <h2 className="display">{me.name}</h2>
      {me.realm && <p className={`verdict-realm realm-${me.realm} display`}>{realms[me.realm].name}</p>}
      <p className="verdict-obols">{obols} {obols === 1 ? 'obol' : 'obols'}</p>
    </section>
  )
}
