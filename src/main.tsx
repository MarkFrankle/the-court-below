import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import { GuestPage } from './guest/GuestPage'
import { HostPage } from './host/HostPage'
import { SetupPage } from './setup/SetupPage'
import { TvPage } from './tv/TvPage'

// Routes by pathname, no router library: / guest, /tv display, /host remote, /setup checklist.
function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/setup') return <SetupPage />
  if (path === '/tv') return <TvPage />
  if (path === '/host') return <HostPage />
  return <GuestPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
