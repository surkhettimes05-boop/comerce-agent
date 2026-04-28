# Khaacho Commerce Agent OS

## Live stack

This repository can be run as a self-hosted stack with:

- `frontend`: Next.js app on port `3000`
- `backend`: Express + Prisma API
- `postgres`: PostgreSQL database
- `ollama`: local LLM runtime using `llama3.2:3b`

## Start live on this machine

This path uses the PostgreSQL and Ollama services already installed on the host.

```powershell
cd "C:\Users\QCS\Documents\New project"
powershell -ExecutionPolicy Bypass -File .\scripts\start-live.ps1
```

If port `3000` is already used by another app:

```powershell
cd "C:\Users\QCS\Documents\New project"
powershell -ExecutionPolicy Bypass -File .\scripts\start-live.ps1 -FrontendPort 3001
```

To stop the production-mode processes:

```powershell
cd "C:\Users\QCS\Documents\New project"
powershell -ExecutionPolicy Bypass -File .\scripts\stop-live.ps1
```

### Start the live stack

```powershell
cd "C:\Users\QCS\Documents\New project"
docker compose up -d --build
```

### Seed demo data

This resets the commerce tables and reloads the Nepal demo catalog.

```powershell
cd "C:\Users\QCS\Documents\New project"
docker compose exec backend npm run seed
```

### Open the app

- Chat: `http://localhost:3000/chat`
- Admin: `http://localhost:3000/admin`

### Stop the stack

```powershell
cd "C:\Users\QCS\Documents\New project"
docker compose down
```

### Persistent data

- PostgreSQL data is stored in the `postgres_data` Docker volume.
- Ollama models are stored in the `ollama_data` Docker volume.

### Optional runtime overrides

The compose file reads environment values from the shell or a root `.env` file.
Defaults are documented in `.env.live.example`.

Docker note: if image pulls fail with Docker Hub connectivity errors, use the
host-based `scripts/start-live.ps1` path first. The application code and
container definitions are ready, but Docker still needs registry access to pull
the base images.
