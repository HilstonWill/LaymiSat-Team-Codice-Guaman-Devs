"""Las 3 alertas de LaymiSat (definiciones tomadas del SDD).

AHS  Heladas severas:   >=2 días seguidos con Tmin <= 0 °C en oct–dic (brotación de la papa).
AEH  Estrés hídrico:    lluvia sep–nov por debajo del percentil 20 de 1991–2020, veranillos
                        >=10 días en dic–feb y humedad superficial (GWETTOP) bajo el P15.
ADS  Desfase ancestral: inicio de lluvias observado > 21 días después de la siembra general
                        temprana (mawai papa y maíz) de Coya Raymi Quilla (septiembre, Guaman Poma 1615,
                        pág. 1165). La siembra de temporal del códice es en Capac Inti Raymi (diciembre, pág. 1174).
"""

from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np
import pandas as pd

from .analysis import count_runs, max_run, percentile_rank, trend

FROST_C = 0.0
FROST_MIN_RUN = 2
DRY_DAY_MM = 1.0
DRY_SPELL_DAYS = 10
HEAVY_RAIN_MM = 30.0
ONSET_WINDOW_DAYS = 10
ONSET_MIN_MM = 25.0
ONSET_CHECK_DAYS = 40
ONSET_SEARCH_LAST_SDAY = 183  # 31 de enero
TRADITIONAL_SOWING_SDAY = 53  # 23 de septiembre: siembra temprana (mawai) de Coya Raymi
RAINFED_SOWING_SDAY = 136  # 15 de diciembre: siembra de temporal de Capac Inti Raymi (papa, oca, quinua, tarwi)
TRADITIONAL_WINDOW = (46, 60)  # 16–30 de septiembre
SHIFT_ALERT_DAYS = 21
NORMAL_PERIOD = (1991, 2020)
RECENT_N = 15

# sday (días desde el 1 de agosto) de los límites de cada periodo
SEP1, NOV30, DEC1, FEB28 = 31, 121, 122, 211
OCT1, DEC31 = 61, 152


def sday_to_date(campaign: int, sday: float) -> date:
    return date(int(campaign), 8, 1) + timedelta(days=int(sday))


def sday_label(sday: float) -> str:
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    d = sday_to_date(2001, sday)
    return f"{d.day} {months[d.month - 1]}"


def _between(g: pd.DataFrame, a: int, b: int) -> pd.DataFrame:
    return g[(g["sday"] >= a) & (g["sday"] <= b)]


def _campaign_slices(df: pd.DataFrame):
    """Itera (campaña, sday, columnas numpy) aprovechando que el índice diario está ordenado."""
    camp = df["campaign"].to_numpy()
    sday = df["sday"].to_numpy()
    cols = {c: df[c].to_numpy(dtype=float) for c in ("tmin", "prec", "gwet") if c in df}
    values, starts = np.unique(camp, return_index=True)
    ends = list(starts[1:]) + [len(camp)]
    for c, a, b in zip(values, starts, ends):
        yield int(c), sday[a:b], {k: v[a:b] for k, v in cols.items()}


def _window(sday: np.ndarray, arr: np.ndarray, a: int, b: int) -> np.ndarray:
    v = arr[(sday >= a) & (sday <= b)]
    return v[~np.isnan(v)]


def frost_by_campaign(df: pd.DataFrame, plant_adjust: float = 0.0) -> pd.DataFrame:
    """plant_adjust: °C sumados a la Tmin de abrigo para estimar la temperatura a nivel de la planta."""
    rows = []
    for c, sd, cols in _campaign_slices(df):
        tmin = _window(sd, cols["tmin"], OCT1, DEC31) + plant_adjust
        frost = tmin <= FROST_C
        rows.append(
            {
                "campaign": c,
                "frost_days": int(frost.sum()),
                "frost_events": count_runs(frost, FROST_MIN_RUN),
                "min_tmin": float(tmin.min()) if len(tmin) else math.nan,
                "complete": len(tmin) >= 90,
            }
        )
    return pd.DataFrame(rows)


def water_by_campaign(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for c, sd, cols in _campaign_slices(df):
        prec, gwet = cols["prec"], cols["gwet"]
        son = _window(sd, prec, SEP1, NOV30)
        djf = _window(sd, prec, DEC1, FEB28)
        season = _window(sd, prec, SEP1, 242)  # sep–mar
        wet = _window(sd, prec, DEC1, 242)
        octg = _window(sd, gwet, OCT1, OCT1 + 30)
        rows.append(
            {
                "campaign": c,
                "son_precip": float(son.sum()) if len(son) else math.nan,
                "son_complete": len(son) >= 89,
                "djf_max_dry": max_run(djf < DRY_DAY_MM) if len(djf) else math.nan,
                "djf_complete": len(djf) >= 88,
                "season_precip": float(season.sum()) if len(season) else math.nan,
                "season_complete": len(season) >= 210,
                "heavy_days": int((wet > HEAVY_RAIN_MM).sum()),
                "oct_gwet": float(octg.mean()) if len(octg) >= 25 else math.nan,
            }
        )
    return pd.DataFrame(rows)


def find_onset(prec_by_sday: np.ndarray) -> tuple[float, bool]:
    """Primer día con >=25 mm en 10 días sin veranillo >=10 días en los 40 días siguientes.

    Devuelve (sday, provisional). provisional=True si la ventana de verificación aún no termina.
    """
    p = np.asarray(prec_by_sday, dtype=float)
    last = min(len(p), ONSET_SEARCH_LAST_SDAY + 1)
    for d in range(0, last - ONSET_WINDOW_DAYS + 1):
        win = p[d : d + ONSET_WINDOW_DAYS]
        if np.isnan(win).any():
            continue  # día faltante: probar la siguiente ventana
        if win.sum() < ONSET_MIN_MM:
            continue
        check = p[d : d + ONSET_CHECK_DAYS]
        valid = check[~np.isnan(check)]
        if max_run(valid < DRY_DAY_MM) >= DRY_SPELL_DAYS:
            continue
        return float(d), len(valid) < ONSET_CHECK_DAYS
    return math.nan, False


def onset_by_campaign(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for c, g in df.groupby("campaign"):
        arr = np.full(ONSET_SEARCH_LAST_SDAY + ONSET_CHECK_DAYS + 1, np.nan)
        sub = g[g["sday"] < len(arr)]
        arr[sub["sday"].to_numpy()] = sub["prec"].to_numpy()
        first_sday = int(sub["sday"].min()) if len(sub) else 999
        # Campaña que empieza a mitad de temporada (p. ej. 1983, datos desde ene-1984): no se puede fechar el inicio
        onset, provisional = find_onset(arr) if first_sday <= SEP1 else (math.nan, False)
        last_sday = int(sub["sday"].max()) if len(sub) else -1
        rows.append(
            {
                "campaign": int(c),
                "onset_sday": onset,
                "provisional": provisional,
                "season_observed": last_sday >= ONSET_SEARCH_LAST_SDAY,
                "last_sday": last_sday,
            }
        )
    out = pd.DataFrame(rows)
    out["shift_days"] = out["onset_sday"] - TRADITIONAL_SOWING_SDAY
    return out


def _level(red: bool, amber: bool) -> str:
    return "rojo" if red else ("ambar" if amber else "verde")


def frost_alert(frost: pd.DataFrame, current: int, plant_adjust: float = 0.0) -> dict:
    complete = frost[frost["complete"] & (frost["campaign"] < current)]
    recent = complete.tail(RECENT_N)
    early = complete.head(RECENT_N)
    prob = float((recent["frost_events"] >= 1).mean()) if len(recent) else 0.0
    cur = frost[frost["campaign"] == current]
    cur_events = int(cur["frost_events"].iloc[0]) if len(cur) else 0
    cur_days = int(cur["frost_days"].iloc[0]) if len(cur) else 0
    level = _level(cur_events >= 1 or prob >= 0.5, prob >= 0.2 or cur_days >= 1)
    tr = trend(complete["campaign"], complete["frost_days"])

    if level == "rojo":
        action = (
            "Sembrar variedades nativas tolerantes (papas amargas, ruk'i) en las partes altas, "
            "retrasar la siembra hasta pasada la ventana de helada y preparar humo/riego antihelada."
        )
    elif level == "ambar":
        action = "Vigilar noches despejadas de oct–dic y escalonar la siembra en dos o tres fechas."
    else:
        action = "Riesgo bajo a esta altitud: mantener la siembra en su fecha y seguir vigilando."

    return {
        "id": "AHS",
        "name": "Heladas severas en la brotación",
        "level": level,
        "headline": (
            f"En {round(prob * 100)} % de las últimas {len(recent)} campañas hubo al menos una helada "
            f"de {FROST_MIN_RUN}+ días seguidos en oct–dic."
        ),
        "trigger": (
            f"Tmin a nivel de planta ≤ {FROST_C:.0f} °C durante ≥{FROST_MIN_RUN} días consecutivos (oct–dic); "
            f"Tmin de planta = Tmin a 2 m corregida por altitud {plant_adjust:+.1f} °C"
        ),
        "current": {"campaign": current, "frost_days": cur_days, "frost_events": cur_events},
        "metrics": {
            "recent_n": len(recent),
            "plant_adjust_c": plant_adjust,
            "event_probability_recent": round(prob, 2),
            "mean_frost_days_recent": round(float(recent["frost_days"].mean()), 1) if len(recent) else None,
            "mean_frost_days_early": round(float(early["frost_days"].mean()), 1) if len(early) else None,
            "early_period": _period(early),
            "recent_period": _period(recent),
        },
        "trend": {**tr, "variable": "días con helada en oct–dic", "unit": "días/década"},
        "action": action,
    }


def _period(frame: pd.DataFrame) -> str | None:
    if not len(frame):
        return None
    return f"{int(frame['campaign'].min())}–{int(frame['campaign'].max())}"


def water_alert(water: pd.DataFrame, df: pd.DataFrame, current: int) -> dict:
    normal = water[
        water["son_complete"] & water["campaign"].between(*NORMAL_PERIOD)
    ]
    p20_full = float(np.percentile(normal["son_precip"], 20)) if len(normal) else math.nan
    cur_rows = df[df["campaign"] == current]
    last_sday = int(cur_rows["sday"].max()) if len(cur_rows) else 0

    ref_campaign = current
    if last_sday < SEP1 + 14:  # aún no hay suficiente temporada de siembra: usar campaña anterior
        ref_campaign = current - 1
        cut = NOV30
    else:
        cut = min(last_sday, NOV30)

    def son_to_date(c: int) -> float:
        g = df[(df["campaign"] == c) & (df["sday"] >= SEP1) & (df["sday"] <= cut)]["prec"]
        return float(g.sum()) if g.notna().sum() >= (cut - SEP1 + 1) * 0.9 else math.nan

    normal_to_date = [son_to_date(c) for c in normal["campaign"]]
    p20 = float(np.nanpercentile(normal_to_date, 20)) if normal_to_date else math.nan
    value = son_to_date(ref_campaign)
    pct = percentile_rank(value, normal_to_date)

    complete_djf = water[water["djf_complete"] & (water["campaign"] < current)]
    recent_djf = complete_djf.tail(RECENT_N)
    dry_prob = float((recent_djf["djf_max_dry"] >= DRY_SPELL_DAYS).mean()) if len(recent_djf) else 0.0

    gwet_normal = water[water["campaign"].between(*NORMAL_PERIOD)]["oct_gwet"].dropna()
    gwet_p15 = float(np.percentile(gwet_normal, 15)) if len(gwet_normal) else math.nan
    cur_gwet_row = water[water["campaign"] == ref_campaign]["oct_gwet"]
    cur_gwet = float(cur_gwet_row.iloc[0]) if len(cur_gwet_row) else math.nan
    gwet_low = not math.isnan(cur_gwet) and not math.isnan(gwet_p15) and cur_gwet < gwet_p15

    below_p20 = not math.isnan(value) and value < p20
    level = _level(below_p20 or gwet_low, (not math.isnan(pct) and pct < 40) or dry_prob >= 0.5)

    son_series = water[water["son_complete"]]
    tr = trend(son_series["campaign"], son_series["son_precip"])
    tr_dry = trend(complete_djf["campaign"], complete_djf["djf_max_dry"])

    if level == "rojo":
        action = (
            "Lluvia de siembra por debajo de lo normal: priorizar cultivos de menor demanda "
            "(tarwi, quinua, cebada) en secano y guardar la papa para parcelas con humedad o qochas."
        )
    elif level == "ambar":
        action = "Sembrar con las primeras lluvias firmes y proteger la humedad del suelo con cobertura y aporque temprano."
    else:
        action = "La lluvia de siembra está dentro de lo normal para esta zona."

    period_label = f"1 sep – {sday_label(cut)}"
    return {
        "id": "AEH",
        "name": "Estrés hídrico en la siembra",
        "level": level,
        "headline": (
            f"Lluvia {period_label} de la campaña {ref_campaign}: {value:.0f} mm "
            f"(percentil {pct:.0f} frente a 1991–2020; P20 = {p20:.0f} mm)."
            if not (math.isnan(value) or math.isnan(pct) or math.isnan(p20))
            else "Sin datos suficientes de lluvia de siembra para esta campaña."
        ),
        "trigger": "Lluvia sep–nov acumulada < percentil 20 de 1991–2020, o humedad superficial de octubre < P15",
        "current": {
            "campaign": ref_campaign,
            "period": period_label,
            "period_end_sday": cut,
            "precip_mm": None if math.isnan(value) else round(value, 1),
            "percentile": None if math.isnan(pct) else pct,
            "p20_mm": None if math.isnan(p20) else round(p20, 1),
            "oct_soil_wetness": None if math.isnan(cur_gwet) else round(cur_gwet, 3),
            "oct_soil_wetness_p15": None if math.isnan(gwet_p15) else round(gwet_p15, 3),
        },
        "metrics": {
            "son_p20_full_season_mm": None if math.isnan(p20_full) else round(p20_full, 1),
            "dry_spell_probability_recent": round(dry_prob, 2),
            "dry_spell_trend": {**tr_dry, "variable": "veranillo más largo dic–feb", "unit": "días/década"},
        },
        "trend": {**tr, "variable": "lluvia sep–nov", "unit": "mm/década"},
        "action": action,
    }


def shift_alert(onset: pd.DataFrame, current: int) -> dict:
    done = onset[onset["onset_sday"].notna() & ~onset["provisional"] & (onset["campaign"] < current)]
    recent = done.tail(10)
    early = done.head(RECENT_N)
    recent_mean_shift = float(recent["shift_days"].mean()) if len(recent) else math.nan
    early_mean = float(early["onset_sday"].mean()) if len(early) else math.nan
    early_std = float(early["onset_sday"].std()) if len(early) > 2 else math.nan
    recent15 = done.tail(RECENT_N)
    recent_std = float(recent15["onset_sday"].std()) if len(recent15) > 2 else math.nan
    late_early = float((early["shift_days"] > SHIFT_ALERT_DAYS).mean()) if len(early) else math.nan
    late_recent = float((recent15["shift_days"] > SHIFT_ALERT_DAYS).mean()) if len(recent15) else math.nan
    recent_mean = float(recent["onset_sday"].mean()) if len(recent) else math.nan

    cur = onset[onset["campaign"] == current]
    cur_onset = float(cur["onset_sday"].iloc[0]) if len(cur) else math.nan
    cur_prov = bool(cur["provisional"].iloc[0]) if len(cur) else False
    cur_last = int(cur["last_sday"].iloc[0]) if len(cur) else -1

    status = "sin_datos"
    cur_shift = math.nan
    if not math.isnan(cur_onset):
        cur_shift = cur_onset - TRADITIONAL_SOWING_SDAY
        status = "provisional" if cur_prov else "confirmado"
    elif TRADITIONAL_SOWING_SDAY < cur_last <= ONSET_SEARCH_LAST_SDAY:
        cur_shift = cur_last - TRADITIONAL_SOWING_SDAY  # mínimo: las lluvias aún no se establecen
        status = "aun_no_inicia"
    elif cur_last > ONSET_SEARCH_LAST_SDAY:
        status = "sin_inicio"

    red = not math.isnan(cur_shift) and cur_shift > SHIFT_ALERT_DAYS
    amber = (not math.isnan(recent_mean_shift) and recent_mean_shift > 10) or (
        not math.isnan(cur_shift) and cur_shift > 10
    )
    level = _level(red, amber)
    tr = trend(done["campaign"], done["onset_sday"])

    window = None
    if len(recent) >= 3:
        lo, hi = np.percentile(recent["onset_sday"], [25, 75])
        window = {"from": sday_label(lo), "to": sday_label(hi), "from_sday": float(lo), "to_sday": float(hi)}

    if status == "aun_no_inicia":
        headline = (
            f"Al {sday_label(cur_last)} las lluvias de siembra aún no se establecen: "
            f"al menos {cur_shift:.0f} días de retraso frente a la siembra temprana de Coya Raymi (23 sep)."
        )
    elif status == "sin_inicio":
        headline = "En esta campaña no se detectó un inicio firme de lluvias entre agosto y enero."
    elif not math.isnan(cur_shift):
        word = "provisional" if cur_prov else "observado"
        headline = (
            f"Inicio de lluvias {word} el {sday_label(cur_onset)}: "
            f"{cur_shift:+.0f} días frente a la siembra temprana de Coya Raymi (23 sep)."
        )
    else:
        headline = "La campaña actual todavía no llega a la ventana de siembra tradicional."

    action = (
        f"Sembrar con lluvias firmes, en la ventana observada {window['from']} – {window['to']}, "
        "y no con la primera lluvia aislada."
        if window
        else "Esperar lluvias firmes (≥25 mm en 10 días) antes de sembrar."
    )

    return {
        "id": "ADS",
        "name": "Desfase entre el calendario ancestral y el clima actual",
        "level": level,
        "headline": headline,
        "trigger": "Inicio de lluvias (≥25 mm en 10 días, sin veranillo de 10 días después) > 21 días tras el 23 de septiembre",
        "current": {
            "campaign": current,
            "status": status,
            "onset": None if math.isnan(cur_onset) else sday_label(cur_onset),
            "onset_sday": None if math.isnan(cur_onset) else cur_onset,
            "as_of_sday": cur_last,
            "shift_days": None if math.isnan(cur_shift) else round(cur_shift),
        },
        "metrics": {
            "traditional_window": f"{sday_label(TRADITIONAL_WINDOW[0])} – {sday_label(TRADITIONAL_WINDOW[1])}",
            "mean_onset_early": None if math.isnan(early_mean) else sday_label(early_mean),
            "mean_onset_recent": None if math.isnan(recent_mean) else sday_label(recent_mean),
            "mean_onset_early_sday": None if math.isnan(early_mean) else round(early_mean, 1),
            "mean_onset_recent_sday": None if math.isnan(recent_mean) else round(recent_mean, 1),
            "early_period": _period(early),
            "recent_period": _period(recent),
            "onset_change_days": None
            if math.isnan(early_mean) or math.isnan(recent_mean)
            else round(recent_mean - early_mean),
            "recent_mean_shift_days": None if math.isnan(recent_mean_shift) else round(recent_mean_shift),
            "suggested_window": window,
            "onset_std_early_days": None if math.isnan(early_std) else round(early_std, 1),
            "onset_std_recent_days": None if math.isnan(recent_std) else round(recent_std, 1),
            "variability_period_recent": _period(recent15),
            "late_share_early": None if math.isnan(late_early) else round(late_early, 2),
            "late_share_recent": None if math.isnan(late_recent) else round(late_recent, 2),
            "rainfed_sowing_lead_days": None if math.isnan(recent_mean) else round(RAINFED_SOWING_SDAY - recent_mean),
        },
        "trend": {**tr, "variable": "fecha de inicio de lluvias", "unit": "días/década"},
        "action": action,
    }
