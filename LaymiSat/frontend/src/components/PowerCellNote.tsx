import type { Zone } from '../api'
import { DICTS, fmtNum, type Lang } from '../i18n'

// Rejilla nativa de MERRA-2 que usa NASA POWER (igual que backend/app/climate.py).
const GRID_LAT = 0.5
const GRID_LON = 0.625

const snap = (lat: number, lon: number) =>
  [Math.round(lat / GRID_LAT) * GRID_LAT, Math.round(lon / GRID_LON) * GRID_LON] as const

const joinNames = (names: string[], lang: Lang) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${lang === 'en' ? 'and' : 'y'} ${names[names.length - 1]}`

interface Props {
  lang: Lang
  location: { lat: number; lon: number; altitude: number; grid_elevation: number; temperature_offset_c: number }
  plantAdjust: number
  zones: Zone[]
  labelOf: (z: Zone) => string
}

/** Dice con honestidad de qué celda NASA POWER sale el clima y qué supuestos se aplican. */
export default function PowerCellNote({ lang, location, plantAdjust, zones, labelOf }: Props) {
  const t = DICTS[lang]
  const c = t.cell
  const { lat, lon } = location
  const kmLat = GRID_LAT * 111.32
  const kmLon = GRID_LON * 111.32 * Math.cos((lat * Math.PI) / 180)
  const size = `${fmtNum(kmLat, lang)} × ${fmtNum(kmLon, lang)}`
  const hemi = t.custom.hemi
  const center = `${fmtNum(Math.abs(lat), lang, 2)}° ${lat < 0 ? hemi.s : hemi.n} · ${fmtNum(Math.abs(lon), lang, 2)}° ${
    lon < 0 ? hemi.w : hemi.e
  }`
  const sign = (n: number, d: number) => `${n > 0 ? '+' : ''}${fmtNum(n, lang, d)}`

  const [cLat, cLon] = snap(lat, lon)
  const sharing = zones.filter((z) => {
    const [a, b] = snap(z.lat, z.lon)
    return Math.abs(a - cLat) < 1e-6 && Math.abs(b - cLon) < 1e-6
  })

  return (
    <details className="cell-note">
      <summary className="cell-note-head">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
        </svg>
        {c.summary(size)}
      </summary>
      <p>{c.body(size, center, fmtNum(location.grid_elevation, lang))}</p>
      <p>
        {c.correction(fmtNum(location.altitude, lang), sign(location.temperature_offset_c, 1), sign(plantAdjust, 1))}
      </p>
      {sharing.length > 1 && <p className="cell-note-shared">{c.shared(joinNames(sharing.map(labelOf), lang))}</p>}
    </details>
  )
}
