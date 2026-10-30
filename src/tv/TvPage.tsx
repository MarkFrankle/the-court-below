import { useEffect, useState } from 'react'
import { obolLine, opening, seeds } from '../content/copy'
import * as api from '../lib/api'
import { useGame } from '../lib/useGame'
import { Speech } from '../ui/Speech'
import { Hall } from './Hall'
import '../ui/game.css'
import './tv.css'

// The TV: a read-only display, signed in anonymously. The host remote runs the game.
export function TvPage() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.ensureAnonymous().then(() => setReady(true), () => setError("The Court can't be reached. Check the laptop's Wi-Fi and reload."))
  }, [])
  if (error) return <main className="court tv"><p className="error">{error}</p></main>
  if (!ready) return <main className="court tv" />
  return <Tv />
}

function Tv() {
  const { data, error } = useGame('tv', null)
  if (!data) return <main className="court tv">{error && <p className="error">{error}</p>}</main>
  const { phase, step } = data.game

  return (
    <main className="court tv">
      {(phase === 'lobby' || phase === 'after') && <Hall shades={data.shades} showRealms={phase === 'after'} />}
      {phase === 'intro' && <Intro step={step} />}
      {phase !== 'lobby' && phase !== 'after' && phase !== 'intro' && (
        <section className="tv-stage">
          <h1 className="display tv-title">The Court Below</h1>
        </section>
      )}
    </main>
  )
}

function Intro(props: { step: number }) {
  return (
    <section className="tv-stage tv-lines">
      {props.step === 0 && opening.map((line) => <Speech key={line.text} line={line} />)}
      {props.step === 1 && <p className="speech tv-big">{obolLine}</p>}
      {props.step === 2 && (
        <>
          <h2 className="display tv-title">{seeds.title}</h2>
          <p className="speech tv-big">“{seeds.forfeit}”</p>
        </>
      )}
    </section>
  )
}
