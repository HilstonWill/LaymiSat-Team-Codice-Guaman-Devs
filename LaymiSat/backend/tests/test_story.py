from fastapi.testclient import TestClient

from app import main
from app.story import STORY_MAX_ALT, STORY_MIN_ALT, build_story


def test_story_frost_line_rises_with_warming(climate):
    s = build_story(climate, -2.0)
    assert s["campaigns"], "debe haber campañas completas"
    for c in s["campaigns"]:
        assert STORY_MIN_ALT <= c["frost_line"] <= STORY_MAX_ALT
    # El clima sintético se calienta 0,03 °C/año: la línea de helada debe subir.
    assert s["recent"]["frost_line"] > s["early"]["frost_line"]


def test_story_endpoint(climate):
    main.app.dependency_overrides[main.get_loader] = lambda: (lambda lat, lon: climate)
    try:
        r = TestClient(main.app).get("/api/story", params={"lat": -13.4, "lon": -71.85})
        assert r.status_code == 200
        body = r.json()
        assert body["range"] == {"min": STORY_MIN_ALT, "max": STORY_MAX_ALT, "step": 50}
        assert {"campaign", "frost_line", "smooth", "above_top"} <= set(body["campaigns"][0])
    finally:
        main.app.dependency_overrides.clear()
