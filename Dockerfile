# syntax=docker/dockerfile:1

# ==============================================================================
# Go Mookambika Monorepo Production Dockerfile (Optimized for Dokpoly)
# Targets:
#   - all-in-one (Default: Unified container with Subdomain Routing on Port 80)
#   - customer   (Customer PWA standalone, Port 80)
#   - driver     (Driver PWA standalone, Port 80)
#   - admin      (Admin PWA standalone, Port 80)
#   - server     (Node.js API standalone, Port 5000)
# ==============================================================================

ARG APP=all-in-one

# ------------------------------------------------------------------------------
# 1. Base Stage: Minimal Node.js 20 on Alpine with pnpm
# ------------------------------------------------------------------------------
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@9.15.4
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

# Install build tools if any native dependency requires compilation (argon2, bcrypt)
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && pnpm install --frozen-lockfile \
  && apk del .build-deps

# ------------------------------------------------------------------------------
# 3. Builder Stage: Full source code & monorepo build
# ------------------------------------------------------------------------------
FROM dependencies AS builder
COPY packages/ ./packages/
COPY server/ ./server/
COPY apps/ ./apps/
COPY tsconfig.json* ./

# Build shared packages first
RUN pnpm --filter @gomookambika/types build
RUN pnpm --filter @gomookambika/validation build

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

# 4d. Server Backend Build
FROM builder AS server-build
RUN pnpm --filter server build

# ==============================================================================
# 5. Production Targets
# ==============================================================================

# ------------------------------------------------------------------------------
# TARGET: all-in-one (DEFAULT: Single Container for Dokpoly Option 1)
# Serves Customer, Driver, Admin PWAs + Node.js API via Subdomain Routing on Port 80
# ------------------------------------------------------------------------------
FROM node:20-alpine AS all-in-one
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install Nginx and libc6-compat for compiled native modules
RUN apk add --no-cache nginx libc6-compat

# Copy Nginx configuration and entrypoint script
COPY docker/nginx-all-in-one.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Copy built frontend distributions
COPY --from=customer-build /app/apps/customer-pwa/dist /var/www/customer
COPY --from=driver-build /app/apps/driver-pwa/dist /var/www/driver
COPY --from=admin-build /app/apps/admin-pwa/dist /var/www/admin

# Copy backend server and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=server-build /app/server ./server

# Ensure upload directory exists
RUN mkdir -p /app/server/uploads /run/nginx /var/log/nginx

EXPOSE 80 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]

# ------------------------------------------------------------------------------
# TARGET: customer (Standalone Customer PWA on Port 80)
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
# TARGET: driver (Standalone Driver PWA on Port 80)
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
# TARGET: admin (Standalone Admin PWA on Port 80)
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
# TARGET: server (Standalone Node.js Server on Port 5000)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

RUN apk add --no-cache libc6-compat

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=server-build /app/server ./server

RUN mkdir -p ./server/uploads && chown -R node:node /app

USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

WORKDIR /app/server
CMD ["node", "dist/app.js"]

# ------------------------------------------------------------------------------
# DEFAULT FINAL TARGET: Defaults to all-in-one
# ------------------------------------------------------------------------------
FROM ${APP} AS final
