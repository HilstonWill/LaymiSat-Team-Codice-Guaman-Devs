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
import type { Report } from '../api'
import { fmtNum, pValue, sdayLabel, type Lang } from '../i18n'

const C = {
  ink: '#1f2a44',
  maize: '#e0a43a',
  terracotta: '#b8532f',
  potato: '#6b3d7a',
  sky: '#3d6fa8',
  grid: '#e4dccb',
  muted: '#9aa0b4',
}

const TXT = {
  en: {
    onsetTitle: 'When do the sowing rains really start?',
    onsetMeta:
      'Days between the real rainy-season onset (≥25 mm in 10 days, no dry spell afterwards) and the Coya Raymi early sowing of potatoes and maize (Sep 23, Guaman Poma p. 1165). Gold band: the codex window. Red line: +21 days.',
    onsetTip: 'Shift',
    onsetStart: 'onset',
    within: 'within +21 days',
    late: 'shift > 21 days',
    variability: 'Variability (standard deviation):',
    frostTitle: 'Frost depends on altitude… and is retreating uphill',
    frostMeta:
      'Plant-level frost days in Oct–Dec (mean per season) by altitude band: first 15 seasons vs last 15. The red line marks your plot.',
    first15: 'first 15 seasons',
    last15: 'last 15 seasons',
    rainTitle: 'Sowing rainfall Sep–Nov (mm)',
    rainMeta: 'Total for each complete season. Line: 20th percentile of 1991–2020 (AEH alert threshold).',
    rainTip: 'Sep–Nov rainfall',
    nightsTitle: 'Nights are getting warmer',
    nightsMeta: (alt: string, slope: string, p: string, sig: string) =>
      `Annual mean Tmin at ${alt} m. Sen slope: ${slope} °C/decade (${p}, ${sig}).`,
    sig: 'significant',
    notSig: 'not significant',
    tmin: 'Mean Tmin',
    trend: 'Trend',
    days: 'days',
    season: 'Season',
  },
  es: {
    onsetTitle: '¿Cuándo empiezan de verdad las lluvias de siembra?',
    onsetMeta:
      'Días de diferencia entre el inicio real de lluvias (≥25 mm en 10 días, sin veranillo después) y la siembra temprana de papa y maíz de Coya Raymi (23 sep, Guaman Poma pág. 1165). Franja dorada: ventana del códice. Línea roja: +21 días.',
    onsetTip: 'Desfase',
    onsetStart: 'inicio',
    within: 'dentro de +21 días',
    late: 'desfase > 21 días',
    variability: 'Variabilidad (desv. estándar):',
    frostTitle: 'La helada depende de la altitud… y se retira cuesta arriba',
    frostMeta:
      'Días con helada a nivel de planta en oct–dic (promedio por campaña) por banda de altitud: primeras 15 campañas frente a las últimas 15. La línea roja marca tu parcela.',
    first15: 'primeras 15 campañas',
    last15: 'últimas 15 campañas',
    rainTitle: 'Lluvia de siembra sep–nov (mm)',
    rainMeta: 'Total por campaña con datos completos. Línea: percentil 20 de 1991–2020 (umbral de la alerta AEH).',
    rainTip: 'Lluvia sep–nov',
    nightsTitle: 'Las noches se calientan',
    nightsMeta: (alt: string, slope: string, p: string, sig: string) =>
      `Tmin media anual a ${alt} m. Pendiente de Sen: ${slope} °C/década (${p}, ${sig}).`,
    sig: 'significativa',
    notSig: 'no significativa',
    tmin: 'Tmin media',
    trend: 'Tendencia',
    days: 'días',
    season: 'Campaña',
  },
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

export default function TrendCharts({ report, lang }: { report: Report; lang: Lang }) {
  const x = TXT[lang]
  const { series, traditional_sowing: ts } = report
  const ads = report.alerts.find((a) => a.id === 'ADS')!
  const aeh = report.alerts.find((a) => a.id === 'AEH')!
  const m = ads.metrics as Record<string, number | string | null>
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
  const tt = report.tmin_trend

  return (
    <div className="grid grid-2">
      <div className="card chart-card">
        <h3>{x.onsetTitle}</h3>
        <p className="meta">{x.onsetMeta}</p>
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
                  `${v > 0 ? '+' : ''}${v} ${x.days} (${x.onsetStart} ${sdayLabel(item.payload.onset, lang)})`,
                  x.onsetTip,
                ]}
                labelFormatter={(l) => `${x.season} ${l}–${Number(l) + 1}`}
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
            {x.within}
          </span>
          <span>
            <i className="swatch" style={{ background: C.terracotta }} />
            {x.late}
          </span>
          <span>
            {x.variability} <b>{fmtNum(m.onset_std_early_days as number, lang)} {x.days}</b> ({String(m.early_period)}) →{' '}
            <b>{fmtNum(m.onset_std_recent_days as number, lang)} {x.days}</b> ({String(m.variability_period_recent)})
          </span>
        </div>
      </div>

      <div className="card chart-card">
        <h3>{x.frostTitle}</h3>
        <p className="meta">{x.frostMeta}</p>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={altData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: number, n) => [`${fmtNum(v, lang, 1)} ${x.days}`, n]} />
              <ReferenceLine y={`${nearestBand} m`} stroke={C.terracotta} strokeWidth={2} ifOverflow="extendDomain" />
              <Bar dataKey="frost_days_early" name={x.first15} fill={C.muted} />
              <Bar dataKey="frost_days_recent" name={x.last15} fill={C.potato} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="legend">
          <span>
            <i className="swatch" style={{ background: C.muted }} />
            {x.first15}
          </span>
          <span>
            <i className="swatch" style={{ background: C.potato }} />
            {x.last15}
          </span>
        </div>
      </div>

      <div className="card chart-card">
        <h3>{x.rainTitle}</h3>
        <p className="meta">{x.rainMeta}</p>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={sonData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="campaign" tick={{ fontSize: 11 }} interval={5} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip formatter={(v: number) => [`${fmtNum(v, lang)} mm`, x.rainTip]} />
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
        <h3>{x.nightsTitle}</h3>
        <p className="meta">
          {x.nightsMeta(
            fmtNum(alt, lang),
            `${tt.slope_per_decade > 0 ? '+' : ''}${fmtNum(tt.slope_per_decade, lang, 2)}`,
            pValue(tt.p_value, lang),
            tt.significant ? x.sig : x.notSig,
          )}
        </p>
        <div className="chart">
          <ResponsiveContainer>
            <ComposedChart data={tempData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} interval={5} />
              <YAxis
                tick={{ fontSize: 11 }}
                unit=" °C"
                width={56}
                domain={['dataMin - 0.3', 'dataMax + 0.3']}
                tickFormatter={(v) => fmtNum(v, lang, 1)}
              />
              <Tooltip formatter={(v: number, n) => [`${fmtNum(v, lang, 2)} °C`, n]} />
              <Line type="monotone" dataKey="tmin" name={x.tmin} stroke={C.potato} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="linear" dataKey="fit" name={x.trend} stroke={C.terracotta} strokeDasharray="6 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
