import { useCallback, useRef, useState } from 'react'

// One toast at a time; a new action replaces the previous one.
export function useUndo() {
  const [toast, setToast] = useState<{ label: string; undo: () => void } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((label: string, undo: () => void) => {
    window.clearTimeout(timer.current)
    setToast({ label, undo })
    timer.current = window.setTimeout(() => setToast(null), 5000)
  }, [])

  const element = toast ? (
    <div className="toast" role="status">
      <span>{toast.label}</span>
      <button
        className="link"
        onClick={() => {
          window.clearTimeout(timer.current)
          setToast(null)
          toast.undo()
        }}
      >
        Undo
      </button>
    </div>
  ) : null

  return { show, element }
}
