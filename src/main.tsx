import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import { SetupPage } from './setup/SetupPage'

// Routes by pathname, no router library: / guest, /tv display, /host remote, /setup checklist.
const lines: Record<string, string> = {
  '/': 'The Court convenes on Saturday.',
  '/tv': 'The Hall of Shades is being prepared.',
  '/host': 'The remote is being forged.',
  '/setup': 'The setup checklist arrives shortly.',
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/setup') return <SetupPage />
  return (
    <main className="placeholder">
      <h1>The Court Below</h1>
      <p>{lines[path] ?? lines['/']}</p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
