import type { Alert, Level, RotationResult } from '../api'
import type { Dict } from '../i18n'

/**
 * Vistas del modo agricultor: una decisión clara arriba y la mejor rotación en una línea.
 * Ver docs/ESTILO.md › Modo agricultor.
 */

const RANK: Record<Level, number> = { verde: 0, ambar: 1, rojo: 2 }

/** Tarjeta "¿Qué hago ahora?": color del peor semáforo, una frase de acción y la ventana de siembra. */
export function DecisionCard({ alerts, window: win, t }: {
  alerts: Alert[]
  window: { from: string; to: string } | null
  t: Dict
}) {
  if (!alerts.length) return null
  const worst = alerts.reduce((w, a) => (RANK[a.level] > RANK[w.level] ? a : w), alerts[0])
  return (
    <div className={`decision ${worst.level}`} role="status">
      <span className="decision-kicker">{t.farmer.decideKicker}</span>
      <strong className="decision-title">{t.farmer.decideTitle[worst.level]}</strong>
      <p className="decision-action">{worst.action}</p>
      <p className="decision-window">
        {win ? (
          <>
            {t.farmer.window}: <b>{win.from} – {win.to}</b>
          </>
        ) : (
          t.farmer.noWindow
        )}
      </p>
    </div>
  )
}

/** Mejor rotación en forma de pasos (año 1 → año 2 → …) con un solo aviso. */
export function BestRotation({ best, t, onMore }: { best: RotationResult; t: Dict; onMore: () => void }) {
  const risk = best.risks[0]
  return (
    <article className={`card best-rot ${best.level}`}>
      <div className="best-rot-head">
        <h3>{best.name}</h3>
        <span className={`pill ${best.level}`}>{t.farmer.sowFit[best.level]}</span>
      </div>
      <ol className="rot-steps">
        {best.sequence_names.map((n, i) => (
          <li key={`${n}-${i}`}>
            <span className="rot-year" aria-hidden="true">{i + 1}</span>
            {n}
          </li>
        ))}
      </ol>
      {risk && (
        <p className="meta">
          <b>{t.farmer.watch}</b> {risk}
        </p>
      )}
      <button type="button" className="btn btn-secondary" onClick={onMore}>
        {t.farmer.more}
      </button>
    </article>
  )
}
