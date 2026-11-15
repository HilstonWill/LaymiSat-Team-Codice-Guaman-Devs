import { useEffect, useState } from 'react'
import { isServerWaking, serverStatus } from '../api'

/**
 * Aviso mientras el servidor gratuito (Render) despierta tras un rato sin tráfico.
 * Aparece solo si una petición tarda más de 6 s (o falla y se reintenta) y se quita en cuanto la API responde.
 */
const TEXT = {
  es: {
    title: 'Despertando el servidor…',
    body: 'El MVP usa un servidor gratuito que se duerme cuando nadie lo usa. La primera carga puede tardar hasta 1 minuto; después todo va rápido.',
  },
  en: {
    title: 'Waking up the server…',
    body: 'This MVP runs on a free server that sleeps when idle. The first load can take up to 1 minute; after that everything is fast.',
  },
}

export default function WakeNotice() {
  const [waking, setWaking] = useState(isServerWaking)
  useEffect(() => {
    const on = (e: Event) => setWaking((e as CustomEvent<boolean>).detail)
    serverStatus.addEventListener('change', on)
    return () => serverStatus.removeEventListener('change', on)
  }, [])
  if (!waking) return null
  const t = document.documentElement.lang === 'en' ? TEXT.en : TEXT.es
  return (
    <div className="wake-notice" role="status" aria-live="polite">
      <span className="wake-spin" aria-hidden="true" />
      <div>
        <b>{t.title}</b>
        <p>{t.body}</p>
      </div>
    </div>
  )
}
