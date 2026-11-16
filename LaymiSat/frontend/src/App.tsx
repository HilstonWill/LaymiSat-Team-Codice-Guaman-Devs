import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  DEFAULT_PRIORITIES,
  type Criterion,
  type CropsCatalog,
  type NdviSummary,
  type Place,
  type Preset,
  type Report,
  type RotationResponse,
  type Slope,
  type SoilInput,
  type Level,
  type Zone,
} from './api'
import AlertCards from './components/AlertCards'
import { ALERT_ICONS, ArrowDownIcon, PinIcon, PrintIcon } from './components/Icons'
import CalendarGP from './components/CalendarGP'
import DynamicAlerts from './components/DynamicAlerts'
import { BestRotation, DecisionCard } from './components/FarmerViews'
import CountUp from './components/CountUp'
import CustomPointCard, { type TerrainState } from './components/CustomPointCard'
import MapPicker from './components/MapPicker'
import NdviPanel from './components/NdviPanel'
import PowerCellNote from './components/PowerCellNote'
import RotationComparator from './components/RotationComparator'
import SourcesPanel from './components/SourcesPanel'
import SectionBoundary from './components/SectionBoundary'
import TrendCharts from './components/TrendCharts'
import { DICTS, fmtNum, type Lang } from './i18n'
import { FEATURES } from './features'

const Map3D = lazy(() => import('./components/Map3D'))

function supportsWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
const HAS_WEBGL = typeof document !== 'undefined' && supportsWebGL()
const LEVEL_RANK: Record<Level, number> = { verde: 0, ambar: 1, rojo: 2 }
// Mismos límites que acepta el backend (región Cusco).
const GPS_BOUNDS = { lat: [-15.5, -11.0], lon: [-73.9, -70.3] }
type GpsState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ok'; accuracy: number }
  | { status: 'error'; message: string }

const DEFAULT_PLACE: Place = { lat: -13.4, lon: -71.85, altitude: 3900, name: 'Potato Park (Pisac)' }

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('laymisat-lang-v2')
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    /* almacenamiento no disponible */
  }
  return 'en'
}

/** Agricultor: solo lo necesario para decidir. Técnico: todos los datos (para jueces y extensionistas). */
type Mode = 'farmer' | 'tech'
function initialMode(): Mode {
  const q = new URLSearchParams(window.location.search)
  // main.tsx solo monta App en ?modo=tecnico / ?full=1: aquí siempre es la vista técnica.
  if (q.get('full') === '1' || q.get('modo') === 'tecnico') return 'tech'
  try {
    if (localStorage.getItem('laymisat-mode') === 'tech') return 'tech'
  } catch {
    /* almacenamiento no disponible */
  }
  return 'farmer'
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = DICTS[lang]
  const [mode, setMode] = useState<Mode>(initialMode)
  const isTech = mode === 'tech'
  useEffect(() => {
    try {
      localStorage.setItem('laymisat-mode', mode)
    } catch {
      /* almacenamiento no disponible */
    }
  }, [mode])
  const openFullRotations = () => {
    setMode('tech')
    window.setTimeout(() => document.getElementById('rotaciones')?.scrollIntoView({ behavior: 'smooth' }), 60)
  }
  const [zones, setZones] = useState<Zone[]>([])
  const [catalog, setCatalog] = useState<CropsCatalog | null>(null)
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE)
  const [zoneId, setZoneId] = useState('pisac-parque-papa')
  const [plantAdjust, setPlantAdjust] = useState(-2)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sequences, setSequences] = useState<Preset[]>([])
  const [slope, setSlope] = useState<Slope>('moderada')
  const [soil, setSoil] = useState<SoilInput>({ texture: 'franco', organic_matter: 'media', declared: false })
  const [priorities, setPriorities] = useState<Record<Criterion, number>>(DEFAULT_PRIORITIES)
  const [rot, setRot] = useState<RotationResponse | null>(null)
  const [rotLoading, setRotLoading] = useState(false)
  const [rotError, setRotError] = useState<string | null>(null)
  const [ndvi, setNdvi] = useState<NdviSummary | null>(null)
  const [ndviStatus, setNdviStatus] = useState<'loading' | 'ok' | 'not_pilot' | 'error'>('loading')
  const [terrain, setTerrain] = useState<TerrainState>({ status: 'idle' })
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })
  const dPlace = useDebounced(place, 350)
  const dAdjust = useDebounced(plantAdjust, 350)
  const dSeqs = useDebounced(sequences, 300)
  const dPrio = useDebounced(priorities, 300)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('laymisat-lang-v2', lang)
    } catch {
      /* almacenamiento no disponible */
    }
  }, [lang])

  useEffect(() => {
    api.zones().then(setZones).catch((e: Error) => setError(e.message))
    api
      .crops()
      .then((c) => {
        setCatalog(c)
        setSequences(c.presets.map((p) => ({ ...p, sequence: [...p.sequence] })))
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    api
      .report(dPlace, dAdjust, lang, ctrl.signal)
      .then((r) => setReport(r))
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        setReport(null) // no dejar en pantalla datos de otro lugar
        setError(e.message)
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [dPlace, dAdjust, lang])

  const ndviKey = `${dPlace.lat.toFixed(2)},${dPlace.lon.toFixed(2)}`
  useEffect(() => {
    if (!FEATURES.ndvi) return // panel oculto en el MVP: no pedimos ~23 consultas al ORNL
    const ctrl = new AbortController()
    setNdvi(null)
    setNdviStatus('loading')
    api
      .ndvi(dPlace, ctrl.signal)
      .then((n) => {
        setNdvi(n)
        setNdviStatus('ok')
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        setNdviStatus(/pilot/i.test(e.message) ? 'not_pilot' : 'error')
      })
    return () => ctrl.abort()
  }, [ndviKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dSeqs.length) return
    const ctrl = new AbortController()
    setRotLoading(true)
    setRotError(null)
    api
      .rotations(
        { place: dPlace, plantAdjust: dAdjust, slope, soil, priorities: dPrio, lang, sequences: dSeqs },
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
  }, [dPlace, dAdjust, slope, soil, dPrio, lang, dSeqs])

  const zoneLabel = useCallback((z: Zone) => (lang === 'en' ? z.name_en ?? z.name : z.name), [lang])
  const zone = zones.find((z) => z.id === zoneId)
  const placeName = zone ? zoneLabel(zone) : place.name

  const selectZone = (z: Zone) => {
    setZoneId(z.id)
    setTerrain({ status: 'idle' })
    setGps({ status: 'idle' })
    setPlace({ lat: z.lat, lon: z.lon, altitude: z.altitude, name: z.name })
  }

  const pickPoint = (lat: number, lon: number, accuracy?: number) => {
    setZoneId('custom')
    setGps(accuracy ? { status: 'ok', accuracy } : { status: 'idle' })
    setPlace((p) => ({ lat, lon, altitude: p.altitude, name: `${lat.toFixed(2)}, ${lon.toFixed(2)}` }))
    setTerrain({ status: 'loading' })
    const isCurrent = (p: Place) => p.lat === lat && p.lon === lon
    api
      .terrain(lat, lon)
      .then((tr) => {
        const alt = Math.min(4400, Math.max(3200, Math.round(tr.elevation_m / 50) * 50))
        setPlace((p) => (isCurrent(p) ? { ...p, altitude: alt } : p))
        setSlope(tr.slope_class)
        setTerrain((prev) => (prev.status === 'loading' ? { status: 'ok', data: tr } : prev))
      })
      .catch(() => setTerrain((prev) => (prev.status === 'loading' ? { status: 'error' } : prev)))
  }

  // Mientras llega el análisis del nuevo punto, las cifras viejas se atenúan.
  const stale = loading || dPlace !== place || dAdjust !== plantAdjust
  // GPS del dispositivo: ubica al técnico en la parcela donde está parado.
  const locate = () => {
    if (!('geolocation' in navigator)) {
      setGps({ status: 'error', message: t.gps.unsupported })
      return
    }
    setGps({ status: 'locating' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords
        if (lat < GPS_BOUNDS.lat[0] || lat > GPS_BOUNDS.lat[1] || lon < GPS_BOUNDS.lon[0] || lon > GPS_BOUNDS.lon[1]) {
          setGps({ status: 'error', message: t.gps.outside })
          return
        }
        pickPoint(lat, lon, Math.round(accuracy))
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED ? t.gps.denied : err.code === err.TIMEOUT ? t.gps.timeout : t.gps.unavailable
        setGps({ status: 'error', message })
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    )
  }
  useEffect(() => {
    if (gps.status !== 'error') return
    const id = window.setTimeout(() => setGps({ status: 'idle' }), 6000)
    return () => window.clearTimeout(id)
  }, [gps])

  // Frase de portada con el dato del problema: cuántos días después del calendario llega la lluvia firme.
  const adsShift = report
    ? Number((report.alerts.find((a) => a.id === 'ADS')?.metrics as Record<string, unknown> | undefined)?.recent_mean_shift_days)
    : NaN
  const heroProblem = Number.isFinite(adsShift) && adsShift > 7 ? t.heroProblem(placeName, Math.round(adsShift)) : null

  const worstLevel = report?.alerts.reduce<Level>(
    (w, a) => (LEVEL_RANK[a.level] > LEVEL_RANK[w] ? a.level : w),
    'verde',
  )
  const best = rot?.results.find((r) => r.id === rot.best_id)

  const insight = useMemo(() => {
    if (!report) return null
    const ads = report.alerts.find((a) => a.id === 'ADS')!.metrics as Record<string, unknown>
    const ahs = report.alerts.find((a) => a.id === 'AHS')!.metrics as Record<string, number | null>
    const win = ads.suggested_window as { from: string; to: string } | null
    return { ads, ahs, win }
  }, [report])

  return (
    <>
      <header className="hero">
        <div className="wrap">
          <div className="hero-top">
            <div className="brand">
              <svg width="46" height="46" viewBox="0 0 64 64" aria-hidden="true">
                <path d="M14 46h36L32 16z" fill="#e0a43a" />
                <path d="M24 46v-9a8 8 0 0 1 16 0v9" fill="#16203a" />
                <circle cx="48" cy="14" r="5" fill="#f4e7cf" />
              </svg>
              <h1>
                Laymi<span>Sat</span>
              </h1>
            </div>
            <div className="hero-toggles no-print">
              <div className="lang-toggle mode-toggle" role="group" aria-label={t.mode.label}>
                {/* La vista de agricultor es ahora la pantalla principal (terreno 3D). */}
                <button
                  className={!isTech ? 'on' : ''}
                  aria-pressed={!isTech}
                  onClick={() => window.location.assign(window.location.pathname)}
                >
                  {t.mode.farmer}
                </button>
                <button
                  className={isTech ? 'on' : ''}
                  aria-pressed={isTech}
                  title={t.mode.techHint}
                  onClick={() => setMode('tech')}
                >
                  {t.mode.tech}
                </button>
              </div>
              <div className="lang-toggle" role="group" aria-label="Language / Idioma">
                <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
                  EN
                </button>
                <button className={lang === 'es' ? 'on' : ''} aria-pressed={lang === 'es'} onClick={() => setLang('es')}>
                  ES
                </button>
              </div>
            </div>
          </div>
          <p className="hero-problem">{heroProblem ?? t.heroTagline}</p>
          {isTech && <p className="hero-sub">{heroProblem ? t.heroTagline : t.heroSub}</p>}
          <div className="hero-actions no-print">
            <a className="btn btn-cta" href="#alertas">
              {t.heroCta} <ArrowDownIcon size={18} />
            </a>
            {isTech && (
              <a className="btn btn-story" href="?historia=1">
                {t.storyCta}
              </a>
            )}
            {isTech && <span className="challenge">{t.challenge}</span>}
          </div>
          {isTech && (
            <div className="badges">
              {t.heroBadges.map((b) => (
                <span key={b} className="badge">
                  {b}
                </span>
              ))}
            </div>
          )}
          <p className="print-only" style={{ marginTop: 8 }}>
            {t.printHeader} · {placeName} · {fmtNum(place.altitude, lang)} m · {t.generated}{' '}
            {new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PE')}
          </p>
        </div>
      </header>

      <div className="controls">
        <div className="wrap">
          <label className="field">
            {t.zone}
            <select
              value={zone ? zoneId : 'custom'}
              onChange={(e) => {
                const z = zones.find((x) => x.id === e.target.value)
                if (z) selectZone(z)
              }}
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {zoneLabel(z)} ({z.province})
                </option>
              ))}
              {!zone && <option value="custom">{t.pickedPoint}</option>}
            </select>
          </label>
          {!isTech && (
            <span className="field">
              {t.altitude}
              <strong>{fmtNum(place.altitude, lang)} m</strong>
            </span>
          )}
          {isTech && (
          <label className="field">
            <span>
              {t.altitude}: <strong>{fmtNum(place.altitude, lang)} m</strong>
            </span>
            <input
              type="range"
              min={3200}
              max={4400}
              step={50}
              value={place.altitude}
              onChange={(e) => setPlace({ ...place, altitude: Number(e.target.value) })}
            />
          </label>
          )}
          {isTech && (
          <details className="advanced">
            <summary>{t.heroAdvanced}</summary>
            <label className="field">
              <span>
                {t.plantAdjust}: <strong>{fmtNum(plantAdjust, lang, 1)} °C</strong>
              </span>
              <input
                type="range"
                min={-4}
                max={0}
                step={0.5}
                value={plantAdjust}
                aria-describedby="adj-help"
                onChange={(e) => setPlantAdjust(Number(e.target.value))}
              />
              <span id="adj-help" className="help">{t.plantAdjustHelp}</span>
            </label>
          </details>
          )}
          <span className="spacer" />
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <PrintIcon size={18} /> {t.print}
          </button>
        </div>
        {loading && <div className="loading-bar" />}
      </div>

      <main className="wrap">
        {error && (
          <div className="error">
            {t.loadError}: {error}
          </div>
        )}

        <section className="top stage">
          {HAS_WEBGL ? (
            <Suspense fallback={<div className="map map3d map-loading" aria-hidden="true" />}>
              <Map3D
                zones={zones}
                place={place}
                selectedZoneId={zoneId}
                level={worstLevel}
                onZone={selectZone}
                onPick={pickPoint}
                labelOf={zoneLabel}
                labels={t.map3d}
                hint={t.custom.hint}
                outsideMsg={t.custom.outside}
                onLocate={locate}
                locating={gps.status === 'locating'}
                gpsAccuracy={gps.status === 'ok' ? gps.accuracy : null}
                message={gps.status === 'error' ? gps.message : null}
                placeTag={
                  zone
                    ? undefined
                    : `${t.custom.placeTag}${terrain.status === 'ok' ? ` · ${fmtNum(terrain.data.elevation_m, lang)} m` : ''}`
                }
              />
            </Suspense>
          ) : (
            <MapPicker zones={zones} place={place} onZone={selectZone} onPick={pickPoint} labelOf={zoneLabel} />
          )}
          <div className={`card place-card glass${stale ? ' is-stale' : ''}`} aria-busy={stale}>
            {zone ? (
              <>
                <div className="kicker">
                  <PinIcon size={14} /> {`${t.province} ${zone.province}`}
                </div>
                <h3>{placeName}</h3>
                <p className="meta">{lang === 'en' ? zone.note_en ?? zone.note : zone.note}</p>
              </>
            ) : (
              <CustomPointCard
                lang={lang}
                place={place}
                zones={zones}
                terrain={terrain}
                labelOf={zoneLabel}
                onGoZone={selectZone}
                gpsAccuracy={gps.status === 'ok' ? gps.accuracy : null}
              />
            )}
            <div className="stale-status" role="status">
              {stale && report ? (
                <>
                  <span className="spinner" aria-hidden="true" /> {t.custom.analyzing}
                </>
              ) : null}
            </div>
            {report && insight && !isTech && (
              <>
                <DecisionCard alerts={report.alerts} window={insight.win} t={t} />
                <nav className="summary" aria-label={t.heroSummary}>
                  <div className="summary-row">
                    {report.alerts.map((a) => {
                      const Icon = ALERT_ICONS[a.id]
                      return (
                        <a key={a.id} href={`#alert-${a.id}`} className={`summary-chip ${a.level}`}>
                          <Icon size={18} />
                          <span>{t.alertShort[a.id]}</span>
                          <b>{t.levels[a.level]}</b>
                        </a>
                      )
                    })}
                  </div>
                </nav>
              </>
            )}
            {report && insight && isTech && (
              <>
                <nav className="summary" aria-label={t.heroSummary}>
                  <span className="cal-label">{t.heroSummary}</span>
                  <div className="summary-row">
                    {report.alerts.map((a) => {
                      const Icon = ALERT_ICONS[a.id]
                      return (
                        <a key={a.id} href={`#alert-${a.id}`} className={`summary-chip ${a.level}`}>
                          <Icon size={18} />
                          <span>{t.alertShort[a.id]}</span>
                          <b>{t.levels[a.level]}</b>
                        </a>
                      )
                    })}
                  </div>
                </nav>
                <div className="facts">
                  <div className="fact">
                    <span>{t.factNights}</span>
                    <b>
                      {report.tmin_trend.slope_per_decade > 0 ? '+' : ''}
                      {fmtNum(report.tmin_trend.slope_per_decade, lang, 2)} {t.decade}
                    </b>
                  </div>
                  <div className="fact">
                    <span>{t.heroPlotAltitude}</span>
                    <b>
                      <CountUp value={report.location.altitude} format={(n) => `${fmtNum(Math.round(n), lang)} m`} />
                    </b>
                  </div>
                  <div className="fact">
                    <span>{t.factFrost}</span>
                    <b>
                      <CountUp
                        value={(insight.ahs.event_probability_recent ?? 0) * 100}
                        format={(n) => `${fmtNum(Math.round(n), lang)} %`}
                      />{' '}
                      {t.ofSeasons}
                    </b>
                  </div>
                  <div className="fact">
                    <span>{t.factWindow}</span>
                    <b>{insight.win ? `${insight.win.from} – ${insight.win.to}` : '—'}</b>
                  </div>
                </div>
                <PowerCellNote
                  lang={lang}
                  location={report.location}
                  plantAdjust={report.assumptions.plant_adjust_c}
                  zones={zones}
                  labelOf={zoneLabel}
                />
              </>
            )}
          </div>
        </section>

        {report && (
          <>
            <section aria-labelledby="alertas">
              <div className="section-head">
                <div>
                  <div className="kicker keep">
                    {t.season} {report.data.current_campaign}, {t.dataTo} {report.data.last_date}
                  </div>
                  <h2 id="alertas">{isTech ? t.alertsTitle : t.farmer.alertsTitle}</h2>
                </div>
                {isTech && <p>{t.alertsIntro(fmtNum(report.location.altitude, lang))}</p>}
              </div>
              <SectionBoundary message={t.sectionError} resetKey={report}>
                <AlertCards
                  alerts={report.alerts}
                  simple={!isTech}
                  t={t}
                  lang={lang}
                />
              </SectionBoundary>
              {FEATURES.dynamicAlerts && (
                <SectionBoundary message={t.sectionError} resetKey={dPlace}>
                  <DynamicAlerts place={dPlace} plantAdjust={dAdjust} placeName={placeName} t={t} lang={lang} />
                </SectionBoundary>
              )}
            </section>

            {isTech && (
            <section aria-labelledby="altura-helada">
              <div className="section-head">
                <div>
                  <div className="kicker">{t.altFrost.kicker}</div>
                  <h2 id="altura-helada">{t.altFrost.title}</h2>
                </div>
              </div>
              <SectionBoundary message={t.sectionError} resetKey={report}>
                <TrendCharts report={report} lang={lang} part="altitude" />
              </SectionBoundary>
            </section>
            )}

            {isTech && FEATURES.ndvi && (
              <section aria-labelledby="ndvi">
                <div className="section-head">
                  <div>
                    <div className="kicker">{t.ndviKicker}</div>
                    <h2 id="ndvi">{t.ndviTitle}</h2>
                  </div>
                </div>
                <SectionBoundary message={t.sectionError} resetKey={ndvi}>
                  <NdviPanel ndvi={ndvi} status={ndviStatus} t={t} lang={lang} />
                </SectionBoundary>
              </section>
            )}

            {isTech && FEATURES.calendar && (
              <section aria-labelledby="calendario">
                <div className="section-head">
                  <div>
                    <div className="kicker">{t.calendarKicker}</div>
                    <h2 id="calendario">{t.calendarTitle}</h2>
                  </div>
                  <p>{t.calendarIntro}</p>
                </div>
                <SectionBoundary message={t.sectionError} resetKey={report}>
                  <CalendarGP rows={report.calendar} t={t} lang={lang} />
                </SectionBoundary>
              </section>
            )}
          </>
        )}

        {report && isTech && (
          <section aria-labelledby="tendencias" className="evidence">
            <details>
              <summary>
                <span className="kicker">{t.trendsKicker}</span>
                <span id="tendencias" className="evidence-title">
                  {t.altFrost.evidence}
                </span>
                <span className="evidence-hint">{t.altFrost.evidenceHint}</span>
              </summary>
              <SectionBoundary message={t.sectionError} resetKey={report}>
                <TrendCharts report={report} lang={lang} part="evidence" />
              </SectionBoundary>
            </details>
          </section>
        )}

        {catalog && !isTech && best && (
          <section aria-labelledby="que-sembrar">
            <div className="section-head">
              <div>
                <div className="kicker">{t.rotKicker}</div>
                <h2 id="que-sembrar">{t.farmer.sowTitle}</h2>
              </div>
              <p>{t.farmer.sowIntro}</p>
            </div>
            <BestRotation best={best} t={t} onMore={openFullRotations} />
          </section>
        )}

        {catalog && isTech && (
          <section aria-labelledby="rotaciones">
            <div className="section-head">
              <div>
                <div className="kicker">{t.rotKicker}</div>
                <h2 id="rotaciones">{t.rotTitle}</h2>
              </div>
              <p>
                {t.rotIntro} {best && <b>{t.bestNow(best.name, best.overall)}</b>}
              </p>
            </div>
            {rotError && (
              <div className="error">
                {t.loadError}: {rotError}
              </div>
            )}
            <SectionBoundary message={t.sectionError} resetKey={rot}>
            <RotationComparator
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
              lang={lang}
            />
            </SectionBoundary>
          </section>
        )}

        {report && isTech && (
          <section aria-labelledby="fuentes" className="evidence">
            <details>
              <summary>
                <span className="kicker">{t.sourcesKicker}</span>
                <span id="fuentes" className="evidence-title">
                  {t.sourcesTitle}
                </span>
                <span className="evidence-hint">{t.sourcesHint}</span>
              </summary>
              <SectionBoundary message={t.sectionError} resetKey={report}>
                <SourcesPanel report={report} t={t} lang={lang} />
              </SectionBoundary>
            </details>
          </section>
        )}

        {!report && !error && <div className="state">{t.loading}</div>}
      </main>

      <footer className="wrap">
        <p>{t.footer}</p>
        <p className="ai-note">{t.aiNote}</p>
      </footer>
    </>
  )
}
