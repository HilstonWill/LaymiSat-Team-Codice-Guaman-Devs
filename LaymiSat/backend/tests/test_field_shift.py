"""Tests de lo añadido para el reto Field Shift, el inglés, NDVI (MODIS) y terreno (SRTM)."""

import json

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import main
from app import ndvi as N
from app import terrain as TR
from app.i18n import localize_alerts, sday_label
from app.rotations import ClimateContext, SoilInfo, compare, cover_months, evaluate_sequence, load_crops, normalize_weights
from app.service import build_report

CTX = ClimateContext(3800, 0.5, [650, 700, 500, 800], 0.2, 0.5)
MONTHS = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7]


class FakeResp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status

    def json(self):
        return self._p


# ---------- rotaciones: prioridades, suelo, cobertura, vacíos y riesgos ----------

def test_default_priorities_match_original_weights():
    w = normalize_weights(None)
    assert w["suelo"] == pytest.approx(0.25) and w["erosion"] == pytest.approx(0.15)
    assert w["forraje"] == 0 and w["ingresos"] == 0
    assert normalize_weights({k: 0 for k in w}) == w  # todo en cero → valores por defecto


def test_priorities_change_the_ranking():
    presets = load_crops()["presets"]
    zero = {k: 0 for k in normalize_weights(None)}
    soil_first = compare(presets, CTX, zero | {"suelo": 3}, "es")
    assert soil_first["best_id"] == "leguminosa"
    forage_first = compare(presets, CTX, zero | {"forraje": 3}, "es")
    by = {r["id"]: r for r in forage_first["results"]}
    assert by["acortada"]["overall"] == by["acortada"]["scores"]["forraje"]


def test_cover_months_follow_crop_calendar():
    crops = load_crops()["crops"]
    covered = [m for m, c in zip(MONTHS, cover_months(crops["papa"])) if c]
    assert covered == [12, 1, 2, 3, 4, 5]  # siembra en oct, cubre de dic a may
    assert all(cover_months(crops["descanso"]))
    cebada = dict(zip(MONTHS, cover_months(crops["cebada"])))
    assert not cebada[11] and not cebada[12] and cebada[1]


def test_soil_texture_and_organic_matter_matter():
    poor = ClimateContext(3800, 0.5, [500, 520], 0.2, 1.0, "fuerte", SoilInfo("arenoso", "baja", True))
    rich = ClimateContext(3800, 0.5, [500, 520], 0.2, 1.0, "fuerte", SoilInfo("arcilloso", "alta", True))
    a = evaluate_sequence(["papa", "cebada"], poor)
    b = evaluate_sequence(["papa", "cebada"], rich)
    assert b["scores"]["suelo"] > a["scores"]["suelo"]
    assert b["scores"]["agua"] >= a["scores"]["agua"]
    assert b["scores"]["erosion"] > a["scores"]["erosion"]
    assert "declarado por el usuario" in a["info_gaps"][0]


def test_gaps_and_risks_are_reported_in_english():
    r = evaluate_sequence(["papa", "cebada", "papa", "tarwi"], CTX, lang="en")
    assert any("weevil" in x for x in r["risks"])
    assert any("debittering" in x for x in r["risks"])
    assert r["risks"][-1].startswith("Changing the rotation")
    assert any("not a forecast" in g for g in r["info_gaps"])
    assert r["sequence_names"][3] == "Tarwi (Andean lupin)"
    assert len(r["timeline"]) == 4 and len(r["timeline"][0]["covered"]) == 12


def test_market_gap_only_when_income_is_prioritised():
    r = evaluate_sequence(["papa", "quinua"], CTX, normalize_weights({"ingresos": 2}), "en")
    assert any("market prices" in g for g in r["info_gaps"])
    r2 = evaluate_sequence(["papa", "quinua"], CTX, None, "en")
    assert not any("market prices" in g for g in r2["info_gaps"])


# ---------- inglés ----------

def test_sday_label_both_languages():
    assert sday_label(53, "en") == "Sep 23" and sday_label(53, "es") == "23 sep"


def test_report_in_english(climate):
    rep = build_report(climate, 3900, -2.0, "en")
    ids = {a["id"]: a for a in rep["alerts"]}
    assert ids["AHS"]["question"] == "Will it freeze when the potato sprouts?"
    assert "seasons" in ids["AHS"]["headline"]
    assert ids["ADS"]["metrics"]["traditional_window"] == "Sep 16 – Sep 30"
    assert rep["tmin_trend"]["unit"] == "°C/decade"
    assert rep["calendar"][0]["name"] == "August"
    assert rep["calendar"][0]["data_sentence"] in {
        "Better than before", "Worse than before", "About the same as before",
        "Higher than before", "Lower than before",
    }
    assert rep["calendar"][0]["plain_now"].endswith(("years", "a month", "mm", "°C"))
    json.dumps(rep, allow_nan=False)


def test_spanish_alerts_get_questions(climate):
    rep = build_report(climate, 3900, -2.0, "es")
    assert rep["alerts"][0]["question"].startswith("¿Va a helar")
    assert rep["calendar"][1]["action"].startswith("Sembrar la papa temprana")
    assert rep["calendar"][4]["quechua"] == "Capac Inti Raymi Quilla" and rep["calendar"][4]["page"] == 1174


def test_localize_water_alert_without_data():
    a = {"id": "AEH", "level": "verde", "metrics": {}, "current": {"campaign": 2026}, "trend": {}}
    out = localize_alerts([a], "en")[0]
    assert out["headline"].startswith("Not enough")


def test_localize_shift_alert_statuses():
    base = {"id": "ADS", "level": "rojo", "metrics": {}, "trend": {}}
    late = localize_alerts([{**base, "current": {"status": "aun_no_inicia", "as_of_sday": 100, "shift_days": 47}}], "en")[0]
    assert "have not set in" in late["headline"]
    none = localize_alerts([{**base, "current": {"status": "sin_inicio"}}], "en")[0]
    assert "No firm" in none["headline"]
    assert none["action"].startswith("Wait for firm rains")
    pending = localize_alerts([{**base, "current": {"status": "sin_datos"}}], "en")[0]
    assert "not yet reached" in pending["headline"]


# ---------- NDVI MODIS (ORNL) ----------

def fake_ornl(dates):
    def get(url, params, headers, timeout):
        if url.endswith("/dates"):
            return FakeResp({"dates": [{"modis_date": f"A{i}", "calendar_date": d} for i, d in enumerate(dates)]})
        start, end = int(params["startDate"][1:]), int(params["endDate"][1:])
        sub = []
        for i in range(start, end + 1):
            month = int(dates[i][5:7])
            green = 6500 if month in (1, 2, 3) else 2500
            sub.append({"calendar_date": dates[i], "data": [green if i % 7 else -3000]})
        return FakeResp({"subset": sub})

    return get


def test_fetch_ndvi_chunks_and_scales():
    dates = [d.date().isoformat() for d in pd.date_range("2001-01-01", periods=25, freq="16D")]
    s = N.fetch_ndvi(-13.4, -71.85, http_get=fake_ornl(dates), pause_s=0)
    assert len(s) == 25
    assert s.max() == pytest.approx(0.65)
    assert s.isna().sum() == 4  # valores de relleno (-3000) → NaN


def test_ndvi_cache_and_summary(tmp_path, monkeypatch):
    monkeypatch.setattr(N.time, "sleep", lambda s: None)
    dates = [d.date().isoformat() for d in pd.date_range("2000-02-18", "2025-12-31", freq="16D")]
    got = N.load_ndvi(-13.4, -71.85, cache_dir=tmp_path, http_get=fake_ornl(dates))
    assert got is not None and got[1] == "live"
    again = N.load_ndvi(-13.4, -71.85, cache_dir=tmp_path, allow_fetch=False)
    assert again[1] == "cache"
    summ = N.ndvi_summary(*again)
    assert summ["peak_month"] in (1, 2, 3)
    assert 8 in summ["bare_months_recent"] and 2 not in summ["bare_months_recent"]
    assert len(summ["seasonal"]) == 12


def test_ndvi_service_down(tmp_path, monkeypatch):
    monkeypatch.setattr(N.time, "sleep", lambda s: None)

    def down(url, params, headers, timeout):
        raise TimeoutError("ORNL lento")

    assert N.load_ndvi(-13.4, -71.85, cache_dir=tmp_path, http_get=down) is None
    assert N.load_ndvi(-13.4, -71.85, cache_dir=tmp_path, allow_fetch=False) is None

    def bad_status(url, params, headers, timeout):
        return FakeResp({}, 500)

    with pytest.raises(Exception):
        N.fetch_ndvi(-13.4, -71.85, http_get=bad_status, pause_s=0)


def test_ndvi_skips_failed_chunks(monkeypatch):
    monkeypatch.setattr(N.time, "sleep", lambda s: None)
    dates = [d.date().isoformat() for d in pd.date_range("2001-01-01", periods=30, freq="16D")]
    good = fake_ornl(dates)
    calls = {"n": 0}

    def flaky(url, params, headers, timeout):
        if url.endswith("/subset") and params["startDate"] == "A10":
            raise TimeoutError("tramo lento")
        calls["n"] += 1
        return good(url, params, headers, timeout)

    s = N.fetch_ndvi(-13.4, -71.85, http_get=flaky, pause_s=0)
    assert len(s) == 20  # se salta un tramo de 10 compuestos


# ---------- terreno SRTM ----------

def test_terrain_slope_classes():
    assert TR.slope_class(2) == "plana" and TR.slope_class(10) == "moderada" and TR.slope_class(25) == "fuerte"


def test_fetch_terrain_computes_slope(monkeypatch):
    monkeypatch.setattr(TR.time, "sleep", lambda s: None)

    def get(url, params, timeout):
        assert "srtm30m" in url and params["locations"].count("|") == 2
        return FakeResp({"results": [{"elevation": 3750}, {"elevation": 3730}, {"elevation": 3779}]})

    out = TR.fetch_terrain(-13.4, -71.85, http_get=get)
    assert out["elevation_m"] == 3750 and out["slope_class"] == "fuerte"
    assert "SRTM" in out["source"]


def test_fetch_terrain_errors(monkeypatch):
    monkeypatch.setattr(TR.time, "sleep", lambda s: None)
    with pytest.raises(Exception):
        TR.fetch_terrain(-13.4, -71.85, http_get=lambda url, params, timeout: FakeResp({}, 500))
    with pytest.raises(Exception):
        TR.fetch_terrain(
            -13.4, -71.85, http_get=lambda url, params, timeout: FakeResp({"results": [{"elevation": None}] * 3})
        )
    with pytest.raises(ValueError):
        TR.fetch_terrain(40.7, -74.0, http_get=lambda url, params, timeout: FakeResp({}))


# ---------- API ----------

@pytest.fixture()
def api(climate):
    main.app.dependency_overrides[main.get_loader] = lambda: (lambda lat, lon: climate)
    main._report_cached.cache_clear()
    main._rotation_ctx_cached.cache_clear()
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def test_api_report_english_by_default(api):
    q = {"lat": -13.4, "lon": -71.85, "altitude": 3900}
    assert api.get("/api/report", params=q).json()["alerts"][0]["name"].startswith("Severe frost")
    assert api.get("/api/report", params=q | {"lang": "es"}).json()["alerts"][0]["name"].startswith("Heladas")
    assert api.get("/api/report", params=q | {"lang": "fr"}).status_code == 422


def test_api_rotations_with_soil_and_priorities(api):
    presets = api.get("/api/crops").json()["presets"]
    r = api.post(
        "/api/rotations",
        json={
            "lat": -13.4, "lon": -71.85, "altitude": 3900, "lang": "en",
            "soil": {"texture": "arenoso", "organic_matter": "baja", "declared": True},
            "priorities": {"agua": 3, "forraje": 2},
            "sequences": presets,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["context"]["soil"]["texture"] == "arenoso"
    assert body["weights"]["forraje"] > 0
    assert body["results"][0]["name"] == "Full laymi (traditional)"
    assert body["results"][0]["timeline"] and body["results"][0]["risks"]
    bad = api.post(
        "/api/rotations",
        json={"lat": -13.4, "lon": -71.85, "altitude": 3900, "priorities": {"agua": 9}, "sequences": presets},
    )
    assert bad.status_code == 422


def test_api_ndvi_only_for_pilot_zones(api, monkeypatch):
    series = pd.Series([0.5, 0.6], index=pd.to_datetime(["2020-01-01", "2020-02-01"]))
    monkeypatch.setattr(main, "load_ndvi", lambda lat, lon: (series, "cache"))
    main._ndvi_cached.cache_clear()
    ok = api.get("/api/ndvi", params={"lat": -13.40, "lon": -71.85})
    assert ok.status_code == 200 and ok.json()["zone_id"] == "pisac-parque-papa"
    assert api.get("/api/ndvi", params={"lat": -12.0, "lon": -72.5}).status_code == 404
    monkeypatch.setattr(main, "load_ndvi", lambda lat, lon: None)
    main._ndvi_cached.cache_clear()
    assert api.get("/api/ndvi", params={"lat": -13.61, "lon": -71.56}).status_code == 503
    main._ndvi_cached.cache_clear()


def test_api_terrain(api, monkeypatch):
    fake = {"elevation_m": 3800, "slope_deg": 8.0, "slope_class": "moderada", "source": "SRTM"}
    monkeypatch.setattr(main, "terrain_cached", lambda lat, lon: fake)
    assert api.get("/api/terrain", params={"lat": -13.4, "lon": -71.85}).json()["elevation_m"] == 3800

    def boom(lat, lon):
        raise TimeoutError("sin red")

    monkeypatch.setattr(main, "terrain_cached", boom)
    assert api.get("/api/terrain", params={"lat": -13.4, "lon": -71.85}).status_code == 503
