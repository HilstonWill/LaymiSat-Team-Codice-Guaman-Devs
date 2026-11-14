import numpy as np
import pandas as pd
import pytest

from app.climate import ClimateData


def synthetic_frame(start="1984-01-01", end="2025-11-30", seed=7, warming_per_year=0.03, late_onset_years=()):
    """Clima diario sintético y determinista con estacionalidad andina."""
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start, end, freq="D")
    doy = idx.dayofyear.to_numpy()
    years = idx.year.to_numpy() - 1984
    # Más frío en jun–jul, más cálido en nov–feb
    seasonal = 3.0 * np.cos(2 * np.pi * (doy - 15) / 365.25)
    tmin = 2.0 + seasonal + warming_per_year * years + rng.normal(0, 1.2, len(idx))
    tmax = tmin + 11 + rng.normal(0, 0.8, len(idx))
    # Lluvia: estación lluviosa oct–mar; seca abr–sep
    month = idx.month.to_numpy()
    wet = np.isin(month, [10, 11, 12, 1, 2, 3])
    prec = np.where(wet, rng.gamma(0.9, 4.5, len(idx)), rng.gamma(0.2, 1.0, len(idx)))
    prec = np.where(rng.random(len(idx)) < (0.6 if True else 0), prec, 0.0)
    for y in late_onset_years:  # sep–nov secos en esos años
        mask = (idx.year == y) & np.isin(month, [9, 10, 11])
        prec[mask] = 0.0
    df = pd.DataFrame(
        {
            "tmin": tmin,
            "tmax": tmax,
            "prec": prec,
            "rh": 60.0,
            "rad": 20.0,
            "gwet": np.where(wet, 0.5, 0.3) + rng.normal(0, 0.02, len(idx)),
        },
        index=pd.Index(idx, name="date"),
    )
    return df


@pytest.fixture(scope="session")
def frame():
    return synthetic_frame(late_onset_years=(2019, 2022))


@pytest.fixture(scope="session")
def climate(frame):
    return ClimateData(frame, grid_elevation=3740.0, source="cache", lat=-13.4, lon=-71.85)
