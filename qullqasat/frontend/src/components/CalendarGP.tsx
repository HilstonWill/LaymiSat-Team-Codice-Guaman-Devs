import { fmt, type CalendarRow } from '../api'

const STATUS_TEXT = { se_desfasa: 'Se desfasa', se_mantiene: 'Se mantiene', informativo: 'Contexto' }

export default function CalendarGP({ rows }: { rows: CalendarRow[] }) {
  return (
    <div className="calendar">
      {rows.map((r) => {
        const digits = r.unit === '°C' ? 1 : r.unit === 'mm' ? 0 : r.unit.startsWith('%') ? 0 : 1
        return (
          <article key={r.month} className={`card month ${r.status}`}>
            <span className={`status ${r.status}`}>{STATUS_TEXT[r.status]}</span>
            <div className="m">{r.name}</div>
            <div className="q">{r.quechua}</div>
            <p className="hito">{r.milestone}</p>
            <div className="val">
              <div className="meta">{r.indicator_label}</div>
              <b>{fmt(r.early, digits)}</b> → <b>{fmt(r.recent, digits)}</b> <span className="meta">{r.unit}</span>
              <div className="meta">
                {r.early_period} → {r.recent_period} · NASA {r.nasa_variables.join(', ')}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
