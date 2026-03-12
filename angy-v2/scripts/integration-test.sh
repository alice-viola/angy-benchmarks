#!/usr/bin/env bash
# Integration test script: starts all services from clean state,
# waits for health checks, runs data setup, verifies connectivity,
# and tears down everything cleanly.
set -uo pipefail

COMPOSE_PROJECT="nexusfleet-integration-test"
COMPOSE_CMD="docker compose -p ${COMPOSE_PROJECT}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; }
pass()  { echo -e "${GREEN}[PASS]${NC} $*"; }

FAILED=0
assert_eq() {
  local desc="$1"
  local actual="$2"
  local expected="$3"
  if [ "$actual" = "$expected" ]; then
    pass "$desc"
  else
    fail "$desc (expected='$expected', actual='$actual')"
    FAILED=$((FAILED + 1))
  fi
}

assert_cmd() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    pass "$desc"
  else
    fail "$desc"
    FAILED=$((FAILED + 1))
  fi
}

assert_range() {
  local desc="$1"
  local actual="$2"
  local min="$3"
  local max="$4"
  if awk "BEGIN{exit !($actual >= $min && $actual <= $max)}"; then
    pass "$desc"
  else
    fail "$desc (value='$actual' not in range [$min, $max])"
    FAILED=$((FAILED + 1))
  fi
}

PSQL_CMD() {
  $COMPOSE_CMD exec -T postgres psql -U nexusfleet -d nexusfleet -tAc "$1" 2>/dev/null | tr -d '[:space:]'
}

cleanup() {
  log "Tearing down all services..."
  $COMPOSE_CMD down -v --remove-orphans 2>/dev/null || true
  log "Cleanup complete."
}

# Always clean up on exit
trap cleanup EXIT

# ─── Phase 0: Clean state ─────────────────────────────────────────────
log "Ensuring clean state (removing any leftover containers/volumes)..."
$COMPOSE_CMD down -v --remove-orphans 2>/dev/null || true

# Verify no leftover containers from this project
LEFTOVER=$($COMPOSE_CMD ps -q 2>/dev/null | wc -l | tr -d ' ')
if [ "$LEFTOVER" -ne 0 ]; then
  fail "Leftover containers detected after cleanup!"
  exit 1
fi
pass "Clean state confirmed — no leftover containers or volumes"

# ─── Phase 1: Start infrastructure services ──────────────────────────
log "Starting postgres and redis..."
$COMPOSE_CMD up -d postgres redis || { fail "Failed to start services"; exit 1; }

# ─── Phase 2: Wait for health checks ────────────────────────────────
log "Waiting for PostgreSQL to be healthy..."
RETRIES=30
until $COMPOSE_CMD exec -T postgres pg_isready -U nexusfleet -d nexusfleet >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    fail "PostgreSQL failed to become healthy within timeout"
    exit 1
  fi
  sleep 2
done
pass "PostgreSQL is healthy"

# Wait for init scripts (extensions) to complete — pg_isready returns true
# before docker-entrypoint-initdb.d scripts finish on first boot.
log "Waiting for PostgreSQL init scripts to complete..."
RETRIES=20
until $COMPOSE_CMD exec -T postgres psql -U nexusfleet -d nexusfleet -tAc \
  "SELECT 1 FROM pg_extension WHERE extname = 'postgis';" >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    warn "Timed out waiting for init scripts, continuing..."
    break
  fi
  sleep 2
done

log "Waiting for Redis to be healthy..."
RETRIES=20
until $COMPOSE_CMD exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    fail "Redis failed to become healthy within timeout"
    exit 1
  fi
  sleep 2
done
pass "Redis is healthy"

# ─── Phase 3: Data setup (migrations + extensions) ───────────────────
log "Verifying PostGIS extension is enabled..."
POSTGIS_CHECK=$(PSQL_CMD "SELECT count(*)::text FROM pg_extension WHERE extname = 'postgis';")
assert_eq "PostGIS extension is installed" "${POSTGIS_CHECK:-0}" "1"

UUID_CHECK=$(PSQL_CMD "SELECT count(*)::text FROM pg_extension WHERE extname = 'uuid-ossp';")
assert_eq "uuid-ossp extension is installed" "${UUID_CHECK:-0}" "1"

# Determine the mapped port for postgres
DB_PORT=$($COMPOSE_CMD port postgres 5432 | cut -d: -f2)
DB_URL="postgresql://nexusfleet:nexusfleet_dev@localhost:${DB_PORT}/nexusfleet"

# Create tables via DDL (avoids interactive drizzle-kit push prompts)
log "Creating database tables..."
$COMPOSE_CMD exec -T postgres psql -U nexusfleet -d nexusfleet -f /dev/stdin <<'SQLEOF'
CREATE TABLE IF NOT EXISTS tenants (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name VARCHAR(255) NOT NULL, slug VARCHAR(100) NOT NULL UNIQUE, plan VARCHAR(50) NOT NULL DEFAULT 'free', is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS users (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), email VARCHAR(255) NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL, first_name VARCHAR(100), last_name VARCHAR(100), is_active BOOLEAN DEFAULT true, refresh_token_hash VARCHAR(255), last_login_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email));
CREATE TABLE IF NOT EXISTS drivers (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), employee_id VARCHAR(100) NOT NULL, first_name VARCHAR(100), last_name VARCHAR(100), phone VARCHAR(50), license_number VARCHAR(100), license_expiry DATE, license_classes TEXT[], status VARCHAR(50) DEFAULT 'off_duty', current_vehicle_id UUID, max_driving_hours_day DECIMAL DEFAULT 9.0, current_driving_hours DECIMAL DEFAULT 0, is_active BOOLEAN DEFAULT true, created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), CONSTRAINT drivers_tenant_employee_id_unique UNIQUE (tenant_id, employee_id));
CREATE TABLE IF NOT EXISTS vehicles (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), registration VARCHAR(100) NOT NULL, vin VARCHAR(17) NOT NULL, make VARCHAR(100), model VARCHAR(100), year INTEGER, type VARCHAR(50), capacity_kg DECIMAL NOT NULL, capacity_m3 DECIMAL NOT NULL, status VARCHAR(50) DEFAULT 'available', last_location geometry(Point,4326), last_location_at TIMESTAMPTZ, last_speed_kmh DECIMAL, heading DECIMAL, assigned_driver_id UUID REFERENCES drivers(id), is_active BOOLEAN DEFAULT true, created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), CONSTRAINT vehicles_tenant_registration_unique UNIQUE (tenant_id, registration), CONSTRAINT vehicles_tenant_vin_unique UNIQUE (tenant_id, vin));
CREATE TABLE IF NOT EXISTS routes (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), name VARCHAR(255) NOT NULL, status VARCHAR(50) DEFAULT 'draft', vehicle_id UUID REFERENCES vehicles(id), driver_id UUID REFERENCES drivers(id), planned_date DATE, estimated_distance_km DECIMAL, optimization_score DECIMAL, polyline geometry(LineString,4326), created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS shipments (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), reference_code VARCHAR(100), status VARCHAR(50) DEFAULT 'draft', priority VARCHAR(50) DEFAULT 'normal', customer_name VARCHAR(255) NOT NULL, origin_address TEXT NOT NULL, origin_location geometry(Point,4326), dest_address TEXT NOT NULL, dest_location geometry(Point,4326), cargo_description TEXT, cargo_weight_kg DECIMAL, cargo_volume_m3 DECIMAL, cargo_type VARCHAR(50), requires_temp_control BOOLEAN DEFAULT false, temp_min_c DECIMAL, temp_max_c DECIMAL, assigned_vehicle_id UUID REFERENCES vehicles(id), assigned_driver_id UUID REFERENCES drivers(id), assigned_route_id UUID REFERENCES routes(id), scheduled_pickup_at TIMESTAMPTZ, actual_pickup_at TIMESTAMPTZ, actual_delivery_at TIMESTAMPTZ, estimated_arrival_at TIMESTAMPTZ, pod_signature_url TEXT, pod_photo_urls TEXT[], pod_notes TEXT, failure_reason TEXT, cancellation_reason TEXT, created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS shipment_events (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), shipment_id UUID NOT NULL REFERENCES shipments(id), event_type VARCHAR(100) NOT NULL, from_status VARCHAR(50), to_status VARCHAR(50), notes TEXT, metadata JSONB, created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS route_stops (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, route_id UUID NOT NULL REFERENCES routes(id), shipment_id UUID REFERENCES shipments(id), stop_type VARCHAR(50) NOT NULL, sequence_order INTEGER NOT NULL, location geometry(Point,4326), address TEXT, planned_arrival TIMESTAMPTZ, actual_arrival TIMESTAMPTZ, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS geofences (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), name VARCHAR(255) NOT NULL, center_lat DECIMAL NOT NULL, center_lng DECIMAL NOT NULL, radius_m DECIMAL NOT NULL, geometry geometry(Polygon,4326), color VARCHAR(7) DEFAULT '#3B82F6', trigger_on_enter BOOLEAN DEFAULT true, trigger_on_exit BOOLEAN DEFAULT true, is_active BOOLEAN DEFAULT true, created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS geofence_events (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), geofence_id UUID NOT NULL REFERENCES geofences(id), vehicle_id UUID NOT NULL REFERENCES vehicles(id), event_type VARCHAR(10) NOT NULL, location geometry(Point,4326), triggered_at TIMESTAMPTZ, acknowledged_at TIMESTAMPTZ, acknowledged_by UUID);
CREATE TABLE IF NOT EXISTS notifications (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), user_id UUID NOT NULL REFERENCES users(id), type VARCHAR(100), title VARCHAR(255), body TEXT, data JSONB, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS webhook_endpoints (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), url TEXT NOT NULL, events TEXT[], secret VARCHAR(255) NOT NULL, secret_hash VARCHAR(255) NOT NULL, is_active BOOLEAN DEFAULT true, failure_count INTEGER DEFAULT 0, created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS vehicle_tokens (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), vehicle_id UUID NOT NULL REFERENCES vehicles(id) UNIQUE, token_hash VARCHAR(255) NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ);
SQLEOF
pass "Database tables created"

# Run seed
log "Running database seed..."
DATABASE_URL="$DB_URL" npx tsx packages/backend/src/db/seed.ts 2>&1 | tail -20
pass "Seed script completed"

# ─── Phase 4: Verify seed data ──────────────────────────────────────
log "Verifying seed data..."

# 4.1 Tenant count and name
TENANT_COUNT=$(PSQL_CMD "SELECT count(*)::text FROM tenants;")
assert_eq "Exactly 1 tenant" "${TENANT_COUNT:-0}" "1"

TENANT_NAME=$(PSQL_CMD "SELECT name FROM tenants LIMIT 1;")
assert_eq "Tenant name is 'Acme Logistics'" "${TENANT_NAME}" "AcmeLogistics"

# 4.2 Users
USER_COUNT=$(PSQL_CMD "SELECT count(*)::text FROM users;")
assert_eq "Exactly 4 users" "${USER_COUNT:-0}" "4"

for ROLE in owner admin dispatcher viewer; do
  ROLE_COUNT=$(PSQL_CMD "SELECT count(*)::text FROM users WHERE role = '$ROLE';")
  assert_eq "User with role '$ROLE' exists" "${ROLE_COUNT:-0}" "1"
done

# 4.3 Shipments
SHIPMENT_COUNT=$(PSQL_CMD "SELECT count(*)::text FROM shipments;")
assert_eq "Exactly 15 shipments" "${SHIPMENT_COUNT:-0}" "15"

# 4.4 Routes
ROUTE_COUNT=$(PSQL_CMD "SELECT count(*)::text FROM routes;")
assert_eq "Exactly 2 routes" "${ROUTE_COUNT:-0}" "2"

# 4.5 Geofences — all in NYC bounding box
GEOFENCE_COUNT=$(PSQL_CMD "SELECT count(*)::text FROM geofences;")
assert_eq "Exactly 3 geofences" "${GEOFENCE_COUNT:-0}" "3"

GF_NYC_CHECK=$(PSQL_CMD "SELECT count(*)::text FROM geofences WHERE center_lat::float BETWEEN 40.4 AND 41.0 AND center_lng::float BETWEEN -74.3 AND -73.7;")
assert_eq "All geofences in NYC bounding box" "${GF_NYC_CHECK:-0}" "3"

# 4.6 Verify idempotency — run seed again
log "Verifying idempotency (running seed again)..."
DATABASE_URL="$DB_URL" npx tsx packages/backend/src/db/seed.ts >/dev/null 2>&1

TENANT_COUNT2=$(PSQL_CMD "SELECT count(*)::text FROM tenants;")
assert_eq "Still 1 tenant after second seed" "${TENANT_COUNT2:-0}" "1"

USER_COUNT2=$(PSQL_CMD "SELECT count(*)::text FROM users;")
assert_eq "Still 4 users after second seed" "${USER_COUNT2:-0}" "4"

SHIPMENT_COUNT2=$(PSQL_CMD "SELECT count(*)::text FROM shipments;")
assert_eq "Still 15 shipments after second seed" "${SHIPMENT_COUNT2:-0}" "15"

# ─── Phase 5: Verify inter-service connectivity ─────────────────────
log "Verifying PostgreSQL accepts connections..."
PG_CONN=$(PSQL_CMD "SELECT 'connected';")
assert_eq "PostgreSQL accepts SQL queries" "${PG_CONN}" "connected"

log "Verifying Redis accepts commands..."
$COMPOSE_CMD exec -T redis redis-cli SET integration_test ok >/dev/null 2>&1 || true
REDIS_GET=$($COMPOSE_CMD exec -T redis redis-cli GET integration_test 2>/dev/null | tr -d '[:space:]' || echo "")
assert_eq "Redis SET/GET works" "$REDIS_GET" "ok"

# Clean up test key
$COMPOSE_CMD exec -T redis redis-cli DEL integration_test >/dev/null 2>&1 || true

log "Verifying cross-container network connectivity..."
NETWORK_CHECK=$($COMPOSE_CMD exec -T redis sh -c \
  'getent hosts postgres >/dev/null 2>&1 && echo ok || echo fail' 2>/dev/null || echo "fail")
assert_eq "Redis container can resolve PostgreSQL hostname" "$NETWORK_CHECK" "ok"

# Verify PostGIS spatial functions work
log "Verifying PostGIS spatial functions..."
SPATIAL=$(PSQL_CMD "SELECT ST_AsText(ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326));")
assert_eq "PostGIS ST_MakePoint works (SRID 4326)" "$SPATIAL" "POINT(-73.985740.7484)"

# Verify uuid-ossp
log "Verifying uuid-ossp function works..."
UUID_VAL=$(PSQL_CMD "SELECT length(uuid_generate_v4()::text)::text;")
assert_eq "uuid_generate_v4() produces valid UUIDs" "${UUID_VAL:-0}" "36"

# ─── Phase 6: Summary ───────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
  log "All integration tests passed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  fail "$FAILED test(s) failed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
