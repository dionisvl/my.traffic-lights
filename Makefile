COMPOSE_DEV = docker compose -p tlg-dev -f compose.prod.yml -f compose.dev.yml

.PHONY: help up down restart logs test e2e playwright playwright-docker

help:
	@printf '%s\n' 'up/down/restart/logs: manage the local Docker stack' 'test: run game logic tests (Node.js 26)' 'e2e/playwright/playwright-docker: run Playwright against the local stack'

up:
	$(COMPOSE_DEV) up -d --build --wait

down:
	$(COMPOSE_DEV) down

restart:
	$(COMPOSE_DEV) restart

logs:
	$(COMPOSE_DEV) logs -f

test:
	node --test kit/test/game.test.mjs

e2e playwright playwright-docker:
	npm --prefix kit run test:e2e
