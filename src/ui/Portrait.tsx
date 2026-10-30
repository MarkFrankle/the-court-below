import { portraitUrl } from '../lib/api'
import type { Shade } from '../lib/game'

// A shade's likeness in an arch, or their initial on plum when there is no photo.
export function Portrait(props: { shade: Pick<Shade, 'name' | 'portraitPath'>; size: 'sm' | 'md' | 'lg' | 'xl'; src?: string | null }) {
  const src = props.src ?? portraitUrl(props.shade.portraitPath)
  return (
    <div className={`portrait portrait-${props.size}`}>
      {src ? <img src={src} alt={props.shade.name} /> : <span aria-hidden>{props.shade.name.trim().charAt(0).toUpperCase() || '?'}</span>}
    </div>
  )
}
