# Railway Scripts Reference

Complete templates for deploying Agno AgentOS projects to Railway.

## railway_up.sh Template

Create this at `scripts/railway_up.sh` in the backend directory. Adapt the project name, service name, and environment variables for your project.

```bash
#!/bin/bash

############################################################################
#
#    Agno Railway Deployment
#
#    Usage: ./scripts/railway_up.sh
#
#    Prerequisites:
#      - Railway CLI installed (brew install railway)
#      - Logged in via `railway login`
#      - Required API keys set in .env or environment
#
############################################################################

set -e

BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Load .env ──────────────────────────────────────────────────────────────
if [[ -f .env ]]; then
    set -a
    source .env
    set +a
    echo -e "${DIM}Loaded .env${NC}"
fi

# ── Preflight checks ──────────────────────────────────────────────────────
if ! command -v railway &> /dev/null; then
    echo "Railway CLI not found. Install: brew install railway"
    echo "Docs: https://docs.railway.com/guides/cli"
    exit 1
fi

# Check for at least one model provider key
if [[ -z "$OPENAI_API_KEY" && -z "$ANTHROPIC_API_KEY" && -z "$AWS_ACCESS_KEY_ID" && -z "$GOOGLE_API_KEY" ]]; then
    echo "No model provider API key found."
    echo "Set at least one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, AWS_ACCESS_KEY_ID, GOOGLE_API_KEY"
    exit 1
fi

# ── Initialize Railway project ────────────────────────────────────────────
# Change "agno" to your project name
PROJECT_NAME="${RAILWAY_PROJECT_NAME:-agno}"
SERVICE_NAME="${RAILWAY_SERVICE_NAME:-agent_os}"

echo -e "${BOLD}Initializing Railway project: ${PROJECT_NAME}...${NC}"
echo ""
railway init -n "$PROJECT_NAME"

# ── Deploy PgVector database ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}Deploying PgVector database...${NC}"
echo ""
railway deploy -t 3jJFCA

echo ""
echo -e "${DIM}Waiting 10s for database to initialize...${NC}"
sleep 10

# ── Create application service ────────────────────────────────────────────
echo ""
echo -e "${BOLD}Creating application service: ${SERVICE_NAME}...${NC}"
echo ""
railway add --service "$SERVICE_NAME" \
    --variables 'DB_USER=${{pgvector.PGUSER}}' \
    --variables 'DB_PASS=${{pgvector.PGPASSWORD}}' \
    --variables 'DB_HOST=${{pgvector.PGHOST}}' \
    --variables 'DB_PORT=${{pgvector.PGPORT}}' \
    --variables 'DB_DATABASE=${{pgvector.PGDATABASE}}' \
    --variables "DB_DRIVER=postgresql+psycopg" \
    --variables "WAIT_FOR_DB=True" \
    --variables "PORT=8000"

# ── Add API keys ──────────────────────────────────────────────────────────
if [[ -n "$OPENAI_API_KEY" ]]; then
    echo -e "${DIM}Adding OPENAI_API_KEY...${NC}"
    railway variables --set "OPENAI_API_KEY=${OPENAI_API_KEY}" --service "$SERVICE_NAME" --skip-deploys
fi

if [[ -n "$ANTHROPIC_API_KEY" ]]; then
    echo -e "${DIM}Adding ANTHROPIC_API_KEY...${NC}"
    railway variables --set "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" --service "$SERVICE_NAME" --skip-deploys
fi

if [[ -n "$AWS_ACCESS_KEY_ID" ]]; then
    echo -e "${DIM}Adding AWS credentials...${NC}"
    railway variables --set "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}" --service "$SERVICE_NAME" --skip-deploys
    railway variables --set "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}" --service "$SERVICE_NAME" --skip-deploys
    railway variables --set "AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1}" --service "$SERVICE_NAME" --skip-deploys
fi

if [[ -n "$GOOGLE_API_KEY" ]]; then
    echo -e "${DIM}Adding GOOGLE_API_KEY...${NC}"
    railway variables --set "GOOGLE_API_KEY=${GOOGLE_API_KEY}" --service "$SERVICE_NAME" --skip-deploys
fi

if [[ -n "$EXA_API_KEY" ]]; then
    echo -e "${DIM}Adding EXA_API_KEY...${NC}"
    railway variables --set "EXA_API_KEY=${EXA_API_KEY}" --service "$SERVICE_NAME" --skip-deploys
fi

# ── Deploy application ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Deploying application...${NC}"
echo ""
railway up --service "$SERVICE_NAME" -d

# ── Create public domain ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Creating domain...${NC}"
echo ""
railway domain --service "$SERVICE_NAME"

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Deployment complete.${NC}"
echo -e "${DIM}Domain may take ~5 minutes to propagate.${NC}"
echo ""
echo "Next steps:"
echo "  1. Open https://os.agno.com"
echo "  2. Click 'Add OS' -> 'Live'"
echo "  3. Enter your Railway domain"
echo ""
echo "Useful commands:"
echo "  railway logs --service $SERVICE_NAME     # View logs"
echo "  railway open                             # Open dashboard"
echo "  railway up --service $SERVICE_NAME -d    # Redeploy"
echo ""
```

## railway_down.sh Template

Create this at `scripts/railway_down.sh` in the backend directory.

```bash
#!/bin/bash

############################################################################
#
#    Agno Railway Teardown
#
#    Usage: ./scripts/railway_down.sh
#
############################################################################

set -e

BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SERVICE_NAME="${RAILWAY_SERVICE_NAME:-agent_os}"

echo -e "${BOLD}Stopping application service...${NC}"
railway down --service "$SERVICE_NAME"

echo ""
echo -e "${BOLD}Stopping PgVector database...${NC}"
railway down --service pgvector

echo ""
echo -e "${BOLD}All services stopped.${NC}"
echo -e "${DIM}To fully delete the project, use: railway delete${NC}"
echo ""
```

## Dockerfile Template

Use this Dockerfile for Railway deployments. Place it in the backend directory root.

```dockerfile
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

ARG USER=app
ARG APP_DIR=/app

RUN groupadd -g 61000 ${USER} \
 && useradd -g 61000 -u 61000 -ms /bin/bash -d ${APP_DIR} ${USER}

WORKDIR ${APP_DIR}

# Install dependencies first (better layer caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY --chown=${USER}:${USER} . .

USER ${USER}

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## railway.json Reference

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "runtime": "V2",
    "numReplicas": 1,
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port 8000",
    "sleepApplication": false,
    "limits": {
      "cpu": 2000,
      "memory": "4Gi"
    },
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Configuration options

| Field | Description | Default |
|-------|-------------|---------|
| `builder` | Build method (`DOCKERFILE`, `NIXPACKS`) | `DOCKERFILE` |
| `dockerfilePath` | Path to Dockerfile | `Dockerfile` |
| `numReplicas` | Number of instances | `1` |
| `startCommand` | Command to start the app | uvicorn |
| `sleepApplication` | Sleep when idle (saves cost) | `false` |
| `limits.cpu` | CPU limit in millicores | `2000` |
| `limits.memory` | Memory limit | `4Gi` |
| `restartPolicyType` | Restart policy | `ON_FAILURE` |
| `restartPolicyMaxRetries` | Max restart attempts | `10` |

## Environment Variables Reference

### Database (auto-configured by Railway PgVector template)

| Variable | Railway Reference | Description |
|----------|-------------------|-------------|
| `DB_USER` | `${{pgvector.PGUSER}}` | PostgreSQL username |
| `DB_PASS` | `${{pgvector.PGPASSWORD}}` | PostgreSQL password |
| `DB_HOST` | `${{pgvector.PGHOST}}` | PostgreSQL host |
| `DB_PORT` | `${{pgvector.PGPORT}}` | PostgreSQL port |
| `DB_DATABASE` | `${{pgvector.PGDATABASE}}` | PostgreSQL database name |
| `DB_DRIVER` | Set manually | `postgresql+psycopg` |

### Application

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API server port (default: `8000`) |
| `WAIT_FOR_DB` | No | Wait for DB before starting (default: `True`) |
| `RUNTIME_ENV` | No | `dev` for auto-reload, `prd` for production |
| `DATA_DIR` | No | Directory for file storage (default: `/data`) |

### Model Provider API Keys

| Variable | Provider | Required |
|----------|----------|----------|
| `OPENAI_API_KEY` | OpenAI | At least one provider key required |
| `ANTHROPIC_API_KEY` | Anthropic | Optional |
| `AWS_ACCESS_KEY_ID` | AWS Bedrock | Optional |
| `AWS_SECRET_ACCESS_KEY` | AWS Bedrock | Optional |
| `AWS_DEFAULT_REGION` | AWS Bedrock | Optional (default: `us-east-1`) |
| `GOOGLE_API_KEY` | Google Gemini | Optional |

### Optional Tool Keys

| Variable | Service | Description |
|----------|---------|-------------|
| `EXA_API_KEY` | Exa | Web research and search |

## Generating requirements.txt

The Dockerfile needs `requirements.txt`. Generate it from `pyproject.toml`:

```bash
# Using uv (recommended, fastest)
uv pip compile pyproject.toml -o requirements.txt

# Using pip-tools
pip-compile pyproject.toml -o requirements.txt

# Quick alternative (less reproducible)
pip install . && pip freeze > requirements.txt
```

## Common Issues

### Build fails: requirements.txt not found

Generate `requirements.txt` from `pyproject.toml` (see above).

### Database connection refused

Ensure `WAIT_FOR_DB=True` is set. The database may take 10-30 seconds to initialize after deployment.

### Port mismatch

Railway expects the app to listen on the port defined by `PORT` env var. Ensure `railway.json` start command and Dockerfile CMD both use port 8000, and `PORT=8000` is set.

### PgVector template ID

The PgVector template ID `3jJFCA` is the official Railway PgVector template. If Railway changes this ID, check https://railway.com/template for the latest.
