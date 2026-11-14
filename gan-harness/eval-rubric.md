# Rúbrica de evaluación (escala 1–10, umbral de aprobación 7,0)

Ponderada según los criterios oficiales del jurado de NASA Space Apps.

| Criterio | Peso | 10 = | 4 = |
|---|---|---|---|
| Impacto | 20 % | Una decisión concreta (cuándo sembrar, qué rotación) para una comunidad real, con acción sugerida | Solo gráficos de datos crudos |
| Creatividad | 15 % | Guaman Poma integrado como línea base y contrastado con datos, sin forzar equivalencias | El códice es solo decoración |
| Validez | 25 % | Datos NASA reales, tendencias con significancia, supuestos e incertidumbre visibles, tests verdes | Números inventados o sin fuente |
| Relevancia | 15 % | Detección de tendencias en 40 años + adaptación de cultivos (ambos retos) | Ignora uno de los retos |
| Presentación | 25 % | Flujo completo mapa → alertas → rotación → ficha, legible, responsive, sin errores de consola | Pantallas rotas o confusas |

Comprobaciones duras (cualquier fallo limita la nota a 5):
- El backend arranca y `/api/report` devuelve datos de NASA POWER (o la caché) sin error.
- `pytest` en verde y cobertura del backend ≥ 80 %.
- El frontend compila (`npm run build`) y no tiene errores en consola en el flujo principal.
