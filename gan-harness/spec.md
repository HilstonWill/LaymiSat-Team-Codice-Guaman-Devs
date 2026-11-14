# QullqaSat — Spec MVP (derivado del SDD "Proyecto NASA Space Apps 2026 - QullqaSat.docx")

Reto: "Be An Earth System Trend Detective!" + "Field Shift: adaptando cultivos con datos NASA".
Usuario principal: técnico de agencia agraria / ONG que asesora a comunidades altoandinas de Cusco
(3.200–4.200 m s. n. m.) productoras de papa nativa.

## Decisiones fijadas (Gate 1)
- Stack: FastAPI (Python) + React/Vite/TypeScript, Recharts, Leaflet.
- Datos: solo NASA POWER (diario, 1984 → hoy; T2M_MIN, T2M_MAX, PRECTOTCORR, RH2M,
  ALLSKY_SFC_SW_DWN, GWETTOP). NDVI/Google Earth Engine fuera del MVP (siguiente paso).
- Corrección por altitud: gradiente térmico declarado (6,5 °C/km) entre la elevación de la celda POWER
  y la altitud de la parcela.
- Guaman Poma (1615) es una línea base cualitativa, no una equivalencia numérica.
- Todo en español; incertidumbre y límites siempre visibles. Nada de predicción de rendimientos.

## Slices verticales
- S1 Zona → datos POWER (caché) → Alerta de Heladas (AHS: ≥2 días seguidos con Tmin ≤ 0 °C en oct–dic)
  + tendencia Mann-Kendall / pendiente de Sen + riesgo de helada por banda de altitud.
- S2 Alerta de Estrés Hídrico (AEH: lluvia sep–nov < P20 de 1991–2020; veranillos ≥10 días dic–feb;
  humedad superficial GWETTOP) + calendario Guaman Poma (12 meses, JSON).
- S3 Alerta de Desfase Ancestral (ADS: inicio de lluvias observado vs ventana Coya Raymi, >21 días).
- S4 Comparador de rotaciones (laymi completa / acortada / con tarwi-haba / personalizada) con reglas
  explícitas: suelo (N), plagas, agua, helada, erosión → semáforo.
- S5 Ficha imprimible por comunidad, panel de fuentes/resolución/incertidumbre, mapa, README.

## Criterios de aceptación
1. Elegir zona piloto (o coordenadas dentro de Cusco + altitud) y ver las 3 alertas con semáforo,
   explicación en lenguaje sencillo y el dato que la dispara.
2. Ver la serie 1984–hoy con tendencia y su significancia (p-valor) para heladas, lluvia sep–nov
   e inicio de lluvias.
3. Ver el calendario de Guaman Poma con lo observado (línea base vs década reciente) por mes.
4. Comparar ≥2 rotaciones y entender por qué una puntúa mejor (reglas trazables).
5. Imprimir/guardar la ficha. Ver fuentes y límites.
6. La app funciona sin red si los datos de las zonas piloto están en caché.
