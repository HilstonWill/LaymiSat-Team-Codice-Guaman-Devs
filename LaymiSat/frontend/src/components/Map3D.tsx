import maplibregl, { type GeoJSONSource, type Map as MLMap, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import type { Level, Place, Zone } from '../api'

// Mismos límites que el backend acepta (región Cusco).
const BOUNDS = { lat: [-15.5, -11.0], lon: [-73.9, -70.3] }
const LEVEL_COLOR: Record<Level, string> = { verde: '#2f8a4c', ambar: '#e0a43a', rojo: '#d9452a' }
const EXAGGERATION = 1.6

type LayerId = 'sat' | 'ndvi' | 'lst'

// NASA GIBS (WMTS REST, sin API key). "default" como tiempo = última imagen disponible.
const gibs = (layer: string, matrix: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/default/${matrix}/{z}/{y}/{x}.png`

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    sat: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    ndvi: {
      type: 'raster',
      tiles: [gibs('MODIS_Terra_NDVI_8Day', 'GoogleMapsCompatible_Level9')],
      tileSize: 256,
      maxzoom: 9,
      attribution: 'NASA GIBS · MODIS',
    },
    lst: {
      type: 'raster',
      tiles: [gibs('MODIS_Terra_L3_Land_Surface_Temp_8Day_Day', 'GoogleMapsCompatible_Level7')],
      tileSize: 256,
      maxzoom: 7,
      attribution: 'NASA GIBS · MODIS',
    },
    dem: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 14,
      encoding: 'terrarium',
      attribution: 'Terrain: Mapzen / AWS Open Data (incl. NASA SRTM)',
    },
    demHs: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 14,
      encoding: 'terrarium',
    },
    columns: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    gps: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [
    { id: 'sat', type: 'raster', source: 'sat' },
    { id: 'ndvi', type: 'raster', source: 'ndvi', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.72 } },
    { id: 'lst', type: 'raster', source: 'lst', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.72 } },
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'demHs',
      paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#16203a' },
    },
    {
      id: 'columns',
      type: 'fill-extrusion',
      source: 'columns',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'h'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.88,
      },
    },
    // Círculo de precisión del GPS (el radio es la precisión que informa el teléfono).
    { id: 'gps-acc', type: 'fill', source: 'gps', paint: { 'fill-color': '#3d6fa8', 'fill-opacity': 0.18 } },
    { id: 'gps-acc-line', type: 'line', source: 'gps', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.9 } },
  ],
  sky: {
    'sky-color': '#16203a',
    'horizon-color': '#7fa6d6',
    'fog-color': '#c9d8ec',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.5,
    'fog-ground-blend': 0.4,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 0.6, 12, 0],
  },
}

// Polígono circular (aprox.) para extruir como columna.
function disc(lon: number, lat: number, rKm: number, steps = 28): [number, number][] {
  const dLat = rKm / 110.574
  const dLon = rKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return ring
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export interface Map3DLabels {
  region: string
  layer: string
  satellite: string
  ndvi: string
  lst: string
  view3d: string
  view2d: string
  reset: string
  layerNote: string
  zoneButton: (name: string, alt: number) => string
  locate: string
  locating: string
}

interface Props {
  zones: Zone[]
  place: Place
  selectedZoneId?: string
  level?: Level
  onZone: (z: Zone) => void
  onPick: (lat: number, lon: number) => void
  labelOf?: (z: Zone) => string
  labels: Map3DLabels
  /** Texto de la etiqueta del punto personalizado (p. ej. "Tu punto · 3.529 m"); vacío = sin etiqueta. */
  placeTag?: string
  /** Pista que invita a tocar el terreno (se oculta con un punto personalizado activo). */
  hint?: string
  /** Mensaje cuando el clic cae fuera del área de estudio. */
  outsideMsg?: string
  /** Pide la ubicación del dispositivo (GPS). */
  onLocate?: () => void
  locating?: boolean
  /** Precisión del GPS en metros, si el punto vino del GPS. */
  gpsAccuracy?: number | null
  /** Aviso externo (p. ej. errores del GPS) que se muestra en el mapa. */
  message?: string | null
}

export default function Map3D({
  zones,
  place,
  selectedZoneId,
  level,
  onZone,
  onPick,
  labelOf = (z) => z.name,
  labels,
  placeTag,
  hint,
  outsideMsg,
  onLocate,
  locating = false,
  gpsAccuracy = null,
  message = null,
}: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const placeMarker = useRef<maplibregl.Marker | null>(null)
  const placeTagEl = useRef<HTMLSpanElement | null>(null)
  const [outside, setOutside] = useState(false)
  const outsideTimer = useRef<number | undefined>(undefined)
  const cb = useRef({ onZone, onPick })
  cb.current = { onZone, onPick }
  const [ready, setReady] = useState(false)
  const [is3d, setIs3d] = useState(true)
  const [layer, setLayer] = useState<LayerId>('sat')
  const firstFly = useRef(true)
  // isStyleLoaded() es false mientras cargan teselas; usamos nuestra propia bandera.
  const styleReady = useRef(false)

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    const container = box.current
    if (!container) return
    styleReady.current = false
    firstFly.current = true // StrictMode remonta: la intro va en el mapa que sobrevive
    const reduced = prefersReducedMotion()
    // Copia por instancia: MapLibre no debe compartir el objeto de estilo entre montajes (StrictMode).
    const style = structuredClone(STYLE)
    // El globo es solo para la intro; las columnas (fill-extrusion) se dibujan en mercator.
    if (reduced) style.projection = { type: 'mercator' }
    const map = new maplibregl.Map({
      container,
      style,
      center: reduced ? [place.lon, place.lat] : [-60, -8],
      zoom: reduced ? 10.4 : 1.6,
      pitch: reduced ? 60 : 0,
      bearing: reduced ? -25 : 0,
      maxPitch: 75,
      attributionControl: { compact: true },
    })
    // Zoom con rueda solo tras hacer clic dentro del mapa (no "atrapa" el scroll de la página).
    map.scrollZoom.disable()
    const releaseWheel = () => map.scrollZoom.disable()
    container.addEventListener('mouseleave', releaseWheel)
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-left')
    map.addControl(new maplibregl.FullscreenControl(), 'bottom-left')

    // Lejos (zoom < 8,5) las etiquetas se amontonan: se ocultan y quedan los puntos.
    const syncFar = () => container.classList.toggle('is-far', map.getZoom() < 8.5)
    map.on('zoom', syncFar)
    syncFar()
    map.once('style.load', () => {
      styleReady.current = true
      map.setTerrain({ source: 'dem', exaggeration: EXAGGERATION })
      setReady(true)
    })
    map.on('click', (e) => {
      map.scrollZoom.enable()
      const target = e.originalEvent.target as HTMLElement | null
      if (target?.closest('.zone-pin')) return
      const { lat, lng } = e.lngLat
      if (lat >= BOUNDS.lat[0] && lat <= BOUNDS.lat[1] && lng >= BOUNDS.lon[0] && lng <= BOUNDS.lon[1]) {
        cb.current.onPick(lat, lng)
        setOutside(false)
      } else {
        setOutside(true)
        window.clearTimeout(outsideTimer.current)
        outsideTimer.current = window.setTimeout(() => setOutside(false), 3200)
      }
    })

    const el = document.createElement('div')
    el.className = 'place-marker'
    el.setAttribute('aria-hidden', 'true')
    const pulse = document.createElement('div')
    pulse.className = 'place-pulse'
    const tag = document.createElement('span')
    tag.className = 'place-tag'
    el.append(pulse, tag)
    placeTagEl.current = tag
    placeMarker.current = new maplibregl.Marker({ element: el }).setLngLat([place.lon, place.lat]).addTo(map)

    mapRef.current = map
    return () => {
      container.removeEventListener('mouseleave', releaseWheel)
      window.clearTimeout(outsideTimer.current)
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Marcadores accesibles (botones) de las zonas piloto.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = zones.map((z) => {
      const active = z.id === selectedZoneId
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `zone-pin${active ? ' is-active' : ''}`
      btn.setAttribute('aria-label', labels.zoneButton(labelOf(z), z.altitude))
      btn.setAttribute('aria-pressed', String(active))
      const dot = document.createElement('span')
      dot.className = 'zone-dot'
      const label = document.createElement('span')
      label.className = 'zone-label'
      label.textContent = `${labelOf(z)} · ${z.altitude} m`
      btn.append(dot, label)
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        cb.current.onZone(z)
      })
      return new maplibregl.Marker({ element: btn, anchor: 'left', offset: [-8, 0] }).setLngLat([z.lon, z.lat]).addTo(map)
    })
    return () => markers.forEach((m) => m.remove())
  }, [zones, selectedZoneId, labelOf, labels])

  // Columnas 3D: zonas (maíz, altura según altitud) + parcela activa (color del riesgo).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const src = map.getSource('columns') as GeoJSONSource | undefined
    if (!src) return
    const features: GeoJSON.Feature[] = zones.map((z) => ({
      type: 'Feature',
      properties: { color: '#e0a43a', h: 600 + Math.max(0, z.altitude - 3000) * 1.6 },
      geometry: { type: 'Polygon', coordinates: [disc(z.lon, z.lat, 1.3)] },
    }))
    features.push({
      type: 'Feature',
      properties: { color: level ? LEVEL_COLOR[level] : '#b8532f', h: 3400 },
      geometry: { type: 'Polygon', coordinates: [disc(place.lon, place.lat, 0.7)] },
    })
    src.setData({ type: 'FeatureCollection', features })
  }, [zones, place.lat, place.lon, level, ready])

  // Círculo de precisión del GPS alrededor del punto.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const src = map.getSource('gps') as GeoJSONSource | undefined
    if (!src) return
    const features: GeoJSON.Feature[] =
      gpsAccuracy && gpsAccuracy > 0
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'Polygon', coordinates: [disc(place.lon, place.lat, Math.max(gpsAccuracy, 15) / 1000, 64)] },
            },
          ]
        : []
    src.setData({ type: 'FeatureCollection', features })
  }, [gpsAccuracy, place.lat, place.lon, ready])

  // Vuelo cinematográfico hacia la parcela activa (el primero es la intro desde el globo).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    placeMarker.current?.setLngLat([place.lon, place.lat])
    const reduced = prefersReducedMotion()
    const intro = firstFly.current
    firstFly.current = false
    const go = () => {
      if (intro && !reduced) map.once('moveend', () => map.setProjection({ type: 'mercator' }))
      map.flyTo({
        center: [place.lon, place.lat],
        zoom: 10.4,
        pitch: is3d ? 60 : 0,
        bearing: is3d ? -25 : 0,
        duration: reduced ? 0 : intro ? 5200 : 2200,
        curve: intro ? 1.6 : 1.3,
        essential: true,
      })
    }
    if (styleReady.current) go()
    else map.once('style.load', go)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.lat, place.lon])

  // Etiqueta del punto personalizado sobre el mapa.
  useEffect(() => {
    const tag = placeTagEl.current
    if (!tag) return
    tag.textContent = placeTag ?? ''
    tag.hidden = !placeTag
  }, [placeTag])

  // Capa NASA superpuesta al satélite.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    for (const id of ['ndvi', 'lst'] as const) map.setLayoutProperty(id, 'visibility', id === layer ? 'visible' : 'none')
  }, [layer, ready])

  const toggle3d = (on: boolean) => {
    const map = mapRef.current
    setIs3d(on)
    if (!map) return
    map.setTerrain(on ? { source: 'dem', exaggeration: EXAGGERATION } : null)
    map.easeTo({ pitch: on ? 60 : 0, bearing: on ? -25 : 0, duration: prefersReducedMotion() ? 0 : 900 })
  }

  const recenter = () =>
    mapRef.current?.flyTo({
      center: [place.lon, place.lat],
      zoom: 10.4,
      pitch: is3d ? 60 : 0,
      bearing: is3d ? -25 : 0,
      duration: prefersReducedMotion() ? 0 : 1600,
      essential: true,
    })

  const layers: { id: LayerId; label: string }[] = [
    { id: 'sat', label: labels.satellite },
    { id: 'ndvi', label: labels.ndvi },
    { id: 'lst', label: labels.lst },
  ]

  return (
    <div className="map map3d" role="region" aria-label={labels.region}>
      <div ref={box} className="map3d-canvas" />
      <div className="map3d-controls">
        <div className="seg" role="group" aria-label={labels.layer}>
          {layers.map((l) => (
            <button key={l.id} type="button" aria-pressed={layer === l.id} onClick={() => setLayer(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="3D / 2D">
          <button type="button" aria-pressed={is3d} onClick={() => toggle3d(true)}>
            {labels.view3d}
          </button>
          <button type="button" aria-pressed={!is3d} onClick={() => toggle3d(false)}>
            {labels.view2d}
          </button>
          <button type="button" onClick={recenter}>
            {labels.reset}
          </button>
        </div>
        {onLocate && (
          <button type="button" className="map3d-locate" onClick={onLocate} disabled={locating} aria-busy={locating}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" fill="currentColor" />
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {locating ? labels.locating : labels.locate}
          </button>
        )}
        {layer !== 'sat' && <span className="map3d-note">{labels.layerNote}</span>}
        {hint && !placeTag && (
          <span className="map3d-hint">
            <span className="hint-dot" aria-hidden="true" /> {hint}
          </span>
        )}
      </div>
      <div className="map3d-toast" role="status">
        {message ? <span>{message}</span> : outside && outsideMsg ? <span>{outsideMsg}</span> : null}
      </div>
    </div>
  )
}
