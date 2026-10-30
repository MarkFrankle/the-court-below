import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { realms } from '../content/copy'
import type { Shade } from '../lib/game'
import { Portrait } from '../ui/Portrait'

const HOLD_MS = 8000

// The Hall of Shades: one portrait at a time, crossfading, with the QR code in a corner.
export function Hall(props: { shades: Shade[]; showRealms: boolean }) {
  const shades = props.shades.filter((s) => !s.hidden)
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => i + 1), HOLD_MS)
    return () => window.clearInterval(id)
  }, [])

  const current = shades.length > 0 ? shades[index % shades.length] : null

  return (
    <section className="hall">
      <h1 className="display hall-title">The Court Below</h1>
      {current ? (
        // Keyed by shade, so each new one fades in.
        <figure className="hall-shade" key={`${current.id}-${index}`}>
          <Portrait shade={current} size="xl" />
          <figcaption>
            <span className="hall-name display">{current.name}</span>
            {current.guise && <span className="hall-guise">{current.guise}</span>}
            {props.showRealms && current.realm && <span className="hall-realm">{realms[current.realm].name}</span>}
          </figcaption>
        </figure>
      ) : null}
      <JoinCode />
    </section>
  )
}

function JoinCode() {
  const [src, setSrc] = useState<string | null>(null)
  const url = `${window.location.origin}/`
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#0b0709', light: '#e6d3a3' } }).then(setSrc, () => setSrc(null))
  }, [url])
  if (!src) return null
  return (
    <div className="hall-qr">
      <img src={src} alt={`Join at ${url}`} />
    </div>
  )
}
