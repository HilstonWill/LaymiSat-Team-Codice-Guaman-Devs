# LaymiSat: guía del frontend para el equipo

Este documento explica **qué hace cada parte de la pantalla, de dónde salen los datos de la NASA y cómo se calcula cada cosa**, para que el equipo pueda mejorar el frontend sin romper la lógica. Al final están las **tareas pendientes** listas para repartir.

> Estado: v1.1 (15 nov 2026). Bilingüe (inglés por defecto), Field Shift completo, NDVI MODIS y SRTM. Backend: 70 tests, 97 % de cobertura.
> Las tareas F1 (alertas como pregunta), F3 (calendario con acciones) y el glosario ya están hechas; ver la sección 7.

---

## 1. Panorama general

LaymiSat responde tres preguntas de una comunidad altoandina de Cusco (3.200–4.200 m):
**¿cuándo sembrar?, ¿con qué riesgo? y ¿con qué rotación?** Para eso cruza 40 años de datos diarios de **NASA POWER** con el calendario agrícola de **Felipe Guaman Poma de Ayala (1615)**.

```
Navegador (React)  ──►  API FastAPI (/api/...)  ──►  NASA POWER (o caché local en backend/cache/)
     frontend/                backend/app/                  power.larc.nasa.gov
```

- **El navegador nunca llama a la NASA.** Todo pasa por la API.
- La API guarda los datos de cada celda NASA en `backend/cache/`. La demo funciona sin internet para las 4 zonas piloto.

### Cómo ejecutarlo

Necesitas **2 terminales**.

```bash
# Terminal 1: API (Python 3.11+)
cd qullqasat/backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt -r requirements-dev.txt   # Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

```bash
# Terminal 2: frontend (Node 20+)
cd qullqasat/frontend
npm install
npm run dev        # abre http://localhost:5173
```

- Vite redirige `/api` a `http://127.0.0.1:8000`; la configuración está en `vite.config.ts`.
- Si sale el error `10048` o "address already in use", ese puerto ya está ocupado porque el servidor ya está corriendo.
- Tests del backend: `cd qullqasat/backend && .venv/Scripts/python -m pytest --cov=app`
- Compilación del frontend: `cd qullqasat/frontend && npm run build`

---

## 2. Mapa de archivos del frontend

| Archivo | Qué contiene |
|---|---|
| `src/App.tsx` | Estado global (zona, altitud, ajuste de helada, rotaciones), llamadas a la API con *debounce* y cancelación, y orden de las secciones |
| `src/api.ts` | Tipos TypeScript de las respuestas de la API, `fetch` con reintentos y utilidades (`sdayLabel`, `fmt`, `formatP`, `LEVEL_TEXT`, `CRITERIA`) |
| `src/components/MapPicker.tsx` | Mapa Leaflet con las 4 zonas piloto; un clic elige cualquier punto dentro de Cusco |
| `src/components/AlertCards.tsx` | Las 3 tarjetas de alerta (semáforo) |
| `src/components/TrendCharts.tsx` | Los 4 gráficos de Recharts |
| `src/components/CalendarGP.tsx` | Las 12 tarjetas del calendario de Guaman Poma |
| `src/components/RotationComparator.tsx` | Editor de rotaciones y barras de puntaje |
| `src/components/SourcesPanel.tsx` | Fuentes, resolución y límites |
| `src/index.css` | Tokens de color (`--maize`, `--terracotta`, `--potato`…), *layout* responsive y estilos de impresión (`@media print`) |

**Librerías:** React 19, Vite 6, TypeScript, Recharts 2.15, react-leaflet 5 y Leaflet 1.9. Fuentes: Fraunces (títulos) e IBM Plex Sans (texto).

### Contrato con la API

| Método | Ruta | Uso en el frontend |
|---|---|---|
| GET | `/api/zones` | Lista de zonas piloto (selector y mapa) |
| GET | `/api/crops` | Catálogo de cultivos y las 3 rotaciones predefinidas |
| GET | `/api/report?lat&lon&altitude&plant_adjust` | **Todo lo demás**: alertas, series, gráficos, calendario y fuentes |
| POST | `/api/rotations` | Puntaje de cada rotación |

- Los tipos exactos de cada respuesta están en `src/api.ts` (`Report`, `Alert`, `SeriesRow`, `CalendarRow`, `RotationResponse`…).
- La API ajusta cada punto al centro de su celda NASA (0,5° × 0,625°) y redondea la altitud a 50 m y el ajuste de helada a 0,5 °C.
- Solo acepta puntos dentro de la región Cusco: lat −15,5 a −11,0 y lon −73,9 a −70,3.

---

## 3. Datos de la NASA: qué se usa y dónde

Fuente: **NASA POWER**, API diaria por punto, comunidad `AG`, del 1 de enero de 1984 a hoy menos 2 días. Resolución: una celda de unos 55 km (0,5° × 0,625°).

| Variable NASA | Qué es | Dónde se usa en la pantalla |
|---|---|---|
| `T2M_MIN` | Temperatura mínima a 2 m (°C) | Alerta de heladas (AHS), gráfico de helada por altitud, gráfico "Las noches se calientan", calendario, rotaciones (criterio helada) |
| `T2M_MAX` | Temperatura máxima a 2 m (°C) | Calendario (amplitud térmica en abril, Tmax en junio, temperatura media en julio) |
| `PRECTOTCORR` | Lluvia corregida (mm/día) | Alertas AEH y ADS, gráficos de lluvia e inicio de lluvias, calendario, rotaciones (agua y erosión) |
| `GWETTOP` | Humedad del suelo superficial, 0–5 cm (0 a 1) | Alerta AEH (octubre) y calendario (octubre) |
| `RH2M` | Humedad relativa del aire (%) | Se descarga y se menciona en el calendario, **pero hoy no entra en ningún cálculo** |
| `ALLSKY_SFC_SW_DWN` | Radiación solar (MJ/m²/día) | Se descarga y se menciona en el calendario, **pero hoy no entra en ningún cálculo** |

La respuesta de la NASA trae además la **altitud de la celda** (unos 3.740 m en Pisac). Con ella la temperatura se corrige a la altitud de la parcela con **−6,5 °C por cada 1.000 m** de diferencia. La lluvia **no** se corrige.

**Campaña agrícola:** del 1 de agosto (Chacra Yapuy) al 31 de julio. En el código, `sday` significa "días desde el 1 de agosto".

---

## 4. La pantalla, sección por sección

### 4.1 Barra superior (controles)
- **Zona piloto:** Parque de la Papa (Pisac, Calca), Chinchero (Urubamba), Ccatcca (Quispicanchi) y Colquepata (Paucartambo). Las coordenadas y altitudes son aproximadas y hay que validarlas con la Agencia Agraria.
- **Altitud de la parcela (3.200–4.400 m):** recalcula todo a esa altura. Es lo que más cambia el riesgo de helada.
- **Ajuste de helada a nivel de planta (−4 a 0 °C, por defecto −2):** en noches despejadas la planta está más fría que el aire, y la reanálisis de la NASA suaviza esas heladas. Es un **supuesto declarado**; habría que calibrarlo con estaciones SENAMHI.
- **Imprimir ficha:** usa `window.print()` con los estilos `@media print`.

### 4.2 Mapa y ficha de la zona
El mapa usa OpenStreetMap, no datos de la NASA. La ficha muestra 4 cifras:
- **Noches (Tmin media anual):** tendencia en °C por década desde 1984 (`T2M_MIN`).
- **Variabilidad del inicio de lluvias:** cuántos días varía la fecha de inicio entre años, primeras 15 campañas frente a las últimas (`PRECTOTCORR`). **Ojo:** esta tendencia no se repite en todas las zonas (en Ccatcca baja). No usarla como mensaje principal.
- **Helada en brotación:** porcentaje de las últimas 15 campañas con helada en octubre–diciembre (`T2M_MIN`).
- **Ventana de siembra observada:** entre qué fechas empezaron las lluvias firmes en los últimos 10 años; es el rango entre el cuartil inferior y el superior (`PRECTOTCORR`).

### 4.3 Las 3 alertas (semáforo)
Cada alerta responde una pregunta. El color indica el nivel de riesgo: **verde = bajo, ámbar = atención, rojo = alto**. Cada tarjeta muestra el dato que la dispara, qué hacer y su tendencia desde 1984 (pendiente de Sen + prueba de Mann-Kendall; es significativa si p < 0,05).

**AHS: "¿Va a helar cuando brote la papa?"** (octubre a diciembre)
- **Cálculo:** en cada una de las últimas 15 campañas se mira si hubo **2 o más noches seguidas** con la temperatura de la planta a 0 °C o menos. La temperatura de la planta es `T2M_MIN` corregida por altitud más el ajuste (−2 °C).
- **Rojo:** heló en la mitad o más de esos años, o ya hubo un evento de helada en esta campaña.
- **Ámbar:** heló en 20 % a 49 % de los años, o ya hubo alguna noche de helada en esta campaña.
- **Verde:** heló en menos del 20 % de los años.
- **Ejemplo:** Pisac a 3.900 m sale rojo (93 % de los años). A 3.600 m sale verde (7 %).

**AEH: "¿Llovió lo suficiente para sembrar?"**
- **Cálculo:** lluvia acumulada desde el 1 de septiembre hasta hoy (o hasta el 30 de noviembre), comparada con el mismo periodo de cada año de 1991–2020.
- **Rojo:** está en el 20 % de años más secos, **o** la humedad del suelo de octubre está en el 15 % más bajo.
- **Ámbar:** está en el 40 % más seco, **o** hubo veranillos de 10 días o más (diciembre–febrero) en la mitad o más de las campañas recientes.
- **Verde:** lluvia normal o mayor.
- **Antes del 15 de septiembre** se usa la campaña anterior, porque aún no hay suficiente temporada.
- **Ejemplo:** este año van 244 mm, el valor más alto frente a 1991–2020, así que sale verde. Los últimos 90 días son datos provisionales.

**ADS: "¿Las lluvias llegaron cuando dice Guaman Poma?"**
- **Inicio de lluvias:** el primer día desde el 1 de agosto con **25 mm o más en 10 días**, siempre que no haya un veranillo de 10 días en los 40 días siguientes.
- **Referencia:** la siembra general de Coya Raymi, **23 de septiembre** (centro de la 2.ª quincena).
- **Rojo:** desfase de más de 21 días, o ya pasaron más de 21 días sin que lleguen las lluvias.
- **Ámbar:** desfase de 10 a 21 días, o el promedio de la última década supera los 10 días de retraso.
- **Verde:** las lluvias llegaron a tiempo.
- **Si después del 31 de enero no hubo inicio,** la tarjeta dice "no se detectó un inicio firme".
- **Ejemplo:** este año el inicio fue el 30 de septiembre (+7 días), pero el promedio reciente es +26 días, así que sale ámbar.

### 4.4 Gráficos ("40 años de clima en la chacra")
| Gráfico | Qué muestra | Cómo leerlo |
|---|---|---|
| ¿Cuándo empiezan de verdad las lluvias de siembra? | Desfase en días entre el inicio real y el 23 de septiembre, campaña por campaña | La franja dorada es la ventana del códice (16–30 sep). Barra azul: menos de 21 días de desfase. Barra roja: más de 21 días. Barra clara: dato provisional |
| La helada depende de la altitud… | Días de helada en octubre–diciembre por franjas de 200 m, primeras 15 campañas (gris) frente a las últimas 15 (morado) | La línea roja marca la franja de tu parcela. Si la barra morada es menor, hay menos heladas que antes |
| Lluvia de siembra (sep–nov) | Total de cada campaña completa | La línea es el umbral de la alerta AEH. Las barras rojas son años secos |
| Las noches se calientan | Temperatura mínima media de cada año con su línea de tendencia | Pendiente y p-valor en el subtítulo |

### 4.5 Calendario de Guaman Poma
- **12 tarjetas de agosto a julio:** nombre quechua, labor agrícola del códice, la variable NASA con la que se mide y su valor en **1984–1998 frente a 2011–2025**.
- **"Se desfasa":** el indicador empeoró un 15 % o más. **"Se mantiene":** no empeoró tanto. **"Contexto":** dato informativo, sin umbral.
- Los datos salen de `backend/app/data/guaman_poma_calendar.json` y el cálculo está en `backend/app/calendar_gp.py`.

### 4.6 Comparador de rotaciones
- **Las rotaciones son un plan, no una predicción:** son lo que la comunidad *planea* sembrar en las próximas campañas.
- **Cada plan se evalúa con el clima observado** de las últimas 15 campañas (2011–2025), suponiendo que los próximos años se parecerán a los recientes. **No hay ningún modelo que pronostique el clima.**
- **Tres rotaciones predefinidas de 6 años**, todas editables:
  - Laymi completa: papa, oca, cebada y 3 años de descanso.
  - Acortada actual: papa, cebada, papa, avena, papa, cebada.
  - Alternativa: papa, tarwi, oca, haba y 2 años de descanso.
- **Por qué 6 años:** es lo mínimo para ver el descanso de la laymi y la papa repetida de la rotación acortada. El servidor acepta de 2 a 10 años; la pantalla está fija en 6.

**Los 5 criterios (de 0 a 100; verde 70 o más, ámbar 45–69, rojo menos de 45):**

| Criterio | Peso | Qué mide | ¿Usa datos NASA? |
|---|---|---|---|
| Suelo | 25 % | Balance de nitrógeno: las leguminosas y el descanso suman, la papa resta | No |
| Plagas | 20 % | Años entre dos campañas de papa (se recomiendan 4 o más contra el gorgojo y los nematodos) | No |
| Agua | 20 % | Demanda de agua del cultivo frente a la lluvia de septiembre a marzo (70 % aprovechable), más los veranillos | Sí (`PRECTOTCORR`) |
| Helada | 20 % | Probabilidad de helada a tu altitud por la tolerancia de cada cultivo, más su rango de altitud | Sí (`T2M_MIN`) |
| Erosión | 15 % | Meses con suelo desnudo, días con más de 30 mm de lluvia y la pendiente elegida | Sí (`PRECTOTCORR`) |

Los valores de cada cultivo son orientativos, de literatura general, y están en `backend/app/data/crops.json`. Hay que validarlos con el INIA, el CIP o la Agencia Agraria.

### 4.7 Fuentes, supuestos e incertidumbre
Muestra la tabla de variables y su resolución, el origen de los datos (API en vivo o caché) y los límites. **No hay que quitar esta sección:** es parte del criterio de "Validez" del jurado.

---

## 5. Hallazgos con datos reales (para el pitch)

| Hallazgo | Pisac / Chinchero / Colquepata (celda −13,5°, −71,875°) | Ccatcca (celda −13,5°, −71,25°) |
|---|---|---|
| Tendencia de las noches (Tmin media anual) | +0,19 °C/década (p < 0,001) | +0,22 °C/década (p < 0,001) |
| Línea de helada en brotación | Pasa del 7 % de los años a 3.600 m al 67 % a 3.800 m | Pasa del 0 % a 3.600 m al 20 % a 3.800 m |
| Lluvia firme (promedio de la última década) | 19 de octubre; ventana del 26 sep al 13 nov | 7 de octubre; ventana del 26 sep al 12 oct |

**Lo que NO se confirma:** que las lluvias empiecen cada vez más tarde. En 1984–1998 llegaban incluso más tarde. La app lo muestra tal cual.

---

## 6. Puntos a verificar antes de presentar

1. ✅ **Nombres de los meses del códice: VERIFICADOS** con el manuscrito (poma.kb.dk, cap. 37, págs. 1140–1178). Correcciones aplicadas: septiembre = siembra de maíz y papa temprana (mawai); diciembre = siembra de temporal de papa, oca, quinua y tarwi; noviembre = escasez de agua y riego; marzo = Pacha Pucuy; mayo = Hatun Cusqui Aymoray; junio = Haucai Cusqui. Cada tarjeta enlaza su página. (Texto original de este punto, conservado como historial:)
   - Se copiaron de la tabla de la sección 5 del documento del proyecto (.docx). **No se han verificado contra el manuscrito original.**
   - Posibles diferencias que hay que confirmar:
     - Junio: ¿"Haucai Cusqui" en lugar de "Inti Raymi"?
     - Mayo: ¿"Hatun Cuzqui Aymoray"?
     - Marzo: ¿"Pacha Pucuy"?
     - Agosto: ¿es el mes principal de siembra en Guaman Poma?
   - **Fuente primaria:** el manuscrito digitalizado de la *Nueva corónica y buen gobierno* en la Biblioteca Real de Dinamarca (Det Kongelige Bibliotek), capítulos de los meses y de los trabajos agrícolas.
   - Si cambia la fecha de siembra de referencia, hay que actualizar `TRADITIONAL_SOWING_SDAY` y `TRADITIONAL_WINDOW` en `backend/app/alerts.py`, y `guaman_poma_calendar.json`.
2. **Ajuste de helada (−2 °C):** calibrarlo con estaciones SENAMHI de la zona.
3. **Coordenadas y altitudes de las zonas piloto:** validarlas con la Agencia Agraria Cusco (`backend/app/zones.py`).

---

## 7. Tareas para mejorar el frontend (para repartir)

### F1. ✅ Hecho · Alertas en lenguaje de comunidad
- **Archivo:** `AlertCards.tsx`.
- **Cambio:** cada tarjeta empieza con la pregunta ("¿Va a helar cuando brote la papa?"), sigue con la respuesta en una frase y la acción. El detonador, la tendencia y el p-valor van dentro de un `<details>` "Ver detalle técnico".
- **Datos:** no hace falta tocar la API; todo está en `alert.headline`, `alert.action`, `alert.trend` y `alert.metrics`.

### F2. Modo comunidad con gráficos sencillos (prioridad alta)
- **Archivo nuevo:** `SimpleCharts.tsx`.
- **Interruptor** "Vista comunidad / Vista técnica" en `App.tsx`; los 4 gráficos actuales pasan a la vista técnica.
- **Gráficos propuestos:**
  - **¿Cuándo sembrar?** Una barra de calendario (agosto–diciembre) con dos franjas: la del códice (`traditional_sowing.window`) y la observada (`alerts[ADS].metrics.suggested_window`).
  - **¿Hasta qué altura hiela?** Un cerro en franjas de color según `frost_by_altitude[].event_probability_recent`, con un punto en `location.altitude`.
  - **¿Está cambiando el clima?** Tres frases con flecha, a partir de `tmin_trend`, `alerts[AHS].trend` y `alerts[AEH].trend`.

### F3. ✅ Hecho · Calendario con "qué dicen los datos" y acciones
- **Archivos:** `CalendarGP.tsx` y, en el backend, `guaman_poma_calendar.json`.
- **Cambio:** cada tarjeta muestra tres bloques:
  - "Qué hacía la comunidad" (`milestone`).
  - "Qué dicen los datos hoy", una frase generada a partir de `early`, `recent` y `status`.
  - "Qué hacer / qué sembrar en su lugar", solo si `status === 'se_desfasa'`.
- **Propuesta:** añadir al JSON los campos `action_if_shift` y `alternatives` por mes.

| Mes | Si se desfasa… | Acción | Alternativa de cultivo |
|---|---|---|---|
| Septiembre | Pocos años con más de 25 mm en la 2.ª quincena | No sembrar por fecha; esperar la lluvia firme | Primero las parcelas con riego o qochas |
| Octubre | Suelo seco | Cobertura y aporque temprano | Tarwi o quinua (menos agua) |
| Noviembre y enero | Más heladas | Humo y siembra escalonada | Papa amarga (ruk'i) o mashua |
| Diciembre | Veranillos de 10 días o más | Aporque y cobertura | Cultivos de ciclo corto |
| Febrero | Lluvias de más de 45 mm/día | Zanjas de infiltración; no dejar suelo desnudo | Avena o haba (cubren el suelo) |
| Mayo | Más noches de helada | Buen año para hacer chuño | — |

Estas reglas tiene que validarlas un agrónomo antes de la presentación.

### F4. Selector de duración en el comparador (prioridad media)
- **Archivos:** `RotationComparator.tsx` y `App.tsx`.
- **Cambio:** un selector de 3 a 8 años que recorta o rellena las tres secuencias por igual. Para compararlas con justicia, todas deben tener la misma duración. Al rellenar, usar "descanso".
- **Etiqueta visible:** "Plan para las próximas campañas, evaluado con el clima observado de 2011–2025 (no es un pronóstico)".
- **Advertencia:** con 3 o 4 años la laymi pierde su descanso y puntúa peor. Hay que explicarlo en pantalla.

### F5. Rendimiento y carga (prioridad baja)
- El *bundle* pesa unos 836 kB. Separar Recharts y Leaflet con `manualChunks` en `vite.config.ts` o con `React.lazy`.
- Mostrar un *skeleton* mientras carga `/api/report`; la primera vez en una celda nueva tarda unos segundos porque descarga 40 años de datos.

### F6. Accesibilidad y quechua (prioridad baja)
- Textos alternativos en los gráficos (`aria-label` con el resumen).
- Contraste AA en los colores ámbar.
- Opción de textos clave en quechua (hay que validarlos con hablantes de la zona).

---

## 8. Despliegue

- **Backend** (Render/Railway):
  - Comando: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
  - Variables: `LAYMI_CORS_ORIGINS=https://<frontend>` y `LAYMI_PUBLIC_DOCS=0` (oculta `/docs`).
  - Antes de publicar, añadir un límite de peticiones por IP.
- **Frontend** (Vercel): `npm run build` con `VITE_API_URL=https://<backend>`.

## 9. Convenciones

- **Commits:** formato *conventional commits* (`feat(web): …`, `fix(api): …`, `docs: …`).
- **Antes de un PR:** `npm run build` sin errores y `pytest` en verde.
- **Textos de la interfaz:** en español claro, sin jerga. Cada número debe decir de dónde sale.
- **No borrar** los supuestos ni los límites de la pantalla: son parte de la validez científica.
