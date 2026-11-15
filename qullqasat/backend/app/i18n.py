"""Textos en inglés (por defecto para el jurado) y español, generados a partir de los datos estructurados.

El cálculo vive en alerts.py / rotations.py; aquí solo se redactan los mensajes.
"""

from __future__ import annotations

from datetime import date, timedelta

LANGS = ("en", "es")
MONTHS = {
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "es": ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
}
DIRECTION_EN = {
    "sin tendencia significativa": "no significant trend",
    "en aumento": "increasing",
    "en descenso": "decreasing",
}
TREND_VAR_EN = {
    "días con helada en oct–dic": ("frost days in Oct–Dec", "days/decade"),
    "lluvia sep–nov": ("Sep–Nov rainfall", "mm/decade"),
    "veranillo más largo dic–feb": ("longest Dec–Feb dry spell", "days/decade"),
    "fecha de inicio de lluvias": ("rainy-season onset date", "days/decade"),
    "Tmin media anual": ("annual mean Tmin", "°C/decade"),
}


def sday_label(sday: float, lang: str = "es") -> str:
    d = date(2001, 8, 1) + timedelta(days=int(round(sday)))
    if lang == "en":
        return f"{MONTHS['en'][d.month - 1]} {d.day}"
    return f"{d.day} {MONTHS['es'][d.month - 1]}"


def localize_trend(tr: dict, lang: str) -> dict:
    if lang != "en":
        return tr
    out = dict(tr)
    out["direction"] = DIRECTION_EN.get(tr.get("direction", ""), tr.get("direction"))
    var, unit = TREND_VAR_EN.get(tr.get("variable", ""), (tr.get("variable"), tr.get("unit")))
    out["variable"], out["unit"] = var, unit
    return out


def _alert_en(a: dict) -> dict:
    a = dict(a)
    m, cur, lvl = a["metrics"], a["current"], a["level"]
    if a["id"] == "AHS":
        prob = round((m.get("event_probability_recent") or 0) * 100)
        a["name"] = "Severe frost during potato sprouting"
        a["question"] = "Will it freeze when the potato sprouts?"
        a["headline"] = (
            f"In {prob}% of the last {m.get('recent_n')} seasons there was at least one frost "
            "of 2+ consecutive nights in Oct–Dec."
        )
        a["trigger"] = (
            "Plant-level Tmin ≤ 0 °C for ≥2 consecutive nights (Oct–Dec); plant-level Tmin = 2 m Tmin "
            f"corrected for altitude {m.get('plant_adjust_c', 0):+.1f} °C"
        )
        a["action"] = {
            "rojo": "Plant frost-tolerant native varieties (bitter potatoes, ruk'i) on the upper fields, delay "
            "sowing past the frost window and prepare smoke/irrigation frost protection.",
            "ambar": "Watch clear nights in Oct–Dec and stagger sowing over two or three dates.",
            "verde": "Low risk at this altitude: keep the usual sowing date and keep monitoring.",
        }[lvl]
    elif a["id"] == "AEH":
        a["name"] = "Water stress at sowing"
        a["question"] = "Has it rained enough to sow?"
        end = cur.get("period_end_sday")
        period = f"Sep 1 – {sday_label(end, 'en')}" if end is not None else "Sep–Nov"
        if cur.get("precip_mm") is not None and cur.get("percentile") is not None:
            a["headline"] = (
                f"Rainfall {period} of the {cur['campaign']} season: {cur['precip_mm']:.0f} mm "
                f"(percentile {cur['percentile']:.0f} vs 1991–2020; P20 = {cur['p20_mm']:.0f} mm)."
            )
        else:
            a["headline"] = "Not enough sowing-season rainfall data for this season."
        cur["period"] = period
        a["trigger"] = "Sep–Nov cumulative rainfall < 20th percentile of 1991–2020, or October surface soil wetness < P15"
        a["action"] = {
            "rojo": "Sowing rains are below normal: favour low-water crops (tarwi, quinoa, barley) on rain-fed "
            "plots and keep potatoes for plots with moisture or water ponds (qochas).",
            "ambar": "Sow with the first firm rains and protect soil moisture with mulch and early hilling.",
            "verde": "Sowing-season rainfall is within the normal range for this area.",
        }[lvl]
        dst = m.get("dry_spell_trend")
        if dst:
            m["dry_spell_trend"] = localize_trend(dst, "en")
    elif a["id"] == "ADS":
        a["name"] = "Shift between the ancestral calendar and today's climate"
        a["question"] = "Did the rains arrive when Guaman Poma's calendar says?"
        status = cur.get("status")
        shift = cur.get("shift_days")
        if status == "aun_no_inicia":
            a["headline"] = (
                f"As of {sday_label(cur['as_of_sday'], 'en')} the sowing rains have not set in: at least "
                f"{shift} days late vs the Coya Raymi early sowing (Sep 23)."
            )
        elif status == "sin_inicio":
            a["headline"] = "No firm rainy-season onset was detected between August and January this season."
        elif shift is not None and cur.get("onset_sday") is not None:
            word = "provisional" if status == "provisional" else "observed"
            a["headline"] = (
                f"Rainy-season onset {word} on {sday_label(cur['onset_sday'], 'en')}: "
                f"{shift:+d} days vs the Coya Raymi early sowing (Sep 23)."
            )
        else:
            a["headline"] = "The current season has not yet reached the traditional sowing window."
        if cur.get("onset_sday") is not None:
            cur["onset"] = sday_label(cur["onset_sday"], "en")
        a["trigger"] = (
            "Rainy-season onset (≥25 mm in 10 days, no 10-day dry spell afterwards) > 21 days after September 23"
        )
        w = m.get("suggested_window")
        if w:
            w = {**w, "from": sday_label(w["from_sday"], "en"), "to": sday_label(w["to_sday"], "en")}
            m["suggested_window"] = w
            a["action"] = (
                f"Sow with firm rains, within the observed window {w['from']} – {w['to']}, "
                "not after the first isolated rain."
            )
        else:
            a["action"] = "Wait for firm rains (≥25 mm in 10 days) before sowing."
        m["traditional_window"] = "Sep 16 – Sep 30"
        for k in ("mean_onset_early", "mean_onset_recent"):
            if m.get(f"{k}_sday") is not None:
                m[k] = sday_label(m[f"{k}_sday"], "en")
    a["metrics"], a["current"] = m, cur
    a["trend"] = localize_trend(a["trend"], "en")
    return a


QUESTIONS_ES = {
    "AHS": "¿Va a helar cuando brote la papa?",
    "AEH": "¿Llovió lo suficiente para sembrar?",
    "ADS": "¿Las lluvias llegaron cuando dice el calendario de Guaman Poma?",
}


def localize_alerts(alerts: list[dict], lang: str) -> list[dict]:
    if lang == "en":
        return [_alert_en({**a, "metrics": dict(a["metrics"]), "current": dict(a["current"])}) for a in alerts]
    return [{**a, "question": QUESTIONS_ES[a["id"]]} for a in alerts]


def pick(obj: dict, field: str, lang: str):
    """Devuelve obj[field_en] si lang=en y existe; si no, obj[field]."""
    if lang == "en" and f"{field}_en" in obj:
        return obj[f"{field}_en"]
    return obj.get(field)
