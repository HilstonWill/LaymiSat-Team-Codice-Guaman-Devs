import pytest

from app.calendar_gp import calendar_comparison, load_calendar
from app.climate import at_altitude
from app.rotations import ClimateContext, compare, evaluate_sequence, level, load_crops

CTX = ClimateContext(
    altitude=3800,
    frost_probability=0.5,
    season_precip=[650, 700, 500, 800],
    dry_spell_probability=0.2,
    heavy_days_mean=0.5,
)


def presets():
    return load_crops()["presets"]


def test_presets_rank_legume_and_laymi_above_shortened():
    result = compare(presets(), CTX)
    by_id = {r["id"]: r for r in result["results"]}
    assert by_id["acortada"]["overall"] < by_id["laymi"]["overall"]
    assert by_id["acortada"]["overall"] < by_id["leguminosa"]["overall"]
    assert result["best_id"] in {"laymi", "leguminosa"}
    assert by_id["leguminosa"]["scores"]["suelo"] > by_id["laymi"]["scores"]["suelo"]


def test_repeated_potato_is_penalized_for_pests():
    r = evaluate_sequence(["papa", "papa", "cebada"], CTX)
    assert r["scores"]["plagas"] == 50
    assert any("Papa cada 1" in s for s in r["reasons"]["plagas"])


def test_altitude_out_of_range_is_flagged():
    ctx = ClimateContext(4300, 0.0, [700], 0.0, 0.0)
    r = evaluate_sequence(["haba", "descanso"], ctx)
    assert r["scores"]["helada"] == 75
    assert any("Haba" in s for s in r["reasons"]["helada"])


def test_slope_increases_erosion_risk():
    flat = evaluate_sequence(["papa", "cebada"], ClimateContext(3800, 0, [700], 0, 1.0, "plana"))
    steep = evaluate_sequence(["papa", "cebada"], ClimateContext(3800, 0, [700], 0, 1.0, "fuerte"))
    assert steep["scores"]["erosion"] < flat["scores"]["erosion"]


def test_invalid_sequences():
    with pytest.raises(ValueError):
        evaluate_sequence(["papa", "maiz_inexistente"], CTX)
    with pytest.raises(ValueError):
        evaluate_sequence(["papa"], CTX)


def test_level_thresholds():
    assert level(70) == "verde" and level(50) == "ambar" and level(10) == "rojo"


def test_calendar_has_twelve_months_and_indicators(climate):
    assert len(load_calendar()["months"]) == 12
    rows = calendar_comparison(at_altitude(climate, 3900), plant_adjust=-2)
    assert len(rows) == 12
    assert {r["status"] for r in rows} <= {"se_desfasa", "se_mantiene", "no_coincide", "informativo"}
    assert all(r["early"] is not None for r in rows)


def test_calendar_trend_and_plain_language():
    from app.calendar_gp import plain_value, trend_of

    # noviembre: veranillos 13,3 % -> 26,7 % de años es "peor"
    assert trend_of(13.3, 26.7, "lower_is_better", "% de años") == "worse"
    # ruido: 0,0 -> 0,1 días/mes no es un cambio
    assert trend_of(0.0, 0.1, "lower_is_better", "días/mes") == "same"
    assert trend_of(6.7, 13.3, "higher_is_better", "% de años") == "same"
    assert plain_value(13.33, 15, "% de años", "es") == "2 de 15 años"
    assert plain_value(0.7, 15, "días/mes", "es") == "0,7 días al mes"
