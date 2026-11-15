# Product Lens: el MVP de LaymiSat se siente lleno

Fecha: 15 nov 2026 · Skill `ecc:product-lens` (Mode 3: recorrido del usuario + Mode 4: priorización ICE).
Medido en la app real (escritorio 1366 × 860, Parque de la Papa, 3.900 m, vista MVP sin `?full=1`).

## 1. Diagnóstico en una línea
La página tiene **un buen hilo (problema → evidencia → qué hacer)**, pero lo cuenta **dos veces** en varios sitios y cierra con la sección más larga de todas, que casi nadie lee. El problema no es que sobren funciones: es **repetición + texto que se queda abierto**.

## 2. Lo que mide hoy la página

| Bloque | Alto (px) | Palabras visibles | Papel |
|---|---:|---:|---|
| Portada | 331 | 86 | Qué es |
| Controles (zona, altitud) | 92 | 17 | Elegir parcela |
| Mapa + ficha | 640 | 219 (ficha: 187) | Dónde estoy + resumen |
| 3 alertas | 607 | 217 | **La solución (núcleo)** |
| ¿A qué altura hiela? | 600 | 91 | Evidencia nueva |
| Rueda de Guaman Poma | 801 | 143 | **El problema (diferenciador)** |
| Evidencia 40 años (plegada) | 160 | 26 | Prueba para el jurado |
| Rotaciones | 776 | 211 | **Requisito del reto** |
| **Fuentes, supuestos e incertidumbre** | **1.114** | **410** | Credibilidad |
| **Total** | **≈ 5.210 (≈ 6 pantallas)** | **≈ 1.400** | |

**Hallazgos:**
1. **La sección más larga es la que menos se lee:** "Fuentes…" ocupa el 21 % del alto y el 29 % de las palabras.
2. **La ficha repite a las alertas:** semáforo de las 3 alertas + 4 datos + un párrafo de Guaman Poma (que ya cuenta la rueda) + la nota de la celda NASA = 187 palabras antes de llegar a las alertas.
3. **Las rotaciones se cuentan dos veces:** el bloque "antes y después" ya muestra la actual y la mejor; debajo, las 3 tarjetas vuelven a mostrar esas dos.
4. **Tiempo hasta la primera respuesta (bueno):** el semáforo de la ficha aparece en la primera pantalla (< 5 s). Las tarjetas de alerta empiezan en ~1.060 px, ya bajo el pliegue.

## 3. Priorización ICE de los recortes
Impacto (cuánto aligera sin perder valor) × Confianza ÷ Esfuerzo, de 1 a 5.

| # | Cambio | I | C | E | ICE | Decisión |
|---|---|---:|---:|---:|---:|---|
| 1 | **Plegar "Fuentes, supuestos e incertidumbre"** (como la evidencia) | 5 | 5 | 1 | **25** | Hacer hoy |
| 2 | **Ficha: quitar el párrafo de Guaman Poma** (lo cuenta la rueda y la alerta ADS) y dejar la nota de la celda en 1 línea plegable | 4 | 4 | 1 | **16** | Hacer hoy |
| 3 | **Rotaciones: el "antes y después" es el protagonista**; las 3 tarjetas pasan a "Personalizar", y queda 1 línea con la laymi tradicional como referencia | 4 | 4 | 2 | **8** | Hacer hoy |
| 4 | ¿A qué altura hiela?: gráfico más bajo (la frase ya da la respuesta) | 2 | 4 | 1 | 8 | Opcional |
| 5 | Portada: quitar la línea del reto y dejar 2 insignias | 2 | 3 | 1 | 6 | Opcional |
| 6 | Alertas: plegar la tendencia de cada tarjeta | 2 | 2 | 2 | 2 | No hoy (es núcleo) |
| 7 | Quitar la rueda o las rotaciones | — | — | — | — | **No**: una es el diferenciador y la otra la exige el reto |

**Efecto esperado de 1 + 2 + 3:** de ≈ 5.200 px a ≈ 3.700 px (de 6 a 4 pantallas) y de ≈ 1.400 a ≈ 800 palabras visibles, **sin borrar nada**: todo queda a un clic.

## 4. Anti-objetivos (lo que este MVP NO intenta)
- No es una app para que cada agricultor la use solo: la maneja el técnico y decide la asamblea.
- No predice cosechas ni reemplaza a la Agencia Agraria.
- No muestra todo lo que sabe hacer: lo extra existe con `?full=1`.

## 5. Cómo sabremos que funciona
- **Métrica de la demo:** quien no conoce el proyecto puede decir, tras 30 s de mirar la página, *qué problema resuelve y qué hacer esta campaña*. (Probarlo con 2 personas antes de entregar.)
- **Métrica del producto (después del hackathon):** % de asambleas en las que el técnico usó la ficha impresa; tiempo hasta la primera respuesta < 10 s en celular.

## 6. Siguiente paso
Aplicar los cambios 1, 2 y 3 (≈ 30 min), verificar en el navegador y volver a medir el alto y las palabras.

## 7. Resultado (aplicado el 15 nov 2026)
Cambios 1, 2 y 3 aplicados y medidos de nuevo (misma pantalla y parcela):

| Medida | Antes | Después |
|---|---:|---:|
| Alto de la página | 5.210 px (≈ 6 pantallas) | **4.070 px (≈ 4,7 pantallas)** |
| Palabras visibles | ≈ 1.400 | **924** |
| Ficha de la parcela | 187 palabras | **63** |
| Fuentes, supuestos e incertidumbre | 1.114 px · 410 palabras | **160 px · 21** (plegada) |
| Rotaciones | 776 px · 211 palabras | **591 px · 149** |

Después se aplicó el **#4**: en "¿A qué altura hiela?" la frase (la respuesta) va a la izquierda y el gráfico, más bajo y sin título repetido, a la derecha. La sección pasó de 600 a **390 px** y la página a **3.861 px (≈ 4,5 pantallas)**, cerca del objetivo de ≈ 3.700 px. En celular se apila en una columna.
