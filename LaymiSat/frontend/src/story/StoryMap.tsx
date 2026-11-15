import maplibregl, { type ExpressionSpecification, type Map as MLMap, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import type { Level, Zone } from '../api'
import type { StoryDict } from './storyText'

/**
 * Terreno 3D del escenario principal (MapLibre). Va en su propio módulo y se carga con lazy():
 * así la decisión de Hoy aparece sin esperar a descargar la biblioteca del mapa (~1 MB, ~290 kB comprimido).
 */

const EXAGGERATION = 1.6

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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
    demFrost: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 12,
      encoding: 'terrarium',
    },
  },
  layers: [
    { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.25, 'raster-brightness-max': 0.92 } },
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'demHs',
      paint: { 'hillshade-exaggeration': 0.4, 'hillshade-shadow-color': '#16203a' },
    },
    {
      id: 'frost',
      type: 'color-relief',
      source: 'demFrost',
      paint: { 'color-relief-opacity': 0.7, 'color-relief-color': frostRamp(3800) },
    },
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

/** Por debajo de la línea: transparente. En la línea: borde blanco. Encima: hielo translúcido. */
function frostRamp(line: number): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['elevation'],
    0, 'rgba(0,0,0,0)',
    line - 40, 'rgba(0,0,0,0)',
    line - 12, 'rgba(255,255,255,0.95)',
    line + 15, 'rgba(150,205,255,0.5)',
    line + 700, 'rgba(225,240,255,0.72)',
    9000, 'rgba(240,248,255,0.8)',
  ]
}

/** Una comunidad en el panel de zonas: dónde está, cómo se llama y su semáforo de la campaña. */
export interface OverviewZone {
  id: string
  lat: number
  lon: number
  name: string
  /** Texto para lectores de pantalla, p. ej. "Chinchero: riesgo alto". */
  label: string
  level: Level | null
}

export default function StoryMap({ zone, frostLine, playing, level, t, onFail, overview = null, onZonePick }: {
  zone: Zone | undefined
  frostLine: number | null
  playing: boolean
  /** Semáforo de la campaña: colorea el halo de la chacra en Hoy. */
  level: Level | null
  t: StoryDict
  onFail: () => void
  /** Panel de zonas: todas las comunidades a la vista, cada una con su semáforo. */
  overview?: OverviewZone[] | null
  onZonePick?: (id: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  const pins = useRef<maplibregl.Marker[]>([])
  const pickRef = useRef(onZonePick)
  useEffect(() => {
    pickRef.current = onZonePick
  })
  const [ready, setReady] = useState(false)
  const intro = useRef(true)
  const isOverview = overview !== null

  useEffect(() => {
    const container = box.current
    if (!container) return
    const style = structuredClone(STYLE)
    const reduced = reducedMotion()
    if (reduced) style.projection = { type: 'mercator' }
    let map: MLMap
    try {
      map = new maplibregl.Map({
        container,
        style,
        center: [-60, -8],
        zoom: reduced ? 9 : 1.6,
        maxPitch: 75,
        attributionControl: { compact: true },
      })
    } catch {
      onFail() // sin WebGL utilizable: el padre cambia al mapa plano
      return
    }
    map.scrollZoom.disable()
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.once('style.load', () => {
      map.setTerrain({ source: 'dem', exaggeration: EXAGGERATION })
      setReady(true)
    })
    const el = document.createElement('div')
    el.className = 'story-plot'
    el.setAttribute('aria-hidden', 'true')
    marker.current = new maplibregl.Marker({ element: el }).setLngLat([-71.85, -13.4]).addTo(map)
    mapRef.current = map
    intro.current = true
    // El escenario cambia de ancho al pasar entre pestañas (y al asentarse la grilla): el lienzo debe seguirlo.
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(container)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Halo de la chacra según el semáforo de la campaña.
  useEffect(() => {
    const el = marker.current?.getElement()
    if (!el) return
    el.classList.remove('lv-verde', 'lv-ambar', 'lv-rojo')
    if (level) el.classList.add(`lv-${level}`)
  }, [level])

  // Pines de todas las comunidades (solo en el panel de zonas). Tocar uno abre su "Hoy".
  useEffect(() => {
    const map = mapRef.current
    pins.current.forEach((p) => p.remove())
    pins.current = []
    if (!map || !overview) return
    pins.current = overview.map((z) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `zone-pin${z.level ? ` lv-${z.level}` : ''}`
      el.setAttribute('aria-label', z.label)
      const dot = document.createElement('i')
      dot.setAttribute('aria-hidden', 'true')
      const name = document.createElement('span')
      name.textContent = z.name
      el.append(dot, name)
      el.addEventListener('click', () => pickRef.current?.(z.id))
      return new maplibregl.Marker({ element: el, anchor: 'left', offset: [-9, 0] }).setLngLat([z.lon, z.lat]).addTo(map)
    })
    return () => {
      pins.current.forEach((p) => p.remove())
      pins.current = []
    }
  }, [overview, ready])

  // Cámara: vista general de todas las zonas, o vuelo a la zona elegida (el primero sale del globo).
  const overviewKey = overview?.map((z) => z.id).join(',') ?? ''
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const plot = marker.current?.getElement()
    // '' (no 'visible'): así hereda el visibility:hidden del escenario cuando la pestaña Calendario lo oculta.
    if (plot) plot.style.visibility = isOverview ? 'hidden' : ''
    const first = intro.current
    if (isOverview && overview && overview.length) {
      intro.current = false
      if (first && !reducedMotion()) map.once('moveend', () => map.setProjection({ type: 'mercator' }))
      const lons = overview.map((z) => z.lon)
      const lats = overview.map((z) => z.lat)
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        {
          padding: { top: 70, bottom: 60, left: 50, right: 140 },
          pitch: 52,
          bearing: -15,
          maxZoom: 10,
          duration: reducedMotion() ? 0 : first ? 2800 : 1800,
          essential: true,
        },
      )
      return
    }
    if (isOverview || !zone) return
    marker.current?.setLngLat([zone.lon, zone.lat])
    intro.current = false
    if (first && !reducedMotion()) map.once('moveend', () => map.setProjection({ type: 'mercator' }))
    map.flyTo({
      center: [zone.lon, zone.lat],
      zoom: 10.6,
      pitch: 62,
      bearing: -25,
      // La entrada desde el globo es corta: en una demo nadie espera 5 segundos.
      duration: reducedMotion() ? 0 : first ? 2800 : 2000,
      curve: 1.5,
      essential: true,
    })
  }, [zone, ready, isOverview, overviewKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Línea de helada de la campaña.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setLayoutProperty('frost', 'visibility', frostLine === null ? 'none' : 'visible')
    if (frostLine !== null) map.setPaintProperty('frost', 'color-relief-color', frostRamp(frostLine))
  }, [frostLine, ready])

  // Órbita lenta mientras se reproduce (cámara de documental).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !playing || reducedMotion()) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = now - last
      last = now
      if (!map.isMoving() || map.isRotating()) map.setBearing(map.getBearing() + dt * 0.004)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, ready])

  return <div ref={box} className="story-map" role="region" aria-label={t.legendFrost} />
}
