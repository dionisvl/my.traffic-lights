FROM node:26.13.1-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.js ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:26.13.1-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json server.mjs ./
COPY src/lib/game/domain.ts ./src/lib/game/
COPY src/lib/game/server ./src/lib/game/server
COPY src/lib/questions/server ./src/lib/questions/server
COPY src/lib/server ./src/lib/server
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.mjs"]
