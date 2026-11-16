# LaymiSat: guía de estilo y experiencia de usuario

Este documento fija **cómo se ve, cómo habla y cómo se comporta** LaymiSat, para que las cinco personas del equipo construyan
secciones que parezcan hechas por una sola mano. Aplica a todo el frontend. La portada y las alertas son la referencia:
cuando dudes, imítalas.

> Archivos clave: `frontend/src/index.css` (tokens y estilos), `frontend/src/components/Icons.tsx` (íconos),
> `frontend/src/i18n.ts` (textos EN/ES), `frontend/src/components/AlertCards.tsx` (componente de referencia).

---

## 1. Para quién diseñamos
- **Usuario principal:** técnico de la Agencia Agraria o de una ONG que asesora a la asamblea comunal. Lee español, a veces en un celular con poca señal y al sol.
- **Usuario final:** familias que siembran papa nativa a 3.200–4.200 m. Muchas no leen gráficos; deciden en asamblea.
- **Jurado de Space Apps:** lee en inglés, en pocos minutos, sin contexto andino.

Por eso cada pantalla debe responder **en 5 segundos** a "¿qué tengo que decidir y qué me dicen los datos?".

## 2. Principios
1. **Pregunta primero.** Cada bloque empieza con la pregunta del agricultor, luego la respuesta corta, y después la evidencia.
2. **Decisión antes que dato.** Lo primero que se ve es qué hacer; la estadística va plegada en "Detalle técnico".
3. **El color nunca va solo.** El estado se expresa con color + texto ("Riesgo alto") + ícono.
4. **Lenguaje sencillo y bilingüe.** Inglés por defecto (regla de Space Apps); español completo; los términos en quechua se explican.
5. **Honestidad visible.** Fuente, periodo y límites siempre a un clic. Si un dato no confirma la hipótesis, se dice.
6. **Celular primero, poca señal.** Sin scroll horizontal, áreas táctiles de 44 px, caché local y ficha imprimible.

## 3. Qué cambió en la portada y las alertas, y por qué
Criterios: las 10 heurísticas de Nielsen, WCAG 2.2 AA y jerarquía visual. Los problemas se midieron en la app y el contraste se calculó con la fórmula WCAG.

| Problema detectado | Heurística / criterio | Cambio aplicado |
|---|---|---|
| La cabecera no decía qué decide el usuario; texto largo y 5 insignias compitiendo | Estética y diseño minimalista | Propuesta de valor en una línea ("Cuándo sembrar, con qué riesgo y con qué rotación…"), subtítulo corto y 3 insignias |
| No había una acción principal: había que adivinar que se debía bajar | Visibilidad del estado / control del usuario | Botón principal "Ver las alertas de esta parcela" (maíz sobre índigo) que lleva a las alertas |
| El "ajuste de helada a nivel de planta" (parámetro técnico) estaba al mismo nivel que zona y altitud | Flexibilidad y eficiencia; revelación progresiva | Se movió a "Avanzado", plegado, con una frase de ayuda |
| Para conocer el riesgo había que bajar hasta las alertas | Reconocer antes que recordar | Resumen "Esta campaña de un vistazo" en la ficha de la zona: 3 chips (ícono + tema + nivel) que llevan a cada alerta |
| La métrica "Variabilidad del inicio de lluvias" era técnica y no se repetía entre zonas | Coincidencia con el mundo real; honestidad | Sustituida por "Altitud de la parcela" (el dato que más cambia el riesgo) |
| La alerta abría con un dato estadístico ("En 93 % de las últimas 15 campañas…") | Coincidencia con el mundo real | Pregunta → **respuesta corta en color** ("Muy probable.") → medidor → evidencia → acción |
| El nivel de riesgo solo se veía en el borde de color y en "Alto/Bajo" | WCAG 1.4.1 (uso del color) | Ícono por tipo de alerta (helada, agua, calendario) + texto + color |
| "Bajo" junto a "Lluvia de siembra" se leía como "llovió poco" | Prevención de errores (ambigüedad) | Etiquetas "Riesgo bajo / Atención / Riesgo alto" |
| No se entendía qué tan cerca estaba el valor del umbral | Visibilidad del estado del sistema | Medidor con relleno y una línea en el umbral de la alerta |
| Verde y ámbar no llegaban a 4,5:1 (3,7 y 3,2) y el gris secundario tampoco (4,0) | WCAG 1.4.3 (contraste AA) | Nuevos tokens `--verde-text`, `--ambar-text` y `--muted` (5,8, 5,5 y 5,4) |
| Los enlaces internos dejaban el título debajo de la barra fija | Visibilidad | `scroll-margin-top: 96px` en secciones y alertas |
| Animaciones sin control | WCAG 2.3.3 (movimiento) | `prefers-reduced-motion` desactiva el desplazamiento suave y la barra de carga |
| Botones y chips pequeños en celular | WCAG 2.5.8 (tamaño del objetivo) | Mínimo 44 px de alto (`--tap`) |

## 4. Tokens de diseño (`index.css › :root`)
**No uses colores, tamaños ni sombras sueltos: usa estos tokens.** Si falta uno, se añade aquí y en `:root`, con acuerdo del equipo.

### Color
| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#1f2a44` | Texto principal, botón oscuro |
| `--ink-soft` | `#4a5570` | Texto secundario largo |
| `--muted` | `#5c6378` | Metadatos, etiquetas pequeñas (contraste 5,4:1) |
| `--paper` | `#f7f2e8` | Fondo de página |
| `--card` | `#fffdf8` | Fondo de tarjetas |
| `--line` | `#e4dccb` | Bordes y divisores |
| `--night` | `#16203a` | Fondo de la cabecera |
| `--maize` | `#e0a43a` | Acento: botón principal, foco, acciones |
| `--terracotta` | `#b8532f` | Etiquetas de sección (kicker), "Qué hacer", líneas de umbral |
| `--potato` | `#6b3d7a` | Quechua y datos recientes en gráficos |
| `--leaf` | `#3f7d4e` | Cobertura del suelo y vegetación |
| `--sky` | `#3d6fa8` | Enlaces, datos de lluvia |
| `--verde` / `--verde-bg` / `--verde-text` | `#2f8a4c` / `#e3f2e6` / `#23683a` | Riesgo bajo: relleno / fondo / **texto** |
| `--ambar` / `--ambar-bg` / `--ambar-text` | `#b7790f` / `#fbf0d6` / `#855800` | Atención |
| `--rojo` / `--rojo-bg` / `--rojo-text` | `#b3361f` / `#f9e2db` / `#b3361f` | Riesgo alto |

Regla: **el texto de estado usa `--*-text`**. `--verde` y `--ambar` son solo para rellenos (barras, medidores, bordes).

### Tipografía
| Rol | Fuente | Tamaño |
|---|---|---|
| Marca, títulos de sección (h1, h2) | Poppins 600 | h1 2,2rem · h2 1,55rem |
| Pregunta de alerta, títulos de tarjeta (h3) | Poppins 600 | 1,1–1,2rem |
| Respuesta corta (veredicto) | Poppins 700 | 1,35rem, en el color del nivel |
| Texto | Poppins 400 | 1rem (mínimo 0,85rem) |
| Etiquetas pequeñas (kicker, `cal-label`, `action-label`) | Poppins 600–700, MAYÚSCULAS, espaciado 0,08–0,12em | 0,68–0,72rem |
| Metadatos (`meta`, `meter-label`) | Poppins 400 | 0,75–0,8rem, `--muted` |

### Espacio, forma y profundidad
- **Espaciado:** múltiplos de 4 px (4, 8, 12, 16, 24, 34). Entre tarjetas, 16 px; dentro de una tarjeta, 18 px de padding.
- **Radios:** tarjetas 14 px (`--radius`), controles y chips 10 px, píldoras y barras 999 px.
- **Sombra:** solo `--shadow`, en tarjetas.
- **Área táctil:** mínimo 44 px de alto (`--tap`) en botones, chips y desplegables.
- **Cortes de diseño:** ≤1000 px pasa a una columna; ≤560 px es móvil (chips apilados, botón principal a todo el ancho).

## 5. Componentes
| Componente | Clase | Cuándo usarlo |
|---|---|---|
| Botón principal | `.btn.btn-cta` | Una sola acción principal por pantalla (p. ej. "Ver las alertas") |
| Botón | `.btn` | Acción importante en barras (fondo `--ink`) |
| Botón secundario | `.btn.btn-secondary` | Acciones de apoyo (Imprimir) |
| Tarjeta | `.card` | Todo bloque de contenido |
| Píldora de nivel | `.pill.verde/.ambar/.rojo` | Nivel de riesgo junto a un título |
| Chip de resumen | `.summary-chip.<nivel>` | Acceso rápido a una alerta desde la portada |
| Medidor | `Meter` en `AlertCards.tsx` | Mostrar un valor frente a un umbral (relleno + línea de umbral + texto) |
| Dato destacado | `.fact` dentro de `.facts` | Cifra clave con su etiqueta arriba |
| Etiqueta de sección | `.kicker` | Línea pequeña sobre un título (contexto: provincia, fuente, temporada) |
| Bloque de acción | `.action` + `.action-label` | "Qué hacer", siempre con borde de maíz a la izquierda |
| Detalle técnico | `<details className="tech">` | Umbral, tendencia, p-valor, fórmulas: siempre plegado |
| Error | `.error` y `SectionBoundary` | Error de carga o de una sección; nunca dejes la página en blanco |

### Anatomía de una tarjeta de alerta (orden fijo)
1. **Ícono** del tema (46 px, fondo del nivel) y **píldora** con el nivel ("Riesgo alto").
2. **Pregunta** del agricultor (h3).
3. **Veredicto**: respuesta en 2–6 palabras, en el color del nivel ("Muy probable.").
4. **Medidor** con la línea del umbral y una frase que la explica.
5. **Evidencia**: la cifra concreta con periodo y fuente (`headline`).
6. **Qué hacer**: acción en imperativo.
7. **Detalle técnico** plegado: detonador, tendencia y p-valor.

El orden de las alertas es fijo (helada, agua, calendario). No se reordenan por gravedad, para que la persona usuaria las reconozca siempre en el mismo sitio.

### Alertas dinámicas (debajo de las 3 tarjetas)
| Pieza | Regla de UX |
|---|---|
| **Simulador "¿Y si siembro el…?"** | Un solo control (deslizador de fecha); arranca en la fecha de hoy; la respuesta (Buena fecha / Fecha riesgosa / Muy temprano) cambia al instante, con `aria-live`. La ventana recomendada va en verde si cumple los umbrales y en ámbar si no, explicando por qué. Las líneas punteadas de maíz marcan las fechas del códice. |
| **Próximos 7 días** | Una tira de 7 días con ícono (gota o copo) y la Tmin a nivel de planta; las noches con helada en fondo rojo y con texto oculto para lectores. Si no hay internet, aviso y nada roto. Siempre se dice que la fuente no es la NASA. |
| **Formato de la respuesta de IA** | Siempre 3 secciones en este orden: **Qué hacer ahora** (2–3 viñetas que empiezan con verbo), **Por qué** (1–2 frases) y **Ten en cuenta** (1 viñeta sobre la incertidumbre). Lo pide el prompt y lo dibuja `AiText.tsx`: los títulos van en versalitas moradas con una línea, las viñetas con un punto de color maíz y las negritas son reales. Nunca se muestran `*` ni `#`, y nunca se usa `innerHTML`. |
| **IA en cada alerta** | Botón-píldora "✦ Explicar esta alerta con IA" entre "Qué hacer" y "Detalle técnico". Explica solo esa alerta (como máximo 70 palabras), se abre y se cierra sin volver a consultar, y se reinicia al cambiar de parcela. Solo aparece si el servidor tiene un proveedor de IA activo. |
| **Animación de escritura** | La respuesta aparece palabra por palabra con un cursor parpadeante (≈ 14 palabras/s, como máximo ~5 s en total) y un enlace "Mostrar todo ya". El texto animado es `aria-hidden`; los lectores de pantalla reciben el texto completo una sola vez. Con `prefers-reduced-motion` aparece completo y sin cursor. Solo se anima el texto generado: nunca las cifras ni las alertas, que deben verse al instante. |

### Recorrido del MVP: primero la respuesta, después el detalle
| Sección | Regla de UX |
|---|---|
| **¿A qué altura hiela?** | Justo después de las alertas, el único gráfico de tendencias que responde una pregunta nueva. Arriba va una frase: "Tu parcela (3.900 m) está en la franja de 3.800 m: hoy hay X días de helada… A 3.600 m o menos casi no hiela". |
| **Evidencia de 40 años** | Los otros 3 gráficos (inicio de lluvias, lluvia sep–nov, noches) van plegados bajo "Ver la evidencia: 40 años de datos de la NASA". Las alertas ya muestran su tendencia. |
| **Rotaciones · antes y después** | Arriba, "Tu rotación actual" (preset `acortada`) frente a la "Mejor opción", con la diferencia de puntaje (+42) y en etiquetas lo que mejora (verde, las 3 mayores) y lo que se cede ("A cambio", rojo). Si la actual ya es la mejor, se dice. Siempre con la nota "puntajes orientativos… no predicen la cosecha". |
| **Línea de cultivos** | Cada secuencia es una franja de 6 bloques coloreados por familia: papa (morado), otros tubérculos (lila), granos (maíz), leguminosas (verde), descanso/purum (rayado). Se ve sin leer que la actual repite papa y que la alternativa mete leguminosas y descanso. Cada bloque tiene el nombre completo para lectores de pantalla. |
| **Rotaciones** | Primero 3 tarjetas de resultado: secuencia en una línea, puntaje con color, "Fuerte en / Débil en" (tomado de los puntajes, ≥ 70 y < 45). Las prioridades, el suelo, los 18 selectores, las barras, la cobertura del suelo, los riesgos y los vacíos de información van en "Personalizar mi rotación" (plegado). |

### Modo agricultor y modo técnico (`App.tsx`, `FarmerViews.tsx`)
Un interruptor **Agricultor | Técnico** en la portada (junto a EN/ES). Por defecto se abre en **Agricultor**; la elección se guarda en `localStorage` (`laymisat-mode`). Con `?modo=tecnico` o `?full=1` se abre en Técnico (útil para los jueces).

| Modo agricultor (ver poco, decidir rápido) | Solo en modo técnico |
|---|---|
| Mapa + "Mi ubicación" (la altitud se lee, no se ajusta) | Control de altitud y "Avanzado" (ajuste de helada) |
| Tarjeta **"¿Qué hago ahora?"**: color del peor semáforo, título corto, la acción de esa alerta y "Mejores días para sembrar" | Las 4 cifras de la ficha (°C/década, % de campañas…) y la nota de la celda NASA POWER |
| 3 chips de semáforo | Insignias, subtítulo y nombre del reto en la portada |
| 3 alertas en modo `simple`: pregunta, veredicto, medidor y "Qué hacer" (sin titular con cifras ni "Detalle técnico") | Titular con cifras y "Detalle técnico" de cada alerta |
| **Qué sembrar**: la mejor rotación en pasos numerados (1 → 2 → …), una etiqueta ("Buena opción") y un solo "Ojo:" | ¿A qué altura hiela?, calendario de Guaman Poma, evidencia de 40 años, comparador completo y fuentes |

Reglas: en modo agricultor, **una sola acción por tarjeta**, nada de unidades técnicas y como máximo 3 colores con significado (verde, ámbar, rojo). Toda sección nueva entra primero en modo técnico; pasa a modo agricultor solo si responde "¿qué hago?" en una frase. "Ver la comparación completa" cambia a Técnico y baja hasta el comparador.

### Modo Historia (`src/story/`, `?historia=1`)
Pantalla aparte para la demo, que se carga en diferido desde `main.tsx` y no comparte componentes con la app (su CSS solo se carga ahí). Se entra con `?historia=1` (o `?demo=1`) o con "Ver la historia de 40 años" en el modo técnico.
- **Escena:** terreno 3D (satélite + SRTM) con una capa `color-relief` que pinta de hielo todo lo que queda por encima de la **línea de helada de esa campaña** (`/api/story`: la altitud más baja con un evento de helada en oct–dic, misma regla que AHS). Mientras se reproduce, la cámara orbita despacio, salvo con `prefers-reduced-motion`.
- **Tarjeta de la campaña** (arriba a la izquierda): año, el día en que llegó la lluvia firme frente a Coya Raymi (rojo > 21 días, ámbar > 7), desde qué altitud heló y si heló en la chacra.
- **Línea de tiempo** (abajo): reproducir/pausa, 1×/2×/4×, deslizador y 3 minigráficos sincronizados (retraso de la lluvia, Tmin anual, línea de helada con la altitud de la chacra punteada). Al hacer clic en un gráfico se salta a esa campaña.
- **Panel lateral:** momentos clave calculados de los datos (lluvia más tardía y más temprana, primavera más seca, helada más baja, hoy), la leyenda y la nota de estimación.
- **Final:** un resumen con 4 cifras y una conclusión ("un calendario fijo ya no alcanza"), que lleva a la app.
- **Regla:** la historia solo cuenta lo que muestran los datos. En Pisac la línea de helada **no sube** (3.793 → 3.790 m); lo que cambia es que las noches son más cálidas y que la fecha de la lluvia varía muchísimo. No se debe narrar "la helada sube".

### Rueda del año andino (`CalendarGP.tsx`)
| Pieza | Regla de UX |
|---|---|
| **Forma** | Los 12 meses del códice en una rueda (el tiempo andino es cíclico), de agosto (Chacra Yapuy, arriba) a julio. Abre en el mes actual, marcado con un punto por fuera del anillo y "Hoy" en el centro. |
| **Color = veredicto** | Verde = se mantiene, rojo = empeoró, ámbar = no coincide (la condición del códice se da en menos de la mitad de los años, antes y ahora), beige = contexto (indicador neutral). Leyenda y resumen ("5 se mantienen · 1 empeoró…") debajo. |
| **Detalle en 3 líneas** | *Guaman Poma escribió* (con enlace a la página del manuscrito) → *La NASA mide hoy* (etiqueta "Mejor/Peor/Casi igual que antes" + cifra simple: "4 de 15 años; antes 2 de 15") → *Qué hacer* (y "O sembrar en su lugar" si empeoró o no coincide). Lo técnico (unidades, periodos, variables) va plegado en "Detalle técnico". |
| **Escenario andino** | La rueda va sobre un fondo de noche andina (azul `--night`) con la misma franja textil de la portada arriba y abajo. Por fuera, un anillo **tocapu** (48 rombos en maíz, terracota, morado papa y verde) y un anillo de **estaciones** (lluvias nov–mar, transición abr/oct, seca may–sep). En el centro, la **chakana** (cruz andina escalonada) en contorno maíz, y un **Inti** (sol) que gira despacio marca el mes de hoy. Todo es decorativo (`aria-hidden`): el significado está en la leyenda. |
| **Movimiento** | Al cargar, los meses aparecen uno a uno (55 ms entre cada uno), como si la rueda girara; el mes elegido brilla con un borde blanco. Con `prefers-reduced-motion` no hay animaciones. Al imprimir, fondo blanco y sin franjas. |
| **La pregunta del mes** | El detalle abre con la pregunta del agricultor según el indicador ("¿Faltará el agua?", "¿Llega la lluvia para sembrar?"), con su ícono (sol, copo, gota, termómetro) y la respuesta en una frase armada con los mismos números del gráfico ("Peor que antes: 4 de cada 15 años con veranillo de 10 días o más (antes, 2)"). Si el mes no coincide con el códice, la respuesta empieza con "Rara vez". Después van "Qué hacer" y, más pequeño, lo que escribió Guaman Poma. Los 15 puntos son pictogramas del fenómeno. |
| **Rueda con avisos** | Leyenda de 3: se mantiene, "Ojo: cambió o no coincide" y contexto. Los meses que empeoraron o no coinciden llevan un "!" sobre la rueda. El anillo de estaciones se explica en una línea, sin leyenda propia. |
| **Dato NASA como gráfico** | En el detalle, "La NASA mide hoy" compara **Antes (1984–1998)** y **Hoy (2011–2025)**: si el indicador es "% de años", dos filas de 15 puntos (cada punto una campaña, los rellenos cumplen la condición; cuentan campañas, no siguen su orden); si es días, mm o °C, dos barras a la misma escala. La fila de hoy toma el color del veredicto (rojo peor, verde mejor, azul puna igual). Debajo, la fuente exacta: la variable NASA POWER que de verdad usa el cálculo (se deriva del indicador, no del JSON) y si se corrigió por altitud (solo las temperaturas). |
| **Sin ruido** | Un cambio cuenta solo si supera el 15 % relativo **y** un mínimo absoluto (0,5 días/mes, 10 puntos de % de años, 0,3 °C). Así 0,0 → 0,1 días no se presenta como cambio. |
| **Accesibilidad** | Cada mes es un botón (`role=button`, `aria-pressed`, etiqueta "Noviembre, Aya Marcay Quilla: Empeoró"); flechas ←/→, Inicio y Fin cambian de mes; el detalle se anuncia con `aria-live`. Botones ‹ › de 40–44 px. En pantallas < 860 px la rueda va arriba y el detalle debajo. |

### Mapa 3D y panel de la parcela (`Map3D.tsx`)
| Pieza | Regla de UX |
|---|---|
| **Motor** | MapLibre GL 5, cargado con `lazy()` en su propio chunk. Si el equipo no tiene WebGL, se usa el mapa 2D de Leaflet (`MapPicker.tsx`). No usa API keys. |
| **Intro** | Se abre en el globo y vuela unos 5 s hasta la parcela (pitch 60°, rumbo −25°). Al terminar pasa a mercator, porque en el globo no se dibujan bien las columnas ni los pines sobre el relieve. Con `prefers-reduced-motion` no hay vuelo: abre directo en la vista final. |
| **Relieve** | Terreno Terrarium (AWS Open Data, incluye SRTM) con exageración ×1,6 y sombreado. El botón **2D** quita el relieve y la inclinación; **Recentrar** vuelve a la parcela. |
| **Capas NASA** | Control segmentado: **Satélite** (Esri), **NDVI · MODIS** (8 días) y **Temp. superficie · MODIS** (8 días), las dos desde NASA GIBS con la última imagen disponible y opacidad 0,72. Cuando hay una capa NASA activa se muestra la etiqueta "NASA GIBS · última imagen disponible". No uses productos diarios: en los Andes suelen salir vacíos por las nubes. |
| **Columnas 3D** | Cada zona piloto es una columna color maíz cuya altura depende de la altitud. La parcela activa es una columna más fina y alta con el color de su peor alerta (verde, ámbar o rojo), más un pulso blanco. |
| **Pines** | Son `<button>` reales, con `aria-label` ("Seleccionar Chinchero, 3760 m") y `aria-pressed`. La etiqueta va a la derecha del punto para no tapar la columna, y la zona activa va en color maíz. |
| **Panel flotante** | En pantallas de más de 1000 px, la ficha de la parcela es un panel de vidrio esmerilado sobre el mapa, a la derecha. En pantallas menores pasa debajo del mapa como una tarjeta normal. Las cifras (altitud y % de helada) se animan con `CountUp` (0,9 s, sin animación con movimiento reducido). |
| **Rueda del ratón** | No hace zoom hasta que el usuario hace clic en el mapa, y deja de hacerlo al salir del mapa, para no "atrapar" el scroll de la página. |
| **De dónde sale el clima** (`PowerCellNote.tsx`) | Al final de la ficha, un recuadro con borde punteado indica el tamaño y el centro de la celda NASA POWER (≈ 56 × 68 km), su altitud media, la corrección por altitud y el ajuste de planta, y deja claro que **ninguno está calibrado** con una estación en tierra. Si varias zonas piloto comparten la celda, lo dice. Nunca se presenta el clima como si fuera medido en la parcela. |

### Punto personalizado (`CustomPointCard.tsx`)
| Pieza | Regla de UX |
|---|---|
| **Invitación** | Mientras no haya un punto propio, el mapa muestra la pista "Haz clic en cualquier punto del terreno para analizarlo", con un punto maíz que late. El cursor es una cruz. |
| **Título humano** | Nunca se usan coordenadas como título. Si el punto está a 25 km o menos de una zona piloto, se titula "Cerca de {zona}"; si no, "Punto elegido en el mapa". |
| **Coordenadas** | Van en una línea aparte, en monoespaciada y con hemisferio (13,646° S · 71,855° O), junto a un botón **Copiar** que confirma con "✓ Copiado" (y lo anuncia en `aria-live`). |
| **Terreno · NASA SRTM 30 m** | Bloque verde con 3 fichas: altitud real, pendiente (perfil inclinado dibujado a escala, con los grados y la clase) y zona piloto más cercana (km + rumbo), con el botón "Ir a {zona} →". Mientras se lee SRTM se muestran esqueletos con brillo; si falla, se dice en una frase qué hacer. |
| **Altitud fuera de rango** | Si la altitud real cae fuera del rango que cubre la herramienta (3.200–4.400 m, el del deslizador; no es un rango calibrado), se explica qué altitud usa el análisis. Nunca se corrige en silencio. |
| **Análisis desactualizado** | Desde el clic hasta que llega el nuevo análisis, el semáforo, las cifras y el texto se atenúan (opacidad 0,45 y menos saturación) y aparece "Actualizando el análisis…" con un spinner (`role=status`). Así nunca se ven cifras del punto anterior como si fueran del nuevo. |
| **En el mapa** | El punto lleva una etiqueta terracota "Tu punto · 4.130 m" y la columna 3D con el color de su peor alerta. Si el clic cae fuera de Cusco, aparece durante 3 s el aviso rojo "Fuera del área de estudio…" en lugar de no hacer nada. Por debajo del zoom 8,5 las etiquetas se ocultan para que no se amontonen. |

## 6. Íconos
- Trazo de 2 px, cuadrícula de 24×24, `currentColor`, extremos redondeados. Están en `components/Icons.tsx`.
- Siempre llevan `aria-hidden`: el significado lo dan el texto y la etiqueta, no el dibujo.
- Correspondencia fija: **helada = copo**, **agua = gota**, **calendario = calendario**, ubicación = pin, imprimir = impresora.
- No uses emojis ni logos de la NASA (regla de Space Apps).

## 7. Voz y tono
| Regla | Sí | No |
|---|---|---|
| Pregunta en lenguaje del agricultor | "¿Va a helar cuando brote la papa?" | "Alerta de heladas severas (AHS)" |
| Veredicto corto, de 2 a 6 palabras | "Sí, a tiempo." | "La desviación es inferior al umbral" |
| Acción en imperativo, verbo primero | "Siembra con lluvias firmes…" | "Se recomienda considerar…" |
| Cifras con periodo y fuente | "93 % de las últimas 15 campañas (NASA POWER)" | "Muchas heladas" |
| Nivel como riesgo | "Riesgo bajo" | "Bajo" (ambiguo) |
| Términos técnicos explicados o en el glosario | "veranillo (días seguidos casi sin lluvia)" | "dry spell ≥10 d" sin explicar |
| Paridad EN/ES | Mismo contenido en los dos idiomas | Texto solo en un idioma |

Los textos viven en `i18n.ts` (ver las reglas de prefijos en `docs/EQUIPO.md`), nunca escritos directamente en un componente.

## 8. Accesibilidad (checklist WCAG 2.2 AA)
- [ ] Contraste de texto ≥ 4,5:1 (≥ 3:1 en texto grande ≥ 24 px o negrita ≥ 19 px). Usa los tokens `--*-text`.
- [ ] El estado no depende solo del color (texto + ícono).
- [ ] Todo se puede usar con teclado; el foco se ve (contorno maíz de 3 px).
- [ ] Áreas táctiles ≥ 44 px.
- [ ] Los gráficos y medidores tienen `aria-label` con la conclusión, no solo los números.
- [ ] `lang` del documento correcto (`en`/`es`); la app lo actualiza al cambiar de idioma.
- [ ] Las actualizaciones de las alertas se anuncian (`aria-live="polite"`).
- [ ] Se respeta `prefers-reduced-motion`.
- [ ] Sin scroll horizontal a 375 px.

## 9. Estados
| Estado | Cómo se muestra |
|---|---|
| Cargando | Barra fina bajo los controles y el texto "Cargando 40 años de datos de la NASA…". No bloquees la página. |
| Error de red/API | `.error` con el motivo y qué hacer; los datos anteriores no se quedan como si fueran de otro lugar. |
| Error de una sección | `SectionBoundary` muestra un aviso solo en esa sección. |
| Sin datos (p. ej. NDVI fuera de las zonas piloto) | Tarjeta con una frase que explica por qué y qué sí se puede ver. |
| Datos provisionales | Mención explícita ("últimos 90 días, provisionales"). |

## 10. Impresión
La ficha impresa (`@media print`) oculta controles, mapa, botones y resumen. Muestra la cabecera con zona, altitud y fecha, las alertas, los gráficos y las fuentes. Debe caber en 1–2 páginas A4/Carta.

## 11. Cómo añadir una sección o una alerta nueva sin romper el estilo
1. Empieza por la **pregunta** del usuario y escribe el texto en `i18n.ts` (EN y ES).
2. Usa una `.card` dentro de una `<section>` con `.section-head` (kicker + h2 + frase de contexto).
3. Respeta el orden pregunta → respuesta → evidencia → acción → detalle técnico plegado.
4. Usa solo tokens y componentes de esta guía; si necesitas uno nuevo, añádelo aquí.
5. Envuélvela en `SectionBoundary`.
6. Pasa el checklist de accesibilidad (sección 8) y prueba a 375 px y en los dos idiomas.
7. Adjunta capturas antes/después en el Pull Request.
