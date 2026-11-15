import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { CalendarRow } from '../api'
import { fmtNum, type Dict, type Lang } from '../i18n'

/**
 * Rueda del año andino (Guaman Poma, 1615) frente a NASA POWER.
 * Los 12 meses van de agosto (Chacra Yapuy, arriba) a julio, en el orden de la campaña.
 * Cada mes se colorea según si lo que describe el códice se sigue cumpliendo en los datos.
 */

const SIZE = 320
const C = SIZE / 2
const R_OUT = 150
const R_IN = 72
const R_LABEL = 112
const POP = 7 // desplazamiento del mes elegido hacia afuera
const R_SEASON_IN = 156 // anillo de estaciones (lluvias / transición / seca)
const R_SEASON_OUT = 164
const R_TOC = 177 // anillo tocapu: cuadros geométricos como en los textiles andinos
const TOC_N = 48
const TOC_COLORS = ['var(--maize)', 'var(--terracotta)', 'var(--potato)', 'var(--leaf)']
const RAINY = new Set([11, 12, 1, 2, 3])
const TRANSITION = new Set([4, 10])

// Chakana (cruz andina escalonada) centrada en (C, C).
const CHAKANA = (() => {
  const u = 21
  const pts = [
    [-1, -3], [1, -3], [1, -2], [2, -2], [2, -1], [3, -1], [3, 1], [2, 1], [2, 2], [1, 2], [1, 3],
    [-1, 3], [-1, 2], [-2, 2], [-2, 1], [-3, 1], [-3, -1], [-2, -1], [-2, -2], [-1, -2],
  ]
  return pts.map(([x, y]) => `${C + x * u},${C + y * u}`).join(' ')
})()

function arcBand(i: number, n: number, rIn: number, rOut: number) {
  const step = 360 / n
  const a0 = -90 - step / 2 + i * step
  const a1 = a0 + step
  const [x0, y0] = pt(a0, rOut)
  const [x1, y1] = pt(a1, rOut)
  const [x2, y2] = pt(a1, rIn)
  const [x3, y3] = pt(a0, rIn)
  return `M${x0} ${y0}A${rOut} ${rOut} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${rIn} ${rIn} 0 0 0 ${x3} ${y3}Z`
}

const rad = (deg: number) => (deg * Math.PI) / 180
const pt = (deg: number, r: number) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))] as const

function segmentPath(i: number, n: number) {
  const step = 360 / n
  const a0 = -90 - step / 2 + i * step + 0.6
  const a1 = a0 + step - 1.2
  const [x0, y0] = pt(a0, R_OUT)
  const [x1, y1] = pt(a1, R_OUT)
  const [x2, y2] = pt(a1, R_IN)
  const [x3, y3] = pt(a0, R_IN)
  return `M${x0} ${y0}A${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${R_IN} ${R_IN} 0 0 0 ${x3} ${y3}Z`
}

const SHORT: Record<Lang, string[]> = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

type Glyph = 'frost' | 'sun' | 'drop' | 'thermo'
const GLYPH: Record<string, Glyph> = {
  days_tmin_below_m2: 'frost',
  days_frost: 'frost',
  days_chuno: 'frost',
  share_dry_spell_ge10: 'sun',
  tmax_mean: 'sun',
  share_rain_2nd_half_gt25: 'drop',
  share_gwet_below_p15: 'drop',
  days_rain_gt45: 'drop',
  monthly_precip: 'drop',
  thermal_amplitude: 'thermo',
  tmean_mean: 'thermo',
}

function GlyphIcon({ kind, className }: { kind: Glyph; className?: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true as const, className }
  if (kind === 'sun')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <path
          d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  if (kind === 'frost')
    return (
      <svg {...common}>
        <path
          d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    )
  if (kind === 'thermo')
    return (
      <svg {...common}>
        <path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="17" r="2" fill="currentColor" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z" fill="currentColor" />
    </svg>
  )
}

/**
 * Comparación visual "antes vs hoy" del indicador NASA del mes.
 * - % de años: una fila de puntos por periodo (cada punto es una campaña; los rellenos cumplen la condición).
 *   Los puntos cuentan campañas, no siguen su orden cronológico.
 * - Otras unidades: dos barras a la misma escala.
 */
function DataCompare({ row, w }: { row: CalendarRow; w: Dict['wheel'] }) {
  const isShare = row.unit.startsWith('%')
  const tone = row.trend === 'worse' ? 'worse' : row.trend === 'better' ? 'better' : 'same'
  const periods = [
    { key: 'early', label: w.then, period: row.early_period, value: row.early, n: row.n_early, text: row.plain_before },
    { key: 'recent', label: w.now, period: row.recent_period, value: row.recent, n: row.n_recent, text: row.plain_now },
  ]
  const max = Math.max(Math.abs(row.early ?? 0), Math.abs(row.recent ?? 0), 0.0001) * 1.15
  return (
    <div className={`gp-compare tone-${tone}`}>
      {periods.map((p) => {
        const filled = isShare && p.value !== null ? Math.round((p.value * p.n) / 100) : 0
        return (
          <div key={p.key} className={`gp-cmp-row is-${p.key}`}>
            <div className="gp-cmp-label">
              <b>{p.label}</b>
              <span>{p.period}</span>
            </div>
            {isShare ? (
              <div className="gp-dots gp-glyphs" role="img" aria-label={p.text}>
                {Array.from({ length: p.n }, (_, i) => (
                  <GlyphIcon key={i} kind={GLYPH[row.indicator] ?? 'drop'} className={i < filled ? 'on' : ''} />
                ))}
              </div>
            ) : (
              <div className="gp-bar" role="img" aria-label={p.text}>
                <i style={{ width: `${p.value === null ? 0 : (Math.abs(p.value) / max) * 100}%` }} />
              </div>
            )}
            <span className="gp-cmp-value">{p.text}</span>
          </div>
        )
      })}
      {isShare && <p className="gp-cmp-help">{w.dotHelp}</p>}
      <p className="gp-source">
        {row.nasa_variables.some((v) => v.startsWith('T2M'))
          ? w.sourceTemp(row.nasa_variables.join(', '))
          : w.sourceCell(row.nasa_variables.join(', '))}
      </p>
    </div>
  )
}

export default function CalendarGP({ rows, t, lang }: { rows: CalendarRow[]; t: Dict; lang: Lang }) {
  const w = t.wheel
  const n = rows.length
  const todayMonth = new Date().getMonth() + 1
  const todayIdx = Math.max(0, rows.findIndex((r) => r.month === todayMonth))
  const [sel, setSel] = useState(todayIdx)
  const segRefs = useRef<(SVGGElement | null)[]>([])
  const cardRef = useRef<HTMLElement | null>(null)
  const dirRef = useRef<1 | -1>(1)
  const firstRender = useRef(true)

  // Cambio de hoja: la tarjeta del mes gira sobre su lomo (izquierdo si avanza, derecho si retrocede).
  // Se anima el mismo nodo (sin remontarlo) para no perder el foco del teclado en las flechas.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const el = cardRef.current
    if (!el || typeof el.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
      return
    }
    const fwd = dirRef.current === 1
    const turn = fwd ? -78 : 78
    el.animate(
      [
        {
          transformOrigin: fwd ? 'left center' : 'right center',
          transform: `perspective(1600px) rotateY(${turn}deg)`,
          opacity: 0.15,
          filter: 'brightness(0.72)',
          offset: 0,
        },
        {
          transformOrigin: fwd ? 'left center' : 'right center',
          transform: `perspective(1600px) rotateY(${turn * 0.22}deg)`,
          opacity: 1,
          filter: 'brightness(0.94)',
          offset: 0.6,
        },
        {
          transformOrigin: fwd ? 'left center' : 'right center',
          transform: 'perspective(1600px) rotateY(0deg)',
          opacity: 1,
          filter: 'brightness(1)',
          offset: 1,
        },
      ],
      { duration: 620, easing: 'cubic-bezier(0.22, 0.8, 0.28, 1)' },
    )
  }, [sel])

  const row = rows[sel] ?? rows[0]
  if (!row) return null

  const go = (i: number, focus = false) => {
    const next = (i + n) % n
    // Dirección por el camino más corto en la rueda (de Julio a Agosto sigue siendo "avanzar").
    dirRef.current = (next - sel + n) % n <= n / 2 ? 1 : -1
    setSel(next)
    if (focus) segRefs.current[next]?.focus()
  }

  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    const keys: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: n - 1,
    }
    if (e.key in keys) {
      e.preventDefault()
      go(keys[e.key], true)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      go(i)
    }
  }

  const count = (s: CalendarRow['status']) => rows.filter((r) => r.status === s).length
  const digits = row.unit === '°C' ? 1 : row.unit === 'mm' || row.unit.startsWith('%') ? 0 : 1
  const showInstead = (row.status === 'se_desfasa' || row.status === 'no_coincide') && row.alternative
  const trendClass = row.trend === 'worse' ? 'worse' : row.trend === 'better' ? 'better' : 'same'
  // Respuesta en una frase, armada con los mismos números que el gráfico.
  const what = w.what[row.indicator] ?? ''
  // Si la condición del códice casi nunca se da, la respuesta lo dice primero ("Rara vez").
  const lead = row.status === 'no_coincide' ? w.rarely : row.data_sentence
  const answer = row.unit.startsWith('%')
    ? w.answerShare(
        lead,
        Math.round(((row.recent ?? 0) * row.n_recent) / 100),
        row.n_recent,
        what,
        Math.round(((row.early ?? 0) * row.n_early) / 100),
      )
    : w.answerValue(lead, row.plain_now, what, row.plain_before)
  const step = 360 / n
  const todayMid = -90 + todayIdx * step
  const [tdx, tdy] = pt(todayMid, R_TOC + 17)

  return (
    <div className="gp-stage">
    <div className="gp">
      <div className="gp-wheel-col">
        <svg className="gp-wheel" viewBox={`-44 -44 ${SIZE + 88} ${SIZE + 88}`} role="group" aria-label={w.label}>
          {/* Anillo tocapu y estaciones: decorativos, el significado está en la leyenda */}
          <g aria-hidden="true">
            {Array.from({ length: TOC_N }, (_, k) => {
              const a = -90 + (k * 360) / TOC_N
              const [x, y] = pt(a, R_TOC)
              const big = k % 2 === 0
              const sz = big ? 9 : 6
              return (
                <rect
                  key={k}
                  className="gp-tocapu"
                  x={x - sz / 2}
                  y={y - sz / 2}
                  width={sz}
                  height={sz}
                  fill={TOC_COLORS[k % TOC_COLORS.length]}
                  transform={`rotate(${a + 45} ${x} ${y})`}
                />
              )
            })}
            {rows.map((r, i) => (
              <path
                key={`s${r.month}`}
                d={arcBand(i, n, R_SEASON_IN, R_SEASON_OUT)}
                className={`gp-season ${RAINY.has(r.month) ? 'rainy' : TRANSITION.has(r.month) ? 'transition' : 'dry'}`}
              />
            ))}
            <polygon className="gp-chakana" points={CHAKANA} />
          </g>
          {rows.map((r, i) => {
            const mid = -90 + i * step
            const [lx, ly] = pt(mid, R_LABEL)
            const active = i === sel
            const [dx, dy] = active ? [POP * Math.cos(rad(mid)), POP * Math.sin(rad(mid))] : [0, 0]
            return (
              <g
                key={r.month}
                ref={(el) => {
                  segRefs.current[i] = el
                }}
                className={`gp-seg st-${r.status}${active ? ' is-active' : ''}`}
                style={{ transform: `translate(${dx}px, ${dy}px)`, ['--i' as string]: i }}
                role="button"
                tabIndex={active ? 0 : -1}
                aria-pressed={active}
                aria-label={w.monthButton(r.name, r.quechua, t.status[r.status])}
                onClick={() => go(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <path d={segmentPath(i, n)} />
                <text x={lx} y={ly + 4} textAnchor="middle">
                  {SHORT[lang][r.month - 1]}
                </text>
                {(r.status === 'se_desfasa' || r.status === 'no_coincide') && (
                  <g className="gp-warn" aria-hidden="true">
                    <circle cx={pt(mid, R_OUT - 14)[0]} cy={pt(mid, R_OUT - 14)[1]} r={8} />
                    <text x={pt(mid, R_OUT - 14)[0]} y={pt(mid, R_OUT - 14)[1] + 4} textAnchor="middle">
                      !
                    </text>
                  </g>
                )}
              </g>
            )
          })}
          {/* Inti (sol) marca el mes de hoy */}
          <g className="gp-today" aria-hidden="true">
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k * Math.PI) / 4
              return (
                <line
                  key={k}
                  x1={tdx + 7 * Math.cos(a)}
                  y1={tdy + 7 * Math.sin(a)}
                  x2={tdx + 11 * Math.cos(a)}
                  y2={tdy + 11 * Math.sin(a)}
                />
              )
            })}
            <circle cx={tdx} cy={tdy} r={5} />
          </g>
          <g className="gp-center" aria-hidden="true">
            <text x={C} y={C - 14} textAnchor="middle" className="gp-c-month">
              {row.name}
            </text>
            <text x={C} y={C + 6} textAnchor="middle" className="gp-c-q">
              {row.quechua.replace(/ Quilla$/, '')}
            </text>
            <text x={C} y={C + 24} textAnchor="middle" className="gp-c-sub">
              {row.month === todayMonth ? w.today : row.page ? w.page(row.page) : ''}
            </text>
          </g>
        </svg>
        <ul className="gp-legend" aria-hidden="true">
          <li className="st-se_mantiene">{t.status.se_mantiene}</li>
          <li className="st-ojo">{w.watch}</li>
          <li className="st-informativo">{t.status.informativo}</li>
        </ul>
        <p className="gp-ring-note">{w.ringNote}</p>
        <p className="gp-summary">
          {w.summary(count('se_mantiene'), count('se_desfasa'), count('no_coincide'), count('informativo'))}
        </p>
      </div>

      <article ref={cardRef} className={`gp-detail st-${row.status}`} aria-live="polite">
        <header className="gp-head">
          <button type="button" className="gp-nav" onClick={() => go(sel - 1)} aria-label={w.prev}>
            ‹
          </button>
          <div className="gp-title">
            <span className={`gp-chip st-${row.status}`}>{t.status[row.status]}</span>
            <h3>
              {row.name} <span className="gp-q">· {row.quechua}</span>
            </h3>
          </div>
          <button type="button" className="gp-nav" onClick={() => go(sel + 1)} aria-label={w.next}>
            ›
          </button>
        </header>

        <section className={`gp-ask tone-${trendClass}`}>
          <p className="gp-question">
            <GlyphIcon kind={GLYPH[row.indicator] ?? 'drop'} className="gp-q-icon" />
            {w.q[row.indicator] ?? row.indicator_label}
          </p>
          <p className="gp-answer">{answer}</p>
          <DataCompare row={row} w={w} />
          {row.status === 'no_coincide' && <p className="gp-note">{w.noMatch}</p>}
        </section>

        {row.action && (
          <section className="gp-line gp-todo">
            <span className="gp-label">{w.todo}</span>
            <p>{row.action}</p>
            {showInstead && (
              <p className="gp-instead">
                <b>{w.instead}:</b> {row.alternative}
              </p>
            )}
          </section>
        )}

        <section className="gp-line gp-said">
          <span className="gp-label">{w.said}</span>
          <p>{row.milestone}</p>
          {row.source_url && row.page && (
            <a className="gp-src" href={row.source_url} target="_blank" rel="noopener noreferrer">
              {w.seeManuscript(row.page)}
            </a>
          )}
        </section>

        <details className="gp-tech">
          <summary>{w.technical}</summary>
          <p>
            {row.indicator_label}: {fmtNum(row.early, lang, digits)} → {fmtNum(row.recent, lang, digits)} {row.unit} ·{' '}
            {row.early_period} → {row.recent_period}
          </p>
          <p>{row.criterion}</p>
          <p>NASA POWER: {row.nasa_variables.join(', ')}</p>
        </details>
      </article>
    </div>
    </div>
  )
}
