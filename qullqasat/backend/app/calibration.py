"""Calibración del ajuste de helada con una estación en tierra (p. ej. SENAMHI).

Compara la Tmin diaria de la estación con la Tmin de NASA POWER corregida a la altitud de la estación y
busca el ajuste (°C) que mejor reproduce el número de días con helada (Tmin ≤ 0 °C) en oct–dic.

Uso por línea de comandos:
    python -m app.calibration estacion.csv --lat -13.40 --lon -71.85 --altitude 3850

El CSV debe tener columnas `date` (AAAA-MM-DD) y `tmin` (°C). Los vacíos se ignoran.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .climate import ClimateData, load_climate, temperature_offset

CANDIDATES = [round(x, 1) for x in np.arange(-5.0, 1.01, 0.5)]


def read_station_csv(path: str | Path) -> pd.Series:
    df = pd.read_csv(path)
    cols = {c.lower().strip(): c for c in df.columns}
    if "date" not in cols or "tmin" not in cols:
        raise ValueError("El CSV necesita columnas 'date' y 'tmin'")
    s = pd.Series(pd.to_numeric(df[cols["tmin"]], errors="coerce").values, index=pd.to_datetime(df[cols["date"]]))
    return s.dropna().sort_index()


def calibrate(station_tmin: pd.Series, data: ClimateData, altitude: float) -> dict:
    power = data.df["tmin"] + temperature_offset(data.grid_elevation, altitude)
    both = pd.DataFrame({"station": station_tmin, "power": power}).dropna()
    if len(both) < 60:
        raise ValueError("Se necesitan al menos 60 días en común entre la estación y NASA POWER")
    ond = both[both.index.month.isin([10, 11, 12])]
    if len(ond) < 30:
        ond = both  # sin suficientes días oct–dic: usar todo el periodo
    bias_all = float((both["station"] - both["power"]).mean())
    bias_ond = float((ond["station"] - ond["power"]).mean())
    obs_frost = int((ond["station"] <= 0).sum())
    table = []
    for adj in CANDIDATES:
        sim = int(((ond["power"] + adj) <= 0).sum())
        table.append({"plant_adjust": adj, "frost_days_power": sim, "error": sim - obs_frost})
    best = min(table, key=lambda r: (abs(r["error"]), abs(r["plant_adjust"])))
    corr = float(np.corrcoef(both["station"], both["power"])[0, 1]) if len(both) > 2 else float("nan")
    return {
        "days_compared": int(len(both)),
        "period": f"{both.index.min().date()} – {both.index.max().date()}",
        "bias_all_c": round(bias_all, 2),
        "bias_oct_dec_c": round(bias_ond, 2),
        "correlation": round(corr, 3),
        "observed_frost_days_oct_dec": obs_frost,
        "recommended_plant_adjust": best["plant_adjust"],
        "table": table,
        "note": (
            "Usa el ajuste recomendado en el deslizador 'Ajuste de helada a nivel de planta'. Si la estación mide "
            "a 1,5–2 m (abrigo), el ajuste corrige el sesgo de la reanálisis; la helada en la hoja puede ser aún "
            "1–2 °C más fría en noches despejadas."
        ),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Calibra el ajuste de helada de LaymiSat con una estación SENAMHI")
    ap.add_argument("csv")
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--altitude", type=float, required=True, help="Altitud de la estación (m)")
    args = ap.parse_args(argv)
    station = read_station_csv(args.csv)
    data = load_climate(args.lat, args.lon)
    print(json.dumps(calibrate(station, data, args.altitude), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
