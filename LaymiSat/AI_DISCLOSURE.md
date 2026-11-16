# Use of Super Intelligence (SI) / AI disclosure

Per the NASA Space Apps 2026 Project Submission Guide, we disclose where and how SI tools were used.

- **Idea and design (no SI):** the problem tree, the use of Guaman Poma's 1615 calendar, the three alerts and the
  pilot communities come from the team's own project document.
- **Code (SI-assisted):** the backend (Python/FastAPI) and frontend (React/TypeScript) source code, tests and
  documentation were written with the help of an AI coding assistant (Anthropic Claude, via Claude Code), directed
  and reviewed by the team. This applies to all files under `backend/`, `frontend/src/` and `docs/`.
- **Data (no generative SI):** all numbers come from NASA data (NASA POWER, MODIS, SRTM) processed with explicit,
  documented rules and classical statistics (Mann-Kendall, Sen slope, percentiles). No generative model produces
  any alert, score or recommendation.
- **Runtime:** the app does not call any generative-AI service. Alerts, scores, rotation recommendations and the sowing simulator come only from NASA data and explicit rules.
- **Audio (SI):** the voice-over of the project video was generated with AI (ElevenLabs text-to-speech) from a script
  written by the team. This is declared in the video description and in the submission form.
- **Video and images:** the project video was built with AI assistance (Claude Code) from the team's own design. No
  AI-generated images or video are used: all screens are real captures of the LaymiSat app. Any SI-generated image or
  video added later will carry a visible watermark.
- **NASA branding:** no NASA logos, flags or mission insignia are used or modified.
