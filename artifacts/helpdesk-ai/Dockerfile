# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f artifacts/helpdesk-ai/Dockerfile .

ARG NODE_VERSION=22
ARG PNPM_VERSION=11.25.0

# ---- build: compile the React app into static files -------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS build
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store
# vite.config.ts requires these two variables even for a production build.
ENV PORT=80 BASE_PATH=/
RUN pnpm --filter @workspace/helpdesk-ai run build

# ---- runtime: nginx serves the files and forwards /api to the API -----------
FROM nginx:1.27-alpine AS runtime
# Any *.template file here is filled with environment variables at startup.
ENV API_UPSTREAM=http://api:3001
COPY artifacts/helpdesk-ai/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/artifacts/helpdesk-ai/dist/public /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
