#!/bin/bash

############################################################################
#
#    Agno Railway Deployment (Backend + Frontend + PgVector)
#
#    Usage: cd backend && ./scripts/railway_up.sh
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
PROJECT_NAME="${RAILWAY_PROJECT_NAME:-agno-notebooklm}"
BACKEND_SERVICE="${RAILWAY_BACKEND_SERVICE:-agent_os}"
FRONTEND_SERVICE="${RAILWAY_FRONTEND_SERVICE:-agent_ui}"

echo -e "${BOLD}Initializing Railway project: ${PROJECT_NAME}...${NC}"
echo ""
railway init -n "$PROJECT_NAME"

# ── Deploy PgVector database ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}Deploying PgVector database...${NC}"
echo ""
railway deploy -t 3jJFCA

echo ""
echo -e "${DIM}Waiting 15s for database to initialize...${NC}"
sleep 15

# ══════════════════════════════════════════════════════════════════════════
#  BACKEND SERVICE
# ══════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Creating backend service: ${BACKEND_SERVICE}...${NC}"
echo ""
railway add --service "$BACKEND_SERVICE" \
    --variables 'DB_USER=${{pgvector.PGUSER}}' \
    --variables 'DB_PASS=${{pgvector.PGPASSWORD}}' \
    --variables 'DB_HOST=${{pgvector.PGHOST}}' \
    --variables 'DB_PORT=${{pgvector.PGPORT}}' \
    --variables 'DB_DATABASE=${{pgvector.PGDATABASE}}' \
    --variables "DB_DRIVER=postgresql+psycopg" \
    --variables "WAIT_FOR_DB=True" \
    --variables "PORT=8000"

# ── Add API keys to backend ─────────────────────────────────────────────
if [[ -n "$OPENAI_API_KEY" ]]; then
    echo -e "${DIM}Adding OPENAI_API_KEY...${NC}"
    railway variables --set "OPENAI_API_KEY=${OPENAI_API_KEY}" --service "$BACKEND_SERVICE" --skip-deploys
fi

if [[ -n "$ANTHROPIC_API_KEY" ]]; then
    echo -e "${DIM}Adding ANTHROPIC_API_KEY...${NC}"
    railway variables --set "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" --service "$BACKEND_SERVICE" --skip-deploys
fi

if [[ -n "$AWS_ACCESS_KEY_ID" ]]; then
    echo -e "${DIM}Adding AWS credentials...${NC}"
    railway variables --set "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}" --service "$BACKEND_SERVICE" --skip-deploys
    railway variables --set "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}" --service "$BACKEND_SERVICE" --skip-deploys
    railway variables --set "AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1}" --service "$BACKEND_SERVICE" --skip-deploys
fi

if [[ -n "$GOOGLE_API_KEY" ]]; then
    echo -e "${DIM}Adding GOOGLE_API_KEY...${NC}"
    railway variables --set "GOOGLE_API_KEY=${GOOGLE_API_KEY}" --service "$BACKEND_SERVICE" --skip-deploys
fi

if [[ -n "$AGENT_MODEL" ]]; then
    echo -e "${DIM}Adding AGENT_MODEL...${NC}"
    railway variables --set "AGENT_MODEL=${AGENT_MODEL}" --service "$BACKEND_SERVICE" --skip-deploys
fi

if [[ -n "$EXA_API_KEY" ]]; then
    echo -e "${DIM}Adding EXA_API_KEY...${NC}"
    railway variables --set "EXA_API_KEY=${EXA_API_KEY}" --service "$BACKEND_SERVICE" --skip-deploys
fi

if [[ -n "$CO_API_KEY" ]]; then
    echo -e "${DIM}Adding CO_API_KEY...${NC}"
    railway variables --set "CO_API_KEY=${CO_API_KEY}" --service "$BACKEND_SERVICE" --skip-deploys
fi

if [[ -n "$LANGWATCH_API_KEY" ]]; then
    echo -e "${DIM}Adding LANGWATCH_API_KEY...${NC}"
    railway variables --set "LANGWATCH_API_KEY=${LANGWATCH_API_KEY}" --service "$BACKEND_SERVICE" --skip-deploys
fi

# ── Deploy backend ──────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Deploying backend...${NC}"
echo ""
railway up --service "$BACKEND_SERVICE" -d

# ── Create backend domain ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}Creating backend domain...${NC}"
echo ""
railway domain --service "$BACKEND_SERVICE"

# ══════════════════════════════════════════════════════════════════════════
#  FRONTEND SERVICE
# ══════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Creating frontend service: ${FRONTEND_SERVICE}...${NC}"
echo ""
railway add --service "$FRONTEND_SERVICE" \
    --variables "PORT=3000" \
    --variables 'NEXT_PUBLIC_BACKEND_URL=https://${{agent_os.RAILWAY_PUBLIC_DOMAIN}}'

if [[ -n "$NEXT_PUBLIC_OS_SECURITY_KEY" ]]; then
    echo -e "${DIM}Adding NEXT_PUBLIC_OS_SECURITY_KEY...${NC}"
    railway variables --set "NEXT_PUBLIC_OS_SECURITY_KEY=${NEXT_PUBLIC_OS_SECURITY_KEY}" --service "$FRONTEND_SERVICE" --skip-deploys
fi

# ── Deploy frontend ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Deploying frontend from ../frontend ...${NC}"
echo ""

# The frontend code lives one directory up in ../frontend.
# We need to link the Railway project there before deploying.
RAILWAY_PROJECT_ID=$(railway status --json 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
pushd ../frontend > /dev/null
if [[ -n "$RAILWAY_PROJECT_ID" ]]; then
    railway link --project "$RAILWAY_PROJECT_ID" 2>/dev/null || true
fi
railway up --service "$FRONTEND_SERVICE" -d
popd > /dev/null

# ── Create frontend domain ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}Creating frontend domain...${NC}"
echo ""
railway domain --service "$FRONTEND_SERVICE"

# ══════════════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Deployment complete!${NC}"
echo -e "${DIM}Domains may take ~5 minutes to propagate.${NC}"
echo ""
echo "Services deployed:"
echo "  - PgVector (database)"
echo "  - ${BACKEND_SERVICE} (backend API)"
echo "  - ${FRONTEND_SERVICE} (frontend UI)"
echo ""
echo "Useful commands:"
echo "  railway logs --service $BACKEND_SERVICE      # Backend logs"
echo "  railway logs --service $FRONTEND_SERVICE      # Frontend logs"
echo "  railway open                                  # Open dashboard"
echo "  railway up --service $BACKEND_SERVICE -d      # Redeploy backend"
echo "  cd ../frontend && railway up --service $FRONTEND_SERVICE -d   # Redeploy frontend"
echo ""
