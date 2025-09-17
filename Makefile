.PHONY: help up down restart logs clean test e2e playwright playwright-docker

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
	docker compose up --build -d

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

clean:
	docker compose down -v --rmi all --remove-orphans

test:
	docker compose exec be npm test --prefix ..

e2e:
	npm run e2e

playwright:
	npm run test:pw

playwright-docker:
	PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test --config=playwright.config.docker.ts