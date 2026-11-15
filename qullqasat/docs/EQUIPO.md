# LaymiSat: reparto del equipo y reglas de trabajo

Objetivo: que cada persona mejore **su sección** sin pisar el trabajo de las demás y sin perder la dirección del proyecto.
Lee antes la [guía del frontend](GUIA_FRONTEND.md) (qué hace cada parte) y el [checklist de Space Apps](CUMPLIMIENTO_SPACE_APPS.md).

**Cierre de la entrega: domingo 15 de noviembre, 23:59 (hora del evento local).** Todo lo que se quiera mostrar debe estar en `main` y desplegado antes.

---

## 1. Quién hace qué

| Sección en la app | Responsable | Rama de trabajo |
|---|---|---|
| Portada (cabecera, barra de controles, mapa y ficha de la zona) + **3 alertas** | **Cristian** | `feat/portada-alertas` |
| **Calendario de Guaman Poma** | **Yaqui** | `feat/calendario` |
| **Compara rotaciones antes de decidir** | **Will** | `feat/rotaciones` |
| **Detective de tendencias** (4 gráficos + NDVI) | **Raúl y Jennifer** | `feat/tendencias` (pueden crear subramas `feat/tendencias-<tema>`) |

### Archivos de cada responsable
Cada persona puede editar libremente los archivos de **su** fila. Si necesita tocar un archivo de otra fila, lo avisa en el grupo y lo pide a su responsable.

| Responsable | Frontend (`qullqasat/frontend/src/`) | Backend (`qullqasat/backend/app/`) |
|---|---|---|
| Cristian | `App.tsx` (cabecera, controles, sección superior, orden de secciones), `components/MapPicker.tsx`, `components/AlertCards.tsx` | `alerts.py`, `i18n.py` (textos de alertas), `zones.py`, `terrain.py` |
| Yaqui | `components/CalendarGP.tsx` | `calendar_gp.py`, `data/guaman_poma_calendar.json` |
| Will | `components/RotationComparator.tsx` | `rotations.py`, `data/crops.json` |
| Raúl y Jennifer | `components/TrendCharts.tsx`, `components/NdviPanel.tsx` | `analysis.py`, `ndvi.py`, `service.py` (series y helada por altitud) |

### Archivos compartidos (con cuidado)
| Archivo | Regla |
|---|---|
| `frontend/src/i18n.ts` | Cada texto va en **inglés y en español**. Añade tus claves nuevas **al final** de cada diccionario (`en` y `es`) con tu prefijo: `hero*`/`alert*` (Cristian), `cal*` (Yaqui), `rot*` (Will), `trend*`/`ndvi*` (Raúl y Jennifer). No reordenes ni borres claves ajenas. |
| `frontend/src/index.css` | Añade tus estilos **al final**, bajo un comentario con tu sección, p. ej. `/* --- calendario (Yaqui) --- */`. No cambies los colores de `:root` sin avisar. |
| `frontend/src/api.ts` | Solo añade campos nuevos a los tipos; no cambies ni borres los existentes. |
| `backend/app/main.py` | Endpoints nuevos: avisa en el grupo. Lo integra Cristian. |
| `backend/tests/` | Cada uno añade tests para lo suyo, en el archivo de su área o en uno nuevo `test_<area>.py`. |

---

## 2. Tareas sugeridas por persona
Prioriza lo que suba la nota del jurado (Impacto, Creatividad, Validez, Relevancia y Presentación, de 1 a 5 cada uno).

**Cristian · portada y alertas**
- [ ] Portada: mensaje de una línea sobre qué decide el agricultor y un botón "Ver mi parcela" que lleve a las alertas.
- [ ] Alertas: ícono grande por pregunta y el color también en el texto, no solo en el borde (accesibilidad).
- [ ] Botón "Compartir por WhatsApp" con el resumen de las 3 alertas, en texto plano.
- [ ] Revisar la ficha imprimible (`Print sheet`): que quepa en 1–2 páginas.
- [ ] Desplegar (Render + Vercel) y poner la URL en `docs/SUBMISSION.md`.

**Yaqui · calendario**
- [ ] Revisar con el manuscrito (enlace "Manuscript page" de cada tarjeta) que el texto de cada mes sea fiel. Ya se verificó la base; falta pulir la redacción.
- [ ] Validar las acciones y los cultivos alternativos con un agrónomo o la Agencia Agraria. Si no hay tiempo, marcar "por validar".
- [ ] Vista de "rueda" o línea de agosto a julio que resalte el mes actual.
- [ ] Nombres de los meses en quechua con su significado (el manuscrito los da entre corchetes).

**Will · rotaciones**
- [ ] Selector de duración (3 a 8 años) que recorte o rellene las tres secuencias por igual (tarea F4 de la guía).
- [ ] Preajustes de prioridades: "Cuidar el agua", "Mejorar el suelo", "Más ingresos", "Forraje para el ganado".
- [ ] Revisar con fuentes los valores de `crops.json` (agua, nitrógeno, tolerancia a la helada) y citarlas.
- [ ] Texto de una línea bajo la mejor opción: por qué gana en lenguaje sencillo.

**Raúl y Jennifer · detective de tendencias**
- [ ] Vista sencilla para la comunidad (tarea F2): barra "¿Cuándo sembrar?" (ventana observada frente al códice), "cerro" de helada por altitud y tres frases con flecha (↑ noches más templadas…).
- [ ] Mover los 4 gráficos técnicos a un desplegable "Ver datos técnicos".
- [ ] NDVI: mostrar el hallazgo de Chinchero (más meses de suelo desnudo) cuando esa zona esté elegida.
- [ ] Opcional: temperatura nocturna de la superficie (MODIS LST) para validar las heladas (ver la sección 5).

---

## 3. Cómo trabajar (paso a paso)
```bash
git checkout main
git pull                                  # trae lo último
git checkout -b feat/<tu-rama>            # o "git checkout feat/<tu-rama>" si ya existe
# ... trabaja ...
git add <tus archivos>
git commit -m "feat(web): descripción corta"
git pull --rebase origin main             # trae los cambios de los demás antes de subir
git push -u origin feat/<tu-rama>
```
Luego abre un **Pull Request** en GitHub hacia `main`. Otra persona del equipo lo revisa y lo aprueba antes de fusionarlo.

**Antes de abrir el PR (definición de "terminado"):**
- [ ] `npm run build` y `npm run lint` sin errores (en `qullqasat/frontend`).
- [ ] `pytest` en verde si tocaste el backend (en `qullqasat/backend`).
- [ ] Textos nuevos en **inglés y español**.
- [ ] Probado en la app, también con ancho de celular (sin scroll horizontal).
- [ ] Nada de datos personales, fotos de menores de 18 años ni logos de la NASA.
- [ ] Si usaste IA para generar código, imágenes o textos, añádelo a `qullqasat/AI_DISCLOSURE.md`.

**Commits:** formato `tipo(área): descripción`. Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`. Áreas: `web`, `api`, `data`.

**Frecuencia:** haz `git pull` de `main` al empezar y cada pocas horas, y PRs pequeños y frecuentes (mejor 3 PRs chicos que 1 gigante a última hora).

---

## 4. Lo que NO se cambia sin acuerdo del equipo
- El reto elegido (**Field Shift**) y el nombre **LaymiSat**.
- Los datos y umbrales de las alertas (`alerts.py`), salvo acuerdo y con su test.
- El panel de **fuentes y límites** y la **declaración de IA**: son parte de la nota de Validez y de las reglas.
- Que la app abra en **inglés** por defecto (regla de Space Apps).

---

## 5. Ideas de valor extra (inspiradas en el proyecto ganador Queñaris, 2025)
Queñaris (Arequipa) ganó combinando datos NASA con trabajo de campo real, varios índices satelitales, IA explicativa y un plan concreto de implementación. Para LaymiSat, en orden de valor/esfuerzo:

| Idea | Quién | Esfuerzo |
|---|---|---|
| **Temperatura nocturna de la superficie (MODIS LST, NASA)** para comprobar las heladas con un segundo dato satelital, por el mismo servicio ORNL ya usado | Raúl y Jennifer | Medio |
| **Compartir la ficha por WhatsApp** (texto simple, funciona con poca señal) | Cristian | Bajo |
| **Palabras clave en quechua** en alertas y calendario (validar con hablantes) | Yaqui + Cristian | Bajo |
| **Impacto cuantificado y plan piloto** en el pitch (familias, hectáreas, variedades de papa, fecha de validación con una comunidad) | Todo el equipo | Bajo |
| **Asistente con IA que explique la ficha** en palabras sencillas (solo re-explica los resultados calculados; declararlo) | Will | Medio |
