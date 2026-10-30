import type { Line } from '../content/copy'

// A host's line, with who says it. cite is false for a line that follows one by the same speaker.
export function Speech(props: { line: Line; cite?: boolean }) {
  return (
    <blockquote className="speech-block">
      {props.cite !== false && <cite>{props.line.speaker}</cite>}
      <p className="speech">{props.line.text}</p>
    </blockquote>
  )
}
