.PHONY: help dev down backend-up backend-dev backend-down frontend-dev frontend-build \
       deploy deploy-backend deploy-frontend deploy-all \
       migrate-prod migrate-prod-status \
       railway-logs-backend railway-logs-frontend railway-status railway-open \
       test-backend-local test-frontend-local test-backend-prod test-frontend-prod test-prod

# ─── Production URLs ─────────────────────────────────────────────────────────
# Resolved dynamically from Railway. Override with env vars if needed:
#   BACKEND_PROD_URL=https://... FRONTEND_PROD_URL=https://... make test-prod
BACKEND_PROD_URL  ?= $(shell cd backend 2>/dev/null && railway variables --service agent_os --json 2>/dev/null | python3 -c "import sys,json; print('https://'+json.load(sys.stdin).get('RAILWAY_PUBLIC_DOMAIN',''))" 2>/dev/null)
FRONTEND_PROD_URL ?= $(shell cd frontend 2>/dev/null && railway variables --service agent_ui --json 2>/dev/null | python3 -c "import sys,json; print('https://'+json.load(sys.stdin).get('RAILWAY_PUBLIC_DOMAIN',''))" 2>/dev/null)

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-25s\033[0m %s\n", $$1, $$2}'

# ═══════════════════════════════════════════════════════════════════════════════
#  LOCAL DEVELOPMENT
# ═══════════════════════════════════════════════════════════════════════════════

backend-up: ## Start backend + database via Docker Compose
	cd backend && docker compose up -d --build

backend-dev: ## Run backend locally with hot-reload (DB must be running)
	cd backend && RUNTIME_ENV=dev python -m app.main

backend-down: ## Stop backend services
	cd backend && docker compose down

frontend-dev: ## Start frontend dev server at http://localhost:3000
	cd frontend && pnpm install && pnpm dev

frontend-build: ## Build frontend for production
	cd frontend && pnpm install && pnpm build

dev: ## Start everything locally (backend + frontend in background)
	@echo "Starting backend..."
	cd backend && docker compose up -d --build
	@echo ""
	@echo "Starting frontend..."
	cd frontend && pnpm install && pnpm dev

down: ## Stop all local services
	cd backend && docker compose down
	@echo "Backend stopped. Frontend dev server must be stopped manually (Ctrl+C)."

# ═══════════════════════════════════════════════════════════════════════════════
#  RAILWAY DEPLOYMENT
# ═══════════════════════════════════════════════════════════════════════════════

deploy: ## First-time deploy: create Railway project + all services
	cd backend && ./scripts/railway_up.sh

deploy-backend: ## Redeploy backend to Railway
	cd backend && railway up --service agent_os -d

deploy-frontend: ## Redeploy frontend to Railway
	cd frontend && railway up --service agent_ui -d

deploy-all: deploy-backend deploy-frontend ## Redeploy both backend and frontend

migrate-prod: ## Run Alembic migrations on production database
	cd backend && railway run --service agent_os alembic -c alembic.ini upgrade head

migrate-prod-status: ## Show current migration status on production database
	cd backend && railway run --service agent_os alembic -c alembic.ini current

railway-logs-backend: ## Tail backend logs on Railway
	cd backend && railway logs --service agent_os

railway-logs-frontend: ## Tail frontend logs on Railway
	cd frontend && railway logs --service agent_ui

railway-status: ## Show Railway project status
	cd backend && railway status

railway-open: ## Open Railway dashboard in browser
	cd backend && railway open

# ═══════════════════════════════════════════════════════════════════════════════
#  TESTING & VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

test-backend-local: ## Test local backend health endpoint
	@echo "Testing backend at http://localhost:8000..."
	@curl -sf http://localhost:8000/health > /dev/null \
		&& echo "✅ Backend is healthy" \
		|| echo "❌ Backend is not reachable"
	@echo ""
	@echo "Endpoints:"
	@curl -sf http://localhost:8000/teams 2>/dev/null | python3 -m json.tool 2>/dev/null \
		&& echo "" \
		|| echo "  (could not fetch /teams)"

test-frontend-local: ## Test local frontend
	@echo "Testing frontend at http://localhost:3000..."
	@curl -sf -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/ \
		&& echo " ✅ Frontend is running" \
		|| echo " ❌ Frontend is not reachable"

test-backend-prod: ## Test production backend health + CORS
	@echo "Testing production backend..."
	@echo ""
	@echo "Health check:"
	@curl -sf $(BACKEND_PROD_URL)/health > /dev/null \
		&& echo "  ✅ Backend is healthy" \
		|| echo "  ❌ Backend is not reachable"
	@echo ""
	@echo "CORS check (Origin: $(FRONTEND_PROD_URL)):"
	@curl -sI -H "Origin: $(FRONTEND_PROD_URL)" $(BACKEND_PROD_URL)/health 2>/dev/null \
		| grep -i "access-control-allow-origin" \
		&& echo "  ✅ CORS is configured" \
		|| echo "  ❌ CORS header missing"
	@echo ""
	@echo "Teams endpoint:"
	@curl -sf $(BACKEND_PROD_URL)/teams 2>/dev/null | python3 -m json.tool 2>/dev/null \
		&& echo "" \
		|| echo "  (could not fetch /teams)"

test-frontend-prod: ## Test production frontend
	@echo "Testing production frontend..."
	@STATUS=$$(curl -sf -o /dev/null -w "%{http_code}" $(FRONTEND_PROD_URL)/); \
	if [ "$$STATUS" = "200" ]; then \
		echo "  ✅ Frontend is running (HTTP $$STATUS)"; \
	else \
		echo "  ❌ Frontend returned HTTP $$STATUS"; \
	fi

test-prod: test-backend-prod test-frontend-prod ## Test all production endpoints
