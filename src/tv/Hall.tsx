import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { realms } from '../content/copy'
import type { Shade } from '../lib/game'
import { Portrait } from '../ui/Portrait'

// The Hall of Shades: a title page over the invitation art, with every shade in a row along the bottom
// in arrival order, and the QR code in a corner.
export function Hall(props: { shades: Shade[]; showRealms: boolean }) {
  const shades = props.shades.filter((s) => !s.hidden)
  return (
    <section className="hall">
      <h1 className="display hall-title">The Court Below</h1>
      {shades.length > 0 && (
        <ul className="hall-row">
          {shades.map((s) => (
            <li key={s.id}>
              <Portrait shade={s} size="sm" />
              <span className="hall-name">{s.name}</span>
              {props.showRealms && s.realm && <span className="hall-realm">{realms[s.realm].name}</span>}
            </li>
          ))}
        </ul>
      )}
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
