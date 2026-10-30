// Shown when the screen has data but the latest loads are failing, so a frozen screen never looks live.
export function Reconnecting(props: { show: boolean }) {
  return props.show ? <p className="reconnecting" role="status">Reconnecting…</p> : null
}
