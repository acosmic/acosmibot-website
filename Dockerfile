# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Azure's managed functions are bundled once, then copied into the small
# runtime image. The render function intentionally keeps resvg-wasm external.
WORKDIR /app/api
RUN npm ci && npm run build


FROM ${NODE_IMAGE} AS runtime

ARG APP_REVISION=unknown

LABEL org.opencontainers.image.title="Acosmibot website and edge adapters" \
      org.opencontainers.image.description="Isolated test/staging harness; production website remains Azure Static Web Apps" \
      org.opencontainers.image.revision="${APP_REVISION}"

ENV NODE_ENV=production \
    ACOSMIBOT_ENVIRONMENT=test \
    HOST=0.0.0.0 \
    PORT=8080 \
    NODE_OPTIONS=--disable-proto=throw

RUN apk add --no-cache tini \
    && mkdir -p /app/dist /app/runtime /app/api/render-card /app/api/status \
    && chown -R node:node /app

WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/runtime ./runtime
COPY --from=build --chown=node:node /app/cloudflare-worker ./cloudflare-worker
COPY --from=build --chown=node:node /app/api/package.json /app/api/package-lock.json ./api/
COPY --from=build --chown=node:node /app/api/render-card/index.js ./api/render-card/index.js
COPY --from=build --chown=node:node /app/api/render-card/assets ./api/render-card/assets
COPY --from=build --chown=node:node /app/api/render-card/fonts ./api/render-card/fonts
COPY --from=build --chown=node:node /app/api/status/index.js ./api/status/index.js

WORKDIR /app/api
RUN npm ci --omit=dev && npm cache clean --force

WORKDIR /app
USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "runtime/server.mjs"]
