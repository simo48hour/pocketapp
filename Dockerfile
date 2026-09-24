# ---- production dependencies stage ----
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app

# CI-friendly env
ENV HUSKY=0
ENV CI=true

# Use pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Install only production dependencies (cached in Docker layer until package.json/lockfile changes)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts


# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

ENV HUSKY=0
ENV CI=true

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build


# ---- production stage ----
FROM node:22-bookworm-slim AS pocketapp-production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5173
ENV HOST=0.0.0.0

# Non-sensitive build arguments
ARG VITE_LOG_LEVEL=debug
ARG DEFAULT_NUM_CTX

# Set non-sensitive environment variables
ENV WRANGLER_SEND_METRICS=false \
    VITE_LOG_LEVEL=${VITE_LOG_LEVEL} \
    DEFAULT_NUM_CTX=${DEFAULT_NUM_CTX} \
    RUNNING_IN_DOCKER=true

# Install curl and ca-certificates for SSL and healthchecks, git, wrangler and pnpm
# CRITICAL: update-ca-certificates ensures the cert store is populated so workerd can
# verify TLS when calling external APIs (OpenRouter, OpenAI, Anthropic, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g wrangler@4 pnpm@9.15.9

# Point workerd / Node at the system CA bundle so outbound HTTPS works
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

# Pre-configure wrangler to disable metrics
RUN mkdir -p /root/.config/.wrangler && \
    echo '{"enabled":false}' > /root/.config/.wrangler/metrics.json

# Copy production node_modules from cached prod-deps stage
COPY --from=prod-deps /app/node_modules /app/node_modules

# Copy app files and pre-built artifacts
COPY . .
COPY --from=build /app/build /app/build

EXPOSE 5173 3000 3001

# Healthcheck for deployment platforms
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-5173}/api/health || exit 1

# Start using dockerstart script with Wrangler
CMD ["pnpm", "run", "dockerstart"]


# ---- development stage ----
FROM node:22-bookworm-slim AS development
WORKDIR /app

ENV HUSKY=0
ENV CI=true

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_LOG_LEVEL=debug
ARG DEFAULT_NUM_CTX

ENV VITE_LOG_LEVEL=${VITE_LOG_LEVEL} \
    DEFAULT_NUM_CTX=${DEFAULT_NUM_CTX} \
    RUNNING_IN_DOCKER=true

RUN mkdir -p /app/run
CMD ["pnpm", "run", "dev", "--host"]
