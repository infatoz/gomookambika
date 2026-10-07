# Go Mookambika — System Architecture

## Overview

Go Mookambika is a production-grade taxi association and cab booking platform built as a monorepo containing three Progressive Web Applications (PWAs) and a Node.js/Express backend.

---

## High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                         Client Layer                               │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  Customer PWA   │  │   Driver PWA     │  │   Admin PWA     │  │
│  │  (React/Vite)   │  │  (React/Vite)    │  │  (React/Vite)   │  │
│  │  Mobile-first   │  │  Mobile-first    │  │  Desktop-first  │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼─────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer                     │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                  ┌─────────────┴──────────────┐
                  │                            │
                  ▼                            ▼
        ┌─────────────────┐       ┌─────────────────────┐
        │  REST API        │       │   Socket.IO Server  │
        │  Express/Node.js │       │   (Real-time)       │
        │  /api/v1/...     │       │                     │
        └────────┬─────────┘       └──────────┬──────────┘
                 │                             │
        ┌────────┴─────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Service Layer                              │
│                                                                  │
│  FareService │ QueueService │ DispatchService │ BookingService   │
│  TripService │ PaymentService │ NotificationService              │
│  LocationService │ QRService │ AuthService                       │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
        ┌────────────────────────┼─────────────────────┐
        │                        │                     │
        ▼                        ▼                     ▼
┌──────────────┐       ┌──────────────────┐   ┌──────────────────┐
│   MongoDB    │       │     Redis        │   │ External Providers│
│  (Primary DB)│       │ (Cache/Sessions/ │   │ OTP / Payment /  │
│              │       │  Queue/PubSub)   │   │ FCM / Storage    │
└──────────────┘       └──────────────────┘   └──────────────────┘
```

---

## Monorepo Structure

```
go-mookambika/
│
├── apps/
│   ├── customer-pwa/
│   ├── driver-pwa/
│   └── admin-pwa/
│
├── packages/
│   ├── ui/
│   ├── types/
│   ├── validation/
│   ├── api-client/
│   ├── config/
│   └── utils/
│
├── server/
│   ├── src/
│   └── tests/
│
├── docker/
├── docs/
├── .env.example
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

---

## Backend Architecture (Layered)

```
HTTP Request
     │
     ▼
Middleware Stack
(helmet, cors, rate-limit, auth, validate)
     │
     ▼
Controller (thin — orchestrates only)
     │
     ▼
Service (business logic, domain rules)
     │
     ├──► Repository (data access, MongoDB queries)
     ├──► Other Services (cross-domain calls)
     └──► Providers (external APIs)
```

---

## Security Architecture

- JWT Access Token (15min) + Refresh Token (7 days, rotated)
- OTP: Phone-based, 6-digit, 5-min expiry, 3-attempt limit, 60s resend cooldown
- RBAC: Role + Permission based, middleware-enforced
- Rate Limiting: Per-IP and per-user, configurable windows
- Input Validation: Zod on both frontend and backend
- Backend is authoritative for all business values

---

## Socket Rooms

| Room | Members | Purpose |
|---|---|---|
| `driver:{driverId}` | Driver | Private messages to driver |
| `customer:{customerId}` | Customer | Private messages to customer |
| `trip:{tripId}` | Driver + Customer | Live trip tracking |
| `queue:{queueId}` | Admin + Drivers | Queue status updates |
| `admin:operations` | Admin users | Live ops dashboard |

---

## Provider Abstractions

All external dependencies abstracted behind interfaces:
- OTPProvider
- PaymentProvider
- MapProvider (geocode, reverseGeocode, route, calculateDistance, searchPlaces)
- NotificationProvider
- StorageProvider
