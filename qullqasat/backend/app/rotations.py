"""Comparador de rotaciones con reglas explícitas y trazables (0–100, más alto = mejor).

Responde al reto Field Shift: combina observaciones NASA (clima de la parcela), información local del suelo,
características de los cultivos y las prioridades del agricultor. Es un plan para próximas campañas evaluado
con el clima observado reciente; no es un pronóstico.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

CROPS_PATH = Path(__file__).resolve().parent / "data" / "crops.json"

CRITERIA = ("suelo", "plagas", "agua", "helada", "erosion", "forraje", "ingresos")
# Prioridades por defecto (escala 0–3); normalizadas equivalen a 25/20/20/20/15 % del MVP original.
DEFAULT_PRIORITIES = {"suelo": 2.5, "plagas": 2.0, "agua": 2.0, "helada": 2.0, "erosion": 1.5, "forraje": 0.0, "ingresos": 0.0}
SLOPE_FACTOR = {"plana": 0.5, "moderada": 1.0, "fuerte": 1.5}
BASE_EFFECTIVE_RAIN = 0.7  # fracción de lluvia aprovechable (supuesto declarado)
TEXTURE_RAIN = {"arenoso": -0.10, "franco": 0.0, "arcilloso": 0.05}
TEXTURE_ERODIBILITY = {"arenoso": 0.85, "franco": 1.0, "arcilloso": 0.8}
OM_RAIN = {"baja": -0.05, "media": 0.0, "alta": 0.05}
OM_ERODIBILITY = {"baja": 1.15, "media": 1.0, "alta": 0.85}
OM_SOIL_BONUS = {"baja": -8, "media": 0, "alta": 8}
MIN_POTATO_GAP = 4  # años entre papas recomendados para cortar gorgojo y nematodo
CAMPAIGN_MONTHS = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7]  # agosto → julio
RAINY = {11, 12, 1, 2, 3}

T = {
    "es": {
        "n_balance": "Balance de N acumulado ≈ {total:+.0f} kg/ha en {n} campañas ({avg:+.0f} por campaña).",
        "legumes": "Leguminosas que fijan N: {names}.",
        "rest": "{n} año(s) de descanso que recuperan materia orgánica.",
        "om": "Materia orgánica del suelo declarada: {om}.",
        "pest_once": "La papa aparece una sola vez: se corta el ciclo del gorgojo y del nematodo.",
        "pest_gaps": "Papa cada {gaps} año(s); se recomiendan ≥ {min} años entre papas.",
        "water": "Lluvia sep–mar media {rain:.0f} mm ({eff:.0%} aprovechable en suelo {tex}); veranillo ≥10 días en {dry:.0%} de las campañas recientes.",
        "thirsty": "Mayor demanda de agua: {names}.",
        "frost": "Probabilidad de helada en brotación a {alt:.0f} m: {p:.0%} de las campañas recientes.",
        "alt_out": "Fuera de su rango de altitud habitual: {names}.",
        "erosion": "Suelo desnudo ≈ {bare:.1f} meses por campaña en época de lluvias (nov–mar); {heavy:.1f} días/campaña con > 30 mm; pendiente {slope}; suelo {tex}.",
        "forage": "Valor forrajero medio (paja, rastrojo, pasto): {v:.0%}.",
        "income": "Índice relativo de mercado: {v:.0%} (no incluye precios locales).",
        "gap_soil_default": "Suelo no medido: se asumió textura franca y materia orgánica media.",
        "gap_soil_user": "Suelo declarado por el usuario, sin análisis de laboratorio.",
        "gap_crops": "Valores por cultivo orientativos (crops.json), sin validar con la Agencia Agraria.",
        "gap_grid": "Clima de una celda NASA POWER de ~55 km: no distingue quebradas ni laderas.",
        "gap_market": "Sin precios de mercado locales: 'ingresos' es un índice relativo.",
        "gap_future": "Se asume que las próximas campañas se parecen a las de 2011–2025 (no es un pronóstico).",
        "risk_pest": "Papa con menos de {min} años de intervalo: acumulación de gorgojo de los Andes y nematodo quiste.",
        "risk_alt": "Cultivo fuera de su rango de altitud: {names}.",
        "risk_assembly": "Cambiar la rotación de un sector comunal requiere acuerdo en la asamblea.",
        "assumptions": [
            "Lluvia aprovechable = {eff:.0%} de la lluvia sep–mar (según textura y materia orgánica).",
            "Se recomiendan ≥ {min} años entre dos campañas de papa.",
            "Cobertura del suelo calculada con el calendario de siembra y cosecha de cada cultivo (crops.json).",
            "Plan para las próximas campañas evaluado con el clima observado de 2011–2025; no es un pronóstico.",
            "No predice rendimientos; apoya el criterio de la comunidad y del técnico.",
        ],
        "soil_labels": {"arenoso": "arenoso", "franco": "franco", "arcilloso": "arcilloso", "baja": "baja", "media": "media", "alta": "alta"},
        "slope_labels": {"plana": "plana", "moderada": "moderada", "fuerte": "fuerte"},
    },
    "en": {
        "n_balance": "Cumulative N balance ≈ {total:+.0f} kg/ha over {n} seasons ({avg:+.0f} per season).",
        "legumes": "Nitrogen-fixing legumes: {names}.",
        "rest": "{n} fallow year(s) that rebuild organic matter.",
        "om": "Declared soil organic matter: {om}.",
        "pest_once": "Potato appears only once: the weevil and nematode cycle is broken.",
        "pest_gaps": "Potato every {gaps} year(s); ≥ {min} years between potato crops are recommended.",
        "water": "Mean Sep–Mar rainfall {rain:.0f} mm ({eff:.0%} usable on {tex} soil); 10+ day dry spell in {dry:.0%} of recent seasons.",
        "thirsty": "Highest water demand: {names}.",
        "frost": "Probability of frost at sprouting at {alt:.0f} m: {p:.0%} of recent seasons.",
        "alt_out": "Outside its usual altitude range: {names}.",
        "erosion": "Bare soil ≈ {bare:.1f} months per season during the rains (Nov–Mar); {heavy:.1f} days/season above 30 mm; {slope} slope; {tex} soil.",
        "forage": "Mean forage value (straw, stubble, pasture): {v:.0%}.",
        "income": "Relative market index: {v:.0%} (local prices not included).",
        "gap_soil_default": "Soil not measured: loam texture and medium organic matter assumed.",
        "gap_soil_user": "Soil declared by the user, no laboratory analysis.",
        "gap_crops": "Indicative crop values (crops.json), not yet validated with the local agricultural agency.",
        "gap_grid": "Climate from a ~55 km NASA POWER cell: it cannot resolve valleys or slopes.",
        "gap_market": "No local market prices: 'income' is a relative index.",
        "gap_future": "Next seasons are assumed to resemble 2011–2025 (this is not a forecast).",
        "risk_pest": "Potato less than {min} years apart: build-up of Andean potato weevil and cyst nematodes.",
        "risk_alt": "Crop outside its altitude range: {names}.",
        "risk_assembly": "Changing the rotation of a communal sector needs agreement in the community assembly.",
        "assumptions": [
            "Usable rainfall = {eff:.0%} of Sep–Mar rainfall (depends on texture and organic matter).",
            "≥ {min} years between two potato crops are recommended.",
            "Soil cover computed from each crop's sowing and harvest calendar (crops.json).",
            "Plan for the coming seasons evaluated with the observed 2011–2025 climate; this is not a forecast.",
            "It does not predict yields; it supports the judgement of the community and the extension agent.",
        ],
        "soil_labels": {"arenoso": "sandy", "franco": "loam", "arcilloso": "clay", "baja": "low", "media": "medium", "alta": "high"},
        "slope_labels": {"plana": "flat", "moderada": "moderate", "fuerte": "steep"},
    },
}


@lru_cache(maxsize=1)
def load_crops() -> dict:
    return json.loads(CROPS_PATH.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class SoilInfo:
    texture: str = "franco"
    organic_matter: str = "media"
    declared: bool = False


@dataclass(frozen=True)
class ClimateContext:
    altitude: float
    frost_probability: float  # prob. de >=1 helada (oct–dic) en campañas recientes, a esta altitud
    season_precip: list[float]  # lluvia sep–mar por campaña reciente (mm)
    dry_spell_probability: float  # prob. de veranillo >=10 días en dic–feb
    heavy_days_mean: float  # días/campaña con lluvia > 30 mm (dic–mar)
    slope: str = "moderada"
    soil: SoilInfo = field(default_factory=SoilInfo)


def level(score: float) -> str:
    return "verde" if score >= 70 else ("ambar" if score >= 45 else "rojo")


def _clamp(v: float) -> float:
    return max(0.0, min(100.0, v))


def normalize_weights(priorities: dict[str, float] | None) -> dict[str, float]:
    pr = {**DEFAULT_PRIORITIES, **(priorities or {})}
    pr = {k: max(0.0, float(pr.get(k, 0))) for k in CRITERIA}
    total = sum(pr.values())
    if total <= 0:
        pr = dict(DEFAULT_PRIORITIES)
        total = sum(pr.values())
    return {k: v / total for k, v in pr.items()}


def cover_months(crop: dict) -> list[bool]:
    """Cobertura del suelo para cada mes de la campaña (ago → jul)."""
    if crop["sow_month"] == 0:  # descanso: pasto natural todo el año
        return [True] * 12
    start = (crop["sow_month"] + crop["canopy_months"] - 1) % 12 + 1
    end = crop["harvest_month"]
    covered = set()
    m = start
    for _ in range(12):
        covered.add(m)
        if m == end:
            break
        m = m % 12 + 1
    return [mo in covered for mo in CAMPAIGN_MONTHS]


def effective_rain(soil: SoilInfo) -> float:
    return BASE_EFFECTIVE_RAIN + TEXTURE_RAIN.get(soil.texture, 0.0) + OM_RAIN.get(soil.organic_matter, 0.0)


def _names(info: list[dict], lang: str) -> list[str]:
    key = "name_en" if lang == "en" else "name"
    return [c.get(key, c["name"]) for c in info]


def evaluate_sequence(
    sequence: list[str], ctx: ClimateContext, weights: dict[str, float] | None = None, lang: str = "es"
) -> dict:
    crops = load_crops()["crops"]
    unknown = [c for c in sequence if c not in crops]
    if unknown:
        raise ValueError(f"Cultivos desconocidos: {', '.join(unknown)}")
    if not 2 <= len(sequence) <= 10:
        raise ValueError("La secuencia debe tener entre 2 y 10 campañas")
    t = T["en" if lang == "en" else "es"]
    w = weights or normalize_weights(None)
    soil = ctx.soil
    tex = t["soil_labels"][soil.texture]
    om = t["soil_labels"][soil.organic_matter]

    n = len(sequence)
    info = [crops[c] for c in sequence]
    names = _names(info, lang)
    reasons: dict[str, list[str]] = {k: [] for k in CRITERIA}

    # Suelo: balance de nitrógeno medio por campaña + materia orgánica declarada
    n_total = sum(c["n_balance"] for c in info)
    avg_n = n_total / n
    suelo = _clamp(65 + 0.8 * avg_n + OM_SOIL_BONUS[soil.organic_matter])
    reasons["suelo"].append(t["n_balance"].format(total=n_total, n=n, avg=avg_n))
    legumes = sorted({nm for c, nm in zip(info, names) if c["n_balance"] > 0 and c["water_mm"] > 0})
    if legumes:
        reasons["suelo"].append(t["legumes"].format(names=", ".join(legumes)))
    rests = sequence.count("descanso")
    if rests:
        reasons["suelo"].append(t["rest"].format(n=rests))
    reasons["suelo"].append(t["om"].format(om=om))

    # Plagas del suelo (gorgojo de los Andes, nematodo quiste): distancia entre papas
    potato_years = [i for i, c in enumerate(info) if c["potato_host"]]
    gaps = [b - a for a, b in zip(potato_years, potato_years[1:])]
    plagas = 100.0
    for g in gaps:
        plagas -= 50 if g == 1 else (35 if g < MIN_POTATO_GAP else 0)
    plagas = _clamp(plagas)
    reasons["plagas"].append(
        t["pest_once"] if not gaps else t["pest_gaps"].format(gaps=", ".join(map(str, gaps)), min=MIN_POTATO_GAP)
    )

    # Agua: déficit frente a la lluvia efectiva sep–mar + veranillos en fases críticas
    eff = effective_rain(soil)
    precip = [p for p in ctx.season_precip if p == p]
    water_risks = []
    for c in info:
        if c["water_mm"] == 0:
            water_risks.append(0.0)
            continue
        deficit = sum(1 for p in precip if eff * p < c["water_mm"]) / len(precip) if precip else 0.0
        water_risks.append(0.6 * deficit + 0.4 * ctx.dry_spell_probability * c["drought_sensitivity"])
    agua = _clamp(100 - 100 * sum(water_risks) / n)
    if precip:
        reasons["agua"].append(
            t["water"].format(rain=sum(precip) / len(precip), eff=eff, tex=tex, dry=ctx.dry_spell_probability)
        )
    thirsty = sorted({nm for c, nm in zip(info, names) if c["water_mm"] >= 500})
    if thirsty:
        reasons["agua"].append(t["thirsty"].format(names=", ".join(thirsty)))

    # Helada: probabilidad local × sensibilidad del cultivo + aptitud por altitud
    frost_risk = sum(ctx.frost_probability * (1 - c["frost_tolerance"]) for c in info) / n
    out_flags = [not c["alt_min"] <= ctx.altitude <= c["alt_max"] for c in info]
    out_names = sorted({nm for nm, out in zip(names, out_flags) if out})
    helada = _clamp(100 - 100 * frost_risk - 50 * sum(out_flags) / n)
    reasons["helada"].append(t["frost"].format(alt=ctx.altitude, p=ctx.frost_probability))
    if out_names:
        reasons["helada"].append(t["alt_out"].format(names=", ".join(out_names)))

    # Erosión: meses de suelo desnudo en lluvias × lluvias intensas × pendiente × erodabilidad del suelo
    timeline = [cover_months(c) for c in info]
    rainy_idx = [i for i, m in enumerate(CAMPAIGN_MONTHS) if m in RAINY]
    bare = sum(sum(1 for i in rainy_idx if not cov[i]) for cov in timeline) / n
    factor = SLOPE_FACTOR.get(ctx.slope, 1.0) * TEXTURE_ERODIBILITY[soil.texture] * OM_ERODIBILITY[soil.organic_matter]
    erosion = _clamp(100 - 18 * bare * (1 + ctx.heavy_days_mean) * factor)
    reasons["erosion"].append(
        t["erosion"].format(bare=bare, heavy=ctx.heavy_days_mean, slope=t["slope_labels"][ctx.slope], tex=tex)
    )

    # Forraje e ingresos (prioridades opcionales del agricultor)
    forraje = _clamp(100 * sum(c["forage"] for c in info) / n)
    ingresos = _clamp(100 * sum(c["market"] for c in info) / n)
    reasons["forraje"].append(t["forage"].format(v=forraje / 100))
    reasons["ingresos"].append(t["income"].format(v=ingresos / 100))

    scores = {
        "suelo": suelo, "plagas": plagas, "agua": agua, "helada": helada,
        "erosion": erosion, "forraje": forraje, "ingresos": ingresos,
    }
    overall = sum(w[k] * v for k, v in scores.items())

    # Vacíos de información y riesgos que requieren revisión local (pedido explícito del reto)
    gaps_info = [
        t["gap_soil_user"] if soil.declared else t["gap_soil_default"],
        t["gap_crops"],
        t["gap_grid"],
        t["gap_future"],
    ]
    if w.get("ingresos", 0) > 0:
        gaps_info.append(t["gap_market"])
    risk_key = "risk_en" if lang == "en" else "risk"
    risks: list[str] = []
    if any(g < MIN_POTATO_GAP for g in gaps):
        risks.append(t["risk_pest"].format(min=MIN_POTATO_GAP))
    if out_names:
        risks.append(t["risk_alt"].format(names=", ".join(out_names)))
    seen = set()
    for c in info:
        r = c.get(risk_key)
        if r and r not in seen and not (c["potato_host"] and gaps):
            seen.add(r)
            risks.append(r)
    risks.append(t["risk_assembly"])

    return {
        "sequence": sequence,
        "sequence_names": names,
        "scores": {k: round(v) for k, v in scores.items()},
        "levels": {k: level(v) for k, v in scores.items()},
        "overall": round(overall),
        "level": level(overall),
        "reasons": reasons,
        "timeline": [{"crop": c, "name": nm, "covered": cov} for c, nm, cov in zip(sequence, names, timeline)],
        "bare_rainy_months_per_season": round(bare, 2),
        "info_gaps": gaps_info,
        "risks": risks,
    }


def compare(
    sequences: list[dict],
    ctx: ClimateContext,
    priorities: dict[str, float] | None = None,
    lang: str = "es",
) -> dict:
    weights = normalize_weights(priorities)
    results = []
    for s in sequences:
        r = evaluate_sequence(list(s["sequence"]), ctx, weights, lang)
        r["name"] = (s.get("name_en") if lang == "en" and s.get("name_en") else s.get("name")) or "Secuencia"
        r["id"] = s.get("id") or r["name"]
        results.append(r)
    best = max(results, key=lambda r: r["overall"]) if results else None
    t = T["en" if lang == "en" else "es"]
    eff = effective_rain(ctx.soil)
    return {
        "results": results,
        "best_id": best["id"] if best else None,
        "weights": {k: round(v, 3) for k, v in weights.items()},
        "campaign_months": CAMPAIGN_MONTHS,
        "rainy_months": sorted(RAINY),
        "assumptions": [a.format(eff=eff, min=MIN_POTATO_GAP) for a in t["assumptions"]],
    }
