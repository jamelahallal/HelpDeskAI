# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f artifacts/api-server/Dockerfile .

ARG NODE_VERSION=22
ARG PNPM_VERSION=11.25.0

# ---- base: Node + pnpm -------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---- tools: the whole workspace with dev dependencies -----------------------
# Used to build the API and by one-off jobs (database schema push, demo seed).
FROM base AS tools
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store

# ---- build: bundle the API into a single dist/ folder -----------------------
FROM tools AS build
RUN pnpm --filter @workspace/api-server run build

# ---- runtime: only the bundled output, running as a non-root user -----------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /app/artifacts/api-server/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
