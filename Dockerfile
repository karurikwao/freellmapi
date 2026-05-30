FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p client server shared

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json

RUN npm ci --include=dev

FROM deps AS build

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS prod-deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p client server shared

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json

RUN npm ci --omit=dev --omit=optional --workspace @freellmapi/server --workspace @freellmapi/shared \
  && npm prune --omit=dev --omit=optional --workspace @freellmapi/server --workspace @freellmapi/shared

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/data/freeapi.db

RUN mkdir -p /data && chown node:node /data

COPY --chown=node:node --from=prod-deps /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/client/package.json ./client/package.json
COPY --chown=node:node --from=build /app/client/dist ./client/dist
COPY --chown=node:node --from=build /app/server/package.json ./server/package.json
COPY --chown=node:node --from=build /app/server/dist ./server/dist
COPY --chown=node:node --from=build /app/shared ./shared

USER node

EXPOSE 3001
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/ping').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/dist/index.js"]
