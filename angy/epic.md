# EPIC: NexusFleet — Real-Time Multi-Tenant Fleet Management Platform

> **Purpose**: This epic defines a full-stack application designed to benchmark LLM code generation agents (Cursor, Claude Code, Angy). It is intentionally scoped to sit just beyond what current LLMs can reliably produce in a single pass — the core systems are interconnected so that cutting corners on one subsystem cascades failures into others, but the overall surface area is manageable. The application demands correct handling of real-time state synchronization, a multi-step state machine with transactional side effects, multi-tenant authorization, geospatial queries, and interactive UI components.

> **Benchmarking Note**: A successful implementation means: `docker compose up`, seed data loads, a user can log in, see vehicles on a live map, create a shipment, run it through the full lifecycle (draft → delivered), plan a route with drag-and-drop, and see real-time alerts — all working together without manual fixes.

---

## Table of Contents

1. [Tech Stack & Infrastructure](#1-tech-stack--infrastructure)
2. [Data Model & Database Schema](#2-data-model--database-schema)
3. [Authentication & Multi-Tenant Authorization](#3-authentication--multi-tenant-authorization)
4. [Real-Time Vehicle Tracking Subsystem](#4-real-time-vehicle-tracking-subsystem)
5. [Shipment Lifecycle State Machine](#5-shipment-lifecycle-state-machine)
6. [Route Planning & Optimization](#6-route-planning--optimization)
7. [Driver Management & Geofencing](#7-driver-management--geofencing)
8. [Frontend Application (Vue 3)](#8-frontend-application-vue-3)
9. [API Design & Contracts](#9-api-design--contracts)
10. [Background Job Processing](#10-background-job-processing)
11. [Docker Compose & Infrastructure](#11-docker-compose--infrastructure)
12. [Testing Requirements](#12-testing-requirements)
13. [Non-Functional Requirements](#13-non-functional-requirements)

---

## 1. Tech Stack & Infrastructure

### Mandatory Stack

| Layer | Technology | Version Constraint |
|---|---|---|
| Frontend | Vue 3 (Composition API + `<script setup>`) | ^3.4 |
| State Management | Pinia | ^2.1 |
| CSS Framework | Tailwind CSS | ^3.4 |
| Map Library | Leaflet via `@vue-leaflet/vue-leaflet` | latest |
| Charts | Chart.js via `vue-chartjs` | latest |
| Drag & Drop | `vuedraggable` (SortableJS wrapper) | ^4.1 |
| HTTP Client | Axios with interceptors | ^1.6 |
| WebSocket Client | Native WebSocket with custom reconnection logic (NO socket.io-client) | — |
| Form Validation | VeeValidate + Zod schemas (shared with backend) | ^4.12 / ^3.22 |
| Backend Runtime | Node.js | ^22.x |
| Backend Framework | Fastify | ^5.x |
| ORM | Drizzle ORM | latest |
| Database | PostgreSQL + PostGIS extension | 16 |
| Cache / PubSub | Redis | 7.x |
| Background Jobs | BullMQ | ^5.x |
| WebSocket Server | `@fastify/websocket` (raw ws, NOT socket.io) | latest |
| Authentication | Custom JWT (access + refresh tokens) | — |
| Validation | Zod (shared schemas between frontend & backend) | ^3.22 |
| Monorepo | npm workspaces | — |
| Containerization | Docker Compose | v3.8+ |

### Project Structure (npm workspaces monorepo)

```
nexus-fleet/
├── docker-compose.yml
├── package.json                    # workspace root
├── packages/
│   ├── shared/                     # shared Zod schemas, types, constants
│   │   ├── package.json
│   │   └── src/
│   │       ├── schemas/            # Zod schemas used by both FE and BE
│   │       ├── types/              # TypeScript type exports
│   │       ├── constants/          # Shipment states, role definitions, etc.
│   │       └── utils/              # Pure utility functions (haversine, etc.)
│   ├── backend/
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── drizzle.config.ts
│   │   ├── drizzle/               # migrations
│   │   └── src/
│   │       ├── server.ts           # Fastify bootstrap
│   │       ├── plugins/            # Fastify plugins (auth, tenancy, ws)
│   │       ├── routes/             # Route modules
│   │       ├── services/           # Business logic layer
│   │       ├── jobs/               # BullMQ job processors
│   │       ├── db/
│   │       │   ├── schema.ts       # Drizzle schema definitions
│   │       │   ├── connection.ts   # DB pool setup
│   │       │   └── seed.ts         # Seeding script
│   │       ├── ws/                 # WebSocket handlers
│   │       └── middleware/         # Request hooks
│   └── frontend/
│       ├── package.json
│       ├── Dockerfile
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── index.html
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── router/
│           ├── stores/             # Pinia stores
│           ├── composables/        # Vue composables
│           ├── components/
│           │   ├── common/         # Reusable UI primitives
│           │   ├── map/            # Map-related components
│           │   ├── shipments/
│           │   ├── vehicles/
│           │   ├── drivers/
│           │   ├── routes/
│           │   └── analytics/
│           ├── views/              # Page-level components
│           ├── layouts/
│           └── types/
└── scripts/
    ├── seed.sh
    └── wait-for-it.sh
```

> **CONSTRAINT**: The `packages/shared` module MUST be the single source of truth for all Zod validation schemas. The backend MUST use these schemas for request validation. The frontend MUST use the same schemas for form validation via VeeValidate. Any schema defined outside `shared/` is a violation.

---

## 2. Data Model & Database Schema

### Entity-Relationship Overview

The database uses PostgreSQL 16 with the PostGIS extension for geospatial operations. Tenant isolation is enforced at the application layer via `tenant_id` foreign keys on every tenant-scoped table. All schema is defined using Drizzle ORM in `packages/backend/src/db/schema.ts`.

### Complete Table Definitions

#### `tenants`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            VARCHAR(255) NOT NULL
slug            VARCHAR(100) NOT NULL UNIQUE
plan            VARCHAR(50) NOT NULL DEFAULT 'free'  -- 'free' | 'pro' | 'enterprise'
settings        JSONB NOT NULL DEFAULT '{}'
max_vehicles    INTEGER NOT NULL DEFAULT 10
max_drivers     INTEGER NOT NULL DEFAULT 20
webhook_secret  VARCHAR(255)
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `users`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
email           VARCHAR(255) NOT NULL
password_hash   VARCHAR(255) NOT NULL          -- bcrypt, cost factor 12
role            VARCHAR(50) NOT NULL           -- 'owner' | 'admin' | 'dispatcher' | 'viewer'
first_name      VARCHAR(100) NOT NULL
last_name       VARCHAR(100) NOT NULL
is_active       BOOLEAN NOT NULL DEFAULT true
last_login_at   TIMESTAMPTZ
refresh_token   VARCHAR(500)                   -- hashed refresh token
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(tenant_id, email)
INDEX idx_users_tenant ON (tenant_id) WHERE is_active = true
```

#### `vehicles`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
registration    VARCHAR(50) NOT NULL
vin             VARCHAR(17) NOT NULL           -- exactly 17 chars, validated
make            VARCHAR(100) NOT NULL
model           VARCHAR(100) NOT NULL
year            INTEGER NOT NULL CHECK (year >= 1990 AND year <= 2030)
type            VARCHAR(50) NOT NULL           -- 'van' | 'truck' | 'semi' | 'refrigerated'
capacity_kg     NUMERIC(10,2) NOT NULL CHECK (capacity_kg > 0)
capacity_m3     NUMERIC(10,2) NOT NULL CHECK (capacity_m3 > 0)
status          VARCHAR(30) NOT NULL DEFAULT 'available'
last_location   GEOMETRY(Point, 4326)          -- PostGIS point
last_location_at TIMESTAMPTZ
last_speed_kmh  NUMERIC(6,2)
heading         NUMERIC(5,2)
assigned_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL
is_active       BOOLEAN NOT NULL DEFAULT true
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(tenant_id, registration)
UNIQUE(tenant_id, vin)
INDEX idx_vehicles_location ON USING GIST (last_location)
INDEX idx_vehicles_status ON (tenant_id, status) WHERE is_active = true
```

**Vehicle Status Enum**: `available` | `in_transit` | `idle` | `maintenance` | `decommissioned`

> **CONSTRAINT**: The `last_location` update MUST happen through the real-time tracking pipeline only (via WebSocket ingestion → Redis pub/sub → periodic DB flush). Direct SQL updates to `last_location` outside this pipeline are forbidden. The DB flush runs every 5 seconds as a background job.

#### `drivers`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
employee_id     VARCHAR(50) NOT NULL
first_name      VARCHAR(100) NOT NULL
last_name       VARCHAR(100) NOT NULL
phone           VARCHAR(50) NOT NULL
license_number  VARCHAR(100) NOT NULL
license_expiry  DATE NOT NULL
license_classes VARCHAR(10)[] NOT NULL         -- e.g. ['B', 'C', 'CE']
status          VARCHAR(30) NOT NULL DEFAULT 'off_duty'
current_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL
max_driving_hours_day NUMERIC(4,1) NOT NULL DEFAULT 9.0
current_driving_hours NUMERIC(4,1) NOT NULL DEFAULT 0.0
is_active       BOOLEAN NOT NULL DEFAULT true
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(tenant_id, employee_id)
UNIQUE(tenant_id, license_number)
INDEX idx_drivers_status ON (tenant_id, status) WHERE is_active = true
```

**Driver Status Enum**: `off_duty` | `available` | `driving` | `on_break`

> **CONSTRAINT**: When `status` transitions to `driving`, the system MUST check `current_driving_hours < max_driving_hours_day`. If exceeded, the transition MUST be rejected with a 409 Conflict. A nightly cron job resets `current_driving_hours` to 0 at midnight UTC.

#### `shipments`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
reference_code  VARCHAR(50) NOT NULL           -- SHP-{YYYYMMDD}-{seq}
status          VARCHAR(30) NOT NULL DEFAULT 'draft'
priority        VARCHAR(20) NOT NULL DEFAULT 'normal'  -- 'low' | 'normal' | 'high' | 'critical'
customer_name   VARCHAR(255) NOT NULL

-- Origin
origin_address  TEXT NOT NULL
origin_location GEOMETRY(Point, 4326) NOT NULL

-- Destination
dest_address    TEXT NOT NULL
dest_location   GEOMETRY(Point, 4326) NOT NULL

-- Cargo
cargo_description TEXT NOT NULL
cargo_weight_kg NUMERIC(10,2) NOT NULL CHECK (cargo_weight_kg > 0)
cargo_volume_m3 NUMERIC(10,2) NOT NULL CHECK (cargo_volume_m3 > 0)
cargo_type      VARCHAR(50) NOT NULL           -- 'general' | 'fragile' | 'hazardous' | 'perishable'
requires_temp_control BOOLEAN NOT NULL DEFAULT false
temp_min_c      NUMERIC(5,1)
temp_max_c      NUMERIC(5,1)

-- Assignment
assigned_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL
assigned_driver_id  UUID REFERENCES drivers(id) ON DELETE SET NULL
assigned_route_id   UUID REFERENCES routes(id) ON DELETE SET NULL

-- Scheduling
scheduled_pickup_at  TIMESTAMPTZ
actual_pickup_at     TIMESTAMPTZ
actual_delivery_at   TIMESTAMPTZ
estimated_arrival_at TIMESTAMPTZ

-- Proof of delivery
pod_signature_url VARCHAR(500)
pod_photo_urls   TEXT[]
pod_notes        TEXT

-- Metadata
failure_reason  TEXT
cancellation_reason TEXT
created_by      UUID NOT NULL REFERENCES users(id)
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(tenant_id, reference_code)
INDEX idx_shipments_status ON (tenant_id, status)
INDEX idx_shipments_origin ON USING GIST (origin_location)
INDEX idx_shipments_dest ON USING GIST (dest_location)
CHECK (NOT requires_temp_control OR (temp_min_c IS NOT NULL AND temp_max_c IS NOT NULL AND temp_min_c < temp_max_c))
```

#### `shipment_events`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
shipment_id     UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
event_type      VARCHAR(50) NOT NULL
from_status     VARCHAR(30)
to_status       VARCHAR(30)
location        GEOMETRY(Point, 4326)
notes           TEXT
metadata        JSONB NOT NULL DEFAULT '{}'
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

INDEX idx_shipment_events_shipment ON (shipment_id, created_at DESC)
```

> **CONSTRAINT**: Every state transition in the shipment state machine MUST generate a corresponding `shipment_events` record within the same database transaction. This is the audit trail — it must never be skipped.

#### `routes`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
name            VARCHAR(255) NOT NULL
status          VARCHAR(30) NOT NULL DEFAULT 'draft'  -- 'draft' | 'optimized' | 'active' | 'completed'
vehicle_id      UUID REFERENCES vehicles(id) ON DELETE SET NULL
driver_id       UUID REFERENCES drivers(id) ON DELETE SET NULL
planned_date    DATE NOT NULL
estimated_distance_km NUMERIC(10,2)
optimization_score NUMERIC(5,2)
polyline        GEOMETRY(LineString, 4326)
created_by      UUID NOT NULL REFERENCES users(id)
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

INDEX idx_routes_date ON (tenant_id, planned_date, status)
```

#### `route_stops`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
route_id        UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE
shipment_id     UUID REFERENCES shipments(id) ON DELETE SET NULL
stop_type       VARCHAR(20) NOT NULL           -- 'pickup' | 'delivery' | 'depot'
sequence_order  INTEGER NOT NULL
location        GEOMETRY(Point, 4326) NOT NULL
address         TEXT NOT NULL
planned_arrival TIMESTAMPTZ
actual_arrival  TIMESTAMPTZ
status          VARCHAR(20) NOT NULL DEFAULT 'pending'  -- 'pending' | 'arrived' | 'completed' | 'skipped'
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(route_id, sequence_order)
```

> **CONSTRAINT**: When a `route_stop` with `stop_type = 'delivery'` transitions to `completed`, the linked shipment MUST automatically transition to `delivered`. This cross-entity state synchronization must be atomic (same DB transaction).

#### `geofences`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
name            VARCHAR(255) NOT NULL
center          GEOMETRY(Point, 4326) NOT NULL
radius_m        NUMERIC(10,2) NOT NULL
geometry        GEOMETRY(Geometry, 4326) NOT NULL  -- buffered circle
color           VARCHAR(7) NOT NULL DEFAULT '#3B82F6'
trigger_on_enter BOOLEAN NOT NULL DEFAULT true
trigger_on_exit  BOOLEAN NOT NULL DEFAULT true
is_active       BOOLEAN NOT NULL DEFAULT true
created_by      UUID NOT NULL REFERENCES users(id)
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

INDEX idx_geofences_geometry ON USING GIST (geometry)
INDEX idx_geofences_tenant ON (tenant_id) WHERE is_active = true
```

#### `geofence_events`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
geofence_id     UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE
vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
event_type      VARCHAR(20) NOT NULL           -- 'enter' | 'exit'
location        GEOMETRY(Point, 4326) NOT NULL
triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now()
acknowledged_at TIMESTAMPTZ
acknowledged_by UUID REFERENCES users(id)

INDEX idx_geofence_events_fence ON (geofence_id, triggered_at DESC)
```

#### `notifications`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
type            VARCHAR(50) NOT NULL
title           VARCHAR(255) NOT NULL
body            TEXT NOT NULL
data            JSONB NOT NULL DEFAULT '{}'
read_at         TIMESTAMPTZ
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

INDEX idx_notifications_user ON (user_id, read_at NULLS FIRST, created_at DESC)
```

#### `webhook_endpoints`
```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
url             VARCHAR(2000) NOT NULL
events          VARCHAR(100)[] NOT NULL
is_active       BOOLEAN NOT NULL DEFAULT true
secret          VARCHAR(255) NOT NULL
failure_count   INTEGER NOT NULL DEFAULT 0
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

## 3. Authentication & Multi-Tenant Authorization

### JWT Token Strategy

- **Access Token**: Short-lived (15 minutes). Contains `{ sub: userId, tid: tenantId, role: string }`. Signed with RS256 using a 2048-bit RSA key pair.
- **Refresh Token**: Long-lived (7 days). Opaque token stored as bcrypt hash in `users.refresh_token`. Rotation on every use (old token invalidated, new one issued).
- **Token Refresh Flow**: When the access token expires, the frontend Axios interceptor MUST automatically attempt a refresh using the refresh token (stored in an httpOnly cookie). If refresh fails, redirect to login. During refresh, all pending requests must be queued and replayed after the new token is obtained (no duplicate requests, no dropped requests).

### Role-Based Access Control

```
owner:      Full access. Can manage users, settings, billing.
admin:      Full operational access. Cannot manage billing or delete tenant.
dispatcher: Can manage shipments, routes, view vehicles/drivers. Cannot manage users.
viewer:     Read-only access to everything except user management and settings.
```

### Tenant Isolation

- Every API request MUST include the tenant context derived from the JWT `tid` claim, NOT from URL parameters.
- Every database query for tenant-scoped resources MUST include `WHERE tenant_id = :tenantId`. Zero exceptions.
- A Fastify `onRequest` hook must extract the tenant from the JWT and attach it to the request object. Routes that don't require auth (login, register, health) must be explicitly allowlisted.

### Rate Limiting

- Redis-backed sliding window rate limiter.
- Limits per tenant: 100 req/s for `free`, 500 req/s for `pro`, 2000 req/s for `enterprise`.
- WebSocket connections limited to: 5 for `free`, 20 for `pro`, 100 for `enterprise`.
- Rate limit headers in every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

## 4. Real-Time Vehicle Tracking Subsystem

This is the most performance-critical subsystem. It handles ingestion of GPS telemetry, fan-out to subscribed dashboard clients, geofence checking, and persistent storage.

### Architecture

```
Vehicle GPS Device
    │
    ▼
[WebSocket Ingestion Endpoint]   ← authenticated per-vehicle WS connection
    │
    ▼
[Redis PUBLISH to channel: "tracking:{tenantId}"]
    │
    ├──▶ [WebSocket Fan-Out Service] ──▶ Connected dashboard clients
    │
    ├──▶ [Geofence Checker] ──▶ Geofence events + notifications
    │
    └──▶ [Location Buffer] ──▶ Batch UPDATE vehicles.last_location (every 5s)
```

### WebSocket Ingestion Protocol

Vehicles connect to `wss://api.nexusfleet.local/ws/tracking` with a vehicle-specific auth token.

**Inbound message format (vehicle → server):**
```json
{
  "type": "location_update",
  "data": {
    "lat": 40.7128,
    "lng": -74.0060,
    "speed_kmh": 65.5,
    "heading": 180.0,
    "timestamp": "2026-03-10T14:30:00Z"
  }
}
```

**Validation Rules:**
- `lat` must be between -90 and 90.
- `lng` must be between -180 and 180.
- `speed_kmh` must be >= 0 and <= 300.
- `heading` must be >= 0 and < 360.
- `timestamp` must not be in the future (30-second tolerance) and not older than 5 minutes.
- Messages faster than 1 per second per vehicle MUST be throttled (drop excess, keep latest).

### Dashboard WebSocket Protocol

Dashboard clients connect to `wss://api.nexusfleet.local/ws/dashboard` with their user JWT.

**Subscription message (client → server):**
```json
{
  "type": "subscribe",
  "channels": ["tracking", "shipment_updates", "alerts"]
}
```

**Location broadcast (server → client):**
```json
{
  "type": "vehicle_location",
  "data": {
    "vehicle_id": "uuid",
    "lat": 40.7128,
    "lng": -74.0060,
    "speed_kmh": 65.5,
    "heading": 180.0,
    "timestamp": "2026-03-10T14:30:00Z"
  }
}
```

> **CONSTRAINT**: The dashboard WebSocket MUST support selective subscription. A client subscribed only to `shipment_updates` must NOT receive `tracking` messages. The server must maintain a per-connection subscription set in memory (`Map<connectionId, Set<channel>>`).

### Redis Location Buffer

- Each vehicle's latest location is stored in Redis as a hash: `vehicle_location:{vehicleId}`.
- A sorted set `dirty_vehicles:{tenantId}` tracks vehicles with unsaved location updates (score = timestamp).
- The flush job (BullMQ repeatable, every 5 seconds) reads all dirty vehicle IDs, fetches their locations from Redis hashes, performs a batch `UPDATE vehicles SET last_location = ...`, then clears the dirty set.
- If the flush job fails, the dirty set is preserved and retried on the next cycle.

---

## 5. Shipment Lifecycle State Machine

The shipment state machine is the core business logic. It must be implemented as a deterministic finite automaton with guards (preconditions) on transitions.

### State Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
┌───────┐    ┌───────────┐    ┌──────────┐    ┌───────────┐    ┌─────────────┐
│ draft │───▶│ confirmed │───▶│ assigned │───▶│ picked_up │───▶│  in_transit │
└───────┘    └───────────┘    └──────────┘    └───────────┘    └─────────────┘
    │              │               │                                  │
    │              │               │                                  ├───▶ delivered ───▶ completed
    │              │               │                                  │
    │              │               │                                  └───▶ failed
    │              │               │
    └──────────────┴───────────────┴──────────────────────────────────────▶ cancelled
```

### Transition Table

| From | To | Guard (preconditions) | Side Effects |
|---|---|---|---|
| `draft` | `confirmed` | All required fields populated. `cargo_weight_kg <= 50000`. If `requires_temp_control`, temp range must be set. | Generate `reference_code` if not set. |
| `draft` | `cancelled` | None. | Set `cancellation_reason` (required). |
| `confirmed` | `assigned` | `assigned_vehicle_id` AND `assigned_driver_id` must be set. Vehicle `capacity_kg >= cargo_weight_kg`. Vehicle `capacity_m3 >= cargo_volume_m3`. Vehicle status must be `available`. Driver status must be `available`. If `cargo_type = 'perishable'`, vehicle type must be `refrigerated`. | Update vehicle status to `in_transit`. Update driver status to `driving`. |
| `confirmed` | `cancelled` | None. | Set `cancellation_reason`. |
| `assigned` | `picked_up` | Current time must be within 2 hours of `scheduled_pickup_at` (or no schedule set). | Set `actual_pickup_at = now()`. |
| `assigned` | `cancelled` | None. | Revert vehicle status to `available`. Revert driver status to `available`. Set `cancellation_reason`. |
| `picked_up` | `in_transit` | Automatic — triggers immediately after `picked_up`. | Begin tracking shipment location (linked to vehicle's live location). |
| `in_transit` | `delivered` | Must have proof of delivery: at least `pod_signature_url` OR one `pod_photo_urls` entry. | Set `actual_delivery_at = now()`. |
| `in_transit` | `failed` | `failure_reason` must be provided. | Revert vehicle/driver to `available`. Trigger webhook `shipment.failed`. |
| `delivered` | `completed` | No additional checks. | Trigger webhook `shipment.completed`. Revert vehicle/driver to `available`. |
| `failed` | `confirmed` | Allows retry. Clears `failure_reason`. | — |
| `cancelled` | — | Terminal state. | — |
| `completed` | — | Terminal state. | — |

> **CONSTRAINT**: Every transition MUST be implemented in a `ShipmentStateMachine` service class that:
> 1. Validates the current state allows the requested transition.
> 2. Evaluates all guards — if any guard fails, returns a detailed error (which guard failed and why).
> 3. Executes all side effects within a single PostgreSQL transaction.
> 4. Writes a `shipment_events` audit record within the same transaction.
> 5. After commit, publishes an event to Redis for real-time fan-out and webhook dispatch.
>
> The state machine MUST NOT be implemented with if/else chains. Use a transition map (object/Map) keyed by `{fromState}:{toState}` mapping to `{ guards: Function[], sideEffects: Function[] }`.

### Reference Code Generation

Format: `SHP-{YYYYMMDD}-{NNNNN}` where `NNNNN` is a zero-padded sequence number per tenant per day.

Implementation: Use a Redis counter `shipment_seq:{tenantId}:{date}` with `INCR`. If Redis is unavailable, fall back to a database `SELECT MAX(reference_code)` with a row-level lock.

---

## 6. Route Planning & Optimization

### Route Creation Flow

1. Dispatcher selects shipments to include in a route (drag-and-drop from an unassigned shipments list).
2. Dispatcher assigns a vehicle and driver.
3. System validates compatibility (vehicle capacity, driver license class, temperature requirements).
4. Dispatcher can manually reorder stops (drag-and-drop) or request optimization.

### Optimization Algorithm

Implement a **nearest-neighbor heuristic** for route ordering:

1. Starting from the first pickup, greedily visit the nearest unvisited stop.
2. **Constraints during optimization**:
   - Pickup MUST come before its corresponding delivery (precedence constraint).
   - Total cargo at any point MUST NOT exceed vehicle capacity (cumulative weight check at each stop).
   - Driver driving hours must not be exceeded (estimate 60 km/h average for time calculations).

> **CONSTRAINT**: The optimization MUST run as a BullMQ background job, NOT synchronously in the request handler. The API returns a 202 Accepted with a job ID. The frontend polls for job completion (or receives the result via WebSocket).

### Distance Calculation

Use the **Haversine formula** for straight-line distance between stops. Implement in `packages/shared/src/utils/haversine.ts` so it's usable on both frontend and backend.

```typescript
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number // returns distance in kilometers
```

### Route Polyline

After optimization, generate a simplified polyline connecting all stops in order. Store as PostGIS `LineString`. The frontend renders this on the Leaflet map.

---

## 7. Driver Management & Geofencing

### Driver-Vehicle Assignment Rules

1. A driver can be assigned to at most ONE vehicle at a time.
2. A vehicle can have at most ONE assigned driver at a time.
3. Assignment requires mutual availability (`driver.status = 'available'` AND `vehicle.status = 'available'`).
4. The driver's `license_classes` must include the required class for the vehicle type:
   - `van` → `B`
   - `truck` → `C`
   - `semi` → `CE`
   - `refrigerated` → `C`
5. The driver's `license_expiry` must be in the future.

### Hours of Service (HoS) Tracking

- When a driver's status changes to `driving`, a Redis key `driving_start:{driverId}` is set to `Date.now()`.
- When status changes away from `driving`, the elapsed time is calculated and added to `current_driving_hours`.
- A nightly cron job (midnight UTC) resets all drivers' `current_driving_hours` to 0.

### Geofence Checking

For every incoming vehicle location update:

1. Fetch all active geofences for the tenant from Redis cache (cached for 60 seconds, invalidated on geofence CRUD).
2. For each geofence, check if the vehicle's new location is inside using `ST_Contains(geofence.geometry, ST_SetSRID(ST_MakePoint(lng, lat), 4326))`.
3. Compare with the vehicle's previous inside/outside state (stored in Redis: `geofence_state:{vehicleId}:{geofenceId}`).
4. Generate events:
   - **Enter**: Was `outside`, now `inside` → create `geofence_events` record + push notification via WebSocket.
   - **Exit**: Was `inside`, now `outside` → create `geofence_events` record + push notification.

> **CONSTRAINT**: Geofence checks for a single vehicle MUST be batched into a single SQL query using `ST_Contains` with a subquery joining the geofences table — NOT one query per geofence.

### Geofence Editor (Frontend)

- Draw circles on the map by clicking a center point and dragging to set radius.
- Edit existing geofences by dragging the center or resizing.
- Form panel for name, trigger settings.
- Save sends the geometry as GeoJSON to the backend.

---

## 8. Frontend Application (Vue 3)

### Routing Structure

```
/login                          → LoginView
/register                       → RegisterView
/                               → redirect to /dashboard
/dashboard                      → DashboardView
/shipments                      → ShipmentListView
/shipments/new                  → ShipmentCreateView
/shipments/:id                  → ShipmentDetailView
/shipments/:id/edit             → ShipmentEditView
/vehicles                       → VehicleListView
/vehicles/:id                   → VehicleDetailView
/drivers                        → DriverListView
/drivers/:id                    → DriverDetailView
/routes                         → RouteListView
/routes/new                     → RoutePlannerView
/routes/:id                     → RouteDetailView
/geofences                      → GeofenceListView
/geofences/new                  → GeofenceEditorView
/geofences/:id/edit             → GeofenceEditorView
/settings                       → SettingsView
/settings/webhooks              → WebhookSettingsView
/settings/users                 → UserManagementView
```

### Pinia Stores

| Store | Responsibilities |
|---|---|
| `useAuthStore` | Login/logout, token management, user info, refresh logic |
| `useTrackingStore` | WebSocket connection, vehicle positions (reactive Map), connection status |
| `useShipmentStore` | Shipment CRUD, filtering, pagination, optimistic updates |
| `useVehicleStore` | Vehicle CRUD, status management |
| `useDriverStore` | Driver CRUD |
| `useRouteStore` | Route CRUD, optimization job polling |
| `useGeofenceStore` | Geofence CRUD |
| `useNotificationStore` | Notification list, unread count, mark-as-read |

### Critical UI Components

#### 1. `DataTable.vue` — Generic sortable, filterable, paginated table

**Requirements:**
- Generic component using Vue 3 generics (`<script setup lang="ts" generic="T">`).
- Props: `columns: ColumnDef<T>[]`, `data: T[]`, `loading: boolean`, `totalItems: number`, `page: number`, `pageSize: number`.
- Emits: `update:page`, `update:pageSize`, `update:sort`, `update:filters`.
- Features:
  - Column sorting (click header to toggle asc/desc/none).
  - Per-column text search filter (debounced 300ms).
  - Row selection with checkboxes.
  - Loading skeleton with shimmer animation.
  - Empty state with message.
  - Responsive: on mobile (<768px), switch to a card layout.

#### 2. `LiveMap.vue` — Real-time fleet map

**Requirements:**
- Uses Leaflet with OpenStreetMap tiles.
- Vehicle markers update positions smoothly (CSS transition or Leaflet `setLatLng` with animation, NOT jumping).
- Custom vehicle markers (SVG icons) rotated by heading.
- Marker clustering when > 50 vehicles visible (use `leaflet.markercluster`).
- Click vehicle → popup with details + "Track" button.
- "Track" mode: map follows a specific vehicle, auto-centering on each update.
- Geofence overlay for all active geofences (circles).
- Route polylines with directional arrows.
- Fit bounds to show all vehicles on initial load.

#### 3. `RoutePlanner.vue` — Drag-and-drop route builder

**Requirements:**
- Split view: left panel (stop list) | right panel (map preview).
- Left panel:
  - Unassigned shipments list (filterable, scrollable).
  - Drag shipments from unassigned list into the route stops list.
  - Reorder stops via drag-and-drop.
  - Running total of cargo weight with progress bar against vehicle capacity (turns red when exceeded).
  - "Optimize Route" button triggers backend optimization job.
- Right panel:
  - Map showing all stops as numbered markers.
  - Route polyline connecting stops in order.
  - Updates live as stops are reordered.
  - Estimated total distance displayed.

#### 4. `ShipmentTimeline.vue` — Visual event history

**Requirements:**
- Vertical timeline showing all `shipment_events` for a shipment.
- Each event shows: icon (by type), status badge, timestamp, user who triggered it, notes.
- Color-coded by transition type (green for progress, red for failure/cancel, blue for info).
- Auto-loads new events via WebSocket when viewing an active shipment.

### Composables

#### `useWebSocket(url, options)`
- On disconnect, retry with exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s.
- Connection status indicator: green dot = connected, yellow = reconnecting, red = disconnected.
- Queue messages sent while disconnected; replay on reconnect.
- Heartbeat: send `{"type":"ping"}` every 30 seconds. If no `{"type":"pong"}` within 5 seconds, trigger reconnect.

#### `useOptimisticUpdate()`
- Immediately apply change to Pinia store.
- Send API request.
- If request fails, revert store and show error toast.

### Tailwind CSS Design System

```javascript
colors: {
  primary: { /* 50-950 scale based on #2563EB (blue) */ },
  accent: { /* 50-950 scale based on #F59E0B (amber) */ },
  success: { /* 50-950 scale based on #10B981 (emerald) */ },
  danger: { /* 50-950 scale based on #EF4444 (red) */ },
  warning: { /* 50-950 scale based on #F97316 (orange) */ },
  surface: { light: '#F8FAFC', DEFAULT: '#F1F5F9', dark: '#E2E8F0' },
  sidebar: { bg: '#1E293B', text: '#CBD5E1', active: '#3B82F6' }
}
```

**Layout**: Sidebar navigation (collapsible) + top header bar + main content area. Sidebar is dark (slate-800), content area is light (slate-50). The sidebar shows: logo, nav links with icons, user avatar + name at bottom, collapse/expand toggle.

**Responsive breakpoints**: Sidebar collapses to a hamburger menu on screens < 1024px. Tables switch to card layout on screens < 768px.

### Dashboard Widgets (DashboardView)

1. **Fleet Overview Cards** (top row):
   - Total vehicles / Active / Available / In maintenance
   - Total drivers / On duty / Off duty
   - Active shipments / Delivered today

2. **Live Map** (large, center): Shows all vehicles with real-time positions. Geofence areas as circles. Active route polylines.

3. **Shipments by Status** (doughnut chart): Distribution across all states. Clicking a segment filters the table below.

4. **Deliveries Over Time** (line chart): Last 30 days, completed vs failed.

5. **Recent Alerts Feed** (scrollable list): Last 20 geofence events, auto-updates via WebSocket.

---

## 9. API Design & Contracts

### Base URL: `/api/v1`

### Standard Response Envelope

```typescript
// Success
{ "success": true, "data": T, "meta": { "page", "pageSize", "totalItems", "totalPages" } }

// Error
{ "success": false, "error": { "code": string, "message": string, "details": any } }
```

### Endpoint Catalog

#### Authentication
```
POST   /api/v1/auth/register         → Create tenant + owner user
POST   /api/v1/auth/login            → Returns access + refresh tokens
POST   /api/v1/auth/refresh          → Refresh access token
POST   /api/v1/auth/logout           → Invalidate refresh token
GET    /api/v1/auth/me               → Current user profile
```

#### Shipments
```
GET    /api/v1/shipments              → List (paginated, filterable, sortable)
POST   /api/v1/shipments              → Create (draft)
GET    /api/v1/shipments/:id          → Get by ID
PUT    /api/v1/shipments/:id          → Update
DELETE /api/v1/shipments/:id          → Soft delete (only draft)
POST   /api/v1/shipments/:id/transition → State machine transition
GET    /api/v1/shipments/:id/events   → Event/audit history
```

**Filtering (query params for GET /shipments):**
- `status` — comma-separated: `?status=draft,confirmed`
- `priority` — comma-separated: `?priority=high,critical`
- `search` — text search on `reference_code`, `customer_name`
- `sort` — field name, prefix with `-` for desc: `?sort=-created_at`
- `page` / `pageSize` — pagination (default page=1, pageSize=25, max 100)

**Transition endpoint body:**
```json
{
  "action": "confirm" | "assign" | "pickup" | "deliver" | "fail" | "complete" | "cancel",
  "data": {
    // For "assign": { vehicle_id, driver_id }
    // For "deliver": { pod_signature_url, pod_photo_urls }
    // For "fail": { failure_reason }
    // For "cancel": { cancellation_reason }
  }
}
```

#### Vehicles
```
GET    /api/v1/vehicles               → List (paginated, filterable)
POST   /api/v1/vehicles               → Create
GET    /api/v1/vehicles/:id           → Get by ID (includes current location)
PUT    /api/v1/vehicles/:id           → Update
DELETE /api/v1/vehicles/:id           → Soft delete (decommission)
```

#### Drivers
```
GET    /api/v1/drivers                → List
POST   /api/v1/drivers                → Create
GET    /api/v1/drivers/:id            → Get by ID
PUT    /api/v1/drivers/:id            → Update
DELETE /api/v1/drivers/:id            → Soft delete
POST   /api/v1/drivers/:id/assign-vehicle → Assign to vehicle
POST   /api/v1/drivers/:id/unassign-vehicle → Unassign from vehicle
```

#### Routes
```
GET    /api/v1/routes                 → List
POST   /api/v1/routes                 → Create
GET    /api/v1/routes/:id             → Get with stops
PUT    /api/v1/routes/:id             → Update
DELETE /api/v1/routes/:id             → Delete (only draft)
POST   /api/v1/routes/:id/optimize   → Trigger optimization (returns 202 + job ID)
GET    /api/v1/routes/:id/optimize/:jobId → Poll optimization status
PUT    /api/v1/routes/:id/stops      → Bulk update stop order
POST   /api/v1/routes/:id/stops/:stopId/complete → Mark stop completed
```

#### Geofences
```
GET    /api/v1/geofences              → List
POST   /api/v1/geofences              → Create
GET    /api/v1/geofences/:id          → Get by ID
PUT    /api/v1/geofences/:id          → Update
DELETE /api/v1/geofences/:id          → Delete
GET    /api/v1/geofences/:id/events   → List trigger events
```

#### Analytics
```
GET    /api/v1/analytics/overview     → Dashboard summary stats
GET    /api/v1/analytics/shipments    → Shipment stats over time range
```

#### Webhooks
```
GET    /api/v1/webhooks               → List endpoints
POST   /api/v1/webhooks               → Create endpoint
PUT    /api/v1/webhooks/:id           → Update
DELETE /api/v1/webhooks/:id           → Delete
POST   /api/v1/webhooks/:id/test     → Send test webhook
```

#### Users (owner/admin only)
```
GET    /api/v1/users                  → List tenant users
POST   /api/v1/users                  → Create user
PUT    /api/v1/users/:id              → Update user
DELETE /api/v1/users/:id              → Deactivate user
```

---

## 10. Background Job Processing

### BullMQ Queue Architecture

| Queue Name | Job Types | Concurrency | Notes |
|---|---|---|---|
| `location-flush` | `flush-locations` | 1 | Repeatable every 5s. Singleton. |
| `route-optimization` | `optimize-route` | 2 | CPU-intensive. Emits progress. |
| `webhooks` | `deliver-webhook` | 5 | Exponential backoff retries. |
| `maintenance` | `driving-hours-reset`, `geofence-check` | 1 | Scheduled/cron jobs. |

### Repeatable/Cron Jobs

| Job | Schedule | Description |
|---|---|---|
| `flush-locations` | Every 5 seconds | Batch-write vehicle locations from Redis to PostgreSQL |
| `driving-hours-reset` | Daily at 00:00 UTC | Reset all drivers' `current_driving_hours` to 0 |

### Webhook Delivery

- Payloads signed with HMAC-SHA256 using the endpoint's `secret`.
- Signature sent in `X-NexusFleet-Signature` header as `sha256={hex_digest}`.
- Retry with exponential backoff: immediate → 1 min → 5 min → 30 min → 2 hours (5 attempts total).
- After 5 consecutive failures, deactivate the endpoint and notify the tenant owner.

### Webhook Events

| Event | Trigger |
|---|---|
| `shipment.status_changed` | Any state transition |
| `shipment.completed` | Terminal `completed` state |
| `shipment.failed` | Terminal `failed` state |
| `geofence.triggered` | Any geofence enter/exit event |

---

## 11. Docker Compose & Infrastructure

### `docker-compose.yml`

The entire application MUST be runnable with a single `docker compose up` command.

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: nexusfleet
      POSTGRES_USER: nexusfleet
      POSTGRES_PASSWORD: nexusfleet_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nexusfleet"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://nexusfleet:nexusfleet_dev@postgres:5432/nexusfleet
      REDIS_URL: redis://redis:6379
      JWT_PRIVATE_KEY: ${JWT_PRIVATE_KEY}
      JWT_PUBLIC_KEY: ${JWT_PUBLIC_KEY}
      CORS_ORIGIN: http://localhost:5173
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./packages/backend/src:/app/packages/backend/src
      - ./packages/shared/src:/app/packages/shared/src
    command: >
      sh -c "
        npm run db:migrate &&
        npm run db:seed &&
        npm run dev
      "

  frontend:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_WS_URL: ws://localhost:3000
    depends_on:
      - backend
    volumes:
      - ./packages/frontend/src:/app/packages/frontend/src
      - ./packages/shared/src:/app/packages/shared/src
    command: npm run dev -- --host 0.0.0.0

volumes:
  postgres_data:
  redis_data:
```

### `scripts/init-db.sql`

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Environment Setup

A `.env.example` file must be provided with all required environment variables. A `scripts/generate-keys.sh` script must generate the RS256 key pair for JWT signing.

### Seeding

The `db:seed` script must create:
- 1 tenant ("Acme Logistics", plan: `pro`)
- 4 users (one per role: owner, admin, dispatcher, viewer) with password `Password1!`
- 8 vehicles (mix of types, random locations in the New York metro area)
- 6 drivers (various statuses, license classes)
- 15 shipments (across all statuses, with realistic data)
- 2 routes (one draft, one active) with stops
- 3 geofences (circles around NYC landmarks)

> **CONSTRAINT**: The seed data must be deterministic (use a seeded random number generator with seed value `42`) so that tests can rely on it.

---

## 12. Testing Requirements

### Backend Unit Tests (Vitest)

1. **Shipment State Machine**: Test every valid transition, every invalid transition, every guard condition. 20+ test cases.
2. **Haversine distance function**: Known-distance city pairs.
3. **Route optimization**: Verify precedence constraints (pickup before delivery) are maintained.
4. **Geofence containment**: Points inside/outside circles.
5. **Auth middleware**: Valid token, expired token, missing token, wrong tenant.

### Frontend Component Tests (Vitest + Vue Test Utils)

1. **DataTable**: Sorting, filtering, pagination, responsive mode switch.
2. **ShipmentTimeline**: Correct rendering of events, color coding.

### E2E Tests (Playwright)

1. Full shipment lifecycle: login → create shipment → confirm → assign → mark picked up → mark delivered → complete.
2. Route planning: create route → add shipments via drag-and-drop → optimize → verify map updates.

---

## 13. Non-Functional Requirements

### Performance
- API response time for list endpoints: < 200ms for up to 1000 records.
- WebSocket location broadcast latency: < 100ms from ingestion to dashboard.
- Route optimization for 15 stops: < 5 seconds.
- Frontend initial load (Lighthouse): Performance score > 80.

### Security
- Passwords hashed with bcrypt (cost factor 12).
- SQL injection prevention via Drizzle ORM parameterized queries.
- CORS configured to allow only the frontend origin.
- Rate limiting on auth endpoints: 10 req/min per IP.
- Refresh token rotation: one-time use, stored hashed.

### Error Handling
- Backend: Global Fastify error handler. Sanitized error responses (no stack traces in production).
- Frontend: Global Vue error handler with toast notifications.
- Consistent HTTP status codes: 400 (validation), 401 (auth), 403 (permissions), 404 (not found), 409 (conflict/state machine), 429 (rate limit), 500 (server error).

### Logging
- Backend uses `pino` logger (Fastify default).
- Structured JSON logs with: `timestamp`, `level`, `msg`, `tenantId`, `userId`, `requestId`.
- Every request gets a unique `requestId` (UUID) returned in `X-Request-Id` header.

### Database Migrations
- All schema changes via Drizzle migrations.
- Migrations run on startup before the server starts.

---

## Summary of Intentional Complexity Points

This epic tests the following interconnected challenges:

1. **Cross-cutting tenant isolation** — every query, every cache key, every WebSocket channel must be tenant-scoped. One miss = data leak.
2. **State machine with transactional side effects** — the shipment lifecycle touches 3 tables atomically (shipment, vehicle, driver). Incorrect transaction boundaries = data inconsistency.
3. **Real-time pipeline (WS → Redis → DB)** — three different consistency models (real-time, eventually consistent, persistent) that must work together.
4. **Geospatial queries** — PostGIS operations, coordinate systems, spatial containment checks.
5. **Shared validation schemas** — Zod schemas must work identically on frontend (VeeValidate) and backend (Fastify).
6. **Interactive UI components** — DataTable with generics, drag-and-drop route planner, live map with clustering and smooth marker animation.
7. **Background job orchestration** — 4 queues with different concurrency, retry, and scheduling strategies.
8. **Optimistic UI updates** — the frontend must handle the case where the server rejects an optimistic change.
9. **WebSocket subscription management** — selective channels, reconnection with replay, heartbeat.
10. **Webhook delivery with retry** — exponential backoff, HMAC signing, automatic deactivation.

> **Final constraint**: The entire application must start with `docker compose up` and be fully functional with seeded data. A user should be able to log in, see vehicles on the map, create a shipment, plan a route, and track a delivery — all without any additional setup.
