# setup-docker.ps1 - writes the Docker files for HelpDeskAI. Run from the project root.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'pnpm-workspace.yaml')) { throw 'Run this from the project root (the folder that contains pnpm-workspace.yaml).' }

function W($rel, $text) {
  $full = Join-Path (Get-Location).Path $rel
  $dir = Split-Path $full
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $body = ($text -replace "`r`n", "`n") + "`n"
  [System.IO.File]::WriteAllText($full, $body, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "wrote $rel"
}

W '.dockerignore' @'
# Keep secrets, dependencies and build output out of every Docker build.
**/node_modules
**/dist
**/*.tsbuildinfo
**/.env
**/.env.*
!**/.env.example
.git
.github
.vscode
.cache
.local
**/*.log
*.zip
'@

W 'docker-compose.yml' @'
name: helpdeskai

# One-off jobs (schema push, demo seed) reuse the "tools" image, which holds the
# whole workspace with dev dependencies.
x-tools: &tools
  build:
    context: .
    dockerfile: artifacts/api-server/Dockerfile
    target: tools
  image: helpdeskai-tools

x-database-url: &database-url postgresql://${POSTGRES_USER:-helpdesk}:${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}@postgres:5432/${POSTGRES_DB:-helpdesk}

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-helpdesk}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: ${POSTGRES_DB:-helpdesk}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5433}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  # Creates or updates the tables, then exits. Safe to run on every start.
  db-setup:
    <<: *tools
    command: pnpm --dir lib/db run push
    environment:
      DATABASE_URL: *database-url
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  api:
    build:
      context: .
      dockerfile: artifacts/api-server/Dockerfile
      target: runtime
    image: helpdeskai-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: "3001"
      DATABASE_URL: *database-url
      SESSION_SECRET: ${SESSION_SECRET:?Set SESSION_SECRET in .env (32+ characters)}
      CORS_ORIGIN: http://localhost:${WEB_PORT:-8080}
      TRUST_PROXY: "1"
      COOKIE_SECURE: ${COOKIE_SECURE:-false}
      LOG_LEVEL: info
    depends_on:
      db-setup:
        condition: service_completed_successfully
    expose:
      - "3001"

  web:
    build:
      context: .
      dockerfile: artifacts/helpdesk-ai/Dockerfile
    image: helpdeskai-web
    restart: unless-stopped
    ports:
      - "${WEB_PORT:-8080}:80"
    depends_on:
      api:
        condition: service_healthy

  # Optional demo data (never runs on a normal "up"):
  #   docker compose --profile seed run --rm seed
  seed:
    <<: *tools
    profiles: ["seed"]
    command: pnpm --dir artifacts/api-server run seed
    environment:
      NODE_ENV: development
      DATABASE_URL: *database-url
      DEMO_PASSWORD: ${DEMO_PASSWORD:-HelpdeskDemo26!}
    depends_on:
      db-setup:
        condition: service_completed_successfully

volumes:
  pgdata:
'@

W '.env.example' @'
# Copy to .env next to docker-compose.yml and fill in the blanks. Never commit .env.
# Docker Compose reads this file automatically.

POSTGRES_USER=helpdesk
POSTGRES_DB=helpdesk
# Letters and digits only (it is placed inside a connection URL).
# PowerShell: -join (1..32 | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
POSTGRES_PASSWORD=
# Host port for inspecting the database (127.0.0.1 only). 5433 avoids clashing
# with a Postgres you may already run on 5432.
POSTGRES_PORT=5433

# 32+ characters, used to sign login sessions. Generate it the same way as above
# with (1..64 ...) for a longer value.
SESSION_SECRET=

# The website is served at http://localhost:<WEB_PORT>
WEB_PORT=8080
# Keep false for http://localhost. Set true once the site is served over HTTPS.
COOKIE_SECURE=false

# Password for the demo accounts created by the optional seed step.
DEMO_PASSWORD=HelpdeskDemo26!
'@

W 'artifacts\api-server\Dockerfile' @'
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
'@

W 'artifacts\api-server\.env.example' @'
# Copy to .env and fill in real values. Never commit .env.
# Used when you run the API directly with pnpm. Docker Compose uses the .env
# in the repository root instead.
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
# 32+ characters; the API refuses to start without it.
SESSION_SECRET=
PORT=3001
# Frontend origin(s), comma-separated.
CORS_ORIGIN=http://localhost:5173
# error | warn | info | debug
LOG_LEVEL=info
# Number of reverse-proxy hops in front of the API (e.g. 1 behind nginx or an
# AWS load balancer). Leave unset when the API is reached directly.
# Do not set to "true": clients could spoof their IP and dodge rate limits.
# TRUST_PROXY=1
# Defaults to true when NODE_ENV=production. Set false only to test the
# production build over plain HTTP; keep true whenever the site uses HTTPS.
# COOKIE_SECURE=false
'@

W 'artifacts\helpdesk-ai\Dockerfile' @'
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
'@

W 'artifacts\helpdesk-ai\nginx.conf.template' @'
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_min_length 1024;
  gzip_types text/css application/javascript application/json image/svg+xml;

  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # Docker's built-in DNS. Resolving at request time means nginx keeps working
  # if the API container is restarted and gets a new address.
  resolver 127.0.0.11 valid=10s;

  # API calls go to the API container, so the browser only ever talks to one origin.
  location /api/ {
    set $api_upstream ${API_UPSTREAM};
    proxy_pass $api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Vite gives built files unique names, so they can be cached for a year.
  location /assets/ {
    expires 1y;
    try_files $uri =404;
  }

  # Everything else is the single-page app: unknown paths fall back to index.html.
  location / {
    expires -1;
    try_files $uri /index.html;
  }
}
'@

W 'artifacts\helpdesk-ai\.env.example' @'
# The frontend has no secrets. vite.config.ts reads these from the shell
# (process.env), so set them in your terminal, e.g. in PowerShell:
#   $env:PORT="5173"; $env:BASE_PATH="/"
# Docker sets them for you inside artifacts/helpdesk-ai/Dockerfile.

# Port the Vite dev server listens on.
PORT=5173
# URL path the app is served from ("/" unless hosted under a sub-path).
BASE_PATH=/
'@

# --- patch auth.ts: allow COOKIE_SECURE to override the cookie "secure" flag ---
$auth = Join-Path (Get-Location).Path 'artifacts\api-server\src\middlewares\auth.ts'
$src = [System.IO.File]::ReadAllText($auth)
$old = 'secure: process.env.NODE_ENV === "production",'
if ($src.Contains('COOKIE_SECURE')) {
  Write-Host 'auth.ts already patched'
} elseif (-not $src.Contains($old)) {
  Write-Warning 'auth.ts: expected line not found. Edit it by hand (see the Step 2 instructions).'
} else {
  $new = @'
// Secure cookies are only sent over HTTPS. Defaults to on in production;
    // set COOKIE_SECURE=false to run the production build over plain HTTP locally.
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
'@
  $new = $new.TrimEnd("`r", "`n")
  [System.IO.File]::WriteAllText($auth, $src.Replace($old, $new), (New-Object System.Text.UTF8Encoding($false)))
  Write-Host 'patched auth.ts'
}

# --- create .env with random secrets (only if it does not exist yet) ---
if (-not (Test-Path '.env')) {
  $pw  = -join (1..32 | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  $sec = -join (1..64 | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  $envText = [System.IO.File]::ReadAllText((Join-Path (Get-Location).Path '.env.example'))
  $envText = $envText -replace '(?m)^POSTGRES_PASSWORD=.*', "POSTGRES_PASSWORD=$pw"
  $envText = $envText -replace '(?m)^SESSION_SECRET=.*', "SESSION_SECRET=$sec"
  W '.env' $envText.TrimEnd()
} else {
  Write-Host '.env already exists, left unchanged'
}

Write-Host ''
Write-Host 'File sizes (none should be 0):'
'.dockerignore','docker-compose.yml','.env.example','.env','artifacts\api-server\Dockerfile','artifacts\api-server\.env.example','artifacts\helpdesk-ai\Dockerfile','artifacts\helpdesk-ai\nginx.conf.template','artifacts\helpdesk-ai\.env.example' | ForEach-Object { '{0,-45} {1}' -f $_, (Get-Item $_).Length }