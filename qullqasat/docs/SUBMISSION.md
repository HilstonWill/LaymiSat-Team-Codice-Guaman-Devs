# LaymiSat: NASA Space Apps 2026 submission kit (English)

Copy-paste drafts for the official Project Submission form, plus the 7-slide deck outline and the 30-second video
script. Everything here is in English, as required. Replace `<…>` with the real links before submitting.

**Challenge:** Field Shift: Adapting Farms with NASA Data
**Deadline:** Sunday, November 15, 11:59 p.m. (local time of the team's Local Event). Click **Submit for Judging**.

---

## 1. Project Name
LaymiSat

## 2. High-Level Project Summary
LaymiSat is a bilingual (English/Spanish) decision-support web tool for native-potato farming communities in the
high Andes of Cusco, Peru (3,200–4,200 m). It combines 40 years of daily NASA POWER climate data, MODIS NDVI and NASA
SRTM elevation with local soil information, crop characteristics and farmer priorities, so that communities and
extension agents can compare crop-rotation strategies, including the traditional *laymi* communal rotation, before
deciding. It turns NASA data into three plain-language alerts (frost at sprouting, water stress at sowing, and the
shift between the 1615 farming calendar of Guaman Poma de Ayala and today's rains), a soil-cover timeline and
transparent rotation scores with information gaps and risks for local review. It matters because frost, erratic rains
and shortened rotations are eroding soils and native-potato diversity, while the data that could help rarely reach
the people who decide.

## 3. Link to Project Demo
`<public link to the 30-second video (English subtitles) or to the 7-slide deck>`

## 4. Link to Final Project
`<public URL of the deployed app>` · Code: `<public GitHub repository URL>`

## 5. Detailed Project Description
**What it does**
- **Plot selection:** pick a pilot community or click any point in Cusco. Altitude and slope are read from NASA SRTM.
- **Three traffic-light alerts, each phrased as a farmer's question:**
  - *Will it freeze when the potato sprouts?* (≥2 consecutive plant-level frost nights in Oct–Dec)
  - *Has it rained enough to sow?* (Sep–Nov rainfall below the 1991–2020 20th percentile, or October surface soil wetness below P15)
  - *Did the rains arrive when Guaman Poma's calendar says?* (rainy-season onset more than 21 days after the codex's early sowing)
- **Trend detective:** Mann-Kendall + Sen slope on 40 years of frost days, sowing rainfall, rain onset and night temperature, plus frost risk by 200 m altitude band.
- **MODIS NDVI:** when the land is green and when it is bare, 2001–2005 vs 2021–2025.
- **The 1615 calendar:** the 12 months of Guaman Poma's *Nueva corónica* (checked against the manuscript, pages cited), each measured with its NASA variable, with actions and alternative crops when a month has shifted.
- **Field Shift rotation comparator:**
  - Compares at least three strategies, including the current shortened rotation, the traditional laymi and a legume-based alternative.
  - Every year is editable.
  - Scores seven criteria (soil nitrogen, pests, water, frost, erosion, forage, income) weighted by the farmer's own priorities.
  - Takes the farmer's soil texture and organic matter into account.
  - Shows a month-by-month soil-cover timeline, the reasons behind each score, information gaps and risks that need local review.
- **Printable community sheet** and a transparency panel (sources, resolution, assumptions, limits, glossary).

**How it works**
- **Backend:** Python (FastAPI, pandas, NumPy) downloads and caches NASA POWER daily data for the 0.5° × 0.625° cell and corrects temperature to the plot altitude (−6.5 °C/km).
- **Analysis:** explicit, documented rules and classical statistics compute the alerts, trends, calendar indicators and rotation scores.
- **Frontend:** React + TypeScript (Recharts, Leaflet).
- **Tests:** 70 automated backend tests, 97 % coverage.
- **SENAMHI calibration:** a command-line tool calibrates the frost adjustment against a SENAMHI ground station.

**Benefits:** turns open NASA data into decisions a community assembly can discuss (when to sow, which rotation, where
frost hits), respects and tests ancestral knowledge instead of replacing it, and is honest about uncertainty: it shows
what the data do *not* confirm.

**What we hope to achieve:** validation with the Cusco regional agricultural agency and the Potato Park communities,
calibration with SENAMHI stations, and a Quechua interface.

**Tools:** Python 3, FastAPI, pandas, NumPy, pytest; React 19, TypeScript, Vite, Recharts, Leaflet; OpenStreetMap tiles.

## 6. Use of Super Intelligence (SI)
Yes. The source code, tests and documentation were written with the help of an AI coding assistant (Anthropic Claude,
via Claude Code), directed and reviewed by the team. The idea, problem analysis and design (alerts, use of Guaman Poma's
calendar, pilot communities) come from the team's own project document. No generative AI produces any alert, score or
recommendation: all results come from NASA data and explicit rules. No SI-generated images, video or audio are used;
if any are added they will carry a visible watermark. Details in `AI_DISCLOSURE.md` in the repository.

## 7. NASA Data
- **NASA POWER Daily API** (MERRA-2 based):
  - Variables: T2M_MIN, T2M_MAX, PRECTOTCORR, GWETTOP, plus RH2M and ALLSKY_SFC_SW_DWN as context.
  - Coverage: 1984 to present, 0.5° × 0.625°.
  - Use: frost, rainfall, soil wetness, trends, calendar indicators and rotation water/frost/erosion scores.
- **MODIS MOD13Q1 NDVI** (Terra, 250 m, 16-day), via the NASA ORNL DAAC MODIS web service: vegetation greenness and bare-soil months.
- **NASA SRTM** 1 arc-second (30 m) elevation, via OpenTopoData: plot altitude and slope class.

## 8. Space Agency Partner Data and Other References
- Felipe Guaman Poma de Ayala, *Nueva corónica y buen gobierno* (1615), ch. 37, pp. 1140–1178, GKS 2232 4º, Royal Danish Library, https://poma.kb.dk
- OpenStreetMap contributors (map tiles), OpenTopoData (SRTM access)
- Open-source software: FastAPI, pandas, NumPy, httpx, pytest, React, Vite, Recharts, Leaflet, react-leaflet
- Fonts: Fraunces and IBM Plex Sans (Google Fonts, SIL Open Font License)
- Indicative crop parameters compiled from general Andean agronomy literature (FAO, CIP, INIA); to be validated locally
- No Space Agency Partner data used yet. Next step: ESA Sentinel-2 for 10 m vegetation maps.

---

## 7-slide deck outline (max 7 slides, English)
1. **Title:** LaymiSat · team name · team members · challenge *Field Shift: Adapting Farms with NASA Data*.
2. **The problem:** frost at sprouting, erratic rains and shortened rotations in Cusco's native-potato highlands (one photo, no people under 18).
3. **Our idea:** NASA data + the 1615 Andean calendar + the community's own priorities → plain-language decisions.
4. **Demo screenshot 1:** the three alerts as farmer questions, and the frost-line chart (3,600 → 3,800 m).
5. **Demo screenshot 2:** the rotation comparator: priorities, soil, cover timeline, best option, risks and gaps.
6. **NASA data that made it possible:** POWER (40 years daily), MODIS NDVI, SRTM; key findings (+0.19 °C/decade nights, frost line, rain window Sep 26 – Nov 13).
7. **What's next:** validation with the agricultural agency and communities, SENAMHI calibration, Quechua interface, ESA Sentinel-2.

## 30-second video script (spoken in Spanish or English, English subtitles required)
| Time | Image | Subtitle |
|---|---|---|
| 0:00–0:02 | Team name on screen | "We are <team name>, from Cusco, Peru." |
| 0:02–0:05 | Highland potato fields | "Frost and erratic rains are changing how Andean farmers must plan their crops." |
| 0:05–0:10 | Logo + tagline | "LaymiSat: NASA data meets the 1615 Andean farming calendar." |
| 0:10–0:20 | Screen recording: alerts → frost line → rotation comparator | "Forty years of NASA POWER, MODIS and SRTM data turn into plain-language alerts and rotation choices, weighted by each farmer's own priorities." |
| 0:20–0:30 | Community assembly / map of Cusco | "So communities can decide when to sow and how to rotate, protecting their soil and their native potatoes." |

Rules: 30 seconds or less, English subtitles, no NASA logos, no images of people under 18, any SI-generated media watermarked.
