"""Herramientas estadísticas sin dependencias pesadas: Mann-Kendall, pendiente de Sen y rachas."""

from __future__ import annotations

import math
from collections import Counter
from typing import Sequence

import numpy as np


def _clean(x: Sequence[float], y: Sequence[float]) -> tuple[np.ndarray, np.ndarray]:
    xa = np.asarray(x, dtype=float)
    ya = np.asarray(y, dtype=float)
    mask = ~(np.isnan(xa) | np.isnan(ya))
    return xa[mask], ya[mask]


def mann_kendall(values: Sequence[float]) -> dict:
    """Prueba de Mann-Kendall (con corrección por empates). Ignora NaN."""
    y = np.asarray(values, dtype=float)
    y = y[~np.isnan(y)]
    n = len(y)
    if n < 4:
        return {"n": n, "s": 0, "z": 0.0, "p_value": 1.0, "tau": 0.0}

    s = 0
    for i in range(n - 1):
        s += int(np.sign(y[i + 1 :] - y[i]).sum())

    ties = Counter(y.tolist())
    tie_term = sum(t * (t - 1) * (2 * t + 5) for t in ties.values() if t > 1)
    var_s = (n * (n - 1) * (2 * n + 5) - tie_term) / 18.0

    if var_s <= 0:
        z = 0.0
    elif s > 0:
        z = (s - 1) / math.sqrt(var_s)
    elif s < 0:
        z = (s + 1) / math.sqrt(var_s)
    else:
        z = 0.0

    p_value = math.erfc(abs(z) / math.sqrt(2))
    tau = s / (n * (n - 1) / 2)
    return {"n": n, "s": s, "z": round(z, 4), "p_value": round(p_value, 4), "tau": round(tau, 4)}


def sen_slope(x: Sequence[float], y: Sequence[float]) -> float:
    """Mediana de las pendientes entre todos los pares de puntos (estimador de Theil-Sen)."""
    xa, ya = _clean(x, y)
    slopes = [
        (ya[j] - ya[i]) / (xa[j] - xa[i])
        for i in range(len(xa) - 1)
        for j in range(i + 1, len(xa))
        if xa[j] != xa[i]
    ]
    return float(np.median(slopes)) if slopes else 0.0


def trend(years: Sequence[float], values: Sequence[float], alpha: float = 0.05) -> dict:
    """Resumen de tendencia: pendiente de Sen por década + significancia de Mann-Kendall."""
    xa, ya = _clean(years, values)
    mk = mann_kendall(ya)
    slope = sen_slope(xa, ya)
    significant = mk["p_value"] < alpha and mk["n"] >= 4
    if not significant:
        direction = "sin tendencia significativa"
    elif slope > 0:
        direction = "en aumento"
    elif slope < 0:
        direction = "en descenso"
    else:
        direction = "sin tendencia significativa"
    return {
        "slope_per_decade": round(slope * 10, 3),
        "p_value": mk["p_value"],
        "tau": mk["tau"],
        "n": mk["n"],
        "significant": bool(significant),
        "direction": direction,
    }


def runs(mask: Sequence[bool]) -> list[int]:
    """Longitudes de cada racha consecutiva de True."""
    out: list[int] = []
    current = 0
    for v in mask:
        if bool(v):
            current += 1
        elif current:
            out.append(current)
            current = 0
    if current:
        out.append(current)
    return out


def max_run(mask: Sequence[bool]) -> int:
    r = runs(mask)
    return max(r) if r else 0


def count_runs(mask: Sequence[bool], min_len: int) -> int:
    return sum(1 for r in runs(mask) if r >= min_len)


def percentile_rank(value: float, sample: Sequence[float]) -> float:
    """Percentil (0–100) que ocupa `value` dentro de `sample` (NaN ignorados)."""
    arr = np.asarray(sample, dtype=float)
    arr = arr[~np.isnan(arr)]
    if len(arr) == 0 or value is None or math.isnan(value):
        return float("nan")
    below = (arr < value).sum()
    equal = (arr == value).sum()
    return round(100.0 * (below + 0.5 * equal) / len(arr), 1)
