import type { Line } from '../content/copy'

// A host's line, with who says it, so Hades and Persephone can read along.
export function Speech(props: { line: Line; name?: string }) {
  const text = props.name ? props.line.text.replace('[Name]', props.name) : props.line.text
  return (
    <blockquote className="speech-block">
      <cite>{props.line.speaker}</cite>
      <p className="speech">{text}</p>
    </blockquote>
  )
}
