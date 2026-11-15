import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import StoryMode, { type View } from './story/StoryMode'
import WakeNotice from './components/WakeNotice'

// Pantalla principal: el terreno 3D con Hoy / Calendario / 40 años (story/StoryMode.tsx).
// La vista técnica completa (todas las cifras, rotaciones, fuentes) se carga solo con ?modo=tecnico o ?full=1.
const App = lazy(() => import('./App.tsx'))
const q = new URLSearchParams(window.location.search)
const isTech = q.get('modo') === 'tecnico' || q.get('full') === '1'
// ?demo=1 abre en la historia y la reproduce sola (presentación); ?historia=1 abre en la historia.
const isDemo = q.get('demo') === '1'
// Sin parámetros abre el panel de zonas; ?vista=hoy|calendario abre esa pestaña.
const VIEWS: View[] = ['zonas', 'hoy', 'rotaciones', 'calendario', 'historia']
const asked = q.get('vista') as View | null
const initialView: View =
  isDemo || q.get('historia') === '1' ? 'historia' : asked && VIEWS.includes(asked) ? asked : 'zonas'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WakeNotice />
    {isTech ? (
      <Suspense fallback={null}>
        <App />
      </Suspense>
    ) : (
      <StoryMode initialView={initialView} />
    )}
  </StrictMode>,
)
