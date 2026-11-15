import { useEffect, useMemo, useState } from 'react'
import { api, fmt, LEVEL_TEXT, type CropsCatalog, type Place, type Report, type RotationResponse, type Zone } from './api'
import AlertCards from './components/AlertCards'
import CalendarGP from './components/CalendarGP'
import MapPicker from './components/MapPicker'
import RotationComparator, { type EditableSeq } from './components/RotationComparator'
import SourcesPanel from './components/SourcesPanel'
import TrendCharts from './components/TrendCharts'

const DEFAULT_PLACE: Place = { lat: -13.4, lon: -71.85, altitude: 3900, name: 'Parque de la Papa (Pisac)' }

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function App() {
  const [zones, setZones] = useState<Zone[]>([])
  const [catalog, setCatalog] = useState<CropsCatalog | null>(null)
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE)
  const [zoneId, setZoneId] = useState('pisac-parque-papa')
  const [plantAdjust, setPlantAdjust] = useState(-2)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sequences, setSequences] = useState<EditableSeq[]>([])
  const [slope, setSlope] = useState('moderada')
  const [rot, setRot] = useState<RotationResponse | null>(null)
  const [rotLoading, setRotLoading] = useState(false)
  const [rotError, setRotError] = useState<string | null>(null)

  const dPlace = useDebounced(place, 350)
  const dAdjust = useDebounced(plantAdjust, 350)
  const dSeqs = useDebounced(sequences, 300)

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
      .report(dPlace, dAdjust, ctrl.signal)
      .then((r) => setReport(r))
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        setReport(null) // no dejar en pantalla datos de otro lugar
        setError(e.message)
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [dPlace, dAdjust])

  useEffect(() => {
    if (!dSeqs.length) return
    const ctrl = new AbortController()
    setRotLoading(true)
    setRotError(null)
    api
      .rotations(dPlace, dAdjust, slope, dSeqs, ctrl.signal)
      .then((r) => setRot(r))
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        setRot(null)
        setRotError(e.message)
      })
      .finally(() => !ctrl.signal.aborted && setRotLoading(false))
    return () => ctrl.abort()
  }, [dPlace, dAdjust, slope, dSeqs])

  const selectZone = (z: Zone) => {
    setZoneId(z.id)
    setPlace({ lat: z.lat, lon: z.lon, altitude: z.altitude, name: z.name })
  }

  const zone = zones.find((z) => z.id === zoneId)
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
          <p className="tagline">
            Alerta agroclimática para la papa nativa de Cusco: 40 años de datos de la NASA leídos junto al calendario
            agrícola de Felipe Guaman Poma de Ayala (1615).
          </p>
          <div className="badges">
            <span className="badge">NASA POWER · diario 1984–hoy</span>
            <span className="badge">Mann-Kendall + pendiente de Sen</span>
            <span className="badge">3.200–4.200 m s. n. m.</span>
            <span className="badge">Código abierto</span>
          </div>
          <p className="print-only" style={{ marginTop: 8 }}>
            Ficha comunitaria · {place.name} · {fmt(place.altitude)} m · generada el {new Date().toLocaleDateString('es-PE')}
          </p>
        </div>
      </header>

      <div className="controls">
        <div className="wrap">
          <label className="field">
            Zona piloto
            <select
              value={zone ? zoneId : 'custom'}
              onChange={(e) => {
                const z = zones.find((x) => x.id === e.target.value)
                if (z) selectZone(z)
              }}
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.province})
                </option>
              ))}
              {!zone && <option value="custom">Punto elegido en el mapa</option>}
            </select>
          </label>
          <label className="field">
            <span>
              Altitud de la parcela: <strong>{fmt(place.altitude)} m</strong>
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
          <label className="field" title="Diferencia entre la temperatura del aire a 2 m y la de la planta en noches despejadas">
            <span>
              Ajuste de helada a nivel de planta: <strong>{fmt(plantAdjust, 1)} °C</strong>
            </span>
            <input type="range" min={-4} max={0} step={0.5} value={plantAdjust} onChange={(e) => setPlantAdjust(Number(e.target.value))} />
          </label>
          <span className="spacer" />
          <button className="btn" onClick={() => window.print()}>
            Imprimir ficha
          </button>
        </div>
        {loading && <div className="loading-bar" />}
      </div>

      <main className="wrap">
        {error && <div className="error">No se pudo cargar: {error}</div>}

        <section className="top">
          <MapPicker
            zones={zones}
            place={place}
            onZone={selectZone}
            onPick={(lat, lon) => {
              setZoneId('custom')
              setPlace({ lat, lon, altitude: place.altitude, name: `Punto ${lat.toFixed(2)}, ${lon.toFixed(2)}` })
            }}
          />
          <div className="card place-card">
            <div className="kicker">{zone ? `Provincia de ${zone.province}` : 'Punto personalizado'}</div>
            <h3>{place.name}</h3>
            <p className="meta">{zone?.note ?? 'Haz clic en el mapa (dentro de Cusco) para analizar otro punto.'}</p>
            {report && insight && (
              <>
                <div className="facts">
                  <div className="fact">
                    <span>Noches (Tmin media anual)</span>
                    <b>
                      {report.tmin_trend.slope_per_decade > 0 ? '+' : ''}
                      {fmt(report.tmin_trend.slope_per_decade, 2)} °C/década
                    </b>
                  </div>
                  <div className="fact">
                    <span>Variabilidad del inicio de lluvias</span>
                    <b>
                      ±{fmt(insight.ads.onset_std_early_days as number)} → ±{fmt(insight.ads.onset_std_recent_days as number)} días
                    </b>
                  </div>
                  <div className="fact">
                    <span>Helada en brotación (últimas 15 campañas)</span>
                    <b>{fmt((insight.ahs.event_probability_recent ?? 0) * 100)} % de campañas</b>
                  </div>
                  <div className="fact">
                    <span>Ventana de siembra observada</span>
                    <b>{insight.win ? `${insight.win.from} – ${insight.win.to}` : '—'}</b>
                  </div>
                </div>
                <p className="insight">
                  Guaman Poma situaba la siembra general en <b>Coya Raymi (16–30 sep)</b>. En las últimas campañas las
                  lluvias firmes llegaron en promedio el <b>{String(insight.ads.mean_onset_recent ?? '—')}</b>
                  {insight.win && (
                    <>
                      , en una ventana que va del <b>{insight.win.from}</b> al <b>{insight.win.to}</b>
                    </>
                  )}
                  : sembrar por una fecha fija ya no basta.
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
                    Campaña {report.data.current_campaign} · datos al {report.data.last_date}
                  </div>
                  <h2 id="alertas">Las 3 alertas para esta parcela</h2>
                </div>
                <p>
                  Semáforo calculado con NASA POWER corregido a {fmt(report.location.altitude)} m. Cada alerta muestra el
                  dato que la dispara y su tendencia desde 1984.
                </p>
              </div>
              <AlertCards alerts={report.alerts} />
            </section>

            <section aria-labelledby="tendencias">
              <div className="section-head">
                <div>
                  <div className="kicker">Detective de tendencias</div>
                  <h2 id="tendencias">40 años de clima en la chacra</h2>
                </div>
              </div>
              <TrendCharts report={report} />
            </section>

            <section aria-labelledby="calendario">
              <div className="section-head">
                <div>
                  <div className="kicker">Nueva corónica y buen gobierno · 1615</div>
                  <h2 id="calendario">El calendario de Guaman Poma frente a los datos</h2>
                </div>
                <p>
                  Para cada mes, el criterio del códice se mide con NASA POWER: primeras 15 campañas frente a las últimas
                  15. «Se desfasa» indica un cambio de 15 % o más en la dirección desfavorable.
                </p>
              </div>
              <CalendarGP rows={report.calendar} />
            </section>
          </>
        )}

        {catalog && (
          <section aria-labelledby="rotaciones">
            <div className="section-head">
              <div>
                <div className="kicker">Field Shift · rotación de cultivos</div>
                <h2 id="rotaciones">Compara rotaciones antes de decidir</h2>
              </div>
              <p>
                Edita cada año y mira cómo cambian suelo, plagas, agua, helada y erosión con el clima real de esta
                parcela.{' '}
                {best && (
                  <>
                    Hoy la mejor opción es <b>{best.name}</b> ({best.overall}/100, riesgo{' '}
                    {LEVEL_TEXT[best.level].toLowerCase()}).
                  </>
                )}
              </p>
            </div>
            {rotError && <div className="error">No se pudo comparar: {rotError}</div>}
            <RotationComparator
              catalog={catalog}
              sequences={sequences}
              onChange={setSequences}
              slope={slope}
              onSlope={setSlope}
              result={rot}
              loading={rotLoading}
            />
          </section>
        )}

        {report && (
          <section aria-labelledby="fuentes">
            <div className="section-head">
              <div>
                <div className="kicker">Transparencia</div>
                <h2 id="fuentes">Fuentes, supuestos e incertidumbre</h2>
              </div>
            </div>
            <SourcesPanel report={report} />
          </section>
        )}

        {!report && !error && <div className="state">Cargando 40 años de datos de la NASA…</div>}
      </main>

      <footer className="wrap">
        LaymiSat · NASA Space Apps Challenge 2026 · Datos: NASA POWER (power.larc.nasa.gov). Calendario: Felipe Guaman
        Poma de Ayala, Nueva corónica y buen gobierno (1615). Mapa © OpenStreetMap. Herramienta de apoyo, no sustituye el
        criterio de la comunidad ni del técnico agrario.
      </footer>
    </>
  )
}
