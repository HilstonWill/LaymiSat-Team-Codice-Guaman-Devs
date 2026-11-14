# Evaluación 001 — QullqaSat MVP (S1–S5)

Modo: evaluación en el navegador integrado (desktop 1366×900 y móvil 375×812) + revisión de código y de seguridad.
(El MCP de Playwright/Chrome DevTools no estaba disponible; la evaluación se hizo con el navegador del app.)

## Comprobaciones duras
- [x] El backend arranca y `/api/report` devuelve datos de NASA POWER reales (1984-01-01 → 2026-11-11).
- [x] `pytest`: 43 tests en verde, 98 % de cobertura.
- [x] `npm run build` sin errores de TypeScript; en el flujo principal no hay errores de consola propios de la app.

## Puntuación
| Criterio | Peso | Nota | Evidencia |
|---|---|---|---|
| Impacto | 20 % | 8 | Decisión concreta: ventana de siembra observada y mejor rotación para la parcela, con «qué hacer» por alerta |
| Creatividad | 15 % | 9 | Los 12 meses de Guaman Poma, cada uno medido con su variable NASA, sin forzar equivalencias |
| Validez | 25 % | 8 | Mann-Kendall/Sen con p-valor, supuestos visibles (gradiente, ajuste de helada), límites y datos provisionales marcados |
| Relevancia | 15 % | 9 | Cubre los dos retos: tendencias de 40 años y adaptación de rotaciones |
| Presentación | 25 % | 8 | Flujo mapa → alertas → tendencias → calendario → rotaciones → ficha; responsive y sin scroll horizontal |
| **Ponderada** | | **8,3** | **APRUEBA (umbral 7,0)** |

## Corregido durante la iteración
- El mapa se superponía a la barra fija (z-index) → corregido.
- El gráfico de inicio de lluvias ahora muestra el desfase en días frente a Coya Raymi.
- Informe de 6,9 s → 1,5 s (vectorización con numpy).
- Carrera en el arranque frío y en la caché: candado por celda, escritura atómica y reintentos en el cliente.
- Las cifras del pitch se recalcularon tras corregir `find_onset` con días faltantes. La variabilidad del inicio de lluvias no es robusta entre zonas y se retiró del pitch.

## Pendiente (no bloquea)
- Límite de peticiones por IP en el despliegue público.
- Bundle de 836 kB: separar en chunks Recharts y Leaflet.
- NDVI/SRTM, calibración con SENAMHI y validación de campo.
