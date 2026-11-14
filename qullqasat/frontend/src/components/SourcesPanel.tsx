import { fmt, type Report } from '../api'

export default function SourcesPanel({ report }: { report: Report }) {
  const { location: loc, data, assumptions } = report
  return (
    <div className="grid grid-2">
      <div className="card sources">
        <h3>Fuentes y resolución</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Variable</th>
                <th>Fuente</th>
                <th>Resolución</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>T2M_MIN, T2M_MAX</td>
                <td>NASA POWER (MERRA-2 / GEOS)</td>
                <td>0,5° × 0,625° (~55 km), diario</td>
              </tr>
              <tr>
                <td>PRECTOTCORR</td>
                <td>NASA POWER (MERRA-2 corregido)</td>
                <td>0,5° × 0,625°, diario</td>
              </tr>
              <tr>
                <td>GWETTOP (humedad superficial)</td>
                <td>NASA POWER (MERRA-2)</td>
                <td>0,5° × 0,625°, 0–5 cm</td>
              </tr>
              <tr>
                <td>RH2M, ALLSKY_SFC_SW_DWN</td>
                <td>NASA POWER</td>
                <td>0,5° × 0,625° / 1°, diario</td>
              </tr>
              <tr>
                <td>Calendario agrícola</td>
                <td>Guaman Poma de Ayala (1615)</td>
                <td>Mensual, cualitativo</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="meta" style={{ marginTop: 10 }}>
          Serie {data.first_date} → {data.last_date} · origen: {data.source === 'live' ? 'API en vivo' : 'caché local'} ·
          celda POWER a {fmt(loc.grid_elevation)} m; parcela a {fmt(loc.altitude)} m (corrección{' '}
          {loc.temperature_offset_c > 0 ? '+' : ''}
          {fmt(loc.temperature_offset_c, 2)} °C con {fmt(assumptions.lapse_rate_c_per_km, 1)} °C/km).
        </p>
      </div>
      <div className="card">
        <h3>Límites que debes conocer</h3>
        <ul className="limits">
          <li>
            Una celda de NASA POWER cubre ~55 km: no distingue quebradas ni laderas. Corregimos la temperatura por altitud
            con un gradiente fijo; la lluvia no se corrige.
          </li>
          <li>
            La reanálisis suaviza las heladas de noches despejadas. Por eso la helada se evalúa a nivel de planta (Tmin
            {assumptions.plant_adjust_c >= 0 ? ' +' : ' '}
            {fmt(assumptions.plant_adjust_c, 1)} °C, ajustable). Calibrar con estaciones SENAMHI.
          </li>
          <li>
            Los datos desde {data.provisional_from} son casi en tiempo real y pueden revisarse: trátalos como provisionales.
          </li>
          <li>Guaman Poma es una línea base cultural, no una medición: comparamos fechas, no forzamos equivalencias.</li>
          <li>No predecimos rendimientos. Es un apoyo a la decisión de la asamblea y del técnico, no un reemplazo.</li>
          <li>Próximo paso: NDVI (MODIS/Sentinel-2) y pendiente SRTM por sector; validación en campo con la Agencia Agraria.</li>
        </ul>
      </div>
    </div>
  )
}
