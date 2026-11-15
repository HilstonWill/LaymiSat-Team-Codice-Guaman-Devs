import { useState } from 'react'
import {
  CRITERIA,
  type Criterion,
  type CropsCatalog,
  type OrganicMatter,
  type Preset,
  type RotationResponse,
  type RotationResult,
  type Slope,
  type SoilInput,
  type Texture,
} from '../api'
import { fmtNum, type Dict, type Lang } from '../i18n'
import { campaignLabels, FAMILIES, FAMILY } from './rotationUtils'
import type { StoryDict } from './storyText'

/**
 * Planificador de rotaciones del escenario principal (pestaña "Rotaciones").
 * Flujo guiado en 3 pasos: tu rotación de hoy → tu chacra y lo que te importa → la recomendación.
 * Usa los mismos puntajes del backend que el comparador técnico (RotationComparator), que sigue en ?modo=tecnico.
 */

const DEFAULT_CURRENT = 'acortada'
// Objetivo marcado = peso alto; sin marcar = peso bajo (no cero: sigue contando un poco).
const ON = 2.5
const OFF = 0.5

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
  t: StoryDict
  d: Dict
  lang: Lang
  place: string
}

function YearChips({ seq, names, editable, cropIds, cropName, onCrop, years, yearWord, label }: {
  seq: string[]
  names?: string[]
  editable?: boolean
  cropIds?: string[]
  cropName: (id: string) => string
  onCrop?: (year: number, crop: string) => void
  years: string[]
  yearWord: string
  label: string
}) {
  return (
    <ol className="rp-years" aria-label={label}>
      {seq.map((c, i) => (
        <li key={i} className={`rp-year fam-${FAMILY[c] ?? 'grano'}`}>
          <span className="rp-year-n">{years[i]}</span>
          {editable && cropIds && onCrop ? (
            <select aria-label={`${label}, ${yearWord} ${years[i]}`} value={c} onChange={(e) => onCrop(i, e.target.value)}>
              {cropIds.map((id) => (
                <option key={id} value={id}>
                  {cropName(id)}
                </option>
              ))}
            </select>
          ) : (
            <b>{names?.[i] ?? cropName(c)}</b>
          )}
        </li>
      ))}
    </ol>
  )
}

function Seg<T extends string>({ value, options, onChange, label }: {
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="rp-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function RotationPlanner(p: Props) {
  const { catalog, sequences, result, t, d, lang } = p
  const r = t.rp
  const [currentId, setCurrentId] = useState(DEFAULT_CURRENT)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const cropIds = Object.keys(catalog.crops)
  const years = campaignLabels(Math.max(1, ...sequences.map((s) => s.sequence.length)))
  const cropName = (id: string) =>
    lang === 'en' ? catalog.crops[id]?.name_en ?? catalog.crops[id]?.name ?? id : catalog.crops[id]?.name ?? id
  const seqName = (s: Preset) => (lang === 'en' ? s.name_en ?? s.name : s.name)
  const byId: Record<string, RotationResult> = Object.fromEntries((result?.results ?? []).map((x) => [x.id, x]))
  const active = CRITERIA.filter((c) => (result?.weights[c] ?? 0) > 0)
  const goals = CRITERIA.filter((c) => p.priorities[c] >= 2)

  const current = sequences.find((s) => s.id === currentId) ?? sequences[0]
  const cur = current ? byId[current.id] : undefined
  // Opción a comparar: la que eligió el usuario o, si no, la mejor distinta de la actual.
  const ranked = [...(result?.results ?? [])].sort((a, b) => b.overall - a.overall)
  const bestOther = ranked.find((x) => x.id !== current?.id)
  const target = (pickedId && pickedId !== current?.id ? byId[pickedId] : undefined) ?? bestOther
  const targetSeq = target ? sequences.find((s) => s.id === target.id) : undefined
  const currentIsBest = !!cur && ranked[0]?.id === cur.id
  const keepCurrent = currentIsBest && !pickedId
  // Solo se dice "te recomendamos" cuando la opción mostrada es la mejor; si el usuario eligió otra, es una comparación.
  const isRecommended = !keepCurrent && !!target && target.id === ranked[0]?.id
  const heroKicker = keepCurrent ? r.alreadyBest : isRecommended ? r.recommend : r.comparing
  const targetLabel = keepCurrent ? r.next : isRecommended ? r.option : r.compared
  const diff = cur && target ? target.overall - cur.overall : 0

  const setCrop = (year: number, crop: string) =>
    p.onChange(
      sequences.map((s) => (s.id === current?.id ? { ...s, sequence: s.sequence.map((c, j) => (j === year ? crop : c)) } : s)),
    )
  const toggleGoal = (c: Criterion) => {
    const next = { ...p.priorities }
    next[c] = goals.includes(c) ? OFF : ON
    // Siempre queda al menos un objetivo marcado.
    if (CRITERIA.every((k) => next[k] < 2)) return
    p.onPriorities(next)
  }

  const deltas = cur && target ? active.map((c) => ({ c, d: target.scores[c] - cur.scores[c] })) : []
  const gains = deltas.filter((x) => x.d > 0).sort((a, b) => b.d - a.d)
  const losses = deltas.filter((x) => x.d < 0).sort((a, b) => a.d - b.d)
  // Cada motivo va con su objetivo y con el dato de tu rotación: "mejor" es siempre relativo a lo que haces hoy.
  const why =
    target && cur
      ? gains
          .slice(0, 2)
          .map(({ c, d: dd }) => ({ c, dd, after: target.reasons?.[c]?.[0], before: cur.reasons?.[c]?.[0] }))
          .filter((x) => x.after)
      : []

  const shareText =
    cur && target && current && targetSeq
      ? [
          r.shareHead(p.place),
          `${r.shareNow}: ${seqName(current)} · ${cur.overall}/100`,
          `${r.shareTo}: ${seqName(targetSeq)} · ${target.overall}/100 (${diff >= 0 ? '+' : ''}${diff})`,
          target.sequence_names.map((n, i) => `${years[i]}: ${n}`).join(' → '),
          gains.length ? `${r.shareGains}: ${gains.slice(0, 3).map((g) => `${r.goals[g.c]} +${g.d}`).join(', ')}` : '',
          r.shareFoot,
        ]
          .filter(Boolean)
          .join('\n')
      : ''
  const copy = () => {
    navigator.clipboard
      ?.writeText(shareText)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        /* sin portapapeles: queda el botón de WhatsApp */
      })
  }

  return (
    <div className="rp" aria-busy={p.loading}>
      <header className="rp-head">
        <span className="rp-kicker">{r.kicker(p.place)}</span>
        <h2 id="rot-title" className="rp-title">
          {r.title}
        </h2>
        <p className="rp-sub">{r.sub}</p>
      </header>

      <div className="rp-grid">
        <div className="rp-inputs">
          {/* Paso 1: la rotación de hoy */}
          <section className="rp-step">
            <h3 className="rp-step-title">
              <span className="rp-num">1</span> {r.step1}
            </h3>
            <div className="rp-options" role="radiogroup" aria-label={r.step1}>
              {sequences.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === current?.id}
                  className="rp-option"
                  onClick={() => {
                    setCurrentId(s.id)
                    setPickedId(null)
                  }}
                >
                  <b>{seqName(s)}</b>
                  <span className="rp-mini" aria-hidden="true">
                    {s.sequence.map((c, i) => (
                      <i key={i} className={`fam-${FAMILY[c] ?? 'grano'}`} title={cropName(c)} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
            {current && (
              <>
                <p className="rp-hint">{r.editHint}</p>
                <YearChips
                  seq={current.sequence}
                  editable
                  cropIds={cropIds}
                  cropName={cropName}
                  onCrop={setCrop}
                  years={years}
                  yearWord={r.campaign}
                  label={seqName(current)}
                />
              </>
            )}
          </section>

          {/* Paso 2: la chacra y lo que importa */}
          <section className="rp-step">
            <h3 className="rp-step-title">
              <span className="rp-num">2</span> {r.step2}
            </h3>
            <div className="rp-field">
              <span className="rp-label">{d.slope}</span>
              <Seg
                label={d.slope}
                value={p.slope}
                onChange={p.onSlope}
                options={(['plana', 'moderada', 'fuerte'] as Slope[]).map((v) => ({ v, label: d.slopes[v] }))}
              />
            </div>
            <div className="rp-field">
              <span className="rp-label">{d.texture}</span>
              <Seg
                label={d.texture}
                value={p.soil.texture}
                onChange={(v) => p.onSoil({ ...p.soil, texture: v, declared: true })}
                options={(['arenoso', 'franco', 'arcilloso'] as Texture[]).map((v) => ({ v, label: d.textures[v] }))}
              />
            </div>
            <div className="rp-field">
              <span className="rp-label">{r.goalsLabel}</span>
              <div className="rp-goals">
                {CRITERIA.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="rp-goal"
                    aria-pressed={goals.includes(c)}
                    onClick={() => toggleGoal(c)}
                  >
                    {r.goals[c]}
                  </button>
                ))}
              </div>
            </div>
            <details className="rp-advanced">
              <summary>{r.advanced}</summary>
              <label className="rp-adv-row">
                <span>{d.organic}</span>
                <select
                  value={p.soil.organic_matter}
                  onChange={(e) => p.onSoil({ ...p.soil, organic_matter: e.target.value as OrganicMatter, declared: true })}
                >
                  {(['baja', 'media', 'alta'] as OrganicMatter[]).map((x) => (
                    <option key={x} value={x}>
                      {d.oms[x]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="rp-hint">{d.prioritiesHelp}</p>
              {CRITERIA.map((c) => (
                <label key={c} className="rp-adv-row">
                  <span>
                    {r.goals[c]} <b>{fmtNum(p.priorities[c], lang, 1)}</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.5}
                    value={p.priorities[c]}
                    onChange={(e) => p.onPriorities({ ...p.priorities, [c]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </details>
          </section>
        </div>

        {/* Paso 3: la recomendación */}
        <section className="rp-step rp-result" aria-live="polite">
          <h3 className="rp-step-title">
            <span className="rp-num">3</span> {r.step3}
            {p.loading && <span className="rp-busy">{r.computing}</span>}
          </h3>

          {!cur || !target || !current || !targetSeq ? (
            <div className="rp-skeleton" aria-hidden="true" />
          ) : (
            <>
              <div className={`rp-hero ${diff > 0 && !keepCurrent ? 'up' : 'same'}`}>
                <div className="rp-hero-text">
                  <span className="rp-hero-kicker">{heroKicker}</span>
                  <strong>{keepCurrent ? seqName(current) : seqName(targetSeq)}</strong>
                  {diff > 0 && !keepCurrent && <span className="rp-hero-gain">{r.gain(diff)}</span>}
                </div>
                <div className="rp-scores">
                  <div className="rp-score is-cur">
                    <span>{r.yours}</span>
                    <b>{cur.overall}</b>
                  </div>
                  <span className="rp-arrow" aria-hidden="true">
                    →
                  </span>
                  <div className={`rp-score is-new lv-${target.level}`}>
                    <span>{targetLabel}</span>
                    <b>{target.overall}</b>
                  </div>
                </div>
              </div>

              <div className="rp-compare">
                <div className="rp-legend">
                  <span className="is-cur">{seqName(current)}</span>
                  <span className="is-new">{seqName(targetSeq)}</span>
                </div>
                {active.map((c) => {
                  const a = cur.scores[c]
                  const b = target.scores[c]
                  return (
                    <div key={c} className="rp-row">
                      <span className="rp-row-label">{r.goals[c]}</span>
                      <div className="rp-bars" role="img" aria-label={`${r.goals[c]}: ${a} → ${b}`}>
                        <i className="is-cur" style={{ width: `${a}%` }} />
                        <i className={`is-new lv-${target.levels[c]}`} style={{ width: `${b}%` }} />
                      </div>
                      <b className={b > a ? 'up' : b < a ? 'down' : ''}>
                        {b > a ? '+' : ''}
                        {b - a}
                      </b>
                    </div>
                  )
                })}
              </div>

              <div className="rp-plan">
                <span className="rp-label">{r.yearByYear}</span>
                <span className="rp-plan-tag">{r.yours}</span>
                <YearChips
                  seq={current.sequence}
                  cropName={cropName}
                  years={years}
                  yearWord={r.campaign}
                  label={seqName(current)}
                />
                <span className="rp-plan-tag is-new">{targetLabel}</span>
                <YearChips
                  seq={target.sequence}
                  names={target.sequence_names}
                  cropName={cropName}
                  years={years}
                  yearWord={r.campaign}
                  label={seqName(targetSeq)}
                />
                <ul className="rp-fams" aria-hidden="true">
                  {FAMILIES.map((f) => (
                    <li key={f} className={`fam-${f}`}>
                      {d.families[f]}
                    </li>
                  ))}
                </ul>
              </div>

              {(why.length > 0 || losses.length > 0 || target.risks.length > 0) && (
                <div className="rp-notes">
                  {why.length > 0 && (
                    <div className="rp-note good">
                      <b>{r.whyBetter}</b>
                      <ul>
                        {why.map((x) => (
                          <li key={x.c}>
                            <strong>
                              {r.goals[x.c]} +{x.dd}:
                            </strong>{' '}
                            {x.after}
                            {x.before && x.before !== x.after && (
                              <span className="rp-before">
                                {r.yoursWas}: {x.before}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(losses.length > 0 || target.risks.length > 0) && (
                    <div className="rp-note warn">
                      <b>{r.watch}</b>
                      <ul>
                        {losses.slice(0, 2).map(({ c, d: dd }) => (
                          <li key={c}>{r.loses(r.goals[c], dd)}</li>
                        ))}
                        {target.risks.slice(0, 1).map((x, i) => (
                          <li key={`r${i}`}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="rp-ranking">
                <span className="rp-label">{r.allOptions}</span>
                <ol>
                  {ranked.map((x) => {
                    const s = sequences.find((q) => q.id === x.id)
                    if (!s) return null
                    const isCur = x.id === current.id
                    const isTarget = x.id === target.id
                    return (
                      <li key={x.id}>
                        <button
                          type="button"
                          className={`rp-rank${isTarget ? ' is-target' : ''}`}
                          disabled={isCur}
                          aria-pressed={isTarget}
                          onClick={() => setPickedId(x.id)}
                        >
                          <span className="rp-rank-name">
                            {seqName(s)}
                            {isCur && <em>{r.yoursTag}</em>}
                            {x.id === result?.best_id && <em className="best">{r.bestTag}</em>}
                          </span>
                          <span className="rp-rank-bar">
                            <i className={`lv-${x.level}`} style={{ width: `${x.overall}%` }} />
                          </span>
                          <b>{x.overall}</b>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>

              <div className="rp-actions">
                <a
                  className="rp-btn rp-wa"
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {r.shareWa}
                </a>
                <button type="button" className="rp-btn rp-ghost" onClick={copy}>
                  {copied ? r.copied : r.copy}
                </button>
              </div>
              <p className="rp-disclaimer">{d.rotDisclaimer}</p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
