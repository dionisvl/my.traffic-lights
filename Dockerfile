# Frontend multi-stage Dockerfile (dev + prod)

FROM node:20-alpine AS base
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
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
