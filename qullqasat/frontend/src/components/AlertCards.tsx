import { useEffect, useState } from 'react'
import type { Alert, Explanation, Level } from '../api'
import { fmtNum, pValue, type Dict, type Lang } from '../i18n'
import { AiAnswer } from './AiText'
import { ALERT_ICONS } from './Icons'

/** Medidor horizontal: relleno del valor + marca del umbral de la alerta. Ver docs/ESTILO.md › Medidor. */
function Meter({ value, min, max, threshold, level, label }: {
  value: number | null
  min: number
  max: number
  threshold: number
  level: Level
  label: string
}) {
  if (value === null || Number.isNaN(value)) return null
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))
  return (
    <div className="meter" role="img" aria-label={label}>
      <div className="meter-track">
        <i className={`meter-fill ${level}`} style={{ width: `${pct(value)}%` }} />
        <i className="meter-threshold" style={{ left: `${pct(threshold)}%` }} />
      </div>
      <span className="meter-label">{label}</span>
    </div>
  )
}

function meterFor(a: Alert, t: Dict, lang: Lang) {
  const m = a.metrics as Record<string, number | null>
  const c = a.current as Record<string, number | string | null>
  if (a.id === 'AHS') {
    const p = m.event_probability_recent ?? null
    const n = (m.recent_n as number | null) ?? 15
    const hits = p === null ? null : Math.round(p * n)
    return (
      <Meter value={p === null ? null : p * 100} min={0} max={100} threshold={50} level={a.level}
        label={t.alertMeterFrost(fmtNum(hits, lang), fmtNum(n, lang))} />
    )
  }
  if (a.id === 'AEH') {
    const pct = (c.percentile as number | null) ?? null
    return (
      <Meter value={pct} min={0} max={100} threshold={20} level={a.level}
        label={t.alertMeterRain(fmtNum(pct, lang))} />
    )
  }
  const shift = (c.shift_days as number | null) ?? null
  return (
    <Meter value={shift} min={-30} max={90} threshold={21} level={a.level}
      label={shift === null ? '' : t.alertMeterShift(`${shift > 0 ? '+' : ''}${fmtNum(shift, lang)}`)} />
  )
}

type AlertId = 'AHS' | 'AEH' | 'ADS'

/** Explicación con IA de UNA alerta, bajo demanda (ver docs/ESTILO.md › Explicación con IA). */
function AlertAi({ id, t, explain, resetKey }: {
  id: AlertId
  t: Dict
  explain: (id: AlertId) => Promise<Explanation>
  resetKey: unknown
}) {
  const [state, setState] = useState<{ busy: boolean; res: Explanation | null; err: string | null; open: boolean }>(
    { busy: false, res: null, err: null, open: false },
  )
  useEffect(() => setState({ busy: false, res: null, err: null, open: false }), [resetKey])
  const run = () => {
    if (state.res) {
      setState((s) => ({ ...s, open: !s.open }))
      return
    }
    setState({ busy: true, res: null, err: null, open: true })
    explain(id)
      .then((res) => setState({ busy: false, res, err: null, open: true }))
      .catch((e: Error) => setState({ busy: false, res: null, err: e.message, open: true }))
  }
  return (
    <div className="alert-ai">
      <button type="button" className="ai-chip" onClick={run} disabled={state.busy} aria-expanded={state.open}>
        <span aria-hidden="true">✦</span> {state.res && state.open ? t.alertAiCardHide : t.alertAiCard}
      </button>
      <div aria-live="polite">
        {state.open && state.busy && <p className="meta ai-thinking">{t.alertAiLoading}</p>}
        {state.open && state.err && <div className="error">{state.err}</div>}
        {state.open && state.res && (
          <AiAnswer compact text={state.res.text} label={t.alertAiLabel(state.res.model)} skipLabel={t.alertAiSkip} />
        )}
      </div>
    </div>
  )
}

export default function AlertCards({ alerts, t, lang, aiEnabled = false, explain, resetKey, simple = false }: {
  alerts: Alert[]
  t: Dict
  lang: Lang
  aiEnabled?: boolean
  explain?: (id: AlertId) => Promise<Explanation>
  resetKey?: unknown
  /** Modo agricultor: pregunta, veredicto, medidor y qué hacer; sin cifras ni detalle técnico. */
  simple?: boolean
}) {
  return (
    <div className="grid grid-3 alerts" aria-live="polite">
      {alerts.map((a) => {
        const tr = a.trend
        const Icon = ALERT_ICONS[a.id]
        return (
          <article key={a.id} id={`alert-${a.id}`} className={`card alert ${a.level}`} aria-labelledby={`q-${a.id}`}>
            <div className="alert-top">
              <span className={`alert-icon ${a.level}`}>
                <Icon size={26} />
              </span>
              <span className={`pill ${a.level}`}>{t.levels[a.level]}</span>
            </div>
            <h3 className="question" id={`q-${a.id}`}>
              {a.question ?? a.name}
            </h3>
            <p className={`verdict ${a.level}`}>{t.alertVerdict[a.id]?.[a.level]}</p>
            {meterFor(a, t, lang)}
            {!simple && <p className="headline">{a.headline}</p>}
            <div className="action">
              <span className="action-label">{t.whatToDo}</span> {a.action}
            </div>
            {aiEnabled && explain && <AlertAi id={a.id} t={t} explain={explain} resetKey={resetKey} />}
            {!simple && <details className="tech">
              <summary>{t.technical}</summary>
              <p className="meta">
                <b>{a.id} · {a.name}.</b> {t.trigger}: {a.trigger}
              </p>
              <p className="trend-chip">
                {t.trendSince} ({tr.variable}): <b>{tr.direction}</b> · {tr.slope_per_decade > 0 ? '+' : ''}
                {fmtNum(tr.slope_per_decade, lang, 2)} {tr.unit} · {pValue(tr.p_value, lang)}
              </p>
            </details>}
          </article>
        )
      })}
    </div>
  )
}
