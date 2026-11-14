import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fmt, formatP, sdayLabel, type Report } from '../api'

const C = {
  ink: '#1f2a44',
  maize: '#e0a43a',
  terracotta: '#b8532f',
  potato: '#6b3d7a',
  sky: '#3d6fa8',
  grid: '#e4dccb',
  muted: '#9aa0b4',
}

function linearFit(xs: number[], ys: number[]) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my)
    den += (x - mx) ** 2
  })
  const b = den ? num / den : 0
  return (x: number) => my + b * (x - mx)
}

export default function TrendCharts({ report }: { report: Report }) {
  const { series, traditional_sowing: ts } = report
  const ads = report.alerts.find((a) => a.id === 'ADS')!
  const aeh = report.alerts.find((a) => a.id === 'AEH')!
  const m = ads.metrics as Record<string, number | null>
  const limit = ts.reference_sday + 21

  const onsetData = series
    .filter((s) => s.onset_sday !== null)
    .map((s) => ({
      campaign: s.campaign,
      onset: s.onset_sday as number,
      shift: (s.onset_sday as number) - ts.reference_sday,
      provisional: s.provisional,
    }))

  const sonData = series.filter((s) => s.son_complete).map((s) => ({ campaign: s.campaign, son: s.son_precip }))
  const p20 = (aeh.metrics as Record<string, number | null>).son_p20_full_season_mm

  const fit = linearFit(
    report.annual_temperature.map((d) => d.year),
    report.annual_temperature.map((d) => d.tmin),
  )
  const tempData = report.annual_temperature.map((d) => ({ ...d, fit: Number(fit(d.year).toFixed(2)) }))

  const alt = report.location.altitude
  const nearestBand = report.frost_by_altitude.reduce((best, r) =>
    Math.abs(r.altitude - alt) < Math.abs(best.altitude - alt) ? r : best,
  ).altitude
  const altData = [...report.frost_by_altitude].reverse().map((r) => ({ ...r, label: `${r.altitude} m` }))

  return (
    <div className="grid grid-2">
      <div className="card chart-card">
        <h3>¿Cuándo empiezan de verdad las lluvias de siembra?</h3>
        <p className="meta">
          Días de diferencia entre el inicio real de lluvias (≥25 mm en 10 días, sin veranillo después) y la siembra
          general de Coya Raymi (23 sep, Guaman Poma). Franja dorada: ventana del códice. Línea roja: +21 días.
        </p>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={onsetData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="campaign" tick={{ fontSize: 11 }} interval={5} />
              <YAxis tick={{ fontSize: 11 }} width={44} tickFormatter={(v: number) => (v > 0 ? `+${v}` : String(v))} />
              <ReferenceArea
                y1={ts.window[0] - ts.reference_sday}
                y2={ts.window[1] - ts.reference_sday}
                fill={C.maize}
                fillOpacity={0.35}
              />
              <ReferenceLine y={0} stroke={C.ink} />
              <ReferenceLine y={limit - ts.reference_sday} stroke={C.terracotta} strokeDasharray="5 4" />
              <Tooltip
                formatter={(v: number, _n, item) => [
                  `${v > 0 ? '+' : ''}${v} días (inicio ${sdayLabel(item.payload.onset)})`,
                  'Desfase',
                ]}
                labelFormatter={(l) => `Campaña ${l}–${Number(l) + 1}`}
              />
              <Bar dataKey="shift" radius={[3, 3, 3, 3]}>
                {onsetData.map((d) => (
                  <Cell
                    key={d.campaign}
                    fill={d.onset > limit ? C.terracotta : C.sky}
                    fillOpacity={d.provisional ? 0.45 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="legend">
          <span>
            <i className="swatch" style={{ background: C.sky }} />
            dentro de +21 días
          </span>
          <span>
            <i className="swatch" style={{ background: C.terracotta }} />
            desfase &gt; 21 días
          </span>
          <span>
            Variabilidad (desv. estándar): <b>{fmt(m.onset_std_early_days, 0)} días</b> ({String(m.early_period)}) →{' '}
            <b>{fmt(m.onset_std_recent_days, 0)} días</b> ({String(m.variability_period_recent)})
          </span>
        </div>
      </div>

      <div className="card chart-card">
        <h3>La helada depende de la altitud… y se retira cuesta arriba</h3>
        <p className="meta">
          Días con helada a nivel de planta en oct–dic (promedio por campaña) por banda de altitud: primeras 15 campañas
          frente a las últimas 15. Banda marcada: tu parcela.
        </p>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={altData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: number, n) => [`${fmt(v, 1)} días`, n]} />
              <ReferenceLine y={`${nearestBand} m`} stroke={C.terracotta} strokeWidth={2} ifOverflow="extendDomain" />
              <Bar dataKey="frost_days_early" name="1984–1998" fill={C.muted} />
              <Bar dataKey="frost_days_recent" name="2011–2025" fill={C.potato} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="legend">
          <span>
            <i className="swatch" style={{ background: C.muted }} />
            primeras 15 campañas
          </span>
          <span>
            <i className="swatch" style={{ background: C.potato }} />
            últimas 15 campañas
          </span>
        </div>
      </div>

      <div className="card chart-card">
        <h3>Lluvia de siembra sep–nov (mm)</h3>
        <p className="meta">
          Total por campaña con datos completos. Línea: percentil 20 de 1991–2020 (umbral de la alerta AEH).
        </p>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={sonData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="campaign" tick={{ fontSize: 11 }} interval={5} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip formatter={(v: number) => [`${fmt(v)} mm`, 'Lluvia sep–nov']} />
              {p20 !== null && <ReferenceLine y={p20} stroke={C.terracotta} strokeDasharray="5 4" />}
              <Bar dataKey="son" radius={[4, 4, 0, 0]}>
                {sonData.map((d) => (
                  <Cell key={d.campaign} fill={p20 !== null && (d.son ?? 0) < p20 ? C.terracotta : C.sky} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card chart-card">
        <h3>Las noches se calientan</h3>
        <p className="meta">
          Tmin media anual a {fmt(alt)} m. Pendiente de Sen: {report.tmin_trend.slope_per_decade > 0 ? '+' : ''}
          {fmt(report.tmin_trend.slope_per_decade, 2)} °C/década ({formatP(report.tmin_trend.p_value)},{' '}
          {report.tmin_trend.significant ? 'significativa' : 'no significativa'}).
        </p>
        <div className="chart">
          <ResponsiveContainer>
            <ComposedChart data={tempData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} interval={5} />
              <YAxis tick={{ fontSize: 11 }} unit=" °C" width={56} domain={['dataMin - 0.3', 'dataMax + 0.3']} tickFormatter={(v) => fmt(v, 1)} />
              <Tooltip formatter={(v: number, n) => [`${fmt(v, 2)} °C`, n]} />
              <Line type="monotone" dataKey="tmin" name="Tmin media" stroke={C.potato} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="linear" dataKey="fit" name="Tendencia" stroke={C.terracotta} strokeDasharray="6 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
