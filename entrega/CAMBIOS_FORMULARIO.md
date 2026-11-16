# Cambios para el formulario (editar en la plataforma con tu cuenta)

Todo en inglés. Solo se cambia lo indicado; el resto de la página ya está bien.

## 1. Space Agency Partner & Other Data (hoy dice "El sitio de Guaman Poma", en español)

Reemplazar por entradas en inglés (Link Text + URL):

- Link Text: `Guaman Poma de Ayala, Nueva corónica y buen gobierno (1615), Royal Danish Library (GKS 2232 4º)`
  URL: `https://poma.kb.dk`
- Link Text: `Open-Meteo weather forecast API (not NASA data)`
  URL: `https://open-meteo.com`
- Link Text: `OpenTopoData (access to SRTM elevation)`
  URL: `https://www.opentopodata.org/datasets/srtm/`

Nota: "Space Agency Partner data" son datos de otras agencias espaciales (p. ej. ESA). Ninguna se usa hoy,
así que estas entradas van como "Other Data". Open-Meteo solo si el pronóstico de 7 días sigue en la app;
en el README está oculto (features.ts). Si no se ve en la app, NO la pongas.

## 2. Project Details: línea que exagera (sección "What exactly does it do?")

Hoy: "Compares today's climate with the Andean agricultural calendar of Guaman Poma de Ayala (1615) to show how far rains and frosts have shifted over the centuries."

Poner:
> Compares today's climate with the Andean agricultural calendar of Guaman Poma de Ayala (1615), month by month, to show where the traditional calendar still matches NASA data and where it does not.

Motivo: el README dice que el retraso del inicio de lluvias no se confirmó; no afirmar "cuánto se desplazaron".

## 3. Project Details: añadir lo que pide el reto (soil, crops, farmer priorities)

Añadir una viñeta al final de "What exactly does it do?":
> Lets each family set its own priorities (soil nitrogen, pests, water, frost, erosion, forage, income) and describe its plot (soil texture, organic matter, slope). The rotation planner then compares at least three strategies, including the traditional laymi, with goal-by-goal scores, a month-by-month soil-cover timeline, and the information gaps and risks that need local review.

Y en "How does it work?", cambiar el paso de vegetación por:
> Vegetation analysis: MODIS NDVI shows when the land is green and when it is bare (2001–2005 vs 2021–2025), which feeds the soil-cover timeline and the erosion risk of each rotation.

## 4. Project Details: herramientas (añadir lo que falta)

Reemplazar la línea "Software and design: The interface was built with React and CSS." por:
> NASA and open map data: NASA GIBS (MODIS NDVI and land-surface-temperature layers), Esri World Imagery and AWS/Mapzen terrain tiles for the 3D map, OpenStreetMap contributors.
> Development assistance: the source code was written with AI assistance (Anthropic Claude, via Claude Code), directed and reviewed by the team.

## 5. Campo de uso de IA (si el formulario lo tiene)

> Yes. The source code, tests and documentation were written with the help of an AI coding assistant (Anthropic Claude, via Claude Code), directed and reviewed by the team. The idea, problem analysis and design (alerts, use of Guaman Poma's calendar, pilot communities) come from the team's own project document. The voice-over of the project video was generated with AI (ElevenLabs text-to-speech) from a script written by the team; the video was built with AI assistance (Claude Code). An optional runtime button uses a configurable LLM (Google Gemini, Groq or xAI Grok) only to rewrite already-computed results in plain language, labelled as AI-generated. No generative AI produces any alert, score or recommendation: all results come from NASA data and explicit rules. No AI-generated images or video are used; all screens are real captures of the app. Details in AI_DISCLOSURE.md in the repository.

## 6. Referencias / créditos (si hay campo)
- ElevenLabs (text-to-speech narration)
- Foto del campo de papa: AUTOR / FUENTE (falta; completar o quitar la foto)

## Ya verificado (no tocar)
- Proyecto, demo y repo: laymisat.vercel.app y GitHub responden 200.
- Video de YouTube público y con título correcto.
- Slides de Google: abren sin iniciar sesión.
- NASA Data: POWER, MODIS/ORNL, SRTM y GIBS, todo coincide con el código.
- Calendario circular: la pestaña Calendario usa la rueda (CalendarGP).
- Pisac a 3,900 m es el lugar por defecto de la app. La cifra "9 de 10" no la recalculé: ábrela en la app y confirma que dice 9/10 (el video también la usa).
