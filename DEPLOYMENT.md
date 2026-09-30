# Deployment Guide

## Local (Docker Desktop)
```powershell
docker compose up -d --build backend ai-service frontend
docker compose exec backend npm run seed
docker compose exec ollama ollama pull llama3.1:8b
docker compose exec backend npm run test
```

## Production layout
- **Backend (Node/Express)** → Render Web Service. Env vars: `DATABASE_URL`, `JWT_SECRET`, `AI_SERVICE_URL`, `CORS_ORIGIN`, `REDIS_URL`.
- **AI service (Python/FastAPI)** → Render Web Service (needs 2GB+ RAM for PaddleOCR + Whisper). Env vars: `OLLAMA_HOST`, `OLLAMA_MODEL`, `DATABASE_URL`.
- **Frontend (React/Vite)** → Vercel. Env var: `VITE_API_URL` pointing at the Render backend URL.
- **Postgres** → Render managed Postgres (pgvector extension enabled) or Supabase.
- **Ollama** → needs a persistent host with enough disk (~5GB per model) — a small VPS/Railway service, not a typical serverless platform. Point the AI service's `OLLAMA_HOST` at it.

## Steps
1. Push to GitHub (`git push`).
2. Render: create Web Service from repo → root `backend/`, build `npm install && npx prisma generate`, start `npm start`. Add env vars above. Run `npx prisma migrate deploy && npm run seed` once via Render's Shell tab.
3. Render (2nd service): root `ai-service/`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
4. Vercel: import repo, root `frontend/`, framework Vite, set `VITE_API_URL`.
5. API docs live at `<backend-url>/api/docs` once deployed.

## Backup & recovery

- **Database**: use your Postgres provider's managed backups (Render
  Postgres and Supabase both offer daily automated backups with
  point-in-time recovery on paid tiers — enable this before going live
  with real patient data).
- **Manual backup** (local or self-managed Postgres):
```powershell
  docker compose exec postgres pg_dump -U postgres healthos > backup-$(Get-Date -Format yyyy-MM-dd).sql
```
- **Restore**:
```powershell
  docker compose exec -T postgres psql -U postgres healthos < backup-2026-09-22.sql
```
- **Ollama models**: re-pullable any time (`ollama pull llama3.1:8b`) —
  no need to back these up, they're not user data.
- **Uploaded documents**: this MVP doesn't persist raw file bytes (OCR
  output only) — if real file storage is added later (e.g. S3/Cloudinary),
  back that up separately from the database.