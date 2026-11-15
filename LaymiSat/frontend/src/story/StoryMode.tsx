import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { api, type Alert, type Level, type Place, type Report, type StoryData, type Zone } from '../api'
import CalendarGP from '../components/CalendarGP'
import { DecisionCard } from '../components/FarmerViews'
import { ALERT_ICONS } from '../components/Icons'
import SectionBoundary from '../components/SectionBoundary'
import { DICTS, fmtNum, type Dict, type Lang } from '../i18n'
import { STORY_TEXT, type StoryDict } from './storyText'
import './story.css'

// El mapa 3D (MapLibre) y el plano (Leaflet) bajan aparte: el panel de Hoy se muestra sin esperarlos.
const StoryMap = lazy(() => import('./StoryMap'))
const MapPicker = lazy(() => import('../components/MapPicker'))

/**
 * Pantalla principal del MVP: el terreno 3D como escenario, con Hoy, Calendario y 40 años.
 * La vista técnica completa sigue en ?modo=tecnico (App.tsx).
 */

const PLANT_ADJUST = -2
const LATE_DAYS = 21 // mismo umbral que la alerta ADS ("más de 3 semanas")
const BASE_TICK_MS = 1400

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function sdayLabel(sday: number, lang: Lang) {
  // sday 0 = 1 de agosto (inicio de campaña en el backend).
  const d = new Date(2001, 7, 1 + Math.round(sday))
  // es-PE abrevia septiembre como "set"; la app usa "sep".
  return d
    .toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short' })
    .replace('.', '')
    .replace(/\bset\b/, 'sep')
}

function initialLang(): Lang {
  try {
    const s = localStorage.getItem('laymisat-lang')
    if (s === 'en' || s === 'es') return s
  } catch {
    /* almacenamiento no disponible */
  }
  return 'es'
}

interface Row {
  campaign: number
  shift: number
  onsetSday: number
  son: number | null
  provisional: boolean
  frostLine: number | null
  aboveTop: boolean
  tmin: number | null
}

const DEFAULT_ZONE = 'pisac-parque-papa'
const RANK: Record<Level, number> = { verde: 0, ambar: 1, rojo: 2 }

function supportsWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export type View = 'hoy' | 'calendario' | 'historia'

/**
 * Pantalla única del MVP sobre el terreno 3D:
 *  - Hoy: qué hago esta campaña (decisión + tres alertas) y dónde suele helar hoy.
 *  - Calendario: la rueda de Guaman Poma frente a los datos.
 *  - 40 años: la historia que explica por qué (línea de tiempo).
 */
export default function StoryMode({ initialView = 'hoy', autoplay = false }: { initialView?: View; autoplay?: boolean }) {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = STORY_TEXT[lang]
  const d = DICTS[lang]
  const [view, setView] = useState<View>(initialView)
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneId, setZoneId] = useState(DEFAULT_ZONE)
  const zone = zones.find((z) => z.id === zoneId)
  const [report, setReport] = useState<Report | null>(null)
  const [story, setStory] = useState<StoryData | null>(null)
  const [error, setError] = useState(false)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [finished, setFinished] = useState(false)
  const [flat, setFlat] = useState(() => !supportsWebGL())
  const pendingAutoplay = useRef(autoplay)

  useEffect(() => {
    document.documentElement.lang = lang
    const section = view === 'historia' ? t.title : view === 'calendario' ? t.tabCalendar : t.todayKicker
    document.title = `LaymiSat · ${section}`
    try {
      localStorage.setItem('laymisat-lang', lang)
    } catch {
      /* almacenamiento no disponible */
    }
  }, [lang, t, view])

  useEffect(() => {
    api.zones().then(setZones).catch(() => setError(true))
  }, [])

  useEffect(() => {
    if (!zone) return
    const place: Place = { lat: zone.lat, lon: zone.lon, altitude: zone.altitude, name: zone.name }
    const ctrl = new AbortController()
    setError(false)
    setReport(null)
    setStory(null)
    Promise.all([api.report(place, PLANT_ADJUST, lang, ctrl.signal), api.story(place, PLANT_ADJUST, ctrl.signal)])
      .then(([r, s]) => {
        setReport(r)
        setStory(s)
      })
      .catch(() => !ctrl.signal.aborted && setError(true))
    return () => ctrl.abort()
  }, [zone, lang])

  const rows = useMemo<Row[]>(() => {
    if (!report || !story) return []
    const lines = new Map(story.campaigns.map((c) => [c.campaign, c]))
    const tmin = new Map(report.annual_temperature.map((y) => [y.year, y.tmin]))
    return report.series
      .filter((s) => s.campaign >= 1984 && s.shift_days !== null && s.onset_sday !== null)
      .map((s) => ({
        campaign: s.campaign,
        shift: s.shift_days as number,
        onsetSday: s.onset_sday as number,
        son: s.son_complete ? s.son_precip : null,
        provisional: s.provisional,
        frostLine: lines.get(s.campaign)?.frost_line ?? null,
        aboveTop: lines.get(s.campaign)?.above_top ?? false,
        tmin: tmin.get(s.campaign) ?? null,
      }))
  }, [report, story])

  // Al cambiar de zona, la historia empieza de nuevo.
  useEffect(() => {
    setIdx(0)
    setFinished(false)
  }, [rows])

  // Demo (?demo=1): la historia arranca sola cuando llegan los datos y termina el vuelo de entrada.
  useEffect(() => {
    if (!pendingAutoplay.current || !rows.length || view !== 'historia') return
    pendingAutoplay.current = false
    const id = window.setTimeout(() => setPlaying(true), reducedMotion() ? 0 : 5600)
    return () => window.clearTimeout(id)
  }, [rows, view])

  // Reproducción.
  useEffect(() => {
    if (!playing || !rows.length) return
    const id = window.setInterval(() => {
      setIdx((i) => {
        if (i + 1 >= rows.length) {
          setPlaying(false)
          setFinished(true)
          return i
        }
        return i + 1
      })
    }, BASE_TICK_MS / speed)
    return () => window.clearInterval(id)
  }, [playing, speed, rows.length])

  const goView = (v: View) => {
    setView(v)
    if (v !== 'historia') {
      setPlaying(false)
      setFinished(false)
    }
  }

  const row = rows[idx]
  const refSday = report?.traditional_sowing.reference_sday ?? 53
  const refLabel = sdayLabel(refSday, lang)
  const altitude = zone?.altitude ?? 0

  // En Hoy y Calendario el mapa muestra dónde suele helar en los últimos años; en 40 años, la campaña elegida.
  const recentLine = story?.recent.frost_line ?? null
  const mapFrostLine = view === 'historia' ? (row?.frostLine ?? null) : recentLine

  const insight = useMemo(() => {
    if (!report) return null
    const ads = report.alerts.find((a) => a.id === 'ADS')?.metrics as Record<string, unknown> | undefined
    const win = (ads?.suggested_window as { from: string; to: string } | null | undefined) ?? null
    const worst = report.alerts.reduce<Level>((w, a) => (RANK[a.level] > RANK[w] ? a.level : w), 'verde')
    return { win, worst }
  }, [report])

  const play = () => {
    if (finished || idx >= rows.length - 1) {
      setIdx(0)
      setFinished(false)
    }
    setPlaying(true)
  }
  const jump = (i: number) => {
    setPlaying(false)
    setFinished(false)
    setIdx(Math.max(0, Math.min(rows.length - 1, i)))
  }

  const tabs: { id: View; label: string }[] = [
    { id: 'hoy', label: t.tabToday },
    { id: 'calendario', label: t.tabCalendar },
    { id: 'historia', label: t.tabStory },
  ]
  const ready = Boolean(report && story)

  return (
    <div className={`story v-${view}`}>
      <header className="story-bar">
        <a className="story-brand" href={window.location.pathname}>
          Laymi<span>Sat</span>
        </a>
        <nav className="story-tabs" aria-label={t.tabsLabel}>
          {tabs.map((tb) => (
            <button key={tb.id} aria-current={view === tb.id ? 'page' : undefined} onClick={() => goView(tb.id)}>
              {tb.label}
            </button>
          ))}
        </nav>
        <label className="story-zone">
          <span>{t.zone}</span>
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {(lang === 'en' ? z.name_en ?? z.name : z.name)} · {fmtNum(z.altitude, lang)} m
              </option>
            ))}
          </select>
        </label>
        <div className="story-lang" role="group" aria-label="Language / Idioma">
          {(['es', 'en'] as const).map((l) => (
            <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="story-main">
        <div className="story-stage">
          {/* Si el mapa no llega a descargarse (mala señal), el aviso queda en su lugar y el panel sigue. */}
          <SectionBoundary message={t.mapError} resetKey={flat}>
            <Suspense fallback={<div className="story-map story-map-loading" aria-hidden="true" />}>
              {flat ? (
                <FlatMap zones={zones} zone={zone} onZone={setZoneId} note={t.flatMap} lang={lang} />
              ) : (
                <StoryMap
                  zone={zone}
                  frostLine={mapFrostLine}
                  playing={playing}
                  level={view === 'historia' ? null : insight?.worst ?? null}
                  t={t}
                  onFail={() => setFlat(true)}
                />
              )}
            </Suspense>
          </SectionBoundary>
          {view === 'historia' && row && report && (
            <SceneCard row={row} t={t} lang={lang} refLabel={refLabel} altitude={altitude} />
          )}
          {view !== 'historia' && story && <TodayScene story={story} altitude={altitude} t={t} lang={lang} />}
          {view === 'historia' && finished && report && story && (
            <Summary
              rows={rows}
              report={report}
              story={story}
              t={t}
              lang={lang}
              onReplay={play}
              onCta={() => goView('hoy')}
            />
          )}
          {!ready && <div className="story-state">{error ? t.error : t.loading}</div>}
        </div>

        <aside className="story-side" aria-live="polite">
          {view === 'hoy' && report && insight && (
            <>
              <DecisionCard alerts={report.alerts} window={insight.win} t={d} />
              <section>
                <h2>{t.alertsTitle}</h2>
                <TodayAlerts alerts={report.alerts} d={d} />
              </section>
              <div className="today-links">
                <button className="btn btn-cta" onClick={() => goView('historia')}>
                  {t.why}
                </button>
                <a className="today-more" href="?modo=tecnico">
                  {t.more}
                </a>
              </div>
              <p className="story-note">{t.sources}</p>
            </>
          )}

          {view === 'calendario' && report && (
            <section className="cal-sheet">
              <div className="kicker">{d.calendarKicker}</div>
              <h2 className="cal-title">{d.calendarTitle}</h2>
              <p className="cal-tip">{t.calendarTip}</p>
              <CalendarGP rows={report.calendar} t={d} lang={lang} />
            </section>
          )}

          {view === 'historia' && (
            <>
              <section>
                <h2>{t.events}</h2>
                <KeyEvents rows={rows} t={t} lang={lang} current={idx} onJump={jump} />
              </section>
              <section className="story-legend">
                <p>
                  <i className="lg-frost" aria-hidden="true" /> {t.legendFrost}
                </p>
                <p>
                  <i className="lg-plot" aria-hidden="true" /> {t.legendPlot}
                </p>
                <p className="story-note">{t.estimate}</p>
                <p className="story-note">{t.sources}</p>
              </section>
            </>
          )}
        </aside>
      </div>

      {view === 'historia' && (
        <footer className="story-timeline">
          <div className="tl-controls">
            <button className="tl-play" onClick={playing ? () => setPlaying(false) : play} aria-pressed={playing}>
              {playing ? (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 4l13 8-13 8z" fill="currentColor" />
                </svg>
              )}
              {playing ? t.pause : t.play}
            </button>
            <button className="tl-ghost" onClick={() => jump(0)}>
              {t.restart}
            </button>
            <div className="tl-speed" role="group" aria-label={t.speed}>
              {[1, 2, 4].map((s) => (
                <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>
            <input
              className="tl-range"
              type="range"
              min={0}
              max={Math.max(0, rows.length - 1)}
              value={idx}
              aria-label={t.year}
              aria-valuetext={row ? String(row.campaign) : ''}
              onChange={(e) => jump(Number(e.target.value))}
            />
            <span className="tl-year">{row ? `${row.campaign}–${row.campaign + 1}` : '—'}</span>
          </div>
          {rows.length > 0 && (
            <div className="tl-charts">
              <BarChart
                title={t.chartRain}
                rows={rows}
                idx={idx}
                onPick={jump}
                value={(r) => r.shift}
                color={(r) => (r.shift > LATE_DAYS ? 'var(--rojo)' : r.shift > 7 ? 'var(--ambar)' : 'var(--verde)')}
              />
              <LineChart
                title={t.chartTmin}
                rows={rows}
                idx={idx}
                onPick={jump}
                value={(r) => r.tmin}
                fmt={(v) => fmtNum(v, lang, 1)}
                stroke="var(--terracotta)"
              />
              <LineChart
                title={t.chartFrost}
                rows={rows}
                idx={idx}
                onPick={jump}
                value={(r) => r.frostLine}
                fmt={(v) => fmtNum(v, lang)}
                stroke="#5b9bd5"
                refLine={zone?.altitude}
              />
            </div>
          )}
        </footer>
      )}
    </div>
  )
}

/** Tarjeta sobre el mapa en Hoy/Calendario: dónde suele helar en los últimos años y si tu chacra queda dentro. */
function TodayScene({ story, altitude, t, lang }: { story: StoryData; altitude: number; t: StoryDict; lang: Lang }) {
  const r = story.recent
  if (r.frost_line === null) return null
  const inside = r.frost_line <= altitude
  return (
    <div className="scene scene-today">
      <span className="scene-kicker">{t.todayKicker}</span>
      <p className="scene-frost">
        {t.recentFrost(String(r.from ?? '—'), String(r.to ?? '—'), fmtNum(r.frost_line, lang))}
      </p>
      <p className={`scene-plot ${inside ? 'is-frost' : 'is-ok'}`}>
        {inside ? t.recentPlotFrost(fmtNum(altitude, lang)) : t.recentPlotOk(fmtNum(altitude, lang))}
      </p>
      <p className="scene-legend">
        <i className="lg-frost" aria-hidden="true" /> {t.legendRecent}
      </p>
    </div>
  )
}

/** Las tres alertas, una por fila: tema, semáforo, veredicto y qué hacer. */
function TodayAlerts({ alerts, d }: { alerts: Alert[]; d: Dict }) {
  return (
    <ul className="today-alerts">
      {alerts.map((a) => {
        const Icon = ALERT_ICONS[a.id]
        return (
          <li key={a.id} className={`today-alert ${a.level}`}>
            <span className="ta-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <div className="ta-body">
              <div className="ta-head">
                <b>{d.alertShort[a.id]}</b>
                <span className={`ta-pill ${a.level}`}>{d.levels[a.level]}</span>
              </div>
              <p className="ta-verdict">{d.alertVerdict[a.id]?.[a.level]}</p>
              <p className="ta-action">
                <span>{d.whatToDo}</span> {a.action}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Respaldo sin WebGL: mapa plano con las zonas piloto. */
function FlatMap({ zones, zone, onZone, note, lang }: {
  zones: Zone[]
  zone: Zone | undefined
  onZone: (id: string) => void
  note: string
  lang: Lang
}) {
  const place: Place = zone
    ? { lat: zone.lat, lon: zone.lon, altitude: zone.altitude, name: zone.name }
    : { lat: -13.4, lon: -71.85, altitude: 3900, name: '' }
  return (
    <div className="story-map story-flat">
      <MapPicker
        key={zone?.id ?? 'none'}
        zones={zones}
        place={place}
        onZone={(z) => onZone(z.id)}
        onPick={() => {}}
        labelOf={(z) => (lang === 'en' ? z.name_en ?? z.name : z.name)}
      />
      <p className="flat-note">{note}</p>
    </div>
  )
}

function SceneCard({ row, t, lang, refLabel, altitude }: {
  row: Row
  t: StoryDict
  lang: Lang
  refLabel: string
  altitude: number
}) {
  const late = row.shift > 7
  const early = row.shift < -7
  const level = row.shift > LATE_DAYS ? 'rojo' : late ? 'ambar' : 'verde'
  const frost =
    row.frostLine === null
      ? t.frostPending
      : row.aboveTop
        ? t.frostNone(fmtNum(row.frostLine, lang))
        : t.frostFrom(fmtNum(row.frostLine, lang))
  const plotFrost = row.frostLine !== null && !row.aboveTop && row.frostLine <= altitude
  return (
    <div className="scene" aria-live="polite">
      <div className="scene-year" key={row.campaign}>
        {row.campaign}–{row.campaign + 1}
        {row.provisional && <span className="scene-tag">{t.inProgress}</span>}
      </div>
      <p className={`scene-rain ${level}`}>
        <b>{t.rainArrived(sdayLabel(row.onsetSday, lang))}</b>
        <span>
          {late
            ? t.rainLate(Math.round(row.shift), refLabel)
            : early
              ? t.rainEarly(Math.round(-row.shift), refLabel)
              : t.rainOnTime(refLabel)}
        </span>
      </p>
      <p className="scene-frost">{frost}</p>
      {row.frostLine !== null && (
        <p className={`scene-plot ${plotFrost ? 'is-frost' : 'is-ok'}`}>
          {plotFrost ? t.plotFrost(fmtNum(altitude, lang)) : t.plotOk(fmtNum(altitude, lang))}
        </p>
      )}
      {row.son !== null && <p className="scene-meta">{t.dryMm(fmtNum(Math.round(row.son), lang))}</p>}
    </div>
  )
}

function KeyEvents({ rows, t, lang, current, onJump }: {
  rows: Row[]
  t: StoryDict
  lang: Lang
  current: number
  onJump: (i: number) => void
}) {
  if (!rows.length) return null
  const complete = rows.filter((r) => !r.provisional)
  const by = (pick: (a: Row, b: Row) => Row, list: Row[]) => list.reduce(pick)
  const latest = by((a, b) => (b.shift > a.shift ? b : a), complete)
  const earliest = by((a, b) => (b.shift < a.shift ? b : a), complete)
  const withSon = complete.filter((r) => r.son !== null)
  const driest = withSon.length ? by((a, b) => ((b.son ?? 0) < (a.son ?? 0) ? b : a), withSon) : null
  const withFrost = complete.filter((r) => r.frostLine !== null)
  const lowFrost = withFrost.length ? by((a, b) => ((b.frostLine ?? 0) < (a.frostLine ?? 0) ? b : a), withFrost) : null
  const last = rows[rows.length - 1]
  const items: { label: string; row: Row; detail: string }[] = [
    { label: t.evLatest, row: latest, detail: sdayLabel(latest.onsetSday, lang) },
    { label: t.evEarliest, row: earliest, detail: sdayLabel(earliest.onsetSday, lang) },
    ...(driest ? [{ label: t.evDriest, row: driest, detail: `${fmtNum(Math.round(driest.son ?? 0), lang)} mm` }] : []),
    ...(lowFrost ? [{ label: t.evLowFrost, row: lowFrost, detail: `${fmtNum(lowFrost.frostLine, lang)} m` }] : []),
    { label: t.evToday, row: last, detail: sdayLabel(last.onsetSday, lang) },
  ]
  return (
    <ol className="events">
      {items.map((it) => {
        const i = rows.indexOf(it.row)
        return (
          <li key={it.label}>
            <button aria-current={i === current} onClick={() => onJump(i)}>
              <span className="ev-year">{it.row.campaign}</span>
              <span className="ev-label">{it.label}</span>
              <span className="ev-detail">{it.detail}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Summary({ rows, report, story, t, lang, onReplay, onCta }: {
  rows: Row[]
  report: Report
  story: StoryData
  t: StoryDict
  lang: Lang
  onReplay: () => void
  onCta: () => void
}) {
  const complete = rows.filter((r) => !r.provisional)
  const lateN = complete.filter((r) => r.shift > LATE_DAYS).length
  const earliest = complete.reduce((a, b) => (b.onsetSday < a.onsetSday ? b : a))
  const latest = complete.reduce((a, b) => (b.onsetSday > a.onsetSday ? b : a))
  const slope = report.tmin_trend.slope_per_decade
  return (
    <div className="summary-card" role="dialog" aria-modal="false" aria-labelledby="story-sum">
      <span className="kicker">{t.summaryKicker}</span>
      <ul id="story-sum">
        <li>{t.sumLate(lateN, complete.length)}</li>
        <li>{t.sumRange(sdayLabel(earliest.onsetSday, lang), sdayLabel(latest.onsetSday, lang))}</li>
        <li>{t.sumTmin(`${slope > 0 ? '+' : ''}${fmtNum(slope, lang, 2)}`)}</li>
        {story.recent.frost_line !== null && <li>{t.sumFrost(fmtNum(story.recent.frost_line, lang))}</li>}
      </ul>
      <p className="summary-conclusion">{t.conclusion}</p>
      <div className="summary-actions">
        <button className="btn btn-cta" onClick={onCta}>
          {t.cta}
        </button>
        <button className="tl-ghost" onClick={onReplay}>
          {t.replay}
        </button>
      </div>
    </div>
  )
}

/* ---------- Mini gráficos sincronizados con la línea de tiempo ---------- */

const W = 320
const H = 74
const PAD = 4

function scaleX(i: number, n: number) {
  return PAD + (i / Math.max(1, n - 1)) * (W - 2 * PAD)
}

function BarChart({ title, rows, idx, onPick, value, color }: {
  title: string
  rows: Row[]
  idx: number
  onPick: (i: number) => void
  value: (r: Row) => number
  color: (r: Row) => string
}) {
  const vals = rows.map(value)
  const max = Math.max(...vals, 1)
  const min = Math.min(...vals, 0)
  const y = (v: number) => PAD + ((max - v) / (max - min)) * (H - 2 * PAD)
  const bw = (W - 2 * PAD) / rows.length
  return (
    <figure className="tl-chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={title}>
        <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} className="tl-zero" />
        {rows.map((r, i) => (
          <rect
            key={r.campaign}
            x={PAD + i * bw + 0.6}
            width={Math.max(1, bw - 1.2)}
            y={Math.min(y(0), y(vals[i]))}
            height={Math.max(1, Math.abs(y(vals[i]) - y(0)))}
            fill={color(r)}
            opacity={i === idx ? 1 : i < idx ? 0.85 : 0.3}
            onClick={() => onPick(i)}
          />
        ))}
        <rect x={PAD + idx * bw} width={bw} y={0} height={H} className="tl-cursor" />
      </svg>
    </figure>
  )
}

function LineChart({ title, rows, idx, onPick, value, fmt, stroke, refLine }: {
  title: string
  rows: Row[]
  idx: number
  onPick: (i: number) => void
  value: (r: Row) => number | null
  fmt: (v: number) => string
  stroke: string
  refLine?: number
}) {
  const pts = rows.map((r, i) => ({ i, v: value(r) })).filter((p): p is { i: number; v: number } => p.v !== null)
  if (pts.length < 2) return null
  const vs = pts.map((p) => p.v).concat(refLine !== undefined ? [refLine] : [])
  const max = Math.max(...vs)
  const min = Math.min(...vs)
  const span = max - min || 1
  const y = (v: number) => PAD + ((max - v) / span) * (H - 2 * PAD)
  const n = rows.length
  const path = pts.map((p, k) => `${k ? 'L' : 'M'}${scaleX(p.i, n).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const cur = pts.find((p) => p.i === idx)
  return (
    <figure className="tl-chart">
      <figcaption>
        {title}
        {cur && <b>{fmt(cur.v)}</b>}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={title}
        onClick={(e) => {
          const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          onPick(Math.round(((e.clientX - box.left) / box.width) * (n - 1)))
        }}
      >
        {refLine !== undefined && <line x1={PAD} x2={W - PAD} y1={y(refLine)} y2={y(refLine)} className="tl-ref" />}
        <path d={path} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.35} />
        <path
          d={pts
            .filter((p) => p.i <= idx)
            .map((p, k) => `${k ? 'L' : 'M'}${scaleX(p.i, n).toFixed(1)},${y(p.v).toFixed(1)}`)
            .join('')}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
        <line x1={scaleX(idx, n)} x2={scaleX(idx, n)} y1={0} y2={H} className="tl-cursor-line" />
      </svg>
    </figure>
  )
}
