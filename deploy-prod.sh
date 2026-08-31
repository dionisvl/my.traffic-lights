#!/bin/bash

# Production deployment script for tlg.site.example
set -euo pipefail

COMPOSE_CMD="docker compose -f compose.base.yml -f compose.prod.yml"

echo "🚀 Starting production deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.prod.example .env
    echo "📝 Please edit .env file with your production values"
    echo "   Especially change the database password and email!"
    exit 1
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
${COMPOSE_CMD} down --remove-orphans || true

# Pull latest images
echo "📥 Pulling latest base images..."
${COMPOSE_CMD} pull

# Build production images
echo "🔨 Building production images..."
${COMPOSE_CMD} build --no-cache

# Start services
echo "🎯 Starting production services..."
${COMPOSE_CMD} up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 10

# Show status
echo "📊 Service status:"
${COMPOSE_CMD} ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Services should be available at:"
echo "   • Frontend: https://tlg.site.example"
echo "   • Backend API: https://api-tlg.site.example"
echo ""
echo "📋 Useful commands:"
echo "   • View logs: ${COMPOSE_CMD} logs -f"
echo "   • Stop services: ${COMPOSE_CMD} down"
echo "   • Restart: ${COMPOSE_CMD} restart"
