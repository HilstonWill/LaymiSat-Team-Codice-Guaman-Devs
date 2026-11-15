/**
 * Secciones visibles en el MVP que se presenta (problema → solución).
 *
 * Visibles siempre: mapa + ficha de la parcela, las 3 alertas, tendencias (la evidencia del problema),
 * calendario de Guaman Poma frente a los datos, comparador de rotaciones (lo exige el reto Field Shift)
 * y fuentes/límites.
 *
 * Ocultas por defecto (el código sigue ahí, no se borró nada):
 *  - dynamicAlerts: simulador "¿Y si siembro el…?", pronóstico de 7 días (Open-Meteo, no es NASA) e IA general
 *  - aiExplain:     botón "Explicar esta alerta con IA" en cada tarjeta
 *  - ndvi:          panel NDVI MODIS de la zona piloto (contexto, solo 4 zonas)
 *
 * Para verlas todas: abrir la app con `?full=1` o compilar con `VITE_SHOW_ALL=1`.
 */
const fromUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('full') === '1'
const SHOW_ALL = fromUrl || import.meta.env.VITE_SHOW_ALL === '1'

export const FEATURES = {
  dynamicAlerts: SHOW_ALL,
  aiExplain: SHOW_ALL,
  ndvi: SHOW_ALL,
  // Siempre visible: el calendario de Guaman Poma es el corazón del problema (tradición vs. lluvias de hoy).
  calendar: true,
} as const
