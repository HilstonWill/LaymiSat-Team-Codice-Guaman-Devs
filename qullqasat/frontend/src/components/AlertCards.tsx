import type { Alert } from '../api'
import { fmtNum, pValue, type Dict, type Lang } from '../i18n'

export default function AlertCards({ alerts, t, lang }: { alerts: Alert[]; t: Dict; lang: Lang }) {
  return (
    <div className="grid grid-3">
      {alerts.map((a) => {
        const tr = a.trend
        return (
          <article key={a.id} className={`card alert ${a.level}`} aria-label={`${a.question} ${t.levels[a.level]}`}>
            <div className="alert-top">
              <span className="code">{a.id}</span>
              <span className={`pill ${a.level}`}>{t.levels[a.level]}</span>
            </div>
            <h3 className="question">{a.question}</h3>
            <p className="headline">{a.headline}</p>
            <div className="action">
              <b>{t.whatToDo}</b> {a.action}
            </div>
            <details>
              <summary>{t.technical}</summary>
              <p className="meta" style={{ marginTop: 6 }}>
                <b>{a.name}.</b> {t.trigger}: {a.trigger}
              </p>
              <p className="trend-chip" style={{ marginTop: 6 }}>
                {t.trendSince} ({tr.variable}): <b>{tr.direction}</b> · {tr.slope_per_decade > 0 ? '+' : ''}
                {fmtNum(tr.slope_per_decade, lang, 2)} {tr.unit} · {pValue(tr.p_value, lang)}
              </p>
            </details>
          </article>
        )
      })}
    </div>
  )
}
