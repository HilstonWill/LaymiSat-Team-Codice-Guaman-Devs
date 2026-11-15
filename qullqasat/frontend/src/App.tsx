import { useEffect, useMemo, useState } from 'react'
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
  type Zone,
} from './api'
import AlertCards from './components/AlertCards'
import CalendarGP from './components/CalendarGP'
import MapPicker from './components/MapPicker'
import NdviPanel from './components/NdviPanel'
import RotationComparator from './components/RotationComparator'
import SourcesPanel from './components/SourcesPanel'
import TrendCharts from './components/TrendCharts'
import { DICTS, fmtNum, type Lang } from './i18n'

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
    const saved = localStorage.getItem('laymisat-lang')
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    /* almacenamiento no disponible */
  }
  return 'en'
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = DICTS[lang]
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
  const [srtmNote, setSrtmNote] = useState<string | null>(null)

  const dPlace = useDebounced(place, 350)
  const dAdjust = useDebounced(plantAdjust, 350)
  const dSeqs = useDebounced(sequences, 300)
  const dPrio = useDebounced(priorities, 300)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('laymisat-lang', lang)
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

  const zoneLabel = (z: Zone) => (lang === 'en' ? z.name_en ?? z.name : z.name)
  const zone = zones.find((z) => z.id === zoneId)
  const placeName = zone ? zoneLabel(zone) : place.name

  const selectZone = (z: Zone) => {
    setZoneId(z.id)
    setSrtmNote(null)
    setPlace({ lat: z.lat, lon: z.lon, altitude: z.altitude, name: z.name })
  }

  const pickPoint = (lat: number, lon: number) => {
    setZoneId('custom')
    setPlace((p) => ({ lat, lon, altitude: p.altitude, name: `${lat.toFixed(2)}, ${lon.toFixed(2)}` }))
    setSrtmNote(null)
    api
      .terrain(lat, lon)
      .then((tr) => {
        const alt = Math.min(4400, Math.max(3200, Math.round(tr.elevation_m / 50) * 50))
        setPlace((p) => (p.lat === lat && p.lon === lon ? { ...p, altitude: alt } : p))
        setSlope(tr.slope_class)
        setSrtmNote(`${fmtNum(tr.elevation_m, lang)} m · ${fmtNum(tr.slope_deg, lang, 1)}°`)
      })
      .catch(() => setSrtmNote(null))
  }

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
            <div className="lang-toggle no-print" role="group" aria-label="Language / Idioma">
              <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
                EN
              </button>
              <button className={lang === 'es' ? 'on' : ''} aria-pressed={lang === 'es'} onClick={() => setLang('es')}>
                ES
              </button>
            </div>
          </div>
          <p className="tagline">{t.tagline}</p>
          <p className="challenge">{t.challenge}</p>
          <div className="badges">
            {t.badges.map((b) => (
              <span key={b} className="badge">
                {b}
              </span>
            ))}
          </div>
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
          <label className="field" title={t.plantAdjustHelp}>
            <span>
              {t.plantAdjust}: <strong>{fmtNum(plantAdjust, lang, 1)} °C</strong>
            </span>
            <input
              type="range"
              min={-4}
              max={0}
              step={0.5}
              value={plantAdjust}
              onChange={(e) => setPlantAdjust(Number(e.target.value))}
            />
          </label>
          <span className="spacer" />
          <button className="btn" onClick={() => window.print()}>
            {t.print}
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

        <section className="top">
          <MapPicker zones={zones} place={place} onZone={selectZone} onPick={pickPoint} labelOf={zoneLabel} />
          <div className="card place-card">
            <div className="kicker">{zone ? `${t.province} ${zone.province}` : t.customPoint}</div>
            <h3>{placeName}</h3>
            <p className="meta">{zone ? (lang === 'en' ? zone.note_en ?? zone.note : zone.note) : t.clickMap}</p>
            {srtmNote && (
              <p className="meta srtm">
                {t.srtmTaken}: {srtmNote}
              </p>
            )}
            {report && insight && (
              <>
                <div className="facts">
                  <div className="fact">
                    <span>{t.factNights}</span>
                    <b>
                      {report.tmin_trend.slope_per_decade > 0 ? '+' : ''}
                      {fmtNum(report.tmin_trend.slope_per_decade, lang, 2)} {t.decade}
                    </b>
                  </div>
                  <div className="fact">
                    <span>{t.factVariability}</span>
                    <b>
                      ±{fmtNum(insight.ads.onset_std_early_days as number, lang)} → ±
                      {fmtNum(insight.ads.onset_std_recent_days as number, lang)} {t.days}
                    </b>
                  </div>
                  <div className="fact">
                    <span>{t.factFrost}</span>
                    <b>
                      {fmtNum((insight.ahs.event_probability_recent ?? 0) * 100, lang)} % {t.ofSeasons}
                    </b>
                  </div>
                  <div className="fact">
                    <span>{t.factWindow}</span>
                    <b>{insight.win ? `${insight.win.from} – ${insight.win.to}` : '—'}</b>
                  </div>
                </div>
                <p className="insight">
                  {t.insight(String(insight.ads.mean_onset_recent ?? '—'), insight.win?.from, insight.win?.to)}
                </p>
              </>
            )}
          </div>
        </section>

        {report && (
          <>
            <section aria-labelledby="alertas">
              <div className="section-head">
                <div>
                  <div className="kicker">
                    {t.season} {report.data.current_campaign} · {t.dataTo} {report.data.last_date}
                  </div>
                  <h2 id="alertas">{t.alertsTitle}</h2>
                </div>
                <p>{t.alertsIntro(fmtNum(report.location.altitude, lang))}</p>
              </div>
              <AlertCards alerts={report.alerts} t={t} lang={lang} />
            </section>

            <section aria-labelledby="tendencias">
              <div className="section-head">
                <div>
                  <div className="kicker">{t.trendsKicker}</div>
                  <h2 id="tendencias">{t.trendsTitle}</h2>
                </div>
              </div>
              <TrendCharts report={report} lang={lang} />
            </section>

            <section aria-labelledby="ndvi">
              <div className="section-head">
                <div>
                  <div className="kicker">{t.ndviKicker}</div>
                  <h2 id="ndvi">{t.ndviTitle}</h2>
                </div>
              </div>
              <NdviPanel ndvi={ndvi} status={ndviStatus} t={t} lang={lang} />
            </section>

            <section aria-labelledby="calendario">
              <div className="section-head">
                <div>
                  <div className="kicker">{t.calendarKicker}</div>
                  <h2 id="calendario">{t.calendarTitle}</h2>
                </div>
                <p>{t.calendarIntro}</p>
              </div>
              <CalendarGP rows={report.calendar} t={t} lang={lang} />
            </section>
          </>
        )}

        {catalog && (
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
          </section>
        )}

        {report && (
          <section aria-labelledby="fuentes">
            <div className="section-head">
              <div>
                <div className="kicker">{t.sourcesKicker}</div>
                <h2 id="fuentes">{t.sourcesTitle}</h2>
              </div>
            </div>
            <SourcesPanel report={report} t={t} lang={lang} />
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
