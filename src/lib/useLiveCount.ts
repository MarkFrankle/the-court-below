import { useEffect, useState } from 'react'
import * as api from './api'
import type { GameState } from './game'

// "9 of 15 have judged": votes and answers aren't in the Realtime publication, so poll the counters while the clock runs.
export function useLiveCount(game: GameState): number | null {
  const [count, setCount] = useState<number | null>(null)
  const { phase, step } = game
  useEffect(() => {
    const vote = /^r([123])_vote$/.exec(phase)
    const read =
      vote ? () => api.voteCount(Number(vote[1]) as 1 | 2 | 3, step)
      : phase === 'r2_write' ? api.answerCount
      : null
    setCount(null)
    if (!read) return
    let live = true
    const poll = () => read().then((n) => live && setCount(n), () => {})
    poll()
    const id = window.setInterval(poll, 2000)
    return () => {
      live = false
      window.clearInterval(id)
    }
  }, [phase, step])
  return count
}
