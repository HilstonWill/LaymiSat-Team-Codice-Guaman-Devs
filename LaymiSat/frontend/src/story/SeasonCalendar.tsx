import { useRef, useState, type KeyboardEvent } from 'react'
import type { CalendarRow } from '../api'
import type { Dict, Lang } from '../i18n'
import type { StoryDict } from './storyText'

/**
 * Calendario de la campaña, versión simple (pestaña "Calendario" del escenario principal).
 * Una tira de 12 meses (ago → jul) y una tarjeta del mes con tres pasos: antes (Guaman Poma) → hoy (NASA) → qué hacer.
 * La rueda completa (CalendarGP) sigue en la vista técnica.
 */

const SHORT: Record<Lang, string[]> = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
const RAINY = new Set([11, 12, 1, 2, 3])
const TRANSITION = new Set([4, 10])
const season = (m: number) => (RAINY.has(m) ? 'rainy' : TRANSITION.has(m) ? 'transition' : 'dry')

type Tone = 'ok' | 'changed' | 'nomatch' | 'info'
const TONE: Record<CalendarRow['status'], Tone> = {
  se_mantiene: 'ok',
  se_desfasa: 'changed',
  no_coincide: 'nomatch',
  informativo: 'info',
}

function StatusIcon({ tone }: { tone: Tone }) {
  if (tone === 'ok')
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (tone === 'info')
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" fill="currentColor" />
      </svg>
    )
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  )
}

export default function SeasonCalendar({ rows, t, d, lang }: { rows: CalendarRow[]; t: StoryDict; d: Dict; lang: Lang }) {
  const n = rows.length
  const todayMonth = new Date().getMonth() + 1
  const todayIdx = Math.max(0, rows.findIndex((r) => r.month === todayMonth))
  const [sel, setSel] = useState(todayIdx)
  const btns = useRef<(HTMLButtonElement | null)[]>([])
  const row = rows[sel] ?? rows[0]
  if (!row) return null

  const go = (i: number, focus = false) => {
    const next = (i + n) % n
    setSel(next)
    if (focus) btns.current[next]?.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const keys: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }
    if (e.key in keys) {
      e.preventDefault()
      go(keys[e.key], true)
    }
  }

  const label: Record<Tone, string> = { ok: t.calOk, changed: t.calChanged, nomatch: t.calNoMatch, info: t.calInfo }
  const counts = rows.reduce<Record<Tone, number>>(
    (c, r) => ({ ...c, [TONE[r.status]]: c[TONE[r.status]] + 1 }),
    { ok: 0, changed: 0, nomatch: 0, info: 0 },
  )
  const tone = TONE[row.status]
  const trend = row.trend === 'worse' ? 'worse' : row.trend === 'better' ? 'better' : 'same'
  const question = d.wheel.q[row.indicator] ?? row.indicator_label
  const showInstead = (tone === 'changed' || tone === 'nomatch') && row.alternative

  return (
    <div className="scal">
      <header className="scal-head">
        <div>
          <span className="scal-kicker">Nueva corónica y buen gobierno · 1615</span>
          <h2 className="scal-title">{t.calTitle}</h2>
          <p className="scal-sub">{t.calSub}</p>
        </div>
        <ul className="scal-counts" aria-label={t.calSummaryLabel}>
          {(['ok', 'changed', 'nomatch', 'info'] as const).map(
            (k) =>
              counts[k] > 0 && (
                <li key={k} className={`scal-count tone-${k}`}>
                  <StatusIcon tone={k} />
                  <b>{counts[k]}</b> {label[k]}
                </li>
              ),
          )}
        </ul>
      </header>

      <div className="scal-strip" role="toolbar" aria-label={t.calStripLabel}>
        {rows.map((r, i) => {
          const tn = TONE[r.status]
          return (
            <button
              key={r.month}
              ref={(el) => {
                btns.current[i] = el
              }}
              type="button"
              className={`scal-month s-${season(r.month)} tone-${tn}${i === sel ? ' is-sel' : ''}`}
              aria-pressed={i === sel}
              aria-label={`${r.name}: ${label[tn]}${r.month === todayMonth ? ` · ${t.calThisMonth}` : ''}`}
              tabIndex={i === sel ? 0 : -1}
              onClick={() => go(i)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span className="scal-m-name">{SHORT[lang][r.month - 1]}</span>
              <span className="scal-m-status">
                <StatusIcon tone={tn} />
              </span>
              {r.month === todayMonth && <span className="scal-m-today">{t.calThisMonth}</span>}
            </button>
          )
        })}
      </div>
      <ul className="scal-seasons" aria-hidden="true">
        <li className="s-dry">{t.calDry}</li>
        <li className="s-transition">{t.calTransition}</li>
        <li className="s-rainy">{t.calRainy}</li>
      </ul>

      <article className={`scal-card tone-${tone}`} aria-live="polite">
        <header className="scal-card-head">
          <button type="button" className="scal-nav" onClick={() => go(sel - 1)} aria-label={t.calPrev}>
            ‹
          </button>
          <div className="scal-card-title">
            <h3>
              {row.name}
              {row.month === todayMonth && <span className="scal-now">{t.calThisMonth}</span>}
            </h3>
            <span className="scal-q">{row.quechua}</span>
          </div>
          <span className={`scal-badge tone-${tone}`}>
            <StatusIcon tone={tone} /> {label[tone]}
          </span>
          <button type="button" className="scal-nav" onClick={() => go(sel + 1)} aria-label={t.calNext}>
            ›
          </button>
        </header>

        <ol className="scal-steps">
          <li className="scal-step step-then">
            <span className="scal-step-label">{t.calThen}</span>
            <p className="scal-milestone">{row.milestone}</p>
            {row.source_url && row.page && (
              <a className="scal-link" href={row.source_url} target="_blank" rel="noopener noreferrer">
                {t.calSource(row.page)} ↗
              </a>
            )}
          </li>

          <li className={`scal-step step-now trend-${trend}`}>
            <span className="scal-step-label">{t.calNow}</span>
            <p className="scal-question">{question}</p>
            <p className="scal-verdict">{tone === 'nomatch' ? d.wheel.rarely : row.data_sentence}</p>
            <dl className="scal-compare">
              <div>
                <dt>
                  {t.calBefore} <span>{row.early_period}</span>
                </dt>
                <dd>{row.plain_before}</dd>
              </div>
              <div className="is-now">
                <dt>
                  {t.calToday} <span>{row.recent_period}</span>
                </dt>
                <dd>{row.plain_now}</dd>
              </div>
            </dl>
          </li>

          <li className="scal-step step-do">
            <span className="scal-step-label">{t.calDo}</span>
            <p className="scal-action">{row.action}</p>
            {showInstead && (
              <p className="scal-instead">
                <b>{t.calInstead}:</b> {row.alternative}
              </p>
            )}
          </li>
        </ol>

        <details className="scal-tech">
          <summary>{t.calTech}</summary>
          <p>{row.criterion}</p>
          <p>NASA POWER: {row.nasa_variables.join(', ')}</p>
        </details>
      </article>
    </div>
  )
}
