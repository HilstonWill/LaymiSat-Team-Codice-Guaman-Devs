# LaymiSat

**Agro-climate decision support for native-potato farmers in the high Andes of Cusco, Peru.**
NASA Space Apps Challenge 2026 · Challenge: **Field Shift: Adapting Farms with NASA Data**. *(Versión en español: [README.es.md](README.es.md))*

LaymiSat reads 40 years of daily **NASA POWER** data (1984 → today), **MODIS NDVI** and **NASA SRTM** elevation
alongside the 1615 Andean farming calendar of **Felipe Guaman Poma de Ayala**, to answer what a high-Andean community
decides every season: *when to sow, with what risk, and with which crop rotation?*

> **Laymi** is the Andean communal rotation system: each year potatoes are planted in one sector, then other crops,
> and the land rests for several years (purun). LaymiSat tests it against satellite data.

## For reviewers: please read before testing

**Live demo:** https://laymisat.vercel.app

> ⏳ **The first load can take up to ~1 minute.** The API runs on **Render's free plan**, which puts the server to
> sleep after ~15 minutes without traffic. The first request wakes it up (about 30–60 s); the app shows a
> **"Waking up the server…"** notice meanwhile and retries on its own. After that, everything responds in a few
> seconds. If you ever see an error, wait a minute and reload: it is the server waking up, not a bug.

**Suggested 3-minute tour** (all on one screen over the 3D terrain):
1. **Zones** — the 4 pilot communities with their traffic light on the map; tap one.
2. **Today** — what to do this season: sowing window, the 3 alerts (tap to expand) and the best crop rotation.
3. **Rotations** — the Field Shift planner: pick today's rotation, your plot and goals, get a recommendation with a goal-by-goal comparison, and share the plan.
4. **Calendar** — the 1615 Guaman Poma calendar month by month: then → today (NASA data) → what to do.
5. **40 years** — the story of 40 seasons on the terrain (plays on its own).

Shortcuts: `?demo=1` opens the 40-year story · `?vista=rotaciones` opens the planner · `?modo=tecnico` opens the full
technical view (all figures, trends, frost by altitude, the full rotation comparator and sources/limits).

## What it does
> **MVP view.** The main screen shows only what answers the problem (Zones, Today, Rotations, Calendar, 40 years).
> The technical view (`?modo=tecnico`) keeps every figure. The NDVI panel, the sowing-date simulator, the 7-day
> forecast and the AI explanations are hidden (not removed); open the technical view with `?full=1` to see them
> (`frontend/src/features.ts`).

| Feature | Detail |
|---|---|
| 3 traffic-light alerts | **AHS** frost at potato sprouting · **AEH** water stress at sowing · **ADS** shift between the Coya Raymi sowing date and the real rainy-season onset |
| Trend detective | Mann-Kendall + Sen slope on frost days, Sep–Nov rainfall, rain onset and annual Tmin |
| Frost by altitude | Frost risk by 200 m bands (3,200–4,400 m), first vs last 15 seasons |
| Land cover (MODIS NDVI) | Monthly greenness and bare-soil months of the pilot-zone pixel |
| 1615 calendar | The 12 months of the codex, each measured with its NASA variable, with actions and alternative crops |
| Rotation comparator (Field Shift) | ≥3 strategies incl. the current one; **farmer priorities** (soil, pests, water, frost, erosion, forage, income), **local soil** (texture, organic matter, slope), soil-cover timeline, **information gaps and risks** for local review |
| Terrain | Click the map: altitude and slope from NASA SRTM 30 m |
| Sowing-date simulator | Move a date: share of the last 15 seasons with firm rains already started and with frost while the potato sprouts; recommended window at the plot's altitude |
| 7-day forecast | Frost nights and rain for the coming week (Open-Meteo), corrected to plot altitude and plant level |
| AI explanation (optional) | Google Gemini rewrites the computed results in plain language; grounded, labelled and rate-limited (see AI_DISCLOSURE.md) |
| Bilingual | English (default) and Spanish |

### Findings with real data
- Nights are warming: annual mean Tmin **+0.19 °C/decade** (Pisac cell) and **+0.22 °C/decade** (Ccatcca cell), Mann-Kendall p < 0.001.
- The **frost line** at sprouting sits between **3,600 and 3,800 m** (7 % → 67 % of seasons).
- At 3,600 m the sowing simulator's best date is **early December**, matching Guaman Poma's rain-fed sowing month (Capac Inti Raymi); at 3,900 m no date is frost-safe.
- In Pisac the firm rains arrive on average on **Oct 19**, within a **7-week window** (Sep 26 – Nov 13): later than the codex's early sowing (September) and well before its rain-fed sowing (December).
- MODIS NDVI (2001–2005 vs 2021–2025): Pisac and Colquepata are greener today, while **Chinchero now has bare-soil months from July to November** (NDVI < 0.30), i.e. more erosion risk when the rains start.
- Not confirmed: a significant delay of the rainy-season onset. The app shows this as it is.

## Run locally
Step-by-step setup (Windows, macOS, Linux), checks and troubleshooting: see the **[repository README](../README.md#getting-started-for-contributors)**.

Short version: API in `backend/` with `python -m uvicorn app.main:app --port 8000`, web app in `frontend/` with `npm run dev`, then open http://localhost:5173.

Station calibration (SENAMHI): `python -m app.calibration station.csv --lat -13.40 --lon -71.85 --altitude 3850`.

## NASA data used
- **NASA POWER Daily API** (MERRA-2): T2M_MIN, T2M_MAX, PRECTOTCORR, GWETTOP (+ RH2M, ALLSKY_SFC_SW_DWN as context), 1984 → present, 0.5° × 0.625°.
- **MODIS MOD13Q1 NDVI** (250 m, 16-day) via the NASA ORNL DAAC web service.
- **NASA SRTM** 1 arc-second (30 m) via OpenTopoData.

## Method and assumptions
Season Aug 1 → Jul 31 · lapse rate −6.5 °C/km · plant-level frost = 2 m Tmin −2 °C (adjustable, calibrate with stations) ·
rain onset = first ≥25 mm in 10 days not followed by a 10-day dry spell · traditional window = Coya Raymi, Sep 16–30 ·
crop values are indicative (`backend/app/data/crops.json`) · rotations are a plan scored with the observed 2011–2025 climate, **not a forecast** ·
Guaman Poma is a qualitative cultural baseline, checked against the manuscript (Royal Danish Library, ch. 37, pp. 1140–1178): September (Coya Raymi) is the early sowing of maize and potato (*mawai*), December (Capac Inti Raymi) the sowing of potato, oca, quinoa and rain-fed maize (p. 1174; tarwi is not named there).

## AI disclosure
See [AI_DISCLOSURE.md](AI_DISCLOSURE.md).

## Documents
- Submission kit (form texts, 7-slide outline, 30-s video script): [docs/SUBMISSION.md](docs/SUBMISSION.md)
- Team guides (Spanish): [docs/GUIA_FRONTEND.md](docs/GUIA_FRONTEND.md), [docs/CUMPLIMIENTO_SPACE_APPS.md](docs/CUMPLIMIENTO_SPACE_APPS.md), [docs/DEMO.md](docs/DEMO.md)

## Credits and license
NASA POWER Project (NASA LaRC), MODIS (NASA LP DAAC / ORNL DAAC), NASA SRTM, OpenTopoData, NASA GIBS, Esri World Imagery, AWS Terrain Tiles (Mapzen), OpenStreetMap, MapLibre GL, Leaflet, React, Recharts,
FastAPI, pandas, NumPy, Google Fonts (Poppins). Guaman Poma de Ayala, *Nueva corónica y buen gobierno* (1615). MIT License.
