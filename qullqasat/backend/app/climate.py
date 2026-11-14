"""Ingesta de NASA POWER (diario) con caché en disco y corrección por altitud."""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = {
    "T2M_MIN": "tmin",
    "T2M_MAX": "tmax",
    "PRECTOTCORR": "prec",
    "RH2M": "rh",
    "ALLSKY_SFC_SW_DWN": "rad",
    "GWETTOP": "gwet",
}
START = date(1984, 1, 1)
LAPSE_RATE_C_PER_KM = 6.5
CACHE_MAX_AGE_S = 3 * 24 * 3600
FETCH_TIMEOUT_S = 60
# Rejilla nativa de MERRA-2 que usa NASA POWER (0,5° lat × 0,625° lon)
GRID_LAT, GRID_LON = 0.5, 0.625
_KEY_LOCKS: dict[str, threading.Lock] = {}
_KEY_LOCKS_GUARD = threading.Lock()
_FETCH_SLOTS = threading.BoundedSemaphore(2)
DEFAULT_CACHE_DIR = Path(os.environ.get("QULLQA_CACHE_DIR", Path(__file__).resolve().parent.parent / "cache"))

# Región Cusco (bbox generosa). Evita usar el servicio como proxy para cualquier punto del planeta.
LAT_RANGE = (-15.5, -11.0)
LON_RANGE = (-73.9, -70.3)


class ClimateDataError(RuntimeError):
    pass


@dataclass(frozen=True)
class ClimateData:
    df: pd.DataFrame  # índice diario; columnas tmin,tmax,prec,rh,rad,gwet (sin corregir)
    grid_elevation: float
    source: str  # "live" | "cache" | "stale-cache"
    lat: float
    lon: float

    @property
    def last_date(self) -> date:
        return self.df["tmin"].dropna().index.max().date()


def _cache_key(lat: float, lon: float) -> str:
    return f"{lat:.3f}_{lon:.3f}"


def snap_to_grid(lat: float, lon: float) -> tuple[float, float]:
    """Centro de la celda POWER que contiene el punto: todos los puntos de la celda comparten datos y caché."""
    return round(round(lat / GRID_LAT) * GRID_LAT, 4), round(round(lon / GRID_LON) * GRID_LON, 4)


def _lock_for(key: str) -> threading.Lock:
    with _KEY_LOCKS_GUARD:
        return _KEY_LOCKS.setdefault(key, threading.Lock())


def parse_power_json(payload: dict) -> tuple[pd.DataFrame, float]:
    try:
        props = payload["properties"]["parameter"]
        elevation = float(payload["geometry"]["coordinates"][2])
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ClimateDataError("Respuesta de NASA POWER con formato inesperado") from exc
    frame = pd.DataFrame({PARAMS[k]: pd.Series(v) for k, v in props.items() if k in PARAMS})
    if frame.empty:
        raise ClimateDataError("NASA POWER no devolvió datos")
    frame.index = pd.to_datetime(frame.index, format="%Y%m%d")
    frame.index.name = "date"
    frame = frame.astype(float).replace(-999.0, np.nan).sort_index()
    for col in PARAMS.values():
        if col not in frame:
            frame[col] = np.nan
    return frame[list(PARAMS.values())], elevation


def fetch_power(lat: float, lon: float, end: date, http_get: Callable | None = None) -> dict:
    if http_get is None:
        import httpx

        http_get = httpx.get
    params = {
        "parameters": ",".join(PARAMS),
        "community": "AG",
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "start": START.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
    }
    resp = http_get(POWER_URL, params=params, timeout=FETCH_TIMEOUT_S)
    if resp.status_code != 200:
        raise ClimateDataError(f"NASA POWER respondió {resp.status_code}")
    return resp.json()


def validate_location(lat: float, lon: float) -> None:
    if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]):
        raise ValueError("La ubicación debe estar dentro de la región Cusco")


def load_climate(
    lat: float,
    lon: float,
    cache_dir: Path = DEFAULT_CACHE_DIR,
    http_get: Callable | None = None,
    today: date | None = None,
    max_age_s: int = CACHE_MAX_AGE_S,
) -> ClimateData:
    """Devuelve datos diarios de la celda POWER del punto: caché fresca, descarga o caché vieja.

    Un candado por celda evita descargas duplicadas; la escritura es atómica (tmp + os.replace).
    """
    validate_location(lat, lon)
    lat, lon = snap_to_grid(lat, lon)
    cache_dir = Path(cache_dir)
    key = _cache_key(lat, lon)
    csv_path = cache_dir / f"{key}.csv"
    meta_path = cache_dir / f"{key}.json"

    def from_cache(source: str) -> ClimateData:
        try:
            df = pd.read_csv(csv_path, index_col="date", parse_dates=["date"])
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            return ClimateData(df, float(meta["grid_elevation"]), source, lat, lon)
        except (OSError, ValueError, KeyError) as exc:
            raise ClimateDataError("Caché local dañada") from exc

    def has_cache() -> bool:
        return csv_path.exists() and meta_path.exists()

    def fresh() -> bool:
        return has_cache() and (time.time() - meta_path.stat().st_mtime) < max_age_s

    if fresh():
        return from_cache("cache")

    with _lock_for(key):
        if fresh():  # otro hilo la descargó mientras esperábamos
            return from_cache("cache")
        end = (today or date.today()) - timedelta(days=2)
        try:
            with _FETCH_SLOTS:
                payload = fetch_power(lat, lon, end, http_get=http_get)
            df, elevation = parse_power_json(payload)
        except Exception as exc:  # red caída, timeout, formato: degradamos a caché si existe
            if has_cache():
                return from_cache("stale-cache")
            raise ClimateDataError(f"No se pudo obtener datos de NASA POWER: {exc}") from exc

        cache_dir.mkdir(parents=True, exist_ok=True)
        tmp_csv, tmp_meta = cache_dir / f"{key}.csv.tmp", cache_dir / f"{key}.json.tmp"
        df.to_csv(tmp_csv, float_format="%.4f")
        tmp_meta.write_text(
            json.dumps({"grid_elevation": elevation, "lat": lat, "lon": lon, "end": end.isoformat()}),
            encoding="utf-8",
        )
        os.replace(tmp_csv, csv_path)
        os.replace(tmp_meta, meta_path)  # el JSON va al final: marca la caché como completa
        return from_cache("live")


def temperature_offset(grid_elevation: float, altitude: float, lapse: float = LAPSE_RATE_C_PER_KM) -> float:
    """°C a sumar a la temperatura de la celda POWER para llevarla a la altitud de la parcela."""
    return -lapse * (altitude - grid_elevation) / 1000.0


def at_altitude(data: ClimateData, altitude: float) -> pd.DataFrame:
    off = temperature_offset(data.grid_elevation, altitude)
    df = data.df.copy()
    df["tmin"] = df["tmin"] + off
    df["tmax"] = df["tmax"] + off
    return add_campaign_columns(df)


def add_campaign_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Campaña agrícola andina: 1 de agosto (Chacra Yapuy) a 31 de julio."""
    out = df.copy()
    idx = out.index
    campaign = np.where(idx.month >= 8, idx.year, idx.year - 1)
    out["campaign"] = campaign
    starts = pd.to_datetime([f"{c}-08-01" for c in campaign])
    out["sday"] = (idx - starts).days
    return out
