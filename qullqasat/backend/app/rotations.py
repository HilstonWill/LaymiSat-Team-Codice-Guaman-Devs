"""Comparador de rotaciones con reglas explícitas y trazables (0–100, más alto = mejor)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

CROPS_PATH = Path(__file__).resolve().parent / "data" / "crops.json"

WEIGHTS = {"suelo": 0.25, "plagas": 0.20, "agua": 0.20, "helada": 0.20, "erosion": 0.15}
SLOPE_FACTOR = {"plana": 0.5, "moderada": 1.0, "fuerte": 1.5}
EFFECTIVE_RAIN = 0.7  # fracción de lluvia aprovechable por el cultivo (supuesto declarado)
MIN_POTATO_GAP = 4  # años entre papas recomendados para cortar gorgojo y nematodo


@lru_cache(maxsize=1)
def load_crops() -> dict:
    return json.loads(CROPS_PATH.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class ClimateContext:
    altitude: float
    frost_probability: float  # prob. de >=1 helada (oct–dic) en campañas recientes, a esta altitud
    season_precip: list[float]  # lluvia sep–mar por campaña reciente (mm)
    dry_spell_probability: float  # prob. de veranillo >=10 días en dic–feb
    heavy_days_mean: float  # días/campaña con lluvia > 30 mm (dic–mar)
    slope: str = "moderada"


def level(score: float) -> str:
    return "verde" if score >= 70 else ("ambar" if score >= 45 else "rojo")


def _clamp(v: float) -> float:
    return max(0.0, min(100.0, v))


def evaluate_sequence(sequence: list[str], ctx: ClimateContext) -> dict:
    crops = load_crops()["crops"]
    unknown = [c for c in sequence if c not in crops]
    if unknown:
        raise ValueError(f"Cultivos desconocidos: {', '.join(unknown)}")
    if not 2 <= len(sequence) <= 10:
        raise ValueError("La secuencia debe tener entre 2 y 10 campañas")

    n = len(sequence)
    info = [crops[c] for c in sequence]
    reasons: dict[str, list[str]] = {k: [] for k in WEIGHTS}

    # Suelo: balance de nitrógeno medio por campaña
    n_total = sum(c["n_balance"] for c in info)
    avg_n = n_total / n
    suelo = _clamp(65 + 0.8 * avg_n)
    legumes = [c["name"] for c in info if c["n_balance"] > 0 and c["water_mm"] > 0]
    reasons["suelo"].append(f"Balance de N acumulado ≈ {n_total:+.0f} kg/ha en {n} campañas ({avg_n:+.0f} por campaña).")
    if legumes:
        reasons["suelo"].append(f"Leguminosas que fijan N: {', '.join(sorted(set(legumes)))}.")
    rests = sequence.count("descanso")
    if rests:
        reasons["suelo"].append(f"{rests} año(s) de descanso que recuperan materia orgánica.")

    # Plagas del suelo (gorgojo de los Andes, nematodo quiste): distancia entre papas
    potato_years = [i for i, c in enumerate(info) if c["potato_host"]]
    gaps = [b - a for a, b in zip(potato_years, potato_years[1:])]
    plagas = 100.0
    for g in gaps:
        if g == 1:
            plagas -= 50
        elif g < MIN_POTATO_GAP:
            plagas -= 35
    plagas = _clamp(plagas)
    if not gaps:
        reasons["plagas"].append("La papa aparece una sola vez: se corta el ciclo del gorgojo y del nematodo.")
    else:
        reasons["plagas"].append(
            f"Papa cada {', '.join(str(g) for g in gaps)} año(s); se recomienda ≥ {MIN_POTATO_GAP} años entre papas."
        )

    # Agua: déficit frente a la lluvia efectiva sep–mar + veranillos en fases críticas
    precip = [p for p in ctx.season_precip if p == p]
    water_risks = []
    for c in info:
        if c["water_mm"] == 0:
            water_risks.append(0.0)
            continue
        deficit_prob = (
            sum(1 for p in precip if EFFECTIVE_RAIN * p < c["water_mm"]) / len(precip) if precip else 0.0
        )
        water_risks.append(0.6 * deficit_prob + 0.4 * ctx.dry_spell_probability * c["drought_sensitivity"])
    agua = _clamp(100 - 100 * sum(water_risks) / n)
    if precip:
        reasons["agua"].append(
            f"Lluvia sep–mar media {sum(precip) / len(precip):.0f} mm "
            f"(se asume {EFFECTIVE_RAIN:.0%} aprovechable); veranillo ≥10 días en "
            f"{ctx.dry_spell_probability:.0%} de las campañas recientes."
        )
    thirsty = sorted({c["name"] for c in info if c["water_mm"] >= 500})
    if thirsty:
        reasons["agua"].append(f"Mayor demanda de agua: {', '.join(thirsty)}.")

    # Helada: probabilidad local × sensibilidad del cultivo + aptitud por altitud
    frost_risk = sum(ctx.frost_probability * (1 - c["frost_tolerance"]) for c in info) / n
    out_flags = [not c["alt_min"] <= ctx.altitude <= c["alt_max"] for c in info]
    out_of_range = sorted({c["name"] for c, out in zip(info, out_flags) if out})
    helada = _clamp(100 - 100 * frost_risk - 50 * sum(out_flags) / n)
    reasons["helada"].append(
        f"Probabilidad de helada en brotación a {ctx.altitude:.0f} m: {ctx.frost_probability:.0%} de las campañas recientes."
    )
    if out_of_range:
        reasons["helada"].append(f"Fuera de su rango de altitud habitual: {', '.join(out_of_range)}.")

    # Erosión: meses de suelo desnudo en la época de lluvias × lluvias intensas × pendiente
    bare = sum(5 - c["cover_months"] for c in info) / n
    factor = SLOPE_FACTOR.get(ctx.slope, 1.0)
    erosion = _clamp(100 - 18 * bare * (1 + ctx.heavy_days_mean) * factor)
    reasons["erosion"].append(
        f"Suelo desnudo ≈ {bare:.1f} meses por campaña en época de lluvias; "
        f"{ctx.heavy_days_mean:.1f} días/campaña con > 30 mm; pendiente {ctx.slope}."
    )

    scores = {"suelo": suelo, "plagas": plagas, "agua": agua, "helada": helada, "erosion": erosion}
    overall = sum(WEIGHTS[k] * v for k, v in scores.items())
    return {
        "sequence": sequence,
        "sequence_names": [c["name"] for c in info],
        "scores": {k: round(v) for k, v in scores.items()},
        "levels": {k: level(v) for k, v in scores.items()},
        "overall": round(overall),
        "level": level(overall),
        "reasons": reasons,
    }


def compare(sequences: list[dict], ctx: ClimateContext) -> dict:
    results = []
    for s in sequences:
        r = evaluate_sequence(list(s["sequence"]), ctx)
        r["name"] = s.get("name") or "Secuencia"
        r["id"] = s.get("id") or r["name"]
        results.append(r)
    best = max(results, key=lambda r: r["overall"]) if results else None
    return {
        "results": results,
        "best_id": best["id"] if best else None,
        "weights": WEIGHTS,
        "assumptions": [
            f"Lluvia aprovechable = {EFFECTIVE_RAIN:.0%} de la lluvia sep–mar.",
            f"Se recomiendan ≥ {MIN_POTATO_GAP} años entre dos campañas de papa.",
            "Balance de N, demanda de agua, tolerancia a helada y cobertura: valores orientativos por cultivo (crops.json).",
            "No es una predicción de rendimiento; complementa el criterio de la comunidad y del técnico.",
        ],
    }
