# LaymiSat: checklist de cumplimiento NASA Space Apps 2026

Fuentes oficiales (leídas el 14 nov 2026):
- Project Submission Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Judging & Awards Guide: https://www.spaceappschallenge.org/resources/judging-awards-guide/
- Reto Field Shift: https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/
- Reto Trend Detective: https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/

Leyenda: ✅ cumple · ⚠️ parcial · ❌ falta

**Cierre: domingo 15 de noviembre, 23:59, hora del Local Event.** Hasta entonces se puede editar y reenviar las veces que haga falta; los jueces solo ven la última versión guardada.

---

## A. Requisitos de elegibilidad (si falla uno, el proyecto no pasa a Global Judging)

| # | Requisito oficial | Estado | Qué hacer |
|---|---|---|---|
| A1 | Responder a **un** reto oficial | ✅ | Los dos retos existen en 2026, pero se presenta a uno. **Recomendado: "Field Shift: Adapting Farms with NASA Data"** (ver sección C). |
| A2 | **Todo en inglés**: la página del proyecto **y todos los materiales enlazados** (repositorio, app, diapositivas). Un video puede estar en otro idioma, **con subtítulos en inglés** | ✅ app y README · ⚠️ video/slides | La app, el README y los docs están en español. Hay que hacer la app bilingüe con inglés por defecto (y español a un clic), un README en inglés, y las diapositivas o subtítulos en inglés. |
| A3 | Demo: **video de 30 s o menos** o **7 diapositivas como máximo** (incluidas título e intro). **Si se excede, no hay Global Judging** | ❌ | `docs/DEMO.md` describe una demo en vivo de 2 minutos: solo sirve para el evento local. Para la entrega, hacer el video de 30 s con subtítulos en inglés **o** 7 diapositivas en inglés. |
| A4 | Enlaces **públicos, sin login ni permisos** (demo y proyecto final) | ❌ | Repositorio público en GitHub y app desplegada (Vercel + Render). Probar los enlaces en una ventana privada. |
| A5 | Completar **todos los campos obligatorios** del formulario | ⚠️ | Textos listos en inglés en `docs/SUBMISSION.md`; falta pegarlos en el portal y poner los enlaces. |
| A6 | Todos los miembros (6 como máximo) registrados en el **mismo Local Event**, sin lista de espera, y en la pestaña Members | ⚠️ | Confirmarlo en la web. Ya no se pueden añadir miembros después del cierre. |
| A7 | Marcar "Terms and Conditions" y "Confirm All Work is Original" | ⚠️ | Exige que **todas las referencias** (código, texto, imágenes, aunque sean libres) estén en el campo References (ver D8). |
| A8 | Ninguna imagen, video ni audio de **menores de 18 años** | ✅ | Cuidarlo en el video y las fotos de campo. |
| A9 | Pulsar **"Submit for Judging"** antes del cierre | ❌ | Guardar a menudo; activar el "Lock" para no pisarse entre compañeros. |

## B. Uso de Super Intelligence (SI / IA)

| # | Regla oficial | Estado | Qué hacer |
|---|---|---|---|
| B1 | Indicar dónde y cómo se usaron herramientas de SI | ✅ | El código lo generó un asistente de IA (Claude Code) a partir del diseño del equipo. Declararlo en el README y en el campo SI del formulario. |
| B2 | **Código y datos generados con SI**: reconocerlo "in descriptive text and metadata" | ✅ `AI_DISCLOSURE.md`, README y pie de la app | Añadir una sección "AI disclosure" en el README, el archivo `AI_DISCLOSURE.md` y una línea en `package.json` / cabecera de los módulos. |
| B3 | **Imágenes y video generados con SI**: marca de agua visible. Audio: reconocerlo en texto y metadatos | ⚠️ | Si se generan imágenes o voz con IA para la demo, ponerles marca de agua o una nota. |
| B4 | La SI **no** debe usarse para idear la solución del reto | ✅ | La idea y el diseño (árbol de problemas, Guaman Poma, alertas) vienen del documento del equipo. Explicarlo en B1. |
| B5 | El contenido generado no puede usar, contener ni modificar **marcas de la NASA** (logos, banderas, insignias de misión) | ✅ | La app no usa logos de la NASA; el ícono es propio. No añadir el logo de la NASA ni en la app ni en el video. |

## C. Encaje con el reto Field Shift (pesa en "Relevance" y "Validity")

Texto del reto: *"a decision-support tool that uses NASA Earth observations along with **local soil information, crop characteristics, and farmer priorities** to help farmers explore rotation strategies…"*

| # | Lo que pide el reto | Estado | Qué hacer |
|---|---|---|---|
| C1 | Observaciones de la Tierra de la NASA | ✅ | NASA POWER (T2M_MIN/MAX, PRECTOTCORR, GWETTOP). Opcional: SRTM para la pendiente y la altitud reales, GPM IMERG para lluvia a mayor resolución. |
| C2 | **Información local del suelo** | ✅ textura, materia orgánica y pendiente (SRTM) | Hoy solo hay pendiente. Añadir un formulario de suelo (textura, materia orgánica, pH, profundidad) que modifique los criterios de suelo, agua y erosión. |
| C3 | **Características de los cultivos** | ✅ | `crops.json` (agua, N, helada, cobertura, altitud). Falta el valor forrajero y de mercado. |
| C4 | **Prioridades del agricultor** (ahorrar agua, ingresos, forraje, suelo, erosión) | ✅ 7 controles de prioridad | Hoy los pesos están fijos. Añadir controles de prioridad que cambien los pesos del comparador. |
| C5 | Comparar **al menos 3 estrategias, incluida la actual** | ✅ | Laymi completa, acortada (la actual) y alternativa con tarwi/haba. |
| C6 | Para cada estrategia: **por qué se sugiere, evidencia, beneficios, vacíos de información y riesgos** que requieren revisión local | ✅ | Hay "razones" por criterio. Faltan bloques explícitos de "vacíos de información" y "riesgos a revisar localmente". |
| C7 | Señalar **cuándo el campo queda desnudo** y **qué temporadas son más vulnerables** | ✅ línea de tiempo de cobertura + NDVI MODIS | Está implícito en erosión y en el calendario. Añadir una línea de tiempo anual por rotación. |
| C8 | Interrumpir ciclos de plagas, reducir la demanda de agua, mejorar la infiltración | ✅ | Criterios de plagas, agua y erosión. |
| C9 | Explicar términos científicos (evapotranspiración, anomalías de humedad, NDVI, riesgo de helada) | ✅ glosario | Añadir un glosario corto en lenguaje sencillo. |
| C10 | Diferencia entre satélite y medición en tierra | ✅ | Panel "Límites que debes conocer". |
| C11 | Diseño **pensado para el agricultor**: fácil de interpretar | ✅ alertas como pregunta, calendario con acciones | Tareas F1 y F2 de `GUIA_FRONTEND.md` (alertas en lenguaje simple y vista comunidad). |
| C12 | Recordar que **apoya y no reemplaza** el criterio local | ✅ | Presente en el pie de página, el panel de límites y las rotaciones. |

> Si el equipo prefiere **Trend Detective**: ese reto pide que el usuario **elija variables**, vea **dónde** cambian (en un mapa, no en un solo punto), cuánto cambian y si es significativo. Hoy las variables son fijas y el análisis es de un punto, así que el encaje es menor.

## D. Campos del formulario (redactar en inglés)

| # | Campo | Contenido propuesto |
|---|---|---|
| D1 | Project Name | LaymiSat |
| D2 | High-Level Project Summary | Qué es, cómo responde a Field Shift y por qué importa (papa nativa, Guaman Poma, NASA POWER). |
| D3 | Link to Project Demo | Video de 30 s o menos (subtítulos en inglés) **o** 7 diapositivas como máximo, en enlace público. |
| D4 | Link to Final Project | La app desplegada, o el repositorio público de GitHub. |
| D5 | Detailed Project Description | Qué hace, cómo funciona, beneficios, objetivos y herramientas (Python, FastAPI, pandas, React, Recharts, Leaflet). |
| D6 | Use of SI | Ver la sección B. El texto es para recolección de datos; los jueces **no** lo ven, pero sí ven las marcas en el proyecto. |
| D7 | NASA Data | NASA POWER Daily API (MERRA-2): T2M_MIN, T2M_MAX, PRECTOTCORR, GWETTOP, RH2M, ALLSKY_SFC_SW_DWN; 1984 → presente; resolución 0,5° × 0,625°. **Obligatorio al menos un recurso NASA para optar a premios globales.** |
| D8 | Space Agency Partner Data and Other References | Guaman Poma (1615), OpenStreetMap, Leaflet, React, Recharts, FastAPI, pandas, NumPy, Google Fonts (Poppins) y las fuentes agronómicas de `crops.json`. Se valora usar datos de agencias socias (p. ej. **ESA** Sentinel-2 para NDVI, **CONAE** de Argentina). |

## E. Cómo se evalúa

Cada criterio se puntúa **de 1 a 5**, con el mismo peso:
- **Impact**
- **Creativity**
- **Validity**: incluye usabilidad y facilidad de uso.
- **Relevance**: los datos NASA deben ser el núcleo, no un adorno.
- **Presentation**: la demo + el proyecto completo. La guía insiste en dedicarle tiempo a la historia.

Premios globales a los que encaja LaymiSat: **Local Impact Award**, **Best Use of Data**, **Best Storytelling Award** y **Best Use of Science**.

Fechas: nominados globales el 3 dic 2026, finalistas el 17 dic 2026, ganadores el 26 ene 2027.

## F. Recomendaciones opcionales

- Pedir la clasificación de la web en el FortiGuard Web Filter (categoría "web-based application", Company: "N/A") para que los filtros de los jueces no bloqueen la app.
- Las imágenes del formulario pueden subirse directamente (JPG, PNG o GIF de hasta 10 MB); los videos y documentos, solo por enlace.

---

## Plan sugerido hasta el cierre

| Orden | Bloque | Ítems | Por qué |
|---|---|---|---|
| 1 | Elegibilidad | A2 (inglés), B1–B2 (declaración de SI), A4 (GitHub público + despliegue) | Sin esto no hay evaluación global. |
| 2 | Relevancia para Field Shift | C4 (prioridades), C2 (suelo), C6 (vacíos y riesgos), C7 (línea de tiempo del suelo desnudo) | Es lo que el reto pide explícitamente y hoy falta. |
| 3 | Usabilidad | C11 (F1/F2), C9 (glosario) | Validity incluye la facilidad de uso. |
| 4 | Demo y formulario | A3 (video de 30 s o 7 diapositivas), D1–D8, A7 | Presentation vale lo mismo que los otros cuatro criterios. |
| 5 | Verificación final | Enlaces en ventana privada, "Submit for Judging" | Antes de las 23:59 del domingo. |
