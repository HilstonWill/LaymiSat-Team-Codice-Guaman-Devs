"""Altitud y pendiente del punto con NASA SRTM (30 m) servido por OpenTopoData (sin clave, 1 petición/s).

https://www.opentopodata.org/datasets/srtm/ — se piden 3 puntos (centro, ~100 m al norte y ~100 m al este)
y la pendiente se estima con sus diferencias de altura.
"""

from __future__ import annotations

import math
import threading
import time
from functools import lru_cache
from typing import Callable

from .climate import ClimateDataError, validate_location

OPENTOPO_URL = "https://api.opentopodata.org/v1/srtm30m"
STEP_M = 100.0
_LOCK = threading.Lock()
_LAST_CALL = [0.0]


def slope_class(deg: float) -> str:
    if deg < 5:
        return "plana"
    if deg <= 15:
        return "moderada"
    return "fuerte"


def fetch_terrain(lat: float, lon: float, http_get: Callable | None = None) -> dict:
    validate_location(lat, lon)
    if http_get is None:
        import httpx

        http_get = httpx.get
    dlat = STEP_M / 111_320.0
    dlon = STEP_M / (111_320.0 * math.cos(math.radians(lat)))
    locs = f"{lat:.5f},{lon:.5f}|{lat + dlat:.5f},{lon:.5f}|{lat:.5f},{lon + dlon:.5f}"
    with _LOCK:  # el servicio público permite 1 petición por segundo
        wait = 1.05 - (time.time() - _LAST_CALL[0])
        if wait > 0:
            time.sleep(wait)
        try:
            resp = http_get(OPENTOPO_URL, params={"locations": locs}, timeout=30)
        finally:
            _LAST_CALL[0] = time.time()
    if resp.status_code != 200:
        raise ClimateDataError(f"OpenTopoData respondió {resp.status_code}")
    results = resp.json().get("results", [])
    elev = [r.get("elevation") for r in results]
    if len(elev) != 3 or any(e is None for e in elev):
        raise ClimateDataError("SRTM sin datos para este punto")
    c, n, e = elev
    deg = math.degrees(math.atan(math.hypot(n - c, e - c) / STEP_M))
    return {
        "elevation_m": round(float(c)),
        "slope_deg": round(deg, 1),
        "slope_class": slope_class(deg),
        "source": "NASA SRTM 1 arc-second (30 m), via OpenTopoData",
    }


@lru_cache(maxsize=512)
def terrain_cached(lat3: float, lon3: float) -> dict:
    return fetch_terrain(lat3, lon3)
