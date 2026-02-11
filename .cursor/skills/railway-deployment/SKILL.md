---
name: railway-deployment
description: Deploy Agno AgentOS projects to Railway with PgVector database. Use when the user wants to deploy to Railway, deploy to production, create a Railway deployment, set up Railway, or ship an Agno project to the cloud.
---

# Railway Deployment for Agno Projects

Deploy an Agno AgentOS project to Railway following the official [agentos-railway-template](https://github.com/agno-agi/agentos-railway-template).

## Prerequisites

Before deploying, ensure:

1. **Railway CLI** is installed (`brew install railway` or see https://docs.railway.com/guides/cli)
2. User is logged in via `railway login`
3. **OPENAI_API_KEY** (or the required model provider key) is set in `.env` or environment
4. Docker is available locally for building/testing

Verify Railway CLI:

```bash
railway --version
```

## Pre-Deployment Checklist

Run these checks before deploying. Fix any issues found.

### 1. Ensure `requirements.txt` exists

The Dockerfile expects `requirements.txt`. If it is missing, generate it from `pyproject.toml`:

```bash
# Using uv (preferred)
uv pip compile pyproject.toml -o requirements.txt

# Or using pip-tools
pip-compile pyproject.toml -o requirements.txt
```

### 2. Validate `Dockerfile`

The project must have a `Dockerfile` in the backend directory. If missing, create one based on the template in [references/RAILWAY-SCRIPTS.md](references/RAILWAY-SCRIPTS.md).

Key requirements:
- Python 3.12 base image
- Installs from `requirements.txt`
- Exposes port 8000
- Runs uvicorn on `app.main:app`

### 3. Validate `railway.json`

The project must have a `railway.json` file. If missing, create one:

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

### 4. Validate `.env`

Ensure `.env` contains at minimum:

```
OPENAI_API_KEY=sk-***
```

## Deployment Workflow

### Step 1: Verify prerequisites

```bash
# Check Railway CLI
command -v railway || echo "Railway CLI not installed"

# Check login
railway whoami

# Check API key
echo $OPENAI_API_KEY | head -c 5
```

### Step 2: Generate `requirements.txt` (if missing)

Run from the backend directory:

```bash
uv pip compile pyproject.toml -o requirements.txt
```

### Step 3: Create the deployment script

Create `scripts/railway_up.sh` in the backend directory. Use the template from [references/RAILWAY-SCRIPTS.md](references/RAILWAY-SCRIPTS.md) and adapt:

- **Project name**: Use the project name from `pyproject.toml` (e.g., `notebooklm`)
- **Service name**: Use a meaningful service name (e.g., `agent_os` or match compose service name)
- **Environment variables**: Match the variables from `db/url.py` and `.env`:
  - `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_DATABASE` -- wired from PgVector via Railway references `${{pgvector.PGUSER}}` etc.
  - `DB_DRIVER=postgresql+psycopg`
  - `WAIT_FOR_DB=True`
  - `PORT=8000`
  - API keys from `.env` (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AWS_ACCESS_KEY_ID`)
- **Optional keys**: Read `.env` to detect additional API keys and add them conditionally

Make the script executable:

```bash
chmod +x scripts/railway_up.sh
```

### Step 4: Run the deployment

```bash
cd backend
./scripts/railway_up.sh
```

The script will:
1. Initialize a Railway project
2. Deploy a PgVector database (template ID `3jJFCA`)
3. Wait for the database to be ready
4. Create the application service with all environment variables
5. Deploy the application from the Dockerfile
6. Create a public domain

### Step 5: Connect to control plane

1. Open https://os.agno.com
2. Click **Add OS** then **Live**
3. Enter the Railway domain URL printed by the script

## Post-Deployment Management

### View logs

```bash
railway logs --service agent_os
```

### Redeploy after code changes

```bash
railway up --service agent_os -d
```

### Open Railway dashboard

```bash
railway open
```

### Teardown services

```bash
railway down --service agent_os
railway down --service pgvector
```

### Add environment variables

```bash
railway variables --set "MY_VAR=my_value" --service agent_os
```

### Scale replicas

Edit `railway.json`:

```json
{
  "deploy": {
    "numReplicas": 2
  }
}
```

Then redeploy.

## Customization

### Adding API keys for different model providers

Read the project's `.env` file to identify which API keys are needed. Common ones:

| Variable | Provider |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_DEFAULT_REGION` | AWS Bedrock |
| `GOOGLE_API_KEY` | Google Gemini |
| `EXA_API_KEY` | Exa (web research) |

Add them to the Railway service:

```bash
railway variables --set "ANTHROPIC_API_KEY=sk-ant-***" --service agent_os --skip-deploys
```

### Changing resource limits

Edit `railway.json` `deploy.limits`:

```json
"limits": {
  "cpu": 4000,
  "memory": "8Gi"
}
```

## Full Script Reference

For complete deployment and teardown script templates, Dockerfile reference, and environment variable details, see [references/RAILWAY-SCRIPTS.md](references/RAILWAY-SCRIPTS.md).
