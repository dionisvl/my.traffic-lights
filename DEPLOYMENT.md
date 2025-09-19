# Production Deployment Guide

This project is configured to deploy on the same server as the Laravel blog at `site.example` using Traefik for routing and SSL management.

## Quick Deployment

1. **Setup environment variables:**
   ```bash
   cp .env.prod .env
   # Edit .env with your production values
   ```

2. **Deploy:**
   ```bash
   ./deploy-prod.sh
   ```

## Manual Deployment

If you prefer manual control:

```bash
# Stop existing containers
docker compose -f compose.yml -f compose.prod.yml down

# Build and start
docker compose -f compose.yml -f compose.prod.yml up -d --build
```

## Services

The production setup includes:

- **Frontend**: `https://tlg.site.example` (Nuxt.js application)
- **Backend API**: `https://api-tlg.site.example` (NestJS with Socket.IO)
- **Database**: PostgreSQL (internal)
- **Traefik**: Reverse proxy with automatic SSL
- **Traefik Dashboard**: `https://traefik-tlg.site.example`

## Traefik Configuration

The setup is based on the existing Traefik configuration from the Laravel blog project with:

- **Automatic SSL** via Let's Encrypt
- **HTTP to HTTPS redirect**
- **Security headers** (HSTS, XSS protection, etc.)
- **Rate limiting** on API endpoints
- **Compression** for static assets
- **WebSocket support** for Socket.IO

## Key Features

- ✅ Automatic SSL certificate management
- ✅ HTTP/2 and HTTP/3 support
- ✅ Security headers and rate limiting
- ✅ WebSocket proxying for real-time features
- ✅ Compression and performance optimization
- ✅ Structured logging

## Monitoring

View logs:
```bash
# All services
docker compose -f compose.yml -f compose.prod.yml logs -f

# Specific service
docker compose -f compose.yml -f compose.prod.yml logs -f traefik
docker compose -f compose.yml -f compose.prod.yml logs -f fe
docker compose -f compose.yml -f compose.prod.yml logs -f be
```

## DNS Configuration

Ensure these DNS records point to your server:
- `tlg.site.example` → server IP
- `api-tlg.site.example` → server IP  
- `traefik-tlg.site.example` → server IP

## Environment Variables

Key production environment variables in `.env`:

```bash
# SSL/Email for Let's Encrypt
ACME_EMAIL=admin@tlg.site.example

# Database (change password!)
POSTGRES_PASSWORD=secure-password-here

# Application URLs
NUXT_PUBLIC_API_BASE=https://api-tlg.site.example
NUXT_PUBLIC_WS_URL=wss://api-tlg.site.example
```

## Backup

Database backup:
```bash
docker compose -f compose.yml -f compose.prod.yml exec db pg_dump -U user game_db > backup.sql
```

## Troubleshooting

**SSL Issues**: Check Traefik logs and ensure ports 80/443 are open
**WebSocket Issues**: Verify WebSocket connections work through Traefik
**Service Discovery**: Ensure all services are on the same Docker network