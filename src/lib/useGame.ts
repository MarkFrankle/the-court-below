import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import * as api from './api'
import { uuid } from './random'

export type Role = 'guest' | 'tv' | 'host'

// Loads the whole game and keeps it live, like src/setup/useSetupData.ts.
// Any Realtime change triggers a short debounced full refetch: a few hundred rows at most, so it's cheap and never drifts.
// Phones lock constantly, so it also refetches on becoming visible, on reconnect, and on a timer.
// The host's timer is short because confessions and answers aren't in the Realtime publication.
export function useGame(role: Role, userId: string | null) {
  const [data, setData] = useState<api.GameData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef(0)

  // Loads can overlap on slow Wi-Fi. Only the newest one may set state, so an older one finishing last can't roll the screen back.
  const load = useCallback(async () => {
    const n = ++latest.current
    try {
      const d = await api.fetchAll({ userId, host: role === 'host' })
      if (n !== latest.current) return
      setData(d)
      setError(null)
    } catch (e) {
      if (n !== latest.current) return
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
    const channel = supabase.channel(`game-${uuid()}`)
    for (const table of ['game', 'shades', 'r1_items', 'r2_matchups', 'r3_items', 'obols']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    }
    // SUBSCRIBED arrives before database changes start flowing; the 'system' message says when they do.
    // Refetch at both, so a change in the gap between them isn't missed.
    channel.on('system', {}, (p: { extension?: string; status?: string }) => {
      if (p.extension === 'postgres_changes' && p.status === 'ok') refresh()
    })
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
