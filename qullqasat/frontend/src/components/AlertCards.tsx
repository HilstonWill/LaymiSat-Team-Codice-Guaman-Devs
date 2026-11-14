import { formatP, LEVEL_TEXT, type Alert } from '../api'

function TrendChip({ alert }: { alert: Alert }) {
  const t = alert.trend
  const sign = t.slope_per_decade > 0 ? '+' : ''
  return (
    <div className="trend-chip">
      Tendencia 1984–hoy ({t.variable}): <b>{t.direction}</b> · {sign}
      {t.slope_per_decade.toLocaleString('es-PE', { maximumFractionDigits: 2 })} {t.unit} · {formatP(t.p_value)}
    </div>
  )
}

export default function AlertCards({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="grid grid-3">
      {alerts.map((a) => (
        <article key={a.id} className={`card alert ${a.level}`} aria-label={`Alerta ${a.name}: nivel ${LEVEL_TEXT[a.level]}`}>
          <div className="alert-top">
            <div>
              <div className="code">{a.id}</div>
              <h3>{a.name}</h3>
            </div>
            <span className={`pill ${a.level}`}>{LEVEL_TEXT[a.level]}</span>
          </div>
          <p className="headline">{a.headline}</p>
          <div className="action">
            <b>Qué hacer:</b> {a.action}
          </div>
          <TrendChip alert={a} />
          <p className="meta">Detonador: {a.trigger}</p>
        </article>
      ))}
    </div>
  )
}
