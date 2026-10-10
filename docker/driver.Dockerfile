# syntax=docker/dockerfile:1
# Driver PWA Dockerfile (captain.example.com) - Optimized for Dokpoly
# Build Context: . (Monorepo root)

FROM node:20-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@9.15.4
WORKDIR /app

# 1. Install dependencies with caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY server/package.json ./server/
COPY apps/customer-pwa/package.json ./apps/customer-pwa/
COPY apps/driver-pwa/package.json ./apps/driver-pwa/
COPY apps/admin-pwa/package.json ./apps/admin-pwa/

RUN pnpm install --frozen-lockfile

# 2. Copy source and build
COPY packages/ ./packages/
COPY apps/driver-pwa/ ./apps/driver-pwa/
COPY tsconfig.json* ./

RUN pnpm --filter @gomookambika/types build
RUN pnpm --filter @gomookambika/validation build

ARG VITE_API_BASE_URL=""
ARG VITE_SOCKET_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN pnpm --filter driver-pwa build

# 3. Production Nginx Server
FROM nginx:1.27-alpine
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/apps/driver-pwa/dist /usr/share/nginx/html
ENV BACKEND_URL="http://server:5000"
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
