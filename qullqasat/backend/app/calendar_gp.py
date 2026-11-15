"""Cruza el calendario de Guaman Poma (1615) con NASA POWER: periodo temprano vs reciente por mes."""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

from .analysis import max_run

CALENDAR_PATH = Path(__file__).resolve().parent / "data" / "guaman_poma_calendar.json"

INDICATORS = {
    "days_tmin_below_m2": ("Días con Tmin < −2 °C", "días/mes", "lower_is_better"),
    "share_rain_2nd_half_gt25": ("Años con > 25 mm en la 2.ª quincena", "% de años", "higher_is_better"),
    "share_gwet_below_p15": ("Años con humedad superficial < P15", "% de años", "lower_is_better"),
    "days_frost": ("Días con helada (Tmin de planta ≤ 0 °C)", "días/mes", "lower_is_better"),
    "days_chuno": ("Noches de helada para chuño (Tmin < 0 °C)", "días/mes", "higher_is_better"),
    "share_dry_spell_ge10": ("Años con veranillo ≥ 10 días", "% de años", "lower_is_better"),
    "days_rain_gt45": ("Días con lluvia > 45 mm", "días/mes", "lower_is_better"),
    "monthly_precip": ("Lluvia del mes", "mm", "neutral"),
    "thermal_amplitude": ("Amplitud térmica (Tmax − Tmin)", "°C", "neutral"),
    "tmax_mean": ("Tmax media", "°C", "neutral"),
    "tmean_mean": ("Temperatura media", "°C", "neutral"),
}
INDICATORS_EN = {
    "days_tmin_below_m2": ("Days with Tmin < −2 °C", "days/month"),
    "share_rain_2nd_half_gt25": ("Years with > 25 mm in the second half", "% of years"),
    "share_gwet_below_p15": ("Years with surface soil wetness < P15", "% of years"),
    "days_frost": ("Frost days (plant-level Tmin ≤ 0 °C)", "days/month"),
    "days_chuno": ("Frost nights for chuño (Tmin < 0 °C)", "days/month"),
    "share_dry_spell_ge10": ("Years with a dry spell ≥ 10 days", "% of years"),
    "days_rain_gt45": ("Days with rain > 45 mm", "days/month"),
    "monthly_precip": ("Monthly rainfall", "mm"),
    "thermal_amplitude": ("Daily temperature range (Tmax − Tmin)", "°C"),
    "tmax_mean": ("Mean Tmax", "°C"),
    "tmean_mean": ("Mean temperature", "°C"),
}
# Frase simple de "qué dicen los datos": (sube, baja, igual)
SENTENCES = {
    "es": ("Ahora hay más que antes", "Ahora hay menos que antes", "Casi igual que antes"),
    "en": ("Higher now than before", "Lower now than before", "About the same as before"),
}


def data_sentence(early: float, recent: float, lang: str) -> str:
    if math.isnan(early) or math.isnan(recent):
        return ""
    up, down, same = SENTENCES["en" if lang == "en" else "es"]
    diff = recent - early
    if abs(diff) / max(abs(early), 1.0) < 0.10:
        return same
    return up if diff > 0 else down


@lru_cache(maxsize=1)
def load_calendar() -> dict:
    return json.loads(CALENDAR_PATH.read_text(encoding="utf-8"))


def _per_year(df: pd.DataFrame, month: int, indicator: str, plant_adjust: float, gwet_p15: float) -> pd.Series:
    sub = df[df.index.month == month]
    years = sub.index.year.to_numpy()
    days = sub.index.day.to_numpy()
    tmin = sub["tmin"].to_numpy(dtype=float)
    tmax = sub["tmax"].to_numpy(dtype=float)
    prec = sub["prec"].to_numpy(dtype=float)
    gwet = sub["gwet"].to_numpy(dtype=float)
    out = {}
    values, starts = np.unique(years, return_index=True)
    ends = list(starts[1:]) + [len(years)]
    for year, i, j in zip(values, starts, ends):
        tn, tx, p, gw, d = tmin[i:j], tmax[i:j], prec[i:j], gwet[i:j], days[i:j]
        if (~np.isnan(tn)).sum() < 25:
            continue
        if indicator == "days_tmin_below_m2":
            v = float((tn < -2).sum())
        elif indicator == "share_rain_2nd_half_gt25":
            v = 100.0 * float(np.nansum(p[d >= 16]) > 25)
        elif indicator == "share_gwet_below_p15":
            g = np.nanmean(gw) if (~np.isnan(gw)).any() else math.nan
            v = math.nan if math.isnan(g) else 100.0 * float(g < gwet_p15)
        elif indicator == "days_frost":
            v = float(((tn + plant_adjust) <= 0).sum())
        elif indicator == "days_chuno":
            v = float((tn < 0).sum())
        elif indicator == "share_dry_spell_ge10":
            v = 100.0 * float(max_run(p < 1.0) >= 10)
        elif indicator == "days_rain_gt45":
            v = float((p > 45).sum())
        elif indicator == "monthly_precip":
            v = float(np.nansum(p))
        elif indicator == "thermal_amplitude":
            v = float(np.nanmean(tx - tn))
        elif indicator == "tmax_mean":
            v = float(np.nanmean(tx))
        else:  # tmean_mean
            v = float(np.nanmean((tx + tn) / 2))
        out[int(year)] = v
    return pd.Series(out, dtype=float)


def calendar_comparison(
    df: pd.DataFrame,
    plant_adjust: float = 0.0,
    early: tuple[int, int] = (1984, 1998),
    recent: tuple[int, int] = (2011, 2025),
    lang: str = "es",
) -> list[dict]:
    cal = load_calendar()
    oct_gwet = df[df.index.month == 10]["gwet"].groupby(df[df.index.month == 10].index.year).mean()
    normal = oct_gwet[(oct_gwet.index >= 1991) & (oct_gwet.index <= 2020)].dropna()
    gwet_p15 = float(np.percentile(normal, 15)) if len(normal) else math.nan

    rows = []
    for m in cal["months"]:
        ind = m["indicator"]
        label, unit, polarity = INDICATORS[ind]
        if lang == "en":
            label, unit = INDICATORS_EN[ind]
        series = _per_year(df, m["month"], ind, plant_adjust, gwet_p15)
        e = series[(series.index >= early[0]) & (series.index <= early[1])].mean()
        r = series[(series.index >= recent[0]) & (series.index <= recent[1])].mean()
        change = r - e if not (math.isnan(e) or math.isnan(r)) else math.nan
        if math.isnan(change) or polarity == "neutral":
            status = "informativo"
        else:
            scale = max(abs(e), 1.0)
            worse = change > 0 if polarity == "lower_is_better" else change < 0
            status = "se_desfasa" if worse and abs(change) / scale >= 0.15 else "se_mantiene"
        en = lang == "en"
        rows.append(
            {
                "month": m["month"],
                "quechua": m["quechua"],
                "page": m.get("page"),
                "source_url": m.get("source_url"),
                "indicator": ind,
                "nasa_variables": m["nasa_variables"],
                "name": m["name_en"] if en else m["name"],
                "milestone": m["milestone_en"] if en else m["milestone"],
                "criterion": m["criterion_en"] if en else m["criterion"],
                "action": m["action_en"] if en else m["action"],
                "alternative": m["alternative_en"] if en else m["alternative"],
                "data_sentence": data_sentence(float(e), float(r), lang),
                "indicator_label": label,
                "unit": unit,
                "early": None if math.isnan(e) else round(float(e), 2),
                "recent": None if math.isnan(r) else round(float(r), 2),
                "change": None if math.isnan(change) else round(float(change), 2),
                "status": status,
                "early_period": f"{early[0]}–{early[1]}",
                "recent_period": f"{recent[0]}–{recent[1]}",
            }
        )
    return rows
