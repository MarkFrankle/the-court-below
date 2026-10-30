import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import * as api from './api'

export type Role = 'guest' | 'tv' | 'host'

// Loads the whole game and keeps it live, like src/setup/useSetupData.ts.
// Any Realtime change triggers a short debounced full refetch: a few hundred rows at most, so it's cheap and never drifts.
// Phones lock constantly, so it also refetches on becoming visible, on reconnect, and on a timer.
// The host's timer is short because confessions and answers aren't in the Realtime publication.
export function useGame(role: Role, userId: string | null) {
  const [data, setData] = useState<api.GameData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      setData(await api.fetchAll({ userId, host: role === 'host' }))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [role, userId])

  const refresh = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(load, 150)
  }, [load])

  useEffect(() => {
    load()
    // A fresh topic each run: supabase.channel() hands back a channel that is still leaving, which never resubscribes.
    const channel = supabase.channel(`game-${crypto.randomUUID()}`)
    for (const table of ['game', 'shades', 'r1_items', 'r2_matchups', 'r3_items', 'obols']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') refresh()
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(refresh, role === 'host' ? 5_000 : 30_000)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
      window.clearTimeout(timer.current)
    }
  }, [load, refresh, role])

  return { data, error, refresh }
}

if (import.meta.env.DEV) {
  ;(window as unknown as { __game: unknown }).__game = { supabase, api }
}
