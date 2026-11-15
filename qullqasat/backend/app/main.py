"""API de LaymiSat (FastAPI)."""

from __future__ import annotations

import os
import time
from functools import lru_cache
from typing import Annotated, Callable, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StringConstraints, field_validator

from .calendar_gp import load_calendar
from .climate import ClimateData, ClimateDataError, load_climate, snap_to_grid, validate_location
from .ndvi import load_ndvi, ndvi_summary
from .rotations import SoilInfo, compare, load_crops
from .service import DEFAULT_PLANT_ADJUST, build_report, rotation_context
from . import ai as AI
from .climate import at_altitude
from .forecast import fetch_forecast, summarize_forecast
from .sowing import sowing_curve
from .story import build_story
from .terrain import terrain_cached
from .zones import ZONES

_public_docs = os.environ.get("LAYMI_PUBLIC_DOCS", "1") == "1"
app = FastAPI(
    title="LaymiSat API",
    version="1.1.0",
    description="Agro-climate alerts and crop-rotation decision support with NASA data + Guaman Poma (1615)",
    docs_url="/docs" if _public_docs else None,
    redoc_url=None,
)

_origins = os.environ.get("LAYMI_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

Lat = Query(..., ge=-15.5, le=-11.0, description="Latitude (Cusco region)")
Lon = Query(..., ge=-73.9, le=-70.3, description="Longitude (Cusco region)")
Alt = Query(..., ge=2500, le=5000, description="Plot altitude (m a.s.l.)")
Adj = Query(DEFAULT_PLANT_ADJUST, ge=-5.0, le=2.0, description="Screen-to-plant Tmin adjustment (°C)")
Lang = Query("en", pattern="^(en|es)$", description="Language of the texts (en | es)")
Priority = Annotated[float, Field(ge=0, le=3)]


def _ttl_bucket() -> int:
    """Cambia cada hora: las memorias en proceso no retienen datos viejos para siempre."""
    return int(time.time() // 3600)


def _q_alt(altitude: float) -> int:
    return int(round(altitude / 50.0) * 50)


def _q_adj(adjust: float) -> float:
    return round(adjust * 2) / 2


def _snap(lat: float, lon: float) -> tuple[float, float]:
    try:
        validate_location(lat, lon)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return snap_to_grid(lat, lon)


def get_loader() -> Callable[[float, float], ClimateData]:
    return _cached_loader


def _cached_loader(lat: float, lon: float) -> ClimateData:
    return _loader_memo(lat, lon, _ttl_bucket())


@lru_cache(maxsize=16)
def _loader_memo(lat: float, lon: float, _bucket: int) -> ClimateData:
    return load_climate(lat, lon)


def _load(loader, lat: float, lon: float) -> ClimateData:
    try:
        return loader(lat, lon)
    except ClimateDataError as exc:
        raise HTTPException(status_code=503, detail="NASA POWER data unavailable right now") from exc


@app.get("/api/health")
def health() -> dict:
    provider = AI.configured_provider()
    return {"status": "ok", "ai": provider is not None, "ai_provider": provider}


@app.get("/api/zones")
def zones() -> list[dict]:
    return ZONES


@app.get("/api/calendar")
def calendar() -> dict:
    return load_calendar()


@app.get("/api/crops")
def crops() -> dict:
    return load_crops()


@lru_cache(maxsize=128)
def _report_cached(loader, lat: float, lon: float, altitude: int, adjust: float, lang: str, _bucket: int) -> dict:
    return build_report(_load(loader, lat, lon), altitude, adjust, lang)


@lru_cache(maxsize=128)
def _rotation_ctx_cached(loader, lat, lon, altitude: int, adjust: float, slope: str, soil: SoilInfo, _bucket: int):
    return rotation_context(_load(loader, lat, lon), altitude, adjust, slope, soil)


@app.get("/api/report")
def report(
    lat: float = Lat,
    lon: float = Lon,
    altitude: float = Alt,
    plant_adjust: float = Adj,
    lang: str = Lang,
    loader=Depends(get_loader),
) -> dict:
    """Celda POWER + altitud cuantizada a 50 m + ajuste a 0,5 °C: la caché es efectiva y acotada."""
    glat, glon = _snap(lat, lon)
    return _report_cached(loader, glat, glon, _q_alt(altitude), _q_adj(plant_adjust), lang, _ttl_bucket())


CropId = Annotated[str, StringConstraints(max_length=30)]


class Sequence(BaseModel):
    id: str | None = Field(default=None, max_length=40)
    name: str | None = Field(default=None, max_length=80)
    name_en: str | None = Field(default=None, max_length=80)
    sequence: list[CropId] = Field(..., min_length=2, max_length=10)


class Soil(BaseModel):
    texture: Literal["arenoso", "franco", "arcilloso"] = "franco"
    organic_matter: Literal["baja", "media", "alta"] = "media"
    declared: bool = False


class Priorities(BaseModel):
    suelo: Priority = 2.5
    plagas: Priority = 2.0
    agua: Priority = 2.0
    helada: Priority = 2.0
    erosion: Priority = 1.5
    forraje: Priority = 0.0
    ingresos: Priority = 0.0


class RotationRequest(BaseModel):
    lat: float = Field(..., ge=-15.5, le=-11.0)
    lon: float = Field(..., ge=-73.9, le=-70.3)
    altitude: float = Field(..., ge=2500, le=5000)
    plant_adjust: float = Field(DEFAULT_PLANT_ADJUST, ge=-5.0, le=2.0)
    slope: Literal["plana", "moderada", "fuerte"] = "moderada"
    soil: Soil = Field(default_factory=Soil)
    priorities: Priorities = Field(default_factory=Priorities)
    lang: Literal["en", "es"] = "en"
    sequences: list[Sequence] = Field(..., min_length=1, max_length=5)

    @field_validator("sequences")
    @classmethod
    def unique_ids(cls, seqs: list[Sequence]) -> list[Sequence]:
        ids = [s.id or s.name or f"s{i}" for i, s in enumerate(seqs)]
        if len(set(ids)) != len(ids):
            raise ValueError("Each sequence needs a unique id")
        for s, i in zip(seqs, ids):
            s.id = i
        return seqs


@app.post("/api/rotations")
def rotations(req: RotationRequest, loader=Depends(get_loader)) -> dict:
    glat, glon = _snap(req.lat, req.lon)
    soil = SoilInfo(req.soil.texture, req.soil.organic_matter, req.soil.declared)
    ctx = _rotation_ctx_cached(
        loader, glat, glon, _q_alt(req.altitude), _q_adj(req.plant_adjust), req.slope, soil, _ttl_bucket()
    )
    try:
        result = compare([s.model_dump() for s in req.sequences], ctx, req.priorities.model_dump(), req.lang)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    result["context"] = {
        "altitude": ctx.altitude,
        "frost_probability": round(ctx.frost_probability, 2),
        "dry_spell_probability": round(ctx.dry_spell_probability, 2),
        "heavy_days_mean": round(ctx.heavy_days_mean, 2),
        "season_precip_mean": round(sum(ctx.season_precip) / len(ctx.season_precip), 1) if ctx.season_precip else None,
        "slope": ctx.slope,
        "soil": {"texture": soil.texture, "organic_matter": soil.organic_matter, "declared": soil.declared},
    }
    return result


def nearest_zone(lat: float, lon: float, max_deg: float = 0.05) -> dict | None:
    best = min(ZONES, key=lambda z: (z["lat"] - lat) ** 2 + (z["lon"] - lon) ** 2)
    if abs(best["lat"] - lat) <= max_deg and abs(best["lon"] - lon) <= max_deg:
        return best
    return None


@lru_cache(maxsize=16)
def _ndvi_cached(lat: float, lon: float, _bucket: int) -> dict:
    """lru_cache no guarda excepciones: un fallo del ORNL se reintenta en la siguiente petición."""
    loaded = load_ndvi(lat, lon)
    if loaded is None:
        raise ClimateDataError("MODIS NDVI unavailable")
    s, source = loaded
    return ndvi_summary(s, source)


@app.get("/api/ndvi")
def ndvi(lat: float = Lat, lon: float = Lon) -> dict:
    """NDVI MODIS (250 m) del píxel de la zona piloto más cercana (~23 peticiones al ORNL la primera vez)."""
    zone = nearest_zone(lat, lon)
    if zone is None:
        raise HTTPException(status_code=404, detail="NDVI is available for the pilot zones in this MVP")
    try:
        summary = _ndvi_cached(zone["lat"], zone["lon"], _ttl_bucket() // 24)
    except ClimateDataError as exc:
        raise HTTPException(status_code=503, detail="MODIS NDVI unavailable right now") from exc
    return {"zone_id": zone["id"], **summary}


@app.get("/api/terrain")
def terrain(lat: float = Lat, lon: float = Lon) -> dict:
    """Altitud y clase de pendiente del punto con NASA SRTM 30 m."""
    try:
        return terrain_cached(round(lat, 3), round(lon, 3))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # SRTM sin datos, red caída o timeout
        raise HTTPException(status_code=503, detail="SRTM elevation unavailable right now") from exc


# ---------------------------------------------------------------------------
# Alertas dinámicas: simulador de siembra, pronóstico 7 días y explicación con IA
# ---------------------------------------------------------------------------

@lru_cache(maxsize=32)
def _story_cached(loader, lat: float, lon: float, adjust: float, _bucket: int) -> dict:
    return build_story(_load(loader, lat, lon), adjust)


@app.get("/api/story")
def story(lat: float = Lat, lon: float = Lon, plant_adjust: float = Adj, loader=Depends(get_loader)) -> dict:
    """Modo Historia: línea de helada (oct–dic) de cada campaña desde 1984, para animar en el mapa 3D."""
    glat, glon = _snap(lat, lon)
    return _story_cached(loader, glat, glon, _q_adj(plant_adjust), _ttl_bucket())


@lru_cache(maxsize=128)
def _sowing_cached(loader, lat: float, lon: float, altitude: int, adjust: float, _bucket: int) -> dict:
    return sowing_curve(at_altitude(_load(loader, lat, lon), altitude), adjust)


@app.get("/api/sowing")
def sowing(
    lat: float = Lat, lon: float = Lon, altitude: float = Alt, plant_adjust: float = Adj, loader=Depends(get_loader)
) -> dict:
    """Riesgo de helada y lluvia firme para cada fecha de siembra (1 ago → 31 dic), últimas 15 campañas."""
    glat, glon = _snap(lat, lon)
    return _sowing_cached(loader, glat, glon, _q_alt(altitude), _q_adj(plant_adjust), _ttl_bucket())


def get_forecast_fetcher() -> Callable[[float, float], dict]:
    return _forecast_memo_now


def _forecast_memo_now(lat: float, lon: float) -> dict:
    return _forecast_memo(lat, lon, int(time.time() // (3 * 3600)))


@lru_cache(maxsize=64)
def _forecast_memo(lat: float, lon: float, _bucket: int) -> dict:
    return fetch_forecast(lat, lon)


def _forecast_summary(fetcher, lat: float, lon: float, altitude: float, adjust: float) -> dict:
    try:
        validate_location(lat, lon)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        payload = fetcher(round(lat, 2), round(lon, 2))
        return summarize_forecast(payload, _q_alt(altitude), _q_adj(adjust))
    except Exception as exc:  # red caída, timeout o formato inesperado
        raise HTTPException(status_code=503, detail="Forecast unavailable right now") from exc


@app.get("/api/forecast")
def forecast(
    lat: float = Lat,
    lon: float = Lon,
    altitude: float = Alt,
    plant_adjust: float = Adj,
    fetcher=Depends(get_forecast_fetcher),
) -> dict:
    """Próximos 7 días (Open-Meteo), con la Tmin corregida a la altitud de la parcela y a nivel de planta."""
    return _forecast_summary(fetcher, lat, lon, altitude, plant_adjust)


class ExplainRequest(BaseModel):
    lat: float = Field(..., ge=-15.5, le=-11.0)
    lon: float = Field(..., ge=-73.9, le=-70.3)
    altitude: float = Field(..., ge=2500, le=5000)
    plant_adjust: float = Field(DEFAULT_PLANT_ADJUST, ge=-5.0, le=2.0)
    lang: Literal["en", "es"] = "en"
    place_name: str = Field("plot", max_length=80)
    question: str | None = Field(default=None, max_length=AI.MAX_QUESTION)
    focus: Literal["AHS", "AEH", "ADS"] | None = None


FOCUS_TASK = {
    "AHS": "explain ONLY the focus_alert (frost risk while the potato sprouts): what it means for this plot and what to do this week.",
    "AEH": "explain ONLY the focus_alert (sowing-season rain and soil moisture): what it means for this plot and what to do this week.",
    "ADS": "explain ONLY the focus_alert (rain onset vs the Guaman Poma calendar): what it means for this plot and what to do this week.",
}


def get_ai_explainer() -> Callable[..., dict]:
    return AI.explain


@app.post("/api/explain")
def explain(
    req: ExplainRequest,
    request: Request,
    loader=Depends(get_loader),
    fetcher=Depends(get_forecast_fetcher),
    explainer=Depends(get_ai_explainer),
) -> dict:
    """Explicación en lenguaje sencillo (Gemini) basada SOLO en los resultados calculados por LaymiSat."""
    client = request.client.host if request.client else "unknown"
    try:
        AI.check_rate(client)
    except AI.RateLimited as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    glat, glon = _snap(req.lat, req.lon)
    alt, adj = _q_alt(req.altitude), _q_adj(req.plant_adjust)
    rep = _report_cached(loader, glat, glon, alt, adj, req.lang, _ttl_bucket())
    sow = _sowing_cached(loader, glat, glon, alt, adj, _ttl_bucket())
    try:
        fc = _forecast_summary(fetcher, req.lat, req.lon, alt, adj)
    except HTTPException:
        fc = None  # sin pronóstico la explicación sigue siendo útil
    facts = AI.build_facts(rep, sow, fc, req.place_name, req.focus)
    try:
        if req.focus:
            return explainer(facts, req.lang, req.question, task=FOCUS_TASK[req.focus])
        return explainer(facts, req.lang, req.question)
    except AI.AIUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
