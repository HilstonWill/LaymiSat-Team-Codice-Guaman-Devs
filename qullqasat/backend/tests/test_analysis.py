import math

import numpy as np
import pytest

from app.analysis import count_runs, mann_kendall, max_run, percentile_rank, runs, sen_slope, trend


def test_mann_kendall_detects_increasing_series():
    res = mann_kendall(list(range(20)))
    assert res["s"] == 190
    assert res["tau"] == pytest.approx(1.0)
    assert res["p_value"] < 0.001


def test_mann_kendall_flat_series_has_no_trend():
    res = mann_kendall([5.0] * 10)
    assert res["s"] == 0 and res["p_value"] == 1.0


def test_mann_kendall_short_or_nan_series():
    assert mann_kendall([1, 2, 3])["p_value"] == 1.0
    res = mann_kendall([1, math.nan, 2, 3, 4, 5])
    assert res["n"] == 5


def test_mann_kendall_decreasing_sign():
    res = mann_kendall([10, 9, 8, 8, 6, 5, 3, 2])
    assert res["s"] < 0 and res["z"] < 0


def test_sen_slope_matches_linear_slope_with_outlier():
    x = np.arange(10)
    y = 2 * x + 1.0
    y[3] = 100  # outlier: Theil-Sen es robusto
    assert sen_slope(x, y) == pytest.approx(2.0)


def test_sen_slope_degenerate():
    assert sen_slope([1, 1], [2, 3]) == 0.0


def test_trend_reports_direction_per_decade():
    t = trend(list(range(1990, 2020)), [0.02 * i for i in range(30)])
    assert t["significant"] and t["direction"] == "en aumento"
    assert t["slope_per_decade"] == pytest.approx(0.2)
    down = trend(list(range(30)), [-i for i in range(30)])
    assert down["direction"] == "en descenso"
    flat = trend(list(range(10)), [1, 3, 2, 1, 3, 2, 1, 3, 2, 1])
    assert flat["direction"] == "sin tendencia significativa"


def test_runs_helpers():
    mask = [1, 1, 0, 1, 1, 1, 0, 0, 1]
    assert runs(mask) == [2, 3, 1]
    assert max_run(mask) == 3
    assert count_runs(mask, 2) == 2
    assert max_run([]) == 0


def test_percentile_rank():
    sample = [10, 20, 30, 40]
    assert percentile_rank(25, sample) == 50.0
    assert percentile_rank(5, sample) == 0.0
    assert math.isnan(percentile_rank(5, []))
    assert math.isnan(percentile_rank(math.nan, sample))
