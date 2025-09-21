.PHONY: help up down restart logs clean test e2e playwright playwright-docker

COMPOSE_DEV = docker compose -f compose.base.yml -f compose.dev.yml

help:
	@echo "Traffic Lights Game - Docker Compose Commands"
	@echo "  up               - Start all services (build if needed)"
	@echo "  down             - Stop and remove containers"
	@echo "  restart          - Restart all services"
	@echo "  logs             - Show logs for all services"
	@echo "  clean            - Clean up containers, images and volumes"
	@echo "  test             - Run tests inside Docker container"
	@echo "  e2e              - Run E2E tests"
	@echo "  playwright       - Run Playwright tests (starts own servers)"
	@echo "  playwright-docker - Run Playwright tests against Docker services"

up:
	$(COMPOSE_DEV) up --build -d

down:
	$(COMPOSE_DEV) down

restart: down up

logs:
	$(COMPOSE_DEV) logs -f

clean:
	$(COMPOSE_DEV) down -v --rmi all --remove-orphans

test:
	$(COMPOSE_DEV) exec be npm test --prefix ..

e2e:
	npm run e2e

playwright:
	npm run test:pw

playwright-docker:
	PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test --config=playwright.config.docker.ts
