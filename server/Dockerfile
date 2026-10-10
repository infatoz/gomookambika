# syntax=docker/dockerfile:1
# Server Backend API Dockerfile (api.example.com) - Optimized for Dokpoly
# Build Context: . (Monorepo root)

# 1. Build Stage
FROM node:20-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@9.15.4
WORKDIR /app

# Copy workspace manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY server/package.json ./server/
COPY apps/customer-pwa/package.json ./apps/customer-pwa/
COPY apps/driver-pwa/package.json ./apps/driver-pwa/
COPY apps/admin-pwa/package.json ./apps/admin-pwa/

# Install dependencies (with native toolchain for argon2 / bcrypt)
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && pnpm install --frozen-lockfile \
  && apk del .build-deps

# Copy source and build TypeScript to dist
COPY packages/ ./packages/
COPY server/ ./server/
COPY apps/ ./apps/
COPY tsconfig.json* ./

RUN pnpm --filter @gomookambika/types build
RUN pnpm --filter @gomookambika/validation build
RUN pnpm --filter server build

# 2. Production Runtime Stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

RUN apk add --no-cache libc6-compat

# Copy node_modules, shared packages, and built server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/server ./server

# Prepare uploads directory with proper permissions
RUN mkdir -p ./server/uploads && chown -R node:node /app

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

WORKDIR /app/server
CMD ["node", "dist/app.js"]
