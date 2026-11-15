"""API de LaymiSat (FastAPI)."""

from __future__ import annotations

import os
import time
from functools import lru_cache
from typing import Annotated, Callable, Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StringConstraints, field_validator

from .calendar_gp import load_calendar
from .climate import ClimateData, ClimateDataError, load_climate, snap_to_grid, validate_location
from .rotations import compare, load_crops
from .service import DEFAULT_PLANT_ADJUST, build_report, rotation_context
from .zones import ZONES

_public_docs = os.environ.get("LAYMI_PUBLIC_DOCS", "1") == "1"
app = FastAPI(
    title="LaymiSat API",
    version="1.0.0",
    description="Alertas agroclimáticas con NASA POWER + Guaman Poma",
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

Lat = Query(..., ge=-15.5, le=-11.0, description="Latitud (región Cusco)")
Lon = Query(..., ge=-73.9, le=-70.3, description="Longitud (región Cusco)")
Alt = Query(..., ge=2500, le=5000, description="Altitud de la parcela (m s. n. m.)")
Adj = Query(DEFAULT_PLANT_ADJUST, ge=-5.0, le=2.0, description="Ajuste Tmin de abrigo → planta (°C)")


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
        raise HTTPException(status_code=503, detail="Datos de NASA POWER no disponibles por ahora") from exc


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


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
def _report_cached(loader, lat: float, lon: float, altitude: int, adjust: float, _bucket: int) -> dict:
    return build_report(_load(loader, lat, lon), altitude, adjust)


@lru_cache(maxsize=128)
def _rotation_ctx_cached(loader, lat: float, lon: float, altitude: int, adjust: float, slope: str, _bucket: int):
    return rotation_context(_load(loader, lat, lon), altitude, adjust, slope)


@app.get("/api/report")
def report(lat: float = Lat, lon: float = Lon, altitude: float = Alt, plant_adjust: float = Adj, loader=Depends(get_loader)) -> dict:
    """Celda POWER + altitud cuantizada a 50 m + ajuste a 0,5 °C: la caché es efectiva y acotada."""
    glat, glon = _snap(lat, lon)
    return _report_cached(loader, glat, glon, _q_alt(altitude), _q_adj(plant_adjust), _ttl_bucket())


CropId = Annotated[str, StringConstraints(max_length=30)]


class Sequence(BaseModel):
    id: str | None = Field(default=None, max_length=40)
    name: str | None = Field(default=None, max_length=80)
    sequence: list[CropId] = Field(..., min_length=2, max_length=10)


class RotationRequest(BaseModel):
    lat: float = Field(..., ge=-15.5, le=-11.0)
    lon: float = Field(..., ge=-73.9, le=-70.3)
    altitude: float = Field(..., ge=2500, le=5000)
    plant_adjust: float = Field(DEFAULT_PLANT_ADJUST, ge=-5.0, le=2.0)
    slope: Literal["plana", "moderada", "fuerte"] = "moderada"
    sequences: list[Sequence] = Field(..., min_length=1, max_length=5)

    @field_validator("sequences")
    @classmethod
    def unique_ids(cls, seqs: list[Sequence]) -> list[Sequence]:
        ids = [s.id or s.name or f"s{i}" for i, s in enumerate(seqs)]
        if len(set(ids)) != len(ids):
            raise ValueError("Cada secuencia necesita un id único")
        for s, i in zip(seqs, ids):
            s.id = i
        return seqs


@app.post("/api/rotations")
def rotations(req: RotationRequest, loader=Depends(get_loader)) -> dict:
    glat, glon = _snap(req.lat, req.lon)
    ctx = _rotation_ctx_cached(
        loader, glat, glon, _q_alt(req.altitude), _q_adj(req.plant_adjust), req.slope, _ttl_bucket()
    )
    try:
        result = compare([s.model_dump() for s in req.sequences], ctx)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    result["context"] = {
        "altitude": ctx.altitude,
        "frost_probability": round(ctx.frost_probability, 2),
        "dry_spell_probability": round(ctx.dry_spell_probability, 2),
        "heavy_days_mean": round(ctx.heavy_days_mean, 2),
        "season_precip_mean": round(sum(ctx.season_precip) / len(ctx.season_precip), 1) if ctx.season_precip else None,
        "slope": ctx.slope,
    }
    return result
