import type { CalendarRow } from '../api'
import { fmtNum, type Dict, type Lang } from '../i18n'

export default function CalendarGP({ rows, t, lang }: { rows: CalendarRow[]; t: Dict; lang: Lang }) {
  return (
    <div className="calendar">
      {rows.map((r) => {
        const digits = r.unit === '°C' ? 1 : r.unit === 'mm' || r.unit.startsWith('%') ? 0 : 1
        const shifted = r.status === 'se_desfasa'
        return (
          <article key={r.month} className={`card month ${r.status}`}>
            <span className={`status ${r.status}`}>{t.status[r.status]}</span>
            <div className="m">{r.name}</div>
            <div className="q">{r.quechua}</div>
            {r.source_url && (
              <a className="meta src-link" href={r.source_url} target="_blank" rel="noopener noreferrer">
                {t.calendarSource} {r.page}
              </a>
            )}
            <div className="cal-block">
              <span className="cal-label">{t.calendarWhat}</span>
              <p>{r.milestone}</p>
            </div>
            <div className="cal-block">
              <span className="cal-label">{t.calendarData}</span>
              <p>
                <b>{r.data_sentence}</b>
                {r.data_sentence ? ': ' : ''}
                {r.indicator_label} {fmtNum(r.early, lang, digits)} → {fmtNum(r.recent, lang, digits)}{' '}
                {r.unit}
              </p>
              <p className="meta">
                {r.early_period} → {r.recent_period} · NASA {r.nasa_variables.join(', ')}
              </p>
            </div>
            {r.action && (
              <div className={`cal-block ${shifted ? 'act' : ''}`}>
                <span className="cal-label">{t.calendarAction}</span>
                <p>{r.action}</p>
              </div>
            )}
            {shifted && r.alternative && (
              <div className="cal-block act">
                <span className="cal-label">{t.calendarAlternative}</span>
                <p>{r.alternative}</p>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
