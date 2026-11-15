"""Datos del Modo Historia: cómo se movió la línea de helada campaña por campaña.

Para cada campaña (oct–dic, la época de siembra y emergencia) se busca la altitud más baja
en la que hubo al menos un evento de helada a nivel de planta. Como la temperatura baja con
la altitud (gradiente fijo), si hiela a una altitud también hiela más arriba: esa altitud es
la "línea de helada" de la campaña. Se calcula con la misma regla que la alerta AHS.
"""

from __future__ import annotations

import math

import pandas as pd

from . import alerts as A
from .climate import ClimateData, at_altitude

STORY_MIN_ALT = 2800
STORY_MAX_ALT = 4800
STORY_STEP = 50
SMOOTH_YEARS = 5


def frost_line_by_campaign(data: ClimateData, plant_adjust: float) -> pd.DataFrame:
    """Una fila por campaña completa: altitud más baja con helada (None si no heló ni en el tope)."""
    events: dict[int, dict[int, bool]] = {}
    complete: dict[int, bool] = {}
    for alt in range(STORY_MIN_ALT, STORY_MAX_ALT + 1, STORY_STEP):
        f = A.frost_by_campaign(at_altitude(data, alt), plant_adjust)
        for r in f.itertuples():
            events.setdefault(r.campaign, {})[alt] = r.frost_events >= 1
            complete[r.campaign] = bool(r.complete)
    rows = []
    for c in sorted(events):
        hits = [alt for alt, hit in events[c].items() if hit]
        rows.append({"campaign": c, "frost_line": min(hits) if hits else None, "complete": complete[c]})
    return pd.DataFrame(rows)


def _mean(values: list[float]) -> float | None:
    vals = [v for v in values if v is not None and not math.isnan(v)]
    return round(sum(vals) / len(vals)) if vals else None


def build_story(data: ClimateData, plant_adjust: float) -> dict:
    df = frost_line_by_campaign(data, plant_adjust)
    df = df[df["complete"]].reset_index(drop=True)
    # Sin helada ni en el tope: se usa el tope (la línea está "por encima de" STORY_MAX_ALT).
    lines = [STORY_MAX_ALT if v is None or v != v else int(v) for v in df["frost_line"]]
    capped = [v is None or v != v for v in df["frost_line"]]
    smooth = pd.Series(lines, dtype=float).rolling(SMOOTH_YEARS, center=True, min_periods=2).mean()
    campaigns = [
        {
            "campaign": int(c),
            "frost_line": lines[i],
            "above_top": capped[i],
            "smooth": None if math.isnan(smooth[i]) else round(float(smooth[i])),
        }
        for i, c in enumerate(df["campaign"])
    ]
    n = A.RECENT_N
    early, recent = campaigns[:n], campaigns[-n:]
    return {
        "range": {"min": STORY_MIN_ALT, "max": STORY_MAX_ALT, "step": STORY_STEP},
        "plant_adjust": plant_adjust,
        "smooth_years": SMOOTH_YEARS,
        "campaigns": campaigns,
        "early": {
            "from": early[0]["campaign"] if early else None,
            "to": early[-1]["campaign"] if early else None,
            "frost_line": _mean([c["frost_line"] for c in early]),
        },
        "recent": {
            "from": recent[0]["campaign"] if recent else None,
            "to": recent[-1]["campaign"] if recent else None,
            "frost_line": _mean([c["frost_line"] for c in recent]),
        },
    }
