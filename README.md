# NotebookLM Clone

AI-powered research and note-taking assistant built with [Agno AgentOS](https://docs.agno.com/agent-os/introduction) and a custom [Agent UI](https://github.com/agno-agi/agent-ui) frontend.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Railway Project                                        │
│                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────┐  │
│  │  Frontend     │──▶│  Backend     │──▶│  PgVector  │  │
│  │  (Next.js)    │   │  (AgentOS)   │   │  (Postgres)│  │
│  │  port 3000    │   │  port 8000   │   │  port 5432 │  │
│  └──────────────┘   └──────────────┘   └────────────┘  │
│                                                         │
│  NotebookLM Team (supervisor)                           │
│    ├── Researcher Agent — analyzes documents            │
│    └── Writer Agent — creates summaries and notes       │
└─────────────────────────────────────────────────────────┘
```

All agents use **AWS Bedrock Claude Sonnet** as the LLM and **PostgreSQL (pgvector)** for session storage.

## Quick Start (Local Development)

### Prerequisites

- Docker Desktop
- Node.js 20+ and pnpm
- AWS credentials with Bedrock access

### 1. Configure environment

```bash
cd backend
cp .env.example .env   # Edit with your AWS credentials
```

### 2. Start the backend

```bash
make backend-up
```

This starts the backend API (http://localhost:8000) and PostgreSQL database (localhost:5432).

### 3. Start the frontend

```bash
make frontend-dev
```

This starts the Next.js frontend at http://localhost:3000.

### 4. Connect via control plane (optional)

1. Open [os.agno.com](https://os.agno.com)
2. Click **Add OS** → **Local**
3. Enter `http://localhost:8000`

## Project Structure

```
agno-notebooklm/
├── backend/
│   ├── agents/
│   │   └── notebooklm_team.py    # Team with Researcher + Writer agents
│   ├── app/
│   │   └── main.py                # AgentOS entry point + CORS middleware
│   ├── db/
│   │   ├── session.py             # PostgresDb factory
│   │   └── url.py                 # DB URL builder from env vars
│   ├── scripts/
│   │   └── railway_up.sh          # Full Railway deployment script
│   ├── compose.yaml               # Docker Compose (backend + pgvector)
│   ├── Dockerfile
│   ├── Makefile
│   ├── railway.json               # Railway service config
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js App Router pages
│   │   ├── api/                   # API client functions
│   │   ├── components/            # Chat UI, Sidebar, Messages
│   │   ├── hooks/                 # Streaming, sessions, chat actions
│   │   ├── lib/                   # Utilities
│   │   └── store.ts               # Zustand state management
│   ├── Dockerfile
│   ├── railway.json               # Railway service config
│   └── package.json
├── Makefile                       # Root-level commands (this file)
└── README.md
```

## Makefile Commands

Run `make help` from the project root to see all commands:

### Local Development

| Command | Description |
|---------|-------------|
| `make backend-up` | Start backend + database via Docker Compose |
| `make backend-dev` | Run backend locally with hot-reload (DB must be running) |
| `make backend-down` | Stop backend services |
| `make frontend-dev` | Start frontend dev server (http://localhost:3000) |
| `make frontend-build` | Build frontend for production |
| `make dev` | Start everything locally (backend + frontend) |
| `make down` | Stop all local services |

### Railway Deployment

| Command | Description |
|---------|-------------|
| `make deploy` | First-time deploy: creates project + all services on Railway |
| `make deploy-backend` | Redeploy backend to Railway |
| `make deploy-frontend` | Redeploy frontend to Railway |
| `make deploy-all` | Redeploy both backend and frontend |
| `make railway-logs-backend` | Tail backend logs on Railway |
| `make railway-logs-frontend` | Tail frontend logs on Railway |
| `make railway-status` | Show Railway project status |
| `make railway-open` | Open Railway dashboard in browser |

### Testing & Verification

| Command | Description |
|---------|-------------|
| `make test-backend-local` | Test local backend health endpoint |
| `make test-frontend-local` | Test local frontend |
| `make test-backend-prod` | Test production backend health + CORS |
| `make test-frontend-prod` | Test production frontend |
| `make test-prod` | Test all production endpoints |

## Environment Variables

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | — | AWS secret key |
| `AWS_DEFAULT_REGION` | Yes | — | AWS region (e.g. `us-east-2`) |
| `AGENT_MODEL` | No | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` | Bedrock model ID |
| `DB_HOST` | No | `localhost` | Database host |
| `DB_PORT` | No | `5432` | Database port |
| `DB_USER` | No | `ai` | Database user |
| `DB_PASS` | No | `ai` | Database password |
| `DB_DATABASE` | No | `ai` | Database name |
| `RUNTIME_ENV` | No | `prd` | Set to `dev` for hot-reload |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | No | `http://localhost:8000` | Backend API URL |
| `NEXT_PUBLIC_OS_SECURITY_KEY` | No | — | Auth token for AgentOS |

## Deployment

### First-time Railway deployment

```bash
make deploy
```

This runs `backend/scripts/railway_up.sh` which:
1. Creates a Railway project
2. Deploys a PgVector database
3. Creates and deploys the backend service with DB credentials
4. Creates and deploys the frontend service pointing to the backend
5. Creates public domains for both services

### Redeploying after code changes

```bash
# Both services
make deploy-all

# Or individually
make deploy-backend
make deploy-frontend
```
