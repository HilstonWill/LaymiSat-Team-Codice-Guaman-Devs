import numpy as np
import pandas as pd
import pytest

from app.calibration import calibrate, main, read_station_csv
from app.climate import temperature_offset


def test_calibration_recovers_known_bias(climate):
    power = climate.df["tmin"] + temperature_offset(climate.grid_elevation, 3900)
    station = (power - 2.0)["2010-01-01":"2015-12-31"]  # estación 2 °C más fría que POWER
    out = calibrate(station, climate, 3900)
    assert out["bias_all_c"] == pytest.approx(-2.0, abs=0.01)
    assert out["recommended_plant_adjust"] == pytest.approx(-2.0, abs=0.5)
    assert out["correlation"] > 0.99
    assert len(out["table"]) == 13


def test_calibration_needs_overlap(climate):
    short = pd.Series([1.0] * 10, index=pd.date_range("2010-01-01", periods=10))
    with pytest.raises(ValueError):
        calibrate(short, climate, 3900)


def test_read_station_csv(tmp_path):
    p = tmp_path / "st.csv"
    p.write_text("Date,Tmin\n2020-01-01,1.5\n2020-01-02,\n2020-01-03,-0.5\n", encoding="utf-8")
    s = read_station_csv(p)
    assert list(s.values) == [1.5, -0.5]
    bad = tmp_path / "bad.csv"
    bad.write_text("fecha,t\n2020-01-01,1\n", encoding="utf-8")
    with pytest.raises(ValueError):
        read_station_csv(bad)


def test_cli(tmp_path, climate, monkeypatch, capsys):
    power = climate.df["tmin"] + temperature_offset(climate.grid_elevation, 3800)
    st = (power - 1.0)["2012-01-01":"2014-12-31"]
    p = tmp_path / "st.csv"
    pd.DataFrame({"date": st.index.strftime("%Y-%m-%d"), "tmin": np.round(st.values, 2)}).to_csv(p, index=False)
    monkeypatch.setattr("app.calibration.load_climate", lambda lat, lon: climate)
    assert main([str(p), "--lat", "-13.4", "--lon", "-71.85", "--altitude", "3800"]) == 0
    assert "recommended_plant_adjust" in capsys.readouterr().out
