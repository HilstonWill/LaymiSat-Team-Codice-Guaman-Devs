import { CRITERIA, fmt, LEVEL_TEXT, type CropsCatalog, type RotationResponse } from '../api'

export interface EditableSeq {
  id: string
  name: string
  sequence: string[]
}

interface Props {
  catalog: CropsCatalog
  sequences: EditableSeq[]
  onChange: (seqs: EditableSeq[]) => void
  slope: string
  onSlope: (s: string) => void
  result: RotationResponse | null
  loading: boolean
}

export default function RotationComparator({ catalog, sequences, onChange, slope, onSlope, result, loading }: Props) {
  const cropIds = Object.keys(catalog.crops)
  const byId = Object.fromEntries((result?.results ?? []).map((r) => [r.id, r]))

  const setCrop = (si: number, yi: number, crop: string) => {
    onChange(sequences.map((s, i) => (i === si ? { ...s, sequence: s.sequence.map((c, j) => (j === yi ? crop : c)) } : s)))
  }

  return (
    <>
      <div className="controls-inline no-print" style={{ display: 'flex', gap: 16, alignItems: 'end', marginBottom: 14, flexWrap: 'wrap' }}>
        <label className="field">
          Pendiente de la parcela
          <select value={slope} onChange={(e) => onSlope(e.target.value)}>
            <option value="plana">Plana / andén</option>
            <option value="moderada">Moderada</option>
            <option value="fuerte">Fuerte (ladera)</option>
          </select>
        </label>
        {result && (
          <p className="meta" style={{ maxWidth: 640 }}>
            Contexto NASA a {fmt(result.context.altitude)} m: helada en brotación en{' '}
            <b>{fmt(result.context.frost_probability * 100)} %</b> de campañas recientes · veranillo ≥10 días en{' '}
            <b>{fmt(result.context.dry_spell_probability * 100)} %</b> · lluvia sep–mar media{' '}
            <b>{fmt(result.context.season_precip_mean)} mm</b>.
          </p>
        )}
        {loading && <span className="meta">Calculando…</span>}
      </div>

      <div className="rot-editor">
        {sequences.map((s, si) => {
          const r = byId[s.id]
          const isBest = result?.best_id === s.id
          return (
            <article key={s.id} className={`card ${isBest ? 'best' : ''}`}>
              <div className="alert-top">
                <h3>{s.name}</h3>
                {isBest && <span className="crown">Mejor opción</span>}
              </div>
              <div className="seq">
                {s.sequence.map((c, yi) => (
                  <label key={yi} className="slot">
                    <span className="year-tag">Año {yi + 1}</span>
                    <select
                      aria-label={`${s.name}, año ${yi + 1}`}
                      value={c}
                      onChange={(e) => setCrop(si, yi, e.target.value)}
                    >
                      {cropIds.map((id) => (
                        <option key={id} value={id}>
                          {catalog.crops[id].name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {r && (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14 }}>
                    <span className="score-big">{r.overall}</span>
                    <span className="meta">/ 100</span>
                    <span className={`pill ${r.level}`}>{LEVEL_TEXT[r.level] === 'Bajo' ? 'Recomendable' : r.level === 'ambar' ? 'Con cuidado' : 'Riesgosa'}</span>
                  </div>
                  <div className="bars">
                    {CRITERIA.map((c) => (
                      <div className="bar-row" key={c.key}>
                        <span>{c.label}</span>
                        <div className="bar" role="img" aria-label={`${c.label}: ${r.scores[c.key]} de 100`}>
                          <i className={r.levels[c.key]} style={{ width: `${r.scores[c.key]}%` }} />
                        </div>
                        <b>{r.scores[c.key]}</b>
                      </div>
                    ))}
                  </div>
                  <details>
                    <summary>¿Por qué este puntaje?</summary>
                    <ul>
                      {CRITERIA.flatMap((c) => r.reasons[c.key].map((t, i) => <li key={`${c.key}${i}`}><b>{c.label}:</b> {t}</li>))}
                    </ul>
                  </details>
                </>
              )}
            </article>
          )
        })}
      </div>
      {result && (
        <p className="meta" style={{ marginTop: 12 }}>
          Pesos: suelo 25 %, plagas 20 %, agua 20 %, helada 20 %, erosión 15 %. {result.assumptions.join(' ')}
        </p>
      )}
    </>
  )
}
