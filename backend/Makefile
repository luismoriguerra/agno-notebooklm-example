.PHONY: help up down build rebuild logs logs-api logs-db shell-api shell-db status restart clean dev serve

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Docker Compose
# ---------------------------------------------------------------------------

up: ## Start all services (db + api)
	docker compose up -d --build

down: ## Stop all services
	docker compose down

build: ## Build the API container without starting
	docker compose build

rebuild: ## Force rebuild (no cache) and start
	docker compose build --no-cache
	docker compose up -d

restart: ## Restart the API container (picks up code changes)
	docker compose restart notebooklm-api

status: ## Show running containers
	docker compose ps

# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

logs: ## Tail logs for all services
	docker compose logs -f --tail 50

logs-api: ## Tail logs for the API service
	docker compose logs -f --tail 50 notebooklm-api

logs-db: ## Tail logs for the database
	docker compose logs -f --tail 50 notebooklm-db

# ---------------------------------------------------------------------------
# Shell Access
# ---------------------------------------------------------------------------

shell-api: ## Open a shell inside the API container
	docker compose exec notebooklm-api bash

shell-db: ## Open a psql shell inside the database
	docker compose exec notebooklm-db psql -U ai -d ai

# ---------------------------------------------------------------------------
# Local Development (without Docker)
# ---------------------------------------------------------------------------

dev: ## Run the API locally with hot-reload (requires local Python + DB running)
	RUNTIME_ENV=dev python -m app.main

serve: ## Run the API locally in production mode
	uvicorn app.main:app --host 0.0.0.0 --port 8000

db-up: ## Start only the database container
	docker compose up -d notebooklm-db

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

clean: ## Stop services and remove volumes (deletes all data)
	docker compose down -v
	@echo "All containers and volumes removed."
