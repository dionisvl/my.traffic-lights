#!/bin/bash

# Production deployment script for tlg.site.example
set -e

echo "🚀 Starting production deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.prod .env
    echo "📝 Please edit .env file with your production values"
    echo "   Especially change the database password and email!"
    exit 1
fi

# Ensure required directories exist
echo "📁 Creating required directories..."
mkdir -p letsencrypt logs/traefik

# Secure acme.json file
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f compose.yml -f compose.prod.yml down --remove-orphans || true

# Pull latest images
echo "📥 Pulling latest base images..."
docker compose -f compose.yml -f compose.prod.yml pull

# Build production images
echo "🔨 Building production images..."
docker compose -f compose.yml -f compose.prod.yml build --no-cache

# Start services
echo "🎯 Starting production services..."
docker compose -f compose.yml -f compose.prod.yml up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 10

# Show status
echo "📊 Service status:"
docker compose -f compose.yml -f compose.prod.yml ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Services should be available at:"
echo "   • Frontend: https://tlg.site.example"
echo "   • Backend API: https://api-tlg.site.example"
echo "   • Traefik Dashboard: https://traefik-tlg.site.example"
echo ""
echo "📋 Useful commands:"
echo "   • View logs: docker compose -f compose.yml -f compose.prod.yml logs -f"
echo "   • Stop services: docker compose -f compose.yml -f compose.prod.yml down"
echo "   • Restart: docker compose -f compose.yml -f compose.prod.yml restart"
echo ""
echo "🔒 Note: SSL certificates will be automatically obtained from Let's Encrypt"
echo "   This may take a few minutes on first run."