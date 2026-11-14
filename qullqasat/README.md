# QullqaSat

**Alerta agroclimática y validación ancestral para la papa nativa de Cusco.**
NASA Space Apps Challenge 2026 · Retos: *Be An Earth System Trend Detective!* + *Field Shift*.

QullqaSat cruza 40 años de datos diarios de **NASA POWER** (1984 → hoy) con el calendario agrícola de
**Felipe Guaman Poma de Ayala (1615)** para responder a lo que decide una comunidad altoandina:
*¿cuándo sembrar, con qué riesgo y con qué rotación?*

## Qué hace

| Pieza | Detalle |
|---|---|
| 3 alertas con semáforo | **AHS** heladas en brotación · **AEH** estrés hídrico en la siembra · **ADS** desfase entre Coya Raymi y el inicio real de lluvias |
| Detective de tendencias | Mann-Kendall + pendiente de Sen sobre heladas, lluvia sep–nov, inicio de lluvias y Tmin anual |
| Riesgo por altitud | Helada por bandas 3.200–4.400 m, primeras vs últimas 15 campañas |
| Calendario 1615 | Los 12 meses del códice, cada uno medido con su variable NASA |
| Comparador de rotaciones | Laymi completa / acortada / con tarwi-haba, editables, con 5 criterios trazables |
| Ficha | Imprimible / PDF, con fuentes, supuestos e incertidumbre |

### Hallazgos con datos reales (las dos celdas NASA POWER de las zonas piloto)
- Las noches se calientan: Tmin media anual **+0,19 °C/década** (Pisac/Chinchero/Colquepata) y **+0,22 °C/década** (Ccatcca), Mann-Kendall p < 0,001.
- La **línea de helada** en brotación está entre **3.600 y 3.800 m**: la probabilidad pasa del 7 % al 67 % de las campañas (y al 100 % a 4.000 m).
- En Pisac la lluvia firme llega en promedio el **19 de octubre**, unas 4 semanas después de la siembra general de Coya Raymi, y en una ventana de **7 semanas (26 sep – 13 nov)**. No es una fecha fija.
- Lo que **no** confirmamos: los datos no muestran un retraso significativo del inicio de lluvias (en 1984–1998 llegaban incluso más tarde). La app lo muestra tal cual.

## Ejecutar en local

```bash
# Backend (Python 3.11+)
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt -r requirements-dev.txt   # Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000

# Frontend (Node 20+)
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxy /api → :8000)
```

Tests del backend: `cd backend && .venv/Scripts/python -m pytest --cov=app` (43 tests, 98 % de cobertura).

La carpeta `backend/cache/` trae ya descargadas las 2 celdas NASA POWER que cubren las 4 zonas piloto, así que la demo funciona sin red.
Cada punto se ajusta al centro de su celda POWER (0,5° × 0,625°), lo que limita la caché a unas 80 celdas en toda la región.
La caché se refresca cada 3 días con un candado por celda y escritura atómica; si NASA POWER no responde, se usa la caché antigua.
Guion de demo y pitch: [docs/DEMO.md](docs/DEMO.md).

## Despliegue
- **Backend** (Render/Railway): `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; variables `QULLQA_CORS_ORIGINS=https://<tu-frontend>` y `QULLQA_PUBLIC_DOCS=0` para ocultar `/docs`. Antes de publicar, añadir un límite de peticiones por IP en el proxy.
- **Frontend** (Vercel): `npm run build`; variable `VITE_API_URL=https://<tu-backend>`.

## API
| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/zones` | Zonas piloto |
| GET | `/api/report?lat&lon&altitude&plant_adjust` | Alertas, series, tendencias, calendario (solo región Cusco) |
| POST | `/api/rotations` | Compara 1–5 secuencias de cultivos |
| GET | `/api/calendar`, `/api/crops` | Datos de referencia |

## Método y supuestos (resumen)
- **Campaña agrícola**: 1 de agosto (Chacra Yapuy) → 31 de julio.
- **Corrección por altitud**: −6,5 °C/km entre la celda POWER (~0,5°) y la parcela. La lluvia no se corrige.
- **Helada a nivel de planta**: Tmin a 2 m −2 °C (ajustable), porque la reanálisis suaviza las heladas radiativas. Debe calibrarse con estaciones SENAMHI.
- **Inicio de lluvias**: primer día con ≥25 mm en 10 días sin un veranillo de ≥10 días en los 40 días siguientes.
- **Ventana tradicional**: Coya Raymi Quilla, 2.ª quincena de septiembre (referencia: 23 sep).
- **Rotaciones**: valores orientativos por cultivo en `backend/app/data/crops.json` (balance de N, agua, tolerancia a helada, cobertura). No predicen rendimiento.
- **Datos casi en tiempo real** (últimos ~90 días): provisionales.

Guaman Poma se usa como línea base cultural cualitativa: se comparan fechas y criterios, no se fuerzan equivalencias numéricas.

## Próximos pasos
NDVI (MODIS/Sentinel-2 vía Earth Engine), pendiente SRTM por sector, IMERG para lluvia a mayor resolución,
calibración con estaciones SENAMHI y validación con la Agencia Agraria Cusco y las comunidades.

## Créditos y licencia
Datos: NASA POWER Project (NASA Langley Research Center). Calendario: Guaman Poma de Ayala, *Nueva corónica y buen gobierno* (1615).
Mapa © OpenStreetMap. Código bajo licencia MIT.
