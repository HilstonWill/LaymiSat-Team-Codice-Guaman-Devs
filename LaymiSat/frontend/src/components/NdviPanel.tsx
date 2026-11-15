import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NdviSummary } from '../api'
import { fmtNum, monthName, pValue, type Dict, type Lang } from '../i18n'

interface Props {
  ndvi: NdviSummary | null
  status: 'loading' | 'ok' | 'not_pilot' | 'error'
  t: Dict
  lang: Lang
}

export default function NdviPanel({ ndvi, status, t, lang }: Props) {
  if (status !== 'ok' || !ndvi) {
    return (
      <div className="card">
        <p className="meta">{status === 'loading' ? t.ndviLoading : t.ndviOnlyPilot}</p>
      </div>
    )
  }
  const data = ndvi.seasonal.map((s) => ({ ...s, label: monthName(s.month, lang) }))
  const tr = ndvi.peak_trend
  const sig = tr.significant ? (lang === 'en' ? 'significant' : 'significativa') : lang === 'en' ? 'not significant' : 'no significativa'
  return (
    <div className="grid ndvi-grid">
      <div className="card chart-card">
        <p className="meta">{t.ndviIntro(fmtNum(ndvi.bare_threshold, lang, 2))}</p>
        <div className="chart">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e4dccb" vertical={false} />
              <ReferenceArea x1={monthName(11, lang)} x2={monthName(3, lang)} fill="#3d6fa8" fillOpacity={0.08} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 0.9]} tick={{ fontSize: 11 }} width={36} />
              <ReferenceLine y={ndvi.bare_threshold} stroke="#b8532f" strokeDasharray="5 4" />
              <Tooltip formatter={(v: number, n) => [fmtNum(v, lang, 2), n]} />
              <Line type="monotone" dataKey="early" name={ndvi.early_period} stroke="#9aa0b4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="recent" name={ndvi.recent_period} stroke="#3f7d4e" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="legend">
          <span>
            <i className="swatch" style={{ background: '#9aa0b4' }} />
            {ndvi.early_period}
          </span>
          <span>
            <i className="swatch" style={{ background: '#3f7d4e' }} />
            {ndvi.recent_period}
          </span>
          <span>
            <i className="swatch" style={{ background: 'rgba(61,111,168,.25)' }} />
            {lang === 'en' ? 'rainy season' : 'época de lluvias'}
          </span>
        </div>
      </div>
      <div className="card">
        <div className="facts one-col">
          <div className="fact">
            <span>{t.ndviPeak}</span>
            <b>{ndvi.peak_month ? monthName(ndvi.peak_month, lang) : '—'}</b>
          </div>
          <div className="fact">
            <span>{t.ndviBare}</span>
            <b>{ndvi.bare_months_recent.map((m) => monthName(m, lang)).join(', ') || '—'}</b>
          </div>
          <div className="fact">
            <span>{t.ndviTrend}</span>
            <b>
              {tr.slope_per_decade > 0 ? '+' : ''}
              {fmtNum(tr.slope_per_decade, lang, 3)} / {lang === 'en' ? 'decade' : 'década'}
            </b>
            <span>
              {pValue(tr.p_value, lang)} · {sig}
            </span>
          </div>
        </div>
        <p className="meta" style={{ marginTop: 10 }}>
          {ndvi.product} · {ndvi.first_date} → {ndvi.last_date}
        </p>
      </div>
    </div>
  )
}
