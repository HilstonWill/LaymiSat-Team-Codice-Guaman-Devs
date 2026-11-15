"""Simulador "¿Y si siembro el…?": riesgo de helada y lluvia firme según la fecha de siembra.

Para cada día posible de siembra (1 ago → 31 dic) se mira qué pasó en las últimas 15 campañas completas:
- rain_ready: fracción de campañas en las que la lluvia firme ya había empezado ese día (inicio ≤ día).
- frost_risk: fracción de campañas con al menos una helada de ≥2 noches seguidas (Tmin de planta ≤ 0 °C)
  durante la brotación, es decir, en los SPROUT_DAYS días siguientes a la siembra.
- score = rain_ready × (1 − frost_risk). La ventana recomendada son los días con rain_ready ≥ 0,6 y
  frost_risk ≤ 0,2; si ninguno cumple, los días con el mejor score.
Es un análisis de lo observado, no un pronóstico.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import alerts as A
from .analysis import count_runs

LAST_SOW_SDAY = 152  # 31 de diciembre: sembrar más tarde acorta la campaña antes de las heladas de cosecha
STEP = 2
SPROUT_DAYS = 60
MIN_RAIN_READY = 0.6
MAX_FROST_RISK = 0.2


def sowing_curve(df: pd.DataFrame, plant_adjust: float, recent_n: int = A.RECENT_N) -> dict:
    """df: datos diarios ya corregidos a la altitud de la parcela, con columnas campaign/sday."""
    onset = A.onset_by_campaign(df)
    current = int(df["campaign"].max())
    frost = A.frost_by_campaign(df, plant_adjust)
    complete = set(frost[frost["complete"] & (frost["campaign"] < current)]["campaign"])
    done = onset[onset["campaign"].isin(complete) & onset["season_observed"]]
    campaigns = sorted(done["campaign"])[-recent_n:]
    if not campaigns:
        return {"curve": [], "window": None, "best_sday": None, "campaigns": []}

    onset_of = dict(zip(done["campaign"], done["onset_sday"]))
    span = LAST_SOW_SDAY + SPROUT_DAYS + 1
    tmin = {}
    for c in campaigns:
        g = df[(df["campaign"] == c) & (df["sday"] < span)]
        arr = np.full(span, np.nan)
        arr[g["sday"].to_numpy()] = g["tmin"].to_numpy() + plant_adjust
        tmin[c] = arr

    def ready(c: int, d: int) -> float:
        o = onset_of[c]
        return 1.0 if (o == o and o <= d) else 0.0  # o == o descarta NaN (sin inicio firme)

    def frost_after(c: int, d: int) -> float:
        window = np.nan_to_num(tmin[c][d : d + SPROUT_DAYS], nan=99.0)
        return 1.0 if count_runs(window <= 0, 2) >= 1 else 0.0

    curve = []
    for d in range(0, LAST_SOW_SDAY + 1, STEP):
        r = float(np.mean([ready(c, d) for c in campaigns]))
        f = float(np.mean([frost_after(c, d) for c in campaigns]))
        curve.append({"sday": d, "rain_ready": round(r, 3), "frost_risk": round(f, 3), "score": round(r * (1 - f), 3)})

    best = max(curve, key=lambda p: (p["score"], -p["sday"]))
    good = [p["sday"] for p in curve if p["rain_ready"] >= MIN_RAIN_READY and p["frost_risk"] <= MAX_FROST_RISK]
    if good:
        runs, cur = [], [good[0]]
        for s in good[1:]:
            if s - cur[-1] <= STEP:
                cur.append(s)
            else:
                runs.append(cur)
                cur = [s]
        runs.append(cur)
        run = max(runs, key=len)
        window = {"from_sday": run[0], "to_sday": run[-1], "meets_thresholds": True}
    else:
        near = [p["sday"] for p in curve if p["score"] >= best["score"] * 0.9]
        window = {"from_sday": min(near), "to_sday": max(near), "meets_thresholds": False}
    return {
        "curve": curve,
        "window": window,
        "best_sday": best["sday"],
        "campaigns": [int(c) for c in campaigns],
        "sprout_days": SPROUT_DAYS,
        "thresholds": {"rain_ready": MIN_RAIN_READY, "frost_risk": MAX_FROST_RISK},
        "codex": {"early_sowing_sday": A.TRADITIONAL_SOWING_SDAY, "rainfed_sowing_sday": A.RAINFED_SOWING_SDAY},
    }
