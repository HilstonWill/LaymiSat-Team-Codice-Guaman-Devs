# LaymiSat · NASA Space Apps Challenge 2026

Agro-climate decision support for native-potato farmers in the high Andes of Cusco, Peru, built with NASA POWER,
MODIS NDVI and NASA SRTM data plus the 1615 Andean farming calendar of Guaman Poma de Ayala.
Challenge: **Field Shift: Adapting Farms with NASA Data**.

➡️ **Project description, NASA data, method and findings: [qullqasat/README.md](qullqasat/README.md)**

---

## Getting started (for contributors)

### 1. Requirements
| Tool | Version | Check |
|---|---|---|
| Git | any recent | `git --version` |
| Python | 3.11 or newer (tested on 3.14) | `python --version` |
| Node.js | 20 or newer (tested on 24) | `node --version` |

### 2. Clone
```bash
git clone <REPOSITORY_URL>
cd <REPOSITORY_FOLDER>/qullqasat
```

### 3. Backend (API) — terminal 1
**Windows (PowerShell or Git Bash)**
```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt -r requirements-dev.txt
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```
**macOS / Linux**
```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m uvicorn app.main:app --port 8000
```
The API is ready when you see `Uvicorn running on http://127.0.0.1:8000`. Check it at http://127.0.0.1:8000/api/health
(should return `{"status":"ok"}`) and browse the endpoints at http://127.0.0.1:8000/docs.

### 4. Frontend (web app) — terminal 2
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. During development Vite forwards every `/api` call to the API on port 8000, so
**both terminals must stay open**.

### 5. Before pushing: tests and checks
```bash
# backend (from qullqasat/backend)
.venv/Scripts/python -m pytest --cov=app        # macOS/Linux: .venv/bin/python -m pytest --cov=app
# frontend (from qullqasat/frontend)
npm run build
npm run lint
```
All must pass (currently 70 backend tests, 97 % coverage).

### Data and internet
- `backend/cache/` already contains NASA POWER data for the 4 pilot zones and MODIS NDVI, so the app works **offline**.
- Clicking a new point on the map downloads 40 years of NASA POWER data for that cell (a few seconds) and asks NASA SRTM
  for the altitude (needs internet).
- NDVI is only available for the 4 pilot zones in this MVP.

### Troubleshooting
| Problem | Fix |
|---|---|
| `[Errno 10048]` / `address already in use` | That port is taken: an API (or `npm run dev`) is already running. Close the other terminal or stop the process, then start again. |
| The page goes blank or a section shows "could not be displayed" | The browser is talking to an **old API**. Stop the API (Ctrl+C) and start it again so it loads the latest code. |
| `python` not found on Windows | Install Python from python.org and tick "Add python.exe to PATH", or use `py` instead of `python`. |
| The API is on another port | Create `frontend/.env.local` with `LAYMI_API_PROXY=http://127.0.0.1:<port>` and restart `npm run dev`. |
| The first NDVI load is slow | It is only downloaded once per pilot zone from the NASA ORNL service (2–8 min); afterwards it is cached. |

### Project structure
```
qullqasat/
├── backend/            FastAPI API (Python)
│   ├── app/            alerts, analysis, climate (NASA POWER), ndvi (MODIS), terrain (SRTM), rotations, i18n, calibration
│   ├── app/data/       Guaman Poma calendar (verified against the manuscript) and crop parameters
│   ├── cache/          cached NASA data for the pilot zones
│   └── tests/          pytest suite
├── frontend/           React + TypeScript + Vite web app
│   └── src/            App.tsx, api.ts, i18n.ts (EN/ES texts), components/
├── docs/               team guides (Spanish) and the English submission kit
└── AI_DISCLOSURE.md    how AI tools were used (required by Space Apps)
```

### How we work
1. Create a branch: `git checkout -b feat/<short-name>`.
2. Make your change; keep the UI texts in **both** languages (`frontend/src/i18n.ts`).
3. Run the checks of step 5.
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat(web): …`, `fix(api): …`, `docs: …`), push and open a Pull Request.

Pending tasks for the frontend are listed in [qullqasat/docs/GUIA_FRONTEND.md](qullqasat/docs/GUIA_FRONTEND.md) (section 7).

---

<details>
<summary><b>🇵🇪 Guía rápida en español para el equipo</b></summary>

1. **Instala** Git, Python 3.11+ (en Windows marca "Add python.exe to PATH") y Node.js 20+.
2. **Clona** el repositorio y entra en la carpeta `qullqasat`.
3. **Terminal 1, la API:**
   ```bash
   cd backend
   python -m venv .venv
   .venv/Scripts/python -m pip install -r requirements.txt -r requirements-dev.txt
   .venv/Scripts/python -m uvicorn app.main:app --port 8000
   ```
   En macOS/Linux usa `python3` y `.venv/bin/python`. Debe decir `Uvicorn running on http://127.0.0.1:8000`.
4. **Terminal 2, la web:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Abre **http://localhost:5173**. Las dos terminales deben quedar abiertas.
5. **Antes de subir cambios:** `pytest` en el backend, y `npm run build` y `npm run lint` en el frontend, todo en verde.
6. **Problemas frecuentes:**
   - **Error 10048 / puerto ocupado:** ya hay otra API corriendo; ciérrala.
   - **La página queda en blanco:** la API es una versión vieja; reiníciala con Ctrl+C y el mismo comando.
7. **Trabajo en equipo:** crea una rama por tarea, mantén los textos en inglés y español (`frontend/src/i18n.ts`) y abre un Pull Request. Las tareas pendientes están en `qullqasat/docs/GUIA_FRONTEND.md`.

</details>
