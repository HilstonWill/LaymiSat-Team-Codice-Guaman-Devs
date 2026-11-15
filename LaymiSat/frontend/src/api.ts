import type { Lang } from './i18n'

export type Level = 'verde' | 'ambar' | 'rojo'

export interface Zone {
  id: string
  name: string
  name_en?: string
  province: string
  lat: number
  lon: number
  altitude: number
  note: string
  note_en?: string
}

export interface Trend {
  slope_per_decade: number
  p_value: number
  significant: boolean
  direction: string
  variable: string
  unit: string
  n: number
}

export interface Alert {
  id: 'AHS' | 'AEH' | 'ADS'
  name: string
  question: string
  level: Level
  headline: string
  trigger: string
  action: string
  current: Record<string, string | number | null>
  metrics: Record<string, unknown>
  trend: Trend
}

export interface SeriesRow {
  campaign: number
  frost_days: number
  frost_events: number
  complete: boolean
  son_precip: number | null
  son_complete: boolean
  djf_max_dry: number | null
  onset_sday: number | null
  shift_days: number | null
  provisional: boolean
}

export interface CalendarRow {
  month: number
  page: number | null
  source_url: string | null
  name: string
  quechua: string
  milestone: string
  criterion: string
  action: string
  alternative: string
  data_sentence: string
  trend: 'better' | 'worse' | 'same' | 'up' | 'down'
  plain_before: string
  plain_now: string
  indicator: string
  n_early: number
  n_recent: number
  nasa_variables: string[]
  indicator_label: string
  unit: string
  early: number | null
  recent: number | null
  change: number | null
  status: 'se_desfasa' | 'se_mantiene' | 'no_coincide' | 'informativo'
  early_period: string
  recent_period: string
}

export interface AltitudeRow {
  altitude: number
  frost_days_early: number
  frost_days_recent: number
  event_probability_early: number
  event_probability_recent: number
}

export interface Report {
  location: { lat: number; lon: number; altitude: number; grid_elevation: number; temperature_offset_c: number }
  data: { source: string; first_date: string; last_date: string; provisional_from: string; current_campaign: string }
  assumptions: { lapse_rate_c_per_km: number; plant_adjust_c: number }
  alerts: Alert[]
  series: SeriesRow[]
  annual_temperature: { year: number; tmin: number; tmax: number }[]
  tmin_trend: Trend
  frost_by_altitude: AltitudeRow[]
  calendar: CalendarRow[]
  traditional_sowing: { window: [number, number]; reference_sday: number; label: string }
}

export interface Crop {
  name: string
  name_en?: string
  water_mm: number
  frost_tolerance: number
  n_balance: number
  alt_min: number
  alt_max: number
}

export interface Preset {
  id: string
  name: string
  name_en?: string
  sequence: string[]
}

export interface CropsCatalog {
  note: string
  crops: Record<string, Crop>
  presets: Preset[]
}

export type Criterion = 'suelo' | 'plagas' | 'agua' | 'helada' | 'erosion' | 'forraje' | 'ingresos'
export const CRITERIA: Criterion[] = ['suelo', 'plagas', 'agua', 'helada', 'erosion', 'forraje', 'ingresos']
export const DEFAULT_PRIORITIES: Record<Criterion, number> = {
  suelo: 2.5,
  plagas: 2,
  agua: 2,
  helada: 2,
  erosion: 1.5,
  forraje: 0,
  ingresos: 0,
}

export type Texture = 'arenoso' | 'franco' | 'arcilloso'
export type OrganicMatter = 'baja' | 'media' | 'alta'
export type Slope = 'plana' | 'moderada' | 'fuerte'

export interface SoilInput {
  texture: Texture
  organic_matter: OrganicMatter
  declared: boolean
}

export interface RotationResult {
  id: string
  name: string
  sequence: string[]
  sequence_names: string[]
  scores: Record<Criterion, number>
  levels: Record<Criterion, Level>
  overall: number
  level: Level
  reasons: Record<Criterion, string[]>
  timeline: { crop: string; name: string; covered: boolean[] }[]
  bare_rainy_months_per_season: number
  info_gaps: string[]
  risks: string[]
}

export interface RotationResponse {
  results: RotationResult[]
  best_id: string
  weights: Record<Criterion, number>
  campaign_months: number[]
  rainy_months: number[]
  assumptions: string[]
  context: {
    altitude: number
    frost_probability: number
    dry_spell_probability: number
    heavy_days_mean: number
    season_precip_mean: number | null
    slope: Slope
  }
}

export interface NdviSummary {
  zone_id: string
  source: string
  product: string
  first_date: string
  last_date: string
  bare_threshold: number
  early_period: string
  recent_period: string
  seasonal: { month: number; early: number | null; recent: number | null; bare_recent: boolean }[]
  peak_month: number | null
  bare_months_recent: number[]
  peak_trend: Trend
}

export interface Terrain {
  elevation_m: number
  slope_deg: number
  slope_class: Slope
  source: string
}

/** Modo Historia: línea de helada (oct–dic) por campaña, en metros. */
export interface StoryCampaign {
  campaign: number
  frost_line: number
  above_top: boolean
  smooth: number | null
}
export interface StoryData {
  range: { min: number; max: number; step: number }
  plant_adjust: number
  smooth_years: number
  campaigns: StoryCampaign[]
  early: { from: number | null; to: number | null; frost_line: number | null }
  recent: { from: number | null; to: number | null; frost_line: number | null }
}

export interface Place {
  lat: number
  lon: number
  altitude: number
  name: string
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Estado del servidor para el aviso "despertando" (WakeNotice).
 * La API vive en el plan gratuito de Render: tras ~15 min sin tráfico se duerme y la primera
 * petición tarda ~30–60 s. Si una petición pasa de WAKE_AFTER_MS se avisa; al responder, se quita.
 */
export const serverStatus = new EventTarget()
let waking = false
const setWaking = (v: boolean) => {
  if (waking === v) return
  waking = v
  serverStatus.dispatchEvent(new CustomEvent('change', { detail: v }))
}
export const isServerWaking = () => waking
const WAKE_AFTER_MS = 2500 // avisa pronto: con el servidor dormido la pantalla no debe parecer colgada
// Esperas entre reintentos: ~60 s en total, lo que tarda en despertar el servidor gratuito.
const BACKOFF_MS = [1500, 3000, 5000, 8000, 10000, 12000, 15000]

/** GET/POST con reintentos ante errores de red o 5xx (p. ej. el servidor gratuito despertando). */
async function request<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const slow = window.setTimeout(() => setWaking(true), WAKE_AFTER_MS)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, init)
  } catch (e) {
    window.clearTimeout(slow)
    if (init?.signal?.aborted) throw e
    if (attempt < BACKOFF_MS.length) {
      setWaking(true)
      await sleep(BACKOFF_MS[attempt])
      return request<T>(path, init, attempt + 1)
    }
    setWaking(false)
    throw e
  }
  window.clearTimeout(slow)
  // 502/504: el proxy de Render responde así mientras arranca el servidor. 503 es un error propio de la API.
  if (res.status >= 500 && res.status !== 503 && attempt < BACKOFF_MS.length) {
    setWaking(true)
    await sleep(BACKOFF_MS[attempt])
    return request<T>(path, init, attempt + 1)
  }
  setWaking(false)
  if (!res.ok) {
    let detail = `Error ${res.status}`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

const coords = (p: { lat: number; lon: number }) => ({ lat: p.lat.toFixed(2), lon: p.lon.toFixed(2) })

export const api = {
  zones: () => request<Zone[]>('/api/zones'),
  crops: () => request<CropsCatalog>('/api/crops'),
  report: (p: Place, plantAdjust: number, lang: Lang, signal?: AbortSignal) => {
    const q = new URLSearchParams({
      ...coords(p),
      altitude: String(Math.round(p.altitude)),
      plant_adjust: plantAdjust.toFixed(1),
      lang,
    })
    return request<Report>(`/api/report?${q}`, { signal })
  },
  story: (p: Place, plantAdjust: number, signal?: AbortSignal) =>
    request<StoryData>(
      `/api/story?${new URLSearchParams({ ...coords(p), plant_adjust: plantAdjust.toFixed(1) })}`,
      { signal },
    ),
  ndvi: (p: Place, signal?: AbortSignal) =>
    request<NdviSummary>(`/api/ndvi?${new URLSearchParams(coords(p))}`, { signal }, 0),
  terrain: (lat: number, lon: number) =>
    request<Terrain>(`/api/terrain?${new URLSearchParams({ lat: lat.toFixed(4), lon: lon.toFixed(4) })}`, undefined, 1),
  rotations: (
    body: {
      place: Place
      plantAdjust: number
      slope: Slope
      soil: SoilInput
      priorities: Record<Criterion, number>
      lang: Lang
      sequences: Preset[]
    },
    signal?: AbortSignal,
  ) =>
    request<RotationResponse>('/api/rotations', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: Number(body.place.lat.toFixed(2)),
        lon: Number(body.place.lon.toFixed(2)),
        altitude: Math.round(body.place.altitude),
        plant_adjust: body.plantAdjust,
        slope: body.slope,
        soil: body.soil,
        priorities: body.priorities,
        lang: body.lang,
        sequences: body.sequences,
      }),
    }),
}

// --- alertas dinámicas (Cristian) ---
export interface SowingPoint {
  sday: number
  rain_ready: number
  frost_risk: number
  score: number
}

export interface SowingCurve {
  curve: SowingPoint[]
  window: { from_sday: number; to_sday: number; meets_thresholds: boolean } | null
  best_sday: number | null
  campaigns: number[]
  sprout_days: number
  thresholds: { rain_ready: number; frost_risk: number }
  codex: { early_sowing_sday: number; rainfed_sowing_sday: number }
}

export interface ForecastDay {
  date: string
  tmin_plant: number
  tmax: number | null
  rain_mm: number | null
  frost: boolean
  heavy_rain: boolean
}

export interface ForecastSummary {
  source: string
  days: ForecastDay[]
  frost_nights: number
  rain_total_mm: number
  level: Level
}

export interface Explanation {
  text: string
  model: string
  generated_by: string
}

const plotQuery = (p: Place, plantAdjust: number) =>
  new URLSearchParams({
    lat: p.lat.toFixed(2),
    lon: p.lon.toFixed(2),
    altitude: String(Math.round(p.altitude)),
    plant_adjust: plantAdjust.toFixed(1),
  })

export const dynamicApi = {
  health: () => request<{ status: string; ai: boolean }>('/api/health', undefined, 1),
  sowing: (p: Place, plantAdjust: number, signal?: AbortSignal) =>
    request<SowingCurve>(`/api/sowing?${plotQuery(p, plantAdjust)}`, { signal }),
  forecast: (p: Place, plantAdjust: number, signal?: AbortSignal) =>
    request<ForecastSummary>(`/api/forecast?${plotQuery(p, plantAdjust)}`, { signal }, 0),
  explain: (p: Place, plantAdjust: number, lang: Lang, placeName: string, question?: string, focus?: 'AHS' | 'AEH' | 'ADS') =>
    request<Explanation>(
      '/api/explain',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: Number(p.lat.toFixed(2)),
          lon: Number(p.lon.toFixed(2)),
          altitude: Math.round(p.altitude),
          plant_adjust: plantAdjust,
          lang,
          place_name: placeName.slice(0, 80),
          question: question?.slice(0, 300) || null,
          focus: focus ?? null,
        }),
      },
      0,
    ),
}
