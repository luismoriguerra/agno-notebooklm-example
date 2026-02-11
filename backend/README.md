# NotebookLM Clone - Backend

AI-powered research and note-taking assistant built with [Agno AgentOS](https://docs.agno.com/agent-os/introduction), powered by AWS Bedrock Claude.

## Architecture

```
AgentOS (FastAPI)
  └── NotebookLM Team (supervisor)
        ├── Researcher Agent — analyzes documents, extracts key information
        └── Writer Agent — creates summaries, study guides, and notes
```

All agents use **AWS Bedrock Claude Sonnet** as the LLM and **PostgreSQL (pgvector)** for session storage.

## Quick Start

### Prerequisites

- Docker Desktop
- AWS credentials with Bedrock access (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`)

### 1. Configure environment

```bash
cp .env.example .env   # or edit the existing .env
# Ensure your AWS credentials are set
```

### 2. Start everything

```bash
make up
```

This builds and starts:
- **API** at http://localhost:8000
- **Swagger docs** at http://localhost:8000/docs
- **PostgreSQL** at localhost:5432

### 3. Connect to the control plane

1. Open [os.agno.com](https://os.agno.com)
2. Click **Add OS** → **Local**
3. Enter `http://localhost:8000`

## Makefile Commands

Run `make help` to see all available commands:

| Command | Description |
|---------|-------------|
| `make up` | Start all services (db + api) |
| `make down` | Stop all services |
| `make rebuild` | Force rebuild (no cache) and start |
| `make restart` | Restart the API container |
| `make status` | Show running containers |
| `make logs` | Tail logs for all services |
| `make logs-api` | Tail logs for the API only |
| `make logs-db` | Tail logs for the database only |
| `make shell-api` | Open a shell inside the API container |
| `make shell-db` | Open a psql shell in the database |
| `make dev` | Run API locally with hot-reload |
| `make serve` | Run API locally in production mode |
| `make db-up` | Start only the database container |
| `make clean` | Stop services and delete all data |

## Local Development (without Docker)

If you prefer running Python directly:

```bash
# 1. Start the database
make db-up

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run with hot-reload
make dev
```

## Project Structure

```
backend/
├── agents/
│   ├── __init__.py
│   └── notebooklm_team.py    # Team with Researcher + Writer members
├── app/
│   ├── __init__.py
│   └── main.py                # AgentOS entry point
├── db/
│   ├── __init__.py
│   ├── session.py             # PostgresDb factory
│   └── url.py                 # DB URL builder from env vars
├── .env                       # Environment variables (not committed)
├── compose.yaml               # Docker Compose config
├── Dockerfile
├── Makefile
├── pyproject.toml
├── railway.json               # Railway deployment config
└── requirements.txt
```

## Environment Variables

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

## Deploy to Railway

```bash
railway login
railway up
```

See `railway.json` for deployment configuration.

## API Endpoints

Once running, the AgentOS provides 50+ endpoints including:

- `GET /` — OS info
- `GET /teams` — List teams
- `POST /teams/{team_id}/runs` — Run a team
- `GET /sessions` — List sessions
- `GET /health` — Health check
- `GET /docs` — Swagger UI

Full API reference at http://localhost:8000/docs.
