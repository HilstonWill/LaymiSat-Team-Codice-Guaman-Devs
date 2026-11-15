import { useEffect, useState } from 'react'
import { isServerWaking, serverStatus } from '../api'

/**
 * Aviso mientras el servidor gratuito (Render) despierta tras un rato sin tráfico.
 * Aparece en cuanto una petición tarda más de 2,5 s (o falla y se reintenta), cuenta los segundos
 * para que la pantalla nunca parezca colgada, y se quita en cuanto la API responde.
 * El idioma por defecto es inglés; solo pasa a español si la persona lo eligió antes.
 */
const TEXT = {
  es: {
    title: 'Despertando el servidor…',
    body: 'El MVP usa un servidor gratuito que se duerme cuando nadie lo usa. La primera carga puede tardar hasta 1 minuto; después todo va rápido.',
    elapsed: (s: number) => `Esperando respuesta… ${s} s`,
  },
  en: {
    title: 'Waking up the server…',
    body: 'This MVP runs on a free server that sleeps when idle. The first load can take up to 1 minute; after that everything is fast.',
    elapsed: (s: number) => `Waiting for a response… ${s} s`,
  },
}

function currentLang(): 'es' | 'en' {
  try {
    if (localStorage.getItem('laymisat-lang') === 'es') return 'es'
  } catch {
    /* almacenamiento no disponible */
  }
  return document.documentElement.lang === 'es' ? 'es' : 'en'
}

export default function WakeNotice() {
  const [waking, setWaking] = useState(isServerWaking)
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const on = (e: Event) => setWaking((e as CustomEvent<boolean>).detail)
    serverStatus.addEventListener('change', on)
    return () => serverStatus.removeEventListener('change', on)
  }, [])
  useEffect(() => {
    if (!waking) {
      setSecs(0)
      return
    }
    const id = window.setInterval(() => setSecs((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [waking])
  if (!waking) return null
  const t = TEXT[currentLang()]
  return (
    <div className="wake-notice" role="status" aria-live="polite">
      <span className="wake-spin" aria-hidden="true" />
      <div>
        <b>{t.title}</b>
        <p>{t.body}</p>
        <p className="wake-secs">{t.elapsed(secs)}</p>
        <div className="wake-bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, (secs / 60) * 100)}%` }} />
        </div>
      </div>
    </div>
  )
}
