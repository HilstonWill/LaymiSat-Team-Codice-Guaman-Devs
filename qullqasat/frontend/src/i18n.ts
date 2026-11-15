export type Lang = 'en' | 'es'

const en = {
  tagline:
    'Agro-climate decision support for native potato farmers in Cusco, Peru: 40 years of NASA data read alongside the 1615 Andean farming calendar of Felipe Guaman Poma de Ayala.',
  badges: ['NASA POWER · daily 1984–today', 'MODIS NDVI · SRTM', 'Mann-Kendall + Sen slope', '3,200–4,200 m a.s.l.', 'Open source'],
  challenge: 'NASA Space Apps 2026 · Field Shift: Adapting Farms with NASA Data',
  printHeader: 'Community sheet',
  generated: 'generated on',
  zone: 'Pilot zone',
  pickedPoint: 'Point picked on the map',
  altitude: 'Plot altitude',
  plantAdjust: 'Plant-level frost adjustment',
  plantAdjustHelp: 'Difference between 2 m air temperature and plant temperature on clear nights',
  print: 'Print sheet',
  loadError: 'Could not load',
  loading: 'Loading 40 years of NASA data…',
  province: 'Province of',
  customPoint: 'Custom point',
  clickMap: 'Click the map (inside Cusco) to analyse another point. Altitude and slope come from NASA SRTM.',
  srtmTaken: 'Altitude and slope taken from NASA SRTM (30 m)',
  factNights: 'Nights (annual mean Tmin)',
  factVariability: 'Rain-onset variability',
  factFrost: 'Frost at sprouting (last 15 seasons)',
  factWindow: 'Observed sowing window',
  ofSeasons: 'of seasons',
  decade: '°C/decade',
  days: 'days',
  insight: (onset: string, from?: string, to?: string) =>
    `In 1615 Guaman Poma placed the early sowing of potatoes and maize in Coya Raymi (September) and the rain-fed sowing of potatoes, oca, quinoa and tarwi in Capac Inti Raymi (December). Today the firm rains arrive on average on ${onset}` +
    (from ? `, within a window from ${from} to ${to}` : '') +
    ': sowing by a fixed date is no longer enough.',
  season: 'Season',
  dataTo: 'data to',
  alertsTitle: 'The 3 alerts for this plot',
  alertsIntro: (alt: string) =>
    `Traffic light computed with NASA POWER corrected to ${alt} m. Green = low risk, amber = attention, red = high risk.`,
  whatToDo: 'What to do:',
  technical: 'Technical detail',
  trendSince: 'Trend since 1984',
  trigger: 'Trigger',
  levels: { verde: 'Low', ambar: 'Attention', rojo: 'High' },
  trendsKicker: 'Trend detective',
  trendsTitle: '40 years of climate in the field',
  calendarKicker: 'Nueva corónica y buen gobierno · 1615',
  calendarTitle: "Guaman Poma's calendar against the data",
  calendarIntro:
    'For each month: what the community did in 1615, what NASA data say today (first 15 vs last 15 seasons) and what to do when the month has shifted.',
  calendarWhat: 'What the community did',
  calendarData: 'What the data say today',
  calendarAction: 'What to do',
  calendarAlternative: 'What to sow instead',
  calendarSource: 'Manuscript page',
  status: { se_desfasa: 'Shifted', se_mantiene: 'Holding', informativo: 'Context' },
  ndviKicker: 'MODIS NDVI · 250 m',
  ndviTitle: 'When is the land green… and when is it bare?',
  ndviIntro: (thr: string) =>
    `Monthly vegetation greenness (NDVI) of the MODIS pixel around the pilot zone. Below ${thr} the soil is bare or almost bare: those are the months with the highest erosion risk if heavy rain falls.`,
  ndviBare: 'Bare months (recent)',
  ndviPeak: 'Greenest month',
  ndviTrend: 'Annual peak NDVI trend',
  ndviOnlyPilot: 'NDVI is shown for the 4 pilot zones in this MVP.',
  ndviLoading: 'Downloading MODIS NDVI for 2001–2005 and 2021–2025 (first time only, a few minutes)…',
  rotKicker: 'Field Shift · crop rotation',
  rotTitle: 'Compare rotations before deciding',
  rotIntro:
    'A plan for the coming seasons, scored with the climate observed in 2011–2025 at this plot. It is not a forecast. Edit each year, set your priorities and your soil.',
  bestNow: (name: string, score: number) => `Today the best option for your priorities is ${name} (${score}/100).`,
  priorities: 'Your priorities',
  prioritiesHelp: '0 = does not matter · 3 = very important',
  soil: 'Your soil',
  texture: 'Texture',
  organic: 'Organic matter',
  slope: 'Plot slope',
  textures: { arenoso: 'Sandy', franco: 'Loam', arcilloso: 'Clay' },
  oms: { baja: 'Low', media: 'Medium', alta: 'High' },
  slopes: { plana: 'Flat / terrace', moderada: 'Moderate', fuerte: 'Steep (hillside)' },
  criteria: {
    suelo: 'Soil (N)',
    plagas: 'Pests',
    agua: 'Water',
    helada: 'Frost',
    erosion: 'Erosion',
    forraje: 'Forage',
    ingresos: 'Income',
  },
  year: 'Year',
  bestOption: 'Best option',
  verdict: { verde: 'Recommended', ambar: 'With care', rojo: 'Risky' },
  why: 'Why this score?',
  gaps: 'Information gaps',
  risks: 'Risks to review locally',
  coverTitle: 'Soil cover through the year',
  coverHelp: 'Green = covered by the crop · grey = bare soil · blue band = rainy season (Nov–Mar)',
  context: (alt: string, frost: string, dry: string, rain: string) =>
    `NASA context at ${alt} m: frost at sprouting in ${frost}% of recent seasons · 10+ day dry spell in ${dry}% · mean Sep–Mar rainfall ${rain} mm.`,
  computing: 'Computing…',
  weightsLine: 'Weights from your priorities:',
  sourcesKicker: 'Transparency',
  sourcesTitle: 'Sources, assumptions and uncertainty',
  glossaryTitle: 'Glossary (plain language)',
  glossary: [
    ['NDVI', 'A satellite measure of how green and dense the vegetation is (0 = bare soil, 1 = very green).'],
    ['Plant-level frost', 'On clear nights the plant is colder than the air at 2 m. We subtract a few degrees to estimate it.'],
    ['Rain onset', 'First day with at least 25 mm in 10 days that is not followed by a 10-day dry spell.'],
    ['Dry spell (veranillo)', 'A run of days with almost no rain (< 1 mm) in the middle of the rainy season.'],
    ['Percentile 20', 'A value that only the driest 20% of years fall below.'],
    ['Mann-Kendall / Sen slope', 'Statistical tests that tell whether a 40-year series is really rising or falling (p < 0.05) and how fast.'],
    ['Surface soil wetness', 'How wet the top 5 cm of soil is (0 dry, 1 saturated), from a NASA model.'],
    ['Satellite vs ground', 'Satellites and models see ~55 km cells or 250 m pixels; a field station measures one point. Both together are better.'],
  ] as [string, string][],
  footer:
    'LaymiSat · NASA Space Apps Challenge 2026 · Data: NASA POWER (power.larc.nasa.gov), MODIS MOD13Q1 via ORNL DAAC, NASA SRTM via OpenTopoData. Calendar: Felipe Guaman Poma de Ayala, Nueva corónica y buen gobierno (1615). Map © OpenStreetMap. A support tool: it does not replace the judgement of the community or the agricultural extension agent.',
  aiNote:
    'AI disclosure: the software was written with the help of an AI coding assistant (Claude) from the team’s own design; data analysis uses NASA data and explicit rules, not generative AI.',
}

type Dict = typeof en

const es: Dict = {
  tagline:
    'Apoyo a decisiones agroclimáticas para la papa nativa de Cusco: 40 años de datos de la NASA leídos junto al calendario agrícola de Felipe Guaman Poma de Ayala (1615).',
  badges: ['NASA POWER · diario 1984–hoy', 'MODIS NDVI · SRTM', 'Mann-Kendall + pendiente de Sen', '3.200–4.200 m s. n. m.', 'Código abierto'],
  challenge: 'NASA Space Apps 2026 · Field Shift: Adaptando chacras con datos de la NASA',
  printHeader: 'Ficha comunitaria',
  generated: 'generada el',
  zone: 'Zona piloto',
  pickedPoint: 'Punto elegido en el mapa',
  altitude: 'Altitud de la parcela',
  plantAdjust: 'Ajuste de helada a nivel de planta',
  plantAdjustHelp: 'Diferencia entre la temperatura del aire a 2 m y la de la planta en noches despejadas',
  print: 'Imprimir ficha',
  loadError: 'No se pudo cargar',
  loading: 'Cargando 40 años de datos de la NASA…',
  province: 'Provincia de',
  customPoint: 'Punto personalizado',
  clickMap: 'Haz clic en el mapa (dentro de Cusco) para analizar otro punto. La altitud y la pendiente salen de NASA SRTM.',
  srtmTaken: 'Altitud y pendiente tomadas de NASA SRTM (30 m)',
  factNights: 'Noches (Tmin media anual)',
  factVariability: 'Variabilidad del inicio de lluvias',
  factFrost: 'Helada en brotación (últimas 15 campañas)',
  factWindow: 'Ventana de siembra observada',
  ofSeasons: 'de campañas',
  decade: '°C/década',
  days: 'días',
  insight: (onset: string, from?: string, to?: string) =>
    `En 1615 Guaman Poma situaba la siembra temprana de papa y maíz en Coya Raymi (septiembre) y la siembra de temporal de papa, oca, quinua y tarwi en Capac Inti Raymi (diciembre). Hoy las lluvias firmes llegan en promedio el ${onset}` +
    (from ? `, en una ventana que va del ${from} al ${to}` : '') +
    ': sembrar por una fecha fija ya no basta.',
  season: 'Campaña',
  dataTo: 'datos al',
  alertsTitle: 'Las 3 alertas para esta parcela',
  alertsIntro: (alt: string) =>
    `Semáforo calculado con NASA POWER corregido a ${alt} m. Verde = riesgo bajo, ámbar = atención, rojo = riesgo alto.`,
  whatToDo: 'Qué hacer:',
  technical: 'Detalle técnico',
  trendSince: 'Tendencia desde 1984',
  trigger: 'Detonador',
  levels: { verde: 'Bajo', ambar: 'Atención', rojo: 'Alto' },
  trendsKicker: 'Detective de tendencias',
  trendsTitle: '40 años de clima en la chacra',
  calendarKicker: 'Nueva corónica y buen gobierno · 1615',
  calendarTitle: 'El calendario de Guaman Poma frente a los datos',
  calendarIntro:
    'Para cada mes: qué hacía la comunidad en 1615, qué dicen hoy los datos de la NASA (primeras 15 frente a últimas 15 campañas) y qué hacer cuando el mes se desfasa.',
  calendarWhat: 'Qué hacía la comunidad',
  calendarData: 'Qué dicen los datos hoy',
  calendarAction: 'Qué hacer',
  calendarAlternative: 'Qué sembrar en su lugar',
  calendarSource: 'Página del manuscrito',
  status: { se_desfasa: 'Se desfasa', se_mantiene: 'Se mantiene', informativo: 'Contexto' },
  ndviKicker: 'MODIS NDVI · 250 m',
  ndviTitle: '¿Cuándo está verde la tierra… y cuándo desnuda?',
  ndviIntro: (thr: string) =>
    `Verdor mensual de la vegetación (NDVI) del píxel MODIS de la zona piloto. Por debajo de ${thr} el suelo está desnudo o casi: son los meses con más riesgo de erosión si llueve fuerte.`,
  ndviBare: 'Meses desnudos (reciente)',
  ndviPeak: 'Mes más verde',
  ndviTrend: 'Tendencia del NDVI máximo anual',
  ndviOnlyPilot: 'En este MVP el NDVI se muestra para las 4 zonas piloto.',
  ndviLoading: 'Descargando NDVI MODIS de 2001–2005 y 2021–2025 (solo la primera vez, unos minutos)…',
  rotKicker: 'Field Shift · rotación de cultivos',
  rotTitle: 'Compara rotaciones antes de decidir',
  rotIntro:
    'Un plan para las próximas campañas, evaluado con el clima observado en 2011–2025 en esta parcela. No es un pronóstico. Edita cada año, define tus prioridades y tu suelo.',
  bestNow: (name: string, score: number) => `Hoy la mejor opción según tus prioridades es ${name} (${score}/100).`,
  priorities: 'Tus prioridades',
  prioritiesHelp: '0 = no importa · 3 = muy importante',
  soil: 'Tu suelo',
  texture: 'Textura',
  organic: 'Materia orgánica',
  slope: 'Pendiente de la parcela',
  textures: { arenoso: 'Arenoso', franco: 'Franco', arcilloso: 'Arcilloso' },
  oms: { baja: 'Baja', media: 'Media', alta: 'Alta' },
  slopes: { plana: 'Plana / andén', moderada: 'Moderada', fuerte: 'Fuerte (ladera)' },
  criteria: {
    suelo: 'Suelo (N)',
    plagas: 'Plagas',
    agua: 'Agua',
    helada: 'Helada',
    erosion: 'Erosión',
    forraje: 'Forraje',
    ingresos: 'Ingresos',
  },
  year: 'Año',
  bestOption: 'Mejor opción',
  verdict: { verde: 'Recomendable', ambar: 'Con cuidado', rojo: 'Riesgosa' },
  why: '¿Por qué este puntaje?',
  gaps: 'Vacíos de información',
  risks: 'Riesgos a revisar localmente',
  coverTitle: 'Cobertura del suelo durante el año',
  coverHelp: 'Verde = cubierto por el cultivo · gris = suelo desnudo · franja azul = época de lluvias (nov–mar)',
  context: (alt: string, frost: string, dry: string, rain: string) =>
    `Contexto NASA a ${alt} m: helada en brotación en ${frost} % de campañas recientes · veranillo ≥10 días en ${dry} % · lluvia sep–mar media ${rain} mm.`,
  computing: 'Calculando…',
  weightsLine: 'Pesos según tus prioridades:',
  sourcesKicker: 'Transparencia',
  sourcesTitle: 'Fuentes, supuestos e incertidumbre',
  glossaryTitle: 'Glosario (en palabras sencillas)',
  glossary: [
    ['NDVI', 'Medida satelital de qué tan verde y densa está la vegetación (0 = suelo desnudo, 1 = muy verde).'],
    ['Helada a nivel de planta', 'En noches despejadas la planta está más fría que el aire a 2 m. Restamos unos grados para estimarla.'],
    ['Inicio de lluvias', 'Primer día con al menos 25 mm en 10 días que no va seguido de un veranillo de 10 días.'],
    ['Veranillo', 'Racha de días casi sin lluvia (< 1 mm) en plena época de lluvias.'],
    ['Percentil 20', 'Valor por debajo del cual solo cae el 20 % de los años más secos.'],
    ['Mann-Kendall / pendiente de Sen', 'Pruebas estadísticas que dicen si una serie de 40 años sube o baja de verdad (p < 0,05) y a qué ritmo.'],
    ['Humedad superficial del suelo', 'Qué tan húmedos están los primeros 5 cm del suelo (0 seco, 1 saturado), según un modelo de la NASA.'],
    ['Satélite frente a estación', 'Satélites y modelos ven celdas de ~55 km o píxeles de 250 m; una estación mide un punto. Juntos son mejores.'],
  ],
  footer:
    'LaymiSat · NASA Space Apps Challenge 2026 · Datos: NASA POWER (power.larc.nasa.gov), MODIS MOD13Q1 vía ORNL DAAC, NASA SRTM vía OpenTopoData. Calendario: Felipe Guaman Poma de Ayala, Nueva corónica y buen gobierno (1615). Mapa © OpenStreetMap. Herramienta de apoyo: no sustituye el criterio de la comunidad ni del técnico agrario.',
  aiNote:
    'Uso de IA: el software se escribió con ayuda de un asistente de programación con IA (Claude) a partir del diseño del propio equipo; el análisis usa datos de la NASA y reglas explícitas, no IA generativa.',
}

export const DICTS: Record<Lang, Dict> = { en, es }
export type { Dict }

const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
}

export function monthName(m: number, lang: Lang): string {
  return MONTHS[lang][m - 1]
}

/** Días desde el 1 de agosto → "Sep 23" / "23 sep". */
export function sdayLabel(sday: number, lang: Lang = 'es'): string {
  const d = new Date(Date.UTC(2001, 7, 1) + Math.round(sday) * 86400000)
  const mon = MONTHS[lang][d.getUTCMonth()]
  return lang === 'en' ? `${mon} ${d.getUTCDate()}` : `${d.getUTCDate()} ${mon}`
}

export function fmtNum(n: number | null | undefined, lang: Lang, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toLocaleString(lang === 'en' ? 'en-US' : 'es-PE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function pValue(p: number, lang: Lang): string {
  if (p < 0.001) return lang === 'es' ? 'p < 0,001' : 'p < 0.001'
  const s = p.toFixed(3)
  return `p = ${lang === 'es' ? s.replace('.', ',') : s}`
}
