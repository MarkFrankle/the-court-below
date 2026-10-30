import { useEffect, useState } from 'react'
import { serverNow } from './api'

// Deadlines come from the database clock, so count down against it, not the phone's.
// Measured once per page load, halving the round trip.
let offset = 0
let measured: Promise<void> | null = null

function measure(): Promise<void> {
  measured ??= (async () => {
    const before = Date.now()
    const server = await serverNow()
    offset = server - (before + Date.now()) / 2
  })().catch(() => {
    measured = null
  })
  return measured
}

export const now = () => Date.now() + offset

// Whole seconds left on a deadline, never negative. Null when there is no deadline.
export function useCountdown(deadlineAt: string | null): number | null {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!deadlineAt) return
    measure().then(() => setTick((t) => t + 1))
    const tick = () => setTick((t) => t + 1)
    const id = window.setInterval(tick, 250)
    // Timers are throttled while a phone is locked, so catch up on unlock.
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [deadlineAt])
  if (!deadlineAt) return null
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - now()) / 1000))
}
