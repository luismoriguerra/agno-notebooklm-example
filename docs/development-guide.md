# Development Guide

Local setup and daily development workflow for the NotebookLM project.

## Prerequisites

- **Docker Desktop** -- for running PostgreSQL and the backend API container
- **Node.js 20+** and **pnpm** -- for the frontend
- **Python 3.12+** -- for running the backend locally without Docker (optional)
- **AWS credentials** with Bedrock access -- the default LLM is Claude Sonnet via AWS Bedrock

## Environment Setup

1. Copy the example environment file:

```bash
cd backend
cp .env.example .env
```

2. Edit `backend/.env` with your credentials:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | -- | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | -- | AWS secret key |
| `AWS_DEFAULT_REGION` | Yes | -- | AWS region (e.g. `us-east-2`) |
| `AGENT_MODEL` | No | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` | Bedrock model ID |
| `DB_HOST` | No | `localhost` | Database host |
| `DB_PORT` | No | `5432` | Database port |
| `DB_USER` | No | `ai` | Database user |
| `DB_PASS` | No | `ai` | Database password |
| `DB_DATABASE` | No | `ai` | Database name |

## Quick Start

Start everything with a single command:

```bash
make dev
```

This starts:
- **Backend** (Docker Compose): API at http://localhost:8000, PostgreSQL at localhost:5432
- **Frontend** (Next.js dev server): http://localhost:3000

Or start services individually:

```bash
# Backend + database
make backend-up

# Frontend (in a separate terminal)
make frontend-dev
```

## Architecture Overview

### Backend

```
backend/
├── app/
│   └── main.py                 # AgentOS entry point + custom router mounting + CORS
├── agents/
│   └── notebooklm_team.py      # Team definition: Researcher + Writer agents
├── api/
│   └── notebooks.py            # Custom CRUD + run endpoints for notebooks
├── db/
│   ├── url.py                  # Builds DB connection URL from env vars
│   ├── session.py              # PostgresDb factory for AgentOS
│   ├── tables/                 # SQLAlchemy models (Base, NotebooksTable, NotebookSessionsTable)
│   └── migrations/             # Alembic migration files
├── alembic.ini                 # Alembic configuration
├── compose.yaml                # Docker Compose (db + api services)
├── Dockerfile                  # Production container image
└── requirements.txt            # Python dependencies
```

- **`app/main.py`** creates an `AgentOS` instance with the NotebookLM team, gets the FastAPI app, mounts the custom notebooks router at `/api`, and adds CORS middleware.
- **`agents/notebooklm_team.py`** defines two agents (Researcher, Writer) and a supervisor Team that delegates between them. All use AWS Bedrock Claude.
- **`api/notebooks.py`** provides CRUD endpoints for notebooks, a custom `/api/notebooks/{id}/run` endpoint that injects notebook context into team runs, and a session-linking endpoint.
- **`db/`** contains SQLAlchemy table definitions and Alembic migrations. The `db_url` is built from environment variables.

### Frontend

```
frontend/src/
├── app/
│   ├── page.tsx                # Home page -- notebooks list with create/edit/delete
│   └── notebook/[id]/page.tsx  # Chat page -- sidebar + header + chat area
├── api/
│   ├── routes.ts               # API URL builders
│   ├── os.ts                   # AgentOS API functions (sessions, agents, teams)
│   └── notebooks.ts            # Notebook CRUD + sessions API functions
├── components/
│   ├── chat/                   # ChatArea, Sidebar, Sessions, ChatInput, Messages
│   ├── notebooks/              # NotebookHeader, NotebookFormDialog, DeleteNotebookDialog
│   └── ui/                     # shadcn/ui primitives (button, dialog, dropdown-menu, etc.)
├── hooks/                      # useAIStreamHandler, useChatActions, useSessionLoader
├── store.ts                    # Zustand global state (messages, sessions, currentNotebook, etc.)
└── types/os.ts                 # TypeScript types for AgentOS responses
```

- **Routing**: `/` shows the notebooks list; `/notebook/[id]` shows the chat UI with notebook context.
- **State**: Zustand store manages messages, streaming state, sessions, selected endpoint, and `currentNotebook`.
- **Streaming**: `useAIStreamHandler` sends FormData to the backend (either standard team run or notebook-specific run) and processes SSE chunks.
- **UI**: Built with shadcn/ui (New York style), Tailwind CSS dark theme, Framer Motion animations.

## Docker Compose Services

Defined in `backend/compose.yaml`:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `notebooklm-db` | `pgvector/pgvector:pg17` | 5432 | PostgreSQL with vector extension |
| `notebooklm-api` | Local Dockerfile | 8000 | FastAPI backend with hot-reload |

The API container mounts the `backend/` directory as a volume and runs with `--reload`, so code changes are picked up automatically.

## Useful Commands

### Root Makefile

| Command | Description |
|---------|-------------|
| `make dev` | Start backend + frontend together |
| `make backend-up` | Start backend + database via Docker Compose |
| `make backend-dev` | Run backend locally with hot-reload (DB must be running) |
| `make backend-down` | Stop backend services |
| `make frontend-dev` | Start frontend dev server at http://localhost:3000 |
| `make frontend-build` | Build frontend for production |
| `make down` | Stop all local services |

### Backend Makefile (run from `backend/`)

| Command | Description |
|---------|-------------|
| `make logs` | Tail logs for all services |
| `make logs-api` | Tail API logs only |
| `make logs-db` | Tail database logs only |
| `make shell-api` | Open bash shell in the API container |
| `make shell-db` | Open psql shell in the database |
| `make status` | Show running containers |
| `make restart` | Restart the API container |
| `make clean` | Stop services and delete all data (removes volumes) |

## Hot-Reload

- **Backend**: The Docker Compose config mounts the code directory as a volume and passes `--reload` to uvicorn. Any change to `.py` files triggers an automatic restart.
- **Frontend**: The Next.js dev server (`pnpm dev`) provides Fast Refresh. Changes to React components update instantly in the browser without a full page reload.

## Testing Locally

```bash
# Test backend health
make test-backend-local

# Test frontend
make test-frontend-local
```

Or manually:

```bash
# Backend health
curl http://localhost:8000/health

# List teams
curl http://localhost:8000/teams | python3 -m json.tool

# List notebooks
curl http://localhost:8000/api/notebooks | python3 -m json.tool
```
