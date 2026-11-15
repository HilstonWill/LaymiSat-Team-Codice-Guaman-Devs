"""Simulador de siembra, pronóstico 7 días y explicación con IA (servicios externos simulados)."""

import pytest
from fastapi.testclient import TestClient

from app import ai as AI
from app import main
from app.climate import at_altitude
from app.forecast import summarize_forecast
from app.sowing import LAST_SOW_SDAY, sowing_curve


class FakeResp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status

    def json(self):
        return self._p


FORECAST = {
    "elevation": 3767.0,
    "daily": {
        "time": [f"2026-11-{d}" for d in range(15, 22)],
        "temperature_2m_min": [4.1, 1.5, 1.0, 6.0, 5.0, 4.0, None],
        "temperature_2m_max": [15, 14, 14, 16, 15, 15, 15],
        "precipitation_sum": [6.7, 0, 0, 35.0, 1, 0, 0],
    },
}


def test_sowing_curve_shape_and_window(climate):
    out = sowing_curve(at_altitude(climate, 3900), -2.0)
    assert out["curve"][0]["sday"] == 0 and out["curve"][-1]["sday"] <= LAST_SOW_SDAY
    readies = [p["rain_ready"] for p in out["curve"]]
    assert readies == sorted(readies)  # la lluvia firme solo puede "llegar", nunca irse
    assert all(0 <= p["frost_risk"] <= 1 for p in out["curve"])
    w = out["window"]
    assert w["from_sday"] <= out["best_sday"] or not w["meets_thresholds"]
    assert len(out["campaigns"]) == 15
    assert out["codex"]["rainfed_sowing_sday"] == 136


def test_sowing_low_altitude_has_less_frost(climate):
    hi = sowing_curve(at_altitude(climate, 4300), -2.0)
    lo = sowing_curve(at_altitude(climate, 3200), -2.0)
    assert sum(p["frost_risk"] for p in lo["curve"]) < sum(p["frost_risk"] for p in hi["curve"])


def test_forecast_summary_corrects_altitude_and_flags():
    s = summarize_forecast(FORECAST, altitude=3967, plant_adjust=-2.0)  # 200 m más arriba: −1,3 °C
    assert s["days"][1]["tmin_plant"] == pytest.approx(1.5 - 1.3 - 2.0, abs=0.05)
    assert s["frost_nights"] == 2 and s["level"] == "rojo"
    assert s["days"][3]["heavy_rain"] is True
    assert len(s["days"]) == 6  # el día sin dato se omite
    with pytest.raises(Exception):
        summarize_forecast({"foo": 1}, 3900, -2)


def test_ai_rate_limit():
    for i in range(AI.RATE_PER_MIN):
        AI.check_rate("1.2.3.4", now=1000 + i)
    with pytest.raises(AI.RateLimited):
        AI.check_rate("1.2.3.4", now=1010)
    AI.check_rate("1.2.3.4", now=1100)  # pasado el minuto vuelve a permitir


def test_ai_explain_grounded_request_and_errors():
    seen = {}

    def post(url, headers, json, timeout):
        seen.update(url=url, headers=headers, body=json)
        return FakeResp({"candidates": [{"content": {"parts": [{"text": "Sow after firm rains."}]}}]})

    facts = {"place": "Pisac", "alerts": []}
    out = AI.explain(facts, "en", "What now?", http_post=post, api_key="k", model="m")
    assert out["text"] == "Sow after firm rains." and out["model"] == "m"
    assert seen["headers"]["x-goog-api-key"] == "k" and "m:generateContent" in seen["url"]
    prompt = seen["body"]["contents"][0]["parts"][0]["text"]
    assert '"place": "Pisac"' in prompt and "What now?" in prompt
    assert "never invent numbers" in seen["body"]["systemInstruction"]["parts"][0]["text"]
    with pytest.raises(AI.AIUnavailable):
        AI.explain(facts, "en", api_key="")
    with pytest.raises(AI.AIUnavailable):
        AI.explain(facts, "en", http_post=lambda **k: FakeResp({}, 500), api_key="k")
    with pytest.raises(AI.AIUnavailable):
        AI.explain(facts, "en", http_post=lambda **k: FakeResp({"candidates": []}), api_key="k")


@pytest.fixture()
def api(climate):
    main.app.dependency_overrides[main.get_loader] = lambda: (lambda lat, lon: climate)
    main.app.dependency_overrides[main.get_forecast_fetcher] = lambda: (lambda lat, lon: FORECAST)
    for f in (main._report_cached, main._sowing_cached, main._rotation_ctx_cached):
        f.cache_clear()
    AI._hits.clear()
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


Q = {"lat": -13.4, "lon": -71.85, "altitude": 3900}


def test_api_sowing_and_forecast(api):
    s = api.get("/api/sowing", params=Q).json()
    assert s["curve"] and s["window"]
    f = api.get("/api/forecast", params=Q).json()
    assert f["frost_nights"] >= 1 and len(f["days"]) == 6
    assert api.get("/api/forecast", params={"lat": 40.7, "lon": -74.0, "altitude": 3900}).status_code == 422


def test_api_forecast_down(api):
    def boom(lat, lon):
        raise TimeoutError("sin red")

    main.app.dependency_overrides[main.get_forecast_fetcher] = lambda: boom
    assert api.get("/api/forecast", params=Q).status_code == 503


def test_api_explain_uses_facts_and_handles_missing_key(api):
    captured = {}

    def fake_explainer(facts, lang, question):
        captured.update(facts=facts, lang=lang, question=question)
        return {"text": "ok", "model": "fake", "generated_by": "x", "grounded_on": "y"}

    main.app.dependency_overrides[main.get_ai_explainer] = lambda: fake_explainer
    r = api.post("/api/explain", json=Q | {"lang": "es", "question": "¿Siembro ya?", "place_name": "Pisac"})
    assert r.status_code == 200 and r.json()["text"] == "ok"
    assert captured["lang"] == "es" and len(captured["facts"]["alerts"]) == 3
    assert "next_7_days" in captured["facts"] and "recommended_sowing_window_days_after_aug1" in captured["facts"]

    def no_key(facts, lang, question):
        raise AI.AIUnavailable("no key")

    main.app.dependency_overrides[main.get_ai_explainer] = lambda: no_key
    assert api.post("/api/explain", json=Q).status_code == 503
    assert api.post("/api/explain", json=Q | {"question": "x" * 301}).status_code == 422


def test_api_explain_rate_limited(api):
    main.app.dependency_overrides[main.get_ai_explainer] = lambda: (lambda f, l, q: {"text": "ok"})
    codes = [api.post("/api/explain", json=Q).status_code for _ in range(AI.RATE_PER_MIN + 1)]
    assert codes[-1] == 429


def test_health_reports_ai_flag(api, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert api.get("/api/health").json() == {"status": "ok", "ai": False}
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    assert api.get("/api/health").json()["ai"] is True
