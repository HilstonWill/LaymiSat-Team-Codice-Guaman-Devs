"""Arma el informe completo de una parcela a partir de los datos NASA POWER."""

from __future__ import annotations

import math
from datetime import timedelta

import numpy as np
import pandas as pd

from . import alerts as A
from .calendar_gp import calendar_comparison
from .climate import LAPSE_RATE_C_PER_KM, ClimateData, add_campaign_columns, at_altitude, temperature_offset
from .rotations import ClimateContext

DEFAULT_PLANT_ADJUST = -2.0
ALTITUDE_BANDS = list(range(3200, 4401, 200))
PROVISIONAL_DAYS = 90


def _clean(obj):
    """Convierte NaN/numpy a tipos JSON."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def frost_altitude_profile(data: ClimateData, plant_adjust: float, current: int) -> list[dict]:
    rows = []
    for band in ALTITUDE_BANDS:
        df = at_altitude(data, band)
        f = A.frost_by_campaign(df, plant_adjust)
        complete = f[f["complete"] & (f["campaign"] < current)]
        early, recent = complete.head(A.RECENT_N), complete.tail(A.RECENT_N)
        rows.append(
            {
                "altitude": band,
                "frost_days_early": round(float(early["frost_days"].mean()), 2),
                "frost_days_recent": round(float(recent["frost_days"].mean()), 2),
                "event_probability_early": round(float((early["frost_events"] >= 1).mean()), 2),
                "event_probability_recent": round(float((recent["frost_events"] >= 1).mean()), 2),
            }
        )
    return rows


def annual_temperature(df: pd.DataFrame) -> list[dict]:
    yearly = df.groupby(df.index.year).agg(tmin=("tmin", "mean"), tmax=("tmax", "mean"), n=("tmin", "count"))
    yearly = yearly[yearly["n"] >= 330]
    return [
        {"year": int(y), "tmin": round(float(r.tmin), 2), "tmax": round(float(r.tmax), 2)}
        for y, r in yearly.iterrows()
    ]


def build_report(data: ClimateData, altitude: float, plant_adjust: float = DEFAULT_PLANT_ADJUST) -> dict:
    df = at_altitude(data, altitude)
    current = int(df["campaign"].max())
    frost = A.frost_by_campaign(df, plant_adjust)
    water = A.water_by_campaign(df)
    onset = A.onset_by_campaign(df)

    alerts = [
        A.frost_alert(frost, current, plant_adjust),
        A.water_alert(water, df, current),
        A.shift_alert(onset, current),
    ]

    series = (
        frost[["campaign", "frost_days", "frost_events", "complete"]]
        .merge(water[["campaign", "son_precip", "son_complete", "djf_max_dry", "djf_complete", "season_precip"]], on="campaign")
        .merge(onset[["campaign", "onset_sday", "shift_days", "provisional"]], on="campaign")
    )
    series_rows = []
    for r in series.to_dict(orient="records"):
        r["onset_label"] = A.sday_label(r["onset_sday"]) if r["onset_sday"] == r["onset_sday"] else None
        series_rows.append(r)

    tr = A.trend
    yearly = annual_temperature(df)
    temp_trend = tr([y["year"] for y in yearly], [y["tmin"] for y in yearly])

    last = data.last_date
    return _clean(
        {
            "location": {
                "lat": data.lat,
                "lon": data.lon,
                "altitude": altitude,
                "grid_elevation": round(data.grid_elevation, 1),
                "temperature_offset_c": round(temperature_offset(data.grid_elevation, altitude), 2),
            },
            "data": {
                "source": data.source,
                "first_date": data.df.index.min().date().isoformat(),
                "last_date": last.isoformat(),
                "provisional_from": (last - timedelta(days=PROVISIONAL_DAYS)).isoformat(),
                "current_campaign": f"{current}–{current + 1}",
            },
            "assumptions": {
                "lapse_rate_c_per_km": LAPSE_RATE_C_PER_KM,
                "plant_adjust_c": plant_adjust,
            },
            "alerts": alerts,
            "series": series_rows,
            "annual_temperature": yearly,
            "tmin_trend": {**temp_trend, "variable": "Tmin media anual", "unit": "°C/década"},
            "frost_by_altitude": frost_altitude_profile(data, plant_adjust, current),
            "calendar": calendar_comparison(df, plant_adjust),
            "traditional_sowing": {
                "window": A.TRADITIONAL_WINDOW,
                "reference_sday": A.TRADITIONAL_SOWING_SDAY,
                "label": "Coya Raymi Quilla · 16–30 sep",
            },
        }
    )


def rotation_context(data: ClimateData, altitude: float, plant_adjust: float, slope: str) -> ClimateContext:
    df = at_altitude(data, altitude)
    current = int(df["campaign"].max())
    frost = A.frost_by_campaign(df, plant_adjust)
    recent_f = frost[frost["complete"] & (frost["campaign"] < current)].tail(A.RECENT_N)
    water = A.water_by_campaign(df)
    recent_w = water[water["season_complete"] & (water["campaign"] < current)].tail(A.RECENT_N)
    recent_djf = water[water["djf_complete"] & (water["campaign"] < current)].tail(A.RECENT_N)
    return ClimateContext(
        altitude=altitude,
        frost_probability=float((recent_f["frost_events"] >= 1).mean()) if len(recent_f) else 0.0,
        season_precip=[float(v) for v in recent_w["season_precip"]],
        dry_spell_probability=float((recent_djf["djf_max_dry"] >= A.DRY_SPELL_DAYS).mean()) if len(recent_djf) else 0.0,
        heavy_days_mean=float(recent_w["heavy_days"].mean()) if len(recent_w) else 0.0,
        slope=slope,
    )


__all__ = ["build_report", "rotation_context", "add_campaign_columns", "DEFAULT_PLANT_ADJUST"]
