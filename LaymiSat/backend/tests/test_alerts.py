import math

import numpy as np
import pandas as pd

from app import alerts as A
from app.climate import add_campaign_columns, at_altitude


def test_sday_labels():
    assert A.sday_label(0) == "1 ago"
    assert A.sday_label(A.TRADITIONAL_SOWING_SDAY) == "23 sep"


def test_find_onset_requires_firm_rains():
    p = np.zeros(230)
    p[40:42] = 15  # lluvia aislada seguida de veranillo: falso inicio
    p[80:200] = 4  # lluvias firmes
    sday, provisional = A.find_onset(p)
    assert sday >= 74 and not provisional


def test_find_onset_none_and_provisional():
    assert math.isnan(A.find_onset(np.zeros(230))[0])
    p = np.full(70, np.nan)
    p[:60] = 0
    p[50:60] = 5
    sday, provisional = A.find_onset(p)
    assert sday == 45 and provisional  # primera ventana de 10 días que suma 25 mm (días 50–54)


def _frost_frame(cold_days):
    idx = pd.date_range("2000-08-01", "2001-07-31", freq="D")
    df = pd.DataFrame({"tmin": 5.0, "tmax": 15.0, "prec": 2.0, "gwet": 0.4}, index=idx)
    for d in cold_days:
        df.loc[d, "tmin"] = -1.0
    return add_campaign_columns(df)


def test_frost_events_need_two_consecutive_days():
    f = A.frost_by_campaign(_frost_frame(["2000-10-10", "2000-10-11", "2000-11-20"]))
    row = f.iloc[0]
    assert row["frost_days"] == 3 and row["frost_events"] == 1 and row["complete"]


def test_plant_adjust_creates_frost():
    f = A.frost_by_campaign(_frost_frame([]), plant_adjust=-6.0)
    assert f.iloc[0]["frost_days"] == 92


def test_alerts_on_synthetic_climate(climate):
    df = at_altitude(climate, 3900)
    current = int(df["campaign"].max())
    frost = A.frost_alert(A.frost_by_campaign(df, -2), current, -2)
    water = A.water_alert(A.water_by_campaign(df), df, current)
    shift = A.shift_alert(A.onset_by_campaign(df), current)
    for a in (frost, water, shift):
        assert a["level"] in {"verde", "ambar", "rojo"}
        assert a["headline"] and a["action"] and a["trend"]["n"] > 10
    assert frost["id"] == "AHS" and water["id"] == "AEH" and shift["id"] == "ADS"
    assert shift["metrics"]["suggested_window"] is not None


def test_water_alert_red_when_sowing_rains_fail(climate):
    df = at_altitude(climate, 3900)
    df = df.copy()
    current = int(df["campaign"].max())
    df.loc[(df["campaign"] == current) & (df["sday"] >= A.SEP1), "prec"] = 0.0
    alert = A.water_alert(A.water_by_campaign(df), df, current)
    assert alert["level"] == "rojo"
    assert alert["current"]["precip_mm"] == 0.0


def test_water_alert_uses_previous_campaign_early_in_season(climate):
    df = at_altitude(climate, 3900)
    df = df[df.index <= "2025-08-20"]
    current = int(df["campaign"].max())
    alert = A.water_alert(A.water_by_campaign(df), df, current)
    assert alert["current"]["campaign"] == current - 1


def test_shift_alert_red_when_rains_have_not_started(climate):
    df = at_altitude(climate, 3900).copy()
    current = int(df["campaign"].max())
    df.loc[(df["campaign"] == current), "prec"] = 0.0
    alert = A.shift_alert(A.onset_by_campaign(df), current)
    assert alert["current"]["status"] == "aun_no_inicia"
    assert alert["level"] == "rojo"
    assert "aún no se establecen" in alert["headline"]


def test_frost_alert_levels():
    frost = pd.DataFrame(
        {"campaign": range(2000, 2020), "frost_days": 0, "frost_events": 0, "min_tmin": 3.0, "complete": True}
    )
    assert A.frost_alert(frost, 2019)["level"] == "verde"
    frost.loc[frost["campaign"] >= 2015, "frost_events"] = 1
    assert A.frost_alert(frost, 2025)["level"] == "ambar"
    frost["frost_events"] = 1
    assert A.frost_alert(frost, 2025)["level"] == "rojo"


def test_find_onset_skips_missing_days():
    p = np.zeros(230)
    p[10] = np.nan  # un día faltante en agosto no debe anular la campaña
    p[80:200] = 4
    sday, _ = A.find_onset(p)
    assert sday >= 74


def test_shift_alert_reports_no_onset_late_in_season(climate):
    df = at_altitude(climate, 3900).copy()
    df = df[df.index <= "2025-03-31"]
    current = int(df["campaign"].max())
    df.loc[df["campaign"] == current, "prec"] = 0.0
    alert = A.shift_alert(A.onset_by_campaign(df), current)
    assert alert["current"]["status"] == "sin_inicio"
    assert "no se detectó" in alert["headline"]


def test_partial_first_campaign_has_no_onset(climate):
    df = at_altitude(climate, 3900)  # datos desde ene-1984: la campaña 1983 empieza a mitad de temporada
    onset = A.onset_by_campaign(df)
    first = onset[onset["campaign"] == 1983]
    assert first["onset_sday"].isna().all()
