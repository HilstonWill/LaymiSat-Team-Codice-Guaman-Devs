import {
  CRITERIA,
  type Criterion,
  type CropsCatalog,
  type OrganicMatter,
  type Preset,
  type RotationResponse,
  type Slope,
  type SoilInput,
  type Texture,
} from '../api'
import { fmtNum, monthName, type Dict, type Lang } from '../i18n'

interface Props {
  catalog: CropsCatalog
  sequences: Preset[]
  onChange: (seqs: Preset[]) => void
  slope: Slope
  onSlope: (s: Slope) => void
  soil: SoilInput
  onSoil: (s: SoilInput) => void
  priorities: Record<Criterion, number>
  onPriorities: (p: Record<Criterion, number>) => void
  result: RotationResponse | null
  loading: boolean
  t: Dict
  lang: Lang
}

const CAMPAIGN_MONTHS = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7]
const RAINY = new Set([11, 12, 1, 2, 3])

export default function RotationComparator(p: Props) {
  const { catalog, sequences, onChange, result, t, lang } = p
  const cropIds = Object.keys(catalog.crops)
  const byId = Object.fromEntries((result?.results ?? []).map((r) => [r.id, r]))
  const cropName = (id: string) =>
    lang === 'en' ? catalog.crops[id].name_en ?? catalog.crops[id].name : catalog.crops[id].name
  const seqName = (s: Preset) => (lang === 'en' ? s.name_en ?? s.name : s.name)
  const active = CRITERIA.filter((c) => (result?.weights[c] ?? 0) > 0)

  const setCrop = (si: number, yi: number, crop: string) =>
    onChange(sequences.map((s, i) => (i === si ? { ...s, sequence: s.sequence.map((c, j) => (j === yi ? crop : c)) } : s)))

  return (
    <>
      <div className="rot-settings no-print">
        <fieldset className="card">
          <legend>{t.priorities}</legend>
          <p className="meta">{t.prioritiesHelp}</p>
          <div className="prio-grid">
            {CRITERIA.map((c) => (
              <label key={c} className="prio">
                <span>
                  {t.criteria[c]} <b>{fmtNum(p.priorities[c], lang, 1)}</b>
                </span>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.5}
                  value={p.priorities[c]}
                  aria-label={`${t.priorities}: ${t.criteria[c]}`}
                  onChange={(e) => p.onPriorities({ ...p.priorities, [c]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="card">
          <legend>{t.soil}</legend>
          <label className="field">
            {t.texture}
            <select
              value={p.soil.texture}
              onChange={(e) => p.onSoil({ ...p.soil, texture: e.target.value as Texture, declared: true })}
            >
              {(['arenoso', 'franco', 'arcilloso'] as Texture[]).map((x) => (
                <option key={x} value={x}>
                  {t.textures[x]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t.organic}
            <select
              value={p.soil.organic_matter}
              onChange={(e) => p.onSoil({ ...p.soil, organic_matter: e.target.value as OrganicMatter, declared: true })}
            >
              {(['baja', 'media', 'alta'] as OrganicMatter[]).map((x) => (
                <option key={x} value={x}>
                  {t.oms[x]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t.slope}
            <select value={p.slope} onChange={(e) => p.onSlope(e.target.value as Slope)}>
              {(['plana', 'moderada', 'fuerte'] as Slope[]).map((x) => (
                <option key={x} value={x}>
                  {t.slopes[x]}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      </div>

      {result && (
        <p className="meta" style={{ margin: '12px 0' }}>
          {t.context(
            fmtNum(result.context.altitude, lang),
            fmtNum(result.context.frost_probability * 100, lang),
            fmtNum(result.context.dry_spell_probability * 100, lang),
            fmtNum(result.context.season_precip_mean, lang),
          )}
          {p.loading && ` · ${t.computing}`}
        </p>
      )}

      <div className="rot-editor">
        {sequences.map((s, si) => {
          const r = byId[s.id]
          const isBest = result?.best_id === s.id
          return (
            <article key={s.id} className={`card ${isBest ? 'best' : ''}`}>
              <div className="alert-top">
                <h3>{seqName(s)}</h3>
                {isBest && <span className="crown">{t.bestOption}</span>}
              </div>
              <div className="seq">
                {s.sequence.map((c, yi) => (
                  <label key={yi} className="slot">
                    <span className="year-tag">
                      {t.year} {yi + 1}
                    </span>
                    <select
                      aria-label={`${seqName(s)}, ${t.year} ${yi + 1}`}
                      value={c}
                      onChange={(e) => setCrop(si, yi, e.target.value)}
                    >
                      {cropIds.map((id) => (
                        <option key={id} value={id}>
                          {cropName(id)}
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
                    <span className={`pill ${r.level}`}>{t.verdict[r.level]}</span>
                  </div>
                  <div className="bars">
                    {active.map((c) => (
                      <div className="bar-row" key={c}>
                        <span>{t.criteria[c]}</span>
                        <div className="bar" role="img" aria-label={`${t.criteria[c]}: ${r.scores[c]}/100`}>
                          <i className={r.levels[c]} style={{ width: `${r.scores[c]}%` }} />
                        </div>
                        <b>{r.scores[c]}</b>
                      </div>
                    ))}
                  </div>

                  <div className="cover">
                    <span className="cal-label">{t.coverTitle}</span>
                    <div className="cover-grid" role="table" aria-label={t.coverTitle}>
                      <div className="cover-row cover-head" role="row">
                        <span />
                        {CAMPAIGN_MONTHS.map((m) => (
                          <span key={m} className={RAINY.has(m) ? 'rainy' : ''} role="columnheader">
                            {monthName(m, lang).slice(0, 1)}
                          </span>
                        ))}
                      </div>
                      {r.timeline.map((y, yi) => (
                        <div className="cover-row" key={yi} role="row">
                          <span className="cover-name" title={y.name}>
                            {yi + 1}
                          </span>
                          {y.covered.map((c, mi) => (
                            <i
                              key={mi}
                              className={`${c ? 'on' : 'off'} ${RAINY.has(CAMPAIGN_MONTHS[mi]) ? 'rainy' : ''}`}
                              title={`${y.name} · ${monthName(CAMPAIGN_MONTHS[mi], lang)}`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <p className="meta">{t.coverHelp}</p>
                  </div>

                  <details>
                    <summary>{t.why}</summary>
                    <ul>
                      {active.flatMap((c) =>
                        r.reasons[c].map((x, i) => (
                          <li key={`${c}${i}`}>
                            <b>{t.criteria[c]}:</b> {x}
                          </li>
                        )),
                      )}
                    </ul>
                  </details>
                  <details>
                    <summary>{t.risks}</summary>
                    <ul>
                      {r.risks.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </details>
                  <details>
                    <summary>{t.gaps}</summary>
                    <ul>
                      {r.info_gaps.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
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
          {t.weightsLine}{' '}
          {active.map((c) => `${t.criteria[c]} ${fmtNum(result.weights[c] * 100, lang)}%`).join(' · ')}.{' '}
          {result.assumptions.join(' ')}
        </p>
      )}
    </>
  )
}
