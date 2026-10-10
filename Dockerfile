# syntax=docker/dockerfile:1

# ==============================================================================
# Go Mookambika Monorepo Production Dockerfile (Optimized for Dokpoly)
# Targets:
#   - customer  (Customer PWA, default domain: example.com)
#   - driver    (Driver / Captain PWA, default domain: captain.example.com)
#   - admin     (Admin Portal PWA, default domain: admin.example.com)
#   - server    (Node.js Express + Socket.IO API Server, default domain: api.example.com)
# ==============================================================================

ARG APP=server

# ------------------------------------------------------------------------------
# 1. Base Stage: Minimal Node.js 20 on Alpine with pnpm
# ------------------------------------------------------------------------------
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# ------------------------------------------------------------------------------
# 2. Dependencies Stage: Cached layer for node_modules
# ------------------------------------------------------------------------------
FROM base AS dependencies
# Copy workspace definitions and package.json manifests only (for Docker layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY server/package.json ./server/
COPY apps/customer-pwa/package.json ./apps/customer-pwa/
COPY apps/driver-pwa/package.json ./apps/driver-pwa/
COPY apps/admin-pwa/package.json ./apps/admin-pwa/

# Install build tools if any native dependency requires compilation
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && pnpm install --frozen-lockfile \
  && apk del .build-deps

# ------------------------------------------------------------------------------
# 3. Builder Stage: Full source code & shared packages build
# ------------------------------------------------------------------------------
FROM dependencies AS builder
COPY packages/ ./packages/
COPY server/ ./server/
COPY apps/ ./apps/
COPY tsconfig.json* ./

# ------------------------------------------------------------------------------
# 4. App-Specific Builds
# ------------------------------------------------------------------------------

# 4a. Customer PWA Build (Vite)
FROM builder AS customer-build
ARG VITE_API_BASE_URL=""
ARG VITE_SOCKET_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN pnpm --filter customer-pwa build

# 4b. Driver PWA Build (Vite)
FROM builder AS driver-build
ARG VITE_API_BASE_URL=""
ARG VITE_SOCKET_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN pnpm --filter driver-pwa build

# 4c. Admin PWA Build (Vite)
FROM builder AS admin-build
ARG VITE_API_BASE_URL=""
ARG VITE_SOCKET_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN pnpm --filter admin-pwa build

# 4d. Server Backend Build (TypeScript -> dist)
FROM builder AS server-build
RUN pnpm --filter server build

# ==============================================================================
# 5. Production Images
# ==============================================================================

# ------------------------------------------------------------------------------
# TARGET: customer (Serves on Port 80 for example.com)
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS customer
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=customer-build /app/apps/customer-pwa/dist /usr/share/nginx/html
ENV BACKEND_URL="http://server:5000"
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]

# ------------------------------------------------------------------------------
# TARGET: driver (Serves on Port 80 for captain.example.com)
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS driver
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=driver-build /app/apps/driver-pwa/dist /usr/share/nginx/html
ENV BACKEND_URL="http://server:5000"
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]

# ------------------------------------------------------------------------------
# TARGET: admin (Serves on Port 80 for admin.example.com)
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS admin
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=admin-build /app/apps/admin-pwa/dist /usr/share/nginx/html
ENV BACKEND_URL="http://server:5000"
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]

# ------------------------------------------------------------------------------
# TARGET: server (Node.js API Server on Port 5000 for api.example.com)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace setup & shared packages needed by server
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types ./packages/types
COPY packages/validation ./packages/validation
COPY server/package.json ./server/

# Install only production dependencies
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && pnpm install --prod --frozen-lockfile \
  && apk del .build-deps

# Copy compiled server distribution files
COPY --from=server-build /app/server/dist ./server/dist

# Prepare uploads directory with proper permissions
RUN mkdir -p ./server/uploads && chown -R node:node /app

USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

WORKDIR /app/server
CMD ["node", "dist/app.js"]

# ------------------------------------------------------------------------------
# DEFAULT FINAL TARGET: Selected via --build-arg APP=<customer|driver|admin|server>
# (Defaults to server if no build-arg or target is passed)
# ------------------------------------------------------------------------------
FROM ${APP} AS final
