# Production Deployment Guide

This project deploys alongside the existing Laravel blog on `site.example` and **reuses the already running Traefik instance** for routing and SSL.

## Quick Deployment

1. **Prepare environment variables**
```bash
cp .env.prod .env
# Edit .env with production values
```

2. **Deploy**
```bash
./deploy-prod.sh
```
   > The script combines `compose.base.yml` and `compose.prod.yml`, attaching the containers to the external Traefik network (`phpqaru-app-network` by default). If your Traefik network has a different name, update the `networks` section in `compose.prod.yml`.

## Manual Deployment

```bash
# Stop existing containers
docker compose -f compose.base.yml -f compose.prod.yml down

# Build and start
docker compose -f compose.base.yml -f compose.prod.yml up -d --build
```

## Services

- **Frontend** — `https://tlg.site.example` (Nuxt 3)
- **Backend API** — `https://api-tlg.site.example` (NestJS + Socket.IO)
- **Database** — PostgreSQL container (internal only)
- **Traefik** — the pre-existing instance from the Laravel stack; no extra container is started here

## Traefik Integration

The new stack simply joins the external Docker network (`phpqaru-app-network`) already used by the Laravel project. The existing Traefik instance continues to provide:

- Automatic SSL certificates via Let's Encrypt
- HTTP→HTTPS redirection
- Security headers (HSTS, XSS protection, etc.)
- API rate limiting
- Response compression
- WebSocket proxying support

## Monitoring

```bash
# All services
docker compose -f compose.base.yml -f compose.prod.yml logs -f

# Individual containers
docker compose -f compose.base.yml -f compose.prod.yml logs -f fe
docker compose -f compose.base.yml -f compose.prod.yml logs -f be

# Existing Traefik (Laravel stack)
docker logs -f phpqaru-traefik-1
```

## DNS

Point these records to the server:
- `tlg.site.example`
- `api-tlg.site.example`

## Environment

Important values in `.env`:

```bash
# Let's Encrypt contact email
ACME_EMAIL=admin@tlg.site.example

# Database (change the password!)
POSTGRES_PASSWORD=secure-password-here

# Application endpoints
NUXT_PUBLIC_API_BASE=https://api-tlg.site.example
NUXT_PUBLIC_WS_URL=wss://api-tlg.site.example
```

## Backup

```bash
docker compose -f compose.base.yml -f compose.prod.yml exec db pg_dump -U user game_db > backup.sql
```

## Troubleshooting

- **SSL issues** — inspect `docker logs -f phpqaru-traefik-1` to confirm Let's Encrypt renewals
- **WebSocket issues** — verify both `fe` and `be` containers are attached to the Traefik network and their routers appear in `docker ps` output for Traefik
- **Service discovery** — ensure every container in the stack joins the same external network as Traefik
