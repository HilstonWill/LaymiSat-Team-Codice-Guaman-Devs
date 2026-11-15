"""Explicación en lenguaje sencillo con Gemini (opcional; uso de SI declarado en AI_DISCLOSURE.md).

Reglas de seguridad y validez:
- La clave va SOLO en el servidor: variable de entorno GEMINI_API_KEY (nunca en el repositorio ni en el navegador).
- El modelo solo recibe los resultados YA calculados por LaymiSat y debe reformularlos; se le prohíbe añadir cifras.
- Límite de peticiones por IP y pregunta del usuario acotada a 300 caracteres.
- Si no hay clave, el endpoint responde 503 y la interfaz oculta el botón.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import defaultdict, deque
from typing import Callable

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-flash-latest"
MAX_QUESTION = 300
RATE_PER_MIN = 6

LANG_NAME = {"en": "English", "es": "Spanish (Peru)"}

SYSTEM = (
    "You are an agricultural extension assistant for native-potato communities in the high Andes of Cusco, Peru. "
    "Explain the data below in plain, friendly {lang} for a farmer or a community assembly, in at most 120 words "
    "and 3 short paragraphs or bullet points. RULES: (1) Use ONLY the facts provided; never invent numbers, dates, "
    "places or recommendations that are not in the facts. (2) If the user's question cannot be answered from the "
    "facts, say so and suggest asking the local agricultural agency. (3) Start with what to do now. (4) Mention "
    "uncertainty when the facts say a value is provisional or a threshold was not met. (5) No medical, financial "
    "or pesticide dosage advice."
)


class AIUnavailable(RuntimeError):
    pass


class RateLimited(RuntimeError):
    pass


_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def check_rate(client: str, now: float | None = None, limit: int = RATE_PER_MIN) -> None:
    now = time.time() if now is None else now
    with _lock:
        q = _hits[client]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= limit:
            raise RateLimited("Too many AI requests; try again in a minute")
        q.append(now)


def build_facts(report: dict, sowing: dict | None, forecast: dict | None, place_name: str) -> dict:
    """Solo resultados calculados, sin datos personales."""
    facts = {
        "place": place_name,
        "altitude_m": report["location"]["altitude"],
        "season": report["data"]["current_campaign"],
        "data_until": report["data"]["last_date"],
        "provisional_from": report["data"]["provisional_from"],
        "alerts": [
            {
                "question": a.get("question"),
                "level": {"verde": "low risk", "ambar": "attention", "rojo": "high risk"}[a["level"]],
                "evidence": a["headline"],
                "suggested_action": a["action"],
            }
            for a in report["alerts"]
        ],
    }
    if sowing and sowing.get("window"):
        facts["recommended_sowing_window_days_after_aug1"] = sowing["window"]
    if forecast:
        facts["next_7_days"] = {
            "frost_nights": forecast["frost_nights"],
            "rain_total_mm": forecast["rain_total_mm"],
            "source": forecast["source"],
        }
    return facts


def explain(
    facts: dict,
    lang: str,
    question: str | None = None,
    http_post: Callable | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> dict:
    key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise AIUnavailable("AI explanations are disabled (no GEMINI_API_KEY on the server)")
    model = model or os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
    if http_post is None:
        import httpx

        http_post = httpx.post
    q = (question or "").strip()[:MAX_QUESTION]
    user = "FACTS (JSON):\n" + json.dumps(facts, ensure_ascii=False) + (
        f"\n\nFARMER QUESTION: {q}" if q else "\n\nTask: explain these alerts and what to do now."
    )
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM.format(lang=LANG_NAME.get(lang, "English"))}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 400},
    }
    try:
        resp = http_post(
            GEMINI_URL.format(model=model),
            headers={"x-goog-api-key": key, "Content-Type": "application/json"},
            json=body,
            timeout=30,
        )
    except Exception as exc:  # red caída / timeout
        raise AIUnavailable("AI service unreachable") from exc
    if resp.status_code != 200:
        raise AIUnavailable(f"AI service error {resp.status_code}")
    try:
        data = resp.json()
        text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"]).strip()
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise AIUnavailable("Unexpected AI response") from exc
    if not text:
        raise AIUnavailable("Empty AI response")
    return {"text": text, "model": model, "generated_by": "Google Gemini (SI)", "grounded_on": "LaymiSat computed results"}
