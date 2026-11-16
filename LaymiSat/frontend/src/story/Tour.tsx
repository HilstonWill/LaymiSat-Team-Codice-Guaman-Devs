import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { Lang } from '../i18n'
import { TOUR_TEXT, type TourIcon, type TourStep, type TourView } from './tourText'
import './tour.css'

/**
 * Guía de primer uso, una por pantalla: un foco que se desliza de elemento en elemento y una tarjeta que explica
 * cada parte. Se abre sola la primera vez que se entra a cada pantalla (se recuerda en localStorage), se repite
 * con el botón "?" y se maneja con teclado (← → Esc). En celular la tarjeta se ancla abajo como una hoja.
 * Desactivada con ?demo=1 (presentación automática) o ?tour=0; ?tour=1 la fuerza aunque ya se haya visto.
 */
const KEY = 'laymisat-tour-v1'
const PAD = 8 // aire alrededor del elemento resaltado
const GAP = 14 // distancia entre el elemento y la tarjeta
const EDGE = 12 // margen mínimo con el borde de la pantalla

type Seen = Partial<Record<TourView, boolean>>
interface Box {
  x: number
  y: number
  w: number
  h: number
}

function readSeen(): Seen {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Seen) : {}
  } catch {
    return {}
  }
}

function writeSeen(patch: Seen) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readSeen(), ...patch }))
  } catch {
    /* almacenamiento no disponible: la guía simplemente se repetirá */
  }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none'
}

const VIEWS: TourView[] = ['zonas', 'hoy', 'rotaciones', 'calendario', 'historia']

function TourGlyph({ name }: { name: TourIcon }) {
  const paths: Record<TourIcon, ReactElement> = {
    welcome: <path d="M12 3l2.3 5.4L20 9.5l-4.3 3.7L17 19l-5-3-5 3 1.3-5.8L4 9.5l5.7-1.1z" />,
    tabs: (
      <>
        <path d="M12 3l9 5-9 5-9-5z" />
        <path d="M3 13l9 5 9-5" />
      </>
    ),
    map: (
      <>
        <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    light: (
      <>
        <rect x="8" y="2.5" width="8" height="19" rx="4" />
        <circle cx="12" cy="7" r="1.3" />
        <circle cx="12" cy="12" r="1.3" />
        <circle cx="12" cy="17" r="1.3" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    leaf: <path d="M5 19C5 10 11 5 20 4c0 9-5 15-14 15zM5 19c3-5 6-8 10-10" />,
    chart: <path d="M4 20V11M10 20V4M16 20v-7M22 20H2" />,
    play: <path d="M7 4l13 8-13 8z" />,
    slider: (
      <>
        <path d="M3 12h18" />
        <circle cx="14" cy="12" r="3" />
      </>
    ),
    steps: (
      <>
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
        <path d="M7 12h3M14 12h3" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.7 2.7L16 9.5" />
      </>
    ),
    frost: <path d="M12 2v20M4.2 7l15.6 10M4.2 17L19.8 7" />,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    pin: (
      <>
        <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
        <path d="M12 7v6M9 10h6" />
      </>
    ),
  }
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

/** Coloca la tarjeta junto al elemento resaltado, en el lado con más espacio (o el pedido, si cabe). */
function placeCard(box: Box | null, pop: { w: number; h: number }, vw: number, vh: number, pref: TourStep['place']) {
  if (!box) return { left: (vw - pop.w) / 2, top: (vh - pop.h) / 2 }
  const space = {
    bottom: vh - (box.y + box.h) - GAP - EDGE,
    top: box.y - GAP - EDGE,
    right: vw - (box.x + box.w) - GAP - EDGE,
    left: box.x - GAP - EDGE,
  }
  const fits = (s: keyof typeof space) => (s === 'top' || s === 'bottom' ? space[s] >= pop.h : space[s] >= pop.w)
  const order: (keyof typeof space)[] = ['bottom', 'top', 'right', 'left']
  const first = pref && pref !== 'auto' ? [pref, ...order.filter((s) => s !== pref)] : order
  const side = first.find(fits)
  const clampX = (x: number) => Math.max(EDGE, Math.min(vw - pop.w - EDGE, x))
  const clampY = (y: number) => Math.max(EDGE, Math.min(vh - pop.h - EDGE, y))
  const cx = box.x + box.w / 2 - pop.w / 2
  const cy = box.y + box.h / 2 - pop.h / 2
  if (side === 'bottom') return { left: clampX(cx), top: box.y + box.h + GAP }
  if (side === 'top') return { left: clampX(cx), top: box.y - GAP - pop.h }
  if (side === 'right') return { left: box.x + box.w + GAP, top: clampY(cy) }
  if (side === 'left') return { left: box.x - GAP - pop.w, top: clampY(cy) }
  // El elemento ocupa casi toda la pantalla: la tarjeta va dentro de él, abajo a la izquierda.
  return { left: clampX(box.x + 16), top: clampY(box.y + box.h - pop.h - 16) }
}

export default function Tour({
  view,
  lang,
  ready,
  openSignal,
  onActive,
}: {
  view: TourView
  lang: Lang
  /** La pantalla ya tiene sus datos: antes de eso no hay nada que explicar. */
  ready: boolean
  /** Sube cada vez que la persona pulsa "?" para repetir la guía. */
  openSignal: number
  /** Avisa cuando la guía se abre o se cierra (p. ej. para pausar la reproducción de 40 años). */
  onActive?: (active: boolean) => void
}) {
  const txt = TOUR_TEXT[lang]
  const flags = useMemo(() => {
    const q = new URLSearchParams(window.location.search)
    return { off: q.get('demo') === '1' || q.get('tour') === '0', force: q.get('tour') === '1' }
  }, [])

  const [active, setActive] = useState(false)
  const [steps, setSteps] = useState<TourStep[]>([])
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [pop, setPop] = useState({ w: 340, h: 220 })
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  const popRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  const start = useCallback(() => {
    const list = TOUR_TEXT[lang].steps[viewRef.current].filter((s) => !s.target || visible(document.querySelector(s.target)))
    if (!list.length) return
    returnFocus.current = document.activeElement as HTMLElement | null
    setSteps(list)
    setI(0)
    setBox(null)
    setActive(true)
  }, [lang])

  const close = useCallback((all = false) => {
    setActive(false)
    writeSeen(all ? Object.fromEntries(VIEWS.map((v) => [v, true])) : { [viewRef.current]: true })
    returnFocus.current?.focus?.({ preventScroll: true })
  }, [])

  // Primera vez en cada pantalla: se abre sola cuando ya hay datos.
  useEffect(() => {
    if (flags.off || !ready) return
    if (!flags.force && readSeen()[view]) return
    const id = window.setTimeout(start, 900)
    return () => window.clearTimeout(id)
  }, [view, ready, flags, start])

  // Botón "?": repite la guía de la pantalla actual.
  const lastSignal = useRef(openSignal)
  useEffect(() => {
    if (openSignal !== lastSignal.current) {
      lastSignal.current = openSignal
      start()
    }
  }, [openSignal, start])

  // Si cambia la pantalla con la guía abierta, se cierra sin marcarla como vista.
  useEffect(() => {
    setActive(false)
  }, [view])

  const step = active ? steps[i] : undefined

  const onActiveRef = useRef(onActive)
  onActiveRef.current = onActive
  useEffect(() => {
    onActiveRef.current?.(active)
  }, [active])

  // Sigue al elemento (aunque la página se desplace o cambie de tamaño) y lo trae a la vista.
  useEffect(() => {
    if (!step) return
    const el = step.target ? document.querySelector(step.target) : null
    if (visible(el)) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
    let raf = 0
    let last = ''
    const tick = () => {
      const e = step.target ? document.querySelector(step.target) : null
      let key = 'none'
      let next: Box | null = null
      if (visible(e)) {
        const r = e.getBoundingClientRect()
        // Un elemento más alto que la pantalla se recorta a lo visible, para que el foco no se salga.
        const x = Math.max(0, r.left)
        const y = Math.max(0, r.top)
        const w = Math.min(window.innerWidth, r.right) - x
        const h = Math.min(window.innerHeight, r.bottom) - y
        if (w > 0 && h > 0) {
          next = { x, y, w, h }
          key = [x, y, w, h].map(Math.round).join()
        }
      }
      if (key !== last) {
        last = key
        setBox(next)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [step])

  useEffect(() => {
    if (!active) return
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [active])

  // Mide la tarjeta para colocarla bien, y deja el foco en el botón principal.
  useLayoutEffect(() => {
    if (!popRef.current) return
    const r = popRef.current.getBoundingClientRect()
    setPop((p) => (Math.round(p.w) === Math.round(r.width) && Math.round(p.h) === Math.round(r.height) ? p : { w: r.width, h: r.height }))
  }, [step, vp])
  useEffect(() => {
    if (step) nextRef.current?.focus({ preventScroll: true })
  }, [step])

  const last = i === steps.length - 1
  const next = useCallback(() => {
    if (i >= steps.length - 1) close()
    else setI(i + 1)
  }, [i, steps.length, close])
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), [])

  // Teclado: ← → para moverse, Esc para salir, Tab queda dentro de la tarjeta.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      } else if (e.key === 'Tab' && popRef.current) {
        const f = [...popRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')]
        if (!f.length) return
        const first = f[0]
        const lastEl = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, next, back, close])

  if (!active || !step) return null

  const dock = vp.w < 600
  const sp = box ? { left: box.x - PAD, top: box.y - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 } : null
  const pos = dock
    ? { left: EDGE, right: EDGE, ...(box && box.y + box.h / 2 > vp.h * 0.5 ? { top: EDGE } : { bottom: EDGE }) }
    : (() => {
        const p = placeCard(sp ? { x: sp.left, y: sp.top, w: sp.width, h: sp.height } : null, pop, vp.w, vp.h, step.place)
        return { left: p.left, top: p.top }
      })()
  const welcome = !step.target
  const titleId = `tour-title-${step.id}`

  return createPortal(
    <div className="tour-root">
      <div className="tour-shield" aria-hidden="true" />
      {sp ? <div className="tour-spot" style={sp} aria-hidden="true" /> : <div className="tour-dim" aria-hidden="true" />}
      <div
        ref={popRef}
        className={`tour-pop${dock ? ' is-dock' : ''}${welcome ? ' is-center' : ''}`}
        style={welcome && !dock ? { left: (vp.w - pop.w) / 2, top: (vp.h - pop.h) / 2 } : pos}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tour-progress" role="progressbar" aria-label={txt.ui.dialog[view]} aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1}>
          <i style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="tour-body" key={step.id}>
          <div className="tour-head">
            <span className="tour-ico">
              <TourGlyph name={step.icon} />
            </span>
            <span className="tour-count">{txt.ui.step(i + 1, steps.length)}</span>
            <button type="button" className="tour-x" onClick={() => close()} aria-label={txt.ui.close}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <h3 id={titleId} className="tour-title">
            {step.title}
          </h3>
          <p className="tour-text">{step.body}</p>
          {step.tip && <p className="tour-tip">{step.tip}</p>}
        </div>
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden="true">
            {steps.map((s, n) => (
              <i key={s.id} className={n === i ? 'on' : n < i ? 'past' : ''} />
            ))}
          </div>
          <div className="tour-actions">
            {i === 0 ? (
              <button type="button" className="tour-ghost" onClick={() => close()}>
                {txt.ui.skip}
              </button>
            ) : (
              <button type="button" className="tour-ghost" onClick={back}>
                {txt.ui.back}
              </button>
            )}
            <button ref={nextRef} type="button" className="tour-primary" onClick={next}>
              {last ? txt.ui.done : i === 0 && welcome ? txt.ui.start : txt.ui.next}
            </button>
          </div>
          {i === 0 && (
            <button type="button" className="tour-never" onClick={() => close(true)}>
              {txt.ui.never}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
