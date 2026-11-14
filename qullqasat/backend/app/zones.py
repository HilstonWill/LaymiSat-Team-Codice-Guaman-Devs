"""Zonas piloto (coordenadas y altitudes aproximadas; validar con la Agencia Agraria)."""

ZONES = [
    {
        "id": "pisac-parque-papa",
        "name": "Parque de la Papa (Pisac)",
        "province": "Calca",
        "lat": -13.40,
        "lon": -71.85,
        "altitude": 3900,
        "note": "Comunidades conservacionistas de papa nativa; más de mil variedades en custodia.",
    },
    {
        "id": "chinchero",
        "name": "Chinchero",
        "province": "Urubamba",
        "lat": -13.39,
        "lon": -72.05,
        "altitude": 3760,
        "note": "Meseta agrícola con papa, oca, olluco, haba y cebada en secano.",
    },
    {
        "id": "ccatcca",
        "name": "Ccatcca",
        "province": "Quispicanchi",
        "lat": -13.61,
        "lon": -71.56,
        "altitude": 3700,
        "note": "Laderas de secano con sectores comunales de rotación (laymi).",
    },
    {
        "id": "colquepata",
        "name": "Colquepata",
        "province": "Paucartambo",
        "lat": -13.36,
        "lon": -71.67,
        "altitude": 3680,
        "note": "Papa nativa y tarwi en parcelas pequeñas de ladera.",
    },
]

ZONES_BY_ID = {z["id"]: z for z in ZONES}
