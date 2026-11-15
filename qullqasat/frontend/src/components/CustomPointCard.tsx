import { useEffect, useState } from 'react'
import type { Place, Terrain, Zone } from '../api'
import { DICTS, fmtNum, type Lang } from '../i18n'
import { PinIcon } from './Icons'

export type TerrainState = { status: 'idle' | 'loading' | 'error' } | { status: 'ok'; data: Terrain }

const R_KM = 6371
const rad = (d: number) => (d * Math.PI) / 180

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_KM * Math.asin(Math.sqrt(h))
}

// Rumbo desde la zona hacia el punto (0 = N), en 8 direcciones.
function bearingIdx(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const y = Math.sin(rad(toLon - fromLon)) * Math.cos(rad(toLat))
  const x =
    Math.cos(rad(fromLat)) * Math.sin(rad(toLat)) -
    Math.sin(rad(fromLat)) * Math.cos(rad(toLat)) * Math.cos(rad(toLon - fromLon))
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return Math.round(deg / 45) % 8
}

function nearestZone(zones: Zone[], lat: number, lon: number) {
  let best: { zone: Zone; km: number } | null = null
  for (const z of zones) {
    const km = distanceKm(z.lat, z.lon, lat, lon)
    if (!best || km < best.km) best = { zone: z, km }
  }
  return best
}

// Pequeño perfil del terreno inclinado según la pendiente real.
function SlopeGauge({ deg }: { deg: number }) {
  const w = 56
  const h = 28
  const rise = Math.tan(rad(Math.min(45, Math.max(0, deg)))) * w
  const y = Math.max(2, h - Math.min(h - 2, rise))
  return (
    <svg className="slope-gauge" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`M0 ${h} L${w} ${y} L${w} ${h} Z`} fill="currentColor" opacity="0.18" />
      <path d={`M0 ${h} L${w} ${y}`} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

interface Props {
  lang: Lang
  place: Place
  zones: Zone[]
  terrain: TerrainState
  labelOf: (z: Zone) => string
  onGoZone: (z: Zone) => void
}

export default function CustomPointCard({ lang, place, zones, terrain, labelOf, onGoZone }: Props) {
  const t = DICTS[lang]
  const c = t.custom
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [place.lat, place.lon])

  const near = nearestZone(zones, place.lat, place.lon)
  const nearName = near ? labelOf(near.zone) : ''
  const dir = near ? c.dirs[bearingIdx(near.zone.lat, near.zone.lon, place.lat, place.lon)] : ''
  const title = near && near.km <= 25 ? c.near(nearName) : c.title

  const coordText = `${fmtNum(Math.abs(place.lat), lang, 3)}° ${place.lat < 0 ? c.hemi.s : c.hemi.n} · ${fmtNum(
    Math.abs(place.lon),
    lang,
    3,
  )}° ${place.lon < 0 ? c.hemi.w : c.hemi.e}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const data = terrain.status === 'ok' ? terrain.data : null
  const clamped = data !== null && Math.abs(data.elevation_m - place.altitude) > 25

  return (
    <div className="cp">
      <div className="kicker">
        <PinIcon size={14} /> {t.customPoint}
      </div>
      <h3>{title}</h3>

      <div className="cp-coords">
        <span className="cp-coord-label">{c.coords}</span>
        <code className="cp-coord">{coordText}</code>
        <button type="button" className={`cp-copy${copied ? ' is-done' : ''}`} onClick={copy}>
          {copied ? `✓ ${c.copied}` : c.copy}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? c.copied : ''}
        </span>
      </div>

      <div className="cp-terrain" aria-busy={terrain.status === 'loading'}>
        <div className="cp-terrain-head">{c.terrainHead}</div>
        {terrain.status === 'error' ? (
          <p className="cp-error">{c.terrainError}</p>
        ) : (
          <div className="cp-stats">
            <div className="cp-stat">
              <span>{c.elevation}</span>
              {data ? (
                <b>{fmtNum(data.elevation_m, lang)} m</b>
              ) : (
                <i className="skeleton" role="img" aria-label={c.terrainLoading} />
              )}
            </div>
            <div className="cp-stat">
              <span>{c.slope}</span>
              {data ? (
                <div className="cp-slope">
                  <SlopeGauge deg={data.slope_deg} />
                  <div>
                    <b>{fmtNum(data.slope_deg, lang, 1)}°</b>
                    <small>{t.slopes[data.slope_class]}</small>
                  </div>
                </div>
              ) : (
                <i className="skeleton" aria-hidden="true" />
              )}
            </div>
            {near && (
              <div className="cp-stat cp-stat-wide">
                <span>{c.nearest}</span>
                <div className="cp-near">
                  <b>
                    {fmtNum(near.km, lang, 1)} km {dir}
                  </b>
                  <button type="button" className="cp-go" onClick={() => onGoZone(near.zone)}>
                    {c.goNearest(nearName)} →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {clamped && data && <p className="cp-note">{c.clamped(fmtNum(data.elevation_m, lang), fmtNum(place.altitude, lang))}</p>}
      </div>
    </div>
  )
}
