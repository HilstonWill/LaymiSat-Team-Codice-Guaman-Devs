import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  DEFAULT_PRIORITIES,
  type Alert,
  type Criterion,
  type CropsCatalog,
  type Level,
  type Place,
  type Preset,
  type Report,
  type RotationResponse,
  type RotationResult,
  type Slope,
  type SoilInput,
  type StoryData,
  type Zone,
} from '../api'
import { campaignLabels, FAMILY } from './rotationUtils'
import RotationPlanner from './RotationPlanner'
import CalendarGP from '../components/CalendarGP'
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
    const s = localStorage.getItem('laymisat-lang-v2')
    if (s === 'en' || s === 'es') return s
  } catch {
    /* almacenamiento no disponible */
  }
  return 'en' // inglés por defecto (revisores); el español queda a un clic en EN | ES
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

/** Espera a que el valor deje de cambiar (p. ej. mientras se arrastra una prioridad) antes de recalcular. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

export type View = 'zonas' | 'hoy' | 'rotaciones' | 'calendario' | 'historia'

/** Lo esencial de un informe para decidir: peor semáforo, la alerta que lo causa y la ventana de siembra. */
function summarize(r: Report) {
  const ads = r.alerts.find((a) => a.id === 'ADS')?.metrics as Record<string, unknown> | undefined
  const win = (ads?.suggested_window as { from: string; to: string } | null | undefined) ?? null
  const worstAlert = r.alerts.reduce((w, a) => (RANK[a.level] > RANK[w.level] ? a : w), r.alerts[0])
  return { win, worst: (worstAlert?.level ?? 'verde') as Level, worstAlert }
}

/**
 * Pantalla única del MVP sobre el terreno 3D:
 *  - Zonas: todas las comunidades piloto con su semáforo (lo que ve quien compra o coordina).
 *  - Hoy: qué hago esta campaña (decisión + tres alertas) y dónde suele helar hoy.
 *  - Calendario: la rueda de Guaman Poma frente a los datos.
 *  - 40 años: la historia que explica por qué (línea de tiempo).
 */
export default function StoryMode({ initialView = 'zonas' }: { initialView?: View }) {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = STORY_TEXT[lang]
  const d = DICTS[lang]
  const [view, setView] = useState<View>(initialView)
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneId, setZoneId] = useState(DEFAULT_ZONE)
  const zone = zones.find((z) => z.id === zoneId)
  const [report, setReport] = useState<Report | null>(null)
  const [story, setStory] = useState<StoryData | null>(null)
  // Informe de cada comunidad para el panel de zonas (llegan en paralelo; cada uno aparece al llegar).
  const [allReports, setAllReports] = useState<Record<string, Report>>({})
  // Comparador de rotaciones (el mismo de la vista técnica): secuencias editables, ladera, suelo y prioridades.
  const [catalog, setCatalog] = useState<CropsCatalog | null>(null)
  const [sequences, setSequences] = useState<Preset[]>([])
  const [slope, setSlope] = useState<Slope>('moderada')
  const [soil, setSoil] = useState<SoilInput>({ texture: 'franco', organic_matter: 'media', declared: false })
  const [priorities, setPriorities] = useState<Record<Criterion, number>>(DEFAULT_PRIORITIES)
  const [rot, setRot] = useState<RotationResponse | null>(null)
  const [rotLoading, setRotLoading] = useState(false)
  const [rotError, setRotError] = useState<string | null>(null)
  const dSeqs = useDebounced(sequences, 300)
  const dPrio = useDebounced(priorities, 300)
  const [error, setError] = useState(false)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [finished, setFinished] = useState(false)
  const [flat, setFlat] = useState(() => !supportsWebGL())
  const firstPlay = useRef(initialView === 'historia')

  useEffect(() => {
    document.documentElement.lang = lang
    const section =
      view === 'historia'
        ? t.title
        : view === 'calendario'
          ? t.tabCalendar
          : view === 'zonas'
            ? t.tabZones
            : view === 'rotaciones'
              ? t.tabRotations
              : t.todayKicker
    document.title = `LaymiSat · ${section}`
    try {
      localStorage.setItem('laymisat-lang-v2', lang)
    } catch {
      /* almacenamiento no disponible */
    }
  }, [lang, t, view])

  useEffect(() => {
    api.zones().then(setZones).catch(() => setError(true))
  }, [])

  useEffect(() => {
    api
      .crops()
      .then((c) => {
        setCatalog(c)
        setSequences(c.presets.map((p) => ({ ...p, sequence: [...p.sequence] })))
      })
      .catch((e: Error) => setRotError(e.message))
  }, [])

  // Se recalcula al cambiar de zona, idioma o cualquier ajuste del comparador.
  useEffect(() => {
    if (!zone || !dSeqs.length) return
    const place: Place = { lat: zone.lat, lon: zone.lon, altitude: zone.altitude, name: zone.name }
    const ctrl = new AbortController()
    setRotLoading(true)
    setRotError(null)
    api
      .rotations(
        { place, plantAdjust: PLANT_ADJUST, slope, soil, priorities: dPrio, lang, sequences: dSeqs },
        ctrl.signal,
      )
      .then((r) => setRot(r))
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        setRot(null)
        setRotError(e.message)
      })
      .finally(() => !ctrl.signal.aborted && setRotLoading(false))
    return () => ctrl.abort()
  }, [zone, lang, slope, soil, dPrio, dSeqs])

  useEffect(() => {
    if (!zones.length) return
    const ctrl = new AbortController()
    setAllReports({})
    zones.forEach((z) => {
      const place: Place = { lat: z.lat, lon: z.lon, altitude: z.altitude, name: z.name }
      api
        .report(place, PLANT_ADJUST, lang, ctrl.signal)
        .then((r) => setAllReports((prev) => ({ ...prev, [z.id]: r })))
        .catch(() => {
          /* una comunidad sin datos no tumba el panel: queda sin semáforo */
        })
    })
    return () => ctrl.abort()
  }, [zones, lang])

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

  // Al entrar en "40 años" (pestaña, botón "¿Por qué?", ?historia=1 o ?demo=1) la historia se reproduce sola,
  // y con ella la órbita lenta de la cámara. Si ya había terminado, vuelve a empezar desde 1984.
  useEffect(() => {
    if (view !== 'historia' || !rows.length) return
    // Si la app abre directo aquí, se espera el vuelo de entrada del mapa (~2,8 s); si no, arranca enseguida.
    const wait = reducedMotion() ? 0 : firstPlay.current ? 3200 : 600
    const id = window.setTimeout(() => {
      firstPlay.current = false
      setIdx((i) => (i >= rows.length - 1 ? 0 : i))
      setFinished(false)
      setPlaying(true)
    }, wait)
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

  const insight = useMemo(() => (report && report.alerts.length ? summarize(report) : null), [report])
  const bestRot = rot?.results.find((r) => r.id === rot.best_id) ?? null

  const zoneName = (z: Zone) => (lang === 'en' ? z.name_en ?? z.name : z.name)
  // Pines del panel de zonas (memo: el mapa solo los rehace cuando cambia un semáforo o el idioma).
  const overview = useMemo(() => {
    if (view !== 'zonas') return null
    return zones.map((z) => {
      const r = allReports[z.id]
      const level = r && r.alerts.length ? summarize(r).worst : null
      const name = lang === 'en' ? z.name_en ?? z.name : z.name
      return { id: z.id, lat: z.lat, lon: z.lon, name, level, label: level ? `${name}: ${d.levels[level]}` : name }
    })
  }, [view, zones, allReports, lang, d])
  const openZone = (id: string) => {
    setZoneId(id)
    goView('hoy')
  }

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
    { id: 'zonas', label: t.tabZones },
    { id: 'hoy', label: t.tabToday },
    { id: 'rotaciones', label: t.tabRotations },
    { id: 'calendario', label: t.tabCalendar },
    { id: 'historia', label: t.tabStory },
  ]
  const ready = view === 'zonas' ? Object.keys(allReports).length > 0 : Boolean(report && story)

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
                  frostLine={view === 'zonas' ? null : mapFrostLine}
                  playing={playing}
                  level={view === 'historia' || view === 'zonas' ? null : insight?.worst ?? null}
                  t={t}
                  onFail={() => setFlat(true)}
                  overview={overview}
                  onZonePick={openZone}
                />
              )}
            </Suspense>
          </SectionBoundary>
          {view === 'historia' && row && report && (
            <SceneCard row={row} t={t} lang={lang} refLabel={refLabel} altitude={altitude} />
          )}
          {(view === 'hoy' || view === 'calendario') && story && (
            <TodayScene story={story} altitude={altitude} t={t} lang={lang} />
          )}
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
          {!ready && (
            <div className="story-state">
              {error ? t.error : view === 'zonas' ? t.zonesLoading : t.loading}
              {error && (
                <div>
                  <button type="button" className="retry-btn" onClick={() => window.location.reload()}>
                    {lang === 'en' ? 'Try again' : 'Reintentar'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="story-side" aria-live="polite">
          {view === 'zonas' && (
            <ZonesPanel zones={zones} reports={allReports} t={t} d={d} lang={lang} nameOf={zoneName} onOpen={openZone} />
          )}

          {view === 'hoy' && report && insight && (
            <>
              <button type="button" className="back-zones" onClick={() => goView('zonas')}>
                {t.allZones}
              </button>
              <div className={`hoy-decision ${insight.worst}`} role="status">
                <span className="hd-kicker">
                  {zone ? `${zoneName(zone)} · ` : ''}
                  {d.farmer.decideKicker}
                </span>
                <strong className="hd-title">{d.farmer.decideTitle[insight.worst]}</strong>
                {insight.win ? (
                  <p className="hd-window">
                    <span>{t.sowBetween}</span>
                    <b>
                      {insight.win.from} – {insight.win.to}
                    </b>
                  </p>
                ) : (
                  <p className="hd-window none">{d.farmer.noWindow}</p>
                )}
                <p className="hd-action">{insight.worstAlert.action}</p>
              </div>
              <section className="today-alerts-sec">
                <h2>{t.alertsTitle}</h2>
                <TodayAlerts alerts={report.alerts} d={d} />
              </section>
              {bestRot && (
                <section className="today-rot">
                  <h2>{d.farmer.sowTitle}</h2>
                  <TodayRotation best={bestRot} t={t} d={d} onMore={() => goView('rotaciones')} />
                </section>
              )}
              <div className="today-links">
                <button className="btn btn-cta" onClick={() => goView('historia')}>
                  {t.why}
                </button>
              </div>
              <p className="story-note">{t.sources}</p>
            </>
          )}

          {view === 'rotaciones' && (
            <section className="rot-sheet" aria-labelledby="rot-title">
              <div className="rot-sheet-inner">
                {rotError && (
                  <div className="error">
                    {d.loadError}: {rotError}
                  </div>
                )}
                {catalog ? (
                  <SectionBoundary message={d.sectionError} resetKey={rot}>
                    <RotationPlanner
                      catalog={catalog}
                      sequences={sequences}
                      onChange={setSequences}
                      slope={slope}
                      onSlope={setSlope}
                      soil={soil}
                      onSoil={setSoil}
                      priorities={priorities}
                      onPriorities={setPriorities}
                      result={rot}
                      loading={rotLoading}
                      t={t}
                      d={d}
                      lang={lang}
                      place={zone ? zoneName(zone) : ''}
                    />
                  </SectionBoundary>
                ) : (
                  !rotError && <p className="rot-loading">{t.rotLoading}</p>
                )}
              </div>
            </section>
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
  // Dos líneas y la leyenda: el detalle (años, método) vive en "40 años".
  return (
    <div className="scene scene-today">
      <p className="scene-frost">
        <i className="lg-frost" aria-hidden="true" /> {t.frostShort(fmtNum(r.frost_line, lang))}
      </p>
      <p className={`scene-plot ${inside ? 'is-frost' : 'is-ok'}`}>
        {inside ? t.plotIn(fmtNum(altitude, lang)) : t.plotOut(fmtNum(altitude, lang))}
      </p>
    </div>
  )
}

/** Las tres alertas: una línea cada una (tema, veredicto, semáforo); "qué hacer" se abre al tocarla. */
function TodayAlerts({ alerts, d }: { alerts: Alert[]; d: Dict }) {
  return (
    <ul className="today-alerts">
      {alerts.map((a) => {
        const Icon = ALERT_ICONS[a.id]
        return (
          <li key={a.id}>
            <details className={`today-alert ${a.level}`}>
              <summary>
                <span className="ta-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="ta-main">
                  <b>{d.alertShort[a.id]}</b>
                  <span className="ta-verdict">{d.alertVerdict[a.id]?.[a.level]}</span>
                </span>
                <span className={`ta-pill ${a.level}`}>{d.levels[a.level]}</span>
                <svg className="ta-chev" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="ta-action">
                <span>{d.whatToDo}</span> {a.action}
              </p>
            </details>
          </li>
        )
      })}
    </ul>
  )
}

/** Mejor rotación en Hoy, pensada para el panel oscuro: campañas reales, color por familia y un solo aviso. */
function TodayRotation({ best, t, d, onMore }: { best: RotationResult; t: StoryDict; d: Dict; onMore: () => void }) {
  const years = campaignLabels(best.sequence.length)
  const risk = best.risks[0]
  return (
    <article className={`trot lv-${best.level}`}>
      <header className="trot-head">
        <div className="trot-name">
          <strong>{best.name}</strong>
          <span>{t.todayRotSub}</span>
        </div>
        <div className="trot-score">
          <b>{best.overall}</b>
          <span>/100</span>
        </div>
      </header>
      <span className={`ta-pill ${best.level}`}>{d.farmer.sowFit[best.level]}</span>
      <ol className="trot-years">
        {best.sequence.map((c, i) => (
          <li key={i} className={`fam-${FAMILY[c] ?? 'grano'}`}>
            <span>{years[i]}</span>
            <b>{best.sequence_names[i]}</b>
          </li>
        ))}
      </ol>
      {risk && (
        <p className="trot-risk">
          <b>{d.farmer.watch}</b> {risk}
        </p>
      )}
      <button type="button" className="trot-cta" onClick={onMore}>
        {t.todayRotCta} →
      </button>
    </article>
  )
}

/** Panel de zonas: cuántas comunidades están en cada semáforo y una tarjeta por comunidad. */
function ZonesPanel({ zones, reports, t, d, lang, nameOf, onOpen }: {
  zones: Zone[]
  reports: Record<string, Report>
  t: StoryDict
  d: Dict
  lang: Lang
  nameOf: (z: Zone) => string
  onOpen: (id: string) => void
}) {
  const items = zones
    .map((z) => {
      const r = reports[z.id]
      return { z, r, s: r && r.alerts.length ? summarize(r) : null }
    })
    // Primero las de mayor riesgo: es lo que hay que atender.
    .sort((a, b) => (b.s ? RANK[b.s.worst] : -1) - (a.s ? RANK[a.s.worst] : -1))
  const counts: Record<Level, number> = { rojo: 0, ambar: 0, verde: 0 }
  items.forEach((it) => it.s && counts[it.s.worst]++)
  return (
    <>
      <div className="zones-head">
        <span className="zones-kicker">{t.zonesKicker}</span>
        <h2 className="zones-title">{t.zonesTitle(zones.length)}</h2>
        <div className="zones-counts">
          {(['rojo', 'ambar', 'verde'] as const).map(
            (l) =>
              counts[l] > 0 && (
                <span key={l} className={`zc ${l}`}>
                  <b>{counts[l]}</b> {d.levels[l]}
                </span>
              ),
          )}
        </div>
        <p className="zones-hint">{t.zonesHint}</p>
      </div>
      <ul className="zone-list">
        {items.map(({ z, r, s }) => (
          <li key={z.id}>
            <button type="button" className={`zone-card${s ? ` ${s.worst}` : ''}`} onClick={() => onOpen(z.id)}>
              <span className="zcard-head">
                <span className="zcard-name">
                  <b>{nameOf(z)}</b>
                  <span>
                    {z.province} · {fmtNum(z.altitude, lang)} m
                  </span>
                </span>
                {s ? <span className={`ta-pill ${s.worst}`}>{d.levels[s.worst]}</span> : <span className="spinner" aria-hidden="true" />}
              </span>
              {r && (
                <span className="zcard-alerts">
                  {r.alerts.map((a) => {
                    const Icon = ALERT_ICONS[a.id]
                    return (
                      <span key={a.id} className={`zdot ${a.level}`} title={`${d.alertShort[a.id]}: ${d.levels[a.level]}`}>
                        <Icon size={14} /> {d.alertShort[a.id]}
                      </span>
                    )
                  })}
                </span>
              )}
              {s && (
                <span className="zcard-foot">
                  <span>
                    {s.win ? (
                      <>
                        {t.zoneSow}: <b>{s.win.from} – {s.win.to}</b>
                      </>
                    ) : (
                      d.farmer.noWindow
                    )}
                  </span>
                  <span className="zcard-cta">{t.zoneOpen} →</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </>
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
      <p className="scene-meta scene-estimate">{t.estimateNote}</p>
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
