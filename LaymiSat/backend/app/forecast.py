"""Pronóstico de los próximos 7 días con Open-Meteo (gratuito, sin clave; modelos ECMWF/GFS/ICON).

https://open-meteo.com — no es un dato de la NASA: se usa como complemento para convertir las alertas en aviso
temprano. La Tmin se corrige a la altitud de la parcela (−6,5 °C/km) y se le suma el ajuste a nivel de planta,
igual que con NASA POWER.
"""

from __future__ import annotations

from typing import Callable

from .climate import LAPSE_RATE_C_PER_KM, ClimateDataError, validate_location

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
DAYS = 7
HEAVY_RAIN_MM = 30.0


def fetch_forecast(lat: float, lon: float, http_get: Callable | None = None) -> dict:
    validate_location(lat, lon)
    if http_get is None:
        import httpx

        http_get = httpx.get
    resp = http_get(
        OPEN_METEO_URL,
        params={
            "latitude": f"{lat:.3f}",
            "longitude": f"{lon:.3f}",
            "daily": "temperature_2m_min,temperature_2m_max,precipitation_sum",
            "timezone": "America/Lima",
            "forecast_days": DAYS,
        },
        timeout=20,
    )
    if resp.status_code != 200:
        raise ClimateDataError(f"Open-Meteo respondió {resp.status_code}")
    return resp.json()


def summarize_forecast(payload: dict, altitude: float, plant_adjust: float) -> dict:
    try:
        daily = payload["daily"]
        grid_elev = float(payload["elevation"])
        dates = daily["time"]
        tmins = daily["temperature_2m_min"]
        rains = daily["precipitation_sum"]
        tmaxs = daily.get("temperature_2m_max") or [None] * len(dates)
    except (KeyError, TypeError, ValueError) as exc:
        raise ClimateDataError("Pronóstico con formato inesperado") from exc
    offset = -LAPSE_RATE_C_PER_KM * (altitude - grid_elev) / 1000.0
    days = []
    for d, tn, tx, pr in zip(dates, tmins, tmaxs, rains):
        if tn is None:
            continue
        plant = tn + offset + plant_adjust
        days.append(
            {
                "date": d,
                "tmin_plant": round(plant, 1),
                "tmax": None if tx is None else round(tx + offset, 1),
                "rain_mm": None if pr is None else round(float(pr), 1),
                "frost": plant <= 0,
                "heavy_rain": pr is not None and pr > HEAVY_RAIN_MM,
            }
        )
    frost_nights = sum(1 for x in days if x["frost"])
    rain_total = round(sum(x["rain_mm"] or 0 for x in days), 1)
    level = "rojo" if frost_nights >= 2 else ("ambar" if frost_nights == 1 or any(x["heavy_rain"] for x in days) else "verde")
    return {
        "source": "Open-Meteo (ECMWF/GFS/ICON), corrected to plot altitude",
        "grid_elevation": grid_elev,
        "days": days,
        "frost_nights": frost_nights,
        "rain_total_mm": rain_total,
        "level": level,
    }
