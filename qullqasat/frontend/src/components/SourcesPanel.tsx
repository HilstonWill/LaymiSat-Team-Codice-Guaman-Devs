import type { Report } from '../api'
import { fmtNum, type Dict, type Lang } from '../i18n'

const ROWS: Record<Lang, [string, string, string][]> = {
  en: [
    ['T2M_MIN, T2M_MAX (air temperature)', 'NASA POWER (MERRA-2 / GEOS)', '0.5° × 0.625° (~55 km), daily'],
    ['PRECTOTCORR (rainfall)', 'NASA POWER (bias-corrected MERRA-2)', '0.5° × 0.625°, daily'],
    ['GWETTOP (surface soil wetness)', 'NASA POWER (MERRA-2)', '0.5° × 0.625°, top 0–5 cm'],
    ['RH2M, ALLSKY_SFC_SW_DWN', 'NASA POWER', 'downloaded, context only'],
    ['NDVI (vegetation greenness)', 'MODIS MOD13Q1 (Terra), NASA ORNL DAAC web service', '250 m, 16-day'],
    ['Elevation and slope', 'NASA SRTM 1 arc-second, via OpenTopoData', '30 m'],
    ['Farming calendar', 'Guaman Poma de Ayala (1615)', 'monthly, qualitative'],
  ],
  es: [
    ['T2M_MIN, T2M_MAX (temperatura del aire)', 'NASA POWER (MERRA-2 / GEOS)', '0,5° × 0,625° (~55 km), diario'],
    ['PRECTOTCORR (lluvia)', 'NASA POWER (MERRA-2 corregido)', '0,5° × 0,625°, diario'],
    ['GWETTOP (humedad superficial)', 'NASA POWER (MERRA-2)', '0,5° × 0,625°, 0–5 cm'],
    ['RH2M, ALLSKY_SFC_SW_DWN', 'NASA POWER', 'descargadas, solo contexto'],
    ['NDVI (verdor de la vegetación)', 'MODIS MOD13Q1 (Terra), servicio web ORNL DAAC de NASA', '250 m, 16 días'],
    ['Altitud y pendiente', 'NASA SRTM 1 segundo de arco, vía OpenTopoData', '30 m'],
    ['Calendario agrícola', 'Guaman Poma de Ayala (1615)', 'mensual, cualitativo'],
  ],
}

function limits(r: Report, lang: Lang): string[] {
  const adj = `${r.assumptions.plant_adjust_c >= 0 ? '+' : ''}${r.assumptions.plant_adjust_c}`
  if (lang === 'en') {
    return [
      'A NASA POWER cell covers ~55 km: it cannot resolve valleys or slopes. Temperature is corrected for altitude with a fixed lapse rate; rainfall is not corrected.',
      `Reanalysis smooths clear-night frosts, so frost is evaluated at plant level (Tmin ${adj} °C, adjustable). To be calibrated with SENAMHI stations (tool included in the repository).`,
      `Data since ${r.data.provisional_from} are near-real-time and may be revised: treat them as provisional.`,
      'The MODIS 250 m pixel mixes fields, fallow and grassland: NDVI is land-cover context, not a measurement of one plot.',
      'Guaman Poma is a cultural baseline, not a measurement: we compare dates and criteria, we do not force equivalences. Months, names and tasks checked against the manuscript (Royal Danish Library, ch. 37, pp. 1140–1178).',
      'No yield prediction. It supports the community assembly and the extension agent; it does not replace them.',
      'Next steps: GPM IMERG rainfall (needs a NASA Earthdata login), SMAP soil moisture, field validation with the Cusco agricultural agency.',
    ]
  }
  return [
    'Una celda de NASA POWER cubre ~55 km: no distingue quebradas ni laderas. La temperatura se corrige por altitud con un gradiente fijo; la lluvia no se corrige.',
    `La reanálisis suaviza las heladas de noches despejadas, por eso la helada se evalúa a nivel de planta (Tmin ${adj} °C, ajustable). Calibrar con estaciones SENAMHI (herramienta incluida en el repositorio).`,
    `Los datos desde ${r.data.provisional_from} son casi en tiempo real y pueden revisarse: trátalos como provisionales.`,
    'El píxel MODIS de 250 m mezcla chacras, purun y pajonal: el NDVI es contexto de cobertura, no la medición de una parcela.',
    'Guaman Poma es una línea base cultural, no una medición: comparamos fechas y criterios, no forzamos equivalencias. Meses, nombres y labores verificados con el manuscrito (Biblioteca Real de Dinamarca, cap. 37, págs. 1140–1178).',
    'No predice rendimientos. Apoya a la asamblea comunal y al técnico; no los reemplaza.',
    'Próximos pasos: lluvia GPM IMERG (requiere cuenta NASA Earthdata), humedad SMAP, validación de campo con la Agencia Agraria Cusco.',
  ]
}

export default function SourcesPanel({ report, t, lang }: { report: Report; t: Dict; lang: Lang }) {
  const { location: loc, data, assumptions } = report
  const en = lang === 'en'
  const head = en ? ['Variable', 'Source', 'Resolution'] : ['Variable', 'Fuente', 'Resolución']
  return (
    <>
      <div className="grid grid-2">
        <div className="card sources">
          <h3>{en ? 'Sources and resolution' : 'Fuentes y resolución'}</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {head.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS[lang].map((r) => (
                  <tr key={r[0]}>
                    <td>{r[0]}</td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="meta" style={{ marginTop: 10 }}>
            {en ? 'Series' : 'Serie'} {data.first_date} → {data.last_date} ·{' '}
            {data.source === 'live' ? (en ? 'live API' : 'API en vivo') : en ? 'local cache' : 'caché local'} ·{' '}
            {en ? 'POWER cell at' : 'celda POWER a'} {fmtNum(loc.grid_elevation, lang)} m; {en ? 'plot at' : 'parcela a'}{' '}
            {fmtNum(loc.altitude, lang)} m ({loc.temperature_offset_c > 0 ? '+' : ''}
            {fmtNum(loc.temperature_offset_c, lang, 2)} °C, {fmtNum(assumptions.lapse_rate_c_per_km, lang, 1)} °C/km).
          </p>
        </div>
        <div className="card">
          <h3>{en ? 'Limits you should know' : 'Límites que debes conocer'}</h3>
          <ul className="limits">
            {limits(report, lang).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card glossary" style={{ marginTop: 16 }}>
        <h3>{t.glossaryTitle}</h3>
        <dl>
          {t.glossary.map(([term, def]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}
