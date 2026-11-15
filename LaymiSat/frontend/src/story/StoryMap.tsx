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

export default function StoryMap({ zone, frostLine, playing, level, t, onFail }: {
  zone: Zone | undefined
  frostLine: number | null
  playing: boolean
  /** Semáforo de la campaña: colorea el halo de la chacra en Hoy. */
  level: Level | null
  t: StoryDict
  onFail: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  const [ready, setReady] = useState(false)
  const intro = useRef(true)

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

  // Vuelo a la zona (el primero es la intro desde el globo).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !zone) return
    marker.current?.setLngLat([zone.lon, zone.lat])
    const first = intro.current
    intro.current = false
    if (first && !reducedMotion()) map.once('moveend', () => map.setProjection({ type: 'mercator' }))
    map.flyTo({
      center: [zone.lon, zone.lat],
      zoom: 10.6,
      pitch: 62,
      bearing: -25,
      duration: reducedMotion() ? 0 : first ? 5200 : 2400,
      curve: 1.5,
      essential: true,
    })
  }, [zone, ready])

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
