import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dynamicApi, type Explanation, type ForecastSummary, type Place, type SowingCurve } from '../api'
import { fmtNum, sdayLabel, type Dict, type Lang } from '../i18n'
import { CalendarIcon, DropIcon, FrostIcon } from './Icons'

interface Props {
  place: Place
  plantAdjust: number
  placeName: string
  t: Dict
  lang: Lang
}

const C = { rain: '#3d6fa8', frost: '#6b3d7a', window: '#2f8a4c', ink: '#1f2a44', maize: '#e0a43a', grid: '#e4dccb' }

/** Días desde el 1 de agosto para una fecha (campaña andina). */
function sdayOf(d: Date): number {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(y, 7, 1)) / 86400000)
}

function SowingSimulator({ place, plantAdjust, t, lang }: Props) {
  const [data, setData] = useState<SowingCurve | null>(null)
  const [sday, setSday] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setFailed(false)
    dynamicApi
      .sowing(place, plantAdjust, ctrl.signal)
      .then((d) => {
        setData(d)
        const today = sdayOf(new Date())
        setSday((cur) => cur ?? (today >= 0 && today <= 152 ? today - (today % 2) : d.best_sday ?? 60))
      })
      .catch(() => !ctrl.signal.aborted && setFailed(true))
    return () => ctrl.abort()
  }, [place, plantAdjust])

  const point = useMemo(() => {
    if (!data || sday === null) return null
    return data.curve.reduce((a, b) => (Math.abs(b.sday - sday) < Math.abs(a.sday - sday) ? b : a))
  }, [data, sday])

  if (failed) return <div className="error">{t.sectionError}</div>
  if (!data || !point || sday === null) return <div className="card"><p className="meta">{t.computing}</p></div>

  const chart = data.curve.map((p) => ({ ...p, rain: Math.round(p.rain_ready * 100), frost: Math.round(p.frost_risk * 100) }))
  const verdictKey: 'good' | 'risky' | 'early' =
    point.rain_ready < data.thresholds.rain_ready ? 'early' : point.frost_risk > data.thresholds.frost_risk ? 'risky' : 'good'
  const level = verdictKey === 'good' ? 'verde' : verdictKey === 'risky' ? 'rojo' : 'ambar'
  const w = data.window
  const maxSday = data.curve[data.curve.length - 1].sday

  return (
    <div className="card sim">
      <div className="sim-head">
        <h3>{t.alertSimTitle}</h3>
        <p className="meta">{t.alertSimIntro(fmtNum(data.campaigns.length, lang))}</p>
      </div>
      <label className="field sim-slider">
        <span>
          {t.alertSimDate}: <strong>{sdayLabel(sday, lang)}</strong>
        </span>
        <input
          type="range"
          min={0}
          max={maxSday}
          step={2}
          value={sday}
          aria-valuetext={sdayLabel(sday, lang)}
          onChange={(e) => setSday(Number(e.target.value))}
        />
      </label>
      <div className="sim-readout" aria-live="polite">
        <span className={`pill ${level}`}>{t.alertSimVerdict[verdictKey]}</span>
        <div className="sim-stat">
          <DropIcon size={18} />
          <span>{t.alertSimRain}</span>
          <b>{fmtNum(point.rain_ready * 100, lang)} %</b>
        </div>
        <div className="sim-stat">
          <FrostIcon size={18} />
          <span>{t.alertSimFrost}</span>
          <b>{fmtNum(point.frost_risk * 100, lang)} %</b>
        </div>
      </div>
      <div className="chart sim-chart">
        <ResponsiveContainer>
          <LineChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            {w && <ReferenceArea x1={w.from_sday} x2={w.to_sday} fill={w.meets_thresholds ? C.window : C.maize} fillOpacity={0.12} />}
            <XAxis dataKey="sday" type="number" domain={[0, maxSday]} tickFormatter={(v: number) => sdayLabel(v, lang)} tick={{ fontSize: 11 }} ticks={[0, 31, 61, 92, 122, 152]} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} width={44} />
            <Tooltip
              labelFormatter={(v) => sdayLabel(Number(v), lang)}
              formatter={(v: number, n) => [`${v} %`, n]}
            />
            <ReferenceLine x={data.codex.early_sowing_sday} stroke={C.maize} strokeDasharray="4 4" />
            <ReferenceLine x={data.codex.rainfed_sowing_sday} stroke={C.maize} strokeDasharray="4 4" />
            <ReferenceLine x={sday} stroke={C.ink} strokeWidth={2} />
            <Line type="stepAfter" dataKey="rain" name={t.alertSimLegendRain} stroke={C.rain} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="frost" name={t.alertSimLegendFrost} stroke={C.frost} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span><i className="swatch" style={{ background: C.rain }} />{t.alertSimLegendRain}</span>
        <span><i className="swatch" style={{ background: C.frost }} />{t.alertSimLegendFrost}</span>
        <span><CalendarIcon size={14} /> {t.alertSimCodex}</span>
      </div>
      {w && (
        <p className={`sim-window ${w.meets_thresholds ? 'ok' : 'warn'}`}>
          {(() => {
            const a = sdayLabel(w.from_sday, lang)
            const b = w.to_sday === w.from_sday ? a : sdayLabel(w.to_sday, lang)
            const range = (fn: (x: string, y: string) => string) => (a === b ? fn(a, a).replace(`${a} – ${a}`, a) : fn(a, b))
            return w.meets_thresholds ? range(t.alertSimWindow) : range(t.alertSimNoWindow)
          })()}
        </p>
      )}
    </div>
  )
}

function ForecastStrip({ place, plantAdjust, t, lang }: Props) {
  const [fc, setFc] = useState<ForecastSummary | null>(null)
  const [down, setDown] = useState(false)
  useEffect(() => {
    const ctrl = new AbortController()
    setDown(false)
    dynamicApi
      .forecast(place, plantAdjust, ctrl.signal)
      .then(setFc)
      .catch(() => !ctrl.signal.aborted && setDown(true))
    return () => ctrl.abort()
  }, [place, plantAdjust])

  const dayName = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PE', { weekday: 'short', day: 'numeric' })

  return (
    <div className="card fc">
      <div className="fc-head">
        <h3>{t.alertFcTitle}</h3>
        {fc && <span className={`pill ${fc.level}`}>{t.alertFcFrost(fc.frost_nights)}</span>}
      </div>
      <p className="meta">{t.alertFcIntro}</p>
      {down && <p className="meta">{t.alertFcDown}</p>}
      {fc && (
        <>
          <ol className="fc-days">
            {fc.days.map((d) => (
              <li key={d.date} className={d.frost ? 'frost' : ''}>
                <span className="fc-day">{dayName(d.date)}</span>
                {d.frost ? <FrostIcon size={20} /> : <DropIcon size={20} />}
                <b>{fmtNum(d.tmin_plant, lang, 1)}°</b>
                <span className="fc-rain">{fmtNum(d.rain_mm, lang, 1)} mm</span>
                {d.frost && <span className="sr-only">{t.alertFcFrostDay}</span>}
              </li>
            ))}
          </ol>
          <p className="meta">{t.alertFcRain(fmtNum(fc.rain_total_mm, lang, 1))}</p>
        </>
      )}
    </div>
  )
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/**
 * Escribe el texto palabra por palabra, como una persona tecleando (ver docs/ESTILO.md › Animación de escritura).
 * - Duración total acotada (≈ 4–6 s) aunque el texto sea largo.
 * - Con "reducir movimiento" el texto aparece completo.
 * - El texto animado es aria-hidden; los lectores de pantalla reciben el texto completo una sola vez.
 */
function Typewriter({ text, skipLabel }: { text: string; skipLabel: string }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text])
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setCount(tokens.length)
      return
    }
    setCount(0)
    const words = Math.ceil(tokens.length / 2)
    const delay = Math.max(25, Math.min(70, 5000 / Math.max(1, words)))
    const id = window.setInterval(() => {
      setCount((c) => {
        const next = c + 2 // palabra + espacio
        if (next >= tokens.length) window.clearInterval(id)
        return Math.min(next, tokens.length)
      })
    }, delay)
    return () => window.clearInterval(id)
  }, [tokens])

  const done = count >= tokens.length
  const lines = tokens.slice(0, count).join('').split(/\n+/)
  return (
    <>
      <div className="typed" aria-hidden="true">
        {lines.map((line, i) => (
          <p key={i}>
            {line.replace(/^\s*[-*•]\s*/, '• ')}
            {!done && i === lines.length - 1 && <span className="caret" />}
          </p>
        ))}
      </div>
      <div className="sr-only">{text}</div>
      {!done && (
        <button type="button" className="link-btn" onClick={() => setCount(tokens.length)}>
          {skipLabel}
        </button>
      )}
    </>
  )
}

function AiExplain({ place, plantAdjust, placeName, t, lang }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Explanation | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dynamicApi.health().then((h) => setEnabled(Boolean(h.ai))).catch(() => setEnabled(false))
  }, [])
  useEffect(() => setResult(null), [place, plantAdjust, lang])

  const ask = () => {
    setBusy(true)
    setError(null)
    dynamicApi
      .explain(place, plantAdjust, lang, placeName, question)
      .then(setResult)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }

  return (
    <div className="card ai">
      <h3>{t.alertAiTitle}</h3>
      {enabled === false ? (
        <p className="meta">{t.alertAiOff}</p>
      ) : (
        <>
          <label className="field">
            {t.alertAiAsk}
            <textarea
              rows={2}
              maxLength={300}
              value={question}
              placeholder={t.alertAiPlaceholder}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <p className="help">{t.alertAiPrivacy}</p>
          <button className="btn" onClick={ask} disabled={busy || enabled === null}>
            {t.alertAiButton}
          </button>
          <div aria-live="polite">
            {busy && <p className="meta">{t.alertAiLoading}</p>}
            {error && <div className="error">{error}</div>}
            {result && (
              <div className="ai-answer">
                <p className="ai-label">{t.alertAiLabel(result.model)}</p>
                <Typewriter text={result.text} skipLabel={t.alertAiSkip} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function DynamicAlerts(props: Props) {
  return (
    <div className="dyn">
      <SowingSimulator {...props} />
      <div className="dyn-side">
        <ForecastStrip {...props} />
        <AiExplain {...props} />
      </div>
    </div>
  )
}
