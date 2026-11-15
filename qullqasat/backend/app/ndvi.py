"""NDVI de MODIS (MOD13Q1, 250 m, compuestos de 16 días) vía el servicio web del ORNL DAAC de NASA.

https://modis.ornl.gov/data/modis_webservice.html — no requiere login. Máximo 10 compuestos por petición.
El píxel de 250 m mezcla chacras, purun y pajonal: se usa como contexto de cobertura vegetal, no como
medición de una parcela.
"""

from __future__ import annotations

import math
import os
import threading
import time
from pathlib import Path
from typing import Callable

import pandas as pd

from .analysis import trend
from .climate import DEFAULT_CACHE_DIR, ClimateDataError, validate_location

ORNL_URL = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"
BAND = "250m_16_days_NDVI"
SCALE = 0.0001
FILL_MIN = -0.2  # valores menores son relleno / nubes
CHUNK = 10
NDVI_MAX_AGE_S = 16 * 24 * 3600  # nuevo compuesto cada 16 días
EARLY_YEARS = (2001, 2005)  # MODIS Terra empieza en feb-2000
RECENT_YEARS = (2021, 2025)
BARE_NDVI = 0.30  # por debajo: suelo desnudo o vegetación muy rala (umbral declarado)
_LOCK = threading.Lock()


def _key(lat: float, lon: float) -> str:
    return f"ndvi_{lat:.2f}_{lon:.2f}"


def _get_json(http_get: Callable, url: str, params: dict, retries: int = 3) -> dict:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            resp = http_get(url, params=params, headers={"Accept": "application/json"}, timeout=120)
            if resp.status_code == 200:
                return resp.json()
            last = ClimateDataError(f"MODIS ORNL respondió {resp.status_code}")
        except Exception as exc:  # timeouts frecuentes del servicio
            last = exc
        time.sleep(1.5 * (attempt + 1))
    raise ClimateDataError(f"MODIS ORNL no respondió: {last}")


def fetch_ndvi(
    lat: float,
    lon: float,
    http_get: Callable | None = None,
    pause_s: float = 0.2,
    workers: int = 3,
    years: tuple[tuple[int, int], ...] | None = (EARLY_YEARS, RECENT_YEARS),
) -> pd.Series:
    """Descarga la serie completa en tramos de 10 compuestos, varios tramos en paralelo (~1 min por tramo)."""
    if http_get is None:
        import httpx

        http_get = httpx.get
    dates = _get_json(http_get, f"{ORNL_URL}/dates", {"latitude": lat, "longitude": lon})["dates"]
    if years:  # solo los periodos que se comparan: ~23 peticiones en vez de ~62
        dates = [d for d in dates if any(a <= int(d["calendar_date"][:4]) <= b for a, b in years)]
    chunks = [dates[i : i + CHUNK] for i in range(0, len(dates), CHUNK)]

    def get_chunk(chunk: list[dict]) -> dict | None:
        try:
            data = _get_json(
                http_get,
                f"{ORNL_URL}/subset",
                {
                    "latitude": lat,
                    "longitude": lon,
                    "band": BAND,
                    "startDate": chunk[0]["modis_date"],
                    "endDate": chunk[-1]["modis_date"],
                    "kmAboveBelow": 0,
                    "kmLeftRight": 0,
                },
            )
        except ClimateDataError:
            return None
        if pause_s:
            time.sleep(pause_s)
        return data

    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        results = list(pool.map(get_chunk, chunks))
    failed = sum(1 for r in results if r is None)
    if failed > max(2, len(chunks) // 5):  # el servicio está caído: no guardar una serie con huecos grandes
        raise ClimateDataError(f"MODIS ORNL: {failed} tramos fallidos")
    values: dict[str, float] = {}
    for data in results:
        for row in (data or {}).get("subset", []):
            raw = row["data"][0] if row.get("data") else None
            if raw is None:
                continue
            v = raw * SCALE
            values[row["calendar_date"]] = v if v >= FILL_MIN else math.nan
    s = pd.Series(values, dtype=float)
    s.index = pd.to_datetime(s.index)
    return s.sort_index()


def load_ndvi(
    lat: float,
    lon: float,
    cache_dir: Path = DEFAULT_CACHE_DIR,
    http_get: Callable | None = None,
    allow_fetch: bool = True,
) -> tuple[pd.Series, str] | None:
    """Serie NDVI del punto (caché de 16 días). None si no hay caché y no se permite descargar."""
    validate_location(lat, lon)
    path = Path(cache_dir) / f"{_key(lat, lon)}.csv"
    fresh = path.exists() and (time.time() - path.stat().st_mtime) < NDVI_MAX_AGE_S

    def read(source: str):
        s = pd.read_csv(path, index_col=0, parse_dates=True).iloc[:, 0]
        return s.astype(float), source

    if fresh:
        return read("cache")
    if not allow_fetch:
        return read("stale-cache") if path.exists() else None
    with _LOCK:  # una descarga a la vez: son ~62 peticiones al ORNL
        try:
            s = fetch_ndvi(lat, lon, http_get=http_get)
        except Exception:
            return read("stale-cache") if path.exists() else None
        Path(cache_dir).mkdir(parents=True, exist_ok=True)
        tmp = Path(cache_dir) / f"{_key(lat, lon)}.csv.tmp"
        s.rename("ndvi").to_csv(tmp, header=True, float_format="%.4f")
        os.replace(tmp, path)
        return s, "live"


def ndvi_summary(s: pd.Series, source: str, early=EARLY_YEARS, recent=RECENT_YEARS) -> dict:
    """Curva estacional (por mes), meses con suelo desnudo y tendencia del pico anual."""
    s = s.dropna()
    df = pd.DataFrame({"ndvi": s.values, "month": s.index.month, "year": s.index.year})
    e = df[df["year"].between(*early)].groupby("month")["ndvi"].mean()
    r = df[df["year"].between(*recent)].groupby("month")["ndvi"].mean()
    order = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7]
    seasonal = []
    for m in order:
        ev = float(e[m]) if m in e.index else math.nan
        rv = float(r[m]) if m in r.index else math.nan
        seasonal.append(
            {
                "month": m,
                "early": None if math.isnan(ev) else round(ev, 3),
                "recent": None if math.isnan(rv) else round(rv, 3),
                "bare_recent": bool(not math.isnan(rv) and rv < BARE_NDVI),
            }
        )
    counts = df.groupby("year").size()
    peak = df.groupby("year")["ndvi"].max()
    peak = peak[counts.reindex(peak.index).fillna(0) >= 20]
    tr = trend(peak.index.to_numpy(), peak.to_numpy())
    return {
        "source": source,
        "product": "MODIS MOD13Q1 · NDVI 250 m · 16-day (NASA, via ORNL DAAC)",
        "first_date": s.index.min().date().isoformat(),
        "last_date": s.index.max().date().isoformat(),
        "bare_threshold": BARE_NDVI,
        "early_period": f"{early[0]}–{early[1]}",
        "recent_period": f"{recent[0]}–{recent[1]}",
        "seasonal": seasonal,
        "peak_month": int(r.idxmax()) if len(r) else None,
        "bare_months_recent": [x["month"] for x in seasonal if x["bare_recent"]],
        "peak_trend": {**tr, "variable": "annual peak NDVI", "unit": "NDVI/decade"},
    }
