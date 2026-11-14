export type Level = 'verde' | 'ambar' | 'rojo'

export interface Zone {
  id: string
  name: string
  province: string
  lat: number
  lon: number
  altitude: number
  note: string
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
  onset_label: string | null
}

export interface CalendarRow {
  month: number
  name: string
  quechua: string
  milestone: string
  criterion: string
  nasa_variables: string[]
  indicator_label: string
  unit: string
  early: number | null
  recent: number | null
  change: number | null
  status: 'se_desfasa' | 'se_mantiene' | 'informativo'
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
  water_mm: number
  frost_tolerance: number
  n_balance: number
  cover_months: number
  alt_min: number
  alt_max: number
}

export interface CropsCatalog {
  note: string
  crops: Record<string, Crop>
  presets: { id: string; name: string; sequence: string[] }[]
}

export type Criterion = 'suelo' | 'plagas' | 'agua' | 'helada' | 'erosion'

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
}

export interface RotationResponse {
  results: RotationResult[]
  best_id: string
  weights: Record<Criterion, number>
  assumptions: string[]
  context: {
    altitude: number
    frost_probability: number
    dry_spell_probability: number
    heavy_days_mean: number
    season_precip_mean: number | null
    slope: string
  }
}

export interface Place {
  lat: number
  lon: number
  altitude: number
  name: string
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** GET/POST con reintentos ante errores de red o 5xx (p. ej. el servidor gratuito despertando). */
async function request<T>(path: string, init?: RequestInit, retries = 3): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, init)
  } catch (e) {
    if (init?.signal?.aborted) throw e
    if (retries > 0) {
      await sleep(1500)
      return request<T>(path, init, retries - 1)
    }
    throw e
  }
  if (res.status >= 500 && res.status !== 503 && retries > 0) {
    await sleep(1500)
    return request<T>(path, init, retries - 1)
  }
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

export const api = {
  zones: () => request<Zone[]>('/api/zones'),
  crops: () => request<CropsCatalog>('/api/crops'),
  report: (p: Place, plantAdjust: number, signal?: AbortSignal) => {
    const q = new URLSearchParams({
      lat: p.lat.toFixed(2),
      lon: p.lon.toFixed(2),
      altitude: String(Math.round(p.altitude)),
      plant_adjust: plantAdjust.toFixed(1),
    })
    return request<Report>(`/api/report?${q}`, { signal })
  },
  rotations: (
    p: Place,
    plantAdjust: number,
    slope: string,
    sequences: { id: string; name: string; sequence: string[] }[],
    signal?: AbortSignal,
  ) =>
    request<RotationResponse>('/api/rotations', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: Number(p.lat.toFixed(2)),
        lon: Number(p.lon.toFixed(2)),
        altitude: Math.round(p.altitude),
        plant_adjust: plantAdjust,
        slope,
        sequences,
      }),
    }),
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Días desde el 1 de agosto → "23 sep". */
export function sdayLabel(sday: number): string {
  const d = new Date(Date.UTC(2001, 7, 1) + Math.round(sday) * 86400000)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

export const LEVEL_TEXT: Record<Level, string> = { verde: 'Bajo', ambar: 'Atención', rojo: 'Alto' }

export const CRITERIA: { key: Criterion; label: string }[] = [
  { key: 'suelo', label: 'Suelo (N)' },
  { key: 'plagas', label: 'Plagas' },
  { key: 'agua', label: 'Agua' },
  { key: 'helada', label: 'Helada' },
  { key: 'erosion', label: 'Erosión' },
]

export function formatP(p: number): string {
  return p < 0.001 ? 'p < 0,001' : `p = ${p.toFixed(3).replace('.', ',')}`
}

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
