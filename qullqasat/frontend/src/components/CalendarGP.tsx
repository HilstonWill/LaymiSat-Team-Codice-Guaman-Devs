import { useRef, useState, type KeyboardEvent } from 'react'
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

export default function CalendarGP({ rows, t, lang }: { rows: CalendarRow[]; t: Dict; lang: Lang }) {
  const w = t.wheel
  const n = rows.length
  const todayMonth = new Date().getMonth() + 1
  const todayIdx = Math.max(0, rows.findIndex((r) => r.month === todayMonth))
  const [sel, setSel] = useState(todayIdx)
  const segRefs = useRef<(SVGGElement | null)[]>([])
  const row = rows[sel] ?? rows[0]
  if (!row) return null

  const go = (i: number, focus = false) => {
    const next = (i + n) % n
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
          <li className="st-se_desfasa">{t.status.se_desfasa}</li>
          <li className="st-no_coincide">{t.status.no_coincide}</li>
          <li className="st-informativo">{t.status.informativo}</li>
        </ul>
        <ul className="gp-legend gp-seasons" aria-hidden="true">
          <li className="rainy">{w.rainy}</li>
          <li className="transition">{w.transition}</li>
          <li className="dry">{w.dry}</li>
          <li className="sun">{w.today}</li>
        </ul>
        <p className="gp-summary">
          {w.summary(count('se_mantiene'), count('se_desfasa'), count('no_coincide'), count('informativo'))}
        </p>
      </div>

      <article className={`gp-detail st-${row.status}`} aria-live="polite">
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

        <section className="gp-line">
          <span className="gp-label">{w.said}</span>
          <p>{row.milestone}</p>
          {row.source_url && row.page && (
            <a className="gp-src" href={row.source_url} target="_blank" rel="noopener noreferrer">
              {w.seeManuscript(row.page)}
            </a>
          )}
        </section>

        <section className="gp-line">
          <span className="gp-label">{w.nasa}</span>
          <p>
            {row.data_sentence && <span className={`gp-trend ${trendClass}`}>{row.data_sentence}</span>}{' '}
            {row.indicator_label}: <b>{row.plain_now}</b>{' '}
            <span className="gp-before">
              ({w.before}: {row.plain_before})
            </span>
          </p>
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
