import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { FAMILIES, FAMILY, type Family } from './rotationUtils'

/**
 * Selector de cultivo de una campaña (reemplaza al <select> nativo).
 * Ficha de color con la campaña y el cultivo; al tocarla abre un menú agrupado por familia.
 * Patrón "listbox" accesible: ↑/↓ mueven, Enter/Espacio eligen, Esc cierra, clic fuera cierra.
 * El menú usa position: fixed para no quedar recortado por la tarjeta con scroll.
 */

interface Props {
  value: string
  options: string[]
  campaign: string
  shortName: (id: string) => string
  fullName: (id: string) => string
  familyName: (f: Family) => string
  label: string
  onChange: (id: string) => void
}

// Menú en 2 columnas: los 9 cultivos caben sin scroll (~280 px de alto).
const MENU_W = 430
const GAP = 6

export default function CropPicker({ value, options, campaign, shortName, fullName, familyName, label, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxH: number; w: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const id = useId()

  // Opciones ordenadas por familia (así el menú se lee por grupos).
  const ordered = FAMILIES.flatMap((f) => options.filter((o) => (FAMILY[o] ?? 'grano') === f))
  const fam = FAMILY[value] ?? 'grano'

  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - GAP - 8
    const above = r.top - GAP - 8
    // En pantallas angostas el menú ocupa el ancho disponible (8 px de margen a cada lado).
    const w = Math.min(MENU_W, window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
    // Abre hacia abajo si cabe; si no, hacia el lado con más espacio.
    if (below >= 280 || below >= above) setPos({ left, w, top: r.bottom + GAP, maxH: Math.max(160, below) })
    else setPos({ left, w, bottom: window.innerHeight - r.top + GAP, maxH: Math.max(160, above) })
  }

  const openMenu = () => {
    setActive(Math.max(0, ordered.indexOf(value)))
    place()
    setOpen(true)
  }
  const close = (focusBtn = true) => {
    setOpen(false)
    if (focusBtn) btn.current?.focus()
  }
  const choose = (o: string) => {
    if (o !== value) onChange(o)
    close()
  }

  useLayoutEffect(() => {
    if (open) menu.current?.focus()
  }, [open])

  // Clic fuera, scroll o cambio de tamaño: cerrar (el menú está fijo a la pantalla).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false)
    }
    const onMove = (e: Event) => {
      if (e.target instanceof Node && menu.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  // Mantener visible la opción activa al moverse con el teclado.
  useEffect(() => {
    if (open) menu.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const onBtnKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openMenu()
    }
  }
  const onMenuKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const n = ordered.length
    if (e.key === 'ArrowDown') setActive((a) => (a + 1) % n)
    else if (e.key === 'ArrowUp') setActive((a) => (a - 1 + n) % n)
    // En la cuadrícula de 2 columnas, ←/→ también se mueven de a uno.
    else if (e.key === 'ArrowRight') setActive((a) => (a + 1) % n)
    else if (e.key === 'ArrowLeft') setActive((a) => (a - 1 + n) % n)
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(n - 1)
    else if (e.key === 'Enter' || e.key === ' ') choose(ordered[active])
    else if (e.key === 'Escape') close()
    else if (e.key === 'Tab') close(false)
    else return
    if (e.key !== 'Tab') e.preventDefault()
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`cp-trigger fam-${fam}${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-label={`${label}, ${campaign}: ${fullName(value)}`}
        title={fullName(value)}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onBtnKey}
      >
        <span className="cp-campaign">{campaign}</span>
        <span className="cp-value">{shortName(value)}</span>
        <svg className="cp-chev" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && pos && (
        <ul
          ref={menu}
          id={`${id}-menu`}
          className="cp-menu"
          role="listbox"
          tabIndex={-1}
          aria-label={`${label}, ${campaign}`}
          aria-activedescendant={`${id}-o${active}`}
          onKeyDown={onMenuKey}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH, width: pos.w }}
        >
          <li className="cp-head" role="presentation">
            {campaign}
          </li>
          {ordered.map((o, i) => {
            const f = FAMILY[o] ?? 'grano'
            const firstOfFamily = i === 0 || (FAMILY[ordered[i - 1]] ?? 'grano') !== f
            return (
              <li
                key={o}
                id={`${id}-o${i}`}
                data-i={i}
                role="option"
                aria-selected={o === value}
                className={`cp-opt fam-${f}${i === active ? ' is-active' : ''}${firstOfFamily && i > 0 ? ' is-group' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                <i className="cp-swatch" aria-hidden="true" />
                <span className="cp-opt-text">
                  <b>{fullName(o)}</b>
                  {familyName(f) !== fullName(o) && <small>{familyName(f)}</small>}
                </span>
                {o === value && (
                  <svg className="cp-check" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
