# Deployment Guide

Production deployment to Railway.

## Prerequisites

- **Railway CLI** installed:

```bash
brew install railway
```

- Logged in to Railway:

```bash
railway login
```

- AWS credentials and any required API keys set in `backend/.env`

## First-Time Deployment

For a brand-new deployment (creates the Railway project and all services):

```bash
make deploy
```

This runs `backend/scripts/railway_up.sh`, which:

1. Creates a Railway project named `agno-notebooklm`
2. Deploys a **PgVector** PostgreSQL database
3. Creates and deploys the **backend** service (`agent_os`) with database credentials injected
4. Creates and deploys the **frontend** service (`agent_ui`) pointing to the backend URL
5. Creates public domains for both services
6. Runs database migrations

After completion, the script prints the public URLs for both services.

## Redeployment Workflow

When deploying code changes, follow these three steps:

```bash
# 1. Run database migrations (if any schema changes)
make migrate-prod

# 2. Deploy code changes
make deploy-all

# 3. Verify everything works
make test-prod
```

**Important**: Migrations do NOT run automatically on deploy. Always run `make migrate-prod` before deploying if you have schema changes. See the [How to Create Migrations](how-to-create-migrations.md) guide for details.

### Individual Service Deploys

If only one service changed:

```bash
# Backend only
make deploy-backend

# Frontend only
make deploy-frontend
```

## Database Migrations in Production

Migrations are run from your local machine using Railway's environment variable injection:

```bash
# Run all pending migrations
make migrate-prod

# Check current migration status
make migrate-prod-status
```

Under the hood, `make migrate-prod` runs:

```bash
cd backend && railway run --service agent_os alembic -c alembic.ini upgrade head
```

`railway run` injects the production environment variables (`DB_HOST`, `DB_PASS`, etc.) into the local process, so Alembic connects directly to the Railway PostgreSQL instance.

### Why Not Run Migrations on Container Start?

We intentionally keep migrations separate from the server start command. Combining `alembic upgrade head && uvicorn ...` in the Railway `startCommand` caused the container to hang during startup due to the heavy agno/AWS SDK import after migrations. Running migrations separately via `railway run` avoids this issue entirely.

## Monitoring

| Command | Description |
|---------|-------------|
| `make railway-logs-backend` | Tail backend logs |
| `make railway-logs-frontend` | Tail frontend logs |
| `make railway-status` | Show Railway project status |
| `make railway-open` | Open Railway dashboard in browser |

## Verification

Run all production tests:

```bash
make test-prod
```

This checks:

- **Health endpoint**: `GET /health` returns 200
- **CORS**: Response includes `access-control-allow-origin` header for the frontend domain
- **Teams endpoint**: `GET /teams` returns valid JSON
- **Frontend**: Home page returns HTTP 200

You can also test individually:

```bash
make test-backend-prod
make test-frontend-prod
```

## Environment Variables

Railway injects environment variables at runtime. The backend reads them via `backend/db/url.py`:

```python
driver = getenv("DB_DRIVER", "postgresql+psycopg")
user = getenv("DB_USER", "ai")
password = getenv("DB_PASS", "ai")
host = getenv("DB_HOST", "localhost")
port = getenv("DB_PORT", "5432")
database = getenv("DB_DATABASE", "ai")
```

The deploy script (`railway_up.sh`) automatically configures `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, and `DB_DATABASE` on the backend service using the Railway PostgreSQL internal connection details.

The frontend uses build-time arguments:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL (set during Docker build) |
| `NEXT_PUBLIC_OS_SECURITY_KEY` | Optional auth token for AgentOS |

## Service Configuration

### Backend (`backend/railway.json`)

```json
{
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port 8000",
    "limits": { "cpu": 2000, "memory": "4Gi" },
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Frontend (`frontend/railway.json`)

```json
{
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "startCommand": "node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Troubleshooting

- **502 Bad Gateway after deploy**: Check `make railway-logs-backend` for startup errors. The backend takes a few seconds to initialize (loading AWS SDK, agno models).
- **Database connection errors**: Verify `DB_HOST` and `DB_PASS` are set correctly with `railway variables --service agent_os`.
- **Migration failures**: Run `make migrate-prod-status` to see the current state, then check the migration file for issues.
- **Frontend not connecting**: Ensure `NEXT_PUBLIC_BACKEND_URL` was set correctly during the frontend build. Redeploy the frontend if the backend URL changed.
