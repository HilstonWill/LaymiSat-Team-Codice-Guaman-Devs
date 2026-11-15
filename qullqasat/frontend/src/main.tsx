import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'

// Modo Historia: pantalla aparte que solo se carga con ?historia=1 (o ?demo=1).
const StoryMode = lazy(() => import('./story/StoryMode'))
const q = new URLSearchParams(window.location.search)
const isStory = q.get('historia') === '1' || q.get('demo') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStory ? (
      <Suspense fallback={null}>
        <StoryMode />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
