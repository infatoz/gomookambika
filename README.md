# Go Mookambika

A production-ready taxi association and cab booking platform for managing customers, drivers, vehicles, taxi stands, location-based driver queues, bookings, trip assignment, fare calculation, payments, and analytics.

## Architecture

- **3 Progressive Web Apps** (Customer, Driver, Admin) — React + Vite + TypeScript
- **Backend** — Node.js + Express + TypeScript + MongoDB + Redis + Socket.IO
- **Maps** — OpenStreetMap + Leaflet + Nominatim + OSRM (no Google Maps)
- **Monorepo** — pnpm workspaces

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Development Setup

```bash
# Install all dependencies
pnpm install

# Copy environment files
cp .env.example .env
cp apps/customer-pwa/.env.example apps/customer-pwa/.env
cp apps/driver-pwa/.env.example apps/driver-pwa/.env
cp apps/admin-pwa/.env.example apps/admin-pwa/.env
cp server/.env.example server/.env

# Start infrastructure (MongoDB + Redis)
docker compose up -d mongodb redis

# Seed development data
pnpm seed

# Start all apps in development
pnpm dev
```

### Individual App Development

```bash
pnpm dev:server    # Backend API (port 5000)
pnpm dev:customer  # Customer PWA (port 3000)
pnpm dev:driver    # Driver PWA (port 3001)
pnpm dev:admin     # Admin PWA (port 3002)
```

### Other Commands

```bash
pnpm build         # Build all apps
pnpm test          # Run all tests
pnpm lint          # Lint all packages
pnpm format        # Format all packages
pnpm seed          # Seed database with dev data
pnpm typecheck     # TypeScript check all packages
```

## Development Credentials (after seeding)

| Role | Phone | Password/OTP |
|---|---|---|
| Super Admin | N/A | admin@gomookambika.com / Admin@123 |
| Driver | +919876543210 | 123456 (dev OTP) |
| Customer | +919876543211 | 123456 (dev OTP) |

> ⚠️ Dev OTP is only active when `DEV_OTP_ENABLED=true` in `.env`. Never enable in production.

## Documentation

- [Architecture](docs/architecture.md)
- [Database Design](docs/database.md)
- [Queue System](docs/queue-system.md)
- [Fare Engine](docs/fare-engine.md)
- [API Reference](docs/api.md)
- [Maps Integration](docs/maps.md)
- [PWA Guide](docs/pwa.md)
- [Deployment](docs/deployment.md)

## Project Structure

```
go-mookambika/
├── apps/
│   ├── customer-pwa/    # Customer booking app
│   ├── driver-pwa/      # Driver queue & trip app
│   └── admin-pwa/       # Admin management dashboard
├── packages/
│   ├── ui/              # Shared component library
│   ├── types/           # Shared TypeScript types
│   ├── validation/      # Shared Zod schemas
│   ├── api-client/      # Typed API client
│   ├── config/          # Shared constants
│   └── utils/           # Shared utilities
├── server/              # Express.js API
├── docker/              # Docker configs
└── docs/                # Documentation
```

## License

Private — Go Mookambika Association
