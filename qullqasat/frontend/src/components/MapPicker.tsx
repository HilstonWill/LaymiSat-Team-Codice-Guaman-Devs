import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
import type { Place, Zone } from '../api'

const BOUNDS = { lat: [-15.5, -11.0], lon: [-73.9, -70.3] }

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      if (lat >= BOUNDS.lat[0] && lat <= BOUNDS.lat[1] && lng >= BOUNDS.lon[0] && lng <= BOUNDS.lon[1]) {
        onPick(lat, lng)
      }
    },
  })
  return null
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    map.panTo([lat, lon])
  }, [lat, lon, map])
  return null
}

interface Props {
  zones: Zone[]
  place: Place
  onZone: (z: Zone) => void
  onPick: (lat: number, lon: number) => void
}

export default function MapPicker({ zones, place, onZone, onPick }: Props) {
  return (
    <div className="map" role="region" aria-label="Mapa de zonas piloto en Cusco">
      <MapContainer center={[place.lat, place.lon]} zoom={9} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zones.map((z) => (
          <CircleMarker
            key={z.id}
            center={[z.lat, z.lon]}
            radius={9}
            pathOptions={{ color: '#1f2a44', weight: 2, fillColor: '#e0a43a', fillOpacity: 0.9 }}
            eventHandlers={{ click: () => onZone(z) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {z.name} · {z.province} · {z.altitude} m
            </Tooltip>
          </CircleMarker>
        ))}
        <CircleMarker center={[place.lat, place.lon]} radius={14} pathOptions={{ color: '#b8532f', weight: 3, fillOpacity: 0 }} />
        <ClickHandler onPick={onPick} />
        <Recenter lat={place.lat} lon={place.lon} />
      </MapContainer>
    </div>
  )
}
