import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTheme } from './contexts/ThemeContext.jsx'
import { DEMO_MODE, setupDemo, DemoBanner } from './demo'

// Demo builds (demo.ruirufactorymabati.com) intercept all /api calls and
// serve seeded sample data — must be installed before anything renders.
if (DEMO_MODE) setupDemo()

initTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {DEMO_MODE && <DemoBanner />}
  </StrictMode>,
)
