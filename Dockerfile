# Frontend multi-stage Dockerfile (dev + prod)

FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Dev stage ---
FROM base AS dev
WORKDIR /app
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- Build stage ---
FROM base AS build
WORKDIR /app
COPY . .
ENV NODE_ENV=production
RUN npm run nuxt:build

# --- Prod runtime ---
FROM node:24-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
COPY package.json package-lock.json ./
# npm is only needed to install; drop it so its bundled deps are not shipped
RUN npm ci --omit=dev && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
