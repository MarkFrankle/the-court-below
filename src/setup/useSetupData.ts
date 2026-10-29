import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as api from './api'
import type { Blocker, Section, Task } from './model'

type Data = { sections: Section[]; tasks: Task[]; blockers: Blocker[]; editors: Map<string, string> }

const empty: Data = { sections: [], tasks: [], blockers: [], editors: new Map() }

// Loads the whole checklist and keeps it live.
// Any Realtime change triggers a short debounced full refetch: about 100 rows, so it's cheap and never drifts.
// Phones lock constantly, so it also refetches on becoming visible, on reconnect, and every 30 seconds.
export function useSetupData(enabled: boolean) {
  const [data, setData] = useState<Data>(empty)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      const all = await api.fetchAll()
      setData({ ...all, editors: new Map(all.editors.map((e) => [e.userId, e.name])) })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const refresh = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(load, 150)
  }, [load])

  // Shows a change straight away while the write and the refetch catch up.
  const patchTask = useCallback((id: string, patch: Partial<Task>) => {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
  }, [])

  useEffect(() => {
    if (!enabled) return
    load()
    const channel = supabase.channel('setup')
    for (const table of ['setup_sections', 'setup_items', 'setup_blockers', 'setup_editors']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') refresh()
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(refresh, 30_000)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
      window.clearTimeout(timer.current)
    }
  }, [enabled, load, refresh])

  // A tick by someone whose name hasn't loaded yet: fetch again so "done by" has a name.
  useEffect(() => {
    if (data.tasks.some((t) => t.doneBy && !data.editors.has(t.doneBy))) refresh()
  }, [data, refresh])

  return { ...data, error, refresh, patchTask }
}

if (import.meta.env.DEV) {
  ;(window as unknown as { __setup: unknown }).__setup = { supabase, api }
}
