import json
import os
import time
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import main
from app.climate import (
    ClimateDataError,
    load_climate,
    parse_power_json,
    temperature_offset,
    validate_location,
)


def power_payload(days=3):
    dates = [f"202401{d:02d}" for d in range(1, days + 1)]
    param = lambda v: {d: v for d in dates}  # noqa: E731
    return {
        "geometry": {"coordinates": [-71.85, -13.4, 3739.76]},
        "properties": {
            "parameter": {
                "T2M_MIN": param(3.5),
                "T2M_MAX": param(15.0),
                "PRECTOTCORR": {**param(2.0), dates[0]: -999.0},
                "RH2M": param(70.0),
                "ALLSKY_SFC_SW_DWN": param(20.0),
                "GWETTOP": param(0.4),
            }
        },
    }


class FakeResp:
    def __init__(self, payload, status=200):
        self._payload, self.status_code = payload, status

    def json(self):
        return self._payload


def test_parse_power_json_replaces_fill_values():
    df, elev = parse_power_json(power_payload())
    assert elev == pytest.approx(3739.76)
    assert df["prec"].isna().sum() == 1
    assert list(df.columns) == ["tmin", "tmax", "prec", "rh", "rad", "gwet"]


def test_parse_power_json_rejects_bad_payload():
    with pytest.raises(ClimateDataError):
        parse_power_json({"foo": 1})
    with pytest.raises(ClimateDataError):
        parse_power_json({"geometry": {"coordinates": [0, 0, 1]}, "properties": {"parameter": {}}})


def test_temperature_offset_lapse_rate():
    assert temperature_offset(3740, 4240) == pytest.approx(-3.25)
    assert temperature_offset(3740, 3240) == pytest.approx(3.25)


def test_validate_location_restricts_to_cusco():
    validate_location(-13.4, -71.85)
    with pytest.raises(ValueError):
        validate_location(40.7, -74.0)


def test_load_climate_fetches_caches_and_falls_back(tmp_path):
    calls = []

    def ok_get(url, params, timeout):
        calls.append(params)
        assert url.startswith("https://power.larc.nasa.gov/")
        return FakeResp(power_payload())

    live = load_climate(-13.4, -71.85, cache_dir=tmp_path, http_get=ok_get, today=date(2024, 1, 10))
    assert live.source == "live" and len(calls) == 1
    assert calls[0]["community"] == "AG"

    cached = load_climate(-13.4, -71.85, cache_dir=tmp_path, http_get=ok_get)
    assert cached.source == "cache" and len(calls) == 1

    def bad_get(url, params, timeout):
        raise TimeoutError("sin red")

    old = time.time() - 10 * 24 * 3600
    for f in tmp_path.iterdir():
        os.utime(f, (old, old))
    stale = load_climate(-13.4, -71.85, cache_dir=tmp_path, http_get=bad_get)
    assert stale.source == "stale-cache"
    assert stale.last_date == date(2024, 1, 3)


def test_load_climate_without_cache_raises(tmp_path):
    def err_get(url, params, timeout):
        return FakeResp({}, status=500)

    with pytest.raises(ClimateDataError):
        load_climate(-13.4, -71.85, cache_dir=tmp_path, http_get=err_get)


@pytest.fixture()
def client(climate):
    main.app.dependency_overrides[main.get_loader] = lambda: (lambda lat, lon: climate)
    main._report_cached.cache_clear()
    main._rotation_ctx_cached.cache_clear()
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def test_static_endpoints(client):
    assert client.get("/api/health").json()["status"] == "ok"
    assert len(client.get("/api/zones").json()) == 4
    assert len(client.get("/api/calendar").json()["months"]) == 12
    assert "papa" in client.get("/api/crops").json()["crops"]


def test_report_endpoint(client):
    r = client.get("/api/report", params={"lat": -13.4, "lon": -71.85, "altitude": 3900})
    assert r.status_code == 200
    body = r.json()
    assert [a["id"] for a in body["alerts"]] == ["AHS", "AEH", "ADS"]
    assert len(body["calendar"]) == 12
    assert len(body["frost_by_altitude"]) == 7
    assert body["location"]["temperature_offset_c"] == pytest.approx(-1.04, abs=0.01)
    json.dumps(body, allow_nan=False)  # JSON estricto, sin NaN


def test_report_rejects_points_outside_cusco(client):
    r = client.get("/api/report", params={"lat": 40.7, "lon": -74.0, "altitude": 3900})
    assert r.status_code == 422


def test_report_returns_503_when_data_unavailable():
    def failing(lat, lon):
        raise ClimateDataError("x")

    main.app.dependency_overrides[main.get_loader] = lambda: failing
    main._report_cached.cache_clear()
    try:
        r = TestClient(main.app).get("/api/report", params={"lat": -13.41, "lon": -71.85, "altitude": 3900})
        assert r.status_code == 503
    finally:
        main.app.dependency_overrides.clear()


def test_rotations_endpoint(client):
    presets = client.get("/api/crops").json()["presets"]
    r = client.post(
        "/api/rotations",
        json={"lat": -13.4, "lon": -71.85, "altitude": 3900, "slope": "fuerte", "sequences": presets},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["results"]) == 3 and body["context"]["slope"] == "fuerte"
    bad = client.post(
        "/api/rotations",
        json={"lat": -13.4, "lon": -71.85, "altitude": 3900, "sequences": [{"sequence": ["papa", "nada"]}]},
    )
    assert bad.status_code == 422


def test_snap_to_grid_uses_power_cells():
    from app.climate import snap_to_grid

    assert snap_to_grid(-13.40, -71.85) == (-13.5, -71.875)
    assert snap_to_grid(-13.39, -72.05) == (-13.5, -71.875)  # misma celda, misma caché
    assert snap_to_grid(-13.61, -71.56) == (-13.5, -71.25)


def test_concurrent_cold_requests_download_once(tmp_path):
    import threading

    calls = []

    def slow_get(url, params, timeout):
        calls.append(1)
        time.sleep(0.2)
        return FakeResp(power_payload())

    results = []
    threads = [
        threading.Thread(target=lambda: results.append(load_climate(-13.4, -71.85, cache_dir=tmp_path, http_get=slow_get)))
        for _ in range(4)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(calls) == 1 and len(results) == 4
    assert not list(tmp_path.glob("*.tmp"))


def test_corrupt_cache_raises_climate_error(tmp_path):
    (tmp_path / "-13.500_-71.875.csv").write_text("basura", encoding="utf-8")
    (tmp_path / "-13.500_-71.875.json").write_text("{", encoding="utf-8")
    with pytest.raises(ClimateDataError):
        load_climate(-13.4, -71.85, cache_dir=tmp_path)


def test_rotations_require_unique_ids(client):
    seq = {"id": "a", "sequence": ["papa", "tarwi"]}
    r = client.post("/api/rotations", json={"lat": -13.4, "lon": -71.85, "altitude": 3900, "sequences": [seq, seq]})
    assert r.status_code == 422
    r = client.post(
        "/api/rotations",
        json={"lat": -13.4, "lon": -71.85, "altitude": 3900, "sequences": [{"sequence": ["papa", "x" * 31]}]},
    )
    assert r.status_code == 422
